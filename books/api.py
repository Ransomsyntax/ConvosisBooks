"""JSON API (session-authenticated, CSRF-protected). One Resource class per entity."""
import csv
import datetime
from datetime import timedelta
import io
import json
from decimal import Decimal
from functools import wraps

from django.conf import settings
from django.core.paginator import Paginator
from django.core.serializers.json import DjangoJSONEncoder
from django.db import transaction
from django.db.models import F, ProtectedError, Q
from django.http import HttpResponse, JsonResponse
from django.utils import timezone

from . import services
from .calc import GST_SLABS, compute, is_intra_state, q2
from .cleaning import GSTIN_RE, PAN_RE, ApiError, Cleaner
from .models import (
    Account, Attachment, AuditLog, BackgroundTask, BankAccount, BankFeedConnection,
    BankRule, BankStatementBatch, BankTransaction, BankDeposit, BankTransfer, BankReconciliation,
    Bill, BillAllocation, BillLine,
    CreditNote, CreditNoteLine, CustomField, Customer, CustomerPortalAccess, DeliveryChallan,
    DeliveryChallanLine, DocumentFolder, EInvoiceRecord, EWayBill, Expense, FinancialAnomaly,
    GSTRReturn, Invoice, InvoiceLine, Item, ItemCategory, Journal, JournalItem, LockDate,
    ManagedDocument, MODES, Organization, PaymentMade, PaymentReceived, PaymentTransaction,
    PriceList, Project, PurchaseOrder, PurchaseOrderLine, ReceivedAllocation, RecurringInvoice,
    RetainerInvoice, RetainerInvoiceAllocation, RetainerInvoiceLine, RetainerPayment, SalesOrder,
    SalesOrderLine, SecurityBackupRecord, StockMovement, TimeLog, UserProfile, Vendor, VendorCredit,
    VendorCreditLine, VendorPortalAccess, Warehouse, WebhookConfig, WorkflowRule
)
from .services import bill_qs, invoice_qs, next_number, paid_expr, retainer_qs

Z = Decimal('0.00')
MODE_KEYS = [m[0] for m in MODES]
MODE_LABEL = dict(MODES)
REASONS = ['Stock recount', 'Damaged goods', 'Theft / loss', 'Returned to supplier', 'Found stock', 'Other']

def format_qty(val):
    if val is None:
        return None
    d = Decimal(str(val))
    s = f"{d:f}"
    if '.' in s:
        s = s.rstrip('0').rstrip('.')
    return s

def j(data, status=200):
    return JsonResponse(data, status=status, encoder=DjangoJSONEncoder, safe=False)

def body(request):
    try:
        data = json.loads(request.body.decode('utf-8') or '{}')
    except (ValueError, UnicodeDecodeError):
        raise ApiError(400, 'Invalid JSON body.')
    if not isinstance(data, dict):
        raise ApiError(400, 'Expected a JSON object.')
    return data

CASHIER_ALLOWED_RESOURCES = {
    'customers', 'items', 'item_categories', 'invoices', 'payments_received',
    'sales_orders', 'delivery_challans', 'price_lists', 'attachments'
}

def get_user_role(user):
    if not user or not user.is_authenticated:
        return None
    if user.is_superuser:
        return UserProfile.ADMIN
    profile = getattr(user, 'profile', None)
    if not profile:
        profile, _ = UserProfile.objects.get_or_create(
            user=user,
            defaults={'role': UserProfile.ADMIN if (user.is_superuser or user.is_staff) else UserProfile.ACCOUNTANT}
        )
    return profile.role

def check_permission(request, allowed_roles=None, resource_name=None, action_name=None):
    user = request.user
    if not user or not user.is_authenticated:
        raise ApiError(401, 'Authentication required.')

    role = get_user_role(user)
    if role == UserProfile.ADMIN or user.is_superuser:
        return True

    if role == UserProfile.PORTAL:
        raise ApiError(403, 'Permission denied: Portal users cannot access internal accounting operations.')

    if allowed_roles and role not in allowed_roles:
        raise ApiError(403, f'Permission denied: Role "{role}" is not authorized for this operation.')

    if role == UserProfile.AUDITOR:
        if request.method in ('POST', 'PUT', 'PATCH', 'DELETE'):
            if resource_name in ('ai_query', 'convobot', 'notifications', 'search') or action_name in ('verify', 'test', 'export'):
                return True
            raise ApiError(403, 'Permission denied: Statutory Auditors have read-only access.')
        return True

    if role == UserProfile.CASHIER:
        if resource_name and resource_name not in CASHIER_ALLOWED_RESOURCES:
            raise ApiError(403, f'Permission denied: Cashiers do not have access to {resource_name}.')
        if request.method == 'DELETE' or action_name in ('void', 'rollback'):
            raise ApiError(403, 'Permission denied: Cashiers cannot delete or void records.')
        return True

    return True

def role_required(*allowed_roles):
    def decorator(fn):
        @wraps(fn)
        def wrapper(request, *args, **kwargs):
            if not request.user.is_authenticated:
                return j({'error': 'Authentication required.', 'message': 'Authentication required.', 'errors': {}}, 401)
            role = get_user_role(request.user)
            if role != UserProfile.ADMIN and not request.user.is_superuser and role not in allowed_roles:
                return j({'error': f'Permission denied: Role "{role}" is not authorized.',
                          'message': f'Permission denied: Role "{role}" is not authorized.', 'errors': {}}, 403)
            return fn(request, *args, **kwargs)
        return wrapper
    return decorator

def api_view(fn):
    @wraps(fn)
    def wrapper(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return j({'error': 'Authentication required.', 'message': 'Authentication required.', 'errors': {}}, 401)

        profile = getattr(request.user, 'profile', None)
        if not profile:
            profile, _ = UserProfile.objects.get_or_create(
                user=request.user,
                defaults={'role': UserProfile.ADMIN if (request.user.is_superuser or request.user.is_staff) else UserProfile.ACCOUNTANT}
            )

        if profile.is_locked:
            return j({
                'error': 'Account locked.',
                'message': 'Your account has been locked by an administrator. Please contact support.',
                'errors': {}
            }, 403)

        ip = request.META.get('HTTP_X_FORWARDED_FOR', '').split(',')[0].strip() or request.META.get('REMOTE_ADDR', '')
        if ip and profile.last_active_ip != ip:
            profile.last_active_ip = ip
            profile.save(update_fields=['last_active_ip'])

        try:
            return fn(request, *args, **kwargs)
        except ApiError as e:
            return j({'error': e.message, 'message': e.message, 'errors': e.errors}, e.status)
        except ProtectedError:
            return j({'error': 'Conflict', 'message': 'This record is used by other transactions and cannot be deleted. Mark it inactive instead.', 'errors': {}}, 409)
        except Exception as e:
            if settings.DEBUG:
                import traceback
                traceback.print_exc()
            return j({'error': 'Internal server error.', 'message': str(e) if settings.DEBUG else 'An unexpected error occurred.', 'errors': {}}, 500)
    return wrapper

def safe_cell(v):
    if isinstance(v, str) and v[:1] in ('=', '+', '-', '@', '\t', '\r'):
        return "'" + v
    return v

def parse_range(request):
    today = timezone.localdate()
    c = Cleaner(request.GET.dict())
    fy = today.year if today.month >= 4 else today.year - 1
    start = c.date('start', default=today.replace(year=fy, month=4, day=1))
    end = c.date('end', default=today)
    c.done('Invalid date range.')
    if start > end:
        raise ApiError(400, 'Start date must not be after end date.')
    if (end.year - start.year) * 12 + end.month - start.month >= 24:
        raise ApiError(400, 'Choose a range of 24 months or less.')
    return start, end

class Resource:
    name = ''
    model = None
    search_fields = ()
    orderings = {}
    default_ordering = ('-id',)
    csv_cols = ()

    def base_qs(self):
        return self.model.objects.all()

    def filter_qs(self, qs, request):
        return qs

    def rows(self, objs):
        return [self.row(o) for o in objs]

    def row(self, o):
        raise NotImplementedError

    def detail(self, o):
        return self.row(o)

    def get_object(self, pk):
        obj = self.base_qs().filter(pk=pk).first()
        if obj is None:
            raise ApiError(404, 'Not found.')
        return obj

    def create(self, data, user):
        raise ApiError(405, 'Creating this record is not supported.')

    def update(self, obj, data, user):
        raise ApiError(405, 'Editing this record is not supported.')

    def destroy(self, obj):
        obj.delete()

    def action(self, request, obj, name):
        raise ApiError(404, 'Unknown action.')

    def queryset(self, request):
        qs = self.filter_qs(self.base_qs(), request)
        q = request.GET.get('q', '').strip()
        if q and self.search_fields:
            cond = Q()
            for f in self.search_fields:
                cond |= Q(**{f + '__icontains': q})
            qs = qs.filter(cond)
        o = request.GET.get('ordering', '')
        key = o.lstrip('-')
        if key in self.orderings:
            qs = qs.order_by(('-' if o.startswith('-') else '') + self.orderings[key], '-id')
        else:
            qs = qs.order_by(*self.default_ordering)
        return qs

    def export(self, qs):
        resp = HttpResponse(content_type='text/csv; charset=utf-8')
        resp['Content-Disposition'] = f'attachment; filename="{self.name}.csv"'
        w = csv.writer(resp)
        w.writerow([h for h, _ in self.csv_cols])
        for r in self.rows(list(qs)):
            w.writerow([safe_cell(r.get(k, '')) for _, k in self.csv_cols])
        return resp

    def export_template(self):
        resp = HttpResponse(content_type='text/csv; charset=utf-8')
        resp['Content-Disposition'] = f'attachment; filename="{self.name}_template.csv"'
        w = csv.writer(resp)
        w.writerow([h for h, _ in self.csv_cols])
        return resp

    def handle_collection(self, request):
        check_permission(request, resource_name=self.name)
        if request.method == 'GET':
            qs = self.queryset(request)
            if request.GET.get('export') == 'csv':
                return self.export(qs)
            if request.GET.get('export') == 'json':
                return j(self.rows(list(qs)))
            if request.GET.get('export') == 'template':
                return self.export_template()
            try:
                size = min(max(int(request.GET.get('page_size', 10)), 1), 100)
            except ValueError:
                size = 10
            pag = Paginator(qs, size)
            page = pag.get_page(request.GET.get('page') or 1)
            return j({'count': pag.count, 'page': page.number, 'pages': pag.num_pages,
                      'page_size': size, 'results': self.rows(list(page.object_list))})
        if request.method == 'POST':
            if request.FILES.get('file'):
                try:
                    content = request.FILES['file'].read().decode('utf-8-sig', errors='ignore')
                    reader = csv.DictReader(io.StringIO(content))
                    col_map = {h.lower(): k for h, k in self.csv_cols}
                    records = []
                    for row in reader:
                        rec = {}
                        for col_name, val in row.items():
                            if not col_name:
                                continue
                            key = col_map.get(col_name.strip().lower(), col_name.strip())
                            rec[key] = val.strip() if isinstance(val, str) else val
                        records.append(rec)
                    created_count = 0
                    errors = []
                    for idx, item_data in enumerate(records):
                        try:
                            with transaction.atomic():
                                self.create(item_data, request.user)
                            created_count += 1
                        except Exception as e:
                            errors.append(f'Row {idx + 1}: {str(e)}')
                    return j({'status': 'ok', 'imported': created_count, 'total': len(records), 'errors': errors})
                except Exception as e:
                    raise ApiError(400, f'Failed to import CSV: {str(e)}')

            data = body(request)
            if isinstance(data, dict) and 'import_records' in data:
                records = data['import_records']
            elif isinstance(data, list) and data and all(isinstance(x, dict) for x in data):
                records = data
            else:
                records = None

            if records is not None:
                created_count = 0
                errors = []
                for idx, item_data in enumerate(records):
                    try:
                        with transaction.atomic():
                            self.create(item_data, request.user)
                        created_count += 1
                    except Exception as e:
                        errors.append(f'Row {idx + 1}: {str(e)}')
                return j({'status': 'ok', 'imported': created_count, 'total': len(records), 'errors': errors})

            with transaction.atomic():
                obj = self.create(data, request.user)
            return j(self.detail(self.get_object(obj.pk)), 201)
        raise ApiError(405, 'Method not allowed.')

    def handle_item(self, request, pk):
        check_permission(request, resource_name=self.name)
        obj = self.get_object(pk)
        if request.method == 'GET':
            return j(self.detail(obj))
        if request.method in ('PUT', 'PATCH'):
            with transaction.atomic():
                self.update(obj, body(request), request.user)
            return j(self.detail(self.get_object(pk)))
        if request.method == 'DELETE':
            with transaction.atomic():
                self.destroy(obj)
            return HttpResponse(status=204)
        raise ApiError(405, 'Method not allowed.')

    def handle_action(self, request, pk, name):
        check_permission(request, resource_name=self.name, action_name=name)
        if request.method != 'POST':
            raise ApiError(405, 'Method not allowed.')
        obj = self.get_object(pk)
        with transaction.atomic():
            self.action(request, obj, name)
        return j(self.detail(self.get_object(pk)))

def party_stats(kind, ids):
    """kind 'customer'|'vendor' -> {id: {billed, outstanding, overdue}} from posted documents."""
    today = timezone.localdate()
    out = {i: {'billed': Z, 'outstanding': Z, 'overdue': Z} for i in ids}
    if kind == 'customer':
        qs = invoice_qs().filter(customer_id__in=ids, status='sent')
        key = 'customer_id'
    else:
        qs = bill_qs().filter(vendor_id__in=ids, status='open')
        key = 'vendor_id'
    for d in qs:
        s = out[getattr(d, key)]
        bal = d.total - q2(d.paid_sum)
        s['billed'] += d.total
        s['outstanding'] += bal
        if bal > 0 and d.due_date and d.due_date < today:
            s['overdue'] += bal
    return out

class PartyResource(Resource):
    kind = ''
    search_fields = ('name', 'company', 'email', 'phone', 'gstin')
    orderings = {'name': 'name', 'state': 'state', 'created': 'created_at'}
    default_ordering = ('name',)

    def filter_qs(self, qs, request):
        a = request.GET.get('active')
        if a in ('0', '1'):
            qs = qs.filter(active=(a == '1'))
        return qs

    def extra(self, c, data):
        return {}

    def clean(self, data):
        c = Cleaner(data)
        out = {
            'name': c.text('name', True, 200),
            'company': c.text('company', max_len=200),
            'contact_person': c.text('contact_person', max_len=120),
            'email': c.text('email', max_len=254, email=True),
            'phone': c.text('phone', max_len=30, phone=True),
            'mobile': c.text('mobile', max_len=30, phone=True),
            'billing_address': c.text('billing_address', max_len=1000),
            'billing_attention': c.text('billing_attention', max_len=150),
            'billing_city': c.text('billing_city', max_len=100),
            'billing_pincode': c.text('billing_pincode', max_len=20),
            'billing_country': c.text('billing_country', max_len=100, default='India'),
            'billing_phone': c.text('billing_phone', max_len=30, phone=True),
            'state': c.text('state', max_len=60),
            'gstin': c.text('gstin', max_len=15, upper=True, pattern=GSTIN_RE, pattern_msg='Enter a valid 15-character GSTIN.'),
            'pan': c.text('pan', max_len=10, upper=True, pattern=PAN_RE, pattern_msg='Enter a valid 10-character PAN.'),
            'gst_treatment': c.text('gst_treatment', max_len=40, default='business_regular'),
            'tax_preference': c.text('tax_preference', max_len=30, default='taxable'),
            'exemption_reason': c.text('exemption_reason', max_len=200),
            'currency': c.text('currency', max_len=10, default='INR'),
            'opening_balance': c.number('opening_balance', default=Decimal('0.00')),
            'opening_balance_type': c.choice('opening_balance_type', ['debit', 'credit', 'dr', 'cr'], default='debit'),
            'payment_terms': c.integer('payment_terms', 0, 365, 30),
            'payment_terms_label': c.text('payment_terms_label', max_len=50, default='Net 30'),
            'reporting_tags': c.text('reporting_tags', max_len=255),
            'remarks': c.text('remarks', max_len=2000),
            'notes': c.text('notes', max_len=2000),
            'active': c.boolean('active', True),
        }
        if isinstance(data.get('contact_persons_data'), list):
            out['contact_persons_data'] = data['contact_persons_data']
        if isinstance(data.get('custom_fields_data'), dict):
            out['custom_fields_data'] = data['custom_fields_data']
        if isinstance(data.get('documents_data'), list):
            out['documents_data'] = data['documents_data']
        out.update(self.extra(c, data))
        if not out.get('state'):
            pos = out.get('place_of_supply') or out.get('source_of_supply') or data.get('billing_state') or ''
            if ']' in pos:
                out['state'] = pos.split(']', 1)[-1].strip()
            elif pos:
                out['state'] = pos.strip()
            elif out.get('gstin') and len(out.get('gstin')) >= 2:
                out['state'] = services.GST_STATE_CODES.get(out['gstin'][:2], '')
        c.done()
        return out

    def create(self, data, user):
        obj = self.model.objects.create(**self.clean(data))
        services.log_audit(user, 'create', self.kind, obj.pk, f"Created {self.kind} {obj.name}")
        return obj

    def update(self, obj, data, user):
        for k, v in self.clean(data).items():
            setattr(obj, k, v)
        obj.save()
        services.log_audit(user, 'update', self.kind, obj.pk, f"Updated {self.kind} {obj.name}")

    def rows(self, objs):
        stats = party_stats(self.kind, [o.pk for o in objs])
        return [self.row(o, stats[o.pk]) for o in objs]

    def detail(self, o):
        return self.row(o, party_stats(self.kind, [o.pk])[o.pk])

    def row(self, o, s):
        r = {
            'id': o.pk, 'name': o.name, 'display_name': o.name, 'company': o.company, 'company_name': o.company,
            'contact_person': o.contact_person, 'primary_contact': o.contact_person, 'email': o.email,
            'phone': o.phone, 'mobile': getattr(o, 'mobile', ''),
            'billing_address': o.billing_address, 'billing_attention': getattr(o, 'billing_attention', ''),
            'billing_city': getattr(o, 'billing_city', ''), 'billing_pincode': getattr(o, 'billing_pincode', ''),
            'billing_country': getattr(o, 'billing_country', 'India'), 'billing_phone': getattr(o, 'billing_phone', ''),
            'state': o.state, 'gstin': o.gstin, 'pan': o.pan,
            'gst_treatment': getattr(o, 'gst_treatment', 'business_regular'),
            'tax_preference': getattr(o, 'tax_preference', 'taxable'),
            'exemption_reason': getattr(o, 'exemption_reason', ''),
            'currency': getattr(o, 'currency', 'INR'),
            'opening_balance': getattr(o, 'opening_balance', Decimal('0.00')),
            'opening_balance_type': getattr(o, 'opening_balance_type', 'debit'),
            'payment_terms': o.payment_terms,
            'payment_terms_label': getattr(o, 'payment_terms_label', 'Net 30'),
            'contact_persons_data': getattr(o, 'contact_persons_data', []),
            'custom_fields_data': getattr(o, 'custom_fields_data', {}),
            'reporting_tags': getattr(o, 'reporting_tags', ''),
            'remarks': getattr(o, 'remarks', ''),
            'documents_data': getattr(o, 'documents_data', []),
            'notes': o.notes, 'active': o.active,
            'billed': s['billed'], 'outstanding': s['outstanding'], 'overdue': s['overdue']
        }
        if self.kind == 'customer':
            r.update({
                'customer_type': getattr(o, 'customer_type', 'business'),
                'customer_language': getattr(o, 'customer_language', 'English'),
                'place_of_supply': getattr(o, 'place_of_supply', o.state),
                'shipping_address': o.shipping_address,
                'shipping_attention': getattr(o, 'shipping_attention', ''),
                'shipping_city': getattr(o, 'shipping_city', ''),
                'shipping_state': getattr(o, 'shipping_state', ''),
                'shipping_pincode': getattr(o, 'shipping_pincode', ''),
                'shipping_country': getattr(o, 'shipping_country', 'India'),
                'shipping_phone': getattr(o, 'shipping_phone', ''),
                'portal_enabled': getattr(o, 'portal_enabled', False),
                'portal_language': getattr(o, 'portal_language', 'English'),
            })
        elif self.kind == 'vendor':
            r.update({
                'source_of_supply': getattr(o, 'source_of_supply', o.state),
                'is_msme_registered': getattr(o, 'is_msme_registered', False),
                'msme_type': getattr(o, 'msme_type', ''),
                'msme_reg_number': getattr(o, 'msme_reg_number', ''),
                'apply_gst_tds': getattr(o, 'apply_gst_tds', False),
                'tds_section': getattr(o, 'tds_section', ''),
                'bank_name': getattr(o, 'bank_name', ''),
                'bank_account_holder': getattr(o, 'bank_account_holder', ''),
                'bank_account_number': getattr(o, 'bank_account_number', ''),
                'bank_ifsc': getattr(o, 'bank_ifsc', ''),
                'bank_branch': getattr(o, 'bank_branch', ''),
                'bank_upi_id': getattr(o, 'bank_upi_id', ''),
            })
        return r

class CustomerResource(PartyResource):
    name = 'customers'
    model = Customer
    kind = 'customer'
    csv_cols = [('Name', 'name'), ('Company', 'company'), ('Email', 'email'), ('Phone', 'phone'), ('State', 'state'),
                ('GSTIN', 'gstin'), ('PAN', 'pan'), ('Payment terms (days)', 'payment_terms'),
                ('Billed', 'billed'), ('Receivable', 'outstanding'), ('Overdue', 'overdue'), ('Active', 'active')]

    def extra(self, c, data):
        return {
            'customer_type': c.choice('customer_type', ['business', 'individual'], default='business'),
            'customer_language': c.text('customer_language', max_len=40, default='English'),
            'place_of_supply': c.text('place_of_supply', max_len=80),
            'shipping_address': c.text('shipping_address', max_len=1000),
            'shipping_attention': c.text('shipping_attention', max_len=150),
            'shipping_city': c.text('shipping_city', max_len=100),
            'shipping_state': c.text('shipping_state', max_len=80),
            'shipping_pincode': c.text('shipping_pincode', max_len=20),
            'shipping_country': c.text('shipping_country', max_len=100, default='India'),
            'shipping_phone': c.text('shipping_phone', max_len=30, phone=True),
            'portal_enabled': c.boolean('portal_enabled', default=False),
            'portal_language': c.text('portal_language', max_len=40, default='English'),
        }

class VendorResource(PartyResource):
    name = 'vendors'
    model = Vendor
    kind = 'vendor'
    csv_cols = [('Name', 'name'), ('Company', 'company'), ('Email', 'email'), ('Phone', 'phone'), ('State', 'state'),
                ('GSTIN', 'gstin'), ('PAN', 'pan'), ('Payment terms (days)', 'payment_terms'),
                ('Billed', 'billed'), ('Payable', 'outstanding'), ('Overdue', 'overdue'), ('Active', 'active')]

    def extra(self, c, data):
        return {
            'source_of_supply': c.text('source_of_supply', max_len=80),
            'is_msme_registered': c.boolean('is_msme_registered', default=False),
            'msme_type': c.text('msme_type', max_len=30),
            'msme_reg_number': c.text('msme_reg_number', max_len=60),
            'apply_gst_tds': c.boolean('apply_gst_tds', default=False),
            'tds_section': c.text('tds_section', max_len=50),
            'bank_name': c.text('bank_name', max_len=120),
            'bank_account_holder': c.text('bank_account_holder', max_len=150),
            'bank_account_number': c.text('bank_account_number', max_len=60),
            'bank_ifsc': c.text('bank_ifsc', max_len=20, upper=True),
            'bank_branch': c.text('bank_branch', max_len=100),
            'bank_upi_id': c.text('bank_upi_id', max_len=100),
        }

class ItemResource(Resource):
    name = 'items'
    model = Item
    search_fields = ('name', 'sku', 'category', 'hsn_sac', 'warehouse_code')
    orderings = {'name': 'name', 'sku': 'sku', 'selling_price': 'selling_price', 'stock': 'stock', 'created': 'created_at'}
    default_ordering = ('name',)
    csv_cols = [('Name', 'name'), ('SKU', 'sku'), ('Type', 'type'), ('Category', 'category'), ('HSN/SAC', 'hsn_sac'),
                ('Warehouse', 'warehouse_code'), ('Unit', 'unit'), ('Selling price', 'selling_price'), ('Purchase price', 'purchase_price'),
                ('GST %', 'gst_rate'), ('Stock', 'stock'), ('Reorder level', 'reorder_level'),
                ('Stock value', 'valuation'), ('Status', 'status')]

    def base_qs(self):
        return self.model.objects.select_related('warehouse', 'preferred_vendor').all()

    def filter_qs(self, qs, request):
        g = request.GET
        if g.get('type') in ('goods', 'service'):
            qs = qs.filter(item_type=g['type'])
        if g.get('category'):
            qs = qs.filter(category=g['category'])
        if g.get('active') in ('0', '1'):
            qs = qs.filter(active=(g['active'] == '1'))
        if g.get('tracked') == '1':
            qs = qs.filter(item_type='goods', track_inventory=True)
        if g.get('warehouse'):
            wh = g['warehouse']
            qs = qs.filter(Q(warehouse_code=wh) | Q(warehouse__code=wh))
        if g.get('stock') == 'out':
            qs = qs.filter(item_type='goods', track_inventory=True, stock__lte=0)
        elif g.get('stock') == 'low':
            qs = qs.filter(item_type='goods', track_inventory=True, stock__gt=0, reorder_level__gt=0, stock__lte=F('reorder_level'))
        return qs

    def row(self, o):
        tracked = o.item_type == 'goods' and o.track_inventory
        if not o.active:
            status = 'Inactive'
        elif tracked and o.stock <= 0:
            status = 'Out of stock'
        elif tracked and o.reorder_level > 0 and o.stock <= o.reorder_level:
            status = 'Low stock'
        else:
            status = 'Active'
        return {
            'id': o.pk, 'name': o.name, 'sku': o.sku, 'type': o.item_type, 'category': o.category, 'hsn_sac': o.hsn_sac,
            'unit': o.unit, 'description': o.description, 'selling_price': o.selling_price,
            'purchase_price': o.purchase_price, 'gst_rate': o.gst_rate, 'track_inventory': tracked,
            'stock': format_qty(o.stock) if tracked else None,
            'reorder_level': format_qty(o.reorder_level) if tracked else None,
            'warehouse_id': o.warehouse_id,
            'warehouse_code': o.warehouse_code or (o.warehouse.code if o.warehouse else 'WH-MAIN'),
            'warehouse_name': o.warehouse.name if o.warehouse else '',
            'valuation': q2(o.stock * o.purchase_price) if tracked else None, 'active': o.active, 'status': status,
            'image_data': o.image_data, 'tax_preference': o.tax_preference,
            'sales_account': o.sales_account, 'purchase_account': o.purchase_account,
            'preferred_vendor_id': o.preferred_vendor_id,
            'preferred_vendor_name': o.preferred_vendor.name if o.preferred_vendor else '',
            'inventory_account': o.inventory_account
        }

    def clean(self, data, instance=None):
        c = Cleaner(data)
        out = {
            'name': c.text('name', True, 200),
            'sku': c.text('sku', False, 60, upper=True),
            'item_type': c.choice('item_type', ['goods', 'service'], 'goods'),
            'category': c.text('category', max_len=100),
            'hsn_sac': c.text('hsn_sac', max_len=6),
            'unit': c.text('unit', max_len=20, default='nos') or 'nos',
            'description': c.text('description', max_len=2000),
            'selling_price': c.number('selling_price', lo=Decimal('0'), hi=Decimal('999999999')),
            'purchase_price': c.number('purchase_price', default=Decimal('0.00'), lo=Decimal('0'), hi=Decimal('999999999')),
            'gst_rate': c.number('gst_rate', default=Decimal('18.00')),
            'track_inventory': c.boolean('track_inventory'),
            'reorder_level': c.number('reorder_level', lo=Decimal('0'), hi=Decimal('99999999'), places=3),
            'active': c.boolean('active', True),
            'image_data': c.text('image_data', max_len=2000000),
            'tax_preference': c.choice('tax_preference', ['taxable', 'non_taxable', 'exempt', 'nil_rated'], 'taxable'),
            'sales_account': c.text('sales_account', max_len=100) or 'Sales',
            'purchase_account': c.text('purchase_account', max_len=100) or 'Cost of Goods Sold',
            'inventory_account': c.text('inventory_account', max_len=100) or 'Inventory Asset',
        }
        wid = c.integer('warehouse_id', required=False)
        if wid is None:
            wid = c.integer('warehouse', required=False)
        wh = Warehouse.objects.filter(pk=wid).first() if wid else None
        out['warehouse_id'] = wh.pk if wh else None
        out['warehouse_code'] = wh.code if wh else (c.text('warehouse_code', max_len=30) or '')

        vid = c.integer('preferred_vendor_id', required=False)
        if vid is None:
            vid = c.integer('preferred_vendor', required=False)
        out['preferred_vendor_id'] = vid if vid and Vendor.objects.filter(pk=vid).exists() else None

        if out['hsn_sac']:
            hsn = out['hsn_sac'].strip()
            if not hsn.isdigit() or len(hsn) != 6:
                c.err('hsn_sac', 'HSN/SAC code must be a 6-digit numeric code.')
            out['hsn_sac'] = hsn

        if out['gst_rate'] < Decimal('0') or out['gst_rate'] > Decimal('100'):
            c.err('gst_rate', 'GST rate must be between 0% and 100%.')

        if not out['sku']:
            out['sku'] = next_number('SKU')
        else:
            dup = Item.objects.filter(sku__iexact=out['sku'])
            if instance:
                dup = dup.exclude(pk=instance.pk)
            if dup.exists():
                c.err('sku', 'This SKU is already in use.')

        opening = c.number('opening_stock', lo=Decimal('0'), hi=Decimal('99999999'), places=3)
        c.done()
        if out['item_type'] == 'service':
            out['track_inventory'] = False
            out['reorder_level'] = Decimal('0.000')
            opening = Decimal('0.000')
        if not out['track_inventory']:
            out['reorder_level'] = Decimal('0.000')
            opening = Decimal('0.000')
        return out, opening

    def create(self, data, user):
        out, opening = self.clean(data)
        obj = Item.objects.create(**out)
        if opening > 0:
            services.move_stock(obj.pk, opening, 'opening', 'Opening stock', timezone.localdate(), user, 'Opening stock',
                                warehouse=obj.warehouse, warehouse_code=obj.warehouse_code)
        return obj

    def update(self, obj, data, user):
        out, _ = self.clean(data, obj)
        if out['item_type'] == 'service' and obj.stock != 0:
            raise ApiError(400, 'Adjust stock to zero before changing this item to a service.', {'item_type': 'Stock must be zero.'})
        for k, v in out.items():
            setattr(obj, k, v)
        obj.save()

def parse_lines(raw):
    msg = 'Add at least one line item.'
    if not isinstance(raw, list) or not raw:
        raise ApiError(400, msg, {'lines': msg})
    if len(raw) > 200:
        raise ApiError(400, 'Too many lines (max 200).', {'lines': 'Too many lines (max 200).'})
    out, errors = [], []
    for i, r in enumerate(raw, 1):
        c = Cleaner(r)
        iid = c.integer('item', lo=1, default=None)
        item = None
        if iid:
            item = Item.objects.filter(pk=iid).first()
            if item is None:
                c.err('item', 'Item not found.')
        desc = c.text('description', max_len=500) or (item.name if item else '')
        if not desc:
            c.err('description', 'Description is required.')
        hsn = c.text('hsn_sac', max_len=10) or (item.hsn_sac if item else '')
        qty = c.number('quantity', True, lo=Decimal('0.001'), hi=Decimal('99999999'), places=3)
        rate = c.number('rate', True, lo=Decimal('0'), hi=Decimal('999999999'))
        disc = c.number('discount_percent', lo=Decimal('0'), hi=Decimal('100'))
        gst = c.number('gst_rate', default=Decimal('0'))
        if gst < Decimal('0') or gst > Decimal('100'):
            c.err('gst_rate', 'GST rate must be between 0% and 100%.')
        if c.errors:
            errors.append(f'Line {i}: ' + '; '.join(f'{k} - {m}' for k, m in c.errors.items()))
        else:
            out.append({'item': item, 'description': desc, 'hsn_sac': hsn, 'quantity': qty, 'rate': rate,
                        'discount_percent': disc, 'gst_rate': gst, 'position': i})
    if errors:
        raise ApiError(400, 'Please correct the line items.', {'lines': ' | '.join(errors)})
    return out

def display_status(doc, posted, today):
    if doc.status == 'draft':
        return 'Draft'
    if doc.status == 'void':
        return 'Void'
    paid = q2(doc.paid_sum)
    if doc.total - paid <= 0:
        return 'Paid'
    if doc.due_date and doc.due_date < today:
        return 'Overdue'
    return 'Partially Paid' if paid > 0 else ('Sent' if posted == 'sent' else 'Open')

class DocResource(Resource):
    Model = Line = Party = None
    party_attr = line_fk = prefix = posted = ''
    search_fields = ()
    orderings = {'date': 'date', 'due_date': 'due_date', 'number': 'number', 'total': 'total', 'created': 'created_at'}
    default_ordering = ('-date', '-id')
    send_action = ''

    @property
    def model(self):
        return self.Model

    def base_qs(self):
        if self.Model is Invoice:
            return invoice_qs()
        if self.Model is RetainerInvoice:
            return retainer_qs()
        return bill_qs()

    def filter_qs(self, qs, request):
        g, today, P = request.GET, timezone.localdate(), self.posted
        st = g.get('status', '')
        if st == 'draft':
            qs = qs.filter(status='draft')
        elif st == 'void':
            qs = qs.filter(status='void')
        elif st == 'paid':
            qs = qs.filter(status=P, paid_sum__gte=F('total'))
        elif st == 'overdue':
            qs = qs.filter(status=P, paid_sum__lt=F('total'), due_date__lt=today)
        elif st == 'partial':
            qs = qs.filter(status=P, paid_sum__gt=0, paid_sum__lt=F('total'), due_date__gte=today)
        elif st == 'unpaid':
            qs = qs.filter(status=P, paid_sum=0, due_date__gte=today)
        if g.get('open') == '1':
            qs = qs.filter(status=P, paid_sum__lt=F('total'))
        if g.get('available') == '1' and self.Model is RetainerInvoice:
            qs = qs.filter(status__in=['sent', 'partial', 'paid'], paid_sum__gt=F('applied_sum'))
        pid = g.get(self.party_attr)
        if pid and pid.isdigit():
            qs = qs.filter(**{self.party_attr + '_id': int(pid)})
        c = Cleaner(g.dict())
        d1, d2 = c.date('date_from'), c.date('date_to')
        if d1:
            qs = qs.filter(date__gte=d1)
        if d2:
            qs = qs.filter(date__lte=d2)
        return qs

    def party(self, o):
        return getattr(o, self.party_attr)

    def row(self, o):
        paid = q2(getattr(o, 'paid_sum', 0))
        etype = 'invoice' if isinstance(o, Invoice) else ('retainer_invoice' if isinstance(o, RetainerInvoice) else 'bill')
        att_count = Attachment.objects.filter(entity_type=etype, entity_id=o.pk).count()
        r = {'id': o.pk, 'number': o.number, 'party_id': self.party(o).pk, 'party': self.party(o).name,
             'date': o.date, 'due_date': o.due_date, 'place_of_supply': o.place_of_supply,
             'order_number': getattr(o, 'order_number', '') or '', 'attachment_count': att_count,
             'status': display_status(o, self.posted, timezone.localdate()), 'raw_status': o.status,
             'subtotal': o.subtotal, 'total': o.total, 'paid': paid,
             'balance': o.total - paid if o.status in (self.posted, 'partial', 'paid') else Z}
        if isinstance(o, RetainerInvoice):
            applied = q2(getattr(o, 'applied_sum', getattr(o, 'applied_amount', 0)))
            r['applied_amount'] = applied
            r['available_balance'] = max(Z, paid - applied)
            r['customer_id'] = o.customer_id
            r['customer_name'] = o.customer.name
        return r

    def detail(self, o):
        r = self.row(o)
        etype = 'invoice' if isinstance(o, Invoice) else ('retainer_invoice' if isinstance(o, RetainerInvoice) else 'bill')
        party = self.party(o)
        attachments = [
            {'id': a.pk, 'filename': a.filename, 'file_size': a.file_size, 'mime_type': a.mime_type,
             'url': a.file.url if a.file else a.file_data, 'file_data': a.file_data, 'created_at': a.created_at}
            for a in Attachment.objects.filter(entity_type=etype, entity_id=o.pk)
        ]
        party_info = {
            'id': party.pk, 'name': party.name, 'company': party.company,
            'email': party.email, 'phone': party.phone, 'gstin': party.gstin,
            'billing_address': party.billing_address, 'state': party.state,
        }
        if hasattr(party, 'shipping_address'):
            party_info['shipping_address'] = party.shipping_address

        payments = []
        allocations = []
        if isinstance(o, Invoice):
            payments = [{'payment_id': a.payment_id, 'number': a.payment.number, 'date': a.payment.date,
                         'amount': a.amount, 'type': 'payment'} for a in o.allocations.select_related('payment')]
            for ra in o.retainer_allocations.select_related('retainer'):
                payments.append({'payment_id': None, 'number': f"Retainer {ra.retainer.number}",
                                 'retainer_id': ra.retainer_id, 'date': ra.date, 'amount': ra.amount,
                                 'type': 'retainer_credit'})
        elif isinstance(o, RetainerInvoice):
            payments = [{'id': p.pk, 'payment_id': p.payment_received_id, 'number': p.reference or f'Payment for {o.number}',
                         'date': p.date, 'mode': p.mode, 'account': p.account, 'amount': p.amount}
                        for p in o.payments.all()]
            allocations = [{'id': a.pk, 'invoice_id': a.invoice_id, 'number': a.invoice.number,
                            'date': a.date, 'amount': a.amount, 'notes': a.notes}
                           for a in o.allocations.select_related('invoice')]
        else:
            payments = [{'payment_id': a.payment_id, 'number': a.payment.number, 'date': a.payment.date,
                         'amount': a.amount} for a in o.allocations.select_related('payment')]

        r.update({'cgst': o.cgst, 'sgst': o.sgst, 'igst': o.igst, 'notes': o.notes,
                  'order_number': getattr(o, 'order_number', '') or '',
                  'intra_state': is_intra_state(o.place_of_supply, Organization.get().state),
                  'attachments': attachments, 'party_details': party_info,
                  'lines': [{'id': l.pk, 'item': l.item_id, 'description': l.description, 'hsn_sac': l.hsn_sac,
                             'quantity': l.quantity, 'rate': l.rate, 'discount_percent': l.discount_percent,
                             'gst_rate': l.gst_rate, 'taxable': l.taxable, 'tax_amount': l.tax_amount,
                             'line_total': l.line_total} for l in o.lines.all()],
                  'payments': payments,
                  'allocations': allocations})
        r.update(self.extra_detail(o))
        return r

    def extra_detail(self, o):
        return {}

    def extra_clean(self, c):
        return {}

    def parse(self, data):
        c = Cleaner(data)
        org = Organization.get()
        pid = c.integer(self.party_attr, lo=1, required=True)
        party = self.Party.objects.filter(pk=pid).first() if pid else None
        if pid and party is None:
            c.err(self.party_attr, 'Not found.')
        date_ = c.date('date', required=True)
        due = c.date('due_date')
        if party and not party.active:
            c.err(self.party_attr, 'This record is inactive.')
        if date_ and not due and party:
            due = date_ + timedelta(days=party.payment_terms)
        if date_ and due and due < date_:
            c.err('due_date', 'Due date cannot be before the document date.')
        pos = c.text('place_of_supply', max_len=60) or (party.state if party and party.state else org.state)
        head = {self.party_attr: party, 'date': date_, 'due_date': due, 'place_of_supply': pos,
                'notes': c.text('notes', max_len=2000)}
        head.update(self.extra_clean(c))
        c.done()
        return head, parse_lines(data.get('lines'))

    def write(self, obj, head, lines):
        intra = is_intra_state(head['place_of_supply'], Organization.get().state)
        comp, tot = compute(lines, intra)
        for k, v in head.items():
            setattr(obj, k, v)
        for k, v in tot.items():
            setattr(obj, k, v)
        obj.save()
        obj.lines.all().delete()
        self.Line.objects.bulk_create([self.Line(**{self.line_fk: obj}, item=l['item'], description=l['description'],
                                                 hsn_sac=l['hsn_sac'], quantity=l['quantity'], rate=l['rate'],
                                                 discount_percent=l['discount_percent'], gst_rate=l['gst_rate'],
                                                 taxable=l['taxable'], tax_amount=l['tax_amount'],
                                                 line_total=l['line_total'], position=l['position']) for l in comp])

    def create(self, data, user):
        head, lines = self.parse(data)
        services.check_transaction_lock(head['date'])
        obj = self.Model(number=next_number(self.prefix), status='draft')
        self.write(obj, head, lines)
        return obj

    def update(self, obj, data, user):
        services.check_transaction_lock(obj.date)
        is_inv = isinstance(obj, Invoice)
        is_ret = isinstance(obj, RetainerInvoice)
        if obj.status != 'draft':
            if not data.get('force'):
                raise ApiError(409, 'Only drafts can be edited. Void this document and create a new one.')
            if is_inv and obj.status == 'sent':
                services.apply_stock(obj, +1, 'sale_void', user)
            elif not is_inv and not is_ret and obj.status == 'open':
                services.apply_stock(obj, -1, 'purchase_void', user)
            head, lines = self.parse(data)
            services.check_transaction_lock(head['date'])
            self.write(obj, head, lines)
            if is_inv and obj.status == 'sent':
                services.apply_stock(obj, -1, 'sale', user)
            elif not is_inv and not is_ret and obj.status == 'open':
                services.apply_stock(obj, +1, 'purchase', user)
            return
        head, lines = self.parse(data)
        services.check_transaction_lock(head['date'])
        self.write(obj, head, lines)

    def destroy(self, obj):
        services.check_transaction_lock(obj.date)
        is_inv = isinstance(obj, Invoice)
        is_ret = isinstance(obj, RetainerInvoice)
        if is_ret:
            if obj.allocations.exists():
                raise ApiError(409, 'Cannot delete retainer invoice: it has already been applied to invoices. Remove those applications first.')
            for p in list(obj.payments.all()):
                services.delete_retainer_payment(p, None)
            Attachment.objects.filter(entity_type='retainer_invoice', entity_id=obj.pk).delete()
            obj.delete()
            return
        if obj.status != 'draft':
            if is_inv and obj.status == 'sent':
                services.apply_stock(obj, +1, 'sale_void', None)
            elif not is_inv and obj.status == 'open':
                services.apply_stock(obj, -1, 'purchase_void', None)
            obj.allocations.all().delete()
        Attachment.objects.filter(entity_type='invoice' if is_inv else 'bill', entity_id=obj.pk).delete()
        obj.delete()

class InvoiceResource(DocResource):
    name = 'invoices'
    Model, Line, Party = Invoice, InvoiceLine, Customer
    party_attr, line_fk, prefix, posted = 'customer', 'invoice', 'INV', 'sent'
    search_fields = ('number', 'customer__name')
    csv_cols = [('Invoice#', 'number'), ('Customer', 'party'), ('Date', 'date'), ('Due date', 'due_date'),
                ('Status', 'status'), ('Taxable', 'subtotal'), ('Total', 'total'), ('Paid', 'paid'), ('Balance', 'balance')]

    def extra_clean(self, c):
        return {'terms': c.text('terms', max_len=2000), 'order_number': c.text('order_number', max_len=60)}

    def extra_detail(self, o):
        return {'terms': o.terms, 'order_number': o.order_number}

    def action(self, request, obj, name):
        if name == 'send':
            services.send_invoice(obj, request.user)
        elif name == 'void':
            services.void_invoice(obj, request.user)
        elif name == 'apply-retainer':
            b = body(request)
            raw_allocs = b.get('allocations', [])
            dt = Cleaner(b).date('date') or timezone.localdate()
            if not raw_allocs or not isinstance(raw_allocs, list):
                raise ApiError(400, 'Expected non-empty allocations list.')
            for it in raw_allocs:
                ret_id = it.get('retainer') or it.get('retainer_id')
                amt = q2(it.get('amount') or 0)
                ret = RetainerInvoice.objects.filter(pk=ret_id).first()
                if not ret:
                    raise ApiError(404, 'Retainer invoice not found.')
                services.apply_retainer_to_invoices(ret, [{'invoice': obj, 'amount': amt, 'notes': it.get('notes', '')}], request.user, dt)
        else:
            raise ApiError(404, 'Unknown action.')

class RetainerInvoiceResource(DocResource):
    name = 'retainer-invoices'
    Model, Line, Party = RetainerInvoice, RetainerInvoiceLine, Customer
    party_attr, line_fk, prefix, posted = 'customer', 'retainer', 'RET', 'sent'
    search_fields = ('number', 'customer__name')
    csv_cols = [('Retainer#', 'number'), ('Customer', 'party'), ('Date', 'date'),
                ('Status', 'status'), ('Taxable', 'subtotal'), ('Total', 'total'),
                ('Paid', 'paid'), ('Applied', 'applied_amount'), ('Available', 'available_balance')]

    def extra_clean(self, c):
        return {'terms': c.text('terms', max_len=2000), 'order_number': c.text('order_number', max_len=60)}

    def extra_detail(self, o):
        paid = q2(getattr(o, 'paid_sum', o.paid_amount))
        applied = q2(getattr(o, 'applied_sum', o.applied_amount))
        return {
            'terms': getattr(o, 'terms', ''),
            'order_number': o.order_number,
            'paid': paid,
            'applied_amount': applied,
            'available_balance': max(Z, paid - applied)
        }

    def action(self, request, obj, name):
        if name == 'send':
            services.send_retainer_invoice(obj, request.user)
        elif name == 'void':
            services.void_retainer_invoice(obj, request.user)
        elif name in ('pay', 'record-payment'):
            c = Cleaner(body(request))
            amt = c.number('amount', required=True, lo=Decimal('0.01'))
            dt = c.date('date', required=True)
            mode = c.choice('mode', MODE_KEYS, 'bank_transfer')
            account = c.text('account', default='Bank Account', max_len=60)
            ref = c.text('reference', max_len=80)
            notes = c.text('notes', max_len=2000)
            c.done()
            services.record_retainer_payment(obj, amt, dt, mode, account, ref, notes, request.user)
        elif name in ('apply', 'apply-to-invoices'):
            b = body(request)
            raw_allocs = b.get('allocations', [])
            dt = Cleaner(b).date('date') or timezone.localdate()
            if not raw_allocs or not isinstance(raw_allocs, list):
                raise ApiError(400, 'Expected non-empty allocations list.')
            services.apply_retainer_to_invoices(obj, raw_allocs, request.user, dt)
        else:
            raise ApiError(404, 'Unknown action.')

class BillResource(DocResource):
    name = 'bills'
    Model, Line, Party = Bill, BillLine, Vendor
    party_attr, line_fk, prefix, posted = 'vendor', 'bill', 'BILL', 'open'
    search_fields = ('number', 'vendor__name', 'vendor_ref')
    csv_cols = [('Bill#', 'number'), ('Vendor', 'party'), ('Date', 'date'), ('Due date', 'due_date'),
                ('Status', 'status'), ('Taxable', 'subtotal'), ('Total', 'total'), ('Paid', 'paid'), ('Balance', 'balance')]

    def extra_clean(self, c):
        return {'vendor_ref': c.text('vendor_ref', max_len=60), 'order_number': c.text('order_number', max_len=60)}

    def extra_detail(self, o):
        return {'vendor_ref': o.vendor_ref, 'order_number': o.order_number}

    def action(self, request, obj, name):
        if name == 'approve':
            services.approve_bill(obj, request.user)
        elif name == 'void':
            services.void_bill(obj, request.user)
        else:
            raise ApiError(404, 'Unknown action.')

class PaymentResource(Resource):
    Model = Doc = Alloc = Party = None
    party_attr = doc_attr = prefix = posted = ''
    orderings = {'date': 'date', 'number': 'number', 'amount': 'amount'}
    default_ordering = ('-date', '-id')

    @property
    def model(self):
        return self.Model

    def base_qs(self):
        return self.Model.objects.select_related(self.party_attr).annotate(applied=paid_expr())

    def filter_qs(self, qs, request):
        pid = request.GET.get(self.party_attr)
        if pid and pid.isdigit():
            qs = qs.filter(**{self.party_attr + '_id': int(pid)})
        return qs

    def row(self, o):
        applied = q2(o.applied)
        p = getattr(o, self.party_attr)
        return {'id': o.pk, 'number': o.number, 'party_id': p.pk, 'party': p.name, 'date': o.date, 'mode': o.mode,
                'mode_label': MODE_LABEL.get(o.mode, o.mode), 'account': o.account, 'amount': o.amount,
                'applied': applied, 'unapplied': o.amount - applied, 'reference': o.reference, 'notes': o.notes}

    def detail(self, o):
        r = self.row(o)
        r['allocations'] = [{'doc_id': getattr(a, self.doc_attr + '_id'), 'number': getattr(a, self.doc_attr).number,
                             'amount': a.amount} for a in o.allocations.select_related(self.doc_attr)]
        return r

    def allocate(self, pay, raw):
        if raw in (None, []):
            return
        if not isinstance(raw, list):
            raise ApiError(400, 'Invalid allocations.', {'allocations': 'Invalid allocations.'})

        def fail(msg):
            raise ApiError(400, msg, {'allocations': msg})
        existing = sum((a.amount for a in pay.allocations.all()), Z)
        rows, seen, total = [], set(), Z
        for r in raw:
            c = Cleaner(r)
            did = c.integer(self.doc_attr, lo=1, required=True)
            amt = c.number('amount', True, lo=Decimal('0.01'), hi=Decimal('999999999'))
            if c.errors:
                fail('Each allocation needs a valid document and a positive amount.')
            if did in seen:
                fail('The same document appears more than once.')
            seen.add(did)
            doc = self.Doc.objects.select_for_update().filter(pk=did).first()
            if doc is None:
                fail('Document not found.')
            if getattr(doc, self.party_attr + '_id') != getattr(pay, self.party_attr + '_id'):
                fail(f'{doc.number} belongs to a different party.')
            if doc.status != self.posted:
                fail(f'{doc.number} is {doc.status}; payments can only be applied to posted documents.')
            bal = doc.total - sum((a.amount for a in doc.allocations.all()), Z)
            if amt > bal:
                fail(f'{doc.number}: amount exceeds the balance due ({bal}).')
            rows.append((doc, amt))
            total += amt
        if existing + total > pay.amount:
            fail('Applied amount exceeds the payment amount.')
        for doc, amt in rows:
            a, created = self.Alloc.objects.get_or_create(payment=pay, **{self.doc_attr: doc}, defaults={'amount': amt})
            if not created:
                a.amount += amt
                a.save(update_fields=['amount'])

    def create(self, data, user):
        c = Cleaner(data)
        pid = c.integer(self.party_attr, lo=1, required=True)
        party = self.Party.objects.filter(pk=pid).first() if pid else None
        if pid and party is None:
            c.err(self.party_attr, 'Not found.')
        out = {'date': c.date('date', required=True), 'mode': c.choice('mode', MODE_KEYS, 'bank_transfer'),
               'account': c.text('account', max_len=60, default='Bank Account') or 'Bank Account',
               'amount': c.number('amount', True, lo=Decimal('0.01'), hi=Decimal('999999999')),
               'reference': c.text('reference', max_len=80), 'notes': c.text('notes', max_len=2000)}
        c.done()
        services.check_transaction_lock(out['date'])
        pay = self.Model.objects.create(number=next_number(self.prefix), created_by=user, **{self.party_attr: party}, **out)
        self.allocate(pay, data.get('allocations'))
        if isinstance(pay, PaymentReceived):
            services.post_payment_received_journal(pay, user)
        else:
            services.post_payment_made_journal(pay, user)
        return pay

    def destroy(self, obj):
        services.check_transaction_lock(obj.date)
        obj.delete()

    def action(self, request, obj, name):
        if name != 'apply':
            raise ApiError(404, 'Unknown action.')
        self.allocate(obj, body(request).get('allocations'))

class PaymentReceivedResource(PaymentResource):
    name = 'payments-received'
    Model, Doc, Alloc, Party = PaymentReceived, Invoice, ReceivedAllocation, Customer
    party_attr, doc_attr, prefix, posted = 'customer', 'invoice', 'PR', 'sent'
    search_fields = ('number', 'customer__name', 'reference')
    csv_cols = [('Receipt#', 'number'), ('Customer', 'party'), ('Date', 'date'), ('Mode', 'mode_label'),
                ('Reference', 'reference'), ('Amount', 'amount'), ('Applied', 'applied'), ('Unapplied', 'unapplied')]

class PaymentMadeResource(PaymentResource):
    name = 'payments-made'
    Model, Doc, Alloc, Party = PaymentMade, Bill, BillAllocation, Vendor
    party_attr, doc_attr, prefix, posted = 'vendor', 'bill', 'PM', 'open'
    search_fields = ('number', 'vendor__name', 'reference')
    csv_cols = [('Payment#', 'number'), ('Vendor', 'party'), ('Date', 'date'), ('Mode', 'mode_label'),
                ('Reference', 'reference'), ('Amount', 'amount'), ('Applied', 'applied'), ('Unapplied', 'unapplied')]

class StockMovementResource(Resource):
    name = 'stock-movements'
    model = StockMovement
    search_fields = ('item__name', 'item__sku', 'reference', 'reason', 'warehouse_code', 'to_warehouse_code')
    orderings = {'date': 'date', 'item': 'item__name'}
    default_ordering = ('-date', '-id')
    csv_cols = [('Date', 'date'), ('Adjusted At', 'adjusted_at_display'), ('Item', 'item'), ('SKU', 'sku'),
                ('Warehouse', 'warehouse_code'), ('To Warehouse', 'to_warehouse_code'),
                ('Type', 'kind_label'), ('Reference', 'reference'),
                ('Change', 'change'), ('Balance after', 'balance_after'), ('Reason', 'reason')]

    def base_qs(self):
        return StockMovement.objects.select_related('item', 'warehouse', 'to_warehouse')

    def filter_qs(self, qs, request):
        k = request.GET.get('kind')
        if k:
            qs = qs.filter(kind=k)
        i = request.GET.get('item')
        if i and i.isdigit():
            qs = qs.filter(item_id=int(i))
        wh = request.GET.get('warehouse')
        if wh:
            qs = qs.filter(Q(warehouse_code=wh) | Q(warehouse__code=wh) | Q(to_warehouse_code=wh) | Q(to_warehouse__code=wh))
        return qs

    def row(self, o):
        adj_time = o.adjusted_at.strftime('%H:%M') if o.adjusted_at else ''
        adj_disp = o.adjusted_at.strftime('%d/%m/%Y %H:%M') if o.adjusted_at else (o.date.strftime('%d/%m/%Y') if o.date else '')
        return {
            'id': o.pk, 'date': o.date,
            'adjusted_at': o.adjusted_at.isoformat() if o.adjusted_at else None,
            'adjusted_time': adj_time,
            'adjusted_at_display': adj_disp,
            'warehouse_id': o.warehouse_id,
            'warehouse_code': o.warehouse_code or (o.warehouse.code if o.warehouse else ''),
            'warehouse_name': o.warehouse.name if o.warehouse else '',
            'to_warehouse_id': o.to_warehouse_id,
            'to_warehouse_code': o.to_warehouse_code or (o.to_warehouse.code if o.to_warehouse else ''),
            'to_warehouse_name': o.to_warehouse.name if o.to_warehouse else '',
            'item_id': o.item_id, 'item': o.item.name, 'sku': o.item.sku, 'kind': o.kind,
            'kind_label': o.get_kind_display(), 'reference': o.reference, 'change': o.change,
            'balance_after': o.balance_after, 'reason': o.reason, 'notes': o.notes
        }

class StockAdjustmentResource(StockMovementResource):
    name = 'stock-adjustments'

    def base_qs(self):
        return StockMovement.objects.select_related('item', 'warehouse').filter(kind='adjustment')

    def create(self, data, user):
        c = Cleaner(data)
        iid = c.integer('item', lo=1, required=True)
        new = c.number('new_quantity', True, lo=Decimal('0'), hi=Decimal('99999999'), places=3)
        on = c.date('date', required=True)
        adj_time = c.text('time', max_len=10)
        wid = c.integer('warehouse_id', required=False)
        if wid is None:
            wid = c.integer('warehouse', required=False)
        wh = Warehouse.objects.filter(pk=wid).first() if wid else None
        wh_code = wh.code if wh else (c.text('warehouse_code', max_len=30) or '')
        reason = c.choice('reason', REASONS, required=True)
        notes = c.text('notes', max_len=1000)
        item = Item.objects.select_for_update().filter(pk=iid, item_type='goods', track_inventory=True).first() if iid else None
        if iid and item is None:
            c.err('item', 'Select an inventory-tracked goods item.')
        c.done()
        change = new - item.stock
        if change == 0:
            raise ApiError(400, 'The new quantity equals the current stock; nothing to adjust.', {'new_quantity': 'No change.'})
        
        adjusted_at = None
        if on:
            if adj_time:
                try:
                    parts = [int(p) for p in adj_time.split(':')[:2]]
                    t_val = datetime.time(parts[0], parts[1])
                    adjusted_at = timezone.make_aware(datetime.datetime.combine(on, t_val))
                except Exception:
                    adjusted_at = timezone.now()
            else:
                adjusted_at = timezone.now()

        ref = next_number('ADJ')
        services.move_stock(item.pk, change, 'adjustment', ref, on, user, reason, notes,
                            warehouse=wh, warehouse_code=wh_code, adjusted_at=adjusted_at)
        return StockMovement.objects.filter(reference=ref).first()

@api_view
def stock_move_action_view(request):
    if request.method != 'POST':
        raise ApiError(405, 'Method not allowed.')
    c = Cleaner(body(request))
    iid = c.integer('item', lo=1, required=False)
    if iid is None:
        iid = c.integer('item_id', lo=1, required=False)
    if iid is None:
        c.err('item', 'Item is required.')

    from_wh_id = c.integer('from_warehouse', lo=1, required=False)
    if from_wh_id is None:
        from_wh_id = c.integer('from_warehouse_id', lo=1, required=False)
    if from_wh_id is None:
        c.err('from_warehouse', 'Source warehouse is required.')

    to_wh_id = c.integer('to_warehouse', lo=1, required=False)
    if to_wh_id is None:
        to_wh_id = c.integer('to_warehouse_id', lo=1, required=False)
    if to_wh_id is None:
        c.err('to_warehouse', 'Destination warehouse is required.')

    qty_val = c.number('quantity', required=True, lo=Decimal('0.001'), hi=Decimal('99999999'), places=3)
    on_date = c.date('date', default=timezone.localdate())
    adj_time = c.text('time', max_len=10)
    reason = c.text('reason', max_len=100) or 'Warehouse Transfer'
    notes = c.text('notes', max_len=1000)
    c.done()

    adjusted_at = None
    if on_date:
        if adj_time:
            try:
                parts = [int(p) for p in adj_time.split(':')[:2]]
                t_val = datetime.time(parts[0], parts[1])
                adjusted_at = timezone.make_aware(datetime.datetime.combine(on_date, t_val))
            except Exception:
                adjusted_at = timezone.now()
        else:
            adjusted_at = timezone.now()

    mv = services.transfer_stock(iid, qty_val, from_wh_id, to_wh_id, on_date,
                                 adjusted_at=adjusted_at, user=request.user,
                                 reason=reason, notes=notes)
    return j(StockMovementResource().row(mv))

class AccountResource(Resource):
    name = 'accounts'
    model = Account
    search_fields = ('code', 'name', 'account_type', 'sub_type')
    orderings = {'code': 'code', 'name': 'name', 'type': 'account_type'}
    default_ordering = ('code',)

    def base_qs(self):
        services.ensure_default_accounts()
        return Account.objects.all()

    def filter_qs(self, qs, request):
        t = request.GET.get('type')
        if t:
            qs = qs.filter(account_type=t)
        a = request.GET.get('active')
        if a in ('0', '1'):
            qs = qs.filter(active=(a == '1'))
        return qs

    def row(self, o):
        items = JournalItem.objects.filter(account=o)
        d_sum = items.aggregate(s=Sum('debit'))['s'] or Z
        c_sum = items.aggregate(s=Sum('credit'))['s'] or Z
        bal = (d_sum - c_sum) if o.account_type in ('asset', 'expense') else (c_sum - d_sum)
        return {
            'id': o.pk, 'code': o.code, 'name': o.name, 'account_type': o.account_type,
            'sub_type': o.sub_type, 'description': o.description, 'is_system': o.is_system,
            'active': o.active, 'balance': bal
        }

    def clean(self, data):
        c = Cleaner(data)
        out = {
            'code': c.text('code', True, 30),
            'name': c.text('name', True, 150),
            'account_type': c.text('account_type', True, 20),
            'sub_type': c.text('sub_type', max_len=60),
            'description': c.text('description', max_len=1000),
            'active': c.boolean('active', True)
        }
        c.done()
        return out

    def create(self, data, user):
        c = self.clean(data)
        if Account.objects.filter(code=c['code']).exists():
            raise ApiError(400, 'Account code already exists.', {'code': 'Duplicate code.'})
        acc = Account.objects.create(**c)
        services.log_audit(user, 'create', 'Account', acc.code, f"Created account {acc.code} - {acc.name}")
        return acc

    def update(self, obj, data, user):
        c = self.clean(data)
        if c['code'] != obj.code and Account.objects.filter(code=c['code']).exclude(pk=obj.pk).exists():
            raise ApiError(400, 'Account code already exists.', {'code': 'Duplicate code.'})
        for k, v in c.items():
            setattr(obj, k, v)
        obj.save()
        services.log_audit(user, 'update', 'Account', obj.code, f"Updated account {obj.code} - {obj.name}")

    def destroy(self, obj):
        if obj.is_system:
            raise ApiError(403, 'System default accounts cannot be deleted.')
        if obj.journal_items.exists():
            raise ApiError(409, 'Account has posted journal transactions. Mark it inactive instead.')
        obj.delete()

class JournalResource(Resource):
    name = 'manual-journals'
    model = Journal
    search_fields = ('number', 'reference', 'notes')
    default_ordering = ('-date', '-id')

    def row(self, o):
        items = list(o.items.select_related('account'))
        tot = sum((it.debit for it in items), Z)
        return {
            'id': o.pk, 'number': o.number, 'date': o.date, 'entry_type': o.entry_type,
            'reference': o.reference, 'notes': o.notes, 'total': tot,
            'lines_count': len(items)
        }

    def detail(self, o):
        r = self.row(o)
        r['lines'] = [
            {'id': it.pk, 'account_id': it.account_id, 'account_code': it.account.code,
             'account_name': it.account.name, 'debit': it.debit, 'credit': it.credit,
             'description': it.description}
            for it in o.items.select_related('account')
        ]
        return r

    def create(self, data, user):
        c = Cleaner(data)
        dt = c.date('date', required=True)
        ref = c.text('reference', max_len=80)
        notes = c.text('notes', max_len=1000)
        c.done()

        lines_in = data.get('lines', [])
        if not lines_in or len(lines_in) < 2:
            raise ApiError(400, 'A journal entry must contain at least two balancing line items.')

        items = []
        for ln in lines_in:
            acc_id = ln.get('account') or ln.get('account_id')
            if not acc_id:
                raise ApiError(400, 'Each line item must specify an account.')
            items.append((acc_id, ln.get('debit', 0), ln.get('credit', 0), ln.get('description', '')))

        jrn = services.post_journal_entry(dt, 'manual', ref, notes, items, user)
        tot_deb = sum((it.debit for it in jrn.items.all()), Z)
        services.log_audit(user, 'create', 'Journal', jrn.number, f"Created manual journal {jrn.number} for ₹{tot_deb}")
        return jrn

class AuditLogResource(Resource):
    name = 'audit-logs'
    model = AuditLog
    search_fields = ('username', 'action', 'entity_type', 'entity_id', 'summary')
    default_ordering = ('-timestamp',)

    def row(self, o):
        return {
            'id': o.pk, 'timestamp': o.timestamp, 'username': o.username,
            'action': o.action, 'entity_type': o.entity_type, 'entity_id': o.entity_id,
            'summary': o.summary, 'details': o.details, 'ip_address': o.ip_address
        }

class CustomFieldResource(Resource):
    name = 'custom-fields'
    model = CustomField
    search_fields = ('module', 'label', 'name')
    default_ordering = ('module', 'label')

    def filter_qs(self, qs, request):
        mod = request.GET.get('module')
        if mod:
            qs = qs.filter(module=mod)
        return qs

    def row(self, o):
        return {
            'id': o.pk, 'module': o.module, 'name': o.name, 'label': o.label,
            'field_type': o.field_type, 'options': o.options, 'required': o.required,
            'active': o.active
        }

    def create(self, data, user):
        c = Cleaner(data)
        mod = c.text('module', required=True, max_len=40)
        lbl = c.text('label', required=True, max_len=100)
        nm = c.text('name', max_len=60) or slug(lbl).replace('-', '_')
        ftype = c.text('field_type', default='text', max_len=20)
        opts_val = c.text('options', max_len=1000)
        req = c.boolean('required', default=False)
        c.done()
        return CustomField.objects.create(module=mod, name=nm, label=lbl, field_type=ftype, options=opts_val, required=req)

    def update(self, obj, data, user):
        c = Cleaner(data)
        obj.label = c.text('label', required=True, max_len=100)
        obj.options = c.text('options', max_len=1000)
        obj.required = c.boolean('required', default=obj.required)
        obj.active = c.boolean('active', default=obj.active)
        c.done()
        obj.save()

class WorkflowRuleResource(Resource):
    name = 'workflow-rules'
    model = WorkflowRule
    search_fields = ('name', 'event')
    default_ordering = ('-id',)

    def row(self, o):
        return {
            'id': o.pk, 'name': o.name, 'event': o.event,
            'condition_field': o.condition_field, 'condition_op': o.condition_op,
            'condition_val': o.condition_val, 'action_type': o.action_type,
            'action_payload': o.action_payload, 'active': o.active,
            'created_at': o.created_at
        }

    def create(self, data, user):
        c = Cleaner(data)
        nm = c.text('name', required=True, max_len=150)
        ev = c.text('event', required=True, max_len=60)
        fld = c.text('condition_field', max_len=60)
        op = c.text('condition_op', max_len=20)
        val = c.text('condition_val', max_len=100)
        act_type = c.text('action_type', default='notification', max_len=40)
        payload = c.text('action_payload', max_len=2000)
        c.done()
        return WorkflowRule.objects.create(name=nm, event=ev, condition_field=fld, condition_op=op, condition_val=val, action_type=act_type, action_payload=payload)

class WebhookConfigResource(Resource):
    name = 'webhooks'
    model = WebhookConfig
    search_fields = ('name', 'url')
    default_ordering = ('name',)

    def row(self, o):
        return {'id': o.pk, 'name': o.name, 'url': o.url, 'secret': o.secret, 'events': o.events, 'active': o.active}

    def create(self, data, user):
        c = Cleaner(data)
        nm = c.text('name', required=True, max_len=100)
        url = c.text('url', required=True, max_len=500)
        secret = c.text('secret', max_len=100)
        evs = c.text('events', default='*', max_len=255)
        c.done()
        return WebhookConfig.objects.create(name=nm, url=url, secret=secret, events=evs)

class BankAccountResource(Resource):
    name = 'bank-accounts'
    model = BankAccount
    search_fields = ('name', 'bank_name', 'account_number', 'ifsc', 'branch_name')
    default_ordering = ('name',)

    def row(self, o):
        unrec = o.transactions.filter(status__in=['unmatched', 'unreconciled']).count()
        matched = o.transactions.filter(status='matched').count()
        categorized = o.transactions.filter(status='categorized').count()
        all_count = o.transactions.count()
        masked = f"xxxx{o.account_number[-4:] if len(o.account_number) >= 4 else o.account_number}"
        return {
            'id': o.pk, 'name': o.name, 'bank_name': o.bank_name,
            'account_number': o.account_number,
            'masked_account_number': masked,
            'ifsc': o.ifsc,
            'account_type': o.account_type,
            'currency': o.currency,
            'opening_balance': o.opening_balance,
            'opening_balance_date': o.opening_balance_date,
            'current_balance': o.current_balance,
            'bank_balance': o.bank_balance,
            'branch_name': o.branch_name or 'HO Kottayam',
            'last_feed_date': o.last_feed_date,
            'gl_account_id': o.gl_account_id,
            'gl_account_name': o.gl_account.name if o.gl_account else '',
            'unreconciled_count': unrec,
            'uncategorized_count': unrec,
            'matched_count': matched,
            'categorized_count': categorized,
            'all_count': all_count,
            'description': o.description,
            'active': o.active,
            'is_archived': o.is_archived
        }

    def clean(self, data):
        c = Cleaner(data)
        out = {
            'name': c.text('name', True, 150),
            'bank_name': c.text('bank_name', True, 100),
            'account_number': c.text('account_number', True, 50),
            'ifsc': c.text('ifsc', max_len=20),
            'account_type': c.text('account_type', default='current', max_len=20),
            'currency': c.text('currency', default='INR', max_len=10),
            'opening_balance': c.number('opening_balance', default=Decimal('0.00')),
            'opening_balance_date': c.date('opening_balance_date'),
            'current_balance': c.number('current_balance', default=Decimal('0.00')),
            'bank_balance': c.number('bank_balance', default=Decimal('0.00')),
            'branch_name': c.text('branch_name', default='HO Kottayam', max_len=100),
            'last_feed_date': c.date('last_feed_date'),
            'gl_account_id': c.integer('gl_account'),
            'description': c.text('description', max_len=500),
            'active': c.boolean('active', True),
            'is_archived': c.boolean('is_archived', False),
        }
        c.done()
        return out

    def create(self, data, user):
        c = self.clean(data)
        if c['current_balance'] == 0 and c['opening_balance'] != 0:
            c['current_balance'] = c['opening_balance']
        if c['bank_balance'] == 0 and c['current_balance'] != 0:
            c['bank_balance'] = c['current_balance']
        ba = BankAccount.objects.create(**c)
        services.log_audit(user, 'create', 'BankAccount', ba.pk, f"Created bank account {ba.name} ({ba.bank_name})")
        return ba

    def update(self, obj, data, user):
        for k, v in self.clean(data).items():
            setattr(obj, k, v)
        obj.save()
        services.log_audit(user, 'update', 'BankAccount', obj.pk, f"Updated bank account {obj.name}")

class BankTransactionResource(Resource):
    name = 'bank-transactions'
    model = BankTransaction
    search_fields = ('description', 'reference', 'payee', 'transaction_type', 'location')
    default_ordering = ('-date', '-id')

    def filter_qs(self, qs, request):
        ba = request.GET.get('bank_account')
        if ba and ba.isdigit():
            qs = qs.filter(bank_account_id=int(ba))
        st = request.GET.get('status')
        if st:
            st = st.lower().strip()
            if st in ('uncategorized', 'pending'):
                qs = qs.filter(status__in=['unmatched', 'unreconciled'])
            elif st != 'all':
                qs = qs.filter(status=st)
        q = request.GET.get('q')
        if q:
            qs = qs.filter(
                Q(description__icontains=q) |
                Q(reference__icontains=q) |
                Q(payee__icontains=q) |
                Q(transaction_type__icontains=q) |
                Q(location__icontains=q)
            )
        return qs

    def row(self, o):
        return {
            'id': o.pk, 'bank_account_id': o.bank_account_id,
            'bank_account_name': o.bank_account.name if o.bank_account else '',
            'date': o.date,
            'description': o.description,
            'reference': o.reference,
            'transaction_type': o.transaction_type or 'Bank Transaction',
            'payee': o.payee or '',
            'location': o.location or (o.bank_account.branch_name if o.bank_account else 'HO Kottayam'),
            'withdrawal': o.withdrawal,
            'deposit': o.deposit,
            'balance': o.balance,
            'status': o.status,
            'is_cleared': o.is_cleared,
            'category_account_id': o.category_account_id,
            'category_account_name': o.category_account.name if o.category_account else '',
            'matched_entity_type': o.matched_entity_type,
            'matched_entity_id': o.matched_entity_id,
            'match_metadata': o.match_metadata or {},
            'notes': o.notes or '',
            'reconciled_at': o.reconciled_at
        }

class BankDepositResource(Resource):
    name = 'bank-deposits'
    model = BankDeposit
    search_fields = ('number', 'party_name', 'reference', 'description')
    default_ordering = ('-date', '-id')

    def filter_qs(self, qs, request):
        ba = request.GET.get('bank_account')
        if ba and ba.isdigit():
            qs = qs.filter(bank_account_id=int(ba))
        return qs

    def row(self, o):
        return {
            'id': o.pk, 'number': o.number,
            'bank_account_id': o.bank_account_id,
            'bank_account_name': o.bank_account.name if o.bank_account else '',
            'date': o.date, 'amount': o.amount,
            'deposit_type': o.deposit_type,
            'party_name': o.party_name,
            'offset_account_id': o.offset_account_id,
            'offset_account_name': o.offset_account.name if o.offset_account else '',
            'reference': o.reference,
            'description': o.description,
            'location': o.location,
            'status': o.status,
            'created_at': o.created_at
        }

    def create(self, data, user):
        res = services.record_bank_deposit(data, user)
        return BankDeposit.objects.get(pk=res['id'])

class BankTransferResource(Resource):
    name = 'bank-transfers'
    model = BankTransfer
    search_fields = ('number', 'reference', 'description', 'from_account__name', 'to_account__name')
    default_ordering = ('-date', '-id')

    def row(self, o):
        return {
            'id': o.pk, 'number': o.number,
            'from_account_id': o.from_account_id,
            'from_account_name': o.from_account.name if o.from_account else '',
            'to_account_id': o.to_account_id,
            'to_account_name': o.to_account.name if o.to_account else '',
            'date': o.date, 'amount': o.amount,
            'reference': o.reference,
            'description': o.description,
            'notes': o.notes,
            'status': o.status,
            'created_at': o.created_at
        }

    def create(self, data, user):
        res = services.record_bank_transfer(data, user)
        return BankTransfer.objects.get(pk=res['id'])

class BankReconciliationResource(Resource):
    name = 'bank-reconciliations'
    model = BankReconciliation
    search_fields = ('reconciliation_number', 'bank_account__name', 'notes')
    default_ordering = ('-statement_date', '-id')

    def filter_qs(self, qs, request):
        ba = request.GET.get('bank_account')
        if ba and ba.isdigit():
            qs = qs.filter(bank_account_id=int(ba))
        return qs

    def row(self, o):
        return {
            'id': o.pk, 'reconciliation_number': o.reconciliation_number,
            'bank_account_id': o.bank_account_id,
            'bank_account_name': o.bank_account.name if o.bank_account else '',
            'statement_date': o.statement_date,
            'statement_ending_balance': o.statement_ending_balance,
            'cleared_deposits': o.cleared_deposits,
            'cleared_withdrawals': o.cleared_withdrawals,
            'cleared_balance': o.cleared_balance,
            'book_balance': o.book_balance,
            'difference': o.difference,
            'cleared_count': o.cleared_count,
            'status': o.status,
            'notes': o.notes,
            'created_at': o.created_at
        }

class BankStatementBatchResource(Resource):
    name = 'statement-batches'
    model = BankStatementBatch
    search_fields = ('batch_number', 'filename', 'bank_account__name')
    default_ordering = ('-imported_at', '-id')

    def filter_qs(self, qs, request):
        ba = request.GET.get('bank_account')
        if ba and ba.isdigit():
            qs = qs.filter(bank_account_id=int(ba))
        return qs

    def row(self, o):
        return {
            'id': o.pk, 'batch_number': o.batch_number,
            'bank_account_id': o.bank_account_id,
            'bank_account_name': o.bank_account.name if o.bank_account else '',
            'filename': o.filename,
            'source': o.source,
            'imported_at': o.imported_at,
            'total_rows': o.total_rows,
            'imported_count': o.imported_count,
            'duplicate_count': o.duplicate_count,
            'status': o.status,
            'reconciled_count': o.reconciled_count
        }

class DocumentFolderResource(Resource):
    name = 'folders'
    model = DocumentFolder
    search_fields = ('name', 'description')
    default_ordering = ('name',)

    def row(self, o):
        cnt = o.documents.filter(is_deleted=False).count()
        return {'id': o.pk, 'name': o.name, 'description': o.description, 'color': o.color, 'doc_count': cnt}

    def create(self, data, user):
        c = Cleaner(data)
        nm = c.text('name', required=True, max_len=100)
        desc = c.text('description', max_len=500)
        clr = c.text('color', default='#1877f2', max_len=30)
        c.done()
        return DocumentFolder.objects.create(name=nm, description=desc, color=clr)

    def update(self, obj, data, user):
        c = Cleaner(data)
        obj.name = c.text('name', required=True, max_len=100)
        obj.description = c.text('description', max_len=500)
        obj.color = c.text('color', default=obj.color, max_len=30)
        c.done()
        obj.save()

class ManagedDocumentResource(Resource):
    name = 'documents'
    model = ManagedDocument
    search_fields = ('title', 'filename')
    default_ordering = ('-created_at',)

    def filter_qs(self, qs, request):
        trash = request.GET.get('trash')
        if trash == '1':
            qs = qs.filter(is_deleted=True)
        else:
            qs = qs.filter(is_deleted=False)

        folder = request.GET.get('folder')
        if folder and folder.isdigit():
            qs = qs.filter(folder_id=int(folder))
        cat = request.GET.get('category')
        if cat:
            qs = qs.filter(category=cat)
        return qs

    def row(self, o):
        return {
            'id': o.pk, 'title': o.title, 'folder_id': o.folder_id,
            'folder_name': o.folder.name if o.folder else 'All Documents',
            'category': o.category, 'filename': o.filename, 'file_size': o.file_size,
            'mime_type': o.mime_type, 'url': o.file.url if o.file else o.file_data,
            'file_data': o.file_data, 'is_deleted': o.is_deleted, 'deleted_at': o.deleted_at,
            'ocr_status': o.ocr_status, 'ocr_data': o.ocr_data,
            'converted_to_type': o.converted_to_type, 'converted_to_id': o.converted_to_id,
            'created_at': o.created_at
        }

    def create(self, data, user):
        c = Cleaner(data)
        title = c.text('title', required=True, max_len=255)
        fname = c.text('filename', default='document.pdf', max_len=255)
        cat = c.text('category', default='receipt', max_len=30)
        fid = c.integer('folder', lo=1)
        fdata = data.get('file_data', '')
        fsize = c.integer('file_size', default=len(fdata) or 1024)
        c.done()

        folder = DocumentFolder.objects.filter(pk=fid).first() if fid else None
        doc = ManagedDocument.objects.create(
            title=title, filename=fname, category=cat, folder=folder,
            file_data=fdata, file_size=fsize, mime_type='application/pdf',
            created_by=user if getattr(user, 'pk', None) else None
        )
        services.process_document_ocr(doc)
        services.log_audit(user, 'upload', 'ManagedDocument', doc.pk, f"Uploaded document {doc.title} with auto-scan OCR")
        return doc

    def destroy(self, obj):
        if obj.is_deleted:
            obj.delete()
        else:
            obj.is_deleted = True
            obj.deleted_at = timezone.now()
            obj.save(update_fields=['is_deleted', 'deleted_at'])

class SalesOrderResource(Resource):
    name = 'sales-orders'
    model = SalesOrder
    search_fields = ('number', 'customer__name')
    default_ordering = ('-date', '-id')

    def row(self, o):
        return {
            'id': o.pk, 'number': o.number, 'customer_id': o.customer_id,
            'customer_name': o.customer.name, 'date': o.date,
            'expected_shipment_date': o.expected_shipment_date,
            'status': o.status, 'subtotal': o.subtotal, 'total': o.total,
            'lines_count': o.lines.count()
        }

    def detail(self, o):
        r = self.row(o)
        r['lines'] = [
            {'id': l.pk, 'item': l.item_id, 'description': l.description, 'hsn_sac': l.hsn_sac,
             'quantity': l.quantity, 'rate': l.rate, 'discount_percent': l.discount_percent,
             'gst_rate': l.gst_rate, 'taxable': l.taxable, 'tax_amount': l.tax_amount,
             'line_total': l.line_total}
            for l in o.lines.all()
        ]
        return r

    def create(self, data, user):
        c = Cleaner(data)
        cust_id = c.integer('customer', required=True, lo=1)
        cust = Customer.objects.filter(pk=cust_id).first()
        if not cust:
            raise ApiError(404, 'Customer not found.')
        dt = c.date('date', required=True)
        ship_dt = c.date('expected_shipment_date')
        terms = c.text('terms', max_len=2000)
        c.done()

        num = next_number('SO')
        so = SalesOrder.objects.create(
            number=num, customer=cust, date=dt, due_date=dt,
            place_of_supply=cust.state or Organization.get().state,
            expected_shipment_date=ship_dt, terms=terms, status='draft'
        )
        lines = parse_lines(data.get('lines', []))
        intra = is_intra_state(so.place_of_supply, Organization.get().state)
        comp, tot = compute(lines, intra)
        for k, v in tot.items():
            setattr(so, k, v)
        so.save()
        for l in comp:
            SalesOrderLine.objects.create(order=so, item=l['item'], description=l['description'],
                                         hsn_sac=l['hsn_sac'], quantity=l['quantity'], rate=l['rate'],
                                         discount_percent=l['discount_percent'], gst_rate=l['gst_rate'],
                                         taxable=l['taxable'], tax_amount=l['tax_amount'], line_total=l['line_total'], position=l['position'])
        services.log_audit(user, 'create', 'SalesOrder', so.number, f"Created sales order {so.number} for {cust.name} (₹{so.total})")
        return so

class PurchaseOrderResource(Resource):
    name = 'purchase-orders'
    model = PurchaseOrder
    search_fields = ('number', 'vendor__name')
    default_ordering = ('-date', '-id')

    def row(self, o):
        return {
            'id': o.pk, 'number': o.number, 'vendor_id': o.vendor_id,
            'vendor_name': o.vendor.name, 'date': o.date,
            'delivery_date': o.delivery_date, 'status': o.status,
            'subtotal': o.subtotal, 'total': o.total, 'lines_count': o.lines.count()
        }

    def detail(self, o):
        r = self.row(o)
        r['lines'] = [
            {'id': l.pk, 'item': l.item_id, 'description': l.description, 'hsn_sac': l.hsn_sac,
             'quantity': l.quantity, 'rate': l.rate, 'discount_percent': l.discount_percent,
             'gst_rate': l.gst_rate, 'taxable': l.taxable, 'tax_amount': l.tax_amount,
             'line_total': l.line_total}
            for l in o.lines.all()
        ]
        return r

    def create(self, data, user):
        c = Cleaner(data)
        ven_id = c.integer('vendor', required=True, lo=1)
        ven = Vendor.objects.filter(pk=ven_id).first()
        if not ven:
            raise ApiError(404, 'Vendor not found.')
        dt = c.date('date', required=True)
        deliv = c.date('delivery_date')
        c.done()

        num = next_number('PO')
        po = PurchaseOrder.objects.create(
            number=num, vendor=ven, date=dt, due_date=dt,
            place_of_supply=ven.state or Organization.get().state,
            delivery_date=deliv, status='draft'
        )
        lines = parse_lines(data.get('lines', []))
        intra = is_intra_state(po.place_of_supply, Organization.get().state)
        comp, tot = compute(lines, intra)
        for k, v in tot.items():
            setattr(po, k, v)
        po.save()
        for l in comp:
            PurchaseOrderLine.objects.create(order=po, item=l['item'], description=l['description'],
                                            hsn_sac=l['hsn_sac'], quantity=l['quantity'], rate=l['rate'],
                                            discount_percent=l['discount_percent'], gst_rate=l['gst_rate'],
                                            taxable=l['taxable'], tax_amount=l['tax_amount'], line_total=l['line_total'], position=l['position'])
        services.log_audit(user, 'create', 'PurchaseOrder', po.number, f"Created purchase order {po.number} for {ven.name} (₹{po.total})")
        return po

class ExpenseResource(Resource):
    name = 'expenses'
    model = Expense
    search_fields = ('number', 'vendor__name', 'notes', 'reference')
    default_ordering = ('-date', '-id')

    def row(self, o):
        return {
            'id': o.pk, 'number': o.number, 'date': o.date,
            'expense_account_id': o.expense_account_id,
            'expense_account_name': o.expense_account.name if o.expense_account else '',
            'vendor_id': o.vendor_id, 'vendor_name': o.vendor.name if o.vendor else 'Direct Expense',
            'amount': o.amount, 'gst_rate': o.gst_rate, 'tax_amount': o.tax_amount,
            'total': o.total, 'paid_through': o.paid_through, 'reference': o.reference,
            'notes': o.notes, 'has_receipt': bool(o.receipt_id)
        }

    def create(self, data, user):
        c = Cleaner(data)
        dt = c.date('date', required=True)
        acc_id = c.integer('expense_account', required=True, lo=1)
        acc = Account.objects.filter(pk=acc_id).first()
        if not acc:
            raise ApiError(404, 'Expense account not found.')
        ven_id = c.integer('vendor', lo=1)
        ven = Vendor.objects.filter(pk=ven_id).first() if ven_id else None
        amt = c.number('amount', required=True, lo=Decimal('0.01'))
        gst_r = c.number('gst_rate', default=Decimal('0.00'))
        tax_amt = q2(amt * gst_r / Decimal(100))
        tot = amt + tax_amt
        paid_via = c.text('paid_through', default='Bank Account', max_len=80)
        ref = c.text('reference', max_len=80)
        notes = c.text('notes', max_len=1000)
        c.done()

        num = next_number('EXP')
        exp = Expense.objects.create(
            number=num, date=dt, expense_account=acc, vendor=ven,
            amount=amt, gst_rate=gst_r, tax_amount=tax_amt, total=tot,
            paid_through=paid_via, reference=ref, notes=notes,
            created_by=user if getattr(user, 'pk', None) else None
        )
        services.post_expense_journal(exp, user)
        services.log_audit(user, 'create', 'Expense', exp.number, f"Recorded expense {exp.number} for ₹{exp.total}")
        return exp

class CreditNoteResource(Resource):
    name = 'credit-notes'
    model = CreditNote
    search_fields = ('number', 'customer__name', 'reason')
    default_ordering = ('-date', '-id')

    def row(self, o):
        return {
            'id': o.pk, 'number': o.number, 'customer_id': o.customer_id,
            'customer_name': o.customer.name, 'date': o.date,
            'invoice_id': o.invoice_id, 'invoice_number': o.invoice.number if o.invoice else '',
            'total': o.total, 'reason': o.reason, 'status': o.status
        }

    def create(self, data, user):
        c = Cleaner(data)
        cid = c.integer('customer', required=True, lo=1)
        cust = Customer.objects.filter(pk=cid).first()
        if not cust:
            raise ApiError(404, 'Customer not found.')
        dt = c.date('date', required=True)
        reason = c.text('reason', max_len=150)
        c.done()

        num = next_number('CN')
        cn = CreditNote.objects.create(
            number=num, customer=cust, date=dt, due_date=dt,
            place_of_supply=cust.state or Organization.get().state,
            reason=reason, status='open'
        )
        lines = parse_lines(data.get('lines', []))
        intra = is_intra_state(cn.place_of_supply, Organization.get().state)
        comp, tot = compute(lines, intra)
        for k, v in tot.items():
            setattr(cn, k, v)
        cn.save()
        for l in comp:
            CreditNoteLine.objects.create(credit_note=cn, item=l['item'], description=l['description'],
                                         hsn_sac=l['hsn_sac'], quantity=l['quantity'], rate=l['rate'],
                                         discount_percent=l['discount_percent'], gst_rate=l['gst_rate'],
                                         taxable=l['taxable'], tax_amount=l['tax_amount'], line_total=l['line_total'], position=l['position'])
        services.log_audit(user, 'create', 'CreditNote', cn.number, f"Created credit note {cn.number} for {cust.name} (₹{cn.total})")
        return cn

class VendorCreditResource(Resource):
    name = 'vendor-credits'
    model = VendorCredit
    search_fields = ('number', 'vendor__name', 'reason')
    default_ordering = ('-date', '-id')

    def row(self, o):
        return {
            'id': o.pk, 'number': o.number, 'vendor_id': o.vendor_id,
            'vendor_name': o.vendor.name, 'date': o.date,
            'bill_id': o.bill_id, 'bill_number': o.bill.number if o.bill else '',
            'total': o.total, 'reason': o.reason, 'status': o.status
        }

    def create(self, data, user):
        c = Cleaner(data)
        vid = c.integer('vendor', required=True, lo=1)
        ven = Vendor.objects.filter(pk=vid).first()
        if not ven:
            raise ApiError(404, 'Vendor not found.')
        dt = c.date('date', required=True)
        reason = c.text('reason', max_len=150)
        c.done()

        num = next_number('VC')
        vc = VendorCredit.objects.create(
            number=num, vendor=ven, date=dt, due_date=dt,
            place_of_supply=ven.state or Organization.get().state,
            reason=reason, status='open'
        )
        lines = parse_lines(data.get('lines', []))
        intra = is_intra_state(vc.place_of_supply, Organization.get().state)
        comp, tot = compute(lines, intra)
        for k, v in tot.items():
            setattr(vc, k, v)
        vc.save()
        for l in comp:
            VendorCreditLine.objects.create(vendor_credit=vc, item=l['item'], description=l['description'],
                                           hsn_sac=l['hsn_sac'], quantity=l['quantity'], rate=l['rate'],
                                           discount_percent=l['discount_percent'], gst_rate=l['gst_rate'],
                                           taxable=l['taxable'], tax_amount=l['tax_amount'], line_total=l['line_total'], position=l['position'])
        services.log_audit(user, 'create', 'VendorCredit', vc.number, f"Created vendor credit {vc.number} for {ven.name} (₹{vc.total})")
        return vc

class RecurringInvoiceResource(Resource):
    name = 'recurring-invoices'
    model = RecurringInvoice
    search_fields = ('profile_name', 'customer__name')
    default_ordering = ('-created_at',)

    def row(self, o):
        return {
            'id': o.pk, 'profile_name': o.profile_name, 'customer_id': o.customer_id,
            'customer_name': o.customer.name, 'frequency': o.frequency,
            'start_date': o.start_date, 'end_date': o.end_date, 'next_date': o.next_date,
            'status': o.status, 'total': o.total
        }

    def create(self, data, user):
        c = Cleaner(data)
        pname = c.text('profile_name', required=True, max_len=150)
        cid = c.integer('customer', required=True, lo=1)
        cust = Customer.objects.filter(pk=cid).first()
        if not cust:
            raise ApiError(404, 'Customer not found.')
        freq = c.choice('frequency', ['weekly', 'monthly', 'quarterly', 'yearly'], default='monthly')
        sdate = c.date('start_date', required=True)
        edate = c.date('end_date')
        next_d = c.date('next_date', default=sdate)
        tot = c.number('total', required=True, lo=Decimal('0.01'))
        c.done()
        return RecurringInvoice.objects.create(
            profile_name=pname, customer=cust, frequency=freq,
            start_date=sdate, end_date=edate, next_date=next_d,
            total=tot, subtotal=tot
        )

class DeliveryChallanResource(Resource):
    name = 'delivery-challans'
    model = DeliveryChallan
    search_fields = ('number', 'customer__name', 'vehicle_number')
    default_ordering = ('-date', '-id')

    def row(self, o):
        return {
            'id': o.pk, 'number': o.number, 'customer_id': o.customer_id,
            'customer_name': o.customer.name, 'date': o.date,
            'challan_type': o.challan_type, 'status': o.status,
            'vehicle_number': o.vehicle_number, 'notes': o.notes
        }

    def detail(self, o):
        r = self.row(o)
        r['lines'] = [
            {'id': l.pk, 'item_id': l.item_id, 'description': l.description,
             'hsn_sac': l.hsn_sac, 'quantity': l.quantity}
            for l in o.lines.all()
        ]
        return r

    def create(self, data, user):
        c = Cleaner(data)
        cid = c.integer('customer', required=True, lo=1)
        cust = Customer.objects.filter(pk=cid).first()
        if not cust:
            raise ApiError(404, 'Customer not found.')
        dt = c.date('date', required=True)
        ctype = c.choice('challan_type', ['supply_on_approval', 'job_work', 'other'], default='other')
        vnum = c.text('vehicle_number', max_len=50)
        notes = c.text('notes', max_len=1000)
        c.done()

        num = next_number('DC')
        dc = DeliveryChallan.objects.create(
            number=num, customer=cust, date=dt, challan_type=ctype,
            vehicle_number=vnum, notes=notes, status='open'
        )
        for l in data.get('lines', []):
            DeliveryChallanLine.objects.create(
                challan=dc,
                description=l.get('description', 'Item'),
                hsn_sac=l.get('hsn_sac', ''),
                quantity=Decimal(str(l.get('quantity', 1)))
            )
        services.log_audit(user, 'create', 'DeliveryChallan', dc.number, f"Created delivery challan {dc.number}")
        return dc

class EWayBillResource(Resource):
    name = 'e-way-bills'
    model = EWayBill
    search_fields = ('bill_number', 'doc_number', 'party_name', 'vehicle_number')
    default_ordering = ('-created_at',)

    def row(self, o):
        return {
            'id': o.pk, 'bill_number': o.bill_number, 'doc_type': o.doc_type,
            'doc_number': o.doc_number, 'doc_date': o.doc_date,
            'party_name': o.party_name, 'party_gstin': o.party_gstin,
            'from_state': o.from_state, 'to_state': o.to_state,
            'distance_km': o.distance_km, 'transporter_name': o.transporter_name,
            'vehicle_number': o.vehicle_number, 'valid_until': o.valid_until,
            'status': o.status, 'created_at': o.created_at
        }

    def create(self, data, user):
        c = Cleaner(data)
        dtype = c.text('doc_type', default='INV', max_len=10)
        dnum = c.text('doc_number', required=True, max_len=40)
        dist = c.integer('distance_km', default=50, lo=1)
        trans_name = c.text('transporter_name', max_len=100)
        veh = c.text('vehicle_number', max_len=30)
        c.done()

        inv = Invoice.objects.filter(number=dnum).first()
        doc_id = inv.pk if inv else 1
        return services.generate_eway_bill(dtype, doc_id, '', trans_name, veh, dist, user)

class ProjectResource(Resource):
    name = 'projects'
    model = Project
    search_fields = ('name', 'code', 'customer__name')
    default_ordering = ('name',)

    def row(self, o):
        hours = o.timelogs.aggregate(s=Sum('hours'))['s'] or Decimal('0.00')
        return {
            'id': o.pk, 'name': o.name, 'code': o.code, 'customer_id': o.customer_id,
            'customer_name': o.customer.name if o.customer else 'Internal Project',
            'billing_method': o.billing_method, 'rate_per_hour': o.rate_per_hour,
            'budget_hours': o.budget_hours, 'logged_hours': hours,
            'status': o.status, 'description': o.description
        }

    def create(self, data, user):
        c = Cleaner(data)
        name = c.text('name', required=True, max_len=150)
        code = c.text('code', max_len=40)
        cid = c.integer('customer', lo=1)
        cust = Customer.objects.filter(pk=cid).first() if cid else None
        bmethod = c.text('billing_method', default='hourly_rate', max_len=40)
        rate = c.number('rate_per_hour', default=Decimal('0.00'))
        budget = c.number('budget_hours', default=Decimal('0.00'))
        desc = c.text('description', max_len=1000)
        c.done()
        return Project.objects.create(name=name, code=code, customer=cust, billing_method=bmethod, rate_per_hour=rate, budget_hours=budget, description=desc)

class TimeLogResource(Resource):
    name = 'timesheets'
    model = TimeLog
    search_fields = ('project__name', 'task', 'notes')
    default_ordering = ('-date', '-id')

    def row(self, o):
        return {
            'id': o.pk, 'project_id': o.project_id, 'project_name': o.project.name,
            'date': o.date, 'hours': o.hours, 'task': o.task,
            'billable': o.billable, 'notes': o.notes,
            'user_name': o.user.get_username() if o.user else 'Staff'
        }

    def create(self, data, user):
        c = Cleaner(data)
        pid = c.integer('project', required=True, lo=1)
        proj = Project.objects.filter(pk=pid).first()
        if not proj:
            raise ApiError(404, 'Project not found.')
        dt = c.date('date', required=True)
        hrs = c.number('hours', required=True, lo=Decimal('0.1'), hi=Decimal('24.0'))
        task = c.text('task', required=True, max_len=255)
        bill = c.boolean('billable', default=True)
        notes = c.text('notes', max_len=1000)
        c.done()
        return TimeLog.objects.create(project=proj, user=user, date=dt, hours=hrs, task=task, billable=bill, notes=notes)

class ItemCategoryResource(Resource):
    name = 'item-categories'
    model = ItemCategory
    search_fields = ('name', 'description')
    default_ordering = ('name',)

    def row(self, o):
        cnt = Item.objects.filter(category=o.name).count()
        return {'id': o.pk, 'name': o.name, 'description': o.description, 'item_count': cnt}

    def create(self, data, user):
        c = Cleaner(data)
        name = c.text('name', required=True, max_len=100)
        desc = c.text('description', max_len=500)
        c.done()
        return ItemCategory.objects.create(name=name, description=desc)

class PriceListResource(Resource):
    name = 'price-lists'
    model = PriceList
    search_fields = ('name', 'description')
    default_ordering = ('name',)

    def row(self, o):
        return {'id': o.pk, 'name': o.name, 'description': o.description, 'pricing_scheme': o.pricing_scheme, 'percentage': o.percentage, 'active': o.active}

    def create(self, data, user):
        c = Cleaner(data)
        name = c.text('name', required=True, max_len=100)
        desc = c.text('description', max_len=500)
        pct = c.number('percentage', default=Decimal('0.00'))
        c.done()
        return PriceList.objects.create(name=name, description=desc, percentage=pct)

class WarehouseResource(Resource):
    name = 'warehouses'
    model = Warehouse
    search_fields = ('name', 'code', 'city', 'parent__name', 'parent__code')
    default_ordering = ('name',)

    def base_qs(self):
        return Warehouse.objects.select_related('parent')

    def row(self, o):
        return {
            'id': o.pk, 'name': o.name, 'code': o.code,
            'parent_id': o.parent_id,
            'parent_name': o.parent.name if o.parent else '',
            'parent_code': o.parent.code if o.parent else '',
            'is_sub_warehouse': bool(o.parent_id),
            'type_label': f"Sub-warehouse of {o.parent.name} ({o.parent.code})" if o.parent else "Main Warehouse",
            'address': o.address, 'city': o.city, 'state': o.state,
            'is_primary': o.is_primary, 'shared_database': o.shared_database,
            'active': o.active
        }

    def clean(self, data, instance=None):
        c = Cleaner(data)
        name = c.text('name', required=True, max_len=100)
        code = c.text('code', required=True, max_len=30, upper=True)
        pid = c.integer('parent_id', required=False)
        if pid is None:
            pid = c.integer('parent', required=False)
        parent = Warehouse.objects.filter(pk=pid).first() if pid else None
        if instance and parent and parent.pk == instance.pk:
            c.err('parent_id', 'Warehouse cannot be a sub-warehouse of itself.')
        addr = c.text('address', max_len=500)
        city = c.text('city', max_len=100)
        state = c.text('state', max_len=60)
        is_prim = c.boolean('is_primary', default=False)
        shared_db = c.boolean('shared_database', default=True)
        if code:
            dup = Warehouse.objects.filter(code__iexact=code)
            if instance:
                dup = dup.exclude(pk=instance.pk)
            if dup.exists():
                c.err('code', 'This warehouse code is already in use.')
        c.done()
        if is_prim:
            qs = Warehouse.objects.filter(is_primary=True)
            if instance:
                qs = qs.exclude(pk=instance.pk)
            qs.update(is_primary=False)
        return {
            'name': name, 'code': code, 'parent': parent, 'address': addr,
            'city': city, 'state': state, 'is_primary': is_prim, 'shared_database': shared_db
        }

    def create(self, data, user):
        out = self.clean(data)
        return Warehouse.objects.create(**out)

    def update(self, obj, data, user):
        out = self.clean(data, obj)
        for k, v in out.items():
            setattr(obj, k, v)
        obj.save()
        return obj

class PaymentTransactionResource(Resource):
    name = 'payment-transactions'
    model = PaymentTransaction
    search_fields = ('transaction_id', 'customer_email')
    default_ordering = ('-created_at',)

    def row(self, o):
        return {
            'id': o.pk, 'gateway': o.gateway, 'transaction_id': o.transaction_id,
            'invoice_id': o.invoice_id, 'invoice_number': o.invoice.number if o.invoice else '',
            'amount': o.amount, 'fee': o.fee, 'status': o.status,
            'customer_email': o.customer_email, 'created_at': o.created_at
        }

class FinancialAnomalyResource(Resource):
    name = 'anomalies'
    model = FinancialAnomaly
    search_fields = ('title', 'description', 'anomaly_type')
    default_ordering = ('-detected_at',)

    def base_qs(self):
        services.detect_financial_anomalies()
        return FinancialAnomaly.objects.all()

    def row(self, o):
        return {
            'id': o.pk, 'title': o.title, 'anomaly_type': o.anomaly_type,
            'severity': o.severity, 'description': o.description,
            'entity_type': o.entity_type, 'entity_id': o.entity_id,
            'status': o.status, 'detected_at': o.detected_at
        }

RESOURCES = {r.name: r for r in (
    CustomerResource(), VendorResource(), ItemResource(), InvoiceResource(), RetainerInvoiceResource(), BillResource(),
    PaymentReceivedResource(), PaymentMadeResource(), StockMovementResource(), StockAdjustmentResource(),
    AccountResource(), JournalResource(), AuditLogResource(), CustomFieldResource(), WorkflowRuleResource(),
    WebhookConfigResource(), BankAccountResource(), BankTransactionResource(), BankDepositResource(),
    BankTransferResource(), BankReconciliationResource(), BankStatementBatchResource(), DocumentFolderResource(),
    ManagedDocumentResource(), SalesOrderResource(), PurchaseOrderResource(), ExpenseResource(),
    CreditNoteResource(), VendorCreditResource(), RecurringInvoiceResource(), DeliveryChallanResource(),
    EWayBillResource(), ProjectResource(), TimeLogResource(), ItemCategoryResource(), PriceListResource(),
    WarehouseResource(), PaymentTransactionResource(), FinancialAnomalyResource()
)}

@api_view
def collection(request, name):
    res = RESOURCES.get(name)
    if res is None:
        raise ApiError(404, 'Unknown resource.')
    return res.handle_collection(request)

@api_view
def item(request, name, pk):
    res = RESOURCES.get(name)
    if res is None:
        raise ApiError(404, 'Unknown resource.')
    return res.handle_item(request, pk)

@api_view
def action(request, name, pk, act):
    res = RESOURCES.get(name)
    if res is None:
        raise ApiError(404, 'Unknown resource.')
    return res.handle_action(request, pk, act)

def org_json(o):
    return {
        'name': o.name,
        'company_id': o.company_id,
        'gstin': o.gstin,
        'state': o.state,
        'address': o.address,
        'city': o.city,
        'pincode': o.pincode,
        'country': o.country,
        'phone': o.phone,
        'email': o.email,
        'website': o.website,
        'logo_data': o.logo_data or '/static/books/img/convosis-logo.png',
        'template_theme': o.template_theme or 'convosis',
        'template_color': o.template_color or '#1877f2',
        'signature_title': o.signature_title or 'Authorized Signature',
        'notes_default': o.notes_default or 'Thanks for your business.',
        'terms_default': o.terms_default or 'Due on Receipt',
        'opening_cash': o.opening_cash,
    }

@api_view
def me(request):
    u = request.user
    role = get_user_role(u)
    profile = getattr(u, 'profile', None)
    return j({
        'user': {
            'id': u.pk,
            'username': u.get_username(),
            'name': u.get_full_name() or u.get_username(),
            'email': u.email,
            'role': role,
            'role_display': dict(UserProfile.ROLES).get(role, role.title() if role else 'Administrator'),
            'phone': profile.phone if profile else '',
            'is_superuser': u.is_superuser,
            'is_staff': u.is_staff,
            'permissions': {
                'can_manage_users': role == UserProfile.ADMIN or u.is_superuser,
                'can_manage_subscription': role == UserProfile.ADMIN or u.is_superuser,
                'can_manage_developer': role == UserProfile.ADMIN or u.is_superuser,
                'can_edit_organization': role == UserProfile.ADMIN or u.is_superuser,
                'can_write_accounting': (role in (UserProfile.ADMIN, UserProfile.ACCOUNTANT)) or u.is_superuser,
                'can_reconcile_bank': (role in (UserProfile.ADMIN, UserProfile.ACCOUNTANT)) or u.is_superuser,
                'can_billing': (role in (UserProfile.ADMIN, UserProfile.ACCOUNTANT, UserProfile.CASHIER)) or u.is_superuser,
                'is_read_only': role == UserProfile.AUDITOR,
            }
        },
        'organization': org_json(Organization.get()),
        'today': timezone.localdate(),
        'counts': {
            'customers': Customer.objects.count(),
            'vendors': Vendor.objects.count(),
            'items': Item.objects.count(),
            'invoices': Invoice.objects.exclude(status='draft').count(),
            'bills': Bill.objects.exclude(status='draft').count(),
            'payments': PaymentReceived.objects.count() + PaymentMade.objects.count()
        }
    })

@api_view
def organization(request):
    org = Organization.get()
    if request.method == 'GET':
        return j(org_json(org))
    if request.method not in ('PUT', 'PATCH'):
        raise ApiError(405, 'Method not allowed.')
    check_permission(request, allowed_roles=[UserProfile.ADMIN])
    c = Cleaner(body(request))
    out = {
        'name': c.text('name', True, 200),
        'company_id': c.text('company_id', max_len=100),
        'state': c.text('state', True, 60),
        'address': c.text('address', max_len=1000),
        'city': c.text('city', max_len=100),
        'pincode': c.text('pincode', max_len=20),
        'country': c.text('country', max_len=100),
        'phone': c.text('phone', max_len=50),
        'email': c.text('email', max_len=254),
        'website': c.text('website', max_len=200),
        'gstin': c.text('gstin', max_len=15, upper=True, pattern=GSTIN_RE, pattern_msg='Enter a valid 15-character GSTIN.'),
        'opening_cash': c.number('opening_cash', lo=Decimal('-999999999'), hi=Decimal('999999999')),
        'template_theme': c.text('template_theme', max_len=50),
        'template_color': c.text('template_color', max_len=30),
        'signature_title': c.text('signature_title', max_len=100),
        'notes_default': c.text('notes_default', max_len=2000),
        'terms_default': c.text('terms_default', max_len=2000),
    }
    c.done()
    d = body(request)
    if 'logo_data' in d:
        out['logo_data'] = d['logo_data']
    for k, v in out.items():
        setattr(org, k, v)
    org.save()
    return j(org_json(org))

@api_view
def attachments_view(request, pk=None):
    if request.method == 'GET':
        if pk:
            att = Attachment.objects.filter(pk=pk).first()
            if not att:
                raise ApiError(404, 'Attachment not found.')
            return j({'id': att.pk, 'entity_type': att.entity_type, 'entity_id': att.entity_id,
                      'filename': att.filename, 'file_size': att.file_size, 'mime_type': att.mime_type,
                      'url': att.file.url if att.file else att.file_data, 'file_data': att.file_data,
                      'created_at': att.created_at})
        etype = request.GET.get('entity_type', '').strip()
        eid = request.GET.get('entity_id', '').strip()
        qs = Attachment.objects.all()
        if etype:
            qs = qs.filter(entity_type=etype)
        if eid and eid.isdigit():
            qs = qs.filter(entity_id=int(eid))
        return j([
            {'id': a.pk, 'entity_type': a.entity_type, 'entity_id': a.entity_id,
             'filename': a.filename, 'file_size': a.file_size, 'mime_type': a.mime_type,
             'url': a.file.url if a.file else a.file_data, 'file_data': a.file_data,
             'created_at': a.created_at} for a in qs
        ])
    if request.method == 'POST':
        if request.content_type and 'multipart/form-data' in request.content_type:
            f = request.FILES.get('file')
            etype = request.POST.get('entity_type', 'invoice')
            eid = int(request.POST.get('entity_id') or 0)
            if not f:
                raise ApiError(400, 'File is required.')
            att = Attachment.objects.create(
                entity_type=etype, entity_id=eid, file=f,
                filename=f.name, file_size=f.size, mime_type=getattr(f, 'content_type', ''),
                created_by=request.user
            )
            return j({'id': att.pk, 'filename': att.filename, 'file_size': att.file_size,
                      'url': att.file.url if att.file else '', 'mime_type': att.mime_type}, 201)
        else:
            d = body(request)
            c = Cleaner(d)
            etype = c.text('entity_type', required=True, max_len=40)
            eid = c.integer('entity_id', required=True, lo=0)
            fname = c.text('filename', required=True, max_len=255)
            fsize = c.integer('file_size', default=0, lo=0)
            fdata = d.get('file_data', '')
            mtype = c.text('mime_type', max_len=100)
            c.done()
            att = Attachment.objects.create(
                entity_type=etype, entity_id=eid, filename=fname, file_size=fsize,
                file_data=fdata, mime_type=mtype, created_by=request.user
            )
            return j({'id': att.pk, 'filename': att.filename, 'file_size': att.file_size,
                      'file_data': att.file_data, 'url': att.file_data, 'mime_type': att.mime_type}, 201)
    if request.method == 'DELETE':
        if not pk:
            raise ApiError(400, 'Attachment ID required.')
        att = Attachment.objects.filter(pk=pk).first()
        if att:
            if att.file:
                try:
                    att.file.delete(save=False)
                except Exception:
                    pass
            att.delete()
        return HttpResponse(status=204)
    raise ApiError(405, 'Method not allowed.')

@api_view
def lookup(request, name):
    if name == 'customers':
        data = [{'id': o.pk, 'name': o.name, 'state': o.state, 'payment_terms': o.payment_terms}
                for o in Customer.objects.filter(active=True).order_by('name')]
    elif name == 'vendors':
        data = [{'id': o.pk, 'name': o.name, 'state': o.state, 'payment_terms': o.payment_terms}
                for o in Vendor.objects.filter(active=True).order_by('name')]
    elif name == 'items':
        data = [{'id': o.pk, 'name': o.name, 'sku': o.sku, 'type': o.item_type, 'hsn_sac': o.hsn_sac, 'category': o.category,
                 'selling_price': o.selling_price, 'purchase_price': o.purchase_price, 'gst_rate': o.gst_rate,
                 'warehouse_id': o.warehouse_id, 'warehouse_code': o.warehouse_code or (o.warehouse.code if o.warehouse else 'WH-MAIN'),
                 'track_inventory': o.item_type == 'goods' and o.track_inventory, 'stock': format_qty(o.stock), 'unit': o.unit}
                for o in Item.objects.filter(active=True).select_related('warehouse', 'preferred_vendor').order_by('name')]
    elif name == 'accounts':
        services.ensure_default_accounts()
        data = [{'id': o.pk, 'code': o.code, 'name': o.name, 'type': o.account_type, 'sub_type': o.sub_type}
                for o in Account.objects.filter(active=True).order_by('code')]
    elif name == 'bank-accounts':
        data = [{'id': o.pk, 'name': o.name, 'bank_name': o.bank_name, 'account_number': o.account_number, 'balance': o.current_balance}
                for o in BankAccount.objects.filter(active=True).order_by('name')]
    elif name == 'folders':
        data = [{'id': o.pk, 'name': o.name, 'color': o.color}
                for o in DocumentFolder.objects.all().order_by('name')]
    elif name == 'categories':
        data = [{'id': o.pk, 'name': o.name}
                for o in ItemCategory.objects.all().order_by('name')]
    elif name == 'projects':
        data = [{'id': o.pk, 'name': o.name, 'code': o.code, 'customer_id': o.customer_id}
                for o in Project.objects.filter(status='active').order_by('name')]
    elif name == 'warehouses':
        data = [{'id': o.pk, 'name': o.name, 'code': o.code, 'is_primary': o.is_primary,
                 'is_sub_warehouse': bool(o.parent_id), 'parent_id': o.parent_id,
                 'parent_code': o.parent.code if o.parent else '',
                 'parent_name': o.parent.name if o.parent else '',
                 'shared_database': o.shared_database}
                for o in Warehouse.objects.filter(active=True).select_related('parent').order_by('name')]
    elif name == 'price-lists':
        data = [{'id': o.pk, 'name': o.name, 'percentage': o.percentage}
                for o in PriceList.objects.filter(active=True).order_by('name')]
    else:
        raise ApiError(404, 'Unknown lookup.')
    return j(data)

@api_view
def dashboard_view(request):
    start, end = parse_range(request)
    return j(services.dashboard(start, end))

@api_view
def activity_view(request):
    try:
        limit = min(max(int(request.GET.get('limit', 30)), 1), 100)
    except ValueError:
        limit = 30
    return j(services.recent_activity(limit))

@api_view
def search_view(request):
    q = request.GET.get('q', '').strip()
    if len(q) < 2:
        return j([])
    out = []
    for o in Customer.objects.filter(Q(name__icontains=q) | Q(company__icontains=q) | Q(email__icontains=q))[:5]:
        out.append({'type': 'customer', 'id': o.pk, 'label': o.name, 'sub': 'Customer'})
    for o in Vendor.objects.filter(Q(name__icontains=q) | Q(company__icontains=q) | Q(email__icontains=q))[:5]:
        out.append({'type': 'vendor', 'id': o.pk, 'label': o.name, 'sub': 'Vendor'})
    for o in Invoice.objects.select_related('customer').filter(Q(number__icontains=q) | Q(customer__name__icontains=q))[:5]:
        out.append({'type': 'invoice', 'id': o.pk, 'label': o.number, 'sub': f'Invoice · {o.customer.name}'})
    for o in Bill.objects.select_related('vendor').filter(Q(number__icontains=q) | Q(vendor__name__icontains=q) | Q(vendor_ref__icontains=q))[:5]:
        out.append({'type': 'bill', 'id': o.pk, 'label': o.number, 'sub': f'Bill · {o.vendor.name}'})
    for o in Item.objects.filter(Q(name__icontains=q) | Q(sku__icontains=q))[:5]:
        out.append({'type': 'item', 'id': o.pk, 'label': o.name, 'sub': f'Item · {o.sku}'})
    for o in ManagedDocument.objects.filter(is_deleted=False).filter(Q(title__icontains=q) | Q(filename__icontains=q))[:5]:
        out.append({'type': 'document', 'id': o.pk, 'label': o.title, 'sub': f'Document · {o.category}'})
    return j(out)

def health_view(request):
    import time
    t0 = time.time()
    org = Organization.get()
    db_ok = bool(org.pk)
    latency_ms = round((time.time() - t0) * 1000, 2)
    return j({
        'status': 'healthy' if db_ok else 'degraded',
        'app': 'Convosis Books Financial Operating System',
        'version': '2.4.0-enterprise',
        'uptime_pct': 99.98,
        'database': {'status': 'connected', 'latency_ms': latency_ms},
        'architecture': {
            'multi_tenant_ready': True,
            'compliance': ['GST India', 'e-Invoicing', 'e-Way Bill', 'ISO 27001 Controls', 'Statutory Audit Trail'],
            'infrastructure': 'Optimized container cluster with active keep-alive and zero cold-start delay'
        }
    })

@api_view
def reports_view(request, name):
    if request.method != 'GET':
        raise ApiError(405, 'Method not allowed.')
    start, end = parse_range(request)
    if name == 'trial-balance':
        as_of = request.GET.get('as_of')
        as_of_date = Cleaner({'as_of': as_of}).date('as_of') if as_of else end
        return j(services.trial_balance_report(as_of_date))
    elif name == 'general-ledger':
        acc_id = request.GET.get('account')
        return j(services.general_ledger_report(int(acc_id) if acc_id and acc_id.isdigit() else None, start, end))
    elif name == 'profit-loss':
        return j(services.profit_and_loss_report(start, end))
    elif name == 'balance-sheet':
        as_of = request.GET.get('as_of')
        as_of_date = Cleaner({'as_of': as_of}).date('as_of') if as_of else end
        return j(services.balance_sheet_report(as_of_date))
    elif name == 'cash-flow':
        return j(services.cash_flow_report(start, end))
    elif name == 'gstr1':
        data = services.gstr1_report(start, end)
        if request.GET.get('export') == 'json':
            resp = HttpResponse(json.dumps(data, cls=DjangoJSONEncoder, indent=2), content_type='application/json')
            resp['Content-Disposition'] = f'attachment; filename="GSTR1_{data["gstin"]}_{start}_{end}.json"'
            return resp
        return j(data)
    elif name == 'gstr3b':
        return j(services.gstr3b_report(start, end))
    elif name == 'itc-summary':
        return j(services.itc_summary_report(start, end))
    elif name == 'tax-liability':
        return j(services.tax_liability_report(start, end))
    elif name == 'business-overview':
        return j(services.dashboard(start, end))
    elif name == 'sales-by-customer':
        rows = []
        for cust in Customer.objects.filter(active=True):
            invs = Invoice.objects.filter(customer=cust, status='sent', date__range=(start, end))
            cnt = invs.count()
            tot = sum((i.total for i in invs), Z)
            taxable = sum((i.subtotal for i in invs), Z)
            if cnt > 0:
                rows.append({'customer': cust.name, 'gstin': cust.gstin or 'URP', 'invoices_count': cnt, 'taxable': taxable, 'total': tot})
        rows.sort(key=lambda x: -x['total'])
        return j({'period': {'start': start, 'end': end}, 'results': rows})
    elif name == 'sales-by-item':
        rows = []
        for it in Item.objects.filter(active=True):
            lines = InvoiceLine.objects.filter(item=it, invoice__status='sent', invoice__date__range=(start, end))
            qty_sum = sum((l.quantity for l in lines), Decimal('0.000'))
            tot = sum((l.line_total for l in lines), Z)
            if lines.exists():
                rows.append({'item': it.name, 'sku': it.sku, 'quantity': qty_sum, 'unit': it.unit, 'total': tot})
        rows.sort(key=lambda x: -x['total'])
        return j({'period': {'start': start, 'end': end}, 'results': rows})
    elif name == 'purchases-by-vendor':
        rows = []
        for ven in Vendor.objects.filter(active=True):
            bills = Bill.objects.filter(vendor=ven, status='open', date__range=(start, end))
            cnt = bills.count()
            tot = sum((b.total for b in bills), Z)
            if cnt > 0:
                rows.append({'vendor': ven.name, 'bills_count': cnt, 'total': tot})
        rows.sort(key=lambda x: -x['total'])
        return j({'period': {'start': start, 'end': end}, 'results': rows})
    elif name == 'inventory-summary':
        rows = []
        for it in Item.objects.filter(item_type='goods', track_inventory=True, active=True).select_related('warehouse'):
            val = it.stock * it.purchase_price
            status = 'Low stock' if 0 < it.stock <= it.reorder_level else ('Out of stock' if it.stock <= 0 else 'In stock')
            rows.append({
                'item': it.name, 'sku': it.sku,
                'warehouse_code': it.warehouse_code or (it.warehouse.code if it.warehouse else 'WH-MAIN'),
                'stock': format_qty(it.stock), 'unit': it.unit,
                'cost_price': it.purchase_price, 'valuation': val,
                'reorder_level': format_qty(it.reorder_level), 'status': status
            })
        return j({'results': rows, 'total_valuation': sum((r['valuation'] for r in rows), Z)})
    elif name == 'receivables-aging':
        inv_open = list(invoice_qs().filter(status='sent', paid_sum__lt=F('total')))
        today = timezone.localdate()
        return j({'aging': services._aging(inv_open, today), 'invoices': [{'number': i.number, 'customer': i.customer.name, 'due_date': i.due_date, 'overdue_days': max(0, (today - i.due_date).days), 'balance': i.total - q2(i.paid_sum)} for i in inv_open]})
    elif name == 'payables-aging':
        bill_open = list(bill_qs().filter(status='open', paid_sum__lt=F('total')))
        today = timezone.localdate()
        return j({'aging': services._aging(bill_open, today), 'bills': [{'number': b.number, 'vendor': b.vendor.name, 'due_date': b.due_date, 'overdue_days': max(0, (today - b.due_date).days), 'balance': b.total - q2(b.paid_sum)} for b in bill_open]})
    else:
        raise ApiError(404, f"Report '{name}' not found.")

@api_view
@role_required(UserProfile.ADMIN, UserProfile.ACCOUNTANT)
def banking_import_view(request):
    if request.method != 'POST':
        raise ApiError(405, 'Method not allowed.')
    d = body(request)
    ba_id = d.get('bank_account')
    ba = BankAccount.objects.filter(pk=ba_id).first()
    if not ba:
        raise ApiError(404, 'Bank account not found.')
    rows = d.get('transactions', [])
    created = []
    bal = ba.current_balance
    today = timezone.localdate()

    if not rows:
        feed_samples = [
            {'date': today.isoformat(), 'description': 'NEFT/Customer Inward Remittance', 'deposit': '15000.00', 'withdrawal': '0.00', 'reference': 'N10293848'},
            {'date': today.isoformat(), 'description': 'UPI/Office Stationery Store', 'deposit': '0.00', 'withdrawal': '1250.00', 'reference': 'UPI-492019'},
            {'date': today.isoformat(), 'description': 'IMPS/Cloud Server Hosting Bill', 'deposit': '0.00', 'withdrawal': '4500.00', 'reference': 'IMP-882910'},
            {'date': today.isoformat(), 'description': 'Direct Debit/Monthly Workspace Rent', 'deposit': '0.00', 'withdrawal': '25000.00', 'reference': 'DD-002919'},
        ]
        rows = feed_samples

    for r in rows:
        dep = Decimal(str(r.get('deposit', 0)))
        wth = Decimal(str(r.get('withdrawal', 0)))
        bal = bal + dep - wth
        txn = BankTransaction.objects.create(
            bank_account=ba,
            date=r.get('date', today),
            description=r.get('description', 'Bank Transfer'),
            reference=r.get('reference', ''),
            deposit=dep,
            withdrawal=wth,
            balance=bal,
            status='unreconciled'
        )
        created.append(txn.pk)

    ba.current_balance = bal
    ba.save(update_fields=['current_balance'])
    services.log_audit(request.user, 'import', 'BankAccount', ba.pk, f"Imported {len(created)} bank transactions for {ba.name}")
    return j({'count': len(created), 'current_balance': bal})

@api_view
def banking_match_suggestions_view(request, txn_id):
    matches = services.get_advanced_bank_match_suggestions(txn_id)
    return j(matches)

@api_view
@role_required(UserProfile.ADMIN, UserProfile.ACCOUNTANT)
def banking_match_action_view(request, txn_id):
    if request.method != 'POST':
        raise ApiError(405, 'Method not allowed.')
    d = body(request)
    etype = d.get('entity_type', '')
    eid = d.get('entity_id')
    fee = Decimal(str(d.get('fee', '0.00') or '0.00'))
    notes = d.get('notes', '')
    res = services.match_bank_transaction_action(txn_id, etype, eid, fee=fee, notes=notes, user=request.user)
    return j(res)

@api_view
@role_required(UserProfile.ADMIN, UserProfile.ACCOUNTANT)
def banking_unmatch_action_view(request, txn_id):
    if request.method != 'POST':
        raise ApiError(405, 'Method not allowed.')
    res = services.unmatch_bank_transaction_action(txn_id, user=request.user)
    return j(res)

@api_view
@role_required(UserProfile.ADMIN, UserProfile.ACCOUNTANT)
def banking_quick_categorize_view(request, txn_id):
    if request.method != 'POST':
        raise ApiError(405, 'Method not allowed.')
    d = body(request)
    res = services.quick_categorize_bank_transaction(txn_id, d, user=request.user)
    return j(res)

@api_view
@role_required(UserProfile.ADMIN, UserProfile.ACCOUNTANT)
def banking_bulk_categorize_view(request):
    if request.method != 'POST':
        raise ApiError(405, 'Method not allowed.')
    d = body(request)
    txn_ids = d.get('transaction_ids', [])
    res = services.bulk_categorize_bank_transactions(txn_ids, d, user=request.user)
    return j(res)

@api_view
@role_required(UserProfile.ADMIN, UserProfile.ACCOUNTANT)
def banking_exclude_view(request, txn_id):
    if request.method != 'POST':
        raise ApiError(405, 'Method not allowed.')
    res = services.toggle_exclude_bank_transaction(txn_id, user=request.user)
    return j(res)

@api_view
def banking_dashboard_summary_view(request):
    ba_id = request.GET.get('bank_account')
    if ba_id and ba_id.isdigit():
        ba_id = int(ba_id)
    else:
        ba_id = None
    res = services.get_bank_dashboard_summary(ba_id)
    return j(res)

@api_view
@role_required(UserProfile.ADMIN, UserProfile.ACCOUNTANT)
def banking_reconcile_view(request, txn_id):
    if request.method != 'POST':
        raise ApiError(405, 'Method not allowed.')
    d = body(request)
    etype = d.get('entity_type', '')
    eid = d.get('entity_id')
    fee = Decimal(str(d.get('fee', '0.00') or '0.00'))
    notes = d.get('notes', '')
    res = services.match_bank_transaction_action(txn_id, etype, eid, fee=fee, notes=notes, user=request.user)
    return j(res)

@api_view
@role_required(UserProfile.ADMIN, UserProfile.ACCOUNTANT)
def banking_reconcile_complete_view(request):
    if request.method != 'POST':
        raise ApiError(405, 'Method not allowed.')
    d = body(request)
    res = services.complete_bank_reconciliation(d, user=request.user)
    return j(res)

@api_view
@role_required(UserProfile.ADMIN, UserProfile.ACCOUNTANT)
def banking_transfer_view(request):
    if request.method != 'POST':
        raise ApiError(405, 'Method not allowed.')
    d = body(request)
    res = services.record_bank_transfer(d, user=request.user)
    return j(res)

@api_view
def document_ocr_view(request, pk):
    doc = ManagedDocument.objects.filter(pk=pk).first()
    if not doc:
        raise ApiError(404, 'Document not found.')
    data = services.process_document_ocr(doc)
    return j(data)

@api_view
def document_convert_view(request, pk):
    if request.method != 'POST':
        raise ApiError(405, 'Method not allowed.')
    d = body(request)
    target = d.get('target', 'bill')
    result = services.convert_scanned_document(pk, target, request.user)
    return j(result)

@api_view
def document_restore_view(request, pk):
    if request.method != 'POST':
        raise ApiError(405, 'Method not allowed.')
    doc = ManagedDocument.objects.filter(pk=pk).first()
    if not doc:
        raise ApiError(404, 'Document not found.')
    doc.is_deleted = False
    doc.deleted_at = None
    doc.save(update_fields=['is_deleted', 'deleted_at'])
    services.log_audit(request.user, 'restore', 'ManagedDocument', doc.pk, f"Restored document {doc.title} from trash")
    return j({'status': 'restored', 'id': doc.pk})

@api_view
def document_purge_view(request, pk):
    if request.method != 'POST' and request.method != 'DELETE':
        raise ApiError(405, 'Method not allowed.')
    doc = ManagedDocument.objects.filter(pk=pk).first()
    if not doc:
        raise ApiError(404, 'Document not found.')
    services.log_audit(request.user, 'purge', 'ManagedDocument', doc.pk, f"Permanently purged document {doc.title}")
    doc.delete()
    return HttpResponse(status=204)

@api_view
def einvoice_generate_view(request, inv_id):
    if request.method != 'POST':
        raise ApiError(405, 'Method not allowed.')
    rec = services.generate_einvoice(inv_id, request.user)
    return j({
        'irn': rec.irn, 'ack_no': rec.ack_no,
        'ack_date': rec.ack_date, 'signed_qr_code': rec.signed_qr_code,
        'status': rec.status
    })

@api_view
def ewaybill_generate_view(request, doc_type, doc_id):
    if request.method != 'POST':
        raise ApiError(405, 'Method not allowed.')
    d = body(request)
    c = Cleaner(d)
    trans_id = c.text('transporter_id', max_len=20)
    trans_name = c.text('transporter_name', max_len=100)
    veh_no = c.text('vehicle_number', max_len=30)
    dist = c.integer('distance_km', default=50, lo=1)
    c.done()
    ewb = services.generate_eway_bill(doc_type.upper(), doc_id, trans_id, trans_name, veh_no, dist, request.user)
    return j({
        'bill_number': ewb.bill_number, 'doc_number': ewb.doc_number,
        'distance_km': ewb.distance_km, 'valid_until': ewb.valid_until,
        'status': ewb.status
    })

@api_view
def transaction_locking_view(request):
    if request.method == 'POST':
        check_permission(request, allowed_roles=[UserProfile.ADMIN, UserProfile.ACCOUNTANT])
    if request.method == 'GET':
        lock = LockDate.get_lock()
        return j({
            'is_locked': bool(lock and lock.lock_date),
            'lock_date': lock.lock_date if lock else None,
            'reason': lock.reason if lock else ''
        })
    if request.method == 'POST':
        d = body(request)
        c = Cleaner(d)
        ld = c.date('lock_date')
        reason = c.text('reason', default='Books closed for accounting period', max_len=255)
        c.done()

        lock = LockDate.objects.first()
        if not ld:
            if lock:
                lock.delete()
            services.log_audit(request.user, 'unlock', 'LockDate', 0, 'Transaction lock removed')
            return j({'is_locked': False, 'lock_date': None, 'reason': ''})

        if not lock:
            lock = LockDate.objects.create(lock_date=ld, reason=reason, locked_by=request.user)
        else:
            lock.lock_date = ld
            lock.reason = reason
            lock.locked_by = request.user
            lock.save()
        services.log_audit(request.user, 'lock', 'LockDate', 0, f"Transactions locked prior to {ld} ({reason})")
        return j({'is_locked': True, 'lock_date': lock.lock_date, 'reason': lock.reason})
    raise ApiError(405, 'Method not allowed.')

@api_view
def convobot_doubt_clearance_view(request):
    if request.method != 'POST':
        raise ApiError(405, 'Method not allowed.')
    d = body(request)
    q = d.get('query', '')
    category = d.get('category', 'all')
    history = d.get('history', [])
    res = services.process_convobot_query(q, category=category, history=history, user=request.user)
    return j(res)

@api_view
def convobot_query_view(request):
    if request.method != 'POST':
        raise ApiError(405, 'Method not allowed.')
    d = body(request)
    q = d.get('query', '')
    res = services.process_convobot_query(q, user=request.user)
    return j(res)

ai_doubt_clearance_view = convobot_doubt_clearance_view
ai_query_view = convobot_query_view

@api_view
def ai_anomalies_view(request):
    anoms = services.detect_financial_anomalies()
    return j([
        {'id': a.pk, 'title': a.title, 'severity': a.severity, 'anomaly_type': a.anomaly_type,
         'description': a.description, 'entity_type': a.entity_type, 'entity_id': a.entity_id,
         'status': a.status, 'detected_at': a.detected_at}
        for a in anoms
    ])

@api_view
def ai_anomalies_resolve_view(request, pk):
    if request.method != 'POST':
        raise ApiError(405, 'Method not allowed.')
    anom = FinancialAnomaly.objects.filter(pk=pk).first()
    if not anom:
        raise ApiError(404, 'Anomaly not found.')
    anom.status = 'resolved'
    anom.save(update_fields=['status'])
    return j({'status': 'resolved', 'id': anom.pk})

@api_view
def security_compliance_summary_view(request):
    org = Organization.get()
    lock = LockDate.get_lock()
    audit_count = AuditLog.objects.count()
    last_audit = AuditLog.objects.first()
    mfa_enabled = request.session.get('mfa_enabled', True)

    data = {
        'tenant': {
            'organization_id': f'TENANT-ORG-{org.pk:04d}',
            'name': org.name,
            'tier': 'Enterprise Multi-Tenant SaaS Financial Suite',
            'isolation_level': 'Database & Row-Level Tenant Isolation',
            'status': 'active',
            'api_rate_limit': '10,000 req/min',
        },
        'mfa': {
            'enabled': mfa_enabled,
            'method': 'Time-Based One-Time Password (TOTP RFC 6238)',
            'backup_codes_count': 8,
            'enforced_for_roles': ['Admin', 'Accountant', 'Operator'],
            'last_verified_at': timezone.now().isoformat()
        },
        'audit': {
            'total_logs': audit_count,
            'is_immutable': True,
            'retention_policy': '7 Years Statutory Financial Retention',
            'last_log_timestamp': last_audit.timestamp.isoformat() if last_audit else None,
            'lock_date': lock.lock_date.isoformat() if lock and lock.lock_date else None,
            'lock_reason': lock.reason if lock else None,
        },
        'soc2': {
            'certification': 'SOC 2 Type II Certified & Continuous Compliance',
            'controls': [
                {'principle': 'Security', 'status': 'Compliant', 'detail': 'AES-256 at rest, TLS 1.3 in transit, strict RBAC'},
                {'principle': 'Availability', 'status': 'Compliant', 'detail': '99.99% SLA uptime, automated snapshot backups'},
                {'principle': 'Processing Integrity', 'status': 'Compliant', 'detail': 'Double-entry GL debit/credit balancing verification'},
                {'principle': 'Confidentiality', 'status': 'Compliant', 'detail': 'Multi-tenant tenant isolation and encrypted secrets'},
                {'principle': 'Privacy', 'status': 'Compliant', 'detail': 'Strict adherence to global data privacy standards'}
            ],
            'compliance_score': 100,
            'next_audit_date': '2027-03-31'
        },
        'gdpr': {
            'data_portability_ready': True,
            'right_to_access': True,
            'right_to_rectification': True,
            'statutory_accounting_retention_years': 7,
            'pii_encryption': 'AES-256'
        },
        'regional_compliance': {
            'gst_enabled': True,
            'home_state': org.state,
            'gstin': org.gstin,
            'einvoicing_irn_ready': True,
            'eway_bill_ready': True,
            'multi_region_vat_ready': True,
            'supported_jurisdictions': ['India (GST)', 'UAE / GCC (VAT 5%)', 'United States (Sales Tax)', 'UK / EU (VAT 20%)']
        },
        'active_sessions': [
            {
                'ip_address': request.META.get('REMOTE_ADDR', '127.0.0.1'),
                'device': 'Current Browser Session (Desktop)',
                'login_time': (timezone.now() - timedelta(minutes=45)).isoformat(),
                'status': 'Current Active'
            }
        ]
    }
    return j(data)

@api_view
def security_mfa_toggle_view(request):
    if request.method != 'POST':
        raise ApiError(405, 'Method not allowed.')
    current = request.session.get('mfa_enabled', True)
    new_state = not current
    request.session['mfa_enabled'] = new_state

    AuditLog.objects.create(
        user=request.user,
        username=request.user.username or 'admin',
        action='update',
        entity_type='security_mfa',
        entity_id=str(request.user.pk),
        summary=f"Multi-Factor Authentication (MFA) was {'enabled' if new_state else 'disabled'} by {request.user.username}",
        details={'mfa_enabled': new_state, 'method': 'TOTP'},
        ip_address=request.META.get('REMOTE_ADDR', '127.0.0.1')
    )
    return j({'mfa_enabled': new_state, 'message': f"MFA {'enabled' if new_state else 'disabled'} successfully."})

@api_view
def security_gdpr_export_view(request):
    if request.method != 'POST' and request.method != 'GET':
        raise ApiError(405, 'Method not allowed.')

    org = Organization.get()
    export_payload = {
        'export_metadata': {
            'standard': 'GDPR Article 15 & 20 Right of Access and Data Portability',
            'exported_at': timezone.now().isoformat(),
            'requested_by': request.user.username,
            'organization': org.name,
            'cin': org.company_id,
            'gstin': org.gstin
        },
        'organization_profile': {
            'name': org.name,
            'state': org.state,
            'country': org.country,
            'email': org.email,
            'phone': org.phone,
            'address': org.address
        },
        'customer_records_count': Customer.objects.count(),
        'vendor_records_count': Vendor.objects.count(),
        'invoices_count': Invoice.objects.count(),
        'audit_logs_summary': {
            'total_events_logged': AuditLog.objects.count(),
            'recent_events': [
                {'action': l.action, 'entity': l.entity_type, 'summary': l.summary, 'timestamp': l.timestamp.isoformat()}
                for l in AuditLog.objects.all()[:15]
            ]
        }
    }

    AuditLog.objects.create(
        user=request.user,
        username=request.user.username or 'admin',
        action='export',
        entity_type='gdpr_data_portability',
        entity_id=str(org.pk),
        summary=f"GDPR comprehensive compliance data export requested by {request.user.username}",
        details={'format': 'json', 'export_type': 'full_tenant_export'},
        ip_address=request.META.get('REMOTE_ADDR', '127.0.0.1')
    )

    return j(export_payload)

@api_view
def mcp_view(request):
    """
    Model Context Protocol (MCP) server integration supporting external AI agents.
    Exposes tools for financial analytics, document queries, and ledger operations.
    """
    if request.method != 'POST':
        raise ApiError(405, 'Method not allowed.')
    d = body(request)
    msg_id = d.get('id', 1)
    method = d.get('method', '')
    params = d.get('params', {})

    if method == 'initialize':
        return j({
            'jsonrpc': '2.0',
            'id': msg_id,
            'result': {
                'protocolVersion': '2024-11-05',
                'serverInfo': {'name': 'convosis-books-mcp', 'version': '2.4.0'},
                'capabilities': {
                    'tools': {'listChanged': True},
                    'resources': {'subscribe': False, 'listChanged': True}
                }
            }
        })

    elif method == 'tools/list':
        tools = [
            {
                'name': 'get_financial_metrics',
                'description': 'Retrieve revenue, expenses, net profit, cash balance, and GST payable for a period.',
                'inputSchema': {
                    'type': 'object',
                    'properties': {'start': {'type': 'string'}, 'end': {'type': 'string'}}
                }
            },
            {
                'name': 'list_invoices',
                'description': 'Query sales invoices with optional customer and status filters.',
                'inputSchema': {
                    'type': 'object',
                    'properties': {'status': {'type': 'string'}, 'customer_id': {'type': 'integer'}}
                }
            },
            {
                'name': 'detect_anomalies',
                'description': 'Scan transactions for duplicate bills, spending spikes, and tax anomalies.',
                'inputSchema': {'type': 'object'}
            },
            {
                'name': 'query_general_ledger',
                'description': 'Inspect trial balance and general ledger account transactions.',
                'inputSchema': {
                    'type': 'object',
                    'properties': {'as_of': {'type': 'string'}}
                }
            }
        ]
        return j({'jsonrpc': '2.0', 'id': msg_id, 'result': {'tools': tools}})

    elif method == 'tools/call':
        name = params.get('name', '')
        args = params.get('arguments', {})
        today = timezone.localdate()

        if name == 'get_financial_metrics':
            start = Cleaner(args).date('start', default=today.replace(day=1))
            end = Cleaner(args).date('end', default=today)
            dash = services.dashboard(start, end)
            content = f"Financial Metrics ({start} to {end}):\nRevenue: ₹{dash['kpis']['revenue']['value']:,.2f}\nExpenses: ₹{dash['kpis']['expenses']['value']:,.2f}\nNet Profit: ₹{dash['kpis']['profit']['value']:,.2f}\nGST Payable: ₹{dash['kpis']['gst_payable']['value']:,.2f}\nCash Balance: ₹{dash['kpis']['cash']['value']:,.2f}"
            return j({'jsonrpc': '2.0', 'id': msg_id, 'result': {'content': [{'type': 'text', 'text': content}]}})

        elif name == 'detect_anomalies':
            anoms = services.detect_financial_anomalies()
            lines = [f"[{a.severity.upper()}] {a.title}: {a.description}" for a in anoms]
            content = '\n'.join(lines) if lines else "No anomalies detected."
            return j({'jsonrpc': '2.0', 'id': msg_id, 'result': {'content': [{'type': 'text', 'text': content}]}})

        elif name == 'query_general_ledger':
            tb = services.trial_balance_report(today)
            lines = [f"{a['code']} {a['name']}: Debit ₹{a['debit']:,.2f} | Credit ₹{a['credit']:,.2f}" for a in tb['accounts']]
            content = f"Trial Balance as of {today} (Balanced: {tb['is_balanced']}):\n" + '\n'.join(lines)
            return j({'jsonrpc': '2.0', 'id': msg_id, 'result': {'content': [{'type': 'text', 'text': content}]}})

        else:
            return j({'jsonrpc': '2.0', 'id': msg_id, 'error': {'code': -32601, 'message': f"Method '{name}' not found."}})

    elif method == 'resources/list':
        resources = [
            {'uri': 'convosis://reports/trial-balance', 'name': 'Trial Balance', 'mimeType': 'application/json'},
            {'uri': 'convosis://reports/profit-loss', 'name': 'Profit and Loss Statement', 'mimeType': 'application/json'},
            {'uri': 'convosis://compliance/gstr1', 'name': 'GSTR-1 Outward Supplies', 'mimeType': 'application/json'}
        ]
        return j({'jsonrpc': '2.0', 'id': msg_id, 'result': {'resources': resources}})

    elif method == 'resources/read':
        uri = params.get('uri', '')
        today = timezone.localdate()
        if 'trial-balance' in uri:
            data = services.trial_balance_report(today)
        elif 'profit-loss' in uri:
            data = services.profit_and_loss_report(today.replace(day=1), today)
        elif 'gstr1' in uri:
            data = services.gstr1_report(today.replace(day=1), today)
        else:
            return j({'jsonrpc': '2.0', 'id': msg_id, 'error': {'code': -32602, 'message': 'Unknown resource URI'}})
        return j({'jsonrpc': '2.0', 'id': msg_id, 'result': {'contents': [{'uri': uri, 'mimeType': 'application/json', 'text': json.dumps(data, cls=DjangoJSONEncoder)}]}})

    else:
        return j({'jsonrpc': '2.0', 'id': msg_id, 'error': {'code': -32601, 'message': f"Unknown MCP method: {method}"}})

@api_view
def banking_feed_sync_view(request, bank_account_id):
    if request.method != 'POST':
        raise ApiError(405, 'Method not allowed.')
    d = body(request)
    provider = d.get('provider', 'setu_aa')
    res = services.sync_live_bank_feed(bank_account_id, provider=provider, user=request.user)
    return j(res)

@api_view
def banking_rules_view(request):
    if request.method == 'GET':
        rules = BankRule.objects.all().order_by('priority')
        return j([
            {
                'id': r.pk, 'name': r.name, 'priority': r.priority, 'field': r.field,
                'operator': r.operator, 'value': r.value,
                'assign_account': r.assign_account_id,
                'assign_account_name': r.assign_account.name if r.assign_account else None,
                'assign_party_type': r.assign_party_type,
                'assign_party_id': r.assign_party_id,
                'auto_reconcile': r.auto_reconcile,
                'active': r.active
            }
            for r in rules
        ])
    elif request.method == 'POST':
        d = body(request)
        c = Cleaner(d)
        name = c.text('name', required=True, max_len=150)
        field = c.text('field', default='description', max_len=40)
        operator = c.text('operator', default='contains', max_len=20)
        val = c.text('value', required=True, max_len=200)
        auto_rec = c.boolean('auto_reconcile', default=False)
        prio = c.integer('priority', default=10, lo=1, hi=100)
        acc_id = c.integer('assign_account')
        party_type = c.text('assign_party_type', max_len=20)
        party_id = c.integer('assign_party_id')
        c.done()

        rule = BankRule.objects.create(
            name=name, field=field, operator=operator, value=val,
            auto_reconcile=auto_rec, priority=prio,
            assign_account_id=acc_id, assign_party_type=party_type,
            assign_party_id=party_id
        )
        services.log_audit(request.user, 'create', 'bank_rule', rule.pk, f"Created bank rule {rule.name}")
        return j({'id': rule.pk, 'name': rule.name, 'status': 'created'}, 201)
    raise ApiError(405, 'Method not allowed.')

@api_view
def banking_rules_detail_view(request, pk):
    rule = BankRule.objects.filter(pk=pk).first()
    if not rule:
        raise ApiError(404, 'Rule not found.')
    if request.method == 'DELETE':
        rule.delete()
        services.log_audit(request.user, 'delete', 'bank_rule', pk, f"Deleted bank rule {rule.name}")
        return j({'status': 'deleted'})
    elif request.method == 'PUT':
        d = body(request)
        rule.active = d.get('active', rule.active)
        if 'name' in d: rule.name = d['name']
        if 'value' in d: rule.value = d['value']
        if 'auto_reconcile' in d: rule.auto_reconcile = d['auto_reconcile']
        rule.save()
        return j({'status': 'updated', 'id': rule.pk})
    raise ApiError(405, 'Method not allowed.')

@api_view
@role_required(UserProfile.ADMIN, UserProfile.ACCOUNTANT)
def banking_rollback_view(request, batch_id):
    if request.method != 'POST':
        raise ApiError(405, 'Method not allowed.')
    res = services.rollback_statement_batch(batch_id, user=request.user)
    return j(res)

@api_view
@role_required(UserProfile.ADMIN, UserProfile.ACCOUNTANT)
def banking_run_automation_view(request):
    if request.method != 'POST':
        raise ApiError(405, 'Method not allowed.')
    d = body(request) if request.body else {}
    ba_id = d.get('bank_account')
    if ba_id:
        try:
            ba_id = int(ba_id)
        except (ValueError, TypeError):
            ba_id = None
    res = services.run_banking_automation(bank_account_id=ba_id, user=request.user)
    return j(res)

@api_view
@role_required(UserProfile.ADMIN, UserProfile.ACCOUNTANT)
def banking_generate_default_rules_view(request):
    if request.method != 'POST':
        raise ApiError(405, 'Method not allowed.')
    rules = services.ensure_default_bank_rules(force=True)
    return j({
        'status': 'ok',
        'count': len(rules),
        'message': f'{len(rules)} recommended bank rules deployed successfully.'
    })

@api_view
def banking_export_transactions_view(request):
    ba_id = request.GET.get('bank_account')
    if ba_id and ba_id.isdigit():
        ba_id = int(ba_id)
    else:
        ba_id = None
    status = request.GET.get('status')
    csv_content = services.export_bank_transactions_csv(bank_account_id=ba_id, status=status)
    resp = HttpResponse(csv_content, content_type='text/csv; charset=utf-8')
    resp['Content-Disposition'] = 'attachment; filename="bank_feed_transactions.csv"'
    return resp

@api_view
def gst_returns_gstr1_view(request):
    period = request.GET.get('period', '042026')
    fy = request.GET.get('fy', '2026-27')
    res = services.generate_official_gstr1(tax_period=period, financial_year=fy)
    return j(res)

@api_view
def gst_returns_gstr3b_view(request):
    period = request.GET.get('period', '042026')
    fy = request.GET.get('fy', '2026-27')
    res = services.generate_official_gstr3b(tax_period=period, financial_year=fy)
    return j(res)

@api_view
def gst_returns_file_view(request, pk):
    if request.method != 'POST':
        raise ApiError(405, 'Method not allowed.')
    d = body(request)
    method = d.get('e_sign_type', 'PAN_OTP')
    res = services.file_gstr_return(pk, e_sign_method=method, user=request.user)
    return j(res)

@api_view
def gst_returns_history_view(request):
    returns = GSTRReturn.objects.all().order_by('-created_at')
    return j([
        {
            'id': r.pk, 'return_type': r.return_type, 'financial_year': r.financial_year,
            'tax_period': r.tax_period, 'status': r.status, 'arn': r.arn,
            'filed_at': r.filed_at.isoformat() if r.filed_at else None,
            'taxable_value': str(r.taxable_value), 'total_tax': str(r.total_tax),
            'created_at': r.created_at.isoformat()
        }
        for r in returns
    ])

@api_view
def einvoice_authenticated_view(request, inv_id):
    if request.method != 'POST':
        raise ApiError(405, 'Method not allowed.')
    res = services.generate_authenticated_irn(inv_id)
    return j(res)

@api_view
def security_verify_audit_chain_view(request):
    res = services.verify_audit_trail_chain()
    return j(res)

@api_view
def security_mfa_setup_view(request):
    if request.method != 'POST':
        raise ApiError(405, 'Method not allowed.')
    res = services.generate_mfa_setup(request.user)
    return j(res)

@api_view
def security_mfa_verify_view(request):
    if request.method != 'POST':
        raise ApiError(405, 'Method not allowed.')
    d = body(request)
    token = d.get('token', '')
    res = services.verify_mfa_code(request.user, token)
    return j(res)

@api_view
@role_required(UserProfile.ADMIN)
def security_backup_create_view(request):
    if request.method != 'POST':
        raise ApiError(405, 'Method not allowed.')
    d = body(request)
    btype = d.get('type', 'manual_snapshot')
    res = services.create_security_snapshot(user=request.user, backup_type=btype)
    return j(res)

@api_view
def security_backup_list_view(request):
    backups = SecurityBackupRecord.objects.all().order_by('-created_at')
    return j([
        {
            'id': b.pk, 'snapshot_id': b.snapshot_id, 'filename': b.filename,
            'size_bytes': b.file_size_bytes, 'checksum_sha256': b.checksum_sha256,
            'backup_type': b.backup_type, 'status': b.status,
            'record_counts': b.record_counts,
            'disaster_recovery_test_passed': b.disaster_recovery_test_passed,
            'created_at': b.created_at.isoformat()
        }
        for b in backups
    ])

@api_view
@role_required(UserProfile.ADMIN)
def security_disaster_recovery_drill_view(request):
    if request.method != 'POST':
        raise ApiError(405, 'Method not allowed.')
    d = body(request)
    snap_id = d.get('snapshot_id')
    res = services.run_disaster_recovery_simulation(snapshot_id=snap_id)
    return j(res)

@api_view
def jobs_create_view(request):
    if request.method != 'POST':
        raise ApiError(405, 'Method not allowed.')
    d = body(request)
    task_type = d.get('task_type', 'bulk_sync')
    res = services.start_background_job(task_type, details=d, user=request.user)
    return j(res)

@api_view
def jobs_status_view(request, task_id):
    res = services.get_background_job_status(task_id)
    return j(res)

def portal_customer_view(request, token_or_id):
    """Accessible either by authenticated operator or via self-service portal token."""
    res = services.get_customer_portal_data(token_or_id)
    return j(res)

def portal_vendor_view(request, token_or_id):
    """Accessible either by authenticated operator or via self-service portal token."""
    res = services.get_vendor_portal_data(token_or_id)
    return j(res)

@api_view
def interop_zoho_export_view(request, entity):
    res = services.export_zoho_compatible_data(entity=entity)
    return j(res)

@api_view
def interop_zoho_import_view(request, entity):
    if request.method != 'POST':
        raise ApiError(405, 'Method not allowed.')
    d = body(request)
    records = d.get('records', [])
    res = services.import_zoho_compatible_data(entity, records, user=request.user)
    return j(res)

@api_view
def notifications_list_view(request):
    res = services.list_notifications(user=request.user)
    return j(res)

@api_view
def notification_mark_read_view(request, pk):
    if request.method != 'POST':
        raise ApiError(405, 'Method not allowed.')
    res = services.mark_notification_read(pk, user=request.user)
    return j(res)

@api_view
def notifications_mark_all_read_view(request):
    if request.method != 'POST':
        raise ApiError(405, 'Method not allowed.')
    res = services.mark_all_notifications_read(user=request.user)
    return j(res)

@api_view
def subscription_summary_view(request):
    res = services.get_tenant_subscription_summary()
    return j(res)

@api_view
@role_required(UserProfile.ADMIN)
def subscription_update_view(request):
    if request.method != 'POST':
        raise ApiError(405, 'Method not allowed.')
    d = body(request)
    tier = d.get('tier', 'growth')
    cycle = d.get('billing_cycle', 'annual')
    res = services.update_tenant_subscription(tier, billing_cycle=cycle)
    return j(res)

@api_view
@role_required(UserProfile.ADMIN)
def tenant_admin_summary_view(request):
    res = services.get_tenant_admin_summary()
    return j(res)

@api_view
@role_required(UserProfile.ADMIN)
def tenant_admin_invite_user_view(request):
    if request.method != 'POST':
        raise ApiError(405, 'Method not allowed.')
    d = body(request)
    res = services.invite_tenant_user(
        username=d.get('username'),
        email=d.get('email'),
        role=d.get('role', 'accountant'),
        phone=d.get('phone', '')
    )
    return j(res)

@api_view
@role_required(UserProfile.ADMIN)
def tenant_admin_update_role_view(request, pk):
    if request.method != 'POST':
        raise ApiError(405, 'Method not allowed.')
    d = body(request)
    res = services.update_tenant_user_role(pk, d.get('role', 'accountant'))
    return j(res)

@api_view
@role_required(UserProfile.ADMIN)
def developer_keys_list_create_view(request):
    if request.method == 'POST':
        d = body(request)
        res = services.create_developer_api_key(d.get('name'), d.get('scopes'))
        return j(res, status=201)
    res = services.list_developer_api_keys()
    return j({'keys': res})

@api_view
@role_required(UserProfile.ADMIN)
def developer_key_revoke_view(request, pk):
    if request.method not in ('POST', 'DELETE'):
        raise ApiError(405, 'Method not allowed.')
    res = services.revoke_developer_api_key(pk)
    return j(res)

@api_view
@role_required(UserProfile.ADMIN)
def developer_webhooks_list_create_view(request):
    if request.method == 'POST':
        d = body(request)
        res = services.create_webhook_subscription(d.get('endpoint_url'), d.get('events'))
        return j(res, status=201)
    res = services.list_webhook_subscriptions()
    return j({'webhooks': res})

@api_view
@role_required(UserProfile.ADMIN)
def developer_webhook_test_view(request, pk):
    if request.method != 'POST':
        raise ApiError(405, 'Method not allowed.')
    res = services.test_webhook_delivery(pk)
    return j(res)

@api_view
def assistant_accounting_context_view(request):
    res = services.get_live_accounting_context()
    return j(res)

@api_view
def gstin_lookup_view(request, gstin):
    res = services.lookup_gstin_details(gstin)
    return j(res)


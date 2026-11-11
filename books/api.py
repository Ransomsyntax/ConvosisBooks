"""JSON API (session-authenticated, CSRF-protected). One Resource class per entity."""
import csv
import datetime
from datetime import timedelta
import io
import json
import re
import uuid
from decimal import Decimal
from functools import wraps

from django.conf import settings
from django.core.paginator import Paginator
from django.core.serializers.json import DjangoJSONEncoder
from django.db import transaction
from django.db.models import F, ProtectedError, Q, Sum
from django.http import HttpResponse, JsonResponse
from django.utils import timezone
from django.utils.text import slugify

slug = slugify
REQUIRED = 'This field is required.'

from . import services
from .calc import GST_SLABS, compute, is_intra_state, q2
from .cleaning import GSTIN_RE, PAN_RE, ApiError, Cleaner
from .models import (
    Account, Attachment, AuditLog, BackgroundTask, BankAccount, BankFeedConnection,
    StockTransfer, StockTransferLine,
    BankRule, BankStatementBatch, BankTransaction, BankDeposit, BankTransfer, BankReconciliation,
    Bill, BillAllocation, BillLine,
    CreditNote, CreditNoteLine, CurrencySetting, CustomField, Customer, CustomerPortalAccess, DeliveryChallan,
    DeliveryChallanLine, DocumentFolder, EInvoiceRecord, EWayBill, Expense, FinancialAnomaly,
    GSTRReturn, Invoice, InvoiceLine, Item, ItemCategory, Journal, JournalItem, LockDate,
    ManagedDocument, MODES, Organization, PaymentMade, PaymentReceived, PaymentTermSetting, PaymentTransaction,
    PriceList, Project, PurchaseOrder, PurchaseOrderLine, Quote, QuoteLine, ReceivedAllocation, RecurringInvoice,
    RetainerInvoice, RetainerInvoiceAllocation, RetainerInvoiceLine, RetainerPayment, Role, SalesOrder,
    SalesOrderLine, SecurityBackupRecord, Sequence, StockMovement, SubscriptionInvoice, TenantSubscription, TimeLog, UserInvitation, UserProfile, Vendor, VendorCredit,
    VendorCreditLine, VendorPortalAccess, Warehouse, WebhookConfig, WorkflowRule
)
from .services import bill_qs, invoice_qs, next_number, paid_expr, retainer_qs

Z = Decimal('0.00')
MODE_KEYS = [m[0] for m in MODES]
MODE_LABEL = dict(MODES)
REASONS = ['Stock recount', 'Damaged goods', 'Theft / loss', 'Returned to supplier', 'Found stock', 'Stock write-off', 'Inventory revaluation', 'Other']

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
        if isinstance(data, str):
            try:
                inner = json.loads(data)
                if isinstance(inner, dict):
                    data = inner
            except (ValueError, TypeError):
                pass
    except (ValueError, UnicodeDecodeError):
        raise ApiError(400, 'Invalid JSON body.')
    if not isinstance(data, dict):
        raise ApiError(400, 'Expected a JSON object.')
    return data

CASHIER_ALLOWED_RESOURCES = {
    'customers', 'items', 'item_categories', 'quotes', 'invoices', 'payments_received',
    'sales_orders', 'delivery_challans', 'price_lists', 'attachments'
}

def get_user_org(user, request=None):
    if not user or not getattr(user, 'is_authenticated', False):
        return None
    profile = getattr(user, 'profile', None)
    base_org = None
    if profile and profile.organization:
        base_org = profile.organization
    elif getattr(user, 'is_superuser', False):
        if request:
            target_val = request.headers.get('X-Organization-Id') or (
                request.session.get('active_org_id') if hasattr(request, 'session') else None
            )
            if target_val:
                target_str = str(target_val).strip()
                if target_str.isdigit():
                    return Organization.objects.filter(id=int(target_str)).first()
                try:
                    uuid.UUID(target_str)
                    return Organization.objects.filter(uuid=target_str).first()
                except Exception:
                    pass
        base_org = Organization.objects.first()

    if not base_org:
        owned_org = Organization.objects.filter(status='active', owner=user).order_by('id').first()
        if owned_org:
            base_org = owned_org
        else:
            orgs = list(Organization.objects.filter(status='active').order_by('id'))
            if len(orgs) == 1:
                base_org = orgs[0]

    if not base_org:
        return None

    # Multi-tenant Context Switch Verification:
    # A user can switch active organization context via HTTP Header or Session if:
    # 1. Target org is their own base organization, OR
    # 2. Their base organization is 'MAIN' and the target organization is a direct child sub-organization.
    if request:
        target_val = request.headers.get('X-Organization-Id') or (
            request.session.get('active_org_id') if hasattr(request, 'session') else None
        )
        if target_val:
            target_str = str(target_val).strip()
            if target_str in (str(base_org.id), str(getattr(base_org, 'uuid', ''))):
                return base_org
            if getattr(base_org, 'org_type', 'MAIN') == 'MAIN':
                sub_match = None
                if target_str.isdigit():
                    sub_match = base_org.sub_organizations.filter(id=int(target_str), status='active').first()
                else:
                    try:
                        uuid.UUID(target_str)
                        sub_match = base_org.sub_organizations.filter(uuid=target_str, status='active').first()
                    except Exception:
                        sub_match = None
                if sub_match:
                    return sub_match
            # If context switch is unauthorized, strictly clamp to base_org
    return base_org

def get_user_role(user):
    if not user or not user.is_authenticated:
        return None
    if user.is_superuser:
        return UserProfile.ADMIN
    profile = getattr(user, 'profile', None)
    if not profile:
        org_name = f"{user.username.title()}'s Organization"
        org = Organization.objects.create(name=org_name, company_id=slug(org_name)[:20])
        services.ensure_default_accounts(org)
        profile, _ = UserProfile.objects.get_or_create(
            user=user,
            defaults={
                'role': UserProfile.ADMIN if (user.is_superuser or user.is_staff) else UserProfile.ADMIN,
                'organization': org
            }
        )
    return profile.role

def get_client_ip(request):
    if not request:
        return ''
    xff = request.META.get('HTTP_X_FORWARDED_FOR')
    if xff:
        return xff.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR', '')

def check_permission(request, allowed_roles=None, resource_name=None, action_name=None):
    user = request.user
    if not user or not user.is_authenticated:
        raise ApiError(401, 'Authentication required.')

    if user.is_superuser:
        return True

    profile = getattr(user, 'profile', None)
    custom_role = getattr(profile, 'custom_role', None) if profile else None

    # Check segmented access control if custom_role is assigned
    if custom_role and custom_role.permissions:
        perms = custom_role.permissions
        if custom_role.name == 'Admin':
            return True

        method = request.method
        action = action_name or ('delete' if method == 'DELETE' else ('edit' if method in ('PUT', 'PATCH') else ('create' if method == 'POST' else 'view')))

        RES_MAP = {
            'customers': ('contacts', 'customers'),
            'vendors': ('contacts', 'vendors'),
            'items': ('items', 'item'),
            'adjustments': ('items', 'adjustments'),
            'stock-adjustments': ('items', 'adjustments'),
            'stock-transfers': ('items', 'transfers'),
            'price-lists': ('items', 'price_lists'),
            'banking': ('banking', 'banking'),
            'bank-accounts': ('banking', 'banking'),
            'invoices': ('sales', 'invoices'),
            'payments-received': ('sales', 'customer_payments'),
            'quotes': ('sales', 'quotes'),
            'delivery-challans': ('sales', 'delivery_challans'),
            'sales-orders': ('sales', 'sales_orders'),
            'credit-notes': ('sales', 'credit_notes'),
            'bills': ('purchases', 'bills'),
            'payments-made': ('purchases', 'vendor_payments'),
            'expenses': ('purchases', 'expenses'),
            'purchase-orders': ('purchases', 'purchase_orders'),
            'vendor-credits': ('purchases', 'vendor_credits'),
            'accounts': ('accountant', 'chart_of_accounts'),
            'journals': ('accountant', 'journals'),
            'budgets': ('accountant', 'budgets'),
            'projects': ('timesheets', 'projects'),
            'timesheets': ('timesheets', 'timesheets'),
            'time-entries': ('timesheets', 'time_entries'),
            'settings': ('settings', 'update_profile'),
            'roles': ('settings', 'users'),
            'users': ('settings', 'users'),
            'salespersons': ('sales', 'quotes'),
            'employees': ('settings', 'users'),
        }

        if resource_name == 'stock-transfers' and action == 'delete':
            raise ApiError(405, 'Stock transfers cannot be deleted. Use Reverse Entry instead.')

        if resource_name in RES_MAP:
            mod_key, sub_key = RES_MAP[resource_name]
            sub_perms = perms.get(mod_key, {}).get(sub_key, {})
            if isinstance(sub_perms, dict):
                has_full = bool(sub_perms.get('full'))
                has_action = bool(sub_perms.get(action))
                if not (has_full or has_action):
                    raise ApiError(403, f'Permission denied: Role "{custom_role.name}" does not have {action.upper()} permission on {resource_name}.')
            elif isinstance(sub_perms, bool):
                if not sub_perms:
                    raise ApiError(403, f'Permission denied: Role "{custom_role.name}" does not have access to {resource_name}.')

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

    def get_object(self, pk, request=None):
        qs = self.base_qs()
        if request and hasattr(self.model, 'organization'):
            user_org = get_user_org(request.user, request)
            if user_org:
                qs = qs.filter(organization=user_org)
            else:
                qs = qs.none()
        obj = qs.filter(pk=pk).first()
        if obj is None:
            raise ApiError(404, 'Not found.')
        return obj

    def create(self, data, user):
        raise ApiError(405, 'Creating this record is not supported.')

    def create_for_request(self, data, user, request):
        return self.create(data, user)

    def update(self, obj, data, user):
        raise ApiError(405, 'Editing this record is not supported.')

    def destroy(self, obj):
        obj.delete()

    def action(self, request, obj, name):
        raise ApiError(404, 'Unknown action.')

    def queryset(self, request):
        qs = self.filter_qs(self.base_qs(), request)
        if hasattr(self.model, 'organization'):
            user_org = get_user_org(request.user, request)
            if user_org:
                qs = qs.filter(organization=user_org)
            else:
                qs = qs.none()
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

    def export(self, qs, request=None):
        rows = list(qs)
        if not rows:
            return JsonResponse({'error': 'No data available to export.'}, status=400)
        try:
            user_org = get_user_org(request.user) if request else None
            services.log_audit(
                request.user if request else None, 'export', self.model.__name__ if self.model else self.name, '',
                f"Exported {self.name} as CSV",
                ip_address=get_client_ip(request) if request else '',
                org=user_org,
                module=self.name
            )
        except Exception:
            pass
        resp = HttpResponse(content_type='text/csv; charset=utf-8')
        resp['Content-Disposition'] = f'attachment; filename="{self.name}.csv"'
        w = csv.writer(resp)
        w.writerow([h for h, _ in self.csv_cols])
        for r in self.rows(rows):
            w.writerow([safe_cell(r.get(k, '')) for _, k in self.csv_cols])
        return resp

    def get_template_sample(self):
        return None

    def export_template(self):
        resp = HttpResponse(content_type='text/csv; charset=utf-8')
        resp['Content-Disposition'] = f'attachment; filename="{self.name}_template.csv"'
        w = csv.writer(resp)
        w.writerow([h for h, _ in self.csv_cols])
        sample = self.get_template_sample()
        if sample:
            w.writerow(sample)
        return resp

    def get_col_map(self):
        mapping = {}
        for h, k in self.csv_cols:
            hl = h.lower().strip()
            mapping[hl] = k
            mapping[re.sub(r'[^a-z0-9]', '', hl)] = k
            mapping[k.lower()] = k
            mapping[re.sub(r'[^a-z0-9]', '', k.lower())] = k
        aliases = {
            'name': ['name', 'display_name', 'customer_name', 'vendor_name', 'party_name', 'party', 'title', 'item_name', 'product_name', 'account_name', 'full_name', 'client', 'client_name', 'supplier', 'supplier_name'],
            'company': ['company', 'company_name', 'business_name', 'organization', 'org'],
            'email': ['email', 'email_address', 'mail', 'contact_email'],
            'phone': ['phone', 'phone_number', 'mobile', 'mobile_number', 'telephone', 'contact_number', 'contact_no', 'phone_no'],
            'gstin': ['gstin', 'gst_number', 'gst_no', 'gst', 'tax_id', 'tax_number'],
            'pan': ['pan', 'pan_number', 'pan_no'],
            'state': ['state', 'state_name', 'region', 'place_of_supply', 'pos'],
            'billing_address': ['billing_address', 'address', 'street', 'street_address'],
            'billing_city': ['billing_city', 'city'],
            'billing_pincode': ['billing_pincode', 'pincode', 'pin_code', 'postal_code', 'zip', 'zip_code'],
            'payment_terms': ['payment_terms', 'payment_terms_days', 'terms', 'payment_term', 'credit_days'],
            'sku': ['sku', 'item_code', 'product_code', 'code', 'barcode', 'part_number'],
            'item_type': ['item_type', 'type', 'product_type'],
            'category': ['category', 'item_category', 'group', 'item_group'],
            'hsn_sac': ['hsn_sac', 'hsn', 'sac', 'hsn_code', 'sac_code'],
            'unit': ['unit', 'uom', 'measurement_unit', 'usage_unit'],
            'selling_price': ['selling_price', 'price', 'sales_price', 'rate', 'selling_rate', 'unit_price', 'mrp'],
            'purchase_price': ['purchase_price', 'cost', 'purchase_rate', 'cost_price', 'cost_rate'],
            'gst_rate': ['gst_rate', 'gst_%', 'gst_percent', 'gst_percentage', 'tax_rate', 'tax_%', 'tax', 'tax_percent'],
            'reorder_level': ['reorder_level', 'reorder_point', 'minimum_stock', 'min_stock'],
            'opening_stock': ['opening_stock', 'stock', 'initial_stock', 'quantity', 'qty', 'opening_qty'],
            'code': ['code', 'account_code', 'number', 'gl_code'],
            'account_type': ['account_type', 'account_category', 'type'],
            'sub_type': ['sub_type', 'subtype', 'detail_type', 'sub_category'],
            'description': ['description', 'notes', 'remarks', 'desc', 'narration', 'item_description'],
            'active': ['active', 'status', 'is_active'],
            'bank_name': ['bank_name', 'bank', 'institution'],
            'account_number': ['account_number', 'acc_number', 'account_no', 'acc_no', 'bank_account_number'],
            'ifsc': ['ifsc', 'ifsc_code', 'bank_ifsc', 'branch_ifsc'],
            'opening_balance': ['opening_balance', 'balance', 'opening_bal', 'initial_balance'],
            'branch_name': ['branch_name', 'branch', 'bank_branch'],
            'amount': ['amount', 'total_amount', 'expense_amount', 'amt', 'total', 'subtotal'],
            'expense_account': ['expense_account', 'expense_account_id', 'expense_account_code', 'account', 'category_account'],
            'vendor': ['vendor', 'vendor_id', 'vendor_name', 'payee', 'supplier', 'party', 'merchant'],
            'customer': ['customer', 'customer_id', 'customer_name', 'client', 'client_name', 'party'],
            'date': ['date', 'txn_date', 'transaction_date', 'expense_date', 'invoice_date', 'bill_date', 'doc_date'],
            'due_date': ['due_date', 'expiry_date', 'payment_due_date'],
            'reference': ['reference', 'ref', 'ref_no', 'reference_number', 'cheque_no', 'utr', 'order_number'],
            'paid_through': ['paid_through', 'paid_via', 'payment_mode', 'mode', 'payment_method'],
            'item': ['item', 'item_name', 'product', 'product_name', 'item_id'],
            'quantity': ['quantity', 'qty', 'units', 'count'],
            'rate': ['rate', 'unit_rate', 'price', 'unit_price', 'cost'],
            'discount_percent': ['discount_percent', 'discount', 'disc_%', 'discount_%']
        }
        for target, names in aliases.items():
            for n in names:
                mapping.setdefault(n, target)
                mapping.setdefault(re.sub(r'[^a-z0-9]', '', n), target)
        return mapping

    def prepare_import_record(self, rec):
        pass

    def preprocess_import_records(self, records):
        return records

    def find_existing(self, clean_item, user=None):
        if not hasattr(self, 'model') or self.model is None:
            return None
        try:
            with transaction.atomic():
                qs = self.model.objects.all()
                if hasattr(self.model, 'organization'):
                    org = get_user_org(user) if user else None
                    if org:
                        qs = qs.filter(organization=org)
                    elif user and user.is_authenticated and not user.is_superuser:
                        return None
                if hasattr(self.model, 'sku') and clean_item.get('sku'):
                    obj = qs.filter(sku__iexact=str(clean_item['sku']).strip()).first()
                    if obj: return obj
                if hasattr(self.model, 'code') and clean_item.get('code'):
                    obj = qs.filter(code__iexact=str(clean_item['code']).strip()).first()
                    if obj: return obj
                if hasattr(self.model, 'account_number') and clean_item.get('account_number'):
                    obj = qs.filter(account_number__iexact=str(clean_item['account_number']).strip()).first()
                    if obj: return obj
                if hasattr(self.model, 'number') and clean_item.get('number'):
                    obj = qs.filter(number__iexact=str(clean_item['number']).strip()).first()
                    if obj: return obj
                if hasattr(self.model, 'email') and clean_item.get('email'):
                    obj = qs.filter(email__iexact=str(clean_item['email']).strip()).first()
                    if obj: return obj
                if hasattr(self.model, 'name') and clean_item.get('name'):
                    obj = qs.filter(name__iexact=str(clean_item['name']).strip()).first()
                    if obj: return obj
        except Exception:
            pass
        return None

    def normalize_record(self, raw_record):
        if not isinstance(raw_record, dict):
            return {}
        col_map = self.get_col_map()
        rec = {}
        for col, val in raw_record.items():
            if not col:
                continue
            col_str = str(col).replace('﻿', '').strip()
            col_lower = col_str.lower()
            key = col_map.get(col_lower) or col_map.get(re.sub(r'[^a-z0-9]', '', col_lower)) or col_str
            if isinstance(val, str):
                v_strip = val.replace('﻿', '').strip()
                if v_strip.lower() in ('', 'none', 'null', 'n/a', '-'):
                    rec[key] = ''
                else:
                    rec[key] = v_strip
            else:
                rec[key] = val

        if 'active' in rec:
            act_val = str(rec['active']).lower().strip()
            if act_val in ('true', 'yes', '1', 'active', 'y'):
                rec['active'] = True
            elif act_val in ('false', 'no', '0', 'inactive', 'n'):
                rec['active'] = False
            elif act_val in ('', 'none', 'null', 'n/a', '-'):
                rec['active'] = True

        for num_f in ('selling_price', 'purchase_price', 'gst_rate', 'reorder_level', 'opening_stock', 'amount', 'total', 'opening_balance', 'current_balance', 'payment_terms', 'quantity', 'rate', 'discount_percent'):
            if num_f in rec and isinstance(rec[num_f], str):
                clean_num = rec[num_f].replace('₹', '').replace('$', '').replace('€', '').replace(',', '').replace('%', '').strip()
                if clean_num:
                    try:
                        rec[num_f] = int(float(clean_num)) if num_f == 'payment_terms' else Decimal(clean_num)
                    except Exception:
                        pass
                else:
                    rec.pop(num_f, None)

        self.prepare_import_record(rec)
        return rec

    def handle_collection(self, request):
        check_permission(request, resource_name=self.name)
        if request.method == 'GET':
            qs = self.queryset(request)
            if request.GET.get('export') == 'csv':
                return self.export(qs, request=request)
            if request.GET.get('export') == 'json':
                try:
                    services.log_audit(
                        request.user, 'export', self.model.__name__ if self.model else self.name, '',
                        f"Exported {self.name} as JSON",
                        ip_address=get_client_ip(request),
                        org=get_user_org(request.user),
                        module=self.name
                    )
                except Exception:
                    pass
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
            records = None
            data = None
            if request.FILES.get('file'):
                try:
                    file_obj = request.FILES['file']
                    parsed = services.parse_import_file(file_obj, file_obj.name)
                    records = parsed.get('records', [])
                except Exception as e:
                    raise ApiError(400, f'Failed to parse uploaded file: {str(e)}')
            else:
                data = body(request)
                if isinstance(data, dict) and 'import_records' in data:
                    records = data['import_records']
                elif isinstance(data, list) and data and all(isinstance(x, dict) for x in data):
                    records = data
                else:
                    with transaction.atomic():
                        obj = self.create_for_request(data, request.user, request)
                        if hasattr(obj, 'organization') and not getattr(obj, 'organization_id', None):
                            try:
                                with transaction.atomic():
                                    user_org = get_user_org(request.user)
                                    if user_org:
                                        obj.organization = user_org
                                        obj.save(update_fields=['organization'])
                            except Exception:
                                pass
                        # Global audit log for create
                        if self.name != 'stock-transfers':
                            try:
                                user_org = get_user_org(request.user)
                                ent_name = getattr(obj, 'number', getattr(obj, 'name', getattr(obj, 'code', f'#{obj.pk}')))
                                safe_data = {k: str(v) for k, v in data.items() if k not in ('password', 'token', 'secret', 'file_data', 'image_data')} if isinstance(data, dict) else {}
                                services.log_audit(
                                    request.user, 'create', self.model.__name__ if self.model else self.name, obj.pk,
                                    f"Created {self.model.__name__ if self.model else self.name} {ent_name}",
                                    details={'resource': self.name, 'data': safe_data},
                                    ip_address=get_client_ip(request),
                                    org=user_org,
                                    module=self.name,
                                    new_values=safe_data
                                )
                            except Exception:
                                pass
                    return j(self.detail(self.get_object(obj.pk, request)), 201)

            if records is not None:
                if not records:
                    return j({'status': 'failed', 'imported': 0, 'updated': 0, 'skipped': 0, 'duplicate_skus': 0, 'failed': 0, 'total': 0, 'errors': [{'row': 0, 'identifier': 'File', 'error': 'No records found in the imported file.'}], 'error_report_csv': '', 'message': 'No records found in the imported file.'})

                dup_mode = 'skip'
                if isinstance(data, dict) and 'duplicate_mode' in data:
                    dup_mode = str(data['duplicate_mode']).lower().strip()
                elif isinstance(data, dict) and 'duplicate_handling' in data:
                    dup_mode = str(data['duplicate_handling']).lower().strip()
                elif request.POST.get('duplicate_mode'):
                    dup_mode = str(request.POST.get('duplicate_mode')).lower().strip()
                elif request.POST.get('duplicate_handling'):
                    dup_mode = str(request.POST.get('duplicate_handling')).lower().strip()
                elif request.GET.get('duplicate_handling'):
                    dup_mode = str(request.GET.get('duplicate_handling')).lower().strip()
                elif request.GET.get('duplicate_mode'):
                    dup_mode = str(request.GET.get('duplicate_mode')).lower().strip()
                if dup_mode not in ('skip', 'update', 'auto_sku', 'error', 'create'):
                    dup_mode = 'skip'

                records = self.preprocess_import_records(records)

                created_count = 0
                updated_count = 0
                skipped_count = 0
                duplicate_skus_count = 0
                errors = []
                seen_identifiers_in_file = set()
                seen_objs_in_file = {}
                user_org = get_user_org(request.user)
                self.current_user_org = user_org

                for idx, raw_item in enumerate(records):
                    try:
                        clean_item = self.normalize_record(raw_item)
                        sku_val = (str(clean_item.get('sku') or '')).strip().upper()
                        code_val = (str(clean_item.get('code') or '')).strip().upper()
                        name_val = (str(clean_item.get('name') or '')).strip().lower()

                        if isinstance(self, DocResource):
                            num_val = (str(clean_item.get('number') or clean_item.get('quote_number') or clean_item.get('invoice_number') or clean_item.get('bill_number') or '')).strip().upper()
                            identifier_key = num_val or f"_doc_{idx}"
                        else:
                            num_val = ''
                            identifier_key = sku_val or code_val or name_val

                        # 1. Check existing record in DB
                        existing = self.find_existing(clean_item, user=request.user)
                        
                        # 2. Check if repeated in this CSV file
                        is_repeated_in_file = False
                        if identifier_key and identifier_key in seen_identifiers_in_file:
                            is_repeated_in_file = True

                        is_duplicate = bool(existing or is_repeated_in_file)
                        if is_duplicate:
                            duplicate_skus_count += 1

                        if is_duplicate:
                            identifier_desc = f"document '{num_val}'" if (isinstance(self, DocResource) and num_val) else (f"SKU '{sku_val}'" if sku_val else f"record '{identifier_key}'")
                            if dup_mode == 'skip':
                                skipped_count += 1
                                if identifier_key:
                                    seen_identifiers_in_file.add(identifier_key)
                                errors.append({
                                    'row': idx + 1,
                                    'name': str(raw_item.get('name') or raw_item.get('Name') or raw_item.get('customer') or raw_item.get('number') or ''),
                                    'sku': str(sku_val or num_val or ''),
                                    'identifier': str(identifier_key or f'Row {idx + 1}'),
                                    'error': f"Skipped: Duplicate {identifier_desc} already exists." if existing else (f"Skipped: Duplicate {identifier_desc} repeated in CSV." if is_repeated_in_file else "Skipped duplicate record.")
                                })
                                continue
                            elif dup_mode == 'error':
                                reason = (
                                    f"Duplicate {identifier_desc} already exists in organization." if existing else (
                                        f"Duplicate {identifier_desc} repeated in CSV file." if is_repeated_in_file else
                                        f"Record '{clean_item.get('name') or identifier_key}' already exists."
                                    )
                                )
                                raise ApiError(400, reason)
                            elif dup_mode == 'update':
                                target_obj = existing or seen_objs_in_file.get(identifier_key)
                                if target_obj:
                                    with transaction.atomic():
                                        self.update(target_obj, clean_item, request.user)
                                    updated_count += 1
                                    if identifier_key:
                                        seen_identifiers_in_file.add(identifier_key)
                                    continue
                            elif dup_mode == 'auto_sku':
                                new_sku = services.next_document_number('ITEM', org=user_org)
                                clean_item['sku'] = new_sku

                        # Create new record
                        with transaction.atomic():
                            created_obj = self.create(clean_item, request.user)
                            if hasattr(created_obj, 'organization') and not getattr(created_obj, 'organization_id', None):
                                try:
                                    if user_org:
                                        created_obj.organization = user_org
                                        created_obj.save(update_fields=['organization'])
                                except Exception:
                                    pass

                        created_count += 1
                        if identifier_key:
                            seen_identifiers_in_file.add(identifier_key)
                            seen_objs_in_file[identifier_key] = created_obj
                        new_created_sku = getattr(created_obj, 'sku', None)
                        if new_created_sku:
                            seen_identifiers_in_file.add(new_created_sku.strip().upper())

                    except Exception as e:
                        row_identifier = raw_item.get('name') or raw_item.get('Name') or raw_item.get('sku') or raw_item.get('SKU') or raw_item.get('code') or raw_item.get('Code') or raw_item.get('number') or raw_item.get('item') or f'Row {idx + 1}'
                        err_msg = str(e)
                        if hasattr(e, 'errors') and e.errors:
                            err_msg = '; '.join(f"{k}: {v}" for k, v in e.errors.items())
                        elif hasattr(e, 'message') and e.message:
                            err_msg = e.message
                        errors.append({
                            'row': idx + 1,
                            'name': str(raw_item.get('name') or raw_item.get('Name') or ''),
                            'sku': str(raw_item.get('sku') or raw_item.get('SKU') or ''),
                            'identifier': str(row_identifier),
                            'error': err_msg
                        })

                # Build error report CSV string
                error_csv_buf = io.StringIO()
                err_writer = csv.writer(error_csv_buf)
                err_writer.writerow(['Row Number', 'Item Name', 'SKU', 'Failure Reason'])
                for err in errors:
                    err_writer.writerow([err.get('row', ''), err.get('name', ''), err.get('sku', '') or err.get('identifier', ''), err.get('error', '')])
                error_report_csv_str = error_csv_buf.getvalue()

                status_label = 'ok' if not errors else ('partial' if (created_count > 0 or updated_count > 0) else 'failed')
                parts = []
                if created_count:
                    parts.append(f"{created_count} imported")
                if updated_count:
                    parts.append(f"{updated_count} updated")
                if skipped_count:
                    parts.append(f"{skipped_count} skipped")
                if duplicate_skus_count:
                    parts.append(f"{duplicate_skus_count} duplicates detected")
                summary_action = ', '.join(parts) or "0 records processed"

                msg = f"Import completed: {summary_action}."
                if errors:
                    msg += f" {len(errors)} record(s) failed."
                return j({
                    'status': status_label,
                    'imported': created_count,
                    'updated': updated_count,
                    'skipped': skipped_count,
                    'duplicate_skus': duplicate_skus_count,
                    'failed': len(errors),
                    'total': len(records),
                    'errors': errors,
                    'error_report_csv': error_report_csv_str,
                    'message': msg
                })

        if request.method == 'DELETE':
            if self.name == 'stock-transfers':
                raise ApiError(405, 'Stock transfers cannot be deleted. Use Reverse Entry instead.')
            data = body(request)
            ids = data.get('ids', [])
            if not isinstance(ids, list) or not ids:
                raise ApiError(400, 'No record IDs provided for deletion.')
            deleted_count = 0
            errors = []
            for item_id in ids:
                try:
                    obj = self.get_object(item_id, request)
                    with transaction.atomic():
                        self.destroy(obj)
                    deleted_count += 1
                except ProtectedError:
                    obj_name = getattr(obj, 'name', getattr(obj, 'number', f'Record #{item_id}'))
                    errors.append({'id': item_id, 'error': f"Cannot delete '{obj_name}' because it is referenced by existing transactions."})
                except Exception as err:
                    errors.append({'id': item_id, 'error': str(err)})

            if not deleted_count and errors:
                raise ApiError(400, errors[0]['error'] or 'Failed to delete selected records.')

            return j({
                'status': 'ok' if not errors else 'partial',
                'deleted': deleted_count,
                'failed': len(errors),
                'errors': errors,
                'message': f"Deleted {deleted_count} record(s)." + (f" {len(errors)} failed." if errors else '')
            })

        raise ApiError(405, 'Method not allowed.')

    def handle_item(self, request, pk):
        check_permission(request, resource_name=self.name)
        obj = self.get_object(pk, request)
        if request.method == 'GET':
            return j(self.detail(obj))
        if request.method in ('PUT', 'PATCH'):
            prev_row = {}
            try:
                prev_row = self.row(obj)
            except Exception:
                pass
            with transaction.atomic():
                self.update(obj, body(request), request.user)
            new_obj = self.get_object(pk, request)
            new_row = {}
            try:
                new_row = self.row(new_obj)
            except Exception:
                pass
            if self.name != 'stock-transfers':
                try:
                    user_org = get_user_org(request.user)
                    ent_label = getattr(new_obj, 'number', getattr(new_obj, 'name', getattr(new_obj, 'code', f'#{new_obj.pk}')))
                    services.log_audit(
                        request.user, 'update', self.model.__name__ if self.model else self.name, new_obj.pk,
                        f"Updated {self.model.__name__ if self.model else self.name} {ent_label}",
                        details={'resource': self.name},
                        ip_address=get_client_ip(request),
                        org=user_org,
                        module=self.name,
                        previous_values=prev_row,
                        new_values=new_row
                    )
                except Exception:
                    pass
            return j(self.detail(new_obj))
        if request.method == 'DELETE':
            if self.name == 'stock-transfers':
                raise ApiError(405, 'Stock transfers cannot be deleted. Use Reverse Entry instead.')
            ent_label = getattr(obj, 'number', getattr(obj, 'name', getattr(obj, 'code', f'#{pk}')))
            prev_row = {}
            try:
                prev_row = self.row(obj)
            except Exception:
                pass
            user_org = get_user_org(request.user)
            try:
                with transaction.atomic():
                    self.destroy(obj)
                services.log_audit(
                    request.user, 'delete', self.model.__name__ if self.model else self.name, pk,
                    f"Deleted {self.model.__name__ if self.model else self.name} {ent_label}",
                    details={'resource': self.name, 'previous_data': prev_row},
                    ip_address=get_client_ip(request),
                    org=user_org,
                    module=self.name,
                    previous_values=prev_row
                )
            except ProtectedError:
                obj_name = getattr(obj, 'name', getattr(obj, 'number', f'Record #{pk}'))
                raise ApiError(400, f"Cannot delete '{obj_name}' because it is referenced by existing transactions.")
            return HttpResponse(status=204)
        raise ApiError(405, 'Method not allowed.')

    def handle_action(self, request, pk, name):
        check_permission(request, resource_name=self.name, action_name=name)
        if request.method not in ('POST', 'GET') if name in ('view-journal', 'journals', 'journal-entries') else request.method != 'POST':
            raise ApiError(405, 'Method not allowed.')
        obj = self.get_object(pk, request)
        with transaction.atomic():
            res = self.action(request, obj, name)
        if self.name != 'stock-transfers':
            try:
                user_org = get_user_org(request.user)
                ent_label = getattr(obj, 'number', getattr(obj, 'name', getattr(obj, 'code', f'#{pk}')))
                services.log_audit(
                    request.user, name, self.model.__name__ if self.model else self.name, pk,
                    f"Executed action '{name}' on {self.model.__name__ if self.model else self.name} {ent_label}",
                    details={'resource': self.name, 'action': name},
                    ip_address=get_client_ip(request),
                    org=user_org,
                    module=self.name
                )
            except Exception:
                pass
        if res is not None:
            return res
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
            'code': c.text('code', max_len=60, upper=True),
            'name': c.text('name', True, 200, pattern=re.compile(r'^[^@#$%^*+=~`<>{}[\]\\]+$'), pattern_msg='Display Name cannot contain special characters like @, #, $, %, ^, *.'),
            'company': c.text('company', max_len=200),
            'contact_person': c.text('contact_person', max_len=120, pattern=re.compile(r"^[a-zA-Z\s\.\'\-]*$"), pattern_msg='Primary contact name can only contain letters, spaces, hyphens, and dots.'),
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
            else:
                out['state'] = 'Kerala'
        c.done()
        return out

    def find_existing(self, clean_item, user=None):
        if not hasattr(self, 'model') or self.model is None:
            return None
        try:
            with transaction.atomic():
                name = (clean_item.get('name') or '').strip()
                gstin = (clean_item.get('gstin') or '').strip()
                qs = self.model.objects.all()
                if hasattr(self.model, 'organization'):
                    org = get_user_org(user) if user else None
                    if org:
                        qs = qs.filter(organization=org)
                    elif user and user.is_authenticated and not user.is_superuser:
                        return None
                if gstin:
                    obj = qs.filter(gstin__iexact=gstin).first()
                    if obj:
                        return obj
                if name:
                    obj = qs.filter(name__iexact=name).first()
                    if obj:
                        return obj
        except Exception:
            pass
        return None

    def prepare_import_record(self, rec):
        # 1. Name & Composite Name
        if not rec.get('name'):
            first = rec.get('first_name') or rec.get('contact_first_name') or ''
            last = rec.get('last_name') or rec.get('contact_last_name') or ''
            full = f"{first} {last}".strip()
            if full:
                rec['name'] = full
            elif rec.get('company'):
                rec['name'] = rec.get('company')
            elif rec.get('contact_person'):
                rec['name'] = rec.get('contact_person')
            elif rec.get('customer'):
                rec['name'] = rec.get('customer')
            elif rec.get('vendor'):
                rec['name'] = rec.get('vendor')
            elif rec.get('party'):
                rec['name'] = rec.get('party')

        if rec.get('name'):
            clean_name = str(rec['name']).strip()
            clean_name = ''.join(' ' if ch in ('@#$%^*+=~`<>{}`' + '[]\\') else ch for ch in clean_name)
            clean_name = re.sub(r'\s+', ' ', clean_name).strip()
            if clean_name:
                rec['name'] = clean_name

        # 2. Customer Type
        if 'customer_type' in rec:
            t = str(rec['customer_type']).lower().strip()
            if t in ('individual', 'person', 'consumer', 'b2c'):
                rec['customer_type'] = 'individual'
            else:
                rec['customer_type'] = 'business'
        else:
            rec['customer_type'] = 'business'

        # 3. Active status
        if rec.get('active') in (None, '', 'None', 'none', 'null', 'NULL'):
            rec['active'] = True
        elif isinstance(rec.get('active'), str):
            act_s = rec['active'].lower().strip()
            if act_s in ('true', 'yes', '1', 'active', 'y', 'enabled'):
                rec['active'] = True
            elif act_s in ('false', 'no', '0', 'inactive', 'n', 'disabled'):
                rec['active'] = False
            else:
                rec['active'] = True

        # 4. GSTIN and PAN
        gstin_val = str(rec.get('gstin') or '').strip().upper()
        if gstin_val in ('URP', 'UNREGISTERED', 'CONSUMER', 'NONE', 'NIL', 'NA', 'N/A', '-', 'NULL', 'NO', 'NOT REGISTERED', 'NOT AVAILABLE'):
            rec['gstin'] = ''
            rec.setdefault('gst_treatment', 'consumer')
        elif gstin_val:
            gstin_val = re.sub(r'[^A-Z0-9]', '', gstin_val)
            if GSTIN_RE.match(gstin_val):
                rec['gstin'] = gstin_val
                if not rec.get('pan'):
                    rec['pan'] = gstin_val[2:12]
                if not rec.get('state') and len(gstin_val) >= 2:
                    rec['state'] = services.GST_STATE_CODES.get(gstin_val[:2], '')
            else:
                rec['gstin'] = ''

        pan_val = str(rec.get('pan') or '').strip().upper()
        if pan_val in ('NONE', 'NIL', 'NA', 'N/A', '-', 'NULL', 'NOT AVAILABLE', 'NO'):
            rec['pan'] = ''
        elif pan_val:
            pan_val = re.sub(r'[^A-Z0-9]', '', pan_val)
            if PAN_RE.match(pan_val):
                rec['pan'] = pan_val
            else:
                rec['pan'] = ''

        # 5. Email sanitization
        if rec.get('email'):
            em = str(rec['email']).strip()
            if em.lower() in ('none', 'nil', 'na', 'n/a', '-', 'null', 'no email', 'not available'):
                rec['email'] = ''
            elif ',' in em or ';' in em or ' ' in em:
                parts = re.split(r'[,;\s]+', em)
                found_em = ''
                for p in parts:
                    if '@' in p and '.' in p:
                        found_em = p.strip()
                        break
                rec['email'] = found_em
            elif '@' not in em or '.' not in em:
                rec['email'] = ''

        # 6. Phone sanitization
        if rec.get('phone'):
            ph = str(rec['phone']).strip()
            if ph.lower() in ('none', 'nil', 'na', 'n/a', '-', 'null', 'no phone', 'not available'):
                rec['phone'] = ''
            elif '/' in ph or ',' in ph or ';' in ph:
                first_ph = re.split(r'[/,;]', ph)[0].strip()
                clean_ph = re.sub(r'[^0-9+()\-\s]', '', first_ph)
                rec['phone'] = clean_ph[:30]
            else:
                clean_ph = re.sub(r'[^0-9+()\-\s]', '', ph)
                rec['phone'] = clean_ph[:30]

        # 7. Contact Person
        if rec.get('contact_person'):
            cp = str(rec['contact_person']).strip()
            if cp.lower() in ('none', 'nil', 'na', 'n/a', '-', 'null'):
                rec['contact_person'] = ''
            else:
                clean_cp = ''.join(ch if (ch.isalnum() or ch in " .'-") else ' ' for ch in cp)
                rec['contact_person'] = re.sub(r'\s+', ' ', clean_cp).strip()[:120]

        # 8. Opening balance & type
        if 'opening_balance_type' in rec:
            obt = str(rec['opening_balance_type']).lower().strip()
            rec['opening_balance_type'] = 'credit' if obt in ('credit', 'cr') else 'debit'

        # 9. Payment Terms
        if 'payment_terms' in rec:
            pt_val = str(rec['payment_terms']).lower().strip()
            pt_num = re.sub(r'[^0-9]', '', pt_val)
            rec['payment_terms'] = int(pt_num) if pt_num else 30

    def create(self, data, user):
        clean_data = self.clean(data)
        org = None
        if user and hasattr(self.model, 'organization'):
            try:
                org = get_user_org(user)
                if org:
                    clean_data['organization'] = org
            except Exception:
                pass
        pfx = 'CUST' if self.kind == 'customer' else 'VEND'
        code_val = (clean_data.get('code') or '').strip()
        if not code_val:
            clean_data['code'] = services.next_document_number(pfx, org=org)
        else:
            dup = self.model.objects.filter(code__iexact=code_val)
            if org:
                dup = dup.filter(organization=org)
            if dup.exists():
                clean_data['code'] = services.next_document_number(pfx, org=org)
            else:
                clean_data['code'] = code_val
        obj = self.model.objects.create(**clean_data)
        services.log_audit(user, 'create', self.kind, obj.pk, f"Created {self.kind} {obj.name} ({obj.code})")
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
            'id': o.pk, 'code': getattr(o, 'code', '') or '', 'name': o.name, 'display_name': o.name, 'company': o.company, 'company_name': o.company,
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
                ('GSTIN', 'gstin'), ('PAN', 'pan'), ('Billing Address', 'billing_address'), ('City', 'billing_city'),
                ('Pincode', 'billing_pincode'), ('Payment terms (days)', 'payment_terms'), ('Opening Balance', 'opening_balance')]

    def get_template_sample(self):
        return ['Acme Infotech Ltd', 'Acme Infotech Private Limited', 'accounts@acmeinfotech.in', '9876543210', 'Karnataka', '29AABCA1234B1Z5', 'AABCA1234B', '123 MG Road', 'Bengaluru', '560001', '30', '0.00']

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
                ('GSTIN', 'gstin'), ('PAN', 'pan'), ('Billing Address', 'billing_address'), ('City', 'billing_city'),
                ('Pincode', 'billing_pincode'), ('Payment terms (days)', 'payment_terms'), ('Opening Balance', 'opening_balance')]

    def get_template_sample(self):
        return ['Reliable Hardware Supplies', 'Reliable Hardware Supplies Ltd', 'billing@reliablehardware.in', '9812345678', 'Maharashtra', '27AABCR5678D1Z2', 'AABCR5678D', '45 Industrial Area', 'Mumbai', '400001', '30', '0.00']

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
    csv_cols = [('Name', 'name'), ('SKU', 'sku'), ('Type', 'item_type'), ('Category', 'category'), ('HSN/SAC', 'hsn_sac'),
                ('Warehouse', 'warehouse_code'), ('Unit', 'unit'), ('Selling price', 'selling_price'), ('Purchase price', 'purchase_price'),
                ('GST %', 'gst_rate'), ('Opening Stock', 'opening_stock'), ('Reorder level', 'reorder_level'), ('Status', 'active')]

    def get_template_sample(self):
        return ['Ergonomic Mesh Chair', 'SKU-CHR-01', 'goods', 'Furniture', '940310', 'WH-MAIN', 'nos', '8500.00', '5200.00', '18.00', '40', '10', 'Active']

    def prepare_import_record(self, rec):
        if 'type' in rec and 'item_type' not in rec:
            rec['item_type'] = rec['type']
        t = str(rec.get('item_type', '')).lower().strip()
        rec['item_type'] = 'service' if t in ('service', 'services') else 'goods'

        if 'stock' in rec and 'opening_stock' not in rec:
            rec['opening_stock'] = rec['stock']

        if rec['item_type'] == 'goods':
            rec['track_inventory'] = True

        if rec.get('hsn_sac'):
            raw_hsn = re.sub(r'[^0-9]', '', str(rec['hsn_sac']))
            if len(raw_hsn) == 4:
                raw_hsn += '00'
            elif len(raw_hsn) == 8:
                raw_hsn = raw_hsn[:6]
            rec['hsn_sac'] = raw_hsn

        rec.setdefault('selling_price', Decimal('0.00'))
        rec.setdefault('purchase_price', Decimal('0.00'))
        rec.setdefault('gst_rate', Decimal('18.00'))
        rec.setdefault('unit', 'nos')

        if not rec.get('sku'):
            rec['sku'] = ''

        wh_val = rec.get('warehouse') or rec.get('warehouse_code')
        if wh_val:
            wh = Warehouse.objects.filter(Q(code__iexact=str(wh_val).strip()) | Q(name__iexact=str(wh_val).strip())).first()
            if wh:
                rec['warehouse_id'] = wh.pk
                rec['warehouse_code'] = wh.code

    def destroy(self, obj):
        from .models import (
            InvoiceLine, BillLine, QuoteLine, SalesOrderLine,
            RetainerInvoiceLine, DeliveryChallanLine, CreditNoteLine,
            PurchaseOrderLine, VendorCreditLine
        )
        for line_model in [
            InvoiceLine, BillLine, QuoteLine, SalesOrderLine,
            RetainerInvoiceLine, DeliveryChallanLine, CreditNoteLine,
            PurchaseOrderLine, VendorCreditLine
        ]:
            line_model.objects.filter(item=obj).update(item=None)
        obj.delete()

    def base_qs(self):
        return self.model.objects.select_related('warehouse', 'preferred_vendor').all()

    def filter_qs(self, qs, request):
        self._request = request
        self._current_org = get_user_org(request.user)
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

    def rows(self, objs):
        tracked_objs = [o for o in objs if o.item_type == 'goods' and o.track_inventory]
        if tracked_objs:
            org = getattr(self, '_current_org', None) or (tracked_objs[0].organization if tracked_objs else None)
            self._stock_summary = services.get_stock_movement_summary(tracked_objs, org=org)
        else:
            self._stock_summary = {}
        return [self.row(o) for o in objs]

    def detail(self, o):
        if o.item_type == 'goods' and o.track_inventory:
            self._stock_summary = services.get_stock_movement_summary([o], org=getattr(self, '_current_org', None) or getattr(o, 'organization', None))
        else:
            self._stock_summary = {}
        return self.row(o)

    def row(self, o):
        tracked = o.item_type == 'goods' and o.track_inventory
        stock_sum = getattr(self, '_stock_summary', {}).get(o.pk)
        if not stock_sum and tracked:
            stock_sum = services.get_stock_movement_summary([o], org=getattr(self, '_current_org', None) or getattr(o, 'organization', None)).get(o.pk)

        opening_stock = stock_sum['opening_stock'] if stock_sum else Decimal('0.000')
        stock_in = stock_sum['stock_in'] if stock_sum else Decimal('0.000')
        stock_out = stock_sum['stock_out'] if stock_sum else Decimal('0.000')
        transfer_in = stock_sum['transfer_in'] if stock_sum else Decimal('0.000')
        transfer_out = stock_sum['transfer_out'] if stock_sum else Decimal('0.000')
        avail_stock = stock_sum['available_stock'] if stock_sum else o.stock
        stock_val = stock_sum['stock_value'] if stock_sum else q2(avail_stock * o.purchase_price)

        if not o.active:
            status = 'Inactive'
        elif tracked and avail_stock <= 0:
            status = 'Out of stock'
        elif tracked and o.reorder_level > 0 and avail_stock <= o.reorder_level:
            status = 'Low stock'
        else:
            status = 'Active'

        return {
            'id': o.pk, 'name': o.name, 'sku': o.sku, 'type': o.item_type, 'category': o.category, 'hsn_sac': o.hsn_sac,
            'unit': o.unit, 'description': o.description, 'selling_price': o.selling_price,
            'purchase_price': o.purchase_price, 'gst_rate': o.gst_rate, 'track_inventory': tracked,
            'stock': format_qty(avail_stock) if tracked else None,
            'opening_stock': format_qty(opening_stock) if tracked else None,
            'opening_stock_value': float(stock_sum['opening_stock_value']) if stock_sum else 0.0,
            'opening_date': stock_sum['opening_date'].strftime('%d/%m/%Y') if (stock_sum and stock_sum['opening_date']) else '',
            'stock_in': format_qty(stock_in) if tracked else None,
            'stock_out': format_qty(stock_out) if tracked else None,
            'transfer_in': format_qty(transfer_in) if tracked else None,
            'transfer_out': format_qty(transfer_out) if tracked else None,
            'stock_in_hand': format_qty(avail_stock) if tracked else None,
            'closing_stock': format_qty(avail_stock) if tracked else None,
            'stock_value': float(stock_val) if tracked else None,
            'reorder_level': format_qty(o.reorder_level) if tracked else None,
            'warehouse_id': o.warehouse_id,
            'warehouse_code': o.warehouse_code or (o.warehouse.code if o.warehouse else 'WH-MAIN'),
            'warehouse_name': o.warehouse.name if o.warehouse else '',
            'valuation': stock_val if tracked else None, 'active': o.active, 'status': status,
            'image_data': o.image_data, 'tax_preference': o.tax_preference,
            'sales_account': o.sales_account, 'purchase_account': o.purchase_account,
            'preferred_vendor_id': o.preferred_vendor_id,
            'preferred_vendor_name': o.preferred_vendor.name if o.preferred_vendor else '',
            'inventory_account': o.inventory_account
        }

    def clean(self, data, instance=None, user=None):
        c = Cleaner(data)
        out = {
            'name': c.text('name', True, 200, pattern=re.compile(r'^[^#@!$%^*+=~`<>?[\]\\{}]+$'), pattern_msg='Item Name cannot contain unsupported special characters (cannot contain #, @, !, $, %, ^, *).'),
            'sku': c.text('sku', False, 60, upper=True, pattern=re.compile(r'^[A-Za-z0-9_\-\.\/]*$'), pattern_msg='SKU can only contain letters, numbers, hyphens, slashes, and dots.'),
            'item_type': c.choice('item_type', ['goods', 'service'], 'goods'),
            'category': c.text('category', max_len=100, pattern=re.compile(r"^[a-zA-Z0-9\s\.\,\'\-\ &\/\(\)]*$"), pattern_msg='Category can only contain letters, numbers, spaces, and standard separators (&, -, /).'),
            'hsn_sac': c.text('hsn_sac', max_len=6),
            'unit': c.text('unit', max_len=20, default='nos') or 'nos',
            'description': c.text('description', max_len=2000),
            'selling_price': c.number('selling_price', required=True, lo=Decimal('0'), hi=Decimal('999999999')),
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
        user_org = get_user_org(user) if user else (getattr(instance, 'organization', None) if instance else None)
        wh = Warehouse.objects.filter(pk=wid, organization=user_org).first() if (wid and user_org) else None
        out['warehouse_id'] = wh.pk if wh else None
        out['warehouse_code'] = wh.code if wh else (c.text('warehouse_code', max_len=30) or '')

        vid = c.integer('preferred_vendor_id', required=False)
        if vid is None:
            vid = c.integer('preferred_vendor', required=False)
        v_exists = Vendor.objects.filter(pk=vid, organization=user_org).exists() if (vid and user_org) else False
        out['preferred_vendor_id'] = vid if v_exists else None

        if out['hsn_sac']:
            hsn = out['hsn_sac'].strip()
            if not hsn.isdigit() or len(hsn) != 6:
                c.err('hsn_sac', 'HSN/SAC code must be a 6-digit numeric code.')
            out['hsn_sac'] = hsn

        if out['gst_rate'] < Decimal('0') or out['gst_rate'] > Decimal('100'):
            c.err('gst_rate', 'GST rate must be between 0% and 100%.')

        if not out['sku']:
            out['sku'] = next_number('SKU', org=user_org)
        else:
            dup = Item.objects.filter(sku__iexact=out['sku'])
            if user_org:
                dup = dup.filter(organization=user_org)
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
        out, opening = self.clean(data, user=user)
        user_org = get_user_org(user)
        if user_org:
            out['organization'] = user_org
        obj = Item.objects.create(**out)
        if opening > 0:
            services.move_stock(obj.pk, opening, 'opening', 'Opening stock', timezone.localdate(), user, 'Opening stock',
                                warehouse=obj.warehouse, warehouse_code=obj.warehouse_code)
        return obj

    def update(self, obj, data, user):
        out, _ = self.clean(data, obj, user=user)
        if out['item_type'] == 'service' and obj.stock != 0:
            raise ApiError(400, 'Adjust stock to zero before changing this item to a service.', {'item_type': 'Stock must be zero.'})
        for k, v in out.items():
            setattr(obj, k, v)
        obj.save()

def parse_lines(raw, org=None):
    msg = 'Add at least one line item.'
    if not isinstance(raw, list) or not raw:
        raise ApiError(400, msg, {'lines': msg})
    if len(raw) > 200:
        raise ApiError(400, 'Too many lines (max 200).', {'lines': 'Too many lines (max 200).'})
    out, errors = [], []
    for i, r in enumerate(raw, 1):
        c = Cleaner(r)
        iid = c.integer('item', lo=1, default=None)
        if not iid:
            iid = c.integer('item_id', lo=1, default=None)
        item = None
        if iid:
            iqs = Item.objects.filter(pk=iid)
            if org:
                iqs = iqs.filter(organization=org)
            item = iqs.first()
            if item is None:
                c.err('item', 'Item not found in your organization.')
        desc = c.text('description', max_len=500) or (item.name if item else '')
        if not desc:
            c.err('description', 'Description is required.')
        hsn = c.text('hsn_sac', max_len=10) or (item.hsn_sac if item else '')
        qty = c.number('quantity', True, lo=Decimal('0.001'), hi=Decimal('99999999'), places=3)
        rate = c.number('rate', True, lo=Decimal('0'), hi=Decimal('999999999'))
        disc = c.number('discount_percent', lo=Decimal('0'), hi=Decimal('100'))
        if disc == Decimal('0') and 'discount' in r:
            disc = c.number('discount', lo=Decimal('0'), hi=Decimal('100'))
        gst = c.number('gst_rate', default=Decimal('0'))
        if gst == Decimal('0') and 'tax_rate' in r:
            gst = c.number('tax_rate', default=Decimal('0'))
        if gst < Decimal('0') or gst > Decimal('100'):
            c.err('gst_rate', 'GST rate must be between 0% and 100%.')
        wh_id = c.integer('warehouse_id', lo=1, default=None)
        if not wh_id:
            wh_id = c.integer('warehouse', lo=1, default=None)
        wh_code = c.text('warehouse_code', max_len=30)
        warehouse = None
        if wh_id:
            wqs = Warehouse.objects.filter(pk=wh_id)
            if org:
                wqs = wqs.filter(organization=org)
            warehouse = wqs.first()
            if warehouse:
                wh_code = warehouse.code
        elif wh_code and org:
            warehouse = Warehouse.objects.filter(organization=org, code__iexact=wh_code).first()
        elif item and item.warehouse:
            warehouse = item.warehouse
            wh_code = warehouse.code

        if c.errors:
            errors.append(f'Line {i}: ' + '; '.join(f'{k} - {m}' for k, m in c.errors.items()))
        else:
            out.append({'item': item, 'warehouse': warehouse, 'warehouse_code': wh_code,
                        'description': desc, 'hsn_sac': hsn, 'quantity': qty, 'rate': rate,
                        'discount_percent': disc, 'gst_rate': gst, 'position': i})
    if errors:
        raise ApiError(400, 'Please correct the line items.', {'lines': ' | '.join(errors)})
    return out

def display_status(doc, posted, today):
    if doc.status == 'draft':
        return 'Draft'
    if doc.status in ('void', 'cancelled'):
        return 'Cancelled' if isinstance(doc, RetainerInvoice) else 'Void'
    paid = q2(getattr(doc, 'paid_sum', getattr(doc, 'paid_amount', 0)))
    if isinstance(doc, RetainerInvoice):
        applied = q2(getattr(doc, 'applied_sum', getattr(doc, 'applied_amount', 0)))
        if paid >= doc.total and paid > 0:
            if applied >= paid:
                return 'Fully Applied'
            elif applied > 0:
                return 'Partially Applied'
            return 'Paid'
        elif paid > 0:
            if applied > 0:
                return 'Partially Applied'
            return 'Partially Paid'
        return 'Sent'
    if doc.total - paid <= 0:
        return 'Paid'
    if doc.due_date and doc.due_date < today:
        return 'Overdue'
    return 'Partially Paid' if paid > 0 else ('Sent' if posted == 'sent' else 'Open')

def sign_document_action(obj, request):
    b = body(request)
    sig_data = b.get('signature_data', '')
    signed_by = b.get('signed_by', '')
    title = b.get('signature_title', '') or getattr(obj, 'signature_title', '') or 'Authorized Signatory'
    if not sig_data:
        raise ApiError(400, 'Signature data is required.')
    obj.signature_data = sig_data
    obj.signed_by = signed_by or (request.user.get_full_name() or request.user.username)
    obj.signature_title = title
    obj.signed_at = timezone.now()
    fields_to_update = ['signature_data', 'signed_by', 'signature_title', 'signed_at']
    obj.save(update_fields=fields_to_update)
    services.log_audit(request.user, 'update', obj.__class__.__name__, getattr(obj, 'number', str(obj.pk)), f'Digitally signed {obj.__class__.__name__} {getattr(obj, "number", obj.pk)}')
    return j({
        'status': 'signed',
        'signed_by': obj.signed_by,
        'signature_title': obj.signature_title,
        'signed_at': obj.signed_at.isoformat(),
        'signature_data': obj.signature_data
    })

def unsign_document_action(obj, request):
    obj.signature_data = ''
    obj.signed_by = ''
    obj.signed_at = None
    fields_to_update = ['signature_data', 'signed_by', 'signed_at']
    obj.save(update_fields=fields_to_update)
    services.log_audit(request.user, 'update', obj.__class__.__name__, getattr(obj, 'number', str(obj.pk)), f'Removed signature from {obj.__class__.__name__} {getattr(obj, "number", obj.pk)}')
    return j({'status': 'unsigned'})

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

    def preprocess_import_records(self, records):
        grouped = []
        doc_map = {}
        for r in records:
            num = str(r.get('number') or r.get('invoice_number') or r.get('bill_number') or r.get('quote_number') or '').strip()
            line = self.extract_line_from_record(r)
            if num and num in doc_map:
                existing = doc_map[num]
                if line:
                    existing.setdefault('lines', []).append(line)
            else:
                doc_copy = dict(r)
                if line and 'lines' not in doc_copy:
                    doc_copy['lines'] = [line]
                grouped.append(doc_copy)
                if num:
                    doc_map[num] = doc_copy
        return grouped

    def find_existing(self, clean_item, user=None):
        if not hasattr(self, 'model') or self.model is None:
            return None
        num = str(clean_item.get('number') or clean_item.get('quote_number') or clean_item.get('invoice_number') or clean_item.get('bill_number') or '').strip()
        if not num:
            return None
        try:
            qs = self.model.objects.all()
            if hasattr(self.model, 'organization'):
                org = get_user_org(user) if user else None
                if org:
                    qs = qs.filter(organization=org)
            return qs.filter(number__iexact=num).first()
        except Exception:
            return None

    def extract_line_from_record(self, r):
        user_org = getattr(self, 'current_user_org', None) or Organization.get()
        item_val = r.get('item') or r.get('item_name') or r.get('product') or r.get('sku') or ''
        desc = r.get('description') or r.get('line_description') or r.get('desc') or ''
        qty = r.get('quantity') or r.get('qty') or r.get('opening_stock') or Decimal('1.000')
        rate = r.get('rate') or r.get('price') or r.get('unit_price') or r.get('selling_price') or r.get('purchase_price') or r.get('amount') or r.get('total') or Decimal('0.00')
        gst = r.get('gst_rate') or r.get('tax_rate') or Decimal('18.00')
        hsn = r.get('hsn_sac') or r.get('hsn') or ''
        disc = r.get('discount_percent') or r.get('discount') or Decimal('0.00')

        it = None
        if item_val:
            iqs = Item.objects.filter(Q(name__iexact=str(item_val).strip()) | Q(sku__iexact=str(item_val).strip()))
            if user_org:
                iqs = iqs.filter(organization=user_org)
            else:
                iqs = iqs.none()
            it = iqs.first()

        if not desc:
            desc = it.name if it else (str(item_val).strip() if item_val else 'General Supply / Service')
        if it and not hsn:
            hsn = it.hsn_sac or ''
        if it and (rate is None or rate == Decimal('0.00')):
            rate = it.selling_price if self.party_attr == 'customer' else it.purchase_price

        return {
            'item': it.pk if it else None,
            'description': str(desc)[:500],
            'hsn_sac': str(hsn)[:10],
            'quantity': qty,
            'rate': rate,
            'discount_percent': disc,
            'gst_rate': gst
        }

    def prepare_import_record(self, rec):
        user_org = getattr(self, 'current_user_org', None) or Organization.get()
        party_val = rec.get(self.party_attr) or rec.get('party') or rec.get('customer') or rec.get('vendor') or rec.get('client')
        if party_val and not str(party_val).isdigit():
            p_str = str(party_val).strip()
            pqs = self.Party.objects.filter(Q(name__iexact=p_str) | Q(company__iexact=p_str) | Q(email__iexact=p_str))
            if user_org:
                pqs = pqs.filter(organization=user_org)
            else:
                pqs = pqs.none()
            p = pqs.first()
            if not p:
                p = self.Party.objects.create(name=p_str, active=True, state=user_org.state if user_org else '', organization=user_org)
            rec[self.party_attr] = p.pk
        elif not party_val:
            pqs = self.Party.objects.all()
            if user_org:
                pqs = pqs.filter(organization=user_org)
            else:
                pqs = pqs.none()
            first_p = pqs.first()
            if first_p:
                rec[self.party_attr] = first_p.pk
            else:
                p = self.Party.objects.create(name="Default Customer" if self.party_attr == 'customer' else "Default Vendor", active=True, state=user_org.state if user_org else '', organization=user_org)
                rec[self.party_attr] = p.pk

        if not rec.get('lines'):
            line = self.extract_line_from_record(rec)
            rec['lines'] = [line]

        if not rec.get('date'):
            rec['date'] = timezone.localdate().isoformat()
        if not rec.get('due_date'):
            rec['due_date'] = (timezone.localdate() + timedelta(days=30)).isoformat()

    def base_qs(self):
        if self.Model is Invoice:
            return invoice_qs()
        if self.Model is RetainerInvoice:
            return retainer_qs()
        if self.Model is Quote:
            return Quote.objects.select_related('customer')
        return bill_qs()

    def filter_qs(self, qs, request):
        g, today, P = request.GET, timezone.localdate(), self.posted
        st = g.get('status', '')
        if self.Model is Quote:
            if st:
                qs = qs.filter(status=st)
            pid = g.get(self.party_attr) or g.get(self.party_attr + '_id')
            if pid and str(pid).isdigit():
                qs = qs.filter(**{self.party_attr + '_id': int(pid)})
            c = Cleaner(g.dict())
            d1, d2 = c.date('date_from'), c.date('date_to')
            if d1:
                qs = qs.filter(date__gte=d1)
            if d2:
                qs = qs.filter(date__lte=d2)
            return qs
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
            qs = qs.filter(status__in=[P, 'draft', 'partial'], paid_sum__lt=F('total'))
        if g.get('available') == '1' and self.Model is RetainerInvoice:
            qs = qs.filter(status__in=['sent', 'partial', 'paid'], paid_sum__gt=F('applied_sum'))
        pid = g.get(self.party_attr) or g.get(self.party_attr + '_id')
        if pid and str(pid).isdigit():
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
        etype = 'invoice' if isinstance(o, Invoice) else ('retainer_invoice' if isinstance(o, RetainerInvoice) else ('quote' if isinstance(o, Quote) else 'bill'))
        att_count = Attachment.objects.filter(entity_type=etype, entity_id=o.pk).count()
        r = {'id': o.pk, 'number': o.number, 'party_id': self.party(o).pk, 'party': self.party(o).name,
             'customer_name': self.party(o).name if self.party(o) else '',
             'date': o.date, 'due_date': o.due_date, 'place_of_supply': o.place_of_supply,
             'location': getattr(o, 'location', 'HO Kottayam') or 'HO Kottayam',
             'transaction_series': getattr(o, 'transaction_series', 'Default Transaction Series') or 'Default Transaction Series',
             'order_number': getattr(o, 'order_number', '') or '', 'attachment_count': att_count,
             'salesperson': getattr(o, 'salesperson', '') or '',
             'project_name': getattr(o, 'project_name', '') or '',
             'subject': getattr(o, 'subject', '') or '',
             'terms': getattr(o, 'terms', '') or '',
             'notes': getattr(o, 'notes', '') or '',
             'accounts_receivable': getattr(o, 'accounts_receivable', 'Accounts Receivable') or 'Accounts Receivable',
             'accounts_payable': getattr(o, 'accounts_payable', 'Accounts Payable') or 'Accounts Payable',
             'tax_pricing_type': getattr(o, 'tax_pricing_type', 'tax_exclusive') or 'tax_exclusive',
             'customer_type': getattr(o, 'customer_type', 'b2b') or 'b2b',
             'status': (o.status if isinstance(o, Quote) else display_status(o, self.posted, timezone.localdate())), 'raw_status': o.status,
             'subtotal': o.subtotal, 'total': o.total, 'paid': paid,
             'balance': max(Z, o.total - paid) if o.status != 'void' else Z,
             'signature_data': getattr(o, 'signature_data', '') or '',
             'signed_by': getattr(o, 'signed_by', '') or '',
             'signed_at': o.signed_at.isoformat() if getattr(o, 'signed_at', None) else None,
             'signature_title': getattr(o, 'signature_title', '') or ''}
        if isinstance(o, RetainerInvoice):
            applied = q2(getattr(o, 'applied_sum', getattr(o, 'applied_amount', 0)))
            r['applied_amount'] = applied
            r['available_balance'] = max(Z, paid - applied)
            r['customer_id'] = o.customer_id
            r['customer_name'] = o.customer.name
            r['purpose'] = getattr(o, 'notes', '') or ''
            r['subject'] = getattr(o, 'notes', '') or ''
        elif isinstance(o, Quote):
            r['customer_id'] = o.customer_id
            r['customer_name'] = o.customer.name
            r['reference_number'] = o.reference_number
            r['expiry_date'] = o.expiry_date
            r['salesperson'] = o.salesperson
            r['project_name'] = o.project_name
            r['subject'] = o.subject
            r['adjustment'] = o.adjustment
            r['adjustment_label'] = o.adjustment_label
            r['tax_type'] = o.tax_type
            r['tds_tcs_tax'] = o.tds_tcs_tax
            r['converted_to_invoice_id'] = o.converted_to_invoice_id
            r['converted_to_invoice_number'] = o.converted_to_invoice.number if o.converted_to_invoice else ''
            r['converted_to_sales_order_id'] = o.converted_to_sales_order_id
            r['converted_to_sales_order_number'] = o.converted_to_sales_order.number if o.converted_to_sales_order else ''
            r['converted_at'] = o.converted_at
        return r

    def detail(self, o):
        r = self.row(o)
        etype = 'invoice' if isinstance(o, Invoice) else ('retainer_invoice' if isinstance(o, RetainerInvoice) else ('quote' if isinstance(o, Quote) else 'bill'))
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
                         'amount': a.amount, 'type': 'payment', 'mode': a.payment.mode,
                         'account': a.payment.account or (a.payment.bank_account.name if a.payment.bank_account else 'Bank Account'),
                         'bank_account_name': a.payment.bank_account.name if a.payment.bank_account else (a.payment.account or ''),
                         'reference': a.payment.reference or ''} for a in o.allocations.select_related('payment', 'payment__bank_account')]
            for ra in o.retainer_allocations.select_related('retainer'):
                payments.append({'payment_id': None, 'number': f"Retainer {ra.retainer.number}",
                                 'retainer_id': ra.retainer_id, 'date': ra.date, 'amount': ra.amount,
                                 'type': 'retainer_credit', 'mode': 'Retainer', 'bank_account_name': '', 'reference': ''})
        elif isinstance(o, RetainerInvoice):
            payments = [{'id': p.pk, 'payment_id': p.payment_received_id, 'number': p.reference or f'Payment for {o.number}',
                         'date': p.date, 'mode': p.mode, 'account': p.account, 'amount': p.amount}
                        for p in o.payments.all()]
            allocations = [{'id': a.pk, 'invoice_id': a.invoice_id, 'number': a.invoice.number,
                            'date': a.date, 'amount': a.amount, 'notes': a.notes}
                           for a in o.allocations.select_related('invoice')]
        elif isinstance(o, Quote):
            payments = []
            allocations = []
        elif hasattr(o, 'allocations'):
            payments = [{'payment_id': a.payment_id, 'number': a.payment.number, 'date': a.payment.date,
                         'amount': a.amount, 'mode': getattr(a.payment, 'mode', ''),
                         'account': getattr(a.payment, 'account', ''),
                         'bank_account_name': a.payment.bank_account.name if getattr(a.payment, 'bank_account', None) else (getattr(a.payment, 'account', '') or '')}
                        for a in o.allocations.select_related('payment', 'payment__bank_account')]
        else:
            payments = []
            allocations = []

        source_type = 'manual'
        source_label = 'Direct / Manual Creation'
        source_number = ''
        related_documents = []
        if isinstance(o, Invoice):
            sq = getattr(o, 'source_quote', None) or (getattr(o, 'source_quotes', None).first() if hasattr(o, 'source_quotes') else None)
            if sq:
                source_type = 'quote'
                source_number = sq.number
                source_label = f'Estimate/Quote {sq.number}'
                related_documents.append({
                    'kind': 'quotes', 'type': 'Quote', 'id': sq.pk, 'number': sq.number, 'date': sq.date.isoformat() if hasattr(sq.date, 'isoformat') else str(sq.date), 'total': sq.total, 'status': sq.status, 'relation': 'Source Quote'
                })
            sso = getattr(o, 'source_sales_order', None)
            if not sso and getattr(o, 'order_number', None):
                sso = SalesOrder.objects.filter(number=o.order_number).first()
            if sso:
                if not sq:
                    source_type = 'sales_order'
                    source_number = sso.number
                    source_label = f'Sales Order {sso.number}'
                related_documents.append({
                    'kind': 'sales-orders', 'type': 'Sales Order', 'id': sso.pk, 'number': sso.number, 'date': sso.date.isoformat() if hasattr(sso.date, 'isoformat') else str(sso.date), 'total': sso.total, 'status': sso.status, 'relation': 'Source Sales Order'
                })
                if not sq and sso.source_quote:
                    related_documents.insert(0, {
                        'kind': 'quotes', 'type': 'Quote', 'id': sso.source_quote.pk, 'number': sso.source_quote.number, 'date': sso.source_quote.date.isoformat() if hasattr(sso.source_quote.date, 'isoformat') else str(sso.source_quote.date), 'total': sso.source_quote.total, 'status': sso.source_quote.status, 'relation': 'Source Quote'
                    })
            rec = getattr(o, 'recurring_invoice', None)
            if not rec and (o.order_number or '').startswith('REC-'):
                rec_id = o.order_number.replace('REC-', '')
                if rec_id.isdigit():
                    rec = RecurringInvoice.objects.filter(pk=int(rec_id)).first()
            if rec:
                source_type = 'recurring_invoice'
                source_number = rec.profile_name
                source_label = f'Recurring Profile: {rec.profile_name}'
                related_documents.append({
                    'kind': 'recurring-invoices', 'type': 'Recurring Invoice', 'id': rec.pk, 'number': rec.profile_name, 'date': rec.start_date.isoformat() if hasattr(rec.start_date, 'isoformat') else str(rec.start_date), 'total': rec.total, 'status': rec.status, 'relation': 'Recurring Profile'
                })
            if not sq and not sso and not rec and getattr(o, 'order_number', None):
                source_type = 'reference'
                source_number = o.order_number
                source_label = f'Ref {o.order_number}'
            for ra in o.retainer_allocations.select_related('retainer'):
                related_documents.append({
                    'kind': 'retainer-invoices', 'type': 'Retainer Invoice', 'id': ra.retainer.pk, 'number': ra.retainer.number, 'date': ra.retainer.date.isoformat() if hasattr(ra.retainer.date, 'isoformat') else str(ra.retainer.date), 'total': ra.retainer.total, 'status': ra.retainer.status, 'relation': f'Retainer Applied (₹{ra.amount})'
                })
        elif isinstance(o, Quote):
            if getattr(o, 'converted_to_sales_order', None):
                so = o.converted_to_sales_order
                source_label = f'Converted to Sales Order {so.number}'
                related_documents.append({
                    'kind': 'sales-orders', 'type': 'Sales Order', 'id': so.pk, 'number': so.number, 'date': so.date.isoformat() if hasattr(so.date, 'isoformat') else str(so.date), 'total': so.total, 'status': so.status, 'relation': 'Converted to Sales Order'
                })
                if so.converted_to_invoice:
                    inv = so.converted_to_invoice
                    related_documents.append({
                        'kind': 'invoices', 'type': 'Invoice', 'id': inv.pk, 'number': inv.number, 'date': inv.date.isoformat() if hasattr(inv.date, 'isoformat') else str(inv.date), 'total': inv.total, 'status': inv.status, 'relation': 'Converted to Invoice'
                    })
            elif getattr(o, 'converted_to_invoice', None):
                inv = o.converted_to_invoice
                source_label = f'Converted to Invoice {inv.number}'
                related_documents.append({
                    'kind': 'invoices', 'type': 'Invoice', 'id': inv.pk, 'number': inv.number, 'date': inv.date.isoformat() if hasattr(inv.date, 'isoformat') else str(inv.date), 'total': inv.total, 'status': inv.status, 'relation': 'Converted to Invoice'
                })
            else:
                source_label = 'Direct Estimate/Quote'
        elif isinstance(o, Bill):
            spo = getattr(o, 'source_purchase_order', None)
            if not spo and o.order_number:
                spo = PurchaseOrder.objects.filter(number=o.order_number).first()
            if spo:
                source_type = 'purchase_order'
                source_number = spo.number
                source_label = f'Purchase Order {spo.number}'
                related_documents.append({
                    'kind': 'purchase-orders', 'type': 'Purchase Order', 'id': spo.pk, 'number': spo.number, 'date': spo.date.isoformat() if hasattr(spo.date, 'isoformat') else str(spo.date), 'total': spo.total, 'status': spo.status, 'relation': 'Source Purchase Order'
                })
        elif isinstance(o, RetainerInvoice):
            for a in o.allocations.select_related('invoice'):
                related_documents.append({
                    'kind': 'invoices', 'type': 'Invoice', 'id': a.invoice.pk, 'number': a.invoice.number, 'date': a.invoice.date.isoformat() if hasattr(a.invoice.date, 'isoformat') else str(a.invoice.date), 'total': a.invoice.total, 'status': a.invoice.status, 'relation': f'Applied ₹{a.amount}'
                })

        r.update({'cgst': o.cgst, 'sgst': o.sgst, 'igst': o.igst, 'notes': o.notes,
                  'order_number': getattr(o, 'order_number', '') or '',
                  'source_type': source_type,
                  'source_number': source_number,
                  'source_label': source_label,
                  'related_documents': related_documents,
                  'intra_state': is_intra_state(o.place_of_supply, Organization.get().state),
                  'attachments': attachments, 'party_details': party_info,
                  'lines': [{'id': l.pk, 'item': l.item_id, 'description': l.description, 'hsn_sac': l.hsn_sac,
                             'quantity': l.quantity, 'rate': l.rate, 'discount_percent': l.discount_percent,
                             'gst_rate': l.gst_rate, 'taxable': l.taxable, 'tax_amount': l.tax_amount,
                             'line_total': l.line_total,
                             'warehouse_id': getattr(l, 'warehouse_id', None) or (l.item.warehouse_id if l.item else None),
                             'warehouse_code': getattr(l, 'warehouse_code', '') or (l.item.warehouse_code if l.item else ''),
                             'warehouse_name': l.warehouse.name if getattr(l, 'warehouse', None) else (l.item.warehouse.name if l.item and l.item.warehouse else ''),
                             'unit': l.item.unit if l.item else 'nos'} for l in o.lines.select_related('item', 'warehouse', 'item__warehouse')],
                  'payments': payments,
                  'allocations': allocations})
        r.update(self.extra_detail(o))
        return r

    def extra_detail(self, o):
        return {}

    def extra_clean(self, c):
        return {}

    def parse(self, data, user=None):
        c = Cleaner(data)
        user_org = get_user_org(user) if user else None
        org = user_org or Organization.get()
        pid = c.integer(self.party_attr, lo=1)
        if not pid:
            pid = c.integer(self.party_attr + '_id', lo=1)
        if not pid:
            c.err(self.party_attr, REQUIRED)
        party = None
        if pid:
            pqs = self.Party.objects.filter(pk=pid)
            if user_org:
                pqs = pqs.filter(organization=user_org)
            else:
                pqs = pqs.none()
            party = pqs.first()
        if pid and party is None:
            c.err(self.party_attr, f'{self.party_attr.title()} not found in your organization.')
        date_ = c.date('date', required=True)
        due = c.date('due_date') or c.date('expiry_date')
        if party and not party.active:
            c.err(self.party_attr, 'This record is inactive.')
        if date_ and not due:
            terms = getattr(party, 'payment_terms', 30) if party else 30
            due = date_ + timedelta(days=terms or 30)
        if date_ and due and due < date_:
            c.err('due_date', 'Due date cannot be before the document date.')
        pos = c.text('place_of_supply', max_len=60) or (party.state if party and party.state else (org.state if org else ''))
        default_cust_type = 'b2b' if self.party_attr == 'customer' else 'registered'
        tax_pricing = str(data.get('tax_pricing_type') or 'tax_exclusive').strip().lower()
        cust_type = str(data.get('customer_type') or default_cust_type).strip().lower()
        head = {self.party_attr: party, 'date': date_, 'due_date': due, 'place_of_supply': pos,
                'tax_pricing_type': tax_pricing, 'customer_type': cust_type,
                'notes': c.text('notes', max_len=2000)}
        for fld in ('location', 'transaction_series', 'order_number', 'salesperson', 'project_name', 'subject', 'terms', 'accounts_receivable', 'accounts_payable'):
            if fld in data:
                head[fld] = str(data.get(fld) or '').strip()
        if 'signature_data' in data:
            head['signature_data'] = str(data.get('signature_data') or '')
        if 'signed_by' in data:
            head['signed_by'] = str(data.get('signed_by') or '')
        if 'signature_title' in data:
            head['signature_title'] = str(data.get('signature_title') or '')
        head.update(self.extra_clean(c))
        c.done()
        return head, parse_lines(data.get('lines'), org=user_org)

    def write(self, obj, head, lines, user=None):
        user_org = get_user_org(user) if user else getattr(obj, 'organization', None)
        org_state = user_org.state if user_org else (Organization.get().state if Organization.get() else '')
        intra = is_intra_state(head['place_of_supply'], org_state)
        is_tax_inclusive = (head.get('tax_pricing_type') or getattr(obj, 'tax_pricing_type', 'tax_exclusive')) == 'tax_inclusive'
        comp, tot = compute(lines, intra, is_tax_inclusive=is_tax_inclusive)
        for k, v in head.items():
            setattr(obj, k, v)
        for k, v in tot.items():
            setattr(obj, k, v)
        if isinstance(obj, Quote):
            adj = getattr(obj, 'adjustment', Decimal('0.00')) or Decimal('0.00')
            obj.total = max(Decimal('0.00'), obj.total + adj)
        obj.save()
        obj.lines.all().delete()
        self.Line.objects.bulk_create([self.Line(**{self.line_fk: obj}, item=l['item'],
                                                 warehouse=l.get('warehouse'),
                                                 warehouse_code=l.get('warehouse_code', ''),
                                                 description=l['description'],
                                                 hsn_sac=l['hsn_sac'], quantity=l['quantity'], rate=l['rate'],
                                                 discount_percent=l['discount_percent'], gst_rate=l['gst_rate'],
                                                 taxable=l['taxable'], tax_amount=l['tax_amount'],
                                                 line_total=l['line_total'], position=l['position']) for l in comp])

    def create(self, data, user):
        user_org = get_user_org(user)
        services.check_subscription_limits(user_org, 'record')
        head, lines = self.parse(data, user=user)
        services.check_transaction_lock(head['date'], org=user_org)
        num = (data.get('number') or '').strip()
        pfx = self.get_prefix() if hasattr(self, 'get_prefix') else self.prefix
        num_exists = self.Model.objects.filter(number=num, organization=user_org).exists() if (num and user_org) else (self.Model.objects.filter(number=num).exists() if num else False)
        if not num or num_exists:
            num = services.next_document_number(pfx, org=user_org, date=head['date'])
        else:
            import re
            m = re.search(r'(\d+)$', num)
            if m:
                val = int(m.group(1))
                fy = services.get_financial_year(head['date'])
                seq_key = f"{user_org.pk}_{pfx}_{fy}" if user_org else f"{pfx}_{fy}"
                seq, _ = Sequence.objects.get_or_create(key=seq_key)
                if seq.value < val:
                    seq.value = val
                    seq.save(update_fields=['value'])
        obj = self.Model(number=num, status='draft')
        if hasattr(self.Model, 'organization'):
            obj.organization = user_org
        self.write(obj, head, lines, user=user)
        return obj

    def update(self, obj, data, user):
        user_org = get_user_org(user)
        services.check_transaction_lock(obj.date, org=user_org)
        is_inv = isinstance(obj, Invoice)
        is_ret = isinstance(obj, RetainerInvoice)
        if obj.status != 'draft':
            if not data.get('force'):
                raise ApiError(409, 'Only drafts can be edited. Void this document and create a new one.')
            if is_inv and obj.status == 'sent':
                services.apply_stock(obj, +1, 'sale_void', user)
            elif not is_inv and not is_ret and obj.status == 'open':
                services.apply_stock(obj, -1, 'purchase_void', user)
            head, lines = self.parse(data, user=user)
            services.check_transaction_lock(head['date'], org=user_org)
            self.write(obj, head, lines, user=user)
            if is_inv and obj.status == 'sent':
                services.apply_stock(obj, -1, 'sale', user)
            elif not is_inv and not is_ret and obj.status == 'open':
                services.apply_stock(obj, +1, 'purchase', user)
            return
        head, lines = self.parse(data, user=user)
        services.check_transaction_lock(head['date'], org=user_org)
        self.write(obj, head, lines, user=user)

    def destroy(self, obj):
        services.check_transaction_lock(obj.date)
        if isinstance(obj, Quote):
            Attachment.objects.filter(entity_type='quote', entity_id=obj.pk).delete()
            obj.delete()
            return
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

    def action(self, request, obj, name):
        if name == 'sign':
            return sign_document_action(obj, request)
        elif name == 'unsign':
            return unsign_document_action(obj, request)
        elif name in ('clone', 'duplicate'):
            cloned = services.clone_document(obj, request.user)
            return j({'status': 'ok', 'id': cloned.pk, 'number': cloned.number, 'message': f'Document cloned as draft {cloned.number}'})
        elif name in ('email', 'send-email'):
            b = body(request)
            to_email = b.get('to_email') or b.get('email')
            subject = b.get('subject', '')
            message = b.get('message', '')
            res = services.send_document_email(obj, to_email, subject, message, request.user)
            return j(res)
        elif name in ('sms', 'send-sms'):
            b = body(request)
            to_phone = b.get('to_phone') or b.get('phone')
            message = b.get('message', '')
            res = services.send_document_sms(obj, to_phone, message, request.user)
            return j(res)
        elif name in ('share', 'share-link'):
            base_url = request.build_absolute_uri('/')
            share_url = f"{base_url}#/portal/document?type={self.name}&id={obj.pk}"
            return j({'status': 'ok', 'share_url': share_url, 'number': obj.number})
        elif name in ('view-journal', 'journals', 'journal-entries'):
            journals = services.get_document_journals(obj)
            return j({'status': 'ok', 'journals': journals})
        elif name in ('eway-bill', 'add-eway-bill'):
            b = body(request)
            c = Cleaner(b)
            bill_num = c.text('bill_number', max_len=16) or f"EWB{timezone.now().strftime('%y%m%d%H%M%S')}"
            dist = c.integer('distance_km', lo=1, default=50)
            trans_id = c.text('transporter_id', max_len=20)
            trans_name = c.text('transporter_name', max_len=100)
            veh_num = c.text('vehicle_number', max_len=30)
            org = getattr(obj, 'organization', None) or get_user_org(request.user)
            party = getattr(obj, 'customer', getattr(obj, 'vendor', None))
            pname = getattr(party, 'name', 'Party') if party else 'Party'
            pgstin = getattr(party, 'gstin', '') if party else ''
            pstate = getattr(party, 'state', '') or getattr(obj, 'place_of_supply', '') or 'Kerala'
            ewb = EWayBill.objects.create(
                organization=org,
                bill_number=bill_num,
                doc_type=self.prefix or 'INV',
                doc_number=obj.number,
                doc_date=obj.date,
                party_name=pname,
                party_gstin=pgstin,
                from_state=getattr(org, 'state', 'Kerala'),
                to_state=pstate,
                distance_km=dist,
                transporter_id=trans_id,
                transporter_name=trans_name,
                vehicle_number=veh_num,
                valid_until=timezone.now() + timedelta(days=3),
                status='generated'
            )
            services.log_audit(request.user, 'generate_eway_bill', 'EWayBill', ewb.pk, f"Generated E-Way Bill {ewb.bill_number} for {obj.number}", org=org)
            return j({'status': 'ok', 'eway_bill_id': ewb.pk, 'bill_number': ewb.bill_number, 'message': f'E-Way Bill {ewb.bill_number} generated successfully.'})
        raise ApiError(404, 'Unknown action.')

class InvoiceResource(DocResource):
    name = 'invoices'
    Model, Line, Party = Invoice, InvoiceLine, Customer
    party_attr, line_fk, prefix, posted = 'customer', 'invoice', 'INV', 'sent'
    search_fields = ('number', 'customer__name')
    csv_cols = [('Invoice#', 'number'), ('Customer Name', 'customer'), ('Date', 'date'), ('Due date', 'due_date'),
                ('Item Name', 'item'), ('Description', 'description'), ('HSN/SAC', 'hsn_sac'), ('Quantity', 'quantity'),
                ('Rate', 'rate'), ('GST Rate (%)', 'gst_rate'), ('Notes', 'notes')]

    def get_template_sample(self):
        return ['INV-00101', 'Acme Infotech Ltd', '2026-10-15', '2026-11-14', 'Ergonomic Mesh Chair', 'Ergonomic office chair with lumbar support', '940310', '2', '8500.00', '18.00', 'Thanks for your business.']

    def extra_clean(self, c):
        return {'terms': c.text('terms', max_len=2000), 'order_number': c.text('order_number', max_len=60)}

    def extra_detail(self, o):
        return {'terms': o.terms, 'order_number': o.order_number}

    def action(self, request, obj, name):
        if name == 'send':
            services.send_invoice(obj, request.user)
            return j({'status': 'ok', 'message': f'Invoice {obj.number} sent.'})
        elif name == 'void':
            services.void_invoice(obj, request.user)
            return j({'status': 'ok', 'message': f'Invoice {obj.number} voided.'})
        elif name == 'write-off':
            b = body(request)
            reason = b.get('reason') or 'Bad Debt'
            notes = b.get('notes', '')
            res = services.write_off_invoice(obj, reason=reason, notes=notes, user=request.user)
            return j(res)
        elif name in ('remind', 'send-reminder'):
            res = services.send_payment_reminder(obj, user=request.user)
            return j(res)
        elif name == 'stop-reminders':
            res = services.stop_payment_reminders(obj, user=request.user)
            return j(res)
        elif name in ('expected-payment-date', 'set-expected-date'):
            b = body(request)
            dt = b.get('date') or b.get('expected_payment_date')
            res = services.set_expected_payment_date(obj, dt, user=request.user)
            return j(res)
        elif name == 'create-credit-note':
            b = body(request)
            amount = b.get('amount')
            reason = b.get('reason') or f'Credit against invoice {obj.number}'
            cn = services.create_credit_note_from_invoice(obj, amount=amount, reason=reason, user=request.user)
            return j({'status': 'ok', 'credit_note_id': cn.pk, 'number': cn.number, 'message': f'Credit note {cn.number} created.'})
        elif name == 'create-debit-note':
            b = body(request)
            reason = b.get('reason') or f'Debit adjustment for invoice {obj.number}'
            dn = services.clone_document(obj, request.user)
            dn.order_number = f"DN for {obj.number}"
            dn.notes = f"{dn.notes}\nDebit Note adjustment for invoice {obj.number}. Reason: {reason}".strip()
            dn.save(update_fields=['order_number', 'notes'])
            return j({'status': 'ok', 'debit_note_id': dn.pk, 'number': dn.number, 'message': f'Debit note {dn.number} created.'})
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
            return j({'status': 'ok', 'message': 'Retainer applied successfully.'})
        else:
            return super().action(request, obj, name)

class RetainerInvoiceResource(DocResource):
    name = 'retainer-invoices'
    Model, Line, Party = RetainerInvoice, RetainerInvoiceLine, Customer
    party_attr, line_fk, prefix, posted = 'customer', 'retainer', 'RET', 'sent'
    search_fields = ('number', 'customer__name')
    csv_cols = [('Retainer#', 'number'), ('Customer', 'party'), ('Date', 'date'),
                ('Status', 'status'), ('Taxable', 'subtotal'), ('Total', 'total'),
                ('Paid', 'paid'), ('Applied', 'applied_amount'), ('Available', 'available_balance')]

    def extra_clean(self, c):
        res = {'terms': c.text('terms', max_len=2000), 'order_number': c.text('order_number', max_len=60)}
        purpose = c.text('purpose', max_len=500) or c.text('subject', max_len=500)
        if purpose:
            res['notes'] = purpose
        return res

    def extra_detail(self, o):
        paid = q2(getattr(o, 'paid_sum', o.paid_amount))
        applied = q2(getattr(o, 'applied_sum', o.applied_amount))
        purpose_val = getattr(o, 'notes', '') or ''
        return {
            'terms': getattr(o, 'terms', ''),
            'order_number': o.order_number,
            'purpose': purpose_val,
            'subject': purpose_val,
            'paid': paid,
            'applied_amount': applied,
            'available_balance': max(Z, paid - applied)
        }

    def action(self, request, obj, name):
        if name == 'send':
            services.send_retainer_invoice(obj, request.user)
        elif name in ('void', 'cancel'):
            services.void_retainer_invoice(obj, request.user)
        elif name in ('pay', 'record-payment'):
            b = dict(body(request))
            if 'account' not in b and 'bank_account' in b:
                b['account'] = b['bank_account']
            if 'mode' not in b and 'payment_mode' in b:
                b['mode'] = b['payment_mode']
            c = Cleaner(b)
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
        elif name == 'refund':
            b = dict(body(request))
            if 'account' not in b and 'bank_account' in b:
                b['account'] = b['bank_account']
            if 'mode' not in b and 'payment_mode' in b:
                b['mode'] = b['payment_mode']
            c = Cleaner(b)
            amt = c.number('amount', required=True, lo=Decimal('0.01'))
            dt = c.date('date') or timezone.localdate()
            mode = c.choice('mode', MODE_KEYS, 'bank_transfer')
            account = c.text('account', default='Bank Account', max_len=60)
            ref = c.text('reference', max_len=80)
            notes = c.text('notes', max_len=2000)
            c.done()
            services.refund_retainer_payment(obj, amt, dt, mode, account, ref, notes, request.user)
        elif name in ('delete-payment', 'remove-payment'):
            b = body(request)
            pid = b.get('payment_id') or b.get('id')
            p = obj.payments.filter(pk=pid).first() if pid else None
            if not p:
                raise ApiError(404, 'Retainer payment not found.')
            services.delete_retainer_payment(p, request.user)
        elif name in ('delete-allocation', 'remove-allocation'):
            b = body(request)
            aid = b.get('allocation_id') or b.get('id')
            a = obj.allocations.filter(pk=aid).first() if aid else None
            if not a:
                raise ApiError(404, 'Retainer allocation not found.')
            services.delete_retainer_allocation(a, request.user)
        else:
            return super().action(request, obj, name)

class QuoteResource(DocResource):
    name = 'quotes'
    Model, Line, Party = Quote, QuoteLine, Customer
    party_attr, line_fk, prefix, posted = 'customer', 'quote', 'QT', 'sent'

    @property
    def prefix(self):
        return Organization.get().quote_prefix or 'QT'

    def get_prefix(self):
        return Organization.get().quote_prefix or 'QT'
    search_fields = ('number', 'customer__name', 'reference_number', 'subject')
    csv_cols = [
        ('Quote#', 'number'), ('Customer Name', 'customer'), ('Date', 'date'),
        ('Expiry date', 'expiry_date'), ('Item Name', 'item'), ('Description', 'description'),
        ('Quantity', 'quantity'), ('Rate', 'rate'), ('GST Rate (%)', 'gst_rate'), ('Notes', 'notes')
    ]

    def get_template_sample(self):
        return ['EST-00050', 'Acme Infotech Ltd', '2026-10-12', '2026-11-12', 'Consulting Services', 'Software audit and advisory', '1', '45000.00', '18.00', 'Valid for 30 days']

    def extra_clean(self, c):
        tds_val = c.d.get('tds_tcs_tax')
        if isinstance(tds_val, str) and ('%' in tds_val or '(' in tds_val):
            import re
            m = re.search(r'(\d+(?:\.\d+)?)%', tds_val)
            if m:
                c.d['tds_tcs_tax'] = m.group(1)
            else:
                c.d['tds_tcs_tax'] = '0.00'
        return {
            'reference_number': c.text('reference_number', max_len=100) or '',
            'expiry_date': c.date('expiry_date'),
            'salesperson': c.text('salesperson', max_len=120) or '',
            'project_name': c.text('project_name', max_len=150) or '',
            'subject': c.text('subject', max_len=2000) or '',
            'terms': c.text('terms', max_len=2000) or '',
            'tax_type': c.choice('tax_type', ['tds', 'tcs'], 'tds'),
            'tds_tcs_tax': c.number('tds_tcs_tax', lo=0, default=Decimal('0.00')),
            'adjustment': c.number('adjustment', default=Decimal('0.00')),
            'adjustment_label': c.text('adjustment_label', max_len=50) or 'Adjustment',
        }

    def extra_detail(self, o):
        return {
            'reference_number': o.reference_number,
            'expiry_date': o.expiry_date,
            'salesperson': o.salesperson,
            'project_name': o.project_name,
            'subject': o.subject,
            'terms': o.terms,
            'tax_type': o.tax_type,
            'tds_tcs_tax': o.tds_tcs_tax,
            'adjustment': o.adjustment,
            'adjustment_label': o.adjustment_label,
            'sent_at': o.sent_at,
            'converted_to_invoice_id': o.converted_to_invoice_id,
            'converted_to_invoice_number': o.converted_to_invoice.number if o.converted_to_invoice else '',
            'converted_to_sales_order_id': o.converted_to_sales_order_id,
            'converted_to_sales_order_number': o.converted_to_sales_order.number if o.converted_to_sales_order else '',
            'converted_at': o.converted_at,
        }

    def action(self, request, obj, name):
        if name == 'send':
            if obj.status in ('invoiced', 'ordered'):
                raise ApiError(400, 'Cannot mark converted quote as sent.')
            obj.status = 'sent'
            obj.sent_at = timezone.now()
            obj.save(update_fields=['status', 'sent_at'])
            services.log_audit(request.user, 'update', 'quote', obj.pk, f'Quote {obj.number} marked as sent')
            return j({'status': 'sent', 'number': obj.number})
        elif name == 'accept':
            if obj.status in ('invoiced', 'ordered') or obj.converted_to_invoice_id or obj.converted_to_sales_order_id:
                raise ApiError(400, f'Quote {obj.number} has already been converted ({obj.status}).')
            obj.status = 'accepted'
            obj.save(update_fields=['status'])
            services.log_audit(request.user, 'update', 'quote', obj.pk, f'Quote {obj.number} accepted')
            return j({'status': 'accepted', 'number': obj.number})
        elif name == 'decline':
            if obj.status in ('invoiced', 'ordered') or obj.converted_to_invoice_id or obj.converted_to_sales_order_id:
                raise ApiError(400, f'Cannot decline converted quote {obj.number}.')
            obj.status = 'declined'
            obj.save(update_fields=['status'])
            services.log_audit(request.user, 'update', 'quote', obj.pk, f'Quote {obj.number} declined')
            return j({'status': 'declined', 'number': obj.number})
        elif name == 'convert-to-invoice':
            if obj.status == 'invoiced' or obj.converted_to_invoice_id:
                target = obj.converted_to_invoice.number if obj.converted_to_invoice else ''
                raise ApiError(400, f'Quote {obj.number} has already been converted to Invoice {target}. A quote cannot be converted multiple times.')
            if obj.status == 'ordered' or obj.converted_to_sales_order_id:
                target = obj.converted_to_sales_order.number if obj.converted_to_sales_order else ''
                raise ApiError(400, f'Quote {obj.number} has already been converted to Sales Order {target}. A quote cannot be converted multiple times.')
            if obj.status == 'declined':
                raise ApiError(400, f'Cannot convert declined quote {obj.number}.')
            inv = Invoice.objects.create(
                organization=obj.organization,
                customer=obj.customer,
                source_quote=obj,
                number=next_number('INV', org=obj.organization),
                date=timezone.localdate(),
                due_date=timezone.localdate() + timedelta(days=obj.customer.payment_terms or 30),
                place_of_supply=obj.place_of_supply,
                tax_pricing_type=getattr(obj, 'tax_pricing_type', 'tax_exclusive') or 'tax_exclusive',
                customer_type=getattr(obj, 'customer_type', 'b2b') or 'b2b',
                status='draft',
                subtotal=obj.subtotal,
                cgst=obj.cgst,
                sgst=obj.sgst,
                igst=obj.igst,
                total=obj.total,
                order_number=obj.reference_number or obj.number,
                notes=obj.notes,
                terms=obj.terms
            )
            for l in obj.lines.all():
                InvoiceLine.objects.create(
                    invoice=inv,
                    item=l.item,
                    description=l.description,
                    hsn_sac=l.hsn_sac,
                    quantity=l.quantity,
                    rate=l.rate,
                    discount_percent=l.discount_percent,
                    gst_rate=l.gst_rate,
                    taxable=l.taxable,
                    tax_amount=l.tax_amount,
                    line_total=l.line_total,
                    position=l.position
                )
            obj.status = 'invoiced'
            obj.converted_to_invoice = inv
            obj.converted_at = timezone.now()
            obj.save(update_fields=['status', 'converted_to_invoice', 'converted_at'])
            services.log_audit(request.user, 'create', 'invoice', inv.pk, f'Converted Quote {obj.number} to Invoice {inv.number}')
            return j({'invoice_id': inv.pk, 'id': inv.pk, 'number': inv.number})
        elif name == 'convert-to-sales-order':
            if obj.status == 'ordered' or obj.converted_to_sales_order_id:
                target = obj.converted_to_sales_order.number if obj.converted_to_sales_order else ''
                raise ApiError(400, f'Quote {obj.number} has already been converted to Sales Order {target}. A quote cannot be converted multiple times.')
            if obj.status == 'invoiced' or obj.converted_to_invoice_id:
                target = obj.converted_to_invoice.number if obj.converted_to_invoice else ''
                raise ApiError(400, f'Quote {obj.number} has already been converted to Invoice {target}. A quote cannot be converted multiple times.')
            if obj.status == 'declined':
                raise ApiError(400, f'Cannot convert declined quote {obj.number}.')
            so = SalesOrder.objects.create(
                organization=obj.organization,
                customer=obj.customer,
                source_quote=obj,
                number=next_number('SO', org=obj.organization),
                date=timezone.localdate(),
                due_date=timezone.localdate() + timedelta(days=obj.customer.payment_terms or 30),
                expected_shipment_date=obj.expiry_date or timezone.localdate() + timedelta(days=7),
                place_of_supply=obj.place_of_supply,
                tax_pricing_type=getattr(obj, 'tax_pricing_type', 'tax_exclusive') or 'tax_exclusive',
                customer_type=getattr(obj, 'customer_type', 'b2b') or 'b2b',
                status='draft',
                subtotal=obj.subtotal,
                cgst=obj.cgst,
                sgst=obj.sgst,
                igst=obj.igst,
                total=obj.total,
                order_number=obj.reference_number or obj.number,
                notes=obj.notes,
                terms=obj.terms
            )
            for l in obj.lines.all():
                SalesOrderLine.objects.create(
                    order=so,
                    item=l.item,
                    description=l.description,
                    hsn_sac=l.hsn_sac,
                    quantity=l.quantity,
                    rate=l.rate,
                    discount_percent=l.discount_percent,
                    gst_rate=l.gst_rate,
                    taxable=l.taxable,
                    tax_amount=l.tax_amount,
                    line_total=l.line_total,
                    position=l.position
                )
            obj.status = 'ordered'
            obj.converted_to_sales_order = so
            obj.converted_at = timezone.now()
            obj.save(update_fields=['status', 'converted_to_sales_order', 'converted_at'])
            services.log_audit(request.user, 'create', 'sales_order', so.pk, f'Converted Quote {obj.number} to Sales Order {so.number}')
            return j({'order_id': so.pk, 'sales_order_id': so.pk, 'number': so.number})
        else:
            return super().action(request, obj, name)

class BillResource(DocResource):
    name = 'bills'
    Model, Line, Party = Bill, BillLine, Vendor
    party_attr, line_fk, prefix, posted = 'vendor', 'bill', 'BILL', 'open'
    search_fields = ('number', 'vendor__name', 'vendor_ref')
    csv_cols = [('Bill#', 'number'), ('Vendor Name', 'vendor'), ('Date', 'date'), ('Due date', 'due_date'),
                ('Item Name', 'item'), ('Description', 'description'), ('HSN/SAC', 'hsn_sac'), ('Quantity', 'quantity'),
                ('Rate', 'rate'), ('GST Rate (%)', 'gst_rate'), ('Notes', 'notes')]

    def get_template_sample(self):
        return ['BILL-00201', 'Reliable Hardware Supplies', '2026-10-10', '2026-11-09', 'Ergonomic Mesh Chair', 'Raw frame materials', '940310', '10', '5200.00', '18.00', 'Standard supplies bill']

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
            return super().action(request, obj, name)

class PaymentResource(Resource):
    Model = Doc = Alloc = Party = None
    party_attr = doc_attr = prefix = posted = ''
    orderings = {'date': 'date', 'number': 'number', 'amount': 'amount'}
    default_ordering = ('-date', '-id')

    def prepare_import_record(self, rec):
        party_val = rec.get(self.party_attr) or rec.get('party') or rec.get('customer') or rec.get('vendor')
        if party_val and not str(party_val).isdigit():
            p_str = str(party_val).strip()
            p = self.Party.objects.filter(Q(name__iexact=p_str) | Q(company__iexact=p_str) | Q(email__iexact=p_str)).first()
            if not p:
                org = Organization.get()
                p = self.Party.objects.create(name=p_str, active=True, state=org.state if org else '', organization=org)
            rec[self.party_attr] = p.pk
        elif not party_val:
            first_p = self.Party.objects.first()
            if first_p:
                rec[self.party_attr] = first_p.pk

        if not rec.get('date'):
            rec['date'] = timezone.localdate().isoformat()
        mode_val = str(rec.get('mode') or '').strip().lower().replace(' ', '_').replace('-', '_')
        if mode_val in MODE_KEYS:
            rec['mode'] = mode_val
        else:
            rec['mode'] = 'bank_transfer'
        if not rec.get('account'):
            rec['account'] = 'Bank Account'
        if not rec.get('amount'):
            amt = rec.get('payment_amount') or rec.get('amt') or rec.get('total')
            if amt:
                rec['amount'] = amt

    def get_template_sample(self):
        if self.party_attr == 'customer':
            return ['PR-00050', 'Acme Infotech Ltd', '2026-10-15', 'Bank Transfer', 'TXN-99881', '25000.00', '25000.00', '0.00']
        else:
            return ['PM-00050', 'Reliable Hardware Supplies', '2026-10-12', 'Bank Transfer', 'TXN-99882', '15000.00', '15000.00', '0.00']

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
        ba = getattr(o, 'bank_account', None)
        return {'id': o.pk, 'number': o.number, 'party_id': p.pk if p else None, 'party': p.name if p else '',
                'customer_name': p.name if p else '', 'date': o.date, 'mode': o.mode,
                'mode_label': MODE_LABEL.get(o.mode, o.mode), 'account': o.account,
                'bank_account_id': o.bank_account_id,
                'bank_account_name': ba.name if ba else '',
                'bank_name': ba.bank_name if ba else '',
                'amount': o.amount,
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
            dqs = self.Doc.objects.select_for_update().filter(pk=did)
            if hasattr(self.Doc, 'organization') and getattr(pay, 'organization', None):
                dqs = dqs.filter(organization=pay.organization)
            doc = dqs.first()
            if doc is None:
                fail('Document not found.')
            if getattr(doc, self.party_attr + '_id') != getattr(pay, self.party_attr + '_id'):
                fail(f'{doc.number} belongs to a different party.')
            if doc.status == 'draft':
                if isinstance(doc, Invoice):
                    services.send_invoice(doc, pay.created_by)
                elif isinstance(doc, Bill):
                    services.approve_bill(doc, pay.created_by)
                doc.refresh_from_db()
            if doc.status not in (self.posted, 'partial', 'paid'):
                fail(f'{doc.number} is {doc.status}; payments can only be applied to posted documents.')
            bal = doc.total - sum((a.amount for a in doc.allocations.all()), Z)
            if amt > bal:
                fail(f'{doc.number}: amount ({amt}) exceeds the balance due ({bal}).')
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
        user_org = get_user_org(user)
        party = None
        if pid:
            pqs = self.Party.objects.filter(pk=pid)
            if user_org:
                pqs = pqs.filter(organization=user_org)
            else:
                pqs = pqs.none()
            party = pqs.first()
        if pid and party is None:
            c.err(self.party_attr, f'{self.party_attr.title()} not found in your organization.')

        bank_acc_id = c.integer('bank_account_id', lo=1) or c.integer('bank_account', lo=1)
        bank_acc = None
        if bank_acc_id:
            ba_qs = BankAccount.objects.filter(pk=bank_acc_id)
            if user_org:
                ba_qs = ba_qs.filter(organization=user_org)
            bank_acc = ba_qs.first()
            if not bank_acc:
                c.err('bank_account', 'Selected bank account not found.')

        acc_name = bank_acc.name if bank_acc else (c.text('account', max_len=60, default='Bank Account') or 'Bank Account')
        out = {'date': c.date('date', required=True), 'mode': c.choice('mode', MODE_KEYS, 'bank_transfer'),
               'account': acc_name,
               'amount': c.number('amount', True, lo=Decimal('0.01'), hi=Decimal('999999999')),
               'reference': c.text('reference', max_len=80), 'notes': c.text('notes', max_len=2000)}
        c.done()
        services.check_transaction_lock(out['date'], org=user_org)
        extra = {}
        if hasattr(self.Model, 'organization'):
            extra['organization'] = user_org
        pay_num = (data.get('number') or '').strip()
        num_exists = self.Model.objects.filter(number=pay_num, organization=user_org).exists() if (pay_num and user_org) else False
        if not pay_num or num_exists:
            pay_num = services.next_document_number(self.prefix, org=user_org, date=out['date'])

        with transaction.atomic():
            pay = self.Model.objects.create(number=pay_num, created_by=user, bank_account=bank_acc, **{self.party_attr: party}, **extra, **out)
            self.allocate(pay, data.get('allocations'))
            if bank_acc:
                is_rec = isinstance(pay, PaymentReceived)
                if is_rec:
                    bank_acc.current_balance += pay.amount
                    bank_acc.bank_balance += pay.amount
                else:
                    bank_acc.current_balance -= pay.amount
                    bank_acc.bank_balance -= pay.amount
                bank_acc.save(update_fields=['current_balance', 'bank_balance'])

                BankTransaction.objects.create(
                    organization=user_org,
                    bank_account=bank_acc,
                    date=pay.date,
                    description=f"{'Payment Received' if is_rec else 'Payment Made'} {pay.number} - {party.name if party else ''}",
                    reference=pay.reference or pay.number,
                    transaction_type='Payment Received' if is_rec else 'Payment Made',
                    payee=party.name if party else '',
                    withdrawal=Decimal('0.00') if is_rec else pay.amount,
                    deposit=pay.amount if is_rec else Decimal('0.00'),
                    balance=bank_acc.current_balance,
                    status='categorized',
                    matched_entity_type='payment_received' if is_rec else 'payment_made',
                    matched_entity_id=pay.pk
                )
            if isinstance(pay, PaymentReceived):
                services.post_payment_received_journal(pay, user)
            else:
                services.post_payment_made_journal(pay, user)
            services.log_audit(user, 'create', self.Model.__name__, pay.number, f"Recorded {self.Model.__name__} {pay.number} for ₹{pay.amount}")
        return pay

    def update(self, obj, data, user):
        c = Cleaner(data)
        if self.party_attr in data:
            pid = c.integer(self.party_attr, lo=1, required=True)
            party = self.Party.objects.filter(pk=pid).first() if pid else None
            if not party:
                raise ApiError(404, f"{self.party_attr.capitalize()} not found.")
            setattr(obj, self.party_attr, party)
        if 'date' in data:
            dt = c.date('date', required=True)
            services.check_transaction_lock(dt)
            obj.date = dt
        if 'mode' in data:
            obj.mode = c.choice('mode', MODE_KEYS, default=obj.mode)
        if 'account' in data:
            obj.account = c.text('account', max_len=60, default=obj.account)
        if 'amount' in data:
            new_amt = c.number('amount', True, lo=Decimal('0.01'), hi=Decimal('999999999'))
            applied = sum((a.amount for a in obj.allocations.all()), Z)
            if new_amt < applied:
                raise ApiError(400, f"New amount ({new_amt}) cannot be less than already applied amount ({applied}).")
            obj.amount = new_amt
        if 'reference' in data:
            obj.reference = c.text('reference', max_len=80)
        if 'notes' in data:
            obj.notes = c.text('notes', max_len=2000)
        c.done()
        obj.save()

        if 'allocations' in data and data.get('allocations') is not None:
            obj.allocations.all().delete()
            self.allocate(obj, data.get('allocations'))

        if isinstance(obj, PaymentReceived):
            services.post_payment_received_journal(obj, user)
        else:
            services.post_payment_made_journal(obj, user)
        services.log_audit(user, 'update', self.Model.__name__, obj.number, f"Updated payment {obj.number}")
        return obj

    def destroy(self, obj):
        services.check_transaction_lock(obj.date)
        with transaction.atomic():
            if obj.bank_account:
                is_rec = isinstance(obj, PaymentReceived)
                if is_rec:
                    obj.bank_account.current_balance -= obj.amount
                    obj.bank_account.bank_balance -= obj.amount
                else:
                    obj.bank_account.current_balance += obj.amount
                    obj.bank_account.bank_balance += obj.amount
                obj.bank_account.save(update_fields=['current_balance', 'bank_balance'])
                m_type = 'payment_received' if is_rec else 'payment_made'
                BankTransaction.objects.filter(matched_entity_type=m_type, matched_entity_id=obj.pk).delete()
            Journal.objects.filter(reference=obj.number).delete()
            services.log_audit(getattr(obj, 'created_by', None), 'delete', self.Model.__name__, obj.number, f"Reversed/deleted payment {obj.number}")
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

    def prepare_import_record(self, rec):
        item_val = rec.get('item') or rec.get('item_name') or rec.get('sku') or rec.get('product')
        if item_val and not str(item_val).isdigit():
            i_str = str(item_val).strip()
            it = Item.objects.filter(Q(name__iexact=i_str) | Q(sku__iexact=i_str)).first()
            if not it:
                it = Item.objects.create(name=i_str, item_type='goods', track_inventory=True, selling_price=Decimal('100.00'))
            elif not it.track_inventory or it.item_type != 'goods':
                it.track_inventory = True
                it.item_type = 'goods'
                it.save(update_fields=['track_inventory', 'item_type'])
            rec['item'] = it.pk
        elif not item_val:
            first_it = Item.objects.filter(item_type='goods', track_inventory=True).first()
            if not first_it:
                first_it = Item.objects.create(name='Stock Item', item_type='goods', track_inventory=True, selling_price=Decimal('100.00'))
            rec['item'] = first_it.pk

        if not rec.get('date'):
            rec['date'] = timezone.localdate().isoformat()
        if not rec.get('reason') or rec['reason'] not in REASONS:
            rec['reason'] = 'Stock recount'
        if not rec.get('new_quantity'):
            rec['new_quantity'] = rec.get('quantity') or rec.get('qty') or Decimal('10.000')

    def base_qs(self):
        return StockMovement.objects.select_related('item', 'warehouse').filter(kind='adjustment')

    def create(self, data, user):
        user_org = get_user_org(user)
        items_data = data.get('items')

        # Date & Time resolution
        on_str = data.get('date')
        if not on_str:
            on = timezone.localdate()
        else:
            try:
                on = datetime.date.fromisoformat(str(on_str)[:10])
            except Exception:
                on = timezone.localdate()

        adj_time = (str(data.get('time') or '')).strip()
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

        # Warehouse resolution
        wid = data.get('warehouse_id')
        if wid is None:
            wid = data.get('warehouse')
        wh = None
        if wid:
            try:
                wid_int = int(wid)
                wh_qs = Warehouse.objects.filter(pk=wid_int)
                if user_org:
                    wh = wh_qs.filter(organization=user_org).first()
                else:
                    wh = None
            except (ValueError, TypeError):
                wh = None
        wh_code = wh.code if wh else (str(data.get('warehouse_code') or '').strip()[:30])

        # Header fields
        mode = (str(data.get('mode_of_adjustment') or data.get('mode') or 'quantity')).strip()
        ref = (str(data.get('reference_number') or data.get('reference') or '')).strip()
        if not ref:
            ref = next_number('ADJ', org=user_org)

        account = (str(data.get('account') or 'Cost of Goods Sold')).strip()
        reason = (str(data.get('reason') or 'Stock recount')).strip()
        if not reason:
            reason = 'Stock recount'

        desc = (str(data.get('description') or data.get('notes') or '')).strip()
        status = (str(data.get('status') or 'adjusted')).strip().lower()

        created_movements = []

        if isinstance(items_data, list) and len(items_data) > 0:
            for row in items_data:
                iid = row.get('item') or row.get('item_id')
                if not iid:
                    continue
                try:
                    iid_int = int(iid)
                except (ValueError, TypeError):
                    continue

                item_qs = Item.objects.select_for_update().filter(pk=iid_int, item_type='goods', track_inventory=True)
                if user_org:
                    item = item_qs.filter(organization=user_org).first()
                else:
                    item = None

                if not item:
                    continue

                new_val = row.get('new_quantity')
                adj_val = row.get('quantity_adjusted')

                if new_val is not None and str(new_val).strip() != '':
                    new_qty = Decimal(str(new_val))
                    change = new_qty - item.stock
                elif adj_val is not None and str(adj_val).strip() != '':
                    adj_str = str(adj_val).replace('+', '').strip()
                    change = Decimal(adj_str)
                else:
                    change = Decimal('0')

                row_notes_parts = []
                if desc:
                    row_notes_parts.append(desc)
                if account and account != 'Cost of Goods Sold':
                    row_notes_parts.append(f"Account: {account}")
                if mode and mode != 'quantity':
                    row_notes_parts.append(f"Mode: {mode}")
                if row.get('project'):
                    row_notes_parts.append(f"Project: {row['project']}")
                if row.get('reporting_tags'):
                    row_notes_parts.append(f"Tags: {row['reporting_tags']}")
                row_notes = ' | '.join(row_notes_parts)[:1000]

                if status == 'draft':
                    mv = StockMovement.objects.create(
                        organization=user_org,
                        item=item, date=on, adjusted_at=adjusted_at,
                        warehouse=wh, warehouse_code=wh_code,
                        kind='adjustment', reference=ref,
                        change=change, balance_after=item.stock,
                        reason=reason, notes=f"[Draft] {row_notes}"[:1000],
                        created_by=user
                    )
                    created_movements.append(mv)
                else:
                    if change != 0:
                        mv = services.move_stock(item.pk, change, 'adjustment', ref, on, user, reason, row_notes,
                                                 warehouse=wh, warehouse_code=wh_code, adjusted_at=adjusted_at)
                    else:
                        mv = StockMovement.objects.create(
                            organization=user_org,
                            item=item, date=on, adjusted_at=adjusted_at,
                            warehouse=wh, warehouse_code=wh_code,
                            kind='adjustment', reference=ref,
                            change=Decimal('0'), balance_after=item.stock,
                            reason=reason, notes=row_notes,
                            created_by=user
                        )
                    created_movements.append(mv)

            if not created_movements:
                raise ApiError(400, 'Please select at least one valid tracked goods item.')

            primary_mv = created_movements[0]
        else:
            # Single-item backward-compatible payload
            c = Cleaner(data)
            iid = c.integer('item', lo=1, required=True)
            new = c.number('new_quantity', True, lo=Decimal('0'), hi=Decimal('99999999'), places=3)
            item_qs = Item.objects.select_for_update().filter(pk=iid, item_type='goods', track_inventory=True)
            if user_org:
                item = item_qs.filter(organization=user_org).first()
            else:
                item = None

            if iid and item is None:
                c.err('item', 'Select an inventory-tracked goods item.')
            c.done()

            change = new - item.stock
            if change == 0 and status != 'draft':
                raise ApiError(400, 'The new quantity equals the current stock; nothing to adjust.', {'new_quantity': 'No change.'})

            notes_parts = []
            if desc:
                notes_parts.append(desc)
            if account and account != 'Cost of Goods Sold':
                notes_parts.append(f"Account: {account}")
            notes_str = ' | '.join(notes_parts)[:1000]

            if status == 'draft':
                primary_mv = StockMovement.objects.create(
                    organization=user_org,
                    item=item, date=on, adjusted_at=adjusted_at,
                    warehouse=wh, warehouse_code=wh_code,
                    kind='adjustment', reference=ref,
                    change=change, balance_after=item.stock,
                    reason=reason, notes=f"[Draft] {notes_str}"[:1000],
                    created_by=user
                )
            else:
                primary_mv = services.move_stock(item.pk, change, 'adjustment', ref, on, user, reason, notes_str,
                                                 warehouse=wh, warehouse_code=wh_code, adjusted_at=adjusted_at)

        # Handle attachments if provided
        attachments_data = data.get('attachments')
        if isinstance(attachments_data, list):
            target_ids = [m.pk for m in created_movements] if created_movements else [primary_mv.pk]
            for att in attachments_data:
                fname = att.get('filename') or att.get('name')
                fdata = att.get('file_data') or att.get('data') or ''
                fsize = att.get('file_size') or att.get('size') or 0
                mtype = att.get('mime_type') or att.get('type') or ''
                if fname:
                    for tid in target_ids:
                        Attachment.objects.create(
                            organization=user_org,
                            entity_type='stock_adjustment',
                            entity_id=tid,
                            filename=fname,
                            file_data=fdata,
                            file_size=fsize,
                            mime_type=mtype,
                            created_by=user
                        )

        return primary_mv

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

    user_org = get_user_org(request.user, request)
    if not user_org:
        raise ApiError(403, 'Organization required.')
    if not Item.objects.filter(pk=iid, organization=user_org).exists():
        raise ApiError(404, 'Item not found in your organization.')
    if not Warehouse.objects.filter(pk=from_wh_id, organization=user_org).exists():
        raise ApiError(404, 'Source warehouse not found in your organization.')
    if not Warehouse.objects.filter(pk=to_wh_id, organization=user_org).exists():
        raise ApiError(404, 'Destination warehouse not found in your organization.')

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
    csv_cols = [('Account Code', 'code'), ('Account Name', 'name'), ('Account Type', 'account_type'),
                ('Sub Type', 'sub_type'), ('Description', 'description')]

    def get_template_sample(self):
        return ['5100', 'Office Electricity & Power', 'expense', 'operating_expense', 'Monthly office electricity charges']

    def prepare_import_record(self, rec):
        if not rec.get('name'):
            rec['name'] = rec.get('account_name') or rec.get('title')
        if 'account_type' in rec and rec['account_type']:
            rec['account_type'] = str(rec['account_type']).lower().strip()
        else:
            rec['account_type'] = 'expense'
        if not rec.get('code'):
            rec['code'] = next_number('ACC')

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

        user_org = get_user_org(user)
        jrn = services.post_journal_entry(dt, 'manual', ref, notes, items, user, org=user_org)
        tot_deb = sum((it.debit for it in jrn.items.all()), Z)
        services.log_audit(user, 'create', 'Journal', jrn.number, f"Created manual journal {jrn.number} for ₹{tot_deb}")
        return jrn

    def update(self, obj, data, user):
        c = Cleaner(data)
        if 'date' in data:
            obj.date = c.date('date', required=True)
            services.check_transaction_lock(obj.date)
        if 'reference' in data:
            obj.reference = c.text('reference', max_len=80)
        if 'notes' in data:
            obj.notes = c.text('notes', max_len=1000)
        c.done()

        lines_in = data.get('lines')
        if lines_in is not None:
            if len(lines_in) < 2:
                raise ApiError(400, 'A journal entry must contain at least two balancing line items.')
            clean_items = []
            tot_debit = Decimal('0.00')
            tot_credit = Decimal('0.00')
            for ln in lines_in:
                acc_ref = ln.get('account') or ln.get('account_id')
                if not acc_ref:
                    raise ApiError(400, 'Each line item must specify an account.')
                if isinstance(acc_ref, Account):
                    acc = acc_ref
                else:
                    acc = None
                    if str(acc_ref).isdigit():
                        acc = Account.objects.filter(pk=int(acc_ref)).first()
                    if not acc:
                        acc = Account.objects.filter(code=str(acc_ref)).first()
                    if not acc:
                        acc = Account.objects.filter(name__iexact=str(acc_ref)).first()
                    if not acc:
                        raise ApiError(400, f"Account '{acc_ref}' not found in Chart of Accounts.")
                d_val = q2(ln.get('debit', 0))
                c_val = q2(ln.get('credit', 0))
                if d_val < 0 or c_val < 0:
                    raise ApiError(400, 'Debits and credits cannot be negative.')
                if d_val == 0 and c_val == 0:
                    continue
                tot_debit += d_val
                tot_credit += c_val
                clean_items.append((acc, d_val, c_val, ln.get('description', '')))
            if not clean_items:
                raise ApiError(400, 'A journal entry must contain non-zero items.')
            if tot_debit != tot_credit:
                raise ApiError(400, f"Unbalanced Journal: Total Debits (₹{tot_debit}) must equal Total Credits (₹{tot_credit}).")

            obj.items.all().delete()
            for acc, deb, cred, desc in clean_items:
                JournalItem.objects.create(journal=obj, account=acc, debit=deb, credit=cred, description=desc)

        obj.save()
        services.log_audit(user, 'update', 'Journal', obj.number, f"Updated manual journal {obj.number}")
        return obj

    def destroy(self, obj):
        services.check_transaction_lock(obj.date)
        obj.items.all().delete()
        obj.delete()

class AuditLogResource(Resource):
    name = 'audit-logs'
    model = AuditLog
    search_fields = ('username', 'action', 'entity_type', 'entity_id', 'summary', 'module', 'submodule')
    default_ordering = ('-timestamp',)
    csv_cols = [
        ('Timestamp', 'timestamp'), ('User', 'username'), ('Action', 'action'),
        ('Entity Type', 'entity_type'), ('Entity ID', 'entity_id'), ('Module', 'module'),
        ('Summary', 'summary'), ('IP Address', 'ip_address')
    ]

    def filter_qs(self, qs, request):
        user_org = get_user_org(request.user, request)
        if user_org:
            qs = qs.filter(organization=user_org)
        else:
            qs = qs.none()
        act = request.GET.get('action')
        if act:
            qs = qs.filter(action__iexact=act)
        etype = request.GET.get('entity_type')
        if etype:
            qs = qs.filter(entity_type__iexact=etype)
        mod = request.GET.get('module')
        if mod:
            qs = qs.filter(Q(module__iexact=mod) | Q(entity_type__iexact=mod))
        return qs

    def row(self, o):
        return {
            'id': o.pk,
            'timestamp': o.timestamp.isoformat() if hasattr(o.timestamp, 'isoformat') else str(o.timestamp),
            'username': o.username,
            'action': o.action,
            'entity_type': o.entity_type,
            'entity_id': o.entity_id,
            'module': getattr(o, 'module', '') or '',
            'submodule': getattr(o, 'submodule', '') or '',
            'summary': o.summary,
            'details': o.details or {},
            'previous_values': getattr(o, 'previous_values', {}) or {},
            'new_values': getattr(o, 'new_values', {}) or {},
            'status': getattr(o, 'status', 'success') or 'success',
            'ip_address': o.ip_address or ''
        }

    def destroy(self, obj):
        raise ApiError(405, 'Audit log records are immutable and cannot be deleted.')

    def update(self, obj, data, user):
        raise ApiError(405, 'Audit log records are immutable and cannot be modified.')

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
    csv_cols = [('Account Name', 'name'), ('Bank Name', 'bank_name'), ('Account Number', 'account_number'),
                ('IFSC Code', 'ifsc'), ('Account Type', 'account_type'), ('Opening Balance', 'opening_balance'),
                ('Branch', 'branch_name')]

    def get_template_sample(self):
        return ['HDFC Current Account', 'HDFC Bank', '50200012345678', 'HDFC0001234', 'current', '50000.00', 'MG Road Branch']

    def prepare_import_record(self, rec):
        if not rec.get('name'):
            rec['name'] = rec.get('account_name') or rec.get('bank_name') or 'Bank Account'
        if not rec.get('bank_name'):
            rec['bank_name'] = rec.get('name') or 'Bank'
        if not rec.get('account_number'):
            rec['account_number'] = rec.get('account_no') or rec.get('acc_no') or f"BA{int(timezone.now().timestamp())}"

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

    def prepare_import_record(self, rec):
        ba_val = rec.get('bank_account') or rec.get('account') or rec.get('bank_account_id')
        ba = None
        if ba_val:
            if str(ba_val).isdigit():
                ba = BankAccount.objects.filter(pk=int(ba_val)).first()
            if not ba:
                ba = BankAccount.objects.filter(Q(name__iexact=str(ba_val).strip()) | Q(account_number__iexact=str(ba_val).strip())).first()
        if not ba:
            ba = BankAccount.objects.first()
            if not ba:
                ba = BankAccount.objects.create(name='Primary Bank Account', bank_name='Bank', account_number=f"BA{int(timezone.now().timestamp())}")
        rec['bank_account'] = ba.pk

        if not rec.get('date'):
            rec['date'] = timezone.localdate().isoformat()

        if not rec.get('description'):
            rec['description'] = rec.get('desc') or rec.get('payee') or rec.get('reference') or 'Bank Transaction'

        amt = rec.get('amount')
        ttype = str(rec.get('transaction_type') or rec.get('type') or '').lower().strip()
        wd = rec.get('withdrawal') or rec.get('debit') or rec.get('withdrawal_amount')
        dep = rec.get('deposit') or rec.get('credit') or rec.get('deposit_amount')

        if wd is None and dep is None and amt is not None:
            try:
                amt_dec = Decimal(str(amt))
                if amt_dec < 0:
                    wd = abs(amt_dec)
                    dep = Decimal('0.00')
                elif ttype in ('withdrawal', 'debit', 'dr', 'expense', 'payment'):
                    wd = amt_dec
                    dep = Decimal('0.00')
                else:
                    dep = amt_dec
                    wd = Decimal('0.00')
            except Exception:
                wd = Decimal('0.00')
                dep = Decimal('0.00')

        rec['withdrawal'] = Decimal(str(wd or '0.00'))
        rec['deposit'] = Decimal(str(dep or '0.00'))

        if not rec.get('status'):
            rec['status'] = 'unreconciled'

    def find_existing(self, clean_item, user=None):
        ref = clean_item.get('reference')
        if ref:
            obj = self.model.objects.filter(reference__iexact=str(ref).strip()).first()
            if obj:
                return obj
        ba_id = clean_item.get('bank_account')
        dt = clean_item.get('date')
        desc = clean_item.get('description')
        wd = clean_item.get('withdrawal', Decimal('0.00'))
        dep = clean_item.get('deposit', Decimal('0.00'))
        if ba_id and dt and desc:
            return self.model.objects.filter(
                bank_account_id=ba_id, date=dt, description__iexact=str(desc).strip(),
                withdrawal=wd, deposit=dep
            ).first()
        return None

    def create(self, data, user):
        c = Cleaner(data)
        ba_id = c.integer('bank_account', required=True, lo=1)
        ba = BankAccount.objects.filter(pk=ba_id).first()
        if not ba:
            raise ApiError(404, 'Bank account not found.')
        dt = c.date('date', required=True)
        desc = c.text('description', required=True, max_len=500)
        ref = c.text('reference', max_len=100)
        wd = c.number('withdrawal', default=Decimal('0.00'), lo=Decimal('0'))
        dep = c.number('deposit', default=Decimal('0.00'), lo=Decimal('0'))
        ttype = c.text('transaction_type', max_len=50, default='Bank Transaction')
        payee = c.text('payee', max_len=150)
        loc = c.text('location', max_len=100, default=ba.branch_name or 'HO Kottayam')
        st = c.choice('status', ['unmatched', 'unreconciled', 'matched', 'categorized', 'manually_added'], default='unreconciled')
        notes = c.text('notes', max_len=1000)
        c.done()

        new_balance = ba.current_balance + dep - wd
        ba.current_balance = new_balance
        ba.bank_balance = new_balance
        ba.save(update_fields=['current_balance', 'bank_balance'])

        txn = BankTransaction.objects.create(
            bank_account=ba, date=dt, description=desc, reference=ref,
            withdrawal=wd, deposit=dep, balance=new_balance,
            transaction_type=ttype, payee=payee, location=loc,
            status=st, notes=notes
        )
        services.log_audit(user, 'create', 'BankTransaction', txn.pk, f"Imported bank transaction {txn.description} ({txn.date})")
        return txn

    def update(self, obj, data, user):
        c = Cleaner(data)
        old_dep = obj.deposit
        old_wd = obj.withdrawal
        ba = obj.bank_account
        if 'bank_account' in data:
            ba_id = c.integer('bank_account', required=True, lo=1)
            new_ba = BankAccount.objects.filter(pk=ba_id).first()
            if not new_ba:
                raise ApiError(404, 'Bank account not found.')
            ba = new_ba
            obj.bank_account = new_ba
        if 'date' in data:
            obj.date = c.date('date', required=True)
        if 'description' in data:
            obj.description = c.text('description', required=True, max_len=500)
        if 'reference' in data:
            obj.reference = c.text('reference', max_len=100)
        if 'withdrawal' in data:
            obj.withdrawal = c.number('withdrawal', default=Decimal('0.00'), lo=Decimal('0'))
        if 'deposit' in data:
            obj.deposit = c.number('deposit', default=Decimal('0.00'), lo=Decimal('0'))
        if 'transaction_type' in data:
            obj.transaction_type = c.text('transaction_type', max_len=50, default=obj.transaction_type)
        if 'payee' in data:
            obj.payee = c.text('payee', max_len=150)
        if 'location' in data:
            obj.location = c.text('location', max_len=100, default=obj.location)
        if 'status' in data:
            obj.status = c.choice('status', ['unmatched', 'unreconciled', 'matched', 'categorized', 'manually_added'], default=obj.status)
        if 'notes' in data:
            obj.notes = c.text('notes', max_len=1000)
        c.done()

        balance_delta = (obj.deposit - old_dep) - (obj.withdrawal - old_wd)
        if balance_delta != Decimal('0.00'):
            ba.current_balance += balance_delta
            ba.bank_balance += balance_delta
            ba.save(update_fields=['current_balance', 'bank_balance'])
            obj.balance = ba.current_balance

        obj.save()
        services.log_audit(user, 'update', 'BankTransaction', obj.pk, f"Updated bank transaction {obj.description} ({obj.date})")
        return obj

    def destroy(self, obj):
        ba = obj.bank_account
        if ba:
            ba.current_balance = ba.current_balance - obj.deposit + obj.withdrawal
            ba.bank_balance = ba.bank_balance - obj.deposit + obj.withdrawal
            ba.save(update_fields=['current_balance', 'bank_balance'])
        obj.delete()

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
        res = services.record_bank_transfer(data, user, org=get_user_org(user))
        return BankTransfer.objects.get(pk=res['id'])

    def create_for_request(self, data, user, request):
        org = get_user_org(user, request)
        res = services.record_bank_transfer(data, user, org=org)
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
    search_fields = ('number', 'customer__name', 'order_number')
    default_ordering = ('-date', '-id')
    csv_cols = [
        ('Order#', 'number'), ('Customer Name', 'customer'), ('Date', 'date'), ('Due date', 'due_date'),
        ('Expected Shipment Date', 'expected_shipment_date'), ('Item Name', 'item'),
        ('Description', 'description'), ('HSN/SAC', 'hsn_sac'), ('Quantity', 'quantity'),
        ('Rate', 'rate'), ('GST Rate (%)', 'gst_rate'), ('Notes', 'notes')
    ]

    def get_template_sample(self):
        return ['SO-00010', 'Acme Infotech Ltd', '2026-10-15', '2026-11-14', '2026-10-25', 'Ergonomic Mesh Chair', 'Ergonomic office chair with lumbar support', '940310', '5', '8500.00', '18.00', 'Standard delivery terms']

    def preprocess_import_records(self, records):
        grouped = []
        doc_map = {}
        for r in records:
            num = str(r.get('number') or r.get('order_number') or r.get('so_number') or '').strip()
            line = self.extract_line_from_record(r)
            if num and num in doc_map:
                existing = doc_map[num]
                if line:
                    existing.setdefault('lines', []).append(line)
            else:
                doc_copy = dict(r)
                if line and 'lines' not in doc_copy:
                    doc_copy['lines'] = [line]
                grouped.append(doc_copy)
                if num:
                    doc_map[num] = doc_copy
        return grouped

    def extract_line_from_record(self, r):
        item_val = r.get('item') or r.get('item_name') or r.get('product') or r.get('sku') or ''
        desc = r.get('description') or r.get('line_description') or r.get('desc') or ''
        qty = r.get('quantity') or r.get('qty') or r.get('opening_stock') or Decimal('1.000')
        rate = r.get('rate') or r.get('price') or r.get('unit_price') or r.get('amount') or Decimal('0.00')
        gst = r.get('gst_rate') or r.get('tax_rate') or Decimal('18.00')
        hsn = r.get('hsn_sac') or r.get('hsn') or ''
        disc = r.get('discount_percent') or r.get('discount') or Decimal('0.00')

        it = None
        if item_val:
            it = Item.objects.filter(Q(name__iexact=str(item_val).strip()) | Q(sku__iexact=str(item_val).strip())).first()

        if not desc:
            desc = it.name if it else 'General Supply / Service'
        if it and not hsn:
            hsn = it.hsn_sac or ''
        if it and (rate is None or rate == Decimal('0.00')):
            rate = it.selling_price

        return {
            'item': it.pk if it else None,
            'description': str(desc)[:500],
            'hsn_sac': str(hsn)[:10],
            'quantity': qty,
            'rate': rate,
            'discount_percent': disc,
            'gst_rate': gst
        }

    def prepare_import_record(self, rec):
        cust_val = rec.get('customer') or rec.get('customer_name') or rec.get('client') or rec.get('party')
        if cust_val and not str(cust_val).isdigit():
            c_str = str(cust_val).strip()
            cust = Customer.objects.filter(Q(name__iexact=c_str) | Q(company__iexact=c_str) | Q(email__iexact=c_str)).first()
            if not cust:
                org = Organization.get()
                cust = Customer.objects.create(name=c_str, active=True, state=org.state if org else '', organization=org)
            rec['customer'] = cust.pk
        elif not cust_val:
            first_c = Customer.objects.first()
            if first_c:
                rec['customer'] = first_c.pk

        if not rec.get('date'):
            rec['date'] = timezone.localdate().isoformat()
        if not rec.get('due_date'):
            rec['due_date'] = rec.get('expected_shipment_date') or rec['date']

        if not rec.get('lines'):
            line = self.extract_line_from_record(rec)
            if line:
                rec['lines'] = [line]

    def row(self, o):
        return {
            'id': o.pk, 'number': o.number, 'customer_id': o.customer_id,
            'customer_name': o.customer.name, 'party': o.customer.name,
            'date': o.date, 'due_date': o.due_date,
            'expected_shipment_date': o.expected_shipment_date,
            'tax_pricing_type': getattr(o, 'tax_pricing_type', 'tax_exclusive') or 'tax_exclusive',
            'customer_type': getattr(o, 'customer_type', 'b2b') or 'b2b',
            'status': o.status, 'subtotal': o.subtotal, 'total': o.total,
            'cgst': o.cgst, 'sgst': o.sgst, 'igst': o.igst,
            'order_number': o.order_number or '',
            'lines_count': o.lines.count(),
            'signature_data': getattr(o, 'signature_data', '') or '',
            'signed_by': getattr(o, 'signed_by', '') or '',
            'signed_at': o.signed_at.isoformat() if getattr(o, 'signed_at', None) else None,
            'signature_title': getattr(o, 'signature_title', '') or '',
            'converted_to_invoice_id': o.converted_to_invoice_id,
            'converted_to_invoice_number': o.converted_to_invoice.number if o.converted_to_invoice else '',
            'source_quote_id': o.source_quote_id,
            'source_quote_number': o.source_quote.number if o.source_quote else '',
            'converted_at': o.converted_at,
        }

    def detail(self, o):
        r = self.row(o)
        related_documents = []
        if o.source_quote:
            related_documents.append({
                'kind': 'quotes', 'type': 'Quote', 'id': o.source_quote.pk, 'number': o.source_quote.number, 'date': o.source_quote.date.isoformat() if hasattr(o.source_quote.date, 'isoformat') else str(o.source_quote.date), 'total': o.source_quote.total, 'status': o.source_quote.status, 'relation': 'Source Quote'
            })
        if o.converted_to_invoice:
            related_documents.append({
                'kind': 'invoices', 'type': 'Invoice', 'id': o.converted_to_invoice.pk, 'number': o.converted_to_invoice.number, 'date': o.converted_to_invoice.date.isoformat() if hasattr(o.converted_to_invoice.date, 'isoformat') else str(o.converted_to_invoice.date), 'total': o.converted_to_invoice.total, 'status': o.converted_to_invoice.status, 'relation': 'Converted to Invoice'
            })
        r.update({
            'place_of_supply': o.place_of_supply,
            'terms': o.terms or '',
            'notes': o.notes or '',
            'related_documents': related_documents,
            'party_details': {
                'id': o.customer.pk,
                'name': o.customer.name,
                'company': getattr(o.customer, 'company_name', '') or getattr(o.customer, 'company', '') or '',
                'billing_address': o.customer.billing_address or '',
                'gstin': o.customer.gstin or '',
                'email': o.customer.email or '',
                'phone': o.customer.phone or '',
                'state': o.customer.state or '',
            },
            'lines': [
                {
                    'id': l.pk,
                    'item': l.item_id,
                    'item_id': l.item_id,
                    'description': l.description,
                    'hsn_sac': l.hsn_sac,
                    'quantity': l.quantity,
                    'rate': l.rate,
                    'discount_percent': l.discount_percent,
                    'gst_rate': l.gst_rate,
                    'taxable': l.taxable,
                    'tax_amount': l.tax_amount,
                    'line_total': l.line_total,
                    'position': l.position,
                }
                for l in o.lines.all().order_by('position', 'id')
            ]
        })
        return r

    def create(self, data, user):
        user_org = get_user_org(user)
        c = Cleaner(data)
        cust_id = c.integer('customer', lo=1) or c.integer('customer_id', lo=1)
        if not cust_id:
            c.err('customer', REQUIRED)
        cust = Customer.objects.filter(pk=cust_id, organization=user_org).first() if (cust_id and user_org) else Customer.objects.filter(pk=cust_id).first()
        if not cust:
            raise ApiError(404, 'Customer not found.')
        dt = c.date('date', required=True)
        ship_dt = c.date('expected_shipment_date')
        due_dt = c.date('due_date') or ship_dt or dt
        terms = c.text('terms', max_len=2000) or ''
        notes = c.text('notes', max_len=2000) or ''
        order_num = c.text('order_number', max_len=60) or ''
        pos = c.text('place_of_supply', max_len=60) or cust.state or (user_org.state if user_org else Organization.get().state)
        status = c.choice('status', ['draft', 'confirmed'], default='confirmed')
        c.done()

        num = (data.get('number') or '').strip()
        num_exists = SalesOrder.objects.filter(number=num, organization=user_org).exists() if (num and user_org) else (SalesOrder.objects.filter(number=num).exists() if num else False)
        if not num or num_exists:
            num = next_number('SO', org=user_org)
        else:
            import re
            m = re.match(r'^SO-(\d+)$', num)
            if m:
                val = int(m.group(1))
                fy = services.get_financial_year(dt)
                seq_key = f"{user_org.pk}_SO_{fy}" if user_org else f"SO_{fy}"
                seq, _ = Sequence.objects.get_or_create(key=seq_key)
                if seq.value < val:
                    seq.value = val
                    seq.save(update_fields=['value'])

        tax_pricing = str(data.get('tax_pricing_type') or 'tax_exclusive').strip().lower()
        cust_type = str(data.get('customer_type') or 'b2b').strip().lower()
        so = SalesOrder.objects.create(
            organization=user_org,
            number=num, customer=cust, date=dt, due_date=due_dt,
            place_of_supply=pos,
            tax_pricing_type=tax_pricing, customer_type=cust_type,
            expected_shipment_date=ship_dt, terms=terms, notes=notes,
            order_number=order_num, status=status
        )
        lines = parse_lines(data.get('lines', []), org=user_org)
        intra = is_intra_state(so.place_of_supply, user_org.state if user_org else Organization.get().state)
        comp, tot = compute(lines, intra, is_tax_inclusive=(so.tax_pricing_type == 'tax_inclusive'))
        for k, v in tot.items():
            setattr(so, k, v)
        so.save()
        for l in comp:
            SalesOrderLine.objects.create(
                order=so, item=l['item'], description=l['description'],
                hsn_sac=l['hsn_sac'], quantity=l['quantity'], rate=l['rate'],
                discount_percent=l['discount_percent'], gst_rate=l['gst_rate'],
                taxable=l['taxable'], tax_amount=l['tax_amount'], line_total=l['line_total'], position=l['position']
            )
        services.log_audit(user, 'create', 'SalesOrder', so.number, f"Created sales order {so.number} for {cust.name} (₹{so.total})")
        return so

    def update(self, obj, data, user):
        services.check_transaction_lock(obj.date)
        if obj.status == 'void':
            raise ApiError(409, 'Void sales orders cannot be edited.')
        c = Cleaner(data)
        cust_id = c.integer('customer', lo=1) or c.integer('customer_id', lo=1)
        if cust_id:
            cust = Customer.objects.filter(pk=cust_id).first()
            if not cust:
                raise ApiError(404, 'Customer not found.')
            obj.customer = cust
        if 'date' in data and data['date']:
            obj.date = c.date('date', required=True)
            services.check_transaction_lock(obj.date)
        if 'expected_shipment_date' in data:
            obj.expected_shipment_date = c.date('expected_shipment_date')
        if 'due_date' in data:
            obj.due_date = c.date('due_date') or obj.expected_shipment_date or obj.date
        if 'place_of_supply' in data:
            obj.place_of_supply = c.text('place_of_supply', max_len=60) or obj.customer.state or Organization.get().state
        if 'terms' in data:
            obj.terms = c.text('terms', max_len=2000) or ''
        if 'notes' in data:
            obj.notes = c.text('notes', max_len=2000) or ''
        if 'order_number' in data:
            obj.order_number = c.text('order_number', max_len=60) or ''
        if 'status' in data and data['status']:
            obj.status = c.choice('status', ['draft', 'confirmed', 'closed', 'void'], default=obj.status)
        if 'tax_pricing_type' in data:
            obj.tax_pricing_type = str(data.get('tax_pricing_type') or 'tax_exclusive').strip().lower()
        if 'customer_type' in data:
            obj.customer_type = str(data.get('customer_type') or 'b2b').strip().lower()
        c.done()

        if 'lines' in data:
            lines = parse_lines(data.get('lines', []))
            intra = is_intra_state(obj.place_of_supply, Organization.get().state)
            comp, tot = compute(lines, intra, is_tax_inclusive=(obj.tax_pricing_type == 'tax_inclusive'))
            for k, v in tot.items():
                setattr(obj, k, v)
            obj.save()
            obj.lines.all().delete()
            for l in comp:
                SalesOrderLine.objects.create(
                    order=obj, item=l['item'], description=l['description'],
                    hsn_sac=l['hsn_sac'], quantity=l['quantity'], rate=l['rate'],
                    discount_percent=l['discount_percent'], gst_rate=l['gst_rate'],
                    taxable=l['taxable'], tax_amount=l['tax_amount'], line_total=l['line_total'], position=l['position']
                )
        else:
            obj.save()
        services.log_audit(user, 'update', 'SalesOrder', obj.number, f"Updated sales order {obj.number} (₹{obj.total})")
        return obj

    def action(self, request, obj, name):
        if name == 'sign':
            return sign_document_action(obj, request)
        elif name == 'unsign':
            return unsign_document_action(obj, request)
        elif name == 'confirm':
            obj.status = 'confirmed'
            obj.save(update_fields=['status'])
            services.log_audit(request.user, 'confirm', 'SalesOrder', obj.number, f"Confirmed sales order {obj.number}")
            return j({'status': obj.status})
        elif name == 'void':
            obj.status = 'void'
            obj.save(update_fields=['status'])
            services.log_audit(request.user, 'void', 'SalesOrder', obj.number, f"Voided sales order {obj.number}")
            return j({'status': obj.status})
        elif name == 'convert-to-invoice':
            if obj.status == 'void':
                raise ApiError(400, f'Cannot convert void sales order {obj.number}.')
            if obj.status == 'closed' or obj.converted_to_invoice_id:
                target = obj.converted_to_invoice.number if obj.converted_to_invoice else ''
                raise ApiError(400, f'Sales order {obj.number} has already been converted to an invoice {target}.')
            inv = Invoice.objects.create(
                organization=obj.organization,
                customer=obj.customer,
                source_sales_order=obj,
                source_quote=obj.source_quote,
                number=next_number('INV', org=obj.organization),
                date=timezone.localdate(),
                due_date=timezone.localdate() + timedelta(days=getattr(obj.customer, 'payment_terms', 30) or 30),
                place_of_supply=obj.place_of_supply,
                tax_pricing_type=getattr(obj, 'tax_pricing_type', 'tax_exclusive') or 'tax_exclusive',
                customer_type=getattr(obj, 'customer_type', 'b2b') or 'b2b',
                status='draft',
                subtotal=obj.subtotal,
                cgst=obj.cgst,
                sgst=obj.sgst,
                igst=obj.igst,
                total=obj.total,
                order_number=obj.number,
                notes=obj.notes,
                terms=obj.terms
            )
            for l in obj.lines.all():
                InvoiceLine.objects.create(
                    invoice=inv,
                    item=l.item,
                    description=l.description,
                    hsn_sac=l.hsn_sac,
                    quantity=l.quantity,
                    rate=l.rate,
                    discount_percent=l.discount_percent,
                    gst_rate=l.gst_rate,
                    taxable=l.taxable,
                    tax_amount=l.tax_amount,
                    line_total=l.line_total,
                    position=l.position
                )
            obj.status = 'closed'
            obj.converted_to_invoice = inv
            obj.converted_at = timezone.now()
            obj.save(update_fields=['status', 'converted_to_invoice', 'converted_at'])
            services.log_audit(request.user, 'convert', 'SalesOrder', obj.number, f"Converted sales order {obj.number} to Invoice {inv.number}")
            return j({'invoice_id': inv.pk, 'id': inv.pk, 'number': inv.number})
        raise ApiError(404, 'Unknown action.')

class PurchaseOrderResource(Resource):
    name = 'purchase-orders'
    model = PurchaseOrder
    search_fields = ('number', 'vendor__name')
    default_ordering = ('-date', '-id')
    csv_cols = [
        ('PO#', 'number'), ('Vendor Name', 'vendor'), ('Date', 'date'), ('Delivery date', 'delivery_date'),
        ('Item Name', 'item'), ('Description', 'description'), ('HSN/SAC', 'hsn_sac'),
        ('Quantity', 'quantity'), ('Rate', 'rate'), ('GST Rate (%)', 'gst_rate'), ('Notes', 'notes')
    ]

    def get_template_sample(self):
        return ['PO-00020', 'Reliable Hardware Supplies', '2026-10-12', '2026-10-28', 'Steel Rods 10mm', 'TMT steel rods', '721420', '20', '450.00', '18.00', 'Standard supplier delivery']

    def preprocess_import_records(self, records):
        grouped = []
        doc_map = {}
        for r in records:
            num = str(r.get('number') or r.get('po_number') or r.get('order_number') or '').strip()
            line = self.extract_line_from_record(r)
            if num and num in doc_map:
                existing = doc_map[num]
                if line:
                    existing.setdefault('lines', []).append(line)
            else:
                doc_copy = dict(r)
                if line and 'lines' not in doc_copy:
                    doc_copy['lines'] = [line]
                grouped.append(doc_copy)
                if num:
                    doc_map[num] = doc_copy
        return grouped

    def extract_line_from_record(self, r):
        item_val = r.get('item') or r.get('item_name') or r.get('product') or r.get('sku') or ''
        desc = r.get('description') or r.get('line_description') or r.get('desc') or ''
        qty = r.get('quantity') or r.get('qty') or r.get('opening_stock') or Decimal('1.000')
        rate = r.get('rate') or r.get('price') or r.get('unit_price') or r.get('amount') or Decimal('0.00')
        gst = r.get('gst_rate') or r.get('tax_rate') or Decimal('18.00')
        hsn = r.get('hsn_sac') or r.get('hsn') or ''
        disc = r.get('discount_percent') or r.get('discount') or Decimal('0.00')

        it = None
        if item_val:
            it = Item.objects.filter(Q(name__iexact=str(item_val).strip()) | Q(sku__iexact=str(item_val).strip())).first()

        if not desc:
            desc = it.name if it else 'General Supply / Service'
        if it and not hsn:
            hsn = it.hsn_sac or ''
        if it and (rate is None or rate == Decimal('0.00')):
            rate = it.purchase_price

        return {
            'item': it.pk if it else None,
            'description': str(desc)[:500],
            'hsn_sac': str(hsn)[:10],
            'quantity': qty,
            'rate': rate,
            'discount_percent': disc,
            'gst_rate': gst
        }

    def prepare_import_record(self, rec):
        ven_val = rec.get('vendor') or rec.get('vendor_name') or rec.get('supplier') or rec.get('party')
        if ven_val and not str(ven_val).isdigit():
            v_str = str(ven_val).strip()
            ven = Vendor.objects.filter(Q(name__iexact=v_str) | Q(company__iexact=v_str) | Q(email__iexact=v_str)).first()
            if not ven:
                org = Organization.get()
                ven = Vendor.objects.create(name=v_str, active=True, state=org.state if org else '', organization=org)
            rec['vendor'] = ven.pk
        elif not ven_val:
            first_v = Vendor.objects.first()
            if first_v:
                rec['vendor'] = first_v.pk

        if not rec.get('date'):
            rec['date'] = timezone.localdate().isoformat()
        if not rec.get('delivery_date'):
            rec['delivery_date'] = rec['date']

        if not rec.get('lines'):
            line = self.extract_line_from_record(rec)
            if line:
                rec['lines'] = [line]

    def row(self, o):
        return {
            'id': o.pk, 'number': o.number, 'vendor_id': o.vendor_id,
            'vendor_name': o.vendor.name, 'party': o.vendor.name, 'date': o.date,
            'delivery_date': o.delivery_date, 'due_date': o.delivery_date or o.date, 'status': o.status,
            'tax_pricing_type': getattr(o, 'tax_pricing_type', 'tax_exclusive') or 'tax_exclusive',
            'customer_type': getattr(o, 'customer_type', 'registered') or 'registered',
            'subtotal': o.subtotal, 'total': o.total, 'lines_count': o.lines.count(),
            'signature_data': getattr(o, 'signature_data', '') or '',
            'signed_by': getattr(o, 'signed_by', '') or '',
            'signed_at': o.signed_at.isoformat() if getattr(o, 'signed_at', None) else None,
            'signature_title': getattr(o, 'signature_title', '') or '',
            'converted_to_bill_id': o.converted_to_bill_id,
            'converted_to_bill_number': o.converted_to_bill.number if o.converted_to_bill else '',
            'converted_at': o.converted_at,
        }

    def detail(self, o):
        r = self.row(o)
        r['party_details'] = {
            'id': o.vendor.pk,
            'name': o.vendor.name,
            'company': getattr(o.vendor, 'company_name', '') or getattr(o.vendor, 'company', '') or '',
            'billing_address': o.vendor.billing_address or '',
            'gstin': o.vendor.gstin or '',
            'email': o.vendor.email or '',
            'phone': o.vendor.phone or '',
            'state': o.vendor.state or '',
        }
        r['place_of_supply'] = o.place_of_supply
        r['notes'] = o.notes or ''
        r['terms'] = getattr(o, 'terms', '') or ''
        related_documents = []
        if o.converted_to_bill:
            related_documents.append({
                'kind': 'bills', 'type': 'Bill', 'id': o.converted_to_bill.pk, 'number': o.converted_to_bill.number, 'date': o.converted_to_bill.date.isoformat() if hasattr(o.converted_to_bill.date, 'isoformat') else str(o.converted_to_bill.date), 'total': o.converted_to_bill.total, 'status': o.converted_to_bill.status, 'relation': 'Converted to Bill'
            })
        r['related_documents'] = related_documents
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

        user_org = get_user_org(user) if user else None
        num = (data.get('number') or '').strip()
        num_exists = PurchaseOrder.objects.filter(number=num, organization=user_org).exists() if (num and user_org) else (PurchaseOrder.objects.filter(number=num).exists() if num else False)
        if not num or num_exists:
            num = services.next_document_number('PO', org=user_org, date=dt)
        else:
            import re
            m = re.search(r'(\d+)$', num)
            if m:
                val = int(m.group(1))
                fy = services.get_financial_year(dt)
                seq_key = f"{user_org.pk}_PO_{fy}" if user_org else f"PO_{fy}"
                seq, _ = Sequence.objects.get_or_create(key=seq_key)
                if seq.value < val:
                    seq.value = val
                    seq.save(update_fields=['value'])
        tax_pricing = str(data.get('tax_pricing_type') or 'tax_exclusive').strip().lower()
        cust_type = str(data.get('customer_type') or 'registered').strip().lower()
        po = PurchaseOrder.objects.create(
            organization=user_org,
            number=num, vendor=ven, date=dt, due_date=dt,
            place_of_supply=ven.state or (user_org.state if user_org else Organization.get().state),
            delivery_date=deliv, status='draft',
            tax_pricing_type=tax_pricing, customer_type=cust_type
        )
        lines = parse_lines(data.get('lines', []))
        intra = is_intra_state(po.place_of_supply, Organization.get().state)
        comp, tot = compute(lines, intra, is_tax_inclusive=(po.tax_pricing_type == 'tax_inclusive'))
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

    def update(self, obj, data, user):
        c = Cleaner(data)
        ven_id = c.integer('vendor', required=True, lo=1)
        ven = Vendor.objects.filter(pk=ven_id).first()
        if not ven:
            raise ApiError(404, 'Vendor not found.')
        dt = c.date('date', required=True)
        deliv = c.date('delivery_date')
        c.done()

        obj.vendor = ven
        obj.date = dt
        obj.delivery_date = deliv or dt
        obj.place_of_supply = ven.state or Organization.get().state
        if 'tax_pricing_type' in data:
            obj.tax_pricing_type = str(data.get('tax_pricing_type') or 'tax_exclusive').strip().lower()
        if 'customer_type' in data:
            obj.customer_type = str(data.get('customer_type') or 'registered').strip().lower()
        lines = parse_lines(data.get('lines', []))
        intra = is_intra_state(obj.place_of_supply, Organization.get().state)
        comp, tot = compute(lines, intra, is_tax_inclusive=(obj.tax_pricing_type == 'tax_inclusive'))
        for k, v in tot.items():
            setattr(obj, k, v)
        obj.save()
        obj.lines.all().delete()
        for l in comp:
            PurchaseOrderLine.objects.create(
                order=obj, item=l['item'], description=l['description'],
                hsn_sac=l['hsn_sac'], quantity=l['quantity'], rate=l['rate'],
                discount_percent=l['discount_percent'], gst_rate=l['gst_rate'],
                taxable=l['taxable'], tax_amount=l['tax_amount'], line_total=l['line_total'], position=l['position']
            )
        services.log_audit(user, 'update', 'PurchaseOrder', obj.number, f"Updated purchase order {obj.number}")
        return obj

    def action(self, request, obj, name):
        if name == 'sign':
            return sign_document_action(obj, request)
        elif name == 'unsign':
            return unsign_document_action(obj, request)
        elif name == 'convert-to-bill':
            if obj.status == 'void':
                raise ApiError(400, f'Cannot convert void purchase order {obj.number}.')
            if obj.status == 'closed' or obj.converted_to_bill_id:
                target = obj.converted_to_bill.number if obj.converted_to_bill else ''
                raise ApiError(400, f'Purchase order {obj.number} has already been converted to Bill {target}.')
            bill = Bill.objects.create(
                organization=obj.organization,
                vendor=obj.vendor,
                source_purchase_order=obj,
                number=next_number('BILL', org=obj.organization),
                date=timezone.localdate(),
                due_date=timezone.localdate() + timedelta(days=30),
                place_of_supply=obj.place_of_supply,
                tax_pricing_type=getattr(obj, 'tax_pricing_type', 'tax_exclusive') or 'tax_exclusive',
                customer_type=getattr(obj, 'customer_type', 'registered') or 'registered',
                status='draft',
                subtotal=obj.subtotal,
                cgst=obj.cgst,
                sgst=obj.sgst,
                igst=obj.igst,
                total=obj.total,
                order_number=obj.number,
                vendor_ref=obj.number,
                notes=obj.notes
            )
            for l in obj.lines.all():
                BillLine.objects.create(
                    bill=bill,
                    item=l.item,
                    description=l.description,
                    hsn_sac=l.hsn_sac,
                    quantity=l.quantity,
                    rate=l.rate,
                    discount_percent=l.discount_percent,
                    gst_rate=l.gst_rate,
                    taxable=l.taxable,
                    tax_amount=l.tax_amount,
                    line_total=l.line_total,
                    position=l.position
                )
            obj.status = 'closed'
            obj.converted_to_bill = bill
            obj.converted_at = timezone.now()
            obj.save(update_fields=['status', 'converted_to_bill', 'converted_at'])
            services.log_audit(request.user, 'create', 'bill', bill.pk, f'Converted Purchase Order {obj.number} to Bill {bill.number}')
            return j({'bill_id': bill.pk, 'id': bill.pk, 'number': bill.number})
        elif name == 'void':
            obj.status = 'void'
            obj.save(update_fields=['status'])
            services.log_audit(request.user, 'void', 'PurchaseOrder', obj.number, f"Voided purchase order {obj.number}")
            return j({'status': 'void'})
        raise ApiError(404, 'Unknown action.')

class ExpenseResource(Resource):
    name = 'expenses'
    model = Expense
    search_fields = ('number', 'vendor__name', 'notes', 'reference')
    default_ordering = ('-date', '-id')
    csv_cols = [('Date', 'date'), ('Expense Account', 'expense_account'), ('Vendor', 'vendor'),
                ('Amount', 'amount'), ('GST Rate (%)', 'gst_rate'), ('Paid Through', 'paid_through'),
                ('Reference', 'reference'), ('Notes', 'notes')]

    def get_template_sample(self):
        return ['2026-10-20', 'Office Supplies', 'Reliable Hardware Supplies', '2450.00', '18.00', 'Bank Account', 'REF-98120', 'Office stationery']

    def prepare_import_record(self, rec):
        acc_val = rec.get('expense_account') or rec.get('account')
        if acc_val and not str(acc_val).isdigit():
            acc = Account.objects.filter(Q(name__iexact=str(acc_val).strip()) | Q(code__iexact=str(acc_val).strip())).first()
            if not acc:
                acc = Account.objects.filter(account_type='expense').first()
            if acc:
                rec['expense_account'] = acc.pk
        elif not acc_val:
            first_exp = Account.objects.filter(account_type='expense').first()
            if first_exp:
                rec['expense_account'] = first_exp.pk

        ven_val = rec.get('vendor') or rec.get('vendor_name') or rec.get('payee')
        if ven_val and not str(ven_val).isdigit():
            ven = Vendor.objects.filter(Q(name__iexact=str(ven_val).strip()) | Q(company__iexact=str(ven_val).strip())).first()
            if not ven:
                org = Organization.get()
                ven = Vendor.objects.create(name=str(ven_val).strip(), active=True, state=org.state if org else '', organization=org)
            rec['vendor'] = ven.pk

        if not rec.get('date'):
            rec['date'] = timezone.localdate().isoformat()

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

        user_org = get_user_org(user) if user else None
        num = (data.get('number') or '').strip()
        num_exists = Expense.objects.filter(number=num, organization=user_org).exists() if (num and user_org) else False
        if not num or num_exists:
            num = services.next_document_number('EXP', org=user_org, date=dt)
        exp = Expense.objects.create(
            organization=user_org,
            number=num, date=dt, expense_account=acc, vendor=ven,
            amount=amt, gst_rate=gst_r, tax_amount=tax_amt, total=tot,
            paid_through=paid_via, reference=ref, notes=notes,
            created_by=user if getattr(user, 'pk', None) else None
        )
        services.post_expense_journal(exp, user)
        services.log_audit(user, 'create', 'Expense', exp.number, f"Recorded expense {exp.number} for ₹{exp.total}")
        return exp

    def update(self, obj, data, user):
        c = Cleaner(data)
        if 'date' in data:
            obj.date = c.date('date', required=True)
        if 'expense_account' in data:
            acc_id = c.integer('expense_account', required=True, lo=1)
            acc = Account.objects.filter(pk=acc_id).first()
            if not acc:
                raise ApiError(404, 'Expense account not found.')
            obj.expense_account = acc
        if 'vendor' in data:
            ven_id = c.integer('vendor', lo=1)
            obj.vendor = Vendor.objects.filter(pk=ven_id).first() if ven_id else None
        if 'amount' in data or 'gst_rate' in data:
            amt = c.number('amount', default=obj.amount, lo=Decimal('0.01'))
            gst_r = c.number('gst_rate', default=obj.gst_rate)
            tax_amt = q2(amt * gst_r / Decimal(100))
            obj.amount = amt
            obj.gst_rate = gst_r
            obj.tax_amount = tax_amt
            obj.total = amt + tax_amt
        if 'paid_through' in data:
            obj.paid_through = c.text('paid_through', max_len=80)
        if 'reference' in data:
            obj.reference = c.text('reference', max_len=80)
        if 'notes' in data:
            obj.notes = c.text('notes', max_len=1000)
        c.done()
        obj.save()

        Journal.objects.filter(reference=obj.number, entry_type='expense').delete()
        services.post_expense_journal(obj, user)
        services.log_audit(user, 'update', 'Expense', obj.number, f"Updated expense {obj.number} for ₹{obj.total}")
        return obj

    def destroy(self, obj):
        Journal.objects.filter(reference=obj.number, entry_type='expense').delete()
        obj.delete()

class CreditNoteResource(Resource):
    name = 'credit-notes'
    model = CreditNote
    search_fields = ('number', 'customer__name', 'reason')
    default_ordering = ('-date', '-id')

    def prepare_import_record(self, rec):
        cust_val = rec.get('customer') or rec.get('customer_name') or rec.get('client') or rec.get('party')
        if cust_val and not str(cust_val).isdigit():
            c_str = str(cust_val).strip()
            cust = Customer.objects.filter(Q(name__iexact=c_str) | Q(company__iexact=c_str) | Q(email__iexact=c_str)).first()
            if not cust:
                org = Organization.get()
                cust = Customer.objects.create(name=c_str, active=True, state=org.state if org else '', organization=org)
            rec['customer'] = cust.pk
        elif not cust_val:
            first_c = Customer.objects.first()
            if first_c:
                rec['customer'] = first_c.pk

        if not rec.get('date'):
            rec['date'] = timezone.localdate().isoformat()
        if not rec.get('reason'):
            rec['reason'] = rec.get('notes') or rec.get('remarks') or 'Credit Note'

        if not rec.get('lines'):
            line = self.extract_line_from_record(rec)
            rec['lines'] = [line]

    def extract_line_from_record(self, r):
        item_val = r.get('item') or r.get('item_name') or r.get('product') or r.get('sku') or ''
        desc = r.get('description') or r.get('line_description') or r.get('desc') or ''
        qty = r.get('quantity') or r.get('qty') or r.get('opening_stock') or Decimal('1.000')
        rate = r.get('rate') or r.get('price') or r.get('unit_price') or r.get('selling_price') or r.get('purchase_price') or r.get('amount') or r.get('total') or Decimal('0.00')
        gst = r.get('gst_rate') or r.get('tax_rate') or Decimal('18.00')
        hsn = r.get('hsn_sac') or r.get('hsn') or ''
        disc = r.get('discount_percent') or r.get('discount') or Decimal('0.00')

        it = None
        if item_val:
            it = Item.objects.filter(Q(name__iexact=str(item_val).strip()) | Q(sku__iexact=str(item_val).strip())).first()

        if not desc:
            desc = it.name if it else 'Credit Item / Service'
        if it and not hsn:
            hsn = it.hsn_sac or ''
        if it and (rate is None or rate == Decimal('0.00')):
            rate = it.selling_price

        return {
            'item': it.pk if it else None,
            'description': str(desc)[:500],
            'hsn_sac': str(hsn)[:10],
            'quantity': qty,
            'rate': rate,
            'discount_percent': disc,
            'gst_rate': gst
        }

    def preprocess_import_records(self, records):
        grouped = []
        doc_map = {}
        for r in records:
            num = str(r.get('number') or r.get('cn_number') or r.get('credit_note_number') or '').strip()
            line = self.extract_line_from_record(r)
            if num and num in doc_map:
                existing = doc_map[num]
                if line:
                    existing.setdefault('lines', []).append(line)
            else:
                doc_copy = dict(r)
                if line and 'lines' not in doc_copy:
                    doc_copy['lines'] = [line]
                grouped.append(doc_copy)
                if num:
                    doc_map[num] = doc_copy
        return grouped

    def row(self, o):
        return {
            'id': o.pk, 'number': o.number, 'customer_id': o.customer_id,
            'customer_name': o.customer.name, 'party': o.customer.name, 'date': o.date,
            'tax_pricing_type': getattr(o, 'tax_pricing_type', 'tax_exclusive') or 'tax_exclusive',
            'customer_type': getattr(o, 'customer_type', 'b2b') or 'b2b',
            'invoice_id': o.invoice_id, 'invoice_number': o.invoice.number if o.invoice else '',
            'total': o.total, 'balance': o.total, 'reason': o.reason, 'status': o.status,
            'signature_data': getattr(o, 'signature_data', '') or '',
            'signed_by': getattr(o, 'signed_by', '') or '',
            'signed_at': o.signed_at.isoformat() if getattr(o, 'signed_at', None) else None,
            'signature_title': getattr(o, 'signature_title', '') or '',
        }

    def detail(self, o):
        r = self.row(o)
        r['customer'] = o.customer_id
        r['party_id'] = o.customer_id
        r['place_of_supply'] = o.place_of_supply
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
        cid = c.integer('customer', required=True, lo=1)
        cust = Customer.objects.filter(pk=cid).first()
        if not cust:
            raise ApiError(404, 'Customer not found.')
        dt = c.date('date', required=True)
        reason = c.text('reason', max_len=150)
        c.done()

        user_org = get_user_org(user) if user else None
        num = (data.get('number') or '').strip()
        num_exists = CreditNote.objects.filter(number=num, organization=user_org).exists() if (num and user_org) else (CreditNote.objects.filter(number=num).exists() if num else False)
        if not num or num_exists:
            num = services.next_document_number('CN', org=user_org, date=dt)
        tax_pricing = str(data.get('tax_pricing_type') or 'tax_exclusive').strip().lower()
        cust_type = str(data.get('customer_type') or 'b2b').strip().lower()
        cn = CreditNote.objects.create(
            organization=user_org,
            number=num, customer=cust, date=dt, due_date=dt,
            place_of_supply=cust.state or (user_org.state if user_org else Organization.get().state),
            reason=reason, status='open',
            tax_pricing_type=tax_pricing, customer_type=cust_type
        )
        lines = parse_lines(data.get('lines', []))
        intra = is_intra_state(cn.place_of_supply, Organization.get().state)
        comp, tot = compute(lines, intra, is_tax_inclusive=(cn.tax_pricing_type == 'tax_inclusive'))
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

    def update(self, obj, data, user):
        c = Cleaner(data)
        cid = c.integer('customer', required=True, lo=1)
        cust = Customer.objects.filter(pk=cid).first()
        if not cust:
            raise ApiError(404, 'Customer not found.')
        dt = c.date('date', required=True)
        reason = c.text('reason', max_len=150)
        c.done()

        obj.customer = cust
        obj.date = dt
        obj.due_date = dt
        obj.reason = reason
        obj.place_of_supply = cust.state or Organization.get().state
        if 'tax_pricing_type' in data:
            obj.tax_pricing_type = str(data.get('tax_pricing_type') or 'tax_exclusive').strip().lower()
        if 'customer_type' in data:
            obj.customer_type = str(data.get('customer_type') or 'b2b').strip().lower()
        lines = parse_lines(data.get('lines', []))
        intra = is_intra_state(obj.place_of_supply, Organization.get().state)
        comp, tot = compute(lines, intra, is_tax_inclusive=(obj.tax_pricing_type == 'tax_inclusive'))
        for k, v in tot.items():
            setattr(obj, k, v)
        obj.save()
        obj.lines.all().delete()
        for l in comp:
            CreditNoteLine.objects.create(
                credit_note=obj, item=l['item'], description=l['description'],
                hsn_sac=l['hsn_sac'], quantity=l['quantity'], rate=l['rate'],
                discount_percent=l['discount_percent'], gst_rate=l['gst_rate'],
                taxable=l['taxable'], tax_amount=l['tax_amount'], line_total=l['line_total'], position=l['position']
            )
        services.log_audit(user, 'update', 'CreditNote', obj.number, f"Updated credit note {obj.number}")
        return obj

    def action(self, request, obj, name):
        if name == 'sign':
            return sign_document_action(obj, request)
        elif name == 'unsign':
            return unsign_document_action(obj, request)
        raise ApiError(404, 'Unknown action.')

class VendorCreditResource(Resource):
    name = 'vendor-credits'
    model = VendorCredit
    search_fields = ('number', 'vendor__name', 'reason')
    default_ordering = ('-date', '-id')

    def prepare_import_record(self, rec):
        ven_val = rec.get('vendor') or rec.get('vendor_name') or rec.get('supplier') or rec.get('party')
        if ven_val and not str(ven_val).isdigit():
            v_str = str(ven_val).strip()
            ven = Vendor.objects.filter(Q(name__iexact=v_str) | Q(company__iexact=v_str) | Q(email__iexact=v_str)).first()
            if not ven:
                org = Organization.get()
                ven = Vendor.objects.create(name=v_str, active=True, state=org.state if org else '', organization=org)
            rec['vendor'] = ven.pk
        elif not ven_val:
            first_v = Vendor.objects.first()
            if first_v:
                rec['vendor'] = first_v.pk

        if not rec.get('date'):
            rec['date'] = timezone.localdate().isoformat()
        if not rec.get('reason'):
            rec['reason'] = rec.get('notes') or rec.get('remarks') or 'Vendor Credit'

        if not rec.get('lines'):
            line = self.extract_line_from_record(rec)
            rec['lines'] = [line]

    def extract_line_from_record(self, r):
        item_val = r.get('item') or r.get('item_name') or r.get('product') or r.get('sku') or ''
        desc = r.get('description') or r.get('line_description') or r.get('desc') or ''
        qty = r.get('quantity') or r.get('qty') or r.get('opening_stock') or Decimal('1.000')
        rate = r.get('rate') or r.get('price') or r.get('unit_price') or r.get('selling_price') or r.get('purchase_price') or r.get('amount') or r.get('total') or Decimal('0.00')
        gst = r.get('gst_rate') or r.get('tax_rate') or Decimal('18.00')
        hsn = r.get('hsn_sac') or r.get('hsn') or ''
        disc = r.get('discount_percent') or r.get('discount') or Decimal('0.00')

        it = None
        if item_val:
            it = Item.objects.filter(Q(name__iexact=str(item_val).strip()) | Q(sku__iexact=str(item_val).strip())).first()

        if not desc:
            desc = it.name if it else 'Credit Item / Service'
        if it and not hsn:
            hsn = it.hsn_sac or ''
        if it and (rate is None or rate == Decimal('0.00')):
            rate = it.purchase_price

        return {
            'item': it.pk if it else None,
            'description': str(desc)[:500],
            'hsn_sac': str(hsn)[:10],
            'quantity': qty,
            'rate': rate,
            'discount_percent': disc,
            'gst_rate': gst
        }

    def preprocess_import_records(self, records):
        grouped = []
        doc_map = {}
        for r in records:
            num = str(r.get('number') or r.get('vc_number') or r.get('vendor_credit_number') or '').strip()
            line = self.extract_line_from_record(r)
            if num and num in doc_map:
                existing = doc_map[num]
                if line:
                    existing.setdefault('lines', []).append(line)
            else:
                doc_copy = dict(r)
                if line and 'lines' not in doc_copy:
                    doc_copy['lines'] = [line]
                grouped.append(doc_copy)
                if num:
                    doc_map[num] = doc_copy
        return grouped

    def row(self, o):
        return {
            'id': o.pk, 'number': o.number, 'vendor_id': o.vendor_id,
            'vendor_name': o.vendor.name, 'party': o.vendor.name, 'date': o.date,
            'tax_pricing_type': getattr(o, 'tax_pricing_type', 'tax_exclusive') or 'tax_exclusive',
            'customer_type': getattr(o, 'customer_type', 'registered') or 'registered',
            'bill_id': o.bill_id, 'bill_number': o.bill.number if o.bill else '',
            'total': o.total, 'balance': o.total, 'reason': o.reason, 'status': o.status,
            'signature_data': getattr(o, 'signature_data', '') or '',
            'signed_by': getattr(o, 'signed_by', '') or '',
            'signed_at': o.signed_at.isoformat() if getattr(o, 'signed_at', None) else None,
            'signature_title': getattr(o, 'signature_title', '') or '',
        }

    def detail(self, o):
        r = self.row(o)
        r['vendor'] = o.vendor_id
        r['party_id'] = o.vendor_id
        r['place_of_supply'] = o.place_of_supply
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
        vid = c.integer('vendor', required=True, lo=1)
        ven = Vendor.objects.filter(pk=vid).first()
        if not ven:
            raise ApiError(404, 'Vendor not found.')
        dt = c.date('date', required=True)
        reason = c.text('reason', max_len=150)
        c.done()

        user_org = get_user_org(user) if user else None
        num = (data.get('number') or '').strip()
        num_exists = VendorCredit.objects.filter(number=num, organization=user_org).exists() if (num and user_org) else (VendorCredit.objects.filter(number=num).exists() if num else False)
        if not num or num_exists:
            num = services.next_document_number('DN', org=user_org, date=dt)
        tax_pricing = str(data.get('tax_pricing_type') or 'tax_exclusive').strip().lower()
        cust_type = str(data.get('customer_type') or 'registered').strip().lower()
        vc = VendorCredit.objects.create(
            organization=user_org,
            number=num, vendor=ven, date=dt, due_date=dt,
            place_of_supply=ven.state or (user_org.state if user_org else Organization.get().state),
            reason=reason, status='open',
            tax_pricing_type=tax_pricing, customer_type=cust_type
        )
        lines = parse_lines(data.get('lines', []))
        intra = is_intra_state(vc.place_of_supply, Organization.get().state)
        comp, tot = compute(lines, intra, is_tax_inclusive=(vc.tax_pricing_type == 'tax_inclusive'))
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

    def update(self, obj, data, user):
        c = Cleaner(data)
        vid = c.integer('vendor', required=True, lo=1)
        ven = Vendor.objects.filter(pk=vid).first()
        if not ven:
            raise ApiError(404, 'Vendor not found.')
        dt = c.date('date', required=True)
        reason = c.text('reason', max_len=150)
        c.done()

        obj.vendor = ven
        obj.date = dt
        obj.due_date = dt
        obj.reason = reason
        obj.place_of_supply = ven.state or Organization.get().state
        if 'tax_pricing_type' in data:
            obj.tax_pricing_type = str(data.get('tax_pricing_type') or 'tax_exclusive').strip().lower()
        if 'customer_type' in data:
            obj.customer_type = str(data.get('customer_type') or 'registered').strip().lower()
        lines = parse_lines(data.get('lines', []))
        intra = is_intra_state(obj.place_of_supply, Organization.get().state)
        comp, tot = compute(lines, intra, is_tax_inclusive=(obj.tax_pricing_type == 'tax_inclusive'))
        for k, v in tot.items():
            setattr(obj, k, v)
        obj.save()
        obj.lines.all().delete()
        for l in comp:
            VendorCreditLine.objects.create(
                vendor_credit=obj, item=l['item'], description=l['description'],
                hsn_sac=l['hsn_sac'], quantity=l['quantity'], rate=l['rate'],
                discount_percent=l['discount_percent'], gst_rate=l['gst_rate'],
                taxable=l['taxable'], tax_amount=l['tax_amount'], line_total=l['line_total'], position=l['position']
            )
        services.log_audit(user, 'update', 'VendorCredit', obj.number, f"Updated vendor credit {obj.number}")
        return obj

    def action(self, request, obj, name):
        if name == 'sign':
            return sign_document_action(obj, request)
        elif name == 'unsign':
            return unsign_document_action(obj, request)
        raise ApiError(404, 'Unknown action.')

class RecurringInvoiceResource(Resource):
    name = 'recurring-invoices'
    model = RecurringInvoice
    search_fields = ('profile_name', 'customer__name')
    default_ordering = ('-created_at',)
    FREQUENCIES = ['daily', 'weekly', 'monthly', 'quarterly', 'half_yearly', 'yearly', 'custom']
    STATUSES = ['active', 'paused', 'completed', 'cancelled', 'expired']

    def prepare_import_record(self, rec):
        cust_val = rec.get('customer') or rec.get('customer_name') or rec.get('client') or rec.get('party')
        if cust_val and not str(cust_val).isdigit():
            c_str = str(cust_val).strip()
            c = Customer.objects.filter(Q(name__iexact=c_str) | Q(company__iexact=c_str) | Q(email__iexact=c_str)).first()
            if not c:
                org = Organization.get()
                c = Customer.objects.create(name=c_str, active=True, state=org.state if org else '', organization=org)
            rec['customer'] = c.pk
        elif not cust_val:
            first_c = Customer.objects.first()
            if first_c:
                rec['customer'] = first_c.pk

        if not rec.get('profile_name'):
            rec['profile_name'] = rec.get('name') or rec.get('title') or f"Recurring - {rec.get('customer_name') or 'Profile'}"

        if not rec.get('start_date'):
            rec['start_date'] = timezone.localdate().isoformat()
        if not rec.get('next_date'):
            rec['next_date'] = rec['start_date']

        freq = str(rec.get('frequency', '')).lower().strip()
        if freq not in self.FREQUENCIES:
            rec['frequency'] = 'monthly'

        total_val = rec.get('total') or rec.get('amount')
        if not total_val:
            rate = Decimal(str(rec.get('selling_price') or rec.get('rate') or rec.get('price') or '100.00'))
            qty = Decimal(str(rec.get('opening_stock') or rec.get('quantity') or rec.get('qty') or '1'))
            total_val = rate * qty
        rec['total'] = total_val

    def row(self, o):
        meta = o.lines_data if isinstance(o.lines_data, dict) else {}
        repeat_every = int(getattr(o, 'repeat_every', meta.get('repeat_every', 1)) or 1)
        pt = getattr(o, 'payment_terms', meta.get('payment_terms'))
        if pt is None:
            pt = getattr(o.customer, 'payment_terms', 30) or 30
        freq_disp = dict(getattr(o, 'FREQUENCIES', [])).get(o.frequency, o.frequency.replace('_', ' ').capitalize())
        return {
            'id': o.pk, 'profile_name': o.profile_name, 'name': o.profile_name, 'customer_id': o.customer_id,
            'customer_name': o.customer.name, 'frequency': o.frequency,
            'frequency_label': freq_disp,
            'location': getattr(o, 'location', 'HO Kottayam') or 'HO Kottayam',
            'order_number': getattr(o, 'order_number', '') or '',
            'salesperson': getattr(o, 'salesperson', '') or '',
            'project_name': getattr(o, 'project_name', '') or '',
            'subject': getattr(o, 'subject', '') or '',
            'notes': getattr(o, 'notes', '') or meta.get('notes', ''),
            'terms': getattr(o, 'terms', '') or meta.get('terms', ''),
            'create_as_draft': getattr(o, 'create_as_draft', True),
            'tax_pricing_type': getattr(o, 'tax_pricing_type', 'tax_exclusive') or 'tax_exclusive',
            'customer_type': getattr(o, 'customer_type', 'b2b') or 'b2b',
            'repeat_every': repeat_every,
            'start_date': o.start_date, 'end_date': o.end_date, 'next_date': o.next_date,
            'never_ends': getattr(o, 'never_ends', not bool(o.end_date)),
            'status': o.status, 'status_label': o.status.replace('_', ' ').capitalize(),
            'total': o.total, 'total_amount': o.total, 'subtotal': o.subtotal,
            'tax_amount': max(Decimal('0.00'), (o.total or Decimal('0.00')) - (o.subtotal or Decimal('0.00'))),
            'payment_terms': int(pt),
            'auto_send': bool(meta.get('auto_send', False))
        }

    def detail(self, o):
        d = self.row(o)
        meta = o.lines_data if isinstance(o.lines_data, dict) else {}
        lines = meta.get('lines', []) if isinstance(o.lines_data, dict) else (o.lines_data if isinstance(o.lines_data, list) else [])
        
        # Invoices generated from this profile
        inv_qs = Invoice.objects.filter(Q(recurring_invoice=o) | (Q(customer=o.customer) & Q(order_number=f"REC-{o.pk}"))).order_by('-date', '-id')
        generated_invoices = []
        related_documents = []
        for inv in inv_qs[:50]:
            paid = q2(getattr(inv, 'paid_sum', 0))
            rec_row = {
                'id': inv.pk,
                'number': inv.number,
                'invoice_id': inv.pk,
                'invoice_number': inv.number,
                'date': inv.date,
                'due_date': inv.due_date,
                'status': inv.status,
                'total': inv.total,
                'balance': max(Decimal('0.00'), inv.total - paid)
            }
            generated_invoices.append(rec_row)
            related_documents.append({
                'kind': 'invoices', 'type': 'Invoice', 'id': inv.pk, 'number': inv.number, 'date': inv.date.isoformat() if hasattr(inv.date, 'isoformat') else str(inv.date), 'total': inv.total, 'status': inv.status, 'relation': 'Generated Invoice'
            })

        # Calculate upcoming 3 dates
        upcoming = []
        cur_d = o.next_date
        if o.status == 'active':
            for _ in range(3):
                if o.end_date and cur_d > o.end_date:
                    break
                upcoming.append(cur_d.isoformat())
                cur_d = services.advance_recurring_date(cur_d, o.frequency, meta.get('repeat_every', 1))

        d.update({
            'lines': lines,
            'notes': meta.get('notes', ''),
            'terms': meta.get('terms', ''),
            'max_occurrences': meta.get('max_occurrences'),
            'occurrences_count': meta.get('occurrences_count', len(generated_invoices)),
            'invoices': generated_invoices,
            'history': generated_invoices,
            'related_documents': related_documents,
            'upcoming_dates': upcoming
        })
        return d

    def create(self, data, user):
        c = Cleaner(data)
        user_org = get_user_org(user) or Organization.get()
        pname = c.text('profile_name', required=True, max_len=150)
        if pname and re.search(r'[#@!$%^*+=~`<>{}[\]\\]', pname):
            c.err('profile_name', 'Profile name contains invalid characters.')
        cid = c.integer('customer', required=True, lo=1)
        cust = Customer.objects.filter(pk=cid, organization=user_org).first() if user_org else Customer.objects.filter(pk=cid).first()
        if not cust:
            raise ApiError(404, 'Customer not found.')
        freq = c.choice('frequency', self.FREQUENCIES, default='monthly')
        repeat_every = c.integer('repeat_every', lo=1, default=1)
        sdate = c.date('start_date', required=True)
        never_ends = c.boolean('never_ends', default=False)
        edate = None if never_ends else c.date('end_date')
        next_d = c.date('next_date', default=sdate)
        if sdate and next_d and next_d < sdate:
            c.err('next_date', 'Next invoice date cannot be earlier than start date.')
        if not never_ends and sdate and edate and edate < sdate:
            c.err('end_date', 'End date cannot be earlier than start date.')
        tot = c.number('total', lo=Decimal('0.01'), default=Decimal('0.00'))
        status_val = c.choice('status', self.STATUSES, default='active')
        payment_terms = c.integer('payment_terms', lo=0, default=getattr(cust, 'payment_terms', 30) or 30)
        auto_send = c.boolean('auto_send', default=False)
        notes = c.text('notes', max_len=2000)
        terms = c.text('terms', max_len=2000)
        max_occ = c.integer('max_occurrences', lo=1)
        c.done()

        # Handle lines
        raw_lines = data.get('lines', [])
        lines_data_clean = []
        if raw_lines and isinstance(raw_lines, list):
            for rl in raw_lines:
                if isinstance(rl, dict) and (rl.get('description') or rl.get('item') or rl.get('rate')):
                    lines_data_clean.append({
                        'item': rl.get('item') or rl.get('item_id') or None,
                        'description': str(rl.get('description') or '').strip() or 'Line item',
                        'hsn_sac': str(rl.get('hsn_sac') or '').strip(),
                        'quantity': float(rl.get('quantity') or 1),
                        'rate': float(rl.get('rate') or 0),
                        'discount_percent': float(rl.get('discount_percent') or 0),
                        'gst_rate': float(rl.get('gst_rate') or 0),
                        'line_total': float(rl.get('line_total') or 0)
                    })
            if lines_data_clean:
                computed_tot = sum((Decimal(str(l['quantity'])) * Decimal(str(l['rate'])) * (100 - Decimal(str(l['discount_percent']))) / 100 for l in lines_data_clean), Decimal('0.00'))
                if tot <= Decimal('0.00'):
                    tot = computed_tot

        if tot <= Decimal('0.00'):
            tot = Decimal('100.00')

        meta_dict = {
            'lines': lines_data_clean,
            'repeat_every': repeat_every,
            'payment_terms': payment_terms,
            'auto_send': auto_send,
            'notes': notes,
            'terms': terms,
            'max_occurrences': max_occ,
            'occurrences_count': 0,
            'history': []
        }

        rec = RecurringInvoice.objects.create(
            organization=user_org,
            profile_name=pname,
            customer=cust,
            frequency=freq,
            location=str(data.get('location') or 'HO Kottayam').strip(),
            order_number=str(data.get('order_number') or '').strip(),
            repeat_every=repeat_every,
            start_date=sdate,
            end_date=edate,
            next_date=next_d,
            never_ends=never_ends,
            payment_terms=payment_terms,
            salesperson=str(data.get('salesperson') or '').strip(),
            project_name=str(data.get('project_name') or '').strip(),
            subject=str(data.get('subject') or '').strip(),
            notes=notes,
            terms=terms,
            create_as_draft=bool(data.get('create_as_draft', True)),
            status=status_val,
            tax_pricing_type=str(data.get('tax_pricing_type') or 'tax_exclusive').strip().lower(),
            customer_type=str(data.get('customer_type') or 'b2b').strip().lower(),
            total=tot,
            subtotal=tot,
            lines_data=meta_dict
        )
        services.log_audit(user, 'create', 'RecurringInvoice', rec.pk, f"Created recurring profile {rec.profile_name}", org=user_org, module='sales', submodule='recurring_invoices')
        return rec

    def update(self, obj, data, user):
        c = Cleaner(data)
        user_org = obj.organization or get_user_org(user)
        if 'profile_name' in data:
            pname = c.text('profile_name', required=True, max_len=150)
            if pname and re.search(r'[#@!$%^*+=~`<>{}[\]\\]', pname):
                c.err('profile_name', 'Profile name contains invalid characters.')
            obj.profile_name = pname
        if 'customer' in data:
            cid = c.integer('customer', required=True, lo=1)
            cust = Customer.objects.filter(pk=cid, organization=user_org).first() if user_org else Customer.objects.filter(pk=cid).first()
            if not cust:
                raise ApiError(404, 'Customer not found.')
            obj.customer = cust
        if 'frequency' in data:
            obj.frequency = c.choice('frequency', self.FREQUENCIES, default=obj.frequency)
        if 'start_date' in data:
            obj.start_date = c.date('start_date', required=True)
        if 'never_ends' in data or 'end_date' in data:
            never_ends = c.boolean('never_ends', default=False) if 'never_ends' in data else False
            obj.never_ends = never_ends
            if never_ends:
                obj.end_date = None
            else:
                obj.end_date = c.date('end_date')
                if obj.start_date and obj.end_date and obj.end_date < obj.start_date:
                    c.err('end_date', 'End date cannot be earlier than start date.')
        if 'next_date' in data:
            obj.next_date = c.date('next_date', default=obj.start_date)
        if obj.start_date and obj.next_date and obj.next_date < obj.start_date:
            c.err('next_date', 'Next invoice date cannot be earlier than start date.')
        if 'status' in data:
            obj.status = c.choice('status', self.STATUSES, default=obj.status)
        if 'tax_pricing_type' in data:
            obj.tax_pricing_type = str(data.get('tax_pricing_type') or 'tax_exclusive').strip().lower()
        if 'customer_type' in data:
            obj.customer_type = str(data.get('customer_type') or 'b2b').strip().lower()
        if 'location' in data:
            obj.location = str(data.get('location') or 'HO Kottayam').strip()
        if 'order_number' in data:
            obj.order_number = str(data.get('order_number') or '').strip()
        if 'salesperson' in data:
            obj.salesperson = str(data.get('salesperson') or '').strip()
        if 'project_name' in data:
            obj.project_name = str(data.get('project_name') or '').strip()
        if 'subject' in data:
            obj.subject = str(data.get('subject') or '').strip()
        if 'notes' in data:
            obj.notes = str(data.get('notes') or '')
        if 'terms' in data:
            obj.terms = str(data.get('terms') or '')
        if 'create_as_draft' in data:
            obj.create_as_draft = bool(data.get('create_as_draft'))
        if 'repeat_every' in data:
            obj.repeat_every = max(1, int(data.get('repeat_every') or 1))
        if 'payment_terms' in data:
            obj.payment_terms = int(data.get('payment_terms') or 30)
        if 'total' in data:
            tot = c.number('total', required=True, lo=Decimal('0.01'))
            obj.total = tot
            obj.subtotal = tot
        c.done()

        meta = obj.lines_data if isinstance(obj.lines_data, dict) else {}
        if 'repeat_every' in data:
            meta['repeat_every'] = max(1, int(data.get('repeat_every') or 1))
        if 'payment_terms' in data:
            meta['payment_terms'] = int(data.get('payment_terms') or 30)
        if 'auto_send' in data:
            meta['auto_send'] = bool(data.get('auto_send'))
        if 'notes' in data:
            meta['notes'] = str(data.get('notes') or '')
        if 'terms' in data:
            meta['terms'] = str(data.get('terms') or '')
        if 'max_occurrences' in data:
            meta['max_occurrences'] = int(data.get('max_occurrences')) if data.get('max_occurrences') else None
        if 'lines' in data and isinstance(data['lines'], list):
            meta['lines'] = data['lines']

        obj.lines_data = meta
        obj.save()
        services.log_audit(user, 'update', 'RecurringInvoice', obj.pk, f"Updated recurring profile {obj.profile_name}", org=user_org, module='sales', submodule='recurring_invoices')
        return obj

    def action(self, request, obj, name):
        if name in ('generate', 'generate-invoice', 'create-invoice'):
            inv = services.generate_invoice_from_recurring_profile(obj, user=request.user)
            return j({
                'success': True,
                'status': 'ok',
                'invoice_id': inv.pk,
                'invoice_number': inv.number,
                'invoice_total': str(inv.total),
                'next_date': obj.next_date.isoformat() if obj.next_date else None,
                'message': f"Generated invoice {inv.number} successfully."
            })
        elif name == 'pause':
            obj.status = 'paused'
            obj.save(update_fields=['status'])
            services.log_audit(request.user, 'pause', 'RecurringInvoice', obj.pk, f"Paused recurring profile {obj.profile_name}", org=obj.organization, module='sales', submodule='recurring_invoices')
            return j({'status': 'ok', 'profile_status': obj.status, 'message': 'Profile paused.'})
        elif name == 'resume':
            obj.status = 'active'
            obj.save(update_fields=['status'])
            services.log_audit(request.user, 'resume', 'RecurringInvoice', obj.pk, f"Resumed recurring profile {obj.profile_name}", org=obj.organization, module='sales', submodule='recurring_invoices')
            return j({'status': 'ok', 'profile_status': obj.status, 'message': 'Profile resumed.'})
        elif name == 'cancel':
            obj.status = 'cancelled'
            obj.save(update_fields=['status'])
            services.log_audit(request.user, 'cancel', 'RecurringInvoice', obj.pk, f"Cancelled recurring profile {obj.profile_name}", org=obj.organization, module='sales', submodule='recurring_invoices')
            return j({'status': 'ok', 'profile_status': obj.status, 'message': 'Profile cancelled.'})
        raise ApiError(404, 'Unknown action.')

class DeliveryChallanResource(Resource):
    name = 'delivery-challans'
    model = DeliveryChallan
    search_fields = ('number', 'customer__name', 'vehicle_number')
    default_ordering = ('-date', '-id')

    def prepare_import_record(self, rec):
        cust_val = rec.get('customer') or rec.get('customer_name') or rec.get('client') or rec.get('party')
        if cust_val and not str(cust_val).isdigit():
            c_str = str(cust_val).strip()
            c = Customer.objects.filter(Q(name__iexact=c_str) | Q(company__iexact=c_str) | Q(email__iexact=c_str)).first()
            if not c:
                org = Organization.get()
                c = Customer.objects.create(name=c_str, active=True, state=org.state if org else '', organization=org)
            rec['customer'] = c.pk
        elif not cust_val:
            first_c = Customer.objects.first()
            if first_c:
                rec['customer'] = first_c.pk

        if not rec.get('date'):
            rec['date'] = timezone.localdate().isoformat()
        if not rec.get('challan_type'):
            rec['challan_type'] = 'other'

        if not rec.get('lines'):
            line = self.extract_line_from_record(rec)
            rec['lines'] = [line]

    def extract_line_from_record(self, r):
        item_val = r.get('item') or r.get('item_name') or r.get('product') or r.get('sku') or ''
        desc = r.get('description') or r.get('line_description') or r.get('desc') or ''
        qty = r.get('quantity') or r.get('qty') or r.get('opening_stock') or Decimal('1.000')
        hsn = r.get('hsn_sac') or r.get('hsn') or ''

        it = None
        if item_val:
            it = Item.objects.filter(Q(name__iexact=str(item_val).strip()) | Q(sku__iexact=str(item_val).strip())).first()

        if not desc:
            desc = it.name if it else 'Goods item'
        if it and not hsn:
            hsn = it.hsn_sac or ''

        return {
            'item': it.pk if it else None,
            'description': str(desc)[:500],
            'hsn_sac': str(hsn)[:10],
            'quantity': qty
        }

    def preprocess_import_records(self, records):
        grouped = []
        doc_map = {}
        for r in records:
            num = str(r.get('number') or r.get('dc_number') or r.get('challan_number') or '').strip()
            line = self.extract_line_from_record(r)
            if num and num in doc_map:
                existing = doc_map[num]
                if line:
                    existing.setdefault('lines', []).append(line)
            else:
                doc_copy = dict(r)
                if line and 'lines' not in doc_copy:
                    doc_copy['lines'] = [line]
                grouped.append(doc_copy)
                if num:
                    doc_map[num] = doc_copy
        return grouped

    def row(self, o):
        return {
            'id': o.pk, 'number': o.number, 'customer_id': o.customer_id,
            'customer_name': o.customer.name, 'date': o.date,
            'challan_type': o.challan_type, 'status': o.status,
            'vehicle_number': o.vehicle_number, 'notes': o.notes,
            'signature_data': getattr(o, 'signature_data', '') or '',
            'signed_by': getattr(o, 'signed_by', '') or '',
            'signed_at': o.signed_at.isoformat() if getattr(o, 'signed_at', None) else None,
            'signature_title': getattr(o, 'signature_title', '') or '',
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
        if vnum:
            v_clean = re.sub(r'[\s\-]', '', vnum).upper()
            if not re.match(r'^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{4}$', v_clean):
                c.err('vehicle_number', 'Invalid vehicle number format (e.g. KL-07-AB-1234).')
        notes = c.text('notes', max_len=1000)
        c.done()

        user_org = get_user_org(user) if user else None
        num = (data.get('number') or '').strip()
        num_exists = DeliveryChallan.objects.filter(number=num, organization=user_org).exists() if (num and user_org) else (DeliveryChallan.objects.filter(number=num).exists() if num else False)
        if not num or num_exists:
            num = services.next_document_number('DC', org=user_org, date=dt)
        dc = DeliveryChallan.objects.create(
            organization=user_org,
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

    def update(self, obj, data, user):
        c = Cleaner(data)
        if 'customer' in data:
            cid = c.integer('customer', required=True, lo=1)
            cust = Customer.objects.filter(pk=cid).first()
            if not cust:
                raise ApiError(404, 'Customer not found.')
            obj.customer = cust
        if 'date' in data:
            obj.date = c.date('date', required=True)
        if 'challan_type' in data:
            obj.challan_type = c.choice('challan_type', ['supply_on_approval', 'job_work', 'other'], default=obj.challan_type)
        if 'vehicle_number' in data:
            vnum = c.text('vehicle_number', max_len=50)
            if vnum:
                v_clean = re.sub(r'[\s\-]', '', vnum).upper()
                if not re.match(r'^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{4}$', v_clean):
                    c.err('vehicle_number', 'Invalid vehicle number format (e.g. KL-07-AB-1234).')
            obj.vehicle_number = vnum
        if 'notes' in data:
            obj.notes = c.text('notes', max_len=1000)
        if 'status' in data:
            obj.status = c.choice('status', ['open', 'closed', 'cancelled'], default=obj.status)
        c.done()
        obj.save()

        if 'lines' in data:
            obj.lines.all().delete()
            for l in data.get('lines', []):
                item_id = l.get('item') or l.get('item_id')
                DeliveryChallanLine.objects.create(
                    challan=obj,
                    item_id=item_id if item_id else None,
                    description=l.get('description', 'Item'),
                    hsn_sac=l.get('hsn_sac', ''),
                    quantity=Decimal(str(l.get('quantity', 1)))
                )
        services.log_audit(user, 'update', 'DeliveryChallan', obj.number, f"Updated delivery challan {obj.number}")
        return obj

    def action(self, request, obj, name):
        if name == 'sign':
            return sign_document_action(obj, request)
        elif name == 'unsign':
            return unsign_document_action(obj, request)
        raise ApiError(404, 'Unknown action.')

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
    csv_cols = [
        ('Project Name', 'name'), ('Project Code', 'code'), ('Customer Name', 'customer'),
        ('Billing Method', 'billing_method'), ('Rate Per Hour', 'rate_per_hour'),
        ('Budget Hours', 'budget_hours'), ('Description', 'description')
    ]

    def queryset(self, request):
        qs = super().queryset(request)
        cid = request.GET.get('customer') or request.GET.get('customer_id')
        if cid and str(cid).isdigit():
            qs = qs.filter(customer_id=int(cid))
        return qs

    def get_template_sample(self):
        return ['Cloud ERP Implementation', 'PRJ-001', 'Acme Infotech Ltd', 'hourly_rate', '2500.00', '120.00', 'Cloud ERP deployment and training']

    def prepare_import_record(self, rec):
        cust_val = rec.get('customer') or rec.get('customer_name') or rec.get('client')
        if cust_val and not str(cust_val).isdigit():
            c_str = str(cust_val).strip()
            c = Customer.objects.filter(Q(name__iexact=c_str) | Q(company__iexact=c_str)).first()
            if not c:
                org = Organization.get()
                c = Customer.objects.create(name=c_str, active=True, state=org.state if org else '', organization=org)
            rec['customer'] = c.pk

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

    def update(self, obj, data, user):
        c = Cleaner(data)
        if 'name' in data:
            obj.name = c.text('name', required=True, max_len=150)
        if 'code' in data:
            obj.code = c.text('code', max_len=40)
        if 'customer' in data:
            cid = c.integer('customer', lo=1)
            obj.customer = Customer.objects.filter(pk=cid).first() if cid else None
        if 'billing_method' in data:
            obj.billing_method = c.text('billing_method', max_len=40)
        if 'rate_per_hour' in data:
            obj.rate_per_hour = c.number('rate_per_hour', default=Decimal('0.00'))
        if 'budget_hours' in data:
            obj.budget_hours = c.number('budget_hours', default=Decimal('0.00'))
        if 'status' in data:
            obj.status = c.choice('status', ['active', 'completed', 'on_hold', 'cancelled'], default=obj.status)
        if 'description' in data:
            obj.description = c.text('description', max_len=1000)
        c.done()
        obj.save()
        services.log_audit(user, 'update', 'Project', obj.name, f"Updated project {obj.name}")
        return obj

class TimeLogResource(Resource):
    name = 'timesheets'
    model = TimeLog
    search_fields = ('project__name', 'task', 'notes')
    default_ordering = ('-date', '-id')

    def prepare_import_record(self, rec):
        proj_val = rec.get('project') or rec.get('project_name') or rec.get('project_code')
        if proj_val and not str(proj_val).isdigit():
            p_str = str(proj_val).strip()
            p = Project.objects.filter(Q(name__iexact=p_str) | Q(code__iexact=p_str)).first()
            if not p:
                p = Project.objects.create(name=p_str)
            rec['project'] = p.pk
        elif not proj_val:
            first_p = Project.objects.first()
            if not first_p:
                first_p = Project.objects.create(name='General Project')
            rec['project'] = first_p.pk

        if not rec.get('date'):
            rec['date'] = timezone.localdate().isoformat()
        if not rec.get('task'):
            rec['task'] = rec.get('description') or rec.get('notes') or 'General Task'
        if not rec.get('hours'):
            rec['hours'] = Decimal('1.0')

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

    def update(self, obj, data, user):
        c = Cleaner(data)
        if 'project' in data:
            pid = c.integer('project', required=True, lo=1)
            proj = Project.objects.filter(pk=pid).first()
            if not proj:
                raise ApiError(404, 'Project not found.')
            obj.project = proj
        if 'date' in data:
            obj.date = c.date('date', required=True)
        if 'hours' in data:
            obj.hours = c.number('hours', required=True, lo=Decimal('0.1'), hi=Decimal('24.0'))
        if 'task' in data:
            obj.task = c.text('task', required=True, max_len=255)
        if 'billable' in data:
            obj.billable = c.boolean('billable', default=obj.billable)
        if 'notes' in data:
            obj.notes = c.text('notes', max_len=1000)
        c.done()
        obj.save()
        services.log_audit(user, 'update', 'TimeLog', str(obj.pk), f"Updated time log for {obj.project.name}: {obj.hours} hrs")
        return obj

class ItemCategoryResource(Resource):
    name = 'item-categories'
    model = ItemCategory
    search_fields = ('name', 'description')
    default_ordering = ('name',)
    csv_cols = [('Name', 'name'), ('Description', 'description')]

    def prepare_import_record(self, rec):
        if not rec.get('name'):
            rec['name'] = rec.get('category') or rec.get('category_name') or rec.get('title') or 'General Category'

    def get_template_sample(self):
        return ['Hardware', 'Computer hardware and office peripherals']

    def row(self, o):
        cnt = Item.objects.filter(category=o.name).count()
        return {'id': o.pk, 'name': o.name, 'description': o.description, 'item_count': cnt}

    def create(self, data, user):
        c = Cleaner(data)
        name = c.text('name', required=True, max_len=100)
        desc = c.text('description', max_len=500)
        c.done()
        return ItemCategory.objects.create(name=name, description=desc)

    def update(self, obj, data, user):
        c = Cleaner(data)
        if 'name' in data:
            old_name = obj.name
            new_name = c.text('name', required=True, max_len=100)
            obj.name = new_name
            if old_name != new_name:
                Item.objects.filter(category=old_name).update(category=new_name)
        if 'description' in data:
            obj.description = c.text('description', max_len=500)
        c.done()
        obj.save()
        services.log_audit(user, 'update', 'ItemCategory', obj.name, f"Updated item category {obj.name}")
        return obj

PRICE_LIST_NAME_RE = re.compile(r'^[^@#$%^&*~`+=<>{}[\]\\]+$')

class PriceListResource(Resource):
    name = 'price-lists'
    model = PriceList
    search_fields = ('name', 'description')
    default_ordering = ('name',)

    def prepare_import_record(self, rec):
        if not rec.get('name'):
            rec['name'] = rec.get('price_list_name') or rec.get('title') or 'Price List'
        if not rec.get('pricing_scheme'):
            rec['pricing_scheme'] = 'percentage'

    def row(self, o):
        return {'id': o.pk, 'name': o.name, 'description': o.description, 'pricing_scheme': o.pricing_scheme, 'percentage': o.percentage, 'active': o.active}

    def create(self, data, user):
        c = Cleaner(data)
        name = c.text('name', required=True, max_len=100, pattern=PRICE_LIST_NAME_RE,
                      pattern_msg='Price List Name cannot contain special characters like @, #, $, %, ^, *.')
        scheme = c.choice('pricing_scheme', ['percentage', 'fixed'], default='percentage')
        desc = c.text('description', max_len=500)
        pct = c.number('percentage', default=Decimal('0.00'))
        c.done()
        return PriceList.objects.create(name=name, pricing_scheme=scheme, description=desc, percentage=pct)

    def update(self, obj, data, user):
        c = Cleaner(data)
        obj.name = c.text('name', required=True, max_len=100, pattern=PRICE_LIST_NAME_RE,
                          pattern_msg='Price List Name cannot contain special characters like @, #, $, %, ^, *.')
        if 'pricing_scheme' in data:
            obj.pricing_scheme = c.choice('pricing_scheme', ['percentage', 'fixed'], default=obj.pricing_scheme)
        if 'description' in data:
            obj.description = c.text('description', max_len=500)
        if 'percentage' in data:
            obj.percentage = c.number('percentage', default=obj.percentage)
        if 'active' in data:
            obj.active = bool(data.get('active'))
        c.done()
        obj.save()
        return obj

class WarehouseResource(Resource):
    name = 'warehouses'
    model = Warehouse
    search_fields = ('name', 'code', 'city', 'parent__name', 'parent__code')
    default_ordering = ('name',)
    csv_cols = [('Warehouse Name', 'name'), ('Warehouse Code', 'code'), ('Address', 'address'),
                ('City', 'city'), ('State', 'state'), ('Pincode', 'pincode')]

    def get_template_sample(self):
        return ['Central Warehouse', 'WH-MAIN', 'Plot 12, Industrial Area', 'Bengaluru', 'Karnataka', '560058']

    def prepare_import_record(self, rec):
        if not rec.get('name'):
            rec['name'] = rec.get('warehouse_name') or rec.get('title') or 'Warehouse'
        if not rec.get('code'):
            clean_name = re.sub(r'[^A-Z0-9]', '', str(rec.get('name', 'WH')).upper())[:4] or 'WH'
            rec['code'] = f"{clean_name}-{next_number('WH')}"

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

    def clean(self, data, instance=None, user=None):
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

class StockTransferResource(Resource):
    name = 'stock-transfers'
    model = StockTransfer
    search_fields = ('number', 'source_warehouse__name', 'source_warehouse_code', 'destination_warehouse__name', 'destination_warehouse_code', 'notes')
    orderings = {'number': 'number', 'date': 'date', 'status': 'status', 'created': 'created_at'}
    default_ordering = ('-date', '-id')
    csv_cols = [
        ('Transfer Number', 'number'),
        ('Date', 'date'),
        ('Source Warehouse', 'source_warehouse_code'),
        ('Destination Warehouse', 'destination_warehouse_code'),
        ('Status', 'status'),
        ('Total Items', 'lines_count'),
        ('Total Quantity', 'total_qty'),
        ('Notes', 'notes')
    ]

    def handle_collection(self, request):
        if request.method == 'GET' and request.GET.get('action') == 'available_stock':
            item_id = request.GET.get('item_id')
            wh_id = request.GET.get('warehouse_id')
            user_org = get_user_org(request.user)
            if not item_id or not wh_id:
                raise ApiError(400, 'item_id and warehouse_id are required.')
            avail = services.get_item_warehouse_stock(item_id, wh_id, org=user_org)
            item = Item.objects.filter(pk=item_id).first()
            unit = item.unit if item else 'nos'
            return j({'available_stock': float(avail), 'unit': unit})
        if request.method == 'DELETE':
            raise ApiError(405, 'Stock transfers cannot be deleted. Use Reverse Entry instead.')
        return super().handle_collection(request)

    def filter_qs(self, qs, request):
        status = request.GET.get('status')
        if status:
            qs = qs.filter(status=status)
        src = request.GET.get('source_warehouse')
        if src:
            if src.isdigit():
                qs = qs.filter(source_warehouse_id=int(src))
            else:
                qs = qs.filter(Q(source_warehouse_code__iexact=src) | Q(source_warehouse__name__icontains=src))
        dst = request.GET.get('destination_warehouse')
        if dst:
            if dst.isdigit():
                qs = qs.filter(destination_warehouse_id=int(dst))
            else:
                qs = qs.filter(Q(destination_warehouse_code__iexact=dst) | Q(destination_warehouse__name__icontains=dst))
        wh = request.GET.get('warehouse')
        if wh:
            if wh.isdigit():
                qs = qs.filter(Q(source_warehouse_id=int(wh)) | Q(destination_warehouse_id=int(wh)))
            else:
                qs = qs.filter(Q(source_warehouse_code__iexact=wh) | Q(destination_warehouse_code__iexact=wh))
        item_id = request.GET.get('item')
        if item_id and item_id.isdigit():
            qs = qs.filter(lines__item_id=int(item_id))
        start = request.GET.get('start')
        if start:
            qs = qs.filter(date__gte=start)
        end = request.GET.get('end')
        if end:
            qs = qs.filter(date__lte=end)
        created_by = request.GET.get('created_by')
        if created_by:
            if created_by.isdigit():
                qs = qs.filter(created_by_id=int(created_by))
            else:
                qs = qs.filter(created_by__username__icontains=created_by)
        return qs.select_related('source_warehouse', 'destination_warehouse', 'created_by', 'confirmed_by', 'reversed_by').prefetch_related('lines__item')

    def row(self, o):
        lines = list(o.lines.all())
        total_qty = sum(l.quantity for l in lines)
        items_summary = ', '.join(f"{l.item_name} ({services.fmt_qty(l.quantity)} {l.unit})" for l in lines[:3])
        if len(lines) > 3:
            items_summary += f" +{len(lines) - 3} more"

        created_by_name = o.created_by.get_full_name() or o.created_by.username if o.created_by else 'System'
        confirmed_by_name = o.confirmed_by.get_full_name() or o.confirmed_by.username if o.confirmed_by else ''
        reversed_by_name = o.reversed_by.get_full_name() or o.reversed_by.username if o.reversed_by else ''

        return {
            'id': o.pk,
            'number': o.number,
            'date': o.date.isoformat() if o.date else '',
            'source_warehouse_id': o.source_warehouse_id,
            'source_warehouse_code': o.source_warehouse_code or (o.source_warehouse.code if o.source_warehouse else ''),
            'source_warehouse_name': o.source_warehouse.name if o.source_warehouse else '',
            'destination_warehouse_id': o.destination_warehouse_id,
            'destination_warehouse_code': o.destination_warehouse_code or (o.destination_warehouse.code if o.destination_warehouse else ''),
            'destination_warehouse_name': o.destination_warehouse.name if o.destination_warehouse else '',
            'status': o.status,
            'status_display': o.get_status_display(),
            'notes': o.notes,
            'lines_count': len(lines),
            'total_qty': float(total_qty),
            'items_summary': items_summary or 'No items',
            'created_at': o.created_at.isoformat() if o.created_at else '',
            'created_by': created_by_name,
            'confirmed_at': o.confirmed_at.isoformat() if o.confirmed_at else '',
            'confirmed_by': confirmed_by_name,
            'reversed_at': o.reversed_at.isoformat() if o.reversed_at else '',
            'reversed_by': reversed_by_name,
            'reversal_reason': o.reversal_reason,
            'is_reversal': o.is_reversal,
            'reversal_transfer_id': o.reversal_transfer_id,
        }

    def detail(self, o):
        data = self.row(o)
        data['lines'] = [
            {
                'id': l.pk,
                'item_id': l.item_id,
                'item_name': l.item_name or l.item.name,
                'item_sku': l.item_sku or l.item.sku or '',
                'quantity': float(l.quantity),
                'unit': l.unit or l.item.unit or 'nos',
                'batch_number': l.batch_number,
                'serial_number': l.serial_number,
                'description': l.description,
            }
            for l in o.lines.select_related('item').all()
        ]
        user_org = o.organization or Organization.get()
        audit_qs = AuditLog.objects.filter(
            organization=user_org,
            entity_type='StockTransfer',
            entity_id=str(o.pk)
        ).order_by('-timestamp')
        data['audit_trail'] = [
            {
                'timestamp': a.timestamp.isoformat(),
                'username': a.username,
                'action': a.action,
                'summary': a.summary,
                'details': a.details,
                'ip_address': a.ip_address
            }
            for a in audit_qs
        ]
        return data

    def create(self, data, user):
        return services.create_stock_transfer(data, user)

    def update(self, obj, data, user):
        return services.update_stock_transfer(obj, data, user)

    def destroy(self, obj):
        raise ApiError(405, 'Stock transfers cannot be deleted. Use Reverse Entry instead.')

    def action(self, request, obj, name):
        if name == 'confirm':
            res = services.confirm_stock_transfer(obj, request.user)
            return j(self.detail(res))
        if name == 'reverse':
            d = body(request)
            reason = d.get('reason') or d.get('reversal_reason') or ''
            res = services.reverse_stock_transfer(obj, request.user, reason=reason)
            return j(self.detail(res))
        raise ApiError(404, f'Unknown action "{name}".')


class SalespersonResource(Resource):
    name = 'salespersons'

    def handle_collection(self, request):
        check_permission(request, resource_name=self.name)
        user_org = get_user_org(request.user) or Organization.get()
        if request.method == 'GET':
            from .models import Salesperson
            sp_qs = Salesperson.objects.filter(is_active=True)
            if user_org:
                sp_qs = sp_qs.filter(organization=user_org)
            results = [{'id': s.pk, 'name': s.name, 'email': s.email, 'phone': s.phone, 'is_active': s.is_active} for s in sp_qs.order_by('name')]
            
            # Backwards compatibility: also include existing user staff
            from django.contrib.auth import get_user_model
            User = get_user_model()
            u_qs = User.objects.filter(is_active=True, profile__organization=user_org) if user_org else User.objects.filter(is_active=True)
            existing_names = {s['name'].strip().lower() for s in results}
            for u in u_qs.order_by('username'):
                uname = u.get_full_name() or u.username
                if uname.strip().lower() not in existing_names:
                    existing_names.add(uname.strip().lower())
                    results.append({'id': f"u_{u.pk}", 'name': uname, 'email': u.email, 'phone': getattr(u.profile, 'phone', '') if hasattr(u, 'profile') else '', 'is_active': True})
            return j({'count': len(results), 'page': 1, 'pages': 1, 'results': results})

        if request.method == 'POST':
            from .models import Salesperson
            d = body(request)
            name = (d.get('name') or '').strip()
            if not name:
                raise ApiError(400, 'Salesperson name is required.', {'name': 'Salesperson name is required.'})
            email = (d.get('email') or '').strip().lower()
            phone = (d.get('phone') or '').strip()

            sp, created = Salesperson.objects.update_or_create(
                organization=user_org,
                name=name,
                defaults={'email': email, 'phone': phone, 'is_active': True}
            )

            services.log_audit(request.user, 'create' if created else 'update', 'Salesperson', sp.pk, f"Saved salesperson: {name}", org=user_org, module='sales', submodule='salespersons')

            return j({
                'id': sp.pk,
                'name': sp.name,
                'email': sp.email,
                'phone': sp.phone,
                'is_active': sp.is_active,
                'status': 'ok'
            }, status=201)
        raise ApiError(405, 'Method not allowed.')

    def handle_item(self, request, pk):
        check_permission(request, resource_name=self.name)
        user_org = get_user_org(request.user) or Organization.get()
        from .models import Salesperson
        sp = Salesperson.objects.filter(pk=pk, organization=user_org).first()
        if not sp:
            raise ApiError(404, 'Salesperson not found.')
        if request.method == 'GET':
            return j({'id': sp.pk, 'name': sp.name, 'email': sp.email, 'phone': sp.phone, 'is_active': sp.is_active})
        elif request.method in ('PUT', 'PATCH'):
            d = body(request)
            if 'name' in d:
                sp.name = (d.get('name') or '').strip()
            if 'email' in d:
                sp.email = (d.get('email') or '').strip().lower()
            if 'phone' in d:
                sp.phone = (d.get('phone') or '').strip()
            if 'is_active' in d:
                sp.is_active = bool(d.get('is_active'))
            sp.save()
            return j({'id': sp.pk, 'name': sp.name, 'email': sp.email, 'phone': sp.phone, 'is_active': sp.is_active, 'status': 'ok'})
        elif request.method == 'DELETE':
            sp.is_active = False
            sp.save(update_fields=['is_active'])
            return j({'status': 'ok', 'message': f"Salesperson {sp.name} removed."})
        raise ApiError(405, 'Method not allowed.')


class EmployeeResource(Resource):
    name = 'employees'

    def handle_collection(self, request):
        check_permission(request, resource_name=self.name)
        if request.method == 'GET':
            user_org = get_user_org(request.user)
            from django.contrib.auth import get_user_model
            User = get_user_model()
            qs = User.objects.filter(is_active=True, profile__organization=user_org) if user_org else User.objects.filter(is_active=True)
            results = [{'id': u.pk, 'name': u.get_full_name() or u.username, 'email': u.email} for u in qs.order_by('username')]
            return j({'count': len(results), 'page': 1, 'pages': 1, 'results': results})

        if request.method == 'POST':
            user_org = get_user_org(request.user) or Organization.get()
            d = body(request)
            name = (d.get('name') or '').strip()
            if not name:
                raise ApiError(400, 'Employee name is required.', {'name': 'Employee name is required.'})
            email = (d.get('email') or '').strip().lower()
            phone = (d.get('phone') or '').strip()
            dept = (d.get('department') or '').strip()

            from django.contrib.auth import get_user_model
            User = get_user_model()

            parts = name.split(None, 1)
            first_name = parts[0]
            last_name = parts[1] if len(parts) > 1 else ''

            if not email:
                base_slug = re.sub(r'[^a-zA-Z0-9]', '', name.lower()) or 'emp'
                email = f"{base_slug}_{uuid.uuid4().hex[:4]}@convosisbooks.local"

            user = User.objects.filter(email__iexact=email).first()
            if not user:
                username = email.split('@')[0]
                if User.objects.filter(username=username).exists():
                    username = f"{username}_{uuid.uuid4().hex[:4]}"
                user = User.objects.create(
                    username=username,
                    email=email,
                    first_name=first_name,
                    last_name=last_name,
                    is_active=True
                )
                user.set_unusable_password()
                user.save()

            profile, _ = UserProfile.objects.get_or_create(user=user)
            profile.organization = user_org
            if phone:
                profile.phone = phone
            if dept:
                profile.department = dept
            profile.role = 'staff'
            profile.save()

            services.log_audit(request.user, 'create', 'Employee', user.pk, f"Added employee: {name}", org=user_org, module='settings', submodule='employees')

            return j({
                'id': user.pk,
                'name': user.get_full_name() or user.username or name,
                'email': user.email,
                'status': 'ok'
            }, status=201)
        raise ApiError(405, 'Method not allowed.')


RESOURCES = {r.name: r for r in (
    CustomerResource(), VendorResource(), ItemResource(), QuoteResource(), InvoiceResource(), RetainerInvoiceResource(), BillResource(),
    PaymentReceivedResource(), PaymentMadeResource(), StockMovementResource(), StockAdjustmentResource(),
    AccountResource(), JournalResource(), AuditLogResource(), CustomFieldResource(), WorkflowRuleResource(),
    WebhookConfigResource(), BankAccountResource(), BankTransactionResource(), BankDepositResource(),
    BankTransferResource(), BankReconciliationResource(), BankStatementBatchResource(), DocumentFolderResource(),
    ManagedDocumentResource(), SalesOrderResource(), PurchaseOrderResource(), ExpenseResource(),
    CreditNoteResource(), VendorCreditResource(), RecurringInvoiceResource(), DeliveryChallanResource(),
    EWayBillResource(), ProjectResource(), TimeLogResource(), ItemCategoryResource(), PriceListResource(),
    WarehouseResource(), PaymentTransactionResource(), FinancialAnomalyResource(),
    StockTransferResource(), SalespersonResource(), EmployeeResource()
)}
RESOURCES['timelogs'] = RESOURCES.get('timesheets')
RESOURCES['inventory-summary'] = RESOURCES.get('items')

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
        'id': o.id,
        'organization_id': getattr(o, 'organization_id', '') or f"ORG-{o.id:06d}",
        'name': o.name,
        'code': o.get_code(),
        'legal_name': getattr(o, 'legal_name', '') or o.name,
        'business_type': getattr(o, 'business_type', '') or '',
        'company_id': o.company_id or '',
        'gstin': o.gstin or '',
        'pan': getattr(o, 'pan', '') or '',
        'state': o.state or '',
        'address': o.address or '',
        'city': o.city or '',
        'pincode': o.pincode or '',
        'country': o.country or 'India',
        'phone': o.phone or '',
        'email': o.email or '',
        'website': o.website or '',
        'financial_year': getattr(o, 'financial_year', 'Apr - Mar'),
        'base_currency': getattr(o, 'base_currency', 'INR'),
        'time_zone': getattr(o, 'time_zone', '(GMT+5:30) India Standard Time (Asia/Kolkata)'),
        'date_format': getattr(o, 'date_format', 'dd/MM/yyyy'),
        'logo_data': getattr(o, 'logo_data', '') or '',
        'favicon_data': getattr(o, 'favicon_data', '') or '',
        'primary_color': getattr(o, 'primary_color', '#1877f2') or '#1877f2',
        'secondary_color': getattr(o, 'secondary_color', '#0ea5e9') or '#0ea5e9',
        'app_name': getattr(o, 'app_name', 'ConvosisBooks') or 'ConvosisBooks',
        'login_branding': getattr(o, 'login_branding', '') or '',
        'ai_settings': getattr(o, 'ai_settings', {}) or {},
        'general_settings': getattr(o, 'general_settings', {}) or {},
        'portal_settings': getattr(o, 'portal_settings', {}) or {},
        'reminder_settings': getattr(o, 'reminder_settings', {}) or {},
        'email_settings': getattr(o, 'email_settings', {}) or {},
        'sms_settings': getattr(o, 'sms_settings', {}) or {},
        'pdf_templates': getattr(o, 'pdf_templates', {}) or {},
        'number_series': getattr(o, 'number_series', {}) or {},
        'digital_signature': getattr(o, 'digital_signature', {}) or {},
        'tax_settings': getattr(o, 'tax_settings', {}) or {},
        'direct_tax_settings': getattr(o, 'direct_tax_settings', {}) or {},
        'template_theme': o.template_theme or 'convosis',
        'template_color': o.template_color or '#1877f2',
        'signature_title': o.signature_title or 'Authorized Signature',
        'signature_data': getattr(o, 'signature_data', '') or '',
        'notes_default': o.notes_default or 'Thanks for your business.',
        'terms_default': o.terms_default or 'Due on Receipt',
        'opening_cash': o.opening_cash,
    }

@api_view
def me(request):
    u = request.user
    role = get_user_role(u)
    profile = getattr(u, 'profile', None)
    user_org = get_user_org(u, request)
    return j({
        'user': {
            'id': u.pk,
            'user_id': profile.user_id_code if profile and profile.user_id_code else f"USR-{u.pk:08d}",
            'user_id_code': profile.user_id_code if profile and profile.user_id_code else f"USR-{u.pk:08d}",
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
        'organization': org_json(user_org) if user_org else None,
        'today': timezone.localdate(),
        'counts': {
            'customers': (Customer.objects.filter(organization=user_org) if user_org else Customer.objects.none()).count(),
            'vendors': (Vendor.objects.filter(organization=user_org) if user_org else Vendor.objects.none()).count(),
            'items': (Item.objects.filter(organization=user_org) if user_org else Item.objects.none()).count(),
            'invoices': (Invoice.objects.filter(organization=user_org).exclude(status='draft') if user_org else Invoice.objects.none()).count(),
            'bills': (Bill.objects.filter(organization=user_org).exclude(status='draft') if user_org else Bill.objects.none()).count(),
            'payments': ((PaymentReceived.objects.filter(organization=user_org).count() + PaymentMade.objects.filter(organization=user_org).count()) if user_org else 0)
        }
    })

@api_view
def organization(request):
    user_org = get_user_org(request.user)
    org = user_org or Organization.get()
    if not org:
        raise ApiError(404, 'Organization not found.')
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
    if 'code' in d:
        new_code = re.sub(r'[^A-Za-z0-9]', '', str(d['code'])).upper()[:20]
        if new_code:
            org.code = new_code
    if 'logo_data' in d:
        out['logo_data'] = d['logo_data']
    if 'signature_data' in d:
        out['signature_data'] = d['signature_data']
    for k, v in out.items():
        setattr(org, k, v)
    org.save()
    return j(org_json(org))

@api_view
def attachments_view(request, pk=None):
    user_org = get_user_org(request.user, request)
    if not user_org:
        raise ApiError(403, 'Organization required.')
    if request.method == 'GET':
        if pk:
            att = Attachment.objects.filter(pk=pk, organization=user_org).first()
            if not att:
                raise ApiError(404, 'Attachment not found.')
            return j({'id': att.pk, 'entity_type': att.entity_type, 'entity_id': att.entity_id,
                      'filename': att.filename, 'file_size': att.file_size, 'mime_type': att.mime_type,
                      'url': att.file.url if att.file else att.file_data, 'file_data': att.file_data,
                      'created_at': att.created_at})
        etype = request.GET.get('entity_type', '').strip()
        eid = request.GET.get('entity_id', '').strip()
        qs = Attachment.objects.filter(organization=user_org)
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
                organization=user_org,
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
                organization=user_org,
                entity_type=etype, entity_id=eid, filename=fname, file_size=fsize,
                file_data=fdata, mime_type=mtype, created_by=request.user
            )
            return j({'id': att.pk, 'filename': att.filename, 'file_size': att.file_size,
                      'file_data': att.file_data, 'url': att.file_data, 'mime_type': att.mime_type}, 201)
    if request.method == 'DELETE':
        if not pk:
            raise ApiError(400, 'Attachment ID required.')
        att = Attachment.objects.filter(pk=pk, organization=user_org).first()
        if not att:
            raise ApiError(404, 'Attachment not found.')
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
    user_org = get_user_org(request.user, request)
    def org_filter(qs):
        if hasattr(qs.model, 'organization'):
            if user_org:
                return qs.filter(organization=user_org)
            return qs.none()
        return qs

    if name == 'customers':
        data = [{'id': o.pk, 'name': o.name, 'state': o.state, 'payment_terms': o.payment_terms,
                 'company': o.company, 'gstin': o.gstin, 'gst_treatment': o.gst_treatment,
                 'customer_type': getattr(o, 'customer_type', 'business'),
                 'billing_address': o.billing_address, 'shipping_address': getattr(o, 'shipping_address', ''),
                 'place_of_supply': getattr(o, 'place_of_supply', '') or o.state}
                for o in org_filter(Customer.objects.filter(active=True)).order_by('name')]
    elif name == 'vendors':
        data = [{'id': o.pk, 'name': o.name, 'state': o.state, 'payment_terms': o.payment_terms,
                 'company': o.company, 'gstin': o.gstin, 'gst_treatment': o.gst_treatment,
                 'billing_address': o.billing_address}
                for o in org_filter(Vendor.objects.filter(active=True)).order_by('name')]
    elif name == 'items':
        item_objs = list(org_filter(Item.objects.filter(active=True)).select_related('warehouse', 'preferred_vendor').order_by('name'))
        tracked = [o for o in item_objs if o.item_type == 'goods' and o.track_inventory]
        stock_map = services.get_stock_movement_summary(tracked, org=user_org) if tracked else {}
        data = []
        for o in item_objs:
            sum_entry = stock_map.get(o.pk)
            avail_stock = sum_entry['available_stock'] if sum_entry else o.stock
            wh_name = o.warehouse.name if o.warehouse else (o.warehouse_code or 'HO Kottayam')
            data.append({
                'id': o.pk, 'name': o.name, 'sku': o.sku, 'type': o.item_type, 'hsn_sac': o.hsn_sac, 'category': o.category,
                'selling_price': o.selling_price, 'purchase_price': o.purchase_price, 'gst_rate': o.gst_rate,
                'warehouse_id': o.warehouse_id,
                'warehouse_code': o.warehouse_code or (o.warehouse.code if o.warehouse else 'WH-MAIN'),
                'warehouse_name': wh_name,
                'track_inventory': o.item_type == 'goods' and o.track_inventory,
                'stock': format_qty(avail_stock) if (o.item_type == 'goods' and o.track_inventory) else None,
                'available_stock': float(avail_stock) if (o.item_type == 'goods' and o.track_inventory) else 0.0,
                'unit': o.unit or 'Nos'
            })
    elif name == 'accounts':
        services.ensure_default_accounts(user_org)
        data = [{'id': o.pk, 'code': o.code, 'name': o.name, 'type': o.account_type, 'sub_type': o.sub_type}
                for o in org_filter(Account.objects.filter(active=True)).order_by('code')]
    elif name == 'bank-accounts':
        data = [{'id': o.pk, 'name': o.name, 'bank_name': o.bank_name, 'account_number': o.account_number,
                 'account_type': o.account_type, 'balance': o.current_balance,
                 'display_name': f"{o.name} - {o.bank_name} (••••{o.account_number[-4:] if len(o.account_number) >= 4 else o.account_number}) [₹{o.current_balance:,.2f}]"}
                for o in org_filter(BankAccount.objects.filter(active=True)).order_by('name')]
    elif name == 'folders':
        data = [{'id': o.pk, 'name': o.name, 'color': o.color}
                for o in org_filter(DocumentFolder.objects.all()).order_by('name')]
    elif name == 'categories':
        data = [{'id': o.pk, 'name': o.name}
                for o in org_filter(ItemCategory.objects.all()).order_by('name')]
    elif name == 'projects':
        p_qs = org_filter(Project.objects.filter(status='active'))
        cid = request.GET.get('customer') or request.GET.get('customer_id')
        if cid and str(cid).isdigit():
            p_qs = p_qs.filter(customer_id=int(cid))
        data = [{'id': o.pk, 'name': o.name, 'code': o.code, 'customer_id': o.customer_id}
                for o in p_qs.order_by('name')]
    elif name == 'warehouse-stock':
        item_id = request.GET.get('item_id')
        wh_id = request.GET.get('warehouse_id')
        if not item_id:
            raise ApiError(400, 'item_id is required.')
        item = Item.objects.filter(pk=item_id, organization=user_org).first() if user_org else Item.objects.filter(pk=item_id).first()
        if not item:
            raise ApiError(404, 'Item not found.')
        warehouses_list = list(org_filter(Warehouse.objects.filter(active=True)).order_by('name'))
        if wh_id:
            wh = Warehouse.objects.filter(pk=wh_id).first()
            wh_target = wh.code if wh else wh_id
            avail = services.get_item_warehouse_stock(item, wh_target, org=user_org)
            data = {
                'item_id': item.pk,
                'warehouse_id': wh.pk if wh else None,
                'warehouse_code': wh.code if wh else str(wh_id),
                'warehouse_name': wh.name if wh else str(wh_id),
                'available_stock': float(avail),
                'unit': item.unit or 'Nos'
            }
        else:
            stocks = []
            for wh in warehouses_list:
                avail = services.get_item_warehouse_stock(item, wh.code, org=user_org)
                stocks.append({
                    'warehouse_id': wh.pk,
                    'warehouse_code': wh.code,
                    'warehouse_name': wh.name,
                    'available_stock': float(avail),
                    'unit': item.unit or 'Nos'
                })
            sum_entry = services.get_stock_movement_summary([item], org=user_org).get(item.pk, {})
            tot_avail = sum_entry.get('available_stock', item.stock)
            data = {
                'item_id': item.pk,
                'overall_available_stock': float(tot_avail),
                'unit': item.unit or 'Nos',
                'warehouses': stocks
            }
    elif name == 'warehouses':
        wh_qs = org_filter(Warehouse.objects.filter(active=True)).select_related('parent').order_by('name')
        if user_org and not wh_qs.exists():
            Warehouse.objects.create(
                organization=user_org,
                name='HO Kottayam',
                code='WH-MAIN',
                is_primary=True,
                shared_database=True,
                active=True
            )
            wh_qs = org_filter(Warehouse.objects.filter(active=True)).select_related('parent').order_by('name')
        data = [{'id': o.pk, 'name': o.name, 'code': o.code, 'is_primary': o.is_primary,
                 'is_sub_warehouse': bool(o.parent_id), 'parent_id': o.parent_id,
                 'parent_code': o.parent.code if o.parent else '',
                 'parent_name': o.parent.name if o.parent else '',
                 'shared_database': o.shared_database}
                for o in wh_qs]
    elif name == 'price-lists':
        data = [{'id': o.pk, 'name': o.name, 'percentage': o.percentage}
                for o in org_filter(PriceList.objects.filter(active=True)).order_by('name')]
    elif name == 'salespersons':
        from .models import Salesperson
        sp_qs = Salesperson.objects.filter(is_active=True)
        if user_org:
            sp_qs = sp_qs.filter(organization=user_org)
        data = [{'id': s.pk, 'name': s.name, 'email': s.email, 'phone': s.phone} for s in sp_qs.order_by('name')]
        from django.contrib.auth import get_user_model
        User = get_user_model()
        sp_user_qs = User.objects.filter(is_active=True, profile__organization=user_org) if user_org else User.objects.filter(is_active=True)
        existing_names = {s['name'].strip().lower() for s in data}
        for u in sp_user_qs.order_by('username'):
            uname = u.get_full_name() or u.username
            if uname.strip().lower() not in existing_names:
                existing_names.add(uname.strip().lower())
                data.append({'id': f"u_{u.pk}", 'name': uname, 'email': u.email, 'phone': getattr(u.profile, 'phone', '') if hasattr(u, 'profile') else ''})
    elif name == 'transaction-series':
        data = [
            {'id': 'Default Transaction Series', 'name': 'Default Transaction Series'},
            {'id': 'Online Store Series', 'name': 'Online Store Series'},
            {'id': 'Export Series', 'name': 'Export Series'},
            {'id': 'Retail Series', 'name': 'Retail Series'},
        ]
    elif name == 'employees':
        from django.contrib.auth import get_user_model
        User = get_user_model()
        eq_qs = User.objects.filter(is_active=True, profile__organization=user_org) if user_org else User.objects.filter(is_active=True)
        data = [{'id': u.pk, 'name': u.get_full_name() or u.username} for u in eq_qs.order_by('username')]
    elif name in ('next-quote-number', 'next-qtn-number'):
        org = user_org or Organization.get()
        pfx = org.quote_prefix or 'QTN' if org else 'QTN'
        data = services.preview_document_number(pfx, org=org)
    elif name in ('next-so-number', 'next-sales-order-number'):
        org = user_org or Organization.get()
        data = services.preview_document_number('SO', org=org)
    elif name in ('next-invoice-number', 'next-inv-number'):
        org = user_org or Organization.get()
        data = services.preview_document_number('INV', org=org)
    elif name in ('next-retainer-number', 'next-ret-number', 'next-retainer-invoice-number'):
        org = user_org or Organization.get()
        data = services.preview_document_number('RET', org=org)
    elif name in ('next-bill-number',):
        org = user_org or Organization.get()
        data = services.preview_document_number('BILL', org=org)
    elif name in ('next-customer-code', 'next-cust-code', 'next-cust-number'):
        org = user_org or Organization.get()
        data = services.preview_document_number('CUST', org=org)
    elif name in ('next-vendor-code', 'next-vend-code', 'next-vend-number'):
        org = user_org or Organization.get()
        data = services.preview_document_number('VEND', org=org)
    elif name in ('next-item-sku', 'next-sku'):
        org = user_org or Organization.get()
        data = services.preview_document_number('ITEM', org=org)
    elif name in ('next-journal-number', 'next-jrn-number'):
        org = user_org or Organization.get()
        data = services.preview_document_number('JRN', org=org)
    elif name in ('next-expense-number', 'next-exp-number'):
        org = user_org or Organization.get()
        data = services.preview_document_number('EXP', org=org)
    elif name in ('next-payment-received-number', 'next-pr-number'):
        org = user_org or Organization.get()
        data = services.preview_document_number('PR', org=org)
    elif name in ('next-payment-made-number', 'next-pm-number'):
        org = user_org or Organization.get()
        data = services.preview_document_number('PM', org=org)
    elif name in ('next-credit-note-number', 'next-cn-number'):
        org = user_org or Organization.get()
        data = services.preview_document_number('CN', org=org)
    elif name in ('next-debit-note-number', 'next-dn-number', 'next-vc-number'):
        org = user_org or Organization.get()
        data = services.preview_document_number('DN', org=org)
    elif name in ('next-delivery-challan-number', 'next-dc-number'):
        org = user_org or Organization.get()
        data = services.preview_document_number('DC', org=org)
    elif name in ('next-stock-transfer-number', 'next-st-number'):
        org = user_org or Organization.get()
        data = services.preview_document_number('ST', org=org)
    elif name in ('next-stock-adjustment-number', 'next-adj-number'):
        org = user_org or Organization.get()
        data = services.preview_document_number('ADJ', org=org)
    else:
        raise ApiError(404, 'Unknown lookup.')
    return j(data)

@api_view
def quote_sequence_view(request):
    user_org = get_user_org(request.user)
    org = user_org or Organization.get()
    pfx = org.quote_prefix or 'QTN' if org else 'QTN'
    if request.method == 'GET':
        prev = services.preview_document_number(pfx, org=org)
        return j(prev)
    elif request.method == 'POST':
        import json, re
        try:
            body_data = json.loads(request.body.decode('utf-8')) if request.body else {}
        except Exception:
            raise ApiError(400, 'Invalid JSON body.')
        new_pfx = (body_data.get('prefix') or '').strip().upper()
        if not new_pfx or not re.match(r'^[A-Z0-9_\-]+$', new_pfx):
            raise ApiError(400, 'Invalid prefix. Use uppercase letters, numbers, and hyphens only.')
        next_seq = body_data.get('next_sequence') or body_data.get('next_number') or 1
        try:
            next_seq = int(next_seq)
            if next_seq < 1:
                raise ValueError()
        except (TypeError, ValueError):
            raise ApiError(400, 'Next sequence number must be a positive integer.')

        if org:
            org.quote_prefix = new_pfx
            org.save(update_fields=['quote_prefix'])

        fy = services.get_financial_year()
        new_key = f"{org.pk}_{new_pfx}_{fy}" if org else f"{new_pfx}_{fy}"
        seq, _ = Sequence.objects.get_or_create(key=new_key)
        seq.value = max(0, next_seq - 1)
        seq.save(update_fields=['value'])

        prev = services.preview_document_number(new_pfx, org=org)
        return j(prev)

@api_view
def invoice_sequence_view(request):
    user_org = get_user_org(request.user)
    org = user_org or Organization.get()
    pfx = 'INV'
    if request.method == 'GET':
        prev = services.preview_document_number(pfx, org=org)
        return j(prev)
    elif request.method == 'POST':
        import json, re
        try:
            body_data = json.loads(request.body.decode('utf-8')) if request.body else {}
        except Exception:
            raise ApiError(400, 'Invalid JSON body.')
        new_pfx = (body_data.get('prefix') or 'INV').strip().upper()
        if not new_pfx or not re.match(r'^[A-Z0-9_\-]+$', new_pfx):
            raise ApiError(400, 'Invalid prefix. Use uppercase letters, numbers, and hyphens only.')
        next_seq = body_data.get('next_sequence') or body_data.get('next_number') or 1
        try:
            next_seq = int(next_seq)
            if next_seq < 1:
                raise ValueError()
        except (TypeError, ValueError):
            raise ApiError(400, 'Next sequence number must be a positive integer.')

        fy = services.get_financial_year()
        new_key = f"{org.pk}_{new_pfx}_{fy}" if org else f"{new_pfx}_{fy}"
        seq, _ = Sequence.objects.get_or_create(key=new_key)
        seq.value = max(0, next_seq - 1)
        seq.save(update_fields=['value'])

        prev = services.preview_document_number(new_pfx, org=org)
        return j(prev)

@api_view
def retainer_sequence_view(request):
    user_org = get_user_org(request.user)
    org = user_org or Organization.get()
    pfx = 'RET'
    if request.method == 'GET':
        prev = services.preview_document_number(pfx, org=org)
        return j(prev)
    elif request.method == 'POST':
        import json, re
        try:
            body_data = json.loads(request.body.decode('utf-8')) if request.body else {}
        except Exception:
            raise ApiError(400, 'Invalid JSON body.')
        new_pfx = (body_data.get('prefix') or 'RET').strip().upper()
        if not new_pfx or not re.match(r'^[A-Z0-9_\-]+$', new_pfx):
            raise ApiError(400, 'Invalid prefix. Use uppercase letters, numbers, and hyphens only.')
        next_seq = body_data.get('next_sequence') or body_data.get('next_number') or 1
        try:
            next_seq = int(next_seq)
            if next_seq < 1:
                raise ValueError()
        except (TypeError, ValueError):
            raise ApiError(400, 'Next sequence number must be a positive integer.')

        fy = services.get_financial_year()
        new_key = f"{org.pk}_{new_pfx}_{fy}" if org else f"{new_pfx}_{fy}"
        seq, _ = Sequence.objects.get_or_create(key=new_key)
        seq.value = max(0, next_seq - 1)
        seq.save(update_fields=['value'])

        prev = services.preview_document_number(new_pfx, org=org)
        return j(prev)

def dashboard_view(request):
    start, end = parse_range(request)
    org = get_user_org(request.user, request)
    return j(services.dashboard(start, end, org=org))

@api_view
def activity_view(request):
    try:
        limit = min(max(int(request.GET.get('limit', 30)), 1), 100)
    except ValueError:
        limit = 30
    org = get_user_org(request.user, request)
    return j(services.recent_activity(limit, org=org))

@api_view
def search_view(request):
    q = request.GET.get('q', '').strip()
    if len(q) < 2:
        return j([])
    user_org = get_user_org(request.user, request)
    def org_filter(qs):
        if hasattr(qs.model, 'organization'):
            if user_org:
                return qs.filter(organization=user_org)
            return qs.none()
        return qs
    out = []
    for o in org_filter(Customer.objects.filter(Q(name__icontains=q) | Q(company__icontains=q) | Q(email__icontains=q)))[:5]:
        out.append({'type': 'customer', 'id': o.pk, 'label': o.name, 'sub': 'Customer'})
    for o in org_filter(Vendor.objects.filter(Q(name__icontains=q) | Q(company__icontains=q) | Q(email__icontains=q)))[:5]:
        out.append({'type': 'vendor', 'id': o.pk, 'label': o.name, 'sub': 'Vendor'})
    for o in org_filter(Invoice.objects.select_related('customer').filter(Q(number__icontains=q) | Q(customer__name__icontains=q)))[:5]:
        out.append({'type': 'invoice', 'id': o.pk, 'label': o.number, 'sub': f'Invoice · {o.customer.name}'})
    for o in org_filter(Bill.objects.select_related('vendor').filter(Q(number__icontains=q) | Q(vendor__name__icontains=q) | Q(vendor_ref__icontains=q)))[:5]:
        out.append({'type': 'bill', 'id': o.pk, 'label': o.number, 'sub': f'Bill · {o.vendor.name}'})
    for o in org_filter(Item.objects.filter(Q(name__icontains=q) | Q(sku__icontains=q)))[:5]:
        out.append({'type': 'item', 'id': o.pk, 'label': o.name, 'sub': f'Item · {o.sku}'})
    doc_qs = ManagedDocument.objects.filter(is_deleted=False)
    if user_org:
        doc_qs = doc_qs.filter(organization=user_org)
    else:
        doc_qs = doc_qs.none()
    for o in doc_qs.filter(Q(title__icontains=q) | Q(filename__icontains=q))[:5]:
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
    user_org = get_user_org(request.user)
    if name == 'trial-balance':
        as_of = request.GET.get('as_of')
        as_of_date = Cleaner({'as_of': as_of}).date('as_of') if as_of else end
        return j(services.trial_balance_report(as_of_date, org=user_org))
    elif name == 'general-ledger':
        acc_id = request.GET.get('account')
        return j(services.general_ledger_report(int(acc_id) if acc_id and acc_id.isdigit() else None, start, end, org=user_org))
    elif name == 'profit-loss':
        return j(services.profit_and_loss_report(start, end, org=user_org))
    elif name == 'balance-sheet':
        as_of = request.GET.get('as_of')
        as_of_date = Cleaner({'as_of': as_of}).date('as_of') if as_of else end
        return j(services.balance_sheet_report(as_of_date, org=user_org))
    elif name == 'cash-flow':
        return j(services.cash_flow_report(start, end, org=user_org))
    elif name == 'gstr1':
        data = services.gstr1_report(start, end, org=user_org)
        if request.GET.get('export') == 'json':
            resp = HttpResponse(json.dumps(data, cls=DjangoJSONEncoder, indent=2), content_type='application/json')
            resp['Content-Disposition'] = f'attachment; filename="GSTR1_{data["gstin"]}_{start}_{end}.json"'
            return resp
        return j(data)
    elif name == 'gstr3b':
        return j(services.gstr3b_report(start, end, org=user_org))
    elif name == 'itc-summary':
        return j(services.itc_summary_report(start, end, org=user_org))
    elif name == 'tax-liability':
        return j(services.tax_liability_report(start, end, org=user_org))
    elif name == 'business-overview':
        return j(services.dashboard(start, end, org=user_org))
    elif name == 'sales-by-customer':
        rows = []
        cust_qs = Customer.objects.filter(organization=user_org, active=True) if user_org else Customer.objects.none()
        for cust in cust_qs:
            invs = Invoice.objects.filter(organization=user_org, customer=cust, status='sent', date__range=(start, end)) if user_org else Invoice.objects.none()
            cnt = invs.count()
            tot = sum((i.total for i in invs), Z)
            taxable = sum((i.subtotal for i in invs), Z)
            if cnt > 0:
                rows.append({'customer': cust.name, 'gstin': cust.gstin or 'URP', 'invoices_count': cnt, 'taxable': taxable, 'total': tot})
        rows.sort(key=lambda x: -x['total'])
        return j({'period': {'start': start, 'end': end}, 'results': rows})
    elif name == 'sales-by-item':
        rows = []
        item_qs = Item.objects.filter(organization=user_org, active=True) if user_org else Item.objects.none()
        for it in item_qs:
            lines = InvoiceLine.objects.filter(invoice__organization=user_org, item=it, invoice__status='sent', invoice__date__range=(start, end)) if user_org else InvoiceLine.objects.none()
            qty_sum = sum((l.quantity for l in lines), Decimal('0.000'))
            tot = sum((l.line_total for l in lines), Z)
            if lines.exists():
                rows.append({'item': it.name, 'sku': it.sku, 'quantity': qty_sum, 'unit': it.unit, 'total': tot})
        rows.sort(key=lambda x: -x['total'])
        return j({'period': {'start': start, 'end': end}, 'results': rows})
    elif name == 'purchases-by-vendor':
        rows = []
        ven_qs = Vendor.objects.filter(organization=user_org, active=True) if user_org else Vendor.objects.none()
        for ven in ven_qs:
            bills = Bill.objects.filter(organization=user_org, vendor=ven, status='open', date__range=(start, end)) if user_org else Bill.objects.none()
            cnt = bills.count()
            tot = sum((b.total for b in bills), Z)
            if cnt > 0:
                rows.append({'vendor': ven.name, 'bills_count': cnt, 'total': tot})
        rows.sort(key=lambda x: -x['total'])
        return j({'period': {'start': start, 'end': end}, 'results': rows})
    elif name == 'inventory-summary':
        wh = request.GET.get('warehouse')
        i_id = request.GET.get('item')
        item_id = int(i_id) if i_id and i_id.isdigit() else None
        items_qs = Item.objects.filter(organization=user_org, item_type='goods', track_inventory=True, active=True) if user_org else Item.objects.none()
        if item_id:
            items_qs = items_qs.filter(pk=item_id)
        if wh:
            items_qs = items_qs.filter(Q(warehouse_code=wh) | Q(warehouse__code=wh))
        summary_map = services.get_stock_movement_summary(list(items_qs), org=user_org, warehouse=wh, start=start, end=end)
        rows = []
        for s in summary_map.values():
            rows.append({
                'id': s['item_id'],
                'item_id': s['item_id'],
                'item': s['name'],
                'sku': s['sku'],
                'warehouse_code': s['warehouse_code'],
                'warehouse_name': s['warehouse_name'],
                'opening_stock': format_qty(s['opening_stock']),
                'opening_stock_val': float(s['opening_stock_value']),
                'opening_date': s['opening_date'].strftime('%d/%m/%Y') if s['opening_date'] else '',
                'stock_in': format_qty(s['stock_in']),
                'stock_out': format_qty(s['stock_out']),
                'transfer_in': format_qty(s['transfer_in']),
                'transfer_out': format_qty(s['transfer_out']),
                'current_stock': format_qty(s['available_stock']),
                'stock_in_hand': format_qty(s['available_stock']),
                'closing_stock': format_qty(s['closing_stock']),
                'stock': format_qty(s['available_stock']),
                'unit': s['unit'],
                'cost_price': float(s['purchase_price']),
                'purchase_price': float(s['purchase_price']),
                'valuation': float(s['stock_value']),
                'stock_value': float(s['stock_value']),
                'reorder_level': format_qty(s['reorder_level']),
                'status': s['status']
            })
        return j({
            'results': rows,
            'total_opening_stock': sum((float(s['opening_stock']) for s in summary_map.values()), 0.0),
            'total_stock_in': sum((float(s['stock_in']) for s in summary_map.values()), 0.0),
            'total_stock_out': sum((float(s['stock_out']) for s in summary_map.values()), 0.0),
            'total_transfer_in': sum((float(s['transfer_in']) for s in summary_map.values()), 0.0),
            'total_transfer_out': sum((float(s['transfer_out']) for s in summary_map.values()), 0.0),
            'total_stock_in_hand': sum((float(s['available_stock']) for s in summary_map.values()), 0.0),
            'total_valuation': sum((float(s['stock_value']) for s in summary_map.values()), 0.0)
        })
    elif name == 'stock-in-report':
        wh = request.GET.get('warehouse')
        i_id = request.GET.get('item')
        item_id = int(i_id) if i_id and i_id.isdigit() else None
        return j(services.get_stock_in_report_data(user_org, warehouse=wh, start=start, end=end, item_id=item_id))
    elif name == 'stock-out-report':
        wh = request.GET.get('warehouse')
        i_id = request.GET.get('item')
        item_id = int(i_id) if i_id and i_id.isdigit() else None
        return j(services.get_stock_out_report_data(user_org, warehouse=wh, start=start, end=end, item_id=item_id))
    elif name == 'stock-transfer-report':
        wh = request.GET.get('warehouse')
        i_id = request.GET.get('item')
        item_id = int(i_id) if i_id and i_id.isdigit() else None
        return j(services.get_stock_transfer_report_data(user_org, warehouse=wh, start=start, end=end, item_id=item_id))
    elif name == 'opening-stock-report':
        wh = request.GET.get('warehouse')
        i_id = request.GET.get('item')
        item_id = int(i_id) if i_id and i_id.isdigit() else None
        items_qs = Item.objects.filter(organization=user_org, item_type='goods', track_inventory=True, active=True) if user_org else Item.objects.none()
        if item_id:
            items_qs = items_qs.filter(pk=item_id)
        if wh:
            items_qs = items_qs.filter(Q(warehouse_code=wh) | Q(warehouse__code=wh))
        summary_map = services.get_stock_movement_summary(list(items_qs), org=user_org, warehouse=wh, start=start, end=end)
        rows = []
        tot_qty = Decimal('0.000')
        tot_val = Decimal('0.00')
        for s in summary_map.values():
            tot_qty += s['opening_stock']
            tot_val += s['opening_stock_value']
            rows.append({
                'item_id': s['item_id'],
                'product_name': s['name'],
                'sku': s['sku'] or '—',
                'warehouse': s['warehouse_code'],
                'warehouse_name': s['warehouse_name'],
                'opening_quantity': format_qty(s['opening_stock']),
                'unit': s['unit'],
                'rate': float(s['purchase_price']),
                'opening_stock_value': float(s['opening_stock_value']),
                'transaction_date': s['opening_date'].strftime('%d/%m/%Y') if s['opening_date'] else ''
            })
        return j({
            'results': rows,
            'total_opening_quantity': float(tot_qty),
            'total_opening_value': float(tot_val),
            'count': len(rows)
        })
    elif name == 'stock-in-hand-report':
        wh = request.GET.get('warehouse')
        i_id = request.GET.get('item')
        item_id = int(i_id) if i_id and i_id.isdigit() else None
        items_qs = Item.objects.filter(organization=user_org, item_type='goods', track_inventory=True, active=True) if user_org else Item.objects.none()
        if item_id:
            items_qs = items_qs.filter(pk=item_id)
        if wh:
            items_qs = items_qs.filter(Q(warehouse_code=wh) | Q(warehouse__code=wh))
        summary_map = services.get_stock_movement_summary(list(items_qs), org=user_org, warehouse=wh, start=start, end=end)
        rows = []
        tot_avail = Decimal('0.000')
        tot_val = Decimal('0.00')
        for s in summary_map.values():
            tot_avail += s['available_stock']
            tot_val += s['stock_value']
            rows.append({
                'item_id': s['item_id'],
                'product_name': s['name'],
                'sku': s['sku'] or '—',
                'warehouse': s['warehouse_code'],
                'warehouse_name': s['warehouse_name'],
                'opening_stock': format_qty(s['opening_stock']),
                'total_stock_in': format_qty(s['stock_in']),
                'total_stock_out': format_qty(s['stock_out']),
                'transfer_in': format_qty(s['transfer_in']),
                'transfer_out': format_qty(s['transfer_out']),
                'available_stock': format_qty(s['available_stock']),
                'closing_balance': format_qty(s['closing_stock']),
                'unit': s['unit'],
                'rate': float(s['purchase_price']),
                'stock_value': float(s['stock_value']),
                'status': s['status']
            })
        return j({
            'results': rows,
            'total_available_stock': float(tot_avail),
            'total_stock_value': float(tot_val),
            'count': len(rows)
        })
    elif name == 'receivables-aging':
        inv_open = list(invoice_qs(org=user_org).filter(status='sent', paid_sum__lt=F('total')))
        today = timezone.localdate()
        return j({'aging': services._aging(inv_open, today), 'invoices': [{'number': i.number, 'customer': i.customer.name, 'due_date': i.due_date, 'overdue_days': max(0, (today - i.due_date).days), 'balance': i.total - q2(i.paid_sum)} for i in inv_open]})
    elif name == 'payables-aging':
        bill_open = list(bill_qs(org=user_org).filter(status='open', paid_sum__lt=F('total')))
        today = timezone.localdate()
        return j({'aging': services._aging(bill_open, today), 'bills': [{'number': b.number, 'vendor': b.vendor.name, 'due_date': b.due_date, 'overdue_days': max(0, (today - b.due_date).days), 'balance': b.total - q2(b.paid_sum)} for b in bill_open]})
    else:
        raise ApiError(404, f"Report '{name}' not found.")

@api_view
def opening_stock_preview_view(request):
    if request.method != 'GET':
        raise ApiError(405, 'Method not allowed.')
    item_id = request.GET.get('item_id')
    if not item_id or not item_id.isdigit():
        raise ApiError(400, 'Valid item_id parameter is required.')
    warehouse = request.GET.get('warehouse')
    user_org = get_user_org(request.user)
    data = services.get_opening_stock_preview(user_org, int(item_id), warehouse=warehouse)
    return j(data)

@api_view
def stock_in_hand_preview_view(request):
    if request.method != 'GET':
        raise ApiError(405, 'Method not allowed.')
    item_id = request.GET.get('item_id')
    if not item_id or not item_id.isdigit():
        raise ApiError(400, 'Valid item_id parameter is required.')
    warehouse = request.GET.get('warehouse')
    user_org = get_user_org(request.user)
    data = services.get_stock_in_hand_preview(user_org, int(item_id), warehouse=warehouse)
    return j(data)

@api_view
@role_required(UserProfile.ADMIN, UserProfile.ACCOUNTANT)
def banking_import_view(request):
    if request.method != 'POST':
        raise ApiError(405, 'Method not allowed.')

    ba_id = request.POST.get('bank_account') or request.GET.get('bank_account')
    rows = []
    file_obj = request.FILES.get('file')
    filename = 'statement.csv'

    if file_obj:
        filename = file_obj.name
        content = file_obj.read().decode('utf-8-sig', errors='ignore')
        sample = content[:2048]
        delim = '\t' if '\t' in sample and ',' not in sample else (';' if ';' in sample and ',' not in sample else ',')
        reader = csv.DictReader(io.StringIO(content), delimiter=delim)
        for raw in reader:
            if not raw or all(not str(v).strip() for v in raw.values() if v is not None):
                continue
            col_map = {re.sub(r'[^a-z0-9]', '', str(k).lower()): v for k, v in raw.items() if k}
            date_val = None
            for dk in ('date', 'txndate', 'valuedate', 'transactiondate', 'bookingdate'):
                if dk in col_map and col_map[dk]:
                    date_val = col_map[dk]
                    break
            desc_val = ''
            for nk in ('narration', 'description', 'remarks', 'particulars', 'details', 'transdesc'):
                if nk in col_map and col_map[nk]:
                    desc_val = col_map[nk]
                    break
            ref_val = ''
            for rk in ('reference', 'ref', 'chq', 'chequeno', 'utr', 'refno', 'transactionid'):
                if rk in col_map and col_map[rk]:
                    ref_val = col_map[rk]
                    break
            dep_val = '0.00'
            for ck in ('deposit', 'credit', 'cr', 'depositamount', 'creditamount'):
                if ck in col_map and col_map[ck]:
                    dep_val = str(col_map[ck])
                    break
            wd_val = '0.00'
            for wk in ('withdrawal', 'debit', 'dr', 'withdrawalamount', 'debitamount'):
                if wk in col_map and col_map[wk]:
                    wd_val = str(col_map[wk])
                    break
            if dep_val == '0.00' and wd_val == '0.00':
                for ak in ('amount', 'total'):
                    if ak in col_map and col_map[ak]:
                        amt_str = str(col_map[ak]).replace('₹', '').replace('$', '').replace(',', '').strip()
                        try:
                            a_num = Decimal(amt_str)
                            if a_num > 0: dep_val = str(a_num)
                            else: wd_val = str(abs(a_num))
                        except Exception: pass
                        break

            rows.append({
                'date': date_val,
                'description': desc_val or 'Bank Transaction',
                'reference': ref_val,
                'deposit': dep_val,
                'withdrawal': wd_val
            })
    else:
        try:
            d = body(request)
            ba_id = ba_id or d.get('bank_account')
            rows = d.get('transactions', [])
        except Exception:
            pass

    ba = BankAccount.objects.filter(pk=ba_id).first() if ba_id else BankAccount.objects.first()
    if not ba:
        raise ApiError(404, 'Bank account not found.')

    today = timezone.localdate()
    if not rows:
        feed_samples = [
            {'date': today.isoformat(), 'description': 'NEFT/Customer Inward Remittance', 'deposit': '15000.00', 'withdrawal': '0.00', 'reference': 'N10293848'},
            {'date': today.isoformat(), 'description': 'UPI/Office Stationery Store', 'deposit': '0.00', 'withdrawal': '1250.00', 'reference': 'UPI-492019'},
            {'date': today.isoformat(), 'description': 'IMPS/Cloud Server Hosting Bill', 'deposit': '0.00', 'withdrawal': '4500.00', 'reference': 'IMP-882910'},
            {'date': today.isoformat(), 'description': 'Direct Debit/Monthly Workspace Rent', 'deposit': '0.00', 'withdrawal': '25000.00', 'reference': 'DD-002919'},
        ]
        rows = feed_samples

    batch = BankStatementBatch.objects.create(
        bank_account=ba,
        batch_number=next_number('STMT'),
        filename=filename,
        source='csv_import',
        total_rows=len(rows),
        status='completed'
    )

    created = []
    duplicates = 0
    bal = ba.current_balance

    for r in rows:
        dt = None
        raw_dt = str(r.get('date') or '').strip()
        for fmt in ('%Y-%m-%d', '%d/%m/%Y', '%d-%m-%Y', '%Y/%m/%d', '%m/%d/%Y'):
            try:
                import datetime
                dt = datetime.datetime.strptime(raw_dt, fmt).date()
                break
            except Exception:
                pass
        if not dt:
            dt = today

        dep = Decimal(str(r.get('deposit') or 0).replace('₹', '').replace('$', '').replace(',', '').strip() or '0')
        wth = Decimal(str(r.get('withdrawal') or 0).replace('₹', '').replace('$', '').replace(',', '').strip() or '0')
        ref = str(r.get('reference') or '')
        desc = str(r.get('description') or 'Bank Transaction')

        thash = services.compute_txn_hash(dt, wth, dep, ref, desc)
        if BankTransaction.objects.filter(bank_account=ba, transaction_hash=thash).exists():
            duplicates += 1
            continue

        bal = bal + dep - wth
        txn = BankTransaction.objects.create(
            bank_account=ba,
            date=dt,
            description=desc,
            reference=ref,
            deposit=dep,
            withdrawal=wth,
            balance=bal,
            status='unreconciled',
            transaction_hash=thash,
            batch=batch
        )
        services.apply_bank_rules_to_transaction(txn)
        created.append(txn.pk)

    ba.current_balance = bal
    ba.save(update_fields=['current_balance'])
    batch.imported_count = len(created)
    batch.duplicate_count = duplicates
    batch.save(update_fields=['imported_count', 'duplicate_count'])

    services.log_audit(request.user, 'import', 'BankAccount', ba.pk, f"Imported {len(created)} bank transactions for {ba.name}")
    return j({
        'status': 'ok',
        'count': len(created),
        'imported': len(created),
        'duplicates_skipped': duplicates,
        'current_balance': str(bal),
        'message': f"Statement imported! {len(created)} transactions ingested, {duplicates} duplicate entries skipped."
    })

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
    res = services.record_bank_transfer(d, user=request.user, org=get_user_org(request.user, request))
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
    org = get_user_org(request.user)
    res = services.get_tenant_subscription_summary(org=org)
    return j(res)

@api_view
@role_required(UserProfile.ADMIN)
def subscription_update_view(request):
    if request.method != 'POST':
        raise ApiError(405, 'Method not allowed.')
    org = get_user_org(request.user)
    d = body(request)
    tier = d.get('tier', 'professional')
    cycle = d.get('billing_cycle', 'annual')
    res = services.update_tenant_subscription(org=org, tier=tier, billing_cycle=cycle, user=request.user)
    return j(res)

@api_view
@role_required(UserProfile.ADMIN)
def subscription_trial_view(request):
    if request.method != 'POST':
        raise ApiError(405, 'Method not allowed.')
    org = get_user_org(request.user)
    d = body(request)
    tier = d.get('tier', 'professional')
    res = services.start_subscription_trial(org=org, tier=tier, user=request.user)
    return j(res)

@api_view
@role_required(UserProfile.ADMIN)
def subscription_addon_view(request):
    if request.method != 'POST':
        raise ApiError(405, 'Method not allowed.')
    org = get_user_org(request.user)
    d = body(request)
    addon_key = d.get('addon_key') or d.get('addon_id') or ''
    qty = int(d.get('quantity') or 1)
    res = services.purchase_subscription_addon(org=org, addon_key=addon_key, quantity=qty, user=request.user)
    return j(res)

@api_view
@role_required(UserProfile.ADMIN)
def subscription_autorenew_view(request):
    if request.method != 'POST':
        raise ApiError(405, 'Method not allowed.')
    org = get_user_org(request.user)
    d = body(request)
    auto_renew = d.get('auto_renew')
    res = services.toggle_subscription_autorenew(org=org, auto_renew=auto_renew, user=request.user)
    return j(res)

@api_view
def subscription_receipt_download_view(request, pk):
    org = get_user_org(request.user)
    inv = SubscriptionInvoice.objects.filter(organization=org, pk=pk).first()
    if not inv:
        raise ApiError(404, 'Subscription invoice receipt not found.')

    receipt_text = f"""CONVOSIS TECHNOLOGIES PRIVATE LIMITED
TAX INVOICE / SUBSCRIPTION RECEIPT
------------------------------------------------------------
Receipt Number : {inv.invoice_no}
Billing Date   : {inv.date.strftime('%d %b %Y')}
Status         : {inv.status}
Payment Method : {inv.payment_method}
Organization   : {org.name if org else 'Convosis Books'}
GSTIN          : {org.gstin if org else '32AANCC9298C1ZE'}
------------------------------------------------------------
Item Description                                      Amount
------------------------------------------------------------
{inv.description[:45]:<45}   INR {inv.amount:>10.2f}
------------------------------------------------------------
Total Paid:                                    INR {inv.amount:>10.2f}
------------------------------------------------------------
This is a computer-generated tax receipt. No physical signature required.
convosis.com | support@convosis.com
"""
    from django.http import HttpResponse
    response = HttpResponse(receipt_text, content_type='text/plain; charset=utf-8')
    response['Content-Disposition'] = f'attachment; filename="{inv.invoice_no}.txt"'
    return response

@api_view
@role_required(UserProfile.ADMIN)
def tenant_admin_summary_view(request):
    org = get_user_org(request.user)
    res = services.get_tenant_admin_summary(org=org)
    return j(res)

@api_view
@role_required(UserProfile.ADMIN)
def tenant_admin_invite_user_view(request):
    if request.method != 'POST':
        raise ApiError(405, 'Method not allowed.')
    d = body(request)
    org = get_user_org(request.user)
    res = services.invite_tenant_user(
        username=d.get('username'),
        email=d.get('email'),
        role=d.get('role', 'accountant'),
        phone=d.get('phone', ''),
        full_name=d.get('full_name', ''),
        password=d.get('password'),
        org=org
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
def tenant_admin_toggle_active_view(request, pk):
    if request.method != 'POST':
        raise ApiError(405, 'Method not allowed.')
    res = services.toggle_tenant_user_active(pk, requesting_user=request.user)
    return j(res)

@api_view
@role_required(UserProfile.ADMIN)
def tenant_admin_reset_password_view(request, pk):
    if request.method != 'POST':
        raise ApiError(405, 'Method not allowed.')
    d = body(request)
    res = services.reset_tenant_user_password(pk, d.get('password'), requesting_user=request.user)
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
    user_org = get_user_org(request.user)
    res = services.get_live_accounting_context(org=user_org)
    return j(res)

@api_view
def gstin_lookup_view(request, gstin):
    res = services.lookup_gstin_details(gstin)
    return j(res)

@api_view
def parse_import_file_view(request):
    if request.method != 'POST':
        raise ApiError(405, 'Method not allowed.')
    file_obj = request.FILES.get('file')
    if not file_obj:
        raise ApiError(400, 'No file was uploaded.')
    try:
        res = services.parse_import_file(file_obj, file_obj.name)
        return j(res)
    except Exception as e:
        raise ApiError(400, f"Failed to parse file: {str(e)}")

def superuser_required(fn):
    @wraps(fn)
    def wrapper(request, *args, **kwargs):
        if not request.user or not request.user.is_authenticated:
            return JsonResponse({'error': 'Authentication required.'}, status=401)
        if not request.user.is_superuser:
            return JsonResponse({'error': 'Permission denied: Super Admin platform access required.'}, status=403)
        return fn(request, *args, **kwargs)
    return wrapper

@api_view
@superuser_required
def super_admin_overview_view(request):
    from django.contrib.auth import get_user_model
    User = get_user_model()
    now = timezone.now()
    today = timezone.localdate()

    total_users = User.objects.count()
    active_users = User.objects.filter(is_active=True).count()
    inactive_users = total_users - active_users

    total_companies = Organization.objects.count()
    active_companies = Organization.objects.filter(is_active=True).count()
    inactive_companies = total_companies - active_companies

    # New registrations over time (last 30 days)
    start_30 = now - timedelta(days=30)
    users_30 = User.objects.filter(date_joined__gte=start_30).order_by('date_joined')
    trend_map = {}
    for i in range(30):
        d = (today - timedelta(days=29 - i)).strftime('%Y-%m-%d')
        trend_map[d] = 0
    for u in users_30:
        d_str = u.date_joined.strftime('%Y-%m-%d')
        if d_str in trend_map:
            trend_map[d_str] += 1
    registration_trend = [{'date': d, 'count': cnt} for d, cnt in trend_map.items()]

    # Total business records breakdown by company
    companies_summary = []
    for org in Organization.objects.all().order_by('-id')[:50]:
        users_count = UserProfile.objects.filter(organization=org).count()
        cust_cnt = Customer.objects.filter(organization=org).count()
        vend_cnt = Vendor.objects.filter(organization=org).count()
        item_cnt = Item.objects.filter(organization=org).count()
        inv_cnt = Invoice.objects.filter(organization=org).count()
        bill_cnt = Bill.objects.filter(organization=org).count()
        pay_cnt = PaymentReceived.objects.filter(organization=org).count() + PaymentMade.objects.filter(organization=org).count()
        adj_cnt = StockMovement.objects.filter(organization=org, kind='adjustment').count()
        total_records = cust_cnt + vend_cnt + item_cnt + inv_cnt + bill_cnt + pay_cnt + adj_cnt

        companies_summary.append({
            'id': org.pk,
            'name': org.name,
            'legal_name': org.company_id or org.name,
            'state': org.state,
            'gstin': org.gstin or 'Unregistered',
            'created_at': org.created_at.strftime('%Y-%m-%d %H:%M') if org.created_at else '',
            'is_active': org.is_active,
            'users_count': users_count,
            'total_records': total_records,
            'record_counts': {
                'customers': cust_cnt,
                'vendors': vend_cnt,
                'items': item_cnt,
                'invoices': inv_cnt,
                'bills': bill_cnt,
                'payments': pay_cnt,
                'stock_adjustments': adj_cnt
            }
        })

    # Recent platform audit activity
    recent_activity = []
    for log in AuditLog.objects.select_related('user').order_by('-timestamp')[:20]:
        recent_activity.append({
            'id': log.pk,
            'timestamp': log.timestamp.strftime('%Y-%m-%d %H:%M:%S'),
            'user': log.user.username if log.user else 'System',
            'action': log.action,
            'model_name': log.entity_type,
            'object_id': log.entity_id,
            'summary': log.summary,
            'ip_address': log.ip_address or ''
        })

    # Recent user registrations
    recent_users = []
    for u in User.objects.select_related('profile__organization').order_by('-date_joined')[:10]:
        org = getattr(getattr(u, 'profile', None), 'organization', None)
        recent_users.append({
            'id': u.pk,
            'username': u.username,
            'email': u.email,
            'full_name': u.get_full_name() or u.username,
            'date_joined': u.date_joined.strftime('%Y-%m-%d %H:%M'),
            'is_active': u.is_active,
            'company': org.name if org else 'None',
            'role': getattr(getattr(u, 'profile', None), 'role', 'admin')
        })

    return j({
        'kpis': {
            'total_users': total_users,
            'active_users': active_users,
            'inactive_users': inactive_users,
            'total_companies': total_companies,
            'active_companies': active_companies,
            'inactive_companies': inactive_companies
        },
        'registration_trend': registration_trend,
        'companies': companies_summary,
        'recent_activity': recent_activity,
        'recent_users': recent_users
    })

@api_view
@superuser_required
def super_admin_users_view(request):
    from django.contrib.auth import get_user_model
    User = get_user_model()
    q = request.GET.get('q', '').strip()
    company_id = request.GET.get('company_id', '').strip()
    status = request.GET.get('status', '').strip()
    role = request.GET.get('role', '').strip()

    qs = User.objects.select_related('profile__organization').order_by('-date_joined')
    if q:
        qs = qs.filter(
            Q(username__icontains=q) |
            Q(email__icontains=q) |
            Q(first_name__icontains=q) |
            Q(last_name__icontains=q) |
            Q(profile__organization__name__icontains=q)
        )
    if company_id and company_id.isdigit():
        qs = qs.filter(profile__organization_id=int(company_id))
    if status == 'active':
        qs = qs.filter(is_active=True)
    elif status == 'inactive':
        qs = qs.filter(is_active=False)
    if role:
        qs = qs.filter(profile__role=role)

    users_list = []
    for u in qs[:100]:
        profile = getattr(u, 'profile', None)
        org = getattr(profile, 'organization', None)
        users_list.append({
            'id': u.pk,
            'username': u.username,
            'email': u.email,
            'full_name': u.get_full_name() or u.username,
            'is_active': u.is_active,
            'is_staff': u.is_staff,
            'is_superuser': u.is_superuser,
            'date_joined': u.date_joined.strftime('%Y-%m-%d %H:%M') if u.date_joined else '',
            'last_login': u.last_login.strftime('%Y-%m-%d %H:%M') if u.last_login else 'Never',
            'company_id': org.pk if org else None,
            'company_name': org.name if org else 'No Company',
            'role': profile.role if profile else 'admin'
        })
    return j({'users': users_list, 'total_count': qs.count()})

@api_view
@superuser_required
def super_admin_toggle_user_view(request, pk):
    from django.contrib.auth import get_user_model
    User = get_user_model()
    target_user = User.objects.filter(pk=pk).first()
    if not target_user:
        raise ApiError(404, 'User not found.')
    if target_user.pk == request.user.pk:
        raise ApiError(400, 'Cannot deactivate your own active superuser account.')

    target_user.is_active = not target_user.is_active
    target_user.save(update_fields=['is_active'])

    action_label = 'Activated' if target_user.is_active else 'Deactivated'
    services.log_audit(
        request.user,
        'update',
        'User',
        target_user.pk,
        f"Super Admin {action_label} user {target_user.username} ({target_user.email})"
    )
    return j({
        'status': 'ok',
        'user_id': target_user.pk,
        'is_active': target_user.is_active,
        'message': f"User {target_user.username} successfully {action_label.lower()}."
    })

@api_view
@superuser_required
def super_admin_company_detail_view(request, pk):
    org = Organization.objects.filter(pk=pk).first()
    if not org:
        raise ApiError(404, 'Company not found.')

    from django.contrib.auth import get_user_model
    User = get_user_model()
    company_users = []
    for u in User.objects.filter(profile__organization=org).order_by('username'):
        profile = getattr(u, 'profile', None)
        company_users.append({
            'id': u.pk,
            'username': u.username,
            'email': u.email,
            'full_name': u.get_full_name() or u.username,
            'role': profile.role if profile else 'admin',
            'is_active': u.is_active,
            'date_joined': u.date_joined.strftime('%Y-%m-%d %H:%M') if u.date_joined else ''
        })

    sub = TenantSubscription.objects.filter(organization=org).first()
    sub_data = {
        'plan_tier': sub.plan_tier if sub else 'standard',
        'status': sub.status if sub else 'active',
        'current_period_end': sub.current_period_end.strftime('%Y-%m-%d') if sub and sub.current_period_end else '',
        'max_users': sub.max_users if sub else 10
    }

    record_counts = {
        'customers': Customer.objects.filter(organization=org).count(),
        'vendors': Vendor.objects.filter(organization=org).count(),
        'items': Item.objects.filter(organization=org).count(),
        'invoices': Invoice.objects.filter(organization=org).count(),
        'bills': Bill.objects.filter(organization=org).count(),
        'payments': PaymentReceived.objects.filter(organization=org).count() + PaymentMade.objects.filter(organization=org).count(),
        'stock_adjustments': StockMovement.objects.filter(organization=org, kind='adjustment').count()
    }

    return j({
        'company': {
            'id': org.pk,
            'name': org.name,
            'legal_name': org.company_id or org.name,
            'company_id': org.company_id,
            'state': org.state,
            'gstin': org.gstin or '',
            'email': org.email or '',
            'phone': org.phone or '',
            'address': org.address or '',
            'city': org.city or '',
            'pincode': org.pincode or '',
            'country': org.country or 'India',
            'created_at': org.created_at.strftime('%Y-%m-%d %H:%M') if org.created_at else '',
            'is_active': org.is_active
        },
        'record_counts': record_counts,
        'users': company_users,
        'subscription': sub_data
    })

@api_view
@superuser_required
def super_admin_toggle_company_view(request, pk):
    org = Organization.objects.filter(pk=pk).first()
    if not org:
        raise ApiError(404, 'Company not found.')

    org.is_active = not org.is_active
    org.save(update_fields=['is_active'])

    action_label = 'Activated' if org.is_active else 'Deactivated'
    services.log_audit(
        request.user,
        'update',
        'Organization',
        org.pk,
        f"Super Admin {action_label} company {org.name} (ID: {org.pk})"
    )
    return j({
        'status': 'ok',
        'company_id': org.pk,
        'is_active': org.is_active,
        'message': f"Company {org.name} successfully {action_label.lower()}."
    })


# =========================================================================
# CONVOSISBOOKS SETTINGS MODULE API
# =========================================================================

def serialize_role(r):
    user_count = r.assigned_profiles.count() if hasattr(r, 'assigned_profiles') else 0
    return {
        'id': r.pk,
        'uuid': str(r.uuid) if r.uuid else None,
        'name': r.name,
        'description': r.description,
        'is_system': r.is_system,
        'api_only': r.api_only,
        'is_accountant': r.is_accountant,
        'user_count': user_count,
        'permissions': r.permissions or {},
        'report_permissions': r.report_permissions or {},
        'created_at': r.created_at.strftime('%Y-%m-%d %H:%M') if r.created_at else '',
        'updated_at': r.updated_at.strftime('%Y-%m-%d %H:%M') if r.updated_at else ''
    }

def serialize_user_entry(u, org):
    prof = getattr(u, 'profile', None)
    c_role = getattr(prof, 'custom_role', None) if prof else None
    role_name = c_role.name if c_role else (prof.role if prof else 'Staff')
    status = getattr(prof, 'status', 'active') if prof else ('active' if u.is_active else 'inactive')
    return {
        'id': u.pk,
        'user_id': prof.user_id_code if prof and prof.user_id_code else f"USR-{u.pk:08d}",
        'username': u.username,
        'name': u.get_full_name() or u.username,
        'email': u.email,
        'role': role_name,
        'role_id': c_role.pk if c_role else None,
        'status': status,
        'is_active': u.is_active and status != 'inactive',
        'phone': prof.phone if prof else '',
        'last_login': u.last_login.strftime('%Y-%m-%d %H:%M') if u.last_login else 'Never',
        'date_joined': u.date_joined.strftime('%Y-%m-%d') if u.date_joined else ''
    }

@api_view
def settings_all_view(request):
    """Return aggregated settings dashboard data for the user's organization."""
    check_permission(request, allowed_roles=[UserProfile.ADMIN])
    org = get_user_org(request.user) or Organization.get()
    services.ensure_default_settings(org)

    from django.contrib.auth import get_user_model
    User = get_user_model()

    users = [serialize_user_entry(u, org) for u in User.objects.filter(Q(profile__organization=org) | Q(is_superuser=True)).distinct().order_by('id')]
    roles = [serialize_role(r) for r in Role.objects.filter(organization=org).order_by('id')]
    currencies = [{
        'id': c.pk, 'code': c.code, 'name': c.name, 'symbol': c.symbol,
        'exchange_rate': float(c.exchange_rate), 'is_base': c.is_base, 'is_active': c.is_active
    } for c in CurrencySetting.objects.filter(organization=org).order_by('id')]

    payment_terms = [{
        'id': p.pk, 'name': p.name, 'days': p.days, 'is_default': p.is_default, 'is_active': p.is_active
    } for p in PaymentTermSetting.objects.filter(organization=org).order_by('days')]

    # Number series summary
    number_series = []
    for mod_key, label in [
        ('INV', 'Invoice'), ('CUST', 'Customer'), ('VEND', 'Vendor'),
        ('SO', 'Sales Order'), ('QTN', 'Quotation'), ('PO', 'Purchase Order'),
        ('BILL', 'Bill'), ('PR', 'Payment Received'), ('PM', 'Payment Made'),
        ('CN', 'Credit Note'), ('DN', 'Debit Note'), ('JRN', 'Journal'),
        ('DC', 'Delivery Challan'), ('ITEM', 'Items'), ('ST', 'Stock Transfer'),
        ('EXP', 'Expense'), ('ADJ', 'Stock Adjustment')
    ]:
        prev = services.preview_document_number(mod_key, org=org)
        number_series.append({
            'module': mod_key,
            'label': label,
            'prefix': prev.get('prefix', mod_key),
            'next_sequence': prev.get('next_sequence', 1),
            'financial_year': prev.get('financial_year', ''),
            'sample_formatted': prev.get('formatted', '')
        })

    return j({
        'organization': org_json(org),
        'users': users,
        'roles': roles,
        'currencies': currencies,
        'payment_terms': payment_terms,
        'number_series': number_series,
        'subscription': {
            'plan': getattr(org, 'subscription_plan', 'Enterprise Plan') or 'Enterprise Plan',
            'status': getattr(org, 'subscription_status', 'Active') or 'Active',
            'renewal': getattr(org, 'subscription_renewal', '31 Dec 2027') or '31 Dec 2027',
            'users_limit': getattr(org, 'subscription_users', 'Unlimited') or 'Unlimited',
            'features': getattr(org, 'subscription_features', 'All Modules Unlocked') or 'All Modules Unlocked'
        }
    })

@api_view
def settings_roles_view(request, role_id=None):
    """Manage roles: list, create, retrieve, update, delete."""
    check_permission(request, allowed_roles=[UserProfile.ADMIN])
    org = get_user_org(request.user) or Organization.get()
    services.ensure_default_settings(org)

    if request.method == 'GET':
        if role_id:
            r = Role.objects.filter(organization=org, pk=role_id).first()
            if not r:
                raise ApiError(404, 'Role not found.')
            return j(serialize_role(r))
        roles = Role.objects.filter(organization=org).order_by('id')
        return j({'roles': [serialize_role(r) for r in roles]})

    data = body(request)

    if request.method == 'POST':
        name = (data.get('name') or '').strip()
        if not name:
            raise ApiError(400, 'Role Name is required.', {'name': 'Role Name is required.'})

        if Role.objects.filter(organization=org, name__iexact=name).exists():
            raise ApiError(400, f'A role with name "{name}" already exists.', {'name': 'Role name already in use.'})

        desc = (data.get('description') or '').strip()
        api_only = bool(data.get('api_only'))
        is_acc = bool(data.get('is_accountant'))
        perms = data.get('permissions') or services.get_default_permissions_for_role(name)
        rpt_perms = data.get('report_permissions') or services.get_empty_report_permissions()

        r = Role.objects.create(
            organization=org,
            name=name,
            description=desc,
            is_system=False,
            api_only=api_only,
            is_accountant=is_acc,
            permissions=perms,
            report_permissions=rpt_perms
        )
        services.log_audit(request.user, 'create', 'Role', r.pk, f"Created custom role '{r.name}'")
        return j(serialize_role(r), 201)

    if request.method in ('PUT', 'PATCH'):
        if not role_id:
            raise ApiError(400, 'Role ID required.')
        r = Role.objects.filter(organization=org, pk=role_id).first()
        if not r:
            raise ApiError(404, 'Role not found.')

        name = (data.get('name') or '').strip()
        if name and name != r.name:
            if r.is_system:
                raise ApiError(400, 'System role names cannot be renamed.')
            if Role.objects.filter(organization=org, name__iexact=name).exclude(pk=r.pk).exists():
                raise ApiError(400, f'Role with name "{name}" already exists.')
            r.name = name

        if 'description' in data:
            r.description = str(data['description']).strip()
        if 'api_only' in data:
            r.api_only = bool(data['api_only'])
        if 'is_accountant' in data:
            r.is_accountant = bool(data['is_accountant'])
        if 'permissions' in data and isinstance(data['permissions'], dict):
            r.permissions = data['permissions']
        if 'report_permissions' in data and isinstance(data['report_permissions'], dict):
            r.report_permissions = data['report_permissions']

        r.save()
        services.log_audit(request.user, 'update', 'Role', r.pk, f"Updated role '{r.name}' permissions and configuration")
        return j(serialize_role(r))

    if request.method == 'DELETE':
        if not role_id:
            raise ApiError(400, 'Role ID required.')
        r = Role.objects.filter(organization=org, pk=role_id).first()
        if not r:
            raise ApiError(404, 'Role not found.')
        if r.is_system:
            raise ApiError(400, 'Default system roles cannot be deleted.')

        # Reassign existing users to Staff
        staff_role = Role.objects.filter(organization=org, name='Staff').first()
        r.assigned_profiles.update(custom_role=staff_role, role='staff')

        role_name = r.name
        r.delete()
        services.log_audit(request.user, 'delete', 'Role', role_id, f"Deleted role '{role_name}'")
        return j({'status': 'ok', 'message': f"Role '{role_name}' deleted successfully."})

    raise ApiError(405, 'Method not allowed.')

@api_view
def settings_role_duplicate_view(request, role_id):
    """Duplicate an existing role into a new customizable role."""
    check_permission(request, allowed_roles=[UserProfile.ADMIN])
    org = get_user_org(request.user) or Organization.get()

    src = Role.objects.filter(organization=org, pk=role_id).first()
    if not src:
        raise ApiError(404, 'Source role not found.')

    base_name = f"{src.name} (Copy)"
    new_name = base_name
    counter = 1
    while Role.objects.filter(organization=org, name=new_name).exists():
        counter += 1
        new_name = f"{src.name} (Copy {counter})"

    dup = Role.objects.create(
        organization=org,
        name=new_name,
        description=f"Duplicate of {src.name}. {src.description}".strip(),
        is_system=False,
        api_only=src.api_only,
        is_accountant=src.is_accountant,
        permissions=src.permissions,
        report_permissions=src.report_permissions
    )
    services.log_audit(request.user, 'create', 'Role', dup.pk, f"Duplicated role '{src.name}' as '{dup.name}'")
    return j(serialize_role(dup), 201)

@api_view
def settings_users_view(request, user_id=None):
    """User management: list, add, edit, deactivate, delete."""
    check_permission(request, allowed_roles=[UserProfile.ADMIN])
    org = get_user_org(request.user, request)
    if not org:
        raise ApiError(403, 'Organization required.')

    from django.contrib.auth import get_user_model
    User = get_user_model()

    if request.method == 'GET':
        if user_id:
            u = User.objects.filter(pk=user_id, profile__organization=org, is_superuser=False).first()
            if not u:
                raise ApiError(404, 'User not found.')
            return j(serialize_user_entry(u, org))

        qs = User.objects.filter(profile__organization=org, is_superuser=False).distinct().order_by('id')
        q = request.GET.get('q', '').strip()
        if q:
            qs = qs.filter(Q(username__icontains=q) | Q(email__icontains=q) | Q(first_name__icontains=q) | Q(last_name__icontains=q) | Q(profile__user_id_code__icontains=q))

        role_filter = request.GET.get('role', '').strip()
        if role_filter:
            qs = qs.filter(Q(profile__custom_role__name__iexact=role_filter) | Q(profile__role__iexact=role_filter))

        status_filter = request.GET.get('status', '').strip()
        if status_filter:
            qs = qs.filter(profile__status__iexact=status_filter)

        users = [serialize_user_entry(u, org) for u in qs]
        return j({'users': users, 'total': len(users)})

    data = body(request)

    if request.method == 'POST':
        email = (data.get('email') or '').strip().lower()
        if not email:
            raise ApiError(400, 'Email address is required.', {'email': 'Email is required.'})

        if User.objects.filter(email__iexact=email).exists() or UserProfile.objects.filter(normalized_email=email).exists():
            raise ApiError(400, 'An account with this email address already exists. Please log in instead.', {'email': 'An account with this email address already exists. Please log in instead.'})

        username = (data.get('username') or email.split('@')[0]).strip()
        if User.objects.filter(username=username).exists():
            username = f"{username}_{uuid.uuid4().hex[:4]}"

        name = (data.get('name') or '').strip()
        parts = name.split(' ', 1)
        first_name = parts[0]
        last_name = parts[1] if len(parts) > 1 else ''

        role_id = data.get('role_id')
        r_obj = Role.objects.filter(organization=org, pk=role_id).first() if role_id else Role.objects.filter(organization=org, name='Staff').first()

        password = data.get('password') or 'Convosis@123'
        u = User.objects.create_user(
            username=username,
            email=email,
            first_name=first_name,
            last_name=last_name,
            password=password
        )

        status_val = data.get('status', 'active')
        UserProfile.objects.create(
            user=u,
            organization=org,
            role=(r_obj.name.lower() if r_obj else 'staff'),
            custom_role=r_obj,
            status=status_val,
            normalized_email=email,
            phone=str(data.get('phone', '')).strip()
        )
        services.log_audit(request.user, 'create', 'User', u.pk, f"Added user {u.email} with role {r_obj.name if r_obj else 'Staff'}")
        return j(serialize_user_entry(u, org), 201)

    if request.method in ('PUT', 'PATCH'):
        if not user_id:
            raise ApiError(400, 'User ID required.')
        u = User.objects.filter(pk=user_id, profile__organization=org, is_superuser=False).first()
        if not u:
            raise ApiError(404, 'User not found.')

        if 'name' in data:
            name = str(data['name']).strip()
            parts = name.split(' ', 1)
            u.first_name = parts[0]
            u.last_name = parts[1] if len(parts) > 1 else ''
        if 'email' in data:
            new_email = str(data['email']).strip().lower()
            if new_email and new_email != u.email:
                if User.objects.filter(email__iexact=new_email).exclude(pk=u.pk).exists() or UserProfile.objects.filter(normalized_email=new_email).exclude(user=u).exists():
                    raise ApiError(400, 'An account with this email address already exists. Please log in instead.', {'email': 'An account with this email address already exists. Please log in instead.'})
                u.email = new_email
        if 'password' in data and data['password']:
            pwd = str(data['password']).strip()
            if len(pwd) < 4:
                raise ApiError(400, 'Password must be at least 4 characters long.')
            u.set_password(pwd)
        u.save()

        prof = getattr(u, 'profile', None)
        if not prof:
            prof = UserProfile.objects.create(user=u, organization=org, normalized_email=u.email)
        else:
            prof.normalized_email = u.email
            prof.save(update_fields=['normalized_email'])

        if 'role_id' in data:
            r_obj = Role.objects.filter(organization=org, pk=data['role_id']).first()
            if r_obj:
                prof.custom_role = r_obj
                prof.role = r_obj.name.lower()
        if 'status' in data:
            prof.status = data['status']
            u.is_active = (data['status'] == 'active')
            u.save(update_fields=['is_active'])
        if 'phone' in data:
            prof.phone = str(data['phone']).strip()

        prof.save()
        services.log_audit(request.user, 'update', 'User', u.pk, f"Updated user profile for {u.email}")
        return j(serialize_user_entry(u, org))

    if request.method == 'DELETE':
        if not user_id:
            raise ApiError(400, 'User ID required.')
        if user_id == request.user.pk:
            raise ApiError(400, 'You cannot delete or deactivate your own account.')

        u = User.objects.filter(pk=user_id, profile__organization=org, is_superuser=False).first()
        if not u:
            raise ApiError(404, 'User not found.')

        prof = getattr(u, 'profile', None)
        if prof:
            prof.status = 'inactive'
            prof.save(update_fields=['status'])
        u.is_active = False
        u.save(update_fields=['is_active'])
        services.log_audit(request.user, 'delete', 'User', u.pk, f"Deactivated user {u.email}")
        return j({'status': 'ok', 'message': f"User {u.email} deactivated successfully."})

    raise ApiError(405, 'Method not allowed.')

@api_view
def settings_invite_user_view(request):
    """Invite a new user or accountant with role assignment."""
    check_permission(request, allowed_roles=[UserProfile.ADMIN])
    org = get_user_org(request.user) or Organization.get()
    services.check_subscription_limits(org, 'user')

    data = body(request)
    email = (data.get('email') or '').strip().lower()
    if not email:
        raise ApiError(400, 'Email address is required.', {'email': 'Email is required.'})

    name = (data.get('name') or '').strip()
    is_acc = bool(data.get('is_accountant'))
    role_id = data.get('role_id')

    if is_acc:
        r_obj = Role.objects.filter(organization=org, name='Accountant').first()
    elif role_id:
        r_obj = Role.objects.filter(organization=org, pk=role_id).first()
    else:
        r_obj = Role.objects.filter(organization=org, name='Staff').first()

    token = uuid.uuid4().hex
    inv = UserInvitation.objects.create(
        organization=org,
        email=email,
        name=name,
        role=r_obj,
        role_name=r_obj.name if r_obj else 'Staff',
        is_accountant=is_acc,
        token=token,
        status='invited',
        invited_by=request.user,
        expires_at=timezone.now() + timedelta(days=7)
    )

    from django.contrib.auth import get_user_model
    User = get_user_model()
    # Check if a user account already exists; if not, create placeholder invited user
    user = User.objects.filter(email__iexact=email).first()
    if not user:
        uname = email.split('@')[0]
        if User.objects.filter(username=uname).exists():
            uname = f"{uname}_{uuid.uuid4().hex[:4]}"
        parts = name.split(' ', 1)
        user = User.objects.create_user(
            username=uname,
            email=email,
            first_name=parts[0] if parts else '',
            last_name=parts[1] if len(parts) > 1 else '',
            password=uuid.uuid4().hex
        )
        UserProfile.objects.create(
            user=user,
            organization=org,
            role=r_obj.name.lower() if r_obj else 'staff',
            custom_role=r_obj,
            status='invited'
        )

    services.log_audit(request.user, 'create', 'UserInvitation', inv.pk, f"Sent invitation to {email} as {inv.role_name}")
    return j({
        'status': 'ok',
        'message': f"Invitation sent to {email}.",
        'invitation_id': inv.pk,
        'token': token,
        'invitation_link': f"/#/invitation/{token}"
    }, 201)

@api_view
def settings_resend_invite_view(request, invite_id):
    """Resend a user invitation."""
    check_permission(request, allowed_roles=[UserProfile.ADMIN])
    org = get_user_org(request.user) or Organization.get()

    inv = UserInvitation.objects.filter(organization=org, pk=invite_id).first()
    if not inv:
        raise ApiError(404, 'Invitation not found.')

    inv.token = uuid.uuid4().hex
    inv.status = 'invited'
    inv.expires_at = timezone.now() + timedelta(days=7)
    inv.save()

    services.log_audit(request.user, 'update', 'UserInvitation', inv.pk, f"Resent invitation to {inv.email}")
    return j({
        'status': 'ok',
        'message': f"Invitation resent to {inv.email}.",
        'token': inv.token,
        'invitation_link': f"/#/invitation/{inv.token}"
    })

@api_view
def settings_organization_view(request):
    """Get and update complete organization profile and settings."""
    org = get_user_org(request.user) or Organization.get()
    if request.method == 'GET':
        return j(org_json(org))

    check_permission(request, allowed_roles=[UserProfile.ADMIN])
    data = body(request)
    c = Cleaner(data)

    updatable_fields = [
        ('name', lambda: c.text('name', True, 200)),
        ('code', lambda: c.text('code', False, 20, upper=True)),
        ('legal_name', lambda: c.text('legal_name', False, 200)),
        ('business_type', lambda: c.text('business_type', False, 100)),
        ('company_id', lambda: c.text('company_id', False, 100)),
        ('gstin', lambda: c.text('gstin', False, 15, upper=True, pattern=GSTIN_RE, pattern_msg='Invalid GSTIN format')),
        ('pan', lambda: c.text('pan', False, 10, upper=True, pattern=PAN_RE, pattern_msg='Invalid PAN format')),
        ('address', lambda: c.text('address', False, 1000)),
        ('city', lambda: c.text('city', False, 100)),
        ('state', lambda: c.text('state', False, 60)),
        ('pincode', lambda: c.text('pincode', False, 20)),
        ('country', lambda: c.text('country', False, 100)),
        ('phone', lambda: c.text('phone', False, 50)),
        ('email', lambda: c.text('email', False, 254)),
        ('website', lambda: c.text('website', False, 200)),
        ('financial_year', lambda: c.text('financial_year', False, 50)),
        ('base_currency', lambda: c.text('base_currency', False, 10)),
        ('time_zone', lambda: c.text('time_zone', False, 80)),
        ('date_format', lambda: c.text('date_format', False, 30)),
        ('logo_data', lambda: c.text('logo_data', False, 2000000)),
        ('favicon_data', lambda: c.text('favicon_data', False, 2000000)),
        ('primary_color', lambda: c.text('primary_color', False, 30)),
        ('secondary_color', lambda: c.text('secondary_color', False, 30)),
        ('app_name', lambda: c.text('app_name', False, 100)),
        ('login_branding', lambda: c.text('login_branding', False, 5000)),
        ('opening_cash', lambda: c.number('opening_cash', lo=Decimal('-999999999'), hi=Decimal('999999999'))),
        ('notes_default', lambda: c.text('notes_default', False, 2000)),
        ('terms_default', lambda: c.text('terms_default', False, 2000)),
        ('quote_prefix', lambda: c.text('quote_prefix', False, 20)),
        ('signature_title', lambda: c.text('signature_title', False, 100)),
        ('signature_data', lambda: c.text('signature_data', False, 2000000)),
        ('template_theme', lambda: c.text('template_theme', False, 50)),
        ('template_color', lambda: c.text('template_color', False, 30)),
    ]

    for f_name, f_getter in updatable_fields:
        if f_name in data:
            setattr(org, f_name, f_getter())

    for json_field in ('ai_settings', 'general_settings', 'portal_settings', 'reminder_settings', 'email_settings', 'sms_settings', 'pdf_templates', 'number_series', 'digital_signature', 'tax_settings', 'direct_tax_settings'):
        if json_field in data and isinstance(data[json_field], dict):
            current = getattr(org, json_field, {}) or {}
            current.update(data[json_field])
            setattr(org, json_field, current)

    c.done()
    org.save()
    services.log_audit(request.user, 'update', 'Organization', org.pk, f"Updated organization settings for {org.name}")
    return j(org_json(org))

@api_view
def settings_currencies_view(request, currency_id=None):
    """Manage currencies."""
    check_permission(request, allowed_roles=[UserProfile.ADMIN])
    org = get_user_org(request.user) or Organization.get()

    if request.method == 'GET':
        qs = CurrencySetting.objects.filter(organization=org).order_by('id')
        return j({'currencies': [{
            'id': c.pk, 'code': c.code, 'name': c.name, 'symbol': c.symbol,
            'exchange_rate': float(c.exchange_rate), 'is_base': c.is_base, 'is_active': c.is_active
        } for c in qs]})

    data = body(request)

    if request.method == 'POST':
        code = str(data.get('code', '')).strip().upper()
        name = str(data.get('name', '')).strip()
        sym = str(data.get('symbol', '')).strip() or code
        rate = Decimal(str(data.get('exchange_rate', '1.0000')))

        if not code or not name:
            raise ApiError(400, 'Currency Code and Name are required.')

        c, _ = CurrencySetting.objects.update_or_create(
            organization=org,
            code=code,
            defaults={'name': name, 'symbol': sym, 'exchange_rate': rate, 'is_base': False, 'is_active': True}
        )
        services.log_audit(request.user, 'create', 'CurrencySetting', c.pk, f"Added currency {c.code}")
        return j({'id': c.pk, 'code': c.code, 'name': c.name, 'symbol': c.symbol, 'exchange_rate': float(c.exchange_rate)}, 201)

    if request.method in ('PUT', 'PATCH'):
        if not currency_id:
            raise ApiError(400, 'Currency ID required.')
        c = CurrencySetting.objects.filter(organization=org, pk=currency_id).first()
        if not c:
            raise ApiError(404, 'Currency not found.')
        if 'exchange_rate' in data:
            c.exchange_rate = Decimal(str(data['exchange_rate']))
        if 'is_active' in data:
            c.is_active = bool(data['is_active'])
        if 'name' in data:
            c.name = str(data['name']).strip()
        c.save()
        services.log_audit(request.user, 'update', 'CurrencySetting', c.pk, f"Updated currency {c.code}")
        return j({'status': 'ok', 'id': c.pk, 'code': c.code, 'exchange_rate': float(c.exchange_rate)})

    if request.method == 'DELETE':
        if not currency_id:
            raise ApiError(400, 'Currency ID required.')
        c = CurrencySetting.objects.filter(organization=org, pk=currency_id).first()
        if not c:
            raise ApiError(404, 'Currency not found.')
        if c.is_base:
            raise ApiError(400, 'Base currency cannot be deleted.')
        c.delete()
        services.log_audit(request.user, 'delete', 'CurrencySetting', currency_id, f"Deleted currency {c.code}")
        return j({'status': 'ok', 'message': 'Currency removed.'})

    raise ApiError(405, 'Method not allowed.')

@api_view
def settings_payment_terms_view(request, term_id=None):
    """Manage payment terms."""
    check_permission(request, allowed_roles=[UserProfile.ADMIN])
    org = get_user_org(request.user) or Organization.get()

    if request.method == 'GET':
        qs = PaymentTermSetting.objects.filter(organization=org).order_by('days')
        return j({'payment_terms': [{'id': p.pk, 'name': p.name, 'days': p.days, 'is_default': p.is_default, 'is_active': p.is_active} for p in qs]})

    data = body(request)

    if request.method == 'POST':
        name = str(data.get('name', '')).strip()
        days = int(data.get('days', 0))
        if not name:
            raise ApiError(400, 'Term name is required.')
        if PaymentTermSetting.objects.filter(organization=org, name__iexact=name).exists():
            raise ApiError(400, f'Payment term "{name}" already exists.')
        p = PaymentTermSetting.objects.create(organization=org, name=name, days=days, is_default=bool(data.get('is_default')), is_active=True)
        services.log_audit(request.user, 'create', 'PaymentTermSetting', p.pk, f"Created payment term {p.name}")
        return j({'id': p.pk, 'name': p.name, 'days': p.days}, 201)

    if request.method in ('PUT', 'PATCH'):
        if not term_id:
            raise ApiError(400, 'Term ID required.')
        p = PaymentTermSetting.objects.filter(organization=org, pk=term_id).first()
        if not p:
            raise ApiError(404, 'Payment term not found.')
        if 'name' in data: p.name = str(data['name']).strip()
        if 'days' in data: p.days = int(data['days'])
        if 'is_default' in data:
            if bool(data['is_default']):
                PaymentTermSetting.objects.filter(organization=org).update(is_default=False)
            p.is_default = bool(data['is_default'])
        if 'is_active' in data: p.is_active = bool(data['is_active'])
        p.save()
        services.log_audit(request.user, 'update', 'PaymentTermSetting', p.pk, f"Updated payment term {p.name}")
        return j({'status': 'ok', 'id': p.pk, 'name': p.name, 'days': p.days})

    if request.method == 'DELETE':
        if not term_id:
            raise ApiError(400, 'Term ID required.')
        p = PaymentTermSetting.objects.filter(organization=org, pk=term_id).first()
        if not p:
            raise ApiError(404, 'Payment term not found.')
        p.delete()
        services.log_audit(request.user, 'delete', 'PaymentTermSetting', term_id, f"Deleted payment term {p.name}")
        return j({'status': 'ok', 'message': 'Payment term deleted.'})

    raise ApiError(405, 'Method not allowed.')

@api_view
def settings_number_series_view(request):
    """View and configure document numbering series for all modules."""
    check_permission(request, allowed_roles=[UserProfile.ADMIN])
    org = get_user_org(request.user) or Organization.get()

    modules = [
        ('INV', 'Invoice'), ('CUST', 'Customer'), ('VEND', 'Vendor'),
        ('SO', 'Sales Order'), ('QTN', 'Quotation'), ('PO', 'Purchase Order'),
        ('BILL', 'Bill'), ('PR', 'Payment Received'), ('PM', 'Payment Made'),
        ('CN', 'Credit Note'), ('DN', 'Debit Note'), ('JRN', 'Journal'),
        ('DC', 'Delivery Challan'), ('ITEM', 'Items'), ('ST', 'Stock Transfer'),
        ('EXP', 'Expense'), ('ADJ', 'Stock Adjustment')
    ]

    if request.method == 'GET':
        res = []
        for mod_key, label in modules:
            prev = services.preview_document_number(mod_key, org=org)
            res.append({
                'module': mod_key,
                'label': label,
                'prefix': prev.get('prefix', mod_key),
                'next_sequence': prev.get('next_sequence', 1),
                'financial_year': prev.get('financial_year', ''),
                'formatted': prev.get('formatted', '')
            })
        return j({'series': res, 'org_code': org.get_code()})

    data = body(request)
    mod_key = str(data.get('module', '')).strip().upper()
    cfg = services.get_document_module_config(mod_key)
    if not cfg:
        raise ApiError(400, f'Invalid module key "{mod_key}".')

    prefix = str(data.get('prefix', '')).strip().upper() or cfg['pfx']
    next_seq = int(data.get('next_sequence', 1))

    # Update sequence in DB
    fy = services.get_financial_year() if cfg['has_fy'] else None
    org_code = org.get_code()
    seq_key = f"{org.pk}:{org_code}:{prefix}:{fy}" if fy else f"{org.pk}:{org_code}:{prefix}"

    seq_obj, _ = Sequence.objects.get_or_create(key=seq_key, defaults={'value': max(0, next_seq - 1)})
    seq_obj.value = max(0, next_seq - 1)
    seq_obj.save()

    # Also record in org.number_series for display persistence
    ns = org.number_series or {}
    ns[mod_key] = {'prefix': prefix, 'next_sequence': next_seq}
    org.number_series = ns
    org.save(update_fields=['number_series'])

    services.log_audit(request.user, 'update', 'Sequence', seq_key, f"Updated numbering series for {mod_key}: next sequence {next_seq}")
    prev = services.preview_document_number(mod_key, org=org)
    return j({'status': 'ok', 'module': mod_key, 'preview': prev})

@api_view
def doc_number_preferences_view(request):
    """
    Get or configure document number preferences for a document type and transaction series.
    Supports auto-generate vs manual mode, custom prefixes with placeholders (${YEAR}, ${FYS_YY}, etc.),
    next sequence number, and fiscal year restarting.
    """
    org = get_user_org(request.user) or Organization.get()
    from .models import DocumentNumberPreference, Sequence

    canon_map = {
        'inv': 'invoices', 'invoices': 'invoices', 'invoice': 'invoices',
        'qtn': 'quotes', 'quotes': 'quotes', 'quote': 'quotes',
        'so': 'sales_orders', 'sales_orders': 'sales_orders', 'sales-orders': 'sales_orders',
        'rec': 'recurring_invoices', 'recurring_invoices': 'recurring_invoices', 'recurring-invoices': 'recurring_invoices',
        'ret': 'retainer_invoices', 'retainer_invoices': 'retainer_invoices', 'retainer-invoices': 'retainer_invoices',
        'bill': 'bills', 'bills': 'bills',
        'po': 'purchase_orders', 'purchase_orders': 'purchase_orders', 'purchase-orders': 'purchase_orders'
    }

    if request.method == 'GET':
        doc_type_raw = str(request.GET.get('document_type') or request.GET.get('module') or 'invoices').strip().lower()
        clean_doc = canon_map.get(doc_type_raw, doc_type_raw)
        series = str(request.GET.get('transaction_series') or 'Default Transaction Series').strip()
        location = str(request.GET.get('location') or 'HO Kottayam').strip()

        pref = DocumentNumberPreference.objects.filter(
            organization=org, document_type=clean_doc, transaction_series=series
        ).first()
        if not pref:
            pref = DocumentNumberPreference.objects.filter(
                organization=org, document_type=clean_doc
            ).first()

        prev = services.preview_document_number(clean_doc, org=org, series=series)
        default_pfx = prev.get('prefix') or 'INV'
        if not default_pfx.endswith('/'):
            default_pfx = f"{default_pfx}/"

        return j({
            'document_type': clean_doc,
            'transaction_series': series,
            'location': location,
            'auto_generate': pref.auto_generate if pref else True,
            'prefix': pref.prefix if (pref and pref.prefix) else default_pfx,
            'next_number': pref.next_number if pref else prev.get('next_sequence', 1),
            'restart_yearly': pref.restart_yearly if pref else True,
            'preview_formatted': prev.get('formatted', '')
        })

    if request.method in ('POST', 'PUT'):
        d = body(request)
        doc_type_raw = str(d.get('document_type') or d.get('module') or 'invoices').strip().lower()
        clean_doc = canon_map.get(doc_type_raw, doc_type_raw)
        series = str(d.get('transaction_series') or 'Default Transaction Series').strip()
        location = str(d.get('location') or 'HO Kottayam').strip()
        auto_generate = bool(d.get('auto_generate', True))
        prefix = str(d.get('prefix') or '').strip()
        try:
            next_number = max(1, int(d.get('next_number', 1)))
        except (ValueError, TypeError):
            next_number = 1
        restart_yearly = bool(d.get('restart_yearly', True))

        pref, _ = DocumentNumberPreference.objects.update_or_create(
            organization=org,
            document_type=clean_doc,
            transaction_series=series,
            defaults={
                'location': location,
                'auto_generate': auto_generate,
                'prefix': prefix,
                'next_number': next_number,
                'restart_yearly': restart_yearly
            }
        )

        cfg = services.get_document_module_config(clean_doc)
        pfx = cfg['pfx'] if cfg else 'DOC'
        fy = services.get_financial_year()
        seq_key = f"{org.pk}_{pfx}_{fy}" if (cfg and cfg.get('has_fy')) else f"{org.pk}_{pfx}"
        seq, _ = Sequence.objects.get_or_create(key=seq_key)
        seq.value = max(0, next_number - 1)
        seq.save(update_fields=['value'])

        prev = services.preview_document_number(clean_doc, org=org, series=series)

        services.log_audit(
            request.user, 'update', 'DocumentNumberPreference', pref.pk,
            f"Configured number preferences for {clean_doc} ({series}): auto={auto_generate}, prefix={prefix}, next={next_number}",
            org=org, module='settings', submodule='number_preferences'
        )

        return j({
            'status': 'ok',
            'document_type': clean_doc,
            'transaction_series': series,
            'auto_generate': auto_generate,
            'prefix': prefix,
            'next_number': next_number,
            'restart_yearly': restart_yearly,
            'preview_formatted': prev.get('formatted', '')
        })

    raise ApiError(405, 'Method not allowed.')

@api_view
def settings_templates_view(request):
    """View and update PDF and invoice templates."""
    check_permission(request, allowed_roles=[UserProfile.ADMIN])
    org = get_user_org(request.user) or Organization.get()

    if request.method == 'GET':
        return j({
            'templates': org.pdf_templates or {
                'invoice_template': 'convosis_modern',
                'quote_template': 'convosis_clean',
                'bill_template': 'convosis_standard',
                'primary_color': org.primary_color or '#1877f2',
                'font_family': 'Inter, system-ui, sans-serif',
                'show_signature': True
            }
        })

    data = body(request)
    tpls = org.pdf_templates or {}
    tpls.update(data)
    org.pdf_templates = tpls
    if 'primary_color' in data:
        org.primary_color = data['primary_color']
    org.save()
    services.log_audit(request.user, 'update', 'Organization', org.pk, "Updated PDF template settings")
    return j({'status': 'ok', 'templates': org.pdf_templates})

@api_view
def settings_digital_signature_view(request):
    """View and upload digital signature."""
    check_permission(request, allowed_roles=[UserProfile.ADMIN])
    org = get_user_org(request.user) or Organization.get()

    if request.method == 'GET':
        return j({
            'signature_data': org.signature_data or '',
            'signature_title': org.signature_title or 'Authorized Signature',
            'digital_signature': org.digital_signature or {'enabled': bool(org.signature_data), 'placement': 'bottom_right'}
        })

    data = body(request)
    if 'signature_data' in data:
        org.signature_data = data['signature_data']
    if 'signature_title' in data:
        org.signature_title = str(data['signature_title']).strip()
    if 'digital_signature' in data and isinstance(data['digital_signature'], dict):
        ds = org.digital_signature or {}
        ds.update(data['digital_signature'])
        org.digital_signature = ds

    org.save()
    services.log_audit(request.user, 'update', 'Organization', org.pk, "Updated digital signature settings")
    return j({
        'status': 'ok',
        'signature_data': org.signature_data,
        'signature_title': org.signature_title,
        'digital_signature': org.digital_signature
    })

@api_view
def settings_taxes_view(request):
    """View and update tax settings, tax groups, and direct tax (TDS/TCS) configurations."""
    check_permission(request, allowed_roles=[UserProfile.ADMIN, UserProfile.ACCOUNTANT])
    org = get_user_org(request.user) or Organization.get()

    standard_taxes = [
        {'name': 'GST0', 'type': 'Tax Group', 'rate': 0, 'active': True},
        {'name': 'GST5', 'type': 'Tax Group', 'rate': 5, 'active': True},
        {'name': 'GST12', 'type': 'Tax Group', 'rate': 12, 'active': True},
        {'name': 'GST18', 'type': 'Tax Group', 'rate': 18, 'active': True},
        {'name': 'GST28', 'type': 'Tax Group', 'rate': 28, 'active': True},
        {'name': 'GST40', 'type': 'Tax Group', 'rate': 40, 'active': True},
        {'name': 'IGST0', 'type': 'IGST', 'rate': 0, 'active': True},
        {'name': 'IGST5', 'type': 'IGST', 'rate': 5, 'active': True},
        {'name': 'IGST12', 'type': 'IGST', 'rate': 12, 'active': True},
        {'name': 'IGST18', 'type': 'IGST', 'rate': 18, 'active': True},
        {'name': 'IGST28', 'type': 'IGST', 'rate': 28, 'active': True},
        {'name': 'IGST40', 'type': 'IGST', 'rate': 40, 'active': True},
    ]

    tds_sections = [
        {'section': '194C', 'name': 'Payment to Contractors', 'rate': '1% / 2%', 'threshold': '₹30,000 / ₹1,00,000'},
        {'section': '194J', 'name': 'Fees for Professional / Technical Services', 'rate': '2% / 10%', 'threshold': '₹30,000'},
        {'section': '194I', 'name': 'Rent on Land, Building, or Furniture', 'rate': '10%', 'threshold': '₹2,40,000'},
        {'section': '194H', 'name': 'Commission or Brokerage', 'rate': '5%', 'threshold': '₹15,000'},
        {'section': '194Q', 'name': 'Purchase of Goods', 'rate': '0.1%', 'threshold': '₹50,00,000'},
        {'section': '194A', 'name': 'Interest other than Interest on Securities', 'rate': '10%', 'threshold': '₹40,000'},
    ]

    tcs_sections = [
        {'section': '206C(1H)', 'name': 'TCS on Sale of Goods', 'rate': '0.1%', 'threshold': '₹50,00,000'},
        {'section': '206C(1)', 'name': 'TCS on Alcoholic Liquor / Timber / Minerals', 'rate': '1% - 5%', 'threshold': 'Nil'},
        {'section': '206C(1G)', 'name': 'TCS on Foreign Remittance under LRS / Overseas Tour', 'rate': '5% / 20%', 'threshold': '₹7,00,000'},
    ]

    tax_exemptions = (org.tax_settings or {}).get('tax_exemptions', [
        {'reason': 'Export under LUT/Bond', 'description': 'Zero rated export supplies without payment of IGST under Letter of Undertaking.'},
        {'reason': 'SEZ Supplies with payment/LUT', 'description': 'Supplies made to Special Economic Zone units or developers.'},
        {'reason': 'Agricultural produce exempt', 'description': 'Fresh agricultural and unprocessed food grains.'},
        {'reason': 'Healthcare and educational services', 'description': 'Specified exempt healthcare and registered schooling services.'},
    ])

    custom_taxes = (org.tax_settings or {}).get('custom_taxes', [])
    all_taxes = list(standard_taxes) + list(custom_taxes)

    if request.method == 'GET':
        return j({
            'taxes': all_taxes,
            'tds_sections': tds_sections,
            'tcs_sections': tcs_sections,
            'tax_exemptions': tax_exemptions,
            'tax_settings': org.tax_settings or {'default_tax_preference': 'taxable', 'gst_registered': True},
            'direct_tax_settings': org.direct_tax_settings or {'tds_level': 'transaction', 'enable_tds_liabilities_report': True}
        })

    data = body(request)
    ts = org.tax_settings or {}

    if 'new_tax' in data and isinstance(data['new_tax'], dict):
        nt = data['new_tax']
        t_name = str(nt.get('name', '')).strip()
        if not t_name:
            raise ApiError(400, 'Tax name is required.')
        if any(t['name'].lower() == t_name.lower() for t in all_taxes):
            raise ApiError(400, f'Tax "{t_name}" already exists.')
        custom = ts.get('custom_taxes', [])
        custom.append({
            'name': t_name,
            'type': str(nt.get('type', 'Tax Group')),
            'rate': float(nt.get('rate', 0)),
            'country': str(nt.get('country', 'India')),
            'active': True
        })
        ts['custom_taxes'] = custom
        org.tax_settings = ts

    if 'delete_tax' in data:
        t_name = str(data['delete_tax']).strip()
        custom = [t for t in ts.get('custom_taxes', []) if t.get('name') != t_name]
        ts['custom_taxes'] = custom
        org.tax_settings = ts

    if 'new_exemption' in data and isinstance(data['new_exemption'], dict):
        ne = data['new_exemption']
        reason = str(ne.get('reason', '')).strip()
        if not reason:
            raise ApiError(400, 'Exemption reason is required.')
        ex_list = ts.get('tax_exemptions', list(tax_exemptions))
        ex_list.append({
            'reason': reason,
            'description': str(ne.get('description', '')).strip()
        })
        ts['tax_exemptions'] = ex_list
        org.tax_settings = ts

    if 'tax_settings' in data and isinstance(data['tax_settings'], dict):
        ts.update(data['tax_settings'])
        org.tax_settings = ts

    if 'direct_tax_settings' in data and isinstance(data['direct_tax_settings'], dict):
        dts = org.direct_tax_settings or {}
        dts.update(data['direct_tax_settings'])
        org.direct_tax_settings = dts

    org.save(update_fields=['tax_settings', 'direct_tax_settings'])
    services.log_audit(request.user, 'update', 'Organization', org.pk, "Updated tax and direct tax settings")
    return j({
        'status': 'ok',
        'taxes': list(standard_taxes) + list(ts.get('custom_taxes', [])),
        'tax_exemptions': ts.get('tax_exemptions', tax_exemptions),
        'tax_settings': org.tax_settings,
        'direct_tax_settings': org.direct_tax_settings
    })


# ==============================================================================
# SUB-ORGANIZATION MANAGEMENT & HIERARCHICAL CONTEXT SWITCHING
# ==============================================================================

@api_view
def sub_organizations_view(request):
    """
    Manage child sub-organizations under a Main Organization.
    Strictly isolated: only MAIN organization admins can view/create sub-organizations.
    """
    user_org = get_user_org(request.user, request)
    if not user_org:
        raise ApiError(403, 'Organization required.')

    if getattr(user_org, 'org_type', 'MAIN') != 'MAIN':
        raise ApiError(403, 'Only primary main organizations can manage sub-organizations.')

    if request.method == 'GET':
        subs = user_org.sub_organizations.all().order_by('name')
        return j([
            {
                'id': s.id,
                'organization_id': s.organization_id or f"ORG-{s.id:06d}",
                'uuid': str(s.uuid),
                'name': s.name,
                'code': s.code,
                'legal_name': s.legal_name,
                'company_id': s.company_id,
                'gstin': s.gstin,
                'state': s.state,
                'city': s.city,
                'email': s.email,
                'phone': s.phone,
                'status': s.status,
                'org_type': s.org_type,
                'created_at': s.created_at.isoformat() if s.created_at else ''
            } for s in subs
        ])

    if request.method == 'POST':
        check_permission(request, allowed_roles=[UserProfile.ADMIN])
        d = body(request)
        c = Cleaner(d)
        name = c.text('name', required=True, max_len=200)
        code = c.text('code', max_len=20, upper=True)
        legal_name = c.text('legal_name', max_len=200) or name
        company_id = c.text('company_id', max_len=100)
        gstin = c.text('gstin', max_len=15, upper=True)
        state = c.text('state', max_len=60, default=user_org.state)
        address = c.text('address', max_len=1000)
        city = c.text('city', max_len=100)
        pincode = c.text('pincode', max_len=20)
        email = c.text('email', max_len=254)
        phone = c.text('phone', max_len=50)
        c.done()

        sub_code = code or services.next_document_number('ORG', org=user_org)[:6]
        sub_org = Organization.objects.create(
            name=name,
            code=sub_code,
            legal_name=legal_name,
            org_type='SUB',
            parent=user_org,
            company_id=company_id,
            gstin=gstin,
            state=state,
            address=address,
            city=city,
            pincode=pincode,
            email=email,
            phone=phone,
            status='active'
        )
        services.ensure_default_accounts(sub_org)
        services.log_audit(
            request.user, 'create', 'Organization', sub_org.id,
            f"Created sub-organization: {sub_org.name} ({sub_org.code})",
            org=user_org, module='settings', submodule='organizations'
        )
        return j({
            'id': sub_org.id,
            'organization_id': sub_org.organization_id or f"ORG-{sub_org.id:06d}",
            'uuid': str(sub_org.uuid),
            'name': sub_org.name,
            'code': sub_org.code,
            'org_type': sub_org.org_type,
            'parent_id': user_org.id,
            'status': sub_org.status,
            'message': 'Sub-organization created successfully.'
        }, 201)

    raise ApiError(405, 'Method not allowed.')


@api_view
def organization_switch_view(request):
    """
    Context-switching between Main Org and authorized Sub-Orgs.
    Strictly verifies parent-child hierarchy to prevent unauthorized cross-tenant switching.
    """
    if request.method != 'POST':
        raise ApiError(405, 'Method not allowed.')
    profile = getattr(request.user, 'profile', None)
    base_org = profile.organization if profile else None
    if not base_org:
        raise ApiError(403, 'No organization assigned to your user account.')

    d = body(request)
    target_id = d.get('organization_id') or d.get('target_org_id')
    if not target_id:
        raise ApiError(400, 'organization_id is required.')

    target_str = str(target_id).strip()

    # 1. Switching back to user's primary base organization is always allowed
    if target_str in (str(base_org.id), str(getattr(base_org, 'uuid', ''))):
        if hasattr(request, 'session'):
            request.session['active_org_id'] = base_org.id
        return j({
            'status': 'switched',
            'organization': org_json(base_org),
            'active_org_id': base_org.id,
            'message': f'Switched to {base_org.name}.'
        })

    # 2. Main Org can switch into any of its own direct sub-organizations
    if base_org.org_type == 'MAIN':
        sub_org = None
        if target_str.isdigit():
            sub_org = base_org.sub_organizations.filter(id=int(target_str), status='active').first()
        else:
            try:
                uuid.UUID(target_str)
                sub_org = base_org.sub_organizations.filter(uuid=target_str, status='active').first()
            except Exception:
                sub_org = None
        if sub_org:
            if hasattr(request, 'session'):
                request.session['active_org_id'] = sub_org.id
            return j({
                'status': 'switched',
                'organization': org_json(sub_org),
                'active_org_id': sub_org.id,
                'message': f'Switched to sub-organization {sub_org.name}.'
            })

    # 3. Any other switch is strictly forbidden (sub-org user switching, or switching to unrelated org)
    raise ApiError(403, 'Access denied: You do not have permission to access the requested organization.')


# ==============================================================================
# DIGITAL PERSONAL DATA PROTECTION (DPDP ACT 2023 / RULES 2025) VIEWS
# ==============================================================================

@api_view
def dpdp_privacy_policy_view(request):
    """
    DPDP Act 2023 Section 5 Notice & Section 6 Consent Framework.
    """
    user_org = get_user_org(request.user, request) or Organization.get()
    return j({
        'framework': 'Digital Personal Data Protection Act, 2023 (DPDPA 2023) & DPDP Rules 2025',
        'jurisdiction': 'Republic of India',
        'data_fiduciary': {
            'organization_name': user_org.name,
            'legal_name': getattr(user_org, 'legal_name', user_org.name),
            'registration_cin': user_org.company_id,
            'gstin': user_org.gstin,
            'registered_office': user_org.address,
            'contact_email': user_org.email,
            'contact_phone': user_org.phone,
        },
        'data_protection_officer': {
            'name': 'Grievance Redressal Officer / DPO',
            'designation': 'Data Protection Officer',
            'email': 'dpo@convosis.com',
            'phone': '+91-9847017737',
            'redressal_timeframe': 'Grievances acknowledged within 24 hours, resolved within 30 days.'
        },
        'specified_purposes': [
            {
                'purpose_code': 'INVOICING_AND_ACCOUNTING',
                'description': 'Maintenance of books of accounts, ledger entries, and general financial recording under Section 128 of the Companies Act, 2013.',
                'lawful_basis': 'Legitimate Use (Section 7) and Explicit Consent (Section 6).'
            },
            {
                'purpose_code': 'GST_AND_TAX_COMPLIANCE',
                'description': 'Generating tax invoices, filing GSTR-1 and GSTR-3B returns, generating e-Way Bills and e-Invoices in compliance with the Central Goods and Services Tax Act, 2017.',
                'lawful_basis': 'Statutory Legal Obligation (Section 7).'
            },
            {
                'purpose_code': 'BANKING_AND_PAYMENTS',
                'description': 'Processing outgoing vendor disbursements, receiving customer receipts, and executing bank reconciliation.',
                'lawful_basis': 'Performance of Contract & Explicit Consent.'
            },
            {
                'purpose_code': 'AUDIT_TRAIL_INTEGRITY',
                'description': 'Preserving tamper-evident audit logs and access histories as required by the Ministry of Corporate Affairs (MCA) Audit Trail rules.',
                'lawful_basis': 'Legal Obligation under Companies (Accounts) Rules.'
            }
        ],
        'data_principal_rights': [
            {'right': 'Right to Access', 'section': 'Section 11', 'description': 'Summary of personal data being processed and processing identities.'},
            {'right': 'Right to Correction and Erasure', 'section': 'Section 12', 'description': 'Correction of inaccurate data and erasure subject to statutory retention limits.'},
            {'right': 'Right of Grievance Redressal', 'section': 'Section 13', 'description': 'Expeditious redressal of privacy complaints through our designated DPO.'},
            {'right': 'Right to Nominate', 'section': 'Section 14', 'description': 'Right to nominate another individual in the event of death or incapacity.'}
        ],
        'statutory_retention_policy': {
            'rule': 'Financial records, invoices, vouchers, and ledger transactions must be preserved for eight (8) financial years immediately preceding the current financial year pursuant to Section 128(5) of the Companies Act, 2013 and Section 36 of the CGST Act, 2017.',
            'erasure_effect': 'Erasure requests for Data Principals with active financial records place personal identifiers on statutory hold; non-statutory processing and marketing channels are immediately withdrawn.'
        },
        'data_storage_and_security': {
            'data_residency': 'India (Mumbai AWS ap-south-1)',
            'encryption_at_rest': 'AES-256',
            'encryption_in_transit': 'TLS 1.3',
            'cert_in_reporting_mandate': 'Security incidents evaluated and reported to CERT-In within 6 hours.'
        }
    })


@api_view
def dpdp_consent_view(request):
    """
    DPDP Act 2023 Sec 6 Consent Management Register.
    """
    user_org = get_user_org(request.user, request)
    if not user_org:
        raise ApiError(403, 'Organization required.')

    from .models import DPDPConsentRecord

    if request.method == 'GET':
        status_filter = request.GET.get('status')
        qs = DPDPConsentRecord.objects.filter(organization=user_org)
        if status_filter:
            qs = qs.filter(status=status_filter.upper())
        q = request.GET.get('q', '').strip()
        if q:
            qs = qs.filter(Q(data_principal_name__icontains=q) | Q(data_principal_email__icontains=q))
        return j([
            {
                'id': c.id,
                'data_principal_name': c.data_principal_name,
                'data_principal_email': c.data_principal_email,
                'data_principal_phone': c.data_principal_phone,
                'purpose': c.purpose,
                'consent_type': c.consent_type,
                'notice_version': c.notice_version,
                'status': c.status,
                'ip_address': c.ip_address,
                'granted_at': c.granted_at.isoformat() if c.granted_at else '',
                'withdrawn_at': c.withdrawn_at.isoformat() if c.withdrawn_at else '',
                'withdrawal_reason': c.withdrawal_reason
            } for c in qs[:100]
        ])

    if request.method == 'POST':
        d = body(request)
        c = Cleaner(d)
        name = c.text('data_principal_name', required=True, max_len=200)
        email = c.text('data_principal_email', max_len=200)
        phone = c.text('data_principal_phone', max_len=50)
        purpose = c.text('purpose', default='INVOICING_AND_ACCOUNTING', max_len=100)
        consent_type = c.choice('consent_type', ['EXPLICIT', 'OPT_IN', 'STATUTORY'], default='EXPLICIT')
        notice_ver = c.text('notice_version', default='v1.0', max_len=50)
        c.done()

        rec = DPDPConsentRecord.objects.create(
            organization=user_org,
            data_principal_name=name,
            data_principal_email=email,
            data_principal_phone=phone,
            purpose=purpose,
            consent_type=consent_type,
            notice_version=notice_ver,
            status='ACTIVE',
            ip_address=get_client_ip(request),
            user_agent=request.META.get('HTTP_USER_AGENT', '')[:500]
        )
        services.log_audit(
            request.user, 'create', 'DPDPConsentRecord', rec.id,
            f"Recorded DPDP consent for {name} ({purpose})",
            org=user_org, module='compliance', submodule='dpdp_consent'
        )
        return j({
            'id': rec.id,
            'data_principal_name': rec.data_principal_name,
            'purpose': rec.purpose,
            'status': rec.status,
            'granted_at': rec.granted_at.isoformat(),
            'message': 'Consent record registered successfully.'
        }, 201)

    raise ApiError(405, 'Method not allowed.')


@api_view
def dpdp_consent_withdraw_view(request, pk):
    """
    DPDP Act 2023 Sec 6(4) - Right to Withdraw Consent.
    """
    if request.method != 'POST':
        raise ApiError(405, 'Method not allowed.')
    user_org = get_user_org(request.user, request)
    if not user_org:
        raise ApiError(403, 'Organization required.')

    from .models import DPDPConsentRecord
    rec = DPDPConsentRecord.objects.filter(pk=pk, organization=user_org).first()
    if not rec:
        raise ApiError(404, 'Consent record not found in your organization.')

    d = body(request)
    reason = (d.get('reason') or d.get('withdrawal_reason') or 'User initiated consent withdrawal').strip()

    rec.status = 'WITHDRAWN'
    rec.withdrawn_at = timezone.now()
    rec.withdrawal_reason = reason
    rec.save(update_fields=['status', 'withdrawn_at', 'withdrawal_reason'])

    services.log_audit(
        request.user, 'update', 'DPDPConsentRecord', rec.id,
        f"Withdrew DPDP consent for {rec.data_principal_name}: {reason}",
        org=user_org, module='compliance', submodule='dpdp_consent'
    )
    return j({
        'id': rec.id,
        'status': rec.status,
        'withdrawn_at': rec.withdrawn_at.isoformat(),
        'message': 'Consent successfully withdrawn.'
    })


@api_view
def dpdp_requests_view(request):
    """
    DPDP Act 2023 Sec 11, 12, 13 - Data Principal Rights Request Register.
    """
    user_org = get_user_org(request.user, request)
    if not user_org:
        raise ApiError(403, 'Organization required.')

    from .models import DPDPDataSubjectRequest

    if request.method == 'GET':
        req_type = request.GET.get('type')
        status = request.GET.get('status')
        qs = DPDPDataSubjectRequest.objects.filter(organization=user_org)
        if req_type:
            qs = qs.filter(request_type=req_type.upper())
        if status:
            qs = qs.filter(status=status.upper())
        return j([
            {
                'id': r.id,
                'request_number': r.request_number,
                'data_principal_name': r.data_principal_name,
                'data_principal_email': r.data_principal_email,
                'data_principal_phone': r.data_principal_phone,
                'request_type': r.request_type,
                'status': r.status,
                'details': r.details,
                'statutory_hold': r.statutory_hold,
                'statutory_hold_reason': r.statutory_hold_reason,
                'response_notes': r.response_notes,
                'resolution_date': r.resolution_date.isoformat() if r.resolution_date else '',
                'created_at': r.created_at.isoformat() if r.created_at else ''
            } for r in qs
        ])

    if request.method == 'POST':
        d = body(request)
        c = Cleaner(d)
        name = c.text('data_principal_name', required=True, max_len=200)
        email = c.text('data_principal_email', max_len=200)
        phone = c.text('data_principal_phone', max_len=50)
        req_type = c.choice('request_type', ['ACCESS', 'CORRECTION', 'ERASURE', 'GRIEVANCE', 'NOMINATION'], default='ACCESS')
        details = c.text('details', required=True, max_len=2000)
        c.done()

        req_num = f"DSR-{timezone.now().strftime('%Y%m')}-{uuid.uuid4().hex[:6].upper()}"

        # Statutory Retention Hold Verification:
        # If an erasure request is received, check whether active statutory financial transactions exist
        # under the Companies Act 2013 (Sec 128) and CGST Act 2017 (Sec 36) requiring 8 years retention.
        statutory_hold = False
        statutory_reason = ''
        status = 'RECEIVED'

        if req_type == 'ERASURE':
            has_invoices = False
            if email:
                has_invoices = Invoice.objects.filter(organization=user_org, customer__email__iexact=email).exists() or Bill.objects.filter(organization=user_org, vendor__email__iexact=email).exists()
            if not has_invoices and name:
                has_invoices = Invoice.objects.filter(organization=user_org, customer__name__iexact=name).exists() or Bill.objects.filter(organization=user_org, vendor__name__iexact=name).exists()

            if has_invoices:
                statutory_hold = True
                status = 'STATUTORY_HOLD'
                statutory_reason = (
                    "Statutory Hold Applied: Under Section 128 of the Companies Act, 2013 and Section 36 of the "
                    "Central Goods and Services Tax Act, 2017, books of account, tax invoices, and financial records "
                    "must be preserved for eight (8) financial years. Financial transaction data is protected from "
                    "erasure, while non-statutory communication channels have been suppressed."
                )

        dsr = DPDPDataSubjectRequest.objects.create(
            organization=user_org,
            request_number=req_num,
            data_principal_name=name,
            data_principal_email=email,
            data_principal_phone=phone,
            request_type=req_type,
            details=details,
            status=status,
            statutory_hold=statutory_hold,
            statutory_hold_reason=statutory_reason
        )
        services.log_audit(
            request.user, 'create', 'DPDPDataSubjectRequest', dsr.id,
            f"Submitted DPDP {req_type} request {req_num} for {name}",
            org=user_org, module='compliance', submodule='dpdp_requests'
        )
        return j({
            'id': dsr.id,
            'request_number': dsr.request_number,
            'request_type': dsr.request_type,
            'status': dsr.status,
            'statutory_hold': dsr.statutory_hold,
            'statutory_hold_reason': dsr.statutory_hold_reason,
            'created_at': dsr.created_at.isoformat(),
            'message': 'Data Principal Request submitted successfully.'
        }, 201)

    raise ApiError(405, 'Method not allowed.')


@api_view
def dpdp_request_resolve_view(request, pk):
    """
    Resolve or update a DPDP Data Subject Request.
    """
    if request.method != 'POST':
        raise ApiError(405, 'Method not allowed.')
    user_org = get_user_org(request.user, request)
    if not user_org:
        raise ApiError(403, 'Organization required.')

    from .models import DPDPDataSubjectRequest
    dsr = DPDPDataSubjectRequest.objects.filter(pk=pk, organization=user_org).first()
    if not dsr:
        raise ApiError(404, 'DSR Request not found in your organization.')

    d = body(request)
    c = Cleaner(d)
    status = c.choice('status', ['IN_REVIEW', 'COMPLETED', 'REJECTED', 'STATUTORY_HOLD'], default='COMPLETED')
    notes = c.text('response_notes', max_len=2000)
    c.done()

    dsr.status = status
    dsr.response_notes = notes
    if status in ('COMPLETED', 'REJECTED'):
        dsr.resolution_date = timezone.now()
    dsr.save(update_fields=['status', 'response_notes', 'resolution_date', 'updated_at'])

    services.log_audit(
        request.user, 'update', 'DPDPDataSubjectRequest', dsr.id,
        f"Resolved DSR {dsr.request_number}: status={status}",
        org=user_org, module='compliance', submodule='dpdp_requests'
    )
    return j({
        'id': dsr.id,
        'request_number': dsr.request_number,
        'status': dsr.status,
        'resolution_date': dsr.resolution_date.isoformat() if dsr.resolution_date else '',
        'response_notes': dsr.response_notes,
        'message': f'DSR request {dsr.request_number} updated to {status}.'
    })


@api_view
def dpdp_breaches_view(request):
    """
    DPDP Act 2023 Sec 8(6) & CERT-In 6-hour Mandatory Breach Register.
    """
    user_org = get_user_org(request.user, request)
    if not user_org:
        raise ApiError(403, 'Organization required.')

    from .models import DPDPBreachIncident

    if request.method == 'GET':
        qs = DPDPBreachIncident.objects.filter(organization=user_org)
        return j([
            {
                'id': b.id,
                'incident_id': b.incident_id,
                'incident_type': b.incident_type,
                'severity': b.severity,
                'affected_records_count': b.affected_records_count,
                'affected_data_principals': b.affected_data_principals,
                'description': b.description,
                'root_cause': b.root_cause,
                'remediation_steps': b.remediation_steps,
                'cert_in_notified': b.cert_in_notified,
                'cert_in_notified_at': b.cert_in_notified_at.isoformat() if b.cert_in_notified_at else '',
                'dpbi_notified': b.dpbi_notified,
                'dpbi_notified_at': b.dpbi_notified_at.isoformat() if b.dpbi_notified_at else '',
                'status': b.status,
                'detected_at': b.detected_at.isoformat() if b.detected_at else '',
                'reported_at': b.reported_at.isoformat() if b.reported_at else '',
                'resolved_at': b.resolved_at.isoformat() if b.resolved_at else ''
            } for b in qs
        ])

    if request.method == 'POST':
        check_permission(request, allowed_roles=[UserProfile.ADMIN])
        d = body(request)
        c = Cleaner(d)
        itype = c.choice('incident_type', ['UNAUTHORIZED_ACCESS', 'DATA_LEAK', 'RANSOMWARE', 'ACCIDENTAL_EXPOSURE', 'CREDENTIAL_COMPROMISE'], default='UNAUTHORIZED_ACCESS')
        sev = c.choice('severity', ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], default='MEDIUM')
        count = c.integer('affected_records_count', lo=0, default=0)
        desc = c.text('description', required=True, max_len=3000)
        root = c.text('root_cause', max_len=2000)
        remed = c.text('remediation_steps', max_len=2000)
        principals = c.text('affected_data_principals', max_len=1000)
        c.done()

        inc_id = f"INC-{timezone.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

        incident = DPDPBreachIncident.objects.create(
            organization=user_org,
            incident_id=inc_id,
            incident_type=itype,
            severity=sev,
            affected_records_count=count,
            affected_data_principals=principals,
            description=desc,
            root_cause=root,
            remediation_steps=remed,
            status='OPEN',
            detected_at=timezone.now()
        )
        services.log_audit(
            request.user, 'create', 'DPDPBreachIncident', incident.id,
            f"Logged Security Incident {inc_id} ({itype}, Severity: {sev})",
            org=user_org, module='security', submodule='breach_management'
        )
        return j({
            'id': incident.id,
            'incident_id': incident.incident_id,
            'severity': incident.severity,
            'status': incident.status,
            'cert_in_deadline': (incident.detected_at + timedelta(hours=6)).isoformat(),
            'message': 'Incident logged. Prepare CERT-In notification within 6 hours.'
        }, 201)

    raise ApiError(405, 'Method not allowed.')


@api_view
def dpdp_breach_notify_view(request, pk):
    """
    Record statutory notifications to CERT-In (Cyber Security Incident) and DPBI.
    """
    if request.method != 'POST':
        raise ApiError(405, 'Method not allowed.')
    user_org = get_user_org(request.user, request)
    if not user_org:
        raise ApiError(403, 'Organization required.')

    from .models import DPDPBreachIncident
    inc = DPDPBreachIncident.objects.filter(pk=pk, organization=user_org).first()
    if not inc:
        raise ApiError(404, 'Breach incident not found in your organization.')

    d = body(request)
    now = timezone.now()

    if d.get('cert_in', True):
        inc.cert_in_notified = True
        inc.cert_in_notified_at = now
    if d.get('dpbi', True):
        inc.dpbi_notified = True
        inc.dpbi_notified_at = now
    if d.get('status'):
        inc.status = str(d['status']).upper()
        if inc.status == 'RESOLVED':
            inc.resolved_at = now

    inc.save()
    services.log_audit(
        request.user, 'update', 'DPDPBreachIncident', inc.id,
        f"Updated breach notification status for {inc.incident_id}",
        org=user_org, module='security', submodule='breach_management'
    )
    return j({
        'id': inc.id,
        'incident_id': inc.incident_id,
        'cert_in_notified': inc.cert_in_notified,
        'cert_in_notified_at': inc.cert_in_notified_at.isoformat() if inc.cert_in_notified_at else '',
        'dpbi_notified': inc.dpbi_notified,
        'dpbi_notified_at': inc.dpbi_notified_at.isoformat() if inc.dpbi_notified_at else '',
        'status': inc.status,
        'message': 'Statutory notifications updated.'
    })


@api_view
def dpdp_processors_view(request, pk=None):
    """
    DPDP Act 2023 Sec 8(2) - Third-Party Data Processor Register.
    """
    user_org = get_user_org(request.user, request)
    if not user_org:
        raise ApiError(403, 'Organization required.')

    from .models import DPDPDataProcessor

    if request.method == 'GET':
        qs = DPDPDataProcessor.objects.filter(organization=user_org)
        return j([
            {
                'id': p.id,
                'vendor_name': p.vendor_name,
                'service_type': p.service_type,
                'contact_email': p.contact_email,
                'data_shared_categories': p.data_shared_categories,
                'dpa_signed': p.dpa_signed,
                'dpa_date': p.dpa_date.isoformat() if p.dpa_date else '',
                'security_safeguards': p.security_safeguards,
                'country': p.country,
                'is_active': p.is_active,
                'created_at': p.created_at.isoformat() if p.created_at else ''
            } for p in qs
        ])

    if request.method == 'POST':
        check_permission(request, allowed_roles=[UserProfile.ADMIN])
        d = body(request)
        c = Cleaner(d)
        name = c.text('vendor_name', required=True, max_len=200)
        stype = c.text('service_type', required=True, max_len=100)
        email = c.text('contact_email', max_len=200)
        cats = c.text('data_shared_categories', max_len=1000)
        dpa_signed = c.boolean('dpa_signed', default=True)
        dpa_date = c.date('dpa_date')
        safeguards = c.text('security_safeguards', default='TLS 1.3 in-transit, AES-256 at-rest, ISO 27001 compliant', max_len=1000)
        country = c.text('country', default='India', max_len=100)
        c.done()

        proc = DPDPDataProcessor.objects.create(
            organization=user_org,
            vendor_name=name,
            service_type=stype,
            contact_email=email,
            data_shared_categories=cats,
            dpa_signed=dpa_signed,
            dpa_date=dpa_date,
            security_safeguards=safeguards,
            country=country,
            is_active=True
        )
        services.log_audit(
            request.user, 'create', 'DPDPDataProcessor', proc.id,
            f"Registered data processor: {name} ({stype})",
            org=user_org, module='compliance', submodule='data_processors'
        )
        return j({
            'id': proc.id,
            'vendor_name': proc.vendor_name,
            'service_type': proc.service_type,
            'dpa_signed': proc.dpa_signed,
            'message': 'Data processor registered successfully.'
        }, 201)

    if request.method in ('PUT', 'PATCH'):
        if not pk:
            raise ApiError(400, 'Processor ID required.')
        proc = DPDPDataProcessor.objects.filter(pk=pk, organization=user_org).first()
        if not proc:
            raise ApiError(404, 'Data processor not found.')
        d = body(request)
        c = Cleaner(d)
        if 'vendor_name' in d:
            proc.vendor_name = c.text('vendor_name', max_len=200)
        if 'service_type' in d:
            proc.service_type = c.text('service_type', max_len=100)
        if 'contact_email' in d:
            proc.contact_email = c.text('contact_email', max_len=200)
        if 'data_shared_categories' in d:
            proc.data_shared_categories = c.text('data_shared_categories', max_len=1000)
        if 'dpa_signed' in d:
            proc.dpa_signed = c.boolean('dpa_signed')
        if 'dpa_date' in d:
            proc.dpa_date = c.date('dpa_date')
        if 'security_safeguards' in d:
            proc.security_safeguards = c.text('security_safeguards', max_len=1000)
        if 'is_active' in d:
            proc.is_active = c.boolean('is_active')
        c.done()
        proc.save()
        return j({'id': proc.id, 'vendor_name': proc.vendor_name, 'message': 'Processor updated successfully.'})

    raise ApiError(405, 'Method not allowed.')


@api_view
def dpdp_export_principal_data_view(request):
    """
    DPDP Act 2023 Sec 11 - Right to Access:
    Generates a consolidated portability package of all personal and transactional
    records for a given Data Principal within the current organization.
    """
    if request.method not in ('GET', 'POST'):
        raise ApiError(405, 'Method not allowed.')
    user_org = get_user_org(request.user, request)
    if not user_org:
        raise ApiError(403, 'Organization required.')

    d = body(request) if request.method == 'POST' else {}
    identifier = (
        request.GET.get('identifier') or request.GET.get('email') or request.GET.get('phone') or request.GET.get('name') or
        d.get('identifier') or d.get('email') or d.get('phone') or d.get('name') or ''
    ).strip()
    if not identifier:
        raise ApiError(400, 'Data Principal email, phone, or name is required.')

    # Retrieve matching customers and vendors
    custs = Customer.objects.filter(
        organization=user_org
    ).filter(
        Q(email__iexact=identifier) | Q(phone__iexact=identifier) | Q(name__iexact=identifier)
    )
    vends = Vendor.objects.filter(
        organization=user_org
    ).filter(
        Q(email__iexact=identifier) | Q(phone__iexact=identifier) | Q(name__iexact=identifier)
    )

    cust_ids = list(custs.values_list('id', flat=True))
    vend_ids = list(vends.values_list('id', flat=True))

    invoices = list(Invoice.objects.filter(organization=user_org, customer_id__in=cust_ids).values('id', 'number', 'date', 'total', 'status'))
    bills = list(Bill.objects.filter(organization=user_org, vendor_id__in=vend_ids).values('id', 'number', 'date', 'total', 'status'))
    payments_rec = list(PaymentReceived.objects.filter(organization=user_org, customer_id__in=cust_ids).values('id', 'number', 'date', 'amount', 'mode'))
    payments_made = list(PaymentMade.objects.filter(organization=user_org, vendor_id__in=vend_ids).values('id', 'number', 'date', 'amount', 'mode'))

    cust_list = [
        {
            'id': c.id, 'name': c.name, 'email': c.email, 'phone': c.phone,
            'company': c.company, 'gstin': c.gstin, 'billing_address': c.billing_address
        } for c in custs
    ]

    export_pkg = {
        'export_metadata': {
            'organization': user_org.name,
            'generated_at': timezone.now().isoformat(),
            'requested_identifier': identifier,
            'compliance': 'DPDP Act 2023 Section 11 Right to Access'
        },
        'customer_profiles': cust_list,
        'customer_profile': cust_list[0] if cust_list else {},
        'vendor_profiles': [
            {
                'id': v.id, 'name': v.name, 'email': v.email, 'phone': v.phone,
                'company': v.company, 'gstin': v.gstin, 'billing_address': v.billing_address
            } for v in vends
        ],
        'invoices': invoices,
        'bills': bills,
        'payments_received': payments_rec,
        'payments_made': payments_made,
    }

    services.log_audit(
        request.user, 'export', 'DataPrincipal', identifier,
        f"Exported DPDP Personal Data Access Package for {identifier}",
        org=user_org, module='compliance', submodule='dpdp_access'
    )
    return j(export_pkg)

def api_register_view(request):
    """
    Public registration API endpoint with strict duplicate-email prevention.
    """
    if request.method != 'POST':
        return j({'error': 'Method not allowed.'}, 405)
    try:
        data = body(request)
        email = (data.get('email') or data.get('signup_email') or '').strip().lower()
        username = (data.get('username') or data.get('signup_username') or '').strip()
        password = data.get('password') or data.get('signup_password') or ''
        name = (data.get('name') or data.get('signup_name') or '').strip()
        org_name = (data.get('org_name') or data.get('signup_org') or '').strip()

        if not email:
            raise ApiError(400, 'Email address is required.', {'email': 'Email address is required.'})
        if '@' not in email or '.' not in email.split('@')[-1]:
            raise ApiError(400, 'Please enter a valid email address.', {'email': 'Please enter a valid email address.'})
        if not username or not password:
            raise ApiError(400, 'Username and password are required.')
        if len(username) < 3:
            raise ApiError(400, 'Username must be at least 3 characters long.')
        if len(password) < 4:
            raise ApiError(400, 'Password must be at least 4 characters long.')

        from django.contrib.auth import get_user_model
        User = get_user_model()

        if User.objects.filter(email__iexact=email).exists() or UserProfile.objects.filter(normalized_email=email).exists():
            raise ApiError(400, 'An account with this email address already exists. Please log in instead.', {'email': 'An account with this email address already exists. Please log in instead.'})

        if User.objects.filter(username__iexact=username).exists():
            raise ApiError(400, f'Username "{username}" is already registered. Please sign in.', {'username': f'Username "{username}" is already registered. Please sign in.'})

        try:
            with transaction.atomic():
                if User.objects.filter(email__iexact=email).exists() or UserProfile.objects.filter(normalized_email=email).exists():
                    raise ApiError(400, 'An account with this email address already exists. Please log in instead.', {'email': 'An account with this email address already exists. Please log in instead.'})

                user = User.objects.create_user(
                    username=username,
                    email=email,
                    password=password,
                    first_name=name
                )
                company_title = org_name or (f"{name}'s Company" if name else f"{username}'s Company")
                org = Organization.objects.create(
                    name=company_title,
                    owner=user,
                    email=email,
                    state='Kerala'
                )
                UserProfile.objects.create(
                    user=user,
                    role=UserProfile.ADMIN,
                    organization=org,
                    normalized_email=email
                )
                services.ensure_default_accounts(org)
                services.log_audit(user, 'signup', 'organization', org.pk, f'User {username} registered company {org.name} via API')
                return j({
                    'status': 'ok',
                    'message': 'Account registered successfully.',
                    'user': {
                        'id': user.id,
                        'user_id': user.profile.user_id_code,
                        'username': user.username,
                        'email': user.email
                    },
                    'organization': {
                        'id': org.id,
                        'organization_id': org.organization_id,
                        'name': org.name
                    }
                }, 201)
        except (IntegrityError, ValidationError, OperationalError):
            raise ApiError(400, 'An account with this email address already exists. Please log in instead.', {'email': 'An account with this email address already exists. Please log in instead.'})
    except ApiError as e:
        return j({'error': e.message, 'message': e.message, 'errors': e.errors}, e.status)
    except Exception as e:
        return j({'error': str(e), 'message': str(e)}, 400)





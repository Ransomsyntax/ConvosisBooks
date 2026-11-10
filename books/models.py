from decimal import Decimal
import re
import uuid

from django.conf import settings
from django.db import models
from django.db.models import ProtectedError
from django.utils import timezone

MONEY = {'max_digits': 14, 'decimal_places': 2}
QTY = {'max_digits': 14, 'decimal_places': 3}

class Organization(models.Model):
    """Company profile (multi-tenant)."""
    uuid = models.UUIDField(default=uuid.uuid4, editable=False, null=True, db_index=True)
    organization_id = models.CharField(max_length=30, unique=True, null=True, blank=True, db_index=True, help_text='Permanent unique Organization ID (e.g. ORG-000001)')
    code = models.CharField(max_length=20, blank=True, default='', help_text='Organization short code for document numbering (e.g. ABC)')
    name = models.CharField(max_length=200, blank=True, default='')
    display_name = models.CharField(max_length=200, blank=True, default='')
    org_type = models.CharField(max_length=10, choices=[('MAIN', 'Main Organization'), ('SUB', 'Sub-Organization')], default='MAIN')
    parent = models.ForeignKey('self', null=True, blank=True, on_delete=models.CASCADE, related_name='sub_organizations')
    status = models.CharField(max_length=20, choices=[('active', 'Active'), ('inactive', 'Inactive')], default='active')
    company_id = models.CharField(max_length=100, blank=True, default='', help_text='CIN / Registration number')
    gstin = models.CharField(max_length=15, blank=True, default='')
    state = models.CharField(max_length=60, default='Kerala', help_text='Home state; drives CGST/SGST vs IGST.')
    address = models.TextField(blank=True, default='')
    city = models.CharField(max_length=100, blank=True, default='')
    pincode = models.CharField(max_length=20, blank=True, default='')
    country = models.CharField(max_length=100, blank=True, default='')
    phone = models.CharField(max_length=50, blank=True, default='')
    email = models.EmailField(blank=True, default='')
    website = models.CharField(max_length=200, blank=True, default='')
    legal_name = models.CharField(max_length=200, blank=True, default='')
    business_type = models.CharField(max_length=100, blank=True, default='')
    pan = models.CharField(max_length=20, blank=True, default='')
    allow_negative_stock = models.BooleanField(default=False, help_text='Allow negative inventory on posting')
    financial_year = models.CharField(max_length=50, blank=True, default='Apr - Mar')
    base_currency = models.CharField(max_length=10, blank=True, default='INR')
    time_zone = models.CharField(max_length=80, blank=True, default='(GMT+5:30) India Standard Time (Asia/Kolkata)')
    date_format = models.CharField(max_length=30, blank=True, default='dd/MM/yyyy')
    logo_data = models.TextField(blank=True, default='')
    favicon_data = models.TextField(blank=True, default='')
    primary_color = models.CharField(max_length=30, blank=True, default='#1877f2')
    secondary_color = models.CharField(max_length=30, blank=True, default='#0ea5e9')
    app_name = models.CharField(max_length=100, blank=True, default='ConvosisBooks')
    login_branding = models.TextField(blank=True, default='')
    ai_settings = models.JSONField(default=dict, blank=True)
    general_settings = models.JSONField(default=dict, blank=True)
    portal_settings = models.JSONField(default=dict, blank=True)
    reminder_settings = models.JSONField(default=dict, blank=True)
    email_settings = models.JSONField(default=dict, blank=True)
    sms_settings = models.JSONField(default=dict, blank=True)
    pdf_templates = models.JSONField(default=dict, blank=True)
    number_series = models.JSONField(default=dict, blank=True)
    digital_signature = models.JSONField(default=dict, blank=True)
    tax_settings = models.JSONField(default=dict, blank=True)
    direct_tax_settings = models.JSONField(default=dict, blank=True)
    template_theme = models.CharField(max_length=50, blank=True, default='convosis')
    template_color = models.CharField(max_length=30, blank=True, default='#1877f2')
    signature_title = models.CharField(max_length=100, blank=True, default='Authorized Signature')
    signature_data = models.TextField(blank=True, default='')
    notes_default = models.TextField(blank=True, default='Thanks for your business.')
    terms_default = models.TextField(blank=True, default='Due on Receipt')
    opening_cash = models.DecimalField(default=Decimal('0.00'), **MONEY)
    quote_prefix = models.CharField(max_length=20, blank=True, default='QT')
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='owned_organizations')
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    is_active = models.BooleanField(default=True)

    def save(self, *args, **kwargs):
        if not self.organization_id:
            self.organization_id = generate_unique_organization_id()
        super().save(*args, **kwargs)

    def get_code(self):
        if self.code and self.code.strip():
            return re.sub(r'[^A-Za-z0-9]', '', self.code.strip()).upper()
        if self.pk == 1:
            return 'ABC'
        words = re.findall(r'[A-Za-z0-9]+', self.name or '')
        if len(words) >= 2:
            c = ''.join(w[0] for w in words[:4]).upper()
        elif words:
            c = words[0][:4].upper()
        else:
            c = f'ORG{self.pk}'
        return c or 'ABC'

    @classmethod
    def get(cls, user=None):
        if user and getattr(user, 'is_authenticated', False):
            profile = getattr(user, 'profile', None)
            if profile and profile.organization:
                return profile.organization
            if getattr(user, 'is_superuser', False):
                return cls.objects.first()
            return None
        return cls.objects.first()

    def __str__(self):
        return self.name

class Sequence(models.Model):
    key = models.CharField(max_length=100, primary_key=True)
    value = models.PositiveIntegerField(default=0)

def generate_unique_organization_id():
    """Generates an atomic, collision-free permanent Organization ID (e.g. ORG-000001)."""
    from django.db import transaction
    with transaction.atomic():
        seq, _ = Sequence.objects.select_for_update().get_or_create(key='organization_id')
        if seq.value == 0:
            existing = Organization.objects.filter(organization_id__startswith='ORG-').values_list('organization_id', flat=True)
            max_num = 0
            for oid in existing:
                try:
                    num_part = int(str(oid).replace('ORG-', ''))
                    if num_part > max_num:
                        max_num = num_part
                except Exception:
                    pass
            max_pk = Organization.objects.aggregate(models.Max('id'))['id__max'] or 0
            seq.value = max(max_num, max_pk)
        seq.value += 1
        seq.save(update_fields=['value'])
        candidate = f"ORG-{seq.value:06d}"
        while Organization.objects.filter(organization_id=candidate).exists():
            seq.value += 1
            seq.save(update_fields=['value'])
            candidate = f"ORG-{seq.value:06d}"
        return candidate

def generate_unique_user_id():
    """Generates an atomic, collision-free permanent User ID (e.g. USR-00000001)."""
    from django.db import transaction
    from django.contrib.auth import get_user_model
    with transaction.atomic():
        seq, _ = Sequence.objects.select_for_update().get_or_create(key='user_id_code')
        if seq.value == 0:
            existing = UserProfile.objects.filter(user_id_code__startswith='USR-').values_list('user_id_code', flat=True)
            max_num = 0
            for uid in existing:
                try:
                    num_part = int(str(uid).replace('USR-', ''))
                    if num_part > max_num:
                        max_num = num_part
                except Exception:
                    pass
            User = get_user_model()
            max_user_pk = User.objects.aggregate(models.Max('id'))['id__max'] or 0
            max_prof_pk = UserProfile.objects.aggregate(models.Max('id'))['id__max'] or 0
            seq.value = max(max_num, max_user_pk, max_prof_pk)
        seq.value += 1
        seq.save(update_fields=['value'])
        candidate = f"USR-{seq.value:08d}"
        while UserProfile.objects.filter(user_id_code=candidate).exists():
            seq.value += 1
            seq.save(update_fields=['value'])
            candidate = f"USR-{seq.value:08d}"
        return candidate

class Party(models.Model):
    organization = models.ForeignKey(Organization, null=True, blank=True, on_delete=models.CASCADE, related_name='%(class)ss')
    uuid = models.UUIDField(default=uuid.uuid4, editable=False, null=True, db_index=True)
    code = models.CharField(max_length=60, blank=True, default='', db_index=True)
    name = models.CharField(max_length=200)
    company = models.CharField(max_length=200, blank=True)
    contact_person = models.CharField(max_length=120, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=30, blank=True)
    mobile = models.CharField(max_length=30, blank=True)
    billing_address = models.TextField(blank=True)
    billing_attention = models.CharField(max_length=150, blank=True)
    billing_city = models.CharField(max_length=100, blank=True)
    billing_pincode = models.CharField(max_length=20, blank=True)
    billing_country = models.CharField(max_length=100, default='India', blank=True)
    billing_phone = models.CharField(max_length=30, blank=True)
    state = models.CharField(max_length=60, blank=True)
    gstin = models.CharField(max_length=15, blank=True)
    pan = models.CharField(max_length=10, blank=True)
    gst_treatment = models.CharField(max_length=40, default='business_regular', blank=True)
    tax_preference = models.CharField(max_length=30, default='taxable', blank=True)
    exemption_reason = models.CharField(max_length=200, blank=True)
    currency = models.CharField(max_length=10, default='INR', blank=True)
    opening_balance = models.DecimalField(default=Decimal('0.00'), **MONEY)
    opening_balance_type = models.CharField(max_length=10, default='debit', choices=[('debit', 'Debit'), ('credit', 'Credit')])
    payment_terms = models.PositiveSmallIntegerField(default=30, help_text='Days')
    payment_terms_label = models.CharField(max_length=50, default='Net 30', blank=True)
    contact_persons_data = models.JSONField(default=list, blank=True)
    custom_fields_data = models.JSONField(default=dict, blank=True)
    reporting_tags = models.CharField(max_length=255, blank=True)
    remarks = models.TextField(blank=True)
    documents_data = models.JSONField(default=list, blank=True)
    notes = models.TextField(blank=True)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        abstract = True
        ordering = ['name']

    def __str__(self):
        return self.name

class Customer(Party):
    customer_type = models.CharField(max_length=20, default='business', choices=[('business', 'Business'), ('individual', 'Individual')])
    customer_language = models.CharField(max_length=40, default='English', blank=True)
    place_of_supply = models.CharField(max_length=80, blank=True)
    shipping_address = models.TextField(blank=True)
    shipping_attention = models.CharField(max_length=150, blank=True)
    shipping_city = models.CharField(max_length=100, blank=True)
    shipping_state = models.CharField(max_length=80, blank=True)
    shipping_pincode = models.CharField(max_length=20, blank=True)
    shipping_country = models.CharField(max_length=100, default='India', blank=True)
    shipping_phone = models.CharField(max_length=30, blank=True)
    portal_enabled = models.BooleanField(default=False)
    portal_language = models.CharField(max_length=40, default='English', blank=True)

class Vendor(Party):
    source_of_supply = models.CharField(max_length=80, blank=True)
    is_msme_registered = models.BooleanField(default=False)
    msme_type = models.CharField(max_length=30, blank=True, choices=[('micro', 'Micro'), ('small', 'Small'), ('medium', 'Medium')])
    msme_reg_number = models.CharField(max_length=60, blank=True)
    apply_gst_tds = models.BooleanField(default=False)
    tds_section = models.CharField(max_length=50, blank=True)
    bank_name = models.CharField(max_length=120, blank=True)
    bank_account_holder = models.CharField(max_length=150, blank=True)
    bank_account_number = models.CharField(max_length=60, blank=True)
    bank_ifsc = models.CharField(max_length=20, blank=True)
    bank_branch = models.CharField(max_length=100, blank=True)
    bank_upi_id = models.CharField(max_length=100, blank=True)

class Item(models.Model):
    GOODS, SERVICE = 'goods', 'service'
    organization = models.ForeignKey(Organization, null=True, blank=True, on_delete=models.CASCADE, related_name='items')
    uuid = models.UUIDField(default=uuid.uuid4, editable=False, null=True, db_index=True)
    name = models.CharField(max_length=200)
    sku = models.CharField(max_length=60, unique=True, blank=True)
    item_type = models.CharField(max_length=10, choices=[(GOODS, 'Goods'), (SERVICE, 'Service')], default=GOODS)
    category = models.CharField(max_length=100, blank=True)
    hsn_sac = models.CharField(max_length=10, blank=True)
    unit = models.CharField(max_length=20, default='nos')
    description = models.TextField(blank=True)
    selling_price = models.DecimalField(default=Decimal('0.00'), **MONEY)
    purchase_price = models.DecimalField(default=Decimal('0.00'), **MONEY)
    gst_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('18.00'))
    track_inventory = models.BooleanField(default=False)
    stock = models.DecimalField(default=Decimal('0.000'), **QTY)
    reorder_level = models.DecimalField(default=Decimal('0.000'), **QTY)
    warehouse = models.ForeignKey('Warehouse', null=True, blank=True, on_delete=models.SET_NULL, related_name='items')
    warehouse_code = models.CharField(max_length=30, blank=True, default='')
    image_data = models.TextField(blank=True, default='')
    tax_preference = models.CharField(max_length=30, default='taxable')
    sales_account = models.CharField(max_length=100, default='Sales')
    purchase_account = models.CharField(max_length=100, default='Cost of Goods Sold')
    preferred_vendor = models.ForeignKey(Vendor, null=True, blank=True, on_delete=models.SET_NULL, related_name='items')
    inventory_account = models.CharField(max_length=100, default='Inventory Asset', blank=True)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f'{self.name} ({self.sku})'

class Document(models.Model):
    DRAFT, VOID = 'draft', 'void'
    organization = models.ForeignKey(Organization, null=True, blank=True, on_delete=models.CASCADE, related_name='%(class)ss')
    uuid = models.UUIDField(default=uuid.uuid4, editable=False, null=True, db_index=True)
    number = models.CharField(max_length=60, unique=True)
    date = models.DateField()
    due_date = models.DateField()
    place_of_supply = models.CharField(max_length=60)
    status = models.CharField(max_length=10, default=DRAFT)
    subtotal = models.DecimalField(default=Decimal('0.00'), **MONEY)  
    cgst = models.DecimalField(default=Decimal('0.00'), **MONEY)
    sgst = models.DecimalField(default=Decimal('0.00'), **MONEY)
    igst = models.DecimalField(default=Decimal('0.00'), **MONEY)
    total = models.DecimalField(default=Decimal('0.00'), **MONEY)
    order_number = models.CharField(max_length=60, blank=True, default='')
    tax_pricing_type = models.CharField(max_length=20, default='tax_exclusive', choices=[('tax_exclusive', 'Tax Exclusive'), ('tax_inclusive', 'Tax Inclusive')], blank=True)
    customer_type = models.CharField(max_length=20, default='b2b', blank=True)
    location = models.CharField(max_length=120, default='HO Kottayam', blank=True)
    transaction_series = models.CharField(max_length=120, default='Default Transaction Series', blank=True)
    salesperson = models.CharField(max_length=120, blank=True, default='')
    project_name = models.CharField(max_length=150, blank=True, default='')
    subject = models.TextField(blank=True, default='')
    notes = models.TextField(blank=True)
    terms = models.TextField(blank=True, default='')
    signature_data = models.TextField(blank=True, default='')
    signed_by = models.CharField(max_length=150, blank=True, default='')
    signed_at = models.DateTimeField(null=True, blank=True)
    signature_title = models.CharField(max_length=100, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True

class Invoice(Document):
    customer = models.ForeignKey(Customer, on_delete=models.PROTECT, related_name='invoices')
    source_quote = models.ForeignKey('Quote', null=True, blank=True, on_delete=models.SET_NULL, related_name='derived_invoices')
    source_sales_order = models.ForeignKey('SalesOrder', null=True, blank=True, on_delete=models.SET_NULL, related_name='derived_invoices')
    recurring_invoice = models.ForeignKey('RecurringInvoice', null=True, blank=True, on_delete=models.SET_NULL, related_name='generated_invoices')
    accounts_receivable = models.CharField(max_length=120, default='Accounts Receivable', blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return self.number

    @property
    def paid_amount(self):
        if not self.pk:
            return Decimal('0.00')
        p_alloc = sum((a.amount for a in self.allocations.all()), Decimal('0.00'))
        r_alloc = sum((a.amount for a in self.retainer_allocations.all()), Decimal('0.00')) if hasattr(self, 'retainer_allocations') else Decimal('0.00')
        return p_alloc + r_alloc

    @property
    def balance_due(self):
        return max(Decimal('0.00'), self.total - self.paid_amount)

class Bill(Document):
    vendor = models.ForeignKey(Vendor, on_delete=models.PROTECT, related_name='bills')
    source_purchase_order = models.ForeignKey('PurchaseOrder', null=True, blank=True, on_delete=models.SET_NULL, related_name='derived_bills')
    accounts_payable = models.CharField(max_length=120, default='Accounts Payable', blank=True)
    vendor_ref = models.CharField(max_length=60, blank=True)

    def __str__(self):
        return self.number

    @property
    def paid_amount(self):
        if not self.pk:
            return Decimal('0.00')
        return sum((a.amount for a in self.allocations.all()), Decimal('0.00'))

    @property
    def balance_due(self):
        return max(Decimal('0.00'), self.total - self.paid_amount)

class Line(models.Model):
    uuid = models.UUIDField(default=uuid.uuid4, editable=False, null=True, db_index=True)
    item = models.ForeignKey(Item, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    warehouse = models.ForeignKey('Warehouse', null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    warehouse_code = models.CharField(max_length=30, blank=True, default='')
    description = models.CharField(max_length=500)
    hsn_sac = models.CharField(max_length=10, blank=True)
    quantity = models.DecimalField(**QTY)
    rate = models.DecimalField(**MONEY)
    discount_percent = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    gst_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    taxable = models.DecimalField(**MONEY)
    tax_amount = models.DecimalField(**MONEY)
    line_total = models.DecimalField(**MONEY)
    position = models.PositiveSmallIntegerField(default=0)

    class Meta:
        abstract = True
        ordering = ['position', 'id']

class InvoiceLine(Line):
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name='lines')

class BillLine(Line):
    bill = models.ForeignKey(Bill, on_delete=models.CASCADE, related_name='lines')

MODES = [('cash', 'Cash'), ('bank_transfer', 'Bank transfer'), ('upi', 'UPI'),
         ('cheque', 'Cheque'), ('card', 'Card'), ('other', 'Other')]

class Payment(models.Model):
    organization = models.ForeignKey(Organization, null=True, blank=True, on_delete=models.CASCADE, related_name='%(class)ss')
    uuid = models.UUIDField(default=uuid.uuid4, editable=False, null=True, db_index=True)
    number = models.CharField(max_length=60, unique=True)
    date = models.DateField()
    mode = models.CharField(max_length=20, choices=MODES, default='bank_transfer')
    account = models.CharField(max_length=60, default='Bank Account')
    bank_account = models.ForeignKey('BankAccount', null=True, blank=True, on_delete=models.SET_NULL, related_name='%(class)s_payments')
    amount = models.DecimalField(**MONEY)
    reference = models.CharField(max_length=80, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')

    class Meta:
        abstract = True

class PaymentReceived(Payment):
    customer = models.ForeignKey(Customer, on_delete=models.PROTECT, related_name='payments')

class PaymentMade(Payment):
    vendor = models.ForeignKey(Vendor, on_delete=models.PROTECT, related_name='payments')

class ReceivedAllocation(models.Model):
    uuid = models.UUIDField(default=uuid.uuid4, editable=False, null=True, db_index=True)
    payment = models.ForeignKey(PaymentReceived, on_delete=models.CASCADE, related_name='allocations')
    invoice = models.ForeignKey(Invoice, on_delete=models.PROTECT, related_name='allocations')
    amount = models.DecimalField(**MONEY)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['payment', 'invoice'], name='uniq_received_alloc')]

class BillAllocation(models.Model):
    uuid = models.UUIDField(default=uuid.uuid4, editable=False, null=True, db_index=True)
    payment = models.ForeignKey(PaymentMade, on_delete=models.CASCADE, related_name='allocations')
    bill = models.ForeignKey(Bill, on_delete=models.PROTECT, related_name='allocations')
    amount = models.DecimalField(**MONEY)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['payment', 'bill'], name='uniq_bill_alloc')]

class StockMovement(models.Model):
    organization = models.ForeignKey(Organization, null=True, blank=True, on_delete=models.CASCADE, related_name='stock_movements')
    uuid = models.UUIDField(default=uuid.uuid4, editable=False, null=True, db_index=True)
    KINDS = [('opening', 'Opening stock'), ('sale', 'Sale'), ('sale_void', 'Sale voided'),
             ('purchase', 'Purchase'), ('purchase_void', 'Purchase voided'), ('adjustment', 'Adjustment'),
             ('transfer', 'Warehouse Transfer')]
    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name='movements')
    date = models.DateField()
    adjusted_at = models.DateTimeField(null=True, blank=True)
    warehouse = models.ForeignKey('Warehouse', null=True, blank=True, on_delete=models.SET_NULL, related_name='stock_movements')
    warehouse_code = models.CharField(max_length=30, blank=True, default='')
    to_warehouse = models.ForeignKey('Warehouse', null=True, blank=True, on_delete=models.SET_NULL, related_name='incoming_stock_movements')
    to_warehouse_code = models.CharField(max_length=30, blank=True, default='')
    kind = models.CharField(max_length=15, choices=KINDS)
    reference = models.CharField(max_length=40, blank=True)
    change = models.DecimalField(**QTY)
    balance_after = models.DecimalField(**QTY)
    reason = models.CharField(max_length=100, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')

    class Meta:
        ordering = ['-date', '-id']

class Attachment(models.Model):
    organization = models.ForeignKey(Organization, null=True, blank=True, on_delete=models.CASCADE, related_name='attachments')
    uuid = models.UUIDField(default=uuid.uuid4, editable=False, null=True, db_index=True)
    entity_type = models.CharField(max_length=40, db_index=True)   
    entity_id = models.PositiveIntegerField(db_index=True)
    file = models.FileField(upload_to='attachments/%Y/%m/', blank=True, null=True)
    file_data = models.TextField(blank=True, default='')
    filename = models.CharField(max_length=255)
    file_size = models.PositiveIntegerField(default=0)
    mime_type = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.filename} ({self.entity_type} #{self.entity_id})'

class Account(models.Model):
    organization = models.ForeignKey(Organization, null=True, blank=True, on_delete=models.CASCADE, related_name='accounts')
    uuid = models.UUIDField(default=uuid.uuid4, editable=False, null=True, db_index=True)
    ASSET, LIABILITY, EQUITY, INCOME, EXPENSE = 'asset', 'liability', 'equity', 'income', 'expense'
    TYPES = [
        (ASSET, 'Asset'),
        (LIABILITY, 'Liability'),
        (EQUITY, 'Equity'),
        (INCOME, 'Income'),
        (EXPENSE, 'Expense'),
    ]

    code = models.CharField(max_length=30)
    name = models.CharField(max_length=150)
    account_type = models.CharField(max_length=20, choices=TYPES)
    sub_type = models.CharField(max_length=60, blank=True, default='') 
    description = models.TextField(blank=True)
    is_system = models.BooleanField(default=False)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['code', 'name']
        constraints = [models.UniqueConstraint(fields=['organization', 'code'], name='unique_org_account_code')]

    def __str__(self):
        return f'{self.code} - {self.name}'

class Journal(models.Model):
    organization = models.ForeignKey(Organization, null=True, blank=True, on_delete=models.CASCADE, related_name='journals')
    uuid = models.UUIDField(default=uuid.uuid4, editable=False, null=True, db_index=True)
    number = models.CharField(max_length=60)
    date = models.DateField()
    entry_type = models.CharField(max_length=40, default='manual') 
    reference = models.CharField(max_length=80, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')

    class Meta:
        ordering = ['-date', '-id']
        constraints = [models.UniqueConstraint(fields=['organization', 'number'], name='unique_org_journal_number')]

    def __str__(self):
        return f'{self.number} ({self.date})'

class JournalItem(models.Model):
    uuid = models.UUIDField(default=uuid.uuid4, editable=False, null=True, db_index=True)
    journal = models.ForeignKey(Journal, on_delete=models.CASCADE, related_name='items')
    account = models.ForeignKey(Account, on_delete=models.PROTECT, related_name='journal_items')
    debit = models.DecimalField(default=Decimal('0.00'), **MONEY)
    credit = models.DecimalField(default=Decimal('0.00'), **MONEY)
    description = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ['id']

class LockDate(models.Model):
    """Enforce transaction locking prior to this date for compliance and auditing."""
    organization = models.ForeignKey(Organization, null=True, blank=True, on_delete=models.CASCADE, related_name='lock_dates')
    lock_date = models.DateField()
    reason = models.CharField(max_length=255, blank=True, default='Books closed for accounting period')
    updated_at = models.DateTimeField(auto_now=True)
    locked_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')

    @classmethod
    def get_lock(cls, org=None):
        if org:
            return cls.objects.filter(organization=org).first()
        return cls.objects.first()

class AuditLog(models.Model):
    """Immutable statutory audit trail of all transactions and system events."""
    organization = models.ForeignKey(Organization, null=True, blank=True, on_delete=models.CASCADE, related_name='audit_logs')
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    username = models.CharField(max_length=150, blank=True)
    action = models.CharField(max_length=50)  
    entity_type = models.CharField(max_length=60)
    entity_id = models.CharField(max_length=60, blank=True)
    module = models.CharField(max_length=60, blank=True, default='')
    submodule = models.CharField(max_length=60, blank=True, default='')
    summary = models.TextField()
    details = models.JSONField(default=dict, blank=True)
    previous_values = models.JSONField(default=dict, blank=True)
    new_values = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=30, blank=True, default='success')
    ip_address = models.CharField(max_length=50, blank=True)
    record_hash = models.CharField(max_length=64, blank=True, default='')
    prev_hash = models.CharField(max_length=64, blank=True, default='')

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f'[{self.timestamp:%Y-%m-%d %H:%M}] {self.action} {self.entity_type} #{self.entity_id}'

    def delete(self, *args, **kwargs):
        raise ProtectedError("Audit log records are immutable and cannot be deleted.", [self])

class CustomField(models.Model):
    organization = models.ForeignKey(Organization, null=True, blank=True, on_delete=models.CASCADE, related_name='custom_fields')
    module = models.CharField(max_length=40) 
    name = models.CharField(max_length=60)
    label = models.CharField(max_length=100)
    field_type = models.CharField(max_length=20, default='text') 
    options = models.TextField(blank=True, help_text='Comma separated choices for select')
    required = models.BooleanField(default=False)
    active = models.BooleanField(default=True)

    class Meta:
        ordering = ['module', 'label']

class WorkflowRule(models.Model):
    organization = models.ForeignKey(Organization, null=True, blank=True, on_delete=models.CASCADE, related_name='workflow_rules')
    name = models.CharField(max_length=150)
    event = models.CharField(max_length=60) 
    condition_field = models.CharField(max_length=60, blank=True)
    condition_op = models.CharField(max_length=20, blank=True) 
    condition_val = models.CharField(max_length=100, blank=True)
    action_type = models.CharField(max_length=40, default='notification')  
    action_payload = models.TextField(blank=True)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

class WebhookConfig(models.Model):
    organization = models.ForeignKey(Organization, null=True, blank=True, on_delete=models.CASCADE, related_name='webhook_configs')
    name = models.CharField(max_length=100)
    url = models.URLField()
    secret = models.CharField(max_length=100, blank=True)
    events = models.CharField(max_length=255, default='*') 
    active = models.BooleanField(default=True)

class BankAccount(models.Model):
    organization = models.ForeignKey(Organization, null=True, blank=True, on_delete=models.CASCADE, related_name='bank_accounts')
    uuid = models.UUIDField(default=uuid.uuid4, editable=False, null=True, db_index=True)
    SAVINGS, CURRENT, CREDIT_CARD, CASH, CHECKING, OTHER = 'savings', 'current', 'credit_card', 'cash', 'checking', 'other'
    TYPES = [
        (CURRENT, 'Current Account'),
        (SAVINGS, 'Savings Account'),
        (CHECKING, 'Checking Account'),
        (CASH, 'Cash Account'),
        (CREDIT_CARD, 'Credit Card'),
        (OTHER, 'Other')
    ]

    name = models.CharField(max_length=150)
    bank_name = models.CharField(max_length=100)
    account_number = models.CharField(max_length=50)
    ifsc = models.CharField(max_length=20, blank=True)
    account_type = models.CharField(max_length=20, choices=TYPES, default=CURRENT)
    currency = models.CharField(max_length=10, default='INR')
    opening_balance = models.DecimalField(default=Decimal('0.00'), **MONEY)
    opening_balance_date = models.DateField(null=True, blank=True)
    current_balance = models.DecimalField(default=Decimal('0.00'), **MONEY)
    bank_balance = models.DecimalField(default=Decimal('0.00'), **MONEY)
    branch_name = models.CharField(max_length=100, default='HO Kottayam', blank=True)
    last_feed_date = models.DateField(null=True, blank=True)
    description = models.TextField(blank=True)
    gl_account = models.ForeignKey(Account, null=True, blank=True, on_delete=models.SET_NULL, related_name='bank_accounts')
    active = models.BooleanField(default=True)
    is_archived = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f'{self.name} ({self.bank_name})'

class BankTransaction(models.Model):
    organization = models.ForeignKey(Organization, null=True, blank=True, on_delete=models.CASCADE, related_name='bank_transactions')
    bank_account = models.ForeignKey(BankAccount, on_delete=models.CASCADE, related_name='transactions')
    date = models.DateField()
    description = models.CharField(max_length=300)
    reference = models.CharField(max_length=100, blank=True)
    transaction_type = models.CharField(max_length=60, default='Bank Transaction', blank=True)
    payee = models.CharField(max_length=200, blank=True)
    location = models.CharField(max_length=100, default='HO Kottayam', blank=True)
    withdrawal = models.DecimalField(default=Decimal('0.00'), **MONEY) 
    deposit = models.DecimalField(default=Decimal('0.00'), **MONEY)     
    balance = models.DecimalField(default=Decimal('0.00'), **MONEY)
    status = models.CharField(max_length=30, default='unreconciled')   
    category_account = models.ForeignKey(Account, null=True, blank=True, on_delete=models.SET_NULL, related_name='categorized_bank_txns')
    matched_entity_type = models.CharField(max_length=40, blank=True)   
    matched_entity_id = models.PositiveIntegerField(null=True, blank=True)
    reconciled_at = models.DateTimeField(null=True, blank=True)
    is_cleared = models.BooleanField(default=False)
    cleared_date = models.DateField(null=True, blank=True)
    match_metadata = models.JSONField(default=dict, blank=True)
    notes = models.TextField(blank=True)
    transaction_hash = models.CharField(max_length=64, blank=True, default='', db_index=True)
    batch = models.ForeignKey('BankStatementBatch', null=True, blank=True, on_delete=models.SET_NULL, related_name='transactions')
    is_live_feed = models.BooleanField(default=False)

    class Meta:
        ordering = ['-date', '-id']

class DocumentFolder(models.Model):
    organization = models.ForeignKey(Organization, null=True, blank=True, on_delete=models.CASCADE, related_name='document_folders')
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    color = models.CharField(max_length=30, blank=True, default='#1877f2')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']
        constraints = [models.UniqueConstraint(fields=['organization', 'name'], name='unique_org_doc_folder_name')]

    def __str__(self):
        return self.name

class ManagedDocument(models.Model):
    organization = models.ForeignKey(Organization, null=True, blank=True, on_delete=models.CASCADE, related_name='managed_documents')
    CATEGORIES = [
        ('invoice', 'Invoice'),
        ('bill', 'Vendor Bill'),
        ('receipt', 'Receipt / Expense'),
        ('bank_statement', 'Bank Statement'),
        ('tax_doc', 'Tax / GST Document'),
        ('contract', 'Contract / Agreement'),
        ('other', 'Other Document')
    ]

    title = models.CharField(max_length=255)
    folder = models.ForeignKey(DocumentFolder, null=True, blank=True, on_delete=models.SET_NULL, related_name='documents')
    category = models.CharField(max_length=30, choices=CATEGORIES, default='receipt')
    file = models.FileField(upload_to='managed_docs/%Y/%m/', blank=True, null=True)
    file_data = models.TextField(blank=True, default='') 
    filename = models.CharField(max_length=255)
    file_size = models.PositiveIntegerField(default=0)
    mime_type = models.CharField(max_length=100, blank=True)
    is_deleted = models.BooleanField(default=False, db_index=True)
    deleted_at = models.DateTimeField(null=True, blank=True)
    ocr_status = models.CharField(max_length=20, default='none')
    ocr_data = models.JSONField(default=dict, blank=True)
    converted_to_type = models.CharField(max_length=30, blank=True)
    converted_to_id = models.PositiveIntegerField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.title} ({self.filename})'

class SalesOrder(Document):
    customer = models.ForeignKey(Customer, on_delete=models.PROTECT, related_name='sales_orders')
    source_quote = models.ForeignKey('Quote', null=True, blank=True, on_delete=models.SET_NULL, related_name='derived_sales_orders')
    converted_to_invoice = models.ForeignKey('Invoice', null=True, blank=True, on_delete=models.SET_NULL, related_name='originating_sales_orders')
    converted_at = models.DateTimeField(null=True, blank=True)
    expected_shipment_date = models.DateField(null=True, blank=True)

class SalesOrderLine(Line):
    order = models.ForeignKey(SalesOrder, on_delete=models.CASCADE, related_name='lines')

class Quote(Document):
    customer = models.ForeignKey(Customer, on_delete=models.PROTECT, related_name='quotes')
    reference_number = models.CharField(max_length=100, blank=True, default='')
    expiry_date = models.DateField(null=True, blank=True)
    tax_type = models.CharField(max_length=10, default='tds', choices=[('tds', 'TDS'), ('tcs', 'TCS')])
    tds_tcs_tax = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    adjustment = models.DecimalField(default=Decimal('0.00'), **MONEY)
    adjustment_label = models.CharField(max_length=50, blank=True, default='Adjustment')
    sent_at = models.DateTimeField(null=True, blank=True)
    converted_to_invoice = models.ForeignKey('Invoice', null=True, blank=True, on_delete=models.SET_NULL, related_name='source_quotes')
    converted_to_sales_order = models.ForeignKey('SalesOrder', null=True, blank=True, on_delete=models.SET_NULL, related_name='source_quotes')
    converted_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return self.number

class QuoteLine(Line):
    quote = models.ForeignKey(Quote, on_delete=models.CASCADE, related_name='lines')

class RecurringInvoice(models.Model):
    organization = models.ForeignKey(Organization, null=True, blank=True, on_delete=models.CASCADE, related_name='recurring_invoices')
    FREQUENCIES = [('weekly', 'Weekly'), ('monthly', 'Monthly'), ('quarterly', 'Quarterly'), ('yearly', 'Yearly')]
    profile_name = models.CharField(max_length=150)
    customer = models.ForeignKey(Customer, on_delete=models.PROTECT, related_name='recurring_invoices')
    frequency = models.CharField(max_length=20, choices=FREQUENCIES, default='monthly')
    location = models.CharField(max_length=120, default='HO Kottayam', blank=True)
    order_number = models.CharField(max_length=60, blank=True, default='')
    repeat_every = models.PositiveIntegerField(default=1)
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    next_date = models.DateField()
    never_ends = models.BooleanField(default=True)
    payment_terms = models.PositiveIntegerField(default=30)
    salesperson = models.CharField(max_length=120, blank=True, default='')
    project_name = models.CharField(max_length=150, blank=True, default='')
    subject = models.TextField(blank=True, default='')
    notes = models.TextField(blank=True, default='')
    terms = models.TextField(blank=True, default='')
    create_as_draft = models.BooleanField(default=True)
    status = models.CharField(max_length=20, default='active')
    tax_pricing_type = models.CharField(max_length=20, default='tax_exclusive', choices=[('tax_exclusive', 'Tax Exclusive'), ('tax_inclusive', 'Tax Inclusive')], blank=True)
    customer_type = models.CharField(max_length=20, default='b2b', blank=True)
    subtotal = models.DecimalField(default=Decimal('0.00'), **MONEY)
    total = models.DecimalField(default=Decimal('0.00'), **MONEY)
    lines_data = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

class RetainerInvoice(Document):
    customer = models.ForeignKey(Customer, on_delete=models.PROTECT, related_name='retainer_invoices')
    applied_amount = models.DecimalField(default=Decimal('0.00'), **MONEY)
    accounts_receivable = models.CharField(max_length=120, default='Accounts Receivable', blank=True)
    purpose = models.CharField(max_length=255, blank=True, default='')
    sent_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return self.number

    @property
    def paid_amount(self):
        if not self.pk:
            return Decimal('0.00')
        return sum((p.amount for p in self.payments.all()), Decimal('0.00'))

    @property
    def available_balance(self):
        return max(Decimal('0.00'), self.paid_amount - self.applied_amount)

    @property
    def total_amount(self):
        return self.total

    @property
    def retainer_number(self):
        return self.number

class RetainerInvoiceLine(Line):
    retainer = models.ForeignKey(RetainerInvoice, on_delete=models.CASCADE, related_name='lines')

class RetainerPayment(models.Model):
    organization = models.ForeignKey(Organization, null=True, blank=True, on_delete=models.CASCADE, related_name='retainer_payments')
    retainer = models.ForeignKey(RetainerInvoice, on_delete=models.CASCADE, related_name='payments')
    payment_received = models.ForeignKey('books.PaymentReceived', null=True, blank=True, on_delete=models.SET_NULL, related_name='retainer_payments')
    date = models.DateField()
    amount = models.DecimalField(**MONEY)
    mode = models.CharField(max_length=20, choices=MODES, default='bank_transfer')
    account = models.CharField(max_length=60, default='Bank Account')
    reference = models.CharField(max_length=80, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.retainer.number} - ₹{self.amount}'

class RetainerInvoiceAllocation(models.Model):
    retainer = models.ForeignKey(RetainerInvoice, on_delete=models.CASCADE, related_name='allocations')
    invoice = models.ForeignKey('books.Invoice', on_delete=models.CASCADE, related_name='retainer_allocations')
    date = models.DateField()
    amount = models.DecimalField(**MONEY)
    notes = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.retainer.number} -> {self.invoice.number} (₹{self.amount})'

class DeliveryChallan(models.Model):
    organization = models.ForeignKey(Organization, null=True, blank=True, on_delete=models.CASCADE, related_name='delivery_challans')
    uuid = models.UUIDField(default=uuid.uuid4, editable=False, null=True, db_index=True)
    CHALLAN_TYPES = [('supply_on_approval', 'Supply on Approval'), ('job_work', 'Job Work'), ('other', 'Other')]
    number = models.CharField(max_length=60, unique=True)
    customer = models.ForeignKey(Customer, on_delete=models.PROTECT, related_name='delivery_challans')
    date = models.DateField()
    challan_type = models.CharField(max_length=40, choices=CHALLAN_TYPES, default='other')
    status = models.CharField(max_length=20, default='open')
    vehicle_number = models.CharField(max_length=50, blank=True)
    notes = models.TextField(blank=True)
    signature_data = models.TextField(blank=True, default='')
    signed_by = models.CharField(max_length=150, blank=True, default='')
    signed_at = models.DateTimeField(null=True, blank=True)
    signature_title = models.CharField(max_length=100, blank=True, default='Authorized Signature')
    created_at = models.DateTimeField(auto_now_add=True)

class DeliveryChallanLine(models.Model):
    uuid = models.UUIDField(default=uuid.uuid4, editable=False, null=True, db_index=True)
    challan = models.ForeignKey(DeliveryChallan, on_delete=models.CASCADE, related_name='lines')
    item = models.ForeignKey(Item, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    warehouse = models.ForeignKey('Warehouse', null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    warehouse_code = models.CharField(max_length=30, blank=True, default='')
    description = models.CharField(max_length=500)
    hsn_sac = models.CharField(max_length=10, blank=True)
    quantity = models.DecimalField(**QTY)

class CreditNote(Document):
    customer = models.ForeignKey(Customer, on_delete=models.PROTECT, related_name='credit_notes')
    invoice = models.ForeignKey(Invoice, null=True, blank=True, on_delete=models.SET_NULL, related_name='credit_notes')
    reason = models.CharField(max_length=150, blank=True)

class CreditNoteLine(Line):
    credit_note = models.ForeignKey(CreditNote, on_delete=models.CASCADE, related_name='lines')

class PurchaseOrder(Document):
    vendor = models.ForeignKey(Vendor, on_delete=models.PROTECT, related_name='purchase_orders')
    converted_to_bill = models.ForeignKey('Bill', null=True, blank=True, on_delete=models.SET_NULL, related_name='originating_purchase_orders')
    converted_at = models.DateTimeField(null=True, blank=True)
    delivery_date = models.DateField(null=True, blank=True)

class PurchaseOrderLine(Line):
    order = models.ForeignKey(PurchaseOrder, on_delete=models.CASCADE, related_name='lines')

class Expense(models.Model):
    organization = models.ForeignKey(Organization, null=True, blank=True, on_delete=models.CASCADE, related_name='expenses')
    uuid = models.UUIDField(default=uuid.uuid4, editable=False, null=True, db_index=True)
    number = models.CharField(max_length=60, unique=True)
    date = models.DateField()
    expense_account = models.ForeignKey(Account, on_delete=models.PROTECT, related_name='expenses')
    vendor = models.ForeignKey(Vendor, null=True, blank=True, on_delete=models.SET_NULL, related_name='expenses')
    amount = models.DecimalField(**MONEY)
    gst_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    tax_amount = models.DecimalField(default=Decimal('0.00'), **MONEY)
    total = models.DecimalField(**MONEY)
    paid_through = models.CharField(max_length=80, default='Bank Account')
    reference = models.CharField(max_length=80, blank=True)
    notes = models.TextField(blank=True)
    is_tax_deductible = models.BooleanField(default=True)
    receipt = models.ForeignKey(ManagedDocument, null=True, blank=True, on_delete=models.SET_NULL, related_name='expenses')
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')

    class Meta:
        ordering = ['-date', '-id']

    def __str__(self):
        return f'{self.number} ({inr_amount(self.total)})'

def inr_amount(v):
    return f'₹{v}'

class VendorCredit(Document):
    vendor = models.ForeignKey(Vendor, on_delete=models.PROTECT, related_name='vendor_credits')
    bill = models.ForeignKey(Bill, null=True, blank=True, on_delete=models.SET_NULL, related_name='vendor_credits')
    reason = models.CharField(max_length=150, blank=True)

class VendorCreditLine(Line):
    vendor_credit = models.ForeignKey(VendorCredit, on_delete=models.CASCADE, related_name='lines')

class EWayBill(models.Model):
    organization = models.ForeignKey(Organization, null=True, blank=True, on_delete=models.CASCADE, related_name='eway_bills')
    bill_number = models.CharField(max_length=16, unique=True)
    doc_type = models.CharField(max_length=10, default='INV')
    doc_number = models.CharField(max_length=40)
    doc_date = models.DateField()
    party_name = models.CharField(max_length=200)
    party_gstin = models.CharField(max_length=15, blank=True)
    from_state = models.CharField(max_length=60)
    to_state = models.CharField(max_length=60)
    distance_km = models.PositiveIntegerField(default=50)
    transporter_id = models.CharField(max_length=20, blank=True)
    transporter_name = models.CharField(max_length=100, blank=True)
    vehicle_number = models.CharField(max_length=30, blank=True)
    valid_until = models.DateTimeField()
    status = models.CharField(max_length=20, default='generated')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'EWB #{self.bill_number} for {self.doc_number}'

class EInvoiceRecord(models.Model):
    organization = models.ForeignKey(Organization, null=True, blank=True, on_delete=models.CASCADE, related_name='einvoice_records')
    invoice = models.OneToOneField(Invoice, on_delete=models.CASCADE, related_name='einvoice')
    irn = models.CharField(max_length=64, unique=True)
    ack_no = models.CharField(max_length=30)
    ack_date = models.DateTimeField()
    signed_qr_code = models.TextField(blank=True)
    status = models.CharField(max_length=20, default='generated')
    created_at = models.DateTimeField(auto_now_add=True)

class Project(models.Model):
    organization = models.ForeignKey(Organization, null=True, blank=True, on_delete=models.CASCADE, related_name='projects')
    name = models.CharField(max_length=150)
    code = models.CharField(max_length=40, blank=True)
    customer = models.ForeignKey(Customer, null=True, blank=True, on_delete=models.SET_NULL, related_name='projects')
    billing_method = models.CharField(max_length=40, default='hourly_rate')
    rate_per_hour = models.DecimalField(default=Decimal('0.00'), **MONEY)
    budget_hours = models.DecimalField(default=Decimal('0.00'), **QTY)
    status = models.CharField(max_length=20, default='active')
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name

class TimeLog(models.Model):
    organization = models.ForeignKey(Organization, null=True, blank=True, on_delete=models.CASCADE, related_name='time_logs')
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='timelogs')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    date = models.DateField()
    hours = models.DecimalField(max_digits=6, decimal_places=2)
    task = models.CharField(max_length=255)
    billable = models.BooleanField(default=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date', '-id']

class ItemCategory(models.Model):
    organization = models.ForeignKey(Organization, null=True, blank=True, on_delete=models.CASCADE, related_name='item_categories')
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']
        constraints = [models.UniqueConstraint(fields=['organization', 'name'], name='unique_org_item_category_name')]

    def __str__(self):
        return self.name

class PriceList(models.Model):
    organization = models.ForeignKey(Organization, null=True, blank=True, on_delete=models.CASCADE, related_name='price_lists')
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    pricing_scheme = models.CharField(max_length=30, default='percentage')
    percentage = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name

class Warehouse(models.Model):
    organization = models.ForeignKey(Organization, null=True, blank=True, on_delete=models.CASCADE, related_name='warehouses')
    uuid = models.UUIDField(default=uuid.uuid4, editable=False, null=True, db_index=True)
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=30)
    parent = models.ForeignKey('self', null=True, blank=True, on_delete=models.CASCADE, related_name='sub_warehouses')
    address = models.TextField(blank=True)
    city = models.CharField(max_length=100, blank=True)
    state = models.CharField(max_length=60, blank=True)
    is_primary = models.BooleanField(default=False)
    shared_database = models.BooleanField(default=True, help_text='Operates on shared centralized database')
    active = models.BooleanField(default=True)

    class Meta:
        ordering = ['name']
        constraints = [models.UniqueConstraint(fields=['organization', 'code'], name='unique_org_warehouse_code')]

    def __str__(self):
        if self.parent:
            return f'{self.name} ({self.code}) [Sub-warehouse of {self.parent.code}]'
        return f'{self.name} ({self.code})'

class StockTransfer(models.Model):
    """Transfer of stock between warehouses within the same organization."""
    organization = models.ForeignKey(Organization, null=True, blank=True, on_delete=models.CASCADE, related_name='stock_transfers')
    uuid = models.UUIDField(default=uuid.uuid4, editable=False, null=True, db_index=True)
    number = models.CharField(max_length=50, db_index=True)
    date = models.DateField()
    source_warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT, related_name='stock_transfers_out')
    source_warehouse_code = models.CharField(max_length=30, blank=True, default='')
    destination_warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT, related_name='stock_transfers_in')
    destination_warehouse_code = models.CharField(max_length=30, blank=True, default='')
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('confirmed', 'Confirmed'),
        ('reversed', 'Reversed'),
    ]
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft', db_index=True)
    notes = models.TextField(blank=True, default='')

    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')

    confirmed_at = models.DateTimeField(null=True, blank=True)
    confirmed_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')

    reversed_at = models.DateTimeField(null=True, blank=True)
    reversed_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    reversal_reason = models.TextField(blank=True, default='')
    reversal_transfer = models.ForeignKey('self', null=True, blank=True, on_delete=models.SET_NULL, related_name='reversed_from')
    is_reversal = models.BooleanField(default=False)

    class Meta:
        ordering = ['-date', '-id']
        constraints = [
            models.UniqueConstraint(fields=['organization', 'number'], name='unique_org_stock_transfer_number')
        ]

    def __str__(self):
        return f'{self.number} ({self.get_status_display()})'

    def delete(self, *args, **kwargs):
        raise ProtectedError("Stock transfer records cannot be deleted. Use Reverse Entry instead.", [self])


class StockTransferLine(models.Model):
    transfer = models.ForeignKey(StockTransfer, on_delete=models.CASCADE, related_name='lines')
    item = models.ForeignKey('Item', on_delete=models.PROTECT, related_name='stock_transfer_lines')
    item_name = models.CharField(max_length=150, blank=True, default='')
    item_sku = models.CharField(max_length=60, blank=True, default='')
    quantity = models.DecimalField(**QTY)
    unit = models.CharField(max_length=20, blank=True, default='nos')
    batch_number = models.CharField(max_length=60, blank=True, default='')
    serial_number = models.CharField(max_length=100, blank=True, default='')
    description = models.CharField(max_length=500, blank=True, default='')

    class Meta:
        ordering = ['id']

    def __str__(self):
        return f'{self.transfer.number} - {self.item_name} ({self.quantity})'


class PaymentTransaction(models.Model):
    organization = models.ForeignKey(Organization, null=True, blank=True, on_delete=models.CASCADE, related_name='payment_transactions')
    gateway = models.CharField(max_length=40, default='upi')
    transaction_id = models.CharField(max_length=100, unique=True)
    invoice = models.ForeignKey(Invoice, null=True, blank=True, on_delete=models.SET_NULL, related_name='payment_txns')
    amount = models.DecimalField(**MONEY)
    fee = models.DecimalField(default=Decimal('0.00'), **MONEY)
    status = models.CharField(max_length=30, default='captured') 
    customer_email = models.CharField(max_length=120, blank=True)
    payment_link = models.URLField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

class FinancialAnomaly(models.Model):
    organization = models.ForeignKey(Organization, null=True, blank=True, on_delete=models.CASCADE, related_name='financial_anomalies')
    TYPES = [
        ('duplicate_bill', 'Duplicate Bill Detected'),
        ('spending_spike', 'Unusual Spending Spike'),
        ('tax_mismatch', 'Tax Rate Mismatch'),
        ('round_amount', 'Unusual Round Amount'),
        ('unreconciled_lag', 'Old Unreconciled Transaction')
    ]
    title = models.CharField(max_length=200)
    anomaly_type = models.CharField(max_length=40, choices=TYPES)
    severity = models.CharField(max_length=20, default='medium')
    description = models.TextField()
    entity_type = models.CharField(max_length=40, blank=True)
    entity_id = models.PositiveIntegerField(null=True, blank=True)
    status = models.CharField(max_length=20, default='detected')
    detected_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-detected_at']

    def __str__(self):
        return f'[{self.severity.upper()}] {self.title}'

class BankFeedConnection(models.Model):
    organization = models.ForeignKey(Organization, null=True, blank=True, on_delete=models.CASCADE, related_name='bank_feed_connections')
    bank_account = models.OneToOneField(BankAccount, on_delete=models.CASCADE, related_name='feed_connection')
    provider = models.CharField(max_length=50, default='setu_aa')
    provider_name = models.CharField(max_length=100, default='Open Banking Live Feed')
    status = models.CharField(max_length=30, default='connected')
    consent_id = models.CharField(max_length=100, blank=True)
    consent_expires_at = models.DateTimeField(null=True, blank=True)
    auto_sync = models.BooleanField(default=True)
    sync_frequency = models.CharField(max_length=30, default='hourly')
    account_mask = models.CharField(max_length=30, blank=True)
    last_synced_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.provider} feed for {self.bank_account.name}'

class BankStatementBatch(models.Model):
    organization = models.ForeignKey(Organization, null=True, blank=True, on_delete=models.CASCADE, related_name='bank_statement_batches')
    bank_account = models.ForeignKey(BankAccount, on_delete=models.CASCADE, related_name='statement_batches')
    batch_number = models.CharField(max_length=50, unique=True)
    filename = models.CharField(max_length=255)
    source = models.CharField(max_length=30, default='csv_import')
    imported_at = models.DateTimeField(auto_now_add=True)
    total_rows = models.PositiveIntegerField(default=0)
    imported_count = models.PositiveIntegerField(default=0)
    duplicate_count = models.PositiveIntegerField(default=0)
    status = models.CharField(max_length=30, default='completed')
    reconciled_count = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['-imported_at']

    def __str__(self):
        return f'{self.batch_number} ({self.source}) - {self.imported_count} imported'

class BankRule(models.Model):
    organization = models.ForeignKey(Organization, null=True, blank=True, on_delete=models.CASCADE, related_name='bank_rules')
    name = models.CharField(max_length=150)
    priority = models.PositiveSmallIntegerField(default=10)
    field = models.CharField(max_length=40, default='description')
    operator = models.CharField(max_length=20, default='contains')
    value = models.CharField(max_length=200)
    assign_account = models.ForeignKey(Account, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    assign_party_type = models.CharField(max_length=20, blank=True)
    assign_party_id = models.PositiveIntegerField(null=True, blank=True)
    assign_transaction_type = models.CharField(max_length=50, blank=True, default='')
    assign_payee = models.CharField(max_length=200, blank=True, default='')
    auto_reconcile = models.BooleanField(default=False)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['priority', 'name']

    def __str__(self):
        return f'{self.name} ({self.field} {self.operator} "{self.value}")'

class BankReconciliation(models.Model):
    organization = models.ForeignKey(Organization, null=True, blank=True, on_delete=models.CASCADE, related_name='bank_reconciliations')
    bank_account = models.ForeignKey(BankAccount, on_delete=models.CASCADE, related_name='reconciliations')
    reconciliation_number = models.CharField(max_length=50, unique=True)
    statement_date = models.DateField()
    statement_ending_balance = models.DecimalField(default=Decimal('0.00'), **MONEY)
    cleared_deposits = models.DecimalField(default=Decimal('0.00'), **MONEY)
    cleared_withdrawals = models.DecimalField(default=Decimal('0.00'), **MONEY)
    cleared_balance = models.DecimalField(default=Decimal('0.00'), **MONEY)
    book_balance = models.DecimalField(default=Decimal('0.00'), **MONEY)
    difference = models.DecimalField(default=Decimal('0.00'), **MONEY)
    cleared_count = models.PositiveIntegerField(default=0)
    status = models.CharField(max_length=30, default='completed')
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)

    class Meta:
        ordering = ['-statement_date', '-created_at']

    def __str__(self):
        return f'{self.reconciliation_number} - {self.bank_account.name} ({self.statement_date})'

class BankDeposit(models.Model):
    organization = models.ForeignKey(Organization, null=True, blank=True, on_delete=models.CASCADE, related_name='bank_deposits')
    uuid = models.UUIDField(default=uuid.uuid4, editable=False, null=True, db_index=True)
    number = models.CharField(max_length=40, unique=True)
    bank_account = models.ForeignKey(BankAccount, on_delete=models.PROTECT, related_name='deposits')
    date = models.DateField()
    amount = models.DecimalField(**MONEY)
    deposit_type = models.CharField(max_length=40, default='cash_deposit')
    party_name = models.CharField(max_length=200, blank=True)
    offset_account = models.ForeignKey(Account, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    reference = models.CharField(max_length=100, blank=True)
    description = models.TextField(blank=True)
    location = models.CharField(max_length=100, default='HO Kottayam', blank=True)
    status = models.CharField(max_length=30, default='posted')
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)

    class Meta:
        ordering = ['-date', '-id']

    def __str__(self):
        return f'{self.number} (₹{self.amount}) -> {self.bank_account.name}'

class BankTransfer(models.Model):
    organization = models.ForeignKey(Organization, null=True, blank=True, on_delete=models.CASCADE, related_name='bank_transfers')
    uuid = models.UUIDField(default=uuid.uuid4, editable=False, null=True, db_index=True)
    number = models.CharField(max_length=40, unique=True)
    from_account = models.ForeignKey(BankAccount, on_delete=models.PROTECT, related_name='outgoing_transfers')
    to_account = models.ForeignKey(BankAccount, on_delete=models.PROTECT, related_name='incoming_transfers')
    date = models.DateField()
    amount = models.DecimalField(**MONEY)
    reference = models.CharField(max_length=100, blank=True)
    description = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    status = models.CharField(max_length=30, default='completed')
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)

    class Meta:
        ordering = ['-date', '-id']

    def __str__(self):
        return f'{self.number} ({self.from_account.name} -> {self.to_account.name}: ₹{self.amount})'

class GSTRReturn(models.Model):
    organization = models.ForeignKey(Organization, null=True, blank=True, on_delete=models.CASCADE, related_name='gstr_returns')
    GSTR1, GSTR3B = 'GSTR1', 'GSTR3B'
    TYPES = [(GSTR1, 'GSTR-1 (Outward Supplies)'), (GSTR3B, 'GSTR-3B (Summary Return)')]

    return_type = models.CharField(max_length=15, choices=TYPES)
    financial_year = models.CharField(max_length=15, default='2026-27')
    tax_period = models.CharField(max_length=10, default='042026') 
    status = models.CharField(max_length=30, default='draft')
    arn = models.CharField(max_length=40, blank=True)
    filed_at = models.DateTimeField(null=True, blank=True)
    taxable_value = models.DecimalField(default=Decimal('0.00'), **MONEY)
    cgst_amount = models.DecimalField(default=Decimal('0.00'), **MONEY)
    sgst_amount = models.DecimalField(default=Decimal('0.00'), **MONEY)
    igst_amount = models.DecimalField(default=Decimal('0.00'), **MONEY)
    total_tax = models.DecimalField(default=Decimal('0.00'), **MONEY)
    payload_json = models.JSONField(default=dict, blank=True)
    response_json = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.return_type} ({self.tax_period}) - {self.status}'

class Role(models.Model):
    uuid = models.UUIDField(default=uuid.uuid4, editable=False, null=True, db_index=True)
    organization = models.ForeignKey(Organization, null=True, blank=True, on_delete=models.CASCADE, related_name='custom_roles')
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    is_system = models.BooleanField(default=False)
    api_only = models.BooleanField(default=False)
    is_accountant = models.BooleanField(default=False)
    permissions = models.JSONField(default=dict, blank=True)
    report_permissions = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        unique_together = [('organization', 'name')]

    def __str__(self):
        return self.name

class UserProfile(models.Model):
    ADMIN, ACCOUNTANT, AUDITOR, CASHIER, PORTAL = 'admin', 'accountant', 'auditor', 'cashier', 'portal'
    ROLES = [
        (ADMIN, 'Administrator (Full Access)'),
        (ACCOUNTANT, 'Standard Accountant'),
        (AUDITOR, 'Statutory Auditor (Read-Only)'),
        (CASHIER, 'Billing Operator & Cashier'),
        (PORTAL, 'Customer/Vendor Portal User'),
    ]

    STATUS_ACTIVE, STATUS_INVITED, STATUS_INACTIVE = 'active', 'invited', 'inactive'
    STATUS_CHOICES = [
        (STATUS_ACTIVE, 'Active'),
        (STATUS_INVITED, 'Invited'),
        (STATUS_INACTIVE, 'Inactive'),
    ]

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='profile')
    user_id_code = models.CharField(max_length=30, unique=True, null=True, blank=True, db_index=True, help_text='Permanent unique User ID (e.g. USR-00000001)')
    organization = models.ForeignKey(Organization, null=True, blank=True, on_delete=models.CASCADE, related_name='members')
    role = models.CharField(max_length=50, choices=ROLES, default=ADMIN)
    custom_role = models.ForeignKey(Role, null=True, blank=True, on_delete=models.SET_NULL, related_name='assigned_profiles')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_ACTIVE)
    assigned_customers = models.ManyToManyField('Customer', blank=True, related_name='assigned_staff_users')
    normalized_email = models.EmailField(blank=True, default='', db_index=True)
    phone = models.CharField(max_length=30, blank=True)
    mfa_enabled = models.BooleanField(default=True)
    mfa_secret = models.CharField(max_length=64, blank=True, default='')
    backup_codes = models.JSONField(default=list, blank=True)
    last_active_ip = models.CharField(max_length=50, blank=True)
    is_locked = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['normalized_email'], condition=~models.Q(normalized_email=''), name='unique_user_normalized_email')
        ]

    def clean(self):
        super().clean()
        if self.user and self.user.email:
            self.normalized_email = self.user.email.strip().lower()
        elif self.normalized_email:
            self.normalized_email = self.normalized_email.strip().lower()
        if self.normalized_email:
            qs = UserProfile.objects.filter(normalized_email=self.normalized_email)
            if self.pk:
                qs = qs.exclude(pk=self.pk)
            if qs.exists():
                from django.core.exceptions import ValidationError
                raise ValidationError({"normalized_email": "An account with this email address already exists. Please log in instead."})

    def save(self, *args, **kwargs):
        if not self.user_id_code:
            self.user_id_code = generate_unique_user_id()
        if self.user and self.user.email:
            self.normalized_email = self.user.email.strip().lower()
        elif self.normalized_email:
            self.normalized_email = self.normalized_email.strip().lower()
        super().save(*args, **kwargs)

    def get_role_display(self):
        if self.custom_role:
            return self.custom_role.name
        role_map = dict(self.ROLES)
        return role_map.get(self.role, self.role.title() if self.role else 'Administrator')

    def __str__(self):
        r_name = self.custom_role.name if self.custom_role else self.role
        return f'{self.user.username} ({r_name})'

class OrganizationMembership(models.Model):
    uuid = models.UUIDField(default=uuid.uuid4, editable=False, db_index=True)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='user_memberships')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='memberships')
    role = models.CharField(max_length=30, choices=UserProfile.ROLES, default='admin')
    permissions = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=20, choices=[('active', 'Active'), ('inactive', 'Inactive')], default='active')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        unique_together = [('user', 'organization')]

    def __str__(self):
        return f'{self.user.username} @ {self.organization.name} ({self.role})'

class UserInvitation(models.Model):
    uuid = models.UUIDField(default=uuid.uuid4, editable=False, null=True, db_index=True)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='user_invitations')
    email = models.EmailField()
    name = models.CharField(max_length=120, blank=True)
    role = models.ForeignKey(Role, null=True, blank=True, on_delete=models.SET_NULL, related_name='invitations')
    role_name = models.CharField(max_length=100, blank=True)
    is_accountant = models.BooleanField(default=False)
    token = models.CharField(max_length=64, unique=True)
    status = models.CharField(max_length=20, default='invited', choices=[
        ('invited', 'Invited'),
        ('active', 'Active'),
        ('inactive', 'Inactive'),
        ('expired', 'Expired'),
    ])
    invited_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='sent_invitations')
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.email} ({self.role_name or 'Invited'})"

class CurrencySetting(models.Model):
    organization = models.ForeignKey(Organization, null=True, blank=True, on_delete=models.CASCADE, related_name='currency_settings')
    code = models.CharField(max_length=10)
    name = models.CharField(max_length=100)
    symbol = models.CharField(max_length=10)
    exchange_rate = models.DecimalField(max_digits=12, decimal_places=4, default=Decimal('1.0000'))
    is_base = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['code']
        unique_together = [('organization', 'code')]

    def __str__(self):
        return f"{self.code} ({self.symbol})"

class PaymentTermSetting(models.Model):
    organization = models.ForeignKey(Organization, null=True, blank=True, on_delete=models.CASCADE, related_name='payment_term_settings')
    name = models.CharField(max_length=100)
    days = models.PositiveIntegerField(default=0)
    is_default = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['days', 'name']

    def __str__(self):
        return f"{self.name} ({self.days} days)"

class SecurityBackupRecord(models.Model):
    organization = models.ForeignKey(Organization, null=True, blank=True, on_delete=models.CASCADE, related_name='security_backups')
    snapshot_id = models.CharField(max_length=60, unique=True)
    filename = models.CharField(max_length=255)
    file_size_bytes = models.PositiveIntegerField(default=0)
    checksum_sha256 = models.CharField(max_length=64)
    backup_type = models.CharField(max_length=30, default='snapshot')
    status = models.CharField(max_length=30, default='verified')
    record_counts = models.JSONField(default=dict, blank=True)
    disaster_recovery_test_passed = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'Backup {self.snapshot_id} ({self.status})'

class BackgroundTask(models.Model):
    organization = models.ForeignKey(Organization, null=True, blank=True, on_delete=models.CASCADE, related_name='background_tasks')
    task_id = models.CharField(max_length=50, unique=True)
    task_type = models.CharField(max_length=50)
    status = models.CharField(max_length=30, default='completed')
    progress = models.PositiveSmallIntegerField(default=100)
    summary = models.CharField(max_length=255, blank=True)
    details = models.JSONField(default=dict, blank=True)
    error_message = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'Task {self.task_id} ({self.task_type}: {self.status})'

class CustomerPortalAccess(models.Model):
    organization = models.ForeignKey(Organization, null=True, blank=True, on_delete=models.CASCADE, related_name='customer_portal_accesses')
    token = models.CharField(max_length=64, unique=True)
    customer = models.OneToOneField(Customer, on_delete=models.CASCADE, related_name='portal_access')
    portal_username = models.CharField(max_length=100, blank=True)
    is_active = models.BooleanField(default=True)
    allow_online_payment = models.BooleanField(default=True)
    allow_estimate_approval = models.BooleanField(default=True)
    allow_statement_download = models.BooleanField(default=True)
    last_login_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'Portal for {self.customer.name}'

class VendorPortalAccess(models.Model):
    organization = models.ForeignKey(Organization, null=True, blank=True, on_delete=models.CASCADE, related_name='vendor_portal_accesses')
    token = models.CharField(max_length=64, unique=True)
    vendor = models.OneToOneField(Vendor, on_delete=models.CASCADE, related_name='portal_access')
    is_active = models.BooleanField(default=True)
    allow_bill_upload = models.BooleanField(default=True)
    last_login_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'Portal for {self.vendor.name}'

class Notification(models.Model):
    organization = models.ForeignKey(Organization, null=True, blank=True, on_delete=models.CASCADE, related_name='notifications')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True, related_name='notifications')
    title = models.CharField(max_length=200)
    message = models.TextField()
    category = models.CharField(max_length=30, default='system')
    link = models.CharField(max_length=200, blank=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.title} ({self.category})'

class TenantSubscription(models.Model):
    organization = models.ForeignKey(Organization, null=True, blank=True, on_delete=models.CASCADE, related_name='subscriptions')
    FREE, PROFESSIONAL, PREMIUM = 'free', 'professional', 'premium'
    STARTER, GROWTH, ENTERPRISE = 'starter', 'growth', 'enterprise'
    TIERS = [
        (FREE, 'Free Plan'),
        (PROFESSIONAL, 'Professional Plan'),
        (PREMIUM, 'Premium Plan'),
        (STARTER, 'Starter Plan (Legacy)'),
        (GROWTH, 'Growth Plan (Legacy)'),
        (ENTERPRISE, 'Enterprise Scale Plan (Legacy)'),
    ]

    tier = models.CharField(max_length=30, choices=TIERS, default=FREE)
    billing_cycle = models.CharField(max_length=20, default='annual')
    status = models.CharField(max_length=20, default='active')
    invoice_limit = models.PositiveIntegerField(default=100)
    record_limit = models.PositiveIntegerField(default=100)
    user_seat_limit = models.PositiveIntegerField(default=1)
    storage_limit_mb = models.PositiveIntegerField(default=500)
    purchased_books_users = models.PositiveIntegerField(default=0)
    purchased_addons = models.JSONField(default=dict, blank=True)
    is_trial = models.BooleanField(default=False)
    trial_ends_at = models.DateField(null=True, blank=True)
    period_start = models.DateField(null=True, blank=True)
    period_end = models.DateField(null=True, blank=True)
    auto_renew = models.BooleanField(default=True)
    payment_method = models.CharField(max_length=50, default='Visa ending in 4242')
    created_at = models.DateTimeField(auto_now_add=True)

    @property
    def total_allowed_users(self):
        return self.user_seat_limit + self.purchased_books_users

    @property
    def plan_tier(self):
        return self.tier

    @property
    def current_period_end(self):
        return self.period_end

    @property
    def max_users(self):
        return self.total_allowed_users

    def __str__(self):
        return f'{self.tier} ({self.status})'

class SubscriptionInvoice(models.Model):
    organization = models.ForeignKey(Organization, null=True, blank=True, on_delete=models.CASCADE, related_name='subscription_invoices')
    invoice_no = models.CharField(max_length=60)
    date = models.DateField(default=timezone.localdate)
    description = models.CharField(max_length=255)
    amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    status = models.CharField(max_length=30, default='Paid')
    payment_method = models.CharField(max_length=50, default='Visa ending in 4242')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date', '-id']

    def __str__(self):
        return f'{self.invoice_no} - {self.description}'

class DeveloperApiKey(models.Model):
    organization = models.ForeignKey(Organization, null=True, blank=True, on_delete=models.CASCADE, related_name='developer_api_keys')
    name = models.CharField(max_length=100)
    key_prefix = models.CharField(max_length=16, default='sk_live_')
    masked_key = models.CharField(max_length=40)
    key_hash = models.CharField(max_length=64, unique=True)
    scopes = models.JSONField(default=list, blank=True)
    is_active = models.BooleanField(default=True)
    last_used_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.name} ({self.masked_key})'

class WebhookSubscription(models.Model):
    organization = models.ForeignKey(Organization, null=True, blank=True, on_delete=models.CASCADE, related_name='webhook_subscriptions')
    endpoint_url = models.URLField()
    secret = models.CharField(max_length=64)
    events = models.JSONField(default=list, blank=True)
    is_active = models.BooleanField(default=True)
    last_delivery_at = models.DateTimeField(null=True, blank=True)
    last_status_code = models.PositiveSmallIntegerField(default=200)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.endpoint_url}'


# ==============================================================================
# DIGITAL PERSONAL DATA PROTECTION (DPDP ACT 2023 / RULES 2025) GOVERNANCE
# ==============================================================================

class DPDPConsentRecord(models.Model):
    """
    DPDP Act 2023 Section 6 - Records explicit consent from Data Principals
    (Customers, Vendors, Employees, Contacts) with purpose limitation.
    """
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='dpdp_consents')
    data_principal_name = models.CharField(max_length=200)
    data_principal_email = models.CharField(max_length=200, blank=True)
    data_principal_phone = models.CharField(max_length=50, blank=True)
    purpose = models.CharField(max_length=100, default='INVOICING_AND_ACCOUNTING')
    consent_type = models.CharField(max_length=50, default='EXPLICIT')
    notice_version = models.CharField(max_length=50, default='v1.0')
    status = models.CharField(max_length=20, default='ACTIVE', choices=[
        ('ACTIVE', 'Active'),
        ('WITHDRAWN', 'Withdrawn'),
        ('EXPIRED', 'Expired'),
    ])
    ip_address = models.CharField(max_length=50, blank=True)
    user_agent = models.TextField(blank=True)
    granted_at = models.DateTimeField(auto_now_add=True)
    withdrawn_at = models.DateTimeField(null=True, blank=True)
    withdrawal_reason = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ['-granted_at']

    def __str__(self):
        return f'{self.data_principal_name} - {self.purpose} ({self.status})'


class DPDPDataSubjectRequest(models.Model):
    """
    DPDP Act 2023 Sections 11, 12, 13, 14 - Data Principal Rights:
    Access, Correction, Erasure, Grievance Redressal, Nomination.
    Includes statutory retention hold safeguards (Companies Act / GST Act 8-year mandatory retention).
    """
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='dpdp_dsr_requests')
    request_number = models.CharField(max_length=50, unique=True)
    data_principal_name = models.CharField(max_length=200)
    data_principal_email = models.CharField(max_length=200, blank=True)
    data_principal_phone = models.CharField(max_length=50, blank=True)
    request_type = models.CharField(max_length=50, choices=[
        ('ACCESS', 'Right to Access Personal Data'),
        ('CORRECTION', 'Right to Correction / Updating'),
        ('ERASURE', 'Right to Erasure / Deletion'),
        ('GRIEVANCE', 'Grievance Redressal'),
        ('NOMINATION', 'Right to Nominate'),
    ])
    status = models.CharField(max_length=30, default='RECEIVED', choices=[
        ('RECEIVED', 'Received'),
        ('IN_REVIEW', 'In Review'),
        ('COMPLETED', 'Completed'),
        ('REJECTED', 'Rejected'),
        ('STATUTORY_HOLD', 'Statutory Retention Hold'),
    ])
    details = models.TextField()
    statutory_hold = models.BooleanField(default=False)
    statutory_hold_reason = models.TextField(blank=True)
    response_notes = models.TextField(blank=True)
    resolution_date = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.request_number} ({self.request_type}) - {self.status}'


class DPDPBreachIncident(models.Model):
    """
    DPDP Act 2023 Section 8(6) & CERT-In Mandatory Reporting:
    Personal data breach register with prompt incident notification to DPBI and CERT-In.
    """
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='dpdp_breaches')
    incident_id = models.CharField(max_length=60, unique=True)
    incident_type = models.CharField(max_length=50, choices=[
        ('UNAUTHORIZED_ACCESS', 'Unauthorized Access'),
        ('DATA_LEAK', 'Data Leak'),
        ('RANSOMWARE', 'Ransomware / Malware'),
        ('ACCIDENTAL_EXPOSURE', 'Accidental Exposure'),
        ('CREDENTIAL_COMPROMISE', 'Credential Compromise'),
    ])
    severity = models.CharField(max_length=20, default='MEDIUM', choices=[
        ('LOW', 'Low'),
        ('MEDIUM', 'Medium'),
        ('HIGH', 'High'),
        ('CRITICAL', 'Critical'),
    ])
    affected_records_count = models.PositiveIntegerField(default=0)
    affected_data_principals = models.TextField(blank=True)
    description = models.TextField()
    root_cause = models.TextField(blank=True)
    remediation_steps = models.TextField(blank=True)
    cert_in_notified = models.BooleanField(default=False)
    cert_in_notified_at = models.DateTimeField(null=True, blank=True)
    dpbi_notified = models.BooleanField(default=False)
    dpbi_notified_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=30, default='OPEN', choices=[
        ('OPEN', 'Open'),
        ('INVESTIGATING', 'Investigating'),
        ('CONTAINED', 'Contained'),
        ('RESOLVED', 'Resolved'),
    ])
    detected_at = models.DateTimeField()
    reported_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-reported_at']

    def __str__(self):
        return f'{self.incident_id} ({self.severity}) - {self.status}'


class DPDPDataProcessor(models.Model):
    """
    DPDP Act 2023 Section 8(2) - Third-Party Data Processor Register:
    Tracking data processing agreements (DPA), technical safeguards, and vendor compliance.
    """
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='dpdp_processors')
    vendor_name = models.CharField(max_length=200)
    service_type = models.CharField(max_length=100)
    contact_email = models.CharField(max_length=200, blank=True)
    data_shared_categories = models.TextField(blank=True)
    dpa_signed = models.BooleanField(default=True)
    dpa_date = models.DateField(null=True, blank=True)
    security_safeguards = models.TextField(blank=True)
    country = models.CharField(max_length=100, default='India')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['vendor_name']

    def __str__(self):
        return f'{self.vendor_name} ({self.service_type})'


class Salesperson(models.Model):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='salespersons')
    name = models.CharField(max_length=150)
    email = models.EmailField(blank=True, default='')
    phone = models.CharField(max_length=40, blank=True, default='')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        unique_together = ('organization', 'name')

    def __str__(self):
        return self.name


class DocumentNumberPreference(models.Model):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='doc_number_preferences')
    document_type = models.CharField(max_length=50)  # quotes, sales_orders, invoices, recurring_invoices, retainer_invoices, bills, purchase_orders
    location = models.CharField(max_length=120, default='HO Kottayam', blank=True)
    transaction_series = models.CharField(max_length=120, default='Default Transaction Series', blank=True)
    auto_generate = models.BooleanField(default=True)
    prefix = models.CharField(max_length=100, blank=True, default='')
    next_number = models.PositiveIntegerField(default=1)
    restart_yearly = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('organization', 'document_type', 'transaction_series')

    def __str__(self):
        return f'{self.document_type} - {self.transaction_series} ({self.prefix}{self.next_number})'


from django.db.models.signals import pre_save, post_save
from django.dispatch import receiver
from django.contrib.auth import get_user_model

@receiver(pre_save, sender=settings.AUTH_USER_MODEL)
def enforce_user_email_uniqueness_and_normalization(sender, instance, **kwargs):
    if instance.email:
        norm = instance.email.strip().lower()
        instance.email = norm
        User = get_user_model()
        qs = User.objects.filter(email__iexact=norm)
        if instance.pk:
            qs = qs.exclude(pk=instance.pk)
        if qs.exists():
            from django.core.exceptions import ValidationError
            raise ValidationError("An account with this email address already exists. Please log in instead.")

@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def sync_user_profile_normalized_email(sender, instance, created, **kwargs):
    if hasattr(instance, 'profile') and instance.profile:
        norm = (instance.email or '').strip().lower()
        if instance.profile.normalized_email != norm:
            instance.profile.normalized_email = norm
            instance.profile.save(update_fields=['normalized_email'])



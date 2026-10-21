from decimal import Decimal

from django.conf import settings
from django.db import models

MONEY = {'max_digits': 14, 'decimal_places': 2}
QTY = {'max_digits': 14, 'decimal_places': 3}


class Organization(models.Model):
    """Single-tenant company profile (always pk=1)."""
    name = models.CharField(max_length=200, default='Convosis Technologies Pvt Ltd')
    company_id = models.CharField(max_length=100, blank=True, default='U62090KL2026PTC103900', help_text='CIN / Registration number')
    gstin = models.CharField(max_length=15, blank=True, default='32AANCC9298C1ZE')
    state = models.CharField(max_length=60, default='Kerala', help_text='Home state; drives CGST/SGST vs IGST.')
    address = models.TextField(blank=True, default='Technolodge Phase II\nKMC 24/222, Anugraha Medical Complex Building')
    city = models.CharField(max_length=100, blank=True, default='Kottayam')
    pincode = models.CharField(max_length=20, blank=True, default='686003')
    country = models.CharField(max_length=100, blank=True, default='India')
    phone = models.CharField(max_length=50, blank=True, default='91-9847017737')
    email = models.EmailField(blank=True, default='admin@convosis.com')
    website = models.CharField(max_length=200, blank=True, default='www.convosis.com')
    logo_data = models.TextField(blank=True, default='/static/books/img/convosis-logo.png')
    template_theme = models.CharField(max_length=50, blank=True, default='convosis')
    template_color = models.CharField(max_length=30, blank=True, default='#1877f2')
    signature_title = models.CharField(max_length=100, blank=True, default='Authorized Signature')
    notes_default = models.TextField(blank=True, default='Thanks for your business.')
    terms_default = models.TextField(blank=True, default='Due on Receipt')
    opening_cash = models.DecimalField(default=Decimal('0.00'), **MONEY)

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def get(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def __str__(self):
        return self.name


class Sequence(models.Model):
    key = models.CharField(max_length=20, primary_key=True)
    value = models.PositiveIntegerField(default=0)


class Party(models.Model):
    name = models.CharField(max_length=200)
    company = models.CharField(max_length=200, blank=True)
    contact_person = models.CharField(max_length=120, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=20, blank=True)
    billing_address = models.TextField(blank=True)
    state = models.CharField(max_length=60, blank=True)
    gstin = models.CharField(max_length=15, blank=True)
    pan = models.CharField(max_length=10, blank=True)
    payment_terms = models.PositiveSmallIntegerField(default=30, help_text='Days')
    notes = models.TextField(blank=True)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        abstract = True
        ordering = ['name']

    def __str__(self):
        return self.name


class Customer(Party):
    shipping_address = models.TextField(blank=True)


class Vendor(Party):
    pass


class Item(models.Model):
    GOODS, SERVICE = 'goods', 'service'
    name = models.CharField(max_length=200)
    sku = models.CharField(max_length=60, unique=True)
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
    number = models.CharField(max_length=30, unique=True)
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
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class Invoice(Document):
    customer = models.ForeignKey(Customer, on_delete=models.PROTECT, related_name='invoices')
    terms = models.TextField(blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return self.number


class Bill(Document):
    vendor = models.ForeignKey(Vendor, on_delete=models.PROTECT, related_name='bills')
    vendor_ref = models.CharField(max_length=60, blank=True)

    def __str__(self):
        return self.number


class Line(models.Model):
    item = models.ForeignKey(Item, null=True, blank=True, on_delete=models.PROTECT, related_name='+')
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
    number = models.CharField(max_length=30, unique=True)
    date = models.DateField()
    mode = models.CharField(max_length=20, choices=MODES, default='bank_transfer')
    account = models.CharField(max_length=60, default='Bank Account')
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
    payment = models.ForeignKey(PaymentReceived, on_delete=models.CASCADE, related_name='allocations')
    invoice = models.ForeignKey(Invoice, on_delete=models.PROTECT, related_name='allocations')
    amount = models.DecimalField(**MONEY)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['payment', 'invoice'], name='uniq_received_alloc')]


class BillAllocation(models.Model):
    payment = models.ForeignKey(PaymentMade, on_delete=models.CASCADE, related_name='allocations')
    bill = models.ForeignKey(Bill, on_delete=models.PROTECT, related_name='allocations')
    amount = models.DecimalField(**MONEY)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['payment', 'bill'], name='uniq_bill_alloc')]


class StockMovement(models.Model):
    KINDS = [('opening', 'Opening stock'), ('sale', 'Sale'), ('sale_void', 'Sale voided'),
             ('purchase', 'Purchase'), ('purchase_void', 'Purchase voided'), ('adjustment', 'Adjustment')]
    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name='movements')
    date = models.DateField()
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
    ASSET, LIABILITY, EQUITY, INCOME, EXPENSE = 'asset', 'liability', 'equity', 'income', 'expense'
    TYPES = [
        (ASSET, 'Asset'),
        (LIABILITY, 'Liability'),
        (EQUITY, 'Equity'),
        (INCOME, 'Income'),
        (EXPENSE, 'Expense'),
    ]

    code = models.CharField(max_length=30, unique=True)
    name = models.CharField(max_length=150)
    account_type = models.CharField(max_length=20, choices=TYPES)
    sub_type = models.CharField(max_length=60, blank=True, default='') 
    description = models.TextField(blank=True)
    is_system = models.BooleanField(default=False)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['code', 'name']

    def __str__(self):
        return f'{self.code} - {self.name}'


class Journal(models.Model):
    number = models.CharField(max_length=40, unique=True)
    date = models.DateField()
    entry_type = models.CharField(max_length=40, default='manual') 
    reference = models.CharField(max_length=80, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')

    class Meta:
        ordering = ['-date', '-id']

    def __str__(self):
        return f'{self.number} ({self.date})'


class JournalItem(models.Model):
    journal = models.ForeignKey(Journal, on_delete=models.CASCADE, related_name='items')
    account = models.ForeignKey(Account, on_delete=models.PROTECT, related_name='journal_items')
    debit = models.DecimalField(default=Decimal('0.00'), **MONEY)
    credit = models.DecimalField(default=Decimal('0.00'), **MONEY)
    description = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ['id']


class LockDate(models.Model):
    """Enforce transaction locking prior to this date for compliance and auditing."""
    lock_date = models.DateField()
    reason = models.CharField(max_length=255, blank=True, default='Books closed for accounting period')
    updated_at = models.DateTimeField(auto_now=True)
    locked_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')

    @classmethod
    def get_lock(cls):
        return cls.objects.first()


class AuditLog(models.Model):
    """Immutable statutory audit trail of all transactions and system events."""
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    username = models.CharField(max_length=150, blank=True)
    action = models.CharField(max_length=50)  
    entity_type = models.CharField(max_length=60)
    entity_id = models.CharField(max_length=60, blank=True)
    summary = models.TextField()
    details = models.JSONField(default=dict, blank=True)
    ip_address = models.CharField(max_length=50, blank=True)
    record_hash = models.CharField(max_length=64, blank=True, default='')
    prev_hash = models.CharField(max_length=64, blank=True, default='')

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f'[{self.timestamp:%Y-%m-%d %H:%M}] {self.action} {self.entity_type} #{self.entity_id}'


class CustomField(models.Model):
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
    name = models.CharField(max_length=100)
    url = models.URLField()
    secret = models.CharField(max_length=100, blank=True)
    events = models.CharField(max_length=255, default='*') 
    active = models.BooleanField(default=True)

class BankAccount(models.Model):
    SAVINGS, CURRENT, CREDIT_CARD = 'savings', 'current', 'credit_card'
    TYPES = [(SAVINGS, 'Savings Account'), (CURRENT, 'Current Account'), (CREDIT_CARD, 'Credit Card')]

    name = models.CharField(max_length=150)
    bank_name = models.CharField(max_length=100)
    account_number = models.CharField(max_length=50)
    ifsc = models.CharField(max_length=20, blank=True)
    account_type = models.CharField(max_length=20, choices=TYPES, default=CURRENT)
    currency = models.CharField(max_length=10, default='INR')
    opening_balance = models.DecimalField(default=Decimal('0.00'), **MONEY)
    current_balance = models.DecimalField(default=Decimal('0.00'), **MONEY)
    gl_account = models.ForeignKey(Account, null=True, blank=True, on_delete=models.SET_NULL, related_name='bank_accounts')
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f'{self.name} ({self.bank_name})'


class BankTransaction(models.Model):
    bank_account = models.ForeignKey(BankAccount, on_delete=models.CASCADE, related_name='transactions')
    date = models.DateField()
    description = models.CharField(max_length=300)
    reference = models.CharField(max_length=100, blank=True)
    withdrawal = models.DecimalField(default=Decimal('0.00'), **MONEY) 
    deposit = models.DecimalField(default=Decimal('0.00'), **MONEY)     
    balance = models.DecimalField(default=Decimal('0.00'), **MONEY)
    status = models.CharField(max_length=20, default='unreconciled')   
    matched_entity_type = models.CharField(max_length=40, blank=True)   
    matched_entity_id = models.PositiveIntegerField(null=True, blank=True)
    reconciled_at = models.DateTimeField(null=True, blank=True)
    transaction_hash = models.CharField(max_length=64, blank=True, default='', db_index=True)
    batch = models.ForeignKey('BankStatementBatch', null=True, blank=True, on_delete=models.SET_NULL, related_name='transactions')
    is_live_feed = models.BooleanField(default=False)

    class Meta:
        ordering = ['-date', '-id']


class DocumentFolder(models.Model):
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    color = models.CharField(max_length=30, blank=True, default='#1877f2')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class ManagedDocument(models.Model):
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
    expected_shipment_date = models.DateField(null=True, blank=True)
    terms = models.TextField(blank=True)


class SalesOrderLine(Line):
    order = models.ForeignKey(SalesOrder, on_delete=models.CASCADE, related_name='lines')


class RecurringInvoice(models.Model):
    FREQUENCIES = [('weekly', 'Weekly'), ('monthly', 'Monthly'), ('quarterly', 'Quarterly'), ('yearly', 'Yearly')]
    profile_name = models.CharField(max_length=150)
    customer = models.ForeignKey(Customer, on_delete=models.PROTECT, related_name='recurring_invoices')
    frequency = models.CharField(max_length=20, choices=FREQUENCIES, default='monthly')
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    next_date = models.DateField()
    status = models.CharField(max_length=20, default='active')
    subtotal = models.DecimalField(default=Decimal('0.00'), **MONEY)
    total = models.DecimalField(default=Decimal('0.00'), **MONEY)
    lines_data = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)


class RetainerInvoice(Document):
    customer = models.ForeignKey(Customer, on_delete=models.PROTECT, related_name='retainer_invoices')
    applied_amount = models.DecimalField(default=Decimal('0.00'), **MONEY)


class RetainerInvoiceLine(Line):
    retainer = models.ForeignKey(RetainerInvoice, on_delete=models.CASCADE, related_name='lines')


class DeliveryChallan(models.Model):
    CHALLAN_TYPES = [('supply_on_approval', 'Supply on Approval'), ('job_work', 'Job Work'), ('other', 'Other')]
    number = models.CharField(max_length=40, unique=True)
    customer = models.ForeignKey(Customer, on_delete=models.PROTECT, related_name='delivery_challans')
    date = models.DateField()
    challan_type = models.CharField(max_length=40, choices=CHALLAN_TYPES, default='other')
    status = models.CharField(max_length=20, default='open')
    vehicle_number = models.CharField(max_length=50, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)


class DeliveryChallanLine(models.Model):
    challan = models.ForeignKey(DeliveryChallan, on_delete=models.CASCADE, related_name='lines')
    item = models.ForeignKey(Item, null=True, blank=True, on_delete=models.PROTECT, related_name='+')
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
    delivery_date = models.DateField(null=True, blank=True)


class PurchaseOrderLine(Line):
    order = models.ForeignKey(PurchaseOrder, on_delete=models.CASCADE, related_name='lines')


class Expense(models.Model):
    number = models.CharField(max_length=40, unique=True)
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
    invoice = models.OneToOneField(Invoice, on_delete=models.CASCADE, related_name='einvoice')
    irn = models.CharField(max_length=64, unique=True)
    ack_no = models.CharField(max_length=30)
    ack_date = models.DateTimeField()
    signed_qr_code = models.TextField(blank=True)
    status = models.CharField(max_length=20, default='generated')
    created_at = models.DateTimeField(auto_now_add=True)



class Project(models.Model):
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
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class PriceList(models.Model):
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
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=30, unique=True)
    address = models.TextField(blank=True)
    city = models.CharField(max_length=100, blank=True)
    state = models.CharField(max_length=60, blank=True)
    is_primary = models.BooleanField(default=False)
    active = models.BooleanField(default=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f'{self.name} ({self.code})'



class PaymentTransaction(models.Model):
    gateway = models.CharField(max_length=40, default='razorpay')
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
    name = models.CharField(max_length=150)
    priority = models.PositiveSmallIntegerField(default=10)
    field = models.CharField(max_length=40, default='description')
    operator = models.CharField(max_length=20, default='contains')
    value = models.CharField(max_length=200)
    assign_account = models.ForeignKey(Account, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    assign_party_type = models.CharField(max_length=20, blank=True)
    assign_party_id = models.PositiveIntegerField(null=True, blank=True)
    auto_reconcile = models.BooleanField(default=False)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['priority', 'name']

    def __str__(self):
        return f'{self.name} ({self.field} {self.operator} "{self.value}")'



class GSTRReturn(models.Model):
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


class UserProfile(models.Model):
    ADMIN, ACCOUNTANT, AUDITOR, CASHIER, PORTAL = 'admin', 'accountant', 'auditor', 'cashier', 'portal'
    ROLES = [
        (ADMIN, 'Administrator (Full Access)'),
        (ACCOUNTANT, 'Standard Accountant'),
        (AUDITOR, 'Statutory Auditor (Read-Only)'),
        (CASHIER, 'Billing Operator & Cashier'),
        (PORTAL, 'Customer/Vendor Portal User'),
    ]

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='profile')
    role = models.CharField(max_length=30, choices=ROLES, default=ADMIN)
    phone = models.CharField(max_length=30, blank=True)
    mfa_enabled = models.BooleanField(default=True)
    mfa_secret = models.CharField(max_length=64, blank=True, default='')
    backup_codes = models.JSONField(default=list, blank=True)
    last_active_ip = models.CharField(max_length=50, blank=True)
    is_locked = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.user.username} ({self.role})'


class SecurityBackupRecord(models.Model):
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
    token = models.CharField(max_length=64, unique=True)
    vendor = models.OneToOneField(Vendor, on_delete=models.CASCADE, related_name='portal_access')
    is_active = models.BooleanField(default=True)
    allow_bill_upload = models.BooleanField(default=True)
    last_login_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'Portal for {self.vendor.name}'


class Notification(models.Model):
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
    STARTER, GROWTH, ENTERPRISE = 'starter', 'growth', 'enterprise'
    TIERS = [
        (STARTER, 'Starter Edition (Small Business)'),
        (GROWTH, 'Growth Edition (Mid-Market)'),
        (ENTERPRISE, 'Enterprise Scale Edition (Multi-GSTIN)'),
    ]

    tier = models.CharField(max_length=30, choices=TIERS, default=GROWTH)
    billing_cycle = models.CharField(max_length=20, default='annual')
    status = models.CharField(max_length=20, default='active')
    invoice_limit = models.PositiveIntegerField(default=1000)
    user_seat_limit = models.PositiveIntegerField(default=15)
    storage_limit_mb = models.PositiveIntegerField(default=10240)
    period_start = models.DateField(null=True, blank=True)
    period_end = models.DateField(null=True, blank=True)
    auto_renew = models.BooleanField(default=True)
    payment_method = models.CharField(max_length=50, default='Visa ending in 4242')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.tier} ({self.status})'


class DeveloperApiKey(models.Model):
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




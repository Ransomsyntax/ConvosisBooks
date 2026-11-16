from decimal import Decimal
from datetime import timedelta
from django.test import TestCase, Client
from django.contrib.auth import get_user_model
from django.utils import timezone
from books.models import Organization, Customer, Item, RecurringInvoice, RetainerInvoice, Quote, UserProfile
from books import services

User = get_user_model()

class StandardizedModulesTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='std_user', email='std_user@example.com', password='password123')
        self.org = Organization.objects.create(name='Standard Org', owner=self.user, state='Kerala')
        UserProfile.objects.create(user=self.user, organization=self.org, role='admin', normalized_email='std_user@example.com')
        self.customer = Customer.objects.create(name='Standard Client', organization=self.org, state='Kerala')
        self.item = Item.objects.create(name='Standard Service', selling_price=Decimal('1000.00'), organization=self.org)
        self.client = Client()
        self.client.force_login(self.user)

    def test_recurring_invoice_never_ends_and_generation(self):
        """Test recurring invoice created with never_ends=True, end_date=None, and invoice generation."""
        today = timezone.localdate()
        payload = {
            'profile_name': 'Indefinite Support Plan',
            'customer': self.customer.id,
            'frequency': 'monthly',
            'start_date': today.isoformat(),
            'next_date': today.isoformat(),
            'never_ends': True,
            'payment_terms': 15,
            'status': 'active',
            'lines': [
                {
                    'item': self.item.id,
                    'description': 'Monthly Retainer Maintenance',
                    'quantity': 2,
                    'rate': 1000.00,
                    'discount_percent': 0,
                    'gst_rate': 18
                }
            ]
        }
        resp = self.client.post('/api/recurring-invoices/', payload, content_type='application/json')
        self.assertEqual(resp.status_code, 201)
        data = resp.json()
        self.assertEqual(data['profile_name'], 'Indefinite Support Plan')
        self.assertIsNone(data.get('end_date'))
        self.assertTrue(data.get('never_ends'))

        rec_profile = RecurringInvoice.objects.get(pk=data['id'])
        self.assertIsNone(rec_profile.end_date)

        # Generate invoice
        gen_resp = self.client.post(f"/api/recurring-invoices/{rec_profile.id}/generate-invoice/", {}, content_type='application/json')
        self.assertEqual(gen_resp.status_code, 200)
        gen_data = gen_resp.json()
        self.assertTrue(gen_data.get('success'))

        rec_profile.refresh_from_db()
        self.assertEqual(rec_profile.status, 'active') # Continues indefinitely
        self.assertGreater(rec_profile.next_date, today)

    def test_retainer_invoice_purpose(self):
        """Test retainer invoice purpose field mapping and retrieval."""
        today = timezone.localdate()
        payload = {
            'customer': self.customer.id,
            'date': today.isoformat(),
            'due_date': (today + timedelta(days=30)).isoformat(),
            'purpose': 'Upfront retainer advance for Q4 software engineering',
            'lines': [
                {
                    'item': self.item.id,
                    'description': 'Advance Engineering Retainer',
                    'quantity': 1,
                    'rate': 25000.00,
                    'discount_percent': 0,
                    'gst_rate': 18
                }
            ]
        }
        resp = self.client.post('/api/retainer-invoices/', payload, content_type='application/json')
        self.assertEqual(resp.status_code, 201)
        data = resp.json()
        self.assertEqual(data.get('purpose'), 'Upfront retainer advance for Q4 software engineering')

        ret = RetainerInvoice.objects.get(pk=data['id'])
        self.assertEqual(ret.notes, 'Upfront retainer advance for Q4 software engineering')

        # Detail fetch
        get_resp = self.client.get(f"/api/retainer-invoices/{ret.id}/")
        self.assertEqual(get_resp.status_code, 200)
        self.assertEqual(get_resp.json().get('purpose'), 'Upfront retainer advance for Q4 software engineering')

    def test_retainer_invoice_purpose_preserves_explicit_customer_notes(self):
        today = timezone.localdate()
        payload = {
            'customer': self.customer.id,
            'date': today.isoformat(),
            'due_date': (today + timedelta(days=30)).isoformat(),
            'purpose': 'Project advance',
            'notes': 'Please include the project code on remittance.',
            'lines': [{'description': 'Retainer', 'quantity': 1, 'rate': 100, 'gst_rate': 0}]
        }

        response = self.client.post('/api/retainer-invoices/', payload, content_type='application/json')

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json().get('purpose'), 'Project advance')
        retainer = RetainerInvoice.objects.get(pk=response.json()['id'])
        self.assertEqual(retainer.notes, 'Please include the project code on remittance.')

    def test_quote_creation_and_fields(self):
        """Test quote creation with standard full-page fields."""
        today = timezone.localdate()
        payload = {
            'customer': self.customer.id,
            'date': today.isoformat(),
            'expiry_date': (today + timedelta(days=15)).isoformat(),
            'reference_number': 'REF-Q-001',
            'subject': 'Project Quotation for Mobile App',
            'lines': [
                {
                    'item': self.item.id,
                    'description': 'UI/UX Design & Implementation',
                    'quantity': 1,
                    'rate': 5000.00,
                    'discount_percent': 10,
                    'gst_rate': 18
                }
            ]
        }
        resp = self.client.post('/api/quotes/', payload, content_type='application/json')
        self.assertEqual(resp.status_code, 201)
        data = resp.json()
        self.assertEqual(data.get('subject'), 'Project Quotation for Mobile App')
        self.assertEqual(data.get('reference_number'), 'REF-Q-001')
        self.assertEqual(Quote.objects.filter(pk=data['id']).count(), 1)

    def test_quote_and_so_customer_data_integration(self):
        """Test customer type and place of supply fetched from Customer master for Quotes and Sales Orders."""
        b2b_cust = Customer.objects.create(
            name='Acme Corp B2B', organization=self.org,
            customer_type='business', gstin='32AAACB1234F1Z1', state='Tamil Nadu'
        )
        today = timezone.localdate()

        # Quote inheriting customer details
        q_payload = {
            'customer': b2b_cust.id,
            'date': today.isoformat(),
            'expiry_date': (today + timedelta(days=15)).isoformat(),
            'customer_type': 'b2b',
            'place_of_supply': b2b_cust.state,
            'lines': [{'item': self.item.id, 'quantity': 1, 'rate': 1000.00, 'gst_rate': 18}]
        }
        q_resp = self.client.post('/api/quotes/', q_payload, content_type='application/json')
        self.assertEqual(q_resp.status_code, 201)
        q_data = q_resp.json()
        self.assertEqual(q_data.get('customer_type'), 'b2b')
        self.assertEqual(q_data.get('place_of_supply'), 'Tamil Nadu')

        # Sales Order inheriting customer details
        so_payload = {
            'customer': b2b_cust.id,
            'date': today.isoformat(),
            'customer_type': 'b2b',
            'place_of_supply': b2b_cust.state,
            'lines': [{'item': self.item.id, 'quantity': 1, 'rate': 1000.00, 'gst_rate': 18}]
        }
        so_resp = self.client.post('/api/sales-orders/', so_payload, content_type='application/json')
        self.assertEqual(so_resp.status_code, 201)
        so_data = so_resp.json()
        self.assertEqual(so_data.get('customer_type'), 'b2b')
        self.assertEqual(so_data.get('place_of_supply'), 'Tamil Nadu')

    def test_js_forms_standardized_three_card_layouts(self):
        """Verify Delivery Challan and Payments Received implement the Three-Card layout and Customer Name outside."""
        from pathlib import Path
        js_path = Path(__file__).resolve().parent / 'static' / 'books' / 'js' / 'forms.js'
        content = js_path.read_text(encoding='utf-8')

        # Delivery Challan: customer name outside & three card layout
        self.assertIn('.dc-three-cards-grid', content)
        self.assertIn('for="dc-customer">Customer Name*</label>', content)
        self.assertIn('1. Customer Details</h3>', content)
        self.assertIn('2. Account &amp; Movement Details</h3>', content)
        self.assertIn('3. Delivery Challan Details</h3>', content)

        # Payment Received: customer name outside & three card layout
        self.assertIn('.pay-three-cards-grid', content)
        self.assertIn('for="pay-customer">Customer Name*</label>', content)
        self.assertIn('1. Customer Details</h3>', content)
        self.assertIn('2. Account Details</h3>', content)
        self.assertIn('3. Payment Details</h3>', content)

        # Quotes: customer type and location removed from visible user inputs
        self.assertIn('id="q-customer-type" name="customer_type"', content)
        self.assertIn('type="hidden" id="q-customer-type"', content)
        self.assertIn('type="hidden" id="q-location"', content)

        # Sales Orders: customer type and location removed from visible user inputs
        self.assertIn('id="so-customer-type" name="customer_type"', content)
        self.assertIn('type="hidden" id="so-customer-type"', content)
        self.assertIn('type="hidden" id="so-location"', content)

    def test_js_forms_purchase_modules_three_card_layouts(self):
        """Verify Expenses, Purchase Orders, Bills, and Payments Made implement the Three-Card layout and Vendor Name outside."""
        from pathlib import Path
        js_path = Path(__file__).resolve().parent / 'static' / 'books' / 'js' / 'forms.js'
        content = js_path.read_text(encoding='utf-8')

        # 1. Purchases -> Expenses
        self.assertIn('.exp-three-cards-grid', content)
        self.assertIn('for="exp-vendor">Vendor / Payee</label>', content)
        self.assertIn('1. Vendor Details</h3>', content)
        self.assertIn('2. Account Details</h3>', content)
        self.assertIn('3. Expense Details</h3>', content)
        self.assertIn('id="btn-exp-vendor-lookup"', content)
        self.assertIn('id="btn-exp-num-pref"', content)
        self.assertIn('id="exp-sum-total"', content)

        # 2. Purchases -> Purchase Orders
        self.assertIn('.po-three-cards-grid', content)
        self.assertIn('for="po-vendor">Vendor Name*</label>', content)
        self.assertIn('1. Vendor Details</h3>', content)
        self.assertIn('2. Account Details</h3>', content)
        self.assertIn('3. Purchase Order Details</h3>', content)
        self.assertIn('id="btn-po-vendor-lookup"', content)
        self.assertIn('id="btn-po-num-pref"', content)
        self.assertIn('btn-po-tax-mode', content)

        # 3. Purchases -> Bills
        self.assertIn('.bill-three-cards-grid', content)
        self.assertIn('for="bill-vendor">Vendor Name*</label>', content)
        self.assertIn('1. Vendor Details</h3>', content)
        self.assertIn('2. Account Details</h3>', content)
        self.assertIn('3. Bill Details</h3>', content)
        self.assertIn('id="btn-bill-vendor-lookup"', content)
        self.assertIn('id="btn-bill-num-pref"', content)
        self.assertIn('btn-bill-tax-mode', content)

        # 4. Purchases -> Payments Made
        self.assertIn('.paym-three-cards-grid', content)
        self.assertIn('for="pay-vendor">Vendor Name*</label>', content)
        self.assertIn('1. Vendor Details</h3>', content)
        self.assertIn('2. Account Details</h3>', content)
        self.assertIn('3. Payment Details</h3>', content)
        self.assertIn('id="btn-pay-vendor-lookup"', content)
        self.assertIn('id="btn-paym-num-pref"', content)
        self.assertIn('id="alloc"', content)

    def test_purchase_modules_backend_operations(self):
        """Verify Expense, Purchase Order, Bill, and Payment Made backend workflow operations."""
        from books.models import Vendor, Account, Expense, PurchaseOrder, Bill, BankAccount, PaymentMade
        today = timezone.localdate()
        vendor = Vendor.objects.create(name='Test Tech Supplies', organization=self.org, state='Kerala', gstin='32AAAAA0000A1Z5')
        exp_acc = Account.objects.filter(organization=self.org, account_type='expense').first()
        if not exp_acc:
            exp_acc = Account.objects.create(name='Office Supplies', code='5001', account_type='expense', organization=self.org)

        # Test Expense creation (with optional vendor)
        exp_resp = self.client.post('/api/expenses/', {
            'date': today.isoformat(),
            'expense_account': exp_acc.id,
            'vendor': vendor.id,
            'amount': 1500.00,
            'gst_rate': 18,
            'paid_through': 'Bank Account',
            'reference': 'RCPT-101',
            'notes': 'Quarterly supplies'
        }, content_type='application/json')
        self.assertEqual(exp_resp.status_code, 201)
        self.assertEqual(exp_resp.json()['vendor_id'], vendor.id)

        # Test Direct Expense creation (no vendor)
        direct_resp = self.client.post('/api/expenses/', {
            'date': today.isoformat(),
            'expense_account': exp_acc.id,
            'vendor': '',
            'amount': 250.00,
            'gst_rate': 0,
            'paid_through': 'Petty Cash',
            'reference': 'CASH-001',
            'notes': 'Tea and refreshments'
        }, content_type='application/json')
        self.assertEqual(direct_resp.status_code, 201)
        self.assertIsNone(direct_resp.json()['vendor_id'])

        # Test Purchase Order creation
        po_resp = self.client.post('/api/purchase-orders/', {
            'vendor': vendor.id,
            'date': today.isoformat(),
            'delivery_date': (today + timedelta(days=7)).isoformat(),
            'tax_pricing_type': 'tax_exclusive',
            'lines': [{'item': self.item.id, 'quantity': 5, 'rate': 800.00, 'gst_rate': 18}]
        }, content_type='application/json')
        self.assertEqual(po_resp.status_code, 201)

        # Test Bill creation
        bill_resp = self.client.post('/api/bills/', {
            'vendor': vendor.id,
            'date': today.isoformat(),
            'due_date': (today + timedelta(days=30)).isoformat(),
            'tax_pricing_type': 'tax_exclusive',
            'lines': [{'item': self.item.id, 'quantity': 2, 'rate': 800.00, 'gst_rate': 18}]
        }, content_type='application/json')
        self.assertEqual(bill_resp.status_code, 201)
        bill_id = bill_resp.json()['id']

        # Test Payment Made creation
        bank_acc = BankAccount.objects.create(name='Kotak Primary', bank_name='Kotak Mahindra', account_number='1234567890', organization=self.org)
        pay_resp = self.client.post('/api/payments-made/', {
            'vendor': vendor.id,
            'date': today.isoformat(),
            'amount': 1888.00,
            'mode': 'bank_transfer',
            'bank_account_id': bank_acc.id,
            'reference': 'UTR-987654321',
            'allocations': [{'bill': bill_id, 'amount': 1888.00}]
        }, content_type='application/json')
        self.assertEqual(pay_resp.status_code, 201)
        self.assertEqual(PaymentMade.objects.filter(pk=pay_resp.json()['id']).count(), 1)

    def test_tax_mode_selector_and_guide_alignment(self):
        """Verify Tax Exclusive / Tax Inclusive dropdown and Guide button are aligned with Item Table heading across forms."""
        from pathlib import Path
        js_path = Path(__file__).resolve().parent / 'static' / 'books' / 'js' / 'forms.js'
        content = js_path.read_text(encoding='utf-8')

        # Invoices: Item Table heading + inv-tax-pricing dropdown + Guide button in one horizontal row
        self.assertIn('id="inv-tax-pricing"', content)
        self.assertIn('data-doc-kind="invoices"', content)
        self.assertIn('id="btn-inv-scan"', content)
        self.assertIn('id="btn-inv-bulk-actions"', content)

        # Quotes: Item Table heading + q-tax-pricing dropdown + Guide button
        self.assertIn('id="q-tax-pricing"', content)
        self.assertIn('data-doc-kind="quotes"', content)
        self.assertIn('id="btn-quote-scan"', content)
        self.assertIn('id="btn-quote-bulk-actions"', content)

        # Sales Orders: Item Table heading + so-tax-pricing dropdown + Guide button
        self.assertIn('id="so-tax-pricing"', content)
        self.assertIn('data-doc-kind="sales-orders"', content)
        self.assertIn('id="btn-so-scan"', content)
        self.assertIn('id="btn-so-bulk-actions"', content)

        # Bills: Item Table heading + bill-tax-pricing dropdown + Guide button
        self.assertIn('id="bill-tax-pricing"', content)
        self.assertIn('data-doc-kind="bills"', content)
        self.assertIn('id="btn-bill-scan"', content)
        self.assertIn('id="btn-bill-bulk-actions"', content)

        # Purchase Orders: Item Table heading + po-tax-pricing dropdown + Guide button
        self.assertIn('id="po-tax-pricing"', content)
        self.assertIn('data-doc-kind="purchase-orders"', content)
        self.assertIn('id="btn-po-scan"', content)
        self.assertIn('id="btn-po-bulk-actions"', content)

        # Recurring Invoices: Item Table heading + rec-tax-pricing dropdown + Guide button
        self.assertIn('id="rec-tax-pricing"', content)
        self.assertIn('data-doc-kind="recurring-invoices"', content)
        self.assertIn('id="btn-rec-scan"', content)
        self.assertIn('id="btn-rec-bulk-actions"', content)

        # Delivery Challans: Item Table heading + dc-tax-pricing dropdown + Guide button
        self.assertIn('id="dc-tax-pricing"', content)
        self.assertIn('data-doc-kind="delivery-challans"', content)
        self.assertIn('id="dc-add-bulk"', content)

        # CSS and styling checks
        self.assertIn('.tax-pricing-select', content)
        self.assertIn('.btn-tax-pricing-info', content)


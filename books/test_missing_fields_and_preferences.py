from decimal import Decimal
from django.test import TestCase, Client
from django.contrib.auth.models import User
from books.models import (
    Organization, UserProfile, Customer, Vendor, Item,
    Invoice, Quote, SalesOrder, RecurringInvoice, RetainerInvoice, Bill, PurchaseOrder,
    Salesperson, DocumentNumberPreference
)
from books.services import next_document_number, preview_document_number, generate_invoice_from_recurring_profile
import json


class MissingFieldsAndPreferencesTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='testadmin',
            email='testadmin@convosis.com',
            password='Password123!'
        )
        self.org = Organization.objects.create(
            name='Test Org',
            code='TST',
            owner=self.user,
            state='Kerala'
        )
        self.profile = UserProfile.objects.create(
            user=self.user,
            organization=self.org,
            role='admin'
        )
        self.client = Client()
        self.client.force_login(self.user)

        self.customer = Customer.objects.create(
            organization=self.org,
            name='Acme Corp',
            email='acme@example.com',
            gstin='32AAAAA0000A1Z5',
            customer_type='business',
            state='Kerala'
        )
        self.vendor = Vendor.objects.create(
            organization=self.org,
            name='Global Supplies',
            email='vendor@example.com',
            gstin='32BBBBB1111B1Z2',
            state='Kerala'
        )
        self.item = Item.objects.create(
            organization=self.org,
            name='Consulting Service',
            item_type=Item.SERVICE,
            selling_price=Decimal('1500.00'),
            purchase_price=Decimal('1000.00'),
            gst_rate=Decimal('18.00'),
            track_inventory=False
        )

    def test_salesperson_model_and_api(self):
        # Create via model
        sp = Salesperson.objects.create(
            organization=self.org,
            name='John Doe',
            email='john@convosis.com',
            phone='9876543210'
        )
        self.assertEqual(sp.name, 'John Doe')
        self.assertTrue(sp.is_active)

        # GET /api/salespersons/
        res = self.client.get('/api/salespersons/')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        raw_list = data.get('results', data) if isinstance(data, dict) else data
        names = [s if isinstance(s, str) else s.get('name') for s in raw_list]
        self.assertIn('John Doe', names)

        # POST /api/salespersons/
        post_res = self.client.post(
            '/api/salespersons/',
            data=json.dumps({'name': 'Jane Smith', 'email': 'jane@convosis.com'}),
            content_type='application/json'
        )
        self.assertEqual(post_res.status_code, 201)
        self.assertTrue(Salesperson.objects.filter(organization=self.org, name='Jane Smith').exists())

    def test_doc_number_preference_and_service(self):
        # Configure preference
        pref = DocumentNumberPreference.objects.create(
            organization=self.org,
            document_type='invoices',
            transaction_series='Default Transaction Series',
            location='HO Kottayam',
            auto_generate=True,
            prefix='INV/${YEAR}/',
            next_number='0001',
            restart_yearly=True
        )

        pfx = preview_document_number('invoices', self.org, series='Default Transaction Series')
        self.assertIn('INV/', pfx['next_number'])
        self.assertIn('00001', pfx['next_number'])

        # Next number generation advances next_number
        num1 = next_document_number('invoices', self.org, series='Default Transaction Series')
        self.assertIn('00001', num1)

        pref.refresh_from_db()
        self.assertEqual(pref.next_number, 2)

        # Test settings endpoint
        get_res = self.client.get('/api/document-number-preferences/?kind=invoices&series=Default%20Transaction%20Series')
        self.assertEqual(get_res.status_code, 200)
        self.assertEqual(get_res.json()['prefix'], 'INV/${YEAR}/')

    def test_create_documents_with_all_missing_fields(self):
        # 1. Invoice
        inv = Invoice.objects.create(
            organization=self.org,
            customer=self.customer,
            number='TST/INV/0001',
            date='2026-11-10',
            due_date='2026-12-10',
            location='HO Kottayam',
            transaction_series='Default Transaction Series',
            order_number='ORD-999',
            salesperson='John Doe',
            project_name='Project Phoenix',
            subject='Professional Cloud Services',
            accounts_receivable='Accounts Receivable',
            tax_pricing_type='tax_exclusive',
            customer_type='b2b'
        )
        self.assertEqual(inv.location, 'HO Kottayam')
        self.assertEqual(inv.order_number, 'ORD-999')
        self.assertEqual(inv.salesperson, 'John Doe')
        self.assertEqual(inv.accounts_receivable, 'Accounts Receivable')

        # 2. Quote
        q = Quote.objects.create(
            organization=self.org,
            customer=self.customer,
            number='TST/QT/0001',
            date='2026-11-10',
            due_date='2026-12-10',
            expiry_date='2026-12-10',
            location='HO Kottayam',
            transaction_series='Default Transaction Series',
            order_number='ORD-QUOTE-1',
            salesperson='John Doe',
            project_name='Project Phoenix',
            subject='Quote for Cloud Migration'
        )
        self.assertEqual(q.location, 'HO Kottayam')
        self.assertEqual(q.order_number, 'ORD-QUOTE-1')

        # 3. Sales Order
        so = SalesOrder.objects.create(
            organization=self.org,
            customer=self.customer,
            number='TST/SO/0001',
            date='2026-11-10',
            due_date='2026-11-20',
            expected_shipment_date='2026-11-20',
            location='HO Kottayam',
            transaction_series='Default Transaction Series',
            order_number='PO-CUST-88',
            salesperson='John Doe',
            project_name='Project Phoenix',
            subject='SO for Cloud Migration'
        )
        self.assertEqual(so.location, 'HO Kottayam')
        self.assertEqual(so.order_number, 'PO-CUST-88')

        # 4. Bill
        bill = Bill.objects.create(
            organization=self.org,
            vendor=self.vendor,
            number='BILL-0001',
            date='2026-11-10',
            due_date='2026-12-10',
            location='HO Kottayam',
            transaction_series='Default Transaction Series',
            order_number='PO-BUY-12',
            accounts_payable='Accounts Payable',
            project_name='Project Phoenix',
            subject='Bill for Hardware'
        )
        self.assertEqual(bill.location, 'HO Kottayam')
        self.assertEqual(bill.accounts_payable, 'Accounts Payable')

        # 5. Purchase Order
        po = PurchaseOrder.objects.create(
            organization=self.org,
            vendor=self.vendor,
            number='PO-0001',
            date='2026-11-10',
            due_date='2026-11-25',
            delivery_date='2026-11-25',
            location='HO Kottayam',
            transaction_series='Default Transaction Series',
            order_number='REF-PO-99',
            project_name='Project Phoenix',
            subject='PO for Supplies'
        )
        self.assertEqual(po.location, 'HO Kottayam')
        self.assertEqual(po.order_number, 'REF-PO-99')

        # 6. Retainer Invoice
        ret = RetainerInvoice.objects.create(
            organization=self.org,
            customer=self.customer,
            number='RET-0001',
            date='2026-11-10',
            due_date='2026-11-10',
            location='HO Kottayam',
            transaction_series='Default Transaction Series',
            order_number='REC-RET-01',
            accounts_receivable='Accounts Receivable',
            salesperson='John Doe',
            project_name='Project Phoenix',
            subject='Retainer Advance'
        )
        self.assertEqual(ret.accounts_receivable, 'Accounts Receivable')
        self.assertEqual(ret.salesperson, 'John Doe')

    def test_recurring_invoice_generation_and_draft_preference(self):
        rec = RecurringInvoice.objects.create(
            organization=self.org,
            customer=self.customer,
            profile_name='Monthly Maintenance',
            order_number='REC-001',
            location='HO Kottayam',
            salesperson='John Doe',
            project_name='Project Phoenix',
            subject='Monthly Server Maintenance',
            frequency='monthly',
            repeat_every=1,
            start_date='2026-11-10',
            next_date='2026-11-10',
            never_ends=True,
            payment_terms=0,
            create_as_draft=True
        )

        # Generate invoice from profile
        inv = generate_invoice_from_recurring_profile(rec, invoice_date='2026-11-10')
        self.assertIsNotNone(inv)
        self.assertEqual(inv.status, 'draft')
        self.assertEqual(inv.location, 'HO Kottayam')
        self.assertEqual(inv.salesperson, 'John Doe')
        self.assertEqual(inv.project_name, 'Project Phoenix')
        self.assertEqual(inv.subject, 'Monthly Server Maintenance')
        self.assertEqual(inv.order_number, 'REC-001')

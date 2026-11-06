import json
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from books.models import (
    Customer, DeliveryChallan, Invoice, InvoiceLine, Item, Organization,
    Quote, QuoteLine, UserProfile, Vendor, Bill, BillLine
)

User = get_user_model()

class SignatureFlowTestCase(TestCase):
    def setUp(self):
        self.org1 = Organization.objects.create(name='Org Alpha', company_id='org-alpha', state='Kerala')
        self.org2 = Organization.objects.create(name='Org Beta', company_id='org-beta', state='Maharashtra')

        self.user1 = User.objects.create_user(username='user1@alpha.com', password='password123', first_name='John', last_name='Doe')
        UserProfile.objects.create(user=self.user1, organization=self.org1, role='admin')

        self.user2 = User.objects.create_user(username='user2@beta.com', password='password123', first_name='Jane', last_name='Smith')
        UserProfile.objects.create(user=self.user2, organization=self.org2, role='admin')

        self.customer1 = Customer.objects.create(name='Cust A', organization=self.org1)
        self.vendor1 = Vendor.objects.create(name='Ven A', organization=self.org1)
        self.item1 = Item.objects.create(name='Item A', selling_price=Decimal('100.00'), organization=self.org1)

        self.dummy_sig = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

    def test_invoice_sign_and_unsign(self):
        self.client.force_login(self.user1)
        inv = Invoice.objects.create(
            organization=self.org1,
            customer=self.customer1,
            number='INV-TEST-01',
            date=timezone.localdate(),
            due_date=timezone.localdate(),
            total=Decimal('100.00'),
            subtotal=Decimal('100.00')
        )
        InvoiceLine.objects.create(
            invoice=inv,
            item=self.item1,
            quantity=Decimal('1'),
            rate=Decimal('100.00'),
            taxable=Decimal('100.00'),
            tax_amount=Decimal('0.00'),
            line_total=Decimal('100.00')
        )

        # 1. Sign Invoice
        resp = self.client.post(
            f'/api/invoices/{inv.pk}/sign/',
            data=json.dumps({
                'signature_data': self.dummy_sig,
                'signed_by': 'John Doe',
                'signature_title': 'Managing Director'
            }),
            content_type='application/json'
        )
        self.assertEqual(resp.status_code, 200, resp.content)
        data = resp.json()
        self.assertEqual(data.get('status'), 'signed')
        self.assertEqual(data.get('signed_by'), 'John Doe')
        self.assertEqual(data.get('signature_title'), 'Managing Director')

        inv.refresh_from_db()
        self.assertEqual(inv.signature_data, self.dummy_sig)
        self.assertEqual(inv.signed_by, 'John Doe')
        self.assertEqual(inv.signature_title, 'Managing Director')
        self.assertIsNotNone(inv.signed_at)

        # Check in detail view
        resp_detail = self.client.get(f'/api/invoices/{inv.pk}/')
        self.assertEqual(resp_detail.status_code, 200)
        detail_data = resp_detail.json()
        self.assertEqual(detail_data.get('signature_data'), self.dummy_sig)
        self.assertEqual(detail_data.get('signed_by'), 'John Doe')

        # 2. Unsign Invoice
        resp_unsign = self.client.post(f'/api/invoices/{inv.pk}/unsign/')
        self.assertEqual(resp_unsign.status_code, 200)
        inv.refresh_from_db()
        self.assertEqual(inv.signature_data, '')
        self.assertEqual(inv.signed_by, '')
        self.assertIsNone(inv.signed_at)

    def test_bill_sign_and_unsign(self):
        self.client.force_login(self.user1)
        bill = Bill.objects.create(
            organization=self.org1,
            vendor=self.vendor1,
            number='BILL-TEST-01',
            date=timezone.localdate(),
            due_date=timezone.localdate(),
            total=Decimal('200.00'),
            subtotal=Decimal('200.00')
        )
        BillLine.objects.create(
            bill=bill,
            item=self.item1,
            quantity=Decimal('2'),
            rate=Decimal('100.00'),
            taxable=Decimal('200.00'),
            tax_amount=Decimal('0.00'),
            line_total=Decimal('200.00')
        )

        resp = self.client.post(
            f'/api/bills/{bill.pk}/sign/',
            data=json.dumps({
                'signature_data': self.dummy_sig,
                'signed_by': 'Accountant Bob',
                'signature_title': 'Chief Financial Officer'
            }),
            content_type='application/json'
        )
        self.assertEqual(resp.status_code, 200, resp.content)
        bill.refresh_from_db()
        self.assertEqual(bill.signature_data, self.dummy_sig)
        self.assertEqual(bill.signed_by, 'Accountant Bob')
        self.assertEqual(bill.signature_title, 'Chief Financial Officer')

        # Unsign
        resp_unsign = self.client.post(f'/api/bills/{bill.pk}/unsign/')
        self.assertEqual(resp_unsign.status_code, 200)
        bill.refresh_from_db()
        self.assertEqual(bill.signature_data, '')
        self.assertIsNone(bill.signed_at)

    def test_quote_sign_and_unsign(self):
        self.client.force_login(self.user1)
        quote = Quote.objects.create(
            organization=self.org1,
            customer=self.customer1,
            number='QT-TEST-01',
            date=timezone.localdate(),
            due_date=timezone.localdate(),
            total=Decimal('50.00'),
            subtotal=Decimal('50.00')
        )
        QuoteLine.objects.create(
            quote=quote,
            item=self.item1,
            quantity=Decimal('1'),
            rate=Decimal('50.00'),
            taxable=Decimal('50.00'),
            tax_amount=Decimal('0.00'),
            line_total=Decimal('50.00')
        )

        resp = self.client.post(
            f'/api/quotes/{quote.pk}/sign/',
            data=json.dumps({'signature_data': self.dummy_sig, 'signed_by': 'Sales Lead'}),
            content_type='application/json'
        )
        self.assertEqual(resp.status_code, 200)
        quote.refresh_from_db()
        self.assertEqual(quote.signature_data, self.dummy_sig)

        resp_unsign = self.client.post(f'/api/quotes/{quote.pk}/unsign/')
        self.assertEqual(resp_unsign.status_code, 200)
        quote.refresh_from_db()
        self.assertEqual(quote.signature_data, '')

    def test_delivery_challan_sign_and_unsign(self):
        self.client.force_login(self.user1)
        dc = DeliveryChallan.objects.create(
            organization=self.org1,
            customer=self.customer1,
            number='DC-TEST-01',
            date=timezone.localdate()
        )

        resp = self.client.post(
            f'/api/delivery-challans/{dc.pk}/sign/',
            data=json.dumps({'signature_data': self.dummy_sig, 'signed_by': 'Warehouse Manager'}),
            content_type='application/json'
        )
        self.assertEqual(resp.status_code, 200)
        dc.refresh_from_db()
        self.assertEqual(dc.signature_data, self.dummy_sig)

        resp_unsign = self.client.post(f'/api/delivery-challans/{dc.pk}/unsign/')
        self.assertEqual(resp_unsign.status_code, 200)
        dc.refresh_from_db()
        self.assertEqual(dc.signature_data, '')

    def test_organization_default_signature(self):
        self.client.force_login(self.user1)
        resp = self.client.put(
            '/api/organization/',
            data=json.dumps({
                'name': 'Org Alpha Updated',
                'state': 'Kerala',
                'signature_data': self.dummy_sig
            }),
            content_type='application/json'
        )
        self.assertEqual(resp.status_code, 200, resp.content)
        self.org1.refresh_from_db()
        self.assertEqual(self.org1.signature_data, self.dummy_sig)

    def test_multi_tenant_isolation_on_sign(self):
        # Invoice belongs to Org 1
        inv = Invoice.objects.create(
            organization=self.org1,
            customer=self.customer1,
            number='INV-ISOLATION-01',
            date=timezone.localdate(),
            due_date=timezone.localdate(),
            total=Decimal('100.00'),
            subtotal=Decimal('100.00')
        )
        # Login as User 2 (Org 2)
        self.client.force_login(self.user2)

        # Attempt to sign Org 1's invoice
        resp = self.client.post(
            f'/api/invoices/{inv.pk}/sign/',
            data=json.dumps({'signature_data': self.dummy_sig}),
            content_type='application/json'
        )
        # Must be 404 (or 403) due to organization query scoping
        self.assertIn(resp.status_code, [403, 404])
        inv.refresh_from_db()
        self.assertEqual(inv.signature_data, '')

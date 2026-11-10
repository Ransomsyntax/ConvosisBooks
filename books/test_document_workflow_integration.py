import json
from decimal import Decimal
from django.test import TestCase, Client
from django.contrib.auth.models import User
from django.utils import timezone
from books.models import (
    Organization, UserProfile, Customer, Vendor, Item,
    Quote, SalesOrder, Invoice, Bill, PurchaseOrder, RecurringInvoice, RetainerInvoice,
    RetainerInvoiceAllocation
)

class DocumentWorkflowIntegrationTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='workflow_tester',
            email='workflow@convosis.com',
            password='testpassword123'
        )
        self.org = Organization.objects.create(
            name='Workflow Org',
            owner=self.user,
            email='org@convosis.com',
            state='Kerala'
        )
        profile, _ = UserProfile.objects.get_or_create(user=self.user)
        profile.organization = self.org
        profile.save()

        self.client = Client()
        self.client.force_login(self.user)

        # Set session org_id
        session = self.client.session
        session['active_org_id'] = self.org.id
        session.save()

        self.customer = Customer.objects.create(
            organization=self.org,
            name='Test Customer Pvt Ltd',
            email='customer@example.com',
            state='Kerala'
        )
        self.vendor = Vendor.objects.create(
            organization=self.org,
            name='Test Vendor Supplies',
            email='vendor@example.com',
            state='Kerala'
        )
        self.item = Item.objects.create(
            organization=self.org,
            name='Cloud ERP License',
            selling_price=Decimal('5000.00'),
            purchase_price=Decimal('4000.00'),
            gst_rate=18
        )
        self.today = timezone.now().date()

    def test_quote_to_sales_order_conversion(self):
        # 1. Create a Quote
        quote = Quote.objects.create(
            organization=self.org,
            number='QT-000001',
            customer=self.customer,
            date=self.today,
            due_date=self.today,
            place_of_supply='Kerala',
            status='sent',
            subtotal=Decimal('5000.00'),
            total=Decimal('5900.00')
        )
        quote.lines.create(
            item=self.item,
            description='Cloud ERP License',
            quantity=1,
            rate=Decimal('5000.00'),
            taxable=Decimal('5000.00'),
            tax_amount=Decimal('900.00'),
            gst_rate=18,
            line_total=Decimal('5900.00')
        )

        # 2. Trigger convert-to-sales-order action via API
        response = self.client.post(
            f'/api/quotes/{quote.id}/convert-to-sales-order/',
            data=json.dumps({}),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200, response.content)
        data = response.json()
        so_id = data.get('sales_order_id') or data.get('order_id')
        self.assertIsNotNone(so_id)

        # 3. Verify SalesOrder created with link to Quote
        so = SalesOrder.objects.get(id=so_id)
        self.assertEqual(so.source_quote, quote)
        self.assertEqual(so.customer, self.customer)
        self.assertEqual(so.lines.count(), 1)
        self.assertEqual(so.total, Decimal('5900.00'))

        # Quote should be marked as ordered
        quote.refresh_from_db()
        self.assertEqual(quote.status, 'ordered')

        # 4. Check API detail response serializes related_documents
        q_resp = self.client.get(f'/api/quotes/{quote.id}/')
        self.assertEqual(q_resp.status_code, 200)
        q_data = q_resp.json()
        self.assertTrue(any(doc['id'] == so.id and doc['kind'] == 'sales-orders' for doc in q_data.get('related_documents', [])))

        so_resp = self.client.get(f'/api/sales-orders/{so.id}/')
        self.assertEqual(so_resp.status_code, 200)
        so_data = so_resp.json()
        self.assertTrue(any(doc['id'] == quote.id and doc['kind'] == 'quotes' for doc in so_data.get('related_documents', [])))

    def test_sales_order_to_invoice_conversion(self):
        # 1. Create a Sales Order
        so = SalesOrder.objects.create(
            organization=self.org,
            number='SO-000001',
            customer=self.customer,
            date=self.today,
            due_date=self.today,
            place_of_supply='Kerala',
            status='confirmed',
            subtotal=Decimal('10000.00'),
            total=Decimal('11800.00')
        )
        so.lines.create(
            item=self.item,
            description='Cloud ERP License x2',
            quantity=2,
            rate=Decimal('5000.00'),
            taxable=Decimal('10000.00'),
            tax_amount=Decimal('1800.00'),
            gst_rate=18,
            line_total=Decimal('11800.00')
        )

        # 2. Trigger convert-to-invoice
        response = self.client.post(
            f'/api/sales-orders/{so.id}/convert-to-invoice/',
            data=json.dumps({}),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200, response.content)
        data = response.json()
        inv_id = data.get('invoice_id')
        self.assertIsNotNone(inv_id)

        # 3. Verify Invoice
        inv = Invoice.objects.get(id=inv_id)
        self.assertEqual(inv.source_sales_order, so)
        self.assertEqual(inv.customer, self.customer)
        self.assertEqual(inv.total, Decimal('11800.00'))

        # SO updated
        so.refresh_from_db()
        self.assertEqual(so.converted_to_invoice, inv)
        self.assertEqual(so.status, 'closed')

        # 4. Check bi-directional related_documents
        so_resp = self.client.get(f'/api/sales-orders/{so.id}/')
        so_data = so_resp.json()
        self.assertTrue(any(doc['id'] == inv.id and doc['kind'] == 'invoices' for doc in so_data.get('related_documents', [])))

        inv_resp = self.client.get(f'/api/invoices/{inv.id}/')
        inv_data = inv_resp.json()
        self.assertTrue(any(doc['id'] == so.id and doc['kind'] == 'sales-orders' for doc in inv_data.get('related_documents', [])))

    def test_purchase_order_to_bill_conversion(self):
        # 1. Create a Purchase Order
        po = PurchaseOrder.objects.create(
            organization=self.org,
            number='PO-000001',
            vendor=self.vendor,
            date=self.today,
            due_date=self.today,
            place_of_supply='Kerala',
            status='confirmed',
            subtotal=Decimal('5000.00'),
            total=Decimal('5900.00')
        )
        po.lines.create(
            item=self.item,
            description='Supplier ERP License',
            quantity=1,
            rate=Decimal('5000.00'),
            taxable=Decimal('5000.00'),
            tax_amount=Decimal('900.00'),
            gst_rate=18,
            line_total=Decimal('5900.00')
        )

        # 2. Trigger convert-to-bill action
        response = self.client.post(
            f'/api/purchase-orders/{po.id}/convert-to-bill/',
            data=json.dumps({}),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200, response.content)
        data = response.json()
        bill_id = data.get('bill_id') or data.get('id')
        self.assertIsNotNone(bill_id)

        # 3. Verify Bill created with link to PO
        bill = Bill.objects.get(id=bill_id)
        self.assertEqual(bill.source_purchase_order, po)
        self.assertEqual(bill.vendor, self.vendor)
        self.assertEqual(bill.total, Decimal('5900.00'))

        # PO updated
        po.refresh_from_db()
        self.assertEqual(po.converted_to_bill, bill)
        self.assertEqual(po.status, 'closed')

        # 4. Check bi-directional related_documents
        po_resp = self.client.get(f'/api/purchase-orders/{po.id}/')
        po_data = po_resp.json()
        self.assertTrue(any(doc['id'] == bill.id and doc['kind'] == 'bills' for doc in po_data.get('related_documents', [])))

        bill_resp = self.client.get(f'/api/bills/{bill.id}/')
        bill_data = bill_resp.json()
        self.assertTrue(any(doc['id'] == po.id and doc['kind'] == 'purchase-orders' for doc in bill_data.get('related_documents', [])))

    def test_recurring_invoice_generation(self):
        # 1. Create a Recurring Invoice Profile
        rec = RecurringInvoice.objects.create(
            organization=self.org,
            profile_name='Monthly Retainer Support',
            customer=self.customer,
            frequency='monthly',
            start_date=self.today,
            next_date=self.today,
            status='active',
            subtotal=Decimal('5000.00'),
            total=Decimal('5900.00'),
            lines_data=[{
                'item': self.item.id,
                'description': 'Monthly Retainer Support',
                'quantity': 1,
                'rate': 5000.00,
                'discount_percent': 0,
                'gst_rate': 18
            }]
        )

        # 2. Trigger manual invoice generation
        response = self.client.post(
            f'/api/recurring-invoices/{rec.id}/generate-invoice/',
            data=json.dumps({}),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200, response.content)
        data = response.json()
        inv_id = data.get('invoice_id')
        self.assertIsNotNone(inv_id)

        # 3. Verify generated invoice has recurring_invoice set
        inv = Invoice.objects.get(id=inv_id)
        self.assertEqual(inv.recurring_invoice, rec)
        self.assertEqual(inv.total, Decimal('5900.00'))

        # 4. Check related_documents on recurring profile detail API
        rec_resp = self.client.get(f'/api/recurring-invoices/{rec.id}/')
        self.assertEqual(rec_resp.status_code, 200)
        rec_data = rec_resp.json()
        self.assertTrue(any(doc['id'] == inv.id and doc['kind'] == 'invoices' for doc in rec_data.get('related_documents', [])))

    def test_retainer_invoice_allocation_workflow(self):
        # 1. Create Retainer Invoice and an Invoice
        ret = RetainerInvoice.objects.create(
            organization=self.org,
            number='RET-000001',
            customer=self.customer,
            date=self.today,
            due_date=self.today,
            place_of_supply='Kerala',
            status='paid',
            total=Decimal('10000.00'),
            subtotal=Decimal('10000.00'),
            applied_amount=Decimal('0.00')
        )
        inv = Invoice.objects.create(
            organization=self.org,
            number='INV-000001',
            customer=self.customer,
            date=self.today,
            due_date=self.today,
            place_of_supply='Kerala',
            status='sent',
            total=Decimal('6000.00')
        )

        # 2. Allocate Retainer to Invoice
        RetainerInvoiceAllocation.objects.create(
            retainer=ret,
            invoice=inv,
            amount=Decimal('4000.00'),
            date=self.today,
            notes='Applied to INV-000001'
        )

        # 3. Check related_documents on Retainer and Invoice
        ret_resp = self.client.get(f'/api/retainer-invoices/{ret.id}/')
        ret_data = ret_resp.json()
        self.assertTrue(any(doc['id'] == inv.id and doc['kind'] == 'invoices' for doc in ret_data.get('related_documents', [])))

        inv_resp = self.client.get(f'/api/invoices/{inv.id}/')
        inv_data = inv_resp.json()
        self.assertTrue(any(doc['id'] == ret.id and doc['kind'] == 'retainer-invoices' for doc in inv_data.get('related_documents', [])))

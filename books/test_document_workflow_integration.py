import json
from decimal import Decimal
from django.test import TestCase, Client
from django.contrib.auth.models import User
from django.utils import timezone
from books.models import (
    Branch, DeliveryChallan, DeliveryChallanLine, DocumentNumberSeries,
    Organization, UserProfile, Customer, Vendor, Item, TransactionSeries,
    Quote, SalesOrder, Invoice, Bill, PurchaseOrder, RecurringInvoice,
    RetainerInvoice, RetainerInvoiceAllocation
)
from books import services

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

    def create_branch_series(self, branch_name, number_types):
        branch = Branch.objects.create(
            organization=self.org,
            name=branch_name,
        )
        series = TransactionSeries.objects.create(
            organization=self.org,
            name=f'{branch_name} Series',
            branch=branch.name,
            location=branch.name,
            business_location=branch,
            is_active=True,
        )
        for document_type, prefix in number_types.items():
            DocumentNumberSeries.objects.create(
                organization=self.org,
                series_group=series,
                name=series.name,
                document_type=document_type,
                prefix=prefix,
                format_pattern=f'{prefix}/{{SEQUENCE}}',
                branch=branch.name,
                location=branch.name,
                business_location=branch,
                active=True,
                padding=4,
            )
        return branch, series

    def test_quote_to_sales_order_conversion(self):
        branch, series = self.create_branch_series(
            'Quote Branch',
            {'sales_orders': 'BR-SO'},
        )
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
            total=Decimal('5900.00'),
            branch=branch.name,
            location=branch.name,
            business_location=branch,
            transaction_series=series.name,
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
        self.assertEqual(so.business_location, branch)
        self.assertEqual(so.transaction_series, series.name)
        self.assertTrue(so.number.startswith('BR-SO/'))

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

    def test_quote_to_invoice_conversion_preserves_branch_and_series(self):
        branch, series = self.create_branch_series(
            'Quote Invoice Branch',
            {'invoices': 'QINV'},
        )
        quote = Quote.objects.create(
            organization=self.org,
            number='QT-BRANCH-INV',
            customer=self.customer,
            date=self.today,
            due_date=self.today,
            place_of_supply='Kerala',
            status='accepted',
            subtotal=Decimal('5000.00'),
            total=Decimal('5900.00'),
            branch=branch.name,
            location=branch.name,
            business_location=branch,
            transaction_series=series.name,
        )

        response = self.client.post(
            f'/api/quotes/{quote.pk}/convert-to-invoice/',
            data=json.dumps({}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200, response.content)
        invoice = Invoice.objects.get(pk=response.json()['invoice_id'])
        self.assertEqual(invoice.business_location, branch)
        self.assertEqual(invoice.transaction_series, series.name)
        self.assertTrue(invoice.number.startswith('QINV/'))

    def test_sales_order_to_invoice_conversion(self):
        branch, series = self.create_branch_series(
            'Sales Branch',
            {
                'sales_orders': 'BR-SO',
                'invoices': 'BR-INV',
            },
        )
        original_series_name = series.name
        sales_order_number = services.next_document_number(
            'SO',
            org=self.org,
            date=self.today,
            customer_type='b2b',
            branch=branch.name,
            location=branch.name,
            series=series.name,
            business_location_id=branch.pk,
        )
        # 1. Create a Sales Order
        so = SalesOrder.objects.create(
            organization=self.org,
            number=sales_order_number,
            customer=self.customer,
            date=self.today,
            due_date=self.today,
            place_of_supply='Kerala',
            status='confirmed',
            subtotal=Decimal('10000.00'),
            total=Decimal('11800.00'),
            branch=branch.name,
            location=branch.name,
            business_location=branch,
            transaction_series=series.name,
        )
        series.name = 'Renamed Sales Branch Series'
        series.save(update_fields=['name', 'updated_at'])
        DocumentNumberSeries.objects.filter(series_group=series).update(name=series.name)
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
        self.assertEqual(inv.business_location, branch)
        self.assertEqual(inv.transaction_series, series.name)
        self.assertTrue(inv.number.startswith('BR-INV/'))
        self.assertNotEqual(so.transaction_series, series.name)
        self.assertEqual(so.transaction_series, original_series_name)

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
        duplicate = self.client.post(
            f'/api/sales-orders/{so.id}/convert-to-invoice/',
            data=json.dumps({}),
            content_type='application/json',
        )
        self.assertEqual(duplicate.status_code, 400, duplicate.content)
        self.assertEqual(Invoice.objects.filter(source_sales_order=so).count(), 1)

    def test_purchase_order_to_bill_conversion(self):
        branch, series = self.create_branch_series(
            'Purchase Branch',
            {'bills': 'BR-BILL'},
        )
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
            total=Decimal('5900.00'),
            terms='Net 30 payment',
            branch=branch.name,
            location=branch.name,
            business_location=branch,
            transaction_series=series.name,
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
        self.assertEqual(bill.terms, 'Net 30 payment')
        self.assertEqual(bill.business_location, branch)
        self.assertEqual(bill.transaction_series, series.name)
        self.assertTrue(bill.number.startswith('BR-BILL/'))

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
        duplicate = self.client.post(
            f'/api/purchase-orders/{po.id}/convert-to-bill/',
            data=json.dumps({}),
            content_type='application/json',
        )
        self.assertEqual(duplicate.status_code, 400, duplicate.content)
        self.assertEqual(Bill.objects.filter(source_purchase_order=po).count(), 1)

    def test_sales_order_conversions_preserve_branch_and_series(self):
        branch, series = self.create_branch_series(
            'Sales Conversion Branch',
            {
                'purchase_orders': 'BR-PO',
                'delivery_challans': 'BR-DC',
            },
        )
        order = SalesOrder.objects.create(
            organization=self.org,
            number='SO-CONVERT-BRANCH',
            customer=self.customer,
            date=self.today,
            due_date=self.today,
            place_of_supply='Kerala',
            status='confirmed',
            subtotal=Decimal('5000.00'),
            total=Decimal('5900.00'),
            branch=branch.name,
            location=branch.name,
            business_location=branch,
            transaction_series=series.name,
        )
        order.lines.create(
            item=self.item,
            description='Cloud ERP License',
            quantity=1,
            rate=Decimal('5000.00'),
            taxable=Decimal('5000.00'),
            tax_amount=Decimal('900.00'),
            gst_rate=18,
            line_total=Decimal('5900.00'),
        )

        po_response = self.client.post(
            f'/api/sales-orders/{order.pk}/convert-to-purchase-order/',
            data=json.dumps({}),
            content_type='application/json',
        )
        self.assertEqual(po_response.status_code, 200, po_response.content)
        purchase_order = PurchaseOrder.objects.get(pk=po_response.json()['purchase_order_id'])
        self.assertEqual(purchase_order.business_location, branch)
        self.assertEqual(purchase_order.transaction_series, series.name)
        self.assertTrue(purchase_order.number.startswith('BR-PO/'))

        dc_response = self.client.post(
            f'/api/sales-orders/{order.pk}/convert-to-delivery-challan/',
            data=json.dumps({}),
            content_type='application/json',
        )
        self.assertEqual(dc_response.status_code, 200, dc_response.content)
        challan = DeliveryChallan.objects.get(pk=dc_response.json()['delivery_challan_id'])
        self.assertEqual(challan.business_location, branch)
        self.assertTrue(challan.number.startswith('BR-DC/'))

    def test_delivery_challan_to_invoice_uses_allocated_series_and_branch(self):
        branch, series = self.create_branch_series(
            'Challan Invoice Branch',
            {
                'delivery_challans': 'BR-DC',
                'invoices': 'BR-INV',
            },
        )
        challan_number = services.next_document_number(
            'DC',
            org=self.org,
            date=self.today,
            branch=branch.name,
            location=branch.name,
            series=series.name,
            business_location_id=branch.pk,
        )
        challan = DeliveryChallan.objects.create(
            organization=self.org,
            customer=self.customer,
            number=challan_number,
            date=self.today,
            branch=branch.name,
            location=branch.name,
            business_location=branch,
            challan_type='delivering_goods',
            status='open',
            subtotal=Decimal('5000.00'),
            total=Decimal('5900.00'),
        )
        DeliveryChallanLine.objects.create(
            challan=challan,
            item=self.item,
            description='Cloud ERP License',
            quantity=1,
            rate=Decimal('5000.00'),
            taxable=Decimal('5000.00'),
            tax_amount=Decimal('900.00'),
            gst_rate=18,
            line_total=Decimal('5900.00'),
        )

        response = self.client.post(
            f'/api/delivery-challans/{challan.pk}/convert-to-invoice/',
            data=json.dumps({}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 201, response.content)
        invoice = Invoice.objects.get(pk=response.json()['invoice_id'])
        self.assertEqual(invoice.business_location, branch)
        self.assertEqual(invoice.transaction_series, series.name)
        self.assertTrue(invoice.number.startswith('BR-INV/'))

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

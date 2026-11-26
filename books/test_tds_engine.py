import json
from decimal import Decimal
from django.test import TestCase, Client
from django.contrib.auth import get_user_model
from django.utils import timezone
from books.models import (
    Organization, Customer, Vendor, Item, BankAccount, Account,
    Invoice, InvoiceLine, Quote, QuoteLine, SalesOrder, SalesOrderLine,
    Bill, BillLine, PurchaseOrder, PurchaseOrderLine, CreditNote, CreditNoteLine,
    VendorCredit, VendorCreditLine, RetainerInvoice, RetainerInvoiceLine, UserProfile
)
from books.calc import compute, q2

User = get_user_model()

class TdsEngineCalculationTestCase(TestCase):
    def test_line_level_tds_calculation(self):
        """Test compute function with line-level TDS."""
        lines = [
            {'quantity': Decimal('2'), 'rate': Decimal('1000.00'), 'discount_percent': Decimal('0'), 'gst_rate': Decimal('18'),
             'tds_applicable': True, 'tds_rate': Decimal('10.00'), 'position': 1},
            {'quantity': Decimal('1'), 'rate': Decimal('500.00'), 'discount_percent': Decimal('10'), 'gst_rate': Decimal('5'),
             'tds_applicable': True, 'tds_rate': Decimal('2.00'), 'position': 2},
            {'quantity': Decimal('3'), 'rate': Decimal('100.00'), 'discount_percent': Decimal('0'), 'gst_rate': Decimal('0'),
             'tds_applicable': False, 'tds_rate': Decimal('0.00'), 'position': 3},
        ]
        # Line 1: taxable = 2000.00, GST 18% = 360.00, TDS 10% on 2000 = 200.00
        # Line 2: gross = 500, discount 10% = 50, taxable = 450.00, GST 5% = 22.50, TDS 2% on 450 = 9.00
        # Line 3: taxable = 300.00, GST 0% = 0, TDS = 0
        # Subtotal = 2750.00
        # GST = 382.50
        # Total line TDS = 209.00
        # Total = 2750.00 + 382.50 - 209.00 = 2923.50
        comp, tot = compute(lines, intra=True, is_tax_inclusive=False, tds_mode='line')
        self.assertEqual(tot['tds_mode'], 'line')
        self.assertEqual(tot['subtotal'], Decimal('2750.00'))
        self.assertEqual(tot['tds_amount'], Decimal('209.00'))
        self.assertEqual(comp[0]['tds_amount'], Decimal('200.00'))
        self.assertEqual(comp[1]['tds_amount'], Decimal('9.00'))
        self.assertEqual(comp[2]['tds_amount'], Decimal('0.00'))
        self.assertEqual(tot['total'], Decimal('2923.50'))

    def test_transaction_level_tds_calculation(self):
        """Test compute function with transaction-level TDS."""
        lines = [
            {'quantity': Decimal('2'), 'rate': Decimal('1000.00'), 'discount_percent': Decimal('0'), 'gst_rate': Decimal('18'),
             'tds_applicable': True, 'tds_rate': Decimal('10.00'), 'position': 1},
            {'quantity': Decimal('1'), 'rate': Decimal('500.00'), 'discount_percent': Decimal('0'), 'gst_rate': Decimal('18'),
             'tds_applicable': True, 'tds_rate': Decimal('10.00'), 'position': 2},
        ]
        # Subtotal = 2500.00, GST 18% = 450.00
        # Transaction TDS 2% on 2500.00 = 50.00
        # Line TDS MUST be ignored/zeroed in transaction mode
        comp, tot = compute(lines, intra=True, is_tax_inclusive=False, tds_mode='transaction', tds_tax_rate=Decimal('2.00'))
        self.assertEqual(tot['tds_mode'], 'transaction')
        self.assertEqual(tot['tds_tax_rate'], Decimal('2.00'))
        self.assertEqual(tot['subtotal'], Decimal('2500.00'))
        self.assertEqual(tot['tds_amount'], Decimal('50.00'))
        self.assertEqual(comp[0]['tds_amount'], Decimal('0.00'))
        self.assertEqual(comp[1]['tds_amount'], Decimal('0.00'))
        self.assertEqual(tot['total'], Decimal('2900.00'))

    def test_mode_none_zeroes_tds(self):
        """Test compute function with tds_mode='none'."""
        lines = [
            {'quantity': Decimal('1'), 'rate': Decimal('1000.00'), 'discount_percent': Decimal('0'), 'gst_rate': Decimal('18'),
             'tds_applicable': True, 'tds_rate': Decimal('10.00'), 'position': 1},
        ]
        comp, tot = compute(lines, intra=True, is_tax_inclusive=False, tds_mode='none', tds_tax_rate=Decimal('5.00'))
        self.assertEqual(tot['tds_mode'], 'none')
        self.assertEqual(tot['tds_amount'], Decimal('0.00'))
        self.assertEqual(comp[0]['tds_amount'], Decimal('0.00'))
        self.assertEqual(tot['total'], Decimal('1180.00'))


class TdsTransactionApiIntegrationTestCase(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(
            username='tds_tester', email='tds_tester@example.com', password='password123'
        )
        self.client.force_login(self.user)
        self.org = Organization.get()
        self.org.state = 'Kerala'
        self.org.save()
        profile, _ = UserProfile.objects.get_or_create(
            user=self.user,
            defaults={'organization': self.org, 'role': UserProfile.ADMIN},
        )
        profile.organization = self.org
        profile.save(update_fields=['organization'])

        self.customer = Customer.objects.create(
            name='Test TDS Customer', email='cust@test.test', state='Kerala', organization=self.org
        )
        self.vendor = Vendor.objects.create(
            name='Test TDS Vendor', email='vend@test.test', state='Kerala', organization=self.org
        )
        self.item = Item.objects.create(
            name='Tech Consulting', selling_price=Decimal('5000.00'), purchase_price=Decimal('3000.00'),
            gst_rate=Decimal('18.00'), organization=self.org
        )

    def test_sales_invoice_line_tds_persistence(self):
        payload = {
            'customer': self.customer.id,
            'date': str(timezone.localdate()),
            'due_date': str(timezone.localdate()),
            'place_of_supply': 'Kerala',
            'tds_mode': 'line',
            'lines': [
                {
                    'item': self.item.id,
                    'description': 'Consulting',
                    'quantity': 2,
                    'rate': '5000.00',
                    'gst_rate': '18.00',
                    'tds_applicable': True,
                    'tds_rate': '10.00',
                    'tds_section': '194J'
                }
            ]
        }
        res = self.client.post('/api/invoices/', data=json.dumps(payload), content_type='application/json')
        self.assertIn(res.status_code, (200, 201), res.content)
        inv_id = res.json()['id']
        inv = Invoice.objects.get(pk=inv_id)
        self.assertEqual(inv.tds_mode, 'line')
        self.assertEqual(inv.tds_amount, Decimal('1000.00')) # 10% of 10000
        self.assertEqual(inv.subtotal, Decimal('10000.00'))
        # Total = 10000 + 1800 GST - 1000 TDS = 10800
        self.assertEqual(inv.total, Decimal('10800.00'))

        line = inv.lines.first()
        self.assertTrue(line.tds_applicable)
        self.assertEqual(line.tds_rate, Decimal('10.00'))
        self.assertEqual(line.tds_amount, Decimal('1000.00'))

        # Fetch detail API
        dres = self.client.get(f'/api/invoices/{inv_id}/')
        self.assertEqual(dres.status_code, 200)
        ddata = dres.json()
        self.assertEqual(ddata['tds_mode'], 'line')
        self.assertEqual(Decimal(str(ddata['tds_amount'])), Decimal('1000.00'))
        self.assertEqual(Decimal(str(ddata['lines'][0]['tds_rate'])), Decimal('10.00'))
        self.assertEqual(Decimal(str(ddata['lines'][0]['tds_amount'])), Decimal('1000.00'))

    def test_purchase_bill_transaction_tds_persistence(self):
        payload = {
            'vendor': self.vendor.id,
            'date': str(timezone.localdate()),
            'due_date': str(timezone.localdate()),
            'place_of_supply': 'Kerala',
            'tds_mode': 'transaction',
            'tds_tax_rate': '2.00',
            'tds_section': '194C',
            'lines': [
                {
                    'item': self.item.id,
                    'description': 'Contract Work',
                    'quantity': 10,
                    'rate': '1000.00',
                    'gst_rate': '18.00',
                }
            ]
        }
        res = self.client.post('/api/bills/', data=json.dumps(payload), content_type='application/json')
        self.assertIn(res.status_code, (200, 201), res.content)
        bill_id = res.json()['id']
        bill = Bill.objects.get(pk=bill_id)
        self.assertEqual(bill.tds_mode, 'transaction')
        self.assertEqual(bill.tds_tax_rate, Decimal('2.00'))
        self.assertEqual(bill.tds_amount, Decimal('200.00')) # 2% of 10000
        self.assertEqual(bill.total, Decimal('11600.00')) # 10000 + 1800 - 200

        # Detail check
        dres = self.client.get(f'/api/bills/{bill_id}/')
        self.assertEqual(dres.status_code, 200)
        ddata = dres.json()
        self.assertEqual(ddata['tds_mode'], 'transaction')
        self.assertEqual(Decimal(str(ddata['tds_tax_rate'])), Decimal('2.00'))
        self.assertEqual(Decimal(str(ddata['tds_amount'])), Decimal('200.00'))

    def test_switching_modes_on_update(self):
        """Test switching from Line-Level to Transaction-Level TDS."""
        payload = {
            'customer': self.customer.id,
            'date': str(timezone.localdate()),
            'due_date': str(timezone.localdate()),
            'place_of_supply': 'Kerala',
            'tds_mode': 'line',
            'lines': [
                {
                    'item': self.item.id,
                    'description': 'Consulting',
                    'quantity': 1,
                    'rate': '10000.00',
                    'gst_rate': '18.00',
                    'tds_applicable': True,
                    'tds_rate': '10.00',
                }
            ]
        }
        res = self.client.post('/api/invoices/', data=json.dumps(payload), content_type='application/json')
        inv_id = res.json()['id']
        inv = Invoice.objects.get(pk=inv_id)
        self.assertEqual(inv.tds_amount, Decimal('1000.00'))

        # Switch to transaction mode (2%)
        update_payload = {
            'customer': self.customer.id,
            'date': str(timezone.localdate()),
            'due_date': str(timezone.localdate()),
            'place_of_supply': 'Kerala',
            'tds_mode': 'transaction',
            'tds_tax_rate': '2.00',
            'lines': [
                {
                    'item': self.item.id,
                    'description': 'Consulting',
                    'quantity': 1,
                    'rate': '10000.00',
                    'gst_rate': '18.00',
                    'tds_applicable': True,
                    'tds_rate': '10.00', # Old line rate must be ignored because mode is transaction
                }
            ]
        }
        ures = self.client.put(f'/api/invoices/{inv_id}/', data=json.dumps(update_payload), content_type='application/json')
        self.assertIn(ures.status_code, (200, 204), ures.content)
        inv.refresh_from_db()
        self.assertEqual(inv.tds_mode, 'transaction')
        self.assertEqual(inv.tds_amount, Decimal('200.00')) # 2% of 10000, NOT 1200.00
        line = inv.lines.first()
        self.assertEqual(line.tds_amount, Decimal('0.00'))
        self.assertEqual(inv.total, Decimal('11600.00'))

    def test_sales_order_line_and_transaction_tds(self):
        """Test Sales Order line TDS and transaction TDS."""
        payload = {
            'customer': self.customer.id,
            'date': str(timezone.localdate()),
            'place_of_supply': 'Kerala',
            'tds_mode': 'line',
            'lines': [
                {
                    'item': self.item.id,
                    'description': 'Consulting SO',
                    'quantity': 2,
                    'rate': '5000.00',
                    'gst_rate': '18.00',
                    'tds_applicable': True,
                    'tds_rate': '10.00'
                }
            ]
        }
        res = self.client.post('/api/sales-orders/', data=json.dumps(payload), content_type='application/json')
        self.assertIn(res.status_code, (200, 201), res.content)
        so_id = res.json()['id']
        so = SalesOrder.objects.get(pk=so_id)
        self.assertEqual(so.tds_mode, 'line')
        self.assertEqual(so.tds_amount, Decimal('1000.00'))
        self.assertEqual(so.total, Decimal('10800.00'))

    def test_purchase_order_to_bill_conversion_tds_propagation(self):
        """Test PO conversion to Bill propagates TDS mode and amounts."""
        payload = {
            'vendor': self.vendor.id,
            'date': str(timezone.localdate()),
            'place_of_supply': 'Kerala',
            'tds_mode': 'transaction',
            'tds_tax_rate': '2.00',
            'lines': [
                {
                    'item': self.item.id,
                    'description': 'PO Item',
                    'quantity': 4,
                    'rate': '2500.00',
                    'gst_rate': '18.00'
                }
            ]
        }
        res = self.client.post('/api/purchase-orders/', data=json.dumps(payload), content_type='application/json')
        self.assertIn(res.status_code, (200, 201), res.content)
        po_id = res.json()['id']
        po = PurchaseOrder.objects.get(pk=po_id)
        self.assertEqual(po.tds_mode, 'transaction')
        self.assertEqual(po.tds_amount, Decimal('200.00'))

        # Convert PO to Bill
        cres = self.client.post(f'/api/purchase-orders/{po_id}/convert-to-bill/')
        self.assertIn(cres.status_code, (200, 201), cres.content)
        bill_id = cres.json()['id']
        bill = Bill.objects.get(pk=bill_id)
        self.assertEqual(bill.tds_mode, 'transaction')
        self.assertEqual(bill.tds_tax_rate, Decimal('2.00'))
        self.assertEqual(bill.tds_amount, Decimal('200.00'))
        self.assertEqual(bill.total, po.total)

    def test_credit_note_line_tds(self):
        """Test Credit Note with Line-Level TDS."""
        payload = {
            'customer': self.customer.id,
            'date': str(timezone.localdate()),
            'place_of_supply': 'Kerala',
            'tds_mode': 'line',
            'lines': [
                {
                    'item': self.item.id,
                    'description': 'Returned Consulting',
                    'quantity': 1,
                    'rate': '5000.00',
                    'gst_rate': '18.00',
                    'tds_applicable': True,
                    'tds_rate': '5.00'
                }
            ]
        }
        res = self.client.post('/api/credit-notes/', data=json.dumps(payload), content_type='application/json')
        self.assertIn(res.status_code, (200, 201), res.content)
        cn_id = res.json()['id']
        cn = CreditNote.objects.get(pk=cn_id)
        self.assertEqual(cn.tds_mode, 'line')
        self.assertEqual(cn.tds_amount, Decimal('250.00'))
        # Subtotal: 5000, GST 18%: 900, TDS: 250 -> Total: 5650.00
        self.assertEqual(cn.total, Decimal('5650.00'))

    def test_quote_to_sales_order_to_invoice_tds_propagation(self):
        """Test Quote -> SO -> Invoice conversion propagates TDS."""
        payload = {
            'customer': self.customer.id,
            'date': str(timezone.localdate()),
            'place_of_supply': 'Kerala',
            'tds_mode': 'line',
            'lines': [
                {
                    'item': self.item.id,
                    'description': 'Quoted Services',
                    'quantity': 1,
                    'rate': '10000.00',
                    'gst_rate': '18.00',
                    'tds_applicable': True,
                    'tds_rate': '10.00'
                }
            ]
        }
        res = self.client.post('/api/quotes/', data=json.dumps(payload), content_type='application/json')
        self.assertIn(res.status_code, (200, 201), res.content)
        q_id = res.json()['id']
        quote = Quote.objects.get(pk=q_id)
        self.assertEqual(quote.tds_mode, 'line')
        self.assertEqual(quote.tds_amount, Decimal('1000.00'))

        # Convert to Sales Order
        so_res = self.client.post(f'/api/quotes/{q_id}/convert-to-sales-order/')
        self.assertIn(so_res.status_code, (200, 201), so_res.content)
        so_id = so_res.json()['id']
        so = SalesOrder.objects.get(pk=so_id)
        self.assertEqual(so.tds_mode, 'line')
        self.assertEqual(so.tds_amount, Decimal('1000.00'))
        self.assertEqual(so.lines.first().tds_rate, Decimal('10.00'))

        # Convert to Invoice
        inv_res = self.client.post(f'/api/sales-orders/{so_id}/convert-to-invoice/')
        self.assertIn(inv_res.status_code, (200, 201), inv_res.content)
        inv_id = inv_res.json()['id']
        inv = Invoice.objects.get(pk=inv_id)
        self.assertEqual(inv.tds_mode, 'line')
        self.assertEqual(inv.tds_amount, Decimal('1000.00'))
        self.assertEqual(inv.lines.first().tds_rate, Decimal('10.00'))

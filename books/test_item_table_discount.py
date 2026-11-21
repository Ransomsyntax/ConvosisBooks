from decimal import Decimal
import json
from django.test import TestCase, Client
from django.contrib.auth import get_user_model
from django.utils import timezone
from books.models import (
    Organization, Customer, Vendor, Item, Invoice, Bill,
    Quote, SalesOrder, PurchaseOrder, CreditNote, VendorCredit,
    RecurringInvoice, DeliveryChallan, UserProfile
)
from books import calc, services
from books.api import parse_lines

User = get_user_model()

class ItemTableDiscountTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='disc_user', email='disc_user@example.com', password='password123'
        )
        self.org = Organization.objects.create(
            name='Discount Test Org', owner=self.user, state='Kerala'
        )
        UserProfile.objects.create(
            user=self.user, organization=self.org, role='admin', normalized_email='disc_user@example.com'
        )
        self.client = Client()
        self.client.force_login(self.user)

        self.customer = Customer.objects.create(
            name='Test Customer', company='Customer Co', gstin='32AAAAA0000A1Z5',
            customer_type='business', organization=self.org, state='Kerala'
        )
        self.vendor = Vendor.objects.create(
            name='Test Vendor', gstin='32BBBBB0000B1Z6', organization=self.org, state='Kerala'
        )
        self.item1 = Item.objects.create(
            name='Laptop', sku='SKU-LAPTOP-01', selling_price=Decimal('50000.00'), purchase_price=Decimal('40000.00'),
            gst_rate=Decimal('18.00'), organization=self.org
        )
        self.item2 = Item.objects.create(
            name='Mouse', sku='SKU-MOUSE-02', selling_price=Decimal('1000.00'), purchase_price=Decimal('700.00'),
            gst_rate=Decimal('18.00'), organization=self.org
        )

    def test_parse_lines_percentage_discount(self):
        lines_input = [{
            'item': self.item1.pk,
            'description': 'Laptop',
            'quantity': 2,
            'rate': 50000.00,
            'discount': 10,
            'discount_type': 'percentage',
            'gst_rate': 18.00
        }]
        parsed = parse_lines(lines_input, org=self.org)
        self.assertEqual(len(parsed), 1)
        self.assertEqual(parsed[0]['discount_percent'], Decimal('10.00'))
        self.assertEqual(parsed[0]['discount_amount'], Decimal('0.00'))

    def test_parse_lines_rupee_amount_discount(self):
        lines_input = [{
            'item': self.item1.pk,
            'description': 'Laptop',
            'quantity': 2,
            'rate': 50000.00,
            'discount': 5000,
            'discount_type': 'amount',
            'gst_rate': 18.00
        }]
        parsed = parse_lines(lines_input, org=self.org)
        self.assertEqual(len(parsed), 1)
        self.assertEqual(parsed[0]['discount_percent'], Decimal('0.00'))
        self.assertEqual(parsed[0]['discount_amount'], Decimal('5000.00'))

    def test_parse_lines_rupee_symbol_discount_type(self):
        lines_input = [{
            'item': self.item2.pk,
            'description': 'Mouse',
            'quantity': 5,
            'rate': 1000.00,
            'discount': 250,
            'discount_type': '₹',
            'gst_rate': 18.00
        }]
        parsed = parse_lines(lines_input, org=self.org)
        self.assertEqual(len(parsed), 1)
        self.assertEqual(parsed[0]['discount_percent'], Decimal('0.00'))
        self.assertEqual(parsed[0]['discount_amount'], Decimal('250.00'))

    def test_calc_compute_with_rupee_amount_discount(self):
        # Qty: 2, Rate: 50000 => Gross: 100,000. Discount amount: ₹5,000.
        # Taxable should be 95,000. GST 18% intra (9% CGST, 9% SGST) => 8,550 + 8,550 = 17,100.
        # Total = 112,100.
        line = {
            'item': self.item1,
            'description': 'Laptop',
            'hsn_sac': '',
            'quantity': Decimal('2'),
            'rate': Decimal('50000.00'),
            'discount_percent': Decimal('0.00'),
            'discount_amount': Decimal('5000.00'),
            'gst_rate': Decimal('18.00'),
            'position': 1
        }
        comp, tot = calc.compute([line], intra=True, is_tax_inclusive=False)
        self.assertEqual(comp[0]['taxable'], Decimal('95000.00'))
        self.assertEqual(comp[0]['tax_amount'], Decimal('17100.00'))
        self.assertEqual(comp[0]['line_total'], Decimal('112100.00'))
        self.assertEqual(tot['subtotal'], Decimal('95000.00'))
        self.assertEqual(tot['cgst'], Decimal('8550.00'))
        self.assertEqual(tot['sgst'], Decimal('8550.00'))
        self.assertEqual(tot['total'], Decimal('112100.00'))

    def test_invoice_create_and_detail_with_rupee_and_percentage_discounts(self):
        payload = {
            'customer': self.customer.pk,
            'number': 'INV-DISC-001',
            'date': timezone.localdate().isoformat(),
            'due_date': timezone.localdate().isoformat(),
            'place_of_supply': 'Kerala',
            'tax_pricing_type': 'tax_exclusive',
            'lines': [
                {
                    'item': self.item1.pk,
                    'description': 'Laptop with ₹5000 discount',
                    'quantity': 2,
                    'rate': 50000.00,
                    'discount': 5000.00,
                    'discount_type': 'amount',
                    'gst_rate': 18.00
                },
                {
                    'item': self.item2.pk,
                    'description': 'Mouse with 10% discount',
                    'quantity': 10,
                    'rate': 1000.00,
                    'discount': 10.00,
                    'discount_type': 'percentage',
                    'gst_rate': 18.00
                }
            ]
        }
        resp = self.client.post('/api/invoices/', data=json.dumps(payload), content_type='application/json')
        self.assertEqual(resp.status_code, 200, resp.content)
        data = resp.json()
        inv_id = data.get('id')
        self.assertTrue(inv_id)

        # GET invoice detail
        get_resp = self.client.get(f'/api/invoices/{inv_id}/')
        self.assertEqual(get_resp.status_code, 200)
        inv_data = get_resp.json()
        lines = inv_data.get('lines', [])
        self.assertEqual(len(lines), 2)

        # Check line 1 (Rupee discount)
        l1 = lines[0]
        self.assertEqual(Decimal(str(l1['discount_amount'])), Decimal('5000.00'))
        self.assertEqual(l1['discount_type'], 'amount')
        self.assertEqual(Decimal(str(l1['taxable'])), Decimal('95000.00'))

        # Check line 2 (Percentage discount: 10 * 1000 = 10,000 gross - 10% = 9,000 taxable)
        l2 = lines[1]
        self.assertEqual(Decimal(str(l2['discount_percent'])), Decimal('10.00'))
        self.assertEqual(l2['discount_type'], 'percentage')
        self.assertEqual(Decimal(str(l2['taxable'])), Decimal('9000.00'))

    def test_quote_to_invoice_conversion_preserves_line_discount_amount(self):
        payload = {
            'customer': self.customer.pk,
            'number': 'QTN-DISC-001',
            'date': timezone.localdate().isoformat(),
            'expiry_date': timezone.localdate().isoformat(),
            'place_of_supply': 'Kerala',
            'tax_pricing_type': 'tax_exclusive',
            'lines': [
                {
                    'item': self.item1.pk,
                    'description': 'Quote Laptop',
                    'quantity': 1,
                    'rate': 50000.00,
                    'discount': 3000.00,
                    'discount_type': 'amount',
                    'gst_rate': 18.00
                }
            ]
        }
        resp = self.client.post('/api/quotes/', data=json.dumps(payload), content_type='application/json')
        self.assertEqual(resp.status_code, 200)
        q_id = resp.json()['id']

        # Convert Quote to Invoice
        conv_resp = self.client.post(f'/api/quotes/{q_id}/convert-to-invoice/', data=json.dumps({}), content_type='application/json')
        self.assertEqual(conv_resp.status_code, 200)
        inv_id = conv_resp.json()['invoice_id']

        # Verify created invoice lines have discount_amount = 3000
        inv_resp = self.client.get(f'/api/invoices/{inv_id}/')
        inv_line = inv_resp.json()['lines'][0]
        self.assertEqual(Decimal(str(inv_line['discount_amount'])), Decimal('3000.00'))
        self.assertEqual(inv_line['discount_type'], 'amount')
        self.assertEqual(Decimal(str(inv_line['taxable'])), Decimal('47000.00'))

    def test_sales_order_create_and_convert_to_invoice(self):
        payload = {
            'customer': self.customer.pk,
            'number': 'SO-DISC-001',
            'date': timezone.localdate().isoformat(),
            'lines': [
                {
                    'item': self.item1.pk,
                    'description': 'SO Item',
                    'quantity': 1,
                    'rate': 50000.00,
                    'discount': 2500.00,
                    'discount_type': 'amount',
                    'gst_rate': 18.00
                }
            ]
        }
        resp = self.client.post('/api/sales-orders/', data=json.dumps(payload), content_type='application/json')
        self.assertEqual(resp.status_code, 200)
        so_id = resp.json()['id']

        # Check SalesOrder detail
        so_resp = self.client.get(f'/api/sales-orders/{so_id}/')
        self.assertEqual(Decimal(str(so_resp.json()['lines'][0]['discount_amount'])), Decimal('2500.00'))
        self.assertEqual(so_resp.json()['lines'][0]['discount_type'], 'amount')

        # Convert to Invoice
        conv_resp = self.client.post(f'/api/sales-orders/{so_id}/convert-to-invoice/', data=json.dumps({}), content_type='application/json')
        self.assertEqual(conv_resp.status_code, 200)
        inv_id = conv_resp.json()['invoice_id']

        inv_resp = self.client.get(f'/api/invoices/{inv_id}/')
        self.assertEqual(Decimal(str(inv_resp.json()['lines'][0]['discount_amount'])), Decimal('2500.00'))

    def test_purchase_order_and_bill_discount(self):
        payload = {
            'vendor': self.vendor.pk,
            'number': 'PO-DISC-001',
            'date': timezone.localdate().isoformat(),
            'lines': [
                {
                    'item': self.item1.pk,
                    'description': 'PO Laptop',
                    'quantity': 1,
                    'rate': 40000.00,
                    'discount': 1500.00,
                    'discount_type': 'amount',
                    'gst_rate': 18.00
                }
            ]
        }
        resp = self.client.post('/api/purchase-orders/', data=json.dumps(payload), content_type='application/json')
        self.assertEqual(resp.status_code, 200)
        po_id = resp.json()['id']

        # Convert to Bill
        conv_resp = self.client.post(f'/api/purchase-orders/{po_id}/convert-to-bill/', data=json.dumps({}), content_type='application/json')
        self.assertEqual(conv_resp.status_code, 200)
        bill_id = conv_resp.json()['bill_id']

        bill_resp = self.client.get(f'/api/bills/{bill_id}/')
        bill_line = bill_resp.json()['lines'][0]
        self.assertEqual(Decimal(str(bill_line['discount_amount'])), Decimal('1500.00'))
        self.assertEqual(bill_line['discount_type'], 'amount')
        self.assertEqual(Decimal(str(bill_line['taxable'])), Decimal('38500.00'))

    def test_credit_note_and_vendor_credit_discount(self):
        cn_payload = {
            'customer': self.customer.pk,
            'number': 'CN-DISC-001',
            'date': timezone.localdate().isoformat(),
            'reason': 'Damaged Goods',
            'lines': [
                {
                    'item': self.item2.pk,
                    'description': 'Mouse',
                    'quantity': 2,
                    'rate': 1000.00,
                    'discount': 200.00,
                    'discount_type': 'amount',
                    'gst_rate': 18.00
                }
            ]
        }
        resp = self.client.post('/api/credit-notes/', data=json.dumps(cn_payload), content_type='application/json')
        self.assertEqual(resp.status_code, 200)
        cn_id = resp.json()['id']

        cn_resp = self.client.get(f'/api/credit-notes/{cn_id}/')
        cn_line = cn_resp.json()['lines'][0]
        self.assertEqual(Decimal(str(cn_line['discount_amount'])), Decimal('200.00'))
        self.assertEqual(cn_line['discount_type'], 'amount')
        self.assertEqual(Decimal(str(cn_line['taxable'])), Decimal('1800.00'))

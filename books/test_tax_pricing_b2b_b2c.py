from decimal import Decimal
from django.test import TestCase, Client
from django.contrib.auth import get_user_model
from django.utils import timezone
from books.models import (
    Organization, Customer, Vendor, Item, Invoice, Bill,
    Quote, SalesOrder, RecurringInvoice, RetainerInvoice, UserProfile
)
from books import calc, services

User = get_user_model()

class TaxPricingB2BTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='tax_user', email='tax_user@example.com', password='password123')
        self.org = Organization.objects.create(name='Tax Org', owner=self.user, state='Kerala')
        UserProfile.objects.create(user=self.user, organization=self.org, role='admin', normalized_email='tax_user@example.com')
        
        # B2B Customer (with GSTIN)
        self.b2b_customer = Customer.objects.create(
            name='B2B Enterprises',
            company='B2B Corp Ltd',
            gstin='32AAAAA0000A1Z5',
            customer_type='business',
            organization=self.org,
            state='Kerala'
        )
        # B2C Customer (individual, no GSTIN)
        self.b2c_customer = Customer.objects.create(
            name='John Doe',
            customer_type='individual',
            organization=self.org,
            state='Tamil Nadu'
        )
        # Registered Vendor
        self.reg_vendor = Vendor.objects.create(
            name='Registered Supplies Ltd',
            gstin='32BBBBB0000B1Z6',
            organization=self.org,
            state='Kerala'
        )
        # Unregistered Vendor
        self.unreg_vendor = Vendor.objects.create(
            name='Local Vendor',
            organization=self.org,
            state='Kerala'
        )
        self.item = Item.objects.create(
            name='Cloud ERP License',
            selling_price=Decimal('1400.00'),
            purchase_price=Decimal('1000.00'),
            gst_rate=Decimal('18.00'),
            organization=self.org
        )
        self.client = Client()
        self.client.force_login(self.user)

    def test_calc_module_tax_exclusive_vs_inclusive(self):
        """Test low-level calc compute in exclusive and inclusive modes."""
        lines = [
            {'quantity': Decimal('1'), 'rate': Decimal('1400.00'), 'discount_percent': Decimal('0'), 'gst_rate': Decimal('18.00')}
        ]
        # Exclusive intra-state
        lines_excl, tot_excl = calc.compute(lines, intra=True, is_tax_inclusive=False)
        self.assertEqual(tot_excl['subtotal'], Decimal('1400.00'))
        self.assertEqual(tot_excl['cgst'], Decimal('126.00'))
        self.assertEqual(tot_excl['sgst'], Decimal('126.00'))
        self.assertEqual(tot_excl['total'], Decimal('1652.00'))

        # Inclusive intra-state: entered amount = 1400, taxable = 1400 / 1.18 = 1186.44, tax = 213.56
        lines_incl, tot_incl = calc.compute(lines, intra=True, is_tax_inclusive=True)
        self.assertEqual(tot_incl['subtotal'], Decimal('1186.44'))
        self.assertEqual(tot_incl['cgst'], Decimal('106.78'))
        self.assertEqual(tot_incl['sgst'], Decimal('106.78'))
        self.assertEqual(tot_incl['total'], Decimal('1400.00'))
        self.assertEqual(lines_incl[0]['line_total'], Decimal('1400.00'))

        # Inclusive inter-state: IGST = 213.56
        lines_inter, tot_inter = calc.compute(lines, intra=False, is_tax_inclusive=True)
        self.assertEqual(tot_inter['subtotal'], Decimal('1186.44'))
        self.assertEqual(tot_inter['cgst'], Decimal('0.00'))
        self.assertEqual(tot_inter['sgst'], Decimal('0.00'))
        self.assertEqual(tot_inter['igst'], Decimal('213.56'))
        self.assertEqual(tot_inter['total'], Decimal('1400.00'))

    def test_b2b_tax_exclusive_invoice_creation(self):
        """Combination 1: B2B + Tax Exclusive invoice."""
        payload = {
            'customer': self.b2b_customer.id,
            'customer_type': 'b2b',
            'tax_pricing_type': 'tax_exclusive',
            'date': timezone.localdate().isoformat(),
            'due_date': timezone.localdate().isoformat(),
            'place_of_supply': 'Kerala',
            'lines': [
                {
                    'item': self.item.id,
                    'description': 'Consulting Service',
                    'quantity': 2,
                    'rate': 1000.00,
                    'discount_percent': 0,
                    'gst_rate': 18
                }
            ],
            'force': True
        }
        res = self.client.post('/api/invoices/', payload, content_type='application/json')
        self.assertEqual(res.status_code, 201)
        data = res.json()
        self.assertEqual(data['customer_type'], 'b2b')
        self.assertEqual(data['tax_pricing_type'], 'tax_exclusive')
        self.assertEqual(Decimal(str(data['subtotal'])), Decimal('2000.00'))
        self.assertEqual(Decimal(str(data['cgst'])), Decimal('180.00'))
        self.assertEqual(Decimal(str(data['sgst'])), Decimal('180.00'))
        self.assertEqual(Decimal(str(data['total'])), Decimal('2360.00'))

    def test_b2b_tax_inclusive_invoice_creation(self):
        """Combination 2: B2B + Tax Inclusive invoice."""
        payload = {
            'customer': self.b2b_customer.id,
            'customer_type': 'b2b',
            'tax_pricing_type': 'tax_inclusive',
            'date': timezone.localdate().isoformat(),
            'due_date': timezone.localdate().isoformat(),
            'place_of_supply': 'Kerala',
            'lines': [
                {
                    'item': self.item.id,
                    'description': 'All-Inclusive Software Pack',
                    'quantity': 1,
                    'rate': 1180.00,
                    'discount_percent': 0,
                    'gst_rate': 18
                }
            ],
            'force': True
        }
        res = self.client.post('/api/invoices/', payload, content_type='application/json')
        self.assertEqual(res.status_code, 201)
        data = res.json()
        self.assertEqual(data['customer_type'], 'b2b')
        self.assertEqual(data['tax_pricing_type'], 'tax_inclusive')
        self.assertEqual(Decimal(str(data['subtotal'])), Decimal('1000.00'))
        self.assertEqual(Decimal(str(data['cgst'])), Decimal('90.00'))
        self.assertEqual(Decimal(str(data['sgst'])), Decimal('90.00'))
        self.assertEqual(Decimal(str(data['total'])), Decimal('1180.00'))

    def test_b2c_tax_exclusive_invoice_creation(self):
        """Combination 3: B2C + Tax Exclusive invoice."""
        payload = {
            'customer': self.b2c_customer.id,
            'customer_type': 'b2c',
            'tax_pricing_type': 'tax_exclusive',
            'date': timezone.localdate().isoformat(),
            'due_date': timezone.localdate().isoformat(),
            'place_of_supply': 'Tamil Nadu',
            'lines': [
                {
                    'item': self.item.id,
                    'description': 'B2C Retailing',
                    'quantity': 1,
                    'rate': 500.00,
                    'discount_percent': 10,  # net = 450
                    'gst_rate': 18
                }
            ],
            'force': True
        }
        res = self.client.post('/api/invoices/', payload, content_type='application/json')
        self.assertEqual(res.status_code, 201)
        data = res.json()
        self.assertEqual(data['customer_type'], 'b2c')
        self.assertEqual(data['tax_pricing_type'], 'tax_exclusive')
        self.assertEqual(Decimal(str(data['subtotal'])), Decimal('450.00'))
        self.assertEqual(Decimal(str(data['igst'])), Decimal('81.00'))
        self.assertEqual(Decimal(str(data['total'])), Decimal('531.00'))

    def test_b2c_tax_inclusive_invoice_creation(self):
        """Combination 4: B2C + Tax Inclusive invoice."""
        payload = {
            'customer': self.b2c_customer.id,
            'customer_type': 'b2c',
            'tax_pricing_type': 'tax_inclusive',
            'date': timezone.localdate().isoformat(),
            'due_date': timezone.localdate().isoformat(),
            'place_of_supply': 'Tamil Nadu',
            'lines': [
                {
                    'item': self.item.id,
                    'description': 'Consumer Store Purchase',
                    'quantity': 1,
                    'rate': 1400.00,
                    'discount_percent': 0,
                    'gst_rate': 18
                }
            ],
            'force': True
        }
        res = self.client.post('/api/invoices/', payload, content_type='application/json')
        self.assertEqual(res.status_code, 201)
        data = res.json()
        self.assertEqual(data['customer_type'], 'b2c')
        self.assertEqual(data['tax_pricing_type'], 'tax_inclusive')
        self.assertEqual(Decimal(str(data['subtotal'])), Decimal('1186.44'))
        self.assertEqual(Decimal(str(data['igst'])), Decimal('213.56'))
        self.assertEqual(Decimal(str(data['total'])), Decimal('1400.00'))

    def test_bill_registered_vs_unregistered_supplier(self):
        """Test purchase bills with registered vs unregistered supplier and tax inclusive/exclusive."""
        # Registered supplier + tax inclusive
        p1 = {
            'vendor': self.reg_vendor.id,
            'customer_type': 'registered',
            'tax_pricing_type': 'tax_inclusive',
            'date': timezone.localdate().isoformat(),
            'place_of_supply': 'Kerala',
            'lines': [
                {
                    'item': self.item.id,
                    'description': 'Server Hardware',
                    'quantity': 1,
                    'rate': 1180.00,
                    'discount_percent': 0,
                    'gst_rate': 18
                }
            ],
            'force': True
        }
        res1 = self.client.post('/api/bills/', p1, content_type='application/json')
        self.assertEqual(res1.status_code, 201)
        d1 = res1.json()
        self.assertEqual(d1['customer_type'], 'registered')
        self.assertEqual(d1['tax_pricing_type'], 'tax_inclusive')
        self.assertEqual(Decimal(str(d1['total'])), Decimal('1180.00'))

        # Unregistered supplier + tax exclusive
        p2 = {
            'vendor': self.unreg_vendor.id,
            'customer_type': 'unregistered',
            'tax_pricing_type': 'tax_exclusive',
            'date': timezone.localdate().isoformat(),
            'place_of_supply': 'Kerala',
            'lines': [
                {
                    'item': self.item.id,
                    'description': 'Local Repairs',
                    'quantity': 1,
                    'rate': 500.00,
                    'discount_percent': 0,
                    'gst_rate': 0
                }
            ],
            'force': True
        }
        res2 = self.client.post('/api/bills/', p2, content_type='application/json')
        self.assertEqual(res2.status_code, 201)
        d2 = res2.json()
        self.assertEqual(d2['customer_type'], 'unregistered')
        self.assertEqual(d2['tax_pricing_type'], 'tax_exclusive')
        self.assertEqual(Decimal(str(d2['total'])), Decimal('500.00'))

    def test_quote_and_recurring_carry_over(self):
        """Test Quote conversion and Recurring invoice profile carry over tax pricing and party type."""
        # Quote with inclusive pricing
        q_payload = {
            'customer': self.b2b_customer.id,
            'customer_type': 'b2b',
            'tax_pricing_type': 'tax_inclusive',
            'date': timezone.localdate().isoformat(),
            'place_of_supply': 'Kerala',
            'lines': [
                {
                    'item': self.item.id,
                    'description': 'Quote line',
                    'quantity': 1,
                    'rate': 1180.00,
                    'discount_percent': 0,
                    'gst_rate': 18
                }
            ],
            'force': True
        }
        q_res = self.client.post('/api/quotes/', q_payload, content_type='application/json')
        self.assertEqual(q_res.status_code, 201)
        q_data = q_res.json()
        self.assertEqual(q_data['tax_pricing_type'], 'tax_inclusive')

        # Convert quote to invoice
        conv_res = self.client.post(f"/api/quotes/{q_data['id']}/convert-to-invoice/", {}, content_type='application/json')
        self.assertEqual(conv_res.status_code, 200)
        conv_data = conv_res.json()
        inv_id = conv_data['invoice_id']
        inv_obj = Invoice.objects.get(pk=inv_id)
        self.assertEqual(inv_obj.tax_pricing_type, 'tax_inclusive')
        self.assertEqual(inv_obj.customer_type, 'b2b')
        self.assertEqual(inv_obj.total, Decimal('1180.00'))

        # Recurring invoice profile
        rec_payload = {
            'profile_name': 'Cloud Hosting Monthly',
            'customer': self.b2b_customer.id,
            'frequency': 'monthly',
            'start_date': timezone.localdate().isoformat(),
            'next_date': timezone.localdate().isoformat(),
            'never_ends': True,
            'tax_pricing_type': 'tax_inclusive',
            'customer_type': 'b2b',
            'lines': [
                {
                    'item': self.item.id,
                    'description': 'Monthly Host',
                    'quantity': 1,
                    'rate': 1180.00,
                    'discount_percent': 0,
                    'gst_rate': 18
                }
            ]
        }
        rec_res = self.client.post('/api/recurring-invoices/', rec_payload, content_type='application/json')
        self.assertEqual(rec_res.status_code, 201)
        rec_data = rec_res.json()
        self.assertEqual(rec_data['tax_pricing_type'], 'tax_inclusive')

        # Generate invoice from recurring
        gen_res = self.client.post(f"/api/recurring-invoices/{rec_data['id']}/generate-invoice/", {}, content_type='application/json')
        self.assertEqual(gen_res.status_code, 200)
        gen_inv_id = gen_res.json()['invoice_id']
        gen_inv = Invoice.objects.get(pk=gen_inv_id)
        self.assertEqual(gen_inv.tax_pricing_type, 'tax_inclusive')
        self.assertEqual(gen_inv.customer_type, 'b2b')
        self.assertEqual(gen_inv.total, Decimal('1180.00'))


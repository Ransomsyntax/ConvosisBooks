from decimal import Decimal
from django.test import TestCase, Client
from django.contrib.auth import get_user_model
from django.utils import timezone
from books.models import (
    Organization, Customer, Vendor, Item, SalesOrder, Invoice,
    RecurringInvoice, RetainerInvoice, PurchaseOrder, Bill, PaymentMade,
    UserProfile, CustomField, Quote
)
from books import services

User = get_user_model()

class StandardizeTransactionCardsTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='std_card_user', email='std_card@example.com', password='password123')
        self.org = Organization.objects.create(name='Card Test Org', owner=self.user, state='Kerala')
        UserProfile.objects.create(user=self.user, organization=self.org, role='admin', normalized_email='std_card@example.com')
        self.customer = Customer.objects.create(
            name='Test Customer Ltd',
            organization=self.org,
            state='Kerala',
            billing_address='100 Customer Lane',
            billing_city='Kottayam',
            billing_pincode='686001',
            shipping_address='200 Shipping Hub',
            shipping_city='Ernakulam',
            shipping_state='Kerala',
            shipping_pincode='682001'
        )
        self.vendor = Vendor.objects.create(
            name='Test Vendor Supplies',
            organization=self.org,
            state='Tamil Nadu',
            billing_address='500 Vendor St',
            billing_city='Chennai',
            billing_pincode='600001'
        )
        self.item = Item.objects.create(name='Widget X', selling_price=Decimal('500.00'), purchase_price=Decimal('350.00'), organization=self.org)
        self.client = Client()
        self.client.force_login(self.user)

    def test_sales_order_address_snapshots_and_custom_fields(self):
        today = timezone.localdate()
        payload = {
            'customer': self.customer.id,
            'customer_id': self.customer.id,
            'number': 'SO-TEST-001',
            'date': today.isoformat(),
            'billing_address_data': {
                'address': 'Custom Billing Address 999',
                'city': 'Alappuzha',
                'state': 'Kerala',
                'pincode': '688001'
            },
            'shipping_address_data': {
                'address': 'Custom Shipping Warehouse 888',
                'city': 'Thrissur',
                'state': 'Kerala',
                'pincode': '680001'
            },
            'custom_fields_data': {
                'delivery_contact': 'John Doe',
                'priority_level': 'High'
            },
            'lines': [{'description': 'Widget X', 'quantity': 2, 'rate': 500, 'gst_rate': 18}]
        }
        res = self.client.post('/api/sales-orders/', payload, content_type='application/json')
        self.assertEqual(res.status_code, 201, res.content)
        data = res.json()
        self.assertEqual(data['billing_address_data']['city'], 'Alappuzha')
        self.assertEqual(data['shipping_address_data']['city'], 'Thrissur')
        self.assertEqual(data['custom_fields_data']['priority_level'], 'High')

        # Check DB directly
        so = SalesOrder.objects.get(pk=data['id'])
        self.assertEqual(so.billing_address_data['pincode'], '688001')
        self.assertEqual(so.shipping_address_data['pincode'], '680001')
        self.assertEqual(so.custom_fields_data['delivery_contact'], 'John Doe')

        # Customer master must NOT have changed
        self.customer.refresh_from_db()
        self.assertEqual(self.customer.billing_city, 'Kottayam')

    def test_invoice_address_snapshots_and_custom_fields(self):
        today = timezone.localdate()
        payload = {
            'customer': self.customer.id,
            'customer_id': self.customer.id,
            'number': 'INV-TEST-001',
            'date': today.isoformat(),
            'due_date': today.isoformat(),
            'billing_address_data': {
                'address': 'Direct Invoice Billing 1',
                'city': 'Kollam',
                'state': 'Kerala',
                'pincode': '691001'
            },
            'shipping_address_data': {
                'address': 'Direct Invoice Shipping 2',
                'city': 'Kannur',
                'state': 'Kerala',
                'pincode': '670001'
            },
            'custom_fields_data': {
                'client_po_ref': 'CUST-PO-777'
            },
            'lines': [{'description': 'Widget X', 'quantity': 1, 'rate': 500, 'gst_rate': 18}]
        }
        try:
            res = self.client.post('/api/invoices/', payload, content_type='application/json')
        except Exception:
            import traceback
            traceback.print_exc()
            raise
        if res.status_code != 201:
            print("INVOICE ERROR:", res.status_code, res.content)
            # Check server error logs or debug
        self.assertEqual(res.status_code, 201, res.content)
        inv = Invoice.objects.get(pk=res.json()['id'])
        self.assertEqual(inv.billing_address_data['city'], 'Kollam')
        self.assertEqual(inv.shipping_address_data['city'], 'Kannur')
        self.assertEqual(inv.custom_fields_data['client_po_ref'], 'CUST-PO-777')

    def test_recurring_invoice_to_generated_invoice_propagation(self):
        today = timezone.localdate()
        rec_profile = RecurringInvoice.objects.create(
            organization=self.org,
            customer=self.customer,
            profile_name='Monthly Maintenance Pack',
            frequency='monthly',
            start_date=today,
            next_date=today,
            status='active',
            billing_address_data={'address': 'HQ Tower', 'city': 'Kochi', 'state': 'Kerala', 'pincode': '682030'},
            shipping_address_data={'address': 'Site Office', 'city': 'Calicut', 'state': 'Kerala', 'pincode': '673001'},
            custom_fields_data={'sla_tier': 'Gold'}
        )
        rec_profile.lines = [{'description': 'Monthly Retainer', 'quantity': 1, 'rate': 1000, 'gst_rate': 18}]
        rec_profile.save()

        # Generate invoice
        inv = services.generate_invoice_from_recurring_profile(rec_profile, run_date=today)
        self.assertIsNotNone(inv)
        self.assertEqual(inv.billing_address_data['city'], 'Kochi')
        self.assertEqual(inv.shipping_address_data['city'], 'Calicut')
        self.assertEqual(inv.custom_fields_data['sla_tier'], 'Gold')

    def test_purchase_order_and_bill_vendor_snapshots(self):
        today = timezone.localdate()
        po_payload = {
            'vendor': self.vendor.id,
            'vendor_id': self.vendor.id,
            'number': 'PO-TEST-001',
            'date': today.isoformat(),
            'delivery_date': today.isoformat(),
            'billing_address_data': {
                'address': 'Vendor Fin Dept',
                'city': 'Madurai',
                'state': 'Tamil Nadu',
                'pincode': '625001'
            },
            'shipping_address_data': {
                'address': 'Vendor Main Factory',
                'city': 'Salem',
                'state': 'Tamil Nadu',
                'pincode': '636001'
            },
            'custom_fields_data': {
                'quality_grade': 'Grade A'
            },
            'lines': [{'description': 'Raw material', 'quantity': 10, 'rate': 350, 'gst_rate': 18}]
        }
        res_po = self.client.post('/api/purchase-orders/', po_payload, content_type='application/json')
        self.assertEqual(res_po.status_code, 201, res_po.content)
        po = PurchaseOrder.objects.get(pk=res_po.json()['id'])
        self.assertEqual(po.billing_address_data['city'], 'Madurai')
        self.assertEqual(po.shipping_address_data['city'], 'Salem')
        self.assertEqual(po.custom_fields_data['quality_grade'], 'Grade A')

        # Bill with snapshots
        bill_payload = {
            'vendor': self.vendor.id,
            'vendor_id': self.vendor.id,
            'number': 'BILL-TEST-001',
            'date': today.isoformat(),
            'due_date': today.isoformat(),
            'billing_address_data': {
                'address': 'Vendor Fin Dept',
                'city': 'Madurai',
                'state': 'Tamil Nadu',
                'pincode': '625001'
            },
            'shipping_address_data': {
                'address': 'Vendor Main Factory',
                'city': 'Salem',
                'state': 'Tamil Nadu',
                'pincode': '636001'
            },
            'custom_fields_data': {
                'gate_pass_no': 'GP-901'
            },
            'lines': [{'description': 'Raw material', 'quantity': 10, 'rate': 350, 'gst_rate': 18}]
        }
        res_bill = self.client.post('/api/bills/', bill_payload, content_type='application/json')
        self.assertEqual(res_bill.status_code, 201, res_bill.content)
        bill = Bill.objects.get(pk=res_bill.json()['id'])
        self.assertEqual(bill.billing_address_data['city'], 'Madurai')
        self.assertEqual(bill.custom_fields_data['gate_pass_no'], 'GP-901')

    def test_payment_made_vendor_snapshots(self):
        today = timezone.localdate()
        paym_payload = {
            'vendor': self.vendor.id,
            'vendor_id': self.vendor.id,
            'number': 'PAYM-TEST-001',
            'date': today.isoformat(),
            'payment_date': today.isoformat(),
            'amount': 3500.00,
            'payment_mode': 'Bank Transfer',
            'billing_address_data': {
                'address': 'Vendor Remittance Office',
                'city': 'Chennai',
                'state': 'Tamil Nadu',
                'pincode': '600002'
            },
            'shipping_address_data': {
                'address': 'Vendor Depot 1',
                'city': 'Chennai',
                'state': 'Tamil Nadu',
                'pincode': '600003'
            },
            'custom_fields_data': {
                'bank_ref_utr': 'UTR123456789'
            }
        }
        res = self.client.post('/api/payments-made/', paym_payload, content_type='application/json')
        self.assertEqual(res.status_code, 201, res.content)
        pm = PaymentMade.objects.get(pk=res.json()['id'])
        self.assertEqual(pm.billing_address_data['city'], 'Chennai')
        self.assertEqual(pm.custom_fields_data['bank_ref_utr'], 'UTR123456789')

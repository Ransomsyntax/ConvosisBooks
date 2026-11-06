from decimal import Decimal
from django.test import TestCase
from django.contrib.auth import get_user_model
from books.models import Organization, UserProfile, Customer, Invoice, InvoiceLine, Item

User = get_user_model()

class InvoiceFlowTests(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(name='Convosis Technologies', state='Kerala', gstin='32AANCC9298C1ZE')
        self.user = User.objects.create_user(username='admin_inv', email='admin@convosis.com', password='password123')
        self.profile = UserProfile.objects.create(user=self.user, organization=self.org, role=UserProfile.ADMIN)
        self.client.login(username='admin_inv', password='password123')
        self.customer = Customer.objects.create(organization=self.org, name='Customer Acme', email='acme@example.com')
        self.item = Item.objects.create(
            organization=self.org, name='Consulting Service', item_type='service', sku='SRV-001',
            selling_price=Decimal('1000.00'), purchase_price=Decimal('500.00'), gst_rate=Decimal('18.00')
        )

    def test_next_invoice_number_lookup(self):
        res = self.client.get('/api/lookup/next-invoice-number/')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data['next_number'] == 'INV-000001' or '/INV/' in data['next_number'])
        self.assertEqual(data['prefix'], 'INV')

    def test_invoice_create_and_row_data(self):
        payload = {
            'customer': self.customer.id,
            'number': 'INV-000001',
            'order_number': 'ORD-9876',
            'date': '2026-10-15',
            'due_date': '2026-10-15',
            'place_of_supply': 'Kerala',
            'notes': 'Thanks for your business.',
            'terms': 'Due on Receipt',
            'lines': [{
                'item': self.item.id,
                'description': 'Consulting Service',
                'quantity': 1,
                'rate': 1000.00,
                'discount_percent': 0,
                'gst_rate': 18
            }]
        }
        res = self.client.post('/api/invoices/', data=payload, content_type='application/json')
        self.assertEqual(res.status_code, 201)
        inv_id = res.json()['id']

        list_res = self.client.get('/api/invoices/')
        self.assertEqual(list_res.status_code, 200)
        invoices = list_res.json()['results']
        self.assertEqual(len(invoices), 1)
        inv = invoices[0]
        self.assertEqual(inv['number'], 'INV-000001')
        self.assertEqual(inv['customer_name'], 'Customer Acme')
        self.assertEqual(inv['order_number'], 'ORD-9876')
        self.assertEqual(Decimal(str(inv['total'])), Decimal('1180.00'))

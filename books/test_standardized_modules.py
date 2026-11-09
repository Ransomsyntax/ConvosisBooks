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


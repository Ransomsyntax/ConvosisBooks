import datetime
import json
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.test import TestCase, Client
from django.utils import timezone
from .models import (
    Organization, UserProfile, Customer, Vendor, Item, Invoice, InvoiceLine,
    Bill, PaymentReceived, Account, Attachment
)

User = get_user_model()

class MultiTenancyAndSuperAdminTests(TestCase):
    def setUp(self):
        self.client = Client()

        # Create Organization A
        self.org_a = Organization.objects.create(
            name="Company Alpha",
            company_id="ALPHA-001",
            state="Maharashtra",
            gstin="27ABCDE1234F1Z5"
        )
        self.user_a = User.objects.create_user(
            username="alice",
            email="alice@alpha.com",
            password="Password123!"
        )
        UserProfile.objects.create(
            user=self.user_a,
            organization=self.org_a,
            role=UserProfile.ADMIN
        )

        # Create Organization B
        self.org_b = Organization.objects.create(
            name="Company Beta",
            company_id="BETA-001",
            state="Karnataka",
            gstin="29XYZAB5678C1D2"
        )
        self.user_b = User.objects.create_user(
            username="bob",
            email="bob@beta.com",
            password="Password123!"
        )
        UserProfile.objects.create(
            user=self.user_b,
            organization=self.org_b,
            role=UserProfile.ADMIN
        )

        # Create Super Admin User
        self.superuser = User.objects.create_superuser(
            username="superadmin",
            email="admin@convosis.com",
            password="SuperPassword123!"
        )

        today = timezone.localdate()
        due = today + datetime.timedelta(days=30)

        # Seed records for Org A
        self.cust_a = Customer.objects.create(
            organization=self.org_a,
            name="Alpha Customer 1",
            state="Maharashtra",
            active=True
        )
        self.item_a = Item.objects.create(
            organization=self.org_a,
            name="Alpha Widget",
            sku="ALPH-WID-01",
            selling_price=Decimal("1000.00"),
            item_type="goods",
            active=True
        )
        self.inv_a = Invoice.objects.create(
            organization=self.org_a,
            customer=self.cust_a,
            number="INV-A-001",
            date=today,
            due_date=due,
            total=Decimal("1180.00"),
            subtotal=Decimal("1000.00"),
            cgst=Decimal("90.00"),
            sgst=Decimal("90.00"),
            status="sent"
        )

        # Seed records for Org B
        self.cust_b = Customer.objects.create(
            organization=self.org_b,
            name="Beta Customer 1",
            state="Karnataka",
            active=True
        )
        self.item_b = Item.objects.create(
            organization=self.org_b,
            name="Beta Gadget",
            sku="BETA-GAD-01",
            selling_price=Decimal("2000.00"),
            item_type="goods",
            active=True
        )
        self.inv_b = Invoice.objects.create(
            organization=self.org_b,
            customer=self.cust_b,
            number="INV-B-001",
            date=today,
            due_date=due,
            total=Decimal("2360.00"),
            subtotal=Decimal("2000.00"),
            cgst=Decimal("180.00"),
            sgst=Decimal("180.00"),
            status="sent"
        )

    def test_company_a_cannot_see_company_b_customers(self):
        self.client.force_login(self.user_a)
        resp = self.client.get('/api/customers/')
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        ids = [c['id'] for c in data['results']]
        self.assertIn(self.cust_a.pk, ids)
        self.assertNotIn(self.cust_b.pk, ids)

    def test_company_a_cannot_access_company_b_customer_by_id(self):
        self.client.force_login(self.user_a)
        resp = self.client.get(f'/api/customers/{self.cust_b.pk}/')
        self.assertEqual(resp.status_code, 404)

    def test_company_a_cannot_edit_company_b_customer(self):
        self.client.force_login(self.user_a)
        resp = self.client.put(
            f'/api/customers/{self.cust_b.pk}/',
            data=json.dumps({'name': 'Hacked Customer'}),
            content_type='application/json'
        )
        self.assertEqual(resp.status_code, 404)
        self.cust_b.refresh_from_db()
        self.assertEqual(self.cust_b.name, "Beta Customer 1")

    def test_company_a_cannot_delete_company_b_customer(self):
        self.client.force_login(self.user_a)
        resp = self.client.delete(f'/api/customers/{self.cust_b.pk}/')
        self.assertEqual(resp.status_code, 404)
        self.assertTrue(Customer.objects.filter(pk=self.cust_b.pk).exists())

    def test_company_a_cannot_see_company_b_invoices(self):
        self.client.force_login(self.user_a)
        resp = self.client.get('/api/invoices/')
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        ids = [i['id'] for i in data['results']]
        self.assertIn(self.inv_a.pk, ids)
        self.assertNotIn(self.inv_b.pk, ids)

    def test_company_a_cannot_access_company_b_invoice_by_id(self):
        self.client.force_login(self.user_a)
        resp = self.client.get(f'/api/invoices/{self.inv_b.pk}/')
        self.assertEqual(resp.status_code, 404)

    def test_invoice_creation_rejects_cross_company_customer(self):
        """User A attempts to create an invoice using Company B's customer."""
        self.client.force_login(self.user_a)
        payload = {
            'customer': self.cust_b.pk,
            'date': timezone.localdate().isoformat(),
            'lines': [
                {'item': self.item_a.pk, 'description': 'Item Description', 'quantity': 1, 'rate': 100, 'gst_rate': 18}
            ]
        }
        resp = self.client.post('/api/invoices/', data=json.dumps(payload), content_type='application/json')
        self.assertEqual(resp.status_code, 400)
        self.assertIn('customer', resp.json().get('errors', {}))

    def test_invoice_creation_rejects_cross_company_item(self):
        """User A attempts to create an invoice using Company B's item."""
        self.client.force_login(self.user_a)
        payload = {
            'customer': self.cust_a.pk,
            'date': timezone.localdate().isoformat(),
            'lines': [
                {'item': self.item_b.pk, 'description': 'Illegal Cross Item', 'quantity': 1, 'rate': 100, 'gst_rate': 18}
            ]
        }
        resp = self.client.post('/api/invoices/', data=json.dumps(payload), content_type='application/json')
        self.assertEqual(resp.status_code, 400)
        self.assertIn('lines', resp.json().get('errors', {}))

    def test_lookup_is_scoped_to_user_company(self):
        self.client.force_login(self.user_a)
        resp = self.client.get('/api/lookup/customers/')
        self.assertEqual(resp.status_code, 200)
        cust_ids = [c['id'] for c in resp.json()]
        self.assertIn(self.cust_a.pk, cust_ids)
        self.assertNotIn(self.cust_b.pk, cust_ids)

        resp_items = self.client.get('/api/lookup/items/')
        self.assertEqual(resp_items.status_code, 200)
        item_ids = [i['id'] for i in resp_items.json()]
        self.assertIn(self.item_a.pk, item_ids)
        self.assertNotIn(self.item_b.pk, item_ids)

    def test_search_is_scoped_to_user_company(self):
        self.client.force_login(self.user_a)
        resp = self.client.get('/api/search/?q=Customer')
        self.assertEqual(resp.status_code, 200)
        labels = [r['label'] for r in resp.json()]
        self.assertIn('Alpha Customer 1', labels)
        self.assertNotIn('Beta Customer 1', labels)

    def test_reports_are_scoped_to_user_company(self):
        self.client.force_login(self.user_a)
        today = timezone.localdate().isoformat()
        resp = self.client.get(f'/api/reports/sales-by-customer/?date_from={today}&date_to={today}')
        self.assertEqual(resp.status_code, 200)
        customers = [r['customer'] for r in resp.json().get('results', [])]
        self.assertIn('Alpha Customer 1', customers)
        self.assertNotIn('Beta Customer 1', customers)

    def test_ordinary_user_cannot_access_super_admin_dashboard(self):
        self.client.force_login(self.user_a)
        resp = self.client.get('/api/super-admin/overview/')
        self.assertEqual(resp.status_code, 403)

        resp_users = self.client.get('/api/super-admin/users/')
        self.assertEqual(resp_users.status_code, 403)

    def test_super_admin_can_access_overview_and_users(self):
        self.client.force_login(self.superuser)
        resp = self.client.get('/api/super-admin/overview/')
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(set(data), {'organizations', 'users'})
        self.assertEqual(
            set(data['organizations'][0]),
            {'organization_id', 'email', 'phone', 'subscription_id', 'subscription_status'}
        )
        self.assertEqual(
            set(data['users'][0]),
            {'user_id', 'email', 'phone', 'subscription_status'}
        )
        serialized = resp.content.decode('utf-8')
        self.assertNotIn("Company Alpha", serialized)
        self.assertNotIn("Alpha Customer 1", serialized)
        self.assertNotIn("gstin", serialized.lower())

        resp_users = self.client.get('/api/super-admin/users/')
        self.assertEqual(resp_users.status_code, 200)
        users = resp_users.json().get('users', [])
        self.assertTrue(users)
        self.assertTrue(all(set(user) == {'user_id', 'email', 'phone', 'subscription_status'} for user in users))

    def test_super_admin_cannot_mutate_user_status_through_api(self):
        self.client.force_login(self.superuser)
        self.assertTrue(self.user_b.is_active)

        resp = self.client.post(f'/api/super-admin/users/{self.user_b.pk}/toggle-active/')
        self.assertEqual(resp.status_code, 403)
        self.user_b.refresh_from_db()
        self.assertTrue(self.user_b.is_active)

    def test_super_admin_cannot_deactivate_self(self):
        self.client.force_login(self.superuser)
        resp = self.client.post(f'/api/super-admin/users/{self.superuser.pk}/toggle-active/')
        self.assertEqual(resp.status_code, 403)
        self.superuser.refresh_from_db()
        self.assertTrue(self.superuser.is_active)

    def test_super_admin_company_detail_is_limited_to_allowed_metadata(self):
        self.client.force_login(self.superuser)
        resp = self.client.get(f'/api/super-admin/companies/{self.org_a.pk}/')
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(
            set(data),
            {'organization', 'users'}
        )
        self.assertEqual(
            set(data['organization']),
            {'organization_id', 'email', 'phone', 'subscription_id', 'subscription_status'}
        )
        self.assertNotIn("Company Alpha", resp.content.decode('utf-8'))
        self.assertNotIn("Alpha Customer 1", resp.content.decode('utf-8'))

        resp_toggle = self.client.post(f'/api/super-admin/companies/{self.org_a.pk}/toggle-active/')
        self.assertEqual(resp_toggle.status_code, 403)
        self.org_a.refresh_from_db()
        self.assertTrue(self.org_a.is_active)

    def test_superuser_cannot_access_business_api_data(self):
        self.client.force_login(self.superuser)
        for path in ('/api/customers/', '/api/invoices/', '/api/settings/'):
            response = self.client.get(path)
            self.assertEqual(response.status_code, 403, path)
            self.assertNotIn("Alpha Customer 1", response.content.decode('utf-8'))

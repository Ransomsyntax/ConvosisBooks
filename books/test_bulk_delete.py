import json
from django.contrib.auth import get_user_model
from django.test import Client, TestCase

from books.models import Customer, Item, Organization, UserProfile

User = get_user_model()


class BulkDeleteTestCase(TestCase):
    def setUp(self):
        super().setUp()
        self.org1 = Organization.objects.create(name='Org Alpha', is_active=True)
        self.user1 = User.objects.create_user(username='alpha_user', email='alpha@test.com', password='Password123!')
        self.profile1 = UserProfile.objects.create(user=self.user1, organization=self.org1, role=UserProfile.ADMIN)

        self.org2 = Organization.objects.create(name='Org Beta', is_active=True)
        self.user2 = User.objects.create_user(username='beta_user', email='beta@test.com', password='Password123!')
        self.profile2 = UserProfile.objects.create(user=self.user2, organization=self.org2, role=UserProfile.ADMIN)

        self.client1 = Client()
        self.client1.force_login(self.user1)

        self.client2 = Client()
        self.client2.force_login(self.user2)

    def test_bulk_delete_multiple_records(self):
        c1 = Customer.objects.create(organization=self.org1, name='Customer 1', email='c1@test.com')
        c2 = Customer.objects.create(organization=self.org1, name='Customer 2', email='c2@test.com')
        c3 = Customer.objects.create(organization=self.org1, name='Customer 3', email='c3@test.com')

        res = self.client1.delete(
            '/api/customers/',
            data=json.dumps({'ids': [c1.id, c2.id]}),
            content_type='application/json'
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data.get('status'), 'ok')
        self.assertEqual(data.get('deleted'), 2)

        self.assertFalse(Customer.objects.filter(id=c1.id).exists())
        self.assertFalse(Customer.objects.filter(id=c2.id).exists())
        self.assertTrue(Customer.objects.filter(id=c3.id).exists())

    def test_bulk_delete_single_record(self):
        c1 = Customer.objects.create(organization=self.org1, name='Solo Customer', email='solo@test.com')
        res = self.client1.delete(
            '/api/customers/',
            data=json.dumps({'ids': [c1.id]}),
            content_type='application/json'
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data.get('status'), 'ok')
        self.assertEqual(data.get('deleted'), 1)
        self.assertFalse(Customer.objects.filter(id=c1.id).exists())

    def test_bulk_delete_empty_ids_returns_400(self):
        res = self.client1.delete(
            '/api/customers/',
            data=json.dumps({'ids': []}),
            content_type='application/json'
        )
        self.assertEqual(res.status_code, 400)

    def test_bulk_delete_tenant_isolation(self):
        c_beta = Customer.objects.create(organization=self.org2, name='Beta Customer', email='beta_cust@test.com')
        c_alpha = Customer.objects.create(organization=self.org1, name='Alpha Customer', email='alpha_cust@test.com')

        # Alpha attempts to delete Beta's customer
        res = self.client1.delete(
            '/api/customers/',
            data=json.dumps({'ids': [c_beta.id]}),
            content_type='application/json'
        )
        # Should fail and not delete Beta's customer
        self.assertEqual(res.status_code, 400)
        self.assertTrue(Customer.objects.filter(id=c_beta.id).exists())

        # If Alpha attempts to delete both, only Alpha's own record can be deleted if partial, or fails
        res2 = self.client1.delete(
            '/api/customers/',
            data=json.dumps({'ids': [c_alpha.id, c_beta.id]}),
            content_type='application/json'
        )
        self.assertEqual(res2.status_code, 200)
        data = res2.json()
        self.assertEqual(data.get('status'), 'partial')
        self.assertEqual(data.get('deleted'), 1)
        self.assertEqual(data.get('failed'), 1)
        self.assertFalse(Customer.objects.filter(id=c_alpha.id).exists())
        self.assertTrue(Customer.objects.filter(id=c_beta.id).exists())

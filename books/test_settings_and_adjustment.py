from decimal import Decimal
import json
import datetime
from django.test import TestCase
from django.contrib.auth.models import User
from books.models import (
    Organization, Role, UserInvitation, CurrencySetting, PaymentTermSetting,
    UserProfile, Item, Warehouse, StockMovement
)
from books import services

class SettingsAndAdjustmentTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='admin_user', password='password123', email='admin@example.com')
        self.org = Organization.objects.create(name='Acme Corp', code='ACM')
        self.profile = UserProfile.objects.create(user=self.user, organization=self.org)
        self.client.force_login(self.user)
        services.ensure_default_roles(self.org)
        services.ensure_default_settings(self.org)

    def test_default_roles_seeded(self):
        roles = Role.objects.filter(organization=self.org)
        self.assertGreaterEqual(roles.count(), 5)
        admin_role = roles.filter(name='Admin').first()
        self.assertIsNotNone(admin_role)
        self.assertTrue(admin_role.permissions.get('sales', {}).get('invoices', {}).get('create'))

    def test_custom_role_crud(self):
        # Create role
        resp = self.client.post('/api/settings/roles/', data=json.dumps({
            'name': 'Sales Rep',
            'description': 'Can manage sales transactions',
            'permissions': {'sales': {'invoices': {'view': True, 'create': True}}}
        }), content_type='application/json')
        self.assertEqual(resp.status_code, 201, msg=resp.content.decode('utf-8'))
        role_id = resp.json()['id']

        # Duplicate role
        dup_resp = self.client.post(f'/api/settings/roles/{role_id}/duplicate/')
        self.assertEqual(dup_resp.status_code, 201)
        self.assertTrue(Role.objects.filter(name__icontains='Copy').exists())

    def test_user_invitation(self):
        resp = self.client.post('/api/settings/users/invite/', data=json.dumps({
            'name': 'John Doe',
            'email': 'john@example.com',
            'role': 'Staff'
        }), content_type='application/json')
        self.assertEqual(resp.status_code, 201, msg=resp.content.decode('utf-8'))
        self.assertTrue(UserInvitation.objects.filter(email='john@example.com').exists())

    def test_stock_adjustment_form_fields_and_execution(self):
        wh = Warehouse.objects.create(organization=self.org, name='Main Warehouse', code='WH-MAIN')
        it = Item.objects.create(organization=self.org, name='Widget A', sku='ACM/ITEM/000001',
                                 track_inventory=True, stock=Decimal('10.000'), purchase_price=Decimal('50.00'))

        payload = {
            'mode_of_adjustment': 'quantity',
            'reference_number': 'ACM/ADJ/26-27/00001',
            'date': '2026-11-06',
            'warehouse': wh.id,
            'account': 'Cost of Goods Sold',
            'reason': 'Stock recount',
            'description': 'Physical count verification',
            'status': 'adjusted',
            'items': [{
                'item': it.id,
                'new_quantity': 15.0,
                'quantity_adjusted': 5.0,
                'project': '',
                'reporting_tags': 'Annual Audit'
            }]
        }
        resp = self.client.post('/api/stock-adjustments/', data=json.dumps(payload), content_type='application/json')
        self.assertEqual(resp.status_code, 201, msg=resp.content.decode('utf-8'))

        it.refresh_from_db()
        self.assertEqual(it.stock, Decimal('15.000'))
        mv = StockMovement.objects.filter(reference='ACM/ADJ/26-27/00001').first()
        self.assertIsNotNone(mv)
        self.assertEqual(mv.change, Decimal('5.000'))
        self.assertIn('Annual Audit', mv.notes)


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

    def test_settings_all_overview(self):
        resp = self.client.get('/api/settings/all/')
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn('organization', data)
        self.assertIn('users', data)
        self.assertIn('roles', data)
        self.assertIn('currencies', data)
        self.assertIn('payment_terms', data)

    def test_settings_taxes_and_direct_taxes_flow(self):
        # 1. GET taxes
        get_resp = self.client.get('/api/settings/taxes/')
        self.assertEqual(get_resp.status_code, 200)
        gdata = get_resp.json()
        self.assertIn('taxes', gdata)
        self.assertIn('tds_sections', gdata)
        self.assertIn('tcs_sections', gdata)
        self.assertIn('tax_exemptions', gdata)

        # 2. POST new custom tax
        post_tax = self.client.post('/api/settings/taxes/', data=json.dumps({
            'new_tax': {'name': 'Flood Cess 1%', 'rate': 1.0, 'type': 'Cess', 'country': 'India'}
        }), content_type='application/json')
        self.assertEqual(post_tax.status_code, 200)
        self.org.refresh_from_db()
        custom_taxes = (self.org.tax_settings or {}).get('custom_taxes', [])
        self.assertTrue(any(t['name'] == 'Flood Cess 1%' for t in custom_taxes))

        # 3. POST direct tax settings
        post_dts = self.client.post('/api/settings/taxes/', data=json.dumps({
            'direct_tax_settings': {
                'tds_level': 'line',
                'enable_tds_liabilities_report': True
            }
        }), content_type='application/json')
        self.assertEqual(post_dts.status_code, 200)
        self.org.refresh_from_db()
        self.assertEqual(self.org.direct_tax_settings.get('tds_level'), 'line')
        self.assertTrue(self.org.direct_tax_settings.get('enable_tds_liabilities_report'))

    def test_settings_organization_submodules_persistence(self):
        payload = {
            'opening_cash': 25000.50,
            'general_settings': {
                'eway_bill': {'enabled': True, 'inter_state_threshold': 50000, 'username': 'ewb_user'},
                'einvoicing': {'enabled': True, 'threshold': '5cr', 'portal': 'einvoice1'},
                'msme': {'registered': True, 'udyam_number': 'UDYAM-MH-01-0012345', 'enterprise_type': 'small'},
                'opening_balances': {'migration_date': '2026-04-01', 'is_locked': False}
            }
        }
        resp = self.client.post('/api/settings/organization/', data=json.dumps(payload), content_type='application/json')
        self.assertEqual(resp.status_code, 200)
        self.org.refresh_from_db()
        self.assertEqual(self.org.opening_cash, Decimal('25000.50'))
        gen = self.org.general_settings
        self.assertTrue(gen.get('eway_bill', {}).get('enabled'))
        self.assertEqual(gen.get('eway_bill', {}).get('username'), 'ewb_user')
        self.assertTrue(gen.get('einvoicing', {}).get('enabled'))
        self.assertEqual(gen.get('msme', {}).get('udyam_number'), 'UDYAM-MH-01-0012345')
        self.assertEqual(gen.get('opening_balances', {}).get('migration_date'), '2026-04-01')

    def test_settings_currencies_and_payment_terms_crud(self):
        # Currency POST
        curr_resp = self.client.post('/api/settings/currencies/', data=json.dumps({
            'code': 'GBP',
            'name': 'British Pound',
            'symbol': '£',
            'exchange_rate': '108.50'
        }), content_type='application/json')
        self.assertEqual(curr_resp.status_code, 201)
        self.assertTrue(CurrencySetting.objects.filter(organization=self.org, code='GBP').exists())

        # Payment Term POST
        term_resp = self.client.post('/api/settings/payment-terms/', data=json.dumps({
            'name': 'Net 120',
            'days': 120,
            'is_default': False
        }), content_type='application/json')
        self.assertEqual(term_resp.status_code, 201)
        self.assertTrue(PaymentTermSetting.objects.filter(organization=self.org, name='Net 120').exists())

        # Reject duplicate term
        dup_term = self.client.post('/api/settings/payment-terms/', data=json.dumps({
            'name': 'Net 120',
            'days': 120
        }), content_type='application/json')
        self.assertEqual(dup_term.status_code, 400)



import json
from decimal import Decimal
from django.contrib.auth.models import User
from django.test import TestCase, Client
from django.utils import timezone

from books.models import (
    Organization, UserProfile, Customer, Quote, SalesOrder,
    DeliveryChallan, RetainerInvoice, Project, TimeLog, AuditLog
)
from books.features.module_gating import (
    get_organization_module_preferences,
    get_organization_enabled_modules,
    is_module_enabled,
    validate_module_dependencies,
    DEFAULT_MODULE_SETTINGS
)


class ModuleGatingTestCase(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(
            username='admin_test',
            email='admin@convosis.com',
            password='testpassword123'
        )
        self.org = Organization.objects.create(
            name='Test Tech Pvt Ltd',
            company_id='TESTTECH01',
            status='active',
            owner=self.user,
            general_settings={
                'enterprise_preferences': {
                    'generalModules': {
                        'enableQuotes': True,
                        'enableSalesOrders': True,
                        'enableDeliveryChallans': True,
                        'enableRetainerInvoices': True,
                        'enableProjectsTimesheets': True,
                        'enableBillsOfEntry': False,
                        'enablePaymentRetention': False,
                    }
                }
            }
        )
        self.profile = UserProfile.objects.create(
            user=self.user,
            organization=self.org,
            role=UserProfile.ADMIN
        )
        self.customer = Customer.objects.create(
            organization=self.org,
            name='Acme Infotech Ltd',
            email='billing@acme.com',
            state='Kerala'
        )
        self.client.force_login(self.user)

    def test_get_organization_enabled_modules_default(self):
        em = get_organization_enabled_modules(self.org)
        self.assertTrue(em['quotes'])
        self.assertTrue(em['sales_orders'])
        self.assertTrue(em['delivery_challans'])
        self.assertTrue(em['retainer_invoices'])
        self.assertTrue(em['projects'])
        self.assertTrue(em['timesheets'])
        self.assertFalse(em['bills_of_entry'])
        self.assertFalse(em['payment_retention'])

    def test_is_module_enabled(self):
        self.assertTrue(is_module_enabled(self.org, 'quotes'))
        self.assertTrue(is_module_enabled(self.org, 'sales-orders'))
        self.assertTrue(is_module_enabled(self.org, 'sales_orders'))
        self.assertFalse(is_module_enabled(self.org, 'bills-of-entry'))

    def test_validate_module_dependencies(self):
        # Delivery Challans enabled without Sales Orders should fail
        valid, msg = validate_module_dependencies(self.org, {
            'enableSalesOrders': False,
            'enableDeliveryChallans': True
        })
        self.assertFalse(valid)
        self.assertIn('Delivery Challans depends on Sales Orders', msg)

        # Both enabled should pass
        valid, msg = validate_module_dependencies(self.org, {
            'enableSalesOrders': True,
            'enableDeliveryChallans': True
        })
        self.assertTrue(valid)
        self.assertIsNone(msg)

        # Both disabled should pass
        valid, msg = validate_module_dependencies(self.org, {
            'enableSalesOrders': False,
            'enableDeliveryChallans': False
        })
        self.assertTrue(valid)
        self.assertIsNone(msg)

    def test_api_me_and_settings_me_returns_enabled_modules(self):
        resp = self.client.get('/api/me/')
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn('enabled_modules', data)
        self.assertTrue(data['enabled_modules']['quotes'])
        self.assertTrue(data['enabled_modules']['sales_orders'])

        resp_settings_me = self.client.get('/api/settings/me/')
        self.assertEqual(resp_settings_me.status_code, 200)
        data_s = resp_settings_me.json()
        self.assertIn('enabled_modules', data_s)
        self.assertTrue(data_s['enabled_modules']['quotes'])

    def test_update_general_modules_preferences_api(self):
        payload = {
            'values': {
                'enableQuotes': False,
                'enableSalesOrders': True,
                'enableDeliveryChallans': True,
                'enableRetainerInvoices': False,
                'enableProjectsTimesheets': False,
                'enableBillsOfEntry': False,
                'enablePaymentRetention': False
            }
        }
        resp = self.client.put(
            '/api/settings/enterprise/preferences/generalModules/',
            data=json.dumps(payload),
            content_type='application/json'
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data['integration_status'], 'wired')
        self.assertIn('enabled_modules', data)
        self.assertFalse(data['enabled_modules']['quotes'])
        self.assertTrue(data['enabled_modules']['sales_orders'])
        self.assertFalse(data['enabled_modules']['retainer_invoices'])

        # Verify audit log was recorded
        audit = AuditLog.objects.filter(
            organization=self.org,
            module='settings',
            submodule='generalModules'
        ).last()
        self.assertIsNotNone(audit)
        self.assertIn('generalModules', audit.summary)

    def test_disabling_sales_orders_with_delivery_challans_fails_via_api(self):
        payload = {
            'values': {
                'enableQuotes': True,
                'enableSalesOrders': False,
                'enableDeliveryChallans': True,
                'enableRetainerInvoices': True,
                'enableProjectsTimesheets': True,
                'enableBillsOfEntry': False,
                'enablePaymentRetention': False
            }
        }
        resp = self.client.put(
            '/api/settings/enterprise/preferences/generalModules/',
            data=json.dumps(payload),
            content_type='application/json'
        )
        self.assertEqual(resp.status_code, 400)
        data = resp.json()
        self.assertIn('Delivery Challans depends on Sales Orders', data.get('error', ''))

    def test_resource_gating_blocks_creates_when_module_disabled(self):
        # Disable Quotes
        self.org.general_settings['enterprise_preferences']['generalModules']['enableQuotes'] = False
        self.org.save(update_fields=['general_settings'])

        # Create Quote must be blocked with 403 Forbidden
        create_payload = {
            'customer': self.customer.id,
            'date': str(timezone.localdate()),
            'expiry_date': str(timezone.localdate()),
            'number': 'QTN-GATED-001',
            'lines': [{'description': 'Test Service', 'quantity': 1, 'rate': '100.00', 'gst_rate': 18}]
        }
        resp = self.client.post('/api/quotes/', data=json.dumps(create_payload), content_type='application/json')
        self.assertEqual(resp.status_code, 403)
        self.assertIn('Quotes module is disabled', resp.json().get('error', ''))

    def test_resource_gating_preserves_historical_data_access(self):
        # Create quote while enabled
        quote = Quote.objects.create(
            organization=self.org,
            customer=self.customer,
            number='QTN-HIST-001',
            date=timezone.localdate(),
            expiry_date=timezone.localdate(),
            due_date=timezone.localdate(),
            total=Decimal('500.00'),
            status='sent'
        )

        # Now disable Quotes module
        self.org.general_settings['enterprise_preferences']['generalModules']['enableQuotes'] = False
        self.org.save(update_fields=['general_settings'])

        # GET collection must succeed (historical data preserved!)
        resp_list = self.client.get('/api/quotes/')
        self.assertEqual(resp_list.status_code, 200)
        data = resp_list.json()
        self.assertEqual(data['count'], 1)
        self.assertEqual(data['results'][0]['number'], 'QTN-HIST-001')

        # GET detail must succeed
        resp_detail = self.client.get(f'/api/quotes/{quote.pk}/')
        self.assertEqual(resp_detail.status_code, 200)
        self.assertEqual(resp_detail.json()['number'], 'QTN-HIST-001')

        # Write operations must be blocked with 403 Forbidden
        resp_put = self.client.put(f'/api/quotes/{quote.pk}/', data=json.dumps({'notes': 'New notes'}), content_type='application/json')
        self.assertEqual(resp_put.status_code, 403)

        resp_del = self.client.delete(f'/api/quotes/{quote.pk}/')
        self.assertEqual(resp_del.status_code, 403)

    def test_sales_orders_and_challans_gating(self):
        # Disable Sales Orders and Delivery Challans
        self.org.general_settings['enterprise_preferences']['generalModules']['enableSalesOrders'] = False
        self.org.general_settings['enterprise_preferences']['generalModules']['enableDeliveryChallans'] = False
        self.org.save(update_fields=['general_settings'])

        # POST to sales-orders blocked
        resp_so = self.client.post('/api/sales-orders/', data=json.dumps({'customer': self.customer.id}), content_type='application/json')
        self.assertEqual(resp_so.status_code, 403)
        self.assertIn('Sales Orders module is disabled', resp_so.json().get('error', ''))

        # POST to delivery-challans blocked
        resp_dc = self.client.post('/api/delivery-challans/', data=json.dumps({'customer': self.customer.id}), content_type='application/json')
        self.assertEqual(resp_dc.status_code, 403)
        self.assertIn('Delivery Challans module is disabled', resp_dc.json().get('error', ''))

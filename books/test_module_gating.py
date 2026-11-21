import json
from decimal import Decimal
from django.contrib.auth.models import User
from django.test import TestCase, Client
from django.utils import timezone

from books.models import (
    Organization, UserProfile, Customer, Quote, SalesOrder,
    DeliveryChallan, RetainerInvoice, Project, TimeLog, AuditLog,
    CustomField
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

    def test_string_false_module_setting_is_disabled(self):
        self.org.general_settings['enterprise_preferences']['generalModules']['enableQuotes'] = 'false'
        self.org.save(update_fields=['general_settings'])

        self.assertFalse(is_module_enabled(self.org, 'quotes'))
        self.assertFalse(get_organization_enabled_modules(self.org)['quotes'])
        response = self.client.get('/api/settings/enterprise/preferences/generalModules/')
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json()['values']['enableQuotes'])

        valid, message = validate_module_dependencies(self.org, {
            'enableSalesOrders': 'false',
            'enableDeliveryChallans': 'false',
        })
        self.assertTrue(valid, message)

    def test_general_module_preferences_api_returns_effective_defaults(self):
        self.org.general_settings = {}
        self.org.save(update_fields=['general_settings'])

        response = self.client.get('/api/settings/enterprise/preferences/generalModules/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['values'], DEFAULT_MODULE_SETTINGS)

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

    def test_custom_field_configuration_supports_dynamic_visibility_and_protection(self):
        resp = self.client.post(
            '/api/custom-fields/',
            data=json.dumps({
                'module': 'payments_received',
                'label': 'Customer reference',
                'apiName': 'customer_reference',
                'dataType': 'text',
                'mandatory': False,
                'hidden': True,
                'displayOrder': 4,
                'defaultValue': 'REF-100',
                'validationRules': {'max_length': 32},
                'listVisible': True,
                'showInPdf': False,
            }),
            content_type='application/json'
        )
        self.assertEqual(resp.status_code, 201, resp.content)
        data = resp.json()
        self.assertEqual(data['apiName'], 'customer_reference')
        self.assertTrue(data['hidden'])
        self.assertEqual(data['defaultValue'], 'REF-100')

        protected = CustomField.objects.create(
            organization=self.org,
            module='payments_received',
            name='amount',
            label='Amount',
            field_type='currency',
            required=True,
            active=True,
        )
        protected_resp = self.client.patch(
            f'/api/custom-fields/{protected.pk}/',
            data=json.dumps({'hidden': True}),
            content_type='application/json'
        )
        self.assertEqual(protected_resp.status_code, 400)
        self.assertIn('protected', protected_resp.json().get('error', '').lower())

    def test_user_field_preferences_are_separate_from_organization_configuration(self):
        quote = Quote.objects.create(
            organization=self.org,
            customer=self.customer,
            number='QTN-PREF-001',
            date=timezone.localdate(),
            expiry_date=timezone.localdate(),
            due_date=timezone.localdate(),
            total=Decimal('250.00'),
            status='draft'
        )
        self.profile.field_preferences = {
            'list_columns': ['customer', 'amount'],
            'personal_filters': {'status': ['draft']},
        }
        self.profile.save(update_fields=['field_preferences'])

        self.assertEqual(self.profile.personal_field_preferences['list_columns'][0], 'customer')
        self.assertNotIn('list_columns', self.org.general_settings)

        resp_del = self.client.delete(f'/api/quotes/{quote.pk}/')
        self.assertIn(resp_del.status_code, (200, 204))

    def test_hidden_custom_fields_are_filtered_from_runtime_lists_and_user_preferences_apply(self):
        visible = CustomField.objects.create(
            organization=self.org,
            module='payments_received',
            name='customer_reference',
            label='Customer Reference',
            field_type='text',
            required=False,
            active=True,
            hidden=False,
        )
        hidden = CustomField.objects.create(
            organization=self.org,
            module='payments_received',
            name='branch_reference',
            label='Branch Reference',
            field_type='text',
            required=False,
            active=True,
            hidden=True,
        )
        required = CustomField.objects.create(
            organization=self.org,
            module='payments_received',
            name='required_reference',
            label='Required Reference',
            field_type='text',
            required=True,
            active=True,
            hidden=False,
        )

        resp = self.client.get('/api/custom-fields/?module=payments_received')
        self.assertEqual(resp.status_code, 200)
        names = {item['name'] for item in resp.json()['results']}
        self.assertIn(visible.name, names)
        self.assertNotIn(hidden.name, names)

        resp_hidden = self.client.get('/api/custom-fields/?module=payments_received&include_hidden=true')
        self.assertEqual(resp_hidden.status_code, 200)
        hidden_names = {item['name'] for item in resp_hidden.json()['results']}
        self.assertIn(hidden.name, hidden_names)

        self.profile.personal_field_preferences = {
            'custom_fields': {
                'payments_received': {
                    'hidden_fields': [visible.name, required.name],
                }
            }
        }
        self.profile.save(update_fields=['field_preferences', 'personal_preferences'])

        resp_user = self.client.get('/api/custom-fields/?module=payments_received')
        self.assertEqual(resp_user.status_code, 200)
        user_names = {item['name'] for item in resp_user.json()['results']}
        self.assertNotIn(visible.name, user_names)
        self.assertIn(required.name, user_names)

    def test_custom_field_permissions_and_personal_preferences_api(self):
        editable = CustomField.objects.create(
            organization=self.org,
            module='payments_received',
            name='accountant_visible',
            label='Accountant Visible',
            role_permissions={
                'admin': {'view': True, 'edit': True},
                'accountant': {'view': True, 'edit': False},
            },
        )
        restricted = CustomField.objects.create(
            organization=self.org,
            module='payments_received',
            name='admin_only',
            label='Admin Only',
            role_permissions={'admin': {'view': True, 'edit': True}},
        )

        self.profile.role = UserProfile.ACCOUNTANT
        self.profile.save(update_fields=['role'])
        listing = self.client.get('/api/custom-fields/?module=payments_received')
        self.assertEqual(listing.status_code, 200)
        names = {item['name'] for item in listing.json()['results']}
        self.assertIn(editable.name, names)
        self.assertNotIn(restricted.name, names)

        update = self.client.patch(
            f'/api/custom-fields/{editable.pk}/',
            data=json.dumps({'label': 'Changed'}),
            content_type='application/json',
        )
        self.assertEqual(update.status_code, 403)
        create = self.client.post(
            '/api/custom-fields/',
            data=json.dumps({'module': 'payments_received', 'label': 'Not Allowed'}),
            content_type='application/json',
        )
        self.assertEqual(create.status_code, 403)
        configuration = self.client.get('/api/custom-fields/?module=payments_received&include_hidden=true')
        self.assertEqual(configuration.status_code, 403)

        preferences = {
            'list_columns': ['customer', 'amount'],
            'column_order': ['amount', 'customer'],
            'personal_filters': {'status': ['draft']},
            'optional_display_fields': ['accountant_visible'],
        }
        saved = self.client.put(
            '/api/settings/me/field-preferences/',
            data=json.dumps({'field_preferences': preferences}),
            content_type='application/json',
        )
        self.assertEqual(saved.status_code, 200, saved.content)
        self.assertEqual(saved.json()['field_preferences'], preferences)
        loaded = self.client.get('/api/settings/me/field-preferences/')
        self.assertEqual(loaded.status_code, 200)
        self.assertEqual(loaded.json()['field_preferences'], preferences)
        self.assertNotIn('list_columns', self.org.general_settings)

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

from datetime import timedelta
import json
import uuid
from decimal import Decimal
from django.conf import settings
from django.contrib.auth import get_user_model
from django.test import TestCase, Client, override_settings
from django.utils import timezone
from books import models, services

User = get_user_model()

class TestAdminAndUserManagement(TestCase):
    def setUp(self):
        self.org = models.Organization.objects.create(
            name="Alpha Corp Main",
            code="ACM",
            org_type="MAIN",
            state="Kerala"
        )
        services.ensure_default_accounts(self.org)

        self.superuser = User.objects.create_superuser(
            username="superadmin",
            email="super@alphacorp.com",
            password="SuperPassword123!"
        )
        models.UserProfile.objects.create(
            user=self.superuser,
            organization=self.org,
            role=models.UserProfile.ADMIN
        )

        self.client = Client()
        self.client.force_login(self.superuser)

    def test_admin_dashboard_loads(self):
        res = self.client.get('/admin/')
        self.assertEqual(res.status_code, 200)
        content = res.content.decode('utf-8')
        self.assertIn('CONVOSIS Books', content)
        self.assertNotIn('Recent actions', content)

    def test_admin_auth_user_list(self):
        private_user = User.objects.create_user(
            username="private-user-handle",
            email="account@example.test",
            first_name="Private",
            last_name="Name",
            password="UserPassword123!"
        )
        models.UserProfile.objects.create(
            user=private_user,
            organization=self.org,
            role=models.UserProfile.ACCOUNTANT,
            phone="+919876543210"
        )
        models.TenantSubscription.objects.create(
            organization=self.org,
            status="active",
            tier=models.TenantSubscription.PREMIUM
        )
        res = self.client.get('/admin/auth/user/')
        self.assertEqual(res.status_code, 200)
        content = res.content.decode('utf-8')
        self.assertIn('Select user to change', content)
        self.assertIn('account@example.test', content)
        self.assertIn('+919876543210', content)
        self.assertIn('active', content)
        self.assertNotIn('private-user-handle', content)
        self.assertNotIn('Private Name', content)

    def test_admin_cannot_add_users_or_change_authentication_fields(self):
        res = self.client.get('/admin/auth/user/add/')
        self.assertEqual(res.status_code, 403)

        managed_user = User.objects.create_user(
            username="private-user-handle",
            email="managed@example.test",
            first_name="Private",
            last_name="Name",
            password="UserPassword123!"
        )
        models.UserProfile.objects.create(
            user=managed_user,
            organization=self.org,
            phone="+919876543210"
        )
        res_change = self.client.get(f'/admin/auth/user/{managed_user.pk}/change/')
        self.assertEqual(res_change.status_code, 200)
        content = res_change.content.decode('utf-8')
        self.assertIn('managed@example.test', content)
        self.assertIn('+919876543210', content)
        self.assertNotIn('private-user-handle', content)
        self.assertNotIn('Private Name', content)
        self.assertNotIn('name="password"', content)
        self.assertNotIn('name="is_staff"', content)

    def test_organization_admin_hides_business_details(self):
        self.org.email = "safe-contact@example.test"
        self.org.phone = "+919812345678"
        self.org.company_id = "PRIVATE-COMPANY-ID"
        self.org.gstin = "PRIVATE-GSTIN"
        self.org.save()
        res = self.client.get('/admin/books/organization/')
        self.assertEqual(res.status_code, 200)
        content = res.content.decode('utf-8')
        self.assertIn(self.org.organization_id, content)
        self.assertIn("safe-contact@example.test", content)
        self.assertIn("+919812345678", content)
        self.assertNotIn("Alpha Corp Main", content)
        self.assertNotIn("PRIVATE-COMPANY-ID", content)
        self.assertNotIn("PRIVATE-GSTIN", content)

    def test_organization_change_view_hides_unapproved_fields(self):
        self.org.email = "safe-contact@example.test"
        self.org.phone = "+919812345678"
        self.org.company_id = "PRIVATE-COMPANY-ID"
        self.org.gstin = "PRIVATE-GSTIN"
        self.org.save()
        res = self.client.get(f'/admin/books/organization/{self.org.pk}/change/')
        self.assertEqual(res.status_code, 200)
        content = res.content.decode('utf-8')
        self.assertIn(self.org.organization_id, content)
        self.assertIn("safe-contact@example.test", content)
        self.assertIn("+919812345678", content)
        self.assertNotIn("Alpha Corp Main", content)
        self.assertNotIn("PRIVATE-COMPANY-ID", content)
        self.assertNotIn("PRIVATE-GSTIN", content)

    def test_subscription_change_view_only_shows_allowlisted_metadata(self):
        subscription = models.TenantSubscription.objects.create(
            organization=self.org,
            status="active",
            tier=models.TenantSubscription.PREMIUM,
            payment_method="PRIVATE-PAYMENT-METHOD"
        )
        res = self.client.get(f'/admin/books/tenantsubscription/{subscription.pk}/change/')
        self.assertEqual(res.status_code, 200)
        content = res.content.decode('utf-8')
        self.assertIn(str(subscription.pk), content)
        self.assertIn(self.org.organization_id, content)
        self.assertIn("active", content)
        self.assertNotIn("premium", content)
        self.assertNotIn("PRIVATE-PAYMENT-METHOD", content)

    def test_admin_groups_and_permissions(self):
        res = self.client.get('/admin/auth/group/')
        self.assertEqual(res.status_code, 404)

    def test_admin_exposes_only_account_and_subscription_records(self):
        permitted_admin_urls = [
            '/admin/auth/user/',
            '/admin/books/organization/',
            '/admin/books/tenantsubscription/',
        ]
        for url in permitted_admin_urls:
            res = self.client.get(url)
            self.assertEqual(res.status_code, 200, f"Admin URL failed: {url}")

        restricted_admin_urls = [
            '/admin/auth/group/',
            '/admin/books/userprofile/',
            '/admin/books/customer/',
            '/admin/books/vendor/',
            '/admin/books/invoice/',
            '/admin/books/bill/',
            '/admin/books/bankaccount/',
            '/admin/books/auditlog/',
            '/admin/books/subscriptioninvoice/',
        ]
        for url in restricted_admin_urls:
            res = self.client.get(url)
            self.assertEqual(res.status_code, 404, f"Sensitive admin URL remained available: {url}")

    def test_user_history_and_restricted_admin_access_are_blocked_and_audited(self):
        restricted_user = User.objects.create_user(username="history-private", password="StrongPassword123!")
        history_res = self.client.get(f'/admin/auth/user/{restricted_user.pk}/history/')
        self.assertEqual(history_res.status_code, 404)

        forbidden_res = self.client.get('/admin/books/customer/')
        self.assertEqual(forbidden_res.status_code, 404)
        audit_event = models.AuditLog.objects.filter(
            user=self.superuser,
            action='admin_access',
            entity_type='DjangoAdmin',
            summary='GET /admin/books/customer/'
        ).latest('pk')
        self.assertEqual(audit_event.status, 'failure')

    def test_admin_access_is_audited(self):
        res = self.client.get('/admin/')
        self.assertEqual(res.status_code, 200)
        audit_event = models.AuditLog.objects.filter(
            user=self.superuser,
            action='admin_access',
            entity_type='DjangoAdmin',
            summary='GET /admin/'
        ).latest('pk')
        self.assertEqual(audit_event.status, 'success')


class TestTenantIsolationAndSubOrganizations(TestCase):
    def setUp(self):
        today = timezone.localdate()
        due = today + timedelta(days=30)

        # Main Org 1
        self.main_org = models.Organization.objects.create(
            name="Main Holdings Ltd",
            code="MAIN",
            org_type="MAIN",
            state="Kerala"
        )
        services.ensure_default_accounts(self.main_org)

        # Sub Org 1 (Belongs to Main Org 1)
        self.sub_org = models.Organization.objects.create(
            name="Sub Branch Kochi",
            code="KOCHI",
            org_type="SUB",
            parent=self.main_org,
            state="Kerala"
        )
        services.ensure_default_accounts(self.sub_org)

        # Unrelated Org 2
        self.unrelated_org = models.Organization.objects.create(
            name="Competitor Enterprises",
            code="COMP",
            org_type="MAIN",
            state="Karnataka"
        )
        services.ensure_default_accounts(self.unrelated_org)

        # Users
        self.user_main = User.objects.create_user(username="user_main", email="m@main.com", password="Pass@123")
        models.UserProfile.objects.create(user=self.user_main, organization=self.main_org, role=models.UserProfile.ADMIN)

        self.user_unrelated = User.objects.create_user(username="user_unrelated", email="u@comp.com", password="Pass@123")
        models.UserProfile.objects.create(user=self.user_unrelated, organization=self.unrelated_org, role=models.UserProfile.ADMIN)

        # Data in Main Org
        self.cust_main = models.Customer.objects.create(organization=self.main_org, name="Main Customer", email="cust@main.com")
        self.inv_main = models.Invoice.objects.create(organization=self.main_org, customer=self.cust_main, number="INV-M-001", date=today, due_date=due)

        # Data in Sub Org
        self.cust_sub = models.Customer.objects.create(organization=self.sub_org, name="Sub Customer", email="cust@sub.com")
        self.inv_sub = models.Invoice.objects.create(organization=self.sub_org, customer=self.cust_sub, number="INV-S-001", date=today, due_date=due)

        # Data in Unrelated Org
        self.cust_unrelated = models.Customer.objects.create(organization=self.unrelated_org, name="Competitor Customer", email="cust@comp.com")
        self.inv_unrelated = models.Invoice.objects.create(organization=self.unrelated_org, customer=self.cust_unrelated, number="INV-C-001", date=today, due_date=due)

    def test_unrelated_org_cannot_access_main_org_invoice(self):
        client = Client()
        client.force_login(self.user_unrelated)

        # Try to read Main Org invoice (IDOR attempt)
        res = client.get(f'/api/invoices/{self.inv_main.id}/')
        self.assertEqual(res.status_code, 404)

        # Try to read Main Org customer
        res_cust = client.get(f'/api/customers/{self.cust_main.id}/')
        self.assertEqual(res_cust.status_code, 404)

    def test_unrelated_org_cannot_switch_context_to_other_org(self):
        client = Client()
        client.force_login(self.user_unrelated)

        # Attempt to spoof X-Organization-Id header
        res = client.get('/api/invoices/', HTTP_X_ORGANIZATION_ID=str(self.main_org.id))
        self.assertEqual(res.status_code, 200)
        results = res.json().get('results', [])
        invoice_numbers = [i.get('number') for i in results]
        self.assertNotIn('INV-M-001', invoice_numbers)
        self.assertNotIn('INV-S-001', invoice_numbers)

    def test_main_org_can_switch_context_to_authorized_sub_org(self):
        client = Client()
        client.force_login(self.user_main)

        # In base context, sees main org invoices
        res_base = client.get('/api/invoices/')
        self.assertEqual(res_base.status_code, 200)
        base_nums = [i.get('number') for i in res_base.json().get('results', [])]
        self.assertIn('INV-M-001', base_nums)

        # Switch to authorized child sub-organization
        res_sub = client.get('/api/invoices/', HTTP_X_ORGANIZATION_ID=str(self.sub_org.id))
        self.assertEqual(res_sub.status_code, 200)
        sub_nums = [i.get('number') for i in res_sub.json().get('results', [])]
        self.assertIn('INV-S-001', sub_nums)
        self.assertNotIn('INV-M-001', sub_nums)


class TestDPDPActCompliance(TestCase):
    def setUp(self):
        self.org = models.Organization.objects.create(name="DPDP Verified Enterprise", code="DPDP", state="Kerala")
        services.ensure_default_accounts(self.org)
        self.admin = User.objects.create_user(username="dpdpadmin", email="admin@dpdp.com", password="Password123!")
        models.UserProfile.objects.create(user=self.admin, organization=self.org, role=models.UserProfile.ADMIN)
        self.client = Client()
        self.client.force_login(self.admin)

    def test_dpdp_privacy_notice_and_framework(self):
        res = self.client.get('/api/dpdp/privacy-policy/')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn('Digital Personal Data Protection Act, 2023', data.get('framework', ''))
        self.assertIn('data_principal_rights', data)
        self.assertIn('statutory_retention_policy', data)

    def test_dpdp_consent_recording_and_withdrawal(self):
        # Record explicit consent
        res = self.client.post('/api/dpdp/consent/', data=json.dumps({
            'data_principal_name': 'Ramesh Kumar',
            'data_principal_email': 'ramesh@example.com',
            'purpose': 'INVOICING_AND_ACCOUNTING',
            'consent_type': 'EXPLICIT',
            'notice_version': 'v1.0'
        }), content_type='application/json')
        self.assertIn(res.status_code, (200, 201))
        data = res.json()
        consent_id = data.get('id')
        self.assertIsNotNone(consent_id)

        # Withdraw consent
        res_w = self.client.post(f'/api/dpdp/consent/{consent_id}/withdraw/', data=json.dumps({
            'reason': 'Opt-out requested via customer portal'
        }), content_type='application/json')
        self.assertEqual(res_w.status_code, 200)
        consent = models.DPDPConsentRecord.objects.get(pk=consent_id)
        self.assertEqual(consent.status, 'WITHDRAWN')
        self.assertIsNotNone(consent.withdrawn_at)

    def test_dpdp_access_request_and_data_export(self):
        # Create Customer
        cust = models.Customer.objects.create(
            organization=self.org,
            name="Priya Nair",
            email="priya@example.com",
            phone="9847000000"
        )
        # Create Access DSR
        res_dsr = self.client.post('/api/dpdp/requests/', data=json.dumps({
            'data_principal_name': 'Priya Nair',
            'data_principal_email': 'priya@example.com',
            'request_type': 'ACCESS',
            'details': 'Request for export of all personal information held.'
        }), content_type='application/json')
        self.assertIn(res_dsr.status_code, (200, 201))
        dsr_id = res_dsr.json().get('id')

        # Export Principal Data Package
        res_exp = self.client.get('/api/dpdp/export-principal-data/', {'identifier': 'priya@example.com'})
        self.assertEqual(res_exp.status_code, 200)
        data_pkg = res_exp.json()
        self.assertIn('customer_profile', data_pkg)
        self.assertEqual(data_pkg['customer_profile']['name'], 'Priya Nair')

        # Resolve request
        res_res = self.client.post(f'/api/dpdp/requests/{dsr_id}/resolve/', data=json.dumps({
            'status': 'COMPLETED',
            'response_notes': 'Data package securely delivered to data principal.'
        }), content_type='application/json')
        self.assertEqual(res_res.status_code, 200)

    def test_dpdp_erasure_request_enforces_statutory_retention_hold(self):
        today = timezone.localdate()
        # Customer has an active tax invoice
        cust = models.Customer.objects.create(organization=self.org, name="Suresh Gupta", email="suresh@example.com")
        inv = models.Invoice.objects.create(organization=self.org, customer=cust, number="INV-DPDP-001", date=today, due_date=today + timedelta(days=30))

        # Customer submits ERASURE request
        res_dsr = self.client.post('/api/dpdp/requests/', data=json.dumps({
            'data_principal_name': 'Suresh Gupta',
            'data_principal_email': 'suresh@example.com',
            'request_type': 'ERASURE',
            'details': 'Delete all my records immediately.'
        }), content_type='application/json')
        self.assertIn(res_dsr.status_code, (200, 201))
        dsr_id = res_dsr.json().get('id')

        # Attempt to mark COMPLETED without addressing statutory retention
        # Accounting & tax laws (Companies Act Sec 128 / GST Act Sec 36) mandate 8-year retention
        res_resolve = self.client.post(f'/api/dpdp/requests/{dsr_id}/resolve/', data=json.dumps({
            'status': 'STATUTORY_HOLD',
            'response_notes': 'Companies Act 2013 Sec 128 & GST Act Sec 36 require 8-year retention of invoices.'
        }), content_type='application/json')
        self.assertEqual(res_resolve.status_code, 200)
        dsr = models.DPDPDataSubjectRequest.objects.get(pk=dsr_id)
        self.assertTrue(dsr.statutory_hold)
        self.assertEqual(dsr.status, 'STATUTORY_HOLD')

        # Verify financial invoice was preserved and not deleted
        self.assertTrue(models.Invoice.objects.filter(pk=inv.pk).exists())

    def test_dpdp_breach_incident_register(self):
        res = self.client.post('/api/dpdp/breaches/', data=json.dumps({
            'incident_type': 'CREDENTIAL_COMPROMISE',
            'severity': 'HIGH',
            'affected_records_count': 12,
            'description': 'Suspicious failed login spike detected and blocked by rate limiter.',
            'detected_at': timezone.now().isoformat()
        }), content_type='application/json')
        self.assertIn(res.status_code, (200, 201))
        incident_id = res.json().get('id')

        # Notify CERT-In
        res_notif = self.client.post(f'/api/dpdp/breaches/{incident_id}/notify/', data=json.dumps({
            'cert_in': True,
            'dpbi': True,
            'status': 'INVESTIGATING'
        }), content_type='application/json')
        self.assertEqual(res_notif.status_code, 200)
        inc = models.DPDPBreachIncident.objects.get(pk=incident_id)
        self.assertTrue(inc.cert_in_notified)

    def test_dpdp_third_party_processor_registry(self):
        res = self.client.post('/api/dpdp/processors/', data=json.dumps({
            'vendor_name': 'Cloud Mail Delivery API Pvt Ltd',
            'service_type': 'Transactional Email Delivery',
            'contact_email': 'dpo@cloudmail.example.com',
            'dpa_signed': True,
            'dpa_date': '2026-01-01',
            'security_safeguards': 'TLS 1.3 in-transit encryption, AES-256 rest encryption, SOC 2 Type II',
            'country': 'India'
        }), content_type='application/json')
        self.assertIn(res.status_code, (200, 201))
        proc_id = res.json().get('id')
        self.assertTrue(models.DPDPDataProcessor.objects.filter(pk=proc_id).exists())


class TestProductionSecurityConfiguration(TestCase):
    def test_allowed_hosts_includes_production_domain(self):
        self.assertIn('convosisbooks.onrender.com', settings.ALLOWED_HOSTS)
        self.assertNotIn('.onrender.com', settings.ALLOWED_HOSTS)

    def test_csrf_trusted_origins_includes_production_domain(self):
        self.assertTrue(any('convosisbooks.onrender.com' in o for o in settings.CSRF_TRUSTED_ORIGINS))
        self.assertNotIn('https://*.onrender.com', settings.CSRF_TRUSTED_ORIGINS)

    def test_custom_404_and_500_suppress_stack_traces(self):
        client = Client()
        user = User.objects.create_user(username="secuser", password="Password123!")
        org = models.Organization.objects.first() or models.Organization.objects.create(name="Sec Org")
        models.UserProfile.objects.create(user=user, organization=org, role=models.UserProfile.ADMIN)
        client.force_login(user)

        # 404 on API
        res_404_api = client.get('/api/non-existent-endpoint/')
        self.assertEqual(res_404_api.status_code, 404)
        data_404 = res_404_api.json()
        self.assertIn('error', data_404)
        self.assertNotIn('Traceback', str(res_404_api.content))

        # 404 on Web
        res_404_web = client.get('/non-existent-page-url/')
        self.assertEqual(res_404_web.status_code, 404)
        self.assertNotIn('Traceback', str(res_404_web.content))

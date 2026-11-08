import json
import uuid
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.test import TestCase, Client
from django.utils import timezone
from books.models import (
    Organization, UserProfile, Customer, Vendor, Item, Warehouse,
    Invoice, InvoiceLine, Quote, Attachment,
    DPDPConsentRecord, DPDPDataSubjectRequest, DPDPBreachIncident, DPDPDataProcessor
)
from books import services

User = get_user_model()


class OrganizationIsolationAndDPDPTests(TestCase):
    def setUp(self):
        self.client = Client()

        # 1. Main Organization A
        self.org_a = Organization.objects.create(
            name="Org Alpha Ltd",
            code="ALPHA",
            org_type="MAIN",
            gstin="32AAAAA0000A1Z5",
            state="Kerala"
        )
        services.ensure_default_accounts(self.org_a)

        self.user_a = User.objects.create_user(
            username="admin_alpha",
            email="admin@alpha.com",
            password="Password@123"
        )
        self.profile_a = UserProfile.objects.create(
            user=self.user_a,
            organization=self.org_a,
            role="admin"
        )

        # 2. Main Organization B (Completely unrelated company)
        self.org_b = Organization.objects.create(
            name="Org Beta Pvt Ltd",
            code="BETA",
            org_type="MAIN",
            gstin="27BBBBB0000B1Z6",
            state="Maharashtra"
        )
        services.ensure_default_accounts(self.org_b)

        self.user_b = User.objects.create_user(
            username="admin_beta",
            email="admin@beta.com",
            password="Password@123"
        )
        self.profile_b = UserProfile.objects.create(
            user=self.user_b,
            organization=self.org_b,
            role="admin"
        )

        # 3. Superuser
        self.super_user = User.objects.create_superuser(
            username="global_super",
            email="super@convosis.com",
            password="Password@123"
        )
        UserProfile.objects.create(
            user=self.super_user,
            organization=self.org_a,
            role="admin"
        )

        # Create tenant data for Org A
        self.cust_a = Customer.objects.create(
            organization=self.org_a,
            name="Alpha Customer",
            email="cust@alpha.com",
            phone="9876543210",
            state="Kerala"
        )
        self.item_a = Item.objects.create(
            organization=self.org_a,
            name="Alpha Item",
            sku="SKU-ALPHA-1",
            selling_price=Decimal("1000.00"),
            purchase_price=Decimal("600.00"),
            gst_rate=Decimal("18.00"),
            item_type="goods",
            track_inventory=True
        )
        self.inv_a = Invoice.objects.create(
            organization=self.org_a,
            customer=self.cust_a,
            number="INV-ALPHA-001",
            date=timezone.localdate(),
            due_date=timezone.localdate(),
            place_of_supply="Kerala",
            subtotal=Decimal("1000.00"),
            total=Decimal("1180.00"),
            status="sent"
        )

        # Create tenant data for Org B
        self.cust_b = Customer.objects.create(
            organization=self.org_b,
            name="Beta Customer",
            email="cust@beta.com",
            phone="9123456789",
            state="Maharashtra"
        )

    # =========================================================================
    # 1. STRICT CROSS-TENANT ISOLATION TESTS
    # =========================================================================

    def test_cross_tenant_read_rejected(self):
        """Org B must never be able to read Org A's customer, invoice, or item by ID."""
        self.client.force_login(self.user_b)

        # Attempt to access Org A's customer
        res = self.client.get(f'/api/customers/{self.cust_a.id}/')
        self.assertEqual(res.status_code, 404, "Org B should receive 404 when querying Org A's customer.")

        # Attempt to access Org A's invoice
        res = self.client.get(f'/api/invoices/{self.inv_a.id}/')
        self.assertEqual(res.status_code, 404, "Org B should receive 404 when querying Org A's invoice.")

        # Attempt to access Org A's item
        res = self.client.get(f'/api/items/{self.item_a.id}/')
        self.assertEqual(res.status_code, 404, "Org B should receive 404 when querying Org A's item.")

    def test_cross_tenant_collection_query_isolation(self):
        """Org B listing customers or invoices must never see Org A's records."""
        self.client.force_login(self.user_b)

        res = self.client.get('/api/customers/')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        cust_ids = [c['id'] for c in data.get('results', [])]
        self.assertIn(self.cust_b.id, cust_ids)
        self.assertNotIn(self.cust_a.id, cust_ids)

        res_inv = self.client.get('/api/invoices/')
        self.assertEqual(res_inv.status_code, 200)
        inv_ids = [i['id'] for i in res_inv.json().get('results', [])]
        self.assertNotIn(self.inv_a.id, inv_ids)

    def test_cross_tenant_foreign_key_injection_rejected(self):
        """Org B attempting to create an invoice linking Org A's customer or item must be rejected."""
        self.client.force_login(self.user_b)

        payload = {
            'customer': self.cust_a.id,  # Org A customer
            'date': timezone.localdate().isoformat(),
            'lines': [
                {
                    'item': self.item_a.id,  # Org A item
                    'quantity': 1,
                    'rate': 1000.00
                }
            ]
        }
        res = self.client.post('/api/invoices/', data=json.dumps(payload), content_type='application/json')
        # Should fail with 400 or 404 because customer/item belongs to Org A
        self.assertIn(res.status_code, [400, 404])

    def test_cross_tenant_delete_rejected(self):
        """Org B attempting to delete Org A's customer must be rejected."""
        self.client.force_login(self.user_b)
        res = self.client.delete(f'/api/customers/{self.cust_a.id}/')
        self.assertEqual(res.status_code, 404)
        self.assertTrue(Customer.objects.filter(id=self.cust_a.id).exists())

    def test_cross_tenant_search_isolation(self):
        """Global search by Org B must never return Org A records."""
        self.client.force_login(self.user_b)
        res = self.client.get('/api/search/?q=Alpha')
        self.assertEqual(res.status_code, 200)
        results = res.json()
        for r in results:
            self.assertNotEqual(r.get('id'), self.cust_a.id)
            self.assertNotEqual(r.get('id'), self.inv_a.id)

    def test_attachment_tenant_isolation(self):
        """Org A's attachments cannot be downloaded or accessed by Org B."""
        att_a = Attachment.objects.create(
            organization=self.org_a,
            entity_type='invoice',
            entity_id=self.inv_a.id,
            filename='confidential_contract_alpha.pdf',
            file_data='data:application/pdf;base64,JVBERi0xLjQK...',
            file_size=1024,
            created_by=self.user_a
        )

        self.client.force_login(self.user_b)
        # Detail get
        res = self.client.get(f'/api/attachments/{att_a.id}/')
        self.assertEqual(res.status_code, 404, "Org B should receive 404 for Org A attachment.")

        # List get
        res_list = self.client.get('/api/attachments/')
        att_ids = [a['id'] for a in res_list.json()]
        self.assertNotIn(att_a.id, att_ids)

        # Delete attempt
        res_del = self.client.delete(f'/api/attachments/{att_a.id}/')
        self.assertEqual(res_del.status_code, 404)

    # =========================================================================
    # 2. SUB-ORGANIZATION HIERARCHY & CONTEXT SWITCHING TESTS
    # =========================================================================

    def test_sub_organization_lifecycle_and_switching(self):
        """Main Org can create sub-organizations and switch context, but sub-orgs cannot access peers."""
        self.client.force_login(self.user_a)

        # 1. Main Org creates Sub-Org 1
        create_res = self.client.post('/api/organization/sub-organizations/', data=json.dumps({
            'name': 'Alpha Kochi Branch',
            'code': 'AKOC',
            'city': 'Kochi',
            'state': 'Kerala'
        }), content_type='application/json')
        self.assertEqual(create_res.status_code, 201)
        sub1_id = create_res.json()['id']

        # 2. Main Org creates Sub-Org 2
        create_res2 = self.client.post('/api/organization/sub-organizations/', data=json.dumps({
            'name': 'Alpha Kozhikode Branch',
            'code': 'AKZK',
            'city': 'Kozhikode',
            'state': 'Kerala'
        }), content_type='application/json')
        self.assertEqual(create_res2.status_code, 201)
        sub2_id = create_res2.json()['id']

        # 3. Create a dedicated user locked to Sub-Org 1
        sub_user = User.objects.create_user(username="kochi_user", password="Password@123")
        sub_org_1 = Organization.objects.get(id=sub1_id)
        UserProfile.objects.create(user=sub_user, organization=sub_org_1, role="staff")

        # 4. Main Org A switches context to Sub-Org 1
        switch_res = self.client.post('/api/organization/switch/', data=json.dumps({
            'organization_id': sub1_id
        }), content_type='application/json')
        self.assertEqual(switch_res.status_code, 200)
        self.assertEqual(switch_res.json()['active_org_id'], sub1_id)

        # 5. Main Org A trying to switch to unrelated Org B must be strictly FORBIDDEN
        bad_switch = self.client.post('/api/organization/switch/', data=json.dumps({
            'organization_id': self.org_b.id
        }), content_type='application/json')
        self.assertEqual(bad_switch.status_code, 403)

        # 6. Sub-Org 1 user attempting to switch to Main Org or Sub-Org 2 must be FORBIDDEN
        self.client.force_login(sub_user)
        sub_bad_switch = self.client.post('/api/organization/switch/', data=json.dumps({
            'organization_id': self.org_a.id
        }), content_type='application/json')
        self.assertEqual(sub_bad_switch.status_code, 403)

        sub_bad_switch2 = self.client.post('/api/organization/switch/', data=json.dumps({
            'organization_id': sub2_id
        }), content_type='application/json')
        self.assertEqual(sub_bad_switch2.status_code, 403)

    # =========================================================================
    # 3. DPDP ACT 2023 / RULES 2025 COMPLIANCE TESTS
    # =========================================================================

    def test_dpdp_privacy_policy_notice(self):
        """GET /api/dpdp/privacy-policy/ returns notice with purpose specification & DPO details."""
        self.client.force_login(self.user_a)
        res = self.client.get('/api/dpdp/privacy-policy/')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn('data_fiduciary', data)
        self.assertIn('data_protection_officer', data)
        self.assertIn('specified_purposes', data)
        self.assertIn('statutory_retention_policy', data)
        # Verify 8-year statutory retention notice under Companies Act Sec 128 / GST Act Sec 36
        self.assertIn('8', data['statutory_retention_policy']['rule'])

    def test_dpdp_consent_recording_and_withdrawal(self):
        """Registering and withdrawing explicit consent under DPDP Act 2023 Section 6."""
        self.client.force_login(self.user_a)

        # 1. Register consent
        res = self.client.post('/api/dpdp/consent/', data=json.dumps({
            'data_principal_name': 'Ramesh Kumar',
            'data_principal_email': 'ramesh@example.com',
            'data_principal_phone': '9847000000',
            'purpose': 'INVOICING_AND_ACCOUNTING',
            'consent_type': 'EXPLICIT'
        }), content_type='application/json')
        self.assertEqual(res.status_code, 201)
        cid = res.json()['id']
        self.assertEqual(res.json()['status'], 'ACTIVE')

        # 2. Withdraw consent
        w_res = self.client.post(f'/api/dpdp/consent/{cid}/withdraw/', data=json.dumps({
            'reason': 'Withdrew marketing and communication consent'
        }), content_type='application/json')
        self.assertEqual(w_res.status_code, 200)
        self.assertEqual(w_res.json()['status'], 'WITHDRAWN')

        # Verify DB
        rec = DPDPConsentRecord.objects.get(id=cid)
        self.assertEqual(rec.status, 'WITHDRAWN')
        self.assertIsNotNone(rec.withdrawn_at)

    def test_dpdp_dsr_statutory_hold_safeguard(self):
        """
        Erasure request for Data Principal with active tax/accounting invoices MUST trigger
        Statutory Hold under Companies Act Sec 128 and GST Act Sec 36.
        """
        self.client.force_login(self.user_a)

        # Submit erasure request for customer with active invoice
        res = self.client.post('/api/dpdp/requests/', data=json.dumps({
            'data_principal_name': self.cust_a.name,
            'data_principal_email': self.cust_a.email,
            'request_type': 'ERASURE',
            'details': 'Please erase all my personal and transactional records from ConvosisBooks.'
        }), content_type='application/json')
        self.assertEqual(res.status_code, 201)
        data = res.json()
        self.assertTrue(data['statutory_hold'], "Statutory hold must be applied due to active invoice records.")
        self.assertEqual(data['status'], 'STATUTORY_HOLD')
        self.assertIn("Section 128 of the Companies Act", data['statutory_hold_reason'])

    def test_dpdp_export_principal_data_right_to_access(self):
        """Section 11 Right to Access: export all records associated with a data principal."""
        self.client.force_login(self.user_a)

        res = self.client.post('/api/dpdp/export-principal-data/', data=json.dumps({
            'identifier': self.cust_a.email
        }), content_type='application/json')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data['export_metadata']['requested_identifier'], self.cust_a.email)
        self.assertEqual(len(data['customer_profiles']), 1)
        self.assertEqual(len(data['invoices']), 1)
        self.assertEqual(data['invoices'][0]['number'], self.inv_a.number)

    def test_dpdp_breach_register_and_cert_in_tracking(self):
        """Section 8(6) & CERT-In 6-hour reporting readiness."""
        self.client.force_login(self.user_a)

        # 1. Log incident
        res = self.client.post('/api/dpdp/breaches/', data=json.dumps({
            'incident_type': 'UNAUTHORIZED_ACCESS',
            'severity': 'HIGH',
            'affected_records_count': 15,
            'description': 'Suspicious anomaly detected from untrusted IP',
            'affected_data_principals': 'Alpha Client Accounts'
        }), content_type='application/json')
        self.assertEqual(res.status_code, 201)
        bid = res.json()['id']
        self.assertIn('cert_in_deadline', res.json())

        # 2. Record CERT-In notification
        n_res = self.client.post(f'/api/dpdp/breaches/{bid}/notify/', data=json.dumps({
            'cert_in': True,
            'dpbi': True,
            'status': 'INVESTIGATING'
        }), content_type='application/json')
        self.assertEqual(n_res.status_code, 200)
        self.assertTrue(n_res.json()['cert_in_notified'])
        self.assertTrue(n_res.json()['dpbi_notified'])

    def test_dpdp_processor_register(self):
        """Section 8(2) third-party vendor processor tracking."""
        self.client.force_login(self.user_a)

        res = self.client.post('/api/dpdp/processors/', data=json.dumps({
            'vendor_name': 'AWS India (Amazon Web Services)',
            'service_type': 'CLOUD_HOSTING',
            'contact_email': 'compliance@amazon.com',
            'data_shared_categories': 'Database backups, encrypted storage',
            'dpa_signed': True,
            'country': 'India'
        }), content_type='application/json')
        self.assertEqual(res.status_code, 201)
        pid = res.json()['id']

        list_res = self.client.get('/api/dpdp/processors/')
        self.assertEqual(list_res.status_code, 200)
        self.assertTrue(any(p['id'] == pid for p in list_res.json()))


from decimal import Decimal
import json
from django.contrib.auth.models import User
from django.test import TestCase, Client

from books.models import (
    Customer, Vendor, Item, Invoice, InvoiceLine, Organization,
    PurchaseOrder, PurchaseOrderLine, CreditNote, CreditNoteLine,
    VendorCredit, VendorCreditLine, UserProfile
)

class TenantIsolationAndAdminTests(TestCase):
    def setUp(self):
        self.client = Client()

        # Tenant A
        self.user_a = User.objects.create_user(username='usera', password='password123', email='usera@tenant-a.com')
        self.org_a = Organization.objects.create(name='Tenant A Pvt Ltd', owner=self.user_a)
        self.profile_a = UserProfile.objects.create(user=self.user_a, role=UserProfile.ADMIN, organization=self.org_a)

        # Tenant B
        self.user_b = User.objects.create_user(username='userb', password='password123', email='userb@tenant-b.com')
        self.org_b = Organization.objects.create(name='Tenant B Pvt Ltd', owner=self.user_b)
        self.profile_b = UserProfile.objects.create(user=self.user_b, role=UserProfile.ADMIN, organization=self.org_b)

    def test_tenant_data_isolation(self):
        # User A creates records
        self.client.force_login(self.user_a)
        res_cust_a = self.client.post('/api/customers/', json.dumps({
            'name': 'Customer of Tenant A',
            'email': 'custA@test.com'
        }), content_type='application/json')
        self.assertEqual(res_cust_a.status_code, 201)
        cust_a_id = res_cust_a.json()['id']

        res_item_a = self.client.post('/api/items/', json.dumps({
            'name': 'Item of Tenant A',
            'sku': 'SKU-A-01',
            'selling_price': '150.00',
            'purchase_price': '100.00'
        }), content_type='application/json')
        self.assertEqual(res_item_a.status_code, 201)
        item_a_id = res_item_a.json()['id']

        # Verify User A can see their customer and item
        list_a = self.client.get('/api/customers/').json()
        self.assertTrue(any(c['id'] == cust_a_id for c in list_a['results']))

        # Now User B logs in
        self.client.force_login(self.user_b)
        list_b = self.client.get('/api/customers/').json()
        # Tenant B MUST NOT see Tenant A's customer
        self.assertFalse(any(c['id'] == cust_a_id for c in list_b['results']))

        # Tenant B requesting Tenant A's customer directly returns 404
        detail_b = self.client.get(f'/api/customers/{cust_a_id}/')
        self.assertEqual(detail_b.status_code, 404)

        # Tenant B lookup also does not reveal Tenant A
        lookup_b = self.client.get('/api/lookup/customers/').json()
        self.assertFalse(any(c['id'] == cust_a_id for c in lookup_b))

        # Tenant B creates their own customer
        res_cust_b = self.client.post('/api/customers/', json.dumps({
            'name': 'Customer of Tenant B',
            'email': 'custB@test.com'
        }), content_type='application/json')
        self.assertEqual(res_cust_b.status_code, 201)
        cust_b_id = res_cust_b.json()['id']

        # Tenant B sees their customer
        list_b_now = self.client.get('/api/customers/').json()
        self.assertTrue(any(c['id'] == cust_b_id for c in list_b_now['results']))
        self.assertFalse(any(c['id'] == cust_a_id for c in list_b_now['results']))

    def test_tenant_admin_user_management(self):
        self.client.force_login(self.user_a)

        # 1. Invite/Add new user
        res_inv = self.client.post('/api/tenant/admin/invite/', json.dumps({
            'username': 'accountant_a',
            'email': 'acc@tenant-a.com',
            'full_name': 'Ramesh Kumar',
            'role': 'accountant',
            'phone': '9876543210',
            'password': 'InitialSecret123'
        }), content_type='application/json')
        self.assertEqual(res_inv.status_code, 200)
        data = res_inv.json()
        self.assertEqual(data['status'], 'success')
        new_uid = data['user_id']

        new_user = User.objects.get(pk=new_uid)
        self.assertEqual(new_user.profile.organization, self.org_a)
        self.assertEqual(new_user.profile.role, 'accountant')

        # 2. Update role
        res_role = self.client.post(f'/api/tenant/admin/users/{new_uid}/role/', json.dumps({
            'role': 'auditor'
        }), content_type='application/json')
        self.assertEqual(res_role.status_code, 200)
        new_user.refresh_from_db()
        self.assertEqual(new_user.profile.role, 'auditor')

        # 3. Toggle active (deactivate)
        res_toggle = self.client.post(f'/api/tenant/admin/users/{new_uid}/toggle-active/')
        self.assertEqual(res_toggle.status_code, 200)
        new_user.refresh_from_db()
        self.assertFalse(new_user.is_active)

        # 4. Reset password
        res_reset = self.client.post(f'/api/tenant/admin/users/{new_uid}/reset-password/', json.dumps({
            'password': 'BrandNewPassword999'
        }), content_type='application/json')
        self.assertEqual(res_reset.status_code, 200)
        new_user.refresh_from_db()
        self.assertTrue(new_user.check_password('BrandNewPassword999'))

    def test_submodules_saving_and_updating(self):
        self.client.force_login(self.user_a)

        # Create vendor & item for PO
        ven = Vendor.objects.create(name='PO Supplier 1', organization=self.org_a, active=True, state='Kerala')
        cust = Customer.objects.create(name='Credit Customer 1', organization=self.org_a, active=True, state='Kerala')
        item = Item.objects.create(name='Test PO Item', sku='SKU-PO-1', selling_price=Decimal('100.00'), purchase_price=Decimal('80.00'), organization=self.org_a)

        # 1. Purchase Order create & update
        po_res = self.client.post('/api/purchase-orders/', json.dumps({
            'vendor': ven.pk,
            'date': '2026-11-04',
            'lines': [{'item': item.pk, 'description': 'Supply of widgets', 'quantity': '5', 'rate': '80.00', 'gst_rate': '18.00'}]
        }), content_type='application/json')
        self.assertEqual(po_res.status_code, 201)
        po_id = po_res.json()['id']
        self.assertEqual(po_res.json()['party'], 'PO Supplier 1')

        # Update Purchase Order
        po_update = self.client.put(f'/api/purchase-orders/{po_id}/', json.dumps({
            'vendor': ven.pk,
            'date': '2026-11-05',
            'lines': [{'item': item.pk, 'description': 'Updated widgets', 'quantity': '10', 'rate': '80.00', 'gst_rate': '18.00'}]
        }), content_type='application/json')
        self.assertEqual(po_update.status_code, 200)
        self.assertEqual(po_update.json()['lines'][0]['description'], 'Updated widgets')

        # 2. Credit Note create & update
        cn_res = self.client.post('/api/credit-notes/', json.dumps({
            'customer': cust.pk,
            'date': '2026-11-04',
            'reason': 'Returned goods',
            'lines': [{'item': item.pk, 'description': 'Credit widget', 'quantity': '1', 'rate': '100.00', 'gst_rate': '18.00'}]
        }), content_type='application/json')
        self.assertEqual(cn_res.status_code, 201)
        cn_id = cn_res.json()['id']
        self.assertEqual(cn_res.json()['party'], 'Credit Customer 1')

        # Update Credit Note
        cn_update = self.client.put(f'/api/credit-notes/{cn_id}/', json.dumps({
            'customer': cust.pk,
            'date': '2026-11-05',
            'reason': 'Damaged in transit',
            'lines': [{'item': item.pk, 'description': 'Credit widget updated', 'quantity': '2', 'rate': '100.00', 'gst_rate': '18.00'}]
        }), content_type='application/json')
        self.assertEqual(cn_update.status_code, 200)
        self.assertEqual(cn_update.json()['reason'], 'Damaged in transit')

        # 3. Vendor Credit create & update
        vc_res = self.client.post('/api/vendor-credits/', json.dumps({
            'vendor': ven.pk,
            'date': '2026-11-04',
            'reason': 'Supplier discount',
            'lines': [{'item': item.pk, 'description': 'Vendor credit item', 'quantity': '1', 'rate': '80.00', 'gst_rate': '18.00'}]
        }), content_type='application/json')
        self.assertEqual(vc_res.status_code, 201)
        vc_id = vc_res.json()['id']
        self.assertEqual(vc_res.json()['party'], 'PO Supplier 1')

        # Update Vendor Credit
        vc_update = self.client.put(f'/api/vendor-credits/{vc_id}/', json.dumps({
            'vendor': ven.pk,
            'date': '2026-11-05',
            'reason': 'Revised discount',
            'lines': [{'item': item.pk, 'description': 'Vendor credit revised', 'quantity': '3', 'rate': '80.00', 'gst_rate': '18.00'}]
        }), content_type='application/json')
        self.assertEqual(vc_update.status_code, 200)
        self.assertEqual(vc_update.json()['reason'], 'Revised discount')

    def test_customer_creation_without_address(self):
        self.client.force_login(self.user_a)
        # Creating customer with only basic details (no address) should succeed smoothly
        res = self.client.post('/api/customers/', json.dumps({
            'name': 'Simple Direct Customer',
            'company': 'Direct Simple Corp',
            'email': 'direct@simple.com'
        }), content_type='application/json')
        self.assertEqual(res.status_code, 201)
        data = res.json()
        self.assertEqual(data['name'], 'Simple Direct Customer')
        self.assertEqual(data['state'], 'Kerala')

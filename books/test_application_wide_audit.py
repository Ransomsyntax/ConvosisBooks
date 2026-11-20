import json
import os
from decimal import Decimal
from django.test import TestCase, Client
from django.contrib.auth.models import User
from django.utils import timezone
from books.models import (
    Organization, UserProfile, Account, BankAccount, BankTransfer,
    Customer, Vendor, Item, Warehouse, Project, ItemCategory, PriceList,
    Quote, SalesOrder, Invoice, Bill, PurchaseOrder, PaymentReceived,
    PaymentMade, CreditNote, VendorCredit, DeliveryChallan, StockTransfer,
    StockMovement, Journal, DocumentNumberSeries
)


class ApplicationWideAuditTestCase(TestCase):
    """
    Complete application-wide audit test suite covering all modules:
    Dashboard, Sales, Purchases, Items, Inventory, Banking, Accountant,
    Reports, and Settings.
    """

    def setUp(self):
        self.user = User.objects.create_user(
            username='app_audit_admin',
            email='app_audit_admin@example.com',
            password='auditpassword123'
        )
        self.org = Organization.objects.create(
            name='Convosis Complete Audit Org',
            owner=self.user,
            email='audit@example.com',
            state='Kerala',
            base_currency='INR',
            allow_negative_stock=True
        )
        self.profile = UserProfile.objects.create(
            user=self.user,
            organization=self.org,
            role='admin',
            normalized_email='app_audit_admin@example.com'
        )

        # GL accounts
        self.acc_cash = Account.objects.create(
            organization=self.org, code='1010', name='Cash and Bank', account_type='asset'
        )
        self.acc_sales = Account.objects.create(
            organization=self.org, code='4010', name='Sales Revenue', account_type='income'
        )
        self.acc_purchases = Account.objects.create(
            organization=self.org, code='5010', name='Cost of Goods Sold', account_type='expense'
        )

        # Bank accounts
        self.bank1 = BankAccount.objects.create(
            organization=self.org, name='ICICI Current A/c', bank_name='ICICI',
            account_number='112233445566', opening_balance=Decimal('100000.00'),
            current_balance=Decimal('100000.00'), bank_balance=Decimal('100000.00'),
            gl_account=self.acc_cash
        )
        self.bank2 = BankAccount.objects.create(
            organization=self.org, name='SBI Operating A/c', bank_name='SBI',
            account_number='665544332211', opening_balance=Decimal('50000.00'),
            current_balance=Decimal('50000.00'), bank_balance=Decimal('50000.00'),
            gl_account=self.acc_cash
        )

        # Master entities
        self.customer = Customer.objects.create(
            organization=self.org, name='Kottayam Enterprises', email='kottayam@example.com',
            state='Kerala', customer_type='business', active=True
        )
        self.vendor = Vendor.objects.create(
            organization=self.org, name='Cochin Wholesale Supplies', email='cochin@example.com',
            state='Kerala', active=True
        )
        self.item = Item.objects.create(
            organization=self.org, name='Enterprise Router AC1200', item_type='goods',
            unit='pcs', selling_price=Decimal('12000.00'), purchase_price=Decimal('9000.00'),
            gst_rate=18, track_inventory=True
        )
        self.wh1 = Warehouse.objects.create(
            organization=self.org, name='Central Hub', code='WH-CENTRAL', state='Kerala', active=True
        )
        self.wh2 = Warehouse.objects.create(
            organization=self.org, name='Transit Hub', code='WH-TRANSIT', state='Kerala', active=True
        )

        self.client = Client()
        self.client.force_login(self.user)
        session = self.client.session
        session['active_org_id'] = self.org.id
        session.save()

    def test_01_dashboard_and_auth_context(self):
        """Audit Dashboard API and authentication context endpoints."""
        resp_me = self.client.get('/api/me/')
        self.assertEqual(resp_me.status_code, 200)
        data = resp_me.json()
        self.assertEqual(data['organization']['name'], self.org.name)

        resp_dash = self.client.get('/api/dashboard/')
        self.assertIn(resp_dash.status_code, [200, 204])

    def test_02_sales_complete_workflow(self):
        """Audit Sales workflow: Customer -> Quote -> SalesOrder -> Challan -> Invoice -> PaymentReceived."""
        today = timezone.now().date().isoformat()

        # 1. Quote
        resp_q = self.client.post('/api/quotes/', data=json.dumps({
            'number': 'QT-AUDIT-001',
            'customer': self.customer.id,
            'date': today,
            'due_date': today,
            'place_of_supply': 'Kerala',
            'status': 'sent',
            'lines': [{
                'item': self.item.id,
                'description': 'Router',
                'quantity': 2,
                'rate': '12000.00',
                'gst_rate': 18
            }]
        }), content_type='application/json')
        self.assertEqual(resp_q.status_code, 201)
        q_id = resp_q.json()['id']

        # 2. Sales Order
        resp_so = self.client.post('/api/sales-orders/', data=json.dumps({
            'number': 'SO-AUDIT-001',
            'customer': self.customer.id,
            'date': today,
            'expected_delivery_date': today,
            'status': 'confirmed',
            'lines': [{
                'item': self.item.id,
                'description': 'Router',
                'quantity': 2,
                'rate': '12000.00',
                'gst_rate': 18
            }]
        }), content_type='application/json')
        self.assertEqual(resp_so.status_code, 201)
        so_id = resp_so.json()['id']

        # 3. Delivery Challan
        resp_dc = self.client.post('/api/delivery-challans/', data=json.dumps({
            'number': 'DC-AUDIT-001',
            'customer': self.customer.id,
            'date': today,
            'challan_type': 'delivering_goods',
            'status': 'delivered',
            'lines': [{
                'item': self.item.id,
                'description': 'Router',
                'quantity': 2,
                'rate': '12000.00'
            }]
        }), content_type='application/json')
        self.assertEqual(resp_dc.status_code, 201)

        # 4. Invoice
        resp_inv = self.client.post('/api/invoices/', data=json.dumps({
            'number': 'INV-AUDIT-001',
            'customer': self.customer.id,
            'date': today,
            'due_date': today,
            'place_of_supply': 'Kerala',
            'status': 'sent',
            'lines': [{
                'item': self.item.id,
                'description': 'Router',
                'quantity': 2,
                'rate': '12000.00',
                'gst_rate': 18
            }]
        }), content_type='application/json')
        self.assertEqual(resp_inv.status_code, 201)
        inv_id = resp_inv.json()['id']

        # 5. Payment Received
        resp_pay = self.client.post('/api/payments-received/', data=json.dumps({
            'number': 'PAY-AUDIT-001',
            'customer': self.customer.id,
            'invoice': inv_id,
            'date': today,
            'amount': '28320.00',
            'payment_mode': 'bank_transfer',
            'bank_account': self.bank1.id
        }), content_type='application/json')
        self.assertEqual(resp_pay.status_code, 201)

    def test_03_purchase_complete_workflow(self):
        """Audit Purchases workflow: Vendor -> PO -> Bill -> PaymentMade."""
        today = timezone.now().date().isoformat()

        # 1. Purchase Order
        resp_po = self.client.post('/api/purchase-orders/', data=json.dumps({
            'number': 'PO-AUDIT-001',
            'vendor': self.vendor.id,
            'date': today,
            'expected_date': today,
            'status': 'issued',
            'lines': [{
                'item': self.item.id,
                'description': 'Router',
                'quantity': 5,
                'rate': '9000.00',
                'gst_rate': 18
            }]
        }), content_type='application/json')
        self.assertEqual(resp_po.status_code, 201)
        po_id = resp_po.json()['id']

        # 2. Bill
        resp_bill = self.client.post('/api/bills/', data=json.dumps({
            'number': 'BILL-AUDIT-001',
            'vendor': self.vendor.id,
            'date': today,
            'due_date': today,
            'source_of_supply': 'Kerala',
            'status': 'unpaid',
            'lines': [{
                'item': self.item.id,
                'description': 'Router',
                'quantity': 5,
                'rate': '9000.00',
                'gst_rate': 18
            }]
        }), content_type='application/json')
        self.assertEqual(resp_bill.status_code, 201)
        bill_id = resp_bill.json()['id']

        # 3. Payment Made
        resp_pm = self.client.post('/api/payments-made/', data=json.dumps({
            'number': 'PM-AUDIT-001',
            'vendor': self.vendor.id,
            'bill': bill_id,
            'date': today,
            'amount': '53100.00',
            'payment_mode': 'bank_transfer',
            'bank_account': self.bank1.id
        }), content_type='application/json')
        self.assertEqual(resp_pm.status_code, 201)

        # 4. Vendor Credit (with address data & custom fields)
        resp_vc = self.client.post('/api/vendor-credits/', data=json.dumps({
            'number': 'VC-AUDIT-001',
            'vendor': self.vendor.id,
            'date': today,
            'reason': 'Damaged Goods Return',
            'billing_address_data': {
                'attention': 'Vendor Billing Dept',
                'street1': '456 Supplier Way',
                'city': 'Ernakulam',
                'state': 'Kerala',
                'pincode': '682001'
            },
            'shipping_address_data': {
                'attention': 'Vendor Warehouse',
                'street1': '789 Logistics Park',
                'city': 'Ernakulam',
                'state': 'Kerala',
                'pincode': '682001'
            },
            'lines': [{
                'item': self.item.id,
                'description': 'Router Returned',
                'quantity': 1,
                'rate': '9000.00',
                'gst_rate': 18
            }]
        }), content_type='application/json')
        self.assertEqual(resp_vc.status_code, 201)
        vc_id = resp_vc.json()['id']

        # Verify Vendor Credit Detail
        resp_vc_det = self.client.get(f'/api/vendor-credits/{vc_id}/')
        self.assertEqual(resp_vc_det.status_code, 200)

        # Update Vendor Credit
        resp_vc_put = self.client.put(f'/api/vendor-credits/{vc_id}/', data=json.dumps({
            'vendor': self.vendor.id,
            'date': today,
            'reason': 'Damaged Goods Return - Partial Credit',
            'lines': [{
                'item': self.item.id,
                'description': 'Router Returned',
                'quantity': 1,
                'rate': '9000.00',
                'gst_rate': 18
            }]
        }), content_type='application/json')
        self.assertEqual(resp_vc_put.status_code, 200)

    def test_04_inventory_and_warehousing_workflow(self):
        """Audit Inventory workflow: Stock Adjustments, Warehouses, and Transfers."""
        today = timezone.now().date().isoformat()

        # 1. Stock Adjustment
        resp_adj = self.client.post('/api/stock-adjustments/', data=json.dumps({
            'warehouse': self.wh1.id,
            'mode': 'quantity',
            'date': today,
            'reason': 'Stock recount',
            'lines': [{
                'item': self.item.id,
                'new_quantity': 10
            }]
        }), content_type='application/json')
        self.assertEqual(resp_adj.status_code, 201)

        # 2. Stock Transfer
        resp_tr = self.client.post('/api/stock-transfers/', data=json.dumps({
            'transfer_number': 'ST-AUDIT-001',
            'source_warehouse': self.wh1.id,
            'destination_warehouse': self.wh2.id,
            'transfer_date': today,
            'status': 'draft',
            'lines': [{
                'item': self.item.id,
                'quantity': 3
            }]
        }), content_type='application/json')
        self.assertEqual(resp_tr.status_code, 201)
        tr_id = resp_tr.json()['id']

        # Confirm Transfer
        resp_conf = self.client.post(f'/api/stock-transfers/{tr_id}/confirm/', data=json.dumps({}), content_type='application/json')
        self.assertEqual(resp_conf.status_code, 200)

    def test_05_banking_transfer_and_accounts(self):
        """Audit Banking: Bank Accounts list, validation, and internal transfer."""
        # 1. List accounts
        resp = self.client.get('/api/bank-accounts/')
        self.assertEqual(resp.status_code, 200)

        # 2. Internal transfer execution
        resp_tx = self.client.post('/api/banking/transfer/', data=json.dumps({
            'from_account': str(self.bank1.id),
            'to_account': str(self.bank2.id),
            'amount': '10000.00'
        }), content_type='application/json')
        self.assertEqual(resp_tx.status_code, 200)

    def test_06_accountant_manual_journals_and_reports(self):
        """Audit Accountant Manual Journals and Financial Reports."""
        today = timezone.now().date().isoformat()

        # 1. Create Manual Journal
        resp_jnl = self.client.post('/api/manual-journals/', data=json.dumps({
            'date': today,
            'reference': 'REF-001',
            'notes': 'Quarterly provisions',
            'lines': [
                {'account': self.acc_purchases.id, 'debit': 1500.0, 'credit': 0.0, 'description': 'Expense'},
                {'account': self.acc_cash.id, 'debit': 0.0, 'credit': 1500.0, 'description': 'Cash Out'}
            ]
        }), content_type='application/json')
        self.assertEqual(resp_jnl.status_code, 201)

        # 2. Financial Reports
        for endpoint in [
            '/api/reports/profit-and-loss/',
            '/api/reports/balance-sheet/',
            '/api/reports/trial-balance/'
        ]:
            r = self.client.get(endpoint)
            self.assertIn(r.status_code, [200, 204], f"Endpoint {endpoint} failed with {r.status_code}")

    def test_07_javascript_syntax_and_exports_integrity(self):
        """Verify zero duplicate declarations and all window exports across JS modules."""
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        static_forms = os.path.join(base_dir, 'books', 'static', 'books', 'js', 'forms.js')
        front_forms = os.path.join(base_dir, 'frontend', 'js', 'forms.js')
        static_pages = os.path.join(base_dir, 'books', 'static', 'books', 'js', 'pages.js')
        front_pages = os.path.join(base_dir, 'frontend', 'js', 'pages.js')

        with open(static_forms, 'r', encoding='utf-8') as f:
            sf = f.read()
        with open(front_forms, 'r', encoding='utf-8') as f:
            ff = f.read()
        with open(static_pages, 'r', encoding='utf-8') as f:
            sp = f.read()
        with open(front_pages, 'r', encoding='utf-8') as f:
            fp = f.read()

        # Synchronized
        self.assertEqual(sf, ff)
        self.assertEqual(sp, fp)

        # Ensure openPoPrefModal is declared exactly ONCE in forms.js
        po_matches = sf.count('const openPoPrefModal = () => {')
        self.assertEqual(po_matches, 1, f"Expected openPoPrefModal exactly once, found {po_matches} times!")

        # Ensure partyForm and partyDetail are exported
        self.assertIn('window.partyForm = partyForm;', sf)
        self.assertIn('window.partyDetail = partyDetail;', sp)
        self.assertIn('window.stockTransferModal = stockTransferModal;', sf)
        self.assertIn('window.renderBankingModule = renderBankingModule;', sp)

        # Verify core.js does not have undeclared Modal export
        static_core = os.path.join(base_dir, 'books', 'static', 'books', 'js', 'core.js')
        front_core = os.path.join(base_dir, 'frontend', 'js', 'core.js')
        with open(static_core, 'r', encoding='utf-8') as f:
            sc = f.read()
        with open(front_core, 'r', encoding='utf-8') as f:
            fc = f.read()
        self.assertEqual(sc, fc)
        self.assertNotIn('window.Modal = Modal;', sc)
        self.assertNotIn('window.confirmBox = confirmBox;', sc)

        # Verify stockTransferReportPage loadData has valid declaration
        self.assertIn('const wh = $(\'#rep-wh\', root).value;', sp)
        self.assertIn('let url = \'reports/stock-transfer-report/?\';', sp)

    def test_08_auth_exception_handling_and_services_get_user_org(self):
        """Verify API auth registration exception handling and services.get_user_org."""
        from books import services

        # 1. Test services.get_user_org
        org_res = services.get_user_org(self.user)
        self.assertEqual(org_res, self.org)

        # 2. Test api_auth_register_view duplicate email handling (catches IntegrityError, ValidationError, OperationalError)
        reg_client = Client()
        reg_resp = reg_client.post('/api/auth/register/', data=json.dumps({
            'username': 'dup_test_user',
            'email': 'app_audit_admin@example.com',  # already exists
            'password': 'SecurePassword123!',
            'confirm_password': 'SecurePassword123!',
            'organization_name': 'Dup Test Org'
        }), content_type='application/json')
        self.assertEqual(reg_resp.status_code, 400)
        resp_data = reg_resp.json()
        self.assertIn('already exists', resp_data.get('error', '').lower())

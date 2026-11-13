"""
Comprehensive automated tests for ConvosisBooks:
1. Authentication, session management, and Role-Based Access Control (RBAC)
2. Accounting & transaction integrity (invoices, payments, bank transfers, reconciliation, period locking)
3. AI Chatbot grounding in actual ledger data and HTML security
4. Consistent API error handling & status codes
"""
import json
from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import patch

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core import mail
from django.core.cache import cache
from django.test import Client, TestCase
from django.test.utils import override_settings
from django.utils import timezone

from books import services
from books.services import advance_recurring_date
from books.models import (
    Account, AuditLog, BankAccount, BankReconciliation, BankTransaction, BankTransfer,
    Bill, BusinessLocation, Customer, DocumentNumberAllocation, DocumentNumberSeries, Expense, Invoice, InvoiceLine, Item, ItemCategory, Journal, JournalItem,
    LockDate, Organization, PaymentReceived, Quote, QuoteLine, ReceivedAllocation, StockMovement,
    UserProfile, Vendor, Warehouse, RetainerInvoice, RecurringInvoice, Project
)

User = get_user_model()

class BaseAccountingTestCase(TestCase):
    def setUp(self):
        super().setUp()
        self.org = Organization.get()
        self.org.name = 'Test Tech Corp'
        self.org.state = 'Kerala'
        self.org.gstin = '32AANCC9298C1ZE'
        self.org.save()

        self.gl_cash = Account.objects.create(organization=self.org, code='1010', name='Cash & Bank Equivalents', account_type='asset')
        self.gl_ar = Account.objects.create(organization=self.org, code='1020', name='Accounts Receivable', account_type='asset')
        self.gl_ap = Account.objects.create(organization=self.org, code='2010', name='Accounts Payable', account_type='liability')
        self.gl_sales = Account.objects.create(organization=self.org, code='4010', name='Sales Revenue', account_type='income')
        self.gl_exp = Account.objects.create(organization=self.org, code='5010', name='Office & Tech Expense', account_type='expense')

        self.admin_user = User.objects.create_user(username='admin_test', password='TestPassword123!', is_staff=True, is_superuser=True)
        self.admin_profile = UserProfile.objects.create(user=self.admin_user, organization=self.org, role=UserProfile.ADMIN)

        self.accountant_user = User.objects.create_user(username='acct_test', password='TestPassword123!')
        self.accountant_profile = UserProfile.objects.create(user=self.accountant_user, organization=self.org, role=UserProfile.ACCOUNTANT)

        self.auditor_user = User.objects.create_user(username='auditor_test', password='TestPassword123!')
        self.auditor_profile = UserProfile.objects.create(user=self.auditor_user, organization=self.org, role=UserProfile.AUDITOR)

        self.cashier_user = User.objects.create_user(username='cashier_test', password='TestPassword123!')
        self.cashier_profile = UserProfile.objects.create(user=self.cashier_user, organization=self.org, role=UserProfile.CASHIER)

        self.portal_user = User.objects.create_user(username='portal_test', password='TestPassword123!')
        self.portal_profile = UserProfile.objects.create(user=self.portal_user, organization=self.org, role=UserProfile.PORTAL)

        self.locked_user = User.objects.create_user(username='locked_test', password='TestPassword123!')
        self.locked_profile = UserProfile.objects.create(user=self.locked_user, organization=self.org, role=UserProfile.ACCOUNTANT, is_locked=True)

        self.customer = Customer.objects.create(organization=self.org, name='Acme Infotech', state='Kerala', gstin='32AANCC9298C1ZE')
        self.vendor = Vendor.objects.create(organization=self.org, name='Cloud AWS Services', state='Karnataka')

        self.cat = ItemCategory.objects.create(organization=self.org, name='SaaS Licenses')
        self.item = Item.objects.create(
            organization=self.org,
            name='Pro Subscription',
            sku='SKU-PRO-01',
            selling_price=Decimal('1000.00'),
            purchase_price=Decimal('500.00'),
            gst_rate=Decimal('18.00'),
            category='SaaS Licenses'
        )

        self.bank_hdfc = BankAccount.objects.create(
            organization=self.org,
            name='HDFC Corporate Current A/c',
            bank_name='HDFC Bank',
            account_number='50200012345678',
            opening_balance=Decimal('250000.00'),
            current_balance=Decimal('250000.00'),
            bank_balance=Decimal('250000.00'),
            gl_account=self.gl_cash
        )
        self.bank_icici = BankAccount.objects.create(
            organization=self.org,
            name='ICICI Operating A/c',
            bank_name='ICICI Bank',
            account_number='000405001234',
            opening_balance=Decimal('100000.00'),
            current_balance=Decimal('100000.00'),
            bank_balance=Decimal('100000.00'),
            gl_account=self.gl_cash
        )

class TestAuthAndRBAC(BaseAccountingTestCase):
    """Test login, session management, and role-based access control."""

    def test_session_cookie_security_settings(self):
        self.assertTrue(getattr(settings, 'SESSION_COOKIE_HTTPONLY', False))
        self.assertEqual(getattr(settings, 'SESSION_COOKIE_SAMESITE', None), 'Lax')
        self.assertEqual(getattr(settings, 'SESSION_COOKIE_AGE', 0), 86400)
        self.assertTrue(getattr(settings, 'SESSION_SAVE_EVERY_REQUEST', False))

    def test_unauthenticated_request_returns_401(self):
        client = Client()
        res = client.get('/api/me/')
        self.assertEqual(res.status_code, 401)
        data = res.json()
        self.assertIn('Authentication required', data['message'])
        self.assertEqual(data['error'], 'Authentication required.')

    def test_locked_account_blocked_with_403(self):
        client = Client()
        client.force_login(self.locked_user)
        res = client.get('/api/me/')
        self.assertEqual(res.status_code, 403)
        data = res.json()
        self.assertIn('locked', data['error'].lower())

    def test_me_endpoint_returns_rich_role_payload(self):
        client = Client()
        client.force_login(self.admin_user)
        res = client.get('/api/me/')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data['user']['role'], 'admin')
        self.assertTrue(data['user']['permissions']['can_manage_users'])
        self.assertTrue(data['user']['permissions']['can_write_accounting'])
        self.assertFalse(data['user']['permissions']['is_read_only'])

    def test_admin_can_access_tenant_admin(self):
        client = Client()
        client.force_login(self.admin_user)
        res = client.get('/api/tenant/admin/summary/')
        self.assertEqual(res.status_code, 200)

    def test_accountant_blocked_from_tenant_admin(self):
        client = Client()
        client.force_login(self.accountant_user)
        res = client.get('/api/tenant/admin/summary/')
        self.assertEqual(res.status_code, 403)
        data = res.json()
        self.assertIn('Permission denied', data['message'])

    def test_accountant_blocked_from_developer_keys(self):
        client = Client()
        client.force_login(self.accountant_user)
        res = client.get('/api/developer/keys/')
        self.assertEqual(res.status_code, 403)

    def test_auditor_has_read_only_access(self):
        client = Client()
        client.force_login(self.auditor_user)

        res = client.get('/api/invoices/')
        self.assertEqual(res.status_code, 200)

        payload = {
            'customer': self.customer.pk,
            'date': str(timezone.localdate()),
            'due_date': str(timezone.localdate() + timedelta(days=15)),
            'lines': [{'item': self.item.pk, 'description': 'Test', 'quantity': 1, 'rate': 1000, 'gst_rate': 18}]
        }
        res_post = client.post('/api/invoices/', data=json.dumps(payload), content_type='application/json')
        self.assertEqual(res_post.status_code, 403)
        self.assertIn('Auditors have read-only access', res_post.json()['message'])

    def test_cashier_can_access_billing_but_blocked_from_purchases_and_banking(self):
        client = Client()
        client.force_login(self.cashier_user)

        res_cust = client.get('/api/customers/')
        self.assertEqual(res_cust.status_code, 200)

        res_inv = client.get('/api/invoices/')
        self.assertIn(res_inv.status_code, (200, 201))

        res_bills = client.get('/api/bills/')
        self.assertEqual(res_bills.status_code, 403)

        res_xfer = client.post('/api/banking/transfer/', data=json.dumps({}), content_type='application/json')
        self.assertEqual(res_xfer.status_code, 403)

    def test_portal_user_blocked_from_internal_ledger(self):
        client = Client()
        client.force_login(self.portal_user)
        res = client.get('/api/invoices/')
        self.assertEqual(res.status_code, 403)

class TestAccountingAndTransactionIntegrity(BaseAccountingTestCase):
    """Test transaction integrity, bank transfers, reconciliation, payments, and period locks."""

    def test_vendor_creation_with_bank_and_details(self):
        # Issue 1: Vendor Creation Issue fix verification
        self.client.force_login(self.admin_user)
        payload = {
            'name': 'Apex Cloud Solutions',
            'company': 'Apex Cloud Solutions LLP',
            'contact_person': 'Rohan Sharma',
            'email': 'rohan@apexcloud.in',
            'phone': '9876543210',
            'billing_address': '404 Cyber City, Phase 2',
            'billing_city': 'Gurugram',
            'billing_pincode': '122002',
            'billing_country': 'India',
            'source_of_supply': '[06] Haryana',
            'gstin': '06AABCA1234A1Z5',
            'pan': 'AABCA1234A',
            'bank_name': 'HDFC Bank',
            'bank_account_holder': 'Apex Cloud Solutions LLP',
            'bank_account_number': '50100234567890',
            'bank_ifsc': 'HDFC0001234',
            'bank_branch': 'Cyber City',
            'contact_persons_data': [
                {'first_name': 'Rohan', 'last_name': 'Sharma', 'email': 'rohan@apexcloud.in', 'phone': '9876543210'}
            ],
            'custom_fields_data': {'Vendor Category': 'IT Hardware'},
            'active': True
        }
        res = self.client.post('/api/vendors/', data=json.dumps(payload), content_type='application/json')
        self.assertEqual(res.status_code, 201)
        data = res.json()
        self.assertEqual(data['name'], 'Apex Cloud Solutions')
        self.assertEqual(data['state'], 'Haryana')
        self.assertEqual(data['bank_account_number'], '50100234567890')
        self.assertEqual(data['bank_ifsc'], 'HDFC0001234')

    def test_invoice_creation_and_status(self):
        today = timezone.localdate()
        inv = Invoice.objects.create(
            number='INV-TEST-001',
            customer=self.customer,
            date=today,
            due_date=today + timedelta(days=15),
            subtotal=Decimal('10000.00'),
            total=Decimal('11800.00'),
            status='sent'
        )
        InvoiceLine.objects.create(
            invoice=inv,
            item=self.item,
            description='Consulting Services',
            quantity=Decimal('10.000'),
            rate=Decimal('1000.00'),
            taxable=Decimal('10000.00'),
            gst_rate=Decimal('18.00'),
            tax_amount=Decimal('1800.00'),
            line_total=Decimal('11800.00')
        )
        self.assertEqual(inv.total, Decimal('11800.00'))
        self.assertEqual(inv.status, 'sent')

    def test_payment_received_allocation_updates_invoice(self):
        today = timezone.localdate()
        inv = Invoice.objects.create(
            number='INV-TEST-002',
            customer=self.customer,
            date=today,
            due_date=today + timedelta(days=15),
            subtotal=Decimal('5000.00'),
            total=Decimal('5900.00'),
            status='sent'
        )

        pay = PaymentReceived.objects.create(
            number='REC-TEST-001',
            customer=self.customer,
            date=today,
            amount=Decimal('5900.00'),
            mode='bank_transfer',
            account='HDFC Bank',
            created_by=self.admin_user
        )
        ReceivedAllocation.objects.create(
            payment=pay,
            invoice=inv,
            amount=Decimal('5900.00')
        )

        inv_annotated = services.invoice_qs().filter(pk=inv.pk).first()
        self.assertEqual(inv_annotated.paid_sum, Decimal('5900.00'))

    def test_safe_display_status_with_null_due_date(self):
        from books.api import display_status
        inv = Invoice(
            number='INV-NULL-DUE',
            customer=self.customer,
            date=timezone.localdate(),
            due_date=None,
            subtotal=Decimal('1000.00'),
            total=Decimal('1000.00'),
            status='sent'
        )
        inv.paid_sum = Decimal('0.00')
        status = display_status(inv, 'sent', timezone.localdate())
        self.assertEqual(status, 'Sent')

    def test_bank_transfer_atomic_and_balanced_journal(self):
        data = {
            'from_account': self.bank_hdfc.pk,
            'to_account': self.bank_icici.pk,
            'amount': '50000.00',
            'date': str(timezone.localdate()),
            'reference': 'NEFT-FUND-XFER-001',
            'description': 'Working Capital Allocation'
        }
        res = services.record_bank_transfer(data, user=self.admin_user)
        self.assertTrue(res['number'][:3] == 'TXF' or '/TXF/' in res['number'])

        self.bank_hdfc.refresh_from_db()
        self.bank_icici.refresh_from_db()

        self.assertEqual(self.bank_hdfc.current_balance, Decimal('200000.00'))
        self.assertEqual(self.bank_icici.current_balance, Decimal('150000.00'))

        jnl = Journal.objects.filter(reference=f"TXF {res['number']}").first()
        self.assertIsNotNone(jnl)
        items = list(jnl.items.all())
        self.assertEqual(len(items), 2)
        debit_sum = sum(i.debit for i in items)
        credit_sum = sum(i.credit for i in items)
        self.assertEqual(debit_sum, Decimal('50000.00'))
        self.assertEqual(credit_sum, Decimal('50000.00'))
        self.assertEqual(debit_sum, credit_sum)

    def test_bank_transfer_fails_on_insufficient_funds(self):
        data = {
            'from_account': self.bank_icici.pk,
            'to_account': self.bank_hdfc.pk,
            'amount': '99999999.00',
            'date': str(timezone.localdate())
        }
        with self.assertRaises(services.ApiError) as ctx:
            services.record_bank_transfer(data, user=self.admin_user)
        self.assertIn('Insufficient funds', str(ctx.exception))

    def test_bank_transfer_rejects_invalid_amounts(self):
        data = {
            'from_account': self.bank_hdfc.pk,
            'to_account': self.bank_icici.pk,
            'date': str(timezone.localdate())
        }
        for amount in ('NaN', 'Infinity', 'not-a-number'):
            with self.subTest(amount=amount):
                data['amount'] = amount
                with self.assertRaises(services.ApiError):
                    services.record_bank_transfer(data, user=self.admin_user)

    def test_bank_transfer_is_scoped_to_the_active_organization(self):
        other_org = Organization.objects.create(name='Other Bank Org', company_id='other-bank-org')
        other_account = BankAccount.objects.create(
            organization=other_org,
            name='Other Org Account',
            bank_name='Other Bank',
            account_number='OTHER-001',
            current_balance=Decimal('1000.00'),
            bank_balance=Decimal('1000.00')
        )
        client = Client()
        client.force_login(self.accountant_user)
        payload = {
            'from_account': other_account.pk,
            'to_account': self.bank_hdfc.pk,
            'amount': '100.00',
            'date': str(timezone.localdate())
        }

        for endpoint in ('/api/banking/transfer/', '/api/bank-transfers/'):
            response = client.post(endpoint, data=json.dumps(payload), content_type='application/json')
            self.assertEqual(response.status_code, 404, response.content)

        other_account.refresh_from_db()
        self.bank_hdfc.refresh_from_db()
        self.assertEqual(other_account.current_balance, Decimal('1000.00'))
        self.assertEqual(self.bank_hdfc.current_balance, Decimal('250000.00'))
        self.assertFalse(BankTransfer.objects.filter(from_account=other_account).exists())
        self.assertFalse(BankTransaction.objects.filter(bank_account=other_account).exists())

    def test_bank_transfer_resource_stores_organization_on_all_entries(self):
        client = Client()
        client.force_login(self.accountant_user)
        response = client.post(
            '/api/bank-transfers/',
            data=json.dumps({
                'from_account': self.bank_hdfc.pk,
                'to_account': self.bank_icici.pk,
                'amount': '100.00',
                'date': str(timezone.localdate())
            }),
            content_type='application/json'
        )

        self.assertEqual(response.status_code, 201, response.content)
        transfer = BankTransfer.objects.get(pk=response.json()['id'])
        self.assertEqual(transfer.organization, self.org)
        transactions = BankTransaction.objects.filter(reference=transfer.number)
        self.assertEqual(transactions.count(), 2)
        self.assertTrue(all(txn.organization == self.org for txn in transactions))

    def test_complete_bank_reconciliation(self):
        today = timezone.localdate()
        txn = BankTransaction.objects.create(
            bank_account=self.bank_hdfc,
            date=today,
            description='Client NEFT Receipt',
            reference='NEFT-CLR-001',
            deposit=Decimal('25000.00'),
            withdrawal=Decimal('0.00'),
            balance=Decimal('275000.00'),
            status='unmatched'
        )

        rec_data = {
            'bank_account_id': self.bank_hdfc.pk,
            'statement_date': str(today),
            'statement_ending_balance': '275000.00',
            'cleared_transaction_ids': [txn.pk],
            'notes': 'Monthly statement reconciliation verified'
        }
        res = services.complete_bank_reconciliation(rec_data, user=self.admin_user)
        self.assertEqual(res['status'], 'completed')

        txn.refresh_from_db()
        self.assertEqual(txn.status, 'reconciled')
        self.assertTrue(txn.is_cleared)

        self.bank_hdfc.refresh_from_db()
        self.assertEqual(self.bank_hdfc.bank_balance, Decimal('275000.00'))

    def test_period_locking_prevents_backdated_records(self):
        today = timezone.localdate()
        lock_dt = today - timedelta(days=5)
        LockDate.objects.create(lock_date=lock_dt, reason='Quarterly Books Close', locked_by=self.admin_user)

        with self.assertRaises(services.ApiError) as ctx:
            services.check_transaction_lock(lock_dt)
        self.assertEqual(ctx.exception.status, 403)
        self.assertIn('locked for accounting compliance', str(ctx.exception))

class TestChatbotGroundingAndSecurity(BaseAccountingTestCase):
    """Test AI Copilot grounding in real DB ledger figures and secure HTML rendering."""

    def test_live_accounting_context_includes_real_metrics(self):
        ctx = services.get_live_accounting_context()
        self.assertEqual(ctx['bank_accounts_count'], 2)
        self.assertEqual(ctx['total_bank_cash'], Decimal('350000.00'))
        self.assertIn('bank_accounts_list', ctx)
        self.assertEqual(len(ctx['bank_accounts_list']), 2)

    def test_convobot_query_bank_balance_returns_grounded_accounts(self):
        res = services.process_convobot_query("What is our bank balance and cash position?", user=self.admin_user)
        self.assertIn('HDFC Corporate Current A/c', res['answer'])
        self.assertIn('ICICI Operating A/c', res['answer'])
        self.assertIn('350,000.00', res['answer'])
        self.assertEqual(res['type'], 'cards')

    def test_convobot_query_specific_invoice(self):
        today = timezone.localdate()
        inv = Invoice.objects.create(
            number='INV-4921',
            customer=self.customer,
            date=today,
            due_date=today + timedelta(days=10),
            subtotal=Decimal('20000.00'),
            total=Decimal('23600.00'),
            status='sent'
        )
        res = services.process_convobot_query("What is the status of invoice INV-4921?", user=self.admin_user)
        self.assertIn('INV-4921', res['doubt_topic'])
        self.assertIn('Acme Infotech', res['answer'])
        self.assertIn('23,600.00', res['answer'])

    def test_convobot_query_expenses(self):
        Expense.objects.create(
            number='EXP-001',
            date=timezone.localdate(),
            expense_account=self.gl_exp,
            vendor=self.vendor,
            amount=Decimal('5000.00'),
            total=Decimal('5000.00')
        )
        res = services.process_convobot_query("What did we spend on expenses?", user=self.admin_user)
        self.assertIn('Office & Tech Expense', res['answer'])
        self.assertIn('5,000.00', res['answer'])

    def test_sanitize_ai_text_removes_malicious_script(self):
        malicious = '<p>Normal text</p><script>alert("XSS")</script><img src=x onerror=alert(1)>'
        clean = services.sanitize_ai_text(malicious)
        self.assertNotIn('<script>', clean)
        self.assertNotIn('onerror', clean)
        self.assertIn('Normal text', clean)

class TestApiConsistencyAndErrorHandling(BaseAccountingTestCase):
    """Test consistent JSON error responses across API endpoints."""

    def test_api_400_bad_request_json_structure(self):
        client = Client()
        client.force_login(self.admin_user)
        res = client.post('/api/invoices/', data='invalid json', content_type='application/json')
        self.assertEqual(res.status_code, 400)
        data = res.json()
        self.assertIn('error', data)
        self.assertIn('message', data)
        self.assertIn('errors', data)

    def test_api_404_resource_not_found_json_structure(self):
        client = Client()
        client.force_login(self.admin_user)
        res = client.get('/api/nonexistent_resource_xyz/')
        self.assertEqual(res.status_code, 404)
        data = res.json()
        self.assertEqual(data['error'], 'Unknown resource.')

    def test_api_405_method_not_allowed_json_structure(self):
        client = Client()
        client.force_login(self.admin_user)

        res = client.post('/api/reports/profit-loss/', data=json.dumps({}), content_type='application/json')
        self.assertEqual(res.status_code, 405)
        data = res.json()
        self.assertEqual(data['error'], 'Method not allowed.')

class TestInventoryAndWarehouses(BaseAccountingTestCase):
    """Test inventory enhancements, warehouse hierarchies, stock adjustments, and movements."""

    def setUp(self):
        super().setUp()
        self.client = Client()
        self.client.force_login(self.admin_user)

    def test_item_sku_optional_and_auto_generated(self):
        """SKU is not mandatory and auto-generated when omitted."""
        payload = {
            'name': 'Wireless Optical Mouse',
            'sku': '',
            'selling_price': 450.00,
            'purchase_price': 250.00,
            'hsn_sac': '847160',
            'track_inventory': True,
        }
        res = self.client.post('/api/items/', data=json.dumps(payload), content_type='application/json')
        self.assertEqual(res.status_code, 201)
        data = res.json()
        self.assertTrue(data['sku'].startswith('SKU-') or '/ITEM/' in data['sku'])
        item = Item.objects.get(id=data['id'])
        self.assertTrue(item.sku.startswith('SKU-') or '/ITEM/' in item.sku)

    def test_item_hsn_sac_validation(self):
        """HSN/SAC must be exactly 6 digits."""

        res = self.client.post('/api/items/', data=json.dumps({
            'name': 'Invalid HSN Item',
            'hsn_sac': '1234',
            'selling_price': 100.00
        }), content_type='application/json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('6-digit', res.json().get('errors', {}).get('hsn_sac', ''))

        res = self.client.post('/api/items/', data=json.dumps({
            'name': 'Non-numeric HSN Item',
            'hsn_sac': 'ABCDEF',
            'selling_price': 100.00
        }), content_type='application/json')
        self.assertEqual(res.status_code, 400)

        res = self.client.post('/api/items/', data=json.dumps({
            'name': 'Valid HSN Item',
            'hsn_sac': '847130',
            'selling_price': 100.00
        }), content_type='application/json')
        self.assertEqual(res.status_code, 201)

    def test_sub_warehouse_creation_and_shared_database(self):
        """Warehouse can have sub-warehouses and shared database architecture."""

        res_main = self.client.post('/api/warehouses/', data=json.dumps({
            'name': 'Main Central Distribution Hub',
            'code': 'WH-CENTRAL',
            'is_primary': True,
            'shared_database': True
        }), content_type='application/json')
        self.assertEqual(res_main.status_code, 201)
        main_wh_id = res_main.json()['id']

        res_sub = self.client.post('/api/warehouses/', data=json.dumps({
            'name': 'Rack Zone A - Sub Hub',
            'code': 'WH-RACK-A',
            'parent_id': main_wh_id,
            'shared_database': True
        }), content_type='application/json')
        self.assertEqual(res_sub.status_code, 201)
        sub_wh_id = res_sub.json()['id']

        sub_wh = Warehouse.objects.get(id=sub_wh_id)
        self.assertEqual(sub_wh.parent_id, main_wh_id)
        self.assertTrue(sub_wh.shared_database)

        res_list = self.client.get('/api/warehouses/')
        self.assertEqual(res_list.status_code, 200)
        items = res_list.json()['results']
        sub_wh_entry = next((w for w in items if w['id'] == sub_wh_id), None)
        self.assertIsNotNone(sub_wh_entry)
        self.assertEqual(sub_wh_entry['parent_code'], 'WH-CENTRAL')
        self.assertTrue(sub_wh_entry['is_sub_warehouse'])

    def test_stock_adjustment_with_datetime_and_warehouse_code(self):
        """Stock adjustment captures date, time, and warehouse code."""
        wh = Warehouse.objects.create(organization=self.org, name='Secondary Depot', code='WH-SEC', is_primary=False)
        item = Item.objects.create(
            organization=self.org,
            name='Test Stock Widget',
            sku='SKU-STK-001',
            selling_price=Decimal('100.00'),
            track_inventory=True,
            stock=Decimal('10.000'),
            warehouse=wh,
            warehouse_code=wh.code
        )

        res = self.client.post('/api/stock-adjustments/', data=json.dumps({
            'item': item.id,
            'new_quantity': 25.0,
            'reason': 'Damaged goods',
            'date': '2026-10-29',
            'time': '16:45',
            'warehouse_id': wh.id,
            'warehouse_code': wh.code,
            'notes': 'Verified by warehouse manager'
        }), content_type='application/json')
        self.assertEqual(res.status_code, 201)

        movement = StockMovement.objects.filter(item=item, kind='adjustment').latest('id')
        self.assertEqual(movement.warehouse_code, 'WH-SEC')
        self.assertIsNotNone(movement.adjusted_at)
        local_dt = timezone.localtime(movement.adjusted_at)
        self.assertEqual(local_dt.hour, 16)
        self.assertEqual(local_dt.minute, 45)

    def test_stock_movement_transfer(self):
        """Transfer stock between warehouses via stock-movements/move/."""
        wh_src = Warehouse.objects.create(organization=self.org, name='Source Storage', code='WH-SRC')
        wh_dst = Warehouse.objects.create(organization=self.org, name='Destination Retail', code='WH-DST')
        item = Item.objects.create(
            organization=self.org,
            name='Transfer Cable Pack',
            sku='SKU-TRF-001',
            selling_price=Decimal('50.00'),
            track_inventory=True,
            stock=Decimal('100.000'),
            warehouse=wh_src,
            warehouse_code=wh_src.code
        )

        res = self.client.post('/api/stock-movements/move/', data=json.dumps({
            'item_id': item.id,
            'from_warehouse_id': wh_src.id,
            'to_warehouse_id': wh_dst.id,
            'quantity': 15.0,
            'date': '2026-10-29',
            'time': '17:15',
            'reason': 'Stock transfer for retail fulfillment'
        }), content_type='application/json')
        self.assertEqual(res.status_code, 200)

        movements = StockMovement.objects.filter(item=item, kind='transfer')
        self.assertTrue(movements.exists())
        latest_movement = movements.latest('id')
        self.assertEqual(latest_movement.warehouse_code, 'WH-SRC')
        self.assertEqual(latest_movement.to_warehouse_code, 'WH-DST')
        self.assertEqual(latest_movement.change, Decimal('15.000'))

        item.refresh_from_db()
        self.assertEqual(item.warehouse, wh_dst)
        self.assertEqual(item.warehouse_code, 'WH-DST')

    def test_inventory_summary_report_includes_warehouse_code(self):
        """Inventory summary report returns warehouse_code for each inventory item."""
        wh = Warehouse.objects.create(organization=self.org, name='Logistics Yard', code='WH-YARD')
        Item.objects.create(
            organization=self.org,
            name='Warehouse Barcode Scanner',
            sku='SKU-SCAN-01',
            selling_price=Decimal('2500.00'),
            track_inventory=True,
            stock=Decimal('5.000'),
            warehouse=wh,
            warehouse_code=wh.code
        )
        res = self.client.get('/api/reports/inventory-summary/')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        item_entry = next((x for x in data.get('results', []) if x.get('sku') == 'SKU-SCAN-01'), None)
        self.assertIsNotNone(item_entry)
        self.assertEqual(item_entry.get('warehouse_code'), 'WH-YARD')

    def test_item_preferred_vendor_lookup_and_persistence(self):
        """Verify Preferred Vendor selection from Vendor Master, persistence as FK, and retrieval."""
        vendor1 = Vendor.objects.create(organization=self.org, name='Srata Technologies', state='Kerala', active=True)
        vendor2 = Vendor.objects.create(organization=self.org, name='Global Components Ltd', state='Karnataka', active=True)

        res = self.client.post('/api/items/', data=json.dumps({
            'name': 'Precision Microcontroller',
            'sku': 'SKU-MCU-01',
            'selling_price': '150.00',
            'purchase_price': '95.00',
            'track_inventory': True,
            'preferred_vendor_id': vendor1.id,
            'reorder_level': '10'
        }), content_type='application/json')
        self.assertEqual(res.status_code, 201)
        item_id = res.json()['id']

        item = Item.objects.get(id=item_id)
        self.assertEqual(item.preferred_vendor, vendor1)
        self.assertEqual(item.preferred_vendor_id, vendor1.id)

        res_get = self.client.get(f'/api/items/{item_id}/')
        self.assertEqual(res_get.status_code, 200)
        data = res_get.json()
        self.assertEqual(data['preferred_vendor_id'], vendor1.id)
        self.assertEqual(data['preferred_vendor_name'], 'Srata Technologies')

        res_put = self.client.put(f'/api/items/{item_id}/', data=json.dumps({
            'name': 'Precision Microcontroller',
            'sku': 'SKU-MCU-01',
            'selling_price': '150.00',
            'purchase_price': '95.00',
            'track_inventory': True,
            'preferred_vendor_id': vendor2.id,
            'reorder_level': '10'
        }), content_type='application/json')
        self.assertEqual(res_put.status_code, 200)

        item.refresh_from_db()
        self.assertEqual(item.preferred_vendor, vendor2)
        self.assertEqual(res_put.json()['preferred_vendor_id'], vendor2.id)
        self.assertEqual(res_put.json()['preferred_vendor_name'], 'Global Components Ltd')

        res_clear = self.client.put(f'/api/items/{item_id}/', data=json.dumps({
            'name': 'Precision Microcontroller',
            'sku': 'SKU-MCU-01',
            'selling_price': '150.00',
            'purchase_price': '95.00',
            'track_inventory': True,
            'preferred_vendor_id': '',
            'reorder_level': '10'
        }), content_type='application/json')
        self.assertEqual(res_clear.status_code, 200)

        item.refresh_from_db()
        self.assertIsNone(item.preferred_vendor)
        self.assertIsNone(res_clear.json()['preferred_vendor_id'])
        self.assertEqual(res_clear.json()['preferred_vendor_name'], '')

    def test_reorder_point_precision_and_display(self):
        """Test Reorder Point values (0, 1, 10, 10.5, 100) and verify exact DB and API precision without trailing zeros."""
        test_values = [
            ('0', Decimal('0.000'), '0'),
            ('1', Decimal('1.000'), '1'),
            ('10', Decimal('10.000'), '10'),
            ('10.5', Decimal('10.500'), '10.5'),
            ('100', Decimal('100.000'), '100'),
        ]

        for input_val, expected_db, expected_api in test_values:
            with self.subTest(val=input_val):
                res = self.client.post('/api/items/', data=json.dumps({
                    'name': f'Reorder Test Item {input_val}',
                    'sku': f'SKU-RP-{input_val}',
                    'selling_price': '50.00',
                    'track_inventory': True,
                    'reorder_level': input_val
                }), content_type='application/json')
                self.assertEqual(res.status_code, 201)
                item_id = res.json()['id']

                item = Item.objects.get(id=item_id)
                self.assertEqual(item.reorder_level, expected_db)
                self.assertNotEqual(item.reorder_level, Decimal('9.999'))

                res_get = self.client.get(f'/api/items/{item_id}/')
                self.assertEqual(res_get.status_code, 200)
                data = res_get.json()
                self.assertEqual(data['reorder_level'], expected_api)

        item_reorder_10 = Item.objects.get(sku='SKU-RP-10')
        item_reorder_10.stock = Decimal('10.000')
        item_reorder_10.save()

        res_stock = self.client.get(f'/api/items/{item_reorder_10.id}/')
        self.assertEqual(res_stock.json()['status'], 'Low stock')

        item_reorder_10.stock = Decimal('10.001')
        item_reorder_10.save()
        res_stock2 = self.client.get(f'/api/items/{item_reorder_10.id}/')
        self.assertEqual(res_stock2.json()['status'], 'Active')


class TestQuoteModule(BaseAccountingTestCase):
    def setUp(self):
        super().setUp()
        self.client.force_login(self.admin_user)

    def test_quote_create_and_read(self):
        payload = {
            'customer_id': self.customer.id,
            'date': '2026-10-31',
            'expiry_date': '2026-11-30',
            'reference_number': 'REF-Q-001',
            'salesperson': 'John Doe',
            'project_name': 'Cloud Migration',
            'subject': 'Enterprise Quote for Q4',
            'notes': 'Thank you for your business.',
            'terms': 'Net 30 days.',
            'tax_type': 'tds',
            'tds_tcs_tax': 'TDS - 194C (1%)',
            'adjustment': '-50.00',
            'adjustment_label': 'Special Discount',
            'lines': [
                {
                    'item_id': self.item.id,
                    'description': 'Pro Subscription 1 Year',
                    'quantity': '2',
                    'rate': '1000.00',
                    'discount': '10.00',
                    'tax_rate': '18.00'
                }
            ]
        }
        res = self.client.post('/api/quotes/', data=json.dumps(payload), content_type='application/json')
        self.assertEqual(res.status_code, 201)
        data = res.json()
        self.assertTrue(data['number'].startswith('QT-') or '/QTN/' in data['number'] or '/QT/' in data['number'])
        quote_id = data['id']

        res_get = self.client.get(f'/api/quotes/{quote_id}/')
        self.assertEqual(res_get.status_code, 200)
        qdata = res_get.json()
        self.assertEqual(qdata['customer_name'], self.customer.name)
        self.assertEqual(qdata['reference_number'], 'REF-Q-001')
        self.assertEqual(qdata['salesperson'], 'John Doe')
        self.assertEqual(qdata['project_name'], 'Cloud Migration')
        self.assertEqual(qdata['subject'], 'Enterprise Quote for Q4')
        self.assertEqual(qdata['adjustment'], '-50.00')
        self.assertEqual(qdata['status'], 'draft')
        self.assertEqual(len(qdata['lines']), 1)

    def test_quote_actions_send_accept_decline(self):
        quote = Quote.objects.create(
            organization=self.org,
            customer=self.customer,
            date='2026-10-31',
            due_date='2026-11-30',
            number='QT-TEST-01',
            status='draft',
            total=Decimal('1000.00')
        )
        QuoteLine.objects.create(
            quote=quote,
            item=self.item,
            description='Test item',
            quantity=Decimal('1'),
            rate=Decimal('1000.00'),
            taxable=Decimal('1000.00'),
            tax_amount=Decimal('180.00'),
            line_total=Decimal('1180.00'),
            gst_rate=Decimal('18.00')
        )

        res_send = self.client.post(f'/api/quotes/{quote.id}/send/')
        self.assertEqual(res_send.status_code, 200)
        quote.refresh_from_db()
        self.assertEqual(quote.status, 'sent')
        self.assertIsNotNone(quote.sent_at)

        res_accept = self.client.post(f'/api/quotes/{quote.id}/accept/')
        self.assertEqual(res_accept.status_code, 200)
        quote.refresh_from_db()
        self.assertEqual(quote.status, 'accepted')

        res_decline = self.client.post(f'/api/quotes/{quote.id}/decline/')
        self.assertEqual(res_decline.status_code, 200)
        quote.refresh_from_db()
        self.assertEqual(quote.status, 'declined')

    def test_quote_convert_to_invoice(self):
        payload = {
            'customer_id': self.customer.id,
            'date': '2026-10-31',
            'lines': [
                {
                    'item_id': self.item.id,
                    'quantity': '3',
                    'rate': '1000.00',
                    'discount': '0',
                    'tax_rate': '18.00'
                }
            ]
        }
        res = self.client.post('/api/quotes/', data=json.dumps(payload), content_type='application/json')
        self.assertEqual(res.status_code, 201)
        quote_id = res.json()['id']

        res_conv = self.client.post(f'/api/quotes/{quote_id}/convert-to-invoice/')
        self.assertEqual(res_conv.status_code, 200)
        conv_data = res_conv.json()
        invoice_id = conv_data['invoice_id']

        inv_res = self.client.get(f'/api/invoices/{invoice_id}/')
        self.assertEqual(inv_res.status_code, 200)
        inv_data = inv_res.json()
        self.assertEqual(inv_data['party_id'], self.customer.id)
        self.assertEqual(len(inv_data['lines']), 1)
        self.assertEqual(inv_data['lines'][0]['item'], self.item.id)
        self.assertEqual(Decimal(str(inv_data['lines'][0]['quantity'])), Decimal('3'))

        q_res = self.client.get(f'/api/quotes/{quote_id}/')
        self.assertEqual(q_res.json()['status'], 'invoiced')

    def test_quote_convert_to_sales_order(self):
        payload = {
            'customer_id': self.customer.id,
            'date': '2026-10-31',
            'lines': [
                {
                    'item_id': self.item.id,
                    'quantity': '5',
                    'rate': '1000.00',
                    'discount': '0',
                    'tax_rate': '18.00'
                }
            ]
        }
        res = self.client.post('/api/quotes/', data=json.dumps(payload), content_type='application/json')
        self.assertEqual(res.status_code, 201)
        quote_id = res.json()['id']

        res_conv = self.client.post(f'/api/quotes/{quote_id}/convert-to-sales-order/')
        self.assertEqual(res_conv.status_code, 200)
        conv_data = res_conv.json()
        so_id = conv_data['sales_order_id']

        so_res = self.client.get(f'/api/sales-orders/{so_id}/')
        self.assertEqual(so_res.status_code, 200)
        so_data = so_res.json()
        self.assertEqual(so_data['customer_id'], self.customer.id)
        self.assertEqual(len(so_data['lines']), 1)
        self.assertEqual(so_data['lines'][0]['item'], self.item.id)
        self.assertEqual(Decimal(str(so_data['lines'][0]['quantity'])), Decimal('5'))

        q_res = self.client.get(f'/api/quotes/{quote_id}/')
        self.assertEqual(q_res.json()['status'], 'ordered')

        # Test duplicate conversion prevention (Issue 4)
        # Cannot convert already converted quote to sales order again
        dup_so = self.client.post(f'/api/quotes/{quote_id}/convert-to-sales-order/')
        self.assertEqual(dup_so.status_code, 400)
        self.assertIn('already been converted', dup_so.json().get('error', ''))

        # Cannot convert quote already converted to SO into an invoice
        dup_inv = self.client.post(f'/api/quotes/{quote_id}/convert-to-invoice/')
        self.assertEqual(dup_inv.status_code, 400)
        self.assertIn('already been converted', dup_inv.json().get('error', ''))

    def test_quote_sequence_configuration(self):
        # Issue 3: Quotation serial number configuration
        # 1. Get current sequence
        res_get = self.client.get('/api/quotes/sequence/')
        self.assertEqual(res_get.status_code, 200)
        self.assertIn('prefix', res_get.json())

        # 2. Configure prefix and next sequence
        res_set = self.client.post('/api/quotes/sequence/', data=json.dumps({
            'prefix': 'EST',
            'next_sequence': 100
        }), content_type='application/json')
        self.assertEqual(res_set.status_code, 200)
        self.assertEqual(res_set.json()['prefix'], 'EST')
        self.assertTrue('EST' in res_set.json()['formatted'] and '00100' in res_set.json()['formatted'])

        # 3. Next quote lookup returns configured sequence
        lookup_res = self.client.get('/api/lookup/next-quote-number/')
        self.assertEqual(lookup_res.status_code, 200)
        self.assertTrue('EST' in lookup_res.json()['next_number'] and '00100' in lookup_res.json()['next_number'])

        # 4. Creating quote without manual number uses sequence
        payload = {
            'customer_id': self.customer.id,
            'date': '2026-10-31',
            'lines': [{'item_id': self.item.id, 'quantity': '1', 'rate': '500.00'}]
        }
        res_q = self.client.post('/api/quotes/', data=json.dumps(payload), content_type='application/json')
        self.assertEqual(res_q.status_code, 201)
        self.assertTrue('EST' in res_q.json()['number'] and '00100' in res_q.json()['number'])

        # 5. Next quote is 00101
        lookup_res2 = self.client.get('/api/lookup/next-quote-number/')
        self.assertTrue('EST' in lookup_res2.json()['next_number'] and '00101' in lookup_res2.json()['next_number'])

    def test_duplicate_quote_convert_to_invoice(self):
        # Issue 4: Prevent multiple conversions to invoice
        payload = {
            'customer_id': self.customer.id,
            'date': '2026-10-31',
            'lines': [{'item_id': self.item.id, 'quantity': '1', 'rate': '100.00'}]
        }
        res = self.client.post('/api/quotes/', data=json.dumps(payload), content_type='application/json')
        self.assertEqual(res.status_code, 201)
        qid = res.json()['id']

        # First conversion succeeds
        c1 = self.client.post(f'/api/quotes/{qid}/convert-to-invoice/')
        self.assertEqual(c1.status_code, 200)

        # Second conversion fails
        c2 = self.client.post(f'/api/quotes/{qid}/convert-to-invoice/')
        self.assertEqual(c2.status_code, 400)
        self.assertIn('already been converted', c2.json().get('error', ''))

    def test_sales_order_view_and_edit(self):
        # 1. Create Sales Order
        payload = {
            'customer_id': self.customer.id,
            'date': '2026-11-04',
            'expected_shipment_date': '2026-11-15',
            'order_number': 'PO-TEST-99',
            'notes': 'Deliver before 5 PM',
            'terms': 'Payment within 15 days',
            'lines': [
                {
                    'item_id': self.item.id,
                    'description': 'Item for SO',
                    'quantity': '4',
                    'rate': '250.00',
                    'discount': '0.00',
                    'tax_rate': '18.00'
                }
            ]
        }
        res = self.client.post('/api/sales-orders/', data=json.dumps(payload), content_type='application/json')
        self.assertEqual(res.status_code, 201)
        so_data = res.json()
        so_id = so_data['id']
        self.assertTrue(so_data['number'].startswith('SO-') or '/SO/' in so_data['number'])

        # 2. View Sales Order Detail
        get_res = self.client.get(f'/api/sales-orders/{so_id}/')
        self.assertEqual(get_res.status_code, 200)
        detail = get_res.json()
        self.assertEqual(detail['customer_id'], self.customer.id)
        self.assertEqual(detail['customer_name'], self.customer.name)
        self.assertEqual(detail['party'], self.customer.name)
        self.assertEqual(detail['order_number'], 'PO-TEST-99')
        self.assertEqual(detail['notes'], 'Deliver before 5 PM')
        self.assertEqual(detail['terms'], 'Payment within 15 days')
        self.assertEqual(len(detail['lines']), 1)
        self.assertEqual(Decimal(str(detail['lines'][0]['quantity'])), Decimal('4'))
        self.assertEqual(Decimal(str(detail['subtotal'])), Decimal('1000.00'))

        # 3. Edit / Update Sales Order
        update_payload = {
            'customer_id': self.customer.id,
            'date': '2026-11-05',
            'expected_shipment_date': '2026-11-20',
            'order_number': 'PO-TEST-99-UPDATED',
            'notes': 'Updated delivery instructions',
            'terms': 'Payment within 30 days',
            'status': 'confirmed',
            'lines': [
                {
                    'item_id': self.item.id,
                    'description': 'Updated item description',
                    'quantity': '6',
                    'rate': '300.00',
                    'discount': '5.00',
                    'tax_rate': '18.00'
                }
            ]
        }
        put_res = self.client.put(f'/api/sales-orders/{so_id}/', data=json.dumps(update_payload), content_type='application/json')
        self.assertEqual(put_res.status_code, 200)

        # 4. Verify updated details
        get_res2 = self.client.get(f'/api/sales-orders/{so_id}/')
        self.assertEqual(get_res2.status_code, 200)
        detail2 = get_res2.json()
        self.assertEqual(detail2['order_number'], 'PO-TEST-99-UPDATED')
        self.assertEqual(detail2['notes'], 'Updated delivery instructions')
        self.assertEqual(detail2['status'], 'confirmed')
        self.assertEqual(len(detail2['lines']), 1)
        self.assertEqual(Decimal(str(detail2['lines'][0]['quantity'])), Decimal('6'))
        self.assertEqual(Decimal(str(detail2['lines'][0]['rate'])), Decimal('300.00'))

        # 5. Convert Sales Order to Invoice
        conv_res = self.client.post(f'/api/sales-orders/{so_id}/convert-to-invoice/')
        self.assertEqual(conv_res.status_code, 200)
        conv_data = conv_res.json()
        inv_id = conv_data['invoice_id']
        self.assertTrue(conv_data['number'].startswith('INV-') or '/INV/' in conv_data['number'])

        inv_res = self.client.get(f'/api/invoices/{inv_id}/')
        self.assertEqual(inv_res.status_code, 200)
        inv_data = inv_res.json()
        self.assertEqual(inv_data['party_id'], self.customer.id)
        self.assertEqual(len(inv_data['lines']), 1)



class TestQABugReportFixes(BaseAccountingTestCase):
    def setUp(self):
        super().setUp()
        self.client.force_login(self.admin_user)

    def test_customer_primary_contact_validation(self):
        # DEF_CB_006: Primary Contact accepts invalid special characters
        payload = {
            'name': 'Valid Customer Name',
            'contact_person': '@#ndls%jje',
            'email': 'valid@example.com'
        }
        res = self.client.post('/api/customers/', data=json.dumps(payload), content_type='application/json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('contact_person', res.json().get('errors', {}))

    def test_customer_display_name_validation(self):
        # DEF_CB_007: Customer Display Name accepts invalid special characters
        payload = {
            'name': 'dfgh#@3$567',
            'email': 'valid@example.com'
        }
        res = self.client.post('/api/customers/', data=json.dumps(payload), content_type='application/json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('name', res.json().get('errors', {}))

    def test_customer_email_spaces_validation(self):
        # DEF_CB_008: Email Address field accepts spaces
        payload = {
            'name': 'Angel Rebecca',
            'email': 'angel @gmail.com'
        }
        res = self.client.post('/api/customers/', data=json.dumps(payload), content_type='application/json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('email', res.json().get('errors', {}))

    def test_export_empty_data_warning(self):
        # DEF_CB_010: Export generates blank file without warning when empty
        Item.objects.all().delete()
        res = self.client.get('/api/items/?export=csv')
        self.assertEqual(res.status_code, 400)
        self.assertIn('No data available to export', res.json().get('error', ''))

    def test_item_name_validation(self):
        # DEF_CB_013: Item Name accepts unsupported special characters
        payload = {
            'name': '#@!2345sdfdew',
            'selling_price': '100.00'
        }
        res = self.client.post('/api/items/', data=json.dumps(payload), content_type='application/json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('name', res.json().get('errors', {}))

    def test_item_category_validation(self):
        # DEF_CB_014: Category accepts special characters
        payload = {
            'name': 'Valid Item Name',
            'selling_price': '100.00',
            'category': '243@@@@24hiojh'
        }
        res = self.client.post('/api/items/', data=json.dumps(payload), content_type='application/json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('category', res.json().get('errors', {}))

    def test_item_sku_validation(self):
        # DEF_CB_015: SKU accepts special characters
        payload = {
            'name': 'Valid Item Name',
            'selling_price': '100.00',
            'sku': '@#$%&*'
        }
        res = self.client.post('/api/items/', data=json.dumps(payload), content_type='application/json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('sku', res.json().get('errors', {}))

    def test_item_mandatory_selling_price(self):
        # DEF_CB_016: Item creation allowed without mandatory Selling Price
        payload = {
            'name': 'Item Missing Price'
        }
        res = self.client.post('/api/items/', data=json.dumps(payload), content_type='application/json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('selling_price', res.json().get('errors', {}))


class TestSettingsModuleAndPermissions(BaseAccountingTestCase):
    def test_django_admin_is_restricted_to_platform_superusers(self):
        staff_user = User.objects.create_user(
            username='tenant_staff_admin',
            password='TestPassword123!',
            is_staff=True,
        )
        UserProfile.objects.create(
            user=staff_user,
            organization=self.org,
            role=UserProfile.ADMIN,
        )
        self.client.force_login(staff_user)
        self.assertEqual(self.client.get('/admin/').status_code, 302)

        self.client.force_login(self.admin_user)
        self.assertEqual(self.client.get('/admin/').status_code, 200)

    def test_settings_all_endpoint(self):
        self.client.force_login(self.admin_user)
        res = self.client.get('/api/settings/all/')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn('organization', data)
        self.assertIn('users', data)
        self.assertIn('roles', data)
        self.assertIn('currencies', data)
        self.assertIn('payment_terms', data)
        self.assertIn('number_series', data)

    def test_settings_unauthorized_access_prevented(self):
        # Non-admin user without settings permission should be rejected
        self.client.force_login(self.auditor_user)
        res = self.client.get('/api/settings/all/')
        self.assertEqual(res.status_code, 403)

    def test_users_list_and_invite(self):
        self.client.force_login(self.admin_user)
        res = self.client.get('/api/settings/users/')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(len(data.get('users', [])) >= 1)

        # Invite user
        invite_payload = {
            'name': 'Test New Employee',
            'email': 'newemployee@convosis.com',
            'is_accountant': False
        }
        res_inv = self.client.post('/api/settings/users/invite/', data=json.dumps(invite_payload), content_type='application/json')
        self.assertIn(res_inv.status_code, (200, 201))
        self.assertEqual(res_inv.json().get('status'), 'ok')

    def test_roles_crud_and_duplicate(self):
        self.client.force_login(self.admin_user)
        # List roles
        res = self.client.get('/api/settings/roles/')
        self.assertEqual(res.status_code, 200)
        roles = res.json().get('roles', [])
        role_names = [r['name'] for r in roles]
        self.assertIn('Admin', role_names)
        self.assertIn('Staff', role_names)

        # Create custom role
        role_payload = {
            'name': 'Custom Senior Accountant',
            'description': 'Handles journal approvals',
            'api_only': False,
            'is_accountant': True,
            'permissions': {'accountant': {'journals': {'full': True, 'view': True, 'approve': True}}},
            'report_permissions': {'all_reports': False, 'groups': {'accountant': {'full': True}}}
        }
        res_create = self.client.post('/api/settings/roles/', data=json.dumps(role_payload), content_type='application/json')
        self.assertEqual(res_create.status_code, 201)
        created_id = res_create.json()['id']

        # Duplicate role
        res_dup = self.client.post(f'/api/settings/roles/{created_id}/duplicate/')
        self.assertEqual(res_dup.status_code, 201)
        self.assertIn('Copy', res_dup.json()['name'])

        # Delete role
        res_del = self.client.delete(f'/api/settings/roles/{created_id}/')
        self.assertEqual(res_del.status_code, 200)

    def test_taxes_and_direct_taxes(self):
        self.client.force_login(self.admin_user)
        res = self.client.get('/api/settings/taxes/')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(any(t['name'] == 'GST18' for t in data.get('taxes', [])))
        self.assertTrue(any(t['name'] == 'IGST18' for t in data.get('taxes', [])))

        # Update direct taxes TDS settings
        dt_payload = {
            'direct_tax_settings': {
                'tds_level': 'line',
                'enable_tds_liabilities_report': True
            }
        }
        res_dt = self.client.post('/api/settings/taxes/', data=json.dumps(dt_payload), content_type='application/json')
        self.assertEqual(res_dt.status_code, 200)
        self.assertEqual(res_dt.json()['direct_tax_settings']['tds_level'], 'line')

    def test_organization_settings_and_compliance(self):
        self.client.force_login(self.admin_user)
        update_payload = {
            'name': 'Convosis Technologies Enterprise',
            'general_settings': {
                'eway_bill': {'enabled': True, 'threshold': 50000},
                'einvoicing': {'enabled': True, 'mode': 'sandbox'},
                'msme': {'enabled': True, 'classification': 'Micro', 'udyam_number': 'UDYAM-KL-07-0012345'}
            }
        }
        res = self.client.put('/api/settings/organization/', data=json.dumps(update_payload), content_type='application/json')
        self.assertEqual(res.status_code, 200)
        org_data = res.json()
        self.assertEqual(org_data['name'], 'Convosis Technologies Enterprise')
        self.assertTrue(org_data['general_settings']['eway_bill']['enabled'])
        self.assertEqual(org_data['general_settings']['msme']['classification'], 'Micro')


class TestRetainerAndRecurringInvoiceModules(BaseAccountingTestCase):
    def setUp(self):
        super().setUp()
        self.admin_user.is_superuser = False
        self.admin_user.save(update_fields=['is_superuser'])
        self.client.force_login(self.admin_user)

    @override_settings(PASSWORD_RESET_EMAIL_CONFIGURED=True)
    @patch('books.services.EmailMessage.send', return_value=0)
    def test_retainer_email_rejection_is_audited_without_marking_invoice_sent(self, send_email):
        created = self.client.post(
            '/api/retainer-invoices/',
            data=json.dumps({
                'customer': self.customer.pk,
                'date': str(date.today()),
                'lines': [{'description': 'Advance', 'amount': '100.00'}],
            }),
            content_type='application/json',
        )
        self.assertEqual(created.status_code, 201, created.content)
        retainer_id = created.json()['id']

        rejected = self.client.post(
            f'/api/retainer-invoices/{retainer_id}/email/',
            data=json.dumps({'to_email': 'client@example.com'}),
            content_type='application/json',
        )

        self.assertEqual(rejected.status_code, 503)
        send_email.assert_called_once()
        retainer = RetainerInvoice.objects.get(pk=retainer_id)
        self.assertEqual(retainer.status, 'draft')
        self.assertIsNone(retainer.sent_at)
        self.assertEqual(retainer.payments.count(), 0)
        failed_delivery = AuditLog.objects.get(
            action='send_email',
            entity_type='RetainerInvoice',
            entity_id=str(retainer_id),
        )
        self.assertEqual(failed_delivery.status, 'failure')
        self.assertEqual(failed_delivery.details['delivery_status'], 'failed')

    def test_retainer_signature_does_not_persist_placeholder_title(self):
        created = self.client.post(
            '/api/retainer-invoices/',
            data=json.dumps({
                'customer': self.customer.pk,
                'date': str(date.today()),
                'lines': [{'description': 'Advance', 'amount': '100.00'}],
            }),
            content_type='application/json',
        )
        self.assertEqual(created.status_code, 201, created.content)
        retainer_id = created.json()['id']

        signed = self.client.post(
            f'/api/retainer-invoices/{retainer_id}/sign/',
            data=json.dumps({
                'signature_data': 'data:image/png;base64,c2lnbmF0dXJl',
                'signed_by': 'Test Signer',
                'signature_title': '',
            }),
            content_type='application/json',
        )

        self.assertEqual(signed.status_code, 200, signed.content)
        self.assertEqual(signed.json()['signature_title'], '')
        self.assertEqual(RetainerInvoice.objects.get(pk=retainer_id).signature_title, '')

    def test_retainer_invoice_form_fields_round_trip(self):
        project = Project.objects.create(
            organization=self.org,
            customer=self.customer,
            name='Retainer Form Project',
        )
        payload = {
            'customer': self.customer.id,
            'date': str(date.today()),
            'due_date': str(date.today() + timedelta(days=30)),
            'reference': 'PO-RET-42',
            'project_name': project.name,
            'purpose': 'Project advance',
            'notes': 'Customer notes for this retainer.',
            'terms_conditions': 'Retainer terms for this customer.',
            'custom_fields_data': {'Engagement code': 'ENG-42', 'Client contact': 'Mira'},
            'lines': [
                {'description': 'Discovery phase', 'amount': '125.25'},
                {'description': 'Support reserve', 'amount': '75.50'},
                {'description': 'Zero-value line', 'amount': '0.00'},
            ],
            'project_id': project.pk,
        }
        response = self.client.post(
            '/api/retainer-invoices/',
            data=json.dumps(payload),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 201, response.content)
        retainer_id = response.json()['id']
        detail = self.client.get(f'/api/retainer-invoices/{retainer_id}/').json()
        self.assertTrue(detail['number'])
        self.assertEqual(detail['reference'], 'PO-RET-42')
        self.assertEqual(detail['project_name'], project.name)
        self.assertEqual(detail['project_id'], project.pk)
        self.assertEqual(detail['notes'], 'Customer notes for this retainer.')
        self.assertEqual(detail['terms'], 'Retainer terms for this customer.')
        self.assertEqual(detail['custom_fields_data'], {'Engagement code': 'ENG-42', 'Client contact': 'Mira'})
        self.assertEqual([line['description'] for line in detail['lines']], [
            'Discovery phase', 'Support reserve', 'Zero-value line',
        ])
        self.assertEqual(Decimal(str(detail['total'])), Decimal('200.75'))

        payload.update({
            'number': detail['number'],
            'reference': 'PO-RET-43',
            'notes': 'Updated customer notes.',
            'terms_conditions': 'Updated retainer terms.',
            'custom_fields_data': {'Engagement code': 'ENG-43'},
            'lines': [
                {'description': 'Updated phase', 'amount': '210.00'},
            ],
        })
        update = self.client.put(
            f'/api/retainer-invoices/{retainer_id}/',
            data=json.dumps(payload),
            content_type='application/json',
        )
        self.assertEqual(update.status_code, 200, update.content)
        updated = self.client.get(f'/api/retainer-invoices/{retainer_id}/').json()
        self.assertEqual(updated['number'], detail['number'])
        self.assertEqual(updated['reference'], 'PO-RET-43')
        self.assertEqual(updated['notes'], 'Updated customer notes.')
        self.assertEqual(updated['terms'], 'Updated retainer terms.')
        self.assertEqual(updated['custom_fields_data'], {'Engagement code': 'ENG-43'})
        self.assertEqual(updated['project_name'], project.name)
        self.assertEqual(updated['project_id'], project.pk)
        self.assertEqual(Decimal(str(updated['total'])), Decimal('210.00'))

    def test_retainer_amount_rows_reject_invalid_values_and_foreign_projects(self):
        project = Project.objects.create(
            organization=self.org,
            customer=self.customer,
            name='Scoped Retainer Project',
        )
        other_customer = Customer.objects.create(
            organization=self.org,
            name='Another Project Customer',
            state=self.org.state,
        )
        other_project = Project.objects.create(
            organization=self.org,
            customer=other_customer,
            name='Not This Customer Project',
        )
        base_payload = {
            'customer': self.customer.pk,
            'project_id': project.pk,
            'date': str(date.today()),
            'due_date': str(date.today()),
            'lines': [{'description': 'Valid retainer line', 'amount': '12.34'}],
        }
        for invalid_amount in ('-0.01', 'not-an-amount'):
            payload = dict(base_payload)
            payload['lines'] = [{'description': 'Invalid retainer line', 'amount': invalid_amount}]
            response = self.client.post(
                '/api/retainer-invoices/',
                data=json.dumps(payload),
                content_type='application/json',
            )
            self.assertEqual(response.status_code, 400, response.content)

        base_payload['project_id'] = other_project.pk
        response = self.client.post(
            '/api/retainer-invoices/',
            data=json.dumps(base_payload),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 400, response.content)

    @override_settings(
        PASSWORD_RESET_EMAIL_CONFIGURED=True,
        EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
    )
    def test_retainer_email_attaches_generated_pdf(self):
        response = self.client.post(
            '/api/retainer-invoices/',
            data=json.dumps({
                'customer': self.customer.pk,
                'date': str(date.today()),
                'due_date': str(date.today()),
                'reference': 'RET-PDF-1',
                'notes': 'PDF customer notes',
                'terms_conditions': 'PDF terms',
                'custom_fields_data': {'Engagement': 'PDF project'},
                'lines': [
                    {'description': 'PDF discovery work', 'amount': '100.25'},
                    {'description': 'PDF support work', 'amount': '50.50'},
                ],
            }),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 201, response.content)
        retainer = RetainerInvoice.objects.get(pk=response.json()['id'])
        self.assertTrue(services.generate_retainer_invoice_pdf(retainer).startswith(b'%PDF-'))

        email_response = self.client.post(
            f'/api/retainer-invoices/{retainer.pk}/email/',
            data=json.dumps({
                'to_email': 'customer@example.com',
                'subject': f'Retainer Invoice {retainer.number}',
                'message': 'Please see the attached retainer invoice.',
            }),
            content_type='application/json',
        )
        self.assertEqual(email_response.status_code, 200, email_response.content)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ['customer@example.com'])
        self.assertEqual(len(mail.outbox[0].attachments), 1)
        filename, pdf_content, content_type = mail.outbox[0].attachments[0]
        self.assertEqual(filename, f'{retainer.number}.pdf')
        self.assertEqual(content_type, 'application/pdf')
        self.assertTrue(pdf_content.startswith(b'%PDF-'))
        self.assertGreater(len(pdf_content), 1000)

    def test_retainer_location_and_number_series_round_trip(self):
        location = BusinessLocation.objects.create(
            organization=self.org,
            name='Kochi Office',
            gstin='32AANCC9298C1ZE',
            state='Kerala',
            is_default=True,
        )
        series = DocumentNumberSeries.objects.create(
            organization=self.org,
            name='Kochi B2B Retainers',
            document_type='retainer_invoices',
            customer_type='b2b',
            location=location.name,
            business_location=location,
            gstin=location.gstin,
            prefix='RET-%FY%',
            separator='-',
            starting_number=8,
            next_number=8,
            padding=4,
            is_default=True,
        )

        preview = self.client.get(
            f'/api/lookup/next-retainer-number/?customer_id={self.customer.pk}'
            f'&business_location_id={location.pk}&date={date.today()}'
        )
        self.assertEqual(preview.status_code, 200, preview.content)
        self.assertTrue(preview.json()['next_number'].startswith('RET-'))
        self.assertTrue(preview.json()['next_number'].endswith('0008'))

        consumer = Customer.objects.create(
            organization=self.org,
            name='Individual Retainer Customer',
            customer_type='individual',
        )
        no_match = self.client.get(
            f'/api/lookup/next-retainer-number/?customer_id={consumer.pk}'
            f'&business_location_id={location.pk}&date={date.today()}'
        )
        self.assertEqual(no_match.status_code, 400)

        response = self.client.post(
            '/api/retainer-invoices/',
            data=json.dumps({
                'customer': self.customer.pk,
                'business_location_id': location.pk,
                'date': str(date.today()),
                'due_date': str(date.today()),
                'lines': [{'description': 'Kochi retainer', 'quantity': 1, 'rate': '150.00'}],
            }),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 201, response.content)
        self.assertTrue(response.json()['number'].startswith('RET-'))
        self.assertEqual(
            DocumentNumberAllocation.objects.get(number=response.json()['number']).series_id,
            series.pk,
        )

        detail = self.client.get(f"/api/retainer-invoices/{response.json()['id']}/").json()
        self.assertEqual(detail['business_location_id'], location.pk)
        self.assertEqual(detail['business_location_gstin'], location.gstin)
        self.assertEqual(detail['location'], location.name)

    def test_retainer_location_and_series_apis_are_organization_scoped(self):
        other_org = Organization.objects.create(name='Other Location Org')
        other_location = BusinessLocation.objects.create(
            organization=other_org, name='Private Location', gstin='29AANCC9298C1ZE'
        )
        other_series = DocumentNumberSeries.objects.create(
            organization=self.org,
            name='Invoice Only',
            document_type='invoices',
            prefix='INV',
        )

        locations = self.client.get('/api/settings/locations/')
        self.assertEqual(locations.status_code, 200)
        self.assertEqual(locations.json()['locations'], [])
        self.assertEqual(self.client.get('/api/settings/retainer-number-series/').json()['series'], [])

        forbidden_location = self.client.post(
            '/api/retainer-invoices/',
            data=json.dumps({
                'customer': self.customer.pk,
                'business_location_id': other_location.pk,
                'date': str(date.today()),
                'lines': [{'description': 'Invalid location', 'rate': '1.00'}],
            }),
            content_type='application/json',
        )
        self.assertEqual(forbidden_location.status_code, 400)

        self.assertEqual(
            self.client.delete(f'/api/settings/retainer-number-series/{other_series.pk}/').status_code,
            404,
        )

    def test_retainer_location_without_gstin_does_not_inherit_organization_gstin(self):
        location = BusinessLocation.objects.create(
            organization=self.org,
            name='GSTIN-free Office',
            gstin='',
        )
        DocumentNumberSeries.objects.create(
            organization=self.org,
            name='Incorrect Organization GSTIN Series',
            document_type='retainer_invoices',
            customer_type='b2b',
            location=location.name,
            gstin=self.org.gstin,
            business_location=location,
            prefix='RET',
        )

        preview = self.client.get(
            f'/api/lookup/next-retainer-number/?customer_id={self.customer.pk}'
            f'&business_location_id={location.pk}&date={date.today()}'
        )
        self.assertEqual(preview.status_code, 400)

    def test_retainer_business_location_settings_validate_gstin_and_default(self):
        invalid = self.client.post(
            '/api/settings/locations/',
            data=json.dumps({'name': 'Invalid GSTIN Location', 'gstin': 'bad'}),
            content_type='application/json',
        )
        self.assertEqual(invalid.status_code, 400)

        created = self.client.post(
            '/api/settings/locations/',
            data=json.dumps({
                'name': 'Default Office',
                'gstin': '32AANCC9298C1ZE',
                'is_default': True,
                'warehouse_ids': [],
            }),
            content_type='application/json',
        )
        self.assertEqual(created.status_code, 201, created.content)
        location = created.json()['location']
        self.assertTrue(location['is_default'])

        configured_series = self.client.post(
            '/api/settings/retainer-number-series/',
            data=json.dumps({
                'name': 'Default Retainer Series',
                'customer_type': 'b2b',
                'business_location_id': location['id'],
                'prefix': 'RET-%FY%',
                'separator': '-',
                'starting_number': 1,
                'next_number': 1,
                'padding': 5,
                'is_default': True,
            }),
            content_type='application/json',
        )
        self.assertEqual(configured_series.status_code, 201, configured_series.content)
        self.assertEqual(configured_series.json()['series']['business_location_id'], location['id'])
        self.assertTrue(configured_series.json()['series']['is_default'])

        inactive_default = self.client.put(
            f"/api/settings/locations/{location['id']}/",
            data=json.dumps({
                'name': 'Default Office',
                'gstin': '32AANCC9298C1ZE',
                'is_default': True,
                'active': False,
                'warehouse_ids': [],
            }),
            content_type='application/json',
        )
        self.assertEqual(inactive_default.status_code, 400)


    def test_retainer_custom_fields_are_organization_scoped(self):
        response = self.client.post(
            '/api/retainer-invoices/',
            data=json.dumps({
                'customer': self.customer.id,
                'date': str(date.today()),
                'due_date': str(date.today()),
                'custom_fields_data': {'Engagement code': 'ORG-ONLY'},
                'lines': [{'description': 'Organization scoped retainer', 'quantity': 1, 'rate': '10.00'}],
            }),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 201, response.content)
        retainer_id = response.json()['id']

        other_org = Organization.objects.create(name='Other Retainer Org', company_id='other-retainer-org')
        other_user = User.objects.create_user(username='other_retainer_admin', password='TestPassword123!')
        UserProfile.objects.create(user=other_user, organization=other_org, role=UserProfile.ADMIN)
        other_client = Client()
        other_client.force_login(other_user)

        self.assertEqual(other_client.get(f'/api/retainer-invoices/{retainer_id}/').status_code, 404)
        other_list = other_client.get('/api/retainer-invoices/').json()
        other_ids = {row['id'] for row in other_list.get('results', [])}
        self.assertNotIn(retainer_id, other_ids)

    def test_retainer_invoice_lifecycle_and_accounting(self):
        """
        Retainer Invoice:
        1. Create retainer invoice
        2. Record full payment -> updates bank, posts advance liability journal, status -> Paid
        3. Create final sales invoice
        4. Apply retainer credit to invoice -> reduces invoice balance, posts allocation journal, status -> Fully Applied
        """
        # 1. Create Retainer Invoice
        create_payload = {
            'customer': self.customer.id,
            'date': str(date.today()),
            'due_date': str(date.today() + timedelta(days=15)),
            'reference': 'RET-PO-900',
            'lines': [
                {
                    'item': self.item.id,
                    'description': 'Advance for Q4 Software Development',
                    'quantity': 1,
                    'rate': '100000.00',
                    'discount_percent': '0.00',
                    'gst_rate': '0.00'
                }
            ],
            'notes': 'Advance payment request'
        }
        res = self.client.post('/api/retainer-invoices/', data=json.dumps(create_payload), content_type='application/json')
        self.assertEqual(res.status_code, 201)
        ret_id = res.json()['id']
        ret = RetainerInvoice.objects.get(pk=ret_id)
        self.assertEqual(ret.total_amount, Decimal('100000.00'))
        self.assertEqual(ret.status, 'draft')

        # Send Retainer
        res_send = self.client.post(f'/api/retainer-invoices/{ret_id}/send/', data=json.dumps({}), content_type='application/json')
        self.assertEqual(res_send.status_code, 200)
        ret.refresh_from_db()
        self.assertEqual(ret.status, 'sent')
        self.assertIsNotNone(ret.sent_at)
        detail_after_send = self.client.get(f'/api/retainer-invoices/{ret_id}/').json()
        self.assertEqual(detail_after_send['raw_status'], 'sent')
        self.assertIsNotNone(detail_after_send['sent_at'])
        self.assertEqual(ret.payments.count(), 0)
        self.assertEqual(
            AuditLog.objects.filter(
                action='send', entity_type='RetainerInvoice', entity_id=str(ret_id)
            ).count(),
            1,
        )
        duplicate_send = self.client.post(
            f'/api/retainer-invoices/{ret_id}/send/',
            data=json.dumps({}),
            content_type='application/json',
        )
        self.assertEqual(duplicate_send.status_code, 409)
        ret.refresh_from_db()
        self.assertEqual(ret.payments.count(), 0)
        listed = self.client.get('/api/retainer-invoices/').json()['results']
        self.assertIn(
            str(ret_id),
            {str(row['id']) for row in listed if str(row.get('raw_status', row.get('status', '')).lower()) == 'sent'},
        )

        # 2. Record Payment: 100,000 received into bank
        initial_bank_bal = self.bank_hdfc.current_balance
        pay_payload = {
            'amount': '100000.00',
            'date': str(date.today()),
            'bank_account': self.bank_hdfc.name,
            'payment_mode': 'bank_transfer',
            'reference': 'NEFT-RET-12345',
            'notes': 'Received full advance'
        }
        res_pay = self.client.post(f'/api/retainer-invoices/{ret_id}/pay/', data=json.dumps(pay_payload), content_type='application/json')
        self.assertEqual(res_pay.status_code, 200)
        ret.refresh_from_db()
        self.assertEqual(ret.status, 'paid')
        self.assertEqual(ret.paid_amount, Decimal('100000.00'))
        self.assertEqual(ret.available_balance, Decimal('100000.00'))

        # Check Bank balance increased
        self.bank_hdfc.refresh_from_db()
        self.assertEqual(self.bank_hdfc.current_balance, initial_bank_bal + Decimal('100000.00'))

        # Check Advance Liability Journal posted (Debit 1010 Bank, Credit 2100 Customer Advance)
        gl_adv = Account.objects.filter(organization=self.org, code='2100').first()
        self.assertIsNotNone(gl_adv)
        last_journal = Journal.objects.filter(organization=self.org, reference__icontains=ret.retainer_number).order_by('-id').first()
        self.assertIsNotNone(last_journal)
        credit_line = last_journal.items.filter(account=gl_adv).first()
        self.assertIsNotNone(credit_line)
        self.assertEqual(credit_line.credit, Decimal('100000.00'))

        # 3. Create Final Sales Invoice of 100,000
        inv_payload = {
            'customer': self.customer.id,
            'date': str(date.today()),
            'due_date': str(date.today() + timedelta(days=30)),
            'lines': [
                {
                    'item': self.item.id,
                    'description': 'Completed Software Development Project',
                    'quantity': 1,
                    'rate': '100000.00',
                    'gst_rate': '0.00'
                }
            ]
        }
        res_inv = self.client.post('/api/invoices/', data=json.dumps(inv_payload), content_type='application/json')
        self.assertEqual(res_inv.status_code, 201)
        inv_id = res_inv.json()['id']
        inv = Invoice.objects.get(pk=inv_id)

        # Send/approve invoice
        res_send_inv = self.client.post(f'/api/invoices/{inv_id}/send/', data=json.dumps({}), content_type='application/json')
        self.assertEqual(res_send_inv.status_code, 200)
        inv.refresh_from_db()
        self.assertEqual(inv.balance_due, Decimal('100000.00'))

        # 4. Apply 30,000 retainer credit to final invoice
        apply_payload = {
            'allocations': [
                {
                    'retainer_id': ret.id,
                    'amount': '30000.00',
                    'notes': 'Partial retainer application'
                }
            ],
            'date': str(date.today())
        }
        res_apply = self.client.post(f'/api/invoices/{inv_id}/apply-retainer/', data=json.dumps(apply_payload), content_type='application/json')
        self.assertEqual(res_apply.status_code, 200)

        # Verify Invoice balance reduced to 70,000
        inv.refresh_from_db()
        self.assertEqual(inv.balance_due, Decimal('70000.00'))

        # Verify Retainer is now partially applied with 70,000 remaining
        ret.refresh_from_db()
        self.assertEqual(ret.applied_amount, Decimal('30000.00'))
        self.assertEqual(ret.available_balance, Decimal('70000.00'))
        res_ret = self.client.get(f'/api/retainer-invoices/{ret.id}/')
        self.assertEqual(res_ret.json()['status'], 'Partially Applied')

        # Apply the remaining 70,000 to clear the invoice
        apply_payload_2 = {
            'allocations': [
                {
                    'retainer_id': ret.id,
                    'amount': '70000.00',
                    'notes': 'Clear remaining invoice balance'
                }
            ],
            'date': str(date.today())
        }
        res_apply_2 = self.client.post(f'/api/invoices/{inv_id}/apply-retainer/', data=json.dumps(apply_payload_2), content_type='application/json')
        self.assertEqual(res_apply_2.status_code, 200)

        # Verify Invoice is fully paid
        inv.refresh_from_db()
        self.assertEqual(inv.balance_due, Decimal('0.00'))
        self.assertEqual(inv.status, 'paid')

        # Verify Retainer is fully applied
        ret.refresh_from_db()
        self.assertEqual(ret.applied_amount, Decimal('100000.00'))
        self.assertEqual(ret.available_balance, Decimal('0.00'))
        res_ret_2 = self.client.get(f'/api/retainer-invoices/{ret.id}/')
        self.assertEqual(res_ret_2.json()['status'], 'Fully Applied')

        # Attempting to apply more must fail with 400
        res_fail = self.client.post(f'/api/invoices/{inv_id}/apply-retainer/', data=json.dumps(apply_payload_2), content_type='application/json')
        self.assertEqual(res_fail.status_code, 400)

    def test_retainer_refund_and_void(self):
        """
        Retainer refund:
        - Record 50,000 payment
        - Refund 20,000
        - Bank balance reduced by 20,000
        - Available balance reduced to 30,000
        - Customer advance liability debited
        """
        ret = RetainerInvoice.objects.create(
            organization=self.org,
            customer=self.customer,
            number='RET-REFUND-01',
            date=date.today(),
            due_date=date.today(),
            place_of_supply=self.customer.state,
            total=Decimal('50000.00'),
            status='sent'
        )

        initial_bank_bal = self.bank_hdfc.current_balance
        # Record payment
        pay_payload = {
            'amount': '50000.00',
            'date': str(date.today()),
            'bank_account': self.bank_hdfc.name,
            'payment_mode': 'bank_transfer'
        }
        self.client.post(f'/api/retainer-invoices/{ret.id}/pay/', data=json.dumps(pay_payload), content_type='application/json')
        ret.refresh_from_db()
        self.assertEqual(ret.available_balance, Decimal('50000.00'))

        # Refund 20,000
        refund_payload = {
            'amount': '20000.00',
            'date': str(date.today()),
            'bank_account': self.bank_hdfc.name,
            'payment_mode': 'bank_transfer',
            'reference': 'REFUND-001',
            'notes': 'Partial customer refund'
        }
        res_ref = self.client.post(f'/api/retainer-invoices/{ret.id}/refund/', data=json.dumps(refund_payload), content_type='application/json')
        self.assertEqual(res_ref.status_code, 200)

        # Check retainer available balance reduced
        ret.refresh_from_db()
        self.assertEqual(ret.available_balance, Decimal('30000.00'))

        # Check bank balance reduced by 20,000
        self.bank_hdfc.refresh_from_db()
        self.assertEqual(self.bank_hdfc.current_balance, initial_bank_bal + Decimal('30000.00'))

        # Over-refund must fail
        over_refund = {
            'amount': '35000.00',
            'bank_account': self.bank_hdfc.name
        }
        res_over = self.client.post(f'/api/retainer-invoices/{ret.id}/refund/', data=json.dumps(over_refund), content_type='application/json')
        self.assertEqual(res_over.status_code, 400)

    def test_recurring_invoice_lifecycle(self):
        """
        Recurring Invoice:
        1. Create recurring profile (monthly, repeat every 1)
        2. Generate invoice now
        3. Check generated invoice attributes and link
        4. Check next generation date advanced
        5. Pause schedule -> Resume schedule -> Cancel schedule
        """
        start_d = date.today()
        rec_payload = {
            'customer': self.customer.id,
            'profile_name': 'Monthly Cloud Hosting Plan',
            'frequency': 'monthly',
            'repeat_every': 1,
            'start_date': str(start_d),
            'next_date': str(start_d),
            'payment_terms': 15,
            'auto_send': False,
            'lines': [
                {
                    'item': self.item.id,
                    'description': 'Managed Server Subscription',
                    'quantity': 2,
                    'rate': '5000.00',
                    'discount_percent': '10.00',
                    'gst_rate': '18.00'
                }
            ]
        }
        res = self.client.post('/api/recurring-invoices/', data=json.dumps(rec_payload), content_type='application/json')
        self.assertEqual(res.status_code, 201)
        rec_id = res.json()['id']
        rec = RecurringInvoice.objects.get(pk=rec_id)
        self.assertEqual(rec.frequency, 'monthly')
        self.assertEqual(rec.status, 'active')

        # Check Detail endpoint
        res_det = self.client.get(f'/api/recurring-invoices/{rec_id}/')
        self.assertEqual(res_det.status_code, 200)
        data = res_det.json()
        self.assertEqual(data['name'], 'Monthly Cloud Hosting Plan')
        self.assertEqual(len(data['upcoming_dates']), 3)

        # Generate invoice now
        res_gen = self.client.post(f'/api/recurring-invoices/{rec_id}/generate-invoice/', data=json.dumps({}), content_type='application/json')
        self.assertEqual(res_gen.status_code, 200)
        gen_data = res_gen.json()
        self.assertTrue(gen_data['success'])
        inv_id = gen_data['invoice_id']

        # Verify generated Invoice
        inv = Invoice.objects.get(pk=inv_id)
        self.assertEqual(inv.customer, self.customer)
        self.assertEqual(inv.order_number, f"REC-{rec.pk}")
        self.assertEqual(inv.lines.count(), 1)
        ln = inv.lines.first()
        self.assertEqual(ln.quantity, 2)
        self.assertEqual(ln.rate, Decimal('5000.00'))

        # Check next_date advanced by 1 month
        rec.refresh_from_db()
        expected_next = advance_recurring_date(start_d, 'monthly', 1)
        self.assertEqual(rec.next_date, expected_next)

        # Pause Schedule
        res_pause = self.client.post(f'/api/recurring-invoices/{rec_id}/pause/', data=json.dumps({}), content_type='application/json')
        self.assertEqual(res_pause.status_code, 200)
        rec.refresh_from_db()
        self.assertEqual(rec.status, 'paused')

        # Resume Schedule
        res_resume = self.client.post(f'/api/recurring-invoices/{rec_id}/resume/', data=json.dumps({}), content_type='application/json')
        self.assertEqual(res_resume.status_code, 200)
        rec.refresh_from_db()
        self.assertEqual(rec.status, 'active')

        # Edit recurring profile
        edit_payload = {
            'profile_name': 'Monthly Cloud Hosting Plan Pro',
            'customer': self.customer.id,
            'frequency': 'monthly',
            'repeat_every': 2,
            'start_date': str(start_d),
            'next_date': str(rec.next_date),
            'total': '12000.00'
        }
        res_edit = self.client.put(f'/api/recurring-invoices/{rec_id}/', data=json.dumps(edit_payload), content_type='application/json')
        self.assertEqual(res_edit.status_code, 200)
        rec.refresh_from_db()
        self.assertEqual(rec.profile_name, 'Monthly Cloud Hosting Plan Pro')

        # Search and Pagination
        res_list = self.client.get('/api/recurring-invoices/?q=Hosting&page=1&page_size=10')
        self.assertEqual(res_list.status_code, 200)
        list_data = res_list.json()
        self.assertGreaterEqual(list_data['count'], 1)
        self.assertTrue(any(item['id'] == rec.id for item in list_data['results']))

        # CSV Export
        res_export = self.client.get('/api/recurring-invoices/?export=csv')
        self.assertEqual(res_export.status_code, 200)

        # Cancel Schedule
        res_cancel = self.client.post(f'/api/recurring-invoices/{rec_id}/cancel/', data=json.dumps({}), content_type='application/json')
        self.assertEqual(res_cancel.status_code, 200)
        rec.refresh_from_db()
        self.assertEqual(rec.status, 'cancelled')

        # Delete Profile
        res_del = self.client.delete(f'/api/recurring-invoices/{rec_id}/')
        self.assertEqual(res_del.status_code, 204)
        self.assertFalse(RecurringInvoice.objects.filter(pk=rec_id).exists())

    def test_recurring_invoices_management_command(self):
        """
        Test python manage.py generate_recurring_invoices
        """
        from django.core.management import call_command
        rec = RecurringInvoice.objects.create(
            organization=self.org,
            customer=self.customer,
            profile_name='Daily Maintenance Job',
            frequency='daily',
            start_date=date.today(),
            next_date=date.today(),
            status='active',
            lines_data={
                'repeat_every': 1,
                'lines': [{'description': 'Daily Health Check', 'quantity': 1, 'rate': 250, 'gst_rate': 0}]
            }
        )

        # Run command with --dry-run
        call_command('generate_recurring_invoices', dry_run=True)
        rec.refresh_from_db()
        self.assertEqual(rec.next_date, date.today())  # Dry run doesn't advance

        # Run actual command
        call_command('generate_recurring_invoices', org_id=self.org.id)
        rec.refresh_from_db()
        self.assertEqual(rec.next_date, date.today() + timedelta(days=1))

        # Check that invoice was created
        gen_inv = Invoice.objects.filter(customer=self.customer, order_number=f"REC-{rec.pk}").first()
        self.assertIsNotNone(gen_inv)
        self.assertEqual(gen_inv.lines.first().description, 'Daily Health Check')

    def test_recurring_invoice_end_date_persists_and_validates(self):
        start = date.today()
        end = start + timedelta(days=30)
        created = self.client.post(
            '/api/recurring-invoices/',
            data=json.dumps({
                'customer': self.customer.pk,
                'profile_name': 'Dated Recurring Profile',
                'frequency': 'monthly',
                'start_date': str(start),
                'next_date': str(start),
                'end_date': str(end),
                'never_ends': False,
                'lines': [{'description': 'Monthly service', 'quantity': 1, 'rate': '100.00'}],
            }),
            content_type='application/json',
        )
        self.assertEqual(created.status_code, 201, created.content)
        recurring_id = created.json()['id']

        recurring = RecurringInvoice.objects.get(pk=recurring_id)
        self.assertEqual(recurring.end_date, end)
        self.assertFalse(recurring.never_ends)
        detail = self.client.get(f'/api/recurring-invoices/{recurring_id}/')
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(detail.json()['end_date'], str(end))

        updated_end = start + timedelta(days=60)
        updated = self.client.put(
            f'/api/recurring-invoices/{recurring_id}/',
            data=json.dumps({'end_date': str(updated_end), 'never_ends': False}),
            content_type='application/json',
        )
        self.assertEqual(updated.status_code, 200, updated.content)
        recurring.refresh_from_db()
        self.assertEqual(recurring.end_date, updated_end)

        invalid = self.client.put(
            f'/api/recurring-invoices/{recurring_id}/',
            data=json.dumps({'end_date': str(start - timedelta(days=1)), 'never_ends': False}),
            content_type='application/json',
        )
        self.assertEqual(invalid.status_code, 400)
        recurring.refresh_from_db()
        self.assertEqual(recurring.end_date, updated_end)

        no_expiry = self.client.put(
            f'/api/recurring-invoices/{recurring_id}/',
            data=json.dumps({'never_ends': True}),
            content_type='application/json',
        )
        self.assertEqual(no_expiry.status_code, 200, no_expiry.content)
        recurring.refresh_from_db()
        self.assertIsNone(recurring.end_date)
        self.assertTrue(recurring.never_ends)


class TestInvoiceActionsAndPrinting(BaseAccountingTestCase):
    """
    Test all invoice actions:
    - Edit, Send (Email, SMS), Share (Secure Link)
    - Reminders (Send, Stop, Expected Payment Date)
    - Write-off with double-entry Bad Debts ledger
    - Clone Document
    - Create Credit Note & Debit Note from invoice
    - View Journal entries
    - Add e-Way Bill
    """
    def setUp(self):
        super().setUp()
        self.client.force_login(self.admin_user)
        self.inv = Invoice.objects.create(
            organization=self.org,
            customer=self.customer,
            number='INV-ACT-001',
            date=date.today(),
            due_date=date.today() + timedelta(days=15),
            place_of_supply=self.customer.state,
            subtotal=Decimal('10000.00'),
            total=Decimal('11800.00'),
            status='sent'
        )
        InvoiceLine.objects.create(
            invoice=self.inv,
            item=self.item,
            description='Web Consulting Services',
            quantity=Decimal('1.000'),
            rate=Decimal('10000.00'),
            taxable=Decimal('10000.00'),
            gst_rate=Decimal('18.00'),
            tax_amount=Decimal('1800.00'),
            line_total=Decimal('11800.00')
        )

    @override_settings(
        PASSWORD_RESET_EMAIL_CONFIGURED=True,
        DEFAULT_FROM_EMAIL='billing@example.com',
        EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend'
    )
    def test_invoice_email_and_sms(self):
        res = self.client.post(
            f'/api/invoices/{self.inv.id}/email/',
            data=json.dumps({
                'to_email': 'client@example.com',
                'cc': 'audit@example.com',
                'subject': 'Your Invoice INV-ACT-001',
                'message': 'Please review your invoice.'
            }),
            content_type='application/json'
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()['status'], 'ok')
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ['client@example.com'])
        self.assertEqual(mail.outbox[0].cc, ['audit@example.com'])
        self.assertIn('Invoice INV-ACT-001', mail.outbox[0].body)
        self.assertEqual(self.customer.email, '')

        res_sms = self.client.post(
            f'/api/invoices/{self.inv.id}/sms/',
            data=json.dumps({
                'to_phone': '+919876543210',
                'message': 'Invoice INV-ACT-001 for Rs 11,800 is ready.'
            }),
            content_type='application/json'
        )
        self.assertEqual(res_sms.status_code, 503)
        self.assertIn('SMS gateway', res_sms.json()['error'])

    @override_settings(PASSWORD_RESET_EMAIL_CONFIGURED=False)
    def test_invoice_email_fails_explicitly_without_smtp(self):
        res = self.client.post(
            f'/api/invoices/{self.inv.id}/email/',
            data=json.dumps({
                'to_email': 'client@example.com',
                'subject': 'Your Invoice INV-ACT-001',
                'message': 'Please review your invoice.'
            }),
            content_type='application/json'
        )
        self.assertEqual(res.status_code, 503)
        self.assertIn('SMTP is not configured', res.json()['error'])
        self.assertEqual(self.customer.email, '')
        self.assertFalse(AuditLog.objects.filter(action='send_email', entity_id=str(self.inv.pk)).exists())

    def test_invoice_share_link(self):
        res = self.client.post(f'/api/invoices/{self.inv.id}/share/', data=json.dumps({}), content_type='application/json')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data['status'], 'ok')
        self.assertIn('share_url', data)

    @override_settings(
        PASSWORD_RESET_EMAIL_CONFIGURED=True,
        DEFAULT_FROM_EMAIL='billing@example.com',
        EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend'
    )
    def test_invoice_reminders_and_expected_date(self):
        self.customer.email = 'client@example.com'
        self.customer.save(update_fields=['email'])
        res_remind = self.client.post(f'/api/invoices/{self.inv.id}/remind/', data=json.dumps({}), content_type='application/json')
        self.assertEqual(res_remind.status_code, 200)
        self.assertEqual(res_remind.json()['status'], 'ok')
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('outstanding balance', mail.outbox[0].body)

        res_stop = self.client.post(f'/api/invoices/{self.inv.id}/stop-reminders/', data=json.dumps({}), content_type='application/json')
        self.assertEqual(res_stop.status_code, 503)
        self.assertIn('no reminder scheduler', res_stop.json()['error'])

        exp_date = (date.today() + timedelta(days=5)).isoformat()
        res_exp = self.client.post(
            f'/api/invoices/{self.inv.id}/expected-payment-date/',
            data=json.dumps({'expected_payment_date': exp_date, 'notes': 'Cheque promised by next Monday'}),
            content_type='application/json'
        )
        self.assertEqual(res_exp.status_code, 200)
        self.assertEqual(res_exp.json()['status'], 'ok')
        self.assertEqual(res_exp.json()['expected_date'], exp_date)

    def test_invoice_write_off(self):
        # Write off outstanding invoice
        res = self.client.post(
            f'/api/invoices/{self.inv.id}/write-off/',
            data=json.dumps({'reason': 'uncollectible', 'notes': 'Customer insolvent'}),
            content_type='application/json'
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data['status'], 'ok')
        self.assertEqual(data['write_off_amount'], '11800.00')

        self.inv.refresh_from_db()
        self.assertEqual(self.inv.balance_due, Decimal('0.00'))
        self.assertEqual(self.inv.status, 'paid')

        # Verify journal entry was posted
        from books.models import Journal, JournalItem
        jnl = Journal.objects.filter(reference=self.inv.number, entry_type='invoice_write_off').first()
        self.assertIsNotNone(jnl)
        bad_debt_line = jnl.items.filter(debit=Decimal('11800.00')).first()
        self.assertIsNotNone(bad_debt_line)
        self.assertIn('5050', bad_debt_line.account.code)

        # Attempting to write off again fails
        res_again = self.client.post(
            f'/api/invoices/{self.inv.id}/write-off/',
            data=json.dumps({'reason': 'uncollectible'}),
            content_type='application/json'
        )
        self.assertEqual(res_again.status_code, 400)

    def test_clone_document(self):
        res = self.client.post(f'/api/invoices/{self.inv.id}/clone/', data=json.dumps({}), content_type='application/json')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data['status'], 'ok')
        cloned_id = data['id']

        cloned = Invoice.objects.get(pk=cloned_id)
        self.assertEqual(cloned.status, 'draft')
        self.assertNotEqual(cloned.number, self.inv.number)
        self.assertEqual(cloned.lines.count(), 1)
        self.assertEqual(cloned.lines.first().description, 'Web Consulting Services')

    def test_create_credit_and_debit_note_from_invoice(self):
        # Credit Note
        res_cn = self.client.post(f'/api/invoices/{self.inv.id}/create-credit-note/', data=json.dumps({}), content_type='application/json')
        self.assertEqual(res_cn.status_code, 200)
        data_cn = res_cn.json()
        self.assertEqual(data_cn['status'], 'ok')
        cn_id = data_cn['credit_note_id']
        from books.models import CreditNote
        cn = CreditNote.objects.get(pk=cn_id)
        self.assertEqual(cn.customer, self.inv.customer)
        self.assertEqual(cn.status, 'draft')

        # Debit Note
        res_dn = self.client.post(f'/api/invoices/{self.inv.id}/create-debit-note/', data=json.dumps({}), content_type='application/json')
        self.assertEqual(res_dn.status_code, 200)
        data_dn = res_dn.json()
        self.assertEqual(data_dn['status'], 'ok')

    def test_view_journal_and_eway_bill(self):
        # View Journal
        res_jnl = self.client.get(f'/api/invoices/{self.inv.id}/view-journal/')
        self.assertEqual(res_jnl.status_code, 200)
        self.assertIn('journals', res_jnl.json())

        # e-Way Bill
        res_ewb = self.client.post(
            f'/api/invoices/{self.inv.id}/eway-bill/',
            data=json.dumps({
                'bill_number': '123456789012',
                'distance_km': 150,
                'vehicle_number': 'KL-07-CD-5678',
                'transporter_name': 'Express Cargo'
            }),
            content_type='application/json'
        )
        self.assertEqual(res_ewb.status_code, 200)
        data_ewb = res_ewb.json()
        self.assertEqual(data_ewb['status'], 'ok')
        self.assertEqual(data_ewb['bill_number'], '123456789012')


class TestBooksSubscriptionAndBilling(TestCase):
    def setUp(self):
        from books import services
        self.org = Organization.objects.first() or Organization.objects.create(name='Convosis Org Test')
        self.admin_user = User.objects.create_user(username='subadmin', email='subadmin@convosis.com', password='password123')
        self.profile = UserProfile.objects.create(user=self.admin_user, organization=self.org, role=UserProfile.ADMIN)
        services.get_tenant_subscription_summary(org=self.org)
        self.client.force_login(self.admin_user)

    def test_subscription_summary_and_plan_structure(self):
        res = self.client.get('/api/subscription/summary/')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn('plans', data)
        self.assertIn('free', data['plans'])
        self.assertIn('professional', data['plans'])
        self.assertIn('premium', data['plans'])

        # Verify Free plan pricing & limits
        free_plan = data['plans']['free']
        self.assertEqual(free_plan['price_annual'], 0)
        self.assertEqual(free_plan['monthly_equiv'], 0)
        self.assertEqual(free_plan['books_users'], 1)
        self.assertEqual(free_plan['record_limit'], 100)

        # Verify Professional plan pricing & limits
        pro_plan = data['plans']['professional']
        self.assertEqual(pro_plan['price_annual'], 5000)
        self.assertEqual(pro_plan['monthly_equiv'], 417)
        self.assertEqual(pro_plan['books_users'], 2)
        self.assertEqual(pro_plan['record_limit'], 500000)
        self.assertTrue(pro_plan['popular'])

        # Verify Premium plan pricing & limits
        prem_plan = data['plans']['premium']
        self.assertEqual(prem_plan['price_annual'], 20000)
        self.assertEqual(prem_plan['monthly_equiv'], 1667)
        self.assertEqual(prem_plan['books_users'], 5)
        self.assertEqual(prem_plan['record_limit'], 5000000)

        # Verify Comparison matrix has 11 features and no CRM features
        self.assertEqual(len(data['comparison_features']), 11)
        feature_names = [f['feature'] for f in data['comparison_features']]
        self.assertIn('Contact management', feature_names)
        self.assertIn('Quotes & invoices', feature_names)
        self.assertIn('GST filing', feature_names)
        self.assertIn('Inventory management', feature_names)
        self.assertIn('Multi-currency', feature_names)
        self.assertIn('Approvals', feature_names)
        self.assertIn('Budgeting', feature_names)
        self.assertIn('Vendor portal', feature_names)
        self.assertIn('Custom functions', feature_names)
        self.assertIn('Warehouse management', feature_names)
        self.assertIn('Serial & batch tracking', feature_names)

        # Verify Add-ons
        self.assertEqual(len(data['feature_addons']), 8)
        user_addon_ids = [u['id'] for u in data['user_addons']]
        self.assertIn('books_user', user_addon_ids)
        self.assertNotIn('crm_user', user_addon_ids)

    def test_paid_plan_change_requires_verified_payment(self):
        from books.models import SubscriptionInvoice, TenantSubscription

        sub = TenantSubscription.objects.get(organization=self.org)
        res = self.client.post(
            '/api/subscription/update/',
            data=json.dumps({'tier': 'professional', 'billing_cycle': 'annual'}),
            content_type='application/json'
        )
        self.assertEqual(res.status_code, 503)
        self.assertIn('payment provider', res.json()['error'])
        sub.refresh_from_db()
        self.assertEqual(sub.tier, 'free')
        self.assertEqual(sub.record_limit, 100)
        self.assertFalse(SubscriptionInvoice.objects.filter(organization=self.org).exists())

    def test_free_plan_change_does_not_create_payment_history(self):
        from books.models import SubscriptionInvoice, TenantSubscription

        res = self.client.post(
            '/api/subscription/update/',
            data=json.dumps({'tier': 'free', 'billing_cycle': 'annual'}),
            content_type='application/json'
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()['tier'], 'free')
        self.assertFalse(SubscriptionInvoice.objects.filter(organization=self.org).exists())
        self.assertEqual(TenantSubscription.objects.get(organization=self.org).payment_method, '')

    def test_invalid_plan_and_billing_cycle_are_rejected(self):
        for payload in (
            {'tier': 'not-a-plan', 'billing_cycle': 'annual'},
            {'tier': 'free', 'billing_cycle': 'monthly'}
        ):
            res = self.client.post(
                '/api/subscription/update/',
                data=json.dumps(payload),
                content_type='application/json'
            )
            self.assertEqual(res.status_code, 400)

    def test_free_trial_activation(self):
        res = self.client.post(
            '/api/subscription/trial/',
            data=json.dumps({'tier': 'professional'}),
            content_type='application/json'
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data['is_trial'])
        self.assertEqual(data['status'], 'Trial')
        self.assertGreaterEqual(data['trial_days_remaining'], 44)
        repeated = self.client.post(
            '/api/subscription/trial/',
            data=json.dumps({'tier': 'professional'}),
            content_type='application/json'
        )
        self.assertEqual(repeated.status_code, 400)

    def test_addon_purchases_require_verified_payment(self):
        from books.models import SubscriptionInvoice, TenantSubscription

        sub = TenantSubscription.objects.get(organization=self.org)
        res_usr = self.client.post(
            '/api/subscription/addon/',
            data=json.dumps({'addon_key': 'books_user', 'quantity': 2}),
            content_type='application/json'
        )
        self.assertEqual(res_usr.status_code, 503)
        self.assertIn('payment provider', res_usr.json()['error'])

        res_feat = self.client.post(
            '/api/subscription/addon/',
            data=json.dumps({'addon_key': 'custom_reports'}),
            content_type='application/json'
        )
        self.assertEqual(res_feat.status_code, 503)

        res_cs = self.client.post(
            '/api/subscription/addon/',
            data=json.dumps({'addon_key': 'hrms_user'}),
            content_type='application/json'
        )
        self.assertEqual(res_cs.status_code, 400)
        self.assertIn('Coming Soon', res_cs.json()['error'])
        sub.refresh_from_db()
        self.assertEqual(sub.purchased_books_users, 0)
        self.assertEqual(sub.purchased_addons, {})
        self.assertFalse(SubscriptionInvoice.objects.filter(organization=self.org).exists())

    def test_subscription_summary_does_not_create_fake_paid_invoice(self):
        from books.models import SubscriptionInvoice

        self.assertFalse(SubscriptionInvoice.objects.filter(organization=self.org).exists())
        res = self.client.get('/api/subscription/summary/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()['invoices_history'], [])

    def test_subscription_receipt_does_not_label_pending_amount_as_paid(self):
        from books.models import SubscriptionInvoice

        inv = SubscriptionInvoice.objects.create(
            organization=self.org,
            invoice_no='INV-SUB-PENDING',
            description='Professional Plan',
            amount=Decimal('5000.00'),
            status='Pending'
        )
        res = self.client.get(f'/api/subscription/invoices/{inv.id}/receipt/')
        self.assertEqual(res.status_code, 200)
        receipt = res.content.decode('utf-8')
        self.assertIn('Amount:', receipt)
        self.assertNotIn('Total Paid:', receipt)
        self.assertIn('Payment Method : Not verified', receipt)

    def test_auto_renew_requires_payment_provider_and_explicit_value(self):
        from books.models import TenantSubscription

        sub = TenantSubscription.objects.get(organization=self.org)
        sub.auto_renew = False
        sub.save(update_fields=['auto_renew'])
        for payload, expected_status in (({'auto_renew': True}, 503), ({}, 400)):
            res = self.client.post(
                '/api/subscription/autorenew/',
                data=json.dumps(payload),
                content_type='application/json'
            )
            self.assertEqual(res.status_code, expected_status)
        sub.refresh_from_db()
        self.assertFalse(sub.auto_renew)

    def test_legacy_paid_subscription_invoice_is_not_treated_as_verified(self):
        from books.models import SubscriptionInvoice

        inv = SubscriptionInvoice.objects.create(
            organization=self.org,
            invoice_no='INV-SUB-LEGACY',
            description='Legacy plan record',
            amount=Decimal('5000.00'),
            status='Paid',
            payment_method='Visa ending in 4242'
        )
        summary = self.client.get('/api/subscription/summary/').json()
        history = next(item for item in summary['invoices_history'] if item['id'] == inv.id)
        self.assertEqual(history['status'], 'Unverified (no provider reference)')
        self.assertEqual(history['payment_method'], '')

        receipt = self.client.get(f'/api/subscription/invoices/{inv.id}/receipt/').content.decode('utf-8')
        self.assertIn('Status         : Unverified (no provider reference)', receipt)
        self.assertIn('Amount:', receipt)
        self.assertNotIn('Total Paid:', receipt)

    def test_record_and_user_limit_enforcement(self):
        from books.models import TenantSubscription, Customer
        sub = TenantSubscription.objects.get(organization=self.org)
        sub.record_limit = 0  # Force record limit to 0
        sub.save()

        cust = Customer.objects.create(organization=self.org, name='Limit Cust', email='limit@cust.com')

        # Try creating invoice via DocResource
        res_inv = self.client.post(
            '/api/invoices/',
            data=json.dumps({
                'customer': cust.id,
                'date': '2026-11-08',
                'lines': [{
                    'description': 'Consulting services',
                    'quantity': 1,
                    'rate': 1000,
                    'taxable': 1000,
                    'tax_amount': 180,
                    'line_total': 1180,
                    'gst_rate': 18
                }]
            }),
            content_type='application/json'
        )
        self.assertEqual(res_inv.status_code, 403)
        self.assertIn('record limit', res_inv.json()['error'].lower())

        # Test user limit enforcement
        sub.record_limit = 1000
        sub.user_seat_limit = 1  # Admin user is already 1 user
        sub.purchased_books_users = 0
        sub.save()

        res_invite = self.client.post(
            '/api/settings/users/invite/',
            data=json.dumps({'email': 'newguy@example.com', 'name': 'New Guy'}),
            content_type='application/json'
        )
        self.assertEqual(res_invite.status_code, 403)
        self.assertIn('user seat limit', res_invite.json()['error'].lower())

    def test_organization_subscription_isolation(self):
        from books.models import TenantSubscription
        org2 = Organization.objects.create(name='Second Org Ltd')
        sub2 = TenantSubscription.objects.create(
            organization=org2,
            tier=TenantSubscription.PREMIUM,
            record_limit=5000000,
            user_seat_limit=5,
            storage_limit_mb=51200
        )

        user2 = User.objects.create_user(username='org2admin', email='admin@org2.com', password='password123')
        UserProfile.objects.create(user=user2, organization=org2, role=UserProfile.ADMIN)

        client2 = self.client_class()
        client2.force_login(user2)

        res2 = client2.get('/api/subscription/summary/')
        self.assertEqual(res2.status_code, 200)
        self.assertEqual(res2.json()['tier'], 'premium')
        self.assertEqual(res2.json()['usage']['records']['limit'], 5000000)

        # Ensure Org 1 was not affected
        res1 = self.client.get('/api/subscription/summary/')
        self.assertEqual(res1.status_code, 200)
        self.assertNotEqual(res1.json()['usage']['records']['limit'], 5000000)


class TestConfiguredDocumentNumberSeries(BaseAccountingTestCase):
    def setUp(self):
        super().setUp()
        self.admin_user.is_superuser = False
        self.admin_user.save(update_fields=['is_superuser'])
        self.client.force_login(self.admin_user)

    def test_retainer_series_selects_by_customer_type_and_business_location(self):
        north = BusinessLocation.objects.create(
            organization=self.org, name='North Office', gstin=self.org.gstin
        )
        south = BusinessLocation.objects.create(
            organization=self.org, name='South Office', gstin='27AABCU9603R1ZM'
        )
        self.client.force_login(self.admin_user)

        payloads = [
            ('North B2B', 'b2b', north, 'CONVO/NORTH/RET/%FY%'),
            ('North B2C', 'b2c', north, 'CONVO/NORTH-B2C/RET/%FY%'),
            ('South B2B', 'b2b', south, 'CONVO/SOUTH/RET/%FY%'),
        ]
        created = {}
        for name, customer_type, location, prefix in payloads:
            response = self.client.post(
                '/api/settings/retainer-number-series/',
                data=json.dumps({
                    'name': name,
                    'customer_type': customer_type,
                    'business_location_id': location.pk,
                    'gstin': location.gstin,
                    'prefix': prefix,
                    'starting_number': 1,
                    'next_number': 1,
                    'padding': 5,
                    'reset_annually': True,
                    'active': True,
                }),
                content_type='application/json',
            )
            self.assertEqual(response.status_code, 201, response.content)
            created[name] = response.json()['series']

        duplicate = self.client.post(
            '/api/settings/retainer-number-series/',
            data=json.dumps({
                'name': 'Duplicate North B2B',
                'customer_type': 'b2b',
                'business_location_id': north.pk,
                'gstin': north.gstin,
                'prefix': 'CONVO/DUP/RET/%FY%',
            }),
            content_type='application/json',
        )
        self.assertEqual(duplicate.status_code, 409)

        b2c_customer = Customer.objects.create(
            organization=self.org, name='Individual Retainer Customer',
            customer_type='individual', state='Kerala',
        )
        invoice_payload = {
            'date': '2026-10-15',
            'due_date': '2026-11-15',
            'lines': [{'description': 'Advance', 'amount': '100.00'}],
        }
        documents = []
        for customer, location in (
            (self.customer, north),
            (b2c_customer, north),
            (self.customer, south),
        ):
            payload = dict(invoice_payload, customer=customer.pk, business_location_id=location.pk)
            response = self.client.post(
                '/api/retainer-invoices/',
                data=json.dumps(payload),
                content_type='application/json',
            )
            self.assertEqual(response.status_code, 201, response.content)
            documents.append(response.json())

        self.assertTrue(documents[0]['number'].startswith('CONVO/NORTH/RET/26-27/'))
        self.assertTrue(documents[1]['number'].startswith('CONVO/NORTH-B2C/RET/26-27/'))
        self.assertTrue(documents[2]['number'].startswith('CONVO/SOUTH/RET/26-27/'))

        north_b2b = created['North B2B']
        north_b2b.update(next_number=20)
        updated = self.client.put(
            f"/api/settings/retainer-number-series/{north_b2b['id']}/",
            data=json.dumps(north_b2b),
            content_type='application/json',
        )
        self.assertEqual(updated.status_code, 200, updated.content)
        next_invoice = self.client.post(
            '/api/retainer-invoices/',
            data=json.dumps(dict(invoice_payload, customer=self.customer.pk, business_location_id=north.pk)),
            content_type='application/json',
        )
        self.assertEqual(next_invoice.status_code, 201, next_invoice.content)
        self.assertTrue(next_invoice.json()['number'].endswith('/00020'))
        self.assertEqual(RetainerInvoice.objects.get(pk=documents[0]['id']).number, documents[0]['number'])

        deactivated = self.client.delete(f"/api/settings/retainer-number-series/{north_b2b['id']}/")
        self.assertEqual(deactivated.status_code, 200)
        self.assertFalse(DocumentNumberSeries.objects.get(pk=north_b2b['id']).active)
        self.assertTrue(DocumentNumberAllocation.objects.filter(number=documents[0]['number']).exists())

    def test_annual_retainer_series_resets_without_rewriting_configuration(self):
        location = BusinessLocation.objects.create(
            organization=self.org, name='Annual Office', gstin=self.org.gstin
        )
        series = DocumentNumberSeries.objects.create(
            organization=self.org,
            name='Annual Retainer',
            document_type='retainer_invoices',
            customer_type='b2b',
            location=location.name,
            business_location=location,
            gstin=location.gstin,
            prefix='CONVO/RET/%FY%',
            starting_number=3,
            next_number=3,
            padding=5,
            reset_annually=True,
        )

        first = services.next_document_number(
            'RET', org=self.org, date=date(2026, 10, 15),
            customer_type='b2b', location=location.name,
            gstin=location.gstin, business_location_id=location.pk,
            user=self.admin_user,
        )
        second = services.next_document_number(
            'RET', org=self.org, date=date(2027, 5, 15),
            customer_type='b2b', location=location.name,
            gstin=location.gstin, business_location_id=location.pk,
            user=self.admin_user,
        )
        series.refresh_from_db()

        self.assertTrue(first.endswith('/00003'))
        self.assertIn('/26-27/', first)
        self.assertTrue(second.endswith('/00003'))
        self.assertIn('/27-28/', second)
        self.assertEqual(series.financial_year, '')
        self.assertEqual(series.counters.count(), 2)

    def test_preview_falls_back_until_required_series_context_is_available(self):
        from books.models import DocumentNumberSeries

        DocumentNumberSeries.objects.create(
            organization=self.org, name='Main Branch Invoice',
            document_type='invoices', branch='Main', prefix='MAIN-%FY%',
            separator='-', starting_number=12, next_number=12, padding=4
        )

        self.client.force_login(self.admin_user)
        context_free = self.client.get('/api/lookup/next-invoice-number/')
        self.assertEqual(context_free.status_code, 200)
        self.assertNotIn('MAIN-', context_free.json()['next_number'])

        contextual = self.client.get(
            '/api/lookup/next-invoice-number/?branch=Main&customer_type=b2b'
        )
        self.assertEqual(contextual.status_code, 200)
        self.assertTrue(contextual.json()['next_number'].startswith('MAIN-'))
        self.assertTrue(contextual.json()['next_number'].endswith('0012'))

    def test_series_selection_counters_and_allocation_audit(self):
        from books.models import DocumentNumberSeries

        b2b = DocumentNumberSeries.objects.create(
            organization=self.org, name='B2B Main', document_type='invoices',
            customer_type='b2b', branch='Main', prefix='INV-%FY%',
            separator='-', starting_number=7, next_number=7, padding=4
        )
        DocumentNumberSeries.objects.create(
            organization=self.org, name='B2C Main', document_type='invoices',
            customer_type='b2c', branch='Main', prefix='B2C-%FY%',
            separator='-', starting_number=1, next_number=1, padding=4
        )

        first = services.next_document_number(
            'INV', org=self.org, date=date(2026, 11, 12),
            customer_type='b2b', branch='Main', user=self.admin_user
        )
        second = services.next_document_number(
            'INV', org=self.org, date=date(2026, 11, 12),
            customer_type='b2b', branch='Main', user=self.admin_user
        )
        other_class = services.next_document_number(
            'INV', org=self.org, date=date(2026, 11, 12),
            customer_type='b2c', branch='Main', user=self.admin_user
        )

        self.assertEqual(first, 'INV-26-27-0007')
        self.assertEqual(second, 'INV-26-27-0008')
        self.assertEqual(other_class, 'B2C-26-27-0001')
        self.assertEqual(
            DocumentNumberAllocation.objects.get(number=first).series_id,
            b2b.pk
        )
        self.assertEqual(b2b.allocations.count(), 2)

    def test_series_selection_is_organization_scoped(self):
        from books.models import DocumentNumberSeries

        other_org = Organization.objects.create(name='Other Numbering Org')
        DocumentNumberSeries.objects.create(
            organization=other_org, name='Other Org Invoice',
            document_type='invoices', prefix='OTHER', separator='-'
        )
        generated = services.next_document_number(
            'INV', org=self.org, date=date(2026, 11, 12),
            user=self.admin_user
        )

        self.assertTrue(generated.startswith(self.org.get_code() + '/INV/'))
        self.assertFalse(DocumentNumberAllocation.objects.filter(organization=other_org).exists())

    def test_voiding_preserves_the_allocation_as_cancelled(self):
        from books.models import DocumentNumberSeries

        DocumentNumberSeries.objects.create(
            organization=self.org, name='Invoice Audit',
            document_type='invoices', prefix='INV-AUDIT', separator='-'
        )
        generated = services.next_document_number(
            'INV', org=self.org, date=date(2026, 11, 12),
            user=self.admin_user
        )

        updated = services.mark_document_number_cancelled(
            self.org, 'invoices', generated
        )

        allocation = DocumentNumberAllocation.objects.get(number=generated)
        self.assertEqual(updated, 1)
        self.assertTrue(allocation.cancelled)

    def test_series_settings_are_tenant_isolated(self):
        from books.models import DocumentNumberSeries

        own = DocumentNumberSeries.objects.create(
            organization=self.org, name='Own', document_type='invoices',
            prefix='OWN'
        )
        other_org = Organization.objects.create(name='Other Settings Org')
        DocumentNumberSeries.objects.create(
            organization=other_org, name='Private', document_type='invoices',
            prefix='PRIVATE'
        )
        self.client.force_login(self.admin_user)

        response = self.client.get('/api/settings/number-series/configured/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual([item['id'] for item in response.json()['series']], [own.pk])

    def test_legacy_number_series_settings_accept_specific_profiles(self):
        from books.models import DocumentNumberSeries

        DocumentNumberSeries.objects.create(
            organization=self.org, name='North Branch',
            document_type='invoices', branch='North', prefix='NORTH'
        )
        self.client.force_login(self.admin_user)

        response = self.client.get('/api/settings/number-series/')

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()['series'])


class TestPasswordResetWorkflow(BaseAccountingTestCase):
    @override_settings(
        DEBUG=False,
        PASSWORD_RESET_EMAIL_CONFIGURED=True,
        EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
    )
    def test_password_reset_email_link_is_single_use_and_resets_password(self):
        import re

        cache.clear()
        self.admin_user.email = 'reset-user@example.com'
        self.admin_user.save(update_fields=['email'])
        response = self.client.post(
            '/accounts/password_reset/',
            {'email': self.admin_user.email},
            REMOTE_ADDR='192.0.2.10',
        )

        self.assertEqual(response.status_code, 302)
        self.assertEqual(len(mail.outbox), 1)
        link = re.search(r'/accounts/reset/[^/\s]+/[^/\s]+/', mail.outbox[0].body)
        self.assertIsNotNone(link)
        confirm = self.client.get(link.group(0))
        self.assertEqual(confirm.status_code, 302)
        set_password_url = confirm.url
        self.client.get(set_password_url)
        changed = self.client.post(set_password_url, {
            'new_password1': 'NewSecurePassword123!',
            'new_password2': 'NewSecurePassword123!',
        })

        self.assertEqual(changed.status_code, 302)
        self.admin_user.refresh_from_db()
        self.assertTrue(self.admin_user.check_password('NewSecurePassword123!'))
        reused = self.client.get(link.group(0))
        self.assertEqual(reused.status_code, 200)
        self.assertContains(reused, 'invalid or has expired')

    @override_settings(
        DEBUG=False,
        PASSWORD_RESET_EMAIL_CONFIGURED=True,
        EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
    )
    def test_reset_request_is_generic_and_rate_limited_per_client_address(self):
        cache.clear()
        self.admin_user.email = 'reset-user@example.com'
        self.admin_user.save(update_fields=['email'])
        existing = self.client.post(
            '/accounts/password_reset/',
            {'email': self.admin_user.email},
            REMOTE_ADDR='192.0.2.11',
        )
        missing = self.client.post(
            '/accounts/password_reset/',
            {'email': 'nobody@example.com'},
            REMOTE_ADDR='192.0.2.12',
        )

        self.assertEqual(existing.status_code, missing.status_code)
        self.assertEqual(existing.url, missing.url)
        self.assertEqual(len(mail.outbox), 1)

        statuses = []
        for _ in range(6):
            limited = self.client.post(
                '/accounts/password_reset/',
                {'email': self.admin_user.email},
                REMOTE_ADDR='192.0.2.13',
            )
            statuses.append(limited.status_code)
        self.assertEqual(statuses, [302] * 6)
        self.assertEqual(len(mail.outbox), 6)

"""
Comprehensive automated tests for ConvosisBooks:
1. Authentication, session management, and Role-Based Access Control (RBAC)
2. Accounting & transaction integrity (invoices, payments, bank transfers, reconciliation, period locking)
3. AI Chatbot grounding in actual ledger data and HTML security
4. Consistent API error handling & status codes
"""
import json
from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.contrib.auth import get_user_model
from django.test import Client, TestCase
from django.utils import timezone

from books import services
from books.models import (
    Account, AuditLog, BankAccount, BankReconciliation, BankTransaction, BankTransfer,
    Bill, Customer, Expense, Invoice, InvoiceLine, Item, ItemCategory, Journal, JournalItem,
    LockDate, Organization, PaymentReceived, ReceivedAllocation, UserProfile, Vendor
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

        # Create GL Accounts
        self.gl_cash = Account.objects.create(code='1010', name='Cash & Bank Equivalents', account_type='asset')
        self.gl_ar = Account.objects.create(code='1020', name='Accounts Receivable', account_type='asset')
        self.gl_ap = Account.objects.create(code='2010', name='Accounts Payable', account_type='liability')
        self.gl_sales = Account.objects.create(code='4010', name='Sales Revenue', account_type='income')
        self.gl_exp = Account.objects.create(code='5010', name='Office & Tech Expense', account_type='expense')

        # Create Users with Roles
        self.admin_user = User.objects.create_user(username='admin_test', password='TestPassword123!', is_staff=True, is_superuser=True)
        self.admin_profile = UserProfile.objects.create(user=self.admin_user, role=UserProfile.ADMIN)

        self.accountant_user = User.objects.create_user(username='acct_test', password='TestPassword123!')
        self.accountant_profile = UserProfile.objects.create(user=self.accountant_user, role=UserProfile.ACCOUNTANT)

        self.auditor_user = User.objects.create_user(username='auditor_test', password='TestPassword123!')
        self.auditor_profile = UserProfile.objects.create(user=self.auditor_user, role=UserProfile.AUDITOR)

        self.cashier_user = User.objects.create_user(username='cashier_test', password='TestPassword123!')
        self.cashier_profile = UserProfile.objects.create(user=self.cashier_user, role=UserProfile.CASHIER)

        self.portal_user = User.objects.create_user(username='portal_test', password='TestPassword123!')
        self.portal_profile = UserProfile.objects.create(user=self.portal_user, role=UserProfile.PORTAL)

        self.locked_user = User.objects.create_user(username='locked_test', password='TestPassword123!')
        self.locked_profile = UserProfile.objects.create(user=self.locked_user, role=UserProfile.ACCOUNTANT, is_locked=True)

        # Create Sample Customer & Vendor
        self.customer = Customer.objects.create(name='Acme Infotech', state='Kerala', gstin='32AANCC9298C1ZE')
        self.vendor = Vendor.objects.create(name='Cloud AWS Services', state='Karnataka')

        # Create Sample Items
        self.cat = ItemCategory.objects.create(name='SaaS Licenses')
        self.item = Item.objects.create(
            name='Pro Subscription',
            sku='SKU-PRO-01',
            selling_price=Decimal('1000.00'),
            purchase_price=Decimal('500.00'),
            gst_rate=Decimal('18.00'),
            category='SaaS Licenses'
        )

        # Create Sample Bank Accounts
        self.bank_hdfc = BankAccount.objects.create(
            name='HDFC Corporate Current A/c',
            bank_name='HDFC Bank',
            account_number='50200012345678',
            opening_balance=Decimal('250000.00'),
            current_balance=Decimal('250000.00'),
            bank_balance=Decimal('250000.00'),
            gl_account=self.gl_cash
        )
        self.bank_icici = BankAccount.objects.create(
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
        # GET should succeed
        res = client.get('/api/invoices/')
        self.assertEqual(res.status_code, 200)

        # POST should be blocked with 403
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

        # Allowed on customers
        res_cust = client.get('/api/customers/')
        self.assertEqual(res_cust.status_code, 200)

        # Allowed on invoices
        res_inv = client.get('/api/invoices/')
        self.assertEqual(res_inv.status_code, 200)

        # Blocked on bills (purchases)
        res_bills = client.get('/api/bills/')
        self.assertEqual(res_bills.status_code, 403)

        # Blocked on bank transfer
        res_xfer = client.post('/api/banking/transfer/', data=json.dumps({}), content_type='application/json')
        self.assertEqual(res_xfer.status_code, 403)

    def test_portal_user_blocked_from_internal_ledger(self):
        client = Client()
        client.force_login(self.portal_user)
        res = client.get('/api/invoices/')
        self.assertEqual(res.status_code, 403)


class TestAccountingAndTransactionIntegrity(BaseAccountingTestCase):
    """Test transaction integrity, bank transfers, reconciliation, payments, and period locks."""

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
        self.assertEqual(res['number'][:3], 'TXF')

        self.bank_hdfc.refresh_from_db()
        self.bank_icici.refresh_from_db()

        self.assertEqual(self.bank_hdfc.current_balance, Decimal('200000.00'))
        self.assertEqual(self.bank_icici.current_balance, Decimal('150000.00'))

        # Check Journal Entry Parity
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
        # Reports only support GET
        res = client.post('/api/reports/profit-loss/', data=json.dumps({}), content_type='application/json')
        self.assertEqual(res.status_code, 405)
        data = res.json()
        self.assertEqual(data['error'], 'Method not allowed.')

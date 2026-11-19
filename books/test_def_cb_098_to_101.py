import json
from decimal import Decimal
from datetime import date, timedelta
from django.test import TestCase, Client
from django.contrib.auth import get_user_model
from django.utils import timezone
from books.models import (
    Organization, BankAccount, BankTransaction, BankRule, Account, UserProfile
)
from books import services

User = get_user_model()


class DefCb098To101TestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='defect_user', email='defect_user@example.com', password='password123')
        self.org = Organization.objects.create(name='Defect Test Org', owner=self.user, state='Maharashtra', base_currency='INR')
        self.profile = UserProfile.objects.create(user=self.user, organization=self.org, role='admin', normalized_email='defect_user@example.com')

        self.user2 = User.objects.create_user(username='other_user', email='other_user@example.com', password='password123')
        self.org2 = Organization.objects.create(name='Other Org', owner=self.user2, state='Delhi', base_currency='INR')
        self.profile2 = UserProfile.objects.create(user=self.user2, organization=self.org2, role='admin', normalized_email='other_user@example.com')

        self.bank_acc = BankAccount.objects.create(
            organization=self.org,
            name='HDFC Operating',
            account_number='1234567890',
            bank_name='HDFC Bank',
            account_type='current',
            current_balance=Decimal('50000.00'),
            active=True
        )

        self.bank_acc2 = BankAccount.objects.create(
            organization=self.org2,
            name='ICICI Business',
            account_number='9876543210',
            bank_name='ICICI Bank',
            account_type='current',
            current_balance=Decimal('20000.00'),
            active=True
        )

        self.expense_account = Account.objects.create(
            organization=self.org,
            name='Cloud Infrastructure Expense',
            code='6060',
            account_type=Account.EXPENSE
        )

        self.client = Client()
        self.client.force_login(self.user)

    def test_def_cb_098_monthly_cashflow_report_service(self):
        """DEF_CB_098 / TC_CB_133: Test monthly cashflow computation, grouping, zero-filling, and isolation."""
        # Create transactions for org across specific months
        d1 = date(2026, 6, 15)
        d2 = date(2026, 7, 20)
        d3 = date(2026, 9, 10)  # Month 8 (Aug) is skipped to test zero-filling

        # Inflow and Outflow in June 2026
        BankTransaction.objects.create(
            bank_account=self.bank_acc,
            organization=self.org,
            date=d1,
            deposit=Decimal('15000.00'),
            withdrawal=Decimal('0.00'),
            description='Client Retainer Payment',
            status='matched'
        )
        BankTransaction.objects.create(
            bank_account=self.bank_acc,
            organization=self.org,
            date=d1,
            deposit=Decimal('0.00'),
            withdrawal=Decimal('3500.00'),
            description='Office Rent',
            status='unmatched'
        )

        # Inflow and Outflow in July 2026
        BankTransaction.objects.create(
            bank_account=self.bank_acc,
            organization=self.org,
            date=d2,
            deposit=Decimal('20000.00'),
            withdrawal=Decimal('5000.00'),
            description='Service Invoice Settled',
            status='reconciled'
        )

        # Outflow in Sept 2026
        BankTransaction.objects.create(
            bank_account=self.bank_acc,
            organization=self.org,
            date=d3,
            deposit=Decimal('0.00'),
            withdrawal=Decimal('8000.00'),
            description='Annual Server Renewal',
            status='reconciled'
        )

        # Excluded transaction in July 2026 - must NOT count towards inflow or outflow
        BankTransaction.objects.create(
            bank_account=self.bank_acc,
            organization=self.org,
            date=d2,
            deposit=Decimal('50000.00'),
            withdrawal=Decimal('0.00'),
            description='Spam / Duplicate Feed',
            status='excluded'
        )

        # Other org transaction in June 2026 - must NOT count towards org report
        BankTransaction.objects.create(
            bank_account=self.bank_acc2,
            organization=self.org2,
            date=d1,
            deposit=Decimal('99999.00'),
            withdrawal=Decimal('0.00'),
            description='Other Org Millions',
            status='reconciled'
        )

        # Run report for June 2026 to Sept 2026
        start_d = date(2026, 6, 1)
        end_d = date(2026, 9, 30)
        report = services.get_monthly_cashflow_report(
            org=self.org,
            bank_account_id=self.bank_acc.id,
            start_date=start_d,
            end_date=end_d
        )

        self.assertEqual(len(report['months']), 4)  # Jun, Jul, Aug, Sep
        self.assertEqual(report['month_keys'], ['2026-06', '2026-07', '2026-08', '2026-09'])

        # June
        self.assertEqual(report['inflow'][0], 15000.0)
        self.assertEqual(report['outflow'][0], 3500.0)

        # July (excluded txn ignored)
        self.assertEqual(report['inflow'][1], 20000.0)
        self.assertEqual(report['outflow'][1], 5000.0)

        # August (no txns -> zero filled, must not disappear)
        self.assertEqual(report['inflow'][2], 0.0)
        self.assertEqual(report['outflow'][2], 0.0)

        # September
        self.assertEqual(report['inflow'][3], 0.0)
        self.assertEqual(report['outflow'][3], 8000.0)

        # Totals
        self.assertEqual(report['total_inflow'], 35000.0)
        self.assertEqual(report['total_outflow'], 16500.0)
        self.assertEqual(report['net_cashflow'], 18500.0)
        self.assertTrue(report['has_data'])

        # Empty period test: when no transactions exist
        empty_report = services.get_monthly_cashflow_report(
            org=self.org,
            bank_account_id=self.bank_acc.id,
            start_date=date(2025, 1, 1),
            end_date=date(2025, 3, 31)
        )
        self.assertFalse(empty_report['has_data'])
        self.assertEqual(empty_report['total_inflow'], 0.0)
        self.assertEqual(empty_report['total_outflow'], 0.0)

    def test_def_cb_098_cashflow_report_api(self):
        """DEF_CB_098: Test API endpoint /api/banking/reports/cashflow/ returns 200 and schema."""
        BankTransaction.objects.create(
            bank_account=self.bank_acc,
            organization=self.org,
            date=date(2026, 5, 10),
            deposit=Decimal('12000.00'),
            withdrawal=Decimal('4000.00'),
            description='Direct Deposit',
            status='unmatched'
        )

        res = self.client.get('/api/banking/reports/cashflow/?bank_account=' + str(self.bank_acc.id) + '&start_date=2026-05-01&end_date=2026-05-31')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data.get('has_data'))
        self.assertEqual(data.get('total_inflow'), 12000.0)
        self.assertEqual(data.get('total_outflow'), 4000.0)
        self.assertEqual(data.get('net_cashflow'), 8000.0)
        self.assertEqual(data.get('currency_symbol'), '₹')

    def test_def_cb_099_bank_automation_rules_crud_and_org_isolation(self):
        """DEF_CB_099 / TC_CB_134: Test Bank Automation Rules CRUD, toggle active state, and org isolation."""
        # 1. CREATE rule
        post_data = {
            'name': 'AWS Subscription Categorizer',
            'field': 'description',
            'operator': 'contains',
            'value': 'amazon web services',
            'category': 'Cloud Infrastructure Expense',
            'active': True
        }
        res = self.client.post('/api/banking/rules/', data=json.dumps(post_data), content_type='application/json')
        self.assertEqual(res.status_code, 201)
        rule_data = res.json()
        rule_id = rule_data['id']

        # Verify created in DB with correct org
        rule_obj = BankRule.objects.get(pk=rule_id)
        self.assertEqual(rule_obj.organization, self.org)
        self.assertEqual(rule_obj.name, 'AWS Subscription Categorizer')
        self.assertTrue(rule_obj.active)
        self.assertEqual(rule_obj.assign_account, self.expense_account)

        # 2. LIST rules
        list_res = self.client.get('/api/banking/rules/')
        self.assertEqual(list_res.status_code, 200)
        rules = list_res.json()
        self.assertTrue(any(r['id'] == rule_id for r in rules))

        # 3. UPDATE / TOGGLE rule (Disable rule)
        patch_res = self.client.patch(
            f'/api/banking/rules/{rule_id}/',
            data=json.dumps({'active': False, 'name': 'AWS Cloud Categorizer (Paused)'}),
            content_type='application/json'
        )
        self.assertEqual(patch_res.status_code, 200)
        rule_obj.refresh_from_db()
        self.assertFalse(rule_obj.active)
        self.assertEqual(rule_obj.name, 'AWS Cloud Categorizer (Paused)')

        # 4. DELETE rule
        del_res = self.client.delete(f'/api/banking/rules/{rule_id}/')
        self.assertEqual(del_res.status_code, 200)
        self.assertFalse(BankRule.objects.filter(pk=rule_id).exists())

        # 5. Org isolation: create rule for org2, ensure user from org1 cannot view or edit
        rule_org2 = BankRule.objects.create(
            organization=self.org2,
            name='Secret Org2 Rule',
            field='description',
            operator='contains',
            value='secret',
            active=True
        )
        # Attempt edit from user1
        bad_edit = self.client.patch(
            f'/api/banking/rules/{rule_org2.pk}/',
            data=json.dumps({'name': 'Hacked Rule'}),
            content_type='application/json'
        )
        self.assertEqual(bad_edit.status_code, 404)
        rule_org2.refresh_from_db()
        self.assertEqual(rule_org2.name, 'Secret Org2 Rule')

    def test_def_cb_099_disabled_bank_rule_not_executed(self):
        """DEF_CB_099: Verify disabled automation rules (active=False) do not execute during categorization."""
        # Active Rule
        active_rule = BankRule.objects.create(
            organization=self.org,
            name='Active Hosting Rule',
            field='description',
            operator='contains',
            value='hostinger',
            assign_account=self.expense_account,
            active=True
        )

        # Disabled Rule
        disabled_rule = BankRule.objects.create(
            organization=self.org,
            name='Disabled AWS Rule',
            field='description',
            operator='contains',
            value='aws',
            assign_account=self.expense_account,
            active=False
        )

        # Transaction matching active rule
        txn1 = BankTransaction.objects.create(
            bank_account=self.bank_acc,
            organization=self.org,
            date=date(2026, 6, 1),
            withdrawal=Decimal('500.00'),
            description='Payment to hostinger monthly',
            status='unmatched'
        )

        # Transaction matching disabled rule
        txn2 = BankTransaction.objects.create(
            bank_account=self.bank_acc,
            organization=self.org,
            date=date(2026, 6, 2),
            withdrawal=Decimal('1200.00'),
            description='aws server cloud bill',
            status='unmatched'
        )

        applied1 = services.apply_bank_rules_to_transaction(txn1)
        applied2 = services.apply_bank_rules_to_transaction(txn2)

        self.assertIsNotNone(applied1)
        self.assertEqual(applied1.name, 'Active Hosting Rule')
        txn1.refresh_from_db()
        self.assertEqual(txn1.status, 'categorized')
        self.assertEqual(txn1.category_account, self.expense_account)

        # Disabled rule must NOT be applied
        self.assertIsNone(applied2)
        txn2.refresh_from_db()
        self.assertEqual(txn2.status, 'unmatched')
        self.assertIsNone(txn2.category_account)

    def test_def_cb_100_organization_settings_divider(self):
        """DEF_CB_100 / TC_CB_135: Verify Organization Settings heading divider is present in CSS and DOM."""
        with open('books/static/books/css/app.css', 'r', encoding='utf-8') as f:
            css_content = f.read()

        self.assertIn('.settings-panel-header', css_content)
        self.assertIn('border-bottom: 1px solid', css_content)

        with open('books/static/books/js/settings.js', 'r', encoding='utf-8') as f:
            js_content = f.read()

        self.assertIn('settings-panel-header', js_content)
        self.assertIn('Organization Settings', js_content)
        self.assertIn('border-bottom:1px solid', js_content)

    def test_def_cb_101_settings_search_and_empty_state(self):
        """DEF_CB_101 / TC_CB_136: Verify Settings Search empty state and no results messages."""
        with open('books/static/books/js/settings.js', 'r', encoding='utf-8') as f:
            js_content = f.read()

        # Check empty state markup exists
        self.assertIn('id="settingsSearchEmptyState"', js_content)
        self.assertIn('No results found', js_content)
        self.assertIn('Try another keyword or check your spelling.', js_content)

        # Check search filtering logic handles empty search results
        self.assertIn('settingsSearchInput', js_content)
        self.assertIn('totalMatchingLinks === 0', js_content)
        self.assertIn('settingsSearchEmptyState', js_content)

from datetime import timedelta
from decimal import Decimal

from django.contrib.auth.models import User
from django.core import mail
from django.test import TestCase, override_settings
from django.utils import timezone

from books import services
from books.models import (
    Account,
    BankAccount,
    BankReconciliation,
    Bill,
    CreditNote,
    Customer,
    Expense,
    Invoice,
    InvoiceLine,
    Item,
    Journal,
    JournalItem,
    Organization,
    PaymentReceived,
    Project,
    TimeLog,
    UserProfile,
    Vendor,
)


class Phase3ReportsTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='phase3-admin', password='testpassword123')
        self.org = Organization.objects.create(name='Phase Three Ltd', company_id='PHASE3')
        self.other_org = Organization.objects.create(name='Other Ltd', company_id='OTHER3')
        UserProfile.objects.create(user=self.user, organization=self.org, role=UserProfile.ADMIN)
        self.client.force_login(self.user)

        self.customer = Customer.objects.create(
            organization=self.org,
            name='Report Customer',
            email='customer@example.com',
            opening_balance=Decimal('100.00'),
            opening_balance_type='debit',
        )
        self.other_customer = Customer.objects.create(
            organization=self.other_org,
            name='Other Customer',
            opening_balance=Decimal('999.00'),
            opening_balance_type='debit',
        )
        self.vendor = Vendor.objects.create(organization=self.org, name='Report Vendor')
        self.item = Item.objects.create(
            organization=self.org,
            name='Report Item',
            sku='REPORT-1',
            item_type='goods',
            purchase_price=Decimal('40.00'),
            selling_price=Decimal('100.00'),
        )
        self.project = Project.objects.create(
            organization=self.org,
            name='Report Project',
            customer=self.customer,
            budget_hours=Decimal('10.00'),
        )
        today = timezone.localdate()
        self.invoice = Invoice.objects.create(
            organization=self.org,
            customer=self.customer,
            project=self.project,
            number='INV-P3-1',
            date=today,
            due_date=today + timedelta(days=30),
            place_of_supply='Kerala',
            status='sent',
            subtotal=Decimal('100.00'),
            total=Decimal('100.00'),
        )
        InvoiceLine.objects.create(
            invoice=self.invoice,
            item=self.item,
            description='Report line',
            quantity=Decimal('2.000'),
            rate=Decimal('50.00'),
            taxable=Decimal('100.00'),
            tax_amount=Decimal('0.00'),
            line_total=Decimal('100.00'),
        )
        self.payment = PaymentReceived.objects.create(
            organization=self.org,
            customer=self.customer,
            number='RCV-P3-1',
            date=today,
            amount=Decimal('30.00'),
            status='paid',
        )
        self.credit = CreditNote.objects.create(
            organization=self.org,
            customer=self.customer,
            number='CN-P3-1',
            date=today,
            due_date=today,
            place_of_supply='Kerala',
            status='open',
            subtotal=Decimal('10.00'),
            total=Decimal('10.00'),
        )

        account = Account.objects.create(
            organization=self.org,
            code='1001',
            name='Cash',
            account_type='asset',
        )
        journal = Journal.objects.create(
            organization=self.org,
            number='JRN-P3-1',
            date=today,
            entry_type='manual',
        )
        JournalItem.objects.create(journal=journal, account=account, debit=Decimal('100.00'))
        JournalItem.objects.create(journal=journal, account=account, credit=Decimal('100.00'))

        self.expense_account = Account.objects.create(
            organization=self.org,
            code='5001',
            name='Office Expense',
            account_type='expense',
        )
        Expense.objects.create(
            organization=self.org,
            number='EXP-P3-1',
            date=today,
            expense_account=self.expense_account,
            vendor=self.vendor,
            project=self.project,
            amount=Decimal('25.00'),
            tax_amount=Decimal('0.00'),
            total=Decimal('25.00'),
        )
        TimeLog.objects.create(
            organization=self.org,
            project=self.project,
            user=self.user,
            date=today,
            hours=Decimal('4.00'),
            task='Report testing',
            billable=True,
            status='approved',
        )

    def test_customer_statement_and_balances_are_tenant_scoped(self):
        statement = services.customer_statement_report(
            self.customer.pk,
            timezone.localdate(),
            timezone.localdate(),
            org=self.org,
        )
        self.assertEqual(statement['opening_balance'], Decimal('100.00'))
        self.assertEqual(statement['closing_balance'], Decimal('160.00'))
        self.assertTrue(any(row['number'] == 'INV-P3-1' for row in statement['results']))

        response = self.client.get(
            f'/api/reports/customer-balances/?start={timezone.localdate()}&end={timezone.localdate()}'
        )
        self.assertEqual(response.status_code, 200)
        customers = {row['customer']: row for row in response.json()['results']}
        self.assertIn('Report Customer', customers)
        self.assertNotIn('Other Customer', customers)

    def test_account_transaction_and_day_book_totals(self):
        today = timezone.localdate()
        response = self.client.get(
            f'/api/reports/account-transactions/?start={today}&end={today}&page_size=100'
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['total_debit'], '100.00')
        self.assertEqual(data['total_credit'], '100.00')

        day_response = self.client.get(
            f'/api/reports/day-book/?start={today}&end={today}'
        )
        self.assertEqual(day_response.status_code, 200)
        day_data = day_response.json()
        self.assertEqual(day_data['total_debit'], '100.00')
        self.assertTrue(day_data['results'][0]['balanced'])

    def test_expense_project_timesheet_and_profit_reports(self):
        today = timezone.localdate()
        params = f'?start={today}&end={today}'
        self.assertEqual(self.client.get('/api/reports/expense-report/' + params).status_code, 200)
        self.assertEqual(self.client.get('/api/reports/project-report/' + params).status_code, 200)
        self.assertEqual(self.client.get('/api/reports/timesheet-report/' + params).status_code, 200)

        profit = self.client.get('/api/reports/profit-by-item/' + params)
        self.assertEqual(profit.status_code, 200)
        row = profit.json()['results'][0]
        self.assertEqual(row['quantity'], '2.000')
        self.assertEqual(row['sales'], '100.00')
        self.assertEqual(row['cost'], '80.00')
        self.assertEqual(row['profit'], '20.00')

    @override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
    def test_customer_statement_email(self):
        today = timezone.localdate()
        response = self.client.post(
            f'/api/reports/customer-statement/email/?start={today}&end={today}',
            data='{"customer": %d}' % self.customer.pk,
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ['customer@example.com'])
        self.assertEqual(len(mail.outbox[0].attachments), 1)

    def test_bank_reconciliation_and_csv_export(self):
        today = timezone.localdate()
        bank = BankAccount.objects.create(
            organization=self.org,
            name='Report Bank',
            account_number='********1234',
            bank_name='Test Bank',
        )
        BankReconciliation.objects.create(
            organization=self.org,
            bank_account=bank,
            reconciliation_number='RECON-P3-1',
            statement_date=today,
            statement_ending_balance=Decimal('500.00'),
            book_balance=Decimal('500.00'),
            cleared_balance=Decimal('500.00'),
            difference=Decimal('0.00'),
            cleared_count=1,
            status='completed',
        )
        response = self.client.get(
            f'/api/reports/bank-reconciliation/?start={today}&end={today}&bank_account={bank.pk}'
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['count'], 1)

        export = self.client.get(
            f'/api/reports/day-book/?start={today}&end={today}&export=csv'
        )
        self.assertEqual(export.status_code, 200)
        self.assertIn('text/csv', export['Content-Type'])

        xlsx_export = self.client.get(
            f'/api/reports/day-book/?start={today}&end={today}&export=xlsx'
        )
        self.assertEqual(xlsx_export.status_code, 200)
        self.assertIn('spreadsheetml', xlsx_export['Content-Type'])

        pdf_export = self.client.get(
            f'/api/reports/day-book/?start={today}&end={today}&export=pdf'
        )
        self.assertEqual(pdf_export.status_code, 200)
        self.assertEqual(pdf_export['Content-Type'], 'application/pdf')

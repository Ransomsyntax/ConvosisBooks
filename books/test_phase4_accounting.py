import json
from decimal import Decimal

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone

from books.models import (
    Account,
    Bill,
    Customer,
    FixedAsset,
    Invoice,
    Organization,
    RecurringExpense,
    UserProfile,
    Vendor,
)
from books import services


class Phase4AccountingTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='phase4-admin', password='testpassword123')
        self.org = Organization.objects.create(name='Phase Four Ltd', company_id='PHASE4')
        self.other_org = Organization.objects.create(name='Other Phase Four', company_id='OTHER4')
        UserProfile.objects.create(user=self.user, organization=self.org, role=UserProfile.ADMIN)
        self.client.force_login(self.user)
        services.ensure_default_accounts(self.org)

        self.customer = Customer.objects.create(
            organization=self.org,
            name='Netting Customer',
            opening_balance=Decimal('0.00'),
        )
        self.vendor = Vendor.objects.create(
            organization=self.org,
            name='Netting Vendor',
            opening_balance=Decimal('0.00'),
        )
        self.account = Account.objects.get(organization=self.org, code='6090')

    def test_fixed_asset_depreciation_is_idempotent_and_balanced(self):
        today = timezone.localdate()
        asset = FixedAsset.objects.create(
            organization=self.org,
            name='Server',
            code='AST-001',
            category='IT Equipment',
            purchase_date=today,
            purchase_cost=Decimal('12000.00'),
            residual_value=Decimal('0.00'),
            useful_life_months=12,
            depreciation_method='straight_line',
            depreciation_frequency='monthly',
            book_value=Decimal('12000.00'),
        )
        entry = services.post_fixed_asset_depreciation(asset, today, self.user)
        retry = services.post_fixed_asset_depreciation(asset, today, self.user)

        self.assertEqual(entry.pk, retry.pk)
        asset.refresh_from_db()
        self.assertEqual(asset.accumulated_depreciation, Decimal('1000.00'))
        self.assertEqual(asset.book_value, Decimal('11000.00'))
        self.assertEqual(
            sum((item.debit for item in entry.journal.items.all()), Decimal('0.00')),
            sum((item.credit for item in entry.journal.items.all()), Decimal('0.00')),
        )

    def test_fixed_asset_resource_create_and_dispose(self):
        today = timezone.localdate()
        create = self.client.post(
            '/api/fixed-assets/',
            data=json.dumps({
                'name': 'Printer',
                'code': 'AST-002',
                'category': 'Office Equipment',
                'purchase_date': today.isoformat(),
                'purchase_cost': '5000.00',
                'residual_value': '500.00',
                'useful_life_months': 24,
                'depreciation_method': 'straight_line',
            }),
            content_type='application/json',
        )
        self.assertEqual(create.status_code, 201, create.content)
        asset_id = create.json()['id']

        dispose = self.client.post(
            f'/api/fixed-assets/{asset_id}/dispose/',
            data=json.dumps({
                'disposal_date': today.isoformat(),
                'disposal_amount': '3000.00',
                'disposal_details': 'Sold to supplier',
            }),
            content_type='application/json',
        )
        self.assertEqual(dispose.status_code, 200, dispose.content)
        self.assertEqual(dispose.json()['status'], 'disposed')

    def test_recurring_expense_generation_and_retry_safety(self):
        today = timezone.localdate()
        profile = RecurringExpense.objects.create(
            organization=self.org,
            profile_name='Monthly Rent',
            expense_account=self.account,
            amount=Decimal('1000.00'),
            tax_amount=Decimal('180.00'),
            frequency='monthly',
            start_date=today,
            next_date=today,
        )
        expense = services.generate_recurring_expense(profile, scheduled_date=today, user=self.user)
        profile.refresh_from_db()
        self.assertEqual(expense.total, Decimal('1180.00'))
        self.assertEqual(profile.last_generated_date, today)
        self.assertGreater(profile.next_date, today)

    def test_balance_netting_generates_balanced_entry(self):
        today = timezone.localdate()
        invoice = Invoice.objects.create(
            organization=self.org,
            customer=self.customer,
            number='INV-NET-001',
            date=today,
            due_date=today,
            place_of_supply='Kerala',
            status='sent',
            subtotal=Decimal('500.00'),
            total=Decimal('500.00'),
        )
        bill = Bill.objects.create(
            organization=self.org,
            vendor=self.vendor,
            number='BILL-NET-001',
            date=today,
            due_date=today,
            place_of_supply='Kerala',
            status='open',
            subtotal=Decimal('500.00'),
            total=Decimal('500.00'),
        )
        netting = services.create_balance_netting(
            self.customer,
            self.vendor,
            invoice,
            bill,
            today,
            Decimal('200.00'),
            'INR',
            self.user,
        )
        self.assertEqual(netting.remaining_receivable, Decimal('300.00'))
        self.assertEqual(netting.remaining_payable, Decimal('300.00'))
        journal_items = netting.journal.items.all()
        self.assertEqual(
            sum((item.debit for item in journal_items), Decimal('0.00')),
            sum((item.credit for item in journal_items), Decimal('0.00')),
        )

    def test_organisation_isolation_for_phase4_resource_collections(self):
        FixedAsset.objects.create(
            organization=self.other_org,
            name='Other Asset',
            code='AST-X',
            category='Other',
            purchase_date=timezone.localdate(),
            purchase_cost=Decimal('100.00'),
            book_value=Decimal('100.00'),
        )
        response = self.client.get('/api/fixed-assets/')
        self.assertEqual(response.status_code, 200)
        names = {row['name'] for row in response.json()['results']}
        self.assertNotIn('Other Asset', names)

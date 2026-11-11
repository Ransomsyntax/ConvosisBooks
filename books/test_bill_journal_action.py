from datetime import date
from decimal import Decimal

from django.contrib.auth.models import User
from django.test import TestCase

from books.models import Account, Bill, Journal, JournalItem, Organization, UserProfile, Vendor


class BillJournalActionTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='bill-journal-admin',
            email='bill-journal-admin@example.test',
            password='TestPassword123!',
        )
        self.organization = Organization.objects.create(
            name='Journal Test Org',
            code='JTO',
            owner=self.user,
            state='Kerala',
        )
        UserProfile.objects.create(
            user=self.user,
            organization=self.organization,
            role=UserProfile.ADMIN,
        )
        self.vendor = Vendor.objects.create(
            organization=self.organization,
            name='Journal Test Vendor',
            state='Kerala',
        )
        self.bill = Bill.objects.create(
            organization=self.organization,
            vendor=self.vendor,
            number='BILL-JOURNAL-001',
            date=date(2026, 11, 1),
            due_date=date(2026, 12, 1),
            place_of_supply='Kerala',
        )
        self.client.force_login(self.user)

    def test_view_journal_returns_valid_empty_state(self):
        response = self.client.get(f'/api/bills/{self.bill.pk}/view-journal/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'status': 'ok', 'journals': []})

    def test_unsupported_action_still_returns_an_error(self):
        response = self.client.post(
            f'/api/bills/{self.bill.pk}/unsupported-action/',
            data='{}',
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()['message'], 'Unknown action.')

    def test_view_journal_returns_entries_with_items(self):
        account = Account.objects.create(
            organization=self.organization,
            code='EXP-001',
            name='Office Supplies',
            account_type=Account.EXPENSE,
        )
        journal = Journal.objects.create(
            organization=self.organization,
            number='JRN-JOURNAL-001',
            date=date(2026, 11, 1),
            reference=self.bill.number,
            created_by=self.user,
        )
        JournalItem.objects.create(
            journal=journal,
            account=account,
            debit=Decimal('125.00'),
            credit=Decimal('0.00'),
            description='Office supplies purchase',
        )

        response = self.client.get(f'/api/bills/{self.bill.pk}/view-journal/')

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['status'], 'ok')
        self.assertEqual(len(data['journals']), 1)
        self.assertEqual(data['journals'][0]['reference'], self.bill.number)
        self.assertEqual(data['journals'][0]['items'][0]['account_name'], 'Office Supplies')
        self.assertEqual(data['journals'][0]['items'][0]['description'], 'Office supplies purchase')
        self.assertEqual(data['journals'][0]['items'][0]['debit'], 125.0)

import json
import os
from decimal import Decimal
from django.test import TestCase, Client
from django.contrib.auth.models import User
from django.utils import timezone
from books.models import Organization, UserProfile, BankAccount, BankTransfer, BankTransaction, Account


class DefCb097InternalTransferTestCase(TestCase):
    """
    Test suite for DEF_CB_097: Internal Transfer Default Account Selection & Validation.
    Ensures From Account and To Account default to 'Select Account' placeholder,
    prevent automatic selection, require manual user selection, and enforce strict
    frontend & backend validation without regressions.
    """

    def setUp(self):
        self.user = User.objects.create_user(
            username='bank_admin', email='bank_admin@example.com', password='password123'
        )
        self.org = Organization.objects.create(
            name='Convosis Internal Transfer Org',
            owner=self.user,
            state='Kerala',
            base_currency='INR'
        )
        self.profile = UserProfile.objects.create(
            user=self.user,
            organization=self.org,
            role='admin',
            normalized_email='bank_admin@example.com'
        )

        self.gl_cash = Account.objects.create(
            organization=self.org,
            code='1010',
            name='Cash and Bank',
            account_type='asset'
        )

        self.bank_source = BankAccount.objects.create(
            organization=self.org,
            name='HDFC Operating A/c',
            bank_name='HDFC Bank',
            account_number='50200012345678',
            opening_balance=Decimal('200000.00'),
            current_balance=Decimal('200000.00'),
            bank_balance=Decimal('200000.00'),
            gl_account=self.gl_cash
        )

        self.bank_dest = BankAccount.objects.create(
            organization=self.org,
            name='ICICI Payroll A/c',
            bank_name='ICICI Bank',
            account_number='000405001234',
            opening_balance=Decimal('50000.00'),
            current_balance=Decimal('50000.00'),
            bank_balance=Decimal('50000.00'),
            gl_account=self.gl_cash
        )

        # Other org setup to verify organization isolation
        self.other_user = User.objects.create_user(
            username='other_admin', email='other_admin@example.com', password='password123'
        )
        self.other_org = Organization.objects.create(
            name='Other Tenant Org',
            owner=self.other_user,
            state='Tamil Nadu',
            base_currency='INR'
        )
        self.other_profile = UserProfile.objects.create(
            user=self.other_user,
            organization=self.other_org,
            role='admin',
            normalized_email='other_admin@example.com'
        )
        self.other_bank = BankAccount.objects.create(
            organization=self.other_org,
            name='SBI Isolated A/c',
            bank_name='State Bank of India',
            account_number='300000123456',
            opening_balance=Decimal('100000.00'),
            current_balance=Decimal('100000.00'),
            bank_balance=Decimal('100000.00')
        )

        self.client = Client()
        self.client.force_login(self.user)

    def test_frontend_pages_js_default_placeholders_and_modal_reset(self):
        """Verify bnkTransferModal has default placeholder options and reset routines in pages.js."""
        pages_path = os.path.join(os.path.dirname(__file__), 'static', 'books', 'js', 'pages.js')
        with open(pages_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # Both selects must have 'Select Account' with empty value as initial option
        self.assertIn('<option value="" selected>Select Account</option>', content)
        self.assertIn('id="bnkTrFrom"', content)
        self.assertIn('id="bnkTrTo"', content)

        # The reversed slice bug must be eliminated
        self.assertNotIn('bankAccounts.slice().reverse()', content)

        # Amount must have placeholder 'Enter Amount' rather than prefilled 50000.00
        self.assertIn('placeholder="Enter Amount"', content)

        # Error elements must exist for user validation feedback
        self.assertIn('id="bnkTrFromErr"', content)
        self.assertIn('id="bnkTrToErr"', content)
        self.assertIn('id="bnkTrAmountErr"', content)

        # Reset routine must be integrated in openModal & closeModal
        self.assertIn('resetBnkTransferModal', content)

    def test_frontend_forms_js_transfer_modal_placeholders(self):
        """Verify transferForm in forms.js does not auto-select default accounts."""
        forms_path = os.path.join(os.path.dirname(__file__), 'static', 'books', 'js', 'forms.js')
        with open(forms_path, 'r', encoding='utf-8') as f:
            content = f.read()

        self.assertIn("['', 'Select Account']", content)
        self.assertIn("ph: 'Enter Amount'", content)

    def test_backend_validation_rejects_missing_from_account(self):
        """Backend must reject transfers where From Account is missing or empty."""
        payload = {
            'from_account': '',
            'to_account': self.bank_dest.pk,
            'amount': '15000.00',
            'date': str(timezone.localdate())
        }
        res = self.client.post('/api/banking/transfer/', data=json.dumps(payload), content_type='application/json')
        self.assertEqual(res.status_code, 400)
        data = res.json()
        error_msg = data.get('error') or data.get('detail') or str(data)
        self.assertIn('From Account is required', error_msg)

    def test_backend_validation_rejects_missing_to_account(self):
        """Backend must reject transfers where To Account is missing or empty."""
        payload = {
            'from_account': self.bank_source.pk,
            'to_account': '',
            'amount': '15000.00',
            'date': str(timezone.localdate())
        }
        res = self.client.post('/api/banking/transfer/', data=json.dumps(payload), content_type='application/json')
        self.assertEqual(res.status_code, 400)
        data = res.json()
        error_msg = data.get('error') or data.get('detail') or str(data)
        self.assertIn('To Account is required', error_msg)

    def test_backend_validation_rejects_identical_accounts(self):
        """Backend must reject transfers where From Account and To Account are identical."""
        payload = {
            'from_account': self.bank_source.pk,
            'to_account': self.bank_source.pk,
            'amount': '10000.00',
            'date': str(timezone.localdate())
        }
        res = self.client.post('/api/banking/transfer/', data=json.dumps(payload), content_type='application/json')
        self.assertEqual(res.status_code, 400)
        data = res.json()
        error_msg = data.get('error') or data.get('detail') or str(data)
        self.assertIn('Source and destination bank accounts must be different', error_msg)

    def test_backend_validation_rejects_invalid_or_non_positive_amount(self):
        """Backend must reject zero, negative, or invalid amounts."""
        for invalid_amt in ('0', '0.00', '-500.00', '', 'abc'):
            payload = {
                'from_account': self.bank_source.pk,
                'to_account': self.bank_dest.pk,
                'amount': invalid_amt,
                'date': str(timezone.localdate())
            }
            res = self.client.post('/api/banking/transfer/', data=json.dumps(payload), content_type='application/json')
            self.assertEqual(res.status_code, 400)

    def test_backend_validation_organization_isolation(self):
        """Transfers between accounts in different organizations must be rejected (404)."""
        payload = {
            'from_account': self.bank_source.pk,
            'to_account': self.other_bank.pk,
            'amount': '5000.00',
            'date': str(timezone.localdate())
        }
        res = self.client.post('/api/banking/transfer/', data=json.dumps(payload), content_type='application/json')
        self.assertEqual(res.status_code, 404)

    def test_successful_internal_transfer_updates_balances_and_records_transactions(self):
        """A valid transfer updates account balances and creates BankTransfer & BankTransaction entries."""
        transfer_amt = Decimal('25000.00')
        payload = {
            'from_account': self.bank_source.pk,
            'to_account': self.bank_dest.pk,
            'amount': str(transfer_amt),
            'reference': 'TXF-DEF-097',
            'description': 'Head Office to Payroll branch transfer',
            'date': str(timezone.localdate())
        }
        res = self.client.post('/api/banking/transfer/', data=json.dumps(payload), content_type='application/json')
        self.assertIn(res.status_code, (200, 201))

        self.bank_source.refresh_from_db()
        self.bank_dest.refresh_from_db()
        self.assertEqual(self.bank_source.current_balance, Decimal('175000.00'))
        self.assertEqual(self.bank_dest.current_balance, Decimal('75000.00'))

        transfer = BankTransfer.objects.filter(
            from_account=self.bank_source,
            to_account=self.bank_dest,
            amount=transfer_amt
        ).first()
        self.assertIsNotNone(transfer)
        self.assertEqual(transfer.organization, self.org)
        self.assertEqual(transfer.reference, 'TXF-DEF-097')

        # Check BankTransaction entries
        tx_source = BankTransaction.objects.filter(bank_account=self.bank_source, withdrawal=transfer_amt).first()
        tx_dest = BankTransaction.objects.filter(bank_account=self.bank_dest, deposit=transfer_amt).first()
        self.assertIsNotNone(tx_source)
        self.assertIsNotNone(tx_dest)
        self.assertEqual(tx_source.transaction_type, 'Transfer')
        self.assertEqual(tx_dest.transaction_type, 'Transfer')

from django.test import TestCase
from django.contrib.auth import get_user_model
from books.models import BankAccount, Organization
from books.api import BankAccountResource
from books.cleaning import ApiError

User = get_user_model()

class BankAccountValidationTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='bank_test_user', password='password123')
        self.org = Organization.objects.create(name='Test Org')
        self.resource = BankAccountResource()

    def test_def_cb_082_account_display_name_validation(self):
        # Valid test inputs
        valid_names = ['Primary Savings Account', 'Business Account 01', 'Kotak1 / Primary Current', 'Account & Co. (Main)']
        for name in valid_names:
            payload = {
                'name': name,
                'bank_name': 'HDFC Bank',
                'account_number': '123456789012',
                'account_type': 'current'
            }
            cleaned = self.resource.clean(payload)
            self.assertEqual(cleaned['name'], name)

        # Invalid test inputs
        invalid_names = ['@#$%123', '@@@@', '', '   ', '###']
        for name in invalid_names:
            payload = {
                'name': name,
                'bank_name': 'HDFC Bank',
                'account_number': '123456789012',
                'account_type': 'current'
            }
            with self.assertRaises(ApiError) as ctx:
                self.resource.clean(payload)
            self.assertIn('name', ctx.exception.errors)
            self.assertEqual(ctx.exception.errors['name'], 'Please enter a valid account display name.')

    def test_def_cb_083_bank_name_validation(self):
        # Valid test inputs
        valid_banks = ['State Bank of India', 'HDFC Bank', 'ICICI Bank Ltd.', "Standard & Poor's Bank", 'Axis Bank - MG Road']
        for bank in valid_banks:
            payload = {
                'name': 'Primary Account',
                'bank_name': bank,
                'account_number': '123456789012',
                'account_type': 'current'
            }
            cleaned = self.resource.clean(payload)
            self.assertEqual(cleaned['bank_name'], bank)

        # Invalid test inputs
        invalid_banks = ['123456', '@123$##', '', '   ', '!!!']
        for bank in invalid_banks:
            payload = {
                'name': 'Primary Account',
                'bank_name': bank,
                'account_number': '123456789012',
                'account_type': 'current'
            }
            with self.assertRaises(ApiError) as ctx:
                self.resource.clean(payload)
            self.assertIn('bank_name', ctx.exception.errors)
            self.assertEqual(ctx.exception.errors['bank_name'], 'Please enter a valid bank name.')

    def test_def_cb_084_account_number_validation_and_leading_zeros(self):
        # Valid test inputs: numeric strings, preserving leading zeros
        valid_numbers = ['123456789012', '001234567890', '00001']
        for num in valid_numbers:
            payload = {
                'name': 'Primary Account',
                'bank_name': 'HDFC Bank',
                'account_number': num,
                'account_type': 'current'
            }
            cleaned = self.resource.clean(payload)
            self.assertEqual(cleaned['account_number'], num)
            self.assertTrue(cleaned['account_number'].startswith(num[:2]))

        # Invalid test inputs: letters, special characters, empty
        invalid_numbers = ['jaqgfvtnmhiu', '123ABC456', '@#$123', '', '   ', None]
        for num in invalid_numbers:
            payload = {
                'name': 'Primary Account',
                'bank_name': 'HDFC Bank',
                'account_number': num,
                'account_type': 'current'
            }
            with self.assertRaises(ApiError) as ctx:
                self.resource.clean(payload)
            self.assertIn('account_number', ctx.exception.errors)
            self.assertEqual(ctx.exception.errors['account_number'], 'Account number must contain only numeric characters.')

    def test_def_cb_085_multiple_invalid_fields_error_mapping(self):
        payload = {
            'name': '@#$%123',
            'bank_name': '123456',
            'account_number': 'jaqgfvtnmhiu',
            'account_type': ''
        }
        with self.assertRaises(ApiError) as ctx:
            self.resource.clean(payload)
        
        errs = ctx.exception.errors
        self.assertIn('name', errs)
        self.assertEqual(errs['name'], 'Please enter a valid account display name.')
        self.assertIn('bank_name', errs)
        self.assertEqual(errs['bank_name'], 'Please enter a valid bank name.')
        self.assertIn('account_number', errs)
        self.assertEqual(errs['account_number'], 'Account number must contain only numeric characters.')
        self.assertIn('account_type', errs)
        self.assertEqual(errs['account_type'], 'Please select an account type.')

    def test_def_cb_087_account_type_dropdown_selection(self):
        # Initial placeholder / empty / 'select' must fail
        for empty_type in ['', '   ', 'Select', 'select', None]:
            payload = {
                'name': 'Primary Account',
                'bank_name': 'HDFC Bank',
                'account_number': '123456789012',
                'account_type': empty_type
            }
            with self.assertRaises(ApiError) as ctx:
                self.resource.clean(payload)
            self.assertIn('account_type', ctx.exception.errors)
            self.assertEqual(ctx.exception.errors['account_type'], 'Please select an account type.')

        # Valid selection maps correctly
        valid_types = [
            ('Current Account', 'current'),
            ('current', 'current'),
            ('Savings Account', 'savings'),
            ('savings', 'savings'),
            ('Credit Card', 'credit_card'),
            ('credit_card', 'credit_card'),
        ]
        for raw_val, expected in valid_types:
            payload = {
                'name': 'Primary Account',
                'bank_name': 'HDFC Bank',
                'account_number': '123456789012',
                'account_type': raw_val
            }
            cleaned = self.resource.clean(payload)
            self.assertEqual(cleaned['account_type'], expected)


import json

from django.contrib.auth.models import User
from django.test import Client

from books.tests import BaseAccountingTestCase
from books.models import Expense, UserProfile


class ExpenseReferenceValidationTests(BaseAccountingTestCase):
    def setUp(self):
        super().setUp()
        self.client = Client()
        self.expense_user = User.objects.create_user(username='exp_admin_user', password='TestPassword123!', is_staff=True, is_superuser=False)
        UserProfile.objects.create(user=self.expense_user, organization=self.org, role=UserProfile.ADMIN)
        self.client.force_login(self.expense_user)
        session = self.client.session
        session['active_org_id'] = self.org.id
        session.save()
        self.expense_data = {
            'date': '2026-11-11',
            'expense_account': self.gl_exp.pk,
            'amount': '100.00',
            'gst_rate': '18',
            'paid_through': 'Bank Account',
        }

    def create_expense(self, reference):
        payload = {**self.expense_data, 'reference': reference}
        return self.client.post(
            '/api/expenses/',
            data=json.dumps(payload),
            content_type='application/json',
            HTTP_X_ORGANIZATION_ID=str(self.org.id),
        )

    def test_create_rejects_unsupported_reference_characters(self):
        response = self.create_expense('#@4567665fgbfgtsgvvts')
        self.assertEqual(response.status_code, 400)
        self.assertIn('reference', response.json()['errors'])
        self.assertFalse(Expense.objects.filter(reference='#@4567665fgbfgtsgvvts').exists())

    def test_create_accepts_common_reference_formats(self):
        response = self.create_expense('Receipt #401 / INV-2026.11_A (2):B')

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()['reference'], 'Receipt #401 / INV-2026.11_A (2):B')

    def test_update_rejects_invalid_reference_and_preserves_saved_value(self):
        response = self.create_expense('Receipt #401')
        self.assertEqual(response.status_code, 201)
        expense_id = response.json()['id']

        update_response = self.client.put(
            f'/api/expenses/{expense_id}/',
            data=json.dumps({'reference': '#@4567665fgbfgtsgvvts'}),
            content_type='application/json',
            HTTP_X_ORGANIZATION_ID=str(self.org.id),
        )

        self.assertEqual(update_response.status_code, 400)
        self.assertIn('reference', update_response.json()['errors'])
        expense = Expense.objects.get(pk=expense_id)
        self.assertEqual(expense.reference, 'Receipt #401')

    def test_update_accepts_common_reference_formats(self):
        response = self.create_expense('Receipt #401')
        self.assertEqual(response.status_code, 201)
        expense_id = response.json()['id']
        new_reference = 'VENDOR/2026-27_001.2'

        update_response = self.client.put(
            f'/api/expenses/{expense_id}/',
            data=json.dumps({'reference': new_reference}),
            content_type='application/json',
            HTTP_X_ORGANIZATION_ID=str(self.org.id),
        )

        self.assertEqual(update_response.status_code, 200)
        self.assertEqual(update_response.json()['reference'], new_reference)

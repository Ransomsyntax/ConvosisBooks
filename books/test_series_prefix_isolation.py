import json
from decimal import Decimal
from django.test import TestCase, Client
from django.contrib.auth import get_user_model
from django.utils import timezone
from books.models import (
    Organization, UserProfile, TransactionSeries, DocumentNumberSeries,
    DocumentNumberSeriesCounter, Invoice
)
from books import services
from books.cleaning import ApiError

User = get_user_model()

class TransactionSeriesPrefixIsolationTests(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(name='Test Convobooks Org')
        self.user = User.objects.create_superuser(username='admin_series_user', email='admin@test.com', password='password123')
        self.profile = UserProfile.objects.create(user=self.user, organization=self.org, role=UserProfile.ADMIN, status=UserProfile.STATUS_ACTIVE)
        services.ensure_default_transaction_series(self.org)
        self.client = Client()
        self.client.force_login(self.user)

    def test_independent_prefix_generation_and_no_accumulation(self):
        """
        Verify that multiple series generate their prefixes independently from the base prefix,
        and that previous series names (e.g. KTM) NEVER accumulate into subsequent series (B2B, KLK).
        """
        base_inv_prefix = services.default_document_number_prefix(self.org, 'INV')
        base_so_prefix = services.default_document_number_prefix(self.org, 'SO')
        base_qtn_prefix = services.default_document_number_prefix(self.org, 'QTN')
        base_cn_prefix = services.default_document_number_prefix(self.org, 'CN')
        base_pr_prefix = services.default_document_number_prefix(self.org, 'PR')

        # Scenario 1: Create KTM series
        res_ktm = self.client.post('/api/settings/transaction-series/', data=json.dumps({
            'name': 'KTM',
            'branch': 'Kottayam',
            'is_default': False,
            'is_active': True,
            'items': [
                {'document_type': 'invoices', 'prefix': f'KTM-{base_inv_prefix}', 'next_number': '00001'},
                {'document_type': 'sales_orders', 'prefix': f'KTM-{base_so_prefix}', 'next_number': '00001'},
                {'document_type': 'quotes', 'prefix': f'KTM-{base_qtn_prefix}', 'next_number': '00001'},
                {'document_type': 'credit_notes', 'prefix': f'KTM-{base_cn_prefix}', 'next_number': '00001'},
                {'document_type': 'payments_received', 'prefix': f'KTM-{base_pr_prefix}', 'next_number': '00001'},
            ]
        }), content_type='application/json')
        self.assertEqual(res_ktm.status_code, 201)
        ktm_id = res_ktm.json()['id']

        # Scenario 2: Create B2B series - Must NOT contain KTM
        res_b2b = self.client.post('/api/settings/transaction-series/', data=json.dumps({
            'name': 'B2B',
            'branch': 'B2B Sales',
            'is_default': False,
            'is_active': True,
            'items': [
                {'document_type': 'invoices', 'prefix': f'B2B-{base_inv_prefix}', 'next_number': '00001'},
                {'document_type': 'sales_orders', 'prefix': f'B2B-{base_so_prefix}', 'next_number': '00001'},
                {'document_type': 'quotes', 'prefix': f'B2B-{base_qtn_prefix}', 'next_number': '00001'},
                {'document_type': 'credit_notes', 'prefix': f'B2B-{base_cn_prefix}', 'next_number': '00001'},
                {'document_type': 'payments_received', 'prefix': f'B2B-{base_pr_prefix}', 'next_number': '00001'},
            ]
        }), content_type='application/json')
        self.assertEqual(res_b2b.status_code, 201)
        b2b_id = res_b2b.json()['id']

        # Scenario 3: Create KLK series - Must NOT contain KTM or B2B
        res_klk = self.client.post('/api/settings/transaction-series/', data=json.dumps({
            'name': 'KLK',
            'branch': 'Kallara',
            'is_default': False,
            'is_active': True,
            'items': [
                {'document_type': 'invoices', 'prefix': f'KLK-{base_inv_prefix}', 'next_number': '00001'},
                {'document_type': 'sales_orders', 'prefix': f'KLK-{base_so_prefix}', 'next_number': '00001'},
                {'document_type': 'quotes', 'prefix': f'KLK-{base_qtn_prefix}', 'next_number': '00001'},
                {'document_type': 'credit_notes', 'prefix': f'KLK-{base_cn_prefix}', 'next_number': '00001'},
                {'document_type': 'payments_received', 'prefix': f'KLK-{base_pr_prefix}', 'next_number': '00001'},
            ]
        }), content_type='application/json')
        self.assertEqual(res_klk.status_code, 201)
        klk_id = res_klk.json()['id']

        # Verify database items for KTM
        ktm_inv = DocumentNumberSeries.objects.get(organization=self.org, series_group_id=ktm_id, document_type='invoices')
        self.assertEqual(ktm_inv.prefix, f'KTM-{base_inv_prefix}')
        self.assertNotIn('B2B', ktm_inv.prefix)
        self.assertNotIn('KLK', ktm_inv.prefix)

        # Verify database items for B2B
        b2b_inv = DocumentNumberSeries.objects.get(organization=self.org, series_group_id=b2b_id, document_type='invoices')
        self.assertEqual(b2b_inv.prefix, f'B2B-{base_inv_prefix}')
        self.assertNotIn('KTM', b2b_inv.prefix)
        self.assertNotIn('KLK', b2b_inv.prefix)

        # Verify database items for KLK
        klk_inv = DocumentNumberSeries.objects.get(organization=self.org, series_group_id=klk_id, document_type='invoices')
        self.assertEqual(klk_inv.prefix, f'KLK-{base_inv_prefix}')
        self.assertNotIn('KTM', klk_inv.prefix)
        self.assertNotIn('B2B', klk_inv.prefix)

    def test_unsaved_form_isolation_and_existing_series_protection(self):
        """
        Verify that opening the form or typing without saving has zero impact on the database or existing series.
        """
        # Baseline series count
        initial_series_count = TransactionSeries.objects.filter(organization=self.org).count()
        initial_items_count = DocumentNumberSeries.objects.filter(organization=self.org).count()
        default_series = TransactionSeries.objects.get(organization=self.org, is_default=True)
        default_inv = DocumentNumberSeries.objects.get(organization=self.org, series_group=default_series, document_type='invoices')
        original_prefix = default_inv.prefix
        original_next = default_inv.next_number

        # Performing GET does not create or mutate series
        res = self.client.get('/api/settings/transaction-series/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(TransactionSeries.objects.filter(organization=self.org).count(), initial_series_count)
        self.assertEqual(DocumentNumberSeries.objects.filter(organization=self.org).count(), initial_items_count)

        # Reload default series to confirm unchanged
        default_inv.refresh_from_db()
        self.assertEqual(default_inv.prefix, original_prefix)
        self.assertEqual(default_inv.next_number, original_next)

    def test_next_number_sequence_isolation_across_series(self):
        """
        Verify that generating a transaction number using Series KTM does NOT increment
        or affect the sequence of Series B2B or KLK.
        """
        base_inv_prefix = services.default_document_number_prefix(self.org, 'INV')
        
        # Create KTM
        res_ktm = self.client.post('/api/settings/transaction-series/', data=json.dumps({
            'name': 'KTM_SEQ',
            'is_default': False,
            'is_active': True,
            'items': [{'document_type': 'invoices', 'prefix': f'KTM-{base_inv_prefix}', 'next_number': '00001'}]
        }), content_type='application/json')
        ktm_id = res_ktm.json()['id']

        # Create B2B
        res_b2b = self.client.post('/api/settings/transaction-series/', data=json.dumps({
            'name': 'B2B_SEQ',
            'is_default': False,
            'is_active': True,
            'items': [{'document_type': 'invoices', 'prefix': f'B2B-{base_inv_prefix}', 'next_number': '00001'}]
        }), content_type='application/json')
        b2b_id = res_b2b.json()['id']

        # Generate number using KTM series
        num1 = services.next_document_number('INV', org=self.org, series_id=ktm_id)
        self.assertTrue(num1.startswith('KTM-'))
        self.assertTrue(num1.endswith('00001'))

        # Generate second number using KTM series
        num2 = services.next_document_number('INV', org=self.org, series_id=ktm_id)
        self.assertTrue(num2.startswith('KTM-'))
        self.assertTrue(num2.endswith('00002'))

        # Preview and generate number using B2B series - MUST STILL BE 00001!
        prev_b2b = services.preview_document_number('INV', org=self.org, series_id=b2b_id)
        self.assertTrue(prev_b2b['formatted'].endswith('00001'))

        num_b2b = services.next_document_number('INV', org=self.org, series_id=b2b_id)
        self.assertTrue(num_b2b.startswith('B2B-'))
        self.assertTrue(num_b2b.endswith('00001'))

    def test_default_series_validation(self):
        """
        Verify:
        - Inactive series cannot be set as default on create.
        - Inactive series cannot be set as default on update.
        - Default series cannot be deactivated.
        """
        base_inv_prefix = services.default_document_number_prefix(self.org, 'INV')

        # 1. Attempt to create an inactive default series -> must fail
        res_fail = self.client.post('/api/settings/transaction-series/', data=json.dumps({
            'name': 'Inactive Default',
            'is_default': True,
            'is_active': False,
            'items': [{'document_type': 'invoices', 'prefix': f'INACT-{base_inv_prefix}', 'next_number': '00001'}]
        }), content_type='application/json')
        self.assertEqual(res_fail.status_code, 400)
        self.assertIn('An inactive series cannot be set as the default series', res_fail.json()['message'])

        # 2. Create an active non-default series
        res_ok = self.client.post('/api/settings/transaction-series/', data=json.dumps({
            'name': 'Branch Delta',
            'is_default': False,
            'is_active': True,
            'items': [{'document_type': 'invoices', 'prefix': f'DLT-{base_inv_prefix}', 'next_number': '00001'}]
        }), content_type='application/json')
        self.assertEqual(res_ok.status_code, 201)
        delta_id = res_ok.json()['id']

        # 3. Attempt to set as default while deactivating -> must fail
        res_fail2 = self.client.put(f'/api/settings/transaction-series/{delta_id}/', data=json.dumps({
            'is_default': True,
            'is_active': False
        }), content_type='application/json')
        self.assertEqual(res_fail2.status_code, 400)

        # 4. Set as default successfully
        res_def = self.client.put(f'/api/settings/transaction-series/{delta_id}/', data=json.dumps({
            'is_default': True
        }), content_type='application/json')
        self.assertEqual(res_def.status_code, 200)

        # 5. Attempt to deactivate the default series -> must fail
        res_deact = self.client.delete(f'/api/settings/transaction-series/{delta_id}/')
        self.assertEqual(res_deact.status_code, 400)
        self.assertIn('Cannot deactivate the default transaction series', res_deact.json()['message'])


import json
from django.test import TestCase, Client
from django.contrib.auth.models import User
from django.utils import timezone
from books.models import (
    Organization, UserProfile, TransactionSeries, DocumentNumberSeries,
    DocumentNumberSeriesCounter, DocumentNumberPreference, Customer, Vendor,
    Invoice, Quote, SalesOrder, Bill, PurchaseOrder, Expense, PaymentReceived,
    PaymentMade, DeliveryChallan
)
from books import services


class TransactionSeriesRepairTests(TestCase):
    def setUp(self):
        self.org = Organization.objects.first() or Organization.objects.create(
            name='Acme Testing Corp',
            code='ACME',
            country='IN',
            state='Kerala'
        )
        self.user = User.objects.create_user(username='admin_series', password='TestPassword123!', email='series@acme.com')
        self.profile = UserProfile.objects.create(
            user=self.user,
            organization=self.org,
            role=UserProfile.ADMIN
        )
        self.client = Client()
        self.client.force_login(self.user)
        services.ensure_default_transaction_series(self.org)
        self.default_grp = TransactionSeries.objects.filter(organization=self.org, is_default=True).first()

    def test_token_expansion_and_formatting(self):
        """Test all dynamic tokens and case-insensitive/dollar-sign replacements in _format_series_number."""
        s_item = DocumentNumberSeries.objects.filter(
            organization=self.org, series_group=self.default_grp, document_type='invoices'
        ).first()
        s_item.padding = 3
        s_item.separator = '/'

        # Test pattern with mixed styles: ${FY}, {CUSTOMERTYPE}, {LOCATION}, {SEQUENCE}
        fmt = 'INV/{CUSTOMERTYPE}/${FY}/{SEQUENCE}'
        out = services._format_series_number(
            s_item, 20, self.org, customer_type='b2b', location='Kottayam', format_pattern=fmt
        )
        fy = services.get_financial_year(org=self.org)
        self.assertEqual(out, f'INV/B2B/{fy}/020')

        # Test pattern without explicit sequence token: should append separator and padded sequence
        fmt_no_seq = 'INV/{CUSTOMER_TYPE}/{LOCATION}/'
        out2 = services._format_series_number(
            s_item, 5, self.org, customer_type='B2C', location='Ernakulam', format_pattern=fmt_no_seq
        )
        self.assertEqual(out2, 'INV/B2C/ERNAKULAM/005')

        # Test all additional date and org tokens
        date_fixed = timezone.localdate()
        yr_str = str(date_fixed.year)
        mo_str = f"{date_fixed.month:02d}"
        day_str = f"{date_fixed.day:02d}"
        fmt_all = '{ORG}/{BRANCH}/{YYYY}/{MM}/{DD}/{SEQUENCE}'
        out3 = services._format_series_number(
            s_item, 1, self.org, date=date_fixed, branch='HQ', format_pattern=fmt_all
        )
        org_code = self.org.get_code()
        self.assertEqual(out3, f'{org_code}/HQ/{yr_str}/{mo_str}/{day_str}/001')

    def test_put_transaction_series_save(self):
        """Test PUT /settings/transaction-series/<id>/ updates format_pattern, prefix, next_number, padding, and separator."""
        series_id = self.default_grp.pk
        payload = {
            'items': [{
                'document_type': 'invoices',
                'prefix': 'INV/{CUSTOMERTYPE}/${FY}/',
                'format_pattern': 'INV/{CUSTOMERTYPE}/${FY}/{SEQUENCE}',
                'separator': '/',
                'next_number': 20,
                'padding': 3
            }]
        }
        resp = self.client.put(
            f'/api/settings/transaction-series/{series_id}/',
            data=json.dumps(payload),
            content_type='application/json'
        )
        self.assertEqual(resp.status_code, 200, resp.content.decode())
        res_data = resp.json()
        self.assertEqual(res_data.get('status'), 'ok')

        # Verify database was updated
        s_item = DocumentNumberSeries.objects.get(
            organization=self.org, series_group=self.default_grp, document_type='invoices'
        )
        self.assertEqual(s_item.prefix, 'INV/{CUSTOMERTYPE}/${FY}/')
        self.assertEqual(s_item.format_pattern, 'INV/{CUSTOMERTYPE}/${FY}/{SEQUENCE}')
        self.assertEqual(s_item.next_number, 20)
        self.assertEqual(s_item.padding, 3)
        self.assertEqual(s_item.separator, '/')

        # Verify counter is also updated
        counter = services._series_counter_for_date(s_item, self.org, module_or_pfx='invoices')
        self.assertEqual(counter.next_number, 20)

    def test_lower_sequence_no_409_conflict(self):
        """Resetting to default or lowering sequence number must NOT trigger 409 conflict."""
        s_item = DocumentNumberSeries.objects.get(
            organization=self.org, series_group=self.default_grp, document_type='invoices'
        )
        counter = services._series_counter_for_date(s_item, self.org, module_or_pfx='invoices')
        counter.next_number = 100
        counter.save()
        s_item.next_number = 100
        s_item.save()

        # User wants to set next_number back to 1 (e.g. Reset to Default)
        resp = self.client.put(
            f'/api/settings/transaction-series/{self.default_grp.pk}/',
            data=json.dumps({
                'items': [{
                    'document_type': 'invoices',
                    'prefix': 'INV/',
                    'format_pattern': '',
                    'separator': '/',
                    'next_number': 1,
                    'padding': 5
                }]
            }),
            content_type='application/json'
        )
        self.assertEqual(resp.status_code, 200, resp.content.decode())

        counter.refresh_from_db()
        self.assertEqual(counter.next_number, 1)

    def test_get_transaction_series_returns_defaults(self):
        """GET /settings/transaction-series/ returns default_prefix, default_next, default_padding for frontend reset."""
        resp = self.client.get(f'/api/settings/transaction-series/?series_id={self.default_grp.pk}')
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data.get('status'), 'ok')
        items = data.get('items', [])
        inv_item = next((it for it in items if it['document_type'] == 'invoices'), None)
        self.assertIsNotNone(inv_item)
        self.assertIn('default_prefix', inv_item)
        self.assertIn('default_next', inv_item)
        self.assertIn('default_padding', inv_item)
        self.assertIn('default_separator', inv_item)
        self.assertEqual(inv_item['default_next'], 1)
        self.assertEqual(inv_item['default_padding'], 5)

    def test_doc_generation_across_modules(self):
        """Test document number generation across various modules."""
        modules = ['invoices', 'quotes', 'sales_orders', 'bills', 'purchase_orders', 'expenses', 'delivery_challans']
        for mod in modules:
            num = services.next_document_number(mod, org=self.org)
            self.assertTrue(bool(num))
            self.assertFalse(num.endswith('None'))

    def test_doc_number_preferences_post(self):
        """Test doc number preferences endpoint allows updating without 409 and returns preview_formatted."""
        resp = self.client.post(
            '/api/settings/doc-number-preferences/',
            data=json.dumps({
                'document_type': 'quotes',
                'transaction_series': self.default_grp.name,
                'location': 'HO Kottayam',
                'auto_generate': True,
                'prefix': 'QTN/${FY}/',
                'next_number': 10,
                'restart_yearly': True
            }),
            content_type='application/json'
        )
        self.assertEqual(resp.status_code, 200, resp.content.decode())
        res_data = resp.json()
        self.assertEqual(res_data.get('status'), 'ok')
        self.assertIn('preview_formatted', res_data)
        self.assertTrue(res_data['preview_formatted'].startswith('QTN/'))

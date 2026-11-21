import json
import os
from decimal import Decimal
from django.test import TestCase, Client
from django.contrib.auth.models import User
from django.utils import timezone
from books.models import (
    Organization, UserProfile, TransactionSeries, DocumentNumberSeries
)
from books import services


class TransactionSeriesButtonsFunctionalTestCase(TestCase):
    """
    Comprehensive functional and regression test suite verifying all interactive controls
    and buttons in the Settings -> Transaction Number Series module.
    """

    def setUp(self):
        self.user = User.objects.create_user(
            username='series_admin', email='series_admin@example.com', password='password123'
        )
        self.org = Organization.objects.create(
            name='Convosis Series Org',
            owner=self.user,
            state='Kerala',
            base_currency='INR'
        )
        self.profile = UserProfile.objects.create(
            user=self.user,
            organization=self.org,
            role='admin',
            normalized_email='series_admin@example.com'
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

        self.client = Client()
        self.client.force_login(self.user)

        # Create Default Series
        self.default_series = TransactionSeries.objects.create(
            organization=self.org,
            name='Default Series',
            branch='Main Branch',
            location='Main Branch',
            is_default=True,
            is_active=True
        )
        for doc_type, pfx in [('invoices', 'INV'), ('bills', 'BILL'), ('payments_received', 'PAY')]:
            DocumentNumberSeries.objects.create(
                organization=self.org,
                series_group=self.default_series,
                name=self.default_series.name,
                document_type=doc_type,
                prefix=pfx,
                format_pattern=f'{pfx}/{{FY}}/{{SEQUENCE}}',
                separator='/',
                starting_number=1,
                next_number=1,
                padding=5,
                active=True,
                is_default=True,
                branch=self.default_series.branch,
                location=self.default_series.location
            )

        # Create Secondary Series
        self.secondary_series = TransactionSeries.objects.create(
            organization=self.org,
            name='Kochi Branch',
            branch='Kochi',
            location='Kochi',
            is_default=False,
            is_active=True
        )
        for doc_type, pfx in [('invoices', 'KOC-INV'), ('bills', 'KOC-BILL'), ('payments_received', 'KOC-PAY')]:
            DocumentNumberSeries.objects.create(
                organization=self.org,
                series_group=self.secondary_series,
                name=self.secondary_series.name,
                document_type=doc_type,
                prefix=pfx,
                format_pattern=f'{pfx}/{{LOCATION}}/{{SEQUENCE}}',
                separator='/',
                starting_number=1,
                next_number=10,
                padding=5,
                active=True,
                is_default=False,
                branch=self.secondary_series.branch,
                location=self.secondary_series.location
            )

    def test_frontend_files_contain_all_button_and_modal_ux_fixes(self):
        """Verify modal backdrop dismissal, escape key handlers, reset format, and dynamic field insertion exist."""
        paths = [
            os.path.join(os.path.dirname(__file__), 'static', 'books', 'js', 'settings.js'),
            os.path.join(os.path.dirname(__file__), '..', 'frontend', 'js', 'settings.js')
        ]
        for p in paths:
            self.assertTrue(os.path.exists(p), f"File {p} does not exist")
            with open(p, 'r', encoding='utf-8') as f:
                content = f.read()

            # Escape key & modal backdrop handlers
            self.assertIn("e.key === 'Escape'", content)
            self.assertIn("e.target === modal", content)

            # Reset format pattern control
            self.assertIn('btnResetFormatPattern', content)
            self.assertIn('Reset to Default', content)

            # Dynamic field dropdown change listener
            self.assertIn("dynamicSelect.addEventListener('change'", content)
            self.assertIn("insertBtn.addEventListener('click', insertSelectedDynamicField)", content)

            # Button disabling while saving/loading
            self.assertIn("saveItemBtn.disabled = true", content)
            self.assertIn("saveBtn.disabled = true", content)
            self.assertIn("saveMetaBtn.disabled = true", content)
            self.assertIn("btn.textContent = 'Setting default...'", content)

    def test_activate_and_deactivate_series_synchronizes_all_child_document_series(self):
        """Toggling active status synchronizes both TransactionSeries and child DocumentNumberSeries."""
        # 1. Deactivate secondary series
        del_res = self.client.delete(f'/api/settings/transaction-series/{self.secondary_series.pk}/')
        self.assertEqual(del_res.status_code, 200)

        self.secondary_series.refresh_from_db()
        self.assertFalse(self.secondary_series.is_active)
        for item in DocumentNumberSeries.objects.filter(series_group=self.secondary_series):
            self.assertFalse(item.active)

        # 2. Reactivate secondary series via PUT { is_active: True }
        put_res = self.client.put(
            f'/api/settings/transaction-series/{self.secondary_series.pk}/',
            data=json.dumps({'is_active': True}),
            content_type='application/json'
        )
        self.assertEqual(put_res.status_code, 200)

        self.secondary_series.refresh_from_db()
        self.assertTrue(self.secondary_series.is_active)
        # All child DocumentNumberSeries must now be active!
        child_items = list(DocumentNumberSeries.objects.filter(series_group=self.secondary_series))
        self.assertGreater(len(child_items), 0)
        for item in child_items:
            self.assertTrue(item.active)

    def test_set_as_default_series_synchronizes_all_child_document_series(self):
        """Setting a series as default marks it and its items default, and clears previous defaults."""
        res = self.client.put(
            f'/api/settings/transaction-series/{self.secondary_series.pk}/',
            data=json.dumps({'is_default': True}),
            content_type='application/json'
        )
        self.assertEqual(res.status_code, 200)

        self.secondary_series.refresh_from_db()
        self.default_series.refresh_from_db()
        self.assertTrue(self.secondary_series.is_default)
        self.assertFalse(self.default_series.is_default)

        # Child items of secondary series are default
        for item in DocumentNumberSeries.objects.filter(series_group=self.secondary_series):
            self.assertTrue(item.is_default)

        # Child items of old default series are no longer default
        for item in DocumentNumberSeries.objects.filter(series_group=self.default_series):
            self.assertFalse(item.is_default)

    def test_cannot_deactivate_default_series(self):
        """Backend must reject deactivating the default series via DELETE or PUT."""
        res = self.client.delete(f'/api/settings/transaction-series/{self.default_series.pk}/')
        self.assertEqual(res.status_code, 400)
        self.assertIn('Cannot deactivate the default transaction series', res.json().get('error', ''))

        res_put = self.client.put(
            f'/api/settings/transaction-series/{self.default_series.pk}/',
            data=json.dumps({'is_active': False}),
            content_type='application/json'
        )
        self.assertEqual(res_put.status_code, 400)
        self.assertIn('Cannot deactivate the default transaction series', res_put.json().get('error', ''))

    def test_cannot_set_inactive_series_as_default(self):
        """Backend must reject setting an inactive series as default."""
        self.secondary_series.is_active = False
        self.secondary_series.save()
        res = self.client.put(
            f'/api/settings/transaction-series/{self.secondary_series.pk}/',
            data=json.dumps({'is_default': True}),
            content_type='application/json'
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn('inactive series cannot be set as the default', res.json().get('error', ''))

    def test_edit_series_meta_synchronizes_name_branch_and_location(self):
        """Updating series metadata synchronizes group attributes to all child DocumentNumberSeries."""
        payload = {
            'name': 'Ernakulam Central',
            'branch': 'Ernakulam North',
            'location': 'Ernakulam North'
        }
        res = self.client.put(
            f'/api/settings/transaction-series/{self.secondary_series.pk}/',
            data=json.dumps(payload),
            content_type='application/json'
        )
        self.assertEqual(res.status_code, 200)

        self.secondary_series.refresh_from_db()
        self.assertEqual(self.secondary_series.name, 'Ernakulam Central')
        self.assertEqual(self.secondary_series.branch, 'Ernakulam North')

        for item in DocumentNumberSeries.objects.filter(series_group=self.secondary_series):
            self.assertEqual(item.name, 'Ernakulam Central')
            self.assertEqual(item.branch, 'Ernakulam North')

    def test_configure_item_format_pattern_and_sequence(self):
        """Updating an individual item's prefix, format pattern, next sequence number and padding."""
        payload = {
            'items': [{
                'document_type': 'invoice',
                'prefix': 'INV-CORP',
                'format_pattern': 'INV-CORP/{CUSTOMERTYPE}/{FY}/{SEQUENCE}',
                'separator': '/',
                'next_number': 105,
                'padding': 6
            }]
        }
        res = self.client.put(
            f'/api/settings/transaction-series/{self.default_series.pk}/',
            data=json.dumps(payload),
            content_type='application/json'
        )
        self.assertEqual(res.status_code, 200)

        inv_item = DocumentNumberSeries.objects.filter(
            organization=self.org, series_group=self.default_series, document_type='invoices'
        ).first()
        self.assertIsNotNone(inv_item)
        self.assertEqual(inv_item.prefix, 'INV-CORP')
        self.assertEqual(inv_item.format_pattern, 'INV-CORP/{CUSTOMERTYPE}/{FY}/{SEQUENCE}')
        self.assertEqual(inv_item.next_number, 105)
        self.assertEqual(inv_item.padding, 6)

    def test_preview_endpoint_uses_saved_numbering_engine(self):
        payload = {
            'document_type': 'invoice',
            'prefix': 'INV',
            'format_pattern': 'INV/{CUSTOMERTYPE}/{FY}/{SEQUENCE}',
            'separator': '/',
            'next_number': 20,
            'padding': 3,
        }
        res = self.client.post(
            f'/api/settings/transaction-series/{self.default_series.pk}/preview/',
            data=json.dumps(payload),
            content_type='application/json'
        )
        self.assertEqual(res.status_code, 200)
        preview = res.json()['preview']['formatted']
        self.assertTrue(preview.startswith('INV/B2B/'))
        self.assertTrue(preview.endswith('/020'))

    def test_unsupported_placeholder_is_rejected(self):
        payload = {
            'items': [{
                'document_type': 'invoice',
                'format_pattern': 'INV/{NOTSUPPORTED}/{SEQUENCE}',
                'prefix': 'INV',
                'next_number': 1,
                'padding': 3,
            }]
        }
        res = self.client.put(
            f'/api/settings/transaction-series/{self.default_series.pk}/',
            data=json.dumps(payload),
            content_type='application/json'
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn('NOTSUPPORTED', res.json().get('error', ''))

    def test_create_new_series_via_post(self):
        """Creating a new series generates group and all child document number series."""
        payload = {
            'name': 'Calicut Retail',
            'branch': 'Calicut Mall',
            'location': 'Calicut Mall',
            'is_default': False,
            'is_active': True,
            'items': [
                {'document_type': 'invoice', 'prefix': 'CAL-INV', 'next_number': 1, 'padding': 4},
                {'document_type': 'bill', 'prefix': 'CAL-BILL', 'next_number': 1, 'padding': 4},
                {'document_type': 'customer_payment', 'prefix': 'CAL-PAY', 'next_number': 1, 'padding': 4},
                {'document_type': 'credit_note', 'prefix': 'CAL-CN', 'next_number': 1, 'padding': 4},
                {'document_type': 'delivery_challan', 'prefix': 'CAL-DC', 'next_number': 1, 'padding': 4},
                {'document_type': 'purchase_order', 'prefix': 'CAL-PO', 'next_number': 1, 'padding': 4},
            ]
        }
        res = self.client.post(
            '/api/settings/transaction-series/',
            data=json.dumps(payload),
            content_type='application/json'
        )
        self.assertEqual(res.status_code, 201)
        new_id = res.json()['id']

        new_grp = TransactionSeries.objects.filter(organization=self.org, pk=new_id).first()
        self.assertIsNotNone(new_grp)
        self.assertEqual(new_grp.name, 'Calicut Retail')
        self.assertEqual(
            DocumentNumberSeries.objects.filter(organization=self.org, series_group=new_grp).count(),
            len(services.SUPPORTED_TRANSACTION_TYPES)
        )

    def test_organization_isolation(self):
        """User cannot modify or access series belonging to other organizations."""
        other_series = TransactionSeries.objects.create(
            organization=self.other_org,
            name='Other Org Series',
            is_default=True,
            is_active=True
        )
        # Attempt to modify other org's series
        res = self.client.put(
            f'/api/settings/transaction-series/{other_series.pk}/',
            data=json.dumps({'is_active': False}),
            content_type='application/json'
        )
        self.assertEqual(res.status_code, 404)

        # Attempt to delete other org's series
        res_del = self.client.delete(f'/api/settings/transaction-series/{other_series.pk}/')
        self.assertEqual(res_del.status_code, 404)

import datetime
import json
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.db import transaction
from django.test import TestCase, Client
from django.utils import timezone

from books.models import (
    Organization, UserProfile, Branch, BusinessLocation, Warehouse,
    DocumentNumberSeries, DocumentNumberSeriesCounter, DocumentNumberAllocation,
    Customer, Vendor, Item, Invoice, Quote, SalesOrder, PurchaseOrder, Bill,
    StockTransfer, StockMovement
)
from books import services

User = get_user_model()


class BranchAndSeriesIntegrationTest(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(name='Convosis Corp', code='CONVO')
        self.user = User.objects.create_user(
            username='admin_test',
            email='admin@convosis.com',
            password='Password123!'
        )
        UserProfile.objects.create(
            user=self.user,
            organization=self.org,
            role=UserProfile.ADMIN,
            status=UserProfile.STATUS_ACTIVE
        )

        # Create primary head office branch
        self.head_office = BusinessLocation.objects.create(
            organization=self.org,
            name='Head Office',
            prefix='HO',
            location_type=BusinessLocation.LOCATION_TYPE_BUSINESS,
            is_default=True,
            state='Keralam',
            country='India',
            primary_contact=self.user
        )

        # Create a series for Head Office
        self.default_series = DocumentNumberSeries.objects.create(
            organization=self.org,
            name='Default Transaction Series',
            document_type='invoices',
            prefix='INV-{BRANCH}-{FY}-{SEQUENCE}',
            format_pattern='INV-{BRANCH}-{FY}-{SEQUENCE}',
            starting_number=1,
            next_number=1,
            padding=5,
            active=True,
            is_default=True,
            business_location=self.head_office
        )
        self.head_office.default_transaction_series = self.default_series
        self.head_office.transaction_series.add(self.default_series)
        self.head_office.save()

        # Create child branch series
        self.child_series = DocumentNumberSeries.objects.create(
            organization=self.org,
            name='Hanieal Series',
            document_type='invoices',
            prefix='INV-H-{SEQUENCE}',
            starting_number=1,
            next_number=1,
            padding=5,
            active=True,
            is_default=False,
            business_location=None
        )

        # Create child branch
        self.child_branch = BusinessLocation.objects.create(
            organization=self.org,
            name='Hanieal Branch',
            prefix='H',
            location_type=BusinessLocation.LOCATION_TYPE_BUSINESS,
            parent=self.head_office,
            is_default=False,
            state='Keralam',
            country='India',
            primary_contact=self.user
        )
        self.child_branch.transaction_series.add(self.child_series)
        self.child_branch.default_transaction_series = self.child_series
        self.child_branch.save()
        self.child_series.business_location = self.child_branch
        self.child_series.save()

        self.client = Client()
        self.client.force_login(self.user)

    def test_branch_edit_does_not_fail_with_outer_join_error(self):
        """Test editing a branch with parent and default_transaction_series succeeds without outer-join lock errors."""
        payload = {
            'location_type': 'business',
            'name': 'Hanieal Updated',
            'prefix': 'HU',
            'parent_id': self.head_office.pk,
            'primary_contact_id': self.user.pk,
            'transaction_series_ids': [self.child_series.pk],
            'default_transaction_series_id': self.child_series.pk,
            'state': 'Keralam',
            'country': 'India',
            'active': True,
            'is_default': False
        }
        response = self.client.put(
            f'/api/settings/branches/{self.child_branch.pk}/',
            data=payload,
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200, response.content.decode())
        self.child_branch.refresh_from_db()
        self.assertEqual(self.child_branch.name, 'Hanieal Updated')
        self.assertEqual(self.child_branch.prefix, 'HU')
        self.assertEqual(self.child_branch.parent, self.head_office)

    def test_head_office_payload_and_cannot_be_child_location(self):
        """Test Head Office payload returns is_head_office=True and rejects becoming a child location."""
        # Check GET payload
        res = self.client.get(f'/api/settings/branches/{self.head_office.pk}/')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data.get('is_head_office'))
        self.assertTrue(data.get('is_default'))
        self.assertEqual(data.get('default_transaction_series_name'), 'Default Transaction Series')

        # Attempt to make Head Office a child location should fail
        err_res = self.client.put(
            f'/api/settings/branches/{self.head_office.pk}/',
            data={
                'location_type': 'business',
                'name': 'Head Office',
                'prefix': 'HO',
                'parent_id': self.child_branch.pk,
                'primary_contact_id': self.user.pk,
                'transaction_series_ids': [self.default_series.pk],
                'default_transaction_series_id': self.default_series.pk,
                'active': True,
                'is_default': True
            },
            content_type='application/json'
        )
        self.assertEqual(err_res.status_code, 400)
        self.assertIn('cannot be a child location', err_res.json().get('error', ''))

    def test_transaction_series_all_eight_placeholders(self):
        """Test format pattern with {CUSTOMERTYPE}, {LOCATION}, {FY}, {ORG}, {BRANCH}, {YEAR}, {MONTH}, {SEQUENCE}."""
        series = DocumentNumberSeries.objects.create(
            organization=self.org,
            name='All Placeholders Series',
            document_type='invoices',
            format_pattern='{ORG}/{BRANCH}/{LOCATION}/{CUSTOMERTYPE}/{FY}/{YEAR}/{MONTH}/{SEQUENCE}',
            starting_number=1,
            next_number=1,
            padding=4,
            active=True,
            b2b_prefix='B2B',
            b2c_prefix='B2C',
            business_location=self.child_branch
        )

        customer = Customer.objects.create(
            organization=self.org,
            name='Acme Corp',
            customer_type='business',
            gstin='32AAAAA0000A1Z5'
        )

        num = services.next_document_number(
            'INV',
            org=self.org,
            date=datetime.date(2026, 11, 26),
            series_id=series.pk,
            business_location_id=self.child_branch.pk,
            party=customer
        )

        # Expected:
        # ORG: CONVO
        # BRANCH: H
        # LOCATION: HANIEAL-BRANCH
        # CUSTOMERTYPE: B2B
        # FY: 26-27 or 2026-27
        # YEAR: 2026
        # MONTH: 11
        # SEQUENCE: 0001
        self.assertIn('CONVO', num)
        self.assertIn('/H/', num)
        self.assertIn('B2B', num)
        self.assertIn('/2026/11/0001', num)

        # Generating again increments sequence to 0002 without duplicate
        num2 = services.next_document_number(
            'INV',
            org=self.org,
            date=datetime.date(2026, 11, 26),
            series_id=series.pk,
            business_location_id=self.child_branch.pk,
            party=customer
        )
        self.assertIn('/2026/11/0002', num2)
        self.assertNotEqual(num, num2)

    def test_branch_listing_includes_head_office_and_series_name(self):
        """Test listing branches returns Head Office flag and default series name."""
        res = self.client.get('/api/settings/branches/')
        self.assertEqual(res.status_code, 200)
        locations = res.json().get('locations', [])
        ho = next((loc for loc in locations if loc['id'] == self.head_office.pk), None)
        self.assertIsNotNone(ho)
        self.assertTrue(ho['is_head_office'])
        self.assertTrue(ho['is_default'])
        self.assertEqual(ho['default_transaction_series_name'], 'Default Transaction Series')

    def test_default_branch_fallback_for_branch_placeholder(self):
        """Test that when no branch is explicitly passed, {BRANCH} resolves to Head Office prefix instead of generic HQ."""
        series = DocumentNumberSeries.objects.create(
            organization=self.org,
            name='Org Default Series',
            document_type='invoices',
            format_pattern='INV-{BRANCH}-{SEQUENCE}',
            starting_number=1,
            next_number=1,
            padding=3,
            active=True
        )
        num = services.next_document_number('INV', org=self.org, series_id=series.pk)
        # Head office has prefix 'HO'
        self.assertEqual(num, 'INV-HO-001')

    def test_cross_module_branch_prefix_propagation(self):
        """Test branch prefix is dynamically used across invoices, quotes, sales orders, bills, and stock transfers."""
        # Set up series with {BRANCH} placeholder for various modules
        for mod, doc_type in [
            ('INV', 'invoices'),
            ('QT', 'quotes'),
            ('SO', 'sales_orders'),
            ('BILL', 'bills'),
            ('PO', 'purchase_orders'),
            ('DC', 'delivery_challans'),
            ('ST', 'stock_transfers')
        ]:
            s = DocumentNumberSeries.objects.create(
                organization=self.org,
                name=f'{mod} Series',
                document_type=doc_type,
                format_pattern=f'{mod}/{{BRANCH}}/{{SEQUENCE}}',
                starting_number=1,
                next_number=1,
                padding=3,
                active=True,
                business_location=self.child_branch
            )
            generated = services.next_document_number(
                mod,
                org=self.org,
                series_id=s.pk,
                business_location_id=self.child_branch.pk
            )
            # Child branch prefix is 'H'
            self.assertEqual(generated, f'{mod}/H/001')

    def test_customer_type_prefix_in_invoice_number_and_persistence(self):
        """
        Verify that {BRANCH}{CUSTOMERTYPE}-{SEQUENCE} pattern:
        - Resolves B2B prefix 'B' to HOB-0000021 for Head Office
        - Resolves B2C prefix 'C' to HOC-0000021 (or next sequence)
        - Dynamically reflects branch change (TVM) -> TVMB-..., TVMC-...
        - Connects preview with actual number generation and database persistence
        - Requires customer type when pattern contains {CUSTOMERTYPE}
        """
        series = DocumentNumberSeries.objects.filter(
            organization=self.org,
            document_type='invoices',
            is_default=True
        ).first()
        series.prefix = '{BRANCH}{CUSTOMERTYPE}'
        series.b2b_prefix = 'B'
        series.b2c_prefix = 'C'
        series.format_pattern = '{BRANCH}{CUSTOMERTYPE}-{SEQUENCE}'
        series.separator = '-'
        series.next_number = 21
        series.starting_number = 1
        series.padding = 7
        series.business_location = None
        series.save()

        DocumentNumberSeriesCounter.objects.filter(series=series).delete()

        # 1. Preview without customer when pattern has {CUSTOMERTYPE} -> requires_customer_type=True, next_number=''
        prev_no_cust = self.client.get('/api/lookup/next-invoice-number/')
        self.assertEqual(prev_no_cust.status_code, 200)
        self.assertTrue(prev_no_cust.json().get('requires_customer_type'))
        self.assertEqual(prev_no_cust.json().get('next_number'), '')

        # 2. Create B2B Customer (Bharat Solutions) and B2C Customer
        b2b_cust = Customer.objects.create(
            organization=self.org,
            name='Bharat Solutions',
            customer_type='business',
            gstin='08AAAAA0000A1Z5'
        )
        b2c_cust = Customer.objects.create(
            organization=self.org,
            name='Individual Consumer',
            customer_type='individual'
        )

        # 3. Preview with B2B Customer -> HOB-0000021
        prev_b2b = self.client.get(f'/api/lookup/next-invoice-number/?customer_id={b2b_cust.pk}&business_location_id={self.head_office.pk}')
        self.assertEqual(prev_b2b.status_code, 200)
        self.assertEqual(prev_b2b.json().get('next_number'), 'HOB-0000021')

        # 4. Preview with B2C Customer -> HOC-0000021
        prev_b2c = self.client.get(f'/api/lookup/next-invoice-number/?customer_id={b2c_cust.pk}&business_location_id={self.head_office.pk}')
        self.assertEqual(prev_b2c.status_code, 200)
        self.assertEqual(prev_b2c.json().get('next_number'), 'HOC-0000021')

        # 5. Create actual Invoice via API for B2B -> HOB-0000021 saved to DB
        inv_payload = {
            'customer': b2b_cust.pk,
            'business_location_id': self.head_office.pk,
            'transaction_series': series.name,
            'date': '2026-11-27',
            'due_date': '2026-12-27',
            'status': 'draft',
            'lines': [
                {
                    'description': 'Consulting Service',
                    'quantity': 1,
                    'rate': 1000,
                    'gst_rate': 18
                }
            ]
        }
        res_create = self.client.post('/api/invoices/', data=json.dumps(inv_payload), content_type='application/json')
        self.assertEqual(res_create.status_code, 201, res_create.content)
        created_inv = res_create.json()
        self.assertEqual(created_inv['number'], 'HOB-0000021')

        # Verify in DB
        db_inv = Invoice.objects.get(pk=created_inv['id'])
        self.assertEqual(db_inv.number, 'HOB-0000021')

        # 6. Branch change to TVM
        branch_tvm = Branch.objects.create(
            organization=self.org,
            name='Thiruvananthapuram Branch',
            prefix='TVM'
        )

        num_tvm_b2b = services.next_document_number(
            'INV',
            org=self.org,
            party=b2b_cust,
            business_location_id=branch_tvm.pk,
            series_id=series.pk
        )
        self.assertTrue(num_tvm_b2b.startswith('TVMB-'))

        num_tvm_b2c = services.next_document_number(
            'INV',
            org=self.org,
            party=b2c_cust,
            business_location_id=branch_tvm.pk,
            series_id=series.pk
        )
        self.assertTrue(num_tvm_b2c.startswith('TVMC-'))

        # 7. Pattern change to INV/{SEQUENCE}
        series.format_pattern = 'INV/{SEQUENCE}'
        series.save()
        num_pat1 = services.next_document_number(
            'INV',
            org=self.org,
            party=b2b_cust,
            series_id=series.pk
        )
        self.assertTrue(num_pat1.startswith('INV/'))

        # 8. Pattern change to INV/{CUSTOMERTYPE}/{SEQUENCE}
        series.format_pattern = 'INV/{CUSTOMERTYPE}/{SEQUENCE}'
        series.save()
        num_pat2 = services.next_document_number(
            'INV',
            org=self.org,
            party=b2b_cust,
            series_id=series.pk
        )
        self.assertTrue(num_pat2.startswith('INV/B/'))

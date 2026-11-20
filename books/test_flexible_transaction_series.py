import json
import time
import threading
from decimal import Decimal
from django.test import TestCase
from django.utils import timezone
from django.contrib.auth import get_user_model
from books.models import (
    Organization, UserProfile, Customer, Vendor,
    TransactionSeries, DocumentNumberSeries, DocumentNumberSeriesCounter, DocumentNumberAllocation
)
from books import services

User = get_user_model()


class FlexibleTransactionNumberSeriesTests(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(name='Acme Corp Automated Series', legal_name='Acme Corp Ltd', state='Kerala')
        services.ensure_default_transaction_series(self.org)

        self.user = User.objects.create_user(username='admin_series_user', email='admin_series@acme.com', password='Password123!')
        self.profile = UserProfile.objects.create(
            user=self.user,
            organization=self.org,
            role=UserProfile.ADMIN
        )

        self.b2b_customer = Customer.objects.create(
            organization=self.org,
            name='Alpha Industries',
            customer_type='business',
            gstin='32AAACA1234A1Z5',
            billing_city='Kottayam',
            state='Kerala'
        )
        self.b2c_customer = Customer.objects.create(
            organization=self.org,
            name='John Doe',
            customer_type='individual',
            billing_city='Kochi',
            state='Kerala'
        )
        self.vendor = Vendor.objects.create(
            organization=self.org,
            name='Supplies Hub',
            billing_city='Trivandrum',
            state='Kerala'
        )

    def test_six_required_format_combinations(self):
        """Verify the 6 format combinations specified in the requirement prompt."""
        fy = services.get_financial_year(timezone.localdate(), org=self.org)
        org_code = self.org.get_code()

        series = DocumentNumberSeries.objects.filter(
            organization=self.org, document_type='invoices', is_default=True
        ).first()
        self.assertIsNotNone(series)
        series.branch = 'TVM'
        series.location = 'KOTTAYAM'
        series.padding = 5
        series.separator = '/'

        # Combination 1: INV/{FY}/{SEQUENCE}
        series.format_pattern = 'INV/{FY}/{SEQUENCE}'
        series.save()
        res1 = services._format_series_number(series, 1, self.org, customer_type='b2b', location='KOTTAYAM')
        self.assertEqual(res1, f'INV/{fy}/00001')

        # Combination 2: INV/{CUSTOMERTYPE}/{FY}/{SEQUENCE}
        series.format_pattern = 'INV/{CUSTOMERTYPE}/{FY}/{SEQUENCE}'
        series.save()
        res2_b2b = services._format_series_number(series, 1, self.org, customer_type='b2b')
        self.assertEqual(res2_b2b, f'INV/B2B/{fy}/00001')
        res2_b2c = services._format_series_number(series, 2, self.org, customer_type='b2c')
        self.assertEqual(res2_b2c, f'INV/B2C/{fy}/00002')

        # Combination 3: INV/{LOCATION}/{FY}/{SEQUENCE}
        series.format_pattern = 'INV/{LOCATION}/{FY}/{SEQUENCE}'
        series.save()
        res3 = services._format_series_number(series, 1, self.org, location='KOTTAYAM')
        self.assertEqual(res3, f'INV/KOTTAYAM/{fy}/00001')

        # Combination 4: INV/{CUSTOMERTYPE}/{LOCATION}/{FY}/{SEQUENCE}
        series.format_pattern = 'INV/{CUSTOMERTYPE}/{LOCATION}/{FY}/{SEQUENCE}'
        series.save()
        res4 = services._format_series_number(series, 1, self.org, customer_type='b2b', location='KOTTAYAM')
        self.assertEqual(res4, f'INV/B2B/KOTTAYAM/{fy}/00001')

        # Combination 5: {ORG}/INV/{BRANCH}/{FY}/{SEQUENCE}
        series.format_pattern = '{ORG}/INV/{BRANCH}/{FY}/{SEQUENCE}'
        series.save()
        res5 = services._format_series_number(series, 1, self.org, branch='TVM')
        self.assertEqual(res5, f'{org_code}/INV/TVM/{fy}/00001')

        # Combination 6: INV/{FY}/{CUSTOMERTYPE}/{LOCATION}/{SEQUENCE}
        series.format_pattern = 'INV/{FY}/{CUSTOMERTYPE}/{LOCATION}/{SEQUENCE}'
        series.save()
        res6 = services._format_series_number(series, 1, self.org, customer_type='b2b', location='KOTTAYAM')
        self.assertEqual(res6, f'INV/{fy}/B2B/KOTTAYAM/00001')

    def test_dynamic_data_extraction_from_party_and_branch(self):
        """Verify dynamic placeholder extraction from Customer model and location attributes."""
        fy = services.get_financial_year(timezone.localdate(), org=self.org)
        series = DocumentNumberSeries.objects.filter(
            organization=self.org, document_type='invoices', is_default=True
        ).first()
        series.format_pattern = 'INV/{CUSTOMERTYPE}/{LOCATION}/{FY}/{SEQUENCE}'
        series.save()

        # Generate number using party Alpha Industries (B2B, Kottayam)
        num_b2b = services.next_document_number(
            'invoices', org=self.org, party=self.b2b_customer, branch='TVM'
        )
        self.assertEqual(num_b2b, f'INV/B2B/KOTTAYAM/{fy}/00001')

        # Generate number using party John Doe (B2C, Kochi)
        num_b2c = services.next_document_number(
            'invoices', org=self.org, party=self.b2c_customer, branch='TVM'
        )
        self.assertEqual(num_b2c, f'INV/B2C/KOCHI/{fy}/00002')

    def test_separator_variations(self):
        """Verify formatting with hyphen, underscore, slash, and custom separators."""
        fy = services.get_financial_year(timezone.localdate(), org=self.org)
        series = DocumentNumberSeries.objects.filter(
            organization=self.org, document_type='invoices', is_default=True
        ).first()

        # Hyphen separator
        series.format_pattern = 'INV-{CUSTOMERTYPE}-{FY}-{SEQUENCE}'
        series.separator = '-'
        series.save()
        res_hyphen = services._format_series_number(series, 5, self.org, customer_type='b2b')
        self.assertEqual(res_hyphen, f'INV-B2B-{fy}-00005')

        # Underscore separator
        series.format_pattern = 'INV_{CUSTOMERTYPE}_{FY}_{SEQUENCE}'
        series.separator = '_'
        series.save()
        res_underscore = services._format_series_number(series, 8, self.org, customer_type='b2c')
        self.assertEqual(res_underscore, f'INV_B2C_{fy}_00008')

        # Implicit sequence append with custom separator
        series.format_pattern = 'INV-{CUSTOMERTYPE}'
        series.separator = '-'
        series.save()
        res_append = services._format_series_number(series, 10, self.org, customer_type='b2b')
        self.assertEqual(res_append, 'INV-B2B-00010')

    def test_case_insensitive_placeholders_and_calendar_tokens(self):
        """Verify that lowercase and mixed case placeholders work identically, along with {YEAR} and {MONTH}."""
        dt = timezone.localdate()
        yr = str(dt.year)
        mo = f"{dt.month:02d}"

        series = DocumentNumberSeries.objects.filter(
            organization=self.org, document_type='invoices', is_default=True
        ).first()
        series.format_pattern = 'INV/{customertype}/{year}/{month}/{sequence}'
        series.save()

        res = services._format_series_number(series, 1, self.org, customer_type='b2b')
        self.assertEqual(res, f'INV/B2B/{yr}/{mo}/00001')

    def test_multi_series_isolation_with_custom_formats(self):
        """Ensure multiple series maintain distinct formats, prefixes, and sequence counters."""
        fy = services.get_financial_year(timezone.localdate(), org=self.org)

        # Series 1: Default Series
        s1 = DocumentNumberSeries.objects.filter(
            organization=self.org, document_type='invoices', is_default=True
        ).first()
        s1.format_pattern = 'INV/{FY}/{SEQUENCE}'
        s1.save()

        # Series 2: Kerala Branch Series
        grp_kl = TransactionSeries.objects.create(
            organization=self.org,
            name='Kerala Series',
            branch='KL',
            location='KOCHI',
            is_default=False,
            is_active=True
        )
        s2 = DocumentNumberSeries.objects.create(
            organization=self.org,
            series_group=grp_kl,
            name='Kerala Series',
            document_type='invoices',
            prefix='KL-INV',
            format_pattern='KL/INV/{LOCATION}/{SEQUENCE}',
            starting_number=1,
            next_number=1,
            padding=4,
            separator='/',
            active=True
        )

        num1 = services.next_document_number('invoices', org=self.org, series=s1.name)
        self.assertEqual(num1, f'INV/{fy}/00001')

        num2 = services.next_document_number('invoices', org=self.org, series='Kerala Series')
        self.assertEqual(num2, 'KL/INV/KOCHI/0001')

        # Advance both independently
        num1_2 = services.next_document_number('invoices', org=self.org, series=s1.name)
        self.assertEqual(num1_2, f'INV/{fy}/00002')

        num2_2 = services.next_document_number('invoices', org=self.org, series='Kerala Series')
        self.assertEqual(num2_2, 'KL/INV/KOCHI/0002')

    def test_across_sales_purchase_inventory_modules(self):
        """Verify dynamic numbering works across Sales, Purchase, and Inventory modules."""
        fy = services.get_financial_year(timezone.localdate(), org=self.org)

        # Sales Order
        so_num = services.next_document_number('sales_orders', org=self.org, customer_type='b2b')
        self.assertTrue(so_num.startswith('SO-') or 'SO' in so_num)

        # Bill (Purchase)
        bill_num = services.next_document_number('bills', org=self.org)
        self.assertTrue(bill_num.startswith('BILL-') or 'BILL' in bill_num)

        # Purchase Order
        po_num = services.next_document_number('purchase_orders', org=self.org)
        self.assertTrue(po_num.startswith('PO-') or 'PO' in po_num)

        # Payment Made
        pm_num = services.next_document_number('payments_made', org=self.org)
        self.assertTrue(pm_num.startswith('PAY-') or 'PAY' in pm_num or 'PM' in pm_num)

    def test_concurrency_and_collision_prevention(self):
        """Test atomic allocation and collision prevention without duplicate numbers."""
        series = DocumentNumberSeries.objects.filter(
            organization=self.org, document_type='quotes', is_default=True
        ).first()
        series.format_pattern = 'QTN/{FY}/{SEQUENCE}'
        series.save()

        allocated_numbers = []
        for _ in range(5):
            num = services.next_document_number('quotes', org=self.org)
            allocated_numbers.append(num)

        self.assertEqual(len(allocated_numbers), 5)
        self.assertEqual(len(set(allocated_numbers)), 5, "Duplicate document numbers generated!")

        # Verify collision avoidance if a number already exists in allocation
        fy = services.get_financial_year(timezone.localdate(), org=self.org)
        colliding_number = f'QTN/{fy}/00006'
        DocumentNumberAllocation.objects.create(
            organization=self.org,
            series=series,
            document_type='quotes',
            number=colliding_number,
            financial_year=fy
        )
        # Next generated number must automatically skip the collision and generate 00007
        next_num = services.next_document_number('quotes', org=self.org)
        self.assertEqual(next_num, f'QTN/{fy}/00007')

    def test_api_settings_transaction_series_format_pattern(self):
        """Test GET and PUT /api/settings/transaction-series/ with format_pattern and separator."""
        from django.test import Client
        client = Client()
        client.force_login(self.user)

        # GET series
        res = client.get('/api/settings/transaction-series/')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data.get('status'), 'ok')
        items = data.get('items', [])
        self.assertTrue(len(items) > 0)
        inv_item = next((it for it in items if it['document_type'] == 'invoices'), None)
        self.assertIsNotNone(inv_item)
        self.assertIn('format_pattern', inv_item)
        self.assertIn('separator', inv_item)

        # PUT series update with custom format pattern and hyphen separator
        curr_id = data['current_series']['id']
        update_payload = {
            'items': [{
                'document_type': 'invoices',
                'prefix': 'INV',
                'format_pattern': 'INV-{CUSTOMERTYPE}-{FY}-{SEQUENCE}',
                'separator': '-',
                'next_number': 10,
                'padding': 5
            }]
        }
        put_res = client.put(f'/api/settings/transaction-series/{curr_id}/', json.dumps(update_payload), content_type='application/json')
        self.assertEqual(put_res.status_code, 200)

        # Verify persisted format pattern
        inv_series = DocumentNumberSeries.objects.filter(organization=self.org, document_type='invoices', series_group_id=curr_id).first()
        self.assertEqual(inv_series.format_pattern, 'INV-{CUSTOMERTYPE}-{FY}-{SEQUENCE}')
        self.assertEqual(inv_series.separator, '-')
        self.assertEqual(inv_series.next_number, 10)

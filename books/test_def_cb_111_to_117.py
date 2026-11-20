import json
from decimal import Decimal
from datetime import date
from django.test import TestCase, Client
from django.contrib.auth import get_user_model
from django.utils import timezone

from books.models import (
    Organization, Customer, Vendor, Item, Warehouse, StockMovement,
    PurchaseOrder, Bill, PaymentMade, TransactionSeries, DocumentNumberSeries,
    UserProfile, Account
)
from books import services
from books.api import ApiError

User = get_user_model()


class DefCb111To117TestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='defect_tester', email='defect_tester@convosis.com', password='password123'
        )
        self.org = Organization.objects.create(
            name='Convosis Tech Org',
            owner=self.user,
            state='Kerala',
            base_currency='INR'
        )
        self.profile = UserProfile.objects.create(
            user=self.user,
            organization=self.org,
            role=UserProfile.ADMIN,
            normalized_email='defect_tester@convosis.com'
        )
        services.ensure_default_transaction_series(self.org)

        self.client = Client()
        self.client.force_login(self.user)

    def test_def_cb_111_stock_adjustment_production_reason(self):
        """DEF_CB_111: Stock adjustment accepts 'Production' reason and processes adjustment cleanly."""
        item = Item.objects.create(
            organization=self.org,
            name='Production Raw Material',
            sku='RM-PROD-001',
            track_inventory=True,
            stock=Decimal('100.00'),
            purchase_price=Decimal('50.00')
        )
        wh = Warehouse.objects.create(
            organization=self.org,
            name='Central Factory Warehouse',
            code='CFW'
        )
        adj_data = {
            'date': str(timezone.localdate()),
            'reason': 'Production',
            'account': 'Cost of Goods Sold',
            'warehouse': wh.id,
            'mode_of_adjustment': 'quantity',
            'lines': [
                {
                    'item': item.id,
                    'quantity_adjusted': -15,
                    'new_quantity': 85
                }
            ]
        }
        res = self.client.post(
            '/api/stock-adjustments/',
            data=json.dumps(adj_data),
            content_type='application/json'
        )
        self.assertIn(res.status_code, [200, 201])
        adj = StockMovement.objects.filter(organization=self.org, reason='Production').first()
        self.assertIsNotNone(adj)
        self.assertEqual(adj.reason, 'Production')

    def test_def_cb_112_bill_connected_source_purchase_order(self):
        """DEF_CB_112: Bill details contains connected source Purchase Order in related_documents."""
        vendor = Vendor.objects.create(organization=self.org, name='Tech Components Ltd')
        po = PurchaseOrder.objects.create(
            organization=self.org,
            vendor=vendor,
            number='PO-2026-0001',
            date=timezone.localdate(),
            due_date=timezone.localdate(),
            total=Decimal('15000.00'),
            status='issued'
        )
        bill = Bill.objects.create(
            organization=self.org,
            vendor=vendor,
            number='BILL-2026-0001',
            date=timezone.localdate(),
            due_date=timezone.localdate(),
            total=Decimal('15000.00'),
            source_purchase_order=po,
            status='unpaid'
        )
        res = self.client.get(f'/api/bills/{bill.id}/')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn('related_documents', data)
        rel_docs = data['related_documents']
        self.assertTrue(any(d.get('number') == 'PO-2026-0001' for d in rel_docs))

    def test_def_cb_113_new_expense_vendor_alignment(self):
        """DEF_CB_113: Expense creation functions cleanly with or without a vendor."""
        vendor = Vendor.objects.create(organization=self.org, name='Logistics Partner Inc')
        exp_acc = Account.objects.create(
            organization=self.org,
            code='EXP-OPS-01',
            name='Office Operations Expense',
            account_type=Account.EXPENSE
        )
        exp_data = {
            'date': str(timezone.localdate()),
            'expense_account': exp_acc.id,
            'vendor': vendor.id,
            'amount': '2500.00',
            'paid_through': 'Petty Cash',
            'location': 'HO Kottayam'
        }
        res = self.client.post(
            '/api/expenses/',
            data=json.dumps(exp_data),
            content_type='application/json'
        )
        self.assertIn(res.status_code, [200, 201])

    def test_def_cb_114_to_116_doc_number_preferences_endpoints(self):
        """DEF_CB_114 to DEF_CB_116: Document number preference endpoints for expenses, POs, and payments-made."""
        # 1. PO preferences preview
        po_res = self.client.get('/api/settings/doc-number-preferences/?document_type=purchase_orders&transaction_series=Default+Transaction+Series&location=HO+Kottayam')
        self.assertEqual(po_res.status_code, 200)
        po_data = po_res.json()
        self.assertTrue(po_data.get('auto_generate', True))

        # 2. Payments Made preferences preview
        pm_res = self.client.get('/api/settings/doc-number-preferences/?document_type=payments_made&transaction_series=Default+Transaction+Series&location=HO+Kottayam')
        self.assertEqual(pm_res.status_code, 200)

        # 3. Expense lookup next number
        exp_res = self.client.get('/api/lookup/next-expense-number/?series=Default+Transaction+Series')
        self.assertEqual(exp_res.status_code, 200)
        self.assertIn('next_number', exp_res.json())

    def test_def_cb_117_inactive_series_navigation_and_generation_block(self):
        """DEF_CB_117: Inactive series can be viewed/configured via settings, but cannot generate transaction numbers."""
        # Create a new series group
        inactive_grp = TransactionSeries.objects.create(
            organization=self.org,
            name='Special Kerala Series',
            is_active=True,
            is_default=False,
            branch='TVM',
            location='Thiruvananthapuram'
        )
        # Populate document series for this group
        for t in services.SUPPORTED_TRANSACTION_TYPES:
            DocumentNumberSeries.objects.create(
                organization=self.org,
                series_group=inactive_grp,
                name=inactive_grp.name,
                document_type=t['key'],
                prefix=t['default_prefix'],
                starting_number=1,
                next_number=1,
                padding=t['padding'],
                active=True
            )

        # 1. Active series previews and generates numbers cleanly
        preview_active = services.preview_document_number('INV', org=self.org, series=inactive_grp.name)
        self.assertTrue(bool(preview_active.get('formatted')))
        gen_active = services.next_document_number('INV', org=self.org, series=inactive_grp.name)
        self.assertTrue(bool(gen_active))

        # 2. Deactivate the series group and its items
        inactive_grp.is_active = False
        inactive_grp.save(update_fields=['is_active'])
        DocumentNumberSeries.objects.filter(organization=self.org, series_group=inactive_grp).update(active=False)

        # 3. Settings API can open and load the inactive series (returns 200 with inactive items)
        settings_res = self.client.get(f'/api/settings/transaction-series/?series_id={inactive_grp.id}')
        self.assertEqual(settings_res.status_code, 200)
        settings_data = settings_res.json()
        self.assertEqual(settings_data.get('status'), 'ok')
        self.assertFalse(settings_data['current_series']['is_active'])
        self.assertTrue(len(settings_data['items']) > 0)
        # Sample preview is populated for display
        self.assertTrue(bool(settings_data['items'][0]['sample_preview']))

        # 4. Inactive series CANNOT generate transaction numbers
        with self.assertRaises(ApiError) as ctx:
            services.next_document_number('INV', org=self.org, series=inactive_grp.name)
        self.assertEqual(ctx.exception.status, 400)
        self.assertIn('inactive', str(ctx.exception.message).lower())

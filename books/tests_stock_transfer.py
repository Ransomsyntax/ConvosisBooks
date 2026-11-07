from decimal import Decimal
from django.test import TestCase
from django.utils import timezone
from django.contrib.auth import get_user_model
from django.db.models import ProtectedError

from books.models import (
    Organization, Warehouse, Item, StockMovement,
    StockTransfer, StockTransferLine, AuditLog
)
from books import services
from books.cleaning import ApiError

User = get_user_model()

class StockTransferTestCase(TestCase):
    def setUp(self):
        self.org = Organization.get()
        self.user = User.objects.create_user(username='testinvuser', password='password123')
        
        # Create two warehouses
        self.wh_source = Warehouse.objects.create(
            organization=self.org,
            name='Central Depot',
            code='WH-CENTRAL',
            active=True
        )
        self.wh_dest = Warehouse.objects.create(
            organization=self.org,
            name='Retail Outlet',
            code='WH-RETAIL',
            active=True
        )
        self.wh_inactive = Warehouse.objects.create(
            organization=self.org,
            name='Closed Warehouse',
            code='WH-CLOSED',
            active=False
        )

        # Create goods item with initial stock in wh_source
        self.item = Item.objects.create(
            organization=self.org,
            name='Industrial Bolt Box',
            sku='SKU-BOLT-01',
            item_type='goods',
            track_inventory=True,
            warehouse=self.wh_source,
            warehouse_code=self.wh_source.code,
            selling_price=Decimal('150.00'),
            purchase_price=Decimal('80.00'),
            stock=Decimal('100.000'),
            unit='box'
        )
        # Create opening movement in wh_source
        StockMovement.objects.create(
            organization=self.org,
            item=self.item,
            date=timezone.localdate(),
            warehouse=self.wh_source,
            warehouse_code=self.wh_source.code,
            kind='opening',
            reference='INIT',
            change=Decimal('100.000'),
            balance_after=Decimal('100.000'),
            created_by=self.user
        )

    def test_warehouse_stock_lookup(self):
        src_stock = services.get_item_warehouse_stock(self.item, self.wh_source.code, org=self.org)
        dst_stock = services.get_item_warehouse_stock(self.item, self.wh_dest.code, org=self.org)
        self.assertEqual(src_stock, Decimal('100.000'))
        self.assertEqual(dst_stock, Decimal('0.000'))

    def test_same_warehouse_transfer_rejected(self):
        data = {
            'source_warehouse': self.wh_source.pk,
            'destination_warehouse': self.wh_source.pk,
            'lines': [{'item': self.item.pk, 'quantity': '10'}]
        }
        with self.assertRaises(ApiError) as cm:
            services.create_stock_transfer(data, self.user)
        self.assertIn('different', str(cm.exception).lower())

    def test_inactive_warehouse_rejected(self):
        data = {
            'source_warehouse': self.wh_source.pk,
            'destination_warehouse': self.wh_inactive.pk,
            'lines': [{'item': self.item.pk, 'quantity': '10'}]
        }
        with self.assertRaises(ApiError) as cm:
            services.create_stock_transfer(data, self.user)
        self.assertIn('inactive', str(cm.exception).lower())

    def test_create_draft_transfer_does_not_affect_stock(self):
        data = {
            'date': timezone.localdate().isoformat(),
            'source_warehouse': self.wh_source.pk,
            'destination_warehouse': self.wh_dest.pk,
            'notes': 'Test internal transfer',
            'lines': [
                {'item': self.item.pk, 'quantity': '25.000', 'unit': 'box', 'batch_number': 'B-99'}
            ]
        }
        transfer = services.create_stock_transfer(data, self.user)
        self.assertEqual(transfer.status, 'draft')
        self.assertEqual(transfer.lines.count(), 1)
        
        # Stock should remain unchanged while in draft
        self.assertEqual(services.get_item_warehouse_stock(self.item, self.wh_source.code, org=self.org), Decimal('100.000'))
        self.assertEqual(services.get_item_warehouse_stock(self.item, self.wh_dest.code, org=self.org), Decimal('0.000'))

    def test_confirm_transfer_exceeding_stock_fails(self):
        data = {
            'source_warehouse': self.wh_source.pk,
            'destination_warehouse': self.wh_dest.pk,
            'lines': [
                {'item': self.item.pk, 'quantity': '150.000', 'unit': 'box'}
            ]
        }
        transfer = services.create_stock_transfer(data, self.user)
        with self.assertRaises(ApiError) as cm:
            services.confirm_stock_transfer(transfer.pk, self.user)
        self.assertIn('insufficient stock', str(cm.exception).lower())

    def test_confirm_transfer_executes_stock_movement_and_audit(self):
        data = {
            'source_warehouse': self.wh_source.pk,
            'destination_warehouse': self.wh_dest.pk,
            'lines': [
                {'item': self.item.pk, 'quantity': '30.000', 'unit': 'box'}
            ]
        }
        transfer = services.create_stock_transfer(data, self.user)
        confirmed = services.confirm_stock_transfer(transfer.pk, self.user)
        
        self.assertEqual(confirmed.status, 'confirmed')
        self.assertIsNotNone(confirmed.confirmed_at)
        self.assertEqual(confirmed.confirmed_by, self.user)

        # Source should have 70, Destination should have 30
        src_stock = services.get_item_warehouse_stock(self.item, self.wh_source.code, org=self.org)
        dst_stock = services.get_item_warehouse_stock(self.item, self.wh_dest.code, org=self.org)
        self.assertEqual(src_stock, Decimal('70.000'))
        self.assertEqual(dst_stock, Decimal('30.000'))

        # Prevent duplicate confirmation
        with self.assertRaises(ApiError):
            services.confirm_stock_transfer(confirmed.pk, self.user)

        # Audit log verification
        audit = AuditLog.objects.filter(entity_type='StockTransfer', entity_id=str(confirmed.pk), action='confirm').first()
        self.assertIsNotNone(audit)
        self.assertEqual(audit.username, 'testinvuser')

    def test_strict_no_delete_allowed(self):
        data = {
            'source_warehouse': self.wh_source.pk,
            'destination_warehouse': self.wh_dest.pk,
            'lines': [{'item': self.item.pk, 'quantity': '10.000', 'unit': 'box'}]
        }
        transfer = services.create_stock_transfer(data, self.user)
        with self.assertRaises(ProtectedError):
            transfer.delete()

    def test_reverse_transfer_restores_stock_and_creates_linked_reversal(self):
        data = {
            'source_warehouse': self.wh_source.pk,
            'destination_warehouse': self.wh_dest.pk,
            'lines': [{'item': self.item.pk, 'quantity': '40.000', 'unit': 'box'}]
        }
        transfer = services.create_stock_transfer(data, self.user)
        services.confirm_stock_transfer(transfer.pk, self.user)

        # Destination stock is 40. Now reverse it.
        reversed_tr = services.reverse_stock_transfer(transfer.pk, self.user, reason='Wrong destination entered')
        self.assertEqual(reversed_tr.status, 'reversed')
        self.assertEqual(reversed_tr.reversal_reason, 'Wrong destination entered')
        self.assertIsNotNone(reversed_tr.reversal_transfer)
        self.assertTrue(reversed_tr.reversal_transfer.is_reversal)

        # Stock should be returned back to source: 100 in source, 0 in dest
        src_stock = services.get_item_warehouse_stock(self.item, self.wh_source.code, org=self.org)
        dst_stock = services.get_item_warehouse_stock(self.item, self.wh_dest.code, org=self.org)
        self.assertEqual(src_stock, Decimal('100.000'))
        self.assertEqual(dst_stock, Decimal('0.000'))

        # Prevent duplicate reversal
        with self.assertRaises(ApiError):
            services.reverse_stock_transfer(transfer.pk, self.user, reason='Second reversal attempt')

    def test_reverse_transfer_prevented_if_destination_stock_consumed(self):
        data = {
            'source_warehouse': self.wh_source.pk,
            'destination_warehouse': self.wh_dest.pk,
            'lines': [{'item': self.item.pk, 'quantity': '50.000', 'unit': 'box'}]
        }
        transfer = services.create_stock_transfer(data, self.user)
        services.confirm_stock_transfer(transfer.pk, self.user)

        # Simulate sale / consumption from destination warehouse of 45 units
        StockMovement.objects.create(
            organization=self.org,
            item=self.item,
            date=timezone.localdate(),
            warehouse=self.wh_dest,
            warehouse_code=self.wh_dest.code,
            kind='sale',
            reference='INV-999',
            change=Decimal('-45.000'),
            balance_after=Decimal('5.000'),
            created_by=self.user
        )

        # Destination warehouse now only has 5 units available. Reversing 50 must fail.
        with self.assertRaises(ApiError) as cm:
            services.reverse_stock_transfer(transfer.pk, self.user, reason='Attempt to reverse after sale')
        self.assertIn('cannot reverse transfer', str(cm.exception).lower())
        self.assertIn('only has', str(cm.exception).lower())


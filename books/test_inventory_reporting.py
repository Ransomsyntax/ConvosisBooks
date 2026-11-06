import json
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from books.models import (
    Customer, Invoice, InvoiceLine, Item, Organization,
    StockMovement, UserProfile, Vendor, Bill, BillLine, Warehouse
)
from books import services

User = get_user_model()

class InventoryReportingTestCase(TestCase):
    def setUp(self):
        self.org1 = Organization.objects.create(name='Acme Corp', company_id='acme-corp', state='Kerala')
        self.org2 = Organization.objects.create(name='Beta Ltd', company_id='beta-ltd', state='Maharashtra')

        self.user1 = User.objects.create_user(username='admin@acme.com', password='password123', first_name='Acme', last_name='Admin')
        UserProfile.objects.create(user=self.user1, organization=self.org1, role='admin')

        self.user2 = User.objects.create_user(username='admin@beta.com', password='password123', first_name='Beta', last_name='Admin')
        UserProfile.objects.create(user=self.user2, organization=self.org2, role='admin')

        self.wh_main = Warehouse.objects.create(name='Main Warehouse', code='WH-MAIN', organization=self.org1)
        self.wh_north = Warehouse.objects.create(name='North Warehouse', code='WH-NORTH', organization=self.org1)

        self.customer = Customer.objects.create(name='Customer A', organization=self.org1)
        self.vendor = Vendor.objects.create(name='Vendor A', organization=self.org1)

        # Create Item with opening stock 10
        self.item = Item.objects.create(
            name='Ergonomic Chair',
            sku='SKU-CHR-99',
            item_type='goods',
            track_inventory=True,
            unit='nos',
            stock=Decimal('10.000'),
            purchase_price=Decimal('100.00'),
            selling_price=Decimal('150.00'),
            warehouse=self.wh_main,
            warehouse_code=self.wh_main.code,
            organization=self.org1
        )
        StockMovement.objects.create(
            organization=self.org1,
            item=self.item,
            date=timezone.localdate(),
            warehouse=self.wh_main,
            warehouse_code=self.wh_main.code,
            kind='opening',
            reference='INIT-01',
            change=Decimal('10.000'),
            balance_after=Decimal('10.000'),
            reason='Initial Stock Opening'
        )

    def test_stock_in_via_bill(self):
        self.client.force_login(self.user1)
        # Create a bill for 5 items
        bill = Bill.objects.create(
            organization=self.org1,
            vendor=self.vendor,
            number='BILL-101',
            date=timezone.localdate(),
            due_date=timezone.localdate(),
            status='draft',
            total=Decimal('500.00'),
            subtotal=Decimal('500.00')
        )
        BillLine.objects.create(
            bill=bill,
            item=self.item,
            quantity=Decimal('5.000'),
            rate=Decimal('100.00'),
            taxable=Decimal('500.00'),
            tax_amount=Decimal('0.00'),
            line_total=Decimal('500.00')
        )
        # Approve bill -> stock in
        services.approve_bill(bill, self.user1)
        self.item.refresh_from_db()
        self.assertEqual(self.item.stock, Decimal('15.000'))

        # Verify stock movement was recorded
        mv = StockMovement.objects.filter(item=self.item, kind='purchase').first()
        self.assertIsNotNone(mv)
        self.assertEqual(mv.change, Decimal('5.000'))

    def test_stock_out_via_invoice(self):
        self.client.force_login(self.user1)
        # Create an invoice for 3 items
        inv = Invoice.objects.create(
            organization=self.org1,
            customer=self.customer,
            number='INV-101',
            date=timezone.localdate(),
            due_date=timezone.localdate(),
            status='draft',
            total=Decimal('450.00'),
            subtotal=Decimal('450.00')
        )
        InvoiceLine.objects.create(
            invoice=inv,
            item=self.item,
            quantity=Decimal('3.000'),
            rate=Decimal('150.00'),
            taxable=Decimal('450.00'),
            tax_amount=Decimal('0.00'),
            line_total=Decimal('450.00')
        )
        # Send invoice -> stock out
        services.send_invoice(inv, self.user1)
        self.item.refresh_from_db()
        self.assertEqual(self.item.stock, Decimal('7.000'))

        # Verify stock movement was recorded
        mv = StockMovement.objects.filter(item=self.item, kind='sale').first()
        self.assertIsNotNone(mv)
        self.assertEqual(mv.change, Decimal('-3.000'))

    def test_stock_transfer_between_warehouses(self):
        self.client.force_login(self.user1)
        # Transfer 2 units from WH-MAIN to WH-NORTH
        resp = self.client.post(
            '/api/stock-movements/move/',
            data=json.dumps({
                'item': self.item.pk,
                'from_warehouse': self.wh_main.pk,
                'to_warehouse': self.wh_north.pk,
                'quantity': '2.000',
                'date': timezone.localdate().isoformat(),
                'reason': 'Stock Rebalancing',
                'notes': 'Challan #123'
            }),
            content_type='application/json'
        )
        self.assertEqual(resp.status_code, 200, resp.content)
        # Check transfer movement
        mv = StockMovement.objects.filter(item=self.item, kind='transfer').first()
        self.assertIsNotNone(mv)
        self.assertEqual(mv.change, Decimal('2.000'))
        self.assertEqual(mv.warehouse_code, 'WH-MAIN')
        self.assertEqual(mv.to_warehouse_code, 'WH-NORTH')

    def test_inventory_summary_variables(self):
        self.client.force_login(self.user1)
        # Add purchase (+5) and sale (-2)
        services.move_stock(self.item.pk, Decimal('5.000'), 'purchase', 'B1', timezone.localdate(), self.user1, warehouse=self.wh_main, warehouse_code=self.wh_main.code)
        services.move_stock(self.item.pk, Decimal('-2.000'), 'sale', 'I1', timezone.localdate(), self.user1, warehouse=self.wh_main, warehouse_code=self.wh_main.code)

        # Get items via API
        resp = self.client.get('/api/items/?tracked=1')
        self.assertEqual(resp.status_code, 200)
        items = resp.json()['results']
        item_data = next((i for i in items if i['id'] == self.item.pk), None)
        self.assertIsNotNone(item_data)

        # Check all required stock variables
        self.assertEqual(float(item_data['opening_stock']), 10.0)
        self.assertEqual(float(item_data['stock_in']), 5.0)
        self.assertEqual(float(item_data['stock_out']), 2.0)
        self.assertEqual(float(item_data['stock_in_hand']), 13.0)
        self.assertEqual(float(item_data['closing_stock']), 13.0)
        self.assertEqual(float(item_data['stock_value']), 1300.0)

        # Also check reports/inventory-summary/
        resp_rep = self.client.get('/api/reports/inventory-summary/')
        self.assertEqual(resp_rep.status_code, 200)
        rep_data = resp_rep.json()
        self.assertEqual(rep_data['total_opening_stock'], 10.0)
        self.assertEqual(rep_data['total_stock_in'], 5.0)
        self.assertEqual(rep_data['total_stock_out'], 2.0)
        self.assertEqual(rep_data['total_stock_in_hand'], 13.0)
        self.assertEqual(rep_data['total_valuation'], 1300.0)

    def test_opening_stock_preview(self):
        self.client.force_login(self.user1)
        resp = self.client.get(f'/api/inventory/opening-stock-preview/?item_id={self.item.pk}')
        self.assertEqual(resp.status_code, 200, resp.content)
        data = resp.json()

        self.assertEqual(data['product_name'], 'Ergonomic Chair')
        self.assertEqual(data['sku'], 'SKU-CHR-99')
        self.assertEqual(data['warehouse'], 'WH-MAIN')
        self.assertEqual(data['opening_quantity'], 10.0)
        self.assertEqual(data['unit'], 'nos')
        self.assertEqual(data['rate'], 100.0)
        self.assertEqual(data['opening_stock_value'], 1000.0)
        self.assertTrue(len(data['product_details']) >= 1)
        self.assertEqual(data['total_opening_quantity'], 10.0)
        self.assertEqual(data['total_opening_value'], 1000.0)

    def test_stock_in_hand_preview(self):
        self.client.force_login(self.user1)
        # Add stock in and stock out
        services.move_stock(self.item.pk, Decimal('8.000'), 'purchase', 'B2', timezone.localdate(), self.user1, warehouse=self.wh_main, warehouse_code=self.wh_main.code)
        services.move_stock(self.item.pk, Decimal('-4.000'), 'sale', 'I2', timezone.localdate(), self.user1, warehouse=self.wh_main, warehouse_code=self.wh_main.code)

        resp = self.client.get(f'/api/inventory/stock-in-hand-preview/?item_id={self.item.pk}')
        self.assertEqual(resp.status_code, 200, resp.content)
        data = resp.json()

        self.assertEqual(data['product_name'], 'Ergonomic Chair')
        self.assertEqual(data['opening_stock'], 10.0)
        self.assertEqual(data['total_stock_in'], 8.0)
        self.assertEqual(data['total_stock_out'], 4.0)
        # Formula: 10 + 8 - 4 = 14
        self.assertEqual(data['available_stock'], 14.0)
        self.assertEqual(data['stock_value'], 1400.0)
        self.assertIn('Available Stock = Opening Stock + Stock In - Stock Out', data['calculation_formula'])
        self.assertTrue(len(data['recent_movements']) >= 2)

    def test_reports_module_endpoints(self):
        self.client.force_login(self.user1)
        # Add purchase, sale, transfer
        services.move_stock(self.item.pk, Decimal('5.000'), 'purchase', 'B3', timezone.localdate(), self.user1, warehouse=self.wh_main, warehouse_code=self.wh_main.code)
        services.move_stock(self.item.pk, Decimal('-1.000'), 'sale', 'I3', timezone.localdate(), self.user1, warehouse=self.wh_main, warehouse_code=self.wh_main.code)
        services.transfer_stock(self.item.pk, Decimal('2.000'), self.wh_main.pk, self.wh_north.pk, timezone.localdate(), user=self.user1)

        # 1. Stock In Report
        resp_in = self.client.get('/api/reports/stock-in-report/')
        self.assertEqual(resp_in.status_code, 200)
        self.assertTrue(resp_in.json()['total_quantity'] >= 5.0)

        # 2. Stock Out Report
        resp_out = self.client.get('/api/reports/stock-out-report/')
        self.assertEqual(resp_out.status_code, 200)
        self.assertTrue(resp_out.json()['total_quantity'] >= 1.0)

        # 3. Stock Transfer Report
        resp_tr = self.client.get('/api/reports/stock-transfer-report/')
        self.assertEqual(resp_tr.status_code, 200)
        self.assertEqual(resp_tr.json()['total_quantity'], 2.0)

        # 4. Opening Stock Report
        resp_op = self.client.get('/api/reports/opening-stock-report/')
        self.assertEqual(resp_op.status_code, 200)
        self.assertEqual(resp_op.json()['total_opening_quantity'], 10.0)

        # 5. Stock in Hand Report
        resp_h = self.client.get('/api/reports/stock-in-hand-report/')
        self.assertEqual(resp_h.status_code, 200)
        self.assertTrue(resp_h.json()['total_available_stock'] >= 14.0)

    def test_multitenancy_isolation(self):
        # User 2 (Org 2) attempts to access Org 1's preview
        self.client.force_login(self.user2)
        resp = self.client.get(f'/api/inventory/opening-stock-preview/?item_id={self.item.pk}')
        self.assertEqual(resp.status_code, 404)

        resp_h = self.client.get(f'/api/inventory/stock-in-hand-preview/?item_id={self.item.pk}')
        self.assertEqual(resp_h.status_code, 404)

        # Org 2's reports should be empty
        resp_rep = self.client.get('/api/reports/inventory-summary/')
        self.assertEqual(resp_rep.status_code, 200)
        self.assertEqual(resp_rep.json()['total_opening_stock'], 0.0)

    def test_stock_adjustment_multi_item_and_all_fields(self):
        self.client.force_login(self.user1)
        # Create second tracked item
        item2 = Item.objects.create(
            name='Office Desk',
            sku='SKU-DSK-01',
            item_type='goods',
            track_inventory=True,
            stock=Decimal('20.000'),
            purchase_price=Decimal('200.00'),
            selling_price=Decimal('300.00'),
            warehouse=self.wh_main,
            warehouse_code=self.wh_main.code,
            organization=self.org1
        )

        payload = {
            'mode_of_adjustment': 'quantity',
            'reference_number': 'ADJ-REF-999',
            'date': timezone.localdate().isoformat(),
            'time': '14:30',
            'warehouse': self.wh_main.pk,
            'warehouse_code': self.wh_main.code,
            'account': 'Cost of Goods Sold',
            'reason': 'Stock recount',
            'description': 'Year end physical inventory audit',
            'status': 'adjusted',
            'items': [
                {
                    'item': self.item.pk,
                    'quantity_available': 10.0,
                    'new_quantity': 14.0,
                    'quantity_adjusted': 4.0,
                    'project': 'HQ Setup',
                    'reporting_tags': 'Audit-2026'
                },
                {
                    'item': item2.pk,
                    'quantity_available': 20.0,
                    'new_quantity': 18.0,
                    'quantity_adjusted': -2.0,
                    'project': 'HQ Setup',
                    'reporting_tags': 'Audit-2026'
                }
            ],
            'attachments': [
                {
                    'filename': 'audit_count_sheet.pdf',
                    'file_size': 1024,
                    'mime_type': 'application/pdf',
                    'file_data': 'data:application/pdf;base64,JVBERi0xLjQK...'
                }
            ]
        }

        resp = self.client.post('/api/stock-adjustments/', data=json.dumps(payload), content_type='application/json')
        self.assertEqual(resp.status_code, 201)

        # Verify stock changes
        self.item.refresh_from_db()
        item2.refresh_from_db()
        self.assertEqual(self.item.stock, Decimal('14.000'))
        self.assertEqual(item2.stock, Decimal('18.000'))

        # Verify movements
        mvs = StockMovement.objects.filter(reference='ADJ-REF-999')
        self.assertEqual(mvs.count(), 2)

        # Verify attachment was linked
        from books.models import Attachment
        att = Attachment.objects.filter(entity_type='stock_adjustment', entity_id=mvs.first().pk).first()
        self.assertIsNotNone(att)
        self.assertEqual(att.filename, 'audit_count_sheet.pdf')

    def test_stock_adjustment_draft_preserves_stock(self):
        self.client.force_login(self.user1)
        initial_stock = self.item.stock
        payload = {
            'mode_of_adjustment': 'quantity',
            'reference_number': 'ADJ-DRAFT-001',
            'date': timezone.localdate().isoformat(),
            'time': '10:00',
            'warehouse': self.wh_main.pk,
            'account': 'Inventory Adjustment',
            'reason': 'Theft / loss',
            'description': 'Pending investigation',
            'status': 'draft',
            'items': [
                {
                    'item': self.item.pk,
                    'new_quantity': 5.0,
                    'quantity_adjusted': -5.0
                }
            ]
        }
        resp = self.client.post('/api/stock-adjustments/', data=json.dumps(payload), content_type='application/json')
        self.assertEqual(resp.status_code, 201)

        # Stock should NOT have changed
        self.item.refresh_from_db()
        self.assertEqual(self.item.stock, initial_stock)

        # Movement record recorded as draft
        mv = StockMovement.objects.filter(reference='ADJ-DRAFT-001').first()
        self.assertIsNotNone(mv)
        self.assertIn('[Draft]', mv.notes)


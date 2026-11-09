from decimal import Decimal
from django.test import TestCase, Client
from django.contrib.auth.models import User
from django.utils import timezone
from books.models import (
    Organization, Warehouse, Item, Customer, Invoice, InvoiceLine,
    Quote, QuoteLine, SalesOrder, SalesOrderLine, RetainerInvoice, RetainerInvoiceLine,
    StockMovement, UserProfile, Account
)
from books import services
from books.api import ApiError


class ItemTableStockWarehouseTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='stockuser', password='password123', email='stockuser@example.com')
        self.org = Organization.objects.create(
            name='Stock Test Org',
            code='STK',
            owner=self.user,
            allow_negative_stock=False
        )
        self.profile = UserProfile.objects.create(
            user=self.user,
            organization=self.org,
            role=UserProfile.ADMIN
        )

        Account.objects.create(organization=self.org, code='1200', name='Accounts Receivable', account_type='asset')
        Account.objects.create(organization=self.org, code='4000', name='Sales Revenue', account_type='income')

        self.wh_main = Warehouse.objects.create(
            organization=self.org,
            name='HO Kottayam',
            code='WH-MAIN',
            is_primary=True,
            active=True
        )
        self.wh_branch = Warehouse.objects.create(
            organization=self.org,
            name='Kochi Warehouse',
            code='WH-KOCHI',
            is_primary=False,
            active=True
        )

        self.item = Item.objects.create(
            organization=self.org,
            name='Test Widget',
            sku='WGT-001',
            item_type='goods',
            track_inventory=True,
            unit='Nos',
            selling_price=Decimal('100.00'),
            warehouse=self.wh_main,
            warehouse_code='WH-MAIN'
        )

        # Seed initial stock: 50 in WH-MAIN, 20 in WH-KOCHI
        services.move_stock(self.item.pk, Decimal('50.00'), 'purchase', 'INIT-01', timezone.now().date(), self.user, warehouse=self.wh_main, warehouse_code='WH-MAIN')
        services.move_stock(self.item.pk, Decimal('20.00'), 'purchase', 'INIT-02', timezone.now().date(), self.user, warehouse=self.wh_branch, warehouse_code='WH-KOCHI')

        self.customer = Customer.objects.create(
            organization=self.org,
            name='Acme Corp',
            email='acme@example.com'
        )

        self.client = Client()
        self.client.force_login(self.user)
        session = self.client.session
        session['active_org_id'] = self.org.pk
        session.save()

    def test_stock_per_warehouse_calculation(self):
        stock_main = services.get_item_warehouse_stock(self.item.pk, self.wh_main.pk, org=self.org)
        stock_kochi = services.get_item_warehouse_stock(self.item.pk, self.wh_branch.pk, org=self.org)
        self.assertEqual(stock_main, Decimal('50.00'))
        self.assertEqual(stock_kochi, Decimal('20.00'))

    def test_lookup_warehouse_stock_api(self):
        res = self.client.get(f'/api/lookup/warehouse-stock/?item_id={self.item.pk}&warehouse_id={self.wh_main.pk}')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(Decimal(str(data['available_stock'])), Decimal('50.00'))
        self.assertEqual(data['warehouse_name'], 'HO Kottayam')

        res_kochi = self.client.get(f'/api/lookup/warehouse-stock/?item_id={self.item.pk}&warehouse_id={self.wh_branch.pk}')
        self.assertEqual(res_kochi.status_code, 200)
        self.assertEqual(Decimal(str(res_kochi.json()['available_stock'])), Decimal('20.00'))

    def test_lookup_warehouses_api_lists_org_warehouses(self):
        res = self.client.get('/api/lookup/warehouses/')
        self.assertEqual(res.status_code, 200)
        whs = res.json()
        codes = [w['code'] for w in whs]
        self.assertIn('WH-MAIN', codes)
        self.assertIn('WH-KOCHI', codes)

    def test_draft_invoice_does_not_deduct_stock(self):
        inv = Invoice.objects.create(
            organization=self.org,
            customer=self.customer,
            number='INV-TEST-001',
            date=timezone.now().date(),
            due_date=timezone.now().date(),
            status='draft',
            subtotal=Decimal('500.00'),
            total=Decimal('500.00')
        )
        InvoiceLine.objects.create(
            invoice=inv,
            item=self.item,
            warehouse=self.wh_main,
            warehouse_code='WH-MAIN',
            description='Test item',
            quantity=Decimal('10.00'),
            rate=Decimal('50.00'),
            taxable=Decimal('500.00'),
            tax_amount=Decimal('0.00'),
            line_total=Decimal('500.00'),
            position=0
        )

        stock_after_draft = services.get_item_warehouse_stock(self.item.pk, self.wh_main.pk, org=self.org)
        self.assertEqual(stock_after_draft, Decimal('50.00'))

    def test_send_invoice_deducts_warehouse_specific_stock(self):
        inv = Invoice.objects.create(
            organization=self.org,
            customer=self.customer,
            number='INV-TEST-002',
            date=timezone.now().date(),
            due_date=timezone.now().date(),
            status='draft',
            subtotal=Decimal('500.00'),
            total=Decimal('500.00')
        )
        InvoiceLine.objects.create(
            invoice=inv,
            item=self.item,
            warehouse=self.wh_branch,
            warehouse_code='WH-KOCHI',
            description='Test item in Kochi',
            quantity=Decimal('5.00'),
            rate=Decimal('100.00'),
            taxable=Decimal('500.00'),
            tax_amount=Decimal('0.00'),
            line_total=Decimal('500.00'),
            position=0
        )

        services.send_invoice(inv, self.user)
        self.assertEqual(inv.status, 'sent')

        stock_main = services.get_item_warehouse_stock(self.item.pk, self.wh_main.pk, org=self.org)
        stock_kochi = services.get_item_warehouse_stock(self.item.pk, self.wh_branch.pk, org=self.org)

        # WH-MAIN unchanged, WH-KOCHI reduced from 20 to 15
        self.assertEqual(stock_main, Decimal('50.00'))
        self.assertEqual(stock_kochi, Decimal('15.00'))

    def test_negative_stock_blocked_when_disallowed(self):
        self.org.allow_negative_stock = False
        self.org.save()

        inv = Invoice.objects.create(
            organization=self.org,
            customer=self.customer,
            number='INV-TEST-003',
            date=timezone.now().date(),
            due_date=timezone.now().date(),
            status='draft',
            subtotal=Decimal('2500.00'),
            total=Decimal('2500.00')
        )
        InvoiceLine.objects.create(
            invoice=inv,
            item=self.item,
            warehouse=self.wh_branch,
            warehouse_code='WH-KOCHI',
            description='Excess item in Kochi',
            quantity=Decimal('25.00'),  # only 20 available in Kochi
            rate=Decimal('100.00'),
            taxable=Decimal('2500.00'),
            tax_amount=Decimal('0.00'),
            line_total=Decimal('2500.00'),
            position=0
        )

        with self.assertRaises(ApiError) as ctx:
            services.send_invoice(inv, self.user)
        self.assertIn('Insufficient Stock', str(ctx.exception))
        self.assertIn('Kochi Warehouse', str(ctx.exception))

    def test_negative_stock_allowed_when_enabled(self):
        self.org.allow_negative_stock = True
        self.org.save()

        inv = Invoice.objects.create(
            organization=self.org,
            customer=self.customer,
            number='INV-TEST-004',
            date=timezone.now().date(),
            due_date=timezone.now().date(),
            status='draft',
            subtotal=Decimal('2500.00'),
            total=Decimal('2500.00')
        )
        InvoiceLine.objects.create(
            invoice=inv,
            item=self.item,
            warehouse=self.wh_branch,
            warehouse_code='WH-KOCHI',
            description='Excess item in Kochi',
            quantity=Decimal('25.00'),  # 20 available, resulting in -5
            rate=Decimal('100.00'),
            taxable=Decimal('2500.00'),
            tax_amount=Decimal('0.00'),
            line_total=Decimal('2500.00'),
            position=0
        )

        services.send_invoice(inv, self.user)
        self.assertEqual(inv.status, 'sent')
        stock_kochi = services.get_item_warehouse_stock(self.item.pk, self.wh_branch.pk, org=self.org)
        self.assertEqual(stock_kochi, Decimal('-5.00'))

    def test_void_invoice_restores_stock(self):
        inv = Invoice.objects.create(
            organization=self.org,
            customer=self.customer,
            number='INV-TEST-005',
            date=timezone.now().date(),
            due_date=timezone.now().date(),
            status='draft',
            subtotal=Decimal('1000.00'),
            total=Decimal('1000.00')
        )
        InvoiceLine.objects.create(
            invoice=inv,
            item=self.item,
            warehouse=self.wh_main,
            warehouse_code='WH-MAIN',
            description='Test restore',
            quantity=Decimal('10.00'),
            rate=Decimal('100.00'),
            taxable=Decimal('1000.00'),
            tax_amount=Decimal('0.00'),
            line_total=Decimal('1000.00'),
            position=0
        )
        services.send_invoice(inv, self.user)
        self.assertEqual(services.get_item_warehouse_stock(self.item.pk, self.wh_main.pk, org=self.org), Decimal('40.00'))

        services.void_invoice(inv, self.user)
        self.assertEqual(services.get_item_warehouse_stock(self.item.pk, self.wh_main.pk, org=self.org), Decimal('50.00'))

    def test_quotes_and_retainers_have_warehouse_lines(self):
        quote = Quote.objects.create(
            organization=self.org,
            customer=self.customer,
            number='QT-TEST-001',
            date=timezone.now().date(),
            due_date=timezone.now().date()
        )
        q_line = QuoteLine.objects.create(
            quote=quote,
            item=self.item,
            warehouse=self.wh_main,
            warehouse_code='WH-MAIN',
            description='Quotation line',
            quantity=Decimal('2.00'),
            rate=Decimal('100.00'),
            taxable=Decimal('200.00'),
            tax_amount=Decimal('0.00'),
            line_total=Decimal('200.00'),
            position=0
        )
        self.assertEqual(q_line.warehouse, self.wh_main)
        self.assertEqual(q_line.warehouse_code, 'WH-MAIN')

        ret = RetainerInvoice.objects.create(
            organization=self.org,
            customer=self.customer,
            number='RET-TEST-001',
            date=timezone.now().date(),
            due_date=timezone.now().date()
        )
        ret_line = RetainerInvoiceLine.objects.create(
            retainer=ret,
            item=self.item,
            warehouse=self.wh_branch,
            warehouse_code='WH-KOCHI',
            description='Retainer line',
            quantity=Decimal('1.00'),
            rate=Decimal('100.00'),
            taxable=Decimal('100.00'),
            tax_amount=Decimal('0.00'),
            line_total=Decimal('100.00'),
            position=0
        )
        self.assertEqual(ret_line.warehouse, self.wh_branch)
        self.assertEqual(ret_line.warehouse_code, 'WH-KOCHI')

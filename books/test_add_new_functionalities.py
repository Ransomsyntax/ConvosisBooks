import json
import os
from decimal import Decimal
from django.test import TestCase, Client
from django.contrib.auth.models import User
from books.models import (
    Organization, UserProfile, BankAccount, BankTransfer,
    Account, Customer, Vendor, Item, Warehouse, Project, ItemCategory, PriceList
)


class AddNewFunctionalitiesTestCase(TestCase):
    """
    Comprehensive test suite verifying that all Add New operations,
    nested quick-creations, dropdown creation triggers, and backend APIs
    are fully functional, isolated by organization, and properly synchronized.
    """

    def setUp(self):
        self.user = User.objects.create_user(
            username='add_new_admin', email='add_new_admin@example.com', password='password123'
        )
        self.org = Organization.objects.create(
            name='Convosis Add New Test Org',
            owner=self.user,
            state='Kerala',
            base_currency='INR'
        )
        self.profile = UserProfile.objects.create(
            user=self.user,
            organization=self.org,
            role='admin',
            normalized_email='add_new_admin@example.com'
        )
        self.gl_cash = Account.objects.create(
            organization=self.org,
            code='1010',
            name='Cash and Bank',
            account_type='asset'
        )
        self.bank1 = BankAccount.objects.create(
            organization=self.org,
            name='HDFC Main A/c',
            bank_name='HDFC Bank',
            account_number='123456789012',
            opening_balance=Decimal('100000.00'),
            current_balance=Decimal('100000.00'),
            bank_balance=Decimal('100000.00'),
            gl_account=self.gl_cash
        )
        self.bank2 = BankAccount.objects.create(
            organization=self.org,
            name='SBI Operating A/c',
            bank_name='State Bank of India',
            account_number='987654321098',
            opening_balance=Decimal('50000.00'),
            current_balance=Decimal('50000.00'),
            bank_balance=Decimal('50000.00'),
            gl_account=self.gl_cash
        )

        self.client = Client()
        self.client.force_login(self.user)

    def test_bank_transfer_validation_and_execution(self):
        """Verify internal transfer validation and execution with proper isolation."""
        # 1. Missing From Account
        resp = self.client.post(
            '/api/banking/transfer/',
            data=json.dumps({'from_account': '', 'to_account': str(self.bank2.id), 'amount': '5000'}),
            content_type='application/json'
        )
        self.assertEqual(resp.status_code, 400)

        # 2. Missing To Account
        resp = self.client.post(
            '/api/banking/transfer/',
            data=json.dumps({'from_account': str(self.bank1.id), 'to_account': '', 'amount': '5000'}),
            content_type='application/json'
        )
        self.assertEqual(resp.status_code, 400)

        # 3. Same Account Error
        resp = self.client.post(
            '/api/banking/transfer/',
            data=json.dumps({'from_account': str(self.bank1.id), 'to_account': str(self.bank1.id), 'amount': '5000'}),
            content_type='application/json'
        )
        self.assertEqual(resp.status_code, 400)

        # 4. Successful Transfer
        resp = self.client.post(
            '/api/banking/transfer/',
            data=json.dumps({'from_account': str(self.bank1.id), 'to_account': str(self.bank2.id), 'amount': '15000'}),
            content_type='application/json'
        )
        self.assertEqual(resp.status_code, 200)

        self.bank1.refresh_from_db()
        self.bank2.refresh_from_db()
        self.assertEqual(self.bank1.current_balance, Decimal('85000.00'))
        self.assertEqual(self.bank2.current_balance, Decimal('65000.00'))

    def test_quick_create_bank_account_api(self):
        """Verify Bank Account quick creation API."""
        resp = self.client.post(
            '/api/bank-accounts/',
            data=json.dumps({
                'name': 'Axis Current A/c',
                'bank_name': 'Axis Bank',
                'account_number': '918020000012345',
                'account_type': 'current',
                'opening_balance': 25000
            }),
            content_type='application/json'
        )
        self.assertEqual(resp.status_code, 201)
        self.assertTrue(BankAccount.objects.filter(organization=self.org, name='Axis Current A/c').exists())

    def test_quick_create_vendor_and_customer_api(self):
        """Verify Vendor and Customer creation APIs."""
        resp_v = self.client.post(
            '/api/vendors/',
            data=json.dumps({
                'name': 'Convosis Global Tech Supplies',
                'email': 'supplies@example.com',
                'state': 'Kerala',
                'active': True
            }),
            content_type='application/json'
        )
        self.assertEqual(resp_v.status_code, 201)
        self.assertTrue(Vendor.objects.filter(organization=self.org, name='Convosis Global Tech Supplies').exists())

        resp_c = self.client.post(
            '/api/customers/',
            data=json.dumps({
                'name': 'Apex Retail Corp',
                'email': 'apex@example.com',
                'state': 'Karnataka',
                'active': True
            }),
            content_type='application/json'
        )
        self.assertEqual(resp_c.status_code, 201)
        self.assertTrue(Customer.objects.filter(organization=self.org, name='Apex Retail Corp').exists())

    def test_quick_create_warehouse_and_item_api(self):
        """Verify Warehouse and Item creation APIs."""
        resp_wh = self.client.post(
            '/api/warehouses/',
            data=json.dumps({
                'name': 'Kochi Regional Hub',
                'code': 'WH-KCH-01',
                'city': 'Kochi',
                'state': 'Kerala'
            }),
            content_type='application/json'
        )
        self.assertEqual(resp_wh.status_code, 201)
        self.assertTrue(Warehouse.objects.filter(organization=self.org, code='WH-KCH-01').exists())

        resp_it = self.client.post(
            '/api/items/',
            data=json.dumps({
                'name': 'Enterprise Router X1',
                'item_type': 'goods',
                'unit': 'pcs',
                'selling_price': 12500,
                'tax_preference': 'taxable',
                'gst_rate': 18
            }),
            content_type='application/json'
        )
        self.assertEqual(resp_it.status_code, 201)
        self.assertTrue(Item.objects.filter(organization=self.org, name='Enterprise Router X1').exists())

    def test_quick_create_account_project_category_pricelist(self):
        """Verify Account, Project, Item Category, and Price List creation APIs."""
        # Account
        resp_acc = self.client.post(
            '/api/accounts/',
            data=json.dumps({
                'name': 'Cloud Infrastructure Expense',
                'code': '6099',
                'account_type': 'expense'
            }),
            content_type='application/json'
        )
        self.assertEqual(resp_acc.status_code, 201)
        self.assertTrue(Account.objects.filter(organization=self.org, code='6099').exists())

        # Project
        resp_proj = self.client.post(
            '/api/projects/',
            data=json.dumps({
                'name': 'ERP Rollout 2026',
                'status': 'in_progress'
            }),
            content_type='application/json'
        )
        self.assertEqual(resp_proj.status_code, 201)
        self.assertTrue(Project.objects.filter(organization=self.org, name='ERP Rollout 2026').exists())

        # Category
        resp_cat = self.client.post(
            '/api/item-categories/',
            data=json.dumps({
                'name': 'Networking Gear',
                'description': 'Routers and switches'
            }),
            content_type='application/json'
        )
        self.assertEqual(resp_cat.status_code, 201)
        self.assertTrue(ItemCategory.objects.filter(organization=self.org, name='Networking Gear').exists())

        # Price List
        resp_pl = self.client.post(
            '/api/price-lists/',
            data=json.dumps({
                'name': 'Corporate Partner Discount',
                'pricing_scheme': 'percentage',
                'percentage': -12.5
            }),
            content_type='application/json'
        )
        self.assertEqual(resp_pl.status_code, 201)
        self.assertTrue(PriceList.objects.filter(organization=self.org, name='Corporate Partner Discount').exists())

    def test_frontend_files_integrity_and_synchronization(self):
        """Verify that frontend JavaScript files include all required Add New hooks and are mirrored."""
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        static_forms = os.path.join(base_dir, 'books', 'static', 'books', 'js', 'forms.js')
        front_forms = os.path.join(base_dir, 'frontend', 'js', 'forms.js')
        static_pages = os.path.join(base_dir, 'books', 'static', 'books', 'js', 'pages.js')
        front_pages = os.path.join(base_dir, 'frontend', 'js', 'pages.js')

        with open(static_forms, 'r', encoding='utf-8') as f:
            sf_content = f.read()
        with open(front_forms, 'r', encoding='utf-8') as f:
            ff_content = f.read()
        with open(static_pages, 'r', encoding='utf-8') as f:
            sp_content = f.read()
        with open(front_pages, 'r', encoding='utf-8') as f:
            fp_content = f.read()

        # Check mirroring
        self.assertEqual(sf_content, ff_content, "forms.js is not synchronized between static and frontend!")
        self.assertEqual(sp_content, fp_content, "pages.js is not synchronized between static and frontend!")

        # Check handleQuickCreateSelect supports bank_account and entity fallbacks
        self.assertIn("entity = 'bank_account'", sf_content)
        self.assertIn("selName.includes('vendor')", sf_content)

        # Check billForm vendor lookup
        self.assertIn("$('#btn-bill-vendor-lookup', form)?.addEventListener('click', () => {", sf_content)
        self.assertIn("partyForm('vendors', null, newVen => {", sf_content)

        # Check adjustForm warehouse and account add new
        self.assertIn("option value=\"__new_warehouse__\"", sf_content)
        self.assertIn("adjWhSelect.value === '__new_warehouse__'", sf_content)
        self.assertIn("adjAcctSelect.value === '__new_account__'", sf_content)

        # Check expenseForm account and project add new
        self.assertIn("option value=\"__new_project__\"", sf_content)
        self.assertIn("option value=\"__new_account__\"", sf_content)
        self.assertIn("e.target.value === '__new_project__'", sf_content)

        # Check journalForm line accounts add new
        self.assertIn("['__new_account__', '+ Add New Account…']", sf_content)
        self.assertIn("e.target.value === '__new_account__'", sf_content)

        # Check stockTransferModal handles missing warehouses and new options
        self.assertIn("At least two active warehouses are required. Opening warehouse creation...", sf_content)
        self.assertIn("srcWhEl.value === '__new_warehouse__'", sf_content)
        self.assertIn("dstWhEl.value === '__new_warehouse__'", sf_content)
        self.assertIn("e.target.value === '__new_item__'", sf_content)

        # Check pages.js internal transfer modal
        self.assertIn("<option value=\"\" selected>Select Account</option>", sp_content)
        self.assertIn("<option value=\"__new_bank_account__\"", sp_content)
        self.assertIn("fromSelect.value === '__new_bank_account__'", sp_content)
        self.assertIn("toSelect.value === '__new_bank_account__'", sp_content)
        self.assertIn("!fromId || fromId === '__new_bank_account__'", sp_content)
        self.assertIn("!toId || toId === '__new_bank_account__'", sp_content)

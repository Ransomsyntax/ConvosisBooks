import json
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.test import Client, TestCase
from django.utils import timezone
from books import services
from books.models import Account, BankAccount, BankTransaction, Customer, Expense, Invoice, Item, Organization, UserProfile, Vendor

class TestUniversalImport(TestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(username='tester', password='pass1234Secure!')
        UserProfile.objects.create(user=self.user, role=UserProfile.ADMIN)
        self.client = Client()
        self.client.login(username='tester', password='pass1234Secure!')
        Organization.get()

    def test_customer_template_download(self):
        res = self.client.get('/api/customers/?export=template')
        self.assertEqual(res.status_code, 200)
        self.assertIn('text/csv', res['Content-Type'])
        content = res.content.decode('utf-8')
        self.assertIn('Name', content)
        self.assertIn('GSTIN', content)
        self.assertIn('Acme Infotech Ltd', content)

    def test_item_template_download(self):
        res = self.client.get('/api/items/?export=template')
        self.assertEqual(res.status_code, 200)
        content = res.content.decode('utf-8')
        self.assertIn('SKU', content)
        self.assertIn('Ergonomic Mesh Chair', content)

    def test_customer_import_and_duplicate_skip(self):
        records = [
            {
                'name': 'Test Client Alpha',
                'email': 'alpha@client.com',
                'phone': '9876543210',
                'gstin': '29AABCT1234A1Z5',
                'payment_terms': '45'
            },
            {
                'name': 'Test Client Beta',
                'email': 'beta@client.com',
                'phone': '9876543211',
                'payment_terms': '30'
            }
        ]
        res = self.client.post('/api/customers/', data=json.dumps({
            'import_records': records,
            'duplicate_mode': 'skip'
        }), content_type='application/json')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data['status'], 'ok')
        self.assertEqual(data['imported'], 2)
        self.assertTrue(Customer.objects.filter(name='Test Client Alpha').exists())

        # Re-import with skip
        res2 = self.client.post('/api/customers/', data=json.dumps({
            'import_records': records,
            'duplicate_mode': 'skip'
        }), content_type='application/json')
        data2 = res2.json()
        self.assertEqual(data2['skipped'], 2)
        self.assertEqual(data2['imported'], 0)

    def test_item_import_with_stock_and_tracking(self):
        records = [
            {
                'name': 'Steel Desk Lamp',
                'sku': 'SKU-LAMP-01',
                'type': 'goods',
                'selling_price': '₹1,250.00',
                'purchase_price': '₹750.00',
                'gst_rate': '18%',
                'stock': '15',
                'hsn_sac': '940520'
            }
        ]
        res = self.client.post('/api/items/', data=json.dumps({
            'import_records': records,
            'duplicate_mode': 'skip'
        }), content_type='application/json')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data['imported'], 1)
        item = Item.objects.get(sku='SKU-LAMP-01')
        self.assertEqual(item.selling_price, Decimal('1250.00'))
        self.assertTrue(item.track_inventory)
        self.assertEqual(item.stock, Decimal('15.000'))

    def test_expense_import_with_name_lookup(self):
        services.ensure_default_accounts()
        records = [
            {
                'date': '2026-10-25',
                'expense_account': 'Office Supplies',
                'vendor': 'Stationery Hub',
                'amount': '₹3,400.00',
                'paid_through': 'Bank Account'
            }
        ]
        res = self.client.post('/api/expenses/', data=json.dumps({
            'import_records': records
        }), content_type='application/json')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data['imported'], 1)
        exp = Expense.objects.filter(amount=Decimal('3400.00')).first()
        self.assertIsNotNone(exp)
        self.assertEqual(exp.vendor.name, 'Stationery Hub')

    def test_invoice_import_with_party_autocreation_and_lines(self):
        records = [
            {
                'number': 'INV-TEST-900',
                'customer': 'New Global Corp',
                'date': '2026-10-20',
                'item': 'Ergonomic Chair',
                'description': 'Office seating',
                'quantity': '2',
                'rate': '5000.00',
                'gst_rate': '18'
            }
        ]
        res = self.client.post('/api/invoices/', data=json.dumps({
            'import_records': records
        }), content_type='application/json')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data['imported'], 1)
        inv = Invoice.objects.filter(number='INV-TEST-900').first()
        self.assertIsNotNone(inv)
        self.assertEqual(inv.customer.name, 'New Global Corp')
        self.assertEqual(inv.lines.count(), 1)
        self.assertEqual(inv.total, Decimal('11800.00'))

    def test_banking_statement_csv_upload(self):
        ba = BankAccount.objects.create(
            name='Test Current', bank_name='Axis Bank',
            account_number='912020001234567', current_balance=Decimal('100000.00')
        )
        csv_data = (
            "Date,Narration,Reference,Withdrawal,Deposit,Balance\n"
            "2026-10-20,NEFT INWARD CLIENT A,REF123456,0.00,50000.00,150000.00\n"
            "2026-10-21,OFFICE RENT DEBIT,REF123457,20000.00,0.00,130000.00\n"
        )
        from django.core.files.uploadedfile import SimpleUploadedFile
        file_obj = SimpleUploadedFile("statement.csv", csv_data.encode('utf-8'), content_type="text/csv")
        res = self.client.post('/api/banking/statement-import/', {
            'file': file_obj,
            'bank_account': ba.pk
        })
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data['count'], 2)
        ba.refresh_from_db()
        self.assertEqual(ba.current_balance, Decimal('130000.00'))

    def test_import_validation_error_reporting(self):
        records = [
            {
                'name': '',  # missing required name
                'email': 'invalid-email'
            }
        ]
        res = self.client.post('/api/customers/', data=json.dumps({
            'import_records': records
        }), content_type='application/json')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data['status'], 'failed')
        self.assertEqual(data['failed'], 1)
        self.assertTrue(len(data['errors']) > 0)
        self.assertEqual(data['errors'][0]['row'], 1)
    def test_customer_import_defaults_active_to_true_even_when_blank(self):
        records = [
            {
                'name': 'Active Client Defaults',
                'email': 'activeclient@test.com',
                'active': '',
                'phone': '9876543212'
            }
        ]
        res = self.client.post('/api/customers/', data=json.dumps({
            'import_records': records
        }), content_type='application/json')
        self.assertEqual(res.status_code, 200)
        cust = Customer.objects.get(name='Active Client Defaults')
        self.assertTrue(cust.active)

    def test_customer_import_with_composite_first_and_last_name(self):
        records = [
            {
                'first_name': 'Ramesh',
                'last_name': 'Patel',
                'email': 'ramesh.patel@test.com',
                'phone': '9876543213'
            }
        ]
        res = self.client.post('/api/customers/', data=json.dumps({
            'import_records': records
        }), content_type='application/json')
        self.assertEqual(res.status_code, 200)
        cust = Customer.objects.filter(name='Ramesh Patel').first()
        self.assertIsNotNone(cust)
        self.assertTrue(cust.active)

    def test_auth_login_and_signup_flow(self):
        anon_client = Client()
        
        # 1. Signin failure
        res_fail = anon_client.post('/accounts/login/', {
            'action': 'signin',
            'username': 'tester',
            'password': 'wrongpassword'
        })
        self.assertEqual(res_fail.status_code, 200)
        self.assertIn('Authentication failed', res_fail.content.decode('utf-8'))

        # 2. Signin success
        res_succ = anon_client.post('/accounts/login/', {
            'action': 'signin',
            'username': 'tester',
            'password': 'pass1234Secure!'
        })
        self.assertEqual(res_succ.status_code, 302)
        self.assertEqual(res_succ.url, '/')

        # 3. Signup mismatch password
        new_client = Client()
        res_mismatch = new_client.post('/accounts/signup/', {
            'action': 'signup',
            'signup_name': 'Anil Kapoor',
            'signup_username': 'anil_k',
            'signup_email': 'anil@example.com',
            'signup_password': 'password123',
            'signup_confirm_password': 'differentpassword'
        })
        self.assertEqual(res_mismatch.status_code, 200)
        self.assertIn('Passwords do not match', res_mismatch.content.decode('utf-8'))

        # 4. Signup success
        res_reg = new_client.post('/accounts/signup/', {
            'action': 'signup',
            'signup_name': 'Anil Kapoor',
            'signup_org': 'Kapoor Enterprises',
            'signup_username': 'anil_k',
            'signup_email': 'anil@example.com',
            'signup_password': 'password123',
            'signup_confirm_password': 'password123'
        })
        self.assertEqual(res_reg.status_code, 302)
        self.assertEqual(res_reg.url, '/')

        from django.contrib.auth import get_user_model
        User = get_user_model()
        u = User.objects.get(username='anil_k')
        self.assertEqual(u.first_name, 'Anil Kapoor')
        self.assertEqual(u.profile.role, UserProfile.ADMIN)
    def test_customer_import_real_world_edge_cases(self):
        records = [
            {
                'Customer Name': 'Globex Corporation',
                'customer_type': 'Business',
                'opening_balance': '50,000.00',
                'opening_balance_type': 'Debit',
                'GSTIN': '27AAPCA1234A1Z5',
                'PAN': 'AAPCA1234A'
            },
            {
                'Customer Name': 'Mr. Rajesh Kumar',
                'customer_type': 'Individual',
                'Phone': '0484-2345678 / 9876543210',
                'Email': 'rajesh@kumar.com, accounts@kumar.com',
                'GSTIN': 'URP',
                'PAN': 'NA'
            },
            {
                'Company': 'Initech Software',
                'First Name': 'Peter',
                'Last Name': 'Gibbons',
                'payment_terms': 'Net 30',
                'active': 'Yes'
            },
            {
                'Customer Name': 'Store #101 & Deli',
                'contact_person': 'Bill Lumbergh (VP)',
                'Phone': '+91 (80) 2345-6789',
                'GSTIN': 'Unregistered'
            }
        ]
        res = self.client.post('/api/customers/', data=json.dumps({
            'import_records': records
        }), content_type='application/json')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data['status'], 'ok')
        self.assertEqual(data['imported'], 4)
        self.assertEqual(data['failed'], 0)

    def test_sales_orders_import(self):
        records = [
            {
                'number': 'SO-IMPORT-001',
                'customer': 'Global Exports Ltd',
                'date': '2026-11-01',
                'item': 'Imported Widget A',
                'quantity': '10',
                'rate': '150.00',
                'gst_rate': '18.00'
            },
            {
                'number': 'SO-IMPORT-001',
                'customer': 'Global Exports Ltd',
                'date': '2026-11-01',
                'item': 'Imported Widget B',
                'quantity': '5',
                'rate': '300.00',
                'gst_rate': '18.00'
            }
        ]
        res = self.client.post('/api/sales-orders/', data=json.dumps({
            'import_records': records,
            'duplicate_mode': 'skip'
        }), content_type='application/json')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data['status'], 'ok')
        self.assertEqual(data['imported'], 1)
        from books.models import SalesOrder
        so = SalesOrder.objects.filter(number='SO-IMPORT-001').first()
        self.assertIsNotNone(so)
        self.assertEqual(so.customer.name, 'Global Exports Ltd')
        self.assertEqual(so.lines.count(), 2)

    def test_purchase_orders_import(self):
        records = [
            {
                'number': 'PO-IMPORT-001',
                'vendor': 'Alpha Steel Supplies',
                'date': '2026-11-02',
                'item': 'Raw Steel Rods',
                'quantity': '20',
                'rate': '250.00',
                'gst_rate': '18.00'
            }
        ]
        res = self.client.post('/api/purchase-orders/', data=json.dumps({
            'import_records': records,
            'duplicate_mode': 'skip'
        }), content_type='application/json')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data['status'], 'ok')
        self.assertEqual(data['imported'], 1)
        from books.models import PurchaseOrder
        po = PurchaseOrder.objects.filter(number='PO-IMPORT-001').first()
        self.assertIsNotNone(po)
        self.assertEqual(po.vendor.name, 'Alpha Steel Supplies')

    def test_projects_import(self):
        records = [
            {
                'name': 'API Gateway Modernization',
                'code': 'PRJ-M-01',
                'customer': 'Fintech Alliance',
                'billing_method': 'hourly_rate',
                'rate_per_hour': '1800.00',
                'budget_hours': '80.00'
            }
        ]
        res = self.client.post('/api/projects/', data=json.dumps({
            'import_records': records,
            'duplicate_mode': 'skip'
        }), content_type='application/json')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data['status'], 'ok')
        self.assertEqual(data['imported'], 1)
        from books.models import Project
        prj = Project.objects.filter(code='PRJ-M-01').first()
        self.assertIsNotNone(prj)
        self.assertEqual(prj.name, 'API Gateway Modernization')
        self.assertEqual(prj.customer.name, 'Fintech Alliance')

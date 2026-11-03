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


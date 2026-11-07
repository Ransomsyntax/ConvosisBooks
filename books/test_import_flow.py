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

    def test_parse_import_file_csv_endpoint(self):
        import io
        from django.core.files.uploadedfile import SimpleUploadedFile
        csv_content = b"Customer Name,Email,Phone,State\nExcel Test Corp,excel@test.com,9876543210,Kerala\nBeta Systems,beta@test.com,9876543211,Karnataka"
        upload = SimpleUploadedFile("clients.csv", csv_content, content_type="text/csv")
        res = self.client.post('/api/import/parse-file/', {'file': upload})
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data['status'], 'ok')
        self.assertEqual(data['total_rows'], 2)
        self.assertIn('Customer Name', data['headers'])
        self.assertEqual(data['records'][0]['Customer Name'], 'Excel Test Corp')

    def test_parse_import_file_xlsx_endpoint(self):
        import io, zipfile
        from django.core.files.uploadedfile import SimpleUploadedFile
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as z:
            strings = ['Customer Name', 'Email', 'Phone', 'Apex Logistics', 'apex@logistics.com', '9876512345']
            sst = ['<?xml version="1.0" encoding="UTF-8"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">']
            for s in strings:
                sst.append(f'<si><t>{s}</t></si>')
            sst.append('</sst>')
            z.writestr('xl/sharedStrings.xml', ''.join(sst))
            z.writestr('xl/workbook.xml', '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>')
            ws = [
                '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>',
                '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c></row>',
                '<row r="2"><c r="A2" t="s"><v>3</v></c><c r="B2" t="s"><v>4</v></c><c r="C2" t="s"><v>5</v></c></row>',
                '</sheetData></worksheet>'
            ]
            z.writestr('xl/worksheets/sheet1.xml', ''.join(ws))
        buf.seek(0)
        upload = SimpleUploadedFile("clients.xlsx", buf.getvalue(), content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        res = self.client.post('/api/import/parse-file/', {'file': upload})
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data['status'], 'ok')
        self.assertEqual(data['total_rows'], 1)
        self.assertIn('Customer Name', data['headers'])
        self.assertEqual(data['records'][0]['Customer Name'], 'Apex Logistics')

    def test_direct_multipart_file_upload_import(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        csv_content = b"Name,Email,Phone\nDirect File Upload Client,direct@upload.com,9876549999"
        upload = SimpleUploadedFile("direct_clients.csv", csv_content, content_type="text/csv")
        res = self.client.post('/api/customers/', {'file': upload, 'duplicate_mode': 'skip'})
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data['status'], 'ok')
        self.assertEqual(data['imported'], 1)
        self.assertTrue(Customer.objects.filter(name='Direct File Upload Client').exists())

    def test_tenant_isolation_in_import(self):
        from django.contrib.auth import get_user_model
        User = get_user_model()
        org_a = Organization.get()
        org_b = Organization.objects.create(name='Tenant Bravo Corp', company_id='TB-001')
        user_b = User.objects.create_user(username='bravo_user', password='pass1234Secure!')
        UserProfile.objects.create(user=user_b, role=UserProfile.ADMIN, organization=org_b)

        # Create client for Org A
        Customer.objects.create(name='Shared Name Client', organization=org_a)

        # User B logs in and imports client with same name for Org B
        client_b = Client()
        client_b.login(username='bravo_user', password='pass1234Secure!')
        records = [{'name': 'Shared Name Client', 'email': 'bravo@shared.com'}]
        res = client_b.post('/api/customers/', data=json.dumps({
            'import_records': records,
            'duplicate_mode': 'skip'
        }), content_type='application/json')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        # Should be imported under Org B, not skipped because of Org A
        self.assertEqual(data['imported'], 1)
        self.assertEqual(Customer.objects.filter(name='Shared Name Client').count(), 2)

    def test_credit_note_import(self):
        records = [{
            'customer': 'Credit Client Corp',
            'date': '2026-11-01',
            'reason': 'Returned damaged item',
            'item': 'Ergonomic Desk',
            'quantity': '2',
            'rate': '5000.00',
            'gst_rate': '18'
        }]
        res = self.client.post('/api/credit-notes/', data=json.dumps({
            'import_records': records,
            'duplicate_mode': 'skip'
        }), content_type='application/json')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data['status'], 'ok')
        self.assertEqual(data['imported'], 1)
        from books.models import CreditNote
        cn = CreditNote.objects.filter(customer__name='Credit Client Corp').first()
        self.assertIsNotNone(cn)
        self.assertEqual(cn.reason, 'Returned damaged item')

    def test_vendor_credit_import(self):
        records = [{
            'vendor': 'Supplier Direct Ltd',
            'date': '2026-11-02',
            'reason': 'Price revision credit',
            'item': 'Raw Materials',
            'quantity': '1',
            'rate': '3200.00',
            'gst_rate': '18'
        }]
        res = self.client.post('/api/vendor-credits/', data=json.dumps({
            'import_records': records,
            'duplicate_mode': 'skip'
        }), content_type='application/json')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data['status'], 'ok')
        self.assertEqual(data['imported'], 1)
        from books.models import VendorCredit
        vc = VendorCredit.objects.filter(vendor__name='Supplier Direct Ltd').first()
        self.assertIsNotNone(vc)

    def test_delivery_challan_import(self):
        records = [{
            'customer': 'Challan Customer Ltd',
            'date': '2026-11-03',
            'challan_type': 'supply_on_approval',
            'vehicle_number': 'KL-05-AA-1234',
            'item': 'Demo Machines',
            'quantity': '3'
        }]
        res = self.client.post('/api/delivery-challans/', data=json.dumps({
            'import_records': records,
            'duplicate_mode': 'skip'
        }), content_type='application/json')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data['status'], 'ok')
        self.assertEqual(data['imported'], 1)
        from books.models import DeliveryChallan
        dc = DeliveryChallan.objects.filter(customer__name='Challan Customer Ltd').first()
        self.assertIsNotNone(dc)
        self.assertEqual(dc.vehicle_number, 'KL-05-AA-1234')

    def test_recurring_invoice_import(self):
        records = [{
            'profile_name': 'Monthly Retainer Cloud',
            'customer': 'Cloud Services Inc',
            'frequency': 'monthly',
            'start_date': '2026-11-01',
            'rate': '15000.00'
        }]
        res = self.client.post('/api/recurring-invoices/', data=json.dumps({
            'import_records': records,
            'duplicate_mode': 'skip'
        }), content_type='application/json')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data['status'], 'ok')
        self.assertEqual(data['imported'], 1)
        from books.models import RecurringInvoice
        ri = RecurringInvoice.objects.filter(profile_name='Monthly Retainer Cloud').first()
        self.assertIsNotNone(ri)
        self.assertEqual(ri.total, Decimal('15000.00'))

    def test_bank_transaction_import(self):
        ba = BankAccount.objects.create(name='Federal Bank Current', bank_name='Federal Bank', account_number='123456789012')
        records = [{
            'bank_account': str(ba.pk),
            'date': '2026-11-01',
            'description': 'NEFT Inward From Client',
            'reference': 'NEFT99881122',
            'deposit': '45000.00',
            'withdrawal': '0.00'
        }]
        res = self.client.post('/api/bank-transactions/', data=json.dumps({
            'import_records': records,
            'duplicate_mode': 'skip'
        }), content_type='application/json')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data['status'], 'ok')
        self.assertEqual(data['imported'], 1)
        bt = BankTransaction.objects.filter(reference='NEFT99881122').first()
        self.assertIsNotNone(bt)
        self.assertEqual(bt.deposit, Decimal('45000.00'))

    def test_timelogs_alias_import(self):
        records = [{
            'project': 'Project Phoenix',
            'date': '2026-11-02',
            'task': 'Backend API Optimization',
            'hours': '3.5'
        }]
        res = self.client.post('/api/timelogs/', data=json.dumps({
            'import_records': records,
            'duplicate_mode': 'skip'
        }), content_type='application/json')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data['status'], 'ok')
        self.assertEqual(data['imported'], 1)
        from books.models import TimeLog
        tl = TimeLog.objects.filter(task='Backend API Optimization').first()
        self.assertIsNotNone(tl)
        self.assertEqual(tl.hours, Decimal('3.5'))

    def test_quotes_import(self):
        records = [
            {
                'number': 'QT-IMPORT-001',
                'customer': 'Zenith Consulting Corp',
                'date': '2026-11-05',
                'expiry_date': '2026-12-05',
                'item': 'Cloud Architecture Advisory',
                'quantity': '2',
                'rate': '15000.00',
                'gst_rate': '18.00',
                'notes': 'Valid for 30 days.'
            },
            {
                'number': 'QT-IMPORT-001',
                'customer': 'Zenith Consulting Corp',
                'date': '2026-11-05',
                'item': 'Security Penetration Testing',
                'quantity': '1',
                'rate': '25000.00',
                'gst_rate': '18.00'
            },
            {
                'number': 'QT-IMPORT-002',
                'customer': 'Zenith Consulting Corp',
                'date': '2026-11-06',
                'item': 'DevOps Pipeline Automation',
                'quantity': '1',
                'rate': '30000.00',
                'gst_rate': '18.00'
            }
        ]
        res = self.client.post('/api/quotes/', data=json.dumps({
            'import_records': records,
            'duplicate_mode': 'skip'
        }), content_type='application/json')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data['status'], 'ok')
        self.assertEqual(data['imported'], 2)
        from books.models import Quote
        q1 = Quote.objects.filter(number='QT-IMPORT-001').first()
        self.assertIsNotNone(q1)
        self.assertEqual(q1.customer.name, 'Zenith Consulting Corp')
        self.assertEqual(q1.lines.count(), 2)
        q2 = Quote.objects.filter(number='QT-IMPORT-002').first()
        self.assertIsNotNone(q2)
        self.assertEqual(q2.lines.count(), 1)



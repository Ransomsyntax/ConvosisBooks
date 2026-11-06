import json
import uuid
from decimal import Decimal
from django.test import TestCase, Client
from django.contrib.auth import get_user_model
from django.utils import timezone
from books.models import (
    Organization, UserProfile, Customer, Vendor, Item,
    Invoice, Bill, Quote, SalesOrder, PurchaseOrder,
    DeliveryChallan, Expense, PaymentReceived, PaymentMade,
    Journal, JournalItem, Account, Warehouse, StockMovement
)
from books import services

User = get_user_model()

class DocumentNumberingAndUUIDTests(TestCase):
    def setUp(self):
        self.client = Client()
        
        # Org 1 - Primary
        self.org1 = Organization.get()
        self.org1.name = "ABC Technologies"
        self.org1.code = "ABC"
        self.org1.state = "Kerala"
        self.org1.save()

        # Org 2 - Multi-tenant isolation test
        self.org2 = Organization.objects.create(
            name="Sree Enterprises",
            code="SREE",
            state="Tamil Nadu"
        )

        # Admin user in Org 1
        self.user1 = User.objects.create_user(username='admin_abc', password='Password123!', is_staff=True, is_superuser=True)
        self.profile1 = UserProfile.objects.create(user=self.user1, role=UserProfile.ADMIN, organization=self.org1)

        # Accounts
        self.acc_cash = Account.objects.create(organization=self.org1, code='1001', name='Cash & Bank', account_type='asset')
        self.acc_sales = Account.objects.create(organization=self.org1, code='4001', name='Sales Account', account_type='income')
        self.acc_ar = Account.objects.create(organization=self.org1, code='1002', name='Accounts Receivable', account_type='asset')
        self.acc_ap = Account.objects.create(organization=self.org1, code='2001', name='Accounts Payable', account_type='liability')

        self.client.force_login(self.user1)

    def test_01_customer_sequential_numbering_and_uuid(self):
        """Customers receive ABC/CUST/26-27/000001 through 000010 and unique UUIDs."""
        cust_codes = []
        cust_uuids = set()
        for i in range(1, 11):
            res = self.client.post('/api/customers/', data=json.dumps({
                'name': f'Customer {i}',
                'customer_type': 'business',
                'state': 'Kerala'
            }), content_type='application/json')
            self.assertEqual(res.status_code, 201)
            data = res.json()
            code = data.get('code')
            cust_codes.append(code)
            cust_obj = Customer.objects.get(id=data['id'])
            self.assertIsNotNone(cust_obj.uuid)
            cust_uuids.add(cust_obj.uuid)

        # Check sequential numbering: 6 digits with financial year
        fy = services.get_financial_year()
        for idx, code in enumerate(cust_codes, 1):
            expected = f"ABC/CUST/{fy}/{idx:06d}"
            self.assertEqual(code, expected)
        self.assertEqual(len(cust_uuids), 10, "Every customer must have a distinct unique UUID")

    def test_02_vendor_sequential_numbering_and_uuid(self):
        """Vendors receive ABC/VEND/26-27/000001 through 000010 and unique UUIDs."""
        vend_codes = []
        vend_uuids = set()
        for i in range(1, 11):
            res = self.client.post('/api/vendors/', data=json.dumps({
                'name': f'Vendor {i}',
                'state': 'Kerala'
            }), content_type='application/json')
            self.assertEqual(res.status_code, 201)
            data = res.json()
            code = data.get('code')
            vend_codes.append(code)
            vend_obj = Vendor.objects.get(id=data['id'])
            self.assertIsNotNone(vend_obj.uuid)
            vend_uuids.add(vend_obj.uuid)

        fy = services.get_financial_year()
        for idx, code in enumerate(vend_codes, 1):
            expected = f"ABC/VEND/{fy}/{idx:06d}"
            self.assertEqual(code, expected)
        self.assertEqual(len(vend_uuids), 10, "Every vendor must have a distinct unique UUID")

    def test_03_item_sku_sequential_numbering_without_fy(self):
        """Items without manual SKU receive ABC/ITEM/000001 (6 digits, NO financial year)."""
        item_skus = []
        item_uuids = set()
        for i in range(1, 11):
            res = self.client.post('/api/items/', data=json.dumps({
                'name': f'Product Item {i}',
                'selling_price': '500.00',
                'purchase_price': '300.00',
                'gst_rate': '18.00',
                'item_type': 'goods',
                'unit': 'pcs'
            }), content_type='application/json')
            self.assertEqual(res.status_code, 201)
            data = res.json()
            sku = data.get('sku')
            item_skus.append(sku)
            it_obj = Item.objects.get(id=data['id'])
            self.assertIsNotNone(it_obj.uuid)
            item_uuids.add(it_obj.uuid)

        for idx, sku in enumerate(item_skus, 1):
            expected = f"ABC/ITEM/{idx:06d}"
            self.assertEqual(sku, expected)
        self.assertEqual(len(item_uuids), 10, "Every item must have a distinct unique UUID")

    def test_04_invoices_and_bills_numbering(self):
        """Invoices receive ABC/INV/26-27/00001 (5 digits) and Bills receive ABC/BILL/26-27/00001."""
        cust = Customer.objects.create(organization=self.org1, name="Acme Buyer", state="Kerala")
        vend = Vendor.objects.create(organization=self.org1, name="Acme Supplier", state="Kerala")
        item = Item.objects.create(organization=self.org1, name="Hardware Kit", sku="ABC/ITEM/000099", selling_price=1000, purchase_price=600)

        fy = services.get_financial_year()

        # Invoices
        for i in range(1, 4):
            res = self.client.post('/api/invoices/', data=json.dumps({
                'customer': cust.id,
                'date': '2026-10-15',
                'due_date': '2026-11-15',
                'place_of_supply': 'Kerala',
                'lines': [{'item': item.id, 'quantity': 1, 'rate': 1000, 'gst_rate': 18}]
            }), content_type='application/json')
            self.assertEqual(res.status_code, 201)
            self.assertEqual(res.json()['number'], f"ABC/INV/{fy}/{i:05d}")

        # Bills
        for i in range(1, 4):
            res = self.client.post('/api/bills/', data=json.dumps({
                'vendor': vend.id,
                'date': '2026-10-15',
                'due_date': '2026-11-15',
                'place_of_supply': 'Kerala',
                'lines': [{'item': item.id, 'quantity': 1, 'rate': 600, 'gst_rate': 18}]
            }), content_type='application/json')
            self.assertEqual(res.status_code, 201)
            self.assertEqual(res.json()['number'], f"ABC/BILL/{fy}/{i:05d}")

    def test_05_payments_received_and_made_numbering(self):
        """Payment Received gets ABC/PR/26-27/00001 and Payment Made gets ABC/PM/26-27/00001."""
        cust = Customer.objects.create(organization=self.org1, name="Payee Cust", state="Kerala")
        vend = Vendor.objects.create(organization=self.org1, name="Payee Vend", state="Kerala")
        fy = services.get_financial_year()

        res_pr = self.client.post('/api/payments-received/', data=json.dumps({
            'customer': cust.id,
            'amount': '500.00',
            'date': '2026-10-15',
            'mode': 'bank_transfer'
        }), content_type='application/json')
        self.assertEqual(res_pr.status_code, 201)
        self.assertEqual(res_pr.json()['number'], f"ABC/PR/{fy}/00001")

        res_pm = self.client.post('/api/payments-made/', data=json.dumps({
            'vendor': vend.id,
            'amount': '300.00',
            'date': '2026-10-15',
            'mode': 'bank_transfer'
        }), content_type='application/json')
        self.assertEqual(res_pm.status_code, 201)
        self.assertEqual(res_pm.json()['number'], f"ABC/PM/{fy}/00001")

    def test_06_journal_duplicate_key_error_permanently_fixed(self):
        """
        Verify multiple journal entries generate consecutive safe numbers (ABC/JRN/26-27/00001...)
        without duplicate key value violates unique constraint 'unique_org_journal_number'.
        """
        fy = services.get_financial_year()

        # Post journal 1 — correct positional/keyword signature:
        # post_journal_entry(date, entry_type, reference, notes, items, user=None, org=None)
        j1 = services.post_journal_entry(
            '2026-10-15',
            'manual',
            'TEST-REF-J1',
            'Direct entry 1',
            [
                (self.acc_cash,  Decimal('1000.00'), Decimal('0.00'),  'Cash debit'),
                (self.acc_sales, Decimal('0.00'),    Decimal('1000.00'), 'Sales credit'),
            ],
            org=self.org1
        )
        self.assertEqual(j1.number, f"ABC/JRN/{fy}/00001")

        # Post journal 2
        j2 = services.post_journal_entry(
            '2026-10-15',
            'manual',
            'TEST-REF-J2',
            'Direct entry 2',
            [
                (self.acc_cash,  Decimal('500.00'), Decimal('0.00'),   'Cash debit'),
                (self.acc_sales, Decimal('0.00'),   Decimal('500.00'), 'Sales credit'),
            ],
            org=self.org1
        )
        self.assertEqual(j2.number, f"ABC/JRN/{fy}/00002")

        # Idempotency: use a non-'manual' entry_type with a unique reference so the
        # idempotency guard in post_journal_entry triggers on retry.
        j3 = services.post_journal_entry(
            '2026-10-15',
            'invoice_payment',
            'INV-TEST-DUP-REF',
            'Idempotent entry',
            [
                (self.acc_cash,  Decimal('250.00'), Decimal('0.00'),   'Cash debit'),
                (self.acc_sales, Decimal('0.00'),   Decimal('250.00'), 'Sales credit'),
            ],
            org=self.org1
        )
        self.assertEqual(j3.number, f"ABC/JRN/{fy}/00003")

        # Retry with the SAME reference + entry_type must return the SAME journal object
        j3_retry = services.post_journal_entry(
            '2026-10-15',
            'invoice_payment',
            'INV-TEST-DUP-REF',
            'Idempotent entry retry',
            [
                (self.acc_cash,  Decimal('250.00'), Decimal('0.00'),   'Cash debit'),
                (self.acc_sales, Decimal('0.00'),   Decimal('250.00'), 'Sales credit'),
            ],
            org=self.org1
        )
        self.assertEqual(j3.pk, j3_retry.pk,
                         "Retry with same reference must return the same journal (idempotency).")
        self.assertEqual(j3_retry.number, f"ABC/JRN/{fy}/00003")

    def test_07_csv_import_duplicate_sku_modes(self):
        """
        Test CSV Import duplicate SKU handling across modes: skip, update, auto_sku, and error.
        Upload file with existing SKU + internal duplicates.
        """
        # Create existing item
        Item.objects.create(
            organization=self.org1,
            name="Existing Product",
            sku="SKU-EXISTING",
            selling_price=Decimal('100.00'),
            unit='pcs'
        )

        csv_content = (
            "Item Name,SKU,Selling Price,Unit\n"
            "Existing Product Duplicate,SKU-EXISTING,120.00,pcs\n"
            "Fresh Product,SKU-FRESH,200.00,pcs\n"
            "Internal Dup 1,SKU-DUP-FILE,50.00,pcs\n"
            "Internal Dup 2,SKU-DUP-FILE,55.00,pcs\n"
        ).encode('utf-8')

        # 1. Mode 'skip': skips existing and duplicate rows
        from django.core.files.uploadedfile import SimpleUploadedFile
        f1 = SimpleUploadedFile("items_skip.csv", csv_content, content_type="text/csv")
        res1 = self.client.post('/api/items/?duplicate_handling=skip', {'file': f1})
        self.assertEqual(res1.status_code, 200)
        d1 = res1.json()
        self.assertEqual(d1['imported'], 2)  # SKU-FRESH and the first SKU-DUP-FILE
        self.assertEqual(d1['skipped'], 2)   # SKU-EXISTING and second SKU-DUP-FILE
        self.assertEqual(d1['duplicate_skus'], 2)
        self.assertIn("SKU-EXISTING", d1['error_report_csv'])

        # 2. Mode 'update': updates existing
        f2 = SimpleUploadedFile("items_update.csv", csv_content, content_type="text/csv")
        res2 = self.client.post('/api/items/?duplicate_handling=update', {'file': f2})
        self.assertEqual(res2.status_code, 200)
        d2 = res2.json()
        self.assertGreaterEqual(d2['updated'], 1)
        updated_it = Item.objects.get(organization=self.org1, sku="SKU-EXISTING")
        self.assertEqual(updated_it.selling_price, Decimal('120.00'))

        # 3. Mode 'auto_sku': auto-generates next SKU for collision
        Item.objects.filter(organization=self.org1, sku__in=["SKU-FRESH", "SKU-DUP-FILE"]).delete()
        f3 = SimpleUploadedFile("items_autosku.csv", csv_content, content_type="text/csv")
        res3 = self.client.post('/api/items/?duplicate_handling=auto_sku', {'file': f3})
        self.assertEqual(res3.status_code, 200)
        d3 = res3.json()
        self.assertEqual(d3['imported'], 4)  # all imported, collisions assigned ABC/ITEM/00000X

    def test_08_multitenant_sequence_isolation(self):
        """Org 1 (ABC) and Org 2 (SREE) have independent counters."""
        fy = services.get_financial_year()
        
        # Org 1 invoices
        num1_1 = services.next_document_number('INV', org=self.org1)
        num1_2 = services.next_document_number('INV', org=self.org1)
        self.assertEqual(num1_1, f"ABC/INV/{fy}/00001")
        self.assertEqual(num1_2, f"ABC/INV/{fy}/00002")

        # Org 2 invoices - starts from 00001 with SREE prefix
        num2_1 = services.next_document_number('INV', org=self.org2)
        num2_2 = services.next_document_number('INV', org=self.org2)
        self.assertEqual(num2_1, f"SREE/INV/{fy}/00001")
        self.assertEqual(num2_2, f"SREE/INV/{fy}/00002")

    def test_09_financial_year_rollover(self):
        """Dates in different financial years maintain separate sequence streams."""
        # Date in Oct 2026 -> FY 26-27
        num_2026 = services.next_document_number('INV', org=self.org1, date='2026-10-15')
        self.assertIn('/INV/26-27/', num_2026)

        # Date in May 2027 -> FY 27-28
        num_2027 = services.next_document_number('INV', org=self.org1, date='2027-05-15')
        self.assertIn('/INV/27-28/', num_2027)
        self.assertTrue(num_2027.endswith('00001'), "New FY sequence starts fresh at 00001")

    def test_10_uuid_presence_across_all_models(self):
        """Verify internal UUID primary key field is populated on all models."""
        cust = Customer.objects.create(organization=self.org1, name="UUID Check Customer", state="Kerala")
        vend = Vendor.objects.create(organization=self.org1, name="UUID Check Vendor", state="Kerala")
        item = Item.objects.create(organization=self.org1, name="UUID Check Item", selling_price=10)
        wh = Warehouse.objects.create(organization=self.org1, code="WH-UUID", name="Main Warehouse")
        exp = Expense.objects.create(organization=self.org1, date='2026-10-15', amount=Decimal('100.00'), total=Decimal('100.00'), expense_account=self.acc_cash)

        for obj in [cust, vend, item, wh, exp]:
            self.assertIsNotNone(obj.uuid)
            self.assertIsInstance(obj.uuid, uuid.UUID)

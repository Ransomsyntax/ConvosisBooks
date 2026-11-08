import json
from decimal import Decimal
from django.test import TestCase, Client
from django.contrib.auth import get_user_model
from django.utils import timezone
from books.models import (
    Organization, Customer, Item, BankAccount, Account,
    Invoice, InvoiceLine, Quote, QuoteLine, SalesOrder, SalesOrderLine,
    PaymentReceived, BankTransaction, Journal
)

User = get_user_model()

class InvoicePaymentIntegrationTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_superuser(username='admin', email='admin@test.com', password='password123')
        self.client.force_login(self.user)

        self.org = Organization.get()
        self.org.name = 'Convosis Books Corp'
        self.org.state = 'Kerala'
        self.org.save()

        # GL Accounts
        self.ar_account, _ = Account.objects.get_or_create(code='1200', defaults={'name': 'Accounts Receivable', 'account_type': 'asset', 'organization': self.org})
        self.bank_gl, _ = Account.objects.get_or_create(code='1015', defaults={'name': 'HDFC Bank Account', 'account_type': 'asset', 'organization': self.org})

        # Bank Account
        self.bank_account = BankAccount.objects.create(
            name='Primary Current A/C',
            bank_name='HDFC Bank',
            account_number='50200012345678',
            ifsc='HDFC0001234',
            account_type='current',
            currency='INR',
            opening_balance=Decimal('50000.00'),
            current_balance=Decimal('50000.00'),
            bank_balance=Decimal('50000.00'),
            gl_account=self.bank_gl,
            organization=self.org,
            active=True
        )

        # Customer
        self.customer = Customer.objects.create(
            name='Acme Corp',
            email='billing@acme.com',
            state='Kerala',
            payment_terms=30,
            active=True,
            organization=self.org
        )

        # Item
        self.item = Item.objects.create(
            name='ERP Consulting',
            item_type='service',
            selling_price=Decimal('10000.00'),
            purchase_price=Decimal('5000.00'),
            gst_rate=Decimal('18.00'),
            organization=self.org,
            active=True
        )

    def test_bank_accounts_lookup(self):
        resp = self.client.get('/api/lookup/bank-accounts/')
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(len(data) >= 1)
        ba = next(b for b in data if b['id'] == self.bank_account.id)
        self.assertIn('display_name', ba)
        self.assertIn('5678', ba['display_name'])
        self.assertIn('HDFC Bank', ba['display_name'])
        self.assertEqual(Decimal(str(ba['balance'])), Decimal('50000.00'))

    def test_invoice_creation_and_balance(self):
        # Create draft invoice
        payload = {
            'customer': self.customer.id,
            'date': str(timezone.localdate()),
            'due_date': str(timezone.localdate()),
            'place_of_supply': 'Kerala',
            'lines': [
                {
                    'item': self.item.id,
                    'description': 'Consulting 10 hrs',
                    'quantity': 1,
                    'rate': '10000.00',
                    'gst_rate': '18.00'
                }
            ]
        }
        resp = self.client.post('/api/invoices/', data=json.dumps(payload), content_type='application/json')
        self.assertIn(resp.status_code, [200, 201])
        inv_data = resp.json()
        inv_id = inv_data['id']

        # Check detail API
        resp = self.client.get(f'/api/invoices/{inv_id}/')
        self.assertEqual(resp.status_code, 200)
        detail = resp.json()
        self.assertEqual(Decimal(str(detail['total'])), Decimal('11800.00'))
        self.assertEqual(Decimal(str(detail['paid'])), Decimal('0.00'))
        self.assertEqual(Decimal(str(detail['balance'])), Decimal('11800.00'))
        self.assertEqual(detail['source_type'], 'manual')

    def test_record_partial_and_full_payment_workflow(self):
        # 1. Create invoice
        inv = Invoice.objects.create(
            customer=self.customer,
            number='INV-TEST-001',
            date=timezone.localdate(),
            due_date=timezone.localdate(),
            place_of_supply='Kerala',
            status='draft',
            subtotal=Decimal('10000.00'),
            cgst=Decimal('900.00'),
            sgst=Decimal('900.00'),
            igst=Decimal('0.00'),
            total=Decimal('11800.00'),
            organization=self.org
        )
        InvoiceLine.objects.create(
            invoice=inv,
            item=self.item,
            description='Consulting',
            quantity=Decimal('1.000'),
            rate=Decimal('10000.00'),
            gst_rate=Decimal('18.00'),
            taxable=Decimal('10000.00'),
            tax_amount=Decimal('1800.00'),
            line_total=Decimal('11800.00')
        )

        initial_bank_bal = self.bank_account.current_balance

        # 2. Record partial payment of 5000.00
        pay_payload = {
            'customer': self.customer.id,
            'date': str(timezone.localdate()),
            'amount': '5000.00',
            'mode': 'bank_transfer',
            'bank_account_id': self.bank_account.id,
            'reference': 'UTR12345678',
            'notes': 'Partial payment 1',
            'allocations': [
                {'invoice': inv.id, 'amount': '5000.00'}
            ]
        }
        resp = self.client.post('/api/payments-received/', data=json.dumps(pay_payload), content_type='application/json')
        self.assertIn(resp.status_code, [200, 201])
        pay1_data = resp.json()
        pay1_id = pay1_data['id']

        # Verify BankAccount updated
        self.bank_account.refresh_from_db()
        self.assertEqual(self.bank_account.current_balance, initial_bank_bal + Decimal('5000.00'))

        # Verify BankTransaction created
        bt1 = BankTransaction.objects.filter(matched_entity_type='payment_received', matched_entity_id=pay1_id).first()
        self.assertIsNotNone(bt1)
        self.assertEqual(bt1.deposit, Decimal('5000.00'))
        self.assertEqual(bt1.bank_account, self.bank_account)
        self.assertEqual(bt1.status, 'categorized')

        # Verify Invoice status and balance
        resp = self.client.get(f'/api/invoices/{inv.id}/')
        inv_detail = resp.json()
        self.assertEqual(Decimal(str(inv_detail['paid'])), Decimal('5000.00'))
        self.assertEqual(Decimal(str(inv_detail['balance'])), Decimal('6800.00'))
        self.assertEqual(inv_detail['status'], 'Partially Paid')
        self.assertEqual(len(inv_detail['payments']), 1)
        self.assertEqual(inv_detail['payments'][0]['bank_account_name'], self.bank_account.name)

        # 3. Test overpayment rejection: attempting to pay 7000.00 when balance is 6800.00
        overpay_payload = {
            'customer': self.customer.id,
            'date': str(timezone.localdate()),
            'amount': '7000.00',
            'mode': 'bank_transfer',
            'bank_account_id': self.bank_account.id,
            'allocations': [
                {'invoice': inv.id, 'amount': '7000.00'}
            ]
        }
        resp = self.client.post('/api/payments-received/', data=json.dumps(overpay_payload), content_type='application/json')
        self.assertEqual(resp.status_code, 400)

        # 4. Record remaining payment of 6800.00
        pay2_payload = {
            'customer': self.customer.id,
            'date': str(timezone.localdate()),
            'amount': '6800.00',
            'mode': 'bank_transfer',
            'bank_account_id': self.bank_account.id,
            'reference': 'UTR87654321',
            'allocations': [
                {'invoice': inv.id, 'amount': '6800.00'}
            ]
        }
        resp = self.client.post('/api/payments-received/', data=json.dumps(pay2_payload), content_type='application/json')
        self.assertIn(resp.status_code, [200, 201])
        pay2_id = resp.json()['id']

        # Verify BankAccount balance updated
        self.bank_account.refresh_from_db()
        self.assertEqual(self.bank_account.current_balance, initial_bank_bal + Decimal('11800.00'))

        # Verify Invoice fully paid
        resp = self.client.get(f'/api/invoices/{inv.id}/')
        inv_detail = resp.json()
        self.assertEqual(Decimal(str(inv_detail['balance'])), Decimal('0.00'))
        self.assertEqual(inv_detail['status'], 'Paid')
        self.assertEqual(len(inv_detail['payments']), 2)

        # 5. Test Payment Reversal / Deletion
        del_resp = self.client.delete(f'/api/payments-received/{pay2_id}/')
        self.assertIn(del_resp.status_code, [200, 204])

        # Bank balance should reverse by 6800.00
        self.bank_account.refresh_from_db()
        self.assertEqual(self.bank_account.current_balance, initial_bank_bal + Decimal('5000.00'))

        # BankTransaction for pay2 should be deleted
        self.assertFalse(BankTransaction.objects.filter(matched_entity_type='payment_received', matched_entity_id=pay2_id).exists())

        # Invoice balance should restore to 6800.00 and Partially Paid
        resp = self.client.get(f'/api/invoices/{inv.id}/')
        inv_detail = resp.json()
        self.assertEqual(Decimal(str(inv_detail['balance'])), Decimal('6800.00'))
        self.assertEqual(inv_detail['status'], 'Partially Paid')

    def test_sales_order_conversion_reference_and_no_duplicates(self):
        # Create Sales Order
        so = SalesOrder.objects.create(
            customer=self.customer,
            number='SO-TEST-001',
            date=timezone.localdate(),
            due_date=timezone.localdate(),
            place_of_supply='Kerala',
            status='confirmed',
            subtotal=Decimal('5000.00'),
            cgst=Decimal('450.00'),
            sgst=Decimal('450.00'),
            igst=Decimal('0.00'),
            total=Decimal('5900.00'),
            organization=self.org
        )
        SalesOrderLine.objects.create(
            order=so,
            item=self.item,
            description='Order item',
            quantity=Decimal('1.000'),
            rate=Decimal('5000.00'),
            gst_rate=Decimal('18.00'),
            taxable=Decimal('5000.00'),
            tax_amount=Decimal('900.00'),
            line_total=Decimal('5900.00')
        )

        # Convert to invoice
        resp = self.client.post(f'/api/sales-orders/{so.id}/convert-to-invoice/', data=json.dumps({}), content_type='application/json')
        self.assertEqual(resp.status_code, 200)
        res_data = resp.json()
        inv_id = res_data['invoice_id']

        # Verify SO status closed
        so.refresh_from_db()
        self.assertEqual(so.status, 'closed')

        # Verify Invoice source tracking
        resp = self.client.get(f'/api/invoices/{inv_id}/')
        inv_data = resp.json()
        self.assertEqual(inv_data['order_number'], so.number)
        self.assertEqual(inv_data['source_type'], 'sales_order')
        self.assertIn(so.number, inv_data['source_label'])

        # Attempt duplicate conversion should fail
        dup_resp = self.client.post(f'/api/sales-orders/{so.id}/convert-to-invoice/', data=json.dumps({}), content_type='application/json')
        self.assertEqual(dup_resp.status_code, 400)

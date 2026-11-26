import json
from decimal import Decimal
from django.test import TestCase, Client
from django.contrib.auth import get_user_model
from django.utils import timezone
from books.models import (
    Organization, Customer, Vendor, Item, BankAccount, Account,
    Invoice, InvoiceLine, PaymentReceived, ReceivedAllocation,
    Journal, JournalItem, UserProfile
)

User = get_user_model()

class InvoiceStatusAndPaymentSyncTestCase(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(
            username='sync_tester', email='sync_tester@example.com', password='password123'
        )
        self.client.force_login(self.user)
        self.org = Organization.get()
        self.org.state = 'Kerala'
        self.org.save()
        profile, _ = UserProfile.objects.get_or_create(
            user=self.user,
            defaults={'organization': self.org, 'role': UserProfile.ADMIN},
        )
        profile.organization = self.org
        profile.save(update_fields=['organization'])

        self.customer = Customer.objects.create(
            name='Acme Infotech', email='acme@example.com', state='Kerala', organization=self.org
        )
        self.item = Item.objects.create(
            name='Software Consulting', selling_price=Decimal('1000.00'), purchase_price=Decimal('500.00'),
            gst_rate=Decimal('18.00'), organization=self.org
        )
        self.bank_acc = BankAccount.objects.create(
            name='Operating Bank Account', account_number='1234567890', ifsc='HDFC0001234',
            organization=self.org, current_balance=Decimal('0.00'), bank_balance=Decimal('0.00')
        )

    def test_mark_as_sent_lifecycle(self):
        """Test A - Invoice Status: Draft -> Mark as Sent -> Verified in Detail & List."""
        # 1. Create Invoice as Draft
        payload = {
            'customer': self.customer.id,
            'date': str(timezone.localdate()),
            'due_date': str(timezone.localdate()),
            'place_of_supply': 'Kerala',
            'lines': [
                {
                    'item': self.item.id,
                    'description': 'Software Consulting',
                    'quantity': 2,
                    'rate': '1000.00',
                    'gst_rate': '18.00'
                }
            ]
        }
        res = self.client.post('/api/invoices/', data=json.dumps(payload), content_type='application/json')
        self.assertIn(res.status_code, (200, 201), res.content)
        inv_id = res.json()['id']
        inv = Invoice.objects.get(pk=inv_id)
        self.assertEqual(inv.status, 'draft')
        self.assertIsNone(inv.sent_at)

        # 2. Mark as Sent
        sres = self.client.post(f'/api/invoices/{inv_id}/mark-sent/')
        self.assertEqual(sres.status_code, 200, sres.content)
        data = sres.json()
        self.assertEqual(data['status'], 'ok')
        self.assertEqual(data['raw_status'], 'sent')
        self.assertIsNotNone(data['sent_at'])

        # 3. Verify in database
        inv.refresh_from_db()
        self.assertEqual(inv.status, 'sent')
        self.assertIsNotNone(inv.sent_at)

        # 4. Verify in detail API
        dres = self.client.get(f'/api/invoices/{inv_id}/')
        self.assertEqual(dres.status_code, 200)
        ddata = dres.json()
        self.assertEqual(ddata['status'], 'Sent')
        self.assertEqual(ddata['raw_status'], 'sent')
        self.assertEqual(Decimal(str(ddata['balance'])), Decimal('2360.00'))

        # 5. Verify prevent invalid transition (re-sending draft error if already sent)
        sres2 = self.client.post(f'/api/invoices/{inv_id}/mark-sent/')
        self.assertEqual(sres2.status_code, 409)

    def test_payment_recording_partial_and_full_sync(self):
        """Test B - Partial payment -> Partially Paid -> Full payment -> Paid -> Zero balance."""
        # Create and send invoice
        inv = Invoice.objects.create(
            organization=self.org, customer=self.customer, number='INV-TEST-001',
            date=timezone.localdate(), due_date=timezone.localdate(),
            place_of_supply='Kerala', status='sent', subtotal=Decimal('2000.00'),
            cgst=Decimal('180.00'), sgst=Decimal('180.00'), igst=Decimal('0.00'),
            total=Decimal('2360.00')
        )
        InvoiceLine.objects.create(
            invoice=inv, item=self.item, description='Consulting', quantity=Decimal('2'),
            rate=Decimal('1000.00'), taxable=Decimal('2000.00'), tax_amount=Decimal('360.00'),
            line_total=Decimal('2360.00'), position=1
        )

        # Record partial payment of 1000.00
        pay1_payload = {
            'customer': self.customer.id,
            'amount': '1000.00',
            'date': str(timezone.localdate()),
            'mode': 'bank_transfer',
            'bank_account_id': self.bank_acc.id,
            'allocations': [{'invoice': inv.id, 'amount': '1000.00'}]
        }
        res1 = self.client.post('/api/payments-received/', data=json.dumps(pay1_payload), content_type='application/json')
        self.assertIn(res1.status_code, (200, 201), res1.content)

        # Verify invoice is Partially Paid
        inv.refresh_from_db()
        self.assertEqual(inv.status, 'partial')
        self.assertEqual(inv.paid_amount, Decimal('1000.00'))
        self.assertEqual(inv.balance_due, Decimal('1360.00'))

        # Check API detail & row status
        dres1 = self.client.get(f'/api/invoices/{inv.id}/')
        self.assertEqual(dres1.status_code, 200)
        self.assertEqual(dres1.json()['status'], 'Partially Paid')
        self.assertEqual(Decimal(str(dres1.json()['balance'])), Decimal('1360.00'))

        # Record remaining payment of 1360.00
        pay2_payload = {
            'customer': self.customer.id,
            'amount': '1360.00',
            'date': str(timezone.localdate()),
            'mode': 'bank_transfer',
            'bank_account_id': self.bank_acc.id,
            'allocations': [{'invoice': inv.id, 'amount': '1360.00'}]
        }
        res2 = self.client.post('/api/payments-received/', data=json.dumps(pay2_payload), content_type='application/json')
        self.assertIn(res2.status_code, (200, 201), res2.content)

        # Verify invoice is Paid with 0 balance
        inv.refresh_from_db()
        self.assertEqual(inv.status, 'paid')
        self.assertEqual(inv.paid_amount, Decimal('2360.00'))
        self.assertEqual(inv.balance_due, Decimal('0.00'))

        dres2 = self.client.get(f'/api/invoices/{inv.id}/')
        self.assertEqual(dres2.status_code, 200)
        self.assertEqual(dres2.json()['status'], 'Paid')
        self.assertEqual(Decimal(str(dres2.json()['balance'])), Decimal('0.00'))

    def test_payment_reversal_status_recalculation(self):
        """Test C - Payment Reversal/Delete recalculates invoice status & balance correctly."""
        inv = Invoice.objects.create(
            organization=self.org, customer=self.customer, number='INV-TEST-002',
            date=timezone.localdate(), due_date=timezone.localdate(),
            place_of_supply='Kerala', status='sent', subtotal=Decimal('1000.00'),
            cgst=Decimal('90.00'), sgst=Decimal('90.00'), igst=Decimal('0.00'),
            total=Decimal('1180.00')
        )
        pay_payload = {
            'customer': self.customer.id,
            'amount': '1180.00',
            'date': str(timezone.localdate()),
            'mode': 'bank_transfer',
            'bank_account_id': self.bank_acc.id,
            'allocations': [{'invoice': inv.id, 'amount': '1180.00'}]
        }
        res = self.client.post('/api/payments-received/', data=json.dumps(pay_payload), content_type='application/json')
        self.assertIn(res.status_code, (200, 201), res.content)
        pay_id = res.json()['id']

        inv.refresh_from_db()
        self.assertEqual(inv.status, 'paid')
        self.assertEqual(inv.balance_due, Decimal('0.00'))

        # Delete / Reverse payment
        del_res = self.client.delete(f'/api/payments-received/{pay_id}/')
        self.assertIn(del_res.status_code, (200, 204), del_res.content)

        # Verify invoice recalculated back to 'sent' with full balance
        inv.refresh_from_db()
        self.assertEqual(inv.status, 'sent')
        self.assertEqual(inv.paid_amount, Decimal('0.00'))
        self.assertEqual(inv.balance_due, Decimal('1180.00'))

        dres = self.client.get(f'/api/invoices/{inv.id}/')
        self.assertEqual(dres.status_code, 200)
        self.assertEqual(dres.json()['status'], 'Sent')
        self.assertEqual(Decimal(str(dres.json()['balance'])), Decimal('1180.00'))

import json
import threading
from decimal import Decimal
from django.test import TransactionTestCase, Client
from django.contrib.auth import get_user_model
from books.models import (
    Organization, UserProfile, TransactionSeries, DocumentNumberSeries,
    Invoice, Quote, SalesOrder, Bill, PurchaseOrder, RetainerInvoice,
    CreditNote, VendorCredit, DeliveryChallan, StockTransfer, StockMovement,
    PaymentReceived, PaymentMade, Customer, Item, DocumentNumberAllocation,
    RecurringInvoice
)
from books import services

User = get_user_model()

def to_str(val):
    if isinstance(val, dict):
        return val.get('formatted') or val.get('next_number') or ''
    return str(val)

class TransactionNumberSeriesIntegrationTests(TransactionTestCase):
    def setUp(self):
        self.org_name = "Test Series Org Automated Test"
        self.org = Organization.objects.filter(name=self.org_name).first()
        if not self.org:
            self.org = Organization.objects.create(name=self.org_name, legal_name=self.org_name, state="Kerala")

        self.user = User.objects.filter(username="test_series_tester").first()
        if not self.user:
            self.user = User.objects.create_user(username="test_series_tester", email="tester@convosis.com", password="Password123!")

        self.profile, _ = UserProfile.objects.get_or_create(user=self.user, defaults={'organization': self.org, 'role': UserProfile.ADMIN})
        self.profile.organization = self.org
        self.profile.role = UserProfile.ADMIN
        self.profile.save()

        self.client = Client()
        self.client.force_login(self.user)

    def test_all_18_cases(self):
        org = self.org
        client = self.client
        test_user = self.user

        # Clean prior test state
        DocumentNumberAllocation.objects.filter(organization=org).delete()
        DocumentNumberSeries.objects.filter(organization=org, name='Kerala Branch Series').delete()
        TransactionSeries.objects.filter(organization=org, name='Kerala Branch Series').delete()
        Invoice.objects.filter(organization=org).delete()
        Quote.objects.filter(organization=org).delete()
        SalesOrder.objects.filter(organization=org).delete()

        # Case 1: Series Creation Verification
        res = client.post('/api/settings/transaction-series/', data=json.dumps({
            'name': 'Kerala Branch Series',
            'branch': 'Kochi',
            'location': 'Kochi Warehouse',
            'is_default': False,
            'is_active': True,
            'items': [
                {'document_type': 'invoices', 'prefix': 'KER-INV-', 'next_number': '000001'}
            ]
        }), content_type='application/json')
        self.assertEqual(res.status_code, 201)

        prev = services.preview_document_number('INV', org=org, series='Kerala Branch Series')
        self.assertEqual(prev['formatted'], 'KER-INV-000001')

        # Case 2: Prefix Modification
        ts = TransactionSeries.objects.get(organization=org, name='Kerala Branch Series')
        res = client.put(f'/api/settings/transaction-series/{ts.id}/', data=json.dumps({
            'name': 'Kerala Branch Series',
            'branch': 'Kochi',
            'location': 'Kochi Warehouse',
            'is_default': False,
            'is_active': True,
            'items': [
                {'document_type': 'invoices', 'prefix': 'KL-INV-', 'next_number': '000001'}
            ]
        }), content_type='application/json')
        self.assertEqual(res.status_code, 200)

        prev = services.preview_document_number('INV', org=org, series='Kerala Branch Series')
        self.assertEqual(prev['formatted'], 'KL-INV-000001')

        # Case 3: Next Number Modification
        res = client.put(f'/api/settings/transaction-series/{ts.id}/', data=json.dumps({
            'name': 'Kerala Branch Series',
            'branch': 'Kochi',
            'location': 'Kochi Warehouse',
            'is_default': False,
            'is_active': True,
            'items': [
                {'document_type': 'invoices', 'prefix': 'KL-INV-', 'next_number': '000500'}
            ]
        }), content_type='application/json')
        self.assertEqual(res.status_code, 200)

        prev = services.preview_document_number('INV', org=org, series='Kerala Branch Series')
        self.assertEqual(prev['formatted'], 'KL-INV-000500')

        # Case 4: Default Series Change
        res = client.put(f'/api/settings/transaction-series/{ts.id}/', data=json.dumps({
            'name': 'Kerala Branch Series',
            'branch': 'Kochi',
            'location': 'Kochi Warehouse',
            'is_default': True,
            'is_active': True
        }), content_type='application/json')
        self.assertEqual(res.status_code, 200)

        prev = services.preview_document_number('INV', org=org)
        self.assertEqual(prev['formatted'], 'KL-INV-000500')

        # Restore default series back to Head Office
        ho_ts, _ = TransactionSeries.objects.get_or_create(organization=org, name='Head Office', defaults={'is_default': True, 'is_active': True})
        TransactionSeries.objects.filter(organization=org).exclude(pk=ho_ts.pk).update(is_default=False)
        DocumentNumberSeries.objects.filter(organization=org).exclude(series_group=ho_ts).update(is_default=False)
        ho_ts.is_default = True
        ho_ts.save()

        # Case 5: Multi-Series Verification
        ho_inv_series, _ = DocumentNumberSeries.objects.get_or_create(
            organization=org, series_group=ho_ts, document_type='invoices',
            defaults={'prefix': 'HO-INV-', 'next_number': 100, 'padding': 4}
        )
        ho_inv_series.prefix = 'HO-INV-'
        ho_inv_series.next_number = 100
        ho_inv_series.padding = 4
        ho_inv_series.save()

        prev_ho = services.preview_document_number('INV', org=org, series='Head Office')
        prev_kl = services.preview_document_number('INV', org=org, series='Kerala Branch Series')
        self.assertEqual(prev_ho['formatted'], 'HO-INV-0100')
        self.assertEqual(prev_kl['formatted'], 'KL-INV-000500')

        # Case 6: Sequential Invoice Generation
        allocated = []
        for _ in range(5):
            num_res = services.next_document_number('INV', org=org, series='Kerala Branch Series')
            allocated.append(to_str(num_res))
        expected = ['KL-INV-000500', 'KL-INV-000501', 'KL-INV-000502', 'KL-INV-000503', 'KL-INV-000504']
        self.assertEqual(allocated, expected)

        # Case 7: Module Independence
        so_num = to_str(services.next_document_number('SO', org=org, series='Kerala Branch Series'))
        inv_num = to_str(services.next_document_number('INV', org=org, series='Kerala Branch Series'))
        self.assertNotEqual(so_num, inv_num)
        self.assertEqual(inv_num, 'KL-INV-000505')

        # Case 8: Document Conversion Numbering
        cust, _ = Customer.objects.get_or_create(organization=org, name="Test Customer Automated", defaults={'currency': 'INR'})
        q = Quote.objects.create(
            organization=org, customer=cust, date='2026-11-15', due_date='2026-11-15',
            place_of_supply='Kerala', number="TEST-QT-001", total=Decimal('100.00'),
            status='open', transaction_series='Kerala Branch Series'
        )
        res = client.post(f'/api/quotes/{q.id}/convert-to-sales-order/', data='{}', content_type='application/json')
        self.assertEqual(res.status_code, 200)
        so_rec = SalesOrder.objects.filter(source_quote=q).first()
        self.assertIsNotNone(so_rec)
        self.assertTrue(so_rec.number.startswith('SO-') or so_rec.number.startswith('KL-SO-'))

        # Case 9: Recurring Invoice Generation
        rec_prof = RecurringInvoice.objects.create(
            organization=org, customer=cust, profile_name="Monthly Support",
            start_date='2026-11-15', next_date='2026-11-15', frequency='monthly', status='active', total=Decimal('500.00'),
            branch='Kochi'
        )
        inv_from_rec = services.generate_invoice_from_recurring_profile(rec_prof)
        self.assertIsNotNone(inv_from_rec)
        self.assertTrue(inv_from_rec.number.startswith('KL-INV-'))

        # Case 10: Document Cloning
        base_inv = Invoice.objects.create(
            organization=org, customer=cust, date='2026-11-15', due_date='2026-11-15',
            place_of_supply='Kerala', number="KL-INV-000777", total=Decimal('100.00'),
            transaction_series='Kerala Branch Series'
        )
        res = client.post(f'/api/invoices/{base_inv.id}/clone/', data='{}', content_type='application/json')
        self.assertEqual(res.status_code, 200)
        cloned_data = json.loads(res.content)
        self.assertNotEqual(cloned_data['number'], base_inv.number)

        # Case 11: Manual Numbering & Duplicate Validation
        Invoice.objects.create(
            organization=org, customer=cust, date='2026-11-15', due_date='2026-11-15',
            place_of_supply='Kerala', number="MANUAL-INV-001", total=Decimal('100.00')
        )
        res = client.post('/api/invoices/', data=json.dumps({
            'customer': cust.id,
            'number': 'MANUAL-INV-001',
            'date': '2026-11-15',
            'due_date': '2026-11-15',
            'place_of_supply': 'Kerala',
            'lines': [{'description': 'Line 1', 'quantity': 1, 'rate': 100}]
        }), content_type='application/json')
        self.assertEqual(res.status_code, 400)

        # Advance counter on manual higher number
        services.sync_series_counter_from_manual_number(org, 'invoices', 'KL-INV-000999', series='Kerala Branch Series')
        prev_after_manual = services.preview_document_number('INV', org=org, series='Kerala Branch Series')
        self.assertEqual(prev_after_manual['formatted'], 'KL-INV-001000')

        # Case 12: Document Deletion Behavior
        num_to_delete = to_str(services.next_document_number('INV', org=org, series='Kerala Branch Series'))
        del_inv = Invoice.objects.create(
            organization=org, customer=cust, date='2026-11-15', due_date='2026-11-15',
            place_of_supply='Kerala', number=num_to_delete, total=Decimal('100.00'),
            transaction_series='Kerala Branch Series'
        )
        del_inv.delete()
        next_after_del = services.preview_document_number('INV', org=org, series='Kerala Branch Series')['formatted']
        self.assertGreater(next_after_del, num_to_delete)

        # Case 13: Concurrency Test
        import time
        from django.db import connection
        concurrent_numbers = []
        lock = threading.Lock()
        def allocate_worker():
            from django.db import connection
            connection.close()
            for attempt in range(15):
                try:
                    n = to_str(services.next_document_number('INV', org=org, series='Kerala Branch Series'))
                    with lock:
                        concurrent_numbers.append(n)
                    break
                except Exception:
                    time.sleep(0.05 * (attempt + 1))
                finally:
                    connection.close()

        threads = [threading.Thread(target=allocate_worker) for _ in range(10)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        self.assertEqual(len(concurrent_numbers), 10)
        self.assertEqual(len(set(concurrent_numbers)), 10)

        # Case 14: Organization Isolation
        other_org = Organization.objects.filter(name="Other Test Org Automated").first()
        if not other_org:
            other_org = Organization.objects.create(name="Other Test Org Automated", legal_name="Other Test Org Automated")
        services.ensure_default_transaction_series(other_org)

        prev_org1 = services.preview_document_number('INV', org=org, series='Head Office')['formatted']
        prev_org2 = services.preview_document_number('INV', org=other_org, series='Head Office')['formatted']

        services.next_document_number('INV', org=org, series='Head Office')
        prev_org1_after = services.preview_document_number('INV', org=org, series='Head Office')['formatted']
        prev_org2_after = services.preview_document_number('INV', org=other_org, series='Head Office')['formatted']

        self.assertNotEqual(prev_org1_after, prev_org1)
        self.assertEqual(prev_org2_after, prev_org2)

        # Case 15: Branch / Location Auto-Selection
        resolved_series = services._select_document_number_series('invoices', org=org, branch='Kochi')
        self.assertEqual(resolved_series.series_group.name, 'Kerala Branch Series')

        # Case 16: Deactivated Series
        ts.is_active = False
        ts.save()
        active_series = services.get_active_transaction_series(org)
        self.assertFalse(any(s.id == ts.id for s in active_series))
        ts.is_active = True
        ts.save()

        # Case 17: Configuration Persistence Across Reloads
        dns_item = DocumentNumberSeries.objects.filter(series_group=ts, document_type='invoices').first()
        dns_item.prefix = 'KL-PERSIST-'
        dns_item.next_number = 8888
        dns_item.padding = 6
        dns_item.save()

        reloaded = DocumentNumberSeries.objects.get(pk=dns_item.pk)
        self.assertEqual(reloaded.prefix, 'KL-PERSIST-')
        self.assertEqual(reloaded.next_number, 8888)
        self.assertEqual(reloaded.padding, 6)
        prev_persisted = services.preview_document_number('INV', org=org, series=ts.name)
        self.assertEqual(prev_persisted['formatted'], 'KL-PERSIST-008888')

        # Case 18: Full End-to-End Across All 14 Document Types
        types_to_verify = [
            ('INV', 'invoices'),
            ('SO', 'sales_orders'),
            ('QTN', 'quotes'),
            ('CN', 'credit_notes'),
            ('PR', 'payments_received'),
            ('RET', 'retainer_invoices'),
            ('RINV', 'recurring_invoices'),
            ('PO', 'purchase_orders'),
            ('BILL', 'bills'),
            ('PM', 'payments_made'),
            ('VC', 'vendor_credits'),
            ('DC', 'delivery_challans'),
            ('ADJ', 'stock_adjustments'),
            ('ST', 'stock_transfers')
        ]

        for alias, doc_type in types_to_verify:
            p = services.preview_document_number(alias, org=org, series='Head Office')
            n = to_str(services.next_document_number(alias, org=org, series='Head Office'))
            self.assertTrue(bool(n), f"Failed allocation for {alias}")
            self.assertTrue(bool(p['formatted']), f"Failed preview for {alias}")

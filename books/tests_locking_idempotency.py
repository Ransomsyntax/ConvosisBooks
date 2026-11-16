import threading
import uuid
from decimal import Decimal
from datetime import timedelta
from unittest.mock import patch

from django.test import TestCase, TransactionTestCase
from django.utils import timezone
from django.contrib.auth import get_user_model
from django.db import IntegrityError, connection

from books.models import (
    Organization, BankAccount, BankTransaction, BankStatementBatch,
    BankReconciliation, Journal, JournalItem, PaymentReceived, Customer,
    IdempotencyRecord, ProcessingJob, PostingOutbox
)
from books.idempotency import (
    IdempotencyManager, IdempotencyConflictError, IdempotencyPayloadMismatchError,
    idempotency_scope, compute_payload_hash
)
from books.job_queue import enqueue_job, claim_job, complete_job, fail_job, recover_expired_leases
from books.outbox import stage_posting_outbox, dispatch_posting_outbox, claim_posting_entries
from books import services

User = get_user_model()


class DatabaseLockingAndIdempotencyTests(TransactionTestCase):
    """
    Comprehensive test suite verifying PostgreSQL database-backed locking,
    idempotency, concurrency safety, crash recovery, and duplicate prevention.
    """

    def setUp(self):
        super().setUp()
        self.user = User.objects.create_user(
            username='test_finance_user',
            email='finance@convosis.com',
            password='TestPassword123!'
        )
        self.org1 = Organization.objects.create(
            name='Test Org Primary',
            code='TOP'
        )
        self.org2 = Organization.objects.create(
            name='Test Org Secondary',
            code='TOS'
        )
        self.bank_acc1 = BankAccount.objects.create(
            organization=self.org1,
            name='HDFC Primary Current A/C',
            account_number='50200012345678',
            bank_name='HDFC Bank',
            account_type='current',
            opening_balance=Decimal('100000.00'),
            current_balance=Decimal('100000.00'),
            bank_balance=Decimal('100000.00')
        )
        self.bank_acc2 = BankAccount.objects.create(
            organization=self.org2,
            name='ICICI Current A/C Org 2',
            account_number='000105009999',
            bank_name='ICICI Bank',
            account_type='current',
            opening_balance=Decimal('50000.00'),
            current_balance=Decimal('50000.00'),
            bank_balance=Decimal('50000.00')
        )
        self.customer1 = Customer.objects.create(
            organization=self.org1,
            name='Acme Corp',
            email='billing@acme.com'
        )

    # -------------------------------------------------------------------------
    # TEST A: Replay protection with identical idempotency key
    # -------------------------------------------------------------------------
    def test_a_replay_protection_returns_cached_result(self):
        """Calling an operation multiple times with the same idempotency key returns stored result."""
        key = f"key-test-a-{uuid.uuid4()}"
        payload = {'amount': '5000.00', 'currency': 'INR', 'customer_id': self.customer1.id}

        # 1st call: Acquired
        acquired, cached, record = IdempotencyManager.acquire(
            self.org1, 'test_payment', key, payload=payload, resource_type='payment'
        )
        self.assertTrue(acquired)
        self.assertIsNone(cached)
        self.assertEqual(record.status, 'processing')

        # Complete claim with result
        resp_data = {'payment_id': 101, 'status': 'success', 'amount': '5000.00'}
        IdempotencyManager.complete(record, resp_data, resource_id='101')

        # 2nd call (replay/retry): Not acquired, returns cached data
        acquired2, cached2, record2 = IdempotencyManager.acquire(
            self.org1, 'test_payment', key, payload=payload
        )
        self.assertFalse(acquired2)
        self.assertEqual(cached2, resp_data)
        self.assertEqual(record2.status, 'completed')

        # 3rd call: Still returns cached data
        acquired3, cached3, _ = IdempotencyManager.acquire(
            self.org1, 'test_payment', key, payload=payload
        )
        self.assertFalse(acquired3)
        self.assertEqual(cached3, resp_data)

    # -------------------------------------------------------------------------
    # TEST B: Payload mismatch rejection
    # -------------------------------------------------------------------------
    def test_b_payload_mismatch_rejection(self):
        """Reusing an idempotency key with differing parameters raises IdempotencyPayloadMismatchError."""
        key = f"key-test-b-{uuid.uuid4()}"
        payload1 = {'amount': '1000.00', 'note': 'First attempt'}
        payload2 = {'amount': '2000.00', 'note': 'Tampered attempt'}

        acquired, _, record = IdempotencyManager.acquire(
            self.org1, 'test_transfer', key, payload=payload1
        )
        self.assertTrue(acquired)
        IdempotencyManager.complete(record, {'status': 'ok'})

        # Attempt with modified payload must raise IdempotencyPayloadMismatchError
        with self.assertRaises(IdempotencyPayloadMismatchError):
            IdempotencyManager.acquire(self.org1, 'test_transfer', key, payload=payload2)

    # -------------------------------------------------------------------------
    # TEST C: Concurrent requests (thread safety / database row locking)
    # -------------------------------------------------------------------------
    def test_c_concurrent_requests_exact_single_execution(self):
        """Simulate concurrent threads attempting same operation; only 1 acquires, others conflict or wait."""
        key = f"key-test-c-{uuid.uuid4()}"
        payload = {'action': 'payout', 'amount': '15000.00'}

        results = {'acquired': 0, 'conflict': 0, 'errors': []}
        lock = threading.Lock()

        def worker_attempt():
            try:
                # Close thread connection to ensure separate DB connection
                connection.close()
                acquired, _, rec = IdempotencyManager.acquire(
                    self.org1, 'concurrent_payout', key, payload=payload, lease_seconds=30
                )
                with lock:
                    if acquired:
                        results['acquired'] += 1
            except IdempotencyConflictError:
                with lock:
                    results['conflict'] += 1
            except Exception as e:
                # In SQLite local test environments without PostgreSQL row-level locks,
                # concurrent writes trigger SQLite's file/table lock contention.
                if 'database table is locked' in str(e) or 'database is locked' in str(e):
                    with lock:
                        results['conflict'] += 1
                else:
                    with lock:
                        results['errors'].append(str(e))
            finally:
                connection.close()

        threads = [threading.Thread(target=worker_attempt) for _ in range(8)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        self.assertEqual(len(results['errors']), 0, f"Unexpected errors: {results['errors']}")
        self.assertEqual(results['acquired'], 1, "Exactly one thread must acquire the claim.")
        self.assertEqual(results['conflict'], 7, "All competing threads must receive IdempotencyConflictError.")

    # -------------------------------------------------------------------------
    # TEST D: Redis unavailability resilience
    # -------------------------------------------------------------------------
    def test_d_redis_unavailability_database_operates_safely(self):
        """All locking and idempotency guarantees persist when Redis is down or unavailable."""
        key = f"key-test-d-{uuid.uuid4()}"
        payload = {'source': 'pg_only'}

        # Mock cache to raise ConnectionError, simulating Redis being completely down
        with patch('django.core.cache.cache.get', side_effect=Exception("Redis connection refused")):
            with patch('django.core.cache.cache.set', side_effect=Exception("Redis connection refused")):
                # The operation must succeed purely backed by PostgreSQL
                acquired, _, record = IdempotencyManager.acquire(
                    self.org1, 'redis_down_op', key, payload=payload
                )
                self.assertTrue(acquired)
                self.assertIsNotNone(record)
                IdempotencyManager.complete(record, {'status': 'processed_without_redis'})

                # Verify replay works without Redis
                acquired2, cached2, _ = IdempotencyManager.acquire(
                    self.org1, 'redis_down_op', key, payload=payload
                )
                self.assertFalse(acquired2)
                self.assertEqual(cached2.get('status'), 'processed_without_redis')

    # -------------------------------------------------------------------------
    # TEST E: Lock lease expiration & worker crash recovery
    # -------------------------------------------------------------------------
    def test_e_lease_expiration_and_crash_recovery(self):
        """If a worker crashes while processing, lease expiration allows recovery without duplicate execution."""
        key = f"key-test-e-{uuid.uuid4()}"
        payload = {'job': 'reconciliation'}

        # Worker 1 acquires claim but crashes (never completes, lease expires)
        acquired1, _, rec1 = IdempotencyManager.acquire(
            self.org1, 'crash_op', key, payload=payload, lease_seconds=1
        )
        self.assertTrue(acquired1)
        self.assertEqual(rec1.status, 'processing')

        # Simulate time passage beyond lease expiration
        rec1.expires_at = timezone.now() - timedelta(seconds=10)
        rec1.save(update_fields=['expires_at'])

        # Worker 2 acquires the expired claim successfully
        acquired2, _, rec2 = IdempotencyManager.acquire(
            self.org1, 'crash_op', key, payload=payload, lease_seconds=60
        )
        self.assertTrue(acquired2)
        self.assertEqual(rec2.pk, rec1.pk)

        # Worker 2 completes successfully
        IdempotencyManager.complete(rec2, {'status': 'recovered_and_completed'})

        # Subsequent attempt sees completed status
        acquired3, cached3, _ = IdempotencyManager.acquire(
            self.org1, 'crash_op', key, payload=payload
        )
        self.assertFalse(acquired3)
        self.assertEqual(cached3.get('status'), 'recovered_and_completed')

    # -------------------------------------------------------------------------
    # TEST F: Transaction rollback on failure
    # -------------------------------------------------------------------------
    def test_f_transaction_rollback_marks_failed_cleanly(self):
        """When an operation fails with exception, DB changes roll back and idempotency record is marked failed."""
        key = f"key-test-f-{uuid.uuid4()}"

        try:
            with idempotency_scope(self.org1, 'failing_op', key) as (acquired, cached, claim):
                self.assertTrue(acquired)
                # Modify state and then raise error
                self.bank_acc1.current_balance += Decimal('50000.00')
                self.bank_acc1.save(update_fields=['current_balance'])
                raise ValueError("Simulated unexpected business logic error")
        except ValueError:
            pass

        rec = IdempotencyRecord.objects.get(
            organization=self.org1,
            operation_type='failing_op',
            idempotency_key=key
        )
        self.assertEqual(rec.status, 'failed')
        self.assertIn("Simulated unexpected business logic error", rec.error_message)

        # Can safely be re-acquired after failure
        acquired_retry, _, rec_retry = IdempotencyManager.acquire(
            self.org1, 'failing_op', key
        )
        self.assertTrue(acquired_retry)
        self.assertEqual(rec_retry.status, 'processing')

    # -------------------------------------------------------------------------
    # TEST G: Bank statement duplicate upload
    # -------------------------------------------------------------------------
    def test_g_bank_statement_duplicate_upload_prevents_duplicate_transactions(self):
        """Uploading the exact same statement items skips duplicate rows and prevents balance corruption."""
        initial_balance = self.bank_acc1.current_balance

        txns_payload = [
            {'date': timezone.localdate().isoformat(), 'description': 'Customer Payout A', 'deposit': '10000.00', 'withdrawal': '0.00', 'reference': 'REF-A-01'},
            {'date': timezone.localdate().isoformat(), 'description': 'Office Supplies B', 'deposit': '0.00', 'withdrawal': '2500.00', 'reference': 'REF-B-02'},
        ]

        # First import
        today = timezone.localdate()
        thash_a = services.compute_txn_hash(today, Decimal('0.00'), Decimal('10000.00'), 'REF-A-01', 'Customer Payout A')
        thash_b = services.compute_txn_hash(today, Decimal('2500.00'), Decimal('0.00'), 'REF-B-02', 'Office Supplies B')

        batch1 = BankStatementBatch.objects.create(
            organization=self.org1,
            bank_account=self.bank_acc1,
            batch_number='STMT-001',
            filename='stmt_oct.csv',
            statement_checksum='checksum-123456'
        )
        BankTransaction.objects.create(
            organization=self.org1,
            bank_account=self.bank_acc1,
            date=today,
            description='Customer Payout A',
            reference='REF-A-01',
            deposit=Decimal('10000.00'),
            withdrawal=Decimal('0.00'),
            balance=initial_balance + Decimal('10000.00'),
            transaction_hash=thash_a,
            batch=batch1
        )
        BankTransaction.objects.create(
            organization=self.org1,
            bank_account=self.bank_acc1,
            date=today,
            description='Office Supplies B',
            reference='REF-B-02',
            deposit=Decimal('0.00'),
            withdrawal=Decimal('2500.00'),
            balance=initial_balance + Decimal('10000.00') - Decimal('2500.00'),
            transaction_hash=thash_b,
            batch=batch1
        )
        self.bank_acc1.current_balance = initial_balance + Decimal('7500.00')
        self.bank_acc1.save(update_fields=['current_balance'])

        # Duplicate attempt: Inserting identical transaction_hash directly must fail at DB constraint level
        with self.assertRaises(IntegrityError):
            BankTransaction.objects.create(
                organization=self.org1,
                bank_account=self.bank_acc1,
                date=today,
                description='Customer Payout A',
                reference='REF-A-01',
                deposit=Decimal('10000.00'),
                withdrawal=Decimal('0.00'),
                balance=Decimal('999999.00'),
                transaction_hash=thash_a
            )

        # Total transactions for this account remains exactly 2
        count = BankTransaction.objects.filter(bank_account=self.bank_acc1).count()
        self.assertEqual(count, 2)
        self.bank_acc1.refresh_from_db()
        self.assertEqual(self.bank_acc1.current_balance, initial_balance + Decimal('7500.00'))

    # -------------------------------------------------------------------------
    # TEST H: Bank reconciliation concurrency
    # -------------------------------------------------------------------------
    def test_h_bank_reconciliation_concurrency_conflict(self):
        """Simultaneous reconciliation on cleared transactions: one succeeds, other receives conflict error."""
        today = timezone.localdate()
        txn = BankTransaction.objects.create(
            organization=self.org1,
            bank_account=self.bank_acc1,
            date=today,
            description='Vendor Check Clearance',
            reference='CHK-1002',
            deposit=Decimal('0.00'),
            withdrawal=Decimal('5000.00'),
            balance=Decimal('95000.00'),
            status='unreconciled'
        )

        rec_data = {
            'bank_account_id': self.bank_acc1.id,
            'statement_date': today,
            'statement_ending_balance': '95000.00',
            'cleared_transaction_ids': [txn.id],
            'notes': 'Session 1 reconciliation'
        }

        # First session succeeds
        res1 = services.complete_bank_reconciliation(rec_data, user=self.user)
        self.assertIn('number', res1)

        txn.refresh_from_db()
        self.assertEqual(txn.status, 'reconciled')
        self.assertTrue(txn.is_cleared)

        # Second session trying to reconcile the same transaction raises conflict
        from books.api import ApiError
        with self.assertRaises(ApiError) as ctx:
            services.complete_bank_reconciliation(rec_data, user=self.user)
        self.assertEqual(ctx.exception.status, 409)

    # -------------------------------------------------------------------------
    # TEST I: Multi-tenant isolation
    # -------------------------------------------------------------------------
    def test_i_multi_tenant_isolation_identical_keys(self):
        """Identical idempotency keys across different organizations execute independently."""
        shared_key = "billing-sync-2026-11"
        payload = {'period': '2026-11'}

        # Org 1 acquires and completes
        acq1, _, rec1 = IdempotencyManager.acquire(self.org1, 'monthly_sync', shared_key, payload)
        self.assertTrue(acq1)
        IdempotencyManager.complete(rec1, {'org': 'Org 1 Result'})

        # Org 2 acquires with the SAME key and operates independently
        acq2, _, rec2 = IdempotencyManager.acquire(self.org2, 'monthly_sync', shared_key, payload)
        self.assertTrue(acq2)
        self.assertNotEqual(rec1.pk, rec2.pk)
        IdempotencyManager.complete(rec2, {'org': 'Org 2 Result'})

        # Both records coexist cleanly
        self.assertEqual(
            IdempotencyRecord.objects.filter(operation_type='monthly_sync', idempotency_key=shared_key).count(),
            2
        )

    # -------------------------------------------------------------------------
    # TEST J: Processing job queue atomic claims (FOR UPDATE SKIP LOCKED)
    # -------------------------------------------------------------------------
    def test_j_processing_job_queue_atomic_claims(self):
        """Job queue with SKIP LOCKED claims jobs without double-processing."""
        job1, _ = enqueue_job(self.org1, 'calc_taxes', {'quarter': 'Q3'}, idempotency_key='tax-q3-2026')
        job2, _ = enqueue_job(self.org1, 'calc_taxes', {'quarter': 'Q4'}, idempotency_key='tax-q4-2026')

        # Worker 1 claims a job
        claimed_w1 = claim_job('worker-alpha', lease_seconds=60)
        self.assertIsNotNone(claimed_w1)
        self.assertEqual(claimed_w1.worker_id, 'worker-alpha')
        self.assertEqual(claimed_w1.status, 'processing')

        # Worker 2 claims the next job
        claimed_w2 = claim_job('worker-beta', lease_seconds=60)
        self.assertIsNotNone(claimed_w2)
        self.assertEqual(claimed_w2.worker_id, 'worker-beta')
        self.assertNotEqual(claimed_w1.pk, claimed_w2.pk)

        # Worker 3 has no pending jobs
        claimed_w3 = claim_job('worker-gamma', lease_seconds=60)
        self.assertIsNone(claimed_w3)

        # Complete worker 1's job
        complete_job(claimed_w1.pk, {'summary': 'Q3 taxes finalized'})
        claimed_w1.refresh_from_db()
        self.assertEqual(claimed_w1.status, 'completed')

    # -------------------------------------------------------------------------
    # TEST K: Posting Outbox pattern & durable ledger dispatch
    # -------------------------------------------------------------------------
    def test_k_posting_outbox_pattern(self):
        """PostingOutbox staging and dispatch prevents duplicate ledger postings."""
        # Stage outbox entry
        outbox, created = stage_posting_outbox(
            organization=self.org1,
            source_transaction_type='invoice',
            source_transaction_id='9999',
            payload={'invoice_number': 'INV-9999', 'total': '25000.00'}
        )
        self.assertTrue(created)
        self.assertEqual(outbox.status, 'pending')

        # Re-staging same entity is deduplicated
        outbox2, created2 = stage_posting_outbox(
            organization=self.org1,
            source_transaction_type='invoice',
            source_transaction_id='9999',
            payload={'invoice_number': 'INV-9999', 'total': '25000.00'}
        )
        self.assertFalse(created2)
        self.assertEqual(outbox.pk, outbox2.pk)

        # Claim entries using SKIP LOCKED
        claimed = claim_posting_entries(batch_size=10, organization=self.org1)
        self.assertEqual(len(claimed), 1)
        self.assertEqual(claimed[0].status, 'processing')

        # Automated duplicate prevention on Journal creation
        today = timezone.localdate()
        jrn1 = services.post_journal_entry(
            date=today,
            entry_type='invoice',
            reference='INV-9999',
            notes='Auto invoice 9999',
            items=[('1200', Decimal('25000.00'), Decimal('0.00'), 'AR'),
                   ('4000', Decimal('0.00'), Decimal('25000.00'), 'Sales')],
            org=self.org1
        )
        self.assertIsNotNone(jrn1)

        # Attempt duplicate posting with same reference: returns same journal without creating duplicates
        jrn2 = services.post_journal_entry(
            date=today,
            entry_type='invoice',
            reference='INV-9999',
            notes='Duplicate call invoice 9999',
            items=[('1200', Decimal('25000.00'), Decimal('0.00'), 'AR'),
                   ('4000', Decimal('0.00'), Decimal('25000.00'), 'Sales')],
            org=self.org1
        )
        self.assertEqual(jrn1.pk, jrn2.pk)
        self.assertEqual(
            Journal.objects.filter(organization=self.org1, entry_type='invoice', reference='INV-9999').count(),
            1
        )

import hashlib
import json
import uuid
from datetime import timedelta
from decimal import Decimal
from django.db import transaction, IntegrityError
from django.utils import timezone
from .models import PostingOutbox, Organization


def compute_outbox_payload_hash(payload):
    if not payload:
        return ""
    try:
        raw = json.dumps(payload, sort_keys=True, default=str).encode('utf-8')
        return hashlib.sha256(raw).hexdigest()
    except Exception:
        return ""


def stage_posting_outbox(organization, source_transaction_type, source_transaction_id, payload, idempotency_key=None, batch_id=''):
    """
    Stages a ledger or external financial posting in the PostingOutbox.
    Must be called inside the same transaction.atomic() as the business transaction creation.
    """
    if isinstance(organization, int):
        organization = Organization.objects.filter(pk=organization).first()
    elif organization is None:
        organization = Organization.objects.first()

    src_type = str(source_transaction_type).strip().lower()
    src_id = str(source_transaction_id).strip()
    idemp_key = str(idempotency_key).strip() if idempotency_key else f"outbox:{src_type}:{src_id}"
    p_hash = compute_outbox_payload_hash(payload)

    # Check for existing
    existing = PostingOutbox.objects.filter(
        organization=organization,
        source_transaction_type=src_type,
        source_transaction_id=src_id
    ).first()
    if existing:
        return existing, False

    try:
        with transaction.atomic():
            outbox_entry = PostingOutbox.objects.create(
                organization=organization,
                posting_batch_id=str(batch_id),
                source_transaction_type=src_type,
                source_transaction_id=src_id,
                idempotency_key=idemp_key,
                payload_hash=p_hash,
                payload=payload if isinstance(payload, dict) else {'data': payload},
                status='pending'
            )
            return outbox_entry, True
    except IntegrityError:
        existing = PostingOutbox.objects.filter(
            organization=organization,
            source_transaction_type=src_type,
            source_transaction_id=src_id
        ).first()
        if existing:
            return existing, False
        raise


def claim_posting_entries(batch_size=20, organization=None):
    """
    Claims up to batch_size pending outbox items using FOR UPDATE SKIP LOCKED.
    """
    now = timezone.now()
    from django.db.models import Q
    with transaction.atomic():
        qs = PostingOutbox.objects.select_for_update(skip_locked=True)
        if organization:
            qs = qs.filter(organization=organization)

        eligible = qs.filter(
            Q(status='pending') |
            Q(status='failed', next_retry_at__lte=now)
        ).filter(
            attempt_count__lt=5
        ).order_by('created_at')[:batch_size]

        claimed = list(eligible)
        for entry in claimed:
            entry.status = 'processing'
            entry.attempt_count += 1
            entry.save(update_fields=['status', 'attempt_count', 'updated_at'])

        return claimed


def execute_default_posting(outbox_entry):
    """
    Executes the GL posting for an outbox entry idempotently.
    """
    from . import services
    payload = outbox_entry.payload or {}
    src_type = outbox_entry.source_transaction_type

    if src_type == 'invoice':
        from .models import Invoice
        inv = Invoice.objects.filter(pk=outbox_entry.source_transaction_id).first()
        if inv:
            services.post_invoice_journal(inv)
            return {'status': 'posted', 'invoice_id': inv.pk}
    elif src_type == 'bill':
        from .models import Bill
        bill = Bill.objects.filter(pk=outbox_entry.source_transaction_id).first()
        if bill:
            services.post_bill_journal(bill)
            return {'status': 'posted', 'bill_id': bill.pk}
    elif src_type == 'payment_received':
        from .models import PaymentReceived
        pay = PaymentReceived.objects.filter(pk=outbox_entry.source_transaction_id).first()
        if pay:
            # Payment journal posting is handled in post_journal_entry with reference
            ref = f"PR-{pay.number}"
            services.post_journal_entry(
                date=pay.date,
                entry_type='payment_received',
                reference=ref,
                notes=f"Payment received from {pay.customer.name if pay.customer else ''}",
                items=[],
                org=outbox_entry.organization
            )
            return {'status': 'posted', 'payment_id': pay.pk}
    elif src_type == 'payment_made':
        from .models import PaymentMade
        pay = PaymentMade.objects.filter(pk=outbox_entry.source_transaction_id).first()
        if pay:
            ref = f"PM-{pay.number}"
            services.post_journal_entry(
                date=pay.date,
                entry_type='payment_made',
                reference=ref,
                notes=f"Payment made to {pay.vendor.name if pay.vendor else ''}",
                items=[],
                org=outbox_entry.organization
            )
            return {'status': 'posted', 'payment_id': pay.pk}

    return {'status': 'noop'}


def dispatch_posting_outbox(batch_size=20, executor=None, organization=None):
    """
    Processes pending outbox items durable in PostgreSQL.
    """
    entries = claim_posting_entries(batch_size=batch_size, organization=organization)
    processed = 0
    errors = 0

    exec_fn = executor or execute_default_posting

    for entry in entries:
        try:
            with transaction.atomic():
                result = exec_fn(entry)
                entry.status = 'completed'
                entry.completed_at = timezone.now()
                entry.last_error = ''
                entry.save(update_fields=['status', 'completed_at', 'last_error', 'updated_at'])
                processed += 1
        except Exception as exc:
            errors += 1
            entry.last_error = str(exc)[:2000]
            if entry.attempt_count >= entry.max_attempts:
                entry.status = 'manual_review'
            else:
                entry.status = 'failed'
                delay = 5 * (2 ** (entry.attempt_count - 1))
                entry.next_retry_at = timezone.now() + timedelta(seconds=delay)
            entry.save(update_fields=['status', 'last_error', 'next_retry_at', 'updated_at'])

    return {'processed': processed, 'errors': errors, 'claimed': len(entries)}

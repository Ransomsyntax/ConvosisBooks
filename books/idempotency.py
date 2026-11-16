import hashlib
import json
import uuid
from contextlib import contextmanager
from datetime import date, datetime, timedelta
from decimal import Decimal
from django.db import transaction, IntegrityError
from django.utils import timezone
from .models import IdempotencyRecord, Organization


class IdempotencyError(Exception):
    """Base exception for idempotency violations."""
    pass


class IdempotencyConflictError(IdempotencyError):
    """Raised when an operation with the same key is actively being processed."""
    pass


class IdempotencyPayloadMismatchError(IdempotencyError):
    """Raised when the same key is reused with differing request payload parameters."""
    pass


def canonical_json_serializer(obj):
    if isinstance(obj, (Decimal, uuid.UUID)):
        return str(obj)
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    if isinstance(obj, bytes):
        return obj.decode('utf-8', errors='replace')
    if hasattr(obj, '__dict__'):
        return obj.__dict__
    raise TypeError(f"Type {type(obj)} not serializable in canonical JSON")


def canonical_json_dumps(payload):
    if payload is None:
        return ""
    try:
        return json.dumps(payload, default=canonical_json_serializer, sort_keys=True, separators=(',', ':'))
    except Exception:
        return str(payload)


def compute_payload_hash(payload):
    if payload is None or payload == "":
        return ""
    raw = canonical_json_dumps(payload).encode('utf-8')
    return hashlib.sha256(raw).hexdigest()


class IdempotencyManager:
    @staticmethod
    def acquire(organization, operation_type, idempotency_key, payload=None, resource_type='', resource_id='', lease_seconds=120):
        """
        Durable database-backed idempotency claim.
        Returns:
            (acquired: bool, response_data: dict | None, record: IdempotencyRecord)
            - If acquired is True: caller must execute the operation and call complete().
            - If acquired is False: operation was previously completed; response_data is returned.
        Raises:
            - IdempotencyConflictError: currently processing by another thread/worker.
            - IdempotencyPayloadMismatchError: payload does not match original request.
        """
        if not idempotency_key:
            return True, None, None

        if isinstance(organization, int):
            organization = Organization.objects.filter(pk=organization).first()
        elif organization is None:
            organization = Organization.objects.first()

        req_hash = compute_payload_hash(payload)
        now = timezone.now()
        expires_at = now + timedelta(seconds=lease_seconds)

        # Attempt atomic insert first using a savepoint to catch race conditions cleanly
        try:
            with transaction.atomic():
                record = IdempotencyRecord.objects.create(
                    organization=organization,
                    operation_type=operation_type,
                    idempotency_key=str(idempotency_key).strip(),
                    request_hash=req_hash,
                    status='processing',
                    resource_type=resource_type,
                    resource_id=str(resource_id) if resource_id else '',
                    expires_at=expires_at
                )
                return True, None, record
        except IntegrityError:
            # Row already exists; inspect under row lock
            pass

        with transaction.atomic():
            record = IdempotencyRecord.objects.select_for_update().filter(
                organization=organization,
                operation_type=operation_type,
                idempotency_key=str(idempotency_key).strip()
            ).first()

            if not record:
                # Should not normally happen, but retry insert if previous txn rolled back
                record = IdempotencyRecord.objects.create(
                    organization=organization,
                    operation_type=operation_type,
                    idempotency_key=str(idempotency_key).strip(),
                    request_hash=req_hash,
                    status='processing',
                    resource_type=resource_type,
                    resource_id=str(resource_id) if resource_id else '',
                    expires_at=expires_at
                )
                return True, None, record

            # Payload validation
            if record.request_hash and req_hash and record.request_hash != req_hash:
                raise IdempotencyPayloadMismatchError(
                    f"Idempotency key '{idempotency_key}' was previously used with different parameters."
                )

            # Check status
            if record.status == 'completed':
                return False, record.response_data, record

            if record.status == 'processing':
                # Check for lease expiration (crashed worker recovery)
                if record.expires_at and record.expires_at < now:
                    record.status = 'processing'
                    record.expires_at = expires_at
                    record.request_hash = req_hash or record.request_hash
                    record.save(update_fields=['status', 'expires_at', 'request_hash', 'updated_at'])
                    return True, None, record
                else:
                    raise IdempotencyConflictError(
                        f"An operation '{operation_type}' with key '{idempotency_key}' is currently in progress. Please retry shortly."
                    )

            # Failed status: allow safe re-processing
            record.status = 'processing'
            record.expires_at = expires_at
            record.request_hash = req_hash or record.request_hash
            record.error_message = ''
            record.save(update_fields=['status', 'expires_at', 'request_hash', 'error_message', 'updated_at'])
            return True, None, record

    @staticmethod
    def complete(record_or_id, response_data, resource_id=None, resource_type=None):
        if not record_or_id:
            return None
        with transaction.atomic():
            if isinstance(record_or_id, IdempotencyRecord):
                rec = IdempotencyRecord.objects.select_for_update().filter(pk=record_or_id.pk).first()
            else:
                rec = IdempotencyRecord.objects.select_for_update().filter(pk=record_or_id).first()
            if rec:
                rec.status = 'completed'
                rec.response_data = response_data if isinstance(response_data, dict) else {'result': response_data}
                if resource_id is not None:
                    rec.resource_id = str(resource_id)
                if resource_type is not None:
                    rec.resource_type = str(resource_type)
                rec.error_message = ''
                rec.save(update_fields=['status', 'response_data', 'resource_id', 'resource_type', 'error_message', 'updated_at'])
                return rec
        return None

    @staticmethod
    def fail(record_or_id, error_message):
        if not record_or_id:
            return None
        with transaction.atomic():
            if isinstance(record_or_id, IdempotencyRecord):
                rec = IdempotencyRecord.objects.select_for_update().filter(pk=record_or_id.pk).first()
            else:
                rec = IdempotencyRecord.objects.select_for_update().filter(pk=record_or_id).first()
            if rec:
                rec.status = 'failed'
                rec.error_message = str(error_message)[:2000]
                rec.save(update_fields=['status', 'error_message', 'updated_at'])
                return rec
        return None


@contextmanager
def idempotency_scope(organization, operation_type, idempotency_key, payload=None, resource_type='', resource_id='', lease_seconds=120):
    """
    Context manager for database-backed idempotent blocks.
    Usage:
        with idempotency_scope(org, 'payment', key, payload) as (acquired, cached_resp, claim):
            if not acquired:
                return cached_resp
            result = do_financial_operation()
            claim.set_result(result)
    """
    if not idempotency_key:
        class DummyClaim:
            def set_result(self, res, res_id=None, res_type=None):
                pass
        yield True, None, DummyClaim()
        return

    acquired, cached_data, record = IdempotencyManager.acquire(
        organization, operation_type, idempotency_key, payload, resource_type, resource_id, lease_seconds
    )

    if not acquired:
        yield False, cached_data, None
        return

    class ClaimContext:
        def __init__(self, rec):
            self.rec = rec
            self.result_data = None
            self.res_id = None
            self.res_type = None

        def set_result(self, res, res_id=None, res_type=None):
            self.result_data = res
            self.res_id = res_id
            self.res_type = res_type

    ctx = ClaimContext(record)
    try:
        yield True, None, ctx
        IdempotencyManager.complete(record, ctx.result_data or {}, ctx.res_id, ctx.res_type)
    except Exception as exc:
        IdempotencyManager.fail(record, str(exc))
        raise

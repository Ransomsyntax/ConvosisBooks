import uuid
from datetime import timedelta
from django.db import transaction, IntegrityError
from django.utils import timezone
from .models import ProcessingJob, Organization


def enqueue_job(organization, operation_type, payload, idempotency_key=None, resource_type='', resource_id='', max_retries=3, delay_seconds=0):
    """
    Enqueues a processing job with durable database persistence and optional idempotency.
    """
    if isinstance(organization, int):
        organization = Organization.objects.filter(pk=organization).first()
    elif organization is None:
        organization = Organization.objects.first()

    now = timezone.now()
    available_at = now + timedelta(seconds=delay_seconds) if delay_seconds > 0 else now
    clean_key = str(idempotency_key).strip() if idempotency_key else ''

    if clean_key:
        existing = ProcessingJob.objects.filter(
            organization=organization,
            operation_type=operation_type,
            idempotency_key=clean_key
        ).first()
        if existing:
            return existing, False

    try:
        with transaction.atomic():
            job = ProcessingJob.objects.create(
                organization=organization,
                operation_type=operation_type,
                resource_type=resource_type,
                resource_id=str(resource_id) if resource_id else '',
                idempotency_key=clean_key,
                status='pending',
                max_retries=max_retries,
                available_at=available_at,
                payload=payload if isinstance(payload, dict) else {'data': payload}
            )
            return job, True
    except IntegrityError:
        # Concurrent enqueue with same idempotency key
        if clean_key:
            existing = ProcessingJob.objects.filter(
                organization=organization,
                operation_type=operation_type,
                idempotency_key=clean_key
            ).first()
            if existing:
                return existing, False
        raise


def claim_job(worker_id, operation_types=None, lease_seconds=60, organization=None):
    """
    Claims the next available job using PostgreSQL row-level FOR UPDATE SKIP LOCKED.
    Safe against multiple concurrent workers, Redis downtime, or expired leases.
    """
    now = timezone.now()
    with transaction.atomic():
        qs = ProcessingJob.objects.select_for_update(skip_locked=True)
        if organization:
            qs = qs.filter(organization=organization)
        if operation_types:
            qs = qs.filter(operation_type__in=operation_types)

        # Pending, ready for retry, or lease-expired
        from django.db.models import Q
        eligible = qs.filter(
            Q(status='pending', available_at__lte=now) |
            Q(status='retry_scheduled', available_at__lte=now) |
            Q(status='processing', lease_expires_at__lt=now)
        ).order_by('available_at', 'created_at')

        job = eligible.first()
        if not job:
            return None

        job.status = 'processing'
        job.worker_id = str(worker_id)
        job.attempt_count += 1
        job.started_at = now
        job.lease_expires_at = now + timedelta(seconds=lease_seconds)
        job.save(update_fields=['status', 'worker_id', 'attempt_count', 'started_at', 'lease_expires_at', 'updated_at'])
        return job


def complete_job(job_id, result=None):
    with transaction.atomic():
        job = ProcessingJob.objects.select_for_update().filter(pk=job_id).first()
        if not job:
            return None
        job.status = 'completed'
        job.completed_at = timezone.now()
        job.result = result if isinstance(result, dict) else {'result': result}
        job.save(update_fields=['status', 'completed_at', 'result', 'updated_at'])
        return job


def fail_job(job_id, error_message, can_retry=True, backoff_base_seconds=5):
    with transaction.atomic():
        job = ProcessingJob.objects.select_for_update().filter(pk=job_id).first()
        if not job:
            return None
        now = timezone.now()
        job.last_error = str(error_message)[:4000]

        if can_retry and job.attempt_count < job.max_retries:
            delay = backoff_base_seconds * (2 ** max(0, job.attempt_count - 1))
            job.status = 'retry_scheduled'
            job.available_at = now + timedelta(seconds=delay)
        else:
            job.status = 'failed'

        job.save(update_fields=['status', 'available_at', 'last_error', 'updated_at'])
        return job


def recover_expired_leases(organization=None):
    """
    Recovers any stuck jobs whose worker crashed during processing.
    """
    now = timezone.now()
    with transaction.atomic():
        qs = ProcessingJob.objects.select_for_update(skip_locked=True).filter(
            status='processing',
            lease_expires_at__lt=now
        )
        if organization:
            qs = qs.filter(organization=organization)
        count = 0
        for job in qs:
            if job.attempt_count < job.max_retries:
                job.status = 'pending'
            else:
                job.status = 'failed'
                job.last_error = "Worker lease expired without completion; max retries exceeded."
            job.save(update_fields=['status', 'last_error', 'updated_at'])
            count += 1
        return count

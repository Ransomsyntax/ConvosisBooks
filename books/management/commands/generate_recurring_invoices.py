import datetime
from django.core.management.base import BaseCommand
from django.utils import timezone
from books import services
from books.models import Organization, RecurringInvoice


class Command(BaseCommand):
    help = 'Automatically generates sales invoices for due Recurring Invoice profiles.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--as-of-date',
            dest='as_of_date',
            type=str,
            help='Run generation as of a specific date (YYYY-MM-DD). Defaults to today.',
        )
        parser.add_argument(
            '--org-id',
            dest='org_id',
            type=int,
            help='Filter recurring generation to a specific Organization ID.',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            dest='dry_run',
            help='Simulate generation without writing invoices to database.',
        )

    def handle(self, *args, **options):
        as_of_str = options.get('as_of_date')
        if as_of_str:
            target_date = datetime.date.fromisoformat(as_of_str)
        else:
            target_date = timezone.localdate()

        org_id = options.get('org_id')
        org = Organization.objects.filter(pk=org_id).first() if org_id else None
        dry_run = options.get('dry_run', False)

        self.stdout.write(self.style.NOTICE(f"Processing recurring invoices due on or before {target_date}..."))

        qs = RecurringInvoice.objects.filter(status='active', next_date__lte=target_date)
        if org:
            qs = qs.filter(organization=org)

        total_due = qs.count()
        self.stdout.write(f"Found {total_due} active recurring profile(s) due.")

        if dry_run:
            for p in qs:
                self.stdout.write(f"[DRY-RUN] Would generate invoice for profile '{p.profile_name}' ({p.customer.name}) on {p.next_date} for total INR {p.total}")
            return

        generated_count = 0
        errors = 0
        for profile in qs.select_related('customer', 'organization'):
            try:
                inv = services.generate_invoice_from_recurring_profile(profile, scheduled_date=profile.next_date)
                self.stdout.write(self.style.SUCCESS(f"Generated {inv.number} for '{profile.profile_name}' ({profile.customer.name}) - Total: INR {inv.total}"))
                generated_count += 1
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"Error generating invoice for '{profile.profile_name}': {str(e)}"))
                errors += 1

        self.stdout.write(self.style.SUCCESS(f"Completed recurring invoice generation: {generated_count} generated, {errors} errors."))


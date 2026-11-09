import logging
from collections import defaultdict
from django.core.management.base import BaseCommand
from django.db import transaction
from django.contrib.auth import get_user_model
from books.models import (
    UserProfile, Organization, OrganizationMembership, AuditLog,
    PaymentReceived, PaymentMade, StockMovement, Attachment, Journal,
    LockDate, ManagedDocument, Expense, TimeLog, StockTransfer,
    BankReconciliation, BankDeposit, BankTransfer, UserInvitation,
    Notification, Customer, Invoice
)

logger = logging.getLogger(__name__)

def find_duplicate_accounts(User_model=None, UserProfile_model=None):
    """
    Find all accounts grouped by normalized email (stripped & lowercase).
    Returns a dict: {normalized_email: [user_instances]}
    """
    if User_model is None:
        User_model = get_user_model()
    if UserProfile_model is None:
        UserProfile_model = UserProfile

    email_groups = defaultdict(list)
    seen_user_ids = set()

    for user in User_model.objects.all().order_by('id'):
        raw_email = (user.email or '').strip()
        if raw_email:
            norm = raw_email.lower()
            email_groups[norm].append(user)
            seen_user_ids.add(user.id)

    # Check UserProfiles where normalized_email is populated or user email might be different
    for profile in UserProfile_model.objects.select_related('user').all():
        if profile.user_id and profile.user_id not in seen_user_ids:
            p_email = (profile.normalized_email or (profile.user.email if profile.user else '') or '').strip().lower()
            if p_email:
                email_groups[p_email].append(profile.user)
                seen_user_ids.add(profile.user_id)

    # Only return groups with more than 1 user
    return {email: users for email, users in email_groups.items() if len(users) > 1}


def rank_user_for_canonical(user, Invoice_model=None, Customer_model=None):
    """
    Computes a score to select the best canonical user:
    Higher score = better candidate.
    Tie-breakers: earlier date_joined and smaller ID.
    """
    score = 0
    if getattr(user, 'is_superuser', False):
        score += 1000
    if getattr(user, 'is_staff', False):
        score += 500
    if getattr(user, 'is_active', True):
        score += 100
    if getattr(user, 'last_login', None):
        score += 50

    try:
        # Check activity in organizations owned by this user
        owned_org_ids = list(Organization.objects.filter(owner=user).values_list('id', flat=True))
        if owned_org_ids:
            score += len(owned_org_ids) * 10
            inv_count = Invoice.objects.filter(organization_id__in=owned_org_ids).count()
            cust_count = Customer.objects.filter(organization_id__in=owned_org_ids).count()
            score += (inv_count * 5) + (cust_count * 2)
    except Exception:
        pass

    # Return tuple: (activity_score, -date_joined_timestamp, -user_id)
    # Higher score wins; for ties, earlier date joined wins; then lowest user id wins.
    date_joined_ts = user.date_joined.timestamp() if getattr(user, 'date_joined', None) else 0
    return (score, -date_joined_ts, -user.id)


def reconcile_duplicate_user(canonical_user, dup_user, apps_registry=None, stdout=None):
    """
    Safely reassigns all organization ownership, foreign keys, and memberships
    from dup_user to canonical_user, and deletes dup_user.
    """
    def log(msg):
        if stdout:
            stdout.write(msg)
        logger.info(msg)

    # 1. Reassign Organization ownership
    for org in Organization.objects.filter(owner=dup_user):
        log(f"  [Org Ownership] Reassigning Org #{org.id} ({org.name}) owner from User #{dup_user.id} ({dup_user.username}) to Canonical User #{canonical_user.id} ({canonical_user.username})")
        org.owner = canonical_user
        org.save(update_fields=['owner'])
        # Ensure canonical user has access/membership
        canonical_prof = getattr(canonical_user, 'profile', None)
        if canonical_prof:
            org.members.add(canonical_prof)
        OrganizationMembership.objects.get_or_create(
            user=canonical_user,
            organization=org,
            defaults={'role': 'admin', 'status': 'active'}
        )

    # 2. Reassign Foreign Keys on all business/system records
    PaymentReceived.objects.filter(created_by=dup_user).update(created_by=canonical_user)
    PaymentMade.objects.filter(created_by=dup_user).update(created_by=canonical_user)
    StockMovement.objects.filter(created_by=dup_user).update(created_by=canonical_user)
    Attachment.objects.filter(created_by=dup_user).update(created_by=canonical_user)
    Journal.objects.filter(created_by=dup_user).update(created_by=canonical_user)
    LockDate.objects.filter(locked_by=dup_user).update(locked_by=canonical_user)
    AuditLog.objects.filter(user=dup_user).update(user=canonical_user)
    ManagedDocument.objects.filter(created_by=dup_user).update(created_by=canonical_user)
    Expense.objects.filter(created_by=dup_user).update(created_by=canonical_user)
    TimeLog.objects.filter(user=dup_user).update(user=canonical_user)
    StockTransfer.objects.filter(created_by=dup_user).update(created_by=canonical_user)
    StockTransfer.objects.filter(confirmed_by=dup_user).update(confirmed_by=canonical_user)
    StockTransfer.objects.filter(reversed_by=dup_user).update(reversed_by=canonical_user)
    BankReconciliation.objects.filter(created_by=dup_user).update(created_by=canonical_user)
    BankDeposit.objects.filter(created_by=dup_user).update(created_by=canonical_user)
    BankTransfer.objects.filter(created_by=dup_user).update(created_by=canonical_user)
    UserInvitation.objects.filter(invited_by=dup_user).update(invited_by=canonical_user)
    Notification.objects.filter(user=dup_user).update(user=canonical_user)

    try:
        from django.contrib.admin.models import LogEntry
        LogEntry.objects.filter(user=dup_user).update(user=canonical_user)
    except Exception:
        pass

    # 3. Handle OrganizationMembership (unique_together: user, organization)
    for m in list(OrganizationMembership.objects.filter(user=dup_user)):
        if OrganizationMembership.objects.filter(user=canonical_user, organization=m.organization).exists():
            m.delete()
        else:
            m.user = canonical_user
            m.save(update_fields=['user'])

    # 4. Handle UserProfile
    dup_profile = getattr(dup_user, 'profile', None) or UserProfile.objects.filter(user=dup_user).first()
    canonical_profile = getattr(canonical_user, 'profile', None) or UserProfile.objects.filter(user=canonical_user).first()

    if dup_profile:
        # Transfer M2M relations to canonical_profile if available
        if canonical_profile:
            for org in Organization.objects.filter(members=dup_profile):
                org.members.remove(dup_profile)
                org.members.add(canonical_profile)
            for cust in Customer.objects.filter(assigned_staff_users=dup_profile):
                cust.assigned_staff_users.remove(dup_profile)
                cust.assigned_staff_users.add(canonical_profile)

        # Clear normalized_email so it doesn't violate unique constraints during deletion
        dup_profile.normalized_email = ''
        dup_profile.save(update_fields=['normalized_email'])
        dup_profile.delete()

    # 5. Audit log
    try:
        user_org = Organization.objects.filter(owner=canonical_user).first()
        AuditLog.objects.create(
            organization=user_org,
            user=canonical_user,
            username=canonical_user.username,
            action='cleanup',
            entity_type='User',
            entity_id=str(canonical_user.id),
            summary=f"Consolidated duplicate user #{dup_user.id} ({dup_user.username}) into canonical user #{canonical_user.id}",
            details={'duplicate_user_id': dup_user.id, 'duplicate_username': dup_user.username, 'email': canonical_user.email}
        )
    except Exception:
        pass

    # 6. Delete duplicate User
    log(f"  [Delete User] Safely deleting redundant duplicate User #{dup_user.id} ({dup_user.username})")
    dup_user.delete()


class Command(BaseCommand):
    help = "Inspects and safely resolves duplicate user accounts with identical normalized emails."

    def add_arguments(self, parser):
        parser.add_argument(
            '--inspect',
            action='store_true',
            help='Inspect database and generate report of duplicates without making modifications.'
        )

    def handle(self, *args, **options):
        inspect_only = options.get('inspect', False)
        duplicates = find_duplicate_accounts()

        if not duplicates:
            self.stdout.write(self.style.SUCCESS("No duplicate accounts found! Database is clean."))
            return

        self.stdout.write(self.style.WARNING(f"Found {len(duplicates)} normalized email(s) with duplicate accounts:"))

        for email, users in duplicates.items():
            self.stdout.write(f"\n=======================================================")
            self.stdout.write(self.style.NOTICE(f"Normalized Email: {email} ({len(users)} accounts)"))
            self.stdout.write(f"=======================================================")

            # Sort users to find canonical
            sorted_users = sorted(users, key=rank_user_for_canonical, reverse=True)
            canonical = sorted_users[0]
            dups = sorted_users[1:]

            self.stdout.write(self.style.SUCCESS(
                f"[CANONICAL/ORIGINAL] User #{canonical.id} | Username: {canonical.username} | Email: {canonical.email} | "
                f"Joined: {canonical.date_joined} | Active: {canonical.is_active} | Superuser: {canonical.is_superuser}"
            ))
            for o in Organization.objects.filter(owner=canonical):
                self.stdout.write(f"  -> Owns Org #{o.id}: '{o.name}' (Invoices: {Invoice.objects.filter(organization=o).count()}, Customers: {Customer.objects.filter(organization=o).count()})")

            for d in dups:
                self.stdout.write(self.style.WARNING(
                    f"[DUPLICATE] User #{d.id} | Username: {d.username} | Email: {d.email} | "
                    f"Joined: {d.date_joined} | Active: {d.is_active} | Superuser: {d.is_superuser}"
                ))
                for o in Organization.objects.filter(owner=d):
                    self.stdout.write(f"  -> Owns Org #{o.id}: '{o.name}' (Invoices: {Invoice.objects.filter(organization=o).count()}, Customers: {Customer.objects.filter(organization=o).count()})")

            if not inspect_only:
                with transaction.atomic():
                    self.stdout.write(f"\nResolving duplicates for {email}...")
                    for d in dups:
                        reconcile_duplicate_user(canonical, d, stdout=self.stdout)

                    # Normalize canonical user and profile
                    canonical.email = email
                    canonical.save(update_fields=['email'])
                    canonical_prof = getattr(canonical, 'profile', None) or UserProfile.objects.filter(user=canonical).first()
                    if canonical_prof:
                        canonical_prof.normalized_email = email
                        canonical_prof.save(update_fields=['normalized_email'])

                    self.stdout.write(self.style.SUCCESS(f"Cleaned up {email}: Canonical user #{canonical.id} retained."))

        if not inspect_only:
            remaining = find_duplicate_accounts()
            if not remaining:
                self.stdout.write(self.style.SUCCESS("\nAll duplicate accounts have been successfully resolved and cleaned up!"))
            else:
                self.stdout.write(self.style.ERROR(f"\nWarning: {len(remaining)} duplicate groups remain!"))

from collections import defaultdict
from django.db import migrations, transaction

def safe_cleanup_and_enforce_unique(apps, schema_editor):
    User = apps.get_model('auth', 'User')
    UserProfile = apps.get_model('books', 'UserProfile')
    Organization = apps.get_model('books', 'Organization')
    OrganizationMembership = apps.get_model('books', 'OrganizationMembership')
    AuditLog = apps.get_model('books', 'AuditLog')
    PaymentReceived = apps.get_model('books', 'PaymentReceived')
    PaymentMade = apps.get_model('books', 'PaymentMade')
    StockMovement = apps.get_model('books', 'StockMovement')
    Attachment = apps.get_model('books', 'Attachment')
    Journal = apps.get_model('books', 'Journal')
    LockDate = apps.get_model('books', 'LockDate')
    ManagedDocument = apps.get_model('books', 'ManagedDocument')
    Expense = apps.get_model('books', 'Expense')
    TimeLog = apps.get_model('books', 'TimeLog')
    StockTransfer = apps.get_model('books', 'StockTransfer')
    BankReconciliation = apps.get_model('books', 'BankReconciliation')
    BankDeposit = apps.get_model('books', 'BankDeposit')
    BankTransfer = apps.get_model('books', 'BankTransfer')
    UserInvitation = apps.get_model('books', 'UserInvitation')
    Notification = apps.get_model('books', 'Notification')
    Customer = apps.get_model('books', 'Customer')
    Invoice = apps.get_model('books', 'Invoice')

    try:
        LogEntry = apps.get_model('admin', 'LogEntry')
    except LookupError:
        LogEntry = None

    # Perform all data cleanup and normalizations in an atomic block so changes commit
    # and all pending trigger events/deferred constraints on auth_user are flushed before index creation.
    with transaction.atomic():
        print("\n[Migration 0029] Step 1: Scanning for duplicate normalized email accounts...")

        # Group all users by normalized email
        email_to_users = defaultdict(list)
        for u in User.objects.all().order_by('id'):
            raw_email = (u.email or '').strip()
            if raw_email:
                norm = raw_email.lower()
                email_to_users[norm].append(u)

        # Also inspect UserProfiles in case user.email was blank but profile had email
        for p in UserProfile.objects.all():
            if p.user_id:
                raw_p_email = (p.normalized_email or '').strip()
                if raw_p_email:
                    norm_p = raw_p_email.lower()
                    user_obj = User.objects.filter(pk=p.user_id).first()
                    if user_obj and user_obj not in email_to_users[norm_p]:
                        email_to_users[norm_p].append(user_obj)

        duplicate_groups = {email: users for email, users in email_to_users.items() if len(users) > 1}

        if duplicate_groups:
            print(f"[Migration 0029] Step 2: Found {len(duplicate_groups)} duplicate email group(s) to resolve safely.")
            for norm_email, users in duplicate_groups.items():
                print(f"  -> Processing duplicate group for '{norm_email}' ({len(users)} users)...")

                # Rank users to find canonical account
                def score_user(u):
                    score = 0
                    if getattr(u, 'is_superuser', False):
                        score += 1000
                    if getattr(u, 'is_staff', False):
                        score += 500
                    if getattr(u, 'is_active', True):
                        score += 100
                    if getattr(u, 'last_login', None):
                        score += 50
                    try:
                        owned_org_ids = list(Organization.objects.filter(owner=u).values_list('id', flat=True))
                        if owned_org_ids:
                            score += len(owned_org_ids) * 10
                            inv_count = Invoice.objects.filter(organization_id__in=owned_org_ids).count()
                            cust_count = Customer.objects.filter(organization_id__in=owned_org_ids).count()
                            score += (inv_count * 5) + (cust_count * 2)
                    except Exception:
                        pass
                    date_ts = u.date_joined.timestamp() if getattr(u, 'date_joined', None) else 0
                    return (score, -date_ts, -u.id)

                sorted_users = sorted(users, key=score_user, reverse=True)
                canonical_user = sorted_users[0]
                dup_users = sorted_users[1:]

                print(f"     [CANONICAL] User #{canonical_user.id} ({canonical_user.username}) retained.")

                for dup_user in dup_users:
                    print(f"     [DUPLICATE] Reconciling and removing User #{dup_user.id} ({dup_user.username})...")

                    # 1. Transfer Organization ownership
                    for org in Organization.objects.filter(owner=dup_user):
                        print(f"       -> Reassigning Org #{org.id} ({org.name}) owner to User #{canonical_user.id}")
                        org.owner = canonical_user
                        org.save(update_fields=['owner'])

                        canonical_prof = UserProfile.objects.filter(user=canonical_user).first()
                        if canonical_prof:
                            org.members.add(canonical_prof)
                        OrganizationMembership.objects.get_or_create(
                            user=canonical_user,
                            organization=org,
                            defaults={'role': 'admin', 'status': 'active'}
                        )

                    # 2. Reassign all system and business foreign keys
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

                    if LogEntry is not None:
                        try:
                            LogEntry.objects.filter(user=dup_user).update(user=canonical_user)
                        except Exception:
                            pass

                    # 3. Handle OrganizationMembership
                    for m in list(OrganizationMembership.objects.filter(user=dup_user)):
                        if OrganizationMembership.objects.filter(user=canonical_user, organization=m.organization).exists():
                            m.delete()
                        else:
                            m.user = canonical_user
                            m.save(update_fields=['user'])

                    # 4. Handle UserProfile
                    dup_profile = UserProfile.objects.filter(user=dup_user).first()
                    canonical_profile = UserProfile.objects.filter(user=canonical_user).first()

                    if dup_profile:
                        if canonical_profile:
                            for org in Organization.objects.filter(members=dup_profile):
                                org.members.remove(dup_profile)
                                org.members.add(canonical_profile)
                            for cust in Customer.objects.filter(assigned_staff_users=dup_profile):
                                cust.assigned_staff_users.remove(dup_profile)
                                cust.assigned_staff_users.add(canonical_profile)

                        # Clear normalized_email to avoid unique constraint collisions
                        dup_profile.normalized_email = ''
                        dup_profile.save(update_fields=['normalized_email'])
                        dup_profile.delete()

                    # 5. Audit Log
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
                            details={'duplicate_user_id': dup_user.id, 'duplicate_username': dup_user.username, 'email': norm_email}
                        )
                    except Exception:
                        pass

                    # 6. Delete duplicate user
                    dup_user.delete()
        else:
            print("[Migration 0029] Step 2: No duplicate accounts found. Proceeding to normalization.")

        # Step 3: Normalize all remaining users and profiles
        print("[Migration 0029] Step 3: Normalizing remaining emails across users and profiles...")
        for user in User.objects.all():
            raw_email = (user.email or '').strip()
            norm = raw_email.lower() if raw_email else ''
            if user.email != norm:
                user.email = norm
                user.save(update_fields=['email'])

            profile = UserProfile.objects.filter(user=user).first()
            if profile:
                if profile.normalized_email != norm:
                    profile.normalized_email = norm
                    profile.save(update_fields=['normalized_email'])

        # Step 4: Verify that no duplicate non-empty normalized emails exist
        print("[Migration 0029] Step 4: Verifying zero duplicate normalized emails remain...")
        email_counts = defaultdict(int)
        for u in User.objects.all():
            e = (u.email or '').strip().lower()
            if e:
                email_counts[e] += 1
                if email_counts[e] > 1:
                    raise RuntimeError(f"Migration 0029 validation failed: duplicate email '{e}' still exists after cleanup!")

        profile_counts = defaultdict(int)
        for p in UserProfile.objects.all():
            pe = (p.normalized_email or '').strip().lower()
            if pe:
                profile_counts[pe] += 1
                if profile_counts[pe] > 1:
                    raise RuntimeError(f"Migration 0029 validation failed: duplicate normalized_email '{pe}' still exists in UserProfile!")

        print("[Migration 0029] Verification passed: exactly zero duplicate normalized emails found.")

    # Step 5: Database level unique index on auth_user (email)
    # Executed outside transaction.atomic() to ensure all pending triggers on auth_user are resolved in PostgreSQL
    print("[Migration 0029] Step 5: Enforcing database-level unique index on auth_user...")
    vendor = schema_editor.connection.vendor
    with schema_editor.connection.cursor() as cursor:
        if vendor == 'postgresql':
            cursor.execute(
                "CREATE UNIQUE INDEX IF NOT EXISTS auth_user_unique_lower_email ON auth_user (LOWER(email)) WHERE email != '';"
            )
        elif vendor == 'sqlite':
            cursor.execute(
                "CREATE UNIQUE INDEX IF NOT EXISTS auth_user_unique_lower_email ON auth_user (email COLLATE NOCASE) WHERE email != '';"
            )

    print("[Migration 0029] Step 6: Database unique index successfully verified.")


def remove_unique_index(apps, schema_editor):
    with schema_editor.connection.cursor() as cursor:
        cursor.execute("DROP INDEX IF EXISTS auth_user_unique_lower_email;")


class Migration(migrations.Migration):

    atomic = False

    dependencies = [
        ('books', '0028_tenantsubscription_is_trial_and_more'),
    ]

    operations = [
        migrations.RunPython(safe_cleanup_and_enforce_unique, remove_unique_index),
    ]

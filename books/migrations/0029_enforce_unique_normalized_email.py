from django.db import migrations

def backfill_and_create_index(apps, schema_editor):
    UserProfile = apps.get_model('books', 'UserProfile')
    User = apps.get_model('auth', 'User')

    # 1. Backfill normalized_email on UserProfile for all existing users with non-empty emails
    for profile in UserProfile.objects.select_related('user').all():
        if profile.user and profile.user.email:
            norm = profile.user.email.strip().lower()
            if profile.normalized_email != norm:
                profile.normalized_email = norm
                profile.save(update_fields=['normalized_email'])

    # 2. Database level case-insensitive uniqueness index on auth_user (email)
    vendor = schema_editor.connection.vendor
    if vendor == 'postgresql':
        schema_editor.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS auth_user_unique_lower_email ON auth_user (LOWER(email)) WHERE email != '';"
        )
    elif vendor == 'sqlite':
        schema_editor.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS auth_user_unique_lower_email ON auth_user (email COLLATE NOCASE) WHERE email != '';"
        )

def remove_unique_index(apps, schema_editor):
    schema_editor.execute("DROP INDEX IF EXISTS auth_user_unique_lower_email;")

class Migration(migrations.Migration):

    dependencies = [
        ('books', '0028_tenantsubscription_is_trial_and_more'),
    ]

    operations = [
        migrations.RunPython(backfill_and_create_index, remove_unique_index),
    ]


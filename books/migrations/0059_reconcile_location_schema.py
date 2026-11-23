from django.db import migrations


def reconcile_location_columns(apps, schema_editor):
    BusinessLocation = apps.get_model('books', 'BusinessLocation')
    table_name = BusinessLocation._meta.db_table
    connection = schema_editor.connection

    with connection.cursor() as cursor:
        cursor.execute('PRAGMA table_info(%s)' % table_name)
        existing_columns = {row[1] for row in cursor.fetchall()}

    for field_name in (
        'uuid',
        'location_type',
        'logo_data',
        'parent',
        'attention',
        'street1',
        'street2',
        'country',
        'phone',
        'fax',
        'website',
        'primary_contact',
        'default_transaction_series',
    ):
        field = BusinessLocation._meta.get_field(field_name)
        if field.column not in existing_columns:
            schema_editor.add_field(BusinessLocation, field)
            existing_columns.add(field.column)

    for field_name in ('assigned_users', 'transaction_series'):
        field = BusinessLocation._meta.get_field(field_name)
        through_table = field.remote_field.through._meta.db_table
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name=%s",
                [through_table],
            )
            exists = cursor.fetchone() is not None
        if not exists:
            schema_editor.create_model(field.remote_field.through)


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ('books', '0058_location_relationship_completion'),
    ]

    operations = [
        migrations.RunPython(reconcile_location_columns, noop),
    ]

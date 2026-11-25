from django.db import migrations
from django.db.models import Max


def advance_organization_sequence(apps, schema_editor):
    connection = schema_editor.connection
    if connection.vendor != 'postgresql':
        return

    Organization = apps.get_model('books', 'Organization')
    pk_field = Organization._meta.pk
    max_id = Organization.objects.aggregate(max_id=Max(pk_field.name))['max_id']
    if max_id is None:
        return

    table_name = connection.ops.quote_name(Organization._meta.db_table)
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT pg_get_serial_sequence(%s, %s)",
            [table_name, pk_field.column],
        )
        sequence_name = cursor.fetchone()[0]
        if not sequence_name:
            raise RuntimeError('Organization primary-key sequence was not found.')

        quoted_sequence = '.'.join(
            connection.ops.quote_name(part)
            for part in sequence_name.split('.')
        )
        cursor.execute(f"SELECT last_value, is_called FROM {quoted_sequence}")
        sequence_value, is_called = cursor.fetchone()

        if sequence_value < max_id or (sequence_value == max_id and not is_called):
            cursor.execute(
                "SELECT setval(%s::regclass, %s, true)",
                [sequence_name, max_id],
            )


class Migration(migrations.Migration):

    dependencies = [
        ('books', '0066_accountant_budget_half_yearly'),
    ]

    operations = [
        migrations.RunPython(advance_organization_sequence, migrations.RunPython.noop),
    ]

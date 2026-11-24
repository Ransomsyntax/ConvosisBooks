# Generated manually for the Business Location to Branch consolidation.
from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ('books', '0060_businesslocation_custom_fields_data'),
    ]

    operations = [
        migrations.RenameModel(
            old_name='BusinessLocation',
            new_name='Branch',
        ),
    ]

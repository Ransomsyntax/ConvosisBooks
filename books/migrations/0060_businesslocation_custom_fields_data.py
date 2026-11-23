from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('books', '0059_reconcile_location_schema'),
    ]

    operations = [
        migrations.AddField(
            model_name='businesslocation',
            name='custom_fields_data',
            field=models.JSONField(blank=True, default=dict),
        ),
    ]

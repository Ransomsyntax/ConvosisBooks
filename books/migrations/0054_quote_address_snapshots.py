from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('books', '0053_quote_custom_fields_data'),
    ]

    operations = [
        migrations.AddField(
            model_name='quote',
            name='billing_address_data',
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name='quote',
            name='shipping_address_data',
            field=models.JSONField(blank=True, default=dict),
        ),
    ]

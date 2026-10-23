
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('books', '0007_developerapikey_tenantsubscription_and_more'),
    ]

    operations = [
        migrations.AlterField(
            model_name='paymenttransaction',
            name='gateway',
            field=models.CharField(default='upi', max_length=40),
        ),
    ]

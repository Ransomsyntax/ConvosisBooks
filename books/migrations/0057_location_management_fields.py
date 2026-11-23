from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('books', '0056_documentnumberseries_format_pattern'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(model_name='businesslocation', name='uuid', field=models.UUIDField(db_index=True, default=uuid.uuid4, editable=False)),
        migrations.AddField(model_name='businesslocation', name='location_type', field=models.CharField(choices=[('business', 'Business Location'), ('warehouse', 'Warehouse Only Location')], default='business', max_length=20)),
        migrations.AddField(model_name='businesslocation', name='logo_data', field=models.TextField(blank=True, default='')),
        migrations.AddField(model_name='businesslocation', name='parent', field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='child_locations', to='books.businesslocation')),
        migrations.AddField(model_name='businesslocation', name='attention', field=models.CharField(blank=True, default='', max_length=120)),
        migrations.AddField(model_name='businesslocation', name='street1', field=models.CharField(blank=True, default='', max_length=200)),
        migrations.AddField(model_name='businesslocation', name='street2', field=models.CharField(blank=True, default='', max_length=200)),
        migrations.AddField(model_name='businesslocation', name='country', field=models.CharField(blank=True, default='India', max_length=100)),
        migrations.AddField(model_name='businesslocation', name='phone', field=models.CharField(blank=True, default='', max_length=50)),
        migrations.AddField(model_name='businesslocation', name='fax', field=models.CharField(blank=True, default='', max_length=50)),
        migrations.AddField(model_name='businesslocation', name='website', field=models.CharField(blank=True, default='', max_length=200)),
        migrations.AddField(model_name='businesslocation', name='primary_contact', field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='primary_business_locations', to=settings.AUTH_USER_MODEL)),
        migrations.AddField(model_name='businesslocation', name='assigned_users', field=models.ManyToManyField(blank=True, related_name='assigned_business_locations', to=settings.AUTH_USER_MODEL)),
        migrations.AddField(model_name='businesslocation', name='transaction_series', field=models.ManyToManyField(blank=True, related_name='locations', to='books.documentnumberseries')),
        migrations.AddField(model_name='businesslocation', name='default_transaction_series', field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='default_for_locations', to='books.documentnumberseries')),
        migrations.AddConstraint(model_name='businesslocation', constraint=models.CheckConstraint(condition=~models.Q(parent=models.F('pk')), name='check_location_not_own_parent')),
    ]

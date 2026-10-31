
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion

class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('books', '0006_backgroundtask_gstrreturn_securitybackuprecord_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='DeveloperApiKey',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100)),
                ('key_prefix', models.CharField(default='sk_live_', max_length=16)),
                ('masked_key', models.CharField(max_length=40)),
                ('key_hash', models.CharField(max_length=64, unique=True)),
                ('scopes', models.JSONField(blank=True, default=list)),
                ('is_active', models.BooleanField(default=True)),
                ('last_used_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='TenantSubscription',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('tier', models.CharField(choices=[('starter', 'Starter Edition (Small Business)'), ('growth', 'Growth Edition (Mid-Market)'), ('enterprise', 'Enterprise Scale Edition (Multi-GSTIN)')], default='growth', max_length=30)),
                ('billing_cycle', models.CharField(default='annual', max_length=20)),
                ('status', models.CharField(default='active', max_length=20)),
                ('invoice_limit', models.PositiveIntegerField(default=1000)),
                ('user_seat_limit', models.PositiveIntegerField(default=15)),
                ('storage_limit_mb', models.PositiveIntegerField(default=10240)),
                ('period_start', models.DateField(blank=True, null=True)),
                ('period_end', models.DateField(blank=True, null=True)),
                ('auto_renew', models.BooleanField(default=True)),
                ('payment_method', models.CharField(default='Visa ending in 4242', max_length=50)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
        ),
        migrations.CreateModel(
            name='WebhookSubscription',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('endpoint_url', models.URLField()),
                ('secret', models.CharField(max_length=64)),
                ('events', models.JSONField(blank=True, default=list)),
                ('is_active', models.BooleanField(default=True)),
                ('last_delivery_at', models.DateTimeField(blank=True, null=True)),
                ('last_status_code', models.PositiveSmallIntegerField(default=200)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='Notification',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=200)),
                ('message', models.TextField()),
                ('category', models.CharField(default='system', max_length=30)),
                ('link', models.CharField(blank=True, max_length=200)),
                ('is_read', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('user', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='notifications', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
    ]

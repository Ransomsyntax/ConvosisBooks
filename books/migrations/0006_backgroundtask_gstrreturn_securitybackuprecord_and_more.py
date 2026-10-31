
from decimal import Decimal
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion

class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('books', '0005_account_bankaccount_creditnote_customfield_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='BackgroundTask',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('task_id', models.CharField(max_length=50, unique=True)),
                ('task_type', models.CharField(max_length=50)),
                ('status', models.CharField(default='completed', max_length=30)),
                ('progress', models.PositiveSmallIntegerField(default=100)),
                ('summary', models.CharField(blank=True, max_length=255)),
                ('details', models.JSONField(blank=True, default=dict)),
                ('error_message', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('completed_at', models.DateTimeField(blank=True, null=True)),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='GSTRReturn',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('return_type', models.CharField(choices=[('GSTR1', 'GSTR-1 (Outward Supplies)'), ('GSTR3B', 'GSTR-3B (Summary Return)')], max_length=15)),
                ('financial_year', models.CharField(default='2026-27', max_length=15)),
                ('tax_period', models.CharField(default='042026', max_length=10)),
                ('status', models.CharField(default='draft', max_length=30)),
                ('arn', models.CharField(blank=True, max_length=40)),
                ('filed_at', models.DateTimeField(blank=True, null=True)),
                ('taxable_value', models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=14)),
                ('cgst_amount', models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=14)),
                ('sgst_amount', models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=14)),
                ('igst_amount', models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=14)),
                ('total_tax', models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=14)),
                ('payload_json', models.JSONField(blank=True, default=dict)),
                ('response_json', models.JSONField(blank=True, default=dict)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='SecurityBackupRecord',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('snapshot_id', models.CharField(max_length=60, unique=True)),
                ('filename', models.CharField(max_length=255)),
                ('file_size_bytes', models.PositiveIntegerField(default=0)),
                ('checksum_sha256', models.CharField(max_length=64)),
                ('backup_type', models.CharField(default='snapshot', max_length=30)),
                ('status', models.CharField(default='verified', max_length=30)),
                ('record_counts', models.JSONField(blank=True, default=dict)),
                ('disaster_recovery_test_passed', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddField(
            model_name='auditlog',
            name='prev_hash',
            field=models.CharField(blank=True, default='', max_length=64),
        ),
        migrations.AddField(
            model_name='auditlog',
            name='record_hash',
            field=models.CharField(blank=True, default='', max_length=64),
        ),
        migrations.AddField(
            model_name='banktransaction',
            name='is_live_feed',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='banktransaction',
            name='transaction_hash',
            field=models.CharField(blank=True, db_index=True, default='', max_length=64),
        ),
        migrations.CreateModel(
            name='VendorPortalAccess',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('token', models.CharField(max_length=64, unique=True)),
                ('is_active', models.BooleanField(default=True)),
                ('allow_bill_upload', models.BooleanField(default=True)),
                ('last_login_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('vendor', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='portal_access', to='books.vendor')),
            ],
        ),
        migrations.CreateModel(
            name='UserProfile',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('role', models.CharField(choices=[('admin', 'Administrator (Full Access)'), ('accountant', 'Standard Accountant'), ('auditor', 'Statutory Auditor (Read-Only)'), ('cashier', 'Billing Operator & Cashier'), ('portal', 'Customer/Vendor Portal User')], default='admin', max_length=30)),
                ('phone', models.CharField(blank=True, max_length=30)),
                ('mfa_enabled', models.BooleanField(default=True)),
                ('mfa_secret', models.CharField(blank=True, default='', max_length=64)),
                ('backup_codes', models.JSONField(blank=True, default=list)),
                ('last_active_ip', models.CharField(blank=True, max_length=50)),
                ('is_locked', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('user', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='profile', to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.CreateModel(
            name='CustomerPortalAccess',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('token', models.CharField(max_length=64, unique=True)),
                ('portal_username', models.CharField(blank=True, max_length=100)),
                ('is_active', models.BooleanField(default=True)),
                ('allow_online_payment', models.BooleanField(default=True)),
                ('allow_estimate_approval', models.BooleanField(default=True)),
                ('allow_statement_download', models.BooleanField(default=True)),
                ('last_login_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('customer', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='portal_access', to='books.customer')),
            ],
        ),
        migrations.CreateModel(
            name='BankStatementBatch',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('batch_number', models.CharField(max_length=50, unique=True)),
                ('filename', models.CharField(max_length=255)),
                ('source', models.CharField(default='csv_import', max_length=30)),
                ('imported_at', models.DateTimeField(auto_now_add=True)),
                ('total_rows', models.PositiveIntegerField(default=0)),
                ('imported_count', models.PositiveIntegerField(default=0)),
                ('duplicate_count', models.PositiveIntegerField(default=0)),
                ('status', models.CharField(default='completed', max_length=30)),
                ('reconciled_count', models.PositiveIntegerField(default=0)),
                ('bank_account', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='statement_batches', to='books.bankaccount')),
            ],
            options={
                'ordering': ['-imported_at'],
            },
        ),
        migrations.CreateModel(
            name='BankRule',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=150)),
                ('priority', models.PositiveSmallIntegerField(default=10)),
                ('field', models.CharField(default='description', max_length=40)),
                ('operator', models.CharField(default='contains', max_length=20)),
                ('value', models.CharField(max_length=200)),
                ('assign_party_type', models.CharField(blank=True, max_length=20)),
                ('assign_party_id', models.PositiveIntegerField(blank=True, null=True)),
                ('auto_reconcile', models.BooleanField(default=False)),
                ('active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('assign_account', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='+', to='books.account')),
            ],
            options={
                'ordering': ['priority', 'name'],
            },
        ),
        migrations.CreateModel(
            name='BankFeedConnection',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('provider', models.CharField(default='setu_aa', max_length=50)),
                ('provider_name', models.CharField(default='Open Banking Live Feed', max_length=100)),
                ('status', models.CharField(default='connected', max_length=30)),
                ('consent_id', models.CharField(blank=True, max_length=100)),
                ('consent_expires_at', models.DateTimeField(blank=True, null=True)),
                ('auto_sync', models.BooleanField(default=True)),
                ('sync_frequency', models.CharField(default='hourly', max_length=30)),
                ('account_mask', models.CharField(blank=True, max_length=30)),
                ('last_synced_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('bank_account', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='feed_connection', to='books.bankaccount')),
            ],
        ),
        migrations.AddField(
            model_name='banktransaction',
            name='batch',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='transactions', to='books.bankstatementbatch'),
        ),
    ]

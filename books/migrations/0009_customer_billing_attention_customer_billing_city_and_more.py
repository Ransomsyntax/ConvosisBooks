
from decimal import Decimal
from django.db import migrations, models

class Migration(migrations.Migration):

    dependencies = [
        ('books', '0008_alter_paymenttransaction_gateway'),
    ]

    operations = [
        migrations.AddField(
            model_name='customer',
            name='billing_attention',
            field=models.CharField(blank=True, max_length=150),
        ),
        migrations.AddField(
            model_name='customer',
            name='billing_city',
            field=models.CharField(blank=True, max_length=100),
        ),
        migrations.AddField(
            model_name='customer',
            name='billing_country',
            field=models.CharField(blank=True, default='India', max_length=100),
        ),
        migrations.AddField(
            model_name='customer',
            name='billing_phone',
            field=models.CharField(blank=True, max_length=30),
        ),
        migrations.AddField(
            model_name='customer',
            name='billing_pincode',
            field=models.CharField(blank=True, max_length=20),
        ),
        migrations.AddField(
            model_name='customer',
            name='contact_persons_data',
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name='customer',
            name='currency',
            field=models.CharField(blank=True, default='INR', max_length=10),
        ),
        migrations.AddField(
            model_name='customer',
            name='custom_fields_data',
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name='customer',
            name='customer_language',
            field=models.CharField(blank=True, default='English', max_length=40),
        ),
        migrations.AddField(
            model_name='customer',
            name='customer_type',
            field=models.CharField(choices=[('business', 'Business'), ('individual', 'Individual')], default='business', max_length=20),
        ),
        migrations.AddField(
            model_name='customer',
            name='documents_data',
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name='customer',
            name='exemption_reason',
            field=models.CharField(blank=True, max_length=200),
        ),
        migrations.AddField(
            model_name='customer',
            name='gst_treatment',
            field=models.CharField(blank=True, default='business_regular', max_length=40),
        ),
        migrations.AddField(
            model_name='customer',
            name='mobile',
            field=models.CharField(blank=True, max_length=30),
        ),
        migrations.AddField(
            model_name='customer',
            name='opening_balance',
            field=models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=14),
        ),
        migrations.AddField(
            model_name='customer',
            name='opening_balance_type',
            field=models.CharField(choices=[('debit', 'Debit'), ('credit', 'Credit')], default='debit', max_length=10),
        ),
        migrations.AddField(
            model_name='customer',
            name='payment_terms_label',
            field=models.CharField(blank=True, default='Net 30', max_length=50),
        ),
        migrations.AddField(
            model_name='customer',
            name='place_of_supply',
            field=models.CharField(blank=True, max_length=80),
        ),
        migrations.AddField(
            model_name='customer',
            name='portal_enabled',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='customer',
            name='portal_language',
            field=models.CharField(blank=True, default='English', max_length=40),
        ),
        migrations.AddField(
            model_name='customer',
            name='remarks',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='customer',
            name='reporting_tags',
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name='customer',
            name='shipping_attention',
            field=models.CharField(blank=True, max_length=150),
        ),
        migrations.AddField(
            model_name='customer',
            name='shipping_city',
            field=models.CharField(blank=True, max_length=100),
        ),
        migrations.AddField(
            model_name='customer',
            name='shipping_country',
            field=models.CharField(blank=True, default='India', max_length=100),
        ),
        migrations.AddField(
            model_name='customer',
            name='shipping_phone',
            field=models.CharField(blank=True, max_length=30),
        ),
        migrations.AddField(
            model_name='customer',
            name='shipping_pincode',
            field=models.CharField(blank=True, max_length=20),
        ),
        migrations.AddField(
            model_name='customer',
            name='shipping_state',
            field=models.CharField(blank=True, max_length=80),
        ),
        migrations.AddField(
            model_name='customer',
            name='tax_preference',
            field=models.CharField(blank=True, default='taxable', max_length=30),
        ),
        migrations.AddField(
            model_name='vendor',
            name='apply_gst_tds',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='vendor',
            name='bank_account_holder',
            field=models.CharField(blank=True, max_length=150),
        ),
        migrations.AddField(
            model_name='vendor',
            name='bank_account_number',
            field=models.CharField(blank=True, max_length=60),
        ),
        migrations.AddField(
            model_name='vendor',
            name='bank_branch',
            field=models.CharField(blank=True, max_length=100),
        ),
        migrations.AddField(
            model_name='vendor',
            name='bank_ifsc',
            field=models.CharField(blank=True, max_length=20),
        ),
        migrations.AddField(
            model_name='vendor',
            name='bank_name',
            field=models.CharField(blank=True, max_length=120),
        ),
        migrations.AddField(
            model_name='vendor',
            name='bank_upi_id',
            field=models.CharField(blank=True, max_length=100),
        ),
        migrations.AddField(
            model_name='vendor',
            name='billing_attention',
            field=models.CharField(blank=True, max_length=150),
        ),
        migrations.AddField(
            model_name='vendor',
            name='billing_city',
            field=models.CharField(blank=True, max_length=100),
        ),
        migrations.AddField(
            model_name='vendor',
            name='billing_country',
            field=models.CharField(blank=True, default='India', max_length=100),
        ),
        migrations.AddField(
            model_name='vendor',
            name='billing_phone',
            field=models.CharField(blank=True, max_length=30),
        ),
        migrations.AddField(
            model_name='vendor',
            name='billing_pincode',
            field=models.CharField(blank=True, max_length=20),
        ),
        migrations.AddField(
            model_name='vendor',
            name='contact_persons_data',
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name='vendor',
            name='currency',
            field=models.CharField(blank=True, default='INR', max_length=10),
        ),
        migrations.AddField(
            model_name='vendor',
            name='custom_fields_data',
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name='vendor',
            name='documents_data',
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name='vendor',
            name='exemption_reason',
            field=models.CharField(blank=True, max_length=200),
        ),
        migrations.AddField(
            model_name='vendor',
            name='gst_treatment',
            field=models.CharField(blank=True, default='business_regular', max_length=40),
        ),
        migrations.AddField(
            model_name='vendor',
            name='is_msme_registered',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='vendor',
            name='mobile',
            field=models.CharField(blank=True, max_length=30),
        ),
        migrations.AddField(
            model_name='vendor',
            name='msme_reg_number',
            field=models.CharField(blank=True, max_length=60),
        ),
        migrations.AddField(
            model_name='vendor',
            name='msme_type',
            field=models.CharField(blank=True, choices=[('micro', 'Micro'), ('small', 'Small'), ('medium', 'Medium')], max_length=30),
        ),
        migrations.AddField(
            model_name='vendor',
            name='opening_balance',
            field=models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=14),
        ),
        migrations.AddField(
            model_name='vendor',
            name='opening_balance_type',
            field=models.CharField(choices=[('debit', 'Debit'), ('credit', 'Credit')], default='debit', max_length=10),
        ),
        migrations.AddField(
            model_name='vendor',
            name='payment_terms_label',
            field=models.CharField(blank=True, default='Net 30', max_length=50),
        ),
        migrations.AddField(
            model_name='vendor',
            name='remarks',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='vendor',
            name='reporting_tags',
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name='vendor',
            name='source_of_supply',
            field=models.CharField(blank=True, max_length=80),
        ),
        migrations.AddField(
            model_name='vendor',
            name='tax_preference',
            field=models.CharField(blank=True, default='taxable', max_length=30),
        ),
        migrations.AddField(
            model_name='vendor',
            name='tds_section',
            field=models.CharField(blank=True, max_length=50),
        ),
        migrations.AlterField(
            model_name='customer',
            name='phone',
            field=models.CharField(blank=True, max_length=30),
        ),
        migrations.AlterField(
            model_name='vendor',
            name='phone',
            field=models.CharField(blank=True, max_length=30),
        ),
    ]

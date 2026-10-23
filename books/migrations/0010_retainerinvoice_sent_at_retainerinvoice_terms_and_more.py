
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('books', '0009_customer_billing_attention_customer_billing_city_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='retainerinvoice',
            name='sent_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='retainerinvoice',
            name='terms',
            field=models.TextField(blank=True),
        ),
        migrations.CreateModel(
            name='RetainerPayment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('date', models.DateField()),
                ('amount', models.DecimalField(decimal_places=2, max_digits=14)),
                ('mode', models.CharField(choices=[('cash', 'Cash'), ('bank_transfer', 'Bank transfer'), ('upi', 'UPI'), ('cheque', 'Cheque'), ('card', 'Card'), ('other', 'Other')], default='bank_transfer', max_length=20)),
                ('account', models.CharField(default='Bank Account', max_length=60)),
                ('reference', models.CharField(blank=True, max_length=80)),
                ('notes', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('payment_received', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='retainer_payments', to='books.paymentreceived')),
                ('retainer', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='payments', to='books.retainerinvoice')),
            ],
        ),
        migrations.CreateModel(
            name='RetainerInvoiceAllocation',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('date', models.DateField()),
                ('amount', models.DecimalField(decimal_places=2, max_digits=14)),
                ('notes', models.CharField(blank=True, max_length=200)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('invoice', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='retainer_allocations', to='books.invoice')),
                ('retainer', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='allocations', to='books.retainerinvoice')),
            ],
        ),
    ]

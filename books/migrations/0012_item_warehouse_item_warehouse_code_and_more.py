

from django.db import migrations, models
import django.db.models.deletion

class Migration(migrations.Migration):

    dependencies = [
        ('books', '0011_bankaccount_bank_balance_bankaccount_branch_name_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='item',
            name='warehouse',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='items', to='books.warehouse'),
        ),
        migrations.AddField(
            model_name='item',
            name='warehouse_code',
            field=models.CharField(blank=True, default='', max_length=30),
        ),
        migrations.AddField(
            model_name='stockmovement',
            name='adjusted_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='stockmovement',
            name='to_warehouse',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='incoming_stock_movements', to='books.warehouse'),
        ),
        migrations.AddField(
            model_name='stockmovement',
            name='to_warehouse_code',
            field=models.CharField(blank=True, default='', max_length=30),
        ),
        migrations.AddField(
            model_name='stockmovement',
            name='warehouse',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='stock_movements', to='books.warehouse'),
        ),
        migrations.AddField(
            model_name='stockmovement',
            name='warehouse_code',
            field=models.CharField(blank=True, default='', max_length=30),
        ),
        migrations.AddField(
            model_name='warehouse',
            name='parent',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='sub_warehouses', to='books.warehouse'),
        ),
        migrations.AddField(
            model_name='warehouse',
            name='shared_database',
            field=models.BooleanField(default=True, help_text='Operates on shared centralized database'),
        ),
        migrations.AlterField(
            model_name='item',
            name='sku',
            field=models.CharField(blank=True, max_length=60, unique=True),
        ),
        migrations.AlterField(
            model_name='stockmovement',
            name='kind',
            field=models.CharField(choices=[('opening', 'Opening stock'), ('sale', 'Sale'), ('sale_void', 'Sale voided'), ('purchase', 'Purchase'), ('purchase_void', 'Purchase voided'), ('adjustment', 'Adjustment'), ('transfer', 'Warehouse Transfer')], max_length=15),
        ),
    ]

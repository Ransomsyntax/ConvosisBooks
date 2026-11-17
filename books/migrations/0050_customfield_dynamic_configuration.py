from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('books', '0049_organization_module_gating'),
    ]

    operations = [
        migrations.AddField(
            model_name='customfield',
            name='default_value',
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name='customfield',
            name='display_order',
            field=models.PositiveIntegerField(db_index=True, default=0),
        ),
        migrations.AddField(
            model_name='customfield',
            name='filterable',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='customfield',
            name='form_visible',
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name='customfield',
            name='hidden',
            field=models.BooleanField(db_index=True, default=False),
        ),
        migrations.AddField(
            model_name='customfield',
            name='list_visible',
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name='customfield',
            name='pdf_visible',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='customfield',
            name='read_only',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='customfield',
            name='role_permissions',
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name='customfield',
            name='searchable',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='customfield',
            name='validation_rules',
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name='customfield',
            name='created_at',
            field=models.DateTimeField(auto_now_add=True, null=True),
        ),
        migrations.AddField(
            model_name='customfield',
            name='updated_at',
            field=models.DateTimeField(auto_now=True, null=True),
        ),
        migrations.AddField(
            model_name='userprofile',
            name='field_preferences',
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name='userprofile',
            name='personal_preferences',
            field=models.JSONField(blank=True, default=dict),
        ),
    ]

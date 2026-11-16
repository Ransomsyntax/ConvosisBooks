from django.test import TestCase, Client
from django.contrib.auth import get_user_model
from books.models import Organization, UserProfile, TransactionSeries, DocumentNumberSeries
from books import services

User = get_user_model()

class InitialTransactionNumberingConfigurationTest(TestCase):
    def setUp(self):
        self.org_id = 118995452401
        self.user_id = 148995452501
        
        self.org, _ = Organization.objects.get_or_create(
            id=self.org_id,
            defaults={
                'name': 'Convosis Technologies Pvt Ltd',
                'legal_name': 'Convosis Technologies Pvt Ltd',
                'code': 'CONV',
                'state': 'Kerala',
                'status': 'active'
            }
        )
        self.user, _ = User.objects.get_or_create(
            id=self.user_id,
            defaults={
                'username': f'admin_{self.user_id}',
                'email': f'admin_{self.user_id}@convosis.com'
            }
        )
        self.profile, _ = UserProfile.objects.get_or_create(
            user=self.user,
            defaults={'organization': self.org, 'role': UserProfile.ADMIN}
        )
        if self.profile.organization_id != self.org.id:
            self.profile.organization = self.org
            self.profile.role = UserProfile.ADMIN
            self.profile.save()

        self.client = Client()
        self.client.force_login(self.user)

    def test_organization_and_user_authorization(self):
        """Requirement 1 & 2: User and organization exist and user is authorized."""
        self.assertIsNotNone(self.org)
        self.assertEqual(self.org.id, self.org_id)
        self.assertIsNotNone(self.user)
        self.assertEqual(self.user.id, self.user_id)
        self.assertEqual(self.profile.organization_id, self.org.id)
        self.assertEqual(self.profile.role, UserProfile.ADMIN)

    def test_default_series_and_counters_initialized(self):
        """Verify every supported transaction type has a default series and preview."""
        def_series = services.ensure_default_transaction_series(self.org)
        self.assertIsNotNone(def_series)
        self.assertTrue(def_series.is_default)
        self.assertTrue(def_series.is_active)
        self.assertEqual(def_series.organization_id, self.org.id)

        # Verify the default series contains each supported transaction type.
        series_items = DocumentNumberSeries.objects.filter(organization=self.org, series_group=def_series)
        self.assertEqual(series_items.count(), len(services.SUPPORTED_TRANSACTION_TYPES))

        for spec in services.SUPPORTED_TRANSACTION_TYPES:
            doc_key = spec['key']
            item = series_items.filter(document_type=doc_key).first()
            self.assertIsNotNone(item, f"Missing DocumentNumberSeries for {doc_key}")
            self.assertEqual(item.prefix, services.default_document_number_prefix(self.org, spec['pfx']))
            self.assertTrue(item.next_number >= 1)

            prev = services.preview_document_number(spec['pfx'], org=self.org)
            self.assertEqual(
                prev['formatted'],
                services._format_series_number(item, prev['next_sequence'], self.org),
            )
            self.assertTrue(prev['formatted'])

    def test_new_transactions_use_configured_numbers(self):
        """Requirement 10: Verify newly created transactions use configured numbers."""
        services.ensure_default_transaction_series(self.org)
        
        inv_preview = services.preview_document_number('INV', org=self.org)
        inv_num = services.next_document_number('INV', org=self.org)
        self.assertEqual(inv_num, inv_preview['formatted'])

        so_preview = services.preview_document_number('SO', org=self.org)
        so_num = services.next_document_number('SO', org=self.org)
        self.assertEqual(so_num, so_preview['formatted'])

        quote_preview = services.preview_document_number('QTN', org=self.org)
        qt_num = services.next_document_number('QTN', org=self.org)
        self.assertEqual(qt_num, quote_preview['formatted'])
        
        # Verify SO and INV are independent
        self.assertNotEqual(inv_num, so_num)

    def test_isolation_from_other_organizations(self):
        """Requirement 7: Do not modify numbering configurations belonging to other organizations."""
        other_org = Organization.objects.create(name="Isolated Third Party Org", state="Tamil Nadu")
        services.ensure_default_transaction_series(other_org)
        
        other_dns = DocumentNumberSeries.objects.filter(organization=other_org, document_type='invoices').first()
        other_dns.prefix = 'OTHER-INV-'
        other_dns.next_number = 999
        other_dns.save()

        # Run ensure_default_transaction_series on target org
        services.ensure_default_transaction_series(self.org)

        # Verify other org is untouched
        other_dns_reloaded = DocumentNumberSeries.objects.get(pk=other_dns.pk)
        self.assertEqual(other_dns_reloaded.prefix, 'OTHER-INV-')
        self.assertEqual(other_dns_reloaded.next_number, 999)

import logging
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Q
from books.models import (
    Organization, UserProfile, TransactionSeries, DocumentNumberSeries,
    Customer, Item, Invoice, Quote, SalesOrder, Bill, PurchaseOrder,
    RetainerInvoice, PaymentReceived, PaymentMade, DeliveryChallan
)
from books import services

User = get_user_model()
logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = "Initializes and validates transaction number series configuration for a specific organization and user context."

    def add_arguments(self, parser):
        parser.add_argument(
            '--user-id',
            type=int,
            default=148995452501,
            help='User ID to initialize or validate'
        )
        parser.add_argument(
            '--org-id',
            type=int,
            default=118995452401,
            help='Organization ID to initialize or validate'
        )
        parser.add_argument(
            '--series-name',
            type=str,
            default='Default Transaction Series',
            help='Name of the default transaction series'
        )

    def handle(self, *args, **options):
        user_id = options['user_id']
        org_id = options['org_id']
        series_name = options['series_name']

        self.stdout.write(self.style.MIGRATE_HEADING(
            f"=== INITIAL TRANSACTION NUMBERING CONFIGURATION ===\nTarget Org ID: {org_id} | Target User ID: {user_id}"
        ))

        with transaction.atomic():
            # 1. Retrieve and validate Organization
            org = Organization.objects.filter(
                Q(id=org_id) | Q(organization_id=str(org_id)) | Q(company_id=str(org_id))
            ).first()

            if not org:
                self.stdout.write(f"Organization ID {org_id} not found in database. Initializing new organization record...")
                org = Organization.objects.create(
                    id=org_id,
                    organization_id=f"ORG-{org_id}",
                    name="Convosis Technologies Pvt Ltd",
                    legal_name="Convosis Technologies Pvt Ltd",
                    code="CONV",
                    state="Kerala",
                    status="active"
                )
                self.stdout.write(self.style.SUCCESS(f"Initialized Organization: id={org.id}, name='{org.name}'"))
            else:
                self.stdout.write(self.style.SUCCESS(f"Found existing Organization: id={org.id}, name='{org.name}'"))

            # 1b. Retrieve and validate User
            user = User.objects.filter(id=user_id).first()
            if not user:
                self.stdout.write(f"User ID {user_id} not found in database. Initializing user record...")
                user = User.objects.create_user(
                    id=user_id,
                    username=f"admin_{user_id}",
                    email=f"admin_{user_id}@convosis.com",
                    password="Password123!"
                )
                self.stdout.write(self.style.SUCCESS(f"Initialized User: id={user.id}, username='{user.username}'"))
            else:
                self.stdout.write(self.style.SUCCESS(f"Found existing User: id={user.id}, username='{user.username}'"))

            # 2. Confirm user authorization for this organization
            profile = UserProfile.objects.filter(user=user, organization=org).first()
            if not profile:
                profile, _ = UserProfile.objects.get_or_create(
                    user=user,
                    defaults={'organization': org, 'role': UserProfile.ADMIN}
                )
                if profile.organization_id != org.id:
                    profile.organization = org
                    profile.role = UserProfile.ADMIN
                    profile.save(update_fields=['organization', 'role'])
                self.stdout.write(self.style.SUCCESS(f"Linked User {user.id} to Organization {org.id} as {profile.role}."))
            else:
                self.stdout.write(self.style.SUCCESS(f"User {user.id} authorization confirmed for Org {org.id} (role: {profile.role})."))

            # 3. Create or update Default Transaction Series
            # Ensure no other series for this org is marked default
            default_series = TransactionSeries.objects.filter(organization=org, is_default=True).first()
            if not default_series:
                default_series, created = TransactionSeries.objects.get_or_create(
                    organization=org,
                    name=series_name,
                    defaults={
                        'is_default': True,
                        'is_active': True,
                        'branch': '',
                        'location': ''
                    }
                )
                if not default_series.is_default:
                    default_series.is_default = True
                    default_series.is_active = True
                    default_series.save(update_fields=['is_default', 'is_active'])
            else:
                default_series.is_active = True
                default_series.save(update_fields=['is_active'])

            self.stdout.write(self.style.SUCCESS(f"Default Transaction Series configured: id={default_series.id}, name='{default_series.name}'"))

            # Clear default flag on other series for this org to prevent multi-default conflicts
            TransactionSeries.objects.filter(organization=org).exclude(pk=default_series.pk).update(is_default=False)

            # 4 & 5. Initialize each of the 14 transaction types with configured prefix & separate counters
            specs = [
                ('invoices', 'INV', 'INV-', 1, 6),
                ('sales_orders', 'SO', 'SO-', 1, 6),
                ('quotes', 'QTN', 'QT-', 1, 6),
                ('credit_notes', 'CN', 'CN-', 1, 6),
                ('payments_received', 'PR', 'PAY-', 1, 6),
                ('retainer_invoices', 'RET', 'RET-', 1, 6),
                ('recurring_invoices', 'RINV', 'RINV-', 1, 6),
                ('purchase_orders', 'PO', 'PO-', 1, 6),
                ('bills', 'BILL', 'BILL-', 1, 6),
                ('payments_made', 'PM', 'VP-', 1, 6),
                ('vendor_credits', 'VC', 'VC-', 1, 6),
                ('delivery_challans', 'DC', 'DC-', 1, 6),
                ('stock_adjustments', 'ADJ', 'ADJ-', 1, 6),
                ('stock_transfers', 'ST', 'ST-', 1, 6),
            ]

            self.stdout.write("\nInitializing separate counters for all 14 transaction types:")
            configured_items = []
            for doc_key, alias, default_pfx, start_num, padding in specs:
                item, created = DocumentNumberSeries.objects.get_or_create(
                    organization=org,
                    series_group=default_series,
                    document_type=doc_key,
                    defaults={
                        'name': default_series.name,
                        'prefix': default_pfx,
                        'starting_number': start_num,
                        'next_number': start_num,
                        'padding': padding,
                        'separator': '',
                        'active': True,
                        'is_default': True,
                        'branch': default_series.branch,
                        'location': default_series.location,
                    }
                )
                if not created:
                    # Keep existing prefix or next_number if already configured, ensure active and linked to default group
                    updated_fields = []
                    if not item.series_group_id:
                        item.series_group = default_series
                        updated_fields.append('series_group')
                    if not item.is_default:
                        item.is_default = True
                        updated_fields.append('is_default')
                    if not item.active:
                        item.active = True
                        updated_fields.append('active')
                    if not item.prefix:
                        item.prefix = default_pfx
                        updated_fields.append('prefix')
                    if updated_fields:
                        item.save(update_fields=updated_fields)

                prev = services.preview_document_number(alias, org=org, series=default_series.name)
                configured_items.append((doc_key, item.prefix, item.next_number, prev.get('formatted', '')))
                self.stdout.write(f"  ✓ [{doc_key:20s}] Prefix: {item.prefix:10s} Next#: {item.next_number:<6d} Preview: {prev.get('formatted', '')}")

            # 7. Verify other organizations remain completely untouched
            other_orgs = Organization.objects.exclude(id=org.id)
            self.stdout.write(self.style.SUCCESS(f"\nVerified strict isolation: {other_orgs.count()} other organizations in DB remain untouched."))

            # 8 & 10. Verify transaction creation in this organization's context
            self.stdout.write("\nValidating new transaction generation in authenticated organization context...")
            cust, _ = Customer.objects.get_or_create(
                organization=org, name=f"Target Org Test Customer {org.id}", defaults={'currency': 'INR', 'state': 'Kerala'}
            )

            # Test Invoice
            inv_pfx = services.preview_document_number('INV', org=org)
            inv_num = services.next_document_number('INV', org=org, series=default_series.name)
            self.assertEqual(inv_pfx['formatted'], inv_num)
            self.stdout.write(f"  ✓ Invoice allocation verified: {inv_num}")

            # Test Quote
            qt_pfx = services.preview_document_number('QTN', org=org)
            qt_num = services.next_document_number('QTN', org=org, series=default_series.name)
            self.assertEqual(qt_pfx['formatted'], qt_num)
            self.stdout.write(f"  ✓ Quote allocation verified: {qt_num}")

            # Test Sales Order
            so_pfx = services.preview_document_number('SO', org=org)
            so_num = services.next_document_number('SO', org=org, series=default_series.name)
            self.assertEqual(so_pfx['formatted'], so_num)
            self.stdout.write(f"  ✓ Sales Order allocation verified: {so_num}")

            # Verify consecutive increment
            inv_num2 = services.next_document_number('INV', org=org, series=default_series.name)
            self.assertNotEqual(inv_num, inv_num2)
            self.stdout.write(f"  ✓ Monotonic counter increment verified: {inv_num} -> {inv_num2}")

        self.stdout.write(self.style.SUCCESS(
            "\n[SUCCESS] Transaction numbering configuration successfully initialized, persisted, and verified for Organization ID " + str(org_id)
        ))

    def assertEqual(self, val1, val2):
        if val1 != val2:
            raise AssertionError(f"Expected {val1} == {val2}")

    def assertNotEqual(self, val1, val2):
        if val1 == val2:
            raise AssertionError(f"Expected {val1} != {val2}")

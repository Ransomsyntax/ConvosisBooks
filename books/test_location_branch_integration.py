import json
from datetime import date

from django.contrib.auth.models import User
from django.test import Client, TestCase

from . import services

from .models import (
    Account,
    BusinessLocation,
    Customer,
    DocumentNumberSeries,
    Invoice,
    Item,
    Organization,
    UserProfile,
    Vendor,
)


class LocationBranchIntegrationTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='location-admin',
            email='location-admin@example.com',
            password='Password123!',
        )
        self.org = Organization.objects.create(
            name='Location Org',
            code='LOC',
            owner=self.user,
            state='Kerala',
        )
        UserProfile.objects.create(
            user=self.user,
            organization=self.org,
            role=UserProfile.ADMIN,
        )
        self.client = Client()
        self.client.force_login(self.user)
        self.location = BusinessLocation.objects.create(
            organization=self.org,
            name='Kochi Branch',
            location_type=BusinessLocation.LOCATION_TYPE_BUSINESS,
            city='Kochi',
            state='Kerala',
            is_default=True,
            active=True,
        )
        self.customer = Customer.objects.create(
            organization=self.org,
            name='Location Customer',
            customer_type='business',
            state='Kerala',
        )
        self.vendor = Vendor.objects.create(
            organization=self.org,
            name='Location Vendor',
            state='Kerala',
        )
        self.item = Item.objects.create(
            organization=self.org,
            name='Location Item',
            item_type=Item.GOODS,
            selling_price='100.00',
            purchase_price='60.00',
        )

    def post_json(self, path, payload, **extra):
        return self.client.post(
            path,
            data=json.dumps(payload),
            content_type='application/json',
            **extra,
        )

    def test_location_crud_duplicate_validation_and_lookup_isolation(self):
        series = DocumentNumberSeries.objects.create(
            organization=self.org,
            name='Trivandrum Invoice Series',
            document_type='invoices',
            prefix='TVM',
        )
        create = self.post_json('/api/settings/branches/', {
            'name': 'Trivandrum Branch',
            'location_type': 'business',
            'city': 'Thiruvananthapuram',
            'state': 'Kerala',
            'country': 'India',
            'primary_contact_id': self.user.id,
            'transaction_series_ids': [series.id],
            'default_transaction_series_id': series.id,
            'active': True,
        })
        self.assertEqual(create.status_code, 201, create.content)
        created_id = create.json()['location']['id']

        duplicate = self.post_json('/api/settings/branches/', {
            'name': 'trivandrum branch',
            'location_type': 'business',
            'primary_contact_id': self.user.id,
            'transaction_series_ids': [series.id],
            'default_transaction_series_id': series.id,
            'active': True,
        })
        self.assertEqual(duplicate.status_code, 409)

        update = self.client.put(
            f'/api/settings/branches/{created_id}/',
            data=json.dumps({
                'name': 'Thiruvananthapuram Branch',
                'location_type': 'business',
                'city': 'Thiruvananthapuram',
                'state': 'Kerala',
                'country': 'India',
                'primary_contact_id': self.user.id,
                'transaction_series_ids': [series.id],
                'default_transaction_series_id': series.id,
                'active': False,
            }),
            content_type='application/json',
        )
        self.assertEqual(update.status_code, 200, update.content)

        lookup = self.client.get('/api/lookup/branches/')
        self.assertEqual(lookup.status_code, 200)
        lookup_ids = {row['id'] for row in lookup.json()}
        self.assertIn(self.location.id, lookup_ids)
        self.assertNotIn(created_id, lookup_ids)

        detail = self.client.get(f'/api/settings/branches/{created_id}/')
        self.assertEqual(detail.status_code, 200)
        self.assertFalse(detail.json()['active'])

    def test_branch_prefix_crud_duplicate_validation_and_number_format(self):
        invalid = self.post_json('/api/settings/branches/', {
            'name': 'Invalid Prefix Branch',
            'prefix': 'BAD PREFIX!',
            'location_type': 'business',
            'primary_contact_id': self.user.id,
            'transaction_series_ids': [],
            'default_transaction_series_id': None,
            'active': True,
        })
        self.assertEqual(invalid.status_code, 400)

        numbering_series = DocumentNumberSeries.objects.create(
            organization=self.org,
            name='Kochi Branch Prefix Series',
            document_type='invoices',
            prefix='INV',
        )
        duplicate_series = DocumentNumberSeries.objects.create(
            organization=self.org,
            name='Duplicate Branch Prefix Series',
            document_type='invoices',
            prefix='DUP',
        )
        update_series = DocumentNumberSeries.objects.create(
            organization=self.org,
            name='Update Branch Prefix Series',
            document_type='invoices',
            prefix='UPD',
        )
        create = self.post_json('/api/settings/branches/', {
            'name': 'Ransom Kochi',
            'prefix': 'KOCHI',
            'location_type': 'business',
            'primary_contact_id': self.user.id,
            'transaction_series_ids': [numbering_series.id],
            'default_transaction_series_id': numbering_series.id,
            'active': True,
        })
        self.assertEqual(create.status_code, 201, create.content)
        created_branch_id = create.json()['location']['id']

        series = DocumentNumberSeries.objects.create(
            organization=self.org,
            name='Ransom Kochi Invoice Series',
            document_type='invoices',
            prefix='LOC/INV/%FY%',
            format_pattern='LOC/{BRANCH}/INV/{FY}/{SEQUENCE}',
            next_number=1,
            padding=5,
            active=True,
        )
        from .models import TransactionSeries
        group = TransactionSeries.objects.create(
            organization=self.org,
            name='Ransom Kochi Invoice Series',
            branch='Ransom Kochi',
            business_location_id=created_branch_id,
            is_default=False,
            is_active=True,
        )
        series.series_group = group
        series.business_location_id = created_branch_id
        series.branch = 'Ransom Kochi'
        series.save()

        preview = services.preview_document_number(
            'INV',
            org=self.org,
            series=group.name,
            series_id=group.id,
            date=date(2026, 10, 15),
            branch='Ransom Kochi',
            business_location_id=created_branch_id,
            allow_inactive=True,
        )
        self.assertEqual(preview['formatted'], 'LOC/KOCHI/INV/26-27/00001')
        self.assertEqual(preview['branch'], 'Ransom Kochi')

        duplicate = self.post_json('/api/settings/branches/', {
            'name': 'Another Kochi Branch',
            'prefix': 'KOCHI',
            'location_type': 'business',
            'primary_contact_id': self.user.id,
            'transaction_series_ids': [duplicate_series.id],
            'default_transaction_series_id': duplicate_series.id,
            'active': True,
        })
        self.assertEqual(duplicate.status_code, 409)

        update = self.client.put(
            f'/api/settings/branches/{created_branch_id}/',
            data=json.dumps({
                'name': 'Ransom Kochi',
                'prefix': 'COK',
                'location_type': 'business',
                'primary_contact_id': self.user.id,
                'transaction_series_ids': [update_series.id],
                'default_transaction_series_id': update_series.id,
                'active': True,
            }),
            content_type='application/json',
        )
        self.assertEqual(update.status_code, 200, update.content)
        updated_location = BusinessLocation.objects.get(pk=created_branch_id)
        self.assertEqual(updated_location.prefix, 'COK')

    def test_warehouse_only_location_requires_business_parent(self):
        missing_parent = self.post_json('/api/settings/branches/', {
            'name': 'Unparented Warehouse',
            'location_type': 'warehouse',
        })
        self.assertEqual(missing_parent.status_code, 400)

        warehouse = self.post_json('/api/settings/branches/', {
            'name': 'Parented Warehouse',
            'location_type': 'warehouse',
            'parent_id': self.location.id,
        })
        self.assertEqual(warehouse.status_code, 201, warehouse.content)
        self.assertEqual(warehouse.json()['location']['parent_id'], self.location.id)

    def test_business_location_requires_primary_contact_and_numbering_series(self):
        series = DocumentNumberSeries.objects.create(
            organization=self.org,
            name='Required Fields Series',
            document_type='invoices',
            prefix='REQ',
        )
        missing_contact = self.post_json('/api/settings/branches/', {
            'name': 'Missing Contact Branch',
            'transaction_series_ids': [series.id],
            'default_transaction_series_id': series.id,
        })
        self.assertEqual(missing_contact.status_code, 400)

        missing_series = self.post_json('/api/settings/branches/', {
            'name': 'Missing Series Branch',
            'primary_contact_id': self.user.id,
        })
        self.assertEqual(missing_series.status_code, 400)

    def test_location_type_cannot_change_after_transaction_history_exists(self):
        parent = BusinessLocation.objects.create(
            organization=self.org,
            name='Warehouse Parent',
            location_type=BusinessLocation.LOCATION_TYPE_BUSINESS,
            active=True,
        )
        self.post_json('/api/invoices/', {
            'customer': self.customer.id,
            'number': 'LOC-INV-HISTORY',
            'date': '2026-11-24',
            'due_date': '2026-11-24',
            'branch_id': self.location.id,
            'lines': [{
                'item': self.item.id,
                'description': 'Historical branch reference',
                'quantity': 1,
                'rate': '100.00',
                'gst_rate': 18,
            }],
        })

        conversion = self.client.put(
            f'/api/settings/branches/{self.location.id}/',
            data=json.dumps({
                'name': self.location.name,
                'location_type': 'warehouse',
                'parent_id': parent.id,
                'active': True,
            }),
            content_type='application/json',
        )
        self.assertEqual(conversion.status_code, 409, conversion.content)

    def test_invoice_uses_location_and_preserves_inactive_location_on_edit(self):
        created = self.post_json('/api/invoices/', {
            'customer': self.customer.id,
            'number': 'LOC-INV-001',
            'date': '2026-11-24',
            'due_date': '2026-11-24',
            'branch_id': self.location.id,
            'lines': [{
                'item': self.item.id,
                'description': 'Location test',
                'quantity': 1,
                'rate': '100.00',
                'gst_rate': 18,
            }],
        })
        self.assertEqual(created.status_code, 201, created.content)
        invoice = Invoice.objects.get(pk=created.json()['id'])
        self.assertEqual(invoice.business_location_id, self.location.id)
        self.assertEqual(invoice.location, self.location.name)

        detail = self.client.get(f'/api/invoices/{invoice.id}/')
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(detail.json()['business_location_id'], self.location.id)

        self.location.active = False
        self.location.save(update_fields=['active'])

        edited = self.client.put(
            f'/api/invoices/{invoice.id}/',
            data=json.dumps({
                'number': invoice.number,
                'customer': self.customer.id,
                'date': '2026-11-24',
                'due_date': '2026-11-24',
                'branch_id': self.location.id,
                'lines': [{
                    'item': self.item.id,
                    'description': 'Location test edited',
                    'quantity': 1,
                    'rate': '100.00',
                    'gst_rate': 18,
                }],
            }),
            content_type='application/json',
        )
        self.assertEqual(edited.status_code, 200, edited.content)
        invoice.refresh_from_db()
        self.assertEqual(invoice.business_location_id, self.location.id)

        new_transaction = self.post_json('/api/invoices/', {
            'customer': self.customer.id,
            'number': 'LOC-INV-002',
            'date': '2026-11-24',
            'due_date': '2026-11-24',
            'branch_id': self.location.id,
            'lines': [{
                'item': self.item.id,
                'description': 'Inactive location test',
                'quantity': 1,
                'rate': '100.00',
                'gst_rate': 18,
            }],
        })
        self.assertEqual(new_transaction.status_code, 400)

    def test_expense_and_bill_save_location_from_configured_record(self):
        expense_account = Account.objects.create(
            organization=self.org,
            name='Location Expense',
            account_type=Account.EXPENSE,
        )
        expense = self.post_json('/api/expenses/', {
            'date': '2026-11-24',
            'expense_account': expense_account.id,
            'vendor': self.vendor.id,
            'amount': '250.00',
            'branch_id': self.location.id,
        })
        self.assertEqual(expense.status_code, 201, expense.content)
        expense_id = expense.json()['id']
        expense_detail = self.client.get(f'/api/expenses/{expense_id}/')
        self.assertEqual(expense_detail.status_code, 200)
        self.assertEqual(expense_detail.json()['business_location_id'], self.location.id)

        bill = self.post_json('/api/bills/', {
            'number': 'LOC-BILL-001',
            'vendor': self.vendor.id,
            'date': '2026-11-24',
            'due_date': '2026-11-24',
            'branch_id': self.location.id,
            'lines': [{
                'item': self.item.id,
                'description': 'Location bill',
                'quantity': 1,
                'rate': '60.00',
                'gst_rate': 18,
            }],
        })
        self.assertEqual(bill.status_code, 201, bill.content)
        bill_detail = self.client.get(f'/api/bills/{bill.json()["id"]}/')
        self.assertEqual(bill_detail.status_code, 200)
        self.assertEqual(bill_detail.json()['business_location_id'], self.location.id)

    def test_cross_organization_location_is_rejected_and_lookup_isolated(self):
        other_user = User.objects.create_user(
            username='other-location-admin',
            password='Password123!',
        )
        other_org = Organization.objects.create(
            name='Other Location Org',
            code='OTH',
            owner=other_user,
        )
        UserProfile.objects.create(
            user=other_user,
            organization=other_org,
            role=UserProfile.ADMIN,
        )
        other_location = BusinessLocation.objects.create(
            organization=other_org,
            name='Other Branch',
            active=True,
        )

        invoice = self.post_json('/api/invoices/', {
            'customer': self.customer.id,
            'number': 'LOC-INV-XORG',
            'date': '2026-11-24',
            'due_date': '2026-11-24',
            'branch_id': other_location.id,
            'lines': [{
                'item': self.item.id,
                'description': 'Cross org',
                'quantity': 1,
                'rate': '100.00',
                'gst_rate': 18,
            }],
        })
        self.assertEqual(invoice.status_code, 400)

        other_client = Client()
        other_client.force_login(other_user)
        lookup = other_client.get('/api/lookup/branches/')
        self.assertEqual(lookup.status_code, 200)
        ids = {row['id'] for row in lookup.json()}
        self.assertIn(other_location.id, ids)
        self.assertNotIn(self.location.id, ids)

        detail = other_client.get(f'/api/settings/branches/{self.location.id}/')
        self.assertEqual(detail.status_code, 404)
        update = other_client.put(
            f'/api/settings/branches/{self.location.id}/',
            data=json.dumps({
                'name': 'Unauthorized Rename',
                'location_type': 'business',
                'primary_contact_id': other_user.id,
                'active': True,
            }),
            content_type='application/json',
        )
        self.assertEqual(update.status_code, 404)
        deletion = other_client.delete(f'/api/settings/branches/{self.location.id}/')
        self.assertEqual(deletion.status_code, 404)
        self.location.refresh_from_db()
        self.assertEqual(self.location.name, 'Kochi Branch')

    def test_branch_validation_and_repeat_create_are_safe(self):
        series = DocumentNumberSeries.objects.create(
            organization=self.org,
            name='Validation Series',
            document_type='invoices',
            prefix='VAL',
        )
        invalid_payload = {
            'name': '   ',
            'location_type': 'business',
            'primary_contact_id': self.user.id,
            'transaction_series_ids': [series.id],
            'default_transaction_series_id': series.id,
        }
        invalid = self.post_json('/api/settings/branches/', invalid_payload)
        self.assertEqual(invalid.status_code, 400)

        invalid_gstin = self.post_json('/api/settings/branches/', {
            'name': 'Invalid GSTIN Branch',
            'gstin': 'NOT-A-GSTIN',
            'location_type': 'business',
            'primary_contact_id': self.user.id,
            'transaction_series_ids': [series.id],
            'default_transaction_series_id': series.id,
        })
        self.assertEqual(invalid_gstin.status_code, 400)

        invalid_pin = self.post_json('/api/settings/branches/', {
            'name': 'Invalid PIN Branch',
            'pincode': 'AB12',
            'country': 'India',
            'location_type': 'business',
            'primary_contact_id': self.user.id,
            'transaction_series_ids': [series.id],
            'default_transaction_series_id': series.id,
        })
        self.assertEqual(invalid_pin.status_code, 400)

        payload = {
            'name': '  Repeat Safe Branch  ',
            'prefix': 'RS',
            'location_type': 'business',
            'city': 'Kottayam',
            'pincode': '686001',
            'country': 'India',
            'phone': '+91 9999999999',
            'primary_contact_id': self.user.id,
            'transaction_series_ids': [series.id],
            'default_transaction_series_id': series.id,
            'active': True,
        }
        first = self.post_json('/api/settings/branches/', payload)
        second = self.post_json('/api/settings/branches/', payload)
        self.assertEqual(first.status_code, 201, first.content)
        self.assertEqual(second.status_code, 409)
        self.assertEqual(
            BusinessLocation.objects.filter(
                organization=self.org,
                name__iexact='Repeat Safe Branch',
            ).count(),
            1,
        )

    def test_delete_unused_branch_and_protect_used_branch(self):
        unused = BusinessLocation.objects.create(
            organization=self.org,
            name='Unused Browser Branch',
            location_type=BusinessLocation.LOCATION_TYPE_BUSINESS,
            active=True,
        )
        deleted = self.client.delete(f'/api/settings/branches/{unused.id}/')
        self.assertEqual(deleted.status_code, 200, deleted.content)
        self.assertFalse(BusinessLocation.objects.filter(pk=unused.id).exists())

        used = self.post_json('/api/invoices/', {
            'customer': self.customer.id,
            'number': 'LOC-INV-DELETE-PROTECT',
            'date': '2026-11-24',
            'due_date': '2026-11-24',
            'branch_id': self.location.id,
            'lines': [{
                'item': self.item.id,
                'description': 'Protected branch reference',
                'quantity': 1,
                'rate': '100.00',
                'gst_rate': 18,
            }],
        })
        self.assertEqual(used.status_code, 201, used.content)
        protected = self.client.delete(f'/api/settings/branches/{self.location.id}/')
        self.assertEqual(protected.status_code, 409)
        self.assertTrue(BusinessLocation.objects.filter(pk=self.location.id).exists())

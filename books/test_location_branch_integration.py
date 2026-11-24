import json

from django.contrib.auth.models import User
from django.test import Client, TestCase

from .models import (
    Account,
    BusinessLocation,
    Customer,
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
        create = self.post_json('/api/settings/branches/', {
            'name': 'Trivandrum Branch',
            'location_type': 'business',
            'city': 'Thiruvananthapuram',
            'state': 'Kerala',
            'country': 'India',
            'active': True,
        })
        self.assertEqual(create.status_code, 201, create.content)
        created_id = create.json()['location']['id']

        duplicate = self.post_json('/api/settings/branches/', {
            'name': 'trivandrum branch',
            'location_type': 'business',
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

import json
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from books import services
from books.models import (
    Customer, DeliveryChallan, Invoice, Item, Organization,
    StockMovement, UserProfile, Warehouse,
)


User = get_user_model()


class DeliveryChallanWorkflowTests(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(name='Challan Org', state='Kerala')
        self.user = User.objects.create_user(username='challan_user', password='Password123!')
        UserProfile.objects.create(user=self.user, organization=self.org, role=UserProfile.ADMIN)
        self.client.force_login(self.user)
        self.customer = Customer.objects.create(
            organization=self.org, name='Challan Customer', state='Kerala',
            customer_type='business', gstin='32AANCC9298C1ZE',
        )
        self.source = Warehouse.objects.create(
            organization=self.org, name='Source Warehouse', code='WH-SRC', active=True,
        )
        self.destination = Warehouse.objects.create(
            organization=self.org, name='Destination Warehouse', code='WH-DST', active=True,
        )
        self.item = Item.objects.create(
            organization=self.org, name='Tracked Item', sku='CH-ITEM-01',
            item_type=Item.GOODS, track_inventory=True, warehouse=self.source,
            warehouse_code=self.source.code, stock=Decimal('10.000'),
            selling_price=Decimal('100.00'), gst_rate=Decimal('18.00'),
        )
        StockMovement.objects.create(
            organization=self.org, item=self.item, date=timezone.localdate(),
            warehouse=self.source, warehouse_code=self.source.code,
            kind='opening', reference='CH-OPEN', change=Decimal('10.000'),
            balance_after=Decimal('10.000'), created_by=self.user,
        )

    def create_challan(self, **overrides):
        payload = {
            'customer': self.customer.pk,
            'date': timezone.localdate().isoformat(),
            'challan_type': 'delivering_goods',
            'source_warehouse_id': self.source.pk,
            'notes': 'Handle carefully',
            'terms': 'Delivery terms',
            'adjustment': '0',
            'lines': [{
                'item': self.item.pk, 'quantity': '2', 'rate': '100',
                'discount': '10', 'discount_type': 'amount', 'gst_rate': '18',
            }],
        }
        payload.update(overrides)
        response = self.client.post('/api/delivery-challans/', json.dumps(payload), content_type='application/json')
        return response

    def test_create_draft_calculates_amount_and_checks_stock(self):
        response = self.create_challan()
        self.assertEqual(response.status_code, 201, response.content)
        challan = DeliveryChallan.objects.get(pk=response.json()['id'])
        line = challan.lines.get()
        self.assertEqual(challan.status, 'draft')
        self.assertEqual(challan.currency, 'INR')
        self.assertEqual(challan.customer_type, 'b2b')
        self.assertEqual(line.taxable, Decimal('190.00'))
        self.assertEqual(line.tax_amount, Decimal('34.20'))
        self.assertEqual(challan.total, Decimal('224.20'))

        rejected = self.create_challan(lines=[{
            'item': self.item.pk, 'quantity': '11', 'rate': '100', 'gst_rate': '18',
        }])
        self.assertEqual(rejected.status_code, 400)
        self.assertEqual(DeliveryChallan.objects.count(), 1)

    def test_partial_invoice_delivery_and_return_do_not_double_deduct_stock(self):
        response = self.create_challan()
        self.assertEqual(response.status_code, 201, response.content)
        challan_id = response.json()['id']
        challan = DeliveryChallan.objects.get(pk=challan_id)
        line = challan.lines.get()

        converted = self.client.post(
            f'/api/delivery-challans/{challan_id}/invoice-partially/',
            data=json.dumps({'lines': [{'id': line.pk, 'quantity': '1'}]}),
            content_type='application/json',
        )
        self.assertEqual(converted.status_code, 201, converted.content)
        invoice_id = converted.json()['invoice_id']
        invoice = Invoice.objects.get(pk=invoice_id, organization=self.org)
        self.assertEqual(invoice.lines.get().source_delivery_challan_line_id, line.pk)
        self.assertEqual(invoice.lines.get().discount_amount, Decimal('5.00'))

        premature_send = self.client.post(f'/api/invoices/{invoice_id}/send/', data='{}', content_type='application/json')
        self.assertEqual(premature_send.status_code, 409)

        delivered = self.client.post(
            f'/api/delivery-challans/{challan_id}/mark-as-delivered/',
            data=json.dumps({'lines': [{'id': line.pk, 'quantity': '1'}]}),
            content_type='application/json',
        )
        self.assertEqual(delivered.status_code, 200, delivered.content)
        self.assertEqual(services.get_item_warehouse_stock(self.item, self.source, org=self.org), Decimal('9.000'))

        sent = self.client.post(f'/api/invoices/{invoice_id}/send/', data='{}', content_type='application/json')
        self.assertEqual(sent.status_code, 200, sent.content)
        self.item.refresh_from_db()
        self.assertEqual(self.item.stock, Decimal('9.000'))

        delivered_remaining = self.client.post(
            f'/api/delivery-challans/{challan_id}/mark-as-delivered/',
            data=json.dumps({'lines': [{'id': line.pk, 'quantity': '1'}]}),
            content_type='application/json',
        )
        self.assertEqual(delivered_remaining.status_code, 200, delivered_remaining.content)
        self.assertEqual(services.get_item_warehouse_stock(self.item, self.source, org=self.org), Decimal('8.000'))

        returned = self.client.post(
            f'/api/delivery-challans/{challan_id}/record-partial-returns/',
            data=json.dumps({'lines': [{'id': line.pk, 'quantity': '1'}]}),
            content_type='application/json',
        )
        self.assertEqual(returned.status_code, 200, returned.content)
        self.item.refresh_from_db()
        line.refresh_from_db()
        self.assertEqual(self.item.stock, Decimal('9.000'))
        self.assertEqual(line.delivered_quantity, Decimal('2.000'))
        self.assertEqual(line.returned_quantity, Decimal('1.000'))
        self.assertEqual(line.invoice_lines.get().quantity, Decimal('1.000'))

        duplicate = self.client.post(
            f'/api/delivery-challans/{challan_id}/convert-to-invoice/',
            data='{}', content_type='application/json',
        )
        self.assertEqual(duplicate.status_code, 409)

    def test_relocation_records_and_reverses_warehouse_movements(self):
        response = self.create_challan(
            challan_type='relocating_goods',
            source_warehouse_id=self.source.pk,
            destination_warehouse_id=self.destination.pk,
            lines=[{'item': self.item.pk, 'quantity': '3', 'rate': '100', 'gst_rate': '0'}],
        )
        self.assertEqual(response.status_code, 201, response.content)
        challan_id = response.json()['id']

        delivered = self.client.post(f'/api/delivery-challans/{challan_id}/mark-as-delivered/', data='{}', content_type='application/json')
        self.assertEqual(delivered.status_code, 200, delivered.content)
        self.assertEqual(services.get_item_warehouse_stock(self.item, self.source, org=self.org), Decimal('7.000'))
        self.assertEqual(services.get_item_warehouse_stock(self.item, self.destination, org=self.org), Decimal('3.000'))

        returned = self.client.post(f'/api/delivery-challans/{challan_id}/mark-as-returned/', data='{}', content_type='application/json')
        self.assertEqual(returned.status_code, 200, returned.content)
        self.assertEqual(services.get_item_warehouse_stock(self.item, self.source, org=self.org), Decimal('10.000'))
        self.assertEqual(services.get_item_warehouse_stock(self.item, self.destination, org=self.org), Decimal('0.000'))

    def test_challan_is_not_visible_to_another_organization(self):
        response = self.create_challan()
        self.assertEqual(response.status_code, 201, response.content)
        other_org = Organization.objects.create(name='Other Challan Org')
        other_user = User.objects.create_user(username='other_challan_user', password='Password123!')
        UserProfile.objects.create(user=other_user, organization=other_org, role=UserProfile.ADMIN)
        self.client.force_login(other_user)
        detail = self.client.get(f"/api/delivery-challans/{response.json()['id']}/")
        self.assertEqual(detail.status_code, 404)

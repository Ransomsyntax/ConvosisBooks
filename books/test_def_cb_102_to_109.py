import json
import os
from decimal import Decimal
from datetime import date
from django.test import TestCase, Client
from django.contrib.auth import get_user_model
from django.utils import timezone
from books.models import (
    Organization, Customer, Item, Warehouse, DeliveryChallan, DeliveryChallanLine,
    ItemCategory, UserProfile
)
from books.api import DeliveryChallanResource, ApiError

User = get_user_model()


class DefCb102To109TestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='def_user', email='def_user@example.com', password='password123'
        )
        self.org = Organization.objects.create(
            name='Convosis Defect Org',
            owner=self.user,
            state='Kerala',
            base_currency='INR'
        )
        self.profile = UserProfile.objects.create(
            user=self.user,
            organization=self.org,
            role='admin',
            normalized_email='def_user@example.com'
        )

        self.user2 = User.objects.create_user(
            username='def_user2', email='def_user2@example.com', password='password123'
        )
        self.org2 = Organization.objects.create(
            name='Other Defect Org',
            owner=self.user2,
            state='Tamil Nadu',
            base_currency='INR'
        )
        self.profile2 = UserProfile.objects.create(
            user=self.user2,
            organization=self.org2,
            role='admin',
            normalized_email='def_user2@example.com'
        )

        self.warehouse = Warehouse.objects.create(
            organization=self.org,
            name='Main Kottayam WH',
            code='WH-MAIN',
            active=True
        )

        self.customer = Customer.objects.create(
            organization=self.org,
            name='Acme Retailers',
            company='Acme Corp Pvt Ltd',
            email='billing@acmeretailers.com',
            phone='+91 98765 43210',
            mobile='+91 98765 43210',
            gstin='32AAACA1234A1Z5',
            state='Kerala',
            active=True
        )

        self.item = Item.objects.create(
            organization=self.org,
            name='Wireless Barcode Scanner',
            sku='SCAN-001',
            item_type='goods',
            track_inventory=True,
            stock=Decimal('10.000'),
            selling_price=Decimal('2500.00'),
            gst_rate=Decimal('18.00'),
            warehouse=self.warehouse,
            active=True
        )

        self.client = Client()
        self.client.force_login(self.user)

    # 1. DEF_CB_102: Attach Files Input Alignment
    def test_def_cb_102_file_input_alignment_css(self):
        """DEF_CB_102: Check that glass.css defines centered flex layout and button styling for input[type=file].in."""
        css_path = os.path.join('books', 'static', 'books', 'css', 'glass.css')
        self.assertTrue(os.path.exists(css_path), "glass.css must exist")
        with open(css_path, 'r', encoding='utf-8') as f:
            css_content = f.read()

        self.assertIn('input[type="file"].in', css_content)
        self.assertIn('display: inline-flex', css_content)
        self.assertIn('align-items: center', css_content)
        self.assertIn('::file-selector-button', css_content)

        # Also verify frontend/css/glass.css matches
        fe_css_path = os.path.join('frontend', 'css', 'glass.css')
        if os.path.exists(fe_css_path):
            with open(fe_css_path, 'r', encoding='utf-8') as f:
                fe_css = f.read()
            self.assertIn('input[type="file"].in', fe_css)
            self.assertIn('display: inline-flex', fe_css)

    # 2. DEF_CB_103: Customer Search Field in Delivery Challan
    def test_def_cb_103_customer_lookup_phone_email(self):
        """DEF_CB_103: Verify lookup API returns phone and email for customer search matching."""
        response = self.client.get('/api/lookup/customers/')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        cust_entry = next((c for c in data if c['id'] == self.customer.id), None)
        self.assertIsNotNone(cust_entry, "Customer must be present in lookup results")
        self.assertEqual(cust_entry['email'], 'billing@acmeretailers.com')
        self.assertEqual(cust_entry['phone'], '+91 98765 43210')

        # Verify forms.js contains search logic for opt.dataset.phone and opt.dataset.email
        forms_js_path = os.path.join('books', 'static', 'books', 'js', 'forms.js')
        with open(forms_js_path, 'r', encoding='utf-8') as f:
            js = f.read()
        self.assertIn('data-phone', js)
        self.assertIn('data-email', js)
        self.assertIn('dataset?.phone', js)
        self.assertIn('dataset?.email', js)
        # Ensure #btn-dc-cust-lookup focuses and opens dropdown instead of calling partyForm directly
        self.assertIn('customerSelect._searchableOpen', js)

    # 3. DEF_CB_104: Save as Draft vs Save & Submit in Delivery Challan
    def test_def_cb_104_save_as_draft_and_save_and_submit(self):
        """DEF_CB_104: Test Save as Draft creates draft; Save & Submit creates open status with inventory check."""
        resource = DeliveryChallanResource()

        # 3a. Save as draft
        draft_payload = {
            'customer': self.customer.id,
            'date': date.today().isoformat(),
            'challan_type': 'delivering_goods',
            'action': 'draft',
            'status': 'draft',
            'lines': [{
                'item': self.item.id,
                'quantity': '2.000',
                'rate': '2500.00',
                'discount': 0,
                'discount_type': 'percentage',
                'gst_rate': 18
            }]
        }
        dc_draft = resource.create(draft_payload, self.user)
        self.assertEqual(dc_draft.status, 'draft', "Challan saved with action='draft' must have status 'draft'")

        # 3b. Save & Submit (status='open') with valid inventory
        submit_payload = {
            'customer': self.customer.id,
            'date': date.today().isoformat(),
            'challan_type': 'delivering_goods',
            'action': 'submit',
            'status': 'open',
            'lines': [{
                'item': self.item.id,
                'quantity': '3.000',
                'rate': '2500.00',
                'discount': 0,
                'discount_type': 'percentage',
                'gst_rate': 18
            }]
        }
        dc_open = resource.create(submit_payload, self.user)
        self.assertEqual(dc_open.status, 'open', "Challan saved with action='submit' must have status 'open'")

        # 3c. Save & Submit with insufficient inventory must raise ApiError 400
        excessive_payload = {
            'customer': self.customer.id,
            'date': date.today().isoformat(),
            'challan_type': 'delivering_goods',
            'action': 'submit',
            'status': 'open',
            'lines': [{
                'item': self.item.id,
                'quantity': '500.000',  # Only 10 available
                'rate': '2500.00',
                'discount': 0,
                'discount_type': 'percentage',
                'gst_rate': 18
            }]
        }
        with self.assertRaises(ApiError) as cm:
            resource.create(excessive_payload, self.user)
        self.assertEqual(cm.exception.status, 400)
        self.assertIn('Insufficient stock', cm.exception.message)

    # 4. DEF_CB_105: Item Dropdown Not Clipped & Single Line Ellipsis
    def test_def_cb_105_item_dropdown_clipping_prevention(self):
        """DEF_CB_105: Verify setupSearchableSelect uses fixed viewport positioning and ellipsis styling to avoid clipping."""
        forms_js_path = os.path.join('books', 'static', 'books', 'js', 'forms.js')
        with open(forms_js_path, 'r', encoding='utf-8') as f:
            js = f.read()

        # Fixed viewport position & high z-index
        self.assertIn("menu.style.position = 'fixed'", js)
        self.assertIn("menu.style.zIndex = '99999'", js)
        self.assertIn("getBoundingClientRect()", js)
        # Single line ellipsis
        self.assertIn("white-space:nowrap", js)
        self.assertIn("text-overflow:ellipsis", js)
        self.assertIn("dc-item-table-wrap", js)

    # 5. DEF_CB_106: Customer Signature in PDF & Print
    def test_def_cb_106_customer_signature_print_and_sheet(self):
        """DEF_CB_106: Verify Customer Signature label, image, and timestamp are rendered in challanPrint and docSheet."""
        sig_data_uri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
        dc = DeliveryChallan.objects.create(
            organization=self.org,
            number='DC-TEST-SIG-01',
            customer=self.customer,
            date=date.today(),
            challan_type='delivering_goods',
            status='open',
            signature_data=sig_data_uri,
            signed_by='John Doe (Receiver)',
            signed_at=timezone.now(),
            signature_title='Customer Signature',
            total=Decimal('2950.00')
        )

        # Verify API row & detail include signature fields
        resource = DeliveryChallanResource()
        row_data = resource.row(dc)
        self.assertEqual(row_data['signature_data'], sig_data_uri)
        self.assertEqual(row_data['signed_by'], 'John Doe (Receiver)')
        self.assertEqual(row_data['signature_title'], 'Customer Signature')
        self.assertIsNotNone(row_data['signed_at'])

        # Verify forms.js challanPrint renders customer signature block
        forms_js_path = os.path.join('books', 'static', 'books', 'js', 'forms.js')
        with open(forms_js_path, 'r', encoding='utf-8') as f:
            forms_js = f.read()
        self.assertIn('dc-signature-block', forms_js)
        self.assertIn('Customer Signature', forms_js)
        self.assertIn('data.signature_data', forms_js)

        # Verify pages.js renderDocSheet sets Customer Signature for delivery-challans
        pages_js_path = os.path.join('books', 'static', 'books', 'js', 'pages.js')
        with open(pages_js_path, 'r', encoding='utf-8') as f:
            pages_js = f.read()
        self.assertIn("kind === 'delivery-challans' ? 'Customer Signature'", pages_js)

    # 6. DEF_CB_107: Cancel Button Blank Screen Guard
    def test_def_cb_107_cancel_navigation_guard(self):
        """DEF_CB_107: Verify partyForm has onClose navigating back to customer listing and app.js renders list on /new."""
        forms_js_path = os.path.join('books', 'static', 'books', 'js', 'forms.js')
        with open(forms_js_path, 'r', encoding='utf-8') as f:
            forms_js = f.read()
        self.assertIn("targetHash = isCust ? '#/sales/customers' : '#/purchases/vendors'", forms_js)

        app_js_path = os.path.join('books', 'static', 'books', 'js', 'app.js')
        with open(app_js_path, 'r', encoding='utf-8') as f:
            app_js = f.read()
        self.assertIn("'sales/customers/new': r => { listPage(r, LISTS.customers); partyForm('customers'); }", app_js)

    # 7. DEF_CB_108: Double-Click Guard in Item Categories
    def test_def_cb_108_category_double_click_guard(self):
        """DEF_CB_108: Verify categoryModal has busy guard and active modal check to prevent multiple screens."""
        forms_js_path = os.path.join('books', 'static', 'books', 'js', 'forms.js')
        with open(forms_js_path, 'r', encoding='utf-8') as f:
            forms_js = f.read()
        self.assertIn("_categoryModalBusy", forms_js)
        self.assertIn("category-modal-active", forms_js)

        pages_js_path = os.path.join('books', 'static', 'books', 'js', 'pages.js')
        with open(pages_js_path, 'r', encoding='utf-8') as f:
            pages_js = f.read()
        self.assertIn("b.dataset.busy = '1'", pages_js)

    # 8. DEF_CB_109: Clear Selection on Cancel Delete
    def test_def_cb_109_clear_selection_on_cancel_delete(self):
        """DEF_CB_109: Verify clearSelection resets selectedIds, cb-row, and cb-all when delete is cancelled."""
        pages_js_path = os.path.join('books', 'static', 'books', 'js', 'pages.js')
        with open(pages_js_path, 'r', encoding='utf-8') as f:
            pages_js = f.read()

        self.assertIn("function clearSelection()", pages_js)
        self.assertIn("selectedIds.clear()", pages_js)
        self.assertIn("clearSelection();", pages_js)
        self.assertIn("masterSelectedIds.clear()", pages_js)

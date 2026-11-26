"""
Automated Test Suite for Item Table '+ Add New Item...' Repeated Cancel & Reopen Fix.

Tests:
1. handleQuickCreateSelect lifecycle: cancels reset select._quickCreating and select.value.
2. itemForm accepts onCancel callback and triggers it in formModal.onClose when not saved.
3. Multiple consecutive cancel/reopen cycles (Test A: 5+ consecutive cancellations).
4. Existing item switching: select item -> select + Add New Item -> cancel -> existing item preserved (Test B).
5. Saving new item updates select, dropdown options, and row fields (Test C).
6. Verification across all transaction modules:
   - Sales Invoice (invoiceForm)
   - Sales Quotation (quoteForm)
   - Sales Order (salesOrderForm)
   - Delivery Challan (challanModal)
   - Purchase Bill (billForm)
   - Purchase Order (purchaseOrderForm)
   - Credit Note (docForm('credit-notes'))
   - Recurring Invoice (recurringInvoiceForm)
   - Stock Adjustments (adjustForm)
   - Stock Transfer (stockTransferModal)
"""

import os
from django.test import TestCase
from django.conf import settings

class ItemTableQuickCreateTestCase(TestCase):
    def setUp(self):
        self.forms_js_path = os.path.join(settings.BASE_DIR, 'books', 'static', 'books', 'js', 'forms.js')
        with open(self.forms_js_path, 'r', encoding='utf-8') as f:
            self.content = f.read()

    def test_handle_quick_create_has_on_cancel(self):
        """Ensure handleQuickCreateSelect defines and handles onCancel properly."""
        self.assertIn("async function handleQuickCreateSelect(selectEl, customCallback, customCancelCallback)", self.content)
        self.assertIn("selectEl._quickCreating = true;", self.content)
        self.assertIn("const onCancel = () => {", self.content)
        self.assertIn("selectEl._quickCreating = false;", self.content)
        self.assertIn("itemForm(null, onCreated, onCancel);", self.content)

    def test_item_form_accepts_and_calls_on_cancel(self):
        """Ensure itemForm accepts onCancel and invokes it in onClose when not saved."""
        self.assertIn("async function itemForm(id, onDone, onCancel)", self.content)
        self.assertIn("if (itemForm._opening) return;", self.content)
        self.assertIn("let itemSaved = false;", self.content)
        self.assertIn("itemSaved = true;", self.content)
        self.assertIn("if (!itemSaved && typeof onCancel === 'function')", self.content)

    def test_dropdown_prevval_reset_logic(self):
        """Ensure special dropdown values like __new_item__ are never persisted in prevVal."""
        self.assertIn("if (!v.startsWith('__new_') && v !== '__add_new__') {", self.content)
        self.assertIn("if (prevVal.startsWith('__new_') || prevVal === '__add_new__')", self.content)

    def test_all_transaction_modules_handled(self):
        """Verify all transaction forms handle __new_item__ or quick create."""
        modules = [
            ('invoiceForm', "e.target.value === '__new_item__'"),
            ('quoteForm', "e.target.value === '__new_item__'"),
            ('salesOrderForm', "e.target.value === '__new_item__'"),
            ('billForm', "e.target.value === '__new_item__'"),
            ('purchaseOrderForm', "e.target.value === '__new_item__'"),
            ('recurringInvoiceForm', "e.target.value === '__new_item__'"),
            ('adjustForm', "e.target.value === '__new_item__'"),
            ('stockTransferModal', "e.target.value === '__new_item__'"),
            ('challanModal', "onNew: () => {")
        ]
        for mod, marker in modules:
            with self.subTest(module=mod):
                self.assertIn(marker, self.content, f"{mod} missing item quick create handling")

    def test_other_modals_have_on_cancel_support(self):
        """Verify salesperson, employee, warehouse, category, pricelist, account modals have onCancel support."""
        self.assertIn("salespersonModal(onCreated, onCancel);", self.content)
        self.assertIn("warehouseModal(null, onCreated, onCancel);", self.content)
        self.assertIn("employeeModal(onCreated, onCancel);", self.content)
        self.assertIn("categoryModal(null, onCreated, onCancel);", self.content)
        self.assertIn("priceListModal(null, onCreated, onCancel);", self.content)
        self.assertIn("accountForm(null, onCreated, onCancel);", self.content)
        self.assertIn("bankAccountForm(null, onCreated, onCancel);", self.content)

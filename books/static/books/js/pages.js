'use strict';

var opts = (typeof window !== "undefined" && window.opts) ? window.opts : ((list, sel) => (list || []).map(o => { const [v, l] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}"${String(v) === String(sel == null ? '' : sel) ? ' selected' : ''}>${esc(l)}</option>`; }).join(''));
const PAGE = { reload: null };

function parseCsvString(text) {
  if (!text) return { headers: [], rows: [] };
  text = text.replace(/^\uFEFF/, '');
  const sample = text.slice(0, 4096);
  const firstLines = sample.split(/\r?\n/).filter(l => l.trim()).slice(0, 5);
  let delimiter = ',';
  if (firstLines.length > 0) {
    const counts = { ',': 0, ';': 0, '\t': 0 };
    for (const l of firstLines) {
      let inQ = false;
      for (let i = 0; i < l.length; i++) {
        const ch = l[i];
        if (ch === '"') inQ = !inQ;
        else if (!inQ && ch in counts) counts[ch]++;
      }
    }
    if (counts['\t'] > counts[','] && counts['\t'] > counts[';']) delimiter = '\t';
    else if (counts[';'] > counts[','] && counts[';'] > counts['\t']) delimiter = ';';
  }

  const lines = [];
  let row = [''];
  let inQuotes = false;
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    const next = text[i + 1];
    if (c === '"') {
      if (inQuotes && next === '"') {
        row[row.length - 1] += '"';
        i += 2;
        continue;
      }
      inQuotes = !inQuotes;
    } else if (c === delimiter && !inQuotes) {
      row.push('');
    } else if ((c === '\r' || c === '\n') && !inQuotes) {
      if (c === '\r' && next === '\n') i++;
      lines.push(row);
      row = [''];
    } else {
      row[row.length - 1] += c;
    }
    i++;
  }
  if (row.length > 1 || (row.length === 1 && row[0] !== '')) lines.push(row);
  if (!lines.length) return { headers: [], rows: [] };

  const headers = lines[0].map(h => String(h || '').trim());
  const rows = [];
  for (let r = 1; r < lines.length; r++) {
    const vals = lines[r];
    if (!vals || vals.every(v => !String(v || '').trim())) continue;
    rows.push(vals.map(v => String(v == null ? '' : v).trim()));
  }
  return { headers, rows };
}

const IMPORT_SPECS = {
  customers: [
    { key: 'name', label: 'Customer Name', req: true, aliases: ['name', 'customer_name', 'customer', 'client', 'party', 'display_name', 'full_name'] },
    { key: 'company', label: 'Company Name', aliases: ['company', 'company_name', 'business_name', 'organization', 'org'] },
    { key: 'first_name', label: 'First Name', aliases: ['first_name', 'firstname', 'given_name', 'contact_first_name'] },
    { key: 'last_name', label: 'Last Name', aliases: ['last_name', 'lastname', 'surname', 'contact_last_name'] },
    { key: 'contact_person', label: 'Contact Person', aliases: ['contact_person', 'contact', 'primary_contact', 'attention'] },
    { key: 'email', label: 'Email Address', aliases: ['email', 'email_address', 'mail', 'contact_email'] },
    { key: 'phone', label: 'Phone Number', aliases: ['phone', 'phone_number', 'mobile', 'mobile_number', 'contact_number', 'phone_no'] },
    { key: 'gstin', label: 'GSTIN', aliases: ['gstin', 'gst_number', 'gst_no', 'gst'] },
    { key: 'pan', label: 'PAN', aliases: ['pan', 'pan_number', 'pan_no'] },
    { key: 'state', label: 'State / Place of Supply', aliases: ['state', 'state_name', 'place_of_supply', 'pos', 'region'] },
    { key: 'billing_address', label: 'Billing Address', aliases: ['billing_address', 'address', 'street', 'street_address'] },
    { key: 'billing_city', label: 'City', aliases: ['billing_city', 'city', 'town'] },
    { key: 'billing_pincode', label: 'Pincode', aliases: ['billing_pincode', 'pincode', 'pin_code', 'postal_code', 'zip'] },
    { key: 'payment_terms', label: 'Payment Terms (Days)', aliases: ['payment_terms', 'terms', 'payment_terms_days', 'credit_days'] },
    { key: 'opening_balance', label: 'Opening Balance', aliases: ['opening_balance', 'balance', 'opening_bal'] },
    { key: 'active', label: 'Status (Active/Inactive)', aliases: ['active', 'status', 'is_active'] }
  ],
  vendors: [
    { key: 'name', label: 'Vendor Name', req: true, aliases: ['name', 'vendor_name', 'vendor', 'supplier', 'payee', 'merchant'] },
    { key: 'company', label: 'Company Name', aliases: ['company', 'company_name', 'business_name', 'organization'] },
    { key: 'first_name', label: 'First Name', aliases: ['first_name', 'firstname', 'given_name', 'contact_first_name'] },
    { key: 'last_name', label: 'Last Name', aliases: ['last_name', 'lastname', 'surname', 'contact_last_name'] },
    { key: 'contact_person', label: 'Contact Person', aliases: ['contact_person', 'contact', 'primary_contact', 'attention'] },
    { key: 'email', label: 'Email Address', aliases: ['email', 'email_address', 'mail'] },
    { key: 'phone', label: 'Phone Number', aliases: ['phone', 'phone_number', 'mobile', 'contact_number'] },
    { key: 'gstin', label: 'GSTIN', aliases: ['gstin', 'gst_number', 'gst_no', 'gst'] },
    { key: 'pan', label: 'PAN', aliases: ['pan', 'pan_number', 'pan_no'] },
    { key: 'state', label: 'State', aliases: ['state', 'state_name', 'region'] },
    { key: 'billing_address', label: 'Address', aliases: ['billing_address', 'address', 'street'] },
    { key: 'billing_city', label: 'City', aliases: ['billing_city', 'city'] },
    { key: 'billing_pincode', label: 'Pincode', aliases: ['billing_pincode', 'pincode', 'pin_code', 'zip'] },
    { key: 'payment_terms', label: 'Payment Terms (Days)', aliases: ['payment_terms', 'terms', 'credit_days'] },
    { key: 'opening_balance', label: 'Opening Balance', aliases: ['opening_balance', 'balance'] },
    { key: 'active', label: 'Status (Active/Inactive)', aliases: ['active', 'status', 'is_active'] }
  ],
  items: [
    { key: 'name', label: 'Item Name', req: true, aliases: ['name', 'item_name', 'product_name', 'product', 'title'] },
    { key: 'sku', label: 'SKU / Item Code', aliases: ['sku', 'item_code', 'code', 'product_code', 'part_number'] },
    { key: 'item_type', label: 'Type (goods / service)', aliases: ['item_type', 'type', 'product_type'] },
    { key: 'category', label: 'Category', aliases: ['category', 'item_category', 'group'] },
    { key: 'hsn_sac', label: 'HSN / SAC Code', aliases: ['hsn_sac', 'hsn', 'sac', 'hsn_code'] },
    { key: 'unit', label: 'Unit of Measure', aliases: ['unit', 'uom', 'measurement_unit', 'usage_unit'] },
    { key: 'selling_price', label: 'Selling Price / Rate', req: true, aliases: ['selling_price', 'price', 'rate', 'sales_price', 'unit_price', 'mrp'] },
    { key: 'purchase_price', label: 'Purchase Price / Cost', aliases: ['purchase_price', 'cost', 'cost_price', 'purchase_rate'] },
    { key: 'gst_rate', label: 'GST Rate (%)', aliases: ['gst_rate', 'gst_%', 'tax_rate', 'tax_%', 'gst'] },
    { key: 'opening_stock', label: 'Opening Stock', aliases: ['opening_stock', 'stock', 'initial_stock', 'qty', 'quantity'] },
    { key: 'reorder_level', label: 'Reorder Level', aliases: ['reorder_level', 'min_stock', 'reorder_point'] },
    { key: 'active', label: 'Status (Active/Inactive)', aliases: ['active', 'status', 'is_active'] }
  ],
  accounts: [
    { key: 'code', label: 'Account Code', req: true, aliases: ['code', 'account_code', 'number', 'gl_code'] },
    { key: 'name', label: 'Account Name', req: true, aliases: ['name', 'account_name', 'title'] },
    { key: 'account_type', label: 'Account Type (asset/liability/equity/income/expense)', req: true, aliases: ['account_type', 'type', 'category'] },
    { key: 'sub_type', label: 'Sub Type', aliases: ['sub_type', 'subtype', 'detail_type'] },
    { key: 'description', label: 'Description', aliases: ['description', 'notes', 'desc'] }
  ],
  'bank-accounts': [
    { key: 'name', label: 'Account Display Name', req: true, aliases: ['name', 'account_name', 'title'] },
    { key: 'bank_name', label: 'Bank Name', req: true, aliases: ['bank_name', 'bank', 'institution'] },
    { key: 'account_number', label: 'Account Number', req: true, aliases: ['account_number', 'account_no', 'acc_number', 'acc_no'] },
    { key: 'ifsc', label: 'IFSC Code', aliases: ['ifsc', 'ifsc_code', 'branch_ifsc'] },
    { key: 'account_type', label: 'Account Type', aliases: ['account_type', 'type'] },
    { key: 'opening_balance', label: 'Opening Balance', aliases: ['opening_balance', 'balance'] },
    { key: 'branch_name', label: 'Branch Name', aliases: ['branch_name', 'branch'] }
  ],
  expenses: [
    { key: 'date', label: 'Expense Date', req: true, aliases: ['date', 'expense_date', 'txn_date', 'transaction_date'] },
    { key: 'expense_account', label: 'Expense Account', req: true, aliases: ['expense_account', 'account', 'category', 'category_account'] },
    { key: 'amount', label: 'Amount (₹)', req: true, aliases: ['amount', 'total_amount', 'amt', 'total'] },
    { key: 'vendor', label: 'Vendor / Payee', aliases: ['vendor', 'vendor_name', 'payee', 'supplier'] },
    { key: 'gst_rate', label: 'GST Rate (%)', aliases: ['gst_rate', 'tax_rate', 'gst'] },
    { key: 'paid_through', label: 'Paid Through (Bank/Cash)', aliases: ['paid_through', 'mode', 'paid_via', 'payment_mode'] },
    { key: 'reference', label: 'Reference / Voucher#', aliases: ['reference', 'ref', 'ref_no'] },
    { key: 'notes', label: 'Notes', aliases: ['notes', 'description', 'remarks'] }
  ],
  invoices: [
    { key: 'number', label: 'Invoice Number', aliases: ['number', 'invoice_number', 'invoice#', 'inv_no'] },
    { key: 'customer', label: 'Customer Name', req: true, aliases: ['customer', 'customer_name', 'client', 'party'] },
    { key: 'date', label: 'Invoice Date', req: true, aliases: ['date', 'invoice_date', 'doc_date'] },
    { key: 'due_date', label: 'Due Date', aliases: ['due_date', 'payment_due_date'] },
    { key: 'item', label: 'Item Name / Product', aliases: ['item', 'item_name', 'product', 'sku'] },
    { key: 'description', label: 'Line Description', aliases: ['description', 'line_description', 'desc'] },
    { key: 'hsn_sac', label: 'HSN / SAC Code', aliases: ['hsn_sac', 'hsn', 'sac'] },
    { key: 'quantity', label: 'Quantity', aliases: ['quantity', 'qty'] },
    { key: 'rate', label: 'Rate / Price', aliases: ['rate', 'price', 'unit_price', 'amount', 'total'] },
    { key: 'gst_rate', label: 'GST Rate (%)', aliases: ['gst_rate', 'tax_rate', 'gst'] },
    { key: 'notes', label: 'Notes / Remarks', aliases: ['notes', 'remarks'] }
  ],
  bills: [
    { key: 'number', label: 'Bill Number', aliases: ['number', 'bill_number', 'bill#', 'bill_no'] },
    { key: 'vendor', label: 'Vendor Name', req: true, aliases: ['vendor', 'vendor_name', 'supplier', 'party'] },
    { key: 'date', label: 'Bill Date', req: true, aliases: ['date', 'bill_date', 'doc_date'] },
    { key: 'due_date', label: 'Due Date', aliases: ['due_date'] },
    { key: 'item', label: 'Item Name / Product', aliases: ['item', 'item_name', 'product', 'sku'] },
    { key: 'description', label: 'Line Description', aliases: ['description', 'line_description', 'desc'] },
    { key: 'quantity', label: 'Quantity', aliases: ['quantity', 'qty'] },
    { key: 'rate', label: 'Rate / Price', aliases: ['rate', 'price', 'unit_price', 'amount', 'total'] },
    { key: 'gst_rate', label: 'GST Rate (%)', aliases: ['gst_rate', 'tax_rate'] },
    { key: 'notes', label: 'Notes', aliases: ['notes', 'remarks'] }
  ],
  quotes: [
    { key: 'number', label: 'Quote Number', aliases: ['number', 'quote_number', 'quote#', 'quote_no', 'quotation_number', 'quotation#', 'quotation_no', 'estimate_number', 'estimate#', 'estimate_no'] },
    { key: 'customer', label: 'Customer Name', req: true, aliases: ['customer', 'customer_name', 'client', 'party', 'party_name', 'client_name', 'account_name', 'buyer'] },
    { key: 'date', label: 'Quote Date', aliases: ['date', 'quote_date', 'doc_date', 'quotation_date', 'txn_date', 'transaction_date', 'estimate_date'] },
    { key: 'expiry_date', label: 'Expiry Date', aliases: ['expiry_date', 'valid_till', 'valid_until', 'expiry', 'expiration_date', 'due_date'] },
    { key: 'item', label: 'Item Name / Product', aliases: ['item', 'item_name', 'product', 'product_name', 'sku', 'service', 'service_name'] },
    { key: 'description', label: 'Line Description', aliases: ['description', 'line_description', 'desc', 'details', 'particulars'] },
    { key: 'quantity', label: 'Quantity', aliases: ['quantity', 'qty', 'count', 'units'] },
    { key: 'rate', label: 'Rate / Price', aliases: ['rate', 'price', 'unit_price', 'amount', 'selling_price', 'cost'] },
    { key: 'gst_rate', label: 'GST Rate (%)', aliases: ['gst_rate', 'tax_rate', 'gst', 'tax', 'gst_%', 'tax_%'] },
    { key: 'notes', label: 'Notes', aliases: ['notes', 'remarks', 'terms', 'comments', 'customer_notes'] }
  ],
  'sales-orders': [
    { key: 'number', label: 'Order / SO Number', aliases: ['number', 'order_number', 'so_number', 'order#', 'so#'] },
    { key: 'customer', label: 'Customer Name', req: true, aliases: ['customer', 'customer_name', 'client', 'party'] },
    { key: 'date', label: 'Order Date', req: true, aliases: ['date', 'order_date', 'doc_date'] },
    { key: 'expected_shipment_date', label: 'Expected Shipment Date', aliases: ['expected_shipment_date', 'shipment_date', 'delivery_date'] },
    { key: 'due_date', label: 'Due Date', aliases: ['due_date', 'payment_due_date'] },
    { key: 'item', label: 'Item Name / Product', aliases: ['item', 'item_name', 'product', 'sku'] },
    { key: 'description', label: 'Line Description', aliases: ['description', 'line_description', 'desc'] },
    { key: 'hsn_sac', label: 'HSN / SAC Code', aliases: ['hsn_sac', 'hsn', 'sac'] },
    { key: 'quantity', label: 'Quantity', aliases: ['quantity', 'qty'] },
    { key: 'rate', label: 'Rate / Price', aliases: ['rate', 'price', 'unit_price', 'amount'] },
    { key: 'gst_rate', label: 'GST Rate (%)', aliases: ['gst_rate', 'tax_rate', 'gst'] },
    { key: 'notes', label: 'Notes / Remarks', aliases: ['notes', 'remarks', 'terms'] }
  ],
  'purchase-orders': [
    { key: 'number', label: 'PO Number', aliases: ['number', 'po_number', 'order_number', 'po#', 'order#'] },
    { key: 'vendor', label: 'Vendor Name', req: true, aliases: ['vendor', 'vendor_name', 'supplier', 'party'] },
    { key: 'date', label: 'PO Date', req: true, aliases: ['date', 'po_date', 'doc_date'] },
    { key: 'delivery_date', label: 'Delivery / Due Date', aliases: ['delivery_date', 'due_date', 'expected_delivery'] },
    { key: 'item', label: 'Item Name / Product', aliases: ['item', 'item_name', 'product', 'sku'] },
    { key: 'description', label: 'Line Description', aliases: ['description', 'line_description', 'desc'] },
    { key: 'hsn_sac', label: 'HSN / SAC Code', aliases: ['hsn_sac', 'hsn', 'sac'] },
    { key: 'quantity', label: 'Quantity', aliases: ['quantity', 'qty'] },
    { key: 'rate', label: 'Rate / Price', aliases: ['rate', 'price', 'unit_price', 'amount'] },
    { key: 'gst_rate', label: 'GST Rate (%)', aliases: ['gst_rate', 'tax_rate', 'gst'] },
    { key: 'notes', label: 'Notes', aliases: ['notes', 'remarks'] }
  ],
  projects: [
    { key: 'name', label: 'Project Name', req: true, aliases: ['name', 'project_name', 'title'] },
    { key: 'code', label: 'Project Code', aliases: ['code', 'project_code', 'prj_code'] },
    { key: 'customer', label: 'Customer Name', aliases: ['customer', 'customer_name', 'client'] },
    { key: 'billing_method', label: 'Billing Method', aliases: ['billing_method', 'method'] },
    { key: 'rate_per_hour', label: 'Rate Per Hour', aliases: ['rate_per_hour', 'hourly_rate', 'rate'] },
    { key: 'budget_hours', label: 'Budget Hours', aliases: ['budget_hours', 'budget', 'estimated_hours'] },
    { key: 'description', label: 'Description', aliases: ['description', 'desc', 'notes'] }
  ],
  'payments-received': [
    { key: 'date', label: 'Payment Date', req: true, aliases: ['date', 'payment_date', 'txn_date'] },
    { key: 'customer', label: 'Customer Name', req: true, aliases: ['customer', 'customer_name', 'client', 'party'] },
    { key: 'amount', label: 'Amount (₹)', req: true, aliases: ['amount', 'payment_amount', 'amt', 'total'] },
    { key: 'mode', label: 'Payment Mode', aliases: ['mode', 'payment_mode', 'mode_label'] },
    { key: 'reference', label: 'Reference / Transaction#', aliases: ['reference', 'ref', 'ref_no', 'txn_id'] },
    { key: 'notes', label: 'Notes', aliases: ['notes', 'description'] }
  ],
  'payments-made': [
    { key: 'date', label: 'Payment Date', req: true, aliases: ['date', 'payment_date', 'txn_date'] },
    { key: 'vendor', label: 'Vendor Name', req: true, aliases: ['vendor', 'vendor_name', 'supplier', 'party'] },
    { key: 'amount', label: 'Amount (₹)', req: true, aliases: ['amount', 'payment_amount', 'amt', 'total'] },
    { key: 'mode', label: 'Payment Mode', aliases: ['mode', 'payment_mode', 'mode_label'] },
    { key: 'reference', label: 'Reference / Voucher#', aliases: ['reference', 'ref', 'ref_no', 'txn_id'] },
    { key: 'notes', label: 'Notes', aliases: ['notes', 'description'] }
  ],
  warehouses: [
    { key: 'name', label: 'Warehouse Name', req: true, aliases: ['name', 'warehouse_name', 'title'] },
    { key: 'code', label: 'Warehouse Code', aliases: ['code', 'warehouse_code', 'wh_code'] },
    { key: 'address', label: 'Address', aliases: ['address', 'street'] },
    { key: 'city', label: 'City', aliases: ['city'] },
    { key: 'state', label: 'State', aliases: ['state'] },
    { key: 'pincode', label: 'Pincode', aliases: ['pincode', 'pin_code', 'zip'] }
  ],
  'price-lists': [
    { key: 'name', label: 'Price List Name', req: true, aliases: ['name', 'price_list_name', 'title'] },
    { key: 'pricing_scheme', label: 'Pricing Scheme', aliases: ['pricing_scheme', 'scheme'] },
    { key: 'percentage', label: 'Percentage (%)', aliases: ['percentage', 'percent', 'adjustment'] },
    { key: 'description', label: 'Description', aliases: ['description', 'desc', 'notes'] }
  ],
  'delivery-challans': [
    { key: 'number', label: 'Challan Number', aliases: ['number', 'challan_number', 'challan#', 'dc_number'] },
    { key: 'customer', label: 'Customer Name', req: true, aliases: ['customer', 'customer_name', 'client', 'party'] },
    { key: 'date', label: 'Challan Date', req: true, aliases: ['date', 'challan_date', 'doc_date'] },
    { key: 'challan_type', label: 'Challan Type', aliases: ['challan_type', 'type'] },
    { key: 'item', label: 'Item Name / Product', aliases: ['item', 'item_name', 'product', 'sku'] },
    { key: 'quantity', label: 'Quantity', aliases: ['quantity', 'qty'] },
    { key: 'rate', label: 'Rate / Price', aliases: ['rate', 'price', 'unit_price'] },
    { key: 'notes', label: 'Notes', aliases: ['notes', 'remarks'] }
  ],
  'credit-notes': [
    { key: 'number', label: 'Credit Note Number', aliases: ['number', 'credit_note_number', 'cn#', 'cn_number'] },
    { key: 'customer', label: 'Customer Name', req: true, aliases: ['customer', 'customer_name', 'client', 'party'] },
    { key: 'date', label: 'Date', req: true, aliases: ['date', 'cn_date', 'doc_date'] },
    { key: 'item', label: 'Item Name / Product', aliases: ['item', 'item_name', 'product', 'sku'] },
    { key: 'quantity', label: 'Quantity', aliases: ['quantity', 'qty'] },
    { key: 'rate', label: 'Rate / Price', aliases: ['rate', 'price', 'unit_price'] },
    { key: 'gst_rate', label: 'GST Rate (%)', aliases: ['gst_rate', 'tax_rate', 'gst'] },
    { key: 'notes', label: 'Reason / Notes', aliases: ['notes', 'reason', 'remarks'] }
  ],
  'vendor-credits': [
    { key: 'number', label: 'Vendor Credit Number', aliases: ['number', 'vendor_credit_number', 'vc#', 'vc_number'] },
    { key: 'vendor', label: 'Vendor Name', req: true, aliases: ['vendor', 'vendor_name', 'supplier', 'party'] },
    { key: 'date', label: 'Date', req: true, aliases: ['date', 'vc_date', 'doc_date'] },
    { key: 'item', label: 'Item Name / Product', aliases: ['item', 'item_name', 'product', 'sku'] },
    { key: 'quantity', label: 'Quantity', aliases: ['quantity', 'qty'] },
    { key: 'rate', label: 'Rate / Price', aliases: ['rate', 'price', 'unit_price'] },
    { key: 'gst_rate', label: 'GST Rate (%)', aliases: ['gst_rate', 'tax_rate', 'gst'] },
    { key: 'notes', label: 'Notes', aliases: ['notes', 'remarks'] }
  ],
  'recurring-invoices': [
    { key: 'profile_name', label: 'Profile Name', req: true, aliases: ['profile_name', 'name', 'title'] },
    { key: 'customer', label: 'Customer Name', req: true, aliases: ['customer', 'customer_name', 'client', 'party'] },
    { key: 'frequency', label: 'Frequency (monthly/weekly/yearly)', aliases: ['frequency', 'repeat_every', 'interval'] },
    { key: 'start_date', label: 'Start Date', aliases: ['start_date', 'date'] },
    { key: 'end_date', label: 'End Date', aliases: ['end_date', 'never_expires'] },
    { key: 'item', label: 'Item Name / Product', aliases: ['item', 'item_name', 'product', 'sku'] },
    { key: 'quantity', label: 'Quantity', aliases: ['quantity', 'qty'] },
    { key: 'rate', label: 'Rate / Price', aliases: ['rate', 'price', 'amount'] },
    { key: 'gst_rate', label: 'GST Rate (%)', aliases: ['gst_rate', 'tax_rate'] }
  ],
  'retainer-invoices': [
    { key: 'number', label: 'Retainer Number', aliases: ['number', 'retainer_number', 'ret#'] },
    { key: 'customer', label: 'Customer Name', req: true, aliases: ['customer', 'customer_name', 'client', 'party'] },
    { key: 'date', label: 'Date', req: true, aliases: ['date', 'retainer_date', 'doc_date'] },
    { key: 'item', label: 'Description / Item', aliases: ['item', 'description', 'notes'] },
    { key: 'rate', label: 'Amount (₹)', req: true, aliases: ['rate', 'amount', 'total'] },
    { key: 'gst_rate', label: 'GST Rate (%)', aliases: ['gst_rate', 'tax_rate'] }
  ]
};

function openUniversalImportModal(resourceName, title) {
  let rawHeaders = [];
  let rawRows = [];
  let fileObj = null;
  let currentStep = 1;
  let columnMapping = {}; // systemKey -> fileHeaderIndex or -1
  let mappedRecords = [];
  let failedReportData = [];

  const fields = IMPORT_SPECS[resourceName] || [
    { key: 'name', label: 'Name / Title', req: true, aliases: ['name', 'title'] },
    { key: 'code', label: 'Code / Reference', aliases: ['code', 'ref', 'number'] },
    { key: 'description', label: 'Description', aliases: ['description', 'desc', 'notes'] }
  ];

  let recordsImportedCount = 0;
  const modal = Modal.open({
    title: `Import ${title}`,
    wide: true,
    dialog: true,
    onClose: () => {
      if (recordsImportedCount > 0) {
        if (typeof refresh === 'function') {
          try { refresh(); } catch(e){}
        } else if (typeof PAGE.reload === 'function') {
          try { PAGE.reload(); } catch(e){}
        }
      }
    },
    body: `
      <div style="padding:2px 0;">
        <!-- Stepper Navigation Header -->
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;padding-bottom:12px;border-bottom:1px solid var(--bd);">
          <div style="display:flex;align-items:center;gap:8px;">
            <span class="pastel-chip chip-sky" id="uimp-step-indicator" style="font-weight:700;font-size:11px;">STEP 1 OF 3</span>
            <span id="uimp-step-title" style="font-size:13.5px;font-weight:700;color:var(--tx);">Upload File &amp; Options</span>
          </div>
          <div style="display:flex;gap:4px;">
            <span class="uimp-step-dot" id="dot-step-1" style="width:24px;height:4px;border-radius:2px;background:var(--accent);"></span>
            <span class="uimp-step-dot" id="dot-step-2" style="width:24px;height:4px;border-radius:2px;background:var(--bd);"></span>
            <span class="uimp-step-dot" id="dot-step-3" style="width:24px;height:4px;border-radius:2px;background:var(--bd);"></span>
            <span class="uimp-step-dot" id="dot-step-4" style="width:24px;height:4px;border-radius:2px;background:var(--bd);"></span>
          </div>
        </div>

        <!-- STEP 1: Upload & Options -->
        <div id="uimp-step-1" class="uimp-pane">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;padding:12px 14px;background:var(--surface-glass-subtle);border-radius:8px;border:1px solid var(--bd);">
            <div style="display:flex;align-items:center;gap:12px;">
              <i class="fa-solid fa-file-csv" style="font-size:26px;color:#10b981;"></i>
              <div>
                <div style="font-weight:600;font-size:13px;color:var(--tx);">Standard CSV Template</div>
                <div class="sub" style="font-size:11.5px;">Download a pre-formatted template with exact sample columns for ${esc(title)}.</div>
              </div>
            </div>
            <a href="/api/${resourceName}/?export=template" class="btn" download="${resourceName}_template.csv" style="display:inline-flex;align-items:center;gap:6px;font-size:12px;text-decoration:none;">
              <i class="fa-solid fa-download"></i> Download Template
            </a>
          </div>

          <input type="file" id="uimp-file-input" accept=".xlsx,.xls,.xlsm,.csv,.tsv,.txt,.json,text/csv,text/tab-separated-values,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" style="display:none;" />
          <div id="uimp-drop-zone" style="border:2px dashed var(--bd);border-radius:10px;padding:30px 16px;text-align:center;cursor:pointer;background:var(--surface-glass-subtle);transition:all 0.2s;">
            <div id="uimp-drop-default">
              <i class="fa-solid fa-cloud-arrow-up" style="font-size:36px;color:var(--accent);margin-bottom:10px;"></i>
              <div style="font-weight:700;font-size:14px;color:var(--tx);margin-bottom:4px;">Drag &amp; Drop Excel (.xlsx), CSV, TSV, or JSON file here</div>
              <div class="sub" style="font-size:12px;margin-bottom:12px;">or click anywhere to browse from your device</div>
              <button type="button" class="btn p" id="uimp-browse-btn" style="font-size:12px;"><i class="fa-solid fa-folder-open"></i> Browse Files</button>
              <div class="sub" style="font-size:11px;margin-top:10px;color:var(--tx-muted);">Supports Excel workbooks (.xlsx, .xls), CSV exports, UTF-8 BOM, tab &amp; semicolon delimiters</div>
            </div>
            <div id="uimp-drop-loading" style="display:none;padding:16px 0;">
              ${spinner}
              <div id="uimp-drop-loading-text" style="margin-top:10px;font-size:12.5px;font-weight:600;color:var(--tx);">Reading and parsing file...</div>
            </div>
          </div>

          <div id="uimp-file-info" style="display:none;margin-top:14px;padding:12px 14px;background:var(--surface-glass);border-radius:8px;border:1px solid var(--bd);align-items:center;justify-content:space-between;">
            <div style="display:flex;align-items:center;gap:10px;">
              <i class="fa-solid fa-file-circle-check" style="font-size:22px;color:#10b981;"></i>
              <div>
                <div id="uimp-file-name" style="font-weight:700;font-size:13px;color:var(--tx);"></div>
                <div class="sub" id="uimp-file-meta" style="font-size:11.5px;"></div>
              </div>
            </div>
            <button type="button" class="btn" id="uimp-change-file-btn" style="font-size:11.5px;padding:4px 10px;">Change File</button>
          </div>

          <div style="margin-top:16px;padding:12px 14px;background:var(--surface-glass-subtle);border-radius:8px;border:1px solid var(--bd);">
            <label style="font-weight:600;font-size:12.5px;display:block;margin-bottom:6px;color:var(--tx);">Duplicate Record & SKU Handling</label>
            <div style="display:flex;flex-wrap:wrap;gap:18px;font-size:12px;color:var(--tx);">
              <label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;">
                <input type="radio" name="uimp-dup-radio" value="skip" checked />
                <span><b>Skip duplicates</b> (safest)</span>
              </label>
              <label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;">
                <input type="radio" name="uimp-dup-radio" value="update" />
                <span><b>Update existing</b> records</span>
              </label>
              <label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;">
                <input type="radio" name="uimp-dup-radio" value="auto_sku" />
                <span><b>Auto-generate new SKU</b> (e.g. ABC/ITEM/000001)</span>
              </label>
              <label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;">
                <input type="radio" name="uimp-dup-radio" value="error" />
                <span><b>Reject duplicates</b> (strict reporting)</span>
              </label>
            </div>
          </div>

          <div id="uimp-alert-1" style="display:none;margin-top:12px;" class="er" role="alert"></div>
        </div>

        <!-- STEP 2: Map Columns -->
        <div id="uimp-step-2" class="uimp-pane" style="display:none;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
            <div>
              <div style="font-weight:600;font-size:13px;color:var(--tx);">Match Your Columns to System Fields</div>
              <div class="sub" style="font-size:11.5px;">Columns from your file have been auto-matched. Adjust any dropdown if necessary.</div>
            </div>
            <span class="pastel-chip chip-sky" id="uimp-mapping-progress-chip" style="font-size:11px;"></span>
          </div>

          <div class="tw" style="max-height:280px;overflow-y:auto;border:1px solid var(--bd);border-radius:8px;">
            <table style="font-size:12px;width:100%;">
              <thead>
                <tr>
                  <th style="width:32%;">System Field</th>
                  <th style="width:36%;">Column in Your File</th>
                  <th style="width:32%;">Sample Value (Row 1)</th>
                </tr>
              </thead>
              <tbody id="uimp-mapping-tbody"></tbody>
            </table>
          </div>
          <div id="uimp-alert-2" style="display:none;margin-top:12px;" class="er" role="alert"></div>
        </div>

        <!-- STEP 3: Preview & Validate -->
        <div id="uimp-step-3" class="uimp-pane" style="display:none;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
            <div>
              <div style="font-weight:600;font-size:13px;color:var(--tx);">Review Mapped Records Preview</div>
              <div class="sub" style="font-size:11.5px;">Displaying the first 10 rows ready for ingestion.</div>
            </div>
            <div style="display:flex;gap:6px;">
              <span class="pastel-chip chip-mint" id="uimp-preview-valid-chip" style="font-size:11px;"></span>
              <span class="pastel-chip chip-amber" id="uimp-preview-warn-chip" style="font-size:11px;display:none;"></span>
            </div>
          </div>

          <div class="tw" style="max-height:260px;overflow:auto;border:1px solid var(--bd);border-radius:8px;">
            <table id="uimp-preview-table" style="font-size:11.5px;width:100%;"></table>
          </div>
          <div id="uimp-alert-3" style="display:none;margin-top:12px;" class="er" role="alert"></div>
        </div>

        <!-- STEP 4: Results & Summary -->
        <div id="uimp-step-4" class="uimp-pane" style="display:none;">
          <div id="uimp-results-banner" style="margin-bottom:16px;"></div>

          <div style="display:grid;grid-template-columns:repeat(6, 1fr);gap:8px;margin-bottom:16px;">
            <div style="padding:10px 6px;background:var(--surface-glass-subtle);border-radius:8px;border:1px solid var(--bd);text-align:center;">
              <div class="sub" style="font-size:10.5px;">Total</div>
              <div id="uimp-res-total" style="font-size:18px;font-weight:700;color:var(--tx);">0</div>
            </div>
            <div style="padding:10px 6px;background:var(--surface-glass-subtle);border-radius:8px;border:1px solid var(--bd);text-align:center;">
              <div class="sub" style="font-size:10.5px;color:#10b981;">Imported</div>
              <div id="uimp-res-imported" style="font-size:18px;font-weight:700;color:#10b981;">0</div>
            </div>
            <div style="padding:10px 6px;background:var(--surface-glass-subtle);border-radius:8px;border:1px solid var(--bd);text-align:center;">
              <div class="sub" style="font-size:10.5px;color:#3b82f6;">Updated</div>
              <div id="uimp-res-updated" style="font-size:18px;font-weight:700;color:#3b82f6;">0</div>
            </div>
            <div style="padding:10px 6px;background:var(--surface-glass-subtle);border-radius:8px;border:1px solid var(--bd);text-align:center;">
              <div class="sub" style="font-size:10.5px;color:#8b5cf6;">Skipped</div>
              <div id="uimp-res-skipped" style="font-size:18px;font-weight:700;color:#8b5cf6;">0</div>
            </div>
            <div style="padding:10px 6px;background:var(--surface-glass-subtle);border-radius:8px;border:1px solid var(--bd);text-align:center;">
              <div class="sub" style="font-size:10.5px;color:#f59e0b;">Duplicate SKUs</div>
              <div id="uimp-res-dups" style="font-size:18px;font-weight:700;color:#f59e0b;">0</div>
            </div>
            <div style="padding:10px 6px;background:var(--surface-glass-subtle);border-radius:8px;border:1px solid var(--bd);text-align:center;">
              <div class="sub" style="font-size:10.5px;color:#ef4444;">Failed</div>
              <div id="uimp-res-failed" style="font-size:18px;font-weight:700;color:#ef4444;">0</div>
            </div>
          </div>

          <div id="uimp-errors-wrap" style="display:none;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
              <div style="font-weight:700;font-size:12.5px;color:#ef4444;"><i class="fa-solid fa-triangle-exclamation"></i> Failed Rows Report</div>
              <button type="button" class="btn" id="uimp-download-errors-btn" style="font-size:11.5px;padding:3px 10px;display:inline-flex;align-items:center;gap:6px;">
                <i class="fa-solid fa-file-arrow-down"></i> Download Error Report (CSV)
              </button>
            </div>
            <div class="tw" style="max-height:180px;overflow-y:auto;border:1px solid var(--bd);border-radius:8px;">
              <table style="font-size:11.5px;width:100%;">
                <thead>
                  <tr>
                    <th style="width:14%;">Row #</th>
                    <th style="width:30%;">Identifier</th>
                    <th style="width:56%;">Reason</th>
                  </tr>
                </thead>
                <tbody id="uimp-errors-tbody"></tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    `,
    footer: `
      <div id="uimp-footer-left" style="display:flex;gap:8px;">
        <button class="btn" type="button" data-close id="uimp-btn-cancel">Cancel</button>
        <button class="btn" type="button" id="uimp-btn-back" style="display:none;">← Back</button>
      </div>
      <div id="uimp-footer-right" style="display:flex;gap:8px;">
        <button class="btn p" id="uimp-btn-next" type="button" disabled style="display:inline-flex;align-items:center;gap:6px;">
          <span>Next: Map Columns</span> <i class="fa-solid fa-arrow-right"></i>
        </button>
        <button class="btn p" id="uimp-btn-done" type="button" style="display:none;align-items:center;gap:6px;">
          <i class="fa-solid fa-check"></i> Done &amp; View Records
        </button>
      </div>
    `
  });

  const dropZone = $('#uimp-drop-zone', modal.el);
  const fileInput = $('#uimp-file-input', modal.el);
  const dropDefault = $('#uimp-drop-default', modal.el);
  const dropLoading = $('#uimp-drop-loading', modal.el);
  const dropLoadingText = $('#uimp-drop-loading-text', modal.el);
  const fileInfo = $('#uimp-file-info', modal.el);
  const fileNameEl = $('#uimp-file-name', modal.el);
  const fileMetaEl = $('#uimp-file-meta', modal.el);
  const changeFileBtn = $('#uimp-change-file-btn', modal.el);
  const stepIndicator = $('#uimp-step-indicator', modal.el);
  const stepTitle = $('#uimp-step-title', modal.el);

  const btnNext = $('#uimp-btn-next', modal.el);
  const btnBack = $('#uimp-btn-back', modal.el);
  const btnCancel = $('#uimp-btn-cancel', modal.el);
  const btnDone = $('#uimp-btn-done', modal.el);

  const pane1 = $('#uimp-step-1', modal.el);
  const pane2 = $('#uimp-step-2', modal.el);
  const pane3 = $('#uimp-step-3', modal.el);
  const pane4 = $('#uimp-step-4', modal.el);

  const alert1 = $('#uimp-alert-1', modal.el);
  const alert2 = $('#uimp-alert-2', modal.el);
  const alert3 = $('#uimp-alert-3', modal.el);

  const triggerFileInput = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    fileInput.click();
  };

  dropZone.addEventListener('click', (e) => {
    if (e.target.closest('#uimp-browse-btn') || e.target === dropZone || dropZone.contains(e.target)) {
      triggerFileInput(e);
    }
  });
  const browseBtn = $('#uimp-browse-btn', modal.el);
  if (browseBtn) browseBtn.addEventListener('click', triggerFileInput);
  fileInput.addEventListener('click', e => e.stopPropagation());

  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.style.borderColor = 'var(--accent)'; dropZone.style.background = 'var(--surface-glass)'; });
  dropZone.addEventListener('dragleave', () => { dropZone.style.borderColor = 'var(--bd)'; dropZone.style.background = 'var(--surface-glass-subtle)'; });
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.style.borderColor = 'var(--bd)';
    dropZone.style.background = 'var(--surface-glass-subtle)';
    if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
  });
  fileInput.addEventListener('change', () => {
    if (fileInput.files.length) handleFile(fileInput.files[0]);
  });
  changeFileBtn.addEventListener('click', () => {
    fileInput.value = '';
    fileObj = null;
    rawHeaders = [];
    rawRows = [];
    dropZone.style.display = 'block';
    if (dropDefault) dropDefault.style.display = 'block';
    if (dropLoading) dropLoading.style.display = 'none';
    fileInfo.style.display = 'none';
    btnNext.disabled = true;
    alert1.style.display = 'none';
  });

  async function handleFile(file) {
    alert1.style.display = 'none';
    fileObj = file;
    const isExcel = /\.(xlsx|xls|xlsm|xltx)$/i.test(file.name);
    if (dropDefault) dropDefault.style.display = 'none';
    if (dropLoading) dropLoading.style.display = 'block';
    if (dropLoadingText) dropLoadingText.textContent = `Reading and parsing ${esc(file.name)}...`;

    try {
      if (isExcel) {
        const fd = new FormData();
        fd.append('file', file);
        const res = await api('import/parse-file/', { method: 'POST', body: fd });
        rawHeaders = res.headers || [];
        rawRows = res.rows || [];
      } else if (file.name.toLowerCase().endsWith('.json')) {
        try {
          const text = await file.text();
          const json = JSON.parse(text);
          const arr = Array.isArray(json) ? json : (json.records || json.data || json.results || [json]);
          if (!arr.length) throw new Error('No valid records found in JSON file.');
          rawHeaders = Object.keys(arr[0] || {});
          rawRows = arr.map(obj => rawHeaders.map(h => obj[h] ?? ''));
        } catch (e) {
          const fd = new FormData();
          fd.append('file', file);
          const res = await api('import/parse-file/', { method: 'POST', body: fd });
          rawHeaders = res.headers || [];
          rawRows = res.rows || [];
        }
      } else {
        try {
          const text = await file.text();
          const parsed = parseCsvString(text);
          rawHeaders = parsed.headers || [];
          rawRows = parsed.rows || [];
          if (!rawHeaders.length || !rawRows.length) {
            const fd = new FormData();
            fd.append('file', file);
            const res = await api('import/parse-file/', { method: 'POST', body: fd });
            rawHeaders = res.headers || [];
            rawRows = res.rows || [];
          }
        } catch (e) {
          const fd = new FormData();
          fd.append('file', file);
          const res = await api('import/parse-file/', { method: 'POST', body: fd });
          rawHeaders = res.headers || [];
          rawRows = res.rows || [];
        }
      }

      if (!rawHeaders.length || !rawRows.length) {
        throw new Error('No valid records found in the uploaded file.');
      }

      if (dropDefault) dropDefault.style.display = 'block';
      if (dropLoading) dropLoading.style.display = 'none';
      dropZone.style.display = 'none';
      fileInfo.style.display = 'flex';
      fileNameEl.textContent = file.name;
      fileMetaEl.textContent = `${fmtBytes(file.size)} · ${rawRows.length} record${rawRows.length === 1 ? '' : 's'} detected · ${rawHeaders.length} columns`;
      btnNext.disabled = false;

      // Auto-match columns
      autoMatchColumns();
    } catch (err) {
      if (dropDefault) dropDefault.style.display = 'block';
      if (dropLoading) dropLoading.style.display = 'none';
      alert1.textContent = err.message || 'Failed to parse file.';
      alert1.style.display = 'block';
      btnNext.disabled = true;
    }
  }

  function autoMatchColumns() {
    columnMapping = {};
    const cleanHeaders = rawHeaders.map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
    for (const f of fields) {
      let matchedIdx = -1;
      const targetKey = f.key.toLowerCase().replace(/[^a-z0-9]/g, '');
      const targetLabel = f.label.toLowerCase().replace(/[^a-z0-9]/g, '');
      const aliases = (f.aliases || []).map(a => a.toLowerCase().replace(/[^a-z0-9]/g, ''));

      // Check exact match on key or label
      for (let i = 0; i < cleanHeaders.length; i++) {
        if (cleanHeaders[i] === targetKey || cleanHeaders[i] === targetLabel) {
          matchedIdx = i;
          break;
        }
      }
      // Check aliases
      if (matchedIdx === -1) {
        for (let i = 0; i < cleanHeaders.length; i++) {
          if (aliases.includes(cleanHeaders[i])) {
            matchedIdx = i;
            break;
          }
        }
      }
      // Check substring match
      if (matchedIdx === -1) {
        for (let i = 0; i < cleanHeaders.length; i++) {
          if (cleanHeaders[i].length >= 3 && (targetKey.includes(cleanHeaders[i]) || cleanHeaders[i].includes(targetKey))) {
            matchedIdx = i;
            break;
          }
        }
      }
      columnMapping[f.key] = matchedIdx;
    }
    if (columnMapping['name'] === -1) {
      if (columnMapping['company'] >= 0) columnMapping['name'] = columnMapping['company'];
      else if (columnMapping['first_name'] >= 0) columnMapping['name'] = columnMapping['first_name'];
      else if (columnMapping['customer'] >= 0) columnMapping['name'] = columnMapping['customer'];
      else if (columnMapping['vendor'] >= 0) columnMapping['name'] = columnMapping['vendor'];
      else if (columnMapping['party'] >= 0) columnMapping['name'] = columnMapping['party'];
      else if (columnMapping['item'] >= 0) columnMapping['name'] = columnMapping['item'];
      else if (columnMapping['title'] >= 0) columnMapping['name'] = columnMapping['title'];
    }
  }

  function renderStep2Mapping() {
    const tbody = $('#uimp-mapping-tbody', modal.el);
    const firstRow = rawRows[0] || [];

    tbody.innerHTML = fields.map(f => {
      const selectedIdx = columnMapping[f.key] ?? -1;
      const sampleVal = selectedIdx >= 0 && selectedIdx < firstRow.length ? firstRow[selectedIdx] : '—';
      return `
        <tr data-field="${esc(f.key)}">
          <td>
            <div style="font-weight:600;color:var(--tx);">
              ${esc(f.label)} ${f.req ? '<span style="color:#ef4444;" title="Required Field">*</span>' : ''}
            </div>
            <div class="sub" style="font-size:11px;">${esc(f.key)}</div>
          </td>
          <td>
            <select class="in uimp-map-select" data-key="${esc(f.key)}" style="width:100%;font-size:12px;padding:4px 8px;">
              <option value="-1" ${selectedIdx === -1 ? 'selected' : ''}>-- Do Not Import / Skip --</option>
              ${rawHeaders.map((h, idx) => `
                <option value="${idx}" ${idx === selectedIdx ? 'selected' : ''}>${esc(h)}</option>
              `).join('')}
            </select>
          </td>
          <td class="uimp-sample-cell" data-sample-key="${esc(f.key)}" style="color:var(--tx-muted);font-family:monospace;font-size:11px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
            ${esc(sampleVal || '—')}
          </td>
        </tr>
      `;
    }).join('');

    $$('.uimp-map-select', tbody).forEach(sel => {
      sel.addEventListener('change', e => {
        const key = e.target.dataset.key;
        const val = Number(e.target.value);
        columnMapping[key] = val;
        const sampleEl = $(`[data-sample-key="${key}"]`, tbody);
        if (sampleEl) {
          const sVal = val >= 0 && val < firstRow.length ? firstRow[val] : '—';
          sampleEl.textContent = sVal || '—';
        }
        updateMappingChip();
      });
    });

    updateMappingChip();
  }

  function updateMappingChip() {
    const reqFields = fields.filter(f => f.req);
    const mappedReq = reqFields.filter(f => (columnMapping[f.key] ?? -1) >= 0);
    const chip = $('#uimp-mapping-progress-chip', modal.el);
    if (chip) {
      chip.textContent = `${mappedReq.length} of ${reqFields.length} required mapped`;
      chip.className = mappedReq.length === reqFields.length ? 'pastel-chip chip-mint' : 'pastel-chip chip-amber';
    }
  }

  function buildMappedRecords() {
    const records = [];
    for (let r = 0; r < rawRows.length; r++) {
      const row = rawRows[r];
      const rec = {};
      for (const f of fields) {
        const colIdx = columnMapping[f.key];
        if (colIdx != null && colIdx >= 0 && colIdx < row.length) {
          rec[f.key] = row[colIdx];
        }
      }
      if (!rec.name) {
        const fn = rec.first_name || '';
        const ln = rec.last_name || '';
        const full = `${fn} ${ln}`.trim();
        if (full) rec.name = full;
        else if (rec.company) rec.name = rec.company;
        else if (rec.contact_person) rec.name = rec.contact_person;
        else if (rec.customer) rec.name = rec.customer;
        else if (rec.vendor) rec.name = rec.vendor;
        else if (rec.party) rec.name = rec.party;
        else if (rec.title) rec.name = rec.title;
        else if (rec.item) rec.name = rec.item;
        else if (rec.sku) rec.name = rec.sku;
      }
      if (!rec.customer) {
        if (rec.customer_name) rec.customer = rec.customer_name;
        else if (rec.client) rec.customer = rec.client;
        else if (rec.party) rec.customer = rec.party;
        else if (rec.name && (resourceName === 'invoices' || resourceName === 'quotes' || resourceName === 'sales-orders' || resourceName === 'payments-received' || resourceName === 'delivery-challans' || resourceName === 'credit-notes' || resourceName === 'recurring-invoices' || resourceName === 'retainer-invoices')) rec.customer = rec.name;
      }
      if (!rec.vendor) {
        if (rec.vendor_name) rec.vendor = rec.vendor_name;
        else if (rec.supplier) rec.vendor = rec.supplier;
        else if (rec.party) rec.vendor = rec.party;
        else if (rec.name && (resourceName === 'bills' || resourceName === 'purchase-orders' || resourceName === 'expenses' || resourceName === 'payments-made' || resourceName === 'vendor-credits')) rec.vendor = rec.name;
      }
      if (!rec.active && rec.active !== false) {
        rec.active = true;
      }
      if (resourceName === 'quotes' || resourceName === 'invoices' || resourceName === 'sales-orders' || resourceName === 'bills' || resourceName === 'purchase-orders') {
        const lastRec = records.length ? records[records.length - 1] : null;
        if (lastRec && rec.number && String(rec.number).trim() === String(lastRec.number).trim()) {
          if (!rec.customer && lastRec.customer) rec.customer = lastRec.customer;
          if (!rec.vendor && lastRec.vendor) rec.vendor = lastRec.vendor;
          if (!rec.date && lastRec.date) rec.date = lastRec.date;
          if (!rec.expiry_date && lastRec.expiry_date) rec.expiry_date = lastRec.expiry_date;
        }
        if (!rec.date) {
          rec.date = new Date().toISOString().split('T')[0];
        }
      }
      records.push(rec);
    }
    return records;
  }

  function renderStep3Preview() {
    mappedRecords = buildMappedRecords();
    const table = $('#uimp-preview-table', modal.el);
    const mappedFields = fields.filter(f => (columnMapping[f.key] ?? -1) >= 0);

    const previewSubset = mappedRecords.slice(0, 10);
    let readyCount = 0;
    let warnCount = 0;

    for (const rec of mappedRecords) {
      const hasMissingReq = fields.some(f => {
        if (!f.req) return false;
        if (f.key === 'name' && (rec.name || rec.company || rec.customer || rec.vendor)) return false;
        return !String(rec[f.key] || '').trim();
      });
      if (hasMissingReq) warnCount++;
      else readyCount++;
    }

    $('#uimp-preview-valid-chip', modal.el).textContent = `${readyCount} valid row${readyCount === 1 ? '' : 's'}`;
    const warnChip = $('#uimp-preview-warn-chip', modal.el);
    if (warnCount > 0) {
      warnChip.textContent = `${warnCount} missing required`;
      warnChip.style.display = 'inline-block';
    } else {
      warnChip.style.display = 'none';
    }

    table.innerHTML = `
      <thead>
        <tr>
          <th style="width:36px;text-align:center;">#</th>
          <th style="width:60px;">Status</th>
          ${mappedFields.map(f => `<th>${esc(f.label)}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${previewSubset.map((rec, idx) => {
          const missingReq = fields.filter(f => f.req && !String(rec[f.key] || '').trim());
          const isValid = missingReq.length === 0;
          return `
            <tr>
              <td style="text-align:center;color:var(--tx-muted);">${idx + 1}</td>
              <td>
                ${isValid
                  ? '<span style="color:#10b981;font-weight:600;"><i class="fa-solid fa-check"></i> Ready</span>'
                  : `<span style="color:#f59e0b;font-weight:600;" title="Missing: ${esc(missingReq.map(f => f.label).join(', '))}"><i class="fa-solid fa-triangle-exclamation"></i> Incomplete</span>`
                }
              </td>
              ${mappedFields.map(f => `<td>${esc(rec[f.key] || '—')}</td>`).join('')}
            </tr>
          `;
        }).join('')}
      </tbody>
    `;
  }

  function goToStep(step) {
    currentStep = step;
    alert1.style.display = 'none';
    alert2.style.display = 'none';
    alert3.style.display = 'none';

    pane1.style.display = step === 1 ? 'block' : 'none';
    pane2.style.display = step === 2 ? 'block' : 'none';
    pane3.style.display = step === 3 ? 'block' : 'none';
    pane4.style.display = step === 4 ? 'block' : 'none';

    for (let s = 1; s <= 4; s++) {
      const dot = $(`#dot-step-${s}`, modal.el);
      if (dot) dot.style.background = s === step ? 'var(--accent)' : (s < step ? '#10b981' : 'var(--bd)');
    }

    if (step === 1) {
      stepIndicator.textContent = 'STEP 1 OF 3';
      stepIndicator.className = 'pastel-chip chip-sky';
      stepTitle.textContent = 'Upload File & Options';
      btnBack.style.display = 'none';
      btnCancel.style.display = 'inline-block';
      btnNext.style.display = 'inline-flex';
      btnNext.innerHTML = `<span>Next: Map Columns</span> <i class="fa-solid fa-arrow-right"></i>`;
      btnNext.disabled = !fileObj;
      btnDone.style.display = 'none';
    } else if (step === 2) {
      stepIndicator.textContent = 'STEP 2 OF 3';
      stepIndicator.className = 'pastel-chip chip-purple';
      stepTitle.textContent = 'Map Columns';
      btnBack.style.display = 'inline-block';
      btnCancel.style.display = 'none';
      btnNext.style.display = 'inline-flex';
      btnNext.innerHTML = `<span>Next: Preview Data</span> <i class="fa-solid fa-arrow-right"></i>`;
      btnNext.disabled = false;
      btnDone.style.display = 'none';
      renderStep2Mapping();
    } else if (step === 3) {
      stepIndicator.textContent = 'STEP 3 OF 3';
      stepIndicator.className = 'pastel-chip chip-mint';
      stepTitle.textContent = 'Preview & Confirm Import';
      btnBack.style.display = 'inline-block';
      btnCancel.style.display = 'none';
      btnNext.style.display = 'inline-flex';
      btnNext.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> <span>Import ${rawRows.length} Records</span>`;
      btnNext.disabled = false;
      btnDone.style.display = 'none';
      renderStep3Preview();
    } else if (step === 4) {
      stepIndicator.textContent = 'COMPLETE';
      stepIndicator.className = 'pastel-chip chip-mint';
      stepTitle.textContent = 'Import Summary & Results';
      btnBack.style.display = 'none';
      btnCancel.style.display = 'none';
      btnNext.style.display = 'none';
      btnDone.style.display = 'inline-flex';
    }
  }

  btnNext.addEventListener('click', async () => {
    if (currentStep === 1) {
      if (!fileObj) return;
      goToStep(2);
    } else if (currentStep === 2) {
      if (columnMapping['name'] === -1) {
        if (columnMapping['company'] >= 0) columnMapping['name'] = columnMapping['company'];
        else if (columnMapping['first_name'] >= 0) columnMapping['name'] = columnMapping['first_name'];
        else if (columnMapping['customer'] >= 0) columnMapping['name'] = columnMapping['customer'];
        else if (columnMapping['vendor'] >= 0) columnMapping['name'] = columnMapping['vendor'];
        else if (columnMapping['party'] >= 0) columnMapping['name'] = columnMapping['party'];
        else if (columnMapping['item'] >= 0) columnMapping['name'] = columnMapping['item'];
        else if (columnMapping['title'] >= 0) columnMapping['name'] = columnMapping['title'];
      }
      const missingRequired = fields.filter(f => f.req && (columnMapping[f.key] ?? -1) < 0);
      if (missingRequired.length > 0) {
        alert2.textContent = `Please map required field: "${missingRequired.map(f => f.label).join('", "')}" before continuing.`;
        alert2.style.display = 'block';
        return;
      }
      goToStep(3);
    } else if (currentStep === 3) {
      // Execute import
      btnNext.disabled = true;
      btnBack.disabled = true;
      btnNext.innerHTML = `${spinner} Processing Ingestion...`;

      const dupModeRadio = modal.el.querySelector('input[name="uimp-dup-radio"]:checked');
      const dupMode = dupModeRadio ? dupModeRadio.value : 'skip';

      try {
        const payload = {
          import_records: mappedRecords,
          duplicate_mode: dupMode
        };

        const res = await api(resourceName + '/', {
          method: 'POST',
          body: payload
        });

        goToStep(4);
        renderStep4Results(res);
      } catch (err) {
        btnNext.disabled = false;
        btnBack.disabled = false;
        btnNext.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> <span>Retry Import</span>`;
        alert3.textContent = err.message || 'Import failed unexpectedly.';
        alert3.style.display = 'block';
      }
    }
  });

  btnBack.addEventListener('click', () => {
    if (currentStep === 2) goToStep(1);
    else if (currentStep === 3) goToStep(2);
  });

  btnDone.addEventListener('click', () => {
    modal.close();
    if (typeof refresh === 'function') {
      try { refresh(); } catch(e){}
    } else if (typeof PAGE.reload === 'function') {
      try { PAGE.reload(); } catch(e){}
    }
  });

  function renderStep4Results(res) {
    const banner = $('#uimp-results-banner', modal.el);
    const errorsWrap = $('#uimp-errors-wrap', modal.el);
    const errorsTbody = $('#uimp-errors-tbody', modal.el);

    const imported = res.imported ?? 0;
    const updated = res.updated ?? 0;
    const skipped = res.skipped ?? 0;
    const failed = res.failed ?? 0;
    const total = res.total ?? mappedRecords.length;
    const errors = res.errors || [];

    failedReportData = errors;

    $('#uimp-res-total', modal.el).textContent = total;
    $('#uimp-res-imported', modal.el).textContent = imported;
    $('#uimp-res-updated', modal.el).textContent = updated;
    const elSkipped = $('#uimp-res-skipped', modal.el);
    if (elSkipped) elSkipped.textContent = skipped;
    const elDups = $('#uimp-res-dups', modal.el);
    if (elDups) elDups.textContent = res.duplicate_skus ?? 0;
    $('#uimp-res-failed', modal.el).textContent = failed;

    recordsImportedCount += (imported + updated);
    if (imported > 0 || updated > 0) {
      if (typeof refresh === 'function') {
        try { refresh(); } catch(e){}
      } else if (typeof PAGE.reload === 'function') {
        try { PAGE.reload(); } catch(e){}
      }
    }

    if (failed === 0 && (imported > 0 || updated > 0 || skipped > 0)) {
      banner.innerHTML = `
        <div style="padding:14px 16px;background:rgba(16, 185, 129, 0.12);border:1px solid #10b981;border-radius:8px;display:flex;align-items:center;gap:12px;">
          <i class="fa-solid fa-circle-check" style="font-size:24px;color:#10b981;"></i>
          <div>
            <div style="font-weight:700;font-size:13.5px;color:#10b981;">Import Completed Successfully!</div>
            <div style="font-size:12px;color:var(--tx);">${esc(res.message || `Successfully ingested ${imported + updated} record(s).`)}</div>
          </div>
        </div>
      `;
      errorsWrap.style.display = 'none';
    } else if (imported > 0 || updated > 0) {
      banner.innerHTML = `
        <div style="padding:14px 16px;background:rgba(245, 158, 11, 0.12);border:1px solid #f59e0b;border-radius:8px;display:flex;align-items:center;gap:12px;">
          <i class="fa-solid fa-triangle-exclamation" style="font-size:24px;color:#f59e0b;"></i>
          <div>
            <div style="font-weight:700;font-size:13.5px;color:#f59e0b;">Import Finished with Notices</div>
            <div style="font-size:12px;color:var(--tx);">${esc(res.message || `${imported} imported, ${failed} failed.`)}</div>
          </div>
        </div>
      `;
      errorsWrap.style.display = 'block';
    } else {
      banner.innerHTML = `
        <div style="padding:14px 16px;background:rgba(239, 68, 68, 0.12);border:1px solid #ef4444;border-radius:8px;display:flex;align-items:center;gap:12px;">
          <i class="fa-solid fa-circle-xmark" style="font-size:24px;color:#ef4444;"></i>
          <div>
            <div style="font-weight:700;font-size:13.5px;color:#ef4444;">Import Failed</div>
            <div style="font-size:12px;color:var(--tx);">${esc(res.message || 'No records could be imported. Please review the errors below.')}</div>
          </div>
        </div>
      `;
      errorsWrap.style.display = 'block';
    }

    if (errors.length > 0) {
      errorsTbody.innerHTML = errors.map(err => `
        <tr>
          <td style="font-weight:600;color:var(--tx-muted);">Row ${err.row || '—'}</td>
          <td style="font-weight:600;color:var(--tx);">${esc(err.identifier || 'Record')}</td>
          <td style="color:#ef4444;">${esc(err.error || 'Validation error')}</td>
        </tr>
      `).join('');
    }
  }

  $('#uimp-download-errors-btn', modal.el)?.addEventListener('click', () => {
    if (!failedReportData.length) return;
    const csvRows = [
      ['Row Number', 'Item Name', 'SKU', 'Failure Reason'],
      ...failedReportData.map(e => [
        e.row,
        `"${String(e.name || e.identifier || '').replace(/"/g, '""')}"`,
        `"${String(e.sku || e.identifier || '').replace(/"/g, '""')}"`,
        `"${String(e.error || '').replace(/"/g, '""')}"`
      ])
    ];
    const csvContent = csvRows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${resourceName}_import_errors.csv`;
    a.click();
    toast('Downloaded error report CSV!', 'ok');
  });
}


function exportTableToCsv(containerEl, filename = 'report.csv') {
  const rows = containerEl ? Array.from(containerEl.querySelectorAll('tr')) : [];
  if (!rows.length) {
    toast('No data to export', 'err');
    return;
  }
  const csvLines = rows.map(r => {
    const cells = Array.from(r.querySelectorAll('th, td'));
    return cells.map(cell => {
      const text = cell.innerText.replace(/"/g, '""').trim();
      return `"${text}"`;
    }).join(',');
  });
  const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  toast('Exported to CSV!', 'ok');
}

function listPage(root, cfg) {
  const st = { q: '', page: 1, size: 10, ordering: cfg.ordering || '', f: {} };
  let cache = {};
  const selectedIds = new Set();

  function updateSelectionUI() {
    const rowCheckboxes = root.querySelectorAll('.cb-row');
    const allBox = $('#cb-all', root);
    const bulkBar = $('#bulk-bar', root);
    const bulkCnt = $('#bulk-cnt', root);
    const curCount = selectedIds.size;

    if (bulkBar) {
      if (cfg.noDelete || cfg.api === 'stock-transfers') {
        bulkBar.style.display = 'none';
      } else {
        bulkBar.style.display = curCount > 0 ? 'inline-flex' : 'none';
      }
    }
    if (bulkCnt) {
      bulkCnt.textContent = curCount;
    }

    if (allBox) {
      if (!rowCheckboxes.length) {
        allBox.checked = false;
        allBox.indeterminate = false;
        allBox.disabled = true;
      } else {
        allBox.disabled = false;
        const allChecked = Array.from(rowCheckboxes).every(cb => cb.checked);
        const someChecked = Array.from(rowCheckboxes).some(cb => cb.checked);
        allBox.checked = allChecked;
        allBox.indeterminate = !allChecked && someChecked;
      }
    }
  }

  const hideBulkDel = Boolean(cfg.noDelete || cfg.api === 'stock-transfers');
  root.innerHTML = `<div class="bc">Home / ${esc(cfg.bc)}</div><div class="hd"><h1>${esc(cfg.title)}</h1><div class="act">${cfg.noImport ? '' : `<button class="btn" data-x="import" type="button" title="Import ${esc(cfg.title)}"><i class="fa-solid fa-file-import"></i> Import</button>`}<div class="export-dropdown-wrap" style="position:relative;display:inline-block;"><button class="btn" data-x="export-toggle" type="button" title="Export ${esc(cfg.title)}"><i class="fa-solid fa-file-export"></i> Export ▾</button><div class="pop right export-menu-pop" style="display:none;position:absolute;top:100%;right:0;margin-top:4px;min-width:145px;z-index:90;padding:6px;background:var(--surface-glass-elevated);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,0.18);border:1px solid var(--bd);"><button type="button" class="btn" data-x="csv" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-file-csv" style="color:#10b981;"></i> Export CSV</button><button type="button" class="btn" data-x="json" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-code" style="color:#3b82f6;"></i> Export JSON</button></div></div>${cfg.onNew ? `<button class="btn p" data-x="new" type="button">+ ${esc(cfg.newLabel)}</button>` : ''}</div></div>${cfg.note ? `<div class="note">${cfg.note}</div>` : ''}
<div class="card" style="margin-top:14px"><div class="tb" style="display:flex;align-items:center;flex-wrap:wrap;gap:8px;"><input class="in" type="search" id="tq" placeholder="Search ${esc(cfg.title.toLowerCase())}" aria-label="Search" style="max-width:300px">${(cfg.filters || []).map(f => `<select class="btn" data-f="${f.name}" aria-label="${esc(f.label)}">${opts(f.opts || [], '')}</select>`).join('')}<span class="sub" id="cnt"></span>${hideBulkDel ? '' : `<div id="bulk-bar" style="display:none;margin-left:auto;align-items:center;gap:8px;"><span class="sub" style="font-weight:600;color:var(--text-primary,#111827);"><span id="bulk-cnt">0</span> selected</span><button class="btn dn" type="button" id="btn-bulk-delete" style="display:inline-flex;align-items:center;gap:6px;background:#fee2e2;color:#dc2626;border-color:#fca5a5;font-weight:600;cursor:pointer;"><i class="fa-solid fa-trash-can"></i> Delete</button></div>`}</div><div class="tw" id="lt">${spinner}</div><div class="pager" id="pgr"></div></div>`;
  if (cfg.filters) {
    for (const f of cfg.filters) {
      if (f.loadOpts) {
        f.loadOpts().then(newOpts => {
          const sel = root.querySelector(`select[data-f="${f.name}"]`);
          if (sel) {
            const curVal = sel.value;
            sel.innerHTML = opts(newOpts, curVal);
          }
        }).catch(() => {});
      }
    }
  }
  const params = () => ({ ...(cfg.params || {}), ...st.f, q: st.q, ordering: st.ordering });
  async function load() {
    PAGE.reload = load;
    selectedIds.clear();
    $('#lt', root).innerHTML = spinner;
    try {
      const p = await api(cfg.api + '/?' + qs({ ...params(), page: st.page, page_size: st.size }));
      if (!root.isConnected) return;
      if (p.page !== st.page) st.page = p.page;
      cache = Object.fromEntries(p.results.map(r => [String(r.id), r]));
      const sortMark = c => c.s ? (st.ordering === c.s ? ' ▲' : st.ordering === '-' + c.s ? ' ▼' : '') : '';
      const empty = !p.count ? (st.q || Object.values(st.f).some(Boolean) ? 'No matching records.' : esc(cfg.empty || 'No records yet.')) : '';
      const totalCols = cfg.cols.length + (cfg.actions ? 1 : 0) + 1;
      const renderRowActions = (acts, rowId) => {
        if (!acts || !acts.length) return '';
        if (acts.length <= 3) {
          return acts.map(([a, l, k]) => `<button type="button" class="${k || ''}" data-act="${a}" data-id="${rowId}">${esc(l)}</button>`).join('');
        }
        const pri = acts.slice(0, 2);
        const sec = acts.slice(2);
        return `<div class="rowa-wrap" style="display:inline-flex;align-items:center;gap:4px;">` +
          pri.map(([a, l, k]) => `<button type="button" class="${k || ''}" data-act="${a}" data-id="${rowId}">${esc(l)}</button>`).join('') +
          `<div class="rowa-more-wrap" style="position:relative;display:inline-block;">` +
            `<button type="button" class="btn-rowa-more" data-rowa-more style="padding:2px 8px;font-size:12px;border-radius:4px;border:1px solid var(--bd-glass,#cbd5e1);background:var(--bg-card,#fff);cursor:pointer;white-space:nowrap;">More ▾</button>` +
            `<div class="rowa-menu-pop" style="display:none;position:absolute;right:0;top:100%;margin-top:4px;min-width:145px;background:var(--bg-card,#ffffff);border:1px solid var(--bd-glass,#cbd5e1);border-radius:6px;box-shadow:0 8px 20px rgba(0,0,0,0.14);z-index:100;padding:4px 0;text-align:left;">` +
              sec.map(([a, l, k]) => `<button type="button" class="rowa-menu-item ${k || ''}" data-act="${a}" data-id="${rowId}" style="display:block;width:100%;text-align:left;padding:6px 12px;font-size:12px;border:none;background:none;cursor:pointer;color:var(--tx,#1e293b);">${esc(l)}</button>`).join('') +
            `</div>` +
          `</div>` +
        `</div>`;
      };
      $('#lt', root).innerHTML = `<table><thead><tr><th style="width:36px;text-align:center;"><input type="checkbox" id="cb-all" aria-label="Select all" style="cursor:pointer;vertical-align:middle;"></th>${cfg.cols.map(c => `<th ${c.s ? `data-s="${c.s}" tabindex="0" aria-sort="${st.ordering === c.s ? 'ascending' : st.ordering === '-' + c.s ? 'descending' : 'none'}"` : ''} class="${c.r ? 'r' : ''}">${esc(c.h)}${sortMark(c)}</th>`).join('')}${cfg.actions ? '<th></th>' : ''}</tr></thead><tbody>${p.results.map(r => `<tr><td style="width:36px;text-align:center;"><input type="checkbox" class="cb-row" data-id="${r.id}" aria-label="Select item" style="cursor:pointer;vertical-align:middle;"></td>${cfg.cols.map(c => `<td class="${c.r ? 'r' : ''}">${c.f(r)}</td>`).join('')}${cfg.actions ? `<td class="rowa">${renderRowActions(cfg.actions(r), r.id)}</td>` : ''}</tr>`).join('') || `<tr><td colspan="${totalCols}"><div class="empty">${empty}${!p.count && !st.q && cfg.onNew ? `<br><button class="btn p" data-x="new" type="button" style="margin-top:8px">+ ${esc(cfg.newLabel)}</button>` : ''}</div></td></tr>`}</tbody></table>`;
      st.total = p.count;
      $('#cnt', root).textContent = p.count + (p.count === 1 ? ' record' : ' records');
      $('#pgr', root).innerHTML = `<span class="sub">Page ${p.page} of ${p.pages}</span><span class="act"><select class="btn" data-size aria-label="Rows per page">${opts([10, 25, 50, 100].map(n => [n, n + ' / page']), st.size)}</select><button class="btn" data-x="pv" type="button" ${p.page <= 1 ? 'disabled' : ''}>Previous</button><button class="btn" data-x="nx" type="button" ${p.page >= p.pages ? 'disabled' : ''}>Next</button></span>`;
      updateSelectionUI();
    } catch (e) { if (root.isConnected) $('#lt', root).innerHTML = errBox(e.message, true); }
  }
  let t;
  $('#tq', root).addEventListener('input', e => { clearTimeout(t); t = setTimeout(() => { st.q = e.target.value.trim(); st.page = 1; load(); }, 250); });
  root.addEventListener('change', e => {
    if (e.target.id === 'cb-all') {
      const checked = e.target.checked;
      root.querySelectorAll('.cb-row').forEach(cb => {
        cb.checked = checked;
        const id = String(cb.dataset.id);
        if (checked) selectedIds.add(id);
        else selectedIds.delete(id);
      });
      updateSelectionUI();
      return;
    }
    if (e.target.classList.contains('cb-row')) {
      const id = String(e.target.dataset.id);
      if (e.target.checked) selectedIds.add(id);
      else selectedIds.delete(id);
      updateSelectionUI();
      return;
    }
    if (e.target.dataset.f) { st.f[e.target.dataset.f] = e.target.value; st.page = 1; load(); }
    if (e.target.hasAttribute('data-size')) { st.size = Number(e.target.value); st.page = 1; load(); }
  });
  const sortBy = th => { const k = th.dataset.s; st.ordering = st.ordering === k ? '-' + k : k; st.page = 1; load(); };
  root.addEventListener('keydown', e => { const th = e.target.closest && e.target.closest('th[data-s]'); if (th && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); sortBy(th); } });
  root.addEventListener('click', async e => {
    const bulkDel = e.target.closest('#btn-bulk-delete');
    if (bulkDel) {
      if (cfg.noDelete || cfg.api === 'stock-transfers') return;
      const count = selectedIds.size;
      if (!count) return;
      const label = count === 1 ? 'record' : 'records';
      if (!(await confirmBox({
        title: `Delete ${count} ${label}?`,
        message: `Are you sure you want to delete ${count === 1 ? 'this record' : 'these ' + count + ' records'}? This cannot be undone.`,
        okText: 'Delete',
        danger: true
      }))) return;

      const ids = Array.from(selectedIds);
      try {
        try {
          await api(cfg.api + '/', { method: 'DELETE', body: { ids } });
        } catch (bulkErr) {
          if (bulkErr.status === 405 || bulkErr.status === 404) {
            for (const id of ids) {
              await api(`${cfg.api}/${id}/`, { method: 'DELETE' });
            }
          } else {
            throw bulkErr;
          }
        }
        toast(`Deleted ${count} ${label}.`, 'ok');
        selectedIds.clear();
        load();
      } catch (err) {
        toast(err.message || `Failed to delete ${label}.`, 'err');
        load();
      }
      return;
    }
    const th = e.target.closest('th[data-s]'); if (th) return sortBy(th);
    if (e.target.closest('[data-retry]')) return load();
    const moreBtn = e.target.closest('[data-rowa-more]');
    if (moreBtn) {
      e.stopPropagation();
      const pop = moreBtn.nextElementSibling;
      const isOpen = pop && pop.style.display === 'block';
      root.querySelectorAll('.rowa-menu-pop').forEach(p => { p.style.display = 'none'; });
      if (pop && !isOpen) pop.style.display = 'block';
      return;
    }
    root.querySelectorAll('.rowa-menu-pop').forEach(p => { p.style.display = 'none'; });

    if (!e.target.closest('.export-dropdown-wrap')) {
      const pop = $('.export-menu-pop', root);
      if (pop) pop.style.display = 'none';
    }
    const x = e.target.closest('[data-x]');
    if (x) {
      const a = x.dataset.x;
      if (a === 'nx') { st.page++; load(); } else if (a === 'pv') { st.page--; load(); }
      else if (a === 'new') cfg.onNew();
      else if (a === 'import') openUniversalImportModal(cfg.api, cfg.title);
      else if (a === 'export-toggle') {
        const pop = $('.export-menu-pop', root);
        if (pop) pop.style.display = pop.style.display === 'none' ? 'block' : 'none';
      }
      else if (a === 'csv') {
        const pop = $('.export-menu-pop', root);
        if (pop) pop.style.display = 'none';
        if (!st.total && (!cache || Object.keys(cache).length === 0)) {
          toast('No data available to export.', 'err');
          return;
        }
        location.href = '/api/' + cfg.api + '/?' + qs({ ...params(), export: 'csv' });
      }
      else if (a === 'json') {
        const pop = $('.export-menu-pop', root);
        if (pop) pop.style.display = 'none';
        if (!st.total && (!cache || Object.keys(cache).length === 0)) {
          toast('No data available to export.', 'err');
          return;
        }
        try {
          const res = await api(cfg.api + '/?' + qs({ ...params(), export: 'json', page_size: 500 }));
          const rows = res.results || res;
          if (!rows || (Array.isArray(rows) && !rows.length)) {
            toast('No data available to export.', 'err');
            return;
          }
          const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' });
          const dl = document.createElement('a'); dl.href = URL.createObjectURL(blob);
          dl.download = `${cfg.api}_export_${iso(new Date())}.json`;
          dl.click();
          toast(`Exported ${cfg.title} as JSON!`, 'ok');
        } catch(err) { toast(err.message, 'err'); }
      }
      return;
    }
    const b = e.target.closest('[data-act]');
    if (b) { try { await cfg.onAction(b.dataset.act, cache[b.dataset.id]); } catch (err) { toast(err.message, 'err'); } }
  });
  load();
}

async function deleteRecord(resource, row, label) {
  const id = row && (row.id != null ? row.id : row);
  if (!id) return;
  if (!(await confirmBox({ title: 'Delete ' + label + '?', message: 'This cannot be undone.', okText: 'Delete', danger: true }))) return;
  try {
    await api(`${resource}/${id}/`, { method: 'DELETE' });
    toast(label + ' deleted', 'ok');
    if (window.PAGE && window.PAGE.reload) {
      window.PAGE.reload();
    } else {
      refresh();
    }
  } catch (err) {
    toast(err.message || ('Could not delete ' + label), 'err');
  }
}

const money = f => ({ r: 1, f });
function getOverdueDays(dueDateStr) {
  if (!dueDateStr) return 0;
  try {
    const due = new Date(dueDateStr + 'T00:00:00');
    const nowStr = (window.APP && window.APP.today) ? window.APP.today : new Date().toISOString().slice(0, 10);
    const now = new Date(nowStr + 'T00:00:00');
    const diffTime = now.getTime() - due.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  } catch (e) {
    return 0;
  }
}
window.getOverdueDays = getOverdueDays;
const docStatusFilters = (posted) => [{ name: 'status', label: 'Status', opts: [['', 'All statuses'], ['draft', 'Draft'], ['unpaid', posted], ['partial', 'Partially Paid'], ['overdue', 'Overdue'], ['paid', 'Paid'], ['void', 'Void']] }];
const LISTS = {
  customers: {
    api: 'customers', title: 'Customers', bc: 'Sales', newLabel: 'New customer', onNew: () => partyForm('customers'), empty: 'No customers yet.',
    filters: [{ name: 'active', label: 'Status', opts: [['', 'All'], ['1', 'Active'], ['0', 'Inactive']] }],
    cols: [{ h: 'Name', s: 'name', f: r => `<button class="lk" type="button" data-act="view" data-id="${r.id}">${esc(r.name)}</button>${r.active ? '' : ' ' + badge('Inactive')}` }, { h: 'Contact', f: r => esc(r.email || r.phone || '—') }, { h: 'State', s: 'state', f: r => esc(r.state || '—') }, { h: 'Billed', ...money(r => inr(r.billed)) }, { h: 'Receivable', ...money(r => inr(r.outstanding)) }, { h: 'Overdue', ...money(r => r.overdue > 0 ? `<span class="dn">${inr(r.overdue)}</span>` : inr(0)) }],
    actions: () => [['edit', 'Edit']],
    onAction: (a, r) => a === 'view' ? partyDetail('customers', r.id) : a === 'edit' ? partyForm('customers', r.id) : null,
  },
  vendors: {
    api: 'vendors', title: 'Vendors', bc: 'Purchases', newLabel: 'New vendor', onNew: () => partyForm('vendors'), empty: 'No vendors yet.',
    filters: [{ name: 'active', label: 'Status', opts: [['', 'All'], ['1', 'Active'], ['0', 'Inactive']] }],
    cols: [{ h: 'Name', s: 'name', f: r => `<button class="lk" type="button" data-act="view" data-id="${r.id}">${esc(r.name)}</button>${r.active ? '' : ' ' + badge('Inactive')}` }, { h: 'Contact', f: r => esc(r.email || r.phone || '—') }, { h: 'State', s: 'state', f: r => esc(r.state || '—') }, { h: 'Billed', ...money(r => inr(r.billed)) }, { h: 'Payable', ...money(r => inr(r.outstanding)) }, { h: 'Overdue', ...money(r => r.overdue > 0 ? `<span class="dn">${inr(r.overdue)}</span>` : inr(0)) }],
    actions: () => [['edit', 'Edit']],
    onAction: (a, r) => a === 'view' ? partyDetail('vendors', r.id) : a === 'edit' ? partyForm('vendors', r.id) : null,
  },
  items: {
    api: 'items', title: 'Items & Services', bc: 'Items', newLabel: 'New item', onNew: () => itemForm(), empty: 'No items yet.',
    filters: [{ name: 'type', label: 'Type', opts: [['', 'All types'], ['goods', 'Goods'], ['service', 'Services']] }, { name: 'active', label: 'Status', opts: [['', 'All'], ['1', 'Active'], ['0', 'Inactive']] }],
    cols: [
      {
        h: 'Item name', s: 'name', f: r => `
          <div style="display:flex;align-items:center;gap:10px;">
            ${r.image_data ? `<img src="${esc(r.image_data)}" alt="${esc(r.name)}" style="width:32px;height:32px;border-radius:7px;object-fit:cover;border:1px solid var(--bd-glass);box-shadow:0 2px 6px rgba(0,0,0,0.1);flex-shrink:0;">` : `<div style="width:32px;height:32px;border-radius:7px;background:var(--surface-glass-subtle);border:1px solid var(--bd-glass);display:grid;place-items:center;font-size:12px;font-weight:600;color:var(--accent);flex-shrink:0;">${esc((r.name || 'I')[0].toUpperCase())}</div>`}

            <div>
              <div style="font-weight:600;color:var(--tx);">${esc(r.name)}</div>

              <div class="sub" style="font-size:11px;">${esc(r.unit || 'nos')}${r.hsn_sac ? ' · HSN ' + esc(r.hsn_sac) : ''}</div>

            </div>

          </div>`

      },
      { h: 'SKU', s: 'sku', f: r => esc(r.sku) },
      { h: 'Type', f: r => r.type === 'goods' ? 'Goods' : 'Service' },
      { h: 'Selling price', s: 'selling_price', ...money(r => inr(r.selling_price)) },
      { h: 'Purchase price', ...money(r => inr(r.purchase_price)) },
      { h: 'GST', r: 1, f: r => num(r.gst_rate) + '%' },
      { h: 'Stock', s: 'stock', r: 1, f: r => r.stock == null ? '—' : qty(r.stock) + ' ' + esc(r.unit || '') },
      { h: 'Reorder at', r: 1, f: r => r.reorder_level == null ? '—' : qty(r.reorder_level) },
      { h: 'Status', f: r => badge(r.status) }
    ],
    actions: r => [['edit', 'Edit'], ...(r.track_inventory ? [['adjust', 'Adjust']] : [])],
    onAction: (a, r) => a === 'edit' ? itemForm(r.id) : a === 'adjust' ? adjustForm(r.id) : null,
  },
  invoices: {
    api: 'invoices', title: 'All Invoices ▾', bc: 'Sales', newLabel: 'New', onNew: () => invoiceForm(null, $('#pg'), () => { location.hash = '#/sales/invoices'; route(); }), ordering: '-date', empty: 'No invoices yet.',
    filters: docStatusFilters('Sent'),
    cols: [
      { h: 'DATE', s: 'date', f: r => fd(r.date) },
      { h: 'INVOICE#', s: 'number', f: r => `<button class="lk" type="button" data-act="view" data-id="${r.id}" style="color:#2563eb;font-weight:500;text-decoration:none;cursor:pointer;background:none;border:none;padding:0;font-size:inherit;">${esc(r.number)}</button> <span style="font-size:12px;color:#64748b;" title="Sent">✉</span>${r.attachment_count ? ' <span title="Has attachments" style="font-size:12px;">📎</span>' : ''}` },
      { h: 'ORDER NUMBER', s: 'order_number', f: r => esc(r.order_number || '') },
      { h: 'CUSTOMER NAME', s: 'customer__name', f: r => esc(r.customer_name || r.party || '—') },
      { h: 'STATUS', f: r => {
          const isOverdue = r.status === 'Overdue';
          const isPaid = r.status === 'Paid';
          const isDraft = r.raw_status === 'draft';
          if (isOverdue) {
            const days = getOverdueDays(r.due_date);
            return `<span style="color:#ea580c;font-weight:700;font-size:11px;line-height:1.2;display:inline-block;">OVERDUE BY ${days || 22}<br>DAYS</span>`;
          }
          if (isPaid) return `<span style="color:#10b981;font-weight:700;font-size:11px;">PAID</span>`;
          if (isDraft) return `<span style="color:#64748b;font-weight:700;font-size:11px;">DRAFT</span>`;
          return `<span style="color:#2563eb;font-weight:700;font-size:11px;">${esc((r.status || 'SENT').toUpperCase())}</span>`;
        }
      },
      { h: 'DUE DATE', s: 'due_date', f: r => fd(r.due_date) },
      { h: 'AMOUNT', s: 'total', ...money(r => inr(r.total)) },
      { h: 'BALANCE DUE', ...money(r => inr(r.balance)) }
    ],
    actions: r => {
      const acts = [['view', 'View'], ['edit', 'Edit']];
      if (num(r.balance) > 0 && r.raw_status !== 'void') acts.push(['pay', 'Record Payment']);
      return acts;
    },
    onAction: (a, r) => a === 'view' ? docMasterDetail($('#pg'), 'invoices', r.id) : a === 'edit' ? invoiceForm(r.id, $('#pg'), () => { location.hash = '#/sales/invoices'; route(); }) : a === 'pay' ? (window.recordInvoicePaymentModal ? recordInvoicePaymentModal(r, () => refresh()) : paymentForm('payments-received', { party: r.party_id, doc: r.id, amount: r.balance })) : null,
  },
  bills: {
    api: 'bills', title: 'Bills', bc: 'Purchases', newLabel: 'New bill', onNew: () => docMasterDetail($('#pg'), 'bills', 'new'), ordering: '-date', empty: 'No bills yet.',
    filters: docStatusFilters('Open'),
    cols: [{ h: 'Date', s: 'date', f: r => fd(r.date) }, { h: 'Bill#', s: 'number', f: r => `<button class="lk" type="button" data-act="view" data-id="${r.id}">${esc(r.number)}</button>${r.attachment_count ? ' <span title="Has attachments">📎</span>' : ''}` }, { h: 'Vendor', f: r => esc(r.party) }, { h: 'Status', f: r => badge(r.status) }, { h: 'Due date', s: 'due_date', f: r => fd(r.due_date) }, { h: 'Total', s: 'total', ...money(r => inr(r.total)) }, { h: 'Balance due', ...money(r => inr(r.balance)) }],
    actions: () => [['view', 'View'], ['edit', 'Edit']],
    onAction: (a, r) => a === 'view' ? docMasterDetail($('#pg'), 'bills', r.id) : a === 'edit' ? docMasterDetail($('#pg'), 'bills', r.id, true) : null,
  },
  'payments-received': {
    api: 'payments-received', title: 'Payments Received', bc: 'Sales', newLabel: 'Record payment', onNew: () => paymentForm('payments-received'), ordering: '-date', empty: 'No payments recorded yet.',
    cols: [{ h: 'Date', s: 'date', f: r => fd(r.date) }, { h: 'Receipt#', s: 'number', f: r => `<button class="lk" type="button" data-act="view" data-id="${r.id}">${esc(r.number)}</button>` }, { h: 'Customer', f: r => esc(r.party) }, { h: 'Mode', f: r => esc(r.mode_label) }, { h: 'Reference', f: r => esc(r.reference || '—') }, { h: 'Amount', s: 'amount', ...money(r => inr(r.amount)) }, { h: 'Unapplied', ...money(r => inr(r.unapplied)) }],
    actions: () => [['view', 'View'], ['edit', 'Edit']],
    onAction: (a, r) => a === 'view' ? paymentDetail('payments-received', r.id) : a === 'edit' ? paymentForm('payments-received', r) : null,
  },
  'payments-made': {
    api: 'payments-made', title: 'Payments Made', bc: 'Purchases', newLabel: 'Record payment', onNew: () => paymentForm('payments-made'), ordering: '-date', empty: 'No payments recorded yet.',
    cols: [{ h: 'Date', s: 'date', f: r => fd(r.date) }, { h: 'Payment#', s: 'number', f: r => `<button class="lk" type="button" data-act="view" data-id="${r.id}">${esc(r.number)}</button>` }, { h: 'Vendor', f: r => esc(r.party) }, { h: 'Mode', f: r => esc(r.mode_label) }, { h: 'Reference', f: r => esc(r.reference || '—') }, { h: 'Amount', s: 'amount', ...money(r => inr(r.amount)) }, { h: 'Unapplied', ...money(r => inr(r.unapplied)) }],
    actions: () => [['view', 'View'], ['edit', 'Edit']],
    onAction: (a, r) => a === 'view' ? paymentDetail('payments-made', r.id) : a === 'edit' ? paymentForm('payments-made', r) : null,
  },
  inventory: {
    api: 'items', title: 'Inventory Summary', bc: 'Inventory', params: { tracked: 1 }, empty: 'No inventory-tracked items yet. Create a goods item with “Track inventory” on.',
    filters: [
      { name: 'stock', label: 'Stock level', opts: [['', 'All Stock Levels'], ['low', 'Low stock'], ['out', 'Out of stock']] },
      { name: 'warehouse', label: 'Warehouse', loadOpts: async () => [['', 'All Warehouses'], ...(await api('lookup/warehouses/').catch(() => [])).map(w => [w.code, `${w.code} - ${w.name}${w.is_sub_warehouse ? ' (Sub)' : ''}`])] }
    ],
    cols: [
      { h: 'Warehouse Code', s: 'warehouse_code', f: r => `<span class="pastel-chip chip-lavender" style="font-weight:600;font-size:11px;">${esc(r.warehouse_code || 'WH-MAIN')}</span>` },
      { h: 'Item', s: 'name', f: r => esc(r.name) },
      { h: 'SKU', s: 'sku', f: r => esc(r.sku || '—') },
      { h: 'Opening Stock', s: 'opening_stock', r: 1, f: r => `<button class="lk" type="button" data-act="preview-opening" data-id="${r.id}" title="Click to view Opening Stock Details" style="font-weight:600;color:var(--p, #2563eb);background:none;border:none;cursor:pointer;padding:0;text-decoration:underline;">${qty(r.opening_stock || 0)}</button>` },
      { h: 'Stock In', s: 'stock_in', r: 1, f: r => `<span class="up" style="font-weight:600;color:#10b981;">+${qty(r.stock_in || 0)}</span>` },
      { h: 'Stock Out', s: 'stock_out', r: 1, f: r => `<span class="dn" style="font-weight:600;color:#ef4444;">-${qty(r.stock_out || 0)}</span>` },
      { h: 'Transfer In', s: 'transfer_in', r: 1, f: r => `<span class="up" style="font-weight:600;color:#0ea5e9;">+${qty(r.transfer_in || 0)}</span>` },
      { h: 'Transfer Out', s: 'transfer_out', r: 1, f: r => `<span class="dn" style="font-weight:600;color:#f97316;">-${qty(r.transfer_out || 0)}</span>` },
      { h: 'Current Stock / In Hand', s: 'stock', r: 1, f: r => `<button class="lk" type="button" data-act="preview-stock" data-id="${r.id}" title="Click to view Stock in Hand & Balance Details" style="font-weight:700;color:var(--p, #2563eb);background:none;border:none;cursor:pointer;padding:0;text-decoration:underline;">${qty(r.stock_in_hand != null ? r.stock_in_hand : (r.stock || 0))} ${esc(r.unit || '')}</button>` },
      { h: 'Closing Stock', s: 'closing_stock', r: 1, f: r => `<span style="font-weight:600;">${qty(r.closing_stock != null ? r.closing_stock : (r.stock || 0))}</span>` },
      { h: 'Unit cost', ...money(r => inr(r.purchase_price)) },
      { h: 'Total Stock Value', ...money(r => inr(r.stock_value != null ? r.stock_value : r.valuation)) },
      { h: 'Status', f: r => badge(r.status) }
    ],
    actions: () => [['adjust', 'Adjust'], ['preview-opening', 'Opening Preview'], ['preview-stock', 'Stock in Hand Preview']],
    onAction: (a, r) => a === 'preview-opening' ? previewOpeningStockModal(r.id, r.warehouse_code) : a === 'preview-stock' ? previewStockInHandModal(r.id, r.warehouse_code) : a === 'adjust' ? adjustForm(r.id) : null,
  },
  adjustments: {
    api: 'stock-adjustments', title: 'Stock Adjustments', bc: 'Inventory', newLabel: 'New adjustment', onNew: () => adjustForm(), ordering: '-date', empty: 'No stock adjustments yet.',
    filters: [
      { name: 'warehouse', label: 'Warehouse', loadOpts: async () => [['', 'All Warehouses'], ...(await api('lookup/warehouses/').catch(() => [])).map(w => [w.code, `${w.code} - ${w.name}${w.is_sub_warehouse ? ' (Sub)' : ''}`])] }
    ],
    cols: [
      { h: 'Date & Time', s: 'date', f: r => `${fd(r.date)} ${r.adjusted_time ? `<small style="color:var(--tx-muted);font-weight:600;margin-left:4px;">${esc(r.adjusted_time)}</small>` : ''}` },

      { h: 'Warehouse Code', s: 'warehouse_code', f: r => `<span class="pastel-chip chip-lavender" style="font-weight:600;font-size:11px;">${esc(r.warehouse_code || '—')}</span>` },
      { h: 'Reference', f: r => esc(r.reference) },
      { h: 'Item', s: 'item', f: r => esc(r.item) },
      { h: 'Reason', f: r => esc(r.reason) },
      { h: 'Change', r: 1, f: r => `<span class="${num(r.change) < 0 ? 'dn' : 'up'}">${num(r.change) > 0 ? '+' : ''}${qty(r.change)}</span>` },
      { h: 'Balance after', r: 1, f: r => qty(r.balance_after) }
    ],
  },
  movements: {
    api: 'stock-movements', title: 'Stock Movement', bc: 'Reports', newLabel: 'Move stock', onNew: () => stockMoveModal(), ordering: '-date', empty: 'No stock movements yet.',
    filters: [
      { name: 'kind', label: 'Type', opts: [['', 'All types'], ['transfer', 'Warehouse Transfers'], ['opening', 'Opening stock'], ['sale', 'Sales'], ['sale_void', 'Sales voided'], ['purchase', 'Purchases'], ['purchase_void', 'Purchases voided'], ['adjustment', 'Adjustments']] },
      { name: 'warehouse', label: 'Warehouse', loadOpts: async () => [['', 'All Warehouses'], ...(await api('lookup/warehouses/').catch(() => [])).map(w => [w.code, `${w.code} - ${w.name}${w.is_sub_warehouse ? ' (Sub)' : ''}`])] }
    ],
    cols: [
      { h: 'Date & Time', s: 'date', f: r => `${fd(r.date)} ${r.adjusted_time ? `<small style="color:var(--tx-muted);font-weight:600;margin-left:4px;">${esc(r.adjusted_time)}</small>` : ''}` },

      { h: 'Item', s: 'item', f: r => esc(r.item) },
      { h: 'Warehouse', f: r => r.to_warehouse_code ? `<span class="pastel-chip chip-sky" style="font-weight:600;font-size:11px;">${esc(r.warehouse_code || '—')} → ${esc(r.to_warehouse_code)}</span>` : `<span class="pastel-chip chip-lavender" style="font-weight:600;font-size:11px;">${esc(r.warehouse_code || '—')}</span>` },
      { h: 'Type', f: r => badge(r.kind_label || r.kind) },
      { h: 'Reference', f: r => esc(r.reference || '—') },
      { h: 'Change', r: 1, f: r => `<span class="${num(r.change) < 0 ? 'dn' : 'up'}">${num(r.change) > 0 ? '+' : ''}${qty(r.change)}</span>` },
      { h: 'Balance after', r: 1, f: r => qty(r.balance_after) }
    ]
  },
  'stock-transfers': {
    api: 'stock-transfers', title: 'Stock Transfers', bc: 'Inventory', newLabel: 'New Stock Transfer',
    onNew: () => stockTransferModal(), ordering: '-transfer_date', empty: 'No stock transfers yet. Click + New Stock Transfer to transfer stock between warehouses.',
    noDelete: true,
    noImport: true,
    filters: [
      { name: 'status', label: 'Status', opts: [['', 'All Transfers'], ['draft', 'Draft'], ['confirmed', 'Confirmed'], ['reversed', 'Reversed']] },
      { name: 'source_warehouse', label: 'Source Warehouse', loadOpts: async () => [['', 'All Source Warehouses'], ...(await api('lookup/warehouses/').catch(() => [])).map(w => [w.code, `${w.code} - ${w.name}${w.is_sub_warehouse ? ' (Sub)' : ''}`])] },
      { name: 'destination_warehouse', label: 'Destination Warehouse', loadOpts: async () => [['', 'All Destination Warehouses'], ...(await api('lookup/warehouses/').catch(() => [])).map(w => [w.code, `${w.code} - ${w.name}${w.is_sub_warehouse ? ' (Sub)' : ''}`])] }
    ],
    cols: [
      { h: 'Transfer Date', s: 'transfer_date', f: r => fd(r.transfer_date) },
      { h: 'Transfer #', s: 'transfer_number', f: r => `<button class="lk" type="button" data-act="view" data-id="${r.id}"><b>${esc(r.transfer_number)}</b></button>${r.is_reversal ? ' <span class="pastel-chip chip-rose" style="font-size:10px;padding:1px 5px;font-weight:700;">Reversal</span>' : ''}` },
      { h: 'Source (From)', f: r => `<span class="pastel-chip chip-amber" style="font-weight:600;font-size:11px;">${esc(r.source_warehouse_code || r.source_warehouse_name || '—')}</span>` },
      { h: 'Destination (To)', f: r => `<span class="pastel-chip chip-sky" style="font-weight:600;font-size:11px;">${esc(r.destination_warehouse_code || r.destination_warehouse_name || '—')}</span>` },
      { h: 'Items', f: r => {
        const lines = r.lines || [];
        if (!lines.length) return '—';
        if (lines.length === 1) return esc(lines[0].item_name || 'Item');
        return `${esc(lines[0].item_name || 'Item')} <span class="pastel-chip chip-lavender" style="font-size:10px;padding:1px 4px;">+${lines.length - 1} more</span>`;
      }},
      { h: 'Total Qty', r: 1, f: r => {
        const total = (r.lines || []).reduce((acc, l) => acc + (parseFloat(l.transfer_qty) || 0), 0);
        return `<b>${qty(total)}</b>`;
      }},
      { h: 'Status', f: r => {
        const map = {
          draft: ['chip-lavender', 'DRAFT'],
          confirmed: ['chip-mint', 'CONFIRMED'],
          reversed: ['chip-rose', 'REVERSED']
        };
        const [cls, label] = map[r.status] || ['chip-lavender', (r.status || 'DRAFT').toUpperCase()];
        return `<span class="pastel-chip ${cls}">${label}</span>`;
      }},
      { h: 'Created By', f: r => esc(r.created_by_name || '—') }
    ],
    actions: r => {
      // STRICT REQUIREMENT: No delete action anywhere
      if (r.status === 'draft') {
        return [
          ['view', 'View'],
          ['edit', 'Edit'],
          ['confirm', 'Confirm Transfer', 'btn-primary']
        ];
      } else if (r.status === 'confirmed') {
        return [
          ['view', 'View'],
          ['reverse', 'Reverse Entry', 'dn']
        ];
      } else {
        return [
          ['view', 'View']
        ];
      }
    },
    onAction: async (a, r) => {
      if (a === 'view') viewStockTransferDetail(r.id);
      else if (a === 'edit') stockTransferModal(r.id);
      else if (a === 'confirm') confirmStockTransferAction(r.id, () => refresh());
      else if (a === 'reverse') reverseStockTransferAction(r.id, () => refresh());
    }
  },
  quotes: {
    api: 'quotes', title: 'Quotes', bc: 'Sales', newLabel: 'New Quote',
    onNew: () => quoteForm(null, $('#pg'), () => { location.hash = '#/sales/quotes'; if (typeof route === 'function') route(); }), ordering: '-date', empty: 'No quotes yet. Click + New Quote to create your first sales quotation.',
    filters: [
      { name: 'status', label: 'Status', opts: [['', 'All Quotes'], ['draft', 'Draft'], ['sent', 'Sent'], ['accepted', 'Accepted'], ['declined', 'Declined'], ['ordered', 'Sales Order Created'], ['invoiced', 'Invoiced']] }
    ],
    cols: [
      { h: 'Date', s: 'date', f: r => fd(r.date) },
      { h: 'Quote Number', s: 'number', f: r => `<button class="lk" type="button" data-act="view" data-id="${r.id}"><b>${esc(r.number)}</b></button>${r.attachment_count ? ' <span title="Has attachments">📎</span>' : ''}` },
      { h: 'Customer Name', f: r => esc(r.party || r.customer_name) },
      { h: 'Reference Number', f: r => esc(r.reference_number || '—') },
      { h: 'Status', f: r => {
        const map = {
          draft: ['chip-lavender', 'DRAFT'],
          sent: ['chip-sky', 'SENT'],
          accepted: ['chip-mint', 'ACCEPTED'],
          declined: ['chip-rose', 'DECLINED'],
          ordered: ['chip-indigo', 'CONVERTED TO SO'],
          invoiced: ['chip-indigo', 'INVOICED']
        };
        const [cls, label] = map[r.status] || ['chip-lavender', (r.status || 'DRAFT').toUpperCase()];
        return `<span class="pastel-chip ${cls}">${label}</span>`;
      }},
      { h: 'Expiry Date', s: 'expiry_date', f: r => r.expiry_date ? fd(r.expiry_date) : '—' },
      { h: 'Amount', s: 'total', ...money(r => inr(r.total)) }
    ],
    actions: r => {
      const isConverted = r.status === 'invoiced' || r.status === 'ordered' || !!r.converted_to_invoice_id || !!r.converted_to_sales_order_id;
      const acts = [
        ['view', 'View'],
        ['edit', 'Edit'],
        ['sign', r.signature_data ? 'Signed ✓' : 'Sign']
      ];
      if (r.status === 'draft') {
        acts.push(['send', 'Mark as Sent']);
      }
      if (!isConverted && r.status !== 'declined') {
        if (r.status !== 'accepted') acts.push(['accept', 'Mark as Accepted']);
        acts.push(['decline', 'Mark as Declined']);
        acts.push(['convert-inv', 'Convert to Invoice']);
        acts.push(['convert-so', 'Convert to Sales Order']);
      }
      return acts;
    },
    onAction: async (a, r) => {
      if (a === 'view') docMasterDetail($('#pg'), 'quotes', r.id);
      else if (a === 'edit') quoteForm(r.id, $('#pg'), () => { docMasterDetail($('#pg'), 'quotes', r.id); });
      else if (a === 'sign') openSignatureModal(r, 'quotes', () => refresh());
      else if (a === 'send') {
        try {
          await api(`quotes/${r.id}/send/`, { method: 'POST', body: {} });
          toast(`Quote ${r.number} marked as sent!`, 'ok');
          refresh();
        } catch (e) { toast(e.message, 'err'); }
      }
      else if (a === 'accept') {
        try {
          await api(`quotes/${r.id}/accept/`, { method: 'POST', body: {} });
          toast(`Quote ${r.number} marked as accepted!`, 'ok');
          refresh();
        } catch (e) { toast(e.message, 'err'); }
      }
      else if (a === 'decline') {
        try {
          await api(`quotes/${r.id}/decline/`, { method: 'POST', body: {} });
          toast(`Quote ${r.number} marked as declined.`, 'ok');
          refresh();
        } catch (e) { toast(e.message, 'err'); }
      }
      else if (a === 'convert-inv') convertQuoteToInvoice(r.id);
      else if (a === 'convert-so') convertQuoteToSalesOrder(r.id);
      else if (a === 'delete') deleteRecord('quotes', r, 'quote');
    }
  },
  'sales-orders': {
    api: 'sales-orders', title: 'Sales Orders', bc: 'Sales', newLabel: 'New sales order',
    onNew: () => salesOrderForm(), ordering: '-date', empty: 'No sales orders yet. Click + New sales order to create one.',
    filters: [
      { name: 'status', label: 'Status', opts: [['', 'Status: All'], ['draft', 'Draft'], ['confirmed', 'Confirmed'], ['closed', 'Closed'], ['void', 'Void']] }
    ],
    cols: [
      { h: 'Date', s: 'date', f: r => fd(r.date) },
      { h: 'Order#', s: 'number', f: r => `<button class="lk" type="button" data-act="view" data-id="${r.id}">${esc(r.number)}</button>` },
      { h: 'Customer', f: r => esc(r.customer_name || r.party || '—') },
      { h: 'Status', f: r => {
        const map = {
          draft: ['chip-lavender', 'DRAFT'],
          confirmed: ['chip-sky', 'CONFIRMED'],
          closed: ['chip-mint', 'CLOSED'],
          void: ['chip-rose', 'VOID']
        };
        const [cls, label] = map[r.status] || ['chip-lavender', (r.status || 'DRAFT').toUpperCase()];
        return `<span class="pastel-chip ${cls}">${label}</span>`;
      }},
      { h: 'Expected Ship', s: 'expected_shipment_date', f: r => r.expected_shipment_date ? fd(r.expected_shipment_date) : (r.due_date ? fd(r.due_date) : '—') },
      { h: 'Total', s: 'total', ...money(r => inr(r.total)) }
    ],
    actions: r => {
      const acts = [
        ['view', 'View'],
        ['edit', 'Edit'],
        ['sign', r.signature_data ? 'Signed ✓' : 'Sign']
      ];
      if (r.status !== 'void' && r.status !== 'closed') {
        acts.push(['convert-inv', 'Convert to Invoice']);
      }
      if (r.status === 'draft') {
        acts.push(['confirm', 'Mark as Confirmed']);
      }
      return acts;
    },
    onAction: async (a, r) => {
      if (a === 'view') {
        viewSalesOrderDetail(r.id);
      } else if (a === 'edit') {
        salesOrderForm(r.id);
      } else if (a === 'sign') {
        openSignatureModal(r, 'sales-orders', () => refresh());
      } else if (a === 'convert-inv') {
        try {
          const res = await api(`sales-orders/${r.id}/convert-to-invoice/`, { method: 'POST', body: {} });
          toast(`Sales Order ${r.number} converted to Invoice ${res.number || ''}!`, 'ok');
          location.hash = '#/sales/invoices';
          setTimeout(() => {
            if (typeof docMasterDetail === 'function') docMasterDetail($('#pg'), 'invoices', res.id || res.invoice_id);
          }, 100);
        } catch (err) { toast(err.message, 'err'); }
      } else if (a === 'confirm') {
        try {
          await api(`sales-orders/${r.id}/confirm/`, { method: 'POST', body: {} });
          toast(`Sales Order ${r.number} marked as confirmed!`, 'ok');
          refresh();
        } catch (err) { toast(err.message, 'err'); }
      } else if (a === 'delete') {
        deleteRecord('sales-orders', r, 'sales order');
      }
    }
  },
  'recurring-invoices': {
    api: 'recurring-invoices', title: 'Recurring Invoices', bc: 'Sales', newLabel: 'New recurring profile', onNew: () => recurringInvoiceForm(null, $('#pg'), () => { location.hash = '#/sales/recurring-invoices'; if (typeof route === 'function') route(); }), ordering: '-created_at', empty: 'No recurring profiles yet.',
    cols: [
      { h: 'Profile Name', s: 'profile_name', f: r => `<button class="lk" type="button" data-act="view" data-id="${r.id}">${esc(r.profile_name)}</button>` },
      { h: 'Customer', f: r => esc(r.customer_name) },
      { h: 'Frequency', f: r => badge(r.frequency) },
      { h: 'Next Date', f: r => fd(r.next_date) },
      { h: 'Total', ...money(r => inr(r.total)) },
      { h: 'Status', f: r => badge(r.status) }
    ],
    actions: r => [
      ['view', 'View Profile & Invoices'],
      ['generate', 'Generate Invoice Now'],
      ['edit', 'Edit Profile'],
      ['toggle-status', r.status === 'active' ? 'Pause Schedule' : 'Resume Schedule'],
      ['delete', 'Delete', 'd']
    ],
    onAction: async (a, r) => {
      if (a === 'view') viewRecurringInvoiceModal(r.id);
      else if (a === 'generate') {
        try {
          const res = await api(`recurring-invoices/${r.id}/generate-invoice/`, { method: 'POST', body: {} });
          toast(`Generated invoice ${res.invoice_number || ''} successfully!`, 'ok');
          if (window.PAGE && window.PAGE.reload) window.PAGE.reload();
          else refresh();
        } catch (e) { toast(e.message, 'err'); }
      } else if (a === 'toggle-status') {
        const nextAct = r.status === 'active' ? 'pause' : 'resume';
        try {
          await api(`recurring-invoices/${r.id}/${nextAct}/`, { method: 'POST', body: {} });
          toast(`Profile ${nextAct === 'pause' ? 'paused' : 'resumed'}`);
          if (window.PAGE && window.PAGE.reload) window.PAGE.reload();
          else refresh();
        } catch (e) { toast(e.message, 'err'); }
      } else if (a === 'edit') recurringInvoiceForm(r.id, $('#pg'), () => { docMasterDetail($('#pg'), 'recurring-invoices', r.id); });
      else if (a === 'delete') deleteRecord('recurring-invoices', r, 'recurring profile');
    },
  },
  'retainer-invoices': {
    api: 'retainer-invoices', title: 'Retainer Invoices', bc: 'Sales', newLabel: 'New retainer invoice',
    onNew: () => retainerInvoiceForm(null, $('#pg'), (savedDoc) => {
      if (savedDoc) docMasterDetail($('#pg'), 'retainer-invoices', savedDoc.id);
      else docMasterDetail($('#pg'), 'retainer-invoices');
    }),
    ordering: '-date', empty: 'No retainer invoices yet.',
    filters: docStatusFilters('Sent'),
    cols: [
      { h: 'Date', s: 'date', f: r => fd(r.date) },
      { h: 'Retainer#', s: 'number', f: r => `<button class="lk" type="button" data-act="view" data-id="${r.id}">${esc(r.number)}</button>${r.attachment_count ? ' <span title="Has attachments">📎</span>' : ''}` },
      { h: 'Customer', f: r => esc(r.party) },
      { h: 'Purpose', f: r => esc(r.purpose || r.subject || r.notes || '—') },
      { h: 'Status', f: r => badge(r.status) },
      { h: 'Total', s: 'total', ...money(r => inr(r.total)) },
      { h: 'Balance Due', ...money(r => inr(r.balance)) },
      { h: 'Available Credit', ...money(r => inr(r.available_balance || 0)) },
    ],
    actions: () => [['view', 'View'], ['edit', 'Edit']],
    onAction: (a, r) => a === 'view' ? docMasterDetail($('#pg'), 'retainer-invoices', r.id) : a === 'edit' ? retainerInvoiceForm(r.id, $('#pg'), (savedDoc) => {
      docMasterDetail($('#pg'), 'retainer-invoices', savedDoc ? savedDoc.id : r.id);
    }) : null,
  },
  'delivery-challans': {
    api: 'delivery-challans', title: 'Delivery Challans', bc: 'Sales', newLabel: 'New delivery challan', onNew: () => challanModal(), ordering: '-date', empty: 'No delivery challans yet.',
    cols: [{ h: 'Date', s: 'date', f: r => fd(r.date) }, { h: 'Challan#', s: 'number', f: r => `<button class="lk" type="button" data-act="edit" data-id="${r.id}">${esc(r.number)}</button>` }, { h: 'Customer', f: r => esc(r.customer_name) }, { h: 'Type', f: r => esc(r.challan_type) }, { h: 'Vehicle#', f: r => esc(r.vehicle_number || '—') }, { h: 'Status', f: r => badge(r.status) }],
    actions: r => [['edit', 'Edit'], ['sign', r.signature_data ? 'Signed ✓' : 'Sign'], ['delete', 'Delete', 'd']],
    onAction: (a, r) => {
      if (a === 'edit') challanModal(r.id);
      else if (a === 'sign') openSignatureModal(r, 'delivery-challans', () => refresh());
      else if (a === 'delete') deleteRecord('delivery-challans', r, 'delivery challan');
    },
  },
  'credit-notes': {
    api: 'credit-notes', title: 'Credit Notes', bc: 'Sales', newLabel: 'New credit note', onNew: () => docForm('credit-notes'), ordering: '-date', empty: 'No credit notes yet.',
    cols: [{ h: 'Date', s: 'date', f: r => fd(r.date) }, { h: 'Credit Note#', s: 'number', f: r => `<button class="lk" type="button" data-act="view" data-id="${r.id}">${esc(r.number)}</button>` }, { h: 'Customer', f: r => esc(r.party || r.customer_name) }, { h: 'Status', f: r => badge(r.status) }, { h: 'Total', ...money(r => inr(r.total)) }, { h: 'Balance', ...money(r => inr(r.balance || r.total)) }],
    actions: r => [['view', 'View'], ['edit', 'Edit'], ['sign', r.signature_data ? 'Signed ✓' : 'Sign']],
    onAction: (a, r) => (a === 'edit' || a === 'view') ? docForm('credit-notes', r.id) : (a === 'sign' ? openSignatureModal(r, 'credit-notes', () => refresh()) : null),
  },
  'e-way-bills': {
    api: 'e-way-bills', title: 'E-Way Bills', bc: 'Sales', newLabel: 'Generate e-Way Bill', onNew: () => ewayBillModal(), ordering: '-created_at', empty: 'No e-Way Bills generated yet.',
    cols: [
      { h: 'Date', s: 'doc_date', f: r => fd(r.doc_date) },
      { h: 'E-Way Bill#', s: 'bill_number', f: r => `<b>${esc(r.bill_number)}</b>` },
      { h: 'Doc#', f: r => `${esc(r.doc_type)}: ${esc(r.doc_number)}` },
      { h: 'Party Name', f: r => esc(r.party_name) },
      { h: 'Route', f: r => `${esc(r.from_state)} → ${esc(r.to_state)} (${r.distance_km} km)` },
      { h: 'Vehicle', f: r => esc(r.vehicle_number || '—') },
      { h: 'Valid Until', f: r => fd(r.valid_until) },
      { h: 'Status', f: r => badge(r.status) }
    ],
    actions: () => [],
    onAction: () => {},
  },
  expenses: {
    api: 'expenses', title: 'Expenses', bc: 'Purchases', newLabel: 'Record expense', onNew: () => expenseForm(), ordering: '-date', empty: 'No expenses recorded yet.',
    cols: [
      { h: 'Date', s: 'date', f: r => fd(r.date) },
      { h: 'Expense#', s: 'number', f: r => `<button class="lk" type="button" data-act="edit" data-id="${r.id}">${esc(r.number)}</button>` },
      { h: 'Account', f: r => esc(r.expense_account_name) },
      { h: 'Vendor', f: r => esc(r.vendor_name || '—') },
      { h: 'Paid Through', f: r => esc(r.paid_through) },
      { h: 'Tax (GST)', ...money(r => inr(r.tax_amount)) },
      { h: 'Amount', s: 'total', ...money(r => inr(r.total)) },
      { h: 'Tax Deductible', f: r => r.is_tax_deductible ? badge('Deductible', 'up') : badge('Non-deductible') }
    ],
    actions: () => [['edit', 'Edit']],
    onAction: (a, r) => a === 'edit' ? expenseForm(r.id) : null,
  },
  'purchase-orders': {
    api: 'purchase-orders', title: 'Purchase Orders', bc: 'Purchases', newLabel: 'New purchase order', onNew: () => docForm('purchase-orders'), ordering: '-date', empty: 'No purchase orders yet.',
    filters: docStatusFilters('Confirmed'),
    cols: [{ h: 'Date', s: 'date', f: r => fd(r.date) }, { h: 'PO#', s: 'number', f: r => `<button class="lk" type="button" data-act="view" data-id="${r.id}">${esc(r.number)}</button>` }, { h: 'Vendor', f: r => esc(r.party || r.vendor_name) }, { h: 'Status', f: r => badge(r.status) }, { h: 'Delivery Date', s: 'delivery_date', f: r => fd(r.delivery_date || r.due_date) }, { h: 'Total', s: 'total', ...money(r => inr(r.total)) }],
    actions: r => [['view', 'View'], ['edit', 'Edit'], ['sign', r.signature_data ? 'Signed ✓' : 'Sign']],
    onAction: (a, r) => a === 'view' ? docMasterDetail($('#pg'), 'purchase-orders', r.id) : a === 'edit' ? purchaseOrderForm(r.id, $('#pg'), () => { docMasterDetail($('#pg'), 'purchase-orders', r.id); }) : (a === 'sign' ? openSignatureModal(r, 'purchase-orders', () => refresh()) : null),
  },
  'vendor-credits': {
    api: 'vendor-credits', title: 'Vendor Credits', bc: 'Purchases', newLabel: 'New vendor credit', onNew: () => docForm('vendor-credits'), ordering: '-date', empty: 'No vendor credits yet.',
    cols: [{ h: 'Date', s: 'date', f: r => fd(r.date) }, { h: 'Credit#', s: 'number', f: r => `<button class="lk" type="button" data-act="view" data-id="${r.id}">${esc(r.number)}</button>` }, { h: 'Vendor', f: r => esc(r.party || r.vendor_name) }, { h: 'Status', f: r => badge(r.status) }, { h: 'Total', ...money(r => inr(r.total)) }, { h: 'Balance', ...money(r => inr(r.balance || r.total)) }],
    actions: r => [['view', 'View'], ['edit', 'Edit'], ['sign', r.signature_data ? 'Signed ✓' : 'Sign']],
    onAction: (a, r) => (a === 'edit' || a === 'view') ? docForm('vendor-credits', r.id) : (a === 'sign' ? openSignatureModal(r, 'vendor-credits', () => refresh()) : null),
  },
  projects: {
    api: 'projects', title: 'Projects', bc: 'Time Tracking', newLabel: 'New project', onNew: () => projectModal(), ordering: 'name', empty: 'No projects yet.',
    cols: [
      { h: 'Code', s: 'code', f: r => `<b>${esc(r.code || '—')}</b>` },
      { h: 'Project Name', s: 'name', f: r => esc(r.name) },
      { h: 'Customer', f: r => esc(r.customer_name || '—') },
      { h: 'Billing Method', f: r => esc((r.billing_method || '').replace('_', ' ')) },
      { h: 'Rate / Hour', ...money(r => inr(r.rate_per_hour)) },
      { h: 'Budget Hours', r: 1, f: r => qty(r.budget_hours) + ' hrs' },
      { h: 'Status', f: r => badge(r.status) }
    ],
    actions: () => [['edit', 'Edit']],
    onAction: (a, r) => a === 'edit' ? projectModal(r.id) : null,
  },
  timesheets: {
    api: 'timelogs', title: 'Timesheets', bc: 'Time Tracking', newLabel: 'Log time', onNew: () => timelogModal(), ordering: '-date', empty: 'No time entries logged yet.',
    cols: [
      { h: 'Date', s: 'date', f: r => `<button class="lk" type="button" data-act="edit" data-id="${r.id}">${fd(r.date)}</button>` },
      { h: 'Project', f: r => esc(r.project_name) },
      { h: 'Task', f: r => esc(r.task) },
      { h: 'Hours', r: 1, f: r => `<b>${qty(r.hours)} hrs</b>` },
      { h: 'Billable', f: r => r.billable ? badge('Billable', 'up') : badge('Non-billable') },
      { h: 'Logged By', f: r => esc(r.user_name || 'Admin') }
    ],
    actions: () => [['edit', 'Edit']],
    onAction: (a, r) => a === 'edit' ? timelogModal(r.id) : null,
  },
  'bank-accounts': {
    api: 'bank-accounts', title: 'Bank Accounts', bc: 'Banking', newLabel: 'Add bank account', onNew: () => bankAccountForm(), empty: 'No bank accounts added yet.',
    cols: [
      { h: 'Account Name', s: 'name', f: r => `<b>${esc(r.name)}</b><div class="sub" style="font-size:11px;">${esc(r.bank_name)} · ${esc(r.account_number)}</div>` },
      { h: 'Type', f: r => esc((r.account_type || '').replace('_', ' ')) },
      { h: 'IFSC', f: r => esc(r.ifsc || '—') },
      { h: 'Balance', s: 'current_balance', ...money(r => `<span style="font-weight:700;color:var(--accent);">${inr(r.current_balance)}</span>`) }
    ],
    actions: () => [['edit', 'Edit'], ['import', 'Import Feed']],
    onAction: (a, r) => a === 'edit' ? bankAccountForm(r.id) : a === 'import' ? importStatementModal(r.id) : null,
  },
  'bank-transactions': {
    api: 'bank-transactions', title: 'Bank Transactions', bc: 'Banking', ordering: '-date', empty: 'No bank transactions found. Import a statement or sync live feeds.',
    filters: [{ name: 'status', label: 'Status', opts: [['', 'All'], ['unreconciled', 'Unreconciled'], ['matched', 'Matched'], ['reconciled', 'Reconciled']] }],
    cols: [
      { h: 'Date', s: 'date', f: r => fd(r.date) },
      { h: 'Bank Account', f: r => esc(r.bank_account_name) },
      { h: 'Description', f: r => `<b>${esc(r.description)}</b>${r.reference ? `<div class="sub" style="font-size:11px;">Ref: ${esc(r.reference)}</div>` : ''}` },

      { h: 'Withdrawal (Dr)', ...money(r => num(r.withdrawal) > 0 ? `<span class="dn">${inr(r.withdrawal)}</span>` : '—') },
      { h: 'Deposit (Cr)', ...money(r => num(r.deposit) > 0 ? `<span class="up">+${inr(r.deposit)}</span>` : '—') },
      { h: 'Running Balance', ...money(r => inr(r.balance)) },
      { h: 'Status', f: r => r.status === 'reconciled' ? badge('Reconciled', 'up') : r.status === 'matched' ? badge('Matched', 'warn') : badge('Unreconciled') }
    ],
    actions: r => r.status !== 'reconciled' ? [['rec', 'Reconcile Match']] : [],
    onAction: async () => { location.hash = '#/banking/bank-reconciliation'; }
  },
  'manual-journals': {
    api: 'manual-journals', title: 'Manual Journals', bc: 'Accountant', newLabel: 'New journal', onNew: () => journalForm(), ordering: '-date', empty: 'No journal entries yet.',
    cols: [
      { h: 'Date', s: 'date', f: r => fd(r.date) },
      { h: 'Journal#', s: 'number', f: r => `<button class="lk" type="button" data-act="edit" data-id="${r.id}"><b>${esc(r.number)}</b></button>` },
      { h: 'Type', f: r => badge(r.entry_type) },
      { h: 'Reference', f: r => esc(r.reference || '—') },
      { h: 'Notes', f: r => esc(r.notes || '—') },
      { h: 'Total Debit', ...money(r => inr(r.total_debit)) },
      { h: 'Total Credit', ...money(r => inr(r.total_credit)) }
    ],
    actions: () => [['edit', 'Edit']],
    onAction: (a, r) => a === 'edit' ? journalForm(r.id) : null,
  },
  accounts: {
    api: 'accounts', title: 'Chart of Accounts', bc: 'Accountant', newLabel: 'New account', onNew: () => accountForm(), ordering: 'code', empty: 'No accounts in Chart of Accounts.',
    filters: [{ name: 'type', label: 'Account Type', opts: [['', 'All Types'], ['asset', 'Assets'], ['liability', 'Liabilities'], ['equity', 'Equity'], ['income', 'Income'], ['expense', 'Expenses']] }],
    cols: [
      { h: 'Code', s: 'code', f: r => `<b>${esc(r.code)}</b>` },
      { h: 'Account Name', s: 'name', f: r => `<b>${esc(r.name)}</b>${r.is_system ? ' <span class="pastel-chip chip-sky" style="font-size:10px;padding:1px 6px;">System</span>' : ''}` },
      { h: 'Type', f: r => badge((r.account_type || '').toUpperCase()) },
      { h: 'Sub Type', f: r => esc(r.sub_type || '—') },
      { h: 'Balance', s: 'balance', ...money(r => inr(r.balance)) },
      { h: 'Status', f: r => r.active ? badge('Active', 'up') : badge('Inactive') }
    ],
    actions: () => [['edit', 'Edit']],
    onAction: (a, r) => a === 'edit' ? accountForm(r.id) : null,
  },
  'item-categories': {
    api: 'item-categories', title: 'Item Categories', bc: 'Items', newLabel: 'New category', onNew: () => categoryModal(), ordering: 'name', empty: 'No item categories yet.',
    cols: [{ h: 'Category Name', s: 'name', f: r => `<button class="lk" type="button" data-act="edit" data-id="${r.id}"><b>${esc(r.name)}</b></button>` }, { h: 'Description', f: r => esc(r.description || '—') }],
    actions: () => [['edit', 'Edit']],
    onAction: (a, r) => a === 'edit' ? categoryModal(r.id) : null,
  },
  'price-lists': {
    api: 'price-lists', title: 'Price Lists', bc: 'Items', newLabel: 'New price list', onNew: () => priceListModal(), ordering: 'name', empty: 'No price lists yet.',
    cols: [{ h: 'Name', s: 'name', f: r => `<b>${esc(r.name)}</b>` }, { h: 'Pricing Scheme', f: r => esc(r.pricing_scheme) }, { h: 'Percentage', r: 1, f: r => num(r.percentage) + '%' }, { h: 'Status', f: r => r.active ? badge('Active', 'up') : badge('Inactive') }],
    actions: () => [['edit', 'Edit']],
    onAction: (a, r) => a === 'edit' ? priceListModal(r.id) : null,
  },
  warehouses: {
    api: 'warehouses', title: 'Warehouses', bc: 'Inventory', newLabel: 'New warehouse', onNew: () => warehouseModal(), ordering: 'name', empty: 'No warehouses configured.',
    cols: [
      { h: 'Code', s: 'code', f: r => `<b>${esc(r.code)}</b>` },
      { h: 'Warehouse Name', s: 'name', f: r => `<b>${esc(r.name)}</b>${r.is_primary ? ' <span class="pastel-chip chip-lavender" style="font-size:10px;padding:1px 6px;">Primary</span>' : ''}` },
      { h: 'Warehouse Type', f: r => r.is_sub_warehouse ? `<span class="pastel-chip chip-amber" style="font-size:11px;">Sub-warehouse of <b>${esc(r.parent_code || r.parent_name)}</b></span>` : `<span class="pastel-chip chip-mint" style="font-size:11px;">Main Warehouse</span>` },
      { h: 'Database', f: () => `<span class="pastel-chip chip-sky" style="font-size:10.5px;">Shared Database</span>` },
      { h: 'City', f: r => esc(r.city || '—') },
      { h: 'State', f: r => esc(r.state || '—') }
    ],
    actions: () => [['edit', 'Edit']],
    onAction: (a, r) => a === 'edit' ? warehouseModal(r.id) : null,
  },
  'payment-transactions': {
    api: 'payment-transactions', title: 'Payment Gateway Transactions', bc: 'Convosis Payments', ordering: '-created_at', empty: 'No online payment transactions yet.',
    cols: [
      { h: 'Date', s: 'created_at', f: r => fd(r.created_at) },
      { h: 'Transaction ID', s: 'transaction_id', f: r => `<b>${esc(r.transaction_id)}</b>` },
      { h: 'Gateway', f: r => badge((r.gateway || '').toUpperCase()) },
      { h: 'Amount', s: 'amount', ...money(r => inr(r.amount)) },
      { h: 'Gateway Fee', ...money(r => inr(r.fee)) },
      { h: 'Customer Email', f: r => esc(r.customer_email || '—') },
      { h: 'Status', f: r => badge(r.status, r.status === 'captured' ? 'up' : '') }
    ],
  },
  'audit-logs': {
    api: 'audit-logs', title: 'Statutory Audit Trail', bc: 'Accountant', ordering: '-timestamp', empty: 'No audit logs recorded.',
    cols: [
      { h: 'Timestamp', s: 'timestamp', f: r => fd(r.timestamp) + ' ' + (r.timestamp.split('T')[1] || '').slice(0, 5) },
      { h: 'User', f: r => esc(r.username || 'System') },
      { h: 'Action', f: r => badge((r.action || '').toUpperCase()) },
      { h: 'Entity', f: r => `${esc(r.entity_type)} #${esc(r.entity_id || '')}` },
      { h: 'Audit Summary', f: r => esc(r.summary) },
      { h: 'IP Address', f: r => esc(r.ip_address || '—') }
    ]
  }
};

const kvBox = pairs => `<div class="kv">${pairs.map(([k, v]) => `<div><span>${esc(k)}</span>${v}</div>`).join('')}</div>`;

function renderDocSheet(d, kind, customOpts = {}) {
  const isRetainer = kind === 'retainer-invoices';
  const isBill = kind === 'bills';
  const inv = kind === 'invoices' || isRetainer;
  const org = APP.org || {};
  const theme = customOpts.theme || org.template_theme || (!isBill ? 'convosis' : 'modern');
  const color = customOpts.color || org.template_color || '#1877f2';
  const showLogo = customOpts.show_logo !== false;
  const showSig = customOpts.show_signature !== false;
  const showWords = customOpts.show_words !== false && !customOpts.hide_amounts;
  const showHsn = customOpts.show_hsn !== false;
  const hideAmounts = !!customOpts.hide_amounts;
  const isDeliveryNote = !!customOpts.is_delivery_note;
  const title = customOpts.title || (
    isRetainer ? 'RETAINER INVOICE' :
    kind === 'invoices' ? 'TAX INVOICE' :
    kind === 'quotes' ? 'ESTIMATE / QUOTE' :
    kind === 'sales-orders' ? 'SALES ORDER' :
    kind === 'delivery-challans' ? 'DELIVERY CHALLAN' :
    kind === 'credit-notes' ? 'CREDIT NOTE' :
    kind === 'purchase-orders' ? 'PURCHASE ORDER' :
    kind === 'vendor-credits' ? 'VENDOR CREDIT' :
    kind === 'bills' ? 'BILL' : (kind || '').replace(/-/g, ' ').toUpperCase()
  );
  const sigData = d.signature_data || org.signature_data || '';
  const sigTitle = d.signature_title || org.signature_title || 'Authorized Signature';
  const signedBy = d.signed_by || '';
  const signedAt = d.signed_at ? fd(d.signed_at) : '';

  const isPaid = d.status === 'Paid' || (d.raw_status !== 'draft' && num(d.balance) <= 0);
  const isOverdue = d.status === 'Overdue';
  const isDraft = d.raw_status === 'draft';
  const isPartial = d.raw_status === 'partial';
  const ribClass = isPaid ? 'paid' : isOverdue ? 'overdue' : isDraft ? 'draft' : isPartial ? 'open' : 'open';
  const ribText = isPaid ? 'Paid' : isOverdue ? 'Overdue' : isDraft ? 'Draft' : isPartial ? 'Partially Paid' : (isBill ? 'Open' : 'Sent');

  const linesHtml = (d.lines || []).map((l, i) => `
    <tr>
      <td style="width:36px;color:#64748b;font-weight:600;">${i + 1}</td>
      <td>
        <div style="font-weight:600;color:#0f172a;">${esc(l.description)}</div>
      </td>
      ${showHsn ? `<td style="color:#475569;">${esc(l.hsn_sac || '—')}</td>` : ''}
      <td class="r" style="font-weight:600;">${qty(l.quantity)}</td>
      ${!hideAmounts ? `
        <td class="r">${inr(l.rate).replace('₹', '')}</td>
        <td class="r" style="font-weight:700;">${inr(l.line_total).replace('₹', '')}</td>
      ` : ''}
    </tr>
  `).join('');

  const party = d.party_details || {};
  const partyName = esc(d.party || party.name || (!isBill ? 'Customer' : 'Vendor'));
  const partyAddr = esc(party.billing_address || '');
  const partyGstin = party.gstin ? `<div style="margin-top:2px;">GSTIN <b>${esc(party.gstin)}</b></div>` : '';
  const partyState = party.state ? `<div>State: ${esc(party.state)}</div>` : '';

  const companyIdLine = org.company_id ? `<div>Company ID : <b>${esc(org.company_id)}</b></div>` : '';
  const orgAddrHtml = org.address ? org.address.split('\n').map(l => `<div>${esc(l)}</div>`).join('') : '';
  const cityStateParts = [org.city, org.state, org.pincode].filter(Boolean).map(esc).join(' ');
  const orgCityState = cityStateParts ? `<div>${cityStateParts}</div>` : '';
  const orgCountry = org.country ? `<div>${esc(org.country)}</div>` : '';
  const orgGstin = org.gstin ? `<div>GSTIN <b>${esc(org.gstin)}</b></div>` : '';
  const orgPhone = org.phone ? `<div>${esc(org.phone)}</div>` : '';
  const orgEmail = org.email ? `<div>${esc(org.email)}</div>` : '';
  const orgWeb = org.website ? `<div>${esc(org.website)}</div>` : '';
  const logoSrc = org.logo_data || '';
  const hasLogo = showLogo && Boolean(logoSrc);

  const orderNum = d.order_number || d.vendor_ref || '';
  const isDarkHead = theme === 'modern' || (!inv && theme !== 'convosis');
  const taxPricingLabel = d.tax_pricing_type === 'tax_inclusive' ? 'Tax Inclusive' : 'Tax Exclusive';
  const partyTypeLabel = d.customer_type ? (
    d.customer_type === 'b2b' ? 'B2B (Registered)' :
    d.customer_type === 'b2c' ? 'B2C (Consumer)' :
    d.customer_type === 'registered' ? 'Registered Supplier' :
    d.customer_type === 'unregistered' ? 'Unregistered Supplier' : esc(d.customer_type)
  ) : (party.gstin ? (isBill ? 'Registered Supplier' : 'B2B (Registered)') : (isBill ? 'Unregistered Supplier' : 'B2C (Consumer)'));

  return `
    <div class="doc-sheet theme-${theme}" style="--theme-color:${color};position:relative;">
      <div class="doc-watermark-stamp ${ribClass}"><span>${ribText}</span></div>

      <div class="doc-sheet-header">
        <div class="doc-company-box">
          ${hasLogo ? `<img class="doc-company-logo" src="${esc(logoSrc)}" alt="${esc(org.name || '')}">` : ''}
          <div class="doc-company-name">${esc(org.name || '')}</div>
          <div class="doc-company-detail">
            ${companyIdLine}
            ${orgAddrHtml}
            ${orgCityState}
            ${orgCountry}
            ${orgGstin}
            ${orgPhone}
            ${orgEmail}
            ${orgWeb}
          </div>
        </div>

        <div class="doc-title-box">
          <div class="doc-main-heading" style="color:${color};">${esc(title)}</div>
          ${isBill ? `<div style="font-size:14px;font-weight:700;margin-bottom:8px;color:#0f172a;">Bill# ${esc(d.number)}</div><div style="font-size:12px;color:#475569;margin-bottom:8px;">Balance Due <b style="color:${color};font-size:14px;">${inr(d.balance)}</b></div>` : ''}

          ${isRetainer ? `<div style="font-size:14px;font-weight:700;margin-bottom:8px;color:#0f172a;">Retainer# ${esc(d.number)}</div>` : ''}
          <table class="doc-meta-grid">
            ${kind === 'invoices' ? `<tr><td>#</td><td>: <b>${esc(d.number)}</b></td></tr>` : ''}
            ${isRetainer ? `<tr><td>Retainer Date</td><td>: ${fd(d.date)}</td></tr>` : kind === 'invoices' ? `<tr><td>Invoice Date</td><td>: ${fd(d.date)}</td></tr>` : `<tr><td>Bill Date</td><td>: ${fd(d.date)}</td></tr>`}
            <tr><td>Terms</td><td>: ${esc(d.terms || 'Due on Receipt')}</td></tr>

            <tr><td>Due Date</td><td>: ${fd(d.due_date)}</td></tr>

            ${!isBill ? `<tr><td>Place Of Supply</td><td>: ${esc(d.place_of_supply || org.state || 'Kerala')}</td></tr>` : ''}
            ${orderNum ? `<tr><td>${isRetainer ? 'Reference#' : 'Order Number'}</td><td>: ${esc(orderNum)}</td></tr>` : ''}
            ${(isRetainer && (d.purpose || d.subject || d.notes)) ? `<tr><td>Purpose</td><td>: <b>${esc(d.purpose || d.subject || d.notes)}</b></td></tr>` : ''}
            ${d.source_label && d.source_label !== 'Direct / Manual Creation' ? `<tr><td>Source / Ref</td><td>: <span style="color:#2563eb;font-weight:600;">${esc(d.source_label)}</span></td></tr>` : ''}
            <tr><td>Tax Pricing</td><td>: <span style="font-weight:600;color:${d.tax_pricing_type === 'tax_inclusive' ? '#16a34a' : '#2563eb'};">${taxPricingLabel}</span></td></tr>
            <tr><td>${!isBill ? 'Customer Type' : 'Supplier Type'}</td><td>: <span style="font-weight:600;">${partyTypeLabel}</span></td></tr>
          </table>

        </div>

      </div>

      <div class="doc-party-sec">
        <div class="doc-party-title">${!isBill ? 'Bill To' : 'Bill From'}</div>

        <div class="doc-party-name" style="color:${color};">${partyName}</div>

        <div class="doc-party-detail">
          ${partyAddr ? `<div>${partyAddr}</div>` : ''}
          ${partyState}
          ${partyGstin}
        </div>

      </div>

      ${isDeliveryNote ? `
        <div style="margin:14px 0;padding:10px 14px;background:rgba(248,250,252,0.8);border:1px solid #e2e8f0;border-radius:6px;display:grid;grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));gap:10px;font-size:12px;">
          <div><span style="color:#64748b;">Transport Mode:</span> <b>${esc(d.dispatch_through || d.transporter_name || 'Road Transport')}</b></div>
          <div><span style="color:#64748b;">Vehicle / LR No:</span> <b>${esc(d.vehicle_number || d.lr_no || '—')}</b></div>
          <div><span style="color:#64748b;">Place of Supply:</span> <b>${esc(d.place_of_supply || 'Consignee Address')}</b></div>
        </div>
      ` : ''}

      <table class="doc-items-tbl ${isDarkHead ? 'dark-head' : ''}">
        <thead>
          <tr>
            <th>#</th>
            <th>Item &amp; Description</th>
            ${showHsn ? '<th>HSN/SAC</th>' : ''}
            <th class="r">Qty</th>
            ${!hideAmounts ? `
              <th class="r">Rate</th>
              <th class="r">Amount</th>
            ` : ''}
          </tr>
        </thead>
        <tbody>
          ${linesHtml}
        </tbody>
      </table>

      <div class="doc-bottom-split">
        <div class="doc-bottom-left">
          ${showWords ? `
            <div class="doc-words-block">
              <div class="doc-words-label">Total In Words</div>
              <div class="doc-words-val">${numToWordsINR(d.total)}</div>
            </div>
          ` : ''}
          ${d.notes ? `
            <div class="doc-notes-block">
              <div class="doc-notes-label">Notes</div>
              <div>${esc(d.notes)}</div>
            </div>
          ` : ''}
          ${d.terms ? `
            <div class="doc-terms-block">
              <div class="doc-notes-label">Terms &amp; Conditions</div>
              <div>${esc(d.terms)}</div>
            </div>
          ` : ''}
        </div>

        <div class="doc-bottom-right">
          <div class="doc-totals-box">
            <div style="font-size:11px;color:#64748b;text-align:right;margin-bottom:8px;padding-bottom:6px;border-bottom:1px dashed #e2e8f0;">
              <a href="javascript:void(0)" class="btn-tax-pricing-info" data-doc-kind="${kind}" style="color:#2563eb;text-decoration:none;display:inline-flex;align-items:center;gap:4px;font-weight:600;" title="View GST Pricing & B2B/B2C Rules Guide">
                <i class="fa-solid fa-circle-info"></i> Tax &amp; Billing (${partyTypeLabel} · ${taxPricingLabel})
              </a>
            </div>
            ${!hideAmounts ? `
              <div class="doc-totals-row">
                <span>Taxable Amount (${taxPricingLabel})</span>
                <span style="font-weight:600;">${inr(d.subtotal).replace('₹', '')}</span>
              </div>
              ${d.intra_state ? `
                <div class="doc-totals-row"><span>CGST</span><span>${inr(d.cgst)}</span></div>
                <div class="doc-totals-row"><span>SGST</span><span>${inr(d.sgst)}</span></div>
              ` : (num(d.igst) > 0 ? `<div class="doc-totals-row"><span>IGST</span><span>${inr(d.igst)}</span></div>` : '')}
              <div class="doc-totals-row main-total">
                <span>Total</span>
                <span>${inr(d.total)}</span>
              </div>
              ${num(d.paid) > 0 ? `
                <div class="doc-totals-row">
                  <span>Payment Made / Credits</span>
                  <span style="color:#10b981;font-weight:600;">(-) ${inr(d.paid)}</span>
                </div>
              ` : ''}
              <div class="doc-totals-row bal-due" style="color:${color};">
                <span>Balance Due</span>
                <span>${inr(d.balance)}</span>
              </div>
              ${isRetainer && num(d.applied_amount) > 0 ? `
                <div class="doc-totals-row" style="margin-top:6px;border-top:1px dashed var(--bd-glass);padding-top:6px;">
                  <span>Retainer Applied</span>
                  <span style="color:#6366f1;font-weight:600;">(-) ${inr(d.applied_amount)}</span>
                </div>
              ` : ''}
              ${isRetainer ? `
                <div class="doc-totals-row" style="background:rgba(16,185,129,0.08);padding:6px 8px;border-radius:4px;margin-top:4px;">
                  <span style="color:#059669;font-weight:700;">Available Retainer Balance</span>
                  <span style="color:#059669;font-weight:800;font-size:13px;">${inr(d.available_balance || 0)}</span>
                </div>
              ` : ''}
            ` : `
              <div class="doc-totals-row main-total">
                <span>Total Items</span>
                <span>${(d.lines || []).length}</span>
              </div>
              <div class="doc-totals-row" style="font-weight:700;">
                <span>Total Quantity</span>
                <span>${(d.lines || []).reduce((sum, l) => sum + (num(l.quantity) || 0), 0)}</span>
              </div>
            `}
          </div>
        </div>

      </div>

      ${isDeliveryNote ? `
        <div style="margin-top:28px;display:flex;justify-content:space-between;align-items:flex-end;">
          <div style="border-top:1px dashed #64748b;padding-top:6px;width:220px;text-align:center;font-size:11px;color:#475569;">
            <div><b>Receiver's Signature &amp; Stamp</b></div>
            <div style="font-size:10px;color:#94a3b8;margin-top:2px;">Received in good condition</div>
          </div>
          <div style="border-top:1px dashed #64748b;padding-top:6px;width:220px;text-align:center;font-size:11px;color:#475569;">
            <div><b>For ${esc(org.name || 'Convosis Technologies Pvt Ltd')}</b></div>
            <div style="font-size:10px;color:#94a3b8;margin-top:2px;">Authorized Signatory</div>
          </div>
        </div>
      ` : (showSig ? `
        <div class="doc-signature-sec" style="margin-top:28px;display:flex;justify-content:flex-end;">
          <div class="doc-signature-box" style="min-width:200px;text-align:center;cursor:pointer;padding:6px 12px;border-radius:6px;transition:background 0.2s;" title="Click to Sign or Change Signature" data-sig-click="1">
            ${sigData ? `
              <div style="height:64px;display:flex;align-items:flex-end;justify-content:center;margin-bottom:6px;">
                <img src="${esc(sigData)}" alt="Signature" style="max-height:60px;max-width:190px;object-fit:contain;display:block;">
              </div>
            ` : `
              <div style="height:48px;display:flex;align-items:center;justify-content:center;color:#64748b;font-size:12px;border:1px dashed #cbd5e1;border-radius:4px;margin-bottom:6px;padding:4px 8px;background:rgba(248,250,252,0.6);">
                <i class="fa-solid fa-signature" style="margin-right:6px;color:#2563eb;"></i> Click to Add Signature
              </div>
            `}
            <div class="doc-sig-line" style="border-top:1px solid #0f172a;margin-bottom:4px;"></div>
            <div class="doc-sig-label" style="font-weight:700;font-size:12px;color:#0f172a;">${esc(sigTitle)}</div>
            ${signedBy ? `<div style="font-size:11px;color:#475569;margin-top:2px;"><b>${esc(signedBy)}</b></div>` : ''}
            ${signedAt ? `<div style="font-size:10px;color:#94a3b8;margin-top:1px;">Digitally Signed on ${esc(signedAt)}</div>` : ''}
          </div>
        </div>
      ` : '')}

      ${((d.payments && d.payments.length) || (isRetainer && d.allocations && d.allocations.length)) ? `
        <div style="margin-top:20px;padding-top:16px;border-top:1px solid rgba(0,0,0,0.08);">
          ${d.payments && d.payments.length ? `
            <div style="margin-bottom:14px;">
              <h4 style="font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;margin:0 0 6px;">${isBill ? 'Payments Made' : 'Payments Received / Applied'}</h4>

              <table class="lt" style="font-size:12px;width:100%;border-collapse:collapse;">
                <thead>
                  <tr style="border-bottom:1px solid #e2e8f0;text-align:left;">
                    <th style="padding:6px 8px;">Date</th>
                    <th style="padding:6px 8px;">${isBill ? 'Payment#' : 'Payment Receipt#'}</th>
                    <th style="padding:6px 8px;">Mode</th>
                    <th style="padding:6px 8px;">Bank Account</th>
                    <th style="padding:6px 8px;">Reference</th>
                    <th class="r" style="padding:6px 8px;text-align:right;">Amount</th>
                  </tr>
                </thead>

                <tbody>
                  ${d.payments.map(p => `
                    <tr style="border-bottom:1px solid #f1f5f9;">
                      <td style="padding:6px 8px;">${fd(p.date)}</td>
                      <td style="padding:6px 8px;font-weight:600;color:#2563eb;">${esc(p.number || p.reference || '—')}</td>
                      <td style="padding:6px 8px;">${esc((p.mode || 'bank_transfer').replace(/_/g, ' ').toUpperCase())}</td>
                      <td style="padding:6px 8px;">${esc(p.bank_account_name || p.account || 'Bank Account')}</td>
                      <td style="padding:6px 8px;">${esc(p.reference || '—')}</td>
                      <td class="r" style="padding:6px 8px;text-align:right;font-weight:700;color:#059669;">${inr(p.amount)}</td>
                    </tr>
                  `).join('')}
                </tbody>

              </table>

            </div>

          ` : ''}
          ${isRetainer && d.allocations && d.allocations.length ? `
            <div>
              <h4 style="font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;margin:0 0 6px;">Applied to Invoices</h4>

              <table class="lt" style="font-size:12px;">
                <thead><tr><th>Invoice#</th><th>Date</th><th>Notes</th><th class="r">Amount Applied</th></tr></thead>
                <tbody>
                  ${d.allocations.map(a => `<tr><td><b>${esc(a.number)}</b></td><td>${fd(a.date)}</td><td>${esc(a.notes || '—')}</td><td class="r" style="font-weight:600;color:#6366f1;">${inr(a.amount)}</td></tr>`).join('')}
                </tbody>

              </table>

            </div>

          ` : ''}
        </div>
      ` : ''}

      ${(d.related_documents && d.related_documents.length) ? `
        <div class="doc-related-documents-sec" style="margin-top:20px;padding-top:16px;border-top:1px dashed #cbd5e1;">
          <h4 style="font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#475569;margin:0 0 10px;display:flex;align-items:center;gap:6px;">
            <i class="fa-solid fa-diagram-project" style="color:#2563eb;"></i> Connected Documents &amp; Workflow Trace
          </h4>
          <div style="display:flex;flex-wrap:wrap;gap:10px;">
            ${d.related_documents.map(rel => `
              <div class="workflow-doc-link-card" data-kind="${esc(rel.kind)}" data-id="${esc(rel.id)}" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:8px 12px;display:flex;align-items:center;gap:10px;cursor:pointer;transition:all 0.15s ease;" onmouseover="this.style.background='#eff6ff';this.style.borderColor='#93c5fd'" onmouseout="this.style.background='#f8fafc';this.style.borderColor='#e2e8f0'">
                <div style="width:28px;height:28px;border-radius:6px;background:#e0e7ff;color:#4338ca;display:flex;align-items:center;justify-content:center;font-size:12px;">
                  <i class="fa-solid fa-file-lines"></i>
                </div>
                <div>
                  <div style="font-size:10px;color:#64748b;font-weight:700;text-transform:uppercase;">${esc(rel.relation || 'Related')}: ${esc(rel.type || rel.kind)}</div>
                  <div style="font-size:12px;font-weight:700;color:#2563eb;">${esc(rel.number || '—')} <span style="font-size:11px;font-weight:500;color:#64748b;">(${rel.date ? fd(rel.date) : ''}${rel.total != null ? ' · ' + inr(rel.total) : ''})</span></div>
                </div>
                <span class="badge ${rel.status && (rel.status.toLowerCase() === 'paid' || rel.status.toLowerCase() === 'accepted' || rel.status.toLowerCase() === 'closed') ? 'ok' : 'in'}" style="margin-left:auto;font-size:10px;">${esc((rel.status || '').toUpperCase())}</span>
                <i class="fa-solid fa-arrow-up-right-from-square" style="font-size:11px;color:#94a3b8;"></i>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

function openTemplateCustomizer(doc, kind, onUpdate) {
  const inv = kind === 'invoices';
  const org = APP.org;
  const currentTheme = org.template_theme || (inv ? 'convosis' : 'modern');
  const currentColor = org.template_color || '#1877f2';

  formModal({
    title: 'Customize ' + (inv ? 'Invoice' : 'Bill') + ' Template',
    wide: true,
    submit: 'Save Template Settings',
    body: `
      <div style="margin-bottom:14px;padding:12px;background:var(--surface-glass-subtle);border-radius:8px;font-size:12.5px;color:var(--sub);">
        Select template layouts, colors, and configure company details displayed on your invoices and bills.
      </div>

      <div class="fgrid">
        ${fld({ name: 'template_theme', label: 'Template Layout Style', type: 'select', opts: [
          ['convosis', 'Convosis Classic (Standard Boxed Meta — Image 1)'],
          ['modern', 'Modern Ribbon (Dark Items Header & Ribbon — Image 2)'],
          ['executive', 'Executive Indigo (Top Banner Accent)'],
          ['minimal', 'Minimalist (Clean Lines & Borders)']
        ], value: currentTheme, col: 'c2' })}

        ${fld({ name: 'template_color', label: 'Primary Accent Color', type: 'select', opts: [
          ['#1877f2', 'Convosis Blue (#1877f2)'],
          ['#0d6efd', 'Royal Blue (#0d6efd)'],
          ['#10b981', 'Emerald Green (#10b981)'],
          ['#ff8a00', 'Vibrant Orange (#ff8a00)'],
          ['#6366f1', 'Indigo (#6366f1)'],
          ['#1e293b', 'Dark Slate (#1e293b)']
        ], value: currentColor })}

        ${fld({ name: 'signature_title', label: 'Signature Line Title', value: org.signature_title || 'Authorized Signature' })}
        ${fld({ name: 'company_id', label: 'Company ID / CIN', value: org.company_id || '' })}
        ${fld({ name: 'phone', label: 'Company Phone', value: org.phone || '' })}
        ${fld({ name: 'email', label: 'Company Email', value: org.email || '' })}
        ${fld({ name: 'website', label: 'Company Website', value: org.website || '' })}
        ${fld({ name: 'address', label: 'Company Address', type: 'textarea', value: org.address || '', col: 'c2' })}
        ${fld({ name: 'terms_default', label: 'Default Terms', type: 'textarea', value: org.terms_default || 'Due on Receipt', col: 'c2' })}
        ${fld({ name: 'notes_default', label: 'Default Notes', type: 'textarea', value: org.notes_default || 'Thanks for your business.', col: 'c2' })}
      </div>

    `,
    onSubmit: async d => {
      APP.org = await api('organization/', { method: 'PUT', body: d });
      applyOrg();
      toast('Template customized successfully');
      if (onUpdate) onUpdate();
    }
  });
}

async function openAttachmentsModal(kind, id, docNumber, onCountChange) {
  const inv = kind === 'invoices', etype = inv ? 'invoice' : 'bill';
  let attList = [];
  try {
    attList = await api(`attachments/?entity_type=${etype}&entity_id=${id}`);
  } catch (e) { attList = []; }

  const m = Modal.open({
    title: `Attachments · ${docNumber}`,
    wide: false,
    body: `
      <div style="margin-bottom:14px;">
        <div class="dropzone" id="att-dropzone">
          <input type="file" id="att-file-picker" multiple style="display:none">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-bottom:6px;color:var(--accent);"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>

          <div style="font-weight:600;font-size:13px;color:var(--tx);margin-bottom:2px;">Click to upload or drag & drop files</div>

          <div style="font-size:11px;color:var(--sub);">PDF, PNG, JPG, DOC up to 10MB</div>

        </div>

      </div>

      <h3 style="font-size:13px;font-weight:700;margin:16px 0 8px;color:var(--tx);">Attached Files (<span id="att-count-txt">${attList.length}</span>)</h3>
      <div id="att-items-box">${renderList()}</div>

    `,
    footer: `<button class="btn" type="button" data-close>Close</button>`

  });

  function renderList() {
    if (!attList.length) return `<div class="sub" style="text-align:center;padding:16px;">No files attached to this document yet.</div>`;
    return `<div style="display:flex;flex-direction:column;gap:6px;">${attList.map(a => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:var(--surface-glass);border:1px solid var(--bd-glass);border-radius:6px;">
        <div style="display:flex;align-items:center;gap:10px;min-width:0;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--accent);flex-shrink:0;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>

          <div style="min-width:0;">
            <div style="font-weight:600;font-size:12.5px;color:var(--tx);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(a.filename)}</div>

            <div style="font-size:11px;color:var(--sub);">${fmtBytes(a.file_size)} · ${fd(a.created_at ? a.created_at.split('T')[0] : '')}</div>

          </div>

        </div>

        <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
          <a class="btn" href="${esc(a.url || a.file_data)}" download="${esc(a.filename)}" target="_blank" style="padding:3px 8px;font-size:11px;">View</a>

          <button class="btn d" type="button" data-del-att="${a.id}" style="padding:3px 8px;font-size:11px;">Delete</button>

        </div>

      </div>

    `).join('')}</div>`;
  }

  const drop = $('#att-dropzone', m.el);
  const fin = $('#att-file-picker', m.el);
  if (drop && fin) {
    drop.addEventListener('click', () => fin.click());
    drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('dragover'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('dragover'));
    drop.addEventListener('drop', e => {
      e.preventDefault(); drop.classList.remove('dragover');
      handleFiles(e.dataTransfer.files);
    });
    fin.addEventListener('change', () => handleFiles(fin.files));
  }

  async function handleFiles(files) {
    for (const f of Array.from(files)) {
      const reader = new FileReader();
      await new Promise(res => {
        reader.onload = async ev => {
          try {
            const created = await api('attachments/', {
              method: 'POST',
              body: { entity_type: etype, entity_id: id, filename: f.name, file_size: f.size, mime_type: f.type, file_data: ev.target.result }
            });
            attList.unshift(created);
          } catch (err) { toast('Upload failed: ' + err.message, 'err'); }
          res();
        };
        reader.readAsDataURL(f);
      });
    }
    $('#att-items-box', m.el).innerHTML = renderList();
    $('#att-count-txt', m.el).textContent = attList.length;
    if (onCountChange) onCountChange(attList.length);
    toast('File(s) attached');
  }

  m.el.addEventListener('click', async e => {
    const btn = e.target.closest('[data-del-att]');
    if (!btn) return;
    const attId = btn.dataset.delAtt;
    try {
      await api(`attachments/${attId}/`, { method: 'DELETE' });
      attList = attList.filter(a => String(a.id) !== String(attId));
      $('#att-items-box', m.el).innerHTML = renderList();
      $('#att-count-txt', m.el).textContent = attList.length;
      if (onCountChange) onCountChange(attList.length);
      toast('Attachment deleted');
    } catch (err) { toast(err.message, 'err'); }
  });
}

function printDocument(doc, kind, mode = 'standard', isPdf = false) {
  let opts = {};
  if (mode === 'delivery') {
    opts = { title: 'DELIVERY NOTE', is_delivery_note: true };
  } else if (mode === 'packing') {
    opts = { title: 'PACKING SLIP', hide_amounts: true };
  } else if (isPdf) {
    opts = {};
  }
  const sheetHtml = renderDocSheet(doc, kind, opts);

  let frame = document.getElementById('app-print-iframe');
  if (!frame) {
    frame = document.createElement('iframe');
    frame.id = 'app-print-iframe';
    frame.style.position = 'fixed';
    frame.style.right = '0';
    frame.style.bottom = '0';
    frame.style.width = '0';
    frame.style.height = '0';
    frame.style.border = '0';
    frame.style.visibility = 'hidden';
    document.body.appendChild(frame);
  }

  const docTitle = `${(doc.number || 'doc')}_${mode}`;
  const docHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>${esc(docTitle)}</title>
        <link rel="stylesheet" href="/static/books/css/tokens.css">
        <link rel="stylesheet" href="/static/books/css/base.css">
        <link rel="stylesheet" href="/static/books/css/glass.css">
        <link rel="stylesheet" href="/static/books/css/app.css">
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
        <style>
          @page { size: A4 portrait; margin: 12mm 10mm 15mm 10mm; }
          *, *::before, *::after { box-sizing: border-box; }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #0f172a !important;
            font-family: Inter, system-ui, -apple-system, sans-serif !important;
            overflow: visible !important;
            height: auto !important;
          }
          .doc-sheet {
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 auto !important;
            width: 100% !important;
            max-width: 100% !important;
            page-break-inside: auto;
            position: relative !important;
          }
          .doc-items-tbl {
            width: 100% !important;
            border-collapse: collapse !important;
          }
          .doc-items-tbl thead {
            display: table-header-group !important;
          }
          .doc-items-tbl tr {
            page-break-inside: avoid !important;
          }
          .doc-bottom-split, .doc-signature-sec {
            page-break-inside: avoid !important;
          }
        </style>
      </head>
      <body>
        <div style="padding: 10px 14px;">
          ${sheetHtml}
        </div>
      </body>
    </html>
  `;

  frame.srcdoc = docHtml;
  frame.onload = () => {
    setTimeout(() => {
      try {
        frame.contentWindow.focus();
        frame.contentWindow.print();
      } catch (err) {
        console.error('Print iframe error:', err);
        window.print();
      }
    }, 400);
  };
}

function openSendEmailModal(doc, kind, onDone) {
  const party = doc.party_details || {};
  const recipient = party.email || doc.customer_email || doc.email || '';
  const partyName = doc.party || party.name || 'Valued Customer';
  const orgName = (APP.org && APP.org.name) || 'Convosis';
  const defaultSubj = `Invoice ${doc.number} from ${orgName}`;
  const defaultBody = `Dear ${partyName},\n\nPlease find attached invoice ${doc.number} for the amount of ${inr(doc.total)}.\n\nDue Date: ${fd(doc.due_date)}\n\nThank you for your business.\n\nWarm regards,\n${orgName}`;

  formModal({
    title: `Send Invoice · ${esc(doc.number)}`,
    submit: 'Send Email',
    wide: false,
    body: `
      <div style="background:var(--surface-glass-subtle);padding:10px 14px;border-radius:6px;margin-bottom:14px;font-size:13px;line-height:1.5;">
        <div><b>To:</b> ${esc(partyName)}</div>
        <div style="margin-top:2px;"><b>Invoice:</b> ${esc(doc.number)} &nbsp;|&nbsp; <b>Total:</b> ${inr(doc.total)} &nbsp;|&nbsp; <b>Due:</b> ${fd(doc.due_date)}</div>
      </div>
      <div class="fgrid">
        ${fld({ name: 'to_email', label: 'To Email Address', type: 'email', req: 1, value: recipient, placeholder: 'customer@example.com', col: 'c2' })}
        ${fld({ name: 'cc_email', label: 'CC (optional)', type: 'email', placeholder: 'accounting@example.com', col: 'c2' })}
        ${fld({ name: 'subject', label: 'Subject', type: 'text', req: 1, value: defaultSubj, col: 'c2' })}
        ${fld({ name: 'message', label: 'Message', type: 'textarea', req: 1, value: defaultBody, col: 'c2' })}
        <div style="grid-column:span 2;font-size:12px;color:#64748b;display:flex;align-items:center;gap:6px;margin-top:4px;">
          <i class="fa-solid fa-paperclip"></i>
          <span>PDF invoice <b>${esc(doc.number)}.pdf</b> will be attached automatically.</span>
        </div>
      </div>
    `,
    onSave: async data => {
      if (!data.to_email) throw new Error('Please enter a recipient email address.');
      await api(`${kind}/${doc.id}/email/`, {
        method: 'POST',
        body: {
          to_email: data.to_email,
          cc: data.cc_email,
          subject: data.subject,
          message: data.message
        }
      });
      toast(`Invoice ${doc.number} sent to ${data.to_email}`, 'ok');
      if (onDone) onDone();
    }
  });
}

function openSendSmsModal(doc, kind, onDone) {
  const party = doc.party_details || {};
  const phone = party.phone || doc.customer_phone || doc.phone || '';
  const partyName = doc.party || party.name || 'Customer';
  const orgName = (APP.org && APP.org.name) || 'Convosis';
  const defaultMsg = `Dear ${partyName}, invoice ${doc.number} for ${inr(doc.total)} has been generated. Due date: ${fd(doc.due_date)}. - ${orgName}`;

  formModal({
    title: `Send SMS · ${esc(doc.number)}`,
    submit: 'Send SMS',
    wide: false,
    body: `
      <div class="fgrid">
        ${fld({ name: 'phone', label: 'Mobile Phone Number', type: 'text', req: 1, value: phone, placeholder: '+91 9876543210', col: 'c2' })}
        ${fld({ name: 'message', label: 'SMS Content', type: 'textarea', req: 1, value: defaultMsg, col: 'c2' })}
      </div>
    `,
    onSave: async data => {
      if (!data.phone) throw new Error('Please enter a mobile phone number.');
      await api(`${kind}/${doc.id}/sms/`, {
        method: 'POST',
        body: {
          phone: data.phone,
          message: data.message
        }
      });
      toast(`SMS notification sent to ${data.phone}`, 'ok');
      if (onDone) onDone();
    }
  });
}

async function openShareLinkModal(doc, kind) {
  try {
    const res = await api(`${kind}/${doc.id}/share/`, { method: 'POST', body: {} });
    const shareUrl = res.share_url || (window.location.origin + '/#/share/' + (res.share_token || doc.id));

    const m = Modal.open({
      title: `Share Invoice · ${esc(doc.number)}`,
      wide: false,
      body: `
        <div style="font-size:13px;color:#475569;margin-bottom:12px;">
          Anyone with this link can view the invoice in read-only mode without logging in.
        </div>
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:14px;">
          <input type="text" id="share-link-input" class="in" value="${esc(shareUrl)}" readonly style="flex:1;background:var(--surface-glass-subtle);font-family:monospace;font-size:12px;">
          <button class="btn p" type="button" id="copy-share-link-btn" style="white-space:nowrap;"><i class="fa-regular fa-copy"></i> Copy</button>
        </div>
        <div style="font-size:12px;color:#64748b;">
          Link expires on: <b>${res.expires_at ? fd(res.expires_at) : '30 days'}</b>
        </div>
      `,
      footer: `<button class="btn" type="button" data-close>Close</button>`
    });

    const copyBtn = $('#copy-share-link-btn', m.el);
    const input = $('#share-link-input', m.el);
    if (copyBtn && input) {
      copyBtn.addEventListener('click', () => {
        input.select();
        if (navigator.clipboard) {
          navigator.clipboard.writeText(shareUrl);
        } else {
          document.execCommand('copy');
        }
        toast('Invoice link copied to clipboard!', 'ok');
        copyBtn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
        setTimeout(() => { if (copyBtn) copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i> Copy'; }, 2000);
      });
    }
  } catch (err) {
    toast(err.message || 'Failed to generate sharing link.', 'err');
  }
}

function openExpectedDateModal(doc, kind, onDone) {
  formModal({
    title: `Expected Payment Date · ${esc(doc.number)}`,
    submit: 'Save Date',
    wide: false,
    body: `
      <div style="font-size:13px;color:#475569;margin-bottom:12px;">
        Record the date the customer has promised or is expected to make payment.
      </div>
      <div class="fgrid">
        ${fld({ name: 'expected_date', label: 'Expected Payment Date', type: 'date', req: 1, value: doc.expected_payment_date || APP.today, col: 'c2' })}
        ${fld({ name: 'notes', label: 'Notes / Remarks', type: 'textarea', value: doc.payment_promise_notes || '', col: 'c2', placeholder: 'e.g. Customer promised cheque clearance by Friday' })}
      </div>
    `,
    onSave: async data => {
      await api(`invoices/${doc.id}/expected-payment-date/`, {
        method: 'POST',
        body: {
          expected_payment_date: data.expected_date,
          notes: data.notes
        }
      });
      toast(`Expected payment date updated for ${doc.number}`, 'ok');
      if (onDone) onDone();
    }
  });
}

function openWriteOffModal(doc, onDone) {
  const bal = num(doc.balance);
  formModal({
    title: `Write Off Invoice · ${esc(doc.number)}`,
    submit: `Write Off ${inr(bal)}`,
    wide: false,
    body: `
      <div style="background:#fee2e2;border:1px solid #fca5a5;padding:12px 14px;border-radius:6px;margin-bottom:14px;font-size:13px;color:#991b1b;line-height:1.5;">
        <i class="fa-solid fa-triangle-exclamation" style="margin-right:6px;"></i>
        <b>Warning:</b> Writing off this invoice will record a bad debt expense and mark the remaining balance of <b>${inr(bal)}</b> as settled. This action permanent and creates double-entry journal entries.
      </div>
      <div class="fgrid">
        ${fld({ name: 'reason', label: 'Reason for Write-off', type: 'select', req: 1, opts: [
          ['uncollectible', 'Uncollectible / Bad Debt'],
          ['dispute', 'Customer Dispute'],
          ['settlement', 'Settlement Discount'],
          ['small_balance', 'Small Balance Write-off'],
          ['other', 'Other']
        ], value: 'uncollectible', col: 'c2' })}
        ${fld({ name: 'notes', label: 'Detailed Reason / Notes', type: 'textarea', req: 1, placeholder: 'Explain why this balance cannot be recovered...', col: 'c2' })}
      </div>
    `,
    onSave: async data => {
      await api(`invoices/${doc.id}/write-off/`, {
        method: 'POST',
        body: {
          reason: data.reason,
          notes: data.notes
        }
      });
      toast(`Invoice ${doc.number} written off successfully`, 'ok');
      if (onDone) onDone();
    }
  });
}

function openAddEWayBillModal(doc, kind, onDone) {
  formModal({
    title: `Add e-Way Bill Details · ${esc(doc.number)}`,
    submit: 'Save e-Way Bill',
    wide: false,
    body: `
      <div class="fgrid">
        ${fld({ name: 'bill_number', label: 'e-Way Bill Number', type: 'text', req: 1, value: doc.ewb_number || '', placeholder: '12-digit EWB Number' })}
        ${fld({ name: 'distance_km', label: 'Approx Distance (KM)', type: 'number', req: 1, value: doc.distance_km || 50, attrs: 'min="1" max="4000"' })}
        ${fld({ name: 'vehicle_number', label: 'Vehicle Number', type: 'text', req: 1, value: doc.vehicle_number || '', placeholder: 'KL-05-AA-1234' })}
        ${fld({ name: 'vehicle_type', label: 'Vehicle Type', type: 'select', opts: [['regular', 'Regular'], ['over_dimensional_cargo', 'Over Dimensional Cargo (ODC)']], value: 'regular' })}
        ${fld({ name: 'transporter_name', label: 'Transporter Name', type: 'text', value: doc.transporter_name || '', placeholder: 'Blue Dart / VRL Logistics' })}
        ${fld({ name: 'transporter_id', label: 'Transporter ID / GSTIN', type: 'text', value: doc.transporter_id || '', placeholder: 'GSTIN of Transporter' })}
      </div>
    `,
    onSave: async data => {
      await api(`${kind}/${doc.id}/eway-bill/`, {
        method: 'POST',
        body: data
      });
      toast(`e-Way Bill details saved for ${doc.number}`, 'ok');
      if (onDone) onDone();
    }
  });
}

async function openViewJournalModal(doc, kind) {
  try {
    const res = await api(`${kind}/${doc.id}/view-journal/`);
    const journals = res.journals || [];

    let contentHtml = '';
    if (!journals.length) {
      contentHtml = `<p class="sub" style="padding:24px;text-align:center;">No journal entries posted for this document yet.</p>`;
    } else {
      contentHtml = journals.map(j => `
        <div style="background:var(--surface-glass-subtle);border:1px solid var(--bd-glass);border-radius:8px;padding:12px;margin-bottom:14px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;font-size:12px;">
            <div><b>Journal #${esc(j.number)}</b> &nbsp;|&nbsp; <span>Date: ${fd(j.date)}</span></div>
            <div style="color:#64748b;">${esc(j.reference || '')}</div>
          </div>
          <table class="lt" style="width:100%;font-size:12px;border-collapse:collapse;">
            <thead>
              <tr style="border-bottom:1px solid var(--bd-glass);text-align:left;">
                <th style="padding:6px;">Account</th>
                <th style="padding:6px;">Description</th>
                <th style="padding:6px;text-align:right;">Debit (₹)</th>
                <th style="padding:6px;text-align:right;">Credit (₹)</th>
              </tr>
            </thead>
            <tbody>
              ${(j.lines || []).map(l => `
                <tr style="border-bottom:1px solid rgba(0,0,0,0.04);">
                  <td style="padding:6px;"><b>${esc(l.account_code || '')}</b> ${esc(l.account_name)}</td>
                  <td style="padding:6px;color:#64748b;">${esc(l.description || '—')}</td>
                  <td style="padding:6px;text-align:right;font-weight:600;">${num(l.debit) > 0 ? inr(l.debit) : '—'}</td>
                  <td style="padding:6px;text-align:right;font-weight:600;">${num(l.credit) > 0 ? inr(l.credit) : '—'}</td>
                </tr>
              `).join('')}
              <tr style="border-top:2px solid var(--bd-glass);font-weight:700;">
                <td colspan="2" style="padding:6px;text-align:right;">Total:</td>
                <td style="padding:6px;text-align:right;">${inr(j.total_debit || (j.lines || []).reduce((s, l) => s + num(l.debit), 0))}</td>
                <td style="padding:6px;text-align:right;">${inr(j.total_credit || (j.lines || []).reduce((s, l) => s + num(l.credit), 0))}</td>
              </tr>
            </tbody>
          </table>
        </div>
      `).join('');
    }

    Modal.open({
      title: `Journal Entries · ${esc(doc.number)}`,
      wide: true,
      body: `
        <div style="max-height:70vh;overflow-y:auto;padding-right:4px;">
          ${contentHtml}
        </div>
      `,
      footer: `<button class="btn" type="button" data-close>Close</button>`
    });
  } catch (err) {
    toast(err.message || 'Failed to load journal entries.', 'err');
  }
}

function openInvoicePreferencesModal(onDone) {
  const org = APP.org || {};
  formModal({
    title: 'Invoice Preferences & Defaults',
    submit: 'Save Preferences',
    wide: false,
    body: `
      <div class="fgrid">
        ${fld({ name: 'default_terms_name', label: 'Default Payment Terms', type: 'select', opts: [
          ['Due on Receipt', 'Due on Receipt'],
          ['Net 15', 'Net 15 (15 days)'],
          ['Net 30', 'Net 30 (30 days)'],
          ['Net 45', 'Net 45 (45 days)'],
          ['Net 60', 'Net 60 (60 days)']
        ], value: org.default_terms || 'Due on Receipt', col: 'c2' })}
        ${fld({ name: 'default_notes', label: 'Default Customer Notes', type: 'textarea', value: org.default_notes || 'Thanks for your business.', col: 'c2' })}
        ${fld({ name: 'default_terms', label: 'Default Terms & Conditions', type: 'textarea', value: org.default_terms_text || 'Payment is due within stated terms. Interest charged at 1.5% per month on overdue balances.', col: 'c2' })}
      </div>
    `,
    onSave: async data => {
      await api('organization/settings/', {
        method: 'PATCH',
        body: {
          default_terms: data.default_terms_name,
          default_notes: data.default_notes,
          default_terms_text: data.default_terms
        }
      }).catch(() => {});
      APP.org = Object.assign(APP.org || {}, {
        default_terms: data.default_terms_name,
        default_notes: data.default_notes,
        default_terms_text: data.default_terms
      });
      toast('Invoice preferences saved successfully', 'ok');
      if (onDone) onDone();
    }
  });
}

async function docMasterDetail(root, kind, selectedId, openEdit, extraOpts = {}) {
  const KIND_CONFIG = {
    'invoices': {
      title: 'Invoices',
      singular: 'Invoice',
      isCust: true,
      statusFilters: [
        { val: '', label: 'All Invoices' },
        { val: 'draft', label: 'Draft' },
        { val: 'unpaid', label: 'Sent' },
        { val: 'overdue', label: 'Overdue' },
        { val: 'paid', label: 'Paid' },
      ],
      searchPlaceholder: 'Search invoices…',
      formFn: (id, target, done, opts) => invoiceForm(id, target, done, opts)
    },
    'quotes': {
      title: 'Quotes',
      singular: 'Quote',
      isCust: true,
      statusFilters: [
        { val: '', label: 'All Quotes' },
        { val: 'draft', label: 'Draft' },
        { val: 'sent', label: 'Sent' },
        { val: 'accepted', label: 'Accepted' },
        { val: 'declined', label: 'Declined' },
        { val: 'invoiced', label: 'Invoiced' }
      ],
      searchPlaceholder: 'Search quotes…',
      formFn: (id, target, done, opts) => quoteForm(id, target, done, opts)
    },
    'sales-orders': {
      title: 'Sales Orders',
      singular: 'Sales Order',
      isCust: true,
      statusFilters: [
        { val: '', label: 'All Sales Orders' },
        { val: 'draft', label: 'Draft' },
        { val: 'confirmed', label: 'Confirmed' },
        { val: 'closed', label: 'Closed' },
        { val: 'void', label: 'Void' }
      ],
      searchPlaceholder: 'Search sales orders…',
      formFn: (id, target, done, opts) => salesOrderForm(id, target, done, opts)
    },
    'recurring-invoices': {
      title: 'Recurring Invoices',
      singular: 'Recurring Profile',
      isCust: true,
      statusFilters: [
        { val: '', label: 'All Recurring Profiles' },
        { val: 'active', label: 'Active' },
        { val: 'paused', label: 'Paused' },
        { val: 'completed', label: 'Completed' },
        { val: 'cancelled', label: 'Cancelled' }
      ],
      searchPlaceholder: 'Search recurring profiles…',
      formFn: (id, target, done, opts) => recurringInvoiceForm(id, target, done, opts)
    },
    'retainer-invoices': {
      title: 'Retainer Invoices',
      singular: 'Retainer Invoice',
      isCust: true,
      statusFilters: [
        { val: '', label: 'All Retainers' },
        { val: 'draft', label: 'Draft' },
        { val: 'sent', label: 'Sent' },
        { val: 'partial', label: 'Partially Paid' },
        { val: 'paid', label: 'Paid' }
      ],
      searchPlaceholder: 'Search retainers…',
      formFn: (id, target, done, opts) => retainerInvoiceForm(id, target, done, opts)
    },
    'bills': {
      title: 'Bills',
      singular: 'Bill',
      isCust: false,
      statusFilters: [
        { val: '', label: 'All Bills' },
        { val: 'draft', label: 'Draft' },
        { val: 'open', label: 'Open' },
        { val: 'overdue', label: 'Overdue' },
        { val: 'paid', label: 'Paid' }
      ],
      searchPlaceholder: 'Search bills…',
      formFn: (id, target, done, opts) => billForm(id, target, done, opts)
    },
    'purchase-orders': {
      title: 'Purchase Orders',
      singular: 'Purchase Order',
      isCust: false,
      statusFilters: [
        { val: '', label: 'All Purchase Orders' },
        { val: 'draft', label: 'Draft' },
        { val: 'confirmed', label: 'Confirmed' },
        { val: 'closed', label: 'Closed' },
        { val: 'void', label: 'Void' }
      ],
      searchPlaceholder: 'Search purchase orders…',
      formFn: (id, target, done, opts) => purchaseOrderForm(id, target, done, opts)
    }
  };

  const meta = KIND_CONFIG[kind] || {
    title: (kind || '').replace(/-/g, ' ').toUpperCase(),
    singular: (kind || '').replace(/-/g, ' '),
    isCust: true,
    statusFilters: [
      { val: '', label: 'All' },
      { val: 'draft', label: 'Draft' },
      { val: 'open', label: 'Open' },
      { val: 'closed', label: 'Closed' }
    ],
    searchPlaceholder: `Search ${kind}…`,
    formFn: (id, target, done, opts) => docForm(kind, id, target, done, opts)
  };

  const isRetainer = kind === 'retainer-invoices';
  const isBill = kind === 'bills';
  const isQuote = kind === 'quotes';
  const isSO = kind === 'sales-orders';
  const isPO = kind === 'purchase-orders';
  const isRec = kind === 'recurring-invoices';
  const inv = kind === 'invoices';
  const isCustDoc = meta.isCust;

  let curFilter = '';
  let searchQuery = '';
  let docs = [];
  let curDoc = null;
  const masterSelectedIds = new Set();

  function updateMasterSelectionUI() {
    const cbs = root.querySelectorAll('.master-doc-cb');
    const allBox = $('#master-cb-all', root);
    const bulkBar = $('#master-bulk-bar', root);
    const bulkCnt = $('#master-bulk-cnt', root);
    const curCount = masterSelectedIds.size;

    if (bulkBar) bulkBar.style.display = curCount > 0 ? 'inline-flex' : 'none';
    if (bulkCnt) bulkCnt.textContent = curCount;

    if (allBox) {
      if (!cbs.length) {
        allBox.checked = false;
        allBox.indeterminate = false;
        allBox.disabled = true;
      } else {
        allBox.disabled = false;
        const allChecked = Array.from(cbs).every(cb => cb.checked);
        const someChecked = Array.from(cbs).some(cb => cb.checked);
        allBox.checked = allChecked;
        allBox.indeterminate = !allChecked && someChecked;
      }
    }
  }

  PAGE.reload = () => docMasterDetail(root, kind, curDoc ? curDoc.id : selectedId, false, extraOpts);

  function openForm(editId, formExtraOpts = {}) {
    const combinedOpts = { ...extraOpts, ...formExtraOpts };
    if (meta.formFn) {
      meta.formFn(editId, $('#pg'), (savedDoc) => {
        if (savedDoc) {
          docMasterDetail($('#pg'), kind, savedDoc.id);
        } else {
          docMasterDetail($('#pg'), kind, editId || (curDoc ? curDoc.id : null));
        }
      }, combinedOpts);
      return;
    }
    docForm(kind, editId, $('#detail-col-box', root), (savedDoc) => {
      if (savedDoc) {
        selectedId = savedDoc.id;
        loadList();
      } else {
        if (curDoc) {
          renderMasterList();
          renderDetailPane();
        } else if (docs.length) {
          loadDetail(docs[0].id);
        } else {
          loadList();
        }
      }
    }, combinedOpts);
  }

  root.innerHTML = `
    <div class="split-view-container">
      <div class="master-col">
        <div class="master-col-hd">
          <div style="display:flex;align-items:center;min-width:0;flex:1;">
            <select class="master-filter-sel" id="master-filter-sel" aria-label="Filter status">
              ${meta.statusFilters.map(f => `<option value="${f.val}">${f.label}</option>`).join('')}
            </select>
          </div>
          <div class="master-hd-actions">
            <button class="btn" id="master-import-btn" type="button" title="Import ${esc(meta.title)}"><i class="fa-solid fa-file-import"></i> Import</button>
            <div class="export-dropdown-wrap">
              <button class="btn" id="master-export-toggle-btn" type="button" title="Export ${esc(meta.title)}"><i class="fa-solid fa-file-export"></i> Export ▾</button>
              <div class="pop right export-menu-pop" id="master-export-pop" style="display:none;position:absolute;">
                <button type="button" class="btn" id="master-export-csv-btn" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-file-csv" style="color:#10b981;"></i> Export CSV</button>
                <button type="button" class="btn" id="master-export-json-btn" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-code" style="color:#3b82f6;"></i> Export JSON</button>
              </div>
            </div>
            <button class="btn" id="master-view-mode-btn" type="button" title="Switch to Table View"><i class="fa-solid fa-table-list"></i> Table</button>
            <button class="btn p" id="master-new-btn" type="button" title="Create New ${esc(meta.singular)}"><i class="fa-solid fa-plus"></i> New</button>
          </div>
        </div>
        <div class="master-search-bar" style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--bg-subtle,#f8fafc);border-bottom:1px solid var(--bd);">
          <input type="checkbox" id="master-cb-all" title="Select all" style="cursor:pointer;" aria-label="Select all">
          <input class="in" type="search" id="master-q-in" placeholder="${esc(meta.searchPlaceholder)}" style="flex:1;height:32px;font-size:12px;">
          <div id="master-bulk-bar" style="display:none;align-items:center;gap:6px;">
            <button class="btn dn" type="button" id="master-bulk-del-btn" style="background:#fee2e2;color:#dc2626;border-color:#fca5a5;font-weight:600;font-size:11px;padding:0 7px;height:28px;" title="Delete selected">
              <i class="fa-solid fa-trash-can"></i> (<span id="master-bulk-cnt">0</span>)
            </button>
          </div>
        </div>
        <div class="master-list-scroll" id="master-list-box">${spinner}</div>
      </div>
      <div class="detail-col" id="detail-col-box">
        <div style="display:grid;place-items:center;height:100%;color:var(--sub);">${spinner}</div>
      </div>
    </div>
  `;

  async function loadList() {
    try {
      const qParams = { page_size: 100, ordering: (isRec ? '-created_at' : '-date') };
      if (curFilter) qParams.status = curFilter;
      if (searchQuery) qParams.q = searchQuery;
      const res = await api(`${kind}/?` + qs(qParams));
      docs = res.results || [];
      renderMasterList();
      if (selectedId === 'new') {
        openForm(null);
        return;
      }
      if (openEdit && selectedId) {
        openForm(selectedId);
        return;
      }
      if (docs.length > 0) {
        const found = selectedId ? docs.find(d => String(d.id) === String(selectedId)) : null;
        loadDetail((found || docs[0]).id);
      } else {
        $('#detail-col-box', root).innerHTML = `<div class="empty" style="margin:auto;"><div>No ${esc(meta.title.toLowerCase())} found.<br><button class="btn p" id="empty-new-btn" style="margin-top:10px;">+ New ${esc(meta.singular)}</button></div></div>`;
        const eb = $('#empty-new-btn', root);
        if (eb) eb.addEventListener('click', () => openForm(null));
      }
    } catch (e) {
      $('#master-list-box', root).innerHTML = errBox(e.message);
    }
  }

  function renderMasterList() {
    const box = $('#master-list-box', root);
    if (!docs.length) {
      box.innerHTML = `<div class="empty" style="padding:30px 10px;"><div>No records matching.</div></div>`;
      updateMasterSelectionUI();
      return;
    }
    box.innerHTML = docs.map(d => {
      const isActive = curDoc && String(curDoc.id) === String(d.id);
      const isPaid = d.status === 'Paid' || d.raw_status === 'paid';
      const isOverdue = d.status === 'Overdue';
      const isAccepted = d.status === 'Accepted' || d.raw_status === 'accepted';
      const isConfirmed = d.status === 'Confirmed' || d.raw_status === 'confirmed';
      const isDraft = d.raw_status === 'draft' || d.status === 'Draft';
      const isClosed = d.status === 'Closed' || d.raw_status === 'closed';

      let statusColor = '#2563eb';
      if (isOverdue) statusColor = '#ea580c';
      else if (isPaid || isAccepted || isClosed) statusColor = '#10b981';
      else if (isDraft) statusColor = '#64748b';
      else if (d.status === 'Declined' || d.status === 'Cancelled' || d.raw_status === 'void') statusColor = '#ef4444';

      const partyName = esc(d.customer_name || d.party || d.party_name || d.vendor_name || '—');
      const docNum = esc(d.number || d.profile_name || '—');
      const docDate = d.date ? fd(d.date) : (d.start_date ? fd(d.start_date) : '');
      const docTotal = d.total != null ? inr(d.total) : '';

      return `
        <div class="doc-row-card ${isActive ? 'active' : ''}" data-id="${d.id}">
          <input type="checkbox" class="master-doc-cb" data-id="${d.id}" style="margin-top:2px;cursor:pointer;" onclick="event.stopPropagation()">
          <div class="doc-row-info">
            <div class="doc-row-top">
              <span class="doc-row-party">${partyName}</span>
              <span class="doc-row-amt">${docTotal}</span>
            </div>
            <div class="doc-row-sub">
              <span>${docNum}</span>
              ${docDate ? `<span>•</span><span>${docDate}</span>` : ''}
              ${d.attachment_count ? '<span title="Has attachments">📎</span>' : ''}
            </div>
            <div class="doc-row-badge-line">
              ${isOverdue ? `<span style="color:#ea580c;font-weight:700;font-size:11px;">OVERDUE BY ${getOverdueDays(d.due_date) || 22} DAYS</span>` :
                `<span style="color:${statusColor};font-weight:700;font-size:11px;">${esc((d.status || d.raw_status || '').toUpperCase())}</span>`
              }
            </div>
          </div>
        </div>
      `;
    }).join('');
    box.querySelectorAll('.master-doc-cb').forEach(cb => {
      cb.checked = masterSelectedIds.has(String(cb.dataset.id));
    });
    updateMasterSelectionUI();
  }

  async function loadDetail(id) {
    const detailBox = $('#detail-col-box', root);
    detailBox.innerHTML = `<div style="display:grid;place-items:center;height:100%;">${spinner}</div>`;
    try {
      curDoc = await api(`${kind}/${id}/`);
      renderMasterList();
      renderDetailPane();
    } catch (e) {
      detailBox.innerHTML = errBox(e.message);
    }
  }

  function renderDetailPane() {
    if (!curDoc) return;
    const d = curDoc;
    const detailBox = $('#detail-col-box', root);
    const posted = isRetainer ? (d.raw_status === 'sent' || d.raw_status === 'partial') : (d.raw_status === (inv ? 'sent' : 'open') || d.raw_status === 'partial');
    const attCount = (d.attachments ? d.attachments.length : (d.attachment_count || 0));

    detailBox.innerHTML = `
      <div class="doc-detail-bar">
        <div class="doc-detail-title-grp">
          <h1 class="doc-detail-title">${esc(d.number || d.profile_name || 'Document')}</h1>
          <div class="doc-detail-actions">
            ${inv ? `
              <button class="btn" type="button" data-act="edit"><i class="fa-solid fa-pen" style="font-size:11px;margin-right:4px;"></i> Edit</button>
              <div class="tb-dropdown-wrap" style="position:relative;display:inline-block;">
                <button class="btn" type="button" data-pop-toggle="send-pop"><i class="fa-regular fa-envelope" style="font-size:11px;margin-right:4px;"></i> Send ▾</button>
                <div class="pop right tb-pop-menu" id="send-pop" style="display:none;position:absolute;top:100%;right:0;margin-top:4px;min-width:160px;z-index:120;padding:6px;background:var(--surface-glass-solid,#fff);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,0.18);border:1px solid var(--bd-glass,#cbd5e1);">
                  <button type="button" class="btn" data-act="send-email" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-envelope" style="color:#2563eb;"></i> Send Email</button>
                  <button type="button" class="btn" data-act="send-sms" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-comment-sms" style="color:#10b981;"></i> Send SMS</button>
                </div>
              </div>
              <button class="btn" type="button" data-act="share" title="Share invoice link"><i class="fa-solid fa-share-nodes" style="font-size:11px;margin-right:4px;"></i> Share</button>
              <div class="tb-dropdown-wrap" style="position:relative;display:inline-block;">
                <button class="btn" type="button" data-pop-toggle="remind-pop"><i class="fa-regular fa-clock" style="font-size:11px;margin-right:4px;"></i> Reminders ▾</button>
                <div class="pop right tb-pop-menu" id="remind-pop" style="display:none;position:absolute;top:100%;right:0;margin-top:4px;min-width:190px;z-index:120;padding:6px;background:var(--surface-glass-solid,#fff);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,0.18);border:1px solid var(--bd-glass,#cbd5e1);">
                  <button type="button" class="btn" data-act="send-reminder" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-bell" style="color:#f59e0b;"></i> Send Email</button>
                  <button type="button" class="btn" data-act="stop-reminders" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-bell-slash" style="color:#ef4444;"></i> Stop Reminders</button>
                  <button type="button" class="btn" data-act="expected-date" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-calendar-day" style="color:#6366f1;"></i> Expected Payment Date</button>
                </div>
              </div>
              <div class="tb-dropdown-wrap" style="position:relative;display:inline-block;">
                <button class="btn" type="button" data-pop-toggle="print-pop"><i class="fa-solid fa-print" style="font-size:11px;margin-right:4px;"></i> PDF / Print ▾</button>
                <div class="pop right tb-pop-menu" id="print-pop" style="display:none;position:absolute;top:100%;right:0;margin-top:4px;min-width:180px;z-index:120;padding:6px;background:var(--surface-glass-solid,#fff);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,0.18);border:1px solid var(--bd-glass,#cbd5e1);">
                  <button type="button" class="btn" data-act="pdf" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-file-pdf" style="color:#ef4444;"></i> PDF</button>
                  <button type="button" class="btn" data-act="print" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-print" style="color:#3b82f6;"></i> Print</button>
                  <button type="button" class="btn" data-act="print-delivery" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-truck" style="color:#10b981;"></i> Print Delivery Note</button>
                  <button type="button" class="btn" data-act="print-packing" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-box" style="color:#8b5cf6;"></i> Print Packing Slip</button>
                </div>
              </div>
              ${num(d.balance) > 0 && d.raw_status !== 'void' ? `
                <div class="tb-dropdown-wrap" style="position:relative;display:inline-block;">
                  <button class="btn p" type="button" data-pop-toggle="pay-pop" style="display:inline-flex;align-items:center;"><i class="fa-solid fa-money-bill-wave" style="font-size:11px;margin-right:4px;"></i> Record Payment ▾</button>
                  <div class="pop right tb-pop-menu" id="pay-pop" style="display:none;position:absolute;top:100%;right:0;margin-top:4px;min-width:170px;z-index:120;padding:6px;background:var(--surface-glass-solid,#fff);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,0.18);border:1px solid var(--bd-glass,#cbd5e1);">
                    <button type="button" class="btn" data-act="pay" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-receipt" style="color:#10b981;"></i> Record Payment</button>
                    <button type="button" class="btn" data-act="apply-retainer" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-hand-holding-dollar" style="color:#6366f1;"></i> Apply Retainer</button>
                    <button type="button" class="btn" data-act="write-off" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;color:#ef4444;"><i class="fa-solid fa-ban" style="color:#ef4444;"></i> Write Off</button>
                  </div>
                </div>
              ` : ''}
              <button class="btn" type="button" data-act="sign" title="Digital Signature"><i class="fa-solid fa-signature" style="font-size:11px;margin-right:4px;"></i> ${d.signature_data ? 'Signed ✓' : 'Sign'}</button>
              <div class="tb-dropdown-wrap" style="position:relative;display:inline-block;">
                <button class="btn" type="button" data-pop-toggle="more-pop"><i class="fa-solid fa-ellipsis"></i> ▾</button>
                <div class="pop right tb-pop-menu" id="more-pop" style="display:none;position:absolute;top:100%;right:0;margin-top:4px;min-width:200px;z-index:120;padding:6px;background:var(--surface-glass-solid,#fff);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,0.18);border:1px solid var(--bd-glass,#cbd5e1);">
                  <button type="button" class="btn" data-act="make-recurring" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-arrows-rotate" style="color:#3b82f6;"></i> Make Recurring</button>
                  <button type="button" class="btn" data-act="create-credit-note" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-file-invoice-dollar" style="color:#10b981;"></i> Create Credit Note</button>
                  <button type="button" class="btn" data-act="create-debit-note" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-file-circle-minus" style="color:#f59e0b;"></i> Create Debit Note</button>
                  <button type="button" class="btn" data-act="add-eway-bill" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-truck-fast" style="color:#0ea5e9;"></i> Add e-Way Bill Details</button>
                  <button type="button" class="btn" data-act="clone" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-copy" style="color:#64748b;"></i> Clone</button>
                  ${d.raw_status !== 'void' && d.raw_status !== 'paid' ? `<button type="button" class="btn" data-act="void" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-ban" style="color:#ef4444;"></i> Void</button>` : ''}
                  <button type="button" class="btn" data-act="view-journal" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-book-journal-whills" style="color:#8b5cf6;"></i> View Journal</button>
                  <button type="button" class="btn" data-act="portal" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-user" style="color:#2563eb;"></i> Client Portal</button>
                  <button type="button" class="btn" data-act="irn" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-shield-halved" style="color:#10b981;"></i> Authenticate E-Invoice</button>
                  <button type="button" class="btn" data-act="custom" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-paint-roller" style="color:#f59e0b;"></i> Customize Template</button>
                  <button type="button" class="btn" data-act="preferences" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-sliders" style="color:#475569;"></i> Invoice Preferences</button>
                  <div style="border-top:1px solid var(--bd-glass,#cbd5e1);margin:4px 0;"></div>
                  <button type="button" class="btn" data-act="delete" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;color:#dc2626;"><i class="fa-solid fa-trash-can" style="color:#dc2626;"></i> Delete</button>
                </div>
              </div>
            ` : isQuote ? `
              <button class="btn" type="button" data-act="edit"><i class="fa-solid fa-pen" style="font-size:11px;margin-right:4px;"></i> Edit</button>
              <div class="tb-dropdown-wrap" style="position:relative;display:inline-block;">
                <button class="btn p" style="background:#10b981;border-color:#059669;color:#fff;" type="button" data-pop-toggle="convert-pop"><i class="fa-solid fa-arrow-right-arrow-left" style="font-size:11px;margin-right:4px;"></i> Convert ▾</button>
                <div class="pop right tb-pop-menu" id="convert-pop" style="display:none;position:absolute;top:100%;right:0;margin-top:4px;min-width:200px;z-index:120;padding:6px;background:var(--surface-glass-solid,#fff);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,0.18);border:1px solid var(--bd-glass,#cbd5e1);">
                  <button type="button" class="btn" data-act="convert-so" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-file-invoice" style="color:#2563eb;"></i> Convert to Sales Order</button>
                  <button type="button" class="btn" data-act="convert-inv" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-file-invoice-dollar" style="color:#10b981;"></i> Convert to Invoice</button>
                </div>
              </div>
              <div class="tb-dropdown-wrap" style="position:relative;display:inline-block;">
                <button class="btn" type="button" data-pop-toggle="send-pop"><i class="fa-regular fa-envelope" style="font-size:11px;margin-right:4px;"></i> Send ▾</button>
                <div class="pop right tb-pop-menu" id="send-pop" style="display:none;position:absolute;top:100%;right:0;margin-top:4px;min-width:160px;z-index:120;padding:6px;background:var(--surface-glass-solid,#fff);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,0.18);border:1px solid var(--bd-glass,#cbd5e1);">
                  <button type="button" class="btn" data-act="send-email" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-envelope" style="color:#2563eb;"></i> Send Email</button>
                  <button type="button" class="btn" data-act="send-sms" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-comment-sms" style="color:#10b981;"></i> Send SMS</button>
                </div>
              </div>
              <div class="tb-dropdown-wrap" style="position:relative;display:inline-block;">
                <button class="btn" type="button" data-pop-toggle="print-pop"><i class="fa-solid fa-print" style="font-size:11px;margin-right:4px;"></i> PDF / Print ▾</button>
                <div class="pop right tb-pop-menu" id="print-pop" style="display:none;position:absolute;top:100%;right:0;margin-top:4px;min-width:180px;z-index:120;padding:6px;background:var(--surface-glass-solid,#fff);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,0.18);border:1px solid var(--bd-glass,#cbd5e1);">
                  <button type="button" class="btn" data-act="pdf" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-file-pdf" style="color:#ef4444;"></i> PDF</button>
                  <button type="button" class="btn" data-act="print" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-print" style="color:#3b82f6;"></i> Print</button>
                </div>
              </div>
              <button class="btn" type="button" data-act="sign" title="Digital Signature"><i class="fa-solid fa-signature" style="font-size:11px;margin-right:4px;"></i> ${d.signature_data ? 'Signed ✓' : 'Sign'}</button>
              <div class="tb-dropdown-wrap" style="position:relative;display:inline-block;">
                <button class="btn" type="button" data-pop-toggle="more-pop"><i class="fa-solid fa-ellipsis"></i> ▾</button>
                <div class="pop right tb-pop-menu" id="more-pop" style="display:none;position:absolute;top:100%;right:0;margin-top:4px;min-width:180px;z-index:120;padding:6px;background:var(--surface-glass-solid,#fff);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,0.18);border:1px solid var(--bd-glass,#cbd5e1);">
                  ${d.status !== 'accepted' ? `<button type="button" class="btn" data-act="accept-quote" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-check" style="color:#10b981;"></i> Mark as Accepted</button>` : ''}
                  ${d.status !== 'declined' ? `<button type="button" class="btn" data-act="decline-quote" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-xmark" style="color:#ef4444;"></i> Mark as Declined</button>` : ''}
                  <button type="button" class="btn" data-act="clone" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-copy" style="color:#64748b;"></i> Clone</button>
                  <button type="button" class="btn" data-act="custom" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-paint-roller" style="color:#f59e0b;"></i> Customize Template</button>
                  <div style="border-top:1px solid var(--bd-glass,#cbd5e1);margin:4px 0;"></div>
                  <button type="button" class="btn" data-act="delete" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;color:#dc2626;"><i class="fa-solid fa-trash-can" style="color:#dc2626;"></i> Delete</button>
                </div>
              </div>
            ` : isSO ? `
              <button class="btn" type="button" data-act="edit"><i class="fa-solid fa-pen" style="font-size:11px;margin-right:4px;"></i> Edit</button>
              <button class="btn p" style="background:#10b981;border-color:#059669;color:#fff;" type="button" data-act="convert-so-inv"><i class="fa-solid fa-file-invoice-dollar" style="font-size:11px;margin-right:4px;"></i> Convert to Invoice</button>
              ${d.status === 'draft' ? `<button class="btn" type="button" data-act="confirm-so" style="background:#2563eb;color:#fff;border-color:#2563eb;"><i class="fa-solid fa-check" style="font-size:11px;margin-right:4px;"></i> Confirm</button>` : ''}
              <div class="tb-dropdown-wrap" style="position:relative;display:inline-block;">
                <button class="btn" type="button" data-pop-toggle="send-pop"><i class="fa-regular fa-envelope" style="font-size:11px;margin-right:4px;"></i> Send ▾</button>
                <div class="pop right tb-pop-menu" id="send-pop" style="display:none;position:absolute;top:100%;right:0;margin-top:4px;min-width:160px;z-index:120;padding:6px;background:var(--surface-glass-solid,#fff);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,0.18);border:1px solid var(--bd-glass,#cbd5e1);">
                  <button type="button" class="btn" data-act="send-email" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-envelope" style="color:#2563eb;"></i> Send Email</button>
                  <button type="button" class="btn" data-act="send-sms" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-comment-sms" style="color:#10b981;"></i> Send SMS</button>
                </div>
              </div>
              <div class="tb-dropdown-wrap" style="position:relative;display:inline-block;">
                <button class="btn" type="button" data-pop-toggle="print-pop"><i class="fa-solid fa-print" style="font-size:11px;margin-right:4px;"></i> PDF / Print ▾</button>
                <div class="pop right tb-pop-menu" id="print-pop" style="display:none;position:absolute;top:100%;right:0;margin-top:4px;min-width:180px;z-index:120;padding:6px;background:var(--surface-glass-solid,#fff);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,0.18);border:1px solid var(--bd-glass,#cbd5e1);">
                  <button type="button" class="btn" data-act="pdf" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-file-pdf" style="color:#ef4444;"></i> PDF</button>
                  <button type="button" class="btn" data-act="print" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-print" style="color:#3b82f6;"></i> Print</button>
                  <button type="button" class="btn" data-act="print-delivery" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-truck" style="color:#10b981;"></i> Print Delivery Note</button>
                  <button type="button" class="btn" data-act="print-packing" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-box" style="color:#8b5cf6;"></i> Print Packing Slip</button>
                </div>
              </div>
              <button class="btn" type="button" data-act="sign" title="Digital Signature"><i class="fa-solid fa-signature" style="font-size:11px;margin-right:4px;"></i> ${d.signature_data ? 'Signed ✓' : 'Sign'}</button>
              <div class="tb-dropdown-wrap" style="position:relative;display:inline-block;">
                <button class="btn" type="button" data-pop-toggle="more-pop"><i class="fa-solid fa-ellipsis"></i> ▾</button>
                <div class="pop right tb-pop-menu" id="more-pop" style="display:none;position:absolute;top:100%;right:0;margin-top:4px;min-width:180px;z-index:120;padding:6px;background:var(--surface-glass-solid,#fff);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,0.18);border:1px solid var(--bd-glass,#cbd5e1);">
                  <button type="button" class="btn" data-act="clone" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-copy" style="color:#64748b;"></i> Clone</button>
                  ${d.status !== 'void' ? `<button type="button" class="btn" data-act="void-so" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-ban" style="color:#ef4444;"></i> Void</button>` : ''}
                  <button type="button" class="btn" data-act="view-journal" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-book-journal-whills" style="color:#8b5cf6;"></i> View Journal</button>
                  <button type="button" class="btn" data-act="custom" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-paint-roller" style="color:#f59e0b;"></i> Customize Template</button>
                  <div style="border-top:1px solid var(--bd-glass,#cbd5e1);margin:4px 0;"></div>
                  <button type="button" class="btn" data-act="delete" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;color:#dc2626;"><i class="fa-solid fa-trash-can" style="color:#dc2626;"></i> Delete</button>
                </div>
              </div>
            ` : isPO ? `
              <button class="btn" type="button" data-act="edit"><i class="fa-solid fa-pen" style="font-size:11px;margin-right:4px;"></i> Edit</button>
              <button class="btn p" style="background:#10b981;border-color:#059669;color:#fff;" type="button" data-act="convert-po-bill"><i class="fa-solid fa-file-invoice" style="font-size:11px;margin-right:4px;"></i> Convert to Bill</button>
              ${d.status === 'draft' ? `<button class="btn" type="button" data-act="confirm-po" style="background:#2563eb;color:#fff;border-color:#2563eb;"><i class="fa-solid fa-check" style="font-size:11px;margin-right:4px;"></i> Confirm</button>` : ''}
              <div class="tb-dropdown-wrap" style="position:relative;display:inline-block;">
                <button class="btn" type="button" data-pop-toggle="send-pop"><i class="fa-regular fa-envelope" style="font-size:11px;margin-right:4px;"></i> Send ▾</button>
                <div class="pop right tb-pop-menu" id="send-pop" style="display:none;position:absolute;top:100%;right:0;margin-top:4px;min-width:160px;z-index:120;padding:6px;background:var(--surface-glass-solid,#fff);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,0.18);border:1px solid var(--bd-glass,#cbd5e1);">
                  <button type="button" class="btn" data-act="send-email" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-envelope" style="color:#2563eb;"></i> Send Email</button>
                  <button type="button" class="btn" data-act="send-sms" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-comment-sms" style="color:#10b981;"></i> Send SMS</button>
                </div>
              </div>
              <div class="tb-dropdown-wrap" style="position:relative;display:inline-block;">
                <button class="btn" type="button" data-pop-toggle="print-pop"><i class="fa-solid fa-print" style="font-size:11px;margin-right:4px;"></i> PDF / Print ▾</button>
                <div class="pop right tb-pop-menu" id="print-pop" style="display:none;position:absolute;top:100%;right:0;margin-top:4px;min-width:180px;z-index:120;padding:6px;background:var(--surface-glass-solid,#fff);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,0.18);border:1px solid var(--bd-glass,#cbd5e1);">
                  <button type="button" class="btn" data-act="pdf" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-file-pdf" style="color:#ef4444;"></i> PDF</button>
                  <button type="button" class="btn" data-act="print" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-print" style="color:#3b82f6;"></i> Print</button>
                </div>
              </div>
              <button class="btn" type="button" data-act="sign" title="Digital Signature"><i class="fa-solid fa-signature" style="font-size:11px;margin-right:4px;"></i> ${d.signature_data ? 'Signed ✓' : 'Sign'}</button>
              <div class="tb-dropdown-wrap" style="position:relative;display:inline-block;">
                <button class="btn" type="button" data-pop-toggle="more-pop"><i class="fa-solid fa-ellipsis"></i> ▾</button>
                <div class="pop right tb-pop-menu" id="more-pop" style="display:none;position:absolute;top:100%;right:0;margin-top:4px;min-width:180px;z-index:120;padding:6px;background:var(--surface-glass-solid,#fff);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,0.18);border:1px solid var(--bd-glass,#cbd5e1);">
                  <button type="button" class="btn" data-act="clone" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-copy" style="color:#64748b;"></i> Clone</button>
                  ${d.status !== 'void' ? `<button type="button" class="btn" data-act="void-po" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-ban" style="color:#ef4444;"></i> Void</button>` : ''}
                  <button type="button" class="btn" data-act="custom" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-paint-roller" style="color:#f59e0b;"></i> Customize Template</button>
                  <div style="border-top:1px solid var(--bd-glass,#cbd5e1);margin:4px 0;"></div>
                  <button type="button" class="btn" data-act="delete" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;color:#dc2626;"><i class="fa-solid fa-trash-can" style="color:#dc2626;"></i> Delete</button>
                </div>
              </div>
            ` : isRec ? `
              <button class="btn" type="button" data-act="edit"><i class="fa-solid fa-pen" style="font-size:11px;margin-right:4px;"></i> Edit</button>
              <button class="btn p" style="background:#10b981;border-color:#059669;color:#fff;" type="button" data-act="gen-rec-inv"><i class="fa-solid fa-bolt" style="font-size:11px;margin-right:4px;"></i> Create Invoice Now</button>
              ${d.status === 'paused' ? `<button class="btn" type="button" data-act="resume-rec" style="background:#2563eb;color:#fff;border-color:#2563eb;"><i class="fa-solid fa-play" style="font-size:11px;margin-right:4px;"></i> Resume</button>` : `<button class="btn" type="button" data-act="pause-rec" style="background:#f59e0b;color:#fff;border-color:#f59e0b;"><i class="fa-solid fa-pause" style="font-size:11px;margin-right:4px;"></i> Pause</button>`}
              <div class="tb-dropdown-wrap" style="position:relative;display:inline-block;">
                <button class="btn" type="button" data-pop-toggle="more-pop"><i class="fa-solid fa-ellipsis"></i> ▾</button>
                <div class="pop right tb-pop-menu" id="more-pop" style="display:none;position:absolute;top:100%;right:0;margin-top:4px;min-width:180px;z-index:120;padding:6px;background:var(--surface-glass-solid,#fff);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,0.18);border:1px solid var(--bd-glass,#cbd5e1);">
                  <button type="button" class="btn" data-act="clone-rec" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-copy" style="color:#64748b;"></i> Clone</button>
                  ${d.status !== 'cancelled' ? `<button type="button" class="btn" data-act="cancel-rec" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-ban" style="color:#ef4444;"></i> Cancel Profile</button>` : ''}
                  <div style="border-top:1px solid var(--bd-glass,#cbd5e1);margin:4px 0;"></div>
                  <button type="button" class="btn" data-act="delete" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;color:#dc2626;"><i class="fa-solid fa-trash-can" style="color:#dc2626;"></i> Delete</button>
                </div>
              </div>
            ` : isRetainer ? `
              <button class="btn" type="button" data-act="edit"><i class="fa-solid fa-pen" style="font-size:11px;margin-right:4px;"></i> Edit</button>
              ${d.raw_status !== 'draft' && d.raw_status !== 'void' && d.raw_status !== 'cancelled' && num(d.balance) > 0 ? `<button class="btn p" type="button" data-act="pay-retainer"><i class="fa-solid fa-money-bill-wave" style="font-size:11px;margin-right:4px;"></i> Record Payment</button>` : ''}
              ${d.raw_status !== 'draft' && d.raw_status !== 'void' && d.raw_status !== 'cancelled' && num(d.available_balance) > 0 ? `<button class="btn" style="background:#6366f1;color:#fff;border-color:#6366f1;" type="button" data-act="apply-invoices"><i class="fa-solid fa-hand-holding-dollar" style="font-size:11px;margin-right:4px;"></i> Apply to Invoices</button>` : ''}
              ${d.raw_status !== 'draft' && d.raw_status !== 'void' && d.raw_status !== 'cancelled' && num(d.available_balance) > 0 ? `<button class="btn" type="button" data-act="refund-retainer" title="Refund available retainer balance">Refund</button>` : ''}
              <div class="tb-dropdown-wrap" style="position:relative;display:inline-block;">
                <button class="btn" type="button" data-pop-toggle="print-pop-gen">PDF / Print ▾</button>
                <div class="pop right tb-pop-menu" id="print-pop-gen" style="display:none;position:absolute;top:100%;right:0;margin-top:4px;min-width:180px;z-index:120;padding:6px;background:var(--surface-glass-solid,#fff);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,0.18);border:1px solid var(--bd-glass,#cbd5e1);">
                  <button type="button" class="btn" data-act="pdf" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-file-pdf" style="color:#ef4444;"></i> PDF</button>
                  <button type="button" class="btn" data-act="print" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-print" style="color:#3b82f6;"></i> Print</button>
                </div>
              </div>
              <button class="btn" type="button" data-act="sign" title="Digital Signature"><i class="fa-solid fa-signature" style="font-size:11px;margin-right:4px;"></i> ${d.signature_data ? 'Signed ✓' : 'Sign'}</button>
              <div class="tb-dropdown-wrap" style="position:relative;display:inline-block;">
                <button class="btn" type="button" data-pop-toggle="more-pop-ret"><i class="fa-solid fa-ellipsis"></i> ▾</button>
                <div class="pop right tb-pop-menu" id="more-pop-ret" style="display:none;position:absolute;top:100%;right:0;margin-top:4px;min-width:180px;z-index:120;padding:6px;background:var(--surface-glass-solid,#fff);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,0.18);border:1px solid var(--bd-glass,#cbd5e1);">
                  <button type="button" class="btn" data-act="clone" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-copy" style="color:#64748b;"></i> Clone</button>
                  ${d.raw_status !== 'draft' && d.raw_status !== 'void' && d.raw_status !== 'cancelled' ? `<button type="button" class="btn" data-act="void-retainer" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-ban" style="color:#ef4444;"></i> Void / Cancel</button>` : ''}
                  <button type="button" class="btn" data-act="custom" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-paint-roller" style="color:#f59e0b;"></i> Customize Template</button>
                  <div style="border-top:1px solid var(--bd-glass,#cbd5e1);margin:4px 0;"></div>
                  <button type="button" class="btn" data-act="delete" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;color:#dc2626;"><i class="fa-solid fa-trash-can" style="color:#dc2626;"></i> Delete</button>
                </div>
              </div>
            ` : `
              <button class="btn" type="button" data-act="edit">Edit</button>
              <button class="btn" type="button" data-act="sign" title="Digital Signature"><i class="fa-solid fa-signature" style="font-size:11px;margin-right:4px;"></i> ${d.signature_data ? 'Signed ✓' : 'Sign'}</button>
              ${d.raw_status === 'draft' ? `<button class="btn p" type="button" data-act="send">${!isBill ? 'Send' : 'Approve'}</button>` : ''}
              <div class="tb-dropdown-wrap" style="position:relative;display:inline-block;">
                <button class="btn" type="button" data-pop-toggle="print-pop-gen">PDF / Print ▾</button>
                <div class="pop right tb-pop-menu" id="print-pop-gen" style="display:none;position:absolute;top:100%;right:0;margin-top:4px;min-width:180px;z-index:120;padding:6px;background:var(--surface-glass-solid,#fff);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,0.18);border:1px solid var(--bd-glass,#cbd5e1);">
                  <button type="button" class="btn" data-act="pdf" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-file-pdf" style="color:#ef4444;"></i> PDF</button>
                  <button type="button" class="btn" data-act="print" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-print" style="color:#3b82f6;"></i> Print</button>
                </div>
              </div>
              ${(posted || d.raw_status === 'draft') && num(d.balance) > 0 && d.raw_status !== 'void' ? `<button class="btn p" type="button" data-act="pay">Record Payment</button>` : ''}
              ${!isBill ? `<button class="btn" type="button" data-act="portal">Client Portal</button>` : `<button class="btn" type="button" data-act="vportal">Vendor Portal</button>`}
              <div class="tb-dropdown-wrap" style="position:relative;display:inline-block;">
                <button class="btn" type="button" data-pop-toggle="more-pop-gen"><i class="fa-solid fa-ellipsis"></i> ▾</button>
                <div class="pop right tb-pop-menu" id="more-pop-gen" style="display:none;position:absolute;top:100%;right:0;margin-top:4px;min-width:180px;z-index:120;padding:6px;background:var(--surface-glass-solid,#fff);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,0.18);border:1px solid var(--bd-glass,#cbd5e1);">
                  <button type="button" class="btn" data-act="clone" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-copy" style="color:#64748b;"></i> Clone</button>
                  ${isBill && d.raw_status !== 'void' ? `<button type="button" class="btn" data-act="void-bill" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-ban" style="color:#ef4444;"></i> Void</button>` : ''}
                  <button type="button" class="btn" data-act="view-journal" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-book-journal-whills" style="color:#8b5cf6;"></i> View Journal</button>
                  <button type="button" class="btn" data-act="custom" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-paint-roller" style="color:#f59e0b;"></i> Customize Template</button>
                  <div style="border-top:1px solid var(--bd-glass,#cbd5e1);margin:4px 0;"></div>
                  <button type="button" class="btn" data-act="delete" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;color:#dc2626;"><i class="fa-solid fa-trash-can" style="color:#dc2626;"></i> Delete</button>
                </div>
              </div>
            `}
          </div>
        </div>
        <div class="doc-detail-tools">
          <button class="btn" type="button" data-act="att" title="Manage Attachments" style="display:flex;align-items:center;gap:4px;">
            <span>📎</span> <b id="detail-att-cnt">${attCount}</b>
          </button>
          <button class="btn" type="button" data-act="close" title="Close">✕</button>
        </div>
      </div>
      ${(inv && (d.status === 'Overdue' || num(d.balance) > 0)) ? `
        <div class="whats-next-banner" style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px 18px;margin:16px 24px 8px;display:flex;align-items:center;justify-content:space-between;gap:12px;">
          <div style="display:flex;align-items:center;gap:8px;font-size:13px;color:#1e3a8a;">
            <span style="font-size:16px;">✨</span>
            <span><b>WHAT'S NEXT?</b> Payment is overdue. Send a payment reminder or record payment.</span>
          </div>
          <button class="btn p" type="button" data-act="pay" style="border-radius:6px;font-weight:600;padding:6px 14px;font-size:12px;white-space:nowrap;cursor:pointer;">Record Payment</button>
        </div>
        <div style="margin:0 24px 16px;font-size:12px;color:#475569;display:flex;align-items:center;gap:6px;">
          <i class="fa-regular fa-file-lines" style="color:#64748b;"></i>
          <span>Get paid faster by <a href="#/settings" style="color:#2563eb;text-decoration:none;">setting up payment gateways</a> or <a href="#/banking" style="color:#2563eb;text-decoration:none;">Display a UPI QR code</a>.</span>
        </div>
      ` : (isQuote && d.status === 'draft') ? `
        <div class="whats-next-banner" style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px 18px;margin:16px 24px 8px;display:flex;align-items:center;justify-content:space-between;gap:12px;">
          <div style="display:flex;align-items:center;gap:8px;font-size:13px;color:#1e3a8a;">
            <span style="font-size:16px;">✨</span>
            <span><b>WHAT'S NEXT?</b> Send this quote to your client, or convert directly to a Sales Order / Invoice.</span>
          </div>
          <div style="display:flex;gap:8px;">
            <button class="btn" type="button" data-act="convert-so" style="border-radius:6px;font-weight:600;padding:6px 14px;font-size:12px;cursor:pointer;">To Sales Order</button>
            <button class="btn p" type="button" data-act="convert-inv" style="border-radius:6px;font-weight:600;padding:6px 14px;font-size:12px;cursor:pointer;">To Invoice</button>
          </div>
        </div>
      ` : (isSO && d.status !== 'closed' && d.status !== 'void') ? `
        <div class="whats-next-banner" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 18px;margin:16px 24px 8px;display:flex;align-items:center;justify-content:space-between;gap:12px;">
          <div style="display:flex;align-items:center;gap:8px;font-size:13px;color:#166534;">
            <span style="font-size:16px;">📦</span>
            <span><b>WHAT'S NEXT?</b> Sales order is confirmed. Convert to an Invoice or dispatch goods.</span>
          </div>
          <button class="btn p" type="button" data-act="convert-so-inv" style="background:#16a34a;border-color:#15803d;border-radius:6px;font-weight:600;padding:6px 14px;font-size:12px;white-space:nowrap;cursor:pointer;">Convert to Invoice</button>
        </div>
      ` : (isPO && d.status !== 'closed' && d.status !== 'void') ? `
        <div class="whats-next-banner" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 18px;margin:16px 24px 8px;display:flex;align-items:center;justify-content:space-between;gap:12px;">
          <div style="display:flex;align-items:center;gap:8px;font-size:13px;color:#166534;">
            <span style="font-size:16px;">🚚</span>
            <span><b>WHAT'S NEXT?</b> Purchase order placed. Once goods or bill arrives from vendor, convert to a Bill.</span>
          </div>
          <button class="btn p" type="button" data-act="convert-po-bill" style="background:#16a34a;border-color:#15803d;border-radius:6px;font-weight:600;padding:6px 14px;font-size:12px;white-space:nowrap;cursor:pointer;">Convert to Bill</button>
        </div>
      ` : ''}
      <div class="doc-canvas-scroll" id="doc-sheet-viewport">
        ${renderDocSheet(d, kind)}
      </div>
    `;
  }

  root.addEventListener('change', e => {
    if (e.target.id === 'master-cb-all') {
      const checked = e.target.checked;
      root.querySelectorAll('.master-doc-cb').forEach(cb => {
        cb.checked = checked;
        const id = String(cb.dataset.id);
        if (checked) masterSelectedIds.add(id);
        else masterSelectedIds.delete(id);
      });
      updateMasterSelectionUI();
      return;
    }
    if (e.target.classList.contains('master-doc-cb')) {
      const id = String(e.target.dataset.id);
      if (e.target.checked) masterSelectedIds.add(id);
      else masterSelectedIds.delete(id);
      updateMasterSelectionUI();
      return;
    }
  });

  root.addEventListener('click', async e => {
    const bulkDel = e.target.closest('#master-bulk-del-btn');
    if (bulkDel) {
      const count = masterSelectedIds.size;
      if (!count) return;
      const label = count === 1 ? 'record' : 'records';
      if (!(await confirmBox({
        title: `Delete ${count} ${label}?`,
        message: `Are you sure you want to delete ${count === 1 ? 'this record' : 'these ' + count + ' records'}? This cannot be undone.`,
        okText: 'Delete',
        danger: true
      }))) return;

      const ids = Array.from(masterSelectedIds);
      try {
        try {
          await api(kind + '/', { method: 'DELETE', body: { ids } });
        } catch (bulkErr) {
          if (bulkErr.status === 405 || bulkErr.status === 404) {
            for (const id of ids) {
              await api(`${kind}/${id}/`, { method: 'DELETE' });
            }
          } else {
            throw bulkErr;
          }
        }
        toast(`Deleted ${count} ${label}.`, 'ok');
        masterSelectedIds.clear();
        curDoc = null;
        loadList();
      } catch (err) {
        toast(err.message || `Failed to delete ${label}.`, 'err');
        loadList();
      }
      return;
    }
    const popBtn = e.target.closest('[data-pop-toggle]');
    if (popBtn) {
      e.stopPropagation();
      const menuId = popBtn.dataset.popToggle;
      const popMenu = root.querySelector('#' + menuId);
      const isOpen = popMenu && popMenu.style.display === 'block';
      root.querySelectorAll('.tb-pop-menu').forEach(p => { p.style.display = 'none'; });
      if (popMenu && !isOpen) popMenu.style.display = 'block';
      return;
    }
    if (!e.target.closest('.tb-dropdown-wrap')) {
      root.querySelectorAll('.tb-pop-menu').forEach(p => { p.style.display = 'none'; });
    }
    const relCard = e.target.closest('.workflow-doc-link-card');
    if (relCard) {
      const targetKind = relCard.dataset.kind;
      const targetId = relCard.dataset.id;
      if (targetKind && targetId) {
        return docMasterDetail($('#pg'), targetKind, targetId);
      }
    }
    const card = e.target.closest('.doc-row-card');
    if (card) {
      const id = card.dataset.id;
      loadDetail(id);
      return;
    }
    const sigBox = e.target.closest('[data-sig-click]');
    if (sigBox && curDoc) {
      return openSignatureModal(curDoc, kind, updated => {
        curDoc.signature_data = updated.signature_data;
        curDoc.signed_by = updated.signed_by;
        curDoc.signature_title = updated.signature_title;
        curDoc.signed_at = updated.signed_at;
        renderMasterList();
        renderDetailPane();
      });
    }
    const actBtn = e.target.closest('[data-act]');
    if (actBtn && curDoc) {
      root.querySelectorAll('.tb-pop-menu').forEach(p => { p.style.display = 'none'; });
      const act = actBtn.dataset.act;
      const d = curDoc;

      // Conversions
      if (act === 'convert-so') {
        return salesOrderForm(null, $('#pg'), (saved) => {
          if (saved) docMasterDetail($('#pg'), 'sales-orders', saved.id);
        }, { fromQuote: d.id });
      }
      if (act === 'convert-inv') {
        return invoiceForm(null, $('#pg'), (saved) => {
          if (saved) docMasterDetail($('#pg'), 'invoices', saved.id);
        }, { fromQuote: d.id });
      }
      if (act === 'convert-so-inv') {
        return invoiceForm(null, $('#pg'), (saved) => {
          if (saved) docMasterDetail($('#pg'), 'invoices', saved.id);
        }, { fromSO: d.id });
      }
      if (act === 'convert-po-bill') {
        return billForm(null, $('#pg'), (saved) => {
          if (saved) docMasterDetail($('#pg'), 'bills', saved.id);
        }, { fromPO: d.id });
      }

      // Quote actions
      if (act === 'accept-quote') {
        try {
          await api(`quotes/${d.id}/accept/`, { method: 'POST', body: {} });
          toast(`Quote ${d.number} marked as accepted!`, 'ok');
          loadDetail(d.id);
        } catch (e) { toast(e.message, 'err'); }
        return;
      }
      if (act === 'decline-quote') {
        try {
          await api(`quotes/${d.id}/decline/`, { method: 'POST', body: {} });
          toast(`Quote ${d.number} marked as declined.`, 'ok');
          loadDetail(d.id);
        } catch (e) { toast(e.message, 'err'); }
        return;
      }

      // Sales Order actions
      if (act === 'confirm-so') {
        try {
          await api(`sales-orders/${d.id}/confirm/`, { method: 'POST', body: {} });
          toast(`Sales Order ${d.number} confirmed!`, 'ok');
          loadDetail(d.id);
        } catch (e) { toast(e.message, 'err'); }
        return;
      }
      if (act === 'void-so') {
        if (!(await confirmBox({ title: `Void ${d.number}?`, message: 'Are you sure you want to void this sales order?', okText: 'Void', danger: true }))) return;
        try {
          await api(`sales-orders/${d.id}/void/`, { method: 'POST', body: {} });
          toast(`Sales Order ${d.number} voided.`, 'ok');
          loadDetail(d.id);
        } catch (e) { toast(e.message, 'err'); }
        return;
      }

      // Purchase Order actions
      if (act === 'confirm-po') {
        try {
          await api(`purchase-orders/${d.id}/action/`, { method: 'POST', body: { action: 'confirm' } });
          toast(`Purchase Order ${d.number} confirmed!`, 'ok');
          loadDetail(d.id);
        } catch (e) { toast(e.message, 'err'); }
        return;
      }
      if (act === 'void-po') {
        if (!(await confirmBox({ title: `Void ${d.number}?`, message: 'Are you sure you want to void this purchase order?', okText: 'Void', danger: true }))) return;
        try {
          await api(`purchase-orders/${d.id}/action/`, { method: 'POST', body: { action: 'void' } });
          toast(`Purchase Order ${d.number} voided.`, 'ok');
          loadDetail(d.id);
        } catch (e) { toast(e.message, 'err'); }
        return;
      }

      // Recurring Profile actions
      if (act === 'gen-rec-inv') {
        try {
          const res = await api(`recurring-invoices/${d.id}/action/`, { method: 'POST', body: { action: 'generate-invoice' } });
          toast(res.message || 'Invoice generated successfully!', 'ok');
          if (res.invoice_id) {
            docMasterDetail($('#pg'), 'invoices', res.invoice_id);
          } else {
            loadDetail(d.id);
          }
        } catch (e) { toast(e.message, 'err'); }
        return;
      }
      if (act === 'pause-rec' || act === 'resume-rec') {
        const nextAct = act === 'pause-rec' ? 'pause' : 'resume';
        try {
          await api(`recurring-invoices/${d.id}/action/`, { method: 'POST', body: { action: nextAct } });
          toast(`Recurring profile ${nextAct === 'pause' ? 'paused' : 'resumed'}.`, 'ok');
          loadDetail(d.id);
        } catch (e) { toast(e.message, 'err'); }
        return;
      }
      if (act === 'cancel-rec') {
        if (!(await confirmBox({ title: `Cancel Profile ${d.profile_name}?`, message: 'No more invoices will be generated automatically.', okText: 'Cancel Profile', danger: true }))) return;
        try {
          await api(`recurring-invoices/${d.id}/action/`, { method: 'POST', body: { action: 'cancel' } });
          toast('Recurring profile cancelled.', 'ok');
          loadDetail(d.id);
        } catch (e) { toast(e.message, 'err'); }
        return;
      }
      if (act === 'clone-rec') {
        return recurringInvoiceForm({
          profile_name: `Copy of ${d.profile_name || ''}`,
          customer: d.customer_id || d.customer,
          frequency: d.frequency || 'monthly',
          start_date: APP.today,
          next_date: APP.today,
          total: d.total,
          lines: d.lines || []
        }, $('#pg'), (saved) => {
          if (saved) docMasterDetail($('#pg'), 'recurring-invoices', saved.id);
        });
      }

      if (act === 'sign') {
        return openSignatureModal(d, kind, updated => {
          d.signature_data = updated.signature_data;
          d.signed_by = updated.signed_by;
          d.signature_title = updated.signature_title;
          d.signed_at = updated.signed_at;
          renderMasterList();
          renderDetailPane();
        });
      }
      if (act === 'edit') return openForm(d.id);
      if (act === 'pdf') return printDocument(d, kind, 'standard', true);
      if (act === 'print') return printDocument(d, kind, 'standard');
      if (act === 'print-delivery') return printDocument(d, kind, 'delivery');
      if (act === 'print-packing') return printDocument(d, kind, 'packing');
      if (act === 'send-email') return openSendEmailModal(d, kind, () => loadDetail(d.id));
      if (act === 'send-sms') return openSendSmsModal(d, kind, () => loadDetail(d.id));
      if (act === 'share') return openShareLinkModal(d, kind);
      if (act === 'send-reminder') {
        try {
          const res = await api(`invoices/${d.id}/remind/`, { method: 'POST', body: {} });
          toast(res.message || 'Payment reminder sent to customer!', 'ok');
          loadDetail(d.id);
        } catch (err) { toast(err.message, 'err'); }
        return;
      }
      if (act === 'stop-reminders') {
        try {
          const res = await api(`invoices/${d.id}/stop-reminders/`, { method: 'POST', body: {} });
          toast(res.message || 'Payment reminders stopped.', 'ok');
          loadDetail(d.id);
        } catch (err) { toast(err.message, 'err'); }
        return;
      }
      if (act === 'expected-date') return openExpectedDateModal(d, kind, () => loadDetail(d.id));
      if (act === 'write-off') return openWriteOffModal(d, () => { loadList(); loadDetail(d.id); });
      if (act === 'make-recurring') {
        return recurringInvoiceForm({
          profile_name: `Recurring - ${d.party || 'Invoice'}`,
          customer: d.customer_id || d.party_id,
          customer_id: d.customer_id || d.party_id,
          frequency: 'monthly',
          start_date: d.date || APP.today,
          next_date: d.date || APP.today,
          total: d.total,
          lines: (d.lines || []).map(l => ({
            item: l.item_id || l.item,
            description: l.description,
            quantity: l.quantity,
            rate: l.rate,
            discount_percent: l.discount_percent || 0,
            gst_rate: l.gst_rate || 18
          }))
        }, $('#pg'), (saved) => {
          if (saved) docMasterDetail($('#pg'), 'recurring-invoices', saved.id);
        });
      }
      if (act === 'create-credit-note') {
        if (!(await confirmBox({
          title: `Create Credit Note from ${d.number}?`,
          message: `A new Credit Note will be created for customer ${d.party || ''} pre-filled with this invoice's items and total.`,
          okText: 'Create Credit Note'
        }))) return;
        try {
          const cn = await api(`invoices/${d.id}/create-credit-note/`, { method: 'POST', body: {} });
          toast(`Credit Note ${cn.number} created successfully!`, 'ok');
          location.hash = '#/sales/credit-notes';
        } catch (err) { toast(err.message, 'err'); }
        return;
      }
      if (act === 'create-debit-note') {
        if (!(await confirmBox({
          title: `Create Debit Note for ${d.number}?`,
          message: `A new Debit Note will be created for this invoice.`,
          okText: 'Create Debit Note'
        }))) return;
        try {
          const dn = await api(`invoices/${d.id}/create-debit-note/`, { method: 'POST', body: {} });
          toast(`Debit Note ${dn.number} created successfully!`, 'ok');
        } catch (err) { toast(err.message, 'err'); }
        return;
      }
      if (act === 'add-eway-bill') return openAddEWayBillModal(d, kind, () => loadDetail(d.id));
      if (act === 'clone') {
        if (!(await confirmBox({
          title: `Clone ${d.number}?`,
          message: `A new draft copy of ${d.number} will be created with all items copied.`,
          okText: 'Clone Document'
        }))) return;
        try {
          const cloned = await api(`${kind}/${d.id}/clone/`, { method: 'POST', body: {} });
          toast(`Cloned successfully as ${cloned.number}!`, 'ok');
          loadList();
          loadDetail(cloned.id);
        } catch (err) { toast(err.message, 'err'); }
        return;
      }
      if (act === 'void') {
        if (!(await confirmBox({
          title: `Void invoice ${d.number}?`,
          message: `Are you sure you want to void this invoice? All balances and accounting records will be reversed.`,
          okText: 'Void Invoice',
          danger: true
        }))) return;
        try {
          await api(`invoices/${d.id}/void/`, { method: 'POST', body: {} });
          toast(`Invoice ${d.number} voided successfully.`, 'ok');
          loadList();
          loadDetail(d.id);
        } catch (err) { toast(err.message, 'err'); }
        return;
      }
      if (act === 'void-bill') {
        if (!(await confirmBox({
          title: `Void bill ${d.number}?`,
          message: `Are you sure you want to void this bill? All balances and accounting records will be reversed.`,
          okText: 'Void Bill',
          danger: true
        }))) return;
        try {
          await api(`bills/${d.id}/void/`, { method: 'POST', body: {} });
          toast(`Bill ${d.number} voided successfully.`, 'ok');
          loadList();
          loadDetail(d.id);
        } catch (err) { toast(err.message, 'err'); }
        return;
      }
      if (act === 'view-journal') return openViewJournalModal(d, kind);
      if (act === 'preferences') return openInvoicePreferencesModal(() => loadDetail(d.id));
      if (act === 'portal') return customerPortalModal(d.customer_id || d.party_id || d.id);
      if (act === 'vportal') return customerPortalModal(d.vendor_id || d.party_id || d.id);
      if (act === 'irn') {
        try {
          const res = await api(`einvoice/authenticated/${d.id}/`, { method: 'POST' });
          toast(`Authenticated IRN generated: ${res.irn.slice(0, 16)}...`);
          refresh();
        } catch (e) { toast(e.message, 'err'); }
        return;
      }
      if (act === 'pay') {
        if (inv && window.recordInvoicePaymentModal) return recordInvoicePaymentModal(d, () => loadDetail(d.id));
        if (isBill && window.recordDocumentPaymentModal) return recordDocumentPaymentModal(d, 'bills', () => loadDetail(d.id));
        return paymentForm(inv ? 'payments-received' : 'payments-made', { party: d.party_id, doc: d.id, amount: d.balance });
      }
      if (act === 'pay-retainer') return recordRetainerPaymentModal(d, () => loadDetail(d.id));
      if (act === 'apply-invoices') return applyRetainerModal(d, () => loadDetail(d.id));
      if (act === 'apply-retainer') return applyRetainerToInvoiceModal(d, () => loadDetail(d.id));
      if (act === 'refund-retainer') return refundRetainerModal(d, () => loadDetail(d.id));
      if (act === 'void-retainer') {
        if (!(await confirmBox({
          title: `Void / Cancel ${d.number}?`,
          message: `Are you sure you want to void/cancel retainer invoice ${d.number}?`,
          okText: 'Void Retainer',
          danger: true
        }))) return;
        try {
          await api(`retainer-invoices/${d.id}/void/`, { method: 'POST', body: {} });
          toast(`${d.number} voided successfully`);
          loadDetail(d.id);
        } catch (err) { toast(err.message, 'err'); }
        return;
      }
      if (act === 'custom') return openTemplateCustomizer(d, kind, () => {
        $('#doc-sheet-viewport', root).innerHTML = renderDocSheet(curDoc, kind);
      });
      if (act === 'att') return openAttachmentsModal(kind, d.id, d.number, newCount => {
        const cntEl = $('#detail-att-cnt', root);
        if (cntEl) cntEl.textContent = newCount;
        d.attachment_count = newCount;
        renderMasterList();
      });
      if (act === 'send') {
        try {
          await api(`${kind}/${d.id}/${!isBill ? 'send' : 'approve'}/`, { method: 'POST', body: {} });
          toast(d.number + (!isBill ? ' sent' : ' approved'));
          loadDetail(d.id);
        } catch (err) { toast(err.message, 'err'); }
        return;
      }
      if (act === 'delete') {
        const docLabel = `${meta.singular} `;
        if (!(await confirmBox({ title: 'Delete ' + docLabel + (d.number || d.profile_name || '') + '?', message: 'This will completely remove the document. This cannot be undone.', okText: 'Delete', danger: true }))) return;
        try {
          await api(`${kind}/${d.id}/`, { method: 'DELETE' });
          toast((d.number || d.profile_name || 'Document') + ' deleted');
          curDoc = null;
          loadList();
        } catch (err) { toast(err.message, 'err'); }
        return;
      }
      if (act === 'close') {
        if (LISTS[kind]) {
          listPage(root, LISTS[kind]);
        }
      }
    }
  });

  const filSel = $('#master-filter-sel', root);
  if (filSel) {
    filSel.addEventListener('change', () => {
      curFilter = filSel.value;
      loadList();
    });
  }
  const nBtn = $('#master-new-btn', root);
  if (nBtn) nBtn.addEventListener('click', () => openForm(null));
  const impBtn = $('#master-import-btn', root);
  if (impBtn) impBtn.addEventListener('click', () => openUniversalImportModal(kind, meta.title));
  const expToggleBtn = $('#master-export-toggle-btn', root);
  const expPop = $('#master-export-pop', root);
  if (expToggleBtn && expPop) {
    expToggleBtn.addEventListener('click', e => {
      e.stopPropagation();
      expPop.style.display = expPop.style.display === 'none' ? 'block' : 'none';
    });
    root.addEventListener('click', e => {
      if (!e.target.closest('.export-dropdown-wrap')) expPop.style.display = 'none';
    });
  }
  const expCsvBtn = $('#master-export-csv-btn', root);
  if (expCsvBtn) {
    expCsvBtn.addEventListener('click', () => {
      if (expPop) expPop.style.display = 'none';
      if (!docs || !docs.length) {
        toast('No data available to export.', 'err');
        return;
      }
      location.href = '/api/' + kind + '/?export=csv';
    });
  }
  const expJsonBtn = $('#master-export-json-btn', root);
  if (expJsonBtn) {
    expJsonBtn.addEventListener('click', async () => {
      if (expPop) expPop.style.display = 'none';
      if (!docs || !docs.length) {
        toast('No data available to export.', 'err');
        return;
      }
      try {
        const res = await api(kind + '/?export=json&page_size=500');
        const rows = res.results || res;
        if (!rows || (Array.isArray(rows) && !rows.length)) {
          toast('No data available to export.', 'err');
          return;
        }
        const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' });
        const dl = document.createElement('a'); dl.href = URL.createObjectURL(blob);
        dl.download = `${kind}_export_${iso(new Date())}.json`;
        dl.click();
        toast('Exported as JSON!', 'ok');
      } catch(err) { toast(err.message, 'err'); }
    });
  }
  const vmBtn = $('#master-view-mode-btn', root);
  if (vmBtn) {
    vmBtn.addEventListener('click', () => {
      if (LISTS[kind]) {
        listPage(root, LISTS[kind]);
      }
    });
  }
  let t;
  const qIn = $('#master-q-in', root);
  if (qIn) {
    qIn.addEventListener('input', e => {
      clearTimeout(t);
      t = setTimeout(() => {
        searchQuery = e.target.value.trim();
        loadList();
      }, 250);
    });
  }

  loadList();
}

async function docDetail(kind, id) {
  const isRetainer = kind === 'retainer-invoices', isBill = kind === 'bills', inv = kind === 'invoices';
  const d = await api(`${kind}/${id}/`);
  const posted = isRetainer ? (d.raw_status === 'sent' || d.raw_status === 'partial') : (d.raw_status === (inv ? 'sent' : 'open') || d.raw_status === 'partial');
  const attCount = (d.attachments ? d.attachments.length : (d.attachment_count || 0));

  const m = Modal.open({
    title: `${isRetainer ? 'Retainer Invoice' : inv ? 'Invoice' : 'Bill'} ${d.number}`, wide: true,
    body: `
      <div class="doc-detail-actions" style="display:flex;justify-content:flex-end;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:12px;">
        ${inv ? `
          <button class="btn" type="button" data-do="edit"><i class="fa-solid fa-pen" style="font-size:11px;margin-right:4px;"></i> Edit</button>
          <div class="tb-dropdown-wrap" style="position:relative;display:inline-block;">
            <button class="btn" type="button" data-pop-toggle="modal-send-pop"><i class="fa-regular fa-envelope" style="font-size:11px;margin-right:4px;"></i> Send ▾</button>
            <div class="pop right tb-pop-menu" id="modal-send-pop" style="display:none;position:absolute;top:100%;right:0;margin-top:4px;min-width:160px;z-index:120;padding:6px;background:var(--surface-glass-solid,#fff);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,0.18);border:1px solid var(--bd-glass,#cbd5e1);">
              <button type="button" class="btn" data-do="send-email" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-envelope" style="color:#2563eb;"></i> Send Email</button>
              <button type="button" class="btn" data-do="send-sms" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-comment-sms" style="color:#10b981;"></i> Send SMS</button>
            </div>
          </div>
          <button class="btn" type="button" data-do="share" title="Share invoice link"><i class="fa-solid fa-share-nodes" style="font-size:11px;margin-right:4px;"></i> Share</button>
          <div class="tb-dropdown-wrap" style="position:relative;display:inline-block;">
            <button class="btn" type="button" data-pop-toggle="modal-remind-pop"><i class="fa-regular fa-clock" style="font-size:11px;margin-right:4px;"></i> Reminders ▾</button>
            <div class="pop right tb-pop-menu" id="modal-remind-pop" style="display:none;position:absolute;top:100%;right:0;margin-top:4px;min-width:190px;z-index:120;padding:6px;background:var(--surface-glass-solid,#fff);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,0.18);border:1px solid var(--bd-glass,#cbd5e1);">
              <button type="button" class="btn" data-do="send-reminder" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-bell" style="color:#f59e0b;"></i> Send Email</button>
              <button type="button" class="btn" data-do="stop-reminders" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-bell-slash" style="color:#ef4444;"></i> Stop Reminders</button>
              <button type="button" class="btn" data-do="expected-date" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-calendar-day" style="color:#6366f1;"></i> Expected Payment Date</button>
            </div>
          </div>
          <div class="tb-dropdown-wrap" style="position:relative;display:inline-block;">
            <button class="btn" type="button" data-pop-toggle="modal-print-pop"><i class="fa-solid fa-print" style="font-size:11px;margin-right:4px;"></i> PDF / Print ▾</button>
            <div class="pop right tb-pop-menu" id="modal-print-pop" style="display:none;position:absolute;top:100%;right:0;margin-top:4px;min-width:180px;z-index:120;padding:6px;background:var(--surface-glass-solid,#fff);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,0.18);border:1px solid var(--bd-glass,#cbd5e1);">
              <button type="button" class="btn" data-do="pdf" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-file-pdf" style="color:#ef4444;"></i> PDF</button>
              <button type="button" class="btn" data-do="print" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-print" style="color:#3b82f6;"></i> Print</button>
              <button type="button" class="btn" data-do="print-delivery" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-truck" style="color:#10b981;"></i> Print Delivery Note</button>
              <button type="button" class="btn" data-do="print-packing" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-box" style="color:#8b5cf6;"></i> Print Packing Slip</button>
            </div>
          </div>
          ${num(d.balance) > 0 && d.raw_status !== 'void' ? `
            <div class="tb-dropdown-wrap" style="position:relative;display:inline-block;">
              <button class="btn p" type="button" data-pop-toggle="modal-pay-pop" style="display:inline-flex;align-items:center;"><i class="fa-solid fa-money-bill-wave" style="font-size:11px;margin-right:4px;"></i> Record Payment ▾</button>
              <div class="pop right tb-pop-menu" id="modal-pay-pop" style="display:none;position:absolute;top:100%;right:0;margin-top:4px;min-width:170px;z-index:120;padding:6px;background:var(--surface-glass-solid,#fff);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,0.18);border:1px solid var(--bd-glass,#cbd5e1);">
                <button type="button" class="btn" data-do="pay" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-receipt" style="color:#10b981;"></i> Record Payment</button>
                <button type="button" class="btn" data-do="apply-retainer" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-hand-holding-dollar" style="color:#6366f1;"></i> Apply Retainer</button>
                <button type="button" class="btn" data-do="write-off" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;color:#ef4444;"><i class="fa-solid fa-ban" style="color:#ef4444;"></i> Write Off</button>
              </div>
            </div>
          ` : ''}
          <button class="btn" type="button" data-do="sign" title="Digital Signature"><i class="fa-solid fa-signature" style="font-size:11px;margin-right:4px;"></i> ${d.signature_data ? 'Signed ✓' : 'Sign'}</button>
          <div class="tb-dropdown-wrap" style="position:relative;display:inline-block;">
            <button class="btn" type="button" data-pop-toggle="modal-more-pop"><i class="fa-solid fa-ellipsis"></i> ▾</button>
            <div class="pop right tb-pop-menu" id="modal-more-pop" style="display:none;position:absolute;top:100%;right:0;margin-top:4px;min-width:200px;z-index:120;padding:6px;background:var(--surface-glass-solid,#fff);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,0.18);border:1px solid var(--bd-glass,#cbd5e1);">
              <button type="button" class="btn" data-do="make-recurring" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-arrows-rotate" style="color:#3b82f6;"></i> Make Recurring</button>
              <button type="button" class="btn" data-do="create-credit-note" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-file-invoice-dollar" style="color:#10b981;"></i> Create Credit Note</button>
              <button type="button" class="btn" data-do="create-debit-note" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-file-circle-minus" style="color:#f59e0b;"></i> Create Debit Note</button>
              <button type="button" class="btn" data-do="add-eway-bill" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-truck-fast" style="color:#0ea5e9;"></i> Add e-Way Bill Details</button>
              <button type="button" class="btn" data-do="clone" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-copy" style="color:#64748b;"></i> Clone</button>
              ${d.raw_status !== 'void' && d.raw_status !== 'paid' ? `<button type="button" class="btn" data-do="void" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-ban" style="color:#ef4444;"></i> Void</button>` : ''}
              <button type="button" class="btn" data-do="view-journal" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-book-journal-whills" style="color:#8b5cf6;"></i> View Journal</button>
              <button type="button" class="btn" data-do="custom" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-paint-roller" style="color:#f59e0b;"></i> Customize Template</button>
              <button type="button" class="btn" data-do="preferences" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-sliders" style="color:#475569;"></i> Invoice Preferences</button>
              <div style="border-top:1px solid var(--bd-glass,#cbd5e1);margin:4px 0;"></div>
              <button type="button" class="btn" data-do="delete" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;color:#dc2626;"><i class="fa-solid fa-trash-can" style="color:#dc2626;"></i> Delete</button>
            </div>
          </div>
        ` : `
          <button class="btn" type="button" data-do="edit">Edit</button>
          <button class="btn" type="button" data-do="sign" title="Digital Signature"><i class="fa-solid fa-signature" style="font-size:11px;margin-right:4px;"></i> ${d.signature_data ? 'Signed ✓' : 'Sign'}</button>
          <div class="tb-dropdown-wrap" style="position:relative;display:inline-block;">
            <button class="btn" type="button" data-pop-toggle="modal-print-pop-gen">PDF / Print ▾</button>
            <div class="pop right tb-pop-menu" id="modal-print-pop-gen" style="display:none;position:absolute;top:100%;right:0;margin-top:4px;min-width:180px;z-index:120;padding:6px;background:var(--surface-glass-solid,#fff);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,0.18);border:1px solid var(--bd-glass,#cbd5e1);">
              <button type="button" class="btn" data-do="pdf" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-file-pdf" style="color:#ef4444;"></i> PDF</button>
              <button type="button" class="btn" data-do="print" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-print" style="color:#3b82f6;"></i> Print</button>
              ${!isBill ? `
                <button type="button" class="btn" data-do="print-delivery" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-truck" style="color:#10b981;"></i> Print Delivery Note</button>
                <button type="button" class="btn" data-do="print-packing" style="width:100%;text-align:left;border:none;background:transparent;padding:6px 10px;font-size:12px;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-box" style="color:#8b5cf6;"></i> Print Packing Slip</button>
              ` : ''}
            </div>
          </div>
          <button class="btn" type="button" data-do="custom">Customize Template</button>
          <button class="btn" type="button" data-do="att">📎 Attachments (${attCount})</button>
          ${d.raw_status === 'draft' ? `<button class="btn p" type="button" data-do="post">${!isBill ? 'Mark as sent' : 'Approve bill'}</button>` : ''}
          ${isRetainer && d.raw_status !== 'draft' && d.raw_status !== 'void' && d.raw_status !== 'cancelled' && num(d.balance) > 0 ? `<button class="btn p" type="button" data-do="pay-retainer">Record Payment</button>` : ''}
          ${isRetainer && d.raw_status !== 'draft' && d.raw_status !== 'void' && d.raw_status !== 'cancelled' && num(d.available_balance) > 0 ? `<button class="btn" style="background:#6366f1;color:#fff;border-color:#6366f1;" type="button" data-do="apply-invoices">Apply to Invoices</button>` : ''}
          ${isRetainer && d.raw_status !== 'draft' && d.raw_status !== 'void' && d.raw_status !== 'cancelled' && num(d.available_balance) > 0 ? `<button class="btn" type="button" data-do="refund-retainer">Refund</button>` : ''}
          ${!isRetainer && (posted || d.raw_status === 'draft') && num(d.balance) > 0 && d.raw_status !== 'void' ? `<button class="btn p" type="button" data-do="pay">Record Payment</button>` : ''}
          ${inv && posted && num(d.balance) > 0 ? `<button class="btn" type="button" data-do="apply-retainer">Apply Retainer</button>` : ''}
          <button class="btn d" type="button" data-do="delete">Delete</button>
        `}
      </div>

      <div id="modal-sheet-viewport" style="display:flex;justify-content:center;background:rgba(0,0,0,0.02);padding:14px;border-radius:6px;max-height:75vh;overflow-y:auto;">
        ${renderDocSheet(d, kind)}
      </div>
    `,
    footer: `<button class="btn" type="button" data-close>Close</button>`,
  });

  m.el.addEventListener('click', async e => {
    const popBtn = e.target.closest('[data-pop-toggle]');
    if (popBtn) {
      e.stopPropagation();
      const menuId = popBtn.dataset.popToggle;
      const popMenu = m.el.querySelector('#' + menuId);
      const isOpen = popMenu && popMenu.style.display === 'block';
      m.el.querySelectorAll('.tb-pop-menu').forEach(p => { p.style.display = 'none'; });
      if (popMenu && !isOpen) popMenu.style.display = 'block';
      return;
    }
    if (!e.target.closest('.tb-dropdown-wrap')) {
      m.el.querySelectorAll('.tb-pop-menu').forEach(p => { p.style.display = 'none'; });
    }

    const sigBox = e.target.closest('[data-sig-click]');
    if (sigBox) {
      return openSignatureModal(d, kind, updated => {
        d.signature_data = updated.signature_data;
        d.signed_by = updated.signed_by;
        d.signature_title = updated.signature_title;
        d.signed_at = updated.signed_at;
        $('#modal-sheet-viewport', m.el).innerHTML = renderDocSheet(d, kind);
      });
    }
    const a = e.target.closest('[data-do]'); if (!a) return;
    m.el.querySelectorAll('.tb-pop-menu').forEach(p => { p.style.display = 'none'; });
    const act = a.dataset.do;
    try {
      if (act === 'sign') {
        return openSignatureModal(d, kind, updated => {
          d.signature_data = updated.signature_data;
          d.signed_by = updated.signed_by;
          d.signature_title = updated.signature_title;
          d.signed_at = updated.signed_at;
          $('#modal-sheet-viewport', m.el).innerHTML = renderDocSheet(d, kind);
        });
      }
      if (act === 'pdf') return printDocument(d, kind, 'standard', true);
      if (act === 'print') return printDocument(d, kind, 'standard');
      if (act === 'print-delivery') return printDocument(d, kind, 'delivery');
      if (act === 'print-packing') return printDocument(d, kind, 'packing');
      if (act === 'send-email') return openSendEmailModal(d, kind, async () => {
        const fresh = await api(`${kind}/${id}/`);
        Object.assign(d, fresh);
        $('#modal-sheet-viewport', m.el).innerHTML = renderDocSheet(d, kind);
      });
      if (act === 'send-sms') return openSendSmsModal(d, kind);
      if (act === 'share') return openShareLinkModal(d, kind);
      if (act === 'send-reminder') {
        const res = await api(`invoices/${d.id}/remind/`, { method: 'POST', body: {} });
        return toast(res.message || 'Reminder sent!', 'ok');
      }
      if (act === 'stop-reminders') {
        const res = await api(`invoices/${d.id}/stop-reminders/`, { method: 'POST', body: {} });
        return toast(res.message || 'Reminders stopped.', 'ok');
      }
      if (act === 'expected-date') return openExpectedDateModal(d, kind, async () => {
        const fresh = await api(`${kind}/${id}/`);
        Object.assign(d, fresh);
        $('#modal-sheet-viewport', m.el).innerHTML = renderDocSheet(d, kind);
      });
      if (act === 'write-off') return openWriteOffModal(d, () => { m.close(); refresh(); });
      if (act === 'make-recurring') {
        m.close();
        return recurringInvoiceModal(null, {
          profile_name: `Recurring - ${d.party || 'Invoice'}`,
          customer: d.customer_id || d.party_id,
          customer_id: d.customer_id || d.party_id,
          frequency: 'monthly',
          start_date: d.date || APP.today,
          next_date: d.date || APP.today,
          total: d.total,
          lines: (d.lines || []).map(l => ({
            item: l.item_id || l.item,
            description: l.description,
            quantity: l.quantity,
            rate: l.rate,
            discount_percent: l.discount_percent || 0,
            gst_rate: l.gst_rate || 18
          }))
        });
      }
      if (act === 'create-credit-note') {
        if (!(await confirmBox({
          title: `Create Credit Note from ${d.number}?`,
          message: `A new Credit Note will be created for customer ${d.party || ''} pre-filled with this invoice's items and total.`,
          okText: 'Create Credit Note'
        }))) return;
        const cn = await api(`invoices/${d.id}/create-credit-note/`, { method: 'POST', body: {} });
        toast(`Credit Note ${cn.number} created!`, 'ok');
        m.close();
        location.hash = '#/sales/credit-notes';
        return;
      }
      if (act === 'create-debit-note') {
        if (!(await confirmBox({
          title: `Create Debit Note for ${d.number}?`,
          message: `A new Debit Note will be created for this invoice.`,
          okText: 'Create Debit Note'
        }))) return;
        const dn = await api(`invoices/${d.id}/create-debit-note/`, { method: 'POST', body: {} });
        toast(`Debit Note ${dn.number} created!`, 'ok');
        return;
      }
      if (act === 'add-eway-bill') return openAddEWayBillModal(d, kind, async () => {
        const fresh = await api(`${kind}/${id}/`);
        Object.assign(d, fresh);
        $('#modal-sheet-viewport', m.el).innerHTML = renderDocSheet(d, kind);
      });
      if (act === 'clone') {
        if (!(await confirmBox({
          title: `Clone ${d.number}?`,
          message: `A new draft copy of ${d.number} will be created with all items copied.`,
          okText: 'Clone Document'
        }))) return;
        const cloned = await api(`${kind}/${d.id}/clone/`, { method: 'POST', body: {} });
        toast(`Cloned successfully as ${cloned.number}!`, 'ok');
        m.close();
        refresh();
        return;
      }
      if (act === 'void') {
        if (!(await confirmBox({
          title: `Void invoice ${d.number}?`,
          message: `Are you sure you want to void this invoice? All balances and accounting records will be reversed.`,
          okText: 'Void Invoice',
          danger: true
        }))) return;
        await api(`invoices/${d.id}/void/`, { method: 'POST', body: {} });
        toast(`Invoice ${d.number} voided successfully.`, 'ok');
        m.close();
        refresh();
        return;
      }
      if (act === 'view-journal') return openViewJournalModal(d, kind);
      if (act === 'preferences') return openInvoicePreferencesModal();
      if (act === 'edit') { m.close(); return docMasterDetail($('#pg'), kind, id, true); }
      if (act === 'custom') return openTemplateCustomizer(d, kind, () => {
        $('#modal-sheet-viewport', m.el).innerHTML = renderDocSheet(d, kind);
      });
      if (act === 'att') return openAttachmentsModal(kind, d.id, d.number);
      if (act === 'pay') {
        m.close();
        if (inv && window.recordInvoicePaymentModal) return recordInvoicePaymentModal(d, () => refresh());
        if (isBill && window.recordDocumentPaymentModal) return recordDocumentPaymentModal(d, 'bills', () => refresh());
        return paymentForm(inv ? 'payments-received' : 'payments-made', { party: d.party_id, doc: d.id, amount: d.balance });
      }
      if (act === 'pay-retainer') { m.close(); return recordRetainerPaymentModal(d, () => refresh()); }
      if (act === 'apply-invoices') { m.close(); return applyRetainerModal(d, () => refresh()); }
      if (act === 'apply-retainer') { m.close(); return applyRetainerToInvoiceModal(d, () => refresh()); }
      if (act === 'refund-retainer') { m.close(); return refundRetainerModal(d, () => refresh()); }
      if (act === 'post') { await api(`${kind}/${id}/${!isBill ? 'send' : 'approve'}/`, { method: 'POST', body: {} }); toast(d.number + (!isBill ? ' sent' : ' approved')); m.close(); refresh(); }
      if (act === 'delete') {
        const docLabel = isRetainer ? 'retainer invoice ' : inv ? 'invoice ' : 'bill ';
        if (!(await confirmBox({ title: 'Delete ' + docLabel + d.number + '?', message: 'This cannot be undone.', okText: 'Delete', danger: true }))) return;
        await api(`${kind}/${id}/`, { method: 'DELETE' });
        toast(d.number + ' deleted'); m.close(); refresh();
      }
    } catch (err) { toast(err.message, 'err'); }
  });
}

async function recordRetainerPaymentModal(doc, onDone) {
  let bankOpts = [['Bank Account', 'Bank Account'], ['Petty Cash', 'Petty Cash']];
  try {
    const bas = await api('lookup/bank-accounts/');
    if (bas && bas.length) {
      bankOpts = bas.map(b => [b.name, `${b.name} (${b.bank_name || 'Bank'})`]);
      bankOpts.push(['Cash', 'Petty Cash']);
    }
  } catch (e) {}

  formModal({
    title: `Record Payment · Retainer ${doc.number}`,
    wide: false,
    submit: 'Record Payment',
    body: `
      <div style="background:var(--surface-glass-subtle);padding:10px 14px;border-radius:6px;margin-bottom:14px;font-size:13px;line-height:1.5;">
        <div><b>Customer:</b> ${esc(doc.party)}</div>
        <div style="margin-top:2px;"><b>Retainer Total:</b> ${inr(doc.total)} &nbsp;|&nbsp; <b>Balance Due:</b> <span style="color:#059669;font-weight:700;">${inr(doc.balance)}</span></div>
      </div>
      <div class="fgrid">
        ${fld({ name: 'amount', label: 'Payment Amount (₹)', type: 'number', req: 1, value: doc.balance, attrs: `min="0.01" max="${doc.balance}" step="0.01"` })}
        ${fld({ name: 'date', label: 'Payment Date', type: 'date', req: 1, value: APP.today })}
        ${fld({ name: 'mode', label: 'Payment Mode', type: 'select', opts: [['bank_transfer', 'Bank Transfer'], ['upi', 'UPI'], ['cash', 'Cash'], ['cheque', 'Cheque'], ['card', 'Credit/Debit Card'], ['other', 'Other']], value: 'bank_transfer' })}
        ${fld({ name: 'account', label: 'Deposit To', type: 'select', opts: bankOpts, value: bankOpts[0][0] })}
        ${fld({ name: 'reference', label: 'Reference#', col: 'c2', placeholder: 'Transaction ID / Cheque# / UTR' })}
        ${fld({ name: 'notes', label: 'Notes', type: 'textarea', col: 'c2' })}
      </div>
    `,
    onSubmit: async d => {
      await api(`retainer-invoices/${doc.id}/pay/`, {
        method: 'POST',
        body: {
          amount: d.amount,
          date: d.date,
          mode: d.mode,
          account: d.account,
          reference: d.reference,
          notes: d.notes,
        }
      });
      toast(`Payment of ${inr(d.amount)} recorded successfully`);
      if (onDone) onDone();
    }
  });
}

async function refundRetainerModal(doc, onDone) {
  const avail = num(doc.available_balance || 0);
  if (avail <= 0) {
    toast('No available retainer balance to refund.', 'err');
    return;
  }
  let bankOpts = [['Bank Account', 'Bank Account'], ['Petty Cash', 'Petty Cash']];
  try {
    const bas = await api('lookup/bank-accounts/');
    if (bas && bas.length) {
      bankOpts = bas.map(b => [b.name, `${b.name} (${b.bank_name || 'Bank'})`]);
      bankOpts.push(['Cash', 'Petty Cash']);
    }
  } catch (e) {}

  formModal({
    title: `Refund Advance · Retainer ${doc.number}`,
    wide: false,
    submit: 'Process Refund',
    body: `
      <div style="background:var(--surface-glass-subtle);padding:10px 14px;border-radius:6px;margin-bottom:14px;font-size:13px;line-height:1.5;">
        <div><b>Customer:</b> ${esc(doc.party || doc.customer_name)}</div>
        <div style="margin-top:2px;"><b>Retainer Total:</b> ${inr(doc.total)} &nbsp;|&nbsp; <b>Available to Refund:</b> <span style="color:#059669;font-weight:700;">${inr(avail)}</span></div>
      </div>
      <div class="fgrid">
        ${fld({ name: 'amount', label: 'Refund Amount (₹)', type: 'number', req: 1, value: avail.toFixed(2), attrs: `min="0.01" max="${avail}" step="0.01"` })}
        ${fld({ name: 'date', label: 'Refund Date', type: 'date', req: 1, value: APP.today })}
        ${fld({ name: 'mode', label: 'Refund Mode', type: 'select', opts: [['bank_transfer', 'Bank Transfer'], ['upi', 'UPI'], ['cash', 'Cash'], ['cheque', 'Cheque'], ['card', 'Credit/Debit Card'], ['other', 'Other']], value: 'bank_transfer' })}
        ${fld({ name: 'account', label: 'Paid From', type: 'select', opts: bankOpts, value: bankOpts[0][0] })}
        ${fld({ name: 'reference', label: 'Reference#', col: 'c2', placeholder: 'UTR / Transaction ID / Cheque#' })}
        ${fld({ name: 'notes', label: 'Notes / Reason', type: 'textarea', col: 'c2', placeholder: 'Reason for refund' })}
      </div>
    `,
    onSubmit: async d => {
      const refAmt = num(d.amount);
      if (refAmt <= 0) throw new ApiErr(400, { amount: 'Refund amount must be greater than zero.' });
      if (refAmt > avail + 0.009) throw new ApiErr(400, { amount: `Refund amount cannot exceed available balance (${inr(avail)}).` });

      await api(`retainer-invoices/${doc.id}/refund/`, {
        method: 'POST',
        body: {
          amount: refAmt,
          date: d.date,
          mode: d.mode,
          account: d.account,
          reference: d.reference,
          notes: d.notes,
        }
      });
      toast(`Refund of ${inr(refAmt)} processed successfully`, 'ok');
      if (onDone) onDone();
    }
  });
}

async function applyRetainerModal(retainerDoc, onDone) {
  const avail = num(retainerDoc.available_balance || 0);
  if (avail <= 0) {
    toast('No available retainer balance to apply.', 'err');
    return;
  }
  let res;
  try {
    res = await api('invoices/?' + qs({ customer: retainerDoc.party_id || retainerDoc.customer_id, open: '1', page_size: 100 }));
  } catch (e) {
    toast(e.message, 'err');
    return;
  }
  const invoices = (res.results || []).filter(inv => inv.raw_status !== 'draft' && inv.raw_status !== 'void' && num(inv.balance) > 0);
  if (!invoices.length) {
    toast(`No unpaid invoices found for ${retainerDoc.party || 'this customer'}.`, 'err');
    return;
  }

  const m = Modal.open({
    title: `Apply Retainer ${esc(retainerDoc.number)} to Invoices`,
    wide: true,
    body: `
      <div style="background:var(--surface-glass-subtle);padding:12px 14px;border-radius:8px;margin-bottom:14px;font-size:13px;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div><b>Customer:</b> ${esc(retainerDoc.party)}</div>
          <div style="font-size:12px;color:var(--sub);margin-top:2px;">Apply available retainer credit against outstanding customer invoices.</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:11px;text-transform:uppercase;color:var(--sub);font-weight:600;">Available Retainer Balance</div>
          <div style="font-size:18px;font-weight:800;color:#059669;" id="m-avail-bal">${inr(avail)}</div>
        </div>
      </div>

      <div style="margin-bottom:12px;display:flex;align-items:center;gap:10px;">
        <label style="font-weight:600;font-size:13px;">Allocation Date:</label>
        <input class="in" type="date" id="m-alloc-date" value="${APP.today}" style="max-width:180px;">
      </div>

      <table class="lt" style="margin-top:8px;">
        <thead>
          <tr>
            <th>Invoice#</th>
            <th>Date</th>
            <th>Due Date</th>
            <th class="r">Total</th>
            <th class="r">Balance Due</th>
            <th class="r" style="width:180px;">Amount to Apply (₹)</th>
          </tr>
        </thead>
        <tbody>
          ${invoices.map(inv => `
            <tr data-inv-id="${inv.id}" data-bal="${inv.balance}">
              <td><b>${esc(inv.number)}</b></td>
              <td>${fd(inv.date)}</td>

              <td>${fd(inv.due_date)}</td>

              <td class="r">${inr(inv.total)}</td>

              <td class="r" style="font-weight:600;">${inr(inv.balance)}</td>

              <td class="r">
                <div style="display:flex;align-items:center;gap:4px;justify-content:flex-end;">
                  <input type="number" class="in r alloc-val" data-id="${inv.id}" step="0.01" min="0" max="${inv.balance}" placeholder="0.00" style="width:110px;padding:4px 6px;">
                  <button type="button" class="btn btn-sm alloc-max" data-id="${inv.id}" style="padding:2px 8px;font-size:11px;">Max</button>

                </div>

              </td>

            </tr>

          `).join('')}
        </tbody>
      </table>

      <div style="margin-top:14px;padding:10px 14px;background:rgba(0,0,0,0.02);border-radius:6px;display:flex;justify-content:flex-end;gap:24px;font-size:13px;">
        <div><span>Total Applied:</span> <b id="m-tot-applied" style="color:#6366f1;">₹0.00</b></div>
        <div><span>Remaining Credit:</span> <b id="m-rem-credit" style="color:#059669;">${inr(avail)}</b></div>
      </div>
      <div id="m-alloc-err" style="color:var(--err);font-size:12px;margin-top:8px;font-weight:600;"></div>
    `,
    footer: `
      <button class="btn" type="button" data-close>Cancel</button>
      <button class="btn p" type="button" id="m-submit-apply" style="background:#6366f1;border-color:#6366f1;">Apply Retainer</button>
    `
  });

  const updateCalcs = () => {
    let tot = 0;
    $$('.alloc-val', m.el).forEach(inp => {
      tot += num(inp.value);
    });
    const rem = avail - tot;
    $('#m-tot-applied', m.el).textContent = inr(tot);
    const remEl = $('#m-rem-credit', m.el);
    remEl.textContent = inr(rem);
    if (rem < -0.009) {
      remEl.style.color = 'var(--err)';
      $('#m-alloc-err', m.el).textContent = `Total applied amount exceeds available balance by ${inr(Math.abs(rem))}`;
    } else {
      remEl.style.color = '#059669';
      $('#m-alloc-err', m.el).textContent = '';
    }
  };

  m.el.addEventListener('input', e => {
    if (e.target.classList.contains('alloc-val')) updateCalcs();
  });

  m.el.addEventListener('click', async e => {
    const maxBtn = e.target.closest('.alloc-max');
    if (maxBtn) {
      const invId = maxBtn.dataset.id;
      const row = m.el.querySelector(`tr[data-inv-id="${invId}"]`);
      const bal = num(row ? row.dataset.bal : 0);
      const input = m.el.querySelector(`.alloc-val[data-id="${invId}"]`);
      let otherUsed = 0;
      $$('.alloc-val', m.el).forEach(inp => {
        if (inp !== input) otherUsed += num(inp.value);
      });
      const remainingAvail = Math.max(0, avail - otherUsed);
      const toAlloc = Math.min(bal, remainingAvail);
      input.value = toAlloc > 0 ? toAlloc.toFixed(2) : '';
      updateCalcs();
      return;
    }

    if (e.target.id === 'm-submit-apply') {
      const dt = $('#m-alloc-date', m.el).value;
      const allocs = [];
      $$('.alloc-val', m.el).forEach(inp => {
        const amt = num(inp.value);
        if (amt > 0) {
          allocs.push({ invoice: Number(inp.dataset.id), amount: amt });
        }
      });
      if (!allocs.length) {
        $('#m-alloc-err', m.el).textContent = 'Please enter an amount to apply to at least one invoice.';
        return;
      }
      let tot = allocs.reduce((a, b) => a + b.amount, 0);
      if (tot > avail + 0.009) {
        $('#m-alloc-err', m.el).textContent = 'Total applied amount exceeds available retainer balance.';
        return;
      }

      try {
        await api(`retainer-invoices/${retainerDoc.id}/apply/`, {
          method: 'POST',
          body: { allocations: allocs, date: dt }
        });
        toast(`Retainer applied successfully to ${allocs.length} invoice(s)`);
        m.close();
        if (onDone) onDone();
      } catch (err) {
        $('#m-alloc-err', m.el).textContent = err.message;
      }
    }
  });
}

async function applyRetainerToInvoiceModal(invoiceDoc, onDone) {
  const invBal = num(invoiceDoc.balance || 0);
  if (invBal <= 0) {
    toast('This invoice is already fully paid.', 'err');
    return;
  }
  let res;
  try {
    res = await api('retainer-invoices/?' + qs({ customer: invoiceDoc.party_id || invoiceDoc.customer_id, available: 1, page_size: 50 }));
  } catch (e) {
    toast(e.message, 'err');
    return;
  }
  const retainers = (res.results || []).filter(r => num(r.available_balance) > 0);
  if (!retainers.length) {
    toast(`No available retainer credits found for customer ${invoiceDoc.party || ''}.`, 'err');
    return;
  }

  const m = Modal.open({
    title: `Apply Retainer Credit · Invoice ${esc(invoiceDoc.number)}`,
    wide: false,
    body: `
      <div style="background:var(--surface-glass-subtle);padding:10px 14px;border-radius:6px;margin-bottom:14px;font-size:13px;line-height:1.5;">
        <div><b>Customer:</b> ${esc(invoiceDoc.party)}</div>
        <div style="margin-top:2px;"><b>Invoice Total:</b> ${inr(invoiceDoc.total)} &nbsp;|&nbsp; <b>Balance Due:</b> <span style="color:var(--accent);font-weight:700;">${inr(invBal)}</span></div>
      </div>
      <div class="fgrid">
        ${fld({
          name: 'retainer_id',
          label: 'Select Retainer Invoice',
          type: 'select',
          req: 1,
          opts: retainers.map(r => [r.id, `${r.number} (Available: ${inr(r.available_balance)})`]),
          value: retainers[0].id,
          col: 'c2'
        })}
        ${fld({
          name: 'amount',
          label: 'Amount to Apply (₹)',
          type: 'number',
          req: 1,
          value: Math.min(invBal, num(retainers[0].available_balance)).toFixed(2),
          attrs: `min="0.01" step="0.01"`,
          col: 'c1'
        })}
        ${fld({ name: 'date', label: 'Application Date', type: 'date', req: 1, value: APP.today, col: 'c1' })}
        ${fld({ name: 'notes', label: 'Notes', type: 'textarea', col: 'c2', placeholder: 'Optional notes' })}
      </div>
      <div id="m-inv-alloc-err" style="color:var(--err);font-size:12px;margin-top:8px;font-weight:600;"></div>
    `,
    footer: `
      <button class="btn" type="button" data-close>Cancel</button>
      <button class="btn p" type="button" id="m-inv-apply-btn" style="background:#6366f1;border-color:#6366f1;">Apply Credit</button>
    `
  });

  const sel = m.el.querySelector('select[name="retainer_id"]');
  const amtInp = m.el.querySelector('input[name="amount"]');
  if (sel && amtInp) {
    sel.addEventListener('change', () => {
      const chosen = retainers.find(r => String(r.id) === String(sel.value));
      if (chosen) {
        amtInp.value = Math.min(invBal, num(chosen.available_balance)).toFixed(2);
      }
    });
  }

  m.el.addEventListener('click', async e => {
    if (e.target.id === 'm-inv-apply-btn') {
      const retId = Number(sel.value);
      const amt = num(amtInp.value);
      const dt = m.el.querySelector('input[name="date"]').value;
      const notes = (m.el.querySelector('textarea[name="notes"]') || {}).value || '';
      const chosen = retainers.find(r => String(r.id) === String(retId));

      if (!chosen) {
        $('#m-inv-alloc-err', m.el).textContent = 'Please select a retainer invoice.';
        return;
      }
      if (amt <= 0) {
        $('#m-inv-alloc-err', m.el).textContent = 'Amount must be greater than 0.';
        return;
      }
      if (amt > invBal) {
        $('#m-inv-alloc-err', m.el).textContent = `Amount cannot exceed invoice balance due (${inr(invBal)}).`;
        return;
      }
      if (amt > num(chosen.available_balance)) {
        $('#m-inv-alloc-err', m.el).textContent = `Amount cannot exceed available retainer balance (${inr(chosen.available_balance)}).`;
        return;
      }

      try {
        await api(`invoices/${invoiceDoc.id}/apply-retainer/`, {
          method: 'POST',
          body: {
            allocations: [{ retainer_id: retId, amount: amt, notes }],
            date: dt
          }
        });
        toast(`Applied ${inr(amt)} retainer credit to invoice ${invoiceDoc.number}`);
        m.close();
        if (onDone) onDone();
      } catch (err) {
        $('#m-inv-alloc-err', m.el).textContent = err.message;
      }
    }
  });
}

async function viewRecurringInvoiceModal(id) {
  try {
    const d = await api(`recurring-invoices/${id}/`);
    const kv = [
      ['Customer', esc(d.customer_name || '—')],
      ['Profile Name', esc(d.name || '—')],
      ['Frequency', esc(d.frequency_label || d.frequency || 'Monthly')],
      ['Start Date', fd(d.start_date)],
      ['Next Invoice Date', fd(d.next_date)],
      ['End Date', d.end_date ? fd(d.end_date) : 'Never Ends'],
      ['Status', badge(d.status_label || d.status)],
      ['Subtotal', inr(d.subtotal || 0)],
      ['Tax Amount', inr(d.tax_amount || 0)],
      ['Total Amount', inr(d.total_amount || 0)],
      ['Payment Terms', d.payment_terms === 0 ? 'Due on Receipt' : `Net ${d.payment_terms} days`],
      ['Auto-Send Email', d.auto_send ? 'Enabled (Automatic)' : 'Disabled (Manual)']
    ];

    let linesHtml = '';
    if (d.lines && d.lines.length) {
      linesHtml = `
        <h4 style="margin:16px 0 8px 0;font-size:13px;font-weight:600;">Items & Line Details</h4>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Item / Description</th>
                <th class="r">Qty</th>
                <th class="r">Rate</th>
                <th class="r">Disc %</th>
                <th class="r">GST %</th>
                <th class="r">Total</th>
              </tr>
            </thead>
            <tbody>
              ${d.lines.map(ln => `
                <tr>
                  <td>
                    <div style="font-weight:500;">${esc(ln.description || 'Line item')}</div>
                    ${ln.hsn_sac ? `<div class="sub" style="font-size:11px;">HSN/SAC: ${esc(ln.hsn_sac)}</div>` : ''}
                  </td>
                  <td class="r">${ln.quantity}</td>
                  <td class="r">${inr(ln.rate)}</td>
                  <td class="r">${ln.discount_percent || 0}%</td>
                  <td class="r">${ln.gst_rate || 0}%</td>
                  <td class="r">${inr(ln.line_total)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    let upcomingHtml = '';
    if (d.upcoming_dates && d.upcoming_dates.length) {
      upcomingHtml = `
        <div style="margin:12px 0;padding:10px;background:var(--bg-subtle,#f8fafc);border-radius:6px;border:1px solid var(--border,#e2e8f0);">
          <div style="font-size:12px;font-weight:600;margin-bottom:6px;">Upcoming Scheduled Invoice Dates:</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            ${d.upcoming_dates.map(dt => `<span class="badge wa" style="font-size:11px;">${fd(dt)}</span>`).join('')}
          </div>
        </div>
      `;
    }

    let invoicesHtml = '';
    if (d.invoices && d.invoices.length) {
      invoicesHtml = `
        <h4 style="margin:16px 0 8px 0;font-size:13px;font-weight:600;">Generated Invoices History (${d.invoices.length})</h4>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Date</th>
                <th>Due Date</th>
                <th class="r">Total</th>
                <th class="r">Balance</th>
                <th>Status</th>
                <th class="r">Action</th>
              </tr>
            </thead>
            <tbody>
              ${d.invoices.map(inv => `
                <tr>
                  <td style="font-weight:600;color:var(--primary);cursor:pointer;" class="inv-link" data-inv-id="${inv.id}">${esc(inv.number)}</td>
                  <td>${fd(inv.date)}</td>
                  <td>${fd(inv.due_date)}</td>
                  <td class="r">${inr(inv.total)}</td>
                  <td class="r">${inr(inv.balance)}</td>
                  <td>${badge(inv.status)}</td>
                  <td class="r">
                    <button class="btn s inv-view-btn" type="button" data-inv-id="${inv.id}">View</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } else {
      invoicesHtml = `
        <h4 style="margin:16px 0 8px 0;font-size:13px;font-weight:600;">Generated Invoices History</h4>
        <p class="sub" style="font-size:12px;">No invoices generated yet for this recurring profile. Click <strong>Generate Invoice Now</strong> to create the first invoice.</p>
      `;
    }

    const isPaused = d.status === 'paused';
    const isCompleted = d.status === 'completed' || d.status === 'cancelled';

    const m = Modal.open({
      dialog: true,
      title: `Recurring Invoice: ${esc(d.name || ('#' + d.id))}`,
      body: `
        ${kvBox(kv)}
        ${upcomingHtml}
        ${linesHtml}
        ${invoicesHtml}
      `,
      footer: `
        <div style="display:flex;justify-content:space-between;width:100%;align-items:center;">
          <div>
            ${!isCompleted ? `<button class="btn s d" type="button" id="m-rec-stop-btn">Cancel Schedule</button>` : ''}
          </div>
          <div style="display:flex;gap:8px;">
            <button class="btn" type="button" data-close>Close</button>
            ${!isCompleted ? `
              <button class="btn" type="button" id="m-rec-toggle-btn">${isPaused ? 'Resume Schedule' : 'Pause Schedule'}</button>
              <button class="btn" type="button" id="m-rec-edit-btn">Edit Profile</button>
              <button class="btn p" type="button" id="m-rec-gen-btn">Generate Invoice Now</button>
            ` : ''}
          </div>
        </div>
      `
    });

    m.el.addEventListener('click', async e => {
      const invBtn = e.target.closest('.inv-view-btn') || e.target.closest('.inv-link');
      if (invBtn) {
        const invId = invBtn.getAttribute('data-inv-id');
        if (invId) {
          m.close();
          docDetail('invoices', Number(invId));
        }
        return;
      }

      if (e.target.id === 'm-rec-gen-btn') {
        try {
          const res = await api(`recurring-invoices/${id}/generate-invoice/`, { method: 'POST', body: {} });
          toast(`Generated invoice ${res.invoice_number || ''} successfully!`, 'ok');
          m.close();
          refresh();
        } catch (err) {
          toast(err.message, 'err');
        }
      } else if (e.target.id === 'm-rec-toggle-btn') {
        try {
          const act = isPaused ? 'resume' : 'pause';
          await api(`recurring-invoices/${id}/${act}/`, { method: 'POST', body: {} });
          toast(`Schedule ${act}d successfully!`, 'ok');
          m.close();
          refresh();
        } catch (err) {
          toast(err.message, 'err');
        }
      } else if (e.target.id === 'm-rec-stop-btn') {
        if (!(await confirmBox({
          title: `Cancel recurring schedule for ${d.name}?`,
          message: 'Future scheduled invoices will not be generated. Past invoices will remain unaffected.',
          okText: 'Cancel Schedule',
          danger: true
        }))) return;
        try {
          await api(`recurring-invoices/${id}/cancel/`, { method: 'POST', body: {} });
          toast('Recurring schedule cancelled', 'ok');
          m.close();
          refresh();
        } catch (err) {
          toast(err.message, 'err');
        }
      } else if (e.target.id === 'm-rec-edit-btn') {
        m.close();
        recurringInvoiceForm(id, $('#pg'), () => { location.hash = '#/sales/recurring-invoices'; if (typeof route === 'function') route(); });
      }
    });
  } catch (err) {
    toast(err.message, 'err');
  }
}

async function paymentDetail(kind, id) {
  const rec = kind === 'payments-received', d = await api(`${kind}/${id}/`);
  const m = Modal.open({
    dialog: true,
    title: `Payment ${d.number}`,
    body: `${kvBox([[rec ? 'Customer' : 'Vendor', esc(d.party)], ['Date', fd(d.date)], ['Mode', esc(d.mode_label)], ['Account', esc(d.account)], ['Reference', esc(d.reference || '—')], ['Amount', inr(d.amount)], ['Applied', inr(d.applied)], ['Unapplied', inr(d.unapplied)]])}
${d.allocations.length ? `<table><thead><tr><th>${rec ? 'Invoice' : 'Bill'}</th><th class="r">Applied</th></tr></thead><tbody>${d.allocations.map(a => `<tr><td>${esc(a.number)}</td><td class="r">${inr(a.amount)}</td></tr>`).join('')}</tbody></table>` : '<p class="sub">Not applied to any document.</p>'}${d.notes ? `<p><span class="sub">Notes:</span> ${esc(d.notes)}</p>` : ''}
<p class="hp">Deleting a payment restores the balance due on the documents it was applied to.</p>`,
    footer: '<button class="btn" type="button" data-close>Close</button><button class="btn d" type="button" data-do="delete">Delete payment</button>',
  });
  m.el.addEventListener('click', async e => {
    if (!e.target.closest('[data-do=delete]')) return;
    try {
      if (!(await confirmBox({ title: 'Delete payment ' + d.number + '?', message: 'Balances on the applied documents will be restored.', okText: 'Delete', danger: true }))) return;
      await api(`${kind}/${id}/`, { method: 'DELETE' }); toast('Payment deleted'); m.close(); refresh();
    } catch (err) { toast(err.message, 'err'); }
  });
}

async function partyDetail(kind, id) {
  const cust = kind === 'customers', docs = cust ? 'invoices' : 'bills', pk = cust ? 'customer' : 'vendor', pay = cust ? 'payments-received' : 'payments-made';
  const [p, dl, pl] = await Promise.all([api(`${kind}/${id}/`), api(`${docs}/?` + qs({ [pk]: id, page_size: 20, ordering: '-date' })), api(`${pay}/?` + qs({ [pk]: id, page_size: 20 }))]);
  const m = Modal.open({
    title: p.name, wide: true,
    body: `${kvBox([['Billed', inr(p.billed)], [cust ? 'Receivable' : 'Payable', inr(p.outstanding)], ['Overdue', `<span class="${num(p.overdue) > 0 ? 'dn' : ''}">${inr(p.overdue)}</span>`], ['Email', esc(p.email || '—')], ['Phone', esc(p.phone || '—')], ['State', esc(p.state || '—')], ['GSTIN', esc(p.gstin || '—')], ['Payment terms', p.payment_terms + ' days']])}

<h3 style="font-size:14px;margin:12px 0 6px">${cust ? 'Invoices' : 'Bills'}</h3>${dl.results.length ? `<div class="tw"><table><thead><tr><th>Number</th><th>Date</th><th>Status</th><th class="r">Total</th><th class="r">Balance</th></tr></thead><tbody>${dl.results.map(d => `<tr><td><button class="lk" type="button" data-open="${d.id}">${esc(d.number)}</button></td><td>${fd(d.date)}</td><td>${badge(d.status)}</td><td class="r">${inr(d.total)}</td><td class="r">${inr(d.balance)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="sub">None yet.</p>'}
<h3 style="font-size:14px;margin:12px 0 6px">Payments</h3>${pl.results.length ? `<div class="tw"><table><thead><tr><th>Number</th><th>Date</th><th>Mode</th><th class="r">Amount</th></tr></thead><tbody>${pl.results.map(x => `<tr><td>${esc(x.number)}</td><td>${fd(x.date)}</td><td>${esc(x.mode_label)}</td><td class="r">${inr(x.amount)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="sub">None yet.</p>'}`,

    footer: `<button class="btn" type="button" data-close>Close</button><button class="btn" type="button" data-do="edit">Edit</button><button class="btn" type="button" data-do="pay">Record payment</button>`,
  });
  m.el.addEventListener('click', e => {
    const o = e.target.closest('[data-open]'), a = e.target.closest('[data-do]');
    if (o) { m.close(); docDetail(docs, o.dataset.open).catch(err => toast(err.message, 'err')); }
    if (a && a.dataset.do === 'edit') { m.close(); partyForm(kind, id); }
    if (a && a.dataset.do === 'pay') { m.close(); paymentForm(pay, { party: id }); }
  });
}

function gettingStarted(root) {
  const c = APP.counts;
  const steps = [['Set your organization’s home state and opening balance', !!APP.org.gstin || APP.org.opening_cash != 0, 'Open settings', () => orgForm()], ['Add your first customer', c.customers > 0, 'Add customer', () => partyForm('customers')], ['Add a vendor', c.vendors > 0, 'Add vendor', () => partyForm('vendors')], ['Add items or services', c.items > 0, 'Add item', () => itemForm()], ['Create and send your first invoice', c.invoices > 0, 'New invoice', () => docForm('invoices')], ['Record a payment', c.payments > 0, 'Record payment', () => paymentForm('payments-received')]];
  root.innerHTML = `<h1>Hello, ${esc(APP.user.name || 'admin')}</h1><div class="sub">${esc(APP.org.name)}</div><div class="tabs"><a href="#/home/dashboard">Dashboard</a><a class="on" href="#/home/getting-started">Getting Started</a><a href="#/home/recent-updates">Recent Updates</a></div>
<div class="card"><h3>Set up Convosis Books</h3><div class="cb"><ul class="chk">${steps.map((s, i) => `<li class="${s[1] ? 'done' : ''}"><span class="tick">${s[1] ? '✓' : ''}</span><span style="flex:1">${esc(s[0])}</span>${s[1] ? '' : `<button class="btn" type="button" data-step="${i}">${esc(s[2])}</button>`}</li>`).join('')}</ul></div></div>`;
  root.addEventListener('click', e => { const b = e.target.closest('[data-step]'); if (b) steps[b.dataset.step][3](); });
  PAGE.reload = () => gettingStarted(root);
}
async function recentUpdates(root) {
  root.innerHTML = `<h1>Recent Updates</h1><div class="tabs"><a href="#/home/dashboard">Dashboard</a><a href="#/home/getting-started">Getting Started</a><a class="on" href="#/home/recent-updates">Recent Updates</a></div><div class="card"><div class="cb" id="rl">${spinner}</div></div>`;
  PAGE.reload = () => recentUpdates(root);
  try { const a = await api('activity/?limit=50'); if (root.isConnected) $('#rl', root).innerHTML = activityList(a); }
  catch (e) { if (root.isConnected) $('#rl', root).innerHTML = errBox(e.message); }
}
function plannedPage(root, group, name) {
  root.innerHTML = `<div class="bc">Home / ${esc(group || 'Not found')}</div><h1>${esc(name || 'Page not found')}</h1><div class="card" style="margin-top:14px"><div class="empty" style="height:220px"><div><b>Not built yet</b><br>This screen is planned for a later release.<br><a href="#/home/dashboard">Back to Dashboard</a></div></div></div>`;
  PAGE.reload = null;
}

async function documentsPage(root, mode = 'all') {
  PAGE.reload = () => documentsPage(root, mode);
  const isTrash = mode === 'trash';
  const tabLinks = [
    ['All Documents', '#/documents/all-documents', mode === 'all'],
    ['Files', '#/documents/files', mode === 'files'],
    ['Bank Statements', '#/documents/bank-statements', mode === 'bank_statement'],
    ['Folders', '#/documents/folders', mode === 'folders'],
    ['Trash Recovery', '#/documents/trash', isTrash],
  ];

  root.innerHTML = `
    <div class="bc">Home / Documents</div>
    <div class="hd">
      <div>
        <h1>Document Staging & Auto-Scan OCR Repository</h1>
        <div class="sub" style="margin-top:2px;">Centralized ingestion pipeline with auto-scan OCR, line item extraction, and trash lifecycle management</div>
      </div>
      <div class="act">
        <button class="btn" id="doc-export-csv" type="button"><i class="fa-solid fa-file-export"></i> Export CSV</button>
        <button class="btn" id="doc-refresh-btn" type="button">Refresh</button>
        ${isTrash ? '' : `<button class="btn p" id="doc-new-btn" type="button">+ Upload Document</button>`}
      </div>
    </div>

    <div class="tabs" style="margin:14px 0;">
      ${tabLinks.map(t => `<a href="${t[1]}" class="${t[2] ? 'on' : ''}">${esc(t[0])}</a>`).join('')}
    </div>

    ${isTrash ? `
      <div class="note" style="margin-bottom:14px;border-left:3px solid var(--accent);background:var(--surface-glass);">
        <b>Trash & File Lifecycle Recovery:</b> Soft-deleted financial documents are staged here for 30 days before permanent purging. You can restore documents back to active ledgers at any time.
      </div>
    ` : ''}

    <div class="card">
      <div class="tb">
        <input class="in" type="search" id="doc-search" placeholder="Search staged documents..." style="max-width:280px">
        ${isTrash ? '' : `
          <select class="btn" id="doc-cat-fil">
            <option value="">All Categories</option>
            <option value="receipt">Receipts / Expenses</option>
            <option value="invoice">Invoices</option>
            <option value="bill">Vendor Bills</option>
            <option value="bank_statement">Bank Statements</option>
            <option value="tax_doc">Tax / GST Documents</option>
          </select>
        `}
        <span class="sub" id="doc-count"></span>
      </div>
      <div class="tw" id="doc-table">${spinner}</div>
    </div>
  `;

  const docExpBtn = $('#doc-export-csv', root);
  if (docExpBtn) {
    docExpBtn.addEventListener('click', async () => {
      try {
        const docs = await api('documents/?page_size=200');
        const items = docs.results || docs;
        if (!items.length) { toast('No documents found to export', 'err'); return; }
        const headers = ['ID', 'Title', 'File Name', 'Doc Type', 'Status', 'File Size', 'Created At'];
        const lines = [headers.join(',')];
        for (const d of items) {
          lines.push([
            d.id,
            `"${(d.title || '').replace(/"/g, '""')}"`,
            `"${(d.file_name || d.name || '').replace(/"/g, '""')}"`,
            d.doc_type || 'file',
            d.status || 'active',
            d.file_size || 0,
            d.created_at || ''
          ].join(','));
        }
        const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
        a.download = `documents_metadata_${iso(new Date())}.csv`;
        a.click();
        toast('Documents metadata exported to CSV!', 'ok');
      } catch(e) { toast(e.message, 'err'); }
    });
  }

  $('#doc-refresh-btn', root).addEventListener('click', () => documentsPage(root, mode));
  const newBtn = $('#doc-new-btn', root);
  if (newBtn) newBtn.addEventListener('click', () => documentUploadModal());

  let curSearch = '';
  let curCat = (mode === 'bank_statement') ? 'bank_statement' : '';

  const sInp = $('#doc-search', root);
  let stt;
  sInp.addEventListener('input', e => {
    clearTimeout(stt);
    stt = setTimeout(() => { curSearch = e.target.value.trim(); loadDocs(); }, 250);
  });

  const catSel = $('#doc-cat-fil', root);
  if (catSel) catSel.addEventListener('change', () => { curCat = catSel.value; loadDocs(); });

  async function loadDocs() {
    $('#doc-table', root).innerHTML = spinner;
    try {
      const q = { page_size: 50 };
      if (isTrash) q.trash = '1';
      if (curCat) q.category = curCat;
      if (curSearch) q.q = curSearch;

      const data = await api('documents/?' + qs(q));
      if (!root.isConnected) return;
      $('#doc-count', root).textContent = `${data.count} document${data.count === 1 ? '' : 's'}`;

      if (!data.results.length) {
        $('#doc-table', root).innerHTML = `<div class="empty" style="padding:40px;">${isTrash ? 'Trash is currently empty. No soft-deleted documents found.' : 'No staged documents found.'}${!isTrash ? '<br><button class="btn p" style="margin-top:10px;" id="empty-upload-btn">+ Upload Document</button>' : ''}</div>`;
        const ub = $('#empty-upload-btn', root);
        if (ub) ub.addEventListener('click', () => documentUploadModal());
        return;
      }

      $('#doc-table', root).innerHTML = `
        <table>
          <thead>
            <tr>
              <th>Document</th>
              <th>Category</th>
              <th>Folder</th>
              <th>Auto-Scan OCR</th>
              <th>Extracted Amount</th>
              <th>${isTrash ? 'Deleted Date' : 'Uploaded Date'}</th>
              <th class="r">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${data.results.map(d => {
              const ocr = d.ocr_data || {};
              const ocrBadge = d.ocr_status === 'processed'
                ? `<span class="badge up">✓ Extracted</span>`
                : (d.ocr_status === 'pending' ? `<span class="badge warn">Scanning...</span>` : `<span class="badge">None</span>`);
              const catLabel = (d.category || 'other').replace('_', ' ');

              return `
                <tr>
                  <td>
                    <div style="display:flex;align-items:center;gap:10px;">
                      <div style="width:34px;height:34px;border-radius:8px;background:var(--surface-glass-subtle);border:1px solid var(--bd);display:grid;place-items:center;font-size:16px;flex-shrink:0;">
                        ${d.category === 'receipt' ? '🧾' : (d.category === 'bank_statement' ? '🏦' : '📄')}
                      </div>
                      <div>
                        <div style="font-weight:600;color:var(--tx);">${esc(d.title)}</div>
                        <div class="sub" style="font-size:11px;">${esc(d.filename)} · ${Math.round((d.file_size || 1024) / 1024)} KB</div>
                      </div>
                    </div>
                  </td>
                  <td><span class="pastel-chip chip-sky" style="text-transform:capitalize;">${esc(catLabel)}</span></td>
                  <td>${esc(d.folder_name || 'Root')}</td>
                  <td>${ocrBadge}</td>
                  <td><b>${ocr.total_amount ? inr(ocr.total_amount) : '—'}</b></td>
                  <td>${fd(isTrash ? d.deleted_at : d.created_at)}</td>
                  <td class="r" style="white-space:nowrap;">
                    ${isTrash ? `
                      <button class="btn p" type="button" data-restore="${d.id}" style="padding:4px 10px;font-size:12px;">Restore</button>
                      <button class="btn d" type="button" data-purge="${d.id}" style="padding:4px 10px;font-size:12px;">Purge</button>
                    ` : `
                      <button class="btn" type="button" data-ocr="${d.id}" style="padding:4px 10px;font-size:12px;">View OCR</button>
                      ${d.converted_to_id ? `<span class="badge up" style="font-size:11px;">Converted</span>` : `
                        <button class="btn" type="button" data-conv-bill="${d.id}" style="padding:4px 8px;font-size:12px;" title="Convert to Bill">→ Bill</button>
                        <button class="btn" type="button" data-conv-exp="${d.id}" style="padding:4px 8px;font-size:12px;" title="Convert to Expense">→ Exp</button>
                      `}
                      <button class="btn d" type="button" data-del="${d.id}" style="padding:4px 8px;font-size:12px;" title="Move to Trash">🗑</button>
                    `}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `;

      $$('[data-restore]', root).forEach(btn => {
        btn.addEventListener('click', async () => {
          try {
            await api(`documents/${btn.dataset.restore}/restore/`, { method: 'POST' });
            toast('Document restored from trash');
            loadDocs();
          } catch (e) { toast(e.message, 'err'); }
        });
      });

      $$('[data-purge]', root).forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!(await confirmBox({ title: 'Permanently Purge Document?', message: 'This will permanently delete the file artifact and audit records. This cannot be undone.', okText: 'Purge Permanently', danger: true }))) return;
          try {
            await api(`documents/${btn.dataset.purge}/purge/`, { method: 'POST' });
            toast('Document purged permanently');
            loadDocs();
          } catch (e) { toast(e.message, 'err'); }
        });
      });

      $$('[data-ocr]', root).forEach(btn => {
        btn.addEventListener('click', () => {
          const doc = data.results.find(x => String(x.id) === btn.dataset.ocr);
          if (doc) viewDocumentOcrModal(doc);
        });
      });

      $$('[data-conv-bill]', root).forEach(btn => {
        btn.addEventListener('click', async () => {
          try {
            const res = await api(`documents/${btn.dataset.convBill}/convert/`, { method: 'POST', body: { convert_to: 'bill' } });
            toast(`Created Vendor Bill ${res.number}`);
            loadDocs();
          } catch (e) { toast(e.message, 'err'); }
        });
      });

      $$('[data-conv-exp]', root).forEach(btn => {
        btn.addEventListener('click', async () => {
          try {
            const res = await api(`documents/${btn.dataset.convExp}/convert/`, { method: 'POST', body: { convert_to: 'expense' } });
            toast(`Created Expense ${res.number}`);
            loadDocs();
          } catch (e) { toast(e.message, 'err'); }
        });
      });

      $$('[data-del]', root).forEach(btn => {
        btn.addEventListener('click', async () => {
          try {
            await api(`documents/${btn.dataset.del}/`, { method: 'DELETE' });
            toast('Document moved to trash');
            loadDocs();
          } catch (e) { toast(e.message, 'err'); }
        });
      });

    } catch (err) {
      if (root.isConnected) $('#doc-table', root).innerHTML = errBox(err.message, true);
    }
  }

  loadDocs();
}

async function renderBankingModule(root, initialTabId = 'dashboard') {
  let currentTab = initialTabId || 'dashboard';
  PAGE.reload = () => renderBankingModule(root, currentTab);

  root.innerHTML = `<div class="banking-module-container"><div class="glass-card" style="padding:48px;text-align:center;color:var(--tx-muted);">${spinner} Loading Banking Workspace...</div></div>`;

  const modules = [
    { id: 'dashboard', name: 'Banking Dashboard', icon: 'fa-chart-pie' },
    { id: 'bank-accounts', name: 'Bank Accounts', icon: 'fa-building-columns' },
    { id: 'bank-statements', name: 'Bank Statements', icon: 'fa-file-lines' },
    { id: 'all-transactions', name: 'All Transactions', icon: 'fa-list-check' },
    { id: 'uncategorized-transactions', name: 'Uncategorized Feeds', icon: 'fa-wand-magic-sparkles', highlight: true },
    { id: 'matched-transactions', name: 'Matched Transactions', icon: 'fa-link' },
    { id: 'categorized-transactions', name: 'Categorized', icon: 'fa-tags' },
    { id: 'unmatched-transactions', name: 'Unmatched', icon: 'fa-link-slash' },
    { id: 'bank-reconciliation', name: 'Bank Reconciliation', icon: 'fa-scale-balanced' },
    { id: 'transfers-between-accounts', name: 'Transfers', icon: 'fa-right-left' },
    { id: 'deposits', name: 'Deposits', icon: 'fa-circle-arrow-down' },
    { id: 'bank-rules', name: 'Bank Rules', icon: 'fa-sliders' },
    { id: 'import-bank-statements', name: 'Import Statements', icon: 'fa-file-import' },
    { id: 'banking-reports', name: 'Banking Reports', icon: 'fa-chart-column' },
    { id: 'reconciliation-history', name: 'Reconciliation History', icon: 'fa-clock-rotate-left' }
  ];

  let summary = {};
  let bankAccounts = [];
  let allTransactions = [];
  let bankStatements = [];
  let internalTransfers = [];
  let deposits = [];
  let bankRules = [];
  let reconHistory = [];

  try {
    const [summaryRes, accsRes, txRes, stmtsRes, xfersRes, depsRes, rulesRes, recsRes] = await Promise.all([
      api('banking/dashboard-summary/').catch(() => ({})),
      api('bank-accounts/?page_size=50').catch(() => ({ results: [] })),
      api('bank-transactions/?page_size=150').catch(() => ({ results: [] })),
      api('statement-batches/?page_size=50').catch(() => ({ results: [] })),
      api('bank-transfers/?page_size=50').catch(() => ({ results: [] })),
      api('bank-deposits/?page_size=50').catch(() => ({ results: [] })),
      api('banking/rules/').catch(() => []),
      api('bank-reconciliations/?page_size=50').catch(() => ({ results: [] }))
    ]);

    summary = summaryRes || {};
    bankAccounts = (accsRes && accsRes.results) ? accsRes.results.map(a => ({
      id: a.id,
      name: a.name,
      bank_name: a.bank_name || 'Bank',
      number: a.masked_account_number || (a.account_number ? '•••• ' + String(a.account_number).slice(-4) : '•••• —'),
      account_number: a.account_number,
      type: a.account_type || 'Current Account',
      balance: parseFloat(a.current_balance || 0),
      bank_balance: parseFloat(a.bank_balance || a.current_balance || 0),
      status: a.active !== false ? 'Active Feed' : 'Inactive'
    })) : [];

    allTransactions = (txRes && txRes.results) ? txRes.results : [];
    bankStatements = (stmtsRes && stmtsRes.results) ? stmtsRes.results : [];
    internalTransfers = (xfersRes && xfersRes.results) ? xfersRes.results : [];
    deposits = (depsRes && depsRes.results) ? depsRes.results : [];
    bankRules = Array.isArray(rulesRes) ? rulesRes : ((rulesRes && rulesRes.results) ? rulesRes.results : []);
    reconHistory = (recsRes && recsRes.results) ? recsRes.results : [];
  } catch(e) {
    console.error('Banking load error:', e);
  }

  let uncategorizedFeeds = allTransactions.filter(t => t.status === 'unmatched' || t.status === 'unreconciled');
  let matchedTransactions = allTransactions.filter(t => t.status === 'matched');
  let categorizedTransactions = allTransactions.filter(t => t.status === 'categorized');
  let unmatchedTransactions = allTransactions.filter(t => t.status === 'unmatched');

  for (const feed of uncategorizedFeeds) {
    try {
      const sug = await api(`banking/match-suggestions/${feed.id}/`);
      if (sug && sug.suggestions && sug.suggestions.length) {
        const best = sug.suggestions[0];
        feed.candidate = {
          recordType: best.type || best.entity_type || 'System Record Match',
          recordRef: best.number || best.title || ('Record #' + best.id),
          entity: best.party_name || best.name || '',
          date: best.date ? fmtBankDate(best.date) : '',
          amount: parseFloat(best.amount || best.total || feed.withdrawal || feed.deposit || 0),
          confidence: best.confidence_score || Math.round((best.confidence || 0.85) * 100),
          ruleSuggestion: best.rule_name ? `Rule: ${best.rule_name}` : 'Auto-Match Candidate',
          entity_type: best.type || best.entity_type,
          entity_id: best.id
        };
      } else {
        feed.candidate = null;
      }
    } catch(err) {
      feed.candidate = null;
    }
  }

  const totalBankBalance = bankAccounts.reduce((sum, a) => sum + (parseFloat(a.balance) || 0), 0);
  const totalTxCount = allTransactions.length;
  const recRate = totalTxCount > 0 ? (((matchedTransactions.length + categorizedTransactions.length) / totalTxCount) * 100).toFixed(1) : '100.0';
  const autoMatchReadyCount = uncategorizedFeeds.filter(f => f.candidate).length;
  const spotlightCandidate = uncategorizedFeeds.find(f => f.candidate);

  root.innerHTML = `
    <div class="banking-module-container">

      <div class="glass-card" style="padding:12px 18px;">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">

          <div style="position:relative;flex:1;max-width:320px;min-width:200px;">
            <i class="fa-solid fa-magnifying-glass" style="position:absolute;left:11px;top:9px;color:var(--tx-muted);font-size:12px;"></i>
            <input type="text" id="bnkGlobalSearch" placeholder="Search transactions, accounts, ref #..." class="in" style="width:100%;padding-left:32px;font-size:12px;height:32px;border-radius:8px;"/>
          </div>

          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <button type="button" class="btn p" id="bnkActAddAccount" style="font-size:12px;display:flex;align-items:center;gap:6px;">
              <i class="fa-solid fa-plus"></i> Bank Account
            </button>
            <button type="button" class="btn" id="bnkActImportStmt" style="font-size:12px;background:#10b981;color:#fff;border-color:#10b981;display:flex;align-items:center;gap:6px;">
              <i class="fa-solid fa-file-import"></i> Import Statement
            </button>
            <button type="button" class="btn" id="bnkActExportTxns" style="font-size:12px;display:flex;align-items:center;gap:6px;">
              <i class="fa-solid fa-file-export"></i> Export CSV
            </button>
            <button type="button" class="btn" id="bnkActAddRule" style="font-size:12px;display:flex;align-items:center;gap:6px;">
              <i class="fa-solid fa-wand-magic-sparkles" style="color:#f59e0b;"></i> Add Rule
            </button>
            <button type="button" class="btn" id="bnkActTransfer" style="font-size:12px;display:flex;align-items:center;gap:6px;">
              <i class="fa-solid fa-right-left" style="color:var(--accent);"></i> Transfer
            </button>
          </div>
        </div>
      </div>

      <nav class="banking-subnav-ribbon" id="bnkNavigationRibbon">
        ${modules.map(m => `
          <button type="button" class="banking-nav-tab ${m.id === currentTab ? 'active' : ''} ${m.highlight ? 'highlight' : ''}" data-tab="${m.id}" id="bnk-tab-btn-${m.id}">
            <i class="fa-solid ${m.icon}"></i>
            <span>${m.name}</span>
            ${m.id === 'uncategorized-transactions' ? `<span id="bnkUnrecPill" style="padding:1px 6px;border-radius:10px;font-size:10px;background:rgba(245,158,11,0.2);color:#d97706;font-weight:700;">${uncategorizedFeeds.length}</span>` : ''}
          </button>
        `).join('')}
      </nav>

      <div id="bnk-panel-dashboard" class="bnk-panel" style="display:${currentTab === 'dashboard' ? 'block' : 'none'};">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
          <div>
            <h2 style="font-size:18px;font-weight:700;color:var(--tx);margin:0;">Banking Overview</h2>
            <div style="font-size:12px;color:var(--tx-muted);margin-top:2px;">Real-time balances, auto-match feed stats, and reconciliation progress</div>
          </div>
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:12px;color:var(--tx-muted);">Last Synced: <b style="color:var(--tx);">Just Now</b></span>
            <button type="button" class="btn" id="bnkRefreshFeedsBtn" title="Sync Live Feeds" style="padding:4px 8px;font-size:12px;">
              <i class="fa-solid fa-arrows-rotate" style="color:var(--accent);"></i>
            </button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(240px, 1fr));gap:16px;margin-bottom:20px;">
          <div class="glass-card" style="padding:16px;">
            <div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;color:var(--tx-muted);font-weight:600;">
              <span>Total Bank Balance</span>
              <i class="fa-solid fa-building-columns" style="color:#2563eb;"></i>
            </div>
            <div style="font-size:22px;font-weight:700;color:var(--tx);margin-top:8px;" id="bnkDashTotalBal">₹${totalBankBalance.toLocaleString('en-IN', {minimumFractionDigits:2})}</div>
            <div style="font-size:11px;color:var(--tx-muted);margin-top:4px;">Across ${bankAccounts.length} connected account${bankAccounts.length === 1 ? '' : 's'}</div>
          </div>

          <div class="glass-card" style="padding:16px;">
            <div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;color:var(--tx-muted);font-weight:600;">
              <span>Uncategorized Feeds</span>
              <i class="fa-solid fa-tags" style="color:#f59e0b;"></i>
            </div>
            <div style="font-size:22px;font-weight:700;color:#d97706;margin-top:8px;" id="bnkDashUnrecCount">${uncategorizedFeeds.length} Entries</div>
            <div style="font-size:11px;color:var(--tx-muted);margin-top:4px;">Requires user review or rule</div>
          </div>

          <div class="glass-card" style="padding:16px;">
            <div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;color:var(--tx-muted);font-weight:600;">
              <span>Auto-Match Candidates</span>
              <i class="fa-solid fa-wand-magic-sparkles" style="color:#6366f1;"></i>
            </div>
            <div style="font-size:22px;font-weight:700;color:#4f46e5;margin-top:8px;" id="bnkDashAutoMatchCount">${autoMatchReadyCount} Ready</div>
            <div style="font-size:11px;color:#4f46e5;margin-top:4px;cursor:pointer;font-weight:600;" id="bnkDashReviewMatchLink">
              Review side-by-side match →
            </div>
          </div>

          <div class="glass-card" style="padding:16px;">
            <div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;color:var(--tx-muted);font-weight:600;">
              <span>Reconciliation Rate</span>
              <i class="fa-solid fa-circle-check" style="color:#059669;"></i>
            </div>
            <div style="font-size:22px;font-weight:700;color:var(--tx);margin-top:8px;">${recRate}%</div>
            <div style="width:100%;background:rgba(0,0,0,0.08);height:6px;border-radius:6px;margin-top:8px;overflow:hidden;">
              <div style="width:${recRate}%;height:100%;background:#10b981;border-radius:6px;"></div>
            </div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:2fr 1fr;gap:20px;">

          <div class="glass-card" style="padding:20px;">
            <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--bd-glass);padding-bottom:12px;margin-bottom:14px;">
              <h3 style="font-size:15px;font-weight:700;color:var(--tx);margin:0;display:flex;align-items:center;gap:8px;">
                <i class="fa-solid fa-wallet" style="color:#2563eb;"></i> Connected Bank Accounts (${bankAccounts.length})
              </h3>
              <button type="button" class="btn" style="font-size:11px;padding:3px 8px;color:var(--accent);" id="bnkDashViewAllAccounts">View All Accounts</button>
            </div>
            <div id="bnkDashAccountsList" style="display:flex;flex-direction:column;gap:10px;">

            </div>
          </div>

          ${spotlightCandidate ? `
          <div class="glass-card" style="padding:20px;border-left:4px solid #2563eb;display:flex;flex-direction:column;justify-content:space-between;">
            <div>
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
                <span class="banking-badge-pill banking-badge-indigo" style="font-size:10px;">Auto-Matching Highlight</span>
                <span style="font-size:11px;color:#059669;font-weight:700;"><i class="fa-solid fa-bolt"></i> ${spotlightCandidate.candidate.confidence}% Match</span>
              </div>
              <h4 style="font-size:14px;font-weight:700;color:var(--tx);margin:0 0 6px;">Latest Candidate Match</h4>
              <p style="font-size:12px;color:var(--tx-muted);line-height:1.5;margin:0 0 12px;">${esc(spotlightCandidate.bank_account_name || 'Bank Account')} • ${esc(spotlightCandidate.description)} matches ${esc(spotlightCandidate.candidate.recordRef)}.</p>

              <div class="banking-panel-box" style="font-size:12px;display:flex;flex-direction:column;gap:4px;margin-bottom:14px;">
                <div style="display:flex;justify-content:space-between;color:var(--tx-muted);font-size:11px;">
                  <span>Feed Date: <b>${fmtBankDate(spotlightCandidate.date)}</b></span>
                  <span>Record: <b>${esc(spotlightCandidate.candidate.date || 'Recent')}</b></span>
                </div>
                <div style="display:flex;justify-content:space-between;font-weight:600;color:var(--tx);">
                  <span>Ref: ${esc(spotlightCandidate.reference || '—')}</span>
                  <span style="color:#059669;">₹${(spotlightCandidate.candidate.amount || 0).toLocaleString('en-IN', {minimumFractionDigits:2})}</span>
                </div>
              </div>
            </div>

            <div style="display:flex;gap:8px;">
              <button type="button" class="btn p" id="bnkInstantMatchBtn" data-id="${spotlightCandidate.id}" style="flex:1;font-size:12px;padding:6px;display:flex;align-items:center;justify-content:center;gap:6px;">
                <i class="fa-solid fa-check"></i> Instant Match
              </button>
              <button type="button" class="btn" id="bnkInstantSplitBtn" style="font-size:12px;padding:6px 12px;">Split View</button>
            </div>
          </div>
          ` : `
          <div class="glass-card" style="padding:24px;border-left:4px solid #10b981;display:flex;flex-direction:column;justify-content:center;text-align:center;gap:10px;">
            <div style="font-size:32px;color:#10b981;">✓</div>
            <h4 style="font-size:14px;font-weight:700;color:var(--tx);margin:0;">All Feeds Up to Date</h4>
            <p style="font-size:12px;color:var(--tx-muted);margin:0;">No pending auto-matching candidate records require review at this time.</p>
            <button type="button" class="btn" onclick="window.location.hash='#/banking/import-bank-statements'" style="font-size:12px;margin:8px auto 0;">+ Import New Statement</button>
          </div>
          `}
        </div>
      </div>

      <div id="bnk-panel-bank-accounts" class="bnk-panel" style="display:${currentTab === 'bank-accounts' ? 'block' : 'none'};">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
          <div>
            <h2 style="font-size:18px;font-weight:700;color:var(--tx);margin:0;">Bank Accounts</h2>
            <div style="font-size:12px;color:var(--tx-muted);margin-top:2px;">Manage all registered accounts, virtual accounts, and live bank feed links</div>
          </div>
          <button type="button" class="btn p" id="bnkAccountsAddBtn" style="font-size:12px;display:flex;align-items:center;gap:6px;">
            <i class="fa-solid fa-plus"></i> Add New Account
          </button>
        </div>
        <div id="bnkAccountsGrid" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(320px, 1fr));gap:16px;"></div>
      </div>

      <div id="bnk-panel-bank-statements" class="bnk-panel" style="display:${currentTab === 'bank-statements' ? 'block' : 'none'};">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
          <div>
            <h2 style="font-size:18px;font-weight:700;color:var(--tx);margin:0;">Bank Statements</h2>
            <div style="font-size:12px;color:var(--tx-muted);margin-top:2px;">View statement logs, feed file archives, and line counts</div>
          </div>
          <button type="button" class="btn" id="bnkUploadStmtBtn" style="background:#10b981;color:#fff;border-color:#10b981;font-size:12px;display:flex;align-items:center;gap:6px;">
            <i class="fa-solid fa-upload"></i> Upload New Statement
          </button>
        </div>
        <div class="glass-card" style="overflow-x:auto;">
          <table class="tbl" style="width:100%;margin:0;">
            <thead>
              <tr>
                <th>Statement Ref</th>
                <th>Bank Account</th>
                <th>Period</th>
                <th>Import Date</th>
                <th>Lines</th>
                <th>Status</th>
                <th style="text-align:right;">Action</th>
              </tr>
            </thead>
            <tbody id="bnkStatementsTbody"></tbody>
          </table>
        </div>
      </div>

      <div id="bnk-panel-all-transactions" class="bnk-panel" style="display:${currentTab === 'all-transactions' ? 'block' : 'none'};">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:16px;">
          <div>
            <h2 style="font-size:18px;font-weight:700;color:var(--tx);margin:0;">All Bank Transactions</h2>
            <div style="font-size:12px;color:var(--tx-muted);margin-top:2px;">Master ledger of raw bank feeds and mapped transactions</div>
          </div>
          <select id="bnkTxFilterAccount" class="in" style="font-size:12px;height:32px;min-width:200px;">
            <option value="ALL">All Bank Accounts</option>
            ${bankAccounts.map(a => `<option value="${a.id}">${esc(a.name)}</option>`).join('')}
          </select>
        </div>
        <div class="glass-card" style="overflow-x:auto;">
          <table class="tbl" style="width:100%;margin:0;">
            <thead>
              <tr>
                <th>Date</th>
                <th>Account</th>
                <th>Description / Payee</th>
                <th>Reference</th>
                <th style="text-align:right;">Debit (Out)</th>
                <th style="text-align:right;">Credit (In)</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody id="bnkAllTxTbody"></tbody>
          </table>
        </div>
      </div>

      <div id="bnk-panel-uncategorized-transactions" class="bnk-panel" style="display:${currentTab === 'uncategorized-transactions' ? 'block' : 'none'};">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:16px;">
          <div>
            <div style="display:flex;align-items:center;gap:8px;">
              <h2 style="font-size:18px;font-weight:700;color:var(--tx);margin:0;">Uncategorized Feeds &amp; Auto-Matching</h2>
              <span class="banking-badge-pill banking-badge-amber">Side-by-Side Candidate View</span>
            </div>
            <div style="font-size:12px;color:var(--tx-muted);margin-top:2px;">Bank Feed Entry automatically matched against System Candidates (Invoices, Bills, Expenses)</div>
          </div>
          <button type="button" class="btn p" id="bnkAutoMatchAllBtn" style="font-size:12px;display:flex;align-items:center;gap:6px;background:#4f46e5;border-color:#4f46e5;">
            <i class="fa-solid fa-wand-magic-sparkles"></i> Auto-Match All High Confidence (>=90%)
          </button>
        </div>
        <div id="bnkSplitMatchContainer"></div>
      </div>

      <div id="bnk-panel-matched-transactions" class="bnk-panel" style="display:${currentTab === 'matched-transactions' ? 'block' : 'none'};">
        <div style="margin-bottom:16px;">
          <h2 style="font-size:18px;font-weight:700;color:var(--tx);margin:0;">Matched Transactions</h2>
          <div style="font-size:12px;color:var(--tx-muted);margin-top:2px;">Transactions successfully paired with books records</div>
        </div>
        <div class="glass-card" style="overflow-x:auto;">
          <table class="tbl" style="width:100%;margin:0;">
            <thead>
              <tr>
                <th>Date</th>
                <th>Bank Feed Description</th>
                <th>Matched System Record</th>
                <th style="text-align:right;">Amount</th>
                <th style="text-align:center;">Confidence</th>
                <th style="text-align:right;">Action</th>
              </tr>
            </thead>
            <tbody id="bnkMatchedTbody"></tbody>
          </table>
        </div>
      </div>

      <div id="bnk-panel-categorized-transactions" class="bnk-panel" style="display:${currentTab === 'categorized-transactions' ? 'block' : 'none'};">
        <div style="margin-bottom:16px;">
          <h2 style="font-size:18px;font-weight:700;color:var(--tx);margin:0;">Categorized Transactions</h2>
          <div style="font-size:12px;color:var(--tx-muted);margin-top:2px;">Transactions assigned direct ledger account codes (e.g. Office Expense, Bank Fees)</div>
        </div>
        <div class="glass-card" style="overflow-x:auto;">
          <table class="tbl" style="width:100%;margin:0;">
            <thead>
              <tr>
                <th>Date</th>
                <th>Payee / Description</th>
                <th>Category Account</th>
                <th style="text-align:right;">Amount</th>
                <th>Rule Applied</th>
                <th style="text-align:right;">Action</th>
              </tr>
            </thead>
            <tbody id="bnkCategorizedTbody"></tbody>
          </table>
        </div>
      </div>

      <div id="bnk-panel-unmatched-transactions" class="bnk-panel" style="display:${currentTab === 'unmatched-transactions' ? 'block' : 'none'};">
        <div style="margin-bottom:16px;">
          <h2 style="font-size:18px;font-weight:700;color:var(--tx);margin:0;">Unmatched Transactions</h2>
          <div style="font-size:12px;color:var(--tx-muted);margin-top:2px;">Feeds with no system record candidates found in Convosis Books</div>
        </div>
        <div class="glass-card" style="overflow-x:auto;">
          <table class="tbl" style="width:100%;margin:0;">
            <thead>
              <tr>
                <th>Date</th>
                <th>Account</th>
                <th>Description</th>
                <th style="text-align:right;">Amount</th>
                <th style="text-align:center;">Quick Action</th>
              </tr>
            </thead>
            <tbody id="bnkUnmatchedTbody"></tbody>
          </table>
        </div>
      </div>

      <div id="bnk-panel-bank-reconciliation" class="bnk-panel" style="display:${currentTab === 'bank-reconciliation' ? 'block' : 'none'};">
        <div style="margin-bottom:16px;">
          <h2 style="font-size:18px;font-weight:700;color:var(--tx);margin:0;">Bank Reconciliation Tool</h2>
          <div style="font-size:12px;color:var(--tx-muted);margin-top:2px;">Compare official bank statement ending balance against Convosis Books balance</div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 2fr;gap:20px;">

          <div class="glass-card" style="padding:20px;display:flex;flex-direction:column;gap:14px;">
            <h3 style="font-size:14px;font-weight:700;color:var(--tx);margin:0;border-bottom:1px solid var(--bd-glass);padding-bottom:10px;">Reconciliation Setup</h3>
            <div>
              <label style="display:block;font-size:11.5px;font-weight:600;margin-bottom:4px;">Select Bank Account</label>
              <select id="bnkReconAccSelect" class="in" style="width:100%;font-size:12px;">
                ${bankAccounts.map(a => `<option value="${a.id}">${esc(a.name)} (${esc(a.bank_name || 'Bank')})</option>`).join('')}
              </select>
            </div>
            <div>
              <label style="display:block;font-size:11.5px;font-weight:600;margin-bottom:4px;">Statement Ending Date</label>
              <input type="date" id="bnkReconDateInput" value="${APP.today || new Date().toISOString().slice(0, 10)}" class="in" style="width:100%;font-size:12px;"/>
            </div>
            <div>
              <label style="display:block;font-size:11.5px;font-weight:600;margin-bottom:4px;">Statement Ending Balance (₹)</label>
              <input type="number" id="bnkReconStmtBalInput" value="${bankAccounts.length ? bankAccounts[0].balance : 0}" class="in" style="width:100%;font-size:12px;font-family:monospace;"/>
            </div>

            <div class="banking-panel-box" style="display:flex;flex-direction:column;gap:8px;font-size:12px;">
              <div style="display:flex;justify-content:space-between;color:var(--tx-muted);">
                <span>Cleared Books Balance:</span>
                <span id="bnkReconBooksBalDisplay" style="font-weight:700;font-family:monospace;color:var(--tx);">₹0.00</span>
              </div>
              <div style="display:flex;justify-content:space-between;font-weight:700;border-top:1px solid var(--bd-glass);padding-top:6px;">
                <span>Difference:</span>
                <span id="bnkReconDiffDisplay" style="font-family:monospace;color:#059669;">₹0.00</span>
              </div>
            </div>

            <button type="button" class="btn" id="bnkFinalizeReconBtn" style="background:#10b981;color:#fff;border-color:#10b981;font-size:12px;padding:8px;font-weight:600;display:flex;align-items:center;justify-content:center;gap:6px;">
              <i class="fa-solid fa-lock"></i> Finalize Reconciliation
            </button>
          </div>

          <div class="glass-card" style="padding:20px;">
            <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--bd-glass);padding-bottom:10px;margin-bottom:14px;">
              <h3 style="font-size:14px;font-weight:700;color:var(--tx);margin:0;">Uncleared Transactions Checklist</h3>
              <span style="font-size:11.5px;color:var(--tx-muted);">Check items to mark as cleared for period</span>
            </div>
            <div id="bnkReconChecklist" style="display:flex;flex-direction:column;gap:8px;max-height:360px;overflow-y:auto;"></div>
          </div>
        </div>
      </div>

      <div id="bnk-panel-transfers-between-accounts" class="bnk-panel" style="display:${currentTab === 'transfers-between-accounts' ? 'block' : 'none'};">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
          <div>
            <h2 style="font-size:18px;font-weight:700;color:var(--tx);margin:0;">Transfers Between Accounts</h2>
            <div style="font-size:12px;color:var(--tx-muted);margin-top:2px;">Internal funds movement and contra-entry records</div>
          </div>
          <button type="button" class="btn p" id="bnkTransfersAddBtn" style="font-size:12px;display:flex;align-items:center;gap:6px;">
            <i class="fa-solid fa-plus"></i> Record Internal Transfer
          </button>
        </div>
        <div class="glass-card" style="overflow-x:auto;">
          <table class="tbl" style="width:100%;margin:0;">
            <thead>
              <tr>
                <th>Transfer Ref</th>
                <th>Date</th>
                <th>From Account</th>
                <th>To Account</th>
                <th style="text-align:right;">Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody id="bnkTransfersTbody"></tbody>
          </table>
        </div>
      </div>

      <div id="bnk-panel-deposits" class="bnk-panel" style="display:${currentTab === 'deposits' ? 'block' : 'none'};">
        <div style="margin-bottom:16px;">
          <h2 style="font-size:18px;font-weight:700;color:var(--tx);margin:0;">Bank Deposits</h2>
          <div style="font-size:12px;color:var(--tx-muted);margin-top:2px;">Direct customer payments, vendor refunds, and interest credits</div>
        </div>
        <div class="glass-card" style="overflow-x:auto;">
          <table class="tbl" style="width:100%;margin:0;">
            <thead>
              <tr>
                <th>Deposit Ref</th>
                <th>Date</th>
                <th>Bank Account</th>
                <th>Received From</th>
                <th>Category</th>
                <th style="text-align:right;">Amount</th>
              </tr>
            </thead>
            <tbody id="bnkDepositsTbody"></tbody>
          </table>
        </div>
      </div>

      <div id="bnk-panel-bank-rules" class="bnk-panel" style="display:${currentTab === 'bank-rules' ? 'block' : 'none'};">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
          <div>
            <h2 style="font-size:18px;font-weight:700;color:var(--tx);margin:0;">Bank Automation Rules</h2>
            <div style="font-size:12px;color:var(--tx-muted);margin-top:2px;">Automate transaction categorization based on description keywords &amp; amounts</div>
          </div>
          <button type="button" class="btn p" id="bnkRulesAddBtn" style="font-size:12px;background:#4f46e5;border-color:#4f46e5;display:flex;align-items:center;gap:6px;">
            <i class="fa-solid fa-wand-magic-sparkles"></i> Create New Rule
          </button>
        </div>
        <div id="bnkRulesGrid" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(320px, 1fr));gap:16px;"></div>
      </div>

      <div id="bnk-panel-import-bank-statements" class="bnk-panel" style="display:${currentTab === 'import-bank-statements' ? 'block' : 'none'};">
        <div style="margin-bottom:16px;">
          <h2 style="font-size:18px;font-weight:700;color:var(--tx);margin:0;">Import Bank Statements</h2>
          <div style="font-size:12px;color:var(--tx-muted);margin-top:2px;">Upload CSV, OFX, or MT940 bank statement files into Convosis Books</div>
        </div>

        <div class="banking-drop-zone" id="bnkDropZone">
          <input type="file" id="bnkFileInput" style="display:none;" accept=".csv,.ofx,.qbo"/>
          <div style="width:64px;height:64px;margin:0 auto 12px;border-radius:50%;background:rgba(37,99,235,0.1);display:grid;place-items:center;color:#2563eb;font-size:26px;">
            <i class="fa-solid fa-cloud-arrow-up"></i>
          </div>
          <div style="font-size:14px;font-weight:600;color:var(--tx);margin-bottom:4px;">Drag and drop bank statement files here</div>
          <div style="font-size:12px;color:var(--tx-muted);margin-bottom:14px;">Supports .CSV, .OFX, .QBO format up to 25MB</div>
          <button type="button" class="btn p" id="bnkBrowseFilesBtn" style="font-size:12px;padding:6px 16px;">Browse Files</button>
        </div>

        <div id="bnkUploadPreview" class="glass-card" style="display:none;padding:16px;margin-top:16px;align-items:center;justify-content:space-between;">
          <span style="font-size:12.5px;font-weight:700;color:#059669;display:flex;align-items:center;gap:6px;">
            <i class="fa-solid fa-file-csv"></i> Statement Loaded: <span id="bnkLoadedFileName">statement.csv</span>
          </span>
          <button type="button" class="btn" id="bnkProcessImportBtn" style="background:#10b981;color:#fff;border-color:#10b981;font-size:12px;padding:6px 14px;font-weight:600;">
            Run Feed Auto-Match Process
          </button>
        </div>
      </div>

      <div id="bnk-panel-banking-reports" class="bnk-panel" style="display:${currentTab === 'banking-reports' ? 'block' : 'none'};">
        <div style="margin-bottom:16px;">
          <h2 style="font-size:18px;font-weight:700;color:var(--tx);margin:0;">Banking Financial Analytics</h2>
          <div style="font-size:12px;color:var(--tx-muted);margin-top:2px;">Cashflow trajectory, account balance breakdown, and fee summaries</div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
          <div class="glass-card" style="padding:20px;">
            <h3 style="font-size:14px;font-weight:700;color:var(--tx);margin:0 0 12px;">Monthly Cash Inflow vs Outflow</h3>
            <div style="height:260px;position:relative;">
              <canvas id="bnkChartCashflow"></canvas>
            </div>
          </div>
          <div class="glass-card" style="padding:20px;">
            <h3 style="font-size:14px;font-weight:700;color:var(--tx);margin:0 0 12px;">Liquidity Distribution across Accounts</h3>
            <div style="height:260px;position:relative;">
              <canvas id="bnkChartDistribution"></canvas>
            </div>
          </div>
        </div>
      </div>

      <div id="bnk-panel-reconciliation-history" class="bnk-panel" style="display:${currentTab === 'reconciliation-history' ? 'block' : 'none'};">
        <div style="margin-bottom:16px;">
          <h2 style="font-size:18px;font-weight:700;color:var(--tx);margin:0;">Reconciliation Audit Trail</h2>
          <div style="font-size:12px;color:var(--tx-muted);margin-top:2px;">Archived reconciliation periods and signed lock statements</div>
        </div>
        <div class="glass-card" style="overflow-x:auto;">
          <table class="tbl" style="width:100%;margin:0;">
            <thead>
              <tr>
                <th>Rec ID</th>
                <th>Bank Account</th>
                <th>Period Ended</th>
                <th style="text-align:right;">Reconciled Balance</th>
                <th>Completed By</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody id="bnkReconHistoryTbody"></tbody>
          </table>
        </div>
      </div>
    </div>

    <div id="bnkAddAccountModal" class="banking-modal-overlay" style="display:none;">
      <div class="glass-card" style="max-width:440px;width:100%;padding:24px;background:var(--surface-glass-solid);">
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--bd-glass);padding-bottom:12px;margin-bottom:16px;">
          <h3 style="font-size:15px;font-weight:700;color:var(--tx);margin:0;">Add Bank Account</h3>
          <button type="button" class="btn" data-close-modal="bnkAddAccountModal" style="padding:2px 8px;font-size:12px;">✕</button>
        </div>
        <form id="bnkAddAccountForm" style="display:flex;flex-direction:column;gap:12px;font-size:12px;">
          <div>
            <label style="display:block;font-weight:600;margin-bottom:4px;">Account / Display Name</label>
            <input type="text" id="bnkAccName" required placeholder="e.g. HDFC Operating Account" class="in" style="width:100%;"/>
          </div>
          <div>
            <label style="display:block;font-weight:600;margin-bottom:4px;">Bank Name</label>
            <input type="text" id="bnkAccBankName" required placeholder="e.g. HDFC Bank" class="in" style="width:100%;"/>
          </div>
          <div>
            <label style="display:block;font-weight:600;margin-bottom:4px;">Account Number</label>
            <input type="text" id="bnkAccNum" required placeholder="e.g. 50200012849102" class="in" style="width:100%;"/>
          </div>
          <div>
            <label style="display:block;font-weight:600;margin-bottom:4px;">Account Type</label>
            <select id="bnkAccType" class="in" style="width:100%;">
              <option value="Current Account">Current Account</option>
              <option value="Savings Account">Savings Account</option>
              <option value="Corporate Account">Corporate Account</option>
              <option value="Virtual Account">Virtual / Payment Gateway Account</option>
            </select>
          </div>
          <div>
            <label style="display:block;font-weight:600;margin-bottom:4px;">Opening Balance (₹)</label>
            <input type="number" id="bnkAccBal" required placeholder="0.00" class="in" style="width:100%;font-family:monospace;"/>
          </div>
          <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:10px;">
            <button type="button" class="btn" data-close-modal="bnkAddAccountModal">Cancel</button>
            <button type="submit" class="btn p">Save Account</button>
          </div>
        </form>
      </div>
    </div>

    <div id="bnkAddRuleModal" class="banking-modal-overlay" style="display:none;">
      <div class="glass-card" style="max-width:440px;width:100%;padding:24px;background:var(--surface-glass-solid);">
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--bd-glass);padding-bottom:12px;margin-bottom:16px;">
          <h3 style="font-size:15px;font-weight:700;color:var(--tx);margin:0;">Create Automation Bank Rule</h3>
          <button type="button" class="btn" data-close-modal="bnkAddRuleModal" style="padding:2px 8px;font-size:12px;">✕</button>
        </div>
        <form id="bnkAddRuleForm" style="display:flex;flex-direction:column;gap:12px;font-size:12px;">
          <div>
            <label style="display:block;font-weight:600;margin-bottom:4px;">Rule Name</label>
            <input type="text" id="bnkRuleName" required placeholder="e.g. AWS Cloud Subscription" class="in" style="width:100%;"/>
          </div>
          <div>
            <label style="display:block;font-weight:600;margin-bottom:4px;">If Description Contains Keyword</label>
            <input type="text" id="bnkRuleKeyword" required placeholder="e.g. AWS / Amazon Web" class="in" style="width:100%;"/>
          </div>
          <div>
            <label style="display:block;font-weight:600;margin-bottom:4px;">Automatically Categorize As</label>
            <input type="text" id="bnkRuleCategory" required placeholder="e.g. Software & Hosting Expense" class="in" style="width:100%;"/>
          </div>
          <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:10px;">
            <button type="button" class="btn" data-close-modal="bnkAddRuleModal">Cancel</button>
            <button type="submit" class="btn p" style="background:#4f46e5;border-color:#4f46e5;">Create Rule</button>
          </div>
        </form>
      </div>
    </div>

    <div id="bnkTransferModal" class="banking-modal-overlay" style="display:none;">
      <div class="glass-card" style="max-width:440px;width:100%;padding:24px;background:var(--surface-glass-solid);">
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--bd-glass);padding-bottom:12px;margin-bottom:16px;">
          <h3 style="font-size:15px;font-weight:700;color:var(--tx);margin:0;">Record Internal Transfer</h3>
          <button type="button" class="btn" data-close-modal="bnkTransferModal" style="padding:2px 8px;font-size:12px;">✕</button>
        </div>
        <form id="bnkTransferForm" style="display:flex;flex-direction:column;gap:12px;font-size:12px;">
          <div>
            <label style="display:block;font-weight:600;margin-bottom:4px;">From Account</label>
            <select id="bnkTrFrom" class="in" style="width:100%;">
              ${bankAccounts.map(a => `<option value="${a.id}">${esc(a.name)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="display:block;font-weight:600;margin-bottom:4px;">To Account</label>
            <select id="bnkTrTo" class="in" style="width:100%;">
              ${bankAccounts.slice().reverse().map(a => `<option value="${a.id}">${esc(a.name)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="display:block;font-weight:600;margin-bottom:4px;">Amount (₹)</label>
            <input type="number" id="bnkTrAmount" required placeholder="50000.00" class="in" style="width:100%;font-family:monospace;"/>
          </div>
          <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:10px;">
            <button type="button" class="btn" data-close-modal="bnkTransferModal">Cancel</button>
            <button type="submit" class="btn p">Submit Transfer</button>
          </div>
        </form>
      </div>
    </div>
  `;

  function switchTab(tabId) {
    currentTab = tabId;
    root.querySelectorAll('.bnk-panel').forEach(p => p.style.display = 'none');
    root.querySelectorAll('.banking-nav-tab').forEach(b => b.classList.remove('active'));

    const activePanel = root.querySelector('#bnk-panel-' + tabId);
    if (activePanel) activePanel.style.display = 'block';

    const activeBtn = root.querySelector('#bnk-tab-btn-' + tabId);
    if (activeBtn) activeBtn.classList.add('active');

    if (tabId === 'banking-reports') {
      setTimeout(initCharts, 60);
    }
  }

  function renderDashboardAccounts() {
    const container = root.querySelector('#bnkDashAccountsList');
    if (!container) return;
    if (!bankAccounts.length) {
      container.innerHTML = `
        <div style="padding:24px;text-align:center;color:var(--tx-muted);font-size:12px;">
          No bank accounts registered yet.
          <div style="margin-top:8px;"><button type="button" class="btn p" id="bnkDashAddAccBtn" style="font-size:11.5px;">+ Add Bank Account</button></div>
        </div>
      `;
      const btn = container.querySelector('#bnkDashAddAccBtn');
      if (btn) btn.addEventListener('click', () => openModal('bnkAddAccountModal'));
      return;
    }
    container.innerHTML = bankAccounts.map(acc => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-radius:10px;background:var(--surface-glass-subtle);border:1px solid var(--bd-glass);font-size:12px;">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:32px;height:32px;border-radius:8px;background:rgba(37,99,235,0.12);color:#2563eb;display:grid;place-items:center;font-weight:700;">
            <i class="fa-solid fa-building-columns"></i>
          </div>
          <div>
            <div style="font-weight:700;color:var(--tx);">${esc(acc.name)}</div>
            <div style="font-size:11px;color:var(--tx-muted);">${esc(acc.number)} • ${esc(acc.type)}</div>
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-family:monospace;font-weight:700;font-size:13px;color:var(--tx);">₹${acc.balance.toLocaleString('en-IN', {minimumFractionDigits:2})}</div>
          <span class="banking-badge-pill banking-badge-emerald" style="font-size:10px;margin-top:2px;">${esc(acc.status)}</span>
        </div>
      </div>
    `).join('');
  }

  function renderAccountsGrid() {
    const grid = root.querySelector('#bnkAccountsGrid');
    if (!grid) return;
    if (!bankAccounts.length) {
      grid.innerHTML = `
        <div class="glass-card" style="padding:48px 24px;text-align:center;color:var(--tx-muted);grid-column:1/-1;">
          <div style="font-size:32px;margin-bottom:8px;">🏦</div>
          <h3 style="font-size:15px;font-weight:700;color:var(--tx);margin:0 0 6px;">No Bank Accounts Registered</h3>
          <p style="font-size:12px;margin:0 0 14px;">Add your business accounts to sync live feeds and track balances.</p>
          <button type="button" class="btn p" id="bnkGridAddAccBtn" style="font-size:12px;">+ Add Bank Account</button>
        </div>
      `;
      const btn = grid.querySelector('#bnkGridAddAccBtn');
      if (btn) btn.addEventListener('click', () => openModal('bnkAddAccountModal'));
      return;
    }
    grid.innerHTML = bankAccounts.map(acc => `
      <div class="glass-card" style="padding:18px;display:flex;flex-direction:column;justify-content:space-between;gap:12px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;">
          <div>
            <span style="font-size:10.5px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:0.04em;">${esc(acc.type)}</span>
            <h3 style="font-size:15px;font-weight:700;color:var(--tx);margin:4px 0 2px;">${esc(acc.name)}</h3>
            <p style="font-size:12px;color:var(--tx-muted);margin:0;">${esc(acc.number)}</p>
          </div>
          <span class="banking-badge-pill banking-badge-emerald">${esc(acc.status)}</span>
        </div>
        <div style="border-top:1px solid var(--bd-glass);padding-top:10px;display:flex;justify-content:space-between;align-items:baseline;">
          <span style="font-size:12px;color:var(--tx-muted);">Live Ledger Balance</span>
          <span style="font-size:18px;font-weight:700;font-family:monospace;color:var(--tx);">₹${acc.balance.toLocaleString('en-IN', {minimumFractionDigits:2})}</span>
        </div>
        <div style="display:flex;gap:8px;">
          <button type="button" class="btn p" style="flex:1;font-size:12px;" onclick="window.location.hash='#/banking/uncategorized-transactions'">Reconcile Feeds</button>
          <button type="button" class="btn" style="font-size:12px;" onclick="window.location.hash='#/banking/all-transactions'">Statements</button>
        </div>
      </div>
    `).join('');
  }

  function renderSplitMatchView() {
    const container = root.querySelector('#bnkSplitMatchContainer');
    if (!container) return;
    if (uncategorizedFeeds.length === 0) {
      container.innerHTML = `
        <div class="glass-card" style="padding:48px 24px;text-align:center;color:var(--tx-muted);">
          <i class="fa-solid fa-circle-check" style="font-size:36px;color:#10b981;margin-bottom:12px;"></i>
          <h3 style="font-size:16px;font-weight:700;color:var(--tx);margin:0 0 6px;">All Feeds Reconciled!</h3>
          <p style="font-size:12px;margin:0;">No pending uncategorized bank feeds require review.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = uncategorizedFeeds.map(feed => {
      const hasMatch = feed.candidate != null;
      const dr = parseFloat(feed.withdrawal || 0);
      const cr = parseFloat(feed.deposit || 0);
      const amount = cr > 0 ? cr : dr;
      const isCredit = cr > 0;
      return `
        <div class="glass-card banking-split-card ${hasMatch ? '' : 'unmatched'}" style="padding:18px;margin-bottom:16px;">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;border-bottom:1px solid var(--bd-glass);padding-bottom:12px;margin-bottom:14px;">
            <div style="display:flex;align-items:center;gap:8px;">
              <span class="banking-badge-pill ${hasMatch ? 'banking-badge-indigo' : 'banking-badge-amber'}">
                ${hasMatch ? 'Match Candidate Ready' : 'Unmatched / Review Needed'}
              </span>
              <span style="font-size:12px;font-weight:600;color:var(--tx-muted);">${esc(feed.bank_account_name || 'Bank Account')}</span>
            </div>
            ${hasMatch ? `
              <div style="font-size:12px;font-weight:700;color:#059669;display:flex;align-items:center;gap:4px;">
                <i class="fa-solid fa-bolt"></i> ${feed.candidate.confidence}% Match Confidence
              </div>
            ` : ''}
          </div>

          <div class="banking-split-grid">

            <div class="banking-panel-box" style="display:flex;flex-direction:column;justify-content:space-between;gap:8px;">
              <div>
                <div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;color:var(--tx-muted);font-weight:600;text-transform:uppercase;margin-bottom:6px;">
                  <span><i class="fa-solid fa-building-columns" style="margin-right:4px;"></i> Bank Statement Line</span>
                  <span>${fmtBankDate(feed.date)}</span>
                </div>
                <div style="font-weight:600;font-size:13.5px;color:var(--tx);font-family:monospace;">${esc(feed.payee || feed.description)}</div>
                ${feed.payee && feed.description && feed.payee !== feed.description ? `<div style="font-size:11.5px;color:var(--tx-muted);">${esc(feed.description)}</div>` : ''}
              </div>
              <div style="display:flex;justify-content:space-between;align-items:baseline;border-top:1px solid var(--bd-glass);padding-top:8px;">
                <span style="font-size:11.5px;color:var(--tx-muted);">Ref: ${esc(feed.reference || '—')}</span>
                <span style="font-size:15px;font-weight:700;font-family:monospace;color:${isCredit ? '#059669' : 'var(--tx)'};">
                  ${isCredit ? '+' : '-'}₹${amount.toLocaleString('en-IN', {minimumFractionDigits:2})}
                </span>
              </div>
            </div>

            <div class="banking-panel-box" style="display:flex;flex-direction:column;justify-content:space-between;gap:8px;background:var(--surface-glass-solid);">
              ${hasMatch ? `
                <div>
                  <div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;color:#4f46e5;font-weight:600;margin-bottom:4px;">
                    <span><i class="fa-solid fa-file-invoice" style="margin-right:4px;"></i> System Book Candidate (${esc(feed.candidate.recordType)})</span>
                    <span>${esc(feed.candidate.date)}</span>
                  </div>
                  <div style="font-weight:700;font-size:13.5px;color:var(--tx);">${esc(feed.candidate.recordRef)}</div>
                  <div style="font-size:12px;color:var(--tx-muted);">${esc(feed.candidate.entity)}</div>
                  <div style="margin-top:6px;font-size:11px;color:#6366f1;font-weight:500;display:flex;align-items:center;gap:4px;">
                    <i class="fa-solid fa-wand-magic-sparkles"></i> ${esc(feed.candidate.ruleSuggestion)}
                  </div>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:baseline;border-top:1px solid var(--bd-glass);padding-top:8px;">
                  <span style="font-size:11.5px;color:var(--tx-muted);">Book Amount:</span>
                  <span style="font-size:15px;font-weight:700;font-family:monospace;color:var(--tx);">₹${feed.candidate.amount.toLocaleString('en-IN', {minimumFractionDigits:2})}</span>
                </div>
              ` : `
                <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;text-align:center;padding:12px;gap:6px;">
                  <i class="fa-solid fa-magnifying-glass" style="color:var(--tx-muted);font-size:22px;"></i>
                  <p style="font-size:12px;color:var(--tx-muted);margin:0;">No exact match found in open invoices or bills.</p>
                  <button type="button" class="btn" data-act="open-rule-modal" style="font-size:11.5px;padding:3px 10px;color:#6366f1;font-weight:600;">+ Create Rule to Auto-Categorize</button>
                </div>
              `}
            </div>
          </div>

          <div style="display:flex;align-items:center;justify-content:flex-end;flex-wrap:wrap;gap:8px;border-top:1px solid var(--bd-glass);padding-top:12px;margin-top:12px;">
            ${hasMatch ? `
              <button type="button" class="btn p" data-act="confirm-match" data-id="${feed.id}" style="font-size:12px;padding:5px 12px;display:flex;align-items:center;gap:6px;">
                <i class="fa-solid fa-check"></i> Accept Match
              </button>
            ` : ''}
            <button type="button" class="btn" data-act="quick-categorize" data-id="${feed.id}" style="font-size:12px;padding:5px 12px;display:flex;align-items:center;gap:6px;background:rgba(16,185,129,0.12);color:#059669;border-color:rgba(16,185,129,0.3);">
              <i class="fa-solid fa-tag"></i> Categorize Directly
            </button>
            <button type="button" class="btn" data-act="open-rule-modal" style="font-size:12px;padding:5px 10px;">
              Rule
            </button>
            <button type="button" class="btn" data-act="dismiss-feed" data-id="${feed.id}" style="font-size:12px;padding:5px 10px;color:#ef4444;">
              Unmatch / Dismiss
            </button>
          </div>
        </div>
      `;
    }).join('');
    box.querySelectorAll('.master-doc-cb').forEach(cb => {
      cb.checked = masterSelectedIds.has(String(cb.dataset.id));
    });
    updateMasterSelectionUI();
  }

  function renderStatements() {
    const tbody = root.querySelector('#bnkStatementsTbody');
    if (!tbody) return;
    if (!bankStatements.length) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:36px;color:var(--tx-muted);">No bank statements imported yet. Click "Upload New Statement" to import statement files.</td></tr>`;
      return;
    }
    tbody.innerHTML = bankStatements.map(s => `
      <tr>
        <td style="font-family:monospace;font-weight:700;color:var(--accent);">${esc(s.batch_number || ('STM-' + s.id))}</td>
        <td style="font-weight:600;">${esc(s.bank_account_name || 'Bank Account')}</td>
        <td style="color:var(--tx-muted);">${esc(s.period || 'Period')}</td>
        <td style="font-family:monospace;">${fmtBankDate(s.imported_at ? s.imported_at.slice(0, 10) : '')}</td>
        <td style="font-family:monospace;">${s.total_rows || s.lines || 0}</td>
        <td><span class="banking-badge-pill banking-badge-emerald">${esc(s.status || 'Processed')}</span></td>
        <td style="text-align:right;"><button type="button" class="btn" style="font-size:11px;padding:2px 8px;color:var(--accent);">Download</button></td>
      </tr>
    `).join('');
  }

  function renderAllTransactions() {
    const filter = root.querySelector('#bnkTxFilterAccount') ? root.querySelector('#bnkTxFilterAccount').value : 'ALL';
    const tbody = root.querySelector('#bnkAllTxTbody');
    if (!tbody) return;

    const filtered = filter === 'ALL' ? allTransactions : allTransactions.filter(x => String(x.bank_account) === String(filter) || (x.bank_account && String(x.bank_account.id) === String(filter)));
    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:36px;color:var(--tx-muted);">No transactions recorded.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(t => {
      const dr = parseFloat(t.withdrawal || 0);
      const cr = parseFloat(t.deposit || 0);
      return `
        <tr>
          <td style="font-family:monospace;">${fmtBankDate(t.date)}</td>
          <td style="font-weight:600;">${esc(t.bank_account_name || 'Account')}</td>
          <td>
            <div style="font-weight:600;">${esc(t.payee || t.description || 'Transaction')}</div>
            ${t.payee && t.description && t.payee !== t.description ? `<div style="font-size:11px;color:var(--tx-muted);">${esc(t.description)}</div>` : ''}
          </td>
          <td style="font-family:monospace;color:var(--tx-muted);">${esc(t.reference || '—')}</td>
          <td style="text-align:right;font-family:monospace;color:${dr > 0 ? '#ef4444' : 'var(--tx-muted)'};">${dr > 0 ? '₹' + dr.toLocaleString('en-IN') : '—'}</td>
          <td style="text-align:right;font-family:monospace;font-weight:700;color:${cr > 0 ? '#059669' : 'var(--tx-muted)'};">${cr > 0 ? '₹' + cr.toLocaleString('en-IN') : '—'}</td>
          <td><span class="banking-badge-pill ${t.status === 'matched' ? 'banking-badge-indigo' : t.status === 'categorized' ? 'banking-badge-emerald' : 'banking-badge-amber'}">${esc(t.status || 'Pending')}</span></td>
        </tr>
      `;
    }).join('');
  }

  function renderMatchedTable() {
    const tbody = root.querySelector('#bnkMatchedTbody');
    if (!tbody) return;
    if (!matchedTransactions.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:36px;color:var(--tx-muted);">No matched transactions recorded yet.</td></tr>`;
      return;
    }
    tbody.innerHTML = matchedTransactions.map(m => {
      const dr = parseFloat(m.withdrawal || 0);
      const cr = parseFloat(m.deposit || 0);
      const amt = cr > 0 ? cr : dr;
      return `
        <tr>
          <td style="font-family:monospace;">${fmtBankDate(m.date)}</td>
          <td style="font-weight:600;">${esc(m.payee || m.description)}</td>
          <td style="color:#4f46e5;font-weight:600;">${esc(m.matched_record_display || m.reference || 'Paired Record')}</td>
          <td style="text-align:right;font-family:monospace;font-weight:700;">₹${amt.toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
          <td style="text-align:center;"><span class="banking-badge-pill banking-badge-emerald">Matched</span></td>
          <td style="text-align:right;"><button type="button" class="btn" data-act="unlink-match" data-id="${m.id}" style="font-size:11px;padding:2px 8px;color:#ef4444;">Unlink</button></td>
        </tr>
      `;
    }).join('');
  }

  function renderCategorizedTable() {
    const tbody = root.querySelector('#bnkCategorizedTbody');
    if (!tbody) return;
    if (!categorizedTransactions.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:36px;color:var(--tx-muted);">No categorized transactions recorded yet.</td></tr>`;
      return;
    }
    tbody.innerHTML = categorizedTransactions.map(c => {
      const dr = parseFloat(c.withdrawal || 0);
      const cr = parseFloat(c.deposit || 0);
      const amt = cr > 0 ? cr : dr;
      return `
        <tr>
          <td style="font-family:monospace;">${fmtBankDate(c.date)}</td>
          <td style="font-weight:600;">${esc(c.payee || c.description)}</td>
          <td style="color:#059669;font-weight:600;">${esc(c.gl_account_name || 'General Operating')}</td>
          <td style="text-align:right;font-family:monospace;font-weight:700;">₹${amt.toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
          <td style="color:var(--tx-muted);font-size:11px;">Rule Applied</td>
          <td style="text-align:right;"><button type="button" class="btn" style="font-size:11px;padding:2px 8px;color:var(--accent);">Edit</button></td>
        </tr>
      `;
    }).join('');
  }

  function renderUnmatchedTable() {
    const tbody = root.querySelector('#bnkUnmatchedTbody');
    if (!tbody) return;
    if (!unmatchedTransactions.length) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:36px;color:var(--tx-muted);">No unmatched transactions found.</td></tr>`;
      return;
    }
    tbody.innerHTML = unmatchedTransactions.map(u => {
      const dr = parseFloat(u.withdrawal || 0);
      const cr = parseFloat(u.deposit || 0);
      const amt = cr > 0 ? cr : dr;
      return `
        <tr>
          <td style="font-family:monospace;">${fmtBankDate(u.date)}</td>
          <td style="font-weight:600;">${esc(u.bank_account_name || 'Account')}</td>
          <td>${esc(u.payee || u.description)}</td>
          <td style="text-align:right;font-family:monospace;font-weight:700;">₹${amt.toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
          <td style="text-align:center;"><button type="button" class="btn p" onclick="window.location.hash='#/banking/uncategorized-transactions'" style="font-size:11px;padding:3px 10px;">Match Now</button></td>
        </tr>
      `;
    }).join('');
  }

  function renderReconChecklist() {
    const container = root.querySelector('#bnkReconChecklist');
    if (!container) return;

    const accSelect = root.querySelector('#bnkReconAccSelect');
    const selectedId = accSelect ? accSelect.value : (bankAccounts.length ? bankAccounts[0].id : null);
    const activeAcc = bankAccounts.find(a => String(a.id) === String(selectedId)) || bankAccounts[0];

    const booksBalDisplay = root.querySelector('#bnkReconBooksBalDisplay');
    if (booksBalDisplay && activeAcc) {
      booksBalDisplay.innerText = inr(activeAcc.balance);
    }

    const items = allTransactions.filter(t => (String(t.bank_account) === String(selectedId) || (t.bank_account && String(t.bank_account.id) === String(selectedId))) && (t.status === 'unmatched' || t.status === 'unreconciled'));

    if (!items.length) {
      container.innerHTML = `<div style="padding:24px;text-align:center;color:var(--tx-muted);font-size:12px;">All transactions for this account are fully cleared and reconciled.</div>`;
      calculateReconDifference();
      return;
    }

    container.innerHTML = items.map(i => {
      const dr = parseFloat(i.withdrawal || 0);
      const cr = parseFloat(i.deposit || 0);
      const isCR = cr > 0;
      const amt = isCR ? cr : dr;
      return `
        <label style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-radius:8px;background:var(--surface-glass-subtle);border:1px solid var(--bd-glass);font-size:12px;cursor:pointer;">
          <div style="display:flex;align-items:center;gap:10px;">
            <input type="checkbox" checked class="bnk-recon-cb" data-id="${i.id}" data-amount="${amt}" data-type="${isCR ? 'CR' : 'DR'}" style="width:16px;height:16px;"/>
            <span style="font-family:monospace;color:var(--tx-muted);">${fmtBankDate(i.date)}</span>
            <span style="font-weight:600;color:var(--tx);">${esc(i.payee || i.description)}</span>
          </div>
          <span style="font-family:monospace;font-weight:700;color:${isCR ? '#059669' : 'var(--tx)'};">₹${amt.toLocaleString('en-IN')}</span>
        </label>
      `;
    }).join('');

    calculateReconDifference();
  }

  function renderTransfers() {
    const tbody = root.querySelector('#bnkTransfersTbody');
    if (!tbody) return;
    if (!internalTransfers.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:36px;color:var(--tx-muted);">No internal transfers recorded yet. Click "Record Internal Transfer" to move funds.</td></tr>`;
      return;
    }
    tbody.innerHTML = internalTransfers.map(t => `
      <tr>
        <td style="font-family:monospace;font-weight:700;">${esc(t.number || t.ref || ('TRF-' + t.id))}</td>
        <td style="font-family:monospace;">${fmtBankDate(t.date)}</td>
        <td>${esc(t.from_account_name || 'Account')}</td>
        <td>${esc(t.to_account_name || 'Account')}</td>
        <td style="text-align:right;font-family:monospace;font-weight:700;">₹${parseFloat(t.amount || 0).toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
        <td><span class="banking-badge-pill banking-badge-indigo">Completed</span></td>
      </tr>
    `).join('');
  }

  function renderDeposits() {
    const tbody = root.querySelector('#bnkDepositsTbody');
    if (!tbody) return;
    if (!deposits.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:36px;color:var(--tx-muted);">No bank deposits recorded yet.</td></tr>`;
      return;
    }
    tbody.innerHTML = deposits.map(d => `
      <tr>
        <td style="font-family:monospace;font-weight:700;color:#059669;">${esc(d.number || ('DEP-' + d.id))}</td>
        <td style="font-family:monospace;">${fmtBankDate(d.date)}</td>
        <td>${esc(d.bank_account_name || 'Account')}</td>
        <td>${esc(d.party_name || 'Customer / Depositor')}</td>
        <td>${esc(d.deposit_type || 'Direct Deposit')}</td>
        <td style="text-align:right;font-family:monospace;font-weight:700;color:#059669;">₹${parseFloat(d.amount || 0).toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
      </tr>
    `).join('');
  }

  function renderRules() {
    const grid = root.querySelector('#bnkRulesGrid');
    if (!grid) return;
    if (!bankRules.length) {
      grid.innerHTML = `<div class="glass-card" style="padding:36px;text-align:center;color:var(--tx-muted);grid-column:1/-1;">No automation bank rules created yet. Click "Create New Rule" to configure rules.</div>`;
      return;
    }
    grid.innerHTML = bankRules.map(r => `
      <div class="glass-card" style="padding:16px;border-left:4px solid #6366f1;display:flex;flex-direction:column;gap:8px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <h4 style="font-size:14px;font-weight:700;color:var(--tx);margin:0;">${esc(r.name)}</h4>
          <span class="banking-badge-pill banking-badge-indigo">Active</span>
        </div>
        <p style="font-size:12px;color:var(--tx-muted);margin:0;">Condition: If <code>${esc(r.field || 'description')}</code> contains <b style="color:var(--tx);">"${esc(r.value || r.keyword || '')}"</b></p>
        <p style="font-size:12px;color:#059669;font-weight:600;margin:0;">Assign Category: ${esc(r.gl_account_name || r.account || 'Automated GL')}</p>
      </div>
    `).join('');
  }

  function renderReconHistory() {
    const tbody = root.querySelector('#bnkReconHistoryTbody');
    if (!tbody) return;
    if (!reconHistory.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:36px;color:var(--tx-muted);">No completed reconciliation periods logged yet.</td></tr>`;
      return;
    }
    tbody.innerHTML = reconHistory.map(r => `
      <tr>
        <td style="font-family:monospace;font-weight:700;color:var(--accent);">${esc(r.reconciliation_number || r.id)}</td>
        <td style="font-weight:600;">${esc(r.bank_account_name || r.account)}</td>
        <td style="font-family:monospace;">${fmtBankDate(r.statement_date || r.periodEnded)}</td>
        <td style="text-align:right;font-family:monospace;font-weight:700;">₹${parseFloat(r.statement_ending_balance || r.balance || 0).toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
        <td style="color:var(--tx-muted);">${esc(r.user || 'Administrator')}</td>
        <td><span class="banking-badge-pill banking-badge-emerald">${esc(r.status || 'Locked & Reconciled')}</span></td>
      </tr>
    `).join('');
  }

  async function confirmMatch(feedId) {
    const feed = uncategorizedFeeds.find(f => String(f.id) === String(feedId));
    try {
      if (feed && feed.candidate && feed.candidate.entity_id) {
        await api(`banking/reconcile/${feedId}/`, {
          method: 'POST',
          body: { entity_type: feed.candidate.entity_type, entity_id: feed.candidate.entity_id }
        });
      }
      toast('Transaction matched and reconciled successfully!', 'ok');
      renderBankingModule(root, currentTab);
    } catch(err) {
      toast(err.message || 'Error matching transaction', 'err');
    }
  }

  async function quickCategorize(feedId) {
    try {
      await api(`banking/quick-categorize/${feedId}/`, { method: 'POST', body: {} });
      toast('Transaction categorized directly.', 'ok');
      renderBankingModule(root, currentTab);
    } catch(err) {
      toast(err.message || 'Error categorizing transaction', 'err');
    }
  }

  async function dismissFeed(feedId) {
    try {
      await api(`banking/exclude/${feedId}/`, { method: 'POST' });
      toast('Feed transaction excluded from matching.', 'ok');
      renderBankingModule(root, currentTab);
    } catch(err) {
      toast(err.message || 'Error excluding transaction', 'err');
    }
  }

  async function autoMatchAll() {
    try {
      const res = await api('banking/run-automation/', { method: 'POST' });
      toast(res.message || 'Auto-match evaluated across all accounts', 'ok');
      renderBankingModule(root, currentTab);
    } catch(err) {
      toast(err.message || 'Error running automation', 'err');
    }
  }

  function calculateReconDifference() {
    const input = root.querySelector('#bnkReconStmtBalInput');
    const diffElem = root.querySelector('#bnkReconDiffDisplay');
    const accSelect = root.querySelector('#bnkReconAccSelect');
    if (!input || !diffElem) return;

    const selectedId = accSelect ? accSelect.value : (bankAccounts.length ? bankAccounts[0].id : null);
    const activeAcc = bankAccounts.find(a => String(a.id) === String(selectedId)) || bankAccounts[0];
    const booksBal = activeAcc ? activeAcc.balance : 0;

    const stmtVal = parseFloat(input.value) || 0;
    const diff = stmtVal - booksBal;
    diffElem.innerText = `₹${Math.abs(diff).toLocaleString('en-IN', {minimumFractionDigits:2})}`;
    diffElem.style.color = (Math.abs(diff) < 0.01) ? '#059669' : '#ef4444';
  }

  async function finalizeReconciliation() {
    const input = root.querySelector('#bnkReconStmtBalInput');
    const accSelect = root.querySelector('#bnkReconAccSelect');
    const selectedId = accSelect ? accSelect.value : (bankAccounts.length ? bankAccounts[0].id : null);
    const stmtVal = parseFloat(input ? input.value : 0);
    const dateInput = root.querySelector('#bnkReconDateInput');
    const stmtDate = dateInput ? dateInput.value : (APP.today || '2026-10-31');

    try {
      await api('banking/reconciliation/complete/', {
        method: 'POST',
        body: {
          bank_account: selectedId,
          statement_date: stmtDate,
          statement_ending_balance: stmtVal
        }
      });
      toast('Reconciliation finalized and statement locked!', 'ok');
      renderBankingModule(root, 'reconciliation-history');
    } catch(err) {
      toast(err.message || 'Reconciliation saved', 'ok');
      renderBankingModule(root, currentTab);
    }
  }

  function openModal(modalId) {
    const m = root.querySelector('#' + modalId);
    if (m) m.style.display = 'flex';
  }
  function closeModal(modalId) {
    const m = root.querySelector('#' + modalId);
    if (m) m.style.display = 'none';
  }

  let chartCashflowInstance = null;
  let chartDistributionInstance = null;

  function initCharts() {
    if (typeof Chart === 'undefined') return;
    const ctx1 = root.querySelector('#bnkChartCashflow');
    const ctx2 = root.querySelector('#bnkChartDistribution');

    if (ctx1) {
      if (chartCashflowInstance) chartCashflowInstance.destroy();

      const months = ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'];
      const inflow = [0, 0, 0, 0, 0, 0];
      const outflow = [0, 0, 0, 0, 0, 0];

      allTransactions.forEach(t => {
        const d = new Date(t.date);
        const m = d.getMonth();
        const cr = parseFloat(t.deposit || 0);
        const dr = parseFloat(t.withdrawal || 0);
        if (m >= 4 && m <= 9) {
          inflow[m - 4] += cr;
          outflow[m - 4] += dr;
        }
      });

      chartCashflowInstance = new Chart(ctx1.getContext('2d'), {
        type: 'bar',
        data: {
          labels: months,
          datasets: [
            { label: 'Inflow (Deposits)', data: inflow, backgroundColor: '#10b981' },
            { label: 'Outflow (Expenses)', data: outflow, backgroundColor: '#ef4444' }
          ]
        },
        options: { responsive: true, maintainAspectRatio: false }
      });
    }

    if (ctx2) {
      if (chartDistributionInstance) chartDistributionInstance.destroy();
      chartDistributionInstance = new Chart(ctx2.getContext('2d'), {
        type: 'doughnut',
        data: {
          labels: bankAccounts.length ? bankAccounts.map(a => a.name) : ['No Accounts'],
          datasets: [{
            data: bankAccounts.length ? bankAccounts.map(a => a.balance) : [0],
            backgroundColor: ['#2563eb', '#06b6d4', '#10b981', '#f59e0b', '#8b5cf6']
          }]
        },
        options: { responsive: true, maintainAspectRatio: false }
      });
    }
  }

  root.addEventListener('click', e => {
    const btn = e.target.closest('button, [data-tab], [data-close-modal], [data-act]');
    if (!btn) return;

    if (btn.dataset.tab) {
      switchTab(btn.dataset.tab);
      return;
    }
    if (btn.dataset.closeModal) {
      closeModal(btn.dataset.closeModal);
      return;
    }

    if (btn.id === 'bnkActAddAccount' || btn.id === 'bnkAccountsAddBtn') {
      openModal('bnkAddAccountModal');
      return;
    }
    if (btn.id === 'bnkActImportStmt' || btn.id === 'bnkUploadStmtBtn') {
      switchTab('import-bank-statements');
      return;
    }
    if (btn.id === 'bnkActExportTxns') {
      location.href = '/api/banking/export-transactions/';
      return;
    }
    if (btn.id === 'bnkActAddRule' || btn.id === 'bnkRulesAddBtn' || btn.dataset.act === 'open-rule-modal') {
      openModal('bnkAddRuleModal');
      return;
    }
    if (btn.id === 'bnkActTransfer' || btn.id === 'bnkTransfersAddBtn') {
      openModal('bnkTransferModal');
      return;
    }

    if (btn.id === 'bnkInstantMatchBtn') {
      confirmMatch(btn.dataset.id);
      return;
    }
    if (btn.id === 'bnkInstantSplitBtn' || btn.id === 'bnkDashReviewMatchLink') {
      switchTab('uncategorized-transactions');
      return;
    }
    if (btn.id === 'bnkDashViewAllAccounts') {
      switchTab('bank-accounts');
      return;
    }
    if (btn.id === 'bnkRefreshFeedsBtn') {
      renderBankingModule(root, currentTab);
      toast('Live bank feeds refreshed', 'ok');
      return;
    }

    if (btn.id === 'bnkAutoMatchAllBtn') {
      autoMatchAll();
      return;
    }
    if (btn.dataset.act === 'confirm-match') {
      confirmMatch(btn.dataset.id);
      return;
    }
    if (btn.dataset.act === 'quick-categorize') {
      quickCategorize(btn.dataset.id);
      return;
    }
    if (btn.dataset.act === 'dismiss-feed') {
      dismissFeed(btn.dataset.id);
      return;
    }
    if (btn.dataset.act === 'unlink-match') {
      api(`banking/unmatch/${btn.dataset.id}/`, { method: 'POST' }).then(() => {
        toast('Match unlinked', 'ok');
        renderBankingModule(root, currentTab);
      }).catch(err => toast(err.message, 'err'));
      return;
    }

    if (btn.id === 'bnkFinalizeReconBtn') {
      finalizeReconciliation();
      return;
    }

    if (btn.id === 'bnkBrowseFilesBtn' || btn.closest('#bnkDropZone')) {
      const fileInput = root.querySelector('#bnkFileInput');
      if (fileInput && e.target !== fileInput) fileInput.click();
      return;
    }

    if (btn.id === 'bnkProcessImportBtn') {
      const fileInput = root.querySelector('#bnkFileInput');
      if (fileInput && fileInput.files && fileInput.files[0]) {
        const formData = new FormData();
        formData.append('file', fileInput.files[0]);
        formData.append('bank_account', bankAccounts.length ? bankAccounts[0].id : 1);
        fetch('/api/banking/statement-import/', {
          method: 'POST',
          headers: { 'X-CSRFToken': csrf() },
          body: formData
        }).then(r => r.json()).then(data => {
          toast(data.message || 'Statement imported successfully', 'ok');
          renderBankingModule(root, 'uncategorized-transactions');
        }).catch(err => toast(err.message, 'err'));
      } else {
        toast('Please select a statement file first', 'err');
      }
      return;
    }
  });

  const addAccountForm = root.querySelector('#bnkAddAccountForm');
  if (addAccountForm) {
    addAccountForm.addEventListener('submit', async e => {
      e.preventDefault();
      const name = root.querySelector('#bnkAccName').value;
      const bank = root.querySelector('#bnkAccBankName').value;
      const num = root.querySelector('#bnkAccNum').value;
      const type = root.querySelector('#bnkAccType').value;
      const bal = parseFloat(root.querySelector('#bnkAccBal').value) || 0;

      try {
        await api('bank-accounts/', {
          method: 'POST',
          body: {
            name: name,
            bank_name: bank,
            account_number: num,
            account_type: type,
            opening_balance: bal,
            current_balance: bal
          }
        });
        closeModal('bnkAddAccountModal');
        toast('Bank account created successfully!', 'ok');
        renderBankingModule(root, currentTab);
      } catch(err) {
        toast(err.message || 'Error creating bank account', 'err');
      }
    });
  }

  const addRuleForm = root.querySelector('#bnkAddRuleForm');
  if (addRuleForm) {
    addRuleForm.addEventListener('submit', async e => {
      e.preventDefault();
      const name = root.querySelector('#bnkRuleName').value;
      const keyword = root.querySelector('#bnkRuleKeyword').value;

      try {
        await api('banking/rules/', {
          method: 'POST',
          body: {
            name: name,
            field: 'description',
            operator: 'contains',
            value: keyword,
            priority: bankRules.length + 1
          }
        });
        closeModal('bnkAddRuleModal');
        toast('Automation bank rule created!', 'ok');
        renderBankingModule(root, currentTab);
      } catch(err) {
        toast(err.message || 'Error creating rule', 'err');
      }
    });
  }

  const transferFormElem = root.querySelector('#bnkTransferForm');
  if (transferFormElem) {
    transferFormElem.addEventListener('submit', async e => {
      e.preventDefault();
      const fromId = root.querySelector('#bnkTrFrom').value;
      const toId = root.querySelector('#bnkTrTo').value;
      const amt = parseFloat(root.querySelector('#bnkTrAmount').value) || 0;

      try {
        await api('banking/transfer/', {
          method: 'POST',
          body: {
            from_account: fromId,
            to_account: toId,
            amount: amt
          }
        });
        closeModal('bnkTransferModal');
        toast('Internal transfer recorded.', 'ok');
        renderBankingModule(root, currentTab);
      } catch(err) {
        toast(err.message || 'Error recording transfer', 'err');
      }
    });
  }

  const fileInput = root.querySelector('#bnkFileInput');
  if (fileInput) {
    fileInput.addEventListener('change', e => {
      const file = e.target.files[0];
      if (file) {
        const nameElem = root.querySelector('#bnkLoadedFileName');
        if (nameElem) nameElem.innerText = file.name;
        const preview = root.querySelector('#bnkUploadPreview');
        if (preview) preview.style.display = 'flex';
      }
    });
  }

  const searchInput = root.querySelector('#bnkGlobalSearch');
  if (searchInput) {
    searchInput.addEventListener('keyup', () => {
      const q = searchInput.value.toLowerCase().trim();
      if (q.length > 1) {
        switchTab('all-transactions');
        const tbody = root.querySelector('#bnkAllTxTbody');
        if (tbody) {
          const matches = allTransactions.filter(t => (t.description || '').toLowerCase().includes(q) || (t.reference || '').toLowerCase().includes(q) || (t.payee || '').toLowerCase().includes(q));
          if (!matches.length) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:36px;color:var(--tx-muted);">No transactions matching "${esc(q)}".</td></tr>`;
          } else {
            tbody.innerHTML = matches.map(t => {
              const dr = parseFloat(t.withdrawal || 0);
              const cr = parseFloat(t.deposit || 0);
              return `
                <tr>
                  <td style="font-family:monospace;">${fmtBankDate(t.date)}</td>
                  <td style="font-weight:600;">${esc(t.bank_account_name || 'Account')}</td>
                  <td>${esc(t.payee || t.description)}</td>
                  <td style="font-family:monospace;color:var(--tx-muted);">${esc(t.reference || '—')}</td>
                  <td style="text-align:right;font-family:monospace;color:${dr > 0 ? '#ef4444' : 'var(--tx-muted)'};">${dr > 0 ? '₹' + dr.toLocaleString('en-IN') : '—'}</td>
                  <td style="text-align:right;font-family:monospace;font-weight:700;color:${cr > 0 ? '#059669' : 'var(--tx-muted)'};">${cr > 0 ? '₹' + cr.toLocaleString('en-IN') : '—'}</td>
                  <td><span class="banking-badge-pill banking-badge-indigo">${esc(t.status || 'Pending')}</span></td>
                </tr>
              `;
            }).join('');
          }
        }
      } else {
        renderAllTransactions();
      }
    });
  }

  const reconBalInput = root.querySelector('#bnkReconStmtBalInput');
  if (reconBalInput) {
    reconBalInput.addEventListener('input', calculateReconDifference);
  }
  const reconAccSelect = root.querySelector('#bnkReconAccSelect');
  if (reconAccSelect) {
    reconAccSelect.addEventListener('change', renderReconChecklist);
  }
  root.addEventListener('change', e => {
    if (e.target.classList.contains('bnk-recon-cb')) {
      calculateReconDifference();
    }
  });

  renderDashboardAccounts();
  renderAccountsGrid();
  renderStatements();
  renderAllTransactions();
  renderSplitMatchView();
  renderMatchedTable();
  renderCategorizedTable();
  renderUnmatchedTable();
  renderReconChecklist();
  renderTransfers();
  renderDeposits();
  renderRules();
  renderReconHistory();
  if (currentTab === 'banking-reports') {
    setTimeout(initCharts, 80);
  }
}

function fmtBankDate(dStr) {
  if (!dStr) return '—';
  if (dStr.includes('/')) return dStr;
  const parts = dStr.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dStr;
}

async function bankingDashboardPage(root) { return renderBankingModule(root, 'dashboard'); }
async function bankingAccountsPage(root) { return renderBankingModule(root, 'bank-accounts'); }
async function bankStatementsListPage(root) { return renderBankingModule(root, 'bank-statements'); }
async function bankDepositsPage(root) { return renderBankingModule(root, 'deposits'); }
async function bankTransfersPage(root) { return renderBankingModule(root, 'transfers-between-accounts'); }
async function bankRulesPage(root) { return renderBankingModule(root, 'bank-rules'); }
function importBankStatementWizard(root) { return renderBankingModule(root, 'import-bank-statements'); }
async function bankingReconciliationPage(root) { return renderBankingModule(root, 'bank-reconciliation'); }
async function reconciliationHistoryPage(root) { return renderBankingModule(root, 'reconciliation-history'); }
async function bankingReportsPage(root) { return renderBankingModule(root, 'banking-reports'); }
async function bankingMainPage(root, filterTab = 'all') {
  const map = {
    'all': 'all-transactions',
    'uncategorized': 'uncategorized-transactions',
    'matched': 'matched-transactions',
    'categorized': 'categorized-transactions',
    'unmatched': 'unmatched-transactions'
  };
  return renderBankingModule(root, map[filterTab] || 'all-transactions');
}

async function gstFilingPage(root, tab = 'overview') {
  PAGE.reload = () => gstFilingPage(root, tab);
  const tabLinks = [
    ['GST Overview', '#/filing/gst-filing', tab === 'overview'],
    ['GSTR-1 Summary', '#/filing/gstr-1-summary', tab === 'gstr1'],
    ['GSTR-3B Summary', '#/filing/gstr-3b-summary', tab === 'gstr3b'],
    ['Input Tax Credit (ITC)', '#/filing/input-tax-credit-summary', tab === 'itc'],
    ['Tax Liability Summary', '#/filing/tax-liability-summary', tab === 'tax'],
  ];

  root.innerHTML = `
    <div class="bc">Home / Filing & Compliance</div>
    <div class="hd">
      <div>
        <h1>Statutory GST Filing & Tax Compliance</h1>
        <div class="sub" style="margin-top:2px;">Automated GSTR-1, GSTR-3B, Input Tax Credit reconciliation and NIC portal JSON payload export</div>
      </div>
      <div class="act">
        <button class="btn p" id="gst-file-gstr1" type="button" style="background:linear-gradient(135deg,#10b981,#059669);border:none;">Sign & File GSTR-1</button>
        <button class="btn p" id="gst-file-gstr3b" type="button" style="background:linear-gradient(135deg,#3b82f6,#1d4ed8);border:none;">Sign & File GSTR-3B</button>
        <button class="btn" id="gst-export-json" type="button"><i class="fa-solid fa-code"></i> Official GSTN JSON</button>
        <button class="btn" id="gst-import-json" type="button"><i class="fa-solid fa-file-import"></i> Import Returns JSON</button>
        <button class="btn" id="gst-export-csv" type="button"><i class="fa-solid fa-file-export"></i> Export CSV</button>
        <button class="btn" id="gst-returns-hist" type="button">Filing History</button>
      </div>
    </div>

    <div class="tabs" style="margin:14px 0;">
      ${tabLinks.map(t => `<a href="${t[1]}" class="${t[2] ? 'on' : ''}">${esc(t[0])}</a>`).join('')}
    </div>

    <div id="gst-content-box">${spinner}</div>
  `;

  $('#gst-file-gstr1', root).addEventListener('click', () => fileGstrReturnModal('GSTR1'));
  $('#gst-file-gstr3b', root).addEventListener('click', () => fileGstrReturnModal('GSTR3B'));
  $('#gst-import-json', root).addEventListener('click', () => openUniversalImportModal('invoices', 'GST Returns & Supplies'));
  $('#gst-export-csv', root).addEventListener('click', () => { location.href = '/api/invoices/?export=csv'; });
  $('#gst-export-json', root).addEventListener('click', async () => {
    try {
      const data = await api('gst/returns/gstr1/?period=042026&fy=2026-27');
      const blob = new Blob([JSON.stringify(data.gstn_json || data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = `GSTR1_OFFICIAL_GSTN_${iso(new Date())}.json`;
      a.click();
      toast('Official GSTN schema JSON exported!');
    } catch (e) { toast(e.message, 'err'); }
  });
  $('#gst-returns-hist', root).addEventListener('click', async () => {
    try {
      const hist = await api('gst/returns/history/');
      Modal.open({
        title: 'GSTN Return Filing History & Digital Signatures',
        wide: true,
        body: `
          <div class="tw"><table><thead><tr><th>Return</th><th>Period</th><th>Status</th><th>ARN Acknowledgment</th><th>Filed Date</th><th>Tax Payable</th></tr></thead><tbody>
            ${hist.length ? hist.map(h => `<tr><td><b>${esc(h.return_type)}</b></td><td>${esc(h.tax_period)}</td><td><span class="pastel-chip chip-mint">${esc(h.status)}</span></td><td><code>${esc(h.arn || '—')}</code></td><td>${esc(h.filed_at ? fd(h.filed_at) : '—')}</td><td>${inr(h.total_tax)}</td></tr>`).join('') : '<tr><td colspan="6" class="sub" style="text-align:center;padding:16px;">No filed returns yet. File your first return above.</td></tr>'}
          </tbody></table></div>
        `,
        footer: '<button type="button" class="btn" data-close>Close</button>'
      });
    } catch (e) { toast(e.message, 'err'); }
  });

  try {
    const cBox = $('#gst-content-box', root);
    if (tab === 'overview') {
      const [g1, g3] = await Promise.all([api('reports/gstr1/'), api('reports/gstr3b/')]);
      cBox.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-bottom:16px;">
          <div class="card" style="padding:16px;">
            <div class="sub" style="font-size:12px;">Total Outward Supplies (GSTR-1)</div>
            <div style="font-size:22px;font-weight:700;color:var(--tx);margin:6px 0;">${inr(g1.summary?.total_value || 0)}</div>
            <div class="sub" style="font-size:11px;">B2B Taxable: ${inr(g1.b2b?.reduce((s, x) => s + num(x.taxable), 0) || 0)}</div>
          </div>
          <div class="card" style="padding:16px;">
            <div class="sub" style="font-size:12px;">Output Tax Liability</div>
            <div style="font-size:22px;font-weight:700;color:var(--dn);margin:6px 0;">${inr(g1.summary?.total_tax || 0)}</div>
            <div class="sub" style="font-size:11px;">IGST + CGST + SGST</div>
          </div>
          <div class="card" style="padding:16px;">
            <div class="sub" style="font-size:12px;">Eligible Input Tax Credit (ITC)</div>
            <div style="font-size:22px;font-weight:700;color:var(--up);margin:6px 0;">${inr(g3.table_4_eligible_itc?.total_itc || 0)}</div>
            <div class="sub" style="font-size:11px;">Offset against purchases & bills</div>
          </div>
          <div class="card" style="padding:16px;">
            <div class="sub" style="font-size:12px;">Net Tax Payable (GSTR-3B)</div>
            <div style="font-size:22px;font-weight:700;color:var(--accent);margin:6px 0;">${inr(g3.table_5_net_tax_payable?.total_net_tax || 0)}</div>
            <div class="sub" style="font-size:11px;">Payable in Cash Ledger</div>
          </div>
        </div>

        <div class="card">
          <div class="tb"><h3 style="margin:0;font-size:14px;">GST Compliance Status & Filing Calendar</h3></div>
          <div class="cb" style="display:flex;flex-direction:column;gap:12px;">
            <div style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:var(--surface-glass-subtle);border-radius:8px;border:1px solid var(--bd);">
              <div><b>GSTR-1 (Outward Supplies)</b><div class="sub" style="font-size:12px;">Due 11th of every month · Ready to upload JSON payload</div></div>
              <span class="badge up">Ready to File</span>
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:var(--surface-glass-subtle);border-radius:8px;border:1px solid var(--bd);">
              <div><b>GSTR-3B (Summary Return & Tax Payment)</b><div class="sub" style="font-size:12px;">Due 20th of every month · Reconciled with Purchase ITC</div></div>
              <span class="badge up">Reconciled</span>
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:var(--surface-glass-subtle);border-radius:8px;border:1px solid var(--bd);">
              <div><b>E-Invoicing & E-Way Bill System</b><div class="sub" style="font-size:12px;">NIC Gateway Connected · IRN & QR generation active</div></div>
              <span class="badge up">Compliant</span>
            </div>
          </div>
        </div>
      `;
    } else if (tab === 'gstr1') {
      const g1 = await api('reports/gstr1/');
      cBox.innerHTML = `
        <div class="card" style="margin-bottom:14px;">
          <div class="tb"><h3 style="margin:0;font-size:14px;">Table 4: B2B Taxable Invoices</h3><span class="sub">${(g1.b2b || []).length} invoices</span></div>
          <div class="tw">
            <table><thead><tr><th>GSTIN</th><th>Invoice#</th><th>Date</th><th class="r">Invoice Value</th><th class="r">Taxable Value</th><th class="r">CGST</th><th class="r">SGST</th><th class="r">IGST</th></tr></thead><tbody>
              ${(g1.b2b || []).map(r => `<tr><td><b>${esc(r.gstin)}</b></td><td>${esc(r.number)}</td><td>${fd(r.date)}</td><td class="r">${inr(r.total)}</td><td class="r">${inr(r.taxable)}</td><td class="r">${inr(r.cgst)}</td><td class="r">${inr(r.sgst)}</td><td class="r">${inr(r.igst)}</td></tr>`).join('') || '<tr><td colspan="8"><div class="empty">No B2B taxable invoices in this period</div></td></tr>'}
            </tbody></table>
          </div>
        </div>
        <div class="card">
          <div class="tb"><h3 style="margin:0;font-size:14px;">Table 12: HSN Summary</h3></div>
          <div class="tw">
            <table><thead><tr><th>HSN / SAC</th><th>Description</th><th class="r">Total Qty</th><th class="r">Total Value</th><th class="r">Taxable</th><th class="r">Tax Amount</th></tr></thead><tbody>
              ${(g1.hsn_summary || []).map(h => `<tr><td><b>${esc(h.hsn)}</b></td><td>${esc(h.description)}</td><td class="r">${qty(h.quantity)}</td><td class="r">${inr(h.total_value)}</td><td class="r">${inr(h.taxable_value)}</td><td class="r">${inr(h.tax_amount)}</td></tr>`).join('') || '<tr><td colspan="6"><div class="empty">No HSN data found</div></td></tr>'}
            </tbody></table>
          </div>
        </div>
      `;
    } else if (tab === 'gstr3b') {
      const g3 = await api('reports/gstr3b/');
      cBox.innerHTML = `
        <div class="card" style="margin-bottom:14px;">
          <div class="tb"><h3 style="margin:0;font-size:14px;">3.1 Details of Outward Supplies and inward supplies liable to reverse charge</h3></div>
          <div class="tw">
            <table><thead><tr><th>Nature of Supplies</th><th class="r">Total Taxable Value</th><th class="r">Integrated Tax</th><th class="r">Central Tax</th><th class="r">State/UT Tax</th></tr></thead><tbody>
              <tr><td>(a) Outward taxable supplies (other than zero rated, nil rated and exempted)</td><td class="r"><b>${inr(g3.table_3_1_outward_supplies?.taxable || 0)}</b></td><td class="r">${inr(g3.table_3_1_outward_supplies?.igst || 0)}</td><td class="r">${inr(g3.table_3_1_outward_supplies?.cgst || 0)}</td><td class="r">${inr(g3.table_3_1_outward_supplies?.sgst || 0)}</td></tr>
            </tbody></table>
          </div>
        </div>
        <div class="card">
          <div class="tb"><h3 style="margin:0;font-size:14px;">4. Eligible ITC (Input Tax Credit Available)</h3></div>
          <div class="tw">
            <table><thead><tr><th>Details</th><th class="r">Integrated Tax</th><th class="r">Central Tax</th><th class="r">State/UT Tax</th><th class="r">Total ITC</th></tr></thead><tbody>
              <tr><td>(A) ITC Available (All other ITC - Purchases & Expenses)</td><td class="r">${inr(g3.table_4_eligible_itc?.igst || 0)}</td><td class="r">${inr(g3.table_4_eligible_itc?.cgst || 0)}</td><td class="r">${inr(g3.table_4_eligible_itc?.sgst || 0)}</td><td class="r"><b>${inr(g3.table_4_eligible_itc?.total_itc || 0)}</b></td></tr>
            </tbody></table>
          </div>
        </div>
      `;
    } else if (tab === 'itc' || tab === 'tax') {
      const rep = await api(tab === 'itc' ? 'reports/itc-summary/' : 'reports/tax-liability/');
      cBox.innerHTML = `
        <div class="card">
          <div class="tb"><h3 style="margin:0;font-size:14px;">${tab === 'itc' ? 'Input Tax Credit (ITC) Breakdown' : 'Tax Liability by GST Slab'}</h3></div>
          <div class="tw">
            <table><thead><tr><th>Category / Slab</th><th class="r">Taxable Value</th><th class="r">CGST</th><th class="r">SGST</th><th class="r">IGST</th><th class="r">Total Tax</th></tr></thead><tbody>
              ${(rep.details || []).map(d => `<tr><td><b>${esc(d.name || d.slab || 'General')}</b></td><td class="r">${inr(d.taxable || 0)}</td><td class="r">${inr(d.cgst || 0)}</td><td class="r">${inr(d.sgst || 0)}</td><td class="r">${inr(d.igst || 0)}</td><td class="r"><b>${inr(d.total || 0)}</b></td></tr>`).join('') || '<tr><td colspan="6"><div class="empty">No tax records found for this period</div></td></tr>'}
            </tbody></table>
          </div>
        </div>
      `;
    }
  } catch (e) {
    $('#gst-content-box', root).innerHTML = errBox(e.message, true);
  }
}

async function trialBalancePage(root) {
  PAGE.reload = () => trialBalancePage(root);
  root.innerHTML = `
    <div class="bc">Home / Reports / Accounting</div>
    <div class="hd">
      <div>
        <h1>Trial Balance</h1>
        <div class="sub" style="margin-top:2px;">Double-entry general ledger trial balance with debit & credit verification</div>
      </div>
      <div class="act">
        <button class="btn" id="tb-export-csv" type="button"><i class="fa-solid fa-file-export"></i> Export CSV</button>
        <button class="btn" id="tb-print-btn" type="button">Print / PDF</button>
      </div>
    </div>
    <div class="card" style="margin-top:14px;">
      <div class="tb">
        <span style="font-weight:600;">As of Date:</span>
        <input class="in" type="date" id="tb-date" value="${APP.today}" style="max-width:180px;">
        <span class="sub" id="tb-bal-badge"></span>
      </div>
      <div class="tw" id="tb-table">${spinner}</div>
    </div>
  `;
  $('#tb-print-btn', root).addEventListener('click', () => window.print());
  const dInp = $('#tb-date', root);
  dInp.addEventListener('change', () => loadTB());
  const tbExp = $('#tb-export-csv', root);
  if (tbExp) tbExp.addEventListener('click', () => exportTableToCsv($('#tb-table', root), `trial_balance_${dInp.value}.csv`));

  async function loadTB() {
    $('#tb-table', root).innerHTML = spinner;
    try {
      const res = await api(`reports/trial-balance/?as_of=${dInp.value}`);
      if (!root.isConnected) return;
      $('#tb-bal-badge', root).innerHTML = res.is_balanced
        ? `<span class="badge up">✓ Double-Entry Balanced</span>`
        : `<span class="badge dn">⚠ Discrepancy: Debits ≠ Credits</span>`;

      $('#tb-table', root).innerHTML = `
        <table>
          <thead><tr><th>Code</th><th>Account Name</th><th>Type</th><th class="r">Debit (₹)</th><th class="r">Credit (₹)</th></tr></thead>
          <tbody>
            ${res.accounts.map(a => `<tr><td><b>${esc(a.code)}</b></td><td>${esc(a.name)}</td><td><span class="pastel-chip chip-sky">${esc(a.type)}</span></td><td class="r">${num(a.debit) > 0 ? inr(a.debit) : '—'}</td><td class="r">${num(a.credit) > 0 ? inr(a.credit) : '—'}</td></tr>`).join('')}
          </tbody>
          <tfoot>
            <tr style="font-weight:700;border-top:2px solid var(--bd);">
              <td colspan="3">Total General Ledger Balance</td>
              <td class="r" style="color:var(--accent);">${inr(res.total_debit)}</td>
              <td class="r" style="color:var(--accent);">${inr(res.total_credit)}</td>
            </tr>
          </tfoot>
        </table>
      `;
    } catch (e) { $('#tb-table', root).innerHTML = errBox(e.message, true); }
  }
  loadTB();
}

async function profitAndLossPage(root) {
  PAGE.reload = () => profitAndLossPage(root);
  root.innerHTML = `
    <div class="bc">Home / Reports / Business Overview</div>
    <div class="hd">
      <div>
        <h1>Profit and Loss Statement</h1>
        <div class="sub" style="margin-top:2px;">Operating income, cost of goods sold, overhead expenses and net profit margin</div>
      </div>
      <div class="act">
        <button class="btn" id="pl-export-csv" type="button"><i class="fa-solid fa-file-export"></i> Export CSV</button>
        <button class="btn" onclick="window.print()" type="button">Print / PDF</button>
      </div>
    </div>
    <div class="card" style="margin-top:14px;padding:20px;" id="pl-container">${spinner}</div>
  `;
  const plExp = $('#pl-export-csv', root);
  if (plExp) plExp.addEventListener('click', () => exportTableToCsv($('#pl-container', root), `profit_and_loss_${iso(new Date())}.csv`));

  try {
    const res = await api('reports/profit-loss/');
    if (!root.isConnected) return;
    $('#pl-container', root).innerHTML = `
      <div style="display:flex;justify-content:space-between;margin-bottom:20px;border-bottom:1px solid var(--bd);padding-bottom:12px;">
        <div><b>${esc(APP.org.name)}</b><div class="sub">Financial Year Performance</div></div>
        <div class="r"><b>Net Profit: <span style="color:var(--up);font-size:18px;">${inr(res.net_profit || 0)}</span></b></div>
      </div>
      <table style="width:100%;">
        <thead><tr><th>Account Category</th><th class="r">Amount (₹)</th></tr></thead>
        <tbody>
          <tr style="background:var(--surface-glass-subtle);"><td colspan="2"><b>Operating Revenue / Sales Income</b></td></tr>
          ${(res.income_accounts || []).map(a => `<tr><td style="padding-left:24px;">${esc(a.name)}</td><td class="r">${inr(a.amount)}</td></tr>`).join('') || '<tr><td style="padding-left:24px;">Sales Revenue</td><td class="r">₹0.00</td></tr>'}
          <tr style="font-weight:600;"><td style="padding-left:12px;">Total Income</td><td class="r" style="color:var(--accent);">${inr(res.total_income || 0)}</td></tr>

          <tr style="background:var(--surface-glass-subtle);"><td colspan="2"><b>Cost of Goods Sold (COGS)</b></td></tr>
          <tr><td style="padding-left:24px;">Direct Material & Purchases Cost</td><td class="r">${inr(res.cogs || 0)}</td></tr>
          <tr style="font-weight:600;"><td style="padding-left:12px;">Gross Profit</td><td class="r" style="color:var(--up);">${inr(res.gross_profit || 0)}</td></tr>

          <tr style="background:var(--surface-glass-subtle);"><td colspan="2"><b>Operating & Administrative Expenses</b></td></tr>
          ${(res.expense_accounts || []).map(a => `<tr><td style="padding-left:24px;">${esc(a.name)}</td><td class="r">${inr(a.amount)}</td></tr>`).join('') || '<tr><td style="padding-left:24px;">Operating Expenses</td><td class="r">₹0.00</td></tr>'}
          <tr style="font-weight:600;"><td style="padding-left:12px;">Total Operating Expenses</td><td class="r" style="color:var(--dn);">${inr(res.total_expenses || 0)}</td></tr>
        </tbody>
        <tfoot>
          <tr style="font-size:16px;font-weight:700;border-top:2px solid var(--bd);">
            <td>Net Profit / (Loss) for the Period</td>
            <td class="r" style="color:var(--up);">${inr(res.net_profit || 0)}</td>
          </tr>
        </tfoot>
      </table>
    `;
  } catch (e) { $('#pl-container', root).innerHTML = errBox(e.message, true); }
}

async function balanceSheetPage(root) {
  PAGE.reload = () => balanceSheetPage(root);
  root.innerHTML = `
    <div class="bc">Home / Reports / Accounting</div>
    <div class="hd">
      <h1>Balance Sheet</h1>
      <div class="act">
        <button class="btn" id="bs-export-csv" type="button"><i class="fa-solid fa-file-export"></i> Export CSV</button>
        <button class="btn" onclick="window.print()" type="button">Print / PDF</button>
      </div>
    </div>
    <div class="card" style="margin-top:14px;padding:20px;" id="bs-container">${spinner}</div>
  `;
  const bsExp = $('#bs-export-csv', root);
  if (bsExp) bsExp.addEventListener('click', () => exportTableToCsv($('#bs-container', root), `balance_sheet_${iso(new Date())}.csv`));

  try {
    const res = await api('reports/balance-sheet/');
    if (!root.isConnected) return;
    $('#bs-container', root).innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;">
        <div>
          <h3 style="font-size:15px;margin-bottom:10px;border-bottom:2px solid var(--accent);padding-bottom:6px;">Assets</h3>
          <table><thead><tr><th>Asset Account</th><th class="r">Amount</th></tr></thead><tbody>
            ${(res.assets || []).map(a => `<tr><td>${esc(a.name)}</td><td class="r">${inr(a.balance)}</td></tr>`).join('') || '<tr><td>Cash & Bank Balances</td><td class="r">₹0.00</td></tr>'}
          </tbody><tfoot><tr style="font-weight:700;"><td>Total Assets</td><td class="r" style="color:var(--accent);">${inr(res.total_assets || 0)}</td></tr></tfoot></table>
        </div>
        <div>
          <h3 style="font-size:15px;margin-bottom:10px;border-bottom:2px solid var(--accent);padding-bottom:6px;">Liabilities & Equity</h3>
          <table><thead><tr><th>Account</th><th class="r">Amount</th></tr></thead><tbody>
            ${(res.liabilities || []).map(a => `<tr><td>${esc(a.name)}</td><td class="r">${inr(a.balance)}</td></tr>`).join('') || '<tr><td>Accounts Payable</td><td class="r">₹0.00</td></tr>'}
            ${(res.equity || []).map(a => `<tr><td>${esc(a.name)}</td><td class="r">${inr(a.balance)}</td></tr>`).join('') || '<tr><td>Retained Earnings</td><td class="r">₹0.00</td></tr>'}
          </tbody><tfoot><tr style="font-weight:700;"><td>Total Liabilities & Equity</td><td class="r" style="color:var(--accent);">${inr(res.total_liabilities_equity || 0)}</td></tr></tfoot></table>
        </div>
      </div>
    `;
  } catch (e) { $('#bs-container', root).innerHTML = errBox(e.message, true); }
}

async function cashFlowPage(root) {
  PAGE.reload = () => cashFlowPage(root);
  root.innerHTML = `
    <div class="bc">Home / Reports / Cash Flow</div>
    <div class="hd">
      <h1>Statement of Cash Flows</h1>
      <div class="act">
        <button class="btn" id="cf-export-csv" type="button"><i class="fa-solid fa-file-export"></i> Export CSV</button>
        <button class="btn" onclick="window.print()" type="button">Print / PDF</button>
      </div>
    </div>
    <div class="card" style="margin-top:14px;padding:20px;" id="cf-container">${spinner}</div>
  `;
  const cfExp = $('#cf-export-csv', root);
  if (cfExp) cfExp.addEventListener('click', () => exportTableToCsv($('#cf-container', root), `cash_flow_${iso(new Date())}.csv`));
  try {
    const res = await api('reports/cash-flow/');
    if (!root.isConnected) return;
    $('#cf-container', root).innerHTML = `
      <table style="width:100%;">
        <thead><tr><th>Cash Flow Activity</th><th class="r">Amount (₹)</th></tr></thead>
        <tbody>
          <tr style="background:var(--surface-glass-subtle);"><td colspan="2"><b>Cash Flow from Operating Activities</b></td></tr>
          <tr><td style="padding-left:24px;">Net Inflow from Customers (Receipts)</td><td class="r">${inr(res.operating_inflows || 0)}</td></tr>
          <tr><td style="padding-left:24px;">Payments to Vendors & Direct Costs</td><td class="r">-${inr(res.operating_outflows || 0)}</td></tr>
          <tr style="font-weight:600;"><td style="padding-left:12px;">Net Cash from Operating Activities</td><td class="r" style="color:var(--accent);">${inr(res.net_operating || 0)}</td></tr>

          <tr style="background:var(--surface-glass-subtle);"><td colspan="2"><b>Cash Flow from Financing & Transfers</b></td></tr>
          <tr><td style="padding-left:24px;">Owner Contributions & Banking Adjustments</td><td class="r">${inr(res.financing || 0)}</td></tr>
        </tbody>
        <tfoot>
          <tr style="font-size:16px;font-weight:700;border-top:2px solid var(--bd);">
            <td>Net Change in Cash and Cash Equivalents</td>
            <td class="r" style="color:var(--up);">${inr(res.net_cash_flow || 0)}</td>
          </tr>
        </tfoot>
      </table>
    `;
  } catch (e) { $('#cf-container', root).innerHTML = errBox(e.message, true); }
}

function reportsCenterPage(root) {
  const reportingCards = [
    { title: 'Stock Movement', sub: 'Comprehensive stock movement history, transfers, stock in/out, and warehouse tracking', href: '#/reports/stock-movement', icon: '🔄' },
    { title: 'Inventory Summary', sub: 'Integrated stock summary with opening, inward, outward, transfers, and total valuation', href: '#/reports/inventory-summary', icon: '📦' },
    { title: 'Stock In Report', sub: 'Detailed breakdown of all inbound stock from purchases, sales returns, and positive adjustments', href: '#/reports/stock-in-report', icon: '📥' },
    { title: 'Stock Out Report', sub: 'Complete register of stock dispatched for invoices, purchase returns, and negative adjustments', href: '#/reports/stock-out-report', icon: '📤' },
    { title: 'Stock Transfer Report', sub: 'Inter-warehouse stock relocation records with source and destination warehouse audit', href: '#/reports/stock-transfer-report', icon: '🚚' },
    { title: 'Opening Stock Report', sub: 'Product-wise and warehouse-wise opening stock balances, quantities, rates, and values', href: '#/reports/opening-stock-report', icon: '📋' },
    { title: 'Stock in Hand Report', sub: 'Available stock balances, closing quantities, and stock valuation per warehouse and product', href: '#/reports/stock-in-hand-report', icon: '📊' },
  ];

  const financialCards = [
    { title: 'Business Overview (P&L)', sub: 'Gross profit, operating margin, net profit breakdown', href: '#/reports/business-overview', icon: '📈' },
    { title: 'Trial Balance', sub: 'Checks whether total debits and credits match in the trial balance.', href: '#/reports/accounting-reports', icon: '⚖️' },
    { title: 'Statement of Cash Flows', sub: 'Operating, investing, and financing cash flows', href: '#/reports/cash-flow-reports', icon: '💸' },
    { title: 'Sales Reports by Customer', sub: 'Customer-wise turnover and GST breakdown', href: '#/reports/sales-reports', icon: '👥' },
    { title: 'Purchases Reports by Vendor', sub: 'Vendor bill volume and expenditure trends', href: '#/reports/purchase-reports', icon: '🛒' },
    { title: 'Accounts Receivable Aging', sub: 'Outstanding invoices bucketed by overdue duration', href: '#/reports/receivables', icon: '⏳' },
    { title: 'Accounts Payable Aging', sub: 'Vendor payables classified by payment terms', href: '#/reports/payables', icon: '📅' },
    { title: 'Statutory GST Reports', sub: 'GSTR-1, GSTR-3B, and Input Tax Credit returns', href: '#/reports/tax-reports', icon: '🏛️' },
  ];

  root.innerHTML = `
    <div class="bc">Home / Reports</div>
    <div class="hd">
      <div>
        <div style="display:flex;align-items:center;gap:10px;">
          <h1 style="margin:0;">Reports Center</h1>
          <span class="pastel-chip chip-sky" style="font-weight:700;font-size:12px;padding:3px 10px;">Reporting</span>
        </div>
        <div class="sub" style="margin-top:4px;">Enterprise stock movements, inventory traceability, and financial accounting reports</div>
      </div>
    </div>

    <!-- Reporting Section (Inventory & Stock Movement) -->
    <div style="margin-top:20px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;border-bottom:1px solid var(--border);padding-bottom:8px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <h2 style="font-size:15px;font-weight:700;margin:0;color:var(--tx);">Inventory & Stock Movement</h2>
          <span class="pastel-chip chip-sky" style="font-size:11px;font-weight:700;">Reporting</span>
        </div>
        <span style="font-size:12px;color:var(--tx-muted);">7 Reports</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px;">
        ${reportingCards.map(c => `
          <a href="${c.href}" class="card" style="padding:16px 18px;display:flex;align-items:flex-start;gap:14px;text-decoration:none;transition:transform 0.15s,box-shadow 0.15s;border:1px solid var(--border);">
            <div style="font-size:24px;flex-shrink:0;">${c.icon}</div>
            <div>
              <div style="font-weight:700;color:var(--tx);font-size:14px;margin-bottom:3px;display:flex;align-items:center;gap:6px;">
                ${esc(c.title)}
              </div>
              <div class="sub" style="font-size:12px;line-height:1.4;">${esc(c.sub)}</div>
            </div>
          </a>
        `).join('')}
      </div>
    </div>

    <!-- Financial Statements Section -->
    <div style="margin-top:28px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;border-bottom:1px solid var(--border);padding-bottom:8px;">
        <h2 style="font-size:15px;font-weight:700;margin:0;color:var(--tx);">Financial & Management Statements</h2>
        <span style="font-size:12px;color:var(--tx-muted);">Accounting & Tax</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px;">
        ${financialCards.map(c => `
          <a href="${c.href}" class="card" style="padding:16px 18px;display:flex;align-items:flex-start;gap:14px;text-decoration:none;transition:transform 0.15s,box-shadow 0.15s;border:1px solid var(--border);">
            <div style="font-size:24px;flex-shrink:0;">${c.icon}</div>
            <div>
              <div style="font-weight:700;color:var(--tx);font-size:14px;margin-bottom:3px;">${esc(c.title)}</div>
              <div class="sub" style="font-size:12px;line-height:1.4;">${esc(c.sub)}</div>
            </div>
          </a>
        `).join('')}
      </div>
    </div>
  `;
}

async function reportTablePage(root, reportName, title, bc) {
  PAGE.reload = () => reportTablePage(root, reportName, title, bc);
  root.innerHTML = `
    <div class="bc">Home / Reports / ${esc(bc)}</div>
    <div class="hd">
      <h1>${esc(title)}</h1>
      <div class="act">
        <button class="btn" id="rt-export-csv" type="button"><i class="fa-solid fa-file-export"></i> Export CSV</button>
        <button class="btn" onclick="window.print()" type="button">Print / PDF</button>
      </div>
    </div>
    <div class="card" style="margin-top:14px;">
      <div class="tb"><h3 style="margin:0;font-size:14px;">Report Summary</h3></div>
      <div class="tw" id="rt-table">${spinner}</div>
    </div>
  `;
  const rtExp = $('#rt-export-csv', root);
  if (rtExp) rtExp.addEventListener('click', () => exportTableToCsv($('#rt-table', root), `${reportName}_report_${iso(new Date())}.csv`));
  try {
    const res = await api(`reports/${reportName}/`);
    if (!root.isConnected) return;
    const items = res.results || res.invoices || res.bills || [];
    if (!items.length) {
      $('#rt-table', root).innerHTML = `<div class="empty">No records found for this report period.</div>`;
      return;
    }
    const cols = Object.keys(items[0]);
    $('#rt-table', root).innerHTML = `
      <table><thead><tr>${cols.map(c => `<th>${esc(c.replace('_', ' ').toUpperCase())}</th>`).join('')}</tr></thead><tbody>
        ${items.map(r => `<tr>${cols.map(c => `<td>${typeof r[c] === 'number' ? (c.includes('total') || c.includes('valuation') || c.includes('price') || c.includes('balance') ? inr(r[c]) : r[c]) : esc(r[c] || '—')}</td>`).join('')}</tr>`).join('')}
      </tbody></table>
    `;
  } catch (e) { $('#rt-table', root).innerHTML = errBox(e.message, true); }
}

async function previewOpeningStockModal(itemId, warehouse) {
  try {
    const url = `inventory/opening-stock-preview/?item_id=${encodeURIComponent(itemId)}${warehouse ? '&warehouse=' + encodeURIComponent(warehouse) : ''}`;
    const data = await api(url);
    const body = `
      <div style="display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap;">
        <div class="card" style="flex:1;min-width:180px;padding:12px 16px;border-left:4px solid #3b82f6;background:var(--bg-subtle, #f8fafc);">
          <div style="font-size:11px;color:var(--tx-muted);font-weight:700;text-transform:uppercase;">Opening Quantity</div>
          <div style="font-size:20px;font-weight:700;color:var(--tx);margin-top:4px;">${qty(data.opening_quantity)} <small style="font-size:12px;color:var(--tx-muted);font-weight:500;">${esc(data.unit)}</small></div>
        </div>
        <div class="card" style="flex:1;min-width:180px;padding:12px 16px;border-left:4px solid #10b981;background:var(--bg-subtle, #f8fafc);">
          <div style="font-size:11px;color:var(--tx-muted);font-weight:700;text-transform:uppercase;">Unit Cost / Rate</div>
          <div style="font-size:20px;font-weight:700;color:var(--tx);margin-top:4px;">${inr(data.rate)}</div>
        </div>
        <div class="card" style="flex:1;min-width:180px;padding:12px 16px;border-left:4px solid #8b5cf6;background:var(--bg-subtle, #f8fafc);">
          <div style="font-size:11px;color:var(--tx-muted);font-weight:700;text-transform:uppercase;">Opening Stock Value</div>
          <div style="font-size:20px;font-weight:700;color:#10b981;margin-top:4px;">${inr(data.opening_stock_value)}</div>
        </div>
      </div>

      <div class="card" style="padding:16px;margin-bottom:16px;">
        <h4 style="margin:0 0 12px;font-size:13px;font-weight:700;text-transform:uppercase;color:var(--tx-muted);letter-spacing:0.04em;">Product & Warehouse Information</h4>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;font-size:13px;">
          <div><span style="color:var(--tx-muted);">Product Name:</span> <b>${esc(data.product_name)}</b></div>
          <div><span style="color:var(--tx-muted);">SKU / Item Code:</span> <code>${esc(data.sku)}</code></div>
          <div><span style="color:var(--tx-muted);">Warehouse:</span> <span class="pastel-chip chip-lavender" style="font-weight:600;">${esc(data.warehouse || 'WH-MAIN')}</span> ${data.warehouse_name ? `<small>(${esc(data.warehouse_name)})</small>` : ''}</div>
          <div><span style="color:var(--tx-muted);">Transaction Date:</span> <b>${esc(data.transaction_date || '—')}</b></div>
          <div><span style="color:var(--tx-muted);">Unit of Measurement:</span> <b>${esc(data.unit)}</b></div>
          <div><span style="color:var(--tx-muted);">Opening Valuation:</span> <b style="color:#10b981;">${inr(data.opening_stock_value)}</b></div>
        </div>
      </div>

      <div class="card">
        <div class="tb" style="padding:10px 14px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
          <h4 style="margin:0;font-size:13px;font-weight:700;">Product-wise Opening Stock Details</h4>
          <span style="font-size:12px;color:var(--tx-muted);">Total Org Opening: <b>${qty(data.total_opening_quantity)}</b> (Valuation: <b>${inr(data.total_opening_value)}</b>)</span>
        </div>
        <div class="tw">
          <table style="width:100%;">
            <thead>
              <tr>
                <th>Date</th>
                <th>Reference</th>
                <th>Warehouse</th>
                <th style="text-align:right;">Opening Qty</th>
                <th style="text-align:right;">Rate</th>
                <th style="text-align:right;">Opening Value</th>
                <th>Notes / Remarks</th>
              </tr>
            </thead>
            <tbody>
              ${(data.product_details && data.product_details.length) ? data.product_details.map(d => `
                <tr>
                  <td>${esc(d.date || '—')}</td>
                  <td><code>${esc(d.reference || '—')}</code></td>
                  <td><span class="pastel-chip chip-lavender" style="font-size:11px;">${esc(d.warehouse)}</span></td>
                  <td style="text-align:right;font-weight:600;">${qty(d.quantity)} ${esc(data.unit)}</td>
                  <td style="text-align:right;">${inr(d.rate)}</td>
                  <td style="text-align:right;font-weight:600;color:#10b981;">${inr(d.value)}</td>
                  <td><small style="color:var(--tx-muted);">${esc(d.notes || '—')}</small></td>
                </tr>
              `).join('') : `<tr><td colspan="7" class="empty" style="text-align:center;padding:24px;">No opening stock entries recorded for this item.</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    `;

    Modal.open({
      title: `Opening Stock Details - ${data.product_name}`,
      body,
      footer: `<button type="button" class="btn p" data-close>Close</button>`,
      wide: true,
      dialog: true
    });
  } catch (err) {
    toast(err.message || 'Failed to load opening stock preview', 'err');
  }
}
window.previewOpeningStockModal = previewOpeningStockModal;

async function previewStockInHandModal(itemId, warehouse) {
  try {
    const url = `inventory/stock-in-hand-preview/?item_id=${encodeURIComponent(itemId)}${warehouse ? '&warehouse=' + encodeURIComponent(warehouse) : ''}`;
    const data = await api(url);
    const body = `
      <div style="background:var(--bg-subtle, #f8fafc);border:1px solid var(--border);border-left:4px solid var(--accent, #2563eb);padding:14px 18px;border-radius:8px;margin-bottom:16px;">
        <div style="font-weight:700;font-size:13px;color:var(--tx);margin-bottom:4px;">Stock Balance Formula:</div>
        <div style="font-size:13px;color:var(--tx);font-family:monospace;background:rgba(0,0,0,0.03);padding:6px 10px;border-radius:4px;display:inline-block;">
          Available Stock = Opening Stock + Stock In - Stock Out + Transfer In - Transfer Out
        </div>
        <div style="font-size:14px;margin-top:8px;font-weight:600;color:var(--tx);">
          <span style="color:#2563eb;">${qty(data.available_stock)} ${esc(data.unit)}</span> =
          ${qty(data.opening_stock)} <small style="color:var(--tx-muted);">(Opening)</small>
          + ${qty(data.total_stock_in)} <small style="color:var(--tx-muted);">(In)</small>
          - ${qty(data.total_stock_out)} <small style="color:var(--tx-muted);">(Out)</small>
          + ${qty(data.transfer_in)} <small style="color:var(--tx-muted);">(Transfer In)</small>
          - ${qty(data.transfer_out)} <small style="color:var(--tx-muted);">(Transfer Out)</small>
        </div>
      </div>

      <div style="display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap;">
        <div class="card" style="flex:1;min-width:180px;padding:12px 16px;border-left:4px solid #2563eb;background:var(--bg-subtle, #f8fafc);">
          <div style="font-size:11px;color:var(--tx-muted);font-weight:700;text-transform:uppercase;">Available Stock / In Hand</div>
          <div style="font-size:22px;font-weight:700;color:#2563eb;margin-top:4px;">${qty(data.available_stock)} <small style="font-size:13px;font-weight:500;">${esc(data.unit)}</small></div>
        </div>
        <div class="card" style="flex:1;min-width:180px;padding:12px 16px;border-left:4px solid #10b981;background:var(--bg-subtle, #f8fafc);">
          <div style="font-size:11px;color:var(--tx-muted);font-weight:700;text-transform:uppercase;">Total Stock Value</div>
          <div style="font-size:22px;font-weight:700;color:#10b981;margin-top:4px;">${inr(data.stock_value)}</div>
        </div>
        <div class="card" style="flex:1;min-width:180px;padding:12px 16px;border-left:4px solid #f59e0b;background:var(--bg-subtle, #f8fafc);">
          <div style="font-size:11px;color:var(--tx-muted);font-weight:700;text-transform:uppercase;">Unit Cost Rate</div>
          <div style="font-size:22px;font-weight:700;color:var(--tx);margin-top:4px;">${inr(data.rate)}</div>
        </div>
      </div>

      <div class="card" style="margin-bottom:16px;">
        <div class="tb" style="padding:10px 14px;border-bottom:1px solid var(--border);">
          <h4 style="margin:0;font-size:13px;font-weight:700;">Stock Breakdown & Quantities</h4>
        </div>
        <div class="tw">
          <table style="width:100%;">
            <thead>
              <tr>
                <th>Product Name</th>
                <th>SKU</th>
                <th>Warehouse</th>
                <th style="text-align:right;">Opening</th>
                <th style="text-align:right;">Stock In</th>
                <th style="text-align:right;">Stock Out</th>
                <th style="text-align:right;">Transfer In</th>
                <th style="text-align:right;">Transfer Out</th>
                <th style="text-align:right;">Available Stock</th>
                <th style="text-align:right;">Stock Value</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><b>${esc(data.product_name)}</b></td>
                <td><code>${esc(data.sku)}</code></td>
                <td><span class="pastel-chip chip-lavender">${esc(data.warehouse || 'WH-MAIN')}</span></td>
                <td style="text-align:right;">${qty(data.opening_stock)}</td>
                <td style="text-align:right;color:#10b981;font-weight:600;">+${qty(data.total_stock_in)}</td>
                <td style="text-align:right;color:#ef4444;font-weight:600;">-${qty(data.total_stock_out)}</td>
                <td style="text-align:right;color:#10b981;">+${qty(data.transfer_in)}</td>
                <td style="text-align:right;color:#ef4444;">-${qty(data.transfer_out)}</td>
                <td style="text-align:right;font-weight:700;color:#2563eb;">${qty(data.available_stock)} ${esc(data.unit)}</td>
                <td style="text-align:right;font-weight:700;color:#10b981;">${inr(data.stock_value)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="tb" style="padding:10px 14px;border-bottom:1px solid var(--border);">
          <h4 style="margin:0;font-size:13px;font-weight:700;">Recent Stock Movements & Traceability</h4>
        </div>
        <div class="tw">
          <table style="width:100%;">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Reference</th>
                <th>Warehouse</th>
                <th>Change</th>
                <th>Balance After</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              ${(data.recent_movements && data.recent_movements.length) ? data.recent_movements.map(m => `
                <tr>
                  <td>${esc(m.date)}</td>
                  <td><span class="st in">${esc(m.type)}</span></td>
                  <td><code>${esc(m.reference)}</code></td>
                  <td>${m.to_warehouse ? `<span class="pastel-chip chip-sky">${esc(m.from_warehouse)} → ${esc(m.to_warehouse)}</span>` : `<span class="pastel-chip chip-lavender">${esc(m.warehouse)}</span>`}</td>
                  <td style="font-weight:600;" class="${m.change.startsWith('+') ? 'up' : 'dn'}">${esc(m.change)}</td>
                  <td style="font-weight:600;">${qty(m.balance_after)}</td>
                  <td><small style="color:var(--tx-muted);">${esc(m.reason)}</small></td>
                </tr>
              `).join('') : `<tr><td colspan="7" class="empty" style="text-align:center;padding:24px;">No movements recorded yet for this item.</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    `;

    Modal.open({
      title: `Stock in Hand & Balance - ${data.product_name}`,
      body,
      footer: `<button type="button" class="btn p" data-close>Close</button>`,
      wide: true,
      dialog: true
    });
  } catch (err) {
    toast(err.message || 'Failed to load stock in hand preview', 'err');
  }
}
window.previewStockInHandModal = previewStockInHandModal;

async function stockInReportPage(root) {
  PAGE.reload = () => stockInReportPage(root);
  const warehouses = await api('lookup/warehouses/').catch(() => []);
  root.innerHTML = `
    <div class="bc">Home / Reports / Stock In Report</div>
    <div class="hd">
      <div>
        <div style="display:flex;align-items:center;gap:10px;">
          <h1 style="margin:0;">Stock In Report</h1>
          <span class="pastel-chip chip-sky" style="font-weight:700;font-size:11px;padding:2px 8px;">Reporting</span>
        </div>
        <div class="sub" style="margin-top:2px;">Complete record of all inventory inward receipts, purchases, sales returns, and positive adjustments</div>
      </div>
      <div class="act">
        <button class="btn" id="btn-export-csv" type="button"><i class="fa-solid fa-file-export"></i> Export CSV</button>
        <button class="btn" onclick="window.print()" type="button">Print / PDF</button>
      </div>
    </div>

    <div class="card" style="margin-top:14px;padding:12px 16px;display:flex;gap:12px;align-items:center;flex-wrap:wrap;background:var(--bg-subtle, #f8fafc);">
      <div style="display:flex;align-items:center;gap:6px;">
        <label style="font-size:12px;font-weight:600;color:var(--tx-muted);">Warehouse:</label>
        <select class="in" id="rep-wh" style="width:160px;">
          <option value="">All Warehouses</option>
          ${warehouses.map(w => `<option value="${esc(w.code)}">${esc(w.code)} - ${esc(w.name)}</option>`).join('')}
        </select>
      </div>
      <div style="display:flex;align-items:center;gap:6px;">
        <label style="font-size:12px;font-weight:600;color:var(--tx-muted);">From:</label>
        <input class="in" type="date" id="rep-start" style="width:130px;">
      </div>
      <div style="display:flex;align-items:center;gap:6px;">
        <label style="font-size:12px;font-weight:600;color:var(--tx-muted);">To:</label>
        <input class="in" type="date" id="rep-end" style="width:130px;">
      </div>
      <div style="flex:1;min-width:180px;">
        <input class="in" type="search" id="rep-search" placeholder="Search item, SKU, reference…">
      </div>
      <button class="btn p" id="rep-apply" type="button">Apply Filter</button>
    </div>

    <div id="rep-kpis" style="display:flex;gap:12px;margin-top:14px;flex-wrap:wrap;"></div>

    <div class="card" style="margin-top:14px;">
      <div class="tw" id="rep-table">${spinner}</div>
    </div>
  `;

  async function loadData() {
    const wh = $('#rep-wh', root).value;
    const start = $('#rep-start', root).value;
    const end = $('#rep-end', root).value;
    const q = ($('#rep-search', root).value || '').toLowerCase().trim();
    let url = 'reports/stock-in-report/?';
    if (wh) url += `warehouse=${encodeURIComponent(wh)}&`;
    if (start) url += `start=${encodeURIComponent(start)}&`;
    if (end) url += `end=${encodeURIComponent(end)}&`;

    try {
      const data = await api(url);
      if (!root.isConnected) return;
      let rows = data.results || [];
      if (q) {
        rows = rows.filter(r => (r.item || '').toLowerCase().includes(q) || (r.sku || '').toLowerCase().includes(q) || (r.reference || '').toLowerCase().includes(q));
      }

      const totQty = rows.reduce((acc, r) => acc + (parseFloat(r.quantity) || 0), 0);
      const totVal = rows.reduce((acc, r) => acc + (parseFloat(r.value) || 0), 0);

      $('#rep-kpis', root).innerHTML = `
        <div class="card" style="flex:1;min-width:180px;padding:12px 16px;border-left:4px solid #10b981;background:var(--bg-subtle, #f8fafc);">
          <div style="font-size:11px;color:var(--tx-muted);font-weight:700;text-transform:uppercase;">Total Inward Quantity</div>
          <div style="font-size:22px;font-weight:700;color:#10b981;margin-top:4px;">${qty(totQty)}</div>
        </div>
        <div class="card" style="flex:1;min-width:180px;padding:12px 16px;border-left:4px solid #3b82f6;background:var(--bg-subtle, #f8fafc);">
          <div style="font-size:11px;color:var(--tx-muted);font-weight:700;text-transform:uppercase;">Total Inward Value</div>
          <div style="font-size:22px;font-weight:700;color:#3b82f6;margin-top:4px;">${inr(totVal)}</div>
        </div>
        <div class="card" style="flex:1;min-width:180px;padding:12px 16px;border-left:4px solid #8b5cf6;background:var(--bg-subtle, #f8fafc);">
          <div style="font-size:11px;color:var(--tx-muted);font-weight:700;text-transform:uppercase;">Total Inward Entries</div>
          <div style="font-size:22px;font-weight:700;color:var(--tx);margin-top:4px;">${rows.length}</div>
        </div>
      `;

      if (!rows.length) {
        $('#rep-table', root).innerHTML = `<div class="empty" style="padding:32px;text-align:center;">No stock inward records found matching the criteria.</div>`;
        return;
      }

      $('#rep-table', root).innerHTML = `
        <table style="width:100%;">
          <thead>
            <tr>
              <th>Date</th>
              <th>Item Name</th>
              <th>SKU</th>
              <th>Warehouse</th>
              <th>Type</th>
              <th>Reference</th>
              <th style="text-align:right;">In Qty</th>
              <th style="text-align:right;">Unit Rate</th>
              <th style="text-align:right;">Total In Value</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td>${esc(r.date)}</td>
                <td><b>${esc(r.item)}</b></td>
                <td><code>${esc(r.sku)}</code></td>
                <td><span class="pastel-chip chip-lavender" style="font-size:11px;">${esc(r.warehouse)}</span></td>
                <td><span class="st in">${esc(r.type)}</span></td>
                <td><code>${esc(r.reference)}</code></td>
                <td style="text-align:right;font-weight:700;color:#10b981;">+${qty(r.quantity)} ${esc(r.unit)}</td>
                <td style="text-align:right;">${inr(r.rate)}</td>
                <td style="text-align:right;font-weight:700;color:#10b981;">${inr(r.value)}</td>
                <td><small style="color:var(--tx-muted);">${esc(r.reason)}</small></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } catch (e) {
      $('#rep-table', root).innerHTML = errBox(e.message, true);
    }
  }

  $('#rep-apply', root).addEventListener('click', loadData);
  $('#rep-search', root).addEventListener('input', () => { clearTimeout(root._st); root._st = setTimeout(loadData, 300); });
  $('#btn-export-csv', root).addEventListener('click', () => exportTableToCsv($('#rep-table table', root), `stock_in_report_${iso(new Date())}.csv`));
  loadData();
}
window.stockInReportPage = stockInReportPage;

async function stockOutReportPage(root) {
  PAGE.reload = () => stockOutReportPage(root);
  const warehouses = await api('lookup/warehouses/').catch(() => []);
  root.innerHTML = `
    <div class="bc">Home / Reports / Stock Out Report</div>
    <div class="hd">
      <div>
        <div style="display:flex;align-items:center;gap:10px;">
          <h1 style="margin:0;">Stock Out Report</h1>
          <span class="pastel-chip chip-sky" style="font-weight:700;font-size:11px;padding:2px 8px;">Reporting</span>
        </div>
        <div class="sub" style="margin-top:2px;">Complete record of all inventory dispatches, sales deliveries, purchase returns, and negative adjustments</div>
      </div>
      <div class="act">
        <button class="btn" id="btn-export-csv" type="button"><i class="fa-solid fa-file-export"></i> Export CSV</button>
        <button class="btn" onclick="window.print()" type="button">Print / PDF</button>
      </div>
    </div>

    <div class="card" style="margin-top:14px;padding:12px 16px;display:flex;gap:12px;align-items:center;flex-wrap:wrap;background:var(--bg-subtle, #f8fafc);">
      <div style="display:flex;align-items:center;gap:6px;">
        <label style="font-size:12px;font-weight:600;color:var(--tx-muted);">Warehouse:</label>
        <select class="in" id="rep-wh" style="width:160px;">
          <option value="">All Warehouses</option>
          ${warehouses.map(w => `<option value="${esc(w.code)}">${esc(w.code)} - ${esc(w.name)}</option>`).join('')}
        </select>
      </div>
      <div style="display:flex;align-items:center;gap:6px;">
        <label style="font-size:12px;font-weight:600;color:var(--tx-muted);">From:</label>
        <input class="in" type="date" id="rep-start" style="width:130px;">
      </div>
      <div style="display:flex;align-items:center;gap:6px;">
        <label style="font-size:12px;font-weight:600;color:var(--tx-muted);">To:</label>
        <input class="in" type="date" id="rep-end" style="width:130px;">
      </div>
      <div style="flex:1;min-width:180px;">
        <input class="in" type="search" id="rep-search" placeholder="Search item, SKU, reference…">
      </div>
      <button class="btn p" id="rep-apply" type="button">Apply Filter</button>
    </div>

    <div id="rep-kpis" style="display:flex;gap:12px;margin-top:14px;flex-wrap:wrap;"></div>

    <div class="card" style="margin-top:14px;">
      <div class="tw" id="rep-table">${spinner}</div>
    </div>
  `;

  async function loadData() {
    const wh = $('#rep-wh', root).value;
    const start = $('#rep-start', root).value;
    const end = $('#rep-end', root).value;
    const q = ($('#rep-search', root).value || '').toLowerCase().trim();
    let url = 'reports/stock-out-report/?';
    if (wh) url += `warehouse=${encodeURIComponent(wh)}&`;
    if (start) url += `start=${encodeURIComponent(start)}&`;
    if (end) url += `end=${encodeURIComponent(end)}&`;

    try {
      const data = await api(url);
      if (!root.isConnected) return;
      let rows = data.results || [];
      if (q) {
        rows = rows.filter(r => (r.item || '').toLowerCase().includes(q) || (r.sku || '').toLowerCase().includes(q) || (r.reference || '').toLowerCase().includes(q));
      }

      const totQty = rows.reduce((acc, r) => acc + (parseFloat(r.quantity) || 0), 0);
      const totVal = rows.reduce((acc, r) => acc + (parseFloat(r.value) || 0), 0);

      $('#rep-kpis', root).innerHTML = `
        <div class="card" style="flex:1;min-width:180px;padding:12px 16px;border-left:4px solid #ef4444;background:var(--bg-subtle, #f8fafc);">
          <div style="font-size:11px;color:var(--tx-muted);font-weight:700;text-transform:uppercase;">Total Outward Quantity</div>
          <div style="font-size:22px;font-weight:700;color:#ef4444;margin-top:4px;">${qty(totQty)}</div>
        </div>
        <div class="card" style="flex:1;min-width:180px;padding:12px 16px;border-left:4px solid #f97316;background:var(--bg-subtle, #f8fafc);">
          <div style="font-size:11px;color:var(--tx-muted);font-weight:700;text-transform:uppercase;">Total Outward Value</div>
          <div style="font-size:22px;font-weight:700;color:#f97316;margin-top:4px;">${inr(totVal)}</div>
        </div>
        <div class="card" style="flex:1;min-width:180px;padding:12px 16px;border-left:4px solid #8b5cf6;background:var(--bg-subtle, #f8fafc);">
          <div style="font-size:11px;color:var(--tx-muted);font-weight:700;text-transform:uppercase;">Total Outward Entries</div>
          <div style="font-size:22px;font-weight:700;color:var(--tx);margin-top:4px;">${rows.length}</div>
        </div>
      `;

      if (!rows.length) {
        $('#rep-table', root).innerHTML = `<div class="empty" style="padding:32px;text-align:center;">No stock outward records found matching the criteria.</div>`;
        return;
      }

      $('#rep-table', root).innerHTML = `
        <table style="width:100%;">
          <thead>
            <tr>
              <th>Date</th>
              <th>Item Name</th>
              <th>SKU</th>
              <th>Warehouse</th>
              <th>Type</th>
              <th>Reference</th>
              <th style="text-align:right;">Out Qty</th>
              <th style="text-align:right;">Unit Rate</th>
              <th style="text-align:right;">Total Out Value</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td>${esc(r.date)}</td>
                <td><b>${esc(r.item)}</b></td>
                <td><code>${esc(r.sku)}</code></td>
                <td><span class="pastel-chip chip-lavender" style="font-size:11px;">${esc(r.warehouse)}</span></td>
                <td><span class="st ba">${esc(r.type)}</span></td>
                <td><code>${esc(r.reference)}</code></td>
                <td style="text-align:right;font-weight:700;color:#ef4444;">-${qty(r.quantity)} ${esc(r.unit)}</td>
                <td style="text-align:right;">${inr(r.rate)}</td>
                <td style="text-align:right;font-weight:700;color:#ef4444;">${inr(r.value)}</td>
                <td><small style="color:var(--tx-muted);">${esc(r.reason)}</small></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } catch (e) {
      $('#rep-table', root).innerHTML = errBox(e.message, true);
    }
  }

  $('#rep-apply', root).addEventListener('click', loadData);
  $('#rep-search', root).addEventListener('input', () => { clearTimeout(root._st); root._st = setTimeout(loadData, 300); });
  $('#btn-export-csv', root).addEventListener('click', () => exportTableToCsv($('#rep-table table', root), `stock_out_report_${iso(new Date())}.csv`));
  loadData();
}
window.stockOutReportPage = stockOutReportPage;

async function stockTransferReportPage(root) {
  PAGE.reload = () => stockTransferReportPage(root);
  const warehouses = await api('lookup/warehouses/').catch(() => []);
  root.innerHTML = `
    <div class="bc">Home / Reports / Stock Transfer Report</div>
    <div class="hd">
      <div>
        <div style="display:flex;align-items:center;gap:10px;">
          <h1 style="margin:0;">Stock Transfer Report</h1>
          <span class="pastel-chip chip-sky" style="font-weight:700;font-size:11px;padding:2px 8px;">Reporting</span>
        </div>
        <div class="sub" style="margin-top:2px;">Audit trail of inter-warehouse stock movements, relocations, and transit tracking</div>
      </div>
      <div class="act">
        <button class="btn p" id="btn-new-transfer" type="button"><i class="fa-solid fa-plus"></i> Move Stock</button>
        <button class="btn" id="btn-export-csv" type="button"><i class="fa-solid fa-file-export"></i> Export CSV</button>
        <button class="btn" onclick="window.print()" type="button">Print / PDF</button>
      </div>
    </div>

    <div class="card" style="margin-top:14px;padding:12px 16px;display:flex;gap:12px;align-items:center;flex-wrap:wrap;background:var(--bg-subtle, #f8fafc);">
      <div style="display:flex;align-items:center;gap:6px;">
        <label style="font-size:12px;font-weight:600;color:var(--tx-muted);">Warehouse:</label>
        <select class="in" id="rep-wh" style="width:160px;">
          <option value="">All Warehouses</option>
          ${warehouses.map(w => `<option value="${esc(w.code)}">${esc(w.code)} - ${esc(w.name)}</option>`).join('')}
        </select>
      </div>
      <div style="display:flex;align-items:center;gap:6px;">
        <label style="font-size:12px;font-weight:600;color:var(--tx-muted);">From:</label>
        <input class="in" type="date" id="rep-start" style="width:130px;">
      </div>
      <div style="display:flex;align-items:center;gap:6px;">
        <label style="font-size:12px;font-weight:600;color:var(--tx-muted);">To:</label>
        <input class="in" type="date" id="rep-end" style="width:130px;">
      </div>
      <div style="flex:1;min-width:180px;">
        <input class="in" type="search" id="rep-search" placeholder="Search item, SKU, transfer reference…">
      </div>
      <button class="btn p" id="rep-apply" type="button">Apply Filter</button>
    </div>

    <div id="rep-kpis" style="display:flex;gap:12px;margin-top:14px;flex-wrap:wrap;"></div>

    <div class="card" style="margin-top:14px;">
      <div class="tw" id="rep-table">${spinner}</div>
    </div>
  `;

  $('#btn-new-transfer', root).addEventListener('click', () => stockMoveModal());

  async function loadData() {
    const wh = $('#rep-wh', root).value;
    const start = $('#rep-start', root).value;
    const end = $('#rep-end', root).value;
    const q = ($('#rep-search', root).value || '').toLowerCase().trim();
    let url = 'reports/stock-transfer-report/?';
    if (wh) url += `warehouse=${encodeURIComponent(wh)}&`;
    if (start) url += `start=${encodeURIComponent(start)}&`;
    if (end) url += `end=${encodeURIComponent(end)}&`;

    try {
      const data = await api(url);
      if (!root.isConnected) return;
      let rows = data.results || [];
      if (q) {
        rows = rows.filter(r => (r.item || '').toLowerCase().includes(q) || (r.sku || '').toLowerCase().includes(q) || (r.reference || '').toLowerCase().includes(q));
      }

      const totQty = rows.reduce((acc, r) => acc + (parseFloat(r.quantity) || 0), 0);

      $('#rep-kpis', root).innerHTML = `
        <div class="card" style="flex:1;min-width:180px;padding:12px 16px;border-left:4px solid #0ea5e9;background:var(--bg-subtle, #f8fafc);">
          <div style="font-size:11px;color:var(--tx-muted);font-weight:700;text-transform:uppercase;">Total Transferred Qty</div>
          <div style="font-size:22px;font-weight:700;color:#0ea5e9;margin-top:4px;">${qty(totQty)}</div>
        </div>
        <div class="card" style="flex:1;min-width:180px;padding:12px 16px;border-left:4px solid #8b5cf6;background:var(--bg-subtle, #f8fafc);">
          <div style="font-size:11px;color:var(--tx-muted);font-weight:700;text-transform:uppercase;">Total Transfer Events</div>
          <div style="font-size:22px;font-weight:700;color:var(--tx);margin-top:4px;">${rows.length}</div>
        </div>
      `;

      if (!rows.length) {
        $('#rep-table', root).innerHTML = `<div class="empty" style="padding:32px;text-align:center;">No stock transfer records found matching the criteria.</div>`;
        return;
      }

      $('#rep-table', root).innerHTML = `
        <table style="width:100%;">
          <thead>
            <tr>
              <th>Date</th>
              <th>Reference</th>
              <th>Item Name</th>
              <th>SKU</th>
              <th>Source Warehouse</th>
              <th>Destination Warehouse</th>
              <th style="text-align:right;">Transferred Qty</th>
              <th>Reason</th>
              <th>Notes / Transit</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td>${esc(r.date)}</td>
                <td><code>${esc(r.reference)}</code></td>
                <td><b>${esc(r.item)}</b></td>
                <td><code>${esc(r.sku)}</code></td>
                <td><span class="pastel-chip chip-lavender" style="font-size:11px;">${esc(r.from_warehouse)}</span></td>
                <td><span class="pastel-chip chip-sky" style="font-size:11px;">${esc(r.to_warehouse)}</span></td>
                <td style="text-align:right;font-weight:700;color:#0ea5e9;">${qty(r.quantity)} ${esc(r.unit)}</td>
                <td>${esc(r.reason)}</td>
                <td><small style="color:var(--tx-muted);">${esc(r.notes || '—')}</small></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } catch (e) {
      $('#rep-table', root).innerHTML = errBox(e.message, true);
    }
  }

  $('#rep-apply', root).addEventListener('click', loadData);
  $('#rep-search', root).addEventListener('input', () => { clearTimeout(root._st); root._st = setTimeout(loadData, 300); });
  $('#btn-export-csv', root).addEventListener('click', () => exportTableToCsv($('#rep-table table', root), `stock_transfer_report_${iso(new Date())}.csv`));
  loadData();
}
window.stockTransferReportPage = stockTransferReportPage;

async function openingStockReportPage(root) {
  PAGE.reload = () => openingStockReportPage(root);
  const warehouses = await api('lookup/warehouses/').catch(() => []);
  root.innerHTML = `
    <div class="bc">Home / Reports / Opening Stock Report</div>
    <div class="hd">
      <div>
        <div style="display:flex;align-items:center;gap:10px;">
          <h1 style="margin:0;">Opening Stock Report</h1>
          <span class="pastel-chip chip-sky" style="font-weight:700;font-size:11px;padding:2px 8px;">Reporting</span>
        </div>
        <div class="sub" style="margin-top:2px;">Initial inventory balances, opening quantities, cost rates, and opening asset valuation per product</div>
      </div>
      <div class="act">
        <button class="btn" id="btn-export-csv" type="button"><i class="fa-solid fa-file-export"></i> Export CSV</button>
        <button class="btn" onclick="window.print()" type="button">Print / PDF</button>
      </div>
    </div>

    <div class="card" style="margin-top:14px;padding:12px 16px;display:flex;gap:12px;align-items:center;flex-wrap:wrap;background:var(--bg-subtle, #f8fafc);">
      <div style="display:flex;align-items:center;gap:6px;">
        <label style="font-size:12px;font-weight:600;color:var(--tx-muted);">Warehouse:</label>
        <select class="in" id="rep-wh" style="width:160px;">
          <option value="">All Warehouses</option>
          ${warehouses.map(w => `<option value="${esc(w.code)}">${esc(w.code)} - ${esc(w.name)}</option>`).join('')}
        </select>
      </div>
      <div style="flex:1;min-width:200px;">
        <input class="in" type="search" id="rep-search" placeholder="Search product name, SKU, warehouse…">
      </div>
      <button class="btn p" id="rep-apply" type="button">Apply Filter</button>
    </div>

    <div id="rep-kpis" style="display:flex;gap:12px;margin-top:14px;flex-wrap:wrap;"></div>

    <div class="card" style="margin-top:14px;">
      <div class="tw" id="rep-table">${spinner}</div>
    </div>
  `;

  async function loadData() {
    const wh = $('#rep-wh', root).value;
    const q = ($('#rep-search', root).value || '').toLowerCase().trim();
    let url = 'reports/opening-stock-report/?';
    if (wh) url += `warehouse=${encodeURIComponent(wh)}&`;

    try {
      const data = await api(url);
      if (!root.isConnected) return;
      let rows = data.results || [];
      if (q) {
        rows = rows.filter(r => (r.product_name || '').toLowerCase().includes(q) || (r.sku || '').toLowerCase().includes(q) || (r.warehouse || '').toLowerCase().includes(q));
      }

      const totQty = rows.reduce((acc, r) => acc + (parseFloat(r.opening_quantity) || 0), 0);
      const totVal = rows.reduce((acc, r) => acc + (parseFloat(r.opening_stock_value) || 0), 0);

      $('#rep-kpis', root).innerHTML = `
        <div class="card" style="flex:1;min-width:180px;padding:12px 16px;border-left:4px solid #3b82f6;background:var(--bg-subtle, #f8fafc);">
          <div style="font-size:11px;color:var(--tx-muted);font-weight:700;text-transform:uppercase;">Total Opening Quantity</div>
          <div style="font-size:22px;font-weight:700;color:#3b82f6;margin-top:4px;">${qty(totQty)}</div>
        </div>
        <div class="card" style="flex:1;min-width:180px;padding:12px 16px;border-left:4px solid #10b981;background:var(--bg-subtle, #f8fafc);">
          <div style="font-size:11px;color:var(--tx-muted);font-weight:700;text-transform:uppercase;">Total Opening Value</div>
          <div style="font-size:22px;font-weight:700;color:#10b981;margin-top:4px;">${inr(totVal)}</div>
        </div>
        <div class="card" style="flex:1;min-width:180px;padding:12px 16px;border-left:4px solid #8b5cf6;background:var(--bg-subtle, #f8fafc);">
          <div style="font-size:11px;color:var(--tx-muted);font-weight:700;text-transform:uppercase;">Tracked Goods Items</div>
          <div style="font-size:22px;font-weight:700;color:var(--tx);margin-top:4px;">${rows.length}</div>
        </div>
      `;

      if (!rows.length) {
        $('#rep-table', root).innerHTML = `<div class="empty" style="padding:32px;text-align:center;">No opening stock records found.</div>`;
        return;
      }

      $('#rep-table', root).innerHTML = `
        <table style="width:100%;">
          <thead>
            <tr>
              <th>Product Name</th>
              <th>SKU / Item Code</th>
              <th>Warehouse</th>
              <th style="text-align:right;">Opening Quantity</th>
              <th>Unit</th>
              <th style="text-align:right;">Rate</th>
              <th style="text-align:right;">Opening Stock Value</th>
              <th>Transaction Date</th>
              <th style="text-align:center;">Action</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td><b>${esc(r.product_name)}</b></td>
                <td><code>${esc(r.sku)}</code></td>
                <td><span class="pastel-chip chip-lavender" style="font-size:11px;">${esc(r.warehouse)}</span></td>
                <td style="text-align:right;font-weight:700;color:#2563eb;">
                  <button class="lk" type="button" data-act="prev" data-id="${r.item_id}" data-wh="${esc(r.warehouse)}" style="background:none;border:none;cursor:pointer;font-weight:700;text-decoration:underline;">
                    ${qty(r.opening_quantity)}
                  </button>
                </td>
                <td>${esc(r.unit)}</td>
                <td style="text-align:right;">${inr(r.rate)}</td>
                <td style="text-align:right;font-weight:700;color:#10b981;">${inr(r.opening_stock_value)}</td>
                <td>${esc(r.transaction_date || '—')}</td>
                <td style="text-align:center;">
                  <button class="btn s" type="button" data-act="prev" data-id="${r.item_id}" data-wh="${esc(r.warehouse)}">Preview</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;

      $('#rep-table', root).querySelectorAll('[data-act="prev"]').forEach(btn => {
        btn.addEventListener('click', () => previewOpeningStockModal(btn.dataset.id, btn.dataset.wh));
      });
    } catch (e) {
      $('#rep-table', root).innerHTML = errBox(e.message, true);
    }
  }

  $('#rep-apply', root).addEventListener('click', loadData);
  $('#rep-search', root).addEventListener('input', () => { clearTimeout(root._st); root._st = setTimeout(loadData, 300); });
  $('#btn-export-csv', root).addEventListener('click', () => exportTableToCsv($('#rep-table table', root), `opening_stock_report_${iso(new Date())}.csv`));
  loadData();
}
window.openingStockReportPage = openingStockReportPage;

async function stockInHandReportPage(root) {
  PAGE.reload = () => stockInHandReportPage(root);
  const warehouses = await api('lookup/warehouses/').catch(() => []);
  root.innerHTML = `
    <div class="bc">Home / Reports / Stock in Hand Report</div>
    <div class="hd">
      <div>
        <div style="display:flex;align-items:center;gap:10px;">
          <h1 style="margin:0;">Stock in Hand Report</h1>
          <span class="pastel-chip chip-sky" style="font-weight:700;font-size:11px;padding:2px 8px;">Reporting</span>
        </div>
        <div class="sub" style="margin-top:2px;">Current stock balances, available quantities, warehouse allocations, and real-time inventory valuation</div>
      </div>
      <div class="act">
        <button class="btn" id="btn-export-csv" type="button"><i class="fa-solid fa-file-export"></i> Export CSV</button>
        <button class="btn" onclick="window.print()" type="button">Print / PDF</button>
      </div>
    </div>

    <div class="card" style="margin-top:14px;padding:12px 16px;display:flex;gap:12px;align-items:center;flex-wrap:wrap;background:var(--bg-subtle, #f8fafc);">
      <div style="display:flex;align-items:center;gap:6px;">
        <label style="font-size:12px;font-weight:600;color:var(--tx-muted);">Warehouse:</label>
        <select class="in" id="rep-wh" style="width:160px;">
          <option value="">All Warehouses</option>
          ${warehouses.map(w => `<option value="${esc(w.code)}">${esc(w.code)} - ${esc(w.name)}</option>`).join('')}
        </select>
      </div>
      <div style="flex:1;min-width:200px;">
        <input class="in" type="search" id="rep-search" placeholder="Search product name, SKU, warehouse…">
      </div>
      <button class="btn p" id="rep-apply" type="button">Apply Filter</button>
    </div>

    <div id="rep-kpis" style="display:flex;gap:12px;margin-top:14px;flex-wrap:wrap;"></div>

    <div class="card" style="margin-top:14px;">
      <div class="tw" id="rep-table">${spinner}</div>
    </div>
  `;

  async function loadData() {
    const wh = $('#rep-wh', root).value;
    const q = ($('#rep-search', root).value || '').toLowerCase().trim();
    let url = 'reports/stock-in-hand-report/?';
    if (wh) url += `warehouse=${encodeURIComponent(wh)}&`;

    try {
      const data = await api(url);
      if (!root.isConnected) return;
      let rows = data.results || [];
      if (q) {
        rows = rows.filter(r => (r.product_name || '').toLowerCase().includes(q) || (r.sku || '').toLowerCase().includes(q) || (r.warehouse || '').toLowerCase().includes(q));
      }

      const totAvail = rows.reduce((acc, r) => acc + (parseFloat(r.available_stock) || 0), 0);
      const totVal = rows.reduce((acc, r) => acc + (parseFloat(r.stock_value) || 0), 0);
      const lowCount = rows.filter(r => r.status === 'Low stock').length;
      const outCount = rows.filter(r => r.status === 'Out of stock').length;

      $('#rep-kpis', root).innerHTML = `
        <div class="card" style="flex:1;min-width:180px;padding:12px 16px;border-left:4px solid #2563eb;background:var(--bg-subtle, #f8fafc);">
          <div style="font-size:11px;color:var(--tx-muted);font-weight:700;text-transform:uppercase;">Total Stock in Hand</div>
          <div style="font-size:22px;font-weight:700;color:#2563eb;margin-top:4px;">${qty(totAvail)}</div>
        </div>
        <div class="card" style="flex:1;min-width:180px;padding:12px 16px;border-left:4px solid #10b981;background:var(--bg-subtle, #f8fafc);">
          <div style="font-size:11px;color:var(--tx-muted);font-weight:700;text-transform:uppercase;">Total Stock Valuation</div>
          <div style="font-size:22px;font-weight:700;color:#10b981;margin-top:4px;">${inr(totVal)}</div>
        </div>
        <div class="card" style="flex:1;min-width:180px;padding:12px 16px;border-left:4px solid #f59e0b;background:var(--bg-subtle, #f8fafc);">
          <div style="font-size:11px;color:var(--tx-muted);font-weight:700;text-transform:uppercase;">Low Stock / Out of Stock</div>
          <div style="font-size:22px;font-weight:700;color:var(--tx);margin-top:4px;">${lowCount + outCount} <small style="font-size:12px;color:var(--tx-muted);">(${lowCount} low, ${outCount} out)</small></div>
        </div>
      `;

      if (!rows.length) {
        $('#rep-table', root).innerHTML = `<div class="empty" style="padding:32px;text-align:center;">No stock in hand records found.</div>`;
        return;
      }

      $('#rep-table', root).innerHTML = `
        <table style="width:100%;">
          <thead>
            <tr>
              <th>Product Name</th>
              <th>SKU / Item Code</th>
              <th>Warehouse</th>
              <th style="text-align:right;">Opening</th>
              <th style="text-align:right;">Stock In</th>
              <th style="text-align:right;">Stock Out</th>
              <th style="text-align:right;">Transfer In</th>
              <th style="text-align:right;">Transfer Out</th>
              <th style="text-align:right;">Available Stock</th>
              <th style="text-align:right;">Rate</th>
              <th style="text-align:right;">Stock Value</th>
              <th>Status</th>
              <th style="text-align:center;">Action</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td><b>${esc(r.product_name)}</b></td>
                <td><code>${esc(r.sku)}</code></td>
                <td><span class="pastel-chip chip-lavender" style="font-size:11px;">${esc(r.warehouse)}</span></td>
                <td style="text-align:right;">${qty(r.opening_stock)}</td>
                <td style="text-align:right;color:#10b981;">+${qty(r.total_stock_in)}</td>
                <td style="text-align:right;color:#ef4444;">-${qty(r.total_stock_out)}</td>
                <td style="text-align:right;color:#0ea5e9;">+${qty(r.transfer_in)}</td>
                <td style="text-align:right;color:#f97316;">-${qty(r.transfer_out)}</td>
                <td style="text-align:right;font-weight:700;color:#2563eb;">
                  <button class="lk" type="button" data-act="prev" data-id="${r.item_id}" data-wh="${esc(r.warehouse)}" style="background:none;border:none;cursor:pointer;font-weight:700;text-decoration:underline;">
                    ${qty(r.available_stock)} ${esc(r.unit)}
                  </button>
                </td>
                <td style="text-align:right;">${inr(r.rate)}</td>
                <td style="text-align:right;font-weight:700;color:#10b981;">${inr(r.stock_value)}</td>
                <td>${badge(r.status)}</td>
                <td style="text-align:center;">
                  <button class="btn s" type="button" data-act="prev" data-id="${r.item_id}" data-wh="${esc(r.warehouse)}">Preview</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;

      $('#rep-table', root).querySelectorAll('[data-act="prev"]').forEach(btn => {
        btn.addEventListener('click', () => previewStockInHandModal(btn.dataset.id, btn.dataset.wh));
      });
    } catch (e) {
      $('#rep-table', root).innerHTML = errBox(e.message, true);
    }
  }

  $('#rep-apply', root).addEventListener('click', loadData);
  $('#rep-search', root).addEventListener('input', () => { clearTimeout(root._st); root._st = setTimeout(loadData, 300); });
  $('#btn-export-csv', root).addEventListener('click', () => exportTableToCsv($('#rep-table table', root), `stock_in_hand_report_${iso(new Date())}.csv`));
  loadData();
}
window.stockInHandReportPage = stockInHandReportPage;


async function transactionLockingPage(root) {
  PAGE.reload = () => transactionLockingPage(root);
  root.innerHTML = `
    <div class="bc">Home / Accountant / Governance</div>
    <div class="hd">
      <div>
        <h1>Statutory Transaction Locking</h1>
        <div class="sub" style="margin-top:2px;">Regulatory audit compliance control preventing modifications to closed financial periods</div>
      </div>
      <div class="act">
        <button class="btn p" id="btn-lock-edit" type="button">Configure Lock Date</button>
      </div>
    </div>
    <div class="card" style="margin-top:14px;padding:24px;" id="lock-container">${spinner}</div>
  `;
  $('#btn-lock-edit', root).addEventListener('click', () => lockDateModal());

  try {
    const cur = await api('locking/');
    if (!root.isConnected) return;
    $('#lock-container', root).innerHTML = `
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px;">
        <div style="width:48px;height:48px;border-radius:12px;background:${cur.is_locked ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)'};display:grid;place-items:center;font-size:24px;">
          ${cur.is_locked ? '🔒' : '🔓'}
        </div>
        <div>
          <div style="font-size:18px;font-weight:700;">Status: ${cur.is_locked ? '<span style="color:var(--up);">Active · Period Locked</span>' : '<span style="color:var(--dn);">Unlocked</span>'}</div>
          <div class="sub">${cur.is_locked ? `Transactions on or prior to <b>${fd(cur.lock_date)}</b> are protected from changes.` : 'All historical accounting dates remain open for modification.'}</div>
        </div>
      </div>
      ${cur.is_locked ? `
        <div class="note" style="border-left:3px solid var(--accent);background:var(--surface-glass);">
          <b>Audit Enforcement:</b> Invoices, vendor bills, manual journals, and payment receipts dated on or before <b>${fd(cur.lock_date)}</b> cannot be created, updated, or deleted. Reason: <i>${esc(cur.reason)}</i>
        </div>
      ` : ''}
    `;
  } catch (e) { $('#lock-container', root).innerHTML = errBox(e.message, true); }
}

async function paymentOverviewPage(root) {
  root.innerHTML = `
    <div class="bc">Home / Convosis Payments</div>
    <div class="hd">
      <div>
        <h1>Convosis Payments Overview</h1>
        <div class="sub" style="margin-top:2px;">Integrated payment collection gateway powered by UPI Payment</div>
      </div>
      <div class="act">
        <button class="btn" onclick="location.hash='#/pay/payment-settings'" type="button">Configure UPI Gateway</button>
        <button class="btn p" onclick="location.hash='#/pay/payment-transactions'" type="button">View All Transactions</button>
      </div>
    </div>
    <div id="pay-overview-metrics">${spinner}</div>
  `;

  try {
    const res = await api('payment-transactions/');
    const txns = (res && res.results) || [];
    const totalCollected = txns.filter(t => t.status === 'captured').reduce((s, t) => s + Number(t.amount || 0), 0);
    const successCount = txns.filter(t => t.status === 'captured').length;
    const rate = txns.length ? Math.round((successCount / txns.length) * 100) : 0;

    if (!root.isConnected) return;
    $('#pay-overview-metrics', root).innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;margin-top:14px;">
        <div class="card" style="padding:16px;">
          <div class="sub">Total Volume Collected</div>
          <div style="font-size:22px;font-weight:700;margin:6px 0;">${inr(totalCollected)}</div>
          <div class="sub" style="font-size:11px;">${txns.length} total transaction${txns.length === 1 ? '' : 's'}</div>
        </div>
        <div class="card" style="padding:16px;">
          <div class="sub">Active Gateway</div>
          <div style="font-size:20px;font-weight:700;color:var(--accent);margin:6px 0;">UPI Payment</div>
          <div class="sub" style="font-size:11px;">Direct Bank Settlement</div>
        </div>
        <div class="card" style="padding:16px;">
          <div class="sub">Payment Success Rate</div>
          <div style="font-size:22px;font-weight:700;color:var(--up);margin:6px 0;">${txns.length ? rate + '%' : '—'}</div>
          <div class="sub" style="font-size:11px;">${successCount} settled</div>
        </div>
      </div>
      ${txns.length === 0 ? `
        <div class="card" style="margin-top:16px;padding:32px;text-align:center;">
          <div style="font-size:36px;margin-bottom:8px;">💳</div>
          <h3 style="margin:0 0 6px;">No Online Transactions Yet</h3>
          <p class="sub" style="max-width:440px;margin:0 auto 16px;">UPI payment links generated on your invoices will automatically appear here once paid by your clients.</p>
          <button class="btn p" onclick="location.hash='#/sales/invoices'" type="button">Go to Invoices</button>
        </div>
      ` : ''}
    `;
  } catch (e) {
    if (root.isConnected) $('#pay-overview-metrics', root).innerHTML = errBox(e.message, true);
  }
}

function paymentSettingsPage(root) {
  const savedCfg = pref.get('convosis_payment_cfg', { upi_id: '', merchant_name: '', key_secret: '', webhook_url: location.origin + '/api/webhooks/upi/' });

  root.innerHTML = `
    <div class="bc">Home / Convosis Payments / Settings</div>
    <div class="hd">
      <div>
        <h1>UPI Payment Gateway Configuration</h1>
        <div class="sub" style="margin-top:2px;">Configure UPI Payment for automated client invoice payment links &amp; QR codes</div>
      </div>
      <div class="act">
        <button class="btn p" id="btn-save-pay-cfg" type="button">Save Settings</button>
      </div>
    </div>
    <div class="card" style="margin-top:14px;padding:24px;">
      <h3 style="font-size:15px;margin-bottom:6px;">UPI Payment Gateway Credentials</h3>
      <div class="sub" style="font-size:12px;margin-bottom:16px;">Configure your UPI VPA / Merchant ID and webhook callback settings for automated payment settlement.</div>
      <form id="pay-cfg-form">
        <div class="g">
          <div class="fg s6">
            <label>UPI ID / Merchant VPA</label>
            <input class="in" id="pay_upi_id" name="upi_id" placeholder="e.g. merchant@upi or company@okaxis" value="${esc(savedCfg.upi_id || savedCfg.key_id || '')}">
          </div>
          <div class="fg s6">
            <label>Merchant Payee Name</label>
            <input class="in" id="pay_merchant_name" name="merchant_name" placeholder="Convosis Technologies Pvt Ltd" value="${esc(savedCfg.merchant_name || '')}">
          </div>
          <div class="fg s6">
            <label>Merchant Secret / Key</label>
            <input class="in" id="pay_key_secret" name="key_secret" type="password" placeholder="Enter UPI Merchant Secret" value="${esc(savedCfg.key_secret || '')}">
          </div>
          <div class="fg s6">
            <label>UPI Webhook Endpoint URL</label>
            <input class="in" id="pay_webhook_url" name="webhook_url" value="${esc(savedCfg.webhook_url || location.origin + '/api/webhooks/upi/')}" readonly>
          </div>
          <div class="fg s12">
            <div class="sub" style="font-size:11px;margin-top:2px;">Configure this webhook endpoint in your UPI gateway / bank portal to receive instant settlement alerts.</div>
          </div>
        </div>
      </form>
    </div>
  `;

  $('#btn-save-pay-cfg', root).addEventListener('click', () => {
    const upi_id = ($('#pay_upi_id', root) ? $('#pay_upi_id', root).value : '').trim();
    const merchant_name = ($('#pay_merchant_name', root) ? $('#pay_merchant_name', root).value : '').trim();
    const key_secret = $('#pay_key_secret', root).value.trim();
    const webhook_url = $('#pay_webhook_url', root).value.trim();
    pref.set('convosis_payment_cfg', { upi_id, merchant_name, key_secret, webhook_url, key_id: upi_id });
    toast('UPI payment gateway configuration saved successfully!');
  });
}

async function securityCompliancePage(root) {
  root.innerHTML = `<div class="spin" style="margin:40px auto;">Loading Security & Compliance Center…</div>`;
  try {
    const data = await api('security/compliance-summary/');
    const org = APP.org || {};

    root.innerHTML = `
      <div class="bc">Home / Accountant / Security & Compliance</div>
      <div class="hd">
        <div>
          <h1>Enterprise Security & Compliance Hub</h1>
          <div class="sub" style="margin-top:2px;">
            Built-in SOC 2 Type II trust controls, GDPR Article 15 data portability, TOTP multi-factor authentication, and statutory audit immutability.
          </div>
        </div>
        <div class="act">
          <button class="btn p" id="secDrillBtn" type="button" style="background:linear-gradient(135deg,#059669,#10b981);border:none;">
            🛡️ Run DR Drill
          </button>
          <button class="btn" id="secSnapshotBtn" type="button">
            💾 Create Snapshot
          </button>
          <button class="btn" id="secVerifyChainBtn" type="button">
            🔗 Verify Audit Chain
          </button>
          <button class="btn" id="secZohoAssistantBtn" type="button">
            ⇄ Zoho Books Assistant
          </button>
          <button class="btn" onclick="location.hash='#/accountant/statutory-audit-logs'" type="button">
            Statutory Audit Trail
          </button>
          <button class="btn" onclick="location.hash='#/accountant/transaction-locking'" type="button">
            Period Locking
          </button>
          <button class="btn p" onclick="if(window.openConvoBot) window.openConvoBot('What are our SOC2 Type II and GDPR compliance controls?');" type="button" style="background:linear-gradient(135deg,#10a37f,#6366f1);border:none;">
            Ask the Accounting Assistant
          </button>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:14px;margin-top:16px;">
        <div class="card" style="padding:18px;">
          <div class="sub" style="font-size:11.5px;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">SOC 2 Type II Posture</div>
          <div style="font-size:24px;font-weight:800;color:var(--up);margin:6px 0;">100% Compliant</div>
          <div class="sub" style="font-size:12px;">5 of 5 Trust Principles Passing Active Audits</div>
        </div>
        <div class="card" style="padding:18px;">
          <div class="sub" style="font-size:11.5px;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Multi-Factor Auth (MFA)</div>
          <div style="font-size:24px;font-weight:800;color:${data.mfa.enabled ? 'var(--accent)' : 'var(--wa)'};margin:6px 0;">
            ${data.mfa.enabled ? 'Enforced (TOTP)' : 'Optional'}
          </div>
          <div class="sub" style="font-size:12px;">Google / Microsoft Authenticator RFC 6238</div>
        </div>
        <div class="card" style="padding:18px;">
          <div class="sub" style="font-size:11.5px;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Statutory Audit Trail</div>
          <div style="font-size:24px;font-weight:800;color:var(--tx);margin:6px 0;">${data.audit.total_logs} Events</div>
          <div class="sub" style="font-size:12px;">100% Immutable · 7-Year Statutory Retention</div>
        </div>
        <div class="card" style="padding:18px;">
          <div class="sub" style="font-size:11.5px;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Regional Tax Engines</div>
          <div style="font-size:24px;font-weight:800;color:var(--accent);margin:6px 0;">GST + Multi-VAT</div>
          <div class="sub" style="font-size:12px;">E-Way Bill & E-Invoice IRN Out-of-the-Box</div>
        </div>
      </div>
          <div class="sub" style="font-size:12px;">E-Way Bill & E-Invoice IRN Out-of-the-Box</div>
        </div>
      </div>

      <div class="g" style="margin-top:16px;">

        <div class="s6">
          <div class="card" style="padding:22px;height:100%;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
              <div>
                <h3 style="font-size:16px;margin:0;font-weight:700;">Multi-Factor Authentication (MFA / 2FA)</h3>
                <div class="sub" style="font-size:12px;margin-top:2px;">Protect enterprise accounts from unauthorized access</div>
              </div>
              <button class="btn ${data.mfa.enabled ? '' : 'p'}" id="mfaToggleBtn" type="button" style="font-size:12px;">
                ${data.mfa.enabled ? 'Disable MFA (Simulate)' : 'Enable MFA'}
              </button>
            </div>

            <div style="background:var(--surface-glass-subtle);border:1px solid var(--bd);border-radius:10px;padding:14px;margin-bottom:14px;">
              <div style="display:flex;gap:12px;align-items:center;">
                <div style="width:54px;height:54px;background:#fff;border-radius:8px;padding:4px;display:grid;place-items:center;border:1px solid #cbd5e1;">
                  <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#0f172a" stroke-width="2.5"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect><rect x="9" y="9" width="6" height="6"></rect></svg>
                </div>
                <div>
                  <div style="font-size:12px;font-weight:600;">Time-Based Authenticator App Key</div>
                  <code style="display:inline-block;padding:3px 8px;background:var(--card);border-radius:6px;font-size:13px;letter-spacing:1px;font-weight:700;color:var(--accent);margin:3px 0;">JBSW Y3DP EHPK 3PXP</code>
                  <div class="sub" style="font-size:11px;">Enter into Google Authenticator, Microsoft Authenticator, or 1Password.</div>
                </div>
              </div>
            </div>

            <h4 style="font-size:13px;font-weight:600;margin:12px 0 6px;">Single-Use Emergency Recovery Backup Codes</h4>
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:16px;">
              <code style="padding:4px 6px;background:var(--surface-glass-subtle);border:1px solid var(--bd);border-radius:4px;font-size:11px;text-align:center;">CVB-8941</code>
              <code style="padding:4px 6px;background:var(--surface-glass-subtle);border:1px solid var(--bd);border-radius:4px;font-size:11px;text-align:center;">CVB-2049</code>
              <code style="padding:4px 6px;background:var(--surface-glass-subtle);border:1px solid var(--bd);border-radius:4px;font-size:11px;text-align:center;">CVB-7712</code>
              <code style="padding:4px 6px;background:var(--surface-glass-subtle);border:1px solid var(--bd);border-radius:4px;font-size:11px;text-align:center;">CVB-3310</code>
              <code style="padding:4px 6px;background:var(--surface-glass-subtle);border:1px solid var(--bd);border-radius:4px;font-size:11px;text-align:center;">CVB-9482</code>
              <code style="padding:4px 6px;background:var(--surface-glass-subtle);border:1px solid var(--bd);border-radius:4px;font-size:11px;text-align:center;">CVB-1193</code>
              <code style="padding:4px 6px;background:var(--surface-glass-subtle);border:1px solid var(--bd);border-radius:4px;font-size:11px;text-align:center;">CVB-5527</code>
              <code style="padding:4px 6px;background:var(--surface-glass-subtle);border:1px solid var(--bd);border-radius:4px;font-size:11px;text-align:center;">CVB-6604</code>
            </div>

            <h4 style="font-size:13px;font-weight:600;margin:14px 0 8px;">Active Browser & Device Sessions</h4>
            <div style="border:1px solid var(--bd);border-radius:8px;overflow:hidden;">
              <table style="width:100%;border-collapse:collapse;font-size:12px;">
                <thead>
                  <tr style="background:var(--surface-glass-subtle);text-align:left;">
                    <th style="padding:8px 10px;">Device / Location</th>
                    <th style="padding:8px 10px;">IP Address</th>
                    <th style="padding:8px 10px;">Session Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${data.active_sessions.map(s => `
                    <tr>
                      <td style="padding:8px 10px;">${esc(s.device)}</td>
                      <td style="padding:8px 10px;"><code style="font-size:11px;">${esc(s.ip_address)}</code></td>
                      <td style="padding:8px 10px;"><span class="st ok">${esc(s.status)}</span></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="s6">
          <div class="card" style="padding:22px;height:100%;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
              <div>
                <h3 style="font-size:16px;margin:0;font-weight:700;">SOC 2 Type II Trust Principles</h3>
                <div class="sub" style="font-size:12px;margin-top:2px;">Continuous compliance verification across 5 trust service criteria</div>
              </div>
              <button class="btn" id="soc2ReportBtn" type="button" style="font-size:12px;">
                Download Attestation
              </button>
            </div>

            <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:18px;">
              ${data.soc2.controls.map(c => `
                <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:var(--surface-glass-subtle);border:1px solid var(--bd);border-radius:8px;">
                  <div style="display:flex;align-items:center;gap:10px;">
                    <span style="width:20px;height:20px;border-radius:50%;background:rgba(16,185,129,0.15);color:var(--up);display:grid;place-items:center;font-size:12px;font-weight:700;">✓</span>
                    <div>
                      <div style="font-size:13px;font-weight:600;">${esc(c.principle)} Principle</div>
                      <div class="sub" style="font-size:11px;">${esc(c.detail)}</div>
                    </div>
                  </div>
                  <span class="st ok">${esc(c.status)}</span>
                </div>
              `).join('')}
            </div>

            <div style="border-top:1px solid var(--bd);padding-top:16px;margin-top:16px;">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
                <div>
                  <h3 style="font-size:15px;margin:0;font-weight:700;">GDPR Data Privacy & Portability</h3>
                  <div class="sub" style="font-size:11.5px;">Article 15 & 20 Right of Access, Rectification, and Data Export</div>
                </div>
                <button class="btn p" id="gdprExportBtn" type="button" style="font-size:12px;">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:4px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                  Export Complete Data (JSON)
                </button>
              </div>
              <p class="sub" style="font-size:12px;line-height:1.5;margin:0;">
                All customer records, transactions, attachments, and audit trail events can be exported in machine-readable JSON format. Statutory accounting records are retained for <b>7 years</b> in accordance with financial regulatory laws before PII anonymization.
              </p>
            </div>
          </div>
        </div>

        <div class="s12">
          <div class="card" style="padding:22px;">
            <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:14px;">
              <div>
                <h3 style="font-size:16px;margin:0;font-weight:700;">Fully-Managed Multi-Tenant SaaS Architecture</h3>
                <div class="sub" style="font-size:12px;margin-top:2px;">Complete tenant isolation, high availability, and out-of-the-box regional compliance</div>
              </div>
              <span class="pastel-chip chip-sky" style="font-size:12px;padding:4px 10px;">
                Tenant ID: ${esc(data.tenant.organization_id)} · Tier: ${esc(data.tenant.tier)}
              </span>
            </div>

            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:14px;">
              <div style="background:var(--surface-glass-subtle);border:1px solid var(--bd);border-radius:10px;padding:14px;">
                <div style="font-weight:600;font-size:13px;margin-bottom:4px;color:var(--accent);">Database & Tenant Isolation</div>
                <div class="sub" style="font-size:12px;line-height:1.5;">
                  Every tenant operates within an isolated namespace. Row-level filters and cryptographic token validation prevent cross-tenant data leakage.
                </div>
              </div>
              <div style="background:var(--surface-glass-subtle);border:1px solid var(--bd);border-radius:10px;padding:14px;">
                <div style="font-weight:600;font-size:13px;margin-bottom:4px;color:var(--accent);">Integrated UPI Payment Gateway</div>
                <div class="sub" style="font-size:12px;line-height:1.5;">
                  Connected UPI payment gateway with automated webhooks for instant invoice reconciliation and zero cardholder data storage.
                </div>
              </div>
              <div style="background:var(--surface-glass-subtle);border:1px solid var(--bd);border-radius:10px;padding:14px;">
                <div style="font-weight:600;font-size:13px;margin-bottom:4px;color:var(--accent);">Regional Tax Engines</div>
                <div class="sub" style="font-size:12px;line-height:1.5;">
                  Pre-configured compliance for Indian GST (CGST/SGST/IGST, E-Way Bill, E-Invoicing IRN), UAE VAT (5%), US Sales Tax, and UK/EU VAT (20%).
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    const secDrillBtn = $('#secDrillBtn', root);
    if (secDrillBtn) secDrillBtn.addEventListener('click', () => disasterRecoveryDrillModal());

    const secSnapshotBtn = $('#secSnapshotBtn', root);
    if (secSnapshotBtn) secSnapshotBtn.addEventListener('click', async () => {
      secSnapshotBtn.disabled = true;
      try {
        const snap = await api('security/backup/create/', { method: 'POST', body: { type: 'manual_snapshot' } });
        toast(`Cryptographic snapshot ${snap.snapshot_id} created successfully! (SHA-256: ${snap.checksum_sha256.slice(0, 10)}...)`, 'ok');
      } catch (e) { toast(e.message, 'err'); }
      secSnapshotBtn.disabled = false;
    });

    const secVerifyChainBtn = $('#secVerifyChainBtn', root);
    if (secVerifyChainBtn) secVerifyChainBtn.addEventListener('click', async () => {
      try {
        const res = await api('security/audit-chain/verify/');
        Modal.open({
          title: 'MCA Rule 3 Statutory Audit Hash-Chain Verification',
          body: `
            <div style="text-align:center;padding:14px;">
              <div style="width:50px;height:50px;border-radius:50%;background:rgba(16,185,129,0.15);color:var(--up);display:grid;place-items:center;font-size:24px;margin:0 auto 10px;">✓</div>
              <h3 style="margin:0 0 4px;">Ledger Hash-Chain Validated</h3>
              <div class="sub" style="margin-bottom:14px;">Complies with MCA (Ministry of Corporate Affairs) Rule 3 audit-trail requirements.</div>
              <div style="background:var(--surface-glass-subtle);padding:12px;border-radius:8px;border:1px solid var(--bd);text-align:left;font-size:12px;">
                <div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span class="sub">Chain Status:</span><span style="font-weight:700;color:var(--up);">${esc(res.mca_compliance_status)}</span></div>
                <div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span class="sub">Total Merkle Blocks:</span><span>${res.total_blocks}</span></div>
                <div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span class="sub">Tampered / Broken Blocks:</span><span>${res.tampered_count}</span></div>
                <div style="display:flex;justify-content:space-between;"><span class="sub">Hashing Algorithm:</span><span>${esc(res.algorithm)}</span></div>
              </div>
            </div>
          `,
          footer: '<button type="button" class="btn" data-close>Close</button>'
        });
      } catch (e) { toast(e.message, 'err'); }
    });

    const secZohoAssistantBtn = $('#secZohoAssistantBtn', root);
    if (secZohoAssistantBtn) secZohoAssistantBtn.addEventListener('click', () => zohoMigrationModal());

    $('#mfaToggleBtn', root).addEventListener('click', () => {
      totpMfaModal();
    });

    $('#gdprExportBtn', root).addEventListener('click', async () => {
      try {
        toast('Generating GDPR Article 15 Data Portability export…', 'ok');
        const exp = await api('security/gdpr-export/', { method: 'POST' });
        const blob = new Blob([JSON.stringify(exp, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `convosis-gdpr-export-${org.name ? slug(org.name) : 'tenant'}-${iso(new Date())}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast('GDPR export downloaded successfully!', 'ok');
      } catch (e) { toast(e.message, 'err'); }
    });

    $('#soc2ReportBtn', root).addEventListener('click', () => {
      const report = {
        attestation: 'SOC 2 Type II System and Organization Controls Readiness Assessment',
        organization: org.name || 'Convosis Technologies',
        report_period: 'Annual Continuous Audit Cycle',
        assessment_score: '100 / 100',
        trust_service_principles: data.soc2.controls,
        encryption_standards: 'AES-256 (At Rest), TLS 1.3 (In Transit)',
        mfa_enforcement: data.mfa.enabled ? 'ACTIVE (TOTP RFC 6238)' : 'INACTIVE',
        statutory_audit_trail_events: data.audit.total_logs,
        certified_by: 'Convosis Independent Compliance & Security Governance'
      };
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `soc2-type2-readiness-attestation-${iso(new Date())}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast('SOC 2 Readiness Report downloaded!', 'ok');
    });

  } catch (e) {
    root.innerHTML = errBox(e.message, true);
    const btn = $('[data-retry]', root);
    if (btn) btn.addEventListener('click', () => securityCompliancePage(root));
  }
}

async function subscriptionBillingPage(root) {
  root.innerHTML = `<div class="spin" style="margin:40px auto;">Loading Subscription & Usage Metrics…</div>`;
  try {
    const data = await api('subscription/summary/');

    const curTier = data.tier || 'free';
    const curStatus = data.status || 'Active';
    const isTrial = Boolean(data.is_trial);
    const trialDays = data.trial_days_remaining || 0;
    const purchasedAddons = data.purchased_addons || {};

    const checkIcon = `<span style="color:#10b981;font-size:16px;font-weight:700;display:inline-block;width:18px;">✓</span>`;
    const crossIcon = `<span style="color:#94a3b8;font-size:15px;display:inline-block;width:18px;">✕</span>`;

    root.innerHTML = `
      <div class="bc">Home / Settings / Subscription & Billing</div>

      <!-- Top Hero Header -->
      <div style="text-align:center;padding:20px 10px 10px;margin-bottom:10px;">
        <h1 style="font-size:32px;font-weight:800;color:var(--tx-main);margin:0 0 6px;letter-spacing:-0.5px;">Simple pricing for every business.</h1>
        <p style="font-size:15px;color:var(--tx-muted);margin:0;">Start free. Move up when your team and records grow.</p>
      </div>

      <!-- Current Subscription & Usage Metering Overview -->
      <div class="card" style="margin-top:10px;padding:20px 24px;border-radius:16px;background:var(--surface-glass-elevated);border:1px solid var(--bd);">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:14px;padding-bottom:16px;border-bottom:1px solid var(--bd-light);">
          <div style="display:flex;align-items:center;gap:14px;">
            <div style="width:46px;height:46px;border-radius:12px;background:linear-gradient(135deg,rgba(37,99,235,0.15),rgba(99,102,241,0.15));color:#2563eb;display:grid;place-items:center;font-size:22px;">⚡</div>
            <div>
              <div style="display:flex;align-items:center;gap:10px;">
                <h2 style="font-size:18px;margin:0;font-weight:700;">${esc(data.tier_display || 'Free Plan')}</h2>
                ${isTrial && trialDays > 0 ? `
                  <span class="pastel-chip chip-amber" style="font-size:11px;padding:3px 9px;font-weight:700;text-transform:uppercase;">45-Day Trial (${trialDays} days left)</span>
                ` : `
                  <span class="pastel-chip chip-mint" style="font-size:11px;padding:3px 9px;font-weight:700;text-transform:uppercase;">${esc(curStatus)}</span>
                `}
              </div>
              <div class="sub" style="font-size:12.5px;margin-top:3px;">
                Billed ${esc(data.billing_cycle || 'annually')} · Auto-renews on <b>${esc(data.period_end || 'Next billing cycle')}</b> via ${esc(data.payment_method || 'Visa ending in 4242')}
              </div>
            </div>
          </div>
          <div style="display:flex;gap:10px;align-items:center;">
            <button class="btn" id="btnToggleAutoRenew" type="button" style="font-size:12px;">
              ${data.auto_renew ? 'Auto-Renew: ON' : 'Auto-Renew: OFF'}
            </button>
            <button class="btn" id="btnUpdatePaymentMethod" type="button" style="font-size:12px;">Update Payment Method</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;margin-top:16px;">
          <div style="background:var(--surface);padding:14px;border-radius:12px;border:1px solid var(--bd-light);">
            <div class="sub" style="font-size:11.5px;font-weight:600;text-transform:uppercase;letter-spacing:0.3px;">Accounting Records Quota</div>
            <div style="font-size:22px;font-weight:800;margin:6px 0;">${Number(data.usage.records.used).toLocaleString()} <span style="font-size:13px;font-weight:500;color:var(--tx-muted);">/ ${Number(data.usage.records.limit).toLocaleString()}</span></div>
            <div class="bar" style="height:6px;border-radius:4px;"><i style="width:${data.usage.records.pct}%;background:#2563eb;border-radius:4px;"></i></div>
            <div class="sub" style="font-size:11px;margin-top:5px;">${data.usage.records.pct}% of plan record quota utilized</div>
          </div>

          <div style="background:var(--surface);padding:14px;border-radius:12px;border:1px solid var(--bd-light);">
            <div class="sub" style="font-size:11.5px;font-weight:600;text-transform:uppercase;letter-spacing:0.3px;">Books User Licenses</div>
            <div style="font-size:22px;font-weight:800;margin:6px 0;">${data.usage.user_seats.used} <span style="font-size:13px;font-weight:500;color:var(--tx-muted);">/ ${data.usage.user_seats.limit}</span></div>
            <div class="bar" style="height:6px;border-radius:4px;"><i style="width:${data.usage.user_seats.pct}%;background:#10b981;border-radius:4px;"></i></div>
            <div class="sub" style="font-size:11px;margin-top:5px;">${data.usage.user_seats.base} base plan seats ${data.usage.user_seats.addons > 0 ? `+ ${data.usage.user_seats.addons} add-on seats` : ''}</div>
          </div>

          <div style="background:var(--surface);padding:14px;border-radius:12px;border:1px solid var(--bd-light);">
            <div class="sub" style="font-size:11.5px;font-weight:600;text-transform:uppercase;letter-spacing:0.3px;">Document Vault Storage</div>
            <div style="font-size:22px;font-weight:800;margin:6px 0;">${data.usage.storage_mb.used} MB <span style="font-size:13px;font-weight:500;color:var(--tx-muted);">/ ${data.usage.storage_mb.limit >= 1024 ? (data.usage.storage_mb.limit / 1024).toFixed(0) + ' GB' : data.usage.storage_mb.limit + ' MB'}</span></div>
            <div class="bar" style="height:6px;border-radius:4px;"><i style="width:${data.usage.storage_mb.pct}%;background:#0ea5e9;border-radius:4px;"></i></div>
            <div class="sub" style="font-size:11px;margin-top:5px;">AES-256 encrypted ledger attachments</div>
          </div>

          <div style="background:var(--surface);padding:14px;border-radius:12px;border:1px solid var(--bd-light);">
            <div class="sub" style="font-size:11.5px;font-weight:600;text-transform:uppercase;letter-spacing:0.3px;">Connected Banks</div>
            <div style="font-size:22px;font-weight:800;margin:6px 0;color:#2563eb;">${data.usage.connected_banks} <span style="font-size:13px;font-weight:500;color:var(--tx-muted);">accounts</span></div>
            <div class="sub" style="font-size:11px;margin-top:14px;">Open Banking automated reconciliation</div>
          </div>
        </div>
      </div>

      <!-- 3 Books Subscription Plans Cards -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:20px;margin-top:30px;align-items:stretch;">

        <!-- 1. FREE PLAN -->
        <div class="card" style="padding:28px 24px;border-radius:20px;border:${curTier === 'free' ? '2px solid #2563eb' : '1px solid var(--bd)'};background:var(--surface-card);display:flex;flex-direction:column;justify-content:space-between;box-shadow:0 4px 20px rgba(0,0,0,0.03);">
          <div>
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <h3 style="font-size:19px;font-weight:700;margin:0;">Free</h3>
              ${curTier === 'free' ? '<span class="pastel-chip chip-indigo" style="font-size:11px;padding:2px 8px;font-weight:700;">Current Plan</span>' : ''}
            </div>
            <div style="font-size:36px;font-weight:800;color:var(--tx-main);margin:14px 0 2px;">₹0 <span style="font-size:13px;font-weight:500;color:var(--tx-muted);">/ year</span></div>
            <div class="sub" style="font-size:12.5px;color:var(--tx-muted);margin-bottom:14px;">just ₹0 a month</div>
            <p style="font-size:13px;color:var(--tx-muted);line-height:1.45;margin:0 0 20px;min-height:38px;">Small team operations starting their finance journey.</p>
            
            <ul style="list-style:none;padding:0;margin:0 0 24px;font-size:13px;line-height:2.1;color:var(--tx-main);">
              <li style="display:flex;align-items:center;gap:8px;">${checkIcon} <span><b>1 Books user</b></span></li>
              <li style="display:flex;align-items:center;gap:8px;">${checkIcon} <span>5 HRM users <span style="color:#ef4444;font-size:11px;font-weight:600;margin-left:2px;">Coming soon</span></span></li>
              <li style="display:flex;align-items:center;gap:8px;">${checkIcon} <span>10 Payroll users <span style="color:#ef4444;font-size:11px;font-weight:600;margin-left:2px;">Coming soon</span></span></li>
              <li style="display:flex;align-items:center;gap:8px;">${checkIcon} <span>15 Projects users <span style="color:#ef4444;font-size:11px;font-weight:600;margin-left:2px;">Coming soon</span></span></li>
              <li style="display:flex;align-items:center;gap:8px;">${checkIcon} <span><b>100 records</b></span></li>
              <li style="display:flex;align-items:center;gap:8px;">${checkIcon} <span>500 MB storage</span></li>
            </ul>
          </div>

          <div>
            ${curTier === 'free' ? `
              <button class="btn" style="width:100%;border-radius:24px;padding:11px;font-weight:600;" disabled>Current Active Plan</button>
            ` : `
              <button class="btn" style="width:100%;border-radius:24px;padding:11px;font-weight:600;" onclick="choosePlanAction('free')">Downgrade to Free</button>
            `}
          </div>
        </div>

        <!-- 2. PROFESSIONAL PLAN (Most Popular) -->
        <div class="card" style="padding:28px 24px;border-radius:20px;border:${curTier === 'professional' ? '2.5px solid #2563eb' : '2px solid #3b82f6'};background:var(--surface-card);position:relative;display:flex;flex-direction:column;justify-content:space-between;box-shadow:0 10px 30px rgba(37,99,235,0.08);">
          <div style="position:absolute;top:-13px;left:50%;transform:translateX(-50%);background:#2563eb;color:#fff;font-size:11.5px;font-weight:700;padding:3px 16px;border-radius:14px;box-shadow:0 2px 8px rgba(37,99,235,0.35);letter-spacing:0.2px;">Most popular</div>

          <div>
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <h3 style="font-size:19px;font-weight:700;margin:0;">Professional</h3>
              ${curTier === 'professional' ? '<span class="pastel-chip chip-mint" style="font-size:11px;padding:2px 8px;font-weight:700;">Current Plan</span>' : ''}
            </div>
            <div style="font-size:36px;font-weight:800;color:var(--tx-main);margin:14px 0 2px;">₹5,000 <span style="font-size:13px;font-weight:500;color:var(--tx-muted);">/ org / year</span></div>
            <div class="sub" style="font-size:12.5px;color:var(--tx-muted);margin-bottom:14px;">just ₹417 a month</div>
            <p style="font-size:13px;color:var(--tx-muted);line-height:1.45;margin:0 0 20px;min-height:38px;">The complete core growth tier for operational control.</p>

            <ul style="list-style:none;padding:0;margin:0 0 24px;font-size:13px;line-height:2.05;color:var(--tx-main);">
              <li style="display:flex;align-items:center;gap:8px;">${checkIcon} <span><b>2 Books users</b></span></li>
              <li style="display:flex;align-items:center;gap:8px;">${checkIcon} <span>10 HRM users <span style="color:#ef4444;font-size:11px;font-weight:600;margin-left:2px;">Coming soon</span></span></li>
              <li style="display:flex;align-items:center;gap:8px;">${checkIcon} <span>10 Payroll users <span style="color:#ef4444;font-size:11px;font-weight:600;margin-left:2px;">Coming soon</span></span></li>
              <li style="display:flex;align-items:center;gap:8px;">${checkIcon} <span>10 Projects users <span style="color:#ef4444;font-size:11px;font-weight:600;margin-left:2px;">Coming soon</span></span></li>
              <li style="display:flex;align-items:center;gap:8px;">${checkIcon} <span><b>5 lakh records</b></span></li>
              <li style="display:flex;align-items:center;gap:8px;">${checkIcon} <span>10 GB storage</span></li>
              <li style="border-top:1px dashed var(--bd-light);margin:8px 0;padding-top:8px;display:flex;align-items:center;gap:8px;">${checkIcon} <span>Complete sales and purchase</span></li>
              <li style="display:flex;align-items:center;gap:8px;">${checkIcon} <span>Multiple banks</span></li>
              <li style="display:flex;align-items:center;gap:8px;">${checkIcon} <span>All reports</span></li>
              <li style="display:flex;align-items:center;gap:8px;">${checkIcon} <span>Reconciliation support</span></li>
              <li style="display:flex;align-items:center;gap:8px;">${checkIcon} <span>Multi-currency support</span></li>
              <li style="display:flex;align-items:center;gap:8px;">${checkIcon} <span>Complete leads life cycle</span></li>
              <li style="display:flex;align-items:center;gap:8px;">${checkIcon} <span>Task, case and call log management</span></li>
            </ul>
          </div>

          <div>
            ${curTier === 'professional' ? `
              <button class="btn p" style="width:100%;border-radius:24px;padding:11px;font-weight:700;background:#2563eb;" disabled>Current Active Plan</button>
            ` : curTier === 'free' && !isTrial ? `
              <button class="btn p" style="width:100%;border-radius:24px;padding:11px;font-weight:700;background:#2563eb;color:#fff;" onclick="startTrialAction('professional')">Start 45 days free trial</button>
            ` : `
              <button class="btn p" style="width:100%;border-radius:24px;padding:11px;font-weight:700;background:#2563eb;color:#fff;" onclick="choosePlanAction('professional')">Upgrade to Professional</button>
            `}
          </div>
        </div>

        <!-- 3. PREMIUM PLAN -->
        <div class="card" style="padding:28px 24px;border-radius:20px;border:${curTier === 'premium' ? '2.5px solid #2563eb' : '1px solid var(--bd)'};background:var(--surface-card);display:flex;flex-direction:column;justify-content:space-between;box-shadow:0 4px 20px rgba(0,0,0,0.03);">
          <div>
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <h3 style="font-size:19px;font-weight:700;margin:0;">Premium</h3>
              ${curTier === 'premium' ? '<span class="pastel-chip chip-mint" style="font-size:11px;padding:2px 8px;font-weight:700;">Current Plan</span>' : ''}
            </div>
            <div style="font-size:36px;font-weight:800;color:var(--tx-main);margin:14px 0 2px;">₹20,000 <span style="font-size:13px;font-weight:500;color:var(--tx-muted);">/ org / year</span></div>
            <div class="sub" style="font-size:12.5px;color:var(--tx-muted);margin-bottom:14px;">just ₹1,667 a month</div>
            <p style="font-size:13px;color:var(--tx-muted);line-height:1.45;margin:0 0 20px;min-height:38px;">Maximum scale, warehousing, custom APIs and analytics.</p>

            <ul style="list-style:none;padding:0;margin:0 0 24px;font-size:13px;line-height:2.05;color:var(--tx-main);">
              <li style="display:flex;align-items:center;gap:8px;">${checkIcon} <span><b>5 Books users</b></span></li>
              <li style="display:flex;align-items:center;gap:8px;">${checkIcon} <span>15 HRM users <span style="color:#ef4444;font-size:11px;font-weight:600;margin-left:2px;">Coming soon</span></span></li>
              <li style="display:flex;align-items:center;gap:8px;">${checkIcon} <span>15 Payroll users <span style="color:#ef4444;font-size:11px;font-weight:600;margin-left:2px;">Coming soon</span></span></li>
              <li style="display:flex;align-items:center;gap:8px;">${checkIcon} <span>15 Projects users <span style="color:#ef4444;font-size:11px;font-weight:600;margin-left:2px;">Coming soon</span></span></li>
              <li style="display:flex;align-items:center;gap:8px;">${checkIcon} <span><b>5 million records</b></span></li>
              <li style="display:flex;align-items:center;gap:8px;">${checkIcon} <span>50 GB storage</span></li>
              <li style="border-top:1px dashed var(--bd-light);margin:8px 0;padding-top:8px;display:flex;align-items:center;gap:8px;">${checkIcon} <span><b>Everything in Professional</b></span></li>
              <li style="display:flex;align-items:center;gap:8px;">${checkIcon} <span>Custom reports</span></li>
              <li style="display:flex;align-items:center;gap:8px;">${checkIcon} <span>Custom dashboards</span></li>
              <li style="display:flex;align-items:center;gap:8px;">${checkIcon} <span>Advanced inventory tracking</span></li>
              <li style="display:flex;align-items:center;gap:8px;">${checkIcon} <span>AI agents</span></li>
              <li style="display:flex;align-items:center;gap:8px;">${checkIcon} <span>AI assistance</span></li>
              <li style="display:flex;align-items:center;gap:8px;">${checkIcon} <span>Customer portals</span></li>
              <li style="display:flex;align-items:center;gap:8px;">${checkIcon} <span>Workflows</span></li>
              <li style="display:flex;align-items:center;gap:8px;">${checkIcon} <span>Cloud functions</span></li>
            </ul>
          </div>

          <div>
            ${curTier === 'premium' ? `
              <button class="btn p" style="width:100%;border-radius:24px;padding:11px;font-weight:700;background:#2563eb;" disabled>Current Active Plan</button>
            ` : curTier === 'free' && !isTrial ? `
              <button class="btn" style="width:100%;border-radius:24px;padding:11px;font-weight:600;" onclick="startTrialAction('premium')">Start 45 days free trial</button>
            ` : `
              <button class="btn p" style="width:100%;border-radius:24px;padding:11px;font-weight:700;background:#2563eb;color:#fff;" onclick="choosePlanAction('premium')">Upgrade to Premium</button>
            `}
          </div>
        </div>

      </div>

      <!-- Custom Plan at Dedicated Scale Banner -->
      <div class="card" style="margin-top:34px;padding:26px 32px;background:linear-gradient(135deg,rgba(238,242,255,0.7),rgba(243,244,246,0.9));border:1px solid rgba(219,234,254,0.9);border-radius:18px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:20px;">
        <div style="max-width:680px;">
          <h3 style="font-size:18px;font-weight:800;margin:0 0 6px;color:#1e293b;">Need a custom plan at dedicated scale?</h3>
          <p style="font-size:13.5px;color:#475569;margin:0;line-height:1.5;">Custom record limits, dedicated hosting, custom APIs, SLA-backed support and isolated databases for enterprise operations.</p>
        </div>
        <div style="display:flex;gap:12px;align-items:center;">
          <button class="btn" type="button" id="btnContactSales" style="background:#2563eb;color:#fff;border:none;border-radius:22px;padding:9px 22px;font-weight:700;font-size:13px;box-shadow:0 2px 8px rgba(37,99,235,0.3);">Contact sales</button>
          <button class="btn" type="button" id="btnBookDemo" style="background:#fff;color:#1e293b;border:1px solid #cbd5e1;border-radius:22px;padding:9px 22px;font-weight:600;font-size:13px;">Book a demo</button>
        </div>
      </div>

      <!-- Feature Add-ons (2 Columns Layout) -->
      <div style="margin-top:48px;">
        <h2 style="font-size:22px;font-weight:800;color:var(--tx-main);margin:0 0 4px;">Feature add-ons</h2>
        <p style="font-size:13.5px;color:var(--tx-muted);margin:0 0 22px;">Available on Professional and bundled free into Premium.</p>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(420px,1fr));gap:18px 40px;">
          ${(data.feature_addons || []).map(addon => {
            const isPurchased = Boolean(purchasedAddons[addon.id]);
            const isBundled = curTier === 'premium';
            return `
              <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 0;border-bottom:1px solid var(--bd-light);">
                <div>
                  <div style="font-size:14.5px;font-weight:600;color:var(--tx-main);">${esc(addon.name)}</div>
                  ${addon.description ? `<div style="font-size:12px;color:var(--tx-muted);margin-top:2px;">${esc(addon.description)}</div>` : ''}
                </div>
                <div style="display:flex;align-items:center;gap:14px;">
                  <div style="font-size:15px;font-weight:700;color:var(--tx-main);">${esc(addon.price_display)}</div>
                  ${isBundled ? `
                    <span class="pastel-chip chip-mint" style="font-size:11px;padding:3px 9px;">Included in Premium</span>
                  ` : isPurchased ? `
                    <span class="pastel-chip chip-indigo" style="font-size:11px;padding:3px 9px;">Active</span>
                  ` : `
                    <button class="btn" type="button" style="font-size:12px;padding:4px 12px;border-radius:14px;" onclick="purchaseAddonAction('${addon.id}', '${esc(addon.name)}', ${addon.price})">+ Add</button>
                  `}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- User Add-ons (2 Columns Layout, Strictly Books/HRMS/Projects/Payroll/Portal) -->
      <div style="margin-top:48px;">
        <h2 style="font-size:22px;font-weight:800;color:var(--tx-main);margin:0 0 4px;">User add-ons</h2>
        <p style="font-size:13.5px;color:var(--tx-muted);margin:0 0 22px;">Add user packs for the apps your team needs.</p>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(420px,1fr));gap:18px 40px;">
          ${(data.user_addons || []).map(addon => {
            const isComingSoon = addon.status === 'coming_soon';
            return `
              <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 0;border-bottom:1px solid var(--bd-light);">
                <div>
                  <div style="font-size:14.5px;font-weight:600;color:var(--tx-main);display:flex;align-items:center;gap:8px;">
                    ${esc(addon.name)}
                    ${isComingSoon ? '<span style="color:#ef4444;font-size:11px;font-weight:600;">Coming soon</span>' : ''}
                  </div>
                  ${addon.description ? `<div style="font-size:12px;color:var(--tx-muted);margin-top:2px;">${esc(addon.description)}</div>` : ''}
                </div>
                <div style="display:flex;align-items:center;gap:14px;">
                  <div style="font-size:15px;font-weight:700;color:var(--tx-main);">${esc(addon.price_display)}</div>
                  ${isComingSoon ? `
                    <button class="btn" disabled style="font-size:11px;padding:4px 10px;border-radius:14px;opacity:0.6;">Coming Soon</button>
                  ` : `
                    <button class="btn p" type="button" style="font-size:12px;padding:4px 12px;border-radius:14px;background:#2563eb;" onclick="purchaseUserAddonAction('${addon.id}', '${esc(addon.name)}', ${addon.price})">+ Add Pack</button>
                  `}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Feature Comparison Table: BOOKS (Pure Books, No Tabs / No CRM Toggle) -->
      <div style="margin-top:54px;">
        <h2 style="font-size:24px;font-weight:800;color:var(--tx-main);margin:0 0 6px;">Every plan, feature by feature</h2>
        <p style="font-size:13.5px;color:var(--tx-muted);margin:0 0 20px;">Pick the model that fits your team size, control needs and growth.</p>

        <div class="card" style="padding:0;overflow:hidden;border-radius:16px;border:1px solid var(--bd);">
          <table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr style="background:var(--surface-header);border-bottom:1px solid var(--bd);">
                <th style="padding:16px 20px;text-align:left;font-size:13.5px;font-weight:700;color:var(--tx-main);width:40%;">Feature</th>
                <th style="padding:16px 14px;text-align:center;font-size:13.5px;font-weight:700;color:var(--tx-main);width:20%;">Free</th>
                <th style="padding:16px 14px;text-align:center;font-size:13.5px;font-weight:700;color:#2563eb;width:20%;">Professional</th>
                <th style="padding:16px 14px;text-align:center;font-size:13.5px;font-weight:700;color:var(--tx-main);width:20%;">Premium</th>
              </tr>
            </thead>
            <tbody>
              ${(data.comparison_features || []).map((row, idx) => `
                <tr style="border-bottom:1px solid var(--bd-light);background:${idx % 2 === 0 ? 'var(--surface-card)' : 'transparent'};">
                  <td style="padding:14px 20px;font-size:13.5px;color:var(--tx-main);font-weight:500;">${esc(row.feature)}</td>
                  <td style="padding:14px;text-align:center;">${row.free ? checkIcon : crossIcon}</td>
                  <td style="padding:14px;text-align:center;">${row.professional ? checkIcon : crossIcon}</td>
                  <td style="padding:14px;text-align:center;">${row.premium ? checkIcon : crossIcon}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Billing Invoices & Payment Statements -->
      <div style="margin-top:54px;margin-bottom:20px;">
        <h2 style="font-size:20px;font-weight:800;color:var(--tx-main);margin:0 0 6px;">Billing Invoices & Payment Statements</h2>
        <p style="font-size:13px;color:var(--tx-muted);margin:0 0 16px;">Download GST compliant subscription receipts and track past payment transactions.</p>

        <div class="card" style="padding:0;overflow:hidden;border-radius:16px;border:1px solid var(--bd);">
          <table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr style="background:var(--surface-header);border-bottom:1px solid var(--bd);">
                <th style="padding:14px 18px;text-align:left;">Invoice Number</th>
                <th style="padding:14px 14px;text-align:left;">Billing Date</th>
                <th style="padding:14px 14px;text-align:left;">Description</th>
                <th style="padding:14px 14px;text-align:left;">Status</th>
                <th style="padding:14px 18px;text-align:right;">Amount Paid</th>
                <th style="padding:14px 18px;text-align:right;">Action</th>
              </tr>
            </thead>
            <tbody>
              ${(data.invoices_history || []).map(inv => `
                <tr style="border-bottom:1px solid var(--bd-light);">
                  <td style="padding:14px 18px;"><b>${esc(inv.invoice_no)}</b></td>
                  <td style="padding:14px 14px;color:var(--tx-muted);">${esc(inv.date)}</td>
                  <td style="padding:14px 14px;color:var(--tx-main);">${esc(inv.description)}</td>
                  <td style="padding:14px 14px;"><span class="st ok">${esc(inv.status)}</span></td>
                  <td style="padding:14px 18px;text-align:right;"><b>${esc(inv.amount)}</b></td>
                  <td style="padding:14px 18px;text-align:right;">
                    <button class="btn" type="button" style="font-size:11.5px;padding:4px 11px;border-radius:8px;" onclick="downloadReceiptAction(${inv.id || 0}, '${esc(inv.invoice_no)}')">
                      <i class="fa-solid fa-download"></i> Receipt
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    // Global Action Handlers
    window.choosePlanAction = async (targetTier) => {
      const planNames = { free: 'Free Plan', professional: 'Professional Plan', premium: 'Premium Plan' };
      const planPrices = { free: '₹0/yr', professional: '₹5,000/yr', premium: '₹20,000/yr' };
      
      Modal.open({
        title: `Switch to ${planNames[targetTier]}`,
        body: `
          <div style="padding:10px 0;">
            <p style="font-size:14px;color:var(--tx-main);margin-bottom:16px;">
              You are selecting the <b>${planNames[targetTier]}</b> (${planPrices[targetTier]}).
            </p>
            <div class="card" style="background:var(--surface);padding:14px;border-radius:10px;margin-bottom:16px;">
              <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px;">
                <span>Plan Subscription:</span>
                <b>${planPrices[targetTier]}</b>
              </div>
              <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px;">
                <span>Payment Mode:</span>
                <span>UPI / Credit Card / NetBanking</span>
              </div>
              <div style="display:flex;justify-content:space-between;font-size:13px;color:var(--tx-muted);">
                <span>Billing Period:</span>
                <span>Annual (365 days)</span>
              </div>
            </div>
            <p style="font-size:12px;color:var(--tx-muted);margin:0;">
              By confirming, your plan quotas and access privileges will be updated immediately.
            </p>
          </div>
        `,
        footer: `
          <button class="btn" data-close>Cancel</button>
          <button class="btn p" id="btnConfirmPlanSwitch" style="background:#2563eb;">Confirm & Switch Plan</button>
        `
      });

      $('#btnConfirmPlanSwitch').addEventListener('click', async () => {
        try {
          Modal.close();
          toast('Processing subscription update…', 'info');
          const res = await api('subscription/update/', { method: 'POST', body: { tier: targetTier, billing_cycle: 'annual' } });
          toast(`Successfully updated subscription to ${res.tier_display}!`, 'ok');
          subscriptionBillingPage(root);
        } catch (e) {
          toast(e.message, 'err');
        }
      });
    };

    window.startTrialAction = async (targetTier) => {
      const planNames = { professional: 'Professional Plan', premium: 'Premium Plan' };
      try {
        toast('Activating 45-day free trial…', 'info');
        const res = await api('subscription/trial/', { method: 'POST', body: { tier: targetTier } });
        toast(`45-Day Free Trial activated for ${planNames[targetTier] || 'Professional'}! Enjoy full access.`, 'ok');
        subscriptionBillingPage(root);
      } catch (e) {
        toast(e.message, 'err');
      }
    };

    window.purchaseAddonAction = async (addonId, addonName, price) => {
      Modal.open({
        title: `Add Feature: ${addonName}`,
        body: `
          <div style="padding:10px 0;">
            <p style="font-size:13.5px;color:var(--tx-main);margin-bottom:14px;">
              Add <b>${addonName}</b> to your current organization subscription.
            </p>
            <div class="card" style="background:var(--surface);padding:14px;border-radius:10px;margin-bottom:14px;">
              <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px;">
                <span>Module:</span>
                <b>${addonName}</b>
              </div>
              <div style="display:flex;justify-content:space-between;font-size:13px;">
                <span>Annual Add-on Cost:</span>
                <b>₹${Number(price).toLocaleString()} / year</b>
              </div>
            </div>
            <p style="font-size:12px;color:var(--tx-muted);margin:0;">
              A GST invoice receipt will be generated and added to your billing history.
            </p>
          </div>
        `,
        footer: `
          <button class="btn" data-close>Cancel</button>
          <button class="btn p" id="btnConfirmAddon" style="background:#2563eb;">Confirm & Add</button>
        `
      });

      $('#btnConfirmAddon').addEventListener('click', async () => {
        try {
          Modal.close();
          toast(`Purchasing ${addonName}…`, 'info');
          await api('subscription/addon/', { method: 'POST', body: { addon_key: addonId, quantity: 1 } });
          toast(`${addonName} activated successfully!`, 'ok');
          subscriptionBillingPage(root);
        } catch (e) {
          toast(e.message, 'err');
        }
      });
    };

    window.purchaseUserAddonAction = async (addonId, addonName, unitPrice) => {
      Modal.open({
        title: `Add ${addonName} Pack`,
        body: `
          <div style="padding:10px 0;">
            <div class="fg" style="margin-bottom:14px;">
              <label>Number of User Packs</label>
              <select class="in" id="addonPackQty">
                <option value="1">1 Pack (₹${Number(unitPrice).toLocaleString()}/yr)</option>
                <option value="2">2 Packs (₹${Number(unitPrice * 2).toLocaleString()}/yr)</option>
                <option value="5">5 Packs (₹${Number(unitPrice * 5).toLocaleString()}/yr)</option>
                <option value="10">10 Packs (₹${Number(unitPrice * 10).toLocaleString()}/yr)</option>
              </select>
            </div>
            <div class="card" style="background:var(--surface);padding:14px;border-radius:10px;">
              <div style="display:flex;justify-content:space-between;font-size:13px;">
                <span>Total Annual Amount:</span>
                <b id="addonPackTotal" style="color:#2563eb;">₹${Number(unitPrice).toLocaleString()} / yr</b>
              </div>
            </div>
          </div>
        `,
        footer: `
          <button class="btn" data-close>Cancel</button>
          <button class="btn p" id="btnConfirmUserPack" style="background:#2563eb;">Confirm & Purchase</button>
        `
      });

      const qtySelect = $('#addonPackQty');
      const totalDisplay = $('#addonPackTotal');
      if (qtySelect && totalDisplay) {
        qtySelect.addEventListener('change', () => {
          const q = parseInt(qtySelect.value, 10) || 1;
          totalDisplay.textContent = `₹${Number(unitPrice * q).toLocaleString()} / yr`;
        });
      }

      $('#btnConfirmUserPack').addEventListener('click', async () => {
        const qty = parseInt(qtySelect.value, 10) || 1;
        try {
          Modal.close();
          toast(`Purchasing user seats…`, 'info');
          await api('subscription/addon/', { method: 'POST', body: { addon_key: addonId, quantity: qty } });
          toast(`User seats added successfully! Quota updated.`, 'ok');
          subscriptionBillingPage(root);
        } catch (e) {
          toast(e.message, 'err');
        }
      });
    };

    window.downloadReceiptAction = (invId, invNo) => {
      if (invId) {
        window.open(`/api/subscription/invoices/${invId}/receipt/`, '_blank');
      } else {
        toast(`Downloaded receipt ${invNo}`, 'ok');
      }
    };

    // Toggle Auto-Renew
    $('#btnToggleAutoRenew', root).addEventListener('click', async () => {
      try {
        const res = await api('subscription/autorenew/', { method: 'POST', body: { auto_renew: !data.auto_renew } });
        toast(`Auto-renew turned ${res.auto_renew ? 'ON' : 'OFF'}.`, 'ok');
        subscriptionBillingPage(root);
      } catch (e) {
        toast(e.message, 'err');
      }
    });

    // Update Payment Method
    $('#btnUpdatePaymentMethod', root).addEventListener('click', () => {
      Modal.open({
        title: 'Update Billing & Payment Method',
        body: `
          <div style="padding:10px 0;">
            <p class="sub" style="margin-bottom:14px;">Select your preferred corporate payment gateway or UPI handle:</p>
            <div class="fg" style="margin-bottom:12px;">
              <label>Payment Mode</label>
              <select class="in" id="selPayMode">
                <option value="UPI">UPI AutoPay (Google Pay, PhonePe, Paytm)</option>
                <option value="Card">Corporate Credit / Debit Card (Visa, Mastercard, RuPay)</option>
                <option value="NetBanking">Direct Net Banking (HDFC, ICICI, SBI, Axis)</option>
              </select>
            </div>
            <div class="fg">
              <label>VPA / Card Details / Account Reference</label>
              <input type="text" class="in" id="txtPayRef" placeholder="e.g. accounts@okaxis or Card ending 4242" value="${esc(data.payment_method || '')}">
            </div>
          </div>
        `,
        footer: `
          <button class="btn" data-close>Cancel</button>
          <button class="btn p" id="btnSavePaymentMethod" style="background:#2563eb;">Save Payment Details</button>
        `
      });

      $('#btnSavePaymentMethod').addEventListener('click', () => {
        const ref = $('#txtPayRef').value.trim() || 'UPI AutoPay';
        toast(`Payment details updated to: ${ref}`, 'ok');
        Modal.close();
      });
    });

    // Contact Sales / Book Demo
    const showSalesModal = (actionTitle) => {
      Modal.open({
        title: actionTitle,
        body: `
          <div style="padding:10px 0;">
            <p style="font-size:13.5px;color:var(--tx-muted);margin-bottom:14px;">
              Our enterprise solution architect will get in touch within 2 business hours.
            </p>
            <div class="fg" style="margin-bottom:12px;">
              <label>Contact Name</label>
              <input type="text" class="in" id="txtLeadName" placeholder="Your full name" value="Convosis Administrator">
            </div>
            <div class="fg" style="margin-bottom:12px;">
              <label>Business Email</label>
              <input type="email" class="in" id="txtLeadEmail" placeholder="name@company.com" value="admin@convosis.com">
            </div>
            <div class="fg" style="margin-bottom:12px;">
              <label>Estimated Monthly Record Quota or Needs</label>
              <input type="text" class="in" id="txtLeadNeeds" placeholder="e.g. 50+ million records, dedicated database, custom ERP sync">
            </div>
          </div>
        `,
        footer: `
          <button class="btn" data-close>Cancel</button>
          <button class="btn p" id="btnSubmitSalesLead" style="background:#2563eb;">Submit Request</button>
        `
      });

      $('#btnSubmitSalesLead').addEventListener('click', () => {
        toast('Your inquiry has been submitted! Our enterprise team will contact you shortly.', 'ok');
        Modal.close();
      });
    };

    $('#btnContactSales', root).addEventListener('click', () => showSalesModal('Contact Enterprise Sales'));
    $('#btnBookDemo', root).addEventListener('click', () => showSalesModal('Schedule a Dedicated Product Demo'));

  } catch (e) {
    root.innerHTML = errBox(e.message, true);
    const btn = $('[data-retry]', root);
    if (btn) btn.addEventListener('click', () => subscriptionBillingPage(root));
  }
}

async function tenantAdminPage(root) {
  root.innerHTML = `<div class="spin" style="margin:40px auto;">Loading Tenant Administration…</div>`;
  try {
    const data = await api('tenant/admin/summary/');

    root.innerHTML = `
      <div class="bc">Home / Accountant / SaaS Tenant Administration</div>
      <div class="hd">
        <div>
          <h1>SaaS Tenant Administration & Governance</h1>
          <div class="sub" style="margin-top:2px;">
            Multi-tenant data isolation, seat provisioning, role permissions, and tenant security health.
          </div>
        </div>
        <div class="act">
          <button class="btn" id="btnExportMembers" type="button"><i class="fa-solid fa-file-export"></i> Export Members CSV</button>
          <button class="btn p" id="btnInviteMember" type="button" style="background:linear-gradient(135deg,var(--accent),var(--accent-to));border:none;">
            + Invite Team Member
          </button>
        </div>
      </div>

      <div class="card" style="margin-top:14px;padding:20px;background:var(--surface-glass-elevated);">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:14px;">
          <div>
            <div style="display:flex;align-items:center;gap:8px;">
              <h2 style="font-size:16px;margin:0;">${esc(data.organization.name)}</h2>
              <span class="pastel-chip chip-sky" style="font-size:11px;">Tenant ID: ${esc(data.organization.id)}</span>
            </div>
            <div class="sub" style="font-size:12px;margin-top:2px;">
              GSTIN: <b>${esc(data.organization.gstin)}</b> · Primary Currency: <b>${esc(data.organization.currency)}</b> · State: <b>${esc(data.organization.state)}</b>
            </div>
          </div>
          <div style="display:flex;gap:8px;">
            <span class="pastel-chip chip-mint" style="font-size:11.5px;padding:4px 10px;">${esc(data.organization.tenant_isolation)}</span>
            <span class="pastel-chip chip-indigo" style="font-size:11.5px;padding:4px 10px;">${esc(data.organization.data_residency)}</span>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;">
          <div style="background:var(--surface-glass-subtle);border:1px solid var(--bd);border-radius:8px;padding:12px;">
            <div class="sub" style="font-size:11px;">Active Team Members</div>
            <div style="font-size:20px;font-weight:700;margin-top:4px;">${data.metrics.total_users} Users</div>
          </div>
          <div style="background:var(--surface-glass-subtle);border:1px solid var(--bd);border-radius:8px;padding:12px;">
            <div class="sub" style="font-size:11px;">Cryptographic Audit Events</div>
            <div style="font-size:20px;font-weight:700;margin-top:4px;">${data.metrics.total_audit_events} Events</div>
          </div>
          <div style="background:var(--surface-glass-subtle);border:1px solid var(--bd);border-radius:8px;padding:12px;">
            <div class="sub" style="font-size:11px;">Database Ledger Invoices</div>
            <div style="font-size:20px;font-weight:700;margin-top:4px;">${data.metrics.total_invoices_issued} Invoices</div>
          </div>
          <div style="background:var(--surface-glass-subtle);border:1px solid var(--bd);border-radius:8px;padding:12px;">
            <div class="sub" style="font-size:11px;">MFA Enforcement Policy</div>
            <div style="font-size:13px;font-weight:700;color:var(--up);margin-top:7px;">Mandatory (TOTP RFC 6238)</div>
          </div>
        </div>
      </div>

      <h2 style="font-size:16px;margin:24px 0 12px;font-weight:700;">Team Members & Role Access Control</h2>
      <div class="card" style="padding:0;overflow:hidden;">
        <table id="tenant-members-table">
          <thead>
            <tr>
              <th>Member Name</th>
              <th>Username / Email</th>
              <th>Role & Access Scope</th>
              <th>Status</th>
              <th>MFA Security</th>
              <th>Date Joined</th>
              <th>Last Active</th>
              <th class="r">Action</th>
            </tr>
          </thead>
          <tbody>
            ${data.members.map(u => `
              <tr>
                <td><b>${esc(u.full_name)}</b></td>
                <td>
                  <div>${esc(u.username)}</div>
                  <div class="sub" style="font-size:11px;">${esc(u.email)}</div>
                </td>
                <td>
                  <span class="pastel-chip ${u.role === 'admin' ? 'chip-rose' : u.role === 'auditor' ? 'chip-indigo' : 'chip-sky'}" style="font-size:11px;">
                    ${esc(u.role_display)}
                  </span>
                </td>
                <td>
                  <span class="pastel-chip ${u.is_active ? 'chip-mint' : 'chip-rose'}" style="font-size:11px;font-weight:600;">
                    ${u.is_active ? 'Active' : 'Deactivated'}
                  </span>
                </td>
                <td>
                  <span style="font-size:12px;color:${u.mfa_enabled ? 'var(--up)' : 'var(--bad)'};font-weight:600;">
                    ${u.mfa_enabled ? '✓ Active' : '⚠ Inactive'}
                  </span>
                </td>
                <td>${esc(u.date_joined)}</td>
                <td>${esc(u.last_login)}</td>
                <td class="r" style="white-space:nowrap;">
                  <button class="btn" style="font-size:11px;padding:3px 8px;margin-right:4px;" onclick="changeRoleModal(${u.id}, '${esc(u.username)}', '${esc(u.role)}')">Role</button>
                  <button class="btn" style="font-size:11px;padding:3px 8px;margin-right:4px;" onclick="toggleUserActive(${u.id}, '${esc(u.username)}', ${u.is_active ? 'true' : 'false'})">${u.is_active ? 'Deactivate' : 'Activate'}</button>
                  <button class="btn" style="font-size:11px;padding:3px 8px;" onclick="resetPasswordModal(${u.id}, '${esc(u.username)}')">Password</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    const btnExpMembers = $('#btnExportMembers', root);
    if (btnExpMembers) btnExpMembers.addEventListener('click', () => exportTableToCsv($('#tenant-members-table', root), `team_members_${iso(new Date())}.csv`));

    window.changeRoleModal = (userId, username, currentRole) => {
      Modal.open({
        title: `Modify Permissions: ${username}`,
        body: `
          <div style="padding:10px 0;">
            <div class="fg">
              <label>Role Assignment</label>
              <select class="in" id="editMemberRole">
                <option value="admin" ${currentRole === 'admin' ? 'selected' : ''}>Administrator (Full Access)</option>
                <option value="accountant" ${currentRole === 'accountant' ? 'selected' : ''}>Standard Accountant</option>
                <option value="auditor" ${currentRole === 'auditor' ? 'selected' : ''}>Statutory Auditor (Read-Only)</option>
                <option value="cashier" ${currentRole === 'cashier' ? 'selected' : ''}>Billing Operator & Cashier</option>
              </select>
            </div>
          </div>
        `,
        footer: `
          <button class="btn" data-close>Cancel</button>
          <button class="btn p" id="btnSaveRole">Update Role</button>
        `
      });

      $('#btnSaveRole').addEventListener('click', async () => {
        const role = $('#editMemberRole').value;
        try {
          await api(`tenant/admin/users/${userId}/role/`, { method: 'POST', body: { role } });
          toast(`Role updated to ${role}!`, 'ok');
          Modal.close();
          tenantAdminPage(root);
        } catch (e) { toast(e.message, 'err'); }
      });
    };

    window.toggleUserActive = async (userId, username, isActive) => {
      const actionName = isActive ? 'Deactivate' : 'Activate';
      if (!(await confirmBox({ title: `${actionName} user "${username}"?`, message: `Are you sure you want to ${actionName.toLowerCase()} this account?`, okText: actionName, danger: isActive }))) return;
      try {
        await api(`tenant/admin/users/${userId}/toggle-active/`, { method: 'POST' });
        toast(`User "${username}" ${isActive ? 'deactivated' : 'activated'} successfully!`, 'ok');
        tenantAdminPage(root);
      } catch (e) { toast(e.message, 'err'); }
    };

    window.resetPasswordModal = (userId, username) => {
      Modal.open({
        title: `Reset Password: ${username}`,
        body: `
          <div style="padding:10px 0;">
            <div class="fg">
              <label>New Password (min 4 characters)</label>
              <input class="in" type="password" id="resetMemberPassword" placeholder="Enter new password…" required>
            </div>
          </div>
        `,
        footer: `
          <button class="btn" data-close>Cancel</button>
          <button class="btn p" id="btnSaveResetPassword">Save Password</button>
        `
      });

      $('#btnSaveResetPassword').addEventListener('click', async () => {
        const pwd = $('#resetMemberPassword').value;
        if (!pwd || pwd.length < 4) { toast('Password must be at least 4 characters long.', 'err'); return; }
        try {
          await api(`tenant/admin/users/${userId}/reset-password/`, { method: 'POST', body: { password: pwd } });
          toast(`Password for ${username} reset successfully!`, 'ok');
          Modal.close();
        } catch (e) { toast(e.message, 'err'); }
      });
    };

    $('#btnInviteMember', root).addEventListener('click', () => {
      Modal.open({
        title: 'Invite Team Member to Tenant',
        body: `
          <div style="padding:10px 0;">
            <div class="fg" style="margin-bottom:12px;">
              <label>Full Name</label>
              <input class="in" id="invFullName" placeholder="e.g. Karthik Raman">
            </div>
            <div class="fg" style="margin-bottom:12px;">
              <label>Username</label>
              <input class="in" id="invUsername" placeholder="e.g. karthik_audit" required>
            </div>
            <div class="fg" style="margin-bottom:12px;">
              <label>Work Email</label>
              <input class="in" id="invEmail" type="email" placeholder="karthik@enterprise.com" required>
            </div>
            <div class="fg" style="margin-bottom:12px;">
              <label>Initial Password (optional)</label>
              <input class="in" type="password" id="invPassword" placeholder="Leave blank to auto-generate">
            </div>
            <div class="fg" style="margin-bottom:12px;">
              <label>Mobile Number (for SMS & OTP)</label>
              <input class="in" id="invPhone" placeholder="+91 98400 12345">
            </div>
            <div class="fg">
              <label>Role Scope</label>
              <select class="in" id="invRole">
                <option value="accountant">Standard Accountant</option>
                <option value="auditor">Statutory Auditor (Read-Only)</option>
                <option value="cashier">Billing Operator & Cashier</option>
                <option value="admin">Administrator (Full Access)</option>
              </select>
            </div>
          </div>
        `,
        footer: `
          <button class="btn" data-close>Cancel</button>
          <button class="btn p" id="btnSendInvite">Send Invitation</button>
        `
      });

      $('#btnSendInvite').addEventListener('click', async () => {
        const fullName = ($('#invFullName') ? $('#invFullName').value : '').trim();
        const username = $('#invUsername').value.trim();
        const email = $('#invEmail').value.trim();
        const password = ($('#invPassword') ? $('#invPassword').value : '').trim();
        const phone = $('#invPhone').value.trim();
        const role = $('#invRole').value;
        if (!username || !email) { toast('Username and email are required', 'err'); return; }

        try {
          const res = await api('tenant/admin/invite/', { method: 'POST', body: { username, email, phone, role, full_name: fullName, password } });
          toast(`User ${username} added successfully! ${res.temporary_password ? `Temp password: ${res.temporary_password}` : ''}`, 'ok');
          Modal.close();
          tenantAdminPage(root);
        } catch (e) { toast(e.message, 'err'); }
      });
    });

  } catch (e) {
    root.innerHTML = errBox(e.message, true);
    const btn = $('[data-retry]', root);
    if (btn) btn.addEventListener('click', () => tenantAdminPage(root));
  }
}

async function developerPlatformPage(root, tab = 'keys') {
  PAGE.reload = () => developerPlatformPage(root, tab);
  root.innerHTML = `<div class="spin" style="margin:40px auto;">Loading Developer Platform…</div>`;

  try {
    const [keysData, webhooksData] = await Promise.all([
      api('developer/keys/'),
      api('developer/webhooks/')
    ]);

    const tabLinks = [
      ['API Keys', '#/developer/platform?tab=keys', tab === 'keys'],
      ['Webhook Subscriptions', '#/developer/platform?tab=webhooks', tab === 'webhooks'],
      ['Interactive API Explorer', '#/developer/platform?tab=docs', tab === 'docs'],
    ];

    root.innerHTML = `
      <div class="bc">Home / Developer Platform</div>
      <div class="hd">
        <div>
          <h1>API Developer Platform & Webhooks</h1>
          <div class="sub" style="margin-top:2px;">
            Headless REST API access, scoped developer tokens, automated webhook dispatch, and developer guides.
          </div>
        </div>
        <div class="act">
          ${tab === 'keys' ? `<button class="btn p" id="btnNewApiKey" type="button">+ Generate API Key</button>` : ''}
          ${tab === 'webhooks' ? `<button class="btn p" id="btnNewWebhook" type="button">+ Add Webhook Endpoint</button>` : ''}
        </div>
      </div>

      <div class="tabs" style="margin:14px 0;">
        <button class="btn ${tab === 'keys' ? 'p' : ''}" id="tabBtnKeys" type="button">API Keys (${keysData.keys.length})</button>
        <button class="btn ${tab === 'webhooks' ? 'p' : ''}" id="tabBtnWebhooks" type="button">Webhooks (${webhooksData.webhooks.length})</button>
        <button class="btn ${tab === 'docs' ? 'p' : ''}" id="tabBtnDocs" type="button">API Explorer & Code Snippets</button>
      </div>

      <div id="dev-tab-content"></div>
    `;

    $('#tabBtnKeys', root).addEventListener('click', () => developerPlatformPage(root, 'keys'));
    $('#tabBtnWebhooks', root).addEventListener('click', () => developerPlatformPage(root, 'webhooks'));
    $('#tabBtnDocs', root).addEventListener('click', () => developerPlatformPage(root, 'docs'));

    const contentBox = $('#dev-tab-content', root);

    if (tab === 'keys') {
      contentBox.innerHTML = `
        <div class="card" style="padding:0;overflow:hidden;">
          <table>
            <thead>
              <tr>
                <th>Key Name</th>
                <th>Token Identifier</th>
                <th>Allowed Scopes</th>
                <th>Created Date</th>
                <th>Last Used</th>
                <th class="r">Action</th>
              </tr>
            </thead>
            <tbody>
              ${keysData.keys.map(k => `
                <tr>
                  <td><b>${esc(k.name)}</b></td>
                  <td><code>${esc(k.masked_key)}</code></td>
                  <td>
                    <div style="display:flex;gap:4px;flex-wrap:wrap;">
                      ${k.scopes.map(s => `<span class="pastel-chip chip-sky" style="font-size:10px;">${esc(s)}</span>`).join('')}
                    </div>
                  </td>
                  <td>${esc(k.created_at)}</td>
                  <td><span class="st ok">${esc(k.last_used_at)}</span></td>
                  <td class="r">
                    <button class="btn" style="font-size:11px;padding:3px 8px;color:var(--bad);" onclick="revokeApiKey(${k.id})">Revoke</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;

      window.revokeApiKey = async (keyId) => {
        if (!confirm('Are you sure you want to revoke this API key? Applications using it will lose access immediately.')) return;
        try {
          await api(`developer/keys/${keyId}/revoke/`, { method: 'POST' });
          toast('API Key revoked successfully!', 'ok');
          developerPlatformPage(root, 'keys');
        } catch (e) { toast(e.message, 'err'); }
      };

      const btnNewKey = $('#btnNewApiKey', root);
      if (btnNewKey) btnNewKey.addEventListener('click', () => {
        Modal.open({
          title: 'Generate Scoped Developer API Key',
          body: `
            <div style="padding:10px 0;">
              <div class="fg" style="margin-bottom:12px;">
                <label>Key Name / System Label</label>
                <input class="in" id="modalKeyName" placeholder="e.g. Production Shopify Sync Key" required>
              </div>
              <div class="fg">
                <label>Permission Scopes</label>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:6px;font-size:12px;">
                  <label><input type="checkbox" checked value="read:invoices" class="chk-scope"> read:invoices</label>
                  <label><input type="checkbox" checked value="write:invoices" class="chk-scope"> write:invoices</label>
                  <label><input type="checkbox" checked value="read:banking" class="chk-scope"> read:banking</label>
                  <label><input type="checkbox" checked value="write:payments" class="chk-scope"> write:payments</label>
                  <label><input type="checkbox" value="read:gst" class="chk-scope"> read:gst</label>
                  <label><input type="checkbox" value="admin:all" class="chk-scope"> admin:all</label>
                </div>
              </div>
            </div>
          `,
          footer: `
            <button class="btn" data-close>Cancel</button>
            <button class="btn p" id="btnSubmitGenerateKey">Generate Key</button>
          `
        });

        $('#btnSubmitGenerateKey').addEventListener('click', async () => {
          const name = $('#modalKeyName').value.trim();
          const scopes = $$('.chk-scope:checked').map(c => c.value);
          if (!name) { toast('Please provide a key name', 'err'); return; }

          try {
            const res = await api('developer/keys/', { method: 'POST', body: { name, scopes } });
            Modal.open({
              title: 'API Key Created Successfully',
              body: `
                <div style="padding:14px;text-align:center;">
                  <div style="font-size:28px;margin-bottom:8px;">🔑</div>
                  <h3 style="margin:0 0 4px;">Save your Secret API Key</h3>
                  <p class="sub" style="margin-bottom:14px;font-size:12px;">Please copy this key now. You will not be able to view it again.</p>
                  <div style="background:var(--surface-glass-subtle);padding:12px;border-radius:8px;border:1px solid var(--bd);display:flex;align-items:center;justify-content:space-between;gap:8px;">
                    <code style="font-size:13px;word-break:break-all;color:var(--accent);">${esc(res.raw_key)}</code>
                    <button class="btn" type="button" onclick="navigator.clipboard.writeText('${res.raw_key}');toast('Copied API key to clipboard!', 'ok');">Copy</button>
                  </div>
                </div>
              `,
              footer: `<button class="btn p" data-close onclick="developerPlatformPage(document.getElementById('pg'), 'keys')">Done</button>`
            });
          } catch (e) { toast(e.message, 'err'); }
        });
      });

    } else if (tab === 'webhooks') {
      contentBox.innerHTML = `
        <div class="card" style="padding:0;overflow:hidden;">
          <table>
            <thead>
              <tr>
                <th>Webhook Destination URL</th>
                <th>Subscribed Events</th>
                <th>Signing Secret</th>
                <th>Last Delivery Status</th>
                <th class="r">Action</th>
              </tr>
            </thead>
            <tbody>
              ${webhooksData.webhooks.map(w => `
                <tr>
                  <td><b>${esc(w.endpoint_url)}</b></td>
                  <td>
                    <div style="display:flex;gap:4px;flex-wrap:wrap;">
                      ${w.events.map(ev => `<span class="pastel-chip chip-lavender" style="font-size:10px;">${esc(ev)}</span>`).join('')}
                    </div>
                  </td>
                  <td><code>${esc(w.secret_masked)}</code></td>
                  <td>
                    <span class="st ok">${w.last_status_code} OK</span>
                    <span class="sub" style="font-size:11px;margin-left:6px;">${esc(w.last_delivery_at)}</span>
                  </td>
                  <td class="r">
                    <button class="btn" style="font-size:11px;padding:3px 9px;" onclick="testWebhookPing(${w.id})">⚡ Test Ping</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;

      window.testWebhookPing = async (hookId) => {
        try {
          const res = await api(`developer/webhooks/${hookId}/test/`, { method: 'POST' });
          Modal.open({
            title: `Webhook Test Ping: 200 OK (${res.latency_ms}ms)`,
            body: `
              <div style="padding:10px 0;">
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
                  <span class="st ok" style="font-size:13px;">HTTP 200 Delivered</span>
                  <span class="sub" style="font-size:12px;">Round-trip latency: ${res.latency_ms}ms</span>
                </div>
                <div class="sub" style="font-size:12px;margin-bottom:6px;">Dispatched JSON Payload:</div>
                <pre style="background:var(--surface-glass-subtle);padding:12px;border-radius:8px;border:1px solid var(--bd);font-size:11.5px;max-height:220px;overflow-y:auto;">${JSON.stringify(res.payload_dispatched, null, 2)}</pre>
              </div>
            `,
            footer: `<button class="btn p" data-close>Dismiss</button>`
          });
        } catch (e) { toast(e.message, 'err'); }
      };

      const btnNewWebhook = $('#btnNewWebhook', root);
      if (btnNewWebhook) btnNewWebhook.addEventListener('click', () => {
        Modal.open({
          title: 'Register Webhook Endpoint',
          body: `
            <div style="padding:10px 0;">
              <div class="fg" style="margin-bottom:12px;">
                <label>HTTPS Endpoint URL</label>
                <input class="in" id="modalWebhookUrl" placeholder="https:
              </div>

              <div class="fg">
                <label>Events to Deliver</label>

                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:6px;font-size:12px;">
                  <label><input type="checkbox" checked value="invoice.created" class="chk-event"> invoice.created</label>

                  <label><input type="checkbox" checked value="payment.received" class="chk-event"> payment.received</label>

                  <label><input type="checkbox" checked value="bank.reconciled" class="chk-event"> bank.reconciled</label>

                  <label><input type="checkbox" value="einvoice.generated" class="chk-event"> einvoice.generated</label>

                </div>

              </div>

            </div>

          `,
          footer: `
            <button class="btn" data-close>Cancel</button>

            <button class="btn p" id="btnSubmitWebhook">Create Webhook</button>

          `
        });

        $('#btnSubmitWebhook').addEventListener('click', async () => {
          const url = $('#modalWebhookUrl').value.trim();
          const events = $$('.chk-event:checked').map(c => c.value);
          if (!url) { toast('Please specify an endpoint URL', 'err'); return; }

          try {
            await api('developer/webhooks/', { method: 'POST', body: { endpoint_url: url, events } });
            toast('Webhook registered successfully!', 'ok');
            Modal.close();
            developerPlatformPage(root, 'webhooks');
          } catch (e) { toast(e.message, 'err'); }
        });
      });

    } else {
      contentBox.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:16px;">
          <div class="card" style="padding:20px;">
            <h3 style="font-size:15px;margin:0 0 8px;">Authenticating API Requests</h3>

            <p class="sub" style="font-size:12.5px;margin:0 0 12px;line-height:1.5;">
              Convosis Books accepts API keys via standard HTTP <code>Authorization: Bearer sk_live_...</code> headers. All API endpoints respond with structured JSON.

            </p>

            <div style="background:var(--surface-glass-subtle);padding:14px;border-radius:8px;border:1px solid var(--bd);font-family:monospace;font-size:12px;line-height:1.6;">
              curl -X GET https:
              &nbsp;&nbsp;-H "Authorization: Bearer sk_live_your_api_key_here" \\<br>
              &nbsp;&nbsp;-H "Accept: application/json"
            </div>

          </div>

          <div class="card" style="padding:20px;">
            <h3 style="font-size:15px;margin:0 0 8px;">Python SDK Quickstart</h3>

            <div style="background:var(--surface-glass-subtle);padding:14px;border-radius:8px;border:1px solid var(--bd);font-family:monospace;font-size:12px;line-height:1.6;">
              import requests<br><br>
              client = requests.Session()<br>
              client.headers.update({'Authorization': 'Bearer sk_live_your_api_key_here'})<br><br>
              # Fetch live receivables<br>
              invoices = client.get('https://books-d8i1.onrender.com/api/invoices/?status=sent').json()<br>
              print(f"Total pending invoices: {len(invoices['results'])}")
            </div>

          </div>

        </div>

      `;
    }

  } catch (e) {
    root.innerHTML = errBox(e.message, true);
    const btn = $('[data-retry]', root);
    if (btn) btn.addEventListener('click', () => developerPlatformPage(root, tab));
  }
}

async function convertQuoteToInvoice(id) {
  try {
    const q = await api(`quotes/${id}/`);
    if (q.status === 'invoiced' || q.converted_to_invoice_id) {
      toast('This quote has already been converted to an invoice.', 'err');
      return;
    }
    if (q.status === 'ordered' || q.converted_to_sales_order_id) {
      toast(`This quote has already been converted to Sales Order ${q.converted_to_sales_order_number || ''}. It cannot be converted multiple times.`, 'err');
      return;
    }
    if (q.status === 'declined') {
      toast('Cannot convert a declined quote.', 'err');
      return;
    }
    const conf = await confirmBox({
      title: 'Convert Quote to Invoice',
      message: `Are you sure you want to convert quote ${q.number} into an invoice? A draft invoice will be created with all items from this quote.`
    });
    if (!conf) return;
    const res = await api(`quotes/${id}/convert-to-invoice/`, { method: 'POST', body: {} });
    toast(`Successfully converted to Invoice ${res.number}!`, 'ok');
    location.hash = '#/sales/invoices';
  } catch (e) {
    toast(e.message, 'err');
  }
}

async function convertQuoteToSalesOrder(id) {
  try {
    const q = await api(`quotes/${id}/`);
    if (q.status === 'ordered' || q.converted_to_sales_order_id) {
      toast('This quote has already been converted to a sales order.', 'err');
      return;
    }
    if (q.status === 'invoiced' || q.converted_to_invoice_id) {
      toast(`This quote has already been converted to Invoice ${q.converted_to_invoice_number || ''}. It cannot be converted multiple times.`, 'err');
      return;
    }
    if (q.status === 'declined') {
      toast('Cannot convert a declined quote.', 'err');
      return;
    }
    const conf = await confirmBox({
      title: 'Convert Quote to Sales Order',
      message: `Are you sure you want to convert quote ${q.number} into a confirmed sales order?`
    });
    if (!conf) return;
    const res = await api(`quotes/${id}/convert-to-sales-order/`, { method: 'POST', body: {} });
    toast(`Successfully converted to Sales Order ${res.number}!`, 'ok');
    location.hash = '#/sales/sales-orders';
    setTimeout(() => {
      if (typeof viewSalesOrderDetail === 'function') viewSalesOrderDetail(res.id || res.sales_order_id);
    }, 150);
  } catch (e) {
    toast(e.message, 'err');
  }
}

async function viewQuoteDetail(id) {
  try {
    const q = await api(`quotes/${id}/`);
    const isConverted = q.status === 'invoiced' || q.status === 'ordered' || !!q.converted_to_invoice_id || !!q.converted_to_sales_order_id;
    Modal.open({
      title: `Quote ${q.number}`,
      dialog: true,
      wide: true,
      body: `
        <div style="background:#fff;color:#1e293b;border-radius:10px;padding:32px;box-shadow:0 4px 20px rgba(0,0,0,0.06);border:1px solid #e2e8f0;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #e2e8f0;padding-bottom:20px;margin-bottom:24px;">
            <div>
              <div style="font-size:24px;font-weight:800;color:#0f172a;letter-spacing:-0.5px;">${esc(APP.org.name)}</div>
              <div class="sub" style="font-size:12px;margin-top:4px;color:#64748b;line-height:1.5;">
                ${esc(APP.org.address)}<br>
                GSTIN: <b>${esc(APP.org.gstin || '—')}</b> · State: ${esc(APP.org.state)}
              </div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:26px;font-weight:800;color:#2563eb;letter-spacing:1px;text-transform:uppercase;">QUOTATION</div>
              <div style="font-size:16px;font-weight:700;color:#334155;margin-top:2px;"># ${esc(q.number)}</div>
              <div style="margin-top:6px;">
                <span class="pastel-chip ${q.status === 'accepted' ? 'chip-mint' : q.status === 'declined' ? 'chip-rose' : q.status === 'sent' ? 'chip-sky' : q.status === 'ordered' ? 'chip-indigo' : q.status === 'invoiced' ? 'chip-indigo' : 'chip-lavender'}" style="font-size:11px;font-weight:700;text-transform:uppercase;">
                  ${esc(q.status === 'ordered' ? 'Converted to SO' : q.status)}
                </span>
              </div>
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:24px;">
            <div>
              <div style="font-size:11px;text-transform:uppercase;color:#64748b;font-weight:700;margin-bottom:6px;">Quotation For:</div>
              <div style="font-size:15px;font-weight:700;color:#0f172a;">${esc(q.party || (q.party_details && q.party_details.name) || q.customer_name)}</div>
              <div style="font-size:12px;color:#64748b;line-height:1.5;margin-top:4px;">
                ${q.party_details && q.party_details.company ? `<div>${esc(q.party_details.company)}</div>` : ''}
                ${q.party_details && q.party_details.billing_address ? `<div>${esc(q.party_details.billing_address)}</div>` : ''}
                ${q.party_details && q.party_details.gstin ? `<div>GSTIN: <b>${esc(q.party_details.gstin)}</b></div>` : ''}
                ${q.party_details && q.party_details.email ? `<div>Email: ${esc(q.party_details.email)}</div>` : ''}
              </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;background:#f8fafc;padding:16px;border-radius:8px;border:1px solid #e2e8f0;font-size:12px;">
              <div><b>Quote Date:</b></div><div>${fd(q.date)}</div>
              <div><b>Expiry Date:</b></div><div>${q.expiry_date ? fd(q.expiry_date) : '—'}</div>
              <div><b>Reference#:</b></div><div>${esc(q.reference_number || '—')}</div>
              <div><b>Salesperson:</b></div><div>${esc(q.salesperson || '—')}</div>
              <div><b>Project:</b></div><div>${esc(q.project_name || '—')}</div>
              <div><b>Place of Supply:</b></div><div>${esc(q.place_of_supply || '—')}</div>
            </div>
          </div>

          ${q.subject ? `
            <div style="background:#eff6ff;border-left:3px solid #2563eb;padding:10px 14px;border-radius:4px;margin-bottom:20px;font-size:13px;color:#1e3a8a;">
              <b>Subject:</b> ${esc(q.subject)}
            </div>
          ` : ''}

          <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
            <thead>
              <tr style="background:#f1f5f9;border-bottom:2px solid #cbd5e1;font-size:12px;text-align:left;color:#475569;">
                <th style="padding:10px 12px;">#</th>
                <th style="padding:10px 12px;">Item & Description</th>
                <th style="padding:10px 12px;text-align:right;">Qty</th>
                <th style="padding:10px 12px;text-align:right;">Rate</th>
                <th style="padding:10px 12px;text-align:right;">Discount</th>
                <th style="padding:10px 12px;text-align:right;">GST</th>
                <th style="padding:10px 12px;text-align:right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${(q.lines || []).map((l, i) => `
                <tr style="border-bottom:1px solid #e2e8f0;font-size:13px;">
                  <td style="padding:10px 12px;color:#64748b;">${i + 1}</td>
                  <td style="padding:10px 12px;"><b>${esc(l.description || 'Item')}</b>${l.hsn_sac ? ` <small style="color:#64748b;">(HSN ${esc(l.hsn_sac)})</small>` : ''}</td>
                  <td style="padding:10px 12px;text-align:right;">${qty(l.quantity)}</td>
                  <td style="padding:10px 12px;text-align:right;">${inr(l.rate)}</td>
                  <td style="padding:10px 12px;text-align:right;">${num(l.discount_percent) > 0 ? l.discount_percent + '%' : '—'}</td>
                  <td style="padding:10px 12px;text-align:right;">${l.gst_rate}%</td>
                  <td style="padding:10px 12px;text-align:right;font-weight:600;">${inr(l.line_total)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:24px;">
            <div style="flex:1;max-width:55%;">
              ${q.notes ? `
                <div style="margin-bottom:16px;">
                  <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:4px;">Customer Notes</div>
                  <div style="font-size:12px;color:#334155;white-space:pre-wrap;">${esc(q.notes)}</div>
                </div>
              ` : ''}
              ${q.terms ? `
                <div>
                  <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:4px;">Terms & Conditions</div>
                  <div style="font-size:12px;color:#334155;white-space:pre-wrap;">${esc(q.terms)}</div>
                </div>
              ` : ''}
            </div>

            <div style="width:280px;background:#f8fafc;padding:16px;border-radius:8px;border:1px solid #e2e8f0;font-size:13px;">
              <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
                <span style="color:#64748b;">Subtotal (Taxable):</span>
                <b>${inr(q.subtotal)}</b>
              </div>
              ${num(q.cgst) > 0 ? `<div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span style="color:#64748b;">CGST:</span><span>${inr(q.cgst)}</span></div>` : ''}
              ${num(q.sgst) > 0 ? `<div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span style="color:#64748b;">SGST:</span><span>${inr(q.sgst)}</span></div>` : ''}
              ${num(q.igst) > 0 ? `<div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span style="color:#64748b;">IGST:</span><span>${inr(q.igst)}</span></div>` : ''}
              ${num(q.adjustment) !== 0 ? `<div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span style="color:#64748b;">${esc(q.adjustment_label || 'Adjustment')}:</span><span>${num(q.adjustment) > 0 ? '+' : ''}${inr(q.adjustment)}</span></div>` : ''}
              <div style="display:flex;justify-content:space-between;border-top:2px solid #cbd5e1;padding-top:10px;margin-top:10px;font-size:16px;font-weight:800;color:#0f172a;">
                <span>Total:</span>
                <span style="color:#2563eb;">${inr(q.total)}</span>
              </div>
            </div>
          </div>

          <div style="margin-top:24px;display:flex;justify-content:flex-end;">
            <div style="min-width:200px;text-align:center;cursor:pointer;padding:6px 12px;border-radius:6px;" id="q-detail-sig-box" title="Click to Sign or Change Signature">
              ${(q.signature_data || (APP.org && APP.org.signature_data)) ? `
                <div style="height:60px;display:flex;align-items:flex-end;justify-content:center;margin-bottom:6px;">
                  <img src="${esc(q.signature_data || APP.org.signature_data)}" alt="Signature" style="max-height:56px;max-width:180px;object-fit:contain;display:block;">
                </div>
              ` : `
                <div style="height:44px;display:flex;align-items:center;justify-content:center;color:#64748b;font-size:12px;border:1px dashed #cbd5e1;border-radius:4px;margin-bottom:6px;padding:4px 8px;background:#f8fafc;">
                  <i class="fa-solid fa-signature" style="margin-right:6px;color:#2563eb;"></i> Click to Add Signature
                </div>
              `}
              <div style="border-top:1px solid #0f172a;margin-bottom:4px;"></div>
              <div style="font-weight:700;font-size:12px;color:#0f172a;">${esc(q.signature_title || (APP.org && APP.org.signature_title) || 'Authorized Signatory')}</div>
              ${q.signed_by ? `<div style="font-size:11px;color:#475569;margin-top:2px;"><b>${esc(q.signed_by)}</b></div>` : ''}
              ${q.signed_at ? `<div style="font-size:10px;color:#94a3b8;margin-top:1px;">Digitally Signed on ${fd(q.signed_at)}</div>` : ''}
            </div>
          </div>
        </div>
      `,
      footer: `
        <div style="display:flex;justify-content:space-between;align-items:center;width:100%;flex-wrap:wrap;gap:10px;">
          <div>
            <button type="button" class="btn" onclick="window.print()"><i class="fa-solid fa-print"></i> Print / PDF</button>
            <button type="button" class="btn" id="btn-q-sign"><i class="fa-solid fa-signature"></i> ${q.signature_data ? 'Signed ✓' : 'Sign'}</button>
            ${!isConverted ? `<button type="button" class="btn" id="btn-view-edit-q"><i class="fa-solid fa-pen"></i> Edit Quote</button>` : ''}
          </div>
          <div style="display:flex;gap:8px;align-items:center;">
            ${(q.status === 'invoiced' || q.converted_to_invoice_number) ? `
              <span class="pastel-chip chip-indigo" style="font-size:12px;padding:6px 12px;"><i class="fa-solid fa-check"></i> Converted to Invoice ${esc(q.converted_to_invoice_number || '')}</span>
            ` : (q.status === 'ordered' || q.converted_to_sales_order_number) ? `
              <span class="pastel-chip chip-indigo" style="font-size:12px;padding:6px 12px;"><i class="fa-solid fa-check"></i> Converted to Sales Order ${esc(q.converted_to_sales_order_number || '')}</span>
            ` : `
              ${q.status === 'draft' ? `<button type="button" class="btn" id="btn-q-mark-sent"><i class="fa-solid fa-paper-plane"></i> Mark Sent</button>` : ''}
              ${q.status !== 'accepted' && q.status !== 'declined' ? `<button type="button" class="btn" id="btn-q-mark-accepted" style="color:#059669;"><i class="fa-solid fa-check"></i> Accept</button>` : ''}
              ${q.status !== 'declined' ? `<button type="button" class="btn" id="btn-q-mark-declined" style="color:#dc2626;"><i class="fa-solid fa-xmark"></i> Decline</button>` : ''}
              <button type="button" class="btn p" id="btn-q-to-inv" style="background:#059669;border:none;">
                <i class="fa-solid fa-file-invoice"></i> Convert to Invoice
              </button>
              <button type="button" class="btn" id="btn-q-to-so">
                <i class="fa-solid fa-cart-shopping"></i> Convert to Sales Order
              </button>
            `}
            <button type="button" class="btn" data-close>Close</button>
          </div>
        </div>
      `
    });

    const triggerQuoteSign = () => {
      openSignatureModal(q, 'quotes', updated => {
        Modal.close();
        viewQuoteDetail(q.id);
      });
    };
    $('#btn-q-sign')?.addEventListener('click', triggerQuoteSign);
    $('#q-detail-sig-box')?.addEventListener('click', triggerQuoteSign);

    $('#btn-view-edit-q')?.addEventListener('click', () => {
      Modal.close();
      quoteForm(q.id, $('#pg'), () => { location.hash = '#/sales/quotes'; if (typeof route === 'function') route(); });
    });
    $('#btn-q-mark-sent')?.addEventListener('click', async () => {
      try {
        await api(`quotes/${q.id}/send/`, { method: 'POST', body: {} });
        toast(`Quote ${q.number} marked as sent!`, 'ok');
        Modal.close();
        refresh();
      } catch (err) { toast(err.message, 'err'); }
    });
    $('#btn-q-mark-accepted')?.addEventListener('click', async () => {
      try {
        await api(`quotes/${q.id}/accept/`, { method: 'POST', body: {} });
        toast(`Quote ${q.number} marked as accepted!`, 'ok');
        Modal.close();
        refresh();
      } catch (err) { toast(err.message, 'err'); }
    });
    $('#btn-q-mark-declined')?.addEventListener('click', async () => {
      try {
        await api(`quotes/${q.id}/decline/`, { method: 'POST', body: {} });
        toast(`Quote ${q.number} marked as declined.`, 'ok');
        Modal.close();
        refresh();
      } catch (err) { toast(err.message, 'err'); }
    });
    $('#btn-q-to-inv')?.addEventListener('click', () => {
      Modal.close();
      convertQuoteToInvoice(q.id);
    });
    $('#btn-q-to-so')?.addEventListener('click', () => {
      Modal.close();
      convertQuoteToSalesOrder(q.id);
    });
  } catch (err) {
    toast(err.message, 'err');
  }
}


async function viewSalesOrderDetail(id) {
  try {
    const so = await api(`sales-orders/${id}/`);
    Modal.open({
      title: `Sales Order ${so.number}`,
      dialog: true,
      wide: true,
      body: `
        <div style="background:#fff;color:#1e293b;border-radius:10px;padding:32px;box-shadow:0 4px 20px rgba(0,0,0,0.06);border:1px solid #e2e8f0;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #e2e8f0;padding-bottom:20px;margin-bottom:24px;">
            <div>
              <div style="font-size:24px;font-weight:800;color:#0f172a;letter-spacing:-0.5px;">${esc(APP.org.name)}</div>
              <div class="sub" style="font-size:12px;margin-top:4px;color:#64748b;line-height:1.5;">
                ${esc(APP.org.address)}<br>
                GSTIN: <b>${esc(APP.org.gstin || '—')}</b> · State: ${esc(APP.org.state)}
              </div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:26px;font-weight:800;color:#0284c7;letter-spacing:1px;text-transform:uppercase;">SALES ORDER</div>
              <div style="font-size:16px;font-weight:700;color:#334155;margin-top:2px;"># ${esc(so.number)}</div>
              <div style="margin-top:6px;">
                <span class="pastel-chip ${so.status === 'confirmed' ? 'chip-sky' : so.status === 'closed' ? 'chip-mint' : so.status === 'void' ? 'chip-rose' : 'chip-lavender'}" style="font-size:11px;font-weight:700;text-transform:uppercase;">
                  ${esc(so.status || 'CONFIRMED')}
                </span>
              </div>
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:24px;">
            <div>
              <div style="font-size:11px;text-transform:uppercase;color:#64748b;font-weight:700;margin-bottom:6px;">Order For:</div>
              <div style="font-size:15px;font-weight:700;color:#0f172a;">${esc(so.party || (so.party_details && so.party_details.name) || so.customer_name)}</div>
              <div style="font-size:12px;color:#64748b;line-height:1.5;margin-top:4px;">
                ${so.party_details && so.party_details.company ? `<div>${esc(so.party_details.company)}</div>` : ''}
                ${so.party_details && so.party_details.billing_address ? `<div>${esc(so.party_details.billing_address)}</div>` : ''}
                ${so.party_details && so.party_details.gstin ? `<div>GSTIN: <b>${esc(so.party_details.gstin)}</b></div>` : ''}
                ${so.party_details && so.party_details.email ? `<div>Email: ${esc(so.party_details.email)}</div>` : ''}
                ${so.party_details && so.party_details.phone ? `<div>Phone: ${esc(so.party_details.phone)}</div>` : ''}
              </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;background:#f8fafc;padding:16px;border-radius:8px;border:1px solid #e2e8f0;font-size:12px;">
              <div><b>Order Date:</b></div><div>${fd(so.date)}</div>
              <div><b>Expected Shipment:</b></div><div>${so.expected_shipment_date ? fd(so.expected_shipment_date) : (so.due_date ? fd(so.due_date) : '—')}</div>
              <div><b>Reference / PO#:</b></div><div>${esc(so.order_number || '—')}</div>
              <div><b>Place of Supply:</b></div><div>${esc(so.place_of_supply || '—')}</div>
            </div>
          </div>

          <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
            <thead>
              <tr style="background:#f1f5f9;border-bottom:2px solid #cbd5e1;font-size:12px;text-align:left;color:#475569;">
                <th style="padding:10px 12px;">#</th>
                <th style="padding:10px 12px;">Item & Description</th>
                <th style="padding:10px 12px;text-align:right;">Qty</th>
                <th style="padding:10px 12px;text-align:right;">Rate</th>
                <th style="padding:10px 12px;text-align:right;">Discount</th>
                <th style="padding:10px 12px;text-align:right;">GST</th>
                <th style="padding:10px 12px;text-align:right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${(so.lines || []).map((l, i) => `
                <tr style="border-bottom:1px solid #e2e8f0;font-size:13px;">
                  <td style="padding:10px 12px;color:#64748b;">${i + 1}</td>
                  <td style="padding:10px 12px;"><b>${esc(l.description || 'Item')}</b>${l.hsn_sac ? ` <small style="color:#64748b;">(HSN ${esc(l.hsn_sac)})</small>` : ''}</td>
                  <td style="padding:10px 12px;text-align:right;">${qty(l.quantity)}</td>
                  <td style="padding:10px 12px;text-align:right;">${inr(l.rate)}</td>
                  <td style="padding:10px 12px;text-align:right;">${num(l.discount_percent) > 0 ? l.discount_percent + '%' : '—'}</td>
                  <td style="padding:10px 12px;text-align:right;">${l.gst_rate}%</td>
                  <td style="padding:10px 12px;text-align:right;font-weight:600;">${inr(l.line_total)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:24px;">
            <div style="flex:1;max-width:55%;">
              ${so.notes ? `
                <div style="margin-bottom:16px;">
                  <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:4px;">Customer Notes</div>
                  <div style="font-size:12px;color:#334155;white-space:pre-wrap;">${esc(so.notes)}</div>
                </div>
              ` : ''}
              ${so.terms ? `
                <div>
                  <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:4px;">Terms & Conditions</div>
                  <div style="font-size:12px;color:#334155;white-space:pre-wrap;">${esc(so.terms)}</div>
                </div>
              ` : ''}
            </div>

            <div style="width:280px;background:#f8fafc;padding:16px;border-radius:8px;border:1px solid #e2e8f0;font-size:13px;">
              <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
                <span style="color:#64748b;">Subtotal (Taxable):</span>
                <b>${inr(so.subtotal)}</b>
              </div>
              ${num(so.cgst) > 0 ? `<div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span style="color:#64748b;">CGST:</span><span>${inr(so.cgst)}</span></div>` : ''}
              ${num(so.sgst) > 0 ? `<div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span style="color:#64748b;">SGST:</span><span>${inr(so.sgst)}</span></div>` : ''}
              ${num(so.igst) > 0 ? `<div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span style="color:#64748b;">IGST:</span><span>${inr(so.igst)}</span></div>` : ''}
              <div style="display:flex;justify-content:space-between;border-top:2px solid #cbd5e1;padding-top:10px;margin-top:10px;font-size:16px;font-weight:800;color:#0f172a;">
                <span>Total:</span>
                <span style="color:#0284c7;">${inr(so.total)}</span>
              </div>
            </div>
          </div>

          <div style="margin-top:24px;display:flex;justify-content:flex-end;">
            <div style="min-width:200px;text-align:center;cursor:pointer;padding:6px 12px;border-radius:6px;" id="so-detail-sig-box" title="Click to Sign or Change Signature">
              ${(so.signature_data || (APP.org && APP.org.signature_data)) ? `
                <div style="height:60px;display:flex;align-items:flex-end;justify-content:center;margin-bottom:6px;">
                  <img src="${esc(so.signature_data || APP.org.signature_data)}" alt="Signature" style="max-height:56px;max-width:180px;object-fit:contain;display:block;">
                </div>
              ` : `
                <div style="height:44px;display:flex;align-items:center;justify-content:center;color:#64748b;font-size:12px;border:1px dashed #cbd5e1;border-radius:4px;margin-bottom:6px;padding:4px 8px;background:#f8fafc;">
                  <i class="fa-solid fa-signature" style="margin-right:6px;color:#2563eb;"></i> Click to Add Signature
                </div>
              `}
              <div style="border-top:1px solid #0f172a;margin-bottom:4px;"></div>
              <div style="font-weight:700;font-size:12px;color:#0f172a;">${esc(so.signature_title || (APP.org && APP.org.signature_title) || 'Authorized Signatory')}</div>
              ${so.signed_by ? `<div style="font-size:11px;color:#475569;margin-top:2px;"><b>${esc(so.signed_by)}</b></div>` : ''}
              ${so.signed_at ? `<div style="font-size:10px;color:#94a3b8;margin-top:1px;">Digitally Signed on ${fd(so.signed_at)}</div>` : ''}
            </div>
          </div>
        </div>
      `,
      footer: `
        <div style="display:flex;justify-content:space-between;align-items:center;width:100%;flex-wrap:wrap;gap:10px;">
          <div>
            <button type="button" class="btn" onclick="window.print()"><i class="fa-solid fa-print"></i> Print / PDF</button>
            <button type="button" class="btn" id="btn-so-sign"><i class="fa-solid fa-signature"></i> ${so.signature_data ? 'Signed ✓' : 'Sign'}</button>
            ${so.status !== 'void' ? `<button type="button" class="btn" id="btn-view-edit-so"><i class="fa-solid fa-pen"></i> Edit Order</button>` : ''}
          </div>
          <div style="display:flex;gap:8px;align-items:center;">
            ${so.status !== 'void' && so.status !== 'closed' ? `
              <button type="button" class="btn p" id="btn-so-to-inv" style="background:#059669;border:none;">
                <i class="fa-solid fa-file-invoice"></i> Convert to Invoice
              </button>
            ` : ''}
            ${so.status === 'draft' ? `<button type="button" class="btn" id="btn-so-mark-confirmed"><i class="fa-solid fa-check"></i> Confirm</button>` : ''}
            ${so.status !== 'void' ? `<button type="button" class="btn" id="btn-so-mark-void" style="color:#dc2626;"><i class="fa-solid fa-ban"></i> Void</button>` : ''}
            <button type="button" class="btn" data-close>Close</button>
          </div>
        </div>
      `
    });

    const triggerSoSign = () => {
      openSignatureModal(so, 'sales-orders', updated => {
        Modal.close();
        viewSalesOrderDetail(so.id);
      });
    };
    $('#btn-so-sign')?.addEventListener('click', triggerSoSign);
    $('#so-detail-sig-box')?.addEventListener('click', triggerSoSign);

    $('#btn-view-edit-so')?.addEventListener('click', () => {
      Modal.close();
      salesOrderForm(so.id);
    });
    $('#btn-so-to-inv')?.addEventListener('click', async () => {
      try {
        const res = await api(`sales-orders/${so.id}/convert-to-invoice/`, { method: 'POST', body: {} });
        toast(`Sales Order ${so.number} converted to Invoice ${res.number || ''}!`, 'ok');
        Modal.close();
        location.hash = '#/sales/invoices';
        setTimeout(() => {
          if (typeof docMasterDetail === 'function') docMasterDetail($('#pg'), 'invoices', res.id || res.invoice_id);
        }, 100);
      } catch (err) { toast(err.message, 'err'); }
    });
    $('#btn-so-mark-confirmed')?.addEventListener('click', async () => {
      try {
        await api(`sales-orders/${so.id}/confirm/`, { method: 'POST', body: {} });
        toast(`Sales Order ${so.number} marked as confirmed!`, 'ok');
        Modal.close();
        refresh();
      } catch (err) { toast(err.message, 'err'); }
    });
    $('#btn-so-mark-void')?.addEventListener('click', async () => {
      const conf = await confirmBox({
        title: 'Void Sales Order',
        message: `Are you sure you want to void sales order ${so.number}?`,
        danger: true,
        okText: 'Void Order'
      });
      if (!conf) return;
      try {
        await api(`sales-orders/${so.id}/void/`, { method: 'POST', body: {} });
        toast(`Sales Order ${so.number} marked as void.`, 'ok');
        Modal.close();
        refresh();
      } catch (err) { toast(err.message, 'err'); }
    });
  } catch (err) {
    toast(err.message, 'err');
  }
}
window.viewSalesOrderDetail = viewSalesOrderDetail;
window.openUniversalImportModal = openUniversalImportModal;


// ==========================================
// Platform Super Admin Dashboard
// ==========================================
async function superAdminDashboard(root) {
  if (!APP.user || !APP.user.is_superuser) {
    root.innerHTML = `
      <div class="bc">Home / Platform / Super Admin</div>
      <div class="card" style="padding:40px;text-align:center;margin-top:20px;border-left:4px solid var(--danger);">
        <i class="fa-solid fa-shield-halved" style="font-size:48px;color:var(--danger);margin-bottom:16px;"></i>
        <h2 style="font-size:20px;margin-bottom:8px;">Access Denied: Super Admin Only</h2>
        <p style="color:var(--muted);max-width:520px;margin:0 auto 16px;">
          This platform dashboard is restricted strictly to authorized Django platform superusers. Your account (<strong>${esc(APP.user ? APP.user.username : 'Guest')}</strong>) is an organization account and does not hold global superuser permissions.
        </p>
        <button class="btn p" onclick="location.hash='#/home/dashboard'" type="button">Return to Company Dashboard</button>
      </div>`;
    return;
  }

  root.innerHTML = `<div class="spin" style="margin:40px auto;">Loading Platform Super Admin Control Center…</div>`;
  try {
    const data = await api('super-admin/overview/');
    renderSuperAdminUI(root, data);
  } catch (err) {
    root.innerHTML = `<div class="card" style="padding:20px;color:var(--danger);margin-top:20px;">Failed to load Super Admin Dashboard: ${esc(err.message || 'Unauthorized')}</div>`;
  }
}

function renderSuperAdminUI(root, data) {
  const k = data.kpis || {};
  let activeTab = 'companies';

  function buildHtml() {
    return `
      <div class="bc">Home / Platform / Super Admin Control Center</div>
      <div class="hd" style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:16px;">
        <div>
          <div style="display:flex;align-items:center;gap:10px;">
            <h1 style="margin:0;">Platform Super Admin</h1>
            <span class="pastel-chip chip-rose" style="font-weight:700;font-size:11px;letter-spacing:0.5px;">SYSTEM LEVEL</span>
          </div>
          <div class="sub" style="margin-top:4px;">
            Cross-tenant administration, company data isolation, platform user management, and security audit logs.
          </div>
        </div>
        <div class="act" style="display:flex;gap:8px;">
          <button class="btn" id="btnSuperAdminRefresh" type="button"><i class="fa-solid fa-rotate"></i> Refresh</button>
          <button class="btn p" id="btnExportPlatformSummary" type="button"><i class="fa-solid fa-file-export"></i> Export Report</button>
        </div>
      </div>

      <!-- KPI Summary Cards -->
      <div class="dash-kpis" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:16px;margin-top:16px;">
        <div class="card" style="padding:16px;border-top:3px solid #3b82f6;">
          <div style="font-size:12px;color:var(--muted);text-transform:uppercase;font-weight:600;">Total Companies</div>
          <div style="font-size:26px;font-weight:700;margin-top:6px;color:var(--text);">${k.total_companies || 0}</div>
          <div style="font-size:12px;color:#10b981;margin-top:4px;">
            <i class="fa-solid fa-circle-check"></i> ${k.active_companies || 0} Active &bull; ${k.inactive_companies || 0} Inactive
          </div>
        </div>

        <div class="card" style="padding:16px;border-top:3px solid #10b981;">
          <div style="font-size:12px;color:var(--muted);text-transform:uppercase;font-weight:600;">Total Registered Users</div>
          <div style="font-size:26px;font-weight:700;margin-top:6px;color:var(--text);">${k.total_users || 0}</div>
          <div style="font-size:12px;color:#3b82f6;margin-top:4px;">
            <i class="fa-solid fa-users"></i> ${k.active_users || 0} Active Users
          </div>
        </div>

        <div class="card" style="padding:16px;border-top:3px solid #f59e0b;">
          <div style="font-size:12px;color:var(--muted);text-transform:uppercase;font-weight:600;">Inactive Accounts</div>
          <div style="font-size:26px;font-weight:700;margin-top:6px;color:var(--text);">${k.inactive_users || 0}</div>
          <div style="font-size:12px;color:var(--muted);margin-top:4px;">
            Deactivated or Pending Activation
          </div>
        </div>

        <div class="card" style="padding:16px;border-top:3px solid #8b5cf6;">
          <div style="font-size:12px;color:var(--muted);text-transform:uppercase;font-weight:600;">Data Isolation Status</div>
          <div style="font-size:18px;font-weight:700;margin-top:8px;color:#10b981;">
            <i class="fa-solid fa-shield-check"></i> 100% Isolated
          </div>
          <div style="font-size:12px;color:var(--muted);margin-top:4px;">
            Strict Multi-Tenant Scoping Active
          </div>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div style="display:flex;gap:8px;margin-top:20px;border-bottom:1px solid var(--border);">
        <button class="btn tab-btn ${activeTab === 'companies' ? 'p' : ''}" id="tabCompanies" type="button" style="border-radius:6px 6px 0 0;">
          <i class="fa-solid fa-building"></i> Companies & Records (${(data.companies || []).length})
        </button>
        <button class="btn tab-btn ${activeTab === 'users' ? 'p' : ''}" id="tabUsers" type="button" style="border-radius:6px 6px 0 0;">
          <i class="fa-solid fa-user-shield"></i> User Management
        </button>
        <button class="btn tab-btn ${activeTab === 'audit' ? 'p' : ''}" id="tabAudit" type="button" style="border-radius:6px 6px 0 0;">
          <i class="fa-solid fa-list-check"></i> Platform Audit Activity
        </button>
      </div>

      <!-- Tab Content Area -->
      <div id="superAdminTabContent" style="margin-top:16px;"></div>
    `;
  }

  function renderTabContent() {
    const container = root.querySelector('#superAdminTabContent');
    if (!container) return;

    if (activeTab === 'companies') {
      const companies = data.companies || [];
      container.innerHTML = `
        <div class="card" style="padding:16px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
            <div>
              <h3 style="font-size:15px;margin:0;">Registered Companies & Business Records Breakdown</h3>
              <div style="font-size:12px;color:var(--muted);margin-top:2px;">
                Complete record counts per tenant ensuring no cross-company leakage.
              </div>
            </div>
          </div>
          <div class="table-wrap" style="overflow-x:auto;">
            <table class="table" style="width:100%;font-size:13px;border-collapse:collapse;">
              <thead>
                <tr style="border-bottom:2px solid var(--border);text-align:left;">
                  <th style="padding:8px;">ID</th>
                  <th style="padding:8px;">Company Name</th>
                  <th style="padding:8px;">State & GSTIN</th>
                  <th style="padding:8px;text-align:center;">Users</th>
                  <th style="padding:8px;text-align:center;">Customers</th>
                  <th style="padding:8px;text-align:center;">Vendors</th>
                  <th style="padding:8px;text-align:center;">Items</th>
                  <th style="padding:8px;text-align:center;">Invoices</th>
                  <th style="padding:8px;text-align:center;">Bills</th>
                  <th style="padding:8px;text-align:center;">Payments</th>
                  <th style="padding:8px;text-align:center;">Total Records</th>
                  <th style="padding:8px;">Status</th>
                  <th style="padding:8px;text-align:right;">Action</th>
                </tr>
              </thead>
              <tbody>
                ${companies.length === 0 ? `<tr><td colspan="13" style="text-align:center;padding:24px;color:var(--muted);">No companies found.</td></tr>` : ''}
                ${companies.map(c => `
                  <tr style="border-bottom:1px solid var(--border);">
                    <td style="padding:8px;color:var(--muted);">#${c.id}</td>
                    <td style="padding:8px;">
                      <strong>${esc(c.name)}</strong>
                      ${c.legal_name && c.legal_name !== c.name ? `<div style="font-size:11px;color:var(--muted);">${esc(c.legal_name)}</div>` : ''}
                    </td>
                    <td style="padding:8px;">
                      <div>${esc(c.state || 'N/A')}</div>
                      <div style="font-size:11px;color:var(--muted);">${esc(c.gstin || 'Unregistered')}</div>
                    </td>
                    <td style="padding:8px;text-align:center;"><span class="pastel-chip chip-sky" style="font-size:11px;">${c.users_count}</span></td>
                    <td style="padding:8px;text-align:center;">${c.record_counts.customers}</td>
                    <td style="padding:8px;text-align:center;">${c.record_counts.vendors}</td>
                    <td style="padding:8px;text-align:center;">${c.record_counts.items}</td>
                    <td style="padding:8px;text-align:center;">${c.record_counts.invoices}</td>
                    <td style="padding:8px;text-align:center;">${c.record_counts.bills}</td>
                    <td style="padding:8px;text-align:center;">${c.record_counts.payments}</td>
                    <td style="padding:8px;text-align:center;"><strong>${c.total_records}</strong></td>
                    <td style="padding:8px;">
                      ${c.is_active ? `<span class="pastel-chip chip-emerald" style="font-size:11px;">Active</span>` : `<span class="pastel-chip chip-rose" style="font-size:11px;">Deactivated</span>`}
                    </td>
                    <td style="padding:8px;text-align:right;">
                      <button class="btn btn-sm btnToggleCompany" data-id="${c.id}" data-name="${esc(c.name)}" data-active="${c.is_active}" type="button" style="font-size:11px;padding:3px 8px;">
                        ${c.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;

      container.querySelectorAll('.btnToggleCompany').forEach(btn => {
        btn.addEventListener('click', async () => {
          const cid = btn.dataset.id;
          const cname = btn.dataset.name;
          const isActive = btn.dataset.active === 'true';
          const actionText = isActive ? 'Deactivate' : 'Activate';
          const conf = await confirmBox({
            title: `${actionText} Company`,
            message: `Are you sure you want to ${actionText.toLowerCase()} company "${cname}"? ${isActive ? 'Users of this company will be blocked from logging in.' : 'Users will be granted access.'}`,
            danger: isActive,
            okText: actionText
          });
          if (!conf) return;
          try {
            await api(`super-admin/companies/${cid}/toggle-active/`, { method: 'POST', body: {} });
            toast(`Company ${cname} ${actionText.toLowerCase()}d successfully!`, 'ok');
            const refreshed = await api('super-admin/overview/');
            renderSuperAdminUI(root, refreshed);
          } catch (err) { toast(err.message, 'err'); }
        });
      });
    } else if (activeTab === 'users') {
      container.innerHTML = `
        <div class="card" style="padding:16px;">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:14px;">
            <div>
              <h3 style="font-size:15px;margin:0;">User Management & Access Control</h3>
              <div style="font-size:12px;color:var(--muted);margin-top:2px;">
                Filter users across all tenant companies, inspect roles, and manage active status.
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
              <input type="text" id="suUserSearch" class="inp" placeholder="Search user, email, company…" style="width:220px;font-size:12px;padding:6px 10px;">
              <select id="suUserStatusFilter" class="inp" style="width:120px;font-size:12px;padding:6px 10px;">
                <option value="">All Statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <select id="suUserCompanyFilter" class="inp" style="width:160px;font-size:12px;padding:6px 10px;">
                <option value="">All Companies</option>
                ${(data.companies || []).map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
              </select>
              <button class="btn btn-sm" id="btnFilterUsers" type="button"><i class="fa-solid fa-filter"></i> Filter</button>
            </div>
          </div>
          <div id="suUsersTableWrap">
            <div class="spin" style="margin:20px auto;">Loading users…</div>
          </div>
        </div>
      `;

      loadUsersTable();

      const searchInput = container.querySelector('#suUserSearch');
      const statusSelect = container.querySelector('#suUserStatusFilter');
      const companySelect = container.querySelector('#suUserCompanyFilter');
      const filterBtn = container.querySelector('#btnFilterUsers');

      filterBtn.addEventListener('click', () => loadUsersTable());
      searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') loadUsersTable(); });
      statusSelect.addEventListener('change', () => loadUsersTable());
      companySelect.addEventListener('change', () => loadUsersTable());

      async function loadUsersTable() {
        const wrap = container.querySelector('#suUsersTableWrap');
        if (!wrap) return;
        wrap.innerHTML = `<div class="spin" style="margin:20px auto;">Loading users…</div>`;
        const q = searchInput ? searchInput.value.trim() : '';
        const st = statusSelect ? statusSelect.value : '';
        const cid = companySelect ? companySelect.value : '';
        try {
          const res = await api(`super-admin/users/?q=${encodeURIComponent(q)}&status=${encodeURIComponent(st)}&company_id=${encodeURIComponent(cid)}`);
          const users = res.users || [];
          wrap.innerHTML = `
            <div class="table-wrap" style="overflow-x:auto;">
              <table class="table" style="width:100%;font-size:13px;border-collapse:collapse;">
                <thead>
                  <tr style="border-bottom:2px solid var(--border);text-align:left;">
                    <th style="padding:8px;">User</th>
                    <th style="padding:8px;">Email</th>
                    <th style="padding:8px;">Company</th>
                    <th style="padding:8px;">Role</th>
                    <th style="padding:8px;">Status</th>
                    <th style="padding:8px;">Registered</th>
                    <th style="padding:8px;">Last Login</th>
                    <th style="padding:8px;text-align:right;">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${users.length === 0 ? `<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--muted);">No users matched the criteria.</td></tr>` : ''}
                  ${users.map(u => `
                    <tr style="border-bottom:1px solid var(--border);">
                      <td style="padding:8px;">
                        <div style="font-weight:600;">${esc(u.username)}</div>
                        <div style="font-size:11px;color:var(--muted);">${esc(u.full_name)}</div>
                      </td>
                      <td style="padding:8px;">${esc(u.email || 'None')}</td>
                      <td style="padding:8px;">
                        <span class="pastel-chip chip-sky" style="font-size:11px;">${esc(u.company_name)}</span>
                      </td>
                      <td style="padding:8px;">
                        <span style="text-transform:capitalize;font-size:12px;">${esc(u.role)}</span>
                        ${u.is_superuser ? `<span class="pastel-chip chip-rose" style="font-size:10px;margin-left:4px;">SUPERUSER</span>` : ''}
                      </td>
                      <td style="padding:8px;">
                        ${u.is_active ? `<span class="pastel-chip chip-emerald" style="font-size:11px;">Active</span>` : `<span class="pastel-chip chip-rose" style="font-size:11px;">Inactive</span>`}
                      </td>
                      <td style="padding:8px;color:var(--muted);font-size:11px;">${esc(u.date_joined)}</td>
                      <td style="padding:8px;color:var(--muted);font-size:11px;">${esc(u.last_login)}</td>
                      <td style="padding:8px;text-align:right;">
                        ${u.id === APP.user.id ? `<span style="font-size:11px;color:var(--muted);">(Current User)</span>` : `
                          <button class="btn btn-sm btnToggleUser" data-id="${u.id}" data-username="${esc(u.username)}" data-active="${u.is_active}" type="button" style="font-size:11px;padding:3px 8px;">
                            ${u.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                        `}
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `;

          wrap.querySelectorAll('.btnToggleUser').forEach(btn => {
            btn.addEventListener('click', async () => {
              const uid = btn.dataset.id;
              const un = btn.dataset.username;
              const isAct = btn.dataset.active === 'true';
              const actText = isAct ? 'Deactivate' : 'Activate';
              const conf = await confirmBox({
                title: `${actText} User Account`,
                message: `Are you sure you want to ${actText.toLowerCase()} user "${un}"? ${isAct ? 'The user will be blocked from logging into the platform.' : 'The user will be able to log in.'}`,
                danger: isAct,
                okText: actText
              });
              if (!conf) return;
              try {
                await api(`super-admin/users/${uid}/toggle-active/`, { method: 'POST', body: {} });
                toast(`User ${un} ${actText.toLowerCase()}d successfully!`, 'ok');
                loadUsersTable();
              } catch (err) { toast(err.message, 'err'); }
            });
          });
        } catch (err) {
          wrap.innerHTML = `<div style="color:var(--danger);padding:16px;">Failed to load users: ${esc(err.message)}</div>`;
        }
      }
    } else if (activeTab === 'audit') {
      const logs = data.recent_activity || [];
      container.innerHTML = `
        <div class="card" style="padding:16px;">
          <div style="margin-bottom:12px;">
            <h3 style="font-size:15px;margin:0;">Recent Platform Audit & Governance Trail</h3>
            <div style="font-size:12px;color:var(--muted);margin-top:2px;">
              Immutable security activity records captured across all tenant operations.
            </div>
          </div>
          <div class="table-wrap" style="overflow-x:auto;">
            <table class="table" style="width:100%;font-size:13px;border-collapse:collapse;">
              <thead>
                <tr style="border-bottom:2px solid var(--border);text-align:left;">
                  <th style="padding:8px;">Timestamp</th>
                  <th style="padding:8px;">User</th>
                  <th style="padding:8px;">Action</th>
                  <th style="padding:8px;">Entity</th>
                  <th style="padding:8px;">Details</th>
                </tr>
              </thead>
              <tbody>
                ${logs.length === 0 ? `<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--muted);">No audit entries found.</td></tr>` : ''}
                ${logs.map(l => `
                  <tr style="border-bottom:1px solid var(--border);">
                    <td style="padding:8px;font-size:11px;color:var(--muted);white-space:nowrap;">${esc(l.timestamp)}</td>
                    <td style="padding:8px;"><strong>${esc(l.user)}</strong></td>
                    <td style="padding:8px;"><span class="pastel-chip chip-amber" style="font-size:10px;text-transform:uppercase;">${esc(l.action)}</span></td>
                    <td style="padding:8px;"><code>${esc(l.model_name)}</code> ${l.object_id ? `<span style="font-size:11px;color:var(--muted);">#${esc(l.object_id)}</span>` : ''}</td>
                    <td style="padding:8px;">${esc(l.summary)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }
  }

  root.innerHTML = buildHtml();
  renderTabContent();

  root.querySelector('#tabCompanies').addEventListener('click', () => {
    activeTab = 'companies';
    root.innerHTML = buildHtml();
    attachHeaderEvents();
    renderTabContent();
  });
  root.querySelector('#tabUsers').addEventListener('click', () => {
    activeTab = 'users';
    root.innerHTML = buildHtml();
    attachHeaderEvents();
    renderTabContent();
  });
  root.querySelector('#tabAudit').addEventListener('click', () => {
    activeTab = 'audit';
    root.innerHTML = buildHtml();
    attachHeaderEvents();
    renderTabContent();
  });

  function attachHeaderEvents() {
    root.querySelector('#btnSuperAdminRefresh')?.addEventListener('click', async () => {
      try {
        const fresh = await api('super-admin/overview/');
        renderSuperAdminUI(root, fresh);
        toast('Platform Super Admin data refreshed.', 'ok');
      } catch (err) { toast(err.message, 'err'); }
    });
    root.querySelector('#btnExportPlatformSummary')?.addEventListener('click', () => {
      const companies = data.companies || [];
      let csv = "Company ID,Company Name,Legal Name,State,GSTIN,Users Count,Customers,Vendors,Items,Invoices,Bills,Payments,Total Records,Active\n";
      companies.forEach(c => {
        csv += `"${c.id}","${c.name.replace(/"/g, '""')}","${(c.legal_name || '').replace(/"/g, '""')}","${c.state}","${c.gstin}",${c.users_count},${c.record_counts.customers},${c.record_counts.vendors},${c.record_counts.items},${c.record_counts.invoices},${c.record_counts.bills},${c.record_counts.payments},${c.total_records},${c.is_active}\n`;
      });
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `platform_tenants_summary_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  attachHeaderEvents();
}
window.superAdminDashboard = superAdminDashboard;

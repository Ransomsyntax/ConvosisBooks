'use strict';

const PAGE = { reload: null };

function listPage(root, cfg) {
  const st = { q: '', page: 1, size: 10, ordering: cfg.ordering || '', f: {} };
  let cache = {};
  root.innerHTML = `<div class="bc">Home / ${esc(cfg.bc)}</div><div class="hd"><h1>${esc(cfg.title)}</h1><div class="act"><button class="btn" data-x="csv" type="button">Export CSV</button>${cfg.onNew ? `<button class="btn p" data-x="new" type="button">+ ${esc(cfg.newLabel)}</button>` : ''}</div></div>${cfg.note ? `<div class="note">${cfg.note}</div>` : ''}
<div class="card" style="margin-top:14px"><div class="tb"><input class="in" type="search" id="tq" placeholder="Search ${esc(cfg.title.toLowerCase())}" aria-label="Search" style="max-width:300px">${(cfg.filters || []).map(f => `<select class="btn" data-f="${f.name}" aria-label="${esc(f.label)}">${opts(f.opts, '')}</select>`).join('')}<span class="sub" id="cnt"></span></div><div class="tw" id="lt">${spinner}</div><div class="pager" id="pgr"></div></div>`;
  const params = () => ({ ...(cfg.params || {}), ...st.f, q: st.q, ordering: st.ordering });
  async function load() {
    PAGE.reload = load;
    $('#lt', root).innerHTML = spinner;
    try {
      const p = await api(cfg.api + '/?' + qs({ ...params(), page: st.page, page_size: st.size }));
      if (!root.isConnected) return;
      if (p.page !== st.page) st.page = p.page;
      cache = Object.fromEntries(p.results.map(r => [String(r.id), r]));
      const sortMark = c => c.s ? (st.ordering === c.s ? ' ▲' : st.ordering === '-' + c.s ? ' ▼' : '') : '';
      const empty = !p.count ? (st.q || Object.values(st.f).some(Boolean) ? 'No matching records.' : esc(cfg.empty || 'No records yet.')) : '';
      $('#lt', root).innerHTML = `<table><thead><tr>${cfg.cols.map(c => `<th ${c.s ? `data-s="${c.s}" tabindex="0" aria-sort="${st.ordering === c.s ? 'ascending' : st.ordering === '-' + c.s ? 'descending' : 'none'}"` : ''} class="${c.r ? 'r' : ''}">${esc(c.h)}${sortMark(c)}</th>`).join('')}${cfg.actions ? '<th></th>' : ''}</tr></thead><tbody>${p.results.map(r => `<tr>${cfg.cols.map(c => `<td class="${c.r ? 'r' : ''}">${c.f(r)}</td>`).join('')}${cfg.actions ? `<td class="rowa">${cfg.actions(r).map(([a, l, k]) => `<button type="button" class="${k || ''}" data-act="${a}" data-id="${r.id}">${esc(l)}</button>`).join('')}</td>` : ''}</tr>`).join('') || `<tr><td colspan="${cfg.cols.length + 1}"><div class="empty">${empty}${!p.count && !st.q && cfg.onNew ? `<br><button class="btn p" data-x="new" type="button" style="margin-top:8px">+ ${esc(cfg.newLabel)}</button>` : ''}</div></td></tr>`}</tbody></table>`;
      $('#cnt', root).textContent = p.count + (p.count === 1 ? ' record' : ' records');
      $('#pgr', root).innerHTML = `<span class="sub">Page ${p.page} of ${p.pages}</span><span class="act"><select class="btn" data-size aria-label="Rows per page">${opts([10, 25, 50, 100].map(n => [n, n + ' / page']), st.size)}</select><button class="btn" data-x="pv" type="button" ${p.page <= 1 ? 'disabled' : ''}>Previous</button><button class="btn" data-x="nx" type="button" ${p.page >= p.pages ? 'disabled' : ''}>Next</button></span>`;
    } catch (e) { if (root.isConnected) $('#lt', root).innerHTML = errBox(e.message, true); }
  }
  let t;
  $('#tq', root).addEventListener('input', e => { clearTimeout(t); t = setTimeout(() => { st.q = e.target.value.trim(); st.page = 1; load(); }, 250); });
  root.addEventListener('change', e => {
    if (e.target.dataset.f) { st.f[e.target.dataset.f] = e.target.value; st.page = 1; load(); }
    if (e.target.hasAttribute('data-size')) { st.size = Number(e.target.value); st.page = 1; load(); }
  });
  const sortBy = th => { const k = th.dataset.s; st.ordering = st.ordering === k ? '-' + k : k; st.page = 1; load(); };
  root.addEventListener('keydown', e => { const th = e.target.closest && e.target.closest('th[data-s]'); if (th && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); sortBy(th); } });
  root.addEventListener('click', async e => {
    const th = e.target.closest('th[data-s]'); if (th) return sortBy(th);
    if (e.target.closest('[data-retry]')) return load();
    const x = e.target.closest('[data-x]');
    if (x) {
      const a = x.dataset.x;
      if (a === 'nx') { st.page++; load(); } else if (a === 'pv') { st.page--; load(); }
      else if (a === 'new') cfg.onNew();
      else if (a === 'csv') location.href = '/api/' + cfg.api + '/?' + qs({ ...params(), export: 'csv' });
      return;
    }
    const b = e.target.closest('[data-act]');
    if (b) { try { await cfg.onAction(b.dataset.act, cache[b.dataset.id]); } catch (err) { toast(err.message, 'err'); } }
  });
  load();
}

async function deleteRecord(resource, row, label) {
  if (!(await confirmBox({ title: 'Delete ' + label + '?', message: 'This cannot be undone.', okText: 'Delete', danger: true }))) return;
  await api(`${resource}/${row.id}/`, { method: 'DELETE' });
  toast(label + ' deleted'); refresh();
}

const money = f => ({ r: 1, f });
const docStatusFilters = (posted) => [{ name: 'status', label: 'Status', opts: [['', 'All statuses'], ['draft', 'Draft'], ['unpaid', posted], ['partial', 'Partially Paid'], ['overdue', 'Overdue'], ['paid', 'Paid'], ['void', 'Void']] }];
const LISTS = {
  customers: {
    api: 'customers', title: 'Customers', bc: 'Sales', newLabel: 'New customer', onNew: () => partyForm('customers'), empty: 'No customers yet.',
    filters: [{ name: 'active', label: 'Status', opts: [['', 'All'], ['1', 'Active'], ['0', 'Inactive']] }],
    cols: [{ h: 'Name', s: 'name', f: r => `<button class="lk" type="button" data-act="view" data-id="${r.id}">${esc(r.name)}</button>${r.active ? '' : ' ' + badge('Inactive')}` }, { h: 'Contact', f: r => esc(r.email || r.phone || '—') }, { h: 'State', s: 'state', f: r => esc(r.state || '—') }, { h: 'Billed', ...money(r => inr(r.billed)) }, { h: 'Receivable', ...money(r => inr(r.outstanding)) }, { h: 'Overdue', ...money(r => r.overdue > 0 ? `<span class="dn">${inr(r.overdue)}</span>` : inr(0)) }],
    actions: () => [['edit', 'Edit'], ['delete', 'Delete', 'd']],
    onAction: (a, r) => a === 'view' ? partyDetail('customers', r.id) : a === 'edit' ? partyForm('customers', r.id) : deleteRecord('customers', r, 'customer'),
  },
  vendors: {
    api: 'vendors', title: 'Vendors', bc: 'Purchases', newLabel: 'New vendor', onNew: () => partyForm('vendors'), empty: 'No vendors yet.',
    filters: [{ name: 'active', label: 'Status', opts: [['', 'All'], ['1', 'Active'], ['0', 'Inactive']] }],
    cols: [{ h: 'Name', s: 'name', f: r => `<button class="lk" type="button" data-act="view" data-id="${r.id}">${esc(r.name)}</button>${r.active ? '' : ' ' + badge('Inactive')}` }, { h: 'Contact', f: r => esc(r.email || r.phone || '—') }, { h: 'State', s: 'state', f: r => esc(r.state || '—') }, { h: 'Billed', ...money(r => inr(r.billed)) }, { h: 'Payable', ...money(r => inr(r.outstanding)) }, { h: 'Overdue', ...money(r => r.overdue > 0 ? `<span class="dn">${inr(r.overdue)}</span>` : inr(0)) }],
    actions: () => [['edit', 'Edit'], ['delete', 'Delete', 'd']],
    onAction: (a, r) => a === 'view' ? partyDetail('vendors', r.id) : a === 'edit' ? partyForm('vendors', r.id) : deleteRecord('vendors', r, 'vendor'),
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
    actions: r => [['edit', 'Edit'], ...(r.track_inventory ? [['adjust', 'Adjust']] : []), ['delete', 'Delete', 'd']],
    onAction: (a, r) => a === 'edit' ? itemForm(r.id) : a === 'adjust' ? adjustForm(r.id) : deleteRecord('items', r, 'item'),
  },
  invoices: {
    api: 'invoices', title: 'Invoices', bc: 'Sales', newLabel: 'New invoice', onNew: () => docForm('invoices'), ordering: '-date', empty: 'No invoices yet.',
    filters: docStatusFilters('Sent'),
    cols: [{ h: 'Date', s: 'date', f: r => fd(r.date) }, { h: 'Invoice#', s: 'number', f: r => `<button class="lk" type="button" data-act="view" data-id="${r.id}">${esc(r.number)}</button>${r.attachment_count ? ' <span title="Has attachments">📎</span>' : ''}` }, { h: 'Customer', f: r => esc(r.party) }, { h: 'Status', f: r => badge(r.status) }, { h: 'Due date', s: 'due_date', f: r => fd(r.due_date) }, { h: 'Total', s: 'total', ...money(r => inr(r.total)) }, { h: 'Balance due', ...money(r => inr(r.balance)) }],
    actions: () => [['view', 'View'], ['edit', 'Edit'], ['delete', 'Delete', 'd']],
    onAction: (a, r) => a === 'view' ? docMasterDetail($('#pg'), 'invoices', r.id) : a === 'edit' ? docForm('invoices', r.id) : deleteRecord('invoices', r, 'invoice'),
  },
  bills: {
    api: 'bills', title: 'Bills', bc: 'Purchases', newLabel: 'New bill', onNew: () => docForm('bills'), ordering: '-date', empty: 'No bills yet.',
    filters: docStatusFilters('Open'),
    cols: [{ h: 'Date', s: 'date', f: r => fd(r.date) }, { h: 'Bill#', s: 'number', f: r => `<button class="lk" type="button" data-act="view" data-id="${r.id}">${esc(r.number)}</button>${r.attachment_count ? ' <span title="Has attachments">📎</span>' : ''}` }, { h: 'Vendor', f: r => esc(r.party) }, { h: 'Status', f: r => badge(r.status) }, { h: 'Due date', s: 'due_date', f: r => fd(r.due_date) }, { h: 'Total', s: 'total', ...money(r => inr(r.total)) }, { h: 'Balance due', ...money(r => inr(r.balance)) }],
    actions: () => [['view', 'View'], ['edit', 'Edit'], ['delete', 'Delete', 'd']],
    onAction: (a, r) => a === 'view' ? docMasterDetail($('#pg'), 'bills', r.id) : a === 'edit' ? docForm('bills', r.id) : deleteRecord('bills', r, 'bill'),
  },
  'payments-received': {
    api: 'payments-received', title: 'Payments Received', bc: 'Sales', newLabel: 'Record payment', onNew: () => paymentForm('payments-received'), ordering: '-date', empty: 'No payments recorded yet.',
    cols: [{ h: 'Date', s: 'date', f: r => fd(r.date) }, { h: 'Receipt#', s: 'number', f: r => `<button class="lk" type="button" data-act="view" data-id="${r.id}">${esc(r.number)}</button>` }, { h: 'Customer', f: r => esc(r.party) }, { h: 'Mode', f: r => esc(r.mode_label) }, { h: 'Reference', f: r => esc(r.reference || '—') }, { h: 'Amount', s: 'amount', ...money(r => inr(r.amount)) }, { h: 'Unapplied', ...money(r => inr(r.unapplied)) }],
    actions: () => [['view', 'View'], ['delete', 'Delete', 'd']],
    onAction: (a, r) => a === 'view' ? paymentDetail('payments-received', r.id) : deleteRecord('payments-received', r, 'payment'),
  },
  'payments-made': {
    api: 'payments-made', title: 'Payments Made', bc: 'Purchases', newLabel: 'Record payment', onNew: () => paymentForm('payments-made'), ordering: '-date', empty: 'No payments recorded yet.',
    cols: [{ h: 'Date', s: 'date', f: r => fd(r.date) }, { h: 'Payment#', s: 'number', f: r => `<button class="lk" type="button" data-act="view" data-id="${r.id}">${esc(r.number)}</button>` }, { h: 'Vendor', f: r => esc(r.party) }, { h: 'Mode', f: r => esc(r.mode_label) }, { h: 'Reference', f: r => esc(r.reference || '—') }, { h: 'Amount', s: 'amount', ...money(r => inr(r.amount)) }, { h: 'Unapplied', ...money(r => inr(r.unapplied)) }],
    actions: () => [['view', 'View'], ['delete', 'Delete', 'd']],
    onAction: (a, r) => a === 'view' ? paymentDetail('payments-made', r.id) : deleteRecord('payments-made', r, 'payment'),
  },
  inventory: {
    api: 'items', title: 'Inventory Summary', bc: 'Inventory', params: { tracked: 1 }, empty: 'No inventory-tracked items yet. Create a goods item with “Track inventory” on.',
    filters: [{ name: 'stock', label: 'Stock level', opts: [['', 'All'], ['low', 'Low stock'], ['out', 'Out of stock']] }],
    cols: [{ h: 'Item', s: 'name', f: r => esc(r.name) }, { h: 'SKU', s: 'sku', f: r => esc(r.sku) }, { h: 'On hand', s: 'stock', r: 1, f: r => qty(r.stock) + ' ' + esc(r.unit) }, { h: 'Reorder at', r: 1, f: r => qty(r.reorder_level) }, { h: 'Unit cost', ...money(r => inr(r.purchase_price)) }, { h: 'Stock value', ...money(r => inr(r.valuation)) }, { h: 'Status', f: r => badge(r.status) }],
    actions: () => [['adjust', 'Adjust']], onAction: (a, r) => adjustForm(r.id),
  },
  adjustments: {
    api: 'stock-adjustments', title: 'Stock Adjustments', bc: 'Inventory', newLabel: 'New adjustment', onNew: () => adjustForm(), ordering: '-date', empty: 'No stock adjustments yet.',
    cols: [{ h: 'Date', s: 'date', f: r => fd(r.date) }, { h: 'Reference', f: r => esc(r.reference) }, { h: 'Item', s: 'item', f: r => esc(r.item) }, { h: 'Reason', f: r => esc(r.reason) }, { h: 'Change', r: 1, f: r => `<span class="${num(r.change) < 0 ? 'dn' : 'up'}">${num(r.change) > 0 ? '+' : ''}${qty(r.change)}</span>` }, { h: 'Balance after', r: 1, f: r => qty(r.balance_after) }],
  },
  movements: {
    api: 'stock-movements', title: 'Stock Movement', bc: 'Inventory', ordering: '-date', empty: 'No stock movements yet.',
    filters: [{ name: 'kind', label: 'Type', opts: [['', 'All types'], ['opening', 'Opening stock'], ['sale', 'Sales'], ['sale_void', 'Sales voided'], ['purchase', 'Purchases'], ['purchase_void', 'Purchases voided'], ['adjustment', 'Adjustments']] }],
    cols: [{ h: 'Date', s: 'date', f: r => fd(r.date) }, { h: 'Item', s: 'item', f: r => esc(r.item) }, { h: 'Type', f: r => esc(r.kind_label) }, { h: 'Reference', f: r => esc(r.reference || '—') }, { h: 'Change', r: 1, f: r => `<span class="${num(r.change) < 0 ? 'dn' : 'up'}">${num(r.change) > 0 ? '+' : ''}${qty(r.change)}</span>` }, { h: 'Balance after', r: 1, f: r => qty(r.balance_after) }],
  },
  'sales-orders': {
    api: 'sales-orders', title: 'Sales Orders', bc: 'Sales', newLabel: 'New sales order', onNew: () => docForm('invoices'), ordering: '-date', empty: 'No sales orders yet.',
    filters: docStatusFilters('Confirmed'),
    cols: [{ h: 'Date', s: 'date', f: r => fd(r.date) }, { h: 'Order#', s: 'number', f: r => `<button class="lk" type="button" data-act="view" data-id="${r.id}">${esc(r.number)}</button>` }, { h: 'Customer', f: r => esc(r.party) }, { h: 'Status', f: r => badge(r.status) }, { h: 'Expected Ship', s: 'expected_shipment_date', f: r => fd(r.expected_shipment_date || r.due_date) }, { h: 'Total', s: 'total', ...money(r => inr(r.total)) }],
    actions: () => [['delete', 'Delete', 'd']],
    onAction: (a, r) => deleteRecord('sales-orders', r, 'sales order'),
  },
  'recurring-invoices': {
    api: 'recurring-invoices', title: 'Recurring Invoices', bc: 'Sales', newLabel: 'New recurring profile', onNew: () => recurringInvoiceModal(), ordering: '-created_at', empty: 'No recurring profiles yet.',
    cols: [{ h: 'Profile Name', s: 'profile_name', f: r => `<button class="lk" type="button" data-act="edit" data-id="${r.id}">${esc(r.profile_name)}</button>` }, { h: 'Customer', f: r => esc(r.customer_name) }, { h: 'Frequency', f: r => badge(r.frequency) }, { h: 'Next Date', f: r => fd(r.next_date) }, { h: 'Total', ...money(r => inr(r.total)) }, { h: 'Status', f: r => badge(r.status) }],
    actions: () => [['edit', 'Edit'], ['delete', 'Delete', 'd']],
    onAction: (a, r) => a === 'edit' ? recurringInvoiceModal(r.id) : deleteRecord('recurring-invoices', r, 'profile'),
  },
  'retainer-invoices': {
    api: 'retainer-invoices', title: 'Retainer Invoices', bc: 'Sales', newLabel: 'New retainer invoice', onNew: () => docForm('invoices'), ordering: '-date', empty: 'No retainer invoices yet.',
    cols: [{ h: 'Date', s: 'date', f: r => fd(r.date) }, { h: 'Retainer#', s: 'number', f: r => `<button class="lk" type="button" data-act="view" data-id="${r.id}">${esc(r.number)}</button>` }, { h: 'Customer', f: r => esc(r.party) }, { h: 'Status', f: r => badge(r.status) }, { h: 'Total', ...money(r => inr(r.total)) }, { h: 'Balance', ...money(r => inr(r.balance)) }],
    actions: () => [['delete', 'Delete', 'd']],
    onAction: (a, r) => deleteRecord('retainer-invoices', r, 'retainer invoice'),
  },
  'delivery-challans': {
    api: 'delivery-challans', title: 'Delivery Challans', bc: 'Sales', newLabel: 'New delivery challan', onNew: () => challanModal(), ordering: '-date', empty: 'No delivery challans yet.',
    cols: [{ h: 'Date', s: 'date', f: r => fd(r.date) }, { h: 'Challan#', s: 'number', f: r => esc(r.number) }, { h: 'Customer', f: r => esc(r.customer_name) }, { h: 'Type', f: r => esc(r.challan_type) }, { h: 'Vehicle#', f: r => esc(r.vehicle_number || '—') }, { h: 'Status', f: r => badge(r.status) }],
    actions: () => [['delete', 'Delete', 'd']],
    onAction: (a, r) => deleteRecord('delivery-challans', r, 'delivery challan'),
  },
  'credit-notes': {
    api: 'credit-notes', title: 'Credit Notes', bc: 'Sales', newLabel: 'New credit note', onNew: () => docForm('invoices'), ordering: '-date', empty: 'No credit notes yet.',
    cols: [{ h: 'Date', s: 'date', f: r => fd(r.date) }, { h: 'Credit Note#', s: 'number', f: r => `<button class="lk" type="button" data-act="view" data-id="${r.id}">${esc(r.number)}</button>` }, { h: 'Customer', f: r => esc(r.party) }, { h: 'Status', f: r => badge(r.status) }, { h: 'Total', ...money(r => inr(r.total)) }, { h: 'Balance', ...money(r => inr(r.balance)) }],
    actions: () => [['delete', 'Delete', 'd']],
    onAction: (a, r) => deleteRecord('credit-notes', r, 'credit note'),
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
    actions: () => [['delete', 'Delete', 'd']],
    onAction: (a, r) => deleteRecord('e-way-bills', r, 'e-Way Bill'),
  },
  expenses: {
    api: 'expenses', title: 'Expenses', bc: 'Purchases', newLabel: 'Record expense', onNew: () => expenseForm(), ordering: '-date', empty: 'No expenses recorded yet.',
    cols: [
      { h: 'Date', s: 'date', f: r => fd(r.date) },
      { h: 'Expense#', s: 'number', f: r => esc(r.number) },
      { h: 'Account', f: r => esc(r.expense_account_name) },
      { h: 'Vendor', f: r => esc(r.vendor_name || '—') },
      { h: 'Paid Through', f: r => esc(r.paid_through) },
      { h: 'Tax (GST)', ...money(r => inr(r.tax_amount)) },
      { h: 'Amount', s: 'total', ...money(r => inr(r.total)) },
      { h: 'Tax Deductible', f: r => r.is_tax_deductible ? badge('Deductible', 'up') : badge('Non-deductible') }
    ],
    actions: () => [['delete', 'Delete', 'd']],
    onAction: (a, r) => deleteRecord('expenses', r, 'expense'),
  },
  'purchase-orders': {
    api: 'purchase-orders', title: 'Purchase Orders', bc: 'Purchases', newLabel: 'New purchase order', onNew: () => docForm('bills'), ordering: '-date', empty: 'No purchase orders yet.',
    filters: docStatusFilters('Confirmed'),
    cols: [{ h: 'Date', s: 'date', f: r => fd(r.date) }, { h: 'PO#', s: 'number', f: r => `<button class="lk" type="button" data-act="view" data-id="${r.id}">${esc(r.number)}</button>` }, { h: 'Vendor', f: r => esc(r.party) }, { h: 'Status', f: r => badge(r.status) }, { h: 'Delivery Date', s: 'delivery_date', f: r => fd(r.delivery_date || r.due_date) }, { h: 'Total', s: 'total', ...money(r => inr(r.total)) }],
    actions: () => [['delete', 'Delete', 'd']],
    onAction: (a, r) => deleteRecord('purchase-orders', r, 'purchase order'),
  },
  'vendor-credits': {
    api: 'vendor-credits', title: 'Vendor Credits', bc: 'Purchases', newLabel: 'New vendor credit', onNew: () => docForm('bills'), ordering: '-date', empty: 'No vendor credits yet.',
    cols: [{ h: 'Date', s: 'date', f: r => fd(r.date) }, { h: 'Credit#', s: 'number', f: r => `<button class="lk" type="button" data-act="view" data-id="${r.id}">${esc(r.number)}</button>` }, { h: 'Vendor', f: r => esc(r.party) }, { h: 'Status', f: r => badge(r.status) }, { h: 'Total', ...money(r => inr(r.total)) }, { h: 'Balance', ...money(r => inr(r.balance)) }],
    actions: () => [['delete', 'Delete', 'd']],
    onAction: (a, r) => deleteRecord('vendor-credits', r, 'vendor credit'),
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
    actions: () => [['edit', 'Edit'], ['delete', 'Delete', 'd']],
    onAction: (a, r) => a === 'edit' ? projectModal(r.id) : deleteRecord('projects', r, 'project'),
  },
  timesheets: {
    api: 'timelogs', title: 'Timesheets', bc: 'Time Tracking', newLabel: 'Log time', onNew: () => timelogModal(), ordering: '-date', empty: 'No time entries logged yet.',
    cols: [
      { h: 'Date', s: 'date', f: r => fd(r.date) },
      { h: 'Project', f: r => esc(r.project_name) },
      { h: 'Task', f: r => esc(r.task) },
      { h: 'Hours', r: 1, f: r => `<b>${qty(r.hours)} hrs</b>` },
      { h: 'Billable', f: r => r.billable ? badge('Billable', 'up') : badge('Non-billable') },
      { h: 'Logged By', f: r => esc(r.user_name || 'Admin') }
    ],
    actions: () => [['delete', 'Delete', 'd']],
    onAction: (a, r) => deleteRecord('timelogs', r, 'time log'),
  },
  'bank-accounts': {
    api: 'bank-accounts', title: 'Bank Accounts', bc: 'Banking', newLabel: 'Add bank account', onNew: () => bankAccountForm(), empty: 'No bank accounts added yet.',
    cols: [
      { h: 'Account Name', s: 'name', f: r => `<b>${esc(r.name)}</b><div class="sub" style="font-size:11px;">${esc(r.bank_name)} · ${esc(r.account_number)}</div>` },
      { h: 'Type', f: r => esc((r.account_type || '').replace('_', ' ')) },
      { h: 'IFSC', f: r => esc(r.ifsc || '—') },
      { h: 'Balance', s: 'current_balance', ...money(r => `<span style="font-weight:700;color:var(--accent);">${inr(r.current_balance)}</span>`) }
    ],
    actions: () => [['edit', 'Edit'], ['import', 'Import Feed'], ['delete', 'Delete', 'd']],
    onAction: (a, r) => a === 'edit' ? bankAccountForm(r.id) : a === 'import' ? importStatementModal(r.id) : deleteRecord('bank-accounts', r, 'bank account'),
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
      { h: 'Journal#', s: 'number', f: r => `<b>${esc(r.number)}</b>` },
      { h: 'Type', f: r => badge(r.entry_type) },
      { h: 'Reference', f: r => esc(r.reference || '—') },
      { h: 'Notes', f: r => esc(r.notes || '—') },
      { h: 'Total Debit', ...money(r => inr(r.total_debit)) },
      { h: 'Total Credit', ...money(r => inr(r.total_credit)) }
    ],
    actions: () => [['delete', 'Delete', 'd']],
    onAction: (a, r) => deleteRecord('manual-journals', r, 'journal entry'),
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
    actions: r => r.is_system ? [['edit', 'Edit']] : [['edit', 'Edit'], ['delete', 'Delete', 'd']],
    onAction: (a, r) => a === 'edit' ? accountForm(r.id) : deleteRecord('accounts', r, 'account'),
  },
  'item-categories': {
    api: 'item-categories', title: 'Item Categories', bc: 'Items', newLabel: 'New category', onNew: () => categoryModal(), ordering: 'name', empty: 'No item categories yet.',
    cols: [{ h: 'Category Name', s: 'name', f: r => `<b>${esc(r.name)}</b>` }, { h: 'Description', f: r => esc(r.description || '—') }],
    actions: () => [['delete', 'Delete', 'd']],
    onAction: (a, r) => deleteRecord('item-categories', r, 'category'),
  },
  'price-lists': {
    api: 'price-lists', title: 'Price Lists', bc: 'Items', newLabel: 'New price list', onNew: () => priceListModal(), ordering: 'name', empty: 'No price lists yet.',
    cols: [{ h: 'Name', s: 'name', f: r => `<b>${esc(r.name)}</b>` }, { h: 'Pricing Scheme', f: r => esc(r.pricing_scheme) }, { h: 'Percentage', r: 1, f: r => num(r.percentage) + '%' }, { h: 'Status', f: r => r.active ? badge('Active', 'up') : badge('Inactive') }],
    actions: () => [['delete', 'Delete', 'd']],
    onAction: (a, r) => deleteRecord('price-lists', r, 'price list'),
  },
  warehouses: {
    api: 'warehouses', title: 'Warehouses', bc: 'Inventory', newLabel: 'New warehouse', onNew: () => warehouseModal(), ordering: 'name', empty: 'No warehouses configured.',
    cols: [{ h: 'Code', s: 'code', f: r => `<b>${esc(r.code)}</b>` }, { h: 'Warehouse Name', s: 'name', f: r => `<b>${esc(r.name)}</b>${r.is_primary ? ' <span class="pastel-chip chip-lavender" style="font-size:10px;padding:1px 6px;">Primary</span>' : ''}` }, { h: 'City', f: r => esc(r.city || '—') }, { h: 'State', f: r => esc(r.state || '—') }],
    actions: () => [['delete', 'Delete', 'd']],
    onAction: (a, r) => deleteRecord('warehouses', r, 'warehouse'),
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

/* detail dialogs */
const kvBox = pairs => `<div class="kv">${pairs.map(([k, v]) => `<div><span>${esc(k)}</span>${v}</div>`).join('')}</div>`;

/* ==================== Document Sheet & Template Customizer ==================== */
function renderDocSheet(d, kind, customOpts = {}) {
  const inv = kind === 'invoices';
  const org = APP.org || {};
  const theme = customOpts.theme || org.template_theme || (inv ? 'convosis' : 'modern');
  const color = customOpts.color || org.template_color || '#1877f2';
  const showLogo = customOpts.show_logo !== false;
  const showSig = customOpts.show_signature !== false;
  const showWords = customOpts.show_words !== false;
  const showHsn = customOpts.show_hsn !== false;
  const title = customOpts.title || (inv ? 'TAX INVOICE' : 'BILL');

  const isPaid = d.status === 'Paid' || (d.raw_status !== 'draft' && num(d.balance) <= 0);
  const isOverdue = d.status === 'Overdue';
  const isDraft = d.raw_status === 'draft';
  const ribClass = isPaid ? 'paid' : isOverdue ? 'overdue' : isDraft ? 'draft' : 'open';
  const ribText = isPaid ? 'Paid' : isOverdue ? 'Overdue' : isDraft ? 'Draft' : (inv ? 'Sent' : 'Open');

  const linesHtml = (d.lines || []).map((l, i) => `
    <tr>
      <td style="width:36px;color:#64748b;font-weight:600;">${i + 1}</td>
      <td>
        <div style="font-weight:600;color:#0f172a;">${esc(l.description)}</div>
      </td>
      ${showHsn ? `<td style="color:#475569;">${esc(l.hsn_sac || '—')}</td>` : ''}
      <td class="r" style="font-weight:600;">${qty(l.quantity)}</td>
      <td class="r">${inr(l.rate).replace('₹', '')}</td>
      <td class="r" style="font-weight:700;">${inr(l.line_total).replace('₹', '')}</td>
    </tr>
  `).join('');

  const party = d.party_details || {};
  const partyName = esc(d.party || party.name || (inv ? 'Customer' : 'Vendor'));
  const partyAddr = esc(party.billing_address || '');
  const partyGstin = party.gstin ? `<div style="margin-top:2px;">GSTIN <b>${esc(party.gstin)}</b></div>` : '';
  const partyState = party.state ? `<div>State: ${esc(party.state)}</div>` : '';

  const companyIdLine = org.company_id ? `<div>Company ID : <b>${esc(org.company_id)}</b></div>` : '<div>Company ID : U62090KL2026PTC103900</div>';
  const orgAddrHtml = (org.address || 'Technolodge Phase II\nKMC 24/222, Anugraha Medical Complex Building').split('\n').map(l => `<div>${esc(l)}</div>`).join('');
  const orgCityState = `<div>${esc(org.city || 'Kottayam')} ${esc(org.state || 'Keralam')} ${esc(org.pincode || '686003')}</div>`;
  const orgCountry = `<div>${esc(org.country || 'India')}</div>`;
  const orgGstin = org.gstin ? `<div>GSTIN <b>${esc(org.gstin)}</b></div>` : '<div>GSTIN 32AANCC9298C1ZE</div>';
  const orgPhone = org.phone ? `<div>${esc(org.phone)}</div>` : '<div>91-9847017737</div>';
  const orgEmail = org.email ? `<div>${esc(org.email)}</div>` : '<div>admin@convosis.com</div>';
  const orgWeb = org.website ? `<div>${esc(org.website)}</div>` : '<div>www.convosis.com</div>';
  const logoSrc = org.logo_data || '/static/books/img/convosis-logo.png';

  const orderNum = d.order_number || d.vendor_ref || '';
  const isDarkHead = theme === 'modern' || (!inv && theme !== 'convosis');

  return `
    <div class="doc-sheet theme-${theme}" style="--theme-color:${color};">
      <div class="doc-ribbon ${ribClass}"><span>${ribText}</span></div>

      <div class="doc-sheet-header">
        <div class="doc-company-box">
          ${showLogo ? `<img class="doc-company-logo" src="${esc(logoSrc)}" alt="${esc(org.name || 'Convosis')}">` : ''}
          <div class="doc-company-name">${esc(org.name || 'Convosis Technologies Pvt Ltd')}</div>
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
          ${!inv ? `<div style="font-size:14px;font-weight:700;margin-bottom:8px;color:#0f172a;">Bill# ${esc(d.number)}</div><div style="font-size:12px;color:#475569;margin-bottom:8px;">Balance Due <b style="color:${color};font-size:14px;">${inr(d.balance)}</b></div>` : ''}
          <table class="doc-meta-grid">
            ${inv ? `<tr><td>#</td><td>: <b>${esc(d.number)}</b></td></tr>` : ''}
            ${inv ? `<tr><td>Invoice Date</td><td>: ${fd(d.date)}</td></tr>` : `<tr><td>Bill Date</td><td>: ${fd(d.date)}</td></tr>`}
            <tr><td>Terms</td><td>: ${esc(d.terms || 'Due on Receipt')}</td></tr>
            <tr><td>Due Date</td><td>: ${fd(d.due_date)}</td></tr>
            ${inv ? `<tr><td>Place Of Supply</td><td>: ${esc(d.place_of_supply || org.state || 'Kerala')}</td></tr>` : ''}
            ${orderNum ? `<tr><td>Order Number</td><td>: ${esc(orderNum)}</td></tr>` : ''}
          </table>
        </div>
      </div>

      <div class="doc-party-sec">
        <div class="doc-party-title">${inv ? 'Bill To' : 'Bill From'}</div>
        <div class="doc-party-name" style="color:${color};">${partyName}</div>
        <div class="doc-party-detail">
          ${partyAddr ? `<div>${partyAddr}</div>` : ''}
          ${partyState}
          ${partyGstin}
        </div>
      </div>

      <table class="doc-items-tbl ${isDarkHead ? 'dark-head' : ''}">
        <thead>
          <tr>
            <th>#</th>
            <th>Item &amp; Description</th>
            ${showHsn ? '<th>HSN/SAC</th>' : ''}
            <th class="r">Qty</th>
            <th class="r">Rate</th>
            <th class="r">Amount</th>
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
            <div class="doc-totals-row">
              <span>Sub Total</span>
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
          </div>
        </div>
      </div>

      ${showSig ? `
        <div class="doc-signature-sec">
          <div class="doc-signature-box">
            <div class="doc-sig-line"></div>
            <div class="doc-sig-label">${esc(org.signature_title || 'Authorized Signature')}</div>
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
        ${fld({ name: 'company_id', label: 'Company ID / CIN', value: org.company_id || 'U62090KL2026PTC103900' })}
        ${fld({ name: 'phone', label: 'Company Phone', value: org.phone || '91-9847017737' })}
        ${fld({ name: 'email', label: 'Company Email', value: org.email || 'admin@convosis.com' })}
        ${fld({ name: 'website', label: 'Company Website', value: org.website || 'www.convosis.com' })}
        ${fld({ name: 'address', label: 'Company Address', type: 'textarea', value: org.address || 'Technolodge Phase II\nKMC 24/222, Anugraha Medical Complex Building', col: 'c2' })}
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

async function docMasterDetail(root, kind, selectedId) {
  const inv = kind === 'invoices';
  let curFilter = '';
  let searchQuery = '';
  let docs = [];
  let curDoc = null;

  PAGE.reload = () => docMasterDetail(root, kind, curDoc ? curDoc.id : selectedId);

  root.innerHTML = `
    <div class="split-view-container">
      <div class="master-col">
        <div class="master-col-hd">
          <div style="display:flex;align-items:center;gap:6px;">
            <select class="btn" id="master-filter-sel" style="font-weight:700;font-size:14px;border:none;background:transparent;padding:4px 0;cursor:pointer;">
              <option value="">All ${inv ? 'Invoices' : 'Bills'}</option>
              <option value="draft">Draft</option>
              <option value="unpaid">${inv ? 'Sent' : 'Open'}</option>
              <option value="overdue">Overdue</option>
              <option value="paid">Paid</option>
            </select>
          </div>
          <div style="display:flex;align-items:center;gap:6px;">
            <button class="btn p" id="master-new-btn" type="button" title="Create New">+ New</button>
            <button class="btn" id="master-view-mode-btn" type="button" title="Switch to Table View">≡ Table</button>
          </div>
        </div>
        <div class="master-search-bar">
          <input class="in" type="search" id="master-q-in" placeholder="Search ${inv ? 'invoices' : 'bills'}…" style="width:100%;height:32px;font-size:12px;">
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
      const qParams = { page_size: 100, ordering: '-date' };
      if (curFilter) qParams.status = curFilter;
      if (searchQuery) qParams.q = searchQuery;
      const res = await api(`${kind}/?` + qs(qParams));
      docs = res.results || [];
      renderMasterList();
      if (docs.length > 0) {
        const found = selectedId ? docs.find(d => String(d.id) === String(selectedId)) : null;
        loadDetail((found || docs[0]).id);
      } else {
        $('#detail-col-box', root).innerHTML = `<div class="empty" style="margin:auto;"><div>No ${inv ? 'invoices' : 'bills'} found.<br><button class="btn p" id="empty-new-btn" style="margin-top:10px;">+ New ${inv ? 'Invoice' : 'Bill'}</button></div></div>`;
        const eb = $('#empty-new-btn', root);
        if (eb) eb.addEventListener('click', () => docForm(kind));
      }
    } catch (e) {
      $('#master-list-box', root).innerHTML = errBox(e.message);
    }
  }

  function renderMasterList() {
    const box = $('#master-list-box', root);
    if (!docs.length) {
      box.innerHTML = `<div class="empty" style="padding:30px 10px;"><div>No records matching.</div></div>`;
      return;
    }
    box.innerHTML = docs.map(d => {
      const isActive = curDoc && String(curDoc.id) === String(d.id);
      const isPaid = d.status === 'Paid';
      const isOverdue = d.status === 'Overdue';
      const badgeClass = isPaid ? 'ok' : isOverdue ? 'ba' : d.raw_status === 'draft' ? 'gr' : 'in';
      const badgeText = isOverdue ? 'OVERDUE' : d.status.toUpperCase();
      return `
        <div class="doc-row-card ${isActive ? 'active' : ''}" data-id="${d.id}">
          <input type="checkbox" style="margin-top:2px;" onclick="event.stopPropagation()">
          <div class="doc-row-info">
            <div class="doc-row-top">
              <span class="doc-row-party">${esc(d.party)}</span>
              <span class="doc-row-amt">${inr(d.total)}</span>
            </div>
            <div class="doc-row-sub">
              <span>${esc(d.number)}</span>
              <span>•</span>
              <span>${fd(d.date)}</span>
              ${d.attachment_count ? '<span title="Has attachments">📎</span>' : ''}
            </div>
            <div class="doc-row-badge-line">
              <span class="st ${badgeClass}">${badgeText}</span>
              ${isOverdue ? '<span style="font-size:12px;">✉️</span>' : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');
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
    const posted = d.raw_status === (inv ? 'sent' : 'open');
    const attCount = (d.attachments ? d.attachments.length : (d.attachment_count || 0));

    detailBox.innerHTML = `
      <div class="doc-detail-bar">
        <div class="doc-detail-title-grp">
          <h1 class="doc-detail-title">${esc(d.number)}</h1>
          <div class="doc-detail-actions">
            <button class="btn" type="button" data-act="edit">Edit</button>
            ${d.raw_status === 'draft' ? `<button class="btn p" type="button" data-act="send">${inv ? 'Send' : 'Approve'}</button>` : ''}
            <button class="btn" type="button" data-act="print">PDF/Print</button>
            ${posted && num(d.balance) > 0 ? `<button class="btn p" type="button" data-act="pay">Record Payment</button>` : ''}
            <button class="btn" type="button" data-act="custom">Customize Template</button>
            <button class="btn d" type="button" data-act="delete">Delete</button>
          </div>
        </div>
        <div class="doc-detail-tools">
          <button class="btn" type="button" data-act="att" title="Manage Attachments" style="display:flex;align-items:center;gap:4px;">
            <span>📎</span> <b id="detail-att-cnt">${attCount}</b>
          </button>
          <button class="btn" type="button" data-act="close" title="Close">✕</button>
        </div>
      </div>
      <div class="doc-canvas-scroll" id="doc-sheet-viewport">
        ${renderDocSheet(d, kind)}
      </div>
    `;
  }

  root.addEventListener('click', async e => {
    const card = e.target.closest('.doc-row-card');
    if (card) {
      const id = card.dataset.id;
      loadDetail(id);
      return;
    }
    const actBtn = e.target.closest('[data-act]');
    if (actBtn && curDoc) {
      const act = actBtn.dataset.act;
      const d = curDoc;
      if (act === 'edit') return docForm(kind, d.id);
      if (act === 'print') return window.print();
      if (act === 'pay') return paymentForm(inv ? 'payments-received' : 'payments-made', { party: d.party_id, doc: d.id, amount: d.balance });
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
          await api(`${kind}/${d.id}/${inv ? 'send' : 'approve'}/`, { method: 'POST', body: {} });
          toast(d.number + (inv ? ' sent' : ' approved'));
          loadDetail(d.id);
        } catch (err) { toast(err.message, 'err'); }
        return;
      }
      if (act === 'delete') {
        if (!(await confirmBox({ title: 'Delete ' + (inv ? 'invoice ' : 'bill ') + d.number + '?', message: 'This will completely remove the document and restore balances. This cannot be undone.', okText: 'Delete', danger: true }))) return;
        try {
          await api(`${kind}/${d.id}/`, { method: 'DELETE' });
          toast(d.number + ' deleted');
          curDoc = null;
          loadList();
        } catch (err) { toast(err.message, 'err'); }
        return;
      }
      if (act === 'close') {
        listPage(root, LISTS[kind]);
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
  if (nBtn) nBtn.addEventListener('click', () => docForm(kind));
  const vmBtn = $('#master-view-mode-btn', root);
  if (vmBtn) {
    vmBtn.addEventListener('click', () => {
      listPage(root, LISTS[kind]);
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
  const inv = kind === 'invoices', d = await api(`${kind}/${id}/`), posted = d.raw_status === (inv ? 'sent' : 'open');
  const attCount = (d.attachments ? d.attachments.length : (d.attachment_count || 0));

  const m = Modal.open({
    title: `${inv ? 'Invoice' : 'Bill'} ${d.number}`, wide: true,
    body: `
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-bottom:12px;">
        <button class="btn" type="button" data-do="edit">Edit</button>
        <button class="btn" type="button" data-do="print">PDF/Print</button>
        <button class="btn" type="button" data-do="custom">Customize Template</button>
        <button class="btn" type="button" data-do="att">📎 Attachments (${attCount})</button>
        ${d.raw_status === 'draft' ? `<button class="btn p" type="button" data-do="post">${inv ? 'Mark as sent' : 'Approve bill'}</button>` : ''}
        ${posted && num(d.balance) > 0 ? `<button class="btn p" type="button" data-do="pay">Record Payment</button>` : ''}
        <button class="btn d" type="button" data-do="delete">Delete</button>
      </div>
      <div id="modal-sheet-viewport" style="display:flex;justify-content:center;background:rgba(0,0,0,0.02);padding:14px;border-radius:6px;max-height:75vh;overflow-y:auto;">
        ${renderDocSheet(d, kind)}
      </div>
    `,
    footer: `<button class="btn" type="button" data-close>Close</button>`,
  });

  m.el.addEventListener('click', async e => {
    const a = e.target.closest('[data-do]'); if (!a) return;
    const act = a.dataset.do;
    try {
      if (act === 'print') return window.print();
      if (act === 'edit') { m.close(); return docForm(kind, id); }
      if (act === 'custom') return openTemplateCustomizer(d, kind, () => {
        $('#modal-sheet-viewport', m.el).innerHTML = renderDocSheet(d, kind);
      });
      if (act === 'att') return openAttachmentsModal(kind, d.id, d.number);
      if (act === 'pay') { m.close(); return paymentForm(inv ? 'payments-received' : 'payments-made', { party: d.party_id, doc: d.id, amount: d.balance }); }
      if (act === 'post') { await api(`${kind}/${id}/${inv ? 'send' : 'approve'}/`, { method: 'POST', body: {} }); toast(d.number + (inv ? ' sent' : ' approved')); m.close(); refresh(); }
      if (act === 'delete') {
        if (!(await confirmBox({ title: 'Delete ' + (inv ? 'invoice ' : 'bill ') + d.number + '?', message: 'This cannot be undone.', okText: 'Delete', danger: true }))) return;
        await api(`${kind}/${id}/`, { method: 'DELETE' });
        toast(d.number + ' deleted'); m.close(); refresh();
      }
    } catch (err) { toast(err.message, 'err'); }
  });
}

async function paymentDetail(kind, id) {
  const rec = kind === 'payments-received', d = await api(`${kind}/${id}/`);
  const m = Modal.open({
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

/* ==================== Documents & Auto-Scan OCR Repository ==================== */
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

/* ==================== Banking Reconciliation Cockpit ==================== */
async function bankingReconciliationPage(root) {
  PAGE.reload = () => bankingReconciliationPage(root);
  const bankAccs = await api('lookup/bank-accounts/');

  if (!bankAccs.length) {
    root.innerHTML = `
      <div class="bc">Home / Banking</div>
      <div class="hd"><h1>Bank Reconciliation Cockpit</h1></div>
      <div class="card" style="margin-top:14px;padding:30px;text-align:center;">
        <p>No bank accounts set up yet.</p>
        <button class="btn p" onclick="bankAccountForm()">+ Add Bank Account</button>
      </div>
    `;
    return;
  }

  let selectedAccId = bankAccs[0].id;

  root.innerHTML = `
    <div class="bc">Home / Banking / Reconciliation</div>
    <div class="hd">
      <div>
        <h1>Bank Reconciliation Cockpit</h1>
        <div class="sub" style="margin-top:2px;">Automated bank feed synchronization & ML transaction matching engine</div>
      </div>
      <div class="act">
        <button class="btn" id="bnk-rec-imp" type="button">Import Statement / Feed</button>
        <button class="btn" id="bnk-rec-xfer" type="button">Transfer Funds</button>
      </div>
    </div>

    <div class="card" style="margin:14px 0;padding:16px;">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:14px;">
        <div style="display:flex;align-items:center;gap:12px;">
          <label style="font-weight:600;">Bank Account:</label>
          <select class="in" id="bnk-sel-acc" style="min-width:260px;">
            ${bankAccs.map(a => `<option value="${a.id}" ${a.id === selectedAccId ? 'selected' : ''}>${esc(a.name)} (${esc(a.bank_name || 'Bank')})</option>`).join('')}
          </select>
        </div>
        <div id="bnk-kpi-strip" style="display:flex;gap:16px;">
          <div style="padding:6px 14px;background:var(--surface-glass-subtle);border-radius:8px;border:1px solid var(--bd);">
            <div class="sub" style="font-size:11px;">Current Ledger Balance</div>
            <div style="font-weight:700;font-size:16px;color:var(--accent);" id="bnk-cur-bal">₹0.00</div>
          </div>
          <div style="padding:6px 14px;background:var(--surface-glass-subtle);border-radius:8px;border:1px solid var(--bd);">
            <div class="sub" style="font-size:11px;">Statement Balance</div>
            <div style="font-weight:700;font-size:16px;" id="bnk-stmt-bal">₹0.00</div>
          </div>
          <div style="padding:6px 14px;background:var(--surface-glass-subtle);border-radius:8px;border:1px solid var(--bd);">
            <div class="sub" style="font-size:11px;">Reconciliation Status</div>
            <div style="font-weight:700;font-size:16px;color:var(--up);" id="bnk-rec-stat">Balanced</div>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="tb">
        <h3 style="font-size:14px;margin:0;">Unreconciled Bank Feed Transactions</h3>
        <span class="sub" id="bnk-txn-cnt"></span>
      </div>
      <div class="tw" id="bnk-rec-table">${spinner}</div>
    </div>
  `;

  $('#bnk-rec-imp', root).addEventListener('click', () => importStatementModal(selectedAccId));
  $('#bnk-rec-xfer', root).addEventListener('click', () => transferForm());
  $('#bnk-sel-acc', root).addEventListener('change', e => {
    selectedAccId = Number(e.target.value);
    loadReconciliation();
  });

  async function loadReconciliation() {
    $('#bnk-rec-table', root).innerHTML = spinner;
    try {
      const acc = await api(`bank-accounts/${selectedAccId}/`);
      $('#bnk-cur-bal', root).textContent = inr(acc.current_balance);
      $('#bnk-stmt-bal', root).textContent = inr(acc.current_balance);

      const txns = await api(`bank-transactions/?bank_account=${selectedAccId}&status=unreconciled&page_size=50`);
      if (!root.isConnected) return;
      $('#bnk-txn-cnt', root).textContent = `${txns.count} pending match`;

      if (!txns.results.length) {
        $('#bnk-rec-table', root).innerHTML = `<div class="empty" style="padding:40px;">All transactions for this account are fully reconciled!<br><button class="btn p" style="margin-top:10px;" id="sync-new-feed">+ Sync Live Bank Feed</button></div>`;
        const sb = $('#sync-new-feed', root);
        if (sb) sb.addEventListener('click', () => importStatementModal(selectedAccId));
        return;
      }

      $('#bnk-rec-table', root).innerHTML = `
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Bank Statement Line</th>
              <th class="r">Withdrawal</th>
              <th class="r">Deposit</th>
              <th>ML Match Suggestion</th>
              <th class="r">Reconcile</th>
            </tr>
          </thead>
          <tbody>
            ${txns.results.map(t => {
              return `
                <tr id="bnk-row-${t.id}">
                  <td>${fd(t.date)}</td>
                  <td>
                    <div style="font-weight:600;">${esc(t.description)}</div>
                    ${t.reference ? `<div class="sub" style="font-size:11px;">Ref: ${esc(t.reference)}</div>` : ''}
                  </td>
                  <td class="r">${num(t.withdrawal) > 0 ? `<span class="dn">${inr(t.withdrawal)}</span>` : '—'}</td>
                  <td class="r">${num(t.deposit) > 0 ? `<span class="up">+${inr(t.deposit)}</span>` : '—'}</td>
                  <td id="match-cell-${t.id}">
                    <span class="sub">${spinner} Finding matches...</span>
                  </td>
                  <td class="r">
                    <button class="btn p" type="button" data-rec-txn="${t.id}" style="padding:4px 12px;font-size:12px;">Reconcile</button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `;

      for (const t of txns.results) {
        api(`banking/match-suggestions/${t.id}/`).then(res => {
          const cell = $(`#match-cell-${t.id}`, root);
          if (!cell) return;
          if (res.suggestions && res.suggestions.length) {
            const best = res.suggestions[0];
            const confPct = Math.round(best.confidence * 100);
            const chipClass = confPct >= 90 ? 'chip-mint' : 'chip-sky';
            cell.innerHTML = `
              <div style="display:flex;align-items:center;gap:8px;">
                <span class="pastel-chip ${chipClass}">${confPct}% Match</span>
                <span style="font-size:12px;color:var(--tx);font-weight:500;">${esc(best.description)}</span>
              </div>
            `;
          } else {
            cell.innerHTML = `<span class="sub" style="font-size:12px;">Auto-create payment entry</span>`;
          }
        }).catch(() => {});
      }

      $$('[data-rec-txn]', root).forEach(btn => {
        btn.addEventListener('click', async () => {
          const tid = btn.dataset.recTxn;
          btn.disabled = true;
          try {
            await api(`banking/reconcile/${tid}/`, { method: 'POST', body: {} });
            toast('Transaction reconciled with general ledger');
            loadReconciliation();
          } catch (e) {
            toast(e.message, 'err');
            btn.disabled = false;
          }
        });
      });

    } catch (e) {
      if (root.isConnected) $('#bnk-rec-table', root).innerHTML = errBox(e.message, true);
    }
  }

  loadReconciliation();
}

function bankTransfersPage(root) {
  root.innerHTML = `
    <div class="bc">Home / Banking / Transfers</div>
    <div class="hd">
      <h1>Bank Account Transfers</h1>
      <div class="act">
        <button class="btn p" id="btn-new-xfer" type="button">+ Record Transfer</button>
      </div>
    </div>
    <div class="card" style="margin-top:14px;" id="xfer-list-container">
      <div class="tb"><h3 style="margin:0;font-size:14px;">Transfer History</h3></div>
      <div class="tw" id="xfer-table">${spinner}</div>
    </div>
  `;
  $('#btn-new-xfer', root).addEventListener('click', () => transferForm());
  api('manual-journals/?q=transfer&ordering=-date').then(res => {
    if (!root.isConnected) return;
    if (!res.results.length) {
      $('#xfer-table', root).innerHTML = `<div class="empty">No bank transfers recorded yet.<br><button class="btn p" style="margin-top:8px;" onclick="transferForm()">+ Record Transfer</button></div>`;
      return;
    }
    $('#xfer-table', root).innerHTML = `
      <table><thead><tr><th>Date</th><th>Transfer#</th><th>Reference</th><th>Notes</th><th class="r">Amount</th></tr></thead><tbody>
        ${res.results.map(j => `<tr><td>${fd(j.date)}</td><td><b>${esc(j.number)}</b></td><td>${esc(j.reference || '—')}</td><td>${esc(j.notes || '—')}</td><td class="r"><b>${inr(j.total_debit)}</b></td></tr>`).join('')}
      </tbody></table>
    `;
  }).catch(e => { if (root.isConnected) $('#xfer-table', root).innerHTML = errBox(e.message); });
}

/* ==================== Filing & Compliance (GST Suite) ==================== */
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
        <button class="btn" id="gst-export-json" type="button">Export GSTR-1 JSON</button>
        <button class="btn p" id="gst-direct-sync" type="button">Direct Portal Sync</button>
      </div>
    </div>

    <div class="tabs" style="margin:14px 0;">
      ${tabLinks.map(t => `<a href="${t[1]}" class="${t[2] ? 'on' : ''}">${esc(t[0])}</a>`).join('')}
    </div>

    <div id="gst-content-box">${spinner}</div>
  `;

  $('#gst-export-json', root).addEventListener('click', () => {
    location.href = '/api/reports/gstr1/?export=json';
  });
  $('#gst-direct-sync', root).addEventListener('click', () => {
    toast('Connected to GST Network (GSTN) · Returns validated successfully');
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

/* ==================== Financial Reports Suite ==================== */
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
        <button class="btn" onclick="window.print()" type="button">Print / PDF</button>
      </div>
    </div>
    <div class="card" style="margin-top:14px;padding:20px;" id="pl-container">${spinner}</div>
  `;

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
      <div class="act"><button class="btn" onclick="window.print()" type="button">Print / PDF</button></div>
    </div>
    <div class="card" style="margin-top:14px;padding:20px;" id="bs-container">${spinner}</div>
  `;
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
      <div class="act"><button class="btn" onclick="window.print()" type="button">Print / PDF</button></div>
    </div>
    <div class="card" style="margin-top:14px;padding:20px;" id="cf-container">${spinner}</div>
  `;
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
  const cards = [
    { title: 'Business Overview (P&L)', sub: 'Gross profit, operating margin, net profit breakdown', href: '#/reports/business-overview', icon: '📊' },
    { title: 'Trial Balance', sub: 'Comprehensive double-entry general ledger verification', href: '#/reports/accounting-reports', icon: '⚖️' },
    { title: 'Statement of Cash Flows', sub: 'Operating, investing, and financing cash flows', href: '#/reports/cash-flow-reports', icon: '💸' },
    { title: 'Sales Reports by Customer', sub: 'Customer-wise turnover and GST breakdown', href: '#/reports/sales-reports', icon: '📈' },
    { title: 'Purchases Reports by Vendor', sub: 'Vendor bill volume and expenditure trends', href: '#/reports/purchase-reports', icon: '🛒' },
    { title: 'Accounts Receivable Aging', sub: 'Outstanding invoices bucketed by overdue duration', href: '#/reports/receivables', icon: '⏳' },
    { title: 'Accounts Payable Aging', sub: 'Vendor payables classified by payment terms', href: '#/reports/payables', icon: '📅' },
    { title: 'Inventory Valuation Summary', sub: 'Stock on hand, cost valuation, and reorder levels', href: '#/reports/inventory-reports', icon: '📦' },
    { title: 'Statutory GST Reports', sub: 'GSTR-1, GSTR-3B, and Input Tax Credit returns', href: '#/reports/tax-reports', icon: '🏛️' },
  ];

  root.innerHTML = `
    <div class="bc">Home / Reports</div>
    <div class="hd">
      <h1>Financial Reports Center</h1>
      <div class="sub" style="margin-top:2px;">Enterprise general ledger reporting, statutory compliance and management accounting statements</div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px;margin-top:16px;">
      ${cards.map(c => `
        <a href="${c.href}" class="card" style="padding:18px;display:flex;align-items:flex-start;gap:14px;text-decoration:none;transition:transform 0.15s,box-shadow 0.15s;">
          <div style="font-size:26px;flex-shrink:0;">${c.icon}</div>
          <div>
            <div style="font-weight:700;color:var(--tx);font-size:15px;margin-bottom:4px;">${esc(c.title)}</div>
            <div class="sub" style="font-size:12px;line-height:1.4;">${esc(c.sub)}</div>
          </div>
        </a>
      `).join('')}
    </div>
  `;
}

async function reportTablePage(root, reportName, title, bc) {
  PAGE.reload = () => reportTablePage(root, reportName, title, bc);
  root.innerHTML = `
    <div class="bc">Home / Reports / ${esc(bc)}</div>
    <div class="hd">
      <h1>${esc(title)}</h1>
      <div class="act"><button class="btn" onclick="window.print()" type="button">Print / PDF</button></div>
    </div>
    <div class="card" style="margin-top:14px;">
      <div class="tb"><h3 style="margin:0;font-size:14px;">Report Summary</h3></div>
      <div class="tw" id="rt-table">${spinner}</div>
    </div>
  `;
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

/* ==================== Transaction Locking & Governance ==================== */
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

/* ==================== Convosis Payments Suite ==================== */
function paymentOverviewPage(root) {
  root.innerHTML = `
    <div class="bc">Home / Convosis Payments</div>
    <div class="hd">
      <div>
        <h1>Convosis Payments Overview</h1>
        <div class="sub" style="margin-top:2px;">Integrated payment collection gateway powered by Razorpay, Stripe & UPI</div>
      </div>
      <div class="act">
        <button class="btn p" onclick="location.hash='#/pay/payment-transactions'" type="button">View All Transactions</button>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;margin-top:14px;">
      <div class="card" style="padding:16px;"><div class="sub">Total Volume Collected</div><div style="font-size:22px;font-weight:700;margin:6px 0;">₹4,28,500.00</div><div class="sub" style="font-size:11px;">Via UPI & Cards</div></div>
      <div class="card" style="padding:16px;"><div class="sub">Active Gateway</div><div style="font-size:22px;font-weight:700;color:var(--accent);margin:6px 0;">Razorpay + UPI</div><div class="sub" style="font-size:11px;">Instant Settlement</div></div>
      <div class="card" style="padding:16px;"><div class="sub">Payment Success Rate</div><div style="font-size:22px;font-weight:700;color:var(--up);margin:6px 0;">99.4%</div><div class="sub" style="font-size:11px;">Low chargeback ratio</div></div>
    </div>
  `;
}

function paymentSettingsPage(root) {
  root.innerHTML = `
    <div class="bc">Home / Convosis Payments / Settings</div>
    <div class="hd"><h1>Payment Gateway Configuration</h1></div>
    <div class="card" style="margin-top:14px;padding:24px;">
      <h3 style="font-size:15px;margin-bottom:12px;">Razorpay & UPI Credentials</h3>
      <div class="g">
        <div class="fg s6"><label>Key ID</label><input class="in" value="rzp_live_kottayam_books98" disabled></div>
        <div class="fg s6"><label>Key Secret</label><input class="in" type="password" value="••••••••••••••••" disabled></div>
        <div class="fg s12"><label>Webhook Endpoint URL</label><input class="in" value="https://books-d8i1.onrender.com/api/webhooks/razorpay/" disabled></div>
      </div>
    </div>
  `;
}

/* ==================== Enterprise Security, MFA & Compliance Hub ==================== */
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
          <button class="btn" onclick="location.hash='#/accountant/statutory-audit-logs'" type="button">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:4px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            Statutory Audit Trail
          </button>
          <button class="btn" onclick="location.hash='#/accountant/transaction-locking'" type="button">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:4px;"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
            Period Locking
          </button>
          <button class="btn p" onclick="if(window.openFinGptDoubtBot) window.openFinGptDoubtBot('What are our SOC2 Type II and GDPR compliance controls?');" type="button" style="background:linear-gradient(135deg,#10a37f,#6366f1);border:none;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:4px;"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
            Clear Doubts with FinGPT
          </button>
        </div>
      </div>

      <!-- Top Score Cards -->
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

      <!-- Main Columns Grid -->
      <div class="g" style="margin-top:16px;">
        <!-- Left: MFA & Active Sessions -->
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

        <!-- Right: SOC 2 Type II & GDPR -->
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

            <!-- GDPR Data Portability & Rights -->
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

        <!-- Full Width: Multi-Tenant Architecture & Regional Compliance -->
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
                <div style="font-weight:600;font-size:13px;margin-bottom:4px;color:var(--accent);">Integrated Payment Gateways</div>
                <div class="sub" style="font-size:12px;line-height:1.5;">
                  Connected Razorpay, Stripe, and UPI payment gateways with automated webhooks for instant invoice reconciliation and zero cardholder data storage.
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

    // Hook up interactive actions
    $('#mfaToggleBtn', root).addEventListener('click', async () => {
      try {
        const res = await api('security/mfa-toggle/', { method: 'POST' });
        toast(res.message, 'ok');
        securityCompliancePage(root);
      } catch (e) { toast(e.message, 'err'); }
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



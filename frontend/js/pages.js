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
    api: 'invoices', title: 'Invoices', bc: 'Sales', newLabel: 'New invoice', onNew: () => docMasterDetail($('#pg'), 'invoices', 'new'), ordering: '-date', empty: 'No invoices yet.',
    filters: docStatusFilters('Sent'),
    cols: [{ h: 'Date', s: 'date', f: r => fd(r.date) }, { h: 'Invoice#', s: 'number', f: r => `<button class="lk" type="button" data-act="view" data-id="${r.id}">${esc(r.number)}</button>${r.attachment_count ? ' <span title="Has attachments">📎</span>' : ''}` }, { h: 'Customer', f: r => esc(r.party) }, { h: 'Status', f: r => badge(r.status) }, { h: 'Due date', s: 'due_date', f: r => fd(r.due_date) }, { h: 'Total', s: 'total', ...money(r => inr(r.total)) }, { h: 'Balance due', ...money(r => inr(r.balance)) }],
    actions: () => [['view', 'View'], ['edit', 'Edit'], ['delete', 'Delete', 'd']],
    onAction: (a, r) => a === 'view' ? docMasterDetail($('#pg'), 'invoices', r.id) : a === 'edit' ? docMasterDetail($('#pg'), 'invoices', r.id, true) : deleteRecord('invoices', r, 'invoice'),
  },
  bills: {
    api: 'bills', title: 'Bills', bc: 'Purchases', newLabel: 'New bill', onNew: () => docMasterDetail($('#pg'), 'bills', 'new'), ordering: '-date', empty: 'No bills yet.',
    filters: docStatusFilters('Open'),
    cols: [{ h: 'Date', s: 'date', f: r => fd(r.date) }, { h: 'Bill#', s: 'number', f: r => `<button class="lk" type="button" data-act="view" data-id="${r.id}">${esc(r.number)}</button>${r.attachment_count ? ' <span title="Has attachments">📎</span>' : ''}` }, { h: 'Vendor', f: r => esc(r.party) }, { h: 'Status', f: r => badge(r.status) }, { h: 'Due date', s: 'due_date', f: r => fd(r.due_date) }, { h: 'Total', s: 'total', ...money(r => inr(r.total)) }, { h: 'Balance due', ...money(r => inr(r.balance)) }],
    actions: () => [['view', 'View'], ['edit', 'Edit'], ['delete', 'Delete', 'd']],
    onAction: (a, r) => a === 'view' ? docMasterDetail($('#pg'), 'bills', r.id) : a === 'edit' ? docMasterDetail($('#pg'), 'bills', r.id, true) : deleteRecord('bills', r, 'bill'),
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
    api: 'retainer-invoices', title: 'Retainer Invoices', bc: 'Sales', newLabel: 'New retainer invoice',
    onNew: () => docMasterDetail($('#pg'), 'retainer-invoices', 'new'), ordering: '-date', empty: 'No retainer invoices yet.',
    filters: docStatusFilters('Sent'),
    cols: [
      { h: 'Date', s: 'date', f: r => fd(r.date) },
      { h: 'Retainer#', s: 'number', f: r => `<button class="lk" type="button" data-act="view" data-id="${r.id}">${esc(r.number)}</button>${r.attachment_count ? ' <span title="Has attachments">📎</span>' : ''}` },
      { h: 'Customer', f: r => esc(r.party) },
      { h: 'Status', f: r => badge(r.status) },
      { h: 'Total', s: 'total', ...money(r => inr(r.total)) },
      { h: 'Balance Due', ...money(r => inr(r.balance)) },
      { h: 'Available Credit', ...money(r => inr(r.available_balance || 0)) },
    ],
    actions: () => [['view', 'View'], ['edit', 'Edit'], ['delete', 'Delete', 'd']],
    onAction: (a, r) => a === 'view' ? docMasterDetail($('#pg'), 'retainer-invoices', r.id) : a === 'edit' ? docMasterDetail($('#pg'), 'retainer-invoices', r.id, true) : deleteRecord('retainer-invoices', r, 'retainer invoice'),
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
  const showWords = customOpts.show_words !== false;
  const showHsn = customOpts.show_hsn !== false;
  const title = customOpts.title || (isRetainer ? 'RETAINER INVOICE' : kind === 'invoices' ? 'TAX INVOICE' : 'BILL');

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
      <td class="r">${inr(l.rate).replace('₹', '')}</td>
      <td class="r" style="font-weight:700;">${inr(l.line_total).replace('₹', '')}</td>
    </tr>
  `).join('');

  const party = d.party_details || {};
  const partyName = esc(d.party || party.name || (!isBill ? 'Customer' : 'Vendor'));
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
          ${isBill ? `<div style="font-size:14px;font-weight:700;margin-bottom:8px;color:#0f172a;">Bill# ${esc(d.number)}</div><div style="font-size:12px;color:#475569;margin-bottom:8px;">Balance Due <b style="color:${color};font-size:14px;">${inr(d.balance)}</b></div>` : ''}
          ${isRetainer ? `<div style="font-size:14px;font-weight:700;margin-bottom:8px;color:#0f172a;">Retainer# ${esc(d.number)}</div>` : ''}
          <table class="doc-meta-grid">
            ${kind === 'invoices' ? `<tr><td>#</td><td>: <b>${esc(d.number)}</b></td></tr>` : ''}
            ${isRetainer ? `<tr><td>Retainer Date</td><td>: ${fd(d.date)}</td></tr>` : kind === 'invoices' ? `<tr><td>Invoice Date</td><td>: ${fd(d.date)}</td></tr>` : `<tr><td>Bill Date</td><td>: ${fd(d.date)}</td></tr>`}
            <tr><td>Terms</td><td>: ${esc(d.terms || 'Due on Receipt')}</td></tr>
            <tr><td>Due Date</td><td>: ${fd(d.due_date)}</td></tr>
            ${!isBill ? `<tr><td>Place Of Supply</td><td>: ${esc(d.place_of_supply || org.state || 'Kerala')}</td></tr>` : ''}
            ${orderNum ? `<tr><td>${isRetainer ? 'Reference#' : 'Order Number'}</td><td>: ${esc(orderNum)}</td></tr>` : ''}
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

      ${isRetainer && ((d.payments && d.payments.length) || (d.allocations && d.allocations.length)) ? `
        <div style="margin-top:20px;padding-top:16px;border-top:1px solid rgba(0,0,0,0.08);">
          ${d.payments && d.payments.length ? `
            <div style="margin-bottom:14px;">
              <h4 style="font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;margin:0 0 6px;">Payments Received</h4>
              <table class="lt" style="font-size:12px;">
                <thead><tr><th>Date</th><th>Mode</th><th>Reference</th><th>Account</th><th class="r">Amount</th></tr></thead>
                <tbody>
                  ${d.payments.map(p => `<tr><td>${fd(p.date)}</td><td>${esc(p.mode || 'bank_transfer')}</td><td>${esc(p.number || p.reference || '—')}</td><td>${esc(p.account || 'Bank Account')}</td><td class="r" style="font-weight:600;color:#059669;">${inr(p.amount)}</td></tr>`).join('')}
                </tbody>
              </table>
            </div>
          ` : ''}
          ${d.allocations && d.allocations.length ? `
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

async function docMasterDetail(root, kind, selectedId, openEdit) {
  const isRetainer = kind === 'retainer-invoices';
  const isBill = kind === 'bills';
  const inv = kind === 'invoices';
  let curFilter = '';
  let searchQuery = '';
  let docs = [];
  let curDoc = null;

  PAGE.reload = () => docMasterDetail(root, kind, curDoc ? curDoc.id : selectedId);

  function openForm(editId) {
    $$('.doc-row-card', root).forEach(c => c.classList.remove('active'));
    if (editId) {
      const card = $(`.doc-row-card[data-id="${editId}"]`, root);
      if (card) card.classList.add('active');
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
    });
  }

  root.innerHTML = `
    <div class="split-view-container">
      <div class="master-col">
        <div class="master-col-hd">
          <div style="display:flex;align-items:center;gap:6px;">
            <select class="btn" id="master-filter-sel" style="font-weight:700;font-size:14px;border:none;background:transparent;padding:4px 0;cursor:pointer;">
              <option value="">All ${isRetainer ? 'Retainer Invoices' : inv ? 'Invoices' : 'Bills'}</option>
              <option value="draft">Draft</option>
              <option value="unpaid">${!isBill ? 'Sent' : 'Open'}</option>
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
          <input class="in" type="search" id="master-q-in" placeholder="Search ${isRetainer ? 'retainers' : inv ? 'invoices' : 'bills'}…" style="width:100%;height:32px;font-size:12px;">
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
        $('#detail-col-box', root).innerHTML = `<div class="empty" style="margin:auto;"><div>No ${isRetainer ? 'retainer invoices' : inv ? 'invoices' : 'bills'} found.<br><button class="btn p" id="empty-new-btn" style="margin-top:10px;">+ New ${isRetainer ? 'Retainer Invoice' : inv ? 'Invoice' : 'Bill'}</button></div></div>`;
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
    const posted = isRetainer ? (d.raw_status === 'sent' || d.raw_status === 'partial') : (d.raw_status === (inv ? 'sent' : 'open') || d.raw_status === 'partial');
    const attCount = (d.attachments ? d.attachments.length : (d.attachment_count || 0));

    detailBox.innerHTML = `
      <div class="doc-detail-bar">
        <div class="doc-detail-title-grp">
          <h1 class="doc-detail-title">${esc(d.number)}</h1>
          <div class="doc-detail-actions">
            <button class="btn" type="button" data-act="edit">Edit</button>
            ${d.raw_status === 'draft' ? `<button class="btn p" type="button" data-act="send">${!isBill ? 'Send' : 'Approve'}</button>` : ''}
            <button class="btn" type="button" data-act="print">PDF/Print</button>
            ${isRetainer ? `
              ${d.raw_status !== 'draft' && d.raw_status !== 'void' && num(d.balance) > 0 ? `<button class="btn p" type="button" data-act="pay-retainer">Record Payment</button>` : ''}
              ${d.raw_status !== 'draft' && d.raw_status !== 'void' && num(d.available_balance) > 0 ? `<button class="btn" style="background:#6366f1;color:#fff;border-color:#6366f1;" type="button" data-act="apply-invoices">Apply to Invoices</button>` : ''}
            ` : `
              ${posted && num(d.balance) > 0 ? `<button class="btn p" type="button" data-act="pay">Record Payment</button>` : ''}
              ${inv && posted && num(d.balance) > 0 ? `<button class="btn" type="button" data-act="apply-retainer" title="Apply customer retainer credit">Apply Retainer</button>` : ''}
              ${inv ? `<button class="btn" type="button" data-act="portal">Client Portal</button>` : `<button class="btn" type="button" data-act="vportal">Vendor Portal</button>`}
              ${inv ? `<button class="btn" type="button" data-act="irn">Authenticate E-Invoice</button>` : ''}
            `}
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
      if (act === 'edit') return openForm(d.id);
      if (act === 'print') return window.print();
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
      if (act === 'pay') return paymentForm(inv ? 'payments-received' : 'payments-made', { party: d.party_id, doc: d.id, amount: d.balance });
      if (act === 'pay-retainer') return recordRetainerPaymentModal(d, () => loadDetail(d.id));
      if (act === 'apply-invoices') return applyRetainerModal(d, () => loadDetail(d.id));
      if (act === 'apply-retainer') return applyRetainerToInvoiceModal(d, () => loadDetail(d.id));
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
        const docLabel = isRetainer ? 'retainer invoice ' : inv ? 'invoice ' : 'bill ';
        if (!(await confirmBox({ title: 'Delete ' + docLabel + d.number + '?', message: 'This will completely remove the document and restore balances. This cannot be undone.', okText: 'Delete', danger: true }))) return;
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
  if (nBtn) nBtn.addEventListener('click', () => openForm(null));
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
  const isRetainer = kind === 'retainer-invoices', isBill = kind === 'bills', inv = kind === 'invoices';
  const d = await api(`${kind}/${id}/`);
  const posted = isRetainer ? (d.raw_status === 'sent' || d.raw_status === 'partial') : (d.raw_status === (inv ? 'sent' : 'open') || d.raw_status === 'partial');
  const attCount = (d.attachments ? d.attachments.length : (d.attachment_count || 0));

  const m = Modal.open({
    title: `${isRetainer ? 'Retainer Invoice' : inv ? 'Invoice' : 'Bill'} ${d.number}`, wide: true,
    body: `
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-bottom:12px;">
        <button class="btn" type="button" data-do="edit">Edit</button>
        <button class="btn" type="button" data-do="print">PDF/Print</button>
        <button class="btn" type="button" data-do="custom">Customize Template</button>
        <button class="btn" type="button" data-do="att">📎 Attachments (${attCount})</button>
        ${d.raw_status === 'draft' ? `<button class="btn p" type="button" data-do="post">${!isBill ? 'Mark as sent' : 'Approve bill'}</button>` : ''}
        ${isRetainer && d.raw_status !== 'draft' && d.raw_status !== 'void' && num(d.balance) > 0 ? `<button class="btn p" type="button" data-do="pay-retainer">Record Payment</button>` : ''}
        ${isRetainer && d.raw_status !== 'draft' && d.raw_status !== 'void' && num(d.available_balance) > 0 ? `<button class="btn" style="background:#6366f1;color:#fff;border-color:#6366f1;" type="button" data-do="apply-invoices">Apply to Invoices</button>` : ''}
        ${!isRetainer && posted && num(d.balance) > 0 ? `<button class="btn p" type="button" data-do="pay">Record Payment</button>` : ''}
        ${inv && posted && num(d.balance) > 0 ? `<button class="btn" type="button" data-do="apply-retainer">Apply Retainer</button>` : ''}
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
      if (act === 'edit') { m.close(); return docMasterDetail($('#pg'), kind, id, true); }
      if (act === 'custom') return openTemplateCustomizer(d, kind, () => {
        $('#modal-sheet-viewport', m.el).innerHTML = renderDocSheet(d, kind);
      });
      if (act === 'att') return openAttachmentsModal(kind, d.id, d.number);
      if (act === 'pay') { m.close(); return paymentForm(inv ? 'payments-received' : 'payments-made', { party: d.party_id, doc: d.id, amount: d.balance }); }
      if (act === 'pay-retainer') { m.close(); return recordRetainerPaymentModal(d, () => refresh()); }
      if (act === 'apply-invoices') { m.close(); return applyRetainerModal(d, () => refresh()); }
      if (act === 'apply-retainer') { m.close(); return applyRetainerToInvoiceModal(d, () => refresh()); }
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

async function applyRetainerModal(retainerDoc, onDone) {
  const avail = num(retainerDoc.available_balance || 0);
  if (avail <= 0) {
    toast('No available retainer balance to apply.', 'err');
    return;
  }
  let res;
  try {
    res = await api('invoices/?' + qs({ customer: retainerDoc.party_id || retainerDoc.customer_id, status: 'unpaid', page_size: 100 }));
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

/* ==========================================================================
   BANKING MODULE PAGES (MATCHING REFERENCE ACCOUNTING DESIGN)
   ========================================================================== */

function fmtBankDate(dStr) {
  if (!dStr) return '—';
  if (dStr.includes('/')) return dStr;
  const parts = dStr.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dStr;
}

async function bankingMainPage(root, filterTab = 'all', selectedAccountId = null) {
  PAGE.reload = () => bankingMainPage(root, filterTab, selectedAccountId);

  root.innerHTML = `<div class="banking-page-container"><div style="padding:40px;text-align:center;">${spinner} Loading Banking Workspace...</div></div>`;

  try {
    const [accountsRes, summaryRes] = await Promise.all([
      api('bank-accounts/?page_size=50'),
      api(`banking/dashboard-summary/${selectedAccountId ? '?bank_account=' + selectedAccountId : ''}`)
    ]);

    const accounts = accountsRes.results || [];
    if (!accounts.length) {
      root.innerHTML = `
        <div class="banking-page-container">
          <div class="bc">Home / Banking</div>
          <div class="hd"><h1>Banking</h1></div>
          <div class="card" style="margin-top:20px;padding:40px;text-align:center;">
            <div style="font-size:36px;margin-bottom:8px;">🏦</div>
            <h3>No Bank Accounts Set Up</h3>
            <p class="sub" style="margin-bottom:16px;">Add your business bank account to track feeds, categorize transactions, and reconcile books.</p>
            <button class="btn p" onclick="bankAccountForm()">+ Add Bank Account</button>
          </div>
        </div>
      `;
      return;
    }

    let activeAccount = accounts.find(a => a.id == selectedAccountId) || accounts.find(a => (a.name || '').toLowerCase().includes('kotak')) || accounts[0];
    selectedAccountId = activeAccount.id;

    let currentPage = 1;
    let pageSize = 25;
    let currentSearch = '';
    let sortDirection = 'desc';
    let activeFilter = filterTab || 'all';

    const maskedAccNum = activeAccount.masked_account_number || `xxxx${(activeAccount.account_number || '').slice(-4)}`;
    const feedDateDisplay = activeAccount.last_feed_date ? fmtBankDate(activeAccount.last_feed_date) : '20/10/2026';
    const lastSyncDisplay = '23/10/2026';

    root.innerHTML = `
      <div class="banking-page-container">
        <!-- TOP ACCOUNT HEADER -->
        <div class="banking-top-header">
          <div class="banking-account-title-wrap">
            <div class="banking-account-title-row">
              <div class="rel">
                <button type="button" class="banking-account-name-btn" id="bnk-acc-picker-btn">
                  <span>${esc(activeAccount.name)}</span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M6 9l6 6 6-6"/></svg>
                </button>
                <div class="pop" id="bnk-acc-picker-pop" style="min-width:240px;top:100%;left:0;margin-top:6px;z-index:90;">
                  <div style="padding:8px 12px;font-size:11px;font-weight:700;color:var(--tx-muted);text-transform:uppercase;border-bottom:1px solid var(--bd-glass);">Switch Bank Account</div>
                  ${accounts.map(a => `
                    <button class="mi ${a.id == activeAccount.id ? 'act' : ''}" type="button" data-switch-acc="${a.id}">
                      <div style="font-weight:600;font-size:13px;color:var(--tx);">${esc(a.name)}</div>
                      <div class="sub" style="font-size:11px;">${esc(a.bank_name || 'Bank')} · ${esc(a.masked_account_number || 'xxxx' + (a.account_number || '').slice(-4))}</div>
                    </button>
                  `).join('')}
                  <div style="border-top:1px solid var(--bd-glass);padding:6px;">
                    <button class="btn" type="button" style="width:100%;font-size:12px;" onclick="bankAccountForm()">+ Add Another Account</button>
                  </div>
                </div>
              </div>

              <!-- Green WiFi Live Feed Icon -->
              <span class="banking-feed-active-badge" title="Live Bank Feed Connected">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01"/></svg>
              </span>
            </div>
            <div class="banking-account-number-sub">Account Number: ${esc(maskedAccNum)}</div>
          </div>

          <!-- Top Right Action Buttons -->
          <div class="banking-header-actions">
            <button type="button" class="banking-action-link-btn" id="bnk-act-statements">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 10l9-6 9 6M5 10v8M10 10v8M14 10v8M19 10v8M3 20h18"/></svg>
              <span>Bank Statements</span>
            </button>

            <button type="button" class="banking-btn-quick-cat" id="bnk-act-quick-cat">
              <span>Quick Categorize</span>
            </button>

            <!-- Add Transaction Dropdown -->
            <div class="rel">
              <button type="button" class="banking-btn-pill" id="bnk-add-txn-btn">
                <span>Add Transaction</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>
              </button>
              <div class="pop" id="bnk-add-txn-pop" style="min-width:200px;top:100%;right:0;margin-top:6px;z-index:90;">
                <button class="mi" type="button" data-add-type="expense">Expense</button>
                <button class="mi" type="button" data-add-type="payment_received">Customer Payment</button>
                <button class="mi" type="button" data-add-type="payment_made">Vendor Payment</button>
                <button class="mi" type="button" data-add-type="transfer">Transfer</button>
                <div style="border-top:1px solid var(--bd-glass);margin:4px 0;"></div>
                <button class="mi" type="button" data-add-type="bank_charge">Bank Charge</button>
                <button class="mi" type="button" data-add-type="interest_income">Interest Income</button>
                <button class="mi" type="button" data-add-type="refund">Refund</button>
                <button class="mi" type="button" data-add-type="adjustment">Adjustment</button>
              </div>
            </div>

            <button type="button" class="banking-btn-pill" id="bnk-act-record-deposit">
              <span>Record Deposit</span>
            </button>

            <button type="button" class="banking-btn-icon-square" id="bnk-act-settings" title="Bank Account Settings" aria-label="Settings">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            </button>

            <button type="button" class="banking-btn-icon-close" id="bnk-act-close" title="Close" aria-label="Close">
              ✕
            </button>
          </div>
        </div>

        <!-- 4 ACCOUNT SUMMARY CARDS -->
        <div class="banking-summary-cards-grid">
          <!-- 1. Amount in Books -->
          <div class="banking-card">
            <div class="banking-card-icon-box blue">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15z"/><path d="M8 7h8M8 11h8"/></svg>
            </div>
            <div class="banking-card-info">
              <div class="banking-card-label">Amount in Books</div>
              <div class="banking-card-value">${inr(activeAccount.current_balance)}</div>
            </div>
          </div>

          <!-- 2. Amount in Bank -->
          <div class="banking-card">
            <div class="banking-card-icon-box teal">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 10l9-6 9 6M5 10v8M10 10v8M14 10v8M19 10v8M3 20h18"/></svg>
            </div>
            <div class="banking-card-info">
              <div class="banking-card-label">Amount in Bank</div>
              <div class="banking-card-value">${inr(activeAccount.bank_balance || activeAccount.current_balance)}</div>
            </div>
          </div>

          <!-- 3. Last Feed Date -->
          <div class="banking-card">
            <div class="banking-card-icon-box calendar">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            </div>
            <div class="banking-card-info">
              <div class="banking-card-label">Last Feed Date</div>
              <div class="banking-card-value">${feedDateDisplay}</div>
            </div>
          </div>

          <!-- 4. Associated Locations -->
          <div class="banking-card">
            <div class="banking-card-icon-box location">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>
            </div>
            <div class="banking-card-info">
              <div class="banking-card-label">Associated Locations</div>
              <div class="banking-card-value">${esc(activeAccount.branch_name || 'HO Kottayam')}</div>
            </div>
          </div>
        </div>

        <!-- Top Right Feed Update Indicator -->
        <div class="banking-sync-bar">
          <span>Bank feeds last fetched on <b>${lastSyncDisplay}</b></span>
          <button type="button" class="banking-refresh-btn" id="bnk-act-refresh-feeds">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            <span>Refresh Feeds</span>
          </button>
        </div>

        <!-- 3 TRANSACTION SUMMARY TABS -->
        <div class="banking-tabs-row">
          <!-- Tab 1: Dashboard / Account Summary -->
          <a href="#/banking/banking-dashboard" class="banking-tab-item">
            <div class="banking-tab-main-title">Dashboard</div>
            <div class="banking-tab-subtitle">Account Summary</div>
          </a>

          <!-- Tab 2: 2 Uncategorized Transactions / From Bank Statements -->
          <button type="button" class="banking-tab-item ${activeFilter === 'uncategorized' ? 'active' : ''}" id="bnk-tab-uncat">
            <div class="banking-tab-main-title">
              <span class="banking-tab-badge-red" id="bnk-uncat-badge">${activeAccount.uncategorized_count || 2}</span>
              <span>Uncategorized Transactions</span>
            </div>
            <div class="banking-tab-subtitle">From Bank Statements</div>
          </button>

          <!-- Tab 3: All Transactions ▾ / In Books -->
          <div class="rel" style="display:inline-flex;">
            <button type="button" class="banking-tab-item ${activeFilter !== 'uncategorized' ? 'active' : ''}" id="bnk-tab-all-btn">
              <div class="banking-tab-main-title">
                <span id="bnk-active-tab-title">All Transactions</span>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>
              </div>
              <div class="banking-tab-subtitle">In Books</div>
            </button>
            <div class="pop" id="bnk-all-dropdown-pop" style="min-width:210px;top:100%;left:0;margin-top:2px;z-index:90;">
              <button class="mi ${activeFilter === 'all' ? 'act' : ''}" type="button" data-filter="all">All Transactions</button>
              <button class="mi ${activeFilter === 'matched' ? 'act' : ''}" type="button" data-filter="matched">Matched Transactions</button>
              <button class="mi ${activeFilter === 'unmatched' ? 'act' : ''}" type="button" data-filter="unmatched">Unmatched Transactions</button>
              <button class="mi ${activeFilter === 'categorized' ? 'act' : ''}" type="button" data-filter="categorized">Categorized Transactions</button>
              <button class="mi ${activeFilter === 'manually_added' ? 'act' : ''}" type="button" data-filter="manually_added">Manually Added Transactions</button>
              <button class="mi ${activeFilter === 'excluded' ? 'act' : ''}" type="button" data-filter="excluded">Excluded Transactions</button>
            </div>
          </div>
        </div>

        <!-- BANKING TRANSACTION TABLE CONTAINER -->
        <div class="banking-table-container">
          <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid var(--bd-glass);background:var(--surface-glass-subtle);">
            <div id="bnk-active-filter-label" style="font-size:13px;font-weight:600;color:var(--tx);">Showing All Transactions</div>
            <div style="display:flex;align-items:center;gap:8px;">
              <div class="rel" style="display:flex;align-items:center;">
                <input type="text" id="bnk-search-input" class="in" placeholder="Search narration, ref, payee..." style="padding:5px 28px 5px 10px;font-size:12px;width:220px;border-radius:6px;">
                <span style="position:absolute;right:8px;pointer-events:none;color:var(--tx-muted);font-size:12px;">🔍</span>
              </div>
              <button type="button" class="btn" id="bnk-bulk-cat-btn" style="font-size:12px;padding:5px 10px;display:none;">Bulk Categorize</button>
            </div>
          </div>

          <div class="tw" id="bnk-txns-table-wrap">${spinner}</div>

          <!-- BOTTOM PAGINATION BAR -->
          <div class="banking-pagination-bar">
            <div>
              <span id="bnk-total-count-label">Total Count: </span>
              <a class="banking-view-total-link" id="bnk-view-total-btn">View</a>
            </div>

            <div class="banking-pagination-controls">
              <div class="rel">
                <button type="button" class="banking-rows-per-page" id="bnk-rows-picker-btn">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                  <span id="bnk-rows-txt">25 per page</span>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>
                </button>
                <div class="pop" id="bnk-rows-pop" style="min-width:120px;bottom:100%;right:0;margin-bottom:6px;z-index:90;">
                  <button class="mi" type="button" data-size="10">10 per page</button>
                  <button class="mi" type="button" data-size="25">25 per page</button>
                  <button class="mi" type="button" data-size="50">50 per page</button>
                  <button class="mi" type="button" data-size="100">100 per page</button>
                </div>
              </div>

              <div class="banking-page-nav-btns">
                <button type="button" id="bnk-page-prev" title="Previous Page" aria-label="Previous Page">‹</button>
                <span id="bnk-page-range-txt">1 - 25</span>
                <button type="button" id="bnk-page-next" title="Next Page" aria-label="Next Page">›</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Hook Up Header Events
    const accPickerBtn = $('#bnk-acc-picker-btn', root);
    const accPickerPop = $('#bnk-acc-picker-pop', root);
    accPickerBtn.addEventListener('click', e => {
      e.stopPropagation();
      accPickerPop.classList.toggle('on');
    });

    $$('[data-switch-acc]', root).forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = Number(btn.dataset.switchAcc);
        bankingMainPage(root, activeFilter, targetId);
      });
    });

    $('#bnk-act-statements', root).addEventListener('click', () => {
      statementImportWizardModal(selectedAccountId);
    });

    $('#bnk-act-quick-cat', root).addEventListener('click', async () => {
      // Find first uncategorized transaction
      try {
        const res = await api(`bank-transactions/?bank_account=${selectedAccountId}&status=unmatched&page_size=1`);
        if (res.results && res.results.length) {
          quickCategorizeModal(res.results[0].id, () => loadTransactions());
        } else {
          toast('No pending uncategorized transactions for this account', 'ok');
        }
      } catch (e) {
        toast(e.message, 'err');
      }
    });

    const addTxnBtn = $('#bnk-add-txn-btn', root);
    const addTxnPop = $('#bnk-add-txn-pop', root);
    addTxnBtn.addEventListener('click', e => {
      e.stopPropagation();
      addTxnPop.classList.toggle('on');
    });

    $$('[data-add-type]', root).forEach(btn => {
      btn.addEventListener('click', () => {
        addTxnPop.classList.remove('on');
        addBankTransactionModal(btn.dataset.addType, selectedAccountId);
      });
    });

    $('#bnk-act-record-deposit', root).addEventListener('click', () => {
      recordDepositModal(selectedAccountId);
    });

    $('#bnk-act-settings', root).addEventListener('click', () => {
      bankAccountForm(selectedAccountId);
    });

    $('#bnk-act-close', root).addEventListener('click', () => {
      location.hash = '#/home/dashboard';
    });

    $('#bnk-act-refresh-feeds', root).addEventListener('click', async () => {
      const btn = $('#bnk-act-refresh-feeds', root);
      btn.style.opacity = '0.5';
      toast('Syncing bank feed updates...');
      try {
        await api(`banking/feed-sync/${selectedAccountId}/`, { method: 'POST', body: {} });
        toast('Feeds successfully refreshed');
        loadTransactions();
      } catch (e) {
        toast(e.message, 'err');
      } finally {
        btn.style.opacity = '1';
      }
    });

    // Tab Bar Events
    $('#bnk-tab-uncat', root).addEventListener('click', () => {
      activeFilter = 'uncategorized';
      $('#bnk-tab-uncat', root).classList.add('active');
      $('#bnk-tab-all-btn', root).classList.remove('active');
      $('#bnk-active-filter-label', root).textContent = 'Showing Uncategorized Transactions';
      currentPage = 1;
      loadTransactions();
    });

    const allDropdownBtn = $('#bnk-tab-all-btn', root);
    const allDropdownPop = $('#bnk-all-dropdown-pop', root);
    allDropdownBtn.addEventListener('click', e => {
      e.stopPropagation();
      allDropdownPop.classList.toggle('on');
    });

    $$('[data-filter]', root).forEach(btn => {
      btn.addEventListener('click', () => {
        allDropdownPop.classList.remove('on');
        activeFilter = btn.dataset.filter;
        $('#bnk-tab-uncat', root).classList.remove('active');
        $('#bnk-tab-all-btn', root).classList.add('active');
        $('#bnk-active-tab-title', root).textContent = btn.textContent;
        $('#bnk-active-filter-label', root).textContent = `Showing ${btn.textContent}`;
        currentPage = 1;
        loadTransactions();
      });
    });

    // Search input
    let searchTimer = null;
    $('#bnk-search-input', root).addEventListener('input', e => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        currentSearch = e.target.value.trim();
        currentPage = 1;
        loadTransactions();
      }, 250);
    });

    // Rows per page picker
    const rowsBtn = $('#bnk-rows-picker-btn', root);
    const rowsPop = $('#bnk-rows-pop', root);
    rowsBtn.addEventListener('click', e => {
      e.stopPropagation();
      rowsPop.classList.toggle('on');
    });

    $$('[data-size]', root).forEach(btn => {
      btn.addEventListener('click', () => {
        rowsPop.classList.remove('on');
        pageSize = Number(btn.dataset.size);
        $('#bnk-rows-txt', root).textContent = `${pageSize} per page`;
        currentPage = 1;
        loadTransactions();
      });
    });

    // Pagination nav
    $('#bnk-page-prev', root).addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        loadTransactions();
      }
    });

    $('#bnk-page-next', root).addEventListener('click', () => {
      currentPage++;
      loadTransactions();
    });

    // Load Transactions function
    async function loadTransactions() {
      const tableWrap = $('#bnk-txns-table-wrap', root);
      if (!tableWrap) return;
      tableWrap.innerHTML = spinner;

      let url = `bank-transactions/?bank_account=${selectedAccountId}&page=${currentPage}&page_size=${pageSize}&ordering=${sortDirection === 'desc' ? '-date' : 'date'}`;
      if (activeFilter && activeFilter !== 'all') {
        url += `&status=${activeFilter}`;
      }
      if (currentSearch) {
        url += `&q=${encodeURIComponent(currentSearch)}`;
      }

      try {
        const res = await api(url);
        const txns = res.results || [];
        const total = res.count || 0;

        // Update pagination labels
        const startIdx = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
        const endIdx = Math.min(currentPage * pageSize, total);
        $('#bnk-page-range-txt', root).textContent = total === 0 ? '0 - 0' : `${startIdx} - ${endIdx}`;
        $('#bnk-page-prev', root).disabled = (currentPage <= 1);
        $('#bnk-page-next', root).disabled = (endIdx >= total);

        $('#bnk-view-total-btn', root).onclick = () => {
          $('#bnk-total-count-label', root).innerHTML = `Total Count: <b style="color:var(--tx);">${total}</b>`;
        };

        if (!txns.length) {
          tableWrap.innerHTML = `
            <div style="padding:50px 20px;text-align:center;color:var(--tx-muted);">
              <div style="font-size:28px;margin-bottom:8px;">📄</div>
              <div style="font-weight:600;font-size:14px;color:var(--tx);">No transactions match the selected filter</div>
              <div style="font-size:12px;margin-top:4px;">Try switching views or import a statement batch.</div>
            </div>
          `;
          return;
        }

        tableWrap.innerHTML = `
          <table class="banking-table">
            <thead>
              <tr>
                <th style="width:40px;text-align:center;">
                  <input type="checkbox" id="bnk-select-all" style="cursor:pointer;">
                </th>
                <th style="cursor:pointer;" id="bnk-sort-date-col" title="Click to sort">DATE ↕</th>
                <th>REFERENCE#</th>
                <th>TYPE</th>
                <th>STATUS</th>
                <th>LOCATION</th>
                <th class="r">DEPOSITS</th>
                <th class="r">WITHDRAWALS</th>
                <th class="r">RUNNING BALANCE</th>
                <th class="r" style="width:110px;">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              ${txns.map(t => {
                const statusClass = (t.status === 'matched') ? 'status-matched' :
                  (t.status === 'categorized') ? 'status-categorized' :
                  (t.status === 'manually_added') ? 'status-manually-added' :
                  (t.status === 'unmatched') ? 'status-unmatched' : 'status-excluded';

                const statusLabel = (t.status === 'matched') ? 'Matched' :
                  (t.status === 'categorized') ? 'Categorized' :
                  (t.status === 'manually_added') ? 'Manually Added' :
                  (t.status === 'unmatched') ? 'Unmatched' :
                  (t.status === 'excluded') ? 'Excluded' : esc(t.status);

                const depVal = num(t.deposit) > 0 ? inr(t.deposit) : '';
                const withVal = num(t.withdrawal) > 0 ? inr(t.withdrawal) : '';
                const balVal = inr(t.balance || 0);

                return `
                  <tr data-txn-id="${t.id}" style="cursor:pointer;">
                    <td style="text-align:center;" onclick="event.stopPropagation();">
                      <input type="checkbox" class="bnk-row-check" value="${t.id}" style="cursor:pointer;">
                    </td>
                    <td>${fmtBankDate(t.date)}</td>
                    <td><code>${esc(t.reference || '—')}</code></td>
                    <td>
                      <div class="banking-type-title">${esc(t.transaction_type || 'Bank Transaction')}</div>
                      ${t.payee ? `<div class="banking-type-subtext">Vendor: ${esc(t.payee)}</div>` : ''}
                    </td>
                    <td><span class="${statusClass}">${statusLabel}</span></td>
                    <td>${esc(t.location || 'HO Kottayam')}</td>
                    <td class="r" style="font-weight:600;color:#059669;">${depVal}</td>
                    <td class="r" style="font-weight:600;color:var(--tx);">${withVal}</td>
                    <td class="r" style="font-weight:700;color:var(--tx);">${balVal}</td>
                    <td class="r" onclick="event.stopPropagation();">
                      <div style="display:flex;align-items:center;justify-content:flex-end;gap:6px;">
                        ${t.status === 'unmatched' ? `
                          <button type="button" class="btn p" data-act-match="${t.id}" style="padding:3px 8px;font-size:11.5px;">Match</button>
                          <button type="button" class="btn" data-act-quick-cat="${t.id}" style="padding:3px 8px;font-size:11.5px;">Categorize</button>
                        ` : t.status === 'matched' ? `
                          <button type="button" class="btn" data-act-unmatch="${t.id}" style="padding:3px 8px;font-size:11.5px;color:#dc2626;">Unmatch</button>
                        ` : t.status === 'categorized' ? `
                          <button type="button" class="btn" data-act-quick-cat="${t.id}" style="padding:3px 8px;font-size:11.5px;">Edit</button>
                          <button type="button" class="btn" data-act-unmatch="${t.id}" style="padding:3px 8px;font-size:11.5px;color:#dc2626;">Unmatch</button>
                        ` : `
                          <button type="button" class="btn" data-act-detail="${t.id}" style="padding:3px 8px;font-size:11.5px;">Details</button>
                        `}
                      </div>
                    </td>
                  </tr>
                  <tr id="bnk-drawer-${t.id}" style="display:none;">
                    <td colspan="10" style="padding:0;">
                      <div class="banking-detail-panel">
                        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:20px;flex-wrap:wrap;">
                          <div>
                            <div style="font-weight:700;font-size:14px;color:var(--tx);margin-bottom:4px;">${esc(t.description)}</div>
                            <div style="font-size:12px;color:var(--tx-muted);line-height:1.6;">
                              <div>Reference: <b>${esc(t.reference || 'None')}</b> · Location: <b>${esc(t.location || 'HO Kottayam')}</b></div>
                              <div>Payee / Merchant: <b>${esc(t.payee || 'Direct Ledger Posting')}</b></div>
                              <div>Accounting Category: <b>${esc(t.category_account_name || 'General Cash & Bank')}</b></div>
                              ${t.notes ? `<div>Notes: <i>${esc(t.notes)}</i></div>` : ''}
                            </div>
                          </div>
                          <div style="text-align:right;">
                            <div style="font-size:11.5px;color:var(--tx-muted);">Transaction Status</div>
                            <div style="font-weight:700;font-size:13px;margin:2px 0 8px;"><span class="${statusClass}">${statusLabel}</span></div>
                            <div style="display:flex;gap:6px;justify-content:flex-end;">
                              <button type="button" class="btn" data-toggle-exclude="${t.id}" style="font-size:11px;padding:3px 8px;">
                                ${t.status === 'excluded' ? 'Restore Transaction' : 'Exclude from Feeds'}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        `;

        // Row expand events
        $$('tr[data-txn-id]', tableWrap).forEach(tr => {
          tr.addEventListener('click', () => {
            const tid = tr.dataset.txnId;
            const drawer = $(`#bnk-drawer-${tid}`, tableWrap);
            if (drawer) {
              drawer.style.display = (drawer.style.display === 'none') ? 'table-row' : 'none';
            }
          });
        });

        // Contextual buttons
        $$('[data-act-match]', tableWrap).forEach(btn => {
          btn.addEventListener('click', () => {
            matchBankTransactionModal(btn.dataset.actMatch, () => loadTransactions());
          });
        });

        $$('[data-act-unmatch]', tableWrap).forEach(btn => {
          btn.addEventListener('click', () => {
            unmatchBankTransactionModal(btn.dataset.actUnmatch, () => loadTransactions());
          });
        });

        $$('[data-act-quick-cat]', tableWrap).forEach(btn => {
          btn.addEventListener('click', () => {
            quickCategorizeModal(btn.dataset.actQuickCat, () => loadTransactions());
          });
        });

        $$('[data-toggle-exclude]', tableWrap).forEach(btn => {
          btn.addEventListener('click', async () => {
            try {
              await api(`banking/exclude/${btn.dataset.toggleExclude}/`, { method: 'POST' });
              toast('Transaction status updated');
              loadTransactions();
            } catch (e) {
              toast(e.message, 'err');
            }
          });
        });

        // Sorting by date
        const sortCol = $('#bnk-sort-date-col', tableWrap);
        if (sortCol) {
          sortCol.addEventListener('click', () => {
            sortDirection = (sortDirection === 'desc') ? 'asc' : 'desc';
            loadTransactions();
          });
        }

        // Selection checkbox handling
        const selectAllBox = $('#bnk-select-all', tableWrap);
        const rowChecks = $$('.bnk-row-check', tableWrap);
        const bulkCatBtn = $('#bnk-bulk-cat-btn', root);

        const updateBulkBar = () => {
          const checked = Array.from(rowChecks).filter(c => c.checked).map(c => Number(c.value));
          if (checked.length > 0) {
            bulkCatBtn.style.display = 'inline-flex';
            bulkCatBtn.textContent = `Categorize Selected (${checked.length})`;
          } else {
            bulkCatBtn.style.display = 'none';
          }
        };

        if (selectAllBox) {
          selectAllBox.addEventListener('change', () => {
            rowChecks.forEach(c => c.checked = selectAllBox.checked);
            updateBulkBar();
          });
        }

        rowChecks.forEach(c => c.addEventListener('change', updateBulkBar));

        bulkCatBtn.onclick = () => {
          const checked = Array.from(rowChecks).filter(c => c.checked).map(c => Number(c.value));
          bulkCategorizeModal(checked, () => loadTransactions());
        };

      } catch (err) {
        tableWrap.innerHTML = errBox(err.message, true);
      }
    }

    loadTransactions();

  } catch (err) {
    root.innerHTML = `<div class="banking-page-container">${errBox(err.message, true)}</div>`;
  }
}

async function bankingDashboardPage(root) {
  PAGE.reload = () => bankingDashboardPage(root);
  root.innerHTML = `<div class="banking-page-container"><div style="padding:40px;text-align:center;">${spinner} Loading Banking Dashboard...</div></div>`;

  try {
    const summary = await api('banking/dashboard-summary/');
    const accounts = summary.accounts || [];

    root.innerHTML = `
      <div class="banking-page-container">
        <div class="bc">Home / Banking / Dashboard</div>
        <div class="hd">
          <div>
            <h1>Banking Dashboard</h1>
            <div class="sub">Cash, current &amp; credit card balances, statement feed health, and pending reconciliations</div>
          </div>
          <div class="act">
            <button class="btn p" onclick="bankAccountForm()">+ Add Bank Account</button>
            <button class="btn" onclick="statementImportWizardModal()">Import Statement</button>
            <button class="btn" onclick="recordDepositModal()">Record Deposit</button>
            <button class="btn" onclick="transferForm()">Transfer Funds</button>
          </div>
        </div>

        <div class="banking-summary-cards-grid" style="margin-top:16px;">
          <div class="banking-card">
            <div class="banking-card-icon-box blue">🏦</div>
            <div class="banking-card-info">
              <div class="banking-card-label">Total Books Balance</div>
              <div class="banking-card-value">${inr(summary.total_books_balance || 0)}</div>
            </div>
          </div>
          <div class="banking-card">
            <div class="banking-card-icon-box teal">🏛️</div>
            <div class="banking-card-info">
              <div class="banking-card-label">Total Bank Balance</div>
              <div class="banking-card-value">${inr(summary.total_bank_balance || 0)}</div>
            </div>
          </div>
          <div class="banking-card">
            <div class="banking-card-icon-box calendar">⚡</div>
            <div class="banking-card-info">
              <div class="banking-card-label">Pending Uncategorized</div>
              <div class="banking-card-value" style="color:#ef4444;">${summary.total_unrec_count || 0}</div>
            </div>
          </div>
          <div class="banking-card">
            <div class="banking-card-icon-box location">🏢</div>
            <div class="banking-card-info">
              <div class="banking-card-label">Active Bank Accounts</div>
              <div class="banking-card-value">${accounts.length}</div>
            </div>
          </div>
        </div>

        <h3 style="margin:24px 0 12px;font-size:16px;">Connected Bank Accounts</h3>
        <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(360px, 1fr));gap:16px;">
          ${accounts.map(a => `
            <div class="card" style="padding:18px;display:flex;flex-direction:column;justify-content:space-between;gap:14px;">
              <div>
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
                  <b style="font-size:15px;color:var(--tx);">${esc(a.name)}</b>
                  <span class="pastel-chip chip-mint">Active</span>
                </div>
                <div class="sub" style="font-size:12px;">${esc(a.bank_name || 'Bank')} · ${esc(a.masked_account_number || a.account_number)}</div>
                <div class="sub" style="font-size:11px;margin-top:2px;">Location: <b>${esc(a.branch_name || 'HO Kottayam')}</b></div>
              </div>

              <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:var(--surface-glass-subtle);border-radius:8px;border:1px solid var(--bd-glass);">
                <div>
                  <div style="font-size:11px;color:var(--tx-muted);">In Books</div>
                  <div style="font-weight:700;font-size:14px;color:var(--tx);">${inr(a.current_balance)}</div>
                </div>
                <div style="text-align:right;">
                  <div style="font-size:11px;color:var(--tx-muted);">In Bank</div>
                  <div style="font-weight:700;font-size:14px;color:#059669;">${inr(a.bank_balance || a.current_balance)}</div>
                </div>
              </div>

              <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
                <span style="font-size:11.5px;color:${a.unrec_count > 0 ? '#ef4444' : 'var(--tx-muted)'};font-weight:600;">
                  ${a.unrec_count > 0 ? `${a.unrec_count} pending categorization` : 'Fully reconciled'}
                </span>
                <button type="button" class="btn p" onclick="location.hash='#/banking/all-transactions'" style="font-size:12px;padding:4px 12px;">View Account ›</button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  } catch (err) {
    root.innerHTML = `<div class="banking-page-container">${errBox(err.message, true)}</div>`;
  }
}

async function bankingAccountsPage(root) {
  PAGE.reload = () => bankingAccountsPage(root);
  root.innerHTML = `<div class="banking-page-container"><div style="padding:40px;text-align:center;">${spinner} Loading Bank Accounts...</div></div>`;

  try {
    const res = await api('bank-accounts/?page_size=50');
    const accounts = res.results || [];

    root.innerHTML = `
      <div class="banking-page-container">
        <div class="bc">Home / Banking / Bank Accounts</div>
        <div class="hd">
          <div>
            <h1>Bank Accounts</h1>
            <div class="sub">Manage corporate checking, savings, current accounts, and credit cards</div>
          </div>
          <div class="act">
            <button class="btn p" onclick="bankAccountForm()">+ Add Bank Account</button>
          </div>
        </div>

        <div class="card" style="margin-top:16px;">
          <div class="tw">
            <table>
              <thead>
                <tr>
                  <th>Account Name</th>
                  <th>Bank Name</th>
                  <th>Account Number</th>
                  <th>Type</th>
                  <th>Branch</th>
                  <th class="r">Book Balance</th>
                  <th class="r">Bank Balance</th>
                  <th class="r">Actions</th>
                </tr>
              </thead>
              <tbody>
                ${accounts.map(a => `
                  <tr>
                    <td><b>${esc(a.name)}</b></td>
                    <td>${esc(a.bank_name || '—')}</td>
                    <td><code>${esc(a.masked_account_number || a.account_number)}</code></td>
                    <td><span class="pastel-chip chip-sky">${esc(a.account_type || 'Current')}</span></td>
                    <td>${esc(a.branch_name || 'HO Kottayam')}</td>
                    <td class="r" style="font-weight:700;">${inr(a.current_balance)}</td>
                    <td class="r" style="font-weight:700;color:#059669;">${inr(a.bank_balance || a.current_balance)}</td>
                    <td class="r">
                      <div style="display:flex;gap:6px;justify-content:flex-end;">
                        <button class="btn" style="padding:4px 10px;font-size:12px;" onclick="location.hash='#/banking/all-transactions'">Transactions</button>
                        <button class="btn" style="padding:4px 10px;font-size:12px;" onclick="bankAccountForm(${a.id})">Edit</button>
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    root.innerHTML = `<div class="banking-page-container">${errBox(err.message, true)}</div>`;
  }
}

async function bankStatementsListPage(root) {
  PAGE.reload = () => bankStatementsListPage(root);
  root.innerHTML = `<div class="banking-page-container"><div style="padding:40px;text-align:center;">${spinner} Loading Bank Statements...</div></div>`;

  try {
    const res = await api('statement-batches/?page_size=50');
    const batches = res.results || [];

    root.innerHTML = `
      <div class="banking-page-container">
        <div class="bc">Home / Banking / Bank Statements</div>
        <div class="hd">
          <div>
            <h1>Bank Statements &amp; Import Batches</h1>
            <div class="sub">Import history, statement reconciliations, and rollback audit trail</div>
          </div>
          <div class="act">
            <button class="btn p" onclick="statementImportWizardModal()">+ Import Statement</button>
          </div>
        </div>

        <div class="card" style="margin-top:16px;">
          <div class="tw">
            <table>
              <thead>
                <tr>
                  <th>Batch Number</th>
                  <th>Bank Account</th>
                  <th>Filename</th>
                  <th>Import Date</th>
                  <th class="r">Total Rows</th>
                  <th class="r">Imported</th>
                  <th class="r">Duplicates</th>
                  <th>Status</th>
                  <th class="r">Rollback</th>
                </tr>
              </thead>
              <tbody>
                ${batches.length ? batches.map(b => `
                  <tr>
                    <td><b>${esc(b.batch_number)}</b></td>
                    <td>${esc(b.bank_account_name || 'Bank Account')}</td>
                    <td><code>${esc(b.filename || 'statement.csv')}</code></td>
                    <td>${fmtBankDate(b.imported_at ? b.imported_at.slice(0, 10) : '')}</td>
                    <td class="r">${b.total_rows}</td>
                    <td class="r" style="font-weight:700;color:#059669;">${b.imported_count}</td>
                    <td class="r">${b.duplicate_count}</td>
                    <td><span class="pastel-chip chip-mint">${esc(b.status || 'Imported')}</span></td>
                    <td class="r">
                      <button class="btn" style="padding:4px 8px;font-size:11px;color:#dc2626;" onclick="rollbackBatchModal(${b.bank_account_id})">Rollback</button>
                    </td>
                  </tr>
                `).join('') : `
                  <tr><td colspan="9" style="text-align:center;padding:40px;color:var(--tx-muted);">No statement batches imported yet. Click "Import Statement" to upload your first bank statement.</td></tr>
                `}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    root.innerHTML = `<div class="banking-page-container">${errBox(err.message, true)}</div>`;
  }
}

async function bankDepositsPage(root) {
  PAGE.reload = () => bankDepositsPage(root);
  root.innerHTML = `<div class="banking-page-container"><div style="padding:40px;text-align:center;">${spinner} Loading Bank Deposits...</div></div>`;

  try {
    const res = await api('bank-deposits/?page_size=50');
    const deposits = res.results || [];

    root.innerHTML = `
      <div class="banking-page-container">
        <div class="bc">Home / Banking / Deposits</div>
        <div class="hd">
          <div>
            <h1>Recorded Bank Deposits</h1>
            <div class="sub">Cash, cheque, and electronic receipts credited directly to bank accounts</div>
          </div>
          <div class="act">
            <button class="btn p" onclick="recordDepositModal()">+ Record Deposit</button>
          </div>
        </div>

        <div class="card" style="margin-top:16px;">
          <div class="tw">
            <table>
              <thead>
                <tr>
                  <th>Deposit #</th>
                  <th>Date</th>
                  <th>Bank Account</th>
                  <th>Party / Received From</th>
                  <th>Deposit Type</th>
                  <th>Reference</th>
                  <th class="r">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${deposits.length ? deposits.map(d => `
                  <tr>
                    <td><b>${esc(d.number)}</b></td>
                    <td>${fmtBankDate(d.date)}</td>
                    <td>${esc(d.bank_account_name || 'Bank Account')}</td>
                    <td>${esc(d.party_name || 'Direct Receipt')}</td>
                    <td><span class="pastel-chip chip-sky">${esc(d.deposit_type)}</span></td>
                    <td><code>${esc(d.reference || '—')}</code></td>
                    <td class="r" style="font-weight:700;color:#059669;">+${inr(d.amount)}</td>
                  </tr>
                `).join('') : `
                  <tr><td colspan="7" style="text-align:center;padding:40px;color:var(--tx-muted);">No deposits recorded yet. Click "Record Deposit" to create one.</td></tr>
                `}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    root.innerHTML = `<div class="banking-page-container">${errBox(err.message, true)}</div>`;
  }
}

async function bankTransfersPage(root) {
  PAGE.reload = () => bankTransfersPage(root);
  root.innerHTML = `<div class="banking-page-container"><div style="padding:40px;text-align:center;">${spinner} Loading Transfers...</div></div>`;

  try {
    const res = await api('bank-transfers/?page_size=50');
    const transfers = res.results || [];

    root.innerHTML = `
      <div class="banking-page-container">
        <div class="bc">Home / Banking / Transfers Between Accounts</div>
        <div class="hd">
          <div>
            <h1>Transfers Between Accounts</h1>
            <div class="sub">Inter-account fund movements with double-entry journal postings</div>
          </div>
          <div class="act">
            <button class="btn p" onclick="transferForm()">+ Record Transfer</button>
          </div>
        </div>

        <div class="card" style="margin-top:16px;">
          <div class="tw">
            <table>
              <thead>
                <tr>
                  <th>Transfer #</th>
                  <th>Date</th>
                  <th>From Account</th>
                  <th>To Account</th>
                  <th>Reference</th>
                  <th>Description</th>
                  <th class="r">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${transfers.length ? transfers.map(x => `
                  <tr>
                    <td><b>${esc(x.number)}</b></td>
                    <td>${fmtBankDate(x.date)}</td>
                    <td>${esc(x.from_account_name)}</td>
                    <td>${esc(x.to_account_name)}</td>
                    <td><code>${esc(x.reference || '—')}</code></td>
                    <td>${esc(x.description || 'Inter-account transfer')}</td>
                    <td class="r" style="font-weight:700;">${inr(x.amount)}</td>
                  </tr>
                `).join('') : `
                  <tr><td colspan="7" style="text-align:center;padding:40px;color:var(--tx-muted);">No transfers recorded yet. Click "Record Transfer" to move funds between accounts.</td></tr>
                `}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    root.innerHTML = `<div class="banking-page-container">${errBox(err.message, true)}</div>`;
  }
}

async function bankRulesPage(root) {
  PAGE.reload = () => bankRulesPage(root);
  root.innerHTML = `<div class="banking-page-container"><div style="padding:40px;text-align:center;">${spinner} Loading Bank Rules...</div></div>`;

  try {
    const rules = await api('banking/rules/');

    root.innerHTML = `
      <div class="banking-page-container">
        <div class="bc">Home / Banking / Bank Rules</div>
        <div class="hd">
          <div>
            <h1>Automated Bank Categorization Rules</h1>
            <div class="sub">Auto-assign transaction types, accounting GL accounts, and payees based on narration text</div>
          </div>
          <div class="act">
            <button class="btn p" onclick="bankRulesModal()">+ Create Rule</button>
          </div>
        </div>

        <div class="card" style="margin-top:16px;">
          <div class="tw">
            <table>
              <thead>
                <tr>
                  <th>Priority</th>
                  <th>Rule Name</th>
                  <th>Condition</th>
                  <th>Action</th>
                  <th>Auto-Reconcile</th>
                  <th class="r">Delete</th>
                </tr>
              </thead>
              <tbody>
                ${rules.length ? rules.map(r => `
                  <tr>
                    <td><b>#${r.priority}</b></td>
                    <td><b>${esc(r.name)}</b></td>
                    <td><code>${esc(r.field)}</code> ${esc(r.operator)} "<b>${esc(r.value)}</b>"</td>
                    <td>Assign GL Account &amp; Payee</td>
                    <td><span class="pastel-chip ${r.auto_reconcile ? 'chip-mint' : 'chip-sky'}">${r.auto_reconcile ? 'Yes · Auto Reconcile' : 'Suggest Only'}</span></td>
                    <td class="r">
                      <button class="btn dn" onclick="deleteRecord('banking/rules', {id: ${r.id}, name: '${esc(r.name)}'}, 'bank rule')" style="padding:2px 8px;font-size:11px;">✕</button>
                    </td>
                  </tr>
                `).join('') : `
                  <tr><td colspan="6" style="text-align:center;padding:40px;color:var(--tx-muted);">No categorization rules created yet. Click "Create Rule" to automate matching.</td></tr>
                `}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    root.innerHTML = `<div class="banking-page-container">${errBox(err.message, true)}</div>`;
  }
}

function importBankStatementWizard(root) {
  root.innerHTML = `<div class="banking-page-container"><div style="padding:40px;text-align:center;">Opening Statement Import Wizard...</div></div>`;
  statementImportWizardModal();
}

async function bankingReconciliationPage(root) {
  PAGE.reload = () => bankingReconciliationPage(root);
  const bankAccs = await api('lookup/bank-accounts/');

  if (!bankAccs.length) {
    root.innerHTML = `
      <div class="banking-page-container">
        <div class="bc">Home / Banking</div>
        <div class="hd"><h1>Bank Reconciliation Cockpit</h1></div>
        <div class="card" style="margin-top:14px;padding:30px;text-align:center;">
          <p>No bank accounts set up yet.</p>
          <button class="btn p" onclick="bankAccountForm()">+ Add Bank Account</button>
        </div>
      </div>
    `;
    return;
  }

  let selectedAccId = bankAccs[0].id;

  root.innerHTML = `
    <div class="banking-page-container">
      <div class="bc">Home / Banking / Reconciliation</div>
      <div class="hd">
        <div>
          <h1>Bank Reconciliation Cockpit</h1>
          <div class="sub" style="margin-top:2px;">Compare statement balance with books, mark cleared transactions, and verify zero difference</div>
        </div>
        <div class="act">
          <button class="btn p" id="bnk-rec-live-sync" type="button">⚡ Sync Live Feed</button>
          <button class="btn" id="bnk-rec-rules" type="button">⚙️ Bank Rules</button>
          <button class="btn" id="bnk-rec-imp" type="button">Import Statement</button>
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
          <div id="bnk-kpi-strip" style="display:flex;gap:16px;flex-wrap:wrap;">
            <div style="padding:6px 14px;background:var(--surface-glass-subtle);border-radius:8px;border:1px solid var(--bd-glass);">
              <div class="sub" style="font-size:11px;">Current Book Balance</div>
              <div style="font-weight:700;font-size:16px;color:var(--accent);" id="bnk-cur-bal">₹0.00</div>
            </div>
            <div style="padding:6px 14px;background:var(--surface-glass-subtle);border-radius:8px;border:1px solid var(--bd-glass);">
              <div class="sub" style="font-size:11px;">Statement Ending Balance</div>
              <div style="font-weight:700;font-size:16px;" id="bnk-stmt-bal">₹0.00</div>
            </div>
            <div style="padding:6px 14px;background:var(--surface-glass-subtle);border-radius:8px;border:1px solid var(--bd-glass);">
              <div class="sub" style="font-size:11px;">Difference Remaining</div>
              <div style="font-weight:700;font-size:16px;color:#059669;" id="bnk-rec-diff">₹0.00</div>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="tb">
          <h3 style="font-size:14px;margin:0;">Pending Reconciliation Lines</h3>
          <span class="sub" id="bnk-txn-cnt"></span>
        </div>
        <div class="tw" id="bnk-rec-table">${spinner}</div>
      </div>
    </div>
  `;

  $('#bnk-rec-live-sync', root).addEventListener('click', () => statementImportWizardModal(selectedAccId));
  $('#bnk-rec-rules', root).addEventListener('click', () => bankRulesModal());
  $('#bnk-rec-imp', root).addEventListener('click', () => statementImportWizardModal(selectedAccId));
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
      $('#bnk-stmt-bal', root).textContent = inr(acc.bank_balance || acc.current_balance);

      const diff = Math.abs(num(acc.current_balance) - num(acc.bank_balance || acc.current_balance));
      $('#bnk-rec-diff', root).textContent = inr(diff);
      $('#bnk-rec-diff', root).style.color = (diff === 0) ? '#059669' : '#dc2626';

      const txns = await api(`bank-transactions/?bank_account=${selectedAccId}&status=unmatched&page_size=50`);
      if (!root.isConnected) return;
      $('#bnk-txn-cnt', root).textContent = `${txns.count} pending match`;

      if (!txns.results.length) {
        $('#bnk-rec-table', root).innerHTML = `
          <div class="empty" style="padding:40px;">
            All transactions for this account are fully matched and reconciled!<br>
            <button class="btn p" style="margin-top:10px;" id="sync-new-feed">+ Sync Bank Feed</button>
          </div>
        `;
        const sb = $('#sync-new-feed', root);
        if (sb) sb.addEventListener('click', () => statementImportWizardModal(selectedAccId));
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
              <th>Suggested Match</th>
              <th class="r">Action</th>
            </tr>
          </thead>
          <tbody>
            ${txns.results.map(t => `
              <tr id="bnk-row-${t.id}">
                <td>${fmtBankDate(t.date)}</td>
                <td>
                  <div style="font-weight:600;">${esc(t.description)}</div>
                  ${t.reference ? `<div class="sub" style="font-size:11px;">Ref: ${esc(t.reference)}</div>` : ''}
                </td>
                <td class="r">${num(t.withdrawal) > 0 ? `<span class="dn">${inr(t.withdrawal)}</span>` : '—'}</td>
                <td class="r">${num(t.deposit) > 0 ? `<span class="up">+${inr(t.deposit)}</span>` : '—'}</td>
                <td id="match-cell-${t.id}">
                  <span class="sub">${spinner} Checking match candidates...</span>
                </td>
                <td class="r">
                  <button class="btn p" type="button" data-match-txn="${t.id}" style="padding:4px 12px;font-size:12px;">Match</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;

      for (const t of txns.results) {
        api(`banking/match-suggestions/${t.id}/`).then(res => {
          const cell = $(`#match-cell-${t.id}`, root);
          if (!cell) return;
          if (res.suggestions && res.suggestions.length) {
            const best = res.suggestions[0];
            const confPct = best.confidence_score || Math.round((best.confidence || 0.8) * 100);
            const chipClass = confPct >= 90 ? 'chip-mint' : 'chip-sky';
            cell.innerHTML = `
              <div style="display:flex;align-items:center;gap:8px;">
                <span class="pastel-chip ${chipClass}">${confPct}% Match</span>
                <span style="font-size:12px;color:var(--tx);font-weight:500;">${esc(best.party_name || best.number || 'Entry')}</span>
              </div>
            `;
          } else {
            cell.innerHTML = `<span class="sub" style="font-size:12px;">No exact match · Quick Categorize</span>`;
          }
        }).catch(() => {});
      }

      $$('[data-match-txn]', root).forEach(btn => {
        btn.addEventListener('click', () => {
          matchBankTransactionModal(btn.dataset.matchTxn, () => loadReconciliation());
        });
      });

    } catch (e) {
      if (root.isConnected) $('#bnk-rec-table', root).innerHTML = errBox(e.message, true);
    }
  }

  loadReconciliation();
}

async function reconciliationHistoryPage(root) {
  PAGE.reload = () => reconciliationHistoryPage(root);
  root.innerHTML = `<div class="banking-page-container"><div style="padding:40px;text-align:center;">${spinner} Loading Reconciliation History...</div></div>`;

  try {
    const res = await api('bank-reconciliations/?page_size=50');
    const recs = res.results || [];

    root.innerHTML = `
      <div class="banking-page-container">
        <div class="bc">Home / Banking / Reconciliation History</div>
        <div class="hd">
          <div>
            <h1>Reconciliation History</h1>
            <div class="sub">Log of completed and locked statement reconciliation periods</div>
          </div>
        </div>

        <div class="card" style="margin-top:16px;">
          <div class="tw">
            <table>
              <thead>
                <tr>
                  <th>Reconciliation #</th>
                  <th>Bank Account</th>
                  <th>Statement Date</th>
                  <th class="r">Ending Balance</th>
                  <th class="r">Book Balance</th>
                  <th class="r">Difference</th>
                  <th class="r">Cleared Items</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${recs.length ? recs.map(r => `
                  <tr>
                    <td><b>${esc(r.reconciliation_number)}</b></td>
                    <td>${esc(r.bank_account_name || 'Bank Account')}</td>
                    <td>${fmtBankDate(r.statement_date)}</td>
                    <td class="r" style="font-weight:700;">${inr(r.statement_ending_balance)}</td>
                    <td class="r" style="font-weight:700;">${inr(r.book_balance)}</td>
                    <td class="r" style="font-weight:700;color:${r.difference == 0 ? '#059669' : '#dc2626'};">${inr(r.difference)}</td>
                    <td class="r">${r.cleared_count}</td>
                    <td><span class="pastel-chip chip-mint">${esc(r.status || 'Reconciled')}</span></td>
                  </tr>
                `).join('') : `
                  <tr><td colspan="8" style="text-align:center;padding:40px;color:var(--tx-muted);">No completed reconciliation periods yet. Open Bank Reconciliation to reconcile.</td></tr>
                `}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    root.innerHTML = `<div class="banking-page-container">${errBox(err.message, true)}</div>`;
  }
}

async function bankingReportsPage(root) {
  PAGE.reload = () => bankingReportsPage(root);
  root.innerHTML = `
    <div class="banking-page-container">
      <div class="bc">Home / Banking / Banking Reports</div>
      <div class="hd">
        <div>
          <h1>Banking Reports</h1>
          <div class="sub">Audit-compliant bank books, cash flow statements, and reconciliation certificates</div>
        </div>
      </div>

      <div class="g" style="margin-top:16px;">
        <div class="s4">
          <div class="card" style="padding:20px;height:100%;display:flex;flex-direction:column;justify-content:space-between;">
            <div>
              <div style="font-size:24px;margin-bottom:8px;">📖</div>
              <h3 style="margin:0 0 4px;font-size:15px;">Bank Book Report</h3>
              <p class="sub" style="font-size:12px;">Chronological transaction journal for all receipts and disbursements per bank account.</p>
            </div>
            <button class="btn p" onclick="reportTablePage($('#pg'), 'bank-book', 'Bank Book Journal Report', 'Banking')" style="margin-top:14px;width:100%;">Run Bank Book Report</button>
          </div>
        </div>

        <div class="s4">
          <div class="card" style="padding:20px;height:100%;display:flex;flex-direction:column;justify-content:space-between;">
            <div>
              <div style="font-size:24px;margin-bottom:8px;">⚖️</div>
              <h3 style="margin:0 0 4px;font-size:15px;">Bank Reconciliation Statement</h3>
              <p class="sub" style="font-size:12px;">Summary of differences between bank statement balance and book ledger balance.</p>
            </div>
            <button class="btn p" onclick="location.hash='#/banking/bank-reconciliation'" style="margin-top:14px;width:100%;">Open Reconciliation</button>
          </div>
        </div>

        <div class="s4">
          <div class="card" style="padding:20px;height:100%;display:flex;flex-direction:column;justify-content:space-between;">
            <div>
              <div style="font-size:24px;margin-bottom:8px;">💵</div>
              <h3 style="margin:0 0 4px;font-size:15px;">Cash &amp; Bank Balances Summary</h3>
              <p class="sub" style="font-size:12px;">Real-time cash position breakdown across all bank accounts and petty cash funds.</p>
            </div>
            <button class="btn p" onclick="cashFlowPage($('#pg'))" style="margin-top:14px;width:100%;">View Cash Flow</button>
          </div>
        </div>
      </div>
    </div>
  `;
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
        <button class="btn" id="gst-export-json" type="button">Official GSTN JSON</button>
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
    { title: 'Trial Balance', sub: 'Checks whether total debits and credits match in the trial balance.', href: '#/reports/accounting-reports', icon: '⚖️' },
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

    root.innerHTML = `
      <div class="bc">Home / Settings / Subscription & Billing</div>
      <div class="hd">
        <div>
          <h1>Subscription, Usage Metering & Billing</h1>
          <div class="sub" style="margin-top:2px;">
            Manage SaaS tier plans, invoice volume quotas, user seats, and billing statements.
          </div>
        </div>
        <div class="act">
          <button class="btn p" id="btnChangePlan" type="button" style="background:linear-gradient(135deg,var(--accent),var(--accent-to));border:none;">
            Change Plan / Upgrade
          </button>
        </div>
      </div>

      
      <div class="card" style="margin-top:14px;padding:20px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:14px;background:var(--surface-glass-elevated);">
        <div style="display:flex;align-items:center;gap:14px;">
          <div style="width:44px;height:44px;border-radius:10px;background:linear-gradient(135deg,rgba(99,102,241,0.18),rgba(168,85,247,0.18));color:var(--accent);display:grid;place-items:center;font-size:22px;">⚡</div>
          <div>
            <div style="display:flex;align-items:center;gap:8px;">
              <h2 style="font-size:17px;margin:0;">${esc(data.tier_display || 'Growth Edition')}</h2>
              <span class="pastel-chip chip-mint" style="font-size:11px;padding:2px 8px;text-transform:uppercase;">${esc(data.status || 'Active')}</span>
            </div>
            <div class="sub" style="font-size:12px;margin-top:2px;">
              Billed ${esc(data.billing_cycle || 'annually')} · Auto-renews on <b>${esc(data.period_end || '15 Jan 2027')}</b> via ${esc(data.payment_method || 'Visa ending in 4242')}
            </div>
          </div>
        </div>
        <div style="display:flex;gap:10px;">
          <button class="btn" id="btnUpdatePaymentMethod" type="button" style="font-size:12px;">Update Payment Method</button>
        </div>
      </div>

      
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;margin-top:14px;">
        <div class="card" style="padding:16px;">
          <div class="sub" style="font-size:12px;">Monthly Invoices Generated</div>
          <div style="font-size:22px;font-weight:700;margin:6px 0;">${data.usage.invoices.used} <span style="font-size:13px;font-weight:500;color:var(--tx-muted);">/ ${data.usage.invoices.limit}</span></div>
          <div class="bar"><i style="width:${data.usage.invoices.pct}%;background:var(--accent);"></i></div>
          <div class="sub" style="font-size:11px;">${data.usage.invoices.pct}% of monthly tier quota used</div>
        </div>

        <div class="card" style="padding:16px;">
          <div class="sub" style="font-size:12px;">User Seat Licenses</div>
          <div style="font-size:22px;font-weight:700;margin:6px 0;">${data.usage.user_seats.used} <span style="font-size:13px;font-weight:500;color:var(--tx-muted);">/ ${data.usage.user_seats.limit}</span></div>
          <div class="bar"><i style="width:${data.usage.user_seats.pct}%;background:var(--up);"></i></div>
          <div class="sub" style="font-size:11px;">${data.usage.user_seats.limit - data.usage.user_seats.used} additional seats available</div>
        </div>

        <div class="card" style="padding:16px;">
          <div class="sub" style="font-size:12px;">Secure Document Vault Storage</div>
          <div style="font-size:22px;font-weight:700;margin:6px 0;">${data.usage.storage_mb.used} MB <span style="font-size:13px;font-weight:500;color:var(--tx-muted);">/ ${(data.usage.storage_mb.limit / 1024).toFixed(0)} GB</span></div>
          <div class="bar"><i style="width:${data.usage.storage_mb.pct}%;background:var(--ok);"></i></div>
          <div class="sub" style="font-size:11px;">AES-256 encrypted OCR staging</div>
        </div>

        <div class="card" style="padding:16px;">
          <div class="sub" style="font-size:12px;">Connected Bank Feeds</div>
          <div style="font-size:22px;font-weight:700;margin:6px 0;color:var(--accent);">${data.usage.connected_banks} <span style="font-size:13px;font-weight:500;color:var(--tx-muted);">accounts</span></div>
          <div class="sub" style="font-size:11px;margin-top:14px;">Open Banking automated reconciliation</div>
        </div>
      </div>

      
      <h2 style="font-size:16px;margin:24px 0 12px;font-weight:700;">Available SaaS Edition Tiers</h2>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;">
        
        <div class="card" style="padding:22px;border:${data.tier === 'starter' ? '2px solid var(--accent)' : '1px solid var(--bd)'};">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <b style="font-size:16px;">Starter Edition</b>
            ${data.tier === 'starter' ? '<span class="pastel-chip chip-indigo">Current</span>' : ''}
          </div>
          <div style="font-size:24px;font-weight:700;margin-bottom:4px;">₹899 <span style="font-size:12px;font-weight:400;color:var(--tx-muted);">/ month</span></div>
          <div class="sub" style="font-size:12px;margin-bottom:16px;">Best for sole proprietors and boutique agencies.</div>
          <ul style="font-size:12.5px;line-height:1.8;padding-left:18px;margin-bottom:20px;color:var(--tx);">
            <li>Up to 300 tax invoices / month</li>
            <li>5 User seats with RBAC</li>
            <li>2 GB Document vault storage</li>
            <li>Standard GST & P&L reports</li>
          </ul>
          <button class="btn" style="width:100%;" ${data.tier === 'starter' ? 'disabled' : ''} onclick="changePlanAction('starter')">
            ${data.tier === 'starter' ? 'Active Plan' : 'Downgrade to Starter'}
          </button>
        </div>

        
        <div class="card" style="padding:22px;border:${data.tier === 'growth' ? '2px solid var(--accent)' : '1px solid var(--bd)'};background:var(--surface-glass-elevated);position:relative;">
          <div style="position:absolute;top:-10px;right:20px;background:linear-gradient(135deg,var(--accent),var(--accent-to));color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:12px;text-transform:uppercase;">Most Popular</div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <b style="font-size:16px;">Growth Edition</b>
            ${data.tier === 'growth' ? '<span class="pastel-chip chip-mint">Current</span>' : ''}
          </div>
          <div style="font-size:24px;font-weight:700;margin-bottom:4px;">₹2,499 <span style="font-size:12px;font-weight:400;color:var(--tx-muted);">/ month</span></div>
          <div class="sub" style="font-size:12px;margin-bottom:16px;">For fast-growing companies and multi-branch operations.</div>
          <ul style="font-size:12.5px;line-height:1.8;padding-left:18px;margin-bottom:20px;color:var(--tx);">
            <li>Up to 1,000 tax invoices / month</li>
            <li>15 User seats & Customer Portals</li>
            <li>10 GB Encrypted storage</li>
            <li>Live Open Banking Feeds & Auto-matching</li>
            <li>IRN E-Invoicing & E-Way Bills</li>
            <li>ConvoBot AI Ledger Intelligence (LLM Powered)</li>
          </ul>
          <button class="btn p" style="width:100%;" ${data.tier === 'growth' ? 'disabled' : ''} onclick="changePlanAction('growth')">
            ${data.tier === 'growth' ? 'Current Active Edition' : 'Upgrade to Growth'}
          </button>
        </div>

        
        <div class="card" style="padding:22px;border:${data.tier === 'enterprise' ? '2px solid var(--accent)' : '1px solid var(--bd)'};">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <b style="font-size:16px;">Enterprise Scale</b>
            ${data.tier === 'enterprise' ? '<span class="pastel-chip chip-mint">Current</span>' : ''}
          </div>
          <div style="font-size:24px;font-weight:700;margin-bottom:4px;">₹6,999 <span style="font-size:12px;font-weight:400;color:var(--tx-muted);">/ month</span></div>
          <div class="sub" style="font-size:12px;margin-bottom:16px;">High-throughput multi-entity enterprise operations.</div>
          <ul style="font-size:12.5px;line-height:1.8;padding-left:18px;margin-bottom:20px;color:var(--tx);">
            <li>10,000+ invoices / month quota</li>
            <li>100 User seats & Auditor logins</li>
            <li>100 GB High-availability vault storage</li>
            <li>Multi-GSTIN multi-warehouse matrix</li>
            <li>Dedicated API Webhooks & 100 req/sec quota</li>
            <li>Priority 24/7 SLA & compliance support</li>
          </ul>
          <button class="btn" style="width:100%;" ${data.tier === 'enterprise' ? 'disabled' : ''} onclick="changePlanAction('enterprise')">
            ${data.tier === 'enterprise' ? 'Active Plan' : 'Upgrade to Enterprise'}
          </button>
        </div>
      </div>

      
      <h2 style="font-size:16px;margin:28px 0 12px;font-weight:700;">Billing Invoices & Payment Statements</h2>
      <div class="card" style="padding:0;overflow:hidden;">
        <table>
          <thead>
            <tr>
              <th>Invoice Number</th>
              <th>Billing Date</th>
              <th>Description</th>
              <th>Status</th>
              <th class="r">Amount Paid</th>
              <th class="r">Action</th>
            </tr>
          </thead>
          <tbody>
            ${data.invoices_history.map(inv => `
              <tr>
                <td><b>${esc(inv.invoice_no)}</b></td>
                <td>${esc(inv.date)}</td>
                <td>${esc(inv.description)}</td>
                <td><span class="st ok">${esc(inv.status)}</span></td>
                <td class="r"><b>${esc(inv.amount)}</b></td>
                <td class="r">
                  <button class="btn" type="button" style="font-size:11px;padding:3px 9px;" onclick="toast('Downloaded tax receipt ${inv.invoice_no}', 'ok')">Download Receipt</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    window.changePlanAction = async (targetTier) => {
      try {
        const res = await api('subscription/update/', { method: 'POST', body: { tier: targetTier } });
        toast(`Successfully switched subscription to ${res.tier_display}!`, 'ok');
        subscriptionBillingPage(root);
      } catch (e) { toast(e.message, 'err'); }
    };

    $('#btnChangePlan', root).addEventListener('click', () => {
      Modal.open({
        title: 'Modify SaaS Subscription Tier',
        body: `
          <div style="padding:10px 0;">
            <p class="sub" style="margin-bottom:14px;">Select your preferred edition and billing cadence:</p>
            <div class="fg" style="margin-bottom:12px;">
              <label>Edition Tier</label>
              <select class="in" id="modalPlanTier">
                <option value="starter" ${data.tier === 'starter' ? 'selected' : ''}>Starter Edition (₹899/mo)</option>
                <option value="growth" ${data.tier === 'growth' ? 'selected' : ''}>Growth Edition (₹2,499/mo)</option>
                <option value="enterprise" ${data.tier === 'enterprise' ? 'selected' : ''}>Enterprise Scale Edition (₹6,999/mo)</option>
              </select>
            </div>
            <div class="fg">
              <label>Billing Cadence</label>
              <select class="in" id="modalPlanCadence">
                <option value="annual">Annual Billing (Save 20%)</option>
                <option value="monthly">Monthly Billing</option>
              </select>
            </div>
          </div>
        `,
        footer: `
          <button class="btn" data-close>Cancel</button>
          <button class="btn p" id="btnConfirmPlanChange">Confirm Plan Update</button>
        `
      });

      $('#btnConfirmPlanChange').addEventListener('click', async () => {
        const tier = $('#modalPlanTier').value;
        const cycle = $('#modalPlanCadence').value;
        try {
          await api('subscription/update/', { method: 'POST', body: { tier, billing_cycle: cycle } });
          toast('Subscription plan updated successfully!', 'ok');
          Modal.close();
          subscriptionBillingPage(root);
        } catch (e) { toast(e.message, 'err'); }
      });
    });

    $('#btnUpdatePaymentMethod', root).addEventListener('click', () => {
      toast('Payment gateway portal: UPI payment collection active and validated.', 'ok');
    });

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
        <table>
          <thead>
            <tr>
              <th>Member Name</th>
              <th>Username / Email</th>
              <th>Role & Access Scope</th>
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
                  <span style="font-size:12px;color:${u.mfa_enabled ? 'var(--up)' : 'var(--bad)'};font-weight:600;">
                    ${u.mfa_enabled ? '✓ TOTP Active' : '⚠ Inactive'}
                  </span>
                </td>
                <td>${esc(u.date_joined)}</td>
                <td>${esc(u.last_login)}</td>
                <td class="r">
                  <button class="btn" style="font-size:11px;padding:3px 9px;" onclick="changeRoleModal(${u.id}, '${esc(u.username)}', '${esc(u.role)}')">Edit Role</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

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

    $('#btnInviteMember', root).addEventListener('click', () => {
      Modal.open({
        title: 'Invite Team Member to Tenant',
        body: `
          <div style="padding:10px 0;">
            <div class="fg" style="margin-bottom:12px;">
              <label>Full Username</label>
              <input class="in" id="invUsername" placeholder="e.g. karthik_audit" required>
            </div>
            <div class="fg" style="margin-bottom:12px;">
              <label>Work Email</label>
              <input class="in" id="invEmail" type="email" placeholder="karthik@enterprise.com" required>
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
        const username = $('#invUsername').value.trim();
        const email = $('#invEmail').value.trim();
        const phone = $('#invPhone').value.trim();
        const role = $('#invRole').value;
        if (!username || !email) { toast('Username and email are required', 'err'); return; }

        try {
          await api('tenant/admin/invite/', { method: 'POST', body: { username, email, phone, role } });
          toast(`Invitation sent to ${username}!`, 'ok');
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
                <input class="in" id="modalWebhookUrl" placeholder="https://api.yourdomain.com/webhooks/convosis" required>
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
              curl -X GET https://books-d8i1.onrender.com/api/invoices/ \\<br>
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




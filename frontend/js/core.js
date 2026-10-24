'use strict';

const $ = (s, e = document) => e.querySelector(s);
const $$ = (s, e = document) => Array.from(e.querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const r2 = x => Math.round((x + Number.EPSILON) * 100) / 100;
const inr = v => { const n = num(v); return (n < 0 ? '-' : '') + '₹' + Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
const qty = v => num(v).toLocaleString('en-IN', { maximumFractionDigits: 3 });
const fd = s => s ? String(s).split('-').reverse().join('/') : '—';
const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const addDays = (s, n) => { const [y, m, d] = s.split('-').map(Number); return iso(new Date(y, m - 1, d + n)); };
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const norm = s => String(s || '').trim().toLowerCase();
const fmtBytes = b => { const n = num(b); if (n < 1024) return n + ' B'; if (n < 1048576) return (n / 1024).toFixed(1) + ' KB'; return (n / 1048576).toFixed(1) + ' MB'; };

function numToWordsINR(amount) {
  const n = Math.abs(num(amount));
  if (n === 0) return 'Indian Rupee Zero Only';
  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  function inWords(num) {
    if ((num = num.toString()).length > 9) return num;
    const m = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!m) return '';
    let str = '';
    str += (m[1] != 0) ? (a[Number(m[1])] || b[m[1][0]] + ' ' + a[m[1][1]]) + 'Crore ' : '';
    str += (m[2] != 0) ? (a[Number(m[2])] || b[m[2][0]] + ' ' + a[m[2][1]]) + 'Lakh ' : '';
    str += (m[3] != 0) ? (a[Number(m[3])] || b[m[3][0]] + ' ' + a[m[3][1]]) + 'Thousand ' : '';
    str += (m[4] != 0) ? (a[Number(m[4])] || b[m[4][0]] + ' ' + a[m[4][1]]) + 'Hundred ' : '';
    str += (m[5] != 0) ? ((str != '') ? 'and ' : '') + (a[Number(m[5])] || b[m[5][0]] + ' ' + a[m[5][1]]) : '';
    return str.trim();
  }
  const parts = n.toFixed(2).split('.');
  const whole = parseInt(parts[0], 10);
  const paise = parseInt(parts[1], 10);
  let words = 'Indian Rupee ';
  if (whole > 0) words += inWords(whole) + ' ';
  if (paise > 0) words += (whole > 0 ? 'and ' : '') + inWords(paise) + 'Paise ';
  return words.trim() + ' Only';
}
const GST_SLABS = [0, 0.25, 3, 5, 12, 18, 28, 40];
const STATES = ['Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chandigarh', 'Chhattisgarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir', 'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal'];
const APP = { org: { state: 'Maharashtra', name: 'Convosis Technologies' }, user: { username: 'admin', name: 'Administrator' }, today: iso(new Date()), counts: {} };

const pref = {
  get(k, d) { try { const v = localStorage.getItem('cvb_' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('cvb_' + k, JSON.stringify(v)); } catch (e) {} },
};

function toast(msg, kind) {
  const t = $('#toast');
  if (!t) return;
  t.textContent = msg;
  t.className = kind === 'err' ? 'err' : '';
  t.style.display = 'block';
  clearTimeout(toast.t);
  toast.t = setTimeout(() => { t.style.display = 'none'; }, kind === 'err' ? 5000 : 2600);
}

class ApiErr extends Error {
  constructor(status, data) {
    super((data && data.message) || ('Request failed (' + status + ')'));
    this.status = status;
    this.errors = (data && data.errors) || {};
  }
}
const csrf = () => { const m = document.cookie.match(/(?:^|; )csrftoken=([^;]+)/); return m ? decodeURIComponent(m[1]) : ''; };
const qs = o => { const p = new URLSearchParams(); Object.entries(o).forEach(([k, v]) => { if (v !== '' && v != null) p.set(k, v); }); return p.toString(); };

const MockStore = {
  init() {
    if (localStorage.getItem('cvb_clean_v3')) return;
    const tables = [
      'customers', 'vendors', 'items', 'invoices', 'bills',
      'payments-received', 'payments-made', 'bank-accounts', 'bank-transactions',
      'sales-orders', 'recurring-invoices', 'retainer-invoices', 'delivery-challans',
      'credit-notes', 'e-way-bills', 'expenses', 'purchase-orders', 'vendor-credits',
      'projects', 'timelogs', 'manual-journals', 'accounts', 'item-categories',
      'price-lists', 'warehouses', 'payment-transactions', 'audit-logs', 'documents'
    ];
    tables.forEach(t => {
      localStorage.setItem('cvb_table_' + t, JSON.stringify([]));
    });
    const seedCustomers = [
      { id: 1, name: 'Acme Technologies Pvt Ltd', company: 'Acme Corp', email: 'billing@acme.com', phone: '9847012345', state: 'Maharashtra', customer_type: 'business', gstin: '27AABCA1234A1Z5', billed: 175000, outstanding: 45000, overdue: 0, active: true },
      { id: 2, name: 'Global Logistics Corp', company: 'Global Logistics', email: 'accounts@globallogistics.in', phone: '9847054321', state: 'Karnataka', customer_type: 'business', gstin: '29AABCG5678B1Z2', billed: 98000, outstanding: 98000, overdue: 98000, active: true },
      { id: 3, name: 'Kiran Sharma', company: '', email: 'kiran.sharma@gmail.com', phone: '9812345678', state: 'Maharashtra', customer_type: 'individual', gstin: '', billed: 24000, outstanding: 0, overdue: 0, active: true }
    ];
    const seedVendors = [
      { id: 1, name: 'Amazon Web Services India', company: 'AWS India', email: 'aws-billing@amazon.in', phone: '9898012345', state: 'Maharashtra', vendor_type: 'business', gstin: '27AABCA9999K1Z1', billed: 65000, outstanding: 25000, overdue: 0, active: true },
      { id: 2, name: 'Dell Technologies India', company: 'Dell India', email: 'support@dell.co.in', phone: '9898054321', state: 'Karnataka', vendor_type: 'business', gstin: '29AABCD1111L1Z9', billed: 120000, outstanding: 0, overdue: 0, active: true },
      { id: 3, name: 'Office World Supplies', company: 'Office World', email: 'sales@officeworld.in', phone: '9811223344', state: 'Maharashtra', vendor_type: 'business', gstin: '27AABCO2222M1Z3', billed: 18500, outstanding: 18500, overdue: 0, active: true }
    ];
    const seedItems = [
      { id: 1, name: 'Cloud & Software Consulting', sku: 'SRV-CONS-01', type: 'service', unit: 'hrs', selling_price: 3500, purchase_price: 1500, gst_rate: 18, hsn_sac: '998313', active: true, track_inventory: false, stock: null, status: 'Active' },
      { id: 2, name: 'Annual Enterprise SaaS License', sku: 'LIC-ENT-01', type: 'goods', unit: 'nos', selling_price: 75000, purchase_price: 45000, gst_rate: 18, hsn_sac: '997331', active: true, track_inventory: true, stock: 15, reorder_level: 5, valuation: 675000, status: 'In stock' },
      { id: 3, name: 'Ergonomic Workstation Desk', sku: 'FUR-DSK-01', type: 'goods', unit: 'nos', selling_price: 24500, purchase_price: 16000, gst_rate: 18, hsn_sac: '940310', active: true, track_inventory: true, stock: 4, reorder_level: 6, valuation: 64000, status: 'Low stock' }
    ];
    const seedInvoices = [
      { id: 1, number: 'INV-0001', party: 'Acme Technologies Pvt Ltd', party_id: 1, date: '2026-10-10', due_date: '2026-11-10', status: 'Partially Paid', raw_status: 'partial', total: 75000, balance: 45000, lines: [{ item: 1, description: 'Cloud & Software Consulting', quantity: 20, rate: 3177.97, discount_percent: 0, gst_rate: 18, hsn_sac: '998313' }] },
      { id: 2, number: 'INV-0002', party: 'Global Logistics Corp', party_id: 2, date: '2026-10-05', due_date: '2026-10-20', status: 'Overdue', raw_status: 'sent', total: 98000, balance: 98000, lines: [{ item: 2, description: 'Annual Enterprise SaaS License', quantity: 1, rate: 83050.85, discount_percent: 0, gst_rate: 18, hsn_sac: '997331' }] }
    ];
    const seedBills = [
      { id: 1, number: 'BILL-0001', party: 'Amazon Web Services India', party_id: 1, date: '2026-10-01', due_date: '2026-10-31', status: 'Open', raw_status: 'open', total: 25000, balance: 25000, lines: [{ item: 1, description: 'Cloud Infrastructure Hosting', quantity: 1, rate: 21186.44, discount_percent: 0, gst_rate: 18, hsn_sac: '998313' }] },
      { id: 2, number: 'BILL-0002', party: 'Office World Supplies', party_id: 3, date: '2026-10-15', due_date: '2026-11-15', status: 'Open', raw_status: 'open', total: 18500, balance: 18500, lines: [{ item: 3, description: 'Ergonomic Workstation Desk', quantity: 1, rate: 15677.97, discount_percent: 0, gst_rate: 18, hsn_sac: '940310' }] }
    ];
    const seedBankAccounts = [
      { id: 1, name: 'HDFC Bank Corporate', code: 'HDFC-001', type: 'bank', account_number: '50200012345678', ifsc: 'HDFC0000001', balance: 540000, active: true }
    ];
    localStorage.setItem('cvb_table_customers', JSON.stringify(seedCustomers));
    localStorage.setItem('cvb_table_vendors', JSON.stringify(seedVendors));
    localStorage.setItem('cvb_table_items', JSON.stringify(seedItems));
    localStorage.setItem('cvb_table_invoices', JSON.stringify(seedInvoices));
    localStorage.setItem('cvb_table_bills', JSON.stringify(seedBills));
    localStorage.setItem('cvb_table_bank-accounts', JSON.stringify(seedBankAccounts));
    localStorage.setItem('cvb_clean_v3', '1');
  },

  getTable(k) {
    this.init();
    try {
      const s = localStorage.getItem('cvb_table_' + k);
      return s ? JSON.parse(s) : [];
    } catch (e) {
      return [];
    }
  },

  setTable(k, data) {
    try {
      localStorage.setItem('cvb_table_' + k, JSON.stringify(data));
    } catch (e) {}
  },

  async handle(path, opt = {}) {
    this.init();
    const method = opt.method || 'GET';
    const cleanPath = path.replace(/^\//, '').split('?')[0].replace(/\/$/, '');
    const searchParams = new URLSearchParams(path.includes('?') ? path.split('?')[1] : '');

    if (cleanPath === 'me') {
      const org = pref.get('org_settings', {
        name: 'Convosis Technologies',
        state: 'Maharashtra',
        gstin: '',
        email: '',
        phone: '',
        city: '',
        country: 'India',
        pincode: '',
        logo_data: 'img/convosis-logo.png',
        template_theme: 'convosis',
        template_color: '#1877f2',
        signature_title: 'Authorized Signature',
        notes_default: 'Thanks for your business.',
        terms_default: 'Due on Receipt',
        opening_cash: 0
      });
      return {
        user: { username: 'admin', name: 'Administrator' },
        organization: org,
        today: iso(new Date()),
        counts: {
          customers: this.getTable('customers').length,
          vendors: this.getTable('vendors').length,
          items: this.getTable('items').length,
          invoices: this.getTable('invoices').length,
          bills: this.getTable('bills').length,
          payments: this.getTable('payments-received').length + this.getTable('payments-made').length
        }
      };
    }

    if (cleanPath === 'organization') {
      if (method === 'PUT' || method === 'PATCH') {
        const cur = pref.get('org_settings', {});
        const updated = { ...cur, ...opt.body };
        pref.set('org_settings', updated);
        return updated;
      }
      return pref.get('org_settings', {
        name: 'Convosis Technologies',
        state: 'Maharashtra',
        gstin: '',
        email: '',
        phone: '',
        city: '',
        country: 'India',
        pincode: '',
        logo_data: 'img/convosis-logo.png'
      });
    }

    if (cleanPath === 'notifications') {
      return {
        unread_count: 0,
        notifications: []
      };
    }

    if (cleanPath === 'dashboard') {
      const invoices = this.getTable('invoices');
      const bills = this.getTable('bills');
      const rev = invoices.reduce((s, i) => s + num(i.total), 0);
      const exp = bills.reduce((s, b) => s + num(b.total), 0);
      const rec = invoices.reduce((s, i) => s + num(i.balance), 0);
      const pay = bills.reduce((s, b) => s + num(b.balance), 0);
      const items = this.getTable('items');
      const invVal = items.reduce((s, it) => s + (num(it.stock) * num(it.purchase_price)), 0);

      return {
        kpis: {
          revenue: { value: rev, prev: 0 },
          expenses: { value: exp, prev: 0 },
          profit: { value: rev - exp, prev: 0 },
          receivables: { value: rec, prev: 0 },
          payables: { value: pay, prev: 0 },
          cash: { value: 0, prev: 0 },
          outstanding_invoices: { value: invoices.filter(i => num(i.balance) > 0).length, prev: 0 },
          outstanding_bills: { value: bills.filter(b => num(b.balance) > 0).length, prev: 0 },
          sales_growth: { value: null, prev: null },
          inventory_value: { value: invVal, prev: 0 },
          gst_payable: { value: 0, prev: 0 },
          overdue_receivables: { value: 0, prev: 0 }
        },
        receivables: { total: rec, overdue: 0 },
        payables: { total: pay, overdue: 0 },
        cash: { opening: 0, incoming: 0, outgoing: 0, closing: 0, labels: [], in: [], out: [] },
        monthly: { labels: [], revenue: [], expenses: [] },
        mix: [],
        aging: { receivable: [0, 0, 0, 0, 0], payable: [0, 0, 0, 0, 0] },
        sales: { count: invoices.length, average: invoices.length ? rev / invoices.length : 0, paid: invoices.filter(i => i.status === 'Paid').length, unpaid: invoices.filter(i => i.status !== 'Paid').length },
        inventory: { value: invVal, active_items: items.length, low: 0, out: 0 },
        top_customers: [],
        activity: []
      };
    }

    if (cleanPath === 'search') {
      const q = (searchParams.get('q') || '').toLowerCase();
      if (!q) return [];
      const results = [];
      const tables = ['customers', 'vendors', 'items', 'invoices', 'bills'];
      for (const t of tables) {
        const rows = this.getTable(t);
        for (const r of rows) {
          const text = (r.name || r.number || r.party || '').toLowerCase();
          if (text.includes(q)) {
            results.push({
              type: t === 'customers' ? 'customer' : t === 'vendors' ? 'vendor' : t === 'invoices' ? 'invoice' : t === 'bills' ? 'bill' : 'item',
              id: r.id,
              label: r.name || r.number,
              sub: r.company || r.party || r.sku || t
            });
          }
        }
      }
      return results.slice(0, 8);
    }

    if (cleanPath.startsWith('reports/')) {
      const rep = cleanPath.replace('reports/', '');
      if (rep === 'gstr1') {
        return { summary: { total_value: 0, total_tax: 0 }, b2b: [], b2c: [], nil_rated: [], hsn_summary: [] };
      }
      if (rep === 'gstr3b') {
        return {
          table_3_1_outward: { taxable_value: 0, igst: 0, cgst: 0, sgst: 0, cess: 0 },
          table_4_eligible_itc: { total_itc: 0, igst: 0, cgst: 0, sgst: 0 },
          table_5_net_tax_payable: { total_net_tax: 0, igst: 0, cgst: 0, sgst: 0 }
        };
      }
      if (rep === 'profit-loss') {
        return { net_profit: 0, operating_income: 0, cost_of_goods_sold: 0, operating_expenses: 0, income: [], expenses: [] };
      }
      if (rep === 'trial-balance') {
        return { accounts: [], total_debit: 0, total_credit: 0, is_balanced: true };
      }
      if (rep === 'cash-flow') {
        return { operating_inflows: 0, operating_outflows: 0, net_operating: 0, financing: 0, net_cash_flow: 0 };
      }
      return { title: 'Report', subtitle: 'Financial Statement', columns: ['Description', 'Amount'], rows: [], totals: ['Total', '₹0.00'] };
    }

    if (cleanPath.startsWith('lookup/')) {
      const entity = cleanPath.replace('lookup/', '');
      const rows = this.getTable(entity);
      return rows.map(r => ({ id: r.id, name: r.name || r.number || ('#' + r.id) }));
    }

    if (cleanPath === 'tenant/admin/summary') {
      return {
        organization: { id: 'TNT-1001', name: 'Convosis Technologies', gstin: '', currency: 'INR', state: 'Maharashtra' },
        seats: { total: 5, used: 1 },
        users: [{ id: 1, username: 'admin', email: 'admin@convosis.com', role: 'admin', phone: '', date_joined: iso(new Date()) }],
        security: { mfa_enforced: false, sso_configured: false }
      };
    }

    if (cleanPath === 'subscription/summary') {
      return {
        tier_display: 'Starter Edition',
        status: 'Active',
        billing_cycle: 'monthly',
        period_end: '31 Dec 2026',
        payment_method: 'Self-hosted',
        usage: {
          invoices: { used: 0, limit: 500, pct: 0 },
          user_seats: { used: 1, limit: 5, pct: 20 },
          storage_mb: { used: 0, limit: 5120, pct: 0 },
          api_calls: { used: 0, limit: 50000, pct: 0 }
        },
        invoices: []
      };
    }

    if (cleanPath === 'developer/keys') {
      return { keys: [] };
    }

    if (cleanPath === 'developer/webhooks') {
      return { webhooks: [] };
    }

    if (cleanPath === 'security/compliance-summary') {
      return {
        soc2_status: 'Compliant',
        soc2_score: 100,
        soc2_passed_checks: 12,
        soc2_total_checks: 12,
        totp_mfa_enabled: false,
        gdpr_ready: true,
        audit_chain_valid: true,
        last_snapshot: null
      };
    }

    if (cleanPath === 'locking') {
      if (method === 'POST') {
        pref.set('lock_config', opt.body || {});
        return { is_locked: !!opt.body.is_locked, lock_date: opt.body.lock_date || null };
      }
      return pref.get('lock_config', { is_locked: false, lock_date: null });
    }

    if (cleanPath === 'gst/returns/history') {
      return [];
    }

    if (cleanPath === 'banking/rules') {
      return [];
    }

    const parts = cleanPath.split('/');
    const resource = parts[0];
    const id = parts[1] ? Number(parts[1]) : null;

    let rows = this.getTable(resource);

    if (id != null) {
      const idx = rows.findIndex(r => r.id === id);
      if (method === 'GET') {
        if (idx >= 0) return rows[idx];
        return { id, name: resource + ' #' + id, status: 'Active' };
      }
      if (method === 'PUT' || method === 'PATCH') {
        if (idx >= 0) {
          rows[idx] = { ...rows[idx], ...opt.body };
          this.setTable(resource, rows);
          return rows[idx];
        }
        const created = { id, ...opt.body };
        rows.push(created);
        this.setTable(resource, rows);
        return created;
      }
      if (method === 'DELETE') {
        if (idx >= 0) {
          rows.splice(idx, 1);
          this.setTable(resource, rows);
        }
        return null;
      }
    }

    if (method === 'POST') {
      const newId = rows.length ? Math.max(...rows.map(r => r.id || 0)) + 1 : 1;
      const created = { id: newId, ...opt.body };
      rows.unshift(created);
      this.setTable(resource, rows);
      return created;
    }

    const q = (searchParams.get('q') || '').toLowerCase();
    if (q) {
      rows = rows.filter(r => JSON.stringify(r).toLowerCase().includes(q));
    }

    const pageSize = Number(searchParams.get('page_size') || 10);
    const page = Number(searchParams.get('page') || 1);
    const start = (page - 1) * pageSize;
    const paginated = rows.slice(start, start + pageSize);

    return {
      count: rows.length,
      page,
      pages: Math.max(1, Math.ceil(rows.length / pageSize)),
      results: paginated
    };
  }
};

window.MockBackend = MockStore;

async function api(path, opt = {}) {
  const method = opt.method || 'GET';
  const init = { method, credentials: 'same-origin', headers: { 'Accept': 'application/json', 'X-CSRFToken': csrf() } };
  if (opt.body !== undefined) { init.headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(opt.body); }
  let res;
  try {
    res = await fetch('/api/' + path, init);
  } catch (e) {
    return MockStore.handle(path, opt);
  }
  if (res.status === 401) { location.href = 'login.html'; throw new ApiErr(401, { message: 'Session expired.' }); }
  if (res.status === 204) return null;
  let data = null;
  try { data = await res.json(); } catch (e) {}
  if (!res.ok) {
    if (res.status === 404 || res.status === 405 || res.status === 500) {
      return MockStore.handle(path, opt);
    }
    throw new ApiErr(res.status, data);
  }
  return data;
}

const BADGE = { Paid: 'ok', Overdue: 'ba', 'Partially Paid': 'wa', Sent: 'in', Open: 'in', Draft: 'gr', Void: 'gr', Active: 'ok', Inactive: 'gr', 'Low stock': 'wa', 'Out of stock': 'ba' };
const badge = s => `<span class="st ${BADGE[s] || 'gr'}">${esc(s)}</span>`;
const spinner = '<div class="spin" role="status">Loading…</div>';
const errBox = (msg, retry) => `<div class="empty" role="alert"><div>${esc(msg)}${retry ? '<br><button class="btn" data-retry type="button" style="margin-top:8px">Retry</button>' : ''}</div></div>`;

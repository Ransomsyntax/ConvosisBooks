'use strict';

const IC = { home: 'M3 11l9-8 9 8v10h-6v-6H9v6H3z', items: 'M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10', inventory: 'M4 4h16v6H4zM4 14h16v6H4z', sales: 'M3 4h3l2 11h10l2-8H7', purchases: 'M5 8h14l-1 12H6zM9 8V6a3 3 0 016 0v2', time: 'M12 7v5l3 2M12 3a9 9 0 100 18 9 9 0 000-18', banking: 'M3 10l9-6 9 6M5 10v8M10 10v8M14 10v8M19 10v8M3 20h18', filing: 'M6 3h9l4 4v14H6zM9 12h7M9 16h7', accountant: 'M12 4a3 3 0 100 6 3 3 0 000-6M5 20c0-4 3-6 7-6s7 2 7 6', reports: 'M5 20V10M12 20V4M19 20v-7', documents: 'M3 6h7l2 2h9v11H3z', pay: 'M3 7h18v10H3zM3 11h18' };
const NAV = [
  ['Home', 'home', ['Dashboard', 'Getting Started', 'Recent Updates']],
  ['Items', 'items', ['Items', 'Item Categories', 'Price Lists']],
  ['Inventory', 'inventory', ['Inventory Summary', 'Stock Adjustments', 'Stock Movement', 'Warehouses']],
  ['Sales', 'sales', ['Customers', 'Sales Orders', 'Invoices', 'Recurring Invoices', 'Retainer Invoices', 'Delivery Challans', 'Payments Received', 'Credit Notes', 'E-Way Bills']],
  ['Purchases', 'purchases', ['Vendors', 'Expenses', 'Purchase Orders', 'Bills', 'Payments Made', 'Vendor Credits']],
  ['Time Tracking', 'time', ['Projects', 'Timesheets']],
  ['Banking', 'banking', ['Bank Accounts', 'Transactions', 'Bank Reconciliation', 'Transfers']],
  ['Filing & Compliance', 'filing', ['GST Filing', 'GSTR-1 Summary', 'GSTR-3B Summary', 'Input Tax Credit Summary', 'Tax Liability Summary']],
  ['Accountant', 'accountant', ['Manual Journals', 'Chart of Accounts', 'Transaction Locking', 'Statutory Audit Logs', 'Tenant Administration', 'Security & Compliance']],
  ['Reports', 'reports', ['Reports Center', 'Business Overview', 'Sales Reports', 'Purchase Reports', 'Inventory Reports', 'Receivables', 'Payables', 'Tax Reports', 'Accounting Reports', 'Cash Flow Reports']],
  ['Documents', 'documents', ['All Documents', 'Files', 'Bank Statements', 'Folders', 'Trash']],
  ['Convosis Payments', 'pay', ['Payment Overview', 'Payment Transactions', 'Payment Settings']],
];
const DEFAULT_ROUTES = {
  home: 'home/dashboard',
  items: 'items/items',
  inventory: 'inventory/inventory-summary',
  sales: 'sales/invoices',
  purchases: 'purchases/bills',
  time: 'time/projects',
  banking: 'banking/bank-accounts',
  filing: 'filing/gst-filing',
  accountant: 'accountant/manual-journals',
  reports: 'reports/reports-center',
  documents: 'documents/all-documents',
  pay: 'pay/payment-overview',
};
const ROUTES = {
  'home': r => renderDashboard(r),
  'home/dashboard': r => renderDashboard(r),
  'home/getting-started': gettingStarted,
  'home/recent-updates': recentUpdates,

  'items': r => listPage(r, LISTS.items),
  'items/items': r => listPage(r, LISTS.items),
  'items/items-services': r => listPage(r, LISTS.items),
  'items/item-categories': r => listPage(r, LISTS['item-categories']),
  'items/price-lists': r => listPage(r, LISTS['price-lists']),

  'inventory': r => listPage(r, LISTS.inventory),
  'inventory/inventory-summary': r => listPage(r, LISTS.inventory),
  'inventory/stock-adjustments': r => listPage(r, LISTS.adjustments),
  'inventory/stock-movement': r => listPage(r, LISTS.movements),
  'inventory/warehouses': r => listPage(r, LISTS.warehouses),

  'sales': r => docMasterDetail(r, 'invoices'),
  'sales/customers': r => listPage(r, LISTS.customers),
  'sales/sales-orders': r => listPage(r, LISTS['sales-orders']),
  'sales/invoices': r => docMasterDetail(r, 'invoices'),
  'sales/recurring-invoices': r => listPage(r, LISTS['recurring-invoices']),
  'sales/retainer-invoices': r => docMasterDetail(r, 'retainer-invoices'),
  'sales/delivery-challans': r => listPage(r, LISTS['delivery-challans']),
  'sales/payments-received': r => listPage(r, LISTS['payments-received']),
  'sales/credit-notes': r => listPage(r, LISTS['credit-notes']),
  'sales/e-way-bills': r => listPage(r, LISTS['e-way-bills']),

  'purchases': r => docMasterDetail(r, 'bills'),
  'purchases/vendors': r => listPage(r, LISTS.vendors),
  'purchases/expenses': r => listPage(r, LISTS.expenses),
  'purchases/purchase-orders': r => listPage(r, LISTS['purchase-orders']),
  'purchases/bills': r => docMasterDetail(r, 'bills'),
  'purchases/payments-made': r => listPage(r, LISTS['payments-made']),
  'purchases/vendor-credits': r => listPage(r, LISTS['vendor-credits']),

  'time': r => listPage(r, LISTS.projects),
  'time/projects': r => listPage(r, LISTS.projects),
  'time/timesheets': r => listPage(r, LISTS.timesheets),

  'banking': r => listPage(r, LISTS['bank-accounts']),
  'banking/bank-accounts': r => listPage(r, LISTS['bank-accounts']),
  'banking/transactions': r => listPage(r, LISTS['bank-transactions']),
  'banking/bank-reconciliation': r => bankingReconciliationPage(r),
  'banking/transfers': r => bankTransfersPage(r),

  'filing': r => gstFilingPage(r, 'overview'),
  'filing/gst-filing': r => gstFilingPage(r, 'overview'),
  'filing/gstr-1-summary': r => gstFilingPage(r, 'gstr1'),
  'filing/gstr-3b-summary': r => gstFilingPage(r, 'gstr3b'),
  'filing/input-tax-credit-summary': r => gstFilingPage(r, 'itc'),
  'filing/tax-liability-summary': r => gstFilingPage(r, 'tax'),

  'accountant': r => listPage(r, LISTS['manual-journals']),
  'accountant/manual-journals': r => listPage(r, LISTS['manual-journals']),
  'accountant/chart-of-accounts': r => listPage(r, LISTS.accounts),
  'accountant/transaction-locking': r => transactionLockingPage(r),
  'accountant/statutory-audit-logs': r => listPage(r, LISTS['audit-logs']),
  'accountant/tenant-admin': r => tenantAdminPage(r),
  'accountant/tenant-administration': r => tenantAdminPage(r),
  'accountant/security-compliance': r => securityCompliancePage(r),

  'settings/subscription-billing': r => subscriptionBillingPage(r),
  'settings/tenant-admin': r => tenantAdminPage(r),
  'developer/platform': r => developerPlatformPage(r),

  'reports': r => reportsCenterPage(r),
  'reports/reports-center': r => reportsCenterPage(r),
  'reports/business-overview': r => profitAndLossPage(r),
  'reports/sales-reports': r => reportTablePage(r, 'sales-by-customer', 'Sales By Customer Report', 'Sales'),
  'reports/purchase-reports': r => reportTablePage(r, 'purchases-by-vendor', 'Purchases By Vendor Report', 'Purchases'),
  'reports/inventory-reports': r => reportTablePage(r, 'inventory-summary', 'Inventory Valuation Summary', 'Inventory'),
  'reports/receivables': r => reportTablePage(r, 'receivables-aging', 'Accounts Receivable Aging Summary', 'Receivables'),
  'reports/payables': r => reportTablePage(r, 'payables-aging', 'Accounts Payable Aging Summary', 'Payables'),
  'reports/tax-reports': r => gstFilingPage(r, 'overview'),
  'reports/accounting-reports': r => trialBalancePage(r),
  'reports/cash-flow-reports': r => cashFlowPage(r),

  'documents': r => documentsPage(r, 'all'),
  'documents/all-documents': r => documentsPage(r, 'all'),
  'documents/files': r => documentsPage(r, 'files'),
  'documents/bank-statements': r => documentsPage(r, 'bank_statement'),
  'documents/folders': r => documentsPage(r, 'folders'),
  'documents/trash': r => documentsPage(r, 'trash'),

  'pay': r => paymentOverviewPage(r),
  'pay/payment-overview': r => paymentOverviewPage(r),
  'pay/payment-transactions': r => listPage(r, LISTS['payment-transactions']),
  'pay/payment-settings': r => paymentSettingsPage(r),
};
const PASTEL = {
  home: 'icon-sky',
  items: 'icon-indigo',
  inventory: 'icon-peach',
  sales: 'icon-sky',
  purchases: 'icon-peach',
  time: 'icon-mint',
  banking: 'icon-mint',
  filing: 'icon-lavender',
  accountant: 'icon-indigo',
  reports: 'icon-lavender',
  documents: 'icon-sky',
  pay: 'icon-rose'
};
let openG = pref.get('open', ['home']);

const NAV_NEW_ACTIONS = {
  'items/items': () => itemForm(),
  'items/item-categories': () => (typeof categoryModal === 'function' ? categoryModal() : null),
  'items/price-lists': () => (typeof priceListModal === 'function' ? priceListModal() : null),

  'inventory/stock-adjustments': () => adjustForm(),
  'inventory/warehouses': () => (typeof warehouseModal === 'function' ? warehouseModal() : null),

  'sales/customers': () => partyForm('customers'),
  'sales/sales-orders': () => docForm('invoices'),
  'sales/invoices': () => { location.hash = '#/sales/invoices'; docMasterDetail($('#pg'), 'invoices', 'new'); },
  'sales/recurring-invoices': () => (typeof recurringInvoiceModal === 'function' ? recurringInvoiceModal() : null),
  'sales/retainer-invoices': () => { location.hash = '#/sales/retainer-invoices'; docMasterDetail($('#pg'), 'retainer-invoices', 'new'); },
  'sales/delivery-challans': () => (typeof challanModal === 'function' ? challanModal() : null),
  'sales/payments-received': () => paymentForm('payments-received'),
  'sales/credit-notes': () => docForm('invoices'),
  'sales/e-way-bills': () => (typeof ewayBillModal === 'function' ? ewayBillModal() : null),

  'purchases/vendors': () => partyForm('vendors'),
  'purchases/expenses': () => expenseForm(),
  'purchases/purchase-orders': () => docForm('bills'),
  'purchases/bills': () => { location.hash = '#/purchases/bills'; docMasterDetail($('#pg'), 'bills', 'new'); },
  'purchases/payments-made': () => paymentForm('payments-made'),
  'purchases/vendor-credits': () => docForm('bills'),

  'time/projects': () => (typeof projectModal === 'function' ? projectModal() : null),
  'time/timesheets': () => (typeof timelogModal === 'function' ? timelogModal() : null),

  'banking/bank-accounts': () => bankAccountForm(),
  'banking/transfers': () => transferForm(),

  'filing/gst-filing': () => (typeof fileGstrReturnModal === 'function' ? fileGstrReturnModal('GSTR1') : null),

  'accountant/manual-journals': () => journalForm(),
  'accountant/chart-of-accounts': () => accountForm(),

  'documents/all-documents': () => (typeof documentUploadModal === 'function' ? documentUploadModal() : null),
  'documents/files': () => (typeof documentUploadModal === 'function' ? documentUploadModal() : null),
  'documents/folders': () => (typeof documentUploadModal === 'function' ? documentUploadModal() : null)
};

const GROUP_ADD_ACTIONS = {
  items: () => itemForm(),
  sales: () => partyForm('customers'),
  purchases: () => partyForm('vendors'),
  inventory: () => adjustForm(),
  time: () => (typeof projectModal === 'function' ? projectModal() : null),
  banking: () => bankAccountForm(),
  accountant: () => journalForm(),
  documents: () => (typeof documentUploadModal === 'function' ? documentUploadModal() : null)
};

function getNavAddAction(k, c) {
  const s = slug(c);
  const target = k + '/' + s;
  if (NAV_NEW_ACTIONS[target]) return NAV_NEW_ACTIONS[target];
  if (window.LISTS && LISTS[s] && LISTS[s].onNew) return LISTS[s].onNew;
  return null;
}

function drawNav(cur) {
  const items = NAV.map(([l, k, ch], i) => {
    const hasGrpAdd = Boolean(GROUP_ADD_ACTIONS[k]);
    return `${i === 11 ? '<div class="sec">APPS</div>' : ''}<div class="ni ${openG.includes(k) ? 'open' : ''} ${cur.startsWith(k + '/') ? 'act' : ''}"><button type="button" data-g="${k}" aria-expanded="${openG.includes(k)}"><div class="nav-pastel-icon ${PASTEL[k] || 'icon-sky'}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${IC[k]}"/></svg></div><span class="lb">${esc(l)}</span>${k === 'home' ? '<span class="pastel-chip chip-sky">Live</span>' : ''}${hasGrpAdd ? `<span class="nav-group-add-btn" data-nav-group-add="${k}" title="New ${esc(l)}" aria-label="New ${esc(l)}">+</span>` : ''}<span class="ar-btn" data-toggle-g="${k}" title="Toggle submenu" aria-label="Toggle submenu"><svg class="ar" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></span></button><div class="ch">${ch.map(c => {
      const target = k + '/' + slug(c);
      const hasAdd = Boolean(getNavAddAction(k, c));
      return `<a href="#/${target}" class="${cur === target ? 'on' : ''}" ${cur === target ? 'aria-current="page"' : ''}><span class="nav-sub-label">${esc(c)}</span>${hasAdd ? `<span class="nav-add-btn" data-nav-add="${target}" title="New ${esc(c)}" aria-label="New ${esc(c)}">+</span>` : ''}</a>`;
    }).join('')}</div></div>`;
  }).join('');
  const footer = `<div class="sidebar-footer"><div class="user-snippet" onclick="orgForm()"><div class="user-avatar-badge" id="sidebarUserAvatar">${esc((APP.user.name || 'A')[0].toUpperCase())}</div><div class="user-info"><span class="user-name" id="sidebarUserName">${esc(APP.user.name || APP.user.username || 'Admin')}</span><span class="user-role-tag"><span style="width:6px; height:6px; background:var(--accent); border-radius:50%; display:inline-block;"></span><span>Owner / Admin</span></span></div></div></div>`;
  $('#side').innerHTML = items + footer;
}

function route() {
  destroyCharts(); PAGE.reload = null;
  if (window.Modal && Modal.stack) {
    while (Modal.stack.length) {
      const topM = Modal.stack.pop();
      if (topM && topM.el && topM.el.remove) topM.el.remove();
    }
  }
  document.body.classList.remove('modal-open');
  let raw = (location.hash.slice(2) || 'home/dashboard').replace(/\/$/, '');
  let h = DEFAULT_ROUTES[raw] || raw;
  if (!h || h === 'home') h = 'home/dashboard';
  const pg = $('#pg'), root = document.createElement('div');
  pg.replaceChildren(root);
  drawNav(h);
  document.body.classList.remove('mo');
  closePops();
  const fn = ROUTES[h] || ROUTES[raw];
  if (fn) { Promise.resolve().then(() => fn(root)).catch(e => { root.innerHTML = errBox(e.message); console.error(e); }); }
  else { const g = NAV.find(n => h.startsWith(n[1] + '/')), nm = g && g[2].find(c => slug(c) === h.split('/')[1]); plannedPage(root, g && g[0], nm); }
  window.scrollTo(0, 0);
}
async function refresh() { try { await loadMe(); } catch (e) { } if (PAGE.reload) PAGE.reload(); else route(); }

async function loadMe() {
  const me = await api('me/');
  APP.user = me.user; APP.org = me.organization; APP.today = me.today; APP.counts = me.counts;
  applyOrg();
}
function applyOrg() {
  const [y, m] = APP.today.split('-').map(Number), fy = m >= 4 ? y : y - 1;
  $('#orgname').textContent = APP.org.name;
  $('#orgfy').textContent = `FY ${fy}-${String((fy + 1) % 100).padStart(2, '0')}`;
  $('#um').textContent = (APP.user.name || 'A')[0].toUpperCase();
  $('#who').textContent = 'Signed in as ' + (APP.user.username || '');
  const av = $('#sidebarUserAvatar'); if (av) av.textContent = (APP.user.name || 'A')[0].toUpperCase();
  const un = $('#sidebarUserName'); if (un) un.textContent = APP.user.name || APP.user.username || 'Admin';
}

const closePops = () => {
  $$('.pop.on').forEach(p => { p.classList.remove('on'); p.style.display = ''; });
  $$('.user-menu-wrap.open').forEach(w => w.classList.remove('open'));
};

(function initUserMenuHover() {
  const wrap = $('#userMenuWrapper') || $('#um')?.closest('.user-menu-wrap') || $('#um')?.closest('.rel');
  const menu = $('#umm');
  if (!wrap || !menu) return;
  let timer = null;

  wrap.addEventListener('mouseenter', () => {
    clearTimeout(timer);
    menu.classList.add('on');
    wrap.classList.add('open');
  });

  wrap.addEventListener('mouseleave', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      menu.classList.remove('on');
      wrap.classList.remove('open');
    }, 180);
  });
})();

document.addEventListener('touchstart', e => {
  const t = e.target;
  if (!t.closest('.pop') && !t.closest('#um') && !t.closest('#qc') && !t.closest('#notifBtn') && !t.closest('#orgbtn')) {
    closePops();
  }
}, { passive: true });
const QC = [
  ['Customer', () => partyForm('customers')],
  ['Vendor', () => partyForm('vendors')],
  ['Invoice', () => { location.hash = '#/sales/invoices'; docMasterDetail($('#pg'), 'invoices', 'new'); }],
  ['Bill', () => { location.hash = '#/purchases/bills'; docMasterDetail($('#pg'), 'bills', 'new'); }],
  ['Expense', () => expenseForm()],
  ['Journal Entry', () => journalForm()],
  ['Upload Document', () => documentUploadModal()],
  ['Bank Account', () => bankAccountForm()],
  ['Payment received', () => paymentForm('payments-received')],
  ['Payment made', () => paymentForm('payments-made')],
  ['Item', () => itemForm()],
  ['Stock adjustment', () => adjustForm()]
];
$('#qcm').innerHTML = QC.map((q, i) => `<button class="mi" type="button" data-q="${i}">New ${esc(q[0].toLowerCase())}</button>`).join('');

function openRecord(t, id) {
  const M = { customer: ['sales/customers', () => partyDetail('customers', id)], vendor: ['purchases/vendors', () => partyDetail('vendors', id)], invoice: ['sales/invoices', () => docMasterDetail($('#pg'), 'invoices', id)], bill: ['purchases/bills', () => docMasterDetail($('#pg'), 'bills', id)], item: ['items/items-services', () => itemForm(id)] };
  const [r, fn] = M[t];
  if (location.hash !== '#/' + r) location.hash = '#/' + r;
  fn().catch(e => toast(e.message, 'err'));
}

const NotificationCenter = {
  async fetch() {
    try {
      const data = await api('notifications/');
      const dot = $('#notifDot');
      const countChip = $('#notifCountChip');
      const count = (data && data.unread_count) || 0;
      if (dot) dot.style.display = count > 0 ? 'block' : 'none';
      if (countChip) countChip.textContent = count;

      const container = $('#notifListContainer');
      if (!container) return;

      if (!data || !data.notifications || !data.notifications.length) {
        container.innerHTML = `
          <div style="padding:32px 20px;text-align:center;color:var(--tx-muted);">
            <div style="font-size:26px;margin-bottom:6px;">🔔</div>
            <div style="font-weight:600;font-size:13px;color:var(--tx);">All caught up!</div>
            <div style="font-size:12px;margin-top:2px;">No unread alerts or notifications</div>
          </div>
        `;
        return;
      }

      container.innerHTML = data.notifications.map(n => `
        <div class="notif-item" data-notif-id="${n.id}" data-link="${esc(n.link || '')}" style="display:flex;gap:12px;padding:12px 16px;border-bottom:1px solid var(--bd);cursor:pointer;background:${n.is_read ? 'transparent' : 'var(--surface-glass-subtle)'};transition:background 0.15s ease;">
          <div style="width:32px;height:32px;border-radius:8px;background:${n.category === 'billing' ? 'rgba(239,68,68,0.15)' : n.category === 'banking' ? 'rgba(16,185,129,0.15)' : n.category === 'inventory' ? 'rgba(245,158,11,0.15)' : 'rgba(99,102,241,0.15)'};color:${n.category === 'billing' ? '#ef4444' : n.category === 'banking' ? '#10b981' : n.category === 'inventory' ? '#f59e0b' : '#6366f1'};display:grid;place-items:center;font-size:14px;flex-shrink:0;">
            ${n.category === 'billing' ? '💳' : n.category === 'banking' ? '🏦' : n.category === 'inventory' ? '📦' : '⚖️'}
          </div>
          <div style="flex:1;min-width:0;">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:2px;">
              <span style="font-weight:${n.is_read ? '500' : '700'};font-size:12.5px;color:var(--tx);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(n.title)}</span>
              <span style="font-size:10px;color:var(--tx-muted);flex-shrink:0;">${esc(n.created_at)}</span>
            </div>
            <div style="font-size:11.5px;color:var(--tx-muted);line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${esc(n.message)}</div>
          </div>
        </div>
      `).join('');
    } catch (e) {
    }
  },

  async markRead(id) {
    try {
      await api(`notifications/${id}/mark-read/`, { method: 'POST' });
      this.fetch();
    } catch(e) {}
  },

  async markAllRead() {
    try {
      await api('notifications/mark-all-read/', { method: 'POST' });
      toast('All notifications marked as read', 'ok');
      this.fetch();
    } catch(e) { toast(e.message, 'err'); }
  }
};

document.addEventListener('click', async e => {
  const t = e.target;
  const tog = (btn, pop) => {
    if (!t.closest(btn)) return false;
    const p = $(pop);
    if (!p) return false;
    const on = p.classList.contains('on');
    closePops();
    if (!on) {
      p.classList.add('on');
      const w = p.closest('.user-menu-wrap');
      if (w) w.classList.add('open');
    }
    return true;
  };
  if (tog('#notifBtn', '#notifPop')) { NotificationCenter.fetch(); return; }
  if (tog('#qc', '#qcm') || tog('#um', '#umm')) return;

  const markAllBtn = t.closest('#markAllReadBtn');
  if (markAllBtn) { NotificationCenter.markAllRead(); return; }

  const notifItem = t.closest('.notif-item');
  if (notifItem) {
    closePops();
    const nid = notifItem.dataset.notifId;
    const link = notifItem.dataset.link;
    if (nid) NotificationCenter.markRead(nid);
    if (link) location.hash = link;
    return;
  }

  const q = t.closest('[data-q]');
  if (q) { closePops(); QC[q.dataset.q][1]().catch(err => toast(err.message, 'err')); return; }
  const sr = t.closest('#qr [data-t]');
  if (sr) { closePops(); $('#q').value = ''; openRecord(sr.dataset.t, sr.dataset.id); return; }
  const a = t.closest('[data-a]');
  if (a && a.closest('#umm')) {
    closePops();
    if (a.dataset.a === 'org') orgForm();
    if (a.dataset.a === 'logout') {
      try {
        if (APP && APP.user && APP.user.username) {
          try {
            localStorage.setItem('convosis_last_login_username', APP.user.username);
            document.cookie = 'convosis_last_user=' + encodeURIComponent(APP.user.username) + '; path=/; max-age=31536000; SameSite=Lax';
          } catch(e) {}
        }
        await fetch('/accounts/logout/', { method: 'POST', headers: { 'X-CSRFToken': csrf() }, credentials: 'same-origin' });
      } finally {
        location.href = '/accounts/login/';
      }
    }
    return;
  }
  if (!t.closest('.pop')) {
    closePops();
    const np = $('#notifPop'); if (np) np.style.display = 'none';
  }

  const navAdd = t.closest('[data-nav-add]');
  if (navAdd) {
    e.preventDefault();
    e.stopPropagation();
    const target = navAdd.dataset.navAdd;
    const parts = target.split('/');
    const action = getNavAddAction(parts[0], parts[1]);
    if (action) {
      try {
        const res = action();
        if (res && res.catch) res.catch(err => toast(err.message, 'err'));
      } catch (err) {
        toast(err.message, 'err');
      }
    }
    return;
  }

  const grpAdd = t.closest('[data-nav-group-add]');
  if (grpAdd) {
    e.preventDefault();
    e.stopPropagation();
    const gKey = grpAdd.dataset.navGroupAdd;
    const action = GROUP_ADD_ACTIONS[gKey];
    if (action) {
      try {
        const res = action();
        if (res && res.catch) res.catch(err => toast(err.message, 'err'));
      } catch (err) {
        toast(err.message, 'err');
      }
    }
    return;
  }

  const togG = t.closest('[data-toggle-g]');
  if (togG) {
    const k = togG.dataset.toggleG;
    openG = openG.includes(k) ? openG.filter(x => x !== k) : [...openG, k];
    pref.set('open', openG);
    drawNav(location.hash.slice(2) || 'home/dashboard');
    return;
  }
  const g = t.closest('[data-g]');
  if (g) {
    const k = g.dataset.g;
    if (!openG.includes(k)) {
      openG = [...openG, k];
      pref.set('open', openG);
    }
    document.body.classList.remove('col');
    const navG = NAV.find(n => n[1] === k);
    const firstSlug = navG && navG[2] && navG[2][0] ? slug(navG[2][0]) : '';
    const dest = DEFAULT_ROUTES[k] || (k + '/' + firstSlug);
    if (location.hash === '#/' + dest) {
      drawNav(dest);
      route();
    } else {
      location.hash = '#/' + dest;
    }
    return;
  }
  if (t.closest('#burger')) { innerWidth <= 900 ? document.body.classList.toggle('mo') : document.body.classList.toggle('col'); return; }
  if (t.closest('#orgbtn')) orgForm();
  if (t.closest('[data-retry]') && PAGE.reload) PAGE.reload();
});
const rfshBtn = $('#rfsh');
if (rfshBtn) rfshBtn.addEventListener('click', () => { refresh(); toast('Refreshed'); });

let qt;
$('#q').addEventListener('input', e => {
  clearTimeout(qt);
  const v = e.target.value.trim(), box = $('#qr');
  if (v.length < 2) { box.classList.remove('on'); return; }
  qt = setTimeout(async () => {
    try {
      const r = await api('search/?' + qs({ q: v }));
      if ($('#q').value.trim() !== v) return;
      box.innerHTML = r.length ? r.map(x => `<button class="mi" type="button" data-t="${esc(x.type)}" data-id="${esc(x.id)}"><b>${esc(x.label)}</b> <span class="sub">${esc(x.sub)}</span></button>`).join('') : '<div class="sub" style="padding:8px">No results</div>';
      box.classList.add('on');
    } catch (err) { }
  }, 220);
});
document.addEventListener('keydown', e => {
  if (e.key === '/' && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName) && !Modal.count()) { e.preventDefault(); $('#q').focus(); }
  if (e.key === 'Escape') {
    closePops();
    const np = $('#notifPop'); if (np) np.style.display = 'none';
  }
});

loadMe().then(() => {
  route();
  addEventListener('hashchange', route);
  NotificationCenter.fetch();
  setInterval(() => NotificationCenter.fetch(), 45000);
}).catch(err => {
  $('#pg').innerHTML = errBox('Could not load the application: ' + err.message, false);
});

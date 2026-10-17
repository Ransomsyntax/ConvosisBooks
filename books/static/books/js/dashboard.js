'use strict';
/* Home dashboard*/
const DASH = { period: pref.get('period', 'fy'), hidden: pref.get('hidden', []), custom: pref.get('custom', null), charts: {} };
const WID = [['kpi', 'KPI cards'], ['recpay', 'Receivables & payables'], ['cash', 'Cash flow'], ['mix', 'Revenue by category'], ['revexp', 'Revenue vs expenses'], ['aging', 'Aging'], ['sales', 'Sales performance'], ['inv', 'Inventory overview'], ['top', 'Top customers'], ['act', 'Recent activity']];
const PERIODS = [['today', 'Today'], ['week', 'This Week'], ['month', 'This Month'], ['lastm', 'Last Month'], ['quarter', 'This Quarter'], ['fy', 'This Financial Year'], ['pfy', 'Previous Financial Year'], ['custom', 'Custom Range']];
const KP = [
  ['revenue', 'Total Revenue', inr, 'sales/invoices', 'Taxable value of sent invoices dated in the period (excl. GST)', 0, 1],
  ['expenses', 'Total Expenses', inr, 'purchases/bills', 'Taxable value of approved bills dated in the period (excl. GST)', 1, 1],
  ['profit', 'Net Profit', inr, 'purchases/bills', 'Revenue minus expenses for the period', 0, 1],
  ['receivables', 'Total Receivables', inr, 'sales/invoices', 'Unpaid balance of all sent invoices, as of today', 1, 0],
  ['payables', 'Total Payables', inr, 'purchases/bills', 'Unpaid balance of all approved bills, as of today', 1, 0],
  ['cash', 'Cash and Bank Balance', inr, 'sales/payments-received', 'Opening balance + payments received − payments made', 0, 0],
  ['outstanding_invoices', 'Outstanding Invoices', v => String(v), 'sales/invoices', 'Sent invoices that still have a balance due', 1, 0],
  ['outstanding_bills', 'Outstanding Bills', v => String(v), 'purchases/bills', 'Approved bills that still have a balance due', 1, 0],
  ['sales_growth', 'Sales Growth', v => v == null ? '—' : v.toFixed(1) + '%', 'sales/invoices', 'Revenue change vs the previous period of equal length', 0, 0],
  ['inventory_value', 'Inventory Value', inr, 'inventory/inventory-summary', 'Stock on hand × purchase price for tracked goods', 0, 0],
  ['gst_payable', 'GST Payable (est.)', inr, 'filing/gst-filing', 'Output GST on invoices less input GST on bills in the period. Estimate only.', 1, 1],
  ['overdue_receivables', 'Overdue Receivables', inr, 'sales/invoices', 'Unpaid invoice balance past its due date', 1, 0],
];
const pct = (c, p) => (p == null || num(p) === 0) ? null : (num(c) - num(p)) / Math.abs(num(p)) * 100;

function rangeFor(k) {
  const t = APP.today, [y, m, d] = t.split('-').map(Number), D = (yy, mm, dd) => iso(new Date(yy, mm, dd)), fy = m >= 4 ? y : y - 1;
  switch (k) {
    case 'today': return [t, t];
    case 'week': return [D(y, m - 1, d - new Date(y, m - 1, d).getDay()), t];
    case 'month': return [D(y, m - 1, 1), t];
    case 'lastm': return [D(y, m - 2, 1), D(y, m - 1, 0)];
    case 'quarter': return [D(y, Math.floor((m - 1) / 3) * 3, 1), t];
    case 'pfy': return [D(fy - 1, 3, 1), D(fy, 2, 31)];
    case 'custom': return DASH.custom ? [DASH.custom.s, DASH.custom.e] : rangeFor('fy');
    default: return [D(fy, 3, 1), t];
  }
}
function destroyCharts() { Object.values(DASH.charts).forEach(c => c.destroy()); DASH.charts = {}; }

function mkChart(root, id, cfg, has) {
  const cv = $('#' + id, root);
  if (!cv) return;
  if (!has) { cv.parentElement.innerHTML = '<div class="empty">No data for the selected period</div>'; return; }
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const textColor = isDark ? '#cbd5e1' : '#475569';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
  const ticks = v => '₹' + (Math.abs(v) >= 1e5 ? (v / 1e5).toFixed(1) + 'L' : Math.abs(v) >= 1e3 ? (v / 1e3) + 'K' : v);
  DASH.charts[id] = new Chart(cv, {
    ...cfg,
    options: {
      responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 10, color: textColor } },
        tooltip: { callbacks: { label: c => ' ' + (c.dataset.label || c.label) + ': ' + inr(c.parsed.y != null ? c.parsed.y : c.parsed) } }
      },
      scales: cfg.type === 'doughnut' ? {} : {
        y: { ticks: { callback: ticks, color: textColor }, grid: { color: gridColor } },
        x: { ticks: { color: textColor }, grid: { display: false } }
      },
    },
  });
}

async function renderDashboard(root) {
  destroyCharts();
  const load = () => renderDashboard(root);
  PAGE.reload = load;
  const [s, e] = rangeFor(DASH.period);
  const head = `<div class="hd"><div><h1>Hello, ${esc(APP.user.name || 'admin')}</h1><div class="sub">${esc(APP.org.name)} · ${fd(s)} – ${fd(e)}</div></div>
<div class="act"><select class="btn" id="per" aria-label="Date range">${opts(PERIODS, DASH.period)}</select>
${DASH.period === 'custom' ? `<input class="btn" type="date" id="d1" aria-label="From" value="${esc(s)}"><input class="btn" type="date" id="d2" aria-label="To" value="${esc(e)}">` : ''}
<button class="btn" id="rf" type="button">Refresh</button><button class="btn" id="ex" type="button">Export</button><button class="btn" id="cu" type="button" aria-haspopup="true">Customize</button>
<div class="pop right" id="cum" style="top:36px">${WID.map(w => `<label class="ck" style="padding:6px 10px"><input type="checkbox" data-w="${w[0]}" ${DASH.hidden.includes(w[0]) ? '' : 'checked'}> ${esc(w[1])}</label>`).join('')}<button class="mi" data-rl type="button">Reset layout</button></div></div></div>
<div class="tabs"><a class="on" href="#/home/dashboard">Dashboard</a><a href="#/home/getting-started">Getting Started</a><a href="#/home/recent-updates">Recent Updates</a></div><div id="dbody">${spinner}</div>`;
  root.innerHTML = head;
  const wire = D => {
    $('#per', root).onchange = ev => { DASH.period = ev.target.value; pref.set('period', DASH.period); if (DASH.period === 'custom' && !DASH.custom) DASH.custom = { s, e }; load(); };
    ['d1', 'd2'].forEach(i => { const el = $('#' + i, root); if (el) el.onchange = () => { const a = $('#d1', root).value, b = $('#d2', root).value; if (a && b) { DASH.custom = { s: a, e: b }; pref.set('custom', DASH.custom); load(); } }; });
    $('#rf', root).onclick = () => { load(); toast('Dashboard refreshed'); };
    $('#cu', root).onclick = ev => { ev.stopPropagation(); $('#cum', root).classList.toggle('on'); };
    $('#cum', root).onclick = ev => {
      ev.stopPropagation();
      const w = ev.target.dataset.w;
      if (w) { DASH.hidden = ev.target.checked ? DASH.hidden.filter(x => x !== w) : [...DASH.hidden, w]; pref.set('hidden', DASH.hidden); applyHidden(root); }
      if (ev.target.hasAttribute('data-rl')) { DASH.hidden = []; pref.set('hidden', []); load(); }
    };
    $('#ex', root).onclick = () => { if (!D) { toast('Nothing to export yet.', 'err'); return; } exportCsv('dashboard-kpis', ['Metric', 'Value', 'Previous period'], KP.map(k => [k[1], D.kpis[k[0]].value == null ? '' : D.kpis[k[0]].value, D.kpis[k[0]].prev == null ? '' : D.kpis[k[0]].prev])); };
  };
  wire(null);
  let D;
  try { D = await api('dashboard/?' + qs({ start: s, end: e })); }
  catch (err) { if (!root.isConnected) return; $('#dbody', root).innerHTML = errBox(err.message, true); wire(null); return; }
  if (!root.isConnected) return;
  wire(D);
  const H = id => DASH.hidden.includes(id) ? ' hidden' : '';
  const total = APP.counts.customers + APP.counts.invoices + APP.counts.bills + APP.counts.items;
  const dl = (k, c) => {
    if (k[0] === 'sales_growth') return '<span class="nu">vs previous period</span>';
    if (!k[6]) return '<span class="nu">as of today</span>';
    const p = pct(c.value, c.prev);
    if (p == null) return num(c.value) === 0 ? '<span class="nu">no change</span>' : '<span class="nu">no previous data</span>';
    const good = (p >= 0) !== !!k[5];
    return `<span class="${good ? 'up' : 'dn'}">${p >= 0 ? '▲' : '▼'} ${Math.abs(p).toFixed(1)}%</span> <span class="nu">vs previous period</span>`;
  };
  const pb = (title, route, label, o, cls) => {
    const t = num(o.total), ov = num(o.overdue), cur = t - ov;
    return `<div class="card s6${H('recpay')}" data-w="recpay"><h3>${title}<a href="#/${route}">View all</a></h3><div class="cb"><div class="sub">Total unpaid ${label}</div><div class="big">${inr(t)}</div><div class="bar" role="img" aria-label="${inr(cur)} current, ${inr(ov)} overdue"><i style="width:${t ? cur / t * 100 : 0}%;background:var(--blue)"></i><i style="width:${t ? ov / t * 100 : 0}%;background:var(--warn)"></i></div><div class="lg"><span><span class="dot" style="background:var(--blue)"></span>Current: ${inr(cur)}</span><span><span class="dot" style="background:var(--warn)"></span>Overdue: ${inr(ov)}</span></div></div></div>`;
  };
  const topMax = D.top_customers.length ? num(D.top_customers[0].value) : 0;
  const AB = ['Current', '1–30 days', '31–60 days', '61–90 days', '90+ days'];
  $('#dbody', root).innerHTML = `${total === 0 ? '<div class="note">No records yet. Open <a href="#/home/getting-started">Getting Started</a> to add your customers, items and first invoice.</div>' : ''}
<div class="g"><div class="s12${H('kpi')}" data-w="kpi"><div class="g">${KP.map(k => { const c = D.kpis[k[0]]; return `<a class="card kpi s3" href="#/${k[3]}" title="${esc(k[4])}"><div class="l">${esc(k[1])}</div><div class="v">${k[0] === 'sales_growth' ? k[2](c.value) : k[2](k[2] === inr ? c.value : num(c.value))}</div><div class="d">${dl(k, c)}</div></a>`; }).join('')}</div></div>
${pb('Total Receivables', 'sales/invoices', 'invoices', D.receivables)}${pb('Total Payables', 'purchases/bills', 'bills', D.payables)}
<div class="card s8${H('cash')}" data-w="cash"><h3>Cash Flow</h3><div class="cb"><div class="cs"><div><span>Cash as on ${fd(addDays(s, -1))}</span><b>${inr(D.cash.opening)}</b></div><div><span>Incoming</span><b class="up">${inr(D.cash.incoming)}</b></div><div><span>Outgoing</span><b class="dn">${inr(D.cash.outgoing)}</b></div><div><span>Cash as on ${fd(e)}</span><b>${inr(D.cash.closing)}</b></div></div><div class="cv"><canvas id="c1" role="img" aria-label="Monthly cash incoming, outgoing and net"></canvas></div></div></div>
<div class="card s4${H('mix')}" data-w="mix"><h3>Revenue by Category</h3><div class="cb"><div class="cv"><canvas id="c3" role="img" aria-label="Revenue by item category"></canvas></div></div></div>
<div class="card s6${H('revexp')}" data-w="revexp"><h3>Revenue vs Expenses</h3><div class="cb"><div class="cv sm"><canvas id="c2" role="img" aria-label="Revenue, expenses and profit by month"></canvas></div></div></div>
<div class="card s6${H('aging')}" data-w="aging"><h3>Receivables &amp; Payables Aging</h3><div class="cb"><div class="cv sm"><canvas id="c4" role="img" aria-label="Aging buckets for receivables and payables"></canvas></div></div></div>
<div class="card s6${H('sales')}" data-w="sales"><h3>Sales Performance<a href="#/sales/invoices">Invoices</a></h3><div class="cb"><div class="mini"><div><span>Invoices</span><b>${D.sales.count}</b></div><div><span>Average invoice</span><b>${inr(D.sales.average)}</b></div><div><span>Paid</span><b class="up">${D.sales.paid}</b></div><div><span>Unpaid</span><b class="dn">${D.sales.unpaid}</b></div></div></div></div>
<div class="card s6${H('inv')}" data-w="inv"><h3>Inventory Overview<a href="#/inventory/inventory-summary">Summary</a></h3><div class="cb"><div class="mini"><div><span>Stock value</span><b>${inr(D.inventory.value)}</b></div><div><span>Active items</span><b>${D.inventory.active_items}</b></div><div><span>Low stock</span><b class="${D.inventory.low ? 'dn' : ''}">${D.inventory.low}</b></div><div><span>Out of stock</span><b class="${D.inventory.out ? 'dn' : ''}">${D.inventory.out}</b></div></div></div></div>
<div class="card s6${H('top')}" data-w="top"><h3>Top Customers</h3><div class="cb">${D.top_customers.length ? D.top_customers.map(c => `<div class="bl"><span class="n" title="${esc(c.name)}">${esc(c.name)}</span><span class="t"><i style="width:${topMax ? num(c.value) / topMax * 100 : 0}%"></i></span><b>${inr(c.value)}</b></div>`).join('') : '<div class="empty">No sales in this period</div>'}</div></div>
<div class="card s6${H('act')}" data-w="act"><h3>Recent Activity<a href="#/home/recent-updates">View all</a></h3><div class="cb">${activityList(D.activity)}</div></div></div>`;
  const col = { b: '#3579E8', g: '#16865C', r: '#D64550', o: '#D97706' }, N = a => a.map(num);
  const cin = N(D.cash.in), cout = N(D.cash.out), rv = N(D.monthly.revenue), ex = N(D.monthly.expenses), ar = N(D.aging.receivable), ap = N(D.aging.payable), mix = D.mix;
  mkChart(root, 'c1', { type: 'bar', data: { labels: D.cash.labels, datasets: [{ label: 'Incoming', data: cin, backgroundColor: col.g }, { label: 'Outgoing', data: cout, backgroundColor: col.r }, { type: 'line', label: 'Net', data: cin.map((v, i) => v - cout[i]), borderColor: col.b, tension: .3 }] } }, cin.concat(cout).some(Boolean));
  mkChart(root, 'c2', { type: 'bar', data: { labels: D.monthly.labels, datasets: [{ label: 'Revenue', data: rv, backgroundColor: col.b }, { label: 'Expenses', data: ex, backgroundColor: col.o }, { type: 'line', label: 'Net profit', data: rv.map((v, i) => v - ex[i]), borderColor: col.g, tension: .3 }] } }, rv.concat(ex).some(Boolean));
  mkChart(root, 'c3', { type: 'doughnut', data: { labels: mix.map(m => m.label), datasets: [{ data: mix.map(m => num(m.value)), backgroundColor: ['#3579E8', '#20263D', '#16865C', '#D97706', '#98A2B8', '#D64550', '#7A5AF8'] }] } }, mix.length > 0);
  mkChart(root, 'c4', { type: 'bar', data: { labels: AB, datasets: [{ label: 'Receivables', data: ar, backgroundColor: col.b }, { label: 'Payables', data: ap, backgroundColor: col.o }] } }, ar.concat(ap).some(Boolean));
}
function applyHidden(root) {
  $$('[data-w]', root).forEach(el => { if (el.tagName !== 'INPUT') el.classList.toggle('hidden', DASH.hidden.includes(el.dataset.w)); });
}
const ACT_ROUTE = { invoice: 'sales/invoices', payment_received: 'sales/payments-received', bill: 'purchases/bills', payment_made: 'purchases/payments-made', stock: 'inventory/stock-adjustments' };
function activityList(list) {
  if (!list.length) return '<div class="empty">No activity yet</div>';
  return `<ul class="al">${list.map(a => `<li><span><a href="#/${ACT_ROUTE[a.type] || 'home/dashboard'}">${esc(a.title)}</a><br><span class="sub">${esc(a.detail || '')}${a.amount != null ? ' · ' + inr(a.amount) : ''}</span></span><span class="sub">${fd(a.date)}</span></li>`).join('')}</ul>`;
}
function exportCsv(name, head, rows) {
  const q = v => { let s = String(v); if (/^[=+\-@\t\r]/.test(s) && isNaN(Number(s))) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
  const b = new Blob(['\ufeff' + [head, ...rows].map(r => r.map(q).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = slug(name) + '.csv'; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 500);
}

window.addEventListener('convosis:appearance', () => {
  if (PAGE.reload && (location.hash.includes('dashboard') || !location.hash.slice(2))) {
    PAGE.reload();
  }
});


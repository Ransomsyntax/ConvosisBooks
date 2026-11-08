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
const APP = { org: { state: '' }, user: {}, today: iso(new Date()), counts: {} };

const pref = {
  get(k, d) { try { const v = localStorage.getItem('cvb_' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('cvb_' + k, JSON.stringify(v)); } catch (e) { } },
};

function toast(msg, kind) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = kind === 'err' ? 'err' : '';
  t.style.display = 'block';
  clearTimeout(toast.t);
  toast.t = setTimeout(() => { t.style.display = 'none'; }, kind === 'err' ? 5000 : 2600);
}

class ApiErr extends Error {
  constructor(status, data, msg) {
    let message = msg || ('Request failed (' + status + ')');
    let errors = {};
    if (typeof data === 'string') {
      message = data;
    } else if (data && typeof data === 'object') {
      if (data.message) message = data.message;
      if (data.errors && typeof data.errors === 'object') {
        errors = data.errors;
      } else if (!data.message) {
        errors = data;
      }
    }
    super(message);
    this.status = status;
    this.message = message;
    this.errors = errors;
  }
}
const csrf = () => { const m = document.cookie.match(/(?:^|; )csrftoken=([^;]+)/); return m ? decodeURIComponent(m[1]) : ''; };
const qs = o => { const p = new URLSearchParams(); Object.entries(o).forEach(([k, v]) => { if (v !== '' && v != null) p.set(k, v); }); return p.toString(); };

async function api(path, opt = {}) {
  const method = opt.method || 'GET';
  const init = { method, credentials: 'same-origin', headers: { 'Accept': 'application/json', 'X-CSRFToken': csrf() } };
  if (opt.body !== undefined) {
    if (typeof FormData !== 'undefined' && opt.body instanceof FormData) {
      init.body = opt.body;
    } else if (typeof opt.body === 'string') {
      init.headers['Content-Type'] = 'application/json';
      init.body = opt.body;
    } else {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(opt.body);
    }
  }
  let res;
  const cleanPath = String(path || '').replace(/^\/+/, '');
  try { res = await fetch('/api/' + cleanPath, init); } catch (e) { throw new ApiErr(0, { message: 'Network error: could not reach the server.' }); }
  if (res.status === 401) { location.href = '/accounts/login/?next=/'; throw new ApiErr(401, { message: 'Session expired.' }); }
  if (res.status === 204) return null;
  let data = null;
  try { data = await res.json(); } catch (e) { }
  if (!res.ok) throw new ApiErr(res.status, data);
  return data;
}

const BADGE = {
  Paid: 'ok', paid: 'ok',
  Overdue: 'ba', overdue: 'ba',
  'Partially Paid': 'wa', 'partially_paid': 'wa', partial: 'wa',
  'Partially Applied': 'wa', 'partially_applied': 'wa',
  'Fully Applied': 'ok', 'fully_applied': 'ok',
  Sent: 'in', sent: 'in',
  Open: 'in', open: 'in',
  Draft: 'gr', draft: 'gr',
  Void: 'gr', void: 'gr',
  Cancelled: 'gr', cancelled: 'gr',
  Active: 'ok', active: 'ok',
  Inactive: 'gr', inactive: 'gr',
  Paused: 'wa', paused: 'wa',
  Completed: 'ok', completed: 'ok',
  Failed: 'ba', failed: 'ba',
  Expired: 'ba', expired: 'ba',
  'Low stock': 'wa',
  'Out of stock': 'ba'
};
const badge = s => {
  if (s == null || s === '') return '';
  const str = String(s).trim();
  const lower = str.toLowerCase();
  const cls = BADGE[str] || BADGE[lower] || 'gr';
  return `<span class="st ${cls}">${esc(str)}</span>`;
};
const statusBadge = badge;
if (typeof window !== 'undefined') {
  window.badge = badge;
  window.statusBadge = badge;
  window.BADGE = BADGE;
}
const spinner = '<div class="spin" role="status">Loading…</div>';
const errBox = (msg, retry) => `<div class="empty" role="alert"><div>${esc(msg)}${retry ? '<br><button class="btn" data-retry type="button" style="margin-top:8px">Retry</button>' : ''}</div></div>`;

function opts(list, sel) {
  return (list || []).map(o => {
    const [v, l] = Array.isArray(o) ? o : [o, o];
    return `<option value="${esc(v)}"${String(v) === String(sel == null ? '' : sel) ? ' selected' : ''}>${esc(l)}</option>`;
  }).join('');
}
window.opts = opts;

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

window.$ = $;
window.$$ = $$;
window.esc = esc;
window.num = num;
window.inr = inr;
window.iso = iso;
window.api = api;
window.toast = toast;
window.parseCsvString = parseCsvString;


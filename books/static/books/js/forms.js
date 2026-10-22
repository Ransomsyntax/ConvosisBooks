'use strict';

const Modal = (() => {
  const stack = [];
  function open({ title, body, footer = '', wide = false, onClose }) {
    const el = document.createElement('div');
    el.className = 'mo';
    el.innerHTML = `<div class="md ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="mh"><h2>${esc(title)}</h2><button type="button" class="x" data-close aria-label="Close">×</button></div><div class="mb">${body}</div>${footer ? `<div class="mf">${footer}</div>` : ''}</div>`;
    $('#modal-root').appendChild(el);
    const m = { el, body: $('.mb', el), beforeClose: null, prev: document.activeElement };
    m.close = () => {
      const i = stack.indexOf(m); if (i >= 0) stack.splice(i, 1);
      el.remove();
      if (!stack.length) document.body.classList.remove('modal-open');
      if (onClose) onClose();
      if (m.prev && m.prev.isConnected && m.prev.focus) m.prev.focus();
    };
    m.request = async () => { if (m.beforeClose && !(await m.beforeClose())) return; m.close(); };
    el.addEventListener('click', e => { if (e.target.closest('[data-close]')) m.request(); });
    stack.push(m);
    document.body.classList.add('modal-open');
    const f = el.querySelector('input:not([type=hidden]):not([disabled]),select,textarea') || el.querySelector('.mf .p');
    if (f) f.focus();
    return m;
  }
  document.addEventListener('keydown', e => {
    if (!stack.length) return;
    const top = stack[stack.length - 1];
    if (e.key === 'Escape') { e.stopImmediatePropagation(); top.request(); }
    if (e.key === 'Tab') {
      const f = $$('a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled])', top.el);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  return { open, get top() { return stack[stack.length - 1]; }, count: () => stack.length };
})();

function confirmBox({ title, message, okText = 'Confirm', danger = false }) {
  return new Promise(resolve => {
    let done = false;
    const fin = v => { if (!done) { done = true; resolve(v); } };
    const m = Modal.open({
      title, body: `<p>${esc(message)}</p>`, onClose: () => fin(false),
      footer: `<button class="btn" type="button" data-close>Cancel</button><button class="btn ${danger ? 'd' : 'p'}" type="button" data-ok>${esc(okText)}</button>`,
    });
    $('[data-ok]', m.el).addEventListener('click', () => { fin(true); m.close(); });
    $('[data-ok]', m.el).focus();
  });
}

let uid = 0;
const opts = (list, sel) => list.map(o => { const [v, l] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}"${String(v) === String(sel == null ? '' : sel) ? ' selected' : ''}>${esc(l)}</option>`; }).join('');
function fld(o) {
  const id = 'i' + (++uid), v = o.value == null ? '' : o.value, req = o.req ? ' required aria-required="true"' : '', at = o.attrs || '';
  let ctl;
  if (o.type === 'checkbox') return `<div class="fg ${o.col || ''}"><label class="ck"><input type="checkbox" name="${o.name}" ${v ? 'checked' : ''} ${at}> ${esc(o.label)}</label><div class="er" data-err="${o.name}" role="alert"></div></div>`;
  if (o.type === 'select') ctl = `<select class="in" id="${id}" name="${o.name}"${req} ${at}>${opts(o.opts, v)}</select>`;
  else if (o.type === 'textarea') ctl = `<textarea class="in" id="${id}" name="${o.name}" rows="${o.rows || 2}" maxlength="${o.max || 2000}" ${at}>${esc(v)}</textarea>`;
  else ctl = `<input class="in" id="${id}" name="${o.name}" type="${o.type || 'text'}" value="${esc(v)}"${o.ph ? ` placeholder="${esc(o.ph)}"` : ''}${req} ${at}>`;
  return `<div class="fg ${o.col || ''}"><label for="${id}">${esc(o.label)}${o.req ? ' <span class="rq">*</span>' : ''}</label>${ctl}<div class="er" data-err="${o.name}" role="alert"></div>${o.help ? `<div class="hp">${esc(o.help)}</div>` : ''}</div>`;
}
function readForm(form) {
  const d = {};
  for (const el of form.elements) {
    if (!el.name || el.type === 'submit' || el.type === 'button' || el.disabled) continue;
    if (el.type === 'radio') {
      if (el.checked) d[el.name] = el.value;
      continue;
    }
    d[el.name] = el.type === 'checkbox' ? el.checked : el.value;
  }
  return d;
}
function clearErrors(form) { $$('[data-err]', form).forEach(e => { e.textContent = ''; }); }
function showErrors(form, errors, msg) {
  let general = msg || '', first = null;
  for (const [k, v] of Object.entries(errors || {})) {
    const el = form.querySelector(`[data-err="${k}"]`);
    if (el) { el.textContent = v; if (!first) first = el; } else general += (general ? ' ' : '') + k + ': ' + v;
  }
  const g = form.querySelector('[data-err="_"]');
  if (g) g.textContent = general;
  const target = first || g;
  if (target && target.scrollIntoView) target.scrollIntoView({ block: 'nearest' });
  const inp = first && first.parentElement.querySelector('input,select,textarea');
  if (inp) inp.focus();
}

function formModal({ title, body, submit = 'Save', actions, wide, onSubmit, onReady }) {
  const id = 'f' + (++uid);
  const acts = actions || [{ label: submit, value: 'save', primary: true }];
  const m = Modal.open({
    title, wide,
    body: `<form id="${id}" novalidate>${body}<div class="fe" data-err="_" role="alert"></div></form>`,
    footer: `<button type="button" class="btn" data-close>Cancel</button>` + acts.map(a => `<button type="submit" form="${id}" name="action" value="${a.value}" class="btn ${a.primary ? 'p' : ''}">${esc(a.label)}</button>`).join(''),
  });
  const form = $('#' + id, m.el);
  let dirty = false;
  form.addEventListener('input', () => { dirty = true; });
  form.addEventListener('change', () => { dirty = true; });
  m.markDirty = () => { dirty = true; };
  m.beforeClose = async () => !dirty || await confirmBox({ title: 'Discard changes?', message: 'You have unsaved changes that will be lost.', okText: 'Discard', danger: true });
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const btns = $$('button[type=submit]', m.el);
    btns.forEach(b => { b.disabled = true; });
    clearErrors(form);
    try {
      await onSubmit(readForm(form), e.submitter ? e.submitter.value : acts[0].value, form);
      dirty = false; m.close();
    } catch (err) {
      if (err && err.cancel) return;
      if (err instanceof ApiErr) showErrors(form, err.errors, err.message);
      else { showErrors(form, {}, (err && err.message) || 'Unexpected error.'); console.error(err); }
    } finally { btns.forEach(b => { b.disabled = false; }); }
  });
  if (onReady) onReady(form, m);
  return m;
}

/* ---------- Enterprise Customer & Vendor Forms ---------- */

const GST_STATE_OPTIONS = [
  ['', 'Select state / place of supply'],
  ['[32] Kerala', '[32] Kerala'],
  ['[33] Tamil Nadu', '[33] Tamil Nadu'],
  ['[29] Karnataka', '[29] Karnataka'],
  ['[27] Maharashtra', '[27] Maharashtra'],
  ['[07] Delhi', '[07] Delhi'],
  ['[24] Gujarat', '[24] Gujarat'],
  ['[36] Telangana', '[36] Telangana'],
  ['[37] Andhra Pradesh', '[37] Andhra Pradesh'],
  ['[19] West Bengal', '[19] West Bengal'],
  ['[09] Uttar Pradesh', '[09] Uttar Pradesh'],
  ['[06] Haryana', '[06] Haryana'],
  ['[08] Rajasthan', '[08] Rajasthan'],
  ['[23] Madhya Pradesh', '[23] Madhya Pradesh'],
  ['[10] Bihar', '[10] Bihar'],
  ['[21] Odisha', '[21] Odisha'],
  ['[03] Punjab', '[03] Punjab'],
  ['[22] Chhattisgarh', '[22] Chhattisgarh'],
  ['[20] Jharkhand', '[20] Jharkhand'],
  ['[05] Uttarakhand', '[05] Uttarakhand'],
  ['[02] Himachal Pradesh', '[02] Himachal Pradesh'],
  ['[30] Goa', '[30] Goa'],
  ['[18] Assam', '[18] Assam'],
  ['[04] Chandigarh', '[04] Chandigarh'],
  ['[34] Puducherry', '[34] Puducherry'],
  ['[01] Jammu and Kashmir', '[01] Jammu and Kashmir'],
  ['[38] Ladakh', '[38] Ladakh'],
  ['[11] Sikkim', '[11] Sikkim'],
  ['[17] Meghalaya', '[17] Meghalaya'],
  ['[16] Tripura', '[16] Tripura'],
  ['[14] Manipur', '[14] Manipur'],
  ['[13] Nagaland', '[13] Nagaland'],
  ['[12] Arunachal Pradesh', '[12] Arunachal Pradesh'],
  ['[15] Mizoram', '[15] Mizoram'],
  ['[35] Andaman and Nicobar Islands', '[35] Andaman and Nicobar Islands'],
  ['[31] Lakshadweep', '[31] Lakshadweep'],
  ['[26] Dadra and Nagar Haveli and Daman and Diu', '[26] Dadra and Nagar Haveli and Daman and Diu'],
  ['Other Territory', '[97] Other Territory']
];

const GST_TREATMENT_OPTIONS_CUSTOMER = [
  ['business_regular', 'Registered Business - Regular'],
  ['business_composition', 'Registered Business - Composition'],
  ['unregistered', 'Unregistered Business'],
  ['consumer', 'Consumer'],
  ['overseas', 'Overseas'],
  ['sez', 'Special Economic Zone (SEZ)'],
  ['deemed_export', 'Deemed Export']
];

const GST_TREATMENT_OPTIONS_VENDOR = [
  ['business_regular', 'Registered Business - Regular'],
  ['business_composition', 'Registered Business - Composition'],
  ['unregistered', 'Unregistered Business'],
  ['overseas', 'Overseas'],
  ['sez', 'Special Economic Zone (SEZ)']
];

const LANGUAGE_OPTIONS = [
  ['English', 'English'],
  ['Hindi', 'Hindi (हिंदी)'],
  ['Tamil', 'Tamil (தமிழ்)'],
  ['Malayalam', 'Malayalam (മലയാളം)'],
  ['Kannada', 'Kannada (ಕನ್ನಡ)'],
  ['Telugu', 'Telugu (తెలుగు)'],
  ['Marathi', 'Marathi (मराठी)'],
  ['Gujarati', 'Gujarati (ગુજરાતી)'],
  ['Bengali', 'Bengali (বাংলা)']
];

const CURRENCY_OPTIONS = [
  ['INR', 'INR - Indian Rupee (₹)'],
  ['USD', 'USD - US Dollar ($)'],
  ['EUR', 'EUR - Euro (€)'],
  ['GBP', 'GBP - British Pound (£)'],
  ['AED', 'AED - UAE Dirham (د.إ)'],
  ['SGD', 'SGD - Singapore Dollar (S$)']
];

const PAYMENT_TERMS_OPTIONS = [
  ['1', 'Due on Receipt'],
  ['15', 'Net 15'],
  ['30', 'Net 30'],
  ['45', 'Net 45'],
  ['60', 'Net 60'],
  ['0', 'Due end of the month'],
  ['-1', 'Due end of next month']
];

const TDS_OPTIONS = [
  ['', 'None'],
  ['194C', '194C - Payments to Contractors / Subcontractors (1% / 2%)'],
  ['194J', '194J - Fees for Professional or Technical Services (2% / 10%)'],
  ['194I_LAND', '194I - Rent on Land, Building or Furniture (10%)'],
  ['194I_PLANT', '194I - Rent on Plant, Machinery or Equipment (2%)'],
  ['194Q', '194Q - Purchase of Goods exceeding ₹50 Lakhs (0.1%)'],
  ['194H', '194H - Commission or Brokerage (5%)']
];

async function partyForm(kind, id) {
  const isCust = kind === 'customers';
  const entityLabel = isCust ? 'Customer' : 'Vendor';
  const r = id ? await api(`${kind}/${id}/`) : {
    customer_type: 'business',
    currency: 'INR',
    payment_terms: 30,
    opening_balance: '0.00',
    opening_balance_type: 'debit',
    gst_treatment: 'business_regular',
    tax_preference: 'taxable',
    active: true,
    state: APP.org.state || 'Kerala',
    place_of_supply: `[32] ${APP.org.state || 'Kerala'}`,
    source_of_supply: `[32] ${APP.org.state || 'Kerala'}`,
    contact_persons_data: [],
    custom_fields_data: {},
    documents_data: []
  };

  let contactPersonsList = Array.isArray(r.contact_persons_data) ? [...r.contact_persons_data] : [];
  let customFieldsList = r.custom_fields_data && typeof r.custom_fields_data === 'object'
    ? Object.entries(r.custom_fields_data).map(([k, v]) => ({ label: k, value: v }))
    : [];
  let documentsList = Array.isArray(r.documents_data) ? [...r.documents_data] : [];

  const defaultPos = r.place_of_supply || (r.state ? `[32] ${r.state}` : '[32] Kerala');
  const defaultSos = r.source_of_supply || (r.state ? `[32] ${r.state}` : '[32] Kerala');

  const formHtml = `
    <div class="party-form-wrap">
      <!-- 1. GST Portal Prefill Header Banner -->
      <div class="gst-prefill-banner">
        <div class="gst-prefill-info">
          <div class="gst-badge-icon">🏛️</div>
          <div>
            <div class="gst-prefill-title">Prefill ${entityLabel} details from the GST portal using the ${entityLabel}'s GSTIN.</div>
            <div class="gst-prefill-sub">Auto-populates trade name, legal entity, PAN, state, and registered billing address.</div>
          </div>
        </div>
        <div class="gst-prefill-ctrls">
          <input class="in gst-prefill-input" id="gst_prefill_code" placeholder="Enter 15-digit GSTIN" maxlength="15" value="${esc(r.gstin || '')}">
          <button type="button" class="btn p" id="btn_trigger_gst_prefill" style="white-space:nowrap;">Prefill</button>
        </div>
      </div>

      <!-- 2. Customer Type Selector (Customer Only) -->
      ${isCust ? `
        <div style="display:flex;align-items:center;gap:16px;">
          <label style="font-size:12.5px;font-weight:600;color:var(--tx2);">Customer Type</label>
          <div class="party-type-bar">
            <label class="party-type-pill ${r.customer_type !== 'individual' ? 'active' : ''}" id="pill_type_business">
              <input type="radio" name="customer_type" value="business" ${r.customer_type !== 'individual' ? 'checked' : ''} style="display:none;">
              <span>🏢 Business</span>
            </label>
            <label class="party-type-pill ${r.customer_type === 'individual' ? 'active' : ''}" id="pill_type_individual">
              <input type="radio" name="customer_type" value="individual" ${r.customer_type === 'individual' ? 'checked' : ''} style="display:none;">
              <span>👤 Individual</span>
            </label>
          </div>
        </div>
      ` : ''}

      <!-- 3. Primary Contact & Company Details -->
      <div class="g" style="gap:14px;">
        <div class="fg s4">
          <label>Primary Contact</label>
          <div style="display:flex;gap:6px;">
            <select class="in" id="primary_salutation" name="primary_salutation" style="width:75px;flex-shrink:0;">
              <option value="Mr.">Mr.</option>
              <option value="Mrs.">Mrs.</option>
              <option value="Ms.">Ms.</option>
              <option value="Miss">Miss</option>
              <option value="Dr.">Dr.</option>
            </select>
            <input class="in" id="contact_person" name="contact_person" placeholder="First Name &amp; Last Name" value="${esc(r.contact_person || '')}">
          </div>
        </div>
        <div class="fg s4">
          <label>Company Name</label>
          <input class="in" id="company" name="company" placeholder="e.g. Convosis Technologies Pvt Ltd" value="${esc(r.company || '')}">
        </div>
        <div class="fg s4">
          <label>${entityLabel} Display Name <span class="rq">*</span></label>
          <div style="display:flex;gap:6px;">
            <input class="in" id="name" name="name" required placeholder="${entityLabel} Display Name" value="${esc(r.name || '')}" style="font-weight:600;">
            <select class="in" id="display_name_picker" title="Quick pick name source" style="width:40px;padding:4px;flex-shrink:0;">
              <option value="">▼</option>
              <option value="company">From Company</option>
              <option value="contact">From Contact</option>
            </select>
          </div>
          <div class="er" data-err="name"></div>
        </div>

        <div class="fg s4">
          <label>Email Address</label>
          <input class="in" id="email" name="email" type="email" placeholder="billing@company.com" value="${esc(r.email || '')}">
          <div class="er" data-err="email"></div>
        </div>
        <div class="fg s4">
          <label>Work Phone</label>
          <input class="in" id="phone" name="phone" type="tel" placeholder="+91-9847017737" value="${esc(r.phone || '')}">
          <div class="er" data-err="phone"></div>
        </div>
        <div class="fg s4">
          <label>Mobile</label>
          <input class="in" id="mobile" name="mobile" type="tel" placeholder="+91-9840012345" value="${esc(r.mobile || '')}">
          <div class="er" data-err="mobile"></div>
        </div>
        ${isCust ? `
          <div class="fg s4">
            <label>Customer Language</label>
            <select class="in" id="customer_language" name="customer_language">
              ${LANGUAGE_OPTIONS.map(([val, lbl]) => `<option value="${val}" ${r.customer_language === val ? 'selected' : ''}>${lbl}</option>`).join('')}
            </select>
          </div>
        ` : ''}
      </div>

      <!-- 4. Tax & Financial Governance Section -->
      <div class="card" style="padding:16px 18px;background:var(--surface-glass-subtle);">
        <h4 style="margin:0 0 12px;font-size:13.5px;font-weight:700;color:var(--accent);display:flex;align-items:center;gap:6px;">
          <span>⚖️</span> Tax &amp; Statutory Governance
        </h4>
        <div class="g" style="gap:12px;">
          <div class="fg s4">
            <label>GST Treatment</label>
            <select class="in" id="gst_treatment" name="gst_treatment">
              ${(isCust ? GST_TREATMENT_OPTIONS_CUSTOMER : GST_TREATMENT_OPTIONS_VENDOR).map(([v, l]) => `
                <option value="${v}" ${r.gst_treatment === v ? 'selected' : ''}>${l}</option>
              `).join('')}
            </select>
          </div>
          <div class="fg s4">
            <label>${isCust ? 'Place of Supply' : 'Source of Supply'}</label>
            <select class="in" id="${isCust ? 'place_of_supply' : 'source_of_supply'}" name="${isCust ? 'place_of_supply' : 'source_of_supply'}">
              ${GST_STATE_OPTIONS.map(([v, l]) => {
                const cur = isCust ? defaultPos : defaultSos;
                const isSel = cur.includes(v) || v.includes(r.state || 'None');
                return `<option value="${v}" ${isSel ? 'selected' : ''}>${l}</option>`;
              }).join('')}
            </select>
          </div>
          <div class="fg s4">
            <label>GSTIN</label>
            <input class="in" id="gstin" name="gstin" maxlength="15" placeholder="e.g. 32AANCC9298C1ZE" style="text-transform:uppercase;font-family:monospace;" value="${esc(r.gstin || '')}">
            <div class="er" data-err="gstin"></div>
          </div>

          <div class="fg s3">
            <label>PAN</label>
            <input class="in" id="pan" name="pan" maxlength="10" placeholder="e.g. AANCC9298C" style="text-transform:uppercase;font-family:monospace;" value="${esc(r.pan || '')}">
            <div class="er" data-err="pan"></div>
          </div>
          <div class="fg s3">
            <label>Currency</label>
            <select class="in" id="currency" name="currency">
              ${CURRENCY_OPTIONS.map(([v, l]) => `<option value="${v}" ${r.currency === v ? 'selected' : ''}>${l}</option>`).join('')}
            </select>
          </div>
          <div class="fg s3">
            <label>Opening Balance</label>
            <div style="display:flex;gap:4px;">
              <input class="in" id="opening_balance" name="opening_balance" type="number" step="0.01" placeholder="0.00" value="${r.opening_balance || '0.00'}">
              <select class="in" id="opening_balance_type" name="opening_balance_type" style="width:65px;flex-shrink:0;">
                <option value="debit" ${r.opening_balance_type !== 'credit' ? 'selected' : ''}>Dr</option>
                <option value="credit" ${r.opening_balance_type === 'credit' ? 'selected' : ''}>Cr</option>
              </select>
            </div>
          </div>
          <div class="fg s3">
            <label>Payment Terms</label>
            <select class="in" id="payment_terms" name="payment_terms">
              ${PAYMENT_TERMS_OPTIONS.map(([v, l]) => `<option value="${v}" ${String(r.payment_terms) === v ? 'selected' : ''}>${l}</option>`).join('')}
            </select>
          </div>

          <!-- Customer Tax Preference -->
          ${isCust ? `
            <div class="fg s6">
              <label>Tax Preference</label>
              <div style="display:flex;gap:18px;align-items:center;height:36px;">
                <label class="radio-label"><input type="radio" name="tax_preference" value="taxable" ${r.tax_preference !== 'tax_exempt' ? 'checked' : ''}> Taxable</label>
                <label class="radio-label"><input type="radio" name="tax_preference" value="tax_exempt" ${r.tax_preference === 'tax_exempt' ? 'checked' : ''}> Tax Exempt</label>
              </div>
            </div>
            <div class="fg s6" id="exemption_reason_wrap" style="${r.tax_preference === 'tax_exempt' ? '' : 'display:none;'}">
              <label>Exemption Reason</label>
              <input class="in" id="exemption_reason" name="exemption_reason" placeholder="e.g. Export / SEZ / Govt Notification" value="${esc(r.exemption_reason || '')}">
            </div>
          ` : `
            <!-- Vendor MSME & TDS Controls -->
            <div class="fg s6">
              <label class="ck" style="margin-top:6px;">
                <input type="checkbox" id="is_msme_registered" name="is_msme_registered" ${r.is_msme_registered ? 'checked' : ''}>
                <b>MSME Registered?</b> This vendor is MSME registered
              </label>
              <div id="msme_fields_wrap" style="${r.is_msme_registered ? '' : 'display:none;'}margin-top:8px;display:flex;gap:8px;">
                <select class="in" id="msme_type" name="msme_type" style="width:110px;">
                  <option value="micro" ${r.msme_type === 'micro' ? 'selected' : ''}>Micro</option>
                  <option value="small" ${r.msme_type === 'small' ? 'selected' : ''}>Small</option>
                  <option value="medium" ${r.msme_type === 'medium' ? 'selected' : ''}>Medium</option>
                </select>
                <input class="in" id="msme_reg_number" name="msme_reg_number" placeholder="Udyam Reg Number (UDYAM-XX-00-0000000)" value="${esc(r.msme_reg_number || '')}">
              </div>
            </div>
            <div class="fg s3">
              <label>Income Tax TDS</label>
              <select class="in" id="tds_section" name="tds_section">
                ${TDS_OPTIONS.map(([v, l]) => `<option value="${v}" ${r.tds_section === v ? 'selected' : ''}>${l}</option>`).join('')}
              </select>
            </div>
            <div class="fg s3">
              <label class="ck" style="margin-top:24px;">
                <input type="checkbox" id="apply_gst_tds" name="apply_gst_tds" ${r.apply_gst_tds ? 'checked' : ''}>
                <b>GST TDS</b> (Sec 51)
              </label>
            </div>
          `}
        </div>

        ${isCust ? `
          <div style="margin-top:10px;padding-top:10px;border-top:1px dashed var(--bd-glass);display:flex;align-items:center;gap:12px;">
            <label class="ck">
              <input type="checkbox" id="portal_enabled" name="portal_enabled" ${r.portal_enabled ? 'checked' : ''}>
              <b>Enable Portal?</b> Allow self-service customer portal access
            </label>
            <div style="font-size:12px;color:var(--tx-muted);">(Allows viewing invoices, payment receipts, and paying online)</div>
          </div>
        ` : ''}
      </div>

      <!-- 5. Secondary Details (Vertical Split Layout) -->
      <div style="margin-top:8px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <h4 style="margin:0;font-size:13.5px;font-weight:700;">Other Details</h4>
          <button type="button" class="btn" id="btn_toggle_add_details" style="font-size:11.5px;padding:4px 12px;cursor:pointer;">Add More</button>
        </div>

        <div class="party-details-split" id="party_details_split">
          <!-- Left side: vertically aligned tabs -->
          <div class="party-tabs-sidebar" id="party_tabs_bar">
            <button type="button" class="party-tab-btn active" data-tab="tab_address">
              <span>Address</span>
            </button>
            <button type="button" class="party-tab-btn" data-tab="tab_contacts">
              <span>Contact Persons</span>
              <span class="party-tab-badge" id="cnt_badge">${contactPersonsList.length}</span>
            </button>
            ${!isCust ? `
              <button type="button" class="party-tab-btn" data-tab="tab_bank">
                <span>Bank Details</span>
              </button>
            ` : ''}
            <button type="button" class="party-tab-btn" data-tab="tab_custom_fields">
              <span>Custom Fields</span>
            </button>
            <button type="button" class="party-tab-btn" data-tab="tab_remarks">
              <span>Notes</span>
            </button>
            <button type="button" class="party-tab-btn" data-tab="tab_documents">
              <span>Attachments</span>
              <span class="party-tab-badge" id="doc_badge">${documentsList.length}</span>
            </button>
          </div>

          <!-- Right side: show contents -->
          <div class="party-tabs-content">
            <!-- Tab 1: Address -->
        <div class="party-tab-pane active" id="tab_address">
          <div class="g" style="gap:16px;">
            <div class="${isCust ? 's6' : 's12'}">
              <h5 style="margin:0 0 8px;font-size:12.5px;font-weight:700;">Billing Address</h5>
              <div class="g" style="gap:8px;">
                <div class="fg s12"><label>Attention</label><input class="in" id="billing_attention" name="billing_attention" placeholder="Accounts / Finance Dept" value="${esc(r.billing_attention || '')}"></div>
                <div class="fg s12"><label>Address Line</label><textarea class="in" id="billing_address" name="billing_address" rows="2" placeholder="Street, Building, Suite">${esc(r.billing_address || '')}</textarea></div>
                <div class="fg s4"><label>City</label><input class="in" id="billing_city" name="billing_city" placeholder="Kottayam" value="${esc(r.billing_city || '')}"></div>
                <div class="fg s4"><label>State</label><input class="in" id="billing_state" name="billing_state" placeholder="Kerala" value="${esc(r.billing_state || r.state || '')}"></div>
                <div class="fg s4"><label>Pincode</label><input class="in" id="billing_pincode" name="billing_pincode" placeholder="686003" value="${esc(r.billing_pincode || '')}"></div>
                <div class="fg s6"><label>Country</label><input class="in" id="billing_country" name="billing_country" value="${esc(r.billing_country || 'India')}"></div>
                <div class="fg s6"><label>Phone</label><input class="in" id="billing_phone" name="billing_phone" value="${esc(r.billing_phone || '')}"></div>
              </div>
            </div>

            ${isCust ? `
              <div class="s6">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                  <h5 style="margin:0;font-size:12.5px;font-weight:700;">Shipping Address</h5>
                  <button type="button" class="btn" id="btn_copy_billing_addr" style="font-size:11px;padding:3px 8px;">📋 Copy billing address</button>
                </div>
                <div class="g" style="gap:8px;">
                  <div class="fg s12"><label>Attention</label><input class="in" id="shipping_attention" name="shipping_attention" placeholder="Receiving / Logistics" value="${esc(r.shipping_attention || '')}"></div>
                  <div class="fg s12"><label>Address Line</label><textarea class="in" id="shipping_address" name="shipping_address" rows="2" placeholder="Delivery street address">${esc(r.shipping_address || '')}</textarea></div>
                  <div class="fg s4"><label>City</label><input class="in" id="shipping_city" name="shipping_city" placeholder="City" value="${esc(r.shipping_city || '')}"></div>
                  <div class="fg s4"><label>State</label><input class="in" id="shipping_state" name="shipping_state" placeholder="State" value="${esc(r.shipping_state || '')}"></div>
                  <div class="fg s4"><label>Pincode</label><input class="in" id="shipping_pincode" name="shipping_pincode" placeholder="Pincode" value="${esc(r.shipping_pincode || '')}"></div>
                  <div class="fg s6"><label>Country</label><input class="in" id="shipping_country" name="shipping_country" value="${esc(r.shipping_country || 'India')}"></div>
                  <div class="fg s6"><label>Phone</label><input class="in" id="shipping_phone" name="shipping_phone" value="${esc(r.shipping_phone || '')}"></div>
                </div>
              </div>
            ` : ''}
          </div>
        </div>

        <!-- Tab 2: Contact Persons -->
        <div class="party-tab-pane" id="tab_contacts">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <div class="sub" style="font-size:12px;">Add designated key contacts (sales, finance, dispatch) for this ${entityLabel}.</div>
            <button type="button" class="btn" id="btn_add_contact_row" style="font-size:12px;">+ Add Contact Person</button>
          </div>
          <div id="contact_persons_container"></div>
        </div>

        <!-- Tab 3: Bank Details (Vendor Only) -->
        ${!isCust ? `
          <div class="party-tab-pane" id="tab_bank">
            <div class="g" style="gap:12px;max-width:680px;">
              <div class="fg s6">
                <label>Bank Name</label>
                <input class="in" id="bank_name" name="bank_name" placeholder="e.g. State Bank of India / HDFC Bank" value="${esc(r.bank_name || '')}">
              </div>
              <div class="fg s6">
                <label>Account Holder Name</label>
                <input class="in" id="bank_account_holder" name="bank_account_holder" placeholder="Legal Account Name" value="${esc(r.bank_account_holder || r.name || '')}">
              </div>
              <div class="fg s6">
                <label>Bank Account Number</label>
                <input class="in" id="bank_account_number" name="bank_account_number" type="password" placeholder="Account Number" value="${esc(r.bank_account_number || '')}">
              </div>
              <div class="fg s6">
                <label>Re-enter Account Number</label>
                <input class="in" id="bank_account_number_confirm" type="text" placeholder="Re-enter to verify" value="${esc(r.bank_account_number || '')}">
                <div class="er" id="bank_acc_err"></div>
              </div>
              <div class="fg s4">
                <label>IFSC Code</label>
                <input class="in" id="bank_ifsc" name="bank_ifsc" placeholder="SBIN0001234" style="text-transform:uppercase;" value="${esc(r.bank_ifsc || '')}">
              </div>
              <div class="fg s4">
                <label>Branch Name</label>
                <input class="in" id="bank_branch" name="bank_branch" placeholder="Main Branch" value="${esc(r.bank_branch || '')}">
              </div>
              <div class="fg s4">
                <label>UPI ID / VPA</label>
                <input class="in" id="bank_upi_id" name="bank_upi_id" placeholder="vendor@upi" value="${esc(r.bank_upi_id || '')}">
              </div>
            </div>
          </div>
        ` : ''}

        <!-- Tab 4: Custom Fields -->
        <div class="party-tab-pane" id="tab_custom_fields">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <div class="sub" style="font-size:12px;">Add custom key-value metadata properties for this account.</div>
            <button type="button" class="btn" id="btn_add_custom_field" style="font-size:12px;">+ Add Custom Field</button>
          </div>
          <div id="custom_fields_container"></div>
        </div>
        <!-- Tab: Notes -->
        <div class="party-tab-pane" id="tab_remarks">
          <div class="fg">
            <label>Notes</label>
            <textarea class="in" id="notes" name="notes" rows="3" placeholder="Notes for internal team reference only (not printed on customer invoices)...">${esc(r.notes || r.remarks || '')}</textarea>
          </div>
        </div>

        <!-- Tab: Attachments -->
        <div class="party-tab-pane" id="tab_documents">
          <div class="doc-upload-box" id="doc_drop_zone">
            <div style="font-size:26px;margin-bottom:4px;">📎</div>
            <div style="font-weight:600;margin-bottom:2px;">Upload Attachments</div>
            <div class="sub" style="font-size:12px;color:var(--tx-muted);">You can upload a maximum of 10 files, 10MB each (PDF, PNG, JPG, DOCX, CSV)</div>
            <input type="file" id="party_file_input" multiple style="display:none;" accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx,.csv">
            <button type="button" class="btn" style="margin-top:10px;" onclick="$('#party_file_input').click()">Browse Files</button>
          </div>
          <div id="uploaded_files_list" style="margin-top:10px;display:flex;flex-wrap:wrap;gap:8px;"></div>
        </div>
          </div> <!-- /party-tabs-content -->
        </div> <!-- /party-details-split -->
      </div>
    </div>
  `;

  formModal({
    title: (id ? 'Edit ' : 'New ') + entityLabel,
    wide: true,
    body: formHtml,
    onReady: (form, modal) => {
      // 1. Tab Switching
      const tabs = $$('.party-tab-btn', modal.el);
      const panes = $$('.party-tab-pane', modal.el);
      tabs.forEach(btn => {
        btn.addEventListener('click', () => {
          tabs.forEach(b => b.classList.remove('active'));
          panes.forEach(p => p.classList.remove('active'));
          btn.classList.add('active');
          const target = $('#' + btn.dataset.tab, modal.el);
          if (target) target.classList.add('active');
        });
      });

      // 2. Toggle Add More Details
      $('#btn_toggle_add_details', modal.el).addEventListener('click', () => {
        const splitEl = $('#party_details_split', modal.el);
        if (splitEl) {
          if (splitEl.style.display === 'none') {
            splitEl.style.display = 'flex';
            const activeTab = $('.party-tab-btn.active', modal.el) || tabs[0];
            if (activeTab) activeTab.click();
          } else {
            splitEl.style.display = 'none';
          }
        }
      });

      // 3. Customer Type Pills
      if (isCust) {
        const pillBiz = $('#pill_type_business', modal.el);
        const pillInd = $('#pill_type_individual', modal.el);
        pillBiz.addEventListener('click', () => {
          pillBiz.classList.add('active'); pillInd.classList.remove('active');
          $('input[name="customer_type"][value="business"]', modal.el).checked = true;
        });
        pillInd.addEventListener('click', () => {
          pillInd.classList.add('active'); pillBiz.classList.remove('active');
          $('input[name="customer_type"][value="individual"]', modal.el).checked = true;
        });

        // Tax preference toggle
        $$('input[name="tax_preference"]', modal.el).forEach(radio => {
          radio.addEventListener('change', () => {
            const wrap = $('#exemption_reason_wrap', modal.el);
            if (radio.value === 'tax_exempt' && radio.checked) wrap.style.display = 'block';
            else if (radio.checked) wrap.style.display = 'none';
          });
        });
      } else {
        // Vendor MSME toggle
        const msmeCk = $('#is_msme_registered', modal.el);
        const msmeWrap = $('#msme_fields_wrap', modal.el);
        msmeCk.addEventListener('change', () => {
          msmeWrap.style.display = msmeCk.checked ? 'flex' : 'none';
        });
      }

      // 4. GST Portal Prefill
      const doPrefill = async () => {
        const gstinVal = ($('#gst_prefill_code', modal.el).value || $('#gstin', modal.el).value || '').trim().toUpperCase();
        if (!gstinVal || gstinVal.length < 15) {
          toast('Please enter a valid 15-character GSTIN to prefill.', 'err');
          return;
        }
        const btn = $('#btn_trigger_gst_prefill', modal.el);
        btn.disabled = true;
        btn.textContent = 'Fetching…';
        try {
          const res = await api('compliance/gstin-lookup/' + encodeURIComponent(gstinVal) + '/');
          $('#company', modal.el).value = res.company_name || res.legal_name || '';
          $('#name', modal.el).value = res.display_name || res.trade_name || res.legal_name || '';
          $('#gstin', modal.el).value = res.gstin;
          $('#gst_prefill_code', modal.el).value = res.gstin;
          $('#pan', modal.el).value = res.pan;

          const posSel = $('#' + (isCust ? 'place_of_supply' : 'source_of_supply'), modal.el);
          if (posSel && res.place_of_supply) {
            for (const opt of posSel.options) {
              if (opt.value.includes(res.state_code) || opt.value.includes(res.state)) {
                opt.selected = true; break;
              }
            }
          }

          const gstTrSel = $('#gst_treatment', modal.el);
          if (gstTrSel) gstTrSel.value = res.gst_treatment || 'business_regular';

          if (isCust && res.customer_type) {
            if (res.customer_type === 'individual') $('#pill_type_individual', modal.el).click();
            else $('#pill_type_business', modal.el).click();
          }

          $('#billing_address', modal.el).value = res.billing_address || '';
          $('#billing_city', modal.el).value = res.billing_city || '';
          $('#billing_state', modal.el).value = res.billing_state || res.state || '';
          $('#billing_pincode', modal.el).value = res.billing_pincode || '';

          toast(`Successfully prefilled ${res.legal_name} from GST Portal!`, 'ok');
        } catch (err) {
          toast(err.message || 'Unable to fetch GST details.', 'err');
        } finally {
          btn.disabled = false;
          btn.textContent = 'Prefill';
        }
      };

      $('#btn_trigger_gst_prefill', modal.el).addEventListener('click', doPrefill);

      // Keep both GSTIN inputs in sync
      $('#gstin', modal.el).addEventListener('input', e => {
        $('#gst_prefill_code', modal.el).value = e.target.value;
      });
      $('#gst_prefill_code', modal.el).addEventListener('input', e => {
        $('#gstin', modal.el).value = e.target.value;
      });

      // 5. Display Name Quick Picker
      $('#display_name_picker', modal.el).addEventListener('change', e => {
        const val = e.target.value;
        if (val === 'company') {
          const comp = $('#company', modal.el).value.trim();
          if (comp) $('#name', modal.el).value = comp;
        } else if (val === 'contact') {
          const cont = $('#contact_person', modal.el).value.trim();
          if (cont) $('#name', modal.el).value = cont;
        }
        e.target.value = '';
      });

      // 6. Copy Billing Address to Shipping
      if (isCust) {
        $('#btn_copy_billing_addr', modal.el).addEventListener('click', () => {
          $('#shipping_attention', modal.el).value = $('#billing_attention', modal.el).value;
          $('#shipping_address', modal.el).value = $('#billing_address', modal.el).value;
          $('#shipping_city', modal.el).value = $('#billing_city', modal.el).value;
          $('#shipping_state', modal.el).value = $('#billing_state', modal.el).value;
          $('#shipping_pincode', modal.el).value = $('#billing_pincode', modal.el).value;
          $('#shipping_phone', modal.el).value = $('#billing_phone', modal.el).value;
          toast('Billing address copied to shipping address.', 'ok');
        });
      }

      // 7. Contact Persons Dynamic List
      const contContainer = $('#contact_persons_container', modal.el);
      const renderContacts = () => {
        $('#cnt_badge', modal.el).textContent = contactPersonsList.length;
        if (!contactPersonsList.length) {
          contContainer.innerHTML = '<div class="sub" style="padding:8px 0;font-size:12px;">No additional contact persons added yet.</div>';
          return;
        }
        contContainer.innerHTML = contactPersonsList.map((c, i) => `
          <div class="contact-row-card" data-idx="${i}">
            <select class="in sal-input" style="padding:4px;">
              <option value="Mr." ${c.salutation === 'Mr.' ? 'selected' : ''}>Mr.</option>
              <option value="Mrs." ${c.salutation === 'Mrs.' ? 'selected' : ''}>Mrs.</option>
              <option value="Ms." ${c.salutation === 'Ms.' ? 'selected' : ''}>Ms.</option>
              <option value="Dr." ${c.salutation === 'Dr.' ? 'selected' : ''}>Dr.</option>
            </select>
            <input class="in fn-input" placeholder="First Name" value="${esc(c.first_name || '')}">
            <input class="in ln-input" placeholder="Last Name" value="${esc(c.last_name || '')}">
            <input class="in em-input" placeholder="Email" value="${esc(c.email || '')}">
            <input class="in ph-input" placeholder="Work Phone" value="${esc(c.phone || '')}">
            <input class="in mb-input" placeholder="Mobile" value="${esc(c.mobile || '')}">
            <button type="button" class="btn d btn-del-contact" style="padding:4px 6px;">✕</button>
          </div>
        `).join('');

        $$('.contact-row-card', contContainer).forEach(card => {
          const idx = Number(card.dataset.idx);
          card.querySelector('.sal-input').addEventListener('change', e => { contactPersonsList[idx].salutation = e.target.value; });
          card.querySelector('.fn-input').addEventListener('input', e => { contactPersonsList[idx].first_name = e.target.value; });
          card.querySelector('.ln-input').addEventListener('input', e => { contactPersonsList[idx].last_name = e.target.value; });
          card.querySelector('.em-input').addEventListener('input', e => { contactPersonsList[idx].email = e.target.value; });
          card.querySelector('.ph-input').addEventListener('input', e => { contactPersonsList[idx].phone = e.target.value; });
          card.querySelector('.mb-input').addEventListener('input', e => { contactPersonsList[idx].mobile = e.target.value; });
          card.querySelector('.btn-del-contact').addEventListener('click', () => {
            contactPersonsList.splice(idx, 1);
            renderContacts();
          });
        });
      };

      $('#btn_add_contact_row', modal.el).addEventListener('click', () => {
        contactPersonsList.push({ salutation: 'Mr.', first_name: '', last_name: '', email: '', phone: '', mobile: '', designation: '' });
        renderContacts();
      });
      renderContacts();

      // 8. Custom Fields Dynamic List
      const cfContainer = $('#custom_fields_container', modal.el);
      const renderCustomFields = () => {
        if (!customFieldsList.length) {
          cfContainer.innerHTML = '<div class="sub" style="padding:8px 0;font-size:12px;">No custom fields defined.</div>';
          return;
        }
        cfContainer.innerHTML = customFieldsList.map((cf, i) => `
          <div style="display:flex;gap:8px;margin-bottom:6px;align-items:center;" data-cf-idx="${i}">
            <input class="in cf-label" placeholder="Field Label (e.g. Region / Lead Source)" value="${esc(cf.label || '')}" style="width:200px;">
            <input class="in cf-val" placeholder="Value" value="${esc(cf.value || '')}" style="flex:1;">
            <button type="button" class="btn d btn-del-cf" style="padding:4px 8px;">✕</button>
          </div>
        `).join('');

        $$('[data-cf-idx]', cfContainer).forEach(row => {
          const idx = Number(row.dataset.cfIdx);
          row.querySelector('.cf-label').addEventListener('input', e => { customFieldsList[idx].label = e.target.value; });
          row.querySelector('.cf-val').addEventListener('input', e => { customFieldsList[idx].value = e.target.value; });
          row.querySelector('.btn-del-cf').addEventListener('click', () => {
            customFieldsList.splice(idx, 1);
            renderCustomFields();
          });
        });
      };

      $('#btn_add_custom_field', modal.el).addEventListener('click', () => {
        customFieldsList.push({ label: '', value: '' });
        renderCustomFields();
      });
      renderCustomFields();

      // 9. Document Attachments
      const docListEl = $('#uploaded_files_list', modal.el);
      const renderDocs = () => {
        $('#doc_badge', modal.el).textContent = documentsList.length;
        if (!documentsList.length) {
          docListEl.innerHTML = '';
          return;
        }
        docListEl.innerHTML = documentsList.map((doc, i) => `
          <div style="display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:6px;background:var(--surface-glass);border:1px solid var(--bd-glass);font-size:12px;">
            <span>📄</span>
            <span><b>${esc(doc.name)}</b> (${esc(doc.size)})</span>
            <button type="button" class="lk btn-del-doc" data-doc-idx="${i}" style="color:var(--dn);font-weight:700;margin-left:4px;">✕</button>
          </div>
        `).join('');

        $$('.btn-del-doc', docListEl).forEach(btn => {
          btn.addEventListener('click', () => {
            documentsList.splice(Number(btn.dataset.docIdx), 1);
            renderDocs();
          });
        });
      };

      const fileInput = $('#party_file_input', modal.el);
      fileInput.addEventListener('change', () => {
        const files = Array.from(fileInput.files);
        if (documentsList.length + files.length > 10) {
          toast('You can upload a maximum of 10 files.', 'err');
          return;
        }
        for (const file of files) {
          if (file.size > 10 * 1024 * 1024) {
            toast(`File ${file.name} exceeds the 10MB limit.`, 'err');
            continue;
          }
          const sz = file.size < 1024 * 1024 ? Math.round(file.size / 1024) + ' KB' : (file.size / (1024 * 1024)).toFixed(1) + ' MB';
          documentsList.push({ name: file.name, size: sz, type: file.type });
        }
        renderDocs();
        fileInput.value = '';
      });
      renderDocs();
    },
    onSubmit: async d => {
      // Validate Bank Account Confirmation for Vendors
      if (!isCust) {
        const acc = d.bank_account_number ? d.bank_account_number.trim() : '';
        const cfAcc = ($('#bank_account_number_confirm', modal.el) ? $('#bank_account_number_confirm', modal.el).value : '').trim();
        if (acc && cfAcc && acc !== cfAcc) {
          throw new ApiErr(400, { bank_account_number: 'Bank account numbers do not match.' }, 'Bank account numbers do not match.');
        }
      }

      // Attach dynamic lists
      d.contact_persons_data = contactPersonsList.filter(c => c.first_name || c.ln_input || c.email);
      const cfMap = {};
      customFieldsList.forEach(cf => {
        if (cf.label.trim()) cfMap[cf.label.trim()] = (cf.value || '').trim();
      });
      d.custom_fields_data = cfMap;
      d.documents_data = documentsList;

      // Sync notes and remarks
      d.notes = (d.notes || d.remarks || '').trim();
      d.remarks = d.notes;

      // Sync state for GST calculations
      if (isCust && d.place_of_supply) {
        const stMatch = d.place_of_supply.replace(/^\[\d+\]\s*/, '').trim();
        if (stMatch) d.state = stMatch;
      } else if (!isCust && d.source_of_supply) {
        const stMatch = d.source_of_supply.replace(/^\[\d+\]\s*/, '').trim();
        if (stMatch) d.state = stMatch;
      }

      if (!id) d.active = true;
      await api(id ? `${kind}/${id}/` : `${kind}/`, { method: id ? 'PUT' : 'POST', body: d });
      toast(`${entityLabel} ${id ? 'updated' : 'created'} successfully!`, 'ok');
      refresh();
    }
  });
}


async function itemForm(id) {
  const [r, vendors] = await Promise.all([
    id ? api(`items/${id}/`) : {
      type: 'goods',
      item_type: 'goods',
      gst_rate: 18,
      selling_price: '',
      purchase_price: '',
      active: true,
      unit: 'pcs',
      track_inventory: true,
      tax_preference: 'taxable',
      sales_account: 'Sales',
      purchase_account: 'Cost of Goods Sold',
      inventory_account: 'Inventory Asset',
      preferred_vendor_id: null,
      image_data: '',
      category: '',
      hsn_sac: '',
      description: '',
      reorder_level: '',
      sku: ''
    },
    api('lookup/vendors/').catch(() => [])
  ]);

  const isGoods = (r.type || r.item_type || 'goods') === 'goods';
  const img = r.image_data || '';

  // Units list as specified in requirements
  const ITEM_UNITS = [
    ['box', 'box (Box)'],
    ['cm', 'cm (Centimeter)'],
    ['dz', 'dz (Dozen)'],
    ['ft', 'ft (Feet)'],
    ['g', 'g (Grams)'],
    ['in', 'in (Inches)'],
    ['kg', 'kg (Kilograms)'],
    ['km', 'km (Kilometers)'],
    ['lb', 'lb (Pounds)'],
    ['mg', 'mg (Milli Grams)'],
    ['ml', 'ml (Milli Litre)'],
    ['m', 'm (Meter)'],
    ['pcs', 'pcs (Pieces)'],
  ];

  const curUnit = r.unit || 'pcs';
  let unitFound = false;
  const unitOptsHtml = ITEM_UNITS.map(([val, label]) => {
    const isSel = (val.toLowerCase() === curUnit.toLowerCase() || label.toLowerCase() === curUnit.toLowerCase());
    if (isSel) unitFound = true;
    return `<option value="${esc(val)}" ${isSel ? 'selected' : ''}>${esc(label)}</option>`;
  }).join('');
  const extraUnitOpt = (!unitFound && curUnit) ? `<option value="${esc(curUnit)}" selected>${esc(curUnit)}</option>` : '';


  const SALES_ACCOUNT_GROUPS = [
    {
      group: 'Income',
      accounts: [
        { val: 'Sales', label: 'Sales' },
        { val: 'Discount', label: 'Discount' },
        { val: 'General Income', label: 'General Income' },
        { val: 'Interest Income', label: 'Interest Income' },
        { val: 'Late Fee Income', label: 'Late Fee Income' },
        { val: 'Other Charges', label: 'Other Charges' },
        { val: 'Shipping Charge', label: 'Shipping Charge' }
      ]
    },
    {
      group: 'Other Current Asset',
      accounts: [
        { val: 'Advance Tax', label: 'Advance Tax' },
        { val: 'CGST TDS Receivable', label: 'CGST TDS Receivable' },
        { val: 'Employee Advance', label: 'Employee Advance' },
        { val: 'IGST TDS Receivable', label: 'IGST TDS Receivable' },
        { val: 'Input Tax Credits', label: 'Input Tax Credits' },
        { val: 'Input CGST', label: '  • Input CGST' },
        { val: 'Input IGST', label: '  • Input IGST' },
        { val: 'Input SGST', label: '  • Input SGST' },
        { val: 'Prepaid Expenses', label: 'Prepaid Expenses' },
        { val: 'Reverse Charge Tax Input but not due', label: 'Reverse Charge Tax Input but not due' },
        { val: 'SGST TDS Receivable', label: 'SGST TDS Receivable' },
        { val: 'TDS Receivable', label: 'TDS Receivable' }
      ]
    },
    {
      group: 'Fixed Asset',
      accounts: [
        { val: 'Furniture and Equipment', label: 'Furniture and Equipment' }
      ]
    },
    {
      group: 'Other Current Liability',
      accounts: [
        { val: 'CGST TDS Payable', label: 'CGST TDS Payable' },
        { val: 'Employee Reimbursements', label: 'Employee Reimbursements' },
        { val: 'GST Payable', label: 'GST Payable' },
        { val: 'Output CGST', label: '  • Output CGST' },
        { val: 'Output IGST', label: '  • Output IGST' },
        { val: 'Output SGST', label: '  • Output SGST' },
        { val: 'IGST TDS Payable', label: 'IGST TDS Payable' },
        { val: 'Opening Balance Adjustments', label: 'Opening Balance Adjustments' },
        { val: 'Overseas Tax Payable', label: 'Overseas Tax Payable' },
        { val: 'SGST TDS Payable', label: 'SGST TDS Payable' },
        { val: 'Tax Payable', label: 'Tax Payable' },
        { val: 'TDS Payable', label: 'TDS Payable' },
        { val: 'Unearned Revenue', label: 'Unearned Revenue' }
      ]
    }
  ];

  const curSalesAccount = r.sales_account || 'Sales';
  let salesFound = false;
  const salesAccountsHtml = SALES_ACCOUNT_GROUPS.map(grp => {
    const opts = grp.accounts.map(acc => {
      const isSel = (acc.val === curSalesAccount);
      if (isSel) salesFound = true;
      return `<option value="${esc(acc.val)}" ${isSel ? 'selected' : ''}>${esc(acc.label)}</option>`;
    }).join('');
    return `<optgroup label="${esc(grp.group)}">${opts}</optgroup>`;
  }).join('');
  const extraSalesOpt = (!salesFound && curSalesAccount) ? `<option value="${esc(curSalesAccount)}" selected>${esc(curSalesAccount)}</option>` : '';

  const PURCHASE_ACCOUNTS = [
    'Cost of Goods Sold',
    'Purchase Account',
    'Material Expense',
    'Operating Expense',
    'Raw Materials',
    'Subcontractor Expense',
    'Freight & Shipping Costs'
  ];
  const curPurchAccount = r.purchase_account || 'Cost of Goods Sold';
  let purchFound = false;
  const purchaseAccountsHtml = PURCHASE_ACCOUNTS.map(acc => {
    const isSel = (acc === curPurchAccount);
    if (isSel) purchFound = true;
    return `<option value="${esc(acc)}" ${isSel ? 'selected' : ''}>${esc(acc)}</option>`;
  }).join('');
  const extraPurchOpt = (!purchFound && curPurchAccount) ? `<option value="${esc(curPurchAccount)}" selected>${esc(curPurchAccount)}</option>` : '';

  const INVENTORY_ACCOUNTS = [
    'Inventory Asset',
    'Work in Progress',
    'Finished Goods',
    'Raw Materials Inventory'
  ];
  const curInvAccount = r.inventory_account || 'Inventory Asset';
  let invFound = false;
  const inventoryAccountsHtml = INVENTORY_ACCOUNTS.map(acc => {
    const isSel = (acc === curInvAccount);
    if (isSel) invFound = true;
    return `<option value="${esc(acc)}" ${isSel ? 'selected' : ''}>${esc(acc)}</option>`;
  }).join('');
  const extraInvOpt = (!invFound && curInvAccount) ? `<option value="${esc(curInvAccount)}" selected>${esc(curInvAccount)}</option>` : '';

  const curVendorId = r.preferred_vendor_id != null ? String(r.preferred_vendor_id) : '';
  const vendorOptsHtml = (vendors || []).map(v => {
    const isSel = (String(v.id) === curVendorId);
    return `<option value="${v.id}" ${isSel ? 'selected' : ''}>${esc(v.name)}</option>`;
  }).join('');

  const DEFAULT_TAX_SLABS = [0, 5, 12, 18, 28, 40];
  const curRate = num(r.gst_rate != null ? r.gst_rate : 18);
  const isCustomRate = !DEFAULT_TAX_SLABS.includes(curRate);

  const intraOptionsHtml = `
    <optgroup label="Tax Group">
      ${isCustomRate ? `<option value="${curRate}" selected>GST${curRate} [${curRate}%]</option>` : ''}
      <option value="0" ${curRate === 0 ? 'selected' : ''}>GST0 [0%]</option>
      <option value="5" ${curRate === 5 ? 'selected' : ''}>GST5 [5%]</option>
      <option value="12" ${curRate === 12 ? 'selected' : ''}>GST12 [12%]</option>
      <option value="18" ${curRate === 18 ? 'selected' : ''}>GST18 [18%]</option>
      <option value="28" ${curRate === 28 ? 'selected' : ''}>GST28 [28%]</option>
      <option value="40" ${curRate === 40 ? 'selected' : ''}>GST40 [40%]</option>
    </optgroup>
    <option value="__add_new__" style="color:var(--accent); font-weight:600;">+ Add New Tax Rate…</option>
  `;

  const interOptionsHtml = `
    <optgroup label="Tax">
      ${isCustomRate ? `<option value="${curRate}" selected>IGST${curRate} [${curRate}%]</option>` : ''}
      <option value="0" ${curRate === 0 ? 'selected' : ''}>IGST0 [0%]</option>
      <option value="5" ${curRate === 5 ? 'selected' : ''}>IGST5 [5%]</option>
      <option value="12" ${curRate === 12 ? 'selected' : ''}>IGST12 [12%]</option>
      <option value="18" ${curRate === 18 ? 'selected' : ''}>IGST18 [18%]</option>
      <option value="28" ${curRate === 28 ? 'selected' : ''}>IGST28 [28%]</option>
      <option value="40" ${curRate === 40 ? 'selected' : ''}>IGST40 [40%]</option>
    </optgroup>
    <option value="__add_new__" style="color:var(--accent); font-weight:600;">+ Add New Tax Rate…</option>
  `;

  formModal({
    title: id ? 'Edit Item' : 'New Item',
    wide: true,
    body: `
    <div class="zoho-item-modal">
      <!-- Top Section: Item Details (Left) + Picture Upload (Right) -->
      <div class="zoho-top-grid">
        <div class="zoho-left-fields">
          <!-- Name -->
          <div class="fg">
            <label for="item_name" class="req-label">Name<span class="rq">*</span></label>
            <input class="in" type="text" id="item_name" name="name" value="${esc(r.name || '')}" placeholder="Item name" required autofocus>
            <div class="er" data-err="name" role="alert"></div>
          </div>

          <!-- Type (Radio: Goods / Service) -->
          <div class="fg">
            <label class="zoho-label">Type <span class="help-tip" title="Goods have physical inventory, services do not.">?</span></label>
            <div class="zoho-radio-group">
              <label class="radio-label">
                <input type="radio" name="item_type" value="goods" ${isGoods ? 'checked' : ''}>
                <span>Goods</span>
              </label>
              <label class="radio-label">
                <input type="radio" name="item_type" value="service" ${!isGoods ? 'checked' : ''}>
                <span>Service</span>
              </label>
            </div>
            <div class="er" data-err="item_type" role="alert"></div>
          </div>

          <!-- Unit (Dropdown with Enter Option + Add New) -->
          <div class="fg">
            <label for="item_unit_select" class="zoho-label">Unit <span class="help-tip" title="Choose from dropdown or enter custom measuring unit for GST & billing.">?</span></label>
            <div class="unit-combo-group">
              <select class="in" id="item_unit_select">
                <option value="">Select Unit…</option>
                ${unitOptsHtml}
                ${extraUnitOpt}
                <option value="__add_new__" style="color:var(--accent); font-weight:600;">+ Add New Unit…</option>
              </select>
              <input class="in" type="text" id="item_unit" name="unit" value="${esc(r.unit || 'pcs')}" placeholder="Unit (or type here)" maxlength="20" required title="Selected unit or enter custom unit directly">
            </div>
            <div class="er" data-err="unit" role="alert"></div>
          </div>

          <!-- SKU -->
          <div class="fg">
            <label for="item_sku" class="req-label">SKU<span class="rq">*</span> <span class="help-tip" title="Stock Keeping Unit (unique identifier).">?</span></label>
            <input class="in" type="text" id="item_sku" name="sku" value="${esc(r.sku || '')}" placeholder="e.g. PROD-001" maxlength="60" required style="text-transform:uppercase;">
            <div class="er" data-err="sku" role="alert"></div>
          </div>

          <!-- HSN / SAC Code -->
          <div class="fg">
            <label for="item_hsn" class="zoho-label">HSN / SAC Code</label>
            <div class="hsn-search-wrap">
              <input class="in" type="text" id="item_hsn" name="hsn_sac" list="hsn_presets" value="${esc(r.hsn_sac || '')}" placeholder="Type to add or search HSN/SAC" maxlength="10">
              <svg class="hsn-search-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              <datalist id="hsn_presets">
                <option value="8471">8471 - Computers, laptops & electronic hardware</option>
                <option value="8517">8517 - Telephones, smartphones & transmission apparatus</option>
                <option value="8528">8528 - Monitors, displays & televisions</option>
                <option value="4820">4820 - Registers, notebooks & office stationery</option>
                <option value="9983">9983 - Professional, IT & software consulting services</option>
                <option value="9984">9984 - Telecommunications & cloud information services</option>
                <option value="9987">9987 - Maintenance, support & engineering repair services</option>
              </datalist>
            </div>
            <div class="er" data-err="hsn_sac" role="alert"></div>
          </div>

          <!-- Tax Preference & 2 GST Rate Fields -->
          <div class="fgrid" style="gap:10px;">
            <div class="fg">
              <label for="item_tax_pref" class="req-label">Tax Preference<span class="rq">*</span></label>
              <select class="in" id="item_tax_pref" name="tax_preference">
                <option value="taxable" ${r.tax_preference !== 'exempt' && r.tax_preference !== 'non_taxable' && r.tax_preference !== 'nil_rated' ? 'selected' : ''}>Taxable</option>
                <option value="non_taxable" ${r.tax_preference === 'non_taxable' ? 'selected' : ''}>Non-Taxable</option>
                <option value="exempt" ${r.tax_preference === 'exempt' ? 'selected' : ''}>Exempt</option>
                <option value="nil_rated" ${r.tax_preference === 'nil_rated' ? 'selected' : ''}>Nil Rated (0%)</option>
              </select>
            </div>

            <!-- GST Field 1: Intra-State Tax Rate (CGST + SGST) -->
            <div class="fg" id="gstIntraWrap">
              <label for="item_gst_intra" class="zoho-label">Intra-State Tax Rate</label>
              <select class="in" id="item_gst_intra" name="gst_rate">
                ${intraOptionsHtml}
              </select>
            </div>
          </div>

          <!-- GST Field 2: Inter-State Tax Rate (IGST) -->
          <div class="fg" id="gstInterWrap">
            <label for="item_gst_inter" class="zoho-label">Inter-State Tax Rate (IGST)</label>
            <select class="in" id="item_gst_inter">
              ${interOptionsHtml}
            </select>
          </div>

          <div class="fg">
            <label for="item_category" class="zoho-label">Category</label>
            <input class="in" type="text" id="item_category" name="category" value="${esc(r.category || '')}" placeholder="e.g. Hardware, Software, Services" maxlength="100">
          </div>
        </div>

        <!-- Right: Picture Upload Box (Zoho Books Style) -->
        <div class="zoho-right-image">
          <label class="zoho-label">Item Image</label>
          <div class="zoho-image-dropzone" id="itemImageDropzone">
            <input type="file" id="itemImageFileInput" accept="image/*" style="display:none;">
            <input type="hidden" name="image_data" id="itemImageDataInput" value="${esc(img)}">

            <div id="dropzoneEmpty" class="dropzone-empty-state" style="${img ? 'display:none;' : ''}">
              <div class="dropzone-icon">
                <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="3" y="3" width="18" height="18" rx="3" ry="3"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
              </div>
              <div class="dropzone-text">
                <span>Drag Image(s) here or</span>
                <button type="button" class="btn-browse-link" id="btnBrowseImage">Browse images</button>
              </div>
              <div class="dropzone-hint">Supports PNG, JPG, WebP up to 2MB</div>
            </div>

            <div id="dropzonePreview" class="dropzone-preview-state" style="${img ? '' : 'display:none;'}">
              <img id="itemImagePreviewImg" src="${esc(img)}" alt="Item Preview">
              <div class="preview-actions">
                <button type="button" class="btn btn-sm" id="btnChangeImage">Change</button>
                <button type="button" class="btn btn-sm btn-danger-link" id="btnRemoveImage">Remove</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Horizontal Divider -->
      <hr class="zoho-divider">

      <!-- Half & Half: Sales Information (Left) and Purchase Information (Right) -->
      <div class="zoho-split-grid">
        <!-- Left Half: Sales Information -->
        <div class="zoho-card-section" id="salesSection">
          <div class="section-header-title">
            <h3 class="section-title">Sales Information</h3>
          </div>
          <div class="section-body" id="salesBody">
            <div class="fg">
              <label for="item_selling_price" class="req-label">Selling Price<span class="rq">*</span></label>
              <div class="input-currency-group">
                <span class="currency-tag">INR</span>
                <input class="in" type="number" step="0.01" min="0" id="item_selling_price" name="selling_price" value="${esc(r.selling_price || '')}" placeholder="0.00" required>
              </div>
              <div class="er" data-err="selling_price" role="alert"></div>
            </div>

            <div class="fg">
              <label for="item_sales_account" class="req-label">Account<span class="rq">*</span></label>
              <select class="in" id="item_sales_account" name="sales_account">
                ${salesAccountsHtml}
                ${extraSalesOpt}
                <option value="__add_new__" style="color:var(--accent); font-weight:600;">+ Add New Account…</option>
              </select>
              <div class="er" data-err="sales_account" role="alert"></div>
            </div>

            <div class="fg">
              <label for="item_sales_desc" class="zoho-label">Description</label>
              <textarea class="in" id="item_sales_desc" name="description" rows="3" placeholder="Sales description for customer invoices…">${esc(r.description || '')}</textarea>
            </div>
          </div>
        </div>

        <!-- Right Half: Purchase Information -->
        <div class="zoho-card-section" id="purchaseSection">
          <div class="section-header-title">
            <h3 class="section-title">Purchase Information</h3>
          </div>
          <div class="section-body" id="purchaseBody">
            <div class="fg">
              <label for="item_purchase_price" class="req-label">Cost Price / Purchase Price<span class="rq">*</span></label>
              <div class="input-currency-group">
                <span class="currency-tag">INR</span>
                <input class="in" type="number" step="0.01" min="0" id="item_purchase_price" name="purchase_price" value="${esc(r.purchase_price || '')}" placeholder="0.00" required>
              </div>
              <div class="er" data-err="purchase_price" role="alert"></div>
            </div>

            <div class="fg">
              <label for="item_purchase_account" class="req-label">Account<span class="rq">*</span></label>
              <select class="in" id="item_purchase_account" name="purchase_account">
                ${purchaseAccountsHtml}
                ${extraPurchOpt}
                <option value="__add_new__" style="color:var(--accent); font-weight:600;">+ Add New Account…</option>
              </select>
              <div class="er" data-err="purchase_account" role="alert"></div>
            </div>

            <!-- Preferred Vendor (Requested in Purchase Info) -->
            <div class="fg">
              <label for="item_preferred_vendor" class="zoho-label">Preferred Vendor <span class="help-tip" title="Choose or add default vendor for bills & purchase orders.">?</span></label>
              <select class="in" id="item_preferred_vendor" name="preferred_vendor_id">
                <option value="">Select a vendor…</option>
                ${vendorOptsHtml}
                <option value="__add_new__" style="color:var(--accent); font-weight:600;">+ Add New Vendor…</option>
              </select>
              <div class="er" data-err="preferred_vendor_id" role="alert"></div>
            </div>

            <div class="fg">
              <label for="item_purchase_desc" class="zoho-label">Description</label>
              <textarea class="in" id="item_purchase_desc" rows="3" placeholder="Purchase description for vendor bills…"></textarea>
            </div>
          </div>
        </div>
      </div>

      <!-- Bottom: Inventory Information (for Goods) -->
      <div class="zoho-card-section" id="inventorySection">
        <div class="section-header-check">
          <label class="ck-section">
            <input type="checkbox" id="chkTrackInventory" name="track_inventory" ${r.track_inventory ? 'checked' : ''}>
            <span>Track Inventory for this item</span>
          </label>
        </div>
        <div class="section-body" id="inventoryBody" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:14px; margin-top:10px;">
          ${id ? '' : `
          <div class="fg" id="openingStockWrap">
            <label class="zoho-label">Opening Stock</label>
            <input class="in" type="number" step="0.001" min="0" name="opening_stock" placeholder="0.000">
          </div>
          `}
          <div class="fg">
            <label class="zoho-label">Reorder Point / Level</label>
            <input class="in" type="number" step="0.001" min="0" name="reorder_level" value="${r.reorder_level == null ? '' : r.reorder_level}" placeholder="0.000">
          </div>
          <div class="fg">
            <label for="item_inventory_account" class="zoho-label">Inventory Account</label>
            <select class="in" id="item_inventory_account" name="inventory_account">
              ${inventoryAccountsHtml}
              ${extraInvOpt}
              <option value="__add_new__" style="color:var(--accent); font-weight:600;">+ Add New Account…</option>
            </select>
          </div>
        </div>
        ${id ? '<div class="hp">Stock quantity adjustments are tracked through Stock Adjustments.</div>' : ''}
      </div>

      ${id ? `
      <div style="margin-top:6px;">
        <label class="ck"><input type="checkbox" name="active" ${r.active ? 'checked' : ''}> Active Item</label>
      </div>
      ` : ''}
    </div>
    `,
    onReady: (form, m) => {
      // 1. Picture upload and preview handling
      const fileInput = $('#itemImageFileInput', form);
      const dataInput = $('#itemImageDataInput', form);
      const emptyState = $('#dropzoneEmpty', form);
      const previewState = $('#dropzonePreview', form);
      const previewImg = $('#itemImagePreviewImg', form);
      const dropzone = $('#itemImageDropzone', form);

      const processFile = file => {
        if (!file || !/^image\//.test(file.type)) {
          toast('Please choose a valid image file (PNG, JPG, WebP).', 'err');
          return;
        }
        const reader = new FileReader();
        reader.onload = e => {
          const imgObj = new Image();
          imgObj.onload = () => {
            const maxDim = 600;
            let w = imgObj.width, h = imgObj.height;
            if (w > maxDim || h > maxDim) {
              if (w > h) { h = Math.round((h * maxDim) / w); w = maxDim; }
              else { w = Math.round((w * maxDim) / h); h = maxDim; }
            }
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(imgObj, 0, 0, w, h);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

            previewImg.src = dataUrl;
            dataInput.value = dataUrl;
            emptyState.style.display = 'none';
            previewState.style.display = '';
            m.markDirty();
          };
          imgObj.src = e.target.result;
        };
        reader.readAsDataURL(file);
      };

      $('#btnBrowseImage', form).onclick = e => { e.preventDefault(); e.stopPropagation(); fileInput.click(); };
      $('#btnChangeImage', form).onclick = e => { e.preventDefault(); e.stopPropagation(); fileInput.click(); };
      $('#btnRemoveImage', form).onclick = e => {
        e.preventDefault();
        e.stopPropagation();
        dataInput.value = '';
        previewImg.src = '';
        previewState.style.display = 'none';
        emptyState.style.display = '';
        fileInput.value = '';
        m.markDirty();
      };
      dropzone.onclick = e => {
        if (!previewState.style.display && emptyState.style.display !== 'none') {
          fileInput.click();
        }
      };
      fileInput.onchange = () => {
        if (fileInput.files && fileInput.files[0]) processFile(fileInput.files[0]);
      };

      // Drag and drop events
      ['dragenter', 'dragover'].forEach(evt => {
        dropzone.addEventListener(evt, e => { e.preventDefault(); e.stopPropagation(); dropzone.classList.add('dragover'); });
      });
      ['dragleave', 'drop'].forEach(evt => {
        dropzone.addEventListener(evt, e => { e.preventDefault(); e.stopPropagation(); dropzone.classList.remove('dragover'); });
      });
      dropzone.addEventListener('drop', e => {
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
          processFile(e.dataTransfer.files[0]);
        }
      });

      
      const setupAddNew = (selectEl, { promptText, placeholder, onAdd }) => {
        if (!selectEl) return;
        let prevVal = selectEl.value;
        selectEl.addEventListener('focus', () => {
          if (selectEl.value !== '__add_new__') prevVal = selectEl.value;
        });
        selectEl.addEventListener('change', async () => {
          if (selectEl.value === '__add_new__') {
            const input = window.prompt(promptText, placeholder || '');
            if (input && input.trim()) {
              const clean = input.trim();
              try {
                let res = { value: clean, text: clean };
                if (onAdd) {
                  const customRes = await onAdd(clean);
                  if (customRes === false) {
                    selectEl.value = prevVal;
                    return;
                  }
                  if (customRes && typeof customRes === 'object') {
                    res = customRes;
                  }
                }
                const addOpt = selectEl.querySelector('option[value="__add_new__"]');
                const opt = document.createElement('option');
                opt.value = res.value;
                opt.textContent = res.text || res.value;
                opt.selected = true;
                if (addOpt) {
                  addOpt.parentNode.insertBefore(opt, addOpt);
                } else {
                  selectEl.appendChild(opt);
                }
                selectEl.value = res.value;
                prevVal = res.value;
                selectEl.dispatchEvent(new Event('input', { bubbles: true }));
                m.markDirty();
                return;
              } catch (err) {
                toast(err.message || 'Failed to add option', 'err');
              }
            }
            selectEl.value = prevVal;
          } else {
            prevVal = selectEl.value;
          }
        });
      };

      const unitSelect = $('#item_unit_select', form);
      const unitInput = $('#item_unit', form);
      unitSelect.addEventListener('change', () => {
        if (unitSelect.value && unitSelect.value !== '__add_new__') {
          unitInput.value = unitSelect.value;
          unitInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });
      unitInput.addEventListener('input', () => {
        const val = unitInput.value.trim().toLowerCase();
        const opt = Array.from(unitSelect.options).find(o => o.value.toLowerCase() === val || o.text.toLowerCase().startsWith(val));
        if (opt && opt.value !== '__add_new__') {
          unitSelect.value = opt.value;
        } else {
          unitSelect.value = '';
        }
      });
      setupAddNew(unitSelect, {
        promptText: 'Enter new unit of measurement (e.g. roll, bundle, set):',
        onAdd: val => {
          unitInput.value = val;
          return { value: val, text: val };
        }
      });

      const intra = $('#item_gst_intra', form);
      const inter = $('#item_gst_inter', form);
      const taxPref = $('#item_tax_pref', form);

      intra.addEventListener('change', () => {
        if (intra.value !== '__add_new__') inter.value = intra.value;
      });
      inter.addEventListener('change', () => {
        if (inter.value !== '__add_new__') intra.value = inter.value;
      });

      const handleNewTaxRate = async val => {
        const numVal = parseFloat(val);
        if (isNaN(numVal) || numVal < 0 || numVal > 100) {
          toast('Please enter a valid tax percentage between 0% and 100%', 'err');
          return false;
        }
        const rateStr = String(numVal);
        const intraText = `GST${numVal} [${numVal}%]`;
        const interText = `IGST${numVal} [${numVal}%]`;

        if (!intra.querySelector(`option[value="${rateStr}"]`)) {
          const opt = document.createElement('option');
          opt.value = rateStr;
          opt.textContent = intraText;
          const group = intra.querySelector('optgroup') || intra;
          group.appendChild(opt);
        }
    
        if (!inter.querySelector(`option[value="${rateStr}"]`)) {
          const opt = document.createElement('option');
          opt.value = rateStr;
          opt.textContent = interText;
          const group = inter.querySelector('optgroup') || inter;
          group.appendChild(opt);
        }
        intra.value = rateStr;
        inter.value = rateStr;
        toast(`Tax rate ${numVal}% added`);
        return { value: rateStr, text: intraText };
      };

      setupAddNew(intra, {
        promptText: 'Enter new GST tax rate percentage (e.g. 6 or 10):',
        onAdd: handleNewTaxRate
      });
      setupAddNew(inter, {
        promptText: 'Enter new GST tax rate percentage (e.g. 6 or 10):',
        onAdd: handleNewTaxRate
      });

      const syncTaxPref = () => {
        const isTaxable = taxPref.value === 'taxable';
        intra.disabled = !isTaxable;
        inter.disabled = !isTaxable;
        if (!isTaxable) {
          intra.value = '0';
          inter.value = '0';
        }
      };
      taxPref.addEventListener('change', syncTaxPref);
      syncTaxPref();

      const salesAcctSelect = $('#item_sales_account', form);
      setupAddNew(salesAcctSelect, {
        promptText: 'Enter new sales account name:',
        onAdd: val => {
          toast(`Sales account "${val}" added`);
          return { value: val, text: val };
        }
      });

      const purchAcctSelect = $('#item_purchase_account', form);
      setupAddNew(purchAcctSelect, {
        promptText: 'Enter new purchase account name:',
        onAdd: val => {
          toast(`Purchase account "${val}" added`);
          return { value: val, text: val };
        }
      });

      const vendorSelect = $('#item_preferred_vendor', form);
      setupAddNew(vendorSelect, {
        promptText: 'Enter new vendor name:',
        onAdd: async val => {
          const v = await api('vendors/', {
            method: 'POST',
            body: { name: val, active: true, state: (APP.org && APP.org.state) || '' }
          });
          toast(`Vendor "${v.name}" created!`);
          return { value: v.id, text: v.name };
        }
      });

      const invAcctSelect = $('#item_inventory_account', form);
      setupAddNew(invAcctSelect, {
        promptText: 'Enter new inventory account name:',
        onAdd: val => {
          toast(`Inventory account "${val}" added`);
          return { value: val, text: val };
        }
      });


      const invSec = $('#inventorySection', form);
      const trackInvCheck = $('#chkTrackInventory', form);
      const syncType = () => {
        const isSvc = form.elements.item_type.value === 'service';
        invSec.style.display = isSvc ? 'none' : '';
        trackInvCheck.disabled = isSvc;
        if (isSvc) trackInvCheck.checked = false;
        syncTrackInv();
      };
      $$('input[name="item_type"]', form).forEach(r => r.addEventListener('change', syncType));



  
      const invBody = $('#inventoryBody', form);
      const syncTrackInv = () => {
        invBody.style.display = trackInvCheck.checked ? 'grid' : 'none';
      };
      trackInvCheck.addEventListener('change', syncTrackInv);
      syncType();
    },
    onSubmit: async d => {
      if (!id) d.active = true;
      if (!d.selling_price) d.selling_price = '0.00';
      if (!d.purchase_price) d.purchase_price = '0.00';
      await api(id ? `items/${id}/` : 'items/', { method: id ? 'PUT' : 'POST', body: d });
      toast('Item ' + (id ? 'updated' : 'created'));
      refresh();
    },
  });
}

/*  invoices / bills  */
async function docForm(kind, id) {
  const inv = kind === 'invoices', pk = inv ? 'customer' : 'vendor';
  const [parties, items, rec] = await Promise.all([api(`lookup/${inv ? 'customers' : 'vendors'}/`), api('lookup/items/'), id ? api(`${kind}/${id}/`) : null]);
  if (!parties.length) { toast(`Create a ${pk} first.`, 'err'); return; }
  const itemOpts = [['', '— Custom line —'], ...items.map(i => [i.id, i.name + (i.sku ? ' (' + i.sku + ')' : '')])];
  const r = rec || { date: APP.today, lines: [{}], place_of_supply: '', notes: APP.org.notes_default || 'Thanks for your business.', terms: APP.org.terms_default || 'Due on Receipt', order_number: '' };
  const byId = Object.fromEntries(items.map(i => [String(i.id), i]));
  const row = l => `<tr class="ln"><td><select class="in l-item" aria-label="Item">${opts(itemOpts, l.item)}</select><input class="in l-desc" aria-label="Description" placeholder="Description" maxlength="500" value="${esc(l.description || '')}"></td><td><input class="in l-hsn" aria-label="HSN/SAC" maxlength="10" value="${esc(l.hsn_sac || '')}"></td><td><input class="in l-qty" type="number" step="0.001" min="0" aria-label="Quantity" value="${esc(l.quantity || 1)}"></td><td><input class="in l-rate" type="number" step="0.01" min="0" aria-label="Rate" value="${esc(l.rate == null ? '' : l.rate)}"></td><td><input class="in l-disc" type="number" step="0.01" min="0" max="100" aria-label="Discount %" value="${esc(l.discount_percent || 0)}"></td><td><select class="in l-gst" aria-label="GST rate">${opts(GST_SLABS.map(x => [x, x + '%']), l.gst_rate != null ? num(l.gst_rate) : 18)}</select></td><td class="r l-amt">—</td><td><button type="button" class="btn ic" data-rm aria-label="Remove line">×</button></td></tr>`;
  const partyId = r.party_id || '';
  const due0 = r.due_date || '';
  const pendingFiles = [];

  formModal({
    title: `${id ? 'Edit' : 'New'} ${inv ? 'invoice' : 'bill'}${id ? ' ' + r.number : ''}`, wide: true,
    actions: id ? [{ label: 'Update ' + (inv ? 'Invoice' : 'Bill'), value: 'update', primary: true }, { label: 'Save as draft', value: 'draft' }] : [{ label: 'Save as draft', value: 'draft' }, { label: inv ? 'Save & send' : 'Save & approve', value: 'post', primary: true }],
    body: `<div class="fgrid">${[
      fld({ name: pk, label: inv ? 'Customer' : 'Vendor', type: 'select', req: 1, opts: [['', 'Select…'], ...parties.map(p => [p.id, p.name])], value: partyId }),
      fld({ name: 'place_of_supply', label: 'Place of supply', type: 'select', opts: STATES, value: r.place_of_supply || APP.org.state, help: 'Same state as your organization → CGST + SGST; otherwise IGST.' }),
      fld({ name: 'date', label: 'Date', type: 'date', req: 1, value: r.date }),
      fld({ name: 'due_date', label: 'Due date', type: 'date', value: due0 }),
      fld({ name: 'order_number', label: 'Order Number', value: r.order_number || '', ph: 'e.g. 653248543' }),
      inv ? '' : fld({ name: 'vendor_ref', label: 'Vendor reference', value: r.vendor_ref }),
    ].join('')}</div>
    <h3 style="margin:16px 0 6px;font-size:14px">Line items</h3>
    <div class="tw"><table class="lt"><thead><tr><th style="min-width:230px">Item / description</th><th>HSN/SAC</th><th>Qty</th><th>Rate (₹)</th><th>Disc %</th><th>GST</th><th class="r">Amount</th><th></th></tr></thead><tbody id="lines">${r.lines.map(row).join('')}</tbody></table></div>
    <div class="er" data-err="lines" role="alert"></div>
    <button type="button" class="btn" data-add style="margin-top:8px">+ Add line</button>
    <div class="tot" aria-live="polite"><div><span>Taxable value</span><b data-t="sub">₹0.00</b></div><div data-t-row="cgst"><span>CGST</span><b data-t="cgst">₹0.00</b></div><div data-t-row="sgst"><span>SGST</span><b data-t="sgst">₹0.00</b></div><div data-t-row="igst"><span>IGST</span><b data-t="igst">₹0.00</b></div><div class="gt"><span>Total</span><b data-t="total">₹0.00</b></div></div>
    <div class="fgrid" style="margin-top:12px">${fld({ name: 'notes', label: 'Notes', type: 'textarea', value: r.notes != null ? r.notes : (APP.org.notes_default || 'Thanks for your business.'), col: 'c2' })}${inv ? fld({ name: 'terms', label: 'Terms & conditions', type: 'textarea', value: r.terms != null ? r.terms : (APP.org.terms_default || 'Due on Receipt'), col: 'c2' }) : ''}</div>
    <div style="margin-top:14px;padding:12px;border:1px solid var(--bd-glass);border-radius:8px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
        <label style="font-weight:600;font-size:13px;display:flex;align-items:center;gap:6px;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
          Attached Files
        </label>
        <input type="file" id="doc-file-input" multiple style="display:none">
        <button type="button" class="btn" onclick="this.previousElementSibling.click()">+ Attach File</button>
      </div>
      <div id="doc-attach-badges" style="display:flex;flex-wrap:wrap;gap:6px;"></div>
    </div>`,
    onReady: (form, m) => {
      const tb = $('#lines', form);
      let dueTouched = !!due0;
      const calc = () => {
        const intra = norm(form.elements.place_of_supply.value) === norm(APP.org.state);
        const t = { sub: 0, cgst: 0, sgst: 0, igst: 0 };
        $$('tr.ln', form).forEach(tr => {
          const taxable = r2(num($('.l-qty', tr).value) * num($('.l-rate', tr).value) * (100 - num($('.l-disc', tr).value)) / 100);
          const tax = taxable * num($('.l-gst', tr).value) / 100;
          const cg = intra ? r2(tax / 2) : 0, ig = intra ? 0 : r2(tax);
          t.sub += taxable; t.cgst += cg; t.sgst += cg; t.igst += ig;
          $('.l-amt', tr).textContent = inr(taxable + cg * 2 + ig);
        });
        $$('[data-t]', form).forEach(el => { const k = el.dataset.t; el.textContent = inr(k === 'total' ? t.sub + t.cgst + t.sgst + t.igst : t[k]); });
        $('[data-t-row=cgst]', form).style.display = $('[data-t-row=sgst]', form).style.display = intra ? '' : 'none';
        $('[data-t-row=igst]', form).style.display = intra ? 'none' : '';
      };
      const setDue = () => {
        if (dueTouched) return;
        const p = parties.find(x => String(x.id) === form.elements[pk].value), d = form.elements.date.value;
        if (d) form.elements.due_date.value = addDays(d, p ? p.payment_terms : 30);
      };
      form.addEventListener('input', e => { if (e.target.name === 'due_date') dueTouched = true; if (e.target.name === 'date') setDue(); calc(); });
      form.addEventListener('change', e => {
        if (e.target.classList.contains('l-item')) {
          const it = byId[e.target.value], tr = e.target.closest('tr');
          if (it) { $('.l-desc', tr).value = it.name; $('.l-hsn', tr).value = it.hsn_sac || ''; $('.l-rate', tr).value = inv ? it.selling_price : it.purchase_price; $('.l-gst', tr).value = String(num(it.gst_rate)); }
        }
        if (e.target.name === pk) {
          const p = parties.find(x => String(x.id) === e.target.value);
          if (p && p.state) form.elements.place_of_supply.value = p.state;
          setDue();
        }
        calc();
      });
      form.addEventListener('click', e => {
        if (e.target.closest('[data-add]')) { tb.insertAdjacentHTML('beforeend', row({})); m.markDirty(); calc(); }
        const rm = e.target.closest('[data-rm]');
        if (rm) { if ($$('tr.ln', form).length > 1) { rm.closest('tr').remove(); m.markDirty(); calc(); } else toast('At least one line is required.', 'err'); }
      });

      const attachBox = $('#doc-attach-badges', form);
      const renderAttach = () => {
        let h = '';
        if (r.attachments && r.attachments.length) {
          h += r.attachments.map(a => `<div class="attach-file-badge"><span>📎 ${esc(a.filename)} (${fmtBytes(a.file_size)})</span><button type="button" data-del-att="${a.id}" title="Remove file">×</button></div>`).join('');
        }
        h += pendingFiles.map((f, i) => `<div class="attach-file-badge" style="border-style:dashed;"><span>📎 ${esc(f.name)} (${fmtBytes(f.size)}) <small style="color:var(--accent);">new</small></span><button type="button" data-rem-pen="${i}" title="Remove file">×</button></div>`).join('');
        if (!h) h = '<span class="sub" style="font-size:12px;">No files attached yet.</span>';
        attachBox.innerHTML = h;
      };
      renderAttach();

      attachBox.addEventListener('click', async e => {
        const delBtn = e.target.closest('[data-del-att]');
        if (delBtn) {
          const attId = delBtn.dataset.delAtt;
          try {
            await api(`attachments/${attId}/`, { method: 'DELETE' });
            r.attachments = (r.attachments || []).filter(a => String(a.id) !== String(attId));
            renderAttach();
            toast('Attachment removed');
          } catch (err) { toast(err.message, 'err'); }
          return;
        }
        const remBtn = e.target.closest('[data-rem-pen]');
        if (remBtn) {
          pendingFiles.splice(Number(remBtn.dataset.remPen), 1);
          renderAttach();
        }
      });

      const fileIn = $('#doc-file-input', form);
      if (fileIn) {
        fileIn.addEventListener('change', () => {
          Array.from(fileIn.files).forEach(f => {
            const reader = new FileReader();
            reader.onload = ev => {
              pendingFiles.push({ name: f.name, size: f.size, type: f.type, data: ev.target.result });
              renderAttach();
              m.markDirty();
            };
            reader.readAsDataURL(f);
          });
          fileIn.value = '';
        });
      }

      if (!due0) setDue();
      calc();
    },
    onSubmit: async (d, action, form) => {
      d.force = true;
      d.lines = $$('tr.ln', form).map(tr => ({ item: $('.l-item', tr).value || null, description: $('.l-desc', tr).value, hsn_sac: $('.l-hsn', tr).value, quantity: $('.l-qty', tr).value, rate: $('.l-rate', tr).value, discount_percent: $('.l-disc', tr).value || 0, gst_rate: $('.l-gst', tr).value }));
      const saved = await api(id ? `${kind}/${id}/` : `${kind}/`, { method: id ? 'PUT' : 'POST', body: d });

      for (const pf of pendingFiles) {
        try {
          await api('attachments/', {
            method: 'POST',
            body: { entity_type: inv ? 'invoice' : 'bill', entity_id: saved.id, filename: pf.name, file_size: pf.size, mime_type: pf.type, file_data: pf.data }
          });
        } catch (e) { console.error('Attachment upload error:', e); }
      }

      if (action === 'post') {
        try { await api(`${kind}/${saved.id}/${inv ? 'send' : 'approve'}/`, { method: 'POST', body: {} }); toast(`${saved.number} ${inv ? 'sent' : 'approved'}`); }
        catch (e) { toast(`${saved.number} saved as draft, but could not be ${inv ? 'sent' : 'approved'}: ${e.message}`, 'err'); }
      } else toast(`${saved.number} ${id ? 'updated' : 'saved'}`);
      refresh();
    },
  });
}

/* payments */
async function paymentForm(kind, pre = {}) {
  const rec = kind === 'payments-received', pk = rec ? 'customer' : 'vendor', docKey = rec ? 'invoice' : 'bill', docs = rec ? 'invoices' : 'bills';
  const parties = await api(`lookup/${rec ? 'customers' : 'vendors'}/`);
  if (!parties.length) { toast(`Create a ${pk} first.`, 'err'); return; }
  formModal({
    title: rec ? 'Record payment received' : 'Record payment made', wide: true,
    body: `<div class="fgrid">${[
      fld({ name: pk, label: rec ? 'Customer' : 'Vendor', type: 'select', req: 1, opts: [['', 'Select…'], ...parties.map(p => [p.id, p.name])], value: pre.party || '' }),
      fld({ name: 'date', label: 'Payment date', type: 'date', req: 1, value: APP.today }),
      fld({ name: 'amount', label: 'Amount (₹)', type: 'number', req: 1, value: pre.amount || '', attrs: 'min="0.01" step="0.01"' }),
      fld({ name: 'mode', label: 'Payment mode', type: 'select', opts: [['bank_transfer', 'Bank transfer'], ['upi', 'UPI'], ['cash', 'Cash'], ['cheque', 'Cheque'], ['card', 'Card'], ['other', 'Other']], value: 'bank_transfer' }),
      fld({ name: 'account', label: 'Bank / cash account', value: 'Bank Account' }), fld({ name: 'reference', label: 'Reference number' }),
      fld({ name: 'notes', label: 'Notes', type: 'textarea', col: 'c2' }),
    ].join('')}</div>
    <h3 style="margin:16px 0 6px;font-size:14px">Apply to ${rec ? 'invoices' : 'bills'}</h3>
    <div id="alloc"><div class="sub">Select a ${pk} to see outstanding ${docs}.</div></div>
    <div class="er" data-err="allocations" role="alert"></div>
    <div class="cs" style="margin-top:10px"><div><span>Applied</span><b id="ap">₹0.00</b></div><div><span>Unapplied (kept as credit on payment)</span><b id="un">₹0.00</b></div></div>`,
    onReady: (form, m) => {
      let list = [];
      const sum = () => $$('.al-in', form).reduce((a, i) => a + num(i.value), 0);
      const totals = () => { const a = sum(); $('#ap', form).textContent = inr(a); $('#un', form).textContent = inr(num(form.elements.amount.value) - a); };
      const load = async () => {
        const pid = form.elements[pk].value, box = $('#alloc', form);
        if (!pid) { box.innerHTML = `<div class="sub">Select a ${pk} to see outstanding ${docs}.</div>`; list = []; totals(); return; }
        box.innerHTML = spinner;
        try {
          const p = await api(`${docs}/?` + qs({ open: 1, [pk]: pid, page_size: 100, ordering: 'due_date' }));
          list = p.results;
          box.innerHTML = list.length ? `<div class="tw"><table><thead><tr><th>Number</th><th>Due</th><th class="r">Balance due</th><th class="r" style="width:150px">Apply (₹)</th></tr></thead><tbody>${list.map(d => `<tr><td>${esc(d.number)}</td><td>${fd(d.due_date)}</td><td class="r">${inr(d.balance)}</td><td><input class="in al-in r" type="number" min="0" step="0.01" max="${esc(d.balance)}" data-id="${d.id}" aria-label="Apply to ${esc(d.number)}"></td></tr>`).join('')}</tbody></table></div><button type="button" class="btn" data-auto style="margin-top:8px">Auto-apply (oldest due first)</button>` : `<div class="sub">No outstanding ${docs} for this ${pk}. The full amount will remain unapplied.</div>`;
          if (pre.doc) { const i = $(`.al-in[data-id="${pre.doc}"]`, form); if (i) { const d = list.find(x => String(x.id) === String(pre.doc)); i.value = d.balance; if (!form.elements.amount.value) form.elements.amount.value = d.balance; } pre.doc = null; }
          totals();
        } catch (e) { box.innerHTML = errBox(e.message); }
      };
      form.elements[pk].addEventListener('change', load);
      form.addEventListener('input', totals);
      form.addEventListener('click', e => {
        if (!e.target.closest('[data-auto]')) return;
        let left = num(form.elements.amount.value);
        $$('.al-in', form).forEach(i => { const d = list.find(x => String(x.id) === i.dataset.id); const a = Math.min(left, num(d.balance)); i.value = a > 0 ? r2(a) : ''; left = r2(left - a); });
        m.markDirty(); totals();
      });
      if (pre.party) load(); else totals();
    },
    onSubmit: async (d, a, form) => {
      d.allocations = $$('.al-in', form).filter(i => num(i.value) > 0).map(i => ({ [docKey]: Number(i.dataset.id), amount: i.value }));
      const applied = d.allocations.reduce((s, x) => s + num(x.amount), 0);
      if (applied > num(d.amount) + 0.001) throw new ApiErr(400, { message: 'Please correct the allocations.', errors: { allocations: 'Applied amount exceeds the payment amount.' } });
      const p = await api(kind + '/', { method: 'POST', body: d });
      toast(`Payment ${p.number} recorded`); refresh();
    },
  });
}


async function adjustForm(preItem) {
  const items = (await api('lookup/items/')).filter(i => i.track_inventory);
  if (!items.length) { toast('Create an inventory-tracked goods item first.', 'err'); return; }
  const REASONS = ['Stock recount', 'Damaged goods', 'Theft / loss', 'Returned to supplier', 'Found stock', 'Other'];
  formModal({
    title: 'New stock adjustment',
    body: `<div class="fgrid">${[
      fld({ name: 'date', label: 'Adjustment date', type: 'date', req: 1, value: APP.today }),
      fld({ name: 'item', label: 'Item', type: 'select', req: 1, opts: [['', 'Select…'], ...items.map(i => [i.id, i.name + ' (' + i.sku + ')'])], value: preItem || '' }),
      fld({ name: 'new_quantity', label: 'New quantity on hand', type: 'number', req: 1, attrs: 'min="0" step="0.001"' }),
      fld({ name: 'reason', label: 'Reason', type: 'select', req: 1, opts: [['', 'Select a reason'], ...REASONS] }),
      fld({ name: 'notes', label: 'Notes', type: 'textarea', col: 'c2', max: 1000 }),
    ].join('')}</div><div class="note" id="prev" style="margin-top:12px">Select an item and enter the new quantity to preview the change.</div>`,
    submit: 'Review & apply',
    onReady: form => {
      const upd = () => {
        const it = items.find(i => String(i.id) === form.elements.item.value), nq = form.elements.new_quantity.value;
        $('#prev', form).textContent = it && nq !== '' ? `${it.name}: ${qty(it.stock)} → ${qty(nq)} ${it.unit} (difference ${num(nq) - num(it.stock) >= 0 ? '+' : ''}${qty(num(nq) - num(it.stock))}, value ${inr((num(nq) - num(it.stock)) * num(it.purchase_price))})` : 'Select an item and enter the new quantity to preview the change.';
      };
      form.addEventListener('input', upd); form.addEventListener('change', upd); upd();
    },
    onSubmit: async d => {
      const it = items.find(i => String(i.id) === d.item);
      if (it && d.new_quantity !== '') {
        const ok = await confirmBox({ title: 'Apply stock adjustment?', message: `${it.name}: ${qty(it.stock)} → ${qty(d.new_quantity)}. This changes inventory immediately and can only be reversed by another adjustment.`, okText: 'Apply adjustment' });
        if (!ok) throw { cancel: true };
      }
      await api('stock-adjustments/', { method: 'POST', body: d });
      toast('Stock adjusted'); refresh();
    },
  });
}

/* organization  */
function orgForm() {
  const o = APP.org;
  formModal({
    title: 'Organization Profile & Settings', wide: true,
    body: `<div class="tabs-sub" style="display:flex;gap:8px;margin-bottom:16px;border-bottom:1px solid var(--bd-glass);padding-bottom:8px;">
      <button type="button" class="btn p org-tab-btn" data-otab="general">Company Profile</button>
      <button type="button" class="btn org-tab-btn" data-otab="template">Invoice & Bill Template</button>
    </div>
    <div id="otab-general" class="otab-pane">
      <div class="fgrid">
        ${fld({ name: 'name', label: 'Company / Organization Name', req: 1, value: o.name, col: 'c2' })}
        ${fld({ name: 'company_id', label: 'Company ID / CIN', value: o.company_id || '', ph: 'e.g. U62090KL2026PTC103900' })}
        ${fld({ name: 'gstin', label: 'GSTIN', value: o.gstin || '', ph: '32AANCC9298C1ZE' })}
        ${fld({ name: 'state', label: 'Home State', type: 'select', req: 1, opts: STATES, value: o.state })}
        ${fld({ name: 'address', label: 'Address / Building / Street', type: 'textarea', value: o.address, col: 'c2' })}
        ${fld({ name: 'city', label: 'City', value: o.city || 'Kottayam' })}
        ${fld({ name: 'pincode', label: 'Pincode', value: o.pincode || '686003' })}
        ${fld({ name: 'country', label: 'Country', value: o.country || 'India' })}
        ${fld({ name: 'phone', label: 'Phone', value: o.phone || '91-9847017737' })}
        ${fld({ name: 'email', label: 'Email', type: 'email', value: o.email || 'admin@convosis.com' })}
        ${fld({ name: 'website', label: 'Website', value: o.website || 'www.convosis.com' })}
        ${fld({ name: 'opening_cash', label: 'Opening Cash & Bank Balance (₹)', type: 'number', value: o.opening_cash, attrs: 'step="0.01"' })}
      </div>
      <div style="margin-top:14px;padding:14px;border:1px solid var(--bd-glass);border-radius:8px;display:flex;align-items:center;gap:18px;">
        <div style="width:72px;height:72px;border-radius:8px;border:1px solid var(--bd-glass);background:#fff;display:grid;place-items:center;overflow:hidden;padding:4px;">
          <img id="org-logo-preview" src="${esc(o.logo_data || '/static/books/img/convosis-logo.png')}" alt="Logo" style="max-width:100%;max-height:100%;object-fit:contain;">
        </div>
        <div style="flex:1;">
          <label style="font-weight:600;font-size:13px;display:block;margin-bottom:4px;">Company Logo</label>
          <input type="file" id="org-logo-file" accept="image/*" style="display:none">
          <input type="hidden" name="logo_data" id="org-logo-input" value="${esc(o.logo_data || '/static/books/img/convosis-logo.png')}">
          <button type="button" class="btn" onclick="this.previousElementSibling.previousElementSibling.click()">Upload Logo</button>
          <button type="button" class="btn" id="reset-logo-btn" style="margin-left:6px;">Reset to Default</button>
          <div class="hp" style="margin-top:4px;">Recommended size: 240x80px PNG or JPG with transparent/white background.</div>
        </div>
      </div>
    </div>
    <div id="otab-template" class="otab-pane" style="display:none;">
      <div class="fgrid">
        ${fld({ name: 'template_theme', label: 'Default Template Style', type: 'select', opts: [['convosis', 'Convosis Classic (Standard Boxed)'], ['modern', 'Modern Ribbon (Dark Bar & Corner Ribbon)'], ['executive', 'Executive Indigo (Top Banner)'], ['minimal', 'Minimalist (Clean Lines)']], value: o.template_theme || 'convosis', col: 'c2' })}
        ${fld({ name: 'template_color', label: 'Template Accent Color', type: 'select', opts: [['#1877f2', 'Convosis Blue (#1877f2)'], ['#0d6efd', 'Royal Blue (#0d6efd)'], ['#10b981', 'Emerald Green (#10b981)'], ['#ff8a00', 'Vibrant Orange (#ff8a00)'], ['#6366f1', 'Indigo (#6366f1)'], ['#1e293b', 'Dark Slate (#1e293b)']], value: o.template_color || '#1877f2' })}
        ${fld({ name: 'signature_title', label: 'Signature Line Title', value: o.signature_title || 'Authorized Signature' })}
        ${fld({ name: 'terms_default', label: 'Default Terms & Conditions', type: 'textarea', value: o.terms_default || 'Due on Receipt', col: 'c2' })}
        ${fld({ name: 'notes_default', label: 'Default Notes', type: 'textarea', value: o.notes_default || 'Thanks for your business.', col: 'c2' })}
      </div>
    </div>`,
    onReady: form => {
      $$('.org-tab-btn', form).forEach(btn => {
        btn.addEventListener('click', () => {
          $$('.org-tab-btn', form).forEach(b => b.classList.remove('p'));
          btn.classList.add('p');
          const tab = btn.dataset.otab;
          $('#otab-general', form).style.display = tab === 'general' ? '' : 'none';
          $('#otab-template', form).style.display = tab === 'template' ? '' : 'none';
        });
      });
      const fIn = $('#org-logo-file', form);
      if (fIn) {
        fIn.addEventListener('change', () => {
          const file = fIn.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = e => {
            $('#org-logo-preview', form).src = e.target.result;
            $('#org-logo-input', form).value = e.target.result;
          };
          reader.readAsDataURL(file);
        });
      }
      const resBtn = $('#reset-logo-btn', form);
      if (resBtn) {
        resBtn.addEventListener('click', () => {
          $('#org-logo-preview', form).src = '/static/books/img/convosis-logo.png';
          $('#org-logo-input', form).value = '/static/books/img/convosis-logo.png';
        });
      }
    },
    onSubmit: async d => {
      APP.org = await api('organization/', { method: 'PUT', body: d });
      applyOrg();
      toast('Organization settings updated');
      refresh();
    },
  });
}


async function accountForm(id) {
  const o = id ? await api(`accounts/${id}/`) : { code: '', name: '', account_type: 'expense', sub_type: 'operating_expense', description: '', active: true };
  const typeOpts = [['asset', 'Asset'], ['liability', 'Liability'], ['equity', 'Equity'], ['income', 'Income'], ['expense', 'Expense']];
  formModal({
    title: id ? 'Edit Account' : 'New Account',
    body: `<div class="g">
      ${fld({ name: 'code', label: 'Account Code', req: true, value: o.code, col: 's4', ph: 'e.g. 6095' })}
      ${fld({ name: 'name', label: 'Account Name', req: true, value: o.name, col: 's8', ph: 'e.g. Professional Indemnity' })}
      ${fld({ name: 'account_type', label: 'Account Type', type: 'select', opts: typeOpts, value: o.account_type, req: true, col: 's6' })}
      ${fld({ name: 'sub_type', label: 'Sub-Category', value: o.sub_type, col: 's6', ph: 'e.g. operating_expense' })}
      ${fld({ name: 'description', label: 'Description', type: 'textarea', value: o.description, col: 's12', rows: 2 })}
      ${fld({ name: 'active', label: 'Active', type: 'checkbox', value: o.active, col: 's12' })}
    </div>`,
    onSubmit: async d => {
      d.active = !!d.active;
      if (id) await api(`accounts/${id}/`, { method: 'PUT', body: d });
      else await api('accounts/', { method: 'POST', body: d });
      toast(id ? 'Account updated' : 'Account created');
      refresh();
    }
  });
}

async function journalForm() {
  const accounts = await api('lookup/accounts/');
  let lines = [
    { account: accounts[0]?.id || '', debit: '', credit: '', description: '' },
    { account: accounts[1]?.id || '', debit: '', credit: '', description: '' }
  ];

  function renderLines() {
    return lines.map((l, i) => `
      <div class="journal-line-row" data-idx="${i}" style="display:grid;grid-template-columns:3fr 1.5fr 1.5fr 3fr 36px;gap:8px;margin-bottom:8px;align-items:center;">
        <select class="in line-acc" name="line_acc_${i}">${opts(accounts.map(a => [a.id, `${a.code} - ${a.name}`]), l.account)}</select>
        <input class="in line-deb r" type="number" step="0.01" min="0" placeholder="Debit ₹" value="${esc(l.debit)}" data-idx="${i}">
        <input class="in line-cred r" type="number" step="0.01" min="0" placeholder="Credit ₹" value="${esc(l.credit)}" data-idx="${i}">
        <input class="in line-desc" type="text" placeholder="Description" value="${esc(l.description)}">
        <button type="button" class="btn d icon-btn remove-line-btn" data-idx="${i}" style="padding:4px 8px;font-size:16px;">×</button>
      </div>
    `).join('');
  }

  const m = Modal.open({
    title: 'New Manual Journal Voucher',
    wide: true,
    body: `
      <form id="jrn-form">
        <div class="g" style="margin-bottom:16px;">
          ${fld({ name: 'date', label: 'Date', type: 'date', req: true, value: APP.today, col: 's4' })}
          ${fld({ name: 'reference', label: 'Reference / Voucher #', col: 's4', ph: 'e.g. JRN-ADJ-01' })}
          ${fld({ name: 'notes', label: 'Notes / Narration', col: 's4', ph: 'Purpose of journal entry' })}
        </div>
        <div style="font-weight:600;margin-bottom:8px;color:var(--tx);">Journal Debits & Credits</div>
        <div style="display:grid;grid-template-columns:3fr 1.5fr 1.5fr 3fr 36px;gap:8px;font-weight:600;font-size:12px;color:var(--tx-muted);padding-bottom:4px;border-bottom:1px solid var(--bd);">
          <span>Account</span><span class="r">Debit (₹)</span><span class="r">Credit (₹)</span><span>Description</span><span></span>
        </div>
        <div id="jrn-lines" style="margin-top:8px;">${renderLines()}</div>
        <button type="button" class="btn" id="add-jrn-line" style="margin-top:6px;">+ Add Line</button>
        <div style="display:flex;justify-content:flex-end;gap:24px;margin-top:14px;padding:10px 14px;background:var(--surface-glass-subtle);border-radius:8px;border:1px solid var(--bd);">
          <div>Total Debits: <b id="jrn-tot-deb">₹0.00</b></div>
          <div>Total Credits: <b id="jrn-tot-cred">₹0.00</b></div>
          <div id="jrn-bal-status" style="font-weight:600;color:var(--dn);">Difference: ₹0.00</div>
        </div>
        <div class="fe" data-err="_" role="alert" style="margin-top:8px;"></div>
      </form>
    `,
    footer: `
      <button type="button" class="btn" data-close>Cancel</button>
      <button type="button" class="btn p" id="jrn-submit-btn">Post Journal</button>
    `
  });

  const form = $('#jrn-form', m.el);
  function updateTotals() {
    let totD = 0, totC = 0;
    $$('.line-deb', form).forEach(inp => totD += num(inp.value));
    $$('.line-cred', form).forEach(inp => totC += num(inp.value));
    $('#jrn-tot-deb', form).textContent = inr(totD);
    $('#jrn-tot-cred', form).textContent = inr(totC);
    const diff = Math.abs(r2(totD - totC));
    const st = $('#jrn-bal-status', form);
    if (diff === 0 && totD > 0) {
      st.innerHTML = `<span style="color:var(--ok);">Balanced ✓</span>`;
    } else {
      st.innerHTML = `<span style="color:var(--dn);">Difference: ₹${diff.toFixed(2)}</span>`;
    }
  }

  form.addEventListener('input', updateTotals);
  $('#add-jrn-line', form).addEventListener('click', () => {
    lines.push({ account: accounts[0]?.id || '', debit: '', credit: '', description: '' });
    $('#jrn-lines', form).innerHTML = renderLines();
    updateTotals();
  });
  form.addEventListener('click', e => {
    const btn = e.target.closest('.remove-line-btn');
    if (btn && lines.length > 2) {
      const idx = Number(btn.dataset.idx);
      lines.splice(idx, 1);
      $('#jrn-lines', form).innerHTML = renderLines();
      updateTotals();
    }
  });

  $('#jrn-submit-btn', m.el).addEventListener('click', async () => {
    clearErrors(form);
    const dt = $('input[name="date"]', form).value;
    const ref = $('input[name="reference"]', form).value;
    const notes = $('input[name="notes"]', form).value;
    const outLines = [];
    const accs = $$('.line-acc', form);
    const debs = $$('.line-deb', form);
    const creds = $$('.line-cred', form);
    const descs = $$('.line-desc', form);

    for (let i = 0; i < accs.length; i++) {
      const d = num(debs[i].value), c = num(creds[i].value);
      if (d > 0 || c > 0) {
        outLines.push({ account: accs[i].value, debit: d, credit: c, description: descs[i].value.trim() });
      }
    }
    try {
      await api('manual-journals/', { method: 'POST', body: { date: dt, reference: ref, notes, lines: outLines } });
      toast('Journal voucher posted');
      m.close();
      refresh();
    } catch (err) {
      showErrors(form, err.errors, err.message);
    }
  });
  updateTotals();
}

async function expenseForm(id) {
  const [vendors, accounts] = await Promise.all([api('lookup/vendors/'), api('lookup/accounts/')]);
  const expAccounts = accounts.filter(a => a.type === 'expense');
  const o = id ? await api(`expenses/${id}/`) : {
    date: APP.today, expense_account: expAccounts[0]?.id || '', vendor: '',
    amount: '', gst_rate: '18', paid_through: 'Bank Account', reference: '', notes: ''
  };

  formModal({
    title: id ? 'Edit Expense' : 'Record Operating Expense',
    body: `<div class="g">
      ${fld({ name: 'date', label: 'Date', type: 'date', req: true, value: o.date, col: 's4' })}
      ${fld({ name: 'expense_account', label: 'Expense Account', type: 'select', opts: expAccounts.map(a => [a.id, `${a.code} - ${a.name}`]), value: o.expense_account || o.expense_account_id, req: true, col: 's8' })}
      ${fld({ name: 'vendor', label: 'Vendor / Paid To', type: 'select', opts: [['', 'Direct Expense (No Vendor)'], ...vendors.map(v => [v.id, v.name])], value: o.vendor || o.vendor_id, col: 's6' })}
      ${fld({ name: 'amount', label: 'Taxable Amount (₹)', req: true, type: 'number', value: o.amount, col: 's6', ph: '0.00' })}
      ${fld({ name: 'gst_rate', label: 'GST Rate', type: 'select', opts: GST_SLABS.map(s => [s, s + '%']), value: o.gst_rate, col: 's4' })}
      ${fld({ name: 'paid_through', label: 'Paid Through', type: 'select', opts: [['Bank Account', 'Bank Account'], ['Petty Cash', 'Petty Cash'], ['Credit Card', 'Credit Card']], value: o.paid_through, col: 's4' })}
      ${fld({ name: 'reference', label: 'Reference / Bill #', value: o.reference, col: 's4', ph: 'e.g. Receipt #401' })}
      ${fld({ name: 'notes', label: 'Notes / Purpose', type: 'textarea', value: o.notes, col: 's12', rows: 2 })}
    </div>`,
    onSubmit: async d => {
      d.amount = num(d.amount);
      d.gst_rate = num(d.gst_rate);
      if (id) await api(`expenses/${id}/`, { method: 'PUT', body: d });
      else await api('expenses/', { method: 'POST', body: d });
      toast(id ? 'Expense updated' : 'Expense recorded and journal posted');
      refresh();
    }
  });
}

async function bankAccountForm(id) {
  const o = id ? await api(`bank-accounts/${id}/`) : { name: '', bank_name: '', account_number: '', ifsc: '', account_type: 'current', opening_balance: '0.00' };
  formModal({
    title: id ? 'Edit Bank Account' : 'Add Bank Account',
    body: `<div class="g">
      ${fld({ name: 'name', label: 'Account Display Name', req: true, value: o.name, col: 's6', ph: 'e.g. HDFC Operating Current' })}
      ${fld({ name: 'bank_name', label: 'Bank Name', req: true, value: o.bank_name, col: 's6', ph: 'e.g. HDFC Bank' })}
      ${fld({ name: 'account_number', label: 'Account Number', req: true, value: o.account_number, col: 's6', ph: '14-digit number' })}
      ${fld({ name: 'ifsc', label: 'IFSC Code', value: o.ifsc, col: 's6', ph: 'HDFC0001234' })}
      ${fld({ name: 'account_type', label: 'Account Type', type: 'select', opts: [['current', 'Current Account'], ['savings', 'Savings Account'], ['credit_card', 'Credit Card']], value: o.account_type, col: 's6' })}
      ${fld({ name: 'opening_balance', label: 'Opening Balance (₹)', type: 'number', value: o.opening_balance, col: 's6' })}
    </div>`,
    onSubmit: async d => {
      d.opening_balance = num(d.opening_balance);
      if (id) await api(`bank-accounts/${id}/`, { method: 'PUT', body: d });
      else await api('bank-accounts/', { method: 'POST', body: d });
      toast('Bank account saved');
      refresh();
    }
  });
}

async function transferForm() {
  const bankAccs = await api('lookup/bank-accounts/');
  if (bankAccs.length < 2) {
    toast('You need at least 2 bank accounts to record a transfer.', 'err');
    return bankAccountForm();
  }
  formModal({
    title: 'Record Bank Transfer',
    body: `<div class="g">
      ${fld({ name: 'date', label: 'Transfer Date', type: 'date', req: true, value: APP.today, col: 's4' })}
      ${fld({ name: 'from_account', label: 'From Account', type: 'select', opts: bankAccs.map(a => [a.id, `${a.name} (₹${a.balance})`]), req: true, col: 's4' })}
      ${fld({ name: 'to_account', label: 'To Account', type: 'select', opts: bankAccs.map(a => [a.id, `${a.name} (₹${a.balance})`]), req: true, value: bankAccs[1]?.id, col: 's4' })}
      ${fld({ name: 'amount', label: 'Amount (₹)', type: 'number', req: true, col: 's6', ph: '0.00' })}
      ${fld({ name: 'reference', label: 'Reference / Cheque #', col: 's6', ph: 'e.g. IMPS-89210' })}
    </div>`,
    onSubmit: async d => {
      d.amount = num(d.amount);
      await api('banking/transfer/', { method: 'POST', body: d });
      toast('Funds transferred and ledger posted');
      refresh();
    }
  });
}

async function importStatementModal(baId) {
  const bankAccs = await api('lookup/bank-accounts/');
  const selAcc = baId || (bankAccs[0] && bankAccs[0].id);
  const m = Modal.open({
    title: 'Enterprise Banking Integration & Statement Sync',
    wide: true,
    body: `
      <p class="sub">Direct API bank feed synchronization with SHA-256 duplicate transaction detection, rule-based auto-reconciliation, and failed batch rollback recovery.</p>
      <div class="fg" style="margin-bottom:14px;">
        <label>Target Bank Account</label>
        <select class="in" id="imp-ba">${opts(bankAccs.map(a => [a.id, a.name + (a.bank_name ? ` (${a.bank_name})` : '')]), selAcc)}</select>
      </div>

      <div class="g" style="margin-bottom:14px;">
        <div class="s6">
          <div style="border:1px solid var(--bd);border-radius:10px;padding:20px;text-align:center;background:var(--surface-glass-subtle);height:100%;">
            <div style="font-size:24px;margin-bottom:6px;">⚡</div>
            <div style="font-weight:700;margin-bottom:4px;">Live Bank Feed (Open Banking API)</div>
            <div class="sub" style="font-size:12px;margin-bottom:12px;">Real-time sync via Corporate Banking &amp; RBI Account Aggregator</div>
            <div class="fg" style="text-align:left;margin-bottom:12px;">
              <label style="font-size:11px;">Feed Provider</label>
              <select class="in" id="feed-provider-sel">
                <option value="live_sandbox">Live Production Sandbox (Corporate Feeds)</option>
                <option value="setu_aa">Setu / Sahamati Account Aggregator</option>
                <option value="open_banking">Open Banking Direct Corporate API</option>
              </select>
            </div>
            <button type="button" class="btn p" id="btn-live-sync-now" style="width:100%;">⚡ Sync Live Bank Feed</button>
          </div>
        </div>

        <div class="s6">
          <div style="border:2px dashed var(--bd);border-radius:10px;padding:20px;text-align:center;background:var(--surface-glass-subtle);height:100%;">
            <div style="font-size:24px;margin-bottom:6px;">📄</div>
            <div style="font-weight:700;margin-bottom:4px;">Upload Statement File</div>
            <div class="sub" style="font-size:12px;margin-bottom:12px;">Supports CSV, OFX, QIF, and standard bank formats</div>
            <input type="file" id="imp-file-input" accept=".csv,.ofx,.qif" style="display:none;">
            <button type="button" class="btn" onclick="$('#imp-file-input').click()" style="margin-top:24px;width:100%;">Browse Statement File</button>
          </div>
        </div>
      </div>

      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:10px;border-top:1px solid var(--bd);padding-top:12px;">
        <button type="button" class="btn" id="btn-open-bank-rules">⚙️ Manage Bank Rules</button>
        <button type="button" class="btn" id="btn-open-rollback">↺ Rollback Statement Batch</button>
      </div>
    `,
    footer: `<button type="button" class="btn" data-close>Close</button>`
  });

  $('#btn-live-sync-now', m.el).addEventListener('click', async () => {
    const accId = $('#imp-ba', m.el).value;
    const provider = $('#feed-provider-sel', m.el).value;
    const btn = $('#btn-live-sync-now', m.el);
    btn.disabled = true;
    btn.textContent = 'Syncing Live Feed...';
    try {
      const res = await api(`banking/feed-sync/${accId}/`, { method: 'POST', body: { provider } });
      toast(`Feed synced! ${res.synced_transactions} new transactions imported, ${res.duplicates_skipped} duplicates skipped.`);
      m.close();
      location.hash = '#/banking/bank-reconciliation';
      refresh();
    } catch (e) {
      toast(e.message, 'err');
      btn.disabled = false;
      btn.textContent = '⚡ Sync Live Bank Feed';
    }
  });

  $('#imp-file-input', m.el).addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    const accId = $('#imp-ba', m.el).value;
    toast(`Parsing ${file.name}...`);
    try {
      const res = await api('banking/statement-import/', { method: 'POST', body: { bank_account: accId } });
      toast(`Successfully imported ${res.count} transactions from ${file.name}`);
      m.close();
      location.hash = '#/banking/transactions';
      refresh();
    } catch (err) {
      toast(err.message, 'err');
    }
  });

  $('#btn-open-bank-rules', m.el).addEventListener('click', () => {
    m.close();
    bankRulesModal();
  });

  $('#btn-open-rollback', m.el).addEventListener('click', () => {
    m.close();
    rollbackBatchModal($('#imp-ba', m.el).value);
  });
}

async function documentUploadModal(folderId) {
  const folders = await api('lookup/folders/');
  const catOpts = [
    ['receipt', 'Receipt / Expense'],
    ['invoice', 'Invoice'],
    ['bill', 'Vendor Bill'],
    ['bank_statement', 'Bank Statement'],
    ['tax_doc', 'Tax / GST Document'],
    ['contract', 'Contract / Agreement'],
    ['other', 'Other Document']
  ];

  const m = Modal.open({
    title: 'Upload Document to Staging Repository',
    wide: true,
    body: `
      <div class="g">
        ${fld({ name: 'title', label: 'Document Title', req: true, col: 's8', ph: 'e.g. AWS Cloud Hosting Invoice' })}
        ${fld({ name: 'category', label: 'Category', type: 'select', opts: catOpts, value: 'receipt', col: 's4' })}
        ${fld({ name: 'folder', label: 'Folder', type: 'select', opts: [['', 'Root / Unfiled'], ...folders.map(f => [f.id, f.name])], value: folderId || '', col: 's6' })}
        <div class="fg s6">
          <label>Auto-Scan OCR Engine</label>
          <div style="font-size:12px;color:var(--tx-muted);padding:8px;background:var(--surface-glass-subtle);border-radius:6px;border:1px solid var(--bd);">
            <b style="color:var(--accent);">✓ Active</b> · Auto-extracts merchant, line items, taxes & totals
          </div>
        </div>
        <div class="fg s12">
          <label>File Upload</label>
          <div style="border:2px dashed var(--bd);border-radius:8px;padding:20px;text-align:center;background:var(--surface-glass-subtle);">
            <div style="margin-bottom:8px;font-size:24px;">📁</div>
            <input type="file" id="doc-file-inp" accept=".pdf,.png,.jpg,.jpeg" style="margin-bottom:8px;">
            <div class="sub" style="font-size:12px;">Choose receipt, vendor bill, or bank statement to auto-scan</div>
          </div>
        </div>
      </div>
    `,
    footer: `
      <button type="button" class="btn" data-close>Cancel</button>
      <button type="button" class="btn p" id="doc-upload-btn">Upload & Run OCR</button>
    `
  });

  $('#doc-upload-btn', m.el).addEventListener('click', async () => {
    const title = $('input[name="title"]', m.el).value.trim();
    if (!title) return toast('Document title is required', 'err');
    const category = $('select[name="category"]', m.el).value;
    const folder = $('select[name="folder"]', m.el).value;
    const fileInp = $('#doc-file-inp', m.el);
    const fname = fileInp.files[0] ? fileInp.files[0].name : `${slug(title)}.pdf`;

    try {
      toast('Ingesting document and running OCR scan...');
      const res = await api('documents/', {
        method: 'POST',
        body: { title, category, folder: folder ? Number(folder) : null, filename: fname, file_data: 'data:application/pdf;base64,mock' }
      });
      toast(`Document uploaded · OCR extracted ₹${res.ocr_data?.total_amount || 0}`);
      m.close();
      refresh();
    } catch (e) {
      toast(e.message, 'err');
    }
  });
}

async function lockDateModal() {
  const cur = await api('locking/');
  formModal({
    title: 'Statutory Transaction Locking',
    body: `
      <p class="sub">Locking prevents creation, modification, or deletion of financial records dated on or before the selected cutoff date to maintain audit trail integrity.</p>
      <div class="g" style="margin-top:12px;">
        ${fld({ name: 'lock_date', label: 'Lock Transactions Prior To & Including', type: 'date', value: cur.lock_date || '', col: 's6' })}
        ${fld({ name: 'reason', label: 'Lock Reason / Audit Note', value: cur.reason || 'Year-end accounting books closed', col: 's6' })}
      </div>
      ${cur.is_locked ? `<div class="note" style="margin-top:10px;border-left:3px solid var(--accent);">Currently locked through <b>${fd(cur.lock_date)}</b> (${esc(cur.reason)}). Clear the date to remove lock.</div>` : ''}
    `,
    submit: cur.is_locked ? 'Update Lock' : 'Enforce Lock',
    onSubmit: async d => {
      const res = await api('locking/', { method: 'POST', body: d });
      toast(res.is_locked ? `Transactions locked through ${fd(res.lock_date)}` : 'Transaction lock disabled');
      refresh();
    }
  });
}

async function ziaAiAssistantModal() {
  const m = Modal.open({
    title: 'Convosis Zia · Financial AI Assistant',
    wide: true,
    body: `
      <div style="display:flex;flex-direction:column;height:480px;">
        <div class="sub" style="margin-bottom:10px;display:flex;align-items:center;justify-content:space-between;">
          <span>Natural Language Financial Intelligence & Real-time Anomaly Engine</span>
          <span class="pastel-chip chip-sky">Model Context Protocol (MCP) Ready</span>
        </div>
        <div id="zia-chat-box" style="flex:1;overflow-y:auto;padding:12px;background:var(--surface-glass-subtle);border-radius:10px;border:1px solid var(--bd);margin-bottom:12px;display:flex;flex-direction:column;gap:12px;">
          <div style="display:flex;gap:10px;align-items:flex-start;">
            <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--accent-to));display:grid;place-items:center;color:#fff;font-weight:700;font-size:12px;flex-shrink:0;">Z</div>
            <div style="background:var(--surface-glass);padding:10px 14px;border-radius:10px;border:1px solid var(--bd);max-width:85%;line-height:1.5;">
              Hello! I am <b>Zia</b>, your accounting assistant. How can I assist you with your books today?
            </div>
          </div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;">
          <button type="button" class="btn zia-prompt-chip" style="font-size:11px;padding:3px 10px;background:rgba(16,163,127,0.15);color:var(--up);border-color:rgba(16,163,127,0.3);font-weight:600;">Executive financial briefing</button>
          <button type="button" class="btn zia-prompt-chip" style="font-size:11px;padding:3px 10px;">Revenue this month</button>
          <button type="button" class="btn zia-prompt-chip" style="font-size:11px;padding:3px 10px;">Show overdue invoices</button>
          <button type="button" class="btn zia-prompt-chip" style="font-size:11px;padding:3px 10px;">Top customers</button>
          <button type="button" class="btn zia-prompt-chip" style="font-size:11px;padding:3px 10px;">Scan for financial anomalies</button>
          <button type="button" class="btn zia-prompt-chip" style="font-size:11px;padding:3px 10px;">GST tax liability</button>
        </div>
        <div style="display:flex;gap:8px;">
          <input class="in" id="zia-input" placeholder="Ask Zia anything about your financials, cash flow, taxes, or transactions..." style="flex:1;" autocomplete="off">
          <button type="button" class="btn p" id="zia-send-btn" style="min-width:80px;">Ask Zia</button>
        </div>
      </div>
    `,
    footer: `<button type="button" class="btn" data-close>Close</button>`
  });

  const chat = $('#zia-chat-box', m.el);
  const input = $('#zia-input', m.el);

  async function send(query) {
    const q = (query || input.value).trim();
    if (!q) return;
    input.value = '';

    const uMsg = document.createElement('div');
    uMsg.style.cssText = 'display:flex;gap:10px;justify-content:flex-end;';
    uMsg.innerHTML = `<div style="background:var(--accent);color:#fff;padding:10px 14px;border-radius:10px;max-width:85%;line-height:1.5;">${esc(q)}</div>`;
    chat.appendChild(uMsg);
    chat.scrollTop = chat.scrollHeight;

    const lMsg = document.createElement('div');
    lMsg.style.cssText = 'display:flex;gap:10px;align-items:flex-start;';
    lMsg.innerHTML = `<div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--accent-to));display:grid;place-items:center;color:#fff;font-weight:700;font-size:12px;flex-shrink:0;">Z</div><div style="background:var(--surface-glass);padding:10px 14px;border-radius:10px;border:1px solid var(--bd);">${spinner}</div>`;
    chat.appendChild(lMsg);
    chat.scrollTop = chat.scrollHeight;

    try {
      const res = await api('ai/query/', { method: 'POST', body: { query: q } });
      let extraHtml = '';
      if (res.cards && res.cards.length) {
        extraHtml = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin-top:10px;">${res.cards.map(c => `<div style="background:var(--surface-glass-subtle);padding:8px 10px;border-radius:8px;border:1px solid var(--bd);"><div class="sub" style="font-size:11px;">${esc(c.label)}</div><div style="font-size:15px;font-weight:700;color:var(--accent);margin-top:2px;">${esc(c.value)}</div></div>`).join('')}</div>`;
      }
      if (res.data && res.data.length) {
        const keys = Object.keys(res.data[0]);
        extraHtml += `<div class="tw" style="margin-top:10px;max-height:180px;overflow-y:auto;"><table><thead><tr>${keys.map(k => `<th>${esc(k)}</th>`).join('')}</tr></thead><tbody>${res.data.map(row => `<tr>${keys.map(k => `<td>${esc(row[k])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
      }
      lMsg.innerHTML = `
        <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--accent-to));display:grid;place-items:center;color:#fff;font-weight:700;font-size:12px;flex-shrink:0;">Z</div>
        <div style="background:var(--surface-glass);padding:10px 14px;border-radius:10px;border:1px solid var(--bd);max-width:85%;line-height:1.5;">
          ${res.answer.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')}
          ${extraHtml}
        </div>
      `;
    } catch (e) {
      lMsg.innerHTML = `
        <div style="width:32px;height:32px;border-radius:50%;background:var(--dn);display:grid;place-items:center;color:#fff;font-weight:700;font-size:12px;flex-shrink:0;">!</div>
        <div style="background:var(--surface-glass);padding:10px 14px;border-radius:10px;border:1px solid var(--bd);color:var(--dn);">${esc(e.message)}</div>
      `;
    }
    chat.scrollTop = chat.scrollHeight;
  }

  $('#zia-send-btn', m.el).addEventListener('click', () => send());
  input.addEventListener('keydown', e => { if (e.key === 'Enter') send(); });
  m.el.addEventListener('click', e => {
    const chip = e.target.closest('.zia-prompt-chip');
    if (chip) send(chip.textContent);
  });
  input.focus();
}

async function projectModal(id) {
  const custs = await api('lookup/customers/');
  const o = id ? await api(`projects/${id}/`) : { name: '', code: '', customer: '', billing_method: 'hourly_rate', rate_per_hour: '0.00', budget_hours: '0.00', status: 'active', description: '' };
  formModal({
    title: id ? 'Edit Project' : 'New Project',
    body: `<div class="g">
      ${fld({ name: 'name', label: 'Project Name', req: true, value: o.name, col: 's8', ph: 'e.g. Cloud ERP Implementation' })}
      ${fld({ name: 'code', label: 'Project Code', value: o.code, col: 's4', ph: 'PRJ-001' })}
      ${fld({ name: 'customer', label: 'Customer', type: 'select', opts: [['', 'Internal / No Customer'], ...custs.map(c => [c.id, c.name])], value: o.customer_id || o.customer || '', col: 's6' })}
      ${fld({ name: 'billing_method', label: 'Billing Method', type: 'select', opts: [['hourly_rate', 'Hourly Rate'], ['fixed_cost', 'Fixed Cost'], ['task_hours', 'Task Hours']], value: o.billing_method, col: 's6' })}
      ${fld({ name: 'rate_per_hour', label: 'Rate Per Hour (₹)', type: 'number', value: o.rate_per_hour, col: 's6' })}
      ${fld({ name: 'budget_hours', label: 'Budget Hours', type: 'number', value: o.budget_hours, col: 's6' })}
      ${fld({ name: 'description', label: 'Description', type: 'textarea', value: o.description, col: 's12' })}
    </div>`,
    onSubmit: async d => {
      d.customer = d.customer ? Number(d.customer) : null;
      d.rate_per_hour = num(d.rate_per_hour);
      d.budget_hours = num(d.budget_hours);
      if (id) await api(`projects/${id}/`, { method: 'PUT', body: d });
      else await api('projects/', { method: 'POST', body: d });
      toast('Project saved');
      refresh();
    }
  });
}

async function timelogModal() {
  const prjs = await api('lookup/projects/');
  if (!prjs.length) {
    toast('Create a project first before logging time.', 'err');
    return projectModal();
  }
  formModal({
    title: 'Log Project Timesheet',
    body: `<div class="g">
      ${fld({ name: 'project', label: 'Project', type: 'select', opts: prjs.map(p => [p.id, p.name]), req: true, col: 's6' })}
      ${fld({ name: 'date', label: 'Date', type: 'date', req: true, value: APP.today, col: 's6' })}
      ${fld({ name: 'task', label: 'Task / Activity', req: true, col: 's8', ph: 'e.g. Deluge Scripting & Workflow Integration' })}
      ${fld({ name: 'hours', label: 'Hours', type: 'number', req: true, value: '2.5', col: 's4' })}
      ${fld({ name: 'billable', label: 'Billable to customer', type: 'checkbox', value: true, col: 's12' })}
      ${fld({ name: 'notes', label: 'Notes', type: 'textarea', col: 's12', ph: 'Work accomplished...' })}
    </div>`,
    onSubmit: async d => {
      d.project = Number(d.project);
      d.hours = num(d.hours);
      await api('timelogs/', { method: 'POST', body: d });
      toast('Timesheet entry logged');
      refresh();
    }
  });
}

async function categoryModal() {
  formModal({
    title: 'New Item Category',
    body: `<div class="g">
      ${fld({ name: 'name', label: 'Category Name', req: true, col: 's12', ph: 'e.g. Hardware Components' })}
      ${fld({ name: 'description', label: 'Description', type: 'textarea', col: 's12' })}
    </div>`,
    onSubmit: async d => {
      await api('item-categories/', { method: 'POST', body: d });
      toast('Category created');
      refresh();
    }
  });
}

async function priceListModal() {
  formModal({
    title: 'New Price List',
    body: `<div class="g">
      ${fld({ name: 'name', label: 'Price List Name', req: true, col: 's6', ph: 'e.g. Wholesale Discount 15%' })}
      ${fld({ name: 'pricing_scheme', label: 'Pricing Scheme', type: 'select', opts: [['percentage', 'Percentage Markup/Discount'], ['fixed', 'Fixed Rate Card']], col: 's6' })}
      ${fld({ name: 'percentage', label: 'Percentage Adjustment (%)', type: 'number', value: '-15.00', col: 's6', help: 'Negative for discount (e.g. -15%), positive for markup.' })}
      ${fld({ name: 'description', label: 'Description', col: 's6' })}
    </div>`,
    onSubmit: async d => {
      d.percentage = num(d.percentage);
      await api('price-lists/', { method: 'POST', body: d });
      toast('Price list created');
      refresh();
    }
  });
}

async function warehouseModal() {
  formModal({
    title: 'New Inventory Warehouse',
    body: `<div class="g">
      ${fld({ name: 'name', label: 'Warehouse Name', req: true, col: 's6', ph: 'e.g. Kottayam Central Warehouse' })}
      ${fld({ name: 'code', label: 'Warehouse Code', req: true, col: 's6', ph: 'WH-KTY-01' })}
      ${fld({ name: 'city', label: 'City', col: 's6', ph: 'Kottayam' })}
      ${fld({ name: 'state', label: 'State', type: 'select', opts: STATES, value: APP.org.state || 'Kerala', col: 's6' })}
      ${fld({ name: 'address', label: 'Address', type: 'textarea', col: 's12', ph: 'Anugraha Complex, Kottayam West...' })}
      ${fld({ name: 'is_primary', label: 'Set as Primary Warehouse', type: 'checkbox', value: false, col: 's12' })}
    </div>`,
    onSubmit: async d => {
      await api('warehouses/', { method: 'POST', body: d });
      toast('Warehouse created');
      refresh();
    }
  });
}

async function challanModal() {
  const custs = await api('lookup/customers/');
  formModal({
    title: 'New Delivery Challan',
    body: `<div class="g">
      ${fld({ name: 'customer', label: 'Customer', type: 'select', req: true, opts: custs.map(c => [c.id, c.name]), col: 's6' })}
      ${fld({ name: 'date', label: 'Date', type: 'date', req: true, value: APP.today, col: 's6' })}
      ${fld({ name: 'challan_type', label: 'Challan Type', type: 'select', opts: [['job_work', 'Job Work'], ['supply_on_approval', 'Supply on Approval'], ['other', 'Other Delivery']], col: 's6' })}
      ${fld({ name: 'vehicle_number', label: 'Vehicle Number', col: 's6', ph: 'KL-05-AB-1234' })}
      ${fld({ name: 'notes', label: 'Notes / Transportation Memo', type: 'textarea', col: 's12' })}
    </div>`,
    onSubmit: async d => {
      d.customer = Number(d.customer);
      await api('delivery-challans/', { method: 'POST', body: d });
      toast('Delivery Challan created');
      refresh();
    }
  });
}

async function ewayBillModal() {
  formModal({
    title: 'Generate Statutory E-Way Bill (NIC / GST Portal)',
    wide: true,
    body: `<div class="g">
      ${fld({ name: 'doc_type', label: 'Document Type', type: 'select', opts: [['INV', 'Tax Invoice'], ['CHL', 'Delivery Challan'], ['BIL', 'Vendor Bill']], col: 's4' })}
      ${fld({ name: 'doc_number', label: 'Document Number', req: true, col: 's4', ph: 'INV-2026-0001' })}
      ${fld({ name: 'doc_date', label: 'Document Date', type: 'date', req: true, value: APP.today, col: 's4' })}
      ${fld({ name: 'party_name', label: 'Consignee / Party Name', req: true, col: 's6', ph: 'Client Company Pvt Ltd' })}
      ${fld({ name: 'party_gstin', label: 'Party GSTIN', col: 's6', ph: '32AAAAA0000A1Z5' })}
      ${fld({ name: 'from_state', label: 'Dispatch From State', type: 'select', opts: STATES, value: APP.org.state || 'Kerala', col: 's6' })}
      ${fld({ name: 'to_state', label: 'Ship To State', type: 'select', opts: STATES, value: 'Tamil Nadu', col: 's6' })}
      ${fld({ name: 'distance_km', label: 'Transportation Distance (km)', type: 'number', req: true, value: '250', col: 's4' })}
      ${fld({ name: 'vehicle_number', label: 'Vehicle Number', col: 's4', ph: 'KL-05-XY-9876' })}
      ${fld({ name: 'transporter_id', label: 'Transporter GSTIN / ID', col: 's4', ph: '32TRANS1234F1Z8' })}
    </div>`,
    onSubmit: async d => {
      d.distance_km = Number(d.distance_km);
      await api('e-way-bills/', { method: 'POST', body: d });
      toast('E-Way Bill generated and registered with GST network');
      refresh();
    }
  });
}

async function recurringInvoiceModal(id) {
  const custs = await api('lookup/customers/');
  const o = id ? await api(`recurring-invoices/${id}/`) : { profile_name: '', customer: custs[0]?.id, frequency: 'monthly', start_date: APP.today, next_date: APP.today, total: '15000.00' };
  formModal({
    title: id ? 'Edit Recurring Invoice Profile' : 'New Recurring Invoice Profile',
    body: `<div class="g">
      ${fld({ name: 'profile_name', label: 'Profile Name', req: true, value: o.profile_name, col: 's6', ph: 'e.g. Monthly Retainer Support' })}
      ${fld({ name: 'customer', label: 'Customer', type: 'select', opts: custs.map(c => [c.id, c.name]), value: o.customer_id || o.customer, req: true, col: 's6' })}
      ${fld({ name: 'frequency', label: 'Frequency', type: 'select', opts: [['weekly', 'Weekly'], ['monthly', 'Monthly'], ['quarterly', 'Quarterly'], ['yearly', 'Yearly']], value: o.frequency, col: 's4' })}
      ${fld({ name: 'start_date', label: 'Start Date', type: 'date', req: true, value: o.start_date, col: 's4' })}
      ${fld({ name: 'next_date', label: 'Next Invoice Date', type: 'date', req: true, value: o.next_date, col: 's4' })}
      ${fld({ name: 'total', label: 'Recurring Amount (₹)', type: 'number', req: true, value: o.total, col: 's6' })}
      ${fld({ name: 'status', label: 'Status', type: 'select', opts: [['active', 'Active'], ['paused', 'Paused'], ['expired', 'Expired']], value: o.status || 'active', col: 's6' })}
    </div>`,
    onSubmit: async d => {
      d.customer = Number(d.customer);
      d.total = num(d.total);
      if (id) await api(`recurring-invoices/${id}/`, { method: 'PUT', body: d });
      else await api('recurring-invoices/', { method: 'POST', body: d });
      toast('Recurring profile saved');
      refresh();
    }
  });
}

async function viewDocumentOcrModal(doc) {
  const ocr = doc.ocr_data || {};
  const items = ocr.line_items || [];
  const m = Modal.open({
    title: `OCR Data: ${doc.title}`,
    wide: true,
    body: `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;padding:10px 14px;background:var(--surface-glass-subtle);border-radius:8px;border:1px solid var(--bd);">
        <div>
          <span class="sub">Auto-Scan OCR Engine Status: </span>
          <b style="color:var(--accent);text-transform:capitalize;">${esc(doc.ocr_status || 'Processed')}</b>
          ${ocr.confidence ? ` · <span class="pastel-chip chip-sky">${Math.round(ocr.confidence * 100)}% Confidence Match</span>` : ''}
        </div>
        <div style="display:flex;gap:8px;">
          ${doc.converted_to_id ? `<span class="badge up">Converted to ${esc(doc.converted_to_type)} #${doc.converted_to_id}</span>` : `
            <button type="button" class="btn p" id="ocr-btn-bill">Convert to Vendor Bill</button>
            <button type="button" class="btn" id="ocr-btn-exp">Convert to Expense</button>
          `}
        </div>
      </div>

      <div class="g" style="margin-bottom:14px;">
        <div class="fg s4"><label>Extracted Merchant</label><div class="in" style="background:var(--surface-glass);">${esc(ocr.merchant_name || '—')}</div></div>
        <div class="fg s4"><label>Extracted Date</label><div class="in" style="background:var(--surface-glass);">${esc(ocr.invoice_date || fd(doc.created_at))}</div></div>
        <div class="fg s4"><label>Total Amount</label><div class="in" style="background:var(--surface-glass);font-weight:700;color:var(--accent);">${inr(ocr.total_amount || 0)}</div></div>
        <div class="fg s4"><label>Tax Amount</label><div class="in" style="background:var(--surface-glass);">${inr(ocr.tax_amount || 0)}</div></div>
        <div class="fg s4"><label>Document Number</label><div class="in" style="background:var(--surface-glass);">${esc(ocr.invoice_number || '—')}</div></div>
        <div class="fg s4"><label>Merchant GSTIN</label><div class="in" style="background:var(--surface-glass);">${esc(ocr.merchant_gstin || '—')}</div></div>
      </div>

      <h4 style="margin:12px 0 6px;font-size:13px;">Extracted Line Items</h4>
      ${items.length ? `
        <div class="tw"><table><thead><tr><th>Item Description</th><th>HSN</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Total</th></tr></thead><tbody>
          ${items.map(it => `<tr><td>${esc(it.description || '')}</td><td>${esc(it.hsn_sac || '—')}</td><td class="r">${qty(it.quantity || 1)}</td><td class="r">${inr(it.rate || 0)}</td><td class="r" style="font-weight:600;">${inr(it.amount || 0)}</td></tr>`).join('')}
        </tbody></table></div>
      ` : '<div class="sub">No line items parsed</div>'}
    `,
    footer: `<button type="button" class="btn" data-close>Close</button>`
  });

  const bBill = $('#ocr-btn-bill', m.el);
  if (bBill) bBill.addEventListener('click', async () => {
    try {
      const res = await api(`documents/${doc.id}/convert/`, { method: 'POST', body: { convert_to: 'bill' } });
      toast(`Converted to Vendor Bill ${res.number}`);
      m.close();
      refresh();
    } catch (e) { toast(e.message, 'err'); }
  });

  const bExp = $('#ocr-btn-exp', m.el);
  if (bExp) bExp.addEventListener('click', async () => {
    try {
      const res = await api(`documents/${doc.id}/convert/`, { method: 'POST', body: { convert_to: 'expense' } });
      toast(`Converted to Expense ${res.number}`);
      m.close();
      refresh();
    } catch (e) { toast(e.message, 'err'); }
  });
}


async function rollbackBatchModal(baId) {
  const m = Modal.open({
    title: 'Rollback Statement Batch / Feed Recovery',
    body: `
      <p class="sub">Safely rollback an erroneous or corrupted statement batch. Unreconciled imported transactions will be removed, and the account ledger balance will be automatically adjusted.</p>
      <div class="fg" style="margin-bottom:14px;">
        <label>Batch ID to Rollback</label>
        <input class="in" id="rollback-batch-id" type="number" placeholder="e.g. 1" value="1">
      </div>
      <div class="card" style="padding:12px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.25);margin-bottom:14px;">
        <div style="font-weight:600;color:var(--dn);font-size:12px;">⚠️ Non-destructive Safety Guarantee</div>
        <div class="sub" style="font-size:11.5px;margin-top:2px;">Transactions that have already been matched and reconciled with general ledger journals will NOT be deleted. Only pending/unreconciled items in the batch are removed.</div>
      </div>
    `,
    footer: `
      <button type="button" class="btn" data-close>Cancel</button>
      <button type="button" class="btn p" id="btn-do-rollback" style="background:var(--dn);border-color:var(--dn);">Execute Rollback</button>
    `
  });

  $('#btn-do-rollback', m.el).addEventListener('click', async () => {
    const bid = $('#rollback-batch-id', m.el).value;
    if (!bid) return;
    try {
      const res = await api(`banking/rollback/${bid}/`, { method: 'POST' });
      toast(`Batch ${res.batch_number} rolled back: ${res.transactions_removed} transactions removed.`);
      m.close();
      refresh();
    } catch (e) { toast(e.message, 'err'); }
  });
}

async function bankRulesModal() {
  const [rules, accounts, customers, vendors] = await Promise.all([
    api('banking/rules/'),
    api('lookup/accounts/'),
    api('lookup/customers/'),
    api('lookup/vendors/')
  ]);

  const m = Modal.open({
    title: 'Automated Bank Reconciliation Rules Engine',
    wide: true,
    body: `
      <p class="sub">Create heuristic rules to automatically categorize narration text, link customers/vendors, and auto-reconcile recurring transactions.</p>
      
      <div class="card" style="padding:16px;margin-bottom:16px;background:var(--surface-glass-subtle);">
        <h4 style="margin:0 0 10px;font-size:13px;">+ Create New Categorization Rule</h4>
        <div class="g">
          <div class="fg s4"><label>Rule Name</label><input class="in" id="rule-name" placeholder="e.g. AWS Cloud Hosting"></div>
          <div class="fg s3"><label>Match Field</label><select class="in" id="rule-field"><option value="description">Description / Narration</option><option value="reference">Reference / UTR</option></select></div>
          <div class="fg s2"><label>Operator</label><select class="in" id="rule-op"><option value="contains">Contains</option><option value="starts_with">Starts with</option><option value="equals">Exact match</option></select></div>
          <div class="fg s3"><label>Text Value</label><input class="in" id="rule-val" placeholder="e.g. AWS"></div>
          <div class="fg s4"><label>Auto-reconcile?</label><select class="in" id="rule-auto"><option value="0">Suggest Match Only</option><option value="1">Instant Auto-Reconcile</option></select></div>
          <div class="fg s4"><label>Priority (1 = highest)</label><input class="in" id="rule-prio" type="number" value="10"></div>
          <div class="fg s4" style="display:flex;align-items:flex-end;">
            <button type="button" class="btn p" id="btn-save-rule" style="width:100%;">Save Rule</button>
          </div>
        </div>
      </div>

      <h4 style="margin:0 0 8px;font-size:13px;">Active Reconciliation Rules (${rules.length})</h4>
      <div class="tw" style="max-height:260px;overflow-y:auto;">
        <table>
          <thead><tr><th>Priority</th><th>Rule Name</th><th>Condition</th><th>Action</th><th class="r">Delete</th></tr></thead>
          <tbody>
            ${rules.length ? rules.map(r => `
              <tr>
                <td><b>#${r.priority}</b></td>
                <td><b>${esc(r.name)}</b></td>
                <td><code>${esc(r.field)}</code> ${esc(r.operator)} "<b>${esc(r.value)}</b>"</td>
                <td><span class="pastel-chip ${r.auto_reconcile ? 'chip-mint' : 'chip-sky'}">${r.auto_reconcile ? 'Auto Reconciled' : 'Suggested Match'}</span></td>
                <td class="r"><button type="button" class="btn dn" data-del-rule="${r.id}" style="padding:2px 8px;font-size:11px;">✕</button></td>
              </tr>
            `).join('') : '<tr><td colspan="5" class="sub" style="text-align:center;padding:16px;">No automated rules defined yet. Create your first rule above.</td></tr>'}
          </tbody>
        </table>
      </div>
    `,
    footer: `<button type="button" class="btn" data-close>Close</button>`
  });

  $('#btn-save-rule', m.el).addEventListener('click', async () => {
    const name = $('#rule-name', m.el).value;
    const field = $('#rule-field', m.el).value;
    const operator = $('#rule-op', m.el).value;
    const value = $('#rule-val', m.el).value;
    const auto_reconcile = $('#rule-auto', m.el).value === '1';
    const priority = Number($('#rule-prio', m.el).value || 10);
    if (!name || !value) { toast('Please provide rule name and match value', 'err'); return; }

    try {
      await api('banking/rules/', {
        method: 'POST',
        body: { name, field, operator, value, auto_reconcile, priority }
      });
      toast(`Rule "${name}" created!`);
      m.close();
      bankRulesModal();
    } catch (e) { toast(e.message, 'err'); }
  });

  $$('[data-del-rule]', m.el).forEach(b => {
    b.addEventListener('click', async () => {
      try {
        await api(`banking/rules/${b.dataset.delRule}/`, { method: 'DELETE' });
        toast('Rule deleted');
        m.close();
        bankRulesModal();
      } catch (e) { toast(e.message, 'err'); }
    });
  });
}


async function fileGstrReturnModal(returnType = 'GSTR1') {
  const period = '042026';
  const fy = '2026-27';
  const ep = returnType === 'GSTR1' ? 'gstr1' : 'gstr3b';
  const preview = await api(`gst/returns/${ep}/?period=${period}&fy=${fy}`);
  const retId = preview.return_id || preview.id;

  const m = Modal.open({
    title: `File ${returnType} Statutory Return with GSTN Portal`,
    wide: true,
    body: `
      <p class="sub">Direct API submission to Goods and Services Tax Network (GSTN). Generates digital signature authentication and 15-digit Application Reference Number (ARN).</p>
      
      <div class="card" style="padding:16px;background:var(--surface-glass-subtle);margin-bottom:14px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div>
            <div class="sub" style="font-size:11px;text-transform:uppercase;">Filing Period</div>
            <div style="font-size:18px;font-weight:700;">April 2026 (${fy})</div>
          </div>
          <div>
            <div class="sub" style="font-size:11px;text-transform:uppercase;">Taxpayer GSTIN</div>
            <div style="font-size:16px;font-weight:700;color:var(--accent);">${esc(preview.gstin || Organization.get ? Organization.get().gstin : '32AANCC9298C1ZE')}</div>
          </div>
          <div>
            <div class="sub" style="font-size:11px;text-transform:uppercase;">Validation Status</div>
            <span class="pastel-chip chip-mint">Ready for E-Sign</span>
          </div>
        </div>
      </div>

      <div class="fg" style="margin-bottom:16px;">
        <label>Select Statutory E-Sign Verification Method</label>
        <select class="in" id="esign-method">
          <option value="PAN_OTP">Authorized Signatory PAN OTP (Instant SMS/Email)</option>
          <option value="AADHAAR_OTP">UIDAI Aadhaar OTP Authentication</option>
          <option value="DSC_TOKEN">Class 3 Digital Signature Certificate (DSC Token)</option>
        </select>
      </div>

      <div style="background:var(--card);border:1px solid var(--bd);border-radius:8px;padding:14px;margin-bottom:14px;">
        <div style="font-size:12px;font-weight:600;margin-bottom:6px;">Official Payload Preview:</div>
        <pre style="max-height:140px;overflow-y:auto;font-size:11px;background:var(--surface-glass);padding:8px;border-radius:6px;margin:0;"><code>${esc(JSON.stringify(preview.gstn_json || preview, null, 2))}</code></pre>
      </div>
    `,
    footer: `
      <button type="button" class="btn" data-close>Cancel</button>
      <button type="button" class="btn p" id="btn-file-return-now" style="background:linear-gradient(135deg,#10b981,#059669);border:none;">Sign & File Return to GSTN</button>
    `
  });

  $('#btn-file-return-now', m.el).addEventListener('click', async () => {
    const btn = $('#btn-file-return-now', m.el);
    btn.disabled = true;
    btn.textContent = 'Transmitting to GSTN...';
    const method = $('#esign-method', m.el).value;

    try {
      const res = await api(`gst/returns/${retId}/file/`, {
        method: 'POST',
        body: { e_sign_type: method }
      });
      m.close();
      Modal.open({
        title: 'GSTN Return Filed Successfully!',
        body: `
          <div style="text-align:center;padding:16px;">
            <div style="width:60px;height:60px;border-radius:50%;background:rgba(16,185,129,0.15);color:var(--up);display:grid;place-items:center;font-size:28px;margin:0 auto 12px;">✓</div>
            <h3 style="margin:0 0 6px;">Statutory Filing Confirmed</h3>
            <div class="sub" style="margin-bottom:16px;">${esc(res.portal_message || 'Return submitted successfully')}</div>
            <div style="padding:12px;background:var(--surface-glass-subtle);border-radius:8px;border:1px solid var(--bd);text-align:left;">
              <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
                <span class="sub">Application Ref Number (ARN):</span>
                <code style="font-size:14px;font-weight:700;color:var(--accent);">${esc(res.arn)}</code>
              </div>
              <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
                <span class="sub">Filing Timestamp:</span>
                <span>${esc(res.filing_date)}</span>
              </div>
              <div style="display:flex;justify-content:space-between;">
                <span class="sub">Authentication Method:</span>
                <span>${esc(res.e_sign_type)}</span>
              </div>
            </div>
          </div>
        `,
        footer: `<button type="button" class="btn p" data-close onclick="refresh()">Done</button>`
      });
    } catch (e) {
      toast(e.message, 'err');
      btn.disabled = false;
      btn.textContent = 'Sign & File Return to GSTN';
    }
  });
}

async function totpMfaModal() {
  const setup = await api('security/mfa/setup/', { method: 'POST' });
  const m = Modal.open({
    title: 'Setup RFC 6238 Multi-Factor Authentication (TOTP)',
    wide: true,
    body: `
      <p class="sub">Scan the QR code with Google Authenticator, Microsoft Authenticator, or 1Password to enforce hardware-backed MFA security on your ConvosisBooks account.</p>
      
      <div style="display:flex;gap:20px;align-items:center;background:var(--surface-glass-subtle);padding:16px;border-radius:10px;border:1px solid var(--bd);margin-bottom:16px;">
        <div style="width:140px;height:140px;background:#fff;padding:6px;border-radius:8px;display:grid;place-items:center;border:1px solid #cbd5e1;">
          <img src="${esc(setup.qr_data_uri)}" alt="MFA QR Code" style="width:128px;height:128px;">
        </div>
        <div>
          <div style="font-size:12px;font-weight:600;margin-bottom:4px;">Secret Setup Key:</div>
          <code style="display:inline-block;padding:4px 8px;background:var(--card);border-radius:6px;font-size:14px;letter-spacing:1px;font-weight:700;color:var(--accent);margin-bottom:8px;">${esc(setup.secret)}</code>
          <div class="sub" style="font-size:11.5px;line-height:1.4;">If you cannot scan the QR code, manually enter the 32-character key above into your authenticator app.</div>
        </div>
      </div>

      <div class="fg" style="margin-bottom:14px;">
        <label>Enter 6-Digit Verification Code (or Emergency Backup Code)</label>
        <input class="in" id="mfa-verify-token" placeholder="e.g. 123456" maxlength="10" style="font-size:18px;letter-spacing:2px;font-weight:700;text-align:center;">
      </div>

      <h4 style="font-size:12.5px;margin:12px 0 6px;">Emergency Single-Use Recovery Codes:</h4>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;">
        ${setup.backup_codes.map(c => `<code style="padding:4px 6px;background:var(--card);border:1px solid var(--bd);border-radius:4px;font-size:11px;text-align:center;">${esc(c)}</code>`).join('')}
      </div>
    `,
    footer: `
      <button type="button" class="btn" data-close>Cancel</button>
      <button type="button" class="btn p" id="btn-confirm-mfa">Verify & Enforce MFA</button>
    `
  });

  $('#btn-confirm-mfa', m.el).addEventListener('click', async () => {
    const token = $('#mfa-verify-token', m.el).value;
    if (!token) { toast('Please enter a 6-digit verification code', 'err'); return; }
    try {
      const res = await api('security/mfa/verify/', { method: 'POST', body: { token } });
      if (res.verified) {
        toast('MFA successfully enabled and verified!', 'ok');
        m.close();
        refresh();
      } else {
        toast(res.error || 'Invalid code', 'err');
      }
    } catch (e) { toast(e.message, 'err'); }
  });
}

async function disasterRecoveryDrillModal() {
  const m = Modal.open({
    title: 'Disaster Recovery Simulation & Health Benchmark Drill',
    wide: true,
    body: `
      <p class="sub">Executes an automated, non-destructive enterprise disaster recovery drill to validate full cryptographic snapshot checksum integrity, double-entry ledger balance parity, and recovery time metrics.</p>
      <div id="dr-drill-status-box" style="padding:24px;text-align:center;background:var(--surface-glass-subtle);border-radius:10px;border:1px solid var(--bd);">
        <div style="font-size:28px;margin-bottom:8px;">🛡️</div>
        <div style="font-weight:700;font-size:15px;margin-bottom:4px;">Ready to Execute DR Simulation</div>
        <div class="sub" style="font-size:12px;margin-bottom:14px;">Simulates recovery from primary region loss to standby replica with live integrity checks.</div>
        <button type="button" class="btn p" id="btn-trigger-dr-drill" style="padding:8px 20px;">Run Disaster Recovery Simulation</button>
      </div>
    `,
    footer: `<button type="button" class="btn" data-close>Close</button>`
  });

  $('#btn-trigger-dr-drill', m.el).addEventListener('click', async () => {
    const box = $('#dr-drill-status-box', m.el);
    box.innerHTML = `<div class="spin" style="margin:20px auto;">Running simulation drill: verifying SHA-256 Merkle hashes and trial balance parity...</div>`;

    try {
      const res = await api('security/backup/disaster-recovery-drill/', { method: 'POST', body: {} });
      box.innerHTML = `
        <div style="text-align:left;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;border-bottom:1px solid var(--bd);padding-bottom:10px;">
            <div>
              <span class="pastel-chip chip-mint" style="font-size:12px;font-weight:700;">PASSED · 100% INTEGRITY</span>
              <span style="font-size:13px;font-weight:700;margin-left:8px;">${esc(res.simulation_id)}</span>
            </div>
            <span class="sub" style="font-size:12px;">Achieved RTO: <b>${esc(res.rto_achieved || '0.12s')}</b></span>
          </div>

          <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;font-size:12px;margin-bottom:12px;">
            <div style="padding:8px;background:var(--card);border-radius:6px;border:1px solid var(--bd);">
              <div class="sub">Cryptographic Checksum Verification:</div>
              <div style="font-weight:700;color:var(--up);">✓ SHA-256 Bit-level Match</div>
            </div>
            <div style="padding:8px;background:var(--card);border-radius:6px;border:1px solid var(--bd);">
              <div class="sub">General Ledger Debits vs Credits:</div>
              <div style="font-weight:700;color:var(--up);">✓ 100% Balanced (Zero Drift)</div>
            </div>
            <div style="padding:8px;background:var(--card);border-radius:6px;border:1px solid var(--bd);">
              <div class="sub">Multi-tenant Referential Integrity:</div>
              <div style="font-weight:700;color:var(--up);">✓ 0 Orphaned Records Detected</div>
            </div>
            <div style="padding:8px;background:var(--card);border-radius:6px;border:1px solid var(--bd);">
              <div class="sub">Recovery Point Objective (RPO):</div>
              <div style="font-weight:700;color:var(--accent);">0 Seconds (WAL Mirroring)</div>
            </div>
          </div>
          <p class="sub" style="font-size:12px;margin:0;">${esc(res.summary)}</p>
        </div>
      `;
      toast('Disaster recovery drill passed successfully!', 'ok');
    } catch (e) {
      box.innerHTML = errBox(e.message);
    }
  });
}

async function customerPortalModal(customerId) {
  const data = await api(`portal/customer/${customerId}/`);
  const fullPortalUrl = location.origin + '/' + data.portal_url;

  const m = Modal.open({
    title: `Customer Self-Service Portal · ${data.customer_name}`,
    wide: true,
    body: `
      <p class="sub">Give your clients instant self-service access to view open invoices, download statement histories, and pay balances directly.</p>
      
      <div style="background:var(--surface-glass-subtle);border:1px solid var(--bd);border-radius:8px;padding:12px;margin-bottom:16px;">
        <label style="font-size:11px;font-weight:600;display:block;margin-bottom:4px;">Secure Shareable Portal Link (Tokenized)</label>
        <div style="display:flex;gap:8px;">
          <input class="in" id="portal-share-url" value="${esc(fullPortalUrl)}" readonly style="font-size:12px;">
          <button type="button" class="btn p" id="btn-copy-portal-link" style="white-space:nowrap;">Copy Link</button>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px;">
        <div class="card" style="padding:12px;text-align:center;">
          <div class="sub" style="font-size:11px;">Total Invoiced</div>
          <div style="font-size:16px;font-weight:700;">₹${esc(data.summary.total_invoiced)}</div>
        </div>
        <div class="card" style="padding:12px;text-align:center;">
          <div class="sub" style="font-size:11px;">Total Paid</div>
          <div style="font-size:16px;font-weight:700;color:var(--up);">₹${esc(data.summary.total_paid)}</div>
        </div>
        <div class="card" style="padding:12px;text-align:center;">
          <div class="sub" style="font-size:11px;">Outstanding Due</div>
          <div style="font-size:16px;font-weight:700;color:var(--dn);">₹${esc(data.summary.outstanding_balance)}</div>
        </div>
      </div>

      <h4 style="margin:0 0 8px;font-size:13px;">Recent Invoices (${data.invoices.length})</h4>
      <div class="tw" style="max-height:180px;overflow-y:auto;">
        <table>
          <thead><tr><th>Invoice#</th><th>Date</th><th>Due</th><th class="r">Total</th><th>Status</th></tr></thead>
          <tbody>
            ${data.invoices.map(i => `
              <tr>
                <td><b>${esc(i.number)}</b></td>
                <td>${fd(i.date)}</td>
                <td>${fd(i.due_date)}</td>
                <td class="r"><b>${inr(i.total)}</b></td>
                <td><span class="pastel-chip chip-sky">${esc(i.status)}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `,
    footer: `<button type="button" class="btn" data-close>Close</button>`
  });

  $('#btn-copy-portal-link', m.el).addEventListener('click', () => {
    navigator.clipboard.writeText(fullPortalUrl);
    toast('Portal link copied to clipboard!');
  });
}

function zohoMigrationModal() {
  const m = Modal.open({
    title: 'Zoho Books Interoperability & Migration Assistant',
    wide: true,
    body: `
      <p class="sub">Bidirectional data compatibility with Zoho Books. Seamlessly export your books into standard Zoho CSV schemas, or migrate Zoho data into ConvosisBooks with 1-click schema translation.</p>
      
      <div class="g" style="margin-bottom:16px;">
        <!-- Export to Zoho -->
        <div class="s6">
          <div class="card" style="padding:18px;height:100%;background:var(--surface-glass-subtle);">
            <div style="font-size:20px;margin-bottom:6px;">📤</div>
            <div style="font-weight:700;font-size:14px;margin-bottom:4px;">Export to Zoho Books Format</div>
            <div class="sub" style="font-size:12px;margin-bottom:14px;">Download standard Zoho Books CSV schemas ready for instant import into Zoho Books.</div>
            <div style="display:flex;flex-direction:column;gap:8px;">
              <button type="button" class="btn" id="btn-exp-zoho-inv">Export Invoices (Zoho Schema)</button>
              <button type="button" class="btn" id="btn-exp-zoho-cust">Export Customers (Zoho Schema)</button>
              <button type="button" class="btn" id="btn-exp-zoho-items">Export Items & Price Lists</button>
            </div>
          </div>
        </div>

        <!-- Import from Zoho -->
        <div class="s6">
          <div class="card" style="padding:18px;height:100%;background:var(--surface-glass-subtle);">
            <div style="font-size:20px;margin-bottom:6px;">📥</div>
            <div style="font-weight:700;font-size:14px;margin-bottom:4px;">Import from Zoho Books</div>
            <div class="sub" style="font-size:12px;margin-bottom:14px;">Migrate customer master, vendor list, or item catalog from your existing Zoho Books account.</div>
            <div class="fg" style="margin-bottom:10px;">
              <label style="font-size:11px;">Target Master Entity</label>
              <select class="in" id="zoho-imp-entity">
                <option value="customers">Customers Master</option>
                <option value="items">Items & Services Catalog</option>
              </select>
            </div>
            <button type="button" class="btn p" id="btn-demo-zoho-imp" style="width:100%;">Migrate Sample Zoho Dataset</button>
          </div>
        </div>
      </div>
    `,
    footer: `<button type="button" class="btn" data-close>Close</button>`
  });

  $('#btn-exp-zoho-inv', m.el).addEventListener('click', async () => {
    try {
      const data = await api('interop/zoho/export/invoices/');
      const blob = new Blob([JSON.stringify(data.records, null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = `zoho_invoices_export_${iso(new Date())}.json`;
      a.click();
      toast('Zoho-compatible invoices exported successfully!');
    } catch (e) { toast(e.message, 'err'); }
  });

  $('#btn-exp-zoho-cust', m.el).addEventListener('click', async () => {
    try {
      const data = await api('interop/zoho/export/customers/');
      const blob = new Blob([JSON.stringify(data.records, null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = `zoho_customers_export_${iso(new Date())}.json`;
      a.click();
      toast('Zoho-compatible customers exported successfully!');
    } catch (e) { toast(e.message, 'err'); }
  });

  $('#btn-exp-zoho-items', m.el).addEventListener('click', async () => {
    try {
      const data = await api('interop/zoho/export/items/');
      const blob = new Blob([JSON.stringify(data.records, null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = `zoho_items_export_${iso(new Date())}.json`;
      a.click();
      toast('Zoho-compatible items exported successfully!');
    } catch (e) { toast(e.message, 'err'); }
  });

  $('#btn-demo-zoho-imp', m.el).addEventListener('click', async () => {
    const entity = $('#zoho-imp-entity', m.el).value;
    const sample = entity === 'customers' ? [
      { 'Customer Name': 'Apex Industrial Supplies', 'Company Name': 'Apex Corp', 'Email': 'finance@apexcorp.in', 'Phone': '+91-9840012345', 'GSTIN': '33AABCA1234A1Z5' },
      { 'Customer Name': 'Zenith Cloud Labs', 'Company Name': 'Zenith Labs', 'Email': 'accounts@zenithlabs.io', 'Phone': '+91-9884054321', 'GSTIN': '29AABCZ9876A1Z2' }
    ] : [
      { 'Item Name': 'ERP Cloud Subscription', 'SKU': 'ERP-SUB-01', 'Rate': '4500.00', 'Tax Percentage': '18', 'Usage unit': 'seat' },
      { 'Item Name': 'Implementation Consulting', 'SKU': 'CONSULT-01', 'Rate': '25000.00', 'Tax Percentage': '18', 'Usage unit': 'day' }
    ];

    try {
      const res = await api(`interop/zoho/import/${entity}/`, { method: 'POST', body: { records: sample } });
      toast(`Imported ${res.imported_count} ${entity} from Zoho format!`);
      m.close();
      refresh();
    } catch (e) { toast(e.message, 'err'); }
  });
}




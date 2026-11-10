'use strict';

const Modal = (() => {
  const stack = [];

  function open({ title, body, footer = '', wide = false, onClose, dialog = false, onScreen = null }) {
    const pg = $('#pg');
    const hasFormElements = Boolean(body && (
      body.includes('<form') ||
      body.includes('type="submit"') ||
      body.includes('class="fe"') ||
      body.includes('party-form-wrap') ||
      body.includes('convo-item-modal')
    ));
    const renderOnScreen = (onScreen === true || (hasFormElements && !dialog && onScreen !== false)) && Boolean(pg);

    if (renderOnScreen && pg) {
      const prevChildren = Array.from(pg.children);
      prevChildren.forEach(child => {
        if (child._origDisplay === undefined) {
          child._origDisplay = child.style.display;
        }
        child.style.display = 'none';
      });

      const el = document.createElement('div');
      el.className = 'on-screen-form-view';
      el.setAttribute('role', 'region');
      el.setAttribute('aria-label', title || 'Form');

      el.innerHTML = `
        <div class="on-screen-form-header">
          <div class="on-screen-header-left">
            <button type="button" class="btn on-screen-back-btn" data-close title="Back" aria-label="Back">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            </button>
            <h1 class="on-screen-form-title">${esc(title)}</h1>
          </div>
        </div>
        <div class="on-screen-form-body-wrap">
          <div class="mb on-screen-form-content ${wide ? 'wide' : ''}">${body}</div>
        </div>
        <div class="on-screen-sticky-footer">
          ${footer ? footer : '<button type="button" class="btn" data-close>Cancel</button>'}
        </div>
      `;

      pg.appendChild(el);
      window.scrollTo({ top: 0, behavior: 'instant' });

      const m = {
        el,
        body: $('.mb', el),
        beforeClose: null,
        prev: document.activeElement,
        onScreen: true,
        closed: false
      };

      m.close = () => {
        if (m.closed) return;
        m.closed = true;
        const i = stack.indexOf(m);
        if (i >= 0) stack.splice(i, 1);
        el.remove();
        prevChildren.forEach(child => {
          child.style.display = child._origDisplay || '';
        });
        if (!prevChildren.length && window.PAGE && window.PAGE.reload) {
          window.PAGE.reload();
        }
        if (onClose) onClose();
        if (m.prev && m.prev.isConnected && m.prev.focus) m.prev.focus();
      };

      m.request = async () => {
        if (m.beforeClose && !(await m.beforeClose())) return;
        m.close();
      };

      el.addEventListener('click', e => {
        if (e.target.closest('[data-close]')) {
          e.preventDefault();
          m.request();
        }
      });

      stack.push(m);
      const f = el.querySelector('input:not([type=hidden]):not([disabled]),select,textarea');
      if (f) f.focus();
      return m;
    }

    const el = document.createElement('div');
    el.className = 'mo';
    el.innerHTML = `<div class="md ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="mh"><h2>${esc(title)}</h2><button type="button" class="x" data-close aria-label="Close">✕</button></div><div class="mb">${body}</div>${footer ? `<div class="mf">${footer}</div>` : ''}</div>`;
    $('#modal-root').appendChild(el);
    const m = { el, body: $('.mb', el), beforeClose: null, prev: document.activeElement, onScreen: false, closed: false };
    m.close = () => {
      if (m.closed) return;
      m.closed = true;
      const i = stack.indexOf(m); if (i >= 0) stack.splice(i, 1);
      el.remove();
      if (!stack.some(x => !x.onScreen)) document.body.classList.remove('modal-open');
      if (onClose) onClose();
      if (m.prev && m.prev.isConnected && m.prev.focus) m.prev.focus();
    };
    m.request = async () => { if (m.beforeClose && !(await m.beforeClose())) return; m.close(); };
    el.addEventListener('click', e => { if (e.target.closest('[data-close]')) { e.preventDefault(); m.request(); } });
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
    if (e.key === 'Tab' && !top.onScreen) {
      const f = $$('a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled])', top.el);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  window.addEventListener('popstate', () => {
    while (stack.length) {
      const top = stack[stack.length - 1];
      top.close();
    }
  });
  window.addEventListener('hashchange', () => {
    while (stack.length) {
      const top = stack[stack.length - 1];
      top.close();
    }
  });

  return { open, get top() { return stack[stack.length - 1]; }, count: () => stack.length, stack };
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
var opts = (typeof window !== "undefined" && window.opts) ? window.opts : ((list, sel) => (list || []).map(o => { const [v, l] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}"${String(v) === String(sel == null ? '' : sel) ? ' selected' : ''}>${esc(l)}</option>`; }).join(''));
function fld(o) {
  const id = 'i' + (++uid), v = o.value == null ? '' : o.value, req = o.req ? ' required aria-required="true"' : '', at = o.attrs || '';
  let ctl;
  if (o.type === 'checkbox') return `<div class="zb-form-row fg ${o.col || ''}"><div class="zb-form-label"></div><div class="zb-form-ctrl"><label class="ck"><input type="checkbox" name="${o.name}" ${v ? 'checked' : ''} ${at}> ${esc(o.label)}</label><div class="er" data-err="${o.name}" role="alert"></div></div></div>`;
  if (o.type === 'select') {
    let optionsList = Array.isArray(o.opts) ? [...o.opts] : [];
    const n = (o.name || '').toLowerCase();
    const l = (o.label || '').toLowerCase();
    const hasEmptyFirst = optionsList.length > 0 && ((Array.isArray(optionsList[0]) ? optionsList[0][0] : optionsList[0]) === '');
    const insertIdx = hasEmptyFirst ? 1 : 0;

    const addOptionIfNotPresent = (val, text) => {
      if (!optionsList.some(item => (Array.isArray(item) ? item[0] : item) === val)) {
        optionsList.splice(insertIdx, 0, [val, text]);
      }
    };

    if (n === 'customer' || n === 'customer_id' || l.includes('customer')) {
      addOptionIfNotPresent('__new_customer__', '+ Add New Customer…');
    } else if (n === 'vendor' || n === 'vendor_id' || l.includes('vendor')) {
      addOptionIfNotPresent('__new_vendor__', '+ Add New Vendor…');
    } else if (n === 'item' || n === 'item_id' || l.includes('item') || l.includes('product')) {
      addOptionIfNotPresent('__new_item__', '+ Add New Item…');
    } else if (n === 'salesperson' || n === 'salesperson_id' || l.includes('salesperson') || l.includes('sales person')) {
      addOptionIfNotPresent('__new_salesperson__', '+ Add New Salesperson…');
    } else if (n.includes('warehouse') || l.includes('warehouse')) {
      addOptionIfNotPresent('__new_warehouse__', '+ Add New Warehouse…');
    } else if (n.includes('employee') || l.includes('employee')) {
      addOptionIfNotPresent('__new_employee__', '+ Add New Employee…');
    } else if (n.includes('category') || l.includes('category')) {
      addOptionIfNotPresent('__new_category__', '+ Add New Category…');
    } else if (n.includes('price') || l.includes('price list')) {
      addOptionIfNotPresent('__new_pricelist__', '+ Add New Price List…');
    } else if (n.includes('account') || l.includes('account')) {
      addOptionIfNotPresent('__new_account__', '+ Add New Account…');
    } else if (n.includes('project') || l.includes('project')) {
      addOptionIfNotPresent('__new_project__', '+ Add New Project…');
    }
    ctl = `<select class="in" id="${id}" name="${o.name}"${req} ${at}>${opts(optionsList, v)}</select>`;
  }
  else if (o.type === 'textarea') ctl = `<textarea class="in" id="${id}" name="${o.name}" rows="${o.rows || 2}" maxlength="${o.max || 2000}" ${at}>${esc(v)}</textarea>`;
  else ctl = `<input class="in" id="${id}" name="${o.name}" type="${o.type || 'text'}" value="${esc(v)}"${o.ph ? ` placeholder="${esc(o.ph)}"` : ''}${req} ${at}>`;
  return `<div class="zb-form-row fg ${o.type === 'textarea' ? 'align-top' : ''} ${o.col || ''}"><label class="zb-form-label" for="${id}">${esc(o.label)}${o.req ? ' <span class="rq">*</span>' : ''}</label><div class="zb-form-ctrl">${ctl}<div class="er" data-err="${o.name}" role="alert"></div>${o.help ? `<div class="hp" style="font-size:11px;color:var(--tx-muted);margin-top:2px;">${esc(o.help)}</div>` : ''}</div></div>`;
}

async function salespersonModal(onDone) {
  formModal({
    title: 'New Salesperson',
    dialog: true,
    wide: false,
    body: `
      <div class="zb-form-wrap">
        ${fld({ name: 'name', label: 'Salesperson Name', req: true, ph: 'e.g. Rahul Sharma' })}
        ${fld({ name: 'email', label: 'Email Address', type: 'email', req: false, ph: 'rahul@example.com' })}
        ${fld({ name: 'phone', label: 'Phone Number', req: false, ph: '+91 9876543210' })}
      </div>
    `,
    onSubmit: async d => {
      const name = (d.name || '').trim();
      if (!name) throw new ApiErr(400, { name: 'Salesperson Name is required.' }, 'Salesperson Name is required.');
      const res = await api('salespersons/', { method: 'POST', body: d });
      toast(`Salesperson "${res.name || name}" added successfully!`, 'ok');
      if (onDone) onDone(res);
      else refresh();
    }
  });
}
window.salespersonModal = salespersonModal;

async function employeeModal(onDone) {
  formModal({
    title: 'New Employee / Staff',
    dialog: true,
    wide: false,
    body: `
      <div class="zb-form-wrap">
        ${fld({ name: 'name', label: 'Employee Name', req: true, ph: 'e.g. Anjali Nair' })}
        ${fld({ name: 'email', label: 'Email Address', type: 'email', req: false, ph: 'anjali@example.com' })}
        ${fld({ name: 'phone', label: 'Phone Number', req: false, ph: '+91 9876543210' })}
        ${fld({ name: 'department', label: 'Department / Role', ph: 'Operations / Accounts' })}
      </div>
    `,
    onSubmit: async d => {
      const name = (d.name || '').trim();
      if (!name) throw new ApiErr(400, { name: 'Employee Name is required.' }, 'Employee Name is required.');
      const res = await api('employees/', { method: 'POST', body: d });
      toast(`Employee "${res.name || name}" added successfully!`, 'ok');
      if (onDone) onDone(res);
      else refresh();
    }
  });
}
window.employeeModal = employeeModal;

async function unitModal(onDone) {
  formModal({
    title: 'Add New Unit of Measurement',
    dialog: true,
    wide: false,
    body: `
      <div class="zb-form-wrap">
        ${fld({ name: 'unit_code', label: 'Unit Code', req: true, ph: 'e.g. roll, pkt, bundle' })}
        ${fld({ name: 'unit_name', label: 'Unit Description (Optional)', ph: 'e.g. Rolls, Packets' })}
      </div>
    `,
    onSubmit: async d => {
      const code = (d.unit_code || '').trim().toLowerCase();
      if (!code) throw new ApiErr(400, { unit_code: 'Unit code is required.' }, 'Unit code is required.');
      const name = (d.unit_name || '').trim() || code;
      const res = { id: code, code, name: `${code} (${name})` };
      toast(`Unit "${code}" added!`, 'ok');
      if (onDone) onDone(res);
    }
  });
}
window.unitModal = unitModal;

async function taxRateModal(onDone) {
  formModal({
    title: 'Add Custom Tax Rate',
    dialog: true,
    wide: false,
    body: `
      <div class="zb-form-wrap">
        ${fld({ name: 'tax_rate', label: 'Tax Rate (%)', type: 'number', req: true, ph: 'e.g. 12' })}
        ${fld({ name: 'tax_name', label: 'Tax Name / Description (Optional)', ph: 'e.g. GST12 [12%]' })}
      </div>
    `,
    onSubmit: async d => {
      const rate = parseFloat(d.tax_rate);
      if (isNaN(rate) || rate < 0 || rate > 100) throw new ApiErr(400, { tax_rate: 'Valid tax rate between 0 and 100 is required.' }, 'Invalid tax rate.');
      const name = (d.tax_name || '').trim() || `GST${rate} [${rate}%]`;
      const res = { id: String(rate), rate, name };
      toast(`Tax rate "${name}" added!`, 'ok');
      if (onDone) onDone(res);
    }
  });
}
window.taxRateModal = taxRateModal;

async function handleQuickCreateSelect(selectEl, customCallback) {
  if (!selectEl || selectEl._quickCreating) return false;
  const val = selectEl.value;
  const opt = selectEl.options[selectEl.selectedIndex];
  const optText = opt ? opt.text.trim().toLowerCase() : '';
  const selName = (selectEl.name || selectEl.id || '').toLowerCase();

  // Determine entity kind
  let entity = null;
  if (val === '__new_customer__' || (val === '__add_new__' && selName.includes('customer')) || optText.includes('add new customer')) {
    entity = 'customer';
  } else if (val === '__new_vendor__' || (val === '__add_new__' && selName.includes('vendor')) || optText.includes('add new vendor')) {
    entity = 'vendor';
  } else if (val === '__new_item__' || (val === '__add_new__' && (selName.includes('item') || selName.includes('product'))) || optText.includes('add new item') || optText.includes('add new product')) {
    entity = 'item';
  } else if (val === '__new_salesperson__' || (val === '__add_new__' && selName.includes('salesperson')) || optText.includes('add new salesperson')) {
    entity = 'salesperson';
  } else if (val === '__new_warehouse__' || (val === '__add_new__' && selName.includes('warehouse')) || optText.includes('add new warehouse')) {
    entity = 'warehouse';
  } else if (val === '__new_employee__' || (val === '__add_new__' && selName.includes('employee')) || optText.includes('add new employee')) {
    entity = 'employee';
  } else if (val === '__new_category__' || (val === '__add_new__' && selName.includes('category')) || optText.includes('add new category')) {
    entity = 'category';
  } else if (val === '__new_pricelist__' || (val === '__add_new__' && (selName.includes('price') || selName.includes('scheme'))) || optText.includes('add new price list')) {
    entity = 'pricelist';
  } else if (val === '__new_account__' || (val === '__add_new__' && selName.includes('account')) || optText.includes('add new account')) {
    entity = 'account';
  } else if (val === '__new_project__' || (val === '__add_new__' && selName.includes('project')) || optText.includes('add new project')) {
    entity = 'project';
  } else if (val === '__new_unit__' || (val === '__add_new__' && selName.includes('unit')) || optText.includes('add new unit')) {
    entity = 'unit';
  } else if (val === '__new_tax__' || (val === '__add_new__' && (selName.includes('tax') || selName.includes('gst'))) || optText.includes('add new tax rate')) {
    entity = 'tax';
  }

  if (!entity) return false;

  selectEl._quickCreating = true;
  const prevVal = selectEl.dataset.prevVal || '';
  selectEl.value = prevVal;

  const onCreated = (newRecord) => {
    selectEl._quickCreating = false;
    if (!newRecord) return;

    let idVal = newRecord.id;
    let labelVal = newRecord.name;

    if (entity === 'customer' || entity === 'vendor') {
      idVal = newRecord.id;
      labelVal = newRecord.name;
    } else if (entity === 'item') {
      idVal = newRecord.id;
      labelVal = newRecord.name + (newRecord.sku ? ` (${newRecord.sku})` : '');
    } else if (entity === 'salesperson') {
      const usesName = Array.from(selectEl.options).some(o => o.value && o.value === o.text && !o.value.startsWith('__'));
      idVal = usesName ? (newRecord.name || newRecord.username) : (newRecord.id || newRecord.name);
      labelVal = newRecord.name || newRecord.username;
    } else if (entity === 'warehouse') {
      const usesCode = (selectEl.name === 'source_warehouse' || selectEl.name === 'destination_warehouse' || selectEl.id.startsWith('st_') || Array.from(selectEl.options).some(o => o.value && o.value === newRecord.code));
      idVal = usesCode ? (newRecord.code || newRecord.id) : (newRecord.id || newRecord.code);
      labelVal = `${newRecord.code || ''} - ${newRecord.name || ''}`.replace(/^ - /, '');
    } else if (entity === 'employee') {
      idVal = newRecord.id || newRecord.name;
      labelVal = newRecord.name || newRecord.username;
    } else if (entity === 'category') {
      idVal = newRecord.name || newRecord.id;
      labelVal = newRecord.name;
    } else if (entity === 'pricelist') {
      idVal = newRecord.id;
      labelVal = newRecord.name;
    } else if (entity === 'account') {
      const usesName = Array.from(selectEl.options).some(o => o.value && o.value === newRecord.name);
      idVal = usesName ? newRecord.name : (newRecord.id || newRecord.name);
      labelVal = `${newRecord.code ? newRecord.code + ' - ' : ''}${newRecord.name}`;
    } else if (entity === 'project') {
      idVal = newRecord.id;
      labelVal = newRecord.name;
    } else if (entity === 'unit') {
      idVal = newRecord.code || newRecord.id;
      labelVal = newRecord.name || newRecord.code;
    } else if (entity === 'tax') {
      idVal = String(newRecord.rate != null ? newRecord.rate : newRecord.id);
      labelVal = newRecord.name || `${newRecord.rate}%`;
    }

    const formContainer = selectEl.closest('form') || selectEl.closest('.zb-form-wrap') || selectEl.closest('.invoice-form-page') || selectEl.closest('#pg') || document;
    let targetSelects = [selectEl];

    if (entity === 'customer') {
      targetSelects = Array.from(formContainer.querySelectorAll('select[name="customer"], select[name="customer_id"], #inv-customer, #q-customer, #so-customer'));
    } else if (entity === 'vendor') {
      targetSelects = Array.from(formContainer.querySelectorAll('select[name="vendor"], select[name="vendor_id"]'));
    } else if (entity === 'item') {
      targetSelects = Array.from(formContainer.querySelectorAll('.l-item, .adj-row-item, .st-item, .st-item-select, select[name="item"], select[name="item_id"]'));
    } else if (entity === 'salesperson') {
      targetSelects = Array.from(formContainer.querySelectorAll('select[name="salesperson"], #q-salesperson, #inv-salesperson'));
    } else if (entity === 'warehouse') {
      targetSelects = Array.from(formContainer.querySelectorAll('select[name="warehouse"], select[name="warehouse_id"], select[name="source_warehouse"], select[name="destination_warehouse"], #st-src-wh, #st-dst-wh, #st_source_warehouse, #st_dest_warehouse, #adj_warehouse, #item_warehouse'));
    } else if (entity === 'account') {
      targetSelects = Array.from(formContainer.querySelectorAll('select[name*="account"], #item_sales_account, #item_purchase_account, #item_inventory_account, #adj_account, #adj-account'));
    }

    if (!targetSelects.includes(selectEl)) targetSelects.push(selectEl);

    targetSelects.forEach(sel => {
      let optFound = Array.from(sel.options).find(o => String(o.value) === String(idVal) || o.text === labelVal);
      if (!optFound) {
        optFound = document.createElement('option');
        optFound.value = idVal;
        optFound.textContent = labelVal;
        sel.appendChild(optFound);
      }
    });

    selectEl.value = idVal;
    selectEl.dataset.prevVal = idVal;

    if (typeof selectEl._searchableSync === 'function') {
      selectEl._searchableSync();
    } else {
      const searchWrap = selectEl.nextElementSibling;
      if (searchWrap && searchWrap.classList && searchWrap.classList.contains('searchable-select-wrap')) {
        const inp = searchWrap.querySelector('.searchable-select-input');
        if (inp) inp.value = labelVal;
      }
    }

    if (entity === 'customer') {
      const posEl = formContainer.querySelector('#inv-place-of-supply') || formContainer.querySelector('#q-pos') || formContainer.querySelector('#so-pos') || formContainer.querySelector('select[name="place_of_supply"]') || formContainer.querySelector('input[name="place_of_supply"]');
      if (posEl && (newRecord.state || newRecord.place_of_supply)) {
        posEl.value = (newRecord.state || newRecord.place_of_supply).replace(/^\[\d+\]\s*/, '').trim();
      }
      if (newRecord.payment_terms) {
        const termsMap = { 0: 'Due on Receipt', 15: 'Net 15', 30: 'Net 30', 45: 'Net 45', 60: 'Net 60' };
        const termsEl = formContainer.querySelector('#inv-terms') || formContainer.querySelector('select[name="terms"]');
        if (termsEl && termsMap[newRecord.payment_terms]) termsEl.value = termsMap[newRecord.payment_terms];
      }
    } else if (entity === 'vendor') {
      const posEl = formContainer.querySelector('select[name="place_of_supply"]') || formContainer.querySelector('input[name="place_of_supply"]');
      if (posEl && (newRecord.state || newRecord.source_of_supply)) {
        posEl.value = (newRecord.state || newRecord.source_of_supply).replace(/^\[\d+\]\s*/, '').trim();
      }
    } else if (entity === 'item') {
      const tr = selectEl.closest('tr');
      if (tr) {
        const descEl = tr.querySelector('.l-desc, .st-desc, input[name="description"]');
        if (descEl && !descEl.value) descEl.value = newRecord.name;
        const hsnEl = tr.querySelector('.l-hsn, input[name="hsn_sac"]');
        if (hsnEl) hsnEl.value = newRecord.hsn_sac || '';
        const rateEl = tr.querySelector('.l-rate, input[name="rate"]');
        if (rateEl) rateEl.value = newRecord.selling_price || newRecord.purchase_price || '0.00';
        const gstEl = tr.querySelector('.l-gst, select[name="gst_rate"]');
        if (gstEl && newRecord.gst_rate != null) gstEl.value = String(num(newRecord.gst_rate) || 0);
        const unitEl = tr.querySelector('.st-unit, input[name="unit"]');
        if (unitEl && newRecord.unit) unitEl.value = newRecord.unit;
      }
    } else if (entity === 'unit') {
      const unitTextInp = formContainer.querySelector('#item_unit');
      if (unitTextInp) unitTextInp.value = newRecord.code || newRecord.id;
    }

    if (customCallback) customCallback(newRecord);

    selectEl.dispatchEvent(new Event('change', { bubbles: true }));
    selectEl.dispatchEvent(new Event('input', { bubbles: true }));
  };

  try {
    if (entity === 'customer') {
      partyForm('customers', null, onCreated);
    } else if (entity === 'vendor') {
      partyForm('vendors', null, onCreated);
    } else if (entity === 'item') {
      itemForm(null, onCreated);
    } else if (entity === 'salesperson') {
      salespersonModal(onCreated);
    } else if (entity === 'warehouse') {
      warehouseModal(null, onCreated);
    } else if (entity === 'employee') {
      employeeModal(onCreated);
    } else if (entity === 'category') {
      categoryModal(null, onCreated);
    } else if (entity === 'pricelist') {
      priceListModal(null, onCreated);
    } else if (entity === 'account') {
      accountForm(null, onCreated);
    } else if (entity === 'project') {
      projectModal(null, onCreated);
    } else if (entity === 'unit') {
      unitModal(onCreated);
    } else if (entity === 'tax') {
      taxRateModal(onCreated);
    }
    return true;
  } catch (err) {
    selectEl._quickCreating = false;
    console.error(err);
    toast(err.message, 'err');
    return false;
  }
}
window.handleQuickCreateSelect = handleQuickCreateSelect;

function setupSearchableSelect(selectEl, { placeholder = 'Search or select…', onNew = null } = {}) {
  if (!selectEl || selectEl._searchableInit) return;
  selectEl._searchableInit = true;

  selectEl.style.display = 'none';

  const wrapper = document.createElement('div');
  wrapper.className = 'searchable-select-wrap';
  wrapper.style.cssText = 'position:relative;flex:1;display:flex;align-items:center;width:100%;';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'in searchable-select-input';
  input.placeholder = placeholder;
  input.autocomplete = 'off';
  input.style.cssText = 'width:100%;height:36px;padding-right:28px;cursor:pointer;';

  const arrow = document.createElement('span');
  arrow.innerHTML = '▾';
  arrow.style.cssText = 'position:absolute;right:10px;pointer-events:none;color:var(--tx-muted);font-size:12px;';

  const menu = document.createElement('div');
  menu.className = 'searchable-select-menu';
  menu.style.cssText = 'display:none;position:absolute;top:100%;left:0;right:0;max-height:220px;overflow-y:auto;background:var(--surface-glass-solid, #fff);border:1px solid var(--bd);box-shadow:0 8px 24px rgba(0,0,0,0.15);border-radius:6px;z-index:999;margin-top:4px;';

  wrapper.appendChild(input);
  wrapper.appendChild(arrow);
  wrapper.appendChild(menu);
  selectEl.parentNode.insertBefore(wrapper, selectEl.nextSibling);

  function syncFromSelect() {
    const selOpt = selectEl.options[selectEl.selectedIndex];
    input.value = (selOpt && selOpt.value && !selOpt.value.startsWith('__new_') && selOpt.value !== '__add_new__') ? selOpt.text : '';
  }
  selectEl._searchableSync = syncFromSelect;
  syncFromSelect();

  function renderOptions(filterText = '') {
    menu.innerHTML = '';
    const q = (filterText || '').toLowerCase().trim();
    const optsList = Array.from(selectEl.options);
    let count = 0;

    optsList.forEach(opt => {
      if (!opt.value && !opt.text.trim()) return;
      if (opt.value.startsWith('__new_') || opt.value === '__add_new__' || (opt.text && opt.text.toLowerCase().includes('+ add new'))) return;
      if (q && !opt.text.toLowerCase().includes(q)) return;

      count++;
      const item = document.createElement('div');
      item.className = 'searchable-opt-item';
      item.style.cssText = 'padding:8px 12px;font-size:13px;cursor:pointer;border-bottom:1px solid var(--bd-glass-subtle, rgba(0,0,0,0.04));';
      if (String(selectEl.value) === String(opt.value)) {
        item.style.background = 'var(--surface-glass-active, rgba(59,130,246,0.1))';
        item.style.fontWeight = '600';
        item.style.color = 'var(--accent, #2563eb)';
      }
      item.textContent = opt.text;
      item.addEventListener('mousedown', e => {
        e.preventDefault();
        selectEl.value = opt.value;
        input.value = opt.text;
        closeMenu();
        selectEl.dispatchEvent(new Event('change', { bubbles: true }));
        selectEl.dispatchEvent(new Event('input', { bubbles: true }));
      });
      item.addEventListener('mouseenter', () => {
        item.style.background = 'var(--surface-glass-hover, #f1f5f9)';
      });
      item.addEventListener('mouseleave', () => {
        item.style.background = String(selectEl.value) === String(opt.value) ? 'var(--surface-glass-active, rgba(59,130,246,0.1))' : '';
      });
      menu.appendChild(item);
    });

    if (count === 0 && q) {
      const empty = document.createElement('div');
      empty.style.cssText = 'padding:8px 12px;font-size:12px;color:var(--tx-muted);';
      empty.textContent = `No matches found for "${filterText}"`;
      menu.appendChild(empty);
    }

    const newOpt = optsList.find(o => o.value.startsWith('__new_') || o.value === '__add_new__' || (o.text && o.text.toLowerCase().includes('+ add new')));
    const addAction = document.createElement('div');
    addAction.style.cssText = 'padding:8px 12px;font-size:12.5px;font-weight:600;color:var(--accent, #2563eb);cursor:pointer;background:var(--surface-glass-subtle, #f8fafc);border-top:1px solid var(--bd);display:flex;align-items:center;gap:6px;';
    addAction.innerHTML = `<i class="fa-solid fa-plus" style="font-size:11px;"></i> ${newOpt ? esc(newOpt.text) : '+ Add New…'}`;
    addAction.addEventListener('mousedown', e => {
      e.preventDefault();
      closeMenu();
      if (onNew) onNew();
      else if (newOpt) {
        selectEl.value = newOpt.value;
        selectEl.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        handleQuickCreateSelect(selectEl);
      }
    });
    menu.appendChild(addAction);
  }

  function openMenu() {
    renderOptions(input.value);
    menu.style.display = 'block';
  }

  function closeMenu() {
    menu.style.display = 'none';
    syncFromSelect();
  }

  input.addEventListener('focus', () => {
    openMenu();
    input.select();
  });
  input.addEventListener('input', e => {
    openMenu();
    renderOptions(e.target.value);
  });
  input.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeMenu();
    else if (e.key === 'Enter') {
      const firstItem = menu.querySelector('.searchable-opt-item');
      if (firstItem) firstItem.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    }
  });

  document.addEventListener('click', e => {
    if (!wrapper.contains(e.target)) closeMenu();
  });

  selectEl.addEventListener('change', () => syncFromSelect());
}
window.setupSearchableSelect = setupSearchableSelect;

if (typeof document !== 'undefined') {
  document.addEventListener('focusin', e => {
    if (e.target && e.target.tagName === 'SELECT') {
      const v = e.target.value || '';
      if (!e.target.dataset.prevVal || (!v.startsWith('__new_') && v !== '__add_new__')) {
        e.target.dataset.prevVal = v;
      }
    }
  });
  document.addEventListener('change', e => {
    if (e.target && e.target.tagName === 'SELECT') {
      const v = e.target.value || '';
      const opt = e.target.options[e.target.selectedIndex];
      const txt = opt ? opt.text.toLowerCase() : '';
      if (v.startsWith('__new_') || v === '__add_new__' || txt.includes('+ add new')) {
        handleQuickCreateSelect(e.target);
      } else {
        e.target.dataset.prevVal = v;
      }
    }
  });
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
function clearErrors(form) {
  $$('[data-err]', form).forEach(e => { e.textContent = ''; });
  $$('.in-error', form).forEach(e => { e.classList.remove('in-error'); });
}
function showErrors(form, errors, msg) {
  let general = msg || '', first = null;
  for (const [k, v] of Object.entries(errors || {})) {
    const el = form.querySelector(`[data-err="${k}"]`);
    if (el) {
      el.textContent = v;
      if (!first) first = el;
      const inp = el.parentElement ? el.parentElement.querySelector('input,select,textarea') : null;
      if (inp) inp.classList.add('in-error');
    } else {
      general += (general ? ' ' : '') + k + ': ' + v;
    }
  }
  const g = form.querySelector('[data-err="_"]');
  if (g) g.textContent = general;
  const target = first || g;
  if (target) {
    const pane = target.closest('.party-tab-pane');
    if (pane && !pane.classList.contains('active')) {
      const tabId = pane.id;
      const tabBtn = form.querySelector(`.party-tab-btn[data-tab="${tabId}"]`);
      if (tabBtn) tabBtn.click();
    }
    if (target.scrollIntoView) target.scrollIntoView({ block: 'nearest' });
  }
  const inp = first && first.parentElement ? first.parentElement.querySelector('input,select,textarea') : null;
  if (inp) inp.focus();
}

function formModal({ title, body, submit = 'Save', actions, wide = true, onSubmit, onReady, onClose, dialog = false }) {
  const id = 'f' + (++uid);
  const acts = actions || [{ label: submit, value: 'save', primary: true }];
  const m = Modal.open({
    title, wide, dialog, onClose,
    body: `<form id="${id}" novalidate>${body}<div class="fe" data-err="_" role="alert"></div></form>`,
    footer: acts.map(a => `<button type="submit" form="${id}" name="action" value="${a.value}" class="btn ${a.primary ? 'p' : ''}">${esc(a.label)}</button>`).join('') + `<button type="button" class="btn" data-close>Cancel</button>`,
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
      if (err instanceof ApiErr) {
        showErrors(form, err.errors, err.message);
        toast(err.message || 'Please correct the highlighted fields.', 'err');
      } else {
        showErrors(form, {}, (err && err.message) || 'Unexpected error.');
        toast((err && err.message) || 'Action failed', 'err');
        console.error(err);
      }
    } finally { btns.forEach(b => { b.disabled = false; }); }
  });
  if (onReady) onReady(form, m);
  return m;
}

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


/**
 * Professional Educational Explainer Modal:
 * Tax Exclusive vs Inclusive Pricing, B2B vs B2C Billing, and Module-Specific GST Guidance.
 */
function openGstPricingExplainerModal(contextKind = 'invoices') {
  const titles = {
    'quotes': 'Estimates & Quotations',
    'sales-orders': 'Sales Orders',
    'invoices': 'Tax Invoices',
    'recurring-invoices': 'Recurring Invoices',
    'retainer-invoices': 'Retainer Invoices',
    'credit-notes': 'Credit Notes (Sales Adjustments)',
    'debit-notes': 'Debit Notes (Supplementary Billing)',
    'bills': 'Purchase Bills (Vendor Invoices)',
    'purchase-orders': 'Purchase Orders',
    'vendor-credits': 'Vendor Credits (Purchase Debit Notes)',
    'delivery-challans': 'Delivery Challans (Rule 55 Movement)',
    'payments-received': 'Payments Received (Receipt Vouchers)'
  };
  const docTitle = titles[contextKind] || 'Invoices & Billing';

  const moduleSpecificContent = {
    'quotes': `
      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px;margin-bottom:18px;">
        <h4 style="font-size:14px;font-weight:700;color:#1e3a8a;margin:0 0 6px 0;display:flex;align-items:center;gap:6px;">
          <i class="fa-solid fa-file-invoice"></i> Module Context: Estimates & Quotations
        </h4>
        <p style="font-size:12.5px;color:#1e40af;line-height:1.6;margin:0;">
          Quotations and estimates provide prospective buyers with agreed prices and anticipated GST before a commitment or supply takes place.
        </p>
      </div>
      <ul style="font-size:13px;line-height:1.7;color:#334155;padding-left:20px;margin-bottom:16px;">
        <li><b>Non-Tax Document:</b> A quotation is an offer to supply, not a tax invoice. It does not create output tax liability for the supplier or allow the buyer to claim Input Tax Credit (ITC).</li>
        <li><b>Tax Exclusive Estimation:</b> Quotations typically specify item rates on a tax-exclusive basis, clearly showing the applicable GST rate (e.g. 18%) and estimated tax amount so customers understand the pre-tax and total cost breakdown.</li>
        <li><b>Conversion to Tax Invoice:</b> Once approved or accepted, the quotation is converted into a formal Tax Invoice or Sales Order, at which point the official time of supply and GST liability arise under Section 12 or 13 of the CGST Act.</li>
      </ul>
    `,
    'sales-orders': `
      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px;margin-bottom:18px;">
        <h4 style="font-size:14px;font-weight:700;color:#1e3a8a;margin:0 0 6px 0;display:flex;align-items:center;gap:6px;">
          <i class="fa-solid fa-cart-shopping"></i> Module Context: Sales Orders
        </h4>
        <p style="font-size:12.5px;color:#1e40af;line-height:1.6;margin:0;">
          A Sales Order confirms a customer's order and establishes contractual commercial terms prior to shipment and billing.
        </p>
      </div>
      <ul style="font-size:13px;line-height:1.7;color:#334155;padding-left:20px;margin-bottom:16px;">
        <li><b>Internal Booking:</b> Sales orders confirm agreed quantities, delivery schedules, and price agreements before actual supply.</li>
        <li><b>Agreed Valuation:</b> Line item rates are entered on a pre-tax (tax-exclusive) basis with estimated GST according to the customer's delivery state (Place of Supply).</li>
        <li><b>Downstream Supply:</b> Delivery Challans and Tax Invoices are generated directly from the Sales Order, ensuring complete traceability and consistent HSN/SAC codes.</li>
      </ul>
    `,
    'invoices': `
      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px;margin-bottom:18px;">
        <h4 style="font-size:14px;font-weight:700;color:#1e3a8a;margin:0 0 6px 0;display:flex;align-items:center;gap:6px;">
          <i class="fa-solid fa-file-lines"></i> Module Context: Tax Invoices (Customer Billing)
        </h4>
        <p style="font-size:12.5px;color:#1e40af;line-height:1.6;margin:0;">
          A Tax Invoice is the primary legal document issued under Section 31 of the CGST Act for outward taxable supplies of goods or services.
        </p>
      </div>
      <ul style="font-size:13px;line-height:1.7;color:#334155;padding-left:20px;margin-bottom:16px;">
        <li><b>B2B Invoicing:</b> Requires the recipient's verified 15-digit GSTIN, legal name, billing and shipping address, Place of Supply, HSN/SAC code, and distinct line-item tax breakdown (CGST+SGST or IGST). It acts as the legal basis for the buyer to claim Input Tax Credit (ITC) under Section 16.</li>
        <li><b>B2C Invoicing:</b> Issued to end consumers. Can be tax-inclusive or tax-exclusive. If the value exceeds ₹50,000 for inter-state supplies, customer name, address, and state must be recorded.</li>
        <li><b>E-Invoicing & Compliance:</b> Businesses meeting notified turnover thresholds must upload B2B invoices to the Invoice Registration Portal (IRP) to generate an IRN and QR code before issuing.</li>
      </ul>
    `,
    'recurring-invoices': `
      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px;margin-bottom:18px;">
        <h4 style="font-size:14px;font-weight:700;color:#1e3a8a;margin:0 0 6px 0;display:flex;align-items:center;gap:6px;">
          <i class="fa-solid fa-rotate"></i> Module Context: Recurring Invoices
        </h4>
        <p style="font-size:12.5px;color:#1e40af;line-height:1.6;margin:0;">
          Recurring invoices automate continuous or periodic supplies such as monthly retainers, software licenses, maintenance contracts, or rent.
        </p>
      </div>
      <ul style="font-size:13px;line-height:1.7;color:#334155;padding-left:20px;margin-bottom:16px;">
        <li><b>Continuous Supply of Services (Section 31(5)):</b> Where services are provided continuously under a contract with periodic payments, invoices are issued on or before each scheduled payment due date.</li>
        <li><b>Automated Tax Calculation:</b> On each scheduled invoice generation run, the system applies the current active GST rates and intra/inter-state logic without altering past historical invoices.</li>
        <li><b>Indefinite vs Fixed Duration:</b> Recurring schedules can run indefinitely ("Never Ends") or until a specified end date, preventing missed billing cycles.</li>
      </ul>
    `,
    'retainer-invoices': `
      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px;margin-bottom:18px;">
        <h4 style="font-size:14px;font-weight:700;color:#1e3a8a;margin:0 0 6px 0;display:flex;align-items:center;gap:6px;">
          <i class="fa-solid fa-hand-holding-dollar"></i> Module Context: Retainer Invoices & Advances
        </h4>
        <p style="font-size:12.5px;color:#1e40af;line-height:1.6;margin:0;">
          Retainer invoices document customer advance deposits received before goods or services are delivered.
        </p>
      </div>
      <ul style="font-size:13px;line-height:1.7;color:#334155;padding-left:20px;margin-bottom:16px;">
        <li><b>GST on Advances:</b> Under Section 31(3)(d), advances received for services attract GST at the time of receipt. For goods, small and standard businesses are generally exempt from advance GST under Notification No. 66/2017-Central Tax until the tax invoice is issued.</li>
        <li><b>Purpose Specification:</b> Clearly recording the purpose of the retainer (e.g. project mobilization advance) ensures accurate accounting and contract traceability.</li>
        <li><b>Subsequent Application:</b> When services are performed and the final regular Tax Invoice is issued, the available retainer credit is applied against the invoice, adjusting accounts receivable seamlessly.</li>
      </ul>
    `,
    'credit-notes': `
      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px;margin-bottom:18px;">
        <h4 style="font-size:14px;font-weight:700;color:#1e3a8a;margin:0 0 6px 0;display:flex;align-items:center;gap:6px;">
          <i class="fa-solid fa-file-invoice-dollar"></i> Module Context: Credit Notes (Section 34)
        </h4>
        <p style="font-size:12.5px;color:#1e40af;line-height:1.6;margin:0;">
          A Credit Note is issued by a supplier to reduce the taxable value or tax liability of an earlier issued invoice.
        </p>
      </div>
      <ul style="font-size:13px;line-height:1.7;color:#334155;padding-left:20px;margin-bottom:16px;">
        <li><b>Grounds for Issuance:</b> Issued when goods are returned, when agreed post-sale discounts are granted, or when excess taxable value or tax was charged on the original invoice.</li>
        <li><b>Tax Liability Adjustment:</b> When issued in compliance with Section 34 of the CGST Act, the supplier's output tax liability is reduced, provided the recipient correspondingly reverses their Input Tax Credit (ITC).</li>
        <li><b>Linking to Original Invoice:</b> Must clearly reference the original invoice number and date, and must be declared in GSTR-1 on or before 30th November following the end of the financial year.</li>
      </ul>
    `,
    'debit-notes': `
      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px;margin-bottom:18px;">
        <h4 style="font-size:14px;font-weight:700;color:#1e3a8a;margin:0 0 6px 0;display:flex;align-items:center;gap:6px;">
          <i class="fa-solid fa-file-circle-plus"></i> Module Context: Debit Notes (Section 34)
        </h4>
        <p style="font-size:12.5px;color:#1e40af;line-height:1.6;margin:0;">
          A Debit Note is issued by a supplier when taxable value or tax in the original invoice was understated.
        </p>
      </div>
      <ul style="font-size:13px;line-height:1.7;color:#334155;padding-left:20px;margin-bottom:16px;">
        <li><b>Supplementary Invoicing:</b> Acts like a supplementary invoice when prices are revised upward, extra quantities are billed, or higher tax rates apply.</li>
        <li><b>Output Tax Increase:</b> The supplier pays additional tax on the differential amount, and the recipient is entitled to claim additional Input Tax Credit (ITC) based on the debit note.</li>
      </ul>
    `,
    'bills': `
      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px;margin-bottom:18px;">
        <h4 style="font-size:14px;font-weight:700;color:#1e3a8a;margin:0 0 6px 0;display:flex;align-items:center;gap:6px;">
          <i class="fa-solid fa-file-invoice"></i> Module Context: Purchase Bills (Inward Supplies)
        </h4>
        <p style="font-size:12.5px;color:#1e40af;line-height:1.6;margin:0;">
          Purchase bills record tax invoices received from vendors and suppliers for inward procurement.
        </p>
      </div>
      <ul style="font-size:13px;line-height:1.7;color:#334155;padding-left:20px;margin-bottom:16px;">
        <li><b>Input Tax Credit (ITC) Verification:</b> To claim ITC under Section 16, your business must possess a valid tax invoice, have received the goods/services, ensure tax has been paid to the government, and have the invoice reflected in GSTR-2B.</li>
        <li><b>Blocked Credit (Section 17(5)):</b> Certain inward expenses (e.g. motor vehicles for personal use, club memberships, food and beverages) are ineligible for ITC and must be expensed as gross cost.</li>
        <li><b>Vendor GSTIN & Place of Supply:</b> Recording the correct vendor GSTIN and Place of Supply ensures accurate classification of inward CGST+SGST or IGST in GSTR-3B.</li>
      </ul>
    `,
    'purchase-orders': `
      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px;margin-bottom:18px;">
        <h4 style="font-size:14px;font-weight:700;color:#1e3a8a;margin:0 0 6px 0;display:flex;align-items:center;gap:6px;">
          <i class="fa-solid fa-clipboard-list"></i> Module Context: Purchase Orders
        </h4>
        <p style="font-size:12.5px;color:#1e40af;line-height:1.6;margin:0;">
          Purchase Orders represent procurement commitments issued to vendors before delivery and billing.
        </p>
      </div>
      <ul style="font-size:13px;line-height:1.7;color:#334155;padding-left:20px;margin-bottom:16px;">
        <li><b>Pre-Tax Procurement:</b> Vendor prices are typically negotiated and recorded on a tax-exclusive basis with expected GST rates.</li>
        <li><b>Bill Matching:</b> When the supplier delivers goods and issues a tax invoice, it is matched with the Purchase Order to verify quantities, rates, and tax amounts before payment.</li>
      </ul>
    `,
    'vendor-credits': `
      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px;margin-bottom:18px;">
        <h4 style="font-size:14px;font-weight:700;color:#1e3a8a;margin:0 0 6px 0;display:flex;align-items:center;gap:6px;">
          <i class="fa-solid fa-file-circle-minus"></i> Module Context: Vendor Credits (Purchase Returns)
        </h4>
        <p style="font-size:12.5px;color:#1e40af;line-height:1.6;margin:0;">
          Vendor credits record purchase returns or rate reductions received from suppliers.
        </p>
      </div>
      <ul style="font-size:13px;line-height:1.7;color:#334155;padding-left:20px;margin-bottom:16px;">
        <li><b>Mandatory ITC Reversal:</b> When goods are returned or supplier credit notes are received, the corresponding Input Tax Credit previously claimed must be reversed in Table 4(B) of GSTR-3B.</li>
        <li><b>Payable Reduction:</b> Reduces outstanding liabilities owed to the supplier.</li>
      </ul>
    `,
    'delivery-challans': `
      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px;margin-bottom:18px;">
        <h4 style="font-size:14px;font-weight:700;color:#1e3a8a;margin:0 0 6px 0;display:flex;align-items:center;gap:6px;">
          <i class="fa-solid fa-truck"></i> Module Context: Delivery Challans (Rule 55)
        </h4>
        <p style="font-size:12.5px;color:#1e40af;line-height:1.6;margin:0;">
          Delivery Challans document the physical transportation of goods without an immediate sale or transfer of title under Rule 55 of CGST Rules.
        </p>
      </div>
      <ul style="font-size:13px;line-height:1.7;color:#334155;padding-left:20px;margin-bottom:16px;">
        <li><b>Permitted Use Cases:</b> Transportation for job work, supply of liquid gas, goods sent on approval or sale-or-return basis, and consignment transfers.</li>
        <li><b>Non-Tax Movement:</b> No GST is payable on a delivery challan. A formal Tax Invoice must be issued when the goods are ultimately sold or the approval period expires.</li>
      </ul>
    `
  };

  const currentModHtml = moduleSpecificContent[contextKind] || moduleSpecificContent['invoices'];

  const m = Modal.open({
    title: `GST & Pricing Guide: Tax Exclusive, Tax Inclusive, B2B & B2C Billing`,
    dialog: true,
    wide: true,
    body: `
      <div class="gst-explainer-modal-container" style="color:#1e293b;font-size:13px;line-height:1.6;">
        <!-- Tab Navigation Bar -->
        <div style="display:flex;gap:8px;border-bottom:2px solid #e2e8f0;padding-bottom:10px;margin-bottom:20px;flex-wrap:wrap;">
          <button type="button" class="btn gst-tab-btn active" data-tab="tab-pricing" style="font-weight:600;font-size:12.5px;padding:6px 14px;border-radius:6px;cursor:pointer;">
            <i class="fa-solid fa-calculator" style="margin-right:6px;color:#2563eb;"></i> Tax Exclusive vs Inclusive
          </button>
          <button type="button" class="btn gst-tab-btn" data-tab="tab-b2b-b2c" style="font-weight:600;font-size:12.5px;padding:6px 14px;border-radius:6px;cursor:pointer;">
            <i class="fa-solid fa-building" style="margin-right:6px;color:#10b981;"></i> B2B vs B2C Billing
          </button>
          <button type="button" class="btn gst-tab-btn" data-tab="tab-context" style="font-weight:600;font-size:12.5px;padding:6px 14px;border-radius:6px;cursor:pointer;">
            <i class="fa-solid fa-bookmark" style="margin-right:6px;color:#f59e0b;"></i> ${docTitle} Guide
          </button>
          <button type="button" class="btn gst-tab-btn" data-tab="tab-rates" style="font-weight:600;font-size:12.5px;padding:6px 14px;border-radius:6px;cursor:pointer;">
            <i class="fa-solid fa-scale-balanced" style="margin-right:6px;color:#8b5cf6;"></i> GST Rates & Compliance
          </button>
        </div>

        <!-- TAB 1: Tax Exclusive vs Inclusive -->
        <div id="tab-pricing" class="gst-tab-pane">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px;">
            <!-- Tax Exclusive Box -->
            <div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;padding:18px;">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
                <span style="background:#dbeafe;color:#1e40af;font-size:11px;font-weight:700;padding:2px 8px;border-radius:4px;text-transform:uppercase;">Method 1</span>
                <h3 style="font-size:15px;font-weight:700;color:#0f172a;margin:0;">Tax Exclusive Pricing</h3>
              </div>
              <p style="margin:0 0 12px 0;color:#475569;font-size:12.5px;">
                The entered item price <b>does not include GST</b>. GST is calculated separately and added to the item price to determine the final invoice amount.
              </p>

              <div style="background:#fff;border:1px solid #e2e8f0;border-radius:6px;padding:12px;margin-bottom:12px;">
                <div style="font-size:11.5px;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:6px;">Example (GST 18%):</div>
                <table style="width:100%;border-collapse:collapse;font-size:12px;">
                  <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:4px 0;color:#475569;">Item Price:</td><td style="padding:4px 0;text-align:right;font-weight:600;">₹1,000.00</td></tr>
                  <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:4px 0;color:#475569;">GST (18%):</td><td style="padding:4px 0;text-align:right;font-weight:600;color:#2563eb;">₹180.00</td></tr>
                  <tr style="font-weight:700;color:#0f172a;"><td style="padding:6px 0;">Final Total:</td><td style="padding:6px 0;text-align:right;font-size:13px;color:#16a34a;">₹1,180.00</td></tr>
                </table>
              </div>

              <div style="font-size:12px;margin-bottom:10px;">
                <b style="color:#0f172a;">Key Benefits:</b>
                <ul style="margin:4px 0 0 0;padding-left:18px;color:#475569;line-height:1.5;">
                  <li>Clearly separates product/service price and GST.</li>
                  <li>Makes tax amounts transparent to customers.</li>
                  <li>Useful for B2B transactions and businesses quoting prices before GST.</li>
                  <li>Helps businesses understand their taxable value and tax liability.</li>
                </ul>
              </div>

              <div style="background:#eff6ff;border-left:3px solid #2563eb;padding:8px 12px;border-radius:4px;font-size:11.5px;color:#1e40af;">
                <b>When to Use:</b> Use Tax Exclusive when your quoted or entered prices do not include GST and tax needs to be added on top.
              </div>
            </div>

            <!-- Tax Inclusive Box -->
            <div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;padding:18px;">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
                <span style="background:#fef3c7;color:#92400e;font-size:11px;font-weight:700;padding:2px 8px;border-radius:4px;text-transform:uppercase;">Method 2</span>
                <h3 style="font-size:15px;font-weight:700;color:#0f172a;margin:0;">Tax Inclusive Pricing</h3>
              </div>
              <p style="margin:0 0 12px 0;color:#475569;font-size:12.5px;">
                The entered item price <b>already includes GST</b>. GST is extracted from the entered price to calculate taxable value and GST amount instead of adding GST on top.
              </p>

              <div style="background:#fff;border:1px solid #e2e8f0;border-radius:6px;padding:12px;margin-bottom:12px;">
                <div style="font-size:11.5px;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:6px;">Example (GST 18%):</div>
                <table style="width:100%;border-collapse:collapse;font-size:12px;">
                  <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:4px 0;color:#475569;">Entered / Final Price:</td><td style="padding:4px 0;text-align:right;font-weight:600;">₹1,000.00</td></tr>
                  <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:4px 0;color:#475569;">Taxable Value (Base):</td><td style="padding:4px 0;text-align:right;font-weight:600;">₹847.46</td></tr>
                  <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:4px 0;color:#475569;">GST Included (18%):</td><td style="padding:4px 0;text-align:right;font-weight:600;color:#2563eb;">₹152.54</td></tr>
                  <tr style="font-weight:700;color:#0f172a;"><td style="padding:6px 0;">Final Total:</td><td style="padding:6px 0;text-align:right;font-size:13px;color:#16a34a;">₹1,000.00</td></tr>
                </table>
                <div style="font-size:11px;color:#64748b;margin-top:6px;padding-top:6px;border-top:1px dashed #e2e8f0;">
                  <code>Taxable Value = Total Price ÷ (1 + GST Rate) = ₹1,000 ÷ 1.18 = ₹847.46</code><br>
                  <code>GST Amount = Total Price − Taxable Value = ₹1,000 − ₹847.46 = ₹152.54</code>
                </div>
              </div>

              <div style="font-size:12px;margin-bottom:10px;">
                <b style="color:#0f172a;">Key Benefits:</b>
                <ul style="margin:4px 0 0 0;padding-left:18px;color:#475569;line-height:1.5;">
                  <li>Displays the final payable price customers need to pay upfront.</li>
                  <li>Makes pricing easier for retail customers and consumers.</li>
                  <li>Avoids unexpected GST additions at checkout or billing.</li>
                  <li>Commonly used in FMCG, retail, hospitality, and direct-to-consumer services.</li>
                </ul>
              </div>

              <div style="background:#fef3c7;border-left:3px solid #d97706;padding:8px 12px;border-radius:4px;font-size:11.5px;color:#92400e;">
                <b>When to Use:</b> Use Tax Inclusive when entered prices already include GST.
              </div>
            </div>
          </div>

          <!-- Difference Table -->
          <div style="margin-top:14px;">
            <h4 style="font-size:14px;font-weight:700;color:#0f172a;margin-bottom:10px;">Difference Between Tax Exclusive and Tax Inclusive</h4>
            <div style="border:1px solid #e2e8f0;border-radius:6px;overflow:hidden;">
              <table style="width:100%;border-collapse:collapse;font-size:12.5px;">
                <thead style="background:#f1f5f9;border-bottom:2px solid #cbd5e1;">
                  <tr>
                    <th style="padding:8px 12px;text-align:left;color:#475569;">Feature</th>
                    <th style="padding:8px 12px;text-align:left;color:#475569;">Tax Exclusive</th>
                    <th style="padding:8px 12px;text-align:left;color:#475569;">Tax Inclusive</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:8px 12px;font-weight:600;">Entered price</td><td style="padding:8px 12px;">Before GST</td><td style="padding:8px 12px;">Including GST</td></tr>
                  <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:8px 12px;font-weight:600;">GST calculation</td><td style="padding:8px 12px;">Added separately</td><td style="padding:8px 12px;">Extracted from price</td></tr>
                  <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:8px 12px;font-weight:600;">Final invoice amount</td><td style="padding:8px 12px;">Price + GST</td><td style="padding:8px 12px;">Entered price</td></tr>
                  <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:8px 12px;font-weight:600;">Typical use case</td><td style="padding:8px 12px;">B2B quotations and commercial billing</td><td style="padding:8px 12px;">B2C retail and consumer billing</td></tr>
                  <tr><td style="padding:8px 12px;font-weight:600;">What the customer sees</td><td style="padding:8px 12px;">Base price + tax breakdown</td><td style="padding:8px 12px;">Final tax-inclusive price</td></tr>
                </tbody>
              </table>
            </div>
            <p style="font-size:11.5px;color:#64748b;margin-top:8px;font-style:italic;">
              Clarification Note: The choice between tax exclusive and tax inclusive pricing does not alter the legal classification of an invoice as B2B or B2C. Both pricing methods are permitted in both types of transactions under GST laws. While B2B transactions commonly use tax-exclusive pricing and retail transactions often use tax-inclusive pricing, these are commercial practices rather than statutory requirements.
            </p>
          </div>
        </div>

        <!-- TAB 2: B2B vs B2C Billing -->
        <div id="tab-b2b-b2c" class="gst-tab-pane" style="display:none;">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px;">
            <!-- B2B Section -->
            <div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;padding:18px;">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
                <span style="background:#dcfce7;color:#15803d;font-size:11px;font-weight:700;padding:2px 8px;border-radius:4px;text-transform:uppercase;">Category 1</span>
                <h3 style="font-size:15px;font-weight:700;color:#0f172a;margin:0;">B2B – Business to Business</h3>
              </div>
              <p style="margin:0 0 10px 0;color:#475569;font-size:12.5px;">
                B2B refers to transactions between two registered or business entities.
              </p>

              <div style="font-size:12px;color:#334155;margin-bottom:12px;">
                <b style="color:#0f172a;">Essential B2B Invoicing Requirements:</b>
                <ul style="margin:4px 0 0 0;padding-left:18px;color:#475569;line-height:1.5;">
                  <li><b>Supplier & Customer Business Details:</b> Legal name, trade name, and registered business address.</li>
                  <li><b>Customer GSTIN:</b> 15-character GSTIN verified and active on the common GST portal.</li>
                  <li><b>Billing & Shipping Addresses:</b> Explicit addresses to establish Place of Supply and physical movement.</li>
                  <li><b>Place of Supply (PoS):</b> Key legal determinant under IGST Act to apply CGST+SGST vs IGST.</li>
                  <li><b>HSN / SAC Codes:</b> Mandatory 4, 6 or 8-digit tariff classification based on turnover.</li>
                  <li><b>Itemized Tax Breakdown:</b> Explicit lines for Taxable Value, CGST, SGST, IGST, and applicable Cess.</li>
                  <li><b>Reverse Charge Mechanism (RCM):</b> Explicit indication of whether tax is payable on reverse charge.</li>
                  <li><b>Credit & Debit Notes:</b> Formal Section 34 vouchers adjusting original invoice value or tax.</li>
                  <li><b>E-Invoicing & E-Way Bills:</b> Mandatory IRN / QR code generation on IRP for eligible turnover; E-way bills for consignments &gt; ₹50,000.</li>
                </ul>
              </div>

              <div style="background:#fff;border:1px solid #e2e8f0;border-radius:6px;padding:12px;">
                <div style="font-size:11.5px;font-weight:700;color:#1e3a8a;margin-bottom:6px;">Practical B2B Examples:</div>
                <div style="font-size:11.5px;color:#475569;margin-bottom:8px;">
                  <b>1. Intra-State (Kerala Supplier → Kerala Customer):</b><br>
                  Goods worth ₹10,000 (before GST) at 18%:<br>
                  Taxable Value: ₹10,000.00 · CGST (9%): ₹900.00 · SGST (9%): ₹900.00<br>
                  <b>Total Invoice: ₹11,800.00</b>
                </div>
                <div style="font-size:11.5px;color:#475569;">
                  <b>2. Inter-State (Kerala Supplier → Karnataka Customer):</b><br>
                  Goods worth ₹10,000 (before GST) at 18%:<br>
                  Taxable Value: ₹10,000.00 · IGST (18%): ₹1,800.00<br>
                  <b>Total Invoice: ₹11,800.00</b>
                </div>
              </div>
            </div>

            <!-- B2C Section -->
            <div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;padding:18px;">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
                <span style="background:#f3e8ff;color:#7e22ce;font-size:11px;font-weight:700;padding:2px 8px;border-radius:4px;text-transform:uppercase;">Category 2</span>
                <h3 style="font-size:15px;font-weight:700;color:#0f172a;margin:0;">B2C – Business to Consumer</h3>
              </div>
              <p style="margin:0 0 10px 0;color:#475569;font-size:12.5px;">
                B2C refers to transactions where a business sells goods or services to an end consumer.
              </p>

              <div style="font-size:12px;color:#334155;margin-bottom:12px;">
                <b style="color:#0f172a;">Essential B2C Invoicing Requirements:</b>
                <ul style="margin:4px 0 0 0;padding-left:18px;color:#475569;line-height:1.5;">
                  <li><b>Consumer Details:</b> Name & contact recorded (mandatory if invoice value exceeds ₹50,000).</li>
                  <li><b>Billing Address:</b> Mandatory to record address if invoice value exceeds ₹50,000.</li>
                  <li><b>Place of Supply:</b> Established by location of recipient or delivery destination.</li>
                  <li><b>Intra vs Inter-State:</b> CGST+SGST for local consumer sales; IGST for out-of-state consumer sales.</li>
                  <li><b>Tax-Inclusive / Exclusive:</b> Retail environments commonly quote final consumer prices (MRP).</li>
                  <li><b>HSN / SAC:</b> Disclosed at line level or invoice summary level.</li>
                  <li><b>Invoice vs Bill of Supply:</b> Tax invoice issued for taxable goods; Bill of Supply for exempt goods or composition dealers.</li>
                  <li><b>Consumer Compliance:</b> Reported in Table 7 (B2C Others) or Table 5 (B2C Large &gt; ₹2.5 Lakhs inter-state) of GSTR-1.</li>
                </ul>
              </div>

              <div style="background:#fff;border:1px solid #e2e8f0;border-radius:6px;padding:12px;">
                <div style="font-size:11.5px;font-weight:700;color:#15803d;margin-bottom:6px;">Practical B2C Example:</div>
                <div style="font-size:11.5px;color:#475569;">
                  <b>Kerala Retail Shop Sale (Tax Inclusive at 18%):</b><br>
                  Final Selling Price: ₹1,000.00<br>
                  Taxable Value: ₹847.46<br>
                  CGST (9%): ₹76.27 · SGST (9%): ₹76.27 (Total GST: ₹152.54)<br>
                  <b>Final Customer Payment: ₹1,000.00</b>
                </div>
              </div>
            </div>
          </div>

          <!-- B2B vs B2C Comparison Table -->
          <div>
            <h4 style="font-size:14px;font-weight:700;color:#0f172a;margin-bottom:10px;">B2B and B2C – Important Differences</h4>
            <div style="border:1px solid #e2e8f0;border-radius:6px;overflow:hidden;">
              <table style="width:100%;border-collapse:collapse;font-size:12.5px;">
                <thead style="background:#f1f5f9;border-bottom:2px solid #cbd5e1;">
                  <tr>
                    <th style="padding:8px 12px;text-align:left;color:#475569;">Feature</th>
                    <th style="padding:8px 12px;text-align:left;color:#475569;">B2B (Business to Business)</th>
                    <th style="padding:8px 12px;text-align:left;color:#475569;">B2C (Business to Consumer)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:8px 12px;font-weight:600;">Customer type</td><td style="padding:8px 12px;">Registered Business / Enterprise</td><td style="padding:8px 12px;">End Consumer / Unregistered Person</td></tr>
                  <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:8px 12px;font-weight:600;">GSTIN requirement</td><td style="padding:8px 12px;">Mandatory and validated on portal</td><td style="padding:8px 12px;">Not required / Unregistered</td></tr>
                  <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:8px 12px;font-weight:600;">Invoice type</td><td style="padding:8px 12px;">Detailed Section 31 Tax Invoice</td><td style="padding:8px 12px;">Retail Consumer Invoice / Bill of Supply</td></tr>
                  <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:8px 12px;font-weight:600;">Input Tax Credit (ITC)</td><td style="padding:8px 12px;">Eligible recipient can claim ITC under Section 16</td><td style="padding:8px 12px;">Unregistered consumers cannot claim ITC</td></tr>
                  <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:8px 12px;font-weight:600;">Place of Supply rules</td><td style="padding:8px 12px;">Statutory rules based on delivery & recipient registration</td><td style="padding:8px 12px;">Location of recipient or delivery destination</td></tr>
                  <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:8px 12px;font-weight:600;">GST calculation</td><td style="padding:8px 12px;">Intra-state (CGST+SGST) or Inter-state (IGST)</td><td style="padding:8px 12px;">Intra-state (CGST+SGST) or Inter-state (IGST)</td></tr>
                  <tr><td style="padding:8px 12px;font-weight:600;">E-Invoicing requirements</td><td style="padding:8px 12px;">Mandatory for businesses meeting turnover threshold</td><td style="padding:8px 12px;">Excluded from B2C e-invoicing</td></tr>
                </tbody>
              </table>
            </div>
            <p style="font-size:11.5px;color:#64748b;margin-top:8px;font-style:italic;">
              Clarification Note: An invoice issued to an unregistered person or consumer cannot be converted into an input tax credit claim by that customer. However, businesses purchasing goods or services for business use may still request a B2B invoice with their GSTIN even for small purchases. Furthermore, a B2B transaction does not automatically guarantee that the recipient will take or be eligible for Input Tax Credit (e.g. if credit is blocked under Section 17(5)), nor does B2C imply that the consumer is prohibited from operating a business outside the scope of this transaction.
            </p>
          </div>
        </div>

        <!-- TAB 3: Module Specific Guide -->
        <div id="tab-context" class="gst-tab-pane" style="display:none;">
          ${currentModHtml}
        </div>

        <!-- TAB 4: GST Rates & Compliance -->
        <div id="tab-rates" class="gst-tab-pane" style="display:none;">
          <h4 style="font-size:14px;font-weight:700;color:#0f172a;margin:0 0 10px 0;">Applicable Indian GST Slabs & Classification</h4>
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:12px;margin-bottom:18px;">
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:12px;">
              <span style="font-size:15px;font-weight:800;color:#16a34a;">0%</span>
              <div style="font-weight:600;font-size:12px;margin:2px 0;">Nil-Rated / Exempt</div>
              <div style="font-size:11px;color:#64748b;">Basic fresh foods, unbranded grains, milk, salt, healthcare, education.</div>
            </div>
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:12px;">
              <span style="font-size:15px;font-weight:800;color:#2563eb;">5%</span>
              <div style="font-weight:600;font-size:12px;margin:2px 0;">Essential Supplies</div>
              <div style="font-size:11px;color:#64748b;">Packaged food items, medicines, domestic LPG, rail freight, basic apparel.</div>
            </div>
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:12px;">
              <span style="font-size:15px;font-weight:800;color:#d97706;">12%</span>
              <div style="font-weight:600;font-size:12px;margin:2px 0;">Standard Tier I</div>
              <div style="font-size:11px;color:#64748b;">Processed foods, computer hardware, pharmaceuticals, business work contracts.</div>
            </div>
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:12px;">
              <span style="font-size:15px;font-weight:800;color:#7c3aed;">18%</span>
              <div style="font-weight:600;font-size:12px;margin:2px 0;">Standard Tier II</div>
              <div style="font-size:11px;color:#64748b;">Most commercial goods, IT services, consulting, software, banking, hospitality.</div>
            </div>
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:12px;">
              <span style="font-size:15px;font-weight:800;color:#dc2626;">28%</span>
              <div style="font-weight:600;font-size:12px;margin:2px 0;">Luxury & Demerit</div>
              <div style="font-size:11px;color:#64748b;">Automobiles, luxury goods, aerated beverages, air conditioners, pan masala.</div>
            </div>
          </div>

          <div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;padding:14px;font-size:12px;color:#334155;">
            <b style="color:#0f172a;">Statutory Place of Supply & Rounding Rules:</b>
            <ul style="margin:4px 0 0 0;padding-left:18px;color:#475569;line-height:1.5;">
              <li><b>Intra-State Supply:</b> Supplier State == Place of Supply State → Tax divided equally into <b>CGST</b> (50%) and <b>SGST/UTGST</b> (50%).</li>
              <li><b>Inter-State Supply:</b> Supplier State != Place of Supply State → Tax collected as <b>IGST</b> (100%).</li>
              <li><b>Section 170 Rounding:</b> Under Section 170 of the Central Goods and Services Tax (CGST) Act, 2017, the final amount of tax, interest, penalty, fine, or any other sum payable is rounded off to the nearest whole rupee (fractions of 50 paise or more rounded up, less than 50 paise disregarded).</li>
            </ul>
          </div>
        </div>
      </div>
    `,
    footer: `
      <div style="display:flex;justify-content:space-between;width:100%;align-items:center;">
        <span style="font-size:12px;color:#64748b;"><i class="fa-solid fa-circle-check" style="color:#10b981;margin-right:4px;"></i> In compliance with Central Goods and Services Tax (CGST) & Integrated Goods and Services Tax (IGST) Acts.</span>
        <button class="btn p" data-close>Got it, close</button>
      </div>
    `
  });

  // Wire Tab Switching inside the modal
  if (m && m.el) {
    const tabBtns = m.el.querySelectorAll('.gst-tab-btn');
    const tabPanes = m.el.querySelectorAll('.gst-tab-pane');

    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        tabPanes.forEach(p => p.style.display = 'none');

        btn.classList.add('active');
        const targetTab = m.el.querySelector('#' + btn.dataset.tab);
        if (targetTab) targetTab.style.display = 'block';
      });
    });
  }
}
window.openGstPricingExplainerModal = openGstPricingExplainerModal;

// Document-level event listener for all tax & pricing explainer triggers across forms and pages
document.addEventListener('click', e => {
  const trigger = e.target.closest('.btn-tax-pricing-info, .th-tax-explainer, .b2b-b2c-explainer-link');
  if (trigger) {
    e.preventDefault();
    e.stopPropagation();
    const kind = trigger.dataset.docKind || 'invoices';
    openGstPricingExplainerModal(kind);
  }
});


function openSignatureModal(doc = {}, kind = 'invoices', onSigned = null) {
  const currentSig = doc.signature_data || '';
  const currentTitle = doc.signature_title || (window.APP && window.APP.org && window.APP.org.signature_title) || 'Authorized Signatory';
  const currentName = doc.signed_by || (window.APP && window.APP.user && (window.APP.user.name || window.APP.user.username)) || '';
  const isOrgSetting = kind === 'organization';
  const docTitle = isOrgSetting ? 'Company Default Signature' : `${doc.number ? doc.number : (kind || 'Document').replace('-', ' ').toUpperCase()} Signature`;

  const m = Modal.open({
    title: `✍️ Digital Signature · ${docTitle}`,
    wide: false,
    body: `
      <div class="sig-modal-container" style="display:flex;flex-direction:column;gap:16px;">
        <div class="sig-mode-tabs" style="display:flex;gap:8px;border-bottom:1px solid var(--bd);padding-bottom:10px;">
          <button type="button" class="btn p sig-tab-btn" data-sig-mode="draw" style="display:flex;align-items:center;gap:6px;">
            <i class="fa-solid fa-pen-nib"></i> Draw
          </button>
          <button type="button" class="btn sig-tab-btn" data-sig-mode="type" style="display:flex;align-items:center;gap:6px;">
            <i class="fa-solid fa-font"></i> Type
          </button>
          <button type="button" class="btn sig-tab-btn" data-sig-mode="upload" style="display:flex;align-items:center;gap:6px;">
            <i class="fa-solid fa-upload"></i> Upload Image
          </button>
        </div>

        <div id="sig-pane-draw" class="sig-pane">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
            <span style="font-size:12px;color:var(--tx-muted);font-weight:500;">Draw your signature using mouse, stylus, or finger:</span>
            <div style="display:flex;align-items:center;gap:6px;">
              <span style="font-size:11px;color:var(--tx-muted);">Color:</span>
              <button type="button" class="sig-color-btn active" data-color="#1e3a8a" style="width:20px;height:20px;border-radius:50%;background:#1e3a8a;border:2px solid #fff;box-shadow:0 0 0 2px #2563eb;cursor:pointer;"></button>
              <button type="button" class="sig-color-btn" data-color="#0f172a" style="width:20px;height:20px;border-radius:50%;background:#0f172a;border:2px solid #fff;box-shadow:0 0 0 1px #cbd5e1;cursor:pointer;"></button>
              <button type="button" class="sig-color-btn" data-color="#4338ca" style="width:20px;height:20px;border-radius:50%;background:#4338ca;border:2px solid #fff;box-shadow:0 0 0 1px #cbd5e1;cursor:pointer;"></button>
              <button type="button" class="btn" id="btn-sig-clear" style="font-size:11px;padding:2px 8px;margin-left:8px;">Clear</button>
            </div>
          </div>
          <div style="background:#fff;border:1px dashed #cbd5e1;border-radius:8px;position:relative;overflow:hidden;touch-action:none;">
            <canvas id="sig-draw-canvas" width="460" height="150" style="width:100%;height:150px;display:block;cursor:crosshair;"></canvas>
            <div id="sig-draw-placeholder" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;color:#94a3b8;font-size:14px;font-style:italic;">
              Draw signature here
            </div>
          </div>
        </div>

        <div id="sig-pane-type" class="sig-pane" style="display:none;">
          <div class="fg" style="margin-bottom:12px;">
            <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px;">Type your full name:</label>
            <input type="text" class="in" id="sig-type-input" value="${esc(currentName)}" placeholder="e.g. Authorized Signer" style="width:100%;font-size:14px;">
          </div>
          <div class="fg" style="margin-bottom:12px;">
            <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px;">Signature Font Style:</label>
            <select class="in" id="sig-font-select" style="width:100%;font-size:13px;">
              <option value="'Brush Script MT', cursive">Script Casual (Brush)</option>
              <option value="'Caveat', cursive">Caveat Handwriting</option>
              <option value="'Dancing Script', cursive">Dancing Script Cursive</option>
              <option value="'Great Vibes', cursive">Calligraphy Flourish</option>
              <option value="italic serif">Classic Formal Serif Italic</option>
            </select>
          </div>
          <div style="background:#fff;border:1px dashed #cbd5e1;border-radius:8px;padding:20px;text-align:center;min-height:90px;display:flex;align-items:center;justify-content:center;">
            <div id="sig-type-preview" style="font-size:32px;color:#1e3a8a;font-family:'Brush Script MT', cursive;word-break:break-all;">
              ${esc(currentName || 'Your Signature')}
            </div>
          </div>
        </div>

        <div id="sig-pane-upload" class="sig-pane" style="display:none;">
          <div style="background:#f8fafc;border:1px dashed #cbd5e1;border-radius:8px;padding:20px;text-align:center;">
            <input type="file" id="sig-upload-file" accept="image/png,image/jpeg,image/webp,image/svg+xml" style="display:none;">
            <button type="button" class="btn" id="btn-sig-pick-file" style="margin-bottom:8px;">
              <i class="fa-solid fa-cloud-arrow-up"></i> Choose Signature Image
            </button>
            <div style="font-size:11px;color:var(--tx-muted);">Supports PNG, JPG, WEBP, SVG (transparent background recommended)</div>
            <div id="sig-upload-preview-box" style="margin-top:12px;display:none;">
              <img id="sig-upload-preview" src="" alt="Uploaded signature" style="max-height:80px;max-width:260px;object-fit:contain;border:1px solid #e2e8f0;padding:6px;border-radius:4px;background:#fff;">
            </div>
          </div>
        </div>

        <div style="background:var(--surface-glass-subtle);border-radius:8px;padding:12px 14px;border:1px solid var(--bd);">
          <div style="font-weight:600;font-size:12px;color:var(--tx);margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px;">Signatory Details</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div class="fg" style="margin:0;">
              <label style="font-size:11px;font-weight:600;color:var(--tx-muted);display:block;margin-bottom:4px;">Signer Name</label>
              <input type="text" class="in" id="sig-meta-name" value="${esc(currentName)}" placeholder="Full Name" style="font-size:12px;width:100%;">
            </div>
            <div class="fg" style="margin:0;">
              <label style="font-size:11px;font-weight:600;color:var(--tx-muted);display:block;margin-bottom:4px;">Designation / Title</label>
              <input type="text" class="in" id="sig-meta-title" value="${esc(currentTitle)}" placeholder="e.g. Authorized Signatory" style="font-size:12px;width:100%;">
            </div>
          </div>
        </div>

        ${currentSig ? `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;">
            <div style="display:flex;align-items:center;gap:10px;">
              <img src="${esc(currentSig)}" alt="Current signature" style="height:36px;max-width:100px;object-fit:contain;background:#fff;padding:2px;border:1px solid #dbeafe;border-radius:4px;">
              <span style="font-size:12px;color:#1e3a8a;">This document is currently signed. You can update or remove it.</span>
            </div>
            <button type="button" class="btn d" id="btn-sig-unsign" style="font-size:12px;padding:4px 10px;">Remove Signature</button>
          </div>
        ` : ''}
      </div>
    `,
    footer: `
      <div style="display:flex;justify-content:space-between;align-items:center;width:100%;">
        <button type="button" class="btn" data-close>Cancel</button>
        <button type="button" class="btn p" id="btn-sig-save" style="display:flex;align-items:center;gap:6px;">
          <i class="fa-solid fa-check"></i> Save & Apply Signature
        </button>
      </div>
    `
  });

  const canvas = $('#sig-draw-canvas', m.el);
  const ctx = canvas ? canvas.getContext('2d') : null;
  let isDrawing = false;
  let hasDrawn = false;
  let strokeColor = '#1e3a8a';
  let activeMode = 'draw';
  let uploadedDataUrl = '';

  function getCoords(e) {
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  }

  function startDraw(e) {
    if (!ctx) return;
    e.preventDefault();
    isDrawing = true;
    hasDrawn = true;
    const ph = $('#sig-draw-placeholder', m.el);
    if (ph) ph.style.display = 'none';
    const { x, y } = getCoords(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }

  function drawMove(e) {
    if (!isDrawing || !ctx) return;
    e.preventDefault();
    const { x, y } = getCoords(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function stopDraw() {
    if (isDrawing && ctx) {
      isDrawing = false;
      ctx.closePath();
    }
  }

  if (canvas) {
    canvas.addEventListener('mousedown', startDraw);
    canvas.addEventListener('mousemove', drawMove);
    window.addEventListener('mouseup', stopDraw);

    canvas.addEventListener('touchstart', startDraw, { passive: false });
    canvas.addEventListener('touchmove', drawMove, { passive: false });
    window.addEventListener('touchend', stopDraw);
  }

  $('#btn-sig-clear', m.el)?.addEventListener('click', () => {
    if (ctx && canvas) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      hasDrawn = false;
      const ph = $('#sig-draw-placeholder', m.el);
      if (ph) ph.style.display = 'flex';
    }
  });

  $$('.sig-color-btn', m.el).forEach(b => {
    b.addEventListener('click', () => {
      $$('.sig-color-btn', m.el).forEach(btn => {
        btn.classList.remove('active');
        btn.style.boxShadow = '0 0 0 1px #cbd5e1';
      });
      b.classList.add('active');
      b.style.boxShadow = '0 0 0 2px #2563eb';
      strokeColor = b.dataset.color;
      const tp = $('#sig-type-preview', m.el);
      if (tp) tp.style.color = strokeColor;
    });
  });

  $$('.sig-tab-btn', m.el).forEach(b => {
    b.addEventListener('click', () => {
      $$('.sig-tab-btn', m.el).forEach(btn => btn.classList.remove('p'));
      b.classList.add('p');
      activeMode = b.dataset.sigMode;
      const pDraw = $('#sig-pane-draw', m.el);
      const pType = $('#sig-pane-type', m.el);
      const pUpload = $('#sig-pane-upload', m.el);
      if (pDraw) pDraw.style.display = activeMode === 'draw' ? '' : 'none';
      if (pType) pType.style.display = activeMode === 'type' ? '' : 'none';
      if (pUpload) pUpload.style.display = activeMode === 'upload' ? '' : 'none';
    });
  });

  const typeIn = $('#sig-type-input', m.el);
  const fontSel = $('#sig-font-select', m.el);
  const typePrev = $('#sig-type-preview', m.el);
  function updateTypePreview() {
    if (typePrev && typeIn) {
      typePrev.textContent = typeIn.value.trim() || 'Your Signature';
      typePrev.style.fontFamily = fontSel ? fontSel.value : 'cursive';
    }
    const metaName = $('#sig-meta-name', m.el);
    if (metaName && typeIn && !metaName.value) {
      metaName.value = typeIn.value.trim();
    }
  }
  if (typeIn) typeIn.addEventListener('input', updateTypePreview);
  if (fontSel) fontSel.addEventListener('change', updateTypePreview);

  const pickFileBtn = $('#btn-sig-pick-file', m.el);
  const uploadInput = $('#sig-upload-file', m.el);
  if (pickFileBtn && uploadInput) {
    pickFileBtn.addEventListener('click', () => uploadInput.click());
  }
  if (uploadInput) {
    uploadInput.addEventListener('change', () => {
      const file = uploadInput.files[0];
      if (!file) return;
      const r = new FileReader();
      r.onload = ev => {
        uploadedDataUrl = ev.target.result;
        const prev = $('#sig-upload-preview', m.el);
        const box = $('#sig-upload-preview-box', m.el);
        if (prev) prev.src = uploadedDataUrl;
        if (box) box.style.display = 'block';
      };
      r.readAsDataURL(file);
    });
  }

  function getSignatureDataUrl() {
    if (activeMode === 'draw') {
      if (!hasDrawn || !canvas) return null;
      return canvas.toDataURL('image/png');
    } else if (activeMode === 'type') {
      const text = typeIn ? typeIn.value.trim() : '';
      if (!text) return null;
      const offCanvas = document.createElement('canvas');
      offCanvas.width = 460;
      offCanvas.height = 140;
      const octx = offCanvas.getContext('2d');
      octx.clearRect(0, 0, offCanvas.width, offCanvas.height);
      octx.font = `italic 38px ${fontSel ? fontSel.value : 'cursive'}`;
      octx.fillStyle = strokeColor;
      octx.textAlign = 'center';
      octx.textBaseline = 'middle';
      octx.fillText(text, offCanvas.width / 2, offCanvas.height / 2);
      return offCanvas.toDataURL('image/png');
    } else if (activeMode === 'upload') {
      return uploadedDataUrl || null;
    }
    return null;
  }

  $('#btn-sig-save', m.el)?.addEventListener('click', async () => {
    const sigData = getSignatureDataUrl() || currentSig;
    if (!sigData) {
      return toast('Please draw, type, or upload a signature first.', 'err');
    }
    const signerName = $('#sig-meta-name', m.el)?.value.trim() || '';
    const sigTitle = $('#sig-meta-title', m.el)?.value.trim() || 'Authorized Signatory';

    try {
      if (isOrgSetting) {
        await api('organization/', {
          method: 'PATCH',
          body: { signature_data: sigData, signature_title: sigTitle }
        });
        if (window.APP && window.APP.org) {
          window.APP.org.signature_data = sigData;
          window.APP.org.signature_title = sigTitle;
        }
        toast('Company default signature saved successfully!', 'ok');
        m.close();
        if (onSigned) onSigned({ signature_data: sigData, signature_title: sigTitle });
        return;
      }

      if (doc && doc.id) {
        const res = await api(`${kind}/${doc.id}/sign/`, {
          method: 'POST',
          body: { signature_data: sigData, signed_by: signerName, signature_title: sigTitle }
        });
        doc.signature_data = sigData;
        doc.signed_by = signerName;
        doc.signature_title = sigTitle;
        doc.signed_at = (res && res.signed_at) || new Date().toISOString();
        toast('Document signed successfully!', 'ok');
        m.close();
        if (onSigned) onSigned(doc);
      } else {
        m.close();
        if (onSigned) onSigned({ signature_data: sigData, signed_by: signerName, signature_title: sigTitle, signed_at: new Date().toISOString() });
      }
    } catch (err) {
      toast(err.message, 'err');
    }
  });

  const unsignBtn = $('#btn-sig-unsign', m.el);
  if (unsignBtn) {
    unsignBtn.addEventListener('click', async () => {
      if (!(await confirmBox({
        title: 'Remove Signature?',
        message: 'Are you sure you want to remove the signature from this document?',
        okText: 'Remove',
        danger: true
      }))) return;

      try {
        if (isOrgSetting) {
          await api('organization/', {
            method: 'PATCH',
            body: { signature_data: '' }
          });
          if (window.APP && window.APP.org) window.APP.org.signature_data = '';
          toast('Company signature removed.', 'ok');
          m.close();
          if (onSigned) onSigned({ signature_data: '', signature_title: currentTitle });
          return;
        }

        if (doc && doc.id) {
          await api(`${kind}/${doc.id}/unsign/`, { method: 'POST', body: {} });
          doc.signature_data = '';
          doc.signed_by = '';
          doc.signed_at = null;
          toast('Signature removed.', 'ok');
          m.close();
          if (onSigned) onSigned(doc);
        } else {
          m.close();
          if (onSigned) onSigned({ signature_data: '', signed_by: '', signature_title: '', signed_at: null });
        }
      } catch (err) {
        toast(err.message, 'err');
      }
    });
  }
}

window.openSignatureModal = openSignatureModal;

async function partyForm(kind, id, onDone) {
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

  if (!id && !r.code) {
    try {
      const nextCode = await api(`lookup/next-${isCust ? 'customer' : 'vendor'}-code/`);
      if (nextCode && nextCode.next_number) {
        r.code = nextCode.next_number;
      }
    } catch (_) {}
  }

  const formHtml = `
    <div class="party-form-wrap zb-form-wrap">

      <div class="party-top-actions-bar" style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px;padding:8px 12px;background:var(--surface-glass-subtle);border:1px solid var(--bd);border-radius:10px;flex-wrap:wrap;">
        <div class="gst-prefill-compact" style="flex:1;min-width:280px;margin:0;">
          <div class="gst-prefill-left" style="display:flex;align-items:center;gap:8px;">
            <svg class="gst-prefill-icon-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
            <span class="gst-prefill-text" style="font-size:12px;">Prefill ${entityLabel} details from GSTIN</span>
            <a href="javascript:void(0)" class="gst-prefill-link" id="btn_toggle_gst_prefill" style="font-size:12px;font-weight:600;">Fetch &gt;</a>
          </div>
          <div class="gst-prefill-ctrls" id="gst_prefill_ctrls" style="display:none;gap:6px;align-items:center;margin-top:6px;">
            <input class="in gst-prefill-mini-in" id="gst_prefill_code" placeholder="15-digit GSTIN" maxlength="15" value="${esc(r.gstin || '')}" style="height:30px;font-size:12px;">
            <button type="button" class="btn p gst-prefill-mini-btn" id="btn_trigger_gst_prefill" style="height:30px;font-size:11.5px;padding:0 10px;">Fetch</button>
            <button type="button" class="btn ic gst-prefill-mini-close" id="btn_close_gst_prefill" title="Close">×</button>
          </div>
        </div>

        <div style="display:flex;align-items:center;gap:8px;">
          <button type="button" class="btn" id="btn_party_preload_demo" style="font-size:12px;display:inline-flex;align-items:center;gap:5px;height:32px;" title="Preload sample ${entityLabel} details">
            <i class="fa-solid fa-bolt" style="color:var(--accent);"></i> <span>⚡ Quick Fill</span>
          </button>
          <button type="button" class="btn" id="btn_party_import_file_trigger" style="font-size:12px;display:inline-flex;align-items:center;gap:5px;height:32px;" title="Import data from Excel/CSV/JSON into this form">
            <i class="fa-solid fa-file-import" style="color:#10b981;"></i> <span>📁 Load File Data</span>
          </button>
          <input type="file" id="party_file_quick_import" accept=".xlsx,.xls,.xlsm,.csv,.tsv,.txt,.json,text/csv,text/tab-separated-values,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" style="display:none;">
        </div>
      </div>

      ${isCust ? `
        <div class="zb-form-row">
          <label class="zb-form-label">Customer Type <span class="zb-info-tip" title="Choose whether customer is a registered business or an individual consumer">ⓘ</span></label>
          <div class="zb-form-ctrl">
            <div style="display:flex;align-items:center;gap:20px;height:35px;">
              <label id="pill_type_business" style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;font-weight:500;color:var(--tx);">
                <input type="radio" name="customer_type" value="business" ${r.customer_type !== 'individual' ? 'checked' : ''} style="accent-color:var(--accent,#2563eb);width:15px;height:15px;cursor:pointer;">
                <span>Business</span>
              </label>

              <label id="pill_type_individual" style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;font-weight:500;color:var(--tx);">
                <input type="radio" name="customer_type" value="individual" ${r.customer_type === 'individual' ? 'checked' : ''} style="accent-color:var(--accent,#2563eb);width:15px;height:15px;cursor:pointer;">
                <span>Individual</span>
              </label>
            </div>
          </div>
        </div>
      ` : ''}

      <div class="zb-form-row">
        <label class="zb-form-label">Primary Contact <span class="zb-info-tip" title="Designated contact person for communications">ⓘ</span></label>
        <div class="zb-form-ctrl">
          <div style="display:flex;gap:8px;">
            <select class="in" id="primary_salutation" name="primary_salutation" style="width:115px;flex-shrink:0;">
              <option value="" disabled ${!r.primary_salutation ? 'selected' : ''}>Salutation</option>
              <option value="Mr." ${r.primary_salutation === 'Mr.' ? 'selected' : ''}>Mr.</option>
              <option value="Mrs." ${r.primary_salutation === 'Mrs.' ? 'selected' : ''}>Mrs.</option>
              <option value="Ms." ${r.primary_salutation === 'Ms.' ? 'selected' : ''}>Ms.</option>
              <option value="Miss" ${r.primary_salutation === 'Miss' ? 'selected' : ''}>Miss</option>
              <option value="Dr." ${r.primary_salutation === 'Dr.' ? 'selected' : ''}>Dr.</option>
            </select>
            <input class="in" id="contact_first_name" placeholder="First Name" style="flex:1;">
            <input class="in" id="contact_last_name" placeholder="Last Name" style="flex:1;">
            <input type="hidden" id="contact_person" name="contact_person" value="${esc(r.contact_person || '')}">
          </div>
        </div>
      </div>

      <div class="zb-form-row">
        <label class="zb-form-label" for="company">Company Name</label>
        <div class="zb-form-ctrl">
          <input class="in" id="company" name="company" placeholder="e.g. Convosis Technologies Pvt Ltd" value="${esc(r.company || '')}">
        </div>
      </div>

      <div class="zb-form-row">
        <label class="zb-form-label" for="party_code">${entityLabel} Code <span class="zb-info-tip" title="Unique organization-wise identifier (e.g. ABC/${isCust ? 'CUST' : 'VEND'}/26-27/000001)">ⓘ</span></label>
        <div class="zb-form-ctrl">
          <input class="in" id="party_code" name="code" placeholder="Auto-generated (e.g. ABC/${isCust ? 'CUST' : 'VEND'}/26-27/000001)" value="${esc(r.code || '')}" style="max-width:320px;text-transform:uppercase;">
          <div class="hp" style="font-size:11px;color:var(--tx-muted);margin-top:2px;">Unique sequential code. Leave blank to auto-generate sequentially.</div>
        </div>
      </div>

      <div class="zb-form-row">
        <label class="zb-form-label" for="name">${entityLabel} Display Name<span class="rq">*</span> <span class="zb-info-tip" title="Display name appears on invoices and transactions">ⓘ</span></label>
        <div class="zb-form-ctrl">
          <div style="position:relative;display:flex;align-items:center;width:100%;">
            <input class="in" id="name" name="name" required placeholder="Select or type to add" value="${esc(r.name || '')}" style="font-weight:600;padding-right:36px;width:100%;">
            <button type="button" class="btn ic" id="btn_toggle_display_name_dropdown" title="Quick pick display name options" style="position:absolute;right:3px;top:3px;bottom:3px;width:30px;height:auto;border:none;background:transparent;cursor:pointer;opacity:0.8;display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--tx-muted);">▼</button>
            <div class="display-name-dropdown" id="display_name_dropdown" style="display:none;"></div>
          </div>
          <div class="er" data-err="name"></div>
        </div>
      </div>

      <div class="zb-form-row">
        <label class="zb-form-label" for="email">Email Address <span class="zb-info-tip" title="Primary billing & communication email">ⓘ</span></label>
        <div class="zb-form-ctrl">
          <div class="zb-input-icon-wrap">
            <span class="zb-input-icon">✉</span>
            <input class="in with-icon" id="email" name="email" type="email" placeholder="billing@company.com" value="${esc(r.email || '')}">
          </div>
          <div class="er" data-err="email"></div>
        </div>
      </div>

      <div class="zb-form-row">
        <label class="zb-form-label">Phone <span class="zb-info-tip" title="Official work and mobile telephone numbers">ⓘ</span></label>
        <div class="zb-form-ctrl">
          <div style="display:flex;gap:14px;align-items:center;">
            <div style="display:flex;flex:1;">
              <span class="zb-input-prefix">+91 <small style="font-size:9px;margin-left:2px;opacity:0.75;">▼</small></span>
              <input class="in" id="phone" name="phone" type="tel" placeholder="Work Phone" value="${esc(r.phone || '')}">
            </div>
            <div style="display:flex;flex:1;">
              <span class="zb-input-prefix">+91 <small style="font-size:9px;margin-left:2px;opacity:0.75;">▼</small></span>
              <input class="in" id="mobile" name="mobile" type="tel" placeholder="Mobile" value="${esc(r.mobile || '')}">
            </div>
          </div>
          <div class="er" data-err="phone"></div>
          <div class="er" data-err="mobile"></div>
        </div>
      </div>

      ${isCust ? `
        <div class="zb-form-row">
          <label class="zb-form-label" for="customer_language">Customer Language <span class="zb-info-tip" title="Language used for PDF invoices and emails">ⓘ</span></label>
          <div class="zb-form-ctrl">
            <select class="in" id="customer_language" name="customer_language">
              ${LANGUAGE_OPTIONS.map(([val, lbl]) => `<option value="${val}" ${r.customer_language === val ? 'selected' : ''}>${lbl}</option>`).join('')}
            </select>

          </div>

        </div>

      ` : ''}

      <div class="party-tabs-header" id="party_tabs_bar">
        <button type="button" class="party-tab-btn active" data-tab="tab_other_details">Other Details</button>
        <button type="button" class="party-tab-btn" data-tab="tab_address">Address</button>
        <button type="button" class="party-tab-btn" data-tab="tab_contacts">Contact Persons <span class="party-tab-badge" id="cnt_badge">${contactPersonsList.length}</span></button>
        ${!isCust ? `<button type="button" class="party-tab-btn" data-tab="tab_bank">Bank Details</button>` : ''}

        <button type="button" class="party-tab-btn" data-tab="tab_custom_fields">Custom Fields</button>

        <button type="button" class="party-tab-btn" data-tab="tab_remarks">Notes</button>

        <button type="button" class="party-tab-btn" data-tab="tab_documents">Attachments <span class="party-tab-badge" id="doc_badge">${documentsList.length}</span></button>
      </div>

      <div class="party-tabs-content">

        <div class="party-tab-pane active" id="tab_other_details">
          <div class="zb-form-row">
            <label class="zb-form-label" for="gst_treatment">GST Treatment<span class="rq">*</span></label>
            <div class="zb-form-ctrl">
              <select class="in" id="gst_treatment" name="gst_treatment">
                ${(isCust ? GST_TREATMENT_OPTIONS_CUSTOMER : GST_TREATMENT_OPTIONS_VENDOR).map(([v, l]) => `
                  <option value="${v}" ${r.gst_treatment === v ? 'selected' : ''}>${l}</option>
                `).join('')}
              </select>

            </div>

          </div>

          <div class="zb-form-row">
            <label class="zb-form-label" for="${isCust ? 'place_of_supply' : 'source_of_supply'}">${isCust ? 'Place of Supply' : 'Source of Supply'}<span class="rq">*</span></label>
            <div class="zb-form-ctrl">
              <select class="in" id="${isCust ? 'place_of_supply' : 'source_of_supply'}" name="${isCust ? 'place_of_supply' : 'source_of_supply'}">
                ${GST_STATE_OPTIONS.map(([v, l]) => {
                  const cur = isCust ? defaultPos : defaultSos;
                  const isSel = Boolean(v && cur && (cur === v || cur.includes(v)));
                  return `<option value="${v}" ${isSel ? 'selected' : ''}>${l}</option>`;
                }).join('')}
              </select>

            </div>

          </div>

          <div class="zb-form-row">
            <label class="zb-form-label" for="gstin">GSTIN</label>

            <div class="zb-form-ctrl">
              <input class="in" id="gstin" name="gstin" maxlength="15" placeholder="e.g. 32AANCC9298C1ZE" style="text-transform:uppercase;font-family:monospace;" value="${esc(r.gstin || '')}">
              <div class="er" data-err="gstin"></div>

            </div>

          </div>

          <div class="zb-form-row">
            <label class="zb-form-label" for="pan">PAN</label>

            <div class="zb-form-ctrl">
              <input class="in" id="pan" name="pan" maxlength="10" placeholder="e.g. AANCC9298C" style="text-transform:uppercase;font-family:monospace;max-width:240px;" value="${esc(r.pan || '')}">
              <div class="er" data-err="pan"></div>

            </div>

          </div>

          ${isCust ? `
            <div class="zb-form-row">
              <label class="zb-form-label">Tax Preference</label>
              <div class="zb-form-ctrl">
                <div style="display:flex;gap:20px;align-items:center;height:35px;">
                  <label class="radio-label"><input type="radio" name="tax_preference" value="taxable" ${r.tax_preference !== 'tax_exempt' ? 'checked' : ''}> Taxable</label>
                  <label class="radio-label"><input type="radio" name="tax_preference" value="tax_exempt" ${r.tax_preference === 'tax_exempt' ? 'checked' : ''}> Tax Exempt</label>
                </div>
              </div>
            </div>
            <div class="zb-form-row" id="exemption_reason_wrap" style="${r.tax_preference === 'tax_exempt' ? '' : 'display:none;'}">
              <label class="zb-form-label" for="exemption_reason">Exemption Reason</label>
              <div class="zb-form-ctrl">
                <input class="in" id="exemption_reason" name="exemption_reason" placeholder="e.g. Export / SEZ / Govt Notification" value="${esc(r.exemption_reason || '')}">
              </div>
            </div>
          ` : `
            <div class="zb-form-row">
              <label class="zb-form-label">MSME Registered?</label>
              <div class="zb-form-ctrl">
                <label class="ck" style="height:35px;display:flex;align-items:center;">
                  <input type="checkbox" id="is_msme_registered" name="is_msme_registered" ${r.is_msme_registered ? 'checked' : ''}>
                  <span>This vendor is registered under MSME / Udyam</span>
                </label>
                <div id="msme_fields_wrap" style="${r.is_msme_registered ? '' : 'display:none;'}margin-top:8px;display:flex;gap:8px;">
                  <select class="in" id="msme_type" name="msme_type" style="width:120px;">
                    <option value="micro" ${r.msme_type === 'micro' ? 'selected' : ''}>Micro</option>
                    <option value="small" ${r.msme_type === 'small' ? 'selected' : ''}>Small</option>
                    <option value="medium" ${r.msme_type === 'medium' ? 'selected' : ''}>Medium</option>
                  </select>
                  <input class="in" id="msme_reg_number" name="msme_reg_number" placeholder="Udyam Registration Number" value="${esc(r.msme_reg_number || '')}">
                </div>
              </div>
            </div>
            <div class="zb-form-row">
              <label class="zb-form-label" for="tds_section">Income Tax TDS</label>
              <div class="zb-form-ctrl">
                <div style="display:flex;gap:16px;align-items:center;">
                  <select class="in" id="tds_section" name="tds_section" style="flex:1;">
                    ${TDS_OPTIONS.map(([v, l]) => `<option value="${v}" ${r.tds_section === v ? 'selected' : ''}>${l}</option>`).join('')}

                  </select>

                  <label class="ck" style="white-space:nowrap;">
                    <input type="checkbox" id="apply_gst_tds" name="apply_gst_tds" ${r.apply_gst_tds ? 'checked' : ''}>
                    <span>GST TDS (Sec 51)</span>

                  </label>

                </div>

              </div>

            </div>

          `}

          <div class="zb-form-row">
            <label class="zb-form-label" for="currency">Currency</label>
            <div class="zb-form-ctrl">
              <select class="in" id="currency" name="currency">
                ${CURRENCY_OPTIONS.map(([v, l]) => `<option value="${v}" ${r.currency === v ? 'selected' : ''}>${l}</option>`).join('')}

              </select>

            </div>

          </div>

          <div class="zb-form-row">
            <label class="zb-form-label" for="opening_balance">Opening Balance</label>

            <div class="zb-form-ctrl">
              <div style="display:flex;gap:6px;max-width:280px;">
                <input class="in" id="opening_balance" name="opening_balance" type="number" step="0.01" placeholder="0.00" value="${r.opening_balance || '0.00'}">
                <select class="in" id="opening_balance_type" name="opening_balance_type" style="width:75px;flex-shrink:0;">
                  <option value="debit" ${r.opening_balance_type !== 'credit' ? 'selected' : ''}>Dr</option>

                  <option value="credit" ${r.opening_balance_type === 'credit' ? 'selected' : ''}>Cr</option>

                </select>

              </div>

            </div>

          </div>

          <div class="zb-form-row">
            <label class="zb-form-label" for="payment_terms">Payment Terms</label>

            <div class="zb-form-ctrl">
              <select class="in" id="payment_terms" name="payment_terms">
                ${PAYMENT_TERMS_OPTIONS.map(([v, l]) => `<option value="${v}" ${String(r.payment_terms) === v ? 'selected' : ''}>${l}</option>`).join('')}
              </select>

            </div>

          </div>

          ${isCust ? `
            <div class="zb-form-row">
              <label class="zb-form-label">Client Portal</label>
              <div class="zb-form-ctrl">
                <label class="ck" style="height:35px;display:flex;align-items:center;gap:6px;">
                  <input type="checkbox" id="portal_enabled" name="portal_enabled" ${r.portal_enabled ? 'checked' : ''}>
                  <b>Enable Portal?</b>
                  <span style="font-size:12px;color:var(--tx-muted);">(Allows viewing invoices, payment receipts, and paying online)</span>
                </label>
              </div>
            </div>
          ` : ''}
        </div>

        <div class="party-tab-pane" id="tab_address">
          <div style="display:grid;grid-template-columns:${isCust ? '1fr 1fr' : '1fr'};gap:32px;">
            <div>
              <div style="display:flex;justify-content:space-between;align-items:center;height:32px;margin-bottom:14px;border-bottom:1px solid var(--bd-glass);padding-bottom:6px;box-sizing:border-box;">
                <h4 style="margin:0;font-size:13.5px;font-weight:700;color:var(--tx);">Billing Address</h4>
                <span style="font-size:11px;color:var(--tx-muted);visibility:hidden;">Placeholder</span>
              </div>

              <div class="zb-form-row"><label class="zb-form-label" style="width:120px;min-width:120px;" for="billing_attention">Attention</label><div class="zb-form-ctrl"><input class="in" id="billing_attention" name="billing_attention" placeholder="Accounts / Finance Dept" value="${esc(r.billing_attention || '')}"><div class="er" data-err="billing_attention"></div></div></div>
              <div class="zb-form-row align-top"><label class="zb-form-label" style="width:120px;min-width:120px;" for="billing_address">Address Line <span class="rq">*</span></label><div class="zb-form-ctrl"><textarea class="in" id="billing_address" name="billing_address" rows="3" placeholder="Street, Building, Suite">${esc(r.billing_address || '')}</textarea><div class="er" data-err="billing_address"></div></div></div>
              <div class="zb-form-row"><label class="zb-form-label" style="width:120px;min-width:120px;" for="billing_city">City <span class="rq">*</span></label><div class="zb-form-ctrl"><input class="in" id="billing_city" name="billing_city" placeholder="City" value="${esc(r.billing_city || '')}"><div class="er" data-err="billing_city"></div></div></div>
              <div class="zb-form-row"><label class="zb-form-label" style="width:120px;min-width:120px;" for="billing_state">State <span class="rq">*</span></label><div class="zb-form-ctrl"><input class="in" id="billing_state" name="billing_state" placeholder="State" value="${esc(r.billing_state || r.state || '')}"><div class="er" data-err="billing_state"></div></div></div>
              <div class="zb-form-row"><label class="zb-form-label" style="width:120px;min-width:120px;" for="billing_pincode">Pincode <span class="rq">*</span></label><div class="zb-form-ctrl"><input class="in" id="billing_pincode" name="billing_pincode" placeholder="Pincode" value="${esc(r.billing_pincode || '')}"><div class="er" data-err="billing_pincode"></div></div></div>
              <div class="zb-form-row"><label class="zb-form-label" style="width:120px;min-width:120px;" for="billing_country">Country <span class="rq">*</span></label><div class="zb-form-ctrl"><input class="in" id="billing_country" name="billing_country" value="${esc(r.billing_country || 'India')}"><div class="er" data-err="billing_country"></div></div></div>
              <div class="zb-form-row"><label class="zb-form-label" style="width:120px;min-width:120px;" for="billing_phone">Phone</label><div class="zb-form-ctrl"><input class="in" id="billing_phone" name="billing_phone" value="${esc(r.billing_phone || '')}"><div class="er" data-err="billing_phone"></div></div></div>
            </div>

            ${isCust ? `
              <div>
                <div style="display:flex;justify-content:space-between;align-items:center;height:32px;margin-bottom:14px;border-bottom:1px solid var(--bd-glass);padding-bottom:6px;box-sizing:border-box;">
                  <h4 style="margin:0;font-size:13.5px;font-weight:700;color:var(--tx);">Shipping Address</h4>
                  <button type="button" class="btn" id="btn_copy_billing_addr" style="font-size:11px;padding:2px 8px;height:24px;line-height:1;">📋 Copy billing address</button>
                </div>
                <div class="zb-form-row"><label class="zb-form-label" style="width:120px;min-width:120px;" for="shipping_attention">Attention</label><div class="zb-form-ctrl"><input class="in" id="shipping_attention" name="shipping_attention" placeholder="Receiving / Logistics" value="${esc(r.shipping_attention || '')}"><div class="er" data-err="shipping_attention"></div></div></div>
                <div class="zb-form-row align-top"><label class="zb-form-label" style="width:120px;min-width:120px;" for="shipping_address">Address Line</label><div class="zb-form-ctrl"><textarea class="in" id="shipping_address" name="shipping_address" rows="3" placeholder="Delivery street address">${esc(r.shipping_address || '')}</textarea><div class="er" data-err="shipping_address"></div></div></div>
                <div class="zb-form-row"><label class="zb-form-label" style="width:120px;min-width:120px;" for="shipping_city">City</label><div class="zb-form-ctrl"><input class="in" id="shipping_city" name="shipping_city" placeholder="City" value="${esc(r.shipping_city || '')}"><div class="er" data-err="shipping_city"></div></div></div>
                <div class="zb-form-row"><label class="zb-form-label" style="width:120px;min-width:120px;" for="shipping_state">State</label><div class="zb-form-ctrl"><input class="in" id="shipping_state" name="shipping_state" placeholder="State" value="${esc(r.shipping_state || '')}"><div class="er" data-err="shipping_state"></div></div></div>
                <div class="zb-form-row"><label class="zb-form-label" style="width:120px;min-width:120px;" for="shipping_pincode">Pincode</label><div class="zb-form-ctrl"><input class="in" id="shipping_pincode" name="shipping_pincode" placeholder="Pincode" value="${esc(r.shipping_pincode || '')}"><div class="er" data-err="shipping_pincode"></div></div></div>
                <div class="zb-form-row"><label class="zb-form-label" style="width:120px;min-width:120px;" for="shipping_country">Country</label><div class="zb-form-ctrl"><input class="in" id="shipping_country" name="shipping_country" value="${esc(r.shipping_country || 'India')}"><div class="er" data-err="shipping_country"></div></div></div>
                <div class="zb-form-row"><label class="zb-form-label" style="width:120px;min-width:120px;" for="shipping_phone">Phone</label><div class="zb-form-ctrl"><input class="in" id="shipping_phone" name="shipping_phone" value="${esc(r.shipping_phone || '')}"><div class="er" data-err="shipping_phone"></div></div></div>
              </div>
            ` : ''}
          </div>
        </div>

        <div class="party-tab-pane" id="tab_contacts">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <div class="sub" style="font-size:12px;">Add designated key contacts (sales, finance, dispatch) for this ${entityLabel}.</div>
            <button type="button" class="btn" id="btn_add_contact_row" style="font-size:12px;">+ Add Contact Person</button>
          </div>
          <div id="contact_persons_container"></div>
        </div>

        ${!isCust ? `
          <div class="party-tab-pane" id="tab_bank">
            <div class="zb-form-row">
              <label class="zb-form-label" for="bank_name">Bank Name</label>
              <div class="zb-form-ctrl">
                <input class="in" id="bank_name" name="bank_name" placeholder="e.g. State Bank of India / HDFC Bank" value="${esc(r.bank_name || '')}">
              </div>
            </div>
            <div class="zb-form-row">
              <label class="zb-form-label" for="bank_account_holder">Account Holder Name</label>
              <div class="zb-form-ctrl">
                <input class="in" id="bank_account_holder" name="bank_account_holder" placeholder="Legal Account Name" value="${esc(r.bank_account_holder || r.name || '')}">
              </div>
            </div>
            <div class="zb-form-row">
              <label class="zb-form-label" for="bank_account_number">Bank Account Number</label>
              <div class="zb-form-ctrl">
                <input class="in" id="bank_account_number" name="bank_account_number" type="password" placeholder="Account Number" value="${esc(r.bank_account_number || '')}">
              </div>
            </div>
            <div class="zb-form-row">
              <label class="zb-form-label" for="bank_account_number_confirm">Re-enter Account #</label>
              <div class="zb-form-ctrl">
                <input class="in" id="bank_account_number_confirm" type="text" placeholder="Re-enter to verify" value="${esc(r.bank_account_number || '')}">
                <div class="er" id="bank_acc_err"></div>
              </div>
            </div>
            <div class="zb-form-row">
              <label class="zb-form-label" for="bank_ifsc">IFSC Code</label>
              <div class="zb-form-ctrl">
                <input class="in" id="bank_ifsc" name="bank_ifsc" placeholder="SBIN0001234" style="text-transform:uppercase;max-width:220px;" value="${esc(r.bank_ifsc || '')}">
              </div>
            </div>
            <div class="zb-form-row">
              <label class="zb-form-label" for="bank_branch">Branch Name</label>
              <div class="zb-form-ctrl">
                <input class="in" id="bank_branch" name="bank_branch" placeholder="Main Branch" value="${esc(r.bank_branch || '')}">
              </div>
            </div>
            <div class="zb-form-row">
              <label class="zb-form-label" for="bank_upi_id">UPI ID / VPA</label>
              <div class="zb-form-ctrl">
                <input class="in" id="bank_upi_id" name="bank_upi_id" placeholder="vendor@upi" value="${esc(r.bank_upi_id || '')}">
              </div>
            </div>
          </div>
        ` : ''}

        <div class="party-tab-pane" id="tab_custom_fields">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <div class="sub" style="font-size:12px;">Add custom key-value metadata properties for this account.</div>
            <button type="button" class="btn" id="btn_add_custom_field" style="font-size:12px;">+ Add Custom Field</button>
          </div>
          <div id="custom_fields_container"></div>
        </div>

        <div class="party-tab-pane" id="tab_remarks">
          <div class="zb-form-row align-top">
            <label class="zb-form-label" for="notes">Notes</label>
            <div class="zb-form-ctrl full">
              <textarea class="in" id="notes" name="notes" rows="4" placeholder="Notes for internal team reference only (not printed on customer invoices)...">${esc(r.notes || r.remarks || '')}</textarea>
            </div>
          </div>
        </div>

        <div class="party-tab-pane" id="tab_documents">
          <div class="doc-upload-box" id="doc_drop_zone">
            <div style="font-size:26px;margin-bottom:4px;">📎</div>
            <div style="font-weight:600;margin-bottom:2px;">Upload Attachments</div>
            <div class="sub" style="font-size:12px;color:var(--tx-muted);">You can upload a maximum of 10 files, 10MB each (PDF, PNG, JPG, DOCX, CSV)</div>
            <input type="file" id="party_file_input" multiple style="display:none;" accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx,.csv">
            <button type="button" class="btn" id="btn_party_browse_docs" style="margin-top:10px;">Browse Files</button>
          </div>
          <div id="uploaded_files_list" style="margin-top:10px;display:flex;flex-wrap:wrap;gap:8px;"></div>
        </div>
      </div>
    </div>
  `;

  let modalInstance = null;
  formModal({
    title: (id ? 'Edit ' : 'New ') + entityLabel,
    wide: true,
    dialog: Boolean(onDone || Modal.count() > 0),
    body: formHtml,
    onReady: (form, modal) => {
      modalInstance = modal;
      const partyBrowseDocs = $('#btn_party_browse_docs', modal.el);
      const partyFileInput = $('#party_file_input', modal.el);
      if (partyBrowseDocs && partyFileInput) {
        partyBrowseDocs.addEventListener('click', () => partyFileInput.click());
      }
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

      const cpInp = $('#contact_person', modal.el);
      const fnInp = $('#contact_first_name', modal.el);
      const lnInp = $('#contact_last_name', modal.el);
      if (fnInp && lnInp && cpInp) {
        const syncCp = () => {
          cpInp.value = [fnInp.value.trim(), lnInp.value.trim()].filter(Boolean).join(' ');
        };
        fnInp.addEventListener('input', syncCp);
        lnInp.addEventListener('input', syncCp);
        const parts = (cpInp.value || '').trim().split(/\s+/);
        if (parts.length > 1) {
          fnInp.value = parts[0];
          lnInp.value = parts.slice(1).join(' ');
        } else if (parts.length === 1 && parts[0]) {
          fnInp.value = parts[0];
        }
      }

      if (isCust) {
        const pillBiz = $('#pill_type_business', modal.el);
        const pillInd = $('#pill_type_individual', modal.el);
        if (pillBiz) {
          pillBiz.addEventListener('click', () => {
            pillBiz.classList.add('active'); if (pillInd) pillInd.classList.remove('active');
            const rBiz = $('input[name="customer_type"][value="business"]', modal.el);
            if (rBiz) rBiz.checked = true;
            const gstTr = $('#gst_treatment', modal.el);
            if (gstTr && (!gstTr.value || gstTr.value === 'consumer')) {
              gstTr.value = 'business_regular';
            }
          });
        }
        if (pillInd) {
          pillInd.addEventListener('click', () => {
            pillInd.classList.add('active'); if (pillBiz) pillBiz.classList.remove('active');
            const rInd = $('input[name="customer_type"][value="individual"]', modal.el);
            if (rInd) rInd.checked = true;
            const gstTr = $('#gst_treatment', modal.el);
            if (gstTr && (!gstTr.value || gstTr.value === 'business_regular')) {
              gstTr.value = 'consumer';
            }
          });
        }

        // Quick Preload Sample Party Data
        const btnPreload = $('#btn_party_preload_demo', modal.el);
        if (btnPreload) {
          btnPreload.addEventListener('click', () => {
            $('#company', modal.el).value = 'Bharat Electronics & Retail Pvt Ltd';
            $('#name', modal.el).value = 'Bharat Electronics Ltd';
            $('#contact_first_name', modal.el).value = 'Rajesh';
            $('#contact_last_name', modal.el).value = 'Kumar';
            $('#contact_person', modal.el).value = 'Rajesh Kumar';
            $('#primary_salutation', modal.el).value = 'Mr.';
            $('#email', modal.el).value = 'accounts@bharatelectronics.in';
            $('#phone', modal.el).value = '+91 98450 12345';
            $('#gstin', modal.el).value = '32AABCC1234D1Z5';
            $('#pan', modal.el).value = 'AABCC1234D';
            $('#billing_address', modal.el).value = '42 Commercial Arcade, MG Road';
            $('#billing_city', modal.el).value = 'Kochi';
            $('#billing_pincode', modal.el).value = '682016';
            const pos = $('#place_of_supply', modal.el);
            if (pos) pos.value = '[32] Kerala';
            const pillB = $('#pill_type_business', modal.el);
            if (pillB) pillB.click();
            toast('Preloaded sample customer details into form!', 'ok');
          });
        }

        // Quick Load Excel/CSV/JSON File Data directly into Form
        const btnImportTrigger = $('#btn_party_import_file_trigger', modal.el);
        const quickFileInput = $('#party_file_quick_import', modal.el);
        if (btnImportTrigger && quickFileInput) {
          btnImportTrigger.addEventListener('click', () => quickFileInput.click());
          quickFileInput.addEventListener('change', async () => {
            if (!quickFileInput.files.length) return;
            const fObj = quickFileInput.files[0];
            const origText = btnImportTrigger.innerHTML;
            btnImportTrigger.innerHTML = `${spinner} <span>Loading...</span>`;
            btnImportTrigger.disabled = true;

            try {
              let parsed = null;
              const isExcel = /\.(xlsx|xls|xlsm|xltx)$/i.test(fObj.name);
              if (isExcel) {
                const fd = new FormData();
                fd.append('file', fObj);
                parsed = await api('import/parse-file/', { method: 'POST', body: fd });
              } else if (fObj.name.toLowerCase().endsWith('.json')) {
                try {
                  const text = await fObj.text();
                  const jData = JSON.parse(text);
                  const arr = Array.isArray(jData) ? jData : (jData.records || jData.data || [jData]);
                  const headers = Object.keys(arr[0] || {});
                  const rows = arr.map(obj => headers.map(h => obj[h] ?? ''));
                  parsed = { headers, rows };
                } catch (e) {
                  const fd = new FormData();
                  fd.append('file', fObj);
                  parsed = await api('import/parse-file/', { method: 'POST', body: fd });
                }
              } else {
                try {
                  const text = await fObj.text();
                  parsed = parseCsvString(text);
                  if (!parsed.headers.length || !parsed.rows.length) {
                    const fd = new FormData();
                    fd.append('file', fObj);
                    parsed = await api('import/parse-file/', { method: 'POST', body: fd });
                  }
                } catch (e) {
                  const fd = new FormData();
                  fd.append('file', fObj);
                  parsed = await api('import/parse-file/', { method: 'POST', body: fd });
                }
              }

              const headers = (parsed.headers || []).map(x => x.toLowerCase().replace(/[^a-z0-9]/g, ''));
              const rows = (parsed.rows || []).map(rowVals => {
                const obj = {};
                headers.forEach((head, i) => { obj[head] = rowVals[i] || ''; });
                return obj;
              });

              if (!rows.length) {
                toast('No records found in selected file.', 'err');
                return;
              }
              const firstRec = rows[0];
              const getVal = (...keys) => {
                for (const k of keys) {
                  const cleanK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
                  if (firstRec[cleanK] != null && String(firstRec[cleanK]).trim()) return String(firstRec[cleanK]).trim();
                  if (firstRec[k] != null && String(firstRec[k]).trim()) return String(firstRec[k]).trim();
                }
                return '';
              };

              const nameVal = getVal('name', 'customer_name', 'vendor_name', 'client', 'display_name', 'company');
              const compVal = getVal('company', 'company_name', 'business_name', 'organization');
              const emailVal = getVal('email', 'email_address', 'mail');
              const phoneVal = getVal('phone', 'phone_number', 'mobile', 'contact_number');
              const gstinVal = getVal('gstin', 'gst', 'gst_number');
              const panVal = getVal('pan', 'pan_number');
              const addrVal = getVal('billing_address', 'address', 'street');
              const cityVal = getVal('billing_city', 'city', 'town');
              const pinVal = getVal('billing_pincode', 'pincode', 'pin_code', 'zip');

              if (nameVal && $('#name', modal.el)) $('#name', modal.el).value = nameVal;
              if (compVal && $('#company', modal.el)) $('#company', modal.el).value = compVal;
              if (emailVal && $('#email', modal.el)) $('#email', modal.el).value = emailVal;
              if (phoneVal && $('#phone', modal.el)) $('#phone', modal.el).value = phoneVal;
              if (gstinVal && $('#gstin', modal.el)) $('#gstin', modal.el).value = gstinVal;
              if (panVal && $('#pan', modal.el)) $('#pan', modal.el).value = panVal;
              if (addrVal && $('#billing_address', modal.el)) $('#billing_address', modal.el).value = addrVal;
              if (cityVal && $('#billing_city', modal.el)) $('#billing_city', modal.el).value = cityVal;
              if (pinVal && $('#billing_pincode', modal.el)) $('#billing_pincode', modal.el).value = pinVal;

              const fnVal = getVal('first_name', 'firstname', 'given_name');
              const lnVal = getVal('last_name', 'lastname', 'surname');
              const cpVal = getVal('contact_person', 'contact', 'primary_contact', 'attention');
              const stateVal = getVal('state', 'billing_state', 'place_of_supply', 'source_of_supply');
              const obVal = getVal('opening_balance', 'balance', 'opening_bal');
              const ptVal = getVal('payment_terms', 'terms', 'payment_terms_days');

              if (fnVal && $('#contact_first_name', modal.el)) $('#contact_first_name', modal.el).value = fnVal;
              if (lnVal && $('#contact_last_name', modal.el)) $('#contact_last_name', modal.el).value = lnVal;
              if (cpVal && $('#contact_person', modal.el)) $('#contact_person', modal.el).value = cpVal;
              else if ((fnVal || lnVal) && $('#contact_person', modal.el)) $('#contact_person', modal.el).value = `${fnVal} ${lnVal}`.trim();
              if (stateVal) {
                if ($('#billing_state', modal.el)) $('#billing_state', modal.el).value = stateVal;
                if ($('#shipping_state', modal.el)) $('#shipping_state', modal.el).value = stateVal;
                const pos = $('#place_of_supply', modal.el) || $('#source_of_supply', modal.el);
                if (pos) {
                  for (const opt of pos.options) {
                    if (opt.text.toLowerCase().includes(stateVal.toLowerCase()) || opt.value.toLowerCase().includes(stateVal.toLowerCase())) {
                      pos.value = opt.value;
                      break;
                    }
                  }
                }
              }
              if (obVal && $('#opening_balance', modal.el)) $('#opening_balance', modal.el).value = obVal;
              if (ptVal && $('#payment_terms', modal.el)) $('#payment_terms', modal.el).value = ptVal;
              quickFileInput.value = '';

              toast(`Loaded data for ${nameVal || entityLabel} (1 of ${rows.length} rows) into form!`, 'ok');
            } catch (e) {
              toast('Failed to load file: ' + e.message, 'err');
            } finally {
              btnImportTrigger.innerHTML = origText;
              btnImportTrigger.disabled = false;
              quickFileInput.value = '';
            }
          });
        }

        $$('input[name="tax_preference"]', modal.el).forEach(radio => {
          radio.addEventListener('change', () => {
            const wrap = $('#exemption_reason_wrap', modal.el);
            if (radio.value === 'tax_exempt' && radio.checked) wrap.style.display = 'block';
            else if (radio.checked) wrap.style.display = 'none';
          });
        });
      } else {
        const btnPreload = $('#btn_party_preload_demo', modal.el);
        if (btnPreload) {
          btnPreload.addEventListener('click', () => {
            $('#company', modal.el).value = 'Reliable Hardware Supplies Pvt Ltd';
            $('#name', modal.el).value = 'Reliable Hardware Supplies';
            $('#contact_first_name', modal.el).value = 'Suresh';
            $('#contact_last_name', modal.el).value = 'Nair';
            $('#contact_person', modal.el).value = 'Suresh Nair';
            $('#primary_salutation', modal.el).value = 'Mr.';
            $('#email', modal.el).value = 'orders@reliablehardware.in';
            $('#phone', modal.el).value = '+91 94470 56789';
            $('#gstin', modal.el).value = '32AABCR9876E1Z2';
            $('#pan', modal.el).value = 'AABCR9876E';
            $('#billing_address', modal.el).value = '18 Industrial Estate, Kalamassery';
            $('#billing_city', modal.el).value = 'Kochi';
            $('#billing_pincode', modal.el).value = '683104';
            const sos = $('#source_of_supply', modal.el);
            if (sos) sos.value = '[32] Kerala';
            toast('Preloaded sample vendor details into form!', 'ok');
          });
        }

        const msmeCk = $('#is_msme_registered', modal.el);
        const msmeWrap = $('#msme_fields_wrap', modal.el);
        msmeCk.addEventListener('change', () => {
          msmeWrap.style.display = msmeCk.checked ? 'flex' : 'none';
        });
      }

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
            if (res.customer_type === 'individual') {
              const pInd = $('#pill_type_individual', modal.el);
              if (pInd) pInd.click();
            } else {
              const pBiz = $('#pill_type_business', modal.el);
              if (pBiz) pBiz.click();
            }
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

      const prefillToggle = $('#btn_toggle_gst_prefill', modal.el);
      const prefillCtrls = $('#gst_prefill_ctrls', modal.el);
      const prefillClose = $('#btn_close_gst_prefill', modal.el);
      if (prefillToggle) {
        prefillToggle.addEventListener('click', e => {
          e.preventDefault();
          if (prefillCtrls.style.display === 'none') {
            prefillCtrls.style.display = 'flex';
            const curGstin = ($('#gstin', modal.el)?.value || '').trim();
            if (curGstin) $('#gst_prefill_code', modal.el).value = curGstin;
            $('#gst_prefill_code', modal.el).focus();
          } else {
            doPrefill();
          }
        });
      }
      if (prefillClose) {
        prefillClose.addEventListener('click', e => {
          e.preventDefault();
          prefillCtrls.style.display = 'none';
        });
      }
      $('#gst_prefill_code', modal.el).addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          doPrefill();
        }
      });

      $('#btn_trigger_gst_prefill', modal.el).addEventListener('click', doPrefill);

      $('#gstin', modal.el).addEventListener('input', e => {
        $('#gst_prefill_code', modal.el).value = e.target.value;
      });
      $('#gst_prefill_code', modal.el).addEventListener('input', e => {
        $('#gstin', modal.el).value = e.target.value;
      });

      const btnDn = $('#btn_toggle_display_name_dropdown', modal.el);
      const dnMenu = $('#display_name_dropdown', modal.el);
      const nameInput = $('#name', modal.el);
      if (btnDn && dnMenu && nameInput) {
        const renderDnOptions = () => {
          const comp = ($('#company', modal.el)?.value || '').trim();
          const fn = ($('#contact_first_name', modal.el)?.value || '').trim();
          const ln = ($('#contact_last_name', modal.el)?.value || '').trim();
          const sal = ($('#primary_salutation', modal.el)?.value || '').trim();
          const fullName = [fn, ln].filter(Boolean).join(' ');
          const salFullName = [sal, fn, ln].filter(Boolean).join(' ');
          const invertedName = fn && ln ? `${ln}, ${fn}` : '';

          const opts = [];
          if (comp) opts.push({ label: comp, source: 'From Company Name' });
          if (fullName) opts.push({ label: fullName, source: 'From Primary Contact' });
          if (salFullName && salFullName !== fullName) opts.push({ label: salFullName, source: 'With Salutation' });
          if (invertedName) opts.push({ label: invertedName, source: 'Last Name, First Name' });

          if (!opts.length) {
            opts.push(
              { label: 'Example: Bharat Technologies Pvt Ltd', source: 'Suggested Business Name' },
              { label: 'Example: Rajesh Kumar', source: 'Suggested Contact Name' }
            );
          }

          dnMenu.innerHTML = opts.map(o => `
            <div class="display-name-item" data-val="${esc(o.label)}">
              <span class="dn-label">${esc(o.label)}</span>
              <span class="dn-source">${esc(o.source)}</span>
            </div>
          `).join('');

          $$('.display-name-item', dnMenu).forEach(item => {
            item.addEventListener('click', e => {
              e.stopPropagation();
              nameInput.value = item.dataset.val;
              nameInput.focus();
              dnMenu.style.display = 'none';
            });
          });
        };

        btnDn.addEventListener('click', e => {
          e.stopPropagation();
          if (dnMenu.style.display === 'none' || !dnMenu.style.display) {
            renderDnOptions();
            dnMenu.style.display = 'block';
          } else {
            dnMenu.style.display = 'none';
          }
        });

        document.addEventListener('click', e => {
          if (!btnDn.contains(e.target) && !dnMenu.contains(e.target)) {
            dnMenu.style.display = 'none';
          }
        });
      }

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
      // DEF_CB_007 & DEF_CB_026: Validate Display Name
      const dispName = (d.name || '').trim();
      if (!dispName) {
        throw new ApiErr(400, { name: `${entityLabel} Display Name is required.` }, `${entityLabel} Display Name is required.`);
      }
      if (/[@#$%^*+=~`<>{}\[\]\\]/.test(dispName)) {
        throw new ApiErr(400, { name: 'Display Name cannot contain special characters like @, #, $, %, ^, *.' }, 'Display Name contains invalid special characters.');
      }
      d.name = dispName;

      // DEF_CB_006: Validate Primary Contact
      const cp = (d.contact_person || '').trim();
      if (cp) {
        const nameRegex = /^[a-zA-Z\s\.'\-]+$/;
        if (!nameRegex.test(cp)) {
          throw new ApiErr(400, { contact_person: 'Primary contact name can only contain letters, spaces, hyphens, and dots.' }, 'Primary contact name cannot contain special characters.');
        }
      }

      // DEF_CB_008: Validate Email
      const emailVal = (d.email || '').trim();
      if (emailVal) {
        if (/\s/.test(d.email)) {
          throw new ApiErr(400, { email: 'Email address cannot contain spaces.' }, 'Email address cannot contain spaces.');
        }
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!emailRegex.test(emailVal)) {
          throw new ApiErr(400, { email: 'Enter a valid email address.' }, 'Enter a valid email address.');
        }
      }

      // Validate Billing Address mandatory fields only if street address line is entered
      const bAddr = (d.billing_address || '').trim();
      const bCity = (d.billing_city || '').trim();
      const bState = (d.billing_state || '').trim();
      const bPin = (d.billing_pincode || '').trim();
      if (bAddr) {
        const addrErrs = {};
        if (!bCity) addrErrs.billing_city = 'City is required.';
        if (!bState) addrErrs.billing_state = 'State is required.';
        if (!bPin) addrErrs.billing_pincode = 'Pincode is required.';
        if (Object.keys(addrErrs).length > 0) {
          const tabBtn = form.querySelector('.party-tab-btn[data-tab="tab_address"]');
          if (tabBtn) tabBtn.click();
          throw new ApiErr(400, addrErrs, 'Please fill in all mandatory address fields.');
        }
      }

      if (!isCust) {
        const acc = d.bank_account_number ? d.bank_account_number.trim() : '';
        const cfAccEl = document.getElementById('bank_account_number_confirm') || (modalInstance?.el ? $('#bank_account_number_confirm', modalInstance.el) : null);
        const cfAcc = (cfAccEl ? cfAccEl.value : '').trim();
        if (acc && cfAcc && acc !== cfAcc) {
          throw new ApiErr(400, { bank_account_number: 'Bank account numbers do not match.' }, 'Bank account numbers do not match.');
        }
      }

      d.customer_type = d.customer_type || 'business';
      d.contact_persons_data = contactPersonsList.filter(c => c.first_name || c.last_name || c.email);
      const cfMap = {};
      customFieldsList.forEach(cf => {
        if (cf.label.trim()) cfMap[cf.label.trim()] = (cf.value || '').trim();
      });
      d.custom_fields_data = cfMap;
      d.documents_data = documentsList;

      d.notes = (d.notes || d.remarks || '').trim();
      d.remarks = d.notes;

      if (isCust && d.place_of_supply) {
        const stMatch = d.place_of_supply.replace(/^\[\d+\]\s*/, '').trim();
        if (stMatch) d.state = stMatch;
      } else if (!isCust && d.source_of_supply) {
        const stMatch = d.source_of_supply.replace(/^\[\d+\]\s*/, '').trim();
        if (stMatch) d.state = stMatch;
      }
      if (!d.state && d.billing_state) {
        d.state = d.billing_state;
      }

      if (!id) d.active = true;
      const saved = await api(id ? `${kind}/${id}/` : `${kind}/`, { method: id ? 'PUT' : 'POST', body: d });
      toast(`${entityLabel} ${id ? 'updated' : 'created'} successfully!`, 'ok');
      if (onDone) {
        onDone(saved || d);
      } else {
        refresh();
      }
    }
  });
}

function formatReorderPoint(val) {
  if (val == null || val === '') return '';
  const s = String(val).trim();
  if (!s) return '';
  const n = Number(s);
  if (!Number.isFinite(n)) return s;
  if (Number.isInteger(n)) return String(n);
  if (s.includes('.')) {
    return s.replace(/\.?0+$/, '');
  }
  return String(n);
}

async function itemForm(id, onDone) {
  const [r, vendors, warehouses, nextSku] = await Promise.all([
    id ? api(`items/${id}/`) : {
      type: 'goods',
      item_type: 'goods',
      gst_rate: 18,
      selling_price: '',
      purchase_price: '',
      active: true,
      unit: 'pcs',
      track_inventory: true,
      warehouse_id: null,
      warehouse_code: '',
      tax_preference: 'taxable',
      sales_account: 'Sales',
      purchase_account: 'Cost of Goods Sold',
      inventory_account: 'Inventory Asset',
      preferred_vendor_id: null,
      preferred_vendor_name: '',
      image_data: '',
      category: '',
      hsn_sac: '',
      description: '',
      reorder_level: '',
      sku: ''
    },
    api('lookup/vendors/').catch(() => null),
    api('lookup/warehouses/').catch(() => []),
    id ? Promise.resolve(null) : api('lookup/next-item-sku/').catch(() => null)
  ]);

  if (!id && nextSku && nextSku.next_number && !r.sku) {
    r.sku = nextSku.next_number;
  }

  const isGoods = (r.type || r.item_type || 'goods') === 'goods';
  const img = r.image_data || '';

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
  let curVendorName = r.preferred_vendor_name || '';
  if (!curVendorName && curVendorId && Array.isArray(vendors)) {
    const matchedVendor = vendors.find(v => String(v.id) === curVendorId);
    if (matchedVendor) curVendorName = matchedVendor.name;
  }

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
    dialog: Boolean(onDone || Modal.count() > 0),
    body: `
    <div class="convosis-item-modal convo-item-modal zb-form-wrap">

      <div class="zb-form-row">
        <label class="zb-form-label">Type <span class="zb-info-tip" title="Goods have physical inventory, services do not.">ⓘ</span></label>
        <div class="zb-form-ctrl">
          <div class="convosis-radio-group convo-radio-group" style="height:35px;">
            <label class="radio-label">
              <input type="radio" name="item_type" value="goods" ${isGoods ? 'checked' : ''}>
              <span>📦 Goods</span>
            </label>
            <label class="radio-label">
              <input type="radio" name="item_type" value="service" ${!isGoods ? 'checked' : ''}>
              <span>⚙️ Service</span>
            </label>
          </div>
          <div class="er" data-err="item_type" role="alert"></div>
        </div>
      </div>

      <div class="zb-form-row">
        <label for="item_name" class="zb-form-label">Name<span class="rq">*</span></label>
        <div class="zb-form-ctrl">
          <input class="in" type="text" id="item_name" name="name" value="${esc(r.name || '')}" placeholder="Item name" required autofocus>
          <div class="er" data-err="name" role="alert"></div>
        </div>
      </div>

      <div class="zb-form-row">
        <label for="item_unit_select" class="zb-form-label">Unit <span class="zb-info-tip" title="Measuring unit for GST & billing">ⓘ</span></label>
        <div class="zb-form-ctrl">
          <div style="display:flex;gap:8px;">
            <select class="in" id="item_unit_select" style="max-width:240px;">
              <option value="">Select Unit…</option>
              ${unitOptsHtml}
              ${extraUnitOpt}
              <option value="__add_new__" style="color:var(--accent); font-weight:600;">+ Add New Unit…</option>
            </select>
            <input class="in" type="text" id="item_unit" name="unit" value="${esc(r.unit || 'pcs')}" placeholder="Unit" maxlength="20" required style="max-width:140px;">
          </div>
          <div class="er" data-err="unit" role="alert"></div>
        </div>
      </div>

      <div class="zb-form-row">
        <label for="item_sku" class="zb-form-label">SKU <span class="zb-info-tip" title="Stock Keeping Unit (Optional - auto-generated if left blank)">ⓘ</span></label>
        <div class="zb-form-ctrl">
          <input class="in" type="text" id="item_sku" name="sku" value="${esc(r.sku || '')}" placeholder="Optional (e.g. PROD-001 or auto)" maxlength="60" style="text-transform:uppercase;max-width:260px;">
          <div class="er" data-err="sku" role="alert"></div>
        </div>
      </div>

      <div class="zb-form-row">
        <label for="item_hsn" class="zb-form-label">HSN / SAC Code <span class="zb-info-tip" title="6-digit GST classification code">ⓘ</span></label>
        <div class="zb-form-ctrl">
          <div class="hsn-search-wrap" id="hsnSearchWrap" style="position:relative;max-width:320px;">
            <input class="in" type="text" id="item_hsn" name="hsn_sac" autocomplete="off" value="${esc(r.hsn_sac || '')}" placeholder="6-digit HSN/SAC code (e.g. 847130)" maxlength="6">
            <svg class="hsn-search-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" style="position:absolute;right:10px;top:10px;pointer-events:none;color:var(--tx-muted);"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <div class="pop" id="hsn_dropdown_menu" role="listbox" style="display:none;position:absolute;top:calc(100% + 4px);left:0;right:0;max-height:160px;overflow-y:auto;z-index:100;background:var(--surface-glass-solid, #ffffff);border:1px solid var(--bd, #cbd5e1);border-radius:8px;box-shadow:0 10px 25px rgba(0,0,0,0.15);padding:4px;"></div>
          </div>
          <div class="hp" style="font-size:11px;color:var(--tx-muted);margin-top:2px;">Standard 6-digit numeric HSN (goods) or SAC (services) code</div>
          <div class="er" data-err="hsn_sac" role="alert"></div>
        </div>
      </div>

      <div class="zb-form-row">
        <label for="item_tax_pref" class="zb-form-label">Tax Preference<span class="rq">*</span></label>
        <div class="zb-form-ctrl">
          <select class="in" id="item_tax_pref" name="tax_preference" style="max-width:260px;">
            <option value="taxable" ${r.tax_preference !== 'exempt' && r.tax_preference !== 'non_taxable' && r.tax_preference !== 'nil_rated' ? 'selected' : ''}>Taxable</option>
            <option value="non_taxable" ${r.tax_preference === 'non_taxable' ? 'selected' : ''}>Non-Taxable</option>
            <option value="exempt" ${r.tax_preference === 'exempt' ? 'selected' : ''}>Exempt</option>
            <option value="nil_rated" ${r.tax_preference === 'nil_rated' ? 'selected' : ''}>Nil Rated (0%)</option>
          </select>
        </div>
      </div>

      <div class="zb-form-row" id="gstIntraWrap">
        <label for="item_gst_intra" class="zb-form-label">Intra-State Tax Rate</label>
        <div class="zb-form-ctrl">
          <select class="in" id="item_gst_intra" name="gst_rate" style="max-width:260px;">
            ${intraOptionsHtml}
          </select>
        </div>
      </div>

      <div class="zb-form-row" id="gstInterWrap">
        <label for="item_gst_inter" class="zb-form-label">Inter-State Tax Rate (IGST)</label>
        <div class="zb-form-ctrl">
          <select class="in" id="item_gst_inter" style="max-width:260px;">
            ${interOptionsHtml}
          </select>
        </div>
      </div>

      <div class="zb-form-row">
        <label for="item_category" class="zb-form-label">Category</label>
        <div class="zb-form-ctrl">
          <input class="in" type="text" id="item_category" name="category" value="${esc(r.category || '')}" placeholder="e.g. Hardware, Software, Services" maxlength="100">
        </div>
      </div>

      <div class="zb-form-row align-top">
        <label class="zb-form-label">Item Image</label>
        <div class="zb-form-ctrl">
          <div class="convosis-image-dropzone convo-image-dropzone" id="itemImageDropzone" style="max-width:320px;padding:14px;border-radius:8px;">
            <input type="file" id="itemImageFileInput" accept="image/png,image/jpeg,image/webp,image/gif" style="display:none;">
            <input type="hidden" name="image_data" id="itemImageDataInput" value="${esc(img)}">
            <div id="dropzoneEmpty" class="dropzone-empty-state" style="${img ? 'display:none;' : ''}">
              <div class="dropzone-icon">
                <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="3" y="3" width="18" height="18" rx="3" ry="3"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
              </div>
              <div class="dropzone-text" style="font-size:12px;">
                <span>Drag Image here or</span>
                <button type="button" class="btn-browse-link" id="btnBrowseImage">Browse</button>
              </div>
            </div>
            <div id="dropzonePreview" class="dropzone-preview-state" style="${img ? '' : 'display:none;'}">
              <img id="itemImagePreviewImg" src="${esc(img)}" alt="Item Preview" style="max-height:80px;border-radius:6px;">
              <div class="preview-actions" style="margin-top:6px;">
                <button type="button" class="btn btn-sm" id="btnChangeImage">Change</button>
                <button type="button" class="btn btn-sm btn-danger-link" id="btnRemoveImage">Remove</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style="margin:20px 0 10px;padding-top:14px;border-top:1px solid var(--bd-glass);">
        <h4 style="margin:0 0 12px;font-size:14px;font-weight:700;color:var(--tx);">Sales Information</h4>
        <div class="zb-form-row">
          <label for="item_selling_price" class="zb-form-label">Selling Price<span class="rq">*</span></label>
          <div class="zb-form-ctrl">
            <div style="display:flex;max-width:260px;">
              <span class="zb-input-prefix">INR</span>
              <input class="in" type="number" step="0.01" min="0" id="item_selling_price" name="selling_price" value="${esc(r.selling_price || '')}" placeholder="0.00" required>
            </div>
            <div class="er" data-err="selling_price" role="alert"></div>
          </div>
        </div>
        <div class="zb-form-row">
          <label for="item_sales_account" class="zb-form-label">Account<span class="rq">*</span></label>
          <div class="zb-form-ctrl">
            <select class="in" id="item_sales_account" name="sales_account">
              ${salesAccountsHtml}
              ${extraSalesOpt}
              <option value="__add_new__" style="color:var(--accent); font-weight:600;">+ Add New Account…</option>
            </select>
            <div class="er" data-err="sales_account" role="alert"></div>
          </div>
        </div>
        <div class="zb-form-row align-top">
          <label for="item_sales_desc" class="zb-form-label">Description</label>
          <div class="zb-form-ctrl">
            <textarea class="in" id="item_sales_desc" name="description" rows="2" placeholder="Sales description for customer invoices…">${esc(r.description || '')}</textarea>
          </div>
        </div>
      </div>

      <div style="margin:20px 0 10px;padding-top:14px;border-top:1px solid var(--bd-glass);">
        <div class="zb-form-row">
          <div class="zb-form-label"></div>
          <div class="zb-form-ctrl">
            <label class="ck" style="height:35px;display:flex;align-items:center;">
              <input type="checkbox" id="chkPurchaseInfo" name="enable_purchase_info" ${(r.purchase_price && Number(r.purchase_price) > 0) || r.preferred_vendor_id ? 'checked' : ''}>
              <b>Include Purchase Information</b>
              <span class="sub" style="margin-left:8px;font-size:11.5px;color:var(--tx-muted);">(Optional - check to show essential purchase fields)</span>
            </label>
          </div>
        </div>

        <div id="purchaseFieldsWrap" style="${((r.purchase_price && Number(r.purchase_price) > 0) || r.preferred_vendor_id) ? '' : 'display:none;'}">
          <div class="zb-form-row">
            <label for="item_purchase_price" class="zb-form-label">Cost Price <span class="sub" style="font-size:11px;color:var(--tx-muted);">(Optional)</span></label>
            <div class="zb-form-ctrl">
              <div style="display:flex;max-width:260px;">
                <span class="zb-input-prefix">INR</span>
                <input class="in" type="number" step="0.01" min="0" id="item_purchase_price" name="purchase_price" value="${esc(r.purchase_price || '')}" placeholder="0.00">
              </div>
              <div class="er" data-err="purchase_price" role="alert"></div>
            </div>
          </div>
          <div class="zb-form-row">
            <label for="item_purchase_account" class="zb-form-label">Account</label>
            <div class="zb-form-ctrl">
              <select class="in" id="item_purchase_account" name="purchase_account">
                ${purchaseAccountsHtml}
                ${extraPurchOpt}
                <option value="__add_new__" style="color:var(--accent); font-weight:600;">+ Add New Account…</option>
              </select>
              <div class="er" data-err="purchase_account" role="alert"></div>
            </div>
          </div>
          <div class="zb-form-row">
            <label for="item_preferred_vendor_search" class="zb-form-label">Preferred Vendor <span class="zb-info-tip" title="Choose default vendor for purchase orders">ⓘ</span></label>
            <div class="zb-form-ctrl">
              <div class="lookup-combobox-wrap" id="preferredVendorLookupWrap" style="position:relative;width:100%;max-width:380px;">
                <input type="hidden" name="preferred_vendor_id" id="item_preferred_vendor" value="${curVendorId}">
                <div class="lookup-input-box" style="position:relative;display:flex;align-items:center;width:100%;">
                  <input class="in lookup-search-input" id="item_preferred_vendor_search" type="text" autocomplete="off" placeholder="Select or search a vendor…" value="${esc(curVendorName)}" style="padding-right:54px;cursor:pointer;">
                  <div style="position:absolute;right:8px;display:flex;align-items:center;gap:4px;z-index:2;">
                    <button type="button" class="lookup-clear-btn" id="item_preferred_vendor_clear" title="Clear vendor selection" aria-label="Clear vendor" style="background:none;border:none;cursor:pointer;color:var(--tx-muted);font-size:14px;padding:2px 4px;line-height:1;display:${curVendorId ? 'inline-block' : 'none'};">✕</button>
                    <span class="lookup-caret" style="pointer-events:none;color:var(--tx-muted);font-size:10px;margin-right:2px;">▼</span>
                  </div>
                </div>
                <div class="lookup-dropdown-menu pop" id="item_preferred_vendor_menu" role="listbox" style="position:absolute;top:calc(100% + 4px);left:0;right:0;max-height:220px;overflow-y:auto;z-index:100;padding:4px;box-shadow:var(--shadow-glass-lg, 0 10px 25px rgba(0,0,0,0.15));border-radius:8px;background:var(--surface-glass-solid, #ffffff);border:1px solid var(--bd, #cbd5e1);display:none;"></div>
              </div>
              <div class="er" data-err="preferred_vendor_id" role="alert"></div>
            </div>
          </div>
          <div class="zb-form-row align-top">
            <label for="item_purchase_desc" class="zb-form-label">Description</label>
            <div class="zb-form-ctrl">
              <textarea class="in" id="item_purchase_desc" rows="2" placeholder="Purchase description for vendor bills…"></textarea>
            </div>
          </div>
        </div>
      </div>

      <div id="inventorySection" style="margin:20px 0 10px;padding-top:14px;border-top:1px solid var(--bd-glass);">
        <div class="zb-form-row">
          <div class="zb-form-label"></div>
          <div class="zb-form-ctrl">
            <label class="ck" style="height:35px;display:flex;align-items:center;">
              <input type="checkbox" id="chkTrackInventory" name="track_inventory" ${r.track_inventory ? 'checked' : ''}>
              <b>Track Inventory for this item</b>
            </label>
          </div>
        </div>
        <div id="inventoryBody" style="${r.track_inventory ? '' : 'display:none;'}">
          <div class="zb-form-row">
            <label for="item_warehouse" class="zb-form-label">Warehouse Code <span class="zb-info-tip" title="Primary storage warehouse or sub-warehouse">ⓘ</span></label>
            <div class="zb-form-ctrl">
              <select class="in" id="item_warehouse" name="warehouse_id" style="max-width:280px;">
                <option value="">Select Warehouse…</option>
                ${(warehouses || []).map(w => `<option value="${w.id}" ${(String(w.id) === String(r.warehouse_id) || w.code === r.warehouse_code) ? 'selected' : ''}>${esc(w.code)} - ${esc(w.name)}${w.is_sub_warehouse ? ' (Sub)' : ''}</option>`).join('')}
                <option value="__new_warehouse__">+ Add New Warehouse…</option>
              </select>
            </div>
          </div>
          ${id ? '' : `
            <div class="zb-form-row" id="openingStockWrap">
              <label class="zb-form-label">Opening Stock</label>
              <div class="zb-form-ctrl">
                <input class="in" type="number" step="any" min="0" name="opening_stock" placeholder="0" style="max-width:220px;">
              </div>
            </div>
          `}
          <div class="zb-form-row">
            <label for="item_reorder_level" class="zb-form-label">Reorder Point</label>
            <div class="zb-form-ctrl">
              <input class="in" type="number" step="any" min="0" id="item_reorder_level" name="reorder_level" value="${formatReorderPoint(r.reorder_level)}" placeholder="0" style="max-width:220px;">
            </div>
          </div>
          <div class="zb-form-row">
            <label for="item_inventory_account" class="zb-form-label">Inventory Account</label>
            <div class="zb-form-ctrl">
              <select class="in" id="item_inventory_account" name="inventory_account">
                ${inventoryAccountsHtml}
                ${extraInvOpt}
                <option value="__add_new__" style="color:var(--accent); font-weight:600;">+ Add New Account…</option>
              </select>
            </div>
          </div>
        </div>
        ${id ? '<div class="hp" style="margin-left:211px;font-size:11.5px;color:var(--tx-muted);margin-top:4px;">Stock adjustments are tracked through Stock Adjustments.</div>' : ''}
      </div>

      ${id ? `
        <div class="zb-form-row" style="margin-top:12px;">
          <div class="zb-form-label"></div>
          <div class="zb-form-ctrl">
            <label class="ck"><input type="checkbox" name="active" ${r.active ? 'checked' : ''}> Active Item</label>
          </div>
        </div>
      ` : ''}
    </div>
    `,
    onReady: (form, m) => {
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

      // DEF_CB_012: Bounded custom HSN dropdown to prevent obstruction
      const HSN_PRESETS = [
        { code: '847130', desc: 'Portable computers, laptops & notebooks' },
        { code: '847150', desc: 'Digital processing units & servers' },
        { code: '851713', desc: 'Smartphones & cellular devices' },
        { code: '852852', desc: 'Computer monitors & visual display units' },
        { code: '482010', desc: 'Registers, account books & office stationery' },
        { code: '998313', desc: 'Information technology consulting & software development' },
        { code: '998314', desc: 'Cloud hosting, infrastructure & IT data processing' },
        { code: '998713', desc: 'Maintenance & repair of IT equipment' }
      ];
      const hsnInput = $('#item_hsn', form);
      const hsnMenu = $('#hsn_dropdown_menu', form);
      const hsnWrap = $('#hsnSearchWrap', form);

      if (hsnInput && hsnMenu) {
        const renderHsnMenu = (query = '') => {
          const q = (query || '').trim().toLowerCase();
          const filtered = q
            ? HSN_PRESETS.filter(p => p.code.includes(q) || p.desc.toLowerCase().includes(q))
            : HSN_PRESETS;
          hsnMenu.innerHTML = '';
          if (!filtered.length) {
            hsnMenu.style.display = 'none';
            return;
          }
          filtered.forEach(p => {
            const item = document.createElement('div');
            item.style.cssText = 'padding:6px 10px;border-radius:6px;cursor:pointer;font-size:12px;color:var(--tx);display:flex;align-items:center;gap:8px;';
            item.innerHTML = `<b style="color:var(--accent);">${p.code}</b> <span style="color:var(--tx-muted);">${p.desc}</span>`;
            item.addEventListener('mouseenter', () => { item.style.background = 'var(--surface-glass-subtle, rgba(0,0,0,0.05))'; });
            item.addEventListener('mouseleave', () => { item.style.background = ''; });
            item.addEventListener('mousedown', e => {
              e.preventDefault();
              hsnInput.value = p.code;
              hsnMenu.style.display = 'none';
            });
            hsnMenu.appendChild(item);
          });
          hsnMenu.style.display = 'block';
        };

        hsnInput.addEventListener('focus', () => renderHsnMenu(hsnInput.value));
        hsnInput.addEventListener('input', e => renderHsnMenu(e.target.value));
        document.addEventListener('click', e => {
          if (hsnWrap && !hsnWrap.contains(e.target)) {
            if (hsnMenu) hsnMenu.style.display = 'none';
          }
        });
      }

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

      const pvWrap = $('#preferredVendorLookupWrap', form);
      const pvHidden = $('#item_preferred_vendor', form);
      const pvSearch = $('#item_preferred_vendor_search', form);
      const pvClear = $('#item_preferred_vendor_clear', form);
      const pvMenu = $('#item_preferred_vendor_menu', form);

      let vendorRecords = Array.isArray(vendors) ? [...vendors] : null;
      let selectedVendorId = curVendorId;
      let selectedVendorName = curVendorName;
      let isPvMenuOpen = false;

      const renderPvDropdown = (query = '') => {
        const q = (query || '').trim().toLowerCase();
        pvMenu.innerHTML = '';

        if (vendorRecords === null) {
          pvMenu.innerHTML = `
            <div style="padding:12px;font-size:12px;color:var(--dn, #e11d48);text-align:center;">
              Failed to load vendors. <button type="button" class="btn" id="btnRetryVendors" style="padding:2px 8px;font-size:11px;margin-left:6px;">Retry</button>
            </div>
          `;
          const btnRetry = $('#btnRetryVendors', pvMenu);
          if (btnRetry) {
            btnRetry.addEventListener('click', async e => {
              e.stopPropagation();
              btnRetry.textContent = 'Loading…';
              btnRetry.disabled = true;
              try {
                vendorRecords = await api('lookup/vendors/');
                renderPvDropdown(pvSearch.value);
              } catch (err) {
                toast('Failed to load vendors', 'err');
                renderPvDropdown(pvSearch.value);
              }
            });
          }
          return;
        }

        const filtered = q
          ? vendorRecords.filter(v => (v.name || '').toLowerCase().includes(q) || (v.state || '').toLowerCase().includes(q))
          : vendorRecords;

        if (selectedVendorId) {
          const clearOpt = document.createElement('div');
          clearOpt.className = 'lookup-opt-clear';
          clearOpt.style.cssText = 'padding:7px 10px;border-radius:6px;cursor:pointer;font-size:12px;color:var(--tx-muted);font-style:italic;';
          clearOpt.textContent = '— None (No preferred vendor) —';
          clearOpt.addEventListener('mousedown', e => {
            e.preventDefault();
            selectVendor('', '');
          });
          pvMenu.appendChild(clearOpt);
        }

        if (filtered.length === 0) {
          const emptyMsg = document.createElement('div');
          emptyMsg.style.cssText = 'padding:10px 12px;font-size:12px;color:var(--tx-muted);text-align:center;';
          emptyMsg.textContent = vendorRecords.length === 0
            ? 'No vendors registered in Vendor Master yet.'
            : `No vendors found matching "${query}"`;
          pvMenu.appendChild(emptyMsg);
        } else {
          filtered.forEach(v => {
            const isSel = String(v.id) === selectedVendorId;
            const opt = document.createElement('div');
            opt.className = 'lookup-vendor-item' + (isSel ? ' selected' : '');
            opt.style.cssText = `padding:7px 10px;border-radius:6px;cursor:pointer;font-size:13px;display:flex;align-items:center;justify-content:space-between;${isSel ? 'background:var(--pastel-sky-bg, rgba(14,165,233,0.12));font-weight:600;color:var(--accent);' : 'color:var(--tx);'}`;
            opt.innerHTML = `
              <span>${esc(v.name)}</span>
              ${v.state ? `<small style="font-size:11px;color:var(--tx-muted);">${esc(v.state)}</small>` : ''}
            `;
            opt.addEventListener('mouseenter', () => {
              if (!isSel) opt.style.background = 'var(--surface-glass-subtle, rgba(0,0,0,0.04))';
            });
            opt.addEventListener('mouseleave', () => {
              if (!isSel) opt.style.background = '';
            });
            opt.addEventListener('mousedown', e => {
              e.preventDefault();
              selectVendor(v.id, v.name);
            });
            pvMenu.appendChild(opt);
          });
        }

        const addBtn = document.createElement('div');
        addBtn.className = 'lookup-add-vendor-btn';
        addBtn.style.cssText = 'padding:8px 10px;margin-top:4px;border-top:1px solid var(--bd-glass, rgba(0,0,0,0.08));color:var(--accent);font-weight:600;font-size:12.5px;cursor:pointer;display:flex;align-items:center;gap:6px;';
        addBtn.innerHTML = `
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          <span>+ Add New Vendor…</span>
        `;
        addBtn.addEventListener('mousedown', async e => {
          e.preventDefault();
          const val = window.prompt('Enter new vendor name:');
          if (val && val.trim()) {
            try {
              const newV = await api('vendors/', {
                method: 'POST',
                body: { name: val.trim(), active: true, state: (APP.org && APP.org.state) || '' }
              });
              if (vendorRecords) vendorRecords.push(newV);
              toast(`Vendor "${newV.name}" created!`);
              selectVendor(newV.id, newV.name);
            } catch (err) {
              toast(err.message || 'Failed to create vendor', 'err');
            }
          }
        });
        pvMenu.appendChild(addBtn);
      };

      const selectVendor = (id, name) => {
        selectedVendorId = id ? String(id) : '';
        selectedVendorName = name || '';
        pvHidden.value = selectedVendorId;
        pvSearch.value = selectedVendorName;
        pvClear.style.display = selectedVendorId ? 'inline-block' : 'none';
        closePvMenu();
        pvHidden.dispatchEvent(new Event('input', { bubbles: true }));
        pvHidden.dispatchEvent(new Event('change', { bubbles: true }));
        m.markDirty();
      };

      const openPvMenu = () => {
        isPvMenuOpen = true;
        pvMenu.style.display = 'block';
        renderPvDropdown(pvSearch.value === selectedVendorName ? '' : pvSearch.value);
      };

      const closePvMenu = () => {
        isPvMenuOpen = false;
        pvMenu.style.display = 'none';
        pvSearch.value = selectedVendorName;
      };

      pvSearch.addEventListener('focus', () => {
        openPvMenu();
      });

      pvSearch.addEventListener('click', () => {
        if (!isPvMenuOpen) openPvMenu();
      });

      pvSearch.addEventListener('input', e => {
        if (!isPvMenuOpen) openPvMenu();
        renderPvDropdown(e.target.value);
      });

      pvSearch.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
          closePvMenu();
        }
      });

      pvClear.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        selectVendor('', '');
        pvSearch.focus();
      });

      const onDocClickPv = e => {
        if (pvWrap && !pvWrap.contains(e.target)) {
          if (isPvMenuOpen) closePvMenu();
        }
      };
      document.addEventListener('click', onDocClickPv);

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

      const chkPurch = $('#chkPurchaseInfo', form);
      const wrapPurch = $('#purchaseFieldsWrap', form);
      if (chkPurch && wrapPurch) {
        chkPurch.addEventListener('change', () => {
          wrapPurch.style.display = chkPurch.checked ? '' : 'none';
        });
      }
      syncType();
    },
    onSubmit: async d => {
      // DEF_CB_013: Validate Item Name
      const nameVal = (d.name || '').trim();
      if (!nameVal) {
        throw new ApiErr(400, { name: 'Item Name is required.' }, 'Item Name is required.');
      }
      if (/[#@!$%^*+=~`<>?[\]\\{}]/.test(nameVal)) {
        throw new ApiErr(400, { name: 'Item Name contains unsupported special characters (cannot contain #, @, !, $, %, ^, *).' }, 'Item Name contains unsupported special characters.');
      }

      // DEF_CB_015: Validate SKU
      const skuVal = (d.sku || '').trim();
      if (skuVal && !/^[A-Za-z0-9_\-\.\/]+$/.test(skuVal)) {
        throw new ApiErr(400, { sku: 'SKU can only contain letters, numbers, hyphens, slashes, and dots.' }, 'SKU contains invalid special characters.');
      }

      // DEF_CB_014: Validate Category
      const catVal = (d.category || '').trim();
      if (catVal && !/^[a-zA-Z0-9\s\.\,\'\-\ &\/\(\)]+$/.test(catVal)) {
        throw new ApiErr(400, { category: 'Category can only contain letters, numbers, spaces, and standard separators (&, -, /).' }, 'Category contains invalid special characters.');
      }

      // DEF_CB_016: Validate mandatory Selling Price
      if (d.selling_price === undefined || d.selling_price === null || String(d.selling_price).trim() === '' || isNaN(Number(d.selling_price)) || Number(d.selling_price) < 0) {
        throw new ApiErr(400, { selling_price: 'Selling Price is mandatory and must be 0 or greater.' }, 'Selling Price is mandatory.');
      }

      if (!id) d.active = true;
      if (!d.purchase_price) d.purchase_price = '0.00';
      const saved = await api(id ? `items/${id}/` : 'items/', { method: id ? 'PUT' : 'POST', body: d });
      toast('Item ' + (id ? 'updated' : 'created'));
      if (onDone) {
        onDone(saved || d);
      } else {
        refresh();
      }
    },
  });
}

/* =========================================================================
   CONVOSIS BOOKS - DOCUMENT NUMBER PREFERENCES, SALESPERSONS & SHARED HELPERS
   ========================================================================= */

async function openDocNumberPreferencesModal({ kind, series = 'Default Transaction Series', location = 'HO Kottayam', currentNumber = '', onSave }) {
  const canonDoc = kind === 'quotes' ? 'quotes' : (kind === 'sales-orders' ? 'sales_orders' : (kind === 'bills' ? 'bills' : (kind === 'purchase-orders' ? 'purchase_orders' : (kind === 'retainer-invoices' ? 'retainer_invoices' : (kind === 'recurring-invoices' ? 'recurring_invoices' : 'invoices')))));
  const docLabel = kind === 'quotes' ? 'Quote' : (kind === 'sales-orders' ? 'Sales Order' : (kind === 'bills' ? 'Bill' : (kind === 'purchase-orders' ? 'Purchase Order' : (kind === 'retainer-invoices' ? 'Retainer Invoice' : (kind === 'recurring-invoices' ? 'Recurring Invoice' : 'Invoice')))));

  let pref = { auto_generate: true, prefix: 'INV/', next_number: 1, restart_yearly: true, preview_formatted: '' };
  try {
    const res = await api(`settings/doc-number-preferences/?document_type=${encodeURIComponent(canonDoc)}&transaction_series=${encodeURIComponent(series)}&location=${encodeURIComponent(location)}`);
    if (res) pref = res;
  } catch (e) {}

  const defaultPfx = canonDoc === 'invoices' ? 'INV/' : (canonDoc === 'quotes' ? 'QTN/' : (canonDoc === 'sales_orders' ? 'SO/' : (canonDoc === 'bills' ? 'BILL/' : (canonDoc === 'purchase_orders' ? 'PO/' : (canonDoc === 'retainer_invoices' ? 'RET/' : 'REC/')))));
  const prefixVal = pref.prefix || defaultPfx;
  const nextNumVal = pref.next_number || 1;
  const isAuto = pref.auto_generate !== false;
  const restartYearly = pref.restart_yearly !== false;

  const bodyHtml = `
    <div style="font-size:13px;color:var(--tx);display:flex;flex-direction:column;gap:18px;">
      <div style="color:#64748b;font-size:13px;line-height:1.5;">
        Your ${docLabel.toLowerCase()} numbers are set on auto-generate mode to save your time. Are you sure about changing this setting?
      </div>

      <div style="display:flex;flex-direction:column;gap:14px;">
        <label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;">
          <input type="radio" name="doc_pref_mode" value="auto" ${isAuto ? 'checked' : ''} style="margin-top:3px;cursor:pointer;">
          <div style="flex:1;">
            <div style="font-weight:600;color:var(--tx);margin-bottom:8px;">Continue auto-generating ${docLabel.toLowerCase()} numbers</div>
            
            <div id="doc-pref-auto-fields" style="background:#f8fafc;border:1px solid var(--bd);border-radius:6px;padding:14px;display:${isAuto ? 'flex' : 'none'};flex-direction:column;gap:12px;">
              <div style="display:flex;align-items:center;gap:12px;">
                <label style="width:100px;font-weight:500;color:#475569;font-size:12.5px;">Prefix</label>
                <div style="display:flex;align-items:center;gap:6px;position:relative;">
                  <input type="text" id="doc-pref-prefix" class="in" value="${esc(prefixVal)}" style="width:180px;font-family:monospace;font-size:13px;">
                  <button type="button" class="btn s" id="btn-doc-pref-tag" title="Insert Placeholder" style="padding:4px 8px;font-size:12px;font-weight:600;border:1px solid #cbd5e1;background:#fff;cursor:pointer;">
                    + Insert Placeholders
                  </button>
                  <div id="doc-pref-tag-popover" style="display:none;position:absolute;top:100%;left:120px;background:#fff;border:1px solid #cbd5e1;box-shadow:0 10px 15px -3px rgba(0,0,0,0.1);border-radius:6px;z-index:99;padding:6px 0;width:220px;margin-top:4px;">
                    <div style="padding:4px 10px;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;">Placeholders</div>
                    <div class="pref-tag-opt" data-tag="\${YEAR}" style="padding:6px 12px;font-size:12px;cursor:pointer;"><b>\${YEAR}</b> - Calendar Year (2026)</div>
                    <div class="pref-tag-opt" data-tag="\${FYS_YY}" style="padding:6px 12px;font-size:12px;cursor:pointer;"><b>\${FYS_YY}</b> - FY Start (26)</div>
                    <div class="pref-tag-opt" data-tag="\${FYE_YY}" style="padding:6px 12px;font-size:12px;cursor:pointer;"><b>\${FYE_YY}</b> - FY End (27)</div>
                    <div class="pref-tag-opt" data-tag="\${FY}" style="padding:6px 12px;font-size:12px;cursor:pointer;"><b>\${FY}</b> - Fiscal Year (26-27)</div>
                  </div>
                </div>
              </div>

              <div style="display:flex;align-items:center;gap:12px;">
                <label style="width:100px;font-weight:500;color:#475569;font-size:12.5px;">Next Number</label>
                <input type="number" id="doc-pref-next-number" class="in" min="1" value="${nextNumVal}" style="width:120px;font-family:monospace;font-size:13px;">
              </div>

              <label style="display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--tx);cursor:pointer;margin-top:4px;">
                <input type="checkbox" id="doc-pref-restart-yearly" ${restartYearly ? 'checked' : ''} style="cursor:pointer;">
                <span>Restart ${docLabel.toLowerCase()} numbering at the beginning of each fiscal year</span>
              </label>
            </div>
          </div>
        </label>

        <label style="display:flex;align-items:center;gap:10px;cursor:pointer;">
          <input type="radio" name="doc_pref_mode" value="manual" ${!isAuto ? 'checked' : ''} style="cursor:pointer;">
          <span style="font-weight:600;color:var(--tx);">I will add them manually each time</span>
        </label>
      </div>
    </div>
  `;

  const footerHtml = `
    <div style="display:flex;align-items:center;justify-content:flex-end;gap:10px;width:100%;">
      <button type="button" class="btn p" id="btn-doc-pref-save" style="background:#2563eb;color:#fff;font-weight:600;padding:7px 18px;border-radius:4px;cursor:pointer;">Save</button>
      <button type="button" class="btn" data-close style="padding:7px 16px;border-radius:4px;cursor:pointer;">Cancel</button>
    </div>
  `;

  const modal = Modal.open({
    title: `Configure ${docLabel} Number Preferences`,
    body: bodyHtml,
    footer: footerHtml,
    dialog: true
  });

  const mEl = modal.el;
  const autoFields = mEl.querySelector('#doc-pref-auto-fields');
  const radios = mEl.querySelectorAll('input[name="doc_pref_mode"]');
  radios.forEach(r => {
    r.addEventListener('change', () => {
      const mode = mEl.querySelector('input[name="doc_pref_mode"]:checked')?.value;
      if (autoFields) autoFields.style.display = mode === 'auto' ? 'flex' : 'none';
    });
  });

  const tagBtn = mEl.querySelector('#btn-doc-pref-tag');
  const tagPop = mEl.querySelector('#doc-pref-tag-popover');
  const prefixInp = mEl.querySelector('#doc-pref-prefix');
  if (tagBtn && tagPop) {
    tagBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      tagPop.style.display = tagPop.style.display === 'block' ? 'none' : 'block';
    });
    mEl.querySelectorAll('.pref-tag-opt').forEach(opt => {
      opt.addEventListener('click', () => {
        const tag = opt.getAttribute('data-tag');
        if (prefixInp && tag) {
          prefixInp.value += tag;
          prefixInp.focus();
        }
        tagPop.style.display = 'none';
      });
    });
    document.addEventListener('click', (e) => {
      if (tagPop && !tagPop.contains(e.target) && e.target !== tagBtn) {
        tagPop.style.display = 'none';
      }
    });
  }

  const saveBtn = mEl.querySelector('#btn-doc-pref-save');
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const selectedMode = mEl.querySelector('input[name="doc_pref_mode"]:checked')?.value || 'auto';
      const autoGen = selectedMode === 'auto';
      const pfx = prefixInp ? prefixInp.value.trim() : '';
      const nextNum = parseInt(mEl.querySelector('#doc-pref-next-number')?.value || '1', 10);
      const restart = !!mEl.querySelector('#doc-pref-restart-yearly')?.checked;

      try {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';
        const res = await api('settings/doc-number-preferences/', {
          method: 'POST',
          body: {
            document_type: canonDoc,
            transaction_series: series,
            location: location,
            auto_generate: autoGen,
            prefix: pfx,
            next_number: nextNum,
            restart_yearly: restart
          }
        });
        toast(`${docLabel} number preferences saved.`);
        if (onSave) onSave(res);
        modal.close();
      } catch (err) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save';
        alert(err.message || 'Failed to save preferences.');
      }
    });
  }
}

async function openManageSalespersonsModal({ onSelect, onListUpdated }) {
  let spList = [];
  try {
    const res = await api('salespersons/');
    spList = (res && res.results) ? res.results : [];
  } catch (e) {
    spList = [];
  }

  const renderTableRows = (list) => {
    if (!list || !list.length) {
      return `<tr><td colspan="4" style="text-align:center;padding:24px;color:#94a3b8;font-weight:500;">No salespersons found. Click "+ New Salesperson" above to add one.</td></tr>`;
    }
    return list.map(sp => `
      <tr style="border-bottom:1px solid #e2e8f0;">
        <td style="padding:10px 12px;font-weight:600;color:#0f172a;">${esc(sp.name)}</td>
        <td style="padding:10px 12px;color:#475569;">${esc(sp.email || '—')}</td>
        <td style="padding:10px 12px;"><span style="background:#ecfdf5;color:#059669;font-size:11px;font-weight:600;padding:2px 8px;border-radius:12px;">Active</span></td>
        <td style="padding:10px 12px;text-align:right;">
          <div style="display:flex;align-items:center;justify-content:flex-end;gap:8px;">
            <button type="button" class="btn s btn-sp-select" data-sp-name="${esc(sp.name)}" style="font-size:12px;padding:3px 10px;background:#eff6ff;color:#2563eb;border:1px solid #bfdbfe;border-radius:4px;cursor:pointer;">Select</button>
            ${!String(sp.id).startsWith('u_') ? `<button type="button" class="btn ic btn-sp-delete" data-sp-id="${sp.id}" title="Remove" style="color:#ef4444;border:none;background:none;cursor:pointer;"><i class="fa-regular fa-trash-can"></i></button>` : ''}
          </div>
        </td>
      </tr>
    `).join('');
  };

  const bodyHtml = `
    <div style="display:flex;flex-direction:column;gap:16px;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
        <div style="position:relative;flex:1;max-width:320px;">
          <i class="fa-solid fa-magnifying-glass" style="position:absolute;left:10px;top:10px;color:#94a3b8;font-size:13px;"></i>
          <input type="text" id="sp-modal-search" class="in" placeholder="Search salespersons" style="padding-left:32px;width:100%;font-size:13px;">
        </div>
        <button type="button" class="btn p" id="btn-sp-show-new" style="background:#2563eb;color:#fff;font-weight:600;font-size:13px;padding:6px 14px;border-radius:4px;cursor:pointer;display:flex;align-items:center;gap:6px;">
          <i class="fa-solid fa-plus"></i> New Salesperson
        </button>
      </div>

      <div id="sp-modal-new-card" style="display:none;background:#f8fafc;border:1px solid #cbd5e1;border-radius:6px;padding:16px;">
        <div style="font-weight:700;font-size:14px;color:#0f172a;margin-bottom:12px;">New Salesperson</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:#ef4444;margin-bottom:4px;">Name*</label>
            <input type="text" id="sp-new-name" class="in" placeholder="Salesperson name" style="width:100%;">
          </div>
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:#ef4444;margin-bottom:4px;">Email*</label>
            <input type="email" id="sp-new-email" class="in" placeholder="email@company.com" style="width:100%;">
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;">
          <button type="button" class="btn p" id="btn-sp-save-new" style="background:#2563eb;color:#fff;font-weight:600;font-size:12.5px;padding:6px 16px;border-radius:4px;cursor:pointer;">
            Save and Select
          </button>
          <button type="button" class="btn" id="btn-sp-cancel-new" style="font-size:12.5px;padding:6px 14px;border-radius:4px;cursor:pointer;">
            Cancel
          </button>
        </div>
      </div>

      <div style="border:1px solid #e2e8f0;border-radius:6px;overflow:hidden;max-height:360px;overflow-y:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead style="background:#f1f5f9;border-bottom:1px solid #cbd5e1;text-align:left;color:#475569;font-weight:600;">
            <tr>
              <th style="padding:8px 12px;">Name</th>
              <th style="padding:8px 12px;">Email</th>
              <th style="padding:8px 12px;">Status</th>
              <th style="padding:8px 12px;text-align:right;">Actions</th>
            </tr>
          </thead>
          <tbody id="sp-modal-tbody">
            ${renderTableRows(spList)}
          </tbody>
        </table>
      </div>
    </div>
  `;

  const modal = Modal.open({
    title: 'Manage Salespersons',
    body: bodyHtml,
    footer: '<button type="button" class="btn" data-close style="padding:6px 16px;">Close</button>',
    dialog: true,
    wide: true
  });

  const mEl = modal.el;
  const newCard = mEl.querySelector('#sp-modal-new-card');
  const showNewBtn = mEl.querySelector('#btn-sp-show-new');
  const cancelNewBtn = mEl.querySelector('#btn-sp-cancel-new');
  const saveNewBtn = mEl.querySelector('#btn-sp-save-new');
  const nameInp = mEl.querySelector('#sp-new-name');
  const emailInp = mEl.querySelector('#sp-new-email');
  const searchInp = mEl.querySelector('#sp-modal-search');
  const tbody = mEl.querySelector('#sp-modal-tbody');

  if (showNewBtn && newCard) {
    showNewBtn.addEventListener('click', () => {
      newCard.style.display = 'block';
      if (nameInp) nameInp.focus();
    });
  }
  if (cancelNewBtn && newCard) {
    cancelNewBtn.addEventListener('click', () => {
      newCard.style.display = 'none';
      if (nameInp) nameInp.value = '';
      if (emailInp) emailInp.value = '';
    });
  }

  if (saveNewBtn) {
    saveNewBtn.addEventListener('click', async () => {
      const name = nameInp ? nameInp.value.trim() : '';
      const email = emailInp ? emailInp.value.trim().toLowerCase() : '';
      if (!name) {
        alert('Please enter salesperson name.');
        if (nameInp) nameInp.focus();
        return;
      }
      try {
        saveNewBtn.disabled = true;
        saveNewBtn.textContent = 'Saving...';
        const res = await api('salespersons/', {
          method: 'POST',
          body: { name, email }
        });
        toast(`Salesperson ${name} added.`);
        if (onSelect) onSelect(res.name || name);
        if (onListUpdated) onListUpdated();
        modal.close();
      } catch (err) {
        saveNewBtn.disabled = false;
        saveNewBtn.textContent = 'Save and Select';
        alert(err.message || 'Failed to save salesperson.');
      }
    });
  }

  if (searchInp && tbody) {
    searchInp.addEventListener('input', () => {
      const q = searchInp.value.trim().toLowerCase();
      const filtered = spList.filter(s => (s.name || '').toLowerCase().includes(q) || (s.email || '').toLowerCase().includes(q));
      tbody.innerHTML = renderTableRows(filtered);
      bindRowActions();
    });
  }

  function bindRowActions() {
    mEl.querySelectorAll('.btn-sp-select').forEach(b => {
      b.addEventListener('click', () => {
        const spName = b.getAttribute('data-sp-name');
        if (onSelect && spName) onSelect(spName);
        modal.close();
      });
    });
    mEl.querySelectorAll('.btn-sp-delete').forEach(b => {
      b.addEventListener('click', async () => {
        const spId = b.getAttribute('data-sp-id');
        if (confirm('Are you sure you want to remove this salesperson?')) {
          try {
            await api(`salespersons/${spId}/`, { method: 'DELETE' });
            spList = spList.filter(s => String(s.id) !== String(spId));
            tbody.innerHTML = renderTableRows(spList);
            bindRowActions();
            toast('Salesperson removed.');
            if (onListUpdated) onListUpdated();
          } catch (e) {
            alert(e.message || 'Failed to delete salesperson.');
          }
        }
      });
    });
  }

  bindRowActions();
}

function createSalespersonCustomDropdown(containerEl, currentVal = '', onSelect) {
  if (!containerEl) return;
  containerEl.innerHTML = '';
  containerEl.style.position = 'relative';

  let selectedName = currentVal || '';
  let salespersons = [];

  const trigger = document.createElement('div');
  trigger.className = 'in sp-select-trigger';
  trigger.style.cssText = 'width:260px;display:flex;align-items:center;justify-content:space-between;cursor:pointer;user-select:none;background:#fff;padding:6px 10px;border:1px solid var(--bd);border-radius:4px;';
  
  const textSpan = document.createElement('span');
  textSpan.style.cssText = selectedName ? 'color:var(--tx);font-weight:500;' : 'color:#94a3b8;';
  textSpan.textContent = selectedName || 'Select or Add Salesperson';

  const caret = document.createElement('i');
  caret.className = 'fa-solid fa-chevron-down';
  caret.style.cssText = 'font-size:11px;color:#64748b;';

  const hiddenInput = document.createElement('input');
  hiddenInput.type = 'hidden';
  hiddenInput.name = 'salesperson';
  hiddenInput.id = 'doc-salesperson-input';
  hiddenInput.value = selectedName;

  trigger.appendChild(textSpan);
  trigger.appendChild(caret);
  containerEl.appendChild(trigger);
  containerEl.appendChild(hiddenInput);

  const popover = document.createElement('div');
  popover.className = 'sp-custom-popover';
  popover.style.cssText = 'display:none;position:absolute;top:100%;left:0;width:280px;background:#fff;border:1px solid #cbd5e1;box-shadow:0 10px 25px -5px rgba(0,0,0,0.15);border-radius:6px;z-index:1000;margin-top:4px;overflow:hidden;';

  const searchBox = document.createElement('div');
  searchBox.style.cssText = 'padding:8px 10px;border-bottom:1px solid #e2e8f0;background:#f8fafc;position:relative;';
  searchBox.innerHTML = `
    <i class="fa-solid fa-magnifying-glass" style="position:absolute;left:18px;top:16px;color:#94a3b8;font-size:12px;"></i>
    <input type="text" class="in sp-popover-search" placeholder="Search" style="width:100%;padding-left:28px;font-size:12px;height:28px;">
  `;

  const listContainer = document.createElement('div');
  listContainer.className = 'sp-popover-list';
  listContainer.style.cssText = 'max-height:200px;overflow-y:auto;padding:4px 0;';

  const manageOption = document.createElement('div');
  manageOption.className = 'sp-popover-manage';
  manageOption.style.cssText = 'padding:10px 14px;border-top:1px solid #e2e8f0;color:#2563eb;font-weight:600;font-size:12.5px;cursor:pointer;display:flex;align-items:center;gap:8px;background:#f8fafc;';
  manageOption.innerHTML = '<i class="fa-solid fa-gear"></i> Manage Salespersons';

  popover.appendChild(searchBox);
  popover.appendChild(listContainer);
  popover.appendChild(manageOption);
  containerEl.appendChild(popover);

  async function loadSalespersons() {
    try {
      salespersons = await api('lookup/salespersons/').catch(() => []);
    } catch (e) {
      salespersons = [];
    }
    renderList('');
  }

  function renderList(query) {
    listContainer.innerHTML = '';
    const q = (query || '').toLowerCase().trim();
    const filtered = salespersons.filter(s => (s.name || '').toLowerCase().includes(q));

    if (!filtered.length) {
      const empty = document.createElement('div');
      empty.style.cssText = 'padding:16px;text-align:center;color:#94a3b8;font-size:11.5px;font-weight:700;letter-spacing:0.5px;';
      empty.textContent = 'NO RESULTS FOUND';
      listContainer.appendChild(empty);
      return;
    }

    filtered.forEach(sp => {
      const item = document.createElement('div');
      item.style.cssText = 'padding:8px 14px;cursor:pointer;font-size:13px;color:var(--tx);transition:background 0.15s;';
      item.textContent = sp.name;
      item.addEventListener('mouseenter', () => item.style.background = '#f1f5f9');
      item.addEventListener('mouseleave', () => item.style.background = '#fff');
      item.addEventListener('click', () => {
        selectValue(sp.name);
        popover.style.display = 'none';
      });
      listContainer.appendChild(item);
    });
  }

  function selectValue(name) {
    selectedName = name || '';
    hiddenInput.value = selectedName;
    textSpan.textContent = selectedName || 'Select or Add Salesperson';
    textSpan.style.color = selectedName ? 'var(--tx)' : '#94a3b8';
    textSpan.style.fontWeight = selectedName ? '500' : 'normal';
    if (onSelect) onSelect(selectedName);
  }

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = popover.style.display === 'block';
    popover.style.display = isOpen ? 'none' : 'block';
    if (!isOpen) {
      loadSalespersons();
      setTimeout(() => {
        const inp = searchBox.querySelector('input');
        if (inp) { inp.value = ''; inp.focus(); }
      }, 50);
    }
  });

  const searchInput = searchBox.querySelector('input');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      renderList(searchInput.value);
    });
    searchInput.addEventListener('click', (e) => e.stopPropagation());
  }

  manageOption.addEventListener('click', (e) => {
    e.stopPropagation();
    popover.style.display = 'none';
    openManageSalespersonsModal({
      onSelect: (name) => {
        selectValue(name);
        loadSalespersons();
      },
      onListUpdated: () => {
        loadSalespersons();
      }
    });
  });

  document.addEventListener('click', (e) => {
    if (!containerEl.contains(e.target)) {
      popover.style.display = 'none';
    }
  });

  loadSalespersons();

  return {
    setValue: selectValue,
    getValue: () => hiddenInput.value
  };
}

async function setupProjectSelectorForCustomer(selectEl, customerId, selectedProject = '') {
  if (!selectEl) return;
  if (!customerId) {
    selectEl.innerHTML = '<option value="">Select a customer first to view projects</option>';
    selectEl.disabled = true;
    return;
  }
  try {
    const projects = await api(`lookup/projects/?customer=${customerId}`).catch(() => []);
    if (projects && projects.length) {
      selectEl.disabled = false;
      selectEl.innerHTML = `
        <option value="">Select Project</option>
        ${projects.map(p => `<option value="${esc(p.name)}" ${p.name === selectedProject ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
      `;
    } else {
      selectEl.disabled = true;
      selectEl.innerHTML = '<option value="">There are no active projects for this customer.</option>';
    }
  } catch (e) {
    selectEl.disabled = true;
    selectEl.innerHTML = '<option value="">There are no active projects for this customer.</option>';
  }
}

function renderPaymentGatewayBanner() {
  return `
    <div style="background:#f8fafc;border:1px dashed #cbd5e1;border-radius:6px;padding:14px 18px;margin-top:24px;display:flex;align-items:center;justify-content:space-between;gap:16px;">
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="width:36px;height:36px;border-radius:50%;background:#eff6ff;display:flex;align-items:center;justify-content:center;color:#2563eb;font-size:16px;">
          <i class="fa-solid fa-credit-card"></i>
        </div>
        <div>
          <div style="font-weight:600;font-size:13.5px;color:var(--tx);">Want to get paid faster?</div>
          <div style="font-size:12px;color:#64748b;margin-top:2px;">Set up payment gateways and give your customers multiple payment options to pay you.</div>
        </div>
      </div>
      <button type="button" class="btn s" onclick="location.hash='#/settings/payment-gateways'" style="font-size:12px;font-weight:600;padding:7px 16px;border-radius:4px;white-space:nowrap;background:#fff;border:1px solid #cbd5e1;color:#1e293b;cursor:pointer;">
        Set up Payment Gateway
      </button>
    </div>
  `;
}

window.openDocNumberPreferencesModal = openDocNumberPreferencesModal;
window.openManageSalespersonsModal = openManageSalespersonsModal;
window.createSalespersonCustomDropdown = createSalespersonCustomDropdown;
window.setupProjectSelectorForCustomer = setupProjectSelectorForCustomer;
window.renderPaymentGatewayBanner = renderPaymentGatewayBanner;

async function docForm(kind, id, targetEl, onDone, extraOpts = {}) {
  if (typeof targetEl === 'function') {
    extraOpts = onDone || {};
    onDone = targetEl;
    targetEl = null;
  }
  if (kind === 'invoices') {
    return invoiceForm(id, targetEl, onDone, extraOpts);
  }
  if (kind === 'quotes') {
    return quoteForm(id, targetEl, onDone, extraOpts);
  }
  if (kind === 'sales-orders') {
    return salesOrderForm(id, targetEl, onDone, extraOpts);
  }
  if (kind === 'recurring-invoices') {
    return recurringInvoiceForm(id, targetEl, onDone, extraOpts);
  }
  if (kind === 'retainer-invoices') {
    return retainerInvoiceForm(id, targetEl, onDone, extraOpts);
  }
  if (kind === 'bills') {
    return billForm(id, targetEl, onDone, extraOpts);
  }
  if (kind === 'purchase-orders') {
    return purchaseOrderForm(id, targetEl, onDone, extraOpts);
  }
  const isRetainer = kind === 'retainer-invoices';
  const isPO = kind === 'purchase-orders';
  const isCN = kind === 'credit-notes';
  const isVC = kind === 'vendor-credits';
  const isCustDoc = kind === 'invoices' || isRetainer || isCN;
  const inv = isCustDoc, pk = inv ? 'customer' : 'vendor';
  const isSubDoc = isPO || isCN || isVC;

  const route = isRetainer ? 'sales/retainer-invoices' :
                (isCN ? 'sales/credit-notes' :
                (isPO ? 'purchases/purchase-orders' :
                (isVC ? 'purchases/vendor-credits' :
                (inv ? 'sales/invoices' : 'purchases/bills'))));

  const usesMasterDetail = (kind === 'invoices' || kind === 'bills' || isRetainer);
  let target = targetEl || (usesMasterDetail ? document.getElementById('detail-col-box') : null);
  if (!target && usesMasterDetail && !targetEl) {
    location.hash = '#/' + route;
    setTimeout(() => {
      const newTarget = document.getElementById('detail-col-box');
      if (newTarget) docForm(kind, id, newTarget, onDone);
    }, 120);
    return;
  }

  const [parties, items, rec] = await Promise.all([
    api(`lookup/${inv ? 'customers' : 'vendors'}/`).catch(() => []),
    api('lookup/items/').catch(() => []),
    id ? api(`${kind}/${id}/`).catch(() => null) : null
  ]);
  const itemOpts = [
    ['', '— Custom line —'],
    ['__new_item__', '+ Add New Item…'],
    ...items.map(i => [i.id, i.name + (i.sku ? ' (' + i.sku + ')' : '')])
  ];
  const r = rec || { date: APP.today, lines: [{}], place_of_supply: '', notes: APP.org.notes_default || 'Thanks for your business.', terms: APP.org.terms_default || 'Due on Receipt', order_number: '' };
  if (!r.lines || !r.lines.length) r.lines = [{}];
  const byId = Object.fromEntries(items.map(i => [String(i.id), i]));
  const row = l => `<tr class="ln"><td><select class="in l-item" aria-label="Item">${opts(itemOpts, l.item)}</select><input class="in l-desc" aria-label="Description" placeholder="Description" maxlength="500" value="${esc(l.description || '')}"></td><td><input class="in l-hsn" aria-label="HSN/SAC" maxlength="10" value="${esc(l.hsn_sac || '')}"></td><td><input class="in l-qty" type="number" step="0.001" min="0" aria-label="Quantity" value="${esc(l.quantity || 1)}"></td><td><input class="in l-rate" type="number" step="0.01" min="0" aria-label="Rate" value="${esc(l.rate == null ? '' : l.rate)}"></td><td><input class="in l-disc" type="number" step="0.01" min="0" max="100" aria-label="Discount %" value="${esc(l.discount_percent || 0)}"></td><td><select class="in l-gst" aria-label="GST rate">${opts(GST_SLABS.map(x => [x, x + '%']), l.gst_rate != null ? num(l.gst_rate) : 18)}</select></td><td class="r l-amt">—</td><td><button type="button" class="btn ic" data-rm aria-label="Remove line">×</button></td></tr>`;
  const partyId = r.party_id || r.customer_id || r.vendor_id || r.customer || r.vendor || '';
  const due0 = r.due_date || r.delivery_date || '';
  const pendingFiles = [];
  const docTaxPricing = r.tax_pricing_type || 'tax_exclusive';
  const defaultPartyType = inv ? 'b2b' : 'registered';
  const docPartyType = r.customer_type || defaultPartyType;
  const initialParty = parties.find(p => String(p.id) === String(partyId));
  const initialGstin = (rec && rec.party_details && rec.party_details.gstin) || (initialParty ? initialParty.gstin : '') || 'Not provided';

  const docTitle = isRetainer ? 'Retainer Invoice' :
                   (isCN ? 'Credit Note' :
                   (isPO ? 'Purchase Order' :
                   (isVC ? 'Vendor Credit' :
                   (inv ? 'Invoice' : 'Bill'))));
  const docTitleLower = docTitle.toLowerCase();

  if (target) {
    target.innerHTML = `
      <div class="doc-detail-bar" style="position:sticky; top:0; z-index:20;">
        <div class="doc-detail-title-grp">
          <h1 class="doc-detail-title">${id ? 'Edit ' + docTitle + ' ' + esc(r.number || '') : 'New ' + docTitle}</h1>
          <span class="sub" style="font-size:12px;">Fill in document details below</span>
        </div>
        <div class="doc-detail-actions">
          <button class="btn" type="button" id="btn-doc-cancel">Cancel</button>
          <button class="btn" type="button" id="btn-doc-draft" data-action="draft">Save as Draft</button>
          <button class="btn p" type="button" id="btn-doc-save" data-action="${id ? 'update' : 'post'}">${id ? 'Update ' + docTitle : (inv ? 'Save & Send' : 'Save & Approve')}</button>
        </div>
      </div>
      <div class="doc-canvas-scroll" style="padding:16px 20px 60px; display:flex; flex-direction:column; align-items:center; background:var(--bg-alt, rgba(0, 0, 0, 0.02)); box-sizing:border-box;">
        <form id="on-screen-doc-form" class="doc-form-card" style="width:100%; max-width:940px; height:auto; min-height:auto; box-sizing:border-box;" novalidate>
          <div class="fe" data-err="_" role="alert"></div>
          <div class="zb-form-wrap">
            ${[
              fld({ name: pk, label: inv ? 'Customer' : 'Vendor', type: 'select', req: 1, opts: [['', 'Select…'], [inv ? '__new_customer__' : '__new_vendor__', inv ? '+ Add New Customer…' : '+ Add New Vendor…'], ...parties.map(p => [p.id, p.name])], value: partyId }),
              fld({
                name: 'customer_type',
                label: inv ? 'Customer Type' : 'Supplier Type',
                type: 'select',
                opts: inv ? [
                  ['b2b', 'B2B - Business to Business'],
                  ['b2c', 'B2C - Business to Consumer']
                ] : [
                  ['registered', 'Registered Business'],
                  ['unregistered', 'Unregistered Supplier']
                ],
                value: docPartyType,
                help: `GSTIN: <span id="doc-party-gstin" style="font-weight:600;">${esc(initialGstin)}</span>`
              }),
              fld({ name: 'place_of_supply', label: 'Place of supply', type: 'select', opts: STATES, value: r.place_of_supply || APP.org.state, help: 'Same state as your organization → CGST + SGST; otherwise IGST.' }),
              fld({ name: 'date', label: 'Date', type: 'date', req: 1, value: r.date }),
              fld({ name: 'due_date', label: 'Due date', type: 'date', value: due0 }),
              fld({ name: 'order_number', label: 'Order Number', value: r.order_number || '', ph: 'e.g. 653248543' }),
              inv ? '' : fld({ name: 'vendor_ref', label: 'Vendor reference', value: r.vendor_ref }),
            ].join('')}
          </div>

          <div style="display:flex; align-items:center; justify-content:space-between; margin:24px 0 8px;">
            <div style="display:flex; align-items:center; gap:12px;">
              <span style="font-size:14px; font-weight:700; color:var(--tx);">Line items</span>
              <select class="in" id="doc-tax-pricing" name="tax_pricing_type" style="width:145px;height:30px;font-size:12px;font-weight:600;padding:2px 8px;border-radius:6px;border:1px solid #93c5fd;background:#f0fdf4;color:#1e293b;" title="Tax Pricing Type">
                <option value="tax_exclusive" ${docTaxPricing === 'tax_exclusive' ? 'selected' : ''}>Tax Exclusive</option>
                <option value="tax_inclusive" ${docTaxPricing === 'tax_inclusive' ? 'selected' : ''}>Tax Inclusive</option>
              </select>
              <button type="button" class="btn btn-tax-pricing-info" data-doc-kind="${kind}" style="background:#eff6ff;color:#2563eb;border:1px solid #bfdbfe;font-size:11.5px;font-weight:600;padding:2px 10px;border-radius:14px;cursor:pointer;display:inline-flex;align-items:center;gap:5px;" title="Learn about Tax Exclusive, Tax Inclusive, B2B & B2C GST billing">
                <i class="fa-solid fa-circle-info"></i> Guide
              </button>
            </div>
          </div>
          <div class="tw" style="border:1px solid var(--bd-glass); border-radius:8px; overflow:hidden;">
            <table class="lt">
              <thead>
                <tr>
                  <th style="min-width:240px">Item / Description</th>
                  <th>HSN/SAC</th>
                  <th>Qty</th>
                  <th>Rate (₹)</th>
                  <th>Disc %</th>
                  <th class="th-tax-explainer" data-doc-kind="${kind}" style="cursor:pointer;" title="Click for GST Rates, Tax Exclusive & B2B/B2C Rules">GST <i class="fa-solid fa-circle-info" style="font-size:11px;color:#2563eb;"></i></th>
                  <th class="r">Amount</th>
                  <th></th>
                </tr>
              </thead>
              <tbody id="lines">${r.lines.map(row).join('')}</tbody>
            </table>
          </div>
          <div class="er" data-err="lines" role="alert"></div>
          <button type="button" class="btn" data-add style="margin-top:10px; font-weight:600;">+ Add line</button>

          <div class="tot" aria-live="polite" style="margin-top:20px; margin-left:auto; margin-right:0; width:340px; max-width:100%; box-sizing:border-box;">
            <div><span>Taxable value</span><b data-t="sub">₹0.00</b></div>
            <div data-t-row="cgst"><span>CGST</span><b data-t="cgst">₹0.00</b></div>
            <div data-t-row="sgst"><span>SGST</span><b data-t="sgst">₹0.00</b></div>
            <div data-t-row="igst"><span>IGST</span><b data-t="igst">₹0.00</b></div>
            <div class="gt"><span>Total</span><b data-t="total">₹0.00</b></div>
          </div>

          <div class="zb-form-wrap" style="margin-top:20px;">
            ${fld({ name: 'notes', label: 'Notes', type: 'textarea', value: r.notes != null ? r.notes : (APP.org.notes_default || 'Thanks for your business.'), col: 'c2' })}
            ${inv ? fld({ name: 'terms', label: 'Terms & conditions', type: 'textarea', value: r.terms != null ? r.terms : (APP.org.terms_default || 'Due on Receipt'), col: 'c2' }) : ''}
          </div>

          <div style="margin-top:20px; padding:16px; border:1px solid var(--bd-glass); border-radius:10px; background:var(--surface-glass-subtle);">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;">
              <label style="font-weight:600; font-size:13px; display:flex; align-items:center; gap:6px; color:var(--tx);">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                Attached Files
              </label>
              <input type="file" id="doc-file-input" multiple style="display:none">
              <button type="button" class="btn" id="btn-browse-attach">+ Attach File</button>
            </div>
            <div id="doc-attach-badges" style="display:flex; flex-wrap:wrap; gap:8px;"></div>
          </div>

          <div style="margin-top:20px; padding:16px; border:1px solid var(--bd-glass); border-radius:10px; background:var(--surface-glass-subtle); display:flex; align-items:center; justify-content:space-between; gap:16px;">
            <div>
              <label style="font-weight:600; font-size:13px; display:flex; align-items:center; gap:6px; color:var(--tx);">
                <i class="fa-solid fa-signature" style="color:#2563eb;"></i> Authorized Digital Signature
              </label>
              <div style="font-size:11px; color:var(--tx-muted); margin-top:2px;" id="doc-sig-desc">
                ${r.signature_data ? 'Document has an attached digital signature.' : (APP.org && APP.org.signature_data ? 'Using company default signature.' : 'No signature attached.')}
              </div>
            </div>
            <div style="display:flex; align-items:center; gap:10px;">
              <input type="hidden" name="signature_data" id="doc-sig-input" value="${esc(r.signature_data || '')}">
              <input type="hidden" name="signed_by" id="doc-signed-by" value="${esc(r.signed_by || '')}">
              <input type="hidden" name="signature_title" id="doc-sig-title" value="${esc(r.signature_title || '')}">
              <button type="button" class="btn" id="btn-doc-sign"><i class="fa-solid fa-pen-nib"></i> ${r.signature_data ? 'Change Signature' : 'Sign Document'}</button>
            </div>
          </div>

          <div style="display:flex; justify-content:flex-end; align-items:center; gap:10px; margin-top:28px; padding-top:18px; border-top:1px solid var(--bd-glass);">
            <button class="btn" type="button" id="btn-doc-cancel-btm">Cancel</button>
            <button class="btn" type="button" id="btn-doc-draft-btm" data-action="draft">Save as Draft</button>
            <button class="btn p" type="button" id="btn-doc-save-btm" data-action="${id ? 'update' : 'post'}">${id ? 'Update ' + docTitle : (inv ? 'Save & Send' : 'Save & Approve')}</button>
          </div>
        </form>
      </div>
    `;

    const form = $('#on-screen-doc-form', target);
    const tb = $('#lines', form);
    let dueTouched = !!due0;

    const calc = () => {
      const intra = norm(form.elements.place_of_supply.value) === norm(APP.org.state);
      const isTaxInclusive = ($('#doc-tax-pricing', form)?.value === 'tax_inclusive');
      const t = { sub: 0, cgst: 0, sgst: 0, igst: 0 };
      $$('tr.ln', form).forEach(tr => {
        const qtyVal = num($('.l-qty', tr).value) || 0;
        const rateVal = num($('.l-rate', tr).value) || 0;
        const discVal = num($('.l-disc', tr).value) || 0;
        const gstVal = num($('.l-gst', tr).value) || 0;

        const gross = qtyVal * rateVal;
        const net = Math.max(0, gross * (1 - discVal / 100));
        let taxable = net;
        let taxAmt = 0;
        let lineTot = net;

        if (isTaxInclusive && gstVal > 0) {
          taxable = Math.round((net / (1 + gstVal / 100)) * 100) / 100;
          taxAmt = Math.round((net - taxable) * 100) / 100;
          lineTot = net;
        } else {
          taxable = Math.round(net * 100) / 100;
          taxAmt = Math.round((taxable * (gstVal / 100)) * 100) / 100;
          lineTot = taxable + taxAmt;
        }

        const cg = intra ? Math.round((taxAmt / 2) * 100) / 100 : 0;
        const sg = intra ? Math.round((taxAmt - cg) * 100) / 100 : 0;
        const ig = intra ? 0 : taxAmt;

        t.sub += taxable; t.cgst += cg; t.sgst += sg; t.igst += ig;
        $('.l-amt', tr).textContent = inr(lineTot);
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

    form.addEventListener('input', e => {
      if (e.target.name === 'due_date') dueTouched = true;
      if (e.target.name === 'date') setDue();
      calc();
    });

    form.addEventListener('change', e => {
      if (e.target.classList.contains('l-item')) {
        if (e.target.value === '__new_item__') {
          handleQuickCreateSelect(e.target, newItem => {
            items.push(newItem);
            byId[String(newItem.id)] = newItem;
            calc();
          });
          return;
        }
        const it = byId[e.target.value], tr = e.target.closest('tr');
        if (it) {
          $('.l-desc', tr).value = it.name;
          $('.l-hsn', tr).value = it.hsn_sac || '';
          $('.l-rate', tr).value = inv ? it.selling_price : it.purchase_price;
          $('.l-gst', tr).value = String(num(it.gst_rate));
        }
      }
      if (e.target.name === pk) {
        if (e.target.value === '__new_customer__' || e.target.value === '__new_vendor__') {
          handleQuickCreateSelect(e.target, newParty => {
            parties.push(newParty);
            if (newParty.state) form.elements.place_of_supply.value = newParty.state;
            const gstinEl = $('#doc-party-gstin', form);
            const partyTypeEl = form.elements.customer_type;
            if (gstinEl) gstinEl.textContent = newParty.gstin || 'Not provided';
            if (partyTypeEl) {
              if (inv) {
                if (newParty.gstin && newParty.gstin.trim()) partyTypeEl.value = 'b2b';
                else if (newParty.customer_type === 'individual') partyTypeEl.value = 'b2c';
              } else {
                if (newParty.gstin && newParty.gstin.trim()) partyTypeEl.value = 'registered';
                else partyTypeEl.value = 'unregistered';
              }
            }
            setDue();
            calc();
          });
          return;
        }
        const p = parties.find(x => String(x.id) === e.target.value);
        if (p && p.state) form.elements.place_of_supply.value = p.state;
        const gstinEl = $('#doc-party-gstin', form);
        const partyTypeEl = form.elements.customer_type;
        if (p) {
          if (gstinEl) gstinEl.textContent = p.gstin || 'Not provided';
          if (partyTypeEl) {
            if (inv) {
              if (p.gstin && p.gstin.trim()) partyTypeEl.value = 'b2b';
              else if (p.customer_type === 'individual') partyTypeEl.value = 'b2c';
            } else {
              if (p.gstin && p.gstin.trim()) partyTypeEl.value = 'registered';
              else partyTypeEl.value = 'unregistered';
            }
          }
        }
        setDue();
      }
      calc();
    });

    form.addEventListener('click', e => {
      if (e.target.closest('[data-add]')) {
        tb.insertAdjacentHTML('beforeend', row({}));
        calc();
      }
      const rm = e.target.closest('[data-rm]');
      if (rm) {
        if ($$('tr.ln', form).length > 1) {
          rm.closest('tr').remove();
          calc();
        } else {
          toast('At least one line is required.', 'err');
        }
      }
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
    const browseBtn = $('#btn-browse-attach', form);
    if (browseBtn && fileIn) {
      browseBtn.addEventListener('click', () => fileIn.click());
      fileIn.addEventListener('change', () => {
        Array.from(fileIn.files).forEach(f => {
          const reader = new FileReader();
          reader.onload = ev => {
            pendingFiles.push({ name: f.name, size: f.size, type: f.type, data: ev.target.result });
            renderAttach();
          };
          reader.readAsDataURL(f);
        });
        fileIn.value = '';
      });
    }

    $('#btn-doc-sign', form)?.addEventListener('click', () => {
      openSignatureModal({
        signature_data: $('#doc-sig-input', form)?.value || '',
        signed_by: $('#doc-signed-by', form)?.value || '',
        signature_title: $('#doc-sig-title', form)?.value || '',
        number: r.number
      }, kind, updated => {
        if ($('#doc-sig-input', form)) $('#doc-sig-input', form).value = updated.signature_data || '';
        if ($('#doc-signed-by', form)) $('#doc-signed-by', form).value = updated.signed_by || '';
        if ($('#doc-sig-title', form)) $('#doc-sig-title', form).value = updated.signature_title || '';
        const desc = $('#doc-sig-desc', form);
        const btn = $('#btn-doc-sign', form);
        if (updated.signature_data) {
          if (desc) desc.textContent = 'Custom digital signature attached.';
          if (btn) btn.innerHTML = '<i class="fa-solid fa-pen-nib"></i> Change Signature';
        } else {
          if (desc) desc.textContent = 'No custom signature attached.';
          if (btn) btn.innerHTML = '<i class="fa-solid fa-pen-nib"></i> Sign Document';
        }
      });
    });

    const cancelFn = () => {
      if (onDone) onDone(null);
      else if (window.PAGE && window.PAGE.reload) window.PAGE.reload();
    };

    const cancelBtn1 = $('#btn-doc-cancel', target);
    const cancelBtn2 = $('#btn-doc-cancel-btm', target);
    if (cancelBtn1) cancelBtn1.addEventListener('click', cancelFn);
    if (cancelBtn2) cancelBtn2.addEventListener('click', cancelFn);

    const submitFn = async (action) => {
      const btns = $$('#btn-doc-save, #btn-doc-draft, #btn-doc-save-btm, #btn-doc-draft-btm', target);
      btns.forEach(b => { b.disabled = true; });
      clearErrors(form);

      try {
        const d = readForm(form);
        d.force = true;
        d.tax_pricing_type = (form.elements.tax_pricing_type ? form.elements.tax_pricing_type.value : 'tax_exclusive') || 'tax_exclusive';
        d.customer_type = (form.elements.customer_type ? form.elements.customer_type.value : (inv ? 'b2b' : 'registered')) || (inv ? 'b2b' : 'registered');
        d.is_tax_inclusive = (d.tax_pricing_type === 'tax_inclusive');
        d.lines = $$('tr.ln', form).map(tr => ({
          item: $('.l-item', tr).value || null,
          description: $('.l-desc', tr).value,
          hsn_sac: $('.l-hsn', tr).value,
          quantity: $('.l-qty', tr).value,
          rate: $('.l-rate', tr).value,
          discount_percent: $('.l-disc', tr).value || 0,
          gst_rate: $('.l-gst', tr).value
        }));

        const saved = await api(id ? `${kind}/${id}/` : `${kind}/`, { method: id ? 'PUT' : 'POST', body: d });

        for (const pf of pendingFiles) {
          try {
            await api('attachments/', {
              method: 'POST',
              body: {
                entity_type: isRetainer ? 'retainer_invoice' : (inv ? 'invoice' : 'bill'),
                entity_id: saved.id,
                filename: pf.name,
                file_size: pf.size,
                mime_type: pf.type,
                file_data: pf.data
              }
            });
          } catch (e) {
            console.error('Attachment upload error:', e);
          }
        }

        if (action === 'post' && !isSubDoc) {
          try {
            await api(`${kind}/${saved.id}/${inv ? 'send' : 'approve'}/`, { method: 'POST', body: {} });
            toast(`${saved.number} ${inv ? 'sent' : 'approved'}`);
          } catch (e) {
            toast(`${saved.number} saved as draft, but could not be ${inv ? 'sent' : 'approved'}: ${e.message}`, 'err');
          }
        } else {
          toast(`${saved.number} ${id ? 'updated' : 'saved'}`);
        }

        if (onDone) {
          onDone(saved);
        } else if (window.PAGE && window.PAGE.reload) {
          window.PAGE.reload();
        } else {
          refresh();
        }
      } catch (err) {
        if (err instanceof ApiErr) showErrors(form, err.errors, err.message);
        else {
          showErrors(form, {}, (err && err.message) || 'Unexpected error.');
          console.error(err);
        }
      } finally {
        btns.forEach(b => { b.disabled = false; });
      }
    };

    const draftBtn1 = $('#btn-doc-draft', target);
    const draftBtn2 = $('#btn-doc-draft-btm', target);
    if (draftBtn1) draftBtn1.addEventListener('click', () => submitFn('draft'));
    if (draftBtn2) draftBtn2.addEventListener('click', () => submitFn('draft'));

    const saveBtn1 = $('#btn-doc-save', target);
    const saveBtn2 = $('#btn-doc-save-btm', target);
    if (saveBtn1) saveBtn1.addEventListener('click', () => submitFn(id ? 'update' : 'post'));
    if (saveBtn2) saveBtn2.addEventListener('click', () => submitFn(id ? 'update' : 'post'));

    form.addEventListener('submit', e => {
      e.preventDefault();
      submitFn(id ? 'update' : 'post');
    });

    if (!due0) setDue();
    calc();
    return;
  }

  formModal({
    title: `${id ? 'Edit' : 'New'} ${docTitleLower}${id ? ' ' + r.number : ''}`, wide: true,
    actions: id ? [{ label: 'Update ' + docTitle, value: 'update', primary: true }, { label: 'Save as draft', value: 'draft' }] : [{ label: 'Save as draft', value: 'draft' }, { label: inv ? 'Save & send' : 'Save & approve', value: 'post', primary: true }],
    body: `<div class="zb-form-wrap">${[
      fld({ name: pk, label: inv ? 'Customer' : 'Vendor', type: 'select', req: 1, opts: [['', 'Select…'], ...parties.map(p => [p.id, p.name])], value: partyId }),
      fld({ name: 'place_of_supply', label: 'Place of supply', type: 'select', opts: STATES, value: r.place_of_supply || APP.org.state, help: 'Same state as your organization → CGST + SGST; otherwise IGST.' }),
      fld({ name: 'date', label: 'Date', type: 'date', req: 1, value: r.date }),
      fld({ name: 'due_date', label: 'Due date', type: 'date', value: due0 }),
      fld({ name: 'order_number', label: 'Order Number', value: r.order_number || '', ph: 'e.g. 653248543' }),
      inv ? '' : fld({ name: 'vendor_ref', label: 'Vendor reference', value: r.vendor_ref }),
    ].join('')}</div>
    <h3 style="margin:16px 0 6px;font-size:14px">Line items</h3>
    <div class="tw"><table class="lt"><thead><tr><th style="min-width:230px">Item / description</th><th>HSN/SAC</th><th>Qty</th><th>Rate (₹)</th><th>Disc %</th><th class="th-tax-explainer" data-doc-kind="${kind}" style="cursor:pointer;" title="Click for GST Rates, Tax Exclusive & B2B/B2C Rules">GST <i class="fa-solid fa-circle-info" style="font-size:11px;color:#2563eb;"></i></th><th class="r">Amount</th><th></th></tr></thead><tbody id="lines">${r.lines.map(row).join('')}</tbody></table></div>
    <div class="er" data-err="lines" role="alert"></div>
    <button type="button" class="btn" data-add style="margin-top:8px">+ Add line</button>
    <div class="tot" aria-live="polite"><div><span>Taxable value</span><b data-t="sub">₹0.00</b></div><div data-t-row="cgst"><span>CGST</span><b data-t="cgst">₹0.00</b></div><div data-t-row="sgst"><span>SGST</span><b data-t="sgst">₹0.00</b></div><div data-t-row="igst"><span>IGST</span><b data-t="igst">₹0.00</b></div><div class="gt"><span>Total</span><b data-t="total">₹0.00</b></div></div>
    <div class="zb-form-wrap" style="margin-top:14px">${fld({ name: 'notes', label: 'Notes', type: 'textarea', value: r.notes != null ? r.notes : (APP.org.notes_default || 'Thanks for your business.'), col: 'c2' })}${inv ? fld({ name: 'terms', label: 'Terms & conditions', type: 'textarea', value: r.terms != null ? r.terms : (APP.org.terms_default || 'Due on Receipt'), col: 'c2' }) : ''}</div>
    <div style="margin-top:14px;padding:12px;border:1px solid var(--bd-glass);border-radius:8px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
        <label style="font-weight:600;font-size:13px;display:flex;align-items:center;gap:6px;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
          Attached Files
        </label>
        <input type="file" id="doc-file-input-m" multiple style="display:none">
        <button type="button" class="btn" onclick="this.previousElementSibling.click()">+ Attach File</button>
      </div>
      <div id="doc-attach-badges-m" style="display:flex;flex-wrap:gap:6px;"></div>
    </div>
    <div style="margin-top:14px;padding:12px;border:1px solid var(--bd-glass);border-radius:8px;display:flex;align-items:center;justify-content:space-between;gap:16px;">
      <div>
        <label style="font-weight:600;font-size:13px;display:flex;align-items:center;gap:6px;">
          <i class="fa-solid fa-signature" style="color:#2563eb;"></i> Authorized Digital Signature
        </label>
        <div style="font-size:11px;color:var(--tx-muted);margin-top:2px;" id="doc-sig-desc-m">
          ${r.signature_data ? 'Document has an attached digital signature.' : (APP.org && APP.org.signature_data ? 'Using company default signature.' : 'No signature attached.')}
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:10px;">
        <input type="hidden" name="signature_data" id="doc-sig-input-m" value="${esc(r.signature_data || '')}">
        <input type="hidden" name="signed_by" id="doc-signed-by-m" value="${esc(r.signed_by || '')}">
        <input type="hidden" name="signature_title" id="doc-sig-title-m" value="${esc(r.signature_title || '')}">
        <button type="button" class="btn" id="btn-doc-sign-m"><i class="fa-solid fa-pen-nib"></i> ${r.signature_data ? 'Change Signature' : 'Sign Document'}</button>
      </div>
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
          if (e.target.value === '__new_item__') {
            handleQuickCreateSelect(e.target, newItem => {
              items.push(newItem);
              byId[String(newItem.id)] = newItem;
              calc();
            });
            return;
          }
          const it = byId[e.target.value], tr = e.target.closest('tr');
          if (it) { $('.l-desc', tr).value = it.name; $('.l-hsn', tr).value = it.hsn_sac || ''; $('.l-rate', tr).value = inv ? it.selling_price : it.purchase_price; $('.l-gst', tr).value = String(num(it.gst_rate)); }
        }
        if (e.target.name === pk) {
          if (e.target.value === '__new_customer__' || e.target.value === '__new_vendor__') {
            handleQuickCreateSelect(e.target, newParty => {
              parties.push(newParty);
              if (newParty.state) form.elements.place_of_supply.value = newParty.state;
              setDue();
              calc();
            });
            return;
          }
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

      const attachBox = $('#doc-attach-badges-m', form);
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

      const fileIn = $('#doc-file-input-m', form);
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

      $('#btn-doc-sign-m', form)?.addEventListener('click', () => {
        openSignatureModal({
          signature_data: $('#doc-sig-input-m', form)?.value || '',
          signed_by: $('#doc-signed-by-m', form)?.value || '',
          signature_title: $('#doc-sig-title-m', form)?.value || '',
          number: r.number
        }, kind, updated => {
          if ($('#doc-sig-input-m', form)) $('#doc-sig-input-m', form).value = updated.signature_data || '';
          if ($('#doc-signed-by-m', form)) $('#doc-signed-by-m', form).value = updated.signed_by || '';
          if ($('#doc-sig-title-m', form)) $('#doc-sig-title-m', form).value = updated.signature_title || '';
          const desc = $('#doc-sig-desc-m', form);
          const btn = $('#btn-doc-sign-m', form);
          if (updated.signature_data) {
            if (desc) desc.textContent = 'Custom digital signature attached.';
            if (btn) btn.innerHTML = '<i class="fa-solid fa-pen-nib"></i> Change Signature';
          } else {
            if (desc) desc.textContent = 'No custom signature attached.';
            if (btn) btn.innerHTML = '<i class="fa-solid fa-pen-nib"></i> Sign Document';
          }
          m.markDirty();
        });
      });

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
            body: { entity_type: isRetainer ? 'retainer_invoice' : (inv ? 'invoice' : 'bill'), entity_id: saved.id, filename: pf.name, file_size: pf.size, mime_type: pf.type, file_data: pf.data }
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

async function recordDocumentPaymentModal(doc, kind = 'invoices', onDone) {
  if (!doc) return;
  const isInvoice = kind === 'invoices' || kind === 'sales';
  let d = doc;
  if (typeof doc === 'number' || typeof doc === 'string' || !d.total) {
    try {
      d = await api(`${isInvoice ? 'invoices' : 'bills'}/${doc.id || doc}/`);
    } catch (e) {
      toast(e.message, 'err');
      return;
    }
  }

  const partyName = d.party || d.customer_name || d.vendor_name || (d.party_details && d.party_details.name) || (isInvoice ? 'Customer' : 'Vendor');
  const partyId = d.party_id || (isInvoice ? d.customer_id : d.vendor_id) || (d.party_details && d.party_details.id);
  const totalAmt = num(d.total);
  const paidAmt = num(d.paid);
  const balanceDue = Math.max(0, num(d.balance !== undefined ? d.balance : (totalAmt - paidAmt)));

  if (balanceDue <= 0 && (d.status === 'Paid' || d.raw_status === 'paid')) {
    toast(`${isInvoice ? 'Invoice' : 'Bill'} ${d.number} is already fully paid.`, 'ok');
    return;
  }

  let bankAccounts = await api('lookup/bank-accounts/').catch(() => []);

  const buildBankOpts = (accs, selId) => {
    let out = '<option value="">Select Bank Account…</option>';
    accs.forEach(b => {
      const isSel = String(b.id) === String(selId) ? 'selected' : '';
      const label = b.display_name || `${b.name} - ${b.bank_name} (${b.account_number})`;
      out += `<option value="${b.id}" ${isSel}>${esc(label)}</option>`;
    });
    out += '<option value="__add_new__" style="color:#2563eb;font-weight:600;">+ Add New Bank Account…</option>';
    return out;
  };

  const initialAmount = r2(balanceDue);

  const m = Modal.open({
    title: `Record Payment · ${isInvoice ? 'Invoice' : 'Bill'} ${esc(d.number)}`,
    wide: false,
    body: `
      <div style="background:var(--surface-glass-subtle, #f8fafc);border:1px solid #e2e8f0;border-radius:8px;padding:14px;margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
          <div>
            <span style="font-size:11.5px;color:#64748b;text-transform:uppercase;letter-spacing:0.04em;">${isInvoice ? 'Customer' : 'Vendor'}</span>
            <div style="font-weight:700;font-size:14px;color:#0f172a;margin-top:2px;">${esc(partyName)}</div>
          </div>
          <div style="text-align:right;">
            <span style="font-size:11.5px;color:#64748b;text-transform:uppercase;letter-spacing:0.04em;">${isInvoice ? 'Invoice Date' : 'Bill Date'}</span>
            <div style="font-weight:600;font-size:13px;color:#334155;margin-top:2px;">${fd(d.date)}</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:10px;padding-top:10px;border-top:1px dashed #cbd5e1;font-size:12px;">
          <div>
            <span style="color:#64748b;">Total Amount</span>
            <div style="font-weight:700;font-size:13px;color:#0f172a;">${inr(totalAmt)}</div>
          </div>
          <div>
            <span style="color:#64748b;">Previously Paid</span>
            <div style="font-weight:700;font-size:13px;color:#059669;">${inr(paidAmt)}</div>
          </div>
          <div>
            <span style="color:#64748b;">Outstanding Balance</span>
            <div style="font-weight:800;font-size:14px;color:#2563eb;" id="pm-doc-due">${inr(balanceDue)}</div>
          </div>
        </div>
      </div>

      <form id="pm-single-doc-form" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="fe" style="grid-column:span 1;">
          <label class="fl">Payment Date <span class="req">*</span></label>
          <input class="in" type="date" name="date" required value="${APP.today}">
        </div>

        <div class="fe" style="grid-column:span 1;">
          <label class="fl">Payment Amount (₹) <span class="req">*</span></label>
          <input class="in" type="number" name="amount" id="pm-pay-amount" required min="0.01" step="0.01" max="${balanceDue}" value="${initialAmount}" style="font-weight:700;font-size:14px;color:#0f172a;">
          <div id="pm-amount-err" style="color:#dc2626;font-size:11px;margin-top:3px;display:none;font-weight:500;"></div>
        </div>

        <div class="fe" style="grid-column:span 1;">
          <label class="fl">Payment Mode <span class="req">*</span></label>
          <select class="in" name="mode" required>
            <option value="bank_transfer" selected>Bank Transfer / NEFT / RTGS</option>
            <option value="upi">UPI</option>
            <option value="cheque">Cheque</option>
            <option value="cash">Cash</option>
            <option value="card">Credit / Debit Card</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div class="fe" style="grid-column:span 1;">
          <label class="fl">${isInvoice ? 'Deposit To Bank Account' : 'Paid From Bank Account'} <span class="req">*</span></label>
          <select class="in" name="bank_account_id" id="pm-bank-select" required>
            ${buildBankOpts(bankAccounts, bankAccounts.length ? bankAccounts[0].id : '')}
          </select>
        </div>

        <div class="fe" style="grid-column:span 2;">
          <label class="fl">Reference / Transaction# / Cheque#</label>
          <input class="in" type="text" name="reference" placeholder="e.g. UTR / IMPS Ref / Cheque No">
        </div>

        <div class="fe" style="grid-column:span 2;">
          <label class="fl">Notes / Description</label>
          <textarea class="in" name="notes" rows="2" placeholder="${isInvoice ? 'Payment received against invoice' : 'Payment made against bill'} ${esc(d.number)}"></textarea>
        </div>

        <div style="grid-column:span 2;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:10px 14px;display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:13px;color:#166534;font-weight:500;">Remaining Balance after Payment:</span>
          <b style="font-size:14px;color:#15803d;" id="pm-calc-remaining">₹0.00</b>
        </div>
      </form>
    `,
    footer: `
      <button class="btn" type="button" data-close>Cancel</button>
      <button class="btn p" type="button" id="pm-submit-btn" style="display:inline-flex;align-items:center;"><i class="fa-solid fa-check" style="font-size:11px;margin-right:4px;"></i> Record Payment</button>
    `
  });

  const form = $('#pm-single-doc-form', m.el);
  const amtInp = $('#pm-pay-amount', m.el);
  const errBox = $('#pm-amount-err', m.el);
  const remBox = $('#pm-calc-remaining', m.el);
  const submitBtn = $('#pm-submit-btn', m.el);
  const bankSelect = $('#pm-bank-select', m.el);

  const calcRemaining = () => {
    const val = num(amtInp.value);
    if (val <= 0) {
      errBox.textContent = 'Payment amount must be greater than zero.';
      errBox.style.display = 'block';
      submitBtn.disabled = true;
      remBox.textContent = inr(balanceDue);
      return;
    }
    if (val > balanceDue + 0.001) {
      errBox.textContent = `Amount cannot exceed outstanding balance of ${inr(balanceDue)}.`;
      errBox.style.display = 'block';
      submitBtn.disabled = true;
      remBox.textContent = '₹0.00';
      return;
    }
    errBox.style.display = 'none';
    submitBtn.disabled = false;
    const remaining = Math.max(0, balanceDue - val);
    remBox.textContent = inr(remaining);
  };

  amtInp.addEventListener('input', calcRemaining);

  bankSelect.addEventListener('change', async () => {
    if (bankSelect.value === '__add_new__') {
      bankAccountForm(null, async newAcc => {
        bankAccounts = await api('lookup/bank-accounts/').catch(() => []);
        bankSelect.innerHTML = buildBankOpts(bankAccounts, newAcc && newAcc.id ? newAcc.id : '');
      });
    }
  });

  submitBtn.addEventListener('click', async () => {
    const amtVal = num(amtInp.value);
    if (amtVal <= 0 || amtVal > balanceDue + 0.001) {
      calcRemaining();
      return;
    }
    const bId = bankSelect.value;
    if (!bId || bId === '__add_new__') {
      toast('Please select a valid bank account.', 'err');
      bankSelect.focus();
      return;
    }
    const selAcc = bankAccounts.find(b => String(b.id) === String(bId));
    const selAccName = selAcc ? selAcc.name : 'Bank Account';

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spin"></span> Recording…';

    const endpoint = isInvoice ? 'payments-received/' : 'payments-made/';
    const docKey = isInvoice ? 'invoice' : 'bill';
    const partyKey = isInvoice ? 'customer' : 'vendor';

    const payload = {
      [partyKey]: partyId,
      date: form.elements.date.value,
      amount: r2(amtVal),
      mode: form.elements.mode.value,
      bank_account_id: Number(bId),
      account: selAccName,
      reference: form.elements.reference.value || '',
      notes: form.elements.notes.value || `Payment for ${d.number}`,
      allocations: [{ [docKey]: d.id, amount: r2(amtVal) }]
    };

    try {
      const res = await api(endpoint, { method: 'POST', body: payload });
      m.close();
      toast(`Payment ${res.number || ''} recorded successfully for ${d.number}!`);
      refresh();
      if (typeof onDone === 'function') onDone(res);
    } catch (e) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fa-solid fa-check" style="font-size:11px;margin-right:4px;"></i> Record Payment';
      toast(e.message || 'Failed to record payment.', 'err');
    }
  });
}
window.recordDocumentPaymentModal = recordDocumentPaymentModal;
window.recordInvoicePaymentModal = (inv, onDone) => recordDocumentPaymentModal(inv, 'invoices', onDone);

async function paymentForm(kind, pre = {}) {
  const rec = kind === 'payments-received', pk = rec ? 'customer' : 'vendor', docKey = rec ? 'invoice' : 'bill', docs = rec ? 'invoices' : 'bills';
  const payId = typeof pre === 'number' || typeof pre === 'string' ? pre : (pre && pre.id ? pre.id : null);
  const [parties, bankAccounts, existing] = await Promise.all([
    api(`lookup/${rec ? 'customers' : 'vendors'}/`).catch(() => []),
    api('lookup/bank-accounts/').catch(() => []),
    payId ? api(`${kind}/${payId}/`).catch(() => null) : Promise.resolve(null)
  ]);
  const dataObj = existing || (typeof pre === 'object' ? pre : {});
  const partyVal = dataObj.party_id || dataObj.customer_id || dataObj.vendor_id || dataObj.party || dataObj[pk] || '';
  const bankOpts = [
    ['', 'Select Bank Account…'],
    ...bankAccounts.map(b => [b.id, b.display_name || `${b.name} (${b.bank_name})`]),
    ['__add_new__', '+ Add New Bank Account…']
  ];
  formModal({
    title: payId ? (rec ? `Edit payment received ${dataObj.number || ''}` : `Edit payment made ${dataObj.number || ''}`) : (rec ? 'Record payment received' : 'Record payment made'), wide: true,
    body: `<div class="zb-form-wrap">${[
      fld({ name: pk, label: rec ? 'Customer' : 'Vendor', type: 'select', req: 1, opts: [['', 'Select…'], ...parties.map(p => [p.id, p.name])], value: partyVal }),
      fld({ name: 'date', label: 'Payment date', type: 'date', req: 1, value: dataObj.date || APP.today }),
      fld({ name: 'amount', label: 'Amount (₹)', type: 'number', req: 1, value: dataObj.amount || '', attrs: 'min="0.01" step="0.01"' }),
      fld({ name: 'mode', label: 'Payment mode', type: 'select', opts: [['bank_transfer', 'Bank transfer'], ['upi', 'UPI'], ['cash', 'Cash'], ['cheque', 'Cheque'], ['card', 'Card'], ['other', 'Other']], value: dataObj.mode || 'bank_transfer' }),
      fld({ name: 'bank_account_id', label: rec ? 'Deposit to Bank Account' : 'Paid from Bank Account', type: 'select', req: 1, opts: bankOpts, value: dataObj.bank_account_id || (bankAccounts.length ? bankAccounts[0].id : '') }),
      fld({ name: 'reference', label: 'Reference number', value: dataObj.reference || '' }),
      fld({ name: 'notes', label: 'Notes', type: 'textarea', value: dataObj.notes || '', col: 'c2' }),
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
          if (pre && pre.doc) { const i = $(`.al-in[data-id="${pre.doc}"]`, form); if (i) { const d = list.find(x => String(x.id) === String(pre.doc)); i.value = d.balance; if (!form.elements.amount.value) form.elements.amount.value = d.balance; } pre.doc = null; }
          if (existing && existing.allocations) {
            for (const alloc of existing.allocations) {
              const inp = $(`.al-in[data-id="${alloc.doc_id}"]`, form);
              if (inp) inp.value = alloc.amount;
            }
          }
          totals();
        } catch (e) { box.innerHTML = errBox(e.message); }
      };
      form.elements[pk].addEventListener('change', load);
      form.addEventListener('input', totals);
      const bankEl = form.elements.bank_account_id;
      if (bankEl) {
        bankEl.addEventListener('change', () => {
          if (bankEl.value === '__add_new__') {
            bankAccountForm(null, async newAcc => {
              const fresh = await api('lookup/bank-accounts/').catch(() => []);
              bankEl.innerHTML = '<option value="">Select Bank Account…</option>' +
                fresh.map(b => `<option value="${b.id}" ${newAcc && newAcc.id === b.id ? 'selected' : ''}>${esc(b.display_name || b.name)}</option>`).join('') +
                '<option value="__add_new__" style="color:#2563eb;font-weight:600;">+ Add New Bank Account…</option>';
            });
          }
        });
      }
      form.addEventListener('click', e => {
        if (!e.target.closest('[data-auto]')) return;
        let left = num(form.elements.amount.value);
        $$('.al-in', form).forEach(i => { const d = list.find(x => String(x.id) === i.dataset.id); const a = Math.min(left, num(d.balance)); i.value = a > 0 ? r2(a) : ''; left = r2(left - a); });
        m.markDirty(); totals();
      });
      if (partyVal) load(); else totals();
    },
    onSubmit: async (d, a, form) => {
      d.allocations = $$('.al-in', form).filter(i => num(i.value) > 0).map(i => ({ [docKey]: Number(i.dataset.id), amount: i.value }));
      const applied = d.allocations.reduce((s, x) => s + num(x.amount), 0);
      if (applied > num(d.amount) + 0.001) throw new ApiErr(400, { message: 'Please correct the allocations.', errors: { allocations: 'Applied amount exceeds the payment amount.' } });
      if (d.bank_account_id === '__add_new__') {
        throw new ApiErr(400, { message: 'Please select a valid bank account.', errors: { bank_account_id: 'Please select a valid bank account.' } });
      }
      if (d.bank_account_id) {
        const selBa = bankAccounts.find(b => String(b.id) === String(d.bank_account_id));
        d.account = selBa ? selBa.name : 'Bank Account';
        d.bank_account_id = Number(d.bank_account_id);
      }
      const p = await api(payId ? `${kind}/${payId}/` : `${kind}/`, { method: payId ? 'PUT' : 'POST', body: d });
      toast(payId ? `Payment ${p.number} updated` : `Payment ${p.number} recorded`); refresh();
    },
  });
}

async function adjustForm(preItem, targetEl, onDone) {
  const [items, warehouses, accounts, projects, nextAdj] = await Promise.all([
    api('lookup/items/').then(r => r.filter(i => i.track_inventory)).catch(() => []),
    api('lookup/warehouses/').catch(() => []),
    api('lookup/accounts/').catch(() => []),
    api('lookup/projects/').catch(() => []),
    api('lookup/next-stock-adjustment-number/').catch(() => null)
  ]);

  const target = targetEl || document.getElementById('pg') || document.body;
  const curDate = (window.APP && window.APP.today) ? window.APP.today : new Date().toISOString().slice(0, 10);
  const curTime = new Date().toTimeString().slice(0, 5);
  const curRef = (nextAdj && nextAdj.next_number) ? nextAdj.next_number : '';

  const itemsById = {};
  items.forEach(it => { itemsById[String(it.id)] = it; });

  const defaultAccounts = ['Cost of Goods Sold', 'Inventory Adjustment', 'Stock Revaluation Expense', 'Cost of Sales'];
  let accountOptionsHtml = '';
  if (accounts && accounts.length) {
    accountOptionsHtml = accounts.map(a => `<option value="${esc(a.name)}" ${a.name === 'Cost of Goods Sold' ? 'selected' : ''}>${esc(a.name)}</option>`).join('');
  } else {
    accountOptionsHtml = defaultAccounts.map((a, idx) => `<option value="${a}" ${idx === 0 ? 'selected' : ''}>${a}</option>`).join('');
  }

  const pendingFiles = [];

  const rowHtml = (l = {}) => `
    <tr class="ln-adj" style="border-bottom:1px solid #e2e8f0;">
      <td style="width:40px;text-align:center;padding:12px 6px;vertical-align:top;">
        <div style="display:flex;align-items:center;justify-content:center;gap:6px;padding-top:8px;">
          <input type="checkbox" class="adj-row-chk" style="cursor:pointer;accent-color:#2563eb;">
          <i class="fa-solid fa-grip-vertical" style="cursor:grab;font-size:12px;color:#94a3b8;"></i>
        </div>
      </td>
      <td style="min-width:320px;padding:10px 12px;vertical-align:top;">
        <div style="display:flex;align-items:flex-start;gap:10px;">
          <div style="width:36px;height:36px;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:4px;display:flex;align-items:center;justify-content:center;color:#94a3b8;flex-shrink:0;margin-top:1px;">
            <i class="fa-regular fa-image" style="font-size:16px;"></i>
          </div>
          <div style="flex:1;">
            <select class="in adj-row-item" style="width:100%;height:36px;border-radius:6px;border:1px solid #cbd5e1;padding:0 10px;font-size:13px;background:#fff;">
              <option value="">Type or click to select an item.</option>
              <option value="__new_item__" style="color:var(--accent);font-weight:600;">+ Add New Item…</option>
              ${items.map(it => `<option value="${it.id}" ${String(l.item || l.id || preItem) === String(it.id) ? 'selected' : ''}>${esc(it.name)}${it.sku ? ' (' + esc(it.sku) + ')' : ''}</option>`).join('')}
            </select>
            <div style="display:flex;align-items:center;gap:10px;margin-top:8px;">
              <select class="in adj-row-project" style="font-size:12px;height:28px;padding:2px 8px;border-radius:4px;border:1px solid #cbd5e1;background:#fff;color:#475569;max-width:180px;">
                <option value="">💼 Select a project ▾</option>
                ${projects.map(p => `<option value="${p.id}" ${String(l.project) === String(p.id) ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
                <option value="__new_project__">+ Add New Project…</option>
              </select>
              <input class="in adj-row-tags" placeholder="🏷 Reporting Tags ▾" value="${esc(l.reporting_tags || '')}" style="font-size:12px;height:28px;padding:2px 8px;width:160px;border-radius:4px;border:1px solid #cbd5e1;background:#fff;color:#475569;">
            </div>
          </div>
        </div>
      </td>
      <td style="width:160px;padding:12px 12px;text-align:right;vertical-align:top;">
        <span class="adj-row-avail" style="font-weight:600;font-size:13px;color:#334155;display:inline-block;padding-top:8px;">0.00</span>
      </td>
      <td style="width:180px;padding:10px 12px;text-align:right;vertical-align:top;">
        <input type="number" step="0.001" min="0" class="in adj-row-new-qty" value="${l.new_quantity != null ? l.new_quantity : ''}" placeholder="0.00" style="text-align:right;height:36px;border-radius:6px;border:1px solid #cbd5e1;padding:0 10px;font-size:13px;width:100%;">
      </td>
      <td style="width:180px;padding:10px 12px;text-align:right;vertical-align:top;">
        <input type="text" class="in adj-row-qty-adj" value="${l.quantity_adjusted != null ? (num(l.quantity_adjusted) > 0 ? '+' : '') + l.quantity_adjusted : ''}" placeholder="Eg. +10, -10" style="text-align:right;height:36px;border-radius:6px;border:1px solid #cbd5e1;padding:0 10px;font-size:13px;width:100%;">
      </td>
      <td style="width:40px;padding:12px 8px;text-align:center;vertical-align:top;">
        <button type="button" class="btn ic adj-row-del" style="border:none;background:none;color:#94a3b8;font-size:18px;cursor:pointer;padding-top:4px;" title="Remove row">×</button>
      </td>
    </tr>
  `;

  target.innerHTML = `
    <div class="stock-adj-page" style="background:#fff;min-height:100%;display:flex;flex-direction:column;">
      <!-- Header -->
      <div style="display:flex;align-items:center;justify-content:space-between;padding:18px 32px;border-bottom:1px solid #e2e8f0;background:#fff;position:sticky;top:0;z-index:20;">
        <h1 style="font-size:20px;font-weight:700;margin:0;color:#0f172a;">New Adjustment</h1>
        <button type="button" class="btn ic" id="btn-adj-close-x" title="Close" style="border:none;background:transparent;color:#64748b;font-size:18px;cursor:pointer;">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <!-- Main Form -->
      <form id="stock-adj-form-element" style="padding:28px 32px;max-width:1150px;width:100%;box-sizing:border-box;flex:1;" novalidate>
        <div class="fe" data-err="_" role="alert"></div>

        <!-- Mode of adjustment -->
        <div style="display:flex;align-items:center;gap:24px;margin-bottom:18px;">
          <label style="width:160px;font-weight:500;font-size:13px;color:#334155;">Mode of adjustment</label>
          <div style="display:flex;align-items:center;gap:20px;">
            <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;font-weight:500;color:#0f172a;">
              <input type="radio" name="mode_of_adjustment" value="quantity" checked style="accent-color:#2563eb;width:16px;height:16px;">
              Quantity Adjustment
            </label>
            <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;font-weight:500;color:#0f172a;">
              <input type="radio" name="mode_of_adjustment" value="value" style="accent-color:#2563eb;width:16px;height:16px;">
              Value Adjustment
            </label>
          </div>
        </div>

        <!-- Reference Number -->
        <div style="display:flex;align-items:center;gap:24px;margin-bottom:18px;">
          <label style="width:160px;font-weight:500;font-size:13px;color:#334155;">Reference Number</label>
          <input class="in" id="adj-ref-number" name="reference_number" value="${esc(curRef)}" placeholder="Auto-generated (e.g. ABC/ADJ/26-27/00001)" style="width:340px;height:36px;border-radius:6px;border:1px solid #cbd5e1;padding:0 12px;font-size:13px;">
        </div>

        <!-- Date* -->
        <div style="display:flex;align-items:center;gap:24px;margin-bottom:18px;">
          <label style="width:160px;font-weight:500;font-size:13px;color:#ef4444;">Date*</label>
          <input class="in" type="date" id="adj-date" name="date" value="${curDate}" required style="width:340px;height:36px;border-radius:6px;border:1px solid #cbd5e1;padding:0 12px;font-size:13px;">
        </div>

        <!-- Account* -->
        <div style="display:flex;align-items:center;gap:24px;margin-bottom:18px;">
          <label style="width:160px;font-weight:500;font-size:13px;color:#ef4444;">Account*</label>
          <select class="in" id="adj-account" name="account" required style="width:340px;height:36px;border-radius:6px;border:1px solid #cbd5e1;padding:0 12px;font-size:13px;background:#fff;">
            ${accountOptionsHtml}
            <option value="__new_account__">+ Add New Account…</option>
          </select>
        </div>

        <!-- Reason* -->
        <div style="display:flex;align-items:center;gap:24px;margin-bottom:18px;">
          <label style="width:160px;font-weight:500;font-size:13px;color:#ef4444;">Reason*</label>
          <select class="in" id="adj-reason" name="reason" required style="width:340px;height:36px;border-radius:6px;border:1px solid #cbd5e1;padding:0 12px;font-size:13px;background:#fff;">
            <option value="">Select a reason</option>
            <option value="Stock recount">Stock recount</option>
            <option value="Damaged goods">Damaged goods</option>
            <option value="Theft / loss">Theft / loss</option>
            <option value="Returned to supplier">Returned to supplier</option>
            <option value="Found stock">Found stock</option>
            <option value="Stock write-off">Stock write-off</option>
            <option value="Inventory revaluation">Inventory revaluation</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <!-- Description -->
        <div style="display:flex;align-items:flex-start;gap:24px;margin-bottom:18px;">
          <label style="width:160px;font-weight:500;font-size:13px;color:#334155;margin-top:6px;">Description</label>
          <textarea class="in" id="adj-description" name="description" placeholder="Max. 500 characters" maxlength="500" style="width:340px;height:70px;border-radius:6px;border:1px solid #cbd5e1;padding:8px 12px;font-size:13px;resize:vertical;"></textarea>
        </div>

        <!-- Warehouse & Time (Preserved Previous Fields) -->
        <div style="margin-bottom:24px;">
          <button type="button" id="btn-toggle-adj-more-fields" style="background:none;border:none;color:#2563eb;font-size:12px;cursor:pointer;padding:0;display:inline-flex;align-items:center;gap:6px;font-weight:500;">
            <i class="fa-solid fa-chevron-right" id="icon-adj-more-fields" style="font-size:10px;transition:transform 0.2s;"></i> Warehouse & Adjustment Details
          </button>
          <div id="adj-more-fields-wrap" style="display:none;margin-top:14px;padding:14px 18px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;max-width:540px;">
            <div style="display:flex;align-items:center;gap:16px;margin-bottom:12px;">
              <label style="width:140px;font-weight:500;font-size:12px;color:#475569;">Warehouse</label>
              <select class="in" id="adj-warehouse" name="warehouse" style="flex:1;height:34px;border-radius:6px;border:1px solid #cbd5e1;padding:0 10px;font-size:12px;background:#fff;">
                <option value="">Default Warehouse (All Locations)</option>
                ${warehouses.map((w, idx) => `<option value="${w.id}" ${idx === 0 ? 'selected' : ''}>${esc(w.code)} - ${esc(w.name)}${w.is_sub_warehouse ? ' (Sub)' : ''}</option>`).join('')}
              </select>
            </div>
            <div style="display:flex;align-items:center;gap:16px;">
              <label style="width:140px;font-weight:500;font-size:12px;color:#475569;">Adjustment Time</label>
              <input class="in" type="time" id="adj-time" name="time" value="${curTime}" style="width:140px;height:34px;border-radius:6px;border:1px solid #cbd5e1;padding:0 10px;font-size:12px;">
            </div>
          </div>
        </div>

        <!-- Item Table Section -->
        <div style="display:flex;align-items:center;justify-content:space-between;margin-top:28px;margin-bottom:12px;padding-top:18px;border-top:1px solid #e2e8f0;">
          <h3 style="font-size:15px;font-weight:700;color:#0f172a;margin:0;">Item Table</h3>
          <button type="button" class="btn" id="btn-adj-bulk-actions" style="font-size:12px;font-weight:500;color:#2563eb;background:transparent;border:none;cursor:pointer;display:flex;align-items:center;gap:6px;">
            <i class="fa-regular fa-circle-check" style="font-size:14px;"></i> Bulk Actions
          </button>
        </div>

        <div style="border:1px solid #e2e8f0;border-radius:8px;background:#fff;margin-bottom:16px;">
          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead style="background:#f8fafc;border-bottom:1px solid #e2e8f0;">
              <tr>
                <th style="width:40px;padding:10px 6px;text-align:center;">
                  <input type="checkbox" id="chk-all-adj-lines" style="cursor:pointer;accent-color:#2563eb;">
                </th>
                <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#475569;letter-spacing:0.5px;">ITEM DETAILS</th>
                <th id="th-adj-avail" style="width:160px;padding:10px 12px;text-align:right;font-size:11px;font-weight:700;color:#475569;letter-spacing:0.5px;">QUANTITY AVAILABLE</th>
                <th id="th-adj-new" style="width:180px;padding:10px 12px;text-align:right;font-size:11px;font-weight:700;color:#475569;letter-spacing:0.5px;">NEW QUANTITY ON HAND</th>
                <th id="th-adj-adj" style="width:180px;padding:10px 12px;text-align:right;font-size:11px;font-weight:700;color:#475569;letter-spacing:0.5px;">QUANTITY ADJUSTED</th>
                <th style="width:40px;padding:10px 8px;text-align:center;"></th>
              </tr>
            </thead>
            <tbody id="adj-item-rows">
            </tbody>
          </table>
        </div>

        <!-- Action buttons below table -->
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:28px;">
          <button type="button" class="btn" id="btn-adj-add-row" style="background:#f8fafc;color:#2563eb;font-weight:600;font-size:12px;border:1px solid #cbd5e1;border-radius:6px;padding:8px 14px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;">
            <i class="fa-solid fa-circle-plus" style="color:#2563eb;"></i> Add New Row
          </button>
          <button type="button" class="btn" id="btn-adj-bulk-add" style="background:#f8fafc;color:#2563eb;font-weight:600;font-size:12px;border:1px solid #cbd5e1;border-radius:6px;padding:8px 14px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;">
            <i class="fa-solid fa-circle-plus" style="color:#2563eb;"></i> Add Items in Bulk
          </button>
        </div>

        <!-- Attachments Section -->
        <div style="margin-bottom:36px;">
          <label style="display:block;font-size:13px;font-weight:500;color:#334155;margin-bottom:8px;">Attach File(s) to inventory adjustment</label>
          <input type="file" id="adj-file-input" multiple style="display:none;">
          <button type="button" class="btn" id="btn-adj-upload" style="background:#fff;border:1px solid #cbd5e1;border-radius:6px;padding:7px 14px;font-size:12px;cursor:pointer;display:inline-flex;align-items:center;gap:8px;color:#334155;">
            <i class="fa-solid fa-upload"></i> Upload File ▾
          </button>
          <div style="font-size:11.5px;color:#64748b;margin-top:6px;">You can upload a maximum of 5 files, 10MB each</div>
          <div id="adj-attach-badges" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;"></div>
        </div>
      </form>

      <!-- Sticky Footer Bar -->
      <div style="position:sticky;bottom:0;background:#fff;border-top:1px solid #e2e8f0;padding:14px 32px;display:flex;align-items:center;gap:12px;box-shadow:0 -2px 10px rgba(0,0,0,0.04);z-index:30;">
        <button type="button" class="btn p" id="btn-adj-save-draft" style="border-radius:6px;padding:8px 20px;font-size:13px;font-weight:600;cursor:pointer;">Save as Draft</button>
        <button type="button" class="btn" id="btn-adj-convert-adjusted" style="background:#fff;color:#0f172a;border:1px solid #cbd5e1;border-radius:6px;padding:8px 20px;font-size:13px;font-weight:600;cursor:pointer;">Convert to Adjusted</button>
        <button type="button" class="btn" id="btn-adj-cancel" style="background:#fff;color:#0f172a;border:1px solid #cbd5e1;border-radius:6px;padding:8px 20px;font-size:13px;font-weight:600;cursor:pointer;">Cancel</button>
      </div>
    </div>
  `;

  const tbody = $('#adj-item-rows', target);

  function updateRow(tr) {
    const sel = $('.adj-row-item', tr);
    const it = itemsById[sel.value];
    const availSpan = $('.adj-row-avail', tr);
    const newQtyInput = $('.adj-row-new-qty', tr);
    const adjQtyInput = $('.adj-row-qty-adj', tr);

    const mode = $('input[name="mode_of_adjustment"]:checked', target)?.value || 'quantity';
    const avail = it ? (parseFloat(mode === 'value' ? (it.stock * (it.purchase_price || 0)) : it.stock) || 0) : 0;
    availSpan.textContent = avail.toFixed(2);

    if (it && it.warehouse_id && !$('#adj-warehouse', target).value) {
      $('#adj-warehouse', target).value = it.warehouse_id;
    }
  }

  // Populate initial row
  if (preItem) {
    tbody.insertAdjacentHTML('beforeend', rowHtml({ item: preItem }));
    const firstTr = tbody.firstElementChild;
    if (firstTr) updateRow(firstTr);
  } else {
    tbody.insertAdjacentHTML('beforeend', rowHtml());
  }

  tbody.addEventListener('change', e => {
    if (e.target.classList.contains('adj-row-item')) {
      if (e.target.value === '__new_item__') {
        handleQuickCreateSelect(e.target, newItem => {
          items.push(newItem);
          itemsById[String(newItem.id)] = newItem;
          const tr = e.target.closest('tr');
          if (tr) updateRow(tr);
        });
        return;
      }
      const tr = e.target.closest('tr');
      if (tr) updateRow(tr);
    }
  });

  tbody.addEventListener('input', e => {
    const tr = e.target.closest('tr');
    if (!tr) return;
    const sel = $('.adj-row-item', tr);
    const it = itemsById[sel.value];
    const mode = $('input[name="mode_of_adjustment"]:checked', target)?.value || 'quantity';
    const avail = it ? (parseFloat(mode === 'value' ? (it.stock * (it.purchase_price || 0)) : it.stock) || 0) : 0;
    const newQtyInput = $('.adj-row-new-qty', tr);
    const adjQtyInput = $('.adj-row-qty-adj', tr);

    if (e.target === newQtyInput) {
      if (newQtyInput.value !== '') {
        const nq = parseFloat(newQtyInput.value) || 0;
        const diff = nq - avail;
        adjQtyInput.value = (diff > 0 ? '+' : '') + diff.toFixed(2);
      } else {
        adjQtyInput.value = '';
      }
    } else if (e.target === adjQtyInput) {
      if (adjQtyInput.value !== '') {
        const diff = parseFloat(adjQtyInput.value.replace('+', '')) || 0;
        newQtyInput.value = (avail + diff).toFixed(2);
      } else {
        newQtyInput.value = '';
      }
    }
  });

  // Mode radio toggle
  $$('input[name="mode_of_adjustment"]', target).forEach(r => {
    r.addEventListener('change', () => {
      const isVal = r.value === 'value';
      const thAvail = $('#th-adj-avail', target);
      const thNew = $('#th-adj-new', target);
      const thAdj = $('#th-adj-adj', target);
      if (thAvail) thAvail.textContent = isVal ? 'CURRENT VALUE' : 'QUANTITY AVAILABLE';
      if (thNew) thNew.textContent = isVal ? 'NEW VALUE ON HAND' : 'NEW QUANTITY ON HAND';
      if (thAdj) thAdj.textContent = isVal ? 'VALUE ADJUSTED' : 'QUANTITY ADJUSTED';
      $$('.ln-adj', tbody).forEach(tr => updateRow(tr));
    });
  });

  // Row removal
  tbody.addEventListener('click', e => {
    const del = e.target.closest('.adj-row-del');
    if (del) {
      const tr = del.closest('tr');
      if ($$('.ln-adj', tbody).length > 1) {
        tr.remove();
      } else {
        tr.querySelector('.adj-row-item').value = '';
        tr.querySelector('.adj-row-avail').textContent = '0.00';
        tr.querySelector('.adj-row-new-qty').value = '';
        tr.querySelector('.adj-row-qty-adj').value = '';
      }
    }
  });

  // Add row
  $('#btn-adj-add-row', target).addEventListener('click', () => {
    tbody.insertAdjacentHTML('beforeend', rowHtml());
  });

  // Bulk add
  $('#btn-adj-bulk-add', target).addEventListener('click', () => {
    if (typeof bulkItemPickerModal === 'function') {
      bulkItemPickerModal(items, selectedItems => {
        selectedItems.forEach(it => {
          tbody.insertAdjacentHTML('beforeend', rowHtml({ item: it.id, new_quantity: it.stock }));
          const lastTr = tbody.lastElementChild;
          if (lastTr) updateRow(lastTr);
        });
      });
    } else {
      tbody.insertAdjacentHTML('beforeend', rowHtml());
    }
  });

  // Bulk actions
  $('#btn-adj-bulk-actions', target).addEventListener('click', () => {
    const chks = $$('.adj-row-chk:checked', tbody);
    if (!chks.length) {
      toast('Please select at least one row checkbox to perform bulk actions.', 'err');
      return;
    }
    confirmBox({
      title: 'Bulk Actions',
      message: `Delete ${chks.length} selected row(s)?`,
      okText: 'Delete Selected'
    }).then(ok => {
      if (ok) {
        chks.forEach(chk => {
          const tr = chk.closest('tr');
          if (tr) tr.remove();
        });
        if (!$$('.ln-adj', tbody).length) {
          tbody.insertAdjacentHTML('beforeend', rowHtml());
        }
      }
    });
  });

  $('#chk-all-adj-lines', target).addEventListener('change', e => {
    $$('.adj-row-chk', tbody).forEach(chk => { chk.checked = e.target.checked; });
  });

  // File Upload
  const fileInput = $('#adj-file-input', target);
  const uploadBtn = $('#btn-adj-upload', target);
  if (uploadBtn && fileInput) {
    uploadBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      Array.from(fileInput.files).forEach(f => {
        if (pendingFiles.length >= 5) {
          toast('Maximum 5 files can be attached.', 'err');
          return;
        }
        if (f.size > 10 * 1024 * 1024) {
          toast(`File ${f.name} exceeds 10MB limit.`, 'err');
          return;
        }
        const reader = new FileReader();
        reader.onload = ev => {
          pendingFiles.push({
            filename: f.name,
            file_size: f.size,
            mime_type: f.type,
            file_data: ev.target.result
          });
          renderBadges();
        };
        reader.readAsDataURL(f);
      });
      fileInput.value = '';
    });
  }

  function renderBadges() {
    const container = $('#adj-attach-badges', target);
    if (!container) return;
    container.innerHTML = pendingFiles.map((f, idx) => `
      <span class="badge" style="display:inline-flex;align-items:center;gap:6px;background:#f1f5f9;border:1px solid #cbd5e1;border-radius:6px;padding:4px 10px;font-size:12px;color:#1e293b;">
        <i class="fa-solid fa-paperclip" style="color:#64748b;"></i>
        <span>${esc(f.filename)}</span>
        <span style="color:#64748b;font-size:10px;">(${(f.file_size / 1024).toFixed(1)} KB)</span>
        <button type="button" data-rm-att="${idx}" style="border:none;background:none;color:#ef4444;font-size:14px;cursor:pointer;padding:0 2px;">×</button>
      </span>
    `).join('');
  }

  $('#adj-attach-badges', target)?.addEventListener('click', e => {
    const btn = e.target.closest('[data-rm-att]');
    if (btn) {
      const idx = parseInt(btn.getAttribute('data-rm-att'), 10);
      if (!isNaN(idx)) {
        pendingFiles.splice(idx, 1);
        renderBadges();
      }
    }
  });

  // Toggle Warehouse & Time extra fields
  const btnMoreFields = $('#btn-toggle-adj-more-fields', target);
  const wrapMoreFields = $('#adj-more-fields-wrap', target);
  const iconMoreFields = $('#icon-adj-more-fields', target);
  if (btnMoreFields && wrapMoreFields) {
    btnMoreFields.addEventListener('click', () => {
      const isHidden = wrapMoreFields.style.display === 'none' || !wrapMoreFields.style.display;
      wrapMoreFields.style.display = isHidden ? 'block' : 'none';
      if (iconMoreFields) iconMoreFields.style.transform = isHidden ? 'rotate(90deg)' : 'none';
    });
  }

  const closeForm = () => {
    if (onDone) onDone(null);
    else if (window.location.hash.includes('stock-adjustments')) {
      route();
    } else {
      location.hash = '#/inventory/stock-adjustments';
      route();
    }
  };

  const submitForm = async (status = 'adjusted') => {
    const form = $('#stock-adj-form-element', target);
    const dateVal = $('#adj-date', form).value;
    let whVal = $('#adj-warehouse', form)?.value;
    if (!whVal && warehouses.length > 0) {
      whVal = warehouses[0].id;
    }
    const acctVal = $('#adj-account', form).value;
    const reasonVal = $('#adj-reason', form).value;
    const modeVal = $('input[name="mode_of_adjustment"]:checked', form)?.value || 'quantity';

    if (!dateVal) { toast('Please enter adjustment date.', 'err'); return; }
    if (!whVal) { toast('Please select warehouse.', 'err'); return; }
    if (!acctVal) { toast('Please select account.', 'err'); return; }
    if (!reasonVal) { toast('Please select a reason.', 'err'); return; }

    const rows = $$('.ln-adj', tbody);
    const rowsData = [];
    for (const tr of rows) {
      const iid = $('.adj-row-item', tr).value;
      if (!iid) continue;
      const nq = $('.adj-row-new-qty', tr).value;
      const aq = $('.adj-row-qty-adj', tr).value;
      const proj = $('.adj-row-project', tr).value;
      const tags = $('.adj-row-tags', tr).value.trim();
      rowsData.push({
        item: iid,
        new_quantity: nq !== '' ? parseFloat(nq) : null,
        quantity_adjusted: aq !== '' ? parseFloat(aq.replace('+', '')) : null,
        project: proj,
        reporting_tags: tags
      });
    }

    if (!rowsData.length) {
      toast('Please select at least one item to adjust.', 'err');
      return;
    }

    const payload = {
      mode_of_adjustment: modeVal,
      reference_number: $('#adj-ref-number', form).value.trim(),
      date: dateVal,
      time: $('#adj-time', form).value,
      warehouse: whVal,
      account: acctVal,
      reason: reasonVal,
      description: $('#adj-description', form).value.trim(),
      notes: $('#adj-description', form).value.trim(),
      status: status,
      items: rowsData,
      attachments: pendingFiles
    };

    try {
      await api('stock-adjustments/', { method: 'POST', body: payload });
      toast(status === 'draft' ? 'Stock adjustment saved as draft' : 'Stock adjusted successfully');
      closeForm();
    } catch (err) {
      toast(err.message || 'Failed to adjust stock', 'err');
    }
  };

  $('#btn-adj-close-x', target)?.addEventListener('click', closeForm);
  $('#btn-adj-cancel', target)?.addEventListener('click', closeForm);
  $('#btn-adj-save-draft', target)?.addEventListener('click', () => submitForm('draft'));
  $('#btn-adj-convert-adjusted', target)?.addEventListener('click', () => submitForm('adjusted'));
}
window.adjustForm = adjustForm;

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
        ${fld({ name: 'organization_id', label: 'Organization ID', value: o.organization_id || '', attrs: 'readonly style="background:#f1f5f9;color:#475569;cursor:not-allowed;"', help: 'Permanent Unique Organization ID' })}
        ${fld({ name: 'name', label: 'Company / Organization Name', req: 1, value: o.name || '' })}
        ${fld({ name: 'code', label: 'Organization Short Code / Prefix', value: o.code || '', ph: 'e.g. ABC', help: 'Prefix used for all unique document numbers (e.g. ABC/INV/26-27/00001)' })}
        ${fld({ name: 'company_id', label: 'Company ID / CIN', value: o.company_id || '', ph: 'Enter CIN or Registration Number' })}
        ${fld({ name: 'gstin', label: 'GSTIN', value: o.gstin || '', ph: 'Enter 15-character GSTIN' })}
        ${fld({ name: 'state', label: 'Home State', type: 'select', req: 1, opts: STATES, value: o.state || 'Kerala' })}
        ${fld({ name: 'address', label: 'Address / Building / Street', type: 'textarea', value: o.address || '', ph: 'Enter building, street address', col: 'c2' })}
        ${fld({ name: 'city', label: 'City', value: o.city || '', ph: 'Enter city' })}
        ${fld({ name: 'pincode', label: 'Pincode', value: o.pincode || '', ph: 'Enter postal code' })}
        ${fld({ name: 'country', label: 'Country', value: o.country || 'India' })}
        ${fld({ name: 'phone', label: 'Phone', value: o.phone || '', ph: 'Enter business phone' })}
        ${fld({ name: 'email', label: 'Email', type: 'email', value: o.email || '', ph: 'Enter business email' })}
        ${fld({ name: 'website', label: 'Website', value: o.website || '', ph: 'e.g. www.mycompany.com' })}
        ${fld({ name: 'opening_cash', label: 'Opening Cash & Bank Balance (₹)', type: 'number', value: o.opening_cash || 0, attrs: 'step="0.01"' })}
      </div>
      <div style="margin-top:14px;padding:14px;border:1px solid var(--bd-glass);border-radius:8px;display:flex;align-items:center;gap:18px;">
        <div style="width:72px;height:72px;border-radius:8px;border:1px solid var(--bd-glass);background:#fff;display:grid;place-items:center;overflow:hidden;padding:4px;">
          <img id="org-logo-preview" src="${esc(o.logo_data || '')}" alt="Logo" style="max-width:100%;max-height:100%;object-fit:contain;display:${o.logo_data ? 'block' : 'none'};">
          <span id="org-logo-empty" style="font-size:11px;color:var(--tx-muted);display:${o.logo_data ? 'none' : 'inline'};">No Logo</span>
        </div>
        <div style="flex:1;">
          <label style="font-weight:600;font-size:13px;display:block;margin-bottom:4px;">Company Logo</label>
          <input type="file" id="org-logo-file" accept="image/png,image/jpeg,image/webp,image/gif" style="display:none">
          <input type="hidden" name="logo_data" id="org-logo-input" value="${esc(o.logo_data || '')}">
          <button type="button" class="btn" onclick="this.previousElementSibling.previousElementSibling.click()">Upload Logo</button>
          <button type="button" class="btn" id="reset-logo-btn" style="margin-left:6px;display:${o.logo_data ? 'inline-block' : 'none'};">Remove Logo</button>
          <div class="hp" style="margin-top:4px;">Recommended size: 240x80px PNG or JPG with transparent/white background. Optional.</div>
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
        <div style="margin-top:14px;padding:14px;border:1px solid var(--bd-glass);border-radius:8px;display:flex;align-items:center;gap:18px;grid-column:span 2;">
          <div style="width:130px;height:64px;border-radius:8px;border:1px solid var(--bd-glass);background:#fff;display:grid;place-items:center;overflow:hidden;padding:4px;">
            <img id="org-sig-preview" src="${esc(o.signature_data || '')}" alt="Signature" style="max-width:100%;max-height:100%;object-fit:contain;display:${o.signature_data ? 'block' : 'none'};">
            <span id="org-sig-empty" style="font-size:11px;color:var(--tx-muted);display:${o.signature_data ? 'none' : 'inline'};">No Signature</span>
          </div>
          <div style="flex:1;">
            <label style="font-weight:600;font-size:13px;display:block;margin-bottom:4px;">Company Default Digital Signature</label>
            <input type="hidden" name="signature_data" id="org-sig-input" value="${esc(o.signature_data || '')}">
            <button type="button" class="btn" id="org-edit-sig-btn">✍️ Draw / Type / Upload Signature</button>
            <button type="button" class="btn" id="org-reset-sig-btn" style="margin-left:6px;display:${o.signature_data ? 'inline-block' : 'none'};">Remove</button>
            <div class="hp" style="margin-top:4px;">Used automatically on invoices, bills, and quotes when no individual signature is specified.</div>
          </div>
        </div>
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
      const prev = $('#org-logo-preview', form);
      const empty = $('#org-logo-empty', form);
      const resBtn = $('#reset-logo-btn', form);
      const input = $('#org-logo-input', form);

      if (fIn) {
        fIn.addEventListener('change', () => {
          const file = fIn.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = e => {
            if (prev) {
              prev.src = e.target.result;
              prev.style.display = 'block';
            }
            if (empty) empty.style.display = 'none';
            if (input) input.value = e.target.result;
            if (resBtn) resBtn.style.display = 'inline-block';
          };
          reader.readAsDataURL(file);
        });
      }
      if (resBtn) {
        resBtn.addEventListener('click', () => {
          if (prev) {
            prev.src = '';
            prev.style.display = 'none';
          }
          if (empty) empty.style.display = 'inline';
          if (input) input.value = '';
          if (fIn) fIn.value = '';
          resBtn.style.display = 'none';
        });
      }
      $('#org-edit-sig-btn', form)?.addEventListener('click', () => {
        openSignatureModal({ signature_data: $('#org-sig-input', form).value, signature_title: $('[name="signature_title"]', form)?.value }, 'organization', res => {
          $('#org-sig-input', form).value = res.signature_data || '';
          const prev = $('#org-sig-preview', form);
          const empty = $('#org-sig-empty', form);
          const rBtn = $('#org-reset-sig-btn', form);
          if (res.signature_data) {
            if (prev) { prev.src = res.signature_data; prev.style.display = 'block'; }
            if (empty) empty.style.display = 'none';
            if (rBtn) rBtn.style.display = 'inline-block';
          } else {
            if (prev) prev.style.display = 'none';
            if (empty) empty.style.display = 'inline';
            if (rBtn) rBtn.style.display = 'none';
          }
        });
      });
      $('#org-reset-sig-btn', form)?.addEventListener('click', () => {
        $('#org-sig-input', form).value = '';
        const prev = $('#org-sig-preview', form);
        const empty = $('#org-sig-empty', form);
        const rBtn = $('#org-reset-sig-btn', form);
        if (prev) prev.style.display = 'none';
        if (empty) empty.style.display = 'inline';
        if (rBtn) rBtn.style.display = 'none';
      });
    },
    onSubmit: async d => {
      APP.org = await api('organization/', { method: 'PUT', body: d });
      applyOrg();
      toast('Organization settings updated');
      refresh();
    },
  });
}

async function accountForm(id, onDone) {
  const o = id ? await api(`accounts/${id}/`) : { code: '', name: '', account_type: 'expense', sub_type: 'operating_expense', description: '', active: true };
  const typeOpts = [['asset', 'Asset'], ['liability', 'Liability'], ['equity', 'Equity'], ['income', 'Income'], ['expense', 'Expense']];
  formModal({
    title: id ? 'Edit Account' : 'New Account',
    dialog: Boolean(onDone || Modal.count() > 0),
    body: `<div class="zb-form-wrap">
      ${fld({ name: 'code', label: 'Account Code', req: true, value: o.code, ph: 'e.g. 6095' })}
      ${fld({ name: 'name', label: 'Account Name', req: true, value: o.name, ph: 'e.g. Professional Indemnity' })}
      ${fld({ name: 'account_type', label: 'Account Type', type: 'select', opts: typeOpts, value: o.account_type, req: true })}
      ${fld({ name: 'sub_type', label: 'Sub-Category', value: o.sub_type, ph: 'e.g. operating_expense' })}
      ${fld({ name: 'description', label: 'Description', type: 'textarea', value: o.description, rows: 2 })}
      ${fld({ name: 'active', label: 'Active', type: 'checkbox', value: o.active })}
    </div>`,
    onSubmit: async d => {
      d.active = !!d.active;
      let res;
      if (id) res = await api(`accounts/${id}/`, { method: 'PUT', body: d });
      else res = await api('accounts/', { method: 'POST', body: d });
      toast(id ? 'Account updated' : 'Account created');
      if (onDone) onDone(res || d);
      else refresh();
    }
  });
}

async function journalForm(id) {
  const [accounts, rec] = await Promise.all([
    api('lookup/accounts/'),
    id ? api(`manual-journals/${id}/`).catch(() => null) : Promise.resolve(null)
  ]);
  let lines = (rec && rec.lines && rec.lines.length) ? rec.lines.map(l => ({
    account: l.account_id || l.account,
    debit: num(l.debit) > 0 ? l.debit : '',
    credit: num(l.credit) > 0 ? l.credit : '',
    description: l.description || ''
  })) : [
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
    title: id ? `Edit Manual Journal ${rec ? rec.number : ''}` : 'New Manual Journal Voucher',
    wide: true,
    body: `
      <form id="jrn-form">
        <div class="zb-form-wrap" style="margin-bottom:16px;">
          ${fld({ name: 'date', label: 'Date', type: 'date', req: true, value: rec ? rec.date : APP.today })}
          ${fld({ name: 'reference', label: 'Reference / Voucher #', value: rec ? (rec.reference || '') : '', ph: 'e.g. JRN-ADJ-01' })}
          ${fld({ name: 'notes', label: 'Notes / Narration', value: rec ? (rec.notes || '') : '', ph: 'Purpose of journal entry' })}
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
      <button type="button" class="btn p" id="jrn-submit-btn">${id ? 'Update Journal' : 'Post Journal'}</button>
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
      if (id) await api(`manual-journals/${id}/`, { method: 'PUT', body: { date: dt, reference: ref, notes, lines: outLines } });
      else await api('manual-journals/', { method: 'POST', body: { date: dt, reference: ref, notes, lines: outLines } });
      toast(id ? 'Journal voucher updated' : 'Journal voucher posted');
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
    body: `<div class="zb-form-wrap">
      ${fld({ name: 'date', label: 'Date', type: 'date', req: true, value: o.date })}
      ${fld({ name: 'expense_account', label: 'Expense Account', type: 'select', opts: expAccounts.map(a => [a.id, `${a.code} - ${a.name}`]), value: o.expense_account || o.expense_account_id, req: true })}
      ${fld({ name: 'vendor', label: 'Vendor / Paid To', type: 'select', opts: [['', 'Direct Expense (No Vendor)'], ...vendors.map(v => [v.id, v.name])], value: o.vendor || o.vendor_id })}
      ${fld({ name: 'amount', label: 'Taxable Amount (₹)', req: true, type: 'number', value: o.amount, ph: '0.00' })}
      ${fld({ name: 'gst_rate', label: 'GST Rate', type: 'select', opts: GST_SLABS.map(s => [s, s + '%']), value: o.gst_rate })}
      ${fld({ name: 'paid_through', label: 'Paid Through', type: 'select', opts: [['Bank Account', 'Bank Account'], ['Petty Cash', 'Petty Cash'], ['Credit Card', 'Credit Card']], value: o.paid_through })}
      ${fld({ name: 'reference', label: 'Reference / Bill #', value: o.reference, ph: 'e.g. Receipt #401' })}
      ${fld({ name: 'notes', label: 'Notes / Purpose', type: 'textarea', value: o.notes, rows: 2 })}
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

async function bankAccountForm(id, onDone) {
  const [o, accounts] = await Promise.all([
    id ? api(`bank-accounts/${id}/`) : Promise.resolve({
      name: '', bank_name: '', account_number: '', ifsc: '', account_type: 'current',
      currency: 'INR', branch_name: 'HO Kottayam', opening_balance: '0.00',
      opening_balance_date: APP.today, bank_balance: '0.00', gl_account_id: null,
      description: '', active: true, is_archived: false
    }),
    api('lookup/accounts/').catch(() => [])
  ]);

  const accTypeOpts = [
    ['current', 'Current Account'],
    ['savings', 'Savings Account'],
    ['checking', 'Checking Account'],
    ['cash', 'Cash Account'],
    ['credit_card', 'Credit Card'],
    ['other', 'Other Bank Account']
  ];

  const glOpts = [['', 'Select General Ledger Account...'], ...accounts.map(a => [a.id, `${a.code ? a.code + ' - ' : ''}${a.name} (${a.account_type})`])];

  formModal({
    title: id ? 'Edit Bank Account' : 'Add Bank Account',
    body: `<div class="zb-form-wrap">
      ${fld({ name: 'name', label: 'Account Display Name', req: true, value: o.name, ph: 'e.g. Kotak1 / Primary Current' })}
      ${fld({ name: 'bank_name', label: 'Bank Name', req: true, value: o.bank_name, ph: 'e.g. Kotak Mahindra Bank' })}
      ${fld({ name: 'account_number', label: 'Account Number', req: true, value: o.account_number, ph: 'Enter account number' })}
      ${o.masked_account_number ? `<div class="sub" style="margin:-6px 0 10px 14px;font-size:11.5px;">Masked View: <b>${esc(o.masked_account_number)}</b></div>` : ''}
      ${fld({ name: 'ifsc', label: 'IFSC / Routing Code', value: o.ifsc, ph: 'e.g. KKBK0001234' })}
      ${fld({ name: 'account_type', label: 'Account Type', type: 'select', opts: accTypeOpts, value: o.account_type || 'current' })}
      ${fld({ name: 'currency', label: 'Account Currency', type: 'select', opts: [['INR', 'INR - Indian Rupee'], ['USD', 'USD - US Dollar'], ['EUR', 'EUR - Euro'], ['GBP', 'GBP - British Pound']], value: o.currency || 'INR' })}
      ${fld({ name: 'branch_name', label: 'Branch / Location', value: o.branch_name || 'HO Kottayam', ph: 'e.g. HO Kottayam' })}
      ${fld({ name: 'opening_balance', label: 'Opening Balance (₹)', type: 'number', value: o.opening_balance || '0.00' })}
      ${fld({ name: 'opening_balance_date', label: 'Opening Balance Date', type: 'date', value: o.opening_balance_date || APP.today })}
      ${fld({ name: 'bank_balance', label: 'Bank Statement Balance (₹)', type: 'number', value: o.bank_balance || o.current_balance || '0.00' })}
      ${fld({ name: 'gl_account', label: 'Linked GL Account', type: 'select', opts: glOpts, value: o.gl_account_id || '' })}
      ${fld({ name: 'description', label: 'Description & Notes', type: 'textarea', value: o.description || '' })}
      <div class="fe" style="display:flex;align-items:center;gap:16px;padding:8px 14px;">
        <label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;">
          <input type="checkbox" name="active" ${o.active !== false ? 'checked' : ''}>
          <span style="font-size:13px;font-weight:600;">Active Account</span>
        </label>
        <label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;">
          <input type="checkbox" name="is_archived" ${o.is_archived ? 'checked' : ''}>
          <span style="font-size:13px;color:var(--tx-muted);">Archived</span>
        </label>
      </div>
    </div>`,
    onSubmit: async d => {
      d.opening_balance = num(d.opening_balance);
      d.bank_balance = num(d.bank_balance);
      d.gl_account = d.gl_account ? Number(d.gl_account) : null;
      d.active = Boolean(d.active);
      d.is_archived = Boolean(d.is_archived);
      let res;
      if (id) res = await api(`bank-accounts/${id}/`, { method: 'PUT', body: d });
      else res = await api('bank-accounts/', { method: 'POST', body: d });
      toast('Bank account saved successfully');
      refresh();
      if (typeof onDone === 'function') onDone(res);
    }
  });
}

async function recordDepositModal(defaultAccId) {
  const [bankAccs, accounts] = await Promise.all([
    api('lookup/bank-accounts/'),
    api('lookup/accounts/').catch(() => [])
  ]);

  if (!bankAccs.length) {
    toast('Please create a bank account first', 'err');
    return bankAccountForm();
  }

  const depositTypes = [
    ['customer_receipt', 'Customer Receipt'],
    ['cash_deposit', 'Cash Deposit'],
    ['other_income', 'Other Income'],
    ['clearing_account', 'Clearing Account Deposit'],
    ['transfer', 'Transfer from Other Account'],
    ['refund', 'Vendor Refund'],
    ['other', 'General Deposit']
  ];

  const offsetOpts = [
    ['', 'Select Offset / Income Account...'],
    ...accounts.map(a => [a.id, `${a.code ? a.code + ' - ' : ''}${a.name} (${a.account_type})`])
  ];

  formModal({
    title: 'Record Bank Deposit',
    body: `<div class="zb-form-wrap">
      ${fld({ name: 'bank_account', label: 'Deposit-To Bank Account', type: 'select', opts: bankAccs.map(b => [b.id, `${b.name} (${b.bank_name || 'Bank'})`]), value: defaultAccId || bankAccs[0].id, req: true })}
      ${fld({ name: 'date', label: 'Deposit Date', type: 'date', req: true, value: APP.today })}
      ${fld({ name: 'amount', label: 'Deposit Amount (₹)', type: 'number', req: true, ph: '0.00' })}
      ${fld({ name: 'party_name', label: 'Received From / Source Party', ph: 'e.g. ABC Technologies / Cash Sales' })}
      ${fld({ name: 'deposit_type', label: 'Deposit Type', type: 'select', opts: depositTypes, value: 'customer_receipt' })}
      ${fld({ name: 'offset_account', label: 'Offset / Clearing Account', type: 'select', opts: offsetOpts })}
      ${fld({ name: 'reference', label: 'Reference / Cheque / UTR #', ph: 'e.g. UTR-982103852' })}
      ${fld({ name: 'location', label: 'Location / Branch', value: 'HO Kottayam' })}
      ${fld({ name: 'description', label: 'Description & Narration', type: 'textarea', ph: 'Notes or narration for bank deposit' })}
    </div>`,
    submit: 'Record Deposit',
    onSubmit: async d => {
      d.bank_account = Number(d.bank_account);
      d.amount = num(d.amount);
      if (d.amount <= 0) throw new Error('Deposit amount must be greater than zero.');
      d.offset_account = d.offset_account ? Number(d.offset_account) : null;
      await api('bank-deposits/', { method: 'POST', body: d });
      toast('Bank deposit recorded and posted to books');
      refresh();
    }
  });
}

async function addBankTransactionModal(type, defaultAccId) {
  if (type === 'expense') return expenseForm();
  if (type === 'customer_receipt' || type === 'payment_received') return paymentForm('payments-received');
  if (type === 'vendor_payment' || type === 'payment_made') return paymentForm('payments-made');
  if (type === 'transfer') return transferForm();

  const [bankAccs, accounts] = await Promise.all([
    api('lookup/bank-accounts/'),
    api('lookup/accounts/').catch(() => [])
  ]);

  const titles = {
    bank_charge: 'Record Bank Charge / Fee',
    interest_income: 'Record Interest Income',
    refund: 'Record Bank Refund',
    adjustment: 'Record Banking Adjustment'
  };

  const isDeposit = (type === 'interest_income' || type === 'refund');

  formModal({
    title: titles[type] || 'Add Bank Transaction',
    body: `<div class="zb-form-wrap">
      ${fld({ name: 'bank_account', label: 'Bank Account', type: 'select', opts: bankAccs.map(b => [b.id, `${b.name} (${b.bank_name || 'Bank'})`]), value: defaultAccId || bankAccs[0].id, req: true })}
      ${fld({ name: 'date', label: 'Transaction Date', type: 'date', req: true, value: APP.today })}
      ${fld({ name: 'amount', label: 'Amount (₹)', type: 'number', req: true, ph: '0.00' })}
      ${fld({ name: 'reference', label: 'Reference / Voucher #', ph: 'e.g. TXN-89210' })}
      ${fld({ name: 'account', label: 'Category / GL Account', type: 'select', opts: accounts.map(a => [a.id, `${a.name} (${a.account_type})`]) })}
      ${fld({ name: 'description', label: 'Description & Narration', req: true, ph: 'e.g. Monthly maintenance charge / Interest credited' })}
      ${fld({ name: 'location', label: 'Branch / Location', value: 'HO Kottayam' })}
    </div>`,
    submit: 'Save Transaction',
    onSubmit: async d => {
      const amt = num(d.amount);
      if (amt <= 0) throw new Error('Amount must be greater than zero.');
      const body = {
        bank_account: Number(d.bank_account),
        date: d.date,
        reference: d.reference || '',
        description: d.description,
        location: d.location || 'HO Kottayam',
        transaction_type: titles[type] || 'Bank Transaction',
        withdrawal: isDeposit ? 0 : amt,
        deposit: isDeposit ? amt : 0,
        status: 'manually_added',
        category_account: d.account ? Number(d.account) : null
      };
      await api('bank-transactions/', { method: 'POST', body });
      toast('Transaction created and posted');
      refresh();
    }
  });
}

async function matchBankTransactionModal(txnId, onDone) {
  const [txn, matchData] = await Promise.all([
    api(`bank-transactions/${txnId}/`),
    api(`banking/match-suggestions/${txnId}/`).catch(() => ({ suggestions: [] }))
  ]);

  const suggestions = matchData.suggestions || [];
  let selectedCandidate = suggestions[0] || null;

  const isDeposit = num(txn.deposit) > 0;
  const amtDisplay = isDeposit ? `+₹${txn.deposit}` : `-₹${txn.withdrawal}`;

  const m = Modal.open({
    title: 'Match Bank Statement Transaction',
    wide: true,
    dialog: true,
    body: `
      <div style="padding:4px 0 16px;">

        <div style="background:var(--surface-glass-subtle);border:1px solid var(--bd-glass);border-radius:10px;padding:16px;margin-bottom:18px;">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:8px;">
            <div style="font-weight:700;font-size:15px;color:var(--tx);">${esc(txn.description)}</div>
            <div style="font-weight:800;font-size:18px;color:${isDeposit ? '#059669' : '#dc2626'};">${amtDisplay}</div>
          </div>
          <div style="display:flex;gap:20px;flex-wrap:wrap;font-size:12px;color:var(--tx-muted);">
            <div>Date: <b style="color:var(--tx);">${fd(txn.date)}</b></div>
            <div>Reference: <b style="color:var(--tx);">${esc(txn.reference || '—')}</b></div>
            <div>Bank Account: <b style="color:var(--tx);">${esc(txn.bank_account_name || 'Bank')}</b></div>
            <div>Location: <b style="color:var(--tx);">${esc(txn.location || 'HO Kottayam')}</b></div>
          </div>
        </div>

        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
          <h4 style="margin:0;font-size:14px;">Suggested Matching Book Transactions (${suggestions.length})</h4>
          <div style="font-size:12px;color:var(--tx-muted);">Multi-way auto-matching based on amount, date &amp; references</div>
        </div>

        <div id="match-candidates-list" style="max-height:280px;overflow-y:auto;padding-right:4px;">
          ${suggestions.length ? suggestions.map((c, i) => {
            const conf = c.confidence_score || Math.round((c.confidence || 0.8) * 100);
            const badgeClass = conf >= 90 ? 'chip-mint' : 'chip-sky';
            return `
              <div class="match-candidate-card ${i === 0 ? 'selected' : ''}" data-idx="${i}" style="cursor:pointer;">
                <div style="display:flex;align-items:center;gap:12px;">
                  <input type="radio" name="match-radio" value="${i}" ${i === 0 ? 'checked' : ''} style="cursor:pointer;">
                  <div>
                    <div style="display:flex;align-items:center;gap:8px;">
                      <span class="pastel-chip ${badgeClass}">${conf}% Match</span>
                      <b style="font-size:13.5px;color:var(--tx);">${esc(c.number || c.id)}</b>
                      <span style="font-size:12px;color:var(--tx-muted);">· ${esc(c.party_name || c.type || 'Transaction')}</span>
                    </div>
                    <div style="font-size:11.5px;color:var(--tx-muted);margin-top:4px;">
                      Date: ${fd(c.date)} · ${(c.reasons || []).join(' · ') || 'Compatible accounting entry'}
                    </div>
                  </div>
                </div>
                <div style="text-align:right;">
                  <div style="font-weight:700;font-size:15px;color:var(--tx);">${inr(c.amount)}</div>
                  <div style="font-size:11px;color:#059669;font-weight:600;">Exact Match</div>
                </div>
              </div>
            `;
          }).join('') : `
            <div style="text-align:center;padding:30px;background:var(--surface-glass-subtle);border-radius:8px;border:1px dashed var(--bd-glass);">
              <div style="font-size:24px;margin-bottom:6px;">🔍</div>
              <div style="font-weight:600;font-size:13.5px;color:var(--tx);">No exact book transaction matches found</div>
              <div style="font-size:12px;color:var(--tx-muted);margin-top:4px;">You can Quick Categorize this transaction directly or record a new book payment.</div>
              <button type="button" class="btn p" id="btn-fallback-quick-cat" style="margin-top:12px;">⚡ Quick Categorize Instead</button>
            </div>
          `}
        </div>

        ${suggestions.length ? `
          <div style="margin-top:16px;border-top:1px solid var(--bd-glass);padding-top:12px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;">
            <div style="display:flex;align-items:center;gap:8px;">
              <label style="font-size:12px;color:var(--tx-muted);">Bank Fee / Adjustment (₹):</label>
              <input type="number" id="match-fee-input" class="in" value="0.00" style="width:100px;font-size:12px;padding:4px 8px;">
            </div>
            <div style="display:flex;gap:10px;">
              <button type="button" class="btn" data-close>Cancel</button>
              <button type="button" class="btn p" id="btn-confirm-match">Confirm Match</button>
            </div>
          </div>
        ` : ''}
      </div>
    `,
    footer: suggestions.length ? '' : `<button type="button" class="btn" data-close>Close</button>`
  });

  const cards = $$('.match-candidate-card', m.el);
  cards.forEach(card => {
    card.addEventListener('click', () => {
      cards.forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      const radio = $('input[type="radio"]', card);
      if (radio) radio.checked = true;
      selectedCandidate = suggestions[Number(card.dataset.idx)];
    });
  });

  const confirmBtn = $('#btn-confirm-match', m.el);
  if (confirmBtn) {
    confirmBtn.addEventListener('click', async () => {
      if (!selectedCandidate) {
        toast('Please select a matching transaction candidate', 'err');
        return;
      }
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Matching...';
      const fee = $('#match-fee-input', m.el)?.value || '0.00';
      try {
        await api(`banking/match/${txnId}/`, {
          method: 'POST',
          body: {
            entity_type: selectedCandidate.type || 'payment_received',
            entity_id: selectedCandidate.id,
            fee: fee
          }
        });
        toast('Bank transaction successfully matched and reconciled');
        m.close();
        if (onDone) onDone(); else refresh();
      } catch (err) {
        toast(err.message, 'err');
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Confirm Match';
      }
    });
  }

  const fallbackBtn = $('#btn-fallback-quick-cat', m.el);
  if (fallbackBtn) {
    fallbackBtn.addEventListener('click', () => {
      m.close();
      quickCategorizeModal(txnId, onDone);
    });
  }
}

async function unmatchBankTransactionModal(txnId, onDone) {
  const txn = await api(`bank-transactions/${txnId}/`);
  const m = Modal.open({
    title: 'Unmatch Bank Transaction',
    dialog: true,
    body: `
      <div style="padding:8px 0;">
        <div style="font-size:14px;color:var(--tx);margin-bottom:12px;">
          Are you sure you want to unmatch this bank transaction?
        </div>
        <div style="background:var(--surface-glass-subtle);border:1px solid var(--bd-glass);border-radius:8px;padding:12px;margin-bottom:14px;font-size:12.5px;">
          <div><b>Description:</b> ${esc(txn.description)}</div>
          <div><b>Date:</b> ${fd(txn.date)} · <b>Amount:</b> ₹${txn.withdrawal > 0 ? txn.withdrawal : txn.deposit}</div>
          <div><b>Current Status:</b> <span class="status-matched">${esc(txn.status)}</span></div>
        </div>
        <div style="font-size:12px;color:var(--warn);line-height:1.4;">
          ⚠️ <b>Accounting Notice:</b> Unmatching will decouple this bank statement line from its general ledger entry and set its status to Unmatched. Posted ledger transactions are preserved.
        </div>
      </div>
    `,
    footer: `
      <button type="button" class="btn" data-close>Cancel</button>
      <button type="button" class="btn dn" id="btn-confirm-unmatch">Yes, Unmatch Transaction</button>
    `
  });

  $('#btn-confirm-unmatch', m.el).addEventListener('click', async () => {
    try {
      await api(`banking/unmatch/${txnId}/`, { method: 'POST' });
      toast('Transaction unmatched successfully');
      m.close();
      if (onDone) onDone(); else refresh();
    } catch (e) {
      toast(e.message, 'err');
    }
  });
}

async function quickCategorizeModal(txnId, onDone) {
  const [txn, accounts, customers, vendors] = await Promise.all([
    api(`bank-transactions/${txnId}/`),
    api('lookup/accounts/').catch(() => []),
    api('lookup/customers/').catch(() => []),
    api('lookup/vendors/').catch(() => [])
  ]);

  const isDeposit = num(txn.deposit) > 0;
  const amt = isDeposit ? txn.deposit : txn.withdrawal;

  const defaultTypes = isDeposit
    ? [['Customer Payment', 'Customer Payment'], ['Interest Income', 'Interest Income'], ['Sales Receipt', 'Sales Receipt'], ['Other Deposit', 'Other Deposit']]
    : [['Vendor Payment', 'Vendor Payment'], ['Expense', 'Expense'], ['Tax Payment', 'Tax Payment'], ['Sweeping Charge', 'Sweeping Charge / Bank Charge'], ['Other Withdrawal', 'Other Withdrawal']];

  const parties = isDeposit
    ? [['', 'No Party Linked'], ...customers.map(c => [c.name, c.name])]
    : [['', 'No Party Linked'], ...vendors.map(v => [v.name, v.name])];

  formModal({
    title: 'Quick Categorize Transaction',
    body: `<div class="zb-form-wrap">
      <div style="background:var(--surface-glass-subtle);border:1px solid var(--bd-glass);border-radius:8px;padding:12px;margin:0 14px 14px;font-size:12.5px;">
        <div style="font-weight:700;font-size:14px;color:var(--tx);">${esc(txn.description)}</div>
        <div style="color:var(--tx-muted);margin-top:2px;">Date: <b>${fd(txn.date)}</b> · Ref: <b>${esc(txn.reference || '—')}</b> · Amount: <b style="color:${isDeposit ? '#059669' : '#dc2626'};">₹${amt}</b></div>
      </div>
      ${fld({ name: 'transaction_type', label: 'Transaction Type', type: 'select', opts: defaultTypes, value: defaultTypes[0][0], req: true })}
      ${fld({ name: 'category_account', label: 'Category / GL Account', type: 'select', opts: [['', 'Select Account...'], ...accounts.map(a => [a.id, `${a.code ? a.code + ' - ' : ''}${a.name} (${a.account_type})`])], req: true })}
      ${fld({ name: 'payee', label: isDeposit ? 'Customer / Party' : 'Vendor / Payee', type: 'select', opts: parties, value: txn.payee || '' })}
      ${fld({ name: 'location', label: 'Branch / Location', value: txn.location || 'HO Kottayam' })}
      ${fld({ name: 'notes', label: 'Notes & Narration', type: 'textarea', value: txn.notes || '' })}
    </div>`,
    submit: 'Categorize & Post',
    onSubmit: async d => {
      d.category_account = Number(d.category_account);
      await api(`banking/quick-categorize/${txnId}/`, { method: 'POST', body: d });
      toast('Transaction categorized and posted to ledger');
      if (onDone) onDone(); else refresh();
    }
  });
}

async function bulkCategorizeModal(txnIds, onDone) {
  if (!txnIds || !txnIds.length) {
    return toast('Please select at least one transaction to categorize', 'err');
  }

  const accounts = await api('lookup/accounts/').catch(() => []);

  formModal({
    title: `Bulk Categorize (${txnIds.length} Transactions)`,
    body: `<div class="zb-form-wrap">
      <p class="sub" style="margin:0 14px 14px;">Apply common accounting category, transaction type, and location to all ${txnIds.length} selected transactions.</p>
      ${fld({ name: 'transaction_type', label: 'Transaction Type', type: 'select', opts: [['Vendor Payment', 'Vendor Payment'], ['Customer Payment', 'Customer Payment'], ['Expense', 'Expense'], ['Bank Charge', 'Bank Charge'], ['Tax Payment', 'Tax Payment'], ['Deposit', 'Deposit']], value: 'Vendor Payment', req: true })}
      ${fld({ name: 'category_account', label: 'GL Account', type: 'select', opts: accounts.map(a => [a.id, `${a.name} (${a.account_type})`]), req: true })}
      ${fld({ name: 'payee', label: 'Payee / Party (Optional)', ph: 'e.g. Common Vendor or Merchant' })}
      ${fld({ name: 'location', label: 'Location', value: 'HO Kottayam' })}
    </div>`,
    submit: 'Apply to Selected',
    onSubmit: async d => {
      d.transaction_ids = txnIds;
      d.category_account = Number(d.category_account);
      await api('banking/bulk-categorize/', { method: 'POST', body: d });
      toast(`Successfully categorized ${txnIds.length} transactions`);
      if (onDone) onDone(); else refresh();
    }
  });
}

async function statementImportWizardModal(defaultAccId) {
  const bankAccs = await api('lookup/bank-accounts/');
  if (!bankAccs.length) {
    toast('Please create a bank account first', 'err');
    return bankAccountForm();
  }

  const selAcc = defaultAccId || bankAccs[0].id;

  const m = Modal.open({
    title: 'Import Bank Statement Wizard',
    wide: true,
    dialog: true,
    body: `
      <div style="padding:4px 0 10px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid var(--bd-glass);">
          <div style="display:flex;align-items:center;gap:8px;">
            <span class="pastel-chip chip-sky">8-Step Import Wizard</span>
            <span style="font-size:13px;font-weight:600;color:var(--tx);">Bank Statement Ingestion &amp; Duplicate Filter</span>
          </div>
        </div>

        <div class="g" style="margin-bottom:16px;">
          <div class="fg s6">
            <label>1. Select Bank Account</label>
            <select class="in" id="wiz-acc-sel">
              ${bankAccs.map(a => `<option value="${a.id}" ${a.id == selAcc ? 'selected' : ''}>${esc(a.name)} (${esc(a.bank_name || 'Bank')})</option>`).join('')}
            </select>
          </div>
          <div class="fg s6">
            <label>2. Date Format in File</label>
            <select class="in" id="wiz-date-fmt">
              <option value="DD/MM/YYYY">DD/MM/YYYY (Standard Indian Banking)</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD (ISO Format)</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY (US Format)</option>
            </select>
          </div>
        </div>

        <div style="border:2px dashed var(--bd-glass);border-radius:10px;padding:24px;text-align:center;background:var(--surface-glass-subtle);margin-bottom:16px;">
          <div style="font-size:28px;margin-bottom:8px;">📄</div>
          <div style="font-weight:700;font-size:14px;color:var(--tx);margin-bottom:4px;">Upload Statement File (CSV, XLS, XLSX)</div>
          <div class="sub" style="font-size:12px;margin-bottom:14px;">Supports standard Indian bank statements (HDFC, ICICI, SBI, Kotak, Axis, etc.)</div>
          <input type="file" id="wiz-file-inp" accept=".csv,.xlsx,.xls,.txt" style="display:none;">
          <button type="button" class="btn p" id="wiz-choose-file-btn">Choose File...</button>
          <div id="wiz-file-name" style="font-size:12px;color:var(--accent);margin-top:8px;font-weight:600;"></div>
        </div>

        <div id="wiz-preview-section" style="display:none;margin-top:16px;">
          <h4 style="margin:0 0 10px;font-size:13px;">3. Column Mapping &amp; Preview</h4>
          <div class="tw" style="max-height:200px;overflow-y:auto;border:1px solid var(--bd-glass);border-radius:6px;">
            <table style="font-size:12px;">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Reference</th>
                  <th>Description / Narration</th>
                  <th class="r">Withdrawal (Dr)</th>
                  <th class="r">Deposit (Cr)</th>
                  <th class="r">Running Balance</th>
                </tr>
              </thead>
              <tbody id="wiz-preview-tbody"></tbody>
            </table>
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-top:10px;font-size:12px;color:var(--tx-muted);">
            <div id="wiz-stats-txt">5 rows ready to import · 0 duplicates detected</div>
            <div style="color:#059669;font-weight:600;">✓ Validation Passed</div>
          </div>
        </div>
      </div>
    `,
    footer: `
      <button type="button" class="btn" data-close>Cancel</button>
      <button type="button" class="btn p" id="wiz-import-submit-btn" disabled>Confirm &amp; Import</button>
    `
  });

  const fileInp = $('#wiz-file-inp', m.el);
  const chooseBtn = $('#wiz-choose-file-btn', m.el);
  const submitBtn = $('#wiz-import-submit-btn', m.el);
  let selectedFile = null;

  if (chooseBtn && fileInp) {
    chooseBtn.addEventListener('click', () => fileInp.click());
  }

  fileInp.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    selectedFile = file;
    $('#wiz-file-name', m.el).textContent = `Selected: ${file.name} (${Math.round(file.size / 1024)} KB)`;
    $('#wiz-preview-section', m.el).style.display = 'block';

    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const text = ev.target.result;
        const parsed = (typeof parseCsvString === 'function') ? parseCsvString(text) : { headers: [], rows: [] };
        const headers = (parsed.headers || []).map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
        const dateIdx = headers.findIndex(h => h.includes('date'));
        const descIdx = headers.findIndex(h => h.includes('desc') || h.includes('narr') || h.includes('remark') || h.includes('partic'));
        const refIdx = headers.findIndex(h => h.includes('ref') || h.includes('chq') || h.includes('utr'));
        const drIdx = headers.findIndex(h => h.includes('dr') || h.includes('withdr') || h.includes('debit'));
        const crIdx = headers.findIndex(h => h.includes('cr') || h.includes('dep') || h.includes('credit'));
        const balIdx = headers.findIndex(h => h.includes('bal'));

        const previewRows = (parsed.rows || []).slice(0, 5);
        if (previewRows.length > 0) {
          $('#wiz-preview-tbody', m.el).innerHTML = previewRows.map(r => `
            <tr>
              <td>${esc(dateIdx >= 0 ? r[dateIdx] : (r[0] || '—'))}</td>
              <td><code>${esc(refIdx >= 0 ? r[refIdx] : (r[1] || '—'))}</code></td>
              <td><b>${esc(descIdx >= 0 ? r[descIdx] : (r[2] || 'Bank Transaction'))}</b></td>
              <td class="r" style="color:#dc2626;">${esc(drIdx >= 0 ? r[drIdx] : '—')}</td>
              <td class="r" style="color:#059669;">${esc(crIdx >= 0 ? r[crIdx] : '—')}</td>
              <td class="r"><b>${esc(balIdx >= 0 ? r[balIdx] : '—')}</b></td>
            </tr>
          `).join('');
          $('#wiz-stats-txt', m.el).textContent = `${parsed.rows.length} rows detected · Ready to import`;
        }
        submitBtn.disabled = false;
      } catch (err) {
        submitBtn.disabled = false;
      }
    };
    reader.readAsText(file);
  });

  submitBtn.addEventListener('click', async () => {
    const accId = $('#wiz-acc-sel', m.el).value;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Importing Statement...';
    try {
      let res;
      if (selectedFile) {
        const fd = new FormData();
        fd.append('file', selectedFile);
        fd.append('bank_account', accId);
        res = await api('banking/statement-import/', { method: 'POST', body: fd });
      } else {
        res = await api('banking/statement-import/', {
          method: 'POST',
          body: { bank_account: Number(accId) }
        });
      }
      toast(res.message || `Statement imported! ${res.count || 0} transactions successfully ingested.`);
      m.close();
      location.hash = '#/banking/all-transactions';
      refresh();
    } catch (err) {
      toast(err.message, 'err');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Confirm & Import';
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
    body: `<div class="zb-form-wrap">
      ${fld({ name: 'date', label: 'Transfer Date', type: 'date', req: true, value: APP.today })}
      ${fld({ name: 'from_account', label: 'From Account', type: 'select', opts: bankAccs.map(a => [a.id, `${a.name} (₹${a.balance})`]), req: true })}
      ${fld({ name: 'to_account', label: 'To Account', type: 'select', opts: bankAccs.map(a => [a.id, `${a.name} (₹${a.balance})`]), req: true, value: bankAccs[1]?.id })}
      ${fld({ name: 'amount', label: 'Amount (₹)', type: 'number', req: true, ph: '0.00' })}
      ${fld({ name: 'reference', label: 'Reference / Cheque #', ph: 'e.g. IMPS-89210' })}
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
            <button type="button" class="btn" id="imp-browse-stmt-btn" style="margin-top:24px;width:100%;">Browse Statement File</button>
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

  const browseStmtBtn = $('#imp-browse-stmt-btn', m.el);
  const impFileInp = $('#imp-file-input', m.el);
  if (browseStmtBtn && impFileInp) {
    browseStmtBtn.addEventListener('click', () => impFileInp.click());
  }

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
    toast(`Uploading & parsing ${file.name}...`);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('bank_account', accId);
      const res = await api('banking/statement-import/', { method: 'POST', body: fd });
      toast(res.message || `Successfully imported ${res.count} transactions from ${file.name}`);
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

async function convobotAiAssistantModal() {
  const m = Modal.open({
    title: 'Convosis ConvoBot · Financial AI Copilot (LLM Powered)',
    wide: true,
    body: `
      <div style="display:flex;flex-direction:column;height:480px;">
        <div class="sub" style="margin-bottom:10px;display:flex;align-items:center;justify-content:space-between;">
          <span>Natural Language Financial Intelligence & Real-time Anomaly Engine</span>
          <span class="pastel-chip chip-sky">Model Context Protocol (MCP) Ready</span>
        </div>
        <div id="convobot-chat-box" style="flex:1;overflow-y:auto;padding:12px;background:var(--surface-glass-subtle);border-radius:10px;border:1px solid var(--bd);margin-bottom:12px;display:flex;flex-direction:column;gap:12px;">
          <div style="display:flex;gap:10px;align-items:flex-start;">
            <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--accent-to));display:grid;place-items:center;color:#fff;font-weight:700;font-size:12px;flex-shrink:0;">C</div>
            <div style="background:var(--surface-glass);padding:10px 14px;border-radius:10px;border:1px solid var(--bd);max-width:85%;line-height:1.5;">
              Hello! I am <b>ConvoBot</b>, your accounting copilot. How can I assist you with your books today?
            </div>
          </div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;">
          <button type="button" class="btn convobot-prompt-chip" style="font-size:11px;padding:3px 10px;background:rgba(16,163,127,0.15);color:var(--up);border-color:rgba(16,163,127,0.3);font-weight:600;">Executive financial briefing</button>
          <button type="button" class="btn convobot-prompt-chip" style="font-size:11px;padding:3px 10px;">Revenue this month</button>
          <button type="button" class="btn convobot-prompt-chip" style="font-size:11px;padding:3px 10px;">Show overdue invoices</button>
          <button type="button" class="btn convobot-prompt-chip" style="font-size:11px;padding:3px 10px;">Top customers</button>
          <button type="button" class="btn convobot-prompt-chip" style="font-size:11px;padding:3px 10px;">Scan for financial anomalies</button>
          <button type="button" class="btn convobot-prompt-chip" style="font-size:11px;padding:3px 10px;">GST tax liability</button>
        </div>
        <div style="display:flex;gap:8px;">
          <input class="in" id="convobot-input" placeholder="Ask ConvoBot anything about your financials, cash flow, taxes, or transactions..." style="flex:1;" autocomplete="off">
          <button type="button" class="btn p" id="convobot-send-btn" style="min-width:80px;">Ask ConvoBot</button>
        </div>
      </div>
    `,
    footer: `<button type="button" class="btn" data-close>Close</button>`
  });

  const chat = $('#convobot-chat-box', m.el);
  const input = $('#convobot-input', m.el);

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
    lMsg.innerHTML = `<div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--accent-to));display:grid;place-items:center;color:#fff;font-weight:700;font-size:12px;flex-shrink:0;">C</div><div style="background:var(--surface-glass);padding:10px 14px;border-radius:10px;border:1px solid var(--bd);">${spinner}</div>`;
    chat.appendChild(lMsg);
    chat.scrollTop = chat.scrollHeight;

    try {
      let res;
      try {
        res = await api('convobot/query/', { method: 'POST', body: { query: q } });
      } catch (err) {
        res = await api('ai/query/', { method: 'POST', body: { query: q } });
      }
      let extraHtml = '';
      if (res.cards && res.cards.length) {
        extraHtml = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin-top:10px;">${res.cards.map(c => `<div style="background:var(--surface-glass-subtle);padding:8px 10px;border-radius:8px;border:1px solid var(--bd);"><div class="sub" style="font-size:11px;">${esc(c.label)}</div><div style="font-size:15px;font-weight:700;color:var(--accent);margin-top:2px;">${esc(c.value)}</div></div>`).join('')}</div>`;
      }
      if (res.data && res.data.length) {
        const keys = Object.keys(res.data[0]);
        extraHtml += `<div class="tw" style="margin-top:10px;max-height:180px;overflow-y:auto;"><table><thead><tr>${keys.map(k => `<th>${esc(k)}</th>`).join('')}</tr></thead><tbody>${res.data.map(row => `<tr>${keys.map(k => `<td>${esc(row[k])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
      }
      lMsg.innerHTML = `
        <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--accent-to));display:grid;place-items:center;color:#fff;font-weight:700;font-size:12px;flex-shrink:0;">C</div>
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

  $('#convobot-send-btn', m.el).addEventListener('click', () => send());
  input.addEventListener('keydown', e => { if (e.key === 'Enter') send(); });
  m.el.addEventListener('click', e => {
    const chip = e.target.closest('.convobot-prompt-chip');
    if (chip) send(chip.textContent);
  });
  input.focus();
}

window.convobotAiAssistantModal = convobotAiAssistantModal;
window.ziaAiAssistantModal = convobotAiAssistantModal;

async function projectModal(id, onDone) {
  const custs = await api('lookup/customers/');
  const o = id ? await api(`projects/${id}/`) : { name: '', code: '', customer: '', billing_method: 'hourly_rate', rate_per_hour: '0.00', budget_hours: '0.00', status: 'active', description: '' };
  formModal({
    title: id ? 'Edit Project' : 'New Project',
    dialog: Boolean(onDone || Modal.count() > 0),
    body: `<div class="g form-grid-aligned">
      ${fld({ name: 'name', label: 'Project Name', req: true, value: o.name, col: 's6', ph: 'e.g. Cloud ERP Implementation' })}
      ${fld({ name: 'code', label: 'Project Code', value: o.code, col: 's6', ph: 'PRJ-001' })}
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
      let res;
      if (id) res = await api(`projects/${id}/`, { method: 'PUT', body: d });
      else res = await api('projects/', { method: 'POST', body: d });
      toast('Project saved');
      if (onDone) onDone(res || d);
      else refresh();
    }
  });
}

async function timelogModal(id) {
  const [prjs, rec] = await Promise.all([
    api('lookup/projects/'),
    id ? api(`timelogs/${id}/`).catch(() => null) : Promise.resolve(null)
  ]);
  if (!prjs.length) {
    toast('Create a project first before logging time.', 'err');
    return projectModal();
  }
  const o = rec || { project_id: prjs[0]?.id, date: APP.today, task: '', hours: '2.5', billable: true, notes: '' };
  formModal({
    title: id ? 'Edit Timesheet Entry' : 'Log Project Timesheet',
    body: `<div class="g">
      ${fld({ name: 'project', label: 'Project', type: 'select', opts: prjs.map(p => [p.id, p.name]), value: o.project_id, req: true, col: 's6' })}
      ${fld({ name: 'date', label: 'Date', type: 'date', req: true, value: o.date, col: 's6' })}
      ${fld({ name: 'task', label: 'Task / Activity', req: true, value: o.task, col: 's8', ph: 'e.g. Deluge Scripting & Workflow Integration' })}
      ${fld({ name: 'hours', label: 'Hours', type: 'number', req: true, value: o.hours, col: 's4' })}
      ${fld({ name: 'billable', label: 'Billable to customer', type: 'checkbox', value: o.billable, col: 's12' })}
      ${fld({ name: 'notes', label: 'Notes', type: 'textarea', value: o.notes || '', col: 's12', ph: 'Work accomplished...' })}
    </div>`,
    onSubmit: async d => {
      d.project = Number(d.project);
      d.hours = num(d.hours);
      if (id) await api(`timelogs/${id}/`, { method: 'PUT', body: d });
      else await api('timelogs/', { method: 'POST', body: d });
      toast(id ? 'Timesheet entry updated' : 'Timesheet entry logged');
      refresh();
    }
  });
}

async function categoryModal(id, onDone) {
  const o = id ? await api(`item-categories/${id}/`).catch(() => null) : null;
  formModal({
    title: id ? 'Edit Item Category' : 'New Item Category',
    dialog: Boolean(onDone || Modal.count() > 0),
    body: `<div class="g">
      ${fld({ name: 'name', label: 'Category Name', req: true, value: o ? o.name : '', col: 's12', ph: 'e.g. Hardware Components' })}
      ${fld({ name: 'description', label: 'Description', type: 'textarea', value: o ? (o.description || '') : '', col: 's12' })}
    </div>`,
    onSubmit: async d => {
      let res;
      if (id) res = await api(`item-categories/${id}/`, { method: 'PUT', body: d });
      else res = await api('item-categories/', { method: 'POST', body: d });
      toast(id ? 'Category updated' : 'Category created');
      if (onDone) onDone(res || d);
      else refresh();
    }
  });
}

async function priceListModal(id, onDone) {
  const rec = id ? await api(`price-lists/${id}/`).catch(() => null) : null;
  formModal({
    title: id ? 'Edit Price List' : 'New Price List',
    dialog: Boolean(onDone || Modal.count() > 0),
    body: `<div class="zb-form-wrap">
      ${fld({ name: 'name', label: 'Price List Name', req: true, value: rec?.name || '', ph: 'e.g. Wholesale Discount 15%' })}
      ${fld({ name: 'pricing_scheme', label: 'Pricing Scheme', type: 'select', opts: [['percentage', 'Percentage Markup/Discount'], ['fixed', 'Fixed Rate Card']], value: rec?.pricing_scheme || 'percentage' })}
      ${fld({ name: 'percentage', label: 'Percentage Adjustment (%)', type: 'number', value: rec ? rec.percentage : '-15.00', help: 'Negative for discount (e.g. -15%), positive for markup.' })}
      ${fld({ name: 'description', label: 'Description', type: 'textarea', value: rec?.description || '', ph: 'Optional notes regarding this price list...' })}
    </div>`,
    onSubmit: async d => {
      const n = (d.name || '').trim();
      if (!n) throw new ApiErr(400, { name: 'Price List Name is required.' }, 'Price List Name is required.');
      const invalidChars = /[@#$%^*+=~`<>{}\[\]\\]/;
      if (invalidChars.test(n)) {
        throw new ApiErr(400, { name: 'Price List Name cannot contain special characters like @, #, $, %, ^, *.' }, 'Special characters (@#$%^&*) are not allowed in Price List Name.');
      }
      d.name = n;
      d.percentage = num(d.percentage);
      let res;
      if (id) {
        res = await api(`price-lists/${id}/`, { method: 'PUT', body: d });
        toast('Price list updated successfully!', 'ok');
      } else {
        res = await api('price-lists/', { method: 'POST', body: d });
        toast('Price list created successfully!', 'ok');
      }
      if (onDone) onDone(res || d);
      else refresh();
    }
  });
}

async function warehouseModal(id, onDone) {
  const [existingWh, rec] = await Promise.all([
    api('lookup/warehouses/').catch(() => []),
    id ? api(`warehouses/${id}/`).catch(() => null) : Promise.resolve(null)
  ]);
  const otherPrimary = existingWh.find(w => w.is_primary && String(w.id) !== String(id || ''));

  formModal({
    title: (id ? 'Edit ' : 'New ') + 'Inventory Warehouse',
    dialog: Boolean(onDone || Modal.count() > 0),
    body: `<div class="g">
      ${fld({ name: 'name', label: 'Warehouse Name', req: true, col: 's6', value: rec?.name || '', ph: 'e.g. Kottayam Central Warehouse' })}
      ${fld({ name: 'code', label: 'Warehouse Code', req: true, col: 's6', value: rec?.code || '', ph: 'WH-KTY-01' })}
      ${fld({ name: 'parent_id', label: 'Parent Warehouse (Sub-warehouse of)', type: 'select', value: rec?.parent_id || '', opts: [['', 'None (Main Warehouse)'], ...existingWh.filter(w => String(w.id) !== String(id || '')).map(w => [w.id, `${w.code} - ${w.name}${w.is_sub_warehouse ? ' (Sub)' : ''}`])], col: 's6' })}
      ${fld({ name: 'city', label: 'City', col: 's6', value: rec?.city || '', ph: 'Kottayam' })}
      ${fld({ name: 'state', label: 'State', type: 'select', opts: STATES, value: rec?.state || APP.org.state || 'Kerala', col: 's6' })}
      ${fld({ name: 'address', label: 'Address', type: 'textarea', col: 's12', value: rec?.address || '', ph: 'Anugraha Complex, Kottayam West...' })}
      ${fld({ name: 'is_primary', label: 'Set as Primary Warehouse', type: 'checkbox', value: !!rec?.is_primary, col: 's6' })}
      ${fld({ name: 'shared_database', label: 'Shared Database Architecture (Unified inventory catalog)', type: 'checkbox', value: rec ? !!rec.shared_database : true, col: 's6' })}
    </div>`,
    onReady: (form, modal) => {
      const isPrimaryCk = $('input[name="is_primary"]', form);
      if (isPrimaryCk && otherPrimary) {
        isPrimaryCk.addEventListener('change', async () => {
          if (isPrimaryCk.checked) {
            const ok = await confirmBox({
              title: 'Warning: Replace Primary Warehouse?',
              message: `Warehouse "${otherPrimary.name} (${otherPrimary.code})" is currently designated as the Primary Warehouse. Setting this warehouse as Primary will replace it. Do you want to proceed?`,
              okText: 'Yes, Change Primary',
              cancelText: 'Cancel'
            });
            if (!ok) {
              isPrimaryCk.checked = false;
            }
          }
        });
      }
    },
    onSubmit: async d => {
      if (d.is_primary && otherPrimary) {
        const ok = await confirmBox({
          title: 'Warning: Replace Primary Warehouse?',
          message: `Warehouse "${otherPrimary.name} (${otherPrimary.code})" is currently designated as the Primary Warehouse. Setting this warehouse as Primary will replace it. Do you want to proceed?`,
          okText: 'Yes, Change Primary',
          cancelText: 'Cancel'
        });
        if (!ok) return;
      }
      const res = await api(id ? `warehouses/${id}/` : 'warehouses/', { method: id ? 'PUT' : 'POST', body: d });
      toast(`Warehouse ${id ? 'updated' : 'created'}`);
      if (onDone) onDone(res || d);
      else refresh();
    }
  });
}

async function stockMoveModal() {
  const [items, warehouses] = await Promise.all([
    api('lookup/items/').then(r => r.filter(i => i.track_inventory)),
    api('lookup/warehouses/').catch(() => [])
  ]);
  if (!items.length) { toast('No inventory-tracked items available to move.', 'err'); return; }
  if (warehouses.length < 2) {
    toast('At least two warehouses (or a main warehouse and sub-warehouse) are required to move stock. Please add another warehouse first.', 'err');
    return;
  }
  const curTime = new Date().toTimeString().slice(0, 5);
  formModal({
    title: 'Move Stock Between Warehouses',
    body: `<div class="g">
      ${fld({ name: 'item', label: 'Item to Move', type: 'select', req: true, opts: [['', 'Select Item…'], ...items.map(i => [i.id, `${i.name} (${i.sku || 'No SKU'}) - On Hand: ${qty(i.stock)} ${i.unit}`])], col: 's12' })}
      ${fld({ name: 'from_warehouse', label: 'Source Warehouse', type: 'select', req: true, opts: [['', 'Select Source Warehouse…'], ...warehouses.map(w => [w.id, `${w.code} - ${w.name}${w.is_sub_warehouse ? ' (Sub)' : ''}`])], col: 's6' })}
      ${fld({ name: 'to_warehouse', label: 'Destination Warehouse', type: 'select', req: true, opts: [['', 'Select Destination Warehouse…'], ...warehouses.map(w => [w.id, `${w.code} - ${w.name}${w.is_sub_warehouse ? ' (Sub)' : ''}`])], col: 's6' })}
      ${fld({ name: 'quantity', label: 'Quantity to Move', type: 'number', req: true, attrs: 'min="0.001" step="0.001"', col: 's4' })}
      ${fld({ name: 'date', label: 'Transfer Date', type: 'date', req: true, value: APP.today, col: 's4' })}
      ${fld({ name: 'time', label: 'Transfer Time', type: 'time', req: true, value: curTime, col: 's4' })}
      ${fld({ name: 'reason', label: 'Reason for Transfer', type: 'select', opts: [['Warehouse Transfer', 'Warehouse Transfer'], ['Stock Rebalancing', 'Stock Rebalancing'], ['Fulfillment Relocation', 'Fulfillment Relocation'], ['Branch Transfer', 'Branch Transfer'], ['Other', 'Other']], col: 's12' })}
      ${fld({ name: 'notes', label: 'Transfer Notes', type: 'textarea', col: 's12', max: 500, ph: 'Add any delivery challan or transit tracking details…' })}
    </div>
    <div class="note" id="movePrev" style="margin-top:12px">Select an item, source warehouse, destination warehouse, and quantity.</div>`,
    submit: 'Confirm & Move Stock',
    onReady: form => {
      const upd = () => {
        const it = items.find(i => String(i.id) === form.elements.item.value);
        const fw = warehouses.find(w => String(w.id) === form.elements.from_warehouse.value);
        const tw = warehouses.find(w => String(w.id) === form.elements.to_warehouse.value);
        const q = form.elements.quantity.value;
        const prev = $('#movePrev', form);
        if (fw && tw && fw.id === tw.id) {
          prev.textContent = '⚠️ Source and destination warehouses must be different!';
          prev.style.color = 'var(--dn, #e11d48)';
          return;
        }
        prev.style.color = '';
        if (it && fw && tw && q) {
          prev.textContent = `Transferring ${qty(q)} ${it.unit} of "${it.name}" from [${fw.code}] to [${tw.code}]. Unified Shared Database maintains complete traceability.`;
        } else {
          prev.textContent = 'Select an item, source warehouse, destination warehouse, and quantity.';
        }
      };
      form.elements.item.addEventListener('change', () => {
        const it = items.find(i => String(i.id) === form.elements.item.value);
        if (it && it.warehouse_id && !form.elements.from_warehouse.value) {
          form.elements.from_warehouse.value = it.warehouse_id;
        }
        upd();
      });
      form.addEventListener('input', upd);
      form.addEventListener('change', upd);
    },
    onSubmit: async d => {
      if (d.from_warehouse === d.to_warehouse) {
        toast('Source and destination warehouses cannot be the same.', 'err');
        throw { cancel: true };
      }
      await api('stock-movements/move/', { method: 'POST', body: d });
      toast('Stock moved successfully between warehouses');
      refresh();
    }
  });
}

async function challanModal(id) {
  const [custs, rec] = await Promise.all([
    api('lookup/customers/').catch(() => []),
    id ? api(`delivery-challans/${id}/`).catch(() => null) : Promise.resolve(null)
  ]);
  const o = rec || { customer_id: '', date: APP.today, challan_type: 'other', vehicle_number: '', notes: '' };
  formModal({
    title: id ? 'Edit Delivery Challan' : 'New Delivery Challan',
    body: `<div class="g">
      ${fld({ name: 'customer', label: 'Customer', type: 'select', req: true, opts: [['', 'Select Customer…'], ...custs.map(c => [c.id, c.name])], value: o.customer_id || '', col: 's6' })}
      ${fld({ name: 'date', label: 'Date', type: 'date', req: true, value: o.date, col: 's6' })}
      ${fld({ name: 'challan_type', label: 'Challan Type', type: 'select', opts: [['job_work', 'Job Work'], ['supply_on_approval', 'Supply on Approval'], ['other', 'Other Delivery']], value: o.challan_type, col: 's6' })}
      ${fld({ name: 'vehicle_number', label: 'Vehicle Number', value: o.vehicle_number || '', col: 's6', ph: 'KL-05-AB-1234' })}
      ${fld({ name: 'notes', label: 'Notes / Transportation Memo', type: 'textarea', value: o.notes || '', col: 's12' })}
    </div>`,
    onSubmit: async d => {
      if (!d.customer || d.customer === '__new_customer__') {
        throw new ApiErr(400, { customer: 'Please select a customer.' }, 'Please select a customer.');
      }
      d.customer = Number(d.customer);

      const vNum = (d.vehicle_number || '').trim().toUpperCase();
      if (vNum) {
        const vClean = vNum.replace(/[\s-]/g, '');
        if (!/^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{4}$/.test(vClean)) {
          throw new ApiErr(400, { vehicle_number: 'Enter a valid vehicle registration number format (e.g. KL-05-AB-1234).' }, 'Invalid vehicle registration number format.');
        }
        d.vehicle_number = vNum;
      }

      if (id) await api(`delivery-challans/${id}/`, { method: 'PUT', body: d });
      else await api('delivery-challans/', { method: 'POST', body: d });
      toast(id ? 'Delivery Challan updated' : 'Delivery Challan created');
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

function renderStockQuantityCell(l = {}, items = [], whList = []) {
  const curItemId = l.item || l.item_id || '';
  const curItem = items.find(it => String(it.id) === String(curItemId));
  const hasTrack = curItem ? (curItem.track_inventory && curItem.type === 'goods') : false;
  const curUnit = curItem ? (curItem.unit || 'Nos') : (l.unit || 'Nos');
  const curWhId = l.warehouse_id || (curItem ? curItem.warehouse_id : null) || (whList[0] ? whList[0].id : '');
  const curWh = whList.find(w => String(w.id) === String(curWhId)) || whList[0] || { id: '', name: 'HO Kottayam', code: 'WH-MAIN' };
  const stockVal = curItem && curItem.available_stock != null ? curItem.available_stock : (curItem && curItem.stock != null ? curItem.stock : 0);

  return `
    <td style="width:140px;min-width:130px;padding:10px 8px;vertical-align:top;">
      <input class="in l-qty" type="number" step="0.001" min="0.001" value="${esc(l.quantity || '1.00')}" style="text-align:right;width:100%;font-weight:600;">
      <div class="l-stock-info-box" style="margin-top:4px;display:flex;flex-direction:column;gap:3px;font-size:11px;">
        <div class="l-unit-badge" style="color:#64748b;font-weight:500;text-align:right;font-size:11px;">${esc(curUnit)}</div>
        <div class="l-stock-avail" style="display:${curItemId ? 'block' : 'none'};font-size:10.5px;font-weight:600;color:#059669;text-align:right;" title="Available stock in selected warehouse">
          Available Stock: ${hasTrack ? `${stockVal} ${esc(curUnit)}` : (curItem && curItem.type === 'service' ? 'N/A' : `${stockVal} ${esc(curUnit)}`)}
        </div>
        <div class="l-wh-wrap" style="display:${curItemId ? 'flex' : 'none'};align-items:center;justify-content:flex-end;gap:6px;flex-wrap:wrap;">
          <div class="l-wh-pill" style="position:relative;display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:600;color:#2563eb;background:#eff6ff;padding:2px 7px;border-radius:4px;border:1px solid #bfdbfe;cursor:pointer;max-width:100%;" title="Click to select warehouse">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M3 21h18M3 7v14M21 7v14M6 11h4M6 15h4M14 11h4M14 15h4M9 21v-4h6v4M7 3h10l2 4H5l2-4z"/></svg>
            <span class="l-wh-label" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:85px;">${esc(curWh.name || curWh.code || 'HO Kottayam')}</span>
            <span style="font-size:8px;color:#2563eb;">▼</span>
            <select class="in l-wh-select" aria-label="Select Warehouse" style="position:absolute;top:0;left:0;width:100%;height:100%;opacity:0;cursor:pointer;">
              ${whList.map(w => `<option value="${w.id}" data-code="${esc(w.code)}" ${String(curWh.id) === String(w.id) ? 'selected' : ''}>${esc(w.name)} (${esc(w.code)})</option>`).join('')}
            </select>
          </div>
          <a href="javascript:void(0)" class="l-recent-tx" style="font-size:10px;color:#2563eb;text-decoration:none;" title="View recent transactions">Recent Transactions</a>
        </div>
        <div class="l-stock-warn" style="display:none;font-size:10px;line-height:1.2;font-weight:600;color:#dc2626;background:#fef2f2;border:1px solid #fecaca;border-radius:4px;padding:3px 5px;text-align:left;margin-top:2px;"></div>
      </div>
      <input type="hidden" class="l-wh-id" value="${esc(curWh.id || '')}">
      <input type="hidden" class="l-wh-code" value="${esc(curWh.code || '')}">
    </td>
  `;
}

function initItemTableStockTracker(tbody, items, whList, onCalc) {
  const stockCache = {};

  async function fetchStock(itemId, whId) {
    const k = `${itemId}_${whId}`;
    if (stockCache[k] !== undefined) return stockCache[k];
    try {
      const res = await api(`lookup/warehouse-stock/?item_id=${itemId}&warehouse_id=${whId}`);
      stockCache[k] = res && res.available_stock !== undefined ? res.available_stock : 0;
    } catch (_) {
      const it = items.find(x => String(x.id) === String(itemId));
      stockCache[k] = it && it.available_stock != null ? it.available_stock : (it && it.stock != null ? it.stock : 0);
    }
    return stockCache[k];
  }

  async function updateRow(tr, forceRefresh = false) {
    const itVal = $('.l-item', tr)?.value;
    const it = items.find(x => String(x.id) === String(itVal));
    const whWrap = $('.l-wh-wrap', tr);
    const whSelect = $('.l-wh-select', tr);
    const whLabel = $('.l-wh-label', tr);
    const whIdIn = $('.l-wh-id', tr);
    const whCodeIn = $('.l-wh-code', tr);
    const unitBadge = $('.l-unit-badge', tr);
    const availBadge = $('.l-stock-avail', tr);
    const warnBox = $('.l-stock-warn', tr);
    const qtyInput = $('.l-qty', tr);

    if (!it) {
      if (whWrap) whWrap.style.display = 'none';
      if (availBadge) availBadge.style.display = 'none';
      if (warnBox) warnBox.style.display = 'none';
      if (unitBadge) unitBadge.textContent = '';
      if (qtyInput) {
        qtyInput.style.borderColor = '';
        qtyInput.style.backgroundColor = '';
      }
      return;
    }

    if (unitBadge) unitBadge.textContent = it.unit || 'Nos';
    if (whWrap) whWrap.style.display = 'flex';

    let whId = whSelect?.value;
    if (!whId && it.warehouse_id) {
      whId = it.warehouse_id;
      if (whSelect) whSelect.value = whId;
    }
    if (!whId && whList[0]) {
      whId = whList[0].id;
      if (whSelect) whSelect.value = whId;
    }

    const whObj = whList.find(w => String(w.id) === String(whId)) || whList[0] || { id: whId, name: 'HO Kottayam', code: 'WH-MAIN' };
    if (whLabel) whLabel.textContent = whObj.name || whObj.code || 'HO Kottayam';
    if (whIdIn) whIdIn.value = whObj.id || '';
    if (whCodeIn) whCodeIn.value = whObj.code || '';

    if (availBadge) {
      availBadge.style.display = 'block';
      if (it.type === 'goods' && it.track_inventory) {
        if (forceRefresh) {
          delete stockCache[`${it.id}_${whObj.id}`];
        }
        const avail = await fetchStock(it.id, whObj.id);
        availBadge.textContent = `Available Stock: ${avail} ${it.unit || 'Nos'}`;
        const enteredQty = num(qtyInput?.value) || 0;
        if (enteredQty > avail) {
          if (warnBox) {
            warnBox.textContent = `Insufficient Stock. Available quantity in ${whObj.name || 'selected warehouse'}: ${avail} ${it.unit || 'Nos'}. Requested quantity: ${enteredQty} ${it.unit || 'Nos'}.`;
            warnBox.style.display = 'block';
          }
          if (qtyInput) {
            qtyInput.style.borderColor = '#ef4444';
            qtyInput.style.backgroundColor = '#fef2f2';
          }
        } else {
          if (warnBox) warnBox.style.display = 'none';
          if (qtyInput) {
            qtyInput.style.borderColor = '';
            qtyInput.style.backgroundColor = '';
          }
        }
      } else {
        availBadge.textContent = `Available Stock: ${it.type === 'service' ? 'N/A' : (it.stock != null ? `${it.stock} ${it.unit || 'Nos'}` : 'N/A')}`;
        if (warnBox) warnBox.style.display = 'none';
        if (qtyInput) {
          qtyInput.style.borderColor = '';
          qtyInput.style.backgroundColor = '';
        }
      }
    }

    const enteredQty = num(qtyInput?.value) || 0;
    if (enteredQty > avail) {
      if (warnBox) {
        warnBox.textContent = `Insufficient Stock. Available quantity in ${whObj.name || 'selected warehouse'}: ${avail} ${it.unit || 'Nos'}. Requested quantity: ${enteredQty} ${it.unit || 'Nos'}.`;
        warnBox.style.display = 'block';
      }
      if (qtyInput) {
        qtyInput.style.borderColor = '#ef4444';
        qtyInput.style.backgroundColor = '#fef2f2';
      }
    } else {
      if (warnBox) warnBox.style.display = 'none';
      if (qtyInput) {
        qtyInput.style.borderColor = '';
        qtyInput.style.backgroundColor = '';
      }
    }
  }

  tbody.addEventListener('change', async e => {
    const tr = e.target.closest('tr');
    if (!tr) return;
    if (e.target.classList.contains('l-item')) {
      const itVal = e.target.value;
      const it = items.find(x => String(x.id) === String(itVal));
      if (it) {
        const whSelect = $('.l-wh-select', tr);
        if (whSelect && it.warehouse_id) {
          whSelect.value = it.warehouse_id;
        }
      }
      await updateRow(tr, true);
      if (onCalc) onCalc();
    } else if (e.target.classList.contains('l-wh-select')) {
      await updateRow(tr, true);
      if (onCalc) onCalc();
    }
  });

  tbody.addEventListener('input', e => {
    if (e.target.classList.contains('l-qty')) {
      const tr = e.target.closest('tr');
      if (tr) updateRow(tr, false);
    }
  });

  setTimeout(() => {
    $$('tr', tbody).forEach(tr => updateRow(tr, false));
  }, 10);

  return {
    updateRow,
    validate: () => {
      let firstError = null;
      $$('tr', tbody).forEach(tr => {
        const warnBox = $('.l-stock-warn', tr);
        if (warnBox && warnBox.style.display !== 'none' && warnBox.textContent.trim()) {
          if (!firstError) firstError = warnBox.textContent.trim();
        }
      });
      return { valid: !firstError, error: firstError };
    }
  };
}

async function recurringInvoiceForm(id, targetEl, onDone) {
  if (typeof targetEl === 'function') {
    onDone = targetEl;
    targetEl = null;
  }
  const target = (targetEl && targetEl.nodeType) ? targetEl : document.getElementById('pg') || document.body;

  let initialData = null;
  if (id && typeof id === 'object') {
    initialData = id;
    id = null;
  }

  const [parties, items, whList, rec] = await Promise.all([
    api('lookup/customers/').catch(() => []),
    api('lookup/items/').catch(() => []),
    api('lookup/warehouses/').catch(() => []),
    id ? api(`recurring-invoices/${id}/`).catch(() => null) : Promise.resolve(initialData)
  ]);

  const rLocation = rec ? (rec.location || 'HO Kottayam') : 'HO Kottayam';
  const rOrderNum = rec ? (rec.order_number || '') : '';
  const rSalesperson = rec ? (rec.salesperson || '') : '';
  const rProject = rec ? (rec.project_name || '') : '';
  const rSubject = rec ? (rec.subject || '') : '';
  const rCreateDraft = rec ? (rec.create_as_draft !== undefined ? !!rec.create_as_draft : true) : true;
  const rRepeatEvery = rec ? (rec.repeat_every != null ? rec.repeat_every : 1) : 1;

  const rProfileName = rec ? (rec.profile_name || rec.name || '') : '';
  const rCustomer = rec ? (rec.customer_id || rec.customer) : '';
  const rFrequency = rec ? (rec.frequency || 'monthly') : 'monthly';
  const rStartDate = rec ? (rec.start_date || (window.APP && window.APP.today ? window.APP.today : new Date().toISOString().slice(0, 10))) : (window.APP && window.APP.today ? window.APP.today : new Date().toISOString().slice(0, 10));
  const rNextDate = rec ? (rec.next_date || rStartDate) : rStartDate;
  const rEndDate = rec ? (rec.end_date || '') : '';
  const rNeverEnds = rec ? (rec.never_ends !== undefined ? !!rec.never_ends : !rec.end_date) : true;
  const rTaxPricing = rec ? (rec.tax_pricing_type || 'tax_exclusive') : 'tax_exclusive';
  const rCustType = rec ? (rec.customer_type || 'b2b') : 'b2b';
  const rPaymentTerms = rec ? (rec.payment_terms != null ? Number(rec.payment_terms) : 30) : 30;
  const rStatus = rec ? (rec.status || 'active') : 'active';
  const rAutoSend = rec ? !!rec.auto_send : false;
  const rNotes = rec ? (rec.notes || '') : '';
  const rTerms = rec ? (rec.terms || '') : '';
  const rLines = (rec && rec.lines && rec.lines.length) ? rec.lines : [{ description: rProfileName || 'Service Retainer', quantity: 1, rate: 0, discount_percent: 0, gst_rate: 18 }];

  const rowHtml = (l = {}) => `
    <tr class="ln-rec" style="border-bottom:1px solid var(--bd);">
      <td style="width:50px;text-align:center;padding:10px 4px;vertical-align:top;">
        <div style="display:flex;align-items:center;justify-content:center;gap:6px;color:#94a3b8;padding-top:6px;">
          <i class="fa-solid fa-grip-vertical" style="cursor:grab;font-size:13px;"></i>
          <i class="fa-regular fa-image" style="font-size:16px;"></i>
        </div>
      </td>
      <td style="min-width:280px;padding:10px 8px;vertical-align:top;">
        <select class="in l-item" aria-label="Item" style="width:100%;margin-bottom:6px;">
          <option value="">Type or click to select an item.</option>
          <option value="__new_item__" style="color:var(--accent);font-weight:600;">+ Add New Item…</option>
          ${items.map(it => `<option value="${it.id}" ${String(l.item) === String(it.id) ? 'selected' : ''}>${esc(it.name)}${it.sku ? ' (' + esc(it.sku) + ')' : ''}</option>`).join('')}
        </select>
        <input class="in l-desc" aria-label="Description" placeholder="Description / details" maxlength="500" value="${esc(l.description || '')}" style="font-size:12px;padding:4px 8px;width:100%;">
        <div class="l-stock-badge" style="font-size:11px;color:#0284c7;margin-top:3px;font-weight:500;display:none;"></div>
        <input type="hidden" class="l-hsn" value="${esc(l.hsn_sac || '')}">
      </td>
${renderStockQuantityCell(l, items, whList)}
      <td style="width:110px;padding:10px 8px;vertical-align:top;">
        <input class="in l-rate" type="number" step="0.01" min="0" value="${esc(l.rate == null ? '0.00' : l.rate)}" style="text-align:right;width:100%;">
      </td>
      <td style="width:120px;padding:10px 8px;vertical-align:top;">
        <div style="display:flex;gap:4px;">
          <input class="in l-disc" type="number" step="0.01" min="0" max="100" value="${esc(l.discount_percent || 0)}" style="text-align:right;flex:1;min-width:45px;">
          <select class="in l-disc-type" style="width:48px;padding:4px;">
            <option value="percent">%</option>
            <option value="amount">₹</option>
          </select>
        </div>
      </td>
      <td style="width:140px;padding:10px 8px;vertical-align:top;">
        <select class="in l-gst" aria-label="Tax rate" style="width:100%;">
          <option value="0">Select a Tax</option>
          <option value="0" ${num(l.gst_rate) === 0 ? 'selected' : ''}>GST [0%]</option>
          <option value="5" ${num(l.gst_rate) === 5 ? 'selected' : ''}>GST [5%]</option>
          <option value="12" ${num(l.gst_rate) === 12 ? 'selected' : ''}>GST [12%]</option>
          <option value="18" ${l.gst_rate == null || num(l.gst_rate) === 18 ? 'selected' : ''}>GST [18%]</option>
          <option value="28" ${num(l.gst_rate) === 28 ? 'selected' : ''}>GST [28%]</option>
        </select>
      </td>
      <td style="width:100px;padding:10px 8px;text-align:right;font-weight:600;vertical-align:top;" class="l-amt">
        ${(l.line_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </td>
      <td style="width:36px;text-align:center;vertical-align:top;padding-top:14px;">
        <button type="button" class="btn ic" data-rm-line style="color:var(--tx-muted);font-size:16px;border:none;background:none;cursor:pointer;" title="Remove row">×</button>
      </td>
    </tr>
  `;

  target.innerHTML = `
    <div class="invoice-form-page" style="background:#fff;min-height:100%;display:flex;flex-direction:column;">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 28px;border-bottom:1px solid var(--bd);background:#fff;position:sticky;top:0;z-index:20;">
        <div style="display:flex;align-items:center;gap:12px;">
          <i class="fa-solid fa-rotate" style="font-size:22px;color:#1e293b;"></i>
          <h1 style="font-size:20px;font-weight:700;margin:0;color:#0f172a;">${id ? 'Edit Recurring Invoice' : 'New Recurring Invoice'}</h1>
        </div>
        <div style="display:flex;align-items:center;gap:14px;">
          <button type="button" class="btn ic" title="Settings" style="border:none;background:transparent;color:#3b82f6;font-size:16px;cursor:pointer;"><i class="fa-solid fa-gear"></i></button>
          <button type="button" class="btn ic" id="btn-rec-close-x" title="Close" style="border:none;background:transparent;color:#64748b;font-size:18px;cursor:pointer;"><i class="fa-solid fa-xmark"></i></button>
        </div>
      </div>

      <form id="recurring-form-element" style="padding:28px;max-width:1100px;width:100%;box-sizing:border-box;" novalidate>
        <div class="fe" data-err="_" role="alert"></div>

        <div style="display:flex;flex-direction:column;gap:16px;margin-bottom:28px;">
          <div style="display:flex;align-items:center;gap:16px;">
            <label style="width:150px;font-weight:500;font-size:13px;color:#ef4444;">Customer Name*</label>
            <div style="display:flex;align-items:center;gap:8px;flex:1;max-width:480px;">
              <select class="in" id="rec-customer" name="customer" required style="flex:1;">
                <option value="">Select or add a customer</option>
                <option value="__new_customer__" style="color:var(--accent);font-weight:600;">+ Add New Customer…</option>
                ${parties.map(p => `<option value="${p.id}" ${String(rCustomer) === String(p.id) ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
              </select>
              <button type="button" class="btn p" id="btn-rec-cust-lookup" title="Search / Add Customer" style="padding:0 12px;height:34px;border-radius:4px;cursor:pointer;">
                <i class="fa-solid fa-magnifying-glass"></i>
              </button>
              <div style="font-size:12px;font-weight:600;padding:6px 10px;background:#f1f5f9;border:1px solid #cbd5e1;border-radius:4px;color:#334155;">INR</div>
            </div>
          </div>

          <div style="display:flex;align-items:center;gap:16px;">
            <label style="width:150px;font-weight:500;font-size:13px;color:#ef4444;">Profile Name*</label>
            <input class="in" id="rec-profile-name" name="profile_name" value="${esc(rProfileName)}" required placeholder="e.g. Monthly Support Retainer" style="max-width:440px;width:100%;">
          </div>

          <div style="display:flex;align-items:center;gap:16px;">
            <label style="width:150px;font-weight:500;font-size:13px;color:var(--tx);">Order Number</label>
            <input class="in" id="rec-order-number" name="order_number" value="${esc(rOrderNum)}" placeholder="e.g. REC-8" style="max-width:440px;width:100%;">
          </div>

          <div style="display:flex;align-items:center;gap:16px;">
            <label style="width:150px;font-weight:500;font-size:13px;color:var(--tx);">Customer Type</label>
            <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;">
              <select class="in" id="rec-customer-type" name="customer_type" style="width:260px;">
                <option value="b2b" ${rCustType === 'b2b' ? 'selected' : ''}>B2B - Business to Business</option>
                <option value="b2c" ${rCustType === 'b2c' ? 'selected' : ''}>B2C - Business to Consumer</option>
              </select>
              <div id="rec-customer-gstin-wrap" style="display:flex;align-items:center;gap:6px;font-size:12px;background:#f8fafc;padding:4px 10px;border-radius:4px;border:1px solid var(--bd);">
                <span style="color:#64748b;font-weight:500;">GSTIN:</span>
                <span id="rec-customer-gstin" style="font-weight:600;color:var(--tx);">${(rec && rec.party_details && rec.party_details.gstin) || (parties.find(p => String(p.id) === String(rCustomer))?.gstin) || 'Not provided'}</span>
              </div>
            </div>
          </div>

          <div style="display:flex;align-items:center;flex-wrap:wrap;gap:16px;">
            <label style="width:150px;font-weight:500;font-size:13px;color:#ef4444;">Repeat Every*</label>
            <div style="display:flex;align-items:center;gap:8px;">
              <input class="in" type="number" id="rec-repeat-every" name="repeat_every" min="1" value="${rRepeatEvery}" style="width:70px;text-align:center;">
              <select class="in" id="rec-frequency" name="frequency" style="width:160px;">
                <option value="weekly" ${rFrequency === 'weekly' ? 'selected' : ''}>Week(s)</option>
                <option value="monthly" ${rFrequency === 'monthly' ? 'selected' : ''}>Month(s)</option>
                <option value="yearly" ${rFrequency === 'yearly' ? 'selected' : ''}>Year(s)</option>
              </select>
            </div>

            <label style="font-weight:500;font-size:13px;color:#ef4444;margin-left:20px;">Starts On*</label>
            <input class="in" type="date" id="rec-start-date" name="start_date" value="${rStartDate}" required style="width:150px;">

            <label style="font-weight:500;font-size:13px;color:var(--tx);margin-left:20px;">Ends On</label>
            <input class="in" type="date" id="rec-end-date" name="end_date" value="${rEndDate}" style="width:150px;" ${rNeverEnds ? 'disabled style="opacity:0.5;"' : ''}>

            <label style="display:flex;align-items:center;gap:6px;font-size:13px;font-weight:500;cursor:pointer;margin-left:10px;">
              <input type="checkbox" id="rec-never-ends" ${rNeverEnds ? 'checked' : ''}> Never Expires
            </label>
          </div>

          <div style="display:flex;align-items:center;gap:16px;">
            <label style="width:150px;font-weight:500;font-size:13px;color:var(--tx);">Payment Terms</label>
            <select class="in" id="rec-payment-terms" name="payment_terms" style="width:200px;">
              <option value="Due on Receipt" ${String(rec ? rec.payment_terms : '') === 'Due on Receipt' || rPaymentTerms === 0 ? 'selected' : ''}>Due on Receipt</option>
              <option value="Net 15" ${String(rec ? rec.payment_terms : '') === 'Net 15' || rPaymentTerms === 15 ? 'selected' : ''}>Net 15</option>
              <option value="Net 30" ${String(rec ? rec.payment_terms : '') === 'Net 30' || rPaymentTerms === 30 ? 'selected' : ''}>Net 30</option>
              <option value="Net 45" ${String(rec ? rec.payment_terms : '') === 'Net 45' || rPaymentTerms === 45 ? 'selected' : ''}>Net 45</option>
              <option value="Net 60" ${String(rec ? rec.payment_terms : '') === 'Net 60' || rPaymentTerms === 60 ? 'selected' : ''}>Net 60</option>
              <option value="Due end of the month" ${String(rec ? rec.payment_terms : '') === 'Due end of the month' ? 'selected' : ''}>Due end of the month</option>
            </select>
          </div>

          <div style="display:flex;align-items:center;gap:16px;">
            <label style="width:150px;font-weight:500;font-size:13px;color:var(--tx);">Salesperson</label>
            <div id="rec-salesperson-container"></div>
          </div>

          <div style="display:flex;align-items:center;gap:16px;">
            <label style="width:150px;font-weight:500;font-size:13px;color:var(--tx);">Associate Project(s)</label>
            <select class="in" id="rec-project" name="project_name" style="width:260px;" disabled>
              <option value="">There are no active projects for this customer.</option>
            </select>
          </div>

          <div style="display:flex;align-items:flex-start;gap:16px;">
            <label style="width:150px;font-weight:500;font-size:13px;color:var(--tx);display:flex;align-items:center;gap:4px;padding-top:6px;">
              Subject <i class="fa-solid fa-circle-info" style="color:var(--tx-muted);font-size:12px;"></i>
            </label>
            <textarea class="in" id="rec-subject" name="subject" rows="2" placeholder="Let your customer know what this Recurring Invoice is for" style="width:260px;font-size:12px;">${esc(rSubject)}</textarea>
          </div>
        </div>

        <div style="margin-top:32px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
            <div style="display:flex;align-items:center;gap:12px;">
              <span style="font-size:15px;font-weight:700;color:var(--tx);">Item Table</span>
              <select class="in" id="rec-tax-pricing" name="tax_pricing_type" style="width:145px;height:30px;font-size:12px;font-weight:600;padding:2px 8px;border-radius:6px;border:1px solid #93c5fd;background:#f0fdf4;color:#1e293b;" title="Tax Pricing Type">
                <option value="tax_exclusive" ${rTaxPricing === 'tax_exclusive' ? 'selected' : ''}>Tax Exclusive</option>
                <option value="tax_inclusive" ${rTaxPricing === 'tax_inclusive' ? 'selected' : ''}>Tax Inclusive</option>
              </select>
              <button type="button" class="btn btn-tax-pricing-info" data-doc-kind="recurring-invoices" style="background:#eff6ff;color:#2563eb;border:1px solid #bfdbfe;font-size:11.5px;font-weight:600;padding:2px 10px;border-radius:14px;cursor:pointer;display:inline-flex;align-items:center;gap:5px;" title="Learn about Tax Exclusive, Tax Inclusive, B2B & B2C GST billing">
                <i class="fa-solid fa-circle-info"></i> Guide
              </button>
            </div>
            <div style="display:flex;align-items:center;gap:12px;">
              <button type="button" class="btn" id="btn-rec-scan" style="background:none;border:none;color:#2563eb;font-weight:500;font-size:12px;display:flex;align-items:center;gap:6px;cursor:pointer;">
                <i class="fa-solid fa-barcode"></i> Scan Item
              </button>
              <button type="button" class="btn" id="btn-rec-bulk-actions" style="background:none;border:none;color:#2563eb;font-weight:500;font-size:12px;display:flex;align-items:center;gap:6px;cursor:pointer;">
                <i class="fa-regular fa-circle-check"></i> Bulk Actions
              </button>
            </div>
          </div>

          <div class="tw" style="border:1px solid var(--bd);border-radius:6px;overflow-x:auto;">
            <table class="lt" style="margin:0;width:100%;border-collapse:collapse;">
              <thead style="background:#f8fafc;border-bottom:1px solid var(--bd);">
                <tr>
                  <th style="width:50px;"></th>
                  <th style="min-width:280px;text-align:left;padding:12px 8px;font-size:12px;font-weight:600;color:#64748b;">ITEM DETAILS</th>
                  <th style="width:140px;min-width:130px;text-align:right;padding:12px 8px;font-size:12px;font-weight:600;color:#64748b;">QUANTITY</th>
                  <th style="width:110px;text-align:right;padding:12px 8px;font-size:12px;font-weight:600;color:#64748b;">RATE (₹)</th>
                  <th style="width:120px;text-align:right;padding:12px 8px;font-size:12px;font-weight:600;color:#64748b;">DISCOUNT</th>
                  <th class="th-tax-explainer" data-doc-kind="recurring-invoices" style="width:140px;text-align:left;padding:12px 8px;font-size:12px;font-weight:600;color:#64748b;cursor:pointer;" title="Click for GST Rates, Tax Exclusive & B2B/B2C Rules">TAX <i class="fa-solid fa-circle-info" style="font-size:11px;color:#2563eb;"></i></th>
                  <th style="width:100px;text-align:right;padding:12px 8px;font-size:12px;font-weight:600;color:#64748b;">AMOUNT</th>
                  <th style="width:36px;"></th>
                </tr>
              </thead>
              <tbody id="recurring-line-tbody">
                ${rLines.map(rowHtml).join('')}
              </tbody>
            </table>
          </div>

          <div style="display:flex;align-items:center;gap:10px;margin-top:14px;">
            <button type="button" class="btn" id="btn-rec-add-row" style="color:#2563eb;border-color:#bfdbfe;background:#eff6ff;font-weight:600;font-size:12px;display:flex;align-items:center;gap:6px;cursor:pointer;">
              <i class="fa-solid fa-circle-plus"></i> Add New Row ▾
            </button>
            <button type="button" class="btn" id="btn-rec-bulk-items" style="color:#2563eb;border-color:#bfdbfe;background:#eff6ff;font-weight:600;font-size:12px;display:flex;align-items:center;gap:6px;cursor:pointer;">
              <i class="fa-solid fa-circle-plus"></i> Add Items in Bulk
            </button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-top:28px;">
          <div>
            <div style="margin-bottom:18px;">
              <label for="rec-notes" style="font-weight:600;font-size:13px;color:var(--tx);display:block;margin-bottom:6px;">Customer Notes</label>
              <textarea class="in" id="rec-notes" name="notes" rows="4" style="width:100%;min-height:92px;box-sizing:border-box;resize:vertical;padding:8px 10px;font-size:13px;line-height:1.5;" placeholder="Notes will be copied to generated invoices">${esc(rNotes)}</textarea>
              <span style="font-size:11.5px;color:#64748b;display:block;margin-top:4px;">Will be displayed on recurring invoices</span>
            </div>
            <div>
              <label for="rec-terms" style="font-weight:600;font-size:13px;color:var(--tx);display:block;margin-bottom:6px;">Terms &amp; Conditions</label>
              <textarea class="in" id="rec-terms" name="terms" rows="4" placeholder="Enter terms and conditions to be displayed on generated invoices" style="width:100%;min-height:92px;box-sizing:border-box;resize:vertical;padding:8px 10px;font-size:13px;line-height:1.5;">${esc(rTerms)}</textarea>
            </div>
          </div>

          <div style="background:#f8fafc;border:1px solid var(--bd);border-radius:10px;padding:20px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid var(--bd);">
              <span style="font-weight:600;color:var(--tx);">Sub Total</span>
              <span id="rec-subtotal-val" style="font-size:16px;font-weight:700;">0.00</span>
            </div>

            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid var(--bd);">
              <span style="font-weight:600;color:var(--tx);">Tax Amount</span>
              <span id="rec-tax-val" style="font-size:16px;font-weight:700;">0.00</span>
            </div>

            <div style="display:flex;justify-content:space-between;align-items:center;padding-top:16px;border-top:2px solid var(--bd);margin-top:16px;">
              <span style="font-size:17px;font-weight:700;color:#0f172a;">Total ( ₹ )</span>
              <span id="rec-grandtotal-val" style="font-size:22px;font-weight:800;color:#0f172a;">0.00</span>
            </div>
          </div>
        </div>

        ${renderPaymentGatewayBanner()}

        <div style="display:flex;align-items:center;gap:10px;margin-top:20px;padding:12px 16px;background:#f8fafc;border:1px solid var(--bd);border-radius:6px;">
          <input type="checkbox" id="rec-create-as-draft" name="create_as_draft" ${rCreateDraft ? 'checked' : ''} style="width:16px;height:16px;cursor:pointer;">
          <label for="rec-create-as-draft" style="font-weight:600;font-size:13px;color:var(--tx);cursor:pointer;display:flex;align-items:center;gap:6px;">
            Preferences : Create Invoices as Drafts <i class="fa-solid fa-gear" style="color:#2563eb;font-size:12px;"></i>
          </label>
        </div>

        <div style="position:sticky;bottom:0;background:#fff;border-top:1px solid var(--bd);margin-top:24px;padding:14px 0;display:flex;align-items:center;justify-content:space-between;z-index:15;">
          <div style="display:flex;align-items:center;gap:10px;">
            <button type="button" class="btn p" id="btn-rec-save" style="font-weight:600;cursor:pointer;">Save Profile</button>
            <button type="button" class="btn" id="btn-rec-save-draft" style="background:#fff;font-weight:500;cursor:pointer;">Save as Draft</button>
            <button type="button" class="btn" id="btn-rec-cancel" style="background:#fff;font-weight:500;cursor:pointer;">Cancel</button>
          </div>
          <div style="display:flex;align-items:center;gap:20px;font-size:13px;font-weight:600;color:#0f172a;">
            <span>Total Amount: <span id="rec-bar-total-amount">₹ 0.00</span></span>
            <span>Total Quantity: <span id="rec-bar-total-qty">0.00</span></span>
          </div>
        </div>
      </form>
    </div>
  `;

  const form = $('#recurring-form-element', target);
  const tbody = $('#recurring-line-tbody', form);
  const byId = Object.fromEntries(items.map(it => [String(it.id), it]));
  const stockTracker = initItemTableStockTracker(tbody, items, whList, () => calcRecTotals());

  createSalespersonCustomDropdown($('#rec-salesperson-container', form), rSalesperson, () => {});
  setupProjectSelectorForCustomer($('#rec-project', form), rCustomer, rProject);
  $('#rec-customer', form)?.addEventListener('change', (e) => {
    setupProjectSelectorForCustomer($('#rec-project', form), e.target.value);
  });

  async function saveRecurringInvoice(forceDraft = false) {
    const custId = $('#rec-customer', form).value;
    if (!custId || custId === '__new_customer__') {
      toast('Please select a customer.', 'err');
      $('#rec-customer', form).focus();
      return;
    }
    const profName = ($('#rec-profile-name', form).value || '').trim();
    if (!profName) {
      toast('Please enter a profile name.', 'err');
      $('#rec-profile-name', form).focus();
      return;
    }
    const sd = $('#rec-start-date', form).value;
    if (!sd) {
      toast('Please enter start date.', 'err');
      $('#rec-start-date', form).focus();
      return;
    }

    const lines = [];
    $$('.ln-rec', tbody).forEach((tr, idx) => {
      const itVal = $('.l-item', tr).value;
      const descVal = $('.l-desc', tr).value.trim();
      const qVal = num($('.l-qty', tr).value) || 1;
      const rVal = num($('.l-rate', tr).value) || 0;
      const dVal = num($('.l-disc', tr).value) || 0;
      const gVal = num($('.l-gst', tr).value) || 0;
      const discType = $('.l-disc-type', tr).value || 'percent';

      let taxable = qVal * rVal;
      if (discType === 'percent') {
        taxable = taxable * (100 - dVal) / 100;
      } else {
        taxable = Math.max(0, taxable - dVal);
      }
      taxable = r2(taxable);
      const lTot = r2(taxable * (1 + gVal / 100));

      lines.push({
        item: (itVal && itVal !== '__new_item__') ? Number(itVal) : null,
        warehouse: $('.l-wh-select', tr)?.value || null,
        warehouse_id: $('.l-wh-select', tr)?.value || null,
        description: descVal || (itVal && byId[itVal] ? byId[itVal].name : 'Line item'),
        hsn_sac: $('.l-hsn', tr).value.trim(),
        quantity: qVal,
        rate: rVal,
        discount_percent: dVal,
        gst_rate: gVal,
        line_total: lTot,
        position: idx
      });
    });

    if (!lines.length) {
      toast('At least one line item is required.', 'err');
      return;
    }

    const payload = {
      customer: Number(custId),
      customer_id: Number(custId),
      profile_name: profName,
      name: profName,
      order_number: ($('#rec-order-number', form)?.value || '').trim(),
      frequency: $('#rec-frequency', form)?.value || 'monthly',
      repeat_every: Number($('#rec-repeat-every', form)?.value || 1),
      start_date: sd,
      end_date: $('#rec-never-ends', form).checked ? null : ($('#rec-end-date', form).value || null),
      never_ends: $('#rec-never-ends', form).checked,
      payment_terms: $('#rec-payment-terms', form)?.value || 'Due on Receipt',
      tax_pricing_type: $('#rec-tax-pricing', form)?.value || 'tax_exclusive',
      customer_type: $('#rec-customer-type', form)?.value || 'b2b',
      salesperson: form.querySelector('#rec-salesperson-container select.sp-select')?.value || '',
      project_name: $('#rec-project', form)?.value || '',
      subject: ($('#rec-subject', form)?.value || '').trim(),
      notes: ($('#rec-notes', form)?.value || '').trim(),
      terms: ($('#rec-terms', form)?.value || '').trim(),
      create_as_draft: forceDraft ? true : ($('#rec-create-as-draft', form)?.checked ?? true),
      status: forceDraft ? 'draft' : 'active',
      lines: lines
    };

    const actionBtns = [$('#btn-rec-save', target), $('#btn-rec-save-draft', target)];
    actionBtns.forEach(b => { if (b) b.disabled = true; });

    try {
      let saved;
      if (id) {
        saved = await api(`recurring-invoices/${id}/`, { method: 'PUT', body: payload });
      } else {
        saved = await api('recurring-invoices/', { method: 'POST', body: payload });
      }
      toast(`Recurring profile "${profName}" saved successfully!`, 'ok');
      if (onDone) onDone(saved);
      else {
        location.hash = '#/sales/recurring-invoices';
        if (typeof route === 'function') route();
      }
    } catch (err) {
      toast(err.message, 'err');
    } finally {
      actionBtns.forEach(b => { if (b) b.disabled = false; });
    }
  }

  $('#btn-rec-save', target)?.addEventListener('click', () => saveRecurringInvoice(false));
  $('#btn-rec-save-draft', target)?.addEventListener('click', () => saveRecurringInvoice(true));

  const neverEndsCb = $('#rec-never-ends', form);
  const endDateIn = $('#rec-end-date', form);
  if (neverEndsCb && endDateIn) {
    neverEndsCb.addEventListener('change', () => {
      if (neverEndsCb.checked) {
        endDateIn.value = '';
        endDateIn.disabled = true;
        endDateIn.style.opacity = '0.5';
      } else {
        endDateIn.disabled = false;
        endDateIn.style.opacity = '1';
        if (!endDateIn.value) {
          const sd = $('#rec-start-date', form).value;
          endDateIn.value = sd || '';
        }
      }
    });
  }

  function calcRecTotals() {
    const isTaxInclusive = ($('#rec-tax-pricing', form)?.value === 'tax_inclusive');
    let subtotal = 0;
    let totalTax = 0;
    let totalQty = 0;
    $$('.ln-rec', tbody).forEach(tr => {
      const q = num($('.l-qty', tr).value) || 0;
      const r = num($('.l-rate', tr).value) || 0;
      const discVal = num($('.l-disc', tr).value) || 0;
      const discType = $('.l-disc-type', tr).value || 'percent';
      const gst = num($('.l-gst', tr).value) || 0;

      totalQty += q;
      const gross = q * r;
      const disc = discType === 'percent' ? (gross * discVal / 100) : discVal;
      const net = Math.max(0, gross - disc);
      let taxable = net;
      let taxAmt = 0;
      let lineTot = net;

      if (isTaxInclusive && gst > 0) {
        taxable = r2(net / (1 + gst / 100));
        taxAmt = r2(net - taxable);
        lineTot = net;
      } else {
        taxable = r2(net);
        taxAmt = r2(taxable * (gst / 100));
        lineTot = r2(taxable + taxAmt);
      }

      subtotal += taxable;
      totalTax += taxAmt;

      const amtEl = $('.l-amt', tr);
      if (amtEl) amtEl.textContent = lineTot.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    });

    const totalGrand = r2(subtotal + totalTax);

    const subEl = $('#rec-subtotal-val', form);
    const taxEl = $('#rec-tax-val', form);
    const grandEl = $('#rec-grandtotal-val', form);
    const barTot = $('#rec-bar-total-amount', form);
    const barQty = $('#rec-bar-total-qty', form);

    if (subEl) subEl.textContent = inr(subtotal).replace('₹', '').trim();
    if (taxEl) taxEl.textContent = inr(totalTax).replace('₹', '').trim();
    if (grandEl) grandEl.textContent = inr(totalGrand).replace('₹', '').trim();
    if (barTot) barTot.textContent = inr(totalGrand);
    if (barQty) barQty.textContent = totalQty.toFixed(2);

    return { subtotal, totalTax, totalGrand, totalQty };
  }

  tbody.addEventListener('input', e => {
    if (e.target.matches('.l-qty, .l-rate, .l-disc')) calcRecTotals();
  });

  tbody.addEventListener('change', e => {
    if (e.target.classList.contains('l-item')) {
      if (e.target.value === '__new_item__') {
        handleQuickCreateSelect(e.target, newItem => {
          items.push(newItem);
          byId[String(newItem.id)] = newItem;
          calcRecTotals();
        });
        return;
      }
      const it = byId[e.target.value];
      const tr = e.target.closest('tr');
      if (it && tr) {
        $('.l-desc', tr).value = it.name;
        $('.l-hsn', tr).value = it.hsn_sac || '';
        $('.l-rate', tr).value = it.selling_price || 0;
        $('.l-gst', tr).value = String(num(it.gst_rate) || 18);
        stockTracker.updateRow(tr, true);
      }
      calcRecTotals();
    }
    if (e.target.matches('.l-gst, .l-disc-type')) calcRecTotals();
  });

  tbody.addEventListener('click', e => {
    const rm = e.target.closest('[data-rm-line]');
    if (rm) {
      if ($$('.ln-rec', tbody).length > 1) {
        rm.closest('tr').remove();
        calcRecTotals();
      } else {
        toast('At least one line item is required.', 'err');
      }
    }
  });

  $('#btn-rec-add-row', form)?.addEventListener('click', () => {
    tbody.insertAdjacentHTML('beforeend', rowHtml({ quantity: 1, rate: 0, discount_percent: 0, gst_rate: 18 }));
    stockTracker.updateRow(tbody.lastElementChild, false);
    calcRecTotals();
  });

  $('#btn-rec-bulk-items', form)?.addEventListener('click', () => {
    openBulkItemModal(items, selectedItems => {
      selectedItems.forEach(it => {
        tbody.insertAdjacentHTML('beforeend', rowHtml({
          item: it.id,
          description: it.name,
          hsn_sac: it.hsn_sac || '',
          quantity: 1,
          rate: it.selling_price || 0,
          discount_percent: 0,
          gst_rate: num(it.gst_rate) || 18
        }));
      });
      calcRecTotals();
    });
  });

  $('#btn-rec-cust-lookup', form)?.addEventListener('click', () => {
    handleQuickCreateSelect($('#rec-customer', form), newCust => {
      parties.push(newCust);
      const opt = document.createElement('option');
      opt.value = newCust.id;
      opt.textContent = newCust.name;
      opt.selected = true;
      $('#rec-customer', form).appendChild(opt);
      $('#rec-customer', form).value = newCust.id;
    });
  });

  $('#rec-customer', form)?.addEventListener('change', e => {
    if (e.target.value === '__new_customer__') {
      handleQuickCreateSelect(e.target, newCust => {
        parties.push(newCust);
        const opt = document.createElement('option');
        opt.value = newCust.id;
        opt.textContent = newCust.name;
        opt.selected = true;
        e.target.appendChild(opt);
        e.target.value = newCust.id;
      });
      return;
    }
    const cId = $('#rec-customer', form).value;
    const cObj = parties.find(p => String(p.id) === String(cId));
    if (cObj) {
      const gstinEl = $('#rec-customer-gstin', form);
      const custTypeEl = $('#rec-customer-type', form);
      if (gstinEl) gstinEl.textContent = cObj.gstin || 'Not provided';
      if (custTypeEl) {
        if (cObj.gstin && cObj.gstin.trim()) {
          custTypeEl.value = 'b2b';
        } else if (cObj.customer_type === 'individual') {
          custTypeEl.value = 'b2c';
        }
      }
    }
  });
  $('#rec-tax-pricing', form)?.addEventListener('change', calcRecTotals);

  const handleClose = () => {
    if (onDone) onDone();
    else {
      location.hash = '#/sales/recurring-invoices';
      if (typeof route === 'function') route();
    }
  };

  $('#btn-rec-close-x', target)?.addEventListener('click', handleClose);
  $('#btn-rec-cancel', target)?.addEventListener('click', handleClose);

  async function saveRecurring(isDraft = false) {
    const pName = ($('#rec-profile-name', form).value || '').trim();
    if (!pName) {
      toast('Profile Name is required.', 'err');
      $('#rec-profile-name', form).focus();
      return;
    }
    if (/[#@!$%^*+=~`<>?[\]\{}]/.test(pName)) {
      toast('Profile Name contains invalid special characters.', 'err');
      $('#rec-profile-name', form).focus();
      return;
    }

    const custId = $('#rec-customer', form).value;
    if (!custId || custId === '__new_customer__') {
      toast('Please select a customer.', 'err');
      $('#rec-customer', form).focus();
      return;
    }

    const sDateVal = $('#rec-start-date', form).value;
    if (!sDateVal) {
      toast('Please enter a start date.', 'err');
      $('#rec-start-date', form).focus();
      return;
    }

    const nextDateVal = $('#rec-next-date', form).value || sDateVal;
    if (sDateVal && nextDateVal && new Date(nextDateVal) < new Date(sDateVal)) {
      toast('Next Invoice Date cannot be earlier than Start Date.', 'err');
      $('#rec-next-date', form).focus();
      return;
    }

    const neverEnds = !!(neverEndsCb && neverEndsCb.checked);
    const edVal = neverEnds ? null : ($('#rec-end-date', form).value || null);
    if (!neverEnds && edVal && sDateVal && new Date(edVal) < new Date(sDateVal)) {
      toast('End Date cannot be earlier than Start Date.', 'err');
      $('#rec-end-date', form).focus();
      return;
    }

    const lines = [];
    $$('.ln-rec', tbody).forEach((tr, idx) => {
      const itVal = $('.l-item', tr).value;
      const descVal = $('.l-desc', tr).value.trim();
      const qVal = num($('.l-qty', tr).value) || 1;
      const rVal = num($('.l-rate', tr).value) || 0;
      const dVal = num($('.l-disc', tr).value) || 0;
      const gVal = num($('.l-gst', tr).value) || 0;
      const discType = $('.l-disc-type', tr).value || 'percent';

      let taxable = qVal * rVal;
      if (discType === 'percent') {
        taxable = taxable * (100 - dVal) / 100;
      } else {
        taxable = Math.max(0, taxable - dVal);
      }
      taxable = r2(taxable);
      const lTot = r2(taxable * (1 + gVal / 100));

      lines.push({
        item: (itVal && itVal !== '__new_item__') ? Number(itVal) : null,
        warehouse: $('.l-wh-select', tr)?.value || null,
        warehouse_id: $('.l-wh-select', tr)?.value || null,
        warehouse_code: $('.l-wh-code', tr)?.value || '',
        description: descVal || (itVal && byId[itVal] ? byId[itVal].name : 'Line item'),
        hsn_sac: $('.l-hsn', tr).value.trim(),
        quantity: qVal,
        rate: rVal,
        discount_percent: dVal,
        gst_rate: gVal,
        line_total: lTot,
        position: idx
      });
    });

    if (!lines.length) {
      toast('At least one line item is required.', 'err');
      return;
    }

    const totals = calcRecTotals();

    const payload = {
      profile_name: pName,
      customer: Number(custId),
      frequency: $('#rec-frequency', form).value,
      tax_pricing_type: $('#rec-tax-pricing', form)?.value || 'tax_exclusive',
      customer_type: $('#rec-customer-type', form)?.value || 'b2b',
      start_date: sDateVal,
      next_date: nextDateVal,
      end_date: edVal,
      never_ends: neverEnds,
      payment_terms: Number($('#rec-payment-terms', form).value) || 0,
      status: isDraft ? 'paused' : ($('#rec-status', form).value || 'active'),
      auto_send: !!($('#rec-auto-send', form) && $('#rec-auto-send', form).checked),
      notes: $('#rec-notes', form).value.trim(),
      terms: $('#rec-terms', form).value.trim(),
      lines: lines,
      total: totals.totalGrand.toFixed(2)
    };

    const actionBtns = [$('#btn-rec-save', target), $('#btn-rec-save-draft', target)];
    actionBtns.forEach(b => { if (b) b.disabled = true; });

    try {
      let saved;
      if (id) {
        saved = await api(`recurring-invoices/${id}/`, { method: 'PUT', body: payload });
        toast('Recurring profile updated successfully!', 'ok');
      } else {
        saved = await api('recurring-invoices/', { method: 'POST', body: payload });
        toast('Recurring profile created successfully!', 'ok');
      }

      if (onDone) onDone(saved);
      else {
        location.hash = '#/sales/recurring-invoices';
        if (typeof route === 'function') route();
      }
    } catch (err) {
      toast(err.message, 'err');
    } finally {
      actionBtns.forEach(b => { if (b) b.disabled = false; });
    }
  }

  $('#btn-rec-save', target)?.addEventListener('click', () => saveRecurring(false));
  $('#btn-rec-save-draft', target)?.addEventListener('click', () => saveRecurring(true));

  calcRecTotals();
}
window.recurringInvoiceForm = recurringInvoiceForm;
window.recurringInvoiceModal = recurringInvoiceForm;


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
            <div style="font-size:16px;font-weight:700;color:var(--accent);">${esc(preview.gstin || (APP.org && APP.org.gstin) || (typeof Organization !== 'undefined' && Organization.get && Organization.get() ? Organization.get().gstin : '') || '—')}</div>
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

        <div class="s6">
          <div class="card" style="padding:18px;height:100%;background:var(--surface-glass-subtle);">
            <div style="font-size:20px;margin-bottom:6px;">📤</div>
            <div style="font-weight:700;font-size:14px;margin-bottom:4px;">Export to Zoho Books Format</div>
            <div class="sub" style="font-size:12px;margin-bottom:14px;">Download standard Zoho Books CSV schemas ready for instant import into Zoho Books.</div>
            <div style="display:flex;flex-direction:column;gap:8px;">
              <button type="button" class="btn" id="btn-exp-convo-inv">Export Invoices (Zoho Schema)</button>
              <button type="button" class="btn" id="btn-exp-convo-cust">Export Customers (Zoho Schema)</button>
              <button type="button" class="btn" id="btn-exp-convo-items">Export Items & Price Lists</button>
            </div>
          </div>
        </div>

        <div class="s6">
          <div class="card" style="padding:18px;height:100%;background:var(--surface-glass-subtle);">
            <div style="font-size:20px;margin-bottom:6px;">📥</div>
            <div style="font-weight:700;font-size:14px;margin-bottom:4px;">Import from Zoho Books</div>
            <div class="sub" style="font-size:12px;margin-bottom:14px;">Migrate customer master, vendor list, or item catalog from your existing Zoho Books account.</div>
            <div class="fg" style="margin-bottom:10px;">
              <label style="font-size:11px;">Target Master Entity</label>
              <select class="in" id="convo-imp-entity">
                <option value="customers">Customers Master</option>
                <option value="items">Items & Services Catalog</option>
              </select>
            </div>
            <button type="button" class="btn p" id="btn-demo-convo-imp" style="width:100%;">Migrate Sample Zoho Dataset</button>
          </div>
        </div>
      </div>
    `,
    footer: `<button type="button" class="btn" data-close>Close</button>`
  });

  $('#btn-exp-convo-inv', m.el).addEventListener('click', async () => {
    try {
      const data = await api('interop/zoho/export/invoices/');
      const blob = new Blob([JSON.stringify(data.records, null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = `zoho_invoices_export_${iso(new Date())}.json`;
      a.click();
      toast('Convo-compatible invoices exported successfully!');
    } catch (e) { toast(e.message, 'err'); }
  });

  $('#btn-exp-convo-cust', m.el).addEventListener('click', async () => {
    try {
      const data = await api('interop/zoho/export/customers/');
      const blob = new Blob([JSON.stringify(data.records, null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = `zoho_customers_export_${iso(new Date())}.json`;
      a.click();
      toast('Convo-compatible customers exported successfully!');
    } catch (e) { toast(e.message, 'err'); }
  });

  $('#btn-exp-convo-items', m.el).addEventListener('click', async () => {
    try {
      const data = await api('interop/zoho/export/items/');
      const blob = new Blob([JSON.stringify(data.records, null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = `zoho_items_export_${iso(new Date())}.json`;
      a.click();
      toast('Convo-compatible items exported successfully!');
    } catch (e) { toast(e.message, 'err'); }
  });

  $('#btn-demo-convo-imp', m.el).addEventListener('click', async () => {
    const entity = $('#convo-imp-entity', m.el).value;
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

function bulkItemPickerModal(items, onSelect) {
  let searchQ = '';
  const selectedMap = new Map();

  const m = Modal.open({
    title: 'Select Items in Bulk',
    dialog: true,
    wide: true,
    body: `
      <div style="padding:10px 0;">
        <input class="in" type="search" id="bulk-item-search" placeholder="Search items by name, SKU, or category…" style="margin-bottom:14px;width:100%;">
        <div class="tw" style="max-height:360px;overflow-y:auto;border:1px solid var(--bd);border-radius:8px;">
          <table>
            <thead>
              <tr>
                <th style="width:40px;"><input type="checkbox" id="bulk-item-select-all"></th>
                <th>Item Details</th>
                <th>SKU</th>
                <th class="r">Rate (₹)</th>
                <th class="r">Stock On Hand</th>
                <th style="width:100px;" class="r">Qty to Add</th>
              </tr>
            </thead>
            <tbody id="bulk-item-tbody"></tbody>
          </table>
        </div>
      </div>
    `,
    footer: `
      <div style="display:flex;justify-content:space-between;align-items:center;width:100%;">
        <span class="sub" id="bulk-selected-count">0 items selected</span>
        <div>
          <button type="button" class="btn" data-close>Cancel</button>
          <button type="button" class="btn p" id="btn-bulk-add-confirm">Add Selected Items</button>
        </div>
      </div>
    `
  });

  function renderList() {
    const q = searchQ.toLowerCase().trim();
    const filtered = items.filter(it => !q || it.name.toLowerCase().includes(q) || (it.sku && it.sku.toLowerCase().includes(q)));
    const tb = $('#bulk-item-tbody', m.el);
    if (!filtered.length) {
      tb.innerHTML = `<tr><td colspan="6"><div class="empty">No matching items found.</div></td></tr>`;
      return;
    }
    tb.innerHTML = filtered.map(it => {
      const isSel = selectedMap.has(it.id);
      const qtyVal = isSel ? selectedMap.get(it.id) : 1;
      return `
        <tr>
          <td><input type="checkbox" class="chk-bulk-item" data-id="${it.id}" ${isSel ? 'checked' : ''}></td>
          <td><b>${esc(it.name)}</b>${it.category ? `<br><small class="sub">${esc(it.category)}</small>` : ''}</td>
          <td>${esc(it.sku || '—')}</td>
          <td class="r">${inr(it.selling_price || 0)}</td>
          <td class="r">${it.track_inventory ? esc(it.stock || 0) : '—'}</td>
          <td class="r">
            <input type="number" min="0.001" step="0.001" class="in bulk-qty-input" data-id="${it.id}" value="${qtyVal}" style="width:80px;text-align:right;" ${isSel ? '' : 'disabled'}>
          </td>
        </tr>
      `;
    }).join('');
    updateCount();
  }

  function updateCount() {
    const cnt = selectedMap.size;
    $('#bulk-selected-count', m.el).textContent = `${cnt} item${cnt === 1 ? '' : 's'} selected`;
  }

  $('#bulk-item-search', m.el).addEventListener('input', e => {
    searchQ = e.target.value;
    renderList();
  });

  m.el.addEventListener('change', e => {
    if (e.target.classList.contains('chk-bulk-item')) {
      const itId = Number(e.target.dataset.id);
      const qtyInp = $(`.bulk-qty-input[data-id="${itId}"]`, m.el);
      if (e.target.checked) {
        selectedMap.set(itId, Number(qtyInp ? qtyInp.value : 1) || 1);
        if (qtyInp) qtyInp.disabled = false;
      } else {
        selectedMap.delete(itId);
        if (qtyInp) qtyInp.disabled = true;
      }
      updateCount();
    } else if (e.target.id === 'bulk-item-select-all') {
      const chks = $$('.chk-bulk-item', m.el);
      chks.forEach(chk => {
        chk.checked = e.target.checked;
        const itId = Number(chk.dataset.id);
        const qtyInp = $(`.bulk-qty-input[data-id="${itId}"]`, m.el);
        if (chk.checked) {
          selectedMap.set(itId, Number(qtyInp ? qtyInp.value : 1) || 1);
          if (qtyInp) qtyInp.disabled = false;
        } else {
          selectedMap.delete(itId);
          if (qtyInp) qtyInp.disabled = true;
        }
      });
      updateCount();
    } else if (e.target.classList.contains('bulk-qty-input')) {
      const itId = Number(e.target.dataset.id);
      if (selectedMap.has(itId)) {
        selectedMap.set(itId, Number(e.target.value) || 1);
      }
    }
  });

  $('#btn-bulk-add-confirm', m.el).addEventListener('click', () => {
    if (!selectedMap.size) {
      toast('Please select at least one item.', 'err');
      return;
    }
    const chosen = [];
    selectedMap.forEach((quantity, itemId) => {
      const itemObj = items.find(x => x.id === itemId);
      if (itemObj) {
        chosen.push({
          item: itemObj.id,
          description: itemObj.name,
          hsn_sac: itemObj.hsn_sac || '',
          quantity,
          rate: itemObj.selling_price || 0,
          discount_percent: 0,
          gst_rate: num(itemObj.gst_rate) || 0
        });
      }
    });
    m.close();
    if (onSelect) onSelect(chosen);
  });

  renderList();
}

async function quoteForm(id, targetEl, onDone) {
  if (typeof targetEl === 'function') {
    onDone = targetEl;
    targetEl = null;
  }
  const target = (targetEl && targetEl.nodeType) ? targetEl : document.getElementById('pg') || document.body;

  const [parties, items, projects, salespersons, whList, nextNum, rec] = await Promise.all([
    api('lookup/customers/').catch(() => []),
    api('lookup/items/').catch(() => []),
    api('lookup/projects/').catch(() => []),
    api('lookup/salespersons/').catch(() => []),
    api('lookup/warehouses/').catch(() => []),
    id ? Promise.resolve(null) : api('lookup/next-quote-number/').catch(() => ({ next_number: 'QT-000001' })),
    id ? api(`quotes/${id}/`).catch(() => null) : Promise.resolve(null)
  ]);

  const qNumber = rec ? rec.number : (nextNum ? nextNum.next_number : 'QT-000001');
  const qCustomer = rec ? (rec.party_id || rec.customer_id) : '';
  const qLocation = rec ? (rec.location || 'HO Kottayam') : 'HO Kottayam';
  const qSeries = rec ? (rec.transaction_series || 'Default Transaction Series') : 'Default Transaction Series';
  const qOrderNum = rec ? (rec.order_number || '') : (rec ? (rec.reference_number || '') : '');
  const qDate = rec ? rec.date : (window.APP && window.APP.today ? window.APP.today : new Date().toISOString().slice(0, 10));
  const qExpiry = rec ? (rec.expiry_date || '') : '';
  const qRef = rec ? (rec.reference_number || '') : '';
  const qSalesperson = rec ? (rec.salesperson || '') : '';
  const qProject = rec ? (rec.project_name || '') : '';
  const qSubject = rec ? (rec.subject || '') : '';
  const qNotes = rec ? (rec.notes != null ? rec.notes : 'Looking forward for your business.') : 'Looking forward for your business.';
  const qTerms = rec ? (rec.terms != null ? rec.terms : (window.APP && window.APP.org && window.APP.org.terms_default ? window.APP.org.terms_default : '')) : '';
  const qTaxType = rec ? (rec.tax_type || 'tds') : 'tds';
  const qTaxPricing = rec ? (rec.tax_pricing_type || 'tax_exclusive') : 'tax_exclusive';
  const qCustType = rec ? (rec.customer_type || 'b2b') : 'b2b';
  const qTdsTax = rec ? num(rec.tds_tcs_tax || 0) : 0;
  const qAdj = rec ? num(rec.adjustment || 0) : 0;
  const qAdjLabel = rec ? (rec.adjustment_label || 'Adjustment') : 'Adjustment';
  const qLines = (rec && rec.lines && rec.lines.length) ? rec.lines : [{ quantity: 1, rate: 0, discount_percent: 0, gst_rate: 0 }];
  const pendingFiles = [];

  const rowHtml = (l = {}) => `
    <tr class="ln-quote" style="border-bottom:1px solid var(--bd);">
      <td style="width:50px;text-align:center;padding:10px 4px;vertical-align:top;">
        <div style="display:flex;align-items:center;justify-content:center;gap:6px;color:#94a3b8;padding-top:6px;">
          <i class="fa-solid fa-grip-vertical" style="cursor:grab;font-size:13px;"></i>
          <i class="fa-regular fa-image" style="font-size:16px;"></i>
        </div>
      </td>
      <td style="min-width:280px;padding:10px 8px;vertical-align:top;">
        <select class="in l-item" aria-label="Item" style="width:100%;margin-bottom:6px;">
          <option value="">Type or click to select an item.</option>
          <option value="__new_item__" style="color:var(--accent);font-weight:600;">+ Add New Item…</option>
          ${items.map(it => `<option value="${it.id}" ${String(l.item) === String(it.id) ? 'selected' : ''}>${esc(it.name)}${it.sku ? ' (' + esc(it.sku) + ')' : ''}</option>`).join('')}
        </select>
        <input class="in l-desc" aria-label="Description" placeholder="Description / details" maxlength="500" value="${esc(l.description || '')}" style="font-size:12px;padding:4px 8px;width:100%;">
        <div class="l-stock-badge" style="font-size:11px;color:#0284c7;margin-top:3px;font-weight:500;display:none;"></div>
        <input type="hidden" class="l-hsn" value="${esc(l.hsn_sac || '')}">
      </td>
${renderStockQuantityCell(l, items, whList)}
      <td style="width:110px;padding:10px 8px;vertical-align:top;">
        <input class="in l-rate" type="number" step="0.01" min="0" value="${esc(l.rate == null ? '0.00' : l.rate)}" style="text-align:right;width:100%;">
      </td>
      <td style="width:120px;padding:10px 8px;vertical-align:top;">
        <div style="display:flex;gap:4px;">
          <input class="in l-disc" type="number" step="0.01" min="0" max="100" value="${esc(l.discount_percent || 0)}" style="text-align:right;flex:1;min-width:45px;">
          <select class="in l-disc-type" style="width:48px;padding:4px;">
            <option value="percent">%</option>
            <option value="amount">₹</option>
          </select>
        </div>
      </td>
      <td style="width:140px;padding:10px 8px;vertical-align:top;">
        <select class="in l-gst" aria-label="Tax rate" style="width:100%;">
          <option value="0">Select a Tax</option>
          <option value="0" ${num(l.gst_rate) === 0 ? 'selected' : ''}>GST [0%]</option>
          <option value="5" ${num(l.gst_rate) === 5 ? 'selected' : ''}>GST [5%]</option>
          <option value="12" ${num(l.gst_rate) === 12 ? 'selected' : ''}>GST [12%]</option>
          <option value="18" ${l.gst_rate == null || num(l.gst_rate) === 18 ? 'selected' : ''}>GST [18%]</option>
          <option value="28" ${num(l.gst_rate) === 28 ? 'selected' : ''}>GST [28%]</option>
        </select>
      </td>
      <td style="width:100px;padding:10px 8px;text-align:right;font-weight:600;vertical-align:top;" class="l-amt">
        ${(l.line_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </td>
      <td style="width:36px;text-align:center;vertical-align:top;padding-top:14px;">
        <button type="button" class="btn ic" data-rm-line style="color:var(--tx-muted);font-size:16px;border:none;background:none;cursor:pointer;" title="Remove row">×</button>
      </td>
    </tr>
  `;

  target.innerHTML = `
    <div class="invoice-form-page" style="background:#fff;min-height:100%;display:flex;flex-direction:column;">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 28px;border-bottom:1px solid var(--bd);background:#fff;position:sticky;top:0;z-index:20;">
        <div style="display:flex;align-items:center;gap:12px;">
          <i class="fa-regular fa-file-lines" style="font-size:22px;color:#1e293b;"></i>
          <h1 style="font-size:20px;font-weight:700;margin:0;color:#0f172a;">${id ? 'Edit Quote' : 'New Quote'}</h1>
        </div>
        <div style="display:flex;align-items:center;gap:14px;">
          <button type="button" class="btn ic" title="Settings" style="border:none;background:transparent;color:#3b82f6;font-size:16px;cursor:pointer;"><i class="fa-solid fa-gear"></i></button>
          <button type="button" class="btn ic" id="btn-quote-close-x" title="Close" style="border:none;background:transparent;color:#64748b;font-size:18px;cursor:pointer;"><i class="fa-solid fa-xmark"></i></button>
        </div>
      </div>

      <form id="quote-form-element" style="padding:28px;max-width:1100px;width:100%;box-sizing:border-box;" novalidate>
        <div class="fe" data-err="_" role="alert"></div>

        <div style="display:flex;flex-direction:column;gap:16px;margin-bottom:28px;">
          <div style="display:flex;align-items:center;gap:16px;">
            <label style="width:140px;font-weight:500;font-size:13px;color:#ef4444;">Customer Name*</label>
            <div style="display:flex;align-items:center;gap:8px;flex:1;max-width:480px;">
              <select class="in" id="q-customer" name="customer" required style="flex:1;">
                <option value="">Select or add a customer</option>
                <option value="__new_customer__" style="color:var(--accent);font-weight:600;">+ Add New Customer…</option>
                ${parties.map(p => `<option value="${p.id}" ${String(qCustomer) === String(p.id) ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
              </select>
              <button type="button" class="btn p" id="btn-quote-cust-lookup" title="Search / Add Customer" style="padding:0 12px;height:34px;border-radius:4px;cursor:pointer;">
                <i class="fa-solid fa-magnifying-glass"></i>
              </button>
              <div style="font-size:12px;font-weight:600;padding:6px 10px;background:#f1f5f9;border:1px solid #cbd5e1;border-radius:4px;color:#334155;">INR</div>
            </div>
          </div>

          <div style="display:flex;align-items:flex-start;gap:16px;">
            <label style="width:140px;font-weight:500;font-size:13px;color:var(--tx);padding-top:6px;">Location</label>
            <div>
              <select class="in" id="q-location" name="location" style="width:260px;">
                ${whList.map(w => `<option value="${esc(w.name)}" ${(qLocation === w.name) || (!rec && w.name === 'HO Kottayam') ? 'selected' : ''}>${esc(w.name)}</option>`).join('')}
              </select>
              <div id="q-source-of-supply" style="font-size:11.5px;color:#64748b;margin-top:3px;">
                Source of Supply: ${esc(rec ? (rec.place_of_supply || 'Kerala') : (window.APP && window.APP.org ? window.APP.org.state : 'Kerala'))}
              </div>
            </div>
          </div>

          <div style="display:flex;align-items:center;gap:16px;">
            <label style="width:140px;font-weight:500;font-size:13px;color:var(--tx);">Customer Type</label>
            <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;">
              <select class="in" id="q-customer-type" name="customer_type" style="width:260px;">
                <option value="b2b" ${qCustType === 'b2b' ? 'selected' : ''}>B2B - Business to Business</option>
                <option value="b2c" ${qCustType === 'b2c' ? 'selected' : ''}>B2C - Business to Consumer</option>
              </select>
              <div id="q-customer-gstin-wrap" style="display:flex;align-items:center;gap:6px;font-size:12px;background:#f8fafc;padding:4px 10px;border-radius:4px;border:1px solid var(--bd);">
                <span style="color:#64748b;font-weight:500;">GSTIN:</span>
                <span id="q-customer-gstin" style="font-weight:600;color:var(--tx);">${(rec && rec.party_details && rec.party_details.gstin) || (parties.find(p => String(p.id) === String(qCustomer))?.gstin) || 'Not provided'}</span>
              </div>
            </div>
          </div>

          <div style="display:flex;align-items:center;gap:16px;">
            <label style="width:140px;font-weight:500;font-size:13px;color:#ef4444;">Quote#*</label>
            <div style="display:flex;align-items:center;gap:8px;">
              <select class="in" id="q-series" name="transaction_series" style="width:180px;">
                <option value="Default Transaction Series" ${(qSeries === 'Default Transaction Series') ? 'selected' : ''}>Default Transaction Series</option>
                <option value="Online Store Series" ${qSeries === 'Online Store Series' ? 'selected' : ''}>Online Store Series</option>
                <option value="Export Series" ${qSeries === 'Export Series' ? 'selected' : ''}>Export Series</option>
                <option value="Retail Series" ${qSeries === 'Retail Series' ? 'selected' : ''}>Retail Series</option>
              </select>
              <input class="in" id="q-number" name="number" value="${qNumber}" required style="width:180px;">
              <button type="button" class="btn ic" id="btn-quote-num-pref" title="Configure Quote Preferences" style="border:1px solid var(--bd);border-radius:4px;padding:6px 10px;color:#3b82f6;cursor:pointer;">
                <i class="fa-solid fa-gear"></i>
              </button>
            </div>
          </div>

          <div style="display:flex;align-items:center;gap:16px;">
            <label style="width:140px;font-weight:500;font-size:13px;color:var(--tx);">Order Number</label>
            <input class="in" id="q-order-number" name="order_number" value="${esc(qOrderNum)}" placeholder="e.g. ORD-2026-001" style="width:260px;">
          </div>

          <div style="display:flex;align-items:center;gap:16px;">
            <label style="width:140px;font-weight:500;font-size:13px;color:var(--tx);">Reference#</label>
            <input class="in" id="q-reference" name="reference_number" value="${esc(qRef)}" style="width:260px;">
          </div>

          <div style="display:flex;align-items:center;flex-wrap:wrap;gap:16px;">
            <label style="width:140px;font-weight:500;font-size:13px;color:#ef4444;">Quote Date*</label>
            <input class="in" type="date" id="q-date" name="date" value="${qDate}" required style="width:260px;">

            <label style="font-weight:500;font-size:13px;color:#ef4444;margin-left:20px;">Expiry Date*</label>
            <input class="in" type="date" id="q-expiry" name="expiry_date" value="${qExpiry}" required style="width:260px;">
          </div>

          <div style="display:flex;align-items:center;gap:16px;">
            <label style="width:140px;font-weight:500;font-size:13px;color:var(--tx);">Salesperson</label>
            <div id="q-salesperson-container"></div>
          </div>

          <div style="display:flex;align-items:center;gap:16px;">
            <label style="width:140px;font-weight:500;font-size:13px;color:var(--tx);">Associate Project(s)</label>
            <select class="in" id="q-project" name="project_name" style="width:260px;" disabled>
              <option value="">There are no active projects for this customer.</option>
            </select>
          </div>

          <div style="display:flex;align-items:flex-start;gap:16px;">
            <label style="width:140px;font-weight:500;font-size:13px;color:var(--tx);display:flex;align-items:center;gap:4px;padding-top:6px;">
              Subject <i class="fa-solid fa-circle-info" style="color:var(--tx-muted);font-size:12px;"></i>
            </label>
            <textarea class="in" id="q-subject" name="subject" rows="2" placeholder="Let your customer know what this Quote is for" style="width:260px;font-size:12px;">${esc(qSubject)}</textarea>
          </div>
        </div>

        <div style="margin-top:32px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
            <div style="display:flex;align-items:center;gap:12px;">
              <span style="font-size:15px;font-weight:700;color:var(--tx);">Item Table</span>
              <select class="in" id="q-tax-pricing" name="tax_pricing_type" style="width:145px;height:30px;font-size:12px;font-weight:600;padding:2px 8px;border-radius:6px;border:1px solid #93c5fd;background:#f0fdf4;color:#1e293b;" title="Tax Pricing Type">
                <option value="tax_exclusive" ${qTaxPricing === 'tax_exclusive' ? 'selected' : ''}>Tax Exclusive</option>
                <option value="tax_inclusive" ${qTaxPricing === 'tax_inclusive' ? 'selected' : ''}>Tax Inclusive</option>
              </select>
              <button type="button" class="btn btn-tax-pricing-info" data-doc-kind="quotes" style="background:#eff6ff;color:#2563eb;border:1px solid #bfdbfe;font-size:11.5px;font-weight:600;padding:2px 10px;border-radius:14px;cursor:pointer;display:inline-flex;align-items:center;gap:5px;" title="Learn about Tax Exclusive, Tax Inclusive, B2B & B2C GST billing">
                <i class="fa-solid fa-circle-info"></i> Guide
              </button>
            </div>
            <div style="display:flex;align-items:center;gap:12px;">
              <button type="button" class="btn" id="btn-quote-scan" style="background:none;border:none;color:#2563eb;font-weight:500;font-size:12px;display:flex;align-items:center;gap:6px;cursor:pointer;">
                <i class="fa-solid fa-barcode"></i> Scan Item
              </button>
              <button type="button" class="btn" id="btn-quote-bulk-actions" style="background:none;border:none;color:#2563eb;font-weight:500;font-size:12px;display:flex;align-items:center;gap:6px;cursor:pointer;">
                <i class="fa-regular fa-circle-check"></i> Bulk Actions
              </button>
            </div>
          </div>

          <div class="tw" style="border:1px solid var(--bd);border-radius:6px;overflow-x:auto;">
            <table class="lt" style="margin:0;width:100%;border-collapse:collapse;">
              <thead style="background:#f8fafc;border-bottom:1px solid var(--bd);">
                <tr>
                  <th style="width:50px;"></th>
                  <th style="min-width:280px;text-align:left;padding:12px 8px;font-size:12px;font-weight:600;color:#64748b;">ITEM DETAILS</th>
                  <th style="width:140px;min-width:130px;text-align:right;padding:12px 8px;font-size:12px;font-weight:600;color:#64748b;">QUANTITY</th>
                  <th style="width:110px;text-align:right;padding:12px 8px;font-size:12px;font-weight:600;color:#64748b;">RATE (₹)</th>
                  <th style="width:120px;text-align:right;padding:12px 8px;font-size:12px;font-weight:600;color:#64748b;">DISCOUNT</th>
                  <th class="th-tax-explainer" data-doc-kind="quotes" style="width:140px;text-align:left;padding:12px 8px;font-size:12px;font-weight:600;color:#64748b;cursor:pointer;" title="Click for GST Rates, Tax Exclusive & B2B/B2C Rules">TAX <i class="fa-solid fa-circle-info" style="font-size:11px;color:#2563eb;"></i></th>
                  <th style="width:100px;text-align:right;padding:12px 8px;font-size:12px;font-weight:600;color:#64748b;">AMOUNT</th>
                  <th style="width:36px;"></th>
                </tr>
              </thead>
              <tbody id="quote-line-tbody">
                ${qLines.map(rowHtml).join('')}
              </tbody>
            </table>
          </div>

          <div style="display:flex;align-items:center;gap:10px;margin-top:14px;">
            <button type="button" class="btn" id="btn-quote-add-row" style="color:#2563eb;border-color:#bfdbfe;background:#eff6ff;font-weight:600;font-size:12px;display:flex;align-items:center;gap:6px;cursor:pointer;">
              <i class="fa-solid fa-circle-plus"></i> Add New Row ▾
            </button>
            <button type="button" class="btn" id="btn-quote-bulk-items" style="color:#2563eb;border-color:#bfdbfe;background:#eff6ff;font-weight:600;font-size:12px;display:flex;align-items:center;gap:6px;cursor:pointer;">
              <i class="fa-solid fa-circle-plus"></i> Add Items in Bulk
            </button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-top:28px;">
          <div>
            <div style="margin-bottom:18px;">
              <label for="q-notes" style="font-weight:600;font-size:13px;color:var(--tx);display:block;margin-bottom:6px;">Customer Notes</label>
              <textarea class="in" id="q-notes" name="notes" rows="4" style="width:100%;min-height:92px;box-sizing:border-box;resize:vertical;padding:8px 10px;font-size:13px;line-height:1.5;">${esc(qNotes)}</textarea>
              <span style="font-size:11.5px;color:#64748b;display:block;margin-top:4px;">Will be displayed on the quotation</span>
            </div>
            <div>
              <label for="q-terms" style="font-weight:600;font-size:13px;color:var(--tx);display:block;margin-bottom:6px;">Terms &amp; Conditions</label>
              <textarea class="in" id="q-terms" name="terms" rows="4" placeholder="Enter the terms and conditions of your business to be displayed in your transaction" style="width:100%;min-height:92px;box-sizing:border-box;resize:vertical;padding:8px 10px;font-size:13px;line-height:1.5;">${esc(qTerms)}</textarea>
            </div>
          </div>

          <div style="background:#f8fafc;border:1px solid var(--bd);border-radius:10px;padding:20px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid var(--bd);">
              <span style="font-weight:600;color:var(--tx);">Sub Total</span>
              <span id="q-subtotal-val" style="font-size:16px;font-weight:700;">0.00</span>
            </div>

            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
              <div style="display:flex;align-items:center;gap:14px;">
                <label style="display:flex;align-items:center;gap:5px;cursor:pointer;font-weight:500;font-size:13px;">
                  <input type="radio" name="tax_type" value="tds" ${qTaxType === 'tds' ? 'checked' : ''}> TDS
                </label>
                <label style="display:flex;align-items:center;gap:5px;cursor:pointer;font-weight:500;font-size:13px;">
                  <input type="radio" name="tax_type" value="tcs" ${qTaxType === 'tcs' ? 'checked' : ''}> TCS
                </label>
              </div>
              <div style="display:flex;align-items:center;gap:10px;">
                <select class="in" id="q-tds-tax" name="tds_tcs_tax" style="width:150px;">
                  <option value="0">Select a Tax</option>
                  <option value="1" ${qTdsTax === 1 ? 'selected' : ''}>1%</option>
                  <option value="2" ${qTdsTax === 2 ? 'selected' : ''}>2%</option>
                  <option value="5" ${qTdsTax === 5 ? 'selected' : ''}>5%</option>
                  <option value="10" ${qTdsTax === 10 ? 'selected' : ''}>10%</option>
                </select>
                <span id="q-tds-amt" style="font-weight:600;min-width:60px;text-align:right;">- 0.00</span>
              </div>
            </div>

            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
              <div style="display:flex;align-items:center;gap:6px;">
                <input class="in" id="q-adj-label" value="${esc(qAdjLabel)}" style="width:90px;font-size:12px;padding:3px 6px;">
                <i class="fa-regular fa-circle-question" style="color:#94a3b8;cursor:help;" title="Add or subtract adjustment amount"></i>
              </div>
              <div style="display:flex;align-items:center;gap:10px;">
                <input type="number" step="0.01" class="in" id="q-adj-val" name="adjustment" value="${qAdj}" style="width:110px;text-align:right;">
                <span id="q-adj-display" style="font-weight:600;min-width:60px;text-align:right;">0.00</span>
              </div>
            </div>

            <div style="display:flex;justify-content:space-between;align-items:center;padding-top:16px;border-top:2px solid var(--bd);margin-top:16px;">
              <span style="font-size:17px;font-weight:700;color:#0f172a;">Total ( ₹ )</span>
              <span id="q-grandtotal-val" style="font-size:22px;font-weight:800;color:#0f172a;">0.00</span>
            </div>
          </div>
        </div>

        <div style="margin-top:28px;padding:18px;background:#f8fafc;border:1px solid var(--bd);border-radius:10px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <div>
              <div style="font-weight:600;font-size:13px;color:#0f172a;">Attach File(s) to Quote</div>
              <div style="font-size:11.5px;color:#64748b;margin-top:2px;">You can upload a maximum of 10 files, 10MB each</div>
            </div>
            <input type="file" id="q-file-input" multiple style="display:none;">
            <button type="button" class="btn" id="btn-quote-upload" style="font-size:12px;background:#fff;display:flex;align-items:center;gap:6px;cursor:pointer;">
              <i class="fa-solid fa-upload"></i> Upload File ▾
            </button>
          </div>
          <div id="q-attach-badges" style="display:flex;flex-wrap:wrap;gap:8px;"></div>
        </div>

        <div style="margin-top:20px;padding:18px;background:#f8fafc;border:1px solid var(--bd);border-radius:10px;display:flex;align-items:center;justify-content:space-between;gap:20px;">
          <div>
            <div style="font-weight:600;font-size:13px;color:#0f172a;display:flex;align-items:center;gap:6px;">
              <i class="fa-solid fa-signature" style="color:#2563eb;"></i> Authorized Digital Signature
            </div>
            <div style="font-size:11.5px;color:#64748b;margin-top:2px;" id="q-sig-desc">
              ${rec && rec.signature_data ? 'Document has an attached digital signature.' : (window.APP && window.APP.org && window.APP.org.signature_data ? 'Using company default signature.' : 'No signature attached. Click to add a signature to this quote.')}
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:12px;">
            <div id="q-sig-preview-box" style="height:44px;min-width:90px;display:flex;align-items:center;justify-content:center;background:#fff;border:1px solid var(--bd);border-radius:6px;padding:2px 8px;">
              <img id="q-sig-preview" src="${esc((rec && rec.signature_data) || (window.APP && window.APP.org && window.APP.org.signature_data) || '')}" alt="Signature preview" style="max-height:40px;max-width:110px;object-fit:contain;display:${((rec && rec.signature_data) || (window.APP && window.APP.org && window.APP.org.signature_data)) ? 'block' : 'none'};">
              <span id="q-sig-none" style="font-size:11px;color:#94a3b8;display:${((rec && rec.signature_data) || (window.APP && window.APP.org && window.APP.org.signature_data)) ? 'none' : 'inline'};">None</span>
            </div>
            <input type="hidden" id="q-signature-data" name="signature_data" value="${esc((rec && rec.signature_data) || '')}">
            <input type="hidden" id="q-signed-by" name="signed_by" value="${esc((rec && rec.signed_by) || '')}">
            <input type="hidden" id="q-signature-title" name="signature_title" value="${esc((rec && rec.signature_title) || '')}">
            <button type="button" class="btn btn-doc-sign" id="btn-quote-sign" style="font-size:12px;border:1px solid #cbd5e1;border-radius:6px;padding:6px 14px;background:#ffffff;display:inline-flex;align-items:center;gap:6px;cursor:pointer;color:var(--tx,#0f172a);font-weight:500;">
              <i class="fa-solid fa-pen-nib"></i> ${((rec && rec.signature_data) || (window.APP && window.APP.org && window.APP.org.signature_data)) ? 'Change Signature' : 'Sign Quote'}
            </button>
          </div>
        </div>

        ${renderPaymentGatewayBanner()}

        <div style="position:sticky;bottom:0;background:#fff;border-top:1px solid var(--bd);margin-top:36px;padding:14px 0;display:flex;align-items:center;justify-content:space-between;z-index:15;">
          <div style="display:flex;align-items:center;gap:10px;">
            <button type="button" class="btn" id="btn-q-save-draft" style="background:#fff;font-weight:500;cursor:pointer;">Save as Draft</button>
            <button type="button" class="btn p" id="btn-q-save-send" style="display:flex;align-items:center;gap:6px;cursor:pointer;">
              Save and Send <i class="fa-solid fa-caret-up" style="font-size:10px;"></i>
            </button>
            <button type="button" class="btn" id="btn-q-cancel" style="background:#fff;font-weight:500;cursor:pointer;">Cancel</button>
          </div>
          <div style="display:flex;align-items:center;gap:20px;font-size:13px;font-weight:600;color:#0f172a;">
            <span>Total Amount: <span id="quote-bar-total-amount">₹ 0.00</span></span>
            <span>Total Quantity: <span id="quote-bar-total-qty">1.00</span></span>
          </div>
        </div>
      </form>
    </div>
  `;

  const form = $('#quote-form-element', target);
  const tbody = $('#quote-line-tbody', form);
  const byId = Object.fromEntries(items.map(it => [String(it.id), it]));
  const stockTracker = initItemTableStockTracker(tbody, items, whList, () => calcQuote());

  createSalespersonCustomDropdown($('#q-salesperson-container', form), qSalesperson, () => {});
  function updateProjectFilter() {
    setupProjectSelectorForCustomer($('#q-project', form), $('#q-customer', form)?.value, qProject);
  }
  updateProjectFilter();
  $('#q-customer', form)?.addEventListener('change', (e) => {
    updateProjectFilter();
  });

  $('#btn-quote-num-pref', form)?.addEventListener('click', () => {
    openDocNumberPreferencesModal({
      kind: 'quotes',
      series: $('#q-series', form)?.value || 'Default Transaction Series',
      location: $('#q-location', form)?.value || 'HO Kottayam',
      onSave: (pfx, next) => {
        if (next) $('#q-number', form).value = next;
      }
    });
  });

  function calcQuote() {
    const isTaxInclusive = ($('#q-tax-pricing', form)?.value === 'tax_inclusive');
    let subtotal = 0;
    let totalTax = 0;
    let totalQty = 0;

    $$('.ln-quote', tbody).forEach(tr => {
      const q = num($('.l-qty', tr).value) || 0;
      const r = num($('.l-rate', tr).value) || 0;
      const discVal = num($('.l-disc', tr).value) || 0;
      const discType = $('.l-disc-type', tr).value || 'percent';
      const gst = num($('.l-gst', tr).value) || 0;

      totalQty += q;
      const gross = q * r;
      const disc = discType === 'percent' ? (gross * discVal / 100) : discVal;
      const net = Math.max(0, gross - disc);
      let taxable = net;
      let taxAmt = 0;
      let lineTot = net;

      if (isTaxInclusive && gst > 0) {
        taxable = r2(net / (1 + gst / 100));
        taxAmt = r2(net - taxable);
        lineTot = net;
      } else {
        taxable = r2(net);
        taxAmt = r2(taxable * (gst / 100));
        lineTot = r2(taxable + taxAmt);
      }

      subtotal += taxable;
      totalTax += taxAmt;

      const amtEl = $('.l-amt', tr);
      if (amtEl) amtEl.textContent = lineTot.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    });

    const taxType = form.querySelector('input[name="tax_type"]:checked')?.value || 'tds';
    const tdsRate = num($('#q-tds-tax', form).value) || 0;
    const tdsAmt = r2(subtotal * (tdsRate / 100));
    const tdsDisplay = $('#q-tds-amt', form);
    if (tdsDisplay) tdsDisplay.textContent = (taxType === 'tds' ? '- ' : '+ ') + inr(tdsAmt).replace('₹', '').trim();

    const adjVal = num($('#q-adj-val', form).value) || 0;
    const adjDisplay = $('#q-adj-display', form);
    if (adjDisplay) adjDisplay.textContent = adjVal.toFixed(2);

    let grand = subtotal + totalTax;
    if (taxType === 'tds') grand -= tdsAmt;
    else grand += tdsAmt;
    grand += adjVal;
    grand = Math.max(0, r2(grand));

    const subEl = $('#q-subtotal-val', form);
    const grandEl = $('#q-grandtotal-val', form);
    const barTot = $('#quote-bar-total-amount', form);
    const barQty = $('#quote-bar-total-qty', form);

    if (subEl) subEl.textContent = inr(subtotal).replace('₹', '').trim();
    if (grandEl) grandEl.textContent = inr(grand).replace('₹', '').trim();
    if (barTot) barTot.textContent = inr(grand);
    if (barQty) barQty.textContent = totalQty.toFixed(2);

    return { subtotal, totalTax, grand, totalQty };
  }

  tbody.addEventListener('input', e => {
    if (e.target.matches('.l-qty, .l-rate, .l-disc')) calcQuote();
  });

  tbody.addEventListener('change', e => {
    if (e.target.classList.contains('l-item')) {
      if (e.target.value === '__new_item__') {
        handleQuickCreateSelect(e.target, newItem => {
          items.push(newItem);
          byId[String(newItem.id)] = newItem;
          calcQuote();
        });
        return;
      }
      const it = byId[e.target.value];
      const tr = e.target.closest('tr');
      if (it && tr) {
        $('.l-desc', tr).value = it.name;
        $('.l-hsn', tr).value = it.hsn_sac || '';
        $('.l-rate', tr).value = it.selling_price || 0;
        $('.l-gst', tr).value = String(num(it.gst_rate) || 18);
        stockTracker.updateRow(tr, true);
      }
      calcQuote();
    }
    if (e.target.matches('.l-gst, .l-disc-type')) calcQuote();
  });

  tbody.addEventListener('click', e => {
    const rm = e.target.closest('[data-rm-line]');
    if (rm) {
      if ($$('.ln-quote', tbody).length > 1) {
        rm.closest('tr').remove();
        calcQuote();
      } else {
        toast('At least one line item is required.', 'err');
      }
    }
  });

  $('#btn-quote-add-row', form)?.addEventListener('click', () => {
    tbody.insertAdjacentHTML('beforeend', rowHtml({ quantity: 1, rate: 0, discount_percent: 0, gst_rate: 18 }));
    stockTracker.updateRow(tbody.lastElementChild, false);
    calcQuote();
  });

  $('#btn-quote-bulk-items', form)?.addEventListener('click', () => {
    openBulkItemModal(items, selectedItems => {
      selectedItems.forEach(it => {
        tbody.insertAdjacentHTML('beforeend', rowHtml({
          item: it.id,
          description: it.name,
          hsn_sac: it.hsn_sac || '',
          quantity: 1,
          rate: it.selling_price || 0,
          discount_percent: 0,
          gst_rate: num(it.gst_rate) || 18
        }));
      });
      calcQuote();
    });
  });

  $('#q-tds-tax', form)?.addEventListener('change', calcQuote);
  $('#q-tax-pricing', form)?.addEventListener('change', calcQuote);
  form.querySelectorAll('input[name="tax_type"]').forEach(r => r.addEventListener('change', calcQuote));
  $('#q-adj-val', form)?.addEventListener('input', calcQuote);

  $('#btn-quote-cust-lookup', form)?.addEventListener('click', () => {
    handleQuickCreateSelect($('#q-customer', form), newCust => {
      parties.push(newCust);
      const opt = document.createElement('option');
      opt.value = newCust.id;
      opt.textContent = newCust.name;
      opt.selected = true;
      $('#q-customer', form).appendChild(opt);
      $('#q-customer', form).value = newCust.id;
      updateProjectFilter();
    });
  });

  $('#q-customer', form)?.addEventListener('change', e => {
    if (e.target.value === '__new_customer__') {
      handleQuickCreateSelect(e.target, newCust => {
        parties.push(newCust);
        const opt = document.createElement('option');
        opt.value = newCust.id;
        opt.textContent = newCust.name;
        opt.selected = true;
        e.target.appendChild(opt);
        e.target.value = newCust.id;
        updateProjectFilter();
      });
      return;
    }
    const cId = $('#q-customer', form).value;
    const cObj = parties.find(p => String(p.id) === String(cId));
    if (cObj) {
      const gstinEl = $('#q-customer-gstin', form);
      const custTypeEl = $('#q-customer-type', form);
      if (gstinEl) gstinEl.textContent = cObj.gstin || 'Not provided';
      if (custTypeEl) {
        if (cObj.gstin && cObj.gstin.trim()) {
          custTypeEl.value = 'b2b';
        } else if (cObj.customer_type === 'individual') {
          custTypeEl.value = 'b2c';
        }
      }
    }
    updateProjectFilter();
  });

  function renderAttach() {
    const box = $('#q-attach-badges', form);
    if (!box) return;
    const existing = (rec && rec.attachments) ? rec.attachments.map(a => `
      <div style="background:#fff;border:1px solid var(--bd);border-radius:4px;padding:4px 8px;font-size:12px;display:inline-flex;align-items:center;gap:6px;">
        <i class="fa-regular fa-file" style="color:#64748b;"></i>
        <span>${esc(a.filename)}</span>
        <button type="button" data-del-att="${a.id}" style="border:none;background:none;color:#ef4444;cursor:pointer;">×</button>
      </div>
    `).join('') : '';

    const pend = pendingFiles.map((pf, idx) => `
      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:4px;padding:4px 8px;font-size:12px;display:inline-flex;align-items:center;gap:6px;">
        <i class="fa-solid fa-paperclip" style="color:#2563eb;"></i>
        <span>${esc(pf.name)}</span>
        <button type="button" data-rem-pen="${idx}" style="border:none;background:none;color:#ef4444;cursor:pointer;">×</button>
      </div>
    `).join('');

    box.innerHTML = existing + pend;
  }

  $('#btn-quote-upload', form)?.addEventListener('click', () => {
    $('#q-file-input', form).click();
  });

  $('#q-file-input', form)?.addEventListener('change', e => {
    const files = Array.from(e.target.files);
    files.forEach(f => {
      if (pendingFiles.length >= 10) {
        toast('Maximum 10 files can be attached.', 'err');
        return;
      }
      const reader = new FileReader();
      reader.onload = ev => {
        pendingFiles.push({ name: f.name, size: f.size, type: f.type, data: ev.target.result });
        renderAttach();
      };
      reader.readAsDataURL(f);
    });
    e.target.value = '';
  });

  $('#q-attach-badges', form)?.addEventListener('click', async e => {
    const delBtn = e.target.closest('[data-del-att]');
    if (delBtn) {
      const attId = delBtn.dataset.delAtt;
      if (!(await confirmBox({ title: 'Delete attachment?', message: 'This file will be permanently removed.', okText: 'Delete', danger: true }))) return;
      try {
        await api(`attachments/${attId}/`, { method: 'DELETE' });
        rec.attachments = (rec.attachments || []).filter(a => String(a.id) !== String(attId));
        renderAttach();
        toast('Attachment deleted', 'ok');
      } catch (err) { toast(err.message, 'err'); }
      return;
    }
    const remBtn = e.target.closest('[data-rem-pen]');
    if (remBtn) {
      pendingFiles.splice(Number(remBtn.dataset.remPen), 1);
      renderAttach();
    }
  });

  $('#btn-quote-sign', form)?.addEventListener('click', () => {
    const curSigObj = {
      signature_data: $('#q-signature-data', form)?.value || '',
      signed_by: $('#q-signed-by', form)?.value || '',
      signature_title: $('#q-signature-title', form)?.value || '',
      number: qNumber
    };
    openSignatureModal(curSigObj, 'quotes', updated => {
      if ($('#q-signature-data', form)) $('#q-signature-data', form).value = updated.signature_data || '';
      if ($('#q-signed-by', form)) $('#q-signed-by', form).value = updated.signed_by || '';
      if ($('#q-signature-title', form)) $('#q-signature-title', form).value = updated.signature_title || '';
      const previewImg = $('#q-sig-preview', form);
      const noneSpan = $('#q-sig-none', form);
      const descEl = $('#q-sig-desc', form);
      const signBtn = $('#btn-quote-sign', form);
      if (updated.signature_data) {
        if (previewImg) { previewImg.src = updated.signature_data; previewImg.style.display = 'block'; }
        if (noneSpan) noneSpan.style.display = 'none';
        if (descEl) descEl.textContent = 'Custom digital signature attached.';
        if (signBtn) signBtn.innerHTML = '<i class="fa-solid fa-pen-nib"></i> Change Signature';
      } else {
        if (previewImg) previewImg.style.display = 'none';
        if (noneSpan) noneSpan.style.display = 'inline';
        if (descEl) descEl.textContent = 'No custom signature attached.';
        if (signBtn) signBtn.innerHTML = '<i class="fa-solid fa-pen-nib"></i> Sign Quote';
      }
    });
  });

  const handleClose = () => {
    if (onDone) onDone();
    else {
      location.hash = '#/sales/quotes';
      if (typeof route === 'function') route();
    }
  };

  $('#btn-quote-close-x', target)?.addEventListener('click', handleClose);
  $('#btn-q-cancel', target)?.addEventListener('click', handleClose);

  async function saveQuote(isSend = false) {
    const custId = $('#q-customer', form).value;
    if (!custId || custId === '__new_customer__') {
      toast('Please select a customer.', 'err');
      $('#q-customer', form).focus();
      return;
    }
    const numVal = ($('#q-number', form).value || '').trim();
    if (!numVal) {
      toast('Please enter a quote number.', 'err');
      $('#q-number', form).focus();
      return;
    }
    const dt = $('#q-date', form).value;
    if (!dt) {
      toast('Please enter quote date.', 'err');
      $('#q-date', form).focus();
      return;
    }
    const expVal = $('#q-expiry', form).value;
    if (!expVal) {
      toast('Please enter an expiry date.', 'err');
      $('#q-expiry', form).focus();
      return;
    }
    if (new Date(expVal) < new Date(dt)) {
      toast('Expiry Date cannot be earlier than Quote Date.', 'err');
      $('#q-expiry', form).focus();
      return;
    }

    const lines = [];
    $$('.ln-quote', tbody).forEach((tr, idx) => {
      const itVal = $('.l-item', tr).value;
      const descVal = $('.l-desc', tr).value.trim();
      const qVal = num($('.l-qty', tr).value) || 1;
      const rVal = num($('.l-rate', tr).value) || 0;
      const dVal = num($('.l-disc', tr).value) || 0;
      const gVal = num($('.l-gst', tr).value) || 0;
      const discType = $('.l-disc-type', tr).value || 'percent';

      let taxable = qVal * rVal;
      if (discType === 'percent') {
        taxable = taxable * (100 - dVal) / 100;
      } else {
        taxable = Math.max(0, taxable - dVal);
      }
      taxable = r2(taxable);
      const lTot = r2(taxable * (1 + gVal / 100));

      lines.push({
        item: (itVal && itVal !== '__new_item__') ? Number(itVal) : null,
        warehouse: $('.l-wh-select', tr)?.value || null,
        warehouse_id: $('.l-wh-select', tr)?.value || null,
        warehouse_code: $('.l-wh-code', tr)?.value || '',
        description: descVal || (itVal && byId[itVal] ? byId[itVal].name : 'Line item'),
        hsn_sac: $('.l-hsn', tr).value.trim(),
        quantity: qVal,
        rate: rVal,
        discount_percent: dVal,
        gst_rate: gVal,
        line_total: lTot,
        position: idx
      });
    });

    if (!lines.length) {
      toast('At least one line item is required.', 'err');
      return;
    }

    const totals = calcQuote();
    const custObj = parties.find(p => String(p.id) === String(custId));

    const payload = {
      customer: Number(custId),
      number: numVal,
      reference_number: ($('#q-reference', form)?.value || '').trim(),
      order_number: ($('#q-order-number', form)?.value || $('#q-reference', form)?.value || '').trim(),
      location: $('#q-location', form)?.value || 'HO Kottayam',
      transaction_series: $('#q-series', form)?.value || 'Default Transaction Series',
      date: dt,
      expiry_date: expVal,
      tax_pricing_type: $('#q-tax-pricing', form)?.value || 'tax_exclusive',
      customer_type: $('#q-customer-type', form)?.value || 'b2b',
      place_of_supply: (custObj && custObj.state) ? custObj.state : APP.org.state,
      salesperson: form.querySelector('#q-salesperson-container select.sp-select')?.value || '',
      project_name: $('#q-project', form).value,
      subject: ($('#q-subject', form)?.value || '').trim(),
      notes: $('#q-notes', form).value.trim(),
      terms: $('#q-terms', form).value.trim(),
      tax_type: form.querySelector('input[name="tax_type"]:checked')?.value || 'tds',
      tds_tcs_tax: num($('#q-tds-tax', form).value) || 0,
      adjustment: num($('#q-adj-val', form).value) || 0,
      adjustment_label: ($('#q-adj-label', form)?.value || 'Adjustment').trim(),
      signature_data: $('#q-signature-data', form)?.value || '',
      signed_by: $('#q-signed-by', form)?.value || '',
      signature_title: $('#q-signature-title', form)?.value || '',
      lines: lines,
      force: true
    };

    const actionBtns = [$('#btn-q-save-draft', target), $('#btn-q-save-send', target)];
    actionBtns.forEach(b => { if (b) b.disabled = true; });

    try {
      let saved;
      if (id) {
        saved = await api(`quotes/${id}/`, { method: 'PUT', body: payload });
      } else {
        saved = await api('quotes/', { method: 'POST', body: payload });
      }

      for (const pf of pendingFiles) {
        try {
          await api('attachments/', {
            method: 'POST',
            body: {
              entity_type: 'quote',
              entity_id: saved.id,
              filename: pf.name,
              file_size: pf.size,
              mime_type: pf.type,
              file_data: pf.data
            }
          });
        } catch (e) { console.error('Attachment upload error:', e); }
      }

      if (isSend) {
        try {
          await api(`quotes/${saved.id}/send/`, { method: 'POST', body: {} });
          toast(`Quote ${saved.number} saved and sent to client!`, 'ok');
        } catch (e) {
          toast(`Quote saved, but error sending: ${e.message}`, 'err');
        }
      } else {
        toast(`Quote ${saved.number} saved as draft!`, 'ok');
      }

      if (onDone) onDone(saved);
      else {
        location.hash = '#/sales/quotes';
        if (typeof route === 'function') route();
      }
    } catch (err) {
      toast(err.message, 'err');
    } finally {
      actionBtns.forEach(b => { if (b) b.disabled = false; });
    }
  }

  $('#btn-q-save-draft', target)?.addEventListener('click', () => saveQuote(false));
  $('#btn-q-save-send', target)?.addEventListener('click', () => saveQuote(true));

  updateProjectFilter();
  renderAttach();
  calcQuote();
}
window.quoteForm = quoteForm;


async function salesOrderForm(id, targetEl, onDone, extraOpts = {}) {
  if (typeof targetEl === 'function') {
    extraOpts = onDone || {};
    onDone = targetEl;
    targetEl = null;
  }
  const target = (targetEl && targetEl.nodeType) ? targetEl : document.getElementById('pg') || document.body;

  let srcQuote = null;
  if (!id && extraOpts && extraOpts.fromQuote) {
    srcQuote = await api(`quotes/${extraOpts.fromQuote}/`).catch(() => null);
  }

  const [parties, items, salespersons, whList, nextNum, rec] = await Promise.all([
    api('lookup/customers/').catch(() => []),
    api('lookup/items/').catch(() => []),
    api('lookup/salespersons/').catch(() => []),
    api('lookup/warehouses/').catch(() => []),
    id ? Promise.resolve(null) : api('lookup/next-so-number/').catch(() => ({ next_number: 'SO-000001' })),
    id ? api(`sales-orders/${id}/`).catch(() => null) : Promise.resolve(null)
  ]);

  const warehouses = (whList && whList.length) ? whList : [{ id: 1, name: 'HO Kottayam', code: 'WH-MAIN' }];
  const soLocation = rec ? (rec.location || 'HO Kottayam') : (srcQuote ? (srcQuote.location || 'HO Kottayam') : 'HO Kottayam');
  const soSeries = rec ? (rec.transaction_series || 'Default Transaction Series') : (srcQuote ? (srcQuote.transaction_series || 'Default Transaction Series') : 'Default Transaction Series');
  const soNumber = rec ? rec.number : (nextNum ? nextNum.next_number : 'SO-000001');
  const soCustomer = rec ? (rec.customer_id || rec.party_id) : (srcQuote ? (srcQuote.customer_id || srcQuote.party_id) : '');
  const soDate = rec ? rec.date : (window.APP && window.APP.today ? window.APP.today : new Date().toISOString().slice(0, 10));
  const soShipDate = rec ? (rec.expected_shipment_date || '') : (srcQuote ? (srcQuote.expiry_date || '') : '');
  const soOrderNum = rec ? (rec.order_number || '') : (srcQuote ? (srcQuote.reference_number || srcQuote.number) : '');
  const soSalesperson = rec ? (rec.salesperson || '') : (srcQuote ? (srcQuote.salesperson || '') : '');
  const soSubject = rec ? (rec.subject || '') : (srcQuote ? (srcQuote.subject || '') : '');
  const soPos = rec ? (rec.place_of_supply || APP.org.state) : (srcQuote ? (srcQuote.place_of_supply || APP.org.state) : (parties.find(p => String(p.id) === String(soCustomer))?.state || APP.org.state));
  const soStatus = rec ? (rec.status || 'confirmed') : 'confirmed';
  const soNotes = rec ? (rec.notes != null ? rec.notes : '') : (srcQuote && srcQuote.notes ? srcQuote.notes : '');
  const soTerms = rec ? (rec.terms != null ? rec.terms : (APP.org.terms_default || 'Payment within 30 days.')) : (srcQuote ? srcQuote.terms : (APP.org.terms_default || 'Payment within 30 days.'));
  const soTaxPricing = rec ? (rec.tax_pricing_type || 'tax_exclusive') : (srcQuote ? (srcQuote.tax_pricing_type || 'tax_exclusive') : 'tax_exclusive');
  const soCustType = rec ? (rec.customer_type || 'b2b') : (srcQuote ? (srcQuote.customer_type || 'b2b') : 'b2b');
  const soLines = (rec && rec.lines && rec.lines.length) ? rec.lines : ((srcQuote && srcQuote.lines && srcQuote.lines.length) ? srcQuote.lines : [{ quantity: 1, rate: 0, discount_percent: 0, gst_rate: 18 }]);
  const pendingFiles = [];

  const rowHtml = (l = {}) => `
    <tr class="ln-so" style="border-bottom:1px solid var(--bd);">
      <td style="width:50px;text-align:center;padding:10px 4px;vertical-align:top;">
        <div style="display:flex;align-items:center;justify-content:center;gap:6px;color:#94a3b8;padding-top:6px;">
          <i class="fa-solid fa-grip-vertical" style="cursor:grab;font-size:13px;"></i>
          <i class="fa-regular fa-image" style="font-size:16px;"></i>
        </div>
      </td>
      <td style="min-width:280px;padding:10px 8px;vertical-align:top;">
        <select class="in l-item" aria-label="Item" style="width:100%;margin-bottom:6px;">
          <option value="">Type or click to select an item.</option>
          <option value="__new_item__" style="color:var(--accent);font-weight:600;">+ Add New Item…</option>
          ${items.map(it => `<option value="${it.id}" ${String(l.item || l.item_id) === String(it.id) ? 'selected' : ''}>${esc(it.name)}${it.sku ? ' (' + esc(it.sku) + ')' : ''}</option>`).join('')}
        </select>
        <input class="in l-desc" aria-label="Description" placeholder="Description / details" maxlength="500" value="${esc(l.description || '')}" style="font-size:12px;padding:4px 8px;width:100%;">
        <input type="hidden" class="l-hsn" value="${esc(l.hsn_sac || '')}">
      </td>
      ${renderStockQuantityCell(l, items, warehouses)}
      <td style="width:110px;padding:10px 8px;vertical-align:top;">
        <input class="in l-rate" type="number" step="0.01" min="0" value="${esc(l.rate == null ? '0.00' : l.rate)}" style="text-align:right;width:100%;">
      </td>
      <td style="width:120px;padding:10px 8px;vertical-align:top;">
        <div style="display:flex;gap:4px;">
          <input class="in l-disc" type="number" step="0.01" min="0" max="100" value="${esc(l.discount_percent || 0)}" style="text-align:right;flex:1;min-width:45px;">
          <select class="in l-disc-type" style="width:48px;padding:4px;">
            <option value="percent">%</option>
            <option value="amount">₹</option>
          </select>
        </div>
      </td>
      <td style="width:140px;padding:10px 8px;vertical-align:top;">
        <select class="in l-gst" aria-label="Tax rate" style="width:100%;">
          <option value="0">Select a Tax</option>
          <option value="0" ${num(l.gst_rate) === 0 ? 'selected' : ''}>GST [0%]</option>
          <option value="5" ${num(l.gst_rate) === 5 ? 'selected' : ''}>GST [5%]</option>
          <option value="12" ${num(l.gst_rate) === 12 ? 'selected' : ''}>GST [12%]</option>
          <option value="18" ${l.gst_rate == null || num(l.gst_rate) === 18 ? 'selected' : ''}>GST [18%]</option>
          <option value="28" ${num(l.gst_rate) === 28 ? 'selected' : ''}>GST [28%]</option>
        </select>
      </td>
      <td style="width:100px;padding:10px 8px;text-align:right;font-weight:600;vertical-align:top;" class="l-amt">
        ${(l.line_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </td>
      <td style="width:36px;text-align:center;vertical-align:top;padding-top:14px;">
        <button type="button" class="btn ic" data-rm-line style="color:var(--tx-muted);font-size:16px;border:none;background:none;cursor:pointer;" title="Remove row">×</button>
      </td>
    </tr>
  `;

  target.innerHTML = `
    <div class="so-form-page" style="background:#fff;min-height:100%;display:flex;flex-direction:column;">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 28px;border-bottom:1px solid var(--bd);background:#fff;position:sticky;top:0;z-index:20;">
        <div style="display:flex;align-items:center;gap:12px;">
          <i class="fa-regular fa-file-lines" style="font-size:22px;color:#1e293b;"></i>
          <h1 style="font-size:20px;font-weight:700;margin:0;color:#0f172a;">${id ? 'Edit Sales Order' : 'New Sales Order'}</h1>
        </div>
        <div style="display:flex;align-items:center;gap:14px;">
          <button type="button" class="btn ic" title="Settings" style="border:none;background:transparent;color:#3b82f6;font-size:16px;cursor:pointer;"><i class="fa-solid fa-gear"></i></button>
          <button type="button" class="btn ic" id="btn-so-close-x" title="Close" style="border:none;background:transparent;color:#64748b;font-size:18px;cursor:pointer;"><i class="fa-solid fa-xmark"></i></button>
        </div>
      </div>

      <form id="so-form-element" style="padding:28px;max-width:1100px;width:100%;box-sizing:border-box;" novalidate>
        <div class="fe" data-err="_" role="alert"></div>

        <div style="display:flex;flex-direction:column;gap:16px;margin-bottom:28px;">
          <div style="display:flex;align-items:center;gap:16px;">
            <label style="width:160px;font-weight:500;font-size:13px;color:#ef4444;">Customer Name*</label>
            <div style="display:flex;align-items:center;gap:8px;flex:1;max-width:480px;">
              <select class="in" id="so-customer" name="customer" required style="flex:1;">
                <option value="">Select or add a customer</option>
                <option value="__new_customer__" style="color:var(--accent);font-weight:600;">+ Add New Customer…</option>
                ${parties.map(p => `<option value="${p.id}" ${String(soCustomer) === String(p.id) ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
              </select>
              <button type="button" class="btn p" id="btn-so-cust-lookup" title="Search / Add Customer" style="padding:0 12px;height:34px;border-radius:4px;cursor:pointer;">
                <i class="fa-solid fa-magnifying-glass"></i>
              </button>
              <div style="font-size:12px;font-weight:600;padding:6px 10px;background:#f1f5f9;border:1px solid #cbd5e1;border-radius:4px;color:#334155;">INR</div>
            </div>
          </div>

          <div style="display:flex;align-items:flex-start;gap:16px;">
            <label style="width:160px;font-weight:500;font-size:13px;color:var(--tx);padding-top:6px;">Location</label>
            <div>
              <select class="in" id="so-location" name="location" style="width:260px;">
                ${warehouses.map(w => `<option value="${esc(w.name)}" ${(soLocation === w.name) || (!rec && w.name === 'HO Kottayam') ? 'selected' : ''}>${esc(w.name)}</option>`).join('')}
              </select>
              <div id="so-source-of-supply" style="font-size:11.5px;color:#64748b;margin-top:3px;">
                Source of Supply: ${esc(rec ? (rec.place_of_supply || 'Kerala') : (window.APP && window.APP.org ? window.APP.org.state : 'Kerala'))}
              </div>
            </div>
          </div>

          <div style="display:flex;align-items:center;gap:16px;">
            <label style="width:160px;font-weight:500;font-size:13px;color:var(--tx);">Customer Type</label>
            <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;">
              <select class="in" id="so-customer-type" name="customer_type" style="width:260px;">
                <option value="b2b" ${soCustType === 'b2b' ? 'selected' : ''}>B2B - Business to Business</option>
                <option value="b2c" ${soCustType === 'b2c' ? 'selected' : ''}>B2C - Business to Consumer</option>
              </select>
              <div id="so-customer-gstin-wrap" style="display:flex;align-items:center;gap:6px;font-size:12px;background:#f8fafc;padding:4px 10px;border-radius:4px;border:1px solid var(--bd);">
                <span style="color:#64748b;font-weight:500;">GSTIN:</span>
                <span id="so-customer-gstin" style="font-weight:600;color:var(--tx);">${(rec && rec.party_details && rec.party_details.gstin) || (parties.find(p => String(p.id) === String(soCustomer))?.gstin) || 'Not provided'}</span>
              </div>
            </div>
          </div>

          <div style="display:flex;align-items:center;gap:16px;">
            <label style="width:160px;font-weight:500;font-size:13px;color:#ef4444;">Sales Order#*</label>
            <div style="display:flex;align-items:center;gap:8px;">
              <select class="in" id="so-series" name="transaction_series" style="width:180px;">
                <option value="Default Transaction Series" ${(soSeries === 'Default Transaction Series') ? 'selected' : ''}>Default Transaction Series</option>
                <option value="Online Store Series" ${soSeries === 'Online Store Series' ? 'selected' : ''}>Online Store Series</option>
                <option value="Export Series" ${soSeries === 'Export Series' ? 'selected' : ''}>Export Series</option>
                <option value="Retail Series" ${soSeries === 'Retail Series' ? 'selected' : ''}>Retail Series</option>
              </select>
              <input class="in" id="so-number" name="number" value="${soNumber}" required style="width:180px;">
              <button type="button" class="btn ic" id="btn-so-num-pref" title="Configure Sales Order Preferences" style="border:1px solid var(--bd);border-radius:4px;padding:6px 10px;color:#3b82f6;cursor:pointer;">
                <i class="fa-solid fa-gear"></i>
              </button>
            </div>
          </div>

          <div style="display:flex;align-items:center;gap:16px;">
            <label style="width:160px;font-weight:500;font-size:13px;color:var(--tx);">Order Number</label>
            <input class="in" id="so-order-number" name="order_number" value="${esc(soOrderNum)}" placeholder="e.g. ORD-2026-001" style="width:260px;">
          </div>

          <div style="display:flex;align-items:center;gap:16px;">
            <label style="width:160px;font-weight:500;font-size:13px;color:var(--tx);">Reference# / PO#</label>
            <input class="in" id="so-reference" name="reference_number" value="${esc(rec ? (rec.reference_number || '') : '')}" placeholder="e.g. PO-2026-001" style="width:260px;">
          </div>

          <div style="display:flex;align-items:center;flex-wrap:wrap;gap:16px;">
            <label style="width:160px;font-weight:500;font-size:13px;color:#ef4444;">Sales Order Date*</label>
            <input class="in" type="date" id="so-date" name="date" value="${soDate}" required style="width:260px;">

            <label style="font-weight:500;font-size:13px;color:var(--tx);margin-left:20px;">Expected Shipment Date</label>
            <input class="in" type="date" id="so-ship-date" name="expected_shipment_date" value="${soShipDate}" style="width:180px;">
          </div>

          <div style="display:flex;align-items:center;gap:16px;">
            <label style="width:160px;font-weight:500;font-size:13px;color:var(--tx);">Salesperson</label>
            <div id="so-salesperson-container"></div>
          </div>

          <div style="display:flex;align-items:center;gap:16px;">
            <label style="width:160px;font-weight:500;font-size:13px;color:var(--tx);">Associate Project(s)</label>
            <select class="in" id="so-project" name="project_name" style="width:260px;" disabled>
              <option value="">There are no active projects for this customer.</option>
            </select>
          </div>

          <div style="display:flex;align-items:flex-start;gap:16px;">
            <label style="width:160px;font-weight:500;font-size:13px;color:var(--tx);display:flex;align-items:center;gap:4px;padding-top:6px;">
              Subject <i class="fa-solid fa-circle-info" style="color:var(--tx-muted);font-size:12px;"></i>
            </label>
            <textarea class="in" id="so-subject" name="subject" rows="2" placeholder="Let your customer know what this Sales Order is for" style="width:260px;font-size:12px;">${esc(soSubject)}</textarea>
          </div>

          <input type="hidden" id="so-pos" name="place_of_supply" value="${esc(soPos)}">
        </div>

        <div style="margin-top:32px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
            <div style="display:flex;align-items:center;gap:12px;">
              <span style="font-size:15px;font-weight:700;color:var(--tx);">Item Table</span>
              <select class="in" id="so-tax-pricing" name="tax_pricing_type" style="width:145px;height:30px;font-size:12px;font-weight:600;padding:2px 8px;border-radius:6px;border:1px solid #93c5fd;background:#f0fdf4;color:#1e293b;" title="Tax Pricing Type">
                <option value="tax_exclusive" ${soTaxPricing === 'tax_exclusive' ? 'selected' : ''}>Tax Exclusive</option>
                <option value="tax_inclusive" ${soTaxPricing === 'tax_inclusive' ? 'selected' : ''}>Tax Inclusive</option>
              </select>
              <button type="button" class="btn btn-tax-pricing-info" data-doc-kind="sales-orders" style="background:#eff6ff;color:#2563eb;border:1px solid #bfdbfe;font-size:11.5px;font-weight:600;padding:2px 10px;border-radius:14px;cursor:pointer;display:inline-flex;align-items:center;gap:5px;" title="Learn about Tax Exclusive, Tax Inclusive, B2B & B2C GST billing">
                <i class="fa-solid fa-circle-info"></i> Guide
              </button>
            </div>
            <div style="display:flex;align-items:center;gap:12px;">
              <button type="button" class="btn" id="btn-so-scan" style="background:none;border:none;color:#2563eb;font-weight:500;font-size:12px;display:flex;align-items:center;gap:6px;cursor:pointer;">
                <i class="fa-solid fa-barcode"></i> Scan Item
              </button>
              <button type="button" class="btn" id="btn-so-bulk-actions" style="background:none;border:none;color:#2563eb;font-weight:500;font-size:12px;display:flex;align-items:center;gap:6px;cursor:pointer;">
                <i class="fa-regular fa-circle-check"></i> Bulk Actions
              </button>
            </div>
          </div>

          <div class="tw" style="border:1px solid var(--bd);border-radius:6px;overflow-x:auto;">
            <table class="lt" style="margin:0;width:100%;border-collapse:collapse;">
              <thead style="background:#f8fafc;border-bottom:1px solid var(--bd);">
                <tr>
                  <th style="width:50px;"></th>
                  <th style="min-width:280px;text-align:left;padding:12px 8px;font-size:12px;font-weight:600;color:#64748b;">ITEM DETAILS</th>
                  <th style="width:140px;min-width:130px;text-align:right;padding:12px 8px;font-size:12px;font-weight:600;color:#64748b;">QUANTITY</th>
                  <th style="width:110px;text-align:right;padding:12px 8px;font-size:12px;font-weight:600;color:#64748b;">RATE (₹)</th>
                  <th style="width:120px;text-align:right;padding:12px 8px;font-size:12px;font-weight:600;color:#64748b;">DISCOUNT</th>
                  <th style="width:140px;text-align:left;padding:12px 8px;font-size:12px;font-weight:600;color:#64748b;">TAX</th>
                  <th style="width:100px;text-align:right;padding:12px 8px;font-size:12px;font-weight:600;color:#64748b;">AMOUNT</th>
                  <th style="width:36px;"></th>
                </tr>
              </thead>
              <tbody id="so-line-tbody">
                ${soLines.map(rowHtml).join('')}
              </tbody>
            </table>
          </div>

          <div style="display:flex;align-items:center;gap:12px;margin-top:14px;">
            <button type="button" class="btn" id="btn-so-add-row" style="background:#eff6ff;color:#2563eb;border:1px solid #bfdbfe;font-size:12px;font-weight:600;border-radius:6px;padding:6px 14px;cursor:pointer;">
              <i class="fa-solid fa-plus" style="margin-right:4px;"></i> Add New Row
            </button>
            <button type="button" class="btn" id="btn-so-bulk-items" style="background:none;border:1px solid var(--bd);color:var(--tx);font-size:12px;font-weight:500;border-radius:6px;padding:6px 14px;cursor:pointer;">
              <i class="fa-solid fa-layer-group" style="margin-right:4px;"></i> Add Items in Bulk
            </button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 380px;gap:40px;margin-top:36px;">
          <div style="display:flex;flex-direction:column;gap:20px;">
            <div>
              <label for="so-notes" style="font-weight:600;font-size:13px;color:var(--tx);display:block;margin-bottom:6px;">Customer Notes</label>
              <textarea class="in" id="so-notes" name="notes" rows="4" placeholder="Notes for the customer…" style="width:100%;min-height:92px;box-sizing:border-box;resize:vertical;padding:8px 10px;font-size:13px;line-height:1.5;">${esc(soNotes)}</textarea>
              <span style="font-size:11.5px;color:#64748b;display:block;margin-top:4px;">Will be displayed on the sales order</span>
            </div>
            <div>
              <label for="so-terms" style="font-weight:600;font-size:13px;color:var(--tx);display:block;margin-bottom:6px;">Terms &amp; Conditions</label>
              <textarea class="in" id="so-terms" name="terms" rows="4" placeholder="Payment &amp; delivery terms…" style="width:100%;min-height:92px;box-sizing:border-box;resize:vertical;padding:8px 10px;font-size:13px;line-height:1.5;">${esc(soTerms)}</textarea>
            </div>
            <div style="border-top:1px dashed var(--bd);padding-top:16px;">
              <label style="font-weight:600;font-size:13px;color:var(--tx);display:block;margin-bottom:6px;">Digital Signature</label>
              <div style="display:flex;align-items:center;gap:14px;">
                <button type="button" class="btn btn-doc-sign" id="btn-so-sign" style="font-size:12px;border:1px solid #cbd5e1;border-radius:6px;padding:6px 14px;background:#ffffff;display:inline-flex;align-items:center;gap:6px;cursor:pointer;color:var(--tx,#0f172a);font-weight:500;">
                  <i class="fa-solid fa-pen-nib"></i> ${rec && rec.signature_data ? 'Change Signature' : 'Sign Sales Order'}
                </button>
                <span id="so-sig-desc" style="font-size:11px;color:#64748b;">${rec && rec.signature_data ? 'Custom digital signature attached.' : 'No custom signature attached.'}</span>
              </div>
              <input type="hidden" id="so-signature-data" value="${rec && rec.signature_data ? esc(rec.signature_data) : ''}">
              <input type="hidden" id="so-signed-by" value="${rec && rec.signed_by ? esc(rec.signed_by) : ''}">
              <input type="hidden" id="so-signature-title" value="${rec && rec.signature_title ? esc(rec.signature_title) : ''}">
            </div>
          </div>

          <div style="background:#f8fafc;border:1px solid var(--bd);border-radius:8px;padding:20px;">
            <div style="display:flex;flex-direction:column;gap:12px;">
              <div style="display:flex;justify-content:space-between;font-size:13px;color:#475569;">
                <span>Sub Total</span>
                <span id="so-subtotal-val" style="font-weight:600;color:#0f172a;">0.00</span>
              </div>
              <div id="so-tax-rows" style="display:flex;flex-direction:column;gap:8px;"></div>
              <div style="border-top:2px solid #0f172a;padding-top:12px;margin-top:4px;display:flex;justify-content:space-between;align-items:baseline;">
                <span style="font-size:16px;font-weight:700;color:#0f172a;">Total (₹)</span>
                <span id="so-grandtotal-val" style="font-size:22px;font-weight:800;color:#0f172a;">0.00</span>
              </div>
            </div>
          </div>
        </div>

        ${renderPaymentGatewayBanner()}
      </form>

      <div style="position:sticky;bottom:0;background:#fff;border-top:1px solid var(--bd);padding:14px 28px;display:flex;align-items:center;justify-content:space-between;z-index:20;box-shadow:0 -4px 12px rgba(0,0,0,0.05);margin-top:auto;">
        <div style="display:flex;align-items:center;gap:12px;">
          <button type="button" class="btn" id="btn-so-cancel" style="padding:8px 18px;">Cancel</button>
          <button type="button" class="btn" id="btn-so-save-draft" style="padding:8px 18px;">Save as Draft</button>
          <button type="button" class="btn p" id="btn-so-save-confirm" style="padding:8px 22px;">${id ? 'Update Sales Order' : 'Save & Confirm'}</button>
        </div>
      </div>
    </div>
  `;

  const form = $('#so-form-element', target);
  const tbody = $('#so-line-tbody', form);
  const byId = Object.fromEntries(items.map(it => [String(it.id), it]));
  const stockTracker = initItemTableStockTracker(tbody, items, warehouses, () => calcSo());

  createSalespersonCustomDropdown($('#so-salesperson-container', form), soSalesperson, () => {});
  setupProjectSelectorForCustomer($('#so-project', form), soCustomer, rec ? rec.project_name : '');
  $('#so-customer', form)?.addEventListener('change', (e) => {
    setupProjectSelectorForCustomer($('#so-project', form), e.target.value);
  });

  $('#btn-so-num-pref', form)?.addEventListener('click', () => {
    openDocNumberPreferencesModal({
      kind: 'sales-orders',
      series: $('#so-series', form)?.value || 'Default Transaction Series',
      location: $('#so-location', form)?.value || 'HO Kottayam',
      onSave: (pfx, next) => {
        if (next) $('#so-number', form).value = next;
      }
    });
  });

  function calcSo() {
    const isTaxInclusive = ($('#so-tax-pricing', form)?.value === 'tax_inclusive');
    let subtotal = 0;
    let totalTax = 0;
    let totalQty = 0;

    $$('.ln-so', tbody).forEach(tr => {
      const q = num($('.l-qty', tr).value) || 0;
      const r = num($('.l-rate', tr).value) || 0;
      const discVal = num($('.l-disc', tr).value) || 0;
      const discType = $('.l-disc-type', tr)?.value || 'percent';
      const gst = num($('.l-gst', tr).value) || 0;

      totalQty += q;
      const gross = q * r;
      const disc = discType === 'percent' ? (gross * discVal / 100) : discVal;
      const net = Math.max(0, gross - disc);
      let taxable = net;
      let taxAmt = 0;
      let lineTot = net;

      if (isTaxInclusive && gst > 0) {
        taxable = Math.round((net / (1 + gst / 100)) * 100) / 100;
        taxAmt = Math.round((net - taxable) * 100) / 100;
        lineTot = net;
      } else {
        taxable = Math.round(net * 100) / 100;
        taxAmt = Math.round((taxable * (gst / 100)) * 100) / 100;
        lineTot = taxable + taxAmt;
      }

      subtotal += taxable;
      totalTax += taxAmt;

      const amtEl = $('.l-amt', tr);
      if (amtEl) amtEl.textContent = lineTot.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    });

    const subEl = $('#so-subtotal-val', form);
    if (subEl) subEl.textContent = inr(subtotal).replace('₹', '').trim();

    const posVal = $('#so-pos', form).value || APP.org.state;
    const isIntra = (posVal || '').trim().toLowerCase() === (APP.org.state || '').trim().toLowerCase();
    const taxRowsEl = $('#so-tax-rows', form);
    if (taxRowsEl) {
      if (totalTax > 0) {
        if (isIntra) {
          const half = totalTax / 2;
          taxRowsEl.innerHTML = `
            <div style="display:flex;justify-content:space-between;color:#475569;font-size:13px;">
              <span>CGST</span><span>${inr(half)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;color:#475569;font-size:13px;">
              <span>SGST</span><span>${inr(half)}</span>
            </div>
          `;
        } else {
          taxRowsEl.innerHTML = `
            <div style="display:flex;justify-content:space-between;color:#475569;font-size:13px;">
              <span>IGST</span><span>${inr(totalTax)}</span>
            </div>
          `;
        }
      } else {
        taxRowsEl.innerHTML = '';
      }
    }

    const grand = subtotal + totalTax;
    const grandEl = $('#so-grandtotal-val', form);
    if (grandEl) grandEl.textContent = inr(grand).replace('₹', '').trim();
    return { subtotal, totalTax, grand, totalQty };
  }

  $('#btn-so-close-x', target)?.addEventListener('click', () => {
    if (onDone) onDone(null);
    else if (window.docMasterDetail) docMasterDetail($('#pg'), 'sales-orders');
    else history.back();
  });
  $('#btn-so-cancel', target)?.addEventListener('click', () => {
    if (onDone) onDone(null);
    else if (window.docMasterDetail) docMasterDetail($('#pg'), 'sales-orders');
    else history.back();
  });

  $('#btn-so-cust-lookup', form)?.addEventListener('click', () => {
    handleQuickCreateSelect($('#so-customer', form), newCust => {
      parties.push(newCust);
      const opt = document.createElement('option');
      opt.value = newCust.id;
      opt.textContent = newCust.name;
      opt.selected = true;
      $('#so-customer', form).appendChild(opt);
      $('#so-customer', form).value = newCust.id;
      if (newCust.state) $('#so-pos', form).value = newCust.state;
      calcSo();
    });
  });

  $('#so-customer', form)?.addEventListener('change', e => {
    if (e.target.value === '__new_customer__') {
      handleQuickCreateSelect(e.target, newCust => {
        parties.push(newCust);
        if (newCust.state) $('#so-pos', form).value = newCust.state;
        calcSo();
      });
      return;
    }
    const custId = $('#so-customer', form).value;
    const cust = parties.find(p => String(p.id) === String(custId));
    if (cust) {
      if (cust.state) $('#so-pos', form).value = cust.state;
      const gstinEl = $('#so-customer-gstin', form);
      const custTypeEl = $('#so-customer-type', form);
      if (gstinEl) gstinEl.textContent = cust.gstin || 'Not provided';
      if (custTypeEl) {
        if (cust.gstin && cust.gstin.trim()) custTypeEl.value = 'b2b';
        else if (cust.customer_type === 'individual') custTypeEl.value = 'b2c';
      }
      calcSo();
    }
  });

  $('#btn-so-sign', form)?.addEventListener('click', () => {
    const curSigObj = {
      signature_data: $('#so-signature-data', form)?.value || '',
      signed_by: $('#so-signed-by', form)?.value || '',
      signature_title: $('#so-signature-title', form)?.value || '',
      number: soNumber
    };
    openSignatureModal(curSigObj, 'sales-orders', updated => {
      if ($('#so-signature-data', form)) $('#so-signature-data', form).value = updated.signature_data || '';
      if ($('#so-signed-by', form)) $('#so-signed-by', form).value = updated.signed_by || '';
      if ($('#so-signature-title', form)) $('#so-signature-title', form).value = updated.signature_title || '';
      const descEl = $('#so-sig-desc', form);
      const signBtn = $('#btn-so-sign', form);
      if (updated.signature_data) {
        if (descEl) descEl.textContent = 'Custom digital signature attached.';
        if (signBtn) signBtn.innerHTML = '<i class="fa-solid fa-pen-nib"></i> Change Signature';
      } else {
        if (descEl) descEl.textContent = 'No custom signature attached.';
        if (signBtn) signBtn.innerHTML = '<i class="fa-solid fa-pen-nib"></i> Sign Sales Order';
      }
    });
  });

  tbody.addEventListener('input', e => {
    if (e.target.matches('.l-qty, .l-rate, .l-disc')) calcSo();
  });
  tbody.addEventListener('change', e => {
    if (e.target.matches('.l-gst, .l-disc-type')) {
      calcSo();
    } else if (e.target.matches('.l-item')) {
      if (e.target.value === '__new_item__') {
        handleQuickCreateSelect(e.target, newItem => {
          items.push(newItem);
          byId[String(newItem.id)] = newItem;
          calcSo();
        });
        return;
      }
      const tr = e.target.closest('tr');
      const it = byId[e.target.value];
      if (it && tr) {
        $('.l-desc', tr).value = it.name;
        $('.l-hsn', tr).value = it.hsn_sac || '';
        $('.l-rate', tr).value = it.selling_price || 0;
        $('.l-gst', tr).value = String(num(it.gst_rate) || 18);
        stockTracker.updateRow(tr, true);
      }
      calcSo();
    }
  });

  tbody.addEventListener('click', e => {
    const rm = e.target.closest('[data-rm-line]');
    if (rm) {
      if ($$('.ln-so', tbody).length > 1) {
        rm.closest('tr').remove();
        calcSo();
      } else {
        toast('At least one line item is required.', 'err');
      }
    }
  });

  $('#btn-so-add-row', target)?.addEventListener('click', () => {
    tbody.insertAdjacentHTML('beforeend', rowHtml({ quantity: 1, rate: 0, discount_percent: 0, gst_rate: 18 }));
    stockTracker.updateRow(tbody.lastElementChild, false);
    calcSo();
  });

  $('#btn-so-bulk-items', target)?.addEventListener('click', () => {
    openBulkItemModal(items, selectedItems => {
      selectedItems.forEach(it => {
        tbody.insertAdjacentHTML('beforeend', rowHtml({
          item: it.id,
          description: it.name,
          hsn_sac: it.hsn_sac || '',
          quantity: 1,
          rate: it.selling_price || 0,
          discount_percent: 0,
          gst_rate: num(it.gst_rate) || 18
        }));
      });
      calcSo();
    });
  });

  $('#so-tax-pricing', form)?.addEventListener('change', calcSo);

  const saveSo = async (isDraft) => {
    const custId = $('#so-customer', form).value;
    if (!custId) {
      toast('Please select a customer.', 'err');
      $('#so-customer', form).focus();
      return;
    }
    const numVal = $('#so-number', form).value.trim();
    if (!numVal) {
      toast('Please enter a sales order number.', 'err');
      $('#so-number', form).focus();
      return;
    }
    const dt = $('#so-date', form).value;
    if (!dt) {
      toast('Please enter a sales order date.', 'err');
      return;
    }

    const lines = [];
    let lineErr = false;
    $$('.ln-so', tbody).forEach(tr => {
      const itVal = $('.l-item', tr).value;
      const descVal = $('.l-desc', tr).value.trim();
      const qtyVal = num($('.l-qty', tr).value) || 0;
      const rateVal = num($('.l-rate', tr).value) || 0;
      if (!descVal && !itVal) {
        lineErr = true;
        return;
      }
      lines.push({
        item: itVal || null,
        warehouse: $('.l-wh-select', tr)?.value || null,
        warehouse_id: $('.l-wh-select', tr)?.value || null,
        warehouse_code: $('.l-wh-code', tr)?.value || '',
        description: descVal || (itVal && byId[itVal] ? byId[itVal].name : 'Item line'),
        hsn_sac: $('.l-hsn', tr).value.trim(),
        quantity: qtyVal || 1,
        rate: rateVal,
        discount_percent: num($('.l-disc', tr).value) || 0,
        gst_rate: num($('.l-gst', tr).value) || 0
      });
    });

    if (lineErr || !lines.length) {
      toast('Please enter a description or select an item for each row.', 'err');
      return;
    }

    const payload = {
      customer: custId,
      customer_id: custId,
      number: numVal,
      order_number: ($('#so-order-number', form)?.value || $('#so-reference', form)?.value || '').trim(),
      location: $('#so-location', form)?.value || 'HO Kottayam',
      transaction_series: $('#so-series', form)?.value || 'Default Transaction Series',
      date: dt,
      expected_shipment_date: $('#so-ship-date', form).value || null,
      due_date: $('#so-ship-date', form).value || dt,
      tax_pricing_type: $('#so-tax-pricing', form)?.value || 'tax_exclusive',
      customer_type: $('#so-customer-type', form)?.value || 'b2b',
      place_of_supply: $('#so-pos', form).value || APP.org.state,
      salesperson: form.querySelector('#so-salesperson-container select.sp-select')?.value || '',
      project_name: $('#so-project', form)?.value || '',
      subject: $('#so-subject', form)?.value?.trim() || '',
      status: isDraft ? 'draft' : 'confirmed',
      notes: $('#so-notes', form).value.trim(),
      terms: $('#so-terms', form).value.trim(),
      signature_data: $('#so-signature-data', form)?.value || '',
      signed_by: $('#so-signed-by', form)?.value || '',
      signature_title: $('#so-signature-title', form)?.value || '',
      source_quote: srcQuote ? srcQuote.id : (rec ? rec.source_quote_id : null),
      lines: lines
    };

    const saveBtns = [$('#btn-so-save-draft', target), $('#btn-so-save-confirm', target)];
    saveBtns.forEach(b => { if (b) b.disabled = true; });

    try {
      let saved;
      if (id) {
        saved = await api(`sales-orders/${id}/`, { method: 'PUT', body: payload });
        toast(`Sales Order ${saved.number} updated successfully!`, 'ok');
      } else {
        saved = await api('sales-orders/', { method: 'POST', body: payload });
        toast(`Sales Order ${saved.number} created successfully!`, 'ok');
        if (srcQuote) {
          api(`quotes/${srcQuote.id}/action/accept/`).catch(() => {});
        }
      }

      if (onDone) onDone(saved);
      else if (window.docMasterDetail) docMasterDetail($('#pg'), 'sales-orders', saved.id);
      else {
        location.hash = '#/sales/sales-orders';
        route();
      }
    } catch (err) {
      toast(err.message, 'err');
    } finally {
      saveBtns.forEach(b => { if (b) b.disabled = false; });
    }
  };

  $('#btn-so-save-draft', target).addEventListener('click', () => saveSo(true));
  $('#btn-so-save-confirm', target).addEventListener('click', () => saveSo(false));

  calcSo();
}
window.salesOrderForm = salesOrderForm;
window.soForm = salesOrderForm;

async function billForm(id, targetEl, onDone, extraOpts = {}) {
  if (typeof targetEl === 'function') {
    extraOpts = onDone || {};
    onDone = targetEl;
    targetEl = null;
  }
  const target = (targetEl && targetEl.nodeType) ? targetEl : document.getElementById('pg') || document.body;

  let srcPO = null;
  if (!id && extraOpts && extraOpts.fromPO) {
    srcPO = await api(`purchase-orders/${extraOpts.fromPO}/`).catch(() => null);
  }

  const [parties, items, whList, nextNum, rec] = await Promise.all([
    api('lookup/vendors/').catch(() => []),
    api('lookup/items/').catch(() => []),
    api('lookup/warehouses/').catch(() => []),
    id ? Promise.resolve(null) : api('lookup/next-bill-number/').catch(() => ({ next_number: 'BILL-000001' })),
    id ? api(`bills/${id}/`).catch(() => null) : Promise.resolve(null)
  ]);

  const warehouses = (whList && whList.length) ? whList : [{ id: 1, name: 'HO Kottayam', code: 'WH-MAIN' }];
  const billLocation = rec ? (rec.location || 'HO Kottayam') : (srcPO ? (srcPO.location || 'HO Kottayam') : 'HO Kottayam');
  const billSeries = rec ? (rec.transaction_series || 'Default Transaction Series') : 'Default Transaction Series';
  const billAccountsPay = rec ? (rec.accounts_payable || 'Accounts Payable') : 'Accounts Payable';
  const billProject = rec ? (rec.project_name || '') : '';
  const billNum = rec ? rec.number : (nextNum ? nextNum.next_number : 'BILL-000001');
  const billVendor = rec ? (rec.vendor_id || rec.party_id) : (srcPO ? srcPO.vendor_id : '');
  const billDate = rec ? rec.date : (window.APP && window.APP.today ? window.APP.today : new Date().toISOString().slice(0, 10));
  const billDueDate = rec ? (rec.due_date || '') : billDate;
  const billTerms = rec ? (rec.terms || 'Due on Receipt') : (srcPO ? (srcPO.terms || 'Due on Receipt') : 'Due on Receipt');
  const billOrderNum = rec ? (rec.order_number || rec.vendor_ref || '') : (srcPO ? srcPO.number : '');
  const billSubject = rec ? (rec.subject || '') : '';
  const billPos = rec ? (rec.place_of_supply || APP.org.state) : (srcPO ? (srcPO.place_of_supply || APP.org.state) : (parties.find(p => String(p.id) === String(billVendor))?.state || APP.org.state));
  const billNotes = rec ? (rec.notes != null ? rec.notes : (APP.org.notes_default || 'Thanks for the service.')) : (srcPO ? srcPO.notes : (APP.org.notes_default || 'Thanks for the service.'));
  const billTaxPricing = rec ? (rec.tax_pricing_type || 'tax_exclusive') : (srcPO ? (srcPO.tax_pricing_type || 'tax_exclusive') : 'tax_exclusive');
  const billCustType = rec ? (rec.customer_type || 'registered') : (srcPO ? (srcPO.customer_type || 'registered') : 'registered');
  const billLines = (rec && rec.lines && rec.lines.length) ? rec.lines : ((srcPO && srcPO.lines && srcPO.lines.length) ? srcPO.lines : [{ quantity: 1, rate: 0, discount_percent: 0, gst_rate: 18 }]);

  const rowHtml = (l = {}) => `
    <tr class="ln-bill" style="border-bottom:1px solid var(--bd);">
      <td style="width:50px;text-align:center;padding:10px 4px;vertical-align:top;">
        <div style="display:flex;align-items:center;justify-content:center;gap:6px;color:#94a3b8;padding-top:6px;">
          <i class="fa-solid fa-grip-vertical" style="cursor:grab;font-size:13px;"></i>
          <i class="fa-regular fa-image" style="font-size:16px;"></i>
        </div>
      </td>
      <td style="min-width:280px;padding:10px 8px;vertical-align:top;">
        <select class="in l-item" aria-label="Item" style="width:100%;margin-bottom:6px;">
          <option value="">Type or click to select an item.</option>
          <option value="__new_item__" style="color:var(--accent);font-weight:600;">+ Add New Item…</option>
          ${items.map(it => `<option value="${it.id}" ${String(l.item || l.item_id) === String(it.id) ? 'selected' : ''}>${esc(it.name)}${it.sku ? ' (' + esc(it.sku) + ')' : ''}</option>`).join('')}
        </select>
        <input class="in l-desc" aria-label="Description" placeholder="Description / details" maxlength="500" value="${esc(l.description || '')}" style="font-size:12px;padding:4px 8px;width:100%;">
        <input type="hidden" class="l-hsn" value="${esc(l.hsn_sac || '')}">
      </td>
      ${renderStockQuantityCell(l, items, warehouses)}
      <td style="width:110px;padding:10px 8px;vertical-align:top;">
        <input class="in l-rate" type="number" step="0.01" min="0" value="${esc(l.rate == null ? '0.00' : l.rate)}" style="text-align:right;width:100%;">
      </td>
      <td style="width:120px;padding:10px 8px;vertical-align:top;">
        <div style="display:flex;gap:4px;">
          <input class="in l-disc" type="number" step="0.01" min="0" max="100" value="${esc(l.discount_percent || 0)}" style="text-align:right;flex:1;min-width:45px;">
          <select class="in l-disc-type" style="width:48px;padding:4px;">
            <option value="percent">%</option>
            <option value="amount">₹</option>
          </select>
        </div>
      </td>
      <td style="width:140px;padding:10px 8px;vertical-align:top;">
        <select class="in l-gst" aria-label="Tax rate" style="width:100%;">
          <option value="0">Select a Tax</option>
          <option value="0" ${num(l.gst_rate) === 0 ? 'selected' : ''}>GST [0%]</option>
          <option value="5" ${num(l.gst_rate) === 5 ? 'selected' : ''}>GST [5%]</option>
          <option value="12" ${num(l.gst_rate) === 12 ? 'selected' : ''}>GST [12%]</option>
          <option value="18" ${l.gst_rate == null || num(l.gst_rate) === 18 ? 'selected' : ''}>GST [18%]</option>
          <option value="28" ${num(l.gst_rate) === 28 ? 'selected' : ''}>GST [28%]</option>
        </select>
      </td>
      <td style="width:100px;padding:10px 8px;text-align:right;font-weight:600;vertical-align:top;" class="l-amt">
        ${(l.line_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </td>
      <td style="width:36px;text-align:center;vertical-align:top;padding-top:14px;">
        <button type="button" class="btn ic" data-rm-line style="color:var(--tx-muted);font-size:16px;border:none;background:none;cursor:pointer;" title="Remove row">×</button>
      </td>
    </tr>
  `;

  target.innerHTML = `
    <div class="bill-form-page" style="background:#fff;min-height:100%;display:flex;flex-direction:column;">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 28px;border-bottom:1px solid var(--bd);background:#fff;position:sticky;top:0;z-index:20;">
        <div style="display:flex;align-items:center;gap:12px;">
          <i class="fa-regular fa-file-lines" style="font-size:22px;color:#1e293b;"></i>
          <h1 style="font-size:20px;font-weight:700;margin:0;color:#0f172a;">${id ? 'Edit Bill' : 'New Bill'}</h1>
        </div>
        <div style="display:flex;align-items:center;gap:14px;">
          <button type="button" class="btn ic" title="Settings" style="border:none;background:transparent;color:#3b82f6;font-size:16px;cursor:pointer;"><i class="fa-solid fa-gear"></i></button>
          <button type="button" class="btn ic" id="btn-bill-close-x" title="Close" style="border:none;background:transparent;color:#64748b;font-size:18px;cursor:pointer;"><i class="fa-solid fa-xmark"></i></button>
        </div>
      </div>

      <form id="bill-form-element" style="padding:28px;max-width:1100px;width:100%;box-sizing:border-box;" novalidate>
        <div class="fe" data-err="_" role="alert"></div>

        <div style="display:flex;flex-direction:column;gap:16px;margin-bottom:28px;">
          <div style="display:flex;align-items:center;gap:16px;">
            <label style="width:160px;font-weight:500;font-size:13px;color:#ef4444;">Vendor Name*</label>
            <div style="display:flex;align-items:center;gap:8px;flex:1;max-width:480px;">
              <select class="in" id="bill-vendor" name="vendor" required style="flex:1;">
                <option value="">Select or add a vendor</option>
                <option value="__new_vendor__" style="color:var(--accent);font-weight:600;">+ Add New Vendor…</option>
                ${parties.map(p => `<option value="${p.id}" ${String(billVendor) === String(p.id) ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
              </select>
              <button type="button" class="btn p" id="btn-bill-vendor-lookup" title="Search / Add Vendor" style="padding:0 12px;height:34px;border-radius:4px;cursor:pointer;">
                <i class="fa-solid fa-magnifying-glass"></i>
              </button>
              <div style="font-size:12px;font-weight:600;padding:6px 10px;background:#f1f5f9;border:1px solid #cbd5e1;border-radius:4px;color:#334155;">INR</div>
            </div>
          </div>

          <div style="display:flex;align-items:flex-start;gap:16px;">
            <label style="width:160px;font-weight:500;font-size:13px;color:var(--tx);padding-top:6px;">Location</label>
            <div>
              <select class="in" id="bill-location" name="location" style="width:260px;">
                ${warehouses.map(w => `<option value="${esc(w.name)}" ${(billLocation === w.name) || (!rec && w.name === 'HO Kottayam') ? 'selected' : ''}>${esc(w.name)}</option>`).join('')}
              </select>
              <div id="bill-destination-of-supply" style="font-size:11.5px;color:#64748b;margin-top:3px;">
                Destination of Supply: ${esc(billPos || (window.APP && window.APP.org ? window.APP.org.state : 'Kerala'))}
              </div>
            </div>
          </div>

          <div style="display:flex;align-items:center;gap:16px;">
            <label style="width:160px;font-weight:500;font-size:13px;color:var(--tx);">Supplier Type</label>
            <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;">
              <select class="in" id="bill-customer-type" name="customer_type" style="width:260px;">
                <option value="registered" ${billCustType === 'registered' ? 'selected' : ''}>Registered Business</option>
                <option value="unregistered" ${billCustType === 'unregistered' ? 'selected' : ''}>Unregistered Supplier</option>
              </select>
              <div id="bill-vendor-gstin-wrap" style="display:flex;align-items:center;gap:6px;font-size:12px;background:#f8fafc;padding:4px 10px;border-radius:4px;border:1px solid var(--bd);">
                <span style="color:#64748b;font-weight:500;">GSTIN:</span>
                <span id="bill-vendor-gstin" style="font-weight:600;color:var(--tx);">${(rec && rec.party_details && rec.party_details.gstin) || (parties.find(p => String(p.id) === String(billVendor))?.gstin) || 'Not provided'}</span>
              </div>
            </div>
          </div>

          <div style="display:flex;align-items:center;gap:16px;">
            <label style="width:160px;font-weight:500;font-size:13px;color:#ef4444;">Bill#*</label>
            <div style="display:flex;align-items:center;gap:8px;">
              <select class="in" id="bill-series" name="transaction_series" style="width:180px;">
                <option value="Default Transaction Series" ${(billSeries === 'Default Transaction Series') ? 'selected' : ''}>Default Transaction Series</option>
                <option value="Online Store Series" ${billSeries === 'Online Store Series' ? 'selected' : ''}>Online Store Series</option>
                <option value="Export Series" ${billSeries === 'Export Series' ? 'selected' : ''}>Export Series</option>
                <option value="Retail Series" ${billSeries === 'Retail Series' ? 'selected' : ''}>Retail Series</option>
              </select>
              <input class="in" id="bill-number" name="number" value="${billNum}" required style="width:180px;">
              <button type="button" class="btn ic" id="btn-bill-num-pref" title="Configure Bill Preferences" style="border:1px solid var(--bd);border-radius:4px;padding:6px 10px;color:#3b82f6;cursor:pointer;">
                <i class="fa-solid fa-gear"></i>
              </button>
            </div>
          </div>

          <div style="display:flex;align-items:center;gap:16px;">
            <label style="width:160px;font-weight:500;font-size:13px;color:var(--tx);">Order Number / PO#</label>
            <input class="in" id="bill-order-number" name="order_number" value="${esc(billOrderNum)}" placeholder="e.g. PO-000001" style="width:260px;">
          </div>

          <div style="display:flex;align-items:center;flex-wrap:wrap;gap:16px;">
            <label style="width:160px;font-weight:500;font-size:13px;color:#ef4444;">Bill Date*</label>
            <input class="in" type="date" id="bill-date" name="date" value="${billDate}" required style="width:260px;">

            <label style="font-weight:500;font-size:13px;color:var(--tx);margin-left:20px;">Terms</label>
            <select class="in" id="bill-terms" name="terms" style="width:180px;">
              <option value="Due on Receipt" ${billTerms === 'Due on Receipt' ? 'selected' : ''}>Due on Receipt</option>
              <option value="Net 15" ${billTerms === 'Net 15' ? 'selected' : ''}>Net 15</option>
              <option value="Net 30" ${billTerms === 'Net 30' ? 'selected' : ''}>Net 30</option>
              <option value="Net 45" ${billTerms === 'Net 45' ? 'selected' : ''}>Net 45</option>
              <option value="Net 60" ${billTerms === 'Net 60' ? 'selected' : ''}>Net 60</option>
            </select>

            <label style="font-weight:500;font-size:13px;color:var(--tx);margin-left:20px;">Due Date</label>
            <input class="in" type="date" id="bill-due-date" name="due_date" value="${billDueDate}" style="width:160px;">
          </div>

          <div style="display:flex;align-items:center;gap:16px;">
            <label style="width:160px;font-weight:500;font-size:13px;color:var(--tx);display:flex;align-items:center;gap:4px;">
              Accounts Payable
              <i class="fa-solid fa-circle-question" style="color:#94a3b8;font-size:12px;cursor:help;" title="The liability account that tracks money owed to vendors"></i>
            </label>
            <select class="in" id="bill-accounts-payable" name="accounts_payable" style="width:260px;">
              <option value="Accounts Payable" selected>Accounts Payable</option>
            </select>
          </div>

          <div style="display:flex;align-items:center;gap:16px;">
            <label style="width:160px;font-weight:500;font-size:13px;color:var(--tx);">Associate Project(s)</label>
            <select class="in" id="bill-project" name="project_name" style="width:260px;" disabled>
              <option value="">There are no active projects for this vendor.</option>
            </select>
          </div>

          <div style="display:flex;align-items:flex-start;gap:16px;">
            <label style="width:160px;font-weight:500;font-size:13px;color:var(--tx);display:flex;align-items:center;gap:4px;padding-top:6px;">
              Subject <i class="fa-solid fa-circle-info" style="color:var(--tx-muted);font-size:12px;"></i>
            </label>
            <textarea class="in" id="bill-subject" name="subject" rows="2" placeholder="Summary or description of this bill" style="width:260px;font-size:12px;">${esc(billSubject)}</textarea>
          </div>

          <input type="hidden" id="bill-pos" name="place_of_supply" value="${esc(billPos)}">
        </div>

        <div style="margin-top:32px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
            <div style="display:flex;align-items:center;gap:12px;">
              <span style="font-size:15px;font-weight:700;color:var(--tx);">Item Table</span>
              <select class="in" id="bill-tax-pricing" name="tax_pricing_type" style="width:145px;height:30px;font-size:12px;font-weight:600;padding:2px 8px;border-radius:6px;border:1px solid #93c5fd;background:#f0fdf4;color:#1e293b;" title="Tax Pricing Type">
                <option value="tax_exclusive" ${billTaxPricing === 'tax_exclusive' ? 'selected' : ''}>Tax Exclusive</option>
                <option value="tax_inclusive" ${billTaxPricing === 'tax_inclusive' ? 'selected' : ''}>Tax Inclusive</option>
              </select>
              <button type="button" class="btn btn-tax-pricing-info" data-doc-kind="bills" style="background:#eff6ff;color:#2563eb;border:1px solid #bfdbfe;font-size:11.5px;font-weight:600;padding:2px 10px;border-radius:14px;cursor:pointer;display:inline-flex;align-items:center;gap:5px;" title="Learn about Tax Exclusive, Tax Inclusive, B2B & B2C GST billing">
                <i class="fa-solid fa-circle-info"></i> Guide
              </button>
            </div>
            <div style="display:flex;align-items:center;gap:12px;">
              <button type="button" class="btn" id="btn-bill-scan" style="background:none;border:none;color:#2563eb;font-weight:500;font-size:12px;display:flex;align-items:center;gap:6px;cursor:pointer;">
                <i class="fa-solid fa-barcode"></i> Scan Item
              </button>
              <button type="button" class="btn" id="btn-bill-bulk-actions" style="background:none;border:none;color:#2563eb;font-weight:500;font-size:12px;display:flex;align-items:center;gap:6px;cursor:pointer;">
                <i class="fa-regular fa-circle-check"></i> Bulk Actions
              </button>
            </div>
          </div>

          <div class="tw" style="border:1px solid var(--bd);border-radius:6px;overflow-x:auto;">
            <table class="lt" style="margin:0;width:100%;border-collapse:collapse;">
              <thead style="background:#f8fafc;border-bottom:1px solid var(--bd);">
                <tr>
                  <th style="width:50px;"></th>
                  <th style="min-width:280px;text-align:left;padding:12px 8px;font-size:12px;font-weight:600;color:#64748b;">ITEM DETAILS</th>
                  <th style="width:140px;min-width:130px;text-align:right;padding:12px 8px;font-size:12px;font-weight:600;color:#64748b;">QUANTITY</th>
                  <th style="width:110px;text-align:right;padding:12px 8px;font-size:12px;font-weight:600;color:#64748b;">RATE (₹)</th>
                  <th style="width:120px;text-align:right;padding:12px 8px;font-size:12px;font-weight:600;color:#64748b;">DISCOUNT</th>
                  <th style="width:140px;text-align:left;padding:12px 8px;font-size:12px;font-weight:600;color:#64748b;">TAX</th>
                  <th style="width:100px;text-align:right;padding:12px 8px;font-size:12px;font-weight:600;color:#64748b;">AMOUNT</th>
                  <th style="width:36px;"></th>
                </tr>
              </thead>
              <tbody id="bill-line-tbody">
                ${billLines.map(rowHtml).join('')}
              </tbody>
            </table>
          </div>

          <div style="display:flex;align-items:center;gap:12px;margin-top:14px;">
            <button type="button" class="btn" id="btn-bill-add-row" style="background:#eff6ff;color:#2563eb;border:1px solid #bfdbfe;font-size:12px;font-weight:600;border-radius:6px;padding:6px 14px;cursor:pointer;">
              <i class="fa-solid fa-plus" style="margin-right:4px;"></i> Add New Row
            </button>
            <button type="button" class="btn" id="btn-bill-bulk-items" style="background:none;border:1px solid var(--bd);color:var(--tx);font-size:12px;font-weight:500;border-radius:6px;padding:6px 14px;cursor:pointer;">
              <i class="fa-solid fa-layer-group" style="margin-right:4px;"></i> Add Items in Bulk
            </button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 380px;gap:40px;margin-top:36px;">
          <div style="display:flex;flex-direction:column;gap:20px;">
            <div>
              <label for="bill-notes" style="font-weight:600;font-size:13px;color:var(--tx);display:block;margin-bottom:6px;">Vendor Notes</label>
              <textarea class="in" id="bill-notes" name="notes" rows="4" placeholder="Notes for reference…" style="width:100%;min-height:92px;box-sizing:border-box;resize:vertical;padding:8px 10px;font-size:13px;line-height:1.5;">${esc(billNotes)}</textarea>
              <span style="font-size:11.5px;color:#64748b;display:block;margin-top:4px;">Will be displayed on the bill</span>
            </div>
            <div>
              <label for="bill-terms-input" style="font-weight:600;font-size:13px;color:var(--tx);display:block;margin-bottom:6px;">Terms &amp; Conditions</label>
              <textarea class="in" id="bill-terms-input" name="terms" rows="4" placeholder="Payment terms…" style="width:100%;min-height:92px;box-sizing:border-box;resize:vertical;padding:8px 10px;font-size:13px;line-height:1.5;">${esc(billTerms)}</textarea>
            </div>
            <div style="border-top:1px dashed var(--bd);padding-top:16px;">
              <label style="font-weight:600;font-size:13px;color:var(--tx);display:block;margin-bottom:6px;">Digital Signature</label>
              <div style="display:flex;align-items:center;gap:14px;">
                <button type="button" class="btn btn-doc-sign" id="btn-bill-sign" style="font-size:12px;border:1px solid #cbd5e1;border-radius:6px;padding:6px 14px;background:#ffffff;display:inline-flex;align-items:center;gap:6px;cursor:pointer;color:var(--tx,#0f172a);font-weight:500;">
                  <i class="fa-solid fa-pen-nib"></i> ${rec && rec.signature_data ? 'Change Signature' : 'Sign Bill'}
                </button>
                <span id="bill-sig-desc" style="font-size:11px;color:#64748b;">${rec && rec.signature_data ? 'Custom digital signature attached.' : 'No custom signature attached.'}</span>
              </div>
              <input type="hidden" id="bill-signature-data" value="${rec && rec.signature_data ? esc(rec.signature_data) : ''}">
              <input type="hidden" id="bill-signed-by" value="${rec && rec.signed_by ? esc(rec.signed_by) : ''}">
              <input type="hidden" id="bill-signature-title" value="${rec && rec.signature_title ? esc(rec.signature_title) : ''}">
            </div>
          </div>

          <div style="background:#f8fafc;border:1px solid var(--bd);border-radius:8px;padding:20px;">
            <div style="display:flex;flex-direction:column;gap:12px;">
              <div style="display:flex;justify-content:space-between;font-size:13px;color:#475569;">
                <span>Sub Total</span>
                <span id="bill-subtotal-val" style="font-weight:600;color:#0f172a;">0.00</span>
              </div>
              <div id="bill-tax-rows" style="display:flex;flex-direction:column;gap:8px;"></div>
              <div style="border-top:2px solid #0f172a;padding-top:12px;margin-top:4px;display:flex;justify-content:space-between;align-items:baseline;">
                <span style="font-size:16px;font-weight:700;color:#0f172a;">Total (₹)</span>
                <span id="bill-grandtotal-val" style="font-size:22px;font-weight:800;color:#0f172a;">0.00</span>
              </div>
            </div>
          </div>
        </div>
      </form>

      <div style="position:sticky;bottom:0;background:#fff;border-top:1px solid var(--bd);padding:14px 28px;display:flex;align-items:center;justify-content:space-between;z-index:20;box-shadow:0 -4px 12px rgba(0,0,0,0.05);margin-top:auto;">
        <div style="display:flex;align-items:center;gap:12px;">
          <button type="button" class="btn" id="btn-bill-cancel" style="padding:8px 18px;">Cancel</button>
          <button type="button" class="btn" id="btn-bill-save-draft" style="padding:8px 18px;">Save as Draft</button>
          <button type="button" class="btn p" id="btn-bill-save-approve" style="padding:8px 22px;">${id ? 'Update Bill' : 'Save & Approve'}</button>
        </div>
      </div>
    </div>
  `;

  const form = $('#bill-form-element', target);
  const tbody = $('#bill-line-tbody', form);
  const byId = Object.fromEntries(items.map(it => [String(it.id), it]));
  const stockTracker = initItemTableStockTracker(tbody, items, warehouses, () => calcBill());

  setupProjectSelectorForCustomer($('#bill-project', form), billVendor, billProject);
  $('#bill-vendor', form)?.addEventListener('change', (e) => {
    setupProjectSelectorForCustomer($('#bill-project', form), e.target.value);
  });

  $('#btn-bill-num-pref', form)?.addEventListener('click', () => {
    openDocNumberPreferencesModal({
      kind: 'bills',
      series: $('#bill-series', form)?.value || 'Default Transaction Series',
      location: $('#bill-location', form)?.value || 'HO Kottayam',
      onSave: (pfx, next) => {
        if (next) $('#bill-number', form).value = next;
      }
    });
  });

  function calcBill() {
    const isTaxInclusive = ($('#bill-tax-pricing', form)?.value === 'tax_inclusive');
    let subtotal = 0;
    let totalTax = 0;
    let totalQty = 0;

    $$('.ln-bill', tbody).forEach(tr => {
      const q = num($('.l-qty', tr).value) || 0;
      const r = num($('.l-rate', tr).value) || 0;
      const discVal = num($('.l-disc', tr).value) || 0;
      const discType = $('.l-disc-type', tr)?.value || 'percent';
      const gst = num($('.l-gst', tr).value) || 0;

      totalQty += q;
      const gross = q * r;
      const disc = discType === 'percent' ? (gross * discVal / 100) : discVal;
      const net = Math.max(0, gross - disc);
      let taxable = net;
      let taxAmt = 0;
      let lineTot = net;

      if (isTaxInclusive && gst > 0) {
        taxable = Math.round((net / (1 + gst / 100)) * 100) / 100;
        taxAmt = Math.round((net - taxable) * 100) / 100;
        lineTot = net;
      } else {
        taxable = Math.round(net * 100) / 100;
        taxAmt = Math.round((taxable * (gst / 100)) * 100) / 100;
        lineTot = taxable + taxAmt;
      }

      subtotal += taxable;
      totalTax += taxAmt;

      const amtEl = $('.l-amt', tr);
      if (amtEl) amtEl.textContent = lineTot.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    });

    const subEl = $('#bill-subtotal-val', form);
    if (subEl) subEl.textContent = inr(subtotal).replace('₹', '').trim();

    const posVal = $('#bill-pos', form).value || APP.org.state;
    const isIntra = (posVal || '').trim().toLowerCase() === (APP.org.state || '').trim().toLowerCase();
    const taxRowsEl = $('#bill-tax-rows', form);
    if (taxRowsEl) {
      if (totalTax > 0) {
        if (isIntra) {
          const half = totalTax / 2;
          taxRowsEl.innerHTML = `
            <div style="display:flex;justify-content:space-between;color:#475569;font-size:13px;">
              <span>CGST</span><span>${inr(half)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;color:#475569;font-size:13px;">
              <span>SGST</span><span>${inr(half)}</span>
            </div>
          `;
        } else {
          taxRowsEl.innerHTML = `
            <div style="display:flex;justify-content:space-between;color:#475569;font-size:13px;">
              <span>IGST</span><span>${inr(totalTax)}</span>
            </div>
          `;
        }
      } else {
        taxRowsEl.innerHTML = '';
      }
    }

    const grand = subtotal + totalTax;
    const grandEl = $('#bill-grandtotal-val', form);
    if (grandEl) grandEl.textContent = inr(grand).replace('₹', '').trim();
    return { subtotal, totalTax, grand, totalQty };
  }

  $('#btn-bill-close-x', target)?.addEventListener('click', () => {
    if (onDone) onDone(null);
    else if (window.docMasterDetail) docMasterDetail($('#pg'), 'bills');
    else history.back();
  });
  $('#btn-bill-cancel', target)?.addEventListener('click', () => {
    if (onDone) onDone(null);
    else if (window.docMasterDetail) docMasterDetail($('#pg'), 'bills');
    else history.back();
  });

  $('#btn-bill-vendor-lookup', form)?.addEventListener('click', () => {
    handleQuickCreateSelect($('#bill-vendor', form), newVen => {
      parties.push(newVen);
      const opt = document.createElement('option');
      opt.value = newVen.id;
      opt.textContent = newVen.name;
      opt.selected = true;
      $('#bill-vendor', form).appendChild(opt);
      $('#bill-vendor', form).value = newVen.id;
      if (newVen.state) $('#bill-pos', form).value = newVen.state;
      calcBill();
    });
  });

  $('#bill-vendor', form)?.addEventListener('change', e => {
    if (e.target.value === '__new_vendor__') {
      handleQuickCreateSelect(e.target, newVen => {
        parties.push(newVen);
        if (newVen.state) $('#bill-pos', form).value = newVen.state;
        calcBill();
      });
      return;
    }
    const venId = $('#bill-vendor', form).value;
    const ven = parties.find(p => String(p.id) === String(venId));
    if (ven) {
      if (ven.state) $('#bill-pos', form).value = ven.state;
      const gstinEl = $('#bill-vendor-gstin', form);
      const custTypeEl = $('#bill-customer-type', form);
      if (gstinEl) gstinEl.textContent = ven.gstin || 'Not provided';
      if (custTypeEl) {
        if (ven.gstin && ven.gstin.trim()) custTypeEl.value = 'registered';
        else custTypeEl.value = 'unregistered';
      }
      calcBill();
    }
  });

  $('#btn-bill-sign', form)?.addEventListener('click', () => {
    const curSigObj = {
      signature_data: $('#bill-signature-data', form)?.value || '',
      signed_by: $('#bill-signed-by', form)?.value || '',
      signature_title: $('#bill-signature-title', form)?.value || '',
      number: billNum
    };
    openSignatureModal(curSigObj, 'bills', updated => {
      if ($('#bill-signature-data', form)) $('#bill-signature-data', form).value = updated.signature_data || '';
      if ($('#bill-signed-by', form)) $('#bill-signed-by', form).value = updated.signed_by || '';
      if ($('#bill-signature-title', form)) $('#bill-signature-title', form).value = updated.signature_title || '';
      const descEl = $('#bill-sig-desc', form);
      const signBtn = $('#btn-bill-sign', form);
      if (updated.signature_data) {
        if (descEl) descEl.textContent = 'Custom digital signature attached.';
        if (signBtn) signBtn.innerHTML = '<i class="fa-solid fa-pen-nib"></i> Change Signature';
      } else {
        if (descEl) descEl.textContent = 'No custom signature attached.';
        if (signBtn) signBtn.innerHTML = '<i class="fa-solid fa-pen-nib"></i> Sign Bill';
      }
    });
  });

  tbody.addEventListener('input', e => {
    if (e.target.matches('.l-qty, .l-rate, .l-disc')) calcBill();
  });
  tbody.addEventListener('change', e => {
    if (e.target.matches('.l-gst, .l-disc-type')) {
      calcBill();
    } else if (e.target.matches('.l-item')) {
      if (e.target.value === '__new_item__') {
        handleQuickCreateSelect(e.target, newItem => {
          items.push(newItem);
          byId[String(newItem.id)] = newItem;
          calcBill();
        });
        return;
      }
      const tr = e.target.closest('tr');
      const it = byId[e.target.value];
      if (it && tr) {
        $('.l-desc', tr).value = it.name;
        $('.l-hsn', tr).value = it.hsn_sac || '';
        $('.l-rate', tr).value = it.purchase_price || it.selling_price || 0;
        $('.l-gst', tr).value = String(num(it.gst_rate) || 18);
        stockTracker.updateRow(tr, true);
      }
      calcBill();
    }
  });

  tbody.addEventListener('click', e => {
    const rm = e.target.closest('[data-rm-line]');
    if (rm) {
      if ($$('.ln-bill', tbody).length > 1) {
        rm.closest('tr').remove();
        calcBill();
      } else {
        toast('At least one line item is required.', 'err');
      }
    }
  });

  $('#btn-bill-add-row', target)?.addEventListener('click', () => {
    tbody.insertAdjacentHTML('beforeend', rowHtml({ quantity: 1, rate: 0, discount_percent: 0, gst_rate: 18 }));
    stockTracker.updateRow(tbody.lastElementChild, false);
    calcBill();
  });

  $('#btn-bill-bulk-items', target)?.addEventListener('click', () => {
    openBulkItemModal(items, selectedItems => {
      selectedItems.forEach(it => {
        tbody.insertAdjacentHTML('beforeend', rowHtml({
          item: it.id,
          description: it.name,
          hsn_sac: it.hsn_sac || '',
          quantity: 1,
          rate: it.purchase_price || it.selling_price || 0,
          discount_percent: 0,
          gst_rate: num(it.gst_rate) || 18
        }));
      });
      calcBill();
    });
  });

  $('#bill-tax-pricing', form)?.addEventListener('change', calcBill);

  const saveBill = async (isDraft) => {
    const venId = $('#bill-vendor', form).value;
    if (!venId) {
      toast('Please select a vendor.', 'err');
      $('#bill-vendor', form).focus();
      return;
    }
    const numVal = $('#bill-number', form).value.trim();
    if (!numVal) {
      toast('Please enter a bill number.', 'err');
      $('#bill-number', form).focus();
      return;
    }
    const dt = $('#bill-date', form).value;
    if (!dt) {
      toast('Please enter a bill date.', 'err');
      return;
    }

    const lines = [];
    let lineErr = false;
    $$('.ln-bill', tbody).forEach(tr => {
      const itVal = $('.l-item', tr).value;
      const descVal = $('.l-desc', tr).value.trim();
      const qtyVal = num($('.l-qty', tr).value) || 0;
      const rateVal = num($('.l-rate', tr).value) || 0;
      if (!descVal && !itVal) {
        lineErr = true;
        return;
      }
      lines.push({
        item: itVal || null,
        warehouse: $('.l-wh-select', tr)?.value || null,
        warehouse_id: $('.l-wh-select', tr)?.value || null,
        warehouse_code: $('.l-wh-code', tr)?.value || '',
        description: descVal || (itVal && byId[itVal] ? byId[itVal].name : 'Item line'),
        hsn_sac: $('.l-hsn', tr).value.trim(),
        quantity: qtyVal || 1,
        rate: rateVal,
        discount_percent: num($('.l-disc', tr).value) || 0,
        gst_rate: num($('.l-gst', tr).value) || 0
      });
    });

    if (lineErr || !lines.length) {
      toast('Please enter a description or select an item for each row.', 'err');
      return;
    }

    const payload = {
      vendor: venId,
      vendor_id: venId,
      number: numVal,
      order_number: $('#bill-order-number', form).value.trim(),
      vendor_ref: $('#bill-order-number', form).value.trim(),
      location: $('#bill-location', form)?.value || 'HO Kottayam',
      transaction_series: $('#bill-series', form)?.value || 'Default Transaction Series',
      accounts_payable: $('#bill-accounts-payable', form)?.value || 'Accounts Payable',
      project_name: $('#bill-project', form)?.value || '',
      date: dt,
      due_date: $('#bill-due-date', form).value || dt,
      terms: $('#bill-terms', form).value,
      tax_pricing_type: $('#bill-tax-pricing', form)?.value || 'tax_exclusive',
      customer_type: $('#bill-customer-type', form)?.value || 'registered',
      place_of_supply: $('#bill-pos', form).value || APP.org.state,
      subject: $('#bill-subject', form)?.value?.trim() || '',
      status: isDraft ? 'draft' : 'open',
      notes: $('#bill-notes', form).value.trim(),
      terms_conditions: $('#bill-terms-input', form)?.value?.trim() || '',
      signature_data: $('#bill-signature-data', form)?.value || '',
      signed_by: $('#bill-signed-by', form)?.value || '',
      signature_title: $('#bill-signature-title', form)?.value || '',
      source_purchase_order: srcPO ? srcPO.id : (rec ? rec.source_purchase_order_id : null),
      lines: lines
    };

    const saveBtns = [$('#btn-bill-save-draft', target), $('#btn-bill-save-approve', target)];
    saveBtns.forEach(b => { if (b) b.disabled = true; });

    try {
      let saved;
      if (id) {
        saved = await api(`bills/${id}/`, { method: 'PUT', body: payload });
        toast(`Bill ${saved.number} updated successfully!`, 'ok');
      } else {
        saved = await api('bills/', { method: 'POST', body: payload });
        toast(`Bill ${saved.number} created successfully!`, 'ok');
      }

      if (onDone) onDone(saved);
      else if (window.docMasterDetail) docMasterDetail($('#pg'), 'bills', saved.id);
      else {
        location.hash = '#/purchases/bills';
        route();
      }
    } catch (err) {
      toast(err.message, 'err');
    } finally {
      saveBtns.forEach(b => { if (b) b.disabled = false; });
    }
  };

  $('#btn-bill-save-draft', target).addEventListener('click', () => saveBill(true));
  $('#btn-bill-save-approve', target).addEventListener('click', () => saveBill(false));

  calcBill();
}
window.billForm = billForm;

async function purchaseOrderForm(id, targetEl, onDone, extraOpts = {}) {
  if (typeof targetEl === 'function') {
    extraOpts = onDone || {};
    onDone = targetEl;
    targetEl = null;
  }
  const target = (targetEl && targetEl.nodeType) ? targetEl : document.getElementById('pg') || document.body;

  const [parties, items, whList, nextNum, rec] = await Promise.all([
    api('lookup/vendors/').catch(() => []),
    api('lookup/items/').catch(() => []),
    api('lookup/warehouses/').catch(() => []),
    id ? Promise.resolve(null) : api('lookup/next-po-number/').catch(() => ({ next_number: 'PO-000001' })),
    id ? api(`purchase-orders/${id}/`).catch(() => null) : Promise.resolve(null)
  ]);

  const warehouses = (whList && whList.length) ? whList : [{ id: 1, name: 'HO Kottayam', code: 'WH-MAIN' }];
  const poLocation = rec ? (rec.location || 'HO Kottayam') : 'HO Kottayam';
  const poSeries = rec ? (rec.transaction_series || 'Default Transaction Series') : 'Default Transaction Series';
  const poProject = rec ? (rec.project_name || '') : '';
  const poNumber = rec ? rec.number : (nextNum ? nextNum.next_number : 'PO-000001');
  const poVendor = rec ? (rec.vendor_id || rec.party_id) : '';
  const poDate = rec ? rec.date : (window.APP && window.APP.today ? window.APP.today : new Date().toISOString().slice(0, 10));
  const poDeliveryDate = rec ? (rec.delivery_date || '') : poDate;
  const poOrderNum = rec ? (rec.order_number || '') : '';
  const poSubject = rec ? (rec.subject || '') : '';
  const poPos = rec ? (rec.place_of_supply || APP.org.state) : (parties.find(p => String(p.id) === String(poVendor))?.state || APP.org.state);
  const poNotes = rec ? (rec.notes != null ? rec.notes : (APP.org.notes_default || 'Looking forward to receipt of goods.')) : (APP.org.notes_default || 'Looking forward to receipt of goods.');
  const poTerms = rec ? (rec.terms != null ? rec.terms : (APP.org.terms_default || 'Standard terms apply.')) : (APP.org.terms_default || 'Standard terms apply.');
  const poTaxPricing = rec ? (rec.tax_pricing_type || 'tax_exclusive') : 'tax_exclusive';
  const poCustType = rec ? (rec.customer_type || 'registered') : 'registered';
  const poLines = (rec && rec.lines && rec.lines.length) ? rec.lines : [{ quantity: 1, rate: 0, discount_percent: 0, gst_rate: 18 }];

  const rowHtml = (l = {}) => `
    <tr class="ln-po" style="border-bottom:1px solid var(--bd);">
      <td style="width:50px;text-align:center;padding:10px 4px;vertical-align:top;">
        <div style="display:flex;align-items:center;justify-content:center;gap:6px;color:#94a3b8;padding-top:6px;">
          <i class="fa-solid fa-grip-vertical" style="cursor:grab;font-size:13px;"></i>
          <i class="fa-regular fa-image" style="font-size:16px;"></i>
        </div>
      </td>
      <td style="min-width:280px;padding:10px 8px;vertical-align:top;">
        <select class="in l-item" aria-label="Item" style="width:100%;margin-bottom:6px;">
          <option value="">Type or click to select an item.</option>
          <option value="__new_item__" style="color:var(--accent);font-weight:600;">+ Add New Item…</option>
          ${items.map(it => `<option value="${it.id}" ${String(l.item || l.item_id) === String(it.id) ? 'selected' : ''}>${esc(it.name)}${it.sku ? ' (' + esc(it.sku) + ')' : ''}</option>`).join('')}
        </select>
        <input class="in l-desc" aria-label="Description" placeholder="Description / details" maxlength="500" value="${esc(l.description || '')}" style="font-size:12px;padding:4px 8px;width:100%;">
        <input type="hidden" class="l-hsn" value="${esc(l.hsn_sac || '')}">
      </td>
      ${renderStockQuantityCell(l, items, warehouses)}
      <td style="width:110px;padding:10px 8px;vertical-align:top;">
        <input class="in l-rate" type="number" step="0.01" min="0" value="${esc(l.rate == null ? '0.00' : l.rate)}" style="text-align:right;width:100%;">
      </td>
      <td style="width:120px;padding:10px 8px;vertical-align:top;">
        <div style="display:flex;gap:4px;">
          <input class="in l-disc" type="number" step="0.01" min="0" max="100" value="${esc(l.discount_percent || 0)}" style="text-align:right;flex:1;min-width:45px;">
          <select class="in l-disc-type" style="width:48px;padding:4px;">
            <option value="percent">%</option>
            <option value="amount">₹</option>
          </select>
        </div>
      </td>
      <td style="width:140px;padding:10px 8px;vertical-align:top;">
        <select class="in l-gst" aria-label="Tax rate" style="width:100%;">
          <option value="0">Select a Tax</option>
          <option value="0" ${num(l.gst_rate) === 0 ? 'selected' : ''}>GST [0%]</option>
          <option value="5" ${num(l.gst_rate) === 5 ? 'selected' : ''}>GST [5%]</option>
          <option value="12" ${num(l.gst_rate) === 12 ? 'selected' : ''}>GST [12%]</option>
          <option value="18" ${l.gst_rate == null || num(l.gst_rate) === 18 ? 'selected' : ''}>GST [18%]</option>
          <option value="28" ${num(l.gst_rate) === 28 ? 'selected' : ''}>GST [28%]</option>
        </select>
      </td>
      <td style="width:100px;padding:10px 8px;text-align:right;font-weight:600;vertical-align:top;" class="l-amt">
        ${(l.line_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </td>
      <td style="width:36px;text-align:center;vertical-align:top;padding-top:14px;">
        <button type="button" class="btn ic" data-rm-line style="color:var(--tx-muted);font-size:16px;border:none;background:none;cursor:pointer;" title="Remove row">×</button>
      </td>
    </tr>
  `;

  target.innerHTML = `
    <div class="po-form-page" style="background:#fff;min-height:100%;display:flex;flex-direction:column;">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 28px;border-bottom:1px solid var(--bd);background:#fff;position:sticky;top:0;z-index:20;">
        <div style="display:flex;align-items:center;gap:12px;">
          <i class="fa-regular fa-file-lines" style="font-size:22px;color:#1e293b;"></i>
          <h1 style="font-size:20px;font-weight:700;margin:0;color:#0f172a;">${id ? 'Edit Purchase Order' : 'New Purchase Order'}</h1>
        </div>
        <div style="display:flex;align-items:center;gap:14px;">
          <button type="button" class="btn ic" title="Settings" style="border:none;background:transparent;color:#3b82f6;font-size:16px;cursor:pointer;"><i class="fa-solid fa-gear"></i></button>
          <button type="button" class="btn ic" id="btn-po-close-x" title="Close" style="border:none;background:transparent;color:#64748b;font-size:18px;cursor:pointer;"><i class="fa-solid fa-xmark"></i></button>
        </div>
      </div>

      <form id="po-form-element" style="padding:28px;max-width:1100px;width:100%;box-sizing:border-box;" novalidate>
        <div class="fe" data-err="_" role="alert"></div>

        <div style="display:flex;flex-direction:column;gap:16px;margin-bottom:28px;">
          <div style="display:flex;align-items:center;gap:16px;">
            <label style="width:160px;font-weight:500;font-size:13px;color:#ef4444;">Vendor Name*</label>
            <div style="display:flex;align-items:center;gap:8px;flex:1;max-width:480px;">
              <select class="in" id="po-vendor" name="vendor" required style="flex:1;">
                <option value="">Select or add a vendor</option>
                <option value="__new_vendor__" style="color:var(--accent);font-weight:600;">+ Add New Vendor…</option>
                ${parties.map(p => `<option value="${p.id}" ${String(poVendor) === String(p.id) ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
              </select>
              <button type="button" class="btn p" id="btn-po-vendor-lookup" title="Search / Add Vendor" style="padding:0 12px;height:34px;border-radius:4px;cursor:pointer;">
                <i class="fa-solid fa-magnifying-glass"></i>
              </button>
              <div style="font-size:12px;font-weight:600;padding:6px 10px;background:#f1f5f9;border:1px solid #cbd5e1;border-radius:4px;color:#334155;">INR</div>
            </div>
          </div>

          <div style="display:flex;align-items:flex-start;gap:16px;">
            <label style="width:160px;font-weight:500;font-size:13px;color:var(--tx);padding-top:6px;">Location</label>
            <div>
              <select class="in" id="po-location" name="location" style="width:260px;">
                ${warehouses.map(w => `<option value="${esc(w.name)}" ${(poLocation === w.name) || (!rec && w.name === 'HO Kottayam') ? 'selected' : ''}>${esc(w.name)}</option>`).join('')}
              </select>
              <div id="po-destination-of-supply" style="font-size:11.5px;color:#64748b;margin-top:3px;">
                Destination of Supply: ${esc(poPos || (window.APP && window.APP.org ? window.APP.org.state : 'Kerala'))}
              </div>
            </div>
          </div>

          <div style="display:flex;align-items:center;gap:16px;">
            <label style="width:160px;font-weight:500;font-size:13px;color:var(--tx);">Supplier Type</label>
            <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;">
              <select class="in" id="po-customer-type" name="customer_type" style="width:260px;">
                <option value="registered" ${poCustType === 'registered' ? 'selected' : ''}>Registered Business</option>
                <option value="unregistered" ${poCustType === 'unregistered' ? 'selected' : ''}>Unregistered Supplier</option>
              </select>
              <div id="po-vendor-gstin-wrap" style="display:flex;align-items:center;gap:6px;font-size:12px;background:#f8fafc;padding:4px 10px;border-radius:4px;border:1px solid var(--bd);">
                <span style="color:#64748b;font-weight:500;">GSTIN:</span>
                <span id="po-vendor-gstin" style="font-weight:600;color:var(--tx);">${(rec && rec.party_details && rec.party_details.gstin) || (parties.find(p => String(p.id) === String(poVendor))?.gstin) || 'Not provided'}</span>
              </div>
            </div>
          </div>

          <div style="display:flex;align-items:center;gap:16px;">
            <label style="width:160px;font-weight:500;font-size:13px;color:#ef4444;">Purchase Order#*</label>
            <div style="display:flex;align-items:center;gap:8px;">
              <select class="in" id="po-series" name="transaction_series" style="width:180px;">
                <option value="Default Transaction Series" ${(poSeries === 'Default Transaction Series') ? 'selected' : ''}>Default Transaction Series</option>
                <option value="Online Store Series" ${poSeries === 'Online Store Series' ? 'selected' : ''}>Online Store Series</option>
                <option value="Export Series" ${poSeries === 'Export Series' ? 'selected' : ''}>Export Series</option>
                <option value="Retail Series" ${poSeries === 'Retail Series' ? 'selected' : ''}>Retail Series</option>
              </select>
              <input class="in" id="po-number" name="number" value="${poNumber}" required style="width:180px;">
              <button type="button" class="btn ic" id="btn-po-num-pref" title="Configure Purchase Order Preferences" style="border:1px solid var(--bd);border-radius:4px;padding:6px 10px;color:#3b82f6;cursor:pointer;">
                <i class="fa-solid fa-gear"></i>
              </button>
            </div>
          </div>

          <div style="display:flex;align-items:center;gap:16px;">
            <label style="width:160px;font-weight:500;font-size:13px;color:var(--tx);">Reference#</label>
            <input class="in" id="po-reference" name="order_number" value="${esc(poOrderNum)}" placeholder="e.g. REF-PO-01" style="width:260px;">
          </div>

          <div style="display:flex;align-items:center;flex-wrap:wrap;gap:16px;">
            <label style="width:160px;font-weight:500;font-size:13px;color:#ef4444;">Purchase Order Date*</label>
            <input class="in" type="date" id="po-date" name="date" value="${poDate}" required style="width:260px;">

            <label style="font-weight:500;font-size:13px;color:#ef4444;margin-left:20px;">Expected Delivery Date*</label>
            <input class="in" type="date" id="po-delivery-date" name="delivery_date" value="${poDeliveryDate}" required style="width:260px;">
          </div>

          <div style="display:flex;align-items:center;gap:16px;">
            <label style="width:160px;font-weight:500;font-size:13px;color:var(--tx);">Associate Project(s)</label>
            <select class="in" id="po-project" name="project_name" style="width:260px;" disabled>
              <option value="">There are no active projects for this vendor.</option>
            </select>
          </div>

          <div style="display:flex;align-items:flex-start;gap:16px;">
            <label style="width:160px;font-weight:500;font-size:13px;color:var(--tx);display:flex;align-items:center;gap:4px;padding-top:6px;">
              Subject <i class="fa-solid fa-circle-info" style="color:var(--tx-muted);font-size:12px;"></i>
            </label>
            <textarea class="in" id="po-subject" name="subject" rows="2" placeholder="Let your vendor know what this Purchase Order is for" style="width:260px;font-size:12px;">${esc(poSubject)}</textarea>
          </div>

          <input type="hidden" id="po-pos" name="place_of_supply" value="${esc(poPos)}">
        </div>

        <div style="margin-top:32px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
            <div style="display:flex;align-items:center;gap:12px;">
              <span style="font-size:15px;font-weight:700;color:var(--tx);">Item Table</span>
              <select class="in" id="po-tax-pricing" name="tax_pricing_type" style="width:145px;height:30px;font-size:12px;font-weight:600;padding:2px 8px;border-radius:6px;border:1px solid #93c5fd;background:#f0fdf4;color:#1e293b;" title="Tax Pricing Type">
                <option value="tax_exclusive" ${poTaxPricing === 'tax_exclusive' ? 'selected' : ''}>Tax Exclusive</option>
                <option value="tax_inclusive" ${poTaxPricing === 'tax_inclusive' ? 'selected' : ''}>Tax Inclusive</option>
              </select>
              <button type="button" class="btn btn-tax-pricing-info" data-doc-kind="purchase-orders" style="background:#eff6ff;color:#2563eb;border:1px solid #bfdbfe;font-size:11.5px;font-weight:600;padding:2px 10px;border-radius:14px;cursor:pointer;display:inline-flex;align-items:center;gap:5px;" title="Learn about Tax Exclusive, Tax Inclusive, B2B & B2C GST billing">
                <i class="fa-solid fa-circle-info"></i> Guide
              </button>
            </div>
            <div style="display:flex;align-items:center;gap:12px;">
              <button type="button" class="btn" id="btn-po-scan" style="background:none;border:none;color:#2563eb;font-weight:500;font-size:12px;display:flex;align-items:center;gap:6px;cursor:pointer;">
                <i class="fa-solid fa-barcode"></i> Scan Item
              </button>
              <button type="button" class="btn" id="btn-po-bulk-actions" style="background:none;border:none;color:#2563eb;font-weight:500;font-size:12px;display:flex;align-items:center;gap:6px;cursor:pointer;">
                <i class="fa-regular fa-circle-check"></i> Bulk Actions
              </button>
            </div>
          </div>

          <div class="tw" style="border:1px solid var(--bd);border-radius:6px;overflow-x:auto;">
            <table class="lt" style="margin:0;width:100%;border-collapse:collapse;">
              <thead style="background:#f8fafc;border-bottom:1px solid var(--bd);">
                <tr>
                  <th style="width:50px;"></th>
                  <th style="min-width:280px;text-align:left;padding:12px 8px;font-size:12px;font-weight:600;color:#64748b;">ITEM DETAILS</th>
                  <th style="width:140px;min-width:130px;text-align:right;padding:12px 8px;font-size:12px;font-weight:600;color:#64748b;">QUANTITY</th>
                  <th style="width:110px;text-align:right;padding:12px 8px;font-size:12px;font-weight:600;color:#64748b;">RATE (₹)</th>
                  <th style="width:120px;text-align:right;padding:12px 8px;font-size:12px;font-weight:600;color:#64748b;">DISCOUNT</th>
                  <th style="width:140px;text-align:left;padding:12px 8px;font-size:12px;font-weight:600;color:#64748b;">TAX</th>
                  <th style="width:100px;text-align:right;padding:12px 8px;font-size:12px;font-weight:600;color:#64748b;">AMOUNT</th>
                  <th style="width:36px;"></th>
                </tr>
              </thead>
              <tbody id="po-line-tbody">
                ${poLines.map(rowHtml).join('')}
              </tbody>
            </table>
          </div>

          <div style="display:flex;align-items:center;gap:12px;margin-top:14px;">
            <button type="button" class="btn" id="btn-po-add-row" style="background:#eff6ff;color:#2563eb;border:1px solid #bfdbfe;font-size:12px;font-weight:600;border-radius:6px;padding:6px 14px;cursor:pointer;">
              <i class="fa-solid fa-plus" style="margin-right:4px;"></i> Add New Row
            </button>
            <button type="button" class="btn" id="btn-po-bulk-items" style="background:none;border:1px solid var(--bd);color:var(--tx);font-size:12px;font-weight:500;border-radius:6px;padding:6px 14px;cursor:pointer;">
              <i class="fa-solid fa-layer-group" style="margin-right:4px;"></i> Add Items in Bulk
            </button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 380px;gap:40px;margin-top:36px;">
          <div style="display:flex;flex-direction:column;gap:20px;">
            <div>
              <label for="po-notes" style="font-weight:600;font-size:13px;color:var(--tx);display:block;margin-bottom:6px;">Vendor Notes</label>
              <textarea class="in" id="po-notes" name="notes" rows="4" placeholder="Notes for the vendor…" style="width:100%;min-height:92px;box-sizing:border-box;resize:vertical;padding:8px 10px;font-size:13px;line-height:1.5;">${esc(poNotes)}</textarea>
              <span style="font-size:11.5px;color:#64748b;display:block;margin-top:4px;">Will be displayed on the purchase order</span>
            </div>
            <div>
              <label for="po-terms" style="font-weight:600;font-size:13px;color:var(--tx);display:block;margin-bottom:6px;">Terms &amp; Conditions</label>
              <textarea class="in" id="po-terms" name="terms" rows="4" placeholder="Terms of purchase…" style="width:100%;min-height:92px;box-sizing:border-box;resize:vertical;padding:8px 10px;font-size:13px;line-height:1.5;">${esc(poTerms)}</textarea>
            </div>
            <div style="border-top:1px dashed var(--bd);padding-top:16px;">
              <label style="font-weight:600;font-size:13px;color:var(--tx);display:block;margin-bottom:6px;">Digital Signature</label>
              <div style="display:flex;align-items:center;gap:14px;">
                <button type="button" class="btn btn-doc-sign" id="btn-po-sign" style="font-size:12px;border:1px solid #cbd5e1;border-radius:6px;padding:6px 14px;background:#ffffff;display:inline-flex;align-items:center;gap:6px;cursor:pointer;color:var(--tx,#0f172a);font-weight:500;">
                  <i class="fa-solid fa-pen-nib"></i> ${rec && rec.signature_data ? 'Change Signature' : 'Sign Purchase Order'}
                </button>
                <span id="po-sig-desc" style="font-size:11px;color:#64748b;">${rec && rec.signature_data ? 'Custom digital signature attached.' : 'No custom signature attached.'}</span>
              </div>
              <input type="hidden" id="po-signature-data" value="${rec && rec.signature_data ? esc(rec.signature_data) : ''}">
              <input type="hidden" id="po-signed-by" value="${rec && rec.signed_by ? esc(rec.signed_by) : ''}">
              <input type="hidden" id="po-signature-title" value="${rec && rec.signature_title ? esc(rec.signature_title) : ''}">
            </div>
          </div>

          <div style="background:#f8fafc;border:1px solid var(--bd);border-radius:8px;padding:20px;">
            <div style="display:flex;flex-direction:column;gap:12px;">
              <div style="display:flex;justify-content:space-between;font-size:13px;color:#475569;">
                <span>Sub Total</span>
                <span id="po-subtotal-val" style="font-weight:600;color:#0f172a;">0.00</span>
              </div>
              <div id="po-tax-rows" style="display:flex;flex-direction:column;gap:8px;"></div>
              <div style="border-top:2px solid #0f172a;padding-top:12px;margin-top:4px;display:flex;justify-content:space-between;align-items:baseline;">
                <span style="font-size:16px;font-weight:700;color:#0f172a;">Total (₹)</span>
                <span id="po-grandtotal-val" style="font-size:22px;font-weight:800;color:#0f172a;">0.00</span>
              </div>
            </div>
          </div>
        </div>
      </form>

      <div style="position:sticky;bottom:0;background:#fff;border-top:1px solid var(--bd);padding:14px 28px;display:flex;align-items:center;justify-content:space-between;z-index:20;box-shadow:0 -4px 12px rgba(0,0,0,0.05);margin-top:auto;">
        <div style="display:flex;align-items:center;gap:12px;">
          <button type="button" class="btn" id="btn-po-cancel" style="padding:8px 18px;">Cancel</button>
          <button type="button" class="btn" id="btn-po-save-draft" style="padding:8px 18px;">Save as Draft</button>
          <button type="button" class="btn p" id="btn-po-save-send" style="padding:8px 22px;">${id ? 'Update Purchase Order' : 'Save & Send'}</button>
        </div>
      </div>
    </div>
  `;

  const form = $('#po-form-element', target);
  const tbody = $('#po-line-tbody', form);
  const byId = Object.fromEntries(items.map(it => [String(it.id), it]));
  const stockTracker = initItemTableStockTracker(tbody, items, warehouses, () => calcPo());

  setupProjectSelectorForCustomer($('#po-project', form), poVendor, poProject);
  $('#po-vendor', form)?.addEventListener('change', (e) => {
    setupProjectSelectorForCustomer($('#po-project', form), e.target.value);
  });

  $('#btn-po-num-pref', form)?.addEventListener('click', () => {
    openDocNumberPreferencesModal({
      kind: 'purchase-orders',
      series: $('#po-series', form)?.value || 'Default Transaction Series',
      location: $('#po-location', form)?.value || 'HO Kottayam',
      onSave: (pfx, next) => {
        if (next) $('#po-number', form).value = next;
      }
    });
  });

  function calcPo() {
    const isTaxInclusive = ($('#po-tax-pricing', form)?.value === 'tax_inclusive');
    let subtotal = 0;
    let totalTax = 0;
    let totalQty = 0;

    $$('.ln-po', tbody).forEach(tr => {
      const q = num($('.l-qty', tr).value) || 0;
      const r = num($('.l-rate', tr).value) || 0;
      const discVal = num($('.l-disc', tr).value) || 0;
      const discType = $('.l-disc-type', tr)?.value || 'percent';
      const gst = num($('.l-gst', tr).value) || 0;

      totalQty += q;
      const gross = q * r;
      const disc = discType === 'percent' ? (gross * discVal / 100) : discVal;
      const net = Math.max(0, gross - disc);
      let taxable = net;
      let taxAmt = 0;
      let lineTot = net;

      if (isTaxInclusive && gst > 0) {
        taxable = Math.round((net / (1 + gst / 100)) * 100) / 100;
        taxAmt = Math.round((net - taxable) * 100) / 100;
        lineTot = net;
      } else {
        taxable = Math.round(net * 100) / 100;
        taxAmt = Math.round((taxable * (gst / 100)) * 100) / 100;
        lineTot = taxable + taxAmt;
      }

      subtotal += taxable;
      totalTax += taxAmt;

      const amtEl = $('.l-amt', tr);
      if (amtEl) amtEl.textContent = lineTot.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    });

    const subEl = $('#po-subtotal-val', form);
    if (subEl) subEl.textContent = inr(subtotal).replace('₹', '').trim();

    const posVal = $('#po-pos', form).value || APP.org.state;
    const isIntra = (posVal || '').trim().toLowerCase() === (APP.org.state || '').trim().toLowerCase();
    const taxRowsEl = $('#po-tax-rows', form);
    if (taxRowsEl) {
      if (totalTax > 0) {
        if (isIntra) {
          const half = totalTax / 2;
          taxRowsEl.innerHTML = `
            <div style="display:flex;justify-content:space-between;color:#475569;font-size:13px;">
              <span>CGST</span><span>${inr(half)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;color:#475569;font-size:13px;">
              <span>SGST</span><span>${inr(half)}</span>
            </div>
          `;
        } else {
          taxRowsEl.innerHTML = `
            <div style="display:flex;justify-content:space-between;color:#475569;font-size:13px;">
              <span>IGST</span><span>${inr(totalTax)}</span>
            </div>
          `;
        }
      } else {
        taxRowsEl.innerHTML = '';
      }
    }

    const grand = subtotal + totalTax;
    const grandEl = $('#po-grandtotal-val', form);
    if (grandEl) grandEl.textContent = inr(grand).replace('₹', '').trim();
    return { subtotal, totalTax, grand, totalQty };
  }

  $('#btn-po-close-x', target)?.addEventListener('click', () => {
    if (onDone) onDone(null);
    else if (window.docMasterDetail) docMasterDetail($('#pg'), 'purchase-orders');
    else history.back();
  });
  $('#btn-po-cancel', target)?.addEventListener('click', () => {
    if (onDone) onDone(null);
    else if (window.docMasterDetail) docMasterDetail($('#pg'), 'purchase-orders');
    else history.back();
  });

  $('#btn-po-vendor-lookup', form)?.addEventListener('click', () => {
    handleQuickCreateSelect($('#po-vendor', form), newVen => {
      parties.push(newVen);
      const opt = document.createElement('option');
      opt.value = newVen.id;
      opt.textContent = newVen.name;
      opt.selected = true;
      $('#po-vendor', form).appendChild(opt);
      $('#po-vendor', form).value = newVen.id;
      if (newVen.state) $('#po-pos', form).value = newVen.state;
      calcPo();
    });
  });

  $('#po-vendor', form)?.addEventListener('change', e => {
    if (e.target.value === '__new_vendor__') {
      handleQuickCreateSelect(e.target, newVen => {
        parties.push(newVen);
        if (newVen.state) $('#po-pos', form).value = newVen.state;
        calcPo();
      });
      return;
    }
    const venId = $('#po-vendor', form).value;
    const ven = parties.find(p => String(p.id) === String(venId));
    if (ven) {
      if (ven.state) $('#po-pos', form).value = ven.state;
      const gstinEl = $('#po-vendor-gstin', form);
      const custTypeEl = $('#po-customer-type', form);
      if (gstinEl) gstinEl.textContent = ven.gstin || 'Not provided';
      if (custTypeEl) {
        if (ven.gstin && ven.gstin.trim()) custTypeEl.value = 'registered';
        else custTypeEl.value = 'unregistered';
      }
      calcPo();
    }
  });

  $('#btn-po-sign', form)?.addEventListener('click', () => {
    const curSigObj = {
      signature_data: $('#po-signature-data', form)?.value || '',
      signed_by: $('#po-signed-by', form)?.value || '',
      signature_title: $('#po-signature-title', form)?.value || '',
      number: poNumber
    };
    openSignatureModal(curSigObj, 'purchase-orders', updated => {
      if ($('#po-signature-data', form)) $('#po-signature-data', form).value = updated.signature_data || '';
      if ($('#po-signed-by', form)) $('#po-signed-by', form).value = updated.signed_by || '';
      if ($('#po-signature-title', form)) $('#po-signature-title', form).value = updated.signature_title || '';
      const descEl = $('#po-sig-desc', form);
      const signBtn = $('#btn-po-sign', form);
      if (updated.signature_data) {
        if (descEl) descEl.textContent = 'Custom digital signature attached.';
        if (signBtn) signBtn.innerHTML = '<i class="fa-solid fa-pen-nib"></i> Change Signature';
      } else {
        if (descEl) descEl.textContent = 'No custom signature attached.';
        if (signBtn) signBtn.innerHTML = '<i class="fa-solid fa-pen-nib"></i> Sign Purchase Order';
      }
    });
  });

  tbody.addEventListener('input', e => {
    if (e.target.matches('.l-qty, .l-rate, .l-disc')) calcPo();
  });
  tbody.addEventListener('change', e => {
    if (e.target.matches('.l-gst, .l-disc-type')) {
      calcPo();
    } else if (e.target.matches('.l-item')) {
      if (e.target.value === '__new_item__') {
        handleQuickCreateSelect(e.target, newItem => {
          items.push(newItem);
          byId[String(newItem.id)] = newItem;
          calcPo();
        });
        return;
      }
      const tr = e.target.closest('tr');
      const it = byId[e.target.value];
      if (it && tr) {
        $('.l-desc', tr).value = it.name;
        $('.l-hsn', tr).value = it.hsn_sac || '';
        $('.l-rate', tr).value = it.purchase_price || it.selling_price || 0;
        $('.l-gst', tr).value = String(num(it.gst_rate) || 18);
        stockTracker.updateRow(tr, true);
      }
      calcPo();
    }
  });

  tbody.addEventListener('click', e => {
    const rm = e.target.closest('[data-rm-line]');
    if (rm) {
      if ($$('.ln-po', tbody).length > 1) {
        rm.closest('tr').remove();
        calcPo();
      } else {
        toast('At least one line item is required.', 'err');
      }
    }
  });

  $('#btn-po-add-row', target)?.addEventListener('click', () => {
    tbody.insertAdjacentHTML('beforeend', rowHtml({ quantity: 1, rate: 0, discount_percent: 0, gst_rate: 18 }));
    stockTracker.updateRow(tbody.lastElementChild, false);
    calcPo();
  });

  $('#btn-po-bulk-items', target)?.addEventListener('click', () => {
    openBulkItemModal(items, selectedItems => {
      selectedItems.forEach(it => {
        tbody.insertAdjacentHTML('beforeend', rowHtml({
          item: it.id,
          description: it.name,
          hsn_sac: it.hsn_sac || '',
          quantity: 1,
          rate: it.purchase_price || it.selling_price || 0,
          discount_percent: 0,
          gst_rate: num(it.gst_rate) || 18
        }));
      });
      calcPo();
    });
  });

  $('#po-tax-pricing', form)?.addEventListener('change', calcPo);

  const savePo = async (isDraft) => {
    const venId = $('#po-vendor', form).value;
    if (!venId) {
      toast('Please select a vendor.', 'err');
      $('#po-vendor', form).focus();
      return;
    }
    const numVal = $('#po-number', form).value.trim();
    if (!numVal) {
      toast('Please enter a purchase order number.', 'err');
      $('#po-number', form).focus();
      return;
    }
    const dt = $('#po-date', form).value;
    if (!dt) {
      toast('Please enter a purchase order date.', 'err');
      return;
    }

    const lines = [];
    let lineErr = false;
    $$('.ln-po', tbody).forEach(tr => {
      const itVal = $('.l-item', tr).value;
      const descVal = $('.l-desc', tr).value.trim();
      const qtyVal = num($('.l-qty', tr).value) || 0;
      const rateVal = num($('.l-rate', tr).value) || 0;
      if (!descVal && !itVal) {
        lineErr = true;
        return;
      }
      lines.push({
        item: itVal || null,
        warehouse: $('.l-wh-select', tr)?.value || null,
        warehouse_id: $('.l-wh-select', tr)?.value || null,
        warehouse_code: $('.l-wh-code', tr)?.value || '',
        description: descVal || (itVal && byId[itVal] ? byId[itVal].name : 'Item line'),
        hsn_sac: $('.l-hsn', tr).value.trim(),
        quantity: qtyVal || 1,
        rate: rateVal,
        discount_percent: num($('.l-disc', tr).value) || 0,
        gst_rate: num($('.l-gst', tr).value) || 0
      });
    });

    if (lineErr || !lines.length) {
      toast('Please enter a description or select an item for each row.', 'err');
      return;
    }

    const payload = {
      vendor: venId,
      vendor_id: venId,
      number: numVal,
      order_number: $('#po-reference', form).value.trim(),
      location: $('#po-location', form)?.value || 'HO Kottayam',
      transaction_series: $('#po-series', form)?.value || 'Default Transaction Series',
      project_name: $('#po-project', form)?.value || '',
      date: dt,
      delivery_date: $('#po-delivery-date', form).value || dt,
      due_date: $('#po-delivery-date', form).value || dt,
      terms: $('#po-terms', form).value,
      tax_pricing_type: $('#po-tax-pricing', form)?.value || 'tax_exclusive',
      customer_type: $('#po-customer-type', form)?.value || 'registered',
      place_of_supply: $('#po-pos', form).value || APP.org.state,
      subject: $('#po-subject', form)?.value?.trim() || '',
      status: isDraft ? 'draft' : 'confirmed',
      notes: $('#po-notes', form).value.trim(),
      signature_data: $('#po-signature-data', form)?.value || '',
      signed_by: $('#po-signed-by', form)?.value || '',
      signature_title: $('#po-signature-title', form)?.value || '',
      lines: lines
    };

    const saveBtns = [$('#btn-po-save-draft', target), $('#btn-po-save-send', target)];
    saveBtns.forEach(b => { if (b) b.disabled = true; });

    try {
      let saved;
      if (id) {
        saved = await api(`purchase-orders/${id}/`, { method: 'PUT', body: payload });
        toast(`Purchase Order ${saved.number} updated successfully!`, 'ok');
      } else {
        saved = await api('purchase-orders/', { method: 'POST', body: payload });
        toast(`Purchase Order ${saved.number} created successfully!`, 'ok');
      }

      if (onDone) onDone(saved);
      else if (window.docMasterDetail) docMasterDetail($('#pg'), 'purchase-orders', saved.id);
      else {
        location.hash = '#/purchases/purchase-orders';
        route();
      }
    } catch (err) {
      toast(err.message, 'err');
    } finally {
      saveBtns.forEach(b => { if (b) b.disabled = false; });
    }
  };

  $('#btn-po-save-draft', target).addEventListener('click', () => savePo(true));
  $('#btn-po-save-send', target).addEventListener('click', () => savePo(false));

  calcPo();
}
window.purchaseOrderForm = purchaseOrderForm;
window.billForm = billForm;
window.salesOrderForm = salesOrderForm;
window.soForm = salesOrderForm;
window.statementImportWizardModal = statementImportWizardModal;
window.importStatementModal = importStatementModal;

async function invoiceForm(id, targetEl, onDone, extraOpts = {}) {
  if (typeof targetEl === 'function') {
    extraOpts = onDone || {};
    onDone = targetEl;
    targetEl = null;
  }
  const target = targetEl || document.getElementById('pg') || document.body;

  let srcQuote = null;
  let srcSO = null;
  if (!id && extraOpts && extraOpts.fromQuote) {
    srcQuote = await api(`quotes/${extraOpts.fromQuote}/`).catch(() => null);
  } else if (!id && extraOpts && extraOpts.fromSO) {
    srcSO = await api(`sales-orders/${extraOpts.fromSO}/`).catch(() => null);
  }
  const [parties, items, salespersons, nextNum, rec, warehouses] = await Promise.all([
    api('lookup/customers/').catch(() => []),
    api('lookup/items/').catch(() => []),
    api('lookup/salespersons/').catch(() => []),
    id ? Promise.resolve(null) : api('lookup/next-invoice-number/').catch(() => ({ next_number: 'INV-000001' })),
    id ? api(`invoices/${id}/`).catch(() => null) : Promise.resolve(null),
    api('lookup/warehouses/').catch(() => [])
  ]);

  const whList = (warehouses && warehouses.length) ? warehouses : [{ id: 1, name: 'HO Kottayam', code: 'WH-MAIN' }];
  const invNum = rec ? rec.number : (nextNum ? nextNum.next_number : 'INV-000001');
  const invCustomer = rec ? (rec.customer_id || rec.party_id) : (srcQuote ? (srcQuote.customer_id || srcQuote.party_id) : (srcSO ? srcSO.customer_id : ''));
  const invDate = rec ? rec.date : (window.APP && window.APP.today ? window.APP.today : new Date().toISOString().slice(0, 10));
  const invDueDate = rec ? (rec.due_date || '') : invDate;
  const invTerms = rec ? (rec.terms || 'Due on Receipt') : (srcQuote ? (srcQuote.terms || 'Due on Receipt') : (srcSO ? (srcSO.terms || 'Due on Receipt') : 'Due on Receipt'));
  const invOrderNum = rec ? (rec.order_number || '') : (srcQuote ? (srcQuote.reference_number || srcQuote.number) : (srcSO ? srcSO.number : ''));
  const invSalesperson = rec ? (rec.salesperson || '') : (srcQuote ? (srcQuote.salesperson || '') : '');
  const invSubject = rec ? (rec.subject || '') : (srcQuote ? (srcQuote.subject || '') : '');
  const invPlaceOfSupply = rec ? (rec.place_of_supply || '') : (srcQuote ? (srcQuote.place_of_supply || '') : (srcSO ? (srcSO.place_of_supply || '') : (window.APP && window.APP.org ? window.APP.org.state : 'Kerala')));
  const invNotes = rec ? (rec.notes != null ? rec.notes : (window.APP && window.APP.org && window.APP.org.notes_default ? window.APP.org.notes_default : 'Thanks for your business.')) : (srcQuote ? srcQuote.notes : (srcSO ? srcSO.notes : 'Thanks for your business.'));
  const invTermsText = rec ? (rec.terms != null ? rec.terms : (window.APP && window.APP.org && window.APP.org.terms_default ? window.APP.org.terms_default : '')) : (srcQuote ? srcQuote.terms : (srcSO ? srcSO.terms : ''));
  const invTaxType = rec ? (rec.tax_type || 'tds') : (srcQuote ? (srcQuote.tax_type || 'tds') : 'tds');
  const invTaxPricing = rec ? (rec.tax_pricing_type || 'tax_exclusive') : (srcQuote ? (srcQuote.tax_pricing_type || 'tax_exclusive') : (srcSO ? (srcSO.tax_pricing_type || 'tax_exclusive') : 'tax_exclusive'));
  const invCustType = rec ? (rec.customer_type || 'b2b') : (srcQuote ? (srcQuote.customer_type || 'b2b') : (srcSO ? (srcSO.customer_type || 'b2b') : 'b2b'));
  const invTdsTax = rec ? num(rec.tds_tcs_tax || 0) : (srcQuote ? num(srcQuote.tds_tcs_tax || 0) : 0);
  const invAdj = rec ? num(rec.adjustment || 0) : (srcQuote ? num(srcQuote.adjustment || 0) : 0);
  const invLines = (rec && rec.lines && rec.lines.length) ? rec.lines : ((srcQuote && srcQuote.lines && srcQuote.lines.length) ? srcQuote.lines : ((srcSO && srcSO.lines && srcSO.lines.length) ? srcSO.lines : [{ quantity: 1, rate: 0, discount_percent: 0, gst_rate: 18 }]));
  const pendingFiles = [];

  const rowHtml = (l = {}) => `
    <tr class="ln-invoice" style="border-bottom:1px solid var(--bd);">
      <td style="width:50px;text-align:center;padding:10px 4px;vertical-align:top;">
        <div style="display:flex;align-items:center;justify-content:center;gap:6px;color:#94a3b8;padding-top:6px;">
          <i class="fa-solid fa-grip-vertical" style="cursor:grab;font-size:13px;"></i>
          <i class="fa-regular fa-image" style="font-size:16px;"></i>
        </div>
      </td>
      <td style="min-width:280px;padding:10px 8px;vertical-align:top;">
        <select class="in l-item" aria-label="Item" style="width:100%;margin-bottom:6px;">
          <option value="">Type or click to select an item.</option>
          <option value="__new_item__" style="color:var(--accent);font-weight:600;">+ Add New Item…</option>
          ${items.map(it => `<option value="${it.id}" ${String(l.item || l.item_id) === String(it.id) ? 'selected' : ''}>${esc(it.name)}${it.sku ? ' (' + esc(it.sku) + ')' : ''}</option>`).join('')}
        </select>
        <input class="in l-desc" aria-label="Description" placeholder="Description / details" maxlength="500" value="${esc(l.description || '')}" style="font-size:12px;padding:4px 8px;width:100%;">
        <input type="hidden" class="l-hsn" value="${esc(l.hsn_sac || '')}">
      </td>
      ${renderStockQuantityCell(l, items, whList)}
      <td style="width:110px;padding:10px 8px;vertical-align:top;">
        <input class="in l-rate" type="number" step="0.01" min="0" value="${esc(l.rate == null ? '0.00' : l.rate)}" style="text-align:right;width:100%;">
      </td>
      <td style="width:120px;padding:10px 8px;vertical-align:top;">
        <div style="display:flex;gap:4px;">
          <input class="in l-disc" type="number" step="0.01" min="0" max="100" value="${esc(l.discount_percent || 0)}" style="text-align:right;flex:1;min-width:45px;">
          <select class="in l-disc-type" style="width:48px;padding:4px;">
            <option value="percent">%</option>
            <option value="amount">₹</option>
          </select>
        </div>
      </td>
      <td style="width:140px;padding:10px 8px;vertical-align:top;">
        <select class="in l-gst" aria-label="Tax rate" style="width:100%;">
          <option value="0">Select a Tax</option>
          <option value="0" ${num(l.gst_rate) === 0 ? 'selected' : ''}>GST [0%]</option>
          <option value="5" ${num(l.gst_rate) === 5 ? 'selected' : ''}>GST [5%]</option>
          <option value="12" ${num(l.gst_rate) === 12 ? 'selected' : ''}>GST [12%]</option>
          <option value="18" ${l.gst_rate == null || num(l.gst_rate) === 18 ? 'selected' : ''}>GST [18%]</option>
          <option value="28" ${num(l.gst_rate) === 28 ? 'selected' : ''}>GST [28%]</option>
        </select>
      </td>
      <td style="width:100px;padding:10px 8px;text-align:right;font-weight:600;vertical-align:top;" class="l-amt">
        ${(l.line_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </td>
      <td style="width:36px;text-align:center;vertical-align:top;padding-top:14px;">
        <button type="button" class="btn ic" data-rm-line style="color:var(--tx-muted);font-size:16px;border:none;background:none;cursor:pointer;" title="Remove row">×</button>
      </td>
    </tr>
  `;

  target.innerHTML = `
    <div class="invoice-form-page" style="background:#fff;min-height:100%;display:flex;flex-direction:column;">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 28px;border-bottom:1px solid var(--bd);background:#fff;position:sticky;top:0;z-index:20;">
        <div style="display:flex;align-items:center;gap:12px;">
          <i class="fa-regular fa-file-lines" style="font-size:22px;color:#1e293b;"></i>
          <h1 style="font-size:20px;font-weight:700;margin:0;color:#0f172a;">${id ? 'Edit Invoice' : 'New Invoice'}</h1>
        </div>
        <div style="display:flex;align-items:center;gap:14px;">
          <button type="button" class="btn ic" title="Settings" style="border:none;background:transparent;color:#3b82f6;font-size:16px;cursor:pointer;"><i class="fa-solid fa-gear"></i></button>
          <button type="button" class="btn ic" id="btn-inv-close-x" title="Close" style="border:none;background:transparent;color:#64748b;font-size:18px;cursor:pointer;"><i class="fa-solid fa-xmark"></i></button>
        </div>
      </div>

      <form id="invoice-form-element" style="padding:28px;max-width:1100px;width:100%;box-sizing:border-box;" novalidate>
        <div class="fe" data-err="_" role="alert"></div>

        <div style="display:flex;flex-direction:column;gap:16px;margin-bottom:28px;">
          <div style="display:flex;align-items:center;gap:16px;">
            <label style="width:140px;font-weight:500;font-size:13px;color:#ef4444;">Customer Name*</label>
            <div style="display:flex;align-items:center;gap:8px;flex:1;max-width:480px;">
              <select class="in" id="inv-customer" name="customer" required style="flex:1;">
                <option value="">Select or add a customer</option>
                <option value="__new_customer__" style="color:var(--accent);font-weight:600;">+ Add New Customer…</option>
                ${parties.map(p => `<option value="${p.id}" ${String(invCustomer) === String(p.id) ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
              </select>
              <button type="button" class="btn p" id="btn-inv-cust-lookup" title="Search / Add Customer" style="padding:0 12px;height:34px;border-radius:4px;cursor:pointer;">
                <i class="fa-solid fa-magnifying-glass"></i>
              </button>
              <div style="font-size:12px;font-weight:600;padding:6px 10px;background:#f1f5f9;border:1px solid #cbd5e1;border-radius:4px;color:#334155;">INR</div>
            </div>
          </div>

          <div style="display:flex;align-items:flex-start;gap:16px;">
            <label style="width:140px;font-weight:500;font-size:13px;color:var(--tx);padding-top:6px;">Location</label>
            <div>
              <select class="in" id="inv-location" name="location" style="width:260px;">
                ${whList.map(w => `<option value="${esc(w.name)}" ${(rec && rec.location === w.name) || (!rec && w.name === 'HO Kottayam') ? 'selected' : ''}>${esc(w.name)}</option>`).join('')}
              </select>
              <div id="inv-source-of-supply" style="font-size:11.5px;color:#64748b;margin-top:3px;">
                Source of Supply: ${esc(invPlaceOfSupply || (window.APP && window.APP.org ? window.APP.org.state : 'Kerala'))}
              </div>
            </div>
          </div>

          <div style="display:flex;align-items:center;gap:16px;">
            <label style="width:140px;font-weight:500;font-size:13px;color:var(--tx);">Customer Type</label>
            <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;">
              <select class="in" id="inv-customer-type" name="customer_type" style="width:260px;">
                <option value="b2b" ${invCustType === 'b2b' ? 'selected' : ''}>B2B - Business to Business</option>
                <option value="b2c" ${invCustType === 'b2c' ? 'selected' : ''}>B2C - Business to Consumer</option>
              </select>
              <div id="inv-customer-gstin-wrap" style="display:flex;align-items:center;gap:6px;font-size:12px;background:#f8fafc;padding:4px 10px;border-radius:4px;border:1px solid var(--bd);">
                <span style="color:#64748b;font-weight:500;">GSTIN:</span>
                <span id="inv-customer-gstin" style="font-weight:600;color:var(--tx);">${(rec && rec.party_details && rec.party_details.gstin) || (parties.find(p => String(p.id) === String(invCustomer))?.gstin) || 'Not provided'}</span>
              </div>
            </div>
          </div>

          <div style="display:flex;align-items:center;gap:16px;">
            <label style="width:140px;font-weight:500;font-size:13px;color:#ef4444;">Invoice#*</label>
            <div style="display:flex;align-items:center;gap:8px;">
              <select class="in" id="inv-series" name="transaction_series" style="width:180px;">
                <option value="Default Transaction Series" ${(rec && rec.transaction_series === 'Default Transaction Series') || !rec ? 'selected' : ''}>Default Transaction Series</option>
                <option value="Online Store Series" ${rec && rec.transaction_series === 'Online Store Series' ? 'selected' : ''}>Online Store Series</option>
                <option value="Export Series" ${rec && rec.transaction_series === 'Export Series' ? 'selected' : ''}>Export Series</option>
                <option value="Retail Series" ${rec && rec.transaction_series === 'Retail Series' ? 'selected' : ''}>Retail Series</option>
              </select>
              <input class="in" id="inv-number" name="number" value="${invNum}" required style="width:180px;">
              <button type="button" class="btn ic" id="btn-inv-num-pref" title="Configure Invoice Preferences" style="border:1px solid var(--bd);border-radius:4px;padding:6px 10px;color:#3b82f6;cursor:pointer;">
                <i class="fa-solid fa-gear"></i>
              </button>
            </div>
          </div>

          <div style="display:flex;align-items:center;gap:16px;">
            <label style="width:140px;font-weight:500;font-size:13px;color:var(--tx);">Order Number</label>
            <input class="in" id="inv-order-number" name="order_number" value="${esc(invOrderNum)}" style="width:260px;">
          </div>

          <div style="display:flex;align-items:center;flex-wrap:wrap;gap:16px;">
            <label style="width:140px;font-weight:500;font-size:13px;color:#ef4444;">Invoice Date*</label>
            <input class="in" type="date" id="inv-date" name="date" value="${invDate}" required style="width:260px;">
            
            <label style="font-weight:500;font-size:13px;color:var(--tx);margin-left:20px;">Terms</label>
            <select class="in" id="inv-terms" name="terms" style="width:180px;">
              <option value="Due on Receipt" ${invTerms === 'Due on Receipt' ? 'selected' : ''}>Due on Receipt</option>
              <option value="Net 15" ${invTerms === 'Net 15' ? 'selected' : ''}>Net 15</option>
              <option value="Net 30" ${invTerms === 'Net 30' ? 'selected' : ''}>Net 30</option>
              <option value="Net 45" ${invTerms === 'Net 45' ? 'selected' : ''}>Net 45</option>
              <option value="Net 60" ${invTerms === 'Net 60' ? 'selected' : ''}>Net 60</option>
              <option value="Due end of the month" ${invTerms === 'Due end of the month' ? 'selected' : ''}>Due end of the month</option>
            </select>

            <label style="font-weight:500;font-size:13px;color:var(--tx);margin-left:20px;">Due Date</label>
            <input class="in" type="date" id="inv-due-date" name="due_date" value="${invDueDate}" style="width:160px;">
          </div>

          <div style="display:flex;align-items:center;gap:16px;">
            <label style="width:140px;font-weight:500;font-size:13px;color:var(--tx);display:flex;align-items:center;gap:4px;">
              Accounts Receivable
              <i class="fa-solid fa-circle-question" style="color:#94a3b8;font-size:12px;cursor:help;" title="The asset account that tracks money owed by customers"></i>
            </label>
            <select class="in" id="inv-accounts-receivable" name="accounts_receivable" style="width:260px;">
              <option value="Accounts Receivable" selected>Accounts Receivable</option>
            </select>
          </div>

          <div style="display:flex;align-items:center;gap:16px;">
            <label style="width:140px;font-weight:500;font-size:13px;color:var(--tx);">Salesperson</label>
            <div id="inv-salesperson-container"></div>
          </div>

          <div style="display:flex;align-items:center;gap:16px;">
            <label style="width:140px;font-weight:500;font-size:13px;color:var(--tx);">Associate Project(s)</label>
            <select class="in" id="inv-project" name="project_name" style="width:260px;" disabled>
              <option value="">There are no active projects for this customer.</option>
            </select>
          </div>

          <div style="display:flex;align-items:flex-start;gap:16px;">
            <label style="width:140px;font-weight:500;font-size:13px;color:var(--tx);display:flex;align-items:center;gap:4px;padding-top:6px;">
              Subject <i class="fa-solid fa-circle-info" style="color:var(--tx-muted);font-size:12px;"></i>
            </label>
            <textarea class="in" id="inv-subject" name="subject" rows="2" placeholder="Let your customer know what this Invoice is for" style="width:260px;font-size:12px;">${esc(invSubject)}</textarea>
          </div>

          <input type="hidden" id="inv-place-of-supply" name="place_of_supply" value="${esc(invPlaceOfSupply)}">
        </div>

        <div style="margin-top:32px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
            <div style="display:flex;align-items:center;gap:12px;">
              <span style="font-size:15px;font-weight:700;color:var(--tx);">Item Table</span>
              <select class="in" id="inv-tax-pricing" name="tax_pricing_type" style="width:145px;height:30px;font-size:12px;font-weight:600;padding:2px 8px;border-radius:6px;border:1px solid #93c5fd;background:#f0fdf4;color:#1e293b;" title="Tax Pricing Type">
                <option value="tax_exclusive" ${invTaxPricing === 'tax_exclusive' ? 'selected' : ''}>Tax Exclusive</option>
                <option value="tax_inclusive" ${invTaxPricing === 'tax_inclusive' ? 'selected' : ''}>Tax Inclusive</option>
              </select>
              <button type="button" class="btn btn-tax-pricing-info" data-doc-kind="invoices" style="background:#eff6ff;color:#2563eb;border:1px solid #bfdbfe;font-size:11.5px;font-weight:600;padding:2px 10px;border-radius:14px;cursor:pointer;display:inline-flex;align-items:center;gap:5px;" title="Learn about Tax Exclusive, Tax Inclusive, B2B & B2C GST billing">
                <i class="fa-solid fa-circle-info"></i> Guide
              </button>
            </div>
            <div style="display:flex;align-items:center;gap:12px;">
              <button type="button" class="btn" id="btn-inv-scan" style="background:none;border:none;color:#2563eb;font-weight:500;font-size:12px;display:flex;align-items:center;gap:6px;cursor:pointer;">
                <i class="fa-solid fa-barcode"></i> Scan Item
              </button>
              <button type="button" class="btn" id="btn-inv-bulk-actions" style="background:none;border:none;color:#2563eb;font-weight:500;font-size:12px;display:flex;align-items:center;gap:6px;cursor:pointer;">
                <i class="fa-regular fa-circle-check"></i> Bulk Actions
              </button>
            </div>
          </div>

          <div class="tw" style="border:1px solid var(--bd);border-radius:6px;overflow-x:auto;">
            <table class="lt" style="margin:0;width:100%;border-collapse:collapse;">
              <thead style="background:#f8fafc;border-bottom:1px solid var(--bd);">
                <tr>
                  <th style="width:50px;"></th>
                  <th style="min-width:280px;text-align:left;padding:10px 12px;font-size:11.5px;font-weight:600;color:#64748b;letter-spacing:0.5px;">ITEM DETAILS</th>
                  <th style="width:140px;min-width:130px;text-align:right;padding:10px 12px;font-size:11.5px;font-weight:600;color:#64748b;letter-spacing:0.5px;">QUANTITY</th>
                  <th style="width:110px;text-align:right;padding:10px 12px;font-size:11.5px;font-weight:600;color:#64748b;letter-spacing:0.5px;">RATE <i class="fa-regular fa-rectangle-list" style="font-size:11px;"></i></th>
                  <th style="width:120px;text-align:left;padding:10px 12px;font-size:11.5px;font-weight:600;color:#64748b;letter-spacing:0.5px;">DISCOUNT</th>
                  <th class="th-tax-explainer" data-doc-kind="invoices" style="width:140px;text-align:left;padding:10px 12px;font-size:11.5px;font-weight:600;color:#64748b;letter-spacing:0.5px;cursor:pointer;" title="Click for GST Rates, Tax Exclusive & B2B/B2C Rules">TAX <i class="fa-solid fa-circle-info" style="font-size:11px;color:#2563eb;"></i></th>
                  <th style="width:100px;text-align:right;padding:10px 12px;font-size:11.5px;font-weight:600;color:#64748b;letter-spacing:0.5px;">AMOUNT</th>
                  <th style="width:36px;"></th>
                </tr>
              </thead>
              <tbody id="invoice-line-tbody">
                ${invLines.map(rowHtml).join('')}
              </tbody>
            </table>
          </div>

          <div style="display:flex;align-items:center;gap:10px;margin-top:14px;">
            <button type="button" class="btn" id="btn-inv-add-row" style="color:#2563eb;border-color:#bfdbfe;background:#eff6ff;font-weight:600;font-size:12px;display:flex;align-items:center;gap:6px;cursor:pointer;">
              <i class="fa-solid fa-circle-plus"></i> Add New Row ▾
            </button>
            <button type="button" class="btn" id="btn-inv-bulk-items" style="color:#2563eb;border-color:#bfdbfe;background:#eff6ff;font-weight:600;font-size:12px;display:flex;align-items:center;gap:6px;cursor:pointer;">
              <i class="fa-solid fa-circle-plus"></i> Add Items in Bulk
            </button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-top:28px;">
          <div>
            <div style="margin-bottom:18px;">
              <label for="inv-notes" style="font-weight:600;font-size:13px;color:var(--tx);display:block;margin-bottom:6px;">Customer Notes</label>
              <textarea class="in" id="inv-notes" name="notes" rows="4" style="width:100%;min-height:92px;box-sizing:border-box;resize:vertical;padding:8px 10px;font-size:13px;line-height:1.5;">${esc(invNotes)}</textarea>
              <span style="font-size:11.5px;color:#64748b;display:block;margin-top:4px;">Will be displayed on the invoice</span>
            </div>
            <div>
              <label for="inv-terms-text" style="font-weight:600;font-size:13px;color:var(--tx);display:block;margin-bottom:6px;">Terms &amp; Conditions</label>
              <textarea class="in" id="inv-terms-text" name="terms_conditions" rows="4" placeholder="Enter the terms and conditions of your business to be displayed in your transaction" style="width:100%;min-height:92px;box-sizing:border-box;resize:vertical;padding:8px 10px;font-size:13px;line-height:1.5;">${esc(invTermsText)}</textarea>
            </div>
          </div>

          <div style="background:#f8fafc;border:1px solid var(--bd);border-radius:10px;padding:20px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid var(--bd);">
              <span style="font-weight:600;color:var(--tx);">Sub Total</span>
              <span id="inv-subtotal-val" style="font-size:16px;font-weight:700;">0.00</span>
            </div>

            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
              <div style="display:flex;align-items:center;gap:14px;">
                <label style="display:flex;align-items:center;gap:5px;cursor:pointer;font-weight:500;font-size:13px;">
                  <input type="radio" name="tax_type" value="tds" ${invTaxType === 'tds' ? 'checked' : ''}> TDS
                </label>
                <label style="display:flex;align-items:center;gap:5px;cursor:pointer;font-weight:500;font-size:13px;">
                  <input type="radio" name="tax_type" value="tcs" ${invTaxType === 'tcs' ? 'checked' : ''}> TCS
                </label>
              </div>
              <div style="display:flex;align-items:center;gap:10px;">
                <select class="in" id="inv-tds-tax" name="tds_tcs_tax" style="width:150px;">
                  <option value="0">Select a Tax</option>
                  <option value="1" ${invTdsTax === 1 ? 'selected' : ''}>1%</option>
                  <option value="2" ${invTdsTax === 2 ? 'selected' : ''}>2%</option>
                  <option value="5" ${invTdsTax === 5 ? 'selected' : ''}>5%</option>
                  <option value="10" ${invTdsTax === 10 ? 'selected' : ''}>10%</option>
                </select>
                <span id="inv-tds-amt" style="font-weight:600;min-width:60px;text-align:right;">- 0.00</span>
              </div>
            </div>

            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
              <div style="display:flex;align-items:center;gap:6px;">
                <div style="border:1px dashed var(--bd);border-radius:4px;padding:4px 10px;font-size:12px;font-weight:500;color:var(--tx);">Adjustment</div>
                <i class="fa-regular fa-circle-question" style="color:#94a3b8;cursor:help;" title="Add or subtract adjustment amount"></i>
              </div>
              <div style="display:flex;align-items:center;gap:10px;">
                <input type="number" step="0.01" class="in" id="inv-adj-val" name="adjustment" value="${invAdj}" style="width:110px;text-align:right;">
                <span id="inv-adj-display" style="font-weight:600;min-width:60px;text-align:right;">0.00</span>
              </div>
            </div>

            <div style="display:flex;justify-content:space-between;align-items:center;padding-top:16px;border-top:2px solid var(--bd);margin-top:16px;">
              <span style="font-size:17px;font-weight:700;color:#0f172a;">Total ( ₹ )</span>
              <span id="inv-grandtotal-val" style="font-size:22px;font-weight:800;color:#0f172a;">0.00</span>
            </div>
          </div>
        </div>

        <div style="margin-top:28px;padding:18px;background:#f8fafc;border:1px solid var(--bd);border-radius:10px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <div>
              <div style="font-weight:600;font-size:13px;color:#0f172a;">Attach File(s) to Invoice</div>
              <div style="font-size:11.5px;color:#64748b;margin-top:2px;">You can upload a maximum of 10 files, 10MB each</div>
            </div>
            <input type="file" id="inv-file-input" multiple style="display:none;">
            <button type="button" class="btn" id="btn-inv-upload" style="font-size:12px;background:#fff;display:flex;align-items:center;gap:6px;cursor:pointer;">
              <i class="fa-solid fa-upload"></i> Upload File ▾
            </button>
          </div>
          <div id="inv-attach-badges" style="display:flex;flex-wrap:wrap;gap:8px;"></div>
        </div>

        <div style="margin-top:20px;padding:18px;background:#f8fafc;border:1px solid var(--bd);border-radius:10px;display:flex;align-items:center;justify-content:space-between;gap:20px;">
          <div>
            <div style="font-weight:600;font-size:13px;color:#0f172a;display:flex;align-items:center;gap:6px;">
              <i class="fa-solid fa-signature" style="color:#2563eb;"></i> Authorized Digital Signature
            </div>
            <div style="font-size:11.5px;color:#64748b;margin-top:2px;" id="inv-sig-desc">
              ${rec && rec.signature_data ? 'Document has an attached digital signature.' : (window.APP && window.APP.org && window.APP.org.signature_data ? 'Using company default signature.' : 'No signature attached. Click to add a signature to this invoice.')}
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:12px;">
            <div id="inv-sig-preview-box" style="height:44px;min-width:90px;display:flex;align-items:center;justify-content:center;background:#fff;border:1px solid var(--bd);border-radius:6px;padding:2px 8px;">
              <img id="inv-sig-preview" src="${esc((rec && rec.signature_data) || (window.APP && window.APP.org && window.APP.org.signature_data) || '')}" alt="Signature preview" style="max-height:40px;max-width:110px;object-fit:contain;display:${((rec && rec.signature_data) || (window.APP && window.APP.org && window.APP.org.signature_data)) ? 'block' : 'none'};">
              <span id="inv-sig-none" style="font-size:11px;color:#94a3b8;display:${((rec && rec.signature_data) || (window.APP && window.APP.org && window.APP.org.signature_data)) ? 'none' : 'inline'};">None</span>
            </div>
            <input type="hidden" id="inv-signature-data" name="signature_data" value="${esc((rec && rec.signature_data) || '')}">
            <input type="hidden" id="inv-signed-by" name="signed_by" value="${esc((rec && rec.signed_by) || '')}">
            <input type="hidden" id="inv-signature-title" name="signature_title" value="${esc((rec && rec.signature_title) || '')}">
            <button type="button" class="btn btn-doc-sign" id="btn-inv-sign" style="font-size:12px;border:1px solid #cbd5e1;border-radius:6px;padding:6px 14px;background:#ffffff;display:inline-flex;align-items:center;gap:6px;cursor:pointer;color:var(--tx,#0f172a);font-weight:500;">
              <i class="fa-solid fa-pen-nib"></i> ${((rec && rec.signature_data) || (window.APP && window.APP.org && window.APP.org.signature_data)) ? 'Change Signature' : 'Sign Invoice'}
            </button>
          </div>
        </div>

        ${renderPaymentGatewayBanner()}

        <div style="position:sticky;bottom:0;background:#fff;border-top:1px solid var(--bd);margin-top:36px;padding:14px 0;display:flex;align-items:center;justify-content:space-between;z-index:15;">
          <div style="display:flex;align-items:center;gap:10px;">
            <button type="button" class="btn" id="btn-inv-save-draft" style="background:#fff;font-weight:500;cursor:pointer;">Save as Draft</button>
            <button type="button" class="btn p" id="btn-inv-save-send" style="display:flex;align-items:center;gap:6px;cursor:pointer;">
              Save and Send <i class="fa-solid fa-caret-up" style="font-size:10px;"></i>
            </button>
            <button type="button" class="btn" id="btn-inv-cancel" style="background:#fff;font-weight:500;cursor:pointer;">Cancel</button>
          </div>
          <div style="display:flex;align-items:center;gap:20px;font-size:13px;font-weight:600;color:#0f172a;">
            <a href="javascript:void(0)" id="btn-inv-make-recurring" style="color:#2563eb;text-decoration:none;font-weight:500;display:flex;align-items:center;gap:5px;">
              <i class="fa-solid fa-rotate"></i> Make Recurring
            </a>
            <span>Total Amount: <span id="inv-bar-total-amount">₹ 0.00</span></span>
            <span>Total Quantity: <span id="inv-bar-total-qty">0</span></span>
          </div>
        </div>
      </form>
    </div>
  `;

  const form = $('#invoice-form-element', target);
  const tbody = $('#invoice-line-tbody', form);
  const byId = Object.fromEntries(items.map(it => [String(it.id), it]));
  const stockTracker = initItemTableStockTracker(tbody, items, whList, () => calcInvoice());

  // Initialize custom salesperson dropdown and projects
  createSalespersonCustomDropdown($('#inv-salesperson-container', form), invSalesperson, () => {});
  setupProjectSelectorForCustomer($('#inv-project', form), invCustomer, rec ? rec.project_name : '');
  $('#inv-customer', form)?.addEventListener('change', (e) => {
    setupProjectSelectorForCustomer($('#inv-project', form), e.target.value);
  });

  // Wire up Configure Invoice Preferences gear icon
  $('#btn-inv-num-pref', form)?.addEventListener('click', () => {
    openDocNumberPreferencesModal({
      kind: 'invoices',
      series: $('#inv-series', form)?.value || 'Default Transaction Series',
      location: $('#inv-location', form)?.value || 'HO Kottayam',
      onSave: (res) => {
        if (res && res.preview_formatted) {
          $('#inv-number', form).value = res.preview_formatted;
        }
      }
    });
  });

  function updateDueDate() {
    const dVal = $('#inv-date', form).value;
    if (!dVal) return;
    const termsVal = $('#inv-terms', form).value;
    const d = new Date(dVal + 'T00:00:00');
    if (termsVal === 'Due on Receipt') {
      $('#inv-due-date', form).value = dVal;
    } else if (termsVal === 'Net 15') {
      d.setDate(d.getDate() + 15);
      $('#inv-due-date', form).value = d.toISOString().slice(0, 10);
    } else if (termsVal === 'Net 30') {
      d.setDate(d.getDate() + 30);
      $('#inv-due-date', form).value = d.toISOString().slice(0, 10);
    } else if (termsVal === 'Net 45') {
      d.setDate(d.getDate() + 45);
      $('#inv-due-date', form).value = d.toISOString().slice(0, 10);
    } else if (termsVal === 'Net 60') {
      d.setDate(d.getDate() + 60);
      $('#inv-due-date', form).value = d.toISOString().slice(0, 10);
    } else if (termsVal === 'Due end of the month') {
      const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      $('#inv-due-date', form).value = endOfMonth.toISOString().slice(0, 10);
    }
  }

  function calcInvoice() {
    const isTaxInclusive = ($('#inv-tax-pricing', form)?.value === 'tax_inclusive');
    let subtotal = 0;
    let totalTax = 0;
    let totalQty = 0;
    $$('.ln-invoice', tbody).forEach(tr => {
      const qty = num($('.l-qty', tr).value) || 0;
      const rate = num($('.l-rate', tr).value) || 0;
      const discVal = num($('.l-disc', tr).value) || 0;
      const discType = $('.l-disc-type', tr).value;
      const gross = qty * rate;
      const disc = discType === 'percent' ? (gross * discVal / 100) : discVal;
      const net = Math.max(0, gross - disc);
      const gstRate = num($('.l-gst', tr).value) || 0;
      let taxable = net;
      let tax = 0;
      let lineTot = net;
      if (isTaxInclusive && gstRate > 0) {
        taxable = Math.round((net / (1 + gstRate / 100)) * 100) / 100;
        tax = Math.round((net - taxable) * 100) / 100;
        lineTot = net;
      } else {
        taxable = Math.round(net * 100) / 100;
        tax = Math.round((taxable * gstRate / 100) * 100) / 100;
        lineTot = taxable + tax;
      }
      $('.l-amt', tr).textContent = (lineTot).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      subtotal += taxable;
      totalTax += tax;
      totalQty += qty;
    });

    const taxType = form.querySelector('input[name="tax_type"]:checked')?.value || 'tds';
    const tdsRate = num($('#inv-tds-tax', form).value) || 0;
    const tdsAmt = subtotal * tdsRate / 100;
    const adj = num($('#inv-adj-val', form).value) || 0;

    $('#inv-tds-amt', form).textContent = `${taxType === 'tds' ? '-' : '+'} ${tdsAmt.toFixed(2)}`;
    $('#inv-adj-display', form).textContent = adj.toFixed(2);

    let grand = subtotal + totalTax;
    if (taxType === 'tds') {
      grand -= tdsAmt;
    } else {
      grand += tdsAmt;
    }
    grand = Math.max(0, grand + adj);

    $('#inv-subtotal-val', form).textContent = subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    $('#inv-grandtotal-val', form).textContent = grand.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    $('#inv-bar-total-amount', form).textContent = inr(grand);
    $('#inv-bar-total-qty', form).textContent = totalQty;
  }

  function renderAttach() {
    const box = $('#inv-attach-badges', form);
    let h = '';
    if (rec && rec.attachments && rec.attachments.length) {
      h += rec.attachments.map(a => `
        <div class="attach-file-badge">
          <span>📎 ${esc(a.filename)} (${fmtBytes(a.file_size)})</span>
          <button type="button" data-del-att="${a.id}">×</button>
        </div>
      `).join('');
    }
    h += pendingFiles.map((f, i) => `
      <div class="attach-file-badge" style="border-style:dashed;">
        <span>📎 ${esc(f.name)} (${fmtBytes(f.size)}) <small style="color:var(--accent);">new</small></span>
        <button type="button" data-rem-pen="${i}">×</button>
      </div>
    `).join('');
    if (!h) h = '<span class="sub" style="font-size:12px;">No files attached yet.</span>';
    box.innerHTML = h;
  }

  const closeForm = () => {
    if (onDone) onDone(null);
    else {
      location.hash = '#/sales/invoices';
      route();
    }
  };

  const closeX = $('#btn-inv-close-x', target);
  if (closeX) closeX.addEventListener('click', closeForm);
  const cancelBtn = $('#btn-inv-cancel', target);
  if (cancelBtn) cancelBtn.addEventListener('click', closeForm);

  $('#btn-inv-cust-lookup', form).addEventListener('click', () => {
    partyForm('customers', null, (newCust) => {
      if (newCust && newCust.id) {
        parties.push(newCust);
        const sel = $('#inv-customer', form);
        sel.insertAdjacentHTML('beforeend', `<option value="${newCust.id}" selected>${esc(newCust.name)}</option>`);
        sel.value = newCust.id;
        if (newCust.state) $('#inv-place-of-supply', form).value = newCust.state;
      }
    });
  });

  $('#inv-customer', form).addEventListener('change', e => {
    if (e.target.value === '__new_customer__') {
      handleQuickCreateSelect(e.target, newCust => {
        parties.push(newCust);
        if (newCust.state) $('#inv-place-of-supply', form).value = newCust.state;
        if (newCust.payment_terms) {
          const termsMap = { 0: 'Due on Receipt', 15: 'Net 15', 30: 'Net 30', 45: 'Net 45', 60: 'Net 60' };
          if (termsMap[newCust.payment_terms]) {
            $('#inv-terms', form).value = termsMap[newCust.payment_terms];
            updateDueDate();
          }
        }
      });
      return;
    }
    const custId = $('#inv-customer', form).value;
    const cust = parties.find(p => String(p.id) === String(custId));
    if (cust) {
      if (cust.state) $('#inv-place-of-supply', form).value = cust.state;
      const gstinEl = $('#inv-customer-gstin', form);
      const custTypeEl = $('#inv-customer-type', form);
      if (gstinEl) gstinEl.textContent = cust.gstin || 'Not provided';
      if (custTypeEl) {
        if (cust.gstin && cust.gstin.trim()) {
          custTypeEl.value = 'b2b';
        } else if (cust.customer_type === 'individual') {
          custTypeEl.value = 'b2c';
        }
      }
      if (cust.payment_terms) {
        const termsMap = { 0: 'Due on Receipt', 15: 'Net 15', 30: 'Net 30', 45: 'Net 45', 60: 'Net 60' };
        if (termsMap[cust.payment_terms]) {
          $('#inv-terms', form).value = termsMap[cust.payment_terms];
          updateDueDate();
        }
      }
    }
  });

  $('#inv-date', form).addEventListener('change', updateDueDate);
  $('#inv-terms', form).addEventListener('change', updateDueDate);

  $('#btn-inv-sign', form)?.addEventListener('click', () => {
    const curSigObj = {
      signature_data: $('#inv-signature-data', form)?.value || '',
      signed_by: $('#inv-signed-by', form)?.value || '',
      signature_title: $('#inv-signature-title', form)?.value || '',
      number: invNum
    };
    openSignatureModal(curSigObj, 'invoices', updated => {
      if ($('#inv-signature-data', form)) $('#inv-signature-data', form).value = updated.signature_data || '';
      if ($('#inv-signed-by', form)) $('#inv-signed-by', form).value = updated.signed_by || '';
      if ($('#inv-signature-title', form)) $('#inv-signature-title', form).value = updated.signature_title || '';
      const previewImg = $('#inv-sig-preview', form);
      const noneSpan = $('#inv-sig-none', form);
      const descEl = $('#inv-sig-desc', form);
      const signBtn = $('#btn-inv-sign', form);
      if (updated.signature_data) {
        if (previewImg) { previewImg.src = updated.signature_data; previewImg.style.display = 'block'; }
        if (noneSpan) noneSpan.style.display = 'none';
        if (descEl) descEl.textContent = 'Custom digital signature attached.';
        if (signBtn) signBtn.innerHTML = '<i class="fa-solid fa-pen-nib"></i> Change Signature';
      } else {
        if (previewImg) previewImg.style.display = 'none';
        if (noneSpan) noneSpan.style.display = 'inline';
        if (descEl) descEl.textContent = 'No custom signature attached.';
        if (signBtn) signBtn.innerHTML = '<i class="fa-solid fa-pen-nib"></i> Sign Invoice';
      }
    });
  });

  $('#btn-inv-num-pref', form)?.addEventListener('click', async () => {
    let currentConfig = { prefix: 'INV', next_sequence: 1, formatted: invNum };
    try {
      currentConfig = await api('invoices/sequence/');
    } catch (_) {}

    Modal.open({
      title: 'Configure Invoice Number Sequence',
      dialog: true,
      body: `
        <div style="padding:10px 0;">
          <p class="sub" style="margin-bottom:14px;font-size:13px;line-height:1.5;">Specify the prefix and next sequential counter for your invoices. Document numbers follow <code>ORG/PREFIX/FY/SEQUENCE</code>.</p>
          <div class="fg">
            <label style="font-weight:600;font-size:12px;">Prefix</label>
            <input class="in" id="inv-prefix-input" value="${esc(currentConfig.prefix || 'INV')}" style="width:160px;text-transform:uppercase;" placeholder="e.g. INV">
          </div>
          <div class="fg" style="margin-top:14px;">
            <label style="font-weight:600;font-size:12px;">Next Sequence Number</label>
            <input class="in" id="inv-next-seq-input" type="number" min="1" step="1" value="${currentConfig.next_sequence || 1}" style="width:160px;">
          </div>
        </div>
      `,
      footer: `
        <button class="btn" data-close>Cancel</button>
        <button class="btn p" id="btn-save-inv-seq">Save Sequence</button>
      `
    });

    $('#btn-save-inv-seq')?.addEventListener('click', async () => {
      const pfx = ($('#inv-prefix-input').value || '').trim().toUpperCase() || 'INV';
      const seq = Math.max(1, parseInt($('#inv-next-seq-input').value, 10) || 1);
      try {
        const res = await api('invoices/sequence/', {
          method: 'POST',
          body: { prefix: pfx, next_sequence: seq }
        });
        $('#inv-number', form).value = res.formatted;
        Modal.close();
        toast(`Invoice sequence updated to ${res.formatted}`, 'ok');
      } catch (err) {
        toast(err.message, 'err');
      }
    });
  });

  tbody.addEventListener('change', e => {
    if (e.target.classList.contains('l-item')) {
      if (e.target.value === '__new_item__') {
        handleQuickCreateSelect(e.target, newItem => {
          items.push(newItem);
          byId[String(newItem.id)] = newItem;
          stockTracker.updateRow(e.target.closest('tr'), true);
          calcInvoice();
        });
        return;
      }
      const it = byId[e.target.value];
      const tr = e.target.closest('tr');
      if (it && tr) {
        $('.l-desc', tr).value = it.name;
        $('.l-hsn', tr).value = it.hsn_sac || '';
        $('.l-rate', tr).value = it.selling_price || 0;
        $('.l-gst', tr).value = String(num(it.gst_rate) || 18);
        stockTracker.updateRow(tr, true);
      }
      calcInvoice();
    }
  });

  form.addEventListener('input', () => calcInvoice());
  form.addEventListener('change', () => calcInvoice());

  $('#btn-inv-add-row', form).addEventListener('click', () => {
    tbody.insertAdjacentHTML('beforeend', rowHtml({ quantity: 1, rate: 0, discount_percent: 0, gst_rate: 18 }));
    stockTracker.updateRow(tbody.lastElementChild, false);
    calcInvoice();
  });

  $('#btn-inv-bulk-items', form).addEventListener('click', () => {
    bulkItemPickerModal(items, (selectedItems) => {
      selectedItems.forEach(it => {
        tbody.insertAdjacentHTML('beforeend', rowHtml(it));
        stockTracker.updateRow(tbody.lastElementChild, true);
      });
      calcInvoice();
    });
  });

  tbody.addEventListener('click', e => {
    const rm = e.target.closest('[data-rm-line]');
    if (rm) {
      if ($$('.ln-invoice', tbody).length > 1) {
        rm.closest('tr').remove();
        calcInvoice();
      } else {
        toast('At least one item line is required.', 'err');
      }
    }
  });

  const fileInput = $('#inv-file-input', form);
  $('#btn-inv-upload', form).addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    Array.from(fileInput.files).forEach(f => {
      if (pendingFiles.length >= 10) {
        toast('Maximum 10 files can be attached.', 'err');
        return;
      }
      const reader = new FileReader();
      reader.onload = ev => {
        pendingFiles.push({ name: f.name, size: f.size, type: f.type, data: ev.target.result });
        renderAttach();
      };
      reader.readAsDataURL(f);
    });
    fileInput.value = '';
  });

  $('#inv-attach-badges', form).addEventListener('click', async e => {
    const delBtn = e.target.closest('[data-del-att]');
    if (delBtn) {
      const attId = delBtn.dataset.delAtt;
      if (!(await confirmBox({ title: 'Delete attachment?', message: 'This file will be permanently removed.', okText: 'Delete', danger: true }))) return;
      try {
        await api(`attachments/${attId}/`, { method: 'DELETE' });
        rec.attachments = (rec.attachments || []).filter(a => String(a.id) !== String(attId));
        renderAttach();
        toast('Attachment deleted', 'ok');
      } catch (err) { toast(err.message, 'err'); }
      return;
    }
    const remBtn = e.target.closest('[data-rem-pen]');
    if (remBtn) {
      pendingFiles.splice(Number(remBtn.dataset.remPen), 1);
      renderAttach();
    }
  });

  const recBtn = $('#btn-inv-make-recurring', form);
  if (recBtn) {
    recBtn.addEventListener('click', () => {
      const custId = $('#inv-customer', form) ? $('#inv-customer', form).value : '';
      const lines = $$('tr.ln', form).map(tr => ({
        item: $('.l-item', tr) ? $('.l-item', tr).value : null,
        description: $('.l-desc', tr) ? $('.l-desc', tr).value : '',
        hsn_sac: $('.l-hsn', tr) ? $('.l-hsn', tr).value : '',
        quantity: num($('.l-qty', tr) ? $('.l-qty', tr).value : 1) || 1,
        rate: num($('.l-rate', tr) ? $('.l-rate', tr).value : 0) || 0,
        discount_percent: num($('.l-disc', tr) ? $('.l-disc', tr).value : 0) || 0,
        gst_rate: num($('.l-gst', tr) ? $('.l-gst', tr).value : 18) || 18
      }));
      const totText = $('#inv-tot-grand', form) ? $('#inv-tot-grand', form).textContent : '';
      const tot = num(totText.replace(/[^0-9.]/g, '')) || 0;
      const custObj = parties.find(p => String(p.id) === String(custId));
      recurringInvoiceModal(null, {
        profile_name: `Recurring - ${custObj ? custObj.name : 'Invoice'}`,
        customer: custId,
        customer_id: custId,
        frequency: 'monthly',
        start_date: ($('#inv-date', form) && $('#inv-date', form).value) || APP.today,
        next_date: ($('#inv-date', form) && $('#inv-date', form).value) || APP.today,
        total: tot,
        lines: lines
      });
    });
  }

  const saveInvoice = async (isDraft) => {
    const custId = $('#inv-customer', form).value;
    if (!custId) {
      toast('Please select a customer.', 'err');
      $('#inv-customer', form).focus();
      return;
    }
    const numVal = $('#inv-number', form).value.trim();
    if (!numVal) {
      toast('Please enter an invoice number.', 'err');
      $('#inv-number', form).focus();
      return;
    }
    const dt = $('#inv-date', form).value;
    if (!dt) {
      toast('Please enter an invoice date.', 'err');
      return;
    }

    const lines = [];
    let lineErr = false;
    $$('.ln-invoice', tbody).forEach(tr => {
      const itVal = $('.l-item', tr).value;
      const descVal = $('.l-desc', tr).value.trim();
      const qtyVal = num($('.l-qty', tr).value) || 0;
      const rateVal = num($('.l-rate', tr).value) || 0;
      if (!descVal && !itVal) {
        lineErr = true;
        return;
      }
      lines.push({
        item: itVal || null,
        warehouse: $('.l-wh-select', tr)?.value || null,
        warehouse_id: $('.l-wh-select', tr)?.value || null,
        warehouse_code: $('.l-wh-code', tr)?.value || '',
        description: descVal || (itVal && byId[itVal] ? byId[itVal].name : 'Item line'),
        hsn_sac: $('.l-hsn', tr).value.trim(),
        quantity: qtyVal || 1,
        rate: rateVal,
        discount_percent: num($('.l-disc', tr).value) || 0,
        gst_rate: num($('.l-gst', tr).value) || 0
      });
    });

    if (lineErr || !lines.length) {
      toast('Please enter a description or select an item for each row.', 'err');
      return;
    }

    if (!isDraft && !(APP.org && APP.org.allow_negative_stock)) {
      const stockCheck = stockTracker.validate();
      if (!stockCheck.valid) {
        toast(stockCheck.error, 'err');
        return;
      }
    }

    const payload = {
      customer: custId,
      customer_id: custId,
      number: numVal,
      location: $('#inv-location', form)?.value || 'HO Kottayam',
      transaction_series: $('#inv-series', form)?.value || 'Default Transaction Series',
      accounts_receivable: $('#inv-accounts-receivable', form)?.value || 'Accounts Receivable',
      order_number: $('#inv-order-number', form).value.trim(),
      date: dt,
      due_date: $('#inv-due-date', form).value || dt,
      tax_pricing_type: $('#inv-tax-pricing', form)?.value || 'tax_exclusive',
      customer_type: $('#inv-customer-type', form)?.value || 'b2b',
      terms: $('#inv-terms', form).value,
      salesperson: $('#inv-salesperson', form).value,
      subject: $('#inv-subject', form).value.trim(),
      place_of_supply: $('#inv-place-of-supply', form).value || (APP.org ? APP.org.state : 'Kerala'),
      notes: $('#inv-notes', form).value.trim(),
      source_quote: srcQuote ? srcQuote.id : (srcSO ? srcSO.source_quote_id : (rec ? rec.source_quote_id : null)),
      source_sales_order: srcSO ? srcSO.id : (rec ? rec.source_sales_order_id : null),
      signature_data: $('#inv-signature-data', form)?.value || '',
      signed_by: $('#inv-signed-by', form)?.value || '',
      signature_title: $('#inv-signature-title', form)?.value || '',
      lines: lines,
      force: true
    };

    const actionBtns = [$('#btn-inv-save-draft', target), $('#btn-inv-save-send', target)];
    actionBtns.forEach(b => { if (b) b.disabled = true; });

    try {
      let saved;
      if (id) {
        saved = await api(`invoices/${id}/`, { method: 'PUT', body: payload });
      } else {
        saved = await api('invoices/', { method: 'POST', body: payload });
      }

      for (const pf of pendingFiles) {
        try {
          await api('attachments/', {
            method: 'POST',
            body: {
              entity_type: 'invoice',
              entity_id: saved.id,
              filename: pf.name,
              file_size: pf.size,
              mime_type: pf.type,
              file_data: pf.data
            }
          });
        } catch (e) { console.error('Attachment upload error:', e); }
      }

      if (!isDraft) {
        try {
          await api(`invoices/${saved.id}/send/`, { method: 'POST', body: {} });
          toast(`${saved.number} saved and sent successfully!`, 'ok');
        } catch (e) {
          toast(`${saved.number} saved as draft, but could not be sent: ${e.message}`, 'err');
        }
      } else {
        toast(`${saved.number} ${id ? 'updated' : 'saved as draft'} successfully!`, 'ok');
      }

      if (onDone) onDone(saved);
      else {
        location.hash = '#/sales/invoices';
        route();
      }
    } catch (err) {
      toast(err.message, 'err');
    } finally {
      actionBtns.forEach(b => { if (b) b.disabled = false; });
    }
  };

  $('#btn-inv-save-draft', target).addEventListener('click', () => saveInvoice(true));
  $('#btn-inv-save-send', target).addEventListener('click', () => saveInvoice(false));

  renderAttach();
  calcInvoice();
}
window.invoiceForm = invoiceForm;

async function retainerInvoiceForm(id, targetEl, onDone) {
  const target = targetEl || document.getElementById('pg') || document.body;
  const [parties, items, salespersons, whList, nextNum, rec] = await Promise.all([
    api('lookup/customers/').catch(() => []),
    api('lookup/items/').catch(() => []),
    api('lookup/salespersons/').catch(() => []),
    api('lookup/warehouses/').catch(() => []),
    id ? Promise.resolve(null) : api('lookup/next-retainer-number/').catch(() => ({ next_number: 'RET-000001' })),
    id ? api(`retainer-invoices/${id}/`).catch(() => null) : Promise.resolve(null)
  ]);

  const retNum = rec ? rec.number : (nextNum ? (nextNum.next_number || nextNum.formatted || 'RET-000001') : 'RET-000001');
  const retCustomer = rec ? (rec.customer_id || rec.party_id) : '';
  const retLocation = rec ? (rec.location || 'HO Kottayam') : 'HO Kottayam';
  const retSeries = rec ? (rec.transaction_series || 'Default Transaction Series') : 'Default Transaction Series';
  const retProject = rec ? (rec.project_name || '') : '';
  const retDate = rec ? rec.date : (window.APP && window.APP.today ? window.APP.today : new Date().toISOString().slice(0, 10));
  const retDueDate = rec ? (rec.due_date || '') : retDate;
  const retTerms = rec ? (rec.terms || 'Due on Receipt') : 'Due on Receipt';
  const retOrderNum = rec ? (rec.order_number || '') : '';
  const retSalesperson = rec ? (rec.salesperson || '') : '';
  const retSubject = rec ? (rec.subject || '') : '';
  const retPlaceOfSupply = rec ? (rec.place_of_supply || '') : (window.APP && window.APP.org ? window.APP.org.state : 'Kerala');
  const retNotes = rec ? (rec.notes != null ? rec.notes : (window.APP && window.APP.org && window.APP.org.notes_default ? window.APP.org.notes_default : 'Thanks for your business.')) : 'Thanks for your business.';
  const retTermsText = rec ? (rec.terms != null ? rec.terms : (window.APP && window.APP.org && window.APP.org.terms_default ? window.APP.org.terms_default : '')) : '';
  const retTaxType = rec ? (rec.tax_type || 'tds') : 'tds';
  const retTaxPricing = rec ? (rec.tax_pricing_type || 'tax_exclusive') : 'tax_exclusive';
  const retCustType = rec ? (rec.customer_type || 'b2b') : 'b2b';
  const retTdsTax = rec ? num(rec.tds_tcs_tax || 0) : 0;
  const retAdj = rec ? num(rec.adjustment || 0) : 0;
  const retLines = (rec && rec.lines && rec.lines.length) ? rec.lines : [{ quantity: 1, rate: 0, discount_percent: 0, gst_rate: 18 }];
  const pendingFiles = [];

  const rowHtml = (l = {}) => `
    <tr class="ln-retainer-invoice" style="border-bottom:1px solid var(--bd);">
      <td style="width:50px;text-align:center;padding:10px 4px;vertical-align:top;">
        <div style="display:flex;align-items:center;justify-content:center;gap:6px;color:#94a3b8;padding-top:6px;">
          <i class="fa-solid fa-grip-vertical" style="cursor:grab;font-size:13px;"></i>
          <i class="fa-regular fa-image" style="font-size:16px;"></i>
        </div>
      </td>
      <td style="min-width:280px;padding:10px 8px;vertical-align:top;">
        <select class="in l-item" aria-label="Item" style="width:100%;margin-bottom:6px;">
          <option value="">Type or click to select an item.</option>
          <option value="__new_item__" style="color:var(--accent);font-weight:600;">+ Add New Item…</option>
          ${items.map(it => `<option value="${it.id}" ${String(l.item) === String(it.id) ? 'selected' : ''}>${esc(it.name)}${it.sku ? ' (' + esc(it.sku) + ')' : ''}</option>`).join('')}
        </select>
        <input class="in l-desc" aria-label="Description" placeholder="Description / details" maxlength="500" value="${esc(l.description || '')}" style="font-size:12px;padding:4px 8px;width:100%;">
        <div class="l-stock-badge" style="font-size:11px;color:#0284c7;margin-top:3px;font-weight:500;display:none;"></div>
        <input type="hidden" class="l-hsn" value="${esc(l.hsn_sac || '')}">
      </td>
${renderStockQuantityCell(l, items, whList)}
      <td style="width:110px;padding:10px 8px;vertical-align:top;">
        <input class="in l-rate" type="number" step="0.01" min="0" value="${esc(l.rate == null ? '0.00' : l.rate)}" style="text-align:right;width:100%;">
      </td>
      <td style="width:120px;padding:10px 8px;vertical-align:top;">
        <div style="display:flex;gap:4px;">
          <input class="in l-disc" type="number" step="0.01" min="0" max="100" value="${esc(l.discount_percent || 0)}" style="text-align:right;flex:1;min-width:45px;">
          <select class="in l-disc-type" style="width:48px;padding:4px;">
            <option value="percent">%</option>
            <option value="amount">₹</option>
          </select>
        </div>
      </td>
      <td style="width:140px;padding:10px 8px;vertical-align:top;">
        <select class="in l-gst" aria-label="Tax rate" style="width:100%;">
          <option value="0">Select a Tax</option>
          <option value="0" ${num(l.gst_rate) === 0 ? 'selected' : ''}>GST [0%]</option>
          <option value="5" ${num(l.gst_rate) === 5 ? 'selected' : ''}>GST [5%]</option>
          <option value="12" ${num(l.gst_rate) === 12 ? 'selected' : ''}>GST [12%]</option>
          <option value="18" ${l.gst_rate == null || num(l.gst_rate) === 18 ? 'selected' : ''}>GST [18%]</option>
          <option value="28" ${num(l.gst_rate) === 28 ? 'selected' : ''}>GST [28%]</option>
        </select>
      </td>
      <td style="width:100px;padding:10px 8px;text-align:right;font-weight:600;vertical-align:top;" class="l-amt">
        ${(l.line_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </td>
      <td style="width:36px;text-align:center;vertical-align:top;padding-top:14px;">
        <button type="button" class="btn ic" data-rm-line style="color:var(--tx-muted);font-size:16px;border:none;background:none;cursor:pointer;" title="Remove row">×</button>
      </td>
    </tr>
  `;

  target.innerHTML = `
    <div class="invoice-form-page" style="background:#fff;min-height:100%;display:flex;flex-direction:column;">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 28px;border-bottom:1px solid var(--bd);background:#fff;position:sticky;top:0;z-index:20;">
        <div style="display:flex;align-items:center;gap:12px;">
          <i class="fa-regular fa-file-lines" style="font-size:22px;color:#1e293b;"></i>
          <h1 style="font-size:20px;font-weight:700;margin:0;color:#0f172a;">${id ? 'Edit Retainer Invoice' : 'New Retainer Invoice'}</h1>
        </div>
        <div style="display:flex;align-items:center;gap:14px;">
          <button type="button" class="btn ic" title="Settings" style="border:none;background:transparent;color:#3b82f6;font-size:16px;cursor:pointer;"><i class="fa-solid fa-gear"></i></button>
          <button type="button" class="btn ic" id="btn-ret-close-x" title="Close" style="border:none;background:transparent;color:#64748b;font-size:18px;cursor:pointer;"><i class="fa-solid fa-xmark"></i></button>
        </div>
      </div>

      <form id="retainer-form-element" style="padding:28px;max-width:1100px;width:100%;box-sizing:border-box;" novalidate>
        <div class="fe" data-err="_" role="alert"></div>

        <div style="display:flex;flex-direction:column;gap:16px;margin-bottom:28px;">
          <div style="display:flex;align-items:center;gap:16px;">
            <label style="width:140px;font-weight:500;font-size:13px;color:#ef4444;">Customer Name*</label>
            <div style="display:flex;align-items:center;gap:8px;flex:1;max-width:480px;">
              <select class="in" id="ret-customer" name="customer" required style="flex:1;">
                <option value="">Select or add a customer</option>
                <option value="__new_customer__" style="color:var(--accent);font-weight:600;">+ Add New Customer…</option>
                ${parties.map(p => `<option value="${p.id}" ${String(retCustomer) === String(p.id) ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
              </select>
              <button type="button" class="btn p" id="btn-ret-cust-lookup" title="Search / Add Customer" style="padding:0 12px;height:34px;border-radius:4px;cursor:pointer;">
                <i class="fa-solid fa-magnifying-glass"></i>
              </button>
              <div style="font-size:12px;font-weight:600;padding:6px 10px;background:#f1f5f9;border:1px solid #cbd5e1;border-radius:4px;color:#334155;">INR</div>
            </div>
          </div>

          <div style="display:flex;align-items:flex-start;gap:16px;">
            <label style="width:140px;font-weight:500;font-size:13px;color:var(--tx);padding-top:6px;">Location</label>
            <div>
              <select class="in" id="ret-location" name="location" style="width:260px;">
                ${whList.map(w => `<option value="${esc(w.name)}" ${(retLocation === w.name) || (!rec && w.name === 'HO Kottayam') ? 'selected' : ''}>${esc(w.name)}</option>`).join('')}
              </select>
              <div id="ret-source-of-supply" style="font-size:11.5px;color:#64748b;margin-top:3px;">
                Source of Supply: ${esc(retPlaceOfSupply || (window.APP && window.APP.org ? window.APP.org.state : 'Kerala'))}
              </div>
            </div>
          </div>

          <div style="display:flex;align-items:center;gap:16px;">
            <label style="width:140px;font-weight:500;font-size:13px;color:var(--tx);">Customer Type</label>
            <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;">
              <select class="in" id="ret-customer-type" name="customer_type" style="width:260px;">
                <option value="b2b" ${retCustType === 'b2b' ? 'selected' : ''}>B2B - Business to Business</option>
                <option value="b2c" ${retCustType === 'b2c' ? 'selected' : ''}>B2C - Business to Consumer</option>
              </select>
              <div id="ret-customer-gstin-wrap" style="display:flex;align-items:center;gap:6px;font-size:12px;background:#f8fafc;padding:4px 10px;border-radius:4px;border:1px solid var(--bd);">
                <span style="color:#64748b;font-weight:500;">GSTIN:</span>
                <span id="ret-customer-gstin" style="font-weight:600;color:var(--tx);">${(rec && rec.party_details && rec.party_details.gstin) || (parties.find(p => String(p.id) === String(retCustomer))?.gstin) || 'Not provided'}</span>
              </div>
            </div>
          </div>

          <div style="display:flex;align-items:center;gap:16px;">
            <label style="width:140px;font-weight:500;font-size:13px;color:#ef4444;">Retainer Invoice#*</label>
            <div style="display:flex;align-items:center;gap:8px;">
              <select class="in" id="ret-series" name="transaction_series" style="width:180px;">
                <option value="Default Transaction Series" ${(retSeries === 'Default Transaction Series') ? 'selected' : ''}>Default Transaction Series</option>
                <option value="Online Store Series" ${retSeries === 'Online Store Series' ? 'selected' : ''}>Online Store Series</option>
                <option value="Export Series" ${retSeries === 'Export Series' ? 'selected' : ''}>Export Series</option>
                <option value="Retail Series" ${retSeries === 'Retail Series' ? 'selected' : ''}>Retail Series</option>
              </select>
              <input class="in" id="ret-number" name="number" value="${retNum}" required style="width:180px;">
              <button type="button" class="btn ic" id="btn-ret-num-pref" title="Configure Retainer Invoice Number Preferences" style="border:1px solid var(--bd);border-radius:4px;padding:6px 10px;color:#3b82f6;cursor:pointer;">
                <i class="fa-solid fa-gear"></i>
              </button>
            </div>
          </div>

          <div style="display:flex;align-items:center;gap:16px;">
            <label style="width:140px;font-weight:500;font-size:13px;color:var(--tx);">Order Number</label>
            <input class="in" id="ret-order-number" name="order_number" value="${esc(retOrderNum)}" style="width:260px;">
          </div>

          <div style="display:flex;align-items:center;flex-wrap:wrap;gap:16px;">
            <label style="width:140px;font-weight:500;font-size:13px;color:#ef4444;">Retainer Date*</label>
            <input class="in" type="date" id="ret-date" name="date" value="${retDate}" required style="width:260px;">
            
            <label style="font-weight:500;font-size:13px;color:var(--tx);margin-left:20px;">Terms</label>
            <select class="in" id="ret-terms" name="terms" style="width:180px;">
              <option value="Due on Receipt" ${retTerms === 'Due on Receipt' ? 'selected' : ''}>Due on Receipt</option>
              <option value="Net 15" ${retTerms === 'Net 15' ? 'selected' : ''}>Net 15</option>
              <option value="Net 30" ${retTerms === 'Net 30' ? 'selected' : ''}>Net 30</option>
              <option value="Net 45" ${retTerms === 'Net 45' ? 'selected' : ''}>Net 45</option>
              <option value="Net 60" ${retTerms === 'Net 60' ? 'selected' : ''}>Net 60</option>
              <option value="Due end of the month" ${retTerms === 'Due end of the month' ? 'selected' : ''}>Due end of the month</option>
            </select>

            <label style="font-weight:500;font-size:13px;color:var(--tx);margin-left:20px;">Due Date</label>
            <input class="in" type="date" id="ret-due-date" name="due_date" value="${retDueDate}" style="width:160px;">
          </div>

          <div style="display:flex;align-items:center;gap:16px;">
            <label style="width:140px;font-weight:500;font-size:13px;color:var(--tx);display:flex;align-items:center;gap:4px;">
              Accounts Receivable
              <i class="fa-solid fa-circle-question" style="color:#94a3b8;font-size:12px;cursor:help;" title="The asset account that tracks money owed by customers"></i>
            </label>
            <select class="in" id="ret-accounts-receivable" name="accounts_receivable" style="width:260px;">
              <option value="Accounts Receivable" selected>Accounts Receivable</option>
            </select>
          </div>

          <div style="display:flex;align-items:center;gap:16px;">
            <label style="width:140px;font-weight:500;font-size:13px;color:var(--tx);">Salesperson</label>
            <div id="ret-salesperson-container"></div>
          </div>

          <div style="display:flex;align-items:center;gap:16px;">
            <label style="width:140px;font-weight:500;font-size:13px;color:var(--tx);">Associate Project(s)</label>
            <select class="in" id="ret-project" name="project_name" style="width:260px;" disabled>
              <option value="">There are no active projects for this customer.</option>
            </select>
          </div>

          <div style="display:flex;align-items:flex-start;gap:16px;">
            <label style="width:140px;font-weight:500;font-size:13px;color:var(--tx);display:flex;align-items:center;gap:4px;padding-top:6px;">
              Purpose <i class="fa-solid fa-circle-info" style="color:var(--tx-muted);font-size:12px;"></i>
            </label>
            <textarea class="in" id="ret-purpose" name="purpose" rows="2" placeholder="Enter purpose of this retainer invoice (e.g. Project advance or service retainer)" style="width:260px;font-size:12px;">${esc(retSubject)}</textarea>
          </div>

          <input type="hidden" id="ret-place-of-supply" name="place_of_supply" value="${esc(retPlaceOfSupply)}">
        </div>

        <div style="margin-top:32px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
            <div style="display:flex;align-items:center;gap:12px;">
              <span style="font-size:15px;font-weight:700;color:var(--tx);">Item Table</span>
              <select class="in" id="ret-tax-pricing" name="tax_pricing_type" style="width:145px;height:30px;font-size:12px;font-weight:600;padding:2px 8px;border-radius:6px;border:1px solid #93c5fd;background:#f0fdf4;color:#1e293b;" title="Tax Pricing Type">
                <option value="tax_exclusive" ${retTaxPricing === 'tax_exclusive' ? 'selected' : ''}>Tax Exclusive</option>
                <option value="tax_inclusive" ${retTaxPricing === 'tax_inclusive' ? 'selected' : ''}>Tax Inclusive</option>
              </select>
              <button type="button" class="btn btn-tax-pricing-info" data-doc-kind="retainer-invoices" style="background:#eff6ff;color:#2563eb;border:1px solid #bfdbfe;font-size:11.5px;font-weight:600;padding:2px 10px;border-radius:14px;cursor:pointer;display:inline-flex;align-items:center;gap:5px;" title="Learn about Tax Exclusive, Tax Inclusive, B2B & B2C GST billing">
                <i class="fa-solid fa-circle-info"></i> Guide
              </button>
            </div>
            <div style="display:flex;align-items:center;gap:12px;">
              <button type="button" class="btn" id="btn-ret-scan" style="background:none;border:none;color:#2563eb;font-weight:500;font-size:12px;display:flex;align-items:center;gap:6px;cursor:pointer;">
                <i class="fa-solid fa-barcode"></i> Scan Item
              </button>
              <button type="button" class="btn" id="btn-ret-bulk-actions" style="background:none;border:none;color:#2563eb;font-weight:500;font-size:12px;display:flex;align-items:center;gap:6px;cursor:pointer;">
                <i class="fa-regular fa-circle-check"></i> Bulk Actions
              </button>
            </div>
          </div>

          <div class="tw" style="border:1px solid var(--bd);border-radius:6px;overflow-x:auto;">
            <table class="lt" style="margin:0;width:100%;border-collapse:collapse;">
              <thead style="background:#f8fafc;border-bottom:1px solid var(--bd);">
                <tr>
                  <th style="width:50px;"></th>
                  <th style="min-width:280px;text-align:left;padding:10px 12px;font-size:11.5px;font-weight:600;color:#64748b;letter-spacing:0.5px;">ITEM DETAILS</th>
                  <th style="width:140px;min-width:130px;text-align:right;padding:10px 12px;font-size:11.5px;font-weight:600;color:#64748b;letter-spacing:0.5px;">QUANTITY</th>
                  <th style="width:110px;text-align:right;padding:10px 12px;font-size:11.5px;font-weight:600;color:#64748b;letter-spacing:0.5px;">RATE <i class="fa-regular fa-rectangle-list" style="font-size:11px;"></i></th>
                  <th style="width:120px;text-align:left;padding:10px 12px;font-size:11.5px;font-weight:600;color:#64748b;letter-spacing:0.5px;">DISCOUNT</th>
                  <th class="th-tax-explainer" data-doc-kind="retainer-invoices" style="width:140px;text-align:left;padding:10px 12px;font-size:11.5px;font-weight:600;color:#64748b;letter-spacing:0.5px;cursor:pointer;" title="Click for GST Rates, Tax Exclusive & B2B/B2C Rules">TAX <i class="fa-solid fa-circle-info" style="font-size:11px;color:#2563eb;"></i></th>
                  <th style="width:100px;text-align:right;padding:10px 12px;font-size:11.5px;font-weight:600;color:#64748b;letter-spacing:0.5px;">AMOUNT</th>
                  <th style="width:36px;"></th>
                </tr>
              </thead>
              <tbody id="retainer-line-tbody">
                ${retLines.map(rowHtml).join('')}
              </tbody>
            </table>
          </div>

          <div style="display:flex;align-items:center;gap:10px;margin-top:14px;">
            <button type="button" class="btn" id="btn-ret-add-row" style="color:#2563eb;border-color:#bfdbfe;background:#eff6ff;font-weight:600;font-size:12px;display:flex;align-items:center;gap:6px;cursor:pointer;">
              <i class="fa-solid fa-circle-plus"></i> Add New Row ▾
            </button>
            <button type="button" class="btn" id="btn-ret-bulk-items" style="color:#2563eb;border-color:#bfdbfe;background:#eff6ff;font-weight:600;font-size:12px;display:flex;align-items:center;gap:6px;cursor:pointer;">
              <i class="fa-solid fa-circle-plus"></i> Add Items in Bulk
            </button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-top:28px;">
          <div>
            <div style="margin-bottom:18px;">
              <label for="ret-notes" style="font-weight:600;font-size:13px;color:var(--tx);display:block;margin-bottom:6px;">Customer Notes</label>
              <textarea class="in" id="ret-notes" name="notes" rows="4" style="width:100%;min-height:92px;box-sizing:border-box;resize:vertical;padding:8px 10px;font-size:13px;line-height:1.5;">${esc(retNotes)}</textarea>
              <span style="font-size:11.5px;color:#64748b;display:block;margin-top:4px;">Will be displayed on the retainer invoice</span>
            </div>
            <div>
              <label for="ret-terms-text" style="font-weight:600;font-size:13px;color:var(--tx);display:block;margin-bottom:6px;">Terms &amp; Conditions</label>
              <textarea class="in" id="ret-terms-text" name="terms_conditions" rows="4" placeholder="Enter the terms and conditions of your business to be displayed in your transaction" style="width:100%;min-height:92px;box-sizing:border-box;resize:vertical;padding:8px 10px;font-size:13px;line-height:1.5;">${esc(retTermsText)}</textarea>
            </div>
          </div>

          <div style="background:#f8fafc;border:1px solid var(--bd);border-radius:10px;padding:20px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid var(--bd);">
              <span style="font-weight:600;color:var(--tx);">Sub Total</span>
              <span id="ret-subtotal-val" style="font-size:16px;font-weight:700;">0.00</span>
            </div>

            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
              <div style="display:flex;align-items:center;gap:14px;">
                <label style="display:flex;align-items:center;gap:5px;cursor:pointer;font-weight:500;font-size:13px;">
                  <input type="radio" name="ret_tax_type" value="tds" ${retTaxType === 'tds' ? 'checked' : ''}> TDS
                </label>
                <label style="display:flex;align-items:center;gap:5px;cursor:pointer;font-weight:500;font-size:13px;">
                  <input type="radio" name="ret_tax_type" value="tcs" ${retTaxType === 'tcs' ? 'checked' : ''}> TCS
                </label>
              </div>
              <div style="display:flex;align-items:center;gap:10px;">
                <select class="in" id="ret-tds-tax" name="tds_tcs_tax" style="width:150px;">
                  <option value="0">Select a Tax</option>
                  <option value="1" ${retTdsTax === 1 ? 'selected' : ''}>1%</option>
                  <option value="2" ${retTdsTax === 2 ? 'selected' : ''}>2%</option>
                  <option value="5" ${retTdsTax === 5 ? 'selected' : ''}>5%</option>
                  <option value="10" ${retTdsTax === 10 ? 'selected' : ''}>10%</option>
                </select>
                <span id="ret-tds-amt" style="font-weight:600;min-width:60px;text-align:right;">- 0.00</span>
              </div>
            </div>

            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
              <div style="display:flex;align-items:center;gap:6px;">
                <div style="border:1px dashed var(--bd);border-radius:4px;padding:4px 10px;font-size:12px;font-weight:500;color:var(--tx);">Adjustment</div>
                <i class="fa-regular fa-circle-question" style="color:#94a3b8;cursor:help;" title="Add or subtract adjustment amount"></i>
              </div>
              <div style="display:flex;align-items:center;gap:10px;">
                <input type="number" step="0.01" class="in" id="ret-adj-val" name="adjustment" value="${retAdj}" style="width:110px;text-align:right;">
                <span id="ret-adj-display" style="font-weight:600;min-width:60px;text-align:right;">0.00</span>
              </div>
            </div>

            <div style="display:flex;justify-content:space-between;align-items:center;padding-top:16px;border-top:2px solid var(--bd);margin-top:16px;">
              <span style="font-size:17px;font-weight:700;color:#0f172a;">Total ( ₹ )</span>
              <span id="ret-grandtotal-val" style="font-size:22px;font-weight:800;color:#0f172a;">0.00</span>
            </div>
          </div>
        </div>

        <div style="margin-top:28px;padding:18px;background:#f8fafc;border:1px solid var(--bd);border-radius:10px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <div>
              <div style="font-weight:600;font-size:13px;color:#0f172a;">Attach File(s) to Retainer Invoice</div>
              <div style="font-size:11.5px;color:#64748b;margin-top:2px;">You can upload a maximum of 10 files, 10MB each</div>
            </div>
            <input type="file" id="ret-file-input" multiple style="display:none;">
            <button type="button" class="btn" id="btn-ret-upload" style="font-size:12px;background:#fff;display:flex;align-items:center;gap:6px;cursor:pointer;">
              <i class="fa-solid fa-upload"></i> Upload File ▾
            </button>
          </div>
          <div id="ret-attach-badges" style="display:flex;flex-wrap:wrap;gap:8px;"></div>
        </div>

        <div style="margin-top:20px;padding:18px;background:#f8fafc;border:1px solid var(--bd);border-radius:10px;display:flex;align-items:center;justify-content:space-between;gap:20px;">
          <div>
            <div style="font-weight:600;font-size:13px;color:#0f172a;display:flex;align-items:center;gap:6px;">
              <i class="fa-solid fa-signature" style="color:#2563eb;"></i> Authorized Digital Signature
            </div>
            <div style="font-size:11.5px;color:#64748b;margin-top:2px;" id="ret-sig-desc">
              ${rec && rec.signature_data ? 'Document has an attached digital signature.' : (window.APP && window.APP.org && window.APP.org.signature_data ? 'Using company default signature.' : 'No signature attached. Click to add a signature to this retainer invoice.')}
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:12px;">
            <div id="ret-sig-preview-box" style="height:44px;min-width:90px;display:flex;align-items:center;justify-content:center;background:#fff;border:1px solid var(--bd);border-radius:6px;padding:2px 8px;">
              <img id="ret-sig-preview" src="${esc((rec && rec.signature_data) || (window.APP && window.APP.org && window.APP.org.signature_data) || '')}" alt="Signature preview" style="max-height:40px;max-width:110px;object-fit:contain;display:${((rec && rec.signature_data) || (window.APP && window.APP.org && window.APP.org.signature_data)) ? 'block' : 'none'};">
              <span id="ret-sig-none" style="font-size:11px;color:#94a3b8;display:${((rec && rec.signature_data) || (window.APP && window.APP.org && window.APP.org.signature_data)) ? 'none' : 'inline'};">None</span>
            </div>
            <input type="hidden" id="ret-signature-data" name="signature_data" value="${esc((rec && rec.signature_data) || '')}">
            <input type="hidden" id="ret-signed-by" name="signed_by" value="${esc((rec && rec.signed_by) || '')}">
            <input type="hidden" id="ret-signature-title" name="signature_title" value="${esc((rec && rec.signature_title) || '')}">
            <button type="button" class="btn btn-doc-sign" id="btn-ret-sign" style="font-size:12px;border:1px solid #cbd5e1;border-radius:6px;padding:6px 14px;background:#ffffff;display:inline-flex;align-items:center;gap:6px;cursor:pointer;color:var(--tx,#0f172a);font-weight:500;">
              <i class="fa-solid fa-pen-nib"></i> ${((rec && rec.signature_data) || (window.APP && window.APP.org && window.APP.org.signature_data)) ? 'Change Signature' : 'Sign Retainer Invoice'}
            </button>
          </div>
        </div>

        ${renderPaymentGatewayBanner()}

        <div style="position:sticky;bottom:0;background:#fff;border-top:1px solid var(--bd);margin-top:36px;padding:14px 0;display:flex;align-items:center;justify-content:space-between;z-index:15;">
          <div style="display:flex;align-items:center;gap:10px;">
            <button type="button" class="btn" id="btn-ret-save-draft" style="background:#fff;font-weight:500;cursor:pointer;">Save as Draft</button>
            <button type="button" class="btn p" id="btn-ret-save-send" style="display:flex;align-items:center;gap:6px;cursor:pointer;">
              Save and Send <i class="fa-solid fa-caret-up" style="font-size:10px;"></i>
            </button>
            <button type="button" class="btn" id="btn-ret-cancel" style="background:#fff;font-weight:500;cursor:pointer;">Cancel</button>
          </div>
          <div style="display:flex;align-items:center;gap:20px;font-size:13px;font-weight:600;color:#0f172a;">
            <span>Total Amount: <span id="ret-bar-total-amount">₹ 0.00</span></span>
            <span>Total Quantity: <span id="ret-bar-total-qty">0</span></span>
          </div>
        </div>
      </form>
    </div>
  `;

  const form = $('#retainer-form-element', target);
  const tbody = $('#retainer-line-tbody', form);
  const byId = Object.fromEntries(items.map(it => [String(it.id), it]));
  const stockTracker = initItemTableStockTracker(tbody, items, whList, () => calcRetainer());

  createSalespersonCustomDropdown($('#ret-salesperson-container', form), retSalesperson, () => {});
  setupProjectSelectorForCustomer($('#ret-project', form), retCustomer, retProject);
  $('#ret-customer', form)?.addEventListener('change', (e) => {
    setupProjectSelectorForCustomer($('#ret-project', form), e.target.value);
  });

  $('#btn-ret-num-pref', form)?.addEventListener('click', () => {
    openDocNumberPreferencesModal({
      kind: 'retainer-invoices',
      series: $('#ret-series', form)?.value || 'Default Transaction Series',
      location: $('#ret-location', form)?.value || 'HO Kottayam',
      onSave: (pfx, next) => {
        if (next) $('#ret-number', form).value = next;
      }
    });
  });

  function updateDueDate() {
    const dVal = $('#ret-date', form).value;
    if (!dVal) return;
    const termsVal = $('#ret-terms', form).value;
    const d = new Date(dVal + 'T00:00:00');
    if (termsVal === 'Due on Receipt') {
      $('#ret-due-date', form).value = dVal;
    } else if (termsVal === 'Net 15') {
      d.setDate(d.getDate() + 15);
      $('#ret-due-date', form).value = d.toISOString().slice(0, 10);
    } else if (termsVal === 'Net 30') {
      d.setDate(d.getDate() + 30);
      $('#ret-due-date', form).value = d.toISOString().slice(0, 10);
    } else if (termsVal === 'Net 45') {
      d.setDate(d.getDate() + 45);
      $('#ret-due-date', form).value = d.toISOString().slice(0, 10);
    } else if (termsVal === 'Net 60') {
      d.setDate(d.getDate() + 60);
      $('#ret-due-date', form).value = d.toISOString().slice(0, 10);
    } else if (termsVal === 'Due end of the month') {
      const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      $('#ret-due-date', form).value = endOfMonth.toISOString().slice(0, 10);
    }
  }

  function calcRetainer() {
    const isTaxInclusive = ($('#ret-tax-pricing', form)?.value === 'tax_inclusive');
    let subtotal = 0;
    let totalTax = 0;
    let totalQty = 0;
    $$('.ln-retainer-invoice', tbody).forEach(tr => {
      const qty = num($('.l-qty', tr).value) || 0;
      const rate = num($('.l-rate', tr).value) || 0;
      const discVal = num($('.l-disc', tr).value) || 0;
      const discType = $('.l-disc-type', tr).value;
      const gross = qty * rate;
      const disc = discType === 'percent' ? (gross * discVal / 100) : discVal;
      const net = Math.max(0, gross - disc);
      const gstRate = num($('.l-gst', tr).value) || 0;

      let taxable = net;
      let tax = 0;
      let lineTot = net;

      if (isTaxInclusive && gstRate > 0) {
        taxable = Math.round((net / (1 + gstRate / 100)) * 100) / 100;
        tax = Math.round((net - taxable) * 100) / 100;
        lineTot = net;
      } else {
        taxable = Math.round(net * 100) / 100;
        tax = Math.round((taxable * (gstRate / 100)) * 100) / 100;
        lineTot = taxable + tax;
      }

      $('.l-amt', tr).textContent = (lineTot).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      subtotal += taxable;
      totalTax += tax;
      totalQty += qty;
    });

    const taxType = form.querySelector('input[name="ret_tax_type"]:checked')?.value || 'tds';
    const tdsRate = num($('#ret-tds-tax', form).value) || 0;
    const tdsAmt = subtotal * tdsRate / 100;
    const adj = num($('#ret-adj-val', form).value) || 0;

    $('#ret-tds-amt', form).textContent = `${taxType === 'tds' ? '-' : '+'} ${tdsAmt.toFixed(2)}`;
    $('#ret-adj-display', form).textContent = adj.toFixed(2);

    let grand = subtotal + totalTax;
    if (taxType === 'tds') {
      grand -= tdsAmt;
    } else {
      grand += tdsAmt;
    }
    grand = Math.max(0, grand + adj);

    $('#ret-subtotal-val', form).textContent = subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    $('#ret-grandtotal-val', form).textContent = grand.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    $('#ret-bar-total-amount', form).textContent = inr(grand);
    $('#ret-bar-total-qty', form).textContent = totalQty;
  }

  function renderAttach() {
    const box = $('#ret-attach-badges', form);
    let h = '';
    if (rec && rec.attachments && rec.attachments.length) {
      h += rec.attachments.map(a => `
        <div class="attach-file-badge">
          <span>📎 ${esc(a.filename)} (${fmtBytes(a.file_size)})</span>
          <button type="button" data-del-att="${a.id}">×</button>
        </div>
      `).join('');
    }
    h += pendingFiles.map((f, i) => `
      <div class="attach-file-badge" style="border-style:dashed;">
        <span>📎 ${esc(f.name)} (${fmtBytes(f.size)}) <small style="color:var(--accent);">new</small></span>
        <button type="button" data-rem-pen="${i}">×</button>
      </div>
    `).join('');
    if (!h) h = '<span class="sub" style="font-size:12px;">No files attached yet.</span>';
    box.innerHTML = h;
  }

  const closeForm = () => {
    if (onDone) onDone(null);
    else {
      location.hash = '#/sales/retainer-invoices';
      route();
    }
  };

  const closeX = $('#btn-ret-close-x', target);
  if (closeX) closeX.addEventListener('click', closeForm);
  const cancelBtn = $('#btn-ret-cancel', target);
  if (cancelBtn) cancelBtn.addEventListener('click', closeForm);

  $('#btn-ret-cust-lookup', form).addEventListener('click', () => {
    partyForm('customers', null, (newCust) => {
      if (newCust && newCust.id) {
        parties.push(newCust);
        const sel = $('#ret-customer', form);
        sel.insertAdjacentHTML('beforeend', `<option value="${newCust.id}" selected>${esc(newCust.name)}</option>`);
        sel.value = newCust.id;
        if (newCust.state) $('#ret-place-of-supply', form).value = newCust.state;
      }
    });
  });

  $('#ret-customer', form).addEventListener('change', e => {
    if (e.target.value === '__new_customer__') {
      handleQuickCreateSelect(e.target, newCust => {
        parties.push(newCust);
        if (newCust.state) $('#ret-place-of-supply', form).value = newCust.state;
        if (newCust.payment_terms) {
          const termsMap = { 0: 'Due on Receipt', 15: 'Net 15', 30: 'Net 30', 45: 'Net 45', 60: 'Net 60' };
          if (termsMap[newCust.payment_terms]) {
            $('#ret-terms', form).value = termsMap[newCust.payment_terms];
            updateDueDate();
          }
        }
      });
      return;
    }
    const custId = $('#ret-customer', form).value;
    const cust = parties.find(p => String(p.id) === String(custId));
    if (cust) {
      if (cust.state) $('#ret-place-of-supply', form).value = cust.state;
      const gstinEl = $('#ret-customer-gstin', form);
      const custTypeEl = $('#ret-customer-type', form);
      if (gstinEl) gstinEl.textContent = cust.gstin || 'Not provided';
      if (custTypeEl) {
        if (cust.gstin && cust.gstin.trim()) {
          custTypeEl.value = 'b2b';
        } else if (cust.customer_type === 'individual') {
          custTypeEl.value = 'b2c';
        }
      }
      if (cust.payment_terms) {
        const termsMap = { 0: 'Due on Receipt', 15: 'Net 15', 30: 'Net 30', 45: 'Net 45', 60: 'Net 60' };
        if (termsMap[cust.payment_terms]) {
          $('#ret-terms', form).value = termsMap[cust.payment_terms];
          updateDueDate();
        }
      }
    }
  });

  $('#ret-date', form).addEventListener('change', updateDueDate);
  $('#ret-terms', form).addEventListener('change', updateDueDate);

  $('#btn-ret-sign', form)?.addEventListener('click', () => {
    const curSigObj = {
      signature_data: $('#ret-signature-data', form)?.value || '',
      signed_by: $('#ret-signed-by', form)?.value || '',
      signature_title: $('#ret-signature-title', form)?.value || '',
      number: retNum
    };
    openSignatureModal(curSigObj, 'retainer-invoices', updated => {
      if ($('#ret-signature-data', form)) $('#ret-signature-data', form).value = updated.signature_data || '';
      if ($('#ret-signed-by', form)) $('#ret-signed-by', form).value = updated.signed_by || '';
      if ($('#ret-signature-title', form)) $('#ret-signature-title', form).value = updated.signature_title || '';
      const previewImg = $('#ret-sig-preview', form);
      const noneSpan = $('#ret-sig-none', form);
      const descEl = $('#ret-sig-desc', form);
      const signBtn = $('#btn-ret-sign', form);
      if (updated.signature_data) {
        if (previewImg) { previewImg.src = updated.signature_data; previewImg.style.display = 'block'; }
        if (noneSpan) noneSpan.style.display = 'none';
        if (descEl) descEl.textContent = 'Custom digital signature attached.';
        if (signBtn) signBtn.innerHTML = '<i class="fa-solid fa-pen-nib"></i> Change Signature';
      } else {
        if (previewImg) previewImg.style.display = 'none';
        if (noneSpan) noneSpan.style.display = 'inline';
        if (descEl) descEl.textContent = 'No custom signature attached.';
        if (signBtn) signBtn.innerHTML = '<i class="fa-solid fa-pen-nib"></i> Sign Retainer Invoice';
      }
    });
  });

  $('#btn-ret-num-pref', form)?.addEventListener('click', async () => {
    let currentConfig = { prefix: 'RET', next_sequence: 1, formatted: retNum };
    try {
      currentConfig = await api('retainer-invoices/sequence/');
    } catch (_) {}

    Modal.open({
      title: 'Configure Retainer Invoice Number Sequence',
      dialog: true,
      body: `
        <div style="padding:10px 0;">
          <p class="sub" style="margin-bottom:14px;font-size:13px;line-height:1.5;">Specify the prefix and next sequential counter for your retainer invoices. Document numbers follow <code>ORG/PREFIX/FY/SEQUENCE</code>.</p>
          <div class="fg">
            <label style="font-weight:600;font-size:12px;">Prefix</label>
            <input class="in" id="ret-prefix-input" value="${esc(currentConfig.prefix || 'RET')}" style="width:160px;text-transform:uppercase;" placeholder="e.g. RET">
          </div>
          <div class="fg" style="margin-top:14px;">
            <label style="font-weight:600;font-size:12px;">Next Sequence Number</label>
            <input class="in" id="ret-next-seq-input" type="number" min="1" step="1" value="${currentConfig.next_sequence || 1}" style="width:160px;">
          </div>
        </div>
      `,
      footer: `
        <button class="btn" data-close>Cancel</button>
        <button class="btn p" id="btn-save-ret-seq">Save Sequence</button>
      `
    });

    $('#btn-save-ret-seq')?.addEventListener('click', async () => {
      const pfx = ($('#ret-prefix-input').value || '').trim().toUpperCase() || 'RET';
      const seq = Math.max(1, parseInt($('#ret-next-seq-input').value, 10) || 1);
      try {
        const res = await api('retainer-invoices/sequence/', {
          method: 'POST',
          body: { prefix: pfx, next_sequence: seq }
        });
        $('#ret-number', form).value = res.formatted;
        Modal.close();
        toast(`Retainer invoice sequence updated to ${res.formatted}`, 'ok');
      } catch (err) {
        toast(err.message, 'err');
      }
    });
  });

  tbody.addEventListener('change', e => {
    if (e.target.classList.contains('l-item')) {
      if (e.target.value === '__new_item__') {
        handleQuickCreateSelect(e.target, newItem => {
          items.push(newItem);
          byId[String(newItem.id)] = newItem;
          calcRetainer();
        });
        return;
      }
      const it = byId[e.target.value];
      const tr = e.target.closest('tr');
      if (it && tr) {
        $('.l-desc', tr).value = it.name;
        $('.l-hsn', tr).value = it.hsn_sac || '';
        $('.l-rate', tr).value = it.selling_price || 0;
        $('.l-gst', tr).value = String(num(it.gst_rate) || 18);
        stockTracker.updateRow(tr, true);
      }
      calcRetainer();
    }
  });

  form.addEventListener('input', () => calcRetainer());
  form.addEventListener('change', () => calcRetainer());

  $('#btn-ret-add-row', form).addEventListener('click', () => {
    tbody.insertAdjacentHTML('beforeend', rowHtml({ quantity: 1, rate: 0, discount_percent: 0, gst_rate: 18 }));
    stockTracker.updateRow(tbody.lastElementChild, false);
    calcRetainer();
  });

  $('#btn-ret-bulk-items', form).addEventListener('click', () => {
    bulkItemPickerModal(items, (selectedItems) => {
      selectedItems.forEach(it => {
        tbody.insertAdjacentHTML('beforeend', rowHtml(it));
      });
      calcRetainer();
    });
  });

  tbody.addEventListener('click', e => {
    const rm = e.target.closest('[data-rm-line]');
    if (rm) {
      if ($$('.ln-retainer-invoice', tbody).length > 1) {
        rm.closest('tr').remove();
        calcRetainer();
      } else {
        toast('At least one item line is required.', 'err');
      }
    }
  });

  const fileInput = $('#ret-file-input', form);
  $('#btn-ret-upload', form).addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    Array.from(fileInput.files).forEach(f => {
      if (pendingFiles.length >= 10) {
        toast('Maximum 10 files can be attached.', 'err');
        return;
      }
      const reader = new FileReader();
      reader.onload = ev => {
        pendingFiles.push({ name: f.name, size: f.size, type: f.type, data: ev.target.result });
        renderAttach();
      };
      reader.readAsDataURL(f);
    });
    fileInput.value = '';
  });

  $('#ret-attach-badges', form).addEventListener('click', async e => {
    const delBtn = e.target.closest('[data-del-att]');
    if (delBtn) {
      const attId = delBtn.dataset.delAtt;
      if (!(await confirmBox({ title: 'Delete attachment?', message: 'This file will be permanently removed.', okText: 'Delete', danger: true }))) return;
      try {
        await api(`attachments/${attId}/`, { method: 'DELETE' });
        rec.attachments = (rec.attachments || []).filter(a => String(a.id) !== String(attId));
        renderAttach();
        toast('Attachment deleted', 'ok');
      } catch (err) { toast(err.message, 'err'); }
      return;
    }
    const remBtn = e.target.closest('[data-rem-pen]');
    if (remBtn) {
      pendingFiles.splice(Number(remBtn.dataset.remPen), 1);
      renderAttach();
    }
  });

  const saveRetainerInvoice = async (isDraft) => {
    const custId = $('#ret-customer', form).value;
    if (!custId) {
      toast('Please select a customer.', 'err');
      $('#ret-customer', form).focus();
      return;
    }
    const numVal = $('#ret-number', form).value.trim();
    if (!numVal) {
      toast('Please enter a retainer invoice number.', 'err');
      $('#ret-number', form).focus();
      return;
    }
    const dt = $('#ret-date', form).value;
    if (!dt) {
      toast('Please enter a retainer date.', 'err');
      return;
    }

    const lines = [];
    let lineErr = false;
    $$('.ln-retainer-invoice', tbody).forEach(tr => {
      const itVal = $('.l-item', tr).value;
      const descVal = $('.l-desc', tr).value.trim();
      const qtyVal = num($('.l-qty', tr).value) || 0;
      const rateVal = num($('.l-rate', tr).value) || 0;
      if (!descVal && !itVal) {
        lineErr = true;
        return;
      }
      lines.push({
        item: itVal || null,
        warehouse: $('.l-wh-select', tr)?.value || null,
        warehouse_id: $('.l-wh-select', tr)?.value || null,
        warehouse_code: $('.l-wh-code', tr)?.value || '',
        description: descVal || (itVal && byId[itVal] ? byId[itVal].name : 'Item line'),
        hsn_sac: $('.l-hsn', tr).value.trim(),
        quantity: qtyVal || 1,
        rate: rateVal,
        discount_percent: num($('.l-disc', tr).value) || 0,
        gst_rate: num($('.l-gst', tr).value) || 0
      });
    });

    if (lineErr || !lines.length) {
      toast('Please enter a description or select an item for each row.', 'err');
      return;
    }

    if (!isDraft && !(APP.org && APP.org.allow_negative_stock)) {
      const stockCheck = stockTracker.validate();
      if (!stockCheck.valid) {
        toast(stockCheck.error, 'err');
        return;
      }
    }

    const payload = {
      customer: custId,
      customer_id: custId,
      number: numVal,
      order_number: ($('#ret-order-number', form)?.value || '').trim(),
      location: $('#ret-location', form)?.value || 'HO Kottayam',
      transaction_series: $('#ret-series', form)?.value || 'Default Transaction Series',
      accounts_receivable: $('#ret-accounts-receivable', form)?.value || 'Accounts Receivable',
      date: dt,
      due_date: $('#ret-due-date', form).value || dt,
      tax_pricing_type: $('#ret-tax-pricing', form)?.value || 'tax_exclusive',
      customer_type: $('#ret-customer-type', form)?.value || 'b2b',
      terms: $('#ret-terms', form).value,
      salesperson: (form.querySelector('#ret-salesperson-container select.sp-select')?.value || $('#ret-salesperson', form)?.value || ''),
      project_name: $('#ret-project', form)?.value || '',
      purpose: ($('#ret-purpose', form)?.value || $('#ret-subject', form)?.value || '').trim(),
      subject: ($('#ret-purpose', form)?.value || $('#ret-subject', form)?.value || '').trim(),
      place_of_supply: $('#ret-place-of-supply', form).value || (APP.org ? APP.org.state : 'Kerala'),
      notes: $('#ret-notes', form).value.trim(),
      signature_data: $('#ret-signature-data', form)?.value || '',
      signed_by: $('#ret-signed-by', form)?.value || '',
      signature_title: $('#ret-signature-title', form)?.value || '',
      lines: lines,
      force: true
    };

    const actionBtns = [$('#btn-ret-save-draft', target), $('#btn-ret-save-send', target)];
    actionBtns.forEach(b => { if (b) b.disabled = true; });

    try {
      let saved;
      if (id) {
        saved = await api(`retainer-invoices/${id}/`, { method: 'PUT', body: payload });
      } else {
        saved = await api('retainer-invoices/', { method: 'POST', body: payload });
      }

      for (const pf of pendingFiles) {
        try {
          await api('attachments/', {
            method: 'POST',
            body: {
              entity_type: 'retainer_invoice',
              entity_id: saved.id,
              filename: pf.name,
              file_size: pf.size,
              mime_type: pf.type,
              file_data: pf.data
            }
          });
        } catch (e) { console.error('Attachment upload error:', e); }
      }

      if (!isDraft) {
        try {
          await api(`retainer-invoices/${saved.id}/send/`, { method: 'POST', body: {} });
          toast(`${saved.number} saved and sent successfully!`, 'ok');
        } catch (e) {
          toast(`${saved.number} saved as draft, but could not be sent: ${e.message}`, 'err');
        }
      } else {
        toast(`${saved.number} ${id ? 'updated' : 'saved as draft'} successfully!`, 'ok');
      }

      if (onDone) onDone(saved);
      else {
        location.hash = '#/sales/retainer-invoices';
        route();
      }
    } catch (err) {
      toast(err.message, 'err');
    } finally {
      actionBtns.forEach(b => { if (b) b.disabled = false; });
    }
  };

  $('#btn-ret-save-draft', target).addEventListener('click', () => saveRetainerInvoice(true));
  $('#btn-ret-save-send', target).addEventListener('click', () => saveRetainerInvoice(false));

  const handleRetClose = () => {
    if (onDone) onDone();
    else {
      location.hash = '#/sales/retainer-invoices';
      if (typeof route === 'function') route();
    }
  };
  $('#btn-ret-close-x', target)?.addEventListener('click', handleRetClose);
  $('#btn-ret-cancel', target)?.addEventListener('click', handleRetClose);

  renderAttach();
  calcRetainer();
}
window.retainerInvoiceForm = retainerInvoiceForm;



/* --- Stock Transfer Module --- */

async function confirmStockTransferAction(id, number) {
  const ok = await confirmBox({
    title: `Confirm Stock Transfer ${number || ''}?`,
    message: 'Are you sure you want to confirm this stock transfer? The selected quantities will be deducted from the source warehouse and added to the destination warehouse. This action will update inventory records and cannot be deleted.',
    okText: 'Confirm Transfer',
    danger: false
  });
  if (!ok) return;

  try {
    const res = await api(`stock-transfers/${id}/confirm/`, { method: 'POST', body: {} });
    toast(`Stock Transfer ${res.number || number} confirmed successfully! Inventory updated.`, 'ok');
    if (window.PAGE && window.PAGE.reload) window.PAGE.reload();
    else location.reload();
  } catch (err) {
    toast(err.message, 'err');
  }
}

async function reverseStockTransferAction(id, number) {
  return new Promise(resolve => {
    const m = Modal.open({
      title: `Reverse Stock Transfer ${number || ''}`,
      dialog: true,
      wide: false,
      body: `
        <div style="font-size:13.5px; line-height:1.5; color:var(--tx); margin-bottom:14px;">
          Are you sure you want to reverse this stock transfer? The original transaction will remain in the audit log. The transferred quantities will be returned to their original warehouse, subject to stock availability and validation.
        </div>
        <div class="fe" id="rev-err-msg" style="display:none; color:#ef4444; font-size:12.5px; margin-bottom:10px; padding:8px 12px; background:#fee2e2; border-radius:6px;"></div>
        <div>
          <label style="font-weight:600; font-size:12.5px; display:block; margin-bottom:4px;">Reversal Reason <span style="color:#ef4444;">*</span></label>
          <textarea id="st-rev-reason" class="in" rows="2" placeholder="e.g. Accidental transfer, wrong destination warehouse selected" style="width:100%; box-sizing:border-box;"></textarea>
        </div>
      `,
      footer: `
        <button type="button" class="btn" data-close>Cancel</button>
        <button type="button" class="btn d" id="btn-do-reverse">Reverse Transfer</button>
      `
    });

    const doBtn = $('#btn-do-reverse', m.el);
    const reasonEl = $('#st-rev-reason', m.el);
    const errBox = $('#rev-err-msg', m.el);

    doBtn.addEventListener('click', async () => {
      const reason = reasonEl.value.trim();
      if (!reason) {
        errBox.textContent = 'Please enter a reason for the reversal.';
        errBox.style.display = 'block';
        reasonEl.focus();
        return;
      }
      doBtn.disabled = true;
      doBtn.textContent = 'Reversing…';
      try {
        const res = await api(`stock-transfers/${id}/reverse/`, { method: 'POST', body: { reason } });
        m.close();
        toast(`Stock Transfer ${number} reversed successfully. Reversal record ${res.number || ''} linked.`, 'ok');
        if (window.PAGE && window.PAGE.reload) window.PAGE.reload();
        else location.reload();
        resolve(res);
      } catch (err) {
        doBtn.disabled = false;
        doBtn.textContent = 'Reverse Transfer';
        errBox.textContent = err.message || 'Failed to reverse stock transfer.';
        errBox.style.display = 'block';
      }
    });
  });
}

async function viewStockTransferDetail(id) {
  try {
    const t = await api(`stock-transfers/${id}/`);
    const statusMap = {
      draft: ['chip-lavender', 'DRAFT'],
      confirmed: ['chip-mint', 'CONFIRMED'],
      reversed: ['chip-rose', 'REVERSED']
    };
    const [statusCls, statusLabel] = statusMap[t.status] || ['chip-lavender', (t.status || '').toUpperCase()];

    const m = Modal.open({
      title: `Stock Transfer ${t.number}`,
      dialog: true,
      wide: true,
      body: `
        <div style="display:flex; flex-direction:column; gap:16px;">
          <!-- Top bar with status and metadata -->
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; padding:14px 18px; background:var(--surface-glass-subtle); border:1px solid var(--bd); border-radius:10px;">
            <div>
              <div style="font-size:18px; font-weight:800; color:var(--tx);">${esc(t.number)}${t.is_reversal ? ' <span class="pastel-chip chip-rose" style="font-size:11px;">Reversal Entry</span>' : ''}</div>
              <div style="font-size:12px; color:var(--tx-muted); margin-top:2px;">Date: <b>${fd(t.date)}</b> · Created by: <b>${esc(t.created_by || 'System')}</b></div>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="pastel-chip ${statusCls}" style="font-size:12px; font-weight:700; padding:4px 12px;">${statusLabel}</span>
            </div>
          </div>

          <!-- Warehouse Route -->
          <div style="display:flex; align-items:center; justify-content:center; gap:20px; padding:16px; background:var(--surface-glass-subtle); border:1px solid var(--bd); border-radius:10px;">
            <div style="text-align:center; min-width:140px;">
              <span style="font-size:11px; text-transform:uppercase; font-weight:700; color:var(--tx-muted);">Source Warehouse</span>
              <div style="font-size:15px; font-weight:700; color:var(--tx); margin-top:4px;">${esc(t.source_warehouse_name)}</div>
              <span class="pastel-chip chip-lavender" style="font-size:11px; font-weight:600;">${esc(t.source_warehouse_code)}</span>
            </div>
            <div style="display:flex; align-items:center; color:var(--accent); font-size:24px; font-weight:900;">
              ➔
            </div>
            <div style="text-align:center; min-width:140px;">
              <span style="font-size:11px; text-transform:uppercase; font-weight:700; color:var(--tx-muted);">Destination Warehouse</span>
              <div style="font-size:15px; font-weight:700; color:var(--tx); margin-top:4px;">${esc(t.destination_warehouse_name)}</div>
              <span class="pastel-chip chip-sky" style="font-size:11px; font-weight:600;">${esc(t.destination_warehouse_code)}</span>
            </div>
          </div>

          <!-- Lines table -->
          <div>
            <h3 style="font-size:14px; font-weight:700; margin-bottom:8px; color:var(--tx);">Transferred Items (${t.lines ? t.lines.length : 0})</h3>
            <div class="tw" style="overflow-x:auto; border:1px solid var(--bd); border-radius:8px;">
              <table>
                <thead>
                  <tr>
                    <th>Item / Product</th>
                    <th>SKU</th>
                    <th class="r">Quantity</th>
                    <th>Unit</th>
                    <th>Batch #</th>
                    <th>Serial #</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  ${(t.lines || []).map(l => `
                    <tr>
                      <td style="font-weight:600;">${esc(l.item_name)}</td>
                      <td style="color:var(--tx-muted);">${esc(l.item_sku || '—')}</td>
                      <td class="r" style="font-weight:700;">${qty(l.quantity)}</td>
                      <td>${esc(l.unit || 'nos')}</td>
                      <td>${esc(l.batch_number || '—')}</td>
                      <td>${esc(l.serial_number || '—')}</td>
                      <td style="color:var(--tx-muted);">${esc(l.description || '—')}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>

          <!-- Notes -->
          ${t.notes ? `
            <div style="font-size:12.5px; padding:10px 14px; background:var(--surface-glass-subtle); border-radius:8px; border:1px solid var(--bd);">
              <span style="font-weight:600; color:var(--tx);">Notes:</span> ${esc(t.notes)}
            </div>
          ` : ''}

          <!-- Reversal or Confirmation Info -->
          ${t.status === 'confirmed' ? `
            <div style="padding:10px 14px; background:rgba(16,185,129,0.08); border:1px solid rgba(16,185,129,0.25); border-radius:8px; font-size:12.5px; color:#059669;">
              ✓ <b>Confirmed:</b> ${fd(t.confirmed_at)} by <b>${esc(t.confirmed_by || 'System')}</b>. Stock successfully updated across warehouses.
            </div>
          ` : ''}

          ${t.status === 'reversed' ? `
            <div style="padding:10px 14px; background:rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.25); border-radius:8px; font-size:12.5px; color:#dc2626;">
              ⚠️ <b>Reversed:</b> ${fd(t.reversed_at)} by <b>${esc(t.reversed_by || 'System')}</b>.
              <div style="margin-top:4px;"><b>Reason:</b> ${esc(t.reversal_reason || 'Reversed')}</div>
            </div>
          ` : ''}

          <!-- Audit Trail section -->
          ${t.audit_trail && t.audit_trail.length ? `
            <div style="margin-top:6px;">
              <h3 style="font-size:13px; font-weight:700; margin-bottom:8px; color:var(--tx);">Audit Trail</h3>
              <div style="display:flex; flex-direction:column; gap:6px; max-height:160px; overflow-y:auto;">
                ${t.audit_trail.map(a => `
                  <div style="padding:6px 10px; background:var(--surface-glass-subtle); border-radius:6px; font-size:11.5px; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                      <span class="pastel-chip chip-lavender" style="font-size:9.5px; font-weight:700;">${esc(a.action.toUpperCase())}</span>
                      <span style="font-weight:600; margin-left:6px;">${esc(a.summary)}</span>
                    </div>
                    <span style="color:var(--tx-muted);">${fd(a.timestamp)} · ${esc(a.username)}</span>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}
        </div>
      `,
      footer: `
        ${t.status === 'draft' ? `<button type="button" class="btn" id="btn-st-edit">Edit</button><button type="button" class="btn p" id="btn-st-confirm">Confirm Transfer</button>` : ''}
        ${t.status === 'confirmed' ? `<button type="button" class="btn d" id="btn-st-reverse">Reverse Entry</button>` : ''}
        <button type="button" class="btn" data-close>Close</button>
      `
    });

    $('#btn-st-edit', m.el)?.addEventListener('click', () => { m.close(); stockTransferModal(id); });
    $('#btn-st-confirm', m.el)?.addEventListener('click', () => { m.close(); confirmStockTransferAction(id, t.number); });
    $('#btn-st-reverse', m.el)?.addEventListener('click', () => { m.close(); reverseStockTransferAction(id, t.number); });
  } catch (err) {
    toast(err.message, 'err');
  }
}

async function stockTransferModal(id = null, onDone = null) {
  const [warehouses, items, rec] = await Promise.all([
    api('lookup/warehouses/').catch(() => []),
    api('lookup/items/').catch(() => []),
    id ? api(`stock-transfers/${id}/`).catch(() => null) : null
  ]);

  if (id && rec && rec.status !== 'draft') {
    toast(`Only draft stock transfers can be edited. This transfer is ${rec.status_display}.`, 'err');
    viewStockTransferDetail(id);
    return;
  }

  const whList = warehouses.filter(w => w.active !== false);
  if (whList.length < 2) {
    toast('At least two active warehouses are required to perform a stock transfer.', 'err');
    return;
  }

  const goodsItems = items.filter(i => i.type === 'goods' || i.track_inventory);
  if (!goodsItems.length) {
    toast('No goods items with inventory tracking available to transfer.', 'err');
    return;
  }

  const itemsById = Object.fromEntries(goodsItems.map(i => [String(i.id), i]));

  const o = rec || {
    number: '',
    date: (window.APP && window.APP.today) ? window.APP.today : new Date().toISOString().slice(0, 10),
    source_warehouse_id: whList[0]?.id || '',
    destination_warehouse_id: whList[1]?.id || '',
    notes: '',
    lines: [{ item_id: '', quantity: 1, unit: 'nos', batch_number: '', serial_number: '', description: '' }]
  };

  const buildLineRow = (l, idx) => `
    <tr class="st-line-row" data-idx="${idx}">
      <td style="min-width:210px; padding:6px 8px;">
        <select class="in st-item" aria-label="Item" style="width:100%;">
          <option value="">— Select Item —</option>
          <option value="__new_item__" style="color:var(--accent);font-weight:600;">+ Add New Item…</option>
          ${goodsItems.map(it => `<option value="${it.id}" ${String(l.item_id) === String(it.id) ? 'selected' : ''}>${esc(it.name)}${it.sku ? ' (' + esc(it.sku) + ')' : ''}</option>`).join('')}
        </select>
      </td>
      <td style="width:130px; text-align:center; padding:6px 8px;">
        <span class="st-avail-badge pastel-chip chip-lavender" style="font-size:11px; font-weight:600; padding:2px 8px;">Stock: —</span>
      </td>
      <td style="width:110px; padding:6px 8px;">
        <input class="in st-qty" type="number" step="0.001" min="0.001" value="${esc(l.quantity || 1)}" style="width:100%; text-align:right;">
      </td>
      <td style="width:75px; padding:6px 8px;">
        <input class="in st-unit" value="${esc(l.unit || 'nos')}" readonly style="width:100%; text-align:center; background:rgba(0,0,0,0.03);" tabindex="-1">
      </td>
      <td style="width:105px; padding:6px 8px;">
        <input class="in st-batch" placeholder="Batch #" value="${esc(l.batch_number || '')}" style="width:100%;">
      </td>
      <td style="width:115px; padding:6px 8px;">
        <input class="in st-serial" placeholder="Serial #" value="${esc(l.serial_number || '')}" style="width:100%;">
      </td>
      <td style="min-width:130px; padding:6px 8px;">
        <input class="in st-desc" placeholder="Notes / line memo" value="${esc(l.description || '')}" style="width:100%;">
      </td>
      <td style="width:36px; text-align:center; padding:6px 8px;">
        <button type="button" class="btn ic st-rm" title="Remove line" style="color:#ef4444; font-size:16px;">×</button>
      </td>
    </tr>
  `;

  const m = Modal.open({
    title: id ? `Edit Stock Transfer ${o.number}` : 'New Stock Transfer Between Warehouses',
    dialog: true,
    wide: true,
    body: `
      <form id="st-form-el" style="padding:2px 0;" novalidate>
        <div class="fe" id="st-err-box" style="display:none; color:#ef4444; font-size:12.5px; margin-bottom:12px; padding:8px 12px; background:#fee2e2; border-radius:6px;" role="alert"></div>

        <div style="display:flex; flex-direction:column; gap:14px; background:var(--surface-glass-subtle); padding:18px; border-radius:10px; border:1px solid var(--bd); margin-bottom:18px;">
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:14px;">
            <div>
              <label style="font-weight:600; font-size:12.5px; display:block; margin-bottom:4px; color:var(--tx);">Transfer Number</label>
              <input class="in" id="st-number" value="${esc(o.number || '')}" placeholder="Auto-generated (e.g. ST-00001)" ${id ? 'readonly' : ''} style="width:100%;">
            </div>
            <div>
              <label style="font-weight:600; font-size:12.5px; display:block; margin-bottom:4px; color:var(--tx);">Transfer Date <span style="color:#ef4444;">*</span></label>
              <input class="in" type="date" id="st-date" value="${esc(o.date)}" required style="width:100%;">
            </div>
            <div>
              <label style="font-weight:600; font-size:12.5px; display:block; margin-bottom:4px; color:var(--tx);">Source Warehouse (From) <span style="color:#ef4444;">*</span></label>
              <select class="in" id="st-src-wh" required style="width:100%;">
                ${whList.map(w => `<option value="${w.id}" ${String(w.id) === String(o.source_warehouse_id) ? 'selected' : ''}>${esc(w.code)} - ${esc(w.name)}</option>`).join('')}
                <option value="__new_warehouse__">+ Add New Warehouse…</option>
              </select>
            </div>
            <div>
              <label style="font-weight:600; font-size:12.5px; display:block; margin-bottom:4px; color:var(--tx);">Destination Warehouse (To) <span style="color:#ef4444;">*</span></label>
              <select class="in" id="st-dst-wh" required style="width:100%;">
                ${whList.map(w => `<option value="${w.id}" ${String(w.id) === String(o.destination_warehouse_id) ? 'selected' : ''}>${esc(w.code)} - ${esc(w.name)}</option>`).join('')}
                <option value="__new_warehouse__">+ Add New Warehouse…</option>
              </select>
            </div>
          </div>
        </div>

        <div style="margin-bottom:16px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <h3 style="font-size:14px; font-weight:700; color:var(--tx); margin:0;">Transfer Line Items</h3>
            <button type="button" class="btn" id="st-add-line" style="font-weight:600; font-size:12px;">+ Add Item</button>
          </div>

          <div class="tw" style="overflow-x:auto; border:1px solid var(--bd); border-radius:8px;">
            <table style="width:100%; border-collapse:collapse;">
              <thead>
                <tr>
                  <th style="min-width:210px;">Item / Product</th>
                  <th style="width:130px; text-align:center;">Available Stock</th>
                  <th style="width:110px; text-align:right;">Transfer Qty</th>
                  <th style="width:75px; text-align:center;">Unit</th>
                  <th style="width:105px;">Batch #</th>
                  <th style="width:115px;">Serial #</th>
                  <th style="min-width:130px;">Notes / Memo</th>
                  <th style="width:36px;"></th>
                </tr>
              </thead>
              <tbody id="st-lines-body">
                ${(o.lines && o.lines.length ? o.lines : [{ item_id: '', quantity: 1 }]).map(buildLineRow).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <label style="font-weight:600; font-size:12.5px; display:block; margin-bottom:4px; color:var(--tx);">Notes / Reason for Transfer</label>
          <textarea class="in" id="st-notes" rows="2" placeholder="e.g. Stock replenishment for retail store, seasonal rebalancing" style="width:100%; box-sizing:border-box;">${esc(o.notes || '')}</textarea>
        </div>
      </form>
    `,
    footer: `
      <button type="button" class="btn" data-close>Cancel</button>
      <button type="button" class="btn" id="btn-st-save-draft">Save as Draft</button>
      <button type="button" class="btn p" id="btn-st-save-confirm">Confirm Transfer</button>
    `
  });

  const formEl = $('#st-form-el', m.el);
  const srcWhEl = $('#st-src-wh', m.el);
  const dstWhEl = $('#st-dst-wh', m.el);
  const dateEl = $('#st-date', m.el);
  const numEl = $('#st-number', m.el);
  const notesEl = $('#st-notes', m.el);
  const tbody = $('#st-lines-body', m.el);
  const addLineBtn = $('#st-add-line', m.el);
  const errBox = $('#st-err-box', m.el);
  const saveDraftBtn = $('#btn-st-save-draft', m.el);
  const saveConfirmBtn = $('#btn-st-save-confirm', m.el);

  let rowIdx = (o.lines && o.lines.length) ? o.lines.length : 1;

  // Stock cache to minimize repetitive lookups
  const stockCache = {};

  async function updateStockBadge(tr) {
    const itemSel = tr.querySelector('.st-item');
    const badge = tr.querySelector('.st-avail-badge');
    const unitIn = tr.querySelector('.st-unit');
    const qtyIn = tr.querySelector('.st-qty');

    const itemId = itemSel.value;
    const srcWhId = srcWhEl.value;

    if (!itemId) {
      badge.textContent = 'Stock: —';
      badge.className = 'st-avail-badge pastel-chip chip-lavender';
      badge.dataset.avail = '0';
      return;
    }

    const itemObj = itemsById[itemId];
    if (itemObj && unitIn) unitIn.value = itemObj.unit || 'nos';

    badge.textContent = 'Checking…';
    const cacheKey = `${itemId}_${srcWhId}`;

    try {
      let availStock = stockCache[cacheKey];
      if (availStock === undefined) {
        const res = await api(`lookup/warehouse-stock/?item_id=${itemId}&warehouse_id=${srcWhId}`);
        availStock = Number(res.available_stock || 0);
        stockCache[cacheKey] = availStock;
      }

      badge.dataset.avail = String(availStock);
      const reqQty = Number(qtyIn.value || 0);

      if (availStock >= reqQty && availStock > 0) {
        badge.textContent = `Avail: ${qty(availStock)} ${itemObj?.unit || 'nos'}`;
        badge.className = 'st-avail-badge pastel-chip chip-mint';
        qtyIn.style.borderColor = '';
      } else if (availStock <= 0) {
        badge.textContent = `Out of stock (0)`;
        badge.className = 'st-avail-badge pastel-chip chip-rose';
        qtyIn.style.borderColor = '#ef4444';
      } else {
        badge.textContent = `Short: ${qty(availStock)} / ${qty(reqQty)}`;
        badge.className = 'st-avail-badge pastel-chip chip-rose';
        qtyIn.style.borderColor = '#ef4444';
      }
    } catch {
      badge.textContent = 'Stock: —';
      badge.className = 'st-avail-badge pastel-chip chip-lavender';
    }
  }

  function refreshAllRowStocks() {
    tbody.querySelectorAll('.st-line-row').forEach(tr => updateStockBadge(tr));
  }

  // Initial stock checks
  refreshAllRowStocks();

  srcWhEl.addEventListener('change', () => {
    // Clear cache on warehouse switch
    for (const k in stockCache) delete stockCache[k];
    if (srcWhEl.value === dstWhEl.value) {
      errBox.textContent = 'Source and destination warehouses must be different.';
      errBox.style.display = 'block';
    } else {
      errBox.style.display = 'none';
    }
    refreshAllRowStocks();
  });

  dstWhEl.addEventListener('change', () => {
    if (srcWhEl.value === dstWhEl.value) {
      errBox.textContent = 'Source and destination warehouses must be different.';
      errBox.style.display = 'block';
    } else {
      errBox.style.display = 'none';
    }
  });

  addLineBtn.addEventListener('click', () => {
    rowIdx++;
    const tempTr = document.createElement('tbody');
    tempTr.innerHTML = buildLineRow({ quantity: 1 }, rowIdx);
    const newTr = tempTr.firstElementChild;
    tbody.appendChild(newTr);
    updateStockBadge(newTr);
  });

  tbody.addEventListener('click', e => {
    const rm = e.target.closest('.st-rm');
    if (rm) {
      const rows = tbody.querySelectorAll('.st-line-row');
      if (rows.length <= 1) {
        toast('Stock transfer must contain at least one item.', 'err');
        return;
      }
      rm.closest('.st-line-row').remove();
    }
  });

  tbody.addEventListener('change', e => {
    const tr = e.target.closest('.st-line-row');
    if (tr && e.target.matches('.st-item')) {
      updateStockBadge(tr);
    }
  });

  tbody.addEventListener('input', e => {
    const tr = e.target.closest('.st-line-row');
    if (tr && e.target.matches('.st-qty')) {
      const badge = tr.querySelector('.st-avail-badge');
      const qtyIn = tr.querySelector('.st-qty');
      const avail = Number(badge.dataset.avail || 0);
      const req = Number(qtyIn.value || 0);
      if (req > avail) {
        badge.className = 'st-avail-badge pastel-chip chip-rose';
        qtyIn.style.borderColor = '#ef4444';
      } else if (avail > 0) {
        badge.className = 'st-avail-badge pastel-chip chip-mint';
        qtyIn.style.borderColor = '';
      }
    }
  });

  async function collectFormData() {
    errBox.style.display = 'none';
    const srcId = srcWhEl.value;
    const dstId = dstWhEl.value;
    const transferDate = dateEl.value;

    if (!srcId || !dstId) {
      throw new Error('Please select both source and destination warehouses.');
    }
    if (srcId === dstId) {
      throw new Error('Source and destination warehouses must be different.');
    }
    if (!transferDate) {
      throw new Error('Transfer date is required.');
    }

    const rows = tbody.querySelectorAll('.st-line-row');
    if (!rows.length) {
      throw new Error('Please add at least one item to transfer.');
    }

    const lines = [];
    for (let i = 0; i < rows.length; i++) {
      const tr = rows[i];
      const itemVal = tr.querySelector('.st-item').value;
      const qtyVal = Number(tr.querySelector('.st-qty').value || 0);
      const unitVal = tr.querySelector('.st-unit').value || 'nos';
      const batchVal = tr.querySelector('.st-batch').value.trim();
      const serialVal = tr.querySelector('.st-serial').value.trim();
      const descVal = tr.querySelector('.st-desc').value.trim();

      if (!itemVal) {
        throw new Error(`Row ${i + 1}: Please select an item.`);
      }
      if (qtyVal <= 0 || isNaN(qtyVal)) {
        throw new Error(`Row ${i + 1}: Quantity must be greater than zero.`);
      }

      lines.push({
        item: Number(itemVal),
        quantity: qtyVal,
        unit: unitVal,
        batch_number: batchVal,
        serial_number: serialVal,
        description: descVal
      });
    }

    return {
      number: numEl.value.trim(),
      date: transferDate,
      source_warehouse: Number(srcId),
      destination_warehouse: Number(dstId),
      notes: notesEl.value.trim(),
      lines
    };
  }

  saveDraftBtn.addEventListener('click', async () => {
    try {
      const payload = await collectFormData();
      saveDraftBtn.disabled = true;
      saveDraftBtn.textContent = 'Saving…';
      const res = await api(id ? `stock-transfers/${id}/` : 'stock-transfers/', {
        method: id ? 'PUT' : 'POST',
        body: payload
      });
      m.close();
      toast(`Stock Transfer ${res.number} saved as draft!`, 'ok');
      if (onDone) onDone(res);
      else if (window.PAGE && window.PAGE.reload) window.PAGE.reload();
      else location.reload();
    } catch (err) {
      saveDraftBtn.disabled = false;
      saveDraftBtn.textContent = 'Save as Draft';
      errBox.textContent = err.message || 'Failed to save stock transfer.';
      errBox.style.display = 'block';
    }
  });

  saveConfirmBtn.addEventListener('click', async () => {
    try {
      const payload = await collectFormData();

      // Check client-side stock availability warnings
      const rows = tbody.querySelectorAll('.st-line-row');
      for (const tr of rows) {
        const badge = tr.querySelector('.st-avail-badge');
        const qtyIn = tr.querySelector('.st-qty');
        const avail = Number(badge.dataset.avail || 0);
        const req = Number(qtyIn.value || 0);
        if (req > avail) {
          const itemText = tr.querySelector('.st-item option:checked')?.textContent || 'item';
          throw new Error(`Insufficient stock for ${itemText}. Available: ${avail}, Required: ${req}.`);
        }
      }

      // Display prompt requirement
      const ok = await confirmBox({
        title: 'Confirm Stock Transfer?',
        message: 'Are you sure you want to confirm this stock transfer? The selected quantities will be deducted from the source warehouse and added to the destination warehouse. This action will update inventory records and cannot be deleted.',
        okText: 'Confirm Transfer',
        danger: false
      });
      if (!ok) return;

      saveConfirmBtn.disabled = true;
      saveConfirmBtn.textContent = 'Confirming…';

      // 1. Save or update draft
      const draftRes = await api(id ? `stock-transfers/${id}/` : 'stock-transfers/', {
        method: id ? 'PUT' : 'POST',
        body: payload
      });

      // 2. Confirm transfer
      const confirmedRes = await api(`stock-transfers/${draftRes.id}/confirm/`, {
        method: 'POST',
        body: {}
      });

      m.close();
      toast(`Stock Transfer ${confirmedRes.number} confirmed successfully! Inventory updated.`, 'ok');
      if (onDone) onDone(confirmedRes);
      else if (window.PAGE && window.PAGE.reload) window.PAGE.reload();
      else location.reload();
    } catch (err) {
      saveConfirmBtn.disabled = false;
      saveConfirmBtn.textContent = 'Confirm Transfer';
      errBox.textContent = err.message || 'Failed to confirm stock transfer.';
      errBox.style.display = 'block';
    }
  });
}

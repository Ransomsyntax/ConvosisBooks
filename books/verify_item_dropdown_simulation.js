// Node simulation of DOM, forms.js quick create, and Modal lifecycle
const assert = require('assert');

// Minimal mock DOM
class MockElement {
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase();
    this.options = [];
    this.selectedIndex = 0;
    this._value = '';
    this.dataset = {};
    this.classList = new Set();
    this.style = {};
    this._events = {};
    this.parentElement = null;
    this.parentNode = null;
    this.children = [];
  }

  get value() {
    return this._value;
  }

  set value(v) {
    this._value = String(v);
    const idx = this.options.findIndex(o => String(o.value) === String(v));
    if (idx >= 0) this.selectedIndex = idx;
  }

  addEventListener(evt, fn) {
    if (!this._events[evt]) this._events[evt] = [];
    this._events[evt].push(fn);
  }

  dispatchEvent(event) {
    event.target = this;
    const handlers = this._events[event.type] || [];
    for (const h of handlers) h(event);
    if (event.bubbles && this.parentElement) {
      this.parentElement.dispatchEvent(event);
    }
  }

  closest(sel) {
    let cur = this;
    while (cur) {
      if (sel === 'form' && cur.tagName === 'FORM') return cur;
      if (sel === 'tr' && cur.tagName === 'TR') return cur;
      cur = cur.parentElement;
    }
    return null;
  }

  querySelector(sel) {
    for (const c of this.children) {
      if (c.matches && c.matches(sel)) return c;
      const found = c.querySelector && c.querySelector(sel);
      if (found) return found;
    }
    return null;
  }

  querySelectorAll(sel) {
    let res = [];
    for (const c of this.children) {
      if (c.matches && c.matches(sel)) res.push(c);
      if (c.querySelectorAll) res = res.concat(c.querySelectorAll(sel));
    }
    return res;
  }

  matches(sel) {
    if (sel.startsWith('.') && this.classList.has(sel.slice(1))) return true;
    if (sel.toLowerCase() === this.tagName.toLowerCase()) return true;
    return false;
  }

  appendChild(el) {
    el.parentElement = this;
    el.parentNode = this;
    this.children.push(el);
    if (this.tagName === 'SELECT' && el.tagName === 'OPTION') {
      this.options.push(el);
    }
  }
}

// Mock Modal implementation mirroring forms.js
let activeModal = null;
const MockModal = {
  open: ({ title, body, onClose }) => {
    const m = {
      title,
      onClose,
      closed: false,
      close: () => {
        if (m.closed) return;
        m.closed = true;
        activeModal = null;
        if (onClose) onClose();
      }
    };
    activeModal = m;
    return m;
  }
};

// Mock itemForm mirroring forms.js
let itemFormOpenCount = 0;
async function mockItemForm(id, onDone, onCancel) {
  if (mockItemForm._opening) return;
  mockItemForm._opening = true;
  itemFormOpenCount++;
  let itemSaved = false;

  const m = MockModal.open({
    title: 'New Item',
    dialog: Boolean(onDone),
    onClose: () => {
      mockItemForm._opening = false;
      if (!itemSaved && typeof onCancel === 'function') {
        try { onCancel(); } catch (e) {}
      }
    }
  });

  return {
    modal: m,
    save: (newItemData) => {
      itemSaved = true;
      mockItemForm._opening = false;
      m.close();
      if (onDone) onDone(newItemData);
    },
    cancel: () => {
      m.close();
    }
  };
}

// Mock handleQuickCreateSelect mirroring forms.js
async function mockHandleQuickCreateSelect(selectEl, customCallback, customCancelCallback) {
  if (!selectEl || selectEl._quickCreating) return false;
  const val = selectEl.value;
  const opt = selectEl.options[selectEl.selectedIndex];
  const optText = opt ? opt.text.trim().toLowerCase() : '';

  let entity = null;
  if (val === '__new_item__' || optText.includes('add new item')) entity = 'item';
  if (!entity) return false;

  selectEl._quickCreating = true;
  let prevVal = selectEl.dataset.prevVal || '';
  if (prevVal.startsWith('__new_') || prevVal === '__add_new__') {
    prevVal = '';
  }
  selectEl.value = prevVal;
  selectEl.dataset.prevVal = prevVal;

  const onCancel = () => {
    selectEl._quickCreating = false;
    selectEl.value = prevVal;
    selectEl.dataset.prevVal = prevVal;
    if (typeof customCancelCallback === 'function') {
      try { customCancelCallback(); } catch (e) {}
    }
  };

  const onCreated = (newRecord) => {
    selectEl._quickCreating = false;
    if (!newRecord) {
      onCancel();
      return;
    }
    const optNew = new MockElement('option');
    optNew.value = newRecord.id;
    optNew.text = newRecord.name;
    selectEl.appendChild(optNew);
    selectEl.value = newRecord.id;
    selectEl.dataset.prevVal = newRecord.id;

    if (customCallback) customCallback(newRecord);
  };

  return mockItemForm(null, onCreated, onCancel);
}

// RUN TESTS
async function runTests() {
  console.log("Starting Item Table Quick Create Lifecycle Tests...");

  // Setup test select element
  const select = new MockElement('select');
  select.name = 'item';
  select.classList.add('l-item');

  const optEmpty = new MockElement('option');
  optEmpty.value = '';
  optEmpty.text = 'Type or click to select an item.';
  select.appendChild(optEmpty);

  const optNew = new MockElement('option');
  optNew.value = '__new_item__';
  optNew.text = '+ Add New Item…';
  select.appendChild(optNew);

  const opt1 = new MockElement('option');
  opt1.value = '101';
  opt1.text = 'Widget A';
  select.appendChild(opt1);

  const opt2 = new MockElement('option');
  opt2.value = '102';
  opt2.text = 'Widget B';
  select.appendChild(opt2);

  // ----------------------------------------------------
  // TEST A: Repeated Cancel (5+ consecutive cancellations)
  // ----------------------------------------------------
  console.log("\n--- TEST A: Repeated Cancel (6 consecutive cancel cycles) ---");
  for (let cycle = 1; cycle <= 6; cycle++) {
    select.value = '__new_item__';
    const formCtrl = await mockHandleQuickCreateSelect(select);
    assert.strictEqual(typeof formCtrl, 'object', `Cycle ${cycle}: formCtrl must be returned`);
    assert.strictEqual(select.value, '', `Cycle ${cycle}: select value should immediately reset to neutral`);
    assert.strictEqual(select._quickCreating, true, `Cycle ${cycle}: select should be in quickCreating state while form is open`);
    assert.strictEqual(mockItemForm._opening, true, `Cycle ${cycle}: itemForm._opening must be true`);

    // User closes without saving
    formCtrl.cancel();
    assert.strictEqual(select._quickCreating, false, `Cycle ${cycle}: select._quickCreating must reset to false after cancel`);
    assert.strictEqual(select.value, '', `Cycle ${cycle}: select.value must be reset to neutral`);
    assert.strictEqual(mockItemForm._opening, false, `Cycle ${cycle}: itemForm._opening must be false after cancel`);
    console.log(`  Cycle ${cycle}: OK (Form opened and cancelled cleanly)`);
  }
  assert.strictEqual(itemFormOpenCount, 6, "Must have opened form exactly 6 times");

  // ----------------------------------------------------
  // TEST B: Existing Item Switching & Cancel
  // ----------------------------------------------------
  console.log("\n--- TEST B: Existing Item Switching & Cancel ---");
  // 1. Select existing item 101
  select.value = '101';
  select.dataset.prevVal = '101';
  assert.strictEqual(select.value, '101');

  // 2. Select existing item 102
  select.value = '102';
  select.dataset.prevVal = '102';
  assert.strictEqual(select.value, '102');

  // 3. Select + Add New Item...
  select.value = '__new_item__';
  let formCtrlB = await mockHandleQuickCreateSelect(select);
  assert.strictEqual(select.value, '102', "Dropdown must retain previous selection '102'");
  assert.strictEqual(select._quickCreating, true);

  // 4. Cancel
  formCtrlB.cancel();
  assert.strictEqual(select._quickCreating, false, "quickCreating must be false");
  assert.strictEqual(select.value, '102', "Dropdown must remain on '102' after cancel");
  console.log("  Step 4: Cancelled - existing item 102 preserved intact");

  // 5. Select + Add New Item... again
  select.value = '__new_item__';
  formCtrlB = await mockHandleQuickCreateSelect(select);
  assert.ok(formCtrlB, "Form must open again on second attempt");
  formCtrlB.cancel();
  assert.strictEqual(select.value, '102');
  console.log("  Step 5: Reopened + Add New Item and cancelled cleanly");

  // ----------------------------------------------------
  // TEST C: Save New Item
  // ----------------------------------------------------
  console.log("\n--- TEST C: Save New Item ---");
  select.value = '__new_item__';
  let savedRecord = null;
  const formCtrlC = await mockHandleQuickCreateSelect(select, (rec) => {
    savedRecord = rec;
  });

  assert.ok(formCtrlC, "Form opened for creation");
  formCtrlC.save({ id: '201', name: 'Brand New Item' });

  assert.strictEqual(select._quickCreating, false, "quickCreating should reset on save");
  assert.strictEqual(select.value, '201', "select value should update to newly created item id");
  assert.strictEqual(select.dataset.prevVal, '201', "dataset.prevVal should update to newly created item id");
  assert.ok(savedRecord, "customCallback should be invoked with saved record");
  assert.strictEqual(savedRecord.id, '201');
  console.log("  Saved item '201' - dropdown value and options updated successfully");

  // Reopen after save:
  select.value = '__new_item__';
  const formCtrlC2 = await mockHandleQuickCreateSelect(select);
  assert.ok(formCtrlC2, "Form opens again after previous save");
  formCtrlC2.cancel();
  assert.strictEqual(select.value, '201', "Value restored to previously saved item '201'");
  console.log("  Reopened and cancelled after save - works as expected");

  console.log("\n>>> ALL TESTS PASSED SUCCESSFULLY! <<<\n");
}

runTests();

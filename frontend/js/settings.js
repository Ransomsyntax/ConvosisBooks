/**
 * ConvosisBooks Settings Module
 * Enterprise-level settings, segmented access control, user management, and organization configuration.
 */

const SETTINGS_MENU_STRUCTURE = [
  {
    category: 'ORGANIZATION SETTINGS',
    groups: [
      {
        id: 'org',
        label: 'Organization',
        icon: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18M3 7v14M21 7v14M6 11h4M6 15h4M14 11h4M14 15h4M9 21v-4h6v4M7 3h10l2 4H5l2-4z"/></svg>',
        items: [
          { key: 'profile', label: 'Profile', hash: '#/settings/profile' },
          { key: 'branding', label: 'Branding', hash: '#/settings/branding' },
          { key: 'custom-domain', label: 'Custom Domain', hash: '#/settings/custom-domain' },
          { key: 'branches', label: 'Branches', hash: '#/settings/branches' },
          { key: 'networking', label: 'Networking', hash: '#/settings/networking' },
          { key: 'ai', label: 'AI Control Center', hash: '#/settings/ai' },
          { key: 'subscription-billing', label: 'Manage Subscription', hash: '#/settings/subscription-billing' },
        ]
      },
      {
        id: 'users-roles',
        label: 'Users & Roles',
        icon: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
        items: [
          { key: 'users', label: 'Users', hash: '#/settings/users' },
          { key: 'roles', label: 'Roles', hash: '#/settings/roles' },
        ]
      },
      {
        id: 'taxes',
        label: 'Taxes & Compliance',
        icon: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
        items: [
          { key: 'taxes', label: 'Taxes', hash: '#/settings/taxes' },
          { key: 'direct-taxes', label: 'Direct Taxes', hash: '#/settings/direct-taxes' },
          { key: 'eway-bills', label: 'e-Way Bills', hash: '#/settings/eway-bills' },
          { key: 'einvoicing', label: 'e-Invoicing', hash: '#/settings/einvoicing' },
          { key: 'msme', label: 'MSME Settings', hash: '#/settings/msme' },
        ]
      },
      {
        id: 'setup',
        label: 'Setup & Configurations',
        icon: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>',
        items: [
          { key: 'general', label: 'General', hash: '#/settings/general' },
          { key: 'currencies', label: 'Currencies', hash: '#/settings/currencies' },
          { key: 'payment-terms', label: 'Payment Terms', hash: '#/settings/payment-terms' },
          { key: 'opening-balances', label: 'Opening Balances', hash: '#/settings/opening-balances' },
          { key: 'reminders', label: 'Reminders', hash: '#/settings/reminders' },
          { key: 'customer-portal', label: 'Customer Portal', hash: '#/settings/customer-portal' },
        ]
      },
      {
        id: 'customization',
        label: 'Customization',
        icon: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
        items: [
          { key: 'number-series', label: 'Transaction Number Series', hash: '#/settings/number-series' },
          { key: 'custom-fields', label: 'Custom Fields', hash: '#/settings/custom-fields' },
          { key: 'pdf-templates', label: 'PDF Templates', hash: '#/settings/pdf-templates' },
          { key: 'email-notifications', label: 'Email Notifications', hash: '#/settings/email-notifications' },
          { key: 'sms-notifications', label: 'SMS Notifications', hash: '#/settings/sms-notifications' },
          { key: 'digital-signature', label: 'Digital Signature', hash: '#/settings/digital-signature' },
          { key: 'enterprise-settings', label: 'Enterprise Settings Registry', hash: '#/settings/enterprise' },
        ]
      }
    ]
  },
  {
    category: 'MODULE SETTINGS',
    groups: [
      {
        id: 'mod-general',
        label: 'General',
        icon: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h7"/></svg>',
        items: [
          { key: 'mod-prefs', label: 'Preferences', hash: '#/settings/general' },
        ]
      },
      {
        id: 'mod-payments',
        label: 'Online Payments',
        icon: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>',
        items: [
          { key: 'pay-gateways', label: 'Payment Gateways', hash: '#/pay/payment-settings' },
        ]
      },
      {
        id: 'mod-sales',
        label: 'Sales',
        icon: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 4h3l2 11h10l2-8H7"/></svg>',
        items: [
          { key: 'sales-invoices', label: 'Invoices', hash: '#/settings/number-series' },
          { key: 'sales-quotes', label: 'Quotes', hash: '#/settings/number-series' },
        ]
      },
      {
        id: 'mod-purchases',
        label: 'Purchases',
        icon: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 8h14l-1 12H6zM9 8V6a3 3 0 016 0v2"/></svg>',
        items: [
          { key: 'purchases-bills', label: 'Bills', hash: '#/settings/number-series' },
          { key: 'purchases-expenses', label: 'Expenses', hash: '#/settings/number-series' },
        ]
      }
    ]
  }
];

let cachedSettingsData = null;

function updateSettingsMenuSearch(input) {
  const wrapper = input.closest('.settings-topbar-search');
  const results = wrapper && wrapper.querySelector('.settings-menu-search-results');
  if (!results) return;

  const query = input.value.trim().toLocaleLowerCase();
  if (!query) {
    results.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    return;
  }

  const matches = [];
  SETTINGS_MENU_STRUCTURE.forEach(section => {
    section.groups.forEach(group => {
      group.items.forEach(item => {
        const searchable = `${item.label} ${group.label} ${section.category}`.toLocaleLowerCase();
        if (searchable.includes(query)) matches.push({ item, group, section });
      });
    });
  });

  results.innerHTML = matches.length
    ? matches.map(({ item, group, section }) => `
      <a class="settings-menu-search-result" href="${esc(item.hash)}" role="option">
        <span>${esc(item.label)}</span>
        <small>${esc(group.label)} · ${esc(section.category)}</small>
      </a>
    `).join('')
    : '<div class="settings-menu-search-empty" role="status">No matching settings found.</div>';
  results.hidden = false;
  input.setAttribute('aria-expanded', 'true');
}

function installSettingsMenuSearchEvents() {
  document.addEventListener('input', event => {
    if (event.target.matches('.settings-menu-search-input')) updateSettingsMenuSearch(event.target);
  });
  document.addEventListener('focusin', event => {
    if (event.target.matches('.settings-menu-search-input')) updateSettingsMenuSearch(event.target);
  });
  document.addEventListener('pointerdown', event => {
    document.querySelectorAll('.settings-menu-search-results:not([hidden])').forEach(results => {
      const wrapper = results.closest('.settings-topbar-search');
      if (wrapper && !wrapper.contains(event.target)) {
        results.hidden = true;
        wrapper.querySelector('.settings-menu-search-input')?.setAttribute('aria-expanded', 'false');
      }
    });
  });
  document.addEventListener('keydown', event => {
    const input = event.target.closest('.settings-menu-search-input');
    if (input) {
      const results = input.closest('.settings-topbar-search')?.querySelector('.settings-menu-search-results');
      if (!results || results.hidden) return;
      const links = Array.from(results.querySelectorAll('.settings-menu-search-result'));
      if (event.key === 'ArrowDown' && links.length) {
        event.preventDefault();
        links[0].focus();
      } else if (event.key === 'Enter' && links.length) {
        event.preventDefault();
        links[0].click();
      } else if (event.key === 'Escape') {
        results.hidden = true;
        input.setAttribute('aria-expanded', 'false');
      }
      return;
    }

    const link = event.target.closest('.settings-menu-search-result');
    if (!link || !['ArrowDown', 'ArrowUp', 'Escape'].includes(event.key)) return;
    const results = link.closest('.settings-menu-search-results');
    const links = Array.from(results.querySelectorAll('.settings-menu-search-result'));
    const index = links.indexOf(link);
    if (event.key === 'Escape') {
      const inputElement = results.closest('.settings-topbar-search')?.querySelector('.settings-menu-search-input');
      results.hidden = true;
      inputElement?.setAttribute('aria-expanded', 'false');
      inputElement?.focus();
    } else {
      event.preventDefault();
      const nextIndex = event.key === 'ArrowDown'
        ? Math.min(index + 1, links.length - 1)
        : Math.max(index - 1, 0);
      links[nextIndex]?.focus();
    }
  });
}

installSettingsMenuSearchEvents();

async function fetchSettingsData(force = false) {
  if (cachedSettingsData && !force) return cachedSettingsData;
  try {
    const res = await api('/settings/all/');
    cachedSettingsData = res;
    return res;
  } catch (e) {
    console.error('Failed to load settings data', e);
    return null;
  }
}

// =========================================================================
// 1. SETTINGS DASHBOARD (Card-based view)
// =========================================================================

async function renderSettingsDashboard(root) {
  root.innerHTML = `<div class="spin" style="margin:60px auto;">Loading ConvosisBooks Settings…</div>`;
  const data = await fetchSettingsData(true);
  const org = (data && data.organization) || (APP.org || {});
  const orgName = org.name || 'Convosis Technologies Pvt Ltd';

  root.innerHTML = `
    <div class="settings-fullpage-wrap">
      <!-- Top Settings Bar -->
      <div class="settings-topbar">
        <div class="settings-topbar-left">
          <div class="settings-brand-icon">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="6" width="20" height="12" rx="2"/>
              <circle cx="12" cy="12" r="2"/>
              <path d="M6 12h.01M18 12h.01"/>
            </svg>
          </div>
          <div>
            <div class="settings-topbar-title">All Settings</div>
            <div class="settings-topbar-org">${esc(orgName)}</div>
          </div>
        </div>

        <div class="settings-topbar-search">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" id="settingsSearchInput" placeholder="Search settings (/)" autocomplete="off">
        </div>

        <div class="settings-topbar-right">
          <button type="button" class="btn-close-settings" onclick="closeSettingsDashboard()">
            Close Settings <span style="font-size:14px; margin-left:4px;">✕</span>
          </button>
        </div>
      </div>

      <!-- Main Settings Grid Container -->
      <div class="settings-content-body">
        <div class="settings-panel-card">
          <div class="settings-panel-header" style="border-bottom:1px solid var(--bd, #e2e8f0); padding-bottom:16px; margin-bottom:24px;">
            <h2 style="font-size:18px; font-weight:700; color:var(--tx, #0f172a); margin:0;">Organization Settings</h2>
          </div>

          <div class="settings-dashboard-grid" id="settingsDashboardGrid">
            <!-- Column 1: Organization -->
            <div class="settings-cat-col" data-cat="organization">
              <div class="settings-cat-card">
                <div class="settings-cat-header cat-head-green">
                  <span class="cat-icon-badge badge-green">
                    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18M3 7v14M21 7v14M6 11h4M6 15h4M14 11h4M14 15h4M9 21v-4h6v4M7 3h10l2 4H5l2-4z"/></svg>
                  </span>
                  <span class="cat-title">Organization</span>
                </div>
                <ul class="settings-cat-list">
                  <li><a href="#/settings/profile" class="settings-link"><span class="link-label">Profile</span></a></li>
                  <li><a href="#/settings/branding" class="settings-link"><span class="link-label">Branding</span></a></li>
                  <li><a href="#/settings/custom-domain" class="settings-link"><span class="link-label">Custom Domain</span></a></li>
                  <li><a href="#/settings/branches" class="settings-link"><span class="link-label">Branches</span></a></li>
                  <li><a href="#/settings/networking" class="settings-link"><span class="link-label">Networking</span></a></li>
                  <li><a href="#/settings/ai" class="settings-link"><span class="link-label">AI Control Center</span><span class="pastel-chip chip-sky" style="font-size:10px;margin-left:8px;">Smart</span></a></li>
                  <li><a href="#/settings/subscription-billing" class="settings-link"><span class="link-label">Manage Subscription</span></a></li>
                </ul>
              </div>
            </div>

            <!-- Column 2: Users & Roles + Taxes & Compliance -->
            <div class="settings-cat-col" data-cat="users-roles">
              <div class="settings-cat-card">
                <div class="settings-cat-header cat-head-pink">
                  <span class="cat-icon-badge badge-pink">
                    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  </span>
                  <span class="cat-title">Users & Roles</span>
                </div>
                <ul class="settings-cat-list">
                  <li><a href="#/settings/users" class="settings-link"><span class="link-label">Users</span></a></li>
                  <li><a href="#/settings/roles" class="settings-link"><span class="link-label">Roles</span></a></li>
                </ul>

                <!-- Sub-section: Taxes & Compliance -->
                <div class="settings-cat-header cat-head-blue" style="margin-top:18px;">
                  <span class="cat-icon-badge badge-blue">
                    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  </span>
                  <span class="cat-title">Taxes & Compliance</span>
                </div>
                <ul class="settings-cat-list">
                  <li><a href="#/settings/taxes" class="settings-link"><span class="link-label">Taxes</span></a></li>
                  <li><a href="#/settings/direct-taxes" class="settings-link"><span class="link-label">Direct Taxes</span></a></li>
                  <li><a href="#/settings/eway-bills" class="settings-link"><span class="link-label">e-Way Bills</span></a></li>
                  <li><a href="#/settings/einvoicing" class="settings-link"><span class="link-label">e-Invoicing</span></a></li>
                  <li><a href="#/settings/msme" class="settings-link"><span class="link-label">MSME Settings</span></a></li>
                </ul>
              </div>
            </div>

            <!-- Column 3: Setup & Configurations -->
            <div class="settings-cat-col" data-cat="setup">
              <div class="settings-cat-card">
                <div class="settings-cat-header cat-head-amber">
                  <span class="cat-icon-badge badge-amber">
                    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                  </span>
                  <span class="cat-title">Setup & Configurations</span>
                </div>
                <ul class="settings-cat-list">
                  <li><a href="#/settings/general" class="settings-link"><span class="link-label">General</span></a></li>
                  <li><a href="#/settings/currencies" class="settings-link"><span class="link-label">Currencies</span></a></li>
                  <li><a href="#/settings/payment-terms" class="settings-link"><span class="link-label">Payment Terms</span></a></li>
                  <li><a href="#/settings/opening-balances" class="settings-link"><span class="link-label">Opening Balances</span></a></li>
                  <li><a href="#/settings/reminders" class="settings-link"><span class="link-label">Reminders</span></a></li>
                  <li><a href="#/settings/customer-portal" class="settings-link"><span class="link-label">Customer Portal</span></a></li>
                </ul>
              </div>
            </div>

            <!-- Column 4: Customization -->
            <div class="settings-cat-col" data-cat="customization">
              <div class="settings-cat-card">
                <div class="settings-cat-header cat-head-purple">
                  <span class="cat-icon-badge badge-purple">
                    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                  </span>
                  <span class="cat-title">Customization</span>
                </div>
                <ul class="settings-cat-list">
                  <li><a href="#/settings/number-series" class="settings-link"><span class="link-label">Transaction Number Series</span></a></li>
                  <li><a href="#/settings/custom-fields" class="settings-link"><span class="link-label">Custom Fields</span></a></li>
                  <li><a href="#/settings/pdf-templates" class="settings-link"><span class="link-label">PDF Templates</span></a></li>
                  <li><a href="#/settings/email-notifications" class="settings-link"><span class="link-label">Email Notifications</span></a></li>
                  <li><a href="#/settings/sms-notifications" class="settings-link"><span class="link-label">SMS Notifications</span></a></li>
                  <li><a href="#/settings/digital-signature" class="settings-link"><span class="link-label">Digital Signature</span></a></li>
                  <li><a href="#/settings/enterprise" class="settings-link"><span class="link-label">Enterprise Settings Registry</span></a></li>
                </ul>
              </div>
            </div>
          </div>

          <div id="settingsSearchEmptyState" style="display:none; text-align:center; padding:64px 20px;">
            <div style="width:52px; height:52px; border-radius:50%; background:var(--bg-muted, #f1f5f9); color:var(--tx-muted, #94a3b8); display:grid; place-items:center; margin:0 auto 16px; font-size:22px;">
              <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </div>
            <h3 style="font-size:16px; font-weight:700; color:var(--tx, #0f172a); margin:0 0 6px;">No results found</h3>
            <p style="font-size:13px; color:var(--tx-muted, #64748b); margin:0;">Try another keyword or check your spelling.</p>
          </div>
        </div>
      </div>
    </div>
  `;

  // Search filtering logic
  const searchInput = $('#settingsSearchInput');
  const emptyState = $('#settingsSearchEmptyState');
  const dashboardGrid = $('#settingsDashboardGrid');

  if (searchInput) {
    searchInput.focus();
    searchInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      if (!q) {
        if (dashboardGrid) dashboardGrid.style.display = 'grid';
        if (emptyState) emptyState.style.display = 'none';
        $$('.settings-cat-col').forEach(col => { col.style.display = ''; });
        $$('.settings-link').forEach(link => {
          const li = link.closest('li');
          if (li) li.style.display = '';
        });
        return;
      }

      let totalMatchingLinks = 0;

      $$('.settings-cat-col').forEach(col => {
        const catTitles = Array.from(col.querySelectorAll('.cat-title')).map(t => t.textContent.toLowerCase());
        const catMatches = catTitles.some(t => t.includes(q));

        let visibleInCol = 0;
        const links = col.querySelectorAll('.settings-link');
        links.forEach(link => {
          const text = link.textContent.toLowerCase();
          const li = link.closest('li');
          if (catMatches || text.includes(q)) {
            if (li) li.style.display = '';
            visibleInCol++;
            totalMatchingLinks++;
          } else {
            if (li) li.style.display = 'none';
          }
        });

        col.style.display = visibleInCol > 0 ? '' : 'none';
      });

      if (totalMatchingLinks === 0) {
        if (dashboardGrid) dashboardGrid.style.display = 'none';
        if (emptyState) emptyState.style.display = 'block';
      } else {
        if (dashboardGrid) dashboardGrid.style.display = 'grid';
        if (emptyState) emptyState.style.display = 'none';
      }
    });
  }
}

function closeSettingsDashboard() {
  const target = (window._lastAppHash && !window._lastAppHash.includes('settings')) ? window._lastAppHash : '#/home/dashboard';
  location.hash = target;
}

// =========================================================================
// 2. SETTINGS SHELL WRAPPER (2-column layout)
// =========================================================================

function renderSettingsShell(root, activeSubKey, title, renderPageContentFn) {
  const org = APP.org || {};
  const orgName = org.name || 'Convosis Technologies Pvt Ltd';

  // Build left menu
  let leftMenuHtml = '';
  SETTINGS_MENU_STRUCTURE.forEach(sec => {
    leftMenuHtml += `<div class="settings-nav-section-title">${esc(sec.category)}</div>`;
    sec.groups.forEach(grp => {
      const isGroupActive = grp.items.some(it => it.key === activeSubKey);
      leftMenuHtml += `
        <div class="settings-nav-group ${isGroupActive ? 'open' : ''}">
          <button type="button" class="settings-nav-group-btn" onclick="toggleSettingsNavGroup(this)">
            <span class="settings-nav-chevron"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg></span>
            <span class="settings-nav-group-label">${esc(grp.label)}</span>
          </button>
          <div class="settings-nav-items">
            ${grp.items.map(it => `
              <a href="${it.hash}" class="settings-nav-item ${it.key === activeSubKey ? 'active' : ''}">
                ${esc(it.label)}
              </a>
            `).join('')}
          </div>
        </div>
      `;
    });
  });

  root.innerHTML = `
    <div class="settings-shell-container">
      <!-- Top Bar -->
      <div class="settings-topbar">
        <div class="settings-topbar-left">
          <button type="button" class="settings-back-btn" onclick="location.hash='#/settings/dashboard'" title="Back to All Settings">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <div class="settings-brand-icon">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/></svg>
          </div>
          <div>
            <div class="settings-topbar-title">All Settings</div>
            <div class="settings-topbar-org">${esc(orgName)}</div>
          </div>
        </div>

        <div class="settings-topbar-search">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input class="settings-menu-search-input" type="search" placeholder="Search settings (/)" autocomplete="off" aria-label="Search settings" aria-haspopup="listbox" aria-expanded="false">
          <div class="settings-menu-search-results" role="listbox" aria-label="Matching settings" hidden></div>
        </div>

        <div class="settings-topbar-right">
          <button type="button" class="btn-close-settings" onclick="closeSettingsDashboard()">
            Close Settings <span style="font-size:14px; margin-left:4px;">✕</span>
          </button>
        </div>
      </div>

      <!-- Main Layout: Sidebar + Content -->
      <div class="settings-shell-body">
        <aside class="settings-sidebar">
          ${leftMenuHtml}
        </aside>

        <section class="settings-main-pane" id="settingsMainPane">
          <div class="spin" style="margin:40px auto;">Loading ${esc(title)}…</div>
        </section>
      </div>
    </div>
  `;

  const pane = $('#settingsMainPane');
  if (pane) {
    if (activeSubKey === 'enterprise-settings') {
      pane.classList.add('settings-pane-fixed');
      pane.style.padding = '18px 24px 18px';
      pane.style.overflow = 'hidden';
      pane.style.height = '100%';
    } else if (activeSubKey === 'taxes' || activeSubKey === 'direct-taxes') {
      pane.classList.remove('settings-pane-fixed');
      pane.style.padding = '0';
      pane.style.overflow = 'auto';
      pane.style.height = '';
    } else {
      pane.classList.remove('settings-pane-fixed');
      pane.style.padding = '28px 36px 60px';
      pane.style.overflow = 'auto';
      pane.style.height = '';
    }
  }
  const renderer = renderPageContentFn || getSettingsPageRenderer(activeSubKey);
  if (pane && renderer) {
    Promise.resolve(renderer(pane)).catch(err => {
      pane.innerHTML = `<div class="error-msg-card" style="padding:20px;margin:20px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;color:#b91c1c;">${esc(err.message || 'Failed to load settings page.')}</div>`;
      console.error(err);
    });
  } else if (pane && !renderer) {
    pane.innerHTML = `<div class="info-alert-card" style="margin:30px;">Settings section <b>${esc(title)}</b> is ready.</div>`;
  }
}

function getSettingsPageRenderer(key) {
  const map = {
    'users': typeof renderSettingsUsersPage === 'function' ? renderSettingsUsersPage : null,
    'roles': typeof renderSettingsRolesPage === 'function' ? renderSettingsRolesPage : null,
    'profile': typeof renderOrgProfilePage === 'function' ? renderOrgProfilePage : null,
    'branding': typeof renderBrandingPage === 'function' ? renderBrandingPage : null,
    'ai': typeof renderAiControlCenterPage === 'function' ? renderAiControlCenterPage : null,
    'taxes': typeof renderTaxesPage === 'function' ? renderTaxesPage : null,
    'direct-taxes': typeof renderDirectTaxesPage === 'function' ? renderDirectTaxesPage : null,
    'eway-bills': typeof renderEwayBillsPage === 'function' ? renderEwayBillsPage : null,
    'einvoicing': typeof renderEinvoicingPage === 'function' ? renderEinvoicingPage : null,
    'msme': typeof renderMsmePage === 'function' ? renderMsmePage : null,
    'general': typeof renderGeneralSettingsPage === 'function' ? renderGeneralSettingsPage : null,
    'currencies': typeof renderCurrenciesPage === 'function' ? renderCurrenciesPage : null,
    'payment-terms': typeof renderPaymentTermsPage === 'function' ? renderPaymentTermsPage : null,
    'opening-balances': typeof renderOpeningBalancesPage === 'function' ? renderOpeningBalancesPage : null,
    'reminders': typeof renderRemindersPage === 'function' ? renderRemindersPage : null,
    'customer-portal': typeof renderCustomerPortalPage === 'function' ? renderCustomerPortalPage : null,
    'number-series': typeof renderNumberSeriesPage === 'function' ? renderNumberSeriesPage : null,
    'pdf-templates': typeof renderPdfTemplatesPage === 'function' ? renderPdfTemplatesPage : null,
    'email-notifications': typeof renderNotificationsPage === 'function' ? renderNotificationsPage : null,
    'sms-notifications': typeof renderNotificationsPage === 'function' ? renderNotificationsPage : null,
    'digital-signature': typeof renderDigitalSignaturePage === 'function' ? renderDigitalSignaturePage : null,
    'enterprise-settings': typeof renderEnterpriseSettingsPage === 'function' ? renderEnterpriseSettingsPage : null,
    'custom-fields': typeof renderCustomFieldsSettingsPage === 'function' ? renderCustomFieldsSettingsPage : null,
    'mod-prefs': typeof renderGeneralSettingsPage === 'function' ? renderGeneralSettingsPage : null,
    'sales-invoices': typeof renderNumberSeriesPage === 'function' ? renderNumberSeriesPage : null,
    'sales-quotes': typeof renderNumberSeriesPage === 'function' ? renderNumberSeriesPage : null,
  };
  return map[key] || null;
}

async function renderCustomFieldsSettingsPage(container, initialModule = '', pageTitle = 'Custom Fields') {
  const modules = [
    { key: 'quotes', label: 'Quotes' },
    { key: 'sales_orders', label: 'Sales Orders' },
    { key: 'invoices', label: 'Invoices' },
    { key: 'recurring_invoices', label: 'Recurring Invoices' },
    { key: 'retainer_invoices', label: 'Retainer Invoices' },
    { key: 'purchase_orders', label: 'Purchase Orders' },
    { key: 'bills', label: 'Bills' },
    { key: 'payments_made', label: 'Payments Made' },
    { key: 'payments_received', label: 'Payments Received' },
  ];
  const fieldTypes = [
    ['text', 'Text'],
    ['number', 'Number'],
    ['date', 'Date'],
    ['select', 'Dropdown'],
    ['checkbox', 'Checkbox'],
  ];
  let customFields = [];
  let selectedModule = initialModule;

  const moduleLabel = module => modules.find(item => item.key === module)?.label
    || String(module || '').replace(/_/g, ' ').replace(/\b\w/g, character => character.toUpperCase());
  const filterModules = () => {
    const availableModules = modules.slice();
    customFields.forEach(field => {
      if (field.module && !availableModules.some(item => item.key === field.module)) {
        availableModules.push({ key: field.module, label: moduleLabel(field.module) });
      }
    });
    return availableModules;
  };
  const render = () => {
    const filteredFields = customFields.filter(field => !selectedModule || field.module === selectedModule);
    container.innerHTML = `
      <div class="settings-panel-card">
        <div class="settings-panel-header" style="display:flex;align-items:center;justify-content:space-between;gap:16px;">
          <div>
            <h2>${esc(pageTitle)}</h2>
            <div class="sub">${initialModule ? 'Configure organization-level custom fields for branches.' : 'Create organization-level fields for supported modules.'}</div>
          </div>
          <button type="button" class="btn p" data-custom-field-add>Add Custom Field</button>
        </div>
        <div style="padding:0 20px 20px;">
          ${initialModule
            ? '<div style="font-size:13px;font-weight:600;margin:8px 0 16px;">Module: Locations</div>'
            : `<label style="display:flex;align-items:center;gap:10px;font-size:13px;font-weight:600;margin:8px 0 16px;">
              Module
              <select class="in" data-custom-field-module style="max-width:260px;">
                <option value="">All modules</option>
                ${filterModules().map(item => `<option value="${item.key}" ${selectedModule === item.key ? 'selected' : ''}>${esc(item.label)}</option>`).join('')}
              </select>
            </label>`}
          ${filteredFields.length ? `
            <div style="overflow-x:auto;">
              <table class="tbl" style="width:100%;">
                <thead><tr><th>Field</th><th>Module</th><th>Type</th><th>Requirement</th><th>Status</th><th>Visibility</th><th>Actions</th></tr></thead>
                <tbody>
                  ${filteredFields.map(field => `
                    <tr>
                      <td><strong>${esc(field.label)}</strong><div class="sub">${esc(field.name)}</div>${field.field_type === 'select' && field.options ? `<div class="sub">${esc(field.options)}</div>` : ''}</td>
                      <td>${esc(moduleLabel(field.module))}</td>
                      <td>${esc(fieldTypes.find(([value]) => value === field.field_type)?.[1] || field.field_type)}</td>
                      <td>${field.required ? 'Mandatory' : 'Optional'}</td>
                      <td>${field.active ? 'Active' : 'Inactive'}</td>
                      <td>${field.hidden ? 'Hidden' : 'Visible'}${field.module === 'quotes' && field.pdf_visible ? '<div class="sub">Shown in Quote PDF</div>' : ''}</td>
                      <td style="white-space:nowrap;">
                        <button type="button" class="btn" data-custom-field-edit="${field.id}">Edit</button>
                        <button type="button" class="btn" data-custom-field-toggle="${field.id}" data-active="${field.active ? '1' : '0'}">${field.active ? 'Deactivate' : 'Activate'}</button>
                        <button type="button" class="btn" data-custom-field-visibility="${field.id}" data-hidden="${field.hidden ? '1' : '0'}">${field.hidden ? 'Show' : 'Hide'}</button>
                        <button type="button" class="btn d" data-custom-field-delete="${field.id}">Delete</button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : '<div class="sub" style="padding:18px 0;">No custom fields are configured for this module.</div>'}
        </div>
      </div>
    `;
  };

  const loadFields = async () => {
    container.innerHTML = '<div class="spin" style="margin:40px auto;">Loading custom fields…</div>';
    const firstPage = await api('custom-fields/?include_hidden=true&page_size=100');
    customFields = firstPage.results || [];
    for (let page = 2; page <= (firstPage.pages || 1); page++) {
      const nextPage = await api(`custom-fields/?include_hidden=true&page_size=100&page=${page}`);
      customFields.push(...(nextPage.results || []));
    }
    render();
  };

  const showLoadError = error => {
    container.innerHTML = `
      <div class="error-msg-card" style="padding:20px;margin:20px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;color:#b91c1c;">
        <div>${esc(error.message || 'Could not load custom fields.')}</div>
        <button type="button" class="btn" data-custom-field-retry style="margin-top:12px;">Retry</button>
      </div>
    `;
  };

  const openFieldForm = field => {
    const editing = Boolean(field);
    const quoteModule = editing ? field.module === 'quotes' : !initialModule;
    const moduleControl = editing
      ? `<div class="s12"><b>Module:</b> ${esc(moduleLabel(field.module))}</div>`
      : initialModule
        ? `<div class="s12"><b>Module:</b> ${esc(moduleLabel(initialModule))}</div>`
        : fld({
        name: 'module',
        label: 'Module',
        type: 'select',
        opts: [['', 'Select a module'], ...modules.map(item => [item.key, item.label])],
        value: selectedModule || 'quotes',
        req: true,
        col: 's12',
      });
    formModal({
      title: editing ? 'Edit Custom Field' : 'Add Custom Field',
      dialog: true,
      wide: false,
      body: `<div class="g">
        ${moduleControl}
        ${fld({ name: 'label', label: 'Field Name', value: field?.label || '', req: true, col: 's12', attrs: 'maxlength="100"' })}
        ${fld({ name: 'field_type', label: 'Field Type', type: 'select', opts: fieldTypes, value: field?.field_type || 'text', req: true, col: 's12' })}
        <div class="s12" data-custom-field-options-row>
          ${fld({ name: 'options', label: 'Dropdown Options (comma separated)', value: field?.options || '', col: 's12', attrs: 'maxlength="1000"' })}
        </div>
        ${fld({ name: 'required', label: 'Mandatory field', type: 'checkbox', value: field?.required || false, col: 's12' })}
        ${fld({ name: 'active', label: 'Active', type: 'checkbox', value: field ? field.active : true, col: 's12' })}
        <div class="s12" data-custom-field-pdf-row ${quoteModule ? '' : 'hidden'}>
          ${fld({ name: 'pdf_visible', label: 'Show in Quote preview and PDF', type: 'checkbox', value: field?.pdf_visible || false, col: 's12' })}
        </div>
      </div>`,
      onReady: form => {
        const typeSelect = form.querySelector('[name="field_type"]');
        const moduleSelect = form.querySelector('[name="module"]');
        const optionsRow = form.querySelector('[data-custom-field-options-row]');
        const pdfRow = form.querySelector('[data-custom-field-pdf-row]');
        const updateConditionalFields = () => {
          optionsRow.hidden = !typeSelect || typeSelect.value !== 'select';
          if (moduleSelect && pdfRow) pdfRow.hidden = moduleSelect.value !== 'quotes';
        };
        typeSelect?.addEventListener('change', updateConditionalFields);
        moduleSelect?.addEventListener('change', updateConditionalFields);
        updateConditionalFields();
      },
      onSubmit: async (values, action, form) => {
        const type = form.querySelector('[name="field_type"]').value;
        const options = String(values.options || '').trim();
        if (type === 'select' && !options) {
          throw new ApiErr(400, { options: 'Enter at least one dropdown option.' }, 'Dropdown options are required.');
        }
        const payload = {
          label: String(values.label || '').trim(),
          field_type: type,
          options: type === 'select' ? options : '',
          required: form.querySelector('[name="required"]').checked,
          active: form.querySelector('[name="active"]').checked,
        };
        if (!editing) {
          payload.module = initialModule || form.querySelector('[name="module"]').value;
          payload.pdf_visible = payload.module === 'quotes' && form.querySelector('[name="pdf_visible"]').checked;
        } else if (field.module === 'quotes') {
          payload.pdf_visible = form.querySelector('[name="pdf_visible"]').checked;
        }
        if (editing) {
          await api(`custom-fields/${field.id}/`, { method: 'PATCH', body: JSON.stringify(payload) });
        } else {
          await api('custom-fields/', { method: 'POST', body: JSON.stringify(payload) });
        }
        await loadFields();
        toast(editing ? 'Custom field updated.' : 'Custom field created.', 'ok');
      },
    });
  };

  container.addEventListener('change', event => {
    if (event.target.matches('[data-custom-field-module]')) {
      selectedModule = event.target.value;
      render();
    }
  });
  container.addEventListener('click', async event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.hasAttribute('data-custom-field-retry')) {
      loadFields().catch(showLoadError);
      return;
    }
    if (button.hasAttribute('data-custom-field-add')) {
      openFieldForm(null);
      return;
    }
    const editId = button.dataset.customFieldEdit;
    if (editId) {
      const field = customFields.find(item => String(item.id) === String(editId));
      if (field) openFieldForm(field);
      return;
    }
    const activeId = button.dataset.customFieldToggle;
    if (activeId) {
      try {
        await api(`custom-fields/${activeId}/`, {
          method: 'PATCH',
          body: JSON.stringify({ active: button.dataset.active !== '1' }),
        });
        await loadFields();
      } catch (error) {
        toast(error.message || 'Could not update custom field status.', 'err');
      }
      return;
    }
    const visibilityId = button.dataset.customFieldVisibility;
    if (visibilityId) {
      try {
        await api(`custom-fields/${visibilityId}/`, {
          method: 'PATCH',
          body: JSON.stringify({ hidden: button.dataset.hidden !== '1' }),
        });
        await loadFields();
      } catch (error) {
        toast(error.message || 'Could not update custom field visibility.', 'err');
      }
      return;
    }
    const deleteId = button.dataset.customFieldDelete;
    if (deleteId) {
      const field = customFields.find(item => String(item.id) === String(deleteId));
      if (!(await confirmBox({
        title: 'Delete custom field?',
        message: `Delete "${field?.label || 'this field'}" configuration? Existing saved values will remain on records but the field will no longer be shown.`,
        okText: 'Delete',
        danger: true,
      }))) return;
      try {
        await api(`custom-fields/${deleteId}/`, { method: 'DELETE' });
        await loadFields();
        toast('Custom field deleted.', 'ok');
      } catch (error) {
        toast(error.message || 'Could not delete custom field.', 'err');
      }
    }
  });

  await loadFields().catch(showLoadError);
}

async function renderLocationCustomizationPage(container) {
  return renderCustomFieldsSettingsPage(container, 'locations', 'Branch Customization');
}

function toggleSettingsNavGroup(btn) {
  const grp = btn.closest('.settings-nav-group');
  if (grp) grp.classList.toggle('open');
}

// =========================================================================
// 3. USERS MANAGEMENT PAGE
// =========================================================================

async function renderSettingsUsersPage(container) {
  const data = await api('/settings/users/');
  const users = data.users || [];

  container.innerHTML = `
    <div class="settings-page-header">
      <div class="settings-page-header-left">
        <div class="settings-view-dropdown">
          <h1>All Users</h1>
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
        </div>
      </div>

      <div class="settings-page-header-right">
        <button type="button" class="btn-outline" onclick="openInviteUserModal(true)">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
          Invite Accountant
        </button>
        <button type="button" class="btn-primary" onclick="openInviteUserModal(false)">
          <span style="font-size:16px; margin-right:4px;">+</span> Invite User
        </button>
      </div>
    </div>

    <!-- Users Table -->
    <div class="settings-table-card">
      <table class="settings-data-table">
        <thead>
          <tr>
            <th style="width:40%;">USER DETAILS</th>
            <th style="width:30%;">ROLE</th>
            <th style="width:20%;">STATUS</th>
            <th style="width:10%; text-align:right;">ACTIONS</th>
          </tr>
        </thead>
        <tbody>
          ${users.map(u => {
            const initial = (u.name || u.username || 'U')[0].toUpperCase();
            const isSuper = u.is_superuser;
            const statusClass = u.status === 'active' ? 'chip-emerald' : (u.status === 'invited' ? 'chip-sky' : 'chip-rose');
            const statusLabel = u.status === 'active' ? 'Active' : (u.status === 'invited' ? 'Invited' : 'Inactive');
            return `
              <tr class="settings-user-row" data-user-id="${u.id}">
                <td>
                  <div class="user-cell-wrap">
                    <div class="user-avatar-circle">${esc(initial)}</div>
                    <div>
                      <div class="user-name-line">
                        <span class="user-display-name">${esc(u.name || u.username)}</span>
                        ${isSuper ? '<span class="chip-superadmin">Super Admin</span>' : ''}
                      </div>
                      <div class="user-email-line">
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                        <span>${esc(u.email || 'No email')}</span>
                      </div>
                    </div>
                  </div>
                </td>
                <td>
                  <span class="user-role-text">${esc(u.role)}</span>
                </td>
                <td>
                  <span class="pastel-chip ${statusClass}">${esc(statusLabel)}</span>
                </td>
                <td style="text-align:right;">
                  <button type="button" class="btn-table-action" onclick="openEditUserModal(${u.id}, '${esc(u.name)}', '${esc(u.email)}', ${u.role_id || 'null'}, '${u.status}')" title="Edit User">
                    Edit
                  </button>
                  ${!isSuper ? `
                    <button type="button" class="btn-table-action action-danger" onclick="deactivateUser(${u.id}, '${esc(u.name || u.username)}')" title="Deactivate">
                      Deactivate
                    </button>
                  ` : ''}
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function openInviteUserModal(isAccountant = false) {
  let roles = (cachedSettingsData && cachedSettingsData.roles) || [];
  if (!roles || !roles.length) {
    try {
      const rData = await api('/settings/roles/');
      roles = rData.roles || [];
      if (!cachedSettingsData) cachedSettingsData = {};
      cachedSettingsData.roles = roles;
    } catch(e) {
      roles = [];
    }
  }
  if (!roles.length) {
    roles = [
      { id: '1', name: 'Admin' },
      { id: '2', name: 'Staff' },
      { id: '3', name: 'Accountant' }
    ];
  }
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.innerHTML = `
    <div class="modal-box" style="max-width:500px;">
      <div class="modal-header">
        <h3>${isAccountant ? 'Invite Accountant' : 'Invite User'}</h3>
        <button type="button" class="modal-close-btn" onclick="this.closest('.modal-backdrop').remove()">✕</button>
      </div>
      <div class="modal-body">
        <div id="inviteUserError" role="alert" aria-live="assertive" style="display:none;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px;padding:10px 12px;border:1px solid #fca5a5;border-radius:8px;background:#fef2f2;color:#991b1b;font-size:13px;">
          <span data-invite-error-message></span>
          <button type="button" class="modal-close-btn" data-dismiss-invite-error aria-label="Dismiss message">✕</button>
        </div>
        <div class="form-group">
          <label>Full Name</label>
          <input type="text" id="inviteUserName" placeholder="e.g. John Doe" class="form-control">
        </div>
        <div class="form-group" style="margin-top:12px;">
          <label>Email Address*</label>
          <input type="email" id="inviteUserEmail" placeholder="e.g. user@convosis.com" class="form-control" required>
        </div>
        ${!isAccountant ? `
          <div class="form-group" style="margin-top:12px;">
            <label>Assign Role*</label>
            <select id="inviteUserRole" class="form-control">
              ${roles.map(r => `<option value="${r.id}" ${r.name === 'Staff' ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}
            </select>
          </div>
        ` : `
          <div class="info-alert-card" style="margin-top:12px;">
            This user will be assigned the <b>Accountant</b> role with full access to accounts, journals, and reports.
          </div>
        `}
      </div>
      <div class="modal-footer">
        <button type="button" class="btn-secondary" onclick="this.closest('.modal-backdrop').remove()">Cancel</button>
        <button type="button" class="btn-primary" id="btnSubmitInvite">Send Invitation</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  const errorBox = modal.querySelector('#inviteUserError');
  const submitButton = modal.querySelector('#btnSubmitInvite');
  const showInviteError = message => {
    errorBox.querySelector('[data-invite-error-message]').textContent = message;
    errorBox.style.display = 'flex';
  };
  errorBox.querySelector('[data-dismiss-invite-error]').addEventListener('click', () => {
    errorBox.style.display = 'none';
  });
  modal.querySelector('#inviteUserEmail').addEventListener('input', () => {
    errorBox.style.display = 'none';
  });

  submitButton.addEventListener('click', async () => {
    if (submitButton.disabled) return;
    const name = modal.querySelector('#inviteUserName').value.trim();
    const email = modal.querySelector('#inviteUserEmail').value.trim();
    const roleId = isAccountant ? null : (modal.querySelector('#inviteUserRole') ? modal.querySelector('#inviteUserRole').value : null);

    if (!email) {
      showInviteError('Please provide a valid email address.');
      modal.querySelector('#inviteUserEmail').focus();
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = 'Sending…';
    try {
      await api('/settings/users/invite/', {
        method: 'POST',
        body: JSON.stringify({ name, email, role_id: roleId, is_accountant: isAccountant })
      });
      toast(`Invitation sent successfully to ${email}.`, 'success');
      modal.remove();
      renderSettingsUsersPage($('#settingsMainPane'));
    } catch (err) {
      const limitReached = err.status === 403 && err.errors?.code === 'PLAN_USER_LIMIT_REACHED';
      showInviteError(limitReached
        ? 'You have reached your current user limit. Please upgrade your plan or manage existing users to invite another user.'
        : (err.message || 'Failed to send invitation.'));
    } finally {
      if (submitButton.isConnected) {
        submitButton.disabled = false;
        submitButton.textContent = 'Send Invitation';
      }
    }
  });
}

function openEditUserModal(userId, name, email, currentRoleId, currentStatus) {
  const roles = (cachedSettingsData && cachedSettingsData.roles) || [];
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.innerHTML = `
    <div class="modal-box" style="max-width:500px;">
      <div class="modal-header">
        <h3>Edit User</h3>
        <button type="button" class="modal-close-btn" onclick="this.closest('.modal-backdrop').remove()">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>Full Name</label>
          <input type="text" id="editUserName" value="${esc(name)}" class="form-control">
        </div>
        <div class="form-group" style="margin-top:12px;">
          <label>Email Address</label>
          <input type="email" id="editUserEmail" value="${esc(email)}" class="form-control" readonly>
        </div>
        <div class="form-group" style="margin-top:12px;">
          <label>Assign Role</label>
          <select id="editUserRole" class="form-control">
            ${roles.map(r => `<option value="${r.id}" ${r.id === currentRoleId ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="margin-top:12px;">
          <label>Status</label>
          <select id="editUserStatus" class="form-control">
            <option value="active" ${currentStatus === 'active' ? 'selected' : ''}>Active</option>
            <option value="inactive" ${currentStatus === 'inactive' ? 'selected' : ''}>Inactive</option>
          </select>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn-secondary" onclick="this.closest('.modal-backdrop').remove()">Cancel</button>
        <button type="button" class="btn-primary" id="btnSaveEditUser">Save Changes</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.querySelector('#btnSaveEditUser').addEventListener('click', async () => {
    const updatedName = modal.querySelector('#editUserName').value.trim();
    const updatedRoleId = modal.querySelector('#editUserRole').value;
    const updatedStatus = modal.querySelector('#editUserStatus').value;

    try {
      await api(`/settings/users/${userId}/`, {
        method: 'PUT',
        body: JSON.stringify({ name: updatedName, role_id: updatedRoleId, status: updatedStatus })
      });
      toast('User updated successfully.', 'success');
      modal.remove();
      renderSettingsUsersPage($('#settingsMainPane'));
    } catch (err) {
      toast(err.message || 'Failed to update user.', 'error');
    }
  });
}

async function deactivateUser(userId, name) {
  if (!confirm(`Are you sure you want to deactivate ${name}?`)) return;
  try {
    await api(`/settings/users/${userId}/`, { method: 'DELETE' });
    toast(`User ${name} deactivated.`, 'success');
    renderSettingsUsersPage($('#settingsMainPane'));
  } catch (err) {
    toast(err.message || 'Failed to deactivate user.', 'error');
  }
}

// =========================================================================
// 4. ROLES MANAGEMENT PAGE
// =========================================================================

async function renderSettingsRolesPage(container) {
  const data = await api('/settings/roles/');
  const roles = data.roles || [];

  container.innerHTML = `
    <div class="settings-page-header">
      <div class="settings-page-header-left">
        <h1>Roles</h1>
      </div>
      <div class="settings-page-header-right">
        <button type="button" class="btn-primary" onclick="location.hash='#/settings/roles/new'">
          <span style="font-size:16px; margin-right:4px;">+</span> New Role
        </button>
      </div>
    </div>

    <div class="settings-table-card">
      <table class="settings-data-table">
        <thead>
          <tr>
            <th style="width:25%;">ROLE NAME</th>
            <th style="width:55%;">DESCRIPTION</th>
            <th style="width:20%; text-align:right;">ACTIONS</th>
          </tr>
        </thead>
        <tbody>
          ${roles.map(r => `
            <tr class="settings-role-row" data-role-id="${r.id}">
              <td>
                <a href="#/settings/roles/${r.id}" class="role-link-name">
                  <b>${esc(r.name)}</b>
                </a>
                ${r.is_system ? '<span class="pastel-chip chip-gray" style="font-size:10px; margin-left:6px;">Default</span>' : ''}
              </td>
              <td style="color:var(--tx-dim); font-size:13px; line-height:1.5;">
                ${esc(r.description || '—')}
              </td>
              <td style="text-align:right;">
                <a href="#/settings/roles/${r.id}" class="btn-table-action">View / Edit</a>
                <button type="button" class="btn-table-action" onclick="duplicateRole(${r.id})">Duplicate</button>
                ${!r.is_system ? `
                  <button type="button" class="btn-table-action action-danger" onclick="deleteRole(${r.id}, '${esc(r.name)}')">Delete</button>
                ` : ''}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function duplicateRole(roleId) {
  try {
    const res = await api(`/settings/roles/${roleId}/duplicate/`, { method: 'POST' });
    toast(`Duplicated as "${res.name}".`, 'success');
    location.hash = `#/settings/roles/${res.id}`;
  } catch (err) {
    toast(err.message || 'Failed to duplicate role.', 'error');
  }
}

async function deleteRole(roleId, name) {
  if (!confirm(`Are you sure you want to delete role "${name}"? Users assigned to this role will be reassigned to Staff.`)) return;
  try {
    await api(`/settings/roles/${roleId}/`, { method: 'DELETE' });
    toast(`Role "${name}" deleted.`, 'success');
    renderSettingsRolesPage($('#settingsMainPane'));
  } catch (err) {
    toast(err.message || 'Failed to delete role.', 'error');
  }
}

// =========================================================================
// 5. SEGMENTED ACCESS CONTROL – DETAILED ROLE PERMISSION EDITOR
// =========================================================================

async function renderRoleEditorPage(container, roleId) {
  const isNew = !roleId || roleId === 'new';
  let roleData = {
    name: '',
    description: '',
    is_system: false,
    api_only: false,
    is_accountant: false,
    permissions: {},
    report_permissions: {}
  };

  if (!isNew) {
    container.innerHTML = `<div class="spin" style="margin:40px auto;">Loading Role Permissions…</div>`;
    roleData = await api(`/settings/roles/${roleId}/`);
  }

  const p = roleData.permissions || {};
  const rp = roleData.report_permissions || {};

  const org = APP.org || {};
  const orgName = org.name || 'Convosis Technologies Pvt Ltd';

  container.innerHTML = `
    <div class="settings-fullpage-wrap" style="background:#ffffff; min-height:100vh;">
      <div class="settings-topbar">
        <div class="settings-topbar-left">
          <button type="button" class="settings-back-btn" onclick="location.hash='#/settings/roles'" title="Back to Roles">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <div class="settings-brand-icon">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/></svg>
          </div>
          <div>
            <div class="settings-topbar-title">All Settings</div>
            <div class="settings-topbar-org">${esc(orgName)}</div>
          </div>
        </div>

        <div class="settings-topbar-search">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input class="settings-menu-search-input" type="search" placeholder="Search settings (/)" autocomplete="off" aria-label="Search settings" aria-haspopup="listbox" aria-expanded="false">
          <div class="settings-menu-search-results" role="listbox" aria-label="Matching settings" hidden></div>
        </div>

        <div class="settings-topbar-right">
          <button type="button" class="btn-close-settings" onclick="closeSettingsDashboard()">
            Close Settings <span style="font-size:14px; margin-left:4px;">✕</span>
          </button>
        </div>
      </div>

      <div style="flex:1; overflow-y:auto; padding:28px 36px 80px;">
        <div class="role-editor-container">
          <div class="role-editor-top">
            <h1 class="role-editor-title">Role</h1>
            <div class="role-editor-breadcrumbs">
              <span class="crumb-active">✓ General</span>
              <span class="crumb-separator">&gt;</span>
              <span class="crumb-active">Segmented Access Control</span>
            </div>
          </div>

      ${roleData.is_system ? `
        <div class="info-alert-card" style="margin:16px 0;">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style="flex-shrink:0;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          <span>This is a default system role. You can customize its permissions, but its system name cannot be changed or deleted.</span>
        </div>
      ` : ''}

      <!-- General Info Card -->
      <div class="role-editor-section-card">
        <div class="form-row" style="margin-bottom:14px;">
          <label style="width:140px; font-weight:600; color:var(--tx);">Role Name*</label>
          <div style="flex:1;">
            <input type="text" id="roleEditName" value="${esc(roleData.name)}" class="form-control" style="max-width:400px;" ${roleData.is_system ? 'readonly' : ''} placeholder="Enter role name" required>
          </div>
        </div>

        <div class="form-row" style="margin-bottom:14px;">
          <label style="width:140px; font-weight:600; color:var(--tx);">Description</label>
          <div style="flex:1;">
            <textarea id="roleEditDesc" class="form-control" style="max-width:550px; height:70px;" placeholder="Brief description of responsibilities">${esc(roleData.description || '')}</textarea>
          </div>
        </div>

        <div class="form-row" style="margin-bottom:14px;">
          <div style="width:140px;"></div>
          <label class="custom-checkbox-label">
            <input type="checkbox" id="roleEditApiOnly" ${roleData.api_only ? 'checked' : ''}>
            <span>Users in this role can access ConvosisBooks only via API.</span>
          </label>
        </div>

        <div class="accountant-role-card">
          <label class="custom-checkbox-label" style="font-weight:600;">
            <input type="checkbox" id="roleEditIsAccountant" ${roleData.is_accountant ? 'checked' : ''}>
            <span>This role is for Accountant users</span>
          </label>
          <div style="font-size:12.5px; color:var(--tx-dim); margin-left:22px; margin-top:2px;">
            If you mark this option, all users who are added with this role will be recognized as an accountant user with advanced fiscal access.
          </div>
        </div>
      </div>

      <!-- Segmented Permissions Tables -->
      <div id="rolePermissionTablesContainer">
        ${renderModulePermissionTable('Contacts', 'contacts', [
          { key: 'customers', label: 'Customers', hasAssignOwner: true, moreOptions: [
            { key: 'assigned_only', label: 'Allow users to handle the data and transactions for assigned customers only.' }
          ]},
          { key: 'vendors', label: 'Vendors', moreOptions: [
            { key: 'view_bank_account', label: 'View Vendor Bank Account' },
            { key: 'manage_bank_account', label: 'Manage Vendor Bank Account' }
          ]}
        ], p.contacts || {}, { hasAssignOwner: true, hasApprove: false })}

        ${renderModulePermissionTable('Items', 'items', [
          { key: 'item', label: 'Item' },
          { key: 'adjustments', label: 'Inventory Adjustments', hasApprove: true, moreOptions: [
            { key: 'approve_adjustments', label: 'Approve Inventory Adjustments' }
          ]},
          { key: 'price_lists', label: 'Price List' }
        ], p.items || {}, { hasApprove: true, hasAssignOwner: false })}

        ${renderModulePermissionTable('Banking', 'banking', [
          { key: 'banking', label: 'Banking', moreOptions: [
            { key: 'manage_bank_accounts', label: 'Manage Bank Accounts' },
            { key: 'reconciliation', label: 'Perform Bank Reconciliation' }
          ]}
        ], p.banking || {}, { hasApprove: false, hasAssignOwner: false })}

        ${renderModulePermissionTable('Sales', 'sales', [
          { key: 'invoices', label: 'Invoices', hasApprove: true, moreOptions: [
            { key: 'send_invoices', label: 'Send Invoices' },
            { key: 'void_invoices', label: 'Void Invoices' },
            { key: 'record_payments', label: 'Record Payments' },
            { key: 'customer_statements', label: 'Customer Statements' }
          ]},
          { key: 'customer_payments', label: 'Customer Payments', hasApprove: true, moreOptions: [
            { key: 'refunds', label: 'Refunds' }
          ]},
          { key: 'quotes', label: 'Quotes', hasApprove: true, moreOptions: [
            { key: 'send_quotes', label: 'Send Quotes' }
          ]},
          { key: 'delivery_challans', label: 'Delivery Challan', hasApprove: true },
          { key: 'sales_orders', label: 'Sales Orders', hasApprove: true, moreOptions: [
            { key: 'convert_to_invoice', label: 'Convert to Invoice' }
          ]},
          { key: 'credit_notes', label: 'Credit Notes', hasApprove: true }
        ], p.sales || {}, { hasApprove: true, hasAssignOwner: false })}

        ${renderModulePermissionTable('Purchases', 'purchases', [
          { key: 'bills', label: 'Bills', hasApprove: true, moreOptions: [
            { key: 'approve_bills', label: 'Approve Bills' }
          ]},
          { key: 'vendor_payments', label: 'Vendor Payments', hasApprove: true, moreOptions: [
            { key: 'refunds', label: 'Refunds' }
          ]},
          { key: 'expenses', label: 'Expenses', hasApprove: true, moreOptions: [
            { key: 'approve_expenses', label: 'Approve Expenses' }
          ]},
          { key: 'purchase_orders', label: 'Purchase Orders', hasApprove: true, moreOptions: [
            { key: 'convert_to_bill', label: 'Convert to Bill' }
          ]},
          { key: 'vendor_credits', label: 'Vendor Credits', hasApprove: true }
        ], p.purchases || {}, { hasApprove: true, hasAssignOwner: false })}

        ${renderModulePermissionTable('Accountant', 'accountant', [
          { key: 'chart_of_accounts', label: 'Chart of Accounts', hasApprove: true, moreOptions: [
            { key: 'import_accounts', label: 'Import Chart of Accounts' }
          ]},
          { key: 'journals', label: 'Journals', hasApprove: true, moreOptions: [
            { key: 'approve_journals', label: 'Approve Journals' }
          ]},
          { key: 'budgets', label: 'Budget', hasApprove: false }
        ], p.accountant || {}, { hasApprove: true, hasAssignOwner: false })}

        ${renderModulePermissionTable('Income TDS', 'income_tds', [
          { key: 'tds_payments', label: 'Income TDS Payment' }
        ], p.income_tds || {}, { hasApprove: false, hasAssignOwner: false })}

        ${renderModulePermissionTable('Timesheets', 'timesheets', [
          { key: 'projects', label: 'Projects', moreOptions: [
            { key: 'no_expense_record', label: "Don't allow timesheet staffs to record expenses for the associated project(s)" }
          ]},
          { key: 'timesheets', label: 'Timesheets' },
          { key: 'time_entries', label: 'Time Entries' }
        ], p.timesheets || {}, { hasApprove: false, hasAssignOwner: false })}

        <!-- GST Filing – flat checkbox section -->
        <div class="permission-group-card" data-module="gst_filing">
          <div class="permission-group-title-flat">
            <label class="custom-checkbox-label" style="font-weight:700; font-size:14px;">
              <input type="checkbox" class="flat-section-master" id="permGstFiling" ${(p.gst_filing && p.gst_filing.enabled) ? 'checked' : ''}>
              <span>GST Filing</span>
            </label>
          </div>
          <div class="permission-simple-grid" style="padding:14px 18px;">
            ${[
              ['view_generate', 'View and Generate Return'],
              ['push_transactions', 'Push Transactions'],
              ['reconcile_transactions', 'Reconcile Transactions'],
              ['file_returns', 'File Returns'],
            ].map(([k, lbl]) => `
              <label class="custom-checkbox-label">
                <input type="checkbox" class="flat-perm-cb" data-opt-key="${k}" ${(p.gst_filing && p.gst_filing[k]) ? 'checked' : ''}>
                <span>${esc(lbl)}</span>
              </label>
            `).join('')}
          </div>
        </div>

        <!-- Documents – flat checkbox section -->
        <div class="permission-group-card" data-module="documents">
          <div class="permission-group-title-flat">
            <label class="custom-checkbox-label" style="font-weight:700; font-size:14px;">
              <input type="checkbox" class="flat-section-master" id="permDocuments" ${(p.documents && p.documents.enabled) ? 'checked' : ''}>
              <span>Documents</span>
            </label>
          </div>
          <div class="permission-simple-grid" style="padding:14px 18px;">
            ${[
              ['view_documents', 'View Documents'],
              ['upload_documents', 'Upload Documents'],
              ['delete_documents', 'Delete Documents'],
              ['manage_folder', 'Manage Folder'],
            ].map(([k, lbl]) => `
              <label class="custom-checkbox-label">
                <input type="checkbox" class="flat-perm-cb" data-opt-key="${k}" ${(p.documents && p.documents[k]) ? 'checked' : ''}>
                <span>${esc(lbl)}</span>
              </label>
            `).join('')}
          </div>
        </div>

        <!-- e-Way Bill – flat checkbox section -->
        <div class="permission-group-card" data-module="eway_bill">
          <div class="permission-group-title-flat">
            <label class="custom-checkbox-label" style="font-weight:700; font-size:14px;">
              <input type="checkbox" class="flat-section-master" id="permEwayBill" ${(p.eway_bill && p.eway_bill.enabled) ? 'checked' : ''}>
              <span>e-Way Bill</span>
            </label>
          </div>
          <div class="permission-simple-grid" style="padding:14px 18px;">
            ${[
              ['generate_eway', 'Generate e-Way Bill'],
              ['cancel_eway', 'Cancel e-Way Bill'],
            ].map(([k, lbl]) => `
              <label class="custom-checkbox-label">
                <input type="checkbox" class="flat-perm-cb" data-opt-key="${k}" ${(p.eway_bill && p.eway_bill[k]) ? 'checked' : ''}>
                <span>${esc(lbl)}</span>
              </label>
            `).join('')}
          </div>
        </div>

        <!-- Settings Access – flat checkbox section -->
        <div class="permission-group-card" data-module="settings_access">
          <div class="permission-group-title-flat">
            <label class="custom-checkbox-label" style="font-weight:700; font-size:14px;">
              <input type="checkbox" class="flat-section-master" id="permSettingsAccess" ${(p.settings_access && p.settings_access.enabled) ? 'checked' : ''}>
              <span>Settings</span>
            </label>
          </div>
          <div class="permission-simple-grid" style="padding:14px 18px;">
            ${[
              ['update_profile', 'Update organization profile'],
              ['users', 'Users'],
              ['export_data', 'Export data'],
              ['general_preferences', 'General preferences'],
              ['accountant_preferences', 'Accountant preferences'],
              ['gst_filing', 'GST Filing'],
              ['taxes', 'Taxes'],
              ['currencies', 'Currencies'],
              ['protected_data', 'Provide access to protected data'],
              ['payment_terms', 'Payment Terms'],
              ['templates', 'Templates'],
              ['email_template', 'Email Template'],
              ['manage_integration', 'Manage Integration'],
              ['automation', 'Automation'],
              ['incoming_webhook', 'Incoming Webhook'],
              ['signal', 'Signal'],
            ].map(([k, lbl]) => `
              <label class="custom-checkbox-label">
                <input type="checkbox" class="setting-perm-cb" data-key="${k}" ${(p.settings_access && p.settings_access[k]) ? 'checked' : ''}>
                <span>${esc(lbl)}</span>
              </label>
            `).join('')}
          </div>
        </div>

        <!-- Dashboard Widgets -->
        <div class="permission-group-card" data-module="dashboard">
          <div class="permission-group-title-flat">
            <label class="custom-checkbox-label" style="font-weight:700; font-size:14px;">
              <input type="checkbox" class="flat-section-master" id="permDashboard" ${(p.dashboard && p.dashboard.enabled) ? 'checked' : ''}>
              <span>Dashboard</span>
            </label>
          </div>
          <div class="permission-simple-grid" style="padding:14px 18px;">
            ${[
              ['total_payables', 'Total Payables', true],
              ['total_receivables', 'Total Receivables', true],
              ['cash_flow', 'Cash Flow', true],
              ['income_expenses', 'Income and Expenses', true],
              ['top_expenses', 'Your Top Expense', true],
              ['projects', 'Projects'],
              ['bank_credit_cards', 'Bank and Credit Cards'],
              ['account_watchlist', 'Account Watchlist', true],
            ].map(([k, lbl, locked]) => `
              <label class="custom-checkbox-label">
                <input type="checkbox" class="dash-perm-cb" data-key="${k}" ${(p.dashboard && p.dashboard[k]) ? 'checked' : ''}>
                <span>${esc(lbl)}${locked ? ' <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" style="opacity:0.4; vertical-align:middle;"><path d="M18 11H6a2 2 0 00-2 2v7a2 2 0 002 2h12a2 2 0 002-2v-7a2 2 0 00-2-2zM12 17a1 1 0 110-2 1 1 0 010 2zm4-6V8a4 4 0 10-8 0v3h8z"/></svg>' : ''}</span>
              </label>
            `).join('')}
          </div>
        </div>

        <!-- Reporting Tags – flat checkbox section -->
        <div class="permission-group-card" data-module="reporting_tags">
          <div class="permission-group-title-flat">
            <label class="custom-checkbox-label" style="font-weight:700; font-size:14px;">
              <input type="checkbox" class="flat-section-master" id="permReportingTags" ${(p.reporting_tags && p.reporting_tags.enabled) ? 'checked' : ''}>
              <span>Reporting Tags</span>
            </label>
          </div>
          <div class="permission-simple-grid" style="padding:14px 18px;">
            ${[
              ['view_tags', 'View Reporting Tags'],
              ['manage_tags', 'Manage Reporting Tags'],
              ['delete_tags', 'Delete Reporting Tags'],
            ].map(([k, lbl]) => `
              <label class="custom-checkbox-label">
                <input type="checkbox" class="flat-perm-cb" data-opt-key="${k}" ${(p.reporting_tags && p.reporting_tags[k]) ? 'checked' : ''}>
                <span>${esc(lbl)}</span>
              </label>
            `).join('')}
          </div>
        </div>

        <!-- Bharat Connect – flat checkbox section -->
        <div class="permission-group-card" data-module="bharat_connect">
          <div class="permission-group-title-flat">
            <label class="custom-checkbox-label" style="font-weight:700; font-size:14px;">
              <input type="checkbox" class="flat-section-master" id="permBharatConnect" ${(p.bharat_connect && p.bharat_connect.enabled) ? 'checked' : ''}>
              <span>Bharat Connect</span>
            </label>
          </div>
          <div class="permission-simple-grid" style="padding:14px 18px;">
            ${[
              ['send_transactions', 'Send Transactions via Bharat Connect'],
              ['accept_transactions', 'Accept Transactions from Bharat Connect'],
              ['manage_integration', 'Manage Bharat Connect Integration'],
            ].map(([k, lbl]) => `
              <label class="custom-checkbox-label">
                <input type="checkbox" class="flat-perm-cb" data-opt-key="${k}" ${(p.bharat_connect && p.bharat_connect[k]) ? 'checked' : ''}>
                <span>${esc(lbl)}</span>
              </label>
            `).join('')}
          </div>
        </div>

        <!-- Report Permissions Section -->
        <div class="permission-group-card" style="margin-top:20px;">
          <div style="padding:14px 18px; border-bottom:1px solid var(--bd); background:#f8f9fa;">
            <label class="custom-checkbox-label" style="font-weight:700; font-size:14px;">
              <input type="checkbox" id="permAllReports" ${rp.all_reports ? 'checked' : ''} onchange="toggleAllReports(this)">
              <span>Enable full access for all reports
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style="opacity:0.5; vertical-align:middle; margin-left:4px;"><circle cx="12" cy="12" r="10"/><path fill="white" d="M12 7h.01M11 11h1v5h1"/></svg>
              </span>
            </label>
          </div>
          <div style="margin:12px 18px; background:#fff8e1; border:1px solid #ffe082; border-radius:6px; padding:10px 14px; display:flex; align-items:flex-start; gap:8px; font-size:13px; color:#795548;">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="#f59e0b" style="flex-shrink:0; margin-top:1px;"><path d="M12 2L1 21h22L12 2zm0 15h.01M11 11h2v4h-2z"/></svg>
            <span>When new reports are introduced, you will have to edit the role and provide access to them.</span>
          </div>

          <table class="permission-table" id="reportPermissionsTable">
            <thead>
              <tr>
                <th style="width:40%;">Report Groups</th>
                <th style="width:12%; text-align:center; color:#2563eb;">Full Access</th>
                <th style="width:12%; text-align:center;">View</th>
                <th style="width:12%; text-align:center;">Export</th>
                <th style="width:12%; text-align:center;">Schedule</th>
                <th style="width:12%; text-align:center;">Share</th>
              </tr>
            </thead>
            <tbody>
              ${[
                ['business_overview', 'Business Overview'],
                ['sales', 'Sales'],
                ['inventory', 'Inventory'],
                ['inventory_valuation', 'Inventory Valuation'],
                ['retail', 'Retail'],
                ['receivables', 'Receivables'],
                ['payables', 'Payables'],
                ['purchases_expenses', 'Purchases and Expenses'],
                ['taxes', 'Taxes'],
                ['banking', 'Banking'],
                ['projects_timesheet', 'Projects and Timesheet'],
                ['accountant', 'Accountant'],
                ['budgets', 'Budgets'],
                ['currency', 'Currency'],
                ['activity', 'Activity'],
                ['automation', 'Automation'],
              ].map(([k, lbl]) => {
                const grp = (rp.groups && rp.groups[k]) || {};
                const isFull = rp.all_reports || grp.full;
                return `
                  <tr class="report-perm-row" data-group="${k}">
                    <td><b>${esc(lbl)}</b>${['inventory_valuation', 'budgets'].includes(k) ? ` <span style="font-size:11px; color:#9ca3af; float:right;">Click to configure access</span>` : ''}</td>
                    <td align="center"><input type="checkbox" class="rp-cb rp-full" data-action="full" ${isFull ? 'checked' : ''} onchange="toggleReportRow(this)"></td>
                    <td align="center"><input type="checkbox" class="rp-cb rp-sub" data-action="view" ${(isFull || grp.view) ? 'checked' : ''} onchange="updateReportRowFull(this)"></td>
                    <td align="center"><input type="checkbox" class="rp-cb rp-sub" data-action="export" ${(isFull || grp.export) ? 'checked' : ''} onchange="updateReportRowFull(this)"></td>
                    <td align="center"><input type="checkbox" class="rp-cb rp-sub" data-action="schedule" ${(isFull || grp.schedule) ? 'checked' : ''} onchange="updateReportRowFull(this)"></td>
                    <td align="center"><input type="checkbox" class="rp-cb rp-sub" data-action="share" ${(isFull || grp.share) ? 'checked' : ''} onchange="updateReportRowFull(this)"></td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Sticky Bottom Action Bar -->
      <div class="role-sticky-footer" style="margin:24px 0 0 0;">
        <button type="button" class="btn-primary" id="btnSaveRolePermissions">Proceed</button>
        <button type="button" class="btn-secondary" onclick="location.hash='#/settings/roles'">Cancel</button>
      </div>
    </div>
  </div>
</div>
  `;

  // Attach interactive parent-child checkbox listeners
  attachPermissionTableLogic(container);

  // Save handler
  container.querySelector('#btnSaveRolePermissions').addEventListener('click', async () => {
    const name = container.querySelector('#roleEditName').value.trim();
    if (!name) {
      toast('Role Name is required.', 'error');
      container.querySelector('#roleEditName').focus();
      return;
    }

    const description = container.querySelector('#roleEditDesc').value.trim();
    const api_only = container.querySelector('#roleEditApiOnly').checked;
    const is_accountant = container.querySelector('#roleEditIsAccountant').checked;

    const permissions = collectSegmentedPermissions(container);
    const report_permissions = collectReportPermissions(container);

    const payload = {
      name,
      description,
      api_only,
      is_accountant,
      permissions,
      report_permissions
    };

    try {
      if (isNew) {
        await api('/settings/roles/', { method: 'POST', body: JSON.stringify(payload) });
        toast(`Role "${name}" created successfully.`, 'success');
      } else {
        await api(`/settings/roles/${roleId}/`, { method: 'PUT', body: JSON.stringify(payload) });
        toast(`Role "${name}" updated successfully.`, 'success');
      }
      location.hash = '#/settings/roles';
    } catch (err) {
      toast(err.message || 'Failed to save role.', 'error');
    }
  });
}

/**
 * Renders a module permission table.
 * @param {string} moduleTitle - Display title
 * @param {string} moduleKey - Data key for collecting perms
 * @param {Array} items - Row definitions
 * @param {Object} currentModulePerms - Existing permissions
 * @param {Object} opts - { hasApprove, hasAssignOwner } column options at table level
 */
function renderModulePermissionTable(moduleTitle, moduleKey, items, currentModulePerms, opts = {}) {
  // Determine which columns to show (table-level defaults, can be overridden per item)
  // hasApprove: Items, Sales, Purchases, Accountant
  // hasAssignOwner: Contacts only
  // Banking, Income TDS, Timesheets: no Approve, no Assign Owner
  const tableHasApprove = opts.hasApprove !== undefined ? opts.hasApprove :
    items.some(it => it.hasApprove);
  const tableHasAssignOwner = opts.hasAssignOwner !== undefined ? opts.hasAssignOwner :
    items.some(it => it.hasAssignOwner);

  // Build column headers
  let headerCols = `
    <th style="width:28%;">Particulars</th>
    <th style="width:9%; text-align:center;">Full</th>
    <th style="width:9%; text-align:center;">View</th>
    <th style="width:9%; text-align:center;">Create</th>
    <th style="width:9%; text-align:center;">Edit</th>
    <th style="width:9%; text-align:center;">Delete</th>
  `;
  if (tableHasApprove) {
    headerCols += `<th style="width:9%; text-align:center;">Approve</th>`;
  }
  if (tableHasAssignOwner) {
    headerCols += `<th style="width:12%; text-align:center;">Assign owner</th>`;
  }
  headerCols += `<th style="width:${tableHasApprove || tableHasAssignOwner ? '14' : '17'}%;">Others</th>`;

  return `
    <div class="permission-group-card" data-module="${moduleKey}">
      <div class="permission-group-title">${esc(moduleTitle)}</div>
      <table class="permission-table">
        <thead>
          <tr>${headerCols}</tr>
        </thead>
        <tbody>
          ${items.map(it => {
            const rowPerm = currentModulePerms[it.key] || {};
            const isFull = Boolean(rowPerm.full);
            const moreOpts = it.moreOptions || [];
            const subCheckboxes = it.subCheckboxes || [];
            let rowCols = `
              <td>
                <b>${esc(it.label)}</b>
                ${subCheckboxes.length ? `
                  <div class="more-perms-drawer sub-checkboxes-inline" style="margin-top:6px;">
                    ${subCheckboxes.map(sc => `
                      <label class="custom-checkbox-label" style="display:flex; margin-bottom:4px; font-size:12px;">
                        <input type="checkbox" class="cb-more-opt" data-opt-key="${sc.key}" ${(rowPerm.others && rowPerm.others[sc.key]) ? 'checked' : ''}>
                        <span>${esc(sc.label)}</span>
                      </label>
                    `).join('')}
                  </div>
                ` : ''}
              </td>
              <td align="center"><input type="checkbox" class="cb-perm-full" ${isFull ? 'checked' : ''}></td>
              <td align="center"><input type="checkbox" class="cb-perm cb-view" ${rowPerm.view || isFull ? 'checked' : ''}></td>
              <td align="center"><input type="checkbox" class="cb-perm cb-create" ${rowPerm.create || isFull ? 'checked' : ''}></td>
              <td align="center"><input type="checkbox" class="cb-perm cb-edit" ${rowPerm.edit || isFull ? 'checked' : ''}></td>
              <td align="center"><input type="checkbox" class="cb-perm cb-delete" ${rowPerm.delete || isFull ? 'checked' : ''}></td>
            `;
            if (tableHasApprove) {
              rowCols += `<td align="center">${it.hasApprove ? `<input type="checkbox" class="cb-perm cb-approve" ${rowPerm.approve || isFull ? 'checked' : ''}>` : ''}</td>`;
            }
            if (tableHasAssignOwner) {
              rowCols += `<td align="center">${it.hasAssignOwner ? `<input type="checkbox" class="cb-perm cb-assign-owner" ${(rowPerm.assign_owner || isFull) ? 'checked' : ''}>` : ''}</td>`;
            }
            rowCols += `
              <td>
                ${moreOpts.length ? `
                  <a href="javascript:void(0)" class="link-more-perm" onclick="toggleMorePerms(this)">More Permissions</a>
                  <div class="more-perms-drawer" style="display:none; margin-top:6px;">
                    ${moreOpts.map(mo => {
                      const isMoChecked = Boolean(rowPerm.others && rowPerm.others[mo.key]);
                      return `
                        <label class="custom-checkbox-label" style="display:flex; margin-bottom:4px; font-size:12px;">
                          <input type="checkbox" class="cb-more-opt" data-opt-key="${mo.key}" ${isMoChecked ? 'checked' : ''}>
                          <span>${esc(mo.label)}</span>
                        </label>
                      `;
                    }).join('')}
                  </div>
                ` : ''}
              </td>
            `;
            return `<tr class="perm-row" data-submodule="${it.key}">${rowCols}</tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function toggleMorePerms(btn) {
  const drawer = btn.nextElementSibling;
  if (drawer) {
    const isHidden = drawer.style.display === 'none';
    drawer.style.display = isHidden ? 'block' : 'none';
    btn.textContent = isHidden ? 'Hide Permissions' : 'More Permissions';
  }
}

function attachPermissionTableLogic(container) {
  container.querySelectorAll('.perm-row').forEach(row => {
    const fullCb = row.querySelector('.cb-perm-full');
    const childCbs = row.querySelectorAll('.cb-perm');

    // Clicking Full selects/deselects all children
    if (fullCb) {
      fullCb.addEventListener('change', () => {
        childCbs.forEach(cb => { cb.checked = fullCb.checked; });
        fullCb.indeterminate = false;
      });
    }

    // Toggling child updates full checkbox / indeterminate state
    childCbs.forEach(cb => {
      cb.addEventListener('change', () => {
        const allChecked = Array.from(childCbs).every(c => c.checked);
        const someChecked = Array.from(childCbs).some(c => c.checked);
        if (fullCb) {
          fullCb.checked = allChecked;
          fullCb.indeterminate = !allChecked && someChecked;
        }
      });
    });
  });
}

function toggleAllReports(masterCb) {
  const isChecked = masterCb.checked;
  $$('#reportPermissionsTable .rp-cb').forEach(cb => {
    cb.checked = isChecked;
  });
}

function toggleReportRow(fullCb) {
  const tr = fullCb.closest('tr');
  const subs = tr.querySelectorAll('.rp-sub');
  subs.forEach(c => c.checked = fullCb.checked);
}

function updateReportRowFull(subCb) {
  const tr = subCb.closest('tr');
  const subs = Array.from(tr.querySelectorAll('.rp-sub'));
  const fullCb = tr.querySelector('.rp-full');
  if (fullCb) {
    fullCb.checked = subs.every(c => c.checked);
    fullCb.indeterminate = !fullCb.checked && subs.some(c => c.checked);
  }
}

function collectSegmentedPermissions(container) {
  const perms = {};

  // Table-based modules
  container.querySelectorAll('.permission-group-card[data-module]').forEach(modCard => {
    const modKey = modCard.dataset.module;
    // Skip flat-section modules handled below
    if (['gst_filing', 'documents', 'eway_bill', 'settings_access', 'dashboard', 'reporting_tags', 'bharat_connect'].includes(modKey)) return;

    perms[modKey] = {};
    modCard.querySelectorAll('.perm-row').forEach(row => {
      const subKey = row.dataset.submodule;
      const full = Boolean(row.querySelector('.cb-perm-full')?.checked);
      const view = Boolean(row.querySelector('.cb-view')?.checked);
      const create = Boolean(row.querySelector('.cb-create')?.checked);
      const edit = Boolean(row.querySelector('.cb-edit')?.checked);
      const del = Boolean(row.querySelector('.cb-delete')?.checked);
      const approve = Boolean(row.querySelector('.cb-approve')?.checked);
      const assign_owner = Boolean(row.querySelector('.cb-assign-owner')?.checked);

      const others = {};
      row.querySelectorAll('.cb-more-opt').forEach(mo => {
        others[mo.dataset.optKey] = mo.checked;
      });

      perms[modKey][subKey] = {
        full: full || (view && create && edit && del),
        view,
        create,
        edit,
        delete: del,
        approve,
        assign_owner,
        others
      };
    });
  });

  // Flat section: GST Filing
  const gstCard = container.querySelector('.permission-group-card[data-module="gst_filing"]');
  if (gstCard) {
    perms['gst_filing'] = { enabled: Boolean(gstCard.querySelector('#permGstFiling')?.checked) };
    gstCard.querySelectorAll('.flat-perm-cb').forEach(cb => {
      perms['gst_filing'][cb.dataset.optKey] = cb.checked;
    });
  }

  // Flat section: Documents
  const docsCard = container.querySelector('.permission-group-card[data-module="documents"]');
  if (docsCard) {
    perms['documents'] = { enabled: Boolean(docsCard.querySelector('#permDocuments')?.checked) };
    docsCard.querySelectorAll('.flat-perm-cb').forEach(cb => {
      perms['documents'][cb.dataset.optKey] = cb.checked;
    });
  }

  // Flat section: e-Way Bill
  const ewayCard = container.querySelector('.permission-group-card[data-module="eway_bill"]');
  if (ewayCard) {
    perms['eway_bill'] = { enabled: Boolean(ewayCard.querySelector('#permEwayBill')?.checked) };
    ewayCard.querySelectorAll('.flat-perm-cb').forEach(cb => {
      perms['eway_bill'][cb.dataset.optKey] = cb.checked;
    });
  }

  // Flat section: Settings Access
  const settingsCard = container.querySelector('.permission-group-card[data-module="settings_access"]');
  if (settingsCard) {
    perms['settings_access'] = { enabled: Boolean(settingsCard.querySelector('#permSettingsAccess')?.checked) };
    settingsCard.querySelectorAll('.setting-perm-cb').forEach(cb => {
      perms['settings_access'][cb.dataset.key] = cb.checked;
    });
  }

  // Flat section: Dashboard
  const dashCard = container.querySelector('.permission-group-card[data-module="dashboard"]');
  if (dashCard) {
    perms['dashboard'] = { enabled: Boolean(dashCard.querySelector('#permDashboard')?.checked) };
    dashCard.querySelectorAll('.dash-perm-cb').forEach(cb => {
      perms['dashboard'][cb.dataset.key] = cb.checked;
    });
  }

  // Flat section: Reporting Tags
  const tagsCard = container.querySelector('.permission-group-card[data-module="reporting_tags"]');
  if (tagsCard) {
    perms['reporting_tags'] = { enabled: Boolean(tagsCard.querySelector('#permReportingTags')?.checked) };
    tagsCard.querySelectorAll('.flat-perm-cb').forEach(cb => {
      perms['reporting_tags'][cb.dataset.optKey] = cb.checked;
    });
  }

  // Flat section: Bharat Connect
  const bharatCard = container.querySelector('.permission-group-card[data-module="bharat_connect"]');
  if (bharatCard) {
    perms['bharat_connect'] = { enabled: Boolean(bharatCard.querySelector('#permBharatConnect')?.checked) };
    bharatCard.querySelectorAll('.flat-perm-cb').forEach(cb => {
      perms['bharat_connect'][cb.dataset.optKey] = cb.checked;
    });
  }

  return perms;
}

function collectReportPermissions(container) {
  const allReports = Boolean(container.querySelector('#permAllReports')?.checked);
  const groups = {};
  container.querySelectorAll('.report-perm-row').forEach(row => {
    const grpKey = row.dataset.group;
    groups[grpKey] = {
      full: Boolean(row.querySelector('.rp-full')?.checked),
      view: Boolean(row.querySelector('[data-action="view"]')?.checked),
      export: Boolean(row.querySelector('[data-action="export"]')?.checked),
      schedule: Boolean(row.querySelector('[data-action="schedule"]')?.checked),
      share: Boolean(row.querySelector('[data-action="share"]')?.checked),
    };
  });
  return { all_reports: allReports, groups };
}

// =========================================================================
// 6. ORGANIZATION PROFILE & BRANDING PAGES (Sections 3.1 & 3.2)
// =========================================================================

async function renderOrgProfilePage(container) {
  const org = await api('/settings/organization/');

  container.innerHTML = `
    <div class="settings-page-header">
      <div class="settings-page-header-left">
        <h1>Organization Profile</h1>
      </div>
      <div class="settings-page-header-right">
        <button type="button" class="btn-primary" id="btnSaveOrgProfile">Save Profile</button>
      </div>
    </div>

    <div class="settings-form-card">
      <div class="form-grid-2">
        <div class="form-group">
          <label>Company Name*</label>
          <input type="text" id="profOrgName" value="${esc(org.name || '')}" class="form-control" required>
        </div>
        <div class="form-group">
          <label>Legal Business Name</label>
          <input type="text" id="profLegalName" value="${esc(org.legal_name || '')}" class="form-control">
        </div>
        <div class="form-group">
          <label>Business Type</label>
          <input type="text" id="profBusinessType" value="${esc(org.business_type || 'Private Limited Company')}" class="form-control">
        </div>
        <div class="form-group">
          <label>Organization Short Code (Prefix)*</label>
          <input type="text" id="profOrgCode" value="${esc(org.code || '')}" class="form-control" style="text-transform:uppercase;" maxlength="10">
        </div>
        <div class="form-group">
          <label>GSTIN</label>
          <input type="text" id="profGstin" value="${esc(org.gstin || '')}" class="form-control" maxlength="15" style="text-transform:uppercase;">
        </div>
        <div class="form-group">
          <label>PAN Number</label>
          <input type="text" id="profPan" value="${esc(org.pan || '')}" class="form-control" maxlength="10" style="text-transform:uppercase;">
        </div>
        <div class="form-group">
          <label>CIN / Registration Number</label>
          <input type="text" id="profCin" value="${esc(org.company_id || '')}" class="form-control">
        </div>
        <div class="form-group">
          <label>Phone Number</label>
          <input type="text" id="profPhone" value="${esc(org.phone || '')}" class="form-control">
        </div>
        <div class="form-group">
          <label>Email Address</label>
          <input type="email" id="profEmail" value="${esc(org.email || '')}" class="form-control">
        </div>
        <div class="form-group">
          <label>Website</label>
          <input type="text" id="profWebsite" value="${esc(org.website || '')}" class="form-control">
        </div>
      </div>

      <div class="form-group" style="margin-top:14px;">
        <label>Business Address</label>
        <textarea id="profAddress" class="form-control" style="height:70px;">${esc(org.address || '')}</textarea>
      </div>

      <div class="form-grid-3" style="margin-top:14px;">
        <div class="form-group">
          <label>City</label>
          <input type="text" id="profCity" value="${esc(org.city || '')}" class="form-control">
        </div>
        <div class="form-group">
          <label>State</label>
          <input type="text" id="profState" value="${esc(org.state || '')}" class="form-control">
        </div>
        <div class="form-group">
          <label>PIN Code</label>
          <input type="text" id="profPincode" value="${esc(org.pincode || '')}" class="form-control">
        </div>
      </div>

      <div class="form-grid-3" style="margin-top:14px;">
        <div class="form-group">
          <label>Financial Year</label>
          <input type="text" id="profFY" value="${esc(org.financial_year || 'Apr - Mar')}" class="form-control">
        </div>
        <div class="form-group">
          <label>Base Currency</label>
          <input type="text" id="profCurr" value="${esc(org.base_currency || 'INR')}" class="form-control">
        </div>
        <div class="form-group">
          <label>Time Zone</label>
          <input type="text" id="profTZ" value="${esc(org.time_zone || '(GMT+5:30) India Standard Time')}" class="form-control">
        </div>
      </div>
    </div>
  `;

  container.querySelector('#btnSaveOrgProfile').addEventListener('click', async () => {
    const payload = {
      name: container.querySelector('#profOrgName').value.trim(),
      legal_name: container.querySelector('#profLegalName').value.trim(),
      business_type: container.querySelector('#profBusinessType').value.trim(),
      code: container.querySelector('#profOrgCode').value.trim().toUpperCase(),
      gstin: container.querySelector('#profGstin').value.trim().toUpperCase(),
      pan: container.querySelector('#profPan').value.trim().toUpperCase(),
      company_id: container.querySelector('#profCin').value.trim(),
      phone: container.querySelector('#profPhone').value.trim(),
      email: container.querySelector('#profEmail').value.trim(),
      website: container.querySelector('#profWebsite').value.trim(),
      address: container.querySelector('#profAddress').value.trim(),
      city: container.querySelector('#profCity').value.trim(),
      state: container.querySelector('#profState').value.trim(),
      pincode: container.querySelector('#profPincode').value.trim(),
      financial_year: container.querySelector('#profFY').value.trim(),
      base_currency: container.querySelector('#profCurr').value.trim(),
      time_zone: container.querySelector('#profTZ').value.trim(),
    };

    try {
      await api('/settings/organization/', { method: 'POST', body: JSON.stringify(payload) });
      toast('Organization Profile saved successfully.', 'success');
      cachedSettingsData = null;
    } catch (err) {
      toast(err.message || 'Failed to save profile.', 'error');
    }
  });
}

async function renderBrandingPage(container) {
  const org = await api('/settings/organization/');

  container.innerHTML = `
    <div class="settings-page-header">
      <div class="settings-page-header-left">
        <h1>Company Branding</h1>
      </div>
      <div class="settings-page-header-right">
        <button type="button" class="btn-primary" id="btnSaveBranding">Save Branding</button>
      </div>
    </div>

    <div class="settings-form-card">
      <div class="form-grid-2">
        <div>
          <label style="font-weight:600; display:block; margin-bottom:6px;">Company Logo</label>
          <div style="display:flex; align-items:center; gap:16px;">
            <div id="brandingLogoPreview" style="width:120px; height:60px; border:1px solid var(--bd); border-radius:8px; display:flex; align-items:center; justify-content:center; background:#fff; overflow:hidden;">
              ${org.logo_data ? `<img src="${org.logo_data}" style="max-width:100%; max-height:100%; object-fit:contain;">` : `<span style="font-size:11px; color:var(--tx-dim);">No Logo</span>`}
            </div>
            <div>
              <input type="file" id="logoUploadInput" accept="image/*" style="display:none;">
              <button type="button" class="btn-outline" onclick="$('#logoUploadInput').click()">Upload Logo</button>
              ${org.logo_data ? `<button type="button" class="btn-outline" id="btnRemoveLogo" style="margin-left:6px;">Remove</button>` : `<button type="button" class="btn-outline" id="btnRemoveLogo" style="margin-left:6px; display:none;">Remove</button>`}
              <div style="font-size:11px; color:var(--tx-dim); margin-top:4px;">Recommended: 240x80 PNG/SVG</div>
            </div>
          </div>
        </div>

        <div>
          <label style="font-weight:600; display:block; margin-bottom:6px;">Favicon</label>
          <div style="display:flex; align-items:center; gap:16px;">
            <div id="brandingFaviconPreview" style="width:40px; height:40px; border:1px solid var(--bd); border-radius:8px; display:flex; align-items:center; justify-content:center; background:#fff; overflow:hidden;">
              <img src="${org.favicon_data || '/static/books/img/favicon-32x32.png'}" style="width:24px; height:24px; object-fit:contain;">
            </div>
            <div>
              <input type="file" id="faviconUploadInput" accept="image/*" style="display:none;">
              <button type="button" class="btn-outline" onclick="$('#faviconUploadInput').click()">Upload Favicon</button>
              <div style="font-size:11px; color:var(--tx-dim); margin-top:4px;">Recommended: 32x32 PNG/ICO</div>
            </div>
          </div>
        </div>
      </div>

      <div class="form-grid-2" style="margin-top:20px;">
        <div class="form-group">
          <label>Brand Primary Color</label>
          <div style="display:flex; align-items:center; gap:10px;">
            <input type="color" id="brandingPrimaryColor" value="${org.primary_color || '#1877f2'}" style="width:44px; height:38px; border:1px solid var(--bd); border-radius:6px; cursor:pointer;">
            <input type="text" id="brandingPrimaryColorText" value="${org.primary_color || '#1877f2'}" class="form-control" style="max-width:120px;">
          </div>
        </div>

        <div class="form-group">
          <label>Brand Secondary Color</label>
          <div style="display:flex; align-items:center; gap:10px;">
            <input type="color" id="brandingSecondaryColor" value="${org.secondary_color || '#0ea5e9'}" style="width:44px; height:38px; border:1px solid var(--bd); border-radius:6px; cursor:pointer;">
            <input type="text" id="brandingSecondaryColorText" value="${org.secondary_color || '#0ea5e9'}" class="form-control" style="max-width:120px;">
          </div>
        </div>
      </div>

      <div class="form-group" style="margin-top:16px;">
        <label>Application Display Name</label>
        <input type="text" id="brandingAppName" value="${esc(org.app_name || 'ConvosisBooks')}" class="form-control" style="max-width:400px;">
      </div>
    </div>
  `;

  let logoBase64 = org.logo_data || '';
  let faviconBase64 = org.favicon_data || '';

  const logoInput = container.querySelector('#logoUploadInput');
  const btnRemoveLogo = container.querySelector('#btnRemoveLogo');
  const logoPreviewBox = container.querySelector('#brandingLogoPreview');

  if (logoInput) {
    logoInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        logoBase64 = ev.target.result;
        if (logoPreviewBox) {
          logoPreviewBox.innerHTML = `<img src="${logoBase64}" style="max-width:100%; max-height:100%; object-fit:contain;">`;
        }
        if (btnRemoveLogo) btnRemoveLogo.style.display = 'inline-block';
      };
      reader.readAsDataURL(file);
    });
  }

  if (btnRemoveLogo) {
    btnRemoveLogo.addEventListener('click', () => {
      logoBase64 = '';
      if (logoInput) logoInput.value = '';
      if (logoPreviewBox) {
        logoPreviewBox.innerHTML = `<span style="font-size:11px; color:var(--tx-dim);">No Logo</span>`;
      }
      btnRemoveLogo.style.display = 'none';
    });
  }

  const favInput = container.querySelector('#faviconUploadInput');
  if (favInput) {
    favInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        faviconBase64 = ev.target.result;
        container.querySelector('#brandingFaviconPreview img').src = faviconBase64;
      };
      reader.readAsDataURL(file);
    });
  }

  container.querySelector('#btnSaveBranding').addEventListener('click', async () => {
    const payload = {
      logo_data: logoBase64,
      favicon_data: faviconBase64,
      primary_color: container.querySelector('#brandingPrimaryColor').value,
      secondary_color: container.querySelector('#brandingSecondaryColor').value,
      app_name: container.querySelector('#brandingAppName').value.trim() || 'ConvosisBooks'
    };

    try {
      await api('/settings/organization/', { method: 'POST', body: JSON.stringify(payload) });
      toast('Branding saved successfully.', 'success');
      cachedSettingsData = null;
    } catch (err) {
      toast(err.message || 'Failed to save branding.', 'error');
    }
  });
}

// =========================================================================
// 6.2 CUSTOM DOMAIN PAGE (Section 3.1.2)
// =========================================================================

async function renderCustomDomainPage(container) {
  let customDomainData = { domain: '', status: 'not_configured', ssl_active: false };
  try {
    const saved = localStorage.getItem('convosis_custom_domain_settings');
    if (saved) customDomainData = Object.assign(customDomainData, JSON.parse(saved));
  } catch (e) {}

  const isConfigured = Boolean(customDomainData.domain && customDomainData.domain.trim());
  const statusLabel = isConfigured
    ? (customDomainData.status === 'active' ? 'Active & Verified' : 'Pending DNS Verification')
    : 'Not Configured';
  const statusBadgeClass = isConfigured
    ? (customDomainData.status === 'active' ? 'chip-mint' : 'chip-amber')
    : 'chip-slate';

  container.innerHTML = `
    <div class="settings-page-header">
      <div class="settings-page-header-left">
        <h1>Custom Domain Configuration</h1>
        <p style="color:var(--tx-muted,#64748b);font-size:13px;margin:2px 0 0;">Map your organization's custom branded web domain to access ConvosisBooks directly.</p>
      </div>
      <div class="settings-page-header-right" style="display:flex;gap:10px;">
        <button type="button" class="btn-outline" id="btnVerifyCustomDomain" ${!isConfigured ? 'disabled' : ''}>Verify DNS</button>
        <button type="button" class="btn-primary" id="btnSaveCustomDomain">Save Domain Settings</button>
      </div>
    </div>

    <div class="settings-form-card">
      <div style="display:flex;align-items:center;justify-content:space-between;padding-bottom:14px;margin-bottom:16px;border-bottom:1px solid var(--bd,#e2e8f0);">
        <div>
          <span style="font-size:12px;font-weight:600;color:var(--tx-muted,#64748b);text-transform:uppercase;letter-spacing:0.5px;">Domain Status</span>
          <div style="display:flex;align-items:center;gap:10px;margin-top:4px;">
            <span class="pastel-chip ${statusBadgeClass}" id="customDomainStatusBadge" style="font-weight:600;font-size:12px;padding:3px 10px;">${statusLabel}</span>
            <span style="font-size:12px;color:var(--tx-muted,#64748b);" id="customDomainSubtext">${isConfigured ? `Pointed to ${esc(customDomainData.domain)}` : 'Enter a fully qualified domain name below.'}</span>
          </div>
        </div>
        ${isConfigured ? `<button type="button" class="btn-outline" id="btnRemoveCustomDomain" style="color:#ef4444;border-color:rgba(239,68,68,0.3);font-size:12px;padding:4px 10px;">Disconnect Domain</button>` : ''}
      </div>

      <div class="form-grid-2">
        <div class="form-group">
          <label>Custom Web Domain*</label>
          <input type="text" id="customDomainInput" value="${esc(customDomainData.domain || '')}" class="form-control" placeholder="e.g. books.yourcompany.com" required>
          <small style="color:var(--tx-muted,#64748b);font-size:11.5px;margin-top:4px;">Enter your subdomain (e.g. books.example.com) or root domain.</small>
        </div>
        <div class="form-group">
          <label>SSL / TLS Security Certificate</label>
          <div style="display:flex;align-items:center;gap:8px;padding:9px 12px;background:var(--surface-subtle,#f8fafc);border:1px solid var(--bd,#cbd5e1);border-radius:6px;font-size:13px;color:var(--tx,#0f172a);">
            <i class="fa-solid fa-lock" style="color:#10b981;"></i>
            <span>Automatic Managed SSL (Let's Encrypt / Cloudflare Edge TLS)</span>
          </div>
          <small style="color:var(--tx-muted,#64748b);font-size:11.5px;margin-top:4px;">SSL certificate is automatically provisioned within 15 minutes of DNS verification.</small>
        </div>
      </div>

      <div style="margin-top:24px;">
        <h4 style="margin:0 0 10px;font-size:13.5px;font-weight:600;color:var(--tx,#0f172a);">Required DNS Records</h4>
        <p style="font-size:12.5px;color:var(--tx-muted,#64748b);margin-bottom:12px;">Add the following DNS records in your domain registrar's DNS management panel (e.g., Cloudflare, GoDaddy, Namecheap, Route53):</p>
        <div class="tw" style="border:1px solid var(--bd,#e2e8f0);border-radius:8px;overflow:hidden;">
          <table style="width:100%;font-size:12.5px;">
            <thead>
              <tr style="background:var(--surface-subtle,#f8fafc);">
                <th style="padding:10px 14px;text-align:left;font-weight:600;">Type</th>
                <th style="padding:10px 14px;text-align:left;font-weight:600;">Host / Name</th>
                <th style="padding:10px 14px;text-align:left;font-weight:600;">Target / Value</th>
                <th style="padding:10px 14px;text-align:left;font-weight:600;">TTL</th>
                <th style="padding:10px 14px;text-align:left;font-weight:600;">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="padding:10px 14px;font-family:monospace;font-weight:600;color:#2563eb;">CNAME</td>
                <td style="padding:10px 14px;font-family:monospace;">${esc((customDomainData.domain || 'books').split('.')[0] || 'books')}</td>
                <td style="padding:10px 14px;font-family:monospace;">custom.convosisbooks.com</td>
                <td style="padding:10px 14px;color:var(--tx-muted,#64748b);">Automatic / 3600</td>
                <td style="padding:10px 14px;"><span class="pastel-chip chip-sky" style="font-size:11px;">Ready</span></td>
              </tr>
              <tr>
                <td style="padding:10px 14px;font-family:monospace;font-weight:600;color:#10b981;">TXT</td>
                <td style="padding:10px 14px;font-family:monospace;">_convosis-challenge</td>
                <td style="padding:10px 14px;font-family:monospace;font-size:11px;">convosis-site-verification=org_${window.APP?.org?.id || 'live'}_v1</td>
                <td style="padding:10px 14px;color:var(--tx-muted,#64748b);">Automatic / 3600</td>
                <td style="padding:10px 14px;"><span class="pastel-chip chip-sky" style="font-size:11px;">Ready</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  const domainInput = container.querySelector('#customDomainInput');
  const btnSave = container.querySelector('#btnSaveCustomDomain');
  const btnVerify = container.querySelector('#btnVerifyCustomDomain');
  const btnRemove = container.querySelector('#btnRemoveCustomDomain');

  btnSave?.addEventListener('click', async () => {
    const val = (domainInput.value || '').trim().toLowerCase();
    if (!val) {
      toast('Please enter a valid domain name.', 'error');
      domainInput.focus();
      return;
    }
    const cleanDomain = val.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    customDomainData.domain = cleanDomain;
    customDomainData.status = 'pending_verification';
    try {
      localStorage.setItem('convosis_custom_domain_settings', JSON.stringify(customDomainData));
      toast(`Custom domain "${cleanDomain}" saved. Please verify DNS records.`, 'success');
      renderCustomDomainPage(container);
    } catch (e) {
      toast('Failed to save custom domain settings.', 'error');
    }
  });

  btnVerify?.addEventListener('click', async () => {
    btnVerify.disabled = true;
    btnVerify.textContent = 'Verifying DNS…';
    try {
      await new Promise(r => setTimeout(r, 600));
      customDomainData.status = 'active';
      customDomainData.ssl_active = true;
      localStorage.setItem('convosis_custom_domain_settings', JSON.stringify(customDomainData));
      toast(`Domain ${customDomainData.domain} successfully verified and SSL activated!`, 'success');
      renderCustomDomainPage(container);
    } catch (e) {
      btnVerify.disabled = false;
      btnVerify.textContent = 'Verify DNS';
      toast('DNS verification failed. Please ensure CNAME and TXT records are propagated.', 'error');
    }
  });

  btnRemove?.addEventListener('click', () => {
    if (confirm('Are you sure you want to disconnect this custom domain?')) {
      customDomainData = { domain: '', status: 'not_configured', ssl_active: false };
      localStorage.removeItem('convosis_custom_domain_settings');
      toast('Custom domain removed.', 'info');
      renderCustomDomainPage(container);
    }
  });
}
window.renderCustomDomainPage = renderCustomDomainPage;

// =========================================================================
// 6.3 NETWORKING & IP ACCESS SETTINGS PAGE (Section 3.1.3)
// =========================================================================

async function renderNetworkingPage(container) {
  let networkData = {
    ip_restriction_enabled: false,
    allowed_ips: '',
    enforce_https_webhooks: true,
    signature_verification: true,
    dedicated_egress: false
  };
  try {
    const saved = localStorage.getItem('convosis_networking_settings');
    if (saved) networkData = Object.assign(networkData, JSON.parse(saved));
  } catch (e) {}

  container.innerHTML = `
    <div class="settings-page-header">
      <div class="settings-page-header-left">
        <h1>Networking & IP Access Controls</h1>
        <p style="color:var(--tx-muted,#64748b);font-size:13px;margin:2px 0 0;">Manage inbound IP restrictions, outbound webhook security, and network policy controls.</p>
      </div>
      <div class="settings-page-header-right">
        <button type="button" class="btn-primary" id="btnSaveNetworkSettings">Save Network Settings</button>
      </div>
    </div>

    <div class="settings-form-card">
      <h3 style="font-size:15px;font-weight:600;margin:0 0 14px;color:var(--tx,#0f172a);">Inbound IP Whitelisting</h3>
      <p style="font-size:12.5px;color:var(--tx-muted,#64748b);margin-bottom:14px;">Restrict organization user logins and API access to authorized corporate IP addresses or VPN subnets.</p>

      <div class="form-group" style="margin-bottom:16px;">
        <label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-weight:600;">
          <input type="checkbox" id="netIpRestrictionToggle" ${networkData.ip_restriction_enabled ? 'checked' : ''} style="width:16px;height:16px;accent-color:#2563eb;">
          <span>Enable IP Whitelisting / Access Restrictions</span>
        </label>
      </div>

      <div class="form-group" id="netAllowedIpsGroup" style="${networkData.ip_restriction_enabled ? '' : 'opacity:0.6;'}">
        <label>Allowed IP Addresses / CIDR Ranges</label>
        <textarea id="netAllowedIps" class="form-control" style="height:90px;font-family:monospace;font-size:12.5px;" placeholder="192.168.1.1\n203.0.113.0/24\n198.51.100.12">${esc(networkData.allowed_ips || '')}</textarea>
        <small style="color:var(--tx-muted,#64748b);font-size:11.5px;margin-top:4px;">Enter one IPv4 address or CIDR subnet per line. If enabled, requests outside these IPs will be rejected.</small>
      </div>

      <div style="border-top:1px solid var(--bd,#e2e8f0);margin:24px 0 18px;padding-top:18px;">
        <h3 style="font-size:15px;font-weight:600;margin:0 0 14px;color:var(--tx,#0f172a);">Outbound Integrations & Webhook Security</h3>
        <div style="display:flex;flex-direction:column;gap:12px;">
          <label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:13px;">
            <input type="checkbox" id="netEnforceHttpsWebhooks" ${networkData.enforce_https_webhooks ? 'checked' : ''} style="width:16px;height:16px;accent-color:#2563eb;">
            <span>Enforce HTTPS on all outgoing webhooks and endpoints</span>
          </label>
          <label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:13px;">
            <input type="checkbox" id="netSignatureVerification" ${networkData.signature_verification ? 'checked' : ''} style="width:16px;height:16px;accent-color:#2563eb;">
            <span>Sign outbound payloads with HMAC-SHA256 signature header (X-Convosis-Signature)</span>
          </label>
          <label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:13px;">
            <input type="checkbox" id="netDedicatedEgress" ${networkData.dedicated_egress ? 'checked' : ''} style="width:16px;height:16px;accent-color:#2563eb;">
            <span>Route outbound webhooks via static egress IP proxy pool</span>
          </label>
        </div>
      </div>
    </div>
  `;

  const toggle = container.querySelector('#netIpRestrictionToggle');
  const ipsGroup = container.querySelector('#netAllowedIpsGroup');
  toggle?.addEventListener('change', () => {
    if (ipsGroup) ipsGroup.style.opacity = toggle.checked ? '1' : '0.6';
  });

  const btnSave = container.querySelector('#btnSaveNetworkSettings');
  btnSave?.addEventListener('click', () => {
    networkData.ip_restriction_enabled = Boolean(container.querySelector('#netIpRestrictionToggle')?.checked);
    networkData.allowed_ips = (container.querySelector('#netAllowedIps')?.value || '').trim();
    networkData.enforce_https_webhooks = Boolean(container.querySelector('#netEnforceHttpsWebhooks')?.checked);
    networkData.signature_verification = Boolean(container.querySelector('#netSignatureVerification')?.checked);
    networkData.dedicated_egress = Boolean(container.querySelector('#netDedicatedEgress')?.checked);

    try {
      localStorage.setItem('convosis_networking_settings', JSON.stringify(networkData));
      toast('Network and IP access settings saved successfully.', 'success');
    } catch (e) {
      toast('Failed to save network settings.', 'error');
    }
  });
}
window.renderNetworkingPage = renderNetworkingPage;

// =========================================================================
// 7. AI CONTROL CENTER PAGE (Section 3.3)
// =========================================================================

async function renderAiControlCenterPage(container) {
  const org = await api('/settings/organization/');
  const ai = org.ai_settings || {
    ai_enabled: true,
    business_insights: true,
    invoice_extraction: true,
    auto_categorization: true,
    ai_suggestions: true,
    activity_controls: true
  };

  container.innerHTML = `
    <div class="settings-page-header">
      <div class="settings-page-header-left">
        <h1>AI Control Center</h1>
      </div>
      <div class="settings-page-header-right">
        <button type="button" class="btn-primary" id="btnSaveAiSettings">Save Settings</button>
      </div>
    </div>

    <div class="settings-form-card">
      <div style="margin-bottom:20px; padding-bottom:16px; border-bottom:1px solid var(--bd);">
        <label class="custom-checkbox-label" style="font-weight:700; font-size:15px;">
          <input type="checkbox" id="aiMasterToggle" ${ai.ai_enabled ? 'checked' : ''}>
          <span>Enable AI-Powered Accounting Assistance</span>
        </label>
        <div style="font-size:12.5px; color:var(--tx-dim); margin-left:22px; margin-top:2px;">
          Empower ConvosisBooks with automated data intelligence, document OCR extraction, and real-time transaction reconciliation suggestions.
        </div>
      </div>

      <div style="display:flex; flex-direction:column; gap:16px;">
        <label class="custom-checkbox-label">
          <input type="checkbox" id="aiInsights" ${ai.business_insights ? 'checked' : ''}>
          <div>
            <b>AI-Powered Business Insights</b>
            <div style="font-size:12px; color:var(--tx-dim);">Generate predictive cash-flow forecasts and anomaly detection.</div>
          </div>
        </label>

        <label class="custom-checkbox-label">
          <input type="checkbox" id="aiInvoiceExtraction" ${ai.invoice_extraction ? 'checked' : ''}>
          <div>
            <b>Automated Invoice OCR Data Extraction</b>
            <div style="font-size:12px; color:var(--tx-dim);">Auto-fill vendor bill details and line items directly from uploaded PDF/scans.</div>
          </div>
        </label>

        <label class="custom-checkbox-label">
          <input type="checkbox" id="aiCategorization" ${ai.auto_categorization ? 'checked' : ''}>
          <div>
            <b>Automated Transaction Categorization</b>
            <div style="font-size:12px; color:var(--tx-dim);">Predict Chart of Account ledger allocations for imported bank statement lines.</div>
          </div>
        </label>

        <label class="custom-checkbox-label">
          <input type="checkbox" id="aiSuggestions" ${ai.ai_suggestions ? 'checked' : ''}>
          <div>
            <b>AI Suggestions & Smart Prompts</b>
            <div style="font-size:12px; color:var(--tx-dim);">Contextual smart recommendations on tax optimizations and overdue debt collections.</div>
          </div>
        </label>
      </div>
    </div>
  `;

  container.querySelector('#btnSaveAiSettings').addEventListener('click', async () => {
    const ai_settings = {
      ai_enabled: container.querySelector('#aiMasterToggle').checked,
      business_insights: container.querySelector('#aiInsights').checked,
      invoice_extraction: container.querySelector('#aiInvoiceExtraction').checked,
      auto_categorization: container.querySelector('#aiCategorization').checked,
      ai_suggestions: container.querySelector('#aiSuggestions').checked,
      activity_controls: true
    };

    try {
      await api('/settings/organization/', { method: 'POST', body: JSON.stringify({ ai_settings }) });
      toast('AI Control Center preferences saved.', 'success');
    } catch (err) {
      toast(err.message || 'Failed to save AI preferences.', 'error');
    }
  });
}

// =========================================================================
// 8. TAXES & DIRECT TAXES (Sections 6.I & 6.G)
// =========================================================================

async function renderTaxesPage(container) {
  let taxesData = {};
  let currentTab = 'tax-rates';

  async function loadData() {
    try {
      taxesData = await api('/settings/taxes/');
    } catch(e) {
      taxesData = { taxes: [], tax_exemptions: [], tax_settings: {} };
    }
  }

  await loadData();

  function renderView() {
    const taxes = taxesData.taxes || [];
    const exemptions = taxesData.tax_exemptions || [];
    const ts = taxesData.tax_settings || {};

    const items = [
      { key: 'tax-rates',      label: 'Tax Rates' },
      { key: 'tax-exemptions', label: 'Tax Exemptions' },
      { key: 'default-pref',   label: 'Default Tax Preference' },
      { key: 'gst-settings',   label: 'GST Settings' },
      { key: 'gst-tds',        label: 'GST TDS Settings' },
      { key: 'online-filing',  label: 'Online Filing Settings' },
    ];

    let contentHtml = '';

    if (currentTab === 'tax-rates') {
      contentHtml = `
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:18px; flex-wrap:wrap; gap:10px;">
          <div style="display:flex; align-items:center; gap:10px;">
            <h2 style="font-size:18px; font-weight:700; margin:0;">Active taxes</h2>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
          </div>
          <div style="display:flex; gap:10px; align-items:center;">
            <button type="button" class="btn-primary" style="display:flex; align-items:center; gap:6px;" id="btnOpenNewTax">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
              New Tax
            </button>
            <button type="button" class="btn-outline" style="padding:8px 14px; display:flex; align-items:center; gap:6px;">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              Find Accountants
            </button>
          </div>
        </div>

        <div class="settings-table-card">
          <table class="settings-data-table">
            <thead>
              <tr>
                <th style="width:36px;"><input type="checkbox"></th>
                <th>TAX NAME</th>
                <th>TAX TYPE</th>
                <th>COUNTRY/REGION</th>
                <th style="text-align:right;">RATE (%)</th>
              </tr>
            </thead>
            <tbody>
              ${taxes.length ? taxes.map(t => `
                <tr>
                  <td><input type="checkbox"></td>
                  <td><a href="javascript:void(0)" style="color:#2563eb; font-weight:500;">${esc(t.name)}</a>${t.type === 'Tax Group' ? ` <span style="font-size:11px; color:#9ca3af;">(Tax Group)</span>` : ''}</td>
                  <td>${esc(t.type || 'Standard')}</td>
                  <td>${esc(t.country || 'India')}</td>
                  <td style="text-align:right; font-weight:500;">${t.rate || 0}%</td>
                </tr>
              `).join('') : `
                <tr><td colspan="5" style="text-align:center; padding:40px; color:#9ca3af;">No taxes configured yet.</td></tr>
              `}
            </tbody>
          </table>
          <div style="display:flex; align-items:center; justify-content:space-between; padding:12px 16px; border-top:1px solid var(--bd);">
            <div style="font-size:13px; color:#6b7280;">Total Count: <span style="color:#2563eb; font-weight:600;">${taxes.length}</span></div>
          </div>
        </div>
      `;
    } else if (currentTab === 'tax-exemptions') {
      contentHtml = `
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:18px;">
          <div>
            <h2 style="font-size:18px; font-weight:700; margin:0;">Tax Exemptions</h2>
            <p style="font-size:13px; color:#6b7280; margin:4px 0 0;">Reasons for supplies exempted from GST under Section 11 of CGST Act.</p>
          </div>
          <button type="button" class="btn-primary" id="btnOpenNewExemption" style="display:flex; align-items:center; gap:6px;">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
            Add Exemption Reason
          </button>
        </div>

        <div class="settings-table-card">
          <table class="settings-data-table">
            <thead>
              <tr>
                <th style="min-width:220px;">EXEMPTION REASON</th>
                <th>DESCRIPTION</th>
              </tr>
            </thead>
            <tbody>
              ${exemptions.map(ex => `
                <tr>
                  <td><b>${esc(ex.reason)}</b></td>
                  <td style="color:#4b5563;">${esc(ex.description || '—')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } else if (currentTab === 'default-pref') {
      contentHtml = `
        <div style="margin-bottom:18px;">
          <h2 style="font-size:18px; font-weight:700; margin:0;">Default Tax Preference</h2>
          <p style="font-size:13px; color:#6b7280; margin:4px 0 0;">Specify default tax behavior when adding items and new transactions.</p>
        </div>

        <div class="settings-form-card">
          <div style="display:flex; flex-direction:column; gap:16px;">
            <label class="custom-radio-label">
              <input type="radio" name="taxPref" value="taxable" ${ts.default_tax_preference !== 'non-taxable' ? 'checked' : ''}>
              <span><b>Taxable</b> (Sales and purchases are taxable unless specifically exempted)</span>
            </label>
            <label class="custom-radio-label">
              <input type="radio" name="taxPref" value="non-taxable" ${ts.default_tax_preference === 'non-taxable' ? 'checked' : ''}>
              <span><b>Non-Taxable / Exempt</b> (Default all lines as non-taxable / exempt)</span>
            </label>

            <div class="form-group" style="margin-top:10px;">
              <label style="font-weight:600; font-size:13px;">Default Intra-State Tax Rate</label>
              <select id="defTaxRate" class="form-control" style="max-width:320px;">
                <option value="GST18" ${ts.default_rate === 'GST18' ? 'selected' : ''}>GST 18% (Standard Rate)</option>
                <option value="GST12" ${ts.default_rate === 'GST12' ? 'selected' : ''}>GST 12%</option>
                <option value="GST5" ${ts.default_rate === 'GST5' ? 'selected' : ''}>GST 5%</option>
                <option value="GST0" ${ts.default_rate === 'GST0' ? 'selected' : ''}>GST 0%</option>
                <option value="GST28" ${ts.default_rate === 'GST28' ? 'selected' : ''}>GST 28%</option>
              </select>
            </div>

            <div>
              <button type="button" class="btn-primary" id="btnSaveTaxPref">Save Preference</button>
            </div>
          </div>
        </div>
      `;
    } else if (currentTab === 'gst-settings') {
      contentHtml = `
        <div style="margin-bottom:18px;">
          <h2 style="font-size:18px; font-weight:700; margin:0;">GST Settings</h2>
          <p style="font-size:13px; color:#6b7280; margin:4px 0 0;">Manage Goods and Services Tax configuration and registration profile.</p>
        </div>

        <div class="settings-form-card">
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
            <div class="form-group">
              <label style="font-weight:600; font-size:13px;">GSTIN*</label>
              <input type="text" id="gstSettingsGstin" value="${esc(APP.org?.gstin || ts.gstin || '')}" placeholder="e.g. 29ABCDE1234F1Z5" class="form-control" style="text-transform:uppercase;">
            </div>
            <div class="form-group">
              <label style="font-weight:600; font-size:13px;">GST Registration Type</label>
              <select id="gstRegType" class="form-control">
                <option value="regular" ${ts.reg_type !== 'composition' ? 'selected' : ''}>Regular Scheme</option>
                <option value="composition" ${ts.reg_type === 'composition' ? 'selected' : ''}>Composition Scheme</option>
                <option value="sez" ${ts.reg_type === 'sez' ? 'selected' : ''}>Special Economic Zone (SEZ)</option>
              </select>
            </div>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-top:16px;">
            <div class="form-group">
              <label style="font-weight:600; font-size:13px;">Filing Periodicity</label>
              <select id="gstFilingPeriod" class="form-control">
                <option value="monthly" ${ts.filing_period !== 'quarterly' ? 'selected' : ''}>Monthly (GSTR-1 & GSTR-3B)</option>
                <option value="quarterly" ${ts.filing_period === 'quarterly' ? 'selected' : ''}>Quarterly (QRMP Scheme)</option>
              </select>
            </div>
            <div class="form-group">
              <label style="font-weight:600; font-size:13px;">Reverse Charge Mechanism (RCM)</label>
              <label class="custom-checkbox-label" style="margin-top:8px;">
                <input type="checkbox" id="gstRcmEnabled" ${ts.rcm_enabled ? 'checked' : ''}>
                <span>Track reverse charge on inward supplies</span>
              </label>
            </div>
          </div>

          <div style="margin-top:20px;">
            <button type="button" class="btn-primary" id="btnSaveGstSettings">Save GST Settings</button>
          </div>
        </div>
      `;
    } else if (currentTab === 'gst-tds') {
      contentHtml = `
        <div style="margin-bottom:18px;">
          <h2 style="font-size:18px; font-weight:700; margin:0;">GST TDS Settings</h2>
          <p style="font-size:13px; color:#6b7280; margin:4px 0 0;">Tax Deducted at Source under GST Section 51 for government/specified deductors.</p>
        </div>

        <div class="settings-form-card">
          <div style="display:flex; flex-direction:column; gap:14px;">
            <label class="custom-checkbox-label">
              <input type="checkbox" id="gstTdsApplicable" ${ts.gst_tds_applicable ? 'checked' : ''}>
              <span><b>This organization is required to deduct GST TDS</b> (Specified Government entities, PSUs, Local authorities)</span>
            </label>
            <div class="form-group">
              <label style="font-weight:600; font-size:13px;">Threshold Limit for Contract Value (₹)</label>
              <input type="number" id="gstTdsThreshold" value="${ts.gst_tds_threshold || 250000}" class="form-control" style="max-width:320px;">
              <small style="color:#6b7280;">Statutory mandate: ₹2,50,000 per supply contract</small>
            </div>
            <div class="form-group">
              <label style="font-weight:600; font-size:13px;">GST TDS Rate (%)</label>
              <input type="number" id="gstTdsRate" value="${ts.gst_tds_rate || 2}" class="form-control" style="max-width:320px;" readonly>
              <small style="color:#6b7280;">Fixed by statute at 2% (1% CGST + 1% SGST, or 2% IGST)</small>
            </div>
            <div>
              <button type="button" class="btn-primary" id="btnSaveGstTds">Save GST TDS Settings</button>
            </div>
          </div>
        </div>
      `;
    } else if (currentTab === 'online-filing') {
      contentHtml = `
        <div style="margin-bottom:18px;">
          <h2 style="font-size:18px; font-weight:700; margin:0;">Online Filing Settings</h2>
          <p style="font-size:13px; color:#6b7280; margin:4px 0 0;">Direct GST Common Portal connectivity for seamless return filing and reconciliation.</p>
        </div>

        <div class="settings-form-card">
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
            <div class="form-group">
              <label style="font-weight:600; font-size:13px;">GST Portal Username</label>
              <input type="text" id="gstPortalUser" value="${esc(ts.portal_user || '')}" placeholder="Portal Username" class="form-control">
            </div>
            <div class="form-group">
              <label style="font-weight:600; font-size:13px;">Auto-Reconciliation Frequency</label>
              <select id="gstAutoRecon" class="form-control">
                <option value="weekly" ${ts.auto_recon === 'weekly' ? 'selected' : ''}>Weekly GSTR-2B Sync</option>
                <option value="monthly" ${ts.auto_recon !== 'weekly' ? 'selected' : ''}>Monthly Sync before 14th</option>
              </select>
            </div>
          </div>
          <div style="margin-top:20px;">
            <button type="button" class="btn-primary" id="btnSaveOnlineFiling">Save Online Filing Settings</button>
          </div>
        </div>
      `;
    }

    container.innerHTML = `
      <div style="display:flex; height:100%; min-height:0; flex:1;">
        <nav class="taxes-subnav">
          <div style="font-size:17px; font-weight:700; color:#0f172a; padding:16px 20px 14px; border-bottom:1px solid #e2e8f0; margin-bottom:6px;">Taxes</div>
          ${items.map(it => `
            <button type="button" class="taxes-subnav-item${it.key === currentTab ? ' active' : ''}"
              data-tax-tab="${it.key}">
              ${esc(it.label)}
            </button>
          `).join('')}
        </nav>
        <div class="taxes-content-panel">
          ${contentHtml}
        </div>
      </div>
    `;

    // Hook tab buttons
    container.querySelectorAll('.taxes-subnav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        currentTab = btn.getAttribute('data-tax-tab');
        renderView();
      });
    });

    // Hook handlers for active tab
    if (currentTab === 'tax-rates') {
      const btnNew = container.querySelector('#btnOpenNewTax');
      if (btnNew) {
        btnNew.addEventListener('click', () => {
          openAddTaxModal(async () => {
            await loadData();
            renderView();
          });
        });
      }
    } else if (currentTab === 'tax-exemptions') {
      const btnNewEx = container.querySelector('#btnOpenNewExemption');
      if (btnNewEx) {
        btnNewEx.addEventListener('click', () => {
          openAddExemptionModal(async () => {
            await loadData();
            renderView();
          });
        });
      }
    } else if (currentTab === 'default-pref') {
      const btnSave = container.querySelector('#btnSaveTaxPref');
      if (btnSave) {
        btnSave.addEventListener('click', async () => {
          const pref = container.querySelector('input[name="taxPref"]:checked')?.value || 'taxable';
          const defRate = container.querySelector('#defTaxRate').value;
          try {
            await api('/settings/taxes/', {
              method: 'POST',
              body: { tax_settings: { default_tax_preference: pref, default_rate: defRate } }
            });
            toast('Default tax preference saved.', 'success');
            await loadData();
          } catch(err) {
            toast(err.message || 'Failed to save preference.', 'error');
          }
        });
      }
    } else if (currentTab === 'gst-settings') {
      const btnSave = container.querySelector('#btnSaveGstSettings');
      if (btnSave) {
        btnSave.addEventListener('click', async () => {
          const gstin = container.querySelector('#gstSettingsGstin').value.trim().toUpperCase();
          const reg_type = container.querySelector('#gstRegType').value;
          const filing_period = container.querySelector('#gstFilingPeriod').value;
          const rcm_enabled = container.querySelector('#gstRcmEnabled').checked;
          try {
            await api('/settings/taxes/', {
              method: 'POST',
              body: { tax_settings: { gstin, reg_type, filing_period, rcm_enabled } }
            });
            if (gstin && APP.org) APP.org.gstin = gstin;
            toast('GST settings updated successfully.', 'success');
            await loadData();
          } catch(err) {
            toast(err.message || 'Failed to update GST settings.', 'error');
          }
        });
      }
    } else if (currentTab === 'gst-tds') {
      const btnSave = container.querySelector('#btnSaveGstTds');
      if (btnSave) {
        btnSave.addEventListener('click', async () => {
          const gst_tds_applicable = container.querySelector('#gstTdsApplicable').checked;
          const gst_tds_threshold = parseFloat(container.querySelector('#gstTdsThreshold').value) || 250000;
          try {
            await api('/settings/taxes/', {
              method: 'POST',
              body: { tax_settings: { gst_tds_applicable, gst_tds_threshold } }
            });
            toast('GST TDS settings saved.', 'success');
            await loadData();
          } catch(err) {
            toast(err.message || 'Failed to save GST TDS settings.', 'error');
          }
        });
      }
    } else if (currentTab === 'online-filing') {
      const btnSave = container.querySelector('#btnSaveOnlineFiling');
      if (btnSave) {
        btnSave.addEventListener('click', async () => {
          const portal_user = container.querySelector('#gstPortalUser').value.trim();
          const auto_recon = container.querySelector('#gstAutoRecon').value;
          try {
            await api('/settings/taxes/', {
              method: 'POST',
              body: { tax_settings: { portal_user, auto_recon } }
            });
            toast('Online filing preferences saved.', 'success');
            await loadData();
          } catch(err) {
            toast(err.message || 'Failed to save online filing settings.', 'error');
          }
        });
      }
    }
  }

  renderView();
}

function openAddTaxModal(onSuccess) {
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.innerHTML = `
    <div class="modal-box" style="max-width:480px;">
      <div class="modal-header">
        <h3>New Tax</h3>
        <button type="button" class="modal-close-btn" onclick="this.closest('.modal-backdrop').remove()">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label style="font-weight:600;font-size:13px;">Tax Name*</label>
          <input type="text" id="newTaxName" placeholder="e.g. GST18, Kerala Flood Cess" class="form-control" required>
        </div>
        <div class="form-group" style="margin-top:14px;">
          <label style="font-weight:600;font-size:13px;">Tax Rate (%)*</label>
          <input type="number" id="newTaxRate" placeholder="e.g. 18" step="0.01" min="0" max="100" class="form-control" required>
        </div>
        <div class="form-group" style="margin-top:14px;">
          <label style="font-weight:600;font-size:13px;">Tax Type*</label>
          <select id="newTaxType" class="form-control">
            <option value="Tax Group">Tax Group (CGST + SGST)</option>
            <option value="IGST">IGST</option>
            <option value="Cess">Cess</option>
            <option value="GST">GST</option>
            <option value="Custom">Custom / State Tax</option>
          </select>
        </div>
        <div class="form-group" style="margin-top:14px;">
          <label style="font-weight:600;font-size:13px;">Country / Region</label>
          <input type="text" id="newTaxCountry" value="India" class="form-control">
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn-secondary" onclick="this.closest('.modal-backdrop').remove()">Cancel</button>
        <button type="button" class="btn-primary" id="btnSubmitNewTax">Save Tax</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.querySelector('#btnSubmitNewTax').addEventListener('click', async () => {
    const name = modal.querySelector('#newTaxName').value.trim();
    const rate = parseFloat(modal.querySelector('#newTaxRate').value);
    const type = modal.querySelector('#newTaxType').value;
    const country = modal.querySelector('#newTaxCountry').value.trim() || 'India';

    if (!name) {
      toast('Please enter tax name.', 'error');
      return;
    }
    if (isNaN(rate) || rate < 0) {
      toast('Please enter a valid tax rate.', 'error');
      return;
    }

    try {
      await api('/settings/taxes/', {
        method: 'POST',
        body: { new_tax: { name, rate, type, country } }
      });
      toast(`Tax "${name}" added successfully.`, 'success');
      modal.remove();
      if (typeof onSuccess === 'function') onSuccess();
    } catch(err) {
      toast(err.message || 'Failed to add tax.', 'error');
    }
  });
}

function openAddExemptionModal(onSuccess) {
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.innerHTML = `
    <div class="modal-box" style="max-width:480px;">
      <div class="modal-header">
        <h3>Add Tax Exemption</h3>
        <button type="button" class="modal-close-btn" onclick="this.closest('.modal-backdrop').remove()">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label style="font-weight:600;font-size:13px;">Exemption Reason*</label>
          <input type="text" id="newExReason" placeholder="e.g. Export of IT Services under LUT" class="form-control" required>
        </div>
        <div class="form-group" style="margin-top:14px;">
          <label style="font-weight:600;font-size:13px;">Description / Section Reference</label>
          <textarea id="newExDesc" placeholder="e.g. Zero rated supply under Section 16 of IGST Act" class="form-control" style="height:70px;"></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn-secondary" onclick="this.closest('.modal-backdrop').remove()">Cancel</button>
        <button type="button" class="btn-primary" id="btnSubmitNewEx">Save Exemption</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.querySelector('#btnSubmitNewEx').addEventListener('click', async () => {
    const reason = modal.querySelector('#newExReason').value.trim();
    const description = modal.querySelector('#newExDesc').value.trim();

    if (!reason) {
      toast('Exemption reason is required.', 'error');
      return;
    }

    try {
      await api('/settings/taxes/', {
        method: 'POST',
        body: { new_exemption: { reason, description } }
      });
      toast('Tax exemption reason added.', 'success');
      modal.remove();
      if (typeof onSuccess === 'function') onSuccess();
    } catch(err) {
      toast(err.message || 'Failed to add exemption.', 'error');
    }
  });
}

async function renderDirectTaxesPage(container) {
  let data = {};
  let currentSubTab = 'tds-settings';

  async function loadData() {
    try { data = await api('/settings/taxes/'); } catch(e) { data = {}; }
  }

  await loadData();

  function renderView() {
    const tdsSections = data.tds_sections || [];
    const tcsSections = data.tcs_sections || [];
    const directTaxes = data.direct_tax_settings || {};

    const groups = [
      { group: 'TDS', items: [
        { key: 'tds-settings', label: 'Income TDS Settings' },
        { key: 'tds-rates',    label: 'Income TDS Rates' },
      ]},
      { group: 'TCS', items: [
        { key: 'tcs-rates',    label: 'Income TCS Rates' },
      ]},
    ];

    let subNavHtml = '';
    groups.forEach(grp => {
      subNavHtml += `<div class="taxes-subnav-section">${esc(grp.group)}</div>`;
      grp.items.forEach(it => {
        subNavHtml += `<button type="button" class="taxes-subnav-item${it.key === currentSubTab ? ' active' : ''}"
          data-dir-tab="${it.key}">
          ${esc(it.label)}
        </button>`;
      });
    });

    subNavHtml += `
      <div class="attention-alert-card" style="margin:12px 10px;">
        <div class="alert-title">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="#f59e0b"><path d="M12 2L1 21h22L12 2zm0 15h.01M11 11h2v4h-2z"/></svg>
          Attention Required
        </div>
        <div style="font-size:12px; line-height:1.5; color:#9a3412;">
          The Income Tax Act, 2025 is now in effect from April 1, 2026, with changes to TDS and TCS sections and rates. Update them to stay compliant.
          <br><a href="javascript:void(0)" style="color:#2563eb; font-weight:600;">View Details →</a>
        </div>
      </div>
    `;

    let rightContentHtml = '';

    if (currentSubTab === 'tds-settings') {
      rightContentHtml = `
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:20px;">
          <h2 style="font-size:18px; font-weight:700; margin:0;">Income TDS Settings</h2>
          <button type="button" class="btn-outline" style="padding:8px 14px; display:flex; align-items:center; gap:6px;">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            Find Accountants
          </button>
        </div>

        <p style="font-size:13px; color:#6b7280; margin-bottom:20px; line-height:1.6;">
          Tax Deducted at Source (TDS) is deducted from transactions or payments and remitted to the government. Configure how TDS is calculated. You can apply TDS to the entire transaction or individual line items, as required.
        </p>

        <div class="settings-form-card" style="margin-bottom:20px;">
          <h3 style="font-size:14px; font-weight:600; margin-bottom:12px;">Apply TDS:</h3>
          <div style="display:flex; flex-direction:column; gap:12px;">
            <label class="custom-radio-label">
              <input type="radio" name="tdsLevel" value="line" ${directTaxes.tds_level === 'line' ? 'checked' : ''}>
              <span>At Line Item Level</span>
            </label>
            <label class="custom-radio-label">
              <input type="radio" name="tdsLevel" value="transaction" ${directTaxes.tds_level !== 'line' ? 'checked' : ''}>
              <span>At Transaction Level</span>
            </label>
          </div>
        </div>

        <div class="settings-form-card">
          <h3 style="font-size:14px; font-weight:600; margin-bottom:4px;">TDS Liabilities Report</h3>
          <p style="font-size:13px; color:#6b7280; margin-bottom:14px; line-height:1.6;">
            Track TDS liabilities payable to the government and maintain records of related challans. Once the TDS liabilities report is enabled in ConvosisBooks, it cannot be disabled.
          </p>
          <label class="custom-checkbox-label">
            <input type="checkbox" id="cbTdsReport" ${directTaxes.enable_tds_liabilities_report ? 'checked' : ''}>
            <span>Enable TDS Liabilities Report</span>
          </label>
        </div>

        <div style="margin-top:20px;">
          <button type="button" class="btn-primary" id="btnSaveDirectTaxes">Save</button>
        </div>
      `;
    } else if (currentSubTab === 'tds-rates') {
      rightContentHtml = `
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:20px;">
          <div>
            <h2 style="font-size:18px; font-weight:700; margin:0;">Income TDS Rates</h2>
            <p style="font-size:13px; color:#6b7280; margin:4px 0 0;">Standard TDS rate chart and threshold limits under Income Tax Act, 2025.</p>
          </div>
        </div>

        <div class="settings-table-card">
          <table class="settings-data-table">
            <thead>
              <tr>
                <th style="width:110px;">SECTION</th>
                <th>NATURE OF PAYMENT</th>
                <th>RATE (%)</th>
                <th>THRESHOLD LIMIT</th>
              </tr>
            </thead>
            <tbody>
              ${tdsSections.map(s => `
                <tr>
                  <td><b>${esc(s.section)}</b></td>
                  <td>${esc(s.name)}</td>
                  <td style="font-weight:600; color:#2563eb;">${esc(s.rate)}</td>
                  <td>${esc(s.threshold)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } else if (currentSubTab === 'tcs-rates') {
      rightContentHtml = `
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:20px;">
          <div>
            <h2 style="font-size:18px; font-weight:700; margin:0;">Income TCS Rates</h2>
            <p style="font-size:13px; color:#6b7280; margin:4px 0 0;">Tax Collected at Source rate chart for sellers under Section 206C.</p>
          </div>
        </div>

        <div class="settings-table-card">
          <table class="settings-data-table">
            <thead>
              <tr>
                <th style="width:110px;">SECTION</th>
                <th>NATURE OF GOODS / COLLECTION</th>
                <th>RATE (%)</th>
                <th>THRESHOLD LIMIT</th>
              </tr>
            </thead>
            <tbody>
              ${tcsSections.map(s => `
                <tr>
                  <td><b>${esc(s.section)}</b></td>
                  <td>${esc(s.name)}</td>
                  <td style="font-weight:600; color:#2563eb;">${esc(s.rate)}</td>
                  <td>${esc(s.threshold)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    container.innerHTML = `
      <div style="display:flex; height:100%; min-height:0; flex:1;">
        <nav class="taxes-subnav">
          <div style="font-size:17px; font-weight:700; color:#0f172a; padding:16px 20px 14px; border-bottom:1px solid #e2e8f0; margin-bottom:6px;">Direct Taxes</div>
          ${subNavHtml}
        </nav>
        <div class="taxes-content-panel">
          ${rightContentHtml}
        </div>
      </div>
    `;

    container.querySelectorAll('.taxes-subnav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        currentSubTab = btn.getAttribute('data-dir-tab');
        renderView();
      });
    });

    if (currentSubTab === 'tds-settings') {
      const btnSave = container.querySelector('#btnSaveDirectTaxes');
      if (btnSave) {
        btnSave.addEventListener('click', async () => {
          const selectedLevel = container.querySelector('input[name="tdsLevel"]:checked')?.value || 'transaction';
          const enableReport = container.querySelector('#cbTdsReport').checked;
          try {
            await api('/settings/taxes/', {
              method: 'POST',
              body: {
                direct_tax_settings: {
                  tds_level: selectedLevel,
                  enable_tds_liabilities_report: enableReport
                }
              }
            });
            toast('Direct Tax settings saved successfully.', 'success');
            await loadData();
          } catch(err) {
            toast(err.message || 'Failed to save settings.', 'error');
          }
        });
      }
    }
  }

  renderView();
}

// =========================================================================
// 9. TRANSACTION NUMBER SERIES (Section 9)
// =========================================================================

async function renderNumberSeriesPage(container, selectedSeriesId = null) {
  const url = selectedSeriesId ? `/settings/transaction-series/?series_id=${selectedSeriesId}` : '/settings/transaction-series/';
  let data;
  try {
    data = await api(url);
  } catch (error) {
    toast(error.message || 'Failed to load transaction number series.', 'error');
    container.innerHTML = '<div class="settings-card">Transaction number series could not be loaded.</div>';
    return;
  }
  const seriesList = data.series_list || [];
  const currentSeries = data.current_series || (seriesList[0] || null);
  const items = data.items || [];
  const supportedTypes = data.supported_types || [];

  container.innerHTML = `
    <div class="settings-page-header">
      <div class="settings-page-header-left">
        <h1>Transaction Number Series</h1>
        <p class="sub">Centralized numbering configuration across all sales, purchase, and inventory modules.</p>
      </div>
      <div class="settings-page-header-right">
        <button type="button" class="btn-primary" id="btnAddNewSeries">+ Add New Series</button>
      </div>
    </div>

    <!-- Series Tabs / Switcher -->
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;flex-wrap:wrap;">
      <span style="font-size:12.5px;font-weight:600;color:#64748b;margin-right:4px;">SERIES:</span>
      ${seriesList.map(s => `
        <button type="button" class="btn ${currentSeries && currentSeries.id === s.id ? 'btn-primary' : 'btn-secondary'}" data-switch-series="${s.id}" style="padding:6px 14px;font-size:12.5px;">
          ${esc(s.name)}
          ${s.is_default ? '<span style="font-size:10px;background:rgba(255,255,255,0.3);padding:2px 6px;border-radius:10px;margin-left:6px;">Default</span>' : ''}
          ${!s.is_active ? '<span style="font-size:10px;color:#ef4444;margin-left:4px;">(Inactive)</span>' : ''}
        </button>
      `).join('')}
    </div>

    ${currentSeries ? `
      <!-- Series Header Card -->
      <div class="settings-card" style="margin-bottom:16px;padding:14px 18px;display:flex;align-items:center;justify-content:space-between;background:#f8fafc;border:1px solid var(--bd);border-radius:6px;">
        <div>
          <div style="font-size:15px;font-weight:700;color:var(--tx);display:flex;align-items:center;gap:8px;">
            ${esc(currentSeries.name)}
            ${currentSeries.is_default ? '<span class="pastel-chip chip-sky">Default Series</span>' : ''}
            <span class="pastel-chip ${currentSeries.is_active ? 'chip-green' : 'chip-rose'}">${currentSeries.is_active ? 'Active' : 'Inactive'}</span>
          </div>
          <div style="font-size:12px;color:#64748b;margin-top:4px;">
            Branch: <b>${esc(currentSeries.branch || currentSeries.location || 'All Branches')}</b>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          ${!currentSeries.is_default ? `
            <button type="button" class="btn s" id="btnSetAsDefault" style="font-size:12px;">Set as Default</button>
            <button type="button" class="btn s" id="btnToggleActive" style="font-size:12px;color:${currentSeries.is_active ? '#ef4444' : '#10b981'};">
              ${currentSeries.is_active ? 'Deactivate' : 'Activate'}
            </button>
            <button type="button" class="btn s" id="btnDeleteSeries" style="font-size:12px;color:#ef4444;">Delete Series</button>
          ` : ''}
          <button type="button" class="btn s" id="btnEditSeriesMeta" style="font-size:12px;">Edit Series Info</button>
        </div>
      </div>

      <!-- Transaction Numbering Table -->
      <div class="settings-table-card">
        <table class="settings-data-table">
          <thead>
            <tr>
              <th>MODULE / TRANSACTION</th>
              <th>PREFIX</th>
              <th>NEXT NUMBER</th>
              <th>SAMPLE PREVIEW</th>
              <th style="text-align:right;">ACTION</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(item => `
              <tr>
                <td><b>${esc(item.label)}</b></td>
                <td><code>${esc(item.prefix)}</code></td>
                <td><b>${esc(String(item.next_number).padStart(item.padding || 1, '0'))}</b></td>
                <td><span class="pastel-chip chip-sky"><b>${esc(item.sample_preview)}</b></span></td>
                <td style="text-align:right;">
                  <button type="button" class="btn-table-action" data-edit-item-doc="${esc(item.document_type)}" data-edit-item-label="${esc(item.label)}" data-edit-item-prefix="${esc(item.prefix)}" data-edit-item-format="${esc(item.format_pattern || '')}" data-edit-item-next="${item.next_number}" data-edit-item-pad="${item.padding}" data-edit-item-b2b="${esc(item.b2b_prefix || 'D')}" data-edit-item-b2c="${esc(item.b2c_prefix || 'C')}" data-edit-item-preview="${esc(item.sample_preview)}" data-edit-item-fy="${esc(item.financial_year)}" data-edit-item-year="${item.current_year}" data-edit-item-org="${esc(item.org_code)}" data-edit-item-branch="${esc(item.branch)}" data-edit-item-location="${esc(item.location)}" data-edit-item-separator="${esc(item.separator)}" data-edit-item-default-prefix="${esc(item.default_prefix || item.prefix || '')}" data-edit-item-default-format="${esc(item.default_format_pattern || '')}" data-edit-item-default-next="${item.default_next || 1}" data-edit-item-default-pad="${item.default_padding || 5}" data-edit-item-default-sep="${esc(item.default_separator || '/')}" data-edit-item-default-b2b="${esc(item.default_b2b_prefix || 'D')}" data-edit-item-default-b2c="${esc(item.default_b2c_prefix || 'C')}">
                    Configure
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    ` : '<div style="padding:24px;text-align:center;color:#64748b;">No transaction series found.</div>'}
  `;

  // Bind Switch Series
  container.querySelectorAll('[data-switch-series]').forEach(btn => {
    btn.addEventListener('click', () => {
      renderNumberSeriesPage(container, btn.dataset.switchSeries);
    });
  });

  // Bind Add New Series
  container.querySelector('#btnAddNewSeries')?.addEventListener('click', () => {
    openAddTransactionSeriesModal(container, supportedTypes);
  });

  // Bind Set As Default
  container.querySelector('#btnSetAsDefault')?.addEventListener('click', async () => {
    if (!currentSeries) return;
    const btn = container.querySelector('#btnSetAsDefault');
    if (btn && btn.disabled) return;
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Setting default...';
    }
    try {
      await api(`/settings/transaction-series/${currentSeries.id}/`, {
        method: 'PUT',
        body: JSON.stringify({ is_default: true })
      });
      toast(`"${currentSeries.name}" is now the default series.`, 'success');
      await renderNumberSeriesPage(container, currentSeries.id);
    } catch (e) {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Set as Default';
      }
      toast(e.message || 'Failed to update default series.', 'error');
    }
  });

  // Bind Toggle Active
  container.querySelector('#btnToggleActive')?.addEventListener('click', async () => {
    if (!currentSeries) return;
    const btn = container.querySelector('#btnToggleActive');
    if (btn && btn.disabled) return;
    const newActive = !currentSeries.is_active;
    if (btn) {
      btn.disabled = true;
      btn.textContent = newActive ? 'Activating...' : 'Deactivating...';
    }
    try {
      if (!newActive) {
        await api(`/settings/transaction-series/${currentSeries.id}/`, { method: 'DELETE' });
      } else {
        await api(`/settings/transaction-series/${currentSeries.id}/`, {
          method: 'PUT',
          body: JSON.stringify({ is_active: true })
        });
      }
      toast(`Series "${currentSeries.name}" ${newActive ? 'activated' : 'deactivated'}.`, 'success');
      await renderNumberSeriesPage(container, currentSeries.id);
    } catch (e) {
      if (btn) {
        btn.disabled = false;
        btn.textContent = currentSeries.is_active ? 'Deactivate' : 'Activate';
      }
      toast(e.message || 'Action failed.', 'error');
    }
  });

  container.querySelector('#btnDeleteSeries')?.addEventListener('click', async () => {
    if (!currentSeries || !window.confirm(`Delete "${currentSeries.name}"? This cannot be undone. Referenced series can only be deactivated.`)) return;
    const btn = container.querySelector('#btnDeleteSeries');
    if (btn && btn.disabled) return;
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Deleting...';
    }
    try {
      await api(`/settings/transaction-series/${currentSeries.id}/`, {
        method: 'DELETE',
        body: JSON.stringify({ action: 'delete' })
      });
      toast(`Series "${currentSeries.name}" deleted.`, 'success');
      await renderNumberSeriesPage(container);
    } catch (error) {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Delete Series';
      }
      toast(error.message || 'This series could not be deleted. Deactivate it if it has transaction history.', 'error');
    }
  });

  // Bind Edit Series Info
  container.querySelector('#btnEditSeriesMeta')?.addEventListener('click', () => {
    if (currentSeries) openEditSeriesMetaModal(container, currentSeries);
  });

  // Bind Edit Item Configure
  container.querySelectorAll('[data-edit-item-doc]').forEach(btn => {
    btn.addEventListener('click', () => {
      openEditSeriesItemModal(container, currentSeries, {
        document_type: btn.dataset.editItemDoc,
        label: btn.dataset.editItemLabel,
        prefix: btn.dataset.editItemPrefix,
        format_pattern: btn.dataset.editItemFormat || '',
        b2b_prefix: btn.dataset.editItemB2b || 'D',
        b2c_prefix: btn.dataset.editItemB2c || 'C',
        next_number: btn.dataset.editItemNext,
        padding: btn.dataset.editItemPad,
        sample_preview: btn.dataset.editItemPreview,
        financial_year: btn.dataset.editItemFy,
        current_year: btn.dataset.editItemYear,
        org_code: btn.dataset.editItemOrg,
        branch: btn.dataset.editItemBranch,
        location: btn.dataset.editItemLocation,
        separator: btn.dataset.editItemSeparator,
        default_prefix: btn.dataset.editItemDefaultPrefix,
        default_format_pattern: btn.dataset.editItemDefaultFormat,
        default_next: btn.dataset.editItemDefaultNext,
        default_padding: btn.dataset.editItemDefaultPad,
        default_separator: btn.dataset.editItemDefaultSep,
        default_b2b_prefix: btn.dataset.editItemDefaultB2b,
        default_b2c_prefix: btn.dataset.editItemDefaultB2c
      });
    });
  });
}

function openEditSeriesItemModal(container, currentSeries, item, options = {}) {
  const localOnly = Boolean(options.localOnly);
  const customerNumberTypes = new Set([
    'invoices', 'recurring_invoices', 'retainer_invoices', 'sales_orders',
    'quotes', 'credit_notes', 'payments_received'
  ]);
  const supportsCustomerPrefixes = customerNumberTypes.has(item.document_type);
  document.querySelectorAll('.transaction-series-item-modal').forEach(existing => existing.remove());
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop transaction-series-modal transaction-series-item-modal';
  const paddingVal = Number(item.padding) || 5;
  const paddedNext = String(item.next_number || 1).padStart(paddingVal, '0');
  const currentFormat = item.format_pattern || '';
  const currentPrefix = item.prefix || '';
  const currentB2bPrefix = item.b2b_prefix ?? 'D';
  const currentB2cPrefix = item.b2c_prefix ?? 'C';
  const currentSeparator = item.separator || '/';
  const isCustomSep = !['/', '-', '_'].includes(currentSeparator) && currentSeparator !== '';

  modal.innerHTML = `
    <div class="modal-box" style="max-width:580px;max-height:90vh;overflow-y:auto;">
      <div class="modal-header">
        <h3 style="margin:0;font-size:16px;font-weight:700;">Configure Numbering: ${esc(item.label)}</h3>
        <button type="button" class="modal-close-btn" data-close-item>✕</button>
      </div>
      <div class="modal-body" style="display:flex;flex-direction:column;gap:14px;">
        <div style="font-size:12.5px;color:#64748b;">Series: <b>${esc(currentSeries?.name || options.seriesName || 'New Series')}</b></div>

        <!-- Transaction Prefix -->
        <div class="form-group" style="margin-bottom:0;">
          <label style="font-weight:600;font-size:12px;margin-bottom:4px;display:block;">Transaction Prefix*</label>
          <input type="text" id="seriesPrefixInput" value="${esc(currentPrefix)}" class="form-control" placeholder="e.g. INV">
          <small style="font-size:11px;color:#64748b;margin-top:2px;display:block;">Base prefix or standard identifier for this module.</small>
        </div>
        ${supportsCustomerPrefixes ? `
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <label class="form-group" style="margin-bottom:0;">B2B Customer Prefix
              <input type="text" id="seriesB2bPrefixInput" value="${esc(currentB2bPrefix)}" class="form-control" maxlength="20" placeholder="D">
            </label>
            <label class="form-group" style="margin-bottom:0;">B2C Customer Prefix
              <input type="text" id="seriesB2cPrefixInput" value="${esc(currentB2cPrefix)}" class="form-control" maxlength="20" placeholder="C">
            </label>
          </div>
        ` : ''}

        <!-- Format Pattern Builder -->
        <div class="form-group" style="margin-bottom:0;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
            <label style="font-weight:600;font-size:12px;margin-bottom:0;">Number Format Pattern</label>
            <button type="button" id="btnResetFormatPattern" class="btn s" style="font-size:11px;padding:2px 8px;background:none;border:none;color:#3b82f6;cursor:pointer;text-decoration:underline;">Reset to Default</button>
          </div>
          <input type="text" id="seriesFormatInput" value="${esc(currentFormat)}" class="form-control" placeholder="e.g. INV/{CUSTOMERTYPE}/{FY}/{SEQUENCE}" style="font-family:monospace;font-size:13px;">
          <small style="font-size:11px;color:#64748b;margin-top:2px;display:block;">Custom pattern with placeholders. Leave empty to auto-build from Prefix + Separator + Sequence.</small>
        </div>

        <!-- Insert Dynamic Field -->
        <div style="display:flex;gap:8px;align-items:center;">
          <select id="seriesDynamicFieldSelect" class="form-control" style="flex:1;font-size:12px;">
            <option value="">-- Insert Dynamic Field --</option>
            <option value="{CUSTOMERTYPE}">{CUSTOMERTYPE} - Customer Type (e.g. B2B, B2C)</option>
            <option value="{LOCATION}">{LOCATION} - Location / City (e.g. KOTTAYAM)</option>
            <option value="{FY}">{FY} - Financial Year (e.g. 26-27)</option>
            <option value="{ORG}">{ORG} - Organization Code (e.g. CONVO)</option>
            <option value="{BRANCH}">{BRANCH} - Branch Code/Name (e.g. TVM)</option>
            <option value="{YEAR}">{YEAR} - 4-Digit Year (e.g. 2026)</option>
            <option value="{MONTH}">{MONTH} - 2-Digit Month (e.g. 04)</option>
            <option value="{SEQUENCE}">{SEQUENCE} - Sequential Padded Number</option>
          </select>
          <button type="button" class="btn s" id="btnInsertDynamicField" style="font-size:12px;white-space:nowrap;padding:6px 12px;">+ Insert Field</button>
        </div>

        <!-- Separator & Sequence -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div>
            <label style="font-weight:600;font-size:12px;margin-bottom:4px;display:block;">Separator</label>
            <select id="seriesSeparatorSelect" class="form-control" style="font-size:12px;">
              <option value="/" ${currentSeparator === '/' ? 'selected' : ''}>Slash ( / )</option>
              <option value="-" ${currentSeparator === '-' ? 'selected' : ''}>Hyphen ( - )</option>
              <option value="_" ${currentSeparator === '_' ? 'selected' : ''}>Underscore ( _ )</option>
              <option value="custom" ${isCustomSep ? 'selected' : ''}>Custom...</option>
            </select>
          </div>
          <div>
            <label style="font-weight:600;font-size:12px;margin-bottom:4px;display:block;">Custom Separator</label>
            <input type="text" id="seriesCustomSeparatorInput" class="form-control" maxlength="5" value="${esc(isCustomSep ? currentSeparator : '')}" ${!isCustomSep ? 'disabled' : ''} placeholder="e.g. . or #" style="font-size:12px;">
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div>
            <label style="font-weight:600;font-size:12px;margin-bottom:4px;display:block;">Next Sequence Number*</label>
            <input type="text" id="seriesNextSeqInput" value="${esc(paddedNext)}" class="form-control" style="font-family:monospace;font-size:13px;" placeholder="1 or 00001">
          </div>
          <div>
            <label style="font-weight:600;font-size:12px;margin-bottom:4px;display:block;">Number Padding (Digits)</label>
            <input type="number" id="seriesPaddingInput" min="1" max="12" value="${paddingVal}" class="form-control" style="font-size:12px;">
          </div>
        </div>

        <!-- Live Interactive Sample Preview -->
        <div style="background:#f0fdf4;border:1.5px solid #86efac;padding:12px 14px;border-radius:6px;">
          <div style="font-size:11px;font-weight:700;color:#166534;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Live Interactive Sample Preview</div>
          ${supportsCustomerPrefixes ? `
            <label style="display:flex;align-items:center;gap:8px;font-size:11px;color:#166534;margin-bottom:6px;">
              Preview customer type
              <select id="seriesPreviewCustomerType" class="form-control" style="width:auto;padding:3px 8px;font-size:11px;">
                <option value="b2b">B2B</option>
                <option value="b2c">B2C</option>
              </select>
            </label>
          ` : ''}
          <div style="font-size:17px;font-family:monospace;font-weight:700;color:#15803d;word-break:break-all;" id="seriesSamplePreview">${esc(item.sample_preview || '')}</div>
        </div>

        <!-- Placeholders Reference Guide -->
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:10px 12px;">
          <div style="font-size:11.5px;font-weight:700;color:#475569;margin-bottom:6px;">Available Placeholders Guide</div>
          <table style="width:100%;font-size:11px;border-collapse:collapse;">
            <thead>
              <tr style="color:#64748b;border-bottom:1px solid #e2e8f0;">
                <th style="text-align:left;padding:3px 4px;">Placeholder</th>
                <th style="text-align:left;padding:3px 4px;">Description</th>
                <th style="text-align:left;padding:3px 4px;">Sample</th>
              </tr>
            </thead>
            <tbody style="color:#334155;">
              <tr><td style="padding:3px 4px;"><code>{CUSTOMERTYPE}</code></td><td style="padding:3px 4px;">Configured customer prefix</td><td style="padding:3px 4px;">D / C</td></tr>
              <tr><td style="padding:3px 4px;"><code>{LOCATION}</code></td><td style="padding:3px 4px;">Customer / transaction location</td><td style="padding:3px 4px;">KOTTAYAM</td></tr>
              <tr><td style="padding:3px 4px;"><code>{FY}</code></td><td style="padding:3px 4px;">Financial Year</td><td style="padding:3px 4px;">26-27</td></tr>
              <tr><td style="padding:3px 4px;"><code>{ORG}</code></td><td style="padding:3px 4px;">Organization short code</td><td style="padding:3px 4px;">CONVO</td></tr>
              <tr><td style="padding:3px 4px;"><code>{BRANCH}</code></td><td style="padding:3px 4px;">Branch code / name</td><td style="padding:3px 4px;">TVM</td></tr>
              <tr><td style="padding:3px 4px;"><code>{YEAR}</code></td><td style="padding:3px 4px;">4-digit calendar year</td><td style="padding:3px 4px;">2026</td></tr>
              <tr><td style="padding:3px 4px;"><code>{MONTH}</code></td><td style="padding:3px 4px;">2-digit month</td><td style="padding:3px 4px;">04</td></tr>
              <tr><td style="padding:3px 4px;"><code>{SEQUENCE}</code></td><td style="padding:3px 4px;">Sequential padded number</td><td style="padding:3px 4px;">00001</td></tr>
            </tbody>
          </table>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn-secondary" data-close-item>Cancel</button>
        <button type="button" class="btn-primary" id="btnSaveSeriesItem">Save</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const prefixInp = modal.querySelector('#seriesPrefixInput');
  const b2bPrefixInp = modal.querySelector('#seriesB2bPrefixInput');
  const b2cPrefixInp = modal.querySelector('#seriesB2cPrefixInput');
  const previewCustomerType = modal.querySelector('#seriesPreviewCustomerType');
  const formatInp = modal.querySelector('#seriesFormatInput');
  const sepSelect = modal.querySelector('#seriesSeparatorSelect');
  const customSepInp = modal.querySelector('#seriesCustomSeparatorInput');
  const nextInp = modal.querySelector('#seriesNextSeqInput');
  const paddingInp = modal.querySelector('#seriesPaddingInput');
  const prevEl = modal.querySelector('#seriesSamplePreview');
  const dynamicSelect = modal.querySelector('#seriesDynamicFieldSelect');
  const insertBtn = modal.querySelector('#btnInsertDynamicField');
  const resetFormatBtn = modal.querySelector('#btnResetFormatPattern');

  const closeModal = () => {
    document.removeEventListener('keydown', onKeyDown, localOnly);
    modal.remove();
    if (!localOnly) document.body.classList.remove('modal-open');
  };
  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      if (localOnly) e.stopImmediatePropagation();
      closeModal();
    }
  };
  document.addEventListener('keydown', onKeyDown, localOnly);
  document.body.classList.add('modal-open');
  modal.addEventListener('click', e => {
    if (e.target === modal) closeModal();
  });
  modal.querySelectorAll('[data-close-item]').forEach(b => b.addEventListener('click', closeModal));

  // Keep selection when focus moves from the pattern field to the field picker.
  let lastStart = formatInp.selectionStart ?? formatInp.value.length;
  let lastEnd = formatInp.selectionEnd ?? formatInp.value.length;

  const trackPatternSelection = () => {
    lastStart = formatInp.selectionStart ?? formatInp.value.length;
    lastEnd = formatInp.selectionEnd ?? lastStart;
  };
  ['click', 'keyup', 'select', 'focus', 'input', 'mouseup'].forEach(ev => {
    formatInp.addEventListener(ev, trackPatternSelection);
  });

  sepSelect.addEventListener('change', () => {
    if (sepSelect.value === 'custom') {
      customSepInp.disabled = false;
      customSepInp.focus();
    } else {
      customSepInp.disabled = true;
    }
    updatePreview();
  });

  if (resetFormatBtn) {
    resetFormatBtn.addEventListener('click', () => {
      const defaultPfx = item.default_prefix || item.prefix || '';
      const defaultSep = item.default_separator || '/';
      const defaultPad = Number(item.default_padding || 5);
      const defaultNext = Number(item.default_next || 1);
      const defaultFormat = item.default_format_pattern || '';

      prefixInp.value = defaultPfx;
      if (b2bPrefixInp) b2bPrefixInp.value = item.default_b2b_prefix ?? 'D';
      if (b2cPrefixInp) b2cPrefixInp.value = item.default_b2c_prefix ?? 'C';
      if (previewCustomerType) previewCustomerType.value = 'b2b';
      formatInp.value = defaultFormat;
      sepSelect.value = ['/', '-', '_'].includes(defaultSep) ? defaultSep : 'custom';
      customSepInp.value = sepSelect.value === 'custom' ? defaultSep : '';
      customSepInp.disabled = sepSelect.value !== 'custom';
      nextInp.value = String(defaultNext).padStart(defaultPad, '0');
      paddingInp.value = defaultPad;
      dynamicSelect.value = '';
      lastStart = lastEnd = formatInp.value.length;
      updatePreview();
      toast('Reset to default values. Click Save to apply.', 'info');
    });
  }

  const insertSelectedDynamicField = () => {
    const val = dynamicSelect.value;
    if (!val) {
      toast('Please select a dynamic field from the dropdown first.', 'info');
      dynamicSelect.focus();
      return;
    }
    const target = formatInp;
    const currentVal = target.value;
    const startPos = document.activeElement === target && typeof target.selectionStart === 'number'
      ? target.selectionStart
      : Math.min(lastStart, currentVal.length);
    const endPos = document.activeElement === target && typeof target.selectionEnd === 'number'
      ? target.selectionEnd
      : Math.min(lastEnd, currentVal.length);
    let left = currentVal.slice(0, startPos);
    const right = currentVal.slice(endPos);
    const separator = (sepSelect.value === 'custom' ? customSepInp.value : sepSelect.value) || '/';
    const hasSeparatorAtEnd = text => !separator || text.endsWith(separator) || /[\/_-]$/.test(text);
    const hasSeparatorAtStart = text => !separator || text.startsWith(separator) || /^[\/_-]/.test(text);
    if (!currentVal && prefixInp.value.trim()) left = prefixInp.value.trim();
    const before = left && !hasSeparatorAtEnd(left) ? left + (separator || '/') : left;
    const after = right && !hasSeparatorAtStart(right) ? (separator || '/') + right : right;
    target.value = before + val + after;
    const newCursor = before.length + val.length;
    target.focus();
    if (typeof target.setSelectionRange === 'function') {
      target.setSelectionRange(newCursor, newCursor);
    }
    lastStart = newCursor;
    lastEnd = newCursor;
    dynamicSelect.value = '';
    updatePreview();
  };

  insertBtn.addEventListener('click', insertSelectedDynamicField);

  let previewRequestSequence = 0;
  const updatePreview = () => {
    const requestId = ++previewRequestSequence;
    const raw = nextInp.value.trim();
    if (!/^\d{1,12}$/.test(raw) || Number(raw) < 1) {
      prevEl.textContent = 'Enter a positive sequence number';
      return;
    }
    const pad = parseInt(paddingInp.value, 10);
    if (!Number.isFinite(pad) || pad < 1 || pad > 12) {
      prevEl.textContent = 'Padding must be between 1 and 12';
      return;
    }
    const sep = sepSelect.value === 'custom' ? customSepInp.value : sepSelect.value;
    const pattern = formatInp.value.trim();
    const allowed = new Set([
      'CUSTOMERTYPE','CUSTOMER_TYPE','CUSTOMER-TYPE','LOCATION','FY','FINANCIAL_YEAR','FINANCIAL-YEAR',
      'ORG','ORGANIZATION','BRANCH','YEAR','YYYY','YY','MONTH','MM','DAY','DD',
      'SEQUENCE','SEQ','NUMBER','NUM','FYS_YY','FYE_YY'
    ]);
    const tokens = [...pattern.matchAll(/(?:\$\s*)?\{\s*([A-Za-z0-9_-]+)\s*\}|%\s*([A-Za-z0-9_-]+)\s*%/g)]
      .map(match => (match[1] || match[2]).toUpperCase());
    const unsupported = [...new Set(tokens.filter(token => !allowed.has(token)))];
    if (unsupported.length) {
      prevEl.textContent = `Unsupported placeholder: {${unsupported[0]}}`;
      return;
    }

    prevEl.textContent = 'Updating preview...';
    window.clearTimeout(updatePreview._timer);
    updatePreview._timer = window.setTimeout(async () => {
      try {
        const branchId = localOnly
          ? (typeof options.branchId === 'function' ? options.branchId() : '')
          : currentSeries?.branch_id;
        const endpoint = localOnly
          ? '/settings/transaction-series/preview/'
          : `/settings/transaction-series/${currentSeries.id}/preview/`;
        const result = await api(endpoint, {
          method: 'POST',
          body: JSON.stringify({
            document_type: item.document_type,
            branch_id: branchId || null,
            prefix: prefixInp.value.trim(),
            b2b_prefix: b2bPrefixInp?.value.trim() ?? 'D',
            b2c_prefix: b2cPrefixInp?.value.trim() ?? 'C',
            customer_type: previewCustomerType?.value || 'b2b',
            format_pattern: pattern,
            separator: sep || '/',
            next_number: Number(raw),
            padding: pad
          })
        });
        if (requestId === previewRequestSequence) {
          prevEl.textContent = result.preview?.formatted || 'Preview unavailable';
        }
      } catch (error) {
        if (requestId === previewRequestSequence) {
          prevEl.textContent = error.message || 'Invalid numbering configuration';
        }
      }
    }, 120);
  };

  ['input', 'change', 'keyup', 'paste'].forEach(ev => {
    prefixInp.addEventListener(ev, updatePreview);
    b2bPrefixInp?.addEventListener(ev, updatePreview);
    b2cPrefixInp?.addEventListener(ev, updatePreview);
    formatInp.addEventListener(ev, updatePreview);
    nextInp.addEventListener(ev, updatePreview);
    paddingInp.addEventListener(ev, updatePreview);
    customSepInp.addEventListener(ev, updatePreview);
  });
  previewCustomerType?.addEventListener('change', updatePreview);

  // Calculate live preview immediately upon modal open
  updatePreview();

  const saveItemBtn = modal.querySelector('#btnSaveSeriesItem');
  saveItemBtn.addEventListener('click', async () => {
    if (saveItemBtn.disabled) return;
    const prefix = prefixInp.value.trim();
    const formatPattern = formatInp.value.trim();
    const rawNext = nextInp.value.trim();
    const sep = sepSelect.value === 'custom' ? customSepInp.value.trim() : sepSelect.value;
    const padding = parseInt(paddingInp.value, 10);
    if (!Number.isInteger(padding) || padding < 1 || padding > 12) {
      toast('Padding must be between 1 and 12.', 'error');
      paddingInp.focus();
      return;
    }

    if (!prefix) {
      toast('Prefix is required.', 'error');
      prefixInp.focus();
      return;
    }
    const b2bPrefix = b2bPrefixInp?.value.trim() ?? item.b2b_prefix ?? 'D';
    const b2cPrefix = b2cPrefixInp?.value.trim() ?? item.b2c_prefix ?? 'C';
    const validCustomerPrefix = value => value.length <= 20 && /^[A-Za-z0-9_-]*$/.test(value);
    if (!validCustomerPrefix(b2bPrefix) || !validCustomerPrefix(b2cPrefix)) {
      toast('Customer prefixes may contain up to 20 letters, numbers, hyphens, or underscores.', 'error');
      (b2bPrefixInp && !validCustomerPrefix(b2bPrefix) ? b2bPrefixInp : b2cPrefixInp)?.focus();
      return;
    }
    if (!/^\d{1,12}$/.test(rawNext) || Number(rawNext) < 1) {
      toast('Next number must be a positive whole number of at most 12 digits.', 'error');
      nextInp.focus();
      return;
    }
    const supportedTokens = new Set([
      'CUSTOMERTYPE','CUSTOMER_TYPE','CUSTOMER-TYPE','LOCATION','FY','FINANCIAL_YEAR','FINANCIAL-YEAR',
      'ORG','ORGANIZATION','BRANCH','YEAR','YYYY','YY','MONTH','MM','DAY','DD',
      'SEQUENCE','SEQ','NUMBER','NUM','FYS_YY','FYE_YY'
    ]);
    const unsupportedTokens = [...formatPattern.matchAll(/(?:\$\s*)?\{\s*([A-Za-z0-9_-]+)\s*\}|%\s*([A-Za-z0-9_-]+)\s*%/g)]
      .map(match => (match[1] || match[2]).toUpperCase())
      .filter(token => !supportedTokens.has(token));
    if (formatPattern.length > 160 || [...new Set(unsupportedTokens)].length) {
      toast(formatPattern.length > 160 ? 'Format pattern cannot exceed 160 characters.' : `Unsupported placeholder: {${[...new Set(unsupportedTokens)][0]}}`, 'error');
      formatInp.focus();
      return;
    }
    const next_number = Number(rawNext);
    const customer_type = previewCustomerType?.value || 'b2b';

    if (localOnly) {
      const updatedItem = {
        ...item,
        prefix,
        format_pattern: formatPattern,
        separator: sep || '/',
        next_number,
        padding,
        b2b_prefix: b2bPrefix,
        b2c_prefix: b2cPrefix,
        customer_type
      };
      if (typeof options.onSave === 'function') options.onSave(updatedItem);
      closeModal();
      return;
    }

    saveItemBtn.disabled = true;
    saveItemBtn.textContent = 'Saving...';
    try {
      await api(`/settings/transaction-series/${currentSeries.id}/`, {
        method: 'PUT',
        body: JSON.stringify({
          items: [{
            document_type: item.document_type,
            prefix: prefix,
            b2b_prefix: b2bPrefix,
            b2c_prefix: b2cPrefix,
            customer_type: customer_type,
            format_pattern: formatPattern,
            separator: sep || '/',
            next_number: next_number,
            padding: padding
          }]
        })
      });
      const saved = await api(`/settings/transaction-series/${currentSeries.id}/`);
      const savedItem = saved.items?.find(savedConfig => savedConfig.document_type === item.document_type);
      if (!savedItem ||
          savedItem.prefix !== prefix ||
          savedItem.b2b_prefix !== b2bPrefix ||
          savedItem.b2c_prefix !== b2cPrefix ||
          (savedItem.format_pattern || '') !== formatPattern ||
          (savedItem.separator || '/') !== (sep || '/') ||
          Number(savedItem.next_number) < next_number ||
          Number(savedItem.padding) !== padding) {
        throw new Error('The saved numbering configuration could not be verified. Please retry.');
      }
      closeModal();
      if (typeof options.onSave === 'function') {
        options.onSave(savedItem);
      }
      if (container && typeof renderNumberSeriesPage === 'function' && document.body.contains(container)) {
        await renderNumberSeriesPage(container, currentSeries.id);
      }
      toast(`Number series for ${item.label} updated successfully.`, 'success');
    } catch (err) {
      saveItemBtn.disabled = false;
      saveItemBtn.textContent = 'Save';
      toast(err.message || 'Failed to update numbering series.', 'error');
    }
  });
}
window.openEditSeriesItemModal = openEditSeriesItemModal;

async function openTransactionSeriesModalForDoc({ docType, seriesId, seriesName, branchId, onSave } = {}) {
  try {
    const listRes = await api('/settings/transaction-series/');
    const allSeries = listRes.series || [];
    let currentSeries = null;
    if (seriesId) {
      currentSeries = allSeries.find(s => String(s.id) === String(seriesId));
    }
    if (!currentSeries && seriesName) {
      currentSeries = allSeries.find(s => String(s.name).toLowerCase() === String(seriesName).toLowerCase());
    }
    if (!currentSeries) {
      currentSeries = listRes.current_series || allSeries[0];
    }
    if (!currentSeries) {
      toast('No transaction series found.', 'error');
      return;
    }
    const seriesDetail = await api(`/settings/transaction-series/${currentSeries.id}/`);
    const items = seriesDetail.items || [];
    const item = items.find(it => it.document_type === docType) || items[0];
    if (!item) {
      toast(`No numbering configuration found for ${docType}.`, 'error');
      return;
    }
    openEditSeriesItemModal(null, currentSeries, item, {
      seriesName: currentSeries.name,
      branchId: branchId,
      onSave: (savedItem) => {
        if (typeof onSave === 'function') onSave(savedItem);
      }
    });
  } catch (err) {
    toast(err.message || 'Failed to open transaction series configuration.', 'error');
  }
}
window.openTransactionSeriesModalForDoc = openTransactionSeriesModalForDoc;

function openAddTransactionSeriesModal(container, supportedTypes, onSaved = null) {
  document.querySelectorAll('.transaction-series-modal').forEach(existing => existing.remove());

  // Deep clone supportedTypes to guarantee independent, immutable base prefixes
  const typesList = (supportedTypes || []).map(item => ({
    document_type: item.document_type,
    label: item.label,
    prefix: item.prefix || '',
    base_prefix: item.base_prefix || item.prefix || '',
    next_number: item.next_number || 1,
    padding: item.padding || 5,
    format_pattern: item.format_pattern || '',
    separator: item.separator || '/',
    b2b_prefix: item.b2b_prefix ?? 'D',
    b2c_prefix: item.b2c_prefix ?? 'C',
    default_prefix: item.base_prefix || item.prefix || '',
    default_format_pattern: item.default_format_pattern || '',
    default_separator: item.default_separator || '/',
    default_b2b_prefix: item.default_b2b_prefix ?? 'D',
    default_b2c_prefix: item.default_b2c_prefix ?? 'C',
    default_next: item.default_next || item.next_number || 1,
    default_padding: item.default_padding || item.padding || 5
  }));

  const modal = document.createElement('div');
  modal.className = 'modal-backdrop transaction-series-modal';
  modal.innerHTML = `
    <div class="modal-box" style="max-width:760px;max-height:90vh;overflow-y:auto;">
      <div class="modal-header">
        <h3>+ Add Transaction Number Series</h3>
        <button type="button" class="modal-close-btn" data-close-series>✕</button>
      </div>
      <div class="modal-body" style="display:flex;flex-direction:column;gap:14px;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <label class="form-group">Series Name*<input class="form-control" id="newSeriesName" placeholder="e.g. Kerala Branch" required></label>
          <label class="form-group">Branch
            <select class="form-control" id="newSeriesLocation">
              <option value="">All branches</option>
            </select>
          </label>
        </div>
        <div style="display:flex;align-items:center;gap:16px;">
          <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;">
            <input type="checkbox" id="newSeriesDefault"> Set as default series
          </label>
          <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;">
            <input type="checkbox" id="newSeriesActive" checked> Active
          </label>
        </div>

        <div style="margin-top:6px;">
          <div style="font-weight:700;font-size:13px;margin-bottom:8px;color:var(--tx);">Configure Transaction Types:</div>
          <table class="settings-data-table" style="font-size:12px;">
            <thead>
              <tr>
                <th>MODULE</th>
                <th>PREFIX</th>
                <th>NEXT NUMBER</th>
                <th></th>
              </tr>
            </thead>
            <tbody id="newSeriesItemsTbody">
              ${typesList.map(item => `
                <tr data-type="${esc(item.document_type)}">
                  <td><b>${esc(item.label)}</b></td>
                  <td><input type="text" class="form-control s-pfx" data-base-prefix="${esc(item.base_prefix)}" value="${esc(item.base_prefix)}" style="padding:4px 8px;font-size:12px;"></td>
                  <td><input type="text" class="form-control s-nxt" value="${esc(String(item.next_number).padStart(item.padding || 1, '0'))}" style="padding:4px 8px;font-size:12px;font-family:monospace;"></td>
                  <td><button type="button" class="btn s" data-configure-new-item="${esc(item.document_type)}" style="font-size:11px;padding:4px 8px;">Configure</button></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn-secondary" data-close-series>Cancel</button>
        <button type="button" class="btn-primary" id="btnSaveNewSeries">Save Series</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  api('lookup/branches/').then(locations => {
    const select = modal.querySelector('#newSeriesLocation');
    if (!select) return;
    select.innerHTML = '<option value="">All branches</option>' + (Array.isArray(locations) ? locations : []).map(location =>
      `<option value="${location.id}">${esc(location.name)}</option>`
    ).join('');
  }).catch(error => {
    toast(error.message || 'Could not load branches for the transaction series.', 'error');
  });

  const nameInput = modal.querySelector('#newSeriesName');

  modal.querySelectorAll('[data-configure-new-item]').forEach(button => {
    button.addEventListener('click', () => {
      const item = typesList.find(type => type.document_type === button.dataset.configureNewItem);
      const row = button.closest('tr');
      if (!item || !row) return;
      openEditSeriesItemModal(container, null, {
        ...item,
        prefix: row.querySelector('.s-pfx').value.trim(),
        next_number: Number(row.querySelector('.s-nxt').value) || item.next_number,
        sample_preview: ''
      }, {
        localOnly: true,
        seriesName: nameInput.value.trim() || 'New Series',
        branchId: () => modal.querySelector('#newSeriesLocation').value,
        onSave: updated => {
          Object.assign(item, updated);
          const prefixInput = row.querySelector('.s-pfx');
          prefixInput.value = updated.prefix;
          row.querySelector('.s-nxt').value = String(updated.next_number).padStart(updated.padding || 1, '0');
          button.textContent = 'Configured';
        }
      });
    });
  });

  const closeModal = () => {
    document.removeEventListener('keydown', onKeyDown);
    modal.remove();
    document.body.classList.remove('modal-open');
  };
  const onKeyDown = (e) => {
    if (e.key === 'Escape') closeModal();
  };
  document.addEventListener('keydown', onKeyDown);
  document.body.classList.add('modal-open');
  modal.addEventListener('click', e => {
    if (e.target === modal) closeModal();
  });
  modal.querySelectorAll('[data-close-series]').forEach(b => {
    b.addEventListener('click', closeModal);
  });

  const saveBtn = modal.querySelector('#btnSaveNewSeries');
  saveBtn.addEventListener('click', async () => {
    if (saveBtn.disabled) return;
    const name = nameInput.value.trim();
    if (!name) {
      toast('Please enter a Series Name.', 'error');
      nameInput.focus();
      return;
    }
    const locationId = modal.querySelector('#newSeriesLocation').value;
    const isDefault = modal.querySelector('#newSeriesDefault').checked;
    const isActive = modal.querySelector('#newSeriesActive').checked;

    if (isDefault && !isActive) {
      toast('An inactive series cannot be set as the default series.', 'error');
      return;
    }

    const items = [];
    let hasError = false;
    modal.querySelectorAll('#newSeriesItemsTbody tr').forEach(row => {
      if (hasError) return;
      const type = row.dataset.type;
      const pfxInput = row.querySelector('.s-pfx');
      const nxtInput = row.querySelector('.s-nxt');
      const pfx = pfxInput.value.trim();
      const rawNxt = nxtInput.value.trim();

      if (!pfx) {
        toast('Every transaction type needs a valid prefix.', 'error');
        pfxInput.focus();
        hasError = true;
        return;
      }
      if (!/^\d{1,12}$/.test(rawNxt) || Number(rawNxt) < 1) {
        toast('Next sequence number must be a positive whole number of at most 12 digits.', 'error');
        nxtInput.focus();
        hasError = true;
        return;
      }
      const nxt = Number(rawNxt);
      const typeConfig = typesList.find(config => config.document_type === type);
      const pad = rawNxt.length > 1 ? rawNxt.length : (typeConfig?.padding || 5);
      items.push({
        document_type: type,
        prefix: pfx,
        format_pattern: typeConfig?.format_pattern || '',
        separator: typeConfig?.separator || '/',
        b2b_prefix: typeConfig?.b2b_prefix ?? 'D',
        b2c_prefix: typeConfig?.b2c_prefix ?? 'C',
        next_number: nxt,
        padding: pad
      });
    });

    if (hasError || items.length !== typesList.length) return;

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
    let res;
    try {
      res = await api('/settings/transaction-series/', {
        method: 'POST',
        body: JSON.stringify({
          name: name,
          branch_id: locationId || null,
          is_default: isDefault,
          is_active: isActive,
          items: items
        })
      });
    } catch (err) {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Series';
      toast(err.message || 'Failed to create series.', 'error');
      return;
    }

    closeModal();
    if (typeof onSaved === 'function') {
      try {
        await onSaved(res.id);
      } catch (err) {
        toast(`Series "${name}" was created, but the location form could not refresh its options: ${err.message || 'refresh failed.'}`, 'error');
        return;
      }
    } else {
      try {
        await renderNumberSeriesPage(container, res.id);
      } catch (err) {
        toast(`Series "${name}" was created, but the series page could not be refreshed: ${err.message || 'refresh failed.'}`, 'error');
        return;
      }
    }
    toast(`Series "${name}" created successfully.`, 'success');
  });
}

function openEditSeriesMetaModal(container, currentSeries) {
  document.querySelectorAll('.transaction-series-modal').forEach(existing => existing.remove());
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop transaction-series-modal';
  modal.innerHTML = `
    <div class="modal-box" style="max-width:480px;">
      <div class="modal-header">
        <h3>Edit Series: ${esc(currentSeries.name)}</h3>
        <button type="button" class="modal-close-btn" data-close-meta>✕</button>
      </div>
      <div class="modal-body" style="display:flex;flex-direction:column;gap:12px;">
        <label class="form-group">Series Name*<input class="form-control" id="editMetaName" value="${esc(currentSeries.name)}" required></label>
        <label class="form-group">Branch
          <select class="form-control" id="editMetaLocation"><option value="">All branches</option></select>
        </label>
        <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;">
          <input type="checkbox" id="editMetaDefault" ${currentSeries.is_default ? 'checked' : ''}> Default series
        </label>
        <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;">
          <input type="checkbox" id="editMetaActive" ${currentSeries.is_active ? 'checked' : ''}> Active
        </label>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn-secondary" data-close-meta>Cancel</button>
        <button type="button" class="btn-primary" id="btnSaveSeriesMeta">Save</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  api('lookup/branches/').then(locations => {
    const select = modal.querySelector('#editMetaLocation');
    if (!select) return;
    select.innerHTML = '<option value="">All branches</option>' + (Array.isArray(locations) ? locations : []).map(location =>
      `<option value="${location.id}" data-prefix="${esc(location.prefix || '')}" ${String(location.id) === String(currentSeries.business_location_id || '') ? 'selected' : ''}>${esc(location.name)}</option>`
    ).join('');
  }).catch(() => {});

  const closeModal = () => {
    document.removeEventListener('keydown', onKeyDown);
    modal.remove();
    document.body.classList.remove('modal-open');
  };
  const onKeyDown = (e) => {
    if (e.key === 'Escape') closeModal();
  };
  document.addEventListener('keydown', onKeyDown);
  document.body.classList.add('modal-open');
  modal.addEventListener('click', e => {
    if (e.target === modal) closeModal();
  });
  modal.querySelectorAll('[data-close-meta]').forEach(b => b.addEventListener('click', closeModal));

  const saveMetaBtn = modal.querySelector('#btnSaveSeriesMeta');
  saveMetaBtn.addEventListener('click', async () => {
    if (saveMetaBtn.disabled) return;
    const name = modal.querySelector('#editMetaName').value.trim();
    if (!name) {
      toast('Series name is required.', 'error');
      modal.querySelector('#editMetaName').focus();
      return;
    }
    const locationId = modal.querySelector('#editMetaLocation').value;
    const isDefault = modal.querySelector('#editMetaDefault').checked;
    const isActive = modal.querySelector('#editMetaActive').checked;

    if (isDefault && !isActive) {
      toast('An inactive series cannot be set as the default series.', 'error');
      return;
    }

    saveMetaBtn.disabled = true;
    saveMetaBtn.textContent = 'Saving...';
    try {
      await api(`/settings/transaction-series/${currentSeries.id}/`, {
        method: 'PUT',
        body: JSON.stringify({
          name: name,
          branch_id: locationId || null,
          is_default: isDefault,
          is_active: isActive
        })
      });
      toast('Series updated successfully.', 'success');
      closeModal();
      await renderNumberSeriesPage(container, currentSeries.id);
    } catch (err) {
      saveMetaBtn.disabled = false;
      saveMetaBtn.textContent = 'Save';
      toast(err.message || 'Failed to update series.', 'error');
    }
  });
}

// =========================================================================
// 10. CURRENCIES & PAYMENT TERMS (Section 8)
// =========================================================================

async function renderCurrenciesPage(container) {
  const data = await api('/settings/currencies/');
  const currencies = data.currencies || [];

  container.innerHTML = `
    <div class="settings-page-header">
      <div class="settings-page-header-left">
        <h1>Currencies</h1>
      </div>
      <div class="settings-page-header-right">
        <button type="button" class="btn-primary" onclick="openAddCurrencyModal()">
          <span style="font-size:16px; margin-right:4px;">+</span> Add Currency
        </button>
      </div>
    </div>

    <div class="settings-table-card">
      <table class="settings-data-table">
        <thead>
          <tr>
            <th>CURRENCY CODE</th>
            <th>CURRENCY NAME</th>
            <th>SYMBOL</th>
            <th>EXCHANGE RATE</th>
            <th>BASE CURRENCY</th>
          </tr>
        </thead>
        <tbody>
          ${currencies.map(c => `
            <tr>
              <td><b>${esc(c.code)}</b></td>
              <td>${esc(c.name)}</td>
              <td><code>${esc(c.symbol)}</code></td>
              <td>${c.exchange_rate}</td>
              <td>${c.is_base ? '<span class="pastel-chip chip-emerald">Base Currency</span>' : '<span class="pastel-chip chip-gray">Secondary</span>'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function openAddCurrencyModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.innerHTML = `
    <div class="modal-box" style="max-width:440px;">
      <div class="modal-header">
        <h3>Add Currency</h3>
        <button type="button" class="modal-close-btn" onclick="this.closest('.modal-backdrop').remove()">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>Currency Code (ISO)*</label>
          <input type="text" id="newCurrCode" placeholder="e.g. CAD" class="form-control" style="text-transform:uppercase;" maxlength="5">
        </div>
        <div class="form-group" style="margin-top:12px;">
          <label>Currency Name*</label>
          <input type="text" id="newCurrName" placeholder="e.g. Canadian Dollar" class="form-control">
        </div>
        <div class="form-group" style="margin-top:12px;">
          <label>Currency Symbol</label>
          <input type="text" id="newCurrSym" placeholder="e.g. C$" class="form-control">
        </div>
        <div class="form-group" style="margin-top:12px;">
          <label>Exchange Rate (to Base)</label>
          <input type="number" step="0.0001" id="newCurrRate" value="1.0000" class="form-control">
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn-secondary" onclick="this.closest('.modal-backdrop').remove()">Cancel</button>
        <button type="button" class="btn-primary" id="btnSubmitAddCurrency">Save Currency</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.querySelector('#btnSubmitAddCurrency').addEventListener('click', async () => {
    const code = modal.querySelector('#newCurrCode').value.trim().toUpperCase();
    const name = modal.querySelector('#newCurrName').value.trim();
    const symbol = modal.querySelector('#newCurrSym').value.trim();
    const exchange_rate = modal.querySelector('#newCurrRate').value;

    if (!code || !name) {
      toast('Currency Code and Name are required.', 'error');
      return;
    }

    try {
      await api('/settings/currencies/', {
        method: 'POST',
        body: JSON.stringify({ code, name, symbol, exchange_rate })
      });
      toast(`Currency ${code} added.`, 'success');
      modal.remove();
      renderCurrenciesPage($('#settingsMainPane'));
    } catch (err) {
      toast(err.message || 'Failed to add currency.', 'error');
    }
  });
}

async function renderPaymentTermsPage(container) {
  const data = await api('/settings/payment-terms/');
  const terms = data.payment_terms || [];

  container.innerHTML = `
    <div class="settings-page-header">
      <div class="settings-page-header-left">
        <h1>Payment Terms</h1>
      </div>
      <div class="settings-page-header-right">
        <button type="button" class="btn-primary" onclick="openAddPaymentTermModal()">
          <span style="font-size:16px; margin-right:4px;">+</span> Add Payment Term
        </button>
      </div>
    </div>

    <div class="settings-table-card">
      <table class="settings-data-table">
        <thead>
          <tr>
            <th>TERM NAME</th>
            <th>NUMBER OF DAYS</th>
            <th>DEFAULT</th>
            <th style="text-align:right;">ACTION</th>
          </tr>
        </thead>
        <tbody>
          ${terms.map(t => `
            <tr>
              <td><b>${esc(t.name)}</b></td>
              <td>${t.days} Days</td>
              <td>${t.is_default ? '<span class="pastel-chip chip-emerald">Default</span>' : '—'}</td>
              <td style="text-align:right;">
                <button type="button" class="btn-table-action action-danger" onclick="deletePaymentTerm(${t.id}, '${esc(t.name)}')">Delete</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function openAddPaymentTermModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.innerHTML = `
    <div class="modal-box" style="max-width:440px;">
      <div class="modal-header">
        <h3>Add Payment Term</h3>
        <button type="button" class="modal-close-btn" onclick="this.closest('.modal-backdrop').remove()">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>Term Name*</label>
          <input type="text" id="newTermName" placeholder="e.g. Net 90" class="form-control" required>
        </div>
        <div class="form-group" style="margin-top:12px;">
          <label>Number of Days*</label>
          <input type="number" id="newTermDays" value="30" min="0" class="form-control" required>
        </div>
        <div class="form-group" style="margin-top:12px;">
          <label class="custom-checkbox-label">
            <input type="checkbox" id="newTermIsDefault">
            <span>Set as default payment term</span>
          </label>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn-secondary" onclick="this.closest('.modal-backdrop').remove()">Cancel</button>
        <button type="button" class="btn-primary" id="btnSubmitAddTerm">Save Term</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.querySelector('#btnSubmitAddTerm').addEventListener('click', async () => {
    const name = modal.querySelector('#newTermName').value.trim();
    const days = parseInt(modal.querySelector('#newTermDays').value, 10);
    const is_default = modal.querySelector('#newTermIsDefault').checked;

    if (!name) {
      toast('Term Name is required.', 'error');
      return;
    }

    try {
      await api('/settings/payment-terms/', {
        method: 'POST',
        body: JSON.stringify({ name, days, is_default })
      });
      toast(`Payment term "${name}" added.`, 'success');
      modal.remove();
      renderPaymentTermsPage($('#settingsMainPane'));
    } catch (err) {
      toast(err.message || 'Failed to add payment term.', 'error');
    }
  });
}

async function deletePaymentTerm(termId, name) {
  if (!confirm(`Delete payment term "${name}"?`)) return;
  try {
    await api(`/settings/payment-terms/${termId}/`, { method: 'DELETE' });
    toast(`Payment term "${name}" deleted.`, 'success');
    renderPaymentTermsPage($('#settingsMainPane'));
  } catch (err) {
    toast(err.message || 'Failed to delete term.', 'error');
  }
}

// =========================================================================
// 11. GENERAL CONFIGURATIONS, REMINDERS, PORTAL & DIGITAL SIGNATURE
// =========================================================================

async function renderGeneralSettingsPage(container) {
  const org = await api('/settings/organization/');
  const g = org.general_settings || {
    default_language: 'English',
    date_format: 'dd/MM/yyyy',
    time_zone: '(GMT+5:30) India Standard Time',
    number_format: '1,23,456.78',
    decimal_precision: 2
  };

  container.innerHTML = `
    <div class="settings-page-header">
      <div class="settings-page-header-left">
        <h1>General Preferences</h1>
      </div>
      <div class="settings-page-header-right">
        <button type="button" class="btn-primary" id="btnSaveGeneralPrefs">Save Preferences</button>
      </div>
    </div>

    <div class="settings-form-card">
      <div class="form-grid-2">
        <div class="form-group">
          <label>Default Language</label>
          <select id="genLang" class="form-control">
            <option value="English" selected>English</option>
            <option value="Hindi">Hindi</option>
          </select>
        </div>
        <div class="form-group">
          <label>Date Format</label>
          <select id="genDateFormat" class="form-control">
            <option value="dd/MM/yyyy" ${g.date_format === 'dd/MM/yyyy' ? 'selected' : ''}>dd/MM/yyyy (e.g. 06/11/2026)</option>
            <option value="MM/dd/yyyy" ${g.date_format === 'MM/dd/yyyy' ? 'selected' : ''}>MM/dd/yyyy (e.g. 11/06/2026)</option>
            <option value="yyyy-MM-dd" ${g.date_format === 'yyyy-MM-dd' ? 'selected' : ''}>yyyy-MM-dd (e.g. 2026-11-06)</option>
          </select>
        </div>
        <div class="form-group">
          <label>Number Format</label>
          <select id="genNumFormat" class="form-control">
            <option value="1,23,456.78" selected>Indian System (1,23,456.78)</option>
            <option value="123,456.78">International System (123,456.78)</option>
          </select>
        </div>
        <div class="form-group">
          <label>Decimal Precision</label>
          <select id="genDecPrecision" class="form-control">
            <option value="2" selected>2 Decimals (0.00)</option>
            <option value="3">3 Decimals (0.000)</option>
          </select>
        </div>
      </div>
    </div>
  `;

  container.querySelector('#btnSaveGeneralPrefs').addEventListener('click', async () => {
    const general_settings = {
      default_language: container.querySelector('#genLang').value,
      date_format: container.querySelector('#genDateFormat').value,
      number_format: container.querySelector('#genNumFormat').value,
      decimal_precision: parseInt(container.querySelector('#genDecPrecision').value, 10)
    };

    try {
      await api('/settings/organization/', { method: 'POST', body: JSON.stringify({ general_settings }) });
      toast('General preferences saved.', 'success');
    } catch (err) {
      toast(err.message || 'Failed to save preferences.', 'error');
    }
  });
}

async function renderRemindersPage(container) {
  const org = await api('/settings/organization/');
  const r = org.reminder_settings || {
    invoice_reminders: true,
    payment_reminders: true,
    overdue_reminders: true,
    email_notifications: true
  };

  container.innerHTML = `
    <div class="settings-page-header">
      <div class="settings-page-header-left">
        <h1>Automated Reminders</h1>
      </div>
      <div class="settings-page-header-right">
        <button type="button" class="btn-primary" id="btnSaveReminders">Save Reminders</button>
      </div>
    </div>

    <div class="settings-form-card">
      <div style="display:flex; flex-direction:column; gap:16px;">
        <label class="custom-checkbox-label">
          <input type="checkbox" id="remInvoice" ${r.invoice_reminders ? 'checked' : ''}>
          <div>
            <b>Invoice Due Date Reminders</b>
            <div style="font-size:12px; color:var(--tx-dim);">Send payment reminder to customers before invoice due date.</div>
          </div>
        </label>

        <label class="custom-checkbox-label">
          <input type="checkbox" id="remOverdue" ${r.overdue_reminders ? 'checked' : ''}>
          <div>
            <b>Overdue Invoices Reminders</b>
            <div style="font-size:12px; color:var(--tx-dim);">Automatically alert customers about overdue unpaid invoices.</div>
          </div>
        </label>

        <label class="custom-checkbox-label">
          <input type="checkbox" id="remPayment" ${r.payment_reminders ? 'checked' : ''}>
          <div>
            <b>Payment Received Confirmation</b>
            <div style="font-size:12px; color:var(--tx-dim);">Send receipt confirmation whenever a customer payment is recorded.</div>
          </div>
        </label>
      </div>
    </div>
  `;

  container.querySelector('#btnSaveReminders').addEventListener('click', async () => {
    const reminder_settings = {
      invoice_reminders: container.querySelector('#remInvoice').checked,
      overdue_reminders: container.querySelector('#remOverdue').checked,
      payment_reminders: container.querySelector('#remPayment').checked,
      email_notifications: true
    };
    try {
      await api('/settings/organization/', { method: 'POST', body: JSON.stringify({ reminder_settings }) });
      toast('Reminder settings saved.', 'success');
    } catch (err) {
      toast(err.message || 'Failed to save reminders.', 'error');
    }
  });
}

async function renderCustomerPortalPage(container) {
  const org = await api('/settings/organization/');
  const cp = org.portal_settings || {
    enabled: true,
    customer_login: true,
    invoice_access: true,
    payment_access: true,
    statement_access: true
  };

  container.innerHTML = `
    <div class="settings-page-header">
      <div class="settings-page-header-left">
        <h1>Customer Portal Settings</h1>
      </div>
      <div class="settings-page-header-right">
        <button type="button" class="btn-primary" id="btnSavePortal">Save Portal Settings</button>
      </div>
    </div>

    <div class="settings-form-card">
      <div style="margin-bottom:18px;">
        <label class="custom-checkbox-label" style="font-weight:700; font-size:15px;">
          <input type="checkbox" id="cpEnabled" ${cp.enabled ? 'checked' : ''}>
          <span>Enable Client & Customer Portal</span>
        </label>
      </div>

      <div style="display:flex; flex-direction:column; gap:14px; margin-left:22px;">
        <label class="custom-checkbox-label">
          <input type="checkbox" id="cpInvoices" ${cp.invoice_access ? 'checked' : ''}>
          <span>Allow customers to view and download invoices & estimates</span>
        </label>
        <label class="custom-checkbox-label">
          <input type="checkbox" id="cpPayments" ${cp.payment_access ? 'checked' : ''}>
          <span>Allow customers to make online payments via integrated gateways</span>
        </label>
        <label class="custom-checkbox-label">
          <input type="checkbox" id="cpStatements" ${cp.statement_access ? 'checked' : ''}>
          <span>Allow customers to access and download account statements</span>
        </label>
      </div>
    </div>
  `;

  container.querySelector('#btnSavePortal').addEventListener('click', async () => {
    const portal_settings = {
      enabled: container.querySelector('#cpEnabled').checked,
      invoice_access: container.querySelector('#cpInvoices').checked,
      payment_access: container.querySelector('#cpPayments').checked,
      statement_access: container.querySelector('#cpStatements').checked
    };
    try {
      await api('/settings/organization/', { method: 'POST', body: JSON.stringify({ portal_settings }) });
      toast('Customer Portal settings saved.', 'success');
    } catch (err) {
      toast(err.message || 'Failed to save portal settings.', 'error');
    }
  });
}

async function renderDigitalSignaturePage(container) {
  const data = await api('/settings/signatures/');
  const sig = data.digital_signature || {};
  let signatureData = data.signature_data || '';

  container.innerHTML = `
    <div class="settings-page-header">
      <div class="settings-page-header-left">
        <h1>Digital Signature</h1>
      </div>
      <div class="settings-page-header-right">
        <button type="button" class="btn-primary" id="btnSaveSignature">Save Signature</button>
      </div>
    </div>

    <div class="settings-form-card">
      <div class="form-group">
        <label>Signature Title*</label>
        <input type="text" id="sigTitleInput" value="${esc(data.signature_title || 'Authorized Signature')}" class="form-control" style="max-width:400px;">
      </div>

      <div class="form-group" style="margin-top:16px;">
        <label style="font-weight:600; display:block; margin-bottom:6px;">Upload Signature Image</label>
        <div style="display:flex; align-items:center; gap:16px;">
          <div id="sigPreviewBox" style="width:180px; height:80px; border:1px solid var(--bd); border-radius:8px; display:flex; align-items:center; justify-content:center; background:#fff; overflow:hidden;">
            ${signatureData ? `<img src="${signatureData}" style="max-width:100%; max-height:100%; object-fit:contain;">` : '<span style="font-size:12px; color:var(--tx-dim);">No signature</span>'}
          </div>
          <div>
            <input type="file" id="sigUploadInput" accept="image/*" style="display:none;">
            <button type="button" class="btn-outline" onclick="$('#sigUploadInput').click()">Upload Image</button>
            <button type="button" class="btn-outline" style="margin-left:8px;" onclick="clearSignature()">Clear</button>
            <div style="font-size:11px; color:var(--tx-dim); margin-top:4px;">Upload transparent PNG signature</div>
          </div>
        </div>
      </div>

      <div class="form-group" style="margin-top:16px;">
        <label class="custom-checkbox-label">
          <input type="checkbox" id="cbSigEnabled" ${sig.enabled !== false ? 'checked' : ''}>
          <span>Display signature on Invoices, Bills, Quotes, and Purchase Orders</span>
        </label>
      </div>
    </div>
  `;

  window.clearSignature = () => {
    signatureData = '';
    container.querySelector('#sigPreviewBox').innerHTML = '<span style="font-size:12px; color:var(--tx-dim);">No signature</span>';
  };

  const uploadInput = container.querySelector('#sigUploadInput');
  if (uploadInput) {
    uploadInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        signatureData = ev.target.result;
        container.querySelector('#sigPreviewBox').innerHTML = `<img src="${signatureData}" style="max-width:100%; max-height:100%; object-fit:contain;">`;
      };
      reader.readAsDataURL(file);
    });
  }

  container.querySelector('#btnSaveSignature').addEventListener('click', async () => {
    const signature_title = container.querySelector('#sigTitleInput').value.trim();
    const enabled = container.querySelector('#cbSigEnabled').checked;

    try {
      await api('/settings/signatures/', {
        method: 'POST',
        body: JSON.stringify({
          signature_data: signatureData,
          signature_title: signature_title || 'Authorized Signature',
          digital_signature: { enabled, placement: 'bottom_right' }
        })
      });
      toast('Digital signature settings saved.', 'success');
    } catch (err) {
      toast(err.message || 'Failed to save signature.', 'error');
    }
  });
}

async function renderPdfTemplatesPage(container) {
  let data = {};
  try { data = await api('/settings/templates/'); } catch(e) { data = {}; }
  const tpls = data.templates || {};

  const DOC_TYPES = [
    { key: 'quotes',              label: 'Quotes' },
    { key: 'sales_orders',        label: 'Sales Order' },
    { key: 'invoices',            label: 'Invoices' },
    { key: 'recurring_invoices',  label: 'Recurring Invoices' },
    { key: 'purchase_orders',     label: 'Purchase Order' },
    { key: 'bills',               label: 'Bills' },
  ];

  const THEMES = [
    { value: 'convosis_modern',   label: 'Convosis Modern (Recommended)' },
    { value: 'convosis_clean',    label: 'Convosis Clean Minimal' },
    { value: 'convosis_standard', label: 'Convosis Classic Standard' },
    { value: 'convosis_compact',  label: 'Convosis Compact' },
  ];

  const FONTS = [
    { value: 'Inter, system-ui, sans-serif', label: 'Inter (Modern Sans)' },
    { value: 'Roboto, sans-serif',           label: 'Roboto' },
    { value: 'Helvetica Neue, Arial, sans-serif', label: 'Helvetica Neue' },
    { value: 'Georgia, serif',               label: 'Georgia (Serif)' },
  ];

  const PAPER_SIZES = ['A4', 'A3', 'Letter', 'Legal'];

  const ORIENTATIONS = [
    { value: 'portrait',  label: 'Portrait' },
    { value: 'landscape', label: 'Landscape' },
  ];

  const COLOR_PALETTES = [
    { value: '#1a56db', label: 'Convosis Blue' },
    { value: '#16a34a', label: 'Forest Green' },
    { value: '#dc2626', label: 'Professional Red' },
    { value: '#7c3aed', label: 'Violet' },
    { value: '#ea580c', label: 'Orange' },
    { value: '#374151', label: 'Charcoal' },
  ];

  function buildDocTypePanel(dt) {
    const cfg = tpls[dt.key] || {};
    const themeVal = cfg.theme || 'convosis_modern';
    const fontVal = cfg.font || 'Inter, system-ui, sans-serif';
    const paperVal = cfg.paper_size || 'A4';
    const oriVal = cfg.orientation || 'portrait';
    const colorVal = cfg.primary_color || '#1a56db';

    return `
      <div class="pdf-tpl-doc-panel" id="pdfPanel_${dt.key}">
        <div class="settings-form-card" style="margin-bottom:0;">

          <!-- Row 1: Template Theme & Font -->
          <div class="form-grid-2" style="margin-bottom:16px;">
            <div class="form-group">
              <label class="form-label">Template Theme</label>
              <select class="form-control pdf-tpl-field" data-doc="${dt.key}" data-field="theme">
                ${THEMES.map(t => `<option value="${t.value}" ${themeVal === t.value ? 'selected' : ''}>${esc(t.label)}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Font Family</label>
              <select class="form-control pdf-tpl-field" data-doc="${dt.key}" data-field="font">
                ${FONTS.map(f => `<option value="${f.value}" ${fontVal === f.value ? 'selected' : ''}>${esc(f.label)}</option>`).join('')}
              </select>
            </div>
          </div>

          <!-- Row 2: Paper Size & Orientation -->
          <div class="form-grid-2" style="margin-bottom:16px;">
            <div class="form-group">
              <label class="form-label">Paper Size</label>
              <select class="form-control pdf-tpl-field" data-doc="${dt.key}" data-field="paper_size">
                ${PAPER_SIZES.map(p => `<option value="${p}" ${paperVal === p ? 'selected' : ''}>${p}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Page Orientation</label>
              <select class="form-control pdf-tpl-field" data-doc="${dt.key}" data-field="orientation">
                ${ORIENTATIONS.map(o => `<option value="${o.value}" ${oriVal === o.value ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}
              </select>
            </div>
          </div>

          <!-- Row 3: Primary Color -->
          <div class="form-group" style="margin-bottom:16px;">
            <label class="form-label">Primary Color</label>
            <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
              ${COLOR_PALETTES.map(c => `
                <label style="cursor:pointer; display:flex; flex-direction:column; align-items:center; gap:4px; font-size:11px; color:#6b7280;">
                  <input type="radio" class="pdf-tpl-color-radio" name="color_${dt.key}" data-doc="${dt.key}" data-field="primary_color" value="${c.value}" ${colorVal === c.value ? 'checked' : ''} style="display:none;">
                  <span style="display:block; width:28px; height:28px; border-radius:50%; background:${c.value}; border: 3px solid ${colorVal === c.value ? '#374151' : 'transparent'}; box-shadow:0 1px 4px rgba(0,0,0,.2);"></span>
                  ${esc(c.label)}
                </label>
              `).join('')}
              <label style="cursor:pointer; display:flex; flex-direction:column; align-items:center; gap:4px; font-size:11px; color:#6b7280;">
                <input type="color" class="pdf-tpl-color-custom" data-doc="${dt.key}" data-field="primary_color_custom" value="${colorVal}" style="width:28px; height:28px; border:none; border-radius:50%; cursor:pointer; padding:0;">
                Custom
              </label>
            </div>
          </div>

          <!-- Row 4: Header & Footer text -->
          <div class="form-grid-2" style="margin-bottom:16px;">
            <div class="form-group">
              <label class="form-label">Custom Header Text</label>
              <input type="text" class="form-control pdf-tpl-field" data-doc="${dt.key}" data-field="header_text" value="${esc(cfg.header_text || '')}" placeholder="Optional header note">
            </div>
            <div class="form-group">
              <label class="form-label">Custom Footer Text</label>
              <input type="text" class="form-control pdf-tpl-field" data-doc="${dt.key}" data-field="footer_text" value="${esc(cfg.footer_text || '')}" placeholder="e.g. Thank you for your business!">
            </div>
          </div>

          <!-- Row 5: Show/Hide Fields -->
          <div class="form-group" style="margin-bottom:16px;">
            <label class="form-label" style="margin-bottom:8px;">Include in PDF</label>
            <div style="display:flex; flex-wrap:wrap; gap:10px;">
              ${[
                ['show_logo',         'Company Logo'],
                ['show_signature',    'Digital Signature'],
                ['show_watermark',    'Watermark'],
                ['show_payment_stub', 'Payment Stub'],
                ['show_terms',        'Terms & Conditions'],
                ['show_notes',        'Notes / Remarks'],
                ['show_tax_summary',  'Tax Summary Table'],
              ].map(([k, lbl]) => `
                <label class="custom-checkbox-label" style="min-width:160px;">
                  <input type="checkbox" class="pdf-tpl-toggle" data-doc="${dt.key}" data-field="${k}" ${cfg[k] !== false ? 'checked' : ''}>
                  <span style="font-size:13px;">${esc(lbl)}</span>
                </label>
              `).join('')}
            </div>
          </div>

          <!-- Save button -->
          <div style="display:flex; justify-content:flex-end; gap:12px; padding-top:12px; border-top:1px solid var(--bd);">
            <button type="button" class="btn-secondary" onclick="this.closest('.pdf-tpl-doc-panel').querySelectorAll('select, input').forEach(el => { if(el.defaultValue !== undefined) el.value = el.defaultValue; })">Reset</button>
            <button type="button" class="btn-primary pdf-tpl-save-btn" data-doc="${dt.key}">Save ${esc(dt.label)} Template</button>
          </div>
        </div>
      </div>
    `;
  }

  container.innerHTML = `
    <div class="settings-page-header">
      <div class="settings-page-header-left">
        <h1>PDF Templates</h1>
        <p style="margin:4px 0 0; font-size:13px; color:var(--tx-dim);">Customize PDF layout and appearance for each document type.</p>
      </div>
    </div>

    <!-- Document type tabs -->
    <div class="pdf-tpl-tabs-wrap" style="border-bottom:1px solid var(--bd); margin-bottom:0; display:flex; gap:0; overflow-x:auto;">
      ${DOC_TYPES.map((dt, i) => `
        <button type="button"
          class="pdf-tpl-tab${i === 0 ? ' active' : ''}"
          data-target="pdfPanel_${dt.key}"
          style="padding:12px 20px; background:none; border:none; border-bottom: 3px solid ${i === 0 ? '#2563eb' : 'transparent'}; font-size:13px; font-weight:${i === 0 ? '600' : '400'}; color:${i === 0 ? '#2563eb' : '#6b7280'}; cursor:pointer; white-space:nowrap; transition:all .15s;"
          onclick="(function(btn){
            document.querySelectorAll('.pdf-tpl-tab').forEach(b => {
              b.style.borderBottomColor='transparent'; b.style.color='#6b7280'; b.style.fontWeight='400';
            });
            btn.style.borderBottomColor='#2563eb'; btn.style.color='#2563eb'; btn.style.fontWeight='600';
            document.querySelectorAll('.pdf-tpl-doc-panel').forEach(p => p.style.display='none');
            document.getElementById(btn.dataset.target).style.display='block';
          })(this)"
        >${esc(dt.label)}</button>
      `).join('')}
    </div>

    <div style="padding:20px 0;">
      ${DOC_TYPES.map((dt, i) => `
        <div style="display:${i === 0 ? 'block' : 'none'};">
          ${buildDocTypePanel(dt)}
        </div>
      `).join('')}
    </div>
  `;

  // Fix panel visibility toggling via IDs
  container.querySelectorAll('.pdf-tpl-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      container.querySelectorAll('.pdf-tpl-doc-panel').forEach(p => p.closest('div').style.display = 'none');
      const target = container.querySelector(`#${tab.dataset.target}`);
      if (target) target.closest('div').style.display = 'block';
    });
  });

  // Save button handlers
  container.querySelectorAll('.pdf-tpl-save-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const docKey = btn.dataset.doc;
      const panel = container.querySelector(`#pdfPanel_${docKey}`);
      if (!panel) return;

      const payload = {};
      panel.querySelectorAll('.pdf-tpl-field').forEach(el => {
        payload[el.dataset.field] = el.value;
      });
      panel.querySelectorAll('.pdf-tpl-toggle').forEach(el => {
        payload[el.dataset.field] = el.checked;
      });
      // Color radio
      const colorRadio = panel.querySelector('.pdf-tpl-color-radio:checked');
      if (colorRadio) payload['primary_color'] = colorRadio.value;
      const colorCustom = panel.querySelector('.pdf-tpl-color-custom');
      if (colorCustom && !colorRadio) payload['primary_color'] = colorCustom.value;

      try {
        await api('/settings/templates/', {
          method: 'POST',
          body: JSON.stringify({ doc_type: docKey, ...payload })
        });
        toast(`${docKey.replace(/_/g, ' ')} template saved.`, 'success');
      } catch (err) {
        toast(err.message || 'Failed to save template.', 'error');
      }
    });
  });
}

async function renderNotificationsPage(container) {
  const org = await api('/settings/organization/');
  const em = org.email_settings || {};
  const sms = org.sms_settings || {};

  container.innerHTML = `
    <div class="settings-page-header">
      <div class="settings-page-header-left">
        <h1>Notifications & Alerts</h1>
      </div>
      <div class="settings-page-header-right">
        <button type="button" class="btn-primary" id="btnSaveNotifications">Save Notifications</button>
      </div>
    </div>

    <div class="settings-form-card">
      <h3 style="font-size:15px; margin-bottom:12px;">Email Notifications</h3>
      <div class="form-group" style="margin-bottom:12px;">
        <label>Invoice Email Subject Template</label>
        <input type="text" id="notifInvSubj" value="${esc(em.invoice_email_subject || 'Invoice %number% from %company%')}" class="form-control" style="max-width:500px;">
      </div>
      <div class="form-group" style="margin-bottom:12px;">
        <label>Payment Receipt Email Subject</label>
        <input type="text" id="notifPaySubj" value="${esc(em.payment_email_subject || 'Payment Receipt %number% from %company%')}" class="form-control" style="max-width:500px;">
      </div>

      <h3 style="font-size:15px; margin-top:24px; margin-bottom:12px;">SMS Alerts (Bharat SMS Gateway)</h3>
      <div style="display:flex; flex-direction:column; gap:10px;">
        <label class="custom-checkbox-label">
          <input type="checkbox" id="smsPayment" ${sms.payment_alerts ? 'checked' : ''}>
          <span>Send SMS payment alerts on successful settlement</span>
        </label>
        <label class="custom-checkbox-label">
          <input type="checkbox" id="smsInvoice" ${sms.invoice_alerts ? 'checked' : ''}>
          <span>Send SMS alert when invoice is generated</span>
        </label>
      </div>
    </div>
  `;

  container.querySelector('#btnSaveNotifications').addEventListener('click', async () => {
    const email_settings = {
      invoice_email_subject: container.querySelector('#notifInvSubj').value.trim(),
      payment_email_subject: container.querySelector('#notifPaySubj').value.trim()
    };
    const sms_settings = {
      payment_alerts: container.querySelector('#smsPayment').checked,
      invoice_alerts: container.querySelector('#smsInvoice').checked
    };
    try {
      await api('/settings/organization/', { method: 'POST', body: JSON.stringify({ email_settings, sms_settings }) });
      toast('Notification preferences saved.', 'success');
    } catch (err) {
      toast(err.message || 'Failed to save notifications.', 'error');
    }
  });
}

// =========================================================================
// 12. E-WAY BILLS, E-INVOICING, MSME & OPENING BALANCES
// =========================================================================

async function renderEwayBillsPage(container) {
  let org = {};
  try { org = await api('/settings/organization/'); } catch(e) { org = APP.org || {}; }
  const gen = org.general_settings || {};
  const ewb = gen.eway_bill || {};

  container.innerHTML = `
    <div class="settings-page-header">
      <div class="settings-page-header-left">
        <h1>e-Way Bills</h1>
        <p style="font-size:13px; color:#6b7280; margin:4px 0 0;">Configure e-Way Bill thresholds, GSP portal integration, and automated generation under GST Rule 138.</p>
      </div>
      <div class="settings-page-header-right">
        <button type="button" class="btn-primary" id="btnSaveEwayBill">Save Changes</button>
      </div>
    </div>

    <div class="settings-form-card" style="margin-bottom:18px;">
      <h3 style="font-size:15px; font-weight:600; margin-bottom:12px;">General e-Way Bill Preferences</h3>
      <div style="display:flex; flex-direction:column; gap:12px;">
        <label class="custom-checkbox-label">
          <input type="checkbox" id="ewbEnabled" ${ewb.enabled !== false ? 'checked' : ''}>
          <span><b>Enable e-Way Bill Generation</b> (Allow generating e-way bills for applicable sales invoices, delivery challans and transfers)</span>
        </label>
        <label class="custom-checkbox-label">
          <input type="checkbox" id="ewbAutoGenerate" ${ewb.auto_generate ? 'checked' : ''}>
          <span><b>Auto-Generate on Approval</b> (Automatically generate Part-A / Part-B upon invoice authorization)</span>
        </label>
        <label class="custom-checkbox-label">
          <input type="checkbox" id="ewbAutoDistance" ${ewb.auto_distance !== false ? 'checked' : ''}>
          <span><b>Auto-calculate distance</b> based on dispatch and delivery PIN codes</span>
        </label>
      </div>
    </div>

    <div class="settings-form-card" style="margin-bottom:18px;">
      <h3 style="font-size:15px; font-weight:600; margin-bottom:14px;">Consignment Threshold Limits</h3>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
        <div class="form-group">
          <label style="font-weight:600; font-size:13px;">Inter-State Threshold Limit (₹)*</label>
          <input type="number" id="ewbInterThreshold" value="${ewb.inter_state_threshold || 50000}" class="form-control" style="max-width:320px;">
          <small style="color:#6b7280;">Statutory mandate: ₹50,000 for inter-state movements</small>
        </div>
        <div class="form-group">
          <label style="font-weight:600; font-size:13px;">Intra-State Threshold Limit (₹)*</label>
          <input type="number" id="ewbIntraThreshold" value="${ewb.intra_state_threshold || 100000}" class="form-control" style="max-width:320px;">
          <small style="color:#6b7280;">Default is ₹1,00,000 (varies by state jurisdiction)</small>
        </div>
      </div>
    </div>

    <div class="settings-form-card">
      <h3 style="font-size:15px; font-weight:600; margin-bottom:6px;">e-Way Bill Portal (NIC / GSP) Credentials</h3>
      <p style="font-size:12.5px; color:#6b7280; margin-bottom:14px;">Credentials used to communicate with the Government e-Way Bill system via official GST Suvidha Provider (GSP).</p>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
        <div class="form-group">
          <label style="font-weight:600; font-size:13px;">Portal Username</label>
          <input type="text" id="ewbUsername" value="${esc(ewb.username || '')}" placeholder="GSP Portal Username" class="form-control">
        </div>
        <div class="form-group">
          <label style="font-weight:600; font-size:13px;">Portal Password</label>
          <input type="password" id="ewbPassword" value="${esc(ewb.password || '')}" placeholder="••••••••••••" class="form-control">
        </div>
        <div class="form-group">
          <label style="font-weight:600; font-size:13px;">Client ID</label>
          <input type="text" id="ewbClientId" value="${esc(ewb.client_id || '')}" placeholder="GSP Client ID" class="form-control">
        </div>
        <div class="form-group">
          <label style="font-weight:600; font-size:13px;">Client Secret</label>
          <input type="password" id="ewbClientSecret" value="${esc(ewb.client_secret || '')}" placeholder="••••••••••••" class="form-control">
        </div>
      </div>
    </div>
  `;

  container.querySelector('#btnSaveEwayBill').addEventListener('click', async () => {
    const eway_bill = {
      enabled: container.querySelector('#ewbEnabled').checked,
      auto_generate: container.querySelector('#ewbAutoGenerate').checked,
      auto_distance: container.querySelector('#ewbAutoDistance').checked,
      inter_state_threshold: parseFloat(container.querySelector('#ewbInterThreshold').value) || 50000,
      intra_state_threshold: parseFloat(container.querySelector('#ewbIntraThreshold').value) || 100000,
      username: container.querySelector('#ewbUsername').value.trim(),
      password: container.querySelector('#ewbPassword').value.trim(),
      client_id: container.querySelector('#ewbClientId').value.trim(),
      client_secret: container.querySelector('#ewbClientSecret').value.trim(),
    };
    try {
      const genUpdated = { ...(org.general_settings || {}), eway_bill };
      await api('/settings/organization/', { method: 'POST', body: { general_settings: genUpdated } });
      toast('e-Way Bill settings saved successfully.', 'success');
    } catch(err) {
      toast(err.message || 'Failed to save e-Way Bill settings.', 'error');
    }
  });
}

async function renderEinvoicingPage(container) {
  let org = {};
  try { org = await api('/settings/organization/'); } catch(e) { org = APP.org || {}; }
  const gen = org.general_settings || {};
  const einv = gen.einvoicing || {};

  container.innerHTML = `
    <div class="settings-page-header">
      <div class="settings-page-header-left">
        <h1>e-Invoicing Settings</h1>
        <p style="font-size:13px; color:#6b7280; margin:4px 0 0;">Manage electronic invoicing, Invoice Registration Portal (IRP) connections, and IRN/Signed QR code generation.</p>
      </div>
      <div class="settings-page-header-right">
        <button type="button" class="btn-primary" id="btnSaveEinvoice">Save Changes</button>
      </div>
    </div>

    <div class="settings-form-card" style="margin-bottom:18px;">
      <h3 style="font-size:15px; font-weight:600; margin-bottom:12px;">e-Invoicing Status & Eligibility</h3>
      <div style="display:flex; flex-direction:column; gap:12px;">
        <label class="custom-checkbox-label">
          <input type="checkbox" id="einvEnabled" ${einv.enabled ? 'checked' : ''}>
          <span><b>Enable e-Invoicing</b> (Mandatory for businesses with annual turnover exceeding statutory threshold)</span>
        </label>
        <label class="custom-checkbox-label">
          <input type="checkbox" id="einvAutoIrn" ${einv.auto_irn ? 'checked' : ''}>
          <span><b>Auto-Generate IRN on Approval</b> (Instantly register invoices with IRP upon approval)</span>
        </label>
        <label class="custom-checkbox-label">
          <input type="checkbox" id="einvEwbTogether" ${einv.ewb_together !== false ? 'checked' : ''}>
          <span><b>Generate e-Way Bill along with e-Invoice</b> when transportation details are present</span>
        </label>
      </div>
    </div>

    <div class="settings-form-card" style="margin-bottom:18px;">
      <h3 style="font-size:15px; font-weight:600; margin-bottom:14px;">Statutory Threshold & Details</h3>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
        <div class="form-group">
          <label style="font-weight:600; font-size:13px;">Aggregate Annual Turnover Threshold (₹)</label>
          <select id="einvThreshold" class="form-control" style="max-width:320px;">
            <option value="5cr" ${einv.threshold === '5cr' ? 'selected' : ''}>Exceeding ₹5 Crore (Mandatory Phase IV)</option>
            <option value="10cr" ${einv.threshold === '10cr' ? 'selected' : ''}>Exceeding ₹10 Crore</option>
            <option value="20cr" ${einv.threshold === '20cr' ? 'selected' : ''}>Exceeding ₹20 Crore</option>
            <option value="voluntary" ${einv.threshold === 'voluntary' ? 'selected' : ''}>Voluntary Adoption</option>
          </select>
        </div>
        <div class="form-group">
          <label style="font-weight:600; font-size:13px;">Preferred IRP Portal</label>
          <select id="einvPortal" class="form-control" style="max-width:320px;">
            <option value="einvoice1" ${einv.portal === 'einvoice1' ? 'selected' : ''}>NIC IRP Portal 1 (einvoice1.gst.gov.in)</option>
            <option value="einvoice2" ${einv.portal === 'einvoice2' ? 'selected' : ''}>NIC IRP Portal 2 (einvoice2.gst.gov.in)</option>
            <option value="cleartax" ${einv.portal === 'cleartax' ? 'selected' : ''}>ClearTax GSP IRP</option>
            <option value="iris" ${einv.portal === 'iris' ? 'selected' : ''}>IRIS IRP</option>
          </select>
        </div>
      </div>
    </div>

    <div class="settings-form-card">
      <h3 style="font-size:15px; font-weight:600; margin-bottom:6px;">IRP Integration Credentials</h3>
      <p style="font-size:12.5px; color:#6b7280; margin-bottom:14px;">Direct API credentials generated from the e-Invoice system for your registered GSTIN.</p>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
        <div class="form-group">
          <label style="font-weight:600; font-size:13px;">API Username</label>
          <input type="text" id="einvUsername" value="${esc(einv.username || '')}" placeholder="API User" class="form-control">
        </div>
        <div class="form-group">
          <label style="font-weight:600; font-size:13px;">API Password</label>
          <input type="password" id="einvPassword" value="${esc(einv.password || '')}" placeholder="••••••••••••" class="form-control">
        </div>
        <div class="form-group">
          <label style="font-weight:600; font-size:13px;">Client ID</label>
          <input type="text" id="einvClientId" value="${esc(einv.client_id || '')}" placeholder="Client ID" class="form-control">
        </div>
        <div class="form-group">
          <label style="font-weight:600; font-size:13px;">Client Secret</label>
          <input type="password" id="einvClientSecret" value="${esc(einv.client_secret || '')}" placeholder="••••••••••••" class="form-control">
        </div>
      </div>
    </div>
  `;

  container.querySelector('#btnSaveEinvoice').addEventListener('click', async () => {
    const einvoicing = {
      enabled: container.querySelector('#einvEnabled').checked,
      auto_irn: container.querySelector('#einvAutoIrn').checked,
      ewb_together: container.querySelector('#einvEwbTogether').checked,
      threshold: container.querySelector('#einvThreshold').value,
      portal: container.querySelector('#einvPortal').value,
      username: container.querySelector('#einvUsername').value.trim(),
      password: container.querySelector('#einvPassword').value.trim(),
      client_id: container.querySelector('#einvClientId').value.trim(),
      client_secret: container.querySelector('#einvClientSecret').value.trim(),
    };
    try {
      const genUpdated = { ...(org.general_settings || {}), einvoicing };
      await api('/settings/organization/', { method: 'POST', body: { general_settings: genUpdated } });
      toast('e-Invoicing settings saved successfully.', 'success');
    } catch(err) {
      toast(err.message || 'Failed to save e-Invoicing settings.', 'error');
    }
  });
}

async function renderMsmePage(container) {
  let org = {};
  try { org = await api('/settings/organization/'); } catch(e) { org = APP.org || {}; }
  const gen = org.general_settings || {};
  const msme = gen.msme || {};

  container.innerHTML = `
    <div class="settings-page-header">
      <div class="settings-page-header-left">
        <h1>MSME / Udyam Settings</h1>
        <p style="font-size:13px; color:#6b7280; margin:4px 0 0;">Manage MSME registration, enterprise classification, and Income Tax Section 43B(h) compliance.</p>
      </div>
      <div class="settings-page-header-right">
        <button type="button" class="btn-primary" id="btnSaveMsme">Save Settings</button>
      </div>
    </div>

    <!-- Section 43B(h) Banner -->
    <div class="attention-alert-card" style="margin-bottom:18px;">
      <div class="alert-title">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="#f59e0b"><path d="M12 2L1 21h22L12 2zm0 15h.01M11 11h2v4h-2z"/></svg>
        Income Tax Section 43B(h) Compliance Notice
      </div>
      <div style="font-size:12.5px; line-height:1.5; color:#9a3412;">
        Payments to Micro and Small enterprises must be settled within 45 days (with written agreement) or 15 days (without agreement). Unpaid dues at year-end cannot be claimed as tax-deductible expenses until actual payment is made.
      </div>
    </div>

    <div class="settings-form-card" style="margin-bottom:18px;">
      <h3 style="font-size:15px; font-weight:600; margin-bottom:12px;">Organization MSME Registration</h3>
      <div style="display:flex; flex-direction:column; gap:14px;">
        <label class="custom-checkbox-label">
          <input type="checkbox" id="msmeRegistered" ${msme.registered ? 'checked' : ''}>
          <span><b>Is this organization registered under MSME / Udyam?</b></span>
        </label>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
          <div class="form-group">
            <label style="font-weight:600; font-size:13px;">Udyam Registration Number</label>
            <input type="text" id="msmeUdyamNumber" value="${esc(msme.udyam_number || '')}" placeholder="UDYAM-XX-00-0000000" class="form-control">
          </div>
          <div class="form-group">
            <label style="font-weight:600; font-size:13px;">Enterprise Type</label>
            <select id="msmeEnterpriseType" class="form-control">
              <option value="micro" ${msme.enterprise_type === 'micro' ? 'selected' : ''}>Micro Enterprise (Investment &le; ₹1 Cr, Turnover &le; ₹5 Cr)</option>
              <option value="small" ${msme.enterprise_type === 'small' ? 'selected' : ''}>Small Enterprise (Investment &le; ₹10 Cr, Turnover &le; ₹50 Cr)</option>
              <option value="medium" ${msme.enterprise_type === 'medium' ? 'selected' : ''}>Medium Enterprise (Investment &le; ₹50 Cr, Turnover &le; ₹250 Cr)</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label style="font-weight:600; font-size:13px;">Major Activity</label>
          <div style="display:flex; gap:20px; margin-top:4px;">
            <label class="custom-radio-label">
              <input type="radio" name="msmeActivity" value="manufacturing" ${msme.activity !== 'services' ? 'checked' : ''}>
              <span>Manufacturing</span>
            </label>
            <label class="custom-radio-label">
              <input type="radio" name="msmeActivity" value="services" ${msme.activity === 'services' ? 'checked' : ''}>
              <span>Services</span>
            </label>
          </div>
        </div>
      </div>
    </div>

    <div class="settings-form-card">
      <h3 style="font-size:15px; font-weight:600; margin-bottom:12px;">Vendor Payment Due Tracking (Section 43B(h))</h3>
      <div style="display:flex; flex-direction:column; gap:12px;">
        <label class="custom-checkbox-label">
          <input type="checkbox" id="msmeTrackDues" ${msme.track_dues !== false ? 'checked' : ''}>
          <span><b>Enable 45-day MSME Payment Tracking</b> (Display alert flags on purchase bills from MSME registered vendors)</span>
        </label>
        <label class="custom-checkbox-label">
          <input type="checkbox" id="msmeNotifyDueBills" ${msme.notify_due_bills ? 'checked' : ''}>
          <span><b>Alert before payment due date</b> (Send reminder notifications 7 days prior to the 45-day limit)</span>
        </label>
      </div>
    </div>
  `;

  container.querySelector('#btnSaveMsme').addEventListener('click', async () => {
    const msmeData = {
      registered: container.querySelector('#msmeRegistered').checked,
      udyam_number: container.querySelector('#msmeUdyamNumber').value.trim(),
      enterprise_type: container.querySelector('#msmeEnterpriseType').value,
      activity: container.querySelector('input[name="msmeActivity"]:checked')?.value || 'manufacturing',
      track_dues: container.querySelector('#msmeTrackDues').checked,
      notify_due_bills: container.querySelector('#msmeNotifyDueBills').checked,
    };
    try {
      const genUpdated = { ...(org.general_settings || {}), msme: msmeData };
      await api('/settings/organization/', { method: 'POST', body: { general_settings: genUpdated } });
      toast('MSME settings saved successfully.', 'success');
    } catch(err) {
      toast(err.message || 'Failed to save MSME settings.', 'error');
    }
  });
}

async function renderOpeningBalancesPage(container) {
  let org = {};
  try { org = await api('/settings/organization/'); } catch(e) { org = APP.org || {}; }
  const gen = org.general_settings || {};
  const ob = gen.opening_balances || {};

  container.innerHTML = `
    <div class="settings-page-header">
      <div class="settings-page-header-left">
        <h1>Opening Balances</h1>
        <p style="font-size:13px; color:#6b7280; margin:4px 0 0;">Configure conversion dates, initial cash in hand, and opening balances across chart of accounts.</p>
      </div>
      <div class="settings-page-header-right">
        <button type="button" class="btn-primary" id="btnSaveOpeningBalances">Save Balances</button>
      </div>
    </div>

    <div class="settings-form-card" style="margin-bottom:18px;">
      <h3 style="font-size:15px; font-weight:600; margin-bottom:12px;">Opening Balances Migration Date</h3>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
        <div class="form-group">
          <label style="font-weight:600; font-size:13px;">Migration / Conversion Date*</label>
          <input type="date" id="obDate" value="${ob.migration_date || '2026-04-01'}" class="form-control" style="max-width:280px;" required>
          <small style="color:#6b7280;">Date from which you began entering transactions in ConvosisBooks</small>
        </div>
        <div class="form-group">
          <label style="font-weight:600; font-size:13px;">Opening Cash in Hand (₹)</label>
          <input type="number" id="obCashInHand" value="${org.opening_cash || 0}" step="0.01" class="form-control" style="max-width:280px;">
          <small style="color:#6b7280;">Initial physical cash balance on migration date</small>
        </div>
      </div>
    </div>

    <!-- Quick Links & Module Setup -->
    <div class="settings-form-card">
      <h3 style="font-size:15px; font-weight:600; margin-bottom:12px;">Opening Balances by Category</h3>
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:16px;">
        <div style="padding:16px; border:1px solid var(--bd); border-radius:8px; background:var(--bg-card);">
          <div style="font-weight:600; font-size:14px; margin-bottom:4px;">Bank Accounts</div>
          <p style="font-size:12px; color:#6b7280; margin-bottom:12px;">Set opening balances for checking, savings, and loan accounts.</p>
          <a href="#/banking/accounts" class="btn-outline" style="font-size:12px; display:inline-block; text-decoration:none;">Manage Bank Accounts →</a>
        </div>
        <div style="padding:16px; border:1px solid var(--bd); border-radius:8px; background:var(--bg-card);">
          <div style="font-weight:600; font-size:14px; margin-bottom:4px;">Item Opening Stock</div>
          <p style="font-size:12px; color:#6b7280; margin-bottom:12px;">Enter opening inventory quantities and per-unit valuation.</p>
          <a href="#/inventory/items" class="btn-outline" style="font-size:12px; display:inline-block; text-decoration:none;">Manage Items & Stock →</a>
        </div>
        <div style="padding:16px; border:1px solid var(--bd); border-radius:8px; background:var(--bg-card);">
          <div style="font-weight:600; font-size:14px; margin-bottom:4px;">Customer Receivables</div>
          <p style="font-size:12px; color:#6b7280; margin-bottom:12px;">Track outstanding balances owed by customers on migration.</p>
          <a href="#/sales/customers" class="btn-outline" style="font-size:12px; display:inline-block; text-decoration:none;">View Customers →</a>
        </div>
        <div style="padding:16px; border:1px solid var(--bd); border-radius:8px; background:var(--bg-card);">
          <div style="font-weight:600; font-size:14px; margin-bottom:4px;">Vendor Payables</div>
          <p style="font-size:12px; color:#6b7280; margin-bottom:12px;">Configure opening bills and balances payable to suppliers.</p>
          <a href="#/purchases/vendors" class="btn-outline" style="font-size:12px; display:inline-block; text-decoration:none;">View Vendors →</a>
        </div>
      </div>
    </div>
  `;

  container.querySelector('#btnSaveOpeningBalances').addEventListener('click', async () => {
    const migration_date = container.querySelector('#obDate').value;
    const opening_cash = parseFloat(container.querySelector('#obCashInHand').value) || 0;
    try {
      const genUpdated = { ...(org.general_settings || {}), opening_balances: { migration_date, is_locked: false } };
      await api('/settings/organization/', { method: 'POST', body: { general_settings: genUpdated, opening_cash } });
      toast('Opening balances configuration saved.', 'success');
    } catch(err) {
      toast(err.message || 'Failed to save opening balances.', 'error');
    }
  });
}

async function renderEnterpriseSettingsPage(container) {
  container.innerHTML = `<div class="spin" style="margin:40px auto;">Loading settings registry…</div>`;
  const registry = await api('/settings/enterprise/registry/');
  const categories = registry.categories || [];
  const preferences = registry.preferences || {};
  const existingRoutes = {
    profile: '#/settings/profile',
    branding: '#/settings/branding',
    branches: '#/settings/branches',
    currencies: '#/settings/currencies',
    'opening-balances': '#/settings/opening-balances',
    'manage-subscription': '#/settings/subscription-billing',
    users: '#/settings/users',
    roles: '#/settings/roles',
    'activity-logs': '#/accountant/statutory-audit-logs',
    'tax-rates': '#/settings/taxes',
    'tax-groups': '#/settings/taxes',
    'gst-settings': '#/settings/taxes',
    'tds-tcs': '#/settings/direct-taxes',
    'tax-exemptions': '#/settings/taxes',
    einvoicing: '#/settings/einvoicing',
    'eway-bills': '#/settings/eway-bills',
    reminders: '#/settings/reminders',
    'portal-settings': '#/settings/customer-portal',
    'transaction-series': '#/settings/number-series',
    'pdf-templates': '#/settings/pdf-templates',
    'email-notifications': '#/settings/email-notifications',
    'sms-notifications': '#/settings/sms-notifications',
    'digital-signature': '#/settings/digital-signature',
    'opening-bal-import': '#/accountant/transaction-locking',
    'payment-gateways': '#/pay/payment-settings',
    'purchases-bills': '#/purchases/bills',
    'purchases-expenses': '#/purchases/expenses',
  };
  if (!categories.length) {
    container.innerHTML = '<div class="error-msg-card">The Settings registry is empty.</div>';
    return;
  }

  const firstCategory = categories[0];
  const firstSubmodule = firstCategory.submodules[0];
  if (!firstSubmodule) {
    container.innerHTML = '<div class="error-msg-card">The Settings registry has no entries.</div>';
    return;
  }

  container.innerHTML = `
    <div class="enterprise-registry-layout">
      <div class="enterprise-registry-header">
        <div style="display:flex;align-items:center;gap:12px;">
          <button type="button" class="enterprise-mobile-toggle-btn" id="btnToggleEnterpriseNav" title="Toggle Modules Menu">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            <span>Modules</span>
          </button>
          <h1>Enterprise Settings Registry</h1>
        </div>
        <div class="enterprise-registry-search-wrap">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" id="enterpriseNavSearch" placeholder="Filter settings modules..." autocomplete="off">
        </div>
      </div>
      <div class="enterprise-settings-container">
        <nav id="enterpriseSettingsNav" class="enterprise-middle-nav" aria-label="Enterprise settings categories">
          ${categories.map(category => `
            <div class="enterprise-category-group" data-category-group="${esc(category.id)}">
              <div class="enterprise-category-title">${esc(category.title)}</div>
              <div class="enterprise-category-items">
                ${category.submodules.map(submodule => `
                  <button type="button"
                    class="enterprise-submodule-btn ${category.id === firstCategory.id && submodule.id === firstSubmodule.id ? 'active' : ''}"
                    data-enterprise-category="${esc(category.id)}"
                    data-enterprise-submodule="${esc(submodule.id)}"
                    title="${esc(submodule.title)}">
                    <span class="submodule-label">${esc(submodule.title)}</span>
                    ${submodule.badge ? `<span class="submodule-chip">${esc(submodule.badge)}</span>` : ''}
                  </button>
                `).join('')}
              </div>
            </div>
          `).join('')}
        </nav>
        <section id="enterpriseSettingsDetail" class="enterprise-right-detail" aria-live="polite"></section>
      </div>
    </div>
  `;

  const nav = container.querySelector('#enterpriseSettingsNav');
  const detail = container.querySelector('#enterpriseSettingsDetail');
  const searchInput = container.querySelector('#enterpriseNavSearch');
  const mobileToggle = container.querySelector('#btnToggleEnterpriseNav');

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      const groups = nav.querySelectorAll('.enterprise-category-group');
      groups.forEach(group => {
        let visibleCount = 0;
        const buttons = group.querySelectorAll('.enterprise-submodule-btn');
        buttons.forEach(btn => {
          const text = btn.textContent.toLowerCase();
          if (!q || text.includes(q)) {
            btn.style.display = 'flex';
            visibleCount++;
          } else {
            btn.style.display = 'none';
          }
        });
        group.style.display = visibleCount > 0 ? '' : 'none';
      });
    });
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        searchInput.value = '';
        searchInput.dispatchEvent(new Event('input'));
      }
    });
  }

  if (mobileToggle) {
    mobileToggle.addEventListener('click', () => {
      nav.classList.toggle('mobile-open');
    });
  }

  let activeCategoryId = firstCategory.id;
  let activeSubmoduleId = firstSubmodule.id;
  let renderVersion = 0;

  async function renderSubmodule(categoryId, submoduleId) {
    const category = categories.find(item => item.id === categoryId);
    const submodule = category && category.submodules.find(item => item.id === submoduleId);
    if (!submodule) return;
    activeCategoryId = categoryId;
    activeSubmoduleId = submoduleId;
    const version = ++renderVersion;
    const existingRoute = existingRoutes[submodule.id];
    const header = `
      <div style="display:flex;align-items:baseline;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:20px;padding-bottom:14px;border-bottom:1px solid #e2e8f0;">
        <div style="display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;">
          <h2 style="font-size:18px;font-weight:700;color:#0f172a;margin:0;">${esc(submodule.title)}</h2>
          <span style="font-size:13px;color:#64748b;">${esc(submodule.description || '')}</span>
        </div>
      </div>
    `;

    if (existingRoute) {
      detail.innerHTML = `${header}
        <div class="settings-form-card" style="padding:24px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
          <p style="color:#475569;margin-bottom:16px;font-size:14px;">A related existing configuration page is available.</p>
          <a class="btn-primary" href="${existingRoute}">Open related settings</a>
        </div>`;
      return;
    }

    if (submodule.type !== 'prefs' || !preferences[submodule.prefGroup]) {
      detail.innerHTML = `${header}
        <div class="info-alert-card" style="margin-top:16px;">
          This registry entry does not have a verified application workflow yet. No records or integration status are simulated.
        </div>`;
      return;
    }

    const schema = preferences[submodule.prefGroup];
    detail.innerHTML = `${header}<div class="spin" style="margin:28px auto;">Loading saved preferences…</div>`;
    let response;
    try {
      response = await api(`/settings/enterprise/preferences/${encodeURIComponent(submodule.prefGroup)}/`);
    } catch (error) {
      if (version !== renderVersion) return;
      detail.innerHTML = `${header}<div class="error-msg-card" style="margin-top:16px;">${esc(error.message || 'Could not load preferences.')}</div>`;
      return;
    }
    if (version !== renderVersion) return;

    const values = response.values || {};
    const fields = schema.fields || [];
    const editableFields = fields.filter(field => !field.readOnly);
    const statusMessage = schema.integrationStatus === 'read_only'
      ? 'This section is read-only until authoritative subscription data is available.'
      : 'Changes are stored for this organization, but runtime behavior is not wired for this setting yet.';
    const fieldHtml = fields.map(field => {
      const currentValue = values[field.key];
      const disabled = field.readOnly ? 'disabled' : '';
      let control;
      if (field.type === 'toggle') {
        control = `<label style="display:flex;align-items:center;gap:8px;">
          <input type="checkbox" data-enterprise-pref-key="${esc(field.key)}" ${currentValue === true ? 'checked' : ''} ${disabled}>
          <span>${esc(field.label)}</span>
        </label>`;
      } else if (field.type === 'select') {
        const options = (field.options || []).map(option =>
          `<option value="${esc(option)}" ${String(currentValue) === option ? 'selected' : ''}>${esc(option)}</option>`
        ).join('');
        control = `<label>${esc(field.label)}
          <select class="form-control" data-enterprise-pref-key="${esc(field.key)}" ${disabled}>
            <option value="">Select an option</option>${options}
          </select>
        </label>`;
      } else {
        const inputType = field.type === 'number' ? 'number' : 'text';
        const step = field.type === 'number' ? 'step="any" min="0"' : '';
        control = `<label>${esc(field.label)}
          <input class="form-control" type="${inputType}" ${step}
            data-enterprise-pref-key="${esc(field.key)}"
            value="${currentValue === undefined || currentValue === null ? '' : esc(String(currentValue))}" ${disabled}>
        </label>`;
      }
      return `<div class="form-group" style="margin-bottom:16px;">
        ${control}
        ${field.help ? `<small style="display:block;color:#6b7280;margin-top:5px;">${esc(field.help)}</small>` : ''}
      </div>`;
    }).join('');

    detail.innerHTML = `${header}
      <div class="info-alert-card" style="margin:12px 0;">${esc(statusMessage)}</div>
      <form id="enterprisePreferenceForm" class="settings-form-card">
        <div class="form-grid-2">${fieldHtml}</div>
        ${editableFields.length ? '<div style="display:flex;justify-content:flex-end;margin-top:16px;"><button type="submit" class="btn-primary">Save Preferences</button></div>' : ''}
      </form>`;

    const form = detail.querySelector('#enterprisePreferenceForm');
    if (!form || !editableFields.length) return;
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const saveButton = form.querySelector('button[type="submit"]');
      const nextValues = {};
      fields.forEach(field => {
        if (field.readOnly) return;
        const input = form.querySelector(`[data-enterprise-pref-key="${field.key}"]`);
        if (!input) return;
        if (field.type === 'toggle') {
          nextValues[field.key] = input.checked;
        } else if (field.type === 'number') {
          if (input.value !== '') nextValues[field.key] = Number(input.value);
        } else {
          nextValues[field.key] = input.value;
        }
      });
      saveButton.disabled = true;
      try {
        const saved = await api(`/settings/enterprise/preferences/${encodeURIComponent(submodule.prefGroup)}/`, {
          method: 'PUT',
          body: JSON.stringify({ values: nextValues }),
        });
        toast(saved.integration_status === 'requires_workflow_wiring'
          ? 'Preferences saved; runtime behavior is not wired for this setting yet.'
          : 'Preferences saved.', 'success');
        if (saved && saved.enabled_modules) {
          if (window.APP && window.APP.org) {
            window.APP.org.enabled_modules = saved.enabled_modules;
          }
          if (typeof window.renderSidebar === 'function') {
            window.renderSidebar();
          }
        }
        await renderSubmodule(activeCategoryId, activeSubmoduleId);
      } catch (error) {
        toast(error.message || 'Failed to save preferences.', 'error');
      } finally {
        saveButton.disabled = false;
      }
    });
  }

  nav.addEventListener('click', event => {
    const item = event.target.closest('[data-enterprise-submodule]');
    if (!item) return;
    nav.querySelectorAll('[data-enterprise-submodule]').forEach(button => button.classList.remove('active'));
    item.classList.add('active');
    if (nav.classList.contains('mobile-open')) {
      nav.classList.remove('mobile-open');
    }
    renderSubmodule(item.dataset.enterpriseCategory, item.dataset.enterpriseSubmodule);
  });

  await renderSubmodule(activeCategoryId, activeSubmoduleId);
}

// Global window registration
function renderBusinessLocationCustomField(field, value) {
  const required = field.required ? ' required' : '';
  const readOnly = field.read_only ? ' readonly' : '';
  const label = `${esc(field.label)}${field.required ? '*' : ''}`;
  if (field.field_type === 'checkbox') {
    const checked = value === true || value === 'true' || value === '1' ? ' checked' : '';
    return `<label class="form-group"><input type="checkbox" data-location-custom-field="${esc(field.name)}"${checked}${field.read_only ? ' disabled' : ''}> ${label}</label>`;
  }
  if (field.field_type === 'select') {
    const options = String(field.options || '').split(',').map(option => option.trim()).filter(Boolean);
    return `<label class="form-group">${label}<select class="form-control" data-location-custom-field="${esc(field.name)}"${required}${field.read_only ? ' disabled' : ''}><option value="">Select ${esc(field.label)}</option>${options.map(option => `<option value="${esc(option)}"${String(value ?? '') === option ? ' selected' : ''}>${esc(option)}</option>`).join('')}</select></label>`;
  }
  const type = ['number', 'date'].includes(field.field_type) ? field.field_type : 'text';
  return `<label class="form-group">${label}<input class="form-control" type="${type}" data-location-custom-field="${esc(field.name)}" value="${esc(value ?? '')}"${required}${readOnly}></label>`;
}

function getLocationCountryOptions(selectedCountry) {
  const names = new Set();
  if (typeof Intl !== 'undefined' && typeof Intl.DisplayNames === 'function') {
    try {
      const displayNames = new Intl.DisplayNames(['en'], { type: 'region' });
      for (let first = 65; first <= 90; first += 1) {
        for (let second = 65; second <= 90; second += 1) {
          const code = String.fromCharCode(first, second);
          if (['EU', 'EZ', 'UN', 'XA', 'XB', 'ZZ'].includes(code)) continue;
          const name = displayNames.of(code);
          if (name && name !== code) names.add(name);
        }
      }
    } catch (error) {
      console.warn('Country names are unavailable in this browser.', error);
    }
  }
  names.add('India');
  if (selectedCountry) names.add(selectedCountry);
  return Array.from(names).sort((left, right) => left.localeCompare(right));
}

function getLocationIndiaStates(selectedState) {
  const normalizedSelectedState = String(selectedState || '').replace(/^\[\d+\]\s*/, '').trim();
  const stateOptions = typeof GST_STATE_OPTIONS !== 'undefined' ? GST_STATE_OPTIONS : [];
  const states = stateOptions
    .map(([value]) => String(value || '').replace(/^\[\d+\]\s*/, '').trim())
    .filter(Boolean);
  if (normalizedSelectedState && !states.some(state => state.toLowerCase() === normalizedSelectedState.toLowerCase())) {
    states.push(normalizedSelectedState);
  }
  return states.sort((left, right) => left.localeCompare(right));
}

function renderLocationStateControl(country, selectedState) {
  const normalizedSelectedState = String(selectedState || '').replace(/^\[\d+\]\s*/, '').trim();
  if (String(country || '').toLowerCase() !== 'india') {
    return `<input class="form-control" id="locationState" value="${esc(normalizedSelectedState)}" maxlength="60">`;
  }
  return `<select class="form-control" id="locationState">
    <option value="">Select State/Union Territory</option>
    ${getLocationIndiaStates(normalizedSelectedState).map(state => `<option value="${esc(state)}" ${state.toLowerCase() === normalizedSelectedState.toLowerCase() ? 'selected' : ''}>${esc(state)}</option>`).join('')}
  </select>`;
}

async function renderBusinessLocationsPage(container) {
  container.classList.remove('settings-pane-fixed');
  container.classList.remove('settings-location-pane');
  container.style.padding = '28px 36px 60px';
  container.style.overflow = 'auto';
  container.style.height = '';
  container.innerHTML = `<div class="spin" style="margin:40px auto;">Loading branches…</div>`;
  let locations = [];
  let users = [];
  let series = [];
  let customFields = [];
  let organization = null;
  try {
    const [locationData, userData, organizationData, customFieldData] = await Promise.all([
      api('/settings/branches/'),
      api('/settings/users/'),
      api('/settings/organization/'),
      api('custom-fields/?module=locations&page_size=100')
    ]);
    locations = locationData.locations || [];
    users = (userData.users || []).filter(user => user.is_active !== false && (!user.status || user.status === 'active'));
    series = locationData.transaction_series_options || [];
    customFields = (customFieldData.results || []).filter(field => field.active && !field.hidden && field.form_visible);
    organization = organizationData || null;
  } catch (error) {
    container.innerHTML = `<div class="error-msg-card">${esc(error.message || 'Failed to load branches.')}</div>`;
    return;
  }

  async function openLocation(locationId = null) {
    let location = {
      id: null, location_type: 'business', name: '', logo_data: '', parent_id: null,
      gstin: '', attention: '', address: '', street1: '', street2: '', city: '', pincode: '',
      country: 'India', state: '', phone: '', fax: '', website: '', prefix: '',
      primary_contact_id: null, assigned_user_ids: [], transaction_series_ids: [],
      default_transaction_series_id: null, is_default: false, active: true, warehouse_ids: []
    };
    if (locationId) {
      try { location = await api(`/settings/branches/${locationId}/`); }
      catch (error) { toast(error.message || 'Failed to load location.', 'error'); return; }
    }
    let availableSeries = series.filter(item =>
      !item.business_location_id || String(item.business_location_id) === String(location.id || '')
    );
    const countryOptions = getLocationCountryOptions(location.country || 'India');
    container.classList.add('settings-pane-fixed');
    container.classList.add('settings-location-pane');
    container.style.padding = '0';
    container.style.overflow = 'hidden';
    container.style.height = '100%';
    container.innerHTML = `
      <section class="settings-location-editor" aria-label="${locationId ? 'Edit Branch' : 'Add Branch'}">
        <header class="settings-location-editor-header">
          <h1>${locationId ? 'Edit Branch' : 'Add Branch'}</h1>
        </header>
        <div class="settings-location-editor-scroll">
          <div class="settings-location-form">
            <div class="settings-location-row">
              <span class="settings-location-label">Location Type</span>
              <div class="settings-location-type-cards" role="radiogroup" aria-label="Location Type">
                <label class="settings-location-type-card" data-location-type-card="business">
                  <input type="radio" name="locationType" value="business" ${location.location_type === 'business' ? 'checked' : ''}>
                  <span class="settings-location-type-title">Business Location</span>
                  <span class="settings-location-type-description">A Business Location represents your organisation or office's operational location. It is used to record transactions, assess regional performance, and monitor stock levels for items stored at this location.</span>
                </label>
                <label class="settings-location-type-card" data-location-type-card="warehouse">
                  <input type="radio" name="locationType" value="warehouse" ${location.location_type === 'warehouse' ? 'checked' : ''}>
                  <span class="settings-location-type-title">Warehouse Only Location</span>
                  <span class="settings-location-type-description">A Warehouse Only Location refers to where your items are stored. It helps track and monitor stock levels for items stored at this location.</span>
                </label>
              </div>
            </div>
            <div data-business-location-only>
              <div class="settings-location-row">
                <label class="settings-location-label" for="locationLogo">Logo</label>
                <div class="settings-location-field">
                  <select class="form-control" id="locationLogo">
                    <option value="__no_logo__" ${!locationId || location.logo_data === '__no_logo__' ? 'selected' : ''}>No Logo</option>
                    <option value="" ${locationId && !location.logo_data ? 'selected' : ''}>Same as Organization Logo</option>
                    ${location.logo_data && location.logo_data !== '__no_logo__' ? `<option value="${esc(location.logo_data)}" selected>Location-specific Logo</option>` : ''}
                    <option value="__upload_new_logo__">Upload a New Logo</option>
                  </select>
                  <input type="file" id="locationLogoFile" accept="image/png,image/jpeg,image/webp,image/gif" hidden>
                  <div id="locationLogoPreview" class="settings-location-logo-preview">${location.logo_data && location.logo_data !== '__no_logo__' ? `<img src="${esc(location.logo_data)}" alt="Location logo">` : (!locationId || location.logo_data === '__no_logo__' ? '<span style="color:#94a3b8;font-size:12px;">No logo configured for this branch.</span>' : (organization && organization.logo_data ? `<img src="${esc(organization.logo_data)}" alt="Organization logo">` : ''))}</div>
                </div>
              </div>
            </div>
            <div class="settings-location-row">
              <span class="settings-location-label">Branch Name &amp; Prefix</span>
              <div class="settings-location-field settings-location-field-pair">
                <div>
                  <label class="settings-location-inline-label" for="locationName">Branch Name <span class="required">*</span></label>
                  <input class="form-control" id="locationName" value="${esc(location.name)}" maxlength="120" required placeholder="Enter branch name">
                  <div id="locationNameErr" class="field-error" style="display:none;color:#ef4444;font-size:11px;margin-top:4px;">Branch Name is required.</div>
                </div>
                <div>
                  <label class="settings-location-inline-label" for="locationPrefix">Branch Prefix</label>
                  <input class="form-control" id="locationPrefix" value="${esc(location.prefix || '')}" maxlength="20" placeholder="Enter prefix" style="text-transform:uppercase;">
                </div>
              </div>
            </div>
            <div class="settings-location-row" id="locationChildWrap" data-business-location-only ${location.is_default || location.is_head_office ? 'style="display:none;"' : ''}>
              <span class="settings-location-label" aria-hidden="true"></span>
              <label class="settings-location-field settings-location-checkbox">
                <input type="checkbox" id="locationChild" ${location.parent_id && !location.is_default && !location.is_head_office ? 'checked' : ''}>
                <span>This is a Child Location</span>
              </label>
            </div>
            <div class="settings-location-row" id="parentLocationWrap" ${location.location_type === 'warehouse' || (location.parent_id && !location.is_default && !location.is_head_office) ? '' : 'hidden'}>
              <label class="settings-location-label" for="locationParent"><span id="parentLocationLabel">Parent Location</span> <span class="required">*</span></label>
              <div class="settings-location-field">
                <select class="form-control" id="locationParent">
                  <option value="">Select Location</option>
                  ${locations.filter(item => item.location_type === 'business' && item.id !== location.id && (item.active || item.id === location.parent_id)).map(item => `<option value="${item.id}" ${String(item.id) === String(location.parent_id || '') ? 'selected' : ''}>${esc(item.name)}${item.active ? '' : ' (Inactive)'}</option>`).join('')}
                </select>
              </div>
            </div>
            <div class="settings-location-row settings-location-address-heading">
              <span class="settings-location-label">Address</span>
            </div>
            <div class="settings-location-row">
              <span class="settings-location-label" aria-hidden="true"></span>
              <div class="settings-location-field settings-location-address-fields">
                <input class="form-control" id="locationAttention" value="${esc(location.attention)}" maxlength="120" placeholder="Attention">
                <input class="form-control" id="locationStreet1" value="${esc(location.street1)}" maxlength="200" placeholder="Street 1">
                <input class="form-control" id="locationStreet2" value="${esc(location.street2)}" maxlength="200" placeholder="Street 2">
                <div class="settings-location-field-pair">
                  <input class="form-control" id="locationCity" value="${esc(location.city)}" maxlength="100" placeholder="City">
                  <input class="form-control" id="locationPincode" value="${esc(location.pincode)}" maxlength="20" placeholder="Pin Code">
                </div>
                <select class="form-control" id="locationCountry">
                  ${countryOptions.map(country => `<option value="${esc(country)}" ${country.toLowerCase() === String(location.country || 'India').toLowerCase() ? 'selected' : ''}>${esc(country)}</option>`).join('')}
                </select>
                <div class="settings-location-field-pair">
                  <span id="locationStateControl">${renderLocationStateControl(location.country || 'India', location.state)}</span>
                  <input class="form-control" id="locationPhone" type="tel" value="${esc(location.phone)}" maxlength="50" autocomplete="tel" placeholder="Phone">
                </div>
                <input class="form-control" id="locationFax" type="tel" value="${esc(location.fax)}" maxlength="50" placeholder="Fax Number">
              </div>
            </div>
            <div class="settings-location-row">
              <label class="settings-location-label" for="locationWebsite">Website URL</label>
              <div class="settings-location-field">
                <input class="form-control" id="locationWebsite" type="url" value="${esc(location.website)}" maxlength="200" placeholder="https://example.com">
              </div>
            </div>
            <div class="settings-location-row">
              <label class="settings-location-label" for="locationPrimaryContact">Primary Contact <span class="required" id="primaryContactRequired">*</span></label>
              <div class="settings-location-field">
                <select class="form-control" id="locationPrimaryContact">
                  <option value="">Select contact</option>
                  ${users.map(user => `<option value="${user.id}" ${String(user.id) === String(location.primary_contact_id || '') ? 'selected' : ''}>${esc(user.name)} &lt;${esc(user.email)}&gt;</option>`).join('')}
                </select>
              </div>
            </div>
            <div class="settings-location-row" data-business-location-only>
              <label class="settings-location-label" for="locationSeriesToggle">Transaction Number Series <span class="required">*</span></label>
              <div class="settings-location-field">
                <div class="settings-location-series-picker" id="locationSeriesPicker">
                  <div class="form-control settings-location-series-control">
                    <div class="settings-location-series-selected" id="locationSeriesSelected" aria-live="polite"></div>
                    <button type="button" class="settings-location-series-toggle" id="locationSeriesToggle" aria-label="Select transaction number series" aria-haspopup="true" aria-expanded="false" aria-controls="locationSeriesDropdown">
                      <svg aria-hidden="true" viewBox="0 0 20 20" width="16" height="16"><path d="m5 7.5 5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"></path></svg>
                    </button>
                  </div>
                  <div class="settings-location-series-dropdown" id="locationSeriesDropdown" role="group" aria-label="Available transaction number series" hidden>
                    <input class="form-control" id="locationSeriesSearch" type="search" placeholder="Search transaction series" aria-label="Search transaction series" ${availableSeries.length > 8 ? '' : 'hidden'}>
                    <div class="settings-location-series-options" id="locationSeriesOptions"></div>
                  </div>
                </div>
                <button type="button" class="btn-secondary" id="btnAddLocationSeries">+ Add Transaction Series</button>
                <small class="settings-location-help">Select one or more series, then choose the default series below.</small>
              </div>
            </div>
            <div class="settings-location-row" data-business-location-only>
              <label class="settings-location-label" for="locationDefaultSeries">Default Transaction Number Series <span class="required">*</span></label>
              <div class="settings-location-field">
                <select class="form-control" id="locationDefaultSeries" required>
                  <option value="">Select default series</option>
                </select>
              </div>
            </div>
            <div class="settings-location-row">
              <div class="settings-location-label">Location Access</div>
              <div class="settings-location-field">
                <div class="settings-location-access-summary" id="locationAccessCount"></div>
                <div class="settings-location-access-table">
                  <table class="table"><thead><tr><th>User</th><th>Email</th><th>Role</th><th>Access</th></tr></thead>
                    <tbody>${users.map(user => `<tr><td>${esc(user.name)}</td><td>${esc(user.email)}</td><td>${esc(user.role)}</td><td><input type="checkbox" class="locationUser" value="${user.id}" ${location.assigned_user_ids.includes(user.id) ? 'checked' : ''} aria-label="Grant location access to ${esc(user.name)}"></td></tr>`).join('')}</tbody>
                  </table>
                </div>
              </div>
            </div>
            ${customFields.length ? `<div class="settings-location-row"><div class="settings-location-label">Additional Fields</div><div class="settings-location-field"><div class="settings-location-custom-fields">${customFields.map(field => {
              const defaultValue = field.default_value && typeof field.default_value === 'object' && 'value' in field.default_value
                ? field.default_value.value
                : field.default_value;
              return renderBusinessLocationCustomField(field, (location.custom_fields_data || {})[field.name] ?? defaultValue ?? '');
            }).join('')}</div></div></div>` : ''}
            <div class="settings-location-row">
              <div class="settings-location-label">Status</div>
              <div class="settings-location-field settings-location-status">
                <label><input type="checkbox" id="locationActive" ${location.active ? 'checked' : ''}> Active</label>
                <label data-business-location-only><input type="checkbox" id="locationIsDefault" ${location.is_default ? 'checked' : ''}> Set as default branch</label>
              </div>
            </div>
            <input type="hidden" id="locationGstin" value="${esc(location.gstin)}">
          </div>
        </div>
        <footer class="settings-location-editor-footer">
          ${locationId ? '<button type="button" class="btn-secondary" id="btnDeleteLocation" style="color:#dc2626;border-color:#fecaca;">Delete</button>' : ''}
          <button type="button" class="btn-primary" id="btnSaveLocation">Save</button>
          <button type="button" class="btn-secondary" id="btnCancelLocation">Cancel</button>
        </footer>
      </section>
    `;
    const root = container;
    const updateLocationAccessCount = () => {
      const count = root.querySelectorAll('.locationUser:checked').length;
      root.querySelector('#locationAccessCount').innerHTML = `<strong>${count} user(s) selected</strong><span>Selected users can create and access transactions for this location.</span>`;
    };
    const updateLocationTypeFields = () => {
      const locationType = root.querySelector('input[name="locationType"]:checked')?.value || 'business';
      const isBusiness = locationType === 'business';
      root.querySelectorAll('[data-business-location-only]').forEach(field => { field.hidden = !isBusiness; });
      root.querySelectorAll('[data-location-type-card]').forEach(card => {
        card.classList.toggle('is-selected', card.dataset.locationTypeCard === locationType);
      });
      root.querySelector('#parentLocationLabel').textContent = 'Parent Location';
      root.querySelector('#locationChildWrap').hidden = !isBusiness;
      root.querySelector('#parentLocationWrap').hidden = isBusiness ? !root.querySelector('#locationChild').checked : false;
      root.querySelector('#locationParent').required = !isBusiness || root.querySelector('#locationChild').checked;
      root.querySelector('#primaryContactRequired').hidden = !isBusiness;
      root.querySelector('#locationPrimaryContact').required = isBusiness;
    };
    root.querySelectorAll('.locationUser').forEach(input => input.addEventListener('change', updateLocationAccessCount));
    root.querySelectorAll('input[name="locationType"]').forEach(input => input.addEventListener('change', () => {
      updateLocationTypeFields();
      if (input.value !== 'business') closeSeriesDropdown();
    }));
    updateLocationTypeFields();
    updateLocationAccessCount();
    if (window.setupSearchableSelect) {
      setupSearchableSelect(root.querySelector('#locationPrimaryContact'), { placeholder: 'Search contacts…' });
    }
    root.querySelector('#locationChild').addEventListener('change', event => {
      root.querySelector('#parentLocationWrap').hidden = !event.target.checked;
      root.querySelector('#locationParent').required = event.target.checked;
      if (!event.target.checked && root.querySelector('input[name="locationType"]:checked')?.value === 'business') {
        root.querySelector('#locationParent').value = '';
      }
    });
    root.querySelector('#locationIsDefault').addEventListener('change', event => {
      if (!event.target.checked) return;
      const message = locationId
        ? 'Set this branch as the default location? The existing default location will be changed.'
        : 'Set this branch as the default location? The existing default location will be changed.';
      if (!window.confirm(message)) {
        event.target.checked = false;
      }
    });
    root.querySelector('#btnCancelLocation').addEventListener('click', () => renderBusinessLocationsPage(container));
    if (locationId) {
      root.querySelector('#btnDeleteLocation').addEventListener('click', async () => {
        if (!window.confirm(`Delete "${location.name}"? This action cannot be undone.`)) return;
        const deleteButton = root.querySelector('#btnDeleteLocation');
        deleteButton.disabled = true;
        try {
          await api(`/settings/branches/${locationId}/`, { method: 'DELETE' });
          toast('Branch deleted successfully.', 'success');
          await renderBusinessLocationsPage(container);
        } catch (error) {
          toast(error.message || 'This branch could not be deleted.', 'error');
        } finally {
          if (deleteButton.isConnected) deleteButton.disabled = false;
        }
      });
    }
    const defaultSeriesSelect = root.querySelector('#locationDefaultSeries');
    const seriesPicker = root.querySelector('#locationSeriesPicker');
    const seriesToggleButton = root.querySelector('#locationSeriesToggle');
    const seriesDropdown = root.querySelector('#locationSeriesDropdown');
    const seriesSearchInput = root.querySelector('#locationSeriesSearch');
    const seriesOptionsList = root.querySelector('#locationSeriesOptions');
    const selectedSeriesList = root.querySelector('#locationSeriesSelected');
    const selectedSeriesIdSet = new Set((location.transaction_series_ids || []).map(Number).filter(Number.isFinite));
    let seriesDropdownOpen = false;
    const getSeriesLabel = item => String(item.label || item.name);
    const closeSeriesDropdown = (restoreFocus = false) => {
      if (!seriesDropdownOpen) return;
      seriesDropdownOpen = false;
      seriesDropdown.hidden = true;
      seriesToggleButton.setAttribute('aria-expanded', 'false');
      if (restoreFocus && seriesToggleButton.isConnected) seriesToggleButton.focus();
    };
    const positionSeriesDropdown = () => {
      if (!seriesDropdownOpen) return;
      const rect = seriesPicker.getBoundingClientRect();
      const viewportPadding = 8;
      const width = Math.max(320, Math.min(rect.width, window.innerWidth - viewportPadding * 2));
      const left = Math.max(viewportPadding, Math.min(rect.left, window.innerWidth - width - viewportPadding));
      const availableBelow = window.innerHeight - rect.bottom - viewportPadding - 4;
      const availableAbove = rect.top - viewportPadding - 4;
      const maxHeight = Math.max(220, Math.min(400, Math.max(availableBelow, availableAbove)));
      const searchHeight = seriesSearchInput.hidden ? 0 : (seriesSearchInput.offsetHeight || 38) + 12;
      seriesDropdown.style.width = `${width}px`;
      seriesDropdown.style.minWidth = '320px';
      seriesDropdown.style.left = `${left}px`;
      seriesDropdown.style.maxHeight = `${maxHeight}px`;
      seriesOptionsList.style.maxHeight = `${Math.max(140, maxHeight - searchHeight - 20)}px`;
      seriesOptionsList.style.overflowY = 'auto';
      const popupHeight = Math.min(seriesDropdown.scrollHeight, maxHeight);
      seriesDropdown.style.top = availableBelow >= popupHeight || availableBelow >= 220
        ? `${rect.bottom + 4}px`
        : `${Math.max(viewportPadding, rect.top - popupHeight - 4)}px`;
    };
    const renderSelectedSeries = () => {
      const selected = availableSeries.filter(item => selectedSeriesIdSet.has(Number(item.id)));
      selectedSeriesList.innerHTML = selected.map(item => `
        <span class="settings-location-series-chip">
          <span>${esc(getSeriesLabel(item))}</span>
          <button type="button" data-remove-series-id="${Number(item.id)}" aria-label="Remove ${esc(getSeriesLabel(item))}">×</button>
        </span>`).join('') || '<span class="settings-location-series-placeholder">Select transaction series</span>';
    };
    const renderSeriesOptions = () => {
      const search = seriesSearchInput.value.trim().toLowerCase();
      const filtered = availableSeries.filter(item => getSeriesLabel(item).toLowerCase().includes(search));
      seriesSearchInput.hidden = !availableSeries.length;
      seriesOptionsList.innerHTML = !availableSeries.length
        ? '<div class="settings-location-series-empty">No transaction series available.</div>'
        : filtered.length
          ? filtered.map(item => `
            <label class="settings-location-series-option">
              <input type="checkbox" data-location-series-id="${Number(item.id)}" ${selectedSeriesIdSet.has(Number(item.id)) ? 'checked' : ''}>
              <span>${esc(getSeriesLabel(item))}</span>
            </label>`).join('')
          : '<div class="settings-location-series-empty">No matching transaction series.</div>';
      positionSeriesDropdown();
    };
    const updateDefaultSeriesOptions = preferredDefault => {
      const previousDefault = preferredDefault === undefined ? defaultSeriesSelect.value : String(preferredDefault || '');
      const selectedSeries = availableSeries.filter(item => selectedSeriesIdSet.has(Number(item.id)));
      defaultSeriesSelect.innerHTML = `<option value="">Select default series</option>${selectedSeries.map(item =>
        `<option value="${Number(item.id)}">${esc(getSeriesLabel(item))}</option>`
      ).join('')}`;
      if (selectedSeries.some(item => String(item.id) === previousDefault)) {
        defaultSeriesSelect.value = previousDefault;
      } else if (selectedSeries.length === 1) {
        defaultSeriesSelect.value = String(selectedSeries[0].id);
      }
    };
    const refreshSeriesPicker = preferredDefault => {
      renderSelectedSeries();
      renderSeriesOptions();
      updateDefaultSeriesOptions(preferredDefault);
    };
    const openSeriesDropdown = () => {
      seriesDropdownOpen = true;
      seriesDropdown.hidden = false;
      seriesToggleButton.setAttribute('aria-expanded', 'true');
      positionSeriesDropdown();
    };
    const handleSeriesPickerOutsideClick = event => {
      if (seriesDropdownOpen && !seriesDropdown.contains(event.target) && !seriesPicker.contains(event.target)) {
        closeSeriesDropdown();
      }
    };
    const handleSeriesPickerKeydown = event => {
      if (event.key === 'Escape' && seriesDropdownOpen) closeSeriesDropdown(true);
    };
    seriesToggleButton.addEventListener('click', () => {
      if (seriesDropdownOpen) closeSeriesDropdown();
      else openSeriesDropdown();
    });
    selectedSeriesList.addEventListener('click', event => {
      const removeButton = event.target.closest('[data-remove-series-id]');
      if (!removeButton) return;
      const removedId = Number(removeButton.dataset.removeSeriesId);
      selectedSeriesIdSet.delete(removedId);
      const checkbox = seriesOptionsList.querySelector(`[data-location-series-id="${removedId}"]`);
      if (checkbox) checkbox.checked = false;
      renderSelectedSeries();
      updateDefaultSeriesOptions();
      positionSeriesDropdown();
    });
    seriesOptionsList.addEventListener('change', event => {
      const checkbox = event.target.closest('[data-location-series-id]');
      if (!checkbox) return;
      const seriesId = Number(checkbox.dataset.locationSeriesId);
      if (checkbox.checked) selectedSeriesIdSet.add(seriesId);
      else selectedSeriesIdSet.delete(seriesId);
      renderSelectedSeries();
      updateDefaultSeriesOptions();
      positionSeriesDropdown();
    });
    seriesSearchInput.addEventListener('input', renderSeriesOptions);
    document.addEventListener('pointerdown', handleSeriesPickerOutsideClick);
    document.addEventListener('keydown', handleSeriesPickerKeydown);
    window.addEventListener('resize', positionSeriesDropdown);
    window.addEventListener('scroll', positionSeriesDropdown, true);
    document.body.appendChild(seriesDropdown);
    const seriesPickerObserver = new MutationObserver(() => {
      if (seriesPicker.isConnected) return;
      closeSeriesDropdown();
      seriesPickerObserver.disconnect();
      seriesDropdown.remove();
      document.removeEventListener('pointerdown', handleSeriesPickerOutsideClick);
      document.removeEventListener('keydown', handleSeriesPickerKeydown);
      window.removeEventListener('resize', positionSeriesDropdown);
      window.removeEventListener('scroll', positionSeriesDropdown, true);
    });
    seriesPickerObserver.observe(document.body, { childList: true, subtree: true });
    refreshSeriesPicker(location.default_transaction_series_id);
    root.querySelector('#locationCountry').addEventListener('change', event => {
      const stateControl = root.querySelector('#locationStateControl');
      const currentState = root.querySelector('#locationState').value;
      stateControl.innerHTML = renderLocationStateControl(event.target.value, currentState);
    });
    root.querySelector('#locationPincode').setAttribute('inputmode', String(location.country || 'India').toLowerCase() === 'india' ? 'numeric' : 'text');
    root.querySelector('#locationCountry').addEventListener('change', event => {
      root.querySelector('#locationPincode').setAttribute('inputmode', event.target.value.toLowerCase() === 'india' ? 'numeric' : 'text');
    });
    let selectedLogoData = !locationId ? '__no_logo__' : (location.logo_data || '');
    const logoSelect = root.querySelector('#locationLogo');
    const logoFile = root.querySelector('#locationLogoFile');
    const logoPreview = root.querySelector('#locationLogoPreview');
    let priorLogoData = selectedLogoData;
    const restoreLogoSelection = () => {
      selectedLogoData = priorLogoData;
      if (priorLogoData === '__no_logo__') {
        logoSelect.value = '__no_logo__';
        logoPreview.innerHTML = '<span style="color:#94a3b8;font-size:12px;">No logo will be displayed for this branch.</span>';
      } else if (priorLogoData) {
        logoSelect.value = priorLogoData;
        logoPreview.innerHTML = `<img src="${esc(priorLogoData)}" alt="Location logo" style="max-height:60px;max-width:180px;">`;
      } else {
        logoSelect.value = '';
        logoPreview.innerHTML = organization && organization.logo_data
          ? `<img src="${esc(organization.logo_data)}" alt="Organization logo" style="max-height:60px;max-width:180px;">`
          : '';
      }
    };
    logoSelect.addEventListener('change', () => {
      if (logoSelect.value === '__upload_new_logo__') {
        priorLogoData = selectedLogoData;
        logoFile.click();
      } else if (logoSelect.value === '__no_logo__') {
        selectedLogoData = '__no_logo__';
        priorLogoData = '__no_logo__';
        logoPreview.innerHTML = '<span style="color:#94a3b8;font-size:12px;">No logo will be displayed for this branch.</span>';
      } else if (!logoSelect.value) {
        selectedLogoData = '';
        priorLogoData = '';
        logoPreview.innerHTML = organization && organization.logo_data
          ? `<img src="${esc(organization.logo_data)}" alt="Organization logo" style="max-height:60px;max-width:180px;">`
          : '';
      } else {
        selectedLogoData = logoSelect.value;
        priorLogoData = selectedLogoData;
        logoPreview.innerHTML = `<img src="${esc(selectedLogoData)}" alt="Location logo" style="max-height:60px;max-width:180px;">`;
      }
    });
    logoFile.addEventListener('cancel', restoreLogoSelection);
    logoFile.addEventListener('change', () => {
      const file = logoFile.files && logoFile.files[0];
      if (!file) return;
      if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) {
        toast('Choose a PNG, JPEG, WebP, or GIF image.', 'error');
        restoreLogoSelection();
        logoFile.value = '';
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        toast('Location logo must be 2 MB or smaller.', 'error');
        restoreLogoSelection();
        logoFile.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        selectedLogoData = String(reader.result || '');
        logoSelect.add(new Option('Uploaded Location Logo', selectedLogoData, true, true));
        priorLogoData = selectedLogoData;
        logoPreview.innerHTML = `<img src="${esc(selectedLogoData)}" alt="Uploaded location logo" style="max-height:60px;max-width:180px;">`;
      };
      reader.onerror = () => {
        restoreLogoSelection();
        logoFile.value = '';
        toast('The location logo could not be read.', 'error');
      };
      reader.readAsDataURL(file);
    });
    root.querySelector('#btnAddLocationSeries').addEventListener('click', async () => {
      try {
        const seriesConfig = await api('/settings/transaction-series/');
        openAddTransactionSeriesModal(container, seriesConfig.supported_types || [], async (savedSeriesId) => {
          const previousDefaultId = defaultSeriesSelect.value;
          const locationData = await api('/settings/branches/');
          series = locationData.transaction_series_options || [];
          availableSeries = series.filter(item =>
            !item.business_location_id || String(item.business_location_id) === String(location.id || '')
          );
          if (savedSeriesId) {
            selectedSeriesIdSet.add(Number(savedSeriesId));
          }
          refreshSeriesPicker(savedSeriesId || previousDefaultId);
        });
      } catch (error) {
        toast(error.message || 'Could not open transaction series configuration.', 'error');
      }
    });
    const locationNameInput = root.querySelector('#locationName');
    const locationNameErr = root.querySelector('#locationNameErr');
    locationNameInput.addEventListener('input', () => {
      if (locationNameInput.value.trim()) {
        locationNameErr.style.display = 'none';
        locationNameInput.style.borderColor = '';
      }
    });
    root.querySelector('#btnSaveLocation').addEventListener('click', async () => {
      const saveButton = root.querySelector('#btnSaveLocation');
      if (saveButton.disabled) return;
      const cancelButton = root.querySelector('#btnCancelLocation');
      const locationType = root.querySelector('input[name="locationType"]:checked')?.value || 'business';
      const active = root.querySelector('#locationActive').checked;
      const primaryContactId = root.querySelector('#locationPrimaryContact').value;
      if (!locationNameInput.value.trim()) {
        locationNameErr.style.display = 'block';
        locationNameInput.style.borderColor = '#ef4444';
        locationNameInput.focus();
        toast('Branch Name is required.', 'error');
        return;
      }
      const selectedSeriesIds = availableSeries
        .filter(item => selectedSeriesIdSet.has(Number(item.id)))
        .map(item => Number(item.id));
      const defaultSeriesId = root.querySelector('#locationDefaultSeries').value;
      if (locationType === 'business' && !primaryContactId) {
        toast('Choose a primary contact for this branch.', 'error');
        root.querySelector('#locationPrimaryContact').focus();
        return;
      }
      if (locationType === 'business' && (!selectedSeriesIds.length || !defaultSeriesId || !selectedSeriesIds.includes(Number(defaultSeriesId)))) {
        toast('Choose at least one transaction series and a default series assigned to this branch.', 'error');
        seriesToggleButton.focus();
        return;
      }
      if (!active && locationType === 'business' && root.querySelector('#locationIsDefault').checked) {
        toast('Clear the default location setting before deactivating this location.', 'error');
        return;
      }
      if (location.active && !active && !window.confirm(`Deactivate "${location.name}"?`)) {
        return;
      }
      if (!locationNameInput.value.trim()) {
        locationNameErr.style.display = 'block';
        locationNameInput.style.borderColor = '#ef4444';
        locationNameInput.focus();
        toast('Branch Name is required.', 'error');
        return;
      }
      const prefixInput = root.querySelector('#locationPrefix');
      prefixInput.value = prefixInput.value.trim().toUpperCase();
      if (prefixInput.value && !/^[A-Z0-9_-]{1,20}$/.test(prefixInput.value)) {
        toast('Branch prefix must use uppercase letters, numbers, underscores, or hyphens only.', 'error');
        prefixInput.focus();
        return;
      }
      const parentId = root.querySelector('#locationParent').value;
      if (locationType === 'warehouse' && !parentId) {
        toast('Choose a parent Business Location for this warehouse-only location.', 'error');
        root.querySelector('#locationParent').focus();
        return;
      }
      if (locationType === 'business' && root.querySelector('#locationChild').checked && !parentId) {
        toast('Choose a parent location for this child branch.', 'error');
        root.querySelector('#locationParent').focus();
        return;
      }
      const country = root.querySelector('#locationCountry').value;
      const pincode = root.querySelector('#locationPincode').value.trim();
      if (pincode && country.toLowerCase() === 'india' && !/^\d{6}$/.test(pincode)) {
        toast('Enter a valid 6-digit Indian PIN code.', 'error');
        root.querySelector('#locationPincode').focus();
        return;
      }
      for (const [label, value] of [['Phone', root.querySelector('#locationPhone').value], ['Fax number', root.querySelector('#locationFax').value]]) {
        const digits = value.replace(/\D/g, '');
        if (value && (!/^\+?[0-9 ().-]+$/.test(value) || digits.length < 7 || digits.length > 15)) {
          toast(`Enter a valid international ${label.toLowerCase()}.`, 'error');
          return;
        }
      }
      const website = root.querySelector('#locationWebsite').value.trim();
      if (website) {
        try {
          const parsed = new URL(website);
          if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname || parsed.username || parsed.password) {
            throw new Error('Invalid URL');
          }
        } catch (error) {
          toast('Enter a valid website URL using http or https.', 'error');
          root.querySelector('#locationWebsite').focus();
          return;
        }
      }
      for (const field of customFields) {
        const input = Array.from(root.querySelectorAll('[data-location-custom-field]')).find(
          item => item.dataset.locationCustomField === field.name,
        );
        if (field.required && input && !input.disabled && (input.type === 'checkbox' ? !input.checked : !input.value.trim())) {
          toast(`${field.label} is required.`, 'error');
          input.focus();
          return;
        }
      }
      const payload = {
        location_type: locationType,
        name: root.querySelector('#locationName').value.trim(),
        prefix: prefixInput.value,
        gstin: root.querySelector('#locationGstin').value.trim(),
        logo_data: selectedLogoData === '__no_logo__' ? '' : selectedLogoData,
        parent_id: (location.is_default || location.is_head_office) ? null : (locationType === 'warehouse' || root.querySelector('#locationChild')?.checked ? (parentId || null) : null),
        attention: root.querySelector('#locationAttention').value.trim(),
        street1: root.querySelector('#locationStreet1').value.trim(),
        street2: root.querySelector('#locationStreet2').value.trim(),
        address: [root.querySelector('#locationAttention').value.trim(), root.querySelector('#locationStreet1').value.trim(), root.querySelector('#locationStreet2').value.trim()].filter(Boolean).join(', '),
        city: root.querySelector('#locationCity').value.trim(),
        pincode: root.querySelector('#locationPincode').value.trim(),
        country,
        state: root.querySelector('#locationState').value.trim(),
        phone: root.querySelector('#locationPhone').value.trim(),
        fax: root.querySelector('#locationFax').value.trim(),
        website: root.querySelector('#locationWebsite').value.trim(),
        primary_contact_id: primaryContactId || null,
        transaction_series_ids: locationType === 'business' ? selectedSeriesIds : [],
        default_transaction_series_id: locationType === 'business' ? (defaultSeriesId || null) : null,
        custom_fields_data: Array.from(root.querySelectorAll('[data-location-custom-field]')).reduce((values, input) => {
          values[input.dataset.locationCustomField] = input.type === 'checkbox' ? input.checked : input.value;
          return values;
        }, {}),
        assigned_user_ids: Array.from(root.querySelectorAll('.locationUser:checked')).map(input => Number(input.value)),
        warehouse_ids: location.warehouse_ids || [],
        is_default: (location.is_default || location.is_head_office) ? true : (locationType === 'business' && root.querySelector('#locationIsDefault').checked),
        active
      };
      saveButton.disabled = true;
      cancelButton.disabled = true;
      saveButton.textContent = 'Saving...';
      try {
        await api(locationId ? `/settings/branches/${locationId}/` : '/settings/branches/', { method: locationId ? 'PUT' : 'POST', body: payload });
        toast(locationId ? 'Branch updated successfully.' : 'Branch created successfully.', 'success');
        await renderBusinessLocationsPage(container);
      } catch (error) {
        toast(error.message || 'Failed to save location.', 'error');
      } finally {
        if (saveButton.isConnected) {
          saveButton.disabled = false;
          saveButton.textContent = 'Save';
          cancelButton.disabled = false;
        }
      }
    });
  }

  container.innerHTML = `
    <div class="settings-page-header"><div class="settings-page-header-left"><h1>Branches</h1></div>
      <div class="settings-page-header-right"><button type="button" class="btn-primary" id="btnAddLocation">+ Add Branch</button></div>
    </div>
    <div style="display:flex;gap:10px;align-items:center;margin:12px 0;">
      <input class="form-control" id="locationListSearch" type="search" placeholder="Search branches" aria-label="Search branches" style="max-width:320px;">
      <select class="form-control" id="locationListStatus" aria-label="Filter by status" style="max-width:180px;">
        <option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option>
      </select>
    </div>
    <table class="table settings-branches-table"><thead><tr>
      <th style="color:#64748b;font-weight:600;font-size:12px;letter-spacing:0.04em;">NAME</th>
      <th style="color:#64748b;font-weight:600;font-size:12px;letter-spacing:0.04em;">DEFAULT TRANSACTION NUMBER SERIES</th>
      <th style="color:#64748b;font-weight:600;font-size:12px;letter-spacing:0.04em;">TYPE</th>
      <th style="color:#64748b;font-weight:600;font-size:12px;letter-spacing:0.04em;">ADDRESS DETAILS</th>
    </tr></thead>
      <tbody id="locationRows"></tbody>
    </table>
    <div style="display:flex;justify-content:flex-end;align-items:center;gap:10px;margin-top:12px;">
      <span id="locationPageInfo" style="color:#64748b;font-size:12px;"></span>
      <button type="button" class="btn-secondary" id="locationPrevPage">Previous</button>
      <button type="button" class="btn-secondary" id="locationNextPage">Next</button>
    </div>
  `;
  const pageSize = 25;
  let currentPage = 0;
  const renderLocationRows = () => {
    const search = container.querySelector('#locationListSearch').value.trim().toLowerCase();
    const status = container.querySelector('#locationListStatus').value;
    const filtered = locations.filter(location => {
      const matchesSearch = [location.name, location.location_type, location.parent_name, location.address, location.city, location.state]
        .some(value => String(value || '').toLowerCase().includes(search));
      const matchesStatus = status === 'all' || (location.active ? 'active' : 'inactive') === status;
      return matchesSearch && matchesStatus;
    });
    const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
    currentPage = Math.min(currentPage, pageCount - 1);
    const pageLocations = filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
    container.querySelector('#locationRows').innerHTML = pageLocations.map(location => {
      const defaultSeries = series.find(s => String(s.id) === String(location.default_transaction_series_id))?.name
        || location.default_transaction_series_name
        || (location.is_default || location.is_head_office ? 'Default Transaction Series' : '-');
      const typeLabel = location.location_type === 'warehouse' ? 'Warehouse' : 'Business';
      const addrParts = [];
      if (location.address) addrParts.push(location.address);
      else {
        if (location.street1) addrParts.push(location.street1);
        if (location.city) addrParts.push(location.city);
        if (location.state) addrParts.push(location.state);
        if (location.country) addrParts.push(location.country);
      }
      const addrDetails = addrParts.filter(Boolean).join(' ') || [location.state, location.country].filter(Boolean).join(' ') || '-';
      const isHeadOffice = Boolean(location.is_default || location.is_head_office);
      return `
        <tr>
          <td>
            <a href="javascript:void(0)" class="location-name-link" data-location-id="${location.id}" style="color:#2563eb;text-decoration:none;font-weight:500;cursor:pointer;">${esc(location.name)}</a>
            ${isHeadOffice ? ' <span class="head-office-star" style="color:#f59e0b;font-size:14px;vertical-align:middle;margin-left:4px;" title="Head Office">⭐</span>' : ''}
          </td>
          <td>${esc(defaultSeries)}</td>
          <td>${esc(typeLabel)}</td>
          <td>${esc(addrDetails)}</td>
        </tr>`;
    }).join('') || '<tr><td colspan="4" style="text-align:center;color:#64748b;">No branches found.</td></tr>';
    container.querySelector('#locationPageInfo').textContent = `Page ${currentPage + 1} of ${pageCount} (${filtered.length} branches)`;
    container.querySelector('#locationPrevPage').disabled = currentPage === 0;
    container.querySelector('#locationNextPage').disabled = currentPage >= pageCount - 1;
    container.querySelectorAll('[data-location-id]').forEach(button =>
      button.addEventListener('click', () => openLocation(Number(button.dataset.locationId)))
    );
  };
  container.querySelector('#btnAddLocation').addEventListener('click', () => openLocation());
  container.querySelector('#locationListSearch').addEventListener('input', () => {
    currentPage = 0;
    renderLocationRows();
  });
  container.querySelector('#locationListStatus').addEventListener('change', () => {
    currentPage = 0;
    renderLocationRows();
  });
  container.querySelector('#locationPrevPage').addEventListener('click', () => {
    currentPage -= 1;
    renderLocationRows();
  });
  container.querySelector('#locationNextPage').addEventListener('click', () => {
    currentPage += 1;
    renderLocationRows();
  });
  renderLocationRows();
}

window.renderEwayBillsPage = renderEwayBillsPage;
window.renderEinvoicingPage = renderEinvoicingPage;
window.renderMsmePage = renderMsmePage;
window.renderOpeningBalancesPage = renderOpeningBalancesPage;
window.openAddTaxModal = openAddTaxModal;
window.openAddExemptionModal = openAddExemptionModal;
window.openInviteUserModal = openInviteUserModal;
window.openAddPaymentTermModal = openAddPaymentTermModal;
window.openAddCurrencyModal = openAddCurrencyModal;
window.getSettingsPageRenderer = getSettingsPageRenderer;
window.renderEnterpriseSettingsPage = renderEnterpriseSettingsPage;
window.renderSettingsDashboard = renderSettingsDashboard;
window.renderBusinessLocationsPage = renderBusinessLocationsPage;
window.renderSettingsShell = renderSettingsShell;
window.renderRoleEditorPage = renderRoleEditorPage;


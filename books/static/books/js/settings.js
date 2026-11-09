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
          { key: 'pdf-templates', label: 'PDF Templates', hash: '#/settings/pdf-templates' },
          { key: 'email-notifications', label: 'Email Notifications', hash: '#/settings/email-notifications' },
          { key: 'sms-notifications', label: 'SMS Notifications', hash: '#/settings/sms-notifications' },
          { key: 'digital-signature', label: 'Digital Signature', hash: '#/settings/digital-signature' },
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
// 1. SETTINGS DASHBOARD (Card-based view matching Screenshot 2026-11-06 165029)
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
          <div class="settings-panel-header">
            <h2>Organization Settings</h2>
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
                  <li><a href="#/settings/pdf-templates" class="settings-link"><span class="link-label">PDF Templates</span></a></li>
                  <li><a href="#/settings/email-notifications" class="settings-link"><span class="link-label">Email Notifications</span></a></li>
                  <li><a href="#/settings/sms-notifications" class="settings-link"><span class="link-label">SMS Notifications</span></a></li>
                  <li><a href="#/settings/digital-signature" class="settings-link"><span class="link-label">Digital Signature</span></a></li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Search filtering logic
  const searchInput = $('#settingsSearchInput');
  if (searchInput) {
    searchInput.focus();
    searchInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      $$('.settings-link').forEach(link => {
        const text = link.textContent.toLowerCase();
        const li = link.closest('li');
        if (!q || text.includes(q)) {
          li.style.display = '';
        } else {
          li.style.display = 'none';
        }
      });
      $$('.settings-cat-card').forEach(card => {
        const visibleLi = card.querySelectorAll('li:not([style*="display: none"])');
        card.closest('.settings-cat-col').style.display = (visibleLi.length === 0 && q) ? 'none' : '';
      });
    });
  }
}

function closeSettingsDashboard() {
  const target = (window._lastAppHash && !window._lastAppHash.includes('settings')) ? window._lastAppHash : '#/home/dashboard';
  location.hash = target;
}

// =========================================================================
// 2. SETTINGS SHELL WRAPPER (2-column layout matching Screenshots 2026-11-06 165108 & 165126)
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
          <input type="text" placeholder="Search settings (/)" onclick="location.hash='#/settings/dashboard'">
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
    if (activeSubKey === 'taxes' || activeSubKey === 'direct-taxes') {
      pane.style.padding = '0';
    } else {
      pane.style.padding = '28px 36px 60px';
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
    'mod-prefs': typeof renderGeneralSettingsPage === 'function' ? renderGeneralSettingsPage : null,
    'sales-invoices': typeof renderNumberSeriesPage === 'function' ? renderNumberSeriesPage : null,
    'sales-quotes': typeof renderNumberSeriesPage === 'function' ? renderNumberSeriesPage : null,
  };
  return map[key] || null;
}

function toggleSettingsNavGroup(btn) {
  const grp = btn.closest('.settings-nav-group');
  if (grp) grp.classList.toggle('open');
}

// =========================================================================
// 3. USERS MANAGEMENT PAGE (Screenshot 2026-11-06 165108)
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

  modal.querySelector('#btnSubmitInvite').addEventListener('click', async () => {
    const name = modal.querySelector('#inviteUserName').value.trim();
    const email = modal.querySelector('#inviteUserEmail').value.trim();
    const roleId = isAccountant ? null : (modal.querySelector('#inviteUserRole') ? modal.querySelector('#inviteUserRole').value : null);

    if (!email) {
      toast('Please provide a valid email address.', 'error');
      return;
    }

    try {
      await api('/settings/users/invite/', {
        method: 'POST',
        body: JSON.stringify({ name, email, role_id: roleId, is_accountant: isAccountant })
      });
      toast(`Invitation sent successfully to ${email}.`, 'success');
      modal.remove();
      renderSettingsUsersPage($('#settingsMainPane'));
    } catch (err) {
      toast(err.message || 'Failed to send invitation.', 'error');
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
// 4. ROLES MANAGEMENT PAGE (Screenshot 2026-11-06 165126)
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
// (Screenshots 2026-11-06 165203 through 165531)
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
          <input type="text" placeholder="Search settings (/)" onclick="location.hash='#/settings/dashboard'">
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

async function renderNumberSeriesPage(container) {
  const data = await api('/settings/number-series/');
  const series = data.series || [];

  container.innerHTML = `
    <div class="settings-page-header">
      <div class="settings-page-header-left">
        <h1>Transaction Number Series</h1>
      </div>
    </div>

    <div class="settings-table-card">
      <table class="settings-data-table">
        <thead>
          <tr>
            <th>MODULE</th>
            <th>PREFIX</th>
            <th>NEXT SEQUENCE</th>
            <th>FINANCIAL YEAR</th>
            <th>SAMPLE PREVIEW</th>
            <th style="text-align:right;">ACTION</th>
          </tr>
        </thead>
        <tbody>
          ${series.map(s => `
            <tr>
              <td><b>${esc(s.label)}</b></td>
              <td><code>${esc(s.prefix)}</code></td>
              <td>${s.next_sequence}</td>
              <td>${esc(s.financial_year || 'N/A')}</td>
              <td><span class="pastel-chip chip-sky"><b>${esc(s.formatted)}</b></span></td>
              <td style="text-align:right;">
                <button type="button" class="btn-table-action" onclick="openEditNumberSeriesModal('${s.module}', '${esc(s.label)}', '${esc(s.prefix)}', ${s.next_sequence})">
                  Configure
                </button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function openEditNumberSeriesModal(moduleKey, moduleLabel, currentPrefix, currentSeq) {
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.innerHTML = `
    <div class="modal-box" style="max-width:440px;">
      <div class="modal-header">
        <h3>Configure Numbering: ${esc(moduleLabel)}</h3>
        <button type="button" class="modal-close-btn" onclick="this.closest('.modal-backdrop').remove()">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>Prefix*</label>
          <input type="text" id="seriesPrefixInput" value="${esc(currentPrefix)}" class="form-control" style="text-transform:uppercase;">
        </div>
        <div class="form-group" style="margin-top:12px;">
          <label>Next Sequence Number*</label>
          <input type="number" id="seriesNextSeqInput" value="${currentSeq}" class="form-control" min="1">
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn-secondary" onclick="this.closest('.modal-backdrop').remove()">Cancel</button>
        <button type="button" class="btn-primary" id="btnSaveSeriesConfig">Save</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.querySelector('#btnSaveSeriesConfig').addEventListener('click', async () => {
    const prefix = modal.querySelector('#seriesPrefixInput').value.trim().toUpperCase();
    const next_sequence = parseInt(modal.querySelector('#seriesNextSeqInput').value, 10);

    try {
      await api('/settings/number-series/', {
        method: 'POST',
        body: JSON.stringify({ module: moduleKey, prefix, next_sequence })
      });
      toast(`Number series for ${moduleLabel} updated.`, 'success');
      modal.remove();
      renderNumberSeriesPage($('#settingsMainPane'));
    } catch (err) {
      toast(err.message || 'Failed to update numbering series.', 'error');
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

// Global window registration
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


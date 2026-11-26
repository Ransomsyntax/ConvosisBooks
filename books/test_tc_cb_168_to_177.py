import os
import re
from django.test import TestCase, override_settings
from django.core import mail
from books.otp_service import send_brevo_email, create_and_send_otp, OTPServiceError
from django.contrib.auth.models import User
from books.models import Organization


class TestTcCb168To177(TestCase):
    """
    Automated verification suite for defects TC_CB_168 to TC_CB_177.
    """

    def setUp(self):
        self.base_dir = os.path.dirname(os.path.abspath(__file__))
        self.forms_js_path = os.path.join(self.base_dir, 'static', 'books', 'js', 'forms.js')
        self.settings_js_path = os.path.join(self.base_dir, 'static', 'books', 'js', 'settings.js')
        self.app_js_path = os.path.join(self.base_dir, 'static', 'books', 'js', 'app.js')
        self.pages_js_path = os.path.join(self.base_dir, 'static', 'books', 'js', 'pages.js')
        self.app_css_path = os.path.join(self.base_dir, 'static', 'books', 'css', 'app.css')
        self.glass_css_path = os.path.join(self.base_dir, 'static', 'books', 'css', 'glass.css')

    def test_tc_cb_168_quotes_add_items_in_bulk(self):
        """TC_CB_168: Sales -> Quotes -> Add Items in Bulk modal, select all/deselect all, and quoteForm wiring."""
        with open(self.forms_js_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # 1. bulkItemPickerModal exists and is aliased to openBulkItemModal
        self.assertIn('function bulkItemPickerModal(items, onSelect)', content)
        self.assertIn('window.openBulkItemModal = bulkItemPickerModal', content)

        # 2. Contains Select All and Deselect All controls
        self.assertIn('id="btn-bulk-select-all"', content)
        self.assertIn('id="btn-bulk-deselect-all"', content)
        self.assertIn('id="bulk-item-select-all"', content)

        # 3. QuoteForm listener opens bulk modal and populates items with stockTracker & calcQuote
        self.assertIn("$('#btn-quote-bulk-items', form)?.addEventListener('click'", content)
        self.assertIn("modalFn(items, selectedItems =>", content)
        self.assertIn("stockTracker.updateRow(tbody.lastElementChild, false)", content)

    def test_tc_cb_169_and_170_branch_series_dropdown_and_modal(self):
        """TC_CB_169 & TC_CB_170: Series dropdown dimensions & Add Transaction Series modal z-index + auto-select."""
        with open(self.settings_js_path, 'r', encoding='utf-8') as f:
            settings_js = f.read()
        with open(self.app_css_path, 'r', encoding='utf-8') as f:
            app_css = f.read()

        # TC_CB_169: Dropdown width min 320px, height comfortable, search visible when availableSeries > 0
        self.assertIn("minWidth = '320px'", settings_js)
        self.assertIn("seriesSearchInput.hidden = !availableSeries.length", settings_js)
        self.assertIn(".settings-location-series-option", app_css)
        self.assertIn("word-break: break-word;", app_css)

        # TC_CB_170: z-index of footer is 10, modal is 100050, and newly saved series is added to selectedSeriesIdSet
        self.assertIn(".transaction-series-modal {\n  z-index: 100050 !important;", app_css)
        self.assertIn("z-index: 10;", app_css)  # footer lowered from 100001
        self.assertIn("selectedSeriesIdSet.add(Number(savedSeriesId));", settings_js)
        self.assertIn("refreshSeriesPicker(savedSeriesId || previousDefaultId);", settings_js)

    def test_tc_cb_171_and_172_custom_domain_and_networking_navigation(self):
        """TC_CB_171 & TC_CB_172: Custom Domain & Networking navigate to dedicated views, not #/settings/profile."""
        with open(self.settings_js_path, 'r', encoding='utf-8') as f:
            settings_js = f.read()
        with open(self.app_js_path, 'r', encoding='utf-8') as f:
            app_js = f.read()

        # Check menu hashes in settings.js
        self.assertIn("{ key: 'custom-domain', label: 'Custom Domain', hash: '#/settings/custom-domain' }", settings_js)
        self.assertIn("{ key: 'networking', label: 'Networking', hash: '#/settings/networking' }", settings_js)

        # Check functions exist and are exported
        self.assertIn("function renderCustomDomainPage(container)", settings_js)
        self.assertIn("window.renderCustomDomainPage = renderCustomDomainPage", settings_js)
        self.assertIn("function renderNetworkingPage(container)", settings_js)
        self.assertIn("window.renderNetworkingPage = renderNetworkingPage", settings_js)

        # Check routes in app.js
        self.assertIn("'settings/custom-domain':", app_js)
        self.assertIn("renderCustomDomainPage", app_js)
        self.assertIn("'settings/networking':", app_js)
        self.assertIn("renderNetworkingPage", app_js)

    def test_tc_cb_173_org_profile_form_field_spacing(self):
        """TC_CB_173: Organization Profile form fields vertical rhythm and grid spacing."""
        with open(self.app_css_path, 'r', encoding='utf-8') as f:
            app_css = f.read()

        self.assertIn(".settings-form-card .form-grid-2", app_css)
        self.assertIn(".settings-form-card .form-grid-3", app_css)
        self.assertIn("grid-template-columns: repeat(2, minmax(0, 1fr));", app_css)
        self.assertIn("gap: 18px 24px;", app_css)
        self.assertIn(".settings-form-card .form-group", app_css)
        self.assertIn("gap: 7px;", app_css)

    def test_tc_cb_174_quote_row_action_dropdown_positioning(self):
        """TC_CB_174: Row action dropdown fixed viewport positioning & boundary check."""
        with open(self.pages_js_path, 'r', encoding='utf-8') as f:
            pages_js = f.read()

        self.assertIn("pop.style.position = 'fixed';", pages_js)
        self.assertIn("pop.style.zIndex = '99999';", pages_js)
        self.assertIn("moreBtn.getBoundingClientRect()", pages_js)
        self.assertIn("rect.top - popHeight", pages_js)  # flips upward when near bottom

    @override_settings(
        EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
        BREVO_API_KEY='',
        EMAIL_HOST='',
        EMAIL_HOST_USER='',
        EMAIL_HOST_PASSWORD=''
    )
    def test_tc_cb_175_signup_email_locmem_fallback_and_diagnostics(self):
        """TC_CB_175: Verification email handles test/dev backend cleanly and reports missing vars."""
        # Under locmem backend (standard test environment), delivery succeeds without live SMTP
        sent = send_brevo_email(
            to_email='testuser@example.com',
            subject='Your Verification Code',
            html_content='<p>Your code is 123456</p>',
            text_content='Your code is 123456'
        )
        self.assertTrue(sent)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('Your code is 123456', mail.outbox[0].body)

        # When backend is SMTP and credentials are empty, error clearly lists missing variables
        with override_settings(EMAIL_BACKEND='django.core.mail.backends.smtp.EmailBackend'):
            with self.assertRaises(RuntimeError) as ctx:
                send_brevo_email(
                    to_email='testuser@example.com',
                    subject='Your Verification Code',
                    html_content='<p>Your code is 123456</p>',
                    text_content='Your code is 123456'
                )
            self.assertIn('BREVO_API_KEY', str(ctx.exception))
            self.assertIn('EMAIL_HOST', str(ctx.exception))

    def test_tc_cb_176_manual_journals_routing_and_navigation(self):
        """TC_CB_176: Accountant -> Manual Journals route renders list page before form and NAV_NEW_ACTIONS preserves route."""
        with open(self.app_js_path, 'r', encoding='utf-8') as f:
            app_js = f.read()

        # Route accountant/manual-journals/new renders listPage first
        new_route_match = re.search(r"'accountant/manual-journals/new':\s*r\s*=>\s*\{([\s\S]*?)\n\s*\},", app_js)
        self.assertIsNotNone(new_route_match)
        self.assertIn("listPage(r, LISTS['manual-journals'])", new_route_match.group(1))
        self.assertIn("journalForm()", new_route_match.group(1))

        # NAV_NEW_ACTIONS['accountant/manual-journals'] checks hash
        nav_match = re.search(r"'accountant/manual-journals':\s*\(\)\s*=>\s*\{([\s\S]*?)\n\s*\},", app_js)
        self.assertIsNotNone(nav_match)
        self.assertIn("location.hash = '#/accountant/manual-journals'", nav_match.group(1))
        self.assertIn("journalForm()", nav_match.group(1))

    def test_tc_cb_177_accountant_sidebar_submenu_vertical_spacing(self):
        """TC_CB_177: Accountant sidebar submenu items vertical padding and min-height."""
        with open(self.glass_css_path, 'r', encoding='utf-8') as f:
            glass_css = f.read()

        self.assertIn(".ch a, .nav-sub-item", glass_css)
        self.assertIn("min-height: 32px;", glass_css)
        self.assertIn("padding: 7px 10px;", glass_css)
        self.assertIn(".ni[data-g=\"accountant\"] .ch", glass_css)
        self.assertIn(".ni[data-g=\"accountant\"] .ch a", glass_css)

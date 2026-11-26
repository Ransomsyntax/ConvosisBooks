import os
from django.test import SimpleTestCase

class DuplicateCustomerFormsTestCase(SimpleTestCase):
    def setUp(self):
        self.base_dir = os.path.dirname(os.path.abspath(__file__))
        self.static_forms_js = os.path.join(self.base_dir, 'static', 'books', 'js', 'forms.js')
        self.static_pages_js = os.path.join(self.base_dir, 'static', 'books', 'js', 'pages.js')
        self.static_core_js = os.path.join(self.base_dir, 'static', 'books', 'js', 'core.js')
        self.static_app_js = os.path.join(self.base_dir, 'static', 'books', 'js', 'app.js')
        self.template_index = os.path.join(self.base_dir, 'templates', 'index.html')
        self.frontend_forms_js = os.path.normpath(os.path.join(self.base_dir, '..', 'frontend', 'js', 'forms.js'))
        self.frontend_pages_js = os.path.normpath(os.path.join(self.base_dir, '..', 'frontend', 'js', 'pages.js'))
        self.frontend_core_js = os.path.normpath(os.path.join(self.base_dir, '..', 'frontend', 'js', 'core.js'))
        self.frontend_app_js = os.path.normpath(os.path.join(self.base_dir, '..', 'frontend', 'js', 'app.js'))
        self.frontend_index = os.path.normpath(os.path.join(self.base_dir, '..', 'frontend', 'index.html'))

    def test_party_form_dialog_single_form_only(self):
        """partyForm and itemForm must use dialog: Boolean(onDone) to ensure ONLY sticky form renders when not in popup context."""
        with open(self.static_forms_js, 'r', encoding='utf-8') as f:
            content = f.read()

        # Modal.count() > 0 must not be used to switch standalone forms to dialog popups
        self.assertNotIn("dialog: Boolean(onDone || Modal.count() > 0)", content)
        self.assertIn("dialog: Boolean(onDone)", content)

    def test_party_form_deduping_guard(self):
        """partyForm must have concurrency guard and prevent duplicate on-screen forms."""
        with open(self.static_forms_js, 'r', encoding='utf-8') as f:
            content = f.read()

        self.assertIn("if (partyForm._opening) return;", content)
        self.assertIn("const existing = document.querySelector('.on-screen-form-view');", content)
        self.assertIn("partyForm._opening = true;", content)
        self.assertIn("partyForm._opening = false;", content)

    def test_item_form_deduping_guard(self):
        """itemForm must have concurrency guard and prevent duplicate on-screen forms."""
        with open(self.static_forms_js, 'r', encoding='utf-8') as f:
            content = f.read()

        self.assertIn("if (itemForm._opening) return;", content)
        self.assertIn("itemForm._opening = true;", content)
        self.assertIn("itemForm._opening = false;", content)

    def test_modal_open_duplicate_suppression(self):
        """Modal.open must clean up existing on-screen form views and suppress duplicate modal popups."""
        with open(self.static_forms_js, 'r', encoding='utf-8') as f:
            content = f.read()

        self.assertIn("const existing = pg.querySelector('.on-screen-form-view');", content)
        self.assertIn("if (!renderOnScreen && pg && pg.querySelector('.on-screen-form-view') && !dialog)", content)

    def test_debounce_add_new_actions(self):
        """Double clicking Add New Customer/Vendor/Item buttons must be debounced."""
        with open(self.static_pages_js, 'r', encoding='utf-8') as f:
            pages_content = f.read()
        self.assertIn("if (x._busy) return;", pages_content)
        self.assertIn("x._busy = true;", pages_content)

        with open(self.static_app_js, 'r', encoding='utf-8') as f:
            app_content = f.read()
        self.assertIn("if (q._busy) return;", app_content)
        self.assertIn("if (navAdd._busy) return;", app_content)

    def test_party_form_global_resilience(self):
        """partyForm and partyDetail must resolve safely in core.js, forms.js, pages.js, and app.js."""
        with open(self.static_core_js, 'r', encoding='utf-8') as f:
            core_content = f.read()
        self.assertIn("window.partyForm = partyForm;", core_content)
        self.assertIn("window.partyDetail = partyDetail;", core_content)

        with open(self.static_forms_js, 'r', encoding='utf-8') as f:
            forms_content = f.read()
        self.assertIn("window._partyFormImpl = partyForm;", forms_content)
        self.assertIn("window.partyForm = partyForm;", forms_content)

        with open(self.static_pages_js, 'r', encoding='utf-8') as f:
            pages_content = f.read()
        self.assertIn("function partyForm(kind, id, onDone, onCancel)", pages_content)

        with open(self.static_app_js, 'r', encoding='utf-8') as f:
            app_content = f.read()
        self.assertIn("function partyForm(kind, id, onDone, onCancel)", app_content)

    def test_cache_busting_versions(self):
        """Template index.html and frontend index.html must have bumped versions."""
        with open(self.template_index, 'r', encoding='utf-8') as f:
            t_content = f.read()
        self.assertIn("core.js' %}?v=2.2.8", t_content)
        self.assertIn("forms.js' %}?v=2.3.17", t_content)
        self.assertIn("pages.js' %}?v=2.4.5", t_content)
        self.assertIn("app.js' %}?v=2.3.6", t_content)

        with open(self.frontend_index, 'r', encoding='utf-8') as f:
            fe_content = f.read()
        self.assertIn("core.js?v=2.2.8", fe_content)
        self.assertIn("forms.js?v=2.3.17", fe_content)
        self.assertIn("pages.js?v=2.4.5", fe_content)
        self.assertIn("app.js?v=2.3.6", fe_content)

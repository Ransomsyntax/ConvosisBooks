import json
import os
import re
from django.test import TestCase, Client
from django.contrib.auth import get_user_model
from django.conf import settings
from books.models import Organization, UserProfile

User = get_user_model()


class ConvobotVisibilityAndIntegrationTests(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(name='Convosis Test Org', base_currency='INR')
        self.user = User.objects.create_user(username='testconvouser', password='password123')
        self.profile = UserProfile.objects.create(user=self.user, organization=self.org, role='admin')
        self.client = Client()
        self.client.login(username='testconvouser', password='password123')

    def test_convobot_script_included_in_templates(self):
        """Ensure chatbot.js is properly included in both main index templates."""
        backend_index_path = os.path.join(settings.BASE_DIR, 'books', 'templates', 'index.html')
        with open(backend_index_path, 'r', encoding='utf-8') as f:
            backend_html = f.read()
        self.assertIn("books/js/chatbot.js", backend_html)

        frontend_index_path = os.path.join(settings.BASE_DIR, 'frontend', 'index.html')
        with open(frontend_index_path, 'r', encoding='utf-8') as f:
            frontend_html = f.read()
        self.assertIn("chatbot.js", frontend_html)

    def test_chatbot_js_contains_all_required_components(self):
        """Ensure chatbot.js has complete draggable and UI logic with no syntax corruption."""
        paths = [
            os.path.join(settings.BASE_DIR, 'books', 'static', 'books', 'js', 'chatbot.js'),
            os.path.join(settings.BASE_DIR, 'frontend', 'js', 'chatbot.js'),
            os.path.join(settings.BASE_DIR, 'staticfiles', 'books', 'js', 'chatbot.js'),
        ]

        for p in paths:
            self.assertTrue(os.path.exists(p), f"Missing file: {p}")
            with open(p, 'r', encoding='utf-8') as f:
                code = f.read()

            # Ensure launcher and widget DOM elements are created
            self.assertIn("id = 'convobot-launcher'", code)
            self.assertIn("id = 'convobot-widget'", code)

            # Ensure draggable components exist
            self.assertIn("function initDraggableConvobot", code)
            self.assertIn("function clampPosition", code)
            self.assertIn("function applySavedPosition", code)
            self.assertIn("function resetConvobotPosition", code)
            self.assertIn("convobot_position_v2", code)

            # Ensure no stray duplicated blocks in toggleMaximize
            self.assertEqual(code.count("function toggleMaximize()"), 1)
            # Ensure no orphan "} else {" after toggleMaximize
            self.assertNotIn("updateWidgetPosition();\n    }\n  }\n      widget.classList.add('maximized');", code)

            # Ensure launcher styling has high z-index and fixed bottom-right default
            self.assertIn("z-index: 99999", code)
            self.assertIn("bottom: 24px", code)
            self.assertIn("right: 24px", code)

            # Ensure touch and mouse drag handling
            self.assertIn("mousedown", code)
            self.assertIn("touchstart", code)
            self.assertIn("mousemove", code)
            self.assertIn("touchmove", code)
            self.assertIn("mouseup", code)
            self.assertIn("touchend", code)

            # Ensure preventClick flag prevents dragging from accidentally opening the chatbot
            self.assertIn("preventClick", code)
            self.assertIn("dragMoved", code)

    def test_convobot_backend_doubt_clearance_api(self):
        """Test the backend doubt clearance API endpoint used by Convobot."""
        payload = {
            'query': 'Explain Debit vs Credit in double-entry bookkeeping',
            'category': 'accounting',
            'history': []
        }
        res = self.client.post(
            '/api/convobot/doubt-clearance/',
            data=json.dumps(payload),
            content_type='application/json'
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue('answer' in data or 'summary' in data)
        text = data.get('answer') or data.get('summary')
        self.assertTrue(len(text) > 0)
        self.assertIn('Debit', text)

    def test_convobot_backend_live_data_query(self):
        """Test live business data reasoning in Convobot."""
        payload = {
            'query': 'What is our current month revenue & net margin?',
            'category': 'live',
            'history': []
        }
        res = self.client.post(
            '/api/convobot/doubt-clearance/',
            data=json.dumps(payload),
            content_type='application/json'
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue('answer' in data or 'summary' in data)


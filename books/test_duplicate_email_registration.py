import threading
from django.test import TransactionTestCase, Client
from django.contrib.auth import get_user_model
from django.contrib.auth.forms import PasswordResetForm
from django.db import connection
from books.models import Organization, UserProfile

User = get_user_model()

class DuplicateEmailRegistrationTestCase(TransactionTestCase):
    def setUp(self):
        self.client = Client()

    def tearDown(self):
        connection.close()

    def test_01_register_new_email_success(self):
        """Registering with a new valid email succeeds and creates a user and organization."""
        resp = self.client.post('/accounts/signup/', {
            'action': 'signup',
            'signup_username': 'john_doe_unique',
            'signup_name': 'John Doe',
            'signup_email': 'john.doe@company.com',
            'signup_org': 'John Doe Corp',
            'signup_password': 'SecurePassword123!',
            'signup_confirm_password': 'SecurePassword123!',
        })
        self.assertEqual(resp.status_code, 302)
        user = User.objects.filter(username='john_doe_unique').first()
        self.assertIsNotNone(user)
        self.assertEqual(user.email, 'john.doe@company.com')
        self.assertTrue(UserProfile.objects.filter(user=user, normalized_email='john.doe@company.com').exists())
        self.assertTrue(Organization.objects.filter(owner=user, name='John Doe Corp').exists())

    def test_02_register_same_email_blocked(self):
        """Registering again with the exact same email is blocked with HTTP 400 and required message."""
        # First registration
        self.client.post('/accounts/signup/', {
            'action': 'signup',
            'signup_username': 'alice_first',
            'signup_name': 'Alice First',
            'signup_email': 'alice@domain.com',
            'signup_org': 'Alice Corp',
            'signup_password': 'Password123!',
            'signup_confirm_password': 'Password123!',
        })
        self.client.logout()

        # Second registration with same email
        resp = self.client.post('/accounts/signup/', {
            'action': 'signup',
            'signup_username': 'alice_second',
            'signup_name': 'Alice Second',
            'signup_email': 'alice@domain.com',
            'signup_org': 'Alice Second Corp',
            'signup_password': 'Password123!',
            'signup_confirm_password': 'Password123!',
        })
        self.assertEqual(resp.status_code, 400)
        self.assertContains(resp, "An account with this email address already exists. Please log in instead.", status_code=400)
        # Ensure second user was NOT created
        self.assertFalse(User.objects.filter(username='alice_second').exists())
        self.assertFalse(Organization.objects.filter(name='Alice Second Corp').exists())

    def test_03_register_case_variation_blocked(self):
        """Registering with uppercase/lowercase variations is treated as identical and blocked."""
        # First registration with lowercase
        self.client.post('/accounts/signup/', {
            'action': 'signup',
            'signup_username': 'case_user_1',
            'signup_name': 'Case User',
            'signup_email': 'case.test@example.com',
            'signup_org': 'Case Org 1',
            'signup_password': 'Password123!',
            'signup_confirm_password': 'Password123!',
        })
        self.client.logout()

        # Attempt registration with mixed-case email
        resp = self.client.post('/accounts/signup/', {
            'action': 'signup',
            'signup_username': 'case_user_2',
            'signup_name': 'Case User 2',
            'signup_email': 'CASE.TEST@EXAMPLE.COM',
            'signup_org': 'Case Org 2',
            'signup_password': 'Password123!',
            'signup_confirm_password': 'Password123!',
        })
        self.assertEqual(resp.status_code, 400)
        self.assertContains(resp, "An account with this email address already exists. Please log in instead.", status_code=400)
        self.assertFalse(User.objects.filter(username='case_user_2').exists())

        # Attempt registration with another variation: Case.Test@Example.Com
        resp3 = self.client.post('/signup/', {
            'action': 'signup',
            'signup_username': 'case_user_3',
            'signup_name': 'Case User 3',
            'signup_email': 'Case.Test@Example.Com',
            'signup_org': 'Case Org 3',
            'signup_password': 'Password123!',
            'signup_confirm_password': 'Password123!',
        })
        self.assertEqual(resp3.status_code, 400)
        self.assertContains(resp3, "An account with this email address already exists. Please log in instead.", status_code=400)
        self.assertFalse(User.objects.filter(username='case_user_3').exists())

    def test_04_register_through_api_endpoints_blocked(self):
        """Alternative API signup endpoints (/api/register/, /api/auth/register/) block duplicate emails with 400."""
        # Initial creation
        User.objects.create_user(username='existing_api_user', email='apiuser@corp.com', password='Password123!')

        for endpoint in ['/api/register/', '/api/auth/register/', '/api/signup/']:
            resp = self.client.post(endpoint, {
                'username': f'new_{endpoint.replace("/", "_")}',
                'email': 'APIUSER@corp.com',  # uppercase variation
                'password': 'Password123!',
                'name': 'API Attempt',
                'org_name': 'API Corp'
            }, content_type='application/json')
            self.assertEqual(resp.status_code, 400)
            data = resp.json()
            self.assertIn("An account with this email address already exists. Please log in instead.", data.get('error', ''))

    def test_05_concurrent_registration_race_condition(self):
        """Simultaneous duplicate registrations or race conditions result in only ONE account being created."""
        from django.db import IntegrityError
        from django.core.exceptions import ValidationError

        email = 'race.condition@test.com'

        # First registration succeeds
        resp1 = self.client.post('/accounts/signup/', {
            'action': 'signup',
            'signup_username': 'racer_1',
            'signup_name': 'Racer 1',
            'signup_email': email,
            'signup_org': 'Org Racer 1',
            'signup_password': 'Password123!',
            'signup_confirm_password': 'Password123!',
        })
        self.assertEqual(resp1.status_code, 302)
        self.client.logout()

        # Simulated race condition: If a concurrent thread bypassed the view check,
        # the model clean/signal/DB unique constraint strictly blocks user creation.
        with self.assertRaises((IntegrityError, ValidationError)):
            User.objects.create_user(
                username='racer_2',
                email=email.upper(),
                password='Password123!'
            )

        # Attempting signup via HTTP client also returns 400 with the exact error message
        resp2 = self.client.post('/accounts/signup/', {
            'action': 'signup',
            'signup_username': 'racer_2',
            'signup_name': 'Racer 2',
            'signup_email': email.upper(),
            'signup_org': 'Org Racer 2',
            'signup_password': 'Password123!',
            'signup_confirm_password': 'Password123!',
        })
        self.assertEqual(resp2.status_code, 400)
        self.assertContains(resp2, "An account with this email address already exists. Please log in instead.", status_code=400)

        # Exactly ONE user must exist with that normalized email
        matching_users = User.objects.filter(email__iexact=email)
        self.assertEqual(matching_users.count(), 1)
        matching_profiles = UserProfile.objects.filter(normalized_email=email)
        self.assertEqual(matching_profiles.count(), 1)

    def test_06_existing_user_login_success(self):
        """Existing user can successfully log in using either their username or their email."""
        # Register a user
        self.client.post('/accounts/signup/', {
            'action': 'signup',
            'signup_username': 'login_tester',
            'signup_name': 'Login Tester',
            'signup_email': 'login.tester@convosis.com',
            'signup_org': 'Login Tester Inc',
            'signup_password': 'CorrectPassword123!',
            'signup_confirm_password': 'CorrectPassword123!',
        })
        self.client.logout()

        # Login using username
        resp1 = self.client.post('/accounts/login/', {
            'action': 'signin',
            'username': 'login_tester',
            'password': 'CorrectPassword123!',
        })
        self.assertEqual(resp1.status_code, 302)
        self.client.logout()

        # Login using email (case-insensitive)
        resp2 = self.client.post('/accounts/login/', {
            'action': 'signin',
            'username': 'LOGIN.TESTER@CONVOSIS.COM',
            'password': 'CorrectPassword123!',
        })
        self.assertEqual(resp2.status_code, 302)

    def test_07_existing_user_password_reset_success(self):
        """Password reset lookup correctly finds the unique account even with mixed-case email."""
        User.objects.create_user(
            username='reset_tester',
            email='reset.user@convosis.com',
            password='Password123!'
        )
        form = PasswordResetForm({'email': 'RESET.USER@CONVOSIS.COM'})
        self.assertTrue(form.is_valid())
        matched = list(form.get_users('RESET.USER@CONVOSIS.COM'))
        self.assertEqual(len(matched), 1)
        self.assertEqual(matched[0].username, 'reset_tester')

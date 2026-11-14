import datetime
import json
from unittest.mock import patch

from django.conf import settings
from django.contrib.auth import get_user_model
from django.test import TestCase, Client
from django.utils import timezone

from books import otp_service
from books.models import Organization, OTPVerification, UserProfile

User = get_user_model()


class OTPAuthenticationTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.org = Organization.objects.create(
            name="Alpha Corp",
            email="admin@alphacorp.com",
            phone="+919876543210",
            state="Kerala"
        )
        self.user = User.objects.create_user(
            username="existing_admin",
            email="admin@alphacorp.com",
            password="StrongPassword123!",
            first_name="Admin"
        )
        self.profile = UserProfile.objects.create(
            user=self.user,
            organization=self.org,
            role=UserProfile.ADMIN,
            normalized_email="admin@alphacorp.com",
            phone="+919876543210",
            is_email_verified=True,
            is_mobile_verified=True
        )

    def test_signup_creates_inactive_account_and_dispatches_otp(self):
        """User registers with name, email, mobile, password; account remains inactive until OTP verification."""
        payload = {
            "name": "Jane Doe",
            "org_name": "Doe Technologies",
            "username": "janedoe",
            "email": "jane@example.com",
            "mobile": "+919123456789",
            "password": "SecurePassword123!",
            "confirm_password": "SecurePassword123!"
        }
        res = self.client.post(
            "/api/auth/register-with-otp/",
            data=json.dumps(payload),
            content_type="application/json"
        )
        self.assertEqual(res.status_code, 201)
        data = res.json()
        self.assertEqual(data["status"], "ok")
        self.assertEqual(data["step"], "verify_otp")
        self.assertIn("j**e@example.com", data["masked_target"])
        # Plain OTP MUST NOT be returned in API response
        self.assertNotIn("otp", data)

        # Check DB state: user is created but inactive
        user = User.objects.get(username="janedoe")
        self.assertFalse(user.is_active)
        self.assertFalse(user.profile.is_email_verified)
        self.assertEqual(user.profile.phone, "+919123456789")

        # Check OTP verification record in database
        otp_rec = OTPVerification.objects.filter(target_value="jane@example.com", purpose="signup").first()
        self.assertIsNotNone(otp_rec)
        self.assertFalse(otp_rec.is_verified)
        self.assertTrue(otp_rec.hashed_otp.startswith("pbkdf2_sha256$"))

    def test_signup_duplicate_email_and_mobile_rejected(self):
        """Duplicate email or mobile number registration is rejected with 400."""
        # Duplicate email
        res_email = self.client.post(
            "/api/auth/register-with-otp/",
            data=json.dumps({
                "username": "new_user_1",
                "email": "admin@alphacorp.com",
                "mobile": "+919999999999",
                "password": "Password123!"
            }),
            content_type="application/json"
        )
        self.assertEqual(res_email.status_code, 400)
        self.assertIn("already exists", res_email.json()["message"])

        # Duplicate mobile
        res_mobile = self.client.post(
            "/api/auth/register-with-otp/",
            data=json.dumps({
                "username": "new_user_2",
                "email": "fresh@domain.com",
                "mobile": "+919876543210",
                "password": "Password123!"
            }),
            content_type="application/json"
        )
        self.assertEqual(res_mobile.status_code, 400)
        self.assertIn("already exists", res_mobile.json()["message"])

    def test_otp_verification_activates_account(self):
        """Verifying the valid 6-digit OTP activates the account and marks email verified."""
        # Setup pending signup OTP
        with patch("books.otp_service.generate_secure_otp", return_value="654321"):
            rec, _ = otp_service.create_and_send_otp(
                target_type="email",
                target_value="pending@example.com",
                purpose=OTPVerification.PURPOSE_SIGNUP
            )

        # Create inactive user
        u = User.objects.create_user(
            username="pending_user",
            email="pending@example.com",
            password="Password123!",
            is_active=False
        )
        p = UserProfile.objects.create(
            user=u,
            organization=self.org,
            normalized_email="pending@example.com",
            is_email_verified=False
        )

        # Submit OTP verification
        res = self.client.post(
            "/api/auth/otp/verify/",
            data=json.dumps({
                "target_value": "pending@example.com",
                "purpose": "signup",
                "otp": "654321"
            }),
            content_type="application/json"
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data["verified"])

        u.refresh_from_db()
        p.refresh_from_db()
        self.assertTrue(u.is_active)
        self.assertTrue(p.is_email_verified)
        self.assertEqual(p.status, UserProfile.STATUS_ACTIVE)

    def test_invalid_otp_decrements_attempts_and_locks_at_limit(self):
        """5 incorrect OTP attempts lock/invalidate the verification request."""
        with patch("books.otp_service.generate_secure_otp", return_value="112233"):
            otp_service.create_and_send_otp(
                target_type="email",
                target_value="testlock@example.com",
                purpose=OTPVerification.PURPOSE_SIGNUP
            )

        # 4 wrong attempts
        for attempt in range(1, 5):
            res = self.client.post(
                "/api/auth/otp/verify/",
                data=json.dumps({
                    "target_value": "testlock@example.com",
                    "purpose": "signup",
                    "otp": "999999"
                }),
                content_type="application/json"
            )
            self.assertEqual(res.status_code, 400)
            self.assertIn(f"{5 - attempt} attempt", res.json()["message"])

        # 5th wrong attempt locks the code
        res5 = self.client.post(
            "/api/auth/otp/verify/",
            data=json.dumps({
                "target_value": "testlock@example.com",
                "purpose": "signup",
                "otp": "999999"
            }),
            content_type="application/json"
        )
        self.assertEqual(res5.status_code, 400)
        self.assertIn("exceeded", res5.json()["message"].lower())

        # Now even the correct code is rejected
        res_correct = self.client.post(
            "/api/auth/otp/verify/",
            data=json.dumps({
                "target_value": "testlock@example.com",
                "purpose": "signup",
                "otp": "112233"
            }),
            content_type="application/json"
        )
        self.assertEqual(res_correct.status_code, 400)

    def test_expired_otp_is_rejected(self):
        """OTP is valid for 5 minutes; older requests are expired and rejected."""
        with patch("books.otp_service.generate_secure_otp", return_value="778899"):
            rec, _ = otp_service.create_and_send_otp(
                target_type="email",
                target_value="expire@example.com",
                purpose=OTPVerification.PURPOSE_SIGNUP
            )

        # Fast forward expiration in database
        rec.expires_at = timezone.now() - datetime.timedelta(seconds=10)
        rec.save(update_fields=["expires_at"])

        res = self.client.post(
            "/api/auth/otp/verify/",
            data=json.dumps({
                "target_value": "expire@example.com",
                "purpose": "signup",
                "otp": "778899"
            }),
            content_type="application/json"
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("expired", res.json()["message"].lower())

    def test_resend_cooldown_and_hourly_rate_limit(self):
        """Enforces 60-second cooldown between resends and maximum 5 per hour."""
        with patch("books.otp_service.generate_secure_otp", return_value="123456"):
            otp_service.create_and_send_otp(
                target_type="email",
                target_value="cooldown@example.com",
                purpose=OTPVerification.PURPOSE_SIGNUP
            )

        # Immediate second request should be blocked by 60s cooldown
        res_cooldown = self.client.post(
            "/api/auth/otp/send/",
            data=json.dumps({
                "target_type": "email",
                "target_value": "cooldown@example.com",
                "purpose": "signup"
            }),
            content_type="application/json"
        )
        self.assertEqual(res_cooldown.status_code, 429)
        self.assertIn("wait", res_cooldown.json()["message"].lower())

        # Test hourly limit: simulate 5 OTPs sent over the past hour with cooldown expired (>60s ago)
        OTPVerification.objects.all().delete()
        past_time = timezone.now() - datetime.timedelta(minutes=15)
        for i in range(5):
            rec = OTPVerification.objects.create(
                target_type="email",
                target_value="cooldown@example.com",
                purpose=OTPVerification.PURPOSE_SIGNUP,
                hashed_otp=otp_service.hash_otp("111111"),
                expires_at=timezone.now() + datetime.timedelta(minutes=5),
                is_consumed=True
            )
            OTPVerification.objects.filter(pk=rec.pk).update(created_at=past_time - datetime.timedelta(minutes=i))

        res_hourly = self.client.post(
            "/api/auth/otp/send/",
            data=json.dumps({
                "target_type": "email",
                "target_value": "cooldown@example.com",
                "purpose": "signup"
            }),
            content_type="application/json"
        )
        self.assertEqual(res_hourly.status_code, 429)
        self.assertIn("maximum verification requests", res_hourly.json()["message"].lower())

    def test_forgot_password_and_password_reset_flow(self):
        """User requests forgot password OTP, verifies it, resets password, invalidating sessions."""
        email = "admin@alphacorp.com"

        # 1. Dispatch forgot password OTP
        with patch("books.otp_service.generate_secure_otp", return_value="556677"):
            res_forgot = self.client.post(
                "/api/auth/forgot-password/",
                data=json.dumps({"email": email}),
                content_type="application/json"
            )
        self.assertEqual(res_forgot.status_code, 200)

        # 2. Verify OTP
        res_verify = self.client.post(
            "/api/auth/otp/verify/",
            data=json.dumps({
                "target_value": email,
                "purpose": "forgot_password",
                "otp": "556677"
            }),
            content_type="application/json"
        )
        self.assertEqual(res_verify.status_code, 200)
        reset_token = res_verify.json().get("reset_token")
        self.assertTrue(bool(reset_token))

        # 3. Reset Password
        res_reset = self.client.post(
            "/api/auth/reset-password/",
            data=json.dumps({
                "email": email,
                "reset_token": reset_token,
                "new_password": "NewSecretPassword999!",
                "confirm_password": "NewSecretPassword999!"
            }),
            content_type="application/json"
        )
        self.assertEqual(res_reset.status_code, 200)

        # 4. Confirm new password works for login and old password fails
        login_fail = self.client.login(username="existing_admin", password="StrongPassword123!")
        self.assertFalse(login_fail)
        login_success = self.client.login(username="existing_admin", password="NewSecretPassword999!")
        self.assertTrue(login_success)

    def test_change_email_and_mobile_for_authenticated_user(self):
        """Authenticated user updates email and phone via verified OTP."""
        self.client.force_login(self.user)

        # 1. Request email change
        with patch("books.otp_service.generate_secure_otp", return_value="882244"):
            res_req_em = self.client.post(
                "/api/auth/change-contact/",
                data=json.dumps({"type": "email", "step": "request", "new_value": "newadmin@alphacorp.com"}),
                content_type="application/json"
            )
        self.assertEqual(res_req_em.status_code, 200)

        # 2. Verify email change
        res_ver_em = self.client.post(
            "/api/auth/change-contact/",
            data=json.dumps({"type": "email", "step": "verify", "new_value": "newadmin@alphacorp.com", "otp": "882244"}),
            content_type="application/json"
        )
        self.assertEqual(res_ver_em.status_code, 200)
        self.user.refresh_from_db()
        self.profile.refresh_from_db()
        self.assertEqual(self.user.email, "newadmin@alphacorp.com")
        self.assertEqual(self.profile.normalized_email, "newadmin@alphacorp.com")
        self.assertTrue(self.profile.is_email_verified)

        # 3. Request mobile change
        with patch("books.otp_service.generate_secure_otp", return_value="336699"):
            res_req_mob = self.client.post(
                "/api/auth/change-contact/",
                data=json.dumps({"type": "mobile", "step": "request", "new_value": "+919811122233"}),
                content_type="application/json"
            )
        self.assertEqual(res_req_mob.status_code, 200)

        # 4. Verify mobile change
        res_ver_mob = self.client.post(
            "/api/auth/change-contact/",
            data=json.dumps({"type": "mobile", "step": "verify", "new_value": "+919811122233", "otp": "336699"}),
            content_type="application/json"
        )
        self.assertEqual(res_ver_mob.status_code, 200)
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.phone, "+919811122233")
        self.assertTrue(self.profile.is_mobile_verified)

    def test_unauthenticated_cannot_access_change_contact(self):
        """Unauthenticated requests to change contact details are rejected with 401."""
        self.client.logout()
        res = self.client.post(
            "/api/auth/change-contact/",
            data=json.dumps({"type": "email", "step": "request", "new_value": "hacker@evil.com"}),
            content_type="application/json"
        )
        self.assertEqual(res.status_code, 401)

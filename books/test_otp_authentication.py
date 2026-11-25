import datetime
import json
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from unittest import skipUnless
from unittest.mock import patch

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import close_old_connections, connection
from django.test import TestCase, Client, TransactionTestCase, override_settings
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
        email_dispatch = patch("books.otp_service.send_brevo_email", return_value=True)
        email_dispatch.start()
        self.addCleanup(email_dispatch.stop)

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

    def test_registration_otp_verification_activates_the_same_account_atomically(self):
        payload = {
            "username": "verified_signup_user",
            "email": "verified_signup@example.com",
            "password": "SecurePassword123!",
        }
        with patch("books.otp_service.generate_secure_otp", return_value="654321"):
            registration = self.client.post(
                "/api/auth/register-with-otp/",
                data=json.dumps(payload),
                content_type="application/json",
            )
        self.assertEqual(registration.status_code, 201, registration.content)
        org_before_verify = Organization.objects.get(
            owner__username=payload["username"]
        ).pk

        verification = self.client.post(
            "/api/auth/otp/verify/",
            data=json.dumps({
                "target_value": payload["email"],
                "purpose": OTPVerification.PURPOSE_SIGNUP,
                "otp": "654321",
            }),
            content_type="application/json",
        )
        self.assertEqual(verification.status_code, 200, verification.content)
        self.assertTrue(verification.json()["verified"])
        self.assertNotIn("user_id", verification.json())

        user = User.objects.get(username=payload["username"])
        self.assertTrue(user.is_active)
        self.assertTrue(user.profile.is_email_verified)
        self.assertEqual(
            Organization.objects.get(owner=user).pk,
            org_before_verify,
        )

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

    def test_api_signup_generates_distinct_organization_primary_keys(self):
        created_org_ids = []
        for index in range(2):
            payload = {
                "username": f"org_sequence_user_{index}",
                "email": f"org_sequence_{index}@example.com",
                "password": "SecurePassword123!",
            }
            response = self.client.post(
                "/api/auth/register/",
                data=json.dumps(payload),
                content_type="application/json",
            )
            self.assertEqual(response.status_code, 201, response.content)
            created_org_ids.append(
                Organization.objects.get(owner__username=payload["username"]).pk
            )
        self.assertEqual(len(set(created_org_ids)), 2)

    def test_registration_retry_reuses_existing_pending_organization_and_otp(self):
        payload = {
            "username": "retry_signup_user",
            "email": "retry_signup@example.com",
            "password": "SecurePassword123!",
        }
        first = self.client.post(
            "/api/auth/register-with-otp/",
            data=json.dumps(payload),
            content_type="application/json",
        )
        self.assertEqual(first.status_code, 201, first.content)
        org_id = Organization.objects.get(owner__username=payload["username"]).pk
        otp_count = OTPVerification.objects.filter(target_value=payload["email"]).count()

        retry = self.client.post(
            "/api/auth/register-with-otp/",
            data=json.dumps(payload),
            content_type="application/json",
        )
        self.assertEqual(retry.status_code, 200, retry.content)
        self.assertEqual(
            Organization.objects.filter(owner__username=payload["username"]).count(),
            1,
        )
        self.assertEqual(
            Organization.objects.get(owner__username=payload["username"]).pk,
            org_id,
        )
        self.assertEqual(
            OTPVerification.objects.filter(target_value=payload["email"]).count(),
            otp_count,
        )

    def test_signup_duplicate_username_has_safe_validation_message(self):
        response = self.client.post(
            "/api/auth/register-with-otp/",
            data=json.dumps({
                "username": "existing_admin",
                "email": "new_username_conflict@example.com",
                "password": "SecurePassword123!",
            }),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json()["message"],
            "This username is already taken. Please choose another.",
        )

    def test_resend_signup_otp_for_pending_user(self):
        pending = User.objects.create_user(
            username="resend_pending_user",
            email="resend_pending@example.com",
            password="SecurePassword123!",
            is_active=False,
        )
        UserProfile.objects.create(
            user=pending,
            organization=self.org,
            normalized_email=pending.email,
            status=UserProfile.STATUS_INACTIVE,
            is_email_verified=False,
        )
        response = self.client.post(
            "/api/auth/otp/resend/",
            data=json.dumps({
                "target_type": "email",
                "target_value": pending.email,
                "purpose": OTPVerification.PURPOSE_SIGNUP,
            }),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200, response.content)
        record = OTPVerification.objects.get(
            target_value=pending.email,
            purpose=OTPVerification.PURPOSE_SIGNUP,
        )
        self.assertEqual(record.user, pending)
        self.assertEqual(record.organization, self.org)

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

    def test_strong_password_validator_acceptance_and_rejections(self):
        """StrongPasswordValidator accepts compliant passwords and rejects non-compliant ones."""
        from django.core.exceptions import ValidationError
        from books.validators import validate_strong_password

        # Compliant passwords must pass
        validate_strong_password("Surya@123")
        validate_strong_password("Admin#2026")
        validate_strong_password("P@ssw0rd!Secure")

        # Length < 8
        with self.assertRaises(ValidationError) as ctx:
            validate_strong_password("S@123")
        self.assertIn("at least 8 characters", str(ctx.exception))

        # No uppercase
        with self.assertRaises(ValidationError) as ctx:
            validate_strong_password("surya@123")
        self.assertIn("uppercase letter", str(ctx.exception))

        # No lowercase
        with self.assertRaises(ValidationError) as ctx:
            validate_strong_password("SURYA@123")
        self.assertIn("lowercase letter", str(ctx.exception))

        # No digit
        with self.assertRaises(ValidationError) as ctx:
            validate_strong_password("Surya@abc")
        self.assertIn("number", str(ctx.exception))

        # No special character
        with self.assertRaises(ValidationError) as ctx:
            validate_strong_password("Surya1234")
        self.assertIn("special character", str(ctx.exception))

    def test_signup_weak_password_rejected_by_api(self):
        """Signup API rejects weak passwords and accepts strong passwords."""
        # Weak password (length < 8)
        res = self.client.post(
            "/api/auth/register-with-otp/",
            data=json.dumps({
                "username": "testuser_weak",
                "email": "testuser_weak@example.com",
                "mobile": "+919988776655",
                "password": "weak",
                "confirm_password": "weak"
            }),
            content_type="application/json"
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("at least 8 characters", res.json()["message"])

        # No special character
        res2 = self.client.post(
            "/api/auth/register-with-otp/",
            data=json.dumps({
                "username": "testuser_nospec",
                "email": "testuser_nospec@example.com",
                "mobile": "+919988776654",
                "password": "Password123",
                "confirm_password": "Password123"
            }),
            content_type="application/json"
        )
        self.assertEqual(res2.status_code, 400)
        self.assertIn("special character", res2.json()["message"])

    def test_smtp_failure_preserves_pending_signup_and_allows_retry(self):
        """A failed email dispatch leaves a pending account that can request a new code."""
        initial_org_count = Organization.objects.count()
        with patch("books.otp_service.send_brevo_email", side_effect=Exception("Brevo SMTP auth rejected (code 535)")):
            res = self.client.post(
                "/api/auth/register-with-otp/",
                data=json.dumps({
                    "username": "smtp_fail_user",
                    "email": "smtp_fail@example.com",
                    "mobile": "+919988776633",
                    "password": "Surya@123",
                    "confirm_password": "Surya@123"
                }),
                content_type="application/json"
            )
        self.assertEqual(res.status_code, 502)
        data = res.json()
        self.assertEqual(
            data["message"],
            "We couldn't send your verification email. Please try again later.",
        )
        self.assertNotIn("SMTP", data["message"])
        self.assertNotIn("535", data["message"])

        # The account and organization are retained, but remain unverified.
        pending_user = User.objects.get(username="smtp_fail_user")
        self.assertFalse(pending_user.is_active)
        self.assertFalse(pending_user.profile.is_email_verified)
        self.assertEqual(Organization.objects.count(), initial_org_count + 1)
        self.assertFalse(OTPVerification.objects.filter(target_value="smtp_fail@example.com").exists())

        retry = self.client.post(
            "/api/auth/register-with-otp/",
            data=json.dumps({
                "username": "smtp_fail_user",
                "email": "smtp_fail@example.com",
                "mobile": "+919988776633",
                "password": "Surya@123",
                "confirm_password": "Surya@123",
            }),
            content_type="application/json",
        )
        self.assertEqual(retry.status_code, 200, retry.content)
        self.assertEqual(Organization.objects.count(), initial_org_count + 1)
        self.assertTrue(
            OTPVerification.objects.filter(
                target_value="smtp_fail@example.com",
                purpose=OTPVerification.PURPOSE_SIGNUP,
                user=pending_user,
            ).exists()
        )

    def test_registration_unexpected_failure_does_not_expose_exception(self):
        with patch("books.api.services.ensure_default_accounts", side_effect=RuntimeError(
            "books_organization_pkey database diagnostic"
        )):
            response = self.client.post(
                "/api/auth/register-with-otp/",
                data=json.dumps({
                    "username": "hidden_error_user",
                    "email": "hidden_error@example.com",
                    "password": "SecurePassword123!",
                }),
                content_type="application/json",
            )
        self.assertEqual(response.status_code, 500)
        message = response.json()["message"]
        self.assertEqual(message, "Something went wrong. Please contact support.")
        self.assertNotIn("books_organization_pkey", message)
        self.assertFalse(User.objects.filter(username="hidden_error_user").exists())
        self.assertFalse(Organization.objects.filter(owner__username="hidden_error_user").exists())


@override_settings(
    BREVO_API_KEY='',
    EMAIL_HOST='',
    EMAIL_HOST_USER='',
    EMAIL_HOST_PASSWORD='',
    EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
)
class OTPEmailDeliveryConfigurationTests(TestCase):
    def test_false_provider_result_is_not_reported_as_sent(self):
        with patch("books.otp_service.send_brevo_email", return_value=False):
            with self.assertRaises(otp_service.OTPServiceError) as error:
                otp_service.create_and_send_otp(
                    target_type="email",
                    target_value="delivery_failure@example.com",
                    purpose=OTPVerification.PURPOSE_SIGNUP,
                )
        self.assertEqual(error.exception.status_code, 502)
        self.assertFalse(
            OTPVerification.objects.filter(
                target_value="delivery_failure@example.com"
            ).exists()
        )

    def test_configured_smtp_backend_dispatches_email(self):
        with override_settings(
            EMAIL_HOST='smtp-relay.brevo.com',
            EMAIL_HOST_USER='smtp-login',
            EMAIL_HOST_PASSWORD='smtp-key',
            EMAIL_BACKEND='django.core.mail.backends.smtp.EmailBackend',
        ):
            with patch("books.otp_service.send_mail", return_value=1) as send_mail_mock:
                sent = otp_service.send_brevo_email(
                    "recipient@example.com",
                    "Verification code",
                    "<p>Code</p>",
                    "Code",
                )

        self.assertTrue(sent)
        send_mail_mock.assert_called_once()

    def test_missing_email_credentials_do_not_report_success(self):
        with patch("books.otp_service.send_mail") as send_mail_mock:
            with self.assertRaisesRegex(RuntimeError, "Email delivery is not configured"):
                otp_service.send_brevo_email(
                    "recipient@example.com",
                    "Verification code",
                    "<p>Code</p>",
                    "Code",
                )

        send_mail_mock.assert_not_called()

    def test_failed_brevo_api_does_not_fall_back_to_locmem_success(self):
        with override_settings(BREVO_API_KEY='test-api-key'):
            with patch("books.otp_service.urllib.request.urlopen", side_effect=OSError("connection failed")):
                with patch("books.otp_service.send_mail") as send_mail_mock:
                    with self.assertRaisesRegex(RuntimeError, "SMTP fallback is not configured"):
                        otp_service.send_brevo_email(
                            "recipient@example.com",
                            "Verification code",
                            "<p>Code</p>",
                            "Code",
                        )

        send_mail_mock.assert_not_called()


@skipUnless(
    connection.vendor == 'postgresql',
    'Concurrent signup integration test requires PostgreSQL.',
)
class ConcurrentRegistrationTests(TransactionTestCase):
    def test_concurrent_duplicate_email_creates_one_organization(self):
        barrier = Barrier(2)
        payloads = [
            {
                "username": f"parallel_signup_{index}",
                "email": "parallel_signup@example.com",
                "password": "SecurePassword123!",
            }
            for index in range(2)
        ]

        def register(payload):
            close_old_connections()
            client = Client()
            try:
                barrier.wait(timeout=10)
                response = client.post(
                    "/api/auth/register-with-otp/",
                    data=json.dumps(payload),
                    content_type="application/json",
                )
                return response.status_code
            finally:
                connection.close()

        with patch("books.otp_service.send_brevo_email", return_value=True):
            with ThreadPoolExecutor(max_workers=2) as executor:
                statuses = list(executor.map(register, payloads))

        self.assertEqual(sorted(statuses), [201, 400])
        self.assertEqual(User.objects.filter(email__iexact=payloads[0]["email"]).count(), 1)
        self.assertEqual(
            Organization.objects.filter(owner__email__iexact=payloads[0]["email"]).count(),
            1,
        )

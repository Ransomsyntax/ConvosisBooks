import datetime
import json
import logging
import re
import secrets
import urllib.error
import urllib.parse
import urllib.request

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import check_password, make_password
from django.core.mail import send_mail
from django.utils import timezone

from .models import OTPVerification, Organization, UserProfile

logger = logging.getLogger(__name__)


class OTPServiceError(Exception):
    def __init__(self, message, code='otp_error', status_code=400):
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code


def mask_identifier(val: str, target_type: str = 'email') -> str:
    if not val:
        return ''
    if target_type == 'email' or '@' in val:
        parts = val.split('@')
        name = parts[0]
        domain = parts[1] if len(parts) > 1 else ''
        if len(name) <= 2:
            masked_name = name[0] + '*'
        else:
            masked_name = name[0] + ('*' * (len(name) - 2)) + name[-1]
        return f"{masked_name}@{domain}"
    digits = re.sub(r'\D', '', val)
    if len(digits) >= 10:
        return f"{digits[:2]}{'*' * (len(digits) - 6)}{digits[-4:]}"
    return f"{'*' * (len(val) - 2)}{val[-2:]}" if len(val) > 2 else '**'


def normalize_email(email: str) -> str:
    return (email or '').strip().lower()


def normalize_phone(phone: str) -> str:
    cleaned = re.sub(r'[\s\-\(\)]', '', (phone or '').strip())
    return cleaned


def generate_secure_otp() -> str:
    """Generate a cryptographically secure 6-digit numeric OTP."""
    rng = secrets.SystemRandom()
    return f"{rng.randint(100000, 999999)}"


def hash_otp(otp_str: str) -> str:
    return make_password(otp_str)


def verify_otp_hash(otp_str: str, hashed_str: str) -> bool:
    if not otp_str or not hashed_str:
        return False
    return check_password(otp_str, hashed_str)


def check_rate_limits(target_value: str, purpose: str, ip_address: str = None) -> tuple[bool, str]:
    """
    Enforce:
    1. 60-second cooldown between resends for the same target and purpose.
    2. Max 5 OTP requests per hour per target.
    3. IP abuse protection (max 25 requests per hour per IP).
    """
    now = timezone.now()
    cooldown_seconds = getattr(settings, 'OTP_RESEND_COOLDOWN_SECONDS', 60)
    max_per_hour = getattr(settings, 'OTP_MAX_PER_HOUR', 5)

    # 1. Cooldown
    recent_record = OTPVerification.objects.filter(
        target_value=target_value,
        purpose=purpose
    ).order_by('-created_at').first()

    if recent_record:
        elapsed = (now - recent_record.created_at).total_seconds()
        if elapsed < cooldown_seconds:
            remaining = int(cooldown_seconds - elapsed)
            return False, f"Please wait {remaining} seconds before requesting a new verification code."

    # 2. Hourly limit per target
    one_hour_ago = now - datetime.timedelta(hours=1)
    target_count = OTPVerification.objects.filter(
        target_value=target_value,
        created_at__gte=one_hour_ago
    ).count()
    if target_count >= max_per_hour:
        return False, "Maximum verification requests reached for this hour. Please try again later."

    # 3. Hourly limit per IP (if provided)
    if ip_address:
        ip_count = OTPVerification.objects.filter(
            ip_address=ip_address,
            created_at__gte=one_hour_ago
        ).count()
        if ip_count >= 25:
            return False, "Too many requests from this network. Please try again later."

    return True, ""


def render_otp_email_html(otp: str, purpose: str, recipient_name: str = '') -> tuple[str, str, str]:
    """
    Generate professional HTML and plain-text email with CONVOSIS Books styling,
    branded header, 6-digit OTP, expiration notice (5 mins), and security warning.
    """
    purpose_titles = {
        OTPVerification.PURPOSE_SIGNUP: ("Account Verification", "confirm your new CONVOSIS Books workspace account"),
        OTPVerification.PURPOSE_FORGOT_PASSWORD: ("Password Reset", "reset the password for your CONVOSIS Books account"),
        OTPVerification.PURPOSE_CHANGE_EMAIL: ("Email Address Change", "verify and link this new email address"),
        OTPVerification.PURPOSE_CHANGE_MOBILE: ("Mobile Number Verification", "verify your mobile number update"),
        OTPVerification.PURPOSE_VERIFY_MOBILE: ("Mobile Number Verification", "verify your mobile number"),
    }
    title, action_text = purpose_titles.get(purpose, ("Verification Code", "complete your verification request"))
    subject = f"Your CONVOSIS Books Verification Code: {otp}"
    user_greeting = f"Hello {recipient_name}," if recipient_name else "Hello,"

    spaced_otp = ' '.join(otp)

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f1f5f9;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:540px;background:#ffffff;border-radius:16px;box-shadow:0 10px 25px -5px rgba(15,23,42,0.08),0 8px 10px -6px rgba(15,23,42,0.04);border:1px solid #e2e8f0;overflow:hidden;">
          <!-- BRAND HEADER -->
          <tr>
            <td style="padding:28px 32px;background:linear-gradient(135deg,#0284c7 0%,#2563eb 100%);text-align:left;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <span style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">CONVOSIS</span>
                    <span style="font-size:20px;font-weight:400;color:#bae6fd;margin-left:6px;">Books</span>
                  </td>
                  <td align="right">
                    <span style="font-size:11px;font-weight:600;color:#ffffff;background:rgba(255,255,255,0.2);padding:4px 10px;border-radius:999px;letter-spacing:0.5px;text-transform:uppercase;">Secure Auth</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CONTENT BODY -->
          <tr>
            <td style="padding:32px 32px 24px;">
              <h1 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#0f172a;">{title}</h1>
              <p style="margin:0 0 16px;font-size:14.5px;line-height:1.6;color:#334155;">{user_greeting}</p>
              <p style="margin:0 0 24px;font-size:14.5px;line-height:1.6;color:#334155;">
                We received a request to {action_text}. Use the 6-digit verification code below to proceed:
              </p>

              <!-- OTP CODE BOX -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px;">
                <tr>
                  <td align="center" style="background:#f8fafc;border:2px dashed #cbd5e1;border-radius:12px;padding:22px 16px;">
                    <span style="display:inline-block;font-size:32px;font-weight:800;letter-spacing:10px;color:#0284c7;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;">
                      {spaced_otp}
                    </span>
                    <div style="margin-top:8px;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">
                      Valid for 5 minutes
                    </div>
                  </td>
                </tr>
              </table>

              <!-- SECURITY WARNING -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px;background:#fef2f2;border-left:4px solid #ef4444;border-radius:4px;">
                <tr>
                  <td style="padding:12px 14px;">
                    <p style="margin:0;font-size:12.5px;line-height:1.5;color:#991b1b;font-weight:500;">
                      <strong>Security Notice:</strong> Never share this code with anyone. CONVOSIS Books team members will never ask for your verification code or password.
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:13px;line-height:1.5;color:#64748b;">
                If you did not initiate this request, please ignore this email or review your account security immediately.
              </p>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
              <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.5;">
                &copy; {timezone.now().year} CONVOSIS Technologies. Enterprise Cloud Accounting.<br>
                This is an automated system notification; please do not reply directly.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""

    plain = (
        f"{title} - CONVOSIS Books\n\n"
        f"{user_greeting}\n\n"
        f"Your verification code is: {otp}\n\n"
        f"This code will expire in 5 minutes.\n"
        f"Do not share this code with anyone. CONVOSIS Books staff will never request this code.\n\n"
        f"If you did not request this, please ignore this message.\n\n"
        f"--\nCONVOSIS Technologies"
    )

    return subject, html, plain


def send_brevo_email(to_email: str, subject: str, html_content: str, text_content: str) -> bool:
    """
    Deliver transactional email via Brevo REST API v3 or Brevo SMTP/Django mail backend.
    """
    api_key = getattr(settings, 'BREVO_API_KEY', '').strip()
    sender_email = getattr(settings, 'BREVO_SENDER_EMAIL', 'no-reply@convosis.com').strip()
    sender_name = getattr(settings, 'BREVO_SENDER_NAME', 'CONVOSIS Books').strip()

    if api_key:
        payload = {
            "sender": {"name": sender_name, "email": sender_email},
            "to": [{"email": to_email}],
            "subject": subject,
            "htmlContent": html_content,
            "textContent": text_content,
        }
        data = json.dumps(payload).encode('utf-8')
        req = urllib.request.Request(
            url="https://api.brevo.com/v3/smtp/email",
            data=data,
            headers={
                "accept": "application/json",
                "api-key": api_key,
                "content-type": "application/json"
            },
            method="POST"
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                if 200 <= resp.status < 300:
                    logger.info("Brevo email dispatched successfully to %s", mask_identifier(to_email, 'email'))
                    return True
        except (urllib.error.URLError, urllib.error.HTTPError) as err:
            logger.warning("Brevo API delivery encountered error: %s. Falling back to Django mail.", str(err))

    # Fallback to configured Django mail backend (SMTP or console/locmem in testing)
    try:
        from_email = f"{sender_name} <{sender_email}>"
        send_mail(
            subject=subject,
            message=text_content,
            from_email=from_email,
            recipient_list=[to_email],
            html_message=html_content,
            fail_silently=False
        )
        logger.info("Email dispatched via Django mail backend to %s", mask_identifier(to_email, 'email'))
        return True
    except Exception as exc:
        logger.error("Failed to deliver email to %s: %s", mask_identifier(to_email, 'email'), str(exc))
        return False


def send_msg91_sms(mobile: str, otp: str, template_id: str = None) -> bool:
    """
    Deliver SMS OTP via MSG91 API with graceful test/dev fallback.
    """
    auth_key = getattr(settings, 'MSG91_AUTH_KEY', '').strip()
    tpl_id = template_id or getattr(settings, 'MSG91_TEMPLATE_ID', '').strip()
    sender_id = getattr(settings, 'MSG91_SENDER_ID', 'CONVOS').strip()
    clean_num = normalize_phone(mobile)

    if auth_key:
        # MSG91 Send OTP endpoint: https://control.msg91.com/api/v5/otp
        params = {
            "template_id": tpl_id,
            "mobile": clean_num,
            "authkey": auth_key,
            "otp": otp,
            "otp_expiry": getattr(settings, 'MSG91_OTP_EXPIRY_MINUTES', 5),
        }
        if sender_id:
            params["sender"] = sender_id

        url = f"https://control.msg91.com/api/v5/otp?{urllib.parse.urlencode(params)}"
        req = urllib.request.Request(
            url=url,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        try:
            with urllib.request.urlopen(req, timeout=8) as resp:
                if 200 <= resp.status < 300:
                    logger.info("MSG91 SMS OTP dispatched to %s", mask_identifier(clean_num, 'mobile'))
                    return True
        except Exception as err:
            logger.warning("MSG91 API error: %s. Using development fallback.", str(err))

    # Dev/test/local fallback: log mock dispatch
    logger.info("Mock SMS OTP dispatched to %s (Length: %d digits)", mask_identifier(clean_num, 'mobile'), len(otp))
    return True


def create_and_send_otp(
    target_type: str,
    target_value: str,
    purpose: str,
    user=None,
    organization=None,
    metadata: dict = None,
    ip_address: str = None,
    recipient_name: str = ''
) -> tuple[OTPVerification, dict]:
    """
    Generates, hashes and records a 6-digit OTP, then dispatches it via Brevo or MSG91.
    Never returns or exposes the plain-text OTP in the return value or logs.
    """
    target_type = target_type.lower()
    if target_type == 'email':
        target_value = normalize_email(target_value)
        if not target_value or '@' not in target_value or '.' not in target_value.split('@')[-1]:
            raise OTPServiceError("A valid email address is required.", code="invalid_email")
    elif target_type == 'mobile':
        target_value = normalize_phone(target_value)
        if not target_value or len(re.sub(r'\D', '', target_value)) < 7:
            raise OTPServiceError("A valid mobile number is required.", code="invalid_mobile")
    else:
        raise OTPServiceError(f"Unsupported target type: {target_type}", code="invalid_target_type")

    # Rate limiting
    allowed, limit_msg = check_rate_limits(target_value, purpose, ip_address=ip_address)
    if not allowed:
        raise OTPServiceError(limit_msg, code="rate_limited", status_code=429)

    # Invalidate previous unconsumed OTPs for this target and purpose
    OTPVerification.objects.filter(
        target_value=target_value,
        purpose=purpose,
        is_consumed=False
    ).update(is_consumed=True)

    otp = generate_secure_otp()
    hashed = hash_otp(otp)
    expiry_minutes = getattr(settings, 'OTP_EXPIRY_MINUTES', 5)
    expires_at = timezone.now() + datetime.timedelta(minutes=expiry_minutes)

    record = OTPVerification.objects.create(
        user=user,
        organization=organization,
        target_type=target_type,
        target_value=target_value,
        purpose=purpose,
        hashed_otp=hashed,
        expires_at=expires_at,
        metadata=metadata or {},
        ip_address=ip_address,
        is_verified=False,
        is_consumed=False,
        failed_attempts=0
    )

    # Dispatch notification
    sent = False
    if target_type == 'email':
        subj, html_body, plain_body = render_otp_email_html(otp, purpose, recipient_name=recipient_name)
        sent = send_brevo_email(target_value, subj, html_body, plain_body)
    elif target_type == 'mobile':
        sent = send_msg91_sms(target_value, otp)

    dispatch_info = {
        'status': 'sent' if sent else 'queued',
        'target_type': target_type,
        'masked_target': mask_identifier(target_value, target_type),
        'expires_in_seconds': expiry_minutes * 60,
        'cooldown_seconds': getattr(settings, 'OTP_RESEND_COOLDOWN_SECONDS', 60),
    }
    return record, dispatch_info


def verify_otp_attempt(target_value: str, purpose: str, otp_code: str) -> tuple[bool, str, OTPVerification | None]:
    """
    Verifies user-entered OTP against the stored hash.
    Enforces expiration, single-use, and max 5 attempts locking.
    """
    clean_target = normalize_email(target_value) if '@' in (target_value or '') else normalize_phone(target_value)
    clean_otp = (otp_code or '').strip()

    if not clean_otp:
        return False, "Please enter the 6-digit verification code.", None

    max_attempts = getattr(settings, 'OTP_MAX_FAILED_ATTEMPTS', 5)

    record = OTPVerification.objects.filter(
        target_value=clean_target,
        purpose=purpose,
        is_consumed=False
    ).order_by('-created_at').first()

    if not record:
        return False, "No active verification request found. Please request a new code.", None

    now = timezone.now()
    if record.expires_at < now:
        record.is_consumed = True
        record.save(update_fields=['is_consumed'])
        return False, "The verification code has expired. Please request a new code.", None

    if record.failed_attempts >= max_attempts:
        record.is_consumed = True
        record.save(update_fields=['is_consumed'])
        return False, "Maximum verification attempts exceeded. Please request a new code.", None

    # Check OTP hash
    if not verify_otp_hash(clean_otp, record.hashed_otp):
        record.failed_attempts += 1
        if record.failed_attempts >= max_attempts:
            record.is_consumed = True
            record.save(update_fields=['failed_attempts', 'is_consumed'])
            return False, "Maximum verification attempts exceeded. This verification request has been locked.", None
        record.save(update_fields=['failed_attempts'])
        remaining = max_attempts - record.failed_attempts
        return False, f"Invalid verification code. {remaining} attempt{'s' if remaining != 1 else ''} remaining.", None

    # Verification succeeded: mark verified, single-use consumed, generate token
    record.is_verified = True
    record.is_consumed = True
    record.token = secrets.token_urlsafe(32)
    record.save(update_fields=['is_verified', 'is_consumed', 'token'])
    return True, "Verification successful.", record

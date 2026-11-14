# CONVOSIS Books – Complete OTP Authentication System

This document outlines the architecture, workflows, environment configurations, and security policies for the OTP (One-Time Password) Authentication System in CONVOSIS Books.

---

## 1. Architecture Overview

- **Frontend**: Responsive 6-digit OTP UI matching Convosis Books design tokens, auto-advance on keystroke, Backspace navigation, multi-digit clipboard paste, 60-second resend countdown, and 5-minute expiry timer.
- **Backend**: Django 5.2 + Django REST Framework endpoints.
- **Database**: PostgreSQL with hashed OTPs (`pbkdf2_sha256`), attempt counts, expiry timestamps, single-use flags, and rate-limiting audit logs.
- **Email Delivery**: Brevo (Sendinblue) Transactional API v3 / SMTP with branded HTML templates and security advisories.
- **SMS Delivery**: MSG91 API v5 with fallback to development/test mocks when environment variables are unset.
- **Multi-Tenancy**: Organization boundaries are strictly isolated; cross-tenant modification or verification is strictly prohibited.

---

## 2. Environment Variables Configuration

Set these variables in your deployment environment or `.env` file:

### Brevo (Transactional Email Delivery)
| Variable | Description | Default / Example |
|---|---|---|
| `BREVO_API_KEY` | Brevo API v3 key (`xkeysib-...`) | *Optional in Dev* |
| `BREVO_SENDER_EMAIL` | Verified sender address in Brevo | `no-reply@convosis.com` |
| `BREVO_SENDER_NAME` | Display name of the sender | `CONVOSIS Books` |

### MSG91 (SMS OTP Delivery)
| Variable | Description | Default / Example |
|---|---|---|
| `MSG91_AUTH_KEY` | MSG91 Authentication key | *Optional in Dev* |
| `MSG91_TEMPLATE_ID` | MSG91 / DLT approved OTP template ID | `64b...` |
| `MSG91_SENDER_ID` | 6-character registered sender ID | `CONVOS` |
| `MSG91_OTP_EXPIRY_MINUTES` | OTP expiry configured in MSG91 | `5` |

### OTP Security & Policies
| Variable | Description | Default |
|---|---|---|
| `OTP_EXPIRY_MINUTES` | Validity period of generated OTP | `5` |
| `OTP_MAX_FAILED_ATTEMPTS` | Maximum allowed failed attempts before code locking | `5` |
| `OTP_RESEND_COOLDOWN_SECONDS` | Cooldown period between resend requests | `60` |
| `OTP_MAX_PER_HOUR` | Maximum requests allowed per target per hour | `5` |

---

## 3. Implemented Workflows & API Endpoints

### 3.1. Signup & Registration with Email Verification
- **Endpoint**: `POST /api/auth/register-with-otp/`
- **Payload**: `username`, `name`, `email`, `mobile`, `org_name`, `password`, `confirm_password`
- **Behavior**:
  - Validates email and mobile format.
  - Prevents duplicate email and mobile registrations.
  - Creates the user in an inactive status (`is_active=False`, `is_email_verified=False`).
  - Generates a 6-digit cryptographically secure OTP and sends it to the user's email.
- **Verification Endpoint**: `POST /api/auth/otp/verify/`
  - Validates the 6 digits.
  - Activates the user account (`is_active=True`, `is_email_verified=True`, `status='active'`).
  - Logs the user in and redirects to the workspace.

### 3.2. Forgot Password Flow
- **Request Endpoint**: `POST /api/auth/forgot-password/`
  - Accepts `email`. Sends 6-digit OTP to the registered account.
- **Verify Endpoint**: `POST /api/auth/otp/verify/`
  - Verifies code and returns a secure, 15-minute single-use `reset_token`.
- **Reset Endpoint**: `POST /api/auth/reset-password/`
  - Accepts `email`, `reset_token`, `new_password`, `confirm_password`.
  - Enforces minimum 6-character password strength.
  - Updates password, invalidates all existing active user sessions, and sends a password change confirmation email.

### 3.3. Change Email & Mobile Number (In-App)
- **Endpoint**: `POST /api/auth/change-contact/` (Requires Authenticated Session)
- **Step 1 (Request)**: `{"type": "email"|"mobile", "step": "request", "new_value": "..."}`
  - Validates format and checks for duplicates.
  - Dispatches OTP to new email / phone.
- **Step 2 (Verify)**: `{"type": "email"|"mobile", "step": "verify", "new_value": "...", "otp": "..."}`
  - Updates contact info on User / UserProfile and marks verified only upon successful OTP verification.

---

## 4. Security Highlights

1. **No Plain-Text Storage**: OTP codes are hashed via PBKDF2 with SHA-256 before storage in `OTPVerification`.
2. **Never Leaked in Responses**: Plain OTPs are never returned in JSON responses or displayed in frontend scripts.
3. **Attempt Limiting**: Exceeding 5 incorrect attempts immediately locks and invalidates the verification record.
4. **Single-Use**: Upon successful verification, records are marked `is_consumed=True`.
5. **Cooldown & Rate-Limiting**: 60-second resend cooldown and 5 requests/hour throttle prevent SMS/email flooding.
6. **Graceful Fallbacks**: If Brevo or MSG91 credentials are not present, transactions fall back gracefully to standard Django mail / mock logging without crashing.

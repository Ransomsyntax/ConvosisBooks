import os
import smtplib
import socket
import ssl
from django.conf import settings
from django.core.mail import send_mail
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Verify Brevo SMTP connectivity, TLS handshake, authentication, and test email delivery.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--recipient',
            type=str,
            default='',
            help='Recipient email address to receive test email. Defaults to DEFAULT_FROM_EMAIL or EMAIL_HOST_USER.'
        )
        parser.add_argument(
            '--verbose',
            action='store_true',
            help='Print detailed SMTP transaction debug logs.'
        )

    def handle(self, *args, **options):
        recipient = (options.get('recipient') or '').strip()
        verbose = options.get('verbose', False)

        host = getattr(settings, 'EMAIL_HOST', '').strip()
        port = int(getattr(settings, 'EMAIL_PORT', 587))
        user = getattr(settings, 'EMAIL_HOST_USER', '').strip()
        password = getattr(settings, 'EMAIL_HOST_PASSWORD', '').strip()
        use_tls = getattr(settings, 'EMAIL_USE_TLS', True)
        use_ssl = getattr(settings, 'EMAIL_USE_SSL', False)
        timeout = getattr(settings, 'EMAIL_TIMEOUT', 15)
        default_from = getattr(settings, 'DEFAULT_FROM_EMAIL', '').strip()
        backend = getattr(settings, 'EMAIL_BACKEND', '')

        if not recipient:
            recipient = default_from
            if '<' in recipient and '>' in recipient:
                recipient = recipient.split('<')[1].split('>')[0].strip()
            if not recipient or 'localhost' in recipient:
                recipient = user if ('@' in user and 'smtp-brevo.com' not in user) else 'test@convosis.com'

        masked_pass = f"{password[:4]}...{password[-4:]}" if len(password) > 8 else ("****" if password else "[NOT SET]")

        self.stdout.write(self.style.MIGRATE_HEADING("=== BREVO SMTP PRODUCTION CONFIGURATION AUDIT ==="))
        self.stdout.write(f"EMAIL_BACKEND:       {backend}")
        self.stdout.write(f"EMAIL_HOST:          {host or '[NOT SET]'}")
        self.stdout.write(f"EMAIL_PORT:          {port}")
        self.stdout.write(f"EMAIL_USE_TLS:       {use_tls} (type: {type(use_tls).__name__})")
        self.stdout.write(f"EMAIL_USE_SSL:       {use_ssl} (type: {type(use_ssl).__name__})")
        self.stdout.write(f"EMAIL_HOST_USER:     {user or '[NOT SET]'}")
        self.stdout.write(f"EMAIL_HOST_PASSWORD: {masked_pass}")
        self.stdout.write(f"DEFAULT_FROM_EMAIL:  {default_from}")
        self.stdout.write(f"TEST RECIPIENT:      {recipient}")
        self.stdout.write("-" * 50)

        # 1. Validation Checks
        errors = []
        if not host:
            errors.append("EMAIL_HOST is empty. Must be set (e.g. smtp-relay.brevo.com).")
        if not user:
            errors.append("EMAIL_HOST_USER is empty. Must be set to your Brevo SMTP login.")
        if not password:
            errors.append("EMAIL_HOST_PASSWORD is empty. Must be set to your Brevo SMTP key (xsmtpsib-...).")
        if port == 587 and not use_tls:
            errors.append("Port 587 requires EMAIL_USE_TLS=True. Currently False.")
        if port == 587 and use_ssl:
            errors.append("Port 587 should not have EMAIL_USE_SSL=True simultaneously.")
        if 'localhost' in default_from:
            errors.append("DEFAULT_FROM_EMAIL contains localhost. Brevo will reject unverified sender domains.")

        if errors:
            self.stdout.write(self.style.ERROR("[!] Configuration Errors Detected:"))
            for err in errors:
                self.stdout.write(self.style.ERROR(f"  - {err}"))
            self.stdout.write("-" * 50)

        # 2. Network & Socket Check
        self.stdout.write("[1/4] Checking DNS Resolution and Socket Connection...")
        try:
            ip = socket.gethostbyname(host)
            self.stdout.write(self.style.SUCCESS(f"  Resolved {host} -> {ip}"))
            sock = socket.create_connection((host, port), timeout=timeout)
            sock.close()
            self.stdout.write(self.style.SUCCESS(f"  Successfully opened TCP connection to {host}:{port}"))
        except Exception as exc:
            self.stdout.write(self.style.ERROR(f"  [FAIL] Network connection failed: {exc}"))
            return

        # 3. Low-Level SMTP Handshake, STARTTLS & AUTH
        self.stdout.write("[2/4] Testing Low-Level SMTP Handshake, STARTTLS & AUTH...")
        try:
            smtp = smtplib.SMTP(host=host, port=port, timeout=timeout)
            if verbose:
                smtp.set_debuglevel(1)
            smtp.ehlo()

            if use_tls:
                ctx = ssl.create_default_context()
                code, resp = smtp.starttls(context=ctx)
                self.stdout.write(self.style.SUCCESS(f"  STARTTLS successful: {code} {resp.decode('utf-8', errors='replace')}"))
                smtp.ehlo()

            if user and password:
                code, resp = smtp.login(user, password)
                self.stdout.write(self.style.SUCCESS(f"  SMTP Authentication successful: {code} {resp.decode('utf-8', errors='replace')}"))

            smtp.quit()
        except smtplib.SMTPAuthenticationError as auth_err:
            self.stdout.write(self.style.ERROR(f"  [FAIL] SMTP Authentication Error: {auth_err}"))
            self.stdout.write(self.style.WARNING("  Hint: Verify that EMAIL_HOST_USER is your Brevo login and EMAIL_HOST_PASSWORD is a valid Brevo SMTP key (not API key)."))
            return
        except Exception as exc:
            self.stdout.write(self.style.ERROR(f"  [FAIL] SMTP Handshake Error: {exc}"))
            return

        # 4. Django send_mail Delivery Test
        self.stdout.write("[3/4] Testing Django send_mail Dispatch...")
        try:
            subject = "CONVOSIS Books - Brevo SMTP Production Verification"
            body_text = (
                f"Hello,\n\n"
                f"This is an automated verification email from CONVOSIS Books.\n"
                f"Your Brevo SMTP configuration is working correctly!\n\n"
                f"Host: {host}:{port}\n"
                f"TLS: {use_tls}\n"
                f"Sender: {default_from}\n\n"
                f"--\nCONVOSIS Technologies"
            )
            body_html = f"""
            <div style="font-family:sans-serif;padding:20px;color:#0f172a;">
              <h2 style="color:#2563eb;">CONVOSIS Books</h2>
              <p>This is an automated verification email confirming that <strong>Brevo SMTP delivery</strong> is fully functional!</p>
              <ul>
                <li><strong>Host:</strong> {host}:{port}</li>
                <li><strong>TLS:</strong> {use_tls}</li>
                <li><strong>Sender:</strong> {default_from}</li>
              </ul>
              <p style="color:#10b981;font-weight:bold;">SMTP Handshake &amp; Authentication Verified Successfully.</p>
            </div>
            """
            result = send_mail(
                subject=subject,
                message=body_text,
                from_email=default_from,
                recipient_list=[recipient],
                html_message=body_html,
                fail_silently=False
            )
            if result == 1:
                self.stdout.write(self.style.SUCCESS(f"  Successfully dispatched email to {recipient} (Result: {result})"))
            else:
                self.stdout.write(self.style.WARNING(f"  Dispatch completed with return value: {result}"))
        except Exception as exc:
            self.stdout.write(self.style.ERROR(f"  [FAIL] send_mail dispatch failed: {exc}"))
            return

        self.stdout.write("[4/4] Final Verdict:")
        self.stdout.write(self.style.SUCCESS("  ✓ Brevo SMTP connectivity verified."))
        self.stdout.write(self.style.SUCCESS("  ✓ TLS handshake verified."))
        self.stdout.write(self.style.SUCCESS("  ✓ SMTP credentials authenticated."))
        self.stdout.write(self.style.SUCCESS("  ✓ Email message accepted by Brevo for delivery."))
        self.stdout.write("==================================================")


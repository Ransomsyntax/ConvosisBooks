from django.apps import AppConfig


class BooksConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'books'

    def ready(self):
        from django.contrib.auth.signals import user_logged_in, user_logged_out, user_login_failed
        from django.dispatch import receiver
        from .models import UserProfile
        from . import services

        @receiver(user_logged_in)
        def on_login(sender, request, user, **kwargs):
            try:
                profile, _ = UserProfile.objects.get_or_create(
                    user=user,
                    defaults={'role': UserProfile.ADMIN if (user.is_superuser or user.is_staff) else UserProfile.ACCOUNTANT}
                )
                ip = ''
                if request:
                    ip = request.META.get('HTTP_X_FORWARDED_FOR', '').split(',')[0].strip() or request.META.get('REMOTE_ADDR', '')
                if ip:
                    profile.last_active_ip = ip
                    profile.save(update_fields=['last_active_ip'])
                services.log_audit(user, 'login', 'User', user.pk, f"User {user.get_username()} logged in successfully", ip_address=ip)
            except Exception:
                pass

        @receiver(user_logged_out)
        def on_logout(sender, request, user, **kwargs):
            try:
                if user and user.is_authenticated:
                    ip = ''
                    if request:
                        ip = request.META.get('HTTP_X_FORWARDED_FOR', '').split(',')[0].strip() or request.META.get('REMOTE_ADDR', '')
                    services.log_audit(user, 'logout', 'User', user.pk, f"User {user.get_username()} signed out", ip_address=ip)
            except Exception:
                pass

        @receiver(user_login_failed)
        def on_login_failed(sender, credentials, request, **kwargs):
            try:
                username = credentials.get('username', '<unknown>') if isinstance(credentials, dict) else '<unknown>'
                ip = ''
                if request:
                    ip = request.META.get('HTTP_X_FORWARDED_FOR', '').split(',')[0].strip() or request.META.get('REMOTE_ADDR', '')
                services.log_audit(None, 'login_failed', 'User', 0, f"Failed login attempt for username '{username}'", ip_address=ip)
            except Exception:
                pass

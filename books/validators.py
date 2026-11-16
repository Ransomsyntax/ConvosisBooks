import re
from django.core.exceptions import ValidationError
from django.utils.translation import gettext as _


class StrongPasswordValidator:
    """
    Validate that the password meets the enterprise security policy:
    - Minimum 8 characters.
    - At least one uppercase letter (A-Z).
    - At least one lowercase letter (a-z).
    - At least one numeric digit (0-9).
    - At least one special character (!@#$%^&*...).
    """

    def validate(self, password, user=None):
        if not password:
            raise ValidationError(
                _("Password cannot be blank."),
                code='password_blank',
            )
        if len(password) < 8:
            raise ValidationError(
                _("Password must be at least 8 characters long."),
                code='password_too_short',
            )
        if not re.search(r'[A-Z]', password):
            raise ValidationError(
                _("Password must contain at least one uppercase letter."),
                code='password_no_upper',
            )
        if not re.search(r'[a-z]', password):
            raise ValidationError(
                _("Password must contain at least one lowercase letter."),
                code='password_no_lower',
            )
        if not re.search(r'[0-9]', password):
            raise ValidationError(
                _("Password must contain at least one number (0-9)."),
                code='password_no_digit',
            )
        if not re.search(r'[!@#$%^&*()_+\-=\[\]{};\':"\\|,.<>\/?~`]', password):
            raise ValidationError(
                _("Password must contain at least one special character (e.g. !@#$%^&*)."),
                code='password_no_special',
            )

    def get_help_text(self):
        return _(
            "Your password must be at least 8 characters long and contain at least "
            "one uppercase letter, one lowercase letter, one number, and one special character."
        )


def validate_strong_password(password, user=None):
    """
    Utility function to validate password strength directly.
    Raises ValidationError with a specific error message if invalid.
    """
    validator = StrongPasswordValidator()
    validator.validate(password, user=user)


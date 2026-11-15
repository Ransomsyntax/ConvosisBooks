import re
from django.core.exceptions import ValidationError
from django.utils.translation import gettext as _


class StrongPasswordValidator:
    """
    Validate that the password meets the minimum policy accepted by this application:
    - Minimum 8 characters.
    - At least one letter.
    - At least one numeric digit.
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
        if not re.search(r'[A-Za-z]', password):
            raise ValidationError(
                _("Password must contain at least one letter."),
                code='password_no_letter',
            )
        if not re.search(r'[0-9]', password):
            raise ValidationError(
                _("Password must contain at least one number (0-9)."),
                code='password_no_digit',
            )

    def get_help_text(self):
        return _(
            "Your password must be at least 8 characters long and contain at least "
            "one letter and one number."
        )


def validate_strong_password(password, user=None):
    """
    Utility function to validate password strength directly.
    Raises ValidationError with a specific error message if invalid.
    """
    validator = StrongPasswordValidator()
    validator.validate(password, user=user)


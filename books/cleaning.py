"""Input validation helpers that collect field errors instead of failing on the first one."""
import re
from datetime import date
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

from django.core.exceptions import ValidationError
from django.core.validators import validate_email

GSTIN_RE = re.compile(r'^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$')
PAN_RE = re.compile(r'^[A-Z]{5}\d{4}[A-Z]$')
PHONE_RE = re.compile(r'^[0-9+()\-\s]{7,20}$')
REQUIRED = 'This field is required.'


class ApiError(Exception):
    def __init__(self, status=400, message='Bad request.', errors=None):
        super().__init__(message)
        self.status = status
        self.message = message
        self.errors = errors or {}


class Cleaner:
    def __init__(self, data):
        self.d = data if isinstance(data, dict) else {}
        self.errors = {}

    def err(self, key, msg):
        self.errors.setdefault(key, msg)

    def done(self, message='Please correct the highlighted fields.'):
        if self.errors:
            raise ApiError(400, message, self.errors)

    def _blank(self, v):
        return v is None or (isinstance(v, str) and not v.strip())

    def text(self, key, required=False, max_len=255, default='', upper=False,
             pattern=None, pattern_msg='Invalid value.', email=False, phone=False):
        v = self.d.get(key)
        if self._blank(v):
            if required:
                self.err(key, REQUIRED)
            return default
        if isinstance(v, (dict, list, bool)):
            self.err(key, 'Invalid value.')
            return default
        v = str(v).strip()
        if upper:
            v = v.upper()
        if len(v) > max_len:
            self.err(key, f'Maximum {max_len} characters.')
            return default
        if pattern is not None and not pattern.match(v):
            self.err(key, pattern_msg)
            return default
        if email:
            try:
                validate_email(v)
            except ValidationError:
                self.err(key, 'Enter a valid email address.')
                return default
        if phone and not PHONE_RE.match(v):
            self.err(key, 'Enter a valid phone number.')
            return default
        return v

    def number(self, key, required=False, lo=None, hi=None, default=Decimal('0'), places=2):
        v = self.d.get(key)
        if self._blank(v):
            if required:
                self.err(key, REQUIRED)
            return default
        if isinstance(v, (bool, dict, list)):
            self.err(key, 'Enter a valid number.')
            return default
        try:
            n = Decimal(str(v).strip())
        except InvalidOperation:
            self.err(key, 'Enter a valid number.')
            return default
        if not n.is_finite():
            self.err(key, 'Enter a valid number.')
            return default
        if lo is not None and n < lo:
            self.err(key, f'Must be at least {lo}.')
            return default
        if hi is not None and n > hi:
            self.err(key, f'Must be at most {hi}.')
            return default
        return n.quantize(Decimal(1).scaleb(-places), rounding=ROUND_HALF_UP)

    def integer(self, key, lo=None, hi=None, default=None, required=False):
        v = self.d.get(key)
        if self._blank(v):
            if required:
                self.err(key, REQUIRED)
            return default
        if isinstance(v, (bool, dict, list)):
            self.err(key, 'Enter a whole number.')
            return default
        try:
            n = int(str(v).strip())
        except ValueError:
            self.err(key, 'Enter a whole number.')
            return default
        if (lo is not None and n < lo) or (hi is not None and n > hi):
            self.err(key, f'Must be between {lo} and {hi}.' if None not in (lo, hi) else 'Value out of range.')
            return default
        return n

    def date(self, key, required=False, default=None):
        v = self.d.get(key)
        if self._blank(v):
            if required:
                self.err(key, REQUIRED)
            return default
        try:
            d = date.fromisoformat(str(v).strip())
        except ValueError:
            self.err(key, 'Enter a valid date (YYYY-MM-DD).')
            return default
        if not 2000 <= d.year <= 2100:
            self.err(key, 'Date out of range.')
            return default
        return d

    def choice(self, key, choices, default=None, required=False):
        v = self.d.get(key)
        if self._blank(v):
            if required:
                self.err(key, REQUIRED)
            return default
        v = str(v).strip()
        if v not in choices:
            self.err(key, 'Invalid choice.')
            return default
        return v

    def boolean(self, key, default=False):
        v = self.d.get(key)
        if v is None:
            return default
        if isinstance(v, bool):
            return v
        if isinstance(v, str):
            return v.strip().lower() in ('1', 'true', 'on', 'yes')
        return bool(v)

import os
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent

# Auto-load .env file if present, safely stripping whitespace, quotes, and accidental bullets
env_file = BASE_DIR / '.env'
if env_file.is_file():
    try:
        with open(env_file, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#'):
                    continue
                # Strip leading bullet points or dash prefixes if present
                line = line.lstrip('•-* ').strip()
                if '=' in line:
                    key, val = line.split('=', 1)
                    key = key.strip()
                    val = val.strip().strip("'\"")
                    if key and key not in os.environ:
                        os.environ[key] = val
    except Exception:
        pass

is_render = bool(os.environ.get('RENDER') or os.environ.get('RENDER_SERVICE_ID') or os.environ.get('RENDER_EXTERNAL_HOSTNAME'))
default_debug = '0' if is_render else '1'
DEBUG = os.environ.get('DJANGO_DEBUG', default_debug) == '1'
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', '').strip()
if not SECRET_KEY:
    if not DEBUG:
        raise ImproperlyConfigured('Set DJANGO_SECRET_KEY when DJANGO_DEBUG=0.')
    SECRET_KEY = 'dev-only-insecure-key-change-me'

raw_hosts = os.environ.get('DJANGO_ALLOWED_HOSTS') or os.environ.get('ALLOWED_HOSTS') or 'localhost,127.0.0.1,testserver,convosisbooks.onrender.com,books-d8i1.onrender.com,api.convosis.com,convosis.com,www.convosis.com'
ALLOWED_HOSTS = []
for h in raw_hosts.replace(';', ',').split(','):
    h = h.strip()
    if h and h not in ALLOWED_HOSTS:
        ALLOWED_HOSTS.append(h)
render_host = os.environ.get('RENDER_EXTERNAL_HOSTNAME')
if render_host and render_host not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.append(render_host)

import socket

try:
    _container_ip = socket.gethostbyname(socket.gethostname())
    if _container_ip not in ALLOWED_HOSTS:
        ALLOWED_HOSTS.append(_container_ip)
except Exception:
    pass

raw_origins = os.environ.get('DJANGO_CSRF_TRUSTED_ORIGINS') or os.environ.get('CSRF_TRUSTED_ORIGINS') or 'https://convosisbooks.onrender.com,https://books-d8i1.onrender.com,https://api.convosis.com,https://convosis.com,https://www.convosis.com'
CSRF_TRUSTED_ORIGINS = []
for o in raw_origins.replace(';', ',').split(','):
    o = o.strip()
    if o:
        if not o.startswith(('http://', 'https://')):
            o = f"https://{o}"
        if o not in CSRF_TRUSTED_ORIGINS:
            CSRF_TRUSTED_ORIGINS.append(o)
if render_host:
    r_origin = f"https://{render_host}"
    if r_origin not in CSRF_TRUSTED_ORIGINS:
        CSRF_TRUSTED_ORIGINS.append(r_origin)

INSTALLED_APPS = [
    'books',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'books.middleware.AdminAccessAuditMiddleware',
    'books.middleware.PlatformSuperuserApiPrivacyMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]
try:
    import whitenoise
    MIDDLEWARE.insert(1, 'whitenoise.middleware.WhiteNoiseMiddleware')
except ImportError:
    pass

ROOT_URLCONF = 'config.urls'
WSGI_APPLICATION = 'config.wsgi.application'

TEMPLATES = [{
    'BACKEND': 'django.template.backends.django.DjangoTemplates',
    'DIRS': [],
    'APP_DIRS': True,
    'OPTIONS': {'context_processors': [
        'django.template.context_processors.debug',
        'django.template.context_processors.request',
        'django.contrib.auth.context_processors.auth',
        'django.contrib.messages.context_processors.messages',
    ]},
}]


DATABASE_URL = os.environ.get("DATABASE_URL")

if DATABASE_URL:
    try:
        import dj_database_url
        DATABASES = {
            "default": dj_database_url.config(
                default=DATABASE_URL,
                conn_max_age=600,
                ssl_require=os.environ.get(
                    "DATABASE_SSL_REQUIRE", "1" if is_render else "0"
                ) == "1",
            )
        }
    except ImportError:
        import urllib.parse
        parsed_db = urllib.parse.urlparse(DATABASE_URL)
        DATABASES = {
            "default": {
                "ENGINE": "django.db.backends.postgresql",
                "NAME": parsed_db.path.lstrip("/"),
                "USER": parsed_db.username or "postgres",
                "PASSWORD": parsed_db.password or "",
                "HOST": parsed_db.hostname or "localhost",
                "PORT": parsed_db.port or 5432,
            }
        }
elif os.environ.get("POSTGRES_DB") or os.environ.get("DB_NAME"):
    db_name = (os.environ.get("POSTGRES_DB") or os.environ.get("DB_NAME") or "").strip()
    db_user = (os.environ.get("POSTGRES_USER") or os.environ.get("DB_USER") or "postgres").strip()
    db_password = os.environ.get("POSTGRES_PASSWORD") or os.environ.get("DB_PASSWORD") or ""
    db_host = (os.environ.get("POSTGRES_HOST") or os.environ.get("DB_HOST") or "localhost").strip()
    db_port = (os.environ.get("POSTGRES_PORT") or os.environ.get("DB_PORT") or "5432").strip()
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": db_name,
            "USER": db_user,
            "PASSWORD": db_password,
            "HOST": db_host,
            "PORT": db_port,
        }
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
            "OPTIONS": {
                "timeout": 30,
            },
        }
    }

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'books.validators.StrongPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

def _parse_bool_env(val, default=False):
    if val is None or val == '':
        return default
    if isinstance(val, bool):
        return val
    return str(val).strip().lower() in ('1', 'true', 'yes', 'on', 't')

EMAIL_HOST = os.environ.get('EMAIL_HOST', '').strip()
EMAIL_PORT = int(os.environ.get('EMAIL_PORT', '587'))
EMAIL_HOST_USER = os.environ.get('EMAIL_HOST_USER', '').strip()
EMAIL_HOST_PASSWORD = os.environ.get('EMAIL_HOST_PASSWORD', '').strip()

# Port 587 requires STARTTLS (EMAIL_USE_TLS=True). Never enable SSL simultaneously.
raw_tls = os.environ.get('EMAIL_USE_TLS')
raw_ssl = os.environ.get('EMAIL_USE_SSL')

if EMAIL_PORT == 587:
    EMAIL_USE_TLS = True if raw_tls is None else _parse_bool_env(raw_tls, default=True)
    EMAIL_USE_SSL = False
elif EMAIL_PORT == 465:
    EMAIL_USE_TLS = False
    EMAIL_USE_SSL = True if raw_ssl is None else _parse_bool_env(raw_ssl, default=True)
else:
    EMAIL_USE_TLS = _parse_bool_env(raw_tls, default=False)
    EMAIL_USE_SSL = _parse_bool_env(raw_ssl, default=False)

EMAIL_TIMEOUT = int(os.environ.get('EMAIL_TIMEOUT', '15'))

# Verified sender address for transactional Brevo SMTP
configured_from = os.environ.get('DEFAULT_FROM_EMAIL', '').strip()
if not configured_from or 'localhost' in configured_from:
    configured_from = os.environ.get('BREVO_SENDER_EMAIL', '').strip()
if not configured_from:
    configured_from = 'CONVOSIS Books <no-reply@convosis.com>'

DEFAULT_FROM_EMAIL = configured_from
SERVER_EMAIL = os.environ.get('SERVER_EMAIL', '').strip() or DEFAULT_FROM_EMAIL

PASSWORD_RESET_EMAIL_CONFIGURED = bool(
    EMAIL_HOST and EMAIL_HOST_USER and EMAIL_HOST_PASSWORD
)
EMAIL_BACKEND = (
    'django.core.mail.backends.smtp.EmailBackend' if EMAIL_HOST
    else 'django.core.mail.backends.locmem.EmailBackend'
)
PASSWORD_RESET_TIMEOUT = int(os.environ.get('PASSWORD_RESET_TIMEOUT', '3600'))

# OTP, Brevo Email & MSG91 SMS Configuration
BREVO_API_KEY = os.environ.get('BREVO_API_KEY', '').strip()
BREVO_SENDER_EMAIL = os.environ.get('BREVO_SENDER_EMAIL', os.environ.get('DEFAULT_FROM_EMAIL', 'no-reply@convosis.com')).strip()
BREVO_SENDER_NAME = os.environ.get('BREVO_SENDER_NAME', 'CONVOSIS Books').strip()

MSG91_AUTH_KEY = os.environ.get('MSG91_AUTH_KEY', '').strip()
MSG91_TEMPLATE_ID = os.environ.get('MSG91_TEMPLATE_ID', '').strip()
MSG91_SENDER_ID = os.environ.get('MSG91_SENDER_ID', 'CONVOS').strip()
MSG91_OTP_EXPIRY_MINUTES = int(os.environ.get('MSG91_OTP_EXPIRY_MINUTES', '5'))

OTP_EXPIRY_MINUTES = int(os.environ.get('OTP_EXPIRY_MINUTES', '5'))
OTP_MAX_FAILED_ATTEMPTS = int(os.environ.get('OTP_MAX_FAILED_ATTEMPTS', '5'))
OTP_RESEND_COOLDOWN_SECONDS = int(os.environ.get('OTP_RESEND_COOLDOWN_SECONDS', '60'))
OTP_MAX_PER_HOUR = int(os.environ.get('OTP_MAX_PER_HOUR', '5'))

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Asia/Kolkata'
USE_I18N = True
USE_TZ = True

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.SessionAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
}

REDIS_URL = os.environ.get('REDIS_URL', '').strip()
if REDIS_URL:
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.redis.RedisCache',
            'LOCATION': REDIS_URL,
        },
    }
else:
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
            'LOCATION': 'convosibooks-local',
        },
    }

CELERY_BROKER_URL = os.environ.get(
    'CELERY_BROKER_URL', REDIS_URL or 'redis://127.0.0.1:6379/0'
)
CELERY_RESULT_BACKEND = os.environ.get(
    'CELERY_RESULT_BACKEND', REDIS_URL or 'redis://127.0.0.1:6379/0'
)
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = TIME_ZONE
CELERY_TASK_TRACK_STARTED = True

STATIC_URL = '/static/'
static_root_env = os.environ.get('STATIC_ROOT', '').strip()
STATIC_ROOT = Path(static_root_env) if static_root_env else (BASE_DIR / 'staticfiles')

try:
    import whitenoise
    STATICFILES_STORAGE = 'whitenoise.storage.CompressedStaticFilesStorage'
except ImportError:
    pass

MEDIA_URL = '/media/'
media_root_env = os.environ.get('MEDIA_ROOT', '').strip()
MEDIA_ROOT = Path(media_root_env) if media_root_env else (BASE_DIR / 'media')
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

LOGIN_URL = '/accounts/login/'
LOGIN_REDIRECT_URL = '/'
LOGOUT_REDIRECT_URL = '/accounts/login/'

if not DEBUG:
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_BROWSER_XSS_FILTER = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    X_FRAME_OPTIONS = 'DENY'
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    if os.environ.get('DJANGO_SECURE_SSL_REDIRECT', '0') == '1':
        SECURE_SSL_REDIRECT = True
    SECURE_HSTS_SECONDS = int(os.environ.get('DJANGO_SECURE_HSTS_SECONDS', '31536000'))
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True

SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = 'Lax'
SESSION_COOKIE_AGE = 86400
SESSION_SAVE_EVERY_REQUEST = True
SESSION_EXPIRE_AT_BROWSER_CLOSE = False

LLM_PROVIDER = os.environ.get('CONVOBOT_LLM_PROVIDER', 'openai')
LLM_MODEL = os.environ.get('CONVOBOT_LLM_MODEL', 'gpt-4o-mini')
LLM_API_KEY = os.environ.get('CONVOBOT_LLM_API_KEY', os.environ.get('OPENAI_API_KEY', ''))
LLM_API_BASE = os.environ.get('CONVOBOT_LLM_API_BASE', 'https://api.openai.com/v1').rstrip('/')
LLM_TIMEOUT = int(os.environ.get('CONVOBOT_LLM_TIMEOUT', '12'))

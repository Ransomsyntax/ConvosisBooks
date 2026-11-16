import os
import sys

# Get directory of this file
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))

# Determine project directory (supports both standalone apps/convosisbooks root on cPanel and nested layout)
if os.path.exists(os.path.join(CURRENT_DIR, "config", "settings.py")):
    PROJECT_DIR = CURRENT_DIR
else:
    REPO_ROOT = os.path.abspath(os.path.join(CURRENT_DIR, "..", ".."))
    PROJECT_DIR = REPO_ROOT if os.path.exists(os.path.join(REPO_ROOT, "config", "settings.py")) else CURRENT_DIR

# Add project directory to Python import path
if PROJECT_DIR not in sys.path:
    sys.path.insert(0, PROJECT_DIR)

# Configure Django settings
os.environ.setdefault(
    "DJANGO_SETTINGS_MODULE",
    "config.settings"
)

# Initialize Django WSGI application
from django.core.wsgi import get_wsgi_application

application = get_wsgi_application()

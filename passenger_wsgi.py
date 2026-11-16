import os
import sys

# Get the application root directory
PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))

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

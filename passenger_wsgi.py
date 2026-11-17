import os
import sys
import traceback

# 1. Project Directory & Module Paths
PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
if PROJECT_DIR not in sys.path:
    sys.path.insert(0, PROJECT_DIR)

# 2. Virtual Environment Detection & Activation
# Checks for standard cPanel/CloudLinux or custom virtualenv paths
virtual_env = os.environ.get('VIRTUAL_ENV')
if virtual_env and os.path.isdir(virtual_env):
    site_packages = os.path.join(
        virtual_env,
        'lib',
        f'python{sys.version_info.major}.{sys.version_info.minor}',
        'site-packages'
    )
    if os.path.isdir(site_packages) and site_packages not in sys.path:
        sys.path.insert(1, site_packages)

# 3. Configure Django Settings Module
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

# 4. Safe Startup Handler
def _sanitize_log_message(msg: str) -> str:
    """Mask potential passwords or sensitive tokens in exception logs."""
    import re
    masked = re.sub(r'(:\/\/[^:]+:)[^@]+(@)', r'\1*****\2', msg)
    masked = re.sub(r'(PASSWORD\s*[:=]\s*)[^\s,]+', r'\1*****', masked, flags=re.IGNORECASE)
    masked = re.sub(r'(SECRET_KEY\s*[:=]\s*)[^\s,]+', r'\1*****', masked, flags=re.IGNORECASE)
    return masked

try:
    from django.core.wsgi import get_wsgi_application
    application = get_wsgi_application()
except Exception as startup_exc:
    raw_tb = traceback.format_exc()
    sanitized_tb = _sanitize_log_message(raw_tb)
    
    # Log to passenger error file in project dir
    error_log_path = os.path.join(PROJECT_DIR, 'passenger_startup_error.log')
    try:
        with open(error_log_path, 'a', encoding='utf-8') as f:
            f.write(f"\n--- WSGI Startup Failure ({startup_exc.__class__.__name__}) ---\n")
            f.write(sanitized_tb)
            f.write("\n")
    except Exception:
        pass

    # Provide safe fallback WSGI callable that displays actionable diagnostics
    def application(environ, start_response):
        status = '500 Internal Server Error'
        headers = [('Content-Type', 'text/html; charset=utf-8')]
        start_response(status, headers)
        html = f"""<!DOCTYPE html>
<html>
<head>
    <title>ConvosisBooks - Application Startup Error</title>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; background: #f8f9fa; color: #212529; }}
        .card {{ max-width: 800px; margin: 0 auto; background: #ffffff; border: 1px solid #dee2e6; border-radius: 8px; padding: 24px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }}
        h1 {{ color: #dc3545; font-size: 20px; margin-top: 0; }}
        p {{ font-size: 14px; line-height: 1.5; }}
        pre {{ background: #212529; color: #f8f9fa; padding: 16px; border-radius: 6px; overflow-x: auto; font-size: 13px; line-height: 1.4; }}
        .hint {{ background: #e7f1ff; border-left: 4px solid #0d6efd; padding: 12px; margin-top: 16px; font-size: 13px; }}
    </style>
</head>
<body>
    <div class="card">
        <h1>ConvosisBooks WSGI Startup Error</h1>
        <p>The application encountered an exception during Passenger WSGI initialization.</p>
        <pre>{sanitized_tb}</pre>
        <div class="hint">
            <strong>Troubleshooting Checklist:</strong>
            <ul>
                <li>Verify the Python virtualenv is selected in cPanel "Setup Python App".</li>
                <li>Verify <code>requirements.txt</code> dependencies are installed in the venv.</li>
                <li>Check PostgreSQL connection parameters (<code>POSTGRES_DB</code>, <code>POSTGRES_USER</code>, <code>POSTGRES_HOST</code>, <code>POSTGRES_PORT</code>).</li>
                <li>Check <code>passenger_startup_error.log</code> in the application root directory.</li>
            </ul>
        </div>
    </div>
</body>
</html>"""
        return [html.encode('utf-8')]

# ConvosisBooks

A financial operating system and accounting web application built with Django, featuring glassmorphism design aesthetics and Zoho Books-style item management.

## Stack migration foundation

The backend targets Python 3.12 and Django 5.2 LTS. The existing Django-served
JavaScript application and its API routes remain active while the React 19 and
DRF migrations proceed incrementally. A minimal React entry point is built to
`/static/books/react/`; existing screens are not replaced by this foundation.

The container stack uses PostgreSQL 17, Redis, Celery, Gunicorn, and Nginx:

1. Copy `.env.example` to `.env` and replace its local-only values.
2. Run `docker compose up --build`.
3. Open `http://localhost/`. The React foundation is available at
   `/static/books/react/index.html`.

The existing Render deployment remains unchanged. The Docker Compose stack is
the initial deployment path for the requested Nginx/PostgreSQL/Redis services.

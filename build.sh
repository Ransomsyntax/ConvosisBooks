#!/usr/bin/env bash
# exit on error
set -o errexit

pip install -r requirements.txt
cd frontend
npm ci
npm run build
cd ..
python manage.py check
python manage.py migrate --noinput
python manage.py collectstatic --noinput


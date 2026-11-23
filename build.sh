#!/usr/bin/env bash
# exit on error
set -o errexit

pip install -r requirements.txt
cd frontend
npm ci
npm run build
cd ..
python manage.py collectstatic --noinput
python manage.py migrate --noinput


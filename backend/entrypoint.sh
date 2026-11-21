#!/bin/sh
set -e

echo "Waiting for PostgreSQL/PostGIS at ${POSTGRES_HOST:-db}:${POSTGRES_PORT:-5432}..."
python - <<'END'
import os, socket, time

host = os.environ.get("POSTGRES_HOST", "db")
port = int(os.environ.get("POSTGRES_PORT", "5432"))

for _ in range(60):
    try:
        with socket.create_connection((host, port), timeout=2):
            break
    except OSError:
        time.sleep(1)
else:
    raise SystemExit("Timed out waiting for PostgreSQL/PostGIS.")
END

echo "Ensuring PostGIS extensions..."
python manage.py ensure_postgis || true

echo "Applying migrations..."
python manage.py makemigrations --noinput
python manage.py migrate --noinput

if [ "${GOWAR_ENABLE_DEMO_SEED:-false}" = "true" ]; then
  echo "Seeding development demo data (idempotent)..."
  python manage.py seed_gowar
fi

exec "$@"

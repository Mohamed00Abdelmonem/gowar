#!/bin/sh
set -e

if [ "${WAIT_FOR_DB:-true}" = "true" ]; then
  echo "Waiting for PostgreSQL/PostGIS at ${POSTGRES_HOST:-gowar-db}:${POSTGRES_PORT:-5432}..."
  python - <<'END'
import os, socket, sys, time

host = os.environ.get("POSTGRES_HOST", "gowar-db")
port = int(os.environ.get("POSTGRES_PORT", "5432"))
timeout = int(os.environ.get("DB_WAIT_TIMEOUT", "60"))

for _ in range(timeout):
    try:
        with socket.create_connection((host, port), timeout=2):
            sys.exit(0)
    except OSError:
        time.sleep(1)

print(f"ERROR: Timed out waiting for PostgreSQL/PostGIS at {host}:{port}", file=sys.stderr)
sys.exit(1)
END
fi

exec "$@"

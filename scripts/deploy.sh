#!/usr/bin/env bash
set -euo pipefail

# Safe production deployment script for Gowar on Contabo VPS.
# Usage:
#   ./scripts/deploy.sh                      # Uses images configured in .env or local build
#   ./scripts/deploy.sh <image_tag> <prefix> # Pulls <prefix>-backend:<tag> and <prefix>-frontend:<tag>

APP_DIR="${APP_DIR:-/opt/gowar}"
ENV_FILE="${GOWAR_ENV_FILE:-${APP_DIR}/.env}"
COMPOSE_FILE="${APP_DIR}/docker-compose.prod.yml"
IMAGE_TAG="${1:-}"
IMAGE_PREFIX="${2:-}"

if [ ! -f "${ENV_FILE}" ]; then
  echo "ERROR: Environment file not found at ${ENV_FILE}" >&2
  exit 1
fi

if [ ! -f "${COMPOSE_FILE}" ]; then
  echo "ERROR: Compose file not found at ${COMPOSE_FILE}" >&2
  exit 1
fi

if ! docker network inspect gowar_db_net >/dev/null 2>&1; then
  echo "ERROR: Required external Docker network 'gowar_db_net' does not exist." >&2
  exit 1
fi

if ! docker inspect -f '{{.State.Running}}' gowar-db 2>/dev/null | grep -q true; then
  echo "ERROR: Existing database container 'gowar-db' is not running." >&2
  exit 1
fi

if [ -n "${IMAGE_TAG}" ] && [ -n "${IMAGE_PREFIX}" ]; then
  export GOWAR_BACKEND_IMAGE="${IMAGE_PREFIX}-backend:${IMAGE_TAG}"
  export GOWAR_FRONTEND_IMAGE="${IMAGE_PREFIX}-frontend:${IMAGE_TAG}"
  echo "Pulling production images for tag ${IMAGE_TAG}..."
  docker pull "${GOWAR_BACKEND_IMAGE}"
  docker pull "${GOWAR_FRONTEND_IMAGE}"
fi

export GOWAR_ENV_FILE="${ENV_FILE}"

echo "Verifying PostGIS extension on existing gowar-db..."
docker compose -f "${COMPOSE_FILE}" run --rm --no-deps backend python manage.py ensure_postgis

echo "Running safe Django database migrations (no destructive reset)..."
docker compose -f "${COMPOSE_FILE}" run --rm --no-deps backend python manage.py migrate --noinput

echo "Ensuring non-root permissions (1000:1000) on persistent media and static volumes..."
docker compose -f "${COMPOSE_FILE}" run --rm --no-deps --user 0 --entrypoint sh backend -c "chown -R 1000:1000 /app/media /app/staticfiles"

echo "Collecting Django static files..."
docker compose -f "${COMPOSE_FILE}" run --rm --no-deps backend python manage.py collectstatic --noinput

echo "Starting updated application containers..."
docker compose -f "${COMPOSE_FILE}" up -d --remove-orphans

echo "Waiting for application health check..."
APP_PORT="$(grep -E '^APP_BIND_PORT=' "${ENV_FILE}" | tail -n1 | cut -d= -f2 || true)"
APP_PORT="${APP_PORT:-8080}"

for i in $(seq 1 20); do
  if curl -fsS -H "X-Forwarded-Proto: https" "http://127.0.0.1:${APP_PORT}/health/" >/dev/null 2>&1; then
    echo "Health check passed!"
    if [ -n "${IMAGE_TAG}" ] && [ -n "${IMAGE_PREFIX}" ]; then
      echo "${IMAGE_TAG} ${IMAGE_PREFIX}" > "${APP_DIR}/.last_good_release"
    fi
    docker compose -f "${COMPOSE_FILE}" ps
    exit 0
  fi
  sleep 2
done

echo "ERROR: Health check failed after deployment. Inspecting backend logs:" >&2
docker compose -f "${COMPOSE_FILE}" logs --tail=50 backend >&2
exit 1

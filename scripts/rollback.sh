#!/usr/bin/env bash
set -euo pipefail

# Roll back Gowar containers to a previous Docker image tag (does NOT modify DB data).
# Usage:
#   ./scripts/rollback.sh <previous_sha_tag> <ghcr_prefix>

APP_DIR="${APP_DIR:-/opt/gowar}"
ENV_FILE="${GOWAR_ENV_FILE:-${APP_DIR}/.env}"
COMPOSE_FILE="${APP_DIR}/docker-compose.prod.yml"
TARGET_TAG="${1:-}"
IMAGE_PREFIX="${2:-}"

if [ -z "${TARGET_TAG}" ] || [ -z "${IMAGE_PREFIX}" ]; then
  if [ -f "${APP_DIR}/.last_good_release" ]; then
    read -r TARGET_TAG IMAGE_PREFIX < "${APP_DIR}/.last_good_release"
    echo "Using last recorded good release: ${IMAGE_PREFIX}:* (${TARGET_TAG})"
  else
    echo "Usage: $0 <previous_sha_tag> <ghcr_prefix>" >&2
    exit 1
  fi
fi

export GOWAR_ENV_FILE="${ENV_FILE}"
export GOWAR_BACKEND_IMAGE="${IMAGE_PREFIX}-backend:${TARGET_TAG}"
export GOWAR_FRONTEND_IMAGE="${IMAGE_PREFIX}-frontend:${TARGET_TAG}"

echo "Pulling rollback images..."
docker pull "${GOWAR_BACKEND_IMAGE}"
docker pull "${GOWAR_FRONTEND_IMAGE}"

echo "Restarting containers with rollback images..."
docker compose -f "${COMPOSE_FILE}" up -d --no-build --remove-orphans

echo "Verifying health endpoint..."
APP_PORT="$(grep -E '^APP_BIND_PORT=' "${ENV_FILE}" | tail -n1 | cut -d= -f2 || true)"
APP_PORT="${APP_PORT:-8080}"
sleep 5
curl -fsS -H "X-Forwarded-Proto: https" "http://127.0.0.1:${APP_PORT}/health/"
echo ""
echo "Rollback to ${TARGET_TAG} completed."

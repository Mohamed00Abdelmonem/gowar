#!/usr/bin/env bash
set -euo pipefail

# Safe restore script for Gowar PostgreSQL/PostGIS database and media volume.
# Requires explicit --confirm-restore flag to prevent accidental data loss.
#
# Usage:
#   ./scripts/restore.sh /opt/gowar/backups/<TIMESTAMP> --confirm-restore

BACKUP_DIR="${1:-}"
CONFIRM="${2:-}"
APP_DIR="${APP_DIR:-/opt/gowar}"
ENV_FILE="${GOWAR_ENV_FILE:-${APP_DIR}/.env}"

if [ -z "${BACKUP_DIR}" ] || [ "${CONFIRM}" != "--confirm-restore" ]; then
  echo "Usage: $0 /opt/gowar/backups/<TIMESTAMP> --confirm-restore" >&2
  echo "Refusing to run without explicit --confirm-restore safeguard." >&2
  exit 1
fi

if [ ! -d "${BACKUP_DIR}" ]; then
  echo "ERROR: Backup directory not found: ${BACKUP_DIR}" >&2
  exit 1
fi

if [ -f "${BACKUP_DIR}/SHA256SUMS" ]; then
  echo "Verifying SHA256 checksums..."
  (cd "${BACKUP_DIR}" && sha256sum -c SHA256SUMS)
fi

POSTGRES_DB="$(grep -E '^POSTGRES_DB=' "${ENV_FILE}" | tail -n1 | cut -d= -f2)"
POSTGRES_USER="$(grep -E '^POSTGRES_USER=' "${ENV_FILE}" | tail -n1 | cut -d= -f2)"
POSTGRES_DB="${POSTGRES_DB:-gowar_db}"
POSTGRES_USER="${POSTGRES_USER:-gowar_user}"

DB_DUMP_FILE="$(ls "${BACKUP_DIR}"/gowar_db_*.sql.gz 2>/dev/null | head -n1 || true)"
MEDIA_ARCHIVE="$(ls "${BACKUP_DIR}"/gowar_media_*.tar.gz 2>/dev/null | head -n1 || true)"

if [ -n "${DB_DUMP_FILE}" ]; then
  echo "Restoring PostgreSQL/PostGIS database (${POSTGRES_DB}) from ${DB_DUMP_FILE}..."
  gunzip -c "${DB_DUMP_FILE}" | docker exec -i gowar-db psql -v ON_ERROR_STOP=1 -U "${POSTGRES_USER}" -d "${POSTGRES_DB}"
fi

if [ -n "${MEDIA_ARCHIVE}" ]; then
  echo "Restoring media volume (gowar_media) from ${MEDIA_ARCHIVE}..."
  docker volume create gowar_media >/dev/null
  docker run --rm \
    -v gowar_media:/target \
    -v "${BACKUP_DIR}:/backup:ro" \
    alpine:3.20 \
    sh -c "tar -xzf /backup/$(basename "${MEDIA_ARCHIVE}") -C /target"
fi

echo "Restore completed. Run ./scripts/deploy.sh or restart containers and verify /health/."

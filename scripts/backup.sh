#!/usr/bin/env bash
set -euo pipefail

# Safe production backup script for Gowar:
#   1. Dumps existing PostgreSQL/PostGIS database from gowar-db container (custom format + gzip).
#   2. Archives persistent gowar_media Docker volume.
#   3. Verifies archive integrity and writes SHA256 checksums.
#   4. Prunes backups older than BACKUP_RETENTION_DAYS (default: 14).

APP_DIR="${APP_DIR:-/opt/gowar}"
ENV_FILE="${GOWAR_ENV_FILE:-${APP_DIR}/.env}"
BACKUP_ROOT="${BACKUP_ROOT:-/opt/gowar/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
TARGET_DIR="${BACKUP_ROOT}/${TIMESTAMP}"

if [ ! -f "${ENV_FILE}" ]; then
  echo "ERROR: Environment file not found at ${ENV_FILE}" >&2
  exit 1
fi

POSTGRES_DB="$(grep -E '^POSTGRES_DB=' "${ENV_FILE}" | tail -n1 | cut -d= -f2)"
POSTGRES_USER="$(grep -E '^POSTGRES_USER=' "${ENV_FILE}" | tail -n1 | cut -d= -f2)"
POSTGRES_DB="${POSTGRES_DB:-gowar_db}"
POSTGRES_USER="${POSTGRES_USER:-gowar_user}"

mkdir -p "${TARGET_DIR}"
chmod 700 "${BACKUP_ROOT}" "${TARGET_DIR}"

echo "[1/4] Backing up PostgreSQL/PostGIS database (${POSTGRES_DB}) from gowar-db..."
DB_DUMP_FILE="${TARGET_DIR}/gowar_db_${TIMESTAMP}.sql.gz"
docker exec gowar-db pg_dump \
  -U "${POSTGRES_USER}" \
  -d "${POSTGRES_DB}" \
  --no-owner \
  --no-privileges \
  | gzip -9 > "${DB_DUMP_FILE}"

echo "[2/4] Backing up persistent media volume (gowar_media)..."
MEDIA_ARCHIVE="${TARGET_DIR}/gowar_media_${TIMESTAMP}.tar.gz"
if docker volume inspect gowar_media >/dev/null 2>&1; then
  docker run --rm \
    -v gowar_media:/source:ro \
    -v "${TARGET_DIR}:/backup" \
    alpine:3.20 \
    tar -czf "/backup/gowar_media_${TIMESTAMP}.tar.gz" -C /source .
else
  echo "WARN: Volume gowar_media does not exist yet; skipping media archive."
fi

echo "[3/4] Verifying backup integrity and generating SHA256 checksums..."
gzip -t "${DB_DUMP_FILE}"
if [ -f "${MEDIA_ARCHIVE}" ]; then
  tar -tzf "${MEDIA_ARCHIVE}" >/dev/null
fi
(cd "${TARGET_DIR}" && sha256sum * > SHA256SUMS)

echo "[4/4] Pruning backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_ROOT}" -mindepth 1 -maxdepth 1 -type d -mtime "+${RETENTION_DAYS}" -exec rm -rf {} +

echo "Backup completed and verified at: ${TARGET_DIR}"
ls -lh "${TARGET_DIR}"

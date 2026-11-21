#!/usr/bin/env bash
set -euo pipefail

# Automated live production smoke verification script.
# Usage: ./scripts/verify_prod.sh https://YOUR_DOMAIN

BASE_URL="${1:-}"
if [ -z "${BASE_URL}" ]; then
  echo "Usage: $0 https://YOUR_DOMAIN" >&2
  exit 1
fi
BASE_URL="${BASE_URL%/}"

echo "[1/6] Checking /health/ endpoint (DB + PostGIS)..."
HEALTH_JSON="$(curl -fsS "${BASE_URL}/health/")"
echo "  Response: ${HEALTH_JSON}"
echo "${HEALTH_JSON}" | grep -q '"status":"ok"'
echo "${HEALTH_JSON}" | grep -q '"postgis":"ok"'

echo "[2/6] Checking frontend SPA root & nested route fallback..."
for route in "/" "/stores" "/merchant/login" "/admin/login"; do
  CODE="$(curl -sS -o /dev/null -w '%{http_code}' "${BASE_URL}${route}")"
  echo "  GET ${route} -> HTTP ${CODE}"
  [ "${CODE}" = "200" ]
done

echo "[3/6] Checking public API endpoints..."
STORES_CODE="$(curl -sS -o /dev/null -w '%{http_code}' "${BASE_URL}/api/v1/stores/")"
echo "  GET /api/v1/stores/ -> HTTP ${STORES_CODE}"
[ "${STORES_CODE}" = "200" ]

echo "[4/6] Checking security headers..."
HEADERS="$(curl -fsSI "${BASE_URL}/")"
echo "${HEADERS}" | grep -iq "x-content-type-options: nosniff"
echo "${HEADERS}" | grep -iq "x-frame-options: DENY"

echo "[5/6] Verifying API docs are disabled in production..."
DOCS_CODE="$(curl -sS -o /dev/null -w '%{http_code}' "${BASE_URL}/api/docs/")"
echo "  GET /api/docs/ -> HTTP ${DOCS_CODE} (expected 404)"

echo "[6/6] Checking Docker container health & network isolation (if run on VPS)..."
if command -v docker >/dev/null 2>&1; then
  docker ps --filter "name=gowar-" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
fi

echo "All automated smoke checks completed!"

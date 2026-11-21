# Gowar Production Verification Checklist

Use this checklist before opening production traffic to customers and merchants.

## 1. Backend & Security
- [ ] `DJANGO_SETTINGS_MODULE=config.settings.prod` and `DEBUG=False`
- [ ] Strong unique `SECRET_KEY` (no placeholder/default)
- [ ] `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, and `CSRF_TRUSTED_ORIGINS` set to real `https://YOUR_DOMAIN`
- [ ] `GET https://YOUR_DOMAIN/health/` returns `200` with `{"status":"ok","checks":{"database":"ok","postgis":"ok"}}`
- [ ] `/api/docs/` and `/api/schema/` return `404` (disabled by default via `GOWAR_ENABLE_API_DOCS=False`)
- [ ] Gunicorn running as non-root user `gowar` (never Django `runserver`)
- [ ] No demo accounts or `GOWAR_ENABLE_DEMO_SEED` active in production
- [ ] Real production superuser created via `manage.py createsuperuser`

## 2. Database & PostGIS Safety
- [ ] Existing `gowar-db` container and `gowar_pgdata` volume untouched
- [ ] PostGIS extension verified (`SELECT PostGIS_Version();`)
- [ ] Migrations applied cleanly (`python manage.py showmigrations` has no unapplied migrations)
- [ ] PostgreSQL port `5432` is NOT publicly accessible (`ss -tulpn | grep 5432` shows no `0.0.0.0:5432`)
- [ ] Daily backup cron running `/opt/gowar/scripts/backup.sh`
- [ ] Backup archive verified (`SHA256SUMS` passes) and restore tested on a staging/scratch DB

## 3. Frontend & Routing
- [ ] Production bundle built with `VITE_API_BASE_URL=/api/v1` and `VITE_USE_BACKEND_API=true`
- [ ] Direct browser refresh works on nested routes: `/stores`, `/merchant/login`, `/admin/login`, `/orders`
- [ ] Customer login/register, nearby store discovery, cart, and order creation/cancellation work over HTTPS
- [ ] Merchant login, product image upload, store logo/cover upload, and inventory updates work over HTTPS
- [ ] Uploaded images load via `https://YOUR_DOMAIN/media/...` and survive `docker compose -f docker-compose.prod.yml restart`
- [ ] Admin login and merchant approval/analytics workflows work over HTTPS

## 4. Infrastructure & Nginx
- [ ] `sudo nginx -t` passes with zero errors
- [ ] HTTP (`:80`) redirects to HTTPS (`:443`) with `301`
- [ ] Valid Let's Encrypt certificate and `sudo certbot renew --dry-run` passes
- [ ] Security headers present (`Strict-Transport-Security`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`)
- [ ] Backend port `8000` is NOT publicly exposed (`ss -tulpn | grep 8000` shows nothing on `0.0.0.0`)
- [ ] `gowar-frontend` is NOT attached to `gowar_db_net` (`docker inspect gowar-frontend --format '{{json .NetworkSettings.Networks}}'`)
- [ ] `docker compose -f docker-compose.prod.yml ps` shows both containers `healthy`
- [ ] Logs accessible via `docker compose -f docker-compose.prod.yml logs --tail=100`

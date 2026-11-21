# Gowar Production Deployment Guide (Contabo VPS — Ubuntu 22.04)

This guide deploys **Gowar** cleanly inside Docker containers on your Ubuntu 22.04 Contabo VPS (4 vCPU, 7.8 GB RAM, 97 GB disk) while **preserving your existing `gowar-db` PostgreSQL/PostGIS container, `gowar_pgdata` volume, and `gowar_db_net` internal network**.

No Python, Node.js, or Django packages are installed on the host — only Docker, Docker Compose, Nginx, and Certbot.

---

## Architecture

```text
Internet (HTTPS :443 / HTTP :80)
   |
Host Nginx + Let's Encrypt Certbot
   | (proxy_pass http://127.0.0.1:8080)
gowar-frontend container (Nginx + compiled React SPA) [gowar_app_net ONLY]
   |-- /               -> React SPA (with nested-route fallback)
   |-- /assets/        -> Immutable hashed JS/CSS assets
   |-- /static/        -> Collected Django static files (gowar_static volume, ro)
   |-- /media/         -> Persistent uploaded images (gowar_media volume, ro)
   |-- /api/           -> Reverse proxy to gowar-backend:8000
   |-- /django-admin/  -> Reverse proxy to gowar-backend:8000
   |-- /health/        -> Reverse proxy to gowar-backend:8000
   |
gowar-backend container (Gunicorn + Django 5.1 + GeoDjango) [gowar_app_net + gowar_db_net]
   |
gowar-db container (existing PostgreSQL 16 + PostGIS 3.4) [gowar_db_net ONLY]
```

---

## 1. Configure DNS Records

Create the following DNS records pointing to your Contabo VPS public IPv4 address (`YOUR_VPS_IP`):

| Type | Name | Value | TTL |
|---|---|---|---|
| `A` | `@` (or `YOUR_DOMAIN`) | `YOUR_VPS_IP` | 300 |
| `A` | `www` | `YOUR_VPS_IP` | 300 |

Verify propagation before requesting TLS certificates:

```bash
dig +short YOUR_DOMAIN
dig +short www.YOUR_DOMAIN
```

---

## 2. Prepare VPS Directory & Verify Existing Database

SSH into your Contabo VPS and verify that `gowar-db` and `gowar_db_net` are healthy (do **not** recreate or reset them):

```bash
mkdir -p /opt/gowar/scripts /opt/gowar/nginx /opt/gowar/backups
docker ps --filter "name=gowar-db"
docker network inspect gowar_db_net --format '{{.Name}} internal={{.Internal}}'
```

---

## 3. Upload Deployment Files or Clone Repository

Copy `docker-compose.prod.yml`, `scripts/`, `nginx/`, and `.env.production.example` to `/opt/gowar/` (or clone your GitHub repo into `/opt/gowar/`):

```bash
cd /opt/gowar
chmod +x scripts/*.sh
```

---

## 4. Configure Production Environment (`/opt/gowar/.env`)

Preserve your existing `POSTGRES_DB`, `POSTGRES_USER`, and `POSTGRES_PASSWORD` already in `/opt/gowar/.env`. Merge in the required Django/production variables from `.env.production.example`:

```bash
# Generate a strong 64-character SECRET_KEY (uses python3 or openssl)
openssl rand -base64 48
```

Ensure `/opt/gowar/.env` contains at minimum:

```env
DJANGO_SETTINGS_MODULE=config.settings.prod
SECRET_KEY=<generated-random-secret>
DEBUG=False
TIME_ZONE=Africa/Cairo

ALLOWED_HOSTS=YOUR_DOMAIN,www.YOUR_DOMAIN
CORS_ALLOWED_ORIGINS=https://YOUR_DOMAIN,https://www.YOUR_DOMAIN
CSRF_TRUSTED_ORIGINS=https://YOUR_DOMAIN,https://www.YOUR_DOMAIN

SECURE_SSL_REDIRECT=True
GOWAR_ENABLE_API_DOCS=False

# Existing gowar-db settings (DO NOT change password unless DB user matches)
POSTGRES_DB=gowar_db
POSTGRES_USER=gowar_user
POSTGRES_PASSWORD=<your-existing-db-password>
POSTGRES_HOST=gowar-db
POSTGRES_PORT=5432

APP_BIND_PORT=8080
GOWAR_ENV_FILE=/opt/gowar/.env
GOWAR_BACKEND_IMAGE=ghcr.io/<github-owner>/<repo>-backend:latest
GOWAR_FRONTEND_IMAGE=ghcr.io/<github-owner>/<repo>-frontend:latest
```

Lock down permissions:

```bash
chmod 600 /opt/gowar/.env
```

---

## 5. Pull Images, Run Safe Migrations, Collect Static & Start Containers

If using private GHCR images, log in once on the VPS:

```bash
echo "<GHCR_READ_TOKEN>" | docker login ghcr.io -u "<GITHUB_USERNAME>" --password-stdin
```

Run the deployment script (this verifies PostGIS, runs `migrate --noinput` safely, runs `collectstatic --noinput`, starts `gowar-backend` and `gowar-frontend`, and verifies `/health/`):

```bash
cd /opt/gowar
./scripts/deploy.sh <commit-sha-tag> ghcr.io/<github-owner>/<repo>
```

Or if building directly on the VPS from the cloned repository:

```bash
cd /opt/gowar
docker compose -f docker-compose.prod.yml build
./scripts/deploy.sh
```

Create your first real production superuser (only once, interactively):

```bash
docker compose -f /opt/gowar/docker-compose.prod.yml exec backend python manage.py createsuperuser
```

---

## 6. Configure Host Nginx & Firewall

Install Nginx and Certbot on Ubuntu 22.04:

```bash
sudo apt-get update
sudo apt-get install -y nginx certbot python3-certbot-nginx
sudo mkdir -p /var/www/certbot
```

Copy the HTTP bootstrap config and replace `YOUR_DOMAIN`:

```bash
sudo cp /opt/gowar/nginx/host-http.conf.example /etc/nginx/sites-available/gowar
sudo sed -i 's/YOUR_DOMAIN/example.com/g' /etc/nginx/sites-available/gowar
sudo ln -sf /etc/nginx/sites-available/gowar /etc/nginx/sites-enabled/gowar
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

Verify firewall allows only SSH, HTTP, and HTTPS (never 5432 or 8000):

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw status
```

---

## 7. Enable HTTPS with Let's Encrypt / Certbot

Request and install your SSL certificate:

```bash
sudo certbot certonly --webroot -w /var/www/certbot -d YOUR_DOMAIN -d www.YOUR_DOMAIN --email admin@YOUR_DOMAIN --agree-tos --no-eff-email
```

Switch to the full hardened HTTPS Nginx config:

```bash
sudo cp /opt/gowar/nginx/host-https.conf.example /etc/nginx/sites-available/gowar
sudo sed -i 's/YOUR_DOMAIN/example.com/g' /etc/nginx/sites-available/gowar
sudo nginx -t && sudo systemctl reload nginx
```

Verify automatic certificate renewal:

```bash
sudo systemctl status certbot.timer
sudo certbot renew --dry-run
```

Add a renewal deploy hook so Nginx reloads automatically after certificate renewal:

```bash
echo -e '#!/bin/sh\nsystemctl reload nginx' | sudo tee /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
sudo chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
```

---

## 8. Verify Deployment

Run the automated verification script:

```bash
./scripts/verify_prod.sh https://YOUR_DOMAIN
```

Or check manually:

```bash
curl -fsS https://YOUR_DOMAIN/health/
# Expected: {"status":"ok","service":"gowar-backend","checks":{"database":"ok","postgis":"ok"}}
```

---

## 9. Automated Backups & Restore

Schedule daily backups (PostgreSQL/PostGIS + `gowar_media` volume + SHA256 verification) via root cron:

```bash
(crontab -l 2>/dev/null; echo "0 3 * * * /opt/gowar/scripts/backup.sh >> /var/log/gowar-backup.log 2>&1") | crontab -
```

Run a manual backup and verify integrity:

```bash
/opt/gowar/scripts/backup.sh
```

Restore from a verified backup (requires explicit `--confirm-restore`):

```bash
/opt/gowar/scripts/restore.sh /opt/gowar/backups/<TIMESTAMP> --confirm-restore
```

---

## 10. Rollback Procedure

To roll back to a previous release without touching database data:

```bash
cd /opt/gowar
./scripts/rollback.sh sha-<previous-12-char-sha> ghcr.io/<github-owner>/<repo>
```

---

## 11. GitHub Actions CI/CD Secrets

Configure these Repository Secrets in GitHub (`Settings -> Secrets and variables -> Actions`):

| Secret | Description |
|---|---|
| `VPS_HOST` | Contabo VPS public IP or hostname |
| `VPS_USER` | SSH user with Docker access (e.g. `deploy` or `root`) |
| `VPS_SSH_KEY` | Private SSH key authorized in `~/.ssh/authorized_keys` on the VPS |
| `VPS_PORT` | SSH port (default `22`) |
| `GHCR_USERNAME` | GitHub username (required if GHCR packages are private) |
| `GHCR_READ_TOKEN` | GitHub PAT with `read:packages` scope (required if GHCR packages are private) |

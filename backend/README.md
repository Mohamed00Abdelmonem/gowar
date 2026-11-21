# Gowar Backend — Django, DRF, PostgreSQL & PostGIS

Production-ready modular monolith backend for **Gowar (جوار)**, Egypt's multi-vendor neighborhood grocery marketplace.

## 1. Architecture Overview

- **Framework:** Django 5.1 + Django REST Framework + Simple JWT + drf-spectacular (OpenAPI/Swagger)
- **Geospatial Engine:** PostgreSQL 16 + PostGIS 3.4 + GeoDjango (`WGS84 SRID 4326` `PointField(geography=True, spatial_index=True)`)
- **Modules (`apps/`):**
  - `accounts`: Custom `User` (`UUID`, `email`, `phone_number`, `role`: `customer | merchant | admin`), JWT login/refresh/logout blacklist, registration, password reset.
  - `locations`: Egyptian neighborhoods (`Area`), `CustomerProfile` (`search_radius_km` 1..20 default 3 KM), and `CustomerAddress` (`PointField` synced with lat/lng).
  - `merchants`: `MerchantProfile` approval workflow (`pending`, `approved`, `rejected`, `suspended`).
  - `stores`: Multi-store `Store` models with PostGIS `location`, independent `delivery_radius_km`, and database-level spatial `GET /api/v1/stores/nearby/`.
  - `catalog`: `Category`, `Product` (store-specific prices, discounts, SKUs, barcodes), `ProductImage`.
  - `inventory`: Atomic stock updates (`select_for_update()`) & idempotent `InventoryMovement` ledger.
  - `cart`: Persistent single-store `Cart` enforcing explicit `409 STORE_CONFLICT` across different stores.
  - `orders`: Atomic `Order`, `OrderItem` snapshots, `OrderStatusHistory`, strict server-side transition machine & cancellation restocking.
  - `payments`: Extensible `PaymentTransaction` (`cod` Cash on Delivery).
  - `commissions`: Decimal-precision `CommissionRecord` & `RefundRecord` ledger (EGP).
  - `reviews`, `notifications`, `platform_settings`, `analytics` (SQL aggregations for Merchant & Super Admin reports).

## 2. Environment Setup & Running with Docker Compose

### Windows PowerShell
```powershell
cd backend
Copy-Item .env.example .env
docker compose up --build -d
docker compose logs -f backend
```

### Linux / macOS
```bash
cd backend
cp .env.example .env
docker compose up --build -d
docker compose logs -f backend
```

On first boot, `entrypoint.sh` automatically waits for PostGIS, enables `CREATE EXTENSION IF NOT EXISTS postgis;`, generates/runs Django migrations, and runs `python manage.py seed_gowar` when `GOWAR_ENABLE_DEMO_SEED=true`.

To run migrations or seeding manually:
```bash
docker compose exec backend python manage.py makemigrations
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py seed_gowar
```

## 3. Running Automated Tests

Inside Docker (full PostgreSQL/PostGIS spatial & API suite):
```bash
docker compose exec backend pytest
```

Pure domain logic tests (without PostgreSQL/GDAL installed locally):
```bash
pytest tests/test_domain_rules.py
```

## 4. API Documentation & Key Endpoints

Once running at `http://localhost:8000`:
- **Swagger UI:** `http://localhost:8000/api/docs/`
- **ReDoc:** `http://localhost:8000/api/redoc/`
- **OpenAPI Schema JSON/YAML:** `http://localhost:8000/api/schema/`
- **Health Check:** `http://localhost:8000/health/`

## 5. Development Seed Credentials (Non-Production Only)

Configured via `backend/.env` (never enable `GOWAR_ENABLE_DEMO_SEED=true` in production):
- **Admin:** `admin@gowar.demo` / `Admin@123`
- **Merchant (ماركت البركة):** `ahmed@gowar.demo` / `Gowar@123`
- **Merchant (سوبر ماركت النور):** `nour@gowar.demo` / `Gowar@123`
- **Customer:** `customer@gowar.demo` / `Customer@123`

## 6. Connecting the React Frontend

Set in root `.env`:
```env
VITE_API_BASE_URL=http://localhost:8000/api/v1
VITE_USE_BACKEND_API=true
```

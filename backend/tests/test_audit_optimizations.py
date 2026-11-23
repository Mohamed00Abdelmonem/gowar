import pytest
from django.core.cache import cache
from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient
from rest_framework.throttling import ScopedRateThrottle
from rest_framework_simplejwt.tokens import RefreshToken

from apps.catalog.models import Product, ProductImage


@pytest.mark.django_db
def test_public_product_list_prefetches_gallery_images(api_client, sample_catalog):
    products = list(Product.objects.all())
    assert len(products) >= 2
    for prod in products:
        ProductImage.objects.create(product=prod, image="products/test.png", is_primary=True)

    # Should execute bounded queries (count + products + prefetched images), never N+1 per product
    with CaptureQueriesContext(connection) as ctx:
        res = api_client.get("/api/v1/catalog/products/?page_size=20")
    assert res.status_code == 200
    assert len(res.data["results"]) == len(products)
    assert len(ctx) <= 3


@pytest.mark.django_db
def test_rate_limit_429_includes_retry_after_and_no_internals(monkeypatch):
    cache.clear()
    monkeypatch.setitem(ScopedRateThrottle.THROTTLE_RATES, "password_reset", "1/minute")
    client = APIClient()

    r1 = client.post(
        "/api/v1/auth/password/reset/request/",
        {"email": "none@example.com"},
        format="json",
    )
    assert r1.status_code == 200

    r2 = client.post(
        "/api/v1/auth/password/reset/request/",
        {"email": "none@example.com"},
        format="json",
    )
    assert r2.status_code == 429
    assert "Retry-After" in r2.headers
    assert r2.data["error"] is True
    assert r2.data["status_code"] == 429
    assert r2.data["retry_after"] >= 1
    assert "Traceback" not in str(r2.data)


@pytest.mark.django_db
def test_logout_token_ownership_and_invalid_tokens(customer_user, other_customer_user):
    customer_client = APIClient()
    customer_client.force_authenticate(user=customer_user)

    # 1. User can blacklist their own refresh token
    own_refresh = str(RefreshToken.for_user(customer_user))
    ok_res = customer_client.post(
        "/api/v1/auth/logout/",
        {"refresh": own_refresh},
        format="json",
    )
    assert ok_res.status_code == 200

    # 2. Already-revoked token returns 400 safely (no 500)
    revoked_res = customer_client.post(
        "/api/v1/auth/logout/",
        {"refresh": own_refresh},
        format="json",
    )
    assert revoked_res.status_code == 400

    # 3. Invalid/malformed token returns 400 safely (no 500)
    invalid_res = customer_client.post(
        "/api/v1/auth/logout/",
        {"refresh": "not-a-valid-jwt-token"},
        format="json",
    )
    assert invalid_res.status_code == 400

    # 4. User cannot blacklist another user's refresh token
    other_refresh = str(RefreshToken.for_user(other_customer_user))
    forbidden_res = customer_client.post(
        "/api/v1/auth/logout/",
        {"refresh": other_refresh},
        format="json",
    )
    assert forbidden_res.status_code == 403


@pytest.mark.django_db
def test_throttling_ignores_spoofed_xff_when_num_proxies_is_2(settings, monkeypatch):
    cache.clear()
    settings.REST_FRAMEWORK = {
        **settings.REST_FRAMEWORK,
        "NUM_PROXIES": 2,
    }
    monkeypatch.setitem(ScopedRateThrottle.THROTTLE_RATES, "password_reset", "2/minute")
    client = APIClient()

    # Simulate Host Nginx -> Container Nginx chain where attacker spoofs leftmost XFF IP
    r1 = client.post(
        "/api/v1/auth/password/reset/request/",
        {"email": "a@example.com"},
        format="json",
        HTTP_X_FORWARDED_FOR="1.1.1.1, 198.51.100.42, 172.19.0.1",
    )
    assert r1.status_code == 200

    r2 = client.post(
        "/api/v1/auth/password/reset/request/",
        {"email": "b@example.com"},
        format="json",
        HTTP_X_FORWARDED_FOR="2.2.2.2, 198.51.100.42, 172.19.0.1",
    )
    assert r2.status_code == 200

    # Spoofing a third leftmost IP must still hit the 198.51.100.42 bucket (429)
    r3 = client.post(
        "/api/v1/auth/password/reset/request/",
        {"email": "c@example.com"},
        format="json",
        HTTP_X_FORWARDED_FOR="3.3.3.3, 198.51.100.42, 172.19.0.1",
    )
    assert r3.status_code == 429


def test_redis_shared_cache_shares_counters(settings):
    if "redis" not in settings.CACHES["default"]["BACKEND"].lower():
        pytest.skip("REDIS_URL not configured in this environment")
    cache.clear()
    cache.set("audit:shared-counter", 1, timeout=30)
    assert cache.get("audit:shared-counter") == 1
    assert cache.incr("audit:shared-counter") == 2
    cache.delete("audit:shared-counter")

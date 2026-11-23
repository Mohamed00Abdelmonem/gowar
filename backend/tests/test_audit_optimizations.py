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


@pytest.mark.django_db
def test_merchant_product_edit_discount_lifecycle_and_validation(sample_catalog):
    product = Product.objects.select_related("store__merchant__user").first()
    assert product is not None
    merchant_user = product.store.merchant.user
    product.price = "88.00"
    product.discounted_price = "80.00"
    product.is_offer = True
    product.save()

    client = APIClient()
    client.force_authenticate(user=merchant_user)

    # 1. Remove discount while keeping selling price at 80.00 (JSON null)
    res_remove = client.patch(
        f"/api/v1/merchant/products/{product.id}/",
        {"price": "80.00", "discounted_price": None, "is_offer": False},
        format="json",
    )
    assert res_remove.status_code == 200
    assert res_remove.data["price"] == "80.00"
    assert res_remove.data["discounted_price"] is None

    # 2. Add/update discount to valid lower price
    res_add = client.patch(
        f"/api/v1/merchant/products/{product.id}/",
        {"price": "90.00", "discounted_price": "75.00", "is_offer": True},
        format="json",
    )
    assert res_add.status_code == 200
    assert res_add.data["effective_price"] == "75.00"

    # 3. Remove discount via multipart empty string
    res_multipart = client.patch(
        f"/api/v1/merchant/products/{product.id}/",
        {"price": "75.00", "discounted_price": "", "is_offer": "false"},
        format="multipart",
    )
    assert res_multipart.status_code == 200
    assert res_multipart.data["discounted_price"] is None

    # 4. Invalid discount >= regular price must still be rejected
    res_invalid = client.patch(
        f"/api/v1/merchant/products/{product.id}/",
        {"price": "75.00", "discounted_price": "80.00"},
        format="json",
    )
    assert res_invalid.status_code == 400


@pytest.mark.django_db
def test_product_serializer_normalizes_http_static_and_media_urls(api_client, sample_catalog):
    product = Product.objects.first()
    assert product is not None
    product.image_url = "http://91.90.83.126/static/catalog_library/nescafe.webp"
    product.save(update_fields=["image_url"])

    res = api_client.get(
        f"/api/v1/catalog/products/{product.id}/",
        HTTP_X_FORWARDED_PROTO="https",
        secure=True,
    )
    assert res.status_code == 200
    assert res.data["image_url"] == "https://testserver/static/catalog_library/nescafe.webp"


@pytest.mark.django_db
def test_product_edit_image_replacement_and_decimal_price_persistence(sample_catalog):
    import io
    from PIL import Image
    from django.core.files.uploadedfile import SimpleUploadedFile

    product = Product.objects.select_related("store__merchant__user").first()
    assert product is not None
    merchant_user = product.store.merchant.user

    client = APIClient()
    client.force_authenticate(user=merchant_user)

    # 1. Upload initial file image + decimal price + discount
    buf = io.BytesIO()
    Image.new("RGB", (20, 20), color="green").save(buf, format="PNG")
    uploaded_1 = SimpleUploadedFile("first.png", buf.getvalue(), content_type="image/png")

    r1 = client.patch(
        f"/api/v1/merchant/products/{product.id}/",
        {
            "name": "حليب محدث",
            "price": "45.75",
            "discounted_price": "39.50",
            "is_offer": "true",
            "image": uploaded_1,
        },
        format="multipart",
    )
    assert r1.status_code == 200
    assert r1.data["image"] is not None
    assert r1.data["image_url"] == ""
    assert r1.data["price"] == "45.75"
    assert r1.data["effective_price"] == "39.50"

    # 2. Replace uploaded file image with a new image_url (like ProductImagePicker upload/library)
    #    Old ImageField must be cleared so it does not shadow the new image_url!
    r2 = client.patch(
        f"/api/v1/merchant/products/{product.id}/",
        {
            "image_url": "https://gowar.shop/media/products/uploads/new-pic.webp",
            "price": "42.25",
            "discounted_price": None,
            "is_offer": False,
        },
        format="json",
    )
    assert r2.status_code == 200
    assert r2.data["image"] is None
    assert r2.data["image_url"] == "https://gowar.shop/media/products/uploads/new-pic.webp"
    assert r2.data["price"] == "42.25"
    assert r2.data["effective_price"] == "42.25"

    # 3. Verify persistence via fresh GET (simulating page refresh)
    r_get = client.get(f"/api/v1/merchant/products/{product.id}/")
    assert r_get.status_code == 200
    assert r_get.data["name"] == "حليب محدث"
    assert r_get.data["image"] is None
    assert r_get.data["image_url"] == "https://gowar.shop/media/products/uploads/new-pic.webp"
    assert r_get.data["price"] == "42.25"
    assert r_get.data["discounted_price"] is None


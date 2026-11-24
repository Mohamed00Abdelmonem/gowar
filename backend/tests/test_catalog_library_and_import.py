from io import BytesIO
from unittest.mock import Mock, patch

import pytest
import requests
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image

from apps.catalog.models import CatalogLibraryCategory, CatalogLibraryItem, Product


def _make_image_file(name="test.webp", fmt="WEBP", size=(120, 120)):
    buf = BytesIO()
    Image.new("RGB", size, color=(27, 142, 83)).save(buf, format=fmt)
    buf.seek(0)
    return SimpleUploadedFile(name, buf.read(), content_type=f"image/{fmt.lower()}")


@pytest.mark.django_db
def test_catalog_library_permissions_pagination_category_and_search(
    api_client, customer_user, merchants_and_stores
):
    cache.clear()
    # Non-merchants cannot access merchant library endpoints
    assert api_client.get("/api/v1/merchant/catalog-library/categories/").status_code == 401
    api_client.force_authenticate(user=customer_user)
    assert api_client.get("/api/v1/merchant/catalog-library/categories/").status_code == 403

    # Merchant can list categories and paginated items
    m1_user = merchants_and_stores["s1"].merchant.user
    api_client.force_authenticate(user=m1_user)

    cats_res = api_client.get("/api/v1/merchant/catalog-library/categories/")
    assert cats_res.status_code == 200
    assert len(cats_res.data) == 19

    items_page1 = api_client.get("/api/v1/merchant/catalog-library/items/?page_size=10&page=1")
    assert items_page1.status_code == 200
    assert items_page1.data["count"] >= 50
    assert len(items_page1.data["results"]) == 10

    # Category filter
    dairy_res = api_client.get("/api/v1/merchant/catalog-library/items/?category=dairy-milk")
    assert dairy_res.status_code == 200
    assert dairy_res.data["count"] >= 4
    assert all(item["category_slug"] == "dairy-milk" for item in dairy_res.data["results"])

    # Search filter (Arabic / English / Brand)
    search_res = api_client.get("/api/v1/merchant/catalog-library/items/?q=Juhayna")
    assert search_res.status_code == 200
    assert search_res.data["count"] >= 2
    assert any("Juhayna" in item["name_en"] for item in search_res.data["results"])


@pytest.mark.django_db
def test_barcode_lookup_success_not_found_and_timeout(api_client, merchants_and_stores):
    cache.clear()
    m1_user = merchants_and_stores["s1"].merchant.user
    api_client.force_authenticate(user=m1_user)

    # 1. Local library barcode hit (no external network call needed)
    local_res = api_client.get("/api/v1/merchant/product-import/barcode/6221155001011/")
    assert local_res.status_code == 200
    assert local_res.data["status"] == "found"
    assert local_res.data["product"]["source"] == "gowar_library"
    assert "price" not in local_res.data["product"]

    # 2. Mocked Open Food Facts hit
    mock_resp = Mock(status_code=200)
    mock_resp.json.return_value = {
        "status": 1,
        "product": {
            "code": "5000112637922",
            "product_name_en": "Sparkling Drink 330ml",
            "brands": "TestBrand",
            "quantity": "330 ml",
            "categories_tags": ["en:beverages"],
            "image_front_small_url": "https://images.openfoodfacts.org/sample.jpg",
        },
    }
    mock_resp.raise_for_status.return_value = None

    with patch("apps.catalog.external_providers.requests.get", return_value=mock_resp):
        off_res = api_client.get("/api/v1/merchant/product-import/barcode/5000112637922/")
    assert off_res.status_code == 200
    assert off_res.data["status"] == "found"
    assert off_res.data["product"]["name_en"] == "Sparkling Drink 330ml"
    assert "price" not in off_res.data["product"]

    # 3. Not found case
    not_found_resp = Mock(status_code=404)
    with patch("apps.catalog.external_providers.requests.get", return_value=not_found_resp):
        nf_res = api_client.get("/api/v1/merchant/product-import/barcode/9999999999999/")
    assert nf_res.status_code == 200
    assert nf_res.data["status"] == "not_found"

    # 4. Timeout case handled gracefully (no 500)
    with patch(
        "apps.catalog.external_providers.requests.get",
        side_effect=requests.Timeout("timed out"),
    ):
        to_res = api_client.get("/api/v1/merchant/product-import/barcode/8888888888888/")
    assert to_res.status_code == 200
    assert to_res.data["status"] == "timeout"


@pytest.mark.django_db
def test_external_image_search_unconfigured_and_timeout(api_client, merchants_and_stores, monkeypatch):
    cache.clear()
    m1_user = merchants_and_stores["s1"].merchant.user
    api_client.force_authenticate(user=m1_user)

    monkeypatch.delenv("PRODUCT_IMAGE_SEARCH_PROVIDER", raising=False)
    monkeypatch.delenv("PRODUCT_IMAGE_SEARCH_API_KEY", raising=False)
    unconf_res = api_client.get("/api/v1/merchant/catalog-library/external-images/?q=milk")
    assert unconf_res.status_code == 200
    assert unconf_res.data["configured"] is False
    assert "google.com/search" in unconf_res.data["google_images_fallback_url"]

    monkeypatch.setenv("PRODUCT_IMAGE_SEARCH_PROVIDER", "pexels")
    monkeypatch.setenv("PRODUCT_IMAGE_SEARCH_API_KEY", "test-key")
    with patch(
        "apps.catalog.external_providers.requests.get",
        side_effect=requests.Timeout("timeout"),
    ):
        timeout_res = api_client.get("/api/v1/merchant/catalog-library/external-images/?q=milk")
    assert timeout_res.status_code == 200
    assert timeout_res.data["configured"] is True
    assert timeout_res.data["status"] == "timeout"


@pytest.mark.django_db
def test_product_image_upload_validation_and_product_creation(
    api_client, merchants_and_stores, sample_catalog, tmp_path, settings
):
    settings.MEDIA_ROOT = tmp_path
    s1 = merchants_and_stores["s1"]
    m1_user = s1.merchant.user
    dairy_cat_id = str(sample_catalog["p1"].category_id)
    api_client.force_authenticate(user=m1_user)

    # Invalid file rejected
    bad_file = SimpleUploadedFile("bad.txt", b"not-an-image", content_type="text/plain")
    bad_res = api_client.post(
        "/api/v1/merchant/products/upload-image/",
        {"image": bad_file},
        format="multipart",
    )
    assert bad_res.status_code == 400

    # Valid WebP upload succeeds
    valid_img = _make_image_file("milk.webp", fmt="WEBP")
    up_res = api_client.post(
        "/api/v1/merchant/products/upload-image/",
        {"image": valid_img},
        format="multipart",
    )
    assert up_res.status_code == 201
    uploaded_url = up_res.data["image_url"]
    assert uploaded_url.endswith(".webp")

    # Create product with uploaded image URL and merchant's own selling price
    create_uploaded = api_client.post(
        "/api/v1/merchant/products/",
        {
            "category": dairy_cat_id,
            "name": "حليب طازج مرفوع",
            "name_en": "Uploaded Fresh Milk",
            "image_url": uploaded_url,
            "price": "52.50",
            "stock_quantity": 15,
            "barcode": "6221155001011",
        },
        format="json",
    )
    assert create_uploaded.status_code == 201
    assert create_uploaded.data["price"] == "52.50"

    # Create product directly with library image URL and independent merchant price
    lib_item = CatalogLibraryItem.objects.filter(slug="juhayna-milk-1l").first()
    assert lib_item is not None
    assert CatalogLibraryCategory.objects.filter(slug="dairy-milk").exists()

    lib_res = api_client.get(f"/api/v1/merchant/catalog-library/items/?q={lib_item.name_en}")
    assert lib_res.status_code == 200
    assert len(lib_res.data["results"]) >= 1
    lib_thumb = lib_res.data["results"][0]["thumbnail_url"]

    create_lib = api_client.post(
        "/api/v1/merchant/products/",
        {
            "category": dairy_cat_id,
            "name": "حليب جهينة ١ لتر",
            "name_en": "Juhayna Milk 1L",
            "image_url": lib_thumb,
            "price": "49.00",
            "stock_quantity": 30,
        },
        format="json",
    )
    assert create_lib.status_code == 201
    assert Product.objects.filter(pk=create_lib.data["id"], store=s1, price="49.00").exists()

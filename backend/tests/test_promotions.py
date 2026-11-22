from datetime import timedelta
from io import BytesIO

import pytest
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from PIL import Image

from apps.promotions.models import Promotion, PromotionType
from tests.conftest import auth_client_for


def _make_test_image(filename="banner.png", fmt="PNG", size=(120, 60)):
    buf = BytesIO()
    Image.new("RGB", size, color=(214, 69, 13)).save(buf, format=fmt)
    buf.seek(0)
    return SimpleUploadedFile(
        filename, buf.read(), content_type=f"image/{fmt.lower()}"
    )


@pytest.fixture(autouse=True)
def _clear_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.mark.django_db
def test_public_promotions_filtering_location_and_scheduling(
    api_client, cairo_areas, merchants_and_stores, sample_catalog
):
    now = timezone.now()
    s1 = merchants_and_stores["s1"]  # (30.0566, 31.3376), radius 3km
    s2 = merchants_and_stores["s2"]  # (30.0875, 31.3264), radius 2km (~3.6km from s1)
    cat = sample_catalog["category"]
    p_avail = sample_catalog["p1"]  # belongs to s1
    p_unavail = sample_catalog["p2"]
    p_unavail.is_available = False
    p_unavail.save(update_fields=["is_available"])

    # 1. General promotion (global)
    gen_global = Promotion.objects.create(
        title="عروض الأسبوع",
        title_en="Weekly Offers",
        image_url="https://cdn.gowar.test/weekly.jpg",
        promotion_type=PromotionType.GENERAL,
        custom_destination="/stores",
        start_at=now - timedelta(days=1),
        end_at=now + timedelta(days=5),
        is_active=True,
        display_order=2,
    )

    # 2. General promotion targeted to Maadi only
    gen_maadi = Promotion.objects.create(
        title="عرض المعادي",
        title_en="Maadi Special",
        image_url="https://cdn.gowar.test/maadi.jpg",
        promotion_type=PromotionType.GENERAL,
        target_area=cairo_areas["maadi"],
        start_at=now - timedelta(days=1),
        end_at=now + timedelta(days=5),
        is_active=True,
        display_order=1,
    )

    # 3. Store promotion for s1 (Nasr City)
    store_s1 = Promotion.objects.create(
        title="خصم البركة",
        title_en="Al-Baraka Discount",
        image_url="https://cdn.gowar.test/s1.jpg",
        promotion_type=PromotionType.STORE,
        target_store=s1,
        start_at=now - timedelta(days=1),
        end_at=now + timedelta(days=5),
        is_active=True,
        display_order=0,
    )

    # 4. Store promotion for s2 (Maadi - far from Nasr City)
    Promotion.objects.create(
        title="خصم المعادي",
        title_en="Maadi Store Discount",
        image_url="https://cdn.gowar.test/s2.jpg",
        promotion_type=PromotionType.STORE,
        target_store=s2,
        start_at=now - timedelta(days=1),
        end_at=now + timedelta(days=5),
        is_active=True,
        display_order=3,
    )

    # 5. Product promotion (available product at s1)
    prod_ok = Promotion.objects.create(
        title="عرض اللبن",
        title_en="Milk Offer",
        image_url="https://cdn.gowar.test/milk.jpg",
        promotion_type=PromotionType.PRODUCT,
        target_product=p_avail,
        start_at=now - timedelta(days=1),
        end_at=now + timedelta(days=5),
        is_active=True,
        display_order=4,
    )

    # 6. Product promotion (unavailable product)
    Promotion.objects.create(
        title="منتج غير متاح",
        image_url="https://cdn.gowar.test/unavail.jpg",
        promotion_type=PromotionType.PRODUCT,
        target_product=p_unavail,
        start_at=now - timedelta(days=1),
        end_at=now + timedelta(days=5),
        is_active=True,
        display_order=5,
    )

    # 7. Category promotion
    cat_promo = Promotion.objects.create(
        title="قسم الألبان",
        image_url="https://cdn.gowar.test/dairy.jpg",
        promotion_type=PromotionType.CATEGORY,
        target_category=cat,
        start_at=now - timedelta(days=1),
        end_at=now + timedelta(days=5),
        is_active=True,
        display_order=6,
    )

    # 8. Expired promotion (should never show)
    Promotion.objects.create(
        title="عرض منتهي",
        image_url="https://cdn.gowar.test/expired.jpg",
        promotion_type=PromotionType.GENERAL,
        start_at=now - timedelta(days=10),
        end_at=now - timedelta(days=1),
        is_active=True,
        display_order=0,
    )

    # 9. Future scheduled promotion (should not show yet)
    Promotion.objects.create(
        title="عرض قادم",
        image_url="https://cdn.gowar.test/future.jpg",
        promotion_type=PromotionType.GENERAL,
        start_at=now + timedelta(days=1),
        end_at=now + timedelta(days=10),
        is_active=True,
        display_order=0,
    )

    # 10. Inactive promotion (should not show)
    Promotion.objects.create(
        title="عرض غير مفعل",
        image_url="https://cdn.gowar.test/inactive.jpg",
        promotion_type=PromotionType.GENERAL,
        start_at=now - timedelta(days=1),
        end_at=now + timedelta(days=5),
        is_active=False,
        display_order=0,
    )

    # A. Without location: only global general & active category promotions (no store/product assumptions)
    res_no_loc = api_client.get("/api/v1/promotions/")
    assert res_no_loc.status_code == 200
    ids_no_loc = [item["id"] for item in res_no_loc.data]
    assert ids_no_loc == [str(gen_global.id), str(cat_promo.id)]

    # B. Customer in Nasr City (near s1, far from s2)
    res_nasr = api_client.get(
        "/api/v1/promotions/",
        {"latitude": "30.0566", "longitude": "31.3376", "area_id": str(cairo_areas["nasr"].id)},
    )
    assert res_nasr.status_code == 200
    ids_nasr = [item["id"] for item in res_nasr.data]
    assert ids_nasr == [
        str(store_s1.id),
        str(gen_global.id),
        str(prod_ok.id),
        str(cat_promo.id),
    ]

    # C. Customer in Maadi (29.9608, 31.2582), far from both s1 and s2 -> cache isolation from Nasr City!
    res_maadi = api_client.get(
        "/api/v1/promotions/",
        {"latitude": "29.9608", "longitude": "31.2582", "area_id": str(cairo_areas["maadi"].id)},
    )
    assert res_maadi.status_code == 200
    ids_maadi = [item["id"] for item in res_maadi.data]
    assert ids_maadi == [
        str(gen_maadi.id),
        str(gen_global.id),
        str(cat_promo.id),
    ]

    # D. Store delivery_enabled=False hides store & product promotions for s1
    s1.delivery_enabled = False
    s1.save(update_fields=["delivery_enabled"])
    cache.clear()
    res_pickup = api_client.get(
        "/api/v1/promotions/",
        {"latitude": "30.0566", "longitude": "31.3376", "area_id": str(cairo_areas["nasr"].id)},
    )
    ids_pickup = [item["id"] for item in res_pickup.data]
    assert str(store_s1.id) not in ids_pickup
    assert str(prod_ok.id) not in ids_pickup


@pytest.mark.django_db
def test_promotion_analytics_tracking_and_dedup(api_client, admin_user):
    now = timezone.now()
    promo = Promotion.objects.create(
        title="عرض رمضان",
        image_url="https://cdn.gowar.test/ramadan.jpg",
        promotion_type=PromotionType.GENERAL,
        start_at=now - timedelta(hours=1),
        end_at=now + timedelta(days=3),
        is_active=True,
    )

    # First view counts
    r1 = api_client.post(f"/api/v1/promotions/{promo.id}/track-view/")
    assert r1.status_code == 200
    assert r1.data["counted"] is True

    # Immediate duplicate view from same viewer is deduplicated
    r2 = api_client.post(f"/api/v1/promotions/{promo.id}/track-view/")
    assert r2.status_code == 200
    assert r2.data["counted"] is False

    # Click counts
    c1 = api_client.post(f"/api/v1/promotions/{promo.id}/track-click/")
    assert c1.status_code == 200
    assert c1.data["counted"] is True

    promo.refresh_from_db()
    assert promo.impressions_count == 1
    assert promo.clicks_count == 1
    assert promo.ctr == 100.0

    # Admin analytics summary
    admin_client = auth_client_for(admin_user)
    analytics_res = admin_client.get("/api/v1/admin/promotions/analytics/")
    assert analytics_res.status_code == 200
    assert analytics_res.data["total_impressions"] == 1
    assert analytics_res.data["total_clicks"] == 1
    assert analytics_res.data["overall_ctr"] == 100.0


@pytest.mark.django_db
def test_admin_promotion_permissions_and_validation(
    api_client, customer_user, admin_user, merchants_and_stores
):
    now = timezone.now()
    payload = {
        "title": "بانر جديد",
        "title_en": "New Banner",
        "promotion_type": "general",
        "image_url": "https://cdn.gowar.test/new.jpg",
        "start_at": now.isoformat(),
        "end_at": (now + timedelta(days=7)).isoformat(),
        "is_active": True,
    }

    # Unauthenticated & customer cannot access admin endpoints
    assert api_client.post("/api/v1/admin/promotions/", payload, format="json").status_code == 401
    cust_client = auth_client_for(customer_user)
    assert cust_client.post("/api/v1/admin/promotions/", payload, format="json").status_code == 403

    admin_client = auth_client_for(admin_user)

    # Validation: end_at before start_at
    bad_dates = {**payload, "end_at": (now - timedelta(hours=1)).isoformat()}
    assert admin_client.post("/api/v1/admin/promotions/", bad_dates, format="json").status_code == 400

    # Validation: store promo without target_store
    bad_store = {**payload, "promotion_type": "store"}
    assert admin_client.post("/api/v1/admin/promotions/", bad_store, format="json").status_code == 400

    # Validation: product promo without target_product
    bad_prod = {**payload, "promotion_type": "product"}
    assert admin_client.post("/api/v1/admin/promotions/", bad_prod, format="json").status_code == 400

    # Validation: category promo without target_category
    bad_cat = {**payload, "promotion_type": "category"}
    assert admin_client.post("/api/v1/admin/promotions/", bad_cat, format="json").status_code == 400

    # Validation: invalid custom_destination
    bad_dest = {**payload, "custom_destination": "javascript:alert(1)"}
    assert admin_client.post("/api/v1/admin/promotions/", bad_dest, format="json").status_code == 400

    # Validation: multipart upload with valid PNG image succeeds
    multipart_res = admin_client.post(
        "/api/v1/admin/promotions/",
        {
            "title": "بانر صورة مرفوعة",
            "promotion_type": "store",
            "target_store": str(merchants_and_stores["s1"].id),
            "image": _make_test_image(),
            "start_at": now.isoformat(),
            "end_at": (now + timedelta(days=7)).isoformat(),
            "is_active": "true",
        },
        format="multipart",
    )
    assert multipart_res.status_code == 201
    created_id = multipart_res.data["id"]

    # Toggle active
    toggle_res = admin_client.post(f"/api/v1/admin/promotions/{created_id}/toggle-active/")
    assert toggle_res.status_code == 200
    assert toggle_res.data["is_active"] is False

    # Soft archive via DELETE
    del_res = admin_client.delete(f"/api/v1/admin/promotions/{created_id}/")
    assert del_res.status_code == 204
    promo = Promotion.objects.get(pk=created_id)
    assert promo.is_archived is True
    assert promo.is_active is False


@pytest.mark.django_db
def test_public_promotions_query_count_avoids_n_plus_1(
    api_client, django_assert_max_num_queries
):
    now = timezone.now()
    for i in range(8):
        Promotion.objects.create(
            title=f"Promo {i}",
            image_url=f"https://cdn.gowar.test/{i}.jpg",
            promotion_type=PromotionType.GENERAL,
            start_at=now - timedelta(days=1),
            end_at=now + timedelta(days=5),
            is_active=True,
            display_order=i,
        )

    with django_assert_max_num_queries(4):
        res = api_client.get(
            "/api/v1/promotions/",
            {"latitude": "30.0566", "longitude": "31.3376"},
        )
    assert res.status_code == 200
    assert len(res.data) == 8

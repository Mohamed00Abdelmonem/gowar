from decimal import Decimal
import pytest
from django.contrib.gis.geos import Point

from apps.locations.models import Area
from apps.stores.models import Store


@pytest.mark.django_db
def test_mansoura_active_and_removed_areas_excluded_from_public_list(api_client):
    res = api_client.get("/api/v1/locations/areas/")
    assert res.status_code == 200
    names_en = {a["name_en"] for a in res.data}
    assert "Mansoura" in names_en
    for removed in ("New Cairo", "Sheikh Zayed", "Smouha", "Maadi"):
        assert removed not in names_en


@pytest.mark.django_db
def test_inactive_area_rejected_for_new_customer_address_while_historical_kept(
    api_client, customer_user
):
    inactive_maadi = Area.objects.filter(name_en="Maadi", is_active=False).first()
    assert inactive_maadi is not None

    api_client.force_authenticate(user=customer_user)
    bad_res = api_client.post(
        "/api/v1/locations/addresses/",
        {
            "label": "Old Area",
            "area": str(inactive_maadi.id),
            "formatted_address": "Maadi, Cairo",
            "latitude": 29.9608,
            "longitude": 31.2582,
        },
        format="json",
    )
    assert bad_res.status_code == 400

    mansoura = Area.objects.get(name_en="Mansoura", is_active=True)
    ok_res = api_client.post(
        "/api/v1/locations/addresses/",
        {
            "label": "University District",
            "area": str(mansoura.id),
            "formatted_address": "El Gomhoria St, Mansoura",
            "latitude": 31.0409,
            "longitude": 31.3785,
        },
        format="json",
    )
    assert ok_res.status_code == 201


@pytest.mark.django_db
def test_mansoura_postgis_nearby_store_discovery(api_client, merchants_and_stores):
    mansoura = Area.objects.get(name_en="Mansoura", is_active=True)
    merchant_profile = merchants_and_stores["baraka"].merchant
    mansoura_store = Store.objects.create(
        merchant=merchant_profile,
        name="ماركت الجامعة - المنصورة",
        name_en="University Market Mansoura",
        slug="university-market-mansoura",
        phone_number="01055556666",
        area=mansoura,
        address="شارع الجمهورية، المنصورة",
        address_en="El Gomhoria St, Mansoura",
        latitude=Decimal("31.041500"),
        longitude=Decimal("31.379000"),
        location=Point(31.3790, 31.0415, srid=4326),
        approval_status="approved",
        is_active=True,
        is_open=True,
        delivery_enabled=True,
        delivery_radius_km=Decimal("4.00"),
    )

    res = api_client.get(
        "/api/v1/stores/nearby/?latitude=31.0409&longitude=31.3785&radius_km=5"
    )
    assert res.status_code == 200
    ids = [s["id"] for s in res.data["results"]]
    assert str(mansoura_store.id) in ids

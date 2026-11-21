import pytest
from rest_framework import status

from tests.conftest import auth_client_for


@pytest.mark.django_db
def test_nearby_stores_postgis_discovery_radius_and_independent_delivery_coverage(
    api_client, customer_user, merchants_and_stores
):
    lat, lng = 30.0566, 31.3376  # Abbas El Akkad (~0.09 km from s1, ~3.6 km from s2)

    # Missing coordinates -> 400
    assert api_client.get("/api/v1/stores/nearby/").status_code == status.HTTP_400_BAD_REQUEST

    # Invalid radius -> 400
    assert (
        api_client.get(
            f"/api/v1/stores/nearby/?latitude={lat}&longitude={lng}&radius_km=50"
        ).status_code
        == status.HTTP_400_BAD_REQUEST
    )

    # Default radius (3 KM): returns only s1 (s2 is ~3.6 km away)
    res_3km = api_client.get(f"/api/v1/stores/nearby/?latitude={lat}&longitude={lng}")
    assert res_3km.status_code == status.HTTP_200_OK
    results_3km = res_3km.data["results"]
    assert len(results_3km) == 1
    assert results_3km[0]["id"] == str(merchants_and_stores["s1"].id)
    assert results_3km[0]["delivery_available"] is True
    assert results_3km[0]["distance_meters"] < 300

    # Expanding search radius to 5 KM discovers s2 as well, sorted nearest first,
    # while marking s2 as delivery_available=False because s2's delivery_radius_km is 2.00 km!
    res_5km = api_client.get(
        f"/api/v1/stores/nearby/?latitude={lat}&longitude={lng}&radius_km=5"
    )
    assert res_5km.status_code == status.HTTP_200_OK
    results_5km = res_5km.data["results"]
    assert len(results_5km) == 2
    assert results_5km[0]["distance_km"] < results_5km[1]["distance_km"]
    assert results_5km[1]["id"] == str(merchants_and_stores["s2"].id)
    assert results_5km[1]["delivery_available"] is False
    assert results_5km[1]["delivery_status"] == "outside_delivery_area"

    # Shrinking to 1 KM keeps s1; saving preferred radius on customer profile works
    cust_client = auth_client_for(customer_user)
    patch_rad = cust_client.patch(
        "/api/v1/locations/search-radius/", {"search_radius_km": 5}, format="json"
    )
    assert patch_rad.status_code == status.HTTP_200_OK
    assert patch_rad.data["search_radius_km"] == 5

    # Omitting radius_km as authenticated customer uses saved 5 KM preference
    res_saved = cust_client.get(f"/api/v1/stores/nearby/?latitude={lat}&longitude={lng}")
    assert len(res_saved.data["results"]) == 2

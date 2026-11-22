from decimal import Decimal
import pytest
from django.core.exceptions import ValidationError

from apps.orders.models import Order
from apps.stores.services import calculate_billable_km


@pytest.mark.parametrize(
    "distance_km,expected_billable",
    [
        ("0.50", 1),
        ("1.00", 1),
        ("1.25", 1),
        ("1.50", 1),
        ("1.51", 2),
        ("2.00", 2),
        ("2.50", 2),
        ("2.51", 3),
        ("3.50", 3),
        ("3.51", 4),
    ],
)
def test_billable_km_1_5km_band_boundaries(distance_km, expected_billable):
    assert calculate_billable_km(distance_km) == expected_billable


@pytest.mark.django_db
def test_merchant_delivery_price_validation_and_multi_merchant_rates(
    api_client, merchants_and_stores
):
    baraka = merchants_and_stores["s1"]
    nour = merchants_and_stores["s2"]

    # Reject negative delivery price
    api_client.force_authenticate(user=baraka.merchant.user)
    bad_res = api_client.patch(
        "/api/v1/merchant/delivery/",
        {"delivery_price_per_km": "-5.00"},
        format="json",
    )
    assert bad_res.status_code == 400

    # Baraka sets 10 EGP/km; Nour sets 15 EGP/km
    ok_baraka = api_client.patch(
        "/api/v1/merchant/delivery/",
        {"delivery_price_per_km": "10.00"},
        format="json",
    )
    assert ok_baraka.status_code == 200
    assert Decimal(ok_baraka.data["delivery_price_per_km"]) == Decimal("10.00")

    api_client.force_authenticate(user=nour.merchant.user)
    ok_nour = api_client.patch(
        "/api/v1/merchant/delivery/",
        {"delivery_price_per_km": "15.00"},
        format="json",
    )
    assert ok_nour.status_code == 200
    assert Decimal(ok_nour.data["delivery_price_per_km"]) == Decimal("15.00")


@pytest.mark.django_db
def test_delivery_quote_invalid_coords_and_checkout_ignores_frontend_fee_and_preserves_snapshot(
    api_client, customer_user, merchants_and_stores, sample_catalog
):
    store = merchants_and_stores["s1"]
    store.delivery_price_per_km = Decimal("12.00")
    store.delivery_radius_km = Decimal("10.00")
    store.free_delivery_threshold = None
    store.save(
        update_fields=["delivery_price_per_km", "delivery_radius_km", "free_delivery_threshold"]
    )
    prod = sample_catalog["p1"]

    # Invalid coordinates on quote endpoint
    bad_quote = api_client.get(
        f"/api/v1/stores/{store.id}/delivery-quote/?latitude=999&longitude=31.337"
    )
    assert bad_quote.status_code == 400

    # Valid PostGIS quote (~1.8 km north of store at 30.0566, 31.3376 -> ~30.0728, 31.3376)
    quote_res = api_client.get(
        f"/api/v1/stores/{store.id}/delivery-quote/?latitude=30.0728&longitude=31.3376&subtotal=100"
    )
    assert quote_res.status_code == 200
    assert quote_res.data["billable_km"] == 2
    assert Decimal(quote_res.data["price_per_km"]) == Decimal("12.00")
    assert Decimal(quote_res.data["delivery_fee"]) == Decimal("24.00")

    # Checkout ignores any frontend-manipulated delivery_fee and snapshots pricing
    api_client.force_authenticate(user=customer_user)
    api_client.post(
        "/api/v1/cart/items/",
        {"product_id": str(prod.id), "quantity": 2},
        format="json",
    )
    order_res = api_client.post(
        "/api/v1/orders/",
        {
            "delivery_address": {
                "label": "Test",
                "formatted_address": "Nasr City",
                "latitude": 30.0728,
                "longitude": 31.3376,
            },
            "payment_method": "cod",
            "delivery_fee": "0.00",  # attempt to manipulate fee from client
        },
        format="json",
    )
    assert order_res.status_code == 201
    order = Order.objects.get(pk=order_res.data["id"])
    assert order.billable_distance_km == 2
    assert order.delivery_price_per_km_snapshot == Decimal("12.00")
    assert order.delivery_fee == Decimal("24.00")
    assert order.total_amount == order.subtotal + Decimal("24.00")

    # Merchant later changes price to 25 EGP/km -> historical order keeps 12 EGP/km & 24.00 EGP
    store.delivery_price_per_km = Decimal("25.00")
    store.save(update_fields=["delivery_price_per_km"])
    order.refresh_from_db()
    assert order.delivery_price_per_km_snapshot == Decimal("12.00")
    assert order.delivery_fee == Decimal("24.00")


@pytest.mark.django_db
def test_missing_store_price_raises_validation_error(merchants_and_stores):
    from apps.stores.services import calculate_dynamic_delivery_quote

    store = merchants_and_stores["s1"]
    store.delivery_price_per_km = None
    with pytest.raises(ValidationError):
        calculate_dynamic_delivery_quote(store, 30.0566, 31.3376)

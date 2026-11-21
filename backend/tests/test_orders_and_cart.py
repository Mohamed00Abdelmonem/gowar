from decimal import Decimal
import pytest
from rest_framework import status

from apps.commissions.models import CommissionRecord, CommissionStatus
from apps.orders.models import Order
from tests.conftest import auth_client_for


@pytest.mark.django_db
def test_cart_store_exclusivity_checkout_snapshot_and_cancel_restock(
    customer_user,
    other_customer_user,
    merchants_and_stores,
    sample_catalog,
):
    client = auth_client_for(customer_user)
    p1 = sample_catalog["p1"]  # store s1, 46.00 EGP, stock 20
    p2 = sample_catalog["p2"]  # store s2, 52.00 EGP, stock 10
    addr_id = str(customer_user.addresses.first().id)

    # 1. Add from store 1
    res1 = client.post(
        "/api/v1/cart/items/",
        {"product_id": str(p1.id), "quantity": 2},
        format="json",
    )
    assert res1.status_code == status.HTTP_200_OK
    assert res1.data["subtotal"] == "92.00"

    # 2. Attempting to add from store 2 without replace_cart=True returns 409 conflict
    conflict = client.post(
        "/api/v1/cart/items/",
        {"product_id": str(p2.id), "quantity": 1},
        format="json",
    )
    assert conflict.status_code == status.HTTP_409_CONFLICT
    assert conflict.data["code"] == "STORE_CONFLICT"

    # 3. Attempting checkout exceeding available stock fails
    over_stock = client.patch(
        f"/api/v1/cart/items/{p1.id}/",
        {"quantity": 50},
        format="json",
    )
    assert over_stock.status_code == status.HTTP_400_BAD_REQUEST

    # 4. Checkout with idempotency key deducts stock and snapshots prices
    checkout = client.post(
        "/api/v1/orders/",
        {"address_id": addr_id, "payment_method": "cod", "idempotency_key": "idem-001"},
        format="json",
    )
    assert checkout.status_code == status.HTTP_201_CREATED
    order_id = checkout.data["id"]
    assert checkout.data["subtotal"] == "92.00"
    assert checkout.data["delivery_fee"] == "15.00"
    assert checkout.data["total_amount"] == "107.00"
    assert checkout.data["commission_amount"] == "4.60"  # 5% of 92.00

    p1.refresh_from_db()
    assert p1.stock_quantity == 18

    # Repeat request with identical idempotency key returns same order without double-deducting
    replay = client.post(
        "/api/v1/orders/",
        {"address_id": addr_id, "payment_method": "cod", "idempotency_key": "idem-001"},
        format="json",
    )
    assert replay.status_code == status.HTTP_201_CREATED
    assert replay.data["id"] == order_id
    p1.refresh_from_db()
    assert p1.stock_quantity == 18

    # Mutating product price later must NOT change historical order snapshot
    p1.price = Decimal("99.00")
    p1.save()
    order_obj = Order.objects.get(pk=order_id)
    assert order_obj.items.first().unit_price_snapshot == Decimal("46.00")

    # Other customer cannot read this order
    other_client = auth_client_for(other_customer_user)
    assert other_client.get(f"/api/v1/orders/{order_id}/").status_code == status.HTTP_404_NOT_FOUND

    # Invalid transition (pending -> delivered directly) rejected for merchant
    m1_client = auth_client_for(merchants_and_stores["m1"].user)
    bad_trans = m1_client.post(
        f"/api/v1/merchant/orders/{order_id}/transition/",
        {"status": "delivered"},
        format="json",
    )
    assert bad_trans.status_code == status.HTTP_400_BAD_REQUEST

    # Merchant cancels order -> restocks product back to 20 & reverses commission
    cancel_res = m1_client.post(
        f"/api/v1/merchant/orders/{order_id}/transition/",
        {"status": "cancelled", "reject_reason": "Out of crates"},
        format="json",
    )
    assert cancel_res.status_code == status.HTTP_200_OK
    p1.refresh_from_db()
    assert p1.stock_quantity == 20
    assert CommissionRecord.objects.get(order=order_obj).status == CommissionStatus.REVERSED


@pytest.mark.django_db
def test_checkout_rejects_address_outside_merchant_delivery_coverage(
    customer_user, merchants_and_stores, sample_catalog
):
    client = auth_client_for(customer_user)
    p2 = sample_catalog["p2"]  # Store s2 in Korba (~3.6 km from customer addr), max delivery_radius=2.0 km

    client.post(
        "/api/v1/cart/items/",
        {"product_id": str(p2.id), "quantity": 2},
        format="json",
    )
    addr_id = str(customer_user.addresses.first().id)

    checkout = client.post(
        "/api/v1/orders/",
        {"address_id": addr_id, "payment_method": "cod"},
        format="json",
    )
    assert checkout.status_code == status.HTTP_400_BAD_REQUEST
    assert "delivery coverage" in str(checkout.data).lower()

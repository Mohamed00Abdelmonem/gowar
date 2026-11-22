import pytest
from django.utils import timezone

from apps.accounts.models import User, UserRole
from apps.notifications.models import Notification
from apps.orders.models import Order, OrderStatusChoices


@pytest.fixture
def delivery_users(db):
    d1 = User.objects.create_user(
        email="driver1@gowar.test",
        password="DriverPassword123!",
        first_name="كريم",
        last_name="السيد",
        phone_number="01055551111",
        role=UserRole.DELIVERY,
        is_verified=True,
    )
    d2 = User.objects.create_user(
        email="driver2@gowar.test",
        password="DriverPassword123!",
        first_name="طارق",
        last_name="حسن",
        phone_number="01055552222",
        role=UserRole.DELIVERY,
        is_verified=True,
    )
    return {"d1": d1, "d2": d2}


@pytest.mark.django_db
def test_delivery_auth_and_role_isolation(
    api_client, delivery_users, customer_user, merchants_and_stores
):
    d1 = delivery_users["d1"]

    # Delivery user logs in via delivery login endpoint
    login_res = api_client.post(
        "/api/v1/auth/delivery/login/",
        {"email": d1.email, "password": "DriverPassword123!"},
        format="json",
    )
    assert login_res.status_code == 200
    assert login_res.data["user"]["role"] == "delivery"
    token = login_res.data["access"]

    # Customer cannot log in via delivery login
    bad_cust = api_client.post(
        "/api/v1/auth/delivery/login/",
        {"email": customer_user.email, "password": "CustPassword123!"},
        format="json",
    )
    assert bad_cust.status_code == 400

    # Customer & Merchant cannot access /api/v1/delivery/*
    api_client.force_authenticate(user=customer_user)
    assert api_client.get("/api/v1/delivery/summary/").status_code == 403
    assert api_client.get("/api/v1/delivery/orders/").status_code == 403

    api_client.force_authenticate(user=merchants_and_stores["s1"].merchant.user)
    assert api_client.get("/api/v1/delivery/summary/").status_code == 403

    # Delivery user cannot access merchant or customer order endpoints
    api_client.force_authenticate(user=None)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    assert api_client.get("/api/v1/merchant/orders/").status_code == 403
    assert api_client.get("/api/v1/orders/").status_code == 403


@pytest.mark.django_db
def test_delivery_assignment_visibility_isolation_and_lifecycle_transitions(
    api_client, delivery_users, customer_user, merchants_and_stores, sample_catalog
):
    d1 = delivery_users["d1"]
    d2 = delivery_users["d2"]
    s1 = merchants_and_stores["s1"]
    p1 = sample_catalog["p1"]

    # 1. Customer places an order
    api_client.force_authenticate(user=customer_user)
    api_client.post(
        "/api/v1/cart/items/",
        {"product_id": str(p1.id), "quantity": 2},
        format="json",
    )
    order_res = api_client.post(
        "/api/v1/orders/",
        {
            "delivery_address": {
                "label": "Home",
                "formatted_address": "15 Abbas El Akkad",
                "latitude": 30.0566,
                "longitude": 31.3376,
            },
            "payment_method": "cod",
        },
        format="json",
    )
    assert order_res.status_code == 201
    order_id = order_res.data["id"]

    # 2. Merchant prepares order & assigns to d1
    api_client.force_authenticate(user=s1.merchant.user)
    for st in ("accepted", "preparing", "ready_for_delivery"):
        r = api_client.post(
            f"/api/v1/merchant/orders/{order_id}/transition/",
            {"status": st},
            format="json",
        )
        assert r.status_code == 200

    assign_res = api_client.post(
        f"/api/v1/merchant/orders/{order_id}/assign-delivery/",
        {"delivery_user_id": str(d1.id)},
        format="json",
    )
    assert assign_res.status_code == 200
    assert assign_res.data["assigned_delivery_person"] == str(d1.id)

    # 3. d2 cannot view or transition d1's order
    api_client.force_authenticate(user=d2)
    assert api_client.get("/api/v1/delivery/orders/").data["pagination"]["count"] == 0
    assert api_client.get(f"/api/v1/delivery/orders/{order_id}/").status_code == 404
    assert (
        api_client.post(
            f"/api/v1/delivery/orders/{order_id}/transition/",
            {"status": "out_for_delivery"},
            format="json",
        ).status_code
        == 403
    )

    # 4. d1 sees assigned order in summary and list
    api_client.force_authenticate(user=d1)
    sum_res = api_client.get("/api/v1/delivery/summary/")
    assert sum_res.status_code == 200
    assert sum_res.data["ready_for_delivery"] == 1

    # Cannot skip out_for_delivery directly to delivered
    skip_res = api_client.post(
        f"/api/v1/delivery/orders/{order_id}/transition/",
        {"status": "delivered", "confirm_delivery": True},
        format="json",
    )
    assert skip_res.status_code == 400

    # Mark out_for_delivery
    out_res = api_client.post(
        f"/api/v1/delivery/orders/{order_id}/transition/",
        {"status": "out_for_delivery"},
        format="json",
    )
    assert out_res.status_code == 200
    assert out_res.data["order_status"] == OrderStatusChoices.OUT_FOR_DELIVERY

    # Delivered without confirm_delivery=True fails
    no_confirm = api_client.post(
        f"/api/v1/delivery/orders/{order_id}/transition/",
        {"status": "delivered", "confirm_delivery": False},
        format="json",
    )
    assert no_confirm.status_code == 400

    # Delivered with confirm_delivery=True succeeds, records timestamp + delivered_by, notifies customer
    before_count = Notification.objects.filter(recipient=customer_user).count()
    done_res = api_client.post(
        f"/api/v1/delivery/orders/{order_id}/transition/",
        {"status": "delivered", "confirm_delivery": True},
        format="json",
    )
    assert done_res.status_code == 200
    assert done_res.data["order_status"] == OrderStatusChoices.DELIVERED
    assert done_res.data["payment_status"] == "paid"
    assert done_res.data["delivered_by"] == str(d1.id)
    assert done_res.data["delivered_at"] is not None

    order = Order.objects.get(pk=order_id)
    assert order.delivered_at <= timezone.now()
    assert Notification.objects.filter(recipient=customer_user).count() == before_count + 1

    # Duplicate delivery confirmation is rejected
    dup_res = api_client.post(
        f"/api/v1/delivery/orders/{order_id}/transition/",
        {"status": "delivered", "confirm_delivery": True},
        format="json",
    )
    assert dup_res.status_code == 400

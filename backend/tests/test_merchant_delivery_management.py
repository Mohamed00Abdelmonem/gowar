from datetime import timedelta
from decimal import Decimal
import pytest
from django.utils import timezone

from apps.accounts.models import User
from apps.delivery.models import DeliveryDriverProfile, DeliveryShift
from apps.orders.models import Order, OrderStatusChoices


@pytest.mark.django_db
def test_merchant_delivery_personnel_crud_and_tenant_isolation(
    api_client, merchants_and_stores
):
    m1_user = merchants_and_stores["s1"].merchant.user
    m2_user = merchants_and_stores["s2"].merchant.user

    # Merchant 1 creates a delivery driver
    api_client.force_authenticate(user=m1_user)
    create_res = api_client.post(
        "/api/v1/merchant/delivery-management/drivers/",
        {
            "email": "driver1@m1.demo",
            "password": "StrongPass123!",
            "first_name": "سعد",
            "last_name": "حسن",
            "phone_number": "01011112222",
            "vehicle_type": "motorcycle",
            "vehicle_plate": "أ ب ج 123",
        },
        format="json",
    )
    assert create_res.status_code == 201
    driver_data = create_res.data
    assert "password" not in driver_data
    assert driver_data["email"] == "driver1@m1.demo"
    assert driver_data["is_active"] is True
    assert driver_data["operational_status"] == "offline"
    driver_id = driver_data["id"]

    # Duplicate phone number rejected
    dup_phone = api_client.post(
        "/api/v1/merchant/delivery-management/drivers/",
        {
            "email": "driver2@m1.demo",
            "password": "StrongPass123!",
            "first_name": "أحمد",
            "phone_number": "01011112222",
        },
        format="json",
    )
    assert dup_phone.status_code == 400

    # Edit driver details
    patch_res = api_client.patch(
        f"/api/v1/merchant/delivery-management/drivers/{driver_id}/",
        {"first_name": "سعد المعدل", "vehicle_type": "bicycle"},
        format="json",
    )
    assert patch_res.status_code == 200
    assert patch_res.data["first_name"] == "سعد المعدل"
    assert patch_res.data["vehicle_type"] == "bicycle"

    # Merchant 2 cannot view, edit, toggle, or reset password for Merchant 1's driver
    api_client.force_authenticate(user=m2_user)
    assert (
        api_client.get(
            f"/api/v1/merchant/delivery-management/drivers/{driver_id}/"
        ).status_code
        == 404
    )
    assert (
        api_client.patch(
            f"/api/v1/merchant/delivery-management/drivers/{driver_id}/",
            {"first_name": "Hacked"},
            format="json",
        ).status_code
        == 404
    )
    assert (
        api_client.post(
            f"/api/v1/merchant/delivery-management/drivers/{driver_id}/toggle-active/",
            {"is_active": False},
            format="json",
        ).status_code
        == 404
    )
    assert (
        api_client.post(
            f"/api/v1/merchant/delivery-management/drivers/{driver_id}/reset-password/",
            {"new_password": "NewStrongPass123!"},
            format="json",
        ).status_code
        == 404
    )
    assert api_client.get("/api/v1/merchant/delivery-management/drivers/").data == []

    # Merchant 1 resets driver password and driver can log in with new password
    api_client.force_authenticate(user=m1_user)
    reset_res = api_client.post(
        f"/api/v1/merchant/delivery-management/drivers/{driver_id}/reset-password/",
        {"new_password": "NewDriverPass123!"},
        format="json",
    )
    assert reset_res.status_code == 200

    api_client.force_authenticate(user=None)
    login_res = api_client.post(
        "/api/v1/auth/delivery/login/",
        {"phone_number": "01011112222", "password": "NewDriverPass123!"},
        format="json",
    )
    assert login_res.status_code == 200


@pytest.mark.django_db
def test_driver_deactivation_blocks_active_orders_and_preserves_history(
    api_client, customer_user, merchants_and_stores
):
    s1 = merchants_and_stores["s1"]
    m1_user = s1.merchant.user
    m2_user = merchants_and_stores["s2"].merchant.user

    # Create driver for M1 and driver for M2
    api_client.force_authenticate(user=m1_user)
    d1 = api_client.post(
        "/api/v1/merchant/delivery-management/drivers/",
        {
            "email": "d1@m1.demo",
            "password": "StrongPass123!",
            "first_name": "كريم",
            "phone_number": "01022223333",
        },
        format="json",
    ).data

    api_client.force_authenticate(user=m2_user)
    d2 = api_client.post(
        "/api/v1/merchant/delivery-management/drivers/",
        {
            "email": "d2@m2.demo",
            "password": "StrongPass123!",
            "first_name": "رامي",
            "phone_number": "01044445555",
        },
        format="json",
    ).data

    # Create an active order for s1
    order = Order.objects.create(
        order_number="GW-TEST-DM1",
        customer=customer_user,
        store=s1,
        delivery_address_snapshot={
            "formatted_address": "Mansoura",
            "latitude": 31.04,
            "longitude": 31.37,
        },
        subtotal=Decimal("100.00"),
        delivery_fee=Decimal("10.00"),
        total_amount=Decimal("110.00"),
        commission_rate_snapshot=Decimal("5.00"),
        commission_amount=Decimal("5.00"),
        merchant_net_amount=Decimal("95.00"),
        order_status=OrderStatusChoices.READY_FOR_DELIVERY,
    )

    # M1 cannot assign M2's driver
    api_client.force_authenticate(user=m1_user)
    bad_assign = api_client.post(
        f"/api/v1/merchant/orders/{order.id}/assign-delivery/",
        {"delivery_user_id": d2["user_id"]},
        format="json",
    )
    assert bad_assign.status_code == 403

    # M1 assigns M1's driver
    good_assign = api_client.post(
        f"/api/v1/merchant/orders/{order.id}/assign-delivery/",
        {"delivery_user_id": d1["user_id"]},
        format="json",
    )
    assert good_assign.status_code == 200

    # Deactivation blocked while driver has active assigned order
    blocked_deact = api_client.post(
        f"/api/v1/merchant/delivery-management/drivers/{d1['id']}/toggle-active/",
        {"is_active": False},
        format="json",
    )
    assert blocked_deact.status_code == 400

    # Complete the order
    order.refresh_from_db()
    order.order_status = OrderStatusChoices.DELIVERED
    order.delivered_at = timezone.now()
    order.delivered_by_id = d1["user_id"]
    order.save()

    # Now deactivation succeeds and preserves historical order
    ok_deact = api_client.post(
        f"/api/v1/merchant/delivery-management/drivers/{d1['id']}/toggle-active/",
        {"is_active": False, "archive": True},
        format="json",
    )
    assert ok_deact.status_code == 200
    assert ok_deact.data["is_active"] is False
    assert ok_deact.data["operational_status"] == "inactive"

    order.refresh_from_db()
    assert str(order.assigned_delivery_person_id) == d1["user_id"]

    # Deactivated driver cannot log in or access delivery endpoints
    api_client.force_authenticate(user=None)
    login_res = api_client.post(
        "/api/v1/auth/delivery/login/",
        {"phone_number": "01022223333", "password": "StrongPass123!"},
        format="json",
    )
    assert login_res.status_code == 400


@pytest.mark.django_db
def test_shifts_location_tracking_stale_behavior_and_performance(
    api_client, customer_user, merchants_and_stores
):
    s1 = merchants_and_stores["s1"]
    m1_user = s1.merchant.user

    api_client.force_authenticate(user=m1_user)
    d1 = api_client.post(
        "/api/v1/merchant/delivery-management/drivers/",
        {
            "email": "track@m1.demo",
            "password": "StrongPass123!",
            "first_name": "طارق",
            "phone_number": "01077778888",
        },
        format="json",
    ).data
    driver_user = User.objects.get(pk=d1["user_id"])

    # Driver starts shift (and cannot start duplicate active shift)
    api_client.force_authenticate(user=driver_user)
    s_res = api_client.post("/api/v1/delivery/shift/start/", {}, format="json")
    assert s_res.status_code == 201
    dup_s = api_client.post("/api/v1/delivery/shift/start/", {}, format="json")
    assert dup_s.status_code == 400

    # Invalid coordinates rejected
    bad_loc = api_client.post(
        "/api/v1/delivery/location/",
        {"latitude": 120.0, "longitude": 31.0, "is_sharing": True},
        format="json",
    )
    assert bad_loc.status_code == 400

    # Valid location update
    ok_loc = api_client.post(
        "/api/v1/delivery/location/",
        {"latitude": 31.0409, "longitude": 31.3785, "accuracy_m": 12.5, "is_sharing": True},
        format="json",
    )
    assert ok_loc.status_code == 200
    assert ok_loc.data["is_location_sharing"] is True

    # Merchant sees driver as live & available
    api_client.force_authenticate(user=m1_user)
    track_res = api_client.get("/api/v1/merchant/delivery-management/tracking/")
    assert track_res.status_code == 200
    drv = track_res.data["drivers"][0]
    assert drv["location_status"] == "live"
    assert drv["operational_status"] == "available"

    # Simulate stale location (>3 minutes old)
    DeliveryDriverProfile.objects.filter(pk=d1["id"]).update(
        last_location_at=timezone.now() - timedelta(minutes=10),
        last_seen_at=timezone.now() - timedelta(minutes=10),
    )
    stale_res = api_client.get("/api/v1/merchant/delivery-management/tracking/")
    drv_stale = stale_res.data["drivers"][0]
    assert drv_stale["location_status"] == "stale"
    assert drv_stale["operational_status"] == "offline"

    # Create 1 delivered order today and 1 cancelled order today; cancelled must NOT count as delivered
    Order.objects.create(
        order_number="GW-PERF-1",
        customer=customer_user,
        store=s1,
        delivery_address_snapshot={"formatted_address": "Mansoura"},
        subtotal=Decimal("60.00"),
        delivery_fee=Decimal("10.00"),
        total_amount=Decimal("70.00"),
        commission_rate_snapshot=Decimal("5.00"),
        commission_amount=Decimal("3.00"),
        merchant_net_amount=Decimal("57.00"),
        order_status=OrderStatusChoices.DELIVERED,
        assigned_delivery_person=driver_user,
        assigned_at=timezone.now() - timedelta(minutes=25),
        delivered_at=timezone.now(),
        delivered_by=driver_user,
    )
    Order.objects.create(
        order_number="GW-PERF-2",
        customer=customer_user,
        store=s1,
        delivery_address_snapshot={"formatted_address": "Mansoura"},
        subtotal=Decimal("60.00"),
        delivery_fee=Decimal("10.00"),
        total_amount=Decimal("70.00"),
        commission_rate_snapshot=Decimal("5.00"),
        commission_amount=Decimal("3.00"),
        merchant_net_amount=Decimal("57.00"),
        order_status=OrderStatusChoices.CANCELLED,
        assigned_delivery_person=driver_user,
        assigned_at=timezone.now() - timedelta(minutes=10),
    )

    perf_res = api_client.get("/api/v1/merchant/delivery-management/performance/")
    assert perf_res.status_code == 200
    assert perf_res.data["totals"]["delivered_today"] == 1
    p_drv = perf_res.data["drivers"][0]
    assert p_drv["delivered_today"] == 1
    assert p_drv["cancelled_today"] == 1
    assert p_drv["avg_delivery_duration_minutes"] is not None

    # Driver ends shift -> stops sharing
    api_client.force_authenticate(user=driver_user)
    end_res = api_client.post("/api/v1/delivery/shift/end/", {}, format="json")
    assert end_res.status_code == 200
    assert DeliveryShift.objects.filter(driver_id=d1["id"], is_active=True).count() == 0

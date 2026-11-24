import pytest
from pywebpush import WebPushException

from apps.accounts.models import User, UserRole
from apps.delivery.models import DeliveryDriverProfile
from apps.notifications.models import Notification, PushSubscription
from apps.notifications.services import create_and_dispatch_notification


@pytest.fixture
def two_delivery_drivers(db, merchants_and_stores):
    merchant = merchants_and_stores["s1"].merchant
    d1 = User.objects.create_user(
        email="notif-driver1@gowar.test",
        password="DriverPassword123!",
        first_name="يوسف",
        last_name="أحمد",
        phone_number="01077771111",
        role=UserRole.DELIVERY,
        is_verified=True,
    )
    DeliveryDriverProfile.objects.create(user=d1, merchant=merchant)
    d2 = User.objects.create_user(
        email="notif-driver2@gowar.test",
        password="DriverPassword123!",
        first_name="عمر",
        last_name="محمود",
        phone_number="01077772222",
        role=UserRole.DELIVERY,
        is_verified=True,
    )
    DeliveryDriverProfile.objects.create(user=d2, merchant=merchant)
    return {"d1": d1, "d2": d2}


@pytest.mark.django_db
def test_delivery_notifications_persistence_isolation_mark_read_and_deduplication(
    api_client, two_delivery_drivers, customer_user, merchants_and_stores, sample_catalog
):
    d1 = two_delivery_drivers["d1"]
    d2 = two_delivery_drivers["d2"]
    s1 = merchants_and_stores["s1"]
    p1 = sample_catalog["p1"]

    # Customer places order, merchant accepts -> prepares -> assigns d1 -> marks ready
    api_client.force_authenticate(user=customer_user)
    api_client.post(
        "/api/v1/cart/items/",
        {"product_id": str(p1.id), "quantity": 2},
        format="json",
    )
    order_res = api_client.post(
        "/api/v1/orders/",
        {
            "address_id": str(customer_user.addresses.first().id),
            "payment_method": "cod",
        },
        format="json",
    )
    assert order_res.status_code == 201
    order_id = order_res.data["id"]

    api_client.force_authenticate(user=s1.merchant.user)
    for st in ("accepted", "preparing"):
        assert (
            api_client.post(
                f"/api/v1/merchant/orders/{order_id}/transition/",
                {"status": st},
                format="json",
            ).status_code
            == 200
        )
    assert (
        api_client.post(
            f"/api/v1/merchant/orders/{order_id}/assign-delivery/",
            {"delivery_user_id": str(d1.id)},
            format="json",
        ).status_code
        == 200
    )
    assert (
        api_client.post(
            f"/api/v1/merchant/orders/{order_id}/transition/",
            {"status": "ready_for_delivery"},
            format="json",
        ).status_code
        == 200
    )

    # d1 sees persisted assignment + ready_for_delivery notifications with deep link
    api_client.force_authenticate(user=d1)
    list_res = api_client.get("/api/v1/notifications/")
    assert list_res.status_code == 200
    d1_notifs = list_res.data["results"]
    assert len(d1_notifs) >= 2
    assert all(n["is_read"] is False for n in d1_notifs)
    assert any(n["link"] == f"/delivery/orders/{order_id}" for n in d1_notifs)

    # d2 cannot see or mark d1's notification read
    api_client.force_authenticate(user=d2)
    assert api_client.get("/api/v1/notifications/").data["results"] == []
    first_notif_id = d1_notifs[0]["id"]
    assert api_client.post(f"/api/v1/notifications/{first_notif_id}/mark-read/").status_code == 404

    # d1 marks single notification as read, then marks all as read
    api_client.force_authenticate(user=d1)
    single_res = api_client.post(f"/api/v1/notifications/{first_notif_id}/mark-read/")
    assert single_res.status_code == 200
    assert single_res.data["is_read"] is True

    all_res = api_client.post("/api/v1/notifications/mark-read/")
    assert all_res.status_code == 200
    assert Notification.objects.filter(recipient=d1, is_read=False).count() == 0

    # Deduplication: repeating same event_key does not create duplicate Notification rows
    before = Notification.objects.filter(recipient=d1).count()
    create_and_dispatch_notification(
        recipient=d1,
        title="اختبار التكرار",
        body="رسالة",
        link=f"/delivery/orders/{order_id}",
        event_key=f"dedup-test-{order_id}",
    )
    create_and_dispatch_notification(
        recipient=d1,
        title="اختبار التكرار",
        body="رسالة",
        link=f"/delivery/orders/{order_id}",
        event_key=f"dedup-test-{order_id}",
    )
    assert Notification.objects.filter(recipient=d1).count() == before + 1

    # Reassignment notifies previous driver (d1) and new driver (d2)
    api_client.force_authenticate(user=s1.merchant.user)
    assert (
        api_client.post(
            f"/api/v1/merchant/orders/{order_id}/assign-delivery/",
            {"delivery_user_id": str(d2.id)},
            format="json",
        ).status_code
        == 200
    )
    assert Notification.objects.filter(recipient=d1, link="/delivery").exists()
    assert Notification.objects.filter(recipient=d2, link=f"/delivery/orders/{order_id}").exists()


@pytest.mark.django_db
def test_delivery_push_subscription_and_expired_cleanup(
    api_client, two_delivery_drivers, monkeypatch, settings, django_capture_on_commit_callbacks
):
    d1 = two_delivery_drivers["d1"]
    settings.VAPID_PUBLIC_KEY = "test-pub-key"
    settings.VAPID_PRIVATE_KEY = "test-priv-key"
    settings.WEB_PUSH_SYNC = True

    api_client.force_authenticate(user=d1)
    sub_res = api_client.post(
        "/api/v1/notifications/push/subscriptions/",
        {
            "endpoint": "https://fcm.googleapis.com/fcm/send/delivery-device-1",
            "keys": {"p256dh": "p256dh-val", "auth": "auth-val"},
            "language": "ar",
        },
        format="json",
    )
    assert sub_res.status_code == 201
    assert PushSubscription.objects.filter(user=d1, is_active=True).count() == 1

    class FakeGoneResponse:
        status_code = 410

    def fake_webpush(*args, **kwargs):
        raise WebPushException("Gone", response=FakeGoneResponse())

    monkeypatch.setattr("apps.notifications.services.webpush", fake_webpush)
    with django_capture_on_commit_callbacks(execute=True):
        create_and_dispatch_notification(
            recipient=d1,
            title="طلب توصيل",
            body="تم إسناد طلب جديد",
            link="/delivery/orders/test-id",
            event_key="push-gone-test",
        )
    assert PushSubscription.objects.filter(user=d1).count() == 0

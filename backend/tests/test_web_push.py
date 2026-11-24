from types import SimpleNamespace
from unittest.mock import patch

import pytest
from pywebpush import WebPushException

from apps.notifications.models import Notification, NotificationPreference, PushSubscription


@pytest.mark.django_db
def test_push_config_endpoint_never_exposes_private_key(api_client, settings):
    settings.VAPID_PUBLIC_KEY = "BTestPublicKey123"
    settings.VAPID_PRIVATE_KEY = "SuperSecretPrivateKeyDoNotExpose"

    res = api_client.get("/api/v1/notifications/push/config/")
    assert res.status_code == 200
    assert res.data["enabled"] is True
    assert res.data["vapid_public_key"] == "BTestPublicKey123"
    assert "SuperSecretPrivateKeyDoNotExpose" not in str(res.data)


@pytest.mark.django_db
def test_push_subscription_crud_multi_device_and_deduplication(api_client, customer_user):
    api_client.force_authenticate(user=customer_user)

    # Reject non-HTTPS endpoint
    bad_res = api_client.post(
        "/api/v1/notifications/push/subscriptions/",
        {
            "endpoint": "http://push.example.com/sub/1",
            "keys": {"p256dh": "key1", "auth": "auth1"},
            "language": "en",
        },
        format="json",
    )
    assert bad_res.status_code == 400

    # Register two devices
    for idx in (1, 2):
        res = api_client.post(
            "/api/v1/notifications/push/subscriptions/",
            {
                "endpoint": f"https://fcm.googleapis.com/fcm/send/device-{idx}",
                "keys": {"p256dh": f"p256dh-{idx}", "auth": f"auth-{idx}"},
                "language": "en" if idx == 2 else "ar",
            },
            format="json",
        )
        assert res.status_code == 201

    # Duplicate endpoint updates instead of creating a duplicate row
    dup_res = api_client.post(
        "/api/v1/notifications/push/subscriptions/",
        {
            "endpoint": "https://fcm.googleapis.com/fcm/send/device-1",
            "keys": {"p256dh": "p256dh-1-updated", "auth": "auth-1-updated"},
            "language": "en",
        },
        format="json",
    )
    assert dup_res.status_code == 201
    assert PushSubscription.objects.filter(user=customer_user).count() == 2

    # Unregister device-1 (logout cleanup)
    del_res = api_client.delete(
        "/api/v1/notifications/push/subscriptions/",
        {"endpoint": "https://fcm.googleapis.com/fcm/send/device-1"},
        format="json",
    )
    assert del_res.status_code == 200
    assert del_res.data["deleted"] is True
    assert PushSubscription.objects.filter(user=customer_user).count() == 1


@pytest.mark.django_db
def test_order_lifecycle_dispatches_web_push_and_cleans_up_expired_410(
    api_client,
    customer_user,
    merchants_and_stores,
    sample_catalog,
    settings,
    django_capture_on_commit_callbacks,
):
    customer_address = customer_user.addresses.first()
    approved_store = merchants_and_stores["s1"]
    merchant_user = approved_store.merchant.user
    product = sample_catalog["p1"]

    settings.VAPID_PUBLIC_KEY = "BTestPublicKey123"
    settings.VAPID_PRIVATE_KEY = "TestPrivateKey123"
    settings.VAPID_CLAIMS_EMAIL = "mailto:admin@gowar.local"

    PushSubscription.objects.create(
        user=merchant_user,
        endpoint="https://push.example.com/merchant-device",
        p256dh="m-p256dh",
        auth="m-auth",
        language="en",
    )
    PushSubscription.objects.create(
        user=customer_user,
        endpoint="https://push.example.com/customer-device-expired",
        p256dh="c-p256dh",
        auth="c-auth",
        language="en",
    )

    sent_calls = []

    def fake_webpush(subscription_info, data, **kwargs):
        endpoint = subscription_info["endpoint"]
        if "expired" in endpoint:
            raise WebPushException(
                "Gone",
                response=SimpleNamespace(status_code=410, text="Gone"),
            )
        sent_calls.append((endpoint, data))

    with patch("apps.notifications.services.webpush", side_effect=fake_webpush):
        api_client.force_authenticate(user=customer_user)
        api_client.post(
            "/api/v1/cart/items/",
            {"product_id": str(product.id), "quantity": 2},
            format="json",
        )
        with django_capture_on_commit_callbacks(execute=True):
            order_res = api_client.post(
                "/api/v1/orders/",
                {"address_id": str(customer_address.id), "payment_method": "cod"},
                format="json",
            )
        assert order_res.status_code == 201
        order_id = order_res.data["id"]

        # Merchant received new order push; expired customer subscription was auto-deleted (410)
        assert any(
            ep == "https://push.example.com/merchant-device" and "New Order Received" in payload
            for ep, payload in sent_calls
        )
        assert not PushSubscription.objects.filter(
            endpoint="https://push.example.com/customer-device-expired"
        ).exists()

        # Re-register active customer subscription and disable/enable preferences
        PushSubscription.objects.create(
            user=customer_user,
            endpoint="https://push.example.com/customer-device-active",
            p256dh="c2-p256dh",
            auth="c2-auth",
            language="en",
        )

        # Merchant accepts & marks out for delivery -> customer receives push
        api_client.force_authenticate(user=merchant_user)
        for next_status in ("accepted", "preparing", "ready_for_delivery", "out_for_delivery"):
            with django_capture_on_commit_callbacks(execute=True):
                tr_res = api_client.post(
                    f"/api/v1/merchant/orders/{order_id}/transition/",
                    {"status": next_status},
                    format="json",
                )
            assert tr_res.status_code == 200

        assert any(
            ep == "https://push.example.com/customer-device-active"
            and "Your Order Is On Its Way" in payload
            for ep, payload in sent_calls
        )

        # Respect push_enabled = False preference
        NotificationPreference.objects.update_or_create(
            user=customer_user,
            defaults={"push_enabled": False, "order_updates": True},
        )
        count_before = len(sent_calls)
        with django_capture_on_commit_callbacks(execute=True):
            tr_done = api_client.post(
                f"/api/v1/merchant/orders/{order_id}/transition/",
                {"status": "delivered"},
                format="json",
            )
        assert tr_done.status_code == 200
        assert not any(
            ep == "https://push.example.com/customer-device-active"
            for ep, _ in sent_calls[count_before:]
        )
        assert Notification.objects.filter(recipient=customer_user).count() >= 5

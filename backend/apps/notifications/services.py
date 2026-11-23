import json
import logging
import os
import threading
from urllib.parse import urlparse

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from pywebpush import WebPushException, webpush

from .models import Notification, NotificationPreference, PushSubscription

logger = logging.getLogger(__name__)


def is_web_push_configured() -> bool:
    return bool(
        getattr(settings, "VAPID_PUBLIC_KEY", "")
        and getattr(settings, "VAPID_PRIVATE_KEY", "")
    )


def _send_single_push(subscription_id: str, payload_ar: dict, payload_en: dict) -> None:
    sub = PushSubscription.objects.filter(pk=subscription_id, is_active=True).first()
    if not sub:
        return

    vapid_private_key = getattr(settings, "VAPID_PRIVATE_KEY", "")
    vapid_claims_email = getattr(settings, "VAPID_CLAIMS_EMAIL", "mailto:admin@gowar.local")
    if not vapid_private_key:
        return

    parsed = urlparse(sub.endpoint)
    aud = f"{parsed.scheme}://{parsed.netloc}" if parsed.scheme and parsed.netloc else ""
    claims = {"sub": vapid_claims_email}
    if aud:
        claims["aud"] = aud

    payload = payload_en if sub.language == "en" else payload_ar
    subscription_info = {
        "endpoint": sub.endpoint,
        "keys": {
            "p256dh": sub.p256dh,
            "auth": sub.auth,
        },
    }

    try:
        webpush(
            subscription_info=subscription_info,
            data=json.dumps(payload, ensure_ascii=False),
            vapid_private_key=vapid_private_key,
            vapid_claims=claims,
            ttl=3600,
            headers={"Urgency": "high"},
            timeout=5,
        )
        PushSubscription.objects.filter(pk=sub.pk).update(last_used_at=timezone.now())
    except WebPushException as exc:
        status_code = getattr(getattr(exc, "response", None), "status_code", None)
        if status_code in (404, 410):
            logger.info(
                "Removing expired/gone push subscription %s (HTTP %s)",
                sub.pk,
                status_code,
            )
            PushSubscription.objects.filter(pk=sub.pk).delete()
        else:
            logger.warning(
                "Web Push delivery failed for subscription %s (HTTP %s): %s",
                sub.pk,
                status_code,
                exc,
            )
    except Exception:
        logger.exception("Unexpected error sending Web Push to subscription %s", sub.pk)


def dispatch_push_to_user(
    *,
    user_id,
    title_ar: str,
    body_ar: str,
    title_en: str = "",
    body_en: str = "",
    link: str = "/",
    tag: str = "",
) -> None:
    if not is_web_push_configured():
        return

    pref = NotificationPreference.objects.filter(user_id=user_id).first()
    if pref is not None and (not pref.push_enabled or not pref.order_updates):
        return

    sub_ids = list(
        PushSubscription.objects.filter(user_id=user_id, is_active=True).values_list("id", flat=True)
    )
    if not sub_ids:
        return

    safe_url = link if link.startswith("/") else "/"
    payload_ar = {
        "title": title_ar,
        "body": body_ar,
        "url": safe_url,
        "icon": "/pwa-192x192.png",
        "badge": "/pwa-192x192.png",
        "tag": tag or "gowar-notification",
    }
    payload_en = {
        "title": title_en or title_ar,
        "body": body_en or body_ar,
        "url": safe_url,
        "icon": "/pwa-192x192.png",
        "badge": "/pwa-192x192.png",
        "tag": tag or "gowar-notification",
    }

    # Run synchronously during pytest / explicit sync mode, and in parallel daemon threads in production
    # so order creation/transition API responses are never delayed and slow endpoints don't block other devices.
    if os.environ.get("PYTEST_CURRENT_TEST") or getattr(settings, "WEB_PUSH_SYNC", False):
        for sid in sub_ids:
            _send_single_push(str(sid), payload_ar, payload_en)
    else:
        for sid in sub_ids:
            thread = threading.Thread(
                target=_send_single_push,
                args=(str(sid), payload_ar, payload_en),
                daemon=True,
            )
            thread.start()


def create_and_dispatch_notification(
    *,
    recipient,
    title: str,
    body: str,
    title_en: str = "",
    body_en: str = "",
    store=None,
    link: str = "",
    event_key: str = "",
) -> Notification:
    notification = Notification.objects.create(
        recipient=recipient,
        store=store,
        title=title,
        body=body,
        title_en=title_en,
        body_en=body_en,
        link=link,
    )

    recipient_id = recipient.pk
    tag = event_key or str(notification.id)

    transaction.on_commit(
        lambda: dispatch_push_to_user(
            user_id=recipient_id,
            title_ar=title,
            body_ar=body,
            title_en=title_en,
            body_en=body_en,
            link=link or "/",
            tag=tag,
        )
    )
    return notification

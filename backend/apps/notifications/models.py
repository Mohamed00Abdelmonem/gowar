from django.conf import settings
from django.db import models
from apps.common.models import UUIDModel, UUIDTimeStampedModel
from apps.stores.models import Store


class Notification(UUIDModel):
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    store = models.ForeignKey(
        Store,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="notifications",
    )
    title = models.CharField(max_length=160)
    body = models.TextField()
    title_en = models.CharField(max_length=160, blank=True)
    body_en = models.TextField(blank=True)
    link = models.CharField(max_length=255, blank=True)
    event_key = models.CharField(max_length=160, blank=True, db_index=True)
    is_read = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]


class NotificationPreference(UUIDTimeStampedModel):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notification_preference",
    )
    push_enabled = models.BooleanField(default=True)
    order_updates = models.BooleanField(default=True)

    def __str__(self):
        return f"NotificationPreference<{self.user_id}>(push={self.push_enabled})"


class PushSubscription(UUIDTimeStampedModel):
    class LanguageChoices(models.TextChoices):
        ARABIC = "ar", "Arabic"
        ENGLISH = "en", "English"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="push_subscriptions",
    )
    endpoint = models.URLField(max_length=500, unique=True)
    p256dh = models.CharField(max_length=255)
    auth = models.CharField(max_length=255)
    language = models.CharField(
        max_length=5,
        choices=LanguageChoices.choices,
        default=LanguageChoices.ARABIC,
    )
    user_agent = models.CharField(max_length=255, blank=True)
    is_active = models.BooleanField(default=True, db_index=True)
    last_used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-updated_at"]
        indexes = [
            models.Index(fields=["user", "is_active"]),
        ]

    def __str__(self):
        return f"PushSubscription<{self.user_id}>({self.endpoint[:40]}...)"

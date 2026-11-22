from django.urls import path
from .views import (
    MarkNotificationsReadView,
    NotificationListView,
    NotificationPreferenceView,
    PushConfigView,
    PushSubscriptionView,
)

urlpatterns = [
    path("", NotificationListView.as_view(), name="notifications-list"),
    path("mark-read/", MarkNotificationsReadView.as_view(), name="notifications-mark-read"),
    path("push/config/", PushConfigView.as_view(), name="notifications-push-config"),
    path("push/preferences/", NotificationPreferenceView.as_view(), name="notifications-push-preferences"),
    path("push/subscriptions/", PushSubscriptionView.as_view(), name="notifications-push-subscriptions"),
]

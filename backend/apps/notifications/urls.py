from django.urls import path
from .views import (
    MarkNotificationsReadView,
    MarkSingleNotificationReadView,
    NotificationListView,
    NotificationPreferenceView,
    PushConfigView,
    PushSubscriptionView,
)

urlpatterns = [
    path("", NotificationListView.as_view(), name="notifications-list"),
    path("mark-read/", MarkNotificationsReadView.as_view(), name="notifications-mark-read"),
    path(
        "<uuid:pk>/mark-read/",
        MarkSingleNotificationReadView.as_view(),
        name="notifications-mark-single-read",
    ),
    path("push/config/", PushConfigView.as_view(), name="notifications-push-config"),
    path("push/preferences/", NotificationPreferenceView.as_view(), name="notifications-push-preferences"),
    path("push/subscriptions/", PushSubscriptionView.as_view(), name="notifications-push-subscriptions"),
]

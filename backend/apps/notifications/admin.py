from django.contrib import admin

from .models import Notification, NotificationPreference, PushSubscription


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ["title", "recipient", "store", "is_read", "created_at"]
    list_filter = ["is_read", "created_at"]
    search_fields = ["title", "title_en", "body", "recipient__email", "store__name"]
    raw_id_fields = ["recipient", "store"]
    readonly_fields = ["created_at"]


@admin.register(NotificationPreference)
class NotificationPreferenceAdmin(admin.ModelAdmin):
    list_display = ["user", "push_enabled", "order_updates", "updated_at"]
    list_filter = ["push_enabled", "order_updates"]
    search_fields = ["user__email"]
    raw_id_fields = ["user"]


@admin.register(PushSubscription)
class PushSubscriptionAdmin(admin.ModelAdmin):
    list_display = ["user", "language", "is_active", "last_used_at", "created_at"]
    list_filter = ["is_active", "language", "created_at"]
    search_fields = ["user__email", "endpoint"]
    raw_id_fields = ["user"]
    readonly_fields = ["created_at", "updated_at", "last_used_at"]

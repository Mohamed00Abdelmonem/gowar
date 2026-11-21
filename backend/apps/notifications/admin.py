from django.contrib import admin

from .models import Notification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ["title", "recipient", "store", "is_read", "created_at"]
    list_filter = ["is_read", "created_at"]
    search_fields = ["title", "body", "recipient__email", "store__name"]
    raw_id_fields = ["recipient", "store"]
    readonly_fields = ["created_at"]

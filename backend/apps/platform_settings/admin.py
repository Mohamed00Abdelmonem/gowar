from django.contrib import admin

from .models import PlatformSettings


@admin.register(PlatformSettings)
class PlatformSettingsAdmin(admin.ModelAdmin):
    list_display = [
        "platform_name",
        "platform_name_en",
        "default_commission_rate",
        "currency",
        "support_phone",
        "auto_approve_merchants",
        "updated_at",
    ]
    readonly_fields = ["created_at", "updated_at"]

from django.contrib import admin
from .models import DeliveryDriverProfile, DeliveryShift


@admin.register(DeliveryDriverProfile)
class DeliveryDriverProfileAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "merchant",
        "vehicle_type",
        "is_active",
        "is_archived",
        "is_location_sharing",
        "last_seen_at",
    )
    list_filter = ("is_active", "is_archived", "vehicle_type", "merchant")
    search_fields = ("user__email", "user__first_name", "user__last_name", "user__phone_number")


@admin.register(DeliveryShift)
class DeliveryShiftAdmin(admin.ModelAdmin):
    list_display = ("driver", "started_at", "ended_at", "is_active")
    list_filter = ("is_active",)

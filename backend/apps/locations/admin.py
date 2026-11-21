from django.contrib import admin
from django.contrib.gis.admin import GISModelAdmin

from .models import Area, CustomerAddress, CustomerProfile


@admin.register(Area)
class AreaAdmin(GISModelAdmin):
    list_display = ["name_ar", "name_en", "city_ar", "city_en", "is_active", "created_at"]
    list_filter = ["city_en", "is_active"]
    search_fields = ["name_ar", "name_en", "delivery_hub_note"]
    list_editable = ["is_active"]


@admin.register(CustomerProfile)
class CustomerProfileAdmin(admin.ModelAdmin):
    list_display = ["user", "search_radius_km", "created_at", "updated_at"]
    search_fields = ["user__email", "user__first_name", "user__phone_number"]
    raw_id_fields = ["user"]


@admin.register(CustomerAddress)
class CustomerAddressAdmin(GISModelAdmin):
    list_display = [
        "customer",
        "label",
        "area",
        "formatted_address",
        "latitude",
        "longitude",
        "is_default",
        "updated_at",
    ]
    list_filter = ["area", "is_default"]
    search_fields = ["customer__email", "formatted_address", "recipient_name", "phone_number"]
    raw_id_fields = ["customer"]

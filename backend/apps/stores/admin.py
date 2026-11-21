from django.contrib import admin
from django.contrib.gis.admin import GISModelAdmin

from apps.merchants.models import ApprovalStatus
from apps.merchants.services import update_merchant_approval
from .models import Store


@admin.register(Store)
class StoreAdmin(GISModelAdmin):
    list_display = [
        "name",
        "name_en",
        "merchant",
        "store_type",
        "area",
        "approval_status",
        "is_active",
        "is_open",
        "delivery_radius_km",
        "delivery_fee",
        "commission_rate",
        "rating",
    ]
    list_filter = ["approval_status", "store_type", "area", "is_active", "is_open", "delivery_enabled"]
    search_fields = ["name", "name_en", "slug", "phone_number", "address", "merchant__business_name"]
    list_editable = ["is_open", "commission_rate"]
    prepopulated_fields = {"slug": ("name_en",)}
    raw_id_fields = ["merchant"]
    actions = ["approve_stores", "open_stores", "close_stores"]

    @admin.action(description="Approve selected stores (and parent merchants)")
    def approve_stores(self, request, queryset):
        for store in queryset.select_related("merchant"):
            update_merchant_approval(store.merchant, ApprovalStatus.APPROVED)

    @admin.action(description="Mark selected stores Open")
    def open_stores(self, request, queryset):
        queryset.update(is_open=True)

    @admin.action(description="Mark selected stores Closed")
    def close_stores(self, request, queryset):
        queryset.update(is_open=False)

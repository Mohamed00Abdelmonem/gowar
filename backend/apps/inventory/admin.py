from django.contrib import admin

from .models import InventoryMovement


@admin.register(InventoryMovement)
class InventoryMovementAdmin(admin.ModelAdmin):
    list_display = [
        "product",
        "store",
        "movement_type",
        "quantity",
        "previous_quantity",
        "new_quantity",
        "reference_type",
        "performed_by",
        "created_at",
    ]
    list_filter = ["movement_type", "reference_type", "store", "created_at"]
    search_fields = ["product__name", "store__name", "reference_id", "note"]
    raw_id_fields = ["product", "store", "performed_by"]
    readonly_fields = ["created_at"]

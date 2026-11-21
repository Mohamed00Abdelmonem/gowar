from django.contrib import admin

from .models import StoreReview


@admin.register(StoreReview)
class StoreReviewAdmin(admin.ModelAdmin):
    list_display = ["store", "customer", "order", "rating", "created_at"]
    list_filter = ["rating", "store", "created_at"]
    search_fields = ["store__name", "customer__email", "order__order_number", "comment"]
    raw_id_fields = ["customer", "store", "order"]
    readonly_fields = ["created_at", "updated_at"]

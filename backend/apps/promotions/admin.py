from django.contrib import admin

from .models import Promotion


@admin.register(Promotion)
class PromotionAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "promotion_type",
        "is_active",
        "is_archived",
        "display_order",
        "start_at",
        "end_at",
        "impressions_count",
        "clicks_count",
    )
    list_filter = ("promotion_type", "is_active", "is_archived", "is_paid_campaign")
    search_fields = ("title", "title_en", "description", "description_en")
    ordering = ("-priority_boost", "display_order", "-created_at")

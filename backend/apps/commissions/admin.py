from django.contrib import admin, messages

from .models import CommissionRecord, CommissionStatus, RefundRecord
from .services import settle_commission_record


@admin.register(CommissionRecord)
class CommissionRecordAdmin(admin.ModelAdmin):
    list_display = [
        "order",
        "store",
        "order_total_snapshot",
        "commission_rate_snapshot",
        "commission_amount",
        "reversed_commission_amount",
        "merchant_net_amount",
        "status",
        "settled_at",
        "created_at",
    ]
    list_filter = ["status", "store", "created_at"]
    search_fields = ["order__order_number", "store__name"]
    raw_id_fields = ["order", "store"]
    readonly_fields = ["created_at", "updated_at", "settled_at"]
    actions = ["settle_earned_commissions"]

    @admin.action(description="Mark selected earned commissions as Settled")
    def settle_earned_commissions(self, request, queryset):
        settled_count = 0
        for rec in queryset.filter(status=CommissionStatus.EARNED):
            settle_commission_record(rec.id)
            settled_count += 1
        self.message_user(request, f"Settled {settled_count} commission record(s).", messages.SUCCESS)


@admin.register(RefundRecord)
class RefundRecordAdmin(admin.ModelAdmin):
    list_display = [
        "order",
        "amount",
        "commission_reversed",
        "processed_by",
        "created_at",
    ]
    list_filter = ["created_at"]
    search_fields = ["order__order_number", "reason", "processed_by__email"]
    raw_id_fields = ["order", "commission_record", "processed_by"]
    readonly_fields = ["created_at", "updated_at"]

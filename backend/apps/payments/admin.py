from django.contrib import admin

from .models import PaymentTransaction


@admin.register(PaymentTransaction)
class PaymentTransactionAdmin(admin.ModelAdmin):
    list_display = [
        "order",
        "payment_method",
        "status",
        "amount",
        "currency",
        "provider_name",
        "provider_reference",
        "paid_at",
        "created_at",
    ]
    list_filter = ["status", "payment_method", "provider_name", "created_at"]
    search_fields = ["order__order_number", "provider_reference"]
    raw_id_fields = ["order"]
    readonly_fields = ["created_at", "updated_at"]

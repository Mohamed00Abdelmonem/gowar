from django.contrib import admin

from .models import Order, OrderItem, OrderStatusHistory


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    raw_id_fields = ["product"]
    readonly_fields = [
        "product_name_snapshot",
        "product_sku_snapshot",
        "unit_price_snapshot",
        "quantity",
        "line_total",
    ]


class OrderStatusHistoryInline(admin.TabularInline):
    model = OrderStatusHistory
    extra = 0
    raw_id_fields = ["actor"]
    readonly_fields = ["status", "actor", "actor_name", "note", "created_at"]


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = [
        "order_number",
        "customer",
        "store",
        "order_status",
        "payment_method",
        "payment_status",
        "subtotal",
        "delivery_fee",
        "total_amount",
        "commission_amount",
        "merchant_net_amount",
        "created_at",
    ]
    list_filter = ["order_status", "payment_status", "payment_method", "store", "created_at"]
    search_fields = ["order_number", "customer__email", "customer__phone_number", "store__name"]
    raw_id_fields = ["customer", "store"]
    readonly_fields = ["created_at", "updated_at"]
    inlines = [OrderItemInline, OrderStatusHistoryInline]


@admin.register(OrderItem)
class OrderItemAdmin(admin.ModelAdmin):
    list_display = [
        "order",
        "product_name_snapshot",
        "unit_price_snapshot",
        "quantity",
        "line_total",
    ]
    search_fields = ["order__order_number", "product_name_snapshot", "product_sku_snapshot"]
    raw_id_fields = ["order", "product"]


@admin.register(OrderStatusHistory)
class OrderStatusHistoryAdmin(admin.ModelAdmin):
    list_display = ["order", "status", "actor_name", "note", "created_at"]
    list_filter = ["status", "created_at"]
    search_fields = ["order__order_number", "actor_name", "note"]
    raw_id_fields = ["order", "actor"]
    readonly_fields = ["created_at"]

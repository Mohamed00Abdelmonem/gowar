from rest_framework import serializers
from .models import Order, OrderItem, OrderStatusHistory


class OrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderItem
        fields = [
            "id",
            "product",
            "product_name_snapshot",
            "product_name_en_snapshot",
            "product_sku_snapshot",
            "unit_price_snapshot",
            "quantity",
            "line_total",
        ]


class OrderStatusHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderStatusHistory
        fields = ["id", "status", "actor_name", "note", "created_at"]


class OrderSerializer(serializers.ModelSerializer):
    store_name = serializers.CharField(source="store.name", read_only=True)
    store_name_en = serializers.CharField(source="store.name_en", read_only=True)
    customer_name = serializers.CharField(source="customer.full_name", read_only=True)
    customer_phone = serializers.CharField(source="customer.phone_number", read_only=True)
    items = OrderItemSerializer(many=True, read_only=True)
    status_history = OrderStatusHistorySerializer(many=True, read_only=True)

    class Meta:
        model = Order
        fields = [
            "id",
            "order_number",
            "customer",
            "customer_name",
            "customer_phone",
            "store",
            "store_name",
            "store_name_en",
            "delivery_address_snapshot",
            "subtotal",
            "delivery_fee",
            "delivery_distance_km",
            "billable_distance_km",
            "delivery_price_per_km_snapshot",
            "discount_amount",
            "total_amount",
            "commission_rate_snapshot",
            "commission_amount",
            "merchant_net_amount",
            "payment_method",
            "payment_status",
            "order_status",
            "customer_notes",
            "reject_reason",
            "estimated_delivery_minutes",
            "items",
            "status_history",
            "created_at",
            "updated_at",
        ]


class CustomDeliveryAddressSerializer(serializers.Serializer):
    label = serializers.CharField(max_length=60, default="موقع التوصيل")
    recipient_name = serializers.CharField(max_length=120, required=False, allow_blank=True)
    phone_number = serializers.CharField(max_length=24, required=False, allow_blank=True)
    formatted_address = serializers.CharField(max_length=320)
    latitude = serializers.FloatField(min_value=-90, max_value=90)
    longitude = serializers.FloatField(min_value=-180, max_value=180)
    building_number = serializers.CharField(max_length=30, required=False, allow_blank=True)
    floor = serializers.CharField(max_length=20, required=False, allow_blank=True)
    apartment = serializers.CharField(max_length=20, required=False, allow_blank=True)
    additional_instructions = serializers.CharField(required=False, allow_blank=True)


class CreateOrderInputSerializer(serializers.Serializer):
    address_id = serializers.UUIDField(required=False, allow_null=True)
    delivery_address = CustomDeliveryAddressSerializer(required=False, allow_null=True)
    payment_method = serializers.ChoiceField(choices=["cod"], default="cod")
    customer_notes = serializers.CharField(required=False, allow_blank=True, default="")
    idempotency_key = serializers.CharField(max_length=120, required=False, allow_blank=True)

    def validate(self, attrs):
        if not attrs.get("address_id") and not attrs.get("delivery_address"):
            raise serializers.ValidationError(
                "Either address_id or delivery_address coordinates must be provided."
            )
        return attrs


class OrderTransitionInputSerializer(serializers.Serializer):
    status = serializers.ChoiceField(
        choices=[
            "accepted",
            "preparing",
            "ready_for_delivery",
            "out_for_delivery",
            "delivered",
            "cancelled",
        ]
    )
    note = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")
    reject_reason = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")

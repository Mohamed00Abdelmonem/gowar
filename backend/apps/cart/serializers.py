from rest_framework import serializers
from .models import Cart, CartItem
from .services import calculate_cart_summary


class CartItemSerializer(serializers.ModelSerializer):
    product_id = serializers.UUIDField(source="product.id", read_only=True)
    name = serializers.CharField(source="product.name", read_only=True)
    name_en = serializers.CharField(source="product.name_en", read_only=True)
    image = serializers.ImageField(source="product.image", read_only=True)
    image_url = serializers.URLField(source="product.image_url", read_only=True)
    unit_price = serializers.DecimalField(
        source="product.effective_price", max_digits=10, decimal_places=2, read_only=True
    )
    stock_quantity = serializers.IntegerField(source="product.stock_quantity", read_only=True)
    line_total = serializers.SerializerMethodField()

    class Meta:
        model = CartItem
        fields = [
            "id",
            "product_id",
            "name",
            "name_en",
            "image",
            "image_url",
            "unit_price",
            "quantity",
            "stock_quantity",
            "line_total",
        ]

    def get_line_total(self, obj: CartItem) -> str:
        return str((obj.product.effective_price * obj.quantity).quantize(obj.product.price))


class CartSerializer(serializers.ModelSerializer):
    store_name = serializers.CharField(source="store.name", read_only=True)
    store_name_en = serializers.CharField(source="store.name_en", read_only=True)
    minimum_order_amount = serializers.DecimalField(
        source="store.minimum_order_amount", max_digits=10, decimal_places=2, read_only=True
    )
    items = CartItemSerializer(many=True, read_only=True)
    subtotal = serializers.SerializerMethodField()
    delivery_fee = serializers.SerializerMethodField()
    total = serializers.SerializerMethodField()

    class Meta:
        model = Cart
        fields = [
            "id",
            "store",
            "store_name",
            "store_name_en",
            "minimum_order_amount",
            "items",
            "subtotal",
            "delivery_fee",
            "total",
            "updated_at",
        ]

    def _summary(self, obj: Cart):
        if not hasattr(obj, "_cached_summary"):
            obj._cached_summary = calculate_cart_summary(obj)
        return obj._cached_summary

    def get_subtotal(self, obj: Cart) -> str:
        return f"{self._summary(obj)['subtotal']:.2f}"

    def get_delivery_fee(self, obj: Cart) -> str:
        return f"{self._summary(obj)['delivery_fee']:.2f}"

    def get_total(self, obj: Cart) -> str:
        return f"{self._summary(obj)['total']:.2f}"


class AddCartItemSerializer(serializers.Serializer):
    product_id = serializers.UUIDField()
    quantity = serializers.IntegerField(min_value=1, default=1)
    replace_cart = serializers.BooleanField(default=False)


class UpdateCartItemSerializer(serializers.Serializer):
    quantity = serializers.IntegerField(min_value=0)

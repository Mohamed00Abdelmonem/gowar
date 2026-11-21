from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import generics, serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.catalog.models import Product
from apps.catalog.serializers import ProductSerializer
from apps.common.permissions import IsMerchant
from .models import InventoryMovement
from .services import set_product_stock


class InventoryMovementSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)

    class Meta:
        model = InventoryMovement
        fields = [
            "id",
            "product",
            "product_name",
            "movement_type",
            "quantity",
            "previous_quantity",
            "new_quantity",
            "reference_type",
            "reference_id",
            "note",
            "created_at",
        ]


class StockAdjustInputSerializer(serializers.Serializer):
    stock_quantity = serializers.IntegerField(min_value=0)
    note = serializers.CharField(max_length=255, required=False, allow_blank=True)


class MerchantInventoryListView(generics.ListAPIView):
    permission_classes = [IsMerchant]
    serializer_class = ProductSerializer

    def get_queryset(self):
        profile = getattr(self.request.user, "merchant_profile", None)
        if not profile:
            return Product.objects.none()
        qs = Product.objects.select_related("category", "store").filter(
            store__merchant=profile
        )
        stock_filter = self.request.query_params.get("stock_filter", "all")
        if stock_filter == "low":
            qs = qs.filter(stock_quantity__gt=0, stock_quantity__lte=5)
        elif stock_filter == "out":
            qs = qs.filter(stock_quantity=0)
        elif stock_filter == "healthy":
            qs = qs.filter(stock_quantity__gt=5)
        return qs.order_by("stock_quantity", "name")


class MerchantStockAdjustView(APIView):
    permission_classes = [IsMerchant]

    def post(self, request, pk):
        profile = getattr(request.user, "merchant_profile", None)
        product = Product.objects.filter(pk=pk, store__merchant=profile).first()
        if not product:
            return Response({"detail": "Product not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = StockAdjustInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            movement = set_product_stock(
                product_id=product.id,
                new_quantity=serializer.validated_data["stock_quantity"],
                performed_by=request.user,
                note=serializer.validated_data.get("note", ""),
            )
        except DjangoValidationError as exc:
            return Response({"detail": exc.message}, status=status.HTTP_400_BAD_REQUEST)

        product.refresh_from_db()
        return Response(
            {
                "product": ProductSerializer(product).data,
                "movement": InventoryMovementSerializer(movement).data,
            }
        )


class MerchantInventoryMovementsView(generics.ListAPIView):
    permission_classes = [IsMerchant]
    serializer_class = InventoryMovementSerializer

    def get_queryset(self):
        profile = getattr(self.request.user, "merchant_profile", None)
        if not profile:
            return InventoryMovement.objects.none()
        return InventoryMovement.objects.select_related("product").filter(
            store__merchant=profile
        )

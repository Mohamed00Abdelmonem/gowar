from django.db.models import Q
from rest_framework import generics, permissions, serializers as drf_serializers
from apps.common.permissions import IsMerchant, IsStoreOwner
from apps.merchants.models import ApprovalStatus
from .models import Category, Product
from .serializers import CategorySerializer, ProductSerializer


class PublicCategoryListView(generics.ListAPIView):
    permission_classes = [permissions.AllowAny]
    pagination_class = None
    serializer_class = CategorySerializer

    def get_queryset(self):
        store_id = self.request.query_params.get("store")
        qs = Category.objects.filter(is_active=True)
        if store_id:
            return qs.filter(Q(is_global=True) | Q(store_id=store_id))
        return qs.filter(is_global=True)


class PublicProductListView(generics.ListAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = ProductSerializer
    filterset_fields = ["store", "category", "is_offer", "is_best_seller"]
    search_fields = ["name", "name_en", "sku", "barcode"]

    def get_queryset(self):
        return (
            Product.objects.select_related("store", "category")
            .filter(
                is_active=True,
                store__is_active=True,
                store__approval_status=ApprovalStatus.APPROVED,
            )
            .order_by("-is_best_seller", "-created_at")
        )


class PublicProductDetailView(generics.RetrieveAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = ProductSerializer

    def get_queryset(self):
        return Product.objects.select_related("store", "category").filter(
            is_active=True,
            store__is_active=True,
            store__approval_status=ApprovalStatus.APPROVED,
        )


class MerchantProductListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsMerchant]
    serializer_class = ProductSerializer
    filterset_fields = ["category", "is_available", "is_active"]
    search_fields = ["name", "name_en", "sku", "barcode"]

    def _get_store(self):
        profile = getattr(self.request.user, "merchant_profile", None)
        return profile.stores.first() if profile else None

    def get_queryset(self):
        store = self._get_store()
        if not store:
            return Product.objects.none()
        return Product.objects.select_related("category", "store").filter(store=store)

    def perform_create(self, serializer):
        store = self._get_store()
        if not store:
            raise drf_serializers.ValidationError("Merchant has no configured store.")
        stock_qty = serializer.validated_data.get("stock_quantity", 0)
        serializer.save(
            store=store,
            is_available=serializer.validated_data.get("is_available", stock_qty > 0),
        )


class MerchantProductDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsMerchant, IsStoreOwner]
    serializer_class = ProductSerializer

    def get_queryset(self):
        profile = getattr(self.request.user, "merchant_profile", None)
        if not profile:
            return Product.objects.none()
        return Product.objects.select_related("category", "store").filter(
            store__merchant=profile
        )


class MerchantCategoryListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsMerchant]
    pagination_class = None
    serializer_class = CategorySerializer

    def get_queryset(self):
        profile = getattr(self.request.user, "merchant_profile", None)
        if not profile:
            return Category.objects.filter(is_global=True, is_active=True)
        store = profile.stores.first()
        return Category.objects.filter(
            Q(is_global=True) | Q(store=store),
            is_active=True,
        )

    def perform_create(self, serializer):
        profile = getattr(self.request.user, "merchant_profile", None)
        store = profile.stores.first() if profile else None
        if not store:
            raise drf_serializers.ValidationError("Merchant store is required.")
        serializer.save(store=store, is_global=False)


class MerchantCategoryDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsMerchant, IsStoreOwner]
    serializer_class = CategorySerializer

    def get_queryset(self):
        profile = getattr(self.request.user, "merchant_profile", None)
        if not profile:
            return Category.objects.none()
        return Category.objects.filter(is_global=False, store__merchant=profile)

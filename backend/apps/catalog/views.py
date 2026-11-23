from uuid import uuid4
from django.conf import settings
from django.core.cache import cache
from django.core.files.storage import default_storage
from django.db.models import Count, Q
from rest_framework import generics, permissions, serializers as drf_serializers, status
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView
from apps.common.permissions import IsMerchant, IsStoreOwner
from apps.merchants.models import ApprovalStatus
from .external_providers import (
    lookup_open_food_facts_barcode,
    search_external_product_images,
    search_open_food_facts_products,
)
from .models import CatalogLibraryCategory, CatalogLibraryItem, Category, Product
from .serializers import (
    CatalogLibraryCategorySerializer,
    CatalogLibraryItemSerializer,
    CategorySerializer,
    ProductSerializer,
    validate_uploaded_product_image,
)


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
            .prefetch_related("images")
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
        return (
            Product.objects.select_related("store", "category")
            .prefetch_related("images")
            .filter(
                is_active=True,
                store__is_active=True,
                store__approval_status=ApprovalStatus.APPROVED,
            )
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
        return (
            Product.objects.select_related("category", "store")
            .prefetch_related("images")
            .filter(store=store)
        )

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
        return (
            Product.objects.select_related("category", "store")
            .prefetch_related("images")
            .filter(store__merchant=profile)
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


class CatalogLibraryPagination(PageNumberPagination):
    page_size = 12
    page_size_query_param = "page_size"
    max_page_size = 48


class MerchantCatalogLibraryCategoryListView(APIView):
    permission_classes = [IsMerchant]

    def get(self, request):
        cache_key = "catalog_library:categories:v1"
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)

        qs = (
            CatalogLibraryCategory.objects.filter(is_active=True)
            .annotate(items_count=Count("items", filter=Q(items__is_active=True)))
            .order_by("sort_order", "name_en")
        )
        data = CatalogLibraryCategorySerializer(qs, many=True).data
        cache.set(cache_key, data, timeout=600)
        return Response(data)


class MerchantCatalogLibraryItemListView(generics.ListAPIView):
    permission_classes = [IsMerchant]
    serializer_class = CatalogLibraryItemSerializer
    pagination_class = CatalogLibraryPagination

    def get_queryset(self):
        qs = CatalogLibraryItem.objects.select_related("library_category").filter(
            is_active=True, library_category__is_active=True
        )
        category = (self.request.query_params.get("category") or "").strip()
        if category and category != "all":
            qs = qs.filter(
                Q(library_category__slug=category) | Q(library_category_id__iexact=category)
            )
        q = (self.request.query_params.get("q") or "").strip()
        if q:
            qs = qs.filter(
                Q(name__icontains=q)
                | Q(name_en__icontains=q)
                | Q(brand__icontains=q)
                | Q(barcode__icontains=q)
            )
        return qs.order_by("sort_order", "name_en")


class MerchantProductImageUploadView(APIView):
    permission_classes = [IsMerchant]
    parser_classes = [MultiPartParser, FormParser]
    throttle_scope = "upload"

    def post(self, request):
        uploaded = request.FILES.get("image")
        if not uploaded:
            return Response(
                {"detail": "Image file is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        validate_uploaded_product_image(uploaded)

        orig_name = getattr(uploaded, "name", "upload.webp")
        ext = "." + orig_name.rsplit(".", 1)[-1].lower() if "." in orig_name else ".png"
        if ext not in {".jpg", ".jpeg", ".png", ".webp"}:
            ext = ".png"
        rel_path = f"products/uploads/{uuid4().hex}{ext}"
        saved_path = default_storage.save(rel_path, uploaded)
        media_url = f"{settings.MEDIA_URL}{saved_path}"
        return Response(
            {
                "image_url": request.build_absolute_uri(media_url),
                "path": saved_path,
                "size_bytes": getattr(uploaded, "size", 0),
            },
            status=status.HTTP_201_CREATED,
        )


class MerchantExternalImageSearchView(APIView):
    permission_classes = [IsMerchant]
    throttle_scope = "external_search"

    def get(self, request):
        q = request.query_params.get("q", "")
        try:
            page = max(1, int(request.query_params.get("page", "1")))
        except ValueError:
            page = 1
        return Response(search_external_product_images(q, page=page))


class MerchantBarcodeImportView(APIView):
    permission_classes = [IsMerchant]
    throttle_scope = "external_search"

    def get(self, request, barcode):
        clean_code = (barcode or "").strip()
        local_item = (
            CatalogLibraryItem.objects.select_related("library_category")
            .filter(barcode=clean_code, is_active=True)
            .first()
        )
        if local_item:
            serialized = CatalogLibraryItemSerializer(
                local_item, context={"request": request}
            ).data
            return Response(
                {
                    "status": "found",
                    "product": {
                        "source": "gowar_library",
                        "barcode": serialized["barcode"],
                        "name": serialized["name"],
                        "name_ar": serialized["name"],
                        "name_en": serialized["name_en"],
                        "brand": serialized["brand"],
                        "package_size": serialized["package_size"],
                        "category_hint": serialized["category_name_en"],
                        "default_store_category": serialized["default_store_category"],
                        "default_unit": serialized["default_unit"],
                        "image_url": serialized["thumbnail_url"],
                        "attribution": "Gowar Curated Product Library",
                    },
                }
            )

        off_res = lookup_open_food_facts_barcode(clean_code)
        if off_res["status"] == "invalid":
            return Response(
                {"detail": "Please enter a valid numeric barcode (4-32 digits)."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(off_res)


class MerchantProductDatabaseSearchView(APIView):
    permission_classes = [IsMerchant]
    throttle_scope = "external_search"

    def get(self, request):
        q = (request.query_params.get("q") or "").strip()
        if len(q) < 2:
            return Response({"status": "ok", "results": []})
        try:
            page = max(1, int(request.query_params.get("page", "1")))
        except ValueError:
            page = 1
        return Response(search_open_food_facts_products(q, page=page))

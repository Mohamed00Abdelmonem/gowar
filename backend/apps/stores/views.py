from django.contrib.gis.db.models.functions import Distance
from django.contrib.gis.geos import Point
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.permissions import IsApprovedMerchant, IsCustomer, IsMerchant
from apps.locations.validators import (
    DEFAULT_RADIUS_KM,
    validate_coordinates,
    validate_search_radius_km,
)
from apps.merchants.models import ApprovalStatus
from .models import FavoriteStore, Store
from .serializers import MerchantStoreSettingsSerializer, StorePublicSerializer
from .services import calculate_dynamic_delivery_quote, get_nearby_stores_queryset


class NearbyStoresListView(generics.ListAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = StorePublicSerializer

    def list(self, request, *args, **kwargs):
        lat_raw = request.query_params.get("latitude")
        lng_raw = request.query_params.get("longitude")
        if lat_raw is None or lng_raw is None:
            return Response(
                {"detail": "Query parameters 'latitude' and 'longitude' are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        radius_raw = request.query_params.get("radius_km")
        if radius_raw is None:
            if request.user.is_authenticated and request.user.role == "customer":
                profile = getattr(request.user, "customer_profile", None)
                radius_raw = profile.search_radius_km if profile else DEFAULT_RADIUS_KM
            else:
                radius_raw = DEFAULT_RADIUS_KM

        try:
            lat, lng = validate_coordinates(float(lat_raw), float(lng_raw))
            radius_km = validate_search_radius_km(radius_raw)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        category_id = request.query_params.get("category")
        search = request.query_params.get("search")
        sort = request.query_params.get("sort", "nearest")

        queryset = get_nearby_stores_queryset(
            latitude=lat,
            longitude=lng,
            radius_km=radius_km,
            category_id=category_id,
            search=search,
            sort=sort,
            customer=request.user,
        )
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)


class PublicStoreListView(generics.ListAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = StorePublicSerializer
    queryset = Store.objects.select_related("area").filter(
        is_active=True,
        approval_status=ApprovalStatus.APPROVED,
    )
    filterset_fields = ["store_type", "area", "is_open"]
    search_fields = ["name", "name_en", "address"]


class PublicStoreDetailView(generics.RetrieveAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = StorePublicSerializer

    def get_queryset(self):
        qs = Store.objects.select_related("area").filter(
            is_active=True,
            approval_status=ApprovalStatus.APPROVED,
        )
        lat_raw = self.request.query_params.get("latitude")
        lng_raw = self.request.query_params.get("longitude")
        if lat_raw is not None and lng_raw is not None:
            try:
                lat, lng = validate_coordinates(float(lat_raw), float(lng_raw))
                point = Point(lng, lat, srid=4326)
                qs = qs.annotate(distance=Distance("location", point))
            except ValueError:
                pass
        return qs


class StoreDeliveryQuoteView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, pk):
        from decimal import Decimal, InvalidOperation
        from django.core.exceptions import ValidationError as DjangoValidationError

        store = Store.objects.filter(
            pk=pk, is_active=True, approval_status=ApprovalStatus.APPROVED
        ).first()
        if not store:
            return Response({"detail": "Store not found."}, status=status.HTTP_404_NOT_FOUND)

        lat_raw = request.query_params.get("latitude")
        lng_raw = request.query_params.get("longitude")
        if lat_raw is None or lng_raw is None:
            return Response(
                {"detail": "Query parameters 'latitude' and 'longitude' are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        subtotal_dec = None
        sub_raw = request.query_params.get("subtotal")
        if sub_raw is not None:
            try:
                subtotal_dec = Decimal(str(sub_raw))
            except InvalidOperation:
                return Response(
                    {"detail": "Invalid subtotal value."}, status=status.HTTP_400_BAD_REQUEST
                )

        try:
            lat, lng = validate_coordinates(float(lat_raw), float(lng_raw))
            quote = calculate_dynamic_delivery_quote(store, lat, lng, subtotal=subtotal_dec)
        except (ValueError, DjangoValidationError) as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(
            {
                "store_id": str(store.id),
                "store_name": store.name,
                "store_name_en": store.name_en,
                "delivery_enabled": store.delivery_enabled,
                "delivery_available": quote["delivery_available"],
                "reason": quote["reason"],
                "actual_distance_km": str(quote["actual_distance_km"]),
                "billable_km": quote["billable_km"],
                "price_per_km": str(quote["price_per_km"]),
                "delivery_fee": str(quote["delivery_fee"]),
                "free_delivery_applied": quote["free_delivery_applied"],
            }
        )


class MerchantStoreSettingsView(APIView):
    permission_classes = [IsMerchant]

    def _get_store(self, user):
        profile = getattr(user, "merchant_profile", None)
        if not profile:
            return None
        return profile.stores.first()

    def get(self, request):
        store = self._get_store(request.user)
        if not store:
            return Response({"detail": "Store not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(MerchantStoreSettingsSerializer(store).data)

    def patch(self, request):
        store = self._get_store(request.user)
        if not store:
            return Response({"detail": "Store not found."}, status=status.HTTP_404_NOT_FOUND)
        serializer = MerchantStoreSettingsSerializer(store, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class MerchantDeliverySettingsView(MerchantStoreSettingsView):
    permission_classes = [IsApprovedMerchant | IsMerchant]


class CustomerFavoriteStoreListView(APIView):
    permission_classes = [IsCustomer]

    def get(self, request):
        favorites = (
            FavoriteStore.objects.select_related("store", "store__area")
            .filter(
                customer=request.user,
                store__is_active=True,
                store__approval_status=ApprovalStatus.APPROVED,
            )
            .order_by("-created_at")
        )
        stores = [fav.store for fav in favorites]
        return Response(
            {
                "store_ids": [str(s.id) for s in stores],
                "stores": StorePublicSerializer(stores, many=True).data,
            }
        )


class CustomerFavoriteStoreDetailView(APIView):
    permission_classes = [IsCustomer]

    def post(self, request, pk):
        store = Store.objects.filter(
            pk=pk,
            is_active=True,
            approval_status=ApprovalStatus.APPROVED,
        ).first()
        if not store:
            return Response({"detail": "Store not found."}, status=status.HTTP_404_NOT_FOUND)

        _, created = FavoriteStore.objects.get_or_create(
            customer=request.user,
            store=store,
        )
        return Response(
            {"store_id": str(store.id), "is_favorite": True},
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    def delete(self, request, pk):
        FavoriteStore.objects.filter(customer=request.user, store_id=pk).delete()
        return Response({"store_id": str(pk), "is_favorite": False})

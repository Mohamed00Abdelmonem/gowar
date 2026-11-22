from django.contrib.gis.db.models.functions import Distance
from django.contrib.gis.geos import Point
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.permissions import IsApprovedMerchant, IsMerchant
from apps.locations.validators import (
    DEFAULT_RADIUS_KM,
    validate_coordinates,
    validate_search_radius_km,
)
from apps.merchants.models import ApprovalStatus
from .models import Store
from .serializers import MerchantStoreSettingsSerializer, StorePublicSerializer
from .services import get_nearby_stores_queryset


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

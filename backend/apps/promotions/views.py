from django.core.cache import cache
from django.db.models import Sum
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.permissions import IsPlatformAdmin
from .models import Promotion
from .serializers import PromotionAdminSerializer, PromotionPublicSerializer
from .services import (
    PROMOTIONS_CACHE_TTL_SECONDS,
    bump_promotions_cache_version,
    get_eligible_promotions,
    get_promotions_cache_version,
    track_promotion_event,
)


class PublicPromotionListView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request):
        lat_raw = request.query_params.get("latitude")
        lng_raw = request.query_params.get("longitude")
        area_id = request.query_params.get("area_id") or None

        latitude = None
        longitude = None
        if lat_raw is not None and lng_raw is not None:
            try:
                latitude = float(lat_raw)
                longitude = float(lng_raw)
            except (TypeError, ValueError):
                return Response(
                    {"detail": "Invalid latitude or longitude."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        version = get_promotions_cache_version()
        lat_key = f"{latitude:.3f}" if latitude is not None else "none"
        lng_key = f"{longitude:.3f}" if longitude is not None else "none"
        host = request.get_host() if hasattr(request, "get_host") else "default"
        cache_key = (
            f"promotions:public:v{version}:{host}:lat={lat_key}:lng={lng_key}:area={area_id or 'none'}"
        )

        cached_data = cache.get(cache_key)
        if cached_data is not None:
            return Response(cached_data, status=status.HTTP_200_OK)

        try:
            promotions = get_eligible_promotions(
                latitude=latitude,
                longitude=longitude,
                area_id=area_id,
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        serializer = PromotionPublicSerializer(
            promotions, many=True, context={"request": request}
        )
        data = serializer.data
        cache.set(cache_key, data, timeout=PROMOTIONS_CACHE_TTL_SECONDS)
        return Response(data, status=status.HTTP_200_OK)


class PublicPromotionDetailView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request, pk):
        lat_raw = request.query_params.get("latitude")
        lng_raw = request.query_params.get("longitude")
        area_id = request.query_params.get("area_id") or None

        latitude = None
        longitude = None
        if lat_raw is not None and lng_raw is not None:
            try:
                latitude = float(lat_raw)
                longitude = float(lng_raw)
            except (TypeError, ValueError):
                return Response(
                    {"detail": "Invalid latitude or longitude."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        try:
            eligible = get_eligible_promotions(
                latitude=latitude,
                longitude=longitude,
                area_id=area_id,
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        match = next((p for p in eligible if str(p.pk) == str(pk)), None)
        if not match:
            return Response(
                {"detail": "Promotion not found or not eligible."},
                status=status.HTTP_404_NOT_FOUND,
            )
        serializer = PromotionPublicSerializer(match, context={"request": request})
        return Response(serializer.data, status=status.HTTP_200_OK)


class PromotionTrackViewAPIView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, pk):
        found, counted = track_promotion_event(pk, "view", request)
        if not found:
            return Response(
                {"detail": "Promotion not found or inactive."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response({"tracked": True, "counted": counted}, status=status.HTTP_200_OK)


class PromotionTrackClickAPIView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, pk):
        found, counted = track_promotion_event(pk, "click", request)
        if not found:
            return Response(
                {"detail": "Promotion not found or inactive."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response({"tracked": True, "counted": counted}, status=status.HTTP_200_OK)


class AdminPromotionListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsPlatformAdmin]
    serializer_class = PromotionAdminSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filterset_fields = ["promotion_type", "is_active", "is_archived", "is_paid_campaign"]
    search_fields = ["title", "title_en", "description", "description_en"]
    ordering_fields = ["display_order", "start_at", "end_at", "created_at", "impressions_count", "clicks_count"]

    def get_queryset(self):
        return Promotion.objects.select_related(
            "target_store",
            "target_product",
            "target_category",
            "target_area",
            "sponsor_merchant",
        ).order_by("-priority_boost", "display_order", "-created_at")

    def perform_create(self, serializer):
        serializer.save()
        bump_promotions_cache_version()


class AdminPromotionDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsPlatformAdmin]
    serializer_class = PromotionAdminSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        return Promotion.objects.select_related(
            "target_store",
            "target_product",
            "target_category",
            "target_area",
            "sponsor_merchant",
        )

    def perform_update(self, serializer):
        serializer.save()
        bump_promotions_cache_version()

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        hard = request.query_params.get("hard", "").lower() == "true"
        if hard:
            instance.delete()
        else:
            instance.is_archived = True
            instance.is_active = False
            instance.save(update_fields=["is_archived", "is_active", "updated_at"])
        bump_promotions_cache_version()
        return Response(status=status.HTTP_204_NO_CONTENT)


class AdminPromotionToggleActiveView(APIView):
    permission_classes = [IsPlatformAdmin]

    def post(self, request, pk):
        promo = Promotion.objects.filter(pk=pk).first()
        if not promo:
            return Response({"detail": "Promotion not found."}, status=status.HTTP_404_NOT_FOUND)

        target_active = not promo.is_active
        if target_active:
            if promo.is_archived:
                promo.is_archived = False
            if not (promo.image or promo.image_url):
                return Response(
                    {"detail": "Cannot activate promotion without a banner image."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if promo.end_at <= promo.start_at:
                return Response(
                    {"detail": "End date must be after start date."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        promo.is_active = target_active
        promo.save(update_fields=["is_active", "is_archived", "updated_at"])
        bump_promotions_cache_version()
        serializer = PromotionAdminSerializer(promo, context={"request": request})
        return Response(serializer.data, status=status.HTTP_200_OK)


class AdminPromotionReorderView(APIView):
    permission_classes = [IsPlatformAdmin]

    def post(self, request):
        items = request.data.get("items")
        if not isinstance(items, list):
            return Response(
                {"detail": "Expected 'items' list of {id, display_order}."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        for item in items:
            pid = item.get("id")
            order = item.get("display_order")
            if pid is not None and isinstance(order, int) and order >= 0:
                Promotion.objects.filter(pk=pid).update(display_order=order)
        bump_promotions_cache_version()
        return Response({"updated": True}, status=status.HTTP_200_OK)


class AdminPromotionAnalyticsView(APIView):
    permission_classes = [IsPlatformAdmin]

    def get(self, request):
        now = timezone.now()
        qs = Promotion.objects.filter(is_archived=False)
        totals = qs.aggregate(
            total_impressions=Sum("impressions_count"),
            total_clicks=Sum("clicks_count"),
        )
        total_impressions = int(totals["total_impressions"] or 0)
        total_clicks = int(totals["total_clicks"] or 0)
        overall_ctr = (
            round((total_clicks / total_impressions) * 100.0, 2)
            if total_impressions > 0
            else 0.0
        )

        active_live = qs.filter(
            is_active=True, start_at__lte=now, end_at__gte=now
        ).count()
        scheduled = qs.filter(is_active=True, start_at__gt=now).count()
        expired = qs.filter(end_at__lt=now).count()

        top_promotions = list(
            qs.order_by("-clicks_count", "-impressions_count")[:5].values(
                "id",
                "title",
                "title_en",
                "promotion_type",
                "impressions_count",
                "clicks_count",
                "is_active",
            )
        )
        for item in top_promotions:
            imp = item["impressions_count"]
            item["ctr"] = round((item["clicks_count"] / imp) * 100.0, 2) if imp > 0 else 0.0

        return Response(
            {
                "total_promotions": qs.count(),
                "active_live_count": active_live,
                "scheduled_count": scheduled,
                "expired_count": expired,
                "total_impressions": total_impressions,
                "total_clicks": total_clicks,
                "overall_ctr": overall_ctr,
                "top_promotions": top_promotions,
            },
            status=status.HTTP_200_OK,
        )

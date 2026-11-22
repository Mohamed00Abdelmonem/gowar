import hashlib
from typing import Optional

from django.contrib.gis.db.models.functions import Distance
from django.contrib.gis.geos import Point
from django.core.cache import cache
from django.db.models import F
from django.utils import timezone

from apps.locations.models import Area
from apps.locations.validators import validate_coordinates
from apps.merchants.models import ApprovalStatus
from .models import Promotion, PromotionType

PROMOTIONS_CACHE_VERSION_KEY = "promotions:public:version"
PROMOTIONS_CACHE_TTL_SECONDS = 60
VIEW_DEDUP_TTL_SECONDS = 300  # 5 minutes per viewer per promotion
CLICK_DEDUP_TTL_SECONDS = 10  # 10 seconds per viewer per promotion


def get_promotions_cache_version() -> int:
    version = cache.get(PROMOTIONS_CACHE_VERSION_KEY)
    if version is None:
        cache.set(PROMOTIONS_CACHE_VERSION_KEY, 1, timeout=None)
        return 1
    return int(version)


def bump_promotions_cache_version() -> None:
    try:
        cache.incr(PROMOTIONS_CACHE_VERSION_KEY)
    except ValueError:
        cache.set(PROMOTIONS_CACHE_VERSION_KEY, 2, timeout=None)


def _is_store_active_and_approved(store) -> bool:
    if store is None:
        return False
    if not store.is_active or store.approval_status != ApprovalStatus.APPROVED:
        return False
    if store.area_id and store.area and not store.area.is_active:
        return False
    return True


def _is_within_store_delivery_coverage(store, distance_obj) -> bool:
    if not store or not store.delivery_enabled or distance_obj is None:
        return False
    distance_km = round(float(distance_obj.m) / 1000.0, 2)
    return distance_km <= float(store.delivery_radius_km)


def _resolve_nearest_active_area_id(customer_point: Point) -> Optional[str]:
    nearest = (
        Area.objects.filter(is_active=True, center_location__isnull=False)
        .annotate(distance=Distance("center_location", customer_point))
        .order_by("distance")
        .values_list("id", flat=True)
        .first()
    )
    return str(nearest) if nearest else None


def is_promotion_eligible(
    promo: Promotion,
    *,
    has_location: bool,
    resolved_area_id: Optional[str] = None,
) -> bool:
    now = timezone.now()
    if not promo.is_active or promo.is_archived:
        return False
    if promo.start_at > now or promo.end_at < now:
        return False
    if not (promo.image or promo.image_url):
        return False

    ptype = promo.promotion_type

    if ptype == PromotionType.GENERAL:
        if promo.target_area_id:
            if not promo.target_area or not promo.target_area.is_active:
                return False
            if not resolved_area_id or str(promo.target_area_id) != str(resolved_area_id):
                return False
        return True

    if ptype == PromotionType.STORE:
        store = promo.target_store
        if not _is_store_active_and_approved(store):
            return False
        if not has_location:
            return False
        return _is_within_store_delivery_coverage(
            store, getattr(promo, "store_distance", None)
        )

    if ptype == PromotionType.PRODUCT:
        product = promo.target_product
        if not product or not product.is_active or not product.is_available:
            return False
        if not product.category or not product.category.is_active:
            return False
        store = product.store
        if not _is_store_active_and_approved(store):
            return False
        if not has_location:
            return False
        return _is_within_store_delivery_coverage(
            store, getattr(promo, "product_store_distance", None)
        )

    if ptype == PromotionType.CATEGORY:
        category = promo.target_category
        if not category or not category.is_active:
            return False
        if category.store_id and not _is_store_active_and_approved(category.store):
            return False
        return True

    return False


def get_eligible_promotions(
    *,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    area_id: Optional[str] = None,
) -> list[Promotion]:
    has_location = latitude is not None and longitude is not None
    customer_point: Optional[Point] = None
    if has_location:
        lat, lng = validate_coordinates(float(latitude), float(longitude))
        customer_point = Point(lng, lat, srid=4326)

    now = timezone.now()
    qs = (
        Promotion.objects.select_related(
            "target_store",
            "target_store__area",
            "target_product",
            "target_product__store",
            "target_product__store__area",
            "target_product__category",
            "target_category",
            "target_category__store",
            "target_area",
        )
        .filter(
            is_active=True,
            is_archived=False,
            start_at__lte=now,
            end_at__gte=now,
        )
        .order_by("-priority_boost", "display_order", "-created_at")
    )

    if customer_point is not None:
        qs = qs.annotate(
            store_distance=Distance("target_store__location", customer_point),
            product_store_distance=Distance("target_product__store__location", customer_point),
        )

    candidates = list(qs)

    resolved_area_id = area_id
    if not resolved_area_id and customer_point is not None:
        if any(
            p.promotion_type == PromotionType.GENERAL and p.target_area_id
            for p in candidates
        ):
            resolved_area_id = _resolve_nearest_active_area_id(customer_point)

    return [
        promo
        for promo in candidates
        if is_promotion_eligible(
            promo,
            has_location=has_location,
            resolved_area_id=resolved_area_id,
        )
    ]


def build_viewer_fingerprint(request) -> str:
    user = getattr(request, "user", None)
    if user is not None and getattr(user, "is_authenticated", False):
        raw = f"user:{user.pk}"
    else:
        xff = request.META.get("HTTP_X_FORWARDED_FOR", "")
        ip = xff.split(",")[0].strip() if xff else request.META.get("REMOTE_ADDR", "")
        ua = request.META.get("HTTP_USER_AGENT", "")
        raw = f"anon:{ip}:{ua}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:24]


def track_promotion_event(promotion_id, event_type: str, request) -> tuple[bool, bool]:
    """
    Atomically increments impressions_count or clicks_count with short-window
    per-viewer deduplication.
    Returns (found_active, counted).
    """
    now = timezone.now()
    exists = Promotion.objects.filter(
        pk=promotion_id,
        is_active=True,
        is_archived=False,
        start_at__lte=now,
        end_at__gte=now,
    ).exists()
    if not exists:
        return False, False

    viewer = build_viewer_fingerprint(request)
    ttl = VIEW_DEDUP_TTL_SECONDS if event_type == "view" else CLICK_DEDUP_TTL_SECONDS
    dedup_key = f"promotions:track:{event_type}:{promotion_id}:{viewer}"
    if not cache.add(dedup_key, 1, timeout=ttl):
        return True, False

    field = "impressions_count" if event_type == "view" else "clicks_count"
    Promotion.objects.filter(pk=promotion_id).update(**{field: F(field) + 1})
    return True, True

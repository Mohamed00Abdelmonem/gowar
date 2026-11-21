from django.contrib.gis.db.models.functions import Distance
from django.contrib.gis.geos import Point
from django.contrib.gis.measure import D
from django.db.models import Q

from apps.locations.validators import validate_coordinates, validate_search_radius_km
from apps.merchants.models import ApprovalStatus
from .models import Store


def get_nearby_stores_queryset(
    latitude: float,
    longitude: float,
    radius_km: int = 3,
    category_id: str | None = None,
    search: str | None = None,
    sort: str = "nearest",
):
    """
    Executes a PostGIS spatial query (WGS84 SRID 4326 geography) filtering active,
    approved stores within `radius_km` of the customer's coordinates and annotating
    each row with its database-calculated distance.
    """
    lat, lng = validate_coordinates(latitude, longitude)
    radius = validate_search_radius_km(radius_km)
    customer_point = Point(lng, lat, srid=4326)

    qs = (
        Store.objects.select_related("area", "merchant", "merchant__user")
        .filter(
            is_active=True,
            approval_status=ApprovalStatus.APPROVED,
            location__distance_lte=(customer_point, D(km=radius)),
        )
        .annotate(distance=Distance("location", customer_point))
    )

    if category_id:
        qs = qs.filter(
            products__category_id=category_id,
            products__is_active=True,
        ).distinct()

    if search:
        term = search.strip()
        if term:
            qs = qs.filter(
                Q(name__icontains=term)
                | Q(name_en__icontains=term)
                | Q(address__icontains=term)
                | Q(products__name__icontains=term)
                | Q(products__name_en__icontains=term)
                | Q(products__category__name__icontains=term)
            ).distinct()

    if sort == "lowest_fee":
        return qs.order_by("delivery_fee", "distance")
    if sort == "highest_rating":
        return qs.order_by("-rating", "distance")
    if sort == "fastest":
        return qs.order_by("estimated_delivery_minutes", "distance")
    return qs.order_by("distance")


def evaluate_delivery_coverage(store: Store, latitude: float, longitude: float) -> dict:
    """
    Evaluates merchant delivery eligibility using PostGIS geographic distance
    against the store's independent `delivery_radius_km` and `delivery_enabled` flag.
    """
    lat, lng = validate_coordinates(latitude, longitude)
    point = Point(lng, lat, srid=4326)

    annotated = (
        Store.objects.filter(pk=store.pk)
        .annotate(distance=Distance("location", point))
        .first()
    )
    distance_m = int(round(annotated.distance.m)) if annotated and annotated.distance else 0
    distance_km = round(distance_m / 1000.0, 2)

    if not store.delivery_enabled:
        return {
            "distance_meters": distance_m,
            "distance_km": distance_km,
            "delivery_available": False,
            "reason": "pickup_only",
        }

    within_coverage = distance_km <= float(store.delivery_radius_km)
    return {
        "distance_meters": distance_m,
        "distance_km": distance_km,
        "delivery_available": within_coverage,
        "reason": "deliverable" if within_coverage else "outside_delivery_area",
    }

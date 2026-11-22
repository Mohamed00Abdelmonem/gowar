from datetime import timedelta
from decimal import Decimal, ROUND_CEILING, ROUND_HALF_UP

from django.conf import settings
from django.core.exceptions import ValidationError
from django.contrib.gis.db.models.functions import Distance
from django.contrib.gis.geos import Point
from django.contrib.gis.measure import D
from django.db.models import (
    Case,
    Count,
    ExpressionWrapper,
    F,
    FloatField,
    IntegerField,
    OuterRef,
    Q,
    Subquery,
    Value,
    When,
)
from django.db.models.functions import Cast, Coalesce, Greatest, Least
from django.utils import timezone

from apps.locations.validators import validate_coordinates, validate_search_radius_km
from apps.merchants.models import ApprovalStatus
from .models import Store


def get_ranking_weights() -> dict:
    defaults = {
        "previous_relationship": 25.0,
        "repeat_orders_max": 20.0,
        "repeat_orders_step": 5.0,
        "recency_max": 15.0,
        "recency_window_days": 30,
        "proximity_max": 40.0,
        "max_eligible_distance_km": 20.0,
    }
    configured = getattr(settings, "GOWAR_RANKING_WEIGHTS", {})
    return {**defaults, **configured}


def get_nearby_stores_queryset(
    latitude: float,
    longitude: float,
    radius_km: int = 3,
    category_id: str | None = None,
    search: str | None = None,
    sort: str = "nearest",
    customer=None,
):
    """
    Executes a PostGIS spatial query (WGS84 SRID 4326 geography) filtering active,
    approved stores within `radius_km` of the customer's coordinates and annotating
    each row with its database-calculated distance and personalized ranking score.
    """
    from apps.orders.models import Order, OrderStatusChoices

    weights = get_ranking_weights()
    lat, lng = validate_coordinates(latitude, longitude)
    radius = validate_search_radius_km(radius_km)
    max_eligible_km = float(weights["max_eligible_distance_km"])
    effective_radius = min(float(radius), max_eligible_km)
    customer_point = Point(lng, lat, srid=4326)

    qs = (
        Store.objects.select_related("area", "merchant", "merchant__user")
        .filter(
            is_active=True,
            approval_status=ApprovalStatus.APPROVED,
            location__distance_lte=(customer_point, D(km=effective_radius)),
        )
        .filter(Q(area__isnull=True) | Q(area__is_active=True))
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

    is_customer = (
        customer is not None
        and getattr(customer, "is_authenticated", False)
        and getattr(customer, "role", None) == "customer"
    )

    if is_customer:
        completed_orders_sq = (
            Order.objects.filter(
                store_id=OuterRef("pk"),
                customer_id=customer.pk,
                order_status=OrderStatusChoices.DELIVERED,
            )
            .values("store_id")
            .annotate(cnt=Count("id"))
            .values("cnt")[:1]
        )
        last_order_sq = (
            Order.objects.filter(
                store_id=OuterRef("pk"),
                customer_id=customer.pk,
                order_status=OrderStatusChoices.DELIVERED,
            )
            .order_by("-created_at")
            .values("created_at")[:1]
        )
        qs = qs.annotate(
            customer_completed_orders=Coalesce(
                Subquery(completed_orders_sq, output_field=IntegerField()),
                Value(0),
            ),
            customer_last_order_at=Subquery(last_order_sq),
        )
    else:
        qs = qs.annotate(
            customer_completed_orders=Value(0, output_field=IntegerField()),
        )

    # Geographic proximity score: 0..proximity_max based on distance within effective_radius
    radius_meters = max(1.0, effective_radius * 1000.0)
    proximity_max = float(weights["proximity_max"])
    distance_meters = Cast(F("distance"), FloatField())
    proximity_score = ExpressionWrapper(
        Value(proximity_max)
        * Greatest(Value(0.0), Value(1.0) - (distance_meters / Value(radius_meters))),
        output_field=FloatField(),
    )

    if is_customer:
        now = timezone.now()
        recency_window = int(weights["recency_window_days"])
        recency_max = float(weights["recency_max"])
        rel_weight = float(weights["previous_relationship"])
        repeat_max = float(weights["repeat_orders_max"])
        repeat_step = float(weights["repeat_orders_step"])

        # Only open stores that can accept orders receive personalization boost
        can_boost = Q(is_open=True, customer_completed_orders__gte=1)

        relationship_score = Case(
            When(can_boost, then=Value(rel_weight)),
            default=Value(0.0),
            output_field=FloatField(),
        )
        repeat_score = Case(
            When(
                can_boost,
                then=Least(
                    Value(repeat_max),
                    ExpressionWrapper(
                        (Cast(F("customer_completed_orders"), FloatField()) - Value(1.0))
                        * Value(repeat_step),
                        output_field=FloatField(),
                    ),
                ),
            ),
            default=Value(0.0),
            output_field=FloatField(),
        )
        recency_score = Case(
            When(
                can_boost & Q(customer_last_order_at__gte=now - timedelta(days=7)),
                then=Value(recency_max),
            ),
            When(
                can_boost & Q(customer_last_order_at__gte=now - timedelta(days=14)),
                then=Value(round(recency_max * 0.67, 2)),
            ),
            When(
                can_boost & Q(customer_last_order_at__gte=now - timedelta(days=recency_window)),
                then=Value(round(recency_max * 0.33, 2)),
            ),
            When(can_boost, then=Value(round(recency_max * 0.13, 2))),
            default=Value(0.0),
            output_field=FloatField(),
        )

        # Closed stores are penalized so open stores always rank above closed ones
        open_penalty = Case(
            When(is_open=True, then=Value(0.0)),
            default=Value(-100.0),
            output_field=FloatField(),
        )

        qs = qs.annotate(
            ranking_score=ExpressionWrapper(
                proximity_score + relationship_score + repeat_score + recency_score + open_penalty,
                output_field=FloatField(),
            )
        )
    else:
        open_penalty = Case(
            When(is_open=True, then=Value(0.0)),
            default=Value(-100.0),
            output_field=FloatField(),
        )
        qs = qs.annotate(
            ranking_score=ExpressionWrapper(
                proximity_score + open_penalty,
                output_field=FloatField(),
            )
        )

    if sort == "lowest_fee":
        return qs.order_by("delivery_fee", "distance")
    if sort == "highest_rating":
        return qs.order_by("-rating", "distance")
    if sort == "fastest":
        return qs.order_by("estimated_delivery_minutes", "distance")
    return qs.order_by("-ranking_score", "distance")


def calculate_billable_km(distance_km: Decimal | float | str) -> int:
    """
    Applies Gowar's 1.5 km band pricing rule:
      billable_km = max(1, ceil(distance_km - 0.5))
    Uses Decimal arithmetic to avoid IEEE-754 floating-point boundary drift.
    """
    dist = Decimal(str(distance_km))
    if dist < Decimal("0"):
        raise ValidationError("Delivery distance cannot be negative.")
    shifted = dist - Decimal("0.5")
    ceiled = int(shifted.to_integral_value(rounding=ROUND_CEILING))
    return max(1, ceiled)


def calculate_dynamic_delivery_quote(
    store: Store,
    latitude: float,
    longitude: float,
    subtotal: Decimal | None = None,
) -> dict:
    """
    Authoritative server-side PostGIS distance & dynamic delivery fee calculation.
    """
    if store.latitude is None or store.longitude is None or store.location is None:
        raise ValidationError("Merchant store coordinates are missing or invalid.")

    price_per_km = store.delivery_price_per_km
    if price_per_km is None or price_per_km < Decimal("0.00"):
        raise ValidationError("Merchant delivery price per kilometer is missing or invalid.")

    coverage = evaluate_delivery_coverage(store, latitude, longitude)
    distance_km = Decimal(str(coverage["distance_km"])).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )

    if not store.delivery_enabled:
        return {
            **coverage,
            "actual_distance_km": distance_km,
            "billable_km": 0,
            "price_per_km": price_per_km.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
            "delivery_fee": Decimal("0.00"),
            "free_delivery_applied": False,
        }

    billable_km = calculate_billable_km(distance_km)
    qualifies_free = (
        subtotal is not None
        and store.free_delivery_threshold is not None
        and subtotal >= store.free_delivery_threshold
    )
    if qualifies_free:
        delivery_fee = Decimal("0.00")
    else:
        delivery_fee = (Decimal(billable_km) * price_per_km).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )

    return {
        **coverage,
        "actual_distance_km": distance_km,
        "billable_km": billable_km,
        "price_per_km": price_per_km.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
        "delivery_fee": delivery_fee,
        "free_delivery_applied": qualifies_free,
    }


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

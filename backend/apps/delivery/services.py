from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Avg, Count, DurationField, ExpressionWrapper, F, Q
from django.utils import timezone

from apps.accounts.models import User, UserRole
from apps.accounts.phone import normalize_phone_number
from apps.locations.validators import validate_coordinates
from apps.merchants.models import MerchantProfile
from apps.orders.models import Order, OrderStatusChoices
from .models import DeliveryDriverProfile, DeliveryShift

ONLINE_THRESHOLD_SECONDS = 180
LOCATION_STALE_SECONDS = 180

ACTIVE_ORDER_STATUSES = [
    OrderStatusChoices.PENDING,
    OrderStatusChoices.ACCEPTED,
    OrderStatusChoices.PREPARING,
    OrderStatusChoices.READY_FOR_DELIVERY,
    OrderStatusChoices.OUT_FOR_DELIVERY,
]


def get_merchant_tz() -> ZoneInfo:
    tz_name = getattr(settings, "TIME_ZONE", "Africa/Cairo") or "Africa/Cairo"
    return ZoneInfo(tz_name)


def compute_operational_status(
    profile: DeliveryDriverProfile,
    out_for_delivery_count: int = 0,
    now=None,
) -> str:
    if now is None:
        now = timezone.now()
    if not profile.is_active or profile.is_archived or not profile.user.is_active:
        return "inactive"
    if out_for_delivery_count > 0:
        return "on_delivery"
    if profile.last_seen_at and (now - profile.last_seen_at).total_seconds() <= ONLINE_THRESHOLD_SECONDS:
        return "available"
    return "offline"


def compute_location_status(profile: DeliveryDriverProfile, now=None) -> str:
    if now is None:
        now = timezone.now()
    if (
        profile.last_latitude is None
        or profile.last_longitude is None
        or profile.last_location_at is None
    ):
        return "unavailable"
    age = (now - profile.last_location_at).total_seconds()
    if age <= LOCATION_STALE_SECONDS and profile.is_location_sharing:
        return "live"
    return "stale"


def touch_driver_activity(user: User) -> None:
    if not user or not user.is_authenticated or user.role != UserRole.DELIVERY:
        return
    DeliveryDriverProfile.objects.filter(user=user).update(last_seen_at=timezone.now())


@transaction.atomic
def create_merchant_driver(
    *,
    merchant: MerchantProfile,
    email: str,
    password: str,
    first_name: str,
    last_name: str,
    phone_number: str,
    vehicle_type: str = "motorcycle",
    vehicle_plate: str = "",
    notes: str = "",
) -> DeliveryDriverProfile:
    normalized_email = email.strip().lower() if email and email.strip() else None
    try:
        normalized_phone = normalize_phone_number(phone_number)
    except ValueError as exc:
        raise ValidationError({"phone_number": str(exc)}) from exc

    if normalized_email and User.objects.filter(email=normalized_email).exists():
        raise ValidationError({"email": "A user with this email already exists."})
    if User.objects.filter(phone_number=normalized_phone).exists():
        raise ValidationError({"phone_number": "يوجد حساب مسجل بالفعل برقم الموبايل هذا."})

    user = User.objects.create_user(
        email=normalized_email,
        password=password,
        first_name=first_name.strip(),
        last_name=last_name.strip(),
        phone_number=normalized_phone,
        role=UserRole.DELIVERY,
        is_active=True,
        is_verified=True,
    )
    profile = DeliveryDriverProfile.objects.create(
        user=user,
        merchant=merchant,
        vehicle_type=vehicle_type,
        vehicle_plate=vehicle_plate.strip(),
        notes=notes.strip(),
        is_active=True,
        is_archived=False,
    )
    return profile


@transaction.atomic
def set_driver_active_state(
    *,
    profile: DeliveryDriverProfile,
    is_active: bool,
    archive: bool = False,
) -> DeliveryDriverProfile:
    locked = (
        DeliveryDriverProfile.objects.select_for_update()
        .select_related("user")
        .get(pk=profile.pk)
    )

    if not is_active or archive:
        active_assigned_count = Order.objects.filter(
            assigned_delivery_person=locked.user,
            order_status__in=ACTIVE_ORDER_STATUSES,
        ).count()
        if active_assigned_count > 0:
            raise ValidationError(
                f"Cannot deactivate driver with {active_assigned_count} active assigned order(s). "
                "Please reassign or complete those orders first."
            )

        now = timezone.now()
        locked.is_active = False
        if archive:
            locked.is_archived = True
        locked.deactivated_at = now
        locked.is_location_sharing = False
        locked.save(
            update_fields=[
                "is_active",
                "is_archived",
                "deactivated_at",
                "is_location_sharing",
                "updated_at",
            ]
        )
        locked.user.is_active = False
        locked.user.save(update_fields=["is_active"])

        # Close any open shift cleanly
        DeliveryShift.objects.filter(driver=locked, is_active=True).update(
            is_active=False, ended_at=now
        )
    else:
        locked.is_active = True
        locked.is_archived = False
        locked.deactivated_at = None
        locked.save(
            update_fields=["is_active", "is_archived", "deactivated_at", "updated_at"]
        )
        locked.user.is_active = True
        locked.user.save(update_fields=["is_active"])

    return locked


@transaction.atomic
def start_driver_shift(user: User) -> DeliveryShift:
    profile = DeliveryDriverProfile.objects.select_for_update().filter(user=user).first()
    if not profile or not profile.is_active or profile.is_archived:
        raise ValidationError("Active delivery profile is required to start a shift.")

    existing = DeliveryShift.objects.filter(driver=profile, is_active=True).first()
    if existing:
        raise ValidationError("You already have an active shift in progress.")

    now = timezone.now()
    shift = DeliveryShift.objects.create(driver=profile, started_at=now, is_active=True)
    profile.last_seen_at = now
    profile.save(update_fields=["last_seen_at", "updated_at"])
    return shift


@transaction.atomic
def end_driver_shift(user: User) -> DeliveryShift:
    profile = DeliveryDriverProfile.objects.select_for_update().filter(user=user).first()
    if not profile:
        raise ValidationError("Delivery profile not found.")

    shift = DeliveryShift.objects.filter(driver=profile, is_active=True).first()
    if not shift:
        raise ValidationError("No active shift found.")

    now = timezone.now()
    shift.is_active = False
    shift.ended_at = now
    shift.save(update_fields=["is_active", "ended_at", "updated_at"])

    profile.is_location_sharing = False
    profile.last_seen_at = now
    profile.save(update_fields=["is_location_sharing", "last_seen_at", "updated_at"])
    return shift


def record_driver_location(
    *,
    user: User,
    latitude: float | None,
    longitude: float | None,
    accuracy_m: float | None = None,
    is_sharing: bool = True,
) -> DeliveryDriverProfile:
    profile = DeliveryDriverProfile.objects.filter(user=user).first()
    if not profile or not profile.is_active or profile.is_archived:
        raise ValidationError("Active delivery profile not found.")

    now = timezone.now()
    if not is_sharing:
        profile.is_location_sharing = False
        profile.last_seen_at = now
        profile.save(update_fields=["is_location_sharing", "last_seen_at", "updated_at"])
        return profile

    if latitude is None or longitude is None:
        raise ValidationError("Latitude and longitude are required when sharing location.")

    lat, lng = validate_coordinates(latitude, longitude)
    profile.update_location(lat, lng, accuracy_m=accuracy_m)
    profile.save(
        update_fields=[
            "last_latitude",
            "last_longitude",
            "last_location",
            "last_location_accuracy_m",
            "last_location_at",
            "last_seen_at",
            "is_location_sharing",
            "updated_at",
        ]
    )
    return profile


def get_driver_working_minutes_today(profile: DeliveryDriverProfile, now=None) -> int:
    tz = get_merchant_tz()
    if now is None:
        now = timezone.now()
    local_now = now.astimezone(tz)
    day_start = datetime.combine(local_now.date(), time.min, tzinfo=tz)
    day_end = day_start + timedelta(days=1)

    shifts = DeliveryShift.objects.filter(
        driver=profile,
        started_at__lt=day_end,
    ).filter(Q(ended_at__isnull=True) | Q(ended_at__gte=day_start))

    total_seconds = 0.0
    for shift in shifts:
        s = max(shift.started_at, day_start)
        e = min(shift.ended_at or now, now)
        if e > s:
            total_seconds += (e - s).total_seconds()
    return int(round(total_seconds / 60.0))


def build_merchant_drivers_snapshot(merchant: MerchantProfile) -> list[dict]:
    now = timezone.now()
    tz = get_merchant_tz()
    local_now = now.astimezone(tz)
    today_start = datetime.combine(local_now.date(), time.min, tzinfo=tz)
    week_start = today_start - timedelta(days=local_now.date().weekday())
    month_start = datetime.combine(local_now.date().replace(day=1), time.min, tzinfo=tz)

    profiles = list(
        DeliveryDriverProfile.objects.select_related("user")
        .filter(merchant=merchant)
        .order_by("-is_active", "user__first_name", "user__last_name")
    )
    if not profiles:
        return []

    user_ids = [p.user_id for p in profiles]

    # Aggregate order metrics in a single query
    order_stats = {
        row["assigned_delivery_person_id"]: row
        for row in Order.objects.filter(
            store__merchant=merchant,
            assigned_delivery_person_id__in=user_ids,
        )
        .values("assigned_delivery_person_id")
        .annotate(
            active_count=Count("id", filter=Q(order_status__in=ACTIVE_ORDER_STATUSES)),
            out_for_delivery_count=Count(
                "id", filter=Q(order_status=OrderStatusChoices.OUT_FOR_DELIVERY)
            ),
            assigned_today=Count("id", filter=Q(assigned_at__gte=today_start)),
            delivered_today=Count(
                "id",
                filter=Q(
                    order_status=OrderStatusChoices.DELIVERED,
                    delivered_at__gte=today_start,
                ),
            ),
            cancelled_today=Count(
                "id",
                filter=Q(
                    order_status=OrderStatusChoices.CANCELLED,
                    updated_at__gte=today_start,
                ),
            ),
            delivered_week=Count(
                "id",
                filter=Q(
                    order_status=OrderStatusChoices.DELIVERED,
                    delivered_at__gte=week_start,
                ),
            ),
            delivered_month=Count(
                "id",
                filter=Q(
                    order_status=OrderStatusChoices.DELIVERED,
                    delivered_at__gte=month_start,
                ),
            ),
            avg_duration=Avg(
                ExpressionWrapper(
                    F("delivered_at") - F("assigned_at"),
                    output_field=DurationField(),
                ),
                filter=Q(
                    order_status=OrderStatusChoices.DELIVERED,
                    delivered_at__isnull=False,
                    assigned_at__isnull=False,
                ),
            ),
        )
    }

    # Fetch current active orders for each driver (at most a handful)
    active_orders_by_driver: dict = {}
    for order in (
        Order.objects.select_related("store", "customer")
        .filter(
            store__merchant=merchant,
            assigned_delivery_person_id__in=user_ids,
            order_status__in=ACTIVE_ORDER_STATUSES,
        )
        .order_by("-assigned_at", "-created_at")
    ):
        active_orders_by_driver.setdefault(order.assigned_delivery_person_id, []).append(order)

    active_shift_driver_ids = set(
        DeliveryShift.objects.filter(
            driver__in=profiles, is_active=True
        ).values_list("driver_id", flat=True)
    )

    result = []
    for profile in profiles:
        st = order_stats.get(profile.user_id, {})
        active_orders = active_orders_by_driver.get(profile.user_id, [])
        current_order = active_orders[0] if active_orders else None
        out_count = st.get("out_for_delivery_count", 0) or 0
        avg_dur = st.get("avg_duration")
        avg_minutes = round(avg_dur.total_seconds() / 60.0, 1) if avg_dur else None

        op_status = compute_operational_status(profile, out_for_delivery_count=out_count, now=now)
        loc_status = compute_location_status(profile, now=now)
        working_minutes_today = get_driver_working_minutes_today(profile, now=now)

        current_order_payload = None
        if current_order:
            snap = current_order.delivery_address_snapshot or {}
            current_order_payload = {
                "id": str(current_order.id),
                "order_number": current_order.order_number,
                "order_status": current_order.order_status,
                "store_name": current_order.store.name,
                "customer_name": snap.get("recipient_name") or current_order.customer.full_name,
                "customer_address": snap.get("formatted_address", ""),
                "customer_latitude": snap.get("latitude"),
                "customer_longitude": snap.get("longitude"),
            }

        result.append(
            {
                "id": str(profile.id),
                "user_id": str(profile.user_id),
                "full_name": profile.user.full_name,
                "first_name": profile.user.first_name,
                "last_name": profile.user.last_name,
                "email": profile.user.email,
                "phone_number": profile.user.phone_number,
                "vehicle_type": profile.vehicle_type,
                "vehicle_plate": profile.vehicle_plate,
                "notes": profile.notes,
                "is_active": profile.is_active and profile.user.is_active,
                "is_archived": profile.is_archived,
                "operational_status": op_status,
                "location_status": loc_status,
                "is_on_shift": profile.id in active_shift_driver_ids,
                "is_location_sharing": profile.is_location_sharing,
                "last_latitude": float(profile.last_latitude) if profile.last_latitude is not None else None,
                "last_longitude": float(profile.last_longitude) if profile.last_longitude is not None else None,
                "last_location_accuracy_m": profile.last_location_accuracy_m,
                "last_location_at": profile.last_location_at.isoformat() if profile.last_location_at else None,
                "last_seen_at": profile.last_seen_at.isoformat() if profile.last_seen_at else None,
                "active_orders_count": st.get("active_count", 0) or 0,
                "out_for_delivery_count": out_count,
                "assigned_today": st.get("assigned_today", 0) or 0,
                "delivered_today": st.get("delivered_today", 0) or 0,
                "cancelled_today": st.get("cancelled_today", 0) or 0,
                "delivered_this_week": st.get("delivered_week", 0) or 0,
                "delivered_this_month": st.get("delivered_month", 0) or 0,
                "avg_delivery_duration_minutes": avg_minutes,
                "working_hours_today": round(working_minutes_today / 60.0, 2),
                "working_minutes_today": working_minutes_today,
                "current_order": current_order_payload,
                "created_at": profile.created_at.isoformat(),
            }
        )
    return result

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.common.permissions import IsDelivery, IsMerchant
from apps.orders.models import Order
from apps.orders.serializers import OrderSerializer
from .models import DeliveryDriverProfile, DeliveryShift
from .serializers import (
    DeliveryLocationUpdateSerializer,
    MerchantDriverCreateSerializer,
    MerchantDriverResetPasswordSerializer,
    MerchantDriverToggleActiveSerializer,
    MerchantDriverUpdateSerializer,
)
from .services import (
    build_merchant_drivers_snapshot,
    create_merchant_driver,
    end_driver_shift,
    get_driver_working_minutes_today,
    record_driver_location,
    set_driver_active_state,
    start_driver_shift,
    touch_driver_activity,
)


def _get_merchant_profile(request):
    return getattr(request.user, "merchant_profile", None)


def _get_scoped_driver(merchant, pk):
    return (
        DeliveryDriverProfile.objects.select_related("user")
        .filter(pk=pk, merchant=merchant)
        .first()
    )


class MerchantDeliveryOverviewView(APIView):
    permission_classes = [IsMerchant]

    def get(self, request):
        merchant = _get_merchant_profile(request)
        if not merchant:
            return Response({"detail": "Merchant profile not found."}, status=status.HTTP_404_NOT_FOUND)

        drivers = build_merchant_drivers_snapshot(merchant)
        non_archived = [d for d in drivers if not d["is_archived"]]

        summary = {
            "total_personnel": len(non_archived),
            "active_personnel": sum(1 for d in non_archived if d["is_active"]),
            "available_now": sum(1 for d in non_archived if d["operational_status"] == "available"),
            "on_delivery_now": sum(1 for d in non_archived if d["operational_status"] == "on_delivery"),
            "delivered_today": sum(d["delivered_today"] for d in drivers),
        }
        return Response({"summary": summary, "drivers": drivers})


class MerchantDeliveryDriversManageView(APIView):
    permission_classes = [IsMerchant]

    def get(self, request):
        merchant = _get_merchant_profile(request)
        if not merchant:
            return Response({"detail": "Merchant profile not found."}, status=status.HTTP_404_NOT_FOUND)

        drivers = build_merchant_drivers_snapshot(merchant)
        search = (request.query_params.get("search") or "").strip().lower()
        status_filter = (request.query_params.get("status") or "").strip().lower()
        include_archived = request.query_params.get("include_archived", "false").lower() == "true"

        if not include_archived:
            drivers = [d for d in drivers if not d["is_archived"]]
        if status_filter and status_filter != "all":
            drivers = [d for d in drivers if d["operational_status"] == status_filter]
        if search:
            drivers = [
                d
                for d in drivers
                if search in d["full_name"].lower()
                or search in d["phone_number"].lower()
                or search in d["email"].lower()
            ]
        return Response(drivers)

    def post(self, request):
        merchant = _get_merchant_profile(request)
        if not merchant:
            return Response({"detail": "Merchant profile not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = MerchantDriverCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            profile = create_merchant_driver(
                merchant=merchant,
                email=data["email"],
                password=data["password"],
                first_name=data["first_name"],
                last_name=data.get("last_name", ""),
                phone_number=data["phone_number"],
                vehicle_type=data.get("vehicle_type", "motorcycle"),
                vehicle_plate=data.get("vehicle_plate", ""),
                notes=data.get("notes", ""),
            )
        except DjangoValidationError as exc:
            detail = exc.message_dict if hasattr(exc, "message_dict") else {"detail": exc.messages}
            return Response(detail, status=status.HTTP_400_BAD_REQUEST)

        snapshot = next(
            (d for d in build_merchant_drivers_snapshot(merchant) if d["id"] == str(profile.id)),
            None,
        )
        return Response(snapshot, status=status.HTTP_201_CREATED)


class MerchantDeliveryDriverDetailView(APIView):
    permission_classes = [IsMerchant]

    def get(self, request, pk):
        merchant = _get_merchant_profile(request)
        if not merchant:
            return Response({"detail": "Merchant profile not found."}, status=status.HTTP_404_NOT_FOUND)

        profile = _get_scoped_driver(merchant, pk)
        if not profile:
            return Response({"detail": "Delivery person not found."}, status=status.HTTP_404_NOT_FOUND)

        driver_data = next(
            (d for d in build_merchant_drivers_snapshot(merchant) if d["id"] == str(profile.id)),
            None,
        )
        recent_orders = (
            Order.objects.select_related("store", "customer", "assigned_delivery_person", "delivered_by")
            .prefetch_related("items", "status_history")
            .filter(store__merchant=merchant, assigned_delivery_person=profile.user)
            .order_by("-created_at")[:20]
        )
        recent_shifts = [
            {
                "id": str(s.id),
                "started_at": s.started_at.isoformat(),
                "ended_at": s.ended_at.isoformat() if s.ended_at else None,
                "is_active": s.is_active,
                "duration_minutes": s.duration_minutes,
            }
            for s in DeliveryShift.objects.filter(driver=profile).order_by("-started_at")[:15]
        ]
        return Response(
            {
                "driver": driver_data,
                "recent_orders": OrderSerializer(recent_orders, many=True).data,
                "recent_shifts": recent_shifts,
            }
        )

    @transaction.atomic
    def patch(self, request, pk):
        merchant = _get_merchant_profile(request)
        if not merchant:
            return Response({"detail": "Merchant profile not found."}, status=status.HTTP_404_NOT_FOUND)

        profile = _get_scoped_driver(merchant, pk)
        if not profile:
            return Response({"detail": "Delivery person not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = MerchantDriverUpdateSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        user = profile.user
        user_fields = []
        if "email" in data:
            normalized_email = data["email"].strip().lower()
            if User.objects.filter(email=normalized_email).exclude(pk=user.pk).exists():
                return Response(
                    {"email": ["A user with this email already exists."]},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            user.email = normalized_email
            user_fields.append("email")

        if "phone_number" in data:
            phone = data["phone_number"].strip()
            if not phone:
                return Response(
                    {"phone_number": ["Phone number cannot be empty."]},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if User.objects.filter(phone_number=phone).exclude(pk=user.pk).exists():
                return Response(
                    {"phone_number": ["A user with this phone number already exists."]},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            user.phone_number = phone
            user_fields.append("phone_number")

        if "first_name" in data:
            user.first_name = data["first_name"].strip()
            user_fields.append("first_name")
        if "last_name" in data:
            user.last_name = data["last_name"].strip()
            user_fields.append("last_name")
        if user_fields:
            user.save(update_fields=user_fields)

        profile_fields = []
        if "vehicle_type" in data:
            profile.vehicle_type = data["vehicle_type"]
            profile_fields.append("vehicle_type")
        if "vehicle_plate" in data:
            profile.vehicle_plate = data["vehicle_plate"].strip()
            profile_fields.append("vehicle_plate")
        if "notes" in data:
            profile.notes = data["notes"].strip()
            profile_fields.append("notes")
        if profile_fields:
            profile_fields.append("updated_at")
            profile.save(update_fields=profile_fields)

        snapshot = next(
            (d for d in build_merchant_drivers_snapshot(merchant) if d["id"] == str(profile.id)),
            None,
        )
        return Response(snapshot)


class MerchantDeliveryDriverToggleActiveView(APIView):
    permission_classes = [IsMerchant]

    def post(self, request, pk):
        merchant = _get_merchant_profile(request)
        if not merchant:
            return Response({"detail": "Merchant profile not found."}, status=status.HTTP_404_NOT_FOUND)

        profile = _get_scoped_driver(merchant, pk)
        if not profile:
            return Response({"detail": "Delivery person not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = MerchantDriverToggleActiveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            updated = set_driver_active_state(
                profile=profile,
                is_active=serializer.validated_data["is_active"],
                archive=serializer.validated_data.get("archive", False),
            )
        except DjangoValidationError as exc:
            return Response({"detail": exc.message}, status=status.HTTP_400_BAD_REQUEST)

        snapshot = next(
            (d for d in build_merchant_drivers_snapshot(merchant) if d["id"] == str(updated.id)),
            None,
        )
        return Response(snapshot)


class MerchantDeliveryDriverResetPasswordView(APIView):
    permission_classes = [IsMerchant]

    def post(self, request, pk):
        merchant = _get_merchant_profile(request)
        if not merchant:
            return Response({"detail": "Merchant profile not found."}, status=status.HTTP_404_NOT_FOUND)

        profile = _get_scoped_driver(merchant, pk)
        if not profile:
            return Response({"detail": "Delivery person not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = MerchantDriverResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = profile.user
        user.set_password(serializer.validated_data["new_password"])
        user.save(update_fields=["password"])
        return Response({"detail": "Driver password updated successfully."})


class MerchantDeliveryTrackingView(APIView):
    permission_classes = [IsMerchant]

    def get(self, request):
        merchant = _get_merchant_profile(request)
        if not merchant:
            return Response({"detail": "Merchant profile not found."}, status=status.HTTP_404_NOT_FOUND)

        drivers = [
            d for d in build_merchant_drivers_snapshot(merchant) if not d["is_archived"]
        ]
        return Response(
            {
                "generated_at": timezone.now().isoformat(),
                "drivers": drivers,
            }
        )


class MerchantDeliveryPerformanceView(APIView):
    permission_classes = [IsMerchant]

    def get(self, request):
        merchant = _get_merchant_profile(request)
        if not merchant:
            return Response({"detail": "Merchant profile not found."}, status=status.HTTP_404_NOT_FOUND)

        drivers = build_merchant_drivers_snapshot(merchant)
        totals = {
            "delivered_today": sum(d["delivered_today"] for d in drivers),
            "in_progress_count": sum(d["active_orders_count"] for d in drivers),
            "assigned_today": sum(d["assigned_today"] for d in drivers),
            "delivered_this_week": sum(d["delivered_this_week"] for d in drivers),
            "delivered_this_month": sum(d["delivered_this_month"] for d in drivers),
        }
        return Response({"totals": totals, "drivers": drivers})


# --- Delivery Driver Endpoints (delivery.gowar.com) ---


class DeliveryShiftStatusView(APIView):
    permission_classes = [IsDelivery]

    def get(self, request):
        touch_driver_activity(request.user)
        profile = getattr(request.user, "delivery_profile", None)
        if not profile:
            return Response(
                {
                    "has_profile": False,
                    "is_on_shift": False,
                    "active_shift": None,
                    "working_minutes_today": 0,
                    "is_location_sharing": False,
                    "last_location_at": None,
                }
            )

        active_shift = DeliveryShift.objects.filter(driver=profile, is_active=True).first()
        return Response(
            {
                "has_profile": True,
                "is_on_shift": active_shift is not None,
                "active_shift": (
                    {
                        "id": str(active_shift.id),
                        "started_at": active_shift.started_at.isoformat(),
                        "duration_minutes": active_shift.duration_minutes,
                    }
                    if active_shift
                    else None
                ),
                "working_minutes_today": get_driver_working_minutes_today(profile),
                "is_location_sharing": profile.is_location_sharing,
                "last_location_at": (
                    profile.last_location_at.isoformat() if profile.last_location_at else None
                ),
            }
        )


class DeliveryShiftStartView(APIView):
    permission_classes = [IsDelivery]

    def post(self, request):
        try:
            shift = start_driver_shift(request.user)
        except DjangoValidationError as exc:
            return Response({"detail": exc.message}, status=status.HTTP_400_BAD_REQUEST)

        return Response(
            {
                "id": str(shift.id),
                "started_at": shift.started_at.isoformat(),
                "is_active": shift.is_active,
            },
            status=status.HTTP_201_CREATED,
        )


class DeliveryShiftEndView(APIView):
    permission_classes = [IsDelivery]

    def post(self, request):
        try:
            shift = end_driver_shift(request.user)
        except DjangoValidationError as exc:
            return Response({"detail": exc.message}, status=status.HTTP_400_BAD_REQUEST)

        return Response(
            {
                "id": str(shift.id),
                "started_at": shift.started_at.isoformat(),
                "ended_at": shift.ended_at.isoformat() if shift.ended_at else None,
                "duration_minutes": shift.duration_minutes,
                "is_active": shift.is_active,
            }
        )


class DeliveryLocationUpdateView(APIView):
    permission_classes = [IsDelivery]

    def post(self, request):
        serializer = DeliveryLocationUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            profile = record_driver_location(
                user=request.user,
                latitude=data.get("latitude"),
                longitude=data.get("longitude"),
                accuracy_m=data.get("accuracy_m"),
                is_sharing=data.get("is_sharing", True),
            )
        except (DjangoValidationError, ValueError) as exc:
            msg = exc.message if hasattr(exc, "message") else str(exc)
            return Response({"detail": msg}, status=status.HTTP_400_BAD_REQUEST)

        return Response(
            {
                "is_location_sharing": profile.is_location_sharing,
                "last_latitude": float(profile.last_latitude) if profile.last_latitude is not None else None,
                "last_longitude": float(profile.last_longitude) if profile.last_longitude is not None else None,
                "last_location_at": (
                    profile.last_location_at.isoformat() if profile.last_location_at else None
                ),
            }
        )

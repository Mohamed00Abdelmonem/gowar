import secrets
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.utils import timezone
from django.utils.text import slugify
from rest_framework import permissions, serializers as drf_serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView

from apps.locations.models import Area
from apps.merchants.models import MerchantProfile
from apps.stores.models import Store
from .models import PasswordResetToken, User, UserRole
from .serializers import (
    AdminLoginSerializer,
    ChangePasswordSerializer,
    CustomerLoginSerializer,
    CustomerRegisterSerializer,
    MerchantLoginSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    RoleLoginSerializer,
    UserProfileSerializer,
    build_token_payload,
)


class CustomerRegisterView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = "login"

    def post(self, request):
        serializer = CustomerRegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(build_token_payload(user), status=status.HTTP_201_CREATED)


class MerchantRegisterSerializer(drf_serializers.Serializer):
    email = drf_serializers.EmailField()
    password = drf_serializers.CharField(write_only=True, min_length=8)
    phone_number = drf_serializers.CharField(max_length=24)
    first_name = drf_serializers.CharField(max_length=100)
    last_name = drf_serializers.CharField(max_length=100, required=False, allow_blank=True)
    business_name = drf_serializers.CharField(max_length=160)
    store_name = drf_serializers.CharField(max_length=160)
    store_name_en = drf_serializers.CharField(max_length=160, required=False, allow_blank=True)
    store_type = drf_serializers.ChoiceField(
        choices=["supermarket", "mini_market", "grocery", "kiosk", "convenience"],
        default="supermarket",
    )
    area = drf_serializers.UUIDField(required=False, allow_null=True)
    address = drf_serializers.CharField(max_length=255)
    latitude = drf_serializers.FloatField(min_value=-90, max_value=90)
    longitude = drf_serializers.FloatField(min_value=-180, max_value=180)
    delivery_radius_km = drf_serializers.DecimalField(
        max_digits=5, decimal_places=2, default="3.00"
    )

    def validate_email(self, value: str) -> str:
        email = value.strip().lower()
        if User.objects.filter(email=email).exists():
            raise drf_serializers.ValidationError("An account with this email already exists.")
        return email

    def validate_password(self, value: str) -> str:
        try:
            validate_password(value)
        except DjangoValidationError as exc:
            raise drf_serializers.ValidationError(list(exc.messages))
        return value


class MerchantRegisterView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = "login"

    @transaction.atomic
    def post(self, request):
        from django.contrib.gis.geos import Point

        serializer = MerchantRegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        user = User.objects.create_user(
            email=data["email"],
            password=data["password"],
            phone_number=data["phone_number"],
            first_name=data["first_name"],
            last_name=data.get("last_name", ""),
            role=UserRole.MERCHANT,
        )
        profile = MerchantProfile.objects.create(
            user=user,
            business_name=data["business_name"],
            approval_status="pending",
        )
        area_obj = (
            Area.objects.filter(pk=data["area"], is_active=True).first()
            if data.get("area")
            else None
        )
        if data.get("area") and area_obj is None:
            return Response(
                {"area": ["Selected service area is not currently active."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        base_slug = slugify(data.get("store_name_en") or data["store_name"]) or "store"
        unique_slug = f"{base_slug}-{str(user.id)[:8]}"
        Store.objects.create(
            merchant=profile,
            name=data["store_name"],
            name_en=data.get("store_name_en") or data["store_name"],
            slug=unique_slug,
            store_type=data.get("store_type", "supermarket"),
            phone_number=data["phone_number"],
            area=area_obj,
            address=data["address"],
            latitude=data["latitude"],
            longitude=data["longitude"],
            location=Point(data["longitude"], data["latitude"], srid=4326),
            delivery_radius_km=data["delivery_radius_km"],
            approval_status="pending",
            is_active=False,
            is_open=True,
        )
        return Response(
            {
                "detail": "Merchant application submitted and awaiting platform admin approval.",
                "approval_status": "pending",
                "user": UserProfileSerializer(user).data,
            },
            status=status.HTTP_201_CREATED,
        )


class BaseLoginView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = "login"
    serializer_class = RoleLoginSerializer

    def post(self, request):
        serializer = self.serializer_class(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        return Response(build_token_payload(user), status=status.HTTP_200_OK)


class CustomerLoginView(BaseLoginView):
    serializer_class = CustomerLoginSerializer


class MerchantLoginView(BaseLoginView):
    serializer_class = MerchantLoginSerializer


class AdminLoginView(BaseLoginView):
    serializer_class = AdminLoginSerializer


class ThrottledTokenRefreshView(TokenRefreshView):
    throttle_scope = "login"


class LogoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        refresh_token = request.data.get("refresh")
        if refresh_token:
            try:
                token = RefreshToken(refresh_token)
                token.blacklist()
            except Exception:
                return Response(
                    {"detail": "Invalid or expired refresh token."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        return Response({"detail": "Logged out successfully."}, status=status.HTTP_200_OK)


class MeProfileView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(UserProfileSerializer(request.user).data)

    def patch(self, request):
        serializer = UserProfileSerializer(
            request.user, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class ChangePasswordView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        request.user.set_password(serializer.validated_data["new_password"])
        request.user.save(update_fields=["password"])
        return Response({"detail": "Password updated successfully."})


class PasswordResetRequestView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = "password_reset"

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"].strip().lower()
        user = User.objects.filter(email=email, is_active=True).first()
        if user:
            PasswordResetToken.objects.create(
                user=user,
                token=secrets.token_urlsafe(32),
                expires_at=PasswordResetToken.default_expiry(),
            )
        # Do not leak email existence
        return Response(
            {
                "detail": "If that email is registered, a password reset link has been issued."
            }
        )


class PasswordResetConfirmView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = "password_reset"

    @transaction.atomic
    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        token_obj = (
            PasswordResetToken.objects.select_related("user")
            .filter(token=serializer.validated_data["token"])
            .first()
        )
        if not token_obj or not token_obj.is_valid:
            return Response(
                {"detail": "Invalid or expired reset token."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        token_obj.user.set_password(serializer.validated_data["new_password"])
        token_obj.user.save(update_fields=["password"])
        token_obj.used_at = timezone.now()
        token_obj.save(update_fields=["used_at"])
        return Response({"detail": "Password has been reset successfully."})

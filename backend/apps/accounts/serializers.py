from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

from apps.locations.models import CustomerProfile
from .models import User, UserRole
from .phone import normalize_phone_number


def build_token_payload(user: User) -> dict:
    refresh = RefreshToken.for_user(user)
    refresh["role"] = user.role
    if user.email:
        refresh["email"] = user.email
    if user.phone_number:
        refresh["phone_number"] = user.phone_number

    merchant_profile = getattr(user, "merchant_profile", None)
    stores_data = []
    if merchant_profile:
        stores_data = [
            {
                "id": str(s.id),
                "name": s.name,
                "name_en": s.name_en,
                "approval_status": s.approval_status,
                "is_open": s.is_open,
            }
            for s in merchant_profile.stores.all()
        ]

    customer_profile = getattr(user, "customer_profile", None)
    return {
        "access": str(refresh.access_token),
        "refresh": str(refresh),
        "user": {
            "id": str(user.id),
            "email": user.email,
            "phone_number": user.phone_number,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "full_name": user.full_name,
            "role": user.role,
            "is_verified": user.is_verified,
            "needs_phone_completion": not bool(user.phone_number),
            "search_radius_km": customer_profile.search_radius_km if customer_profile else None,
            "merchant_approval_status": (
                merchant_profile.approval_status if merchant_profile else None
            ),
            "stores": stores_data,
        },
    }


class UserProfileSerializer(serializers.ModelSerializer):
    full_name = serializers.ReadOnlyField()
    search_radius_km = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "phone_number",
            "first_name",
            "last_name",
            "full_name",
            "role",
            "is_verified",
            "date_joined",
            "last_login",
            "search_radius_km",
        ]
        read_only_fields = ["id", "email", "role", "is_verified", "date_joined", "last_login"]

    def get_search_radius_km(self, obj: User):
        profile = getattr(obj, "customer_profile", None)
        return profile.search_radius_km if profile else None


class CustomerRegisterSerializer(serializers.Serializer):
    phone_number = serializers.CharField(max_length=24)
    password = serializers.CharField(write_only=True, min_length=8)
    email = serializers.EmailField(required=False, allow_blank=True, allow_null=True)
    first_name = serializers.CharField(max_length=100)
    last_name = serializers.CharField(max_length=100, required=False, allow_blank=True)

    def validate_phone_number(self, value: str) -> str:
        try:
            normalized = normalize_phone_number(value)
        except ValueError as exc:
            raise serializers.ValidationError(str(exc)) from exc
        if User.objects.filter(phone_number=normalized).exists():
            raise serializers.ValidationError("يوجد حساب مسجل بالفعل برقم الموبايل هذا.")
        return normalized

    def validate_email(self, value: str | None) -> str | None:
        if not value or not value.strip():
            return None
        email = value.strip().lower()
        if User.objects.filter(email=email).exists():
            raise serializers.ValidationError("يوجد حساب مسجل بالفعل بهذا البريد الإلكتروني.")
        return email

    def validate_password(self, value: str) -> str:
        try:
            validate_password(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages))
        return value

    def create(self, validated_data):
        try:
            user = User.objects.create_user(
                email=validated_data.get("email"),
                password=validated_data["password"],
                phone_number=validated_data["phone_number"],
                first_name=validated_data["first_name"],
                last_name=validated_data.get("last_name", ""),
                role=UserRole.CUSTOMER,
                is_verified=False,
            )
        except IntegrityError as exc:
            raise serializers.ValidationError(
                {"phone_number": ["يوجد حساب مسجل بالفعل برقم الموبايل هذا."]}
            ) from exc
        CustomerProfile.objects.get_or_create(user=user)
        return user


class RoleLoginSerializer(serializers.Serializer):
    phone_number = serializers.CharField(max_length=24)
    password = serializers.CharField(write_only=True)

    expected_role: str | None = None

    def validate(self, attrs):
        try:
            normalized_phone = normalize_phone_number(attrs["phone_number"])
        except ValueError as exc:
            raise serializers.ValidationError({"phone_number": [str(exc)]}) from exc

        password = attrs["password"]
        user = User.objects.filter(phone_number=normalized_phone).first()
        if not user or not user.check_password(password):
            raise serializers.ValidationError("رقم الموبايل أو كلمة المرور غير صحيحة.")
        if not user.is_active:
            raise serializers.ValidationError("تم إيقاف أو تعطيل هذا الحساب.")
        if self.expected_role and user.role != self.expected_role:
            raise serializers.ValidationError("رقم الموبايل أو كلمة المرور غير صحيحة.")
        if user.role == UserRole.MERCHANT:
            profile = getattr(user, "merchant_profile", None)
            if not profile:
                raise serializers.ValidationError("Merchant profile is not configured.")
            if profile.approval_status == "pending":
                raise serializers.ValidationError(
                    "Your merchant application is awaiting admin approval. You can sign in once approved."
                )
            if profile.approval_status == "rejected":
                raise serializers.ValidationError(
                    "Your merchant application was rejected. Please contact platform support."
                )
            if profile.approval_status == "suspended":
                raise serializers.ValidationError(
                    "Your merchant account is currently suspended."
                )
        attrs["user"] = user
        return attrs


class CustomerLoginSerializer(RoleLoginSerializer):
    expected_role = UserRole.CUSTOMER


class MerchantLoginSerializer(RoleLoginSerializer):
    expected_role = UserRole.MERCHANT


class AdminLoginSerializer(RoleLoginSerializer):
    expected_role = UserRole.ADMIN


class DeliveryLoginSerializer(RoleLoginSerializer):
    expected_role = UserRole.DELIVERY


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)

    def validate_current_password(self, value):
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("Current password is incorrect.")
        return value

    def validate_new_password(self, value):
        try:
            validate_password(value, self.context["request"].user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages))
        return value


class PasswordResetRequestSerializer(serializers.Serializer):
    phone_number = serializers.CharField(max_length=24)

    def validate_phone_number(self, value: str) -> str:
        try:
            return normalize_phone_number(value)
        except ValueError as exc:
            raise serializers.ValidationError(str(exc)) from exc


class CompletePhoneSerializer(serializers.Serializer):
    phone_number = serializers.CharField(max_length=24)

    def validate_phone_number(self, value: str) -> str:
        try:
            normalized = normalize_phone_number(value)
        except ValueError as exc:
            raise serializers.ValidationError(str(exc)) from exc
        user = self.context["request"].user
        if User.objects.filter(phone_number=normalized).exclude(pk=user.pk).exists():
            raise serializers.ValidationError("رقم الموبايل مستخدم بالفعل لحساب آخر.")
        return normalized


class PasswordResetConfirmSerializer(serializers.Serializer):
    token = serializers.CharField()
    new_password = serializers.CharField(write_only=True, min_length=8)

    def validate_new_password(self, value):
        try:
            validate_password(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages))
        return value

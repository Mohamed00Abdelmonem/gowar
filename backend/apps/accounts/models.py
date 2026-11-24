import uuid
from datetime import timedelta
from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.db import models
from django.utils import timezone

from .phone import try_normalize_phone_number


class UserRole(models.TextChoices):
    CUSTOMER = "customer", "Customer"
    MERCHANT = "merchant", "Merchant"
    DELIVERY = "delivery", "Delivery Personnel"
    ADMIN = "admin", "Platform Admin"


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, email: str | None = None, password: str | None = None, **extra_fields):
        raw_phone = extra_fields.pop("phone_number", None)
        normalized_phone = None
        if raw_phone:
            normalized_phone = try_normalize_phone_number(raw_phone) or raw_phone.strip()

        normalized_email = self.normalize_email(email).lower() if email else None
        if not normalized_email and not normalized_phone:
            raise ValueError("Either phone_number or email must be provided.")

        user = self.model(
            email=normalized_email,
            phone_number=normalized_phone,
            **extra_fields,
        )
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email: str | None = None, password: str | None = None, **extra_fields):
        extra_fields.setdefault("role", UserRole.CUSTOMER)
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(email=email, password=password, **extra_fields)

    def create_superuser(self, email: str | None = None, password: str | None = None, **extra_fields):
        extra_fields.setdefault("role", UserRole.ADMIN)
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_verified", True)
        if not extra_fields.get("is_staff") or not extra_fields.get("is_superuser"):
            raise ValueError("Superuser must have is_staff=True and is_superuser=True.")
        return self._create_user(email=email, password=password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True, null=True, blank=True, db_index=True)
    phone_number = models.CharField(max_length=24, unique=True, null=True, blank=True, db_index=True)
    first_name = models.CharField(max_length=100, blank=True)
    last_name = models.CharField(max_length=100, blank=True)
    role = models.CharField(
        max_length=20,
        choices=UserRole.choices,
        default=UserRole.CUSTOMER,
        db_index=True,
    )
    is_active = models.BooleanField(default=True)
    is_verified = models.BooleanField(default=False)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(default=timezone.now)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    class Meta:
        ordering = ["-date_joined"]
        indexes = [
            models.Index(fields=["role", "is_active"]),
        ]

    @property
    def full_name(self) -> str:
        full = f"{self.first_name} {self.last_name}".strip()
        return full or self.phone_number or self.email or str(self.id)

    def __str__(self):
        return f"{self.phone_number or self.email} ({self.role})"


class PasswordResetToken(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="password_reset_tokens")
    token = models.CharField(max_length=64, unique=True, db_index=True)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    @classmethod
    def default_expiry(cls):
        return timezone.now() + timedelta(hours=2)

    @property
    def is_valid(self) -> bool:
        return self.used_at is None and timezone.now() <= self.expires_at

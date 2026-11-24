from decimal import Decimal
from django.conf import settings
from django.contrib.gis.db import models as gis_models
from django.contrib.gis.geos import Point
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from apps.common.models import UUIDTimeStampedModel
from apps.locations.models import Area
from apps.merchants.models import ApprovalStatus, MerchantProfile


class StoreType(models.TextChoices):
    SUPERMARKET = "supermarket", "Supermarket"
    MINI_MARKET = "mini_market", "Mini Market"
    GROCERY = "grocery", "Grocery Store"
    KIOSK = "kiosk", "Street Kiosk"
    CONVENIENCE = "convenience", "Convenience Store"


class Store(UUIDTimeStampedModel):
    merchant = models.ForeignKey(
        MerchantProfile,
        on_delete=models.CASCADE,
        related_name="stores",
    )
    name = models.CharField(max_length=160)
    name_en = models.CharField(max_length=160, blank=True)
    slug = models.SlugField(max_length=180, unique=True, allow_unicode=True)
    store_type = models.CharField(
        max_length=30,
        choices=StoreType.choices,
        default=StoreType.SUPERMARKET,
        db_index=True,
    )
    description = models.TextField(blank=True)
    description_en = models.TextField(blank=True)
    logo = models.ImageField(upload_to="stores/logos/", blank=True, null=True)
    cover_image = models.ImageField(upload_to="stores/covers/", blank=True, null=True)
    logo_url = models.URLField(blank=True)
    cover_image_url = models.URLField(blank=True)
    phone_number = models.CharField(max_length=24)
    address = models.CharField(max_length=255)
    address_en = models.CharField(max_length=255, blank=True)
    area = models.ForeignKey(
        Area,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="stores",
    )
    latitude = models.DecimalField(max_digits=9, decimal_places=6)
    longitude = models.DecimalField(max_digits=9, decimal_places=6)
    location = gis_models.PointField(geography=True, srid=4326, spatial_index=True)
    opening_hours = models.CharField(max_length=120, default="8:00 AM - 12:00 AM")
    is_active = models.BooleanField(default=True, db_index=True)
    is_open = models.BooleanField(default=True, db_index=True)
    approval_status = models.CharField(
        max_length=20,
        choices=ApprovalStatus.choices,
        default=ApprovalStatus.PENDING,
        db_index=True,
    )

    # Merchant Delivery Coverage Settings (Strictly independent from customer search radius)
    delivery_enabled = models.BooleanField(default=True)
    delivery_radius_km = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal("3.00"),
        validators=[MinValueValidator(Decimal("0.50")), MaxValueValidator(Decimal("50.00"))],
    )
    delivery_fee = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        default=Decimal("15.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    delivery_price_per_km = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        default=Decimal("10.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    minimum_order_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal("50.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    free_delivery_threshold = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
    )
    estimated_delivery_minutes = models.PositiveSmallIntegerField(default=25)
    commission_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal("5.00"),
        validators=[MinValueValidator(Decimal("0.00")), MaxValueValidator(Decimal("50.00"))],
    )
    rating = models.DecimalField(max_digits=3, decimal_places=2, default=Decimal("4.70"))
    review_count = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["name"]
        indexes = [
            models.Index(fields=["approval_status", "is_active", "is_open"]),
            models.Index(fields=["area", "store_type"]),
        ]

    def save(self, *args, **kwargs):
        self.location = Point(float(self.longitude), float(self.latitude), srid=4326)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} ({self.approval_status})"


class FavoriteStore(UUIDTimeStampedModel):
    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="favorite_stores",
    )
    store = models.ForeignKey(
        Store,
        on_delete=models.CASCADE,
        related_name="favorited_by",
    )

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["customer", "store"],
                name="uniq_customer_favorite_store",
            )
        ]
        indexes = [
            models.Index(fields=["customer", "created_at"]),
        ]

    def __str__(self):
        return f"{self.customer_id} ♥ {self.store_id}"

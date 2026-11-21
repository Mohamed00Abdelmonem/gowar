from django.conf import settings
from django.contrib.gis.db import models as gis_models
from django.contrib.gis.geos import Point
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models, transaction

from apps.common.models import UUIDTimeStampedModel
from .validators import DEFAULT_RADIUS_KM, MAX_RADIUS_KM, MIN_RADIUS_KM


class Area(UUIDTimeStampedModel):
    name_ar = models.CharField(max_length=120)
    name_en = models.CharField(max_length=120)
    city_ar = models.CharField(max_length=80, default="القاهرة")
    city_en = models.CharField(max_length=80, default="Cairo")
    delivery_hub_note = models.CharField(max_length=255, blank=True)
    center_location = gis_models.PointField(
        geography=True, srid=4326, spatial_index=True, null=True, blank=True
    )
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        ordering = ["name_ar"]

    def __str__(self):
        return f"{self.name_ar} ({self.name_en})"


class CustomerProfile(UUIDTimeStampedModel):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="customer_profile",
    )
    search_radius_km = models.PositiveSmallIntegerField(
        default=DEFAULT_RADIUS_KM,
        validators=[MinValueValidator(MIN_RADIUS_KM), MaxValueValidator(MAX_RADIUS_KM)],
    )

    def __str__(self):
        return f"CustomerProfile<{self.user.email}> (radius={self.search_radius_km}km)"


class CustomerAddress(UUIDTimeStampedModel):
    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="addresses",
    )
    area = models.ForeignKey(
        Area,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="addresses",
    )
    label = models.CharField(max_length=60, default="المنزل")
    recipient_name = models.CharField(max_length=120, blank=True)
    phone_number = models.CharField(max_length=24, blank=True)
    formatted_address = models.CharField(max_length=320)
    latitude = models.DecimalField(max_digits=9, decimal_places=6)
    longitude = models.DecimalField(max_digits=9, decimal_places=6)
    location = gis_models.PointField(geography=True, srid=4326, spatial_index=True)
    building_number = models.CharField(max_length=30, blank=True)
    floor = models.CharField(max_length=20, blank=True)
    apartment = models.CharField(max_length=20, blank=True)
    additional_instructions = models.TextField(blank=True)
    is_default = models.BooleanField(default=False, db_index=True)

    class Meta:
        ordering = ["-is_default", "-updated_at"]
        indexes = [
            models.Index(fields=["customer", "is_default"]),
        ]

    def save(self, *args, **kwargs):
        self.location = Point(float(self.longitude), float(self.latitude), srid=4326)
        with transaction.atomic():
            if self.is_default:
                CustomerAddress.objects.filter(
                    customer=self.customer, is_default=True
                ).exclude(pk=self.pk).update(is_default=False)
            super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.label}: {self.formatted_address}"

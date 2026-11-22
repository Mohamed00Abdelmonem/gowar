from django.conf import settings
from django.contrib.gis.db import models as gis_models
from django.contrib.gis.geos import Point
from django.db import models
from django.db.models import Q
from django.utils import timezone

from apps.common.models import UUIDTimeStampedModel
from apps.merchants.models import MerchantProfile


class VehicleType(models.TextChoices):
    MOTORCYCLE = "motorcycle", "Motorcycle"
    BICYCLE = "bicycle", "Bicycle"
    CAR = "car", "Car"
    ON_FOOT = "on_foot", "On Foot"


class DeliveryDriverProfile(UUIDTimeStampedModel):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="delivery_profile",
    )
    merchant = models.ForeignKey(
        MerchantProfile,
        on_delete=models.PROTECT,
        related_name="delivery_drivers",
    )
    vehicle_type = models.CharField(
        max_length=24,
        choices=VehicleType.choices,
        default=VehicleType.MOTORCYCLE,
    )
    vehicle_plate = models.CharField(max_length=40, blank=True)
    notes = models.TextField(blank=True)

    is_active = models.BooleanField(default=True, db_index=True)
    is_archived = models.BooleanField(default=False, db_index=True)
    deactivated_at = models.DateTimeField(null=True, blank=True)

    last_latitude = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True
    )
    last_longitude = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True
    )
    last_location = gis_models.PointField(
        geography=True, srid=4326, null=True, blank=True
    )
    last_location_accuracy_m = models.FloatField(null=True, blank=True)
    last_location_at = models.DateTimeField(null=True, blank=True, db_index=True)
    last_seen_at = models.DateTimeField(null=True, blank=True, db_index=True)
    is_location_sharing = models.BooleanField(default=False)

    class Meta:
        ordering = ["user__first_name", "user__last_name", "-created_at"]
        indexes = [
            models.Index(fields=["merchant", "is_active", "is_archived"]),
            models.Index(fields=["merchant", "last_seen_at"]),
        ]

    def update_location(
        self, latitude: float, longitude: float, accuracy_m: float | None = None
    ) -> None:
        now = timezone.now()
        self.last_latitude = latitude
        self.last_longitude = longitude
        self.last_location = Point(float(longitude), float(latitude), srid=4326)
        self.last_location_accuracy_m = accuracy_m
        self.last_location_at = now
        self.last_seen_at = now
        self.is_location_sharing = True

    def __str__(self) -> str:
        return f"{self.user.full_name} -> {self.merchant.business_name}"


class DeliveryShift(UUIDTimeStampedModel):
    driver = models.ForeignKey(
        DeliveryDriverProfile,
        on_delete=models.CASCADE,
        related_name="shifts",
    )
    started_at = models.DateTimeField(default=timezone.now, db_index=True)
    ended_at = models.DateTimeField(null=True, blank=True, db_index=True)
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        ordering = ["-started_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["driver"],
                condition=Q(is_active=True),
                name="uniq_active_shift_per_driver",
            )
        ]
        indexes = [
            models.Index(fields=["driver", "started_at"]),
            models.Index(fields=["driver", "is_active"]),
        ]

    @property
    def duration_minutes(self) -> int:
        end = self.ended_at or timezone.now()
        seconds = max(0.0, (end - self.started_at).total_seconds())
        return int(round(seconds / 60.0))

    def __str__(self) -> str:
        state = "active" if self.is_active else "ended"
        return f"Shift<{self.driver.user.email}> ({state})"

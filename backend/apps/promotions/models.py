from django.core.exceptions import ValidationError
from django.db import models

from apps.common.models import UUIDTimeStampedModel
from .validators import validate_promotion_image


class PromotionType(models.TextChoices):
    GENERAL = "general", "General Gowar Promotion"
    STORE = "store", "Store Promotion"
    PRODUCT = "product", "Product Promotion"
    CATEGORY = "category", "Category Promotion"


class PricingModel(models.TextChoices):
    FLAT = "flat", "Flat Campaign Fee"
    CPM = "cpm", "Cost Per Mille (1000 Impressions)"
    CPC = "cpc", "Cost Per Click"


class Promotion(UUIDTimeStampedModel):
    title = models.CharField(max_length=160)
    title_en = models.CharField(max_length=160, blank=True)
    description = models.TextField(blank=True)
    description_en = models.TextField(blank=True)
    discount_label = models.CharField(max_length=60, blank=True)
    discount_label_en = models.CharField(max_length=60, blank=True)

    image = models.ImageField(
        upload_to="promotions/desktop/",
        blank=True,
        null=True,
        validators=[validate_promotion_image],
    )
    image_url = models.URLField(blank=True)
    mobile_image = models.ImageField(
        upload_to="promotions/mobile/",
        blank=True,
        null=True,
        validators=[validate_promotion_image],
    )
    mobile_image_url = models.URLField(blank=True)

    promotion_type = models.CharField(
        max_length=20,
        choices=PromotionType.choices,
        default=PromotionType.GENERAL,
        db_index=True,
    )
    target_store = models.ForeignKey(
        "stores.Store",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="promotions",
    )
    target_product = models.ForeignKey(
        "catalog.Product",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="promotions",
    )
    target_category = models.ForeignKey(
        "catalog.Category",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="promotions",
    )
    target_area = models.ForeignKey(
        "locations.Area",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="promotions",
    )
    custom_destination = models.CharField(max_length=255, blank=True)

    cta_text = models.CharField(max_length=60, default="تسوق الآن")
    cta_text_en = models.CharField(max_length=60, blank=True, default="Shop Now")
    overlay_color = models.CharField(max_length=32, blank=True, default="#1C1917")

    start_at = models.DateTimeField(db_index=True)
    end_at = models.DateTimeField(db_index=True)
    is_active = models.BooleanField(default=True, db_index=True)
    is_archived = models.BooleanField(default=False, db_index=True)
    display_order = models.PositiveIntegerField(default=0, db_index=True)

    # Basic atomic analytics counters
    impressions_count = models.PositiveIntegerField(default=0)
    clicks_count = models.PositiveIntegerField(default=0)

    # Future paid advertising readiness (no billing logic in v1)
    is_paid_campaign = models.BooleanField(default=False, db_index=True)
    sponsor_merchant = models.ForeignKey(
        "merchants.MerchantProfile",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sponsored_promotions",
    )
    campaign_budget = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True
    )
    pricing_model = models.CharField(
        max_length=20,
        choices=PricingModel.choices,
        blank=True,
    )
    priority_boost = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["-priority_boost", "display_order", "-created_at"]
        indexes = [
            models.Index(
                fields=["is_active", "is_archived", "display_order", "start_at", "end_at"]
            ),
            models.Index(fields=["promotion_type", "is_active"]),
        ]

    @property
    def ctr(self) -> float:
        if self.impressions_count <= 0:
            return 0.0
        return round((self.clicks_count / self.impressions_count) * 100.0, 2)

    def clean(self) -> None:
        super().clean()
        errors = {}
        if self.start_at and self.end_at and self.end_at <= self.start_at:
            errors["end_at"] = "End date must be after start date."

        if self.promotion_type == PromotionType.STORE and not self.target_store_id:
            errors["target_store"] = "Store promotions must reference a valid store."
        elif self.promotion_type == PromotionType.PRODUCT and not self.target_product_id:
            errors["target_product"] = "Product promotions must reference a valid product."
        elif self.promotion_type == PromotionType.CATEGORY and not self.target_category_id:
            errors["target_category"] = "Category promotions must reference a valid category."

        if self.custom_destination:
            dest = self.custom_destination.strip()
            if not (
                dest.startswith("/")
                or dest.startswith("https://")
                or dest.startswith("http://")
            ):
                errors["custom_destination"] = (
                    "Custom destination must be an internal path (starting with /) or an http(s) URL."
                )

        if self.is_active and not self.is_archived and not (self.image or self.image_url):
            errors["image"] = "An active promotion must have a banner image or image URL."

        if errors:
            raise ValidationError(errors)

    def __str__(self) -> str:
        return f"{self.title} ({self.promotion_type})"

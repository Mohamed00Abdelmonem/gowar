from rest_framework import serializers

from apps.catalog.models import Category, Product
from apps.locations.models import Area
from apps.merchants.models import ApprovalStatus, MerchantProfile
from apps.stores.models import Store
from .models import Promotion, PromotionType
from .validators import validate_promotion_image


def _resolve_media_url(request, image_field, fallback_url: str) -> str:
    if image_field:
        url = image_field.url
        return request.build_absolute_uri(url) if request else url
    return fallback_url or ""


class PromotionPublicSerializer(serializers.ModelSerializer):
    image = serializers.SerializerMethodField()
    mobile_image = serializers.SerializerMethodField()
    target_store_name = serializers.SerializerMethodField()
    target_store_name_en = serializers.SerializerMethodField()
    target_product_name = serializers.SerializerMethodField()
    target_product_name_en = serializers.SerializerMethodField()
    target_category_name = serializers.SerializerMethodField()
    target_category_name_en = serializers.SerializerMethodField()

    class Meta:
        model = Promotion
        fields = [
            "id",
            "title",
            "title_en",
            "description",
            "description_en",
            "discount_label",
            "discount_label_en",
            "image",
            "mobile_image",
            "promotion_type",
            "target_store",
            "target_store_name",
            "target_store_name_en",
            "target_product",
            "target_product_name",
            "target_product_name_en",
            "target_category",
            "target_category_name",
            "target_category_name_en",
            "target_area",
            "custom_destination",
            "cta_text",
            "cta_text_en",
            "overlay_color",
            "display_order",
            "start_at",
            "end_at",
        ]

    def get_image(self, obj: Promotion) -> str:
        return _resolve_media_url(self.context.get("request"), obj.image, obj.image_url)

    def get_mobile_image(self, obj: Promotion) -> str:
        return _resolve_media_url(
            self.context.get("request"), obj.mobile_image, obj.mobile_image_url
        )

    def get_target_store_name(self, obj: Promotion) -> str:
        return obj.target_store.name if obj.target_store else ""

    def get_target_store_name_en(self, obj: Promotion) -> str:
        return (obj.target_store.name_en or obj.target_store.name) if obj.target_store else ""

    def get_target_product_name(self, obj: Promotion) -> str:
        return obj.target_product.name if obj.target_product else ""

    def get_target_product_name_en(self, obj: Promotion) -> str:
        return (
            (obj.target_product.name_en or obj.target_product.name)
            if obj.target_product
            else ""
        )

    def get_target_category_name(self, obj: Promotion) -> str:
        return obj.target_category.name if obj.target_category else ""

    def get_target_category_name_en(self, obj: Promotion) -> str:
        return (
            (obj.target_category.name_en or obj.target_category.name)
            if obj.target_category
            else ""
        )


class PromotionAdminSerializer(serializers.ModelSerializer):
    image_resolved = serializers.SerializerMethodField()
    mobile_image_resolved = serializers.SerializerMethodField()
    target_store_name = serializers.SerializerMethodField()
    target_product_name = serializers.SerializerMethodField()
    target_category_name = serializers.SerializerMethodField()
    target_area_name = serializers.SerializerMethodField()
    ctr = serializers.FloatField(read_only=True)

    target_store = serializers.PrimaryKeyRelatedField(
        queryset=Store.objects.all(), required=False, allow_null=True
    )
    target_product = serializers.PrimaryKeyRelatedField(
        queryset=Product.objects.all(), required=False, allow_null=True
    )
    target_category = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.all(), required=False, allow_null=True
    )
    target_area = serializers.PrimaryKeyRelatedField(
        queryset=Area.objects.all(), required=False, allow_null=True
    )
    sponsor_merchant = serializers.PrimaryKeyRelatedField(
        queryset=MerchantProfile.objects.all(), required=False, allow_null=True
    )

    class Meta:
        model = Promotion
        fields = [
            "id",
            "title",
            "title_en",
            "description",
            "description_en",
            "discount_label",
            "discount_label_en",
            "image",
            "image_url",
            "image_resolved",
            "mobile_image",
            "mobile_image_url",
            "mobile_image_resolved",
            "promotion_type",
            "target_store",
            "target_store_name",
            "target_product",
            "target_product_name",
            "target_category",
            "target_category_name",
            "target_area",
            "target_area_name",
            "custom_destination",
            "cta_text",
            "cta_text_en",
            "overlay_color",
            "start_at",
            "end_at",
            "is_active",
            "is_archived",
            "display_order",
            "impressions_count",
            "clicks_count",
            "ctr",
            "is_paid_campaign",
            "sponsor_merchant",
            "campaign_budget",
            "pricing_model",
            "priority_boost",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "impressions_count", "clicks_count", "ctr", "created_at", "updated_at"]

    def get_image_resolved(self, obj: Promotion) -> str:
        return _resolve_media_url(self.context.get("request"), obj.image, obj.image_url)

    def get_mobile_image_resolved(self, obj: Promotion) -> str:
        return _resolve_media_url(
            self.context.get("request"), obj.mobile_image, obj.mobile_image_url
        )

    def get_target_store_name(self, obj: Promotion) -> str:
        return obj.target_store.name if obj.target_store else ""

    def get_target_product_name(self, obj: Promotion) -> str:
        return obj.target_product.name if obj.target_product else ""

    def get_target_category_name(self, obj: Promotion) -> str:
        return obj.target_category.name if obj.target_category else ""

    def get_target_area_name(self, obj: Promotion) -> str:
        return obj.target_area.name_ar if obj.target_area else ""

    def validate_image(self, value):
        if value:
            validate_promotion_image(value)
        return value

    def validate_mobile_image(self, value):
        if value:
            validate_promotion_image(value)
        return value

    def validate(self, attrs):
        instance = self.instance
        promo_type = attrs.get(
            "promotion_type",
            instance.promotion_type if instance else PromotionType.GENERAL,
        )
        start_at = attrs.get("start_at", instance.start_at if instance else None)
        end_at = attrs.get("end_at", instance.end_at if instance else None)
        is_active = attrs.get("is_active", instance.is_active if instance else True)
        is_archived = attrs.get("is_archived", instance.is_archived if instance else False)

        target_store = attrs.get("target_store", instance.target_store if instance else None)
        target_product = attrs.get(
            "target_product", instance.target_product if instance else None
        )
        target_category = attrs.get(
            "target_category", instance.target_category if instance else None
        )
        custom_destination = attrs.get(
            "custom_destination", instance.custom_destination if instance else ""
        )

        image = attrs.get("image", instance.image if instance else None)
        image_url = attrs.get("image_url", instance.image_url if instance else "")

        if start_at and end_at and end_at <= start_at:
            raise serializers.ValidationError(
                {"end_at": "End date must be after start date."}
            )

        if promo_type == PromotionType.STORE:
            if not target_store:
                raise serializers.ValidationError(
                    {"target_store": "Store promotions must reference a valid store."}
                )
            if not target_store.is_active or target_store.approval_status != ApprovalStatus.APPROVED:
                raise serializers.ValidationError(
                    {"target_store": "Selected store must be active and approved."}
                )
        elif promo_type == PromotionType.PRODUCT:
            if not target_product:
                raise serializers.ValidationError(
                    {"target_product": "Product promotions must reference a valid product."}
                )
            if not target_product.is_active or not target_product.is_available:
                raise serializers.ValidationError(
                    {"target_product": "Selected product must be active and available."}
                )
            if (
                not target_product.store.is_active
                or target_product.store.approval_status != ApprovalStatus.APPROVED
            ):
                raise serializers.ValidationError(
                    {"target_product": "Product's store must be active and approved."}
                )
        elif promo_type == PromotionType.CATEGORY:
            if not target_category:
                raise serializers.ValidationError(
                    {"target_category": "Category promotions must reference a valid category."}
                )
            if not target_category.is_active:
                raise serializers.ValidationError(
                    {"target_category": "Selected category must be active."}
                )

        if custom_destination:
            dest = custom_destination.strip()
            if not (
                dest.startswith("/")
                or dest.startswith("https://")
                or dest.startswith("http://")
            ):
                raise serializers.ValidationError(
                    {
                        "custom_destination": (
                            "Custom destination must start with '/', 'https://', or 'http://'."
                        )
                    }
                )

        if is_active and not is_archived and not (image or image_url):
            raise serializers.ValidationError(
                {"image": "An active promotion must have a banner image or image URL."}
            )

        return attrs

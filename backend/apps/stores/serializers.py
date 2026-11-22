from rest_framework import serializers
from .models import Store


class StorePublicSerializer(serializers.ModelSerializer):
    area_name_ar = serializers.CharField(source="area.name_ar", read_only=True)
    area_name_en = serializers.CharField(source="area.name_en", read_only=True)
    distance_meters = serializers.SerializerMethodField()
    distance_km = serializers.SerializerMethodField()
    delivery_available = serializers.SerializerMethodField()
    delivery_status = serializers.SerializerMethodField()
    distance_type = serializers.SerializerMethodField()
    customer_completed_orders_count = serializers.SerializerMethodField()
    is_previously_ordered = serializers.SerializerMethodField()

    class Meta:
        model = Store
        fields = [
            "id",
            "name",
            "name_en",
            "slug",
            "store_type",
            "description",
            "description_en",
            "logo",
            "cover_image",
            "logo_url",
            "cover_image_url",
            "phone_number",
            "address",
            "address_en",
            "area",
            "area_name_ar",
            "area_name_en",
            "latitude",
            "longitude",
            "opening_hours",
            "is_open",
            "delivery_enabled",
            "delivery_fee",
            "delivery_radius_km",
            "minimum_order_amount",
            "free_delivery_threshold",
            "estimated_delivery_minutes",
            "rating",
            "review_count",
            "distance_meters",
            "distance_km",
            "delivery_available",
            "delivery_status",
            "distance_type",
            "customer_completed_orders_count",
            "is_previously_ordered",
        ]

    def _dist_m(self, obj: Store) -> int | None:
        dist = getattr(obj, "distance", None)
        if dist is None:
            return None
        return int(round(dist.m))

    def get_distance_meters(self, obj: Store) -> int | None:
        return self._dist_m(obj)

    def get_distance_km(self, obj: Store) -> float | None:
        meters = self._dist_m(obj)
        if meters is None:
            return None
        return round(meters / 1000.0, 2)

    def get_delivery_available(self, obj: Store) -> bool:
        if not obj.delivery_enabled:
            return False
        km = self.get_distance_km(obj)
        if km is None:
            return obj.delivery_enabled
        return km <= float(obj.delivery_radius_km)

    def get_delivery_status(self, obj: Store) -> str:
        if not obj.delivery_enabled:
            return "pickup_only"
        km = self.get_distance_km(obj)
        if km is not None and km > float(obj.delivery_radius_km):
            return "outside_delivery_area"
        return "deliverable"

    def get_distance_type(self, obj: Store) -> str:
        return "straight_line_approximate"

    def get_customer_completed_orders_count(self, obj: Store) -> int:
        return int(getattr(obj, "customer_completed_orders", 0) or 0)

    def get_is_previously_ordered(self, obj: Store) -> bool:
        return self.get_customer_completed_orders_count(obj) > 0


class MerchantStoreSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = Store
        fields = [
            "id",
            "name",
            "name_en",
            "store_type",
            "description",
            "description_en",
            "logo",
            "cover_image",
            "logo_url",
            "cover_image_url",
            "phone_number",
            "address",
            "address_en",
            "area",
            "latitude",
            "longitude",
            "opening_hours",
            "is_open",
            "approval_status",
            "commission_rate",
            "delivery_enabled",
            "delivery_radius_km",
            "delivery_fee",
            "minimum_order_amount",
            "free_delivery_threshold",
            "estimated_delivery_minutes",
        ]
        read_only_fields = ["id", "approval_status", "commission_rate"]

    def validate_area(self, value):
        if value is not None and not value.is_active:
            raise serializers.ValidationError(
                "Selected service area is not currently active."
            )
        return value

from rest_framework import serializers
from .models import Area, CustomerAddress, CustomerProfile
from .validators import MAX_RADIUS_KM, MIN_RADIUS_KM


class AreaSerializer(serializers.ModelSerializer):
    latitude = serializers.SerializerMethodField()
    longitude = serializers.SerializerMethodField()

    class Meta:
        model = Area
        fields = [
            "id",
            "name_ar",
            "name_en",
            "city_ar",
            "city_en",
            "delivery_hub_note",
            "latitude",
            "longitude",
            "is_active",
        ]

    def get_latitude(self, obj: Area):
        return obj.center_location.y if obj.center_location else None

    def get_longitude(self, obj: Area):
        return obj.center_location.x if obj.center_location else None


class SearchRadiusSerializer(serializers.ModelSerializer):
    search_radius_km = serializers.IntegerField(
        min_value=MIN_RADIUS_KM,
        max_value=MAX_RADIUS_KM,
    )

    class Meta:
        model = CustomerProfile
        fields = ["search_radius_km"]


class CustomerAddressSerializer(serializers.ModelSerializer):
    area_name_ar = serializers.CharField(source="area.name_ar", read_only=True)
    area_name_en = serializers.CharField(source="area.name_en", read_only=True)

    class Meta:
        model = CustomerAddress
        fields = [
            "id",
            "area",
            "area_name_ar",
            "area_name_en",
            "label",
            "recipient_name",
            "phone_number",
            "formatted_address",
            "latitude",
            "longitude",
            "building_number",
            "floor",
            "apartment",
            "additional_instructions",
            "is_default",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_area(self, value):
        if value is not None and not value.is_active:
            raise serializers.ValidationError(
                "This service area is not currently supported."
            )
        return value

    def validate_latitude(self, value):
        if not (-90 <= float(value) <= 90):
            raise serializers.ValidationError("Latitude must be between -90 and 90.")
        return value

    def validate_longitude(self, value):
        if not (-180 <= float(value) <= 180):
            raise serializers.ValidationError("Longitude must be between -180 and 180.")
        return value

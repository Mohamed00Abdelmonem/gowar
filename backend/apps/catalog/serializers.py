from urllib.parse import urlparse

from django.conf import settings
from django.templatetags.static import static
from django.utils.text import slugify
from PIL import Image, UnidentifiedImageError
from rest_framework import serializers
from .models import (
    CatalogLibraryCategory,
    CatalogLibraryItem,
    Category,
    Product,
    ProductImage,
)

MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024  # 5 MB
ALLOWED_PRODUCT_IMAGE_FORMATS = {"JPEG", "PNG", "WEBP"}


def validate_uploaded_product_image(uploaded_file) -> None:
    if not uploaded_file:
        return
    if getattr(uploaded_file, "size", 0) > MAX_PRODUCT_IMAGE_BYTES:
        raise serializers.ValidationError("Image size must not exceed 5 MB.")
    pos = uploaded_file.tell() if hasattr(uploaded_file, "tell") else None
    try:
        img = Image.open(uploaded_file)
        img.verify()
        if (img.format or "").upper() not in ALLOWED_PRODUCT_IMAGE_FORMATS:
            raise serializers.ValidationError(
                "Unsupported image format. Allowed formats: JPEG, PNG, WEBP."
            )
    except serializers.ValidationError:
        raise
    except (UnidentifiedImageError, OSError, Exception) as exc:
        raise serializers.ValidationError("Invalid or corrupted image file.") from exc
    finally:
        if pos is not None and hasattr(uploaded_file, "seek"):
            uploaded_file.seek(pos)


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = [
            "id",
            "name",
            "name_en",
            "slug",
            "icon",
            "color",
            "image",
            "parent_category",
            "store",
            "is_global",
            "is_active",
        ]
        read_only_fields = ["id", "slug", "store", "is_global"]

    def create(self, validated_data):
        base = slugify(validated_data.get("name_en") or validated_data["name"]) or "category"
        slug = base
        counter = 1
        while Category.objects.filter(slug=slug).exists():
            counter += 1
            slug = f"{base}-{counter}"
        validated_data["slug"] = slug
        return super().create(validated_data)


class ProductImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductImage
        fields = ["id", "image", "is_primary", "sort_order"]


class ProductSerializer(serializers.ModelSerializer):
    effective_price = serializers.DecimalField(
        max_digits=10, decimal_places=2, read_only=True
    )
    category_name = serializers.CharField(source="category.name", read_only=True)
    category_name_en = serializers.CharField(source="category.name_en", read_only=True)
    store_name = serializers.CharField(source="store.name", read_only=True)
    gallery_images = ProductImageSerializer(source="images", many=True, read_only=True)
    image_url = serializers.CharField(required=False, allow_blank=True, max_length=500)

    class Meta:
        model = Product
        fields = [
            "id",
            "store",
            "store_name",
            "category",
            "category_name",
            "category_name_en",
            "name",
            "name_en",
            "description",
            "description_en",
            "image",
            "image_url",
            "gallery_images",
            "barcode",
            "sku",
            "price",
            "discounted_price",
            "effective_price",
            "stock_quantity",
            "unit",
            "unit_en",
            "is_available",
            "is_active",
            "is_best_seller",
            "is_offer",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "store", "created_at", "updated_at"]

    def validate_image(self, value):
        validate_uploaded_product_image(value)
        return value

    def validate_image_url(self, value):
        val = (value or "").strip()
        if not val:
            return ""
        if val.startswith(("/", "http://", "https://")):
            return val
        raise serializers.ValidationError("Enter a valid image URL or path.")

    def to_internal_value(self, data):
        if hasattr(data, "copy"):
            mutable = data.copy()
            if mutable.get("discounted_price") == "":
                mutable["discounted_price"] = None
            data = mutable
        return super().to_internal_value(data)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get("request")
        raw_url = data.get("image_url") or ""
        if raw_url and request:
            parsed = urlparse(raw_url)
            if parsed.scheme == "http" and (
                parsed.path.startswith(settings.MEDIA_URL)
                or parsed.path.startswith(settings.STATIC_URL)
            ):
                data["image_url"] = request.build_absolute_uri(parsed.path)
        return data

    def validate(self, attrs):
        price = attrs.get("price", getattr(self.instance, "price", None))
        discounted = attrs.get(
            "discounted_price", getattr(self.instance, "discounted_price", None)
        )
        if discounted is not None and price is not None and discounted >= price:
            raise serializers.ValidationError(
                {"discounted_price": "Discounted price must be lower than regular price."}
            )
        return attrs

    def update(self, instance, validated_data):
        new_image = validated_data.get("image")
        new_image_url = validated_data.get("image_url")
        if new_image:
            validated_data["image_url"] = ""
        elif new_image_url:
            instance.image = None
        return super().update(instance, validated_data)


class CatalogLibraryCategorySerializer(serializers.ModelSerializer):
    items_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = CatalogLibraryCategory
        fields = [
            "id",
            "name",
            "name_en",
            "slug",
            "icon",
            "color",
            "default_category",
            "sort_order",
            "items_count",
        ]


class CatalogLibraryItemSerializer(serializers.ModelSerializer):
    category_slug = serializers.CharField(source="library_category.slug", read_only=True)
    category_name = serializers.CharField(source="library_category.name", read_only=True)
    category_name_en = serializers.CharField(source="library_category.name_en", read_only=True)
    default_store_category = serializers.UUIDField(
        source="library_category.default_category_id", read_only=True
    )
    thumbnail_url = serializers.SerializerMethodField()

    class Meta:
        model = CatalogLibraryItem
        fields = [
            "id",
            "name",
            "name_en",
            "slug",
            "brand",
            "package_size",
            "barcode",
            "default_unit",
            "default_unit_en",
            "category_slug",
            "category_name",
            "category_name_en",
            "default_store_category",
            "thumbnail_url",
        ]

    def get_thumbnail_url(self, obj: CatalogLibraryItem) -> str:
        request = self.context.get("request")
        if obj.image:
            url = obj.image.url
            return request.build_absolute_uri(url) if request else url
        if obj.static_image_path:
            url = static(obj.static_image_path)
            if not url.startswith("/"):
                url = f"{settings.STATIC_URL}{obj.static_image_path}"
            return request.build_absolute_uri(url) if request else url
        return ""

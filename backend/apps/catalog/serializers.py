from django.utils.text import slugify
from rest_framework import serializers
from .models import Category, Product, ProductImage


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

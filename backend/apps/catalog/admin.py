from django.contrib import admin

from .models import (
    CatalogLibraryCategory,
    CatalogLibraryItem,
    Category,
    Product,
    ProductImage,
)


class ProductImageInline(admin.TabularInline):
    model = ProductImage
    extra = 1
    fields = ["image", "is_primary", "sort_order"]


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ["name", "name_en", "slug", "is_global", "store", "is_active", "created_at"]
    list_filter = ["is_global", "is_active", "store"]
    search_fields = ["name", "name_en", "slug"]
    prepopulated_fields = {"slug": ("name_en",)}
    raw_id_fields = ["parent_category", "store"]


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = [
        "name",
        "store",
        "category",
        "price",
        "discounted_price",
        "stock_quantity",
        "is_available",
        "is_active",
        "is_best_seller",
        "is_offer",
    ]
    list_filter = ["store", "category", "is_available", "is_active", "is_best_seller", "is_offer"]
    search_fields = ["name", "name_en", "sku", "barcode", "store__name"]
    list_editable = ["price", "stock_quantity", "is_available", "is_active"]
    raw_id_fields = ["store", "category"]
    inlines = [ProductImageInline]


@admin.register(ProductImage)
class ProductImageAdmin(admin.ModelAdmin):
    list_display = ["product", "is_primary", "sort_order", "created_at"]
    list_filter = ["is_primary"]
    raw_id_fields = ["product"]


@admin.register(CatalogLibraryCategory)
class CatalogLibraryCategoryAdmin(admin.ModelAdmin):
    list_display = ["name", "name_en", "slug", "default_category", "sort_order", "is_active"]
    list_filter = ["is_active"]
    search_fields = ["name", "name_en", "slug"]
    prepopulated_fields = {"slug": ("name_en",)}


@admin.register(CatalogLibraryItem)
class CatalogLibraryItemAdmin(admin.ModelAdmin):
    list_display = [
        "name",
        "name_en",
        "brand",
        "package_size",
        "library_category",
        "barcode",
        "sort_order",
        "is_active",
    ]
    list_filter = ["library_category", "is_active"]
    search_fields = ["name", "name_en", "brand", "barcode", "slug"]
    prepopulated_fields = {"slug": ("name_en",)}

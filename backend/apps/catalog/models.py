from decimal import Decimal
from django.core.validators import MinValueValidator
from django.db import models
from apps.common.models import UUIDTimeStampedModel
from apps.stores.models import Store


class Category(UUIDTimeStampedModel):
    name = models.CharField(max_length=120)
    name_en = models.CharField(max_length=120, blank=True)
    slug = models.SlugField(max_length=140, unique=True, allow_unicode=True)
    icon = models.CharField(max_length=60, default="ShoppingBasket")
    color = models.CharField(max_length=20, default="#D6450D")
    image = models.ImageField(upload_to="categories/", blank=True, null=True)
    parent_category = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="subcategories",
    )
    store = models.ForeignKey(
        Store,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="custom_categories",
    )
    is_global = models.BooleanField(default=True, db_index=True)
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        verbose_name_plural = "Categories"
        ordering = ["name"]

    def __str__(self):
        return self.name


class Product(UUIDTimeStampedModel):
    store = models.ForeignKey(
        Store,
        on_delete=models.CASCADE,
        related_name="products",
    )
    category = models.ForeignKey(
        Category,
        on_delete=models.PROTECT,
        related_name="products",
    )
    name = models.CharField(max_length=200)
    name_en = models.CharField(max_length=200, blank=True)
    description = models.TextField(blank=True)
    description_en = models.TextField(blank=True)
    image = models.ImageField(upload_to="products/", blank=True, null=True)
    image_url = models.URLField(blank=True)
    barcode = models.CharField(max_length=64, blank=True, db_index=True)
    sku = models.CharField(max_length=64, blank=True, db_index=True)
    price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
    )
    discounted_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal("0.01"))],
    )
    stock_quantity = models.PositiveIntegerField(default=0)
    unit = models.CharField(max_length=40, default="قطعة")
    unit_en = models.CharField(max_length=40, default="Unit", blank=True)
    is_available = models.BooleanField(default=True, db_index=True)
    is_active = models.BooleanField(default=True, db_index=True)
    is_best_seller = models.BooleanField(default=False)
    is_offer = models.BooleanField(default=False)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["store", "is_active", "is_available"]),
            models.Index(fields=["store", "category"]),
        ]

    @property
    def effective_price(self) -> Decimal:
        if self.discounted_price is not None and self.discounted_price < self.price:
            return self.discounted_price
        return self.price

    def __str__(self):
        return f"{self.name} ({self.store.name})"


class ProductImage(UUIDTimeStampedModel):
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name="images",
    )
    image = models.ImageField(upload_to="products/gallery/")
    is_primary = models.BooleanField(default=False)
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "created_at"]


class CatalogLibraryCategory(UUIDTimeStampedModel):
    name = models.CharField(max_length=120)
    name_en = models.CharField(max_length=120)
    slug = models.SlugField(max_length=140, unique=True, allow_unicode=True)
    icon = models.CharField(max_length=60, default="ShoppingBasket")
    color = models.CharField(max_length=20, default="#1B8E53")
    default_category = models.ForeignKey(
        Category,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="library_categories",
    )
    sort_order = models.PositiveSmallIntegerField(default=0, db_index=True)
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        verbose_name_plural = "Catalog Library Categories"
        ordering = ["sort_order", "name_en"]

    def __str__(self) -> str:
        return f"{self.name} ({self.name_en})"


class CatalogLibraryItem(UUIDTimeStampedModel):
    library_category = models.ForeignKey(
        CatalogLibraryCategory,
        on_delete=models.CASCADE,
        related_name="items",
    )
    name = models.CharField(max_length=200)
    name_en = models.CharField(max_length=200)
    slug = models.SlugField(max_length=220, unique=True, allow_unicode=True)
    brand = models.CharField(max_length=120, blank=True)
    package_size = models.CharField(max_length=60, blank=True)
    barcode = models.CharField(max_length=64, blank=True, db_index=True)
    default_unit = models.CharField(max_length=40, default="قطعة")
    default_unit_en = models.CharField(max_length=40, default="Unit")
    image = models.ImageField(upload_to="catalog_library/", blank=True, null=True)
    static_image_path = models.CharField(max_length=255, blank=True)
    image_hash = models.CharField(max_length=64, blank=True, db_index=True)
    sort_order = models.PositiveSmallIntegerField(default=0, db_index=True)
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        ordering = ["sort_order", "name_en"]
        indexes = [
            models.Index(fields=["library_category", "is_active", "sort_order"]),
        ]

    def __str__(self) -> str:
        return f"{self.name} ({self.name_en})"

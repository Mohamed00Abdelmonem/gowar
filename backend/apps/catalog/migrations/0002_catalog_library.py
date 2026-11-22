import uuid
import django.db.models.deletion
from django.db import migrations, models


def seed_initial_catalog_library(apps, schema_editor):
    from apps.catalog.catalog_seed_data import (
        CATALOG_LIBRARY_CATEGORIES,
        CATALOG_LIBRARY_ITEMS,
    )
    from apps.catalog.management.commands.seed_catalog_library import (
        generate_webp_thumbnail,
    )

    CatalogLibraryCategory = apps.get_model("catalog", "CatalogLibraryCategory")
    CatalogLibraryItem = apps.get_model("catalog", "CatalogLibraryItem")
    Category = apps.get_model("catalog", "Category")

    store_cats = {c.slug: c for c in Category.objects.filter(is_global=True)}
    cat_map = {}

    for slug, name_ar, name_en, icon, color, store_cat_slug, sort_order in CATALOG_LIBRARY_CATEGORIES:
        cat, _ = CatalogLibraryCategory.objects.update_or_create(
            slug=slug,
            defaults={
                "name": name_ar,
                "name_en": name_en,
                "icon": icon,
                "color": color,
                "default_category": store_cats.get(store_cat_slug),
                "sort_order": sort_order,
                "is_active": True,
            },
        )
        cat_map[slug] = (cat, color)

    for idx, (cat_slug, slug, name_ar, name_en, brand, pkg_size, unit_ar, unit_en, barcode) in enumerate(
        CATALOG_LIBRARY_ITEMS, start=1
    ):
        cat, color = cat_map[cat_slug]
        static_rel, img_hash = generate_webp_thumbnail(
            slug=slug,
            name_en=name_en,
            brand=brand,
            package_size=pkg_size,
            accent_hex=color,
        )
        CatalogLibraryItem.objects.update_or_create(
            slug=slug,
            defaults={
                "library_category": cat,
                "name": name_ar,
                "name_en": name_en,
                "brand": brand,
                "package_size": pkg_size,
                "barcode": barcode,
                "default_unit": unit_ar,
                "default_unit_en": unit_en,
                "static_image_path": static_rel,
                "image_hash": img_hash,
                "sort_order": idx,
                "is_active": True,
            },
        )


class Migration(migrations.Migration):
    dependencies = [
        ("catalog", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="CatalogLibraryCategory",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("name", models.CharField(max_length=120)),
                ("name_en", models.CharField(max_length=120)),
                (
                    "slug",
                    models.SlugField(allow_unicode=True, max_length=140, unique=True),
                ),
                ("icon", models.CharField(default="ShoppingBasket", max_length=60)),
                ("color", models.CharField(default="#1B8E53", max_length=20)),
                ("sort_order", models.PositiveSmallIntegerField(db_index=True, default=0)),
                ("is_active", models.BooleanField(db_index=True, default=True)),
                (
                    "default_category",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="library_categories",
                        to="catalog.category",
                    ),
                ),
            ],
            options={
                "verbose_name_plural": "Catalog Library Categories",
                "ordering": ["sort_order", "name_en"],
            },
        ),
        migrations.CreateModel(
            name="CatalogLibraryItem",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("name", models.CharField(max_length=200)),
                ("name_en", models.CharField(max_length=200)),
                (
                    "slug",
                    models.SlugField(allow_unicode=True, max_length=220, unique=True),
                ),
                ("brand", models.CharField(blank=True, max_length=120)),
                ("package_size", models.CharField(blank=True, max_length=60)),
                ("barcode", models.CharField(blank=True, db_index=True, max_length=64)),
                ("default_unit", models.CharField(default="قطعة", max_length=40)),
                ("default_unit_en", models.CharField(default="Unit", max_length=40)),
                (
                    "image",
                    models.ImageField(
                        blank=True, null=True, upload_to="catalog_library/"
                    ),
                ),
                ("static_image_path", models.CharField(blank=True, max_length=255)),
                (
                    "image_hash",
                    models.CharField(blank=True, db_index=True, max_length=64),
                ),
                ("sort_order", models.PositiveSmallIntegerField(db_index=True, default=0)),
                ("is_active", models.BooleanField(db_index=True, default=True)),
                (
                    "library_category",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="items",
                        to="catalog.cataloglibrarycategory",
                    ),
                ),
            ],
            options={
                "ordering": ["sort_order", "name_en"],
            },
        ),
        migrations.AddIndex(
            model_name="cataloglibraryitem",
            index=models.Index(
                fields=["library_category", "is_active", "sort_order"],
                name="catalog_cat_library_96bde4_idx",
            ),
        ),
        migrations.RunPython(
            seed_initial_catalog_library,
            reverse_code=migrations.RunPython.noop,
        ),
    ]

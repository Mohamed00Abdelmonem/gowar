import hashlib
from pathlib import Path

from django.core.management.base import BaseCommand
from django.db import transaction
from PIL import Image, ImageDraw, ImageFont

from apps.catalog.catalog_seed_data import (
    CATALOG_LIBRARY_CATEGORIES,
    CATALOG_LIBRARY_ITEMS,
)
from apps.catalog.models import CatalogLibraryCategory, CatalogLibraryItem, Category

STATIC_LIBRARY_DIR = Path(__file__).resolve().parents[2] / "static" / "catalog_library"


def _hex_to_rgb(hex_color: str) -> tuple[int, int, int]:
    cleaned = hex_color.lstrip("#")
    if len(cleaned) != 6:
        return (27, 142, 83)
    return tuple(int(cleaned[i : i + 2], 16) for i in (0, 2, 4))


def generate_webp_thumbnail(
    slug: str,
    name_en: str,
    brand: str,
    package_size: str,
    accent_hex: str,
) -> tuple[str, str]:
    """
    Generates a clean, consistent 400x400 WebP product pack thumbnail in
    `apps/catalog/static/catalog_library/<slug>.webp` if not already present.
    Returns (static_relative_path, sha256_hex).
    """
    STATIC_LIBRARY_DIR.mkdir(parents=True, exist_ok=True)
    file_path = STATIC_LIBRARY_DIR / f"{slug}.webp"

    if not file_path.exists():
        accent = _hex_to_rgb(accent_hex)
        tint = tuple(min(255, int(c + (255 - c) * 0.86)) for c in accent)
        mid = tuple(min(255, int(c + (255 - c) * 0.65)) for c in accent)

        img = Image.new("RGB", (400, 400), tint)
        draw = ImageDraw.Draw(img)

        # Soft decorative backdrop circles
        draw.ellipse([30, 30, 370, 370], fill=(255, 255, 255))
        draw.ellipse([75, 55, 325, 305], fill=tint)

        # Stylized product pack silhouette
        draw.rounded_rectangle([135, 78, 265, 272], radius=22, fill=(255, 255, 255), outline=accent, width=4)
        draw.rounded_rectangle([135, 78, 265, 134], radius=22, fill=accent)
        draw.rectangle([135, 114, 265, 134], fill=accent)
        draw.rounded_rectangle([160, 152, 240, 206], radius=10, fill=mid)

        # Bottom label pill
        draw.rounded_rectangle([40, 298, 360, 368], radius=18, fill=(255, 255, 255), outline=mid, width=2)

        font_title = ImageFont.load_default()
        short_brand = (brand.split("|")[-1] if "|" in brand else brand).strip()[:22]
        short_name = name_en[:28]
        size_label = package_size[:14]

        draw.text((200, 106), short_brand or "GOWAR", fill=(255, 255, 255), anchor="mm", font=font_title)
        if size_label:
            draw.text((200, 179), size_label, fill=(28, 25, 23), anchor="mm", font=font_title)
        draw.text((200, 333), short_name, fill=(28, 25, 23), anchor="mm", font=font_title)

        img.save(file_path, format="WEBP", quality=82, method=6)

    digest = hashlib.sha256(file_path.read_bytes()).hexdigest()
    return f"catalog_library/{slug}.webp", digest


@transaction.atomic
def seed_catalog_library_data() -> tuple[int, int]:
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

    items_count = 0
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
        items_count += 1

    return len(cat_map), items_count


class Command(BaseCommand):
    help = "Seeds the curated Egyptian supermarket product image library with WebP thumbnails."

    def handle(self, *args, **options):
        cats, items = seed_catalog_library_data()
        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded {cats} catalog library categories and {items} WebP product items."
            )
        )

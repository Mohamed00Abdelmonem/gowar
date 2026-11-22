export const ALLOWED_PRODUCT_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

export function validateProductImageFile(
  file: Pick<File, 'type' | 'size'> | null | undefined
): string | null {
  if (!file) return 'Please select an image file.';
  if (!ALLOWED_PRODUCT_IMAGE_TYPES.includes(file.type)) {
    return 'Unsupported format. Allowed formats: JPEG, PNG, WEBP.';
  }
  if (file.size <= 0 || file.size > MAX_PRODUCT_IMAGE_BYTES) {
    return 'Image size must not exceed 5 MB.';
  }
  return null;
}

export interface ImportedProductDraft {
  source: string;
  barcode: string;
  name: string;
  name_ar: string;
  name_en: string;
  brand: string;
  package_size: string;
  category_hint: string;
  default_store_category?: string | null;
  default_unit?: string;
  image_url: string;
  attribution: string;
}

export function buildImportedFormPatch(
  imported: ImportedProductDraft,
  fallbackCategoryId: string
): {
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  unitAr: string;
  barcode: string;
  categoryId: string;
  image: string;
} {
  const sizeSuffix = imported.package_size ? ` ${imported.package_size}` : '';
  const nameAr = (imported.name_ar || imported.name || '').trim();
  const nameEn = (imported.name_en || imported.name || '').trim();
  const descParts = [imported.brand, imported.package_size].filter(Boolean);

  return {
    nameAr: nameAr || `${imported.brand}${sizeSuffix}`.trim(),
    nameEn: nameEn || `${imported.brand}${sizeSuffix}`.trim(),
    descriptionAr: descParts.join(' • '),
    unitAr: imported.default_unit || imported.package_size || '١ قطعة',
    barcode: imported.barcode || '',
    categoryId: imported.default_store_category || fallbackCategoryId,
    image: imported.image_url || '',
  };
}

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildImportedFormPatch,
  MAX_PRODUCT_IMAGE_BYTES,
  validateProductImageFile,
} from './catalogLibraryHelpers.ts';

test('validateProductImageFile accepts JPEG/PNG/WEBP <= 5MB and rejects invalid files', () => {
  assert.equal(validateProductImageFile({ type: 'image/webp', size: 1024 }), null);
  assert.equal(validateProductImageFile({ type: 'image/jpeg', size: 500_000 }), null);
  assert.equal(validateProductImageFile({ type: 'image/png', size: 500_000 }), null);

  assert.match(
    validateProductImageFile({ type: 'image/gif', size: 1024 }) ?? '',
    /Unsupported format/
  );
  assert.match(
    validateProductImageFile({ type: 'image/webp', size: MAX_PRODUCT_IMAGE_BYTES + 1 }) ?? '',
    /5 MB/
  );
});

test('buildImportedFormPatch pre-fills product metadata without touching merchant price', () => {
  const patch = buildImportedFormPatch(
    {
      source: 'open_food_facts',
      barcode: '6221155001011',
      name: 'حليب جهينة ١ لتر',
      name_ar: 'حليب جهينة ١ لتر',
      name_en: 'Juhayna Milk 1L',
      brand: 'Juhayna',
      package_size: '1 L',
      category_hint: 'Dairy',
      default_store_category: 'cat-dairy',
      default_unit: 'عبوة ١ لتر',
      image_url: 'https://cdn.gowar.test/juhayna.webp',
      attribution: 'Gowar',
    },
    'cat-default'
  );

  assert.equal(patch.nameAr, 'حليب جهينة ١ لتر');
  assert.equal(patch.nameEn, 'Juhayna Milk 1L');
  assert.equal(patch.barcode, '6221155001011');
  assert.equal(patch.categoryId, 'cat-dairy');
  assert.equal(patch.unitAr, 'عبوة ١ لتر');
  assert.equal('price' in patch, false);
});

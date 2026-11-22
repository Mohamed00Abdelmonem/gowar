import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mapPublicPromotion,
  resolvePromotionDestination,
  validatePromotionDraft,
} from './promotionsHelpers.ts';
import type { Promotion } from '../types/index.ts';

const basePromo: Promotion = {
  id: 'promo-1',
  titleAr: 'عرض الأسبوع',
  titleEn: 'Weekly Offer',
  descriptionAr: '',
  descriptionEn: '',
  discountLabelAr: 'خصم 20%',
  discountLabelEn: '20% OFF',
  image: 'https://cdn.gowar.test/banner.jpg',
  mobileImage: '',
  promotionType: 'general',
  targetStoreId: null,
  targetProductId: null,
  targetCategoryId: null,
  targetAreaId: null,
  customDestination: '/stores',
  ctaTextAr: 'تسوق الآن',
  ctaTextEn: 'Shop Now',
  overlayColor: '#1C1917',
  displayOrder: 0,
  startAt: '2026-01-01T00:00:00Z',
  endAt: '2026-12-31T00:00:00Z',
};

test('resolvePromotionDestination maps store, product, category, and general targets cleanly', () => {
  assert.deepEqual(
    resolvePromotionDestination({
      ...basePromo,
      promotionType: 'store',
      targetStoreId: 'store-123',
    }),
    { href: '/stores/store-123', isExternal: false }
  );

  assert.deepEqual(
    resolvePromotionDestination({
      ...basePromo,
      promotionType: 'product',
      targetProductId: 'prod-456',
    }),
    { href: '/product/prod-456', isExternal: false }
  );

  assert.deepEqual(
    resolvePromotionDestination({
      ...basePromo,
      promotionType: 'category',
      targetCategoryId: 'cat-789',
    }),
    { href: '/stores?category=cat-789', isExternal: false }
  );

  assert.deepEqual(
    resolvePromotionDestination({
      ...basePromo,
      promotionType: 'general',
      customDestination: 'https://gowar.eg/ramadan',
    }),
    { href: 'https://gowar.eg/ramadan', isExternal: true }
  );
});

test('validatePromotionDraft rejects invalid dates, missing targets, and missing active image', () => {
  assert.ok(
    validatePromotionDraft({
      titleAr: 'Test',
      promotionType: 'general',
      targetStoreId: '',
      targetProductId: '',
      targetCategoryId: '',
      customDestination: '/stores',
      startAt: '2026-05-10T10:00',
      endAt: '2026-05-09T10:00',
      isActive: true,
      hasImage: true,
    })?.includes('End date')
  );

  assert.ok(
    validatePromotionDraft({
      titleAr: 'Store Promo',
      promotionType: 'store',
      targetStoreId: '',
      targetProductId: '',
      targetCategoryId: '',
      customDestination: '',
      startAt: '2026-05-01T10:00',
      endAt: '2026-05-10T10:00',
      isActive: true,
      hasImage: true,
    })?.includes('valid store')
  );

  assert.equal(
    validatePromotionDraft({
      titleAr: 'Valid Promo',
      promotionType: 'store',
      targetStoreId: 'store-1',
      targetProductId: '',
      targetCategoryId: '',
      customDestination: '',
      startAt: '2026-05-01T10:00',
      endAt: '2026-05-10T10:00',
      isActive: true,
      hasImage: true,
    }),
    null
  );
});

test('mapPublicPromotion maps backend snake_case payload to frontend Promotion', () => {
  const mapped = mapPublicPromotion({
    id: 'p-1',
    title: 'عرض خاص',
    title_en: '',
    description: 'وصف',
    description_en: '',
    discount_label: '15%',
    discount_label_en: '',
    image: 'https://cdn.gowar.test/a.jpg',
    mobile_image: '',
    promotion_type: 'category',
    target_store: null,
    target_product: null,
    target_category: 'cat-1',
    target_area: null,
    custom_destination: '',
    cta_text: 'تصفح',
    cta_text_en: 'Browse',
    overlay_color: '#1C1917',
    display_order: 2,
    start_at: '2026-01-01T00:00:00Z',
    end_at: '2026-02-01T00:00:00Z',
  });
  assert.equal(mapped.titleEn, 'عرض خاص');
  assert.equal(mapped.targetCategoryId, 'cat-1');
  assert.equal(mapped.ctaTextEn, 'Browse');
});

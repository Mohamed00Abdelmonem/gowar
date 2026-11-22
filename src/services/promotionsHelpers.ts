import type {
  AdminPromotion,
  Promotion,
  PromotionPricingModel,
  PromotionType,
} from '../types/index.ts';

export interface BackendPublicPromotionPayload {
  id: string;
  title: string;
  title_en: string;
  description: string;
  description_en: string;
  discount_label: string;
  discount_label_en: string;
  image: string;
  mobile_image: string;
  promotion_type: PromotionType;
  target_store: string | null;
  target_store_name?: string;
  target_store_name_en?: string;
  target_product: string | null;
  target_product_name?: string;
  target_product_name_en?: string;
  target_category: string | null;
  target_category_name?: string;
  target_category_name_en?: string;
  target_area: string | null;
  custom_destination: string;
  cta_text: string;
  cta_text_en: string;
  overlay_color: string;
  display_order: number;
  start_at: string;
  end_at: string;
}

export interface BackendAdminPromotionPayload extends BackendPublicPromotionPayload {
  image_url: string;
  image_resolved: string;
  mobile_image_url: string;
  mobile_image_resolved: string;
  target_area_name?: string;
  is_active: boolean;
  is_archived: boolean;
  impressions_count: number;
  clicks_count: number;
  ctr: number;
  is_paid_campaign: boolean;
  sponsor_merchant: string | null;
  campaign_budget: string | null;
  pricing_model: PromotionPricingModel;
  priority_boost: number;
  created_at: string;
  updated_at: string;
}

export function mapPublicPromotion(p: BackendPublicPromotionPayload): Promotion {
  return {
    id: p.id,
    titleAr: p.title,
    titleEn: p.title_en || p.title,
    descriptionAr: p.description || '',
    descriptionEn: p.description_en || p.description || '',
    discountLabelAr: p.discount_label || '',
    discountLabelEn: p.discount_label_en || p.discount_label || '',
    image: p.image || '',
    mobileImage: p.mobile_image || '',
    promotionType: p.promotion_type,
    targetStoreId: p.target_store ?? null,
    targetStoreNameAr: p.target_store_name,
    targetStoreNameEn: p.target_store_name_en,
    targetProductId: p.target_product ?? null,
    targetProductNameAr: p.target_product_name,
    targetProductNameEn: p.target_product_name_en,
    targetCategoryId: p.target_category ?? null,
    targetCategoryNameAr: p.target_category_name,
    targetCategoryNameEn: p.target_category_name_en,
    targetAreaId: p.target_area ?? null,
    customDestination: p.custom_destination || '',
    ctaTextAr: p.cta_text || 'تسوق الآن',
    ctaTextEn: p.cta_text_en || p.cta_text || 'Shop Now',
    overlayColor: p.overlay_color || '#1C1917',
    displayOrder: p.display_order ?? 0,
    startAt: p.start_at,
    endAt: p.end_at,
  };
}

export function mapAdminPromotion(p: BackendAdminPromotionPayload): AdminPromotion {
  return {
    ...mapPublicPromotion(p),
    image: p.image_resolved || p.image || p.image_url || '',
    mobileImage: p.mobile_image_resolved || p.mobile_image || p.mobile_image_url || '',
    imageUrlRaw: p.image_url || '',
    mobileImageUrlRaw: p.mobile_image_url || '',
    targetAreaNameAr: p.target_area_name,
    isActive: Boolean(p.is_active),
    isArchived: Boolean(p.is_archived),
    impressionsCount: Number(p.impressions_count ?? 0),
    clicksCount: Number(p.clicks_count ?? 0),
    ctr: Number(p.ctr ?? 0),
    isPaidCampaign: Boolean(p.is_paid_campaign),
    sponsorMerchantId: p.sponsor_merchant ?? null,
    campaignBudget: p.campaign_budget ?? null,
    pricingModel: p.pricing_model || '',
    priorityBoost: Number(p.priority_boost ?? 0),
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  };
}

export function resolvePromotionDestination(promo: Promotion): {
  href: string;
  isExternal: boolean;
} {
  if (promo.promotionType === 'store' && promo.targetStoreId) {
    return { href: `/stores/${promo.targetStoreId}`, isExternal: false };
  }
  if (promo.promotionType === 'product' && promo.targetProductId) {
    return { href: `/product/${promo.targetProductId}`, isExternal: false };
  }
  if (promo.promotionType === 'category' && promo.targetCategoryId) {
    return {
      href: `/stores?category=${encodeURIComponent(promo.targetCategoryId)}`,
      isExternal: false,
    };
  }
  const dest = (promo.customDestination || '').trim();
  if (dest.startsWith('https://') || dest.startsWith('http://')) {
    return { href: dest, isExternal: true };
  }
  if (dest.startsWith('/')) {
    return { href: dest, isExternal: false };
  }
  return { href: '/stores', isExternal: false };
}

export const MAX_BANNER_FILE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_BANNER_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export function validateBannerImageFile(file: File): string | null {
  if (file.size > MAX_BANNER_FILE_BYTES) {
    return 'Banner image size must not exceed 5 MB.';
  }
  if (file.type && !ALLOWED_BANNER_MIME_TYPES.has(file.type.toLowerCase())) {
    return 'Unsupported image format. Allowed formats: JPEG, PNG, WEBP.';
  }
  return null;
}

export interface PromotionDraftValidationInput {
  titleAr: string;
  promotionType: PromotionType;
  targetStoreId: string;
  targetProductId: string;
  targetCategoryId: string;
  customDestination: string;
  startAt: string;
  endAt: string;
  isActive: boolean;
  hasImage: boolean;
}

export function validatePromotionDraft(input: PromotionDraftValidationInput): string | null {
  if (!input.titleAr.trim()) {
    return 'Promotion title is required.';
  }
  if (!input.startAt || !input.endAt) {
    return 'Start date and end date are required.';
  }
  if (new Date(input.endAt).getTime() <= new Date(input.startAt).getTime()) {
    return 'End date must be after start date.';
  }
  if (input.promotionType === 'store' && !input.targetStoreId) {
    return 'Store promotions must reference a valid store.';
  }
  if (input.promotionType === 'product' && !input.targetProductId) {
    return 'Product promotions must reference a valid product.';
  }
  if (input.promotionType === 'category' && !input.targetCategoryId) {
    return 'Category promotions must reference a valid category.';
  }
  if (input.customDestination.trim()) {
    const dest = input.customDestination.trim();
    if (
      !dest.startsWith('/') &&
      !dest.startsWith('https://') &&
      !dest.startsWith('http://')
    ) {
      return 'Custom destination must start with /, https://, or http://.';
    }
  }
  if (input.isActive && !input.hasImage) {
    return 'An active promotion must have a banner image or image URL.';
  }
  return null;
}

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Archive,
  ArrowDown,
  ArrowUp,
  BarChart3,
  Edit3,
  Eye,
  Megaphone,
  Monitor,
  MousePointerClick,
  Plus,
  Search,
  Smartphone,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Upload,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Modal } from '../../components/common/Modal';
import {
  promotionsApi,
  validateBannerImageFile,
  validatePromotionDraft,
} from '../../services/promotionsService';
import type {
  AdminPromotion,
  PromotionAnalyticsSummary,
  PromotionPricingModel,
  PromotionType,
} from '../../types';

type FilterTab = 'all' | 'live' | 'scheduled' | 'inactive' | 'archived';

function toLocalDatetimeInput(iso?: string): string {
  const date = iso ? new Date(iso) : new Date();
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

export const AdminPromotionsPage: React.FC = () => {
  const { language, t, merchants, products, categories, areas, showToast } = useApp();

  const [promotions, setPromotions] = useState<AdminPromotion[]>([]);
  const [analytics, setAnalytics] = useState<PromotionAnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [referenceNow, setReferenceNow] = useState(() => Date.now());
  const [tab, setTab] = useState<FilterTab>('all');
  const [search, setSearch] = useState('');

  // Modal & Form State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [titleAr, setTitleAr] = useState('');
  const [titleEn, setTitleEn] = useState('');
  const [descriptionAr, setDescriptionAr] = useState('');
  const [descriptionEn, setDescriptionEn] = useState('');
  const [discountLabelAr, setDiscountLabelAr] = useState('');
  const [discountLabelEn, setDiscountLabelEn] = useState('');
  const [ctaTextAr, setCtaTextAr] = useState('تسوق الآن');
  const [ctaTextEn, setCtaTextEn] = useState('Shop Now');
  const [overlayColor, setOverlayColor] = useState('#1C1917');
  const [promotionType, setPromotionType] = useState<PromotionType>('general');
  const [targetStoreId, setTargetStoreId] = useState('');
  const [targetProductId, setTargetProductId] = useState('');
  const [targetCategoryId, setTargetCategoryId] = useState('');
  const [targetAreaId, setTargetAreaId] = useState('');
  const [customDestination, setCustomDestination] = useState('/stores');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [displayOrder, setDisplayOrder] = useState(0);
  const [isActive, setIsActive] = useState(true);

  // Image files & URLs
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [imagePreview, setImagePreview] = useState('');
  const [mobileImageFile, setMobileImageFile] = useState<File | null>(null);
  const [mobileImageUrl, setMobileImageUrl] = useState('');
  const [mobileImagePreview, setMobileImagePreview] = useState('');

  // Future Paid Ads fields
  const [showPaidFields, setShowPaidFields] = useState(false);
  const [isPaidCampaign, setIsPaidCampaign] = useState(false);
  const [campaignBudget, setCampaignBudget] = useState('');
  const [pricingModel, setPricingModel] = useState<PromotionPricingModel>('');
  const [priorityBoost, setPriorityBoost] = useState(0);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [promos, stats] = await Promise.all([
        promotionsApi.fetchAdminPromotions(),
        promotionsApi.fetchAdminAnalytics(),
      ]);
      setPromotions(promos);
      setAnalytics(stats);
      setReferenceNow(Date.now());
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : t('تعذر تحميل العروض', 'Failed to load promotions'),
        'error'
      );
    } finally {
      setLoading(false);
    }
  }, [showToast, t]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const approvedStores = useMemo(
    () => merchants.filter((m) => m.status === 'approved'),
    [merchants]
  );

  const availableProducts = useMemo(
    () => products.filter((p) => p.isAvailable),
    [products]
  );

  const filteredPromotions = useMemo(() => {
    const term = search.trim().toLowerCase();
    return promotions.filter((p) => {
      const startMs = new Date(p.startAt).getTime();
      const endMs = new Date(p.endAt).getTime();
      if (tab === 'archived' && !p.isArchived) return false;
      if (tab !== 'archived' && p.isArchived) return false;
      if (tab === 'live' && (!p.isActive || startMs > referenceNow || endMs < referenceNow))
        return false;
      if (tab === 'scheduled' && (!p.isActive || startMs <= referenceNow)) return false;
      if (tab === 'inactive' && p.isActive && endMs >= referenceNow) return false;

      if (term) {
        const hay = `${p.titleAr} ${p.titleEn} ${p.descriptionAr} ${p.descriptionEn}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [promotions, tab, search, referenceNow]);

  const resetForm = () => {
    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    setEditingId(null);
    setFormError(null);
    setPreviewMode('desktop');
    setTitleAr('');
    setTitleEn('');
    setDescriptionAr('');
    setDescriptionEn('');
    setDiscountLabelAr('');
    setDiscountLabelEn('');
    setCtaTextAr('تسوق الآن');
    setCtaTextEn('Shop Now');
    setOverlayColor('#1C1917');
    setPromotionType('general');
    setTargetStoreId('');
    setTargetProductId('');
    setTargetCategoryId('');
    setTargetAreaId('');
    setCustomDestination('/stores');
    setStartAt(toLocalDatetimeInput(now.toISOString()));
    setEndAt(toLocalDatetimeInput(nextWeek.toISOString()));
    setDisplayOrder(promotions.length);
    setIsActive(true);
    setImageFile(null);
    setImageUrl('');
    setImagePreview('');
    setMobileImageFile(null);
    setMobileImageUrl('');
    setMobileImagePreview('');
    setShowPaidFields(false);
    setIsPaidCampaign(false);
    setCampaignBudget('');
    setPricingModel('');
    setPriorityBoost(0);
  };

  const openCreate = () => {
    resetForm();
    setModalOpen(true);
  };

  const openEdit = (p: AdminPromotion) => {
    setEditingId(p.id);
    setFormError(null);
    setPreviewMode('desktop');
    setTitleAr(p.titleAr);
    setTitleEn(p.titleEn);
    setDescriptionAr(p.descriptionAr);
    setDescriptionEn(p.descriptionEn);
    setDiscountLabelAr(p.discountLabelAr);
    setDiscountLabelEn(p.discountLabelEn);
    setCtaTextAr(p.ctaTextAr);
    setCtaTextEn(p.ctaTextEn);
    setOverlayColor(p.overlayColor || '#1C1917');
    setPromotionType(p.promotionType);
    setTargetStoreId(p.targetStoreId || '');
    setTargetProductId(p.targetProductId || '');
    setTargetCategoryId(p.targetCategoryId || '');
    setTargetAreaId(p.targetAreaId || '');
    setCustomDestination(p.customDestination || '');
    setStartAt(toLocalDatetimeInput(p.startAt));
    setEndAt(toLocalDatetimeInput(p.endAt));
    setDisplayOrder(p.displayOrder);
    setIsActive(p.isActive);
    setImageFile(null);
    setImageUrl(p.imageUrlRaw || '');
    setImagePreview(p.image || '');
    setMobileImageFile(null);
    setMobileImageUrl(p.mobileImageUrlRaw || '');
    setMobileImagePreview(p.mobileImage || '');
    setShowPaidFields(p.isPaidCampaign);
    setIsPaidCampaign(p.isPaidCampaign);
    setCampaignBudget(p.campaignBudget || '');
    setPricingModel(p.pricingModel || '');
    setPriorityBoost(p.priorityBoost || 0);
    setModalOpen(true);
  };

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    kind: 'desktop' | 'mobile'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateBannerImageFile(file);
    if (err) {
      setFormError(err);
      return;
    }
    setFormError(null);
    const objectUrl = URL.createObjectURL(file);
    if (kind === 'desktop') {
      setImageFile(file);
      setImagePreview(objectUrl);
    } else {
      setMobileImageFile(file);
      setMobileImagePreview(objectUrl);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const hasImage = Boolean(imageFile || imageUrl.trim() || imagePreview);
    const validationError = validatePromotionDraft({
      titleAr,
      promotionType,
      targetStoreId,
      targetProductId,
      targetCategoryId,
      customDestination,
      startAt,
      endAt,
      isActive,
      hasImage,
    });
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const fd = new FormData();
      fd.append('title', titleAr.trim());
      fd.append('title_en', (titleEn.trim() || titleAr.trim()));
      fd.append('description', descriptionAr.trim());
      fd.append('description_en', descriptionEn.trim());
      fd.append('discount_label', discountLabelAr.trim());
      fd.append('discount_label_en', discountLabelEn.trim());
      fd.append('cta_text', ctaTextAr.trim() || 'تسوق الآن');
      fd.append('cta_text_en', ctaTextEn.trim() || 'Shop Now');
      fd.append('overlay_color', overlayColor);
      fd.append('promotion_type', promotionType);
      fd.append('start_at', new Date(startAt).toISOString());
      fd.append('end_at', new Date(endAt).toISOString());
      fd.append('display_order', String(displayOrder));
      fd.append('is_active', String(isActive));

      if (promotionType === 'store') fd.append('target_store', targetStoreId);
      else fd.append('target_store', '');

      if (promotionType === 'product') fd.append('target_product', targetProductId);
      else fd.append('target_product', '');

      if (promotionType === 'category') fd.append('target_category', targetCategoryId);
      else fd.append('target_category', '');

      if (promotionType === 'general' && targetAreaId) fd.append('target_area', targetAreaId);
      else fd.append('target_area', '');

      fd.append('custom_destination', promotionType === 'general' ? customDestination.trim() : '');

      if (imageFile) fd.append('image', imageFile);
      if (imageUrl.trim()) fd.append('image_url', imageUrl.trim());
      if (mobileImageFile) fd.append('mobile_image', mobileImageFile);
      if (mobileImageUrl.trim()) fd.append('mobile_image_url', mobileImageUrl.trim());

      fd.append('is_paid_campaign', String(isPaidCampaign));
      if (isPaidCampaign && campaignBudget) fd.append('campaign_budget', campaignBudget);
      if (isPaidCampaign && pricingModel) fd.append('pricing_model', pricingModel);
      fd.append('priority_boost', String(priorityBoost));

      if (editingId) {
        await promotionsApi.updateAdminPromotion(editingId, fd);
        showToast(t('تم تحديث العرض بنجاح', 'Promotion updated successfully'), 'success');
      } else {
        await promotionsApi.createAdminPromotion(fd);
        showToast(t('تم إنشاء العرض بنجاح', 'Promotion created successfully'), 'success');
      }
      setModalOpen(false);
      await loadData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('فشل حفظ العرض', 'Failed to save promotion'));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (promo: AdminPromotion) => {
    try {
      await promotionsApi.toggleAdminPromotionActive(promo.id);
      showToast(
        promo.isActive
          ? t('تم إيقاف العرض', 'Promotion deactivated')
          : t('تم تفعيل العرض', 'Promotion activated'),
        'success'
      );
      await loadData();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : t('تعذر تغيير الحالة', 'Failed to toggle status'),
        'error'
      );
    }
  };

  const handleArchive = async (promo: AdminPromotion) => {
    try {
      await promotionsApi.archiveAdminPromotion(promo.id);
      showToast(t('تم أرشفة العرض بأمان', 'Promotion archived safely'), 'success');
      await loadData();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : t('تعذر الأرشفة', 'Failed to archive'),
        'error'
      );
    }
  };

  const handleMoveOrder = async (index: number, direction: -1 | 1) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= filteredPromotions.length) return;
    const current = filteredPromotions[index];
    const swap = filteredPromotions[targetIdx];
    try {
      await promotionsApi.reorderAdminPromotions([
        { id: current.id, display_order: swap.displayOrder },
        { id: swap.id, display_order: current.displayOrder },
      ]);
      await loadData();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : t('تعذر إعادة الترتيب', 'Reorder failed'),
        'error'
      );
    }
  };

  const previewBannerSrc =
    previewMode === 'mobile'
      ? mobileImagePreview || mobileImageUrl || imagePreview || imageUrl
      : imagePreview || imageUrl;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#1C1917] flex items-center gap-2">
            <Megaphone className="w-6 h-6 text-[#1B8E53]" />
            <span>{t('إدارة البانرات والعروض الترويجية', 'Promotional Banners & Offers')}</span>
          </h1>
          <p className="text-xs text-[#6E6A66]">
            {t(
              'إدارة بانرات الصفحة الرئيسية، استهداف المواقع، وجدولة الحملات الترويجية',
              'Manage homepage hero banners, location targeting, scheduling, and campaign CTR'
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#1B8E53] hover:bg-[#147242] text-white text-xs font-extrabold self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>{t('إضافة بانر جديد', 'Create Promotion')}</span>
        </button>
      </div>

      {/* Analytics KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-2xl border border-[#EAE6E1] p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-[#6E6A66] font-semibold">
            <span>{t('العروض النشطة الآن', 'Live Promotions')}</span>
            <Sparkles className="w-4 h-4 text-[#1B8E53]" />
          </div>
          <div className="text-2xl font-extrabold text-[#1C1917]">
            {analytics?.activeLiveCount ?? 0}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-[#EAE6E1] p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-[#6E6A66] font-semibold">
            <span>{t('إجمالي المشاهدات', 'Total Impressions')}</span>
            <Eye className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-extrabold text-[#1C1917]">
            {(analytics?.totalImpressions ?? 0).toLocaleString()}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-[#EAE6E1] p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-[#6E6A66] font-semibold">
            <span>{t('إجمالي النقرات', 'Total Clicks')}</span>
            <MousePointerClick className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-extrabold text-[#1C1917]">
            {(analytics?.totalClicks ?? 0).toLocaleString()}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-[#EAE6E1] p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-[#6E6A66] font-semibold">
            <span>{t('معدل النقر (CTR)', 'Overall CTR')}</span>
            <BarChart3 className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-extrabold text-[#1C1917]">
            {analytics?.overallCtr ?? 0}%
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white rounded-2xl border border-[#EAE6E1] p-3">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {(
            [
              ['all', t('الكل', 'All')],
              ['live', t('نشط الآن', 'Live')],
              ['scheduled', t('مجدول', 'Scheduled')],
              ['inactive', t('غير نشط', 'Inactive')],
              ['archived', t('الأرشيف', 'Archived')],
            ] as Array<[FilterTab, string]>
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                tab === key
                  ? 'bg-[#1B8E53] text-white'
                  : 'bg-[#FAF9F7] text-[#6E6A66] hover:text-[#1C1917]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-[#6E6A66] absolute start-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('ابحث في العروض...', 'Search promotions...')}
            className="w-full ps-9 pe-3 py-2 rounded-xl border border-[#EAE6E1] bg-[#FAF9F7] text-xs"
          />
        </div>
      </div>

      {/* Promotions List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-2xl bg-white border border-[#EAE6E1] animate-pulse" />
          ))}
        </div>
      ) : filteredPromotions.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#EAE6E1] p-10 text-center space-y-2">
          <Megaphone className="w-8 h-8 text-[#6E6A66] mx-auto" />
          <p className="text-sm font-bold text-[#1C1917]">
            {t('لا توجد عروض مطابقة', 'No promotions found')}
          </p>
          <p className="text-xs text-[#6E6A66]">
            {t('ابدأ بإنشاء بانر ترويجي جديد للصفحة الرئيسية.', 'Create your first homepage promotional banner.')}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPromotions.map((promo, index) => {
            const title = language === 'ar' ? promo.titleAr : promo.titleEn;
            const now = Date.now();
            const isExpired = new Date(promo.endAt).getTime() < now;
            const isScheduled = new Date(promo.startAt).getTime() > now;

            return (
              <div
                key={promo.id}
                className="bg-white rounded-2xl border border-[#EAE6E1] p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-2xs"
              >
                <div className="flex items-start sm:items-center gap-4 min-w-0">
                  <img
                    src={promo.image}
                    alt={title}
                    className="w-28 h-16 rounded-xl object-cover bg-[#FAF9F7] border border-[#EAE6E1] shrink-0"
                  />
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-extrabold text-[#1C1917] truncate">
                        {title}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-[#E6F5EC] text-[#1B8E53] text-[10px] font-bold uppercase">
                        {promo.promotionType}
                      </span>
                      {promo.isPaidCampaign && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                          {t('إعلان مدفوع', 'Sponsored')}
                        </span>
                      )}
                      {isExpired ? (
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold">
                          {t('منتهي', 'Expired')}
                        </span>
                      ) : isScheduled ? (
                        <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold">
                          {t('مجدول', 'Scheduled')}
                        </span>
                      ) : null}
                    </div>

                    <div className="text-[11px] text-[#6E6A66] flex flex-wrap gap-x-4 gap-y-1">
                      <span>
                        {new Date(promo.startAt).toLocaleDateString()} →{' '}
                        {new Date(promo.endAt).toLocaleDateString()}
                      </span>
                      <span>
                        {t('مشاهدات:', 'Views:')} <strong>{promo.impressionsCount}</strong>
                      </span>
                      <span>
                        {t('نقرات:', 'Clicks:')} <strong>{promo.clicksCount}</strong>
                      </span>
                      <span>
                        CTR: <strong>{promo.ctr}%</strong>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 self-end lg:self-auto shrink-0">
                  <button
                    type="button"
                    onClick={() => void handleMoveOrder(index, -1)}
                    disabled={index === 0}
                    title={t('تحريك لأعلى', 'Move up')}
                    className="p-2 rounded-xl border border-[#EAE6E1] text-[#1C1917] disabled:opacity-40"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleMoveOrder(index, 1)}
                    disabled={index === filteredPromotions.length - 1}
                    title={t('تحريك لأسفل', 'Move down')}
                    className="p-2 rounded-xl border border-[#EAE6E1] text-[#1C1917] disabled:opacity-40"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleToggleActive(promo)}
                    title={promo.isActive ? t('إيقاف', 'Deactivate') : t('تفعيل', 'Activate')}
                    className={`p-2 rounded-xl border text-xs font-bold inline-flex items-center gap-1 ${
                      promo.isActive
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-[#EAE6E1] bg-[#FAF9F7] text-[#6E6A66]'
                    }`}
                  >
                    {promo.isActive ? (
                      <ToggleRight className="w-4 h-4" />
                    ) : (
                      <ToggleLeft className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(promo)}
                    title={t('تعديل', 'Edit')}
                    className="p-2 rounded-xl border border-[#EAE6E1] text-[#1C1917] hover:bg-[#FAF9F7]"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  {!promo.isArchived && (
                    <button
                      type="button"
                      onClick={() => void handleArchive(promo)}
                      title={t('أرشفة', 'Archive')}
                      className="p-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50"
                    >
                      <Archive className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Modal with Live Preview */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={
          editingId
            ? t('تعديل البانر الترويجي', 'Edit Promotional Banner')
            : t('إنشاء بانر ترويجي جديد', 'Create Promotional Banner')
        }
        maxWidthClass="max-w-3xl"
      >
        <form onSubmit={handleSave} className="space-y-5 max-h-[78vh] overflow-y-auto pe-1">
          {/* Live Banner Preview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-[#1C1917]">
                {t('معاينة البانر قبل النشر', 'Live Banner Preview')}
              </span>
              <div className="flex items-center gap-1 bg-[#FAF9F7] p-1 rounded-lg border border-[#EAE6E1]">
                <button
                  type="button"
                  onClick={() => setPreviewMode('desktop')}
                  className={`px-2 py-1 rounded text-[11px] font-bold inline-flex items-center gap-1 ${
                    previewMode === 'desktop' ? 'bg-white text-[#1B8E53] shadow-2xs' : 'text-[#6E6A66]'
                  }`}
                >
                  <Monitor className="w-3.5 h-3.5" />
                  <span>{t('كمبيوتر', 'Desktop')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode('mobile')}
                  className={`px-2 py-1 rounded text-[11px] font-bold inline-flex items-center gap-1 ${
                    previewMode === 'mobile' ? 'bg-white text-[#1B8E53] shadow-2xs' : 'text-[#6E6A66]'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>{t('موبايل', 'Mobile')}</span>
                </button>
              </div>
            </div>

            <div
              className={`relative rounded-2xl overflow-hidden bg-[#1C1917] mx-auto ${
                previewMode === 'mobile' ? 'max-w-sm aspect-[16/8]' : 'w-full aspect-[21/7]'
              }`}
            >
              {previewBannerSrc ? (
                <img
                  src={previewBannerSrc}
                  alt="Preview"
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : null}
              <div
                className="absolute inset-0"
                style={{
                  background: `linear-gradient(270deg, ${overlayColor}E8 0%, ${overlayColor}99 55%, ${overlayColor}22 100%)`,
                }}
              />
              <div className="relative z-10 h-full flex flex-col justify-center px-5 py-4 text-white space-y-1.5 max-w-md">
                {(language === 'ar' ? discountLabelAr : discountLabelEn || discountLabelAr) && (
                  <span className="self-start px-2.5 py-0.5 rounded-full bg-[#1B8E53] text-[10px] font-extrabold">
                    {language === 'ar' ? discountLabelAr : discountLabelEn || discountLabelAr}
                  </span>
                )}
                <div className="text-base sm:text-xl font-extrabold line-clamp-1">
                  {(language === 'ar' ? titleAr : titleEn || titleAr) ||
                    t('عنوان البانر الترويجي', 'Promotional Banner Title')}
                </div>
                {(language === 'ar' ? descriptionAr : descriptionEn || descriptionAr) && (
                  <div className="text-xs text-white/85 line-clamp-2">
                    {language === 'ar' ? descriptionAr : descriptionEn || descriptionAr}
                  </div>
                )}
                <span className="self-start mt-1 px-3 py-1 rounded-lg bg-white text-[#1B8E53] text-[11px] font-extrabold">
                  {(language === 'ar' ? ctaTextAr : ctaTextEn || ctaTextAr) || 'تسوق الآن'}
                </span>
              </div>
            </div>
          </div>

          {formError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
              {formError}
            </div>
          )}

          {/* Titles & Descriptions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#1C1917] mb-1">
                {t('العنوان (عربي) *', 'Title (Arabic) *')}
              </label>
              <input
                type="text"
                required
                value={titleAr}
                onChange={(e) => setTitleAr(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#EAE6E1] text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#1C1917] mb-1">
                {t('العنوان (إنجليزي)', 'Title (English)')}
              </label>
              <input
                type="text"
                value={titleEn}
                onChange={(e) => setTitleEn(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#EAE6E1] text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#1C1917] mb-1">
                {t('الوصف (عربي)', 'Description (Arabic)')}
              </label>
              <input
                type="text"
                value={descriptionAr}
                onChange={(e) => setDescriptionAr(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#EAE6E1] text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#1C1917] mb-1">
                {t('الوصف (إنجليزي)', 'Description (English)')}
              </label>
              <input
                type="text"
                value={descriptionEn}
                onChange={(e) => setDescriptionEn(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#EAE6E1] text-sm"
              />
            </div>
          </div>

          {/* Discount Badge, CTA, Overlay */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <input
              type="text"
              value={discountLabelAr}
              onChange={(e) => setDiscountLabelAr(e.target.value)}
              placeholder={t('شارة الخصم (مثلاً خصم 20%)', 'Badge AR')}
              className="px-3 py-2 rounded-xl border border-[#EAE6E1] text-xs"
            />
            <input
              type="text"
              value={discountLabelEn}
              onChange={(e) => setDiscountLabelEn(e.target.value)}
              placeholder={t('شارة الخصم EN', 'Badge EN (20% OFF)')}
              className="px-3 py-2 rounded-xl border border-[#EAE6E1] text-xs"
            />
            <input
              type="text"
              value={ctaTextAr}
              onChange={(e) => setCtaTextAr(e.target.value)}
              placeholder={t('نص الزر عربي', 'CTA AR')}
              className="px-3 py-2 rounded-xl border border-[#EAE6E1] text-xs"
            />
            <input
              type="text"
              value={ctaTextEn}
              onChange={(e) => setCtaTextEn(e.target.value)}
              placeholder={t('نص الزر إنجليزي', 'CTA EN')}
              className="px-3 py-2 rounded-xl border border-[#EAE6E1] text-xs"
            />
            <div className="flex items-center gap-2 px-2 py-1 rounded-xl border border-[#EAE6E1]">
              <span className="text-[11px] font-bold text-[#6E6A66]">{t('التعتيم', 'Overlay')}</span>
              <input
                type="color"
                value={overlayColor}
                onChange={(e) => setOverlayColor(e.target.value)}
                className="w-7 h-7 rounded cursor-pointer"
              />
            </div>
          </div>

          {/* Promotion Type & Target */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1]">
            <div>
              <label className="block text-xs font-bold text-[#1C1917] mb-1">
                {t('نوع العرض', 'Promotion Type')}
              </label>
              <select
                value={promotionType}
                onChange={(e) => setPromotionType(e.target.value as PromotionType)}
                className="w-full px-3 py-2 rounded-xl border border-[#EAE6E1] bg-white text-sm"
              >
                <option value="general">{t('عرض عام على جوار', 'General Gowar Promotion')}</option>
                <option value="store">{t('عرض متجر محدد', 'Store Promotion')}</option>
                <option value="product">{t('عرض منتج محدد', 'Product Promotion')}</option>
                <option value="category">{t('عرض قسم / تصنيف', 'Category Promotion')}</option>
              </select>
            </div>

            {promotionType === 'store' && (
              <div>
                <label className="block text-xs font-bold text-[#1C1917] mb-1">
                  {t('المتجر المستهدف *', 'Target Store *')}
                </label>
                <select
                  value={targetStoreId}
                  onChange={(e) => setTargetStoreId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#EAE6E1] bg-white text-sm"
                >
                  <option value="">{t('اختر متجراً...', 'Select store...')}</option>
                  {approvedStores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {language === 'ar' ? s.nameAr : s.nameEn}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {promotionType === 'product' && (
              <div>
                <label className="block text-xs font-bold text-[#1C1917] mb-1">
                  {t('المنتج المستهدف *', 'Target Product *')}
                </label>
                <select
                  value={targetProductId}
                  onChange={(e) => setTargetProductId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#EAE6E1] bg-white text-sm"
                >
                  <option value="">{t('اختر منتجاً...', 'Select product...')}</option>
                  {availableProducts.map((prod) => (
                    <option key={prod.id} value={prod.id}>
                      {language === 'ar' ? prod.nameAr : prod.nameEn}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {promotionType === 'category' && (
              <div>
                <label className="block text-xs font-bold text-[#1C1917] mb-1">
                  {t('التصنيف المستهدف *', 'Target Category *')}
                </label>
                <select
                  value={targetCategoryId}
                  onChange={(e) => setTargetCategoryId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#EAE6E1] bg-white text-sm"
                >
                  <option value="">{t('اختر تصنيفاً...', 'Select category...')}</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {language === 'ar' ? cat.nameAr : cat.nameEn}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {promotionType === 'general' && (
              <>
                <div>
                  <label className="block text-xs font-bold text-[#1C1917] mb-1">
                    {t('استهداف منطقة (اختياري)', 'Target Area (Optional)')}
                  </label>
                  <select
                    value={targetAreaId}
                    onChange={(e) => setTargetAreaId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#EAE6E1] bg-white text-sm"
                  >
                    <option value="">{t('كل المناطق', 'All Active Areas')}</option>
                    {areas
                      .filter((a) => a.isActive)
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {language === 'ar' ? a.nameAr : a.nameEn}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-[#1C1917] mb-1">
                    {t('رابط الوجهة (مثلاً /stores)', 'Custom Destination (e.g. /stores)')}
                  </label>
                  <input
                    type="text"
                    value={customDestination}
                    onChange={(e) => setCustomDestination(e.target.value)}
                    placeholder="/stores"
                    className="w-full px-3 py-2 rounded-xl border border-[#EAE6E1] bg-white text-sm"
                  />
                </div>
              </>
            )}
          </div>

          {/* Images */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2 p-3 rounded-xl border border-[#EAE6E1]">
              <label className="block text-xs font-bold text-[#1C1917]">
                {t('صورة البانر الرئيسية *', 'Desktop Banner Image *')}
              </label>
              <label className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-[#FAF9F7] border border-dashed border-[#1B8E53] text-xs font-bold text-[#1B8E53] cursor-pointer hover:bg-[#E6F5EC]">
                <Upload className="w-4 h-4" />
                <span>{imageFile ? imageFile.name : t('رفع صورة (JPEG/PNG/WEBP)', 'Upload Image')}</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => handleFileChange(e, 'desktop')}
                  className="hidden"
                />
              </label>
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder={t('أو أدخل رابط الصورة URL', 'Or paste image URL')}
                className="w-full px-3 py-1.5 rounded-lg border border-[#EAE6E1] text-xs"
              />
            </div>

            <div className="space-y-2 p-3 rounded-xl border border-[#EAE6E1]">
              <label className="block text-xs font-bold text-[#1C1917]">
                {t('صورة الموبايل (اختياري)', 'Mobile Image (Optional)')}
              </label>
              <label className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-[#FAF9F7] border border-dashed border-[#EAE6E1] text-xs font-bold text-[#6E6A66] cursor-pointer hover:bg-slate-50">
                <Upload className="w-4 h-4" />
                <span>
                  {mobileImageFile
                    ? mobileImageFile.name
                    : t('رفع صورة مخصصة للموبايل', 'Upload Mobile Image')}
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => handleFileChange(e, 'mobile')}
                  className="hidden"
                />
              </label>
              <input
                type="url"
                value={mobileImageUrl}
                onChange={(e) => setMobileImageUrl(e.target.value)}
                placeholder={t('أو رابط صورة الموبايل URL', 'Or paste mobile image URL')}
                className="w-full px-3 py-1.5 rounded-lg border border-[#EAE6E1] text-xs"
              />
            </div>
          </div>

          {/* Schedule & Order */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#1C1917] mb-1">
                {t('تاريخ البدء *', 'Start Date *')}
              </label>
              <input
                type="datetime-local"
                required
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#EAE6E1] text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#1C1917] mb-1">
                {t('تاريخ الانتهاء *', 'End Date *')}
              </label>
              <input
                type="datetime-local"
                required
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#EAE6E1] text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#1C1917] mb-1">
                {t('ترتيب العرض', 'Display Order')}
              </label>
              <input
                type="number"
                min={0}
                value={displayOrder}
                onChange={(e) => setDisplayOrder(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-[#EAE6E1] text-xs"
              />
            </div>
          </div>

          {/* Future Paid Advertising Readiness */}
          <div className="rounded-xl border border-[#EAE6E1] p-3 space-y-3">
            <button
              type="button"
              onClick={() => setShowPaidFields((v) => !v)}
              className="text-xs font-bold text-[#6E6A66] hover:text-[#1C1917]"
            >
              {showPaidFields
                ? t('▾ إخفاء إعدادات الحملات الممولة (للمستقبل)', '▾ Hide Sponsored Campaign Fields (Future Ads)')
                : t('▸ إعدادات الحملات الممولة (اختياري للمستقبل)', '▸ Sponsored Campaign Fields (Future Ads Readiness)')}
            </button>

            {showPaidFields && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <label className="flex items-center gap-2 text-xs font-bold text-[#1C1917]">
                  <input
                    type="checkbox"
                    checked={isPaidCampaign}
                    onChange={(e) => setIsPaidCampaign(e.target.checked)}
                  />
                  <span>{t('حملة مدفوعة', 'Paid Campaign')}</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={campaignBudget}
                  onChange={(e) => setCampaignBudget(e.target.value)}
                  placeholder={t('الميزانية (EGP)', 'Budget (EGP)')}
                  className="px-3 py-1.5 rounded-lg border border-[#EAE6E1] text-xs"
                />
                <select
                  value={pricingModel}
                  onChange={(e) => setPricingModel(e.target.value as PromotionPricingModel)}
                  className="px-3 py-1.5 rounded-lg border border-[#EAE6E1] text-xs bg-white"
                >
                  <option value="">{t('نموذج التسعير', 'Pricing Model')}</option>
                  <option value="flat">Flat Fee</option>
                  <option value="cpm">CPM</option>
                  <option value="cpc">CPC</option>
                </select>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={priorityBoost}
                  onChange={(e) => setPriorityBoost(Number(e.target.value))}
                  placeholder={t('أولوية الظهور (0-100)', 'Priority Boost')}
                  className="px-3 py-1.5 rounded-lg border border-[#EAE6E1] text-xs"
                />
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-[#EAE6E1]">
            <label className="inline-flex items-center gap-2 text-xs font-bold text-[#1C1917]">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              <span>{t('تفعيل العرض فوراً عند الحفظ', 'Publish as active')}</span>
            </label>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-[#EAE6E1] text-xs font-bold text-[#6E6A66]"
              >
                {t('إلغاء', 'Cancel')}
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 rounded-xl bg-[#1B8E53] hover:bg-[#147242] text-white text-xs font-extrabold disabled:opacity-60"
              >
                {saving
                  ? t('جاري الحفظ...', 'Saving...')
                  : editingId
                    ? t('حفظ التعديلات', 'Save Changes')
                    : t('نشر البانر', 'Create Promotion')}
              </button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
};

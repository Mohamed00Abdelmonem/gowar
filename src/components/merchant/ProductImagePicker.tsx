import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Globe,
  Grid,
  Image as ImageIcon,
  Loader2,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { IS_BACKEND_API_ENABLED } from '../../services/apiClient';
import {
  catalogLibraryApi,
  type CatalogLibraryCategoryPayload,
  type CatalogLibraryItemPayload,
  type ExternalImageSearchResponse,
} from '../../services/gowarApi';
import { validateProductImageFile } from '../../services/catalogLibraryHelpers';
import { PRODUCT_IMAGES } from '../../utils/visuals';
import { SafeImage } from '../common/SafeImage';
import { Modal } from '../common/Modal';

interface ProductImagePickerProps {
  selectedImage: string;
  productNameHint?: string;
  onSelectImageUrl: (url: string, attribution?: string) => void;
  onSelectLibraryItem?: (item: CatalogLibraryItemPayload) => void;
  onLocalFileSelected?: (file: File | null) => void;
}

type ImageSourceTab = 'library' | 'upload' | 'online';

export const ProductImagePicker: React.FC<ProductImagePickerProps> = ({
  selectedImage,
  productNameHint = '',
  onSelectImageUrl,
  onSelectLibraryItem,
  onLocalFileSelected,
}) => {
  const { language, t, showToast } = useApp();
  const [activeTab, setActiveTab] = useState<ImageSourceTab>('library');

  // Library state
  const [categories, setCategories] = useState<CatalogLibraryCategoryPayload[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [libraryQuery, setLibraryQuery] = useState('');
  const [items, setItems] = useState<CatalogLibraryItemPayload[]>([]);
  const [libLoading, setLibLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);

  // Horizontal swipe / mouse-drag scroll ref
  const stripRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{ dragging: boolean; startX: number; scrollLeft: number; moved: boolean }>({
    dragging: false,
    startX: 0,
    scrollLeft: 0,
    moved: false,
  });

  // Upload state
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // External online search state
  const [onlineQuery, setOnlineQuery] = useState(productNameHint);
  const [onlineLoading, setOnlineLoading] = useState(false);
  const [onlineResult, setOnlineResult] = useState<ExternalImageSearchResponse | null>(null);

  useEffect(() => {
    if (!onlineQuery && productNameHint) {
      setOnlineQuery(productNameHint);
    }
  }, [productNameHint, onlineQuery]);

  // Load library categories once
  useEffect(() => {
    if (!IS_BACKEND_API_ENABLED) return;
    catalogLibraryApi
      .fetchCategories()
      .then((res) => setCategories(res))
      .catch(() => setCategories([]));
  }, []);

  const loadLibraryItems = useCallback(
    async (targetPage: number, append = false) => {
      if (!IS_BACKEND_API_ENABLED) return;
      setLibLoading(true);
      try {
        const res = await catalogLibraryApi.fetchItems({
          category: selectedCategory,
          q: libraryQuery.trim() || undefined,
          page: targetPage,
          pageSize: 12,
        });
        setItems((prev) => (append ? [...prev, ...res.results] : res.results));
        setTotalCount(res.count);
        setHasNext(Boolean(res.next));
        setPage(targetPage);
      } catch {
        if (!append) setItems([]);
      } finally {
        setLibLoading(false);
      }
    },
    [selectedCategory, libraryQuery]
  );

  useEffect(() => {
    void loadLibraryItems(1, false);
  }, [loadLibraryItems]);

  const scrollStrip = (dir: 'prev' | 'next') => {
    const el = stripRef.current;
    if (!el) return;
    const offset = dir === 'next' ? 240 : -240;
    el.scrollBy({ left: language === 'ar' ? -offset : offset, behavior: 'smooth' });
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = stripRef.current;
    if (!el) return;
    dragStateRef.current = {
      dragging: true,
      startX: e.pageX - el.offsetLeft,
      scrollLeft: el.scrollLeft,
      moved: false,
    };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = stripRef.current;
    if (!el || !dragStateRef.current.dragging) return;
    e.preventDefault();
    const x = e.pageX - el.offsetLeft;
    const walk = x - dragStateRef.current.startX;
    if (Math.abs(walk) > 4) dragStateRef.current.moved = true;
    el.scrollLeft = dragStateRef.current.scrollLeft - walk;
  };

  const handleMouseUpOrLeave = () => {
    dragStateRef.current.dragging = false;
  };

  const handleSelectLibrary = (item: CatalogLibraryItemPayload) => {
    if (dragStateRef.current.moved) {
      dragStateRef.current.moved = false;
      return;
    }
    onLocalFileSelected?.(null);
    onSelectImageUrl(item.thumbnail_url, 'Gowar Curated Product Library');
    onSelectLibraryItem?.(item);
  };

  const handleFileChosen = async (file: File | undefined) => {
    if (!file) return;
    const err = validateProductImageFile(file);
    if (err) {
      setUploadError(err);
      showToast(err, 'error');
      return;
    }
    setUploadError(null);

    if (!IS_BACKEND_API_ENABLED) {
      onLocalFileSelected?.(file);
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          onSelectImageUrl(reader.result);
        }
      };
      reader.readAsDataURL(file);
      return;
    }

    setUploadProgress(5);
    try {
      const res = await catalogLibraryApi.uploadProductImage(file, (pct) =>
        setUploadProgress(pct)
      );
      onLocalFileSelected?.(null);
      onSelectImageUrl(res.image_url);
      showToast(t('تم رفع الصورة بنجاح', 'Image uploaded successfully'), 'success');
    } catch (uploadErr) {
      const msg =
        uploadErr instanceof Error
          ? uploadErr.message
          : t('فشل رفع الصورة', 'Image upload failed');
      setUploadError(msg);
      showToast(msg, 'error');
    } finally {
      setUploadProgress(null);
    }
  };

  const handleOnlineSearch = async () => {
    const q = (onlineQuery || productNameHint).trim();
    if (!q) {
      showToast(t('اكتب اسم المنتج للبحث عن صور', 'Enter a product name to search'), 'info');
      return;
    }
    if (!IS_BACKEND_API_ENABLED) {
      setOnlineResult({
        configured: false,
        provider: null,
        status: 'unconfigured',
        results: [],
        google_images_fallback_url: `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(q)}`,
      });
      return;
    }
    setOnlineLoading(true);
    try {
      const res = await catalogLibraryApi.searchExternalImages(q, 1);
      setOnlineResult(res);
    } catch {
      setOnlineResult({
        configured: false,
        provider: null,
        status: 'unavailable',
        results: [],
        google_images_fallback_url: `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(q)}`,
      });
    } finally {
      setOnlineLoading(false);
    }
  };

  const fallbackPresets = [
    { id: 'milk', name: t('حليب', 'Milk'), url: PRODUCT_IMAGES.milk },
    { id: 'cheese', name: t('جبنة', 'Cheese'), url: PRODUCT_IMAGES.cheese },
    { id: 'rice', name: t('أرز', 'Rice'), url: PRODUCT_IMAGES.rice },
    { id: 'oil', name: t('زيت', 'Oil'), url: PRODUCT_IMAGES.oil },
    { id: 'soda', name: t('مشروبات', 'Soda'), url: PRODUCT_IMAGES.soda },
    { id: 'chips', name: t('سناكس', 'Snacks'), url: PRODUCT_IMAGES.chips },
    { id: 'detergent', name: t('منظفات', 'Cleaning'), url: PRODUCT_IMAGES.detergent },
    { id: 'bread', name: t('مخبوزات', 'Bakery'), url: PRODUCT_IMAGES.bread },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-bold text-[#6E6A66]">
          {t('صورة المنتج', 'Product Image')}
        </label>
        {selectedImage && (
          <button
            type="button"
            onClick={() => {
              onLocalFileSelected?.(null);
              onSelectImageUrl(PRODUCT_IMAGES.milk);
            }}
            className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 hover:underline"
          >
            <Trash2 className="w-3 h-3" />
            <span>{t('إعادة تعيين', 'Reset')}</span>
          </button>
        )}
      </div>

      {/* Main Selected Image Preview */}
      <div className="aspect-square max-h-56 mx-auto rounded-2xl overflow-hidden bg-[#FAF9F7] border border-[#EAE6E1] relative">
        <SafeImage
          src={selectedImage}
          alt={productNameHint || 'Product'}
          className="w-full h-full object-cover"
        />
        <span className="absolute bottom-2 start-2 px-2 py-0.5 rounded-full bg-black/60 text-white text-[10px] font-bold">
          {t('المعاينة الحالية', 'Selected Preview')}
        </span>
      </div>

      {/* 3 Image Source Tabs */}
      <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1]">
        {(
          [
            ['library', t('مكتبة جوار', 'Gowar Library'), ImageIcon],
            ['upload', t('من جهازك', 'Upload'), Upload],
            ['online', t('بحث أونلاين', 'Online'), Globe],
          ] as const
        ).map(([tabKey, label, Icon]) => (
          <button
            key={tabKey}
            type="button"
            onClick={() => setActiveTab(tabKey)}
            className={`flex items-center justify-center gap-1 py-2 px-1.5 rounded-lg text-[11px] font-extrabold transition-colors ${
              activeTab === tabKey
                ? 'bg-[#1B8E53] text-white shadow-2xs'
                : 'text-[#6E6A66] hover:text-[#1C1917]'
            }`}
          >
            <Icon className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{label}</span>
          </button>
        ))}
      </div>

      {/* Tab A: Gowar Curated Library */}
      {activeTab === 'library' && (
        <div className="space-y-2.5 rounded-2xl border border-[#EAE6E1] p-3 bg-[#FAF9F7]/60">
          <div className="flex items-center gap-1.5">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-[#6E6A66] absolute start-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={libraryQuery}
                onChange={(e) => setLibraryQuery(e.target.value)}
                placeholder={t('ابحث في المكتبة (لبن، أرز، زيت...)', 'Search library (milk, rice...)')}
                className="w-full ps-8 pe-2.5 py-1.5 rounded-lg bg-white border border-[#EAE6E1] text-xs focus:outline-none focus:border-[#1B8E53]"
              />
            </div>
            {IS_BACKEND_API_ENABLED && (
              <button
                type="button"
                onClick={() => setGalleryOpen(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-[#EAE6E1] text-[11px] font-bold text-[#1C1917] hover:border-[#1B8E53] shrink-0"
              >
                <Grid className="w-3.5 h-3.5 text-[#1B8E53]" />
                <span>{t('المعرض', 'Gallery')}</span>
              </button>
            )}
          </div>

          {/* Category Filter Chips */}
          {categories.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className={`px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap border ${
                  selectedCategory === 'all'
                    ? 'bg-[#1B8E53] text-white border-[#1B8E53]'
                    : 'bg-white text-[#6E6A66] border-[#EAE6E1]'
                }`}
              >
                {t('الكل', 'All')}
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.slug)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap border ${
                    selectedCategory === cat.slug
                      ? 'bg-[#1B8E53] text-white border-[#1B8E53]'
                      : 'bg-white text-[#6E6A66] border-[#EAE6E1] hover:border-[#1B8E53]'
                  }`}
                >
                  {language === 'ar' ? cat.name : cat.name_en}
                </button>
              ))}
            </div>
          )}

          {/* Swipeable / Draggable Horizontal Thumbnail Strip */}
          <div className="relative group">
            <button
              type="button"
              onClick={() => scrollStrip('prev')}
              aria-label={t('السابق', 'Previous')}
              className="hidden sm:flex items-center justify-center w-7 h-7 rounded-full bg-white/95 border border-[#EAE6E1] shadow-sm absolute start-1 top-1/2 -translate-y-1/2 z-10 hover:border-[#1B8E53]"
            >
              {language === 'ar' ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <ChevronLeft className="w-4 h-4" />
              )}
            </button>

            <div
              ref={stripRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUpOrLeave}
              onMouseLeave={handleMouseUpOrLeave}
              className="flex gap-2 overflow-x-auto no-scrollbar scroll-smooth py-1 cursor-grab active:cursor-grabbing select-none"
            >
              {IS_BACKEND_API_ENABLED ? (
                libLoading && items.length === 0 ? (
                  <div className="w-full py-6 flex items-center justify-center gap-2 text-xs text-[#6E6A66]">
                    <Loader2 className="w-4 h-4 animate-spin text-[#1B8E53]" />
                    <span>{t('جاري تحميل الصور...', 'Loading images...')}</span>
                  </div>
                ) : items.length === 0 ? (
                  <div className="w-full py-5 text-center text-xs text-[#6E6A66]">
                    {t('لا توجد صور مطابقة في المكتبة', 'No matching library images')}
                  </div>
                ) : (
                  items.map((item) => {
                    const isSelected = selectedImage === item.thumbnail_url;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelectLibrary(item)}
                        className={`shrink-0 w-24 rounded-xl bg-white border-2 p-1 text-start transition-all relative ${
                          isSelected
                            ? 'border-[#1B8E53] ring-2 ring-[#E6F5EC]'
                            : 'border-[#EAE6E1] hover:border-[#1B8E53]/60'
                        }`}
                      >
                        <div className="aspect-square rounded-lg overflow-hidden bg-[#FAF9F7]">
                          <img
                            src={item.thumbnail_url}
                            alt={language === 'ar' ? item.name : item.name_en}
                            loading="lazy"
                            draggable={false}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        {isSelected && (
                          <span className="absolute top-1.5 end-1.5 w-5 h-5 rounded-full bg-[#1B8E53] text-white flex items-center justify-center shadow-xs">
                            <Check className="w-3 h-3" />
                          </span>
                        )}
                        <div className="mt-1 text-[10px] font-bold text-[#1C1917] line-clamp-1">
                          {language === 'ar' ? item.name : item.name_en}
                        </div>
                      </button>
                    );
                  })
                )
              ) : (
                fallbackPresets.map((p) => {
                  const isSelected = selectedImage === p.url;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        onLocalFileSelected?.(null);
                        onSelectImageUrl(p.url);
                      }}
                      className={`shrink-0 w-20 rounded-xl bg-white border-2 p-1 relative ${
                        isSelected ? 'border-[#1B8E53]' : 'border-[#EAE6E1]'
                      }`}
                    >
                      <div className="aspect-square rounded-lg overflow-hidden">
                        <SafeImage src={p.url} alt={p.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="mt-1 text-[10px] font-bold text-[#1C1917] truncate">
                        {p.name}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <button
              type="button"
              onClick={() => scrollStrip('next')}
              aria-label={t('التالي', 'Next')}
              className="hidden sm:flex items-center justify-center w-7 h-7 rounded-full bg-white/95 border border-[#EAE6E1] shadow-sm absolute end-1 top-1/2 -translate-y-1/2 z-10 hover:border-[#1B8E53]"
            >
              {language === 'ar' ? (
                <ChevronLeft className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
          </div>

          {IS_BACKEND_API_ENABLED && totalCount > 0 && (
            <div className="flex items-center justify-between text-[11px] text-[#6E6A66]">
              <span>
                {t(`عرض ${items.length} من ${totalCount}`, `Showing ${items.length} of ${totalCount}`)}
              </span>
              {hasNext && (
                <button
                  type="button"
                  disabled={libLoading}
                  onClick={() => void loadLibraryItems(page + 1, true)}
                  className="font-bold text-[#1B8E53] hover:underline"
                >
                  {t('تحميل المزيد', 'Load more')}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab B: Upload From Device */}
      {activeTab === 'upload' && (
        <div className="rounded-2xl border border-dashed border-[#C2E7D2] bg-[#E6F5EC]/40 p-4 text-center space-y-2.5">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => void handleFileChosen(e.target.files?.[0])}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#1B8E53] hover:bg-[#147242] text-white text-xs font-extrabold"
          >
            <Upload className="w-4 h-4" />
            <span>
              {selectedImage
                ? t('اختيار / استبدال صورة', 'Choose / Replace Image')
                : t('رفع صورة من جهازك', 'Upload from Device')}
            </span>
          </button>
          <p className="text-[11px] text-[#6E6A66]">
            {t('الصيغ المدعومة: JPG, PNG, WEBP (الحد الأقصى 5 ميجابايت)', 'Supported: JPG, PNG, WEBP (Max 5 MB)')}
          </p>

          {uploadProgress !== null && (
            <div className="space-y-1">
              <div className="w-full h-2 rounded-full bg-white overflow-hidden border border-[#EAE6E1]">
                <div
                  className="h-full bg-[#1B8E53] transition-all"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <div className="text-[11px] font-bold text-[#1B8E53]">{uploadProgress}%</div>
            </div>
          )}

          {uploadError && (
            <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-2">
              {uploadError}
            </div>
          )}
        </div>
      )}

      {/* Tab C: Search Online Images */}
      {activeTab === 'online' && (
        <div className="rounded-2xl border border-[#EAE6E1] bg-[#FAF9F7]/60 p-3 space-y-2.5">
          <div className="flex gap-1.5">
            <input
              type="search"
              value={onlineQuery}
              onChange={(e) => setOnlineQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleOnlineSearch();
                }
              }}
              placeholder={t('اكتب اسم المنتج للبحث...', 'Search product image...')}
              className="flex-1 px-3 py-1.5 rounded-lg bg-white border border-[#EAE6E1] text-xs focus:outline-none focus:border-[#1B8E53]"
            />
            <button
              type="button"
              disabled={onlineLoading}
              onClick={() => void handleOnlineSearch()}
              className="px-3 py-1.5 rounded-lg bg-[#1B8E53] text-white text-xs font-bold shrink-0"
            >
              {onlineLoading ? '...' : t('بحث', 'Search')}
            </button>
          </div>

          {onlineResult && !onlineResult.configured && (
            <div className="p-3 rounded-xl bg-white border border-[#EAE6E1] space-y-2 text-xs">
              <p className="text-[#6E6A66] leading-relaxed">
                {t(
                  'مزود البحث التلقائي للصور غير مُفعّل حالياً. يمكنك البحث في صور جوجل، تحميل الصورة المناسبة، ثم رفعها من تبويب "من جهازك".',
                  'No external image API provider is configured. Open Google Images to find & download an image, then upload it in the Upload tab.'
                )}
              </p>
              <div className="flex flex-wrap gap-2">
                <a
                  href={onlineResult.google_images_fallback_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1B8E53] text-white font-bold"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>{t('فتح صور جوجل', 'Open Google Images')}</span>
                </a>
                <button
                  type="button"
                  onClick={() => setActiveTab('upload')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#EAE6E1] font-bold text-[#1C1917]"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{t('رفع الصورة المحملة', 'Upload Downloaded Image')}</span>
                </button>
              </div>
            </div>
          )}

          {onlineResult && onlineResult.configured && (
            <div className="space-y-2">
              {onlineResult.results.length === 0 ? (
                <p className="text-xs text-[#6E6A66] py-2 text-center">
                  {onlineResult.status === 'rate_limited'
                    ? t('تم تجاوز الحد المسموح مؤقتاً، حاول بعد قليل.', 'Rate limit reached, try again shortly.')
                    : t('لم يتم العثور على صور مطابقة.', 'No external images found.')}
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                  {onlineResult.results.map((img) => (
                    <button
                      key={img.id}
                      type="button"
                      onClick={() => onSelectImageUrl(img.thumbnail_url, img.attribution)}
                      className="rounded-lg border border-[#EAE6E1] bg-white p-1 text-start hover:border-[#1B8E53]"
                      title={img.attribution}
                    >
                      <img
                        src={img.thumbnail_url}
                        alt={img.title}
                        loading="lazy"
                        className="w-full aspect-square object-cover rounded"
                      />
                      <div className="text-[9px] text-[#6E6A66] truncate mt-0.5">
                        {img.source_website}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Full Library Gallery Modal */}
      <Modal
        open={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        title={t('معرض صور منتجات جوار', 'Gowar Product Image Gallery')}
        maxWidthClass="max-w-3xl"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 max-h-[60vh] overflow-y-auto p-1">
            {items.map((item) => {
              const isSelected = selectedImage === item.thumbnail_url;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    handleSelectLibrary(item);
                    setGalleryOpen(false);
                  }}
                  className={`rounded-xl border-2 p-2 text-start bg-white transition-all ${
                    isSelected ? 'border-[#1B8E53] bg-[#E6F5EC]/40' : 'border-[#EAE6E1] hover:border-[#1B8E53]'
                  }`}
                >
                  <img
                    src={item.thumbnail_url}
                    alt={language === 'ar' ? item.name : item.name_en}
                    loading="lazy"
                    className="w-full aspect-square object-cover rounded-lg"
                  />
                  <div className="mt-1.5 text-xs font-bold text-[#1C1917] line-clamp-2">
                    {language === 'ar' ? item.name : item.name_en}
                  </div>
                  {item.brand && (
                    <div className="text-[10px] text-[#6E6A66] truncate">{item.brand}</div>
                  )}
                </button>
              );
            })}
          </div>
          {hasNext && (
            <div className="flex justify-center">
              <button
                type="button"
                disabled={libLoading}
                onClick={() => void loadLibraryItems(page + 1, true)}
                className="px-4 py-2 rounded-xl bg-[#1B8E53] text-white text-xs font-bold"
              >
                {libLoading ? t('جاري التحميل...', 'Loading...') : t('عرض المزيد', 'Load More')}
              </button>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

import React, { useState } from 'react';
import { Barcode, CheckCircle2, Database, Loader2, Search, Sparkles } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { IS_BACKEND_API_ENABLED } from '../../services/apiClient';
import { catalogLibraryApi, type ImportedProductPayload } from '../../services/gowarApi';
import { SafeImage } from '../common/SafeImage';

interface ProductImportBarProps {
  onApplyImportedProduct: (product: ImportedProductPayload) => void;
}

export const ProductImportBar: React.FC<ProductImportBarProps> = ({
  onApplyImportedProduct,
}) => {
  const { language, t, showToast } = useApp();
  const [barcode, setBarcode] = useState('');
  const [dbQuery, setDbQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [results, setResults] = useState<ImportedProductPayload[]>([]);

  if (!IS_BACKEND_API_ENABLED) return null;

  const handleBarcodeLookup = async () => {
    const code = barcode.trim();
    if (!code) {
      showToast(t('أدخل رقم الباركود أولاً', 'Please enter a barcode first'), 'info');
      return;
    }
    setLoading(true);
    setStatusMsg(null);
    setResults([]);
    try {
      const res = await catalogLibraryApi.lookupBarcode(code);
      if (res.status === 'found' && res.product) {
        setResults([res.product]);
      } else if (res.status === 'timeout' || res.status === 'unavailable' || res.status === 'rate_limited') {
        setStatusMsg(
          t(
            'تعذر الاتصال بقاعدة البيانات الخارجية حالياً، يمكنك إدخال البيانات يدوياً بالأسفل.',
            'External product database is temporarily unavailable. You can enter details manually below.'
          )
        );
      } else {
        setStatusMsg(
          t(
            'لم يتم العثور على منتج بهذا الباركود. يمكنك إدخال البيانات ورفع الصورة يدوياً.',
            'No product found for this barcode. Continue manually below and upload an image.'
          )
        );
      }
    } catch (err) {
      setStatusMsg(
        err instanceof Error
          ? err.message
          : t('تعذر فحص الباركود', 'Barcode lookup failed')
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDbSearch = async () => {
    const q = dbQuery.trim();
    if (q.length < 2) {
      showToast(t('اكتب حرفين على الأقل للبحث', 'Enter at least 2 characters to search'), 'info');
      return;
    }
    setLoading(true);
    setStatusMsg(null);
    setResults([]);
    try {
      const res = await catalogLibraryApi.searchProductDatabase(q, 1);
      if (res.results && res.results.length > 0) {
        setResults(res.results);
      } else if (res.status === 'timeout' || res.status === 'unavailable' || res.status === 'rate_limited') {
        setStatusMsg(
          t(
            'تعذر الاتصال بقاعدة البيانات الخارجية حالياً، يمكنك إكمال الإضافة يدوياً.',
            'External database is temporarily unavailable. You can add the product manually.'
          )
        );
      } else {
        setStatusMsg(
          t(
            'لا توجد نتائج مطابقة في قاعدة البيانات الخارجية.',
            'No matching packaged products found.'
          )
        );
      }
    } catch {
      setStatusMsg(t('تعذر البحث في قاعدة البيانات', 'Database search failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-[#C2E7D2] bg-gradient-to-br from-[#E6F5EC]/50 to-white p-4 sm:p-5 space-y-3.5 shadow-2xs">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#1B8E53]" />
          <h2 className="text-sm font-extrabold text-[#1C1917]">
            {t('استيراد سريع لبيانات المنتج', 'Quick Product Data Import')}
          </h2>
        </div>
        <span className="text-[11px] font-semibold text-[#6E6A66]">
          {t('بيانات استرشادية — أنت تحدد السعر النهائي', 'Suggestions only — you set your price')}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Barcode Lookup */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Barcode className="w-4 h-4 text-[#6E6A66] absolute start-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              inputMode="numeric"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleBarcodeLookup();
                }
              }}
              placeholder={t('أدخل أو امسح الباركود...', 'Enter or scan barcode...')}
              className="w-full ps-9 pe-3 py-2 rounded-xl bg-white border border-[#EAE6E1] text-xs focus:outline-none focus:border-[#1B8E53]"
              dir="ltr"
            />
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={() => void handleBarcodeLookup()}
            className="px-3.5 py-2 rounded-xl bg-[#1B8E53] hover:bg-[#147242] text-white text-xs font-bold shrink-0"
          >
            {t('فحص الباركود', 'Lookup')}
          </button>
        </div>

        {/* Search Product Database */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Database className="w-4 h-4 text-[#6E6A66] absolute start-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={dbQuery}
              onChange={(e) => setDbQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleDbSearch();
                }
              }}
              placeholder={t('ابحث في قاعدة المنتجات (مثال: Nescafe)...', 'Search product database (e.g. Nescafe)...')}
              className="w-full ps-9 pe-3 py-2 rounded-xl bg-white border border-[#EAE6E1] text-xs focus:outline-none focus:border-[#1B8E53]"
            />
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={() => void handleDbSearch()}
            className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl border border-[#1B8E53] text-[#1B8E53] hover:bg-[#E6F5EC] text-xs font-bold shrink-0"
          >
            <Search className="w-3.5 h-3.5" />
            <span>{t('بحث', 'Search')}</span>
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-xs text-[#6E6A66] py-1">
          <Loader2 className="w-4 h-4 animate-spin text-[#1B8E53]" />
          <span>{t('جاري البحث عن بيانات المنتج...', 'Looking up product details...')}</span>
        </div>
      )}

      {statusMsg && (
        <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          {statusMsg}
        </div>
      )}

      {results.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-60 overflow-y-auto pt-1">
          {results.map((item, idx) => (
            <div
              key={`${item.barcode || item.name}-${idx}`}
              className="flex items-center gap-3 p-2.5 rounded-xl bg-white border border-[#EAE6E1]"
            >
              <SafeImage
                src={item.image_url}
                alt={item.name}
                className="w-12 h-12 rounded-lg object-cover bg-[#FAF9F7] shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-extrabold text-[#1C1917] truncate">
                  {language === 'ar' ? item.name_ar || item.name : item.name_en || item.name}
                </div>
                <div className="text-[11px] text-[#6E6A66] truncate">
                  {[item.brand, item.package_size].filter(Boolean).join(' • ') || item.barcode}
                </div>
                <div className="text-[10px] text-[#6E6A66] truncate">{item.attribution}</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onApplyImportedProduct(item);
                  setResults([]);
                  showToast(
                    t('تم تعبئة البيانات — راجعها وأدخل سعر البيع الخاص بك', 'Details pre-filled — review and enter your selling price'),
                    'success'
                  );
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#1B8E53] text-white text-[11px] font-bold shrink-0"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{t('استيراد', 'Use')}</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

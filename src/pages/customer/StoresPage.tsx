import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  List,
  Map as MapIcon,
  MapPin,
  Search,
  Store as StoreIcon,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { StoreCard } from '../../components/common/StoreCard';
import { ProductCard } from '../../components/common/ProductCard';
import { EmptyState } from '../../components/common/EmptyState';
import { SafeImage } from '../../components/common/SafeImage';
import { LocationPickerModal } from '../../components/location/LocationPickerModal';
import { RadiusControl } from '../../components/location/RadiusControl';
import { NearbyStoresMap } from '../../components/location/NearbyStoresMap';
import {
  filterNearbyStores,
  formatDistanceShort,
  type NearbySortMode,
} from '../../services/locationService';
import { formatEGP } from '../../utils/i18n';

const QUICK_TERMS_AR = ['لبن', 'بيض', 'جبنة', 'أرز', 'عيش', 'زيت', 'شيبسي', 'مناديل'];
const QUICK_TERMS_EN = ['Milk', 'Eggs', 'Cheese', 'Rice', 'Bread', 'Oil', 'Chips', 'Detergent'];

type SimpleFilter =
  | 'nearest'
  | 'open_now'
  | 'lowest_fee'
  | 'supermarket'
  | 'grocery'
  | 'kiosk';

export const StoresPage: React.FC = () => {
  const {
    language,
    t,
    merchants,
    products,
    categories,
    customerLocation,
    setSearchRadiusKm,
  } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialQuery = searchParams.get('q') ?? '';
  const initialCat = searchParams.get('category') ?? 'all';

  const [query, setQuery] = useState(initialQuery);
  const [selectedCategory, setSelectedCategory] = useState(initialCat);
  const [activeFilter, setActiveFilter] = useState<SimpleFilter>('nearest');
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [locationModalOpen, setLocationModalOpen] = useState(false);

  const sortMode: NearbySortMode = activeFilter === 'lowest_fee' ? 'lowest_fee' : 'nearest';

  const storesInRadius = useMemo(
    () =>
      filterNearbyStores(
        merchants,
        customerLocation,
        customerLocation.searchRadiusKm,
        sortMode
      ),
    [merchants, customerLocation, sortMode]
  );

  const filteredStores = useMemo(() => {
    const q = query.trim().toLowerCase();
    return storesInRadius.filter(({ merchant: m }) => {
      if (activeFilter === 'open_now' && !m.isOpen) return false;
      if (activeFilter === 'supermarket' && m.type !== 'supermarket') return false;
      if (activeFilter === 'grocery' && m.type !== 'grocery' && m.type !== 'mini_market') {
        return false;
      }
      if (activeFilter === 'kiosk' && m.type !== 'kiosk') return false;
      if (selectedCategory !== 'all' && !m.categoryIds.includes(selectedCategory)) return false;

      if (!q) return true;
      const storeMatches =
        m.nameAr.toLowerCase().includes(q) ||
        m.nameEn.toLowerCase().includes(q) ||
        m.addressAr.toLowerCase().includes(q);
      const hasMatchingProduct = products.some(
        (p) =>
          p.merchantId === m.id &&
          (p.nameAr.toLowerCase().includes(q) || p.nameEn.toLowerCase().includes(q))
      );
      const catMatches = categories.some(
        (c) =>
          m.categoryIds.includes(c.id) &&
          (c.nameAr.toLowerCase().includes(q) || c.nameEn.toLowerCase().includes(q))
      );
      return storeMatches || hasMatchingProduct || catMatches;
    });
  }, [storesInRadius, query, activeFilter, selectedCategory, products, categories]);

  // Group matching products strictly by store so customers never confuse single-store carts
  const groupedProductsByStore = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q && selectedCategory === 'all') return [];

    return filteredStores
      .map((evaluated) => {
        const { merchant: store } = evaluated;
        const items = products.filter((p) => {
          if (p.merchantId !== store.id) return false;
          if (selectedCategory !== 'all' && p.categoryId !== selectedCategory) return false;
          if (!q) return true;
          const cat = categories.find((c) => c.id === p.categoryId);
          const catMatches =
            cat &&
            (cat.nameAr.toLowerCase().includes(q) || cat.nameEn.toLowerCase().includes(q));
          return (
            p.nameAr.toLowerCase().includes(q) ||
            p.nameEn.toLowerCase().includes(q) ||
            Boolean(catMatches)
          );
        });
        return { evaluated, items };
      })
      .filter((group) => group.items.length > 0);
  }, [query, selectedCategory, filteredStores, products, categories]);

  const clearAll = () => {
    setQuery('');
    setSelectedCategory('all');
    setActiveFilter('nearest');
    setSearchParams({});
  };

  const ArrowIcon = language === 'ar' ? ArrowLeft : ArrowRight;
  const quickTerms = language === 'ar' ? QUICK_TERMS_AR : QUICK_TERMS_EN;

  const filterChips: { id: SimpleFilter; label: string }[] = [
    { id: 'nearest', label: t('الأقرب ليك', 'Nearest') },
    { id: 'open_now', label: t('مفتوح دلوقتي', 'Open Now') },
    { id: 'lowest_fee', label: t('أقل رسوم توصيل', 'Lowest Delivery Fee') },
    { id: 'supermarket', label: t('سوبر ماركت', 'Supermarkets') },
    { id: 'grocery', label: t('بقالة', 'Grocery Stores') },
    { id: 'kiosk', label: t('أكشاك', 'Kiosks') },
  ];

  const expandedTargetKm =
    customerLocation.searchRadiusKm < 5
      ? 5
      : customerLocation.searchRadiusKm < 10
        ? 10
        : 20;

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-5 space-y-5">
      {/* Location Header + Search + Simple Filters Card */}
      <div className="bg-white rounded-2xl border border-[#EAE6E1] p-4 sm:p-5 space-y-4 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <button
              type="button"
              onClick={() => setLocationModalOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#D6450D] hover:underline mb-1 text-start"
            >
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span>{t('الموقع الحالي:', 'Location:')}</span>
              <span className="text-[#1C1917]">
                {language === 'ar'
                  ? customerLocation.formattedAddressAr
                  : customerLocation.formattedAddressEn}
              </span>
              <span className="underline">{t('تغيير', 'Change')}</span>
            </button>
            <h1 className="text-xl sm:text-2xl font-extrabold text-[#1C1917]">
              {t('المحلات القريبة منك', 'Nearby Stores')}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {(query || selectedCategory !== 'all' || activeFilter !== 'nearest') && (
              <button
                type="button"
                onClick={clearAll}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] text-xs font-bold text-[#6E6A66] hover:text-[#1C1917]"
              >
                <X className="w-3.5 h-3.5" />
                <span>{t('مسح البحث', 'Reset')}</span>
              </button>
            )}

            {/* List / Map Switcher */}
            <div className="inline-flex items-center rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] p-1">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  viewMode === 'list'
                    ? 'bg-[#D6450D] text-white'
                    : 'text-[#6E6A66] hover:text-[#1C1917]'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span>{t('القائمة', 'List View')}</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('map')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  viewMode === 'map'
                    ? 'bg-[#D6450D] text-white'
                    : 'text-[#6E6A66] hover:text-[#1C1917]'
                }`}
              >
                <MapIcon className="w-3.5 h-3.5" />
                <span>{t('الخريطة', 'Map View')}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-5 h-5 text-[#6E6A66] absolute start-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('بتدور على إيه؟ منتج أو محل', 'What are you looking for? Product or store')}
            className="w-full ps-11 pe-4 py-3 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] text-sm sm:text-base focus:outline-none focus:border-[#D6450D] focus:bg-white"
          />
        </div>

        {/* Quick Search Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          <span className="text-xs font-bold text-[#6E6A66] shrink-0">
            {t('مقترحات:', 'Try:')}
          </span>
          {quickTerms.map((term) => (
            <button
              key={term}
              type="button"
              onClick={() => setQuery(term)}
              className={`px-3 py-1 rounded-full text-xs font-semibold border whitespace-nowrap transition-colors shrink-0 ${
                query.trim() === term
                  ? 'bg-[#FFF2EB] border-[#D6450D] text-[#D6450D]'
                  : 'bg-[#FAF9F7] border-[#EAE6E1] text-[#1C1917] hover:border-[#D6450D]'
              }`}
            >
              {term}
            </button>
          ))}
        </div>

        {/* Simple Filter Chips */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[#EAE6E1]">
          {filterChips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => setActiveFilter(chip.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors min-h-[38px] ${
                activeFilter === chip.id
                  ? 'bg-[#D6450D] text-white border-[#D6450D]'
                  : 'bg-[#FAF9F7] text-[#1C1917] border-[#EAE6E1] hover:border-[#D6450D]'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* Customer Search Radius Control */}
      <RadiusControl matchingCount={filteredStores.length} />

      {/* Map View */}
      {viewMode === 'map' && <NearbyStoresMap stores={filteredStores} />}

      {/* Grouped Product Search Results (List mode or below map when searching) */}
      {groupedProductsByStore.length > 0 && (
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-extrabold text-[#1C1917]">
              {query.trim()
                ? t(`نتائج "${query.trim()}" حسب المحل`, `Results for "${query.trim()}" by Store`)
                : t('المنتجات حسب المحل', 'Products by Store')}
            </h2>
            <p className="text-xs text-[#6E6A66]">
              {t(
                'كل محل له سعره وتوصيله الخاص — اختر المحل اللي يناسبك وأضف منتجاته للسلة',
                'Each store sets its own price and delivery — add items from one store at a time'
              )}
            </p>
          </div>

          <div className="space-y-5">
            {groupedProductsByStore.map(({ evaluated, items }) => {
              const { merchant: store, distanceKm, isDeliverable, deliveryStatus } = evaluated;
              return (
                <div
                  key={store.id}
                  className="bg-white rounded-2xl border border-[#EAE6E1] p-4 sm:p-5 space-y-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#EAE6E1]">
                    <Link
                      to={`/stores/${store.id}`}
                      className="flex items-center gap-3 min-w-0 group"
                    >
                      <SafeImage
                        src={store.logo}
                        alt={store.nameAr}
                        className="w-11 h-11 rounded-xl border border-[#EAE6E1] object-cover shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm sm:text-base font-extrabold text-[#1C1917] group-hover:text-[#D6450D]">
                            {language === 'ar' ? store.nameAr : store.nameEn}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                              store.isOpen
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {store.isOpen ? t('مفتوح دلوقتي', 'Open') : t('مغلق', 'Closed')}
                          </span>
                          {!isDeliverable && (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
                              {deliveryStatus === 'pickup_only'
                                ? t('استلام فقط', 'Pickup only')
                                : t('خارج نطاق التوصيل', 'Outside delivery area')}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#6E6A66] mt-0.5">
                          {t('التوصيل:', 'Delivery:')}{' '}
                          <strong className="text-[#D6450D]">
                            {isDeliverable
                              ? formatEGP(store.delivery.deliveryFee, language)
                              : t('غير متاح', 'Unavailable')}
                          </strong>{' '}
                          • {store.delivery.deliveryTimeMin} {t('دقيقة', 'min')} •{' '}
                          {formatDistanceShort(distanceKm, language)}
                        </p>
                      </div>
                    </Link>

                    <Link
                      to={`/stores/${store.id}`}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#FFF2EB] text-[#D6450D] hover:bg-[#D6450D] hover:text-white text-xs font-bold transition-colors"
                    >
                      <span>{t('شوف كل المحل', 'Open Store')}</span>
                      <ArrowIcon className="w-3.5 h-3.5" />
                    </Link>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4">
                    {items.map((prod) => (
                      <ProductCard key={prod.id} product={prod} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Stores Directory */}
      <section className="space-y-3.5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-[#1C1917]">
            {t('المحلات المتاحة', 'Available Stores')} ({filteredStores.length})
          </h2>
          <span className="text-[11px] text-[#6E6A66]">
            {t('المسافات محسوبة بشكل تقريبي من موقعك', 'Distances are approximate straight-line')}
          </span>
        </div>

        {filteredStores.length === 0 ? (
          <EmptyState
            icon={StoreIcon}
            title={t(
              `مفيش محلات ضمن نطاق ${customerLocation.searchRadiusKm} كم`,
              `No stores found within ${customerLocation.searchRadiusKm} KM`
            )}
            description={t(
              'زود نطاق البحث لتشوف محلات أكتر حول موقعك، أو امسح التصفية الحالية.',
              'Increase your search radius to discover nearby stores, or reset active filters.'
            )}
            action={
              <div className="flex flex-wrap justify-center gap-2">
                {customerLocation.searchRadiusKm < 20 && (
                  <button
                    type="button"
                    onClick={() => setSearchRadiusKm(expandedTargetKm)}
                    className="px-5 py-2.5 rounded-xl bg-[#D6450D] text-white text-xs font-bold hover:bg-[#B33808]"
                  >
                    {t(
                      `زود نطاق البحث إلى ${expandedTargetKm} كم`,
                      `Expand Radius to ${expandedTargetKm} KM`
                    )}
                  </button>
                )}
                {(query || selectedCategory !== 'all' || activeFilter !== 'nearest') && (
                  <button
                    type="button"
                    onClick={clearAll}
                    className="px-5 py-2.5 rounded-xl border border-[#EAE6E1] bg-white text-[#1C1917] text-xs font-bold"
                  >
                    {t('مسح التصفية', 'Reset Filters')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setLocationModalOpen(true)}
                  className="px-4 py-2.5 rounded-xl border border-[#EAE6E1] bg-white text-[#D6450D] text-xs font-bold"
                >
                  {t('تغيير الموقع', 'Change Location')}
                </button>
              </div>
            }
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredStores.map(({ merchant, distanceKm }) => (
              <StoreCard
                key={merchant.id}
                merchant={merchant}
                distanceKmOverride={distanceKm}
              />
            ))}
          </div>
        )}
      </section>

      <LocationPickerModal
        open={locationModalOpen}
        onClose={() => setLocationModalOpen(false)}
      />
    </div>
  );
};

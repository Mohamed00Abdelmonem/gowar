import React, { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Heart,
  MapPin,
  Search,
  Store as StoreIcon,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { SafeImage } from '../../components/common/SafeImage';
import { ProductCard } from '../../components/common/ProductCard';
import { EmptyState } from '../../components/common/EmptyState';
import { LocationPickerModal } from '../../components/location/LocationPickerModal';
import {
  evaluateStoreAvailability,
  formatDistanceAway,
} from '../../services/locationService';
import { formatEGP, getStoreTypeLabel } from '../../utils/i18n';

export const StoreDetailsPage: React.FC = () => {
  const { storeId } = useParams();
  const {
    language,
    t,
    merchants,
    products,
    categories,
    activeCustomer,
    customerLocation,
    toggleFavoriteMerchant,
  } = useApp();

  const [selectedCat, setSelectedCat] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [locationModalOpen, setLocationModalOpen] = useState(false);

  const store = merchants.find((m) => m.id === storeId);

  const storeProducts = useMemo(
    () => products.filter((p) => p.merchantId === storeId),
    [products, storeId]
  );

  const storeCategories = useMemo(() => {
    const usedCatIds = new Set(storeProducts.map((p) => p.categoryId));
    return categories.filter((c) => usedCatIds.has(c.id));
  }, [categories, storeProducts]);

  const filteredProducts = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return storeProducts.filter((p) => {
      if (selectedCat !== 'all' && p.categoryId !== selectedCat) return false;
      if (!q) return true;
      return (
        p.nameAr.toLowerCase().includes(q) ||
        p.nameEn.toLowerCase().includes(q) ||
        p.descriptionAr.toLowerCase().includes(q)
      );
    });
  }, [storeProducts, selectedCat, searchTerm]);

  const BackArrow = language === 'ar' ? ArrowRight : ArrowLeft;

  if (!store) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <EmptyState
          icon={StoreIcon}
          title={t('المحل ده مش موجود', 'Store not found')}
          description={t('تأكد من الرابط أو ارجع لقائمة المحلات القريبة منك.', 'Check the link or go back to nearby stores.')}
          action={
            <Link
              to="/stores"
              className="px-5 py-2.5 rounded-xl bg-[#1B8E53] text-white text-xs font-bold"
            >
              {t('العودة للمحلات', 'Back to Stores')}
            </Link>
          }
        />
      </div>
    );
  }

  const isFav = activeCustomer.favoriteMerchantIds.includes(store.id);
  const storeName = language === 'ar' ? store.nameAr : store.nameEn;
  const availability = evaluateStoreAvailability(
    store,
    customerLocation,
    customerLocation.searchRadiusKm
  );

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-5">
      {/* Easy Back Navigation */}
      <div className="flex items-center justify-between">
        <Link
          to="/stores"
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#6E6A66] hover:text-[#1B8E53]"
        >
          <BackArrow className="w-4 h-4" />
          <span>{t('العودة للمحلات', 'Back to Stores')}</span>
        </Link>

        <button
          type="button"
          onClick={() => toggleFavoriteMerchant(store.id)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
            isFav
              ? 'bg-rose-50 border-rose-200 text-rose-600'
              : 'bg-white border-[#EAE6E1] text-[#6E6A66] hover:text-rose-500'
          }`}
        >
          <Heart className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
          <span>{isFav ? t('في المفضلة', 'Saved') : t('حفظ المحل', 'Save Store')}</span>
        </button>
      </div>

      {/* Focused Store Header: Name, Status, Delivery Fee, ETA, Minimum Order */}
      <div className="bg-white rounded-2xl border border-[#EAE6E1] overflow-hidden shadow-2xs">
        <div className="relative h-36 sm:h-48 bg-[#FAF9F7]">
          <SafeImage
            src={store.coverImage}
            alt={storeName}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <div className="absolute bottom-4 start-4 end-4 flex items-center gap-3.5">
            <SafeImage
              src={store.logo}
              alt={storeName}
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl border-2 border-white bg-white object-cover shadow-md shrink-0"
            />
            <div className="text-white min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                    store.isOpen ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                  }`}
                >
                  {store.isOpen ? t('مفتوح دلوقتي', 'Open Now') : t('مغلق دلوقتي', 'Closed')}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-white/90 text-[#1C1917]">
                  {getStoreTypeLabel(store.type, language)}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold mt-1 truncate">{storeName}</h1>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#6E6A66]">
            <span className="inline-flex items-center gap-1.5 font-bold text-[#1C1917]">
              <MapPin className="w-3.5 h-3.5 text-[#1B8E53]" />
              <span>{formatDistanceAway(availability.distanceKm, language, true)}</span>
            </span>
            <span>
              {t('نطاق توصيل المحل:', 'Store delivery coverage:')}{' '}
              <strong className="text-[#1C1917]">
                {store.delivery.maxDistanceKm} {t('كم', 'km')}
              </strong>
            </span>
          </div>

          {!availability.isDeliverable && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-amber-950">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="block">
                    {availability.deliveryStatus === 'pickup_only'
                      ? t('استلام من المحل فقط', 'Pickup Only')
                      : t('عنوانك خارج نطاق التوصيل لهذا المحل', 'Outside delivery area')}
                  </strong>
                  <span>
                    {availability.deliveryStatus === 'pickup_only'
                      ? t(
                          'هذا المحل لا يوفر التوصيل حالياً.',
                          'Delivery is currently disabled by this merchant.'
                        )
                      : t(
                          `موقعك الحالي (${customerLocation.formattedAddressAr}) أبعد من أقصى مسافة توصيل للمحل (${store.delivery.maxDistanceKm} كم).`,
                          `Your location is farther than this store's max delivery distance (${store.delivery.maxDistanceKm} km).`
                        )}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLocationModalOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-white border border-amber-300 text-amber-900 font-bold shrink-0 hover:bg-amber-100"
              >
                {t('تغيير موقعك', 'Change Location')}
              </button>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2.5 text-center">
            <div className="p-3 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1]">
              <span className="block text-[11px] text-[#6E6A66]">
                {t('رسوم التوصيل', 'Delivery Fee')}
              </span>
              <span className="text-sm sm:text-base font-extrabold text-[#1B8E53] mt-0.5 block">
                {store.delivery.deliveryEnabled
                  ? formatEGP(store.delivery.deliveryFee, language)
                  : t('استلام من المحل', 'Pickup only')}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1]">
              <span className="block text-[11px] text-[#6E6A66]">
                {t('وقت التوصيل', 'Delivery Time')}
              </span>
              <span className="text-sm sm:text-base font-extrabold text-[#1C1917] mt-0.5 block">
                {store.delivery.deliveryTimeMin} {t('دقيقة', 'min')}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1]">
              <span className="block text-[11px] text-[#6E6A66]">
                {t('أقل طلب', 'Minimum Order')}
              </span>
              <span className="text-sm sm:text-base font-extrabold text-[#1C1917] mt-0.5 block">
                {formatEGP(store.delivery.minOrder, language)}
              </span>
            </div>
          </div>

          {store.delivery.freeDeliveryThreshold && (
            <div className="px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800 text-center">
              {t(
                `توصيل مجاني من المحل لو طلبك فوق ${formatEGP(store.delivery.freeDeliveryThreshold, language)}`,
                `Free delivery on orders above ${formatEGP(store.delivery.freeDeliveryThreshold, language)}`
              )}
            </div>
          )}
        </div>
      </div>

      {/* Horizontal Category Navigation + In-Store Search */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-[#6E6A66] absolute start-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t(`بتدور على إيه جوه ${store.nameAr}؟`, `Search inside ${store.nameEn}...`)}
            className="w-full ps-10 pe-4 py-2.5 rounded-xl bg-white border border-[#EAE6E1] text-sm focus:outline-none focus:border-[#1B8E53]"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          <button
            type="button"
            onClick={() => setSelectedCat('all')}
            className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors min-h-[38px] ${
              selectedCat === 'all'
                ? 'bg-[#1B8E53] text-white'
                : 'bg-white border border-[#EAE6E1] text-[#1C1917] hover:border-[#1B8E53]'
            }`}
          >
            {t('كل المنتجات', 'All Products')} ({storeProducts.length})
          </button>
          {storeCategories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCat(cat.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors min-h-[38px] ${
                selectedCat === cat.id
                  ? 'bg-[#1B8E53] text-white'
                  : 'bg-white border border-[#EAE6E1] text-[#1C1917] hover:border-[#1B8E53]'
              }`}
            >
              {language === 'ar' ? cat.nameAr : cat.nameEn}
            </button>
          ))}
        </div>
      </div>

      {/* Consistent Product Cards Grid */}
      {filteredProducts.length === 0 ? (
        <EmptyState
          icon={Search}
          title={t('مفيش منتجات بالاسم ده في المحل', 'No matching products')}
          description={t(
            'جرب البحث بكلمة تانية أو اختر قسم تاني من أقسام المحل.',
            'Try another search word or choose another category.'
          )}
          action={
            <button
              type="button"
              onClick={() => {
                setSelectedCat('all');
                setSearchTerm('');
              }}
              className="px-5 py-2.5 rounded-xl bg-[#1B8E53] text-white text-xs font-bold"
            >
              {t('عرض كل المنتجات', 'Show All Products')}
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4">
          {filteredProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      <LocationPickerModal
        open={locationModalOpen}
        onClose={() => setLocationModalOpen(false)}
      />
    </div>
  );
};

import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  MapPin,
  Search,
  Store as StoreIcon,
  Tag,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { StoreCard } from '../../components/common/StoreCard';
import { ProductCard } from '../../components/common/ProductCard';
import { CategoryIcon } from '../../components/common/CategoryIcon';
import { EmptyState } from '../../components/common/EmptyState';
import { LocationPickerModal } from '../../components/location/LocationPickerModal';
import { RadiusControl } from '../../components/location/RadiusControl';
import { PromoBannerCarousel } from '../../components/promotions/PromoBannerCarousel';
import { filterNearbyStores } from '../../services/locationService';
import promoBannerImg from '../../assets/promo-banner.jpg';

const SEARCH_SUGGESTIONS_AR = ['لبن', 'بيض', 'جبنة', 'أرز', 'عيش', 'زيت', 'شيبسي', 'مناديل'];
const SEARCH_SUGGESTIONS_EN = ['Milk', 'Eggs', 'Cheese', 'Rice', 'Bread', 'Oil', 'Chips', 'Tissues'];

export const CustomerHomePage: React.FC = () => {
  const {
    language,
    t,
    categories,
    merchants,
    products,
    customerLocation,
    setSearchRadiusKm,
  } = useApp();

  const [homeSearch, setHomeSearch] = useState('');
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);
  const navigate = useNavigate();

  const approvedMerchants = useMemo(
    () => merchants.filter((m) => m.status === 'approved'),
    [merchants]
  );

  // Nearby stores within customer selected search radius, sorted nearest first
  const nearbyEvaluated = useMemo(
    () =>
      filterNearbyStores(
        approvedMerchants,
        customerLocation,
        customerLocation.searchRadiusKm,
        'nearest'
      ),
    [approvedMerchants, customerLocation]
  );

  const popularStores = useMemo(
    () => [...approvedMerchants].sort((a, b) => b.rating - a.rating).slice(0, 3),
    [approvedMerchants]
  );

  const frequentProducts = useMemo(() => {
    const approvedIds = new Set(approvedMerchants.map((m) => m.id));
    return products
      .filter((p) => approvedIds.has(p.merchantId) && p.isBestSeller && p.isAvailable)
      .slice(0, 8);
  }, [products, approvedMerchants]);

  const offerProducts = useMemo(() => {
    const approvedIds = new Set(approvedMerchants.map((m) => m.id));
    return products
      .filter(
        (p) =>
          approvedIds.has(p.merchantId) &&
          p.isAvailable &&
          (p.isOffer || (p.oldPrice && p.oldPrice > p.price))
      )
      .slice(0, 4);
  }, [products, approvedMerchants]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(`/stores?q=${encodeURIComponent(homeSearch.trim())}`);
  };

  const ArrowIcon = language === 'ar' ? ArrowLeft : ArrowRight;
  const suggestions = language === 'ar' ? SEARCH_SUGGESTIONS_AR : SEARCH_SUGGESTIONS_EN;

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-7 sm:space-y-9">
      {/* 1 & 2. Compact Action-First Top Box: Delivery Address + Main Search + Suggestions */}
      <section className="bg-white rounded-2xl border border-[#EAE6E1] p-4 sm:p-6 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => setLocationPickerOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1B8E53] hover:underline text-start"
            >
              <MapPin className="w-4 h-4 shrink-0" />
              <span>{t('التوصيل إلى:', 'Delivering to:')}</span>
              <span className="text-[#1C1917]">
                {language === 'ar'
                  ? customerLocation.formattedAddressAr
                  : customerLocation.formattedAddressEn}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-[#E6F5EC] text-[#1B8E53] text-[11px]">
                {t('تغيير', 'Change')}
              </span>
            </button>
            <h1 className="text-xl sm:text-2xl font-extrabold text-[#1C1917]">
              {t('أهلاً بيك، محتاج إيه من المحلات اللي حواليك؟', 'What do you need from stores around you?')}
            </h1>
          </div>

          <button
            type="button"
            onClick={() => setLocationPickerOpen(true)}
            className="inline-flex items-center gap-1.5 self-start sm:self-auto px-3.5 py-2 rounded-xl bg-[#E6F5EC] hover:bg-[#D5EFE0] text-[#1B8E53] text-xs font-extrabold shrink-0 transition-colors"
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>{t('حدد مكان التوصيل', 'Select Location')}</span>
          </button>
        </div>

        {/* Main Search Bar */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-5 h-5 text-[#6E6A66] absolute start-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={homeSearch}
              onChange={(e) => setHomeSearch(e.target.value)}
              placeholder={t('بتدور على إيه؟ منتج أو محل', 'What are you looking for? Product or store')}
              className="w-full ps-11 pe-4 py-3.5 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] text-sm sm:text-base text-[#1C1917] placeholder-[#6E6A66] focus:outline-none focus:border-[#1B8E53] focus:bg-white transition-colors"
            />
          </div>
          <button
            type="submit"
            className="px-5 sm:px-7 py-3.5 rounded-xl bg-[#1B8E53] hover:bg-[#147242] text-white text-sm font-extrabold transition-colors shrink-0"
          >
            {t('ابحث', 'Search')}
          </button>
        </form>

        {/* Quick Search Suggestions */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
          <span className="text-xs font-bold text-[#6E6A66] shrink-0">
            {t('بحث سريع:', 'Quick search:')}
          </span>
          {suggestions.map((word) => (
            <Link
              key={word}
              to={`/stores?q=${encodeURIComponent(word)}`}
              className="px-3 py-1.5 rounded-full bg-[#FAF9F7] hover:bg-[#E6F5EC] border border-[#EAE6E1] hover:border-[#1B8E53] text-xs font-semibold text-[#1C1917] hover:text-[#1B8E53] whitespace-nowrap transition-colors shrink-0"
            >
              {word}
            </Link>
          ))}
        </div>
      </section>

      {/* 2.5 Promotional Banners & Offers Carousel */}
      <PromoBannerCarousel
        latitude={customerLocation.lat}
        longitude={customerLocation.lng}
        areaId={customerLocation.areaId}
      />

      {/* 3. Main Categories */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-extrabold text-[#1C1917]">
            {t('الأقسام الرئيسية', 'Categories')}
          </h2>
          <Link
            to="/stores"
            className="text-xs font-bold text-[#1B8E53] hover:underline inline-flex items-center gap-1"
          >
            <span>{t('كل المحلات', 'All stores')}</span>
            <ArrowIcon className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-4 lg:grid-cols-8 gap-2 sm:gap-3">
          {categories
            .filter((c) => c.isGlobal)
            .map((cat) => (
              <Link
                key={cat.id}
                to={`/stores?category=${cat.id}`}
                className="bg-white rounded-2xl border border-[#EAE6E1] p-2.5 sm:p-3.5 flex flex-col items-center text-center gap-1.5 sm:gap-2 hover:border-[#1B8E53] transition-colors"
              >
                <div
                  className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${cat.color}15`, color: cat.color }}
                >
                  <CategoryIcon icon={cat.icon} className="w-5 h-5" />
                </div>
                <span className="text-[11px] sm:text-xs font-bold text-[#1C1917] leading-tight line-clamp-2">
                  {language === 'ar' ? cat.nameAr : cat.nameEn}
                </span>
              </Link>
            ))}
        </div>
      </section>

      {/* 4. Nearby Stores (Filtered by Selected Radius!) */}
      <section className="space-y-3.5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg sm:text-xl font-extrabold text-[#1C1917]">
              {t('المحلات القريبة منك', 'Nearby Stores')}
            </h2>
            <p className="text-xs text-[#6E6A66]">
              {t(
                `المحلات ضمن نطاق ${customerLocation.searchRadiusKm} كم من موقعك المحدد`,
                `Stores within ${customerLocation.searchRadiusKm} KM of your selected location`
              )}
            </p>
          </div>
          <Link
            to="/stores"
            className="text-xs font-bold text-[#1B8E53] hover:underline inline-flex items-center gap-1"
          >
            <span>{t('عرض الكل والخريطة', 'See all & Map')}</span>
            <ArrowIcon className="w-3.5 h-3.5" />
          </Link>
        </div>

        <RadiusControl matchingCount={nearbyEvaluated.length} compact />

        {nearbyEvaluated.length === 0 ? (
          <EmptyState
            icon={StoreIcon}
            title={t(
              `مفيش محلات ضمن نطاق ${customerLocation.searchRadiusKm} كم`,
              `No stores found within ${customerLocation.searchRadiusKm} KM`
            )}
            description={t(
              'جرب تزود نطاق البحث عشان تشوف المحلات الأقرب في الأحياء المجاورة أو غير موقعك.',
              'Try expanding your search radius or changing your delivery location.'
            )}
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setSearchRadiusKm(Math.min(20, customerLocation.searchRadiusKm + 5))
                  }
                  className="px-5 py-2.5 rounded-xl bg-[#1B8E53] text-white text-xs font-bold hover:bg-[#147242]"
                >
                  {t('زود نطاق البحث', 'Expand Search Radius')}
                </button>
                <button
                  type="button"
                  onClick={() => setLocationPickerOpen(true)}
                  className="px-4 py-2.5 rounded-xl border border-[#EAE6E1] bg-white text-xs font-bold text-[#1C1917]"
                >
                  {t('حدد مكان التوصيل', 'Change Location')}
                </button>
              </div>
            }
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {nearbyEvaluated.slice(0, 6).map(({ merchant, distanceKm }) => (
              <StoreCard
                key={merchant.id}
                merchant={merchant}
                distanceKmOverride={distanceKm}
              />
            ))}
          </div>
        )}
      </section>

      {/* 5. Popular Stores */}
      <section className="space-y-3.5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg sm:text-xl font-extrabold text-[#1C1917]">
            {t('محلات مشهورة في منطقتك', 'Popular Neighborhood Stores')}
          </h2>
          <Link
            to="/stores"
            className="text-xs font-bold text-[#1B8E53] hover:underline inline-flex items-center gap-1"
          >
            <span>{t('كل المحلات', 'All stores')}</span>
            <ArrowIcon className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {popularStores.map((store) => (
            <StoreCard key={store.id} merchant={store} />
          ))}
        </div>
      </section>

      {/* 6. Frequently Purchased Products */}
      <section className="space-y-3.5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg sm:text-xl font-extrabold text-[#1C1917]">
              {t('طلبات البيت اليومية', 'Frequently Purchased Items')}
            </h2>
            <p className="text-xs text-[#6E6A66]">
              {t('أضف بضغطة واحدة — كل منتج معروض بسعر المحل الخاص بيه', 'Tap + to add — each item shows its store price')}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4">
          {frequentProducts.map((product) => (
            <ProductCard key={product.id} product={product} showStoreBadge />
          ))}
        </div>
      </section>

      {/* 7. Offers & Compact Weekly Deal Banner */}
      {offerProducts.length > 0 && (
        <section className="space-y-4">
          <div className="relative rounded-2xl overflow-hidden bg-[#0F3822] text-white p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <img
              src={promoBannerImg}
              alt={t('عروض المحلات', 'Store Offers')}
              className="absolute inset-0 w-full h-full object-cover object-left pointer-events-none"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#1C1917]/90 via-[#13442A]/70 to-[#1C1917]/45 pointer-events-none" />
            <div className="relative z-10 space-y-1">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-orange-200">
                <Tag className="w-3.5 h-3.5" />
                {t('عروض وتخفيضات المحلات', 'Weekly Store Offers')}
              </span>
              <h2 className="text-lg sm:text-xl font-extrabold">
                {t('عروض موفرة على احتياجات البيت', 'Save on daily neighborhood groceries')}
              </h2>
            </div>
            <Link
              to="/stores"
              className="relative z-10 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-[#1B8E53] text-xs font-extrabold self-start sm:self-auto shrink-0"
            >
              <span>{t('شوف كل المحلات', 'Browse Stores')}</span>
              <ArrowIcon className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
            {offerProducts.map((product) => (
              <ProductCard key={product.id} product={product} showStoreBadge />
            ))}
          </div>
        </section>
      )}

      <LocationPickerModal
        open={locationPickerOpen}
        onClose={() => setLocationPickerOpen(false)}
      />
    </div>
  );
};

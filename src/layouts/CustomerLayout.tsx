import React, { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  ChevronDown,
  ClipboardList,
  Heart,
  Home,
  LogIn,
  MapPin,
  Search,
  ShoppingCart,
  Store,
  Truck,
  User,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { BrandLogo } from '../components/common/BrandLogo';
import { Modal } from '../components/common/Modal';
import { NotificationBell } from '../components/common/NotificationBell';
import { LocationOnboardingModal } from '../components/location/LocationOnboardingModal';
import { LocationPickerModal } from '../components/location/LocationPickerModal';
import {
  IS_BACKEND_API_ENABLED,
  getAccessToken,
  getStoredApiUser,
} from '../services/apiClient';
import { formatEGP } from '../utils/i18n';

export const CustomerLayout: React.FC = () => {
  const {
    language,
    t,
    authSession,
    areas,
    setSelectedAreaId,
    activeCustomer,
    customerLocation,
    cart,
    merchants,
    products,
    pendingFavoriteStoreId,
    dismissFavoritePrompt,
  } = useApp();

  const isCustomerSignedIn =
    !IS_BACKEND_API_ENABLED ||
    Boolean(getAccessToken() && getStoredApiUser()?.role === 'customer');
  const favoritesCount = isCustomerSignedIn ? activeCustomer.favoriteMerchantIds.length : 0;

  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const isFavoritesActive = location.pathname.startsWith('/favorites');

  const cartCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);
  const cartMerchant = merchants.find((m) => m.id === cart.merchantId);
  const cartSubtotal = cart.items.reduce((sum, item) => {
    const prod = products.find((p) => p.id === item.productId);
    return sum + (prod ? prod.price * item.quantity : 0);
  }, 0);

  const addressLabel =
    language === 'ar'
      ? customerLocation.formattedAddressAr
      : customerLocation.formattedAddressEn;

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(`/stores?q=${encodeURIComponent(searchQuery.trim())}`);
  };

  const hideStickyCart =
    cartCount === 0 ||
    location.pathname === '/cart' ||
    location.pathname === '/checkout';

  return (
    <div
      className={`min-h-screen flex flex-col bg-[#FAF9F7] md:pb-0 ${
        !hideStickyCart ? 'pb-36' : 'pb-20'
      }`}
    >
      {/* Minimal, Calm Customer Header: Logo, Delivery Address, Search, Cart, Profile */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#EAE6E1]">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 sm:py-3">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <Link to="/" className="shrink-0" aria-label="Gowar Home">
                <BrandLogo />
              </Link>

              {/* Desktop Address Selector */}
              <button
                type="button"
                onClick={() => setLocationModalOpen(true)}
                className="hidden md:flex items-center gap-2 px-3 py-2 rounded-xl bg-[#FAF9F7] hover:bg-[#E6F5EC] border border-[#EAE6E1] text-start transition-colors max-w-[260px] min-w-0"
              >
                <MapPin className="w-4 h-4 text-[#1B8E53] shrink-0" />
                <div className="min-w-0 flex-1">
                  <span className="block text-[11px] text-[#6E6A66] leading-none">
                    {t('التوصيل إلى', 'Delivering to')}
                  </span>
                  <span className="block text-xs font-bold text-[#1C1917] truncate mt-1">
                    {addressLabel}
                  </span>
                </div>
                <ChevronDown className="w-4 h-4 text-[#6E6A66] shrink-0" />
              </button>
            </div>

            {/* Desktop Search */}
            <form
              onSubmit={handleSearchSubmit}
              className="hidden lg:flex flex-1 max-w-md items-center relative"
            >
              <Search className="w-4 h-4 text-[#6E6A66] absolute start-3.5 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('بتدور على إيه؟ منتج أو محل', 'What are you looking for? Product or store')}
                className="w-full ps-10 pe-4 py-2.5 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] text-sm text-[#1C1917] placeholder-[#6E6A66] focus:outline-none focus:border-[#1B8E53] focus:bg-white transition-colors"
              />
            </form>

            {/* Right Actions: Notifications, Favorites, Profile & Cart */}
            <div className="flex items-center gap-2 shrink-0">
              <NotificationBell audience="customer" />

              <Link
                to="/favorites"
                className={`relative inline-flex items-center justify-center gap-1 px-2.5 py-2 rounded-xl border text-xs font-bold transition-colors min-h-[40px] ${
                  isFavoritesActive
                    ? 'bg-[#E6F5EC] border-[#1B8E53] text-[#1B8E53]'
                    : 'border-[#EAE6E1] text-[#1C1917] hover:bg-[#FAF9F7]'
                }`}
                aria-label={t('المحلات المفضلة', 'Favorite Stores')}
                title={t('المحلات المفضلة', 'Favorite Stores')}
              >
                <Heart
                  className={`w-4 h-4 ${
                    isFavoritesActive || favoritesCount > 0
                      ? 'text-rose-500 fill-rose-500'
                      : 'text-[#6E6A66]'
                  }`}
                />
                {favoritesCount > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-extrabold">
                    {favoritesCount}
                  </span>
                )}
              </Link>

              <Link
                to="/profile"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#EAE6E1] text-xs font-bold text-[#1C1917] hover:bg-[#FAF9F7] transition-colors min-h-[40px]"
                aria-label={t('حسابي', 'Profile')}
              >
                <User className="w-4 h-4 text-[#1B8E53]" />
                <span className="hidden sm:inline max-w-[90px] truncate">
                  {language === 'ar'
                    ? activeCustomer.nameAr.split(' ')[0]
                    : activeCustomer.nameEn.split(' ')[0]}
                </span>
              </Link>

              <Link
                to="/cart"
                className="relative inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#1B8E53] hover:bg-[#147242] text-white text-xs font-bold transition-colors min-h-[40px]"
                aria-label={t('سلة الطلبات', 'Shopping Cart')}
              >
                <ShoppingCart className="w-4 h-4" />
                <span className="hidden sm:inline">{t('السلة', 'Cart')}</span>
                <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-white text-[#1B8E53] text-[11px] font-extrabold">
                  {cartCount}
                </span>
              </Link>
            </div>
          </div>

          {/* Mobile Delivery Location Bar */}
          <div className="mt-2.5 md:hidden">
            <button
              type="button"
              onClick={() => setLocationModalOpen(true)}
              className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-[#FAF9F7] hover:bg-[#E6F5EC] border border-[#EAE6E1] text-start transition-colors min-w-0"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <MapPin className="w-4 h-4 text-[#1B8E53] shrink-0" />
                <div className="min-w-0 flex-1 flex items-center gap-1.5">
                  <span className="text-xs text-[#6E6A66] shrink-0">
                    {t('التوصيل إلى:', 'Deliver to:')}
                  </span>
                  <span className="text-xs font-extrabold text-[#1C1917] truncate">
                    {addressLabel}
                  </span>
                </div>
              </div>
              <span className="text-[11px] font-bold text-[#1B8E53] shrink-0">
                {t('تغيير', 'Change')}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Page Body */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Clean Minimal Footer */}
      <footer className="bg-white border-t border-[#EAE6E1] mt-10">
        <div
          className={`max-w-7xl mx-auto px-4 sm:px-6 py-8 grid grid-cols-1 gap-6 ${
            authSession?.role === 'merchant' || authSession?.role === 'delivery'
              ? 'md:grid-cols-3'
              : 'md:grid-cols-2'
          }`}
        >
          <div className="space-y-2.5">
            <BrandLogo />
            <p className="text-xs sm:text-sm text-[#6E6A66] max-w-sm leading-relaxed">
              {t(
                'كل احتياجات بيتك اليومية من السوبر ماركت والبقالة والأكشاك اللي حواليك، بتوصيل مباشر من المحل لباب بيتك.',
                'Everything you need from neighborhood supermarkets, grocery stores, and kiosks around you.'
              )}
            </p>
          </div>
          <div>
            <h4 className="text-sm font-bold text-[#1C1917] mb-2.5">
              {t('الأحياء المتاحة', 'Active Neighborhoods')}
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {areas
                .filter((a) => a.isActive)
                .map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => {
                      setSelectedAreaId(a.id);
                      navigate('/stores');
                    }}
                    className="text-xs px-2.5 py-1 rounded-lg bg-[#FAF9F7] border border-[#EAE6E1] text-[#1C1917] hover:border-[#1B8E53]"
                  >
                    {language === 'ar' ? a.nameAr : a.nameEn}
                  </button>
                ))}
            </div>
          </div>
          {(authSession?.role === 'merchant' || authSession?.role === 'delivery') && (
            <div>
              <h4 className="text-sm font-bold text-[#1C1917] mb-2.5">
                {t('لوحة التحكم', 'Dashboard')}
              </h4>
              <div className="flex flex-col sm:flex-row md:flex-col gap-2">
                {authSession.role === 'merchant' && (
                  <Link
                    to="/merchant"
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] hover:border-[#1B8E53] hover:bg-[#E6F5EC]/60 text-xs font-bold text-[#1C1917] transition-colors"
                  >
                    <Store className="w-4 h-4 text-[#1B8E53] shrink-0" />
                    <span>{t('لوحة تحكم التاجر', 'Merchant Dashboard')}</span>
                  </Link>
                )}
                {authSession.role === 'delivery' && (
                  <Link
                    to="/delivery"
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] hover:border-[#1B8E53] hover:bg-[#E6F5EC]/60 text-xs font-bold text-[#1C1917] transition-colors"
                  >
                    <Truck className="w-4 h-4 text-[#1B8E53] shrink-0" />
                    <span>{t('لوحة تحكم المندوب', 'Delivery Dashboard')}</span>
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="border-t border-[#EAE6E1] py-3.5 text-center text-xs text-[#6E6A66]">
          {t('© ٢٠٢٦ جوار (Gowar)', '© 2026 Gowar Marketplace')}
        </div>
      </footer>

      {/* Sticky Bottom Cart Summary Bar when items exist */}
      {!hideStickyCart && (
        <div className="fixed bottom-[72px] md:bottom-5 inset-x-3 md:inset-x-auto md:end-6 z-40">
          <Link
            to="/cart"
            className="max-w-md mx-auto md:w-96 flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-[#1B8E53] hover:bg-[#147242] text-white shadow-xl transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-8 h-8 rounded-xl bg-white text-[#1B8E53] flex items-center justify-center font-extrabold text-sm shrink-0">
                {cartCount}
              </span>
              <div className="min-w-0">
                <span className="block text-[11px] text-orange-100 truncate">
                  {cartMerchant
                    ? language === 'ar'
                      ? cartMerchant.nameAr
                      : cartMerchant.nameEn
                    : t('سلتك الحالية', 'Your Cart')}
                </span>
                <span className="text-sm font-extrabold">
                  {formatEGP(cartSubtotal, language)}
                </span>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white text-[#1B8E53] text-xs font-extrabold shrink-0">
              <ShoppingCart className="w-4 h-4" />
              <span>{t('افتح السلة', 'Open Cart')}</span>
            </span>
          </Link>
        </div>
      )}

      {/* Mobile Bottom Navigation: ONLY الرئيسية، المحلات، طلباتي، حسابي */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-[#EAE6E1] px-2 pt-1.5 pb-2 flex items-center justify-around shadow-[0_-4px_16px_rgba(0,0,0,0.05)]"
        aria-label={t('التنقل الرئيسي', 'Main navigation')}
      >
        {[
          { to: '/', icon: Home, label: t('الرئيسية', 'Home') },
          { to: '/stores', icon: Store, label: t('المحلات', 'Stores') },
          { to: '/orders', icon: ClipboardList, label: t('طلباتي', 'Orders') },
          { to: '/profile', icon: User, label: t('حسابي', 'Account') },
        ].map((item) => {
          const Icon = item.icon;
          const active =
            item.to === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex flex-col items-center justify-center gap-0.5 min-w-[68px] min-h-[48px] px-3 py-1 rounded-xl text-xs font-bold transition-colors ${
                active ? 'text-[#1B8E53] bg-[#E6F5EC]' : 'text-[#6E6A66]'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* First-time Customer Location Introduction Modal */}
      <LocationOnboardingModal
        onOpenManualPicker={() => setLocationModalOpen(true)}
      />

      {/* Interactive Map Location Picker Modal */}
      <LocationPickerModal
        open={locationModalOpen}
        onClose={() => setLocationModalOpen(false)}
      />

      {/* Login Prompt for Unauthenticated Favorite Action */}
      <Modal
        open={Boolean(pendingFavoriteStoreId)}
        onClose={dismissFavoritePrompt}
        title={t('حفظ المحل في المفضلة', 'Save Store to Favorites')}
        maxWidthClass="max-w-sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-[#1C1917] leading-relaxed">
            {t(
              'يجب تسجيل الدخول أولاً لحفظ المحلات في المفضلة والوصول إليها في أي وقت.',
              'Please sign in first to save stores to your favorites and access them anytime.'
            )}
          </p>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                const storeId = pendingFavoriteStoreId;
                dismissFavoritePrompt();
                navigate('/login', {
                  state: {
                    from: `${location.pathname}${location.search}`,
                    pendingFavoriteStoreId: storeId,
                  },
                });
              }}
              className="flex-1 py-2.5 px-4 rounded-xl bg-[#1B8E53] hover:bg-[#147242] text-white text-xs sm:text-sm font-extrabold inline-flex items-center justify-center gap-1.5"
            >
              <LogIn className="w-4 h-4" />
              <span>{t('سجل الدخول الآن', 'Sign In Now')}</span>
            </button>
            <button
              type="button"
              onClick={dismissFavoritePrompt}
              className="px-4 py-2.5 rounded-xl border border-[#EAE6E1] text-xs sm:text-sm font-bold text-[#6E6A66]"
            >
              {t('إلغاء', 'Cancel')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

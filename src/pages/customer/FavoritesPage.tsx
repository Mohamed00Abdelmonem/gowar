import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AlertCircle, Heart, Loader2, LogIn, RefreshCw } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { StoreCard } from '../../components/common/StoreCard';
import { EmptyState } from '../../components/common/EmptyState';
import {
  IS_BACKEND_API_ENABLED,
  getAccessToken,
  getStoredApiUser,
} from '../../services/apiClient';

export const FavoritesPage: React.FC = () => {
  const {
    t,
    merchants,
    activeCustomer,
    favoritesLoading,
    favoritesError,
    refreshFavorites,
  } = useApp();
  const location = useLocation();

  const isCustomerSignedIn =
    !IS_BACKEND_API_ENABLED ||
    Boolean(getAccessToken() && getStoredApiUser()?.role === 'customer');

  useEffect(() => {
    if (IS_BACKEND_API_ENABLED && isCustomerSignedIn) {
      void refreshFavorites();
    }
    // Hydrate persisted favorites when entering FavoritesPage
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCustomerSignedIn]);

  const favoriteStores = merchants.filter((m) =>
    activeCustomer.favoriteMerchantIds.includes(m.id)
  );

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-6 space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#1C1917]">
            {t('المحلات المفضلة', 'Favorite Stores')}
          </h1>
          <p className="text-xs text-[#6E6A66]">
            {t('وصول سريع للمحلات التي تطلب منها باستمرار', 'Quick access to stores you love')}
          </p>
        </div>
      </div>

      {!isCustomerSignedIn ? (
        <EmptyState
          icon={Heart}
          title={t('سجل الدخول لعرض المفضلة', 'Sign in to view your favorites')}
          description={t(
            'يجب تسجيل الدخول لحفظ المحلات المفضلة والوصول إليها من أي جهاز.',
            'Sign in to save your favorite stores and access them across sessions.'
          )}
          action={
            <Link
              to="/login"
              state={{ from: `${location.pathname}${location.search}` }}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#1B8E53] hover:bg-[#147242] text-white text-xs font-extrabold"
            >
              <LogIn className="w-4 h-4" />
              <span>{t('سجل الدخول الآن', 'Sign In Now')}</span>
            </Link>
          }
        />
      ) : favoritesLoading && favoriteStores.length === 0 ? (
        <div className="py-16 flex items-center justify-center gap-2 text-sm text-[#6E6A66]">
          <Loader2 className="w-5 h-5 animate-spin text-[#1B8E53]" />
          <span>{t('جاري تحميل المحلات المفضلة...', 'Loading your favorite stores...')}</span>
        </div>
      ) : favoritesError && favoriteStores.length === 0 ? (
        <div className="bg-white rounded-2xl border border-rose-200 p-6 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
          <p className="text-sm font-bold text-[#1C1917]">{favoritesError}</p>
          <button
            type="button"
            onClick={() => void refreshFavorites()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1B8E53] text-white text-xs font-bold"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{t('إعادة المحاولة', 'Retry')}</span>
          </button>
        </div>
      ) : favoriteStores.length === 0 ? (
        <EmptyState
          icon={Heart}
          title={t('لسه مضافتش أي محلات للمفضلة', 'No favorite stores yet')}
          description={t(
            'اضغط على علامة القلب في أي محل لإضافته هنا للوصول السريع.',
            'Tap the heart icon on any store to save it here.'
          )}
          action={
            <Link
              to="/stores"
              className="px-5 py-2.5 rounded-xl bg-[#1B8E53] hover:bg-[#147242] text-white text-xs font-bold"
            >
              {t('استكشاف المحلات', 'Explore Stores')}
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {favoriteStores.map((store) => (
            <StoreCard key={store.id} merchant={store} />
          ))}
        </div>
      )}
    </div>
  );
};

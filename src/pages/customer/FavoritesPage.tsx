import React from 'react';
import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { StoreCard } from '../../components/common/StoreCard';
import { EmptyState } from '../../components/common/EmptyState';

export const FavoritesPage: React.FC = () => {
  const { t, merchants, activeCustomer } = useApp();

  const favoriteStores = merchants.filter((m) =>
    activeCustomer.favoriteMerchantIds.includes(m.id)
  );

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-6 space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-[#1C1917]">
          {t('المحلات المفضلة', 'Favorite Stores')}
        </h1>
        <p className="text-xs text-[#6E6A66]">
          {t('وصول سريع للمحلات التي تطلب منها باستمرار', 'Quick access to stores you love')}
        </p>
      </div>

      {favoriteStores.length === 0 ? (
        <EmptyState
          icon={Heart}
          title={t('قائمة المفضلة فارغة', 'No favorite stores yet')}
          description={t('اضغط على علامة القلب في أي محل لإضافته هنا للوصول السريع.', 'Tap the heart icon on any store to save it here.')}
          action={
            <Link
              to="/stores"
              className="px-5 py-2.5 rounded-xl bg-[#1B8E53] text-white text-xs font-bold"
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

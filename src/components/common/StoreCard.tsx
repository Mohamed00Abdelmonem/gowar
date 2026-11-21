import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Heart } from 'lucide-react';
import type { Merchant } from '../../types';
import { useApp } from '../../context/AppContext';
import {
  evaluateStoreAvailability,
  formatDistanceShort,
} from '../../services/locationService';
import { formatEGP, getStoreTypeLabel } from '../../utils/i18n';
import { SafeImage } from './SafeImage';

interface StoreCardProps {
  merchant: Merchant;
  viewMode?: 'grid' | 'list';
  distanceKmOverride?: number;
}

export const StoreCard: React.FC<StoreCardProps> = ({
  merchant,
  distanceKmOverride,
}) => {
  const { language, t, activeCustomer, toggleFavoriteMerchant, customerLocation } = useApp();
  const isFav = activeCustomer.favoriteMerchantIds.includes(merchant.id);
  const storeName = language === 'ar' ? merchant.nameAr : merchant.nameEn;
  const ArrowIcon = language === 'ar' ? ArrowLeft : ArrowRight;

  const availability = evaluateStoreAvailability(
    merchant,
    customerLocation,
    customerLocation.searchRadiusKm
  );
  const distanceKm = distanceKmOverride ?? availability.distanceKm;

  return (
    <Link
      to={`/stores/${merchant.id}`}
      className="group bg-white rounded-2xl border border-[#EAE6E1] hover:border-[#D6450D] shadow-2xs hover:shadow-md transition-all overflow-hidden flex flex-col"
    >
      <div className="relative h-36 sm:h-40 overflow-hidden bg-[#FAF9F7]">
        <SafeImage
          src={merchant.coverImage}
          alt={storeName}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent pointer-events-none" />

        {/* Clear Open/Closed + Store Type Badges */}
        <div className="absolute top-3 start-3 flex flex-wrap items-center gap-1.5 pe-12">
          <span
            className={`px-2.5 py-1 rounded-full text-xs font-bold shadow-xs ${
              merchant.isOpen
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-800 text-white'
            }`}
          >
            {merchant.isOpen ? t('مفتوح دلوقتي', 'Open Now') : t('مغلق', 'Closed')}
          </span>
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-white/95 text-[#1C1917] shadow-xs">
            {getStoreTypeLabel(merchant.type, language)}
          </span>
          {availability.deliveryStatus === 'outside_delivery_area' && (
            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300 shadow-xs">
              {t('خارج نطاق التوصيل', 'Outside delivery area')}
            </span>
          )}
          {availability.deliveryStatus === 'pickup_only' && (
            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-300 shadow-xs">
              {t('استلام من المحل فقط', 'Pickup only')}
            </span>
          )}
        </div>

        {/* Favorite Toggle */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleFavoriteMerchant(merchant.id);
          }}
          className={`absolute top-3 end-3 w-9 h-9 rounded-full flex items-center justify-center shadow-xs transition-colors ${
            isFav ? 'bg-rose-500 text-white' : 'bg-white/90 text-[#6E6A66] hover:text-rose-500'
          }`}
          aria-label={t('حفظ في المفضلة', 'Toggle favorite')}
        >
          <Heart className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
        </button>

        {/* Store Logo & Name overlay */}
        <div className="absolute bottom-3 start-3 end-3 flex items-center gap-2.5">
          <SafeImage
            src={merchant.logo}
            alt={storeName}
            className="w-11 h-11 rounded-xl border-2 border-white object-cover shadow-sm bg-white shrink-0"
          />
          <div className="text-white min-w-0">
            <h3 className="text-base font-extrabold truncate drop-shadow-xs">{storeName}</h3>
          </div>
        </div>
      </div>

      {/* Clear, Scannable Store Metrics with Exact Haversine Distance */}
      <div className="p-4 flex-1 flex flex-col justify-between gap-3">
        <div className="grid grid-cols-3 gap-2 text-center bg-[#FAF9F7] rounded-xl p-2.5 border border-[#EAE6E1]">
          <div>
            <span className="block text-[11px] text-[#6E6A66]">{t('المسافة', 'Distance')}</span>
            <span className="text-xs sm:text-sm font-bold text-[#1C1917]">
              {formatDistanceShort(distanceKm, language)}
            </span>
          </div>
          <div className="border-x border-[#EAE6E1]">
            <span className="block text-[11px] text-[#6E6A66]">{t('التوصيل', 'Delivery')}</span>
            <span
              className={`text-xs sm:text-sm font-bold ${
                availability.isDeliverable ? 'text-[#D6450D]' : 'text-amber-700'
              }`}
            >
              {availability.deliveryStatus === 'pickup_only'
                ? t('استلام', 'Pickup')
                : !availability.isDeliverable
                  ? t('غير متاح', 'N/A')
                  : formatEGP(merchant.delivery.deliveryFee, language)}
            </span>
          </div>
          <div>
            <span className="block text-[11px] text-[#6E6A66]">{t('الوقت', 'ETA')}</span>
            <span className="text-xs sm:text-sm font-bold text-[#1C1917]">
              {merchant.delivery.deliveryTimeMin} {t('دقيقة', 'min')}
            </span>
          </div>
        </div>

        <div className="w-full py-2.5 px-4 rounded-xl bg-[#FFF2EB] group-hover:bg-[#D6450D] text-[#D6450D] group-hover:text-white text-sm font-extrabold transition-colors flex items-center justify-center gap-1.5">
          <span>{t('شوف المنتجات', 'View Products')}</span>
          <ArrowIcon className="w-4 h-4" />
        </div>
      </div>
    </Link>
  );
};

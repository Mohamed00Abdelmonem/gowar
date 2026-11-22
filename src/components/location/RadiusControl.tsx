import React from 'react';
import { Compass, Minus, Plus } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  MAX_SEARCH_RADIUS_KM,
  MIN_SEARCH_RADIUS_KM,
  QUICK_RADIUS_OPTIONS,
} from '../../services/locationService';

interface RadiusControlProps {
  matchingCount: number;
  compact?: boolean;
}

export const RadiusControl: React.FC<RadiusControlProps> = ({
  matchingCount,
  compact = false,
}) => {
  const { language, t, customerLocation, setSearchRadiusKm } = useApp();
  const radiusKm = customerLocation.searchRadiusKm;

  return (
    <div className="bg-white rounded-2xl border border-[#EAE6E1] p-3.5 sm:p-4 space-y-3 shadow-2xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-[#E6F5EC] text-[#1B8E53] flex items-center justify-center shrink-0">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs sm:text-sm font-extrabold text-[#1C1917]">
              {t('نطاق البحث', 'Search Radius')} —{' '}
              <span className="text-[#1B8E53]">
                {t(`عرض المحلات ضمن ${radiusKm} كم`, `Show stores within ${radiusKm} KM`)}
              </span>
            </div>
            {!compact && (
              <p className="text-[11px] text-[#6E6A66]">
                {t(
                  'تحكم في المسافة القصوى للمحلات الظاهرة حول موقعك',
                  'Adjust how far to discover neighborhood stores'
                )}
              </p>
            )}
          </div>
        </div>

        <span className="px-3 py-1 rounded-full bg-[#E6F5EC] text-[#1B8E53] text-xs font-extrabold shrink-0">
          {matchingCount} {t('محل متاح', matchingCount === 1 ? 'store' : 'stores')}
        </span>
      </div>

      {/* Slider + +/- Step Controls */}
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={() => setSearchRadiusKm(radiusKm - 1)}
          disabled={radiusKm <= MIN_SEARCH_RADIUS_KM}
          className="w-8 h-8 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] flex items-center justify-center text-[#1C1917] hover:border-[#1B8E53] disabled:opacity-40 shrink-0"
          aria-label={t('تقليل نطاق البحث', 'Decrease radius')}
        >
          <Minus className="w-3.5 h-3.5" />
        </button>

        <input
          type="range"
          min={MIN_SEARCH_RADIUS_KM}
          max={MAX_SEARCH_RADIUS_KM}
          step={1}
          value={radiusKm}
          onChange={(e) => setSearchRadiusKm(Number(e.target.value))}
          aria-label={t('نطاق البحث بالكيلومتر', 'Search radius in kilometers')}
          className="flex-1 accent-[#1B8E53] h-2 bg-[#F5F2EE] rounded-lg cursor-pointer"
        />

        <button
          type="button"
          onClick={() => setSearchRadiusKm(radiusKm + 1)}
          disabled={radiusKm >= MAX_SEARCH_RADIUS_KM}
          className="w-8 h-8 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] flex items-center justify-center text-[#1C1917] hover:border-[#1B8E53] disabled:opacity-40 shrink-0"
          aria-label={t('زيادة نطاق البحث', 'Increase radius')}
        >
          <Plus className="w-3.5 h-3.5" />
        </button>

        <span className="min-w-[54px] text-center px-2.5 py-1 rounded-xl bg-[#1C1917] text-white text-xs font-extrabold shrink-0">
          {radiusKm} {language === 'ar' ? 'كم' : 'KM'}
        </span>
      </div>

      {/* Quick Preset Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
        {QUICK_RADIUS_OPTIONS.map((km) => {
          const active = radiusKm === km;
          return (
            <button
              key={km}
              type="button"
              onClick={() => setSearchRadiusKm(km)}
              className={`px-3 py-1 rounded-full text-xs font-bold border whitespace-nowrap transition-colors shrink-0 ${
                active
                  ? 'bg-[#1B8E53] text-white border-[#1B8E53]'
                  : 'bg-[#FAF9F7] text-[#1C1917] border-[#EAE6E1] hover:border-[#1B8E53]'
              }`}
            >
              {km} {language === 'ar' ? 'كم' : 'KM'}
            </button>
          );
        })}
      </div>
    </div>
  );
};

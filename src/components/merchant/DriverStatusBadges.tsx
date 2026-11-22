import React from 'react';
import { useApp } from '../../context/AppContext';
import type { DriverLocationStatus, DriverOperationalStatus, DriverVehicleType } from '../../types';

export const DriverOperationalBadge: React.FC<{ status: DriverOperationalStatus }> = ({
  status,
}) => {
  const { t } = useApp();
  switch (status) {
    case 'available':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          {t('متاح', 'Available')}
        </span>
      );
    case 'on_delivery':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#FFF2EB] text-[#D6450D] border border-[#FBD8C5]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#D6450D] animate-pulse" />
          {t('في توصيل', 'On Delivery')}
        </span>
      );
    case 'offline':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
          {t('غير متصل', 'Offline')}
        </span>
      );
    case 'inactive':
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
          {t('معطّل', 'Inactive')}
        </span>
      );
  }
};

export const DriverLocationBadge: React.FC<{ status: DriverLocationStatus }> = ({ status }) => {
  const { t } = useApp();
  switch (status) {
    case 'live':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          {t('موقع مباشر', 'Live GPS')}
        </span>
      );
    case 'stale':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
          {t('موقع قديم (متوقف)', 'Stale Location')}
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
          {t('غير متاح', 'Unavailable')}
        </span>
      );
  }
};

export function formatVehicleLabel(
  vehicle: DriverVehicleType,
  t: (ar: string, en: string) => string
): string {
  switch (vehicle) {
    case 'motorcycle':
      return t('موتوسيكل', 'Motorcycle');
    case 'bicycle':
      return t('دراجة', 'Bicycle');
    case 'car':
      return t('سيارة', 'Car');
    case 'on_foot':
      return t('سير على الأقدام', 'On Foot');
    default:
      return vehicle;
  }
}

export function formatRelativeTime(
  iso: string | null,
  t: (ar: string, en: string) => string
): string {
  if (!iso) return t('لم يظهر بعد', 'Never');
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (diffSec < 60) return t('الآن', 'Just now');
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return t(`منذ ${diffMin} د`, `${diffMin}m ago`);
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return t(`منذ ${diffHr} س`, `${diffHr}h ago`);
  const diffDay = Math.floor(diffHr / 24);
  return t(`منذ ${diffDay} ي`, `${diffDay}d ago`);
}

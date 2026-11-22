import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  Clock,
  Loader2,
  PackageCheck,
  RefreshCw,
  TrendingUp,
  Truck,
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { merchantDeliveryApi } from '../../../services/gowarApi';
import type { MerchantDeliveryPerformanceResponse } from '../../../types';
import { DriverOperationalBadge } from '../../../components/merchant/DriverStatusBadges';

export const MerchantDeliveryPerformancePage: React.FC = () => {
  const { t } = useApp();
  const [data, setData] = useState<MerchantDeliveryPerformanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPerformance = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await merchantDeliveryApi.fetchPerformance();
      setData(res);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('تعذر تحميل إحصائيات الأداء', 'Failed to load performance metrics')
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadPerformance();
  }, [loadPerformance]);

  const totals = data?.totals;

  const kpis = [
    {
      label: t('تم توصيلها اليوم', 'Delivered Today'),
      value: totals?.delivered_today ?? 0,
      icon: PackageCheck,
      tone: 'bg-emerald-50 text-emerald-700',
    },
    {
      label: t('جاري توصيلها الآن', 'In Progress'),
      value: totals?.in_progress_count ?? 0,
      icon: Truck,
      tone: 'bg-[#FFF2EB] text-[#D6450D]',
    },
    {
      label: t('مسندة اليوم', 'Assigned Today'),
      value: totals?.assigned_today ?? 0,
      icon: Clock,
      tone: 'bg-blue-50 text-blue-700',
    },
    {
      label: t('توصيلات الأسبوع', 'This Week'),
      value: totals?.delivered_this_week ?? 0,
      icon: TrendingUp,
      tone: 'bg-amber-50 text-amber-800',
    },
    {
      label: t('توصيلات الشهر', 'This Month'),
      value: totals?.delivered_this_month ?? 0,
      icon: Calendar,
      tone: 'bg-slate-100 text-slate-700',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#1C1917]">
            {t('الأداء اليومي للمناديب', 'Daily Delivery Performance')}
          </h1>
          <p className="text-xs sm:text-sm text-[#6E6A66]">
            {t(
              'إحصائيات محسوبة من الطلبات المكتملة فعلياً وساعات المناوبات بتوقيت القاهرة',
              'Server-calculated metrics from completed deliveries and recorded shifts'
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadPerformance()}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#EAE6E1] bg-white text-xs font-bold text-[#1C1917] hover:bg-[#FAF9F7] self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>{t('تحديث', 'Refresh')}</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <div
              key={k.label}
              className="bg-white rounded-2xl border border-[#EAE6E1] p-4 shadow-2xs flex items-center justify-between gap-3"
            >
              <div>
                <div className="text-xs text-[#6E6A66] font-semibold">{k.label}</div>
                <div className="text-2xl font-extrabold text-[#1C1917] mt-1">{k.value}</div>
              </div>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${k.tone}`}>
                <Icon className="w-5 h-5" />
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-2xl border border-[#EAE6E1] p-4 shadow-2xs">
        {loading && !data ? (
          <div className="py-12 flex items-center justify-center gap-2 text-sm text-[#6E6A66]">
            <Loader2 className="w-5 h-5 animate-spin text-[#D6450D]" />
            <span>{t('جاري التحميل...', 'Loading...')}</span>
          </div>
        ) : error ? (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : !data || data.drivers.length === 0 ? (
          <p className="py-10 text-center text-sm text-[#6E6A66]">
            {t('لا توجد بيانات أداء بعد', 'No performance records yet')}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#EAE6E1] text-xs text-[#6E6A66]">
                  <th className="py-3 px-2 text-start font-bold">{t('المندوب', 'Driver')}</th>
                  <th className="py-3 px-2 text-start font-bold">{t('الحالة', 'Status')}</th>
                  <th className="py-3 px-2 text-start font-bold">{t('توصيل اليوم', 'Delivered Today')}</th>
                  <th className="py-3 px-2 text-start font-bold">{t('قيد التوصيل', 'In Progress')}</th>
                  <th className="py-3 px-2 text-start font-bold">{t('مسندة اليوم', 'Assigned Today')}</th>
                  <th className="py-3 px-2 text-start font-bold">{t('ملغاة اليوم', 'Cancelled Today')}</th>
                  <th className="py-3 px-2 text-start font-bold">{t('الأسبوع', 'This Week')}</th>
                  <th className="py-3 px-2 text-start font-bold">{t('الشهر', 'This Month')}</th>
                  <th className="py-3 px-2 text-start font-bold">{t('متوسط المدة', 'Avg Duration')}</th>
                  <th className="py-3 px-2 text-start font-bold">{t('ساعات العمل اليوم', 'Hours Today')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAE6E1]">
                {data.drivers.map((d) => (
                  <tr key={d.id} className="hover:bg-[#FAF9F7]/70">
                    <td className="py-3 px-2 font-bold text-[#1C1917]">{d.full_name}</td>
                    <td className="py-3 px-2">
                      <DriverOperationalBadge status={d.operational_status} />
                    </td>
                    <td className="py-3 px-2 font-extrabold text-emerald-700">{d.delivered_today}</td>
                    <td className="py-3 px-2 font-bold text-[#D6450D]">{d.active_orders_count}</td>
                    <td className="py-3 px-2">{d.assigned_today}</td>
                    <td className="py-3 px-2 text-rose-600">{d.cancelled_today}</td>
                    <td className="py-3 px-2 font-semibold">{d.delivered_this_week}</td>
                    <td className="py-3 px-2 font-semibold">{d.delivered_this_month}</td>
                    <td className="py-3 px-2 text-xs text-[#6E6A66]">
                      {d.avg_delivery_duration_minutes !== null
                        ? `${d.avg_delivery_duration_minutes} ${t('د', 'min')}`
                        : '—'}
                    </td>
                    <td className="py-3 px-2 font-bold text-[#1C1917]">
                      {d.working_hours_today}h
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

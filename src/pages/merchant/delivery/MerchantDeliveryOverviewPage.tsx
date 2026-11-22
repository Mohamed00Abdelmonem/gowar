import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  MapPin,
  PackageCheck,
  RefreshCw,
  Search,
  Truck,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { merchantDeliveryApi } from '../../../services/gowarApi';
import type { MerchantDeliveryOverviewResponse } from '../../../types';
import {
  DriverOperationalBadge,
  formatRelativeTime,
} from '../../../components/merchant/DriverStatusBadges';

export const MerchantDeliveryOverviewPage: React.FC = () => {
  const { t } = useApp();
  const [data, setData] = useState<MerchantDeliveryOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await merchantDeliveryApi.fetchOverview();
      setData(res);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('تعذر تحميل نظرة عامة على فريق التوصيل', 'Failed to load delivery overview')
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const filteredDrivers = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.drivers.filter((d) => {
      if (d.is_archived && statusFilter !== 'inactive') return false;
      if (statusFilter !== 'all' && d.operational_status !== statusFilter) return false;
      if (q) {
        return (
          d.full_name.toLowerCase().includes(q) ||
          d.phone_number.toLowerCase().includes(q) ||
          d.email.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [data, search, statusFilter]);

  const cards = [
    {
      label: t('إجمالي المناديب', 'Total Personnel'),
      value: data?.summary.total_personnel ?? 0,
      icon: Users,
      tone: 'bg-slate-100 text-slate-700',
    },
    {
      label: t('حسابات نشطة', 'Active Accounts'),
      value: data?.summary.active_personnel ?? 0,
      icon: UserCheck,
      tone: 'bg-blue-50 text-blue-700',
    },
    {
      label: t('متاح حالياً', 'Currently Available'),
      value: data?.summary.available_now ?? 0,
      icon: CheckCircle2,
      tone: 'bg-emerald-50 text-emerald-700',
    },
    {
      label: t('في توصيل الآن', 'On Delivery'),
      value: data?.summary.on_delivery_now ?? 0,
      icon: Truck,
      tone: 'bg-[#E6F5EC] text-[#1B8E53]',
    },
    {
      label: t('تم توصيلها اليوم', 'Delivered Today'),
      value: data?.summary.delivered_today ?? 0,
      icon: PackageCheck,
      tone: 'bg-emerald-50 text-emerald-700',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#1C1917]">
            {t('إدارة التوصيل — نظرة عامة', 'Delivery Management Overview')}
          </h1>
          <p className="text-xs sm:text-sm text-[#6E6A66]">
            {t(
              'تابع حالة مناديب التوصيل والطلبات النشطة وأداء اليوم في مكان واحد',
              'Monitor your delivery team status, active orders, and daily deliveries'
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void loadOverview()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#EAE6E1] bg-white text-xs font-bold text-[#1C1917] hover:bg-[#FAF9F7]"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{t('تحديث', 'Refresh')}</span>
          </button>
          <Link
            to="/merchant/delivery-management/tracking"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#EAE6E1] bg-white text-xs font-bold text-[#1C1917] hover:bg-[#FAF9F7]"
          >
            <MapPin className="w-3.5 h-3.5 text-[#1B8E53]" />
            <span>{t('التتبع المباشر', 'Live Tracking')}</span>
          </Link>
          <Link
            to="/merchant/delivery-management/personnel"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1B8E53] hover:bg-[#147242] text-white text-xs font-extrabold"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>{t('إدارة المناديب', 'Manage Personnel')}</span>
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div
              key={c.label}
              className="bg-white rounded-2xl border border-[#EAE6E1] p-4 shadow-2xs flex items-center justify-between gap-3"
            >
              <div>
                <div className="text-xs text-[#6E6A66] font-semibold">{c.label}</div>
                <div className="text-2xl font-extrabold text-[#1C1917] mt-1">{c.value}</div>
              </div>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${c.tone}`}>
                <Icon className="w-5 h-5" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white rounded-2xl border border-[#EAE6E1] p-4 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#6E6A66] absolute start-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('ابحث بالاسم أو رقم الموبايل...', 'Search by name or phone...')}
              className="w-full ps-10 pe-3.5 py-2.5 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] text-sm focus:outline-none focus:border-[#1B8E53]"
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ['all', t('الكل', 'All')],
                ['available', t('متاح', 'Available')],
                ['on_delivery', t('في توصيل', 'On Delivery')],
                ['offline', t('غير متصل', 'Offline')],
                ['inactive', t('معطّل', 'Inactive')],
              ] as const
            ).map(([val, lbl]) => (
              <button
                key={val}
                type="button"
                onClick={() => setStatusFilter(val)}
                className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${
                  statusFilter === val
                    ? 'bg-[#1B8E53] text-white border-[#1B8E53]'
                    : 'bg-[#FAF9F7] text-[#1C1917] border-[#EAE6E1] hover:border-[#1B8E53]'
                }`}
              >
                {lbl}
              </button>
            ))}
          </div>
        </div>

        {loading && !data ? (
          <div className="py-12 flex items-center justify-center gap-2 text-sm text-[#6E6A66]">
            <Loader2 className="w-5 h-5 animate-spin text-[#1B8E53]" />
            <span>{t('جاري التحميل...', 'Loading...')}</span>
          </div>
        ) : error ? (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : filteredDrivers.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <Truck className="w-10 h-10 text-[#6E6A66]/40 mx-auto" />
            <p className="text-sm font-bold text-[#1C1917]">
              {t('لا يوجد مناديب مطابقين', 'No matching delivery personnel')}
            </p>
            <p className="text-xs text-[#6E6A66]">
              {t(
                'أضف مندوب توصيل جديد لفريقك من صفحة إدارة المناديب.',
                'Add a new delivery driver to your team from Delivery Personnel.'
              )}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#EAE6E1] text-xs text-[#6E6A66] text-start">
                  <th className="py-3 px-2 text-start font-bold">{t('المندوب', 'Name')}</th>
                  <th className="py-3 px-2 text-start font-bold">{t('الهاتف', 'Phone')}</th>
                  <th className="py-3 px-2 text-start font-bold">{t('الحساب', 'Account')}</th>
                  <th className="py-3 px-2 text-start font-bold">{t('الحالة', 'Status')}</th>
                  <th className="py-3 px-2 text-start font-bold">{t('آخر ظهور', 'Last Seen')}</th>
                  <th className="py-3 px-2 text-start font-bold">{t('الطلب الحالي', 'Current Order')}</th>
                  <th className="py-3 px-2 text-start font-bold">{t('توصيلات اليوم', 'Delivered Today')}</th>
                  <th className="py-3 px-2 text-end font-bold">{t('إجراء', 'Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAE6E1]">
                {filteredDrivers.map((d) => (
                  <tr key={d.id} className="hover:bg-[#FAF9F7]/70">
                    <td className="py-3 px-2 font-bold text-[#1C1917]">{d.full_name}</td>
                    <td className="py-3 px-2 text-xs text-[#6E6A66]" dir="ltr">
                      {d.phone_number}
                    </td>
                    <td className="py-3 px-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          d.is_active
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        {d.is_active ? t('نشط', 'Active') : t('معطّل', 'Disabled')}
                      </span>
                    </td>
                    <td className="py-3 px-2">
                      <DriverOperationalBadge status={d.operational_status} />
                    </td>
                    <td className="py-3 px-2 text-xs text-[#6E6A66]">
                      {formatRelativeTime(d.last_seen_at, t)}
                    </td>
                    <td className="py-3 px-2 text-xs">
                      {d.current_order ? (
                        <span className="font-bold text-[#1B8E53]">
                          #{d.current_order.order_number}
                        </span>
                      ) : (
                        <span className="text-[#6E6A66]">—</span>
                      )}
                    </td>
                    <td className="py-3 px-2 font-extrabold text-[#1C1917]">
                      {d.delivered_today}
                    </td>
                    <td className="py-3 px-2 text-end">
                      <Link
                        to="/merchant/delivery-management/personnel"
                        className="text-xs font-bold text-[#1B8E53] hover:underline"
                      >
                        {t('إدارة', 'Manage')}
                      </Link>
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

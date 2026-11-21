import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpDown,
  Banknote,
  Calendar,
  Clock,
  Percent,
  Store,
  TrendingUp,
  Truck,
  XCircle,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useApp } from '../../context/AppContext';
import {
  buildTimeSeriesFromOrders,
  filterOrdersByWindow,
  getDateWindow,
  getPresetOptions,
} from '../../services/analyticsService';
import { formatEGP, formatNumber } from '../../utils/i18n';
import type { DateFilterState, DateRangePreset } from '../../types';

type StoreSortKey = 'highest_sales' | 'highest_revenue' | 'most_orders' | 'lowest_sales';

export const AdminAnalyticsPage: React.FC = () => {
  const { language, t, orders, merchants } = useApp();

  const [preset, setPreset] = useState<DateRangePreset>('30d');
  const [customFrom, setCustomFrom] = useState('2026-10-01');
  const [customTo, setCustomTo] = useState('2026-11-20');
  const [granularity, setGranularity] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [sortBy, setSortBy] = useState<StoreSortKey>('highest_sales');

  const filterState: DateFilterState = useMemo(
    () => ({ preset, customStart: customFrom, customEnd: customTo }),
    [preset, customFrom, customTo]
  );

  const windowRange = useMemo(() => getDateWindow(filterState), [filterState]);

  const windowOrders = useMemo(
    () => filterOrdersByWindow(orders, windowRange.start, windowRange.end),
    [orders, windowRange.start, windowRange.end]
  );

  const financialSummary = useMemo(() => {
    const delivered = windowOrders.filter((o) => o.status === 'delivered');
    const pendingActive = windowOrders.filter(
      (o) =>
        o.status === 'pending' ||
        o.status === 'accepted' ||
        o.status === 'preparing' ||
        o.status === 'out_for_delivery'
    );
    const cancelled = windowOrders.filter((o) => o.status === 'cancelled');

    const gmvDelivered = delivered.reduce((s, o) => s + o.total, 0);
    const platformRevenue = delivered.reduce((s, o) => s + o.platformCommission, 0);
    const merchantNetSales = delivered.reduce(
      (s, o) => s + Math.max(0, o.total - o.platformCommission),
      0
    );
    const deliveryFees = delivered.reduce((s, o) => s + o.deliveryFee, 0);
    const pendingCommissions = pendingActive.reduce((s, o) => s + o.platformCommission, 0);
    const cancelledValue = cancelled.reduce((s, o) => s + o.total, 0);

    return {
      gmvDelivered,
      platformRevenue,
      merchantNetSales,
      deliveryFees,
      pendingCommissions,
      cancelledCount: cancelled.length,
      cancelledValue,
      deliveredCount: delivered.length,
    };
  }, [windowOrders]);

  const timeSeries = useMemo(
    () => buildTimeSeriesFromOrders(windowOrders, granularity, language),
    [windowOrders, granularity, language]
  );

  const storeBreakdown = useMemo(() => {
    const rows = merchants.map((m) => {
      const storeAll = windowOrders.filter((o) => o.merchantId === m.id);
      const storeDelivered = storeAll.filter((o) => o.status === 'delivered');

      const grossSales = storeDelivered.reduce((s, o) => s + o.total, 0);
      const commissionEarned = storeDelivered.reduce((s, o) => s + o.platformCommission, 0);
      const merchantNet = Math.max(0, grossSales - commissionEarned);
      const deliveryFees = storeDelivered.reduce((s, o) => s + o.deliveryFee, 0);

      return {
        id: m.id,
        name: language === 'ar' ? m.nameAr : m.nameEn,
        owner: language === 'ar' ? m.ownerNameAr ?? '-' : m.ownerNameEn ?? '-',
        totalOrders: storeAll.length,
        deliveredOrders: storeDelivered.length,
        grossSales,
        commissionRate: m.commissionRate,
        commissionEarned,
        merchantNet,
        deliveryFees,
      };
    });

    const sorted = [...rows].sort((a, b) => {
      switch (sortBy) {
        case 'highest_sales':
          return b.grossSales - a.grossSales;
        case 'highest_revenue':
          return b.commissionEarned - a.commissionEarned;
        case 'most_orders':
          return b.deliveredOrders - a.deliveredOrders || b.totalOrders - a.totalOrders;
        case 'lowest_sales':
          return a.grossSales - b.grossSales;
      }
    });

    return sorted;
  }, [merchants, windowOrders, sortBy, language]);

  const topStoresChart = useMemo(
    () =>
      [...storeBreakdown]
        .sort((a, b) => b.grossSales - a.grossSales)
        .slice(0, 7)
        .map((s) => ({
          name: s.name.slice(0, 16),
          sales: Math.round(s.grossSales),
          commission: Math.round(s.commissionEarned),
        })),
    [storeBreakdown]
  );

  const presets = getPresetOptions(language);

  return (
    <div className="space-y-6">
      {/* Header + Date Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#1C1917]">
            {t('التحليلات المالية وأداء المتاجر', 'Financial Analytics & Store Breakdown')}
          </h1>
          <p className="text-xs text-[#6E6A66]">
            {t(
              'فصل واضح بين إجمالي حجم المبيعات (GMV) وإيرادات المنصة وصافي أرباح كل تاجر',
              'Clear separation between GMV, earned platform commissions, and per-store net sales'
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-1 bg-white border border-[#EAE6E1] rounded-2xl p-1">
            {presets.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPreset(p.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                  preset === p.id
                    ? 'bg-[#D6450D] text-white'
                    : 'text-[#6E6A66] hover:text-[#1C1917]'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {preset === 'custom' && (
            <div className="flex items-center gap-2 bg-white border border-[#EAE6E1] rounded-xl px-3 py-1.5 text-xs">
              <Calendar className="w-3.5 h-3.5 text-[#D6450D]" />
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="bg-transparent font-bold outline-none"
              />
              <span>-</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="bg-transparent font-bold outline-none"
              />
            </div>
          )}
        </div>
      </div>

      {/* Financial Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
        {[
          {
            label: t('إجمالي المبيعات المحققة (GMV)', 'Realized GMV (Delivered)'),
            value: formatEGP(financialSummary.gmvDelivered, language),
            sub: `${formatNumber(financialSummary.deliveredCount, language)} ${t('طلب مكتمل', 'delivered')}`,
            icon: Banknote,
            tone: 'bg-[#FFF2EB] text-[#D6450D]',
          },
          {
            label: t('إيرادات المنصة (العمولات)', 'Platform Revenue (Earned)'),
            value: formatEGP(financialSummary.platformRevenue, language),
            sub: t('من الطلبات المسلمة فقط', 'From completed orders'),
            icon: Percent,
            tone: 'bg-emerald-50 text-emerald-700',
          },
          {
            label: t('صافي مبيعات التجار', 'Merchant Net Sales'),
            value: formatEGP(financialSummary.merchantNetSales, language),
            sub: t('بعد خصم العمولة', 'After commission deduction'),
            icon: Store,
            tone: 'bg-sky-50 text-sky-700',
          },
          {
            label: t('رسوم التوصيل المحصلة', 'Delivery Fees Collected'),
            value: formatEGP(financialSummary.deliveryFees, language),
            sub: t('مباشرة للتجار', 'Merchant-fulfilled delivery'),
            icon: Truck,
            tone: 'bg-indigo-50 text-indigo-700',
          },
          {
            label: t('عمولات قيد التحصيل', 'Pending Commissions'),
            value: formatEGP(financialSummary.pendingCommissions, language),
            sub: t('طلبات جارية ولم تكتمل', 'In-progress active orders'),
            icon: Clock,
            tone: 'bg-amber-50 text-amber-700',
          },
          {
            label: t('الطلبات الملغاة', 'Cancelled Orders'),
            value: formatEGP(financialSummary.cancelledValue, language),
            sub: `${formatNumber(financialSummary.cancelledCount, language)} ${t('طلب ملغي', 'cancelled')}`,
            icon: XCircle,
            tone: 'bg-rose-50 text-rose-700',
          },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="bg-white rounded-2xl border border-[#EAE6E1] p-4 shadow-2xs flex flex-col justify-between gap-2.5"
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${card.tone}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[11px] text-[#6E6A66] font-medium">{card.label}</div>
                <div className="text-base sm:text-lg font-extrabold text-[#1C1917] mt-0.5">
                  {card.value}
                </div>
                <div className="text-[10px] text-[#6E6A66] mt-0.5">{card.sub}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 bg-white rounded-2xl border border-[#EAE6E1] p-5 shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="text-sm font-extrabold text-[#1C1917] flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#D6450D]" />
                <span>{t('الأداء المالي بمرور الوقت', 'Financial Performance Over Time')}</span>
              </h3>
              <p className="text-xs text-[#6E6A66]">
                {t('حجم المبيعات المحققة (GMV) مقابل عمولة المنصة', 'Realized GMV vs Earned Platform Commission')}
              </p>
            </div>
            <div className="flex items-center gap-1 bg-[#FAF9F7] border border-[#EAE6E1] rounded-xl p-1 text-[11px] font-bold">
              {(
                [
                  ['daily', t('يومي', 'Daily')],
                  ['weekly', t('أسبوعي', 'Weekly')],
                  ['monthly', t('شهري', 'Monthly')],
                ] as const
              ).map(([g, label]) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGranularity(g)}
                  className={`px-2.5 py-1 rounded-lg ${
                    granularity === g ? 'bg-[#D6450D] text-white' : 'text-[#6E6A66]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="h-64" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EAE6E1" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6E6A66' }} />
                <YAxis tick={{ fontSize: 11, fill: '#6E6A66' }} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="sales"
                  name={t('إجمالي المبيعات (GMV)', 'GMV (EGP)')}
                  stroke="#D6450D"
                  strokeWidth={3}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="commission"
                  name={t('إيرادات المنصة', 'Platform Commission')}
                  stroke="#10B981"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-5 bg-white rounded-2xl border border-[#EAE6E1] p-5 shadow-2xs">
          <h3 className="text-sm font-extrabold text-[#1C1917] mb-1">
            {t('أعلى المتاجر مبيعاً في الفترة', 'Top Stores by Realized Sales')}
          </h3>
          <p className="text-xs text-[#6E6A66] mb-4">
            {t('مقارنة المبيعات المحققة لأعلى 7 متاجر', 'Top 7 stores by delivered GMV')}
          </p>
          <div className="h-64" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topStoresChart} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#EAE6E1" />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#6E6A66' }} />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={110}
                  tick={{ fontSize: 10, fill: '#1C1917' }}
                />
                <Tooltip />
                <Bar
                  dataKey="sales"
                  name={t('المبيعات (جنيه)', 'Sales (EGP)')}
                  fill="#D6450D"
                  radius={[0, 6, 6, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Total Revenue Per Supermarket Table */}
      <div className="bg-white rounded-2xl border border-[#EAE6E1] shadow-2xs overflow-hidden">
        <div className="px-5 py-4 border-b border-[#EAE6E1] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-extrabold text-[#1C1917]">
              {t('تفصيل الإيرادات والمبيعات لكل سوبر ماركت', 'Total Revenue Per Supermarket')}
            </h2>
            <p className="text-xs text-[#6E6A66]">
              {t(
                'ترتيب ومتابعة مبيعات كل متجر ونسبة العمولة وصافي مستحقاته',
                'Sortable revenue, commission, and net payout breakdown per store'
              )}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-[#6E6A66]" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as StoreSortKey)}
              className="px-3.5 py-2 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] text-xs font-bold"
            >
              <option value="highest_sales">{t('الأعلى مبيعاً', 'Highest Sales')}</option>
              <option value="highest_revenue">{t('الأعلى عمولة للمنصة', 'Highest Platform Revenue')}</option>
              <option value="most_orders">{t('الأكثر طلبات', 'Most Orders')}</option>
              <option value="lowest_sales">{t('الأقل مبيعاً', 'Lowest Sales')}</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs">
            <thead className="bg-[#FAF9F7] text-[#6E6A66]">
              <tr>
                <th className="py-3 px-4 font-bold text-start">{t('المتجر', 'Store')}</th>
                <th className="py-3 px-4 font-bold text-start">{t('الطلبات (مكتمل/الكل)', 'Orders (Deliv/All)')}</th>
                <th className="py-3 px-4 font-bold text-start">{t('إجمالي المبيعات', 'Gross Sales')}</th>
                <th className="py-3 px-4 font-bold text-start">{t('نسبة العمولة', 'Rate')}</th>
                <th className="py-3 px-4 font-bold text-start">{t('عمولة المنصة', 'Platform Comm.')}</th>
                <th className="py-3 px-4 font-bold text-start">{t('صافي المتجر', 'Merchant Net')}</th>
                <th className="py-3 px-4 font-bold text-start">{t('رسوم التوصيل', 'Delivery Fees')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EAE6E1]">
              {storeBreakdown.map((row) => (
                <tr key={row.id} className="hover:bg-[#FAF9F7]/70">
                  <td className="py-3 px-4">
                    <Link
                      to={`/admin/merchants/${row.id}`}
                      className="font-extrabold text-[#1C1917] hover:text-[#D6450D] block"
                    >
                      {row.name}
                    </Link>
                    <span className="text-[11px] text-[#6E6A66]">{row.owner}</span>
                  </td>
                  <td className="py-3 px-4 font-bold text-[#1C1917]">
                    {formatNumber(row.deliveredOrders, language)} /{' '}
                    <span className="text-[#6E6A66]">{formatNumber(row.totalOrders, language)}</span>
                  </td>
                  <td className="py-3 px-4 font-extrabold text-[#1C1917]">
                    {formatEGP(row.grossSales, language)}
                  </td>
                  <td className="py-3 px-4 font-bold text-[#6E6A66]">{row.commissionRate}%</td>
                  <td className="py-3 px-4 font-extrabold text-emerald-700">
                    {formatEGP(row.commissionEarned, language)}
                  </td>
                  <td className="py-3 px-4 font-extrabold text-[#D6450D]">
                    {formatEGP(row.merchantNet, language)}
                  </td>
                  <td className="py-3 px-4 font-medium text-[#6E6A66]">
                    {formatEGP(row.deliveryFees, language)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

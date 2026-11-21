import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Banknote,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Clock,
  Percent,
  ShoppingBag,
  Store,
  Users,
  XCircle,
} from 'lucide-react';
import {
  Area,
  AreaChart,
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
import { SafeImage } from '../../components/common/SafeImage';
import type { DateFilterState, DateRangePreset } from '../../types';

export const AdminOverviewPage: React.FC = () => {
  const {
    language,
    t,
    customers,
    merchants,
    orders,
    areas,
    setMerchantStatus,
  } = useApp();

  const [preset, setPreset] = useState<DateRangePreset>('30d');
  const [customFrom, setCustomFrom] = useState('2026-10-01');
  const [customTo, setCustomTo] = useState('2026-11-20');

  const filterState: DateFilterState = useMemo(
    () => ({ preset, customStart: customFrom, customEnd: customTo }),
    [preset, customFrom, customTo]
  );

  const windowRange = useMemo(() => getDateWindow(filterState), [filterState]);

  const windowOrders = useMemo(
    () => filterOrdersByWindow(orders, windowRange.start, windowRange.end),
    [orders, windowRange.start, windowRange.end]
  );

  const approvedMerchants = merchants.filter((m) => m.status === 'approved');
  const pendingMerchants = merchants.filter((m) => m.status === 'pending');

  const deliveredOrders = useMemo(
    () => windowOrders.filter((o) => o.status === 'delivered'),
    [windowOrders]
  );
  const cancelledOrders = useMemo(
    () => windowOrders.filter((o) => o.status === 'cancelled'),
    [windowOrders]
  );

  const gmv = deliveredOrders.reduce((s, o) => s + o.total, 0);
  const platformRevenue = deliveredOrders.reduce((s, o) => s + o.platformCommission, 0);
  const aov = deliveredOrders.length > 0 ? Math.round(gmv / deliveredOrders.length) : 0;

  const metrics = [
    {
      label: t('إجمالي العملاء', 'Total Customers'),
      value: formatNumber(customers.length, language),
      icon: Users,
      tone: 'bg-sky-50 text-sky-700',
    },
    {
      label: t('إجمالي التجار', 'Total Merchants'),
      value: formatNumber(merchants.length, language),
      icon: Store,
      tone: 'bg-[#FFF2EB] text-[#D6450D]',
    },
    {
      label: t('المتاجر النشطة', 'Active Stores'),
      value: formatNumber(approvedMerchants.filter((m) => m.isOpen).length, language),
      icon: CheckCircle2,
      tone: 'bg-emerald-50 text-emerald-700',
    },
    {
      label: t('بانتظار الموافقة', 'Pending Approvals'),
      value: formatNumber(pendingMerchants.length, language),
      icon: Clock,
      tone: 'bg-amber-50 text-amber-700',
    },
    {
      label: t('طلبات الفترة', 'Orders in Period'),
      value: formatNumber(windowOrders.length, language),
      icon: ClipboardList,
      tone: 'bg-indigo-50 text-indigo-700',
    },
    {
      label: t('الطلبات المكتملة', 'Completed Orders'),
      value: formatNumber(deliveredOrders.length, language),
      icon: CheckCircle2,
      tone: 'bg-emerald-50 text-emerald-700',
    },
    {
      label: t('الطلبات الملغاة', 'Cancelled Orders'),
      value: formatNumber(cancelledOrders.length, language),
      icon: XCircle,
      tone: 'bg-rose-50 text-rose-700',
    },
    {
      label: t('حجم المبيعات (GMV)', 'GMV (Delivered)'),
      value: formatEGP(gmv, language),
      icon: Banknote,
      tone: 'bg-[#FFF2EB] text-[#D6450D]',
    },
    {
      label: t('إيرادات العمولات', 'Platform Revenue'),
      value: formatEGP(platformRevenue, language),
      icon: Percent,
      tone: 'bg-emerald-50 text-emerald-700',
    },
    {
      label: t('متوسط قيمة الطلب (AOV)', 'Average Order Value'),
      value: formatEGP(aov, language),
      icon: ShoppingBag,
      tone: 'bg-slate-100 text-slate-700',
    },
  ];

  const granularity = preset === 'today' || preset === '7d' || preset === '30d' ? 'daily' : 'monthly';
  const orderTimeSeries = useMemo(
    () => buildTimeSeriesFromOrders(windowOrders, granularity, language),
    [windowOrders, granularity, language]
  );

  const areaPerformance = useMemo(
    () =>
      areas.map((area) => {
        const areaDelivered = deliveredOrders.filter((o) => o.areaId === area.id);
        return {
          name: language === 'ar' ? area.nameAr : area.nameEn,
          gmv: Math.round(areaDelivered.reduce((s, o) => s + o.total, 0)),
        };
      }),
    [areas, deliveredOrders, language]
  );

  const merchantGrowth = useMemo(() => {
    const counts = new Map<string, number>();
    merchants.forEach((m) => {
      const monthKey = m.createdAt.slice(0, 7);
      counts.set(monthKey, (counts.get(monthKey) ?? 0) + 1);
    });
    const sortedKeys = Array.from(counts.keys()).sort();
    return sortedKeys.map((k, idx) => {
      const cumulative = sortedKeys
        .slice(0, idx + 1)
        .reduce((acc, key) => acc + (counts.get(key) ?? 0), 0);
      const d = new Date(`${k}-01T12:00:00Z`);
      const label = d.toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', { month: 'short' });
      return { month: label, merchants: cumulative };
    });
  }, [merchants, language]);

  const customerGrowth = useMemo(() => {
    const counts = new Map<string, number>();
    customers.forEach((c) => {
      const monthKey = c.joinedAt.slice(0, 7);
      counts.set(monthKey, (counts.get(monthKey) ?? 0) + 1);
    });
    const sortedKeys = Array.from(counts.keys()).sort();
    return sortedKeys.map((k, idx) => {
      const cumulative = sortedKeys
        .slice(0, idx + 1)
        .reduce((acc, key) => acc + (counts.get(key) ?? 0), 0);
      const d = new Date(`${k}-01T12:00:00Z`);
      const label = d.toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', { month: 'short' });
      return { month: label, customers: cumulative };
    });
  }, [customers, language]);

  const presets = getPresetOptions(language);

  return (
    <div className="space-y-6">
      {/* Header + Date Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#1C1917]">
            {t('نظرة عامة على المنصة', 'Platform Overview')}
          </h1>
          <p className="text-xs text-[#6E6A66]">
            {t(
              'مؤشرات حية لحجم المبيعات والعمولات ونمو التجار والعملاء',
              'Live metrics calculated directly from marketplace orders, merchants, and customers'
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

      {/* 10 KPIs Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {metrics.map((m) => {
          const Icon = m.icon;
          return (
            <div
              key={m.label}
              className="bg-white rounded-2xl border border-[#EAE6E1] p-4 shadow-2xs flex flex-col justify-between gap-2.5"
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${m.tone}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[11px] text-[#6E6A66] block">{m.label}</span>
                <span className="text-lg font-extrabold text-[#1C1917]">{m.value}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pending Approvals Callout */}
      {pendingMerchants.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-extrabold text-amber-900">
                {t('طلبات انضمام تجار جديدة بانتظار المراجعة', 'Pending Merchant Approvals')} (
                {pendingMerchants.length})
              </h2>
              <p className="text-xs text-amber-800">
                {t('راجع بيانات المحل ووافق عليه ليظهر فوراً للعملاء', 'Review and approve stores so they go live')}
              </p>
            </div>
            <Link to="/admin/merchants" className="text-xs font-bold text-[#D6450D] hover:underline">
              {t('عرض الكل', 'View all')}
            </Link>
          </div>
          <div className="space-y-2">
            {pendingMerchants.map((m) => (
              <div
                key={m.id}
                className="bg-white rounded-xl border border-amber-200 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <SafeImage
                    src={m.logo}
                    alt={m.nameAr}
                    className="w-10 h-10 rounded-xl object-cover border border-[#EAE6E1]"
                  />
                  <div>
                    <Link
                      to={`/admin/merchants/${m.id}`}
                      className="text-sm font-bold text-[#1C1917] hover:text-[#D6450D]"
                    >
                      {language === 'ar' ? m.nameAr : m.nameEn}
                    </Link>
                    <p className="text-[11px] text-[#6E6A66]">
                      {language === 'ar' ? m.addressAr : m.addressEn}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setMerchantStatus(m.id, 'approved')}
                    className="px-3.5 py-1.5 rounded-lg bg-[#D6450D] text-white text-xs font-bold hover:bg-[#B33808]"
                  >
                    {t('موافقة وتفعيل', 'Approve')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMerchantStatus(m.id, 'rejected')}
                    className="px-3.5 py-1.5 rounded-lg border border-rose-200 text-rose-600 text-xs font-bold hover:bg-rose-50"
                  >
                    {t('رفض', 'Reject')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6 Dynamic Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl border border-[#EAE6E1] p-5 shadow-2xs">
          <h3 className="text-sm font-extrabold text-[#1C1917] mb-4">
            {t('حجم المبيعات المحققة (GMV)', 'GMV Over Time (Delivered EGP)')}
          </h3>
          <div className="h-56" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={orderTimeSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EAE6E1" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6E6A66' }} />
                <YAxis tick={{ fontSize: 11, fill: '#6E6A66' }} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="sales"
                  name={t('GMV (جنيه)', 'GMV (EGP)')}
                  stroke="#D6450D"
                  fill="#FFF2EB"
                  strokeWidth={2.5}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#EAE6E1] p-5 shadow-2xs">
          <h3 className="text-sm font-extrabold text-[#1C1917] mb-4">
            {t('إيرادات العمولات بمرور الوقت', 'Commission Revenue Over Time')}
          </h3>
          <div className="h-56" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={orderTimeSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EAE6E1" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6E6A66' }} />
                <YAxis tick={{ fontSize: 11, fill: '#6E6A66' }} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="commission"
                  name={t('العمولات (جنيه)', 'Commission (EGP)')}
                  stroke="#10B981"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#EAE6E1] p-5 shadow-2xs">
          <h3 className="text-sm font-extrabold text-[#1C1917] mb-4">
            {t('عدد الطلبات بمرور الوقت', 'Orders Over Time')}
          </h3>
          <div className="h-56" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={orderTimeSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EAE6E1" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6E6A66' }} />
                <YAxis tick={{ fontSize: 11, fill: '#6E6A66' }} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="orders"
                  name={t('الطلبات', 'Orders')}
                  stroke="#0284C7"
                  fill="#E0F2FE"
                  strokeWidth={2.5}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#EAE6E1] p-5 shadow-2xs">
          <h3 className="text-sm font-extrabold text-[#1C1917] mb-4">
            {t('المبيعات حسب المنطقة الجغرافية (جنيه)', 'Sales by Geographic Area (EGP)')}
          </h3>
          <div className="h-56" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={areaPerformance}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EAE6E1" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#6E6A66' }} />
                <YAxis tick={{ fontSize: 11, fill: '#6E6A66' }} />
                <Tooltip />
                <Bar dataKey="gmv" name={t('المبيعات', 'GMV')} fill="#D6450D" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#EAE6E1] p-5 shadow-2xs">
          <h3 className="text-sm font-extrabold text-[#1C1917] mb-4">
            {t('نمو عدد التجار على المنصة', 'Merchant Growth Over Time')}
          </h3>
          <div className="h-56" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={merchantGrowth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EAE6E1" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#6E6A66' }} />
                <YAxis tick={{ fontSize: 11, fill: '#6E6A66' }} />
                <Tooltip />
                <Bar
                  dataKey="merchants"
                  name={t('إجمالي التجار', 'Cumulative Merchants')}
                  fill="#F47B20"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#EAE6E1] p-5 shadow-2xs">
          <h3 className="text-sm font-extrabold text-[#1C1917] mb-4">
            {t('نمو قاعدة العملاء', 'Customer Growth Over Time')}
          </h3>
          <div className="h-56" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={customerGrowth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EAE6E1" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#6E6A66' }} />
                <YAxis tick={{ fontSize: 11, fill: '#6E6A66' }} />
                <Tooltip />
                <Bar
                  dataKey="customers"
                  name={t('إجمالي العملاء', 'Cumulative Customers')}
                  fill="#1C1917"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

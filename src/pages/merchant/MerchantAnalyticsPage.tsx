import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Layers,
  Package,
  ShoppingBag,
  TrendingDown,
  TrendingUp,
  Users,
  XCircle,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useApp } from '../../context/AppContext';
import {
  buildTimeSeriesFromOrders,
  calcGrowthPct,
  filterOrdersByWindow,
  getDateWindow,
  getPresetOptions,
} from '../../services/analyticsService';
import { formatEGP, formatNumber } from '../../utils/i18n';
import type { DateFilterState, DateRangePreset } from '../../types';

const STATUS_COLORS: Record<string, string> = {
  pending: '#F59E0B',
  accepted: '#0284C7',
  preparing: '#7C3AED',
  out_for_delivery: '#D6450D',
  delivered: '#10B981',
  cancelled: '#E11D48',
};

export const MerchantAnalyticsPage: React.FC = () => {
  const { language, t, activeMerchant, orders, products, categories } = useApp();

  const [preset, setPreset] = useState<DateRangePreset>('30d');
  const [customFrom, setCustomFrom] = useState('2026-10-01');
  const [customTo, setCustomTo] = useState('2026-11-20');
  const [granularity, setGranularity] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  const filterState: DateFilterState = useMemo(
    () => ({ preset, customStart: customFrom, customEnd: customTo }),
    [preset, customFrom, customTo]
  );

  const dateWindow = useMemo(() => getDateWindow(filterState), [filterState]);

  const storeOrders = useMemo(
    () => orders.filter((o) => o.merchantId === activeMerchant.id),
    [orders, activeMerchant.id]
  );

  const storeProducts = useMemo(
    () => products.filter((p) => p.merchantId === activeMerchant.id),
    [products, activeMerchant.id]
  );

  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const productMap = useMemo(() => new Map(storeProducts.map((p) => [p.id, p])), [storeProducts]);

  const currentOrders = useMemo(
    () => filterOrdersByWindow(storeOrders, dateWindow.start, dateWindow.end),
    [storeOrders, dateWindow.start, dateWindow.end]
  );

  const prevOrders = useMemo(
    () => filterOrdersByWindow(storeOrders, dateWindow.prevStart, dateWindow.prevEnd),
    [storeOrders, dateWindow.prevStart, dateWindow.prevEnd]
  );

  const metrics = useMemo(() => {
    const delivered = currentOrders.filter((o) => o.status === 'delivered');
    const cancelled = currentOrders.filter((o) => o.status === 'cancelled');
    const prevDelivered = prevOrders.filter((o) => o.status === 'delivered');

    const grossSales = delivered.reduce((s, o) => s + o.total, 0);
    const productSubtotal = delivered.reduce((s, o) => s + o.subtotal, 0);
    const deliveryFees = delivered.reduce((s, o) => s + o.deliveryFee, 0);
    const platformCommission = delivered.reduce((s, o) => s + o.platformCommission, 0);
    const netStoreSales = Math.max(0, grossSales - platformCommission);

    const prevGrossSales = prevDelivered.reduce((s, o) => s + o.total, 0);
    const prevNetSales = prevDelivered.reduce(
      (s, o) => s + Math.max(0, o.total - o.platformCommission),
      0
    );

    const itemsSold = delivered.reduce(
      (s, o) => s + o.items.reduce((is, item) => is + item.quantity, 0),
      0
    );
    const aov = delivered.length > 0 ? Math.round(grossSales / delivered.length) : 0;
    const prevAov =
      prevDelivered.length > 0 ? Math.round(prevGrossSales / prevDelivered.length) : 0;

    return {
      grossSales,
      productSubtotal,
      deliveryFees,
      platformCommission,
      netStoreSales,
      totalOrders: currentOrders.length,
      completedCount: delivered.length,
      cancelledCount: cancelled.length,
      itemsSold,
      aov,
      salesGrowth: preset === 'all' ? null : calcGrowthPct(grossSales, prevGrossSales),
      netGrowth: preset === 'all' ? null : calcGrowthPct(netStoreSales, prevNetSales),
      ordersGrowth: preset === 'all' ? null : calcGrowthPct(currentOrders.length, prevOrders.length),
      aovGrowth: preset === 'all' ? null : calcGrowthPct(aov, prevAov),
    };
  }, [currentOrders, prevOrders, preset]);

  const timeSeries = useMemo(
    () => buildTimeSeriesFromOrders(currentOrders, granularity, language),
    [currentOrders, granularity, language]
  );

  const statusDistribution = useMemo(() => {
    const labels: Record<string, string> = {
      pending: t('جديد', 'New'),
      accepted: t('مقبول', 'Accepted'),
      preparing: t('تجهيز', 'Preparing'),
      out_for_delivery: t('في الطريق', 'Courier'),
      delivered: t('مكتمل', 'Delivered'),
      cancelled: t('ملغي', 'Cancelled'),
    };
    const counts: Record<string, number> = {};
    currentOrders.forEach((o) => {
      counts[o.status] = (counts[o.status] ?? 0) + 1;
    });
    return Object.entries(counts).map(([status, value]) => ({
      status,
      name: labels[status] ?? status,
      value,
      color: STATUS_COLORS[status] ?? '#D6450D',
    }));
  }, [currentOrders, t]);

  const productInsights = useMemo(() => {
    const delivered = currentOrders.filter((o) => o.status === 'delivered');
    const prevDelivered = prevOrders.filter((o) => o.status === 'delivered');

    const agg = new Map<
      string,
      { id: string; name: string; sold: number; revenue: number; stock: number }
    >();

    storeProducts.forEach((p) => {
      agg.set(p.id, {
        id: p.id,
        name: language === 'ar' ? p.nameAr : p.nameEn,
        sold: 0,
        revenue: 0,
        stock: p.stock,
      });
    });

    delivered.forEach((o) => {
      o.items.forEach((item) => {
        const current = agg.get(item.productId) ?? {
          id: item.productId,
          name: language === 'ar' ? item.nameAr : item.nameEn,
          sold: 0,
          revenue: 0,
          stock: productMap.get(item.productId)?.stock ?? 0,
        };
        current.sold += item.quantity;
        current.revenue += item.unitPrice * item.quantity;
        agg.set(item.productId, current);
      });
    });

    const prevSoldMap = new Map<string, number>();
    prevDelivered.forEach((o) => {
      o.items.forEach((item) => {
        prevSoldMap.set(
          item.productId,
          (prevSoldMap.get(item.productId) ?? 0) + item.quantity
        );
      });
    });

    const allRows = Array.from(agg.values());
    const topSelling = [...allRows].sort((a, b) => b.sold - a.sold).slice(0, 10);
    const topRevenue = [...allRows].sort((a, b) => b.revenue - a.revenue).slice(0, 6);
    const leastOrdered = [...allRows]
      .sort((a, b) => a.sold - b.sold)
      .slice(0, 5);

    const declining = allRows
      .map((row) => {
        const prev = prevSoldMap.get(row.id) ?? 0;
        return { ...row, prevSold: prev, delta: row.sold - prev };
      })
      .filter((r) => r.prevSold > 0 && r.sold < r.prevSold)
      .sort((a, b) => a.delta - b.delta)
      .slice(0, 5);

    const categorySalesMap = new Map<string, { name: string; revenue: number; sold: number }>();
    delivered.forEach((o) => {
      o.items.forEach((item) => {
        const prod = productMap.get(item.productId);
        const catId = prod?.categoryId ?? 'other';
        const cat = categoryMap.get(catId);
        const catName = cat
          ? language === 'ar'
            ? cat.nameAr
            : cat.nameEn
          : t('أخرى', 'Other');
        const prev = categorySalesMap.get(catId) ?? { name: catName, revenue: 0, sold: 0 };
        prev.revenue += item.unitPrice * item.quantity;
        prev.sold += item.quantity;
        categorySalesMap.set(catId, prev);
      });
    });

    const topCategories = Array.from(categorySalesMap.values()).sort(
      (a, b) => b.revenue - a.revenue
    );

    const fastMoving = allRows
      .filter((r) => r.sold >= 3)
      .sort((a, b) => b.sold - a.sold)
      .slice(0, 5);

    return {
      topSelling,
      topRevenue,
      leastOrdered,
      declining,
      topCategories,
      fastMoving,
    };
  }, [currentOrders, prevOrders, storeProducts, productMap, categoryMap, language, t]);

  const inventoryInsights = useMemo(() => {
    const outOfStock = storeProducts.filter((p) => p.stock === 0);
    const lowStock = storeProducts.filter((p) => p.stock > 0 && p.stock <= 5);
    return { outOfStock, lowStock };
  }, [storeProducts]);

  const customerInsights = useMemo(() => {
    const lifetimeCountMap = new Map<string, number>();
    storeOrders.forEach((o) => {
      lifetimeCountMap.set(o.customerId, (lifetimeCountMap.get(o.customerId) ?? 0) + 1);
    });

    const periodCustomers = new Map<
      string,
      { id: string; name: string; orders: number; spend: number }
    >();
    currentOrders.forEach((o) => {
      const prev = periodCustomers.get(o.customerId) ?? {
        id: o.customerId,
        name: o.customerName,
        orders: 0,
        spend: 0,
      };
      prev.orders += 1;
      if (o.status === 'delivered') prev.spend += o.total;
      periodCustomers.set(o.customerId, prev);
    });

    const list = Array.from(periodCustomers.values());
    const returningCount = list.filter((c) => (lifetimeCountMap.get(c.id) ?? 0) >= 2).length;
    const mostFrequent = [...list].sort((a, b) => b.orders - a.orders).slice(0, 5);
    const avgOrdersPerCustomer =
      list.length > 0 ? Number((currentOrders.length / list.length).toFixed(1)) : 0;

    return {
      totalCustomers: list.length,
      returningCount,
      mostFrequent,
      avgOrdersPerCustomer,
    };
  }, [storeOrders, currentOrders]);

  const presets = getPresetOptions(language);

  const renderGrowth = (val: number | null) => {
    if (val === null) return null;
    const up = val >= 0;
    return (
      <span
        className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
          up ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
        }`}
      >
        {up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
        {Math.abs(val)}%
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header & Date Filter Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#1C1917]">
            {t('التحليلات المتقدمة وأداء المتجر', 'Merchant Analytics & Insights')}
          </h1>
          <p className="text-xs text-[#6E6A66]">
            {t(
              'تقارير حية للمبيعات المحققة، العمولات، المخزون، وسلوك العملاء',
              'Live reports for realized sales, commissions, inventory velocity, and customer behavior'
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

      {/* Primary KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
        {[
          {
            label: t('إجمالي المبيعات (مكتملة)', 'Realized Gross Sales'),
            value: formatEGP(metrics.grossSales, language),
            growth: metrics.salesGrowth,
            icon: Banknote,
          },
          {
            label: t('صافي مبيعات المحل', 'Net Store Sales'),
            value: formatEGP(metrics.netStoreSales, language),
            growth: metrics.netGrowth,
            icon: TrendingUp,
          },
          {
            label: t('إجمالي الطلبات', 'Total Orders'),
            value: formatNumber(metrics.totalOrders, language),
            growth: metrics.ordersGrowth,
            icon: ClipboardList,
          },
          {
            label: t('متوسط قيمة الطلب (AOV)', 'Average Order Value'),
            value: formatEGP(metrics.aov, language),
            growth: metrics.aovGrowth,
            icon: ShoppingBag,
          },
          {
            label: t('المنتجات المباعة', 'Items Sold'),
            value: formatNumber(metrics.itemsSold, language),
            growth: null,
            icon: Package,
          },
          {
            label: t('مكتمل / ملغي', 'Completed / Cancelled'),
            value: `${formatNumber(metrics.completedCount, language)} / ${formatNumber(metrics.cancelledCount, language)}`,
            growth: null,
            icon: CheckCircle2,
          },
        ].map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.label}
              className="bg-white rounded-2xl border border-[#EAE6E1] p-4 shadow-2xs flex flex-col justify-between gap-2.5"
            >
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl bg-[#FFF2EB] text-[#D6450D] flex items-center justify-center">
                  <Icon className="w-4 h-4" />
                </div>
                {renderGrowth(kpi.growth)}
              </div>
              <div>
                <div className="text-[11px] text-[#6E6A66] font-medium">{kpi.label}</div>
                <div className="text-lg font-extrabold text-[#1C1917] mt-0.5">{kpi.value}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Clear Financial Breakdown Strip */}
      <div className="bg-white rounded-2xl border border-[#EAE6E1] p-5 shadow-2xs">
        <h3 className="text-sm font-extrabold text-[#1C1917] mb-3">
          {t('التفصيل المالي للطلبات المكتملة', 'Financial Breakdown (Delivered Orders Only)')}
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] p-3">
            <div className="text-[#6E6A66]">{t('قيمة البضائع (Subtotal)', 'Products Subtotal')}</div>
            <div className="text-base font-extrabold text-[#1C1917] mt-1">
              {formatEGP(metrics.productSubtotal, language)}
            </div>
          </div>
          <div className="rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] p-3">
            <div className="text-[#6E6A66]">{t('رسوم التوصيل المحصلة', 'Delivery Fees Collected')}</div>
            <div className="text-base font-extrabold text-[#1C1917] mt-1">
              {formatEGP(metrics.deliveryFees, language)}
            </div>
          </div>
          <div className="rounded-xl bg-rose-50/70 border border-rose-200 p-3">
            <div className="text-rose-700">{t(`عمولة المنصة (${activeMerchant.commissionRate}%)`, `Platform Commission (${activeMerchant.commissionRate}%)`)}</div>
            <div className="text-base font-extrabold text-rose-700 mt-1">
              - {formatEGP(metrics.platformCommission, language)}
            </div>
          </div>
          <div className="rounded-xl bg-[#FFF2EB] border border-[#FBD8C5] p-3">
            <div className="text-[#D6450D] font-bold">{t('صافي المستحق للمحل', 'Net Merchant Earnings')}</div>
            <div className="text-base font-extrabold text-[#D6450D] mt-1">
              {formatEGP(metrics.netStoreSales, language)}
            </div>
          </div>
        </div>
      </div>

      {/* Revenue Over Time + Order Status Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-8 bg-white rounded-2xl border border-[#EAE6E1] p-5 shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="text-sm font-extrabold text-[#1C1917] flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#D6450D]" />
                <span>{t('منحنى المبيعات والطلبات', 'Revenue & Orders Over Time')}</span>
              </h3>
              <p className="text-xs text-[#6E6A66]">
                {t('يومي / أسبوعي / شهري حسب الفترة المختارة', 'Daily / Weekly / Monthly breakdown')}
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

          {timeSeries.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-xs text-[#6E6A66]">
              {t('لا توجد بيانات في الفترة المحددة', 'No orders in selected period')}
            </div>
          ) : (
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
                    name={t('المبيعات (جنيه)', 'Delivered Sales (EGP)')}
                    stroke="#D6450D"
                    strokeWidth={3}
                    dot={{ r: 3.5, fill: '#D6450D' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="orders"
                    name={t('عدد الطلبات', 'Orders Count')}
                    stroke="#1C1917"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="lg:col-span-4 bg-white rounded-2xl border border-[#EAE6E1] p-5 shadow-2xs">
          <h3 className="text-sm font-extrabold text-[#1C1917] mb-1">
            {t('توزيع حالات الطلبات', 'Order Status Breakdown')}
          </h3>
          <p className="text-xs text-[#6E6A66] mb-3">
            {t('نسبة الإتمام والإلغاء خلال الفترة', 'Completion vs cancellation ratio')}
          </p>
          {statusDistribution.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-xs text-[#6E6A66]">
              {t('لا توجد طلبات', 'No orders')}
            </div>
          ) : (
            <>
              <div className="h-48" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusDistribution}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={42}
                      outerRadius={72}
                      paddingAngle={2}
                    >
                      {statusDistribution.map((entry) => (
                        <Cell key={entry.status} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-[11px] mt-2">
                {statusDistribution.map((s) => (
                  <div key={s.status} className="flex items-center justify-between bg-[#FAF9F7] px-2.5 py-1 rounded-lg">
                    <span className="flex items-center gap-1.5 font-bold text-[#1C1917]">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                      {s.name}
                    </span>
                    <span className="font-extrabold">{s.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Product Performance: Top 10 & Most Profitable & Categories */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 bg-white rounded-2xl border border-[#EAE6E1] p-5 shadow-2xs">
          <h3 className="text-sm font-extrabold text-[#1C1917] mb-1">
            {t('أكثر 10 منتجات مبيعاً (بالكمية)', 'Top 10 Best-Selling Products')}
          </h3>
          <p className="text-xs text-[#6E6A66] mb-3">
            {t('المنتجات الأعلى طلباً من الطلبات المكتملة', 'Highest unit volume from delivered orders')}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead className="bg-[#FAF9F7] text-[#6E6A66]">
                <tr>
                  <th className="py-2.5 px-3 text-start">#</th>
                  <th className="py-2.5 px-3 text-start">{t('المنتج', 'Product')}</th>
                  <th className="py-2.5 px-3 text-start">{t('الكمية', 'Units')}</th>
                  <th className="py-2.5 px-3 text-start">{t('الإيرادات', 'Revenue')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAE6E1]">
                {productInsights.topSelling.map((item, idx) => (
                  <tr key={item.id}>
                    <td className="py-2 px-3 font-bold text-[#6E6A66]">{idx + 1}</td>
                    <td className="py-2 px-3 font-bold text-[#1C1917]">{item.name}</td>
                    <td className="py-2 px-3 font-extrabold text-[#1C1917]">
                      {formatNumber(item.sold, language)}
                    </td>
                    <td className="py-2 px-3 font-extrabold text-[#D6450D]">
                      {formatEGP(item.revenue, language)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="lg:col-span-5 space-y-5">
          <div className="bg-white rounded-2xl border border-[#EAE6E1] p-5 shadow-2xs">
            <h3 className="text-sm font-extrabold text-[#1C1917] mb-3 flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#D6450D]" />
              <span>{t('أداء التصنيفات في متجرك', 'Best-Performing Categories')}</span>
            </h3>
            {productInsights.topCategories.length === 0 ? (
              <p className="text-xs text-[#6E6A66]">{t('لا توجد مبيعات كافية', 'No sales data yet')}</p>
            ) : (
              <div className="h-44" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={productInsights.topCategories.slice(0, 5)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EAE6E1" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#6E6A66' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#6E6A66' }} />
                    <Tooltip />
                    <Bar
                      dataKey="revenue"
                      name={t('الإيرادات', 'Revenue')}
                      fill="#D6450D"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-[#EAE6E1] p-5 shadow-2xs space-y-2.5">
            <h3 className="text-sm font-extrabold text-[#1C1917]">
              {t('المنتجات الأقل طلباً / تراجعاً', 'Least Ordered & Declining Demand')}
            </h3>
            {productInsights.declining.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[11px] font-bold text-amber-700 flex items-center gap-1">
                  <TrendingDown className="w-3.5 h-3.5" />
                  <span>{t('منتجات انخفض طلبها مقارنة بالفترة السابقة:', 'Declining vs previous period:')}</span>
                </div>
                {productInsights.declining.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center justify-between text-xs bg-amber-50/60 border border-amber-200 rounded-xl px-3 py-1.5"
                  >
                    <span className="font-bold text-[#1C1917] truncate">{d.name}</span>
                    <span className="text-amber-800 font-bold shrink-0">
                      {d.prevSold} ← {d.sold}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="space-y-1.5 pt-1">
              <div className="text-[11px] font-bold text-[#6E6A66]">
                {t('الأقل مبيعاً في الكتالوج:', 'Least ordered catalog items:')}
              </div>
              {productInsights.leastOrdered.slice(0, 3).map((l) => (
                <div
                  key={l.id}
                  className="flex items-center justify-between text-xs bg-[#FAF9F7] border border-[#EAE6E1] rounded-xl px-3 py-1.5"
                >
                  <span className="font-medium text-[#1C1917] truncate">{l.name}</span>
                  <span className="text-[#6E6A66] font-bold shrink-0">
                    {formatNumber(l.sold, language)} {t('مبيعاً', 'sold')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Inventory Insights & Customer Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl border border-[#EAE6E1] p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-[#1C1917] flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span>{t('تحليلات المخزون وحركة السحب', 'Inventory & Velocity Insights')}</span>
            </h3>
          </div>

          <div className="grid grid-cols-3 gap-2.5 text-xs text-center">
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3">
              <div className="text-amber-700 font-bold">{t('قارب على النفاد', 'Low Stock')}</div>
              <div className="text-lg font-extrabold text-amber-900 mt-0.5">
                {inventoryInsights.lowStock.length}
              </div>
            </div>
            <div className="rounded-xl bg-rose-50 border border-rose-200 p-3">
              <div className="text-rose-700 font-bold flex items-center justify-center gap-1">
                <XCircle className="w-3.5 h-3.5" />
                <span>{t('نفد المخزون', 'Out of Stock')}</span>
              </div>
              <div className="text-lg font-extrabold text-rose-900 mt-0.5">
                {inventoryInsights.outOfStock.length}
              </div>
            </div>
            <div className="rounded-xl bg-[#FFF2EB] border border-[#FBD8C5] p-3">
              <div className="text-[#D6450D] font-bold">{t('سريع الحركة', 'Fast-Moving')}</div>
              <div className="text-lg font-extrabold text-[#D6450D] mt-0.5">
                {productInsights.fastMoving.length}
              </div>
            </div>
          </div>

          {productInsights.fastMoving.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[11px] font-bold text-[#6E6A66]">
                {t('أصناف سريعة الدوران (راقب مخزونها باستمرار):', 'Fast-moving items (monitor stock closely):')}
              </div>
              {productInsights.fastMoving.map((fm) => (
                <div
                  key={fm.id}
                  className="flex items-center justify-between text-xs bg-[#FAF9F7] border border-[#EAE6E1] rounded-xl px-3 py-2"
                >
                  <span className="font-bold text-[#1C1917]">{fm.name}</span>
                  <span className="text-[#6E6A66]">
                    {t('مباع:', 'Sold:')} <strong className="text-[#D6450D]">{fm.sold}</strong> •{' '}
                    {t('المتاح:', 'Stock:')} <strong>{fm.stock}</strong>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-[#EAE6E1] p-5 shadow-2xs space-y-4">
          <h3 className="text-sm font-extrabold text-[#1C1917] flex items-center gap-2">
            <Users className="w-4 h-4 text-[#D6450D]" />
            <span>{t('تحليلات عملاء المتجر', 'Customer Insights')}</span>
          </h3>

          <div className="grid grid-cols-3 gap-2.5 text-xs text-center">
            <div className="rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] p-3">
              <div className="text-[#6E6A66]">{t('إجمالي العملاء', 'Active Customers')}</div>
              <div className="text-lg font-extrabold text-[#1C1917] mt-0.5">
                {customerInsights.totalCustomers}
              </div>
            </div>
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3">
              <div className="text-emerald-700 font-bold">{t('عملاء متكررون', 'Returning')}</div>
              <div className="text-lg font-extrabold text-emerald-900 mt-0.5">
                {customerInsights.returningCount}
              </div>
            </div>
            <div className="rounded-xl bg-[#FFF2EB] border border-[#FBD8C5] p-3">
              <div className="text-[#D6450D] font-bold">{t('متوسط الطلبات/عميل', 'Avg Orders/Cust')}</div>
              <div className="text-lg font-extrabold text-[#D6450D] mt-0.5">
                {customerInsights.avgOrdersPerCustomer}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="text-[11px] font-bold text-[#6E6A66]">
              {t('العملاء الأكثر طلباً خلال الفترة:', 'Most frequent customers in period:')}
            </div>
            {customerInsights.mostFrequent.length === 0 ? (
              <p className="text-xs text-[#6E6A66]">{t('لا توجد بيانات', 'No customer orders')}</p>
            ) : (
              customerInsights.mostFrequent.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between text-xs bg-[#FAF9F7] border border-[#EAE6E1] rounded-xl px-3 py-2"
                >
                  <span className="font-bold text-[#1C1917]">{c.name}</span>
                  <span className="text-[#6E6A66]">
                    <strong className="text-[#1C1917]">{c.orders}</strong> {t('طلبات', 'orders')} •{' '}
                    <strong className="text-[#D6450D]">{formatEGP(c.spend, language)}</strong>
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

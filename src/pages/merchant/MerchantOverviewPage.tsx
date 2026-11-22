import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  ClipboardList,
  Clock,
  Package,
  Plus,
  Power,
  TrendingUp,
  Truck,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
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
} from '../../services/analyticsService';
import {
  formatDateTime,
  formatEGP,
  formatNumber,
  getOrderStatusMeta,
} from '../../utils/i18n';

export const MerchantOverviewPage: React.FC = () => {
  const {
    language,
    t,
    activeMerchant,
    authSession,
    toggleMerchantOpen,
    orders,
    products,
    updateOrderStatus,
  } = useApp();

  const storeOrders = useMemo(
    () =>
      orders
        .filter((o) => o.merchantId === activeMerchant.id)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [orders, activeMerchant.id]
  );

  const storeProducts = useMemo(
    () => products.filter((p) => p.merchantId === activeMerchant.id),
    [products, activeMerchant.id]
  );

  const todayOrders = useMemo(() => {
    const win = getDateWindow({ preset: 'today', customStart: '', customEnd: '' });
    return filterOrdersByWindow(storeOrders, win.start, win.end);
  }, [storeOrders]);

  const last7DaysOrders = useMemo(() => {
    const win = getDateWindow({ preset: '7d', customStart: '', customEnd: '' });
    return filterOrdersByWindow(storeOrders, win.start, win.end);
  }, [storeOrders]);

  const pendingOrders = storeOrders.filter((o) => o.status === 'pending');
  const completedOrders = storeOrders.filter((o) => o.status === 'delivered');
  const lowStockProducts = storeProducts.filter((p) => p.stock <= 5);

  const todaySales = todayOrders
    .filter((o) => o.status === 'delivered')
    .reduce((sum, o) => sum + o.total, 0);

  const weeklySeries = useMemo(
    () => buildTimeSeriesFromOrders(last7DaysOrders, 'daily', language),
    [last7DaysOrders, language]
  );

  const topProductsChart = useMemo(() => {
    const productSalesMap = new Map<string, { name: string; sold: number }>();
    storeOrders
      .filter((o) => o.status === 'delivered')
      .forEach((o) => {
        o.items.forEach((item) => {
          const prev = productSalesMap.get(item.productId);
          const fullName = language === 'ar' ? item.nameAr : item.nameEn;
          productSalesMap.set(item.productId, {
            name: fullName.slice(0, 22),
            sold: (prev?.sold ?? 0) + item.quantity,
          });
        });
      });

    return Array.from(productSalesMap.values())
      .sort((a, b) => b.sold - a.sold)
      .slice(0, 6);
  }, [storeOrders, language]);

  const ownerDisplayName =
    language === 'ar'
      ? (activeMerchant.ownerNameAr ?? authSession?.nameAr ?? 'أحمد').split(' ')[0]
      : (activeMerchant.ownerNameEn ?? authSession?.nameEn ?? 'Ahmed').split(' ')[0];

  return (
    <div className="space-y-6">
      {/* Merchant Welcome + Availability Banner */}
      <div
        className={`rounded-2xl border p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
          activeMerchant.isOpen
            ? 'bg-[#E6F5EC] border-[#C2E7D2]'
            : 'bg-rose-50 border-rose-200'
        }`}
      >
        <div className="flex items-start sm:items-center gap-3.5">
          <div
            className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
              activeMerchant.isOpen ? 'bg-[#1B8E53] text-white' : 'bg-rose-600 text-white'
            }`}
          >
            <Power className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-extrabold text-[#1B8E53]">
              {t(
                `صباح الخير يا ${ownerDisplayName}، دي نظرة سريعة على أداء محلك.`,
                `Good morning ${ownerDisplayName}, here is a quick snapshot of your store.`
              )}
            </p>
            <h2 className="text-base font-extrabold text-[#1C1917] mt-0.5">
              {activeMerchant.isOpen
                ? t('المحل مفتوح ويستقبل الطلبات الآن', 'Your store is OPEN and receiving orders')
                : t('تم إيقاف استقبال الطلبات مؤقتاً', 'Store orders are currently PAUSED')}
            </h2>
          </div>
        </div>

        <button
          type="button"
          onClick={() => toggleMerchantOpen(activeMerchant.id)}
          className={`px-5 py-2.5 rounded-xl text-xs font-extrabold text-white transition-colors shrink-0 ${
            activeMerchant.isOpen
              ? 'bg-rose-600 hover:bg-rose-700'
              : 'bg-[#1B8E53] hover:bg-[#147242]'
          }`}
        >
          {activeMerchant.isOpen
            ? t('إيقاف استقبال الطلبات', 'Pause Orders')
            : t('المحل مفتوح — تفعيل الآن', 'Open Store Now')}
        </button>
      </div>

      {/* Live Incoming Orders Pipeline Alert */}
      {pendingOrders.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 sm:p-5 space-y-3 shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
              <h3 className="text-sm sm:text-base font-extrabold text-amber-950">
                {t(
                  `طلبات جديدة بانتظار قبولك (${pendingOrders.length})`,
                  `New Incoming Orders Awaiting Acceptance (${pendingOrders.length})`
                )}
              </h3>
            </div>
            <Link
              to="/merchant/orders"
              className="text-xs font-bold text-[#1B8E53] hover:underline"
            >
              {t('فتح لوحة الطلبات ←', 'Open Orders Pipeline →')}
            </Link>
          </div>
          <div className="space-y-2">
            {pendingOrders.slice(0, 4).map((po) => (
              <div
                key={po.id}
                className="bg-white rounded-xl border border-amber-200 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="px-2.5 py-1 rounded-lg bg-[#E6F5EC] text-[#1B8E53] font-extrabold">
                    #{po.orderNumber}
                  </span>
                  <strong className="text-[#1C1917]">{po.customerName}</strong>
                  <span className="text-[#6E6A66]">
                    • {po.items.length} {t('منتجات', 'items')} •{' '}
                    <strong className="text-[#1B8E53]">{formatEGP(po.total, language)}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => updateOrderStatus(po.id, 'accepted')}
                    className="px-3.5 py-1.5 rounded-lg bg-[#1B8E53] hover:bg-[#147242] text-white text-xs font-bold"
                  >
                    {t('قبول الطلب الآن', 'Accept Order')}
                  </button>
                  <Link
                    to={`/merchant/orders/${po.id}`}
                    className="px-3 py-1.5 rounded-lg border border-[#EAE6E1] text-xs font-bold text-[#1C1917]"
                  >
                    {t('التفاصيل', 'Inspect')}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6 KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
        {[
          {
            label: t('مبيعات اليوم (مكتملة)', "Today's Delivered Sales"),
            value: formatEGP(todaySales, language),
            icon: Banknote,
            color: 'text-[#1B8E53] bg-[#E6F5EC]',
          },
          {
            label: t('طلبات اليوم', "Today's Orders"),
            value: formatNumber(todayOrders.length, language),
            icon: ClipboardList,
            color: 'text-[#1B8E53] bg-[#E6F5EC]',
          },
          {
            label: t('طلبات جديدة معلقة', 'Pending Orders'),
            value: formatNumber(pendingOrders.length, language),
            icon: Clock,
            color: 'text-amber-700 bg-amber-50',
          },
          {
            label: t('إجمالي المكتملة', 'Completed Orders'),
            value: formatNumber(completedOrders.length, language),
            icon: CheckCircle2,
            color: 'text-emerald-700 bg-emerald-50',
          },
          {
            label: t('إجمالي المنتجات', 'Total Products'),
            value: formatNumber(storeProducts.length, language),
            icon: Package,
            color: 'text-sky-700 bg-sky-50',
          },
          {
            label: t('تنبيهات نقص المخزون', 'Low Stock Alerts'),
            value: formatNumber(lowStockProducts.length, language),
            icon: AlertTriangle,
            color: 'text-rose-700 bg-rose-50',
          },
        ].map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.label}
              className="bg-white rounded-2xl border border-[#EAE6E1] p-4 shadow-2xs flex flex-col justify-between gap-3"
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${kpi.color}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs text-[#6E6A66] font-medium">{kpi.label}</div>
                <div className="text-lg sm:text-xl font-extrabold text-[#1C1917] mt-0.5">
                  {kpi.value}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Actions + Low Stock Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-5 bg-white rounded-2xl border border-[#EAE6E1] p-5 shadow-2xs space-y-3">
          <h3 className="text-sm font-extrabold text-[#1C1917]">
            {t('اختصارات سريعة لإدارة المحل', 'Quick Store Actions')}
          </h3>
          <div className="grid grid-cols-2 gap-2.5">
            <Link
              to="/merchant/products/new"
              className="flex items-center gap-2 p-3 rounded-xl bg-[#1B8E53] text-white text-xs font-bold hover:bg-[#147242]"
            >
              <Plus className="w-4 h-4" />
              <span>{t('إضافة منتج جديد', 'Add Product')}</span>
            </Link>
            <Link
              to="/merchant/orders"
              className="flex items-center gap-2 p-3 rounded-xl bg-[#E6F5EC] text-[#1B8E53] text-xs font-bold hover:bg-[#D5EFE0]"
            >
              <ClipboardList className="w-4 h-4" />
              <span>{t('متابعة الطلبات', 'Manage Orders')}</span>
            </Link>
            <Link
              to="/merchant/inventory"
              className="flex items-center gap-2 p-3 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] text-[#1C1917] text-xs font-bold hover:bg-[#F3F0EC]"
            >
              <Package className="w-4 h-4 text-[#1B8E53]" />
              <span>{t('تحديث المخزون', 'Update Stock')}</span>
            </Link>
            <Link
              to="/merchant/delivery"
              className="flex items-center gap-2 p-3 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] text-[#1C1917] text-xs font-bold hover:bg-[#F3F0EC]"
            >
              <Truck className="w-4 h-4 text-[#1B8E53]" />
              <span>{t('إعدادات التوصيل', 'Delivery Rules')}</span>
            </Link>
          </div>
        </div>

        <div className="lg:col-span-7 bg-white rounded-2xl border border-[#EAE6E1] p-5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-[#1C1917] flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span>{t('أصناف قاربت على النفاد', 'Low-Stock Alerts')}</span>
            </h3>
            <Link
              to="/merchant/inventory"
              className="text-xs font-bold text-[#1B8E53] hover:underline"
            >
              {t('إدارة المخزون ←', 'Inventory →')}
            </Link>
          </div>
          {lowStockProducts.length === 0 ? (
            <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl p-3 font-medium">
              {t('كل منتجاتك متوفرة بكميات آمنة في المخزن حالياً.', 'All store products are well stocked.')}
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {lowStockProducts.slice(0, 4).map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50/50 px-3 py-2 text-xs"
                >
                  <span className="font-bold text-[#1C1917] truncate">
                    {language === 'ar' ? p.nameAr : p.nameEn}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-extrabold shrink-0">
                    {p.stock === 0
                      ? t('نفد', 'Out')
                      : t(`متبقي ${p.stock}`, `${p.stock} left`)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Real-Data Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 bg-white rounded-2xl border border-[#EAE6E1] p-5 shadow-2xs">
          <div className="mb-4">
            <h3 className="text-sm font-extrabold text-[#1C1917] flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#1B8E53]" />
              <span>{t('المبيعات المحققة خلال آخر 7 أيام', 'Last 7 Days Realized Sales')}</span>
            </h3>
            <p className="text-xs text-[#6E6A66]">
              {t(
                'محسوبة تلقائياً من الطلبات المكتملة يومياً بالجنيه المصري',
                'Calculated directly from daily delivered orders in EGP'
              )}
            </p>
          </div>
          <div className="h-64 w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weeklySeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EAE6E1" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6E6A66' }} />
                <YAxis tick={{ fontSize: 11, fill: '#6E6A66' }} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="sales"
                  name={t('المبيعات المكتملة (جنيه)', 'Delivered Sales (EGP)')}
                  stroke="#1B8E53"
                  fill="#E6F5EC"
                  strokeWidth={2.5}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-5 bg-white rounded-2xl border border-[#EAE6E1] p-5 shadow-2xs">
          <h3 className="text-sm font-extrabold text-[#1C1917] mb-1">
            {t('الأكثر مبيعاً في محلك', 'Top-Selling Products')}
          </h3>
          <p className="text-xs text-[#6E6A66] mb-4">
            {t('إجمالي الوحدات المباعة من الطلبات المكتملة', 'Total units sold across delivered orders')}
          </p>
          {topProductsChart.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-xs text-[#6E6A66]">
              {t('لا توجد طلبات مكتملة بعد لعرض الأكثر مبيعاً', 'No delivered orders yet')}
            </div>
          ) : (
            (() => {
              const maxSold = Math.max(...topProductsChart.map((p) => p.sold), 1);
              return (
                <div className="space-y-3">
                  {topProductsChart.map((item, idx) => {
                    const pct = Math.max(8, Math.round((item.sold / maxSold) * 100));
                    return (
                      <div
                        key={item.name}
                        className="rounded-xl bg-[#FAF9F7] border border-[#EAE6E1]/80 p-3 transition-colors hover:border-[#C2E7D2]"
                      >
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`w-6 h-6 rounded-lg text-[11px] font-extrabold flex items-center justify-center shrink-0 ${
                                idx === 0
                                  ? 'bg-[#1B8E53] text-white shadow-2xs'
                                  : 'bg-[#E6F5EC] text-[#1B8E53]'
                              }`}
                            >
                              {idx + 1}
                            </span>
                            <span className="text-xs sm:text-sm font-bold text-[#1C1917] truncate">
                              {item.name}
                            </span>
                          </div>
                          <span className="px-2.5 py-0.5 rounded-full bg-white border border-[#EAE6E1] text-[11px] font-extrabold text-[#1B8E53] shrink-0">
                            {item.sold} {t('وحدة', 'sold')}
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-[#EAE6E1]/70 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              idx === 0
                                ? 'bg-gradient-to-r from-[#1B8E53] to-[#22A863]'
                                : 'bg-[#22A863]/85'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()
          )}
        </div>
      </div>

      {/* Recent Orders Table */}
      <div className="bg-white rounded-2xl border border-[#EAE6E1] shadow-2xs overflow-hidden">
        <div className="px-5 py-4 border-b border-[#EAE6E1] flex items-center justify-between">
          <div>
            <h3 className="text-sm font-extrabold text-[#1C1917]">
              {t('أحدث الطلبات الواردة', 'Recent Incoming Orders')}
            </h3>
            <p className="text-xs text-[#6E6A66]">
              {t('اقبل الطلبات الجديدة بسرعة لبدء التجهيز', 'Accept new orders quickly to start preparing')}
            </p>
          </div>
          <Link
            to="/merchant/orders"
            className="text-xs font-bold text-[#1B8E53] hover:underline"
          >
            {t('إدارة كل الطلبات', 'Manage all orders')}
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs">
            <thead className="bg-[#FAF9F7] text-[#6E6A66]">
              <tr>
                <th className="py-3 px-4 font-bold text-start">{t('رقم الطلب', 'Order #')}</th>
                <th className="py-3 px-4 font-bold text-start">{t('العميل', 'Customer')}</th>
                <th className="py-3 px-4 font-bold text-start">{t('الأصناف', 'Items')}</th>
                <th className="py-3 px-4 font-bold text-start">{t('الإجمالي', 'Total')}</th>
                <th className="py-3 px-4 font-bold text-start">{t('الحالة', 'Status')}</th>
                <th className="py-3 px-4 font-bold text-start">{t('إجراء سريع', 'Quick Action')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EAE6E1]">
              {storeOrders.slice(0, 6).map((order) => {
                const statusMeta = getOrderStatusMeta(order.status, language);
                return (
                  <tr key={order.id} className="hover:bg-[#FAF9F7]/70">
                    <td className="py-3 px-4 font-extrabold text-[#1C1917]">
                      <Link to={`/merchant/orders/${order.id}`} className="hover:text-[#1B8E53]">
                        #{order.orderNumber}
                      </Link>
                      <span className="block text-[10px] text-[#6E6A66] font-normal">
                        {formatDateTime(order.createdAt, language)}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-[#1C1917]">{order.customerName}</div>
                      <div className="text-[11px] text-[#6E6A66]">{order.customerPhone}</div>
                    </td>
                    <td className="py-3 px-4 text-[#6E6A66]">
                      {order.items.length} {t('منتجات', 'items')}
                    </td>
                    <td className="py-3 px-4 font-extrabold text-[#1B8E53]">
                      {formatEGP(order.total, language)}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${statusMeta.badgeClass}`}
                      >
                        {statusMeta.label}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {order.status === 'pending' ? (
                        <button
                          type="button"
                          onClick={() => updateOrderStatus(order.id, 'accepted')}
                          className="px-3 py-1.5 rounded-lg bg-[#1B8E53] text-white font-bold hover:bg-[#147242]"
                        >
                          {t('قبول الطلب', 'Accept')}
                        </button>
                      ) : (
                        <Link
                          to={`/merchant/orders/${order.id}`}
                          className="text-[#1B8E53] font-bold hover:underline"
                        >
                          {t('التفاصيل', 'Details')}
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

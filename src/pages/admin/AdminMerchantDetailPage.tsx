import React, { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  Calendar,
  MapPin,
  MessageSquareQuote,
  Phone,
  Star,
  Store,
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
import { SafeImage } from '../../components/common/SafeImage';
import { EmptyState } from '../../components/common/EmptyState';
import {
  buildTimeSeriesFromOrders,
  filterOrdersByWindow,
  getDateWindow,
  getPresetOptions,
} from '../../services/analyticsService';
import {
  formatDateOnly,
  formatDateTime,
  formatEGP,
  formatNumber,
  getMerchantStatusMeta,
  getOrderStatusMeta,
  getStoreTypeLabel,
} from '../../utils/i18n';
import type { DateFilterState, DateRangePreset, Merchant } from '../../types';

const MerchantDetailContent: React.FC<{ merchant: Merchant }> = ({ merchant }) => {
  const {
    language,
    t,
    products,
    orders,
    reviews,
    setMerchantStatus,
    updateMerchantCommission,
  } = useApp();

  const [commissionInput, setCommissionInput] = useState(String(merchant.commissionRate));
  const [preset, setPreset] = useState<DateRangePreset>('30d');
  const [customFrom, setCustomFrom] = useState('2026-10-01');
  const [customTo, setCustomTo] = useState('2026-11-20');

  const filterState: DateFilterState = useMemo(
    () => ({ preset, customStart: customFrom, customEnd: customTo }),
    [preset, customFrom, customTo]
  );
  const dateWin = useMemo(() => getDateWindow(filterState), [filterState]);

  const merchantProducts = useMemo(
    () => products.filter((p) => p.merchantId === merchant.id),
    [products, merchant.id]
  );

  const allMerchantOrders = useMemo(
    () =>
      orders
        .filter((o) => o.merchantId === merchant.id)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [orders, merchant.id]
  );

  const windowOrders = useMemo(
    () => filterOrdersByWindow(allMerchantOrders, dateWin.start, dateWin.end),
    [allMerchantOrders, dateWin.start, dateWin.end]
  );

  const delivered = useMemo(
    () => windowOrders.filter((o) => o.status === 'delivered'),
    [windowOrders]
  );

  const gmv = delivered.reduce((s, o) => s + o.total, 0);
  const commissionEarned = delivered.reduce((s, o) => s + o.platformCommission, 0);
  const aov = delivered.length > 0 ? Math.round(gmv / delivered.length) : 0;

  const granularity = preset === 'today' || preset === '7d' || preset === '30d' ? 'daily' : 'monthly';
  const perfSeries = useMemo(
    () => buildTimeSeriesFromOrders(windowOrders, granularity, language),
    [windowOrders, granularity, language]
  );

  const topProducts = useMemo(() => {
    const map = new Map<string, { name: string; sold: number; revenue: number }>();
    delivered.forEach((o) => {
      o.items.forEach((item) => {
        const prev = map.get(item.productId) ?? {
          name: language === 'ar' ? item.nameAr : item.nameEn,
          sold: 0,
          revenue: 0,
        };
        prev.sold += item.quantity;
        prev.revenue += item.unitPrice * item.quantity;
        map.set(item.productId, prev);
      });
    });
    return Array.from(map.values())
      .sort((a, b) => b.sold - a.sold)
      .slice(0, 6);
  }, [delivered, language]);

  const storeReviews = useMemo(
    () => reviews.filter((r) => r.merchantId === merchant.id),
    [reviews, merchant.id]
  );

  const statusMeta = getMerchantStatusMeta(merchant.status, language);
  const presets = getPresetOptions(language);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/admin/merchants"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1B8E53] hover:underline"
        >
          <ArrowRight className="w-3.5 h-3.5" />
          <span>{t('العودة لقائمة التجار', 'Back to Merchants')}</span>
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-1 bg-white border border-[#EAE6E1] rounded-2xl p-1">
            {presets.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPreset(p.id)}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-colors ${
                  preset === p.id
                    ? 'bg-[#1B8E53] text-white'
                    : 'text-[#6E6A66] hover:text-[#1C1917]'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {preset === 'custom' && (
            <div className="flex items-center gap-1.5 bg-white border border-[#EAE6E1] rounded-xl px-2.5 py-1 text-xs">
              <Calendar className="w-3.5 h-3.5 text-[#1B8E53]" />
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

      {/* Store Header Card */}
      <div className="bg-white rounded-2xl border border-[#EAE6E1] p-5 sm:p-6 space-y-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#EAE6E1]">
          <div className="flex items-center gap-4">
            <SafeImage
              src={merchant.logo}
              alt={merchant.nameAr}
              className="w-16 h-16 rounded-2xl border border-[#EAE6E1] object-cover"
            />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-extrabold text-[#1C1917]">
                  {language === 'ar' ? merchant.nameAr : merchant.nameEn}
                </h1>
                {merchant.verified && <BadgeCheck className="w-5 h-5 text-[#1B8E53]" />}
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${statusMeta.badgeClass}`}>
                  {statusMeta.label}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-[#6E6A66] mt-1">
                <span>{getStoreTypeLabel(merchant.type, language)}</span>
                {(merchant.ownerNameAr || merchant.ownerNameEn) && (
                  <span>
                    • {t('المالك:', 'Owner:')}{' '}
                    <strong className="text-[#1C1917]">
                      {language === 'ar' ? merchant.ownerNameAr : merchant.ownerNameEn}
                    </strong>
                  </span>
                )}
                <span className="inline-flex items-center gap-1" dir="ltr">
                  <Phone className="w-3.5 h-3.5" /> {merchant.phone}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" /> {merchant.rating} (
                  {merchant.reviewCount})
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {merchant.status !== 'approved' && (
              <button
                type="button"
                onClick={() => setMerchantStatus(merchant.id, 'approved')}
                className="px-4 py-2 rounded-xl bg-[#1B8E53] text-white text-xs font-bold"
              >
                {t('اعتماد وتفعيل', 'Approve & Activate')}
              </button>
            )}
            {merchant.status === 'approved' && (
              <button
                type="button"
                onClick={() => setMerchantStatus(merchant.id, 'suspended')}
                className="px-4 py-2 rounded-xl border border-amber-300 text-amber-800 text-xs font-bold"
              >
                {t('إيقاف مؤقت', 'Suspend Store')}
              </button>
            )}
            {merchant.status === 'pending' && (
              <button
                type="button"
                onClick={() => setMerchantStatus(merchant.id, 'rejected')}
                className="px-4 py-2 rounded-xl border border-rose-200 text-rose-600 text-xs font-bold"
              >
                {t('رفض الطلب', 'Reject')}
              </button>
            )}
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
          <div className="p-3.5 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1]">
            <span className="text-[#6E6A66] block">{t('إجمالي المنتجات', 'Products')}</span>
            <strong className="text-lg text-[#1C1917]">{formatNumber(merchantProducts.length, language)}</strong>
          </div>
          <div className="p-3.5 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1]">
            <span className="text-[#6E6A66] block">{t('الطلبات المكتملة / الكل', 'Orders (Deliv/All)')}</span>
            <strong className="text-lg text-[#1C1917]">
              {formatNumber(delivered.length, language)} / {formatNumber(windowOrders.length, language)}
            </strong>
          </div>
          <div className="p-3.5 rounded-xl bg-[#E6F5EC] border border-[#C2E7D2]">
            <span className="text-[#1B8E53] font-bold block">{t('المبيعات المحققة (GMV)', 'Realized GMV')}</span>
            <strong className="text-lg text-[#1B8E53]">{formatEGP(gmv, language)}</strong>
          </div>
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200">
            <span className="text-emerald-700 font-bold block">{t('عمولات المنصة', 'Commission Earned')}</span>
            <strong className="text-lg text-emerald-800">{formatEGP(commissionEarned, language)}</strong>
          </div>
          <div className="p-3.5 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1]">
            <span className="text-[#6E6A66] block">{t('متوسط الطلب (AOV)', 'Average Order')}</span>
            <strong className="text-lg text-[#1C1917]">{formatEGP(aov, language)}</strong>
          </div>
          <div className="p-3.5 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1]">
            <span className="text-[#6E6A66] block">{t('رسوم التوصيل', 'Delivery Fee')}</span>
            <strong className="text-lg text-[#1C1917]">{formatEGP(merchant.delivery.deliveryFee, language)}</strong>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 border-t border-[#EAE6E1]">
          <div className="text-xs text-[#6E6A66] flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-[#1B8E53]" />
            <span>{language === 'ar' ? merchant.addressAr : merchant.addressEn}</span>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-[#6E6A66]">
              {t('نسبة العمولة المخصصة (%):', 'Custom Commission (%):')}
            </label>
            <input
              type="number"
              min="0"
              max="30"
              value={commissionInput}
              onChange={(e) => setCommissionInput(e.target.value)}
              className="w-20 px-2.5 py-1.5 rounded-xl border border-[#EAE6E1] text-xs font-bold"
            />
            <button
              type="button"
              onClick={() => updateMerchantCommission(merchant.id, Number(commissionInput) || 0)}
              className="px-3.5 py-1.5 rounded-xl bg-[#1B8E53] text-white text-xs font-bold"
            >
              {t('حفظ', 'Save')}
            </button>
          </div>
        </div>
      </div>

      {/* Chart + Top Products */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 bg-white rounded-2xl border border-[#EAE6E1] p-5 shadow-2xs">
          <h2 className="text-sm font-extrabold text-[#1C1917] mb-3">
            {t('منحنى مبيعات المتجر خلال الفترة', 'Store Sales Performance')}
          </h2>
          <div className="h-56" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={perfSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EAE6E1" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6E6A66' }} />
                <YAxis tick={{ fontSize: 11, fill: '#6E6A66' }} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="sales"
                  name={t('المبيعات (جنيه)', 'Sales (EGP)')}
                  stroke="#1B8E53"
                  fill="#E6F5EC"
                  strokeWidth={2.5}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-5 bg-white rounded-2xl border border-[#EAE6E1] p-5 shadow-2xs space-y-3">
          <h2 className="text-sm font-extrabold text-[#1C1917]">
            {t('أكثر المنتجات مبيعاً في المتجر', 'Top-Selling Products')}
          </h2>
          {topProducts.length === 0 ? (
            <p className="text-xs text-[#6E6A66]">{t('لا توجد مبيعات في الفترة المحددة', 'No sales in this period')}</p>
          ) : (
            <div className="space-y-2">
              {topProducts.map((tp) => (
                <div
                  key={tp.name}
                  className="flex items-center justify-between text-xs bg-[#FAF9F7] border border-[#EAE6E1] rounded-xl px-3 py-2"
                >
                  <span className="font-bold text-[#1C1917] truncate">{tp.name}</span>
                  <span className="shrink-0 text-[#6E6A66]">
                    <strong className="text-[#1C1917]">{tp.sold}</strong> {t('وحدة', 'units')} •{' '}
                    <strong className="text-[#1B8E53]">{formatEGP(tp.revenue, language)}</strong>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Customer Reviews + Recent Orders */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-5 bg-white rounded-2xl border border-[#EAE6E1] p-5 space-y-3 shadow-2xs">
          <h2 className="text-sm font-extrabold text-[#1C1917] flex items-center gap-2">
            <MessageSquareQuote className="w-4 h-4 text-[#1B8E53]" />
            <span>{t(`تقييمات العملاء (${storeReviews.length})`, `Customer Reviews (${storeReviews.length})`)}</span>
          </h2>
          {storeReviews.length === 0 ? (
            <p className="text-xs text-[#6E6A66]">{t('لا توجد تقييمات بعد لهذا المتجر', 'No reviews yet for this store')}</p>
          ) : (
            <div className="space-y-2.5 max-h-80 overflow-y-auto">
              {storeReviews.map((rev) => (
                <div key={rev.id} className="rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] p-3 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <strong className="text-[#1C1917]">{rev.customerName}</strong>
                    <span className="inline-flex items-center gap-1 text-amber-600 font-extrabold">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                      {rev.rating}
                    </span>
                  </div>
                  <p className="text-[#6E6A66]">{language === 'ar' ? rev.commentAr : rev.commentEn}</p>
                  <div className="text-[10px] text-[#9C9690]">{formatDateOnly(rev.createdAt, language)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-7 bg-white rounded-2xl border border-[#EAE6E1] p-5 space-y-3 shadow-2xs">
          <h2 className="text-sm font-extrabold text-[#1C1917]">
            {t('طلبات المتجر خلال الفترة', 'Store Orders in Period')} ({windowOrders.length})
          </h2>
          {windowOrders.length === 0 ? (
            <p className="text-xs text-[#6E6A66]">{t('لا توجد طلبات مسجلة في الفترة', 'No orders in this window')}</p>
          ) : (
            <div className="divide-y divide-[#EAE6E1] text-xs max-h-80 overflow-y-auto">
              {windowOrders.slice(0, 15).map((o) => {
                const sm = getOrderStatusMeta(o.status, language);
                return (
                  <div key={o.id} className="py-2.5 flex items-center justify-between gap-2">
                    <div>
                      <strong className="text-[#1C1917]">#{o.orderNumber}</strong> — {o.customerName}
                      <span className="block text-[10px] text-[#6E6A66]">
                        {formatDateTime(o.createdAt, language)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${sm.badgeClass}`}>
                        {sm.label}
                      </span>
                      <strong className="text-[#1B8E53]">{formatEGP(o.total, language)}</strong>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const AdminMerchantDetailPage: React.FC = () => {
  const { id, merchantId } = useParams();
  const targetId = id ?? merchantId;
  const { t, merchants } = useApp();

  const merchant = merchants.find((m) => m.id === targetId);

  if (!merchant) {
    return (
      <EmptyState
        icon={Store}
        title={t('التاجر غير موجود', 'Merchant not found')}
        description={t('تعذر العثور على بيانات هذا التاجر.', 'Merchant record was not found.')}
        action={
          <Link to="/admin/merchants" className="px-5 py-2.5 rounded-xl bg-[#1B8E53] text-white text-xs font-bold">
            {t('العودة للتجار', 'Back to Merchants')}
          </Link>
        }
      />
    );
  }

  return <MerchantDetailContent key={merchant.id} merchant={merchant} />;
};

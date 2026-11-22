import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Clock,
  Loader2,
  MapPin,
  Package,
  Phone,
  RefreshCw,
  Store,
  Truck,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  deliveryApi,
  type BackendOrderPayload,
  type DeliverySummaryPayload,
} from '../../services/gowarApi';
import { formatDateTime, formatEGP } from '../../utils/i18n';

interface DeliveryDashboardPageProps {
  presetStatus?: 'all' | 'in_progress' | 'delivered';
}

export const DeliveryDashboardPage: React.FC<DeliveryDashboardPageProps> = ({
  presetStatus = 'all',
}) => {
  const { language, t } = useApp();

  const [summary, setSummary] = useState<DeliverySummaryPayload>({
    new_assigned: 0,
    ready_for_delivery: 0,
    out_for_delivery: 0,
    delivered: 0,
  });
  const [orders, setOrders] = useState<BackendOrderPayload[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>(
    presetStatus === 'in_progress'
      ? 'out_for_delivery'
      : presetStatus === 'delivered'
        ? 'delivered'
        : 'all'
  );
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setStatusFilter(
      presetStatus === 'in_progress'
        ? 'out_for_delivery'
        : presetStatus === 'delivered'
          ? 'delivered'
          : 'all'
    );
  }, [presetStatus]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sumRes, ordersRes] = await Promise.all([
        deliveryApi.fetchSummary(),
        deliveryApi.fetchOrders({
          order_status: statusFilter !== 'all' ? statusFilter : undefined,
          date: dateFilter !== 'all' ? dateFilter : undefined,
        }),
      ]);
      setSummary(sumRes);
      setOrders(ordersRes.results || []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('تعذر تحميل الطلبات المسندة', 'Failed to load assigned orders')
      );
    } finally {
      setLoading(false);
    }
  }, [statusFilter, dateFilter, t]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const statusBadge = (status: string) => {
    switch (status) {
      case 'ready_for_delivery':
        return {
          label: t('جاهز للاستلام', 'Ready for Pickup'),
          cls: 'bg-amber-50 text-amber-800 border-amber-200',
        };
      case 'out_for_delivery':
        return {
          label: t('جاري التوصيل', 'Out for Delivery'),
          cls: 'bg-[#FFF2EB] text-[#D6450D] border-[#FBD8C5]',
        };
      case 'delivered':
        return {
          label: t('تم التوصيل', 'Delivered'),
          cls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        };
      case 'cancelled':
        return {
          label: t('ملغي', 'Cancelled'),
          cls: 'bg-rose-50 text-rose-700 border-rose-200',
        };
      default:
        return {
          label: t('قيد التجهيز', 'Preparing'),
          cls: 'bg-slate-100 text-slate-700 border-slate-200',
        };
    }
  };

  const summaryCards = [
    {
      label: t('طلبات مسندة جديدة', 'New Assigned'),
      value: summary.new_assigned,
      icon: ClipboardList,
      tone: 'bg-blue-50 text-blue-700',
    },
    {
      label: t('جاهز للتوصيل', 'Ready for Delivery'),
      value: summary.ready_for_delivery,
      icon: Package,
      tone: 'bg-amber-50 text-amber-700',
    },
    {
      label: t('في الطريق للعميل', 'Out for Delivery'),
      value: summary.out_for_delivery,
      icon: Truck,
      tone: 'bg-[#FFF2EB] text-[#D6450D]',
    },
    {
      label: t('تم توصيلها', 'Delivered'),
      value: summary.delivered,
      icon: CheckCircle2,
      tone: 'bg-emerald-50 text-emerald-700',
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-xl font-extrabold text-[#1C1917]">
            {presetStatus === 'in_progress'
              ? t('طلبات جاري توصيلها', 'Orders In Progress')
              : presetStatus === 'delivered'
                ? t('الطلبات المكتملة', 'Delivered Orders')
                : t('لوحة التوصيل', 'Delivery Dashboard')}
          </h1>
          <p className="text-xs text-[#6E6A66]">
            {t('تابع الطلبات المسندة إليك وقم بتحديث حالتها لحظياً', 'Track and complete your assigned deliveries')}
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadData()}
          className="h-10 px-3.5 rounded-xl bg-white border border-[#EAE6E1] text-xs font-bold text-[#1C1917] hover:bg-[#FAF9F7] inline-flex items-center gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>{t('تحديث', 'Refresh')}</span>
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="bg-white rounded-2xl border border-[#EAE6E1] p-4 shadow-2xs flex items-center gap-3"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${card.tone}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-xl font-extrabold text-[#1C1917]">{card.value}</div>
                <div className="text-[11px] font-semibold text-[#6E6A66] truncate">{card.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-[#EAE6E1] p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {[
            { id: 'all', label: t('الكل', 'All') },
            { id: 'ready_for_delivery', label: t('جاهز للتوصيل', 'Ready') },
            { id: 'out_for_delivery', label: t('في الطريق', 'Out for Delivery') },
            { id: 'delivered', label: t('تم التوصيل', 'Delivered') },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                statusFilter === tab.id
                  ? 'bg-[#D6450D] text-white'
                  : 'bg-[#FAF9F7] text-[#6E6A66] hover:text-[#1C1917]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-[#6E6A66]" />
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] text-xs font-bold text-[#1C1917]"
          >
            <option value="all">{t('كل التواريخ', 'All Dates')}</option>
            <option value="today">{t('اليوم', 'Today')}</option>
            <option value="week">{t('آخر 7 أيام', 'Last 7 Days')}</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl bg-rose-50 border border-rose-200 p-4 flex items-center gap-2.5 text-xs text-rose-800">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="py-12 flex items-center justify-center gap-2 text-sm text-[#6E6A66]">
          <Loader2 className="w-5 h-5 animate-spin text-[#D6450D]" />
          <span>{t('جاري تحميل الطلبات...', 'Loading orders...')}</span>
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#EAE6E1] p-10 text-center space-y-2">
          <Truck className="w-10 h-10 text-[#D6450D]/40 mx-auto" />
          <p className="text-sm font-extrabold text-[#1C1917]">
            {t('لا توجد طلبات مطابقة حالياً', 'No assigned orders found')}
          </p>
          <p className="text-xs text-[#6E6A66]">
            {t('ستظهر هنا الطلبات المسندة إليك من المحلات فور جاهزيتها.', 'Orders assigned to you will appear here.')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {orders.map((order) => {
            const badge = statusBadge(order.order_status);
            const storeName = language === 'ar' ? order.store_name : order.store_name_en || order.store_name;
            const addressText = order.delivery_address_snapshot?.formatted_address || t('غير محدد', 'Not specified');
            const customerPhone =
              order.delivery_address_snapshot?.phone_number || order.customer_phone;

            return (
              <div
                key={order.id}
                className="bg-white rounded-2xl border border-[#EAE6E1] p-4 shadow-2xs flex flex-col justify-between gap-3.5"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-extrabold text-[#1C1917]">
                      #{order.order_number}
                    </span>
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${badge.cls}`}>
                      {badge.label}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs text-[#6E6A66]">
                    <div className="flex items-center gap-2 text-[#1C1917] font-bold">
                      <Store className="w-3.5 h-3.5 text-[#D6450D] shrink-0" />
                      <span className="truncate">{storeName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#1C1917]">{order.customer_name}</span>
                      {customerPhone && (
                        <span className="inline-flex items-center gap-1 text-[#D6450D] font-bold">
                          <Phone className="w-3 h-3" />
                          {customerPhone}
                        </span>
                      )}
                    </div>
                    <div className="flex items-start gap-2">
                      <MapPin className="w-3.5 h-3.5 text-[#6E6A66] shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{addressText}</span>
                    </div>
                    {order.assigned_at && (
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <Clock className="w-3 h-3" />
                        <span>
                          {t('تم الإسناد:', 'Assigned:')} {formatDateTime(order.assigned_at, language)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-[#EAE6E1] flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-extrabold text-[#1C1917]">
                      {formatEGP(Number(order.total_amount), language)}
                    </div>
                    <div className="text-[11px] text-[#6E6A66]">
                      {t('التوصيل:', 'Delivery:')} {formatEGP(Number(order.delivery_fee), language)}
                    </div>
                  </div>

                  <Link
                    to={`/delivery/orders/${order.id}`}
                    className="px-4 py-2.5 rounded-xl bg-[#D6450D] hover:bg-[#B33808] text-white text-xs font-extrabold transition-colors"
                  >
                    {t('تفاصيل الطلب', 'Open Order Details')}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

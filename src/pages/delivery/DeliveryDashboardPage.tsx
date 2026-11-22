import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Clock,
  Loader2,
  MapPin,
  Navigation,
  Package,
  Phone,
  Play,
  RefreshCw,
  Square,
  Store,
  Truck,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  deliveryApi,
  type BackendOrderPayload,
  type DeliverySummaryPayload,
} from '../../services/gowarApi';
import type { DeliveryShiftStatusResponse } from '../../types';
import { formatDateTime, formatEGP } from '../../utils/i18n';

interface DeliveryDashboardPageProps {
  presetStatus?: 'all' | 'in_progress' | 'delivered';
}

export const DeliveryDashboardPage: React.FC<DeliveryDashboardPageProps> = ({
  presetStatus = 'all',
}) => {
  const { language, t, showToast } = useApp();

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

  // Shift & Explicit Location Sharing state
  const [shiftStatus, setShiftStatus] = useState<DeliveryShiftStatusResponse | null>(null);
  const [shiftBusy, setShiftBusy] = useState(false);
  const [sharingActive, setSharingActive] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const lastSentAtRef = useRef<number>(0);

  const stopLocationWatch = useCallback(async (notifyServer = true) => {
    if (watchIdRef.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setSharingActive(false);
    if (notifyServer) {
      try {
        await deliveryApi.updateLocation({ is_sharing: false });
      } catch {
        // Best-effort stop signal
      }
    }
  }, []);

  const startLocationSharing = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocationError(
        t('متصفحك لا يدعم تحديد الموقع الجغرافي', 'Geolocation is not supported on this device')
      );
      return;
    }
    setLocationError(null);
    setSharingActive(true);
    lastSentAtRef.current = 0;

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const nowMs = Date.now();
        if (nowMs - lastSentAtRef.current < 15000) return;
        lastSentAtRef.current = nowMs;
        try {
          const res = await deliveryApi.updateLocation({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy_m: pos.coords.accuracy,
            is_sharing: true,
          });
          setShiftStatus((prev) =>
            prev
              ? {
                  ...prev,
                  is_location_sharing: res.is_location_sharing,
                  last_location_at: res.last_location_at,
                }
              : prev
          );
        } catch {
          // Ignore transient network hiccups during periodic updates
        }
      },
      (geoErr) => {
        const msg =
          geoErr.code === geoErr.PERMISSION_DENIED
            ? t('تم رفض صلاحية الموقع. فعّل إذن الموقع من المتصفح للمشاركة.', 'Location permission denied.')
            : t('تعذر الحصول على إشارة GPS حالياً.', 'GPS location currently unavailable.');
        setLocationError(msg);
        void stopLocationWatch(true);
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );
  }, [stopLocationWatch, t]);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

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
      const [sumRes, ordersRes, shiftRes] = await Promise.all([
        deliveryApi.fetchSummary(),
        deliveryApi.fetchOrders({
          order_status: statusFilter !== 'all' ? statusFilter : undefined,
          date: dateFilter !== 'all' ? dateFilter : undefined,
        }),
        deliveryApi.fetchShiftStatus().catch(() => null),
      ]);
      setSummary(sumRes);
      setOrders(ordersRes.results || []);
      if (shiftRes) setShiftStatus(shiftRes);
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
          cls: 'bg-[#E6F5EC] text-[#1B8E53] border-[#C2E7D2]',
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
      tone: 'bg-[#E6F5EC] text-[#1B8E53]',
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

      {/* Shift & Explicit Live Location Sharing */}
      {shiftStatus?.has_profile && (
        <div className="bg-white rounded-2xl border border-[#EAE6E1] p-4 shadow-2xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="text-sm font-extrabold text-[#1C1917] flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#1B8E53]" />
                <span>
                  {shiftStatus.is_on_shift
                    ? t('المناوبة نشطة الآن', 'Shift Active')
                    : t('لم تبدأ المناوبة بعد', 'Off Shift')}
                </span>
                <span className="text-xs font-semibold text-[#6E6A66]">
                  ({shiftStatus.working_minutes_today} {t('دقيقة اليوم', 'min today')})
                </span>
              </div>
              {shiftStatus.last_location_at && (
                <div className="text-[11px] text-[#6E6A66]">
                  {t('آخر موقع مرسل:', 'Last location sent:')}{' '}
                  {formatDateTime(shiftStatus.last_location_at, language)}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {!shiftStatus.is_on_shift ? (
                <button
                  type="button"
                  disabled={shiftBusy}
                  onClick={async () => {
                    setShiftBusy(true);
                    try {
                      await deliveryApi.startShift();
                      showToast(t('تم بدء المناوبة', 'Shift started'), 'success');
                      await loadData();
                    } catch (err) {
                      showToast(
                        err instanceof Error ? err.message : t('تعذر بدء المناوبة', 'Failed to start shift'),
                        'error'
                      );
                    } finally {
                      setShiftBusy(false);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold disabled:opacity-60"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>{t('بدء المناوبة', 'Start Shift')}</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={shiftBusy}
                  onClick={async () => {
                    setShiftBusy(true);
                    try {
                      await stopLocationWatch(false);
                      await deliveryApi.endShift();
                      showToast(t('تم إنهاء المناوبة وإيقاف مشاركة الموقع', 'Shift ended'), 'success');
                      await loadData();
                    } catch (err) {
                      showToast(
                        err instanceof Error ? err.message : t('تعذر إنهاء المناوبة', 'Failed to end shift'),
                        'error'
                      );
                    } finally {
                      setShiftBusy(false);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold disabled:opacity-60"
                >
                  <Square className="w-3.5 h-3.5" />
                  <span>{t('إنهاء المناوبة', 'End Shift')}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  if (sharingActive) {
                    void stopLocationWatch(true);
                  } else {
                    startLocationSharing();
                  }
                }}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold border transition-colors ${
                  sharingActive
                    ? 'bg-[#E6F5EC] border-[#1B8E53] text-[#1B8E53]'
                    : 'bg-[#FAF9F7] border-[#EAE6E1] text-[#1C1917] hover:border-[#1B8E53]'
                }`}
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>
                  {sharingActive
                    ? t('إيقاف مشاركة الموقع', 'Stop Sharing GPS')
                    : t('مشاركة الموقع المباشر', 'Share Live GPS')}
                </span>
              </button>
            </div>
          </div>

          {locationError && (
            <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
              {locationError}
            </div>
          )}
        </div>
      )}

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
                  ? 'bg-[#1B8E53] text-white'
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
          <Loader2 className="w-5 h-5 animate-spin text-[#1B8E53]" />
          <span>{t('جاري تحميل الطلبات...', 'Loading orders...')}</span>
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#EAE6E1] p-10 text-center space-y-2">
          <Truck className="w-10 h-10 text-[#1B8E53]/40 mx-auto" />
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
                      <Store className="w-3.5 h-3.5 text-[#1B8E53] shrink-0" />
                      <span className="truncate">{storeName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#1C1917]">{order.customer_name}</span>
                      {customerPhone && (
                        <span className="inline-flex items-center gap-1 text-[#1B8E53] font-bold">
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
                    className="px-4 py-2.5 rounded-xl bg-[#1B8E53] hover:bg-[#147242] text-white text-xs font-extrabold transition-colors"
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

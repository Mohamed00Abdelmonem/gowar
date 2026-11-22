import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import L from 'leaflet';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Loader2,
  MapPin,
  Navigation,
  Phone,
  Store,
  Truck,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Modal } from '../../components/common/Modal';
import { deliveryApi, type BackendOrderPayload } from '../../services/gowarApi';
import { buildGoogleMapsDirectionsUrl } from '../../services/locationService';
import { formatDateTime, formatEGP } from '../../utils/i18n';

export const DeliveryOrderDetailPage: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const { language, t, showToast } = useApp();

  const [order, setOrder] = useState<BackendOrderPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  const loadOrder = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await deliveryApi.fetchOrder(orderId);
      setOrder(res);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('تعذر تحميل تفاصيل الطلب', 'Could not load order details')
      );
    } finally {
      setLoading(false);
    }
  }, [orderId, t]);

  useEffect(() => {
    void loadOrder();
  }, [loadOrder]);

  const lat = order?.delivery_address_snapshot?.latitude;
  const lng = order?.delivery_address_snapshot?.longitude;
  const googleMapsUrl = buildGoogleMapsDirectionsUrl(lat, lng);
  const numericLat = typeof lat === 'number' ? lat : Number(lat);
  const numericLng = typeof lng === 'number' ? lng : Number(lng);

  useEffect(() => {
    if (!mapContainerRef.current || !googleMapsUrl) return;
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const map = L.map(mapContainerRef.current, {
      center: [numericLat, numericLng],
      zoom: 16,
      zoomControl: true,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);
    L.circleMarker([numericLat, numericLng], {
      radius: 9,
      color: '#FFFFFF',
      weight: 3,
      fillColor: '#D6450D',
      fillOpacity: 1,
    }).addTo(map);

    mapInstanceRef.current = map;
    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [googleMapsUrl, numericLat, numericLng]);

  const handleMarkOutForDelivery = async () => {
    if (!order || busyAction) return;
    setBusyAction(true);
    try {
      const updated = await deliveryApi.transitionOrder(order.id, {
        status: 'out_for_delivery',
      });
      setOrder(updated);
      showToast(
        t('تم تحديث الحالة إلى جاري التوصيل', 'Order marked as Out for Delivery'),
        'success'
      );
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : t('تعذر تحديث حالة الطلب', 'Failed to update status'),
        'error'
      );
    } finally {
      setBusyAction(false);
    }
  };

  const handleConfirmDelivered = async () => {
    if (!order || busyAction) return;
    setBusyAction(true);
    try {
      const updated = await deliveryApi.transitionOrder(order.id, {
        status: 'delivered',
        confirm_delivery: true,
      });
      setOrder(updated);
      setConfirmModalOpen(false);
      showToast(
        t('تم تأكيد توصيل الطلب بنجاح!', 'Order marked as Delivered!'),
        'success'
      );
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : t('تعذر تأكيد التوصيل', 'Failed to confirm delivery'),
        'error'
      );
    } finally {
      setBusyAction(false);
    }
  };

  const BackIcon = language === 'ar' ? ArrowRight : ArrowLeft;

  if (loading) {
    return (
      <div className="py-16 flex items-center justify-center gap-2 text-sm text-[#6E6A66]">
        <Loader2 className="w-5 h-5 animate-spin text-[#D6450D]" />
        <span>{t('جاري تحميل تفاصيل الطلب...', 'Loading order details...')}</span>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="bg-white rounded-2xl border border-[#EAE6E1] p-6 text-center space-y-3">
        <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
        <p className="text-sm font-bold text-[#1C1917]">
          {error || t('الطلب غير موجود', 'Order not found')}
        </p>
        <Link
          to="/delivery"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#D6450D] text-white text-xs font-bold"
        >
          <BackIcon className="w-4 h-4" />
          <span>{t('العودة للطلبات', 'Back to Dashboard')}</span>
        </Link>
      </div>
    );
  }

  const snap = order.delivery_address_snapshot || {};
  const customerPhone = snap.phone_number || order.customer_phone;
  const storeName = language === 'ar' ? order.store_name : order.store_name_en || order.store_name;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Link
          to="/delivery"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#6E6A66] hover:text-[#1C1917]"
        >
          <BackIcon className="w-4 h-4" />
          <span>{t('العودة للطلبات', 'Back to Orders')}</span>
        </Link>
        <span className="text-xs font-mono text-[#6E6A66]">ID: {order.id.slice(0, 8)}</span>
      </div>

      {/* Header Card */}
      <div className="bg-white rounded-2xl border border-[#EAE6E1] p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-xl font-extrabold text-[#1C1917]">
            {t('طلب رقم', 'Order')} #{order.order_number}
          </h1>
          <p className="text-xs text-[#6E6A66] mt-0.5">
            {formatDateTime(order.created_at, language)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-[#FFF2EB] text-[#D6450D] border border-[#FBD8C5]">
            {order.order_status}
          </span>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#FAF9F7] text-[#1C1917] border border-[#EAE6E1]">
            {order.payment_method.toUpperCase()} ({order.payment_status})
          </span>
        </div>
      </div>

      {/* Customer & Navigation Card */}
      <div className="bg-white rounded-2xl border border-[#EAE6E1] p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="text-xs font-bold text-[#6E6A66]">{t('بيانات العميل', 'Customer Details')}</div>
            <div className="text-base font-extrabold text-[#1C1917]">
              {snap.recipient_name || order.customer_name}
            </div>
            <div className="text-xs text-[#6E6A66] flex items-start gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#D6450D] shrink-0 mt-0.5" />
              <span>
                {snap.formatted_address}
                {snap.building_number ? ` — ${t('عمارة', 'Bldg')} ${snap.building_number}` : ''}
                {snap.floor ? `، ${t('دور', 'Fl')} ${snap.floor}` : ''}
                {snap.apartment ? `، ${t('شقة', 'Apt')} ${snap.apartment}` : ''}
              </span>
            </div>
            {snap.additional_instructions && (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mt-1.5">
                {t('تعليمات التوصيل:', 'Delivery Instructions:')} {snap.additional_instructions}
              </p>
            )}
            {googleMapsUrl && (
              <div className="text-[11px] font-mono text-[#6E6A66]">
                {numericLat.toFixed(6)}, {numericLng.toFixed(6)}
              </div>
            )}
          </div>

          {customerPhone && (
            <a
              href={`tel:${customerPhone}`}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold transition-colors shrink-0"
            >
              <Phone className="w-4 h-4" />
              <span>{t('اتصال بالعميل', 'Call Customer')}</span>
            </a>
          )}
        </div>

        {/* Interactive Map Preview */}
        {googleMapsUrl ? (
          <div className="space-y-3">
            <div
              ref={mapContainerRef}
              className="w-full h-52 rounded-2xl overflow-hidden border border-[#EAE6E1]"
            />
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3.5 px-5 rounded-xl bg-[#1C1917] hover:bg-[#332E2A] text-white text-sm font-extrabold flex items-center justify-center gap-2 transition-colors shadow-sm"
            >
              <Navigation className="w-4 h-4 text-[#F47B20]" />
              <span>{t('التوجيه للعميل عبر خرائط جوجل', 'Navigate to Customer')}</span>
              <ExternalLink className="w-4 h-4 opacity-80" />
            </a>
          </div>
        ) : (
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>
              {t(
                'إحداثيات موقع العميل غير متوفرة لهذا الطلب.',
                'Customer coordinates are unavailable or invalid for this order.'
              )}
            </span>
          </div>
        )}
      </div>

      {/* Store & Items Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-[#EAE6E1] p-4 sm:p-5 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-[#6E6A66]">
            <Store className="w-4 h-4 text-[#D6450D]" />
            <span>{t('بيانات المتجر', 'Merchant / Store')}</span>
          </div>
          <div className="text-sm font-extrabold text-[#1C1917]">{storeName}</div>
          {order.store_address && <div className="text-xs text-[#6E6A66]">{order.store_address}</div>}
          {order.store_phone && (
            <a
              href={`tel:${order.store_phone}`}
              className="inline-flex items-center gap-1 text-xs font-bold text-[#D6450D]"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>{order.store_phone}</span>
            </a>
          )}
          {order.customer_notes && (
            <p className="text-xs text-[#6E6A66] pt-2 border-t border-[#EAE6E1]">
              {t('ملاحظات:', 'Notes:')} {order.customer_notes}
            </p>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-[#EAE6E1] p-4 sm:p-5 space-y-3">
          <div className="text-xs font-bold text-[#6E6A66]">
            {t('تفاصيل المنتجات والحساب', 'Items & Totals')}
          </div>
          <div className="divide-y divide-[#EAE6E1] text-xs">
            {order.items.map((item) => (
              <div key={item.id} className="py-2 flex items-center justify-between gap-2">
                <span className="font-semibold text-[#1C1917]">
                  {item.quantity} ×{' '}
                  {language === 'ar'
                    ? item.product_name_snapshot
                    : item.product_name_en_snapshot || item.product_name_snapshot}
                </span>
                <span className="font-bold text-[#1C1917]">
                  {formatEGP(Number(item.line_total), language)}
                </span>
              </div>
            ))}
          </div>
          <div className="pt-2 border-t border-[#EAE6E1] space-y-1 text-xs">
            <div className="flex justify-between text-[#6E6A66]">
              <span>{t('المجموع الفرعي', 'Subtotal')}</span>
              <span>{formatEGP(Number(order.subtotal), language)}</span>
            </div>
            <div className="flex justify-between text-[#6E6A66]">
              <span>{t('رسوم التوصيل', 'Delivery Fee')}</span>
              <span>{formatEGP(Number(order.delivery_fee), language)}</span>
            </div>
            <div className="flex justify-between text-sm font-extrabold text-[#1C1917] pt-1">
              <span>{t('الإجمالي المطلوب', 'Total Amount')}</span>
              <span className="text-[#D6450D]">{formatEGP(Number(order.total_amount), language)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Status Action Bar */}
      {(order.order_status === 'ready_for_delivery' || order.order_status === 'out_for_delivery') && (
        <div className="bg-white rounded-2xl border border-[#EAE6E1] p-4 flex flex-col sm:flex-row gap-3">
          {order.order_status === 'ready_for_delivery' && (
            <button
              type="button"
              disabled={busyAction}
              onClick={handleMarkOutForDelivery}
              className="flex-1 py-4 px-5 rounded-xl bg-[#D6450D] hover:bg-[#B33808] text-white text-sm font-extrabold flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
            >
              {busyAction ? <Loader2 className="w-5 h-5 animate-spin" /> : <Truck className="w-5 h-5" />}
              <span>{t('تأكيد استلام الطلب (في الطريق)', 'Mark Out for Delivery')}</span>
            </button>
          )}

          {order.order_status === 'out_for_delivery' && (
            <button
              type="button"
              disabled={busyAction}
              onClick={() => setConfirmModalOpen(true)}
              className="flex-1 py-4 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-extrabold flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
            >
              <CheckCircle2 className="w-5 h-5" />
              <span>{t('تأكيد تسليم الطلب للعميل', 'Mark as Delivered')}</span>
            </button>
          )}
        </div>
      )}

      {/* Explicit Confirmation Modal for Delivered */}
      <Modal
        open={confirmModalOpen}
        onClose={() => setConfirmModalOpen(false)}
        title={t('تأكيد تسليم الطلب', 'Confirm Order Delivery')}
        maxWidthClass="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-sm text-[#1C1917] leading-relaxed">
            {t(
              `هل تؤكد أنك قمت بتسليم الطلب #${order.order_number} واستلام المبلغ (${formatEGP(Number(order.total_amount), language)})؟`,
              `Confirm that Order #${order.order_number} (${formatEGP(Number(order.total_amount), language)}) has been delivered to the customer?`
            )}
          </p>
          <div className="flex gap-2.5">
            <button
              type="button"
              disabled={busyAction}
              onClick={handleConfirmDelivered}
              className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-extrabold inline-flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {busyAction && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{t('نعم، تم التسليم', 'Yes, Confirm Delivery')}</span>
            </button>
            <button
              type="button"
              onClick={() => setConfirmModalOpen(false)}
              className="px-4 py-3 rounded-xl border border-[#EAE6E1] text-xs sm:text-sm font-bold text-[#6E6A66]"
            >
              {t('إلغاء', 'Cancel')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

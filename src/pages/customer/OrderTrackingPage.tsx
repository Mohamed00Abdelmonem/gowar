import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Clock,
  MapPin,
  PackageCheck,
  Phone,
  Play,
  Sliders,
  Store,
  Truck,
  XCircle,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { EmptyState } from '../../components/common/EmptyState';
import { SafeImage } from '../../components/common/SafeImage';
import { formatDateTime, formatEGP, getOrderStatusMeta } from '../../utils/i18n';
import {
  CUSTOMER_PROGRESS_STEPS,
  resolveCustomerProgressStage,
} from '../../utils/deliveryTripStatus';
import { IS_BACKEND_API_ENABLED } from '../../services/apiClient';
import type { OrderStatus } from '../../types';

const DEMO_STATUS_STEPS: { key: OrderStatus; labelAr: string; labelEn: string }[] = [
  { key: 'pending', labelAr: 'وصل المحل', labelEn: 'Pending' },
  { key: 'accepted', labelAr: 'المحل قبله', labelEn: 'Accepted' },
  { key: 'preparing', labelAr: 'بيتجهز دلوقتي', labelEn: 'Preparing' },
  { key: 'out_for_delivery', labelAr: 'الطلب خرج للتوصيل', labelEn: 'Out for Delivery' },
  { key: 'delivered', labelAr: 'وصلك بالسلامة', labelEn: 'Delivered' },
];

export const OrderTrackingPage: React.FC = () => {
  const { orderId } = useParams();
  const {
    language,
    t,
    orders,
    merchants,
    updateOrderStatus,
    advanceOrderPipeline,
    cancelCustomerOrder,
    showToast,
  } = useApp();
  const [autoRunning, setAutoRunning] = useState(false);
  const [showDemoControls, setShowDemoControls] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const order = orders.find((o) => o.id === orderId);
  const store = order ? merchants.find((m) => m.id === order.merchantId) : undefined;
  const BackArrow = language === 'ar' ? ArrowRight : ArrowLeft;

  useEffect(() => {
    if (!autoRunning || !order) return;
    if (order.status === 'delivered' || order.status === 'cancelled') return;
    const timer = setTimeout(() => {
      advanceOrderPipeline(order.id);
    }, 2000);
    return () => clearTimeout(timer);
  }, [autoRunning, order, advanceOrderPipeline]);

  const isAutoRunning =
    autoRunning && Boolean(order && order.status !== 'delivered' && order.status !== 'cancelled');

  if (!order) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <EmptyState
          icon={ClipboardList}
          title={t('الطلب ده مش موجود', 'Order not found')}
          description={t('تأكد من رقم الطلب أو ارجع لقائمة طلباتك.', 'We could not find this order.')}
          action={
            <Link
              to="/orders"
              className="px-5 py-2.5 rounded-xl bg-[#1B8E53] text-white text-xs font-bold"
            >
              {t('العودة لطلباتي', 'Back to Orders')}
            </Link>
          }
        />
      </div>
    );
  }

  const statusMeta = getOrderStatusMeta(order.status, language);
  const activeStage = resolveCustomerProgressStage(
    order.status,
    order.deliveryTripStatus,
    Boolean(order.assignedDeliveryPersonId || order.assignedDeliveryPersonName)
  );
  const currentIndex = activeStage.stepIndex;

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-6 py-5 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            to="/orders"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#6E6A66] hover:text-[#1B8E53] mb-1"
          >
            <BackArrow className="w-3.5 h-3.5" />
            <span>{t('العودة لطلباتي', 'Back to My Orders')}</span>
          </Link>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-extrabold text-[#1C1917]">
              {t('متابعة الطلب', 'Order')} #{order.orderNumber}
            </h1>
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${statusMeta.badgeClass}`}
            >
              <span className={`w-2 h-2 rounded-full ${statusMeta.dotClass}`} />
              {statusMeta.label}
            </span>
          </div>
          <p className="text-xs text-[#6E6A66] mt-1">
            {t('وقت الطلب:', 'Placed on:')} {formatDateTime(order.createdAt, language)}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {order.status === 'pending' && (
            <button
              type="button"
              disabled={cancelling}
              onClick={async () => {
                setCancelling(true);
                try {
                  await cancelCustomerOrder(order.id, 'Cancelled by customer');
                } finally {
                  setCancelling(false);
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>
                {cancelling ? t('جاري الإلغاء...', 'Cancelling...') : t('إلغاء الطلب', 'Cancel Order')}
              </span>
            </button>
          )}
          {!IS_BACKEND_API_ENABLED && (
            <button
              type="button"
              onClick={() => setShowDemoControls((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#EAE6E1] bg-white text-xs font-bold text-[#6E6A66] hover:text-[#1C1917]"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>{t('محاكاة حالة الطلب', 'Demo Controls')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Clear Visual Progress Tracker */}
      <div className="bg-white rounded-2xl border border-[#EAE6E1] p-5 sm:p-6 shadow-2xs space-y-5">
        {order.status === 'cancelled' ? (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-3">
            <XCircle className="w-6 h-6 text-rose-600 shrink-0" />
            <div>
              <h3 className="text-sm font-bold text-rose-900">
                {t('الطلب اتلغى', 'Order Cancelled')}
              </h3>
              {order.rejectReason && (
                <p className="text-xs text-rose-700 mt-1">
                  {t('السبب:', 'Reason:')} {order.rejectReason}
                </p>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 font-extrabold text-[#1B8E53]">
                <Clock className="w-4 h-4" />
                {t(
                  `الطلب هيوصل خلال ${order.estimatedDeliveryMin} دقيقة تقريباً`,
                  `Estimated arrival in ${order.estimatedDeliveryMin} mins`
                )}
              </span>
              <span className="text-[#6E6A66]">
                {t('التوصيل من', 'Delivered by')}{' '}
                <strong className="text-[#1C1917]">
                  {store ? (language === 'ar' ? store.nameAr : store.nameEn) : ''}
                </strong>
              </span>
            </div>

            <div className="flex flex-col gap-3 sm:grid sm:grid-cols-6 sm:gap-2">
              {CUSTOMER_PROGRESS_STEPS.map((step, idx) => {
                const done = idx <= currentIndex;
                const active = idx === currentIndex;
                return (
                  <div
                    key={step.stage}
                    className="flex sm:flex-col items-center sm:text-center gap-3 sm:gap-2"
                  >
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center border-2 shrink-0 transition-colors ${
                        done
                          ? 'bg-[#1B8E53] border-[#1B8E53] text-white'
                          : 'bg-[#FAF9F7] border-[#EAE6E1] text-[#6E6A66]'
                      } ${active ? 'ring-4 ring-[#E6F5EC]' : ''}`}
                    >
                      {idx === 5 ? (
                        <PackageCheck className="w-4 h-4" />
                      ) : idx >= 1 && idx <= 4 ? (
                        <Truck className="w-4 h-4" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                    </div>
                    <span
                      className={`text-xs font-bold ${
                        done ? 'text-[#1C1917]' : 'text-[#6E6A66]'
                      }`}
                    >
                      {language === 'ar' ? step.labelAr : step.labelEn}
                    </span>
                  </div>
                );
              })}
            </div>

            {(order.assignedDeliveryPersonName ||
              order.deliveryTripAcceptedAt ||
              order.deliveryTripArrivedAt ||
              order.deliveredAt) && (
              <div className="rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] p-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[#6E6A66]">
                {order.assignedDeliveryPersonName && (
                  <span>
                    {t('المندوب:', 'Driver:')}{' '}
                    <strong className="text-[#1C1917]">{order.assignedDeliveryPersonName}</strong>
                  </span>
                )}
                {order.deliveryTripAcceptedAt && (
                  <span>
                    {t('قبل الرحلة:', 'Accepted:')}{' '}
                    <strong className="text-[#1C1917]">
                      {formatDateTime(order.deliveryTripAcceptedAt, language)}
                    </strong>
                  </span>
                )}
                {order.deliveryTripArrivedAt && (
                  <span>
                    {t('وصل إليك:', 'Arrived:')}{' '}
                    <strong className="text-[#1B8E53]">
                      {formatDateTime(order.deliveryTripArrivedAt, language)}
                    </strong>
                  </span>
                )}
                {order.deliveredAt && (
                  <span>
                    {t('تم التسليم:', 'Delivered:')}{' '}
                    <strong className="text-[#1B8E53]">
                      {formatDateTime(order.deliveredAt, language)}
                    </strong>
                  </span>
                )}
              </div>
            )}
          </>
        )}

        {/* Collapsible Demo Controls (Offline Demo Mode only) */}
        {!IS_BACKEND_API_ENABLED && showDemoControls && (
          <div className="pt-4 border-t border-[#EAE6E1] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                {order.status !== 'delivered' && order.status !== 'cancelled' && (
                  <button
                    type="button"
                    onClick={() => setAutoRunning((v) => !v)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                      isAutoRunning
                        ? 'bg-amber-100 text-amber-900 border border-amber-300'
                        : 'bg-[#1C1917] text-white'
                    }`}
                  >
                    <Play className="w-3 h-3" />
                    <span>
                      {isAutoRunning
                        ? t('جاري التحديث التلقائي...', 'Auto-Running...')
                        : t('تشغيل المسار تلقائياً', 'Auto-Run Pipeline')}
                    </span>
                  </button>
                )}
                <span className="text-xs font-bold text-[#6E6A66]">
                  {t('أدوات محاكاة التوصيل:', 'Demo simulation:')}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {DEMO_STATUS_STEPS.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => {
                      setAutoRunning(false);
                      updateOrderStatus(order.id, s.key);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                      order.status === s.key
                        ? 'bg-[#1B8E53] text-white border-[#1B8E53]'
                        : 'bg-[#FAF9F7] text-[#1C1917] border-[#EAE6E1]'
                    }`}
                  >
                    {language === 'ar' ? s.labelAr : s.labelEn}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Items & Store Contact */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        <div className="md:col-span-7 bg-white rounded-2xl border border-[#EAE6E1] p-5 space-y-4">
          <h2 className="text-base font-extrabold text-[#1C1917]">
            {t('الأصناف اللي طلبتها', 'Ordered Items')}
          </h2>
          <div className="divide-y divide-[#EAE6E1]">
            {order.items.map((item) => (
              <div key={item.productId} className="py-3 flex items-center gap-3">
                <SafeImage
                  src={item.image}
                  alt={item.nameAr}
                  className="w-12 h-12 rounded-xl object-cover bg-[#FAF9F7] shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[#1C1917] truncate">
                    {language === 'ar' ? item.nameAr : item.nameEn}
                  </p>
                  <p className="text-xs text-[#6E6A66]">
                    {item.quantity} × {formatEGP(item.unitPrice, language)}
                  </p>
                </div>
                <span className="text-sm font-extrabold text-[#1C1917]">
                  {formatEGP(item.unitPrice * item.quantity, language)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="md:col-span-5">
          <div className="bg-white rounded-2xl border border-[#EAE6E1] p-5 space-y-4">
            <h2 className="text-base font-extrabold text-[#1C1917]">
              {t('تفاصيل المحل والتوصيل', 'Store & Delivery')}
            </h2>

            {store && (
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1]">
                <div className="flex items-center gap-2.5">
                  <Store className="w-4 h-4 text-[#1B8E53]" />
                  <div>
                    <div className="text-xs font-bold text-[#1C1917]">
                      {language === 'ar' ? store.nameAr : store.nameEn}
                    </div>
                    <div className="text-[11px] text-[#6E6A66]">{store.phone}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    showToast(
                      t(
                        `رقم المحل: ${store.phone} (${store.nameAr})`,
                        `Store phone: ${store.phone} (${store.nameEn})`
                      ),
                      'info'
                    )
                  }
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#1B8E53] text-white text-xs font-bold"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>{t('كلم المحل', 'Call Store')}</span>
                </button>
              </div>
            )}

            <div className="text-xs text-[#6E6A66] space-y-1.5">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-[#1B8E53] shrink-0 mt-0.5" />
                <span>{language === 'ar' ? order.deliveryAddressAr : order.deliveryAddressEn}</span>
              </div>
              {order.notes && (
                <p className="p-2.5 rounded-lg bg-amber-50 text-amber-900">
                  {t('ملاحظتك:', 'Your note:')} {order.notes}
                </p>
              )}
            </div>

            <div className="border-t border-[#EAE6E1] pt-3 space-y-1.5 text-sm">
              <div className="flex justify-between text-[#6E6A66]">
                <span>{t('سعر المنتجات', 'Products')}</span>
                <span>{formatEGP(order.subtotal, language)}</span>
              </div>
              <div className="flex justify-between text-[#6E6A66]">
                <span>{t('التوصيل', 'Delivery')}</span>
                <span>{formatEGP(order.deliveryFee, language)}</span>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>{t('الخصم', 'Discount')}</span>
                  <span>-{formatEGP(order.discount, language)}</span>
                </div>
              )}
              <div className="flex justify-between font-extrabold text-base pt-1 text-[#1C1917]">
                <span>{t('الإجمالي', 'Total')}</span>
                <span className="text-[#1B8E53]">{formatEGP(order.total, language)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

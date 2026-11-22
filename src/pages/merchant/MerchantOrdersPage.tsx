import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Check,
  ClipboardList,
  Clock,
  MapPin,
  Phone,
  Play,
  Truck,
  UserCheck,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { EmptyState } from '../../components/common/EmptyState';
import { Modal } from '../../components/common/Modal';
import { SafeImage } from '../../components/common/SafeImage';
import { IS_BACKEND_API_ENABLED } from '../../services/apiClient';
import { merchantDeliveryApi, type AssignableDriverOption } from '../../services/gowarApi';
import { formatDateTime, formatEGP, getOrderStatusMeta } from '../../utils/i18n';
import type { Order, OrderStatus } from '../../types';

const REJECT_REASONS_AR = [
  'المنتج غير متوفر حالياً بالمخزن',
  'المندوب غير متاح في الوقت الحالي',
  'العنوان خارج نطاق التوصيل',
  'المحل مزدحم جداً ولا يمكن تجهيز الطلب الآن',
];

const PIPELINE_STEPS: { key: OrderStatus; ar: string; en: string }[] = [
  { key: 'pending', ar: 'جديد', en: 'New' },
  { key: 'accepted', ar: 'مقبول', en: 'Accepted' },
  { key: 'preparing', ar: 'تجهيز', en: 'Preparing' },
  { key: 'out_for_delivery', ar: 'في الطريق', en: 'Courier' },
  { key: 'delivered', ar: 'مكتمل', en: 'Delivered' },
];

export const MerchantOrdersPage: React.FC = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const {
    language,
    t,
    activeMerchant,
    orders,
    updateOrderStatus,
    advanceOrderPipeline,
    showToast,
  } = useApp();

  const [tab, setTab] = useState<'all' | 'pending' | 'accepted' | 'preparing' | 'out_for_delivery' | 'delivered' | 'cancelled'>('all');
  const [rejectModalOrder, setRejectModalOrder] = useState<Order | null>(null);
  const [rejectReason, setRejectReason] = useState(REJECT_REASONS_AR[0]);
  const [autoRunningOrderId, setAutoRunningOrderId] = useState<string | null>(null);
  const [assignModalOrder, setAssignModalOrder] = useState<Order | null>(null);
  const [assignableDrivers, setAssignableDrivers] = useState<AssignableDriverOption[]>([]);
  const [driversLoading, setDriversLoading] = useState(false);
  const [assigningDriverId, setAssigningDriverId] = useState<string | null>(null);

  const openAssignModal = async (order: Order) => {
    setAssignModalOrder(order);
    if (!IS_BACKEND_API_ENABLED) return;
    setDriversLoading(true);
    try {
      const list = await merchantDeliveryApi.listAssignableDrivers();
      setAssignableDrivers(list);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : t('تعذر تحميل قائمة المناديب', 'Failed to load drivers'),
        'error'
      );
      setAssignableDrivers([]);
    } finally {
      setDriversLoading(false);
    }
  };

  const handleAssignDriver = async (driverUserId: string) => {
    if (!assignModalOrder) return;
    setAssigningDriverId(driverUserId);
    try {
      await merchantDeliveryApi.assignOrder(assignModalOrder.id, driverUserId);
      showToast(t('تم إسناد الطلب للمندوب بنجاح', 'Order assigned to driver'), 'success');
      setAssignModalOrder(null);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : t('تعذر إسناد الطلب', 'Failed to assign order'),
        'error'
      );
    } finally {
      setAssigningDriverId(null);
    }
  };

  const storeOrders = useMemo(
    () => orders.filter((o) => o.merchantId === activeMerchant.id),
    [orders, activeMerchant.id]
  );

  const selectedOrder = orderId ? storeOrders.find((o) => o.id === orderId) ?? null : null;

  useEffect(() => {
    if (!autoRunningOrderId) return;
    const target = orders.find((o) => o.id === autoRunningOrderId);
    if (!target || target.status === 'delivered' || target.status === 'cancelled') {
      return;
    }
    const timer = setTimeout(() => {
      advanceOrderPipeline(autoRunningOrderId);
    }, 1800);
    return () => clearTimeout(timer);
  }, [autoRunningOrderId, orders, advanceOrderPipeline]);

  const filteredOrders = useMemo(() => {
    return storeOrders.filter((o) => {
      if (tab === 'all') return true;
      return o.status === tab;
    });
  }, [storeOrders, tab]);

  const tabs = [
    { id: 'all', label: t('كل الطلبات', 'All Orders'), count: storeOrders.length },
    {
      id: 'pending',
      label: t('طلبات جديدة', 'New Orders'),
      count: storeOrders.filter((o) => o.status === 'pending').length,
    },
    {
      id: 'accepted',
      label: t('مقبولة', 'Accepted'),
      count: storeOrders.filter((o) => o.status === 'accepted').length,
    },
    {
      id: 'preparing',
      label: t('جاري التجهيز', 'Preparing'),
      count: storeOrders.filter((o) => o.status === 'preparing').length,
    },
    {
      id: 'out_for_delivery',
      label: t('في الطريق', 'Out for Delivery'),
      count: storeOrders.filter((o) => o.status === 'out_for_delivery').length,
    },
    {
      id: 'delivered',
      label: t('مكتملة', 'Completed'),
      count: storeOrders.filter((o) => o.status === 'delivered').length,
    },
    {
      id: 'cancelled',
      label: t('ملغاة', 'Cancelled'),
      count: storeOrders.filter((o) => o.status === 'cancelled').length,
    },
  ];

  const renderActions = (order: Order) => {
    const nextActionMap: Partial<Record<OrderStatus, { next: OrderStatus; label: string }>> = {
      accepted: { next: 'preparing', label: t('بدء التجهيز', 'Start Preparing') },
      preparing: { next: 'out_for_delivery', label: t('خرج للتوصيل', 'Out for Delivery') },
      out_for_delivery: { next: 'delivered', label: t('تم التسليم للعميل', 'Mark Delivered') },
    };

    if (order.status === 'pending') {
      return (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => updateOrderStatus(order.id, 'accepted')}
            className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl bg-[#D6450D] hover:bg-[#B33808] text-white text-xs font-bold"
          >
            <Check className="w-3.5 h-3.5" />
            <span>{t('قبول الطلب', 'Accept Order')}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setRejectModalOrder(order);
              setRejectReason(REJECT_REASONS_AR[0]);
            }}
            className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold"
          >
            <X className="w-3.5 h-3.5" />
            <span>{t('رفض', 'Reject')}</span>
          </button>
        </div>
      );
    }

    const nextAction = nextActionMap[order.status];
    if (nextAction) {
      return (
        <div className="flex flex-wrap items-center gap-2">
          {IS_BACKEND_API_ENABLED && (
            <button
              type="button"
              onClick={() => void openAssignModal(order)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#EAE6E1] bg-white hover:border-[#D6450D] text-xs font-bold text-[#1C1917]"
            >
              <UserCheck className="w-3.5 h-3.5 text-[#D6450D]" />
              <span>{t('إسناد لمندوب', 'Assign Driver')}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => updateOrderStatus(order.id, nextAction.next)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#D6450D] hover:bg-[#B33808] text-white text-xs font-bold"
          >
            <Truck className="w-3.5 h-3.5" />
            <span>{nextAction.label}</span>
          </button>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-[#1C1917]">
          {t('إدارة الطلبات', 'Orders Management')}
        </h1>
        <p className="text-xs text-[#6E6A66]">
          {t(
            'استقبل الطلبات وحدّث حالتها خطوة بخطوة ليراها العميل فوراً',
            'Accept and update order statuses step-by-step for real-time customer tracking'
          )}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id as typeof tab)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
              tab === item.id
                ? 'bg-[#D6450D] text-white'
                : 'bg-white border border-[#EAE6E1] text-[#1C1917] hover:border-[#D6450D]'
            }`}
          >
            <span>{item.label}</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                tab === item.id ? 'bg-white/20 text-white' : 'bg-[#FAF9F7] text-[#6E6A66]'
              }`}
            >
              {item.count}
            </span>
          </button>
        ))}
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={t('لا توجد طلبات في هذا القسم', 'No orders in this tab')}
          description={t('ستظهر الطلبات الجديدة هنا فور قيام العملاء بالطلب من محلك.', 'New customer orders for your store will appear here immediately.')}
        />
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => {
            const statusMeta = getOrderStatusMeta(order.status, language);
            return (
              <div
                key={order.id}
                className="bg-white rounded-2xl border border-[#EAE6E1] p-4 sm:p-5 shadow-2xs space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#EAE6E1]">
                  <div className="flex items-center gap-2.5">
                    <span className="text-base font-extrabold text-[#1C1917]">
                      #{order.orderNumber}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${statusMeta.badgeClass}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dotClass}`} />
                      {statusMeta.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-[#6E6A66]">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {formatDateTime(order.createdAt, language)}
                    </span>
                    <button
                      type="button"
                      onClick={() => navigate(`/merchant/orders/${order.id}`)}
                      className="text-[#D6450D] font-bold hover:underline"
                    >
                      {t('فتح التفاصيل', 'Inspect')}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                  <div className="md:col-span-4 space-y-1">
                    <div className="text-sm font-bold text-[#1C1917]">{order.customerName}</div>
                    <div className="text-xs text-[#6E6A66] inline-flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-[#D6450D]" />
                      {order.customerPhone}
                    </div>
                    <div className="text-xs text-[#6E6A66] flex items-start gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-[#D6450D] shrink-0 mt-0.5" />
                      <span className="line-clamp-2">
                        {language === 'ar' ? order.deliveryAddressAr : order.deliveryAddressEn}
                      </span>
                    </div>
                  </div>

                  <div className="md:col-span-4 text-xs space-y-1">
                    <div className="font-bold text-[#6E6A66]">
                      {t('المنتجات المطلوبة', 'Items')} ({order.items.length})
                    </div>
                    {order.items.slice(0, 3).map((item) => (
                      <div key={item.productId} className="text-[#1C1917] truncate">
                        <strong className="text-[#D6450D]">{item.quantity}×</strong>{' '}
                        {language === 'ar' ? item.nameAr : item.nameEn}
                      </div>
                    ))}
                    {order.items.length > 3 && (
                      <span className="text-[11px] text-[#6E6A66]">
                        +{order.items.length - 3} {t('أصناف أخرى', 'more items')}
                      </span>
                    )}
                  </div>

                  <div className="md:col-span-4 flex flex-col sm:flex-row md:flex-col lg:flex-row items-start sm:items-center md:items-end justify-between gap-3">
                    <div>
                      <span className="text-[11px] text-[#6E6A66] block">
                        {t('إجمالي الفاتورة', 'Order Total')}
                      </span>
                      <span className="text-lg font-extrabold text-[#D6450D]">
                        {formatEGP(order.total, language)}
                      </span>
                    </div>
                    {renderActions(order)}
                  </div>
                </div>

                {/* Compact Order Pipeline Progress Bar */}
                {order.status !== 'cancelled' && (
                  <div className="pt-3 border-t border-[#EAE6E1]">
                    <div className="grid grid-cols-5 gap-1.5">
                      {PIPELINE_STEPS.map((step, idx) => {
                        const currentIdx = PIPELINE_STEPS.findIndex((s) => s.key === order.status);
                        const done = idx <= currentIdx;
                        return (
                          <div key={step.key} className="space-y-1">
                            <div
                              className={`h-1.5 rounded-full transition-colors ${
                                done ? 'bg-[#D6450D]' : 'bg-[#EAE6E1]'
                              }`}
                            />
                            <span
                              className={`block text-[10px] font-bold text-center truncate ${
                                done ? 'text-[#D6450D]' : 'text-[#6E6A66]'
                              }`}
                            >
                              {language === 'ar' ? step.ar : step.en}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Order Detail Drawer / Modal */}
      <Modal
        open={Boolean(selectedOrder)}
        onClose={() => navigate('/merchant/orders')}
        title={
          selectedOrder ? `${t('تفاصيل الطلب', 'Order Details')} #${selectedOrder.orderNumber}` : ''
        }
        maxWidthClass="max-w-xl"
      >
        {selectedOrder && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-[#6E6A66]">{t('العميل:', 'Customer:')}</span>
                <strong className="text-[#1C1917]">{selectedOrder.customerName}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6E6A66]">{t('الموبايل:', 'Phone:')}</span>
                <strong className="text-[#1C1917]">{selectedOrder.customerPhone}</strong>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-[#6E6A66] shrink-0">{t('العنوان:', 'Address:')}</span>
                <span className="text-end text-[#1C1917]">
                  {language === 'ar'
                    ? selectedOrder.deliveryAddressAr
                    : selectedOrder.deliveryAddressEn}
                </span>
              </div>
              {selectedOrder.notes && (
                <div className="pt-1 text-amber-800 font-medium">
                  {t('ملاحظات:', 'Notes:')} {selectedOrder.notes}
                </div>
              )}
            </div>

            <div className="divide-y divide-[#EAE6E1]">
              {selectedOrder.items.map((item) => (
                <div key={item.productId} className="py-2.5 flex items-center gap-3">
                  <SafeImage
                    src={item.image}
                    alt={item.nameAr}
                    className="w-11 h-11 rounded-xl object-cover bg-[#FAF9F7]"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-[#1C1917] truncate">
                      {language === 'ar' ? item.nameAr : item.nameEn}
                    </p>
                    <p className="text-[11px] text-[#6E6A66]">
                      {item.quantity} × {formatEGP(item.unitPrice, language)}
                    </p>
                  </div>
                  <span className="text-xs font-extrabold text-[#1C1917]">
                    {formatEGP(item.unitPrice * item.quantity, language)}
                  </span>
                </div>
              ))}
            </div>

            <div className="border-t border-[#EAE6E1] pt-3 space-y-1.5 text-xs">
              <div className="flex justify-between text-[#6E6A66]">
                <span>{t('المنتجات', 'Subtotal')}</span>
                <span>{formatEGP(selectedOrder.subtotal, language)}</span>
              </div>
              <div className="flex justify-between text-[#6E6A66]">
                <span>{t('رسوم التوصيل', 'Delivery Fee')}</span>
                <span>{formatEGP(selectedOrder.deliveryFee, language)}</span>
              </div>
              <div className="flex justify-between text-base font-extrabold text-[#D6450D] pt-1">
                <span>{t('الإجمالي', 'Total')}</span>
                <span>{formatEGP(selectedOrder.total, language)}</span>
              </div>
            </div>

            {selectedOrder.statusHistory && selectedOrder.statusHistory.length > 0 && (
              <div className="border-t border-[#EAE6E1] pt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-[#1C1917]">
                    {t('مسار تنفيذ الطلب (Pipeline)', 'Order Pipeline History')}
                  </span>
                  {selectedOrder.status !== 'delivered' && selectedOrder.status !== 'cancelled' && (
                    <button
                      type="button"
                      onClick={() =>
                        setAutoRunningOrderId((curr) =>
                          curr === selectedOrder.id ? null : selectedOrder.id
                        )
                      }
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#1C1917] text-white text-[11px] font-bold"
                    >
                      <Play className="w-3 h-3" />
                      <span>
                        {autoRunningOrderId === selectedOrder.id
                          ? t('إيقاف التشغيل التلقائي', 'Stop Auto-Run')
                          : t('تشغيل المسار تلقائياً', 'Auto-Advance Pipeline')}
                      </span>
                    </button>
                  )}
                </div>
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {selectedOrder.statusHistory.map((ev, idx) => {
                    const evMeta = getOrderStatusMeta(ev.status, language);
                    return (
                      <div
                        key={`${ev.status}-${idx}`}
                        className="flex items-center justify-between gap-2 text-[11px] p-2 rounded-lg bg-[#FAF9F7]"
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${evMeta.dotClass}`} />
                          <strong className="text-[#1C1917] shrink-0">{evMeta.label}</strong>
                          <span className="text-[#6E6A66] truncate">
                            {language === 'ar' ? ev.noteAr : ev.noteEn}
                          </span>
                        </div>
                        <span className="text-[#6E6A66] shrink-0">
                          {formatDateTime(ev.timestamp, language)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">{renderActions(selectedOrder)}</div>
          </div>
        )}
      </Modal>

      {/* Reject Reason Modal */}
      <Modal
        open={Boolean(rejectModalOrder)}
        onClose={() => setRejectModalOrder(null)}
        title={t('سبب رفض الطلب', 'Select Rejection Reason')}
        maxWidthClass="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-xs text-[#6E6A66]">
            {t(
              'اختر سبب الرفض ليظهر للعميل بوضوح:',
              'Select a clear reason to notify the customer:'
            )}
          </p>
          <div className="space-y-2">
            {REJECT_REASONS_AR.map((reason) => (
              <label
                key={reason}
                className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer text-xs font-semibold ${
                  rejectReason === reason
                    ? 'border-rose-500 bg-rose-50 text-rose-900'
                    : 'border-[#EAE6E1]'
                }`}
              >
                <input
                  type="radio"
                  name="rejectReason"
                  checked={rejectReason === reason}
                  onChange={() => setRejectReason(reason)}
                  className="accent-rose-600"
                />
                <span>{reason}</span>
              </label>
            ))}
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setRejectModalOrder(null)}
              className="flex-1 py-2.5 rounded-xl border border-[#EAE6E1] text-xs font-bold"
            >
              {t('تراجع', 'Cancel')}
            </button>
            <button
              type="button"
              onClick={() => {
                if (rejectModalOrder) {
                  updateOrderStatus(rejectModalOrder.id, 'cancelled', rejectReason);
                  setRejectModalOrder(null);
                }
              }}
              className="flex-1 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-bold"
            >
              {t('تأكيد الرفض', 'Confirm Rejection')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Assign / Reassign Delivery Driver Modal */}
      <Modal
        open={Boolean(assignModalOrder)}
        onClose={() => setAssignModalOrder(null)}
        title={t('إسناد الطلب لمندوب توصيل', 'Assign Order to Delivery Driver')}
        maxWidthClass="max-w-md"
      >
        <div className="space-y-3">
          {assignModalOrder && (
            <div className="p-3 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] text-xs">
              <div className="font-bold text-[#1C1917]">
                {t('طلب رقم:', 'Order #')} {assignModalOrder.orderNumber}
              </div>
              <div className="text-[#6E6A66] mt-0.5">
                {language === 'ar'
                  ? assignModalOrder.deliveryAddressAr
                  : assignModalOrder.deliveryAddressEn}
              </div>
            </div>
          )}

          {driversLoading ? (
            <div className="py-6 text-center text-xs text-[#6E6A66]">
              {t('جاري تحميل مناديب متجرك...', 'Loading your delivery team...')}
            </div>
          ) : assignableDrivers.length === 0 ? (
            <div className="py-6 text-center text-xs text-[#6E6A66]">
              {t(
                'لا يوجد مناديب نشطين في فريقك حالياً. أضف مندوباً من قسم إدارة التوصيل.',
                'No active drivers in your team yet. Add a driver in Delivery Management.'
              )}
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {assignableDrivers.map((drv) => (
                <div
                  key={drv.id}
                  className="flex items-center justify-between gap-2 p-3 rounded-xl border border-[#EAE6E1] bg-white"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-[#1C1917] truncate">
                      {drv.full_name}
                    </div>
                    <div className="text-[11px] text-[#6E6A66]">
                      {drv.phone_number} • {t('طلبات نشطة:', 'Active:')} {drv.active_orders_count} •{' '}
                      <span className="font-semibold">{drv.operational_status}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={assigningDriverId === drv.id}
                    onClick={() => void handleAssignDriver(drv.id)}
                    className="px-3.5 py-2 rounded-xl bg-[#D6450D] hover:bg-[#B33808] text-white text-xs font-extrabold shrink-0 disabled:opacity-60"
                  >
                    {assigningDriverId === drv.id
                      ? t('جاري الإسناد...', 'Assigning...')
                      : t('إسناد', 'Assign')}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

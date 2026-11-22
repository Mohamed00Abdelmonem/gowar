import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Modal } from '../../components/common/Modal';
import { formatDateTime, formatEGP, getOrderStatusMeta } from '../../utils/i18n';
import { IS_BACKEND_API_ENABLED } from '../../services/apiClient';
import type { Order, OrderStatus } from '../../types';

export const AdminOrdersPage: React.FC = () => {
  const { language, t, orders, merchants, areas, customers, refundAdminOrder } = useApp();
  const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus>('all');
  const [merchantFilter, setMerchantFilter] = useState('all');
  const [areaFilter, setAreaFilter] = useState('all');
  const [customerFilter, setCustomerFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refunding, setRefunding] = useState(false);

  const openOrderModal = (o: Order) => {
    setSelectedOrder(o);
    setRefundAmount(String(o.total));
    setRefundReason('Customer requested refund');
  };

  const filtered = useMemo(() => {
    const fromTime = dateFrom ? new Date(`${dateFrom}T00:00:00Z`).getTime() : null;
    const toTime = dateTo ? new Date(`${dateTo}T23:59:59Z`).getTime() : null;
    return orders.filter((o) => {
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;
      if (merchantFilter !== 'all' && o.merchantId !== merchantFilter) return false;
      if (areaFilter !== 'all' && o.areaId !== areaFilter) return false;
      if (customerFilter !== 'all' && o.customerId !== customerFilter) return false;
      const tms = new Date(o.createdAt).getTime();
      if (fromTime !== null && tms < fromTime) return false;
      if (toTime !== null && tms > toTime) return false;
      return true;
    });
  }, [orders, statusFilter, merchantFilter, areaFilter, customerFilter, dateFrom, dateTo]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-[#1C1917]">
          {t('مراقبة طلبات المنصة', 'Platform Orders')}
        </h1>
        <p className="text-xs text-[#6E6A66]">
          {t('عرض وتصفية جميع الطلبات عبر كل المتاجر والأحياء والعملاء', 'Inspect orders across all stores, areas, and customers')}
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-[#EAE6E1] p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="px-3 py-2.5 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] text-xs font-bold"
        >
          <option value="all">{t('كل الحالات', 'All Statuses')}</option>
          <option value="pending">{t('قيد المراجعة', 'Pending')}</option>
          <option value="accepted">{t('تم القبول', 'Accepted')}</option>
          <option value="preparing">{t('جاري التجهيز', 'Preparing')}</option>
          <option value="out_for_delivery">{t('في الطريق', 'Out for Delivery')}</option>
          <option value="delivered">{t('تم التوصيل', 'Delivered')}</option>
          <option value="cancelled">{t('ملغي', 'Cancelled')}</option>
        </select>

        <select
          value={merchantFilter}
          onChange={(e) => setMerchantFilter(e.target.value)}
          className="px-3 py-2.5 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] text-xs font-bold"
        >
          <option value="all">{t('كل التجار', 'All Merchants')}</option>
          {merchants.map((m) => (
            <option key={m.id} value={m.id}>
              {language === 'ar' ? m.nameAr : m.nameEn}
            </option>
          ))}
        </select>

        <select
          value={areaFilter}
          onChange={(e) => setAreaFilter(e.target.value)}
          className="px-3 py-2.5 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] text-xs font-bold"
        >
          <option value="all">{t('كل المناطق', 'All Areas')}</option>
          {areas.map((a) => (
            <option key={a.id} value={a.id}>
              {language === 'ar' ? a.nameAr : a.nameEn}
            </option>
          ))}
        </select>

        <select
          value={customerFilter}
          onChange={(e) => setCustomerFilter(e.target.value)}
          className="px-3 py-2.5 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] text-xs font-bold"
        >
          <option value="all">{t('كل العملاء', 'All Customers')}</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {language === 'ar' ? c.nameAr : c.nameEn}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          aria-label={t('من تاريخ', 'From date')}
          className="px-3 py-2.5 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] text-xs font-bold"
        />

        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          aria-label={t('إلى تاريخ', 'To date')}
          className="px-3 py-2.5 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] text-xs font-bold"
        />
      </div>

      <div className="bg-white rounded-2xl border border-[#EAE6E1] overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs">
            <thead className="bg-[#FAF9F7] text-[#6E6A66]">
              <tr>
                <th className="py-3 px-4 font-bold text-start">{t('الطلب', 'Order #')}</th>
                <th className="py-3 px-4 font-bold text-start">{t('المحل', 'Store')}</th>
                <th className="py-3 px-4 font-bold text-start">{t('العميل', 'Customer')}</th>
                <th className="py-3 px-4 font-bold text-start">{t('الإجمالي', 'Total')}</th>
                <th className="py-3 px-4 font-bold text-start">{t('العمولة', 'Commission')}</th>
                <th className="py-3 px-4 font-bold text-start">{t('الحالة', 'Status')}</th>
                <th className="py-3 px-4 font-bold text-start">{t('التفاصيل', 'Inspect')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EAE6E1]">
              {filtered.map((o) => {
                const store = merchants.find((m) => m.id === o.merchantId);
                const sm = getOrderStatusMeta(o.status, language);
                return (
                  <tr key={o.id} className="hover:bg-[#FAF9F7]/70">
                    <td className="py-3 px-4 font-extrabold text-[#1C1917]">
                      #{o.orderNumber}
                      <span className="block text-[10px] text-[#6E6A66] font-normal">
                        {formatDateTime(o.createdAt, language)}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-[#1B8E53]">
                      {store ? (language === 'ar' ? store.nameAr : store.nameEn) : o.merchantId}
                    </td>
                    <td className="py-3 px-4">{o.customerName}</td>
                    <td className="py-3 px-4 font-extrabold">{formatEGP(o.total, language)}</td>
                    <td className="py-3 px-4 text-[#1B8E53] font-bold">
                      {formatEGP(o.platformCommission, language)}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${sm.badgeClass}`}>
                        {sm.label}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => openOrderModal(o)}
                        className="text-[#1B8E53] font-bold hover:underline"
                      >
                        {t('معاينة', 'View')}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={Boolean(selectedOrder)}
        onClose={() => setSelectedOrder(null)}
        title={selectedOrder ? `${t('طلب', 'Order')} #${selectedOrder.orderNumber}` : ''}
      >
        {selectedOrder && (
          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-xl bg-[#FAF9F7] space-y-1">
              <div>
                <strong>{t('العميل:', 'Customer:')}</strong> {selectedOrder.customerName} ({selectedOrder.customerPhone})
              </div>
              <div>
                <strong>{t('العنوان:', 'Address:')}</strong>{' '}
                {language === 'ar' ? selectedOrder.deliveryAddressAr : selectedOrder.deliveryAddressEn}
              </div>
            </div>
            <div className="divide-y divide-[#EAE6E1]">
              {selectedOrder.items.map((item) => (
                <div key={item.productId} className="py-2 flex justify-between">
                  <span>
                    {item.quantity}× {language === 'ar' ? item.nameAr : item.nameEn}
                  </span>
                  <strong>{formatEGP(item.unitPrice * item.quantity, language)}</strong>
                </div>
              ))}
            </div>
            <div className="border-t border-[#EAE6E1] pt-2 flex justify-between text-sm font-extrabold text-[#1B8E53]">
              <span>{t('الإجمالي', 'Total')}</span>
              <span>{formatEGP(selectedOrder.total, language)}</span>
            </div>

            {IS_BACKEND_API_ENABLED && selectedOrder.status === 'delivered' && (
              <div className="pt-3 border-t border-[#EAE6E1] space-y-2.5">
                <div className="text-xs font-extrabold text-[#1C1917]">
                  {t('استرجاع قيمة الطلب (Refund)', 'Issue Order Refund')}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="number"
                    min="1"
                    max={selectedOrder.total}
                    step="0.5"
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                    placeholder={t('المبلغ', 'Amount')}
                    className="px-3 py-2 rounded-xl border border-[#EAE6E1] text-xs font-bold"
                  />
                  <input
                    type="text"
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                    placeholder={t('سبب الاسترجاع', 'Refund reason')}
                    className="px-3 py-2 rounded-xl border border-[#EAE6E1] text-xs"
                  />
                </div>
                <button
                  type="button"
                  disabled={refunding}
                  onClick={async () => {
                    setRefunding(true);
                    try {
                      await refundAdminOrder(
                        selectedOrder.id,
                        Number(refundAmount) || selectedOrder.total,
                        refundReason.trim() || 'Admin refund'
                      );
                      setSelectedOrder(null);
                    } finally {
                      setRefunding(false);
                    }
                  }}
                  className="w-full py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-xs font-bold"
                >
                  {refunding
                    ? t('جاري تنفيذ الاسترجاع...', 'Processing Refund...')
                    : t('تنفيذ استرجاع مالي', 'Issue Refund')}
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

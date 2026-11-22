import React from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, Clock, Store } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { EmptyState } from '../../components/common/EmptyState';
import { formatDateTime, formatEGP, getOrderStatusMeta } from '../../utils/i18n';

export const OrdersPage: React.FC = () => {
  const { language, t, orders, activeCustomer, merchants } = useApp();

  const myOrders = orders.filter((o) => o.customerId === activeCustomer.id);

  if (myOrders.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <EmptyState
          icon={ClipboardList}
          title={t('لا توجد طلبات حتى الآن', 'No orders yet')}
          description={t('اطلب احتياجاتك من أقرب محل وتابع حالة التوصيل لحظة بلحظة.', 'Place your first order from a nearby store and track it live.')}
          action={
            <Link
              to="/stores"
              className="px-5 py-2.5 rounded-xl bg-[#1B8E53] text-white text-xs font-bold"
            >
              {t('تصفح المحلات', 'Browse Stores')}
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-6 py-6 space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-[#1C1917]">
          {t('طلباتي', 'My Orders')}
        </h1>
        <p className="text-xs text-[#6E6A66]">
          {t('تابع حالة طلباتك الحالية وسجل الطلبات السابقة', 'Track active orders and view order history')}
        </p>
      </div>

      <div className="space-y-3">
        {myOrders.map((order) => {
          const store = merchants.find((m) => m.id === order.merchantId);
          const statusMeta = getOrderStatusMeta(order.status, language);
          return (
            <Link
              key={order.id}
              to={`/orders/${order.id}`}
              className="block bg-white rounded-2xl border border-[#EAE6E1] p-4 sm:p-5 hover:border-[#1B8E53] hover:shadow-xs transition-all"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#EAE6E1]">
                <div className="flex items-center gap-2.5">
                  <span className="text-sm font-extrabold text-[#1C1917]">
                    #{order.orderNumber}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${statusMeta.badgeClass}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dotClass}`} />
                    {statusMeta.label}
                  </span>
                </div>
                <span className="text-xs text-[#6E6A66] inline-flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {formatDateTime(order.createdAt, language)}
                </span>
              </div>

              <div className="pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-sm font-bold text-[#1B8E53]">
                    <Store className="w-4 h-4" />
                    <span>
                      {store ? (language === 'ar' ? store.nameAr : store.nameEn) : order.merchantId}
                    </span>
                  </div>
                  <p className="text-xs text-[#6E6A66]">
                    {order.items.length} {t('منتجات', 'items')} •{' '}
                    {language === 'ar' ? order.deliveryAddressAr : order.deliveryAddressEn}
                  </p>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-4">
                  <div className="text-end">
                    <span className="text-[11px] text-[#6E6A66] block">
                      {t('الإجمالي', 'Total')}
                    </span>
                    <span className="text-base font-extrabold text-[#1C1917]">
                      {formatEGP(order.total, language)}
                    </span>
                  </div>
                  <span className="px-3.5 py-2 rounded-xl bg-[#E6F5EC] text-[#1B8E53] text-xs font-bold">
                    {t('تتبع الطلب', 'Track Order')}
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

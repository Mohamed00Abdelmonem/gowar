import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Eye,
  MapPin,
  Phone,
  Repeat,
  Search,
  ShoppingBag,
  Users,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Modal } from '../../components/common/Modal';
import { EmptyState } from '../../components/common/EmptyState';
import {
  formatDateOnly,
  formatDateTime,
  formatEGP,
  formatNumber,
  getOrderStatusMeta,
} from '../../utils/i18n';
import type { Order } from '../../types';

interface StoreCustomerRow {
  id: string;
  name: string;
  phone: string;
  areaLabel: string;
  orderCount: number;
  deliveredCount: number;
  totalSpent: number;
  lastOrderDate: string;
  orders: Order[];
}

export const MerchantCustomersPage: React.FC = () => {
  const { language, t, activeMerchant, orders, customers, areas } = useApp();
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<StoreCustomerRow | null>(null);

  const areaMap = useMemo(() => new Map(areas.map((a) => [a.id, a])), [areas]);
  const customerProfileMap = useMemo(
    () => new Map(customers.map((c) => [c.id, c])),
    [customers]
  );

  const storeCustomers = useMemo<StoreCustomerRow[]>(() => {
    const storeOrders = orders.filter((o) => o.merchantId === activeMerchant.id);
    const grouped = new Map<string, StoreCustomerRow>();

    storeOrders.forEach((order) => {
      const profile = customerProfileMap.get(order.customerId);
      const area = areaMap.get(order.areaId);
      const areaLabel = area
        ? language === 'ar'
          ? area.nameAr
          : area.nameEn
        : language === 'ar'
        ? order.deliveryAddressAr
        : order.deliveryAddressEn;

      const existing = grouped.get(order.customerId);
      const isDelivered = order.status === 'delivered';
      if (!existing) {
        grouped.set(order.customerId, {
          id: order.customerId,
          name: profile
            ? language === 'ar'
              ? profile.nameAr
              : profile.nameEn
            : order.customerName,
          phone: profile?.phone ?? order.customerPhone,
          areaLabel,
          orderCount: 1,
          deliveredCount: isDelivered ? 1 : 0,
          totalSpent: isDelivered ? order.total : 0,
          lastOrderDate: order.createdAt,
          orders: [order],
        });
      } else {
        existing.orderCount += 1;
        if (isDelivered) {
          existing.deliveredCount += 1;
          existing.totalSpent += order.total;
        }
        if (order.createdAt > existing.lastOrderDate) {
          existing.lastOrderDate = order.createdAt;
        }
        existing.orders.push(order);
      }
    });

    return Array.from(grouped.values())
      .map((row) => ({
        ...row,
        orders: [...row.orders].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ),
      }))
      .sort((a, b) => b.totalSpent - a.totalSpent);
  }, [orders, activeMerchant.id, customerProfileMap, areaMap, language]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return storeCustomers;
    return storeCustomers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.areaLabel.toLowerCase().includes(q)
    );
  }, [storeCustomers, search]);

  const returningCount = storeCustomers.filter((c) => c.orderCount >= 2).length;
  const totalRevenueFromCustomers = storeCustomers.reduce((s, c) => s + c.totalSpent, 0);
  const avgSpend =
    storeCustomers.length > 0
      ? Math.round(totalRevenueFromCustomers / storeCustomers.length)
      : 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#1C1917]">
            {t('عملاء المتجر', 'Store Customers')}
          </h1>
          <p className="text-xs text-[#6E6A66]">
            {t(
              'العملاء الذين قاموا بالطلب من متجرك فقط ومعدل تكرار الشراء',
              'Shoppers who ordered from your store and their purchase frequency'
            )}
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-[#6E6A66] absolute top-1/2 -translate-y-1/2 start-3.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('ابحث باسم العميل أو الموبايل...', 'Search name or phone...')}
            className="w-full ps-10 pe-3.5 py-2.5 rounded-xl bg-white border border-[#EAE6E1] text-xs font-medium"
          />
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-[#EAE6E1] p-4 flex items-center gap-3.5 shadow-2xs">
          <div className="w-11 h-11 rounded-xl bg-[#E6F5EC] text-[#1B8E53] flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-[#6E6A66]">{t('إجمالي عملاء المحل', 'Total Store Customers')}</div>
            <div className="text-xl font-extrabold text-[#1C1917]">
              {formatNumber(storeCustomers.length, language)}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#EAE6E1] p-4 flex items-center gap-3.5 shadow-2xs">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
            <Repeat className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-[#6E6A66]">{t('عملاء متكررون (طلبين فأكثر)', 'Returning Customers (2+ orders)')}</div>
            <div className="text-xl font-extrabold text-[#1C1917]">
              {formatNumber(returningCount, language)}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#EAE6E1] p-4 flex items-center gap-3.5 shadow-2xs">
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-[#6E6A66]">{t('متوسط إنفاق العميل (مكتمل)', 'Avg. Delivered Spend / Customer')}</div>
            <div className="text-xl font-extrabold text-[#1B8E53]">
              {formatEGP(avgSpend, language)}
            </div>
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title={t('لا يوجد عملاء مطابقين', 'No matching customers')}
          description={t(
            'لم يتم العثور على عملاء بناءً على بحثك الحالي.',
            'No store customers match your current search.'
          )}
        />
      ) : (
        <div className="bg-white rounded-2xl border border-[#EAE6E1] shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead className="bg-[#FAF9F7] text-[#6E6A66]">
                <tr>
                  <th className="py-3 px-4 font-bold text-start">{t('العميل', 'Customer')}</th>
                  <th className="py-3 px-4 font-bold text-start">{t('المنطقة', 'Area')}</th>
                  <th className="py-3 px-4 font-bold text-start">{t('عدد الطلبات', 'Orders')}</th>
                  <th className="py-3 px-4 font-bold text-start">{t('المشتريات المكتملة', 'Completed Spend')}</th>
                  <th className="py-3 px-4 font-bold text-start">{t('آخر طلب', 'Last Order')}</th>
                  <th className="py-3 px-4 font-bold text-start">{t('سجل الطلبات', 'History')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAE6E1]">
                {filtered.map((cust) => (
                  <tr key={cust.id} className="hover:bg-[#FAF9F7]/70">
                    <td className="py-3.5 px-4">
                      <div className="font-extrabold text-[#1C1917] flex items-center gap-2">
                        <span>{cust.name}</span>
                        {cust.orderCount >= 2 && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                            {t('عميل متكرر', 'Repeat')}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#6E6A66] flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3" />
                        <span dir="ltr">{cust.phone}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-[#6E6A66]">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-[#1B8E53]" />
                        {cust.areaLabel}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-extrabold text-[#1C1917]">
                      {formatNumber(cust.orderCount, language)}{' '}
                      <span className="text-[10px] font-medium text-[#6E6A66]">
                        ({formatNumber(cust.deliveredCount, language)} {t('مكتمل', 'delivered')})
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-extrabold text-[#1B8E53]">
                      {formatEGP(cust.totalSpent, language)}
                    </td>
                    <td className="py-3.5 px-4 text-[#6E6A66]">
                      {formatDateOnly(cust.lastOrderDate, language)}
                    </td>
                    <td className="py-3.5 px-4">
                      <button
                        type="button"
                        onClick={() => setSelectedCustomer(cust)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#E6F5EC] text-[#1B8E53] font-bold hover:bg-[#D5EFE0]"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>{t('عرض الطلبات', 'View Orders')}</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        open={Boolean(selectedCustomer)}
        onClose={() => setSelectedCustomer(null)}
        title={
          selectedCustomer
            ? t(`طلبات ${selectedCustomer.name} من محلك`, `${selectedCustomer.name}'s Store Orders`)
            : ''
        }
        maxWidthClass="max-w-2xl"
      >
        {selectedCustomer && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2.5 bg-[#FAF9F7] border border-[#EAE6E1] rounded-xl p-3 text-xs">
              <div>
                <div className="text-[#6E6A66]">{t('الموبايل', 'Phone')}</div>
                <div className="font-bold text-[#1C1917]" dir="ltr">
                  {selectedCustomer.phone}
                </div>
              </div>
              <div>
                <div className="text-[#6E6A66]">{t('إجمالي الطلبات', 'Total Orders')}</div>
                <div className="font-extrabold text-[#1C1917]">
                  {formatNumber(selectedCustomer.orderCount, language)}
                </div>
              </div>
              <div>
                <div className="text-[#6E6A66]">{t('إجمالي المشتريات', 'Total Spent')}</div>
                <div className="font-extrabold text-[#1B8E53]">
                  {formatEGP(selectedCustomer.totalSpent, language)}
                </div>
              </div>
            </div>

            <div className="space-y-2.5 max-h-96 overflow-y-auto">
              {selectedCustomer.orders.map((ord) => {
                const statusMeta = getOrderStatusMeta(ord.status, language);
                return (
                  <div
                    key={ord.id}
                    className="rounded-xl border border-[#EAE6E1] p-3.5 flex flex-wrap items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <div className="font-extrabold text-[#1C1917]">#{ord.orderNumber}</div>
                      <div className="text-[11px] text-[#6E6A66]">
                        {formatDateTime(ord.createdAt, language)} • {ord.items.length}{' '}
                        {t('أصناف', 'items')}
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span className="font-extrabold text-[#1B8E53]">
                        {formatEGP(ord.total, language)}
                      </span>
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${statusMeta.badgeClass}`}
                      >
                        {statusMeta.label}
                      </span>
                      <Link
                        to={`/merchant/orders/${ord.id}`}
                        onClick={() => setSelectedCustomer(null)}
                        className="px-2.5 py-1 rounded-lg border border-[#EAE6E1] font-bold text-[#1C1917] hover:bg-[#FAF9F7]"
                      >
                        {t('التفاصيل', 'Inspect')}
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

import React, { useState } from 'react';
import { Search, User } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Modal } from '../../components/common/Modal';
import { formatDateOnly, formatEGP, getOrderStatusMeta } from '../../utils/i18n';
import type { Customer } from '../../types';

export const AdminCustomersPage: React.FC = () => {
  const { language, t, customers, orders, toggleCustomerStatus } = useApp();
  const [query, setQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const filtered = customers.filter((c) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      c.nameAr.toLowerCase().includes(q) ||
      c.nameEn.toLowerCase().includes(q) ||
      c.phone.includes(q)
    );
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-[#1C1917]">
          {t('إدارة العملاء', 'Customers Management')}
        </h1>
        <p className="text-xs text-[#6E6A66]">
          {t('متابعة حسابات العملاء وسجل طلباتهم وحالة الحساب', 'View customer profiles, order history, and account status')}
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-[#EAE6E1] p-4">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-[#6E6A66] absolute start-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('ابحث باسم العميل أو الموبايل...', 'Search customer name or phone...')}
            className="w-full ps-10 pe-4 py-2.5 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] text-sm"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[#EAE6E1] overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs">
            <thead className="bg-[#FAF9F7] text-[#6E6A66]">
              <tr>
                <th className="py-3 px-4 font-bold text-start">{t('العميل', 'Customer')}</th>
                <th className="py-3 px-4 font-bold text-start">{t('الموبايل', 'Phone')}</th>
                <th className="py-3 px-4 font-bold text-start">{t('الطلبات', 'Orders')}</th>
                <th className="py-3 px-4 font-bold text-start">{t('إجمالي الإنفاق', 'Total Spent')}</th>
                <th className="py-3 px-4 font-bold text-start">{t('الحالة', 'Status')}</th>
                <th className="py-3 px-4 font-bold text-start">{t('إجراءات', 'Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EAE6E1]">
              {filtered.map((c) => {
                const custOrders = orders.filter((o) => o.customerId === c.id);
                const spent = custOrders
                  .filter((o) => o.status !== 'cancelled')
                  .reduce((s, o) => s + o.total, 0);
                return (
                  <tr key={c.id} className="hover:bg-[#FAF9F7]/70">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-[#FFF2EB] text-[#D6450D] flex items-center justify-center shrink-0">
                          <User className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-bold text-[#1C1917]">
                            {language === 'ar' ? c.nameAr : c.nameEn}
                          </div>
                          <div className="text-[11px] text-[#6E6A66]">{c.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-[#1C1917]">{c.phone}</td>
                    <td className="py-3 px-4 font-bold">{custOrders.length}</td>
                    <td className="py-3 px-4 font-extrabold text-[#D6450D]">
                      {formatEGP(spent, language)}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          c.status === 'active'
                            ? 'bg-[#FFF2EB] text-[#D6450D]'
                            : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        {c.status === 'active' ? t('نشط', 'Active') : t('موقوف', 'Suspended')}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedCustomer(c)}
                          className="px-2.5 py-1 rounded-lg border border-[#EAE6E1] font-bold hover:border-[#D6450D]"
                        >
                          {t('الملف', 'Profile')}
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleCustomerStatus(c.id)}
                          className="px-2.5 py-1 rounded-lg bg-[#FAF9F7] text-[#6E6A66] hover:text-[#1C1917] font-bold"
                        >
                          {c.status === 'active' ? t('إيقاف', 'Suspend') : t('تفعيل', 'Activate')}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={Boolean(selectedCustomer)}
        onClose={() => setSelectedCustomer(null)}
        title={
          selectedCustomer
            ? language === 'ar'
              ? selectedCustomer.nameAr
              : selectedCustomer.nameEn
            : ''
        }
      >
        {selectedCustomer && (
          <div className="space-y-4 text-xs">
            <div className="p-3.5 rounded-xl bg-[#FAF9F7] space-y-1">
              <div>
                <strong>{t('الموبايل:', 'Phone:')}</strong> {selectedCustomer.phone}
              </div>
              <div>
                <strong>{t('تاريخ الانضمام:', 'Joined:')}</strong>{' '}
                {formatDateOnly(selectedCustomer.joinedAt, language)}
              </div>
            </div>

            <div>
              <h4 className="font-bold text-[#1C1917] mb-2">
                {t('سجل الطلبات', 'Order History')}
              </h4>
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {orders
                  .filter((o) => o.customerId === selectedCustomer.id)
                  .map((o) => {
                    const sm = getOrderStatusMeta(o.status, language);
                    return (
                      <div
                        key={o.id}
                        className="flex items-center justify-between p-2.5 rounded-xl border border-[#EAE6E1]"
                      >
                        <span>#{o.orderNumber}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${sm.badgeClass}`}>
                          {sm.label}
                        </span>
                        <strong className="text-[#D6450D]">{formatEGP(o.total, language)}</strong>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

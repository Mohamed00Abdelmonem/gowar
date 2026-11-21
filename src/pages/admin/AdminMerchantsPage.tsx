import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BadgeCheck, MapPin, Search } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { SafeImage } from '../../components/common/SafeImage';
import {
  formatDateOnly,
  formatEGP,
  formatNumber,
  getMerchantStatusMeta,
  getStoreTypeLabel,
} from '../../utils/i18n';
import type { MerchantStatus, StoreType } from '../../types';

export const AdminMerchantsPage: React.FC = () => {
  const { language, t, merchants, products, orders, areas, setMerchantStatus } = useApp();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | MerchantStatus>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | StoreType>('all');

  const areaMap = useMemo(() => new Map(areas.map((a) => [a.id, a])), [areas]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return merchants.filter((m) => {
      if (statusFilter !== 'all' && m.status !== statusFilter) return false;
      if (typeFilter !== 'all' && m.type !== typeFilter) return false;
      if (!q) return true;
      return (
        m.nameAr.toLowerCase().includes(q) ||
        m.nameEn.toLowerCase().includes(q) ||
        (m.ownerNameAr ?? '').toLowerCase().includes(q) ||
        (m.ownerNameEn ?? '').toLowerCase().includes(q) ||
        m.phone.includes(q)
      );
    });
  }, [merchants, query, statusFilter, typeFilter]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-[#1C1917]">
          {t('إدارة التجار والمتاجر', 'Merchants Management')}
        </h1>
        <p className="text-xs text-[#6E6A66]">
          {t(
            'متابعة كل السوبر ماركت والبقالات والأكشاك، المبيعات، العمولات، وحالة التفعيل',
            'Review store owners, sales, commissions, verification, and active status'
          )}
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-[#EAE6E1] p-4 grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="relative sm:col-span-2">
          <Search className="w-4 h-4 text-[#6E6A66] absolute start-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('ابحث باسم المحل أو التاجر أو الهاتف...', 'Search store, owner, or phone...')}
            className="w-full ps-10 pe-4 py-2.5 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] text-xs font-medium"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="px-3.5 py-2.5 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] text-xs font-bold"
        >
          <option value="all">{t('كل حالات التوثيق', 'All Verification Statuses')}</option>
          <option value="approved">{t('معتمد', 'Approved')}</option>
          <option value="pending">{t('بانتظار الموافقة', 'Pending')}</option>
          <option value="suspended">{t('موقوف', 'Suspended')}</option>
          <option value="rejected">{t('مرفوض', 'Rejected')}</option>
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
          className="px-3.5 py-2.5 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] text-xs font-bold"
        >
          <option value="all">{t('كل أنواع المتاجر', 'All Store Types')}</option>
          <option value="supermarket">{t('سوبر ماركت', 'Supermarket')}</option>
          <option value="mini_market">{t('ميني ماركت', 'Mini Market')}</option>
          <option value="grocery">{t('بقالة', 'Grocery')}</option>
          <option value="kiosk">{t('كشك', 'Kiosk')}</option>
          <option value="convenience">{t('متجر سريع', 'Convenience')}</option>
        </select>
      </div>

      {/* Mobile Merchant Cards */}
      <div className="md:hidden space-y-3">
        {filtered.map((m) => {
          const statusMeta = getMerchantStatusMeta(m.status, language);
          const storeOrders = orders.filter((o) => o.merchantId === m.id);
          const sales = storeOrders
            .filter((o) => o.status === 'delivered')
            .reduce((s, o) => s + o.total, 0);
          return (
            <div
              key={m.id}
              className="bg-white rounded-2xl border border-[#EAE6E1] p-4 space-y-3 shadow-2xs"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <SafeImage
                    src={m.logo}
                    alt={m.nameAr}
                    className="w-11 h-11 rounded-xl object-cover border border-[#EAE6E1] shrink-0"
                  />
                  <div className="min-w-0">
                    <Link
                      to={`/admin/merchants/${m.id}`}
                      className="text-sm font-bold text-[#1C1917] truncate block"
                    >
                      {language === 'ar' ? m.nameAr : m.nameEn}
                    </Link>
                    <div className="text-[11px] text-[#6E6A66]">
                      {language === 'ar' ? m.ownerNameAr ?? '' : m.ownerNameEn ?? ''} •{' '}
                      {getStoreTypeLabel(m.type, language)}
                    </div>
                  </div>
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${statusMeta.badgeClass}`}
                >
                  {statusMeta.label}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-[#6E6A66] pt-2 border-t border-[#EAE6E1]">
                <span>
                  <strong className="text-[#1C1917]">{storeOrders.length}</strong> {t('طلب', 'orders')} •{' '}
                  <strong className="text-[#D6450D]">{formatEGP(sales, language)}</strong>
                </span>
                <Link
                  to={`/admin/merchants/${m.id}`}
                  className="px-2.5 py-1 rounded-lg border border-[#EAE6E1] text-[#1C1917] text-[11px] font-bold"
                >
                  {t('التفاصيل', 'Details')}
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block bg-white rounded-2xl border border-[#EAE6E1] overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs">
            <thead className="bg-[#FAF9F7] text-[#6E6A66]">
              <tr>
                <th className="py-3 px-4 font-bold text-start">{t('المتجر والتاجر', 'Store & Owner')}</th>
                <th className="py-3 px-4 font-bold text-start">{t('النوع والحي', 'Type & Location')}</th>
                <th className="py-3 px-4 font-bold text-start">{t('تاريخ التسجيل', 'Joined')}</th>
                <th className="py-3 px-4 font-bold text-start">{t('المنتجات / الطلبات', 'Items / Orders')}</th>
                <th className="py-3 px-4 font-bold text-start">{t('المبيعات المحققة', 'Delivered Sales')}</th>
                <th className="py-3 px-4 font-bold text-start">{t('العمولة', 'Comm.')}</th>
                <th className="py-3 px-4 font-bold text-start">{t('حالة المحل', 'Availability')}</th>
                <th className="py-3 px-4 font-bold text-start">{t('التوثيق', 'Verification')}</th>
                <th className="py-3 px-4 font-bold text-start">{t('الإجراءات', 'Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EAE6E1]">
              {filtered.map((m) => {
                const statusMeta = getMerchantStatusMeta(m.status, language);
                const prodCount = products.filter((p) => p.merchantId === m.id).length;
                const storeOrders = orders.filter((o) => o.merchantId === m.id);
                const deliveredSales = storeOrders
                  .filter((o) => o.status === 'delivered')
                  .reduce((s, o) => s + o.total, 0);
                const area = areaMap.get(m.areaId);
                return (
                  <tr key={m.id} className="hover:bg-[#FAF9F7]/70">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <SafeImage
                          src={m.logo}
                          alt={m.nameAr}
                          className="w-10 h-10 rounded-xl object-cover border border-[#EAE6E1] shrink-0"
                        />
                        <div>
                          <Link
                            to={`/admin/merchants/${m.id}`}
                            className="font-bold text-[#1C1917] hover:text-[#D6450D] inline-flex items-center gap-1"
                          >
                            <span>{language === 'ar' ? m.nameAr : m.nameEn}</span>
                            {m.verified && <BadgeCheck className="w-3.5 h-3.5 text-[#D6450D]" />}
                          </Link>
                          <div className="text-[11px] text-[#6E6A66]">
                            {language === 'ar' ? m.ownerNameAr ?? '' : m.ownerNameEn ?? ''} •{' '}
                            <span dir="ltr">{m.phone}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-[#1C1917]">{getStoreTypeLabel(m.type, language)}</div>
                      <div className="text-[11px] text-[#6E6A66] flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-[#D6450D]" />
                        <span>{area ? (language === 'ar' ? area.nameAr : area.nameEn) : m.areaId}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-[#6E6A66] whitespace-nowrap">
                      {formatDateOnly(m.createdAt, language)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-bold text-[#1C1917]">{formatNumber(prodCount, language)}</span>{' '}
                      {t('منتج', 'items')} •{' '}
                      <span className="font-bold text-[#D6450D]">{formatNumber(storeOrders.length, language)}</span>{' '}
                      {t('طلب', 'orders')}
                    </td>
                    <td className="py-3 px-4 font-extrabold text-[#1C1917] whitespace-nowrap">
                      {formatEGP(deliveredSales, language)}
                    </td>
                    <td className="py-3 px-4 font-bold text-[#1C1917]">{m.commissionRate}%</td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          m.isOpen ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {m.isOpen ? t('مفتوح', 'Open') : t('مغلق', 'Closed')}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold border ${statusMeta.badgeClass}`}
                      >
                        {statusMeta.label}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {m.status === 'pending' && (
                          <>
                            <button
                              type="button"
                              onClick={() => setMerchantStatus(m.id, 'approved')}
                              className="px-2.5 py-1 rounded-lg bg-[#D6450D] text-white font-bold"
                            >
                              {t('اعتماد', 'Approve')}
                            </button>
                            <button
                              type="button"
                              onClick={() => setMerchantStatus(m.id, 'rejected')}
                              className="px-2.5 py-1 rounded-lg border border-rose-200 text-rose-600 font-bold"
                            >
                              {t('رفض', 'Reject')}
                            </button>
                          </>
                        )}
                        {m.status === 'approved' && (
                          <button
                            type="button"
                            onClick={() => setMerchantStatus(m.id, 'suspended')}
                            className="px-2.5 py-1 rounded-lg border border-amber-300 text-amber-800 font-bold hover:bg-amber-50"
                          >
                            {t('إيقاف', 'Suspend')}
                          </button>
                        )}
                        {(m.status === 'suspended' || m.status === 'rejected') && (
                          <button
                            type="button"
                            onClick={() => setMerchantStatus(m.id, 'approved')}
                            className="px-2.5 py-1 rounded-lg bg-[#FFF2EB] text-[#D6450D] font-bold"
                          >
                            {t('تفعيل', 'Activate')}
                          </button>
                        )}
                        <Link
                          to={`/admin/merchants/${m.id}`}
                          className="px-2.5 py-1 rounded-lg border border-[#EAE6E1] text-[#1C1917] font-bold hover:border-[#D6450D]"
                        >
                          {t('التفاصيل', 'Details')}
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

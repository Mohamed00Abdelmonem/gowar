import React, { useState } from 'react';
import { CheckCircle2, Percent, Save } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatDateTime, formatEGP } from '../../utils/i18n';
import { IS_BACKEND_API_ENABLED } from '../../services/apiClient';

export const AdminCommissionsPage: React.FC = () => {
  const {
    language,
    t,
    settings,
    merchants,
    orders,
    commissionRecords,
    updatePlatformSettings,
    updateMerchantCommission,
    settleAdminCommission,
  } = useApp();

  const [settlingId, setSettlingId] = useState<string | null>(null);

  const [globalRate, setGlobalRate] = useState(String(settings.defaultCommissionRate));
  const [merchantRates, setMerchantRates] = useState<Record<string, string>>(() =>
    Object.fromEntries(merchants.map((m) => [m.id, String(m.commissionRate)]))
  );

  const validOrders = orders.filter((o) => o.status !== 'cancelled');
  const totalCommission = validOrders.reduce((s, o) => s + o.platformCommission, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-[#1C1917]">
          {t('إدارة عمولات المنصة', 'Commission Management')}
        </h1>
        <p className="text-xs text-[#6E6A66]">
          {t('تحديد نسبة العمولة الافتراضية ونسب مخصصة لكل تاجر وحساب المستحقات', 'Configure global commission rate, store overrides, and commission reports')}
        </p>
      </div>

      {/* Global Commission Card */}
      <div className="bg-white rounded-2xl border border-[#EAE6E1] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#FFF2EB] text-[#D6450D] flex items-center justify-center">
            <Percent className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-[#1C1917]">
              {t('نسبة العمولة الافتراضية للمنصة', 'Default Platform Commission Rate')}
            </h2>
            <p className="text-xs text-[#6E6A66]">
              {t('إجمالي عمولات المنصة المحققة:', 'Total calculated commissions:')}{' '}
              <strong className="text-[#D6450D]">{formatEGP(totalCommission, language)}</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="number"
            min="0"
            max="30"
            step="0.5"
            value={globalRate}
            onChange={(e) => setGlobalRate(e.target.value)}
            className="w-24 px-3 py-2 rounded-xl border border-[#EAE6E1] text-sm font-extrabold text-center"
          />
          <span className="text-sm font-bold text-[#6E6A66]">%</span>
          <button
            type="button"
            onClick={() =>
              updatePlatformSettings({ defaultCommissionRate: Number(globalRate) || 0 })
            }
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#D6450D] text-white text-xs font-bold"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{t('تحديث', 'Update')}</span>
          </button>
        </div>
      </div>

      {/* Merchant-Specific Commission Table */}
      <div className="bg-white rounded-2xl border border-[#EAE6E1] overflow-hidden shadow-2xs">
        <div className="px-5 py-4 border-b border-[#EAE6E1]">
          <h3 className="text-sm font-extrabold text-[#1C1917]">
            {t('تفاصيل العمولات حسب التاجر', 'Merchant-Specific Commission Breakdown')}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs">
            <thead className="bg-[#FAF9F7] text-[#6E6A66]">
              <tr>
                <th className="py-3 px-4 font-bold text-start">{t('المتجر', 'Merchant')}</th>
                <th className="py-3 px-4 font-bold text-start">{t('المبيعات (بدون التوصيل)', 'Order Subtotals')}</th>
                <th className="py-3 px-4 font-bold text-start">{t('نسبة العمولة %', 'Commission %')}</th>
                <th className="py-3 px-4 font-bold text-start">{t('مستحق المنصة', 'Platform Share')}</th>
                <th className="py-3 px-4 font-bold text-start">{t('حفظ', 'Save')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EAE6E1]">
              {merchants.map((m) => {
                const mOrders = validOrders.filter((o) => o.merchantId === m.id);
                const subtotalSum = mOrders.reduce((s, o) => s + o.subtotal, 0);
                const commSum = mOrders.reduce((s, o) => s + o.platformCommission, 0);
                const rateVal = merchantRates[m.id] ?? String(m.commissionRate);

                return (
                  <tr key={m.id}>
                    <td className="py-3 px-4 font-bold text-[#1C1917]">
                      {language === 'ar' ? m.nameAr : m.nameEn}
                    </td>
                    <td className="py-3 px-4">{formatEGP(subtotalSum, language)}</td>
                    <td className="py-3 px-4">
                      <input
                        type="number"
                        min="0"
                        max="30"
                        step="0.5"
                        value={rateVal}
                        onChange={(e) =>
                          setMerchantRates((prev) => ({ ...prev, [m.id]: e.target.value }))
                        }
                        className="w-20 px-2.5 py-1.5 rounded-lg border border-[#EAE6E1] font-bold"
                      />
                    </td>
                    <td className="py-3 px-4 font-extrabold text-[#D6450D]">
                      {formatEGP(commSum, language)}
                    </td>
                    <td className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => updateMerchantCommission(m.id, Number(rateVal) || 0)}
                        className="px-3 py-1.5 rounded-lg bg-[#FFF2EB] text-[#D6450D] font-bold hover:bg-[#FDE2D2]"
                      >
                        {t('تطبيق', 'Apply')}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {/* Commission Ledger & Settlement Table (Backend Mode) */}
      {IS_BACKEND_API_ENABLED && (
        <div className="bg-white rounded-2xl border border-[#EAE6E1] overflow-hidden shadow-2xs">
          <div className="px-5 py-4 border-b border-[#EAE6E1] flex items-center justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-[#1C1917]">
                {t('سجل العمولات والتسويات', 'Commission Ledger & Settlements')}
              </h3>
              <p className="text-[11px] text-[#6E6A66]">
                {t(
                  'مراجعة عمولات الطلبات وتسوية العمولات المكتسبة مع التجار',
                  'Review order commissions and settle earned payouts'
                )}
              </p>
            </div>
            <span className="text-xs font-bold text-[#6E6A66]">
              {commissionRecords.length} {t('سجل', 'records')}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead className="bg-[#FAF9F7] text-[#6E6A66]">
                <tr>
                  <th className="py-3 px-4 font-bold text-start">{t('الطلب', 'Order')}</th>
                  <th className="py-3 px-4 font-bold text-start">{t('المتجر', 'Store')}</th>
                  <th className="py-3 px-4 font-bold text-start">{t('مبلغ العمولة', 'Commission')}</th>
                  <th className="py-3 px-4 font-bold text-start">{t('الحالة', 'Status')}</th>
                  <th className="py-3 px-4 font-bold text-start">{t('التسوية', 'Settlement')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAE6E1]">
                {commissionRecords.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-[#6E6A66]">
                      {t('لا توجد قيود عمولات مسجلة بعد', 'No commission records yet')}
                    </td>
                  </tr>
                ) : (
                  commissionRecords.map((rec) => {
                    const statusBadge =
                      rec.status === 'settled'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : rec.status === 'earned'
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : rec.status === 'reversed'
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : 'bg-[#FAF9F7] text-[#6E6A66] border-[#EAE6E1]';
                    return (
                      <tr key={rec.id} className="hover:bg-[#FAF9F7]/70">
                        <td className="py-3 px-4 font-extrabold text-[#1C1917]">
                          #{rec.order_number}
                          <span className="block text-[10px] text-[#6E6A66] font-normal">
                            {formatDateTime(rec.created_at, language)}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-bold text-[#1C1917]">{rec.store_name}</td>
                        <td className="py-3 px-4 font-extrabold text-[#D6450D]">
                          {formatEGP(Number(rec.commission_amount), language)}
                          {Number(rec.reversed_commission_amount) > 0 && (
                            <span className="block text-[10px] text-rose-600 font-normal">
                              -{formatEGP(Number(rec.reversed_commission_amount), language)}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold border capitalize ${statusBadge}`}
                          >
                            {rec.status}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {rec.status === 'earned' ? (
                            <button
                              type="button"
                              disabled={settlingId === rec.id}
                              onClick={async () => {
                                setSettlingId(rec.id);
                                try {
                                  await settleAdminCommission(rec.id);
                                } finally {
                                  setSettlingId(null);
                                }
                              }}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-[11px]"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>
                                {settlingId === rec.id
                                  ? t('جاري التسوية...', 'Settling...')
                                  : t('تسوية العمولة', 'Settle Commission')}
                              </span>
                            </button>
                          ) : rec.settled_at ? (
                            <span className="text-[11px] text-emerald-700 font-bold">
                              {formatDateTime(rec.settled_at, language)}
                            </span>
                          ) : (
                            <span className="text-[11px] text-[#6E6A66]">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

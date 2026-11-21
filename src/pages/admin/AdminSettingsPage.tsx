import React, { useState } from 'react';
import { RotateCcw, Save } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const AdminSettingsPage: React.FC = () => {
  const { t, settings, updatePlatformSettings, resetDemoData } = useApp();

  const [platformNameAr, setPlatformNameAr] = useState(settings.platformNameAr);
  const [platformNameEn, setPlatformNameEn] = useState(settings.platformNameEn);
  const [supportPhone, setSupportPhone] = useState(settings.supportPhone);
  const [supportEmail, setSupportEmail] = useState(settings.supportEmail);
  const [autoApprove, setAutoApprove] = useState(settings.autoApproveMerchants);
  const [defaultCommission, setDefaultCommission] = useState(
    String(settings.defaultCommissionRate)
  );
  const [notifyNewOrder, setNotifyNewOrder] = useState(settings.notifyOnNewOrder ?? true);
  const [notifyLowStock, setNotifyLowStock] = useState(settings.notifyOnLowStock ?? true);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updatePlatformSettings({
      platformNameAr,
      platformNameEn,
      supportPhone,
      supportEmail,
      autoApproveMerchants: autoApprove,
      defaultCommissionRate: Number(defaultCommission) || 5,
      notifyOnNewOrder: notifyNewOrder,
      notifyOnLowStock: notifyLowStock,
    });
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-[#1C1917]">
          {t('إعدادات المنصة العامة', 'Platform Settings')}
        </h1>
        <p className="text-xs text-[#6E6A66]">
          {t('إعدادات الهوية والدعم الفني وقواعد قبول التجار', 'Brand, support contact & merchant onboarding policies')}
        </p>
      </div>

      <form
        onSubmit={handleSave}
        className="bg-white rounded-2xl border border-[#EAE6E1] p-5 sm:p-6 space-y-4 shadow-2xs"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-[#6E6A66] mb-1">
              {t('اسم المنصة بالعربية', 'Platform Name (Arabic)')}
            </label>
            <input
              type="text"
              value={platformNameAr}
              onChange={(e) => setPlatformNameAr(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] text-sm font-bold"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-[#6E6A66] mb-1">
              {t('اسم المنصة بالإنجليزية', 'Platform Name (English)')}
            </label>
            <input
              type="text"
              value={platformNameEn}
              onChange={(e) => setPlatformNameEn(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] text-sm font-bold"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-[#6E6A66] mb-1">
              {t('رقم الدعم الفني', 'Support Hotline')}
            </label>
            <input
              type="text"
              value={supportPhone}
              onChange={(e) => setSupportPhone(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-[#6E6A66] mb-1">
              {t('بريد الدعم', 'Support Email')}
            </label>
            <input
              type="email"
              value={supportEmail}
              onChange={(e) => setSupportEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-[#6E6A66] mb-1">
              {t('نسبة العمولة الافتراضية (%)', 'Default Commission Rate (%)')}
            </label>
            <input
              type="number"
              min="0"
              max="30"
              value={defaultCommission}
              onChange={(e) => setDefaultCommission(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] text-sm font-bold"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-[#6E6A66] mb-1">
              {t('العملة الافتراضية', 'Default Currency')}
            </label>
            <input
              type="text"
              readOnly
              value={`${settings.currencyAr} (${settings.currencyEn})`}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#F3F0EC] border border-[#EAE6E1] text-sm font-bold text-[#6E6A66]"
            />
          </div>
        </div>

        <div className="space-y-2.5 pt-2">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={autoApprove}
              onChange={(e) => setAutoApprove(e.target.checked)}
              className="w-4 h-4 accent-[#D6450D]"
            />
            <span className="text-xs font-bold text-[#1C1917]">
              {t('اعتماد المتاجر الجديدة تلقائياً دون مراجعة يدوية', 'Auto-approve new merchant registrations')}
            </span>
          </label>

          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={notifyNewOrder}
              onChange={(e) => setNotifyNewOrder(e.target.checked)}
              className="w-4 h-4 accent-[#D6450D]"
            />
            <span className="text-xs font-bold text-[#1C1917]">
              {t('تنبيه التجار فور وصول طلب جديد', 'Notify merchants immediately on new orders')}
            </span>
          </label>

          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={notifyLowStock}
              onChange={(e) => setNotifyLowStock(e.target.checked)}
              className="w-4 h-4 accent-[#D6450D]"
            />
            <span className="text-xs font-bold text-[#1C1917]">
              {t('تفعيل تنبيهات نقص المخزون للتجار (≤ 5 قطع)', 'Enable low-stock alerts for merchants (≤ 5 units)')}
            </span>
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-[#EAE6E1]">
          <button
            type="button"
            onClick={resetDemoData}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-rose-200 text-rose-600 text-xs font-bold hover:bg-rose-50"
          >
            <RotateCcw className="w-4 h-4" />
            <span>{t('إعادة ضبط كل بيانات العرض التجريبي', 'Reset All Demo Data')}</span>
          </button>

          <button
            type="submit"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#D6450D] text-white text-xs font-bold"
          >
            <Save className="w-4 h-4" />
            <span>{t('حفظ الإعدادات', 'Save Settings')}</span>
          </button>
        </div>
      </form>
    </div>
  );
};

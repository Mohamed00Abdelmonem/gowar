import React, { useState } from 'react';
import { Info, Save, Truck } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import type { Merchant } from '../../types';

const DeliverySettingsForm: React.FC<{ merchant: Merchant }> = ({ merchant }) => {
  const { language, t, areas, updateMerchant } = useApp();

  const [deliveryEnabled, setDeliveryEnabled] = useState(merchant.delivery.deliveryEnabled);
  const [deliveryFee, setDeliveryFee] = useState(String(merchant.delivery.deliveryFee));
  const [minOrder, setMinOrder] = useState(String(merchant.delivery.minOrder));
  const [maxDistanceKm, setMaxDistanceKm] = useState(String(merchant.delivery.maxDistanceKm));
  const [prepTimeMin, setPrepTimeMin] = useState(String(merchant.delivery.prepTimeMin));
  const [deliveryTimeMin, setDeliveryTimeMin] = useState(String(merchant.delivery.deliveryTimeMin));
  const [freeThreshold, setFreeThreshold] = useState(
    merchant.delivery.freeDeliveryThreshold
      ? String(merchant.delivery.freeDeliveryThreshold)
      : ''
  );
  const [supportedAreas, setSupportedAreas] = useState<string[]>(
    merchant.delivery.supportedAreaIds
  );

  const toggleArea = (areaId: string) => {
    setSupportedAreas((prev) =>
      prev.includes(areaId) ? prev.filter((id) => id !== areaId) : [...prev, areaId]
    );
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateMerchant(merchant.id, {
      delivery: {
        deliveryEnabled,
        deliveryFee: Math.max(0, Number(deliveryFee) || 0),
        minOrder: Math.max(0, Number(minOrder) || 0),
        maxDistanceKm: Math.max(1, Number(maxDistanceKm) || 1),
        prepTimeMin: Math.max(1, Number(prepTimeMin) || 5),
        deliveryTimeMin: Math.max(5, Number(deliveryTimeMin) || 15),
        freeDeliveryThreshold: freeThreshold ? Number(freeThreshold) : undefined,
        supportedAreaIds: supportedAreas,
      },
    });
  };

  return (
    <form
      onSubmit={handleSave}
      className="bg-white rounded-2xl border border-[#EAE6E1] p-5 sm:p-6 space-y-6 shadow-2xs"
    >
      <div className="flex items-center justify-between p-4 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1]">
        <div className="flex items-center gap-3">
          <Truck className="w-5 h-5 text-[#D6450D]" />
          <div>
            <div className="text-sm font-bold text-[#1C1917]">
              {t('تفعيل خدمة التوصيل للمنازل', 'Enable Home Delivery')}
            </div>
            <div className="text-xs text-[#6E6A66]">
              {t('عند الإيقاف سيظهر للعميل خيار الاستلام فقط', 'When disabled, store shows pickup-only status')}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setDeliveryEnabled((v) => !v)}
          className={`w-12 h-6 rounded-full p-0.5 flex items-center transition-colors ${
            deliveryEnabled ? 'bg-[#D6450D] justify-end' : 'bg-slate-300 justify-start'
          }`}
        >
          <span className="w-5 h-5 rounded-full bg-white shadow-xs" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-bold text-[#6E6A66] mb-1">
            {t('رسوم التوصيل (ج.م)', 'Delivery Fee (EGP)')}
          </label>
          <input
            type="number"
            min="0"
            value={deliveryFee}
            onChange={(e) => setDeliveryFee(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] text-sm font-bold"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-[#6E6A66] mb-1">
            {t('الحد الأدنى للطلب (ج.م)', 'Minimum Order (EGP)')}
          </label>
          <input
            type="number"
            min="0"
            value={minOrder}
            onChange={(e) => setMinOrder(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] text-sm font-bold"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-[#6E6A66] mb-1">
            {t('أقصى مسافة توصيل (كم)', 'Max Delivery Distance (km)')}
          </label>
          <input
            type="number"
            min="1"
            step="0.5"
            value={maxDistanceKm}
            onChange={(e) => setMaxDistanceKm(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] text-sm font-bold"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-[#6E6A66] mb-1">
            {t('وقت تجهيز الطلب (دقيقة)', 'Estimated Prep Time (min)')}
          </label>
          <input
            type="number"
            min="1"
            value={prepTimeMin}
            onChange={(e) => setPrepTimeMin(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] text-sm font-bold"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-[#6E6A66] mb-1">
            {t('إجمالي وقت التوصيل المتوقع (دقيقة)', 'Estimated Delivery Time (min)')}
          </label>
          <input
            type="number"
            min="5"
            value={deliveryTimeMin}
            onChange={(e) => setDeliveryTimeMin(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] text-sm font-bold"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-[#6E6A66] mb-1">
            {t('توصيل مجاني للطلبات فوق (اختياري)', 'Free Delivery Above (Optional)')}
          </label>
          <input
            type="number"
            min="0"
            value={freeThreshold}
            onChange={(e) => setFreeThreshold(e.target.value)}
            placeholder={t('مثال: 400 ج.م', 'e.g. 400 EGP')}
            className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] text-sm"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold text-[#6E6A66] mb-2.5">
          {t('المناطق التي يغطيها توصيل المحل', 'Supported Delivery Neighborhoods')}
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {areas.map((area) => {
            const checked = supportedAreas.includes(area.id);
            return (
              <label
                key={area.id}
                className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer text-xs font-bold transition-colors ${
                  checked
                    ? 'border-[#D6450D] bg-[#FFF2EB] text-[#D6450D]'
                    : 'border-[#EAE6E1] bg-[#FAF9F7] text-[#1C1917]'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleArea(area.id)}
                  className="accent-[#D6450D]"
                />
                <span>{language === 'ar' ? area.nameAr : area.nameEn}</span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="flex justify-end pt-3 border-t border-[#EAE6E1]">
        <button
          type="submit"
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#D6450D] hover:bg-[#B33808] text-white text-xs font-bold"
        >
          <Save className="w-4 h-4" />
          <span>{t('حفظ إعدادات التوصيل', 'Save Delivery Settings')}</span>
        </button>
      </div>
    </form>
  );
};

export const MerchantDeliveryPage: React.FC = () => {
  const { t, activeMerchant } = useApp();

  return (
    <div className="max-w-4xl space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-[#1C1917]">
          {t('إعدادات التوصيل الخاصة بالمحل', 'Merchant Delivery Settings')}
        </h1>
        <p className="text-xs text-[#6E6A66]">
          {t('تحكم في رسوم التوصيل، الحد الأدنى، والمناطق التي يخدمها مندوب محلك', 'Configure your own delivery fees, minimums, and coverage areas')}
        </p>
      </div>

      <div className="p-4 rounded-2xl bg-[#FFF2EB] border border-[#FBD8C5] flex items-start gap-3 text-xs text-[#1C1917]">
        <Info className="w-5 h-5 text-[#D6450D] shrink-0 mt-0.5" />
        <div>
          <strong className="block text-sm text-[#D6450D]">
            {t('التوصيل يتم مباشرة بواسطة محلك', 'Merchant-Fulfilled Delivery Model')}
          </strong>
          <p className="text-[#1C1917]/80 mt-0.5 leading-relaxed">
            {t(
              'منصة جوار لا تمتلك أسطول توصيل؛ أنت المسؤول عن توصيل طلبات عملائك وتحديد رسوم التوصيل ومناطقه كما يناسب عملك.',
              'Gowar does not operate delivery fleets; your store is fully responsible for delivering its own orders and setting its delivery fees.'
            )}
          </p>
        </div>
      </div>

      <DeliverySettingsForm key={activeMerchant.id} merchant={activeMerchant} />
    </div>
  );
};

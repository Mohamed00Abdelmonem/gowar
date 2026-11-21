import React, { useState } from 'react';
import { MapPin, Plus } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Modal } from '../../components/common/Modal';

export const AdminAreasPage: React.FC = () => {
  const { language, t, areas, merchants, orders, addArea, updateArea } = useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [cityAr, setCityAr] = useState('القاهرة');
  const [note, setNote] = useState('');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameAr.trim()) return;
    addArea({
      nameAr: nameAr.trim(),
      nameEn: nameEn.trim() || nameAr.trim(),
      cityAr: cityAr.trim() || 'القاهرة',
      cityEn: cityAr === 'الجيزة' ? 'Giza' : 'Cairo',
      isActive: true,
      deliveryHubNote: note.trim() || undefined,
    });
    setModalOpen(false);
    setNameAr('');
    setNameEn('');
    setNote('');
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#1C1917]">
            {t('إدارة المناطق والأحياء', 'Neighborhoods & Areas')}
          </h1>
          <p className="text-xs text-[#6E6A66]">
            {t('تحكم في الأحياء المصرية المخدومة مثل مدينة نصر ومصر الجديدة والمعادي', 'Manage supported Cairo & Giza neighborhoods')}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#D6450D] text-white text-xs font-bold"
        >
          <Plus className="w-4 h-4" />
          <span>{t('إضافة منطقة', 'Add Area')}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {areas.map((area) => {
          const storeCount = merchants.filter(
            (m) => m.areaId === area.id || m.delivery.supportedAreaIds.includes(area.id)
          ).length;
          const orderCount = orders.filter((o) => o.areaId === area.id).length;

          return (
            <div
              key={area.id}
              className="bg-white rounded-2xl border border-[#EAE6E1] p-5 space-y-3 shadow-2xs"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#FFF2EB] text-[#D6450D] flex items-center justify-center">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-[#1C1917]">
                      {language === 'ar' ? area.nameAr : area.nameEn}
                    </h3>
                    <span className="text-xs text-[#6E6A66]">
                      {language === 'ar' ? area.cityAr : area.cityEn}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => updateArea(area.id, { isActive: !area.isActive })}
                  className={`px-3 py-1 rounded-full text-[11px] font-bold ${
                    area.isActive
                      ? 'bg-[#FFF2EB] text-[#D6450D]'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {area.isActive ? t('مفعلة', 'Active') : t('معطلة', 'Inactive')}
                </button>
              </div>

              {area.deliveryHubNote && (
                <p className="text-xs text-[#6E6A66] line-clamp-1">{area.deliveryHubNote}</p>
              )}

              <div className="flex justify-between pt-2 border-t border-[#EAE6E1] text-xs">
                <span className="text-[#6E6A66]">
                  <strong className="text-[#1C1917]">{storeCount}</strong> {t('محل يغطي الحي', 'stores')}
                </span>
                <span className="text-[#6E6A66]">
                  <strong className="text-[#D6450D]">{orderCount}</strong> {t('طلب', 'orders')}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={t('إضافة منطقة جديدة', 'Add New Neighborhood')}
        maxWidthClass="max-w-sm"
      >
        <form onSubmit={handleAdd} className="space-y-3.5">
          <input
            type="text"
            required
            value={nameAr}
            onChange={(e) => setNameAr(e.target.value)}
            placeholder={t('اسم الحي بالعربية (مثال: الزمالك)', 'Area Name (Arabic)')}
            className="w-full px-3.5 py-2.5 rounded-xl border border-[#EAE6E1] text-sm"
          />
          <input
            type="text"
            value={nameEn}
            onChange={(e) => setNameEn(e.target.value)}
            placeholder={t('الاسم بالإنجليزية (Zamalek)', 'English Name')}
            className="w-full px-3.5 py-2.5 rounded-xl border border-[#EAE6E1] text-sm"
          />
          <select
            value={cityAr}
            onChange={(e) => setCityAr(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-[#EAE6E1] text-sm"
          >
            <option value="القاهرة">{t('القاهرة', 'Cairo')}</option>
            <option value="الجيزة">{t('الجيزة', 'Giza')}</option>
          </select>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('أهم الشوارع...', 'Key streets...')}
            className="w-full px-3.5 py-2.5 rounded-xl border border-[#EAE6E1] text-sm"
          />
          <button
            type="submit"
            className="w-full py-2.5 rounded-xl bg-[#D6450D] text-white text-sm font-bold"
          >
            {t('حفظ المنطقة', 'Save Area')}
          </button>
        </form>
      </Modal>
    </div>
  );
};

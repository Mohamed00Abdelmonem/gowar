import React, { useState } from 'react';
import { Check, MapPin, Plus, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Modal } from '../../components/common/Modal';
import { LocationPickerModal } from '../../components/location/LocationPickerModal';

export const AddressesPage: React.FC = () => {
  const {
    language,
    t,
    activeCustomer,
    areas,
    addCustomerAddress,
    deleteCustomerAddress,
    setDefaultAddress,
  } = useApp();

  const [modalOpen, setModalOpen] = useState(false);
  const [mapModalOpen, setMapModalOpen] = useState(false);
  const [labelAr, setLabelAr] = useState('المنزل');
  const [areaId, setAreaId] = useState(areas[0]?.id ?? '');
  const [streetAr, setStreetAr] = useState('');
  const [building, setBuilding] = useState('');
  const [floor, setFloor] = useState('');
  const [apartment, setApartment] = useState('');
  const [notes, setNotes] = useState('');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!streetAr.trim()) return;
    addCustomerAddress({
      labelAr,
      labelEn: labelAr,
      areaId,
      streetAr,
      streetEn: streetAr,
      building: building || '١',
      floor: floor || '١',
      apartment: apartment || '١',
      notes: notes || undefined,
      isDefault: true,
    });
    setModalOpen(false);
    setStreetAr('');
    setBuilding('');
    setFloor('');
    setApartment('');
    setNotes('');
  };

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 py-6 space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#1C1917]">
            {t('العناوين المحفوظة', 'Saved Addresses')}
          </h1>
          <p className="text-xs text-[#6E6A66]">
            {t('اختر العنوان الافتراضي لتحديد المحلات المتاحة حولك', 'Select your default address to filter nearby stores')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setMapModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#E6F5EC] border border-[#C2E7D2] text-[#1B8E53] text-xs font-bold"
          >
            <MapPin className="w-4 h-4" />
            <span>{t('تحديد على الخريطة', 'Pick on Map')}</span>
          </button>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#1B8E53] hover:bg-[#147242] text-white text-xs font-bold"
          >
            <Plus className="w-4 h-4" />
            <span>{t('إضافة عنوان', 'Add Address')}</span>
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {activeCustomer.addresses.map((addr) => {
          const area = areas.find((a) => a.id === addr.areaId);
          return (
            <div
              key={addr.id}
              className={`bg-white rounded-2xl border p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                addr.isDefault ? 'border-[#1B8E53] ring-1 ring-[#1B8E53]/20' : 'border-[#EAE6E1]'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#E6F5EC] text-[#1B8E53] flex items-center justify-center shrink-0">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-extrabold text-[#1C1917]">
                      {language === 'ar' ? addr.labelAr : addr.labelEn}
                    </span>
                    {area && (
                      <span className="text-[11px] px-2 py-0.5 rounded-md bg-[#FAF9F7] text-[#6E6A66]">
                        {language === 'ar' ? area.nameAr : area.nameEn}
                      </span>
                    )}
                    {addr.isDefault && (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#E6F5EC] text-[#1B8E53]">
                        {t('الافتراضي', 'Default')}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#6E6A66] mt-1">
                    {language === 'ar' ? addr.streetAr : addr.streetEn} — {t('عمارة', 'Bldg')}{' '}
                    {addr.building}، {t('دور', 'Fl')} {addr.floor}، {t('شقة', 'Apt')}{' '}
                    {addr.apartment}
                  </p>
                  {addr.notes && <p className="text-[11px] text-[#6E6A66] mt-0.5">{addr.notes}</p>}
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center">
                {!addr.isDefault && (
                  <button
                    type="button"
                    onClick={() => setDefaultAddress(addr.id)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#E6F5EC] text-[#1B8E53] text-xs font-bold"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{t('تعيين كافتراضي', 'Set Default')}</span>
                  </button>
                )}
                {activeCustomer.addresses.length > 1 && (
                  <button
                    type="button"
                    onClick={() => deleteCustomerAddress(addr.id)}
                    className="p-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50"
                    aria-label={t('حذف', 'Delete')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={t('إضافة عنوان جديد', 'Add New Address')}
      >
        <form onSubmit={handleAdd} className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#6E6A66] mb-1">
                {t('تسمية العنوان', 'Label')}
              </label>
              <input
                type="text"
                value={labelAr}
                onChange={(e) => setLabelAr(e.target.value)}
                placeholder={t('المنزل / العمل', 'Home / Office')}
                className="w-full px-3 py-2 rounded-xl border border-[#EAE6E1] text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#6E6A66] mb-1">
                {t('الحي / المنطقة', 'Neighborhood')}
              </label>
              <select
                value={areaId}
                onChange={(e) => setAreaId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#EAE6E1] text-sm"
              >
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {language === 'ar' ? a.nameAr : a.nameEn}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#6E6A66] mb-1">
              {t('اسم الشارع', 'Street Name')}
            </label>
            <input
              type="text"
              required
              value={streetAr}
              onChange={(e) => setStreetAr(e.target.value)}
              placeholder={t('مثال: شارع مصطفى النحاس', 'e.g. Mostafa El Nahas St')}
              className="w-full px-3 py-2 rounded-xl border border-[#EAE6E1] text-sm"
            />
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <input
              type="text"
              value={building}
              onChange={(e) => setBuilding(e.target.value)}
              placeholder={t('رقم العمارة', 'Building')}
              className="px-3 py-2 rounded-xl border border-[#EAE6E1] text-sm"
            />
            <input
              type="text"
              value={floor}
              onChange={(e) => setFloor(e.target.value)}
              placeholder={t('الدور', 'Floor')}
              className="px-3 py-2 rounded-xl border border-[#EAE6E1] text-sm"
            />
            <input
              type="text"
              value={apartment}
              onChange={(e) => setApartment(e.target.value)}
              placeholder={t('الشقة', 'Apt')}
              className="px-3 py-2 rounded-xl border border-[#EAE6E1] text-sm"
            />
          </div>

          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('علامة مميزة (اختياري)', 'Landmark / Notes (optional)')}
            className="w-full px-3 py-2 rounded-xl border border-[#EAE6E1] text-sm"
          />

          <button
            type="submit"
            className="w-full py-2.5 rounded-xl bg-[#1B8E53] hover:bg-[#147242] text-white text-sm font-bold"
          >
            {t('حفظ العنوان', 'Save Address')}
          </button>
        </form>
      </Modal>

      <LocationPickerModal
        open={mapModalOpen}
        onClose={() => setMapModalOpen(false)}
      />
    </div>
  );
};

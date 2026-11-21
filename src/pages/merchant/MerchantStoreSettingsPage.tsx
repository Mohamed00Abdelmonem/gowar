import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, ImagePlus, Power, Save, Truck, Upload } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { SafeImage } from '../../components/common/SafeImage';
import { Modal } from '../../components/common/Modal';
import { StoreMapPicker } from '../../components/location/StoreMapPicker';
import { formatEGP } from '../../utils/i18n';
import type { Merchant } from '../../types';

const StoreSettingsForm: React.FC<{ merchant: Merchant }> = ({ merchant }) => {
  const { language, t, categories, updateMerchant, toggleMerchantOpen, areas } = useApp();

  const [nameAr, setNameAr] = useState(merchant.nameAr);
  const [nameEn, setNameEn] = useState(merchant.nameEn);
  const [descriptionAr, setDescriptionAr] = useState(merchant.descriptionAr);
  const [phone, setPhone] = useState(merchant.phone);
  const [addressAr, setAddressAr] = useState(merchant.addressAr);
  const [workingHoursAr, setWorkingHoursAr] = useState(merchant.workingHoursAr);
  const [logo, setLogo] = useState(merchant.logo);
  const [coverImage, setCoverImage] = useState(merchant.coverImage);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [selectedCats, setSelectedCats] = useState<string[]>(merchant.categoryIds);
  const [coords, setCoords] = useState(merchant.coordinates);
  const [previewOpen, setPreviewOpen] = useState(false);

  const handleImageUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (val: string) => void,
    fileSetter: (f: File | null) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    fileSetter(file);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setter(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const toggleCat = (id: string) => {
    setSelectedCats((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    void updateMerchant(merchant.id, {
      nameAr,
      nameEn,
      descriptionAr,
      phone,
      addressAr,
      workingHoursAr,
      logo,
      coverImage,
      logoFile,
      coverFile,
      coordinates: coords,
      categoryIds: selectedCats,
    });
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#1C1917]">
            {t('ملف المحل والإعدادات', 'Store Profile & Settings')}
          </h1>
          <p className="text-xs text-[#6E6A66]">
            {t('عدّل بيانات متجرك التي تظهر للعملاء في تطبيق جوار', 'Customize how your store appears to neighborhood shoppers')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#FFF2EB] text-[#D6450D] text-xs font-bold hover:bg-[#FDE2D2]"
          >
            <Eye className="w-4 h-4" />
            <span>{t('معاينة سريعة', 'Quick Preview')}</span>
          </button>
          <Link
            to={`/stores/${merchant.id}`}
            className="px-4 py-2 rounded-xl border border-[#EAE6E1] bg-white text-xs font-bold text-[#1C1917]"
          >
            {t('فتح صفحة المحل', 'Open Live Page')}
          </Link>
        </div>
      </div>

      <form
        onSubmit={handleSave}
        className="bg-white rounded-2xl border border-[#EAE6E1] p-5 sm:p-6 space-y-6 shadow-2xs"
      >
        <div className="relative h-44 rounded-2xl overflow-hidden bg-[#FAF9F7] border border-[#EAE6E1]">
          <SafeImage src={coverImage} alt={nameAr} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
          <div className="absolute top-3 end-3 flex items-center gap-2">
            <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/95 text-[#1C1917] text-xs font-bold shadow-xs hover:bg-white">
              <ImagePlus className="w-3.5 h-3.5 text-[#D6450D]" />
              <span>{t('تغيير الغلاف', 'Change Cover')}</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleImageUpload(e, setCoverImage, setCoverFile)}
              />
            </label>
          </div>
          <div className="absolute bottom-3 start-4 flex items-center gap-3">
            <div className="relative group">
              <SafeImage
                src={logo}
                alt={nameAr}
                className="w-16 h-16 rounded-2xl border-2 border-white bg-white object-cover shadow-md"
              />
              <label
                title={t('تغيير الشعار', 'Change Logo')}
                className="cursor-pointer absolute -bottom-1.5 -end-1.5 w-7 h-7 rounded-full bg-[#D6450D] text-white flex items-center justify-center shadow-sm hover:bg-[#B33808]"
              >
                <Upload className="w-3.5 h-3.5" />
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleImageUpload(e, setLogo, setLogoFile)}
                />
              </label>
            </div>
            <div>
              <span className="px-3 py-1 rounded-xl bg-black/60 text-white text-sm font-bold backdrop-blur-xs inline-block">
                {nameAr}
              </span>
            </div>
          </div>
        </div>

        {/* Store Status & Delivery Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-[#EAE6E1] bg-[#FAF9F7] p-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-extrabold text-[#1C1917] flex items-center gap-1.5">
                <Power className="w-4 h-4 text-[#D6450D]" />
                <span>{t('حالة استقبال الطلبات', 'Store Availability')}</span>
              </div>
              <p className="text-[11px] text-[#6E6A66] mt-0.5">
                {merchant.isOpen
                  ? t('المتجر مفتوح الآن أمام العملاء', 'Store is currently open to shoppers')
                  : t('المتجر مغلق مؤقتاً', 'Store is temporarily paused')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => toggleMerchantOpen(merchant.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold text-white shrink-0 ${
                merchant.isOpen ? 'bg-rose-600 hover:bg-rose-700' : 'bg-[#D6450D] hover:bg-[#B33808]'
              }`}
            >
              {merchant.isOpen ? t('إغلاق مؤقت', 'Pause') : t('فتح المتجر', 'Open')}
            </button>
          </div>

          <div className="rounded-2xl border border-[#EAE6E1] bg-[#FAF9F7] p-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-extrabold text-[#1C1917] flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-[#D6450D]" />
                <span>{t('ملخص إعدادات التوصيل', 'Delivery Summary')}</span>
              </div>
              <p className="text-[11px] text-[#6E6A66] mt-0.5">
                {t('الرسوم:', 'Fee:')} {formatEGP(merchant.delivery.deliveryFee, language)} •{' '}
                {t('المناطق:', 'Areas:')}{' '}
                {merchant.delivery.supportedAreaIds
                  .map((id) => {
                    const a = areas.find((x) => x.id === id);
                    return a ? (language === 'ar' ? a.nameAr : a.nameEn) : id;
                  })
                  .slice(0, 2)
                  .join('، ')}
              </p>
            </div>
            <Link
              to="/merchant/delivery"
              className="px-3.5 py-2 rounded-xl border border-[#EAE6E1] bg-white text-xs font-bold text-[#D6450D] shrink-0 hover:bg-[#FFF2EB]"
            >
              {t('تعديل التوصيل', 'Edit Delivery')}
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-[#6E6A66] mb-1">
              {t('اسم المحل بالعربية', 'Store Name (Arabic)')}
            </label>
            <input
              type="text"
              value={nameAr}
              onChange={(e) => setNameAr(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] text-sm font-bold"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#6E6A66] mb-1">
              {t('اسم المحل بالإنجليزية', 'Store Name (English)')}
            </label>
            <input
              type="text"
              value={nameEn}
              onChange={(e) => setNameEn(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#6E6A66] mb-1">
              {t('رقم هاتف المحل', 'Store Phone')}
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#6E6A66] mb-1">
              {t('مواعيد العمل', 'Working Hours')}
            </label>
            <input
              type="text"
              value={workingHoursAr}
              onChange={(e) => setWorkingHoursAr(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-[#6E6A66] mb-1">
            {t('عنوان المحل التفصيلي', 'Store Address')}
          </label>
          <input
            type="text"
            value={addressAr}
            onChange={(e) => setAddressAr(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-[#6E6A66] mb-1">
            {t('نبذة عن المحل', 'Store Description')}
          </label>
          <textarea
            rows={2}
            value={descriptionAr}
            onChange={(e) => setDescriptionAr(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] text-sm"
          />
        </div>

        <StoreMapPicker
          storeName={nameAr}
          coordinates={coords}
          deliveryRadiusKm={merchant.delivery.maxDistanceKm}
          onChange={(next, resolvedAddress) => {
            setCoords(next);
            if (resolvedAddress && !addressAr.trim()) {
              setAddressAr(resolvedAddress);
            }
          }}
          onSaveLocation={async (next, resolvedAddress) => {
            setCoords(next);
            const nextAddress = resolvedAddress && !addressAr.trim() ? resolvedAddress : addressAr;
            if (resolvedAddress && !addressAr.trim()) {
              setAddressAr(resolvedAddress);
            }
            await updateMerchant(merchant.id, {
              coordinates: next,
              ...(nextAddress !== merchant.addressAr ? { addressAr: nextAddress } : {}),
            });
          }}
        />

        <div>
          <label className="block text-xs font-bold text-[#6E6A66] mb-2">
            {t('الأقسام المتوفرة في المحل', 'Store Categories')}
          </label>
          <div className="flex flex-wrap gap-2">
            {categories
              .filter((c) => c.isGlobal)
              .map((cat) => {
                const active = selectedCats.includes(cat.id);
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => toggleCat(cat.id)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                      active
                        ? 'bg-[#D6450D] text-white border-[#D6450D]'
                        : 'bg-[#FAF9F7] text-[#1C1917] border-[#EAE6E1]'
                    }`}
                  >
                    {language === 'ar' ? cat.nameAr : cat.nameEn}
                  </button>
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
            <span>{t('حفظ بيانات المحل', 'Save Store Profile')}</span>
          </button>
        </div>
      </form>

      <Modal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={t('كيف يظهر محلك للعملاء', 'Customer Storefront Preview')}
      >
        <div className="rounded-2xl border border-[#EAE6E1] overflow-hidden">
          <div className="relative h-36">
            <SafeImage src={coverImage} alt={nameAr} className="w-full h-full object-cover" />
            <div className="absolute bottom-3 start-3 flex items-center gap-2.5">
              <SafeImage
                src={logo}
                alt={nameAr}
                className="w-12 h-12 rounded-xl border-2 border-white bg-white object-cover"
              />
              <div className="text-white drop-shadow">
                <div className="font-extrabold text-base">{nameAr}</div>
                <div className="text-[11px]">{workingHoursAr}</div>
              </div>
            </div>
          </div>
          <div className="p-4 space-y-2 text-xs">
            <p className="text-[#6E6A66]">{descriptionAr}</p>
            <div className="flex justify-between pt-2 border-t border-[#EAE6E1] font-bold">
              <span>
                {t('التوصيل:', 'Delivery:')} {formatEGP(merchant.delivery.deliveryFee, language)}
              </span>
              <span>
                {t('أقل طلب:', 'Min:')} {formatEGP(merchant.delivery.minOrder, language)}
              </span>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
};

export const MerchantStoreSettingsPage: React.FC = () => {
  const { activeMerchant } = useApp();
  return (
    <div className="max-w-5xl space-y-5">
      <StoreSettingsForm key={activeMerchant.id} merchant={activeMerchant} />
    </div>
  );
};

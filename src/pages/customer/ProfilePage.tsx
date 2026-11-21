import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, Heart, LogIn, LogOut, MapPin, Save, User } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  IS_BACKEND_API_ENABLED,
  getStoredApiUser,
} from '../../services/apiClient';
import { authApi } from '../../services/gowarApi';

export const ProfilePage: React.FC = () => {
  const {
    language,
    t,
    activeCustomer,
    updateCustomerProfile,
    orders,
    toggleLanguage,
    refreshFromBackend,
    showToast,
  } = useApp();

  const apiUser = getStoredApiUser();
  const isBackendCustomer = IS_BACKEND_API_ENABLED && apiUser?.role === 'customer';

  const [nameAr, setNameAr] = useState(activeCustomer.nameAr);
  const [nameEn, setNameEn] = useState(activeCustomer.nameEn);
  const [phone, setPhone] = useState(activeCustomer.phone);
  const [email, setEmail] = useState(activeCustomer.email);

  const myOrdersCount = orders.filter((o) => o.customerId === activeCustomer.id).length;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateCustomerProfile({ nameAr, nameEn, phone, email });
  };

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-6 py-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#1C1917]">
            {t('حسابي الشخصي', 'My Profile')}
          </h1>
          <p className="text-xs text-[#6E6A66]">
            {t('إدارة بياناتك الشخصية، العناوين، والمفضلة', 'Manage your personal info, addresses & preferences')}
          </p>
        </div>

        {isBackendCustomer ? (
          <button
            type="button"
            onClick={async () => {
              await authApi.logout();
              await refreshFromBackend();
              showToast(t('تم تسجيل الخروج', 'Signed out'), 'info');
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs font-bold"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{t('تسجيل الخروج', 'Sign Out')}</span>
          </button>
        ) : (
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#FFF2EB] border border-[#FBD8C5] text-[#D6450D] text-xs font-bold"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>{t('تسجيل الدخول / إنشاء حساب', 'Sign In / Register')}</span>
          </Link>
        )}
      </div>

      {/* Quick Nav Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link
          to="/orders"
          className="bg-white rounded-2xl border border-[#EAE6E1] p-4 flex items-center gap-3 hover:border-[#D6450D] transition-colors"
        >
          <div className="w-11 h-11 rounded-xl bg-[#FFF2EB] text-[#D6450D] flex items-center justify-center">
            <ClipboardList className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-[#1C1917]">{t('سجل الطلبات', 'Order History')}</div>
            <div className="text-xs text-[#6E6A66]">
              {myOrdersCount} {t('طلبات', 'orders')}
            </div>
          </div>
        </Link>

        <Link
          to="/addresses"
          className="bg-white rounded-2xl border border-[#EAE6E1] p-4 flex items-center gap-3 hover:border-[#D6450D] transition-colors"
        >
          <div className="w-11 h-11 rounded-xl bg-[#FFF2EB] text-[#D6450D] flex items-center justify-center">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-[#1C1917]">{t('العناوين المحفوظة', 'Saved Addresses')}</div>
            <div className="text-xs text-[#6E6A66]">
              {activeCustomer.addresses.length} {t('عناوين', 'addresses')}
            </div>
          </div>
        </Link>

        <Link
          to="/favorites"
          className="bg-white rounded-2xl border border-[#EAE6E1] p-4 flex items-center gap-3 hover:border-[#D6450D] transition-colors"
        >
          <div className="w-11 h-11 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center">
            <Heart className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-[#1C1917]">{t('المحلات المفضلة', 'Favorite Stores')}</div>
            <div className="text-xs text-[#6E6A66]">
              {activeCustomer.favoriteMerchantIds.length} {t('محلات', 'stores')}
            </div>
          </div>
        </Link>
      </div>

      {/* Personal Info Form */}
      <form
        onSubmit={handleSave}
        className="bg-white rounded-2xl border border-[#EAE6E1] p-5 sm:p-6 space-y-5 shadow-xs"
      >
        <div className="flex items-center gap-3 pb-4 border-b border-[#EAE6E1]">
          <div className="w-12 h-12 rounded-2xl bg-[#D6450D] text-white flex items-center justify-center">
            <User className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-[#1C1917]">
              {language === 'ar' ? activeCustomer.nameAr : activeCustomer.nameEn}
            </h2>
            <p className="text-xs text-[#6E6A66]">{activeCustomer.phone}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-[#6E6A66] mb-1">
              {t('الاسم بالعربية', 'Name (Arabic)')}
            </label>
            <input
              type="text"
              value={nameAr}
              onChange={(e) => setNameAr(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] text-sm focus:outline-none focus:border-[#D6450D] focus:bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-[#6E6A66] mb-1">
              {t('الاسم بالإنجليزية', 'Name (English)')}
            </label>
            <input
              type="text"
              value={nameEn}
              onChange={(e) => setNameEn(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] text-sm focus:outline-none focus:border-[#D6450D] focus:bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-[#6E6A66] mb-1">
              {t('رقم الموبايل', 'Phone Number')}
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] text-sm focus:outline-none focus:border-[#D6450D] focus:bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-[#6E6A66] mb-1">
              {t('البريد الإلكتروني', 'Email Address')}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] text-sm focus:outline-none focus:border-[#D6450D] focus:bg-white"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#EAE6E1]">
          <button
            type="button"
            onClick={toggleLanguage}
            className="px-4 py-2.5 rounded-xl border border-[#EAE6E1] text-xs font-bold text-[#1C1917] hover:bg-[#FAF9F7]"
          >
            {t('تغيير لغة الواجهة إلى الإنجليزية', 'Switch Language to Arabic')}
          </button>
          <button
            type="submit"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#D6450D] hover:bg-[#B33808] text-white text-xs font-bold"
          >
            <Save className="w-4 h-4" />
            <span>{t('حفظ التعديلات', 'Save Changes')}</span>
          </button>
        </div>
      </form>
    </div>
  );
};

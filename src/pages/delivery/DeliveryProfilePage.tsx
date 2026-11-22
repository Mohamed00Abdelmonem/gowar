import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Mail, ShieldCheck, User } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const DeliveryProfilePage: React.FC = () => {
  const { language, t, authSession, logoutPortal } = useApp();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logoutPortal();
    navigate('/delivery/login', { replace: true });
  };

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <div className="bg-white rounded-2xl border border-[#EAE6E1] p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#E6F5EC] text-[#1B8E53] flex items-center justify-center">
            <User className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-base font-extrabold text-[#1C1917]">
              {language === 'ar' ? authSession?.nameAr : authSession?.nameEn}
            </h1>
            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
              <ShieldCheck className="w-3.5 h-3.5" />
              {t('مندوب توصيل معتمد', 'Authorized Delivery Personnel')}
            </span>
          </div>
        </div>

        <div className="pt-3 border-t border-[#EAE6E1] flex items-center gap-2 text-xs text-[#6E6A66]">
          <Mail className="w-4 h-4" />
          <span>{authSession?.email}</span>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="w-full py-3 px-4 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-sm font-extrabold inline-flex items-center justify-center gap-2 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>{t('تسجيل الخروج', 'Logout')}</span>
        </button>
      </div>
    </div>
  );
};

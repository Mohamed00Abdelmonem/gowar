import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Globe, RotateCcw, ShieldCheck, ShoppingBag, Store } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const RoleSwitcherBar: React.FC = () => {
  const { language, toggleLanguage, resetDemoData, t } = useApp();
  const location = useLocation();
  const navigate = useNavigate();

  const currentRole: 'customer' | 'merchant' | 'admin' = location.pathname.startsWith('/merchant')
    ? 'merchant'
    : location.pathname.startsWith('/admin')
      ? 'admin'
      : 'customer';

  const roles = [
    {
      id: 'customer' as const,
      path: '/',
      labelAr: 'المتسوق',
      labelEn: 'Customer',
      icon: ShoppingBag,
    },
    {
      id: 'merchant' as const,
      path: '/merchant',
      labelAr: 'التاجر',
      labelEn: 'Merchant',
      icon: Store,
    },
    {
      id: 'admin' as const,
      path: '/admin',
      labelAr: 'الإدارة',
      labelEn: 'Admin',
      icon: ShieldCheck,
    },
  ];

  return (
    <div className="bg-[#1C1917] text-white text-[11px] sm:text-xs border-b border-white/10">
      <div className="max-w-7xl mx-auto px-2.5 sm:px-6 h-10 flex items-center justify-between gap-1.5 sm:gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="hidden md:inline-flex items-center gap-1.5 text-orange-300 font-semibold shrink-0">
            <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
            {t('وضع العرض التفاعلي', 'Interactive Demo')}
          </span>
          <span className="hidden md:inline text-white/30">|</span>
          <div className="flex items-center gap-0.5 sm:gap-1 bg-white/10 p-0.5 rounded-lg overflow-x-auto no-scrollbar">
            {roles.map((r) => {
              const Icon = r.icon;
              const active = currentRole === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => navigate(r.path)}
                  className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-md font-semibold transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-[#D6450D] text-white shadow-xs'
                      : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Icon className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                  <span>{language === 'ar' ? r.labelAr : r.labelEn}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          <button
            type="button"
            onClick={toggleLanguage}
            className="flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-md bg-white/10 hover:bg-white/20 text-white font-semibold transition-colors"
            title={t('تغيير اللغة', 'Switch Language')}
          >
            <Globe className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-orange-300" />
            <span>{language === 'ar' ? 'EN' : 'عربي'}</span>
          </button>
          <button
            type="button"
            onClick={resetDemoData}
            className="flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-md bg-white/10 hover:bg-white/20 text-white/90 font-medium transition-colors"
            title={t('إعادة ضبط بيانات العرض', 'Reset demo data')}
          >
            <RotateCcw className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            <span className="hidden sm:inline">{t('إعادة ضبط', 'Reset')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

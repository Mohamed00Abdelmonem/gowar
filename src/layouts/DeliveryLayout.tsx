import React from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  ClipboardList,
  Download,
  Globe,
  LayoutDashboard,
  LogOut,
  Truck,
  User,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { BrandLogo } from '../components/common/BrandLogo';
import { NotificationBell } from '../components/common/NotificationBell';
import { isStandaloneMode, requestPwaInstallModal } from '../services/pwaInstall';

export const DeliveryLayout: React.FC = () => {
  const { language, setLanguage, t, authSession, logoutPortal } = useApp();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logoutPortal();
    navigate('/delivery/login', { replace: true });
  };

  const navItems = [
    { to: '/delivery', end: true, icon: LayoutDashboard, label: t('الرئيسية', 'Dashboard') },
    { to: '/delivery/orders', end: false, icon: ClipboardList, label: t('طلباتي', 'My Orders') },
    {
      to: '/delivery/in-progress',
      end: false,
      icon: Truck,
      label: t('جاري التوصيل', 'In Progress'),
    },
    {
      to: '/delivery/delivered',
      end: false,
      icon: CheckCircle2,
      label: t('المكتملة', 'Delivered'),
    },
    { to: '/delivery/profile', end: false, icon: User, label: t('حسابي', 'Profile') },
  ];

  return (
    <div className="min-h-screen bg-[#FAF9F7] flex flex-col pb-20 md:pb-6">
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#EAE6E1]">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <Link to="/delivery" className="flex items-center gap-2.5 min-w-0">
            <BrandLogo compact />
            <div className="min-w-0">
              <div className="text-sm sm:text-base font-extrabold text-[#1C1917] truncate">
                {t('جوار توصيل', 'Gowar Delivery')}
              </div>
              <div className="text-[11px] text-[#6E6A66] truncate">
                {language === 'ar' ? authSession?.nameAr : authSession?.nameEn}
              </div>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
                      isActive
                        ? 'bg-[#E6F5EC] text-[#1B8E53]'
                        : 'text-[#6E6A66] hover:bg-[#FAF9F7] hover:text-[#1C1917]'
                    }`
                  }
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <NotificationBell audience="delivery" />
            {!isStandaloneMode() && (
              <button
                type="button"
                onClick={requestPwaInstallModal}
                className="h-9 px-2.5 rounded-xl border border-[#C2E7D2] bg-[#E6F5EC] hover:bg-[#D5EFE0] text-xs font-bold text-[#1B8E53] inline-flex items-center gap-1"
                title={t('تثبيت التطبيق', 'Install App')}
              >
                <Download className="w-3.5 h-3.5 shrink-0" />
                <span>{t('تثبيت التطبيق', 'Install App')}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
              className="h-9 px-2.5 rounded-xl border border-[#EAE6E1] text-xs font-bold text-[#1C1917] hover:bg-[#FAF9F7] inline-flex items-center gap-1"
            >
              <Globe className="w-3.5 h-3.5 text-[#1B8E53]" />
              <span>{language === 'ar' ? 'EN' : 'عربي'}</span>
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="h-9 px-3 rounded-xl border border-[#EAE6E1] text-xs font-bold text-rose-700 hover:bg-rose-50 inline-flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t('خروج', 'Logout')}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-5">
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-[#EAE6E1] px-1 py-1.5 flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-0.5 min-w-[58px] py-1 px-2 rounded-xl text-[11px] font-bold transition-colors ${
                  isActive ? 'text-[#1B8E53] bg-[#E6F5EC]' : 'text-[#6E6A66]'
                }`
              }
            >
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
};

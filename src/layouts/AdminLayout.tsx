import React, { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Bell,
  ClipboardList,
  FolderTree,
  Globe,
  LayoutDashboard,
  LineChart,
  LogOut,
  MapPin,
  Megaphone,
  Menu,
  Percent,
  Settings,
  ShieldCheck,
  Store,
  Users,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { BrandLogo } from '../components/common/BrandLogo';

export const AdminLayout: React.FC = () => {
  const {
    language,
    toggleLanguage,
    t,
    merchants,
    notifications,
    markNotificationsRead,
    authSession,
    logoutPortal,
  } = useApp();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const navigate = useNavigate();

  const pendingMerchantsCount = merchants.filter((m) => m.status === 'pending').length;
  const adminNotifs = notifications.filter((n) => n.audience === 'admin');
  const unreadCount = adminNotifs.filter((n) => !n.read).length;

  const navItems = [
    { to: '/admin', end: true, icon: LayoutDashboard, label: t('نظرة عامة', 'Overview') },
    {
      to: '/admin/merchants',
      icon: Store,
      label: t('التجار والمتاجر', 'Merchants'),
      badge: pendingMerchantsCount,
    },
    { to: '/admin/orders', icon: ClipboardList, label: t('الطلبات', 'Orders') },
    { to: '/admin/customers', icon: Users, label: t('العملاء', 'Customers') },
    { to: '/admin/analytics', icon: LineChart, label: t('التحليلات المالية', 'Analytics') },
    { to: '/admin/commissions', icon: Percent, label: t('العمولات', 'Commissions') },
    { to: '/admin/categories', icon: FolderTree, label: t('التصنيفات', 'Categories') },
    { to: '/admin/promotions', icon: Megaphone, label: t('العروض والبانرات', 'Promotions') },
    { to: '/admin/areas', icon: MapPin, label: t('مناطق الخدمة', 'Service Areas') },
    { to: '/admin/reports', icon: BarChart3, label: t('التقارير', 'Reports') },
    { to: '/admin/settings', icon: Settings, label: t('الإعدادات', 'Settings') },
  ];

  const handleLogout = () => {
    logoutPortal();
    navigate('/admin/login', { replace: true });
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF9F7]">
      <div className="flex-1 flex relative">
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Super Admin Executive Sidebar */}
        <aside
          className={`fixed lg:static inset-y-0 start-0 z-50 w-64 bg-[#1C1917] text-white flex flex-col transition-transform duration-200 ${
            sidebarOpen
              ? 'translate-x-0'
              : '-translate-x-full rtl:translate-x-full lg:translate-x-0 lg:rtl:translate-x-0'
          }`}
        >
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <Link to="/admin" onClick={() => setSidebarOpen(false)}>
              <BrandLogo variant="light" />
            </Link>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1.5 rounded-lg text-white/70 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="px-4 py-3 bg-white/5 border-b border-white/10 flex items-center gap-2.5">
            <ShieldCheck className="w-4 h-4 text-orange-400 shrink-0" />
            <div className="min-w-0">
              <div className="text-xs font-extrabold text-white truncate">
                {authSession ? (language === 'ar' ? authSession.nameAr : authSession.nameEn) : 'Super Admin'}
              </div>
              <div className="text-[10px] text-white/60 truncate">
                {authSession?.email ?? 'admin@gowar.demo'}
              </div>
            </div>
          </div>

          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                      isActive
                        ? 'bg-[#1B8E53] text-white shadow-xs'
                        : 'text-white/75 hover:bg-white/10 hover:text-white'
                    }`
                  }
                >
                  <span className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </span>
                  {item.badge ? (
                    <span className="px-2 py-0.5 rounded-full bg-amber-400 text-[#1C1917] text-[11px] font-extrabold">
                      {item.badge}
                    </span>
                  ) : null}
                </NavLink>
              );
            })}
          </nav>

          <div className="p-3 border-t border-white/10">
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center justify-center gap-2 w-full py-2.5 px-3 rounded-xl bg-white/10 hover:bg-rose-600 text-white text-xs font-bold transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>{t('تسجيل الخروج', 'Logout')}</span>
            </button>
          </div>
        </aside>

        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-30 bg-white border-b border-[#EAE6E1] px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 rounded-xl border border-[#EAE6E1]"
                aria-label="Open menu"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-sm sm:text-base font-extrabold text-[#1C1917]">
                  {t('إدارة منصة جوار — Super Admin', 'Gowar Platform Operations')}
                </h1>
                <p className="text-[11px] text-[#6E6A66] hidden sm:block">
                  {t(
                    'مراقبة حجم المبيعات (GMV)، العمولات، المتاجر والطلبات عبر المنصة',
                    'Monitor GMV, Gowar revenue, merchants, orders & coverage'
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleLanguage}
                className="w-9 h-9 rounded-xl border border-[#EAE6E1] flex items-center justify-center text-[#1C1917] hover:bg-[#FAF9F7]"
                title={t('تغيير اللغة', 'Switch Language')}
              >
                <Globe className="w-4 h-4 text-[#1B8E53]" />
              </button>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setNotifOpen((o) => !o);
                    if (!notifOpen) markNotificationsRead('admin');
                  }}
                  className="relative w-9 h-9 rounded-xl border border-[#EAE6E1] flex items-center justify-center text-[#1C1917] hover:bg-[#FAF9F7]"
                >
                  <Bell className="w-4 h-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -end-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {notifOpen && (
                  <div className="fixed sm:absolute top-16 sm:top-auto inset-x-3 sm:inset-x-auto sm:end-0 sm:mt-2 sm:w-80 bg-white rounded-2xl border border-[#EAE6E1] shadow-xl p-3 z-50">
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#EAE6E1]">
                      <span className="text-xs font-bold text-[#1C1917]">
                        {t('إشعارات الإدارة', 'Admin Notifications')}
                      </span>
                      <button
                        type="button"
                        onClick={() => setNotifOpen(false)}
                        className="text-[11px] text-[#6E6A66]"
                      >
                        {t('إغلاق', 'Close')}
                      </button>
                    </div>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {adminNotifs.map((n) => (
                        <Link
                          key={n.id}
                          to={n.link || '/admin'}
                          onClick={() => setNotifOpen(false)}
                          className="block p-2.5 rounded-xl bg-[#FAF9F7] hover:bg-[#E6F5EC]"
                        >
                          <p className="text-xs font-bold text-[#1C1917]">
                            {language === 'ar' ? n.titleAr : n.titleEn}
                          </p>
                          <p className="text-[11px] text-[#6E6A66] mt-0.5">
                            {language === 'ar' ? n.bodyAr : n.bodyEn}
                          </p>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </header>

          <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
};

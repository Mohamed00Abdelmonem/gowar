import React, { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Boxes,
  ClipboardList,
  ExternalLink,
  Globe,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Power,
  Store,
  Truck,
  Users,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { BrandLogo } from '../components/common/BrandLogo';
import { NotificationBell } from '../components/common/NotificationBell';
import { SafeImage } from '../components/common/SafeImage';

export const MerchantLayout: React.FC = () => {
  const {
    language,
    toggleLanguage,
    t,
    activeMerchant,
    toggleMerchantOpen,
    orders,
    products,
    authSession,
    logoutPortal,
  } = useApp();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();

  const pendingOrdersCount = orders.filter(
    (o) => o.merchantId === activeMerchant.id && o.status === 'pending'
  ).length;

  const lowStockCount = products.filter(
    (p) => p.merchantId === activeMerchant.id && p.stock <= 5
  ).length;

  const navItems = [
    { to: '/merchant', end: true, icon: LayoutDashboard, label: t('الرئيسية', 'Overview') },
    {
      to: '/merchant/orders',
      icon: ClipboardList,
      label: t('الطلبات', 'Orders'),
      badge: pendingOrdersCount,
    },
    { to: '/merchant/products', icon: Package, label: t('المنتجات', 'Products') },
    {
      to: '/merchant/inventory',
      icon: Boxes,
      label: t('المخزون', 'Inventory'),
      badge: lowStockCount,
      badgeTone: 'amber',
    },
    { to: '/merchant/analytics', icon: BarChart3, label: t('التحليلات', 'Analytics') },
    { to: '/merchant/customers', icon: Users, label: t('العملاء', 'Customers') },
    { to: '/merchant/delivery', icon: Truck, label: t('إعدادات التوصيل', 'Delivery') },
    { to: '/merchant/settings', icon: Store, label: t('بيانات المحل', 'Store Settings') },
  ];

  const handleLogout = () => {
    logoutPortal();
    navigate('/merchant/login', { replace: true });
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

        {/* Friendly Merchant Sidebar */}
        <aside
          className={`fixed lg:static inset-y-0 start-0 z-50 w-68 bg-white border-e border-[#EAE6E1] flex flex-col transition-transform duration-200 ${
            sidebarOpen
              ? 'translate-x-0'
              : '-translate-x-full rtl:translate-x-full lg:translate-x-0 lg:rtl:translate-x-0'
          }`}
        >
          <div className="p-4 border-b border-[#EAE6E1] flex items-center justify-between">
            <Link to="/merchant" onClick={() => setSidebarOpen(false)}>
              <BrandLogo />
            </Link>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1.5 rounded-lg text-[#6E6A66] hover:bg-[#FAF9F7]"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Authenticated Store Identity Card (Strictly Scoped) */}
          <div className="p-3.5 border-b border-[#EAE6E1] bg-[#FFF2EB]/60">
            <div className="flex items-center gap-3">
              <SafeImage
                src={activeMerchant.logo}
                alt={activeMerchant.nameAr}
                className="w-11 h-11 rounded-xl border border-[#FBD8C5] object-cover shrink-0 bg-white"
              />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-extrabold text-[#1C1917] truncate">
                  {language === 'ar' ? activeMerchant.nameAr : activeMerchant.nameEn}
                </div>
                <div className="text-[11px] text-[#6E6A66] truncate">
                  {authSession
                    ? language === 'ar'
                      ? authSession.nameAr
                      : authSession.nameEn
                    : activeMerchant.ownerNameAr}
                </div>
                {activeMerchant.merchantCode && (
                  <span className="inline-block text-[10px] font-bold text-[#D6450D]">
                    {activeMerchant.merchantCode}
                  </span>
                )}
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
                        ? 'bg-[#D6450D] text-white shadow-xs'
                        : 'text-[#1C1917] hover:bg-[#FFF2EB] hover:text-[#D6450D]'
                    }`
                  }
                >
                  <span className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </span>
                  {item.badge ? (
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                        item.badgeTone === 'amber'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-500 text-white'
                      }`}
                    >
                      {item.badge}
                    </span>
                  ) : null}
                </NavLink>
              );
            })}
          </nav>

          <div className="p-3 border-t border-[#EAE6E1] space-y-2">
            <Link
              to={`/stores/${activeMerchant.id}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 w-full py-2.5 px-3 rounded-xl bg-[#FFF2EB] text-[#D6450D] hover:bg-[#FDE2D2] text-xs font-bold transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              <span>{t('معاينة المحل في السوق', 'Preview Customer Store')}</span>
            </Link>

            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center justify-center gap-2 w-full py-2.5 px-3 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>{t('تسجيل الخروج', 'Logout')}</span>
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-30 bg-white border-b border-[#EAE6E1] px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 rounded-xl border border-[#EAE6E1] text-[#1C1917]"
                aria-label="Open menu"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div className="min-w-0">
                <h1 className="text-sm sm:text-base font-extrabold text-[#1C1917] truncate">
                  {language === 'ar' ? activeMerchant.nameAr : activeMerchant.nameEn}
                </h1>
                <p className="text-[11px] text-[#6E6A66] hidden sm:block truncate">
                  {language === 'ar' ? activeMerchant.addressAr : activeMerchant.addressEn}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => toggleMerchantOpen(activeMerchant.id)}
                className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3.5 py-2 rounded-xl text-[11px] sm:text-xs font-bold border transition-colors ${
                  activeMerchant.isOpen
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                    : 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'
                }`}
              >
                <Power className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate max-w-[100px] sm:max-w-none">
                  {activeMerchant.isOpen
                    ? t('المحل مفتوح', 'Store Open')
                    : t('مغلق مؤقتاً', 'Paused')}
                </span>
              </button>

              <Link
                to="/merchant/products/new"
                className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#D6450D] hover:bg-[#B33808] text-white text-xs font-bold transition-colors"
              >
                <span>+ {t('منتج جديد', 'Add Product')}</span>
              </Link>

              <button
                type="button"
                onClick={toggleLanguage}
                className="w-9 h-9 rounded-xl border border-[#EAE6E1] flex items-center justify-center text-xs font-bold text-[#1C1917] hover:bg-[#FAF9F7]"
                title={t('تغيير اللغة', 'Switch Language')}
              >
                <Globe className="w-4 h-4 text-[#D6450D]" />
              </button>

              <NotificationBell audience="merchant" merchantId={activeMerchant.id} />
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

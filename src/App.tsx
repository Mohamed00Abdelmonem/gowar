import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import {
  getInstalledPortal,
  getManifestHrefForPortal,
  getPwaPortalForPath,
  isStandaloneMode,
  resolveStandaloneStartPath,
} from './services/pwaInstall';
import { ToastContainer } from './components/common/ToastContainer';
import { CartConflictModal } from './components/common/CartConflictModal';
import { PwaInstallModal } from './components/pwa/PwaInstallModal';
import { PushNotificationPrompt } from './components/notifications/PushNotificationPrompt';
import { ProtectedRoute } from './components/auth/ProtectedRoute';

// Eagerly loaded customer shell + home for fast initial mobile paint
import { CustomerLayout } from './layouts/CustomerLayout';
import { CustomerHomePage } from './pages/customer/CustomerHomePage';

// Lazy-loaded Layouts
const MerchantLayout = lazy(() => import('./layouts/MerchantLayout').then((m) => ({ default: m.MerchantLayout })));
const AdminLayout = lazy(() => import('./layouts/AdminLayout').then((m) => ({ default: m.AdminLayout })));
const DeliveryLayout = lazy(() => import('./layouts/DeliveryLayout').then((m) => ({ default: m.DeliveryLayout })));

// Lazy-loaded Customer Pages
const StoresPage = lazy(() => import('./pages/customer/StoresPage').then((m) => ({ default: m.StoresPage })));
const StoreDetailsPage = lazy(() => import('./pages/customer/StoreDetailsPage').then((m) => ({ default: m.StoreDetailsPage })));
const ProductDetailsPage = lazy(() => import('./pages/customer/ProductDetailsPage').then((m) => ({ default: m.ProductDetailsPage })));
const CartPage = lazy(() => import('./pages/customer/CartPage').then((m) => ({ default: m.CartPage })));
const CheckoutPage = lazy(() => import('./pages/customer/CheckoutPage').then((m) => ({ default: m.CheckoutPage })));
const OrdersPage = lazy(() => import('./pages/customer/OrdersPage').then((m) => ({ default: m.OrdersPage })));
const OrderTrackingPage = lazy(() => import('./pages/customer/OrderTrackingPage').then((m) => ({ default: m.OrderTrackingPage })));
const ProfilePage = lazy(() => import('./pages/customer/ProfilePage').then((m) => ({ default: m.ProfilePage })));
const AddressesPage = lazy(() => import('./pages/customer/AddressesPage').then((m) => ({ default: m.AddressesPage })));
const FavoritesPage = lazy(() => import('./pages/customer/FavoritesPage').then((m) => ({ default: m.FavoritesPage })));
const CustomerAuthPage = lazy(() => import('./pages/customer/CustomerAuthPage').then((m) => ({ default: m.CustomerAuthPage })));

// Lazy-loaded Merchant Pages
const MerchantLoginPage = lazy(() => import('./pages/merchant/MerchantLoginPage').then((m) => ({ default: m.MerchantLoginPage })));
const MerchantOverviewPage = lazy(() => import('./pages/merchant/MerchantOverviewPage').then((m) => ({ default: m.MerchantOverviewPage })));
const MerchantOrdersPage = lazy(() => import('./pages/merchant/MerchantOrdersPage').then((m) => ({ default: m.MerchantOrdersPage })));
const MerchantProductsPage = lazy(() => import('./pages/merchant/MerchantProductsPage').then((m) => ({ default: m.MerchantProductsPage })));
const MerchantProductFormPage = lazy(() => import('./pages/merchant/MerchantProductFormPage').then((m) => ({ default: m.MerchantProductFormPage })));
const MerchantCategoriesPage = lazy(() => import('./pages/merchant/MerchantCategoriesPage').then((m) => ({ default: m.MerchantCategoriesPage })));
const MerchantInventoryPage = lazy(() => import('./pages/merchant/MerchantInventoryPage').then((m) => ({ default: m.MerchantInventoryPage })));
const MerchantDeliveryPage = lazy(() => import('./pages/merchant/MerchantDeliveryPage').then((m) => ({ default: m.MerchantDeliveryPage })));
const MerchantDeliveryOverviewPage = lazy(() => import('./pages/merchant/delivery/MerchantDeliveryOverviewPage').then((m) => ({ default: m.MerchantDeliveryOverviewPage })));
const MerchantDeliveryPersonnelPage = lazy(() => import('./pages/merchant/delivery/MerchantDeliveryPersonnelPage').then((m) => ({ default: m.MerchantDeliveryPersonnelPage })));
const MerchantDeliveryTrackingPage = lazy(() => import('./pages/merchant/delivery/MerchantDeliveryTrackingPage').then((m) => ({ default: m.MerchantDeliveryTrackingPage })));
const MerchantDeliveryPerformancePage = lazy(() => import('./pages/merchant/delivery/MerchantDeliveryPerformancePage').then((m) => ({ default: m.MerchantDeliveryPerformancePage })));
const MerchantStoreSettingsPage = lazy(() => import('./pages/merchant/MerchantStoreSettingsPage').then((m) => ({ default: m.MerchantStoreSettingsPage })));
const MerchantAnalyticsPage = lazy(() => import('./pages/merchant/MerchantAnalyticsPage').then((m) => ({ default: m.MerchantAnalyticsPage })));
const MerchantCustomersPage = lazy(() => import('./pages/merchant/MerchantCustomersPage').then((m) => ({ default: m.MerchantCustomersPage })));

// Lazy-loaded Delivery Pages
const DeliveryLoginPage = lazy(() => import('./pages/delivery/DeliveryLoginPage').then((m) => ({ default: m.DeliveryLoginPage })));
const DeliveryDashboardPage = lazy(() => import('./pages/delivery/DeliveryDashboardPage').then((m) => ({ default: m.DeliveryDashboardPage })));
const DeliveryOrderDetailPage = lazy(() => import('./pages/delivery/DeliveryOrderDetailPage').then((m) => ({ default: m.DeliveryOrderDetailPage })));
const DeliveryProfilePage = lazy(() => import('./pages/delivery/DeliveryProfilePage').then((m) => ({ default: m.DeliveryProfilePage })));

// Lazy-loaded Admin Pages
const AdminLoginPage = lazy(() => import('./pages/admin/AdminLoginPage').then((m) => ({ default: m.AdminLoginPage })));
const AdminOverviewPage = lazy(() => import('./pages/admin/AdminOverviewPage').then((m) => ({ default: m.AdminOverviewPage })));
const AdminMerchantsPage = lazy(() => import('./pages/admin/AdminMerchantsPage').then((m) => ({ default: m.AdminMerchantsPage })));
const AdminMerchantDetailPage = lazy(() => import('./pages/admin/AdminMerchantDetailPage').then((m) => ({ default: m.AdminMerchantDetailPage })));
const AdminCustomersPage = lazy(() => import('./pages/admin/AdminCustomersPage').then((m) => ({ default: m.AdminCustomersPage })));
const AdminOrdersPage = lazy(() => import('./pages/admin/AdminOrdersPage').then((m) => ({ default: m.AdminOrdersPage })));
const AdminAnalyticsPage = lazy(() => import('./pages/admin/AdminAnalyticsPage').then((m) => ({ default: m.AdminAnalyticsPage })));
const AdminCategoriesPage = lazy(() => import('./pages/admin/AdminCategoriesPage').then((m) => ({ default: m.AdminCategoriesPage })));
const AdminAreasPage = lazy(() => import('./pages/admin/AdminAreasPage').then((m) => ({ default: m.AdminAreasPage })));
const AdminCommissionsPage = lazy(() => import('./pages/admin/AdminCommissionsPage').then((m) => ({ default: m.AdminCommissionsPage })));
const AdminReportsPage = lazy(() => import('./pages/admin/AdminReportsPage').then((m) => ({ default: m.AdminReportsPage })));
const AdminSettingsPage = lazy(() => import('./pages/admin/AdminSettingsPage').then((m) => ({ default: m.AdminSettingsPage })));
const AdminPromotionsPage = lazy(() => import('./pages/admin/AdminPromotionsPage').then((m) => ({ default: m.AdminPromotionsPage })));

const RouteFallback: React.FC = () => (
  <div className="min-h-[45vh] flex items-center justify-center p-6">
    <div className="w-8 h-8 rounded-full border-2 border-[#1B8E53] border-t-transparent animate-spin" />
  </div>
);

const ScrollToTop: React.FC = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
};

const PwaRouteCoordinator: React.FC = () => {
  const { pathname } = useLocation();
  const { authSession } = useApp();

  useEffect(() => {
    const portal = getPwaPortalForPath(pathname);
    const manifestHref = getManifestHrefForPortal(portal);
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (link && link.getAttribute('href') !== manifestHref) {
      link.setAttribute('href', manifestHref);
    }
  }, [pathname]);

  if (!isDeliverySubdomain && pathname === '/' && isStandaloneMode()) {
    const target = resolveStandaloneStartPath({
      pathname,
      standalone: true,
      authRole: authSession?.role ?? null,
      installedPortal: getInstalledPortal(),
    });
    if (target) {
      return <Navigate to={target} replace />;
    }
  }

  return null;
};

const isDeliverySubdomain =
  typeof window !== 'undefined' &&
  window.location.hostname.toLowerCase().startsWith('delivery.');

export function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <ScrollToTop />
        <PwaRouteCoordinator />
        <Suspense fallback={<RouteFallback />}>
        <Routes>
          {isDeliverySubdomain && (
            <Route path="/" element={<Navigate to="/delivery" replace />} />
          )}

          {/* Customer Marketplace Routes */}
          <Route path="/" element={<CustomerLayout />}>
            <Route index element={<CustomerHomePage />} />
            <Route path="stores" element={<StoresPage />} />
            <Route path="stores/:storeId" element={<StoreDetailsPage />} />
            <Route path="product/:productId" element={<ProductDetailsPage />} />
            <Route path="cart" element={<CartPage />} />
            <Route path="checkout" element={<CheckoutPage />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="orders/:orderId" element={<OrderTrackingPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="addresses" element={<AddressesPage />} />
            <Route path="favorites" element={<FavoritesPage />} />
            <Route path="login" element={<CustomerAuthPage initialMode="login" />} />
            <Route path="register" element={<CustomerAuthPage initialMode="register" />} />
          </Route>

          {/* Portal Logins */}
          <Route path="/merchant/login" element={<MerchantLoginPage />} />
          <Route path="/delivery/login" element={<DeliveryLoginPage />} />
          <Route path="/admin/login" element={<AdminLoginPage />} />

          {/* Protected Delivery Dashboard Routes */}
          <Route
            path="/delivery"
            element={
              <ProtectedRoute requiredRole="delivery">
                <DeliveryLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DeliveryDashboardPage presetStatus="all" />} />
            <Route path="orders" element={<DeliveryDashboardPage presetStatus="all" />} />
            <Route path="orders/:orderId" element={<DeliveryOrderDetailPage />} />
            <Route path="in-progress" element={<DeliveryDashboardPage presetStatus="in_progress" />} />
            <Route path="delivered" element={<DeliveryDashboardPage presetStatus="delivered" />} />
            <Route path="profile" element={<DeliveryProfilePage />} />
          </Route>

          {/* Protected Merchant Dashboard Routes */}
          <Route
            path="/merchant"
            element={
              <ProtectedRoute requiredRole="merchant">
                <MerchantLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<MerchantOverviewPage />} />
            <Route path="orders" element={<MerchantOrdersPage />} />
            <Route path="orders/:orderId" element={<MerchantOrdersPage />} />
            <Route path="products" element={<MerchantProductsPage />} />
            <Route path="products/new" element={<MerchantProductFormPage />} />
            <Route path="products/:productId/edit" element={<MerchantProductFormPage />} />
            <Route path="categories" element={<MerchantCategoriesPage />} />
            <Route path="inventory" element={<MerchantInventoryPage />} />
            <Route path="analytics" element={<MerchantAnalyticsPage />} />
            <Route path="customers" element={<MerchantCustomersPage />} />
            <Route path="delivery" element={<MerchantDeliveryPage />} />
            <Route path="delivery-management" element={<MerchantDeliveryOverviewPage />} />
            <Route path="delivery-management/personnel" element={<MerchantDeliveryPersonnelPage />} />
            <Route path="delivery-management/tracking" element={<MerchantDeliveryTrackingPage />} />
            <Route path="delivery-management/performance" element={<MerchantDeliveryPerformancePage />} />
            <Route path="settings" element={<MerchantStoreSettingsPage />} />
            <Route path="store-settings" element={<MerchantStoreSettingsPage />} />
          </Route>

          {/* Protected Super Admin Dashboard Routes */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<AdminOverviewPage />} />
            <Route path="merchants" element={<AdminMerchantsPage />} />
            <Route path="merchants/:id" element={<AdminMerchantDetailPage />} />
            <Route path="orders" element={<AdminOrdersPage />} />
            <Route path="customers" element={<AdminCustomersPage />} />
            <Route path="analytics" element={<AdminAnalyticsPage />} />
            <Route path="commissions" element={<AdminCommissionsPage />} />
            <Route path="categories" element={<AdminCategoriesPage />} />
            <Route path="promotions" element={<AdminPromotionsPage />} />
            <Route path="areas" element={<AdminAreasPage />} />
            <Route path="reports" element={<AdminReportsPage />} />
            <Route path="settings" element={<AdminSettingsPage />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>

        <CartConflictModal />
        <PwaInstallModal />
        <PushNotificationPrompt />
        <ToastContainer />
      </BrowserRouter>
    </AppProvider>
  );
}

export default App;

import React, { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { ToastContainer } from './components/common/ToastContainer';
import { CartConflictModal } from './components/common/CartConflictModal';
import { ProtectedRoute } from './components/auth/ProtectedRoute';

// Layouts
import { CustomerLayout } from './layouts/CustomerLayout';
import { MerchantLayout } from './layouts/MerchantLayout';
import { AdminLayout } from './layouts/AdminLayout';

// Customer Pages
import { CustomerHomePage } from './pages/customer/CustomerHomePage';
import { StoresPage } from './pages/customer/StoresPage';
import { StoreDetailsPage } from './pages/customer/StoreDetailsPage';
import { ProductDetailsPage } from './pages/customer/ProductDetailsPage';
import { CartPage } from './pages/customer/CartPage';
import { CheckoutPage } from './pages/customer/CheckoutPage';
import { OrdersPage } from './pages/customer/OrdersPage';
import { OrderTrackingPage } from './pages/customer/OrderTrackingPage';
import { ProfilePage } from './pages/customer/ProfilePage';
import { AddressesPage } from './pages/customer/AddressesPage';
import { FavoritesPage } from './pages/customer/FavoritesPage';
import { CustomerAuthPage } from './pages/customer/CustomerAuthPage';

// Merchant Pages
import { MerchantLoginPage } from './pages/merchant/MerchantLoginPage';
import { MerchantOverviewPage } from './pages/merchant/MerchantOverviewPage';
import { MerchantOrdersPage } from './pages/merchant/MerchantOrdersPage';
import { MerchantProductsPage } from './pages/merchant/MerchantProductsPage';
import { MerchantProductFormPage } from './pages/merchant/MerchantProductFormPage';
import { MerchantCategoriesPage } from './pages/merchant/MerchantCategoriesPage';
import { MerchantInventoryPage } from './pages/merchant/MerchantInventoryPage';
import { MerchantDeliveryPage } from './pages/merchant/MerchantDeliveryPage';
import { MerchantStoreSettingsPage } from './pages/merchant/MerchantStoreSettingsPage';
import { MerchantAnalyticsPage } from './pages/merchant/MerchantAnalyticsPage';
import { MerchantCustomersPage } from './pages/merchant/MerchantCustomersPage';

// Admin Pages
import { AdminLoginPage } from './pages/admin/AdminLoginPage';
import { AdminOverviewPage } from './pages/admin/AdminOverviewPage';
import { AdminMerchantsPage } from './pages/admin/AdminMerchantsPage';
import { AdminMerchantDetailPage } from './pages/admin/AdminMerchantDetailPage';
import { AdminCustomersPage } from './pages/admin/AdminCustomersPage';
import { AdminOrdersPage } from './pages/admin/AdminOrdersPage';
import { AdminAnalyticsPage } from './pages/admin/AdminAnalyticsPage';
import { AdminCategoriesPage } from './pages/admin/AdminCategoriesPage';
import { AdminAreasPage } from './pages/admin/AdminAreasPage';
import { AdminCommissionsPage } from './pages/admin/AdminCommissionsPage';
import { AdminReportsPage } from './pages/admin/AdminReportsPage';
import { AdminSettingsPage } from './pages/admin/AdminSettingsPage';

const ScrollToTop: React.FC = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
};

export function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <ScrollToTop />
        <Routes>
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
          <Route path="/admin/login" element={<AdminLoginPage />} />

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
            <Route path="areas" element={<AdminAreasPage />} />
            <Route path="reports" element={<AdminReportsPage />} />
            <Route path="settings" element={<AdminSettingsPage />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

        <CartConflictModal />
        <ToastContainer />
      </BrowserRouter>
    </AppProvider>
  );
}

export default App;

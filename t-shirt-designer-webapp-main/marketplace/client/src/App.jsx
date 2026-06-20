import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useEffect } from "react";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}
import MarketplacePage from "./pages/MarketplacePage";
import ProductDetailPage from "./pages/ProductDetailPage";
import PricesPage from "./pages/PricesPage";
import CartPage from "./pages/CartPage";
import CheckoutPage from "./pages/CheckoutPage";
import OrderSuccessPage from "./pages/OrderSuccessPage";
import AdminLoginPage from "./pages/admin/AdminLoginPage";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminProductsPage from "./pages/admin/AdminProductsPage";
import AdminProductFormPage from "./pages/admin/AdminProductFormPage";
import AdminDesignsPage from "./pages/admin/AdminDesignsPage";
import AdminOrdersPage from "./pages/admin/AdminOrdersPage";
import AdminServicesPage from "./pages/admin/AdminServicesPage";
import AdminSettingsPage from "./pages/admin/AdminSettingsPage";
import AdminSiteConfigPage from "./pages/admin/AdminSiteConfigPage";
import PhotoPrintPage from "./pages/PhotoPrintPage";
import AdminCategoriesPage from "./pages/admin/AdminCategoriesPage";
import AdminSlidesPage from "./pages/admin/AdminSlidesPage";
import AdminBackgroundsPage from "./pages/admin/AdminBackgroundsPage";
import AdminNotificationsPage from "./pages/admin/AdminNotificationsPage";
import AdminGuidePage from "./pages/admin/AdminGuidePage";
import AdminCustomersPage from "./pages/admin/AdminCustomersPage";
import { ContactFloatingButton } from "./components/ContactFloatingButton";

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <ContactFloatingButton />
      <Routes>
        <Route path="/" element={<MarketplacePage />} />
        <Route path="/product/:slug" element={<ProductDetailPage />} />
        <Route path="/prices" element={<PricesPage />} />
        <Route path="/print" element={<PhotoPrintPage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/order/:number" element={<OrderSuccessPage />} />

        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/products" replace />} />
          <Route path="products" element={<AdminProductsPage />} />
          <Route path="products/new" element={<AdminProductFormPage />} />
          <Route path="products/:id" element={<AdminProductFormPage />} />
          <Route path="designs" element={<AdminDesignsPage />} />
          <Route path="orders" element={<AdminOrdersPage />} />
          <Route path="services" element={<AdminServicesPage />} />
          <Route path="categories" element={<AdminCategoriesPage />} />
          <Route path="slides" element={<AdminSlidesPage />} />
          <Route path="backgrounds" element={<AdminBackgroundsPage />} />
          <Route path="notifications" element={<AdminNotificationsPage />} />
          <Route path="guide" element={<AdminGuidePage />} />
          <Route path="customers" element={<AdminCustomersPage />} />
          <Route path="settings" element={<AdminSettingsPage />} />
          <Route path="site" element={<AdminSiteConfigPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

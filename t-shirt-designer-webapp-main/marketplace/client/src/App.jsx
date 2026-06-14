import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
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

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MarketplacePage />} />
        <Route path="/product/:slug" element={<ProductDetailPage />} />
        <Route path="/prices" element={<PricesPage />} />
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
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

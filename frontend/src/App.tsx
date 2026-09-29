import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ProtectedRoute from "@/components/ProtectedRoute";

import Home from "@/pages/Home";
import Teams from "@/pages/Teams";
import TeamDetail from "@/pages/TeamDetail";
import TeamCreate from "@/pages/TeamCreate";
import TeamDashboard from "@/pages/TeamDashboard";
import Players from "@/pages/Players";
import PlayerDetail from "@/pages/PlayerDetail";
import Tournaments from "@/pages/Tournaments";
import TournamentDetail from "@/pages/TournamentDetail";
import TournamentCreate from "@/pages/TournamentCreate";
import Grounds from "@/pages/Grounds";
import GroundDetail from "@/pages/GroundDetail";
import Rankings from "@/pages/Rankings";
import Membership from "@/pages/Membership";
import ShopHome from "@/pages/shop/ShopHome";
import StoreList from "@/pages/shop/StoreList";
import StoreDetail from "@/pages/shop/StoreDetail";
import ProductDetail from "@/pages/shop/ProductDetail";
import Cart from "@/pages/shop/Cart";
import MyOrders from "@/pages/shop/MyOrders";
import MyStore from "@/pages/shop/MyStore";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import Dashboard from "@/pages/Dashboard";
import About from "@/pages/About";
import Contact from "@/pages/Contact";
import Privacy from "@/pages/Privacy";
import Terms from "@/pages/Terms";
import NotFound from "@/pages/NotFound";

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <BrowserRouter>
          <div className="flex min-h-screen flex-col bg-base">
            <Navbar />
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/teams" element={<Teams />} />
              <Route path="/teams/create" element={<TeamCreate />} />
              <Route path="/teams/:id" element={<TeamDetail />} />
              <Route
                path="/team-dashboard"
                element={
                  <ProtectedRoute>
                    <TeamDashboard />
                  </ProtectedRoute>
                }
              />
              <Route path="/players" element={<Players />} />
              <Route path="/players/:id" element={<PlayerDetail />} />
              <Route path="/tournaments" element={<Tournaments />} />
              <Route path="/tournaments/create" element={<TournamentCreate />} />
              <Route path="/tournaments/:id" element={<TournamentDetail />} />
              <Route path="/grounds" element={<Grounds />} />
              <Route path="/grounds/:id" element={<GroundDetail />} />
              <Route path="/rankings" element={<Rankings />} />
              <Route path="/membership" element={<Membership />} />
              <Route path="/shop" element={<ShopHome />} />
              <Route path="/shop/stores" element={<StoreList />} />
              <Route path="/shop/stores/:id" element={<StoreDetail />} />
              <Route path="/shop/products/:id" element={<ProductDetail />} />
              <Route path="/shop/cart" element={<Cart />} />
              <Route
                path="/shop/orders"
                element={
                  <ProtectedRoute>
                    <MyOrders />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/shop/my-store"
                element={
                  <ProtectedRoute>
                    <MyStore />
                  </ProtectedRoute>
                }
              />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password/:token" element={<ResetPassword />} />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route path="/about" element={<About />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            <Footer />
          </div>
        </BrowserRouter>
      </CartProvider>
    </AuthProvider>
  );
}

import { lazy, Suspense, type ReactNode } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { Loading } from "@/components/ui/StateBlock";
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
import Challenges from "@/pages/challenges/Challenges";
import ChallengeCreate from "@/pages/challenges/ChallengeCreate";
import ChallengeDetail from "@/pages/challenges/ChallengeDetail";
import Membership from "@/pages/Membership";
import ShopHome from "@/pages/shop/ShopHome";
import StoreList from "@/pages/shop/StoreList";
import StoreDetail from "@/pages/shop/StoreDetail";
import ProductDetail from "@/pages/shop/ProductDetail";
import Cart from "@/pages/shop/Cart";
import Checkout from "@/pages/shop/Checkout";
import ShopLayout from "@/components/shop/ShopLayout";
import MyOrders from "@/pages/shop/MyOrders";
import MyStore from "@/pages/shop/MyStore";
import Wishlist from "@/pages/shop/Wishlist";
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
import Settings from "@/pages/Settings";
import Notifications from "@/pages/Notifications";
import Matches from "@/pages/Matches";
import MatchDetail from "@/pages/MatchDetail";
import OwnerDashboard from "@/pages/OwnerDashboard";

// The admin console is its own bundle: public visitors never download it.
const AdminLayout = lazy(() => import("@/pages/admin/AdminLayout"));
const AdminHome = lazy(() => import("@/pages/admin/AdminHome"));
const AdminUsers = lazy(() => import("@/pages/admin/AdminUsers"));
const AdminUserDetail = lazy(() => import("@/pages/admin/AdminUsers").then((m) => ({ default: m.AdminUserDetail })));
const AdminStaff = lazy(() => import("@/pages/admin/AdminStaff"));
const AdminRoles = lazy(() => import("@/pages/admin/AdminStaff").then((m) => ({ default: m.AdminRoles })));
const AdminAnnouncements = lazy(() => import("@/pages/admin/AdminContent").then((m) => ({ default: m.AdminAnnouncements })));
const AdminSports = lazy(() => import("@/pages/admin/AdminContent").then((m) => ({ default: m.AdminSports })));
const AdminBlacklist = lazy(() => import("@/pages/admin/AdminContent").then((m) => ({ default: m.AdminBlacklist })));
const AdminDisputes = lazy(() => import("@/pages/admin/AdminContent").then((m) => ({ default: m.AdminDisputes })));
const AdminTournaments = lazy(() => import("@/pages/admin/AdminContent").then((m) => ({ default: m.AdminTournaments })));
const AdminGrounds = lazy(() => import("@/pages/admin/AdminGrounds"));
const AdminMerchants = lazy(() => import("@/pages/admin/AdminShop").then((m) => ({ default: m.AdminMerchants })));
const AdminProducts = lazy(() => import("@/pages/admin/AdminShop").then((m) => ({ default: m.AdminProducts })));
const AdminOrders = lazy(() => import("@/pages/admin/AdminShop").then((m) => ({ default: m.AdminOrders })));
const AdminShopCategories = lazy(() => import("@/pages/admin/AdminShop").then((m) => ({ default: m.AdminShopCategories })));
const AdminReports = lazy(() => import("@/pages/admin/AdminModeration").then((m) => ({ default: m.AdminReports })));
const AdminSettings = lazy(() => import("@/pages/admin/AdminModeration").then((m) => ({ default: m.AdminSettings })));
const AdminTeams = lazy(() => import("@/pages/admin/AdminTeams"));
const AdminAudit = lazy(() => import("@/pages/admin/AdminContent").then((m) => ({ default: m.AdminAudit })));

// Public pages get the site navbar and footer; the admin console has its own shell.
function Chrome({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return <>{children}</>;
  return (
    <div className="flex min-h-screen flex-col bg-base">
      <Navbar />
      {children}
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <BrowserRouter>
          <Chrome>
            <Suspense fallback={<Loading />}>
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
              <Route path="/matches" element={<Matches />} />
              <Route path="/matches/:id" element={<MatchDetail />} />
              <Route path="/challenges" element={<Challenges />} />
              <Route path="/challenges/new" element={<ChallengeCreate />} />
              <Route path="/challenges/:id" element={<ChallengeDetail />} />
              <Route path="/membership" element={<Membership />} />
              <Route element={<ShopLayout />}>
                <Route path="/shop" element={<ShopHome />} />
                <Route path="/shop/stores" element={<StoreList />} />
                <Route path="/shop/stores/:id" element={<StoreDetail />} />
                <Route path="/shop/products/:id" element={<ProductDetail />} />
                <Route path="/shop/cart" element={<Cart />} />
                <Route path="/shop/checkout" element={<Checkout />} />
                <Route
                  path="/shop/orders"
                  element={
                    <ProtectedRoute>
                      <MyOrders />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/shop/wishlist"
                  element={
                    <ProtectedRoute>
                      <Wishlist />
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
              </Route>
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
              <Route
                path="/settings"
                element={
                  <ProtectedRoute>
                    <Settings />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/notifications"
                element={
                  <ProtectedRoute>
                    <Notifications />
                  </ProtectedRoute>
                }
              />
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<AdminHome />} />
                <Route path="users" element={<AdminUsers />} />
                <Route path="users/:id" element={<AdminUserDetail />} />
                <Route path="staff" element={<AdminStaff />} />
                <Route path="roles" element={<AdminRoles />} />
                <Route path="announcements" element={<AdminAnnouncements />} />
                <Route path="sports" element={<AdminSports />} />
                <Route path="blacklist" element={<AdminBlacklist />} />
                <Route path="audit" element={<AdminAudit />} />
                <Route path="results" element={<AdminDisputes />} />
                <Route path="teams" element={<AdminTeams />} />
                <Route path="tournaments" element={<AdminTournaments />} />
                <Route path="grounds" element={<AdminGrounds />} />
                <Route path="merchants" element={<AdminMerchants />} />
                <Route path="reports" element={<AdminReports />} />
                <Route path="settings" element={<AdminSettings />} />
                <Route path="products" element={<AdminProducts />} />
                <Route path="orders" element={<AdminOrders />} />
                <Route path="shop-categories" element={<AdminShopCategories />} />
              </Route>
              <Route
                path="/owner"
                element={
                  <ProtectedRoute>
                    <OwnerDashboard />
                  </ProtectedRoute>
                }
              />
              <Route path="/about" element={<About />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
          </Chrome>
        </BrowserRouter>
      </CartProvider>
    </AuthProvider>
  );
}

import { useEffect, useState, type ComponentType } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  ArrowUpRight,
  ChevronDown,
  Crown,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  Package,
  Bell,
  CalendarDays,
  Settings as SettingsIcon,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  Swords,
  Tag,
  Trophy,
  User,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { assetUrl } from "@/api/axios";
import NotificationBell from "@/components/NotificationBell";

type IconType = ComponentType<{ className?: string }>;
type NavItem = { to: string; label: string; icon: IconType; end?: boolean };

const NAV_LINKS: NavItem[] = [
  { to: "/teams", label: "Teams", icon: Users },
  { to: "/players", label: "Players", icon: UserRound },
  { to: "/matches", label: "Matches", icon: CalendarDays },
  { to: "/challenges", label: "Challenges", icon: Swords },
  { to: "/tournaments", label: "Tournaments", icon: Trophy },
  { to: "/grounds", label: "Grounds", icon: MapPin },
];

// On /shop routes the navbar becomes the shop's own navigation, in gold.
const SHOP_LINKS: NavItem[] = [
  { to: "/shop", label: "Discover", icon: Sparkles, end: true },
  { to: "/shop/stores", label: "Stores", icon: Store },
  { to: "/shop/my-store", label: "Sell", icon: Tag },
];

function CartButton({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Open cart, ${count} ${count === 1 ? "item" : "items"}`}
      className="shine group relative inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-gradient-to-b from-[rgb(255_196_92)] to-premium pl-3.5 pr-1.5 text-sm font-semibold text-[rgb(38_24_4)] shadow-[0_0_22px_-6px_rgb(var(--c-premium)/0.8),inset_0_1px_0_rgb(255_255_255/0.45)] transition-[filter,box-shadow] hover:brightness-105 hover:shadow-[0_0_28px_-4px_rgb(var(--c-premium)/0.95),inset_0_1px_0_rgb(255_255_255/0.45)] active:brightness-95"
    >
      <ShoppingBag className="h-4 w-4" />
      <span className="hidden sm:inline">Cart</span>
      <span
        key={count}
        className="num flex h-7 min-w-7 animate-[cart-bump_300ms_ease-out] items-center justify-center rounded-full bg-base px-2 text-xs font-bold text-premium"
      >
        {count}
      </span>
    </button>
  );
}

function Wordmark({ isShop }: { isShop: boolean }) {
  return (
    <span className="flex flex-col leading-none">
      <span className="flex items-center gap-2">
        <span className="font-display text-lg font-bold tracking-[0.08em] text-ink">
          THE <span className={isShop ? "text-premium" : "text-gradient-accent"}>ARENA</span>
        </span>
        {isShop && (
          <span className="rounded-md border border-premium/40 bg-premium-soft px-1.5 py-0.5 font-display text-[10px] font-bold tracking-[0.2em] text-premium">
            SHOP
          </span>
        )}
      </span>
      <span className="mt-1.5 hidden font-display text-[10px] font-semibold uppercase tracking-[0.32em] text-ink-faint sm:block">
        {isShop ? "Gear for every game" : "Play Â· Compete Â· Rise"}
      </span>
    </span>
  );
}

export default function Navbar() {
  const { user, logout, logoutAll } = useAuth();
  const { itemCount, openDrawer } = useCart();
  const { pathname } = useLocation();
  const isShop = pathname === "/shop" || pathname.startsWith("/shop/");
  const links = isShop ? SHOP_LINKS : NAV_LINKS;
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
    setMenuOpen(false);
  }, [pathname]);

  function handleLogout() {
    logout();
    setMenuOpen(false);
    navigate("/");
  }

  async function handleLogoutAll() {
    if (!window.confirm("Sign out of The Arena on every device, including this one?")) return;
    setMenuOpen(false);
    await logoutAll().catch(() => undefined);
    navigate("/login");
  }

  // Tone: blue for the Arena, gold for the Shop.
  const tone = isShop
    ? {
        pill: "bg-gradient-to-b from-premium/25 to-premium/10 ring-1 ring-inset ring-premium/40 shadow-[0_0_18px_-6px_rgb(var(--c-premium)/0.7)]",
        dot: "bg-premium shadow-[0_0_8px_rgb(var(--c-premium))]",
        active: "text-premium",
        line: "via-premium/60",
        glow: "bg-premium/40",
      }
    : {
        pill: "bg-gradient-to-b from-accent/30 to-accent/10 ring-1 ring-inset ring-accent/45 shadow-[0_0_18px_-6px_rgb(var(--c-accent)/0.8)]",
        dot: "bg-accent shadow-[0_0_8px_rgb(var(--c-accent))]",
        active: "text-[rgb(var(--c-accent-light))]",
        line: "via-accent/60",
        glow: "bg-accent/40",
      };

  const pillTransition = reduceMotion ? { duration: 0 } : { type: "spring" as const, stiffness: 420, damping: 34 };

  return (
    <header
      className={`sticky top-0 z-50 transition-[background-color,box-shadow,border-color] duration-300 ${
        scrolled
          ? "border-b border-border/80 bg-base/85 shadow-[0_10px_30px_-12px_rgb(0_0_0/0.7)] backdrop-blur-xl"
          : "border-b border-transparent bg-gradient-to-b from-base/90 to-base/40 backdrop-blur-md"
      }`}
    >
      {/* Top hairline in the section's tone */}
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent ${tone.line} to-transparent`} />
      {/* Soft bottom glow once scrolled */}
      <div
        className={`pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent ${tone.line} to-transparent transition-opacity duration-300 ${
          scrolled ? "opacity-60" : "opacity-0"
        }`}
      />

      <div className="mx-auto flex h-19 w-full max-w-370 items-center justify-between gap-6 px-6 md:px-10 2xl:gap-10">
        <Link to={isShop ? "/shop" : "/"} className="group flex shrink-0 items-center gap-4" onClick={() => setOpen(false)}>
          <span className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-surface/80 shadow-[inset_0_1px_0_rgb(255_255_255/0.06)]">
            <span className={`absolute inset-0 rounded-xl ${tone.glow} opacity-0 blur-lg transition-opacity duration-300 group-hover:opacity-100`} />
            <img
              src="/logo.png"
              alt="The Arena"
              className="relative h-7 w-7 object-contain transition-transform duration-300 group-hover:scale-110"
            />
          </span>
          <Wordmark isShop={isShop} />
        </Link>

        {/* Desktop rail with a sliding active pill */}
        <nav
          aria-label={isShop ? "Shop" : "Main"}
          className="hidden items-center gap-1 rounded-full border border-border/80 bg-surface/60 p-1 shadow-[inset_0_1px_0_rgb(255_255_255/0.04)] backdrop-blur-xl xl:flex"
        >
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `group relative flex items-center gap-2 rounded-full px-3.5 py-2 text-sm 2xl:px-4 font-medium transition-colors duration-200 ${
                  isActive ? tone.active : "text-ink-muted hover:text-ink"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive ? (
                    <motion.span
                      layoutId={isShop ? "nav-pill-shop" : "nav-pill"}
                      transition={pillTransition}
                      className={`absolute inset-0 rounded-full ${tone.pill}`}
                    />
                  ) : (
                    <span className="absolute inset-0 rounded-full bg-surface-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                  )}
                  <link.icon
                    className={`relative hidden h-4 w-4 transition-transform 2xl:block duration-200 ${
                      isActive ? "" : "opacity-70 group-hover:-translate-y-px group-hover:opacity-100"
                    }`}
                  />
                  <span className="relative">{link.label}</span>
                  {isActive && (
                    <motion.span
                      layoutId={isShop ? "nav-dot-shop" : "nav-dot"}
                      transition={pillTransition}
                      className={`absolute -bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full ${tone.dot}`}
                    />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="hidden shrink-0 items-center gap-3 xl:flex">
          {isShop ? (
            <>
              <Link
                to="/"
                className="flex h-10 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium text-ink-muted transition-colors hover:bg-surface hover:text-ink"
              >
                <ArrowLeft className="h-4 w-4" />
                Arena
              </Link>
              <CartButton count={itemCount} onClick={openDrawer} />
            </>
          ) : (
            <a
              href="/shop"
              target="_blank"
              rel="noopener noreferrer"
              className="group relative flex h-10 items-center gap-1.5 overflow-hidden rounded-full border border-premium/35 bg-premium-soft/60 px-4 text-sm font-semibold text-premium transition-[border-color,box-shadow] duration-300 hover:border-premium/70 hover:shadow-[0_0_20px_-6px_rgb(var(--c-premium)/0.8)]"
            >
              <ShoppingBag className="h-4 w-4" />
              Shop
              <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </a>
          )}

          {user && <NotificationBell />}
          {user ? (
            <div className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                aria-expanded={menuOpen}
                className="flex items-center gap-2 rounded-full border border-border bg-surface/80 py-1 pl-1 pr-3 transition-colors hover:border-accent/40 hover:bg-surface-2"
              >
                <span className={`rounded-full p-[2px] ${user.isPremium ? "bg-gradient-to-br from-premium to-[rgb(255_220_140)]" : "bg-gradient-to-br from-accent to-[rgb(var(--c-accent-light))]"}`}>
                  {user.photo ? (
                    <img src={assetUrl(user.photo)} alt={user.name} className="h-7 w-7 rounded-full border-2 border-base object-cover" />
                  ) : (
                    <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-base bg-surface-2 text-ink">
                      <User className="h-3.5 w-3.5" />
                    </span>
                  )}
                </span>
                <span className="text-sm font-medium text-ink">{user.name.split(" ")[0]}</span>
                {user.isPremium && <Crown className="h-3.5 w-3.5 text-premium drop-shadow-[0_0_6px_rgb(var(--c-premium)/0.7)]" />}
                <ChevronDown
                  className={`h-3.5 w-3.5 text-ink-faint transition-transform duration-300 ${menuOpen ? "rotate-180" : ""}`}
                />
              </button>

              <AnimatePresence>
                {menuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.98 }}
                    transition={{ duration: 0.15 }}
                    className="glass absolute right-0 mt-2 w-56 origin-top-right overflow-hidden rounded-2xl p-1.5 shadow-2xl shadow-black/50"
                  >
                    <div className="px-3 pb-2 pt-1.5">
                      <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
                      <p className="text-xs text-ink-faint">{user.isPremium ? "Premium member" : "Member"}</p>
                    </div>
                    <div className="my-1 h-px bg-border" />
                    {[
                      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
                      { to: "/team-dashboard", label: "Team Dashboard", icon: Users },
                      { to: "/matches?tab=mine", label: "My matches", icon: CalendarDays },
                      { to: "/shop/orders", label: "My orders", icon: Package },
                      { to: "/owner", label: "My grounds", icon: MapPin },
                      { to: "/notifications", label: "Notifications", icon: Bell },
                      { to: "/settings", label: "Settings", icon: SettingsIcon },
                      ...(user.role === "admin" ? [{ to: "/admin", label: "Admin console", icon: ShieldCheck }] : []),
                    ].map((item) => (
                      <Link
                        key={item.to}
                        to={item.to}
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
                      >
                        <item.icon className="h-4 w-4 opacity-70" />
                        {item.label}
                      </Link>
                    ))}
                    <div className="my-1 h-px bg-border" />
                    <button
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-danger transition-colors hover:bg-danger/10"
                    >
                      <LogOut className="h-4 w-4" /> Logout
                    </button>
                    <button
                      onClick={handleLogoutAll}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs text-ink-muted transition-colors hover:bg-danger/10 hover:text-danger"
                    >
                      <LogOut className="h-3.5 w-3.5 opacity-70" /> Log out of all devices
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <>
              <span className="mx-1 h-6 w-px bg-gradient-to-b from-transparent via-border to-transparent" />
              <Link
                to="/login"
                className="rounded-full px-4 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-surface hover:text-ink"
              >
                Login
              </Link>
              <Link
                to="/register"
                className="shine group relative inline-flex items-center gap-1.5 rounded-full bg-gradient-to-b from-[rgb(96_156_255)] to-accent px-5 py-2.5 text-sm font-semibold text-white shadow-[0_0_22px_-6px_rgb(var(--c-accent)/0.8),inset_0_1px_0_rgb(255_255_255/0.25)] transition-[filter,box-shadow] hover:brightness-110 hover:shadow-[0_0_28px_-4px_rgb(var(--c-accent)/0.95),inset_0_1px_0_rgb(255_255_255/0.25)]"
              >
                Register
                <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </Link>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 xl:hidden">
          {user && <NotificationBell />}
          {isShop && <CartButton count={itemCount} onClick={openDrawer} />}
          <button
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-surface/70 text-ink transition-colors hover:border-accent/40 hover:bg-surface-2"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
            aria-expanded={open}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-border bg-base/95 backdrop-blur-xl xl:hidden"
          >
            <div className="container-x flex flex-col gap-1 py-4">
              {links.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.end}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors ${
                      isActive ? `${tone.pill} ${tone.active}` : "text-ink-muted hover:bg-surface hover:text-ink"
                    }`
                  }
                >
                  <link.icon className="h-4 w-4" />
                  {link.label}
                </NavLink>
              ))}
              {isShop && user && (
                <NavLink
                  to="/shop/orders"
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors ${
                      isActive ? `${tone.pill} ${tone.active}` : "text-ink-muted hover:bg-surface hover:text-ink"
                    }`
                  }
                >
                  <Package className="h-4 w-4" />
                  My orders
                </NavLink>
              )}
              {isShop ? (
                <Link
                  to="/"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-ink-muted hover:bg-surface hover:text-ink"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Arena
                </Link>
              ) : (
                <a
                  href="/shop"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 flex items-center gap-3 rounded-xl border border-premium/35 bg-premium-soft/60 px-3 py-3 text-sm font-semibold text-premium"
                >
                  <ShoppingBag className="h-4 w-4" />
                  Shop
                  <ArrowUpRight className="ml-auto h-4 w-4" />
                </a>
              )}
              <div className="mt-2 flex flex-col gap-2 border-t border-border pt-3">
                {user ? (
                  <>
                    <Link
                      to="/dashboard"
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-ink hover:bg-surface"
                    >
                      <LayoutDashboard className="h-4 w-4" />
                      Dashboard
                      {user.isPremium && <Crown className="h-3.5 w-3.5 text-premium" />}
                    </Link>
                    <Link
                      to="/settings"
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-ink hover:bg-surface"
                    >
                      <SettingsIcon className="h-4 w-4" />
                      Settings
                    </Link>
                    {user.role === "admin" && (
                      <Link
                        to="/admin"
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-ink hover:bg-surface"
                      >
                        <ShieldCheck className="h-4 w-4" />
                        Admin console
                      </Link>
                    )}
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-danger hover:bg-danger/10"
                    >
                      <LogOut className="h-4 w-4" />
                      Logout
                    </button>
                    <button
                      onClick={handleLogoutAll}
                      className="flex items-center gap-3 rounded-xl px-3 py-2 text-left text-xs text-ink-muted hover:bg-danger/10 hover:text-danger"
                    >
                      <LogOut className="h-3.5 w-3.5 opacity-70" />
                      Log out of all devices
                    </button>
                  </>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <Link
                      to="/login"
                      onClick={() => setOpen(false)}
                      className="rounded-full border border-border px-3 py-2.5 text-center text-sm font-medium text-ink hover:bg-surface"
                    >
                      Login
                    </Link>
                    <Link
                      to="/register"
                      onClick={() => setOpen(false)}
                      className="rounded-full bg-gradient-to-b from-[rgb(96_156_255)] to-accent px-3 py-2.5 text-center text-sm font-semibold text-white shadow-[0_0_18px_-6px_rgb(var(--c-accent)/0.8)]"
                    >
                      Register
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

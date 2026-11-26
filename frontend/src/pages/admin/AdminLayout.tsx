import { NavLink, Navigate, Outlet, Link } from "react-router-dom";
import {
  ArrowLeft,
  Ban,
  ClipboardList,
  Flag,
  Settings,
  Gauge,
  KeyRound,
  MapPin,
  Megaphone,
  Package,
  ShoppingBag,
  Store,
  Tags,
  Scale,
  Shield,
  ShieldCheck,
  Trophy,
  Users,
  Volleyball,
  type LucideIcon,
} from "lucide-react";
import { can, useAuth } from "@/context/AuthContext";
import { Loading } from "@/components/ui/StateBlock";

export interface AdminNavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Permission needed to see the item, or "super" for Super Admin only. */
  needs?: string | "super";
}

// Later phases add their queues here (tournaments, grounds, merchants, ...).
export const ADMIN_NAV: AdminNavItem[] = [
  { to: "/admin", label: "Overview", icon: Gauge },
  { to: "/admin/users", label: "Users", icon: Users, needs: "users.read" },
  { to: "/admin/teams", label: "Teams", icon: Shield, needs: "teams.moderate" },
  { to: "/admin/tournaments", label: "Tournaments", icon: Trophy, needs: "tournaments.review" },
  { to: "/admin/grounds", label: "Grounds", icon: MapPin, needs: "grounds.review" },
  { to: "/admin/results", label: "Match results", icon: Scale, needs: "reports.verify" },
  { to: "/admin/merchants", label: "Merchants", icon: Store, needs: "merchants.review" },
  { to: "/admin/products", label: "Products", icon: Package, needs: "products.review" },
  { to: "/admin/orders", label: "Shop orders", icon: ShoppingBag, needs: "orders.manage" },
  { to: "/admin/shop-categories", label: "Shop categories", icon: Tags, needs: "categories.manage" },
  { to: "/admin/reports", label: "Reports", icon: Flag, needs: "moderation.reports" },
  { to: "/admin/staff", label: "Staff", icon: ShieldCheck, needs: "super" },
  { to: "/admin/roles", label: "Roles & permissions", icon: KeyRound, needs: "super" },
  { to: "/admin/announcements", label: "Announcements", icon: Megaphone, needs: "announcements.manage" },
  { to: "/admin/sports", label: "Sports", icon: Volleyball, needs: "categories.manage" },
  { to: "/admin/blacklist", label: "Blacklist", icon: Ban, needs: "users.blacklist" },
  { to: "/admin/audit", label: "Audit log", icon: ClipboardList, needs: "audit.read" },
  { to: "/admin/settings", label: "Settings", icon: Settings, needs: "super" },
];

export function canSee(user: ReturnType<typeof useAuth>["user"], needs?: string) {
  if (!needs) return true;
  if (needs === "super") return !!user?.isSuperAdmin;
  return can(user, needs);
}

export default function AdminLayout() {
  const { user, loading } = useAuth();
  if (loading) return <Loading label="Checking your access…" />;
  if (!user) return <Navigate to="/login" replace state={{ from: "/admin" }} />;
  if (user.role !== "admin") return <Navigate to="/" replace />;

  const items = ADMIN_NAV.filter((i) => canSee(user, i.needs));

  return (
    <div className="flex min-h-screen flex-col bg-base md:flex-row">
      <aside className="border-b border-border bg-base-2 md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0 md:border-b-0 md:border-r">
        <div className="flex items-center gap-2.5 px-5 py-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink text-base">
            <Trophy className="h-4 w-4" />
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-bold text-ink">The Arena</span>
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-ink-faint">Admin console</span>
          </span>
        </div>
        <nav aria-label="Admin" className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:overflow-visible">
          {items.map((i) => (
            <NavLink
              key={i.to}
              to={i.to}
              end={i.to === "/admin"}
              className={({ isActive }) =>
                `flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive ? "bg-ink text-base" : "text-ink-muted hover:bg-surface hover:text-ink"
                }`
              }
            >
              <i.icon className="h-4 w-4" />
              {i.label}
            </NavLink>
          ))}
        </nav>
        <div className="hidden border-t border-border px-5 py-4 md:block">
          <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
          <p className="text-xs text-ink-faint">{user.isSuperAdmin ? "Super Admin" : "Staff"}</p>
          <Link to="/" className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to the site
          </Link>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-5 py-6 md:px-8 md:py-8">
        <Outlet />
      </main>
    </div>
  );
}

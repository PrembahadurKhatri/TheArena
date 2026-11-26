import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useApi } from "@/hooks/useApi";
import { AdminHeader, Pill } from "./adminUi";
import { ADMIN_NAV, canSee } from "./AdminLayout";
import { can } from "@/context/AuthContext";
import { OverviewPanel } from "./AdminModeration";

interface MyPermissions {
  isSuperAdmin: boolean;
  permissions: string[];
  catalogue: { key: string; label: string }[];
}

export default function AdminHome() {
  const { user } = useAuth();
  const { data } = useApi<MyPermissions>("/admin/me/permissions");
  const tiles = ADMIN_NAV.filter((i) => i.to !== "/admin" && canSee(user, i.needs));

  return (
    <div className="max-w-6xl">
      <AdminHeader
        title={`Hello, ${user?.name.split(" ")[0] ?? ""}`}
        lead={data?.isSuperAdmin ? "You are a Super Admin: you hold every permission." : "Here is what your role lets you do."}
      />

      {can(user, "analytics.read") && <OverviewPanel />}

      <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((t) => (
          <Link key={t.to} to={t.to} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 transition-colors hover:border-ink-faint/50">
            <t.icon className="h-5 w-5 text-ink-muted" />
            <span className="font-semibold text-ink">{t.label}</span>
          </Link>
        ))}
        {tiles.length === 0 && (
          <p className="rounded-xl border border-dashed border-border p-6 text-sm text-ink-muted sm:col-span-2 lg:col-span-3">
            Your staff account has no permissions yet. Ask a Super Admin to assign you a role.
          </p>
        )}
      </section>

      {data && (
        <section className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-faint">Your permissions</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {data.catalogue.map((p) => (
              <li key={p.key} title={p.label}>
                <Pill tone={data.permissions.includes(p.key) ? "good" : "neutral"}>
                  {data.permissions.includes(p.key) ? "✓ " : ""}
                  {p.key}
                </Pill>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

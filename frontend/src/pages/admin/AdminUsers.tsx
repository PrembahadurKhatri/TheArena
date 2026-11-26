import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import api from "@/api/axios";
import { can, useAuth } from "@/context/AuthContext";
import { apiError } from "@/types";
import { useApi } from "@/hooks/useApi";
import Button from "@/components/ui/Button";
import { Loading, ErrorState } from "@/components/ui/StateBlock";
import { AdminHeader, Banner, Pager, Pill, Table, smallInput, statusTone } from "./adminUi";

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  province?: string;
  role: "player" | "admin";
  isSuperAdmin: boolean;
  status: "active" | "suspended" | "banned";
  statusReason: string | null;
  isPremium: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

type Action = "suspended" | "banned" | "active";

/** Suspend / ban / reactivate with a required reason. */
function StatusAction({ user, onDone }: { user: AdminUser; onDone: () => void }) {
  const { user: me } = useAuth();
  const [action, setAction] = useState<Action | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const canBan = can(me, "users.blacklist");
  const isStaff = user.role === "admin";
  if (user.id === me?.id || (isStaff && !me?.isSuperAdmin)) return <span className="text-xs text-ink-faint">—</span>;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!action) return;
    setBusy(true);
    setError("");
    try {
      await api.patch(`/admin/users/${user.id}/status`, { status: action, reason: reason || undefined });
      setAction(null);
      setReason("");
      onDone();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  if (action) {
    return (
      <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
        {action !== "active" && (
          <input className={`${smallInput} w-48`} placeholder="Reason (required)" value={reason} onChange={(e) => setReason(e.target.value)} required maxLength={500} autoFocus />
        )}
        <Button size="sm" variant={action === "active" ? "primary" : "danger"} loading={busy} type="submit">
          {action === "active" ? "Reactivate" : action === "banned" ? "Ban permanently" : "Suspend"}
        </Button>
        <Button size="sm" variant="ghost" type="button" onClick={() => setAction(null)}>
          Cancel
        </Button>
        {error && <span className="w-full text-xs text-danger">{error}</span>}
      </form>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {user.status === "active" ? (
        <>
          <Button size="sm" variant="secondary" onClick={() => setAction("suspended")}>
            Suspend
          </Button>
          {canBan && (
            <Button size="sm" variant="danger" onClick={() => setAction("banned")}>
              Ban
            </Button>
          )}
        </>
      ) : (
        (user.status !== "banned" || canBan) && (
          <Button size="sm" variant="secondary" onClick={() => setAction("active")}>
            Reactivate
          </Button>
        )
      )}
    </div>
  );
}

export default function AdminUsers() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState({ search: "", status: "", role: "", page: 1 });
  const { data, loading, error, reload } = useApi<{ users: AdminUser[]; total: number; pages: number }>("/admin/users", query);
  const { user: me } = useAuth();

  return (
    <div>
      <AdminHeader title="Users" lead={data ? `${data.total} accounts` : undefined} />
      <form
        className="mt-5 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery((q) => ({ ...q, search, page: 1 }));
        }}
      >
        <input className={`${smallInput} w-64`} placeholder="Name, email or phone" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className={smallInput} value={query.status} onChange={(e) => setQuery((q) => ({ ...q, status: e.target.value, page: 1 }))} aria-label="Status">
          <option value="">Any status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="banned">Banned</option>
        </select>
        <select className={smallInput} value={query.role} onChange={(e) => setQuery((q) => ({ ...q, role: e.target.value, page: 1 }))} aria-label="Role">
          <option value="">Any role</option>
          <option value="player">Players</option>
          <option value="admin">Staff</option>
        </select>
        <Button size="sm" type="submit">
          Search
        </Button>
      </form>

      {loading && <Loading />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && !loading && (
        <>
          <Table head={["User", "Role", "Status", "Joined", "Actions"]} empty={data.users.length === 0}>
            {data.users.map((u) => (
              <tr key={u.id} className="align-top">
                <td className="px-4 py-3">
                  <Link to={`/admin/users/${u.id}`} className="font-semibold text-ink hover:underline">
                    {u.name}
                  </Link>
                  <span className="block text-xs text-ink-faint">{u.email}</span>
                </td>
                <td className="px-4 py-3">
                  {u.role === "admin" ? <Pill tone="accent">{u.isSuperAdmin ? "Super Admin" : "Staff"}</Pill> : <Pill>Player</Pill>}
                  {u.isPremium && <span className="ml-1"><Pill tone="warn">Premium</Pill></span>}
                </td>
                <td className="px-4 py-3">
                  <Pill tone={statusTone(u.status)}>{u.status}</Pill>
                  {u.statusReason && <span className="mt-1 block max-w-[14rem] text-xs text-ink-faint">{u.statusReason}</span>}
                </td>
                <td className="num px-4 py-3 text-ink-muted">{new Date(u.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-3">{can(me, "users.suspend") && <StatusAction user={u} onDone={reload} />}</td>
              </tr>
            ))}
          </Table>
          <Pager page={query.page} pages={data.pages} onPage={(page) => setQuery((q) => ({ ...q, page }))} />
        </>
      )}
    </div>
  );
}

interface UserDetail extends AdminUser {
  username: string | null;
  district: string | null;
  municipality: string | null;
  staffRole: { id: string; name: string } | null;
  teams: { id: string; name: string; sport: string; isOwner: boolean }[];
  store: { id: string; name: string } | null;
  history: { id: string; action: string; reason: string | null; createdAt: string }[];
}

function EditUser({ user, onDone }: { user: { id: string; name: string; phone?: string }; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: user.name, phone: user.phone ?? "" });
  const [error, setError] = useState("");
  if (!open) {
    return (
      <button className="mt-4 text-sm font-semibold text-accent hover:underline" onClick={() => setOpen(true)}>
        Edit details
      </button>
    );
  }
  return (
    <form
      className="mt-4 flex flex-wrap items-end gap-2 rounded-xl border border-border bg-surface p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setError("");
        try {
          await api.patch(`/admin/users/${user.id}`, form);
          setOpen(false);
          onDone();
        } catch (err) {
          setError(apiError(err));
        }
      }}
    >
      <input className={`${smallInput} w-56`} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} aria-label="Name" required />
      <input className={`${smallInput} w-40`} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} aria-label="Phone" placeholder="Phone" />
      <Button size="sm" type="submit">
        Save
      </Button>
      <Button
        size="sm"
        type="button"
        variant="ghost"
        onClick={async () => {
          await api.patch(`/admin/users/${user.id}`, { removePhoto: true }).catch(() => undefined);
          onDone();
        }}
      >
        Remove photo
      </Button>
      <Button size="sm" type="button" variant="ghost" onClick={() => setOpen(false)}>
        Cancel
      </Button>
      {error && <span className="w-full text-xs text-danger">{error}</span>}
    </form>
  );
}

export function AdminUserDetail() {
  const { id } = useParams();
  const { data, loading, error, reload } = useApi<{ user: UserDetail }>(`/admin/users/${id}`);
  const { user: me } = useAuth();
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  if (loading) return <Loading />;
  if (error || !data) return <ErrorState message={error || "Not found"} />;
  const u = data.user;

  async function setRole(role: "player" | "admin") {
    setMsg(null);
    try {
      await api.patch(`/admin/users/${u.id}/role`, { role });
      setMsg({ kind: "ok", text: role === "admin" ? "Now staff. Assign a role on the Staff page." : "Staff access removed." });
      reload();
    } catch (err) {
      setMsg({ kind: "error", text: apiError(err) });
    }
  }

  return (
    <div className="max-w-4xl">
      <AdminHeader
        title={u.name}
        lead={
          <>
            {u.email} {u.username && <>· @{u.username}</>}
          </>
        }
        actions={
          <>
            <Pill tone={statusTone(u.status)}>{u.status}</Pill>
            {u.role === "admin" && <Pill tone="accent">{u.isSuperAdmin ? "Super Admin" : u.staffRole?.name ?? "Staff (no role)"}</Pill>}
          </>
        }
      />
      {msg && <Banner kind={msg.kind}>{msg.text}</Banner>}

      <dl className="mt-6 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
        {[
          ["Phone", u.phone ?? "—"],
          ["Location", [u.municipality, u.district, u.province].filter(Boolean).join(", ") || "—"],
          ["Premium", u.isPremium ? "Yes" : "No"],
          ["Last login", u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "—"],
          ["Joined", new Date(u.createdAt).toLocaleDateString()],
          ["Shop", u.store?.name ?? "—"],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 border-b border-border pb-2">
            <dt className="text-ink-faint">{k}</dt>
            <dd className="text-right text-ink">{v}</dd>
          </div>
        ))}
      </dl>

      {can(me, "users.edit") && (u.role !== "admin" || me?.isSuperAdmin) && <EditUser user={u} onDone={reload} />}

      <div className="mt-6 flex flex-wrap gap-2">
        {can(me, "users.suspend") && <StatusAction user={u} onDone={reload} />}
        {me?.isSuperAdmin && me.id !== u.id && (
          u.role === "admin" ? (
            <Button size="sm" variant="secondary" onClick={() => setRole("player")}>
              Remove staff access
            </Button>
          ) : (
            <Button size="sm" variant="secondary" onClick={() => setRole("admin")}>
              Make staff
            </Button>
          )
        )}
      </div>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-faint">Teams</h2>
        {u.teams.length ? (
          <ul className="mt-3 flex flex-wrap gap-2">
            {u.teams.map((t) => (
              <li key={t.id}>
                <Link to={`/teams/${t.id}`} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-surface">
                  {t.name} <span className="text-xs text-ink-faint">{t.sport}{t.isOwner ? " · owner" : ""}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-ink-faint">No teams.</p>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-faint">Recent activity</h2>
        <Table head={["When", "Action", "Reason"]} empty={u.history.length === 0}>
          {u.history.map((h) => (
            <tr key={h.id}>
              <td className="num px-4 py-2.5 text-ink-muted">{new Date(h.createdAt).toLocaleString()}</td>
              <td className="px-4 py-2.5 font-mono text-xs text-ink">{h.action}</td>
              <td className="px-4 py-2.5 text-ink-muted">{h.reason ?? ""}</td>
            </tr>
          ))}
        </Table>
      </section>
    </div>
  );
}

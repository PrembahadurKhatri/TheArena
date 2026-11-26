import { Fragment, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import api from "@/api/axios";
import { useAuth } from "@/context/AuthContext";
import { apiError } from "@/types";
import { useApi } from "@/hooks/useApi";
import Button from "@/components/ui/Button";
import { Loading, ErrorState } from "@/components/ui/StateBlock";
import { AdminHeader, Banner, Pill, Table, smallInput } from "./adminUi";
import type { AdminUser } from "./AdminUsers";

export interface StaffRole {
  id: string;
  key: string;
  name: string;
  description: string | null;
  permissions: string[];
  isSystem: boolean;
  memberCount?: number;
}

interface StaffMember extends AdminUser {
  staffRole: { id: string; key: string; name: string } | null;
  permissionOverrides: { grant: string[]; revoke: string[] };
  effectivePermissions: string[];
}

interface Catalogue {
  catalogue: { key: string; label: string }[];
}

// Reserved for Super Admins; the server refuses to assign them.
export const RESERVED = ["staff.manage", "settings.manage"];

export function PermissionPicker({
  catalogue,
  value,
  onChange,
  disabled = [],
}: {
  catalogue: { key: string; label: string }[];
  value: string[];
  onChange: (v: string[]) => void;
  disabled?: string[];
}) {
  const groups = new Map<string, { key: string; label: string }[]>();
  for (const p of catalogue) {
    if (RESERVED.includes(p.key)) continue;
    const g = p.key.split(".")[0];
    groups.set(g, [...(groups.get(g) ?? []), p]);
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[...groups.entries()].map(([group, perms]) => (
        <fieldset key={group} className="rounded-lg border border-border p-3">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-ink-faint">{group}</legend>
          {perms.map((p) => (
            <label key={p.key} className="flex items-start gap-2 py-1 text-sm" title={p.key}>
              <input
                type="checkbox"
                className="mt-0.5"
                checked={value.includes(p.key)}
                disabled={disabled.includes(p.key)}
                onChange={(e) => onChange(e.target.checked ? [...value, p.key] : value.filter((x) => x !== p.key))}
              />
              <span>
                <span className="text-ink">{p.label}</span>
                <span className="block font-mono text-[11px] text-ink-faint">{p.key}</span>
              </span>
            </label>
          ))}
        </fieldset>
      ))}
    </div>
  );
}

function AddStaff({ roles, onDone }: { roles: StaffRole[]; onDone: () => void }) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<AdminUser[]>([]);
  const [roleId, setRoleId] = useState("");
  const [error, setError] = useState("");

  async function find(e: FormEvent) {
    e.preventDefault();
    setError("");
    const { data } = await api.get("/admin/users", { params: { search, role: "player", status: "active", limit: 8 } });
    setResults(data.users);
  }

  async function add(u: AdminUser) {
    setError("");
    try {
      await api.post("/admin/staff", { userId: u.id, staffRoleId: roleId || undefined });
      setResults([]);
      setSearch("");
      onDone();
    } catch (err) {
      setError(apiError(err));
    }
  }

  return (
    <section className="mt-6 rounded-xl border border-border bg-surface p-4">
      <h2 className="text-sm font-semibold text-ink">Add a staff member</h2>
      <form onSubmit={find} className="mt-3 flex flex-wrap gap-2">
        <input className={`${smallInput} w-64`} placeholder="Find a player by name or email" value={search} onChange={(e) => setSearch(e.target.value)} required />
        <select className={smallInput} value={roleId} onChange={(e) => setRoleId(e.target.value)} aria-label="Role">
          <option value="">No role (no permissions)</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <Button size="sm" type="submit" variant="secondary">
          Find
        </Button>
      </form>
      {results.length > 0 && (
        <ul className="mt-3 divide-y divide-border rounded-lg border border-border">
          {results.map((u) => (
            <li key={u.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span>
                <span className="font-medium text-ink">{u.name}</span> <span className="text-ink-faint">{u.email}</span>
              </span>
              <Button size="sm" onClick={() => add(u)}>
                Make staff
              </Button>
            </li>
          ))}
        </ul>
      )}
      {error && <Banner kind="error">{error}</Banner>}
    </section>
  );
}

function EditStaff({ member, roles, catalogue, onDone }: { member: StaffMember; roles: StaffRole[]; catalogue: Catalogue["catalogue"]; onDone: () => void }) {
  const [roleId, setRoleId] = useState(member.staffRole?.id ?? "");
  const [grant, setGrant] = useState(member.permissionOverrides.grant);
  const [revoke, setRevoke] = useState(member.permissionOverrides.revoke);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const rolePerms = roles.find((r) => r.id === roleId)?.permissions ?? [];

  async function call(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      setMsg({ kind: "ok", text: ok });
      onDone();
    } catch (err) {
      setMsg({ kind: "error", text: apiError(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5 bg-base-2 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm text-ink-muted" htmlFor={`role-${member.id}`}>
          Role
        </label>
        <select id={`role-${member.id}`} className={smallInput} value={roleId} onChange={(e) => setRoleId(e.target.value)}>
          <option value="">No role</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <p className="mb-2 text-sm font-semibold text-ink">Extra permissions (on top of the role)</p>
        <PermissionPicker catalogue={catalogue} value={grant} onChange={setGrant} disabled={rolePerms} />
      </div>
      <div>
        <p className="mb-2 text-sm font-semibold text-ink">Taken away (even if the role has them)</p>
        <PermissionPicker catalogue={catalogue.filter((p) => rolePerms.includes(p.key) || revoke.includes(p.key))} value={revoke} onChange={setRevoke} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          loading={busy}
          onClick={() => call(() => api.patch(`/admin/staff/${member.id}`, { staffRoleId: roleId || null, grant, revoke }), "Access updated.")}
        >
          Save access
        </Button>
        <Button
          size="sm"
          variant="secondary"
          loading={busy}
          onClick={() =>
            call(
              () => api.patch(`/admin/staff/${member.id}/super-admin`, { value: !member.isSuperAdmin }),
              member.isSuperAdmin ? "Super Admin removed." : "Now a Super Admin."
            )
          }
        >
          {member.isSuperAdmin ? "Remove Super Admin" : "Make Super Admin"}
        </Button>
        <Button size="sm" variant="danger" loading={busy} onClick={() => call(() => api.delete(`/admin/staff/${member.id}`), "Staff access removed.")}>
          Remove from staff
        </Button>
      </div>
      {msg && <Banner kind={msg.kind}>{msg.text}</Banner>}
    </div>
  );
}

export default function AdminStaff() {
  const { user: me } = useAuth();
  const staff = useApi<{ staff: StaffMember[] }>("/admin/staff", { limit: 100 });
  const roles = useApi<{ roles: StaffRole[] }>("/admin/staff-roles");
  const cat = useApi<Catalogue>("/admin/me/permissions");
  const [open, setOpen] = useState<string | null>(null);

  if (staff.loading || roles.loading) return <Loading />;
  if (staff.error) return <ErrorState message={staff.error} onRetry={staff.reload} />;

  return (
    <div className="max-w-6xl">
      <AdminHeader title="Staff" lead="Who can use the admin console, and what each person can do." />
      <AddStaff roles={roles.data?.roles ?? []} onDone={staff.reload} />
      <Table head={["Member", "Access", "Permissions", ""]} empty={!staff.data?.staff.length}>
        {(staff.data?.staff ?? []).map((m) => (
          <Fragment key={m.id}>
            <tr>
              <td className="px-4 py-3">
                <Link to={`/admin/users/${m.id}`} className="font-semibold text-ink hover:underline">
                  {m.name}
                </Link>
                <span className="block text-xs text-ink-faint">{m.email}</span>
              </td>
              <td className="px-4 py-3">
                {m.isSuperAdmin ? <Pill tone="accent">Super Admin</Pill> : m.staffRole ? <Pill>{m.staffRole.name}</Pill> : <Pill tone="warn">No role</Pill>}
                {m.status !== "active" && <span className="ml-1"><Pill tone="bad">{m.status}</Pill></span>}
              </td>
              <td className="num px-4 py-3 text-ink-muted">{m.isSuperAdmin ? "All" : m.effectivePermissions.length}</td>
              <td className="px-4 py-3 text-right">
                {m.id !== me?.id && (
                  <Button size="sm" variant="ghost" onClick={() => setOpen(open === m.id ? null : m.id)}>
                    {open === m.id ? "Close" : "Edit"}
                  </Button>
                )}
              </td>
            </tr>
            {open === m.id && (
              <tr>
                <td colSpan={4} className="p-0">
                  <EditStaff
                    member={m}
                    roles={roles.data?.roles ?? []}
                    catalogue={cat.data?.catalogue ?? []}
                    onDone={() => {
                      staff.reload();
                      roles.reload();
                    }}
                  />
                </td>
              </tr>
            )}
          </Fragment>
        ))}
      </Table>
    </div>
  );
}

export function AdminRoles() {
  const roles = useApi<{ roles: StaffRole[] }>("/admin/staff-roles");
  const cat = useApi<Catalogue>("/admin/me/permissions");
  const [editing, setEditing] = useState<StaffRole | "new" | null>(null);
  const [form, setForm] = useState({ key: "", name: "", description: "", permissions: [] as string[] });
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  function start(r: StaffRole | "new") {
    setEditing(r);
    setMsg(null);
    setForm(r === "new" ? { key: "", name: "", description: "", permissions: [] } : { key: r.key, name: r.name, description: r.description ?? "", permissions: r.permissions });
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      if (editing === "new") await api.post("/admin/staff-roles", form);
      else if (editing) await api.patch(`/admin/staff-roles/${editing.id}`, { name: form.name, description: form.description, permissions: form.permissions });
      setEditing(null);
      setMsg({ kind: "ok", text: "Role saved." });
      roles.reload();
    } catch (err) {
      setMsg({ kind: "error", text: apiError(err) });
    }
  }

  async function remove(r: StaffRole) {
    setMsg(null);
    try {
      await api.delete(`/admin/staff-roles/${r.id}`);
      roles.reload();
    } catch (err) {
      setMsg({ kind: "error", text: apiError(err) });
    }
  }

  if (roles.loading) return <Loading />;
  return (
    <div className="max-w-6xl">
      <AdminHeader
        title="Roles & permissions"
        lead="A role is a named set of permissions. Staff management and platform settings stay with Super Admins."
        actions={<Button size="sm" onClick={() => start("new")}>New role</Button>}
      />
      {msg && <Banner kind={msg.kind}>{msg.text}</Banner>}

      {editing && (
        <form onSubmit={save} className="mt-6 space-y-4 rounded-xl border border-border bg-surface p-4">
          <div className="flex flex-wrap gap-2">
            {editing === "new" && (
              <input className={`${smallInput} w-48`} placeholder="key, e.g. event_manager" value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} required pattern="[a-z][a-z0-9_]{1,39}" />
            )}
            <input className={`${smallInput} w-56`} placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <input className={`${smallInput} min-w-[16rem] flex-1`} placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <PermissionPicker catalogue={cat.data?.catalogue ?? []} value={form.permissions} onChange={(permissions) => setForm({ ...form, permissions })} />
          <div className="flex gap-2">
            <Button size="sm" type="submit">
              Save role
            </Button>
            <Button size="sm" variant="ghost" type="button" onClick={() => setEditing(null)}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      <Table head={["Role", "Permissions", "Members", ""]} empty={!roles.data?.roles.length}>
        {(roles.data?.roles ?? []).map((r) => (
          <tr key={r.id} className="align-top">
            <td className="px-4 py-3">
              <span className="font-semibold text-ink">{r.name}</span> {r.isSystem && <Pill>built-in</Pill>}
              {r.description && <span className="mt-0.5 block text-xs text-ink-faint">{r.description}</span>}
            </td>
            <td className="px-4 py-3">
              <span className="flex max-w-md flex-wrap gap-1">
                {r.permissions.map((p) => (
                  <span key={p} className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-ink-muted">
                    {p}
                  </span>
                ))}
              </span>
            </td>
            <td className="num px-4 py-3 text-ink-muted">{r.memberCount ?? 0}</td>
            <td className="space-x-1 whitespace-nowrap px-4 py-3 text-right">
              <Button size="sm" variant="ghost" onClick={() => start(r)}>
                Edit
              </Button>
              {!r.isSystem && (
                <Button size="sm" variant="ghost" onClick={() => remove(r)}>
                  Delete
                </Button>
              )}
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

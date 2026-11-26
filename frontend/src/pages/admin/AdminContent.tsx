import { Fragment, useState, type FormEvent } from "react";
import api from "@/api/axios";
import { apiError } from "@/types";
import { useApi } from "@/hooks/useApi";
import Button from "@/components/ui/Button";
import { Loading, ErrorState } from "@/components/ui/StateBlock";
import { AdminHeader, Banner, Pager, Pill, Table, smallInput } from "./adminUi";

function useMessage() {
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  async function run(fn: () => Promise<unknown>, ok: string) {
    setMsg(null);
    try {
      await fn();
      setMsg({ kind: "ok", text: ok });
      return true;
    } catch (err) {
      setMsg({ kind: "error", text: apiError(err) });
      return false;
    }
  }
  return { msg, run };
}

// ---------------------------------------------------------------- announcements

interface Announcement {
  id: string;
  title: string;
  body: string;
  audience: string;
  publishedAt: string;
  expiresAt: string | null;
  createdBy: { name: string } | null;
}

export function AdminAnnouncements() {
  const [page, setPage] = useState(1);
  const list = useApi<{ announcements: Announcement[]; pages: number }>("/admin/announcements", { page });
  const { msg, run } = useMessage();
  const [form, setForm] = useState({ title: "", body: "", audience: "all", expiresAt: "" });

  async function create(e: FormEvent) {
    e.preventDefault();
    const ok = await run(() => api.post("/admin/announcements", { ...form, expiresAt: form.expiresAt || null }), "Announcement published.");
    if (ok) {
      setForm({ title: "", body: "", audience: "all", expiresAt: "" });
      list.reload();
    }
  }

  return (
    <div className="max-w-5xl">
      <AdminHeader title="Announcements" lead="Shown to everyone on their notifications page. Stored once, not sent to each user." />
      <form onSubmit={create} className="mt-6 space-y-3 rounded-xl border border-border bg-surface p-4">
        <input className={`${smallInput} w-full`} placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required maxLength={160} />
        <textarea className={`${smallInput} h-28 w-full py-2`} placeholder="Message" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} required maxLength={4000} />
        <div className="flex flex-wrap items-center gap-2">
          <select className={smallInput} value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })} aria-label="Audience">
            <option value="all">Everyone</option>
            <option value="players">Players</option>
            <option value="merchants">Merchants</option>
            <option value="ground_owners">Ground owners</option>
          </select>
          <label className="text-sm text-ink-muted">
            Expires{" "}
            <input type="date" className={smallInput} value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />
          </label>
          <Button size="sm" type="submit">
            Publish
          </Button>
        </div>
      </form>
      {msg && <Banner kind={msg.kind}>{msg.text}</Banner>}
      {list.loading ? (
        <Loading />
      ) : (
        <>
          <Table head={["Announcement", "Audience", "Published", "Expires", ""]} empty={!list.data?.announcements.length}>
            {(list.data?.announcements ?? []).map((a) => {
              const live = !a.expiresAt || new Date(a.expiresAt) > new Date();
              return (
                <tr key={a.id} className="align-top">
                  <td className="px-4 py-3">
                    <span className="font-semibold text-ink">{a.title}</span>
                    <span className="mt-0.5 line-clamp-2 block text-xs text-ink-faint">{a.body}</span>
                  </td>
                  <td className="px-4 py-3">
                    <Pill>{a.audience}</Pill>
                  </td>
                  <td className="num px-4 py-3 text-ink-muted">{new Date(a.publishedAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">{a.expiresAt ? <Pill tone={live ? "neutral" : "bad"}>{new Date(a.expiresAt).toLocaleDateString()}</Pill> : "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="ghost" onClick={async () => (await run(() => api.delete(`/admin/announcements/${a.id}`), "Deleted.")) && list.reload()}>
                      Delete
                    </Button>
                  </td>
                </tr>
              );
            })}
          </Table>
          <Pager page={page} pages={list.data?.pages ?? 1} onPage={setPage} />
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- sports

interface SportRow {
  slug: string;
  name: string;
  order: number;
  active: boolean;
  minPlayers: number;
  maxPlayers: number;
  positions: string[];
}

export function AdminSports() {
  const list = useApi<{ sports: SportRow[] }>("/admin/sports");
  const { msg, run } = useMessage();
  const [form, setForm] = useState({ slug: "", name: "", minPlayers: "1", maxPlayers: "15", positions: "" });

  async function create(e: FormEvent) {
    e.preventDefault();
    const ok = await run(
      () =>
        api.post("/admin/sports", {
          slug: form.slug,
          name: form.name,
          minPlayers: Number(form.minPlayers),
          maxPlayers: Number(form.maxPlayers),
          positions: form.positions.split(",").map((p) => p.trim()).filter(Boolean),
        }),
      "Sport added. It's available for new teams, tournaments and challenges now."
    );
    if (ok) {
      setForm({ slug: "", name: "", minPlayers: "1", maxPlayers: "15", positions: "" });
      list.reload();
    }
  }

  return (
    <div className="max-w-5xl">
      <AdminHeader title="Sports" lead="Add sports or hide one from new teams and events. Existing data for a hidden sport keeps working." />
      <form onSubmit={create} className="mt-6 flex flex-wrap gap-2 rounded-xl border border-border bg-surface p-4">
        <input className={`${smallInput} w-36`} placeholder="slug, e.g. netball" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })} required pattern="[a-z][a-z0-9-]{1,39}" />
        <input className={`${smallInput} w-40`} placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <input className={`${smallInput} w-24`} type="number" min={1} max={50} aria-label="Minimum players" title="Minimum roster" value={form.minPlayers} onChange={(e) => setForm({ ...form, minPlayers: e.target.value })} />
        <input className={`${smallInput} w-24`} type="number" min={1} max={100} aria-label="Maximum players" title="Maximum roster" value={form.maxPlayers} onChange={(e) => setForm({ ...form, maxPlayers: e.target.value })} />
        <input className={`${smallInput} min-w-[14rem] flex-1`} placeholder="Positions, comma separated" value={form.positions} onChange={(e) => setForm({ ...form, positions: e.target.value })} />
        <Button size="sm" type="submit">
          Add sport
        </Button>
      </form>
      {msg && <Banner kind={msg.kind}>{msg.text}</Banner>}
      {list.loading ? (
        <Loading />
      ) : list.error ? (
        <ErrorState message={list.error} />
      ) : (
        <Table head={["Sport", "Roster", "Positions", "Status", ""]} empty={!list.data?.sports.length}>
          {(list.data?.sports ?? []).map((s) => (
            <tr key={s.slug}>
              <td className="px-4 py-3">
                <span className="font-semibold text-ink">{s.name}</span> <span className="font-mono text-xs text-ink-faint">{s.slug}</span>
              </td>
              <td className="num px-4 py-3 text-ink-muted">
                {s.minPlayers}–{s.maxPlayers}
              </td>
              <td className="px-4 py-3 text-xs text-ink-muted">{s.positions.join(", ") || "—"}</td>
              <td className="px-4 py-3">
                <Pill tone={s.active ? "good" : "neutral"}>{s.active ? "Active" : "Hidden"}</Pill>
              </td>
              <td className="px-4 py-3 text-right">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => (await run(() => api.patch(`/admin/sports/${s.slug}`, { active: !s.active }), s.active ? "Sport hidden." : "Sport activated.")) && list.reload()}
                >
                  {s.active ? "Hide" : "Activate"}
                </Button>
              </td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- blacklist

interface BlacklistEntry {
  id: string;
  kind: "email" | "phone";
  hint: string;
  reason: string | null;
  user: { id: string; name: string } | null;
  createdAt: string;
}

export function AdminBlacklist() {
  const [page, setPage] = useState(1);
  const list = useApi<{ entries: BlacklistEntry[]; pages: number; total: number }>("/admin/blacklist", { page });
  const { msg, run } = useMessage();
  return (
    <div className="max-w-5xl">
      <AdminHeader
        title="Blacklist"
        lead="Emails and phone numbers of banned accounts, stored only as fingerprints. They can't be used to register or be added to a profile."
      />
      {msg && <Banner kind={msg.kind}>{msg.text}</Banner>}
      {list.loading ? (
        <Loading />
      ) : (
        <>
          <Table head={["Entry", "Account", "Reason", "Added", ""]} empty={!list.data?.entries.length}>
            {(list.data?.entries ?? []).map((b) => (
              <tr key={b.id}>
                <td className="px-4 py-3">
                  <Pill>{b.kind}</Pill> <span className="font-mono text-xs text-ink">{b.hint}</span>
                </td>
                <td className="px-4 py-3 text-ink-muted">{b.user?.name ?? "deleted account"}</td>
                <td className="px-4 py-3 text-ink-muted">{b.reason ?? ""}</td>
                <td className="num px-4 py-3 text-ink-muted">{new Date(b.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-right">
                  <Button size="sm" variant="ghost" onClick={async () => (await run(() => api.delete(`/admin/blacklist/${b.id}`), "Entry removed.")) && list.reload()}>
                    Remove
                  </Button>
                </td>
              </tr>
            ))}
          </Table>
          <Pager page={page} pages={list.data?.pages ?? 1} onPage={setPage} />
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- audit log

interface AuditRow {
  id: string;
  actor: { id: string; name: string; email: string } | null;
  actorRole: string | null;
  action: string;
  target: { type: string; id: string | null } | null;
  before: unknown;
  after: unknown;
  reason: string | null;
  createdAt: string;
}

export function AdminAudit() {
  const [action, setAction] = useState("");
  const [query, setQuery] = useState({ action: "", page: 1 });
  const list = useApi<{ logs: AuditRow[]; pages: number; total: number }>("/admin/audit-logs", query);
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="max-w-6xl">
      <AdminHeader title="Audit log" lead="Every privileged action, append-only." />
      <form
        className="mt-5 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery({ action, page: 1 });
        }}
      >
        <input className={`${smallInput} w-72 font-mono`} placeholder="action, e.g. user.banned" value={action} onChange={(e) => setAction(e.target.value.trim())} />
        <Button size="sm" type="submit" variant="secondary">
          Filter
        </Button>
      </form>
      {list.loading ? (
        <Loading />
      ) : list.error ? (
        <ErrorState message={list.error} />
      ) : (
        <>
          <Table head={["When", "Actor", "Action", "Target", ""]} empty={!list.data?.logs.length}>
            {(list.data?.logs ?? []).map((l) => (
              <Fragment key={l.id}>
                <tr>
                  <td className="num whitespace-nowrap px-4 py-2.5 text-ink-muted">{new Date(l.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-2.5">{l.actor ? l.actor.name : <span className="text-ink-faint">system</span>}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-ink">{l.action}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-ink-faint">{l.target ? `${l.target.type}:${l.target.id ?? ""}` : ""}</td>
                  <td className="px-4 py-2.5 text-right">
                    {(l.before !== undefined || l.after !== undefined || l.reason) && (
                      <button className="text-xs font-semibold text-accent" onClick={() => setOpen(open === l.id ? null : l.id)}>
                        {open === l.id ? "Hide" : "Details"}
                      </button>
                    )}
                  </td>
                </tr>
                {open === l.id && (
                  <tr>
                    <td colSpan={5} className="bg-base-2 px-4 py-3">
                      {l.reason && <p className="mb-2 text-sm text-ink-muted">Reason: {l.reason}</p>}
                      <pre className="overflow-x-auto text-xs text-ink-muted">{JSON.stringify({ before: l.before, after: l.after }, null, 2)}</pre>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </Table>
          <Pager page={query.page} pages={list.data?.pages ?? 1} onPage={(page) => setQuery((q) => ({ ...q, page }))} />
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- disputed results

interface AdminReport {
  id: string;
  match: { id: string; teamA: any; teamB: any; userA: any; userB: any; tournament: any; sport: string | null } | string | null;
  submittedBy: { name: string | null } | null;
  scoreA: number;
  scoreB: number;
  outcome: string;
  notes: string | null;
  response: { by: { name: string | null } | null; reason: string | null } | null;
  createdAt: string;
}

const sideLabel = (m: any, s: "A" | "B") => {
  const t = s === "A" ? m?.teamA : m?.teamB;
  const u = s === "A" ? m?.userA : m?.userB;
  return t?.name ?? u?.name ?? s;
};

function Resolve({ r, onDone }: { r: AdminReport; onDone: () => void }) {
  const [decision, setDecision] = useState<"verify" | "amend" | "void">("verify");
  const [scoreA, setScoreA] = useState(String(r.scoreA));
  const [scoreB, setScoreB] = useState(String(r.scoreB));
  const [note, setNote] = useState("");
  const { msg, run } = useMessage();
  return (
    <form
      className="mt-3 flex flex-wrap items-center gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const body: Record<string, unknown> = { decision, note };
        if (decision === "amend") Object.assign(body, { scoreA: Number(scoreA), scoreB: Number(scoreB) });
        if (await run(() => api.post(`/admin/match-reports/${r.id}/resolve`, body), "Resolved.")) onDone();
      }}
    >
      <select className={smallInput} value={decision} onChange={(e) => setDecision(e.target.value as typeof decision)} aria-label="Decision">
        <option value="verify">Verify as reported</option>
        <option value="amend">Verify a corrected score</option>
        <option value="void">Void (report again)</option>
      </select>
      {decision === "amend" && (
        <>
          <input className={`${smallInput} w-16`} type="number" min={0} value={scoreA} onChange={(e) => setScoreA(e.target.value)} aria-label="Score A" />
          <span className="text-ink-faint">–</span>
          <input className={`${smallInput} w-16`} type="number" min={0} value={scoreB} onChange={(e) => setScoreB(e.target.value)} aria-label="Score B" />
        </>
      )}
      <input className={`${smallInput} min-w-[16rem] flex-1`} placeholder="Note for both sides (required)" value={note} onChange={(e) => setNote(e.target.value)} required />
      <Button size="sm" type="submit">
        Decide
      </Button>
      {msg && <span className={`w-full text-xs ${msg.kind === "ok" ? "text-success" : "text-danger"}`}>{msg.text}</span>}
    </form>
  );
}

export function AdminDisputes() {
  const [status, setStatus] = useState("disputed");
  const list = useApi<{ reports: AdminReport[]; total: number }>("/admin/match-reports", { status });
  return (
    <div className="max-w-5xl">
      <AdminHeader
        title="Match results"
        lead="Disputed results wait here. Records only change once a result is verified."
        actions={
          <select className={smallInput} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
            <option value="disputed">Disputed</option>
            <option value="submitted">Awaiting the other side</option>
            <option value="verified">Verified</option>
            <option value="rejected">Voided</option>
          </select>
        }
      />
      {list.loading ? (
        <Loading />
      ) : !list.data?.reports.length ? (
        <p className="mt-8 text-sm text-ink-faint">Nothing here.</p>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {list.data.reports.map((r) => {
            const m = typeof r.match === "object" ? r.match : null;
            return (
              <li key={r.id} className="rounded-xl border border-border bg-surface p-4">
                <p className="num font-semibold text-ink">
                  {sideLabel(m, "A")} {r.scoreA} – {r.scoreB} {sideLabel(m, "B")}
                  {m?.tournament?.name ? <span className="ml-2 text-xs font-normal text-ink-faint">{m.tournament.name}</span> : null}
                </p>
                <p className="mt-1 text-xs text-ink-faint">
                  Reported by {r.submittedBy?.name ?? "?"} · {new Date(r.createdAt).toLocaleString()}
                  {m && (
                    <>
                      {" · "}
                      <a href={`/matches/${m.id}`} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                        Open match
                      </a>
                    </>
                  )}
                </p>
                {r.notes && <p className="mt-2 text-sm text-ink-muted">Reporter: “{r.notes}”</p>}
                {r.response?.reason && <p className="mt-1 text-sm text-danger">Disputed by {r.response.by?.name}: “{r.response.reason}”</p>}
                {status === "disputed" && <Resolve r={r} onDone={list.reload} />}
              </li>
            );
          })}
        </ul>
      )}
      <Pill tone="neutral">{list.data?.total ?? 0} total</Pill>
    </div>
  );
}

// ---------------------------------------------------------------- tournament approvals

interface AdminTournament {
  id: string;
  name: string;
  slug: string | null;
  sport: string;
  format: string;
  status: string;
  startDate: string | null;
  organizer: { name: string } | null;
  province: string;
  eligibility: { approvedTeams: number; distinctOwners: number; needed: number; readyForReview: boolean };
}

export function AdminTournaments() {
  const [status, setStatus] = useState("under_review");
  const list = useApi<{ tournaments: AdminTournament[]; total: number }>("/admin/tournaments", { status });
  const { msg, run } = useMessage();

  async function review(t: AdminTournament, decision: "approve" | "reject") {
    const note = decision === "reject" ? window.prompt(`Why is ${t.name} not approved? The organizer will see this.`) : "";
    if (decision === "reject" && !note) return;
    if (await run(() => api.post(`/admin/tournaments/${t.id}/review`, { decision, note }), decision === "approve" ? "Approved." : "Rejected.")) list.reload();
  }

  return (
    <div className="max-w-6xl">
      <AdminHeader
        title="Tournaments"
        lead="A tournament can be submitted once at least four eligible teams, run by two or more people besides the organizer, are approved."
        actions={
          <select className={smallInput} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
            <option value="under_review">Waiting for review</option>
            <option value="open">Taking teams</option>
            <option value="approved">Approved</option>
            <option value="ongoing">Ongoing</option>
            <option value="rejected">Rejected</option>
            <option value="all">All</option>
          </select>
        }
      />
      {msg && <Banner kind={msg.kind}>{msg.text}</Banner>}
      {list.loading ? (
        <Loading />
      ) : (
        <Table head={["Tournament", "Organizer", "Teams", "Starts", "Status", ""]} empty={!list.data?.tournaments.length}>
          {(list.data?.tournaments ?? []).map((t) => (
            <tr key={t.id}>
              <td className="px-4 py-3">
                <a href={`/tournaments/${t.slug || t.id}`} target="_blank" rel="noreferrer" className="font-semibold text-ink hover:underline">
                  {t.name}
                </a>
                <span className="block text-xs text-ink-faint">
                  {t.sport} · {t.format.replace("_", " ")} · {t.province}
                </span>
              </td>
              <td className="px-4 py-3 text-ink-muted">{t.organizer?.name}</td>
              <td className="px-4 py-3">
                <span className="num text-ink">
                  {t.eligibility.approvedTeams}/{t.eligibility.needed}
                </span>
                <span className="block text-xs text-ink-faint">{t.eligibility.distinctOwners} other owners</span>
                {!t.eligibility.readyForReview && <Pill tone="warn">Not eligible</Pill>}
              </td>
              <td className="num px-4 py-3 text-ink-muted">{t.startDate ? new Date(t.startDate).toLocaleDateString() : "—"}</td>
              <td className="px-4 py-3">
                <Pill tone={t.status === "approved" ? "good" : t.status === "rejected" ? "bad" : t.status === "under_review" ? "warn" : "neutral"}>{t.status.replace("_", " ")}</Pill>
              </td>
              <td className="space-x-1 whitespace-nowrap px-4 py-3 text-right">
                {t.status === "under_review" && (
                  <>
                    <Button size="sm" disabled={!t.eligibility.readyForReview} onClick={() => review(t, "approve")}>
                      Approve
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => review(t, "reject")}>
                      Reject
                    </Button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}

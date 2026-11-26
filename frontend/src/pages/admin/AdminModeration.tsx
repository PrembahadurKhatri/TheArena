import { useState } from "react";
import { Link } from "react-router-dom";
import api from "@/api/axios";
import { apiError } from "@/types";
import { useApi } from "@/hooks/useApi";
import Button from "@/components/ui/Button";
import { Loading } from "@/components/ui/StateBlock";
import { AdminHeader, Banner, Pager, Pill, Table, smallInput } from "./adminUi";

interface ReportRow {
  id: string;
  targetType: string;
  targetId: string;
  target: { exists: boolean; label: string; link: string | null };
  openReports: number;
  reason: string;
  details: string | null;
  status: string;
  reporter: { name: string; email: string } | null;
  handledBy: string | null;
  resolution: string | null;
  createdAt: string;
}

export function AdminReports() {
  const [query, setQuery] = useState({ status: "open", targetType: "", page: 1 });
  const list = useApi<{ reports: ReportRow[]; pages: number; total: number }>("/admin/reports", query);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  async function resolve(r: ReportRow, status: "actioned" | "dismissed" | "in_review") {
    const resolution = status === "in_review" ? "" : window.prompt(status === "actioned" ? "What action did you take?" : "Why is no action needed?") ?? "";
    if (status !== "in_review" && !resolution) return;
    setMsg(null);
    try {
      const res = await api.post(`/admin/reports/${r.id}/resolve`, { status, resolution });
      setMsg({ kind: "ok", text: status === "in_review" ? "Marked as in review." : `Closed ${res.data.updated} report(s) on this ${r.targetType}.` });
      list.reload();
    } catch (err) {
      setMsg({ kind: "error", text: apiError(err) });
    }
  }

  return (
    <div className="max-w-6xl">
      <AdminHeader
        title="Reports"
        lead="Accounts and content reported by users. Take action from the relevant screen (users, teams, shops…), then close the report here."
        actions={
          <>
            <select className={smallInput} value={query.targetType} onChange={(e) => setQuery((q) => ({ ...q, targetType: e.target.value, page: 1 }))} aria-label="Type">
              <option value="">Any type</option>
              {["user", "team", "store", "product", "review", "match", "tournament", "ground"].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <select className={smallInput} value={query.status} onChange={(e) => setQuery((q) => ({ ...q, status: e.target.value, page: 1 }))} aria-label="Status">
              <option value="open">Open</option>
              <option value="actioned">Actioned</option>
              <option value="dismissed">Dismissed</option>
              <option value="all">All</option>
            </select>
          </>
        }
      />
      {msg && <Banner kind={msg.kind}>{msg.text}</Banner>}
      {list.loading ? (
        <Loading />
      ) : (
        <>
          <Table head={["Reported", "Reason", "By", "When", ""]} empty={!list.data?.reports.length}>
            {(list.data?.reports ?? []).map((r) => (
              <tr key={r.id} className="align-top">
                <td className="px-4 py-3">
                  <Pill>{r.targetType}</Pill>{" "}
                  {r.target.link ? (
                    <Link to={r.target.link} className="font-semibold text-ink hover:underline">
                      {r.target.label}
                    </Link>
                  ) : (
                    <span className="font-semibold text-ink-faint">{r.target.label}</span>
                  )}
                  {r.openReports > 1 && <span className="ml-2 text-xs font-semibold text-danger">{r.openReports} open reports</span>}
                </td>
                <td className="px-4 py-3">
                  <span className="text-ink">{r.reason}</span>
                  {r.details && <span className="mt-1 block max-w-xs text-xs text-ink-muted">“{r.details}”</span>}
                  {r.resolution && <span className="mt-1 block text-xs text-ink-faint">Decided: {r.resolution}{r.handledBy ? ` (${r.handledBy})` : ""}</span>}
                </td>
                <td className="px-4 py-3 text-ink-muted">{r.reporter?.name}</td>
                <td className="num px-4 py-3 text-ink-muted">{new Date(r.createdAt).toLocaleDateString()}</td>
                <td className="space-x-1 whitespace-nowrap px-4 py-3 text-right">
                  {(r.status === "open" || r.status === "in_review") && (
                    <>
                      {r.status === "open" && (
                        <Button size="sm" variant="ghost" onClick={() => resolve(r, "in_review")}>
                          Take
                        </Button>
                      )}
                      <Button size="sm" onClick={() => resolve(r, "actioned")}>
                        Actioned
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => resolve(r, "dismissed")}>
                        Dismiss
                      </Button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </Table>
          <Pager page={query.page} pages={list.data?.pages ?? 1} onPage={(page) => setQuery((q) => ({ ...q, page }))} />
        </>
      )}
    </div>
  );
}

interface SettingRow {
  key: string;
  label: string;
  min: number;
  max: number;
  value: number;
  default: number;
  overridden: boolean;
}

export function AdminSettings() {
  const list = useApi<{ settings: SettingRow[] }>("/admin/settings");
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  async function save(body: Record<string, number | null>) {
    setMsg(null);
    try {
      await api.patch("/admin/settings", body);
      setDraft({});
      setMsg({ kind: "ok", text: "Saved. It applies right away." });
      list.reload();
    } catch (err) {
      setMsg({ kind: "error", text: apiError(err) });
    }
  }

  return (
    <div className="max-w-3xl">
      <AdminHeader title="Platform settings" lead="Super Admins only. Every change is in the audit log." />
      {msg && <Banner kind={msg.kind}>{msg.text}</Banner>}
      {list.loading ? (
        <Loading />
      ) : (
        <ul className="mt-6 flex flex-col divide-y divide-border rounded-xl border border-border">
          {(list.data?.settings ?? []).map((s) => (
            <li key={s.key} className="flex flex-wrap items-center gap-3 p-4">
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-ink">{s.label}</span>
                <span className="block text-xs text-ink-faint">
                  {s.min}–{s.max}, default {s.default}
                </span>
              </span>
              <input
                type="number"
                min={s.min}
                max={s.max}
                className={`${smallInput} w-24`}
                value={draft[s.key] ?? String(s.value)}
                onChange={(e) => setDraft({ ...draft, [s.key]: e.target.value })}
                aria-label={s.label}
              />
              <Button size="sm" disabled={draft[s.key] === undefined} onClick={() => save({ [s.key]: Number(draft[s.key]) })}>
                Save
              </Button>
              {s.overridden && (
                <Button size="sm" variant="ghost" onClick={() => save({ [s.key]: null })}>
                  Reset
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface Overview {
  totals: Record<string, number | Record<string, number>>;
  pending: Record<string, number>;
  activity: { action: string; actor: string; at: string }[];
}

const TOTAL_LABELS: Record<string, string> = {
  users: "Players",
  activePlayers30d: "Active in 30 days",
  teams: "Teams",
  merchants: "Shops",
  grounds: "Grounds",
  tournaments: "Tournaments",
  matches: "Matches",
  verifiedMatches: "Verified results",
  bookings: "Bookings",
  orders: "Orders",
  deliveredOrderValue: "Delivered order value (Rs)",
  activeSubscriptions: "Active subscriptions",
  suspendedUsers: "Suspended",
  bannedUsers: "Banned",
};

const PENDING_LINKS: Record<string, [string, string]> = {
  merchants: ["Shop applications", "/admin/merchants"],
  products: ["Products to review", "/admin/products"],
  grounds: ["Grounds to review", "/admin/grounds"],
  tournaments: ["Tournaments to review", "/admin/tournaments"],
  disputes: ["Disputed results", "/admin/results"],
  reports: ["Open reports", "/admin/reports"],
  manualPayments: ["Manual payments to verify", "/admin"],
};

export function OverviewPanel() {
  const { data } = useApi<Overview>("/admin/overview");
  if (!data) return <Loading />;
  return (
    <div className="mt-8 flex flex-col gap-8">
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-faint">Needs attention</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(data.pending).map(([k, v]) => (
            <Link key={k} to={PENDING_LINKS[k]?.[1] ?? "/admin"} className={`rounded-xl border p-4 ${v ? "border-premium/40 bg-premium-soft" : "border-border bg-surface"}`}>
              <span className="num block text-2xl font-bold text-ink">{v}</span>
              <span className="text-sm text-ink-muted">{PENDING_LINKS[k]?.[0] ?? k}</span>
            </Link>
          ))}
        </div>
      </section>
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-faint">Platform</h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {Object.entries(data.totals)
            .filter(([, v]) => typeof v === "number")
            .map(([k, v]) => (
              <div key={k} className="rounded-xl border border-border bg-surface p-4">
                <dd className="num text-2xl font-bold text-ink">{v as number}</dd>
                <dt className="text-xs text-ink-muted">{TOTAL_LABELS[k] ?? k}</dt>
              </div>
            ))}
        </dl>
        <p className="mt-2 text-xs text-ink-faint">Money figures are records of orders, not settled payments: no payment gateway is connected yet.</p>
      </section>
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-faint">Recent activity</h2>
        <ul className="mt-3 divide-y divide-border rounded-xl border border-border text-sm">
          {data.activity.map((a, i) => (
            <li key={i} className="flex justify-between gap-3 px-4 py-2">
              <span className="font-mono text-xs text-ink">{a.action}</span>
              <span className="text-xs text-ink-faint">
                {a.actor} · {new Date(a.at).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

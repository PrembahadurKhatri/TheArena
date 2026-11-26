import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

// Small building blocks shared by admin screens: dense, neutral, table-first.

export function AdminHeader({ title, lead, actions }: { title: string; lead?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-ink">{title}</h1>
        {lead && <p className="mt-1 text-sm text-ink-muted">{lead}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Pager({ page, pages, onPage }: { page: number; pages: number; onPage: (p: number) => void }) {
  if (pages <= 1) return null;
  return (
    <nav className="mt-4 flex items-center justify-end gap-2 text-sm" aria-label="Pages">
      <button
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-border disabled:opacity-40"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
        aria-label="Previous page"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="num text-ink-muted">
        Page {page} of {pages}
      </span>
      <button
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-border disabled:opacity-40"
        disabled={page >= pages}
        onClick={() => onPage(page + 1)}
        aria-label="Next page"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </nav>
  );
}

export function Table({ head, children, empty }: { head: string[]; children: ReactNode; empty?: boolean }) {
  return (
    <div className="mt-5 overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[40rem] text-left text-sm">
        <thead className="bg-surface text-xs uppercase tracking-wide text-ink-faint">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-4 py-2.5 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">{children}</tbody>
      </table>
      {empty && <p className="px-4 py-10 text-center text-sm text-ink-faint">Nothing to show.</p>}
    </div>
  );
}

export function Pill({ tone = "neutral", children }: { tone?: "neutral" | "good" | "warn" | "bad" | "accent"; children: ReactNode }) {
  const cls = {
    neutral: "border-border bg-surface-2 text-ink-muted",
    good: "border-success/25 bg-success/10 text-success",
    warn: "border-premium/30 bg-premium-soft text-premium",
    bad: "border-danger/25 bg-danger/10 text-danger",
    accent: "border-accent/30 bg-accent-soft text-accent",
  }[tone];
  return <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${cls}`}>{children}</span>;
}

export function statusTone(status: string) {
  return status === "active" || status === "approved" ? "good" : status === "suspended" || status === "pending" ? "warn" : status === "banned" || status === "rejected" ? "bad" : "neutral";
}

export function Banner({ kind, children }: { kind: "ok" | "error"; children: ReactNode }) {
  return (
    <p
      role={kind === "error" ? "alert" : "status"}
      className={`mt-4 rounded-lg border px-4 py-2.5 text-sm ${kind === "ok" ? "border-success/25 bg-success/10 text-success" : "border-danger/25 bg-danger/10 text-danger"}`}
    >
      {children}
    </p>
  );
}

export const smallInput =
  "h-9 rounded-lg border border-border bg-base-2 px-3 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20";

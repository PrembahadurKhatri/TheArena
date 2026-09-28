import { Crown } from "lucide-react";

export function PremiumBadge({ compact = false }: { compact?: boolean }) {
  return (
    <span className="eyebrow-premium !py-1">
      <Crown className="h-3 w-3" />
      {!compact && "Premium"}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    upcoming: "bg-accent-soft text-accent",
    ongoing: "bg-premium-soft text-premium",
    completed: "bg-surface-2 text-ink-muted",
    pending_payment: "bg-premium-soft text-premium",
    confirmed: "bg-emerald-500/10 text-emerald-400",
    cancelled: "bg-red-500/10 text-red-400",
    pending: "bg-premium-soft text-premium",
    success: "bg-emerald-500/10 text-emerald-400",
    failed: "bg-red-500/10 text-red-400",
  };
  const cls = map[status] ?? "bg-surface-2 text-ink-muted";
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold capitalize ${cls}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

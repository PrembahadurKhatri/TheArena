import { Crown } from "lucide-react";

export function PremiumBadge({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-premium/30 bg-premium-soft px-3 py-1 text-xs font-semibold text-premium">
      <Crown className="h-3 w-3" />
      {!compact && "Premium"}
    </span>
  );
}

const STATUS_CLASSES: Record<string, string> = {
  upcoming: "border-accent/30 bg-accent-soft text-accent",
  open: "border-accent/30 bg-accent-soft text-accent",
  approved: "border-success/25 bg-success/10 text-success",
  under_review: "border-premium/30 bg-premium-soft text-premium",
  rejected: "border-danger/25 bg-danger/10 text-danger",
  requested: "border-premium/30 bg-premium-soft text-premium",
  withdrawn: "border-border bg-surface-2 text-ink-muted",
  final: "border-success/25 bg-success/10 text-success",
  disputed: "border-danger/25 bg-danger/10 text-danger",
  "awaiting confirmation": "border-premium/30 bg-premium-soft text-premium",
  confirmed_unpaid: "border-premium/30 bg-premium-soft text-premium",
  blocked: "border-border bg-surface-2 text-ink-muted",
  no_show: "border-danger/25 bg-danger/10 text-danger",
  processing: "border-accent/30 bg-accent-soft text-accent",
  shipped: "border-accent/30 bg-accent-soft text-accent",
  delivered: "border-success/25 bg-success/10 text-success",
  returned: "border-border bg-surface-2 text-ink-muted",
  refunded: "border-border bg-surface-2 text-ink-muted",
  active: "border-success/25 bg-success/10 text-success",
  expired: "border-border bg-surface-2 text-ink-muted",
  ongoing: "border-premium/30 bg-premium-soft text-premium",
  completed: "border-border bg-surface-2 text-ink-muted",
  pending_payment: "border-premium/30 bg-premium-soft text-premium",
  confirmed: "border-success/25 bg-success/10 text-success",
  paid: "border-success/25 bg-success/10 text-success",
  cancelled: "border-danger/25 bg-danger/10 text-danger",
  pending: "border-premium/30 bg-premium-soft text-premium",
  success: "border-success/25 bg-success/10 text-success",
  failed: "border-danger/25 bg-danger/10 text-danger",
};

export function statusLabel(status: string) {
  const text = status.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_CLASSES[status] ?? "border-border bg-surface-2 text-ink-muted";
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full border px-3 py-1 text-xs font-semibold ${cls}`}>
      {statusLabel(status)}
    </span>
  );
}

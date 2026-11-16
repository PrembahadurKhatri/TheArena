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

import type { ReactNode } from "react";
import { FlaskConical } from "lucide-react";

export function TestModeNote() {
  return (
    <p className="flex items-center gap-2 rounded-xl border border-premium/25 bg-premium-soft px-3.5 py-2.5 text-sm font-medium text-premium">
      <FlaskConical className="h-4 w-4 shrink-0" /> Test mode: no real charge
    </p>
  );
}

export function SummaryRow({ label, value, strong = false }: { label: ReactNode; value: ReactNode; strong?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 ${strong ? "text-ink" : "text-sm text-ink-muted"}`}>
      <span className={strong ? "font-semibold" : ""}>{label}</span>
      <span className={strong ? "num font-display text-2xl font-bold" : "num"}>{value}</span>
    </div>
  );
}

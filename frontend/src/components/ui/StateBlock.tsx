import { AlertTriangle, Inbox, Loader2 } from "lucide-react";
import type { ReactNode } from "react";

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div role="status" className="flex flex-1 flex-col items-center justify-center gap-3 py-28 text-ink-muted">
      <Loader2 className="h-6 w-6 animate-spin text-accent" />
      <p className="text-sm">{label.replace(/\.\.\.$/, "…")}</p>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="mx-4 my-12 flex flex-col items-center gap-4 rounded-2xl border border-danger/20 bg-danger/5 px-6 py-14 text-center sm:mx-auto sm:w-full sm:max-w-lg">
      <AlertTriangle className="h-6 w-6 text-danger" />
      <p className="text-sm text-ink-muted">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="h-9 rounded-full border border-border bg-surface px-4 text-sm font-semibold text-ink transition-colors hover:border-ink-faint/60 hover:bg-surface-2 active:bg-surface"
        >
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  title = "Nothing here yet",
  message,
  icon,
  action,
}: {
  title?: string;
  message?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-base-2 px-6 py-20 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface text-ink-faint">
        {icon ?? <Inbox className="h-5 w-5" />}
      </span>
      <p className="mt-1 font-display text-xl font-semibold text-ink">{title}</p>
      {message && <p className="max-w-sm text-sm text-ink-muted">{message}</p>}
      {action}
    </div>
  );
}

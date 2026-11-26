import { useState } from "react";
import { Flag } from "lucide-react";
import api from "@/api/axios";
import { useAuth } from "@/context/AuthContext";
import { apiError } from "@/types";

const REASONS = [
  ["spam", "Spam"],
  ["abuse", "Abuse or harassment"],
  ["fake", "Fake or impersonation"],
  ["inappropriate", "Inappropriate content"],
  ["fraud", "Fraud or scam"],
  ["cheating", "Cheating or false results"],
  ["other", "Something else"],
] as const;

/** Small "Report" link that files a report for staff to review. */
export default function ReportButton({ targetType, targetId }: { targetType: string; targetId: string }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("spam");
  const [details, setDetails] = useState("");
  const [done, setDone] = useState("");
  const [error, setError] = useState("");
  if (!user) return null;

  if (done) return <span className="text-xs text-ink-faint">{done}</span>;
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1 text-xs text-ink-faint hover:text-danger">
        <Flag className="h-3.5 w-3.5" /> Report
      </button>
    );
  }
  return (
    <form
      className="flex w-full max-w-sm flex-col gap-2 rounded-xl border border-border bg-surface p-3 text-sm"
      onSubmit={async (e) => {
        e.preventDefault();
        setError("");
        try {
          await api.post("/reports", { targetType, targetId, reason, details });
          setDone("Thanks. Our team will review it.");
        } catch (err) {
          setError(apiError(err));
        }
      }}
    >
      <select className="h-9 rounded-lg border border-border bg-base-2 px-2" value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Reason">
        {REASONS.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
      <textarea className="min-h-16 rounded-lg border border-border bg-base-2 p-2" maxLength={1000} placeholder="What happened? (optional)" value={details} onChange={(e) => setDetails(e.target.value)} />
      {error && <span className="text-xs text-danger">{error}</span>}
      <div className="flex gap-2">
        <button type="submit" className="rounded-full bg-danger px-3 py-1.5 text-xs font-semibold text-white">
          Send report
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-ink-muted">
          Cancel
        </button>
      </div>
    </form>
  );
}

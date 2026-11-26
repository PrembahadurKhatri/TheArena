import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, Check, Flag, MapPin, ShieldCheck, Trophy, Undo2 } from "lucide-react";
import api from "@/api/axios";
import { useAuth } from "@/context/AuthContext";
import { useApi } from "@/hooks/useApi";
import { apiError } from "@/types";
import type { MatchRow } from "@/types";
import { getSportBySlug } from "@/data/sports";
import { Loading, ErrorState } from "@/components/ui/StateBlock";
import Button from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Field";
import { FormError } from "@/components/page/AuthShell";
import { sideName } from "./Matches";

interface StatDef {
  key: string;
  label: string;
}

interface Report {
  id: string;
  submittedBy: { id: string; name: string | null } | null;
  submittedFor: "A" | "B" | "organizer";
  scoreA: number;
  scoreB: number;
  outcome: "A" | "B" | "draw";
  detail: string | null;
  players: { user: { id: string; name?: string }; side: "A" | "B"; stats: Record<string, number> }[];
  notes: string | null;
  status: "submitted" | "disputed" | "verified" | "rejected" | "withdrawn";
  response: { by: { name: string | null } | null; action: string; reason: string | null } | null;
  review: { decision: string; note: string | null } | null;
  verifiedHow: string | null;
  createdAt: string;
}

interface MatchPage {
  match: MatchRow;
  reports: Report[];
  viewerAuthority: ("A" | "B" | "organizer")[];
  statDefinitions: StatDef[];
  autoVerifyHours: number;
}

interface RosterMember {
  id: string;
  name: string;
}

const teamId = (t: MatchRow["teamA"]) => (t && typeof t === "object" ? t.id : typeof t === "string" ? t : null);

function ReportForm({ page, onDone }: { page: MatchPage; onDone: () => void }) {
  const m = page.match;
  const [scoreA, setScoreA] = useState("");
  const [scoreB, setScoreB] = useState("");
  const [tieWinner, setTieWinner] = useState<"draw" | "A" | "B">("draw");
  const [detail, setDetail] = useState("");
  const [notes, setNotes] = useState("");
  const [rosters, setRosters] = useState<{ A: RosterMember[]; B: RosterMember[] }>({ A: [], B: [] });
  const [lines, setLines] = useState<Record<string, { side: "A" | "B"; stats: Record<string, string> }>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const isTeam = m.mode === "team";
  const knockout = m.source === "tournament" && (m.stage ?? "knockout") === "knockout";

  useEffect(() => {
    if (!isTeam) {
      const a = m.userA && typeof m.userA === "object" ? [{ id: m.userA.id, name: m.userA.name }] : [];
      const b = m.userB && typeof m.userB === "object" ? [{ id: m.userB.id, name: m.userB.name }] : [];
      setRosters({ A: a, B: b });
      return;
    }
    Promise.all([teamId(m.teamA), teamId(m.teamB)].map((id) => (id ? api.get(`/teams/${id}`).then((r) => r.data.team.members as RosterMember[]) : Promise.resolve([]))))
      .then(([A, B]) => setRosters({ A, B }))
      .catch(() => undefined);
  }, [m, isTeam]);

  const level = scoreA !== "" && scoreA === scoreB;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const players = Object.entries(lines)
        .map(([user, l]) => ({
          user,
          side: l.side,
          stats: Object.fromEntries(Object.entries(l.stats).filter(([, v]) => v !== "").map(([k, v]) => [k, Number(v)])),
        }));
      await api.post(`/matches/${m.id}/reports`, {
        scoreA: Number(scoreA),
        scoreB: Number(scoreB),
        outcome: level ? tieWinner : undefined,
        detail,
        notes,
        players,
      });
      onDone();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="panel flex flex-col gap-6 p-6">
      <h2 className="font-display text-2xl font-bold text-ink">Report the result</h2>
      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
        <Input id="sa" type="number" min={0} label={sideName(m, "A")} required value={scoreA} onChange={(e) => setScoreA(e.target.value)} />
        <span className="pb-3 font-display text-2xl text-ink-faint">–</span>
        <Input id="sb" type="number" min={0} label={sideName(m, "B")} required value={scoreB} onChange={(e) => setScoreB(e.target.value)} />
      </div>
      {level && (
        <fieldset className="flex flex-wrap gap-3 text-sm">
          <legend className="mb-2 text-sm font-medium text-ink-muted">Level score. Who won?</legend>
          {(knockout ? (["A", "B"] as const) : (["draw", "A", "B"] as const)).map((o) => (
            <label key={o} className="flex items-center gap-2 rounded-full border border-border px-3 py-1.5">
              <input type="radio" name="tie" checked={tieWinner === o} onChange={() => setTieWinner(o)} />
              {o === "draw" ? "It was a draw" : `${sideName(m, o)} (tie-break)`}
            </label>
          ))}
        </fieldset>
      )}
      <Input id="detail" label="Score detail (optional)" maxLength={200} placeholder="e.g. 145/6 (20 ov) vs 120/9 (20 ov)" value={detail} onChange={(e) => setDetail(e.target.value)} />

      {page.statDefinitions.length > 0 && (
        <details className="rounded-xl border border-border p-4" open={!isTeam}>
          <summary className="cursor-pointer text-sm font-semibold text-ink">Player stats (optional)</summary>
          <p className="mt-2 text-xs text-ink-faint">Tick who played. Their stats count once the result is confirmed.</p>
          {(["A", "B"] as const).map((side) => (
            <div key={side} className="mt-4">
              <p className="text-sm font-semibold text-ink-muted">{sideName(m, side)}</p>
              <ul className="mt-2 flex flex-col gap-2">
                {rosters[side].map((p) => {
                  const on = !!lines[p.id];
                  return (
                    <li key={p.id} className="rounded-lg border border-border p-3">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={(e) =>
                            setLines((cur) => {
                              const next = { ...cur };
                              if (e.target.checked) next[p.id] = { side, stats: {} };
                              else delete next[p.id];
                              return next;
                            })
                          }
                        />
                        {p.name}
                      </label>
                      {on && (
                        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                          {page.statDefinitions.map((d) => (
                            <label key={d.key} className="flex flex-col gap-1 text-xs text-ink-faint">
                              {d.label}
                              <input
                                type="number"
                                min={0}
                                step="any"
                                className="h-9 rounded-lg border border-border bg-base-2 px-2 text-sm text-ink"
                                value={lines[p.id].stats[d.key] ?? ""}
                                onChange={(e) => setLines((cur) => ({ ...cur, [p.id]: { ...cur[p.id], stats: { ...cur[p.id].stats, [d.key]: e.target.value } } }))}
                              />
                            </label>
                          ))}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </details>
      )}

      <Textarea id="notes" label="Notes (optional)" maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} />
      {error && <FormError>{error}</FormError>}
      <p className="text-xs text-ink-faint">
        The other side confirms or disputes it. If they don’t answer within {page.autoVerifyHours} hours, it becomes official.
      </p>
      <Button type="submit" loading={busy} className="self-start">
        Submit result
      </Button>
    </form>
  );
}

function ReportCard({ r, page, canRespond, isMine, onDone }: { r: Report; page: MatchPage; canRespond: boolean; isMine: boolean; onDone: () => void }) {
  const m = page.match;
  const [disputing, setDisputing] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function call(path: string, body?: object) {
    setBusy(true);
    setError("");
    try {
      await api.post(`/matches/reports/${r.id}/${path}`, body ?? {});
      onDone();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  const label: Record<Report["status"], string> = {
    submitted: "Waiting for confirmation",
    disputed: "Disputed: staff are reviewing",
    verified: r.verifiedHow === "auto" ? "Official (not disputed in time)" : r.verifiedHow === "staff" ? "Official (decided by staff)" : "Official (confirmed)",
    rejected: "Voided by staff",
    withdrawn: "Withdrawn",
  };
  const names = new Map(r.players.map((p) => [p.user.id, p.user.name]));

  return (
    <article className="panel p-5">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <p className="num font-display text-2xl font-bold text-ink">
          {sideName(m, "A")} {r.scoreA} – {r.scoreB} {sideName(m, "B")}
        </p>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${r.status === "verified" ? "bg-success/10 text-success" : r.status === "disputed" ? "bg-danger/10 text-danger" : "bg-surface-2 text-ink-muted"}`}>
          {label[r.status]}
        </span>
      </header>
      <p className="mt-1 text-sm text-ink-faint">
        Reported by {r.submittedBy?.name ?? "someone"}
        {r.submittedFor === "organizer" ? " (organizer)" : ""} · {new Date(r.createdAt).toLocaleString()}
        {r.scoreA === r.scoreB && r.outcome !== "draw" ? ` · ${sideName(m, r.outcome)} won the tie-break` : ""}
      </p>
      {r.detail && <p className="mt-2 text-sm text-ink-muted">{r.detail}</p>}
      {r.players.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2 text-xs">
          {r.players.map((p) => (
            <li key={p.user.id} className="rounded-lg bg-surface-2 px-2.5 py-1 text-ink-muted">
              {names.get(p.user.id) ?? "Player"}:{" "}
              {Object.entries(p.stats)
                .map(([k, v]) => `${page.statDefinitions.find((d) => d.key === k)?.label ?? k} ${v}`)
                .join(", ") || "played"}
            </li>
          ))}
        </ul>
      )}
      {r.notes && <p className="mt-3 text-sm text-ink-muted">“{r.notes}”</p>}
      {r.response?.action === "disputed" && <p className="mt-3 text-sm text-danger">Disputed by {r.response.by?.name}: {r.response.reason}</p>}
      {r.review?.note && <p className="mt-3 text-sm text-ink-muted">Staff decision: {r.review.note}</p>}
      {error && (
        <div className="mt-3">
          <FormError>{error}</FormError>
        </div>
      )}
      {r.status === "submitted" && canRespond && !disputing && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" loading={busy} icon={<Check className="h-4 w-4" />} onClick={() => call("confirm")}>
            Confirm result
          </Button>
          <Button size="sm" variant="danger" icon={<Flag className="h-4 w-4" />} onClick={() => setDisputing(true)}>
            Dispute
          </Button>
        </div>
      )}
      {disputing && (
        <form
          className="mt-4 flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            call("dispute", { reason });
          }}
        >
          <Textarea id={`reason-${r.id}`} label="What's wrong with this result?" required minLength={5} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="flex gap-2">
            <Button size="sm" variant="danger" type="submit" loading={busy}>
              Send dispute
            </Button>
            <Button size="sm" variant="ghost" type="button" onClick={() => setDisputing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
      {r.status === "submitted" && isMine && (
        <div className="mt-4">
          <Button size="sm" variant="ghost" icon={<Undo2 className="h-4 w-4" />} loading={busy} onClick={() => call("withdraw")}>
            Withdraw and correct
          </Button>
        </div>
      )}
    </article>
  );
}

function SideLabel({ name, href, right = false }: { name: string; href: string | null; right?: boolean }) {
  const text = <span className="block truncate font-display text-3xl font-bold text-ink md:text-5xl">{name}</span>;
  return href ? (
    <Link to={href} className={`min-w-0 hover:opacity-80 ${right ? "text-right" : ""}`}>
      {text}
    </Link>
  ) : (
    <span className={`min-w-0 ${right ? "text-right" : ""}`}>{text}</span>
  );
}

export default function MatchDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { data, loading, error, reload } = useApi<MatchPage>(`/matches/${id}`);
  if (loading && !data) return <Loading label="Loading match…" />;
  if (error || !data) return <ErrorState message={error || "Match not found."} onRetry={reload} />;

  const m = data.match;
  const sport = getSportBySlug(m.sport ?? "");
  const authority = data.viewerAuthority;
  const live = data.reports.find((r) => r.status === "submitted" || r.status === "disputed");
  const canReport = authority.length > 0 && m.status === "pending";
  const canRespond = (r: Report) =>
    !!user && r.submittedBy?.id !== user.id && (r.submittedFor === "organizer" ? authority.includes("A") || authority.includes("B") : authority.includes(r.submittedFor === "A" ? "B" : "A") || authority.includes("organizer"));
  const final = m.status === "completed";
  const sideHref = (side: "A" | "B") => {
    const t = side === "A" ? m.teamA : m.teamB;
    const u = side === "A" ? m.userA : m.userB;
    if (t && typeof t === "object") return `/teams/${t.slug || t.id}`;
    if (u && typeof u === "object") return `/players/${u.username || u.id}`;
    return null;
  };

  return (
    <main className="flex-1">
      <section className="relative isolate overflow-hidden border-b border-border bg-base-2">
        {sport?.image && <img src={sport.image} alt="" aria-hidden className="absolute inset-0 -z-10 h-full w-full object-cover opacity-25" />}
        <div className="photo-veil-bottom absolute inset-0 -z-10" />
        <div className="container-x py-10 md:py-14">
          <Link to="/matches" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
            <ArrowLeft className="h-4 w-4" /> Matches
          </Link>
          <p className="mt-8 text-center text-sm text-ink-muted">
            {m.source === "tournament" && m.tournament && typeof m.tournament === "object" ? (
              <Link to={`/tournaments/${m.tournament.id}`} className="inline-flex items-center gap-1 hover:text-ink">
                <Trophy className="h-3.5 w-3.5" /> {m.tournament.name}, round {m.round}
              </Link>
            ) : (
              `${sport?.name ?? m.sport} · ${m.mode === "team" ? "team match" : "one on one"}`
            )}
          </p>
          <div className="mx-auto mt-6 grid max-w-4xl grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4">
            <SideLabel name={sideName(m, "A")} href={sideHref("A")} />
            <span className="num rounded-2xl border border-border bg-base px-5 py-3 font-display text-3xl font-bold text-ink md:text-5xl">
              {final && m.scoreA !== null ? `${m.scoreA}–${m.scoreB}` : "vs"}
            </span>
            <SideLabel name={sideName(m, "B")} href={sideHref("B")} right />
          </div>
          <div className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-ink-muted">
            {m.date && (
              <span className="flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4" /> {new Date(`${m.date}T00:00:00`).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
                {m.startTime && `, ${m.startTime}`}
              </span>
            )}
            {(m.ground || m.venueNote) && (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4" /> {m.ground?.name ?? m.venueNote}
              </span>
            )}
            {final && (
              <span className="flex items-center gap-1.5 text-success">
                <ShieldCheck className="h-4 w-4" /> Official result
              </span>
            )}
          </div>
        </div>
      </section>

      <div className="container-x grid gap-10 py-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <section className="flex flex-col gap-4">
          <h2 className="font-display text-3xl font-bold text-ink">Result</h2>
          {data.reports.length === 0 && <p className="text-ink-muted">{m.status === "cancelled" ? "This match was called off." : "No result reported yet."}</p>}
          {data.reports.map((r) => (
            <ReportCard key={r.id} r={r} page={data} canRespond={canRespond(r)} isMine={r.submittedBy?.id === user?.id} onDone={reload} />
          ))}
        </section>
        <aside>
          {canReport && !live ? (
            <ReportForm page={data} onDone={reload} />
          ) : (
            <div className="panel p-6 text-sm text-ink-muted">
              {final
                ? "This result is official and counts in both sides’ records."
                : live
                  ? "A result is waiting for the other side. Records change only once it’s confirmed."
                  : authority.length
                    ? "You can report the result once the match is played."
                    : "The two sides (owner or captain) report the result; the other side confirms it."}
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}

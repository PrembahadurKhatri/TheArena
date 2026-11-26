import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, Check, ClipboardList, Crown, MapPin, Play, Send, Trophy, X } from "lucide-react";
import api, { assetUrl } from "@/api/axios";
import { useAuth } from "@/context/AuthContext";
import { useApi } from "@/hooks/useApi";
import { apiError, teamPath } from "@/types";
import type { MatchRow, TeamSummary } from "@/types";
import { getSportBySlug } from "@/data/sports";
import { Loading, ErrorState, EmptyState } from "@/components/ui/StateBlock";
import Button, { buttonClass } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/Badge";
import { FormError } from "@/components/page/AuthShell";
import PageHero from "@/components/page/PageHero";
import { MatchCard } from "./Matches";

interface Registration {
  id: string;
  team: TeamSummary | null;
  status: "requested" | "approved" | "rejected" | "withdrawn";
  rosterSize: number;
  eligibility: { ok: boolean; reasons: string[] };
  requestedBy?: { id: string; name: string } | null;
  note?: string | null;
}

interface TableRow {
  team: { id: string; name: string; slug?: string | null };
  played: number;
  won: number;
  drawn: number;
  lost: number;
  scoreFor: number;
  scoreAgainst: number;
  diff: number;
  points: number;
}

interface TournamentPage {
  tournament: {
    id: string;
    name: string;
    slug: string | null;
    sport: string;
    status: string;
    format: string;
    minTeams: number;
    maxTeams: number;
    teamsCount: number;
    startDate: string | null;
    endDate: string | null;
    registrationClosesAt: string | null;
    entryFee: number;
    poster: string | null;
    organizer: { id: string; name: string };
    province: string;
    district: string | null;
    location?: string;
    description?: string;
    prizes: string | null;
    rules: string | null;
    winner: { id: string; name: string; slug: string | null } | null;
    review: { decision: string; note: string | null } | null;
    cancelReason: string | null;
    matches: MatchRow[];
  };
  registrations: Registration[];
  eligibility: { approvedTeams: number; distinctOwners: number; needed: number; readyForReview: boolean };
  standings: { group: string; rows: TableRow[] }[];
  isOrganizer: boolean;
  viewerTeams: { id: string; name: string; registration: string | null }[];
}

const FORMAT_LABEL: Record<string, string> = {
  knockout: "Knockout",
  round_robin: "Round robin",
  league: "League (home & away)",
  group_stage: "Group stage",
  group_knockout: "Groups + knockout",
};

const STATUS_LABEL: Record<string, string> = {
  open: "taking teams",
  under_review: "under_review",
  approved: "approved",
  rejected: "rejected",
  ongoing: "ongoing",
  completed: "completed",
  cancelled: "cancelled",
};

type Tab = "overview" | "teams" | "fixtures" | "table";

function useAction(reload: () => void) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  async function run(key: string, fn: () => Promise<unknown>) {
    setBusy(key);
    setError("");
    try {
      await fn();
      reload();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(null);
    }
  }
  return { busy, error, run };
}

function OrganizerPanel({ page, reload }: { page: TournamentPage; reload: () => void }) {
  const t = page.tournament;
  const e = page.eligibility;
  const { busy, error, run } = useAction(reload);
  const pct = Math.min(100, Math.round((e.approvedTeams / e.needed) * 100));
  return (
    <section className="panel flex flex-col gap-4 p-6">
      <h2 className="font-display text-2xl font-bold text-ink">Organizer</h2>
      {error && <FormError>{error}</FormError>}
      {(t.status === "open" || t.status === "rejected") && (
        <>
          {t.status === "rejected" && t.review?.note && (
            <p className="rounded-xl border border-danger/25 bg-danger/10 p-3 text-sm text-danger">Not approved: {t.review.note}. Edit the tournament, then submit again.</p>
          )}
          <div>
            <div className="flex justify-between text-sm">
              <span className="text-ink-muted">Eligible teams approved</span>
              <span className="num font-semibold text-ink">
                {e.approvedTeams} / {e.needed}
              </span>
            </div>
            <span className="mt-2 block h-2 overflow-hidden rounded-full bg-base-2">
              <span className="block h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
            </span>
            <p className="mt-2 text-xs text-ink-faint">
              Teams must be run by at least two different people besides you ({e.distinctOwners} so far). Four eligible teams make the
              tournament eligible for review; they don’t start it.
            </p>
          </div>
          <Button loading={busy === "submit"} disabled={!e.readyForReview} icon={<Send className="h-4 w-4" />} onClick={() => run("submit", () => api.post(`/tournaments/${t.id}/submit-review`))}>
            Submit for approval
          </Button>
        </>
      )}
      {t.status === "under_review" && <p className="text-sm text-ink-muted">Waiting for The Arena’s review. Teams can still ask to join.</p>}
      {t.status === "approved" && (
        <>
          <p className="text-sm text-ink-muted">Approved. Starting closes registration and generates the fixtures for {page.eligibility.approvedTeams} teams.</p>
          <Button
            loading={busy === "start"}
            icon={<Play className="h-4 w-4" />}
            onClick={() => window.confirm("Close registration and generate fixtures?") && run("start", () => api.post(`/tournaments/${t.id}/start`))}
          >
            Start tournament
          </Button>
        </>
      )}
      {t.status === "ongoing" && <p className="text-sm text-ink-muted">Report results from each match page; they count once a team confirms them.</p>}
      {!["completed", "cancelled"].includes(t.status) && (
        <Button
          variant="ghost"
          loading={busy === "cancel"}
          onClick={() => {
            const reason = window.prompt("Why are you cancelling? Teams will see this.");
            if (reason) run("cancel", () => api.post(`/tournaments/${t.id}/cancel`, { reason }));
          }}
        >
          Cancel tournament
        </Button>
      )}
    </section>
  );
}

function TeamsTab({ page, reload }: { page: TournamentPage; reload: () => void }) {
  const t = page.tournament;
  const { user } = useAuth();
  const { busy, error, run } = useAction(reload);
  const [teamId, setTeamId] = useState("");
  const approved = page.registrations.filter((r) => r.status === "approved");
  const requests = page.registrations.filter((r) => r.status === "requested");
  const canRequest = ["open", "under_review", "approved", "rejected"].includes(t.status);
  const available = page.viewerTeams.filter((x) => !x.registration || x.registration === "withdrawn" || x.registration === "rejected");

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <section>
        <h2 className="font-display text-2xl font-bold text-ink">
          Teams <span className="num text-ink-faint">{approved.length}/{t.maxTeams}</span>
        </h2>
        {error && (
          <div className="mt-4">
            <FormError>{error}</FormError>
          </div>
        )}
        {approved.length === 0 ? (
          <p className="mt-4 text-sm text-ink-faint">No teams approved yet.</p>
        ) : (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {approved.map((r) =>
              r.team ? (
                <li key={r.id} className="panel flex items-center gap-3 p-4">
                  <Link to={teamPath(r.team)} className="min-w-0 flex-1 truncate font-semibold text-ink hover:text-accent">
                    {r.team.name}
                  </Link>
                  <span className="text-xs text-ink-faint">{r.rosterSize} players</span>
                </li>
              ) : null
            )}
          </ul>
        )}

        {page.isOrganizer && requests.length > 0 && (
          <>
            <h3 className="mt-10 font-display text-xl font-semibold text-ink">Requests to join</h3>
            <ul className="panel mt-4 divide-y divide-border">
              {requests.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-3 p-4">
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-ink">{r.team?.name}</span>
                    <span className="block text-xs text-ink-faint">
                      {r.rosterSize} players · by {r.requestedBy?.name ?? "?"}
                      {r.note ? ` · “${r.note}”` : ""}
                    </span>
                    {!r.eligibility.ok && <span className="block text-xs text-danger">{r.eligibility.reasons.join("; ")}</span>}
                  </span>
                  <Button size="sm" loading={busy === `a-${r.id}`} icon={<Check className="h-4 w-4" />} onClick={() => run(`a-${r.id}`, () => api.patch(`/tournaments/${t.id}/registrations/${r.id}`, { action: "approve" }))}>
                    Approve
                  </Button>
                  <Button size="sm" variant="secondary" loading={busy === `r-${r.id}`} icon={<X className="h-4 w-4" />} onClick={() => run(`r-${r.id}`, () => api.patch(`/tournaments/${t.id}/registrations/${r.id}`, { action: "reject" }))}>
                    Reject
                  </Button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <aside>
        {canRequest && user && (
          <div className="panel flex flex-col gap-3 p-5">
            <h3 className="font-display text-xl font-semibold text-ink">Enter your team</h3>
            {page.viewerTeams.filter((x) => x.registration === "requested" || x.registration === "approved").map((x) => (
              <p key={x.id} className="text-sm text-ink-muted">
                {x.name}: <StatusBadge status={x.registration!} />
              </p>
            ))}
            {available.length ? (
              <>
                <select className="h-11 rounded-xl border border-border bg-base-2 px-3 text-sm" value={teamId} onChange={(e) => setTeamId(e.target.value)} aria-label="Team">
                  <option value="">Choose a team you run</option>
                  {available.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
                <Button disabled={!teamId} loading={busy === "req"} onClick={() => run("req", () => api.post(`/tournaments/${t.id}/registrations`, { teamId }))}>
                  Ask to join
                </Button>
              </>
            ) : (
              page.viewerTeams.length === 0 && (
                <p className="text-sm text-ink-muted">
                  You need a {getSportBySlug(t.sport)?.name ?? t.sport} team you own or captain.{" "}
                  <Link to="/teams/create" className="text-accent hover:underline">
                    Create one
                  </Link>
                </p>
              )
            )}
            {t.entryFee > 0 && <p className="text-xs text-ink-faint">Entry fee Rs {t.entryFee}, paid to the organizer.</p>}
          </div>
        )}
        {canRequest && !user && (
          <Link to="/login" state={{ from: `/tournaments/${t.slug || t.id}` }} className={buttonClass({ fullWidth: true })}>
            Log in to enter a team
          </Link>
        )}
      </aside>
    </div>
  );
}

function FixturesTab({ page }: { page: TournamentPage }) {
  const matches = page.tournament.matches;
  if (!matches.length) return <EmptyState title="No fixtures yet" message="Fixtures are generated when the organizer starts the tournament." />;
  const sections = new Map<string, MatchRow[]>();
  for (const m of matches) {
    const key = m.stage === "knockout" ? `Knockout · round ${m.round}` : m.stage === "group" ? `Group ${m.group} · round ${m.round}` : `Round ${m.round}`;
    sections.set(key, [...(sections.get(key) ?? []), m]);
  }
  return (
    <div className="flex flex-col gap-10">
      {[...sections.entries()].map(([title, list]) => (
        <section key={title}>
          <h3 className="font-display text-xl font-semibold text-ink">{title}</h3>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {list.map((m) =>
              (!m.teamA || !m.teamB) && m.status === "completed" ? (
                <div key={m.id} className="rounded-2xl border border-dashed border-border p-5 text-sm text-ink-faint">
                  Bye: {(typeof m.teamA === "object" && m.teamA?.name) || (typeof m.teamB === "object" && m.teamB?.name) || "team"} goes through
                </div>
              ) : (
                <MatchCard key={m.id} m={m} />
              )
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

function TableTab({ page }: { page: TournamentPage }) {
  if (!page.standings.length) return <EmptyState title="No table for this format" message="Knockout tournaments are followed on the fixtures tab." />;
  return (
    <div className="flex flex-col gap-10">
      {page.standings.map((g) => (
        <section key={g.group}>
          {page.standings.length > 1 && <h3 className="font-display text-xl font-semibold text-ink">Group {g.group}</h3>}
          <div className="mt-4 overflow-x-auto rounded-2xl border border-border">
            <table className="w-full min-w-[34rem] text-sm">
              <thead className="bg-surface text-xs uppercase tracking-wide text-ink-faint">
                <tr>
                  {["#", "Team", "P", "W", "D", "L", "For", "Agst", "Diff", "Pts"].map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {g.rows.map((r, i) => (
                  <tr key={r.team.id}>
                    <td className="num px-3 py-2 text-ink-faint">{i + 1}</td>
                    <td className="px-3 py-2 font-semibold text-ink">
                      <Link to={`/teams/${r.team.slug || r.team.id}`} className="hover:text-accent">
                        {r.team.name}
                      </Link>
                    </td>
                    {[r.played, r.won, r.drawn, r.lost, r.scoreFor, r.scoreAgainst, r.diff].map((v, k) => (
                      <td key={k} className="num px-3 py-2 text-ink-muted">
                        {v}
                      </td>
                    ))}
                    <td className="num px-3 py-2 font-bold text-ink">{r.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
      <p className="text-xs text-ink-faint">Only verified results count. Ties are split by score difference, then score for.</p>
    </div>
  );
}

export default function TournamentDetail() {
  const { id } = useParams<{ id: string }>();
  const [params, setParams] = useSearchParams();
  const { data, loading, error, reload } = useApi<TournamentPage>(`/tournaments/${id}`);
  const tab = (params.get("tab") as Tab) || "overview";

  if (loading && !data) return <Loading label="Loading tournament…" />;
  if (error || !data) return <ErrorState message={error || "Tournament not found."} onRetry={reload} />;
  const t = data.tournament;
  const sport = getSportBySlug(t.sport);
  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "teams", label: `Teams (${t.teamsCount})` },
    { key: "fixtures", label: "Fixtures" },
    ...(data.standings.length ? [{ key: "table" as Tab, label: "Table" }] : []),
  ];

  return (
    <main className="flex-1">
      <PageHero
        image={t.poster ? assetUrl(t.poster) : sport?.image}
        above={
          <Link to="/tournaments" className="inline-flex items-center gap-1.5 hover:text-ink">
            <ArrowLeft className="h-4 w-4" /> Tournaments
          </Link>
        }
        title={t.name}
        lead={
          <span className="flex flex-wrap items-center gap-3">
            <StatusBadge status={STATUS_LABEL[t.status] ?? t.status} />
            <span>
              {sport?.name ?? t.sport} · {FORMAT_LABEL[t.format] ?? t.format} · by {t.organizer?.name}
            </span>
          </span>
        }
      >
        <nav className="flex gap-1 overflow-x-auto" aria-label="Tournament sections">
          {tabs.map((x) => (
            <button
              key={x.key}
              onClick={() => setParams({ tab: x.key })}
              aria-current={tab === x.key ? "page" : undefined}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${tab === x.key ? "bg-accent text-white" : "bg-surface text-ink-muted hover:text-ink"}`}
            >
              {x.label}
            </button>
          ))}
        </nav>
      </PageHero>

      <div className="container-x py-12">
        {t.status === "completed" && t.winner && (
          <p className="mb-8 flex items-center gap-3 rounded-2xl border border-premium/30 bg-premium-soft p-5 font-display text-2xl font-bold text-premium">
            <Crown className="h-6 w-6" /> Champions:{" "}
            <Link to={`/teams/${t.winner.slug || t.winner.id}`} className="underline-offset-4 hover:underline">
              {t.winner.name}
            </Link>
          </p>
        )}
        {t.status === "cancelled" && <p className="mb-8 rounded-2xl border border-danger/25 bg-danger/10 p-4 text-sm text-danger">Cancelled{t.cancelReason ? `: ${t.cancelReason}` : ""}.</p>}

        {tab === "overview" && (
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <section className="flex flex-col gap-8">
              <dl className="panel grid gap-4 p-6 sm:grid-cols-2">
                <div className="flex gap-3">
                  <CalendarDays className="h-5 w-5 text-accent" />
                  <div>
                    <dt className="text-sm text-ink-faint">Dates</dt>
                    <dd className="font-semibold text-ink">
                      {t.startDate ? new Date(t.startDate).toLocaleDateString() : "TBD"}
                      {t.endDate ? ` – ${new Date(t.endDate).toLocaleDateString()}` : ""}
                    </dd>
                    {t.registrationClosesAt && <dd className="text-xs text-ink-faint">Registration closes {new Date(t.registrationClosesAt).toLocaleDateString()}</dd>}
                  </div>
                </div>
                <div className="flex gap-3">
                  <MapPin className="h-5 w-5 text-accent" />
                  <div>
                    <dt className="text-sm text-ink-faint">Where</dt>
                    <dd className="font-semibold text-ink">{[t.location, t.district, t.province].filter(Boolean).join(", ")}</dd>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Trophy className="h-5 w-5 text-accent" />
                  <div>
                    <dt className="text-sm text-ink-faint">Prizes</dt>
                    <dd className="font-semibold text-ink">{t.prizes || "Not listed"}</dd>
                  </div>
                </div>
                <div className="flex gap-3">
                  <ClipboardList className="h-5 w-5 text-accent" />
                  <div>
                    <dt className="text-sm text-ink-faint">Teams</dt>
                    <dd className="font-semibold text-ink">
                      {t.minTeams}–{t.maxTeams} · entry {t.entryFee ? `Rs ${t.entryFee}` : "free"}
                    </dd>
                  </div>
                </div>
              </dl>
              {t.description && <p className="whitespace-pre-line text-lg text-ink-muted">{t.description}</p>}
              {t.rules && (
                <section>
                  <h2 className="font-display text-2xl font-bold text-ink">Rules</h2>
                  <p className="mt-3 whitespace-pre-line text-ink-muted">{t.rules}</p>
                </section>
              )}
            </section>
            <aside className="flex flex-col gap-6">
              {data.isOrganizer && <OrganizerPanel page={data} reload={reload} />}
              {!data.isOrganizer && ["open", "under_review", "approved"].includes(t.status) && (
                <button onClick={() => setParams({ tab: "teams" })} className={buttonClass({ fullWidth: true, size: "lg" })}>
                  Enter a team
                </button>
              )}
            </aside>
          </div>
        )}
        {tab === "teams" && <TeamsTab page={data} reload={reload} />}
        {tab === "fixtures" && <FixturesTab page={data} />}
        {tab === "table" && <TableTab page={data} />}
      </div>
    </main>
  );
}

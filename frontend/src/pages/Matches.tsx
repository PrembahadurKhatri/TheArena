import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CalendarDays, MapPin, Swords, Trophy } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useApi } from "@/hooks/useApi";
import { SPORT_FILTER_OPTIONS, getSportBySlug } from "@/data/sports";
import { Loading, ErrorState, EmptyState } from "@/components/ui/StateBlock";
import CustomSelect from "@/components/ui/CustomSelect";
import PageHero from "@/components/page/PageHero";
import Button, { buttonClass } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/Badge";
import type { MatchRow } from "@/types";

export function sideName(m: MatchRow, side: "A" | "B") {
  const team = side === "A" ? m.teamA : m.teamB;
  const user = side === "A" ? m.userA : m.userB;
  if (team && typeof team === "object") return team.name;
  if (user && typeof user === "object") return user.name;
  return "TBD";
}

const MATCH_STATUS: Record<string, string> = {
  pending: "upcoming",
  reported: "awaiting confirmation",
  disputed: "disputed",
  completed: "final",
  cancelled: "cancelled",
};

export function MatchCard({ m }: { m: MatchRow }) {
  const sport = getSportBySlug(m.sport ?? "");
  const final = m.status === "completed";
  return (
    <Link to={`/matches/${m.id}`} className="panel card-lift flex flex-col gap-4 p-5">
      <div className="flex items-center justify-between gap-3 text-xs text-ink-faint">
        <span className="flex items-center gap-1.5">
          {m.source === "tournament" ? <Trophy className="h-3.5 w-3.5" /> : <Swords className="h-3.5 w-3.5" />}
          {m.source === "tournament" && m.tournament && typeof m.tournament === "object" ? m.tournament.name : sport?.name ?? m.sport}
        </span>
        <StatusBadge status={MATCH_STATUS[m.status] ?? m.status} />
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
        <span className={`truncate font-display text-xl font-bold ${final && !m.isDraw && m.scoreA !== null && m.scoreA > (m.scoreB ?? 0) ? "text-ink" : "text-ink-muted"}`}>{sideName(m, "A")}</span>
        <span className="num rounded-lg bg-surface-2 px-3 py-1 font-display text-xl font-bold text-ink">
          {final && m.scoreA !== null ? `${m.scoreA} – ${m.scoreB}` : "vs"}
        </span>
        <span className={`truncate text-right font-display text-xl font-bold ${final && !m.isDraw && m.scoreB !== null && m.scoreB > (m.scoreA ?? 0) ? "text-ink" : "text-ink-muted"}`}>{sideName(m, "B")}</span>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-faint">
        {m.date && (
          <span className="flex items-center gap-1">
            <CalendarDays className="h-3.5 w-3.5" />
            {new Date(`${m.date}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}
            {m.startTime && <span className="num">, {m.startTime}</span>}
          </span>
        )}
        {(m.ground || m.venueNote) && (
          <span className="flex min-w-0 items-center gap-1">
            <MapPin className="h-3.5 w-3.5" /> <span className="truncate">{m.ground?.name ?? m.venueNote}</span>
          </span>
        )}
      </div>
    </Link>
  );
}

type Tab = "upcoming" | "results" | "mine";

export default function Matches() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const initial = params.get("tab");
  const [tab, setTab] = useState<Tab>(initial === "mine" || initial === "results" ? initial : "upcoming");
  const [sport, setSport] = useState("");
  const [page, setPage] = useState(1);
  const url = tab === "mine" ? "/my/matches" : "/matches";
  const { data, loading, error, reload } = useApi<{ matches: MatchRow[]; pages: number; total: number }>(user || tab !== "mine" ? url : null, {
    status: tab === "mine" ? undefined : tab,
    sport: tab === "mine" ? undefined : sport,
    page,
  });

  const tabs: { key: Tab; label: string }[] = [
    { key: "upcoming", label: "Upcoming" },
    { key: "results", label: "Results" },
    ...(user ? [{ key: "mine" as Tab, label: "My matches" }] : []),
  ];

  return (
    <main className="flex-1">
      <PageHero
        title="Matches"
        lead="Fixtures from accepted challenges and tournaments, and results confirmed by both sides."
        image="/sports/futsal.avif"
        actions={
          <Link to="/challenges/new" className={buttonClass({ size: "lg" })}>
            <Swords className="h-4 w-4" /> Arrange a match
          </Link>
        }
      >
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1 rounded-full border border-border bg-surface p-1" role="tablist">
            {tabs.map((t) => (
              <button
                key={t.key}
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => {
                  setTab(t.key);
                  setPage(1);
                }}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold ${tab === t.key ? "bg-accent text-white" : "text-ink-muted hover:text-ink"}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          {tab !== "mine" && (
            <CustomSelect
              value={sport}
              onChange={(v) => {
                setSport(v);
                setPage(1);
              }}
              options={SPORT_FILTER_OPTIONS}
              className="sm:w-56"
            />
          )}
        </div>
      </PageHero>

      <div className="container-x py-12">
        {loading && <Loading label="Loading matches…" />}
        {!loading && error && <ErrorState message={error} onRetry={reload} />}
        {!loading && !error && data?.matches.length === 0 && (
          <EmptyState
            title={tab === "results" ? "No results yet" : "No matches here yet"}
            message={tab === "results" ? "Results appear once both sides confirm the score." : "Challenge a player or team to get one on the calendar."}
          />
        )}
        {!loading && !error && !!data?.matches.length && (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {data.matches.map((m) => (
                <MatchCard key={m.id} m={m} />
              ))}
            </div>
            {data.pages > 1 && (
              <div className="mt-10 flex items-center justify-center gap-3">
                <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <span className="num text-sm text-ink-faint">
                  {page} / {data.pages}
                </span>
                <Button variant="secondary" size="sm" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

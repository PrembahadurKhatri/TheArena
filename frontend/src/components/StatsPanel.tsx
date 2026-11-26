import { Link } from "react-router-dom";
import { Crown } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { getSportBySlug } from "@/data/sports";
import type { MatchRow } from "@/types";
import { MatchCard } from "@/pages/Matches";

interface RecordRow {
  sport: string;
  matches: number;
  wins: number;
  losses: number;
  draws: number;
  winPct: number;
  scoreFor: number;
  scoreAgainst: number;
  tournamentsPlayed?: number;
  tournamentsWon?: number;
  detailed?: boolean;
  totals?: { key: string; label: string; value: number }[];
  derived?: Record<string, number | null>;
}

const DERIVED_LABELS: Record<string, string> = {
  batting_average: "Batting average",
  strike_rate: "Strike rate",
  economy: "Economy",
  goals_per_match: "Goals per match",
  points_per_game: "Points per game",
  rebounds_per_game: "Rebounds per game",
  points_per_match: "Points per match",
};

/**
 * Verified records (and, for players, sport stats) plus recent matches.
 * `kind` picks the API: /teams/:id/... or /players/:id/...
 */
export default function StatsPanel({ kind, id }: { kind: "teams" | "players"; id: string }) {
  const stats = useApi<{ records: RecordRow[]; currentStreak: string | null; detailedStatsAvailable?: boolean }>(`/${kind}/${id}/stats`);
  const matches = useApi<{ matches: MatchRow[] }>(`/${kind}/${id}/matches`, { limit: 6 });
  const records = stats.data?.records ?? [];
  const lockedDetail = kind === "players" && records.length > 0 && stats.data?.detailedStatsAvailable === false;

  return (
    <section className="container-x pb-16">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-display text-3xl font-bold text-ink">Record</h2>
        {stats.data?.currentStreak && <span className="num rounded-full bg-surface-2 px-3 py-1 text-sm font-semibold text-ink">Current streak {stats.data.currentStreak}</span>}
      </div>
      <p className="mt-1 text-sm text-ink-faint">From results confirmed by both sides only.</p>

      {records.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-border bg-base-2 p-6 text-sm text-ink-muted">No verified results yet.</p>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {records.map((r) => (
            <article key={r.sport} className="panel p-5">
              <p className="font-display text-xl font-semibold text-ink">{getSportBySlug(r.sport)?.name ?? r.sport}</p>
              <dl className="mt-4 grid grid-cols-4 gap-3 text-center">
                {[
                  ["Played", r.matches],
                  ["Won", r.wins],
                  ["Lost", r.losses],
                  ["Drawn", r.draws],
                ].map(([k, v]) => (
                  <div key={k as string} className="rounded-xl bg-base-2 py-3">
                    <dd className="num font-display text-2xl font-bold text-ink">{v}</dd>
                    <dt className="text-xs text-ink-faint">{k}</dt>
                  </div>
                ))}
              </dl>
              <p className="mt-3 text-sm text-ink-muted">
                Win rate <span className="num font-semibold text-ink">{r.winPct}%</span>
                {r.tournamentsPlayed ? (
                  <>
                    {" "}
                    · Tournaments <span className="num">{r.tournamentsPlayed}</span>, won <span className="num">{r.tournamentsWon ?? 0}</span>
                  </>
                ) : null}
              </p>
              {r.detailed && r.totals && r.totals.some((t) => t.value) && (
                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 border-t border-border pt-4 text-sm sm:grid-cols-3">
                  {r.totals
                    .filter((t) => t.value)
                    .map((t) => (
                      <div key={t.key} className="flex justify-between gap-2">
                        <dt className="text-ink-faint">{t.label}</dt>
                        <dd className="num font-semibold text-ink">{t.value}</dd>
                      </div>
                    ))}
                  {Object.entries(r.derived ?? {})
                    .filter(([, v]) => v !== null)
                    .map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-2">
                        <dt className="text-ink-faint">{DERIVED_LABELS[k] ?? k}</dt>
                        <dd className="num font-semibold text-accent">{v}</dd>
                      </div>
                    ))}
                </dl>
              )}
            </article>
          ))}
        </div>
      )}
      {lockedDetail && (
        <p className="mt-4 inline-flex items-center gap-1.5 text-sm text-premium">
          <Crown className="h-4 w-4" /> Detailed sport stats are shown on Premium profiles.{" "}
          <Link to="/membership" className="font-semibold underline">
            Learn more
          </Link>
        </p>
      )}

      {!!matches.data?.matches.length && (
        <>
          <h2 className="mt-12 font-display text-3xl font-bold text-ink">Recent matches</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {matches.data.matches.map((m) => (
              <MatchCard key={m.id} m={m} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

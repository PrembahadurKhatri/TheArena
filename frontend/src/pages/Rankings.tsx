import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Crown, Medal, Shield, User } from "lucide-react";
import api from "@/api/axios";
import { SPORTS, getSportBySlug } from "@/data/sports";
import type { RankingEntry, PlayerSummary, TeamSummary } from "@/types";
import { apiError } from "@/types";
import Reveal from "@/components/Reveal";
import { Loading, ErrorState, EmptyState } from "@/components/ui/StateBlock";
import CustomSelect from "@/components/ui/CustomSelect";

const SPORT_OPTIONS = SPORTS.map((s) => ({ value: s.slug, label: s.name, icon: s.emoji, color: s.color }));

type Tab = "players" | "teams";

const medalColor = (rank: number) => (rank === 1 ? "#F5A623" : rank === 2 ? "#C0C0C0" : rank === 3 ? "#CD7F32" : null);

export default function Rankings() {
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>("players");
  const sport = params.get("sport") ?? SPORTS[0].slug;
  const [rankings, setRankings] = useState<RankingEntry<unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    api
      .get(`/rankings/${tab}`, { params: { sport } })
      .then(({ data }) => alive && setRankings(data.rankings ?? []))
      .catch((err) => alive && setError(apiError(err, "Could not load rankings.")))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [tab, sport]);

  function updateSport(value: string) {
    const next = new URLSearchParams(params);
    next.set("sport", value);
    setParams(next);
  }

  return (
    <main className="flex-1 py-16">
      <div className="container-x">
        <span className="eyebrow">Rankings</span>
        <h1 className="mt-4 font-display text-4xl font-bold text-ink">Leaderboards</h1>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
          <div className="inline-flex rounded-full border border-border bg-surface p-1">
            {(["players", "teams"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-full px-5 py-2 text-sm font-semibold capitalize transition-colors ${
                  tab === t ? "bg-accent text-white" : "text-ink-muted hover:text-ink"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <CustomSelect value={sport} onChange={updateSport} options={SPORT_OPTIONS} className="sm:w-56" />
        </div>

        <div className="mt-8">
          {loading && <Loading label="Loading rankings..." />}
          {!loading && error && <ErrorState message={error} />}
          {!loading && !error && rankings.length === 0 && (
            <EmptyState
              title="No rankings yet"
              message={`Rankings for ${getSportBySlug(sport)?.name ?? sport} will appear once tournament matches are completed.`}
            />
          )}
          {!loading && !error && rankings.length > 0 && (
            <Reveal>
              <div className="glass overflow-hidden rounded-2xl">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-widest text-ink-faint">
                      <th className="px-5 py-3">Rank</th>
                      <th className="px-5 py-3">{tab === "players" ? "Player" : "Team"}</th>
                      <th className="px-5 py-3">Points</th>
                      <th className="px-5 py-3">W</th>
                      <th className="px-5 py-3">L</th>
                      <th className="px-5 py-3">D</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankings.map((r) => {
                      const medal = medalColor(r.rank);
                      const entity = tab === "players" ? (r.player as PlayerSummary) : (r.team as TeamSummary);
                      const linkTo = tab === "players" ? `/players/${entity?.id}` : `/teams/${entity?.id}`;
                      return (
                        <tr key={`${r.rank}-${entity?.id}`} className="border-b border-border last:border-0">
                          <td className="px-5 py-3">
                            <span
                              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold"
                              style={{
                                background: medal ? `${medal}22` : "rgb(var(--c-surface-2))",
                                color: medal ?? "rgb(var(--c-ink-muted))",
                              }}
                            >
                              {medal ? <Medal className="h-3.5 w-3.5" /> : r.rank}
                            </span>
                          </td>
                          <td className="px-5 py-3">
                            <Link to={linkTo} className="flex items-center gap-2.5 font-medium text-ink hover:text-accent">
                              {tab === "players" ? (
                                (entity as PlayerSummary)?.photo ? (
                                  <img
                                    src={(entity as PlayerSummary).photo!}
                                    alt=""
                                    className="h-7 w-7 rounded-full object-cover"
                                  />
                                ) : (
                                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-soft text-accent">
                                    <User className="h-3.5 w-3.5" />
                                  </span>
                                )
                              ) : (entity as TeamSummary)?.logo ? (
                                <img
                                  src={(entity as TeamSummary).logo!}
                                  alt=""
                                  className="h-7 w-7 rounded-lg object-cover"
                                />
                              ) : (
                                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-soft text-accent">
                                  <Shield className="h-3.5 w-3.5" />
                                </span>
                              )}
                              {entity?.name ?? "—"}
                              {tab === "players" && (entity as PlayerSummary)?.isPremium && (
                                <Crown className="h-3.5 w-3.5 text-premium" />
                              )}
                            </Link>
                          </td>
                          <td className="px-5 py-3 font-display font-semibold text-ink">{r.points}</td>
                          <td className="px-5 py-3 text-emerald-400">{r.wins}</td>
                          <td className="px-5 py-3 text-red-400">{r.losses}</td>
                          <td className="px-5 py-3 text-ink-muted">{r.draws}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Reveal>
          )}
        </div>
      </div>
    </main>
  );
}

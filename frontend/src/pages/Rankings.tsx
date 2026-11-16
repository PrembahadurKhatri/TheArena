import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Crown, Shield } from "lucide-react";
import api, { assetUrl } from "@/api/axios";
import { SPORTS, getSportBySlug } from "@/data/sports";
import type { RankingEntry, PlayerSummary, TeamSummary } from "@/types";
import { apiError } from "@/types";
import { Loading, ErrorState, EmptyState } from "@/components/ui/StateBlock";
import { Initials } from "@/components/ui/SportMark";
import PageHero, { Segmented } from "@/components/page/PageHero";

type Tab = "players" | "teams";

const MEDAL_VAR: Record<number, string> = { 1: "--c-medal-gold", 2: "--c-medal-silver", 3: "--c-medal-bronze" };

type Entity = (PlayerSummary | TeamSummary) & { photo?: string | null; logo?: string | null; isPremium?: boolean };

function entityOf(r: RankingEntry<unknown>, tab: Tab) {
  return (tab === "players" ? r.player : r.team) as Entity | undefined;
}

function EntityImage({ entity, tab, className }: { entity?: Entity; tab: Tab; className: string }) {
  const src = tab === "players" ? entity?.photo : entity?.logo;
  if (src) return <img src={assetUrl(src)} alt="" className={`${className} object-cover`} />;
  if (tab === "players") return <Initials name={entity?.name ?? "?"} className={className} />;
  return (
    <span className={`${className} flex items-center justify-center bg-accent-soft text-accent`}>
      <Shield className="h-1/2 w-1/2" />
    </span>
  );
}

// The top three, stood on a podium: second, first, third.
function Podium({ rows, tab }: { rows: RankingEntry<unknown>[]; tab: Tab }) {
  const order = [rows[1], rows[0], rows[2]];
  const heights = ["h-24", "h-32", "h-20"];
  return (
    <div className="grid grid-cols-3 items-end gap-3 sm:gap-5">
      {order.map((r, i) => {
        if (!r) return <div key={i} />;
        const entity = entityOf(r, tab);
        const linkTo = tab === "players" ? `/players/${entity?.id}` : `/teams/${entity?.id}`;
        const medal = MEDAL_VAR[r.rank];
        return (
          <Link key={`${r.rank}-${entity?.id}`} to={linkTo} className="group flex min-w-0 flex-col items-center text-center">
            <EntityImage
              entity={entity}
              tab={tab}
              className={`${r.rank === 1 ? "h-20 w-20 sm:h-24 sm:w-24" : "h-16 w-16 sm:h-20 sm:w-20"} ${tab === "players" ? "rounded-full" : "rounded-2xl"} ring-2 ring-border ring-offset-4 ring-offset-base`}
            />
            <span className="mt-4 flex max-w-full items-center gap-1.5">
              <span className="truncate font-semibold text-ink group-hover:text-accent">{entity?.name ?? "Unknown"}</span>
              {tab === "players" && entity?.isPremium && <Crown className="h-3.5 w-3.5 shrink-0 text-premium" />}
            </span>
            <span className="num mt-0.5 text-sm text-ink-muted">{r.points} pts</span>
            <span
              className={`mt-4 flex w-full items-start justify-center rounded-t-2xl border border-b-0 border-border bg-surface pt-3 ${heights[i]}`}
            >
              <span
                className="num font-display text-4xl font-bold sm:text-5xl"
                style={medal ? { color: `rgb(var(${medal}))` } : undefined}
              >
                {r.rank}
              </span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}

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

  const activeSport = getSportBySlug(sport);
  const podium = rankings.slice(0, 3);

  return (
    <main className="flex-1">
      <PageHero
        title="Leaderboards"
        lead={`${activeSport?.name ?? sport}, ranked by points from completed tournament matches.`}
        image={activeSport?.image ?? "/sports/basketball.jpg"}
        actions={
          <Segmented
            value={tab}
            options={[
              { value: "players", label: "Players" },
              { value: "teams", label: "Teams" },
            ]}
            onChange={setTab}
          />
        }
      >
        <nav aria-label="Choose a sport" className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
          <ul className="flex w-max gap-2">
            {SPORTS.map((s) => {
              const active = s.slug === sport;
              return (
                <li key={s.slug}>
                  <button
                    type="button"
                    onClick={() => updateSport(s.slug)}
                    aria-pressed={active}
                    className={`flex h-11 items-center gap-2 rounded-full border py-1 pl-1 pr-4 text-sm font-semibold transition-colors ${
                      active
                        ? "border-accent bg-accent text-white"
                        : "border-border bg-base-2/80 text-ink-muted hover:border-ink-faint/50 hover:text-ink active:bg-base"
                    }`}
                  >
                    {s.image && <img src={s.image} alt="" className="h-8 w-8 rounded-full object-cover" />}
                    {s.name}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </PageHero>

      <div className="container-x py-12 md:py-16">
        {loading && <Loading label="Loading rankings…" />}
        {!loading && error && <ErrorState message={error} />}
        {!loading && !error && rankings.length === 0 && (
          <EmptyState
            title="No rankings yet"
            message={`Rankings for ${activeSport?.name ?? sport} will appear once tournament matches are completed.`}
          />
        )}
        {!loading && !error && rankings.length > 0 && (
          <div className="grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-14">
            <section aria-label="Top three" className="lg:sticky lg:top-24 lg:self-start">
              <h2 className="mb-10 font-display text-3xl font-bold text-ink">Top of the table</h2>
              <Podium rows={podium} tab={tab} />
            </section>

            <section aria-label="Full table" className="panel overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[34rem] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs font-medium text-ink-faint">
                      <th scope="col" className="w-16 px-5 py-3.5">Rank</th>
                      <th scope="col" className="px-5 py-3.5">{tab === "players" ? "Player" : "Team"}</th>
                      <th scope="col" className="px-4 py-3.5 text-right">Points</th>
                      <th scope="col" className="px-4 py-3.5 text-right">W</th>
                      <th scope="col" className="px-4 py-3.5 text-right">L</th>
                      <th scope="col" className="px-5 py-3.5 text-right">D</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankings.map((r) => {
                      const entity = entityOf(r, tab);
                      const linkTo = tab === "players" ? `/players/${entity?.id}` : `/teams/${entity?.id}`;
                      const medal = MEDAL_VAR[r.rank];
                      return (
                        <tr
                          key={`${r.rank}-${entity?.id}`}
                          className="border-b border-border transition-colors last:border-0 hover:bg-surface-2"
                        >
                          <td className="px-5 py-3.5">
                            <span
                              className="num font-display text-xl font-bold text-ink-muted"
                              style={medal ? { color: `rgb(var(${medal}))` } : undefined}
                            >
                              {r.rank}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            <Link to={linkTo} className="flex items-center gap-3 font-medium text-ink hover:text-accent">
                              <EntityImage
                                entity={entity}
                                tab={tab}
                                className={`h-9 w-9 text-sm ${tab === "players" ? "rounded-full" : "rounded-lg"}`}
                              />
                              <span className="truncate">{entity?.name ?? "Unknown"}</span>
                              {tab === "players" && entity?.isPremium && (
                                <Crown className="h-3.5 w-3.5 shrink-0 text-premium" />
                              )}
                            </Link>
                          </td>
                          <td className="num px-4 py-3.5 text-right font-display text-lg font-bold text-ink">{r.points}</td>
                          <td className="num px-4 py-3.5 text-right text-success">{r.wins}</td>
                          <td className="num px-4 py-3.5 text-right text-danger">{r.losses}</td>
                          <td className="num px-5 py-3.5 text-right text-ink-muted">{r.draws}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}

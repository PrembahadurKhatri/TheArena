import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, Plus, Search, Users } from "lucide-react";
import api, { assetUrl } from "@/api/axios";
import { SPORTS, SPORT_FILTER_OPTIONS, getSportBySlug } from "@/data/sports";
import type { RankingEntry, TeamSummary } from "@/types";
import { apiError } from "@/types";
import { Loading, ErrorState, EmptyState } from "@/components/ui/StateBlock";
import { Input } from "@/components/ui/Field";
import CustomSelect from "@/components/ui/CustomSelect";
import SportMark from "@/components/ui/SportMark";
import PageHero from "@/components/page/PageHero";
import { buttonClass } from "@/components/ui/Button";

const MEDAL_TEXT: Record<number, string> = { 1: "text-premium", 2: "text-ink", 3: "text-ink-muted" };

function TeamLogo({ team, className }: { team: TeamSummary; className: string }) {
  return team.logo ? (
    <img src={assetUrl(team.logo)} alt="" className={`${className} object-cover`} />
  ) : (
    <SportMark slug={team.sport} className={className} />
  );
}

function TeamCard({ team }: { team: TeamSummary }) {
  const sport = getSportBySlug(team.sport);

  return (
    <Link to={`/teams/${team.id}`} className="panel card-lift group flex h-full flex-col overflow-hidden">
      <div className="relative h-28 overflow-hidden bg-surface-2">
        {sport?.image && (
          <img src={sport.image} alt="" loading="lazy" className="h-full w-full object-cover opacity-50" />
        )}
        <div className="photo-veil-bottom absolute inset-0" />
        <span className="absolute right-4 top-4 rounded-full bg-base/80 px-2.5 py-1 text-xs font-medium text-ink-muted">
          {sport?.name ?? team.sport}
        </span>
      </div>
      <div className="-mt-9 flex flex-1 flex-col px-5 pb-5">
        <TeamLogo team={team} className="relative h-16 w-16 rounded-2xl border-4 border-surface" />
        <h3 className="mt-3 truncate font-display text-2xl font-bold text-ink">{team.name}</h3>
        <div className="mt-auto flex items-center justify-between gap-3 pt-4 text-sm text-ink-muted">
          <span className="flex items-center gap-1.5">
            <Users className="h-4 w-4 text-ink-faint" /> <span className="num">{team.memberCount}</span> members
          </span>
          <span className="truncate text-ink-faint">by {team.owner?.name ?? "unknown"}</span>
        </div>
      </div>
    </Link>
  );
}

interface TopSportGroup {
  slug: string;
  name: string;
  entries: RankingEntry<TeamSummary>[];
}

// Each sport becomes a small league table: rank, crest, team, wins.
function TopTeamsBySport({ groups }: { groups: TopSportGroup[] }) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {groups.map((group) => (
        <section key={group.slug} className="panel overflow-hidden">
          <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <SportMark slug={group.slug} size="sm" />
              <h2 className="truncate font-display text-2xl font-bold text-ink">{group.name}</h2>
            </div>
            <Link
              to={`/teams?sport=${group.slug}`}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-accent transition-colors hover:bg-accent-soft active:bg-accent-soft/70"
            >
              All {group.name.toLowerCase()} teams
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </header>
          <ol>
            {group.entries.map((entry, i) => {
              const team = entry.team!;
              const rank = i + 1;
              return (
                <li key={team.id} className="border-b border-border last:border-0">
                  <Link
                    to={`/teams/${team.id}`}
                    className="grid grid-cols-[2.5rem_auto_minmax(0,1fr)_auto] items-center gap-4 px-5 py-4 transition-colors hover:bg-surface-2 active:bg-base-2"
                  >
                    <span className={`num font-display text-3xl font-bold ${MEDAL_TEXT[rank] ?? "text-ink-faint"}`}>
                      {rank}
                    </span>
                    <TeamLogo team={team} className="h-11 w-11 rounded-xl" />
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-ink">{team.name}</span>
                      <span className="block truncate text-sm text-ink-faint">
                        {team.memberCount} members, by {team.owner?.name ?? "unknown"}
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="num block font-display text-2xl font-bold text-ink">{entry.wins}</span>
                      <span className="block text-xs text-ink-faint">{entry.wins === 1 ? "win" : "wins"}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}

export default function Teams() {
  const [params, setParams] = useSearchParams();
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [topGroups, setTopGroups] = useState<TopSportGroup[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const sport = params.get("sport") ?? "";
  const search = params.get("search") ?? "";
  const [searchInput, setSearchInput] = useState(search);
  const showTopBySport = !sport && !search;

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");

    if (showTopBySport) {
      // Default landing view: no sport chosen and no search typed — show
      // the top 3 teams (by match wins) for every sport that has at least
      // one ranked team, instead of one long undifferentiated list.
      Promise.all(
        SPORTS.map((s) =>
          api
            .get(`/rankings/teams`, { params: { sport: s.slug } })
            .then(({ data }) => ({ sport: s, rankings: (data.rankings ?? []) as RankingEntry<TeamSummary>[] }))
            .catch(() => ({ sport: s, rankings: [] as RankingEntry<TeamSummary>[] }))
        )
      )
        .then((results) => {
          if (!alive) return;
          const groups: TopSportGroup[] = results
            .filter((r) => r.rankings.length > 0)
            .map((r) => ({
              slug: r.sport.slug,
              name: r.sport.name,
              entries: [...r.rankings].sort((a, b) => b.wins - a.wins).slice(0, 3),
            }));
          setTopGroups(groups);
        })
        .catch((err) => alive && setError(apiError(err, "Could not load teams.")))
        .finally(() => alive && setLoading(false));
    } else {
      setTopGroups(null);
      api
        .get("/teams", { params: { sport: sport || undefined, search: search || undefined } })
        .then(({ data }) => {
          if (alive) setTeams(data.teams ?? []);
        })
        .catch((err) => alive && setError(apiError(err, "Could not load teams.")))
        .finally(() => alive && setLoading(false));
    }

    return () => {
      alive = false;
    };
  }, [sport, search, showTopBySport]);

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  }

  const activeSport = getSportBySlug(sport);

  return (
    <main className="flex-1">
      <PageHero
        title={activeSport ? `${activeSport.name} teams` : "Find your squad"}
        lead={showTopBySport ? "The top three in every sport, ranked by match wins." : undefined}
        image={activeSport?.image ?? "/sports/football.jpg"}
        imagePosition="center 35%"
        actions={
          <Link to="/teams/create" className={buttonClass({ size: "lg" })}>
            <Plus className="h-4 w-4" /> Create team
          </Link>
        }
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <form
            role="search"
            className="relative flex-1"
            onSubmit={(e) => {
              e.preventDefault();
              updateParam("search", searchInput);
            }}
          >
            <Search className="pointer-events-none absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-ink-faint" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search teams by name"
              aria-label="Search teams"
              className="pl-11"
            />
          </form>
          <CustomSelect
            value={sport}
            onChange={(v) => updateParam("sport", v)}
            options={SPORT_FILTER_OPTIONS}
            className="sm:w-60"
          />
        </div>
      </PageHero>

      <div className="container-x py-12 md:py-16">
        {loading && <Loading label="Loading teams…" />}
        {!loading && error && <ErrorState message={error} />}

        {!loading && !error && showTopBySport && topGroups && topGroups.length === 0 && (
          <EmptyState
            title="No ranked teams yet"
            message="Once teams start playing tournament matches, the top 3 per sport will show up here."
            action={
              <Link to="/teams/create" className={buttonClass({ variant: "secondary", size: "sm", className: "mt-2" })}>
                Create a team
              </Link>
            }
          />
        )}
        {!loading && !error && showTopBySport && topGroups && topGroups.length > 0 && (
          <TopTeamsBySport groups={topGroups} />
        )}

        {!loading && !error && !showTopBySport && teams.length === 0 && (
          <EmptyState
            title="No teams found"
            message="Try a different sport or search term, or be the first to create one."
            action={
              <Link to="/teams/create" className={buttonClass({ variant: "secondary", size: "sm", className: "mt-2" })}>
                Create a team
              </Link>
            }
          />
        )}
        {!loading && !error && !showTopBySport && teams.length > 0 && (
          <>
            <p className="mb-6 text-sm text-ink-faint">
              <span className="num">{teams.length}</span> {teams.length === 1 ? "team" : "teams"}
            </p>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,18rem),1fr))] gap-5">
              {teams.map((team) => (
                <TeamCard key={team.id} team={team} />
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}

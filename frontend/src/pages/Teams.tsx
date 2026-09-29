import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Plus, Search, Shield, Trophy, Users } from "lucide-react";
import api from "@/api/axios";
import { SPORTS, SPORT_FILTER_OPTIONS, getSportBySlug } from "@/data/sports";
import type { RankingEntry, TeamSummary } from "@/types";
import { apiError } from "@/types";
import Reveal from "@/components/Reveal";
import { Loading, ErrorState, EmptyState } from "@/components/ui/StateBlock";
import { Input } from "@/components/ui/Field";
import CustomSelect from "@/components/ui/CustomSelect";
import { useSpotlight } from "@/hooks/useSpotlight";

const RANK_MEDAL: Record<number, string> = { 1: "#F5A623", 2: "#C7CDD6", 3: "#CD7F32" };

function TeamCard({ team, index, rank, wins }: { team: TeamSummary; index: number; rank?: number; wins?: number }) {
  const spot = useSpotlight<HTMLAnchorElement>();
  const sport = getSportBySlug(team.sport);

  return (
    <Reveal delay={(index % 6) * 0.05}>
      <Link
        ref={spot.ref}
        onMouseMove={spot.onMouseMove}
        to={`/teams/${team.id}`}
        className="spotlight glass group relative flex h-full flex-col gap-4 rounded-2xl p-5 transition-transform hover:-translate-y-1 hover:border-accent/40"
      >
        {rank && (
          <span
            className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full border-2 border-base text-xs font-bold text-base shadow-md"
            style={{ background: RANK_MEDAL[rank] ?? "rgb(var(--c-accent))" }}
          >
            #{rank}
          </span>
        )}
        <div className="flex items-center gap-3">
          {team.logo ? (
            <img src={team.logo} alt={team.name} className="h-14 w-14 rounded-xl object-cover" />
          ) : (
            <div
              className="flex h-14 w-14 items-center justify-center rounded-xl text-2xl"
              style={{ background: `${sport?.color ?? "#3a82ff"}22` }}
            >
              {sport?.emoji ?? <Shield className="h-6 w-6 text-accent" />}
            </div>
          )}
          <div className="min-w-0">
            <h3 className="truncate font-display text-lg font-semibold text-ink">{team.name}</h3>
            <span className="text-xs font-medium uppercase tracking-widest text-ink-faint">
              {sport?.name ?? team.sport}
            </span>
          </div>
        </div>
        <div className="mt-auto flex items-center justify-between border-t border-border pt-4 text-sm">
          {wins !== undefined ? (
            <span className="flex items-center gap-1.5 font-semibold text-accent">
              <Trophy className="h-3.5 w-3.5" /> {wins} win{wins === 1 ? "" : "s"}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-ink-muted">
              <Users className="h-3.5 w-3.5" /> {team.memberCount} members
            </span>
          )}
          <span className="text-ink-faint">by {team.owner?.name ?? "—"}</span>
        </div>
      </Link>
    </Reveal>
  );
}

interface TopSportGroup {
  slug: string;
  name: string;
  emoji: string;
  color: string;
  entries: RankingEntry<TeamSummary>[];
}

function TopTeamsBySport({ groups }: { groups: TopSportGroup[] }) {
  return (
    <div className="flex flex-col gap-12">
      {groups.map((group, gi) => (
        <Reveal key={group.slug} delay={gi * 0.04}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span
                className="flex h-9 w-9 items-center justify-center rounded-full text-lg"
                style={{ background: `${group.color}26` }}
              >
                {group.emoji}
              </span>
              <h2 className="font-display text-xl font-bold text-ink">{group.name}</h2>
              <span className="text-xs font-medium uppercase tracking-widest text-ink-faint">Top teams</span>
            </div>
            <Link
              to={`/teams?sport=${group.slug}`}
              className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:text-accent/80"
            >
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {group.entries.map((entry, i) => (
              <TeamCard
                key={entry.team!.id}
                team={entry.team!}
                index={i}
                rank={i + 1}
                wins={entry.wins}
              />
            ))}
          </div>
        </Reveal>
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
              emoji: r.sport.emoji,
              color: r.sport.color,
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

  return (
    <main className="flex-1 py-16">
      <div className="container-x">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <Reveal>
              <span className="eyebrow">Teams</span>
            </Reveal>
            <Reveal delay={0.06}>
              <h1 className="mt-4 font-display text-4xl font-bold text-ink">Find your squad</h1>
            </Reveal>
          </div>
          <Reveal delay={0.1}>
            <Link
              to="/teams/create"
              className="shine inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent/90"
            >
              <Plus className="h-4 w-4" /> Create Team
            </Link>
          </Reveal>
        </div>

        <Reveal delay={0.14}>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <form
              className="relative flex-1"
              onSubmit={(e) => {
                e.preventDefault();
                updateParam("search", searchInput);
              }}
            >
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search teams by name..."
                className="pl-11"
              />
            </form>
            <CustomSelect
              value={sport}
              onChange={(v) => updateParam("sport", v)}
              options={SPORT_FILTER_OPTIONS}
              className="sm:w-56"
            />
          </div>
        </Reveal>

        <div className="mt-10">
          {loading && <Loading label="Loading teams..." />}
          {!loading && error && <ErrorState message={error} />}

          {!loading && !error && showTopBySport && topGroups && topGroups.length === 0 && (
            <EmptyState
              title="No ranked teams yet"
              message="Once teams start playing tournament matches, the top 3 per sport will show up here."
              action={
                <Link to="/teams/create" className="mt-2 text-sm font-semibold text-accent hover:underline">
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
                <Link to="/teams/create" className="mt-2 text-sm font-semibold text-accent hover:underline">
                  Create a team
                </Link>
              }
            />
          )}
          {!loading && !error && !showTopBySport && teams.length > 0 && (
            <motion.div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {teams.map((team, i) => (
                <TeamCard key={team.id} team={team} index={i} />
              ))}
            </motion.div>
          )}
        </div>
      </div>
    </main>
  );
}

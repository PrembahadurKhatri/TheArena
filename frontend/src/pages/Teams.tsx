import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus, Search, Shield, Users } from "lucide-react";
import api from "@/api/axios";
import { SPORTS, getSportBySlug } from "@/data/sports";
import type { TeamSummary } from "@/types";
import { apiError } from "@/types";
import Reveal from "@/components/Reveal";
import { Loading, ErrorState, EmptyState } from "@/components/ui/StateBlock";
import { Input, Select } from "@/components/ui/Field";
import { useSpotlight } from "@/hooks/useSpotlight";

function TeamCard({ team, index }: { team: TeamSummary; index: number }) {
  const spot = useSpotlight<HTMLAnchorElement>();
  const sport = getSportBySlug(team.sport);

  return (
    <Reveal delay={(index % 6) * 0.05}>
      <Link
        ref={spot.ref}
        onMouseMove={spot.onMouseMove}
        to={`/teams/${team.id}`}
        className="spotlight glass group flex h-full flex-col gap-4 rounded-2xl p-5 transition-transform hover:-translate-y-1 hover:border-accent/40"
      >
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
          <span className="flex items-center gap-1.5 text-ink-muted">
            <Users className="h-3.5 w-3.5" /> {team.memberCount} members
          </span>
          <span className="text-ink-faint">by {team.owner?.name ?? "—"}</span>
        </div>
      </Link>
    </Reveal>
  );
}

export default function Teams() {
  const [params, setParams] = useSearchParams();
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const sport = params.get("sport") ?? "";
  const search = params.get("search") ?? "";
  const [searchInput, setSearchInput] = useState(search);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    api
      .get("/teams", { params: { sport: sport || undefined, search: search || undefined } })
      .then(({ data }) => {
        if (alive) setTeams(data.teams ?? []);
      })
      .catch((err) => alive && setError(apiError(err, "Could not load teams.")))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [sport, search]);

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
            <Select value={sport} onChange={(e) => updateParam("sport", e.target.value)} className="sm:w-56">
              <option value="">All sports</option>
              {SPORTS.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.emoji} {s.name}
                </option>
              ))}
            </Select>
          </div>
        </Reveal>

        <div className="mt-10">
          {loading && <Loading label="Loading teams..." />}
          {!loading && error && <ErrorState message={error} />}
          {!loading && !error && teams.length === 0 && (
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
          {!loading && !error && teams.length > 0 && (
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

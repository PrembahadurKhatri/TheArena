import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Crown, Search, User } from "lucide-react";
import api from "@/api/axios";
import { SPORTS, getSportBySlug } from "@/data/sports";
import type { PlayerSummary } from "@/types";
import { apiError } from "@/types";
import Reveal from "@/components/Reveal";
import { Loading, ErrorState, EmptyState } from "@/components/ui/StateBlock";
import { Input, Select } from "@/components/ui/Field";
import { useSpotlight } from "@/hooks/useSpotlight";

function PlayerCard({ player, index }: { player: PlayerSummary; index: number }) {
  const spot = useSpotlight<HTMLAnchorElement>();

  return (
    <Reveal delay={(index % 6) * 0.05}>
      <Link
        ref={spot.ref}
        onMouseMove={spot.onMouseMove}
        to={`/players/${player.id}`}
        className="spotlight glass flex h-full flex-col items-center gap-3 rounded-2xl p-6 text-center transition-transform hover:-translate-y-1 hover:border-accent/40"
      >
        {player.photo ? (
          <img src={player.photo} alt={player.name} className="h-16 w-16 rounded-full object-cover" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-soft text-accent">
            <User className="h-6 w-6" />
          </div>
        )}
        <div>
          <div className="flex items-center justify-center gap-1.5">
            <h3 className="font-display text-lg font-semibold text-ink">{player.name}</h3>
            {player.isPremium && <Crown className="h-3.5 w-3.5 text-premium" />}
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
            {player.sportPreferences?.slice(0, 3).map((slug) => {
              const s = getSportBySlug(slug);
              return (
                <span key={slug} className="rounded-full bg-surface-2 px-2.5 py-1 text-xs text-ink-muted">
                  {s?.emoji} {s?.name ?? slug}
                </span>
              );
            })}
          </div>
        </div>
      </Link>
    </Reveal>
  );
}

export default function Players() {
  const [params, setParams] = useSearchParams();
  const [players, setPlayers] = useState<PlayerSummary[]>([]);
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
      .get("/players", { params: { sport: sport || undefined, search: search || undefined } })
      .then(({ data }) => alive && setPlayers(data.players ?? []))
      .catch((err) => alive && setError(apiError(err, "Could not load players.")))
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
        <Reveal>
          <span className="eyebrow">Players</span>
        </Reveal>
        <Reveal delay={0.06}>
          <h1 className="mt-4 font-display text-4xl font-bold text-ink">Meet the players</h1>
        </Reveal>

        <Reveal delay={0.12}>
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
                placeholder="Search players by name..."
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
          {loading && <Loading label="Loading players..." />}
          {!loading && error && <ErrorState message={error} />}
          {!loading && !error && players.length === 0 && (
            <EmptyState title="No players found" message="Try a different sport or search term." />
          )}
          {!loading && !error && players.length > 0 && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {players.map((p, i) => (
                <PlayerCard key={p.id} player={p} index={i} />
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

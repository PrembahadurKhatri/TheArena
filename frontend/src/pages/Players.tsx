import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Crown, Search } from "lucide-react";
import api, { assetUrl } from "@/api/axios";
import { SPORT_FILTER_OPTIONS, getSportBySlug } from "@/data/sports";
import type { PlayerSummary } from "@/types";
import { apiError } from "@/types";
import { Loading, ErrorState, EmptyState } from "@/components/ui/StateBlock";
import { Input } from "@/components/ui/Field";
import CustomSelect from "@/components/ui/CustomSelect";
import SportMark, { Initials } from "@/components/ui/SportMark";
import PageHero from "@/components/page/PageHero";

function PlayerCard({ player }: { player: PlayerSummary }) {
  const sports = player.sportPreferences?.slice(0, 3) ?? [];

  return (
    <Link to={`/players/${player.id}`} className="panel card-lift group flex h-full flex-col overflow-hidden">
      <div className="relative aspect-[4/5] overflow-hidden bg-surface-2">
        {player.photo ? (
          <img src={assetUrl(player.photo)} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <Initials name={player.name} className="h-full w-full bg-surface-2 text-6xl text-ink-faint" />
        )}
        {player.isPremium && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-base/85 px-2.5 py-1 text-xs font-semibold text-premium">
            <Crown className="h-3 w-3" /> Premium
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <h3 className="truncate font-display text-xl font-bold text-ink">{player.name}</h3>
        {sports.length > 0 && (
          <ul className="mt-auto flex flex-wrap gap-1.5">
            {sports.map((slug) => (
              <li
                key={slug}
                className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 py-0.5 pl-0.5 pr-2.5 text-xs text-ink-muted"
              >
                <SportMark slug={slug} size="xs" className="!rounded-full" />
                {getSportBySlug(slug)?.name ?? slug}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Link>
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

  const activeSport = getSportBySlug(sport);

  return (
    <main className="flex-1">
      <PageHero
        title={activeSport ? `${activeSport.name} players` : "Meet the players"}
        image={activeSport?.image ?? "/sports/tennis.jpg"}
        imagePosition="center 30%"
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
              placeholder="Search players by name"
              aria-label="Search players"
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
        {loading && <Loading label="Loading players…" />}
        {!loading && error && <ErrorState message={error} />}
        {!loading && !error && players.length === 0 && (
          <EmptyState title="No players found" message="Try a different sport or search term." />
        )}
        {!loading && !error && players.length > 0 && (
          <>
            <p className="mb-6 text-sm text-ink-faint">
              <span className="num">{players.length}</span> {players.length === 1 ? "player" : "players"}
            </p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-[repeat(auto-fill,minmax(min(100%,13rem),1fr))] sm:gap-5">
              {players.map((p) => (
                <PlayerCard key={p.id} player={p} />
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}

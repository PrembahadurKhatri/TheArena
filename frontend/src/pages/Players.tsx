import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Crown, LocateFixed, MapPin, Search } from "lucide-react";
import api, { assetUrl } from "@/api/axios";
import { SPORT_FILTER_OPTIONS, getSportBySlug } from "@/data/sports";
import type { PlayerSummary } from "@/types";
import { apiError } from "@/types";
import { Loading, ErrorState, EmptyState } from "@/components/ui/StateBlock";
import { Input } from "@/components/ui/Field";
import CustomSelect from "@/components/ui/CustomSelect";
import SportMark, { Initials } from "@/components/ui/SportMark";
import PageHero from "@/components/page/PageHero";
import Button from "@/components/ui/Button";
import { useAuth } from "@/context/AuthContext";
import { PROVINCE_OPTIONS } from "@/data/provinces";
import { districtOptions, EXPERIENCE_OPTIONS } from "@/data/locations";

function PlayerCard({ player }: { player: PlayerSummary }) {
  const sports = player.sportPreferences?.slice(0, 3) ?? [];

  return (
    <Link to={`/players/${player.username ?? player.id}`} className="panel card-lift group flex h-full flex-col overflow-hidden">
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
        <div className="min-w-0">
          <h3 className="truncate font-display text-xl font-bold text-ink">{player.name}</h3>
          {(player.district || player.province) && (
            <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-ink-faint">
              <MapPin className="h-3 w-3 shrink-0" /> {player.district ?? player.province}
            </p>
          )}
        </div>
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
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [players, setPlayers] = useState<PlayerSummary[]>([]);
  const [meta, setMeta] = useState<{ total: number; pages: number; radiusKm: number | null }>({ total: 0, pages: 1, radiusKm: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [locating, setLocating] = useState(false);

  const sport = params.get("sport") ?? "";
  const search = params.get("search") ?? "";
  const province = params.get("province") ?? "";
  const district = params.get("district") ?? "";
  const experience = params.get("experience") ?? "";
  const lat = params.get("lat") ?? "";
  const lng = params.get("lng") ?? "";
  const radiusKm = params.get("radiusKm") ?? "10";
  const page = Number(params.get("page") ?? "1") || 1;
  const [searchInput, setSearchInput] = useState(search);
  const advanced = !!user?.entitlements?.advancedMatchmaking;
  const maxRadius = user?.entitlements?.maxSearchRadiusKm ?? 10;

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    api
      .get("/players", {
        params: {
          sport: sport || undefined,
          search: search || undefined,
          province: province || undefined,
          district: district || undefined,
          experience: (advanced && experience) || undefined,
          lat: lat || undefined,
          lng: lng || undefined,
          radiusKm: lat ? radiusKm : undefined,
          page,
        },
      })
      .then(({ data }) => {
        if (!alive) return;
        setPlayers(data.players ?? []);
        setMeta({ total: data.total ?? 0, pages: data.pages ?? 1, radiusKm: data.radiusKm ?? null });
      })
      .catch((err) => alive && setError(apiError(err, "Could not load players.")))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [sport, search, province, district, experience, lat, lng, radiusKm, page, advanced]);

  function updateParams(changes: Record<string, string>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (!("page" in changes)) next.delete("page");
    setParams(next);
  }
  const updateParam = (key: string, value: string) => updateParams({ [key]: value });

  function nearMe() {
    if (lat) {
      updateParams({ lat: "", lng: "", radiusKm: "" });
      return;
    }
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        updateParams({ lat: pos.coords.latitude.toFixed(4), lng: pos.coords.longitude.toFixed(4), radiusKm: "10" });
      },
      () => setLocating(false),
      { timeout: 10000 }
    );
  }

  const activeSport = getSportBySlug(sport);
  const selectClass = "rounded-full border border-border bg-surface px-4 py-2 text-sm text-ink";

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
              placeholder="Search by name or username"
              aria-label="Search players"
              className="pl-11"
            />
          </form>
          <CustomSelect value={sport} onChange={(v) => updateParam("sport", v)} options={SPORT_FILTER_OPTIONS} className="sm:w-60" />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select aria-label="Province" className={selectClass} value={province} onChange={(e) => updateParams({ province: e.target.value, district: "" })}>
            <option value="">All provinces</option>
            {PROVINCE_OPTIONS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          <select aria-label="District" className={selectClass} value={district} onChange={(e) => updateParam("district", e.target.value)}>
            <option value="">All districts</option>
            {districtOptions(province || undefined).map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
          <Button type="button" size="sm" variant={lat ? "primary" : "secondary"} loading={locating} icon={<LocateFixed className="h-4 w-4" />} onClick={nearMe}>
            {lat ? "Near me: on" : "Near me"}
          </Button>
          {lat && (
            <select aria-label="Radius" className={selectClass} value={radiusKm} onChange={(e) => updateParam("radiusKm", e.target.value)}>
              {[5, 10, 25, 50, 100].map((r) => (
                <option key={r} value={r} disabled={r > maxRadius}>
                  {r} km{r > maxRadius ? " (Premium)" : ""}
                </option>
              ))}
            </select>
          )}
          {advanced ? (
            <select aria-label="Experience" className={selectClass} value={experience} onChange={(e) => updateParam("experience", e.target.value)}>
              <option value="">Any experience</option>
              {EXPERIENCE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : (
            <Link to="/membership" className="inline-flex items-center gap-1 rounded-full border border-premium/30 bg-premium-soft px-3 py-1.5 text-xs font-semibold text-premium">
              <Crown className="h-3 w-3" /> Experience & position filters with Premium
            </Link>
          )}
        </div>
      </PageHero>

      <div className="container-x py-12 md:py-16">
        {loading && <Loading label="Loading players…" />}
        {!loading && error && <ErrorState message={error} />}
        {!loading && !error && players.length === 0 && (
          <EmptyState
            title="No players found"
            message={lat ? `Nobody within ${meta.radiusKm ?? radiusKm} km has shared their location yet. Try a wider area or a district.` : "Try a different sport, place or search term."}
          />
        )}
        {!loading && !error && players.length > 0 && (
          <>
            <p className="mb-6 text-sm text-ink-faint">
              <span className="num">{meta.total}</span> {meta.total === 1 ? "player" : "players"}
              {meta.radiusKm ? ` within ${meta.radiusKm} km` : ""}
            </p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-[repeat(auto-fill,minmax(min(100%,13rem),1fr))] sm:gap-5">
              {players.map((p) => (
                <PlayerCard key={p.id} player={p} />
              ))}
            </div>
            {meta.pages > 1 && (
              <div className="mt-10 flex items-center justify-center gap-3">
                <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => updateParams({ page: String(page - 1) })}>
                  Previous
                </Button>
                <span className="num text-sm text-ink-faint">
                  {page} / {meta.pages}
                </span>
                <Button variant="secondary" size="sm" disabled={page >= meta.pages} onClick={() => updateParams({ page: String(page + 1) })}>
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

import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { MapPin, Plus, Search, Users } from "lucide-react";
import api, { assetUrl } from "@/api/axios";
import { SPORT_FILTER_OPTIONS, getSportBySlug } from "@/data/sports";
import type { TeamSummary } from "@/types";
import { teamPath } from "@/types";
import { PROVINCE_OPTIONS } from "@/data/provinces";
import { districtOptions } from "@/data/locations";
import Button from "@/components/ui/Button";
import { apiError } from "@/types";
import { Loading, ErrorState, EmptyState } from "@/components/ui/StateBlock";
import { Input } from "@/components/ui/Field";
import CustomSelect from "@/components/ui/CustomSelect";
import SportMark from "@/components/ui/SportMark";
import PageHero from "@/components/page/PageHero";
import { buttonClass } from "@/components/ui/Button";

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
    <Link to={teamPath(team)} className="panel card-lift group flex h-full flex-col overflow-hidden">
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
          <span className="flex min-w-0 items-center gap-1 truncate text-ink-faint">
            {team.district ? (
              <>
                <MapPin className="h-3.5 w-3.5 shrink-0" /> {team.district}
              </>
            ) : (
              <>by {team.owner?.name ?? "unknown"}</>
            )}
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function Teams() {
  const [params, setParams] = useSearchParams();
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [meta, setMeta] = useState({ total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const sport = params.get("sport") ?? "";
  const search = params.get("search") ?? "";
  const province = params.get("province") ?? "";
  const district = params.get("district") ?? "";
  const page = Number(params.get("page") ?? "1") || 1;
  const [searchInput, setSearchInput] = useState(search);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");

    api
      .get("/teams", { params: { sport: sport || undefined, search: search || undefined, province: province || undefined, district: district || undefined, page } })
      .then(({ data }) => {
        if (!alive) return;
        setTeams(data.teams ?? []);
        setMeta({ total: data.total ?? 0, pages: data.pages ?? 1 });
      })
      .catch((err) => alive && setError(apiError(err, "Could not load teams.")))
      .finally(() => alive && setLoading(false));

    return () => {
      alive = false;
    };
  }, [sport, search, province, district, page]);

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    if (key === "province") next.delete("district");
    setParams(next);
  }

  const activeSport = getSportBySlug(sport);

  return (
    <main className="flex-1">
      <PageHero
        title={activeSport ? `${activeSport.name} teams` : "Find your squad"}
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
        <div className="mt-3 flex flex-wrap gap-2">
          <select aria-label="Province" className="rounded-full border border-border bg-surface px-4 py-2 text-sm text-ink" value={province} onChange={(e) => updateParam("province", e.target.value)}>
            <option value="">All provinces</option>
            {PROVINCE_OPTIONS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          <select aria-label="District" className="rounded-full border border-border bg-surface px-4 py-2 text-sm text-ink" value={district} onChange={(e) => updateParam("district", e.target.value)}>
            <option value="">All districts</option>
            {districtOptions(province || undefined).map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
      </PageHero>

      <div className="container-x py-12 md:py-16">
        {loading && <Loading label="Loading teams…" />}
        {!loading && error && <ErrorState message={error} />}

        {!loading && !error && teams.length === 0 && (
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
        {!loading && !error && teams.length > 0 && (
          <>
            <p className="mb-6 text-sm text-ink-faint">
              <span className="num">{meta.total}</span> {meta.total === 1 ? "team" : "teams"}
            </p>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,18rem),1fr))] gap-5">
              {teams.map((team) => (
                <TeamCard key={team.id} team={team} />
              ))}
            </div>
            {meta.pages > 1 && (
              <div className="mt-10 flex items-center justify-center gap-3">
                <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => updateParam("page", String(page - 1))}>
                  Previous
                </Button>
                <span className="num text-sm text-ink-faint">
                  {page} / {meta.pages}
                </span>
                <Button variant="secondary" size="sm" disabled={page >= meta.pages} onClick={() => updateParam("page", String(page + 1))}>
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

import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { MapPin, Search } from "lucide-react";
import api, { assetUrl } from "@/api/axios";
import { SPORT_FILTER_OPTIONS, getSportBySlug } from "@/data/sports";
import type { GroundSummary } from "@/types";
import { apiError } from "@/types";
import { Loading, ErrorState, EmptyState } from "@/components/ui/StateBlock";
import { Input } from "@/components/ui/Field";
import CustomSelect from "@/components/ui/CustomSelect";
import PageHero from "@/components/page/PageHero";
import { districtOptions } from "@/data/locations";

function GroundCard({ ground }: { ground: GroundSummary }) {
  const sport = getSportBySlug(ground.sport);
  const photo = ground.image ? assetUrl(ground.image) : sport?.image;

  return (
    <Link to={`/grounds/${ground.slug || ground.id}`} className="panel card-lift group flex h-full flex-col overflow-hidden">
      <div className="relative aspect-[4/3] overflow-hidden bg-surface-2">
        {photo && (
          <img
            src={photo}
            alt=""
            loading="lazy"
            className={`h-full w-full object-cover ${ground.image ? "" : "opacity-60"}`}
          />
        )}
        <div className="photo-veil-bottom absolute inset-0" />
        <span className="absolute left-4 top-4 rounded-full bg-base/85 px-2.5 py-1 text-xs font-medium text-ink-muted">
          {sport?.name ?? ground.sport}
        </span>
        <span className="absolute bottom-4 left-4 flex items-baseline gap-1 text-ink">
          <span className="num font-display text-3xl font-bold">Rs {ground.pricePerHour}</span>
          <span className="text-sm text-ink-muted">per hour</span>
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-5">
        <h3 className="font-display text-2xl font-bold leading-tight text-ink group-hover:text-accent">{ground.name}</h3>
        <span className="flex items-center gap-1.5 text-sm text-ink-muted">
          <MapPin className="h-4 w-4 shrink-0 text-ink-faint" /> {ground.location}
        </span>
      </div>
    </Link>
  );
}

export default function Grounds() {
  const [params, setParams] = useSearchParams();
  const [grounds, setGrounds] = useState<GroundSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const sport = params.get("sport") ?? "";
  const search = params.get("search") ?? "";
  const district = params.get("district") ?? "";
  const maxPrice = params.get("maxPrice") ?? "";
  const [searchInput, setSearchInput] = useState(search);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    api
      .get("/grounds", { params: { sport: sport || undefined, search: search || undefined, district: district || undefined, maxPrice: maxPrice || undefined, limit: 60 } })
      .then(({ data }) => alive && setGrounds(data.grounds ?? []))
      .catch((err) => alive && setError(apiError(err, "Could not load grounds.")))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [sport, search, district, maxPrice]);

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
        title={activeSport ? `${activeSport.name} grounds` : "Book a ground"}
        lead="Pick a slot by the hour and pay at checkout."
        image={activeSport?.image ?? "/sports/futsal.avif"}
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
              placeholder="Search grounds by name or location"
              aria-label="Search grounds"
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
          <select aria-label="District" className="rounded-full border border-border bg-surface px-4 py-2 text-sm text-ink" value={district} onChange={(e) => updateParam("district", e.target.value)}>
            <option value="">All districts</option>
            {districtOptions().map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
          <select aria-label="Price" className="rounded-full border border-border bg-surface px-4 py-2 text-sm text-ink" value={maxPrice} onChange={(e) => updateParam("maxPrice", e.target.value)}>
            <option value="">Any price</option>
            {[500, 1000, 1500, 2500, 4000].map((p) => (
              <option key={p} value={p}>
                Up to Rs {p}/h
              </option>
            ))}
          </select>
          <Link to="/owner" className="rounded-full border border-border px-4 py-2 text-sm text-ink-muted hover:text-ink">
            Own a ground? List it
          </Link>
        </div>
      </PageHero>

      <div className="container-x py-12 md:py-16">
        {loading && <Loading label="Loading grounds…" />}
        {!loading && error && <ErrorState message={error} />}
        {!loading && !error && grounds.length === 0 && (
          <EmptyState title="No grounds found" message="Try a different sport or search term." />
        )}
        {!loading && !error && grounds.length > 0 && (
          <>
            <p className="mb-6 text-sm text-ink-faint">
              <span className="num">{grounds.length}</span> {grounds.length === 1 ? "ground" : "grounds"}
            </p>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,19rem),1fr))] gap-5">
              {grounds.map((g) => (
                <GroundCard key={g.id} ground={g} />
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}

import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { MapPin, Search, Tent } from "lucide-react";
import api from "@/api/axios";
import { SPORTS, getSportBySlug } from "@/data/sports";
import type { GroundSummary } from "@/types";
import { apiError } from "@/types";
import Reveal from "@/components/Reveal";
import { Loading, ErrorState, EmptyState } from "@/components/ui/StateBlock";
import { Input, Select } from "@/components/ui/Field";
import { useSpotlight } from "@/hooks/useSpotlight";

function GroundCard({ ground, index }: { ground: GroundSummary; index: number }) {
  const spot = useSpotlight<HTMLAnchorElement>();
  const sport = getSportBySlug(ground.sport);

  return (
    <Reveal delay={(index % 6) * 0.05}>
      <Link
        ref={spot.ref}
        onMouseMove={spot.onMouseMove}
        to={`/grounds/${ground.id}`}
        className="spotlight glass group flex h-full flex-col overflow-hidden rounded-2xl transition-transform hover:-translate-y-1 hover:border-accent/40"
      >
        <div className="relative h-36 w-full overflow-hidden bg-surface-2">
          {ground.image ? (
            <img
              src={ground.image}
              alt={ground.name}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center text-3xl"
              style={{ background: `${sport?.color ?? "#3a82ff"}22` }}
            >
              {sport?.emoji ?? <Tent className="h-8 w-8 text-accent" />}
            </div>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-2 p-5">
          <span className="text-xs font-medium uppercase tracking-widest text-ink-faint">
            {sport?.name ?? ground.sport}
          </span>
          <h3 className="font-display text-lg font-semibold text-ink">{ground.name}</h3>
          <span className="flex items-center gap-1.5 text-sm text-ink-muted">
            <MapPin className="h-3.5 w-3.5" /> {ground.location}
          </span>
          <span className="mt-auto pt-2 font-display text-lg font-semibold text-accent">
            Rs {ground.pricePerHour}
            <span className="text-xs font-normal text-ink-faint"> / hour</span>
          </span>
        </div>
      </Link>
    </Reveal>
  );
}

export default function Grounds() {
  const [params, setParams] = useSearchParams();
  const [grounds, setGrounds] = useState<GroundSummary[]>([]);
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
      .get("/grounds", { params: { sport: sport || undefined, search: search || undefined } })
      .then(({ data }) => alive && setGrounds(data.grounds ?? []))
      .catch((err) => alive && setError(apiError(err, "Could not load grounds.")))
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
          <span className="eyebrow">Grounds</span>
        </Reveal>
        <Reveal delay={0.06}>
          <h1 className="mt-4 font-display text-4xl font-bold text-ink">Book a ground</h1>
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
                placeholder="Search grounds by name or location..."
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
          {loading && <Loading label="Loading grounds..." />}
          {!loading && error && <ErrorState message={error} />}
          {!loading && !error && grounds.length === 0 && (
            <EmptyState title="No grounds found" message="Try a different sport or search term." />
          )}
          {!loading && !error && grounds.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {grounds.map((g, i) => (
                <GroundCard key={g.id} ground={g} index={i} />
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

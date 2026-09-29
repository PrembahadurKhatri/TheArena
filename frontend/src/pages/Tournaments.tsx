import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CalendarDays, MapPin, Plus, Trophy, Users } from "lucide-react";
import api from "@/api/axios";
import { useAuth } from "@/context/AuthContext";
import { SPORT_FILTER_OPTIONS, getSportBySlug } from "@/data/sports";
import type { TournamentSummary } from "@/types";
import { apiError } from "@/types";
import Reveal from "@/components/Reveal";
import { Loading, ErrorState, EmptyState } from "@/components/ui/StateBlock";
import CustomSelect from "@/components/ui/CustomSelect";
import { StatusBadge } from "@/components/ui/Badge";
import { useSpotlight } from "@/hooks/useSpotlight";

function TournamentCard({ t, index }: { t: TournamentSummary; index: number }) {
  const spot = useSpotlight<HTMLAnchorElement>();
  const sport = getSportBySlug(t.sport);

  return (
    <Reveal delay={(index % 6) * 0.05}>
      <Link
        ref={spot.ref}
        onMouseMove={spot.onMouseMove}
        to={`/tournaments/${t.id}`}
        className="spotlight glass flex h-full flex-col gap-4 rounded-2xl p-6 transition-transform hover:-translate-y-1 hover:border-accent/40"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl text-xl"
              style={{ background: `${sport?.color ?? "#3a82ff"}22` }}
            >
              {sport?.emoji ?? <Trophy className="h-5 w-5 text-accent" />}
            </div>
            <div>
              <h3 className="font-display text-lg font-semibold text-ink">{t.name}</h3>
              <span className="text-xs uppercase tracking-widest text-ink-faint">{sport?.name ?? t.sport}</span>
            </div>
          </div>
          <StatusBadge status={t.status} />
        </div>

        {(t.province || t.location) && (
          <span className="-mt-2 flex items-center gap-1.5 text-xs text-ink-faint">
            <MapPin className="h-3 w-3 shrink-0" />
            {t.location ? `${t.location}, ${t.province}` : t.province}
          </span>
        )}

        <div className="mt-auto flex items-center justify-between border-t border-border pt-4 text-sm text-ink-muted">
          <span className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" /> {t.teamsCount}/{t.maxTeams} teams
          </span>
          <span className="flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" /> {new Date(t.startDate).toLocaleDateString()}
          </span>
        </div>
      </Link>
    </Reveal>
  );
}

const STATUS_FILTER_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "upcoming", label: "Upcoming" },
  { value: "ongoing", label: "Ongoing" },
  { value: "completed", label: "Completed" },
];

export default function Tournaments() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [tournaments, setTournaments] = useState<TournamentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [nearMeNotice, setNearMeNotice] = useState("");

  const sport = params.get("sport") ?? "";
  const status = params.get("status") ?? "";
  const nearMe = params.get("near") === "1";
  const nearMeProvince = nearMe ? user?.province : undefined;

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    api
      .get("/tournaments", {
        params: { sport: sport || undefined, status: status || undefined, province: nearMeProvince || undefined },
      })
      .then(({ data }) => alive && setTournaments(data.tournaments ?? []))
      .catch((err) => alive && setError(apiError(err, "Could not load tournaments.")))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [sport, status, nearMeProvince]);

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  }

  function toggleNearMe() {
    if (!user) {
      setNearMeNotice("Log in to see tournaments near you.");
      return;
    }
    if (!user.province) {
      setNearMeNotice('Set your province in your profile to use "Near Me".');
      return;
    }
    setNearMeNotice("");
    updateParam("near", nearMe ? "" : "1");
  }

  return (
    <main className="flex-1 py-16">
      <div className="container-x">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <Reveal>
              <span className="eyebrow">Tournaments</span>
            </Reveal>
            <Reveal delay={0.06}>
              <h1 className="mt-4 font-display text-4xl font-bold text-ink">Compete for glory</h1>
            </Reveal>
          </div>
          <Reveal delay={0.1}>
            <Link
              to="/tournaments/create"
              className="shine inline-flex items-center gap-2 rounded-full bg-premium px-5 py-2.5 text-sm font-semibold text-black hover:bg-premium/90"
            >
              <Plus className="h-4 w-4" /> Host a tournament
            </Link>
          </Reveal>
        </div>

        <Reveal delay={0.14}>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <CustomSelect
              value={sport}
              onChange={(v) => updateParam("sport", v)}
              options={SPORT_FILTER_OPTIONS}
              className="sm:w-56"
            />
            <CustomSelect
              value={status}
              onChange={(v) => updateParam("status", v)}
              options={STATUS_FILTER_OPTIONS}
              className="sm:w-56"
            />
            <button
              type="button"
              onClick={toggleNearMe}
              className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors ${
                nearMe
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-border bg-surface text-ink-muted hover:border-accent/40 hover:text-ink"
              }`}
            >
              <MapPin className="h-4 w-4" /> Near Me
            </button>
          </div>
          {nearMeNotice && <p className="mt-3 text-xs text-premium">{nearMeNotice}</p>}
          {nearMe && user?.province && (
            <p className="mt-3 text-xs text-ink-faint">
              Showing tournaments in <span className="font-semibold text-ink">{user.province}</span>.
            </p>
          )}
        </Reveal>

        <div className="mt-10">
          {loading && <Loading label="Loading tournaments..." />}
          {!loading && error && <ErrorState message={error} />}
          {!loading && !error && tournaments.length === 0 && (
            <EmptyState
              title="No tournaments found"
              message={
                nearMe
                  ? "No tournaments in your province yet — try turning off Near Me, or host your own."
                  : "Try different filters, or host your own tournament."
              }
            />
          )}
          {!loading && !error && tournaments.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {tournaments.map((t, i) => (
                <TournamentCard key={t.id} t={t} index={i} />
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

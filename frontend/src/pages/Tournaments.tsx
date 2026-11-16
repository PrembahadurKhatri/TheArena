import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ChevronRight, MapPin, Plus } from "lucide-react";
import api from "@/api/axios";
import { useAuth } from "@/context/AuthContext";
import { SPORT_FILTER_OPTIONS, getSportBySlug } from "@/data/sports";
import type { TournamentSummary } from "@/types";
import { apiError } from "@/types";
import { Loading, ErrorState, EmptyState } from "@/components/ui/StateBlock";
import CustomSelect from "@/components/ui/CustomSelect";
import { StatusBadge } from "@/components/ui/Badge";
import SportMark from "@/components/ui/SportMark";
import PageHero, { Segmented } from "@/components/page/PageHero";
import { buttonClass } from "@/components/ui/Button";

// One fixture per row: the date block reads first, like a match-day board.
function FixtureRow({ t }: { t: TournamentSummary }) {
  const sport = getSportBySlug(t.sport);
  const start = new Date(t.startDate);
  const fill = t.maxTeams > 0 ? Math.min(t.teamsCount / t.maxTeams, 1) : 0;

  return (
    <li>
      <Link
        to={`/tournaments/${t.id}`}
        className="group grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-4 px-4 py-5 transition-colors hover:bg-surface-2 active:bg-base-2 sm:gap-6 sm:px-6 md:grid-cols-[5rem_minmax(0,1fr)_12rem_8rem_1.25rem]"
      >
        <span className="flex flex-col items-center justify-center rounded-xl border border-border bg-base-2 py-2">
          <span className="num font-display text-3xl font-bold leading-none text-ink">{start.getDate()}</span>
          <span className="mt-1 text-xs text-ink-muted">
            {start.toLocaleDateString(undefined, { month: "short", year: "2-digit" })}
          </span>
        </span>

        <span className="flex min-w-0 items-center gap-4">
          <SportMark slug={t.sport} size="md" className="hidden sm:block" />
          <span className="min-w-0">
            <span className="block truncate font-display text-xl font-bold text-ink group-hover:text-accent">
              {t.name}
            </span>
            <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
              <span>{sport?.name ?? t.sport}</span>
              {(t.province || t.location) && (
                <span className="flex min-w-0 items-center gap-1 text-ink-faint">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{t.location ? `${t.location}, ${t.province}` : t.province}</span>
                </span>
              )}
            </span>
          </span>
        </span>

        <span className="hidden flex-col gap-2 md:flex">
          <span className="flex items-baseline justify-between text-sm">
            <span className="text-ink-faint">Teams</span>
            <span className="num font-semibold text-ink">
              {t.teamsCount}
              <span className="text-ink-faint">/{t.maxTeams}</span>
            </span>
          </span>
          <span className="h-1.5 overflow-hidden rounded-full bg-base-2">
            <span
              className="block h-full origin-left rounded-full bg-accent"
              style={{ transform: `scaleX(${fill})` }}
            />
          </span>
        </span>

        <span className="justify-self-end">
          <StatusBadge status={t.status} />
        </span>
        <ChevronRight className="hidden h-5 w-5 text-ink-faint transition-transform group-hover:translate-x-0.5 md:block" />
      </Link>
    </li>
  );
}

const STATUS_FILTER_OPTIONS = [
  { value: "", label: "All" },
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
      setNearMeNotice("Set your province in your profile to use Near me.");
      return;
    }
    setNearMeNotice("");
    updateParam("near", nearMe ? "" : "1");
  }

  const activeSport = getSportBySlug(sport);

  return (
    <main className="flex-1">
      <PageHero
        title={activeSport ? `${activeSport.name} tournaments` : "Compete for glory"}
        image={activeSport?.image ?? "/sports/cricket.jpg"}
        imagePosition="center 40%"
        actions={
          <Link to="/tournaments/create" className={buttonClass({ variant: "premium", size: "lg" })}>
            <Plus className="h-4 w-4" /> Host a tournament
          </Link>
        }
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <Segmented value={status} options={STATUS_FILTER_OPTIONS} onChange={(v) => updateParam("status", v)} />
          </div>
          <CustomSelect
            value={sport}
            onChange={(v) => updateParam("sport", v)}
            options={SPORT_FILTER_OPTIONS}
            className="lg:w-60"
          />
          <button
            type="button"
            onClick={toggleNearMe}
            aria-pressed={nearMe}
            className={`inline-flex h-12 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold transition-colors ${
              nearMe
                ? "border-accent bg-accent-soft text-accent"
                : "border-border bg-base-2 text-ink-muted hover:border-ink-faint/50 hover:text-ink active:bg-base"
            }`}
          >
            <MapPin className="h-4 w-4" /> Near me
          </button>
        </div>
        {(nearMeNotice || (nearMe && user?.province)) && (
          <p className="-mt-4 text-sm">
            {nearMeNotice ? (
              <span className="text-premium">{nearMeNotice}</span>
            ) : (
              <span className="text-ink-muted">
                Showing tournaments in <span className="font-semibold text-ink">{user?.province}</span>.
              </span>
            )}
          </p>
        )}
      </PageHero>

      <div className="container-x py-12 md:py-16">
        {loading && <Loading label="Loading tournaments…" />}
        {!loading && error && <ErrorState message={error} />}
        {!loading && !error && tournaments.length === 0 && (
          <EmptyState
            title="No tournaments found"
            message={
              nearMe
                ? "No tournaments in your province yet. Try turning off Near me, or host your own."
                : "Try different filters, or host your own tournament."
            }
          />
        )}
        {!loading && !error && tournaments.length > 0 && (
          <>
            <p className="mb-4 text-sm text-ink-faint">
              <span className="num">{tournaments.length}</span> {tournaments.length === 1 ? "tournament" : "tournaments"}
            </p>
            <ul className="panel divide-y divide-border overflow-hidden">
              {tournaments.map((t) => (
                <FixtureRow key={t.id} t={t} />
              ))}
            </ul>
          </>
        )}
      </div>
    </main>
  );
}

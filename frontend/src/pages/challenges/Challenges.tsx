import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Check, Crown, LayoutGrid, Plus, Search, Swords, Users, X } from "lucide-react";
import api, { assetUrl } from "@/api/axios";
import { useAuth } from "@/context/AuthContext";
import { SPORTS, getSportBySlug } from "@/data/sports";
import type { Challenge, PlayerSummary, TeamSummary } from "@/types";
import { apiError } from "@/types";
import { Loading, ErrorState, EmptyState } from "@/components/ui/StateBlock";
import { Input } from "@/components/ui/Field";
import { buttonClass } from "@/components/ui/Button";
import SportMark, { Initials } from "@/components/ui/SportMark";
import PageHero, { Segmented } from "@/components/page/PageHero";
import ChallengeRow from "@/components/challenge/ChallengeRow";
import { isChallenger, isPast, isTarget } from "@/components/challenge/challengeUtils";

type Tab = "open" | "find" | "mine";
type Mode = "" | "team" | "player";

const chip = (active: boolean) =>
  `inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-4 text-sm font-medium transition-colors ${
    active
      ? "border-accent bg-accent-soft text-accent"
      : "border-border text-ink-muted hover:border-ink-faint/50 hover:text-ink active:bg-surface"
  }`;

function newChallengeLink(params: Record<string, string | undefined>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
  const s = q.toString();
  return `/challenges/new${s ? `?${s}` : ""}`;
}

/* ---------------------------------------------------------------- open */

function OpenChallenges({ sport, mode }: { sport: string; mode: Mode }) {
  const { user } = useAuth();
  const [items, setItems] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    api
      .get("/challenges", { params: { sport: sport || undefined, mode: mode || undefined } })
      .then(({ data }) => alive && setItems(data.challenges ?? []))
      .catch((err) => alive && setError(apiError(err, "Could not load challenges.")))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [sport, mode]);

  if (loading) return <Loading label="Loading challenges…" />;
  if (error) return <ErrorState message={error} />;
  if (items.length === 0) {
    return (
      <EmptyState
        icon={<Swords className="h-5 w-5" />}
        title="No open challenges yet"
        message="Be the first: set a time, pick a ground if you like, and let someone take you on."
        action={
          <Link to={newChallengeLink({ sport, mode })} className={buttonClass({ size: "sm", className: "mt-2" })}>
            <Plus className="h-4 w-4" /> Post a challenge
          </Link>
        }
      />
    );
  }
  return (
    <>
      <p className="mb-4 text-sm text-ink-muted">
        <span className="num font-semibold text-ink">{items.length}</span> open{" "}
        {items.length === 1 ? "challenge" : "challenges"}, soonest first
      </p>
      <ul className="panel divide-y divide-border overflow-hidden">
        {items.map((c) => (
          <ChallengeRow
            key={c.id}
            c={c}
            action={
              !isChallenger(c, user) ? (
                <Link to={`/challenges/${c.id}`} className={buttonClass({ size: "sm" })}>
                  Take it on
                </Link>
              ) : (
                <span className="text-sm text-ink-faint">Yours</span>
              )
            }
          />
        ))}
      </ul>
    </>
  );
}

/* ---------------------------------------------------------------- find */

function FindOpponents({ sport, mode }: { sport: string; mode: Mode }) {
  const { user } = useAuth();
  const kind: "team" | "player" = mode === "player" ? "player" : "team";
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [players, setPlayers] = useState<PlayerSummary[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    const req =
      kind === "team"
        ? api.get("/teams", { params: { sport: sport || undefined, search: search || undefined } }).then(({ data }) => {
            if (alive) setTeams(data.teams ?? []);
          })
        : api.get("/players", { params: { sport: sport || undefined, search: search || undefined } }).then(({ data }) => {
            if (alive) setPlayers(data.players ?? []);
          });
    req
      .catch((err) => alive && setError(apiError(err, "Could not load opponents.")))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [kind, sport, search]);

  const visibleTeams = teams.filter((t) => t.owner?.id !== user?.id);
  const visiblePlayers = players.filter((p) => p.id !== user?.id);
  const count = kind === "team" ? visibleTeams.length : visiblePlayers.length;

  return (
    <>
      <form
        role="search"
        className="relative mb-6 max-w-xl"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(searchInput.trim());
        }}
      >
        <Search className="pointer-events-none absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-ink-faint" />
        <Input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder={kind === "team" ? "Search teams by name" : "Search players by name"}
          aria-label="Search opponents"
          className="pl-11"
        />
      </form>

      {loading && <Loading label="Finding opponents…" />}
      {!loading && error && <ErrorState message={error} />}
      {!loading && !error && count === 0 && (
        <EmptyState
          icon={<Users className="h-5 w-5" />}
          title={kind === "team" ? "No teams to challenge" : "No players to challenge"}
          message="Try another sport, or post an open challenge anyone can take."
        />
      )}
      {!loading && !error && count > 0 && (
        <>
          <p className="mb-4 text-sm text-ink-muted">
            <span className="num font-semibold text-ink">{count}</span>{" "}
            {kind === "team" ? (count === 1 ? "team" : "teams") : count === 1 ? "player" : "players"} ready to play
          </p>
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,17rem),1fr))] gap-4">
            {kind === "team"
              ? visibleTeams.map((t) => {
                  const s = getSportBySlug(t.sport);
                  return (
                    <li key={t.id} className="panel flex flex-col overflow-hidden">
                      <div className="relative h-20 overflow-hidden bg-surface-2">
                        {s?.image && <img src={s.image} alt="" loading="lazy" className="h-full w-full object-cover opacity-45" />}
                        <span className="photo-veil-bottom absolute inset-0" />
                        <span className="absolute right-3 top-3 rounded-full bg-base/80 px-2.5 py-1 text-xs text-ink-muted">
                          {s?.name}
                        </span>
                      </div>
                      <div className="-mt-7 flex flex-1 flex-col px-5 pb-5">
                        {t.logo ? (
                          <img src={assetUrl(t.logo)} alt="" className="relative h-14 w-14 rounded-xl border-4 border-surface object-cover" />
                        ) : (
                          <SportMark slug={t.sport} className="relative !h-14 !w-14 border-4 border-surface" />
                        )}
                        <Link to={`/teams/${t.id}`} className="mt-3 truncate font-display text-2xl font-bold text-ink hover:text-accent">
                          {t.name}
                        </Link>
                        <p className="text-sm text-ink-muted">
                          <span className="num">{t.memberCount}</span> members, by {t.owner?.name ?? "unknown"}
                        </p>
                        <Link
                          to={newChallengeLink({ sport: t.sport, mode: "team", opponentTeam: t.id })}
                          className={buttonClass({ size: "sm", fullWidth: true, className: "mt-5" })}
                        >
                          <Swords className="h-4 w-4" /> Challenge team
                        </Link>
                      </div>
                    </li>
                  );
                })
              : visiblePlayers.map((p) => (
                  <li key={p.id} className="panel flex items-center gap-4 p-4">
                    {p.photo ? (
                      <img src={assetUrl(p.photo)} alt="" className="h-16 w-16 shrink-0 rounded-full object-cover" />
                    ) : (
                      <Initials name={p.name} className="h-16 w-16 rounded-full text-xl" />
                    )}
                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/players/${p.id}`}
                        className="flex items-center gap-1.5 truncate font-display text-xl font-bold text-ink hover:text-accent"
                      >
                        <span className="truncate">{p.name}</span>
                        {p.isPremium && <Crown className="h-3.5 w-3.5 shrink-0 text-premium" />}
                      </Link>
                      <p className="truncate text-sm text-ink-faint">
                        {p.sportPreferences?.length
                          ? p.sportPreferences.map((sl) => getSportBySlug(sl)?.name ?? sl).join(", ")
                          : "Any sport"}
                      </p>
                      <Link
                        to={newChallengeLink({
                          sport: sport || (p.sportPreferences?.length === 1 ? p.sportPreferences[0] : undefined),
                          mode: "player",
                          opponentUser: p.id,
                        })}
                        className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline"
                      >
                        <Swords className="h-3.5 w-3.5" /> Challenge
                      </Link>
                    </div>
                  </li>
                ))}
          </ul>
        </>
      )}
    </>
  );
}

/* ---------------------------------------------------------------- mine */

function MyChallenges() {
  const { user } = useAuth();
  const [items, setItems] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    api
      .get("/challenges/mine")
      .then(({ data }) => setItems(data.challenges ?? []))
      .catch((err) => setError(apiError(err, "Could not load your challenges.")))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function respond(c: Challenge, action: "accept" | "decline") {
    setBusy(c.id);
    setActionError("");
    try {
      await api.post(`/challenges/${c.id}/${action}`, {});
      load();
    } catch (err) {
      setActionError(apiError(err, `Could not ${action} this challenge.`));
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <Loading label="Loading your challenges…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const live = items.filter((c) => !isPast(c));
  const waiting = live.filter((c) => isTarget(c, user));
  const upcoming = live.filter((c) => c.status === "accepted");
  const sent = live.filter((c) => isChallenger(c, user) && (c.status === "open" || c.status === "pending"));
  const closed = items.filter((c) => !waiting.includes(c) && !upcoming.includes(c) && !sent.includes(c));

  const section = (title: string, list: Challenge[], empty: string, action?: (c: Challenge) => ReactNode) => (
    <section>
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="font-display text-3xl font-bold text-ink">{title}</h2>
        <span className="num text-sm text-ink-faint">{list.length}</span>
      </div>
      {list.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-base-2 px-5 py-6 text-sm text-ink-muted">{empty}</p>
      ) : (
        <ul className="panel divide-y divide-border overflow-hidden">
          {list.map((c) => (
            <ChallengeRow key={c.id} c={c} action={action?.(c)} />
          ))}
        </ul>
      )}
    </section>
  );

  return (
    <div className="flex flex-col gap-12">
      {actionError && (
        <p role="alert" className="rounded-xl border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-danger">
          {actionError}
        </p>
      )}
      {section("Waiting on you", waiting, "Nobody has challenged you yet.", (c) => (
          <span className="flex gap-2">
            <button
              type="button"
              disabled={busy === c.id}
              onClick={() => respond(c, "accept")}
              className={buttonClass({ size: "sm" })}
            >
              <Check className="h-4 w-4" /> Accept
            </button>
            <button
              type="button"
              disabled={busy === c.id}
              onClick={() => respond(c, "decline")}
              className={buttonClass({ variant: "secondary", size: "sm" })}
            >
              <X className="h-4 w-4" /> Decline
            </button>
          </span>
      ))}
      {section("Upcoming matches", upcoming, "No matches fixed yet. Take on an open challenge to get one.")}
      {section("Sent by you", sent, "You haven't posted a challenge yet.")}
      {closed.length > 0 && section("Past and closed", closed, "")}
    </div>
  );
}

/* ---------------------------------------------------------------- page */

export default function Challenges() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as Tab) || "open";
  const sport = params.get("sport") ?? "";
  const mode = (params.get("mode") as Mode) ?? "";

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  }

  const activeSport = getSportBySlug(sport);
  const tabs: { value: Tab; label: string }[] = [
    { value: "open", label: "Open challenges" },
    { value: "find", label: "Find opponents" },
    ...(user ? [{ value: "mine" as Tab, label: "My challenges" }] : []),
  ];
  const effectiveTab = tab === "mine" && !user ? "open" : tab;

  return (
    <main className="flex-1">
      <PageHero
        size="lg"
        title={activeSport ? `${activeSport.name} challenges` : "Find your next opponent"}
        lead="Post a challenge or take one on, team against team or one on one."
        image={activeSport?.image ?? "/sports/kabaddi.webp"}
        imagePosition="center 35%"
        actions={
          <Link to={newChallengeLink({ sport, mode })} className={buttonClass({ size: "lg" })}>
            <Swords className="h-4 w-4" /> Post a challenge
          </Link>
        }
      >
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <Segmented value={effectiveTab} options={tabs} onChange={(v) => updateParam("tab", v === "open" ? "" : v)} />
        </div>
      </PageHero>

      {effectiveTab !== "mine" && (
        <div className="sticky top-16 z-30 border-b border-border bg-base/95 backdrop-blur">
          <div className="container-x flex flex-col gap-3 py-3 lg:flex-row lg:items-center lg:justify-between">
            <nav aria-label="Sport" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              <ul className="flex w-max gap-2">
                <li>
                  <button type="button" onClick={() => updateParam("sport", "")} className={chip(sport === "")}>
                    <LayoutGrid className="h-4 w-4" /> All sports
                  </button>
                </li>
                {SPORTS.map((s) => (
                  <li key={s.slug}>
                    <button
                      type="button"
                      onClick={() => updateParam("sport", s.slug)}
                      className={`${chip(sport === s.slug)} pl-1`}
                    >
                      {s.image && <img src={s.image} alt="" className="h-8 w-8 rounded-full object-cover" />}
                      {s.name}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
            <div className="shrink-0">
              <Segmented
                value={effectiveTab === "find" ? (mode === "player" ? "player" : "team") : mode}
                options={
                  effectiveTab === "find"
                    ? [
                        { value: "team", label: "Teams" },
                        { value: "player", label: "Players" },
                      ]
                    : [
                        { value: "", label: "All" },
                        { value: "team", label: "Teams" },
                        { value: "player", label: "1 on 1" },
                      ]
                }
                onChange={(v) => updateParam("mode", v)}
              />
            </div>
          </div>
        </div>
      )}

      <div className="container-x py-10 md:py-14">
        {effectiveTab === "open" && <OpenChallenges sport={sport} mode={mode} />}
        {effectiveTab === "find" && <FindOpponents sport={sport} mode={mode} />}
        {effectiveTab === "mine" && <MyChallenges />}
      </div>
    </main>
  );
}

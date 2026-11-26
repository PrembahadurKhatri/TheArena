import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, CheckCircle2, Globe2, LogIn, MapPin, Shield, Swords, User, X } from "lucide-react";
import api, { assetUrl } from "@/api/axios";
import { useAuth } from "@/context/AuthContext";
import { getSportBySlug } from "@/data/sports";
import { PROVINCE_OPTIONS } from "@/data/provinces";
import type { GroundAvailability, GroundSummary, TeamSummary } from "@/types";
import { apiError } from "@/types";
import { Input, Textarea } from "@/components/ui/Field";
import CustomSelect from "@/components/ui/CustomSelect";
import Button, { buttonClass } from "@/components/ui/Button";
import SportMark, { Initials } from "@/components/ui/SportMark";
import SportPicker from "@/components/page/SportPicker";
import GatePanel from "@/components/page/GatePanel";
import { Segmented } from "@/components/page/PageHero";
import { FormError } from "@/components/page/AuthShell";

type Mode = "team" | "player";
interface Opponent {
  kind: Mode;
  id: string;
  name: string;
  image: string | null;
  sport?: string;
}

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

function nepalToday() {
  return new Date(Date.now() + (5 * 60 + 45) * 60 * 1000).toISOString().slice(0, 10);
}

function Step({ n, title, hint, children }: { n: number; title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="panel p-6 md:p-8">
      <div className="flex items-start gap-4">
        <span className="num flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft font-display text-lg font-bold text-accent">
          {n}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-2xl font-bold text-ink">{title}</h2>
          {hint && <p className="mt-0.5 text-sm text-ink-muted">{hint}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </section>
  );
}

export default function ChallengeCreate() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [sport, setSport] = useState(params.get("sport") || "");
  const [mode, setMode] = useState<Mode>(params.get("mode") === "player" ? "player" : "team");
  const [opponent, setOpponent] = useState<Opponent | null>(null);
  const [myTeams, setMyTeams] = useState<TeamSummary[]>([]);
  const [teamId, setTeamId] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [useGround, setUseGround] = useState(false);
  const [grounds, setGrounds] = useState<GroundSummary[]>([]);
  const [groundId, setGroundId] = useState("");
  const [availability, setAvailability] = useState<GroundAvailability | null>(null);
  const [province, setProvince] = useState(user?.province ?? "");
  const [venueNote, setVenueNote] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Opponent picked from "Find opponents".
  useEffect(() => {
    const teamParam = params.get("opponentTeam");
    const userParam = params.get("opponentUser");
    if (teamParam) {
      api
        .get(`/teams/${teamParam}`)
        .then(({ data }) => {
          const t = data.team;
          setOpponent({ kind: "team", id: t.id, name: t.name, image: t.logo ?? null, sport: t.sport });
          setMode("team");
          setSport(t.sport);
        })
        .catch(() => setOpponent(null));
    } else if (userParam) {
      api
        .get(`/players/${userParam}`)
        .then(({ data }) => {
          const p = data.player;
          setOpponent({ kind: "player", id: p.id, name: p.name, image: p.photo ?? null });
          setMode("player");
        })
        .catch(() => setOpponent(null));
    }
  }, [params]);

  useEffect(() => {
    if (!user) return;
    api
      .get("/my/teams")
      .then(({ data }) => setMyTeams((data.teams ?? []).filter((t: TeamSummary) => t.role === "owner" || t.role === "captain")))
      .catch(() => setMyTeams([]));
  }, [user]);

  const teamsForSport = useMemo(() => myTeams.filter((t) => t.sport === sport), [myTeams, sport]);
  useEffect(() => {
    if (!teamsForSport.some((t) => t.id === teamId)) setTeamId(teamsForSport[0]?.id ?? "");
  }, [teamsForSport, teamId]);

  useEffect(() => {
    if (!useGround || !sport) return;
    api
      .get("/grounds", { params: { sport } })
      .then(({ data }) => setGrounds(data.grounds ?? []))
      .catch(() => setGrounds([]));
  }, [useGround, sport]);

  useEffect(() => {
    if (!grounds.some((g) => g.id === groundId)) setGroundId("");
  }, [grounds, groundId]);

  useEffect(() => {
    setAvailability(null);
    if (!useGround || !groundId || !date) return;
    let alive = true;
    api
      .get(`/grounds/${groundId}/availability`, { params: { date } })
      .then(({ data }) => alive && setAvailability(data))
      .catch(() => alive && setAvailability(null));
    return () => {
      alive = false;
    };
  }, [useGround, groundId, date]);

  const clash = useMemo(() => {
    if (!availability || !startTime || !endTime) return null;
    const s = toMin(startTime);
    const e = toMin(endTime);
    return availability.taken.find((t) => s < toMin(t.endTime) && toMin(t.startTime) < e) ?? null;
  }, [availability, startTime, endTime]);

  const opponentLocked = !!opponent;
  const sportDef = getSportBySlug(sport);
  const ground = grounds.find((g) => g.id === groundId);
  const hours = startTime && endTime && toMin(endTime) > toMin(startTime) ? (toMin(endTime) - toMin(startTime)) / 60 : 0;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!sport) return setError("Pick a sport.");
    if (mode === "team" && !teamId) return setError(`You need a ${sportDef?.name ?? ""} team you own to play a team match.`);
    if (!hours) return setError("End time must be after start time.");
    if (useGround && !groundId) return setError("Pick a ground, or switch the ground option off.");
    if (clash) return setError("That ground is taken at this time. Pick another slot or ground.");
    setError("");
    setBusy(true);
    try {
      const { data } = await api.post("/challenges", {
        sport,
        mode,
        teamId: mode === "team" ? teamId : undefined,
        opponentTeamId: opponent?.kind === "team" ? opponent.id : undefined,
        opponentUserId: opponent?.kind === "player" ? opponent.id : undefined,
        date,
        startTime,
        endTime,
        groundId: useGround ? groundId : undefined,
        province: province || undefined,
        venueNote: !useGround ? venueNote || undefined : undefined,
        message: message || undefined,
      });
      navigate(`/challenges/${data.challenge.id}`);
    } catch (err) {
      setError(apiError(err, "Could not post your challenge."));
    } finally {
      setBusy(false);
    }
  }

  if (!user) {
    return (
      <GatePanel icon={<LogIn className="h-6 w-6" />} title="Log in to post a challenge">
        <p className="mt-3 text-ink-muted">You’ll need an account so your opponent knows who they’re playing.</p>
        <Link
          to="/login"
          state={{ from: `/challenges/new${params.toString() ? `?${params}` : ""}` }}
          className={buttonClass({ size: "lg", className: "mt-8" })}
        >
          Log in
        </Link>
      </GatePanel>
    );
  }

  return (
    <main className="flex-1">
      <section className="relative isolate overflow-hidden border-b border-border bg-base-2">
        {sportDef?.image && (
          <img
            src={sportDef.image}
            alt=""
            className="absolute inset-y-0 right-0 -z-10 h-full w-full object-cover opacity-70 md:w-[62%]"
          />
        )}
        <div className="masthead-veil absolute inset-0 -z-10" />
        <div className="container-x flex min-h-[280px] flex-col justify-end pb-10 pt-16">
          <Link to="/challenges" className="mb-auto inline-flex w-fit items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
            <ArrowLeft className="h-4 w-4" /> Challenges
          </Link>
          <h1 className="mt-10 font-display text-5xl font-bold leading-[0.95] text-ink md:text-7xl">
            {opponent ? `Challenge ${opponent.name}` : "Post a challenge"}
          </h1>
        </div>
      </section>

      <div className="container-x grid gap-10 py-12 md:py-16 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)]">
        <form onSubmit={onSubmit} className="flex flex-col gap-6">
          <Step n={1} title="The match" hint="What you’re playing, and who against.">
            <div className="flex flex-col gap-6">
              {opponent?.kind === "team" ? (
                <p className="flex items-center gap-3 text-sm text-ink-muted">
                  <SportMark slug={sport} size="sm" /> {sportDef?.name} team match, set by {opponent.name}’s sport.
                </p>
              ) : (
                <SportPicker value={sport} onChange={setSport} />
              )}

              {!opponentLocked && (
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-ink-muted">Format</span>
                  <Segmented
                    value={mode}
                    options={[
                      { value: "team", label: "Team against team" },
                      { value: "player", label: "One on one" },
                    ]}
                    onChange={setMode}
                  />
                </div>
              )}

              {mode === "team" && sport && (
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-ink-muted">
                    Your team <span className="text-accent">*</span>
                  </span>
                  {teamsForSport.length > 0 ? (
                    <CustomSelect
                      value={teamId}
                      onChange={setTeamId}
                      options={teamsForSport.map((t) => ({ value: t.id, label: t.name, image: t.logo ? assetUrl(t.logo) ?? undefined : undefined }))}
                    />
                  ) : (
                    <p className="rounded-xl border border-premium/30 bg-premium-soft px-4 py-3 text-sm text-premium">
                      You don’t own a {sportDef?.name} team yet.{" "}
                      <Link to="/teams/create" className="font-semibold underline">
                        Create one
                      </Link>{" "}
                      or switch to one on one.
                    </p>
                  )}
                </div>
              )}

              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium text-ink-muted">Opponent</span>
                {opponent ? (
                  <div className="flex items-center gap-3 rounded-xl border border-accent/30 bg-accent-soft p-3">
                    {opponent.image ? (
                      <img
                        src={assetUrl(opponent.image)}
                        alt=""
                        className={`h-11 w-11 object-cover ${opponent.kind === "team" ? "rounded-lg" : "rounded-full"}`}
                      />
                    ) : opponent.kind === "team" ? (
                      <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-base-2 text-accent">
                        <Shield className="h-5 w-5" />
                      </span>
                    ) : (
                      <Initials name={opponent.name} className="h-11 w-11 rounded-full" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-ink">{opponent.name}</span>
                      <span className="block text-sm text-ink-muted">Only they can accept</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setOpponent(null);
                        navigate("/challenges/new", { replace: true });
                      }}
                      aria-label="Make it an open challenge instead"
                      className="flex h-9 w-9 items-center justify-center rounded-full text-ink-muted hover:bg-base-2 hover:text-ink"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 rounded-xl border border-border bg-base-2 p-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-dashed border-accent/50 text-accent">
                      <Globe2 className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-ink">Open to anyone</span>
                      <span className="block text-sm text-ink-muted">
                        The first {mode === "team" ? "team" : "player"} to accept gets the match.{" "}
                        <Link to={`/challenges?tab=find${sport ? `&sport=${sport}` : ""}&mode=${mode}`} className="text-accent hover:underline">
                          Pick someone instead
                        </Link>
                      </span>
                    </span>
                  </div>
                )}
              </div>
            </div>
          </Step>

          <Step n={2} title="When">
            <div className="grid gap-5 sm:grid-cols-3">
              <Input
                id="ch-date"
                label="Date"
                type="date"
                required
                min={nepalToday()}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
              <Input id="ch-start" label="Start" type="time" required value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              <Input id="ch-end" label="End" type="time" required value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </Step>

          <Step n={3} title="Where" hint="Optional. Pick a ground to check it’s free, or just say where.">
            <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-border bg-base-2 p-4 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent">
              <span>
                <span className="block font-semibold text-ink">Play at a listed ground</span>
                <span className="block text-sm text-ink-muted">We’ll check the slot against its bookings.</span>
              </span>
              <input type="checkbox" checked={useGround} onChange={(e) => setUseGround(e.target.checked)} className="peer sr-only" />
              <span
                aria-hidden="true"
                className="relative h-6 w-11 shrink-0 rounded-full bg-surface-2 ring-1 ring-border transition-colors peer-checked:bg-accent after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-ink after:transition-transform peer-checked:after:translate-x-5"
              />
            </label>

            {useGround ? (
              <div className="mt-5">
                {!sport ? (
                  <p className="text-sm text-ink-muted">Pick a sport first to see its grounds.</p>
                ) : grounds.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-border px-4 py-5 text-sm text-ink-muted">
                    No {sportDef?.name} grounds are listed yet. Switch this off and name a venue instead.
                  </p>
                ) : (
                  <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,13rem),1fr))] gap-3" role="radiogroup" aria-label="Ground">
                    {grounds.map((g) => {
                      const active = g.id === groundId;
                      const photo = g.image ? assetUrl(g.image) : sportDef?.image;
                      return (
                        <li key={g.id}>
                          <button
                            type="button"
                            role="radio"
                            aria-checked={active}
                            onClick={() => setGroundId(g.id)}
                            className={`relative flex w-full flex-col overflow-hidden rounded-xl border-2 text-left transition-colors ${
                              active ? "border-accent" : "border-border hover:border-ink-faint/60"
                            }`}
                          >
                            <span className="relative block aspect-[16/9] bg-surface-2">
                              {photo && <img src={photo} alt="" className="h-full w-full object-cover" />}
                              {active && (
                                <CheckCircle2 className="absolute right-2 top-2 h-6 w-6 rounded-full bg-base text-accent" />
                              )}
                            </span>
                            <span className="block p-3">
                              <span className="block truncate font-semibold text-ink">{g.name}</span>
                              <span className="block truncate text-xs text-ink-muted">{g.location}</span>
                              <span className="num mt-1 block text-xs text-ink-faint">Rs {g.pricePerHour} per hour</span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {groundId && date && availability && (
                  <div className="mt-5 rounded-xl border border-border bg-base-2 p-4">
                    <p className="text-sm font-semibold text-ink">
                      {ground?.name} on{" "}
                      {new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
                    </p>
                    {availability.taken.length === 0 ? (
                      <p className="mt-1 text-sm text-success">Free all day.</p>
                    ) : (
                      <>
                        <p className="mt-1 text-sm text-ink-muted">Already taken:</p>
                        <ul className="mt-2 flex flex-wrap gap-2">
                          {availability.taken.map((t, i) => (
                            <li key={i} className="num rounded-full border border-border bg-surface px-3 py-1 text-xs text-ink-muted">
                              {t.startTime} to {t.endTime}
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                    {startTime && endTime && (
                      <p className={`mt-3 flex items-center gap-2 text-sm font-semibold ${clash ? "text-danger" : "text-success"}`}>
                        {clash ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                        {clash
                          ? `Your slot overlaps ${clash.startTime} to ${clash.endTime}.`
                          : `${startTime} to ${endTime} is free.`}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <Input
                  id="ch-venue"
                  label="Venue"
                  value={venueNote}
                  maxLength={200}
                  onChange={(e) => setVenueNote(e.target.value)}
                  placeholder="e.g. Tundikhel, or to be agreed"
                />
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-ink-muted">Province</span>
                  <CustomSelect value={province} onChange={setProvince} options={PROVINCE_OPTIONS} placeholder="Select province" />
                </div>
              </div>
            )}
          </Step>

          <Step n={4} title="A word to your opponent" hint="Optional.">
            <Textarea
              id="ch-message"
              value={message}
              maxLength={500}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Format, rules, who brings the ball…"
            />
          </Step>

          {error && <FormError>{error}</FormError>}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" size="lg" loading={busy} disabled={!!clash} icon={<Swords className="h-4 w-4" />}>
              {opponent ? `Send challenge to ${opponent.name}` : "Post open challenge"}
            </Button>
            <Link to="/challenges" className={buttonClass({ variant: "ghost", size: "lg" })}>
              Cancel
            </Link>
          </div>
        </form>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <p className="mb-3 text-sm text-ink-faint">Preview</p>
          <div className="panel overflow-hidden">
            <div className="relative h-28 bg-surface-2">
              {sportDef?.image && <img src={sportDef.image} alt="" className="h-full w-full object-cover opacity-55" />}
              <span className="photo-veil-bottom absolute inset-0" />
              <span className="absolute bottom-3 left-5 font-display text-xl font-bold text-ink">
                {sportDef?.name ?? "Pick a sport"}
              </span>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 px-5 py-6 text-center">
              <div className="min-w-0">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white">
                  {mode === "team" ? <Shield className="h-6 w-6" /> : <User className="h-6 w-6" />}
                </span>
                <p className="mt-2 truncate text-sm font-semibold text-ink">
                  {mode === "team" ? teamsForSport.find((t) => t.id === teamId)?.name ?? "Your team" : user.name}
                </p>
              </div>
              <span className="font-display text-2xl font-bold text-ink-faint">vs</span>
              <div className="min-w-0">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed border-accent/50 text-accent">
                  {opponent ? <Swords className="h-6 w-6" /> : <Globe2 className="h-6 w-6" />}
                </span>
                <p className="mt-2 truncate text-sm font-semibold text-ink">{opponent?.name ?? "Anyone"}</p>
              </div>
            </div>
            <dl className="flex flex-col gap-2 border-t border-border px-5 py-4 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-ink-faint">When</dt>
                <dd className="num text-right text-ink">
                  {date ? new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "Pick a date"}
                  {hours ? `, ${startTime} to ${endTime}` : ""}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-faint">Where</dt>
                <dd className="flex min-w-0 items-center gap-1 text-right text-ink">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
                  <span className="truncate">
                    {useGround ? ground?.name ?? "Pick a ground" : venueNote || province || "To be agreed"}
                  </span>
                </dd>
              </div>
              {useGround && ground && hours > 0 && (
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-faint">Ground cost</dt>
                  <dd className="num text-ink">Rs {Math.round(ground.pricePerHour * hours)}</dd>
                </div>
              )}
            </dl>
          </div>
          {useGround && (
            <p className="mt-3 text-xs leading-relaxed text-ink-faint">
              Posting doesn’t book the ground. Once your match is on, book the slot from the challenge page to hold it.
            </p>
          )}
        </aside>
      </div>
    </main>
  );
}

import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, Check, Clock, LogIn, MapPin, MessageSquare, Swords, X } from "lucide-react";
import api, { assetUrl } from "@/api/axios";
import { useAuth } from "@/context/AuthContext";
import { getSportBySlug } from "@/data/sports";
import type { Challenge, ChallengeSide, TeamSummary } from "@/types";
import { apiError } from "@/types";
import { Loading, ErrorState } from "@/components/ui/StateBlock";
import Button, { buttonClass } from "@/components/ui/Button";
import CustomSelect from "@/components/ui/CustomSelect";
import { FormError } from "@/components/page/AuthShell";
import {
  ChallengeStatus,
  SideAvatar,
  dateParts,
  isChallenger,
  isPast,
  isTarget,
  otherSide,
  venueOf,
} from "@/components/challenge/challengeUtils";

function Side({ side, label, placeholder }: { side: ChallengeSide | null; label: string; placeholder: string }) {
  const href = side ? (side.kind === "team" ? `/teams/${side.id}` : `/players/${side.id}`) : null;
  return (
    <div className="flex min-w-0 flex-col items-center text-center">
      <SideAvatar side={side} className="h-24 w-24 md:h-32 md:w-32" />
      <p className="mt-4 text-sm text-ink-faint">{label}</p>
      {href ? (
        <Link to={href} className="mt-1 max-w-full truncate font-display text-3xl font-bold text-ink hover:text-accent md:text-4xl">
          {side!.name}
        </Link>
      ) : (
        <p className="mt-1 font-display text-3xl font-bold text-accent md:text-4xl">{placeholder}</p>
      )}
      {side?.kind === "team" && side.memberCount !== undefined && (
        <p className="num mt-1 text-sm text-ink-muted">{side.memberCount} members</p>
      )}
    </div>
  );
}

export default function ChallengeDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [c, setC] = useState<Challenge | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  const [myTeams, setMyTeams] = useState<TeamSummary[]>([]);
  const [teamId, setTeamId] = useState("");

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    setError("");
    api
      .get(`/challenges/${id}`)
      .then(({ data }) => setC(data.challenge))
      .catch((err) => setError(apiError(err, "Could not load this challenge.")))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!user || !c || c.mode !== "team" || c.status !== "open") return;
    api
      .get("/my/teams")
      .then(({ data }) => {
        const owned = (data.teams ?? []).filter(
          (t: TeamSummary) => t.owner?.id === user.id && t.sport === c.sport && t.id !== c.challenger?.id
        );
        setMyTeams(owned);
        setTeamId((cur) => cur || owned[0]?.id || "");
      })
      .catch(() => setMyTeams([]));
  }, [user, c]);

  async function act(action: "accept" | "decline" | "cancel") {
    if (!c) return;
    if (action === "cancel" && !confirm("Call off this challenge?")) return;
    setBusy(true);
    setActionError("");
    try {
      const { data } = await api.post(`/challenges/${c.id}/${action}`, action === "accept" && c.mode === "team" && c.status === "open" ? { teamId } : {});
      setC(data.challenge);
    } catch (err) {
      setActionError(apiError(err, "Something went wrong. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Loading label="Loading challenge…" />;
  if (error || !c) return <ErrorState message={error || "Challenge not found."} onRetry={load} />;

  const sport = getSportBySlug(c.sport);
  const d = dateParts(c.date);
  const past = isPast(c);
  const mine = isChallenger(c, user);
  const target = isTarget(c, user);
  const acceptor = !!user && c.acceptedByUserId === user.id;
  const right = otherSide(c);
  const canTake = !!user && !mine && c.status === "open" && !past;
  const bookHref = c.ground
    ? `/grounds/${c.ground.id}?date=${c.date}&start=${c.startTime}&end=${c.endTime}`
    : null;

  return (
    <main className="flex-1">
      <section className="relative isolate overflow-hidden border-b border-border bg-base-2">
        {sport?.image && (
          <img src={sport.image} alt="" aria-hidden="true" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-30" />
        )}
        <div className="photo-veil-bottom absolute inset-0 -z-10" />
        <div className="container-x py-10 md:py-14">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link to="/challenges" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
              <ArrowLeft className="h-4 w-4" /> Challenges
            </Link>
            <ChallengeStatus c={c} />
          </div>

          <p className="mt-10 text-center text-sm font-medium text-ink-muted">
            {sport?.name ?? c.sport}, {c.mode === "team" ? "team against team" : "one on one"}
          </p>
          <div className="mx-auto mt-8 grid max-w-4xl grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-4 md:gap-10">
            <Side side={c.challenger} label="Challenger" placeholder="" />
            <span className="mt-10 flex h-14 w-14 items-center justify-center rounded-full border border-border bg-base font-display text-2xl font-bold text-ink md:mt-14 md:h-16 md:w-16">
              vs
            </span>
            <Side side={right} label={c.acceptedBy ? "Accepted by" : c.opponent ? "Challenged" : "Opponent"} placeholder="You?" />
          </div>
        </div>
      </section>

      <div className="container-x grid gap-10 py-12 md:py-16 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <section>
          <h2 className="font-display text-3xl font-bold text-ink">Match details</h2>
          <dl className="panel mt-6 divide-y divide-border">
            <div className="flex items-center gap-4 p-5">
              <CalendarDays className="h-5 w-5 shrink-0 text-accent" />
              <div>
                <dt className="text-sm text-ink-faint">Date</dt>
                <dd className="font-semibold text-ink">{d.long}</dd>
              </div>
            </div>
            <div className="flex items-center gap-4 p-5">
              <Clock className="h-5 w-5 shrink-0 text-accent" />
              <div>
                <dt className="text-sm text-ink-faint">Time</dt>
                <dd className="num font-semibold text-ink">
                  {c.startTime} to {c.endTime}
                </dd>
              </div>
            </div>
            <div className="flex items-center gap-4 p-5">
              <MapPin className="h-5 w-5 shrink-0 text-accent" />
              <div className="min-w-0 flex-1">
                <dt className="text-sm text-ink-faint">Venue</dt>
                <dd className="font-semibold text-ink">
                  {c.ground ? (
                    <Link to={`/grounds/${c.ground.id}`} className="hover:text-accent">
                      {c.ground.name}
                    </Link>
                  ) : (
                    venueOf(c)
                  )}
                </dd>
                {c.ground && <dd className="text-sm text-ink-muted">{c.ground.location}</dd>}
              </div>
              {c.ground?.image && (
                <img src={assetUrl(c.ground.image)} alt="" className="hidden h-14 w-20 shrink-0 rounded-lg object-cover sm:block" />
              )}
            </div>
            {c.message && (
              <div className="flex items-start gap-4 p-5">
                <MessageSquare className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                <div>
                  <dt className="text-sm text-ink-faint">Message from {c.challenger?.name}</dt>
                  <dd className="mt-1 whitespace-pre-line text-ink">{c.message}</dd>
                </div>
              </div>
            )}
          </dl>
        </section>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="panel p-6 md:p-7">
            {actionError && (
              <div className="mb-5">
                <FormError>{actionError}</FormError>
              </div>
            )}

            {c.status === "accepted" ? (
              <div className="flex flex-col gap-4">
                <h2 className="font-display text-3xl font-bold text-ink">The match is on</h2>
                <p className="text-ink-muted">
                  {c.challenger?.name} plays {right?.name} on {d.long}.
                </p>
                {(mine || acceptor) && bookHref && !past && (
                  <>
                    <Link to={bookHref} className={buttonClass({ size: "lg", fullWidth: true })}>
                      <MapPin className="h-4 w-4" /> Book {c.ground!.name}
                    </Link>
                    <p className="text-xs text-ink-faint">Booking holds the slot so nobody else can take it.</p>
                  </>
                )}
                {(mine || acceptor) && !past && (
                  <Button variant="danger" fullWidth onClick={() => act("cancel")} loading={busy}>
                    Call off match
                  </Button>
                )}
              </div>
            ) : c.status === "declined" || c.status === "cancelled" ? (
              <div>
                <h2 className="font-display text-3xl font-bold text-ink">
                  {c.status === "declined" ? "Challenge declined" : "Challenge called off"}
                </h2>
                <p className="mt-2 text-ink-muted">This match won’t go ahead.</p>
                <Link to="/challenges/new" className={buttonClass({ variant: "secondary", fullWidth: true, className: "mt-6" })}>
                  <Swords className="h-4 w-4" /> Post a new challenge
                </Link>
              </div>
            ) : past ? (
              <div>
                <h2 className="font-display text-3xl font-bold text-ink">This challenge expired</h2>
                <p className="mt-2 text-ink-muted">Nobody took it before the start time.</p>
              </div>
            ) : mine ? (
              <div className="flex flex-col gap-4">
                <h2 className="font-display text-3xl font-bold text-ink">
                  {c.status === "open" ? "Waiting for a taker" : `Waiting on ${c.opponent?.name}`}
                </h2>
                <p className="text-ink-muted">
                  {c.status === "open"
                    ? "Your challenge is listed for everyone in this sport."
                    : "They’ll see it under My challenges and can accept or decline."}
                </p>
                <Button variant="danger" fullWidth onClick={() => act("cancel")} loading={busy}>
                  Withdraw challenge
                </Button>
              </div>
            ) : target ? (
              <div className="flex flex-col gap-4">
                <h2 className="font-display text-3xl font-bold text-ink">You’ve been challenged</h2>
                <p className="text-ink-muted">
                  {c.challenger?.name} wants to play {c.opponent?.kind === "team" ? c.opponent.name : "you"}.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <Button size="lg" onClick={() => act("accept")} loading={busy} icon={<Check className="h-4 w-4" />}>
                    Accept
                  </Button>
                  <Button size="lg" variant="secondary" onClick={() => act("decline")} disabled={busy} icon={<X className="h-4 w-4" />}>
                    Decline
                  </Button>
                </div>
              </div>
            ) : c.status === "pending" ? (
              <div>
                <h2 className="font-display text-3xl font-bold text-ink">A private challenge</h2>
                <p className="mt-2 text-ink-muted">Only {c.opponent?.name} can answer this one.</p>
              </div>
            ) : !user ? (
              <div className="flex flex-col items-center gap-3 py-2 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-2 text-ink-faint">
                  <LogIn className="h-5 w-5" />
                </span>
                <p className="text-ink-muted">Log in to take on this challenge.</p>
                <Link to="/login" state={{ from: `/challenges/${c.id}` }} className={buttonClass({ fullWidth: true })}>
                  Log in
                </Link>
              </div>
            ) : canTake ? (
              <div className="flex flex-col gap-4">
                <h2 className="font-display text-3xl font-bold text-ink">Take it on</h2>
                {c.mode === "team" ? (
                  myTeams.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      <span className="text-sm font-medium text-ink-muted">Play with</span>
                      <CustomSelect
                        value={teamId}
                        onChange={setTeamId}
                        options={myTeams.map((t) => ({ value: t.id, label: t.name }))}
                      />
                    </div>
                  ) : (
                    <p className="rounded-xl border border-premium/30 bg-premium-soft px-4 py-3 text-sm text-premium">
                      You need a {sport?.name} team you own to accept.{" "}
                      <Link to="/teams/create" className="font-semibold underline">
                        Create one
                      </Link>
                    </p>
                  )
                ) : (
                  <p className="text-ink-muted">You’ll play {c.challenger?.name} one on one.</p>
                )}
                <Button
                  size="lg"
                  fullWidth
                  onClick={() => act("accept")}
                  loading={busy}
                  disabled={c.mode === "team" && !teamId}
                  icon={<Swords className="h-4 w-4" />}
                >
                  Accept challenge
                </Button>
              </div>
            ) : null}
          </div>
        </aside>
      </div>
    </main>
  );
}

import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, Check, Clock, LogIn, MapPin, MessageSquare, Repeat, Swords, Trophy, X } from "lucide-react";
import api, { assetUrl } from "@/api/axios";
import { useAuth } from "@/context/AuthContext";
import { getSportBySlug } from "@/data/sports";
import type { Challenge, ChallengeSide, GroundSummary, TeamSummary } from "@/types";
import { apiError } from "@/types";
import { Loading, ErrorState } from "@/components/ui/StateBlock";
import Button, { buttonClass } from "@/components/ui/Button";
import CustomSelect from "@/components/ui/CustomSelect";
import { Input } from "@/components/ui/Field";
import { FormError } from "@/components/page/AuthShell";
import {
  ChallengeStatus,
  SideAvatar,
  currentTerms,
  dateParts,
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

interface NearbyGround {
  ground: GroundSummary;
  available: boolean;
}

/** "Find a Ground Near You" for an accepted match: optional booking, paid through the normal flow. */
function GroundFinder({ c, onBooked }: { c: Challenge; onBooked: (c: Challenge) => void }) {
  const [rows, setRows] = useState<NearbyGround[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [payment, setPayment] = useState<{ id: string; amount: number } | null>(null);
  const [paid, setPaid] = useState(false);

  useEffect(() => {
    const load = (params: Record<string, unknown> = {}) =>
      api
        .get(`/challenges/${c.id}/nearby-grounds`, { params })
        .then(({ data }) => setRows(data.grounds))
        .catch((err) => setError(apiError(err)));
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => load({ lat: pos.coords.latitude, lng: pos.coords.longitude, radiusKm: 25 }),
        () => load(),
        { timeout: 5000 }
      );
    } else load();
  }, [c.id]);

  async function book(groundId: string) {
    setBusy(groundId);
    setError("");
    try {
      const { data } = await api.post(`/challenges/${c.id}/book-ground`, { groundId });
      onBooked(data.challenge);
      const { data: pay } = await api.post("/payments/checkout", { type: "ground_booking", refId: data.booking.id });
      setPayment({ id: pay.payment.id, amount: pay.payment.amount });
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(null);
    }
  }

  async function confirmPayment() {
    if (!payment) return;
    setBusy("pay");
    setError("");
    try {
      await api.post(`/payments/${payment.id}/confirm`);
      setPaid(true);
    } catch (err) {
      setError(apiError(err, "Payment could not be completed."));
    } finally {
      setBusy(null);
    }
  }

  if (paid) return <p className="rounded-xl border border-success/25 bg-success/10 px-4 py-3 text-sm text-success">Ground booked and paid. See it under My bookings.</p>;
  if (payment) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-base-2 p-4">
        <p className="text-sm text-ink-muted">
          The slot is held for 15 minutes. Pay <span className="num font-semibold text-ink">Rs {payment.amount}</span> to confirm it.
        </p>
        {error && <FormError>{error}</FormError>}
        <Button onClick={confirmPayment} loading={busy === "pay"}>
          Pay now
        </Button>
        <p className="text-xs text-ink-faint">Online payment is in test mode until Khalti/eSewa are connected.</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-display text-xl font-semibold text-ink">Find a ground near you</h3>
      <p className="text-sm text-ink-muted">Optional: you can also arrange the venue yourselves.</p>
      {error && <FormError>{error}</FormError>}
      {!rows && <p className="text-sm text-ink-faint">Looking for grounds…</p>}
      {rows && rows.length === 0 && <p className="text-sm text-ink-faint">No grounds for this sport are listed nearby yet.</p>}
      {rows && rows.length > 0 && (
        <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
          {rows.slice(0, 6).map(({ ground: g, available }) => (
            <li key={g.id} className="flex items-center gap-3 p-3">
              <span className="min-w-0 flex-1">
                <Link to={`/grounds/${g.id}`} className="block truncate text-sm font-semibold text-ink hover:text-accent">
                  {g.name}
                </Link>
                <span className="block truncate text-xs text-ink-faint">
                  {g.location} · <span className="num">Rs {g.pricePerHour}/h</span>
                </span>
              </span>
              {available ? (
                <Button size="sm" loading={busy === g.id} onClick={() => book(g.id)}>
                  Book
                </Button>
              ) : (
                <span className="text-xs text-ink-faint">Taken</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Propose a different date, time or place. */
function CounterForm({ c, onDone, onCancel }: { c: Challenge; onDone: (c: Challenge) => void; onCancel: () => void }) {
  const t = currentTerms(c);
  const [form, setForm] = useState({ date: t.date, startTime: t.startTime, endTime: t.endTime, venueNote: t.venueNote ?? "", message: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          const { data } = await api.post(`/challenges/${c.id}/counter`, { ...form, groundId: "" });
          onDone(data.challenge);
        } catch (err) {
          setError(apiError(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <Input id="cdate" type="date" label="Date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
      <div className="grid grid-cols-2 gap-3">
        <Input id="cstart" type="time" label="Start" required value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
        <Input id="cend" type="time" label="End" required value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
      </div>
      <Input id="cvenue" label="Venue" maxLength={200} placeholder="e.g. Dasharath Stadium" value={form.venueNote} onChange={(e) => setForm({ ...form, venueNote: e.target.value })} />
      <Input id="cmsg" label="Message" maxLength={500} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
      {error && <FormError>{error}</FormError>}
      <div className="grid grid-cols-2 gap-3">
        <Button type="submit" loading={busy}>
          Send proposal
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Back
        </Button>
      </div>
    </form>
  );
}

function History({ c }: { c: Challenge }) {
  if (!c.counterProposals?.length) return null;
  const nameOf = (side: "challenger" | "opponent") => (side === "challenger" ? c.challenger?.name : otherSide(c)?.name);
  return (
    <section className="mt-10">
      <h2 className="font-display text-2xl font-bold text-ink">Proposals</h2>
      <ol className="mt-4 flex flex-col gap-3">
        <li className="panel p-4 text-sm">
          <span className="font-semibold text-ink">{c.challenger?.name}</span> <span className="text-ink-faint">proposed the original time</span>
        </li>
        {c.counterProposals.map((p, i) => (
          <li key={i} className="panel p-4 text-sm">
            <p>
              <span className="font-semibold text-ink">{nameOf(p.side)}</span>{" "}
              <span className="text-ink-faint">
                proposed {dateParts(p.date).long}, <span className="num">{p.startTime}–{p.endTime}</span>
                {p.ground ? ` at ${p.ground.name}` : p.venueNote ? ` at ${p.venueNote}` : ""}
              </span>
            </p>
            {p.message && <p className="mt-1 text-ink-muted">“{p.message}”</p>}
          </li>
        ))}
      </ol>
    </section>
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
  const [countering, setCountering] = useState(false);

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
        const mine = (data.teams ?? []).filter(
          (t: TeamSummary) => (t.role === "owner" || t.role === "captain") && t.sport === c.sport && t.id !== c.challenger?.id
        );
        setMyTeams(mine);
        setTeamId((cur) => cur || mine[0]?.id || "");
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
  const terms = currentTerms(c);
  const d = dateParts(terms.date);
  const past = isPast(c);
  const side = c.viewerSide ?? null;
  const myTurn = isTarget(c, user);
  const right = otherSide(c);
  const canTake = !!user && !side && c.status === "open" && !past;
  const negotiating = c.status === "pending" || c.status === "countered";
  const counters = c.counterProposals?.length ?? 0;

  return (
    <main className="flex-1">
      <section className="relative isolate overflow-hidden border-b border-border bg-base-2">
        {sport?.image && <img src={sport.image} alt="" aria-hidden="true" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-30" />}
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
            {c.format === "competitive" ? ", competitive" : ""}
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
          <h2 className="font-display text-3xl font-bold text-ink">{c.status === "countered" ? "Latest proposal" : "Match details"}</h2>
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
                  {terms.startTime} to {terms.endTime}
                </dd>
              </div>
            </div>
            <div className="flex items-center gap-4 p-5">
              <MapPin className="h-5 w-5 shrink-0 text-accent" />
              <div className="min-w-0 flex-1">
                <dt className="text-sm text-ink-faint">Venue</dt>
                <dd className="font-semibold text-ink">
                  {terms.ground ? (
                    <Link to={`/grounds/${terms.ground.id}`} className="hover:text-accent">
                      {terms.ground.name}
                    </Link>
                  ) : (
                    terms.venueNote || venueOf(c)
                  )}
                </dd>
                {terms.ground && <dd className="text-sm text-ink-muted">{terms.ground.location}{c.bookingId ? " · booked" : " · not booked yet"}</dd>}
              </div>
              {terms.ground?.image && <img src={assetUrl(terms.ground.image)} alt="" className="hidden h-14 w-20 shrink-0 rounded-lg object-cover sm:block" />}
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
          <History c={c} />
        </section>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="panel p-6 md:p-7">
            {actionError && (
              <div className="mb-5">
                <FormError>{actionError}</FormError>
              </div>
            )}

            {c.status === "accepted" || c.status === "completed" ? (
              <div className="flex flex-col gap-5">
                <h2 className="font-display text-3xl font-bold text-ink">{c.status === "completed" ? "Match played" : "The match is on"}</h2>
                <p className="text-ink-muted">
                  {c.challenger?.name} plays {right?.name} on {d.long}.
                </p>
                {c.matchId && (
                  <Link to={`/matches/${c.matchId}`} className={buttonClass({ variant: "secondary", fullWidth: true })}>
                    <Trophy className="h-4 w-4" /> Match page and result
                  </Link>
                )}
                {side && !past && c.status === "accepted" && !c.bookingId && <GroundFinder c={c} onBooked={setC} />}
                {side && !past && c.status === "accepted" && (
                  <Button variant="danger" fullWidth onClick={() => act("cancel")} loading={busy}>
                    Call off match
                  </Button>
                )}
              </div>
            ) : c.status === "declined" || c.status === "cancelled" || c.status === "expired" ? (
              <div>
                <h2 className="font-display text-3xl font-bold text-ink">
                  {c.status === "declined" ? "Challenge rejected" : c.status === "expired" ? "This challenge expired" : "Challenge called off"}
                </h2>
                <p className="mt-2 text-ink-muted">This match won’t go ahead.</p>
                <Link to="/challenges/new" className={buttonClass({ variant: "secondary", fullWidth: true, className: "mt-6" })}>
                  <Swords className="h-4 w-4" /> Post a new challenge
                </Link>
              </div>
            ) : past ? (
              <div>
                <h2 className="font-display text-3xl font-bold text-ink">This challenge expired</h2>
                <p className="mt-2 text-ink-muted">Nobody answered before the start time.</p>
              </div>
            ) : myTurn && countering ? (
              <CounterForm
                c={c}
                onCancel={() => setCountering(false)}
                onDone={(next) => {
                  setC(next);
                  setCountering(false);
                }}
              />
            ) : myTurn ? (
              <div className="flex flex-col gap-4">
                <h2 className="font-display text-3xl font-bold text-ink">{c.status === "countered" ? "They proposed a change" : "You’ve been challenged"}</h2>
                <p className="text-ink-muted">
                  {c.status === "countered"
                    ? "Accept the new time and place, propose another, or reject."
                    : `${c.challenger?.name} wants to play ${c.opponent?.kind === "team" ? c.opponent.name : "you"}.`}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <Button size="lg" onClick={() => act("accept")} loading={busy} icon={<Check className="h-4 w-4" />}>
                    Accept
                  </Button>
                  <Button size="lg" variant="secondary" onClick={() => act("decline")} disabled={busy} icon={<X className="h-4 w-4" />}>
                    Reject
                  </Button>
                </div>
                {counters < 5 && (
                  <Button variant="ghost" fullWidth onClick={() => setCountering(true)} icon={<Repeat className="h-4 w-4" />}>
                    Suggest another date or place
                  </Button>
                )}
              </div>
            ) : side && negotiating ? (
              <div className="flex flex-col gap-4">
                <h2 className="font-display text-3xl font-bold text-ink">Waiting on {side === "challenger" ? right?.name : c.challenger?.name}</h2>
                <p className="text-ink-muted">They can accept, reject or propose another time.</p>
                {side === "challenger" && (
                  <Button variant="danger" fullWidth onClick={() => act("cancel")} loading={busy}>
                    Withdraw challenge
                  </Button>
                )}
              </div>
            ) : side === "challenger" ? (
              <div className="flex flex-col gap-4">
                <h2 className="font-display text-3xl font-bold text-ink">Waiting for a taker</h2>
                <p className="text-ink-muted">Your challenge is listed for everyone in this sport.</p>
                <Button variant="danger" fullWidth onClick={() => act("cancel")} loading={busy}>
                  Withdraw challenge
                </Button>
              </div>
            ) : negotiating ? (
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
                      <CustomSelect value={teamId} onChange={setTeamId} options={myTeams.map((t) => ({ value: t.id, label: t.name }))} />
                    </div>
                  ) : (
                    <p className="rounded-xl border border-premium/30 bg-premium-soft px-4 py-3 text-sm text-premium">
                      You need a {sport?.name} team you own or captain to accept.{" "}
                      <Link to="/teams/create" className="font-semibold underline">
                        Create one
                      </Link>
                    </p>
                  )
                ) : (
                  <p className="text-ink-muted">You’ll play {c.challenger?.name} one on one.</p>
                )}
                <Button size="lg" fullWidth onClick={() => act("accept")} loading={busy} disabled={c.mode === "team" && !teamId} icon={<Swords className="h-4 w-4" />}>
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

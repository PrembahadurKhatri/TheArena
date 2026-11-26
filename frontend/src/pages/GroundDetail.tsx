import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Clock, LogIn, MapPin, Phone, ShieldCheck, XCircle } from "lucide-react";
import api, { assetUrl } from "@/api/axios";
import { useAuth } from "@/context/AuthContext";
import type { PaymentSummary } from "@/types";
import { apiError } from "@/types";
import { getSportBySlug } from "@/data/sports";
import { Loading, ErrorState } from "@/components/ui/StateBlock";
import { Input } from "@/components/ui/Field";
import Button, { buttonClass } from "@/components/ui/Button";
import { FormError } from "@/components/page/AuthShell";
import { SummaryRow, TestModeNote } from "@/components/page/Checkout";

interface Ground {
  id: string;
  name: string;
  slug: string | null;
  sport: string;
  sports: string[];
  location: string;
  address: string | null;
  district: string | null;
  province: string | null;
  municipality: string | null;
  pricePerHour: number;
  image: string | null;
  images: string[];
  amenities: string[];
  description: string | null;
  openingHours: { closed: boolean; open: string; close: string }[];
  slotMinutes: number;
  contactPhone: string | null;
  status: string;
  ownerId: string | null;
}

interface Slot {
  startTime: string;
  endTime: string;
  available: boolean;
  reason: string | null;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const todayNepal = () => new Date(Date.now() + 5.75 * 3600_000).toISOString().slice(0, 10);

type Step = "form" | "checkout" | "success" | "failed";

export default function GroundDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, refreshUser } = useAuth();
  const [searchParams] = useSearchParams();
  const [ground, setGround] = useState<Ground | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [date, setDate] = useState(searchParams.get("date") ?? todayNepal());
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [startIdx, setStartIdx] = useState<number | null>(null);
  const [length, setLength] = useState(1);
  const [method, setMethod] = useState<"online" | "pay_at_venue">("pay_at_venue");
  const [step, setStep] = useState<Step>("form");
  const [payment, setPayment] = useState<PaymentSummary | null>(null);
  const [bookingTotal, setBookingTotal] = useState(0);
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [photo, setPhoto] = useState(0);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api
      .get(`/grounds/${id}`)
      .then(({ data }) => setGround(data.ground))
      .catch((err) => setError(apiError(err, "Could not load this ground.")))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!ground || !date) return;
    setSlots(null);
    setStartIdx(null);
    api
      .get(`/grounds/${ground.id}/slots`, { params: { date } })
      .then(({ data }) => {
        setSlots(data.slots);
        // A challenge links here with ?start= to preselect its time.
        const wanted = searchParams.get("start");
        const i = wanted ? data.slots.findIndex((s: Slot) => s.startTime === wanted && s.available) : -1;
        if (i >= 0) setStartIdx(i);
      })
      .catch((err) => setFormError(apiError(err)));
  }, [ground, date, searchParams]);

  // How many consecutive free slots follow the chosen start.
  const maxLength = useMemo(() => {
    if (!slots || startIdx === null) return 0;
    let n = 0;
    for (let i = startIdx; i < slots.length && slots[i].available; i++) n++;
    return Math.min(n, 8);
  }, [slots, startIdx]);
  const chosen = startIdx !== null && slots ? { startTime: slots[startIdx].startTime, endTime: slots[startIdx + Math.min(length, maxLength) - 1].endTime } : null;
  const hours = chosen && ground ? (Math.min(length, maxLength) * ground.slotMinutes) / 60 : 0;
  const discount = user?.entitlements?.bookingDiscountPct ?? (user?.isPremium ? 10 : 0);
  const estimate = ground ? Math.round(ground.pricePerHour * hours * (1 - discount / 100) * 100) / 100 : 0;
  const isOwner = !!user && ground?.ownerId === user.id;

  async function book() {
    if (!ground || !chosen) return;
    setBusy(true);
    setFormError("");
    try {
      const { data } = await api.post("/ground-bookings", { groundId: ground.id, date, ...chosen, paymentMethod: method });
      setBookingTotal(data.booking.totalAmount);
      if (method === "pay_at_venue") {
        setStep("success");
      } else {
        const { data: pay } = await api.post("/payments/checkout", { type: "ground_booking", refId: data.booking.id });
        setPayment(pay.payment);
        setStep("checkout");
      }
    } catch (err) {
      setFormError(apiError(err, "Could not book this slot."));
    } finally {
      setBusy(false);
    }
  }

  async function confirmPayment() {
    if (!payment) return;
    setBusy(true);
    setFormError("");
    try {
      await api.post(`/payments/${payment.id}/confirm`);
      setStep("success");
      refreshUser();
    } catch (err) {
      setFormError(apiError(err, "Payment confirmation failed."));
    } finally {
      setBusy(false);
    }
  }

  async function failPayment() {
    if (!payment) return;
    await api.post(`/payments/${payment.id}/fail`).catch(() => undefined);
    setStep("failed");
  }

  if (loading) return <Loading label="Loading ground…" />;
  if (error || !ground) return <ErrorState message={error || "Ground not found."} />;
  const sport = getSportBySlug(ground.sport);
  const photos = ground.images.length ? ground.images.map(assetUrl) : [sport?.image].filter(Boolean) as string[];

  return (
    <main className="flex-1">
      <section className="border-b border-border bg-base-2">
        <div className="container-x grid gap-8 py-10 md:py-14 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          <div>
            <Link to="/grounds" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
              <ArrowLeft className="h-4 w-4" /> All grounds
            </Link>
            <div className="mt-6 overflow-hidden rounded-3xl border border-border bg-surface">
              {photos[photo] ? <img src={photos[photo]} alt={ground.name} className="aspect-[16/9] w-full object-cover" /> : <div className="aspect-[16/9]" />}
            </div>
            {photos.length > 1 && (
              <div className="mt-3 flex gap-2 overflow-x-auto">
                {photos.map((p, i) => (
                  <button key={p} onClick={() => setPhoto(i)} aria-label={`Photo ${i + 1}`} className={`h-16 w-24 shrink-0 overflow-hidden rounded-lg border-2 ${i === photo ? "border-accent" : "border-transparent"}`}>
                    <img src={p} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-col justify-end gap-4">
            {ground.status !== "approved" && <p className="rounded-xl border border-premium/30 bg-premium-soft px-4 py-2 text-sm text-premium">This listing is {ground.status} and only visible to you.</p>}
            <h1 className="font-display text-5xl font-bold leading-[0.95] text-ink md:text-6xl">{ground.name}</h1>
            <p className="flex items-center gap-1.5 text-ink-muted">
              <MapPin className="h-4 w-4" /> {[ground.address ?? ground.location, ground.municipality, ground.district].filter(Boolean).join(", ")}
            </p>
            <ul className="flex flex-wrap gap-2">
              {ground.sports.map((s) => (
                <li key={s} className="rounded-full bg-surface px-3 py-1 text-sm text-ink">
                  {getSportBySlug(s)?.name ?? s}
                </li>
              ))}
            </ul>
            <p className="num font-display text-4xl font-bold text-ink">
              Rs {ground.pricePerHour}
              <span className="text-lg font-normal text-ink-faint"> / hour</span>
            </p>
            {ground.contactPhone && (
              <a href={`tel:${ground.contactPhone}`} className="inline-flex items-center gap-2 text-sm text-accent hover:underline">
                <Phone className="h-4 w-4" /> {ground.contactPhone}
              </a>
            )}
          </div>
        </div>
      </section>

      <div className="container-x grid gap-10 py-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <section className="flex flex-col gap-8">
          {ground.description && <p className="whitespace-pre-line text-lg text-ink-muted">{ground.description}</p>}
          {ground.amenities.length > 0 && (
            <div>
              <h2 className="font-display text-2xl font-bold text-ink">Facilities</h2>
              <ul className="mt-4 flex flex-wrap gap-2">
                {ground.amenities.map((a) => (
                  <li key={a} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm text-ink-muted">
                    <ShieldCheck className="h-3.5 w-3.5 text-success" /> {a}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <h2 className="font-display text-2xl font-bold text-ink">Opening hours</h2>
            <dl className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              {ground.openingHours.map((d, i) => (
                <div key={i} className="rounded-xl bg-base-2 px-3 py-2">
                  <dt className="text-ink-faint">{DAYS[i]}</dt>
                  <dd className="num font-semibold text-ink">{d.closed ? "Closed" : `${d.open}–${d.close}`}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="panel p-6">
            {step === "success" ? (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <CheckCircle2 className="h-10 w-10 text-success" />
                <h2 className="font-display text-2xl font-bold text-ink">Booked</h2>
                <p className="text-ink-muted">
                  {date}, {chosen?.startTime}–{chosen?.endTime}. {method === "pay_at_venue" ? `Pay Rs ${bookingTotal} at the ground.` : "Payment received."}
                </p>
                <Link to="/dashboard" className={buttonClass({ variant: "secondary" })}>
                  See my bookings
                </Link>
              </div>
            ) : step === "failed" ? (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <XCircle className="h-10 w-10 text-danger" />
                <p className="text-ink-muted">Payment didn’t go through, so the slot was released.</p>
                <Button variant="secondary" onClick={() => setStep("form")}>
                  Try again
                </Button>
              </div>
            ) : step === "checkout" && payment ? (
              <div className="flex flex-col gap-4">
                <h2 className="font-display text-2xl font-bold text-ink">Pay online</h2>
                <dl className="flex flex-col gap-2">
                  <SummaryRow label="Slot" value={`${date}, ${chosen?.startTime}–${chosen?.endTime}`} />
                  <SummaryRow label="Total" value={`Rs ${payment.amount}`} />
                </dl>
                <TestModeNote />
                {formError && <FormError>{formError}</FormError>}
                <Button onClick={confirmPayment} loading={busy} fullWidth>
                  Pay Rs {payment.amount}
                </Button>
                <Button variant="ghost" onClick={failPayment} fullWidth>
                  Cancel
                </Button>
              </div>
            ) : !user ? (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <LogIn className="h-6 w-6 text-ink-faint" />
                <p className="text-ink-muted">Log in to book this ground.</p>
                <Link to="/login" state={{ from: `/grounds/${id}` }} className={buttonClass({ fullWidth: true })}>
                  Log in
                </Link>
              </div>
            ) : isOwner ? (
              <div className="flex flex-col gap-3">
                <p className="text-ink-muted">This is your ground.</p>
                <Link to="/owner" className={buttonClass({ fullWidth: true })}>
                  Open owner dashboard
                </Link>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <h2 className="font-display text-2xl font-bold text-ink">Book a slot</h2>
                <Input id="date" type="date" label="Date" min={todayNepal()} value={date} onChange={(e) => setDate(e.target.value)} />
                {!slots ? (
                  <p className="text-sm text-ink-faint">Loading slots…</p>
                ) : slots.length === 0 ? (
                  <p className="text-sm text-ink-muted">Closed on this day.</p>
                ) : (
                  <div className="grid grid-cols-3 gap-2" role="listbox" aria-label="Start time">
                    {slots.map((s, i) => {
                      const inRange = startIdx !== null && i >= startIdx && i < startIdx + Math.min(length, maxLength);
                      return (
                        <button
                          key={s.startTime}
                          type="button"
                          disabled={!s.available}
                          aria-selected={inRange}
                          onClick={() => {
                            setStartIdx(i);
                            setLength(1);
                          }}
                          className={`num rounded-lg border px-2 py-2 text-sm transition-colors ${
                            inRange ? "border-accent bg-accent text-white" : s.available ? "border-border hover:border-accent" : "cursor-not-allowed border-border bg-base-2 text-ink-faint line-through"
                          }`}
                          title={s.reason ?? undefined}
                        >
                          {s.startTime}
                        </button>
                      );
                    })}
                  </div>
                )}
                {chosen && (
                  <label className="flex items-center justify-between gap-3 text-sm text-ink-muted">
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-4 w-4" /> Duration
                    </span>
                    <select className="h-10 rounded-lg border border-border bg-base-2 px-3 text-ink" value={Math.min(length, maxLength)} onChange={(e) => setLength(Number(e.target.value))}>
                      {Array.from({ length: maxLength }, (_, k) => k + 1).map((n) => (
                        <option key={n} value={n}>
                          {(n * ground.slotMinutes) / 60} h ({slots![startIdx!].startTime}–{slots![startIdx! + n - 1].endTime})
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <fieldset className="flex flex-col gap-2 text-sm">
                  <legend className="mb-1 font-medium text-ink-muted">Payment</legend>
                  <label className="flex items-center gap-2">
                    <input type="radio" checked={method === "pay_at_venue"} onChange={() => setMethod("pay_at_venue")} /> Pay at the ground
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="radio" checked={method === "online"} onChange={() => setMethod("online")} /> Pay online now (test mode)
                  </label>
                </fieldset>
                {chosen && (
                  <p className="num text-sm text-ink-muted">
                    Total <span className="font-display text-2xl font-bold text-ink">Rs {estimate}</span>
                    {discount ? <span className="ml-1 text-premium">({discount}% member discount)</span> : null}
                  </p>
                )}
                {formError && <FormError>{formError}</FormError>}
                <Button onClick={book} disabled={!chosen} loading={busy} fullWidth size="lg">
                  Book
                </Button>
                <p className="text-xs text-ink-faint">Free cancellation up to 2 hours before the start, from your dashboard.</p>
              </div>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}

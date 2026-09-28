import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { CheckCircle2, FlaskConical, LogIn, MapPin, ShieldCheck, Tent, XCircle } from "lucide-react";
import api from "@/api/axios";
import { useAuth } from "@/context/AuthContext";
import type { GroundDetail as GroundDetailType, PaymentSummary } from "@/types";
import { apiError } from "@/types";
import { getSportBySlug } from "@/data/sports";
import Reveal from "@/components/Reveal";
import { Loading, ErrorState } from "@/components/ui/StateBlock";
import { Input } from "@/components/ui/Field";
import Button from "@/components/ui/Button";

type Step = "form" | "checkout" | "success" | "failed";

function hoursBetween(start: string, end: string) {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const diff = eh * 60 + em - (sh * 60 + sm);
  return diff > 0 ? diff / 60 : 0;
}

export default function GroundDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, refreshUser } = useAuth();
  const [ground, setGround] = useState<GroundDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<Step>("form");
  const [payment, setPayment] = useState<PaymentSummary | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError("");
    api
      .get(`/grounds/${id}`)
      .then(({ data }) => setGround(data.ground))
      .catch((err) => setError(apiError(err, "Could not load this ground.")))
      .finally(() => setLoading(false));
  }, [id]);

  const hours = useMemo(() => hoursBetween(startTime, endTime), [startTime, endTime]);
  const estimate = useMemo(() => {
    if (!ground || !hours) return 0;
    const base = ground.pricePerHour * hours;
    return user?.isPremium ? base * 0.9 : base;
  }, [ground, hours, user]);

  async function submitBooking(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    if (hours <= 0) {
      setFormError("End time must be after start time.");
      return;
    }
    setFormError("");
    setBusy(true);
    try {
      const { data: bookingRes } = await api.post("/ground-bookings", {
        groundId: id,
        date,
        startTime,
        endTime,
      });
      const { data: paymentRes } = await api.post("/payments/checkout", {
        type: "ground_booking",
        refId: bookingRes.booking.id,
      });
      setPayment(paymentRes.payment);
      setStep("checkout");
    } catch (err) {
      setFormError(apiError(err, "Could not create booking."));
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
    setBusy(true);
    try {
      await api.post(`/payments/${payment.id}/fail`);
      setStep("failed");
    } catch (err) {
      setFormError(apiError(err, "Could not update payment."));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Loading label="Loading ground..." />;
  if (error || !ground) return <ErrorState message={error || "Ground not found."} />;

  const sport = getSportBySlug(ground.sport);

  return (
    <main className="flex-1 py-16">
      <div className="container-x grid gap-10 lg:grid-cols-5">
        <Reveal className="lg:col-span-3">
          <div className="overflow-hidden rounded-3xl border border-border">
            {ground.image ? (
              <img src={ground.image} alt={ground.name} className="h-64 w-full object-cover md:h-80" />
            ) : (
              <div
                className="flex h-64 w-full items-center justify-center text-5xl md:h-80"
                style={{ background: `${sport?.color ?? "#3a82ff"}22` }}
              >
                {sport?.emoji ?? <Tent className="h-10 w-10 text-accent" />}
              </div>
            )}
          </div>
          <span className="eyebrow mt-6 inline-flex">{sport?.name ?? ground.sport}</span>
          <h1 className="mt-3 font-display text-3xl font-bold text-ink md:text-4xl">{ground.name}</h1>
          <p className="mt-2 flex items-center gap-1.5 text-sm text-ink-muted">
            <MapPin className="h-4 w-4" /> {ground.location}
          </p>
          {ground.description && (
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-ink-muted">{ground.description}</p>
          )}
          <p className="mt-6 font-display text-2xl font-semibold text-accent">
            Rs {ground.pricePerHour}
            <span className="text-sm font-normal text-ink-faint"> / hour</span>
          </p>
        </Reveal>

        <Reveal delay={0.1} className="lg:col-span-2">
          <div className="glass sticky top-24 rounded-3xl p-7">
            <div className="mb-5 flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-premium" />
              <span className="text-xs font-semibold uppercase tracking-widest text-premium">
                Test Mode — no real charge
              </span>
            </div>

            {!user ? (
              <div className="text-center">
                <LogIn className="mx-auto h-8 w-8 text-ink-faint" />
                <p className="mt-3 text-sm text-ink-muted">Log in to book this ground.</p>
                <Link to="/login" state={{ from: `/grounds/${id}` }}>
                  <Button className="mt-4" fullWidth>
                    Log in
                  </Button>
                </Link>
              </div>
            ) : step === "form" ? (
              <form onSubmit={submitBooking} className="flex flex-col gap-4">
                <h2 className="font-display text-xl font-semibold text-ink">Book this ground</h2>
                <Input label="Date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Start time"
                    type="time"
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                  <Input
                    label="End time"
                    type="time"
                    required
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </div>

                <div className="rounded-xl border border-border bg-surface-2 p-4 text-sm">
                  <div className="flex justify-between text-ink-muted">
                    <span>{hours > 0 ? `${hours} hour${hours === 1 ? "" : "s"}` : "Select a time range"}</span>
                    {user.isPremium && hours > 0 && <span className="text-premium">-10% Premium</span>}
                  </div>
                  <div className="mt-1 flex justify-between font-display text-lg font-semibold text-ink">
                    <span>Estimated total</span>
                    <span>Rs {estimate.toFixed(0)}</span>
                  </div>
                </div>

                {formError && <p className="text-sm text-red-400">{formError}</p>}
                <Button type="submit" loading={busy} fullWidth size="lg">
                  Continue to test payment
                </Button>
              </form>
            ) : step === "checkout" && payment ? (
              <div className="flex flex-col gap-4">
                <h2 className="font-display text-xl font-semibold text-ink">Confirm test payment</h2>
                <div className="rounded-xl border border-border bg-surface-2 p-4 text-sm">
                  <div className="flex justify-between text-ink-muted">
                    <span>Provider</span>
                    <span>{payment.provider} (sandbox)</span>
                  </div>
                  <div className="mt-1 flex justify-between font-display text-lg font-semibold text-ink">
                    <span>Amount</span>
                    <span>Rs {payment.amount}</span>
                  </div>
                </div>
                <p className="text-xs text-ink-faint">
                  This simulates a gateway callback — no real money moves. Click confirm to complete your booking.
                </p>
                {formError && <p className="text-sm text-red-400">{formError}</p>}
                <Button onClick={confirmPayment} loading={busy} fullWidth size="lg" icon={<ShieldCheck className="h-4 w-4" />}>
                  Confirm test payment
                </Button>
                <button onClick={failPayment} disabled={busy} className="text-xs text-ink-faint hover:text-red-400">
                  Simulate a failed payment
                </button>
              </div>
            ) : step === "success" ? (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <CheckCircle2 className="h-12 w-12 text-emerald-400" />
                <h2 className="font-display text-xl font-semibold text-ink">Booking confirmed</h2>
                <p className="text-sm text-ink-muted">Your ground is booked. See it anytime from your dashboard.</p>
                <Link to="/dashboard">
                  <Button className="mt-2">Go to dashboard</Button>
                </Link>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <XCircle className="h-12 w-12 text-red-400" />
                <h2 className="font-display text-xl font-semibold text-ink">Payment failed</h2>
                <p className="text-sm text-ink-muted">That test payment was marked as failed. You can try again.</p>
                <Button
                  className="mt-2"
                  onClick={() => {
                    setStep("form");
                    setPayment(null);
                  }}
                >
                  Try again
                </Button>
              </div>
            )}
          </div>
        </Reveal>
      </div>
    </main>
  );
}

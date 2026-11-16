import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, LogIn, MapPin, ShieldCheck, XCircle } from "lucide-react";
import api, { assetUrl } from "@/api/axios";
import { useAuth } from "@/context/AuthContext";
import type { GroundDetail as GroundDetailType, PaymentSummary } from "@/types";
import { apiError } from "@/types";
import { getSportBySlug } from "@/data/sports";
import { Loading, ErrorState } from "@/components/ui/StateBlock";
import { Input } from "@/components/ui/Field";
import Button, { buttonClass } from "@/components/ui/Button";
import { FormError } from "@/components/page/AuthShell";
import { SummaryRow, TestModeNote } from "@/components/page/Checkout";

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

  // A challenge page links here with ?date&start&end to book its slot.
  const [searchParams] = useSearchParams();
  const [date, setDate] = useState(searchParams.get("date") ?? "");
  const [startTime, setStartTime] = useState(searchParams.get("start") ?? "");
  const [endTime, setEndTime] = useState(searchParams.get("end") ?? "");
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

  if (loading) return <Loading label="Loading ground…" />;
  if (error || !ground) return <ErrorState message={error || "Ground not found."} />;

  const sport = getSportBySlug(ground.sport);
  const photo = ground.image ? assetUrl(ground.image) : sport?.image;

  return (
    <main className="flex-1">
      <section className="relative isolate overflow-hidden border-b border-border bg-base-2">
        {photo && (
          <img
            src={photo}
            alt={ground.image ? ground.name : ""}
            fetchPriority="high"
            className={`absolute inset-0 -z-10 h-full w-full object-cover ${ground.image ? "" : "opacity-60"}`}
          />
        )}
        <div className="photo-veil-bottom absolute inset-0 -z-10" />
        <div className="container-x flex min-h-[380px] flex-col justify-end pb-10 pt-20 md:min-h-[480px]">
          <Link to="/grounds" className="mb-auto inline-flex w-fit items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
            <ArrowLeft className="h-4 w-4" /> All grounds
          </Link>
          <p className="mt-10 text-sm font-medium text-ink-muted">{sport?.name ?? ground.sport}</p>
          <h1 className="mt-2 max-w-3xl font-display text-5xl font-bold leading-[0.95] text-ink md:text-7xl">{ground.name}</h1>
          <p className="mt-4 flex items-center gap-1.5 text-ink-muted">
            <MapPin className="h-4 w-4" /> {ground.location}
          </p>
        </div>
      </section>

      <div className="container-x grid gap-12 py-12 md:py-16 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <div>
          <p className="flex items-baseline gap-2">
            <span className="num font-display text-6xl font-bold text-ink">Rs {ground.pricePerHour}</span>
            <span className="text-ink-muted">per hour</span>
          </p>
          {user?.isPremium && <p className="mt-2 text-sm text-premium">Your Premium membership takes 10% off.</p>}
          {ground.description && (
            <p className="mt-8 max-w-[62ch] text-lg leading-relaxed text-ink-muted">{ground.description}</p>
          )}
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="panel p-6 md:p-7">
            {!user ? (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-2 text-ink-faint">
                  <LogIn className="h-5 w-5" />
                </span>
                <p className="text-ink-muted">Log in to book this ground.</p>
                <Link to="/login" state={{ from: `/grounds/${id}` }} className={buttonClass({ fullWidth: true, className: "mt-2" })}>
                  Log in
                </Link>
              </div>
            ) : step === "form" ? (
              <form onSubmit={submitBooking} className="flex flex-col gap-5">
                <h2 className="font-display text-3xl font-bold text-ink">Book this ground</h2>
                <TestModeNote />
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

                <div className="flex flex-col gap-2 rounded-xl border border-border bg-base-2 p-4">
                  <SummaryRow
                    label={hours > 0 ? `${hours} hour${hours === 1 ? "" : "s"}` : "Select a time range"}
                    value={user.isPremium && hours > 0 ? <span className="text-premium">Premium, 10% off</span> : ""}
                  />
                  <SummaryRow label="Estimated total" value={`Rs ${estimate.toFixed(0)}`} strong />
                </div>

                {formError && <FormError>{formError}</FormError>}
                <Button type="submit" loading={busy} fullWidth size="lg">
                  Continue to test payment
                </Button>
              </form>
            ) : step === "checkout" && payment ? (
              <div className="flex flex-col gap-5">
                <h2 className="font-display text-3xl font-bold text-ink">Confirm test payment</h2>
                <TestModeNote />
                <div className="flex flex-col gap-2 rounded-xl border border-border bg-base-2 p-4">
                  <SummaryRow label="Provider" value={`${payment.provider} (sandbox)`} />
                  <SummaryRow label="Amount" value={`Rs ${payment.amount}`} strong />
                </div>
                <p className="text-sm text-ink-faint">
                  This simulates a gateway callback, so no real money moves. Confirm to complete your booking.
                </p>
                {formError && <FormError>{formError}</FormError>}
                <Button onClick={confirmPayment} loading={busy} fullWidth size="lg" icon={<ShieldCheck className="h-4 w-4" />}>
                  Confirm test payment
                </Button>
                <button
                  onClick={failPayment}
                  disabled={busy}
                  className="whitespace-nowrap text-sm text-ink-faint transition-colors hover:text-danger active:text-danger/80 disabled:opacity-40"
                >
                  Simulate a failed payment
                </button>
              </div>
            ) : step === "success" ? (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <CheckCircle2 className="h-12 w-12 text-success" />
                <h2 className="font-display text-3xl font-bold text-ink">Booking confirmed</h2>
                <p className="text-ink-muted">Your ground is booked. See it anytime from your dashboard.</p>
                <Link to="/dashboard" className={buttonClass({ className: "mt-3" })}>
                  Go to dashboard
                </Link>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <XCircle className="h-12 w-12 text-danger" />
                <h2 className="font-display text-3xl font-bold text-ink">Payment failed</h2>
                <p className="text-ink-muted">That test payment was marked as failed. You can try again.</p>
                <Button
                  className="mt-3"
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
        </aside>
      </div>
    </main>
  );
}

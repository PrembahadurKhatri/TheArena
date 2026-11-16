import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, Crown, ShieldCheck } from "lucide-react";
import api from "@/api/axios";
import { useAuth } from "@/context/AuthContext";
import type { PaymentSummary } from "@/types";
import { apiError } from "@/types";
import Button, { buttonClass } from "@/components/ui/Button";
import PageHero, { Segmented } from "@/components/page/PageHero";
import { FormError } from "@/components/page/AuthShell";
import { SummaryRow, TestModeNote } from "@/components/page/Checkout";

type Plan = "monthly" | "yearly";
type Step = "plans" | "checkout" | "success";

const FREE_FEATURES = ["Browse teams, players & tournaments", "Own up to 1 team", "Book grounds at standard price", "Join tournaments with your team"];
const PREMIUM_FEATURES = ["Unlimited teams", "Host & organize tournaments", "10% off every ground booking", "Premium badge on your profile", "Priority support"];

export default function Membership() {
  const { user, refreshUser } = useAuth();
  const [plan, setPlan] = useState<Plan>("monthly");
  const [step, setStep] = useState<Step>("plans");
  const [payment, setPayment] = useState<PaymentSummary | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function startCheckout() {
    if (!user) return;
    setError("");
    setBusy(true);
    try {
      const { data } = await api.post("/payments/checkout", { type: "membership", plan });
      setPayment(data.payment);
      setStep("checkout");
    } catch (err) {
      setError(apiError(err, "Could not start checkout."));
    } finally {
      setBusy(false);
    }
  }

  async function confirmPayment() {
    if (!payment) return;
    setError("");
    setBusy(true);
    try {
      await api.post(`/payments/${payment.id}/confirm`);
      await refreshUser();
      setStep("success");
    } catch (err) {
      setError(apiError(err, "Payment confirmation failed."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex-1">
      <PageHero
        title="Unlock the full Arena"
        lead="One membership, every sport. Cancel or switch plans any time."
        image="/sports/hockey.jpg"
        actions={
          step === "plans" ? (
            <Segmented
              tone="premium"
              value={plan}
              options={[
                { value: "monthly", label: "Monthly" },
                { value: "yearly", label: "Yearly, save more" },
              ]}
              onChange={setPlan}
            />
          ) : undefined
        }
      />

      <div className="container-x py-12 md:py-16">
        {step === "plans" && (
          <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            <section className="panel flex flex-col p-8">
              <h2 className="font-display text-2xl font-bold text-ink-muted">Starter</h2>
              <p className="mt-3 font-display text-6xl font-bold leading-none text-ink">Free</p>
              <p className="mt-3 text-ink-muted">The essentials for getting on the field.</p>
              <ul className="mt-8 flex flex-1 flex-col gap-3.5 border-t border-border pt-6">
                {FREE_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-ink-muted">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-ink-faint" /> {f}
                  </li>
                ))}
              </ul>
              <Button variant="secondary" className="mt-8" disabled fullWidth size="lg">
                {user && !user.isPremium ? "Your current plan" : "Free plan"}
              </Button>
            </section>

            <section className="relative flex flex-col overflow-hidden rounded-2xl border border-premium/40 bg-premium-soft p-8 md:p-10">
              <h2 className="flex items-center gap-2 font-display text-2xl font-bold text-premium">
                <Crown className="h-5 w-5" /> Premium
              </h2>
              <p className="mt-3 font-display text-6xl font-bold leading-none text-ink">
                {plan === "monthly" ? "Billed monthly" : "Billed yearly"}
              </p>
              <p className="mt-3 text-ink-muted">Exact price shown at checkout, before you confirm.</p>
              <ul className="mt-8 grid flex-1 gap-3.5 border-t border-premium/25 pt-6 sm:grid-cols-2">
                {PREMIUM_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-ink">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-premium" /> {f}
                  </li>
                ))}
              </ul>

              {error && (
                <div className="mt-6">
                  <FormError>{error}</FormError>
                </div>
              )}

              {!user ? (
                <Link
                  to="/login"
                  state={{ from: "/membership" }}
                  className={buttonClass({ variant: "premium", size: "lg", fullWidth: true, className: "mt-8" })}
                >
                  Log in to upgrade
                </Link>
              ) : user.isPremium ? (
                <p className="mt-8 flex h-12 items-center justify-center gap-2 rounded-full border border-premium/40 text-sm font-semibold text-premium">
                  <Crown className="h-4 w-4" /> You’re already Premium
                </p>
              ) : (
                <Button variant="premium" className="mt-8" fullWidth size="lg" loading={busy} onClick={startCheckout}>
                  Upgrade to Premium
                </Button>
              )}
            </section>
          </div>
        )}

        {step === "checkout" && payment && (
          <section className="panel mx-auto flex max-w-md flex-col gap-5 p-8">
            <h2 className="font-display text-3xl font-bold text-ink">Confirm your upgrade</h2>
            <TestModeNote />
            <div className="flex flex-col gap-2 rounded-xl border border-border bg-base-2 p-4">
              <SummaryRow label="Plan" value={<span className="capitalize">{plan}</span>} />
              <SummaryRow label="Provider" value={`${payment.provider} (sandbox)`} />
              <SummaryRow label="Amount" value={`Rs ${payment.amount}`} strong />
            </div>
            {error && <FormError>{error}</FormError>}
            <Button
              variant="premium"
              fullWidth
              size="lg"
              loading={busy}
              onClick={confirmPayment}
              icon={<ShieldCheck className="h-4 w-4" />}
            >
              Confirm test payment
            </Button>
            <button
              onClick={() => setStep("plans")}
              className="text-sm text-ink-faint transition-colors hover:text-ink active:text-ink-muted"
            >
              Cancel
            </button>
          </section>
        )}

        {step === "success" && (
          <section className="mx-auto flex max-w-md flex-col items-center rounded-2xl border border-premium/40 bg-premium-soft p-10 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-premium text-black">
              <Crown className="h-7 w-7" />
            </span>
            <h2 className="mt-6 font-display text-4xl font-bold text-ink">Welcome to Premium</h2>
            <p className="mt-3 text-ink-muted">
              Your membership is active. Enjoy unlimited teams, tournament hosting, and booking discounts.
            </p>
            <Link to="/dashboard" className={buttonClass({ variant: "premium", size: "lg", className: "mt-8" })}>
              Go to dashboard
            </Link>
          </section>
        )}
      </div>
    </main>
  );
}

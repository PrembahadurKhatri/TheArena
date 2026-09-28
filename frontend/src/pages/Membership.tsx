import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, Crown, FlaskConical, ShieldCheck, Sparkles } from "lucide-react";
import api from "@/api/axios";
import { useAuth } from "@/context/AuthContext";
import type { PaymentSummary } from "@/types";
import { apiError } from "@/types";
import Reveal from "@/components/Reveal";
import Button from "@/components/ui/Button";

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
    <main className="grain relative flex-1 overflow-hidden py-20">
      <div className="pointer-events-none absolute right-0 top-0 h-96 w-96 rounded-full bg-premium/10 blur-[140px]" />
      <div className="container-x relative">
        <Reveal className="text-center">
          <span className="eyebrow-premium mx-auto">
            <Crown className="h-3 w-3" /> Membership
          </span>
        </Reveal>
        <Reveal delay={0.06} className="text-center">
          <h1 className="mx-auto mt-4 max-w-2xl font-display text-4xl font-bold text-ink md:text-5xl">
            Unlock the full Arena
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-sm text-ink-muted">
            One membership, every sport. Cancel or switch plans any time.
          </p>
        </Reveal>

        <Reveal delay={0.1} className="mt-8 flex justify-center">
          <div className="inline-flex items-center gap-1 rounded-full border border-border bg-surface p-1">
            {(["monthly", "yearly"] as Plan[]).map((p) => (
              <button
                key={p}
                onClick={() => setPlan(p)}
                className={`rounded-full px-5 py-2 text-sm font-semibold capitalize transition-colors ${
                  plan === p ? "bg-premium text-black" : "text-ink-muted hover:text-ink"
                }`}
              >
                {p} {p === "yearly" && <span className="ml-1 text-xs opacity-80">save more</span>}
              </button>
            ))}
          </div>
        </Reveal>

        {step === "plans" && (
          <div className="mx-auto mt-12 grid max-w-3xl gap-6 md:grid-cols-2">
            <Reveal delay={0.14}>
              <div className="glass flex h-full flex-col rounded-3xl p-8">
                <span className="text-xs font-semibold uppercase tracking-widest text-ink-faint">Starter</span>
                <h2 className="mt-2 font-display text-3xl font-bold text-ink">Free</h2>
                <p className="mt-1 text-sm text-ink-muted">Everything you need to get on the field.</p>
                <ul className="mt-6 flex flex-1 flex-col gap-3">
                  {FREE_FEATURES.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-ink-muted">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-ink-faint" /> {f}
                    </li>
                  ))}
                </ul>
                <Button variant="secondary" className="mt-8" disabled fullWidth>
                  {user && !user.isPremium ? "Your current plan" : "Free plan"}
                </Button>
              </div>
            </Reveal>

            <Reveal delay={0.2}>
              <div className="spotlight glass relative flex h-full flex-col overflow-hidden rounded-3xl border-premium/30 p-8 shadow-[0_0_0_1px_rgb(var(--c-premium)/0.35)]">
                <div className="spotlight-bg pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-premium/15 blur-3xl" />
                <span className="eyebrow-premium w-fit">
                  <Sparkles className="h-3 w-3" /> Premium
                </span>
                <h2 className="mt-3 font-display text-3xl font-bold text-ink">
                  {plan === "monthly" ? "Billed monthly" : "Billed yearly"}
                </h2>
                <p className="mt-1 text-sm text-ink-muted">Exact price shown at checkout, before you confirm.</p>
                <ul className="mt-6 flex flex-1 flex-col gap-3">
                  {PREMIUM_FEATURES.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-ink">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-premium" /> {f}
                    </li>
                  ))}
                </ul>

                {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

                {!user ? (
                  <Link to="/login" state={{ from: "/membership" }} className="mt-8">
                    <Button variant="premium" fullWidth size="lg">
                      Log in to upgrade
                    </Button>
                  </Link>
                ) : user.isPremium ? (
                  <div className="mt-8 flex items-center justify-center gap-2 rounded-full bg-premium-soft px-5 py-3 text-sm font-semibold text-premium">
                    <Crown className="h-4 w-4" /> You're already Premium
                  </div>
                ) : (
                  <Button variant="premium" className="mt-8" fullWidth size="lg" loading={busy} onClick={startCheckout}>
                    Upgrade to Premium
                  </Button>
                )}
              </div>
            </Reveal>
          </div>
        )}

        {step === "checkout" && payment && (
          <Reveal className="mx-auto mt-12 max-w-md">
            <div className="glass rounded-3xl p-8">
              <div className="mb-5 flex items-center gap-2">
                <FlaskConical className="h-4 w-4 text-premium" />
                <span className="text-xs font-semibold uppercase tracking-widest text-premium">
                  Test Mode — no real charge
                </span>
              </div>
              <h2 className="font-display text-2xl font-bold text-ink">Confirm your upgrade</h2>
              <div className="mt-5 rounded-xl border border-border bg-surface-2 p-4 text-sm">
                <div className="flex justify-between text-ink-muted">
                  <span>Plan</span>
                  <span className="capitalize">{plan}</span>
                </div>
                <div className="flex justify-between text-ink-muted">
                  <span>Provider</span>
                  <span>{payment.provider} (sandbox)</span>
                </div>
                <div className="mt-1 flex justify-between font-display text-lg font-semibold text-ink">
                  <span>Amount</span>
                  <span>Rs {payment.amount}</span>
                </div>
              </div>
              {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
              <Button
                variant="premium"
                fullWidth
                size="lg"
                className="mt-6"
                loading={busy}
                onClick={confirmPayment}
                icon={<ShieldCheck className="h-4 w-4" />}
              >
                Confirm test payment
              </Button>
              <button
                onClick={() => setStep("plans")}
                className="mt-3 w-full text-center text-xs text-ink-faint hover:text-ink"
              >
                Cancel
              </button>
            </div>
          </Reveal>
        )}

        {step === "success" && (
          <Reveal className="mx-auto mt-12 max-w-md text-center">
            <div className="glass rounded-3xl p-10">
              <Crown className="mx-auto h-12 w-12 text-premium" />
              <h2 className="mt-4 font-display text-2xl font-bold text-ink">Welcome to Premium</h2>
              <p className="mt-2 text-sm text-ink-muted">
                Your membership is active. Enjoy unlimited teams, tournament hosting, and booking discounts.
              </p>
              <Link to="/dashboard">
                <Button variant="premium" className="mt-6">
                  Go to dashboard
                </Button>
              </Link>
            </div>
          </Reveal>
        )}
      </div>
    </main>
  );
}

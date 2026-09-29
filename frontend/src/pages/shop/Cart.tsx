import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  FlaskConical,
  LogIn,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  XCircle,
} from "lucide-react";
import api from "@/api/axios";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import type { PaymentSummary } from "@/types";
import { apiError } from "@/types";
import { PROVINCE_OPTIONS } from "@/data/provinces";
import Reveal from "@/components/Reveal";
import { Input } from "@/components/ui/Field";
import CustomSelect from "@/components/ui/CustomSelect";
import Button from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/StateBlock";

// Checkout is folded into the cart page rather than a separate route — the
// cart itself is viewable/editable without logging in (client-side only),
// but the checkout step gates behind auth inline, same pattern as
// GroundDetail's booking form (login prompt swapped in for the form when
// `!user`, rather than wrapping the whole route in <ProtectedRoute>).
type Step = "shipping" | "payment" | "success" | "failed";

export default function Cart() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { items, subtotal, updateQuantity, removeFromCart, clearCart } = useCart();

  const [step, setStep] = useState<Step>("shipping");
  const [address, setAddress] = useState("");
  const [province, setProvince] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [payment, setPayment] = useState<PaymentSummary | null>(null);

  async function submitOrder(e: FormEvent) {
    e.preventDefault();
    if (!user) {
      navigate("/login", { state: { from: "/shop/cart" } });
      return;
    }
    if (items.length === 0) return;
    setError("");
    setBusy(true);
    try {
      const { data: orderRes } = await api.post("/shop/orders", {
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        shippingAddress: address,
        shippingProvince: province || undefined,
      });
      const { data: paymentRes } = await api.post("/payments/checkout", {
        type: "shop_order",
        refId: orderRes.order.id,
      });
      setPayment(paymentRes.payment);
      setStep("payment");
    } catch (err) {
      setError(apiError(err, "Could not place your order."));
    } finally {
      setBusy(false);
    }
  }

  async function confirmPayment() {
    if (!payment) return;
    setBusy(true);
    setError("");
    try {
      await api.post(`/payments/${payment.id}/confirm`);
      clearCart();
      setStep("success");
    } catch (err) {
      setError(apiError(err, "Payment confirmation failed."));
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
      setError(apiError(err, "Could not update payment."));
    } finally {
      setBusy(false);
    }
  }

  if (step === "success") {
    return (
      <main className="flex flex-1 items-center justify-center py-24">
        <Reveal className="glass mx-6 max-w-md rounded-3xl p-10 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400" />
          <h1 className="mt-4 font-display text-2xl font-bold text-ink">Order confirmed</h1>
          <p className="mt-2 text-sm text-ink-muted">
            Thanks for your order! You'll find it in your order history any time.
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Link to="/shop/orders">
              <Button>View my orders</Button>
            </Link>
            <Link to="/shop">
              <Button variant="secondary">Keep shopping</Button>
            </Link>
          </div>
        </Reveal>
      </main>
    );
  }

  const cartEmpty = items.length === 0;

  return (
    <main className="flex-1 py-16">
      <div className="container-x">
        <Reveal>
          <span className="eyebrow">Cart</span>
        </Reveal>
        <Reveal delay={0.06}>
          <h1 className="mt-4 font-display text-4xl font-bold text-ink">Your cart</h1>
        </Reveal>

        {cartEmpty && step === "shipping" ? (
          <div className="mt-10">
            <EmptyState
              title="Your cart is empty"
              message="Browse the shop and add some gear to get started."
              icon={<ShoppingBag className="h-7 w-7 text-ink-faint" />}
              action={
                <Link to="/shop" className="mt-2 text-sm font-semibold text-accent hover:underline">
                  Go to shop
                </Link>
              }
            />
          </div>
        ) : (
          <div className="mt-10 grid gap-10 lg:grid-cols-5">
            <Reveal className="lg:col-span-3">
              <div className="flex flex-col gap-3">
                {items.map((item) => (
                  <div key={item.productId} className="glass flex flex-wrap items-center gap-4 rounded-2xl p-4">
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-surface-2">
                      {item.image ? (
                        <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-ink-faint">
                          <ShoppingBag className="h-5 w-5" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/shop/products/${item.productId}`}
                        className="block truncate text-sm font-semibold text-ink hover:text-accent"
                      >
                        {item.name}
                      </Link>
                      <p className="text-xs text-ink-faint">{item.storeName}</p>
                      <p className="mt-1 text-sm font-semibold text-accent">Rs {item.price}</p>
                    </div>
                    {step === "shipping" && (
                      <>
                        <div className="flex items-center rounded-full border border-border">
                          <button
                            onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                            className="flex h-8 w-8 items-center justify-center text-ink-muted hover:text-ink"
                            aria-label="Decrease quantity"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="w-8 text-center text-sm font-semibold text-ink">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                            className="flex h-8 w-8 items-center justify-center text-ink-muted hover:text-ink"
                            aria-label="Increase quantity"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <button
                          onClick={() => removeFromCart(item.productId)}
                          className="rounded-full p-2 text-ink-faint hover:bg-red-500/10 hover:text-red-400"
                          aria-label={`Remove ${item.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </Reveal>

            <Reveal delay={0.1} className="lg:col-span-2">
              <div className="glass sticky top-24 rounded-3xl p-7">
                {step === "shipping" && (
                  <>
                    {!user ? (
                      <div className="text-center">
                        <LogIn className="mx-auto h-8 w-8 text-ink-faint" />
                        <p className="mt-3 text-sm text-ink-muted">Log in to check out.</p>
                        <Link to="/login" state={{ from: "/shop/cart" }}>
                          <Button className="mt-4" fullWidth>
                            Log in
                          </Button>
                        </Link>
                      </div>
                    ) : (
                      <form onSubmit={submitOrder} className="flex flex-col gap-4">
                        <h2 className="font-display text-xl font-semibold text-ink">Shipping details</h2>
                        <Input
                          label="Shipping address"
                          required
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          placeholder="Street, city..."
                        />
                        <div>
                          <label className="text-sm font-medium text-ink-muted">Province</label>
                          <div className="mt-1.5">
                            <CustomSelect
                              value={province}
                              onChange={(v) => setProvince(v)}
                              options={PROVINCE_OPTIONS}
                              placeholder="Select province (optional)"
                            />
                          </div>
                        </div>

                        <div className="rounded-xl border border-border bg-surface-2 p-4 text-sm">
                          <div className="flex justify-between font-display text-lg font-semibold text-ink">
                            <span>Subtotal</span>
                            <span>Rs {subtotal.toFixed(0)}</span>
                          </div>
                        </div>

                        {error && <p className="text-sm text-red-400">{error}</p>}
                        <Button type="submit" loading={busy} fullWidth size="lg" disabled={cartEmpty}>
                          Continue to test payment
                        </Button>
                      </form>
                    )}
                  </>
                )}

                {step === "payment" && payment && (
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-2">
                      <FlaskConical className="h-4 w-4 text-premium" />
                      <span className="text-xs font-semibold uppercase tracking-widest text-premium">
                        Test Mode — no real charge
                      </span>
                    </div>
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
                      This simulates a gateway callback — no real money moves. Click confirm to complete your order.
                    </p>
                    {error && <p className="text-sm text-red-400">{error}</p>}
                    <Button
                      onClick={confirmPayment}
                      loading={busy}
                      fullWidth
                      size="lg"
                      icon={<ShieldCheck className="h-4 w-4" />}
                    >
                      Confirm test payment
                    </Button>
                    <button onClick={failPayment} disabled={busy} className="text-xs text-ink-faint hover:text-red-400">
                      Simulate a failed payment
                    </button>
                  </div>
                )}

                {step === "failed" && (
                  <div className="flex flex-col items-center gap-3 py-6 text-center">
                    <XCircle className="h-12 w-12 text-red-400" />
                    <h2 className="font-display text-xl font-semibold text-ink">Payment failed</h2>
                    <p className="text-sm text-ink-muted">That test payment was marked as failed. You can try again.</p>
                    <Button
                      className="mt-2"
                      onClick={() => {
                        setStep("shipping");
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
        )}
      </div>
    </main>
  );
}

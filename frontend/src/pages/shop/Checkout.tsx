import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Check, CheckCircle2, CreditCard, Lock, LogIn, MapPin, Package, ShieldCheck, XCircle } from "lucide-react";
import api, { assetUrl } from "@/api/axios";
import { useAuth } from "@/context/AuthContext";
import { useCart, purchasable } from "@/context/CartContext";
import type { OrderSummary as Order, PaymentSummary } from "@/types";
import { apiError } from "@/types";
import { PROVINCE_OPTIONS } from "@/data/provinces";
import { Input } from "@/components/ui/Field";
import CustomSelect from "@/components/ui/CustomSelect";
import Button, { buttonClass } from "@/components/ui/Button";
import GatePanel from "@/components/page/GatePanel";
import { FormError } from "@/components/page/AuthShell";
import { TestModeNote } from "@/components/page/Checkout";
import OrderSummary from "@/components/shop/OrderSummary";

type Step = "details" | "payment" | "success" | "failed";

const STEPS: { key: Step; label: string }[] = [
  { key: "details", label: "Delivery" },
  { key: "payment", label: "Payment" },
  { key: "success", label: "Confirmation" },
];

function Steps({ step }: { step: Step }) {
  const current = step === "failed" ? 1 : STEPS.findIndex((s) => s.key === step);
  return (
    <ol className="flex items-center gap-2 sm:gap-3">
      {STEPS.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s.key} className="flex items-center gap-2 sm:gap-3">
            {i > 0 && <span className={`h-px w-6 sm:w-10 ${done || active ? "bg-accent" : "bg-border"}`} />}
            <span className="flex items-center gap-2">
              <span
                className={`num flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                  done ? "bg-accent text-white" : active ? "border-2 border-accent text-accent" : "border border-border text-ink-faint"
                }`}
              >
                {done ? <Check className="h-4 w-4" /> : i + 1}
              </span>
              <span className={`hidden text-sm font-semibold sm:inline ${active ? "text-ink" : "text-ink-faint"}`}>
                {s.label}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export default function Checkout() {
  const { user } = useAuth();
  const { items, subtotal, clearCart, syncCart } = useCart();

  const [step, setStep] = useState<Step>("details");
  const [form, setForm] = useState({
    name: user?.name ?? "",
    phone: user?.phone ?? "",
    address: "",
    city: user?.location ?? "",
    province: user?.province ?? "",
  });
  const [order, setOrder] = useState<Order | null>(null);
  const [payment, setPayment] = useState<PaymentSummary | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    syncCart();
  }, [syncCart]);

  useEffect(() => {
    if (user)
      setForm((f) => ({
        ...f,
        name: f.name || user.name,
        phone: f.phone || user.phone || "",
        city: f.city || user.location || "",
        province: f.province || user.province || "",
      }));
  }, [user]);

  const buyable = purchasable(items);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function placeOrder(e: FormEvent) {
    e.preventDefault();
    if (buyable.length === 0) return;
    if (!/^[+\d][\d\s-]{6,}$/.test(form.phone.trim())) {
      setError("Enter a valid phone number so the seller can reach you.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const { data: orderRes } = await api.post("/shop/orders", {
        items: buyable.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        shippingAddress: `${form.address.trim()}, ${form.city.trim()}`,
        shippingProvince: form.province || undefined,
        contactName: form.name.trim(),
        contactPhone: form.phone.trim(),
      });
      const { data: paymentRes } = await api.post("/payments/checkout", {
        type: "shop_order",
        refId: orderRes.order.id,
      });
      setOrder(orderRes.order);
      setPayment(paymentRes.payment);
      setStep("payment");
      window.scrollTo({ top: 0 });
    } catch (err) {
      setError(apiError(err, "Could not place your order."));
      syncCart();
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
      window.scrollTo({ top: 0 });
    } catch (err) {
      setError(apiError(err, "Payment confirmation failed."));
    } finally {
      setBusy(false);
    }
  }

  // Marks the payment failed, which cancels the order and returns its stock.
  async function releaseOrder(next: Step) {
    if (!payment) return setStep(next);
    setBusy(true);
    setError("");
    try {
      await api.post(`/payments/${payment.id}/fail`);
      setPayment(null);
      setOrder(null);
      setStep(next);
    } catch (err) {
      setError(apiError(err, "Could not update payment."));
    } finally {
      setBusy(false);
    }
  }

  if (!user) {
    return (
      <GatePanel icon={<LogIn className="h-6 w-6" />} title="Log in to check out">
        <p className="mt-3 text-ink-muted">Your cart is saved. Log in and you’ll come straight back here.</p>
        <Link to="/login" state={{ from: "/shop/checkout" }} className={buttonClass({ size: "lg", className: "mt-8" })}>
          Log in
        </Link>
        <p className="mt-4 text-sm text-ink-muted">
          New here?{" "}
          <Link to="/register" className="font-semibold text-accent hover:underline">
            Create an account
          </Link>
        </p>
      </GatePanel>
    );
  }

  if (step === "success" && order) {
    return (
      <main className="flex-1">
        <div className="container-x max-w-3xl py-14 md:py-20">
          <div className="flex justify-center">
            <Steps step="success" />
          </div>
          <div className="mt-12 text-center">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/15 text-success">
              <CheckCircle2 className="h-8 w-8" />
            </span>
            <h1 className="mt-6 font-display text-5xl font-bold text-ink md:text-6xl">Order confirmed</h1>
            <p className="mt-3 text-lg text-ink-muted">
              Thanks, {form.name.split(" ")[0]}. Order{" "}
              <span className="num font-semibold text-ink">#{order.id.slice(-6).toUpperCase()}</span> is paid and on
              its way to the seller.
            </p>
          </div>

          <div className="panel mt-10 overflow-hidden">
            <ul className="divide-y divide-border">
              {order.items.map((i, idx) => (
                <li key={idx} className="flex items-center gap-4 px-6 py-4">
                  <span className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-surface-2">
                    {i.image && <img src={assetUrl(i.image)} alt="" className="h-full w-full object-cover" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-ink">{i.name}</span>
                    <span className="block text-sm text-ink-faint">
                      {i.store.name}, qty <span className="num">{i.quantity}</span>
                    </span>
                  </span>
                  <span className="num text-ink">Rs {i.price * i.quantity}</span>
                </li>
              ))}
            </ul>
            <div className="grid gap-6 border-t border-border bg-base-2 px-6 py-5 sm:grid-cols-2">
              <div>
                <p className="text-sm text-ink-faint">Delivering to</p>
                <p className="mt-1 font-semibold text-ink">{order.contactName ?? form.name}</p>
                <p className="text-sm text-ink-muted">
                  {order.shippingAddress}
                  {order.shippingProvince ? `, ${order.shippingProvince}` : ""}
                </p>
                <p className="text-sm text-ink-muted">{order.contactPhone ?? form.phone}</p>
              </div>
              <div className="sm:text-right">
                <p className="text-sm text-ink-faint">Total paid</p>
                <p className="num mt-1 font-display text-4xl font-bold text-ink">Rs {order.totalAmount}</p>
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link to="/shop/orders" className={buttonClass({ size: "lg" })}>
              <Package className="h-4 w-4" /> View my orders
            </Link>
            <Link to="/shop" className={buttonClass({ variant: "secondary", size: "lg" })}>
              Continue shopping
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (buyable.length === 0 && step === "details") {
    return (
      <GatePanel icon={<Package className="h-6 w-6" />} title="Nothing to check out">
        <p className="mt-3 text-ink-muted">Your cart is empty, or everything in it has sold out.</p>
        <Link to="/shop" className={buttonClass({ size: "lg", className: "mt-8" })}>
          Go to shop
        </Link>
      </GatePanel>
    );
  }

  return (
    <main className="flex-1">
      <div className="container-x py-10 md:py-14">
        <div className="flex flex-wrap items-center justify-between gap-6 border-b border-border pb-8">
          <div>
            <Link to="/shop/cart" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
              <ArrowLeft className="h-4 w-4" /> Back to cart
            </Link>
            <h1 className="mt-4 font-display text-5xl font-bold leading-none text-ink md:text-6xl">Checkout</h1>
          </div>
          <Steps step={step} />
        </div>

        <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)] lg:gap-12">
          <div>
            {step === "details" && (
              <form onSubmit={placeOrder} className="flex flex-col gap-8">
                <section className="panel p-6 md:p-8">
                  <h2 className="font-display text-3xl font-bold text-ink">Delivery details</h2>
                  <p className="mt-1 text-sm text-ink-muted">
                    Logged in as <span className="text-ink">{user.email}</span>
                  </p>
                  <div className="mt-6 grid gap-5 sm:grid-cols-2">
                    <Input
                      id="co-name"
                      label="Full name"
                      autoComplete="name"
                      required
                      maxLength={100}
                      value={form.name}
                      onChange={(e) => set("name", e.target.value)}
                    />
                    <Input
                      id="co-phone"
                      label="Phone"
                      type="tel"
                      autoComplete="tel"
                      required
                      maxLength={30}
                      value={form.phone}
                      onChange={(e) => set("phone", e.target.value)}
                      placeholder="98XXXXXXXX"
                    />
                  </div>
                  <div className="mt-5">
                    <Input
                      id="co-address"
                      label="Street address"
                      autoComplete="street-address"
                      required
                      minLength={3}
                      maxLength={200}
                      value={form.address}
                      onChange={(e) => set("address", e.target.value)}
                      placeholder="House no., street, tole"
                    />
                  </div>
                  <div className="mt-5 grid gap-5 sm:grid-cols-2">
                    <Input
                      id="co-city"
                      label="City or area"
                      autoComplete="address-level2"
                      required
                      minLength={2}
                      maxLength={80}
                      value={form.city}
                      onChange={(e) => set("city", e.target.value)}
                      placeholder="e.g. Pokhara"
                    />
                    <div className="flex flex-col gap-2">
                      <span className="text-sm font-medium text-ink-muted">Province</span>
                      <CustomSelect
                        value={form.province}
                        onChange={(v) => set("province", v)}
                        options={PROVINCE_OPTIONS}
                        placeholder="Select province"
                      />
                    </div>
                  </div>
                </section>

                {error && <FormError>{error}</FormError>}

                <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <Link to="/shop/cart" className={buttonClass({ variant: "ghost", size: "lg" })}>
                    Edit cart
                  </Link>
                  <Button type="submit" size="lg" loading={busy} icon={<Lock className="h-4 w-4" />}>
                    Continue to payment
                  </Button>
                </div>
              </form>
            )}

            {(step === "payment" || step === "failed") && (
              <div className="flex flex-col gap-6">
                <section className="panel flex flex-wrap items-start justify-between gap-4 p-6">
                  <div className="flex gap-3">
                    <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                    <div>
                      <p className="text-sm text-ink-faint">Delivering to</p>
                      <p className="font-semibold text-ink">{form.name}</p>
                      <p className="text-sm text-ink-muted">
                        {form.address}, {form.city}
                        {form.province ? `, ${form.province}` : ""}
                      </p>
                      <p className="text-sm text-ink-muted">{form.phone}</p>
                    </div>
                  </div>
                  {step === "payment" && (
                    <button
                      type="button"
                      onClick={() => releaseOrder("details")}
                      disabled={busy}
                      className="text-sm font-semibold text-accent hover:underline disabled:opacity-40"
                    >
                      Change
                    </button>
                  )}
                </section>

                {step === "payment" && payment && (
                  <section className="panel p-6 md:p-8">
                    <h2 className="font-display text-3xl font-bold text-ink">Payment</h2>
                    <div className="mt-5">
                      <TestModeNote />
                    </div>
                    <fieldset className="mt-6">
                      <legend className="mb-3 text-sm font-medium text-ink-muted">Payment method</legend>
                      <label className="flex cursor-pointer items-center gap-4 rounded-xl border-2 border-accent bg-accent-soft p-4">
                        <input type="radio" name="method" defaultChecked className="h-4 w-4 accent-[rgb(var(--c-accent))]" />
                        <CreditCard className="h-5 w-5 text-accent" />
                        <span className="flex-1">
                          <span className="block font-semibold text-ink">Test payment</span>
                          <span className="block text-sm text-ink-muted">{payment.provider} sandbox, no money moves</span>
                        </span>
                        <span className="num font-semibold text-ink">Rs {payment.amount}</span>
                      </label>
                    </fieldset>
                    {error && (
                      <div className="mt-5">
                        <FormError>{error}</FormError>
                      </div>
                    )}
                    <Button
                      className="mt-6"
                      onClick={confirmPayment}
                      loading={busy}
                      fullWidth
                      size="lg"
                      icon={<ShieldCheck className="h-4 w-4" />}
                    >
                      Pay Rs {payment.amount}
                    </Button>
                    <button
                      type="button"
                      onClick={() => releaseOrder("failed")}
                      disabled={busy}
                      className="mt-4 w-full whitespace-nowrap text-center text-sm text-ink-faint transition-colors hover:text-danger disabled:opacity-40"
                    >
                      Simulate a failed payment
                    </button>
                  </section>
                )}

                {step === "failed" && (
                  <section className="panel flex flex-col items-center p-8 text-center">
                    <XCircle className="h-12 w-12 text-danger" />
                    <h2 className="mt-4 font-display text-3xl font-bold text-ink">Payment failed</h2>
                    <p className="mt-2 max-w-md text-ink-muted">
                      Nothing was charged and your cart is untouched. The reserved stock has been released.
                    </p>
                    <Button className="mt-6" size="lg" onClick={() => setStep("details")}>
                      Try again
                    </Button>
                  </section>
                )}
              </div>
            )}
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <OrderSummary
              items={buyable}
              subtotal={subtotal}
              total={order?.totalAmount}
              showItems
            />
          </aside>
        </div>
      </div>
    </main>
  );
}

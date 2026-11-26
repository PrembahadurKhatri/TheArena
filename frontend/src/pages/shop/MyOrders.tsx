import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Banknote, MapPin, Package, Truck } from "lucide-react";
import api, { assetUrl } from "@/api/axios";
import { apiError } from "@/types";
import { Loading, ErrorState, EmptyState } from "@/components/ui/StateBlock";
import { StatusBadge } from "@/components/ui/Badge";
import Button, { buttonClass } from "@/components/ui/Button";

export interface SellerOrderRow {
  id: string;
  order: string | null;
  store: { id: string; name: string | null; slug: string | null } | null;
  buyer?: { id: string; name: string };
  items: { product: string | null; name: string; price: number; quantity: number; image: string | null; size: string | null; color: string | null }[];
  subtotal: number;
  paymentMethod: "cod" | "online";
  status: string;
  statusHistory: { status: string; at: string; note: string | null }[];
  tracking: { carrier: string | null; code: string | null } | null;
  shipping: { address: string; province?: string; contactName?: string; contactPhone?: string } | null;
  createdAt: string;
}

interface OrderRow {
  id: string;
  totalAmount: number;
  status: string;
  paymentMethod: "cod" | "online";
  shippingAddress: string;
  createdAt: string | null;
  sellerOrders: SellerOrderRow[];
}

const CANCELLABLE = ["pending_payment", "placed", "confirmed", "processing"];
const STEPS = ["placed", "confirmed", "processing", "shipped", "delivered"];

function Progress({ status }: { status: string }) {
  const at = STEPS.indexOf(status);
  if (at < 0) return null;
  return (
    <ol className="mt-3 flex items-center gap-1" aria-label="Progress">
      {STEPS.map((s, i) => (
        <li key={s} className={`h-1.5 flex-1 rounded-full ${i <= at ? "bg-success" : "bg-surface-2"}`} title={s} />
      ))}
    </ol>
  );
}

export default function MyOrders() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  function load() {
    setLoading(true);
    setError("");
    api
      .get("/my/orders")
      .then(({ data }) => setOrders(data.orders ?? []))
      .catch((err) => setError(apiError(err, "Could not load your orders.")))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function cancel(so: SellerOrderRow) {
    if (!window.confirm(`Cancel the items from ${so.store?.name ?? "this shop"}?`)) return;
    setBusy(so.id);
    setActionError("");
    try {
      await api.post(`/shop/seller-orders/${so.id}/cancel`, { reason: "Cancelled by the buyer" });
      load();
    } catch (err) {
      setActionError(apiError(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="flex-1">
      <div className="container-x max-w-5xl py-14 md:py-20">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-8">
          <h1 className="font-display text-5xl font-bold leading-none text-ink md:text-6xl">My orders</h1>
          <div className="flex gap-2">
            <Link to="/shop/wishlist" className={buttonClass({ variant: "ghost" })}>
              Wishlist
            </Link>
            <Link to="/shop" className={buttonClass({ variant: "secondary" })}>
              Go to shop
            </Link>
          </div>
        </div>

        <div className="mt-10">
          {loading && <Loading label="Loading your orders…" />}
          {!loading && error && <ErrorState message={error} onRetry={load} />}
          {actionError && <p className="mb-6 rounded-xl border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-danger">{actionError}</p>}
          {!loading && !error && orders.length === 0 && (
            <EmptyState icon={<Package className="h-5 w-5" />} title="No orders yet" message="When you buy gear, it shows up here." />
          )}
          <ul className="flex flex-col gap-8">
            {orders.map((o) => (
              <li key={o.id} className="panel overflow-hidden">
                <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-base-2 px-6 py-4">
                  <div>
                    <p className="num font-semibold text-ink">Order #{o.id.slice(-6).toUpperCase()}</p>
                    <p className="text-sm text-ink-faint">{o.createdAt ? new Date(o.createdAt).toLocaleString() : ""}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1.5 text-sm text-ink-muted">
                      <Banknote className="h-4 w-4" /> {o.paymentMethod === "cod" ? "Cash on delivery" : "Paid online"}
                    </span>
                    <span className="num font-display text-xl font-bold text-ink">Rs {o.totalAmount}</span>
                  </div>
                </header>
                <p className="flex items-center gap-1.5 px-6 pt-4 text-sm text-ink-faint">
                  <MapPin className="h-4 w-4" /> {o.shippingAddress}
                </p>
                <div className="divide-y divide-border">
                  {o.sellerOrders.map((so) => (
                    <section key={so.id} className="px-6 py-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <Link to={`/shop/stores/${so.store?.slug || so.store?.id}`} className="font-semibold text-ink hover:text-accent">
                          {so.store?.name}
                        </Link>
                        <div className="flex items-center gap-3">
                          <StatusBadge status={so.status} />
                          {CANCELLABLE.includes(so.status) && (
                            <Button size="sm" variant="ghost" loading={busy === so.id} onClick={() => cancel(so)}>
                              Cancel
                            </Button>
                          )}
                        </div>
                      </div>
                      <Progress status={so.status} />
                      {so.tracking?.code && (
                        <p className="mt-3 flex items-center gap-1.5 text-sm text-ink-muted">
                          <Truck className="h-4 w-4" /> {so.tracking.carrier} {so.tracking.code}
                        </p>
                      )}
                      <ul className="mt-4 flex flex-col gap-3">
                        {so.items.map((i, k) => (
                          <li key={k} className="flex items-center gap-4">
                            <span className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-surface-2">
                              {i.image && <img src={assetUrl(i.image)} alt="" className="h-full w-full object-cover" />}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-ink">{i.name}</span>
                              <span className="num block text-sm text-ink-faint">
                                {[i.size, i.color].filter(Boolean).join(" / ")}
                                {i.size || i.color ? " · " : ""}
                                {i.quantity} × Rs {i.price}
                              </span>
                            </span>
                            {so.status === "delivered" && i.product && (
                              <Link to={`/shop/products/${i.product}`} className="text-sm font-semibold text-accent hover:underline">
                                Review
                              </Link>
                            )}
                          </li>
                        ))}
                      </ul>
                      {so.statusHistory.length > 1 && (
                        <details className="mt-3 text-sm text-ink-faint">
                          <summary className="cursor-pointer">History</summary>
                          <ol className="mt-2 flex flex-col gap-1">
                            {so.statusHistory.map((h, k) => (
                              <li key={k}>
                                {new Date(h.at).toLocaleString()}: {h.status.replace("_", " ")}
                                {h.note ? ` (${h.note})` : ""}
                              </li>
                            ))}
                          </ol>
                        </details>
                      )}
                    </section>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  );
}

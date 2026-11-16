import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, Package } from "lucide-react";
import api, { assetUrl } from "@/api/axios";
import type { OrderSummary } from "@/types";
import { apiError } from "@/types";
import { Loading, ErrorState, EmptyState } from "@/components/ui/StateBlock";
import { StatusBadge } from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/Button";

export default function MyOrders() {
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    api
      .get("/my/orders")
      .then(({ data }) => alive && setOrders(data.orders ?? []))
      .catch((err) => alive && setError(apiError(err, "Could not load your orders.")))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <main className="flex-1">
      <div className="container-x max-w-5xl py-14 md:py-20">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-8">
          <h1 className="font-display text-5xl font-bold leading-none text-ink md:text-6xl">My orders</h1>
          <Link to="/shop" className={buttonClass({ variant: "secondary" })}>
            Go to shop
          </Link>
        </div>

        <div className="mt-10">
          {loading && <Loading label="Loading your orders…" />}
          {!loading && error && <ErrorState message={error} />}
          {!loading && !error && orders.length === 0 && (
            <EmptyState
              title="No orders yet"
              message="Once you check out, your orders will show up here."
              icon={<Package className="h-5 w-5" />}
            />
          )}

          <ol className="flex flex-col gap-5">
            {orders.map((order) => (
              <li key={order.id} className="panel overflow-hidden">
                <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-base-2 px-5 py-4">
                  <div>
                    <p className="text-sm text-ink-faint">
                      Order <span className="num font-semibold text-ink-muted">#{order.id.slice(-6).toUpperCase()}</span>
                    </p>
                    <p className="num font-semibold text-ink">
                      {new Date(order.createdAt).toLocaleDateString(undefined, {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <StatusBadge status={order.status} />
                </header>
                <ul className="divide-y divide-border">
                  {order.items.map((item, idx) => (
                    <li key={idx} className="flex items-center justify-between gap-4 px-5 py-3.5">
                      <div className="flex min-w-0 items-center gap-4">
                        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-surface-2">
                          {item.image && <img src={assetUrl(item.image)} alt="" className="h-full w-full object-cover" />}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-ink">{item.name}</p>
                          <p className="text-sm text-ink-faint">
                            {item.store.name}, qty <span className="num">{item.quantity}</span>
                          </p>
                        </div>
                      </div>
                      <span className="num shrink-0 text-ink-muted">Rs {item.price * item.quantity}</span>
                    </li>
                  ))}
                </ul>
                <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-4">
                  <span className="flex min-w-0 items-center gap-1.5 text-sm text-ink-faint">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">
                      {order.contactName ? `${order.contactName}, ` : ""}
                      {order.shippingAddress}
                      {order.shippingProvince ? `, ${order.shippingProvince}` : ""}
                    </span>
                  </span>
                  <span className="flex items-baseline gap-2">
                    <span className="text-sm text-ink-faint">Total</span>
                    <span className="num font-display text-2xl font-bold text-ink">Rs {order.totalAmount}</span>
                  </span>
                </footer>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </main>
  );
}

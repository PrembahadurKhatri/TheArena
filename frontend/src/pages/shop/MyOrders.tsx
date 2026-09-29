import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, Package } from "lucide-react";
import api from "@/api/axios";
import type { OrderSummary } from "@/types";
import { apiError } from "@/types";
import Reveal from "@/components/Reveal";
import { Loading, ErrorState, EmptyState } from "@/components/ui/StateBlock";
import { StatusBadge } from "@/components/ui/Badge";

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
    <main className="flex-1 py-16">
      <div className="container-x max-w-4xl">
        <Reveal>
          <span className="eyebrow">Shop</span>
        </Reveal>
        <Reveal delay={0.06}>
          <h1 className="mt-4 font-display text-4xl font-bold text-ink">My orders</h1>
        </Reveal>

        <div className="mt-10">
          {loading && <Loading label="Loading your orders..." />}
          {!loading && error && <ErrorState message={error} />}
          {!loading && !error && orders.length === 0 && (
            <EmptyState
              title="No orders yet"
              message="Once you check out, your orders will show up here."
              icon={<Package className="h-7 w-7 text-ink-faint" />}
              action={
                <Link to="/shop" className="mt-2 text-sm font-semibold text-accent hover:underline">
                  Go to shop
                </Link>
              }
            />
          )}

          <div className="flex flex-col gap-4">
            {orders.map((order, i) => (
              <Reveal key={order.id} delay={i * 0.06}>
                <div className="glass rounded-2xl p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="flex items-center gap-1.5 text-xs text-ink-faint">
                      <CalendarDays className="h-3.5 w-3.5" /> {new Date(order.createdAt).toLocaleDateString()}
                    </p>
                    <StatusBadge status={order.status} />
                  </div>
                  <div className="mt-4 flex flex-col gap-2">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between gap-3 text-sm">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-surface-2">
                            {item.image && (
                              <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-ink">{item.name}</p>
                            <p className="text-xs text-ink-faint">
                              {item.store.name} · x{item.quantity}
                            </p>
                          </div>
                        </div>
                        <span className="shrink-0 text-ink-muted">Rs {item.price * item.quantity}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
                    <span className="text-xs text-ink-faint">
                      {order.shippingAddress}
                      {order.shippingProvince ? `, ${order.shippingProvince}` : ""}
                    </span>
                    <span className="font-display text-lg font-semibold text-ink">Rs {order.totalAmount}</span>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

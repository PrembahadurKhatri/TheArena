import type { ReactNode } from "react";
import { ShoppingBag } from "lucide-react";
import { assetUrl } from "@/api/axios";
import type { CartItem } from "@/context/CartContext";

// Right-hand summary shared by the cart and checkout pages.
export default function OrderSummary({
  items,
  subtotal,
  showItems = false,
  total,
  children,
}: {
  items: CartItem[];
  subtotal: number;
  showItems?: boolean;
  /** Server-computed total once an order exists; otherwise the subtotal. */
  total?: number;
  children?: ReactNode;
}) {
  const count = items.reduce((n, i) => n + i.quantity, 0);
  return (
    <div className="panel overflow-hidden">
      <h2 className="border-b border-border px-6 py-4 font-display text-2xl font-bold text-ink">Order summary</h2>

      {showItems && (
        <ul className="max-h-80 divide-y divide-border overflow-y-auto border-b border-border">
          {items.map((i) => (
            <li key={i.productId} className="flex items-center gap-3 px-6 py-3">
              <span className="relative h-14 w-14 shrink-0">
                <span className="block h-full w-full overflow-hidden rounded-lg bg-surface-2">
                  {i.image ? (
                    <img src={assetUrl(i.image)} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-ink-faint">
                      <ShoppingBag className="h-4 w-4" />
                    </span>
                  )}
                </span>
                <span className="num absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-xs font-bold text-white">
                  {i.quantity}
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink">{i.name}</span>
                <span className="block truncate text-xs text-ink-faint">{i.storeName}</span>
              </span>
              <span className="num shrink-0 text-sm text-ink">Rs {i.price * i.quantity}</span>
            </li>
          ))}
        </ul>
      )}

      <dl className="flex flex-col gap-2.5 px-6 py-5 text-sm">
        <div className="flex justify-between text-ink-muted">
          <dt>
            Subtotal (<span className="num">{count}</span> {count === 1 ? "item" : "items"})
          </dt>
          <dd className="num text-ink">Rs {subtotal.toFixed(0)}</dd>
        </div>
        <div className="flex justify-between text-ink-muted">
          <dt>Delivery</dt>
          <dd className="text-success">Free</dd>
        </div>
        <div className="mt-2 flex items-baseline justify-between border-t border-border pt-4">
          <dt className="font-semibold text-ink">Total</dt>
          <dd className="num font-display text-3xl font-bold text-ink">Rs {(total ?? subtotal).toFixed(0)}</dd>
        </div>
      </dl>

      {children && <div className="border-t border-border px-6 py-5">{children}</div>}
    </div>
  );
}

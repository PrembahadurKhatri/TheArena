import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowLeft, Lock, ShoppingBag, Trash2 } from "lucide-react";
import { assetUrl } from "@/api/axios";
import { useCart, purchasable, keyOf } from "@/context/CartContext";
import type { CartNotice } from "@/context/CartContext";
import { buttonClass } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/StateBlock";
import QuantityStepper from "@/components/shop/QuantityStepper";
import OrderSummary from "@/components/shop/OrderSummary";

// The cart: review lines, change quantities, then go to /shop/checkout.
// Prices and stock are refreshed from the API on load so what you see here
// is what checkout will charge.
export default function Cart() {
  const { items, subtotal, itemCount, updateQuantity, removeFromCart, clearCart, syncCart } = useCart();
  const [notices, setNotices] = useState<CartNotice[]>([]);
  const [syncing, setSyncing] = useState(true);

  useEffect(() => {
    let alive = true;
    syncCart()
      .then((n) => alive && setNotices(n))
      .finally(() => alive && setSyncing(false));
    return () => {
      alive = false;
    };
  }, [syncCart]);

  const buyable = purchasable(items);
  const blocked = items.length - buyable.length;

  return (
    <main className="flex-1">
      <div className="container-x py-10 md:py-14">
        <Link to="/shop" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> Continue shopping
        </Link>
        <div className="mt-6 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-8">
          <h1 className="font-display text-5xl font-bold leading-none text-ink md:text-6xl">
            Shopping cart
          </h1>
          {items.length > 0 && (
            <p className="text-ink-muted">
              <span className="num font-semibold text-ink">{itemCount}</span> {itemCount === 1 ? "item" : "items"}
            </p>
          )}
        </div>

        {items.length === 0 ? (
          <div className="mt-10">
            <EmptyState
              title="Your cart is empty"
              message="Browse the shop and add some gear to get started."
              icon={<ShoppingBag className="h-5 w-5" />}
              action={
                <Link to="/shop" className={buttonClass({ size: "sm", className: "mt-2" })}>
                  Go to shop
                </Link>
              }
            />
          </div>
        ) : (
          <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)] lg:gap-12">
            <section aria-label="Items in your cart">
              {notices.length > 0 && (
                <ul className="mb-5 flex flex-col gap-2 rounded-xl border border-premium/30 bg-premium-soft px-4 py-3 text-sm text-premium">
                  {notices.map((n, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {n.message}
                    </li>
                  ))}
                </ul>
              )}

              <div className="hidden grid-cols-[minmax(0,1fr)_9rem_7rem_2.5rem] gap-4 border-b border-border px-1 pb-3 text-sm text-ink-faint md:grid">
                <span>Product</span>
                <span className="text-center">Quantity</span>
                <span className="text-right">Total</span>
                <span />
              </div>

              <ul className="divide-y divide-border">
                {items.map((item) => {
                  const soldOut = item.unavailable || item.stock === 0;
                  return (
                    <li
                      key={keyOf(item)}
                      className={`grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-x-4 gap-y-3 py-5 md:grid-cols-[minmax(0,1fr)_9rem_7rem_2.5rem] ${
                        soldOut ? "opacity-60" : ""
                      }`}
                    >
                      <div className="contents md:flex md:items-center md:gap-4">
                        <Link
                          to={`/shop/products/${item.productId}`}
                          className="row-span-2 block h-22 w-22 shrink-0 overflow-hidden rounded-xl bg-surface-2 md:row-span-1"
                        >
                          {item.image ? (
                            <img src={assetUrl(item.image)} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <span className="flex h-full w-full items-center justify-center text-ink-faint">
                              <ShoppingBag className="h-5 w-5" />
                            </span>
                          )}
                        </Link>
                        <div className="min-w-0">
                          <Link
                            to={`/shop/products/${item.productId}`}
                            className="line-clamp-2 font-semibold leading-snug text-ink hover:text-accent"
                          >
                            {item.name}
                          </Link>
                          <p className="text-sm text-ink-faint">{item.variantLabel ? `${item.variantLabel} · ` : ""}{item.storeName}</p>
                          <p className="num mt-1 text-sm text-ink-muted">Rs {item.price} each</p>
                          {soldOut ? (
                            <p className="mt-1 text-sm font-semibold text-danger">
                              {item.unavailable ? "No longer available" : "Sold out"}
                            </p>
                          ) : item.stock !== undefined && item.stock <= 5 ? (
                            <p className="mt-1 text-sm text-premium">Only {item.stock} left</p>
                          ) : null}
                        </div>
                      </div>

                      <div className="col-start-2 flex items-center justify-between gap-3 md:col-start-auto md:justify-center">
                        {!soldOut && (
                          <QuantityStepper
                            value={item.quantity}
                            max={item.stock}
                            label={item.name}
                            onChange={(q) => updateQuantity(keyOf(item), q)}
                          />
                        )}
                        <span className="num font-display text-xl font-bold text-ink md:hidden">
                          Rs {item.price * item.quantity}
                        </span>
                      </div>

                      <span className="num hidden text-right font-display text-xl font-bold text-ink md:block">
                        Rs {item.price * item.quantity}
                      </span>

                      <button
                        type="button"
                        onClick={() => removeFromCart(keyOf(item))}
                        aria-label={`Remove ${item.name}`}
                        className="col-start-2 flex h-10 w-10 items-center justify-center justify-self-end rounded-full text-ink-faint transition-colors hover:bg-danger/10 hover:text-danger active:bg-danger/20 md:col-start-auto"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  );
                })}
              </ul>

              <div className="mt-4 flex justify-end border-t border-border pt-4">
                <button
                  type="button"
                  onClick={() => {
                    if (confirm("Remove every item from your cart?")) clearCart();
                  }}
                  className="text-sm text-ink-faint transition-colors hover:text-danger"
                >
                  Clear cart
                </button>
              </div>
            </section>

            <aside className="lg:sticky lg:top-24 lg:self-start">
              <OrderSummary items={buyable} subtotal={subtotal}>
                {blocked > 0 && (
                  <p className="mb-4 text-sm text-premium">
                    Remove the {blocked === 1 ? "unavailable item" : `${blocked} unavailable items`} to check out.
                  </p>
                )}
                {buyable.length > 0 && blocked === 0 && !syncing ? (
                  <Link to="/shop/checkout" className={buttonClass({ size: "lg", fullWidth: true })}>
                    <Lock className="h-4 w-4" /> Proceed to checkout
                  </Link>
                ) : (
                  <span className={buttonClass({ size: "lg", fullWidth: true, className: "pointer-events-none opacity-45" })}>
                    <Lock className="h-4 w-4" /> {syncing ? "Checking stock…" : "Proceed to checkout"}
                  </span>
                )}
                <p className="mt-3 text-center text-xs text-ink-faint">Payments run in test mode. No real charge.</p>
              </OrderSummary>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}

import { useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, ShoppingBag, X } from "lucide-react";
import { useCart, purchasable } from "@/context/CartContext";
import { assetUrl } from "@/api/axios";
import { buttonClass } from "@/components/ui/Button";
import QuantityStepper from "./QuantityStepper";

// Mini cart that slides in from the right whenever something is added.
export default function CartDrawer() {
  const { items, subtotal, itemCount, drawerOpen, closeDrawer, updateQuantity, removeFromCart, lastAdded } = useCart();
  const reduce = useReducedMotion();
  const location = useLocation();
  const closeRef = useRef<HTMLButtonElement>(null);
  const added = items.find((i) => i.productId === lastAdded);

  // Close on route change and on Escape; focus the close button on open.
  useEffect(() => {
    closeDrawer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeDrawer();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [drawerOpen, closeDrawer]);

  const canCheckout = purchasable(items).length > 0;

  return (
    <AnimatePresence>
      {drawerOpen && (
        <div className="fixed inset-0 z-[90]" role="dialog" aria-modal="true" aria-label="Shopping cart">
          <motion.button
            type="button"
            aria-label="Close cart"
            onClick={closeDrawer}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.2 }}
            className="absolute inset-0 bg-base/70"
          />
          <motion.aside
            initial={reduce ? { opacity: 0 } : { x: "100%" }}
            animate={reduce ? { opacity: 1 } : { x: 0 }}
            exit={reduce ? { opacity: 0 } : { x: "100%" }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-border bg-surface shadow-[0_0_60px_rgb(var(--c-shadow)/0.6)]"
          >
            <header className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="font-display text-2xl font-bold text-ink">
                Your cart <span className="num text-ink-faint">({itemCount})</span>
              </h2>
              <button
                ref={closeRef}
                type="button"
                onClick={closeDrawer}
                aria-label="Close cart"
                className="flex h-10 w-10 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink active:bg-base-2"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            {added && (
              <p className="flex items-center gap-2 border-b border-border bg-success/10 px-5 py-3 text-sm text-success">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span className="truncate">Added {added.name}</span>
              </p>
            )}

            {items.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-2 text-ink-faint">
                  <ShoppingBag className="h-6 w-6" />
                </span>
                <p className="font-display text-xl font-bold text-ink">Your cart is empty</p>
                <button type="button" onClick={closeDrawer} className={buttonClass({ variant: "secondary", size: "sm" })}>
                  Keep shopping
                </button>
              </div>
            ) : (
              <ul className="flex-1 divide-y divide-border overflow-y-auto">
                {items.map((item) => (
                  <li key={item.productId} className="flex gap-4 px-5 py-4">
                    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-surface-2">
                      {item.image ? (
                        <img src={assetUrl(item.image)} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-ink-faint">
                          <ShoppingBag className="h-5 w-5" />
                        </span>
                      )}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex items-start justify-between gap-3">
                        <Link
                          to={`/shop/products/${item.productId}`}
                          className="line-clamp-2 font-semibold leading-snug text-ink hover:text-accent"
                        >
                          {item.name}
                        </Link>
                        <span className="num shrink-0 font-semibold text-ink">Rs {item.price * item.quantity}</span>
                      </div>
                      <p className="text-sm text-ink-faint">{item.storeName}</p>
                      <div className="mt-auto flex items-center justify-between gap-3 pt-2">
                        <QuantityStepper
                          size="sm"
                          value={item.quantity}
                          max={item.stock}
                          label={item.name}
                          onChange={(q) => updateQuantity(item.productId, q)}
                          onRemove={() => removeFromCart(item.productId)}
                        />
                        <span className="num text-xs text-ink-faint">Rs {item.price} each</span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {items.length > 0 && (
              <footer className="border-t border-border bg-base-2 px-5 py-5">
                <div className="flex items-baseline justify-between">
                  <span className="text-ink-muted">Subtotal</span>
                  <span className="num font-display text-3xl font-bold text-ink">Rs {subtotal.toFixed(0)}</span>
                </div>
                <p className="mt-1 text-sm text-ink-faint">No delivery fee. Final total confirmed at checkout.</p>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <Link to="/shop/cart" className={buttonClass({ variant: "secondary", size: "lg" })}>
                    View cart
                  </Link>
                  {canCheckout ? (
                    <Link to="/shop/checkout" className={buttonClass({ size: "lg" })}>
                      Checkout
                    </Link>
                  ) : (
                    <span className={buttonClass({ size: "lg", className: "pointer-events-none opacity-45" })}>Checkout</span>
                  )}
                </div>
              </footer>
            )}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}

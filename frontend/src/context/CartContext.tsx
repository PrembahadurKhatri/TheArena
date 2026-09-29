import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { ProductSummary } from "@/types";

// Client-side-only cart (the backend has no cart model — see API_CONTRACT.md
// "### Cart"). Persisted to localStorage so it survives refreshes/new tabs.
// The server never trusts these prices/quantities: checkout re-derives
// everything from live Product documents and will reject anything that
// exceeds current stock.

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  image: string | null;
  storeId: string;
  storeName: string;
  quantity: number;
}

interface CartContextValue {
  items: CartItem[];
  subtotal: number;
  itemCount: number;
  addToCart: (product: ProductSummary, qty?: number) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, qty: number) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);
const STORAGE_KEY = "arena_cart";

function loadCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => loadCart());

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // localStorage can throw in private-browsing/quota-exceeded situations —
      // the cart just won't persist across reloads in that case.
    }
  }, [items]);

  function addToCart(product: ProductSummary, qty = 1) {
    setItems((prev) => {
      const cap = product.stock > 0 ? product.stock : Infinity; // best-effort cap; backend re-validates
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) {
        const nextQty = Math.min(existing.quantity + qty, cap);
        return prev.map((i) => (i.productId === product.id ? { ...i, quantity: nextQty } : i));
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          price: product.price,
          image: product.images?.[0] ?? null,
          storeId: product.store.id,
          storeName: product.store.name,
          quantity: Math.min(qty, cap),
        },
      ];
    });
  }

  function removeFromCart(productId: string) {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  }

  function updateQuantity(productId: string, qty: number) {
    setItems((prev) =>
      qty <= 0
        ? prev.filter((i) => i.productId !== productId)
        : prev.map((i) => (i.productId === productId ? { ...i, quantity: qty } : i))
    );
  }

  function clearCart() {
    setItems([]);
  }

  const subtotal = useMemo(() => items.reduce((sum, i) => sum + i.price * i.quantity, 0), [items]);
  const itemCount = useMemo(() => items.reduce((sum, i) => sum + i.quantity, 0), [items]);

  const value = useMemo(
    () => ({ items, subtotal, itemCount, addToCart, removeFromCart, updateQuantity, clearCart }),
    [items, subtotal, itemCount]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}

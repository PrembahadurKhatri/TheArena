import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import api from "@/api/axios";
import type { ProductDetail, ProductSummary } from "@/types";

// Client-side-only cart (the backend has no cart model — see API_CONTRACT.md
// "### Cart"). Persisted to localStorage so it survives refreshes/new tabs.
// The server never trusts these prices/quantities: checkout re-derives
// everything from live Product documents and will reject anything that
// exceeds current stock. `syncCart` refreshes price/stock from the API so the
// cart and checkout pages show what the server will actually charge.

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  image: string | null;
  storeId: string;
  storeName: string;
  quantity: number;
  /** Last known stock; undefined for carts saved before this field existed. */
  stock?: number;
  /** Set by syncCart when the product no longer exists. */
  unavailable?: boolean;
}

export interface CartNotice {
  productId: string;
  message: string;
}

interface CartContextValue {
  items: CartItem[];
  subtotal: number;
  itemCount: number;
  addToCart: (product: ProductSummary, qty?: number) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, qty: number) => void;
  quantityOf: (productId: string) => number;
  clearCart: () => void;
  syncCart: () => Promise<CartNotice[]>;
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  lastAdded: string | null;
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

const capOf = (stock?: number) => (stock === undefined ? Infinity : Math.max(stock, 0));

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => loadCart());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [lastAdded, setLastAdded] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // localStorage can throw in private-browsing/quota-exceeded situations —
      // the cart just won't persist across reloads in that case.
    }
  }, [items]);

  // Keep several open tabs (the shop opens in its own tab) in step.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY) setItems(loadCart());
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const addToCart = useCallback((product: ProductSummary, qty = 1) => {
    if (product.stock <= 0) return;
    setItems((prev) => {
      const cap = capOf(product.stock);
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) {
        const nextQty = Math.min(existing.quantity + qty, cap);
        return prev.map((i) =>
          i.productId === product.id ? { ...i, quantity: nextQty, stock: product.stock, price: product.price } : i
        );
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
          stock: product.stock,
        },
      ];
    });
    setLastAdded(product.id);
  }, []);

  const removeFromCart = useCallback((productId: string) => {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  }, []);

  const updateQuantity = useCallback((productId: string, qty: number) => {
    setItems((prev) =>
      qty <= 0
        ? prev.filter((i) => i.productId !== productId)
        : prev.map((i) => (i.productId === productId ? { ...i, quantity: Math.min(qty, capOf(i.stock)) } : i))
    );
  }, []);

  const clearCart = useCallback(() => setItems([]), []);
  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const syncCart = useCallback(async () => {
    const current = loadCart();
    if (current.length === 0) return [];
    const results = await Promise.all(
      current.map((i) =>
        api
          .get(`/shop/products/${i.productId}`)
          .then(({ data }) => ({ id: i.productId, product: data.product as ProductDetail }))
          .catch((err) => ({ id: i.productId, product: null, gone: err?.response?.status === 404 }))
      )
    );
    const notices: CartNotice[] = [];
    setItems((prev) =>
      prev.map((item) => {
        const r = results.find((x) => x.id === item.productId);
        if (!r) return item;
        if (!r.product) {
          if ("gone" in r && r.gone) {
            notices.push({ productId: item.productId, message: `${item.name} is no longer sold.` });
            return { ...item, unavailable: true };
          }
          return item;
        }
        const p = r.product;
        let quantity = item.quantity;
        if (p.stock <= 0) {
          notices.push({ productId: item.productId, message: `${p.name} just sold out.` });
        } else if (quantity > p.stock) {
          quantity = p.stock;
          notices.push({ productId: item.productId, message: `Only ${p.stock} of ${p.name} left, so we lowered your quantity.` });
        }
        if (p.price !== item.price) {
          notices.push({ productId: item.productId, message: `${p.name} is now Rs ${p.price}.` });
        }
        return {
          ...item,
          name: p.name,
          price: p.price,
          image: p.images?.[0] ?? null,
          stock: p.stock,
          quantity,
          unavailable: false,
        };
      })
    );
    return notices;
  }, []);

  const subtotal = useMemo(
    () => items.reduce((sum, i) => sum + (i.unavailable || i.stock === 0 ? 0 : i.price * i.quantity), 0),
    [items]
  );
  const itemCount = useMemo(() => items.reduce((sum, i) => sum + i.quantity, 0), [items]);
  const quantityOf = useCallback(
    (productId: string) => items.find((i) => i.productId === productId)?.quantity ?? 0,
    [items]
  );

  const value = useMemo(
    () => ({
      items,
      subtotal,
      itemCount,
      addToCart,
      removeFromCart,
      updateQuantity,
      quantityOf,
      clearCart,
      syncCart,
      drawerOpen,
      openDrawer,
      closeDrawer,
      lastAdded,
    }),
    [items, subtotal, itemCount, addToCart, removeFromCart, updateQuantity, quantityOf, clearCart, syncCart, drawerOpen, openDrawer, closeDrawer, lastAdded]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}

/** Items that can actually be bought right now. */
export function purchasable(items: CartItem[]) {
  return items.filter((i) => !i.unavailable && i.stock !== 0);
}

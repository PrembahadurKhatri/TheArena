import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CheckCircle2, Minus, Plus, ShoppingCart, Store as StoreIcon } from "lucide-react";
import api from "@/api/axios";
import type { ProductDetail as ProductDetailType } from "@/types";
import { apiError } from "@/types";
import { getSportBySlug } from "@/data/sports";
import { useCart } from "@/context/CartContext";
import Reveal from "@/components/Reveal";
import { Loading, ErrorState } from "@/components/ui/StateBlock";
import Button from "@/components/ui/Button";

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const { addToCart, items } = useCart();
  const [product, setProduct] = useState<ProductDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError("");
    setAdded(false);
    setQty(1);
    api
      .get(`/shop/products/${id}`)
      .then(({ data }) => setProduct(data.product))
      .catch((err) => setError(apiError(err, "Could not load this product.")))
      .finally(() => setLoading(false));
  }, [id]);

  const inCartQty = useMemo(
    () => items.find((i) => i.productId === product?.id)?.quantity ?? 0,
    [items, product]
  );

  if (loading) return <Loading label="Loading product..." />;
  if (error || !product) return <ErrorState message={error || "Product not found."} />;

  const sport = product.sport ? getSportBySlug(product.sport) : undefined;
  const outOfStock = product.stock <= 0;
  const remaining = Math.max(product.stock - inCartQty, 0);

  function handleAdd() {
    if (!product) return;
    addToCart(product, qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  return (
    <main className="flex-1 py-16">
      <div className="container-x grid gap-10 lg:grid-cols-5">
        <Reveal className="lg:col-span-3">
          <div className="overflow-hidden rounded-3xl border border-border bg-surface-2">
            {product.images?.[0] ? (
              <img src={product.images[0]} alt={product.name} className="h-64 w-full object-cover md:h-96" />
            ) : (
              <div
                className="flex h-64 w-full items-center justify-center text-6xl md:h-96"
                style={{ background: `${sport?.color ?? "#3a82ff"}22` }}
              >
                {sport?.emoji ?? "🛍️"}
              </div>
            )}
          </div>
        </Reveal>

        <Reveal delay={0.1} className="lg:col-span-2">
          <div className="glass sticky top-24 rounded-3xl p-7">
            <div className="flex flex-wrap gap-2">
              <span className="eyebrow">{product.category}</span>
              {sport && (
                <span className="eyebrow">
                  {sport.emoji} {sport.name}
                </span>
              )}
            </div>
            <h1 className="mt-4 font-display text-2xl font-bold text-ink md:text-3xl">{product.name}</h1>
            <Link
              to={`/shop/stores/${product.store.id}`}
              className="mt-2 flex items-center gap-1.5 text-sm text-ink-muted hover:text-accent"
            >
              <StoreIcon className="h-3.5 w-3.5" /> {product.store.name}
            </Link>

            <p className="mt-4 font-display text-3xl font-semibold text-accent">Rs {product.price}</p>

            <p
              className={`mt-2 text-sm font-medium ${
                outOfStock ? "text-red-400" : product.stock <= 5 ? "text-premium" : "text-ink-muted"
              }`}
            >
              {outOfStock
                ? "Out of stock"
                : product.stock <= 5
                  ? `Only ${product.stock} left`
                  : `${product.stock} in stock`}
            </p>

            {product.description && (
              <p className="mt-4 text-sm leading-relaxed text-ink-muted">{product.description}</p>
            )}

            {!outOfStock && (
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <div className="flex items-center rounded-full border border-border">
                  <button
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    className="flex h-10 w-10 items-center justify-center text-ink-muted hover:text-ink"
                    aria-label="Decrease quantity"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-10 text-center text-sm font-semibold text-ink">{qty}</span>
                  <button
                    onClick={() => setQty((q) => Math.min(remaining || 1, q + 1))}
                    disabled={qty >= remaining}
                    className="flex h-10 w-10 items-center justify-center text-ink-muted hover:text-ink disabled:opacity-40"
                    aria-label="Increase quantity"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <span className="text-xs text-ink-faint">{remaining} available to add</span>
              </div>
            )}

            <Button
              className="mt-6"
              fullWidth
              size="lg"
              disabled={outOfStock || remaining <= 0}
              onClick={handleAdd}
              icon={added ? <CheckCircle2 className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />}
            >
              {outOfStock ? "Out of stock" : added ? "Added to cart" : "Add to cart"}
            </Button>
            {!outOfStock && remaining <= 0 && (
              <p className="mt-2 text-center text-xs text-ink-faint">
                You already have the max available stock in your cart.
              </p>
            )}

            <Link to="/shop/cart" className="mt-4 block text-center text-sm font-medium text-accent hover:underline">
              View cart
            </Link>
          </div>
        </Reveal>
      </div>
    </main>
  );
}

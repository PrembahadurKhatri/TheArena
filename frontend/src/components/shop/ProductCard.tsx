import { Link } from "react-router-dom";
import { ImageOff, ShoppingCart, Store as StoreIcon } from "lucide-react";
import type { ProductSummary } from "@/types";
import { useCart } from "@/context/CartContext";
import { useSpotlight } from "@/hooks/useSpotlight";
import { getSportBySlug } from "@/data/sports";
import Reveal from "@/components/Reveal";
import Button from "@/components/ui/Button";

// Shared product card used by ShopHome, StoreDetail, and anywhere else a
// product grid appears — mirrors the GroundCard pattern (spotlight glass
// card, Reveal entrance) but adds an inline "Add to cart" action that works
// right from the grid without leaving the page.
export default function ProductCard({ product, index = 0 }: { product: ProductSummary; index?: number }) {
  const spot = useSpotlight<HTMLDivElement>();
  const { addToCart, items } = useCart();
  const sport = product.sport ? getSportBySlug(product.sport) : undefined;

  const inCartQty = items.find((i) => i.productId === product.id)?.quantity ?? 0;
  const outOfStock = product.stock <= 0;
  const atCap = !outOfStock && inCartQty >= product.stock;

  return (
    <Reveal delay={(index % 8) * 0.05}>
      <div
        ref={spot.ref}
        onMouseMove={spot.onMouseMove}
        className="spotlight glass group flex h-full flex-col overflow-hidden rounded-2xl transition-transform hover:-translate-y-1 hover:border-accent/40"
      >
        <Link to={`/shop/products/${product.id}`} className="relative block h-36 w-full overflow-hidden bg-surface-2">
          {product.images?.[0] ? (
            <img
              src={product.images[0]}
              alt={product.name}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center text-3xl"
              style={{ background: `${sport?.color ?? "#3a82ff"}22` }}
            >
              {sport?.emoji ?? <ImageOff className="h-7 w-7 text-ink-faint" />}
            </div>
          )}
          {outOfStock && (
            <span className="absolute right-3 top-3 rounded-full bg-red-500/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
              Out of stock
            </span>
          )}
        </Link>

        <div className="flex flex-1 flex-col gap-1.5 p-5">
          <span className="text-xs font-medium uppercase tracking-widest text-ink-faint">{product.category}</span>
          <Link
            to={`/shop/products/${product.id}`}
            className="line-clamp-1 font-display text-lg font-semibold text-ink hover:text-accent"
          >
            {product.name}
          </Link>
          <Link
            to={`/shop/stores/${product.store.id}`}
            className="flex items-center gap-1.5 text-xs text-ink-muted hover:text-accent"
          >
            <StoreIcon className="h-3 w-3" /> {product.store.name}
          </Link>

          <div className="mt-auto flex items-center justify-between gap-2 pt-3">
            <span className="font-display text-lg font-semibold text-accent">Rs {product.price}</span>
            <Button
              size="sm"
              variant="secondary"
              icon={<ShoppingCart className="h-3.5 w-3.5" />}
              disabled={outOfStock || atCap}
              onClick={() => addToCart(product, 1)}
            >
              {outOfStock ? "Out of stock" : atCap ? "Max in cart" : "Add"}
            </Button>
          </div>
        </div>
      </div>
    </Reveal>
  );
}

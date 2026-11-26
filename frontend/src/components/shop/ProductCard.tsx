import { Link } from "react-router-dom";
import { ImageOff, ShoppingBag, Store as StoreIcon } from "lucide-react";
import type { ProductSummary } from "@/types";
import { useCart } from "@/context/CartContext";
import { getSportBySlug } from "@/data/sports";
import { assetUrl } from "@/api/axios";
import QuantityStepper from "./QuantityStepper";

// Shared product card for ShopHome, StoreDetail and any other product grid.
// "Add to cart" turns into a − n + stepper once the product is in the cart.
export default function ProductCard({ product }: { product: ProductSummary; index?: number }) {
  const { addToCart, updateQuantity, removeFromCart, quantityOf, openDrawer } = useCart();
  const sport = product.sport ? getSportBySlug(product.sport) : undefined;

  const inCartQty = quantityOf(product.id);
  const outOfStock = product.stock <= 0;
  const lowStock = !outOfStock && product.stock <= 5;

  return (
    <article className="panel card-lift group flex h-full flex-col overflow-hidden">
      <Link to={`/shop/products/${product.id}`} className="relative block aspect-square w-full overflow-hidden bg-surface-2">
        {product.images?.[0] ? (
          <img
            src={assetUrl(product.images[0])}
            alt={product.name}
            loading="lazy"
            className={`h-full w-full object-cover ${outOfStock ? "opacity-50 grayscale" : ""}`}
          />
        ) : (
          <span className="flex h-full w-full flex-col items-center justify-center gap-2 text-ink-faint">
            <ImageOff className="h-7 w-7" />
            <span className="text-sm">No photo yet</span>
          </span>
        )}
        {outOfStock ? (
          <span className="absolute left-3 top-3 rounded-full bg-danger px-2.5 py-1 text-xs font-semibold text-base">
            Sold out
          </span>
        ) : lowStock ? (
          <span className="absolute left-3 top-3 rounded-full bg-premium px-2.5 py-1 text-xs font-semibold text-black">
            Only {product.stock} left
          </span>
        ) : null}
      </Link>

      <div className="flex flex-1 flex-col gap-1 p-4">
        <span className="text-xs text-ink-faint">
          {product.category}
          {sport ? `, ${sport.name}` : ""}
        </span>
        <Link
          to={`/shop/products/${product.id}`}
          className="line-clamp-2 font-display text-xl font-bold leading-tight text-ink hover:text-accent"
        >
          {product.name}
        </Link>
        <Link
          to={`/shop/stores/${product.store.id}`}
          className="mt-0.5 flex w-fit items-center gap-1.5 text-sm text-ink-muted hover:text-accent"
        >
          <StoreIcon className="h-3.5 w-3.5" /> {product.store.name}
        </Link>

        <p className="num mt-auto pt-3 font-display text-2xl font-bold text-ink">
          Rs {product.unitPrice ?? product.price}
          {product.discountPrice != null && <span className="ml-2 text-sm font-normal text-ink-faint line-through">Rs {product.price}</span>}
        </p>

        <div className="mt-3">
          {product.hasVariants && !outOfStock ? (
            <Link
              to={`/shop/products/${product.slug || product.id}`}
              className="inline-flex h-10 w-full items-center justify-center rounded-full border border-accent/40 text-sm font-semibold text-accent hover:bg-accent-soft"
            >
              Choose options
            </Link>
          ) : outOfStock ? (
            <span className="flex h-10 w-full items-center justify-center rounded-full bg-surface-2 text-sm font-semibold text-ink-faint">
              Out of stock
            </span>
          ) : inCartQty > 0 ? (
            <div className="flex items-center justify-between gap-2">
              <QuantityStepper
                value={inCartQty}
                max={product.stock}
                label={product.name}
                onChange={(q) => updateQuantity(product.id, q)}
                onRemove={() => removeFromCart(product.id)}
              />
              <button
                type="button"
                onClick={openDrawer}
                className="whitespace-nowrap text-sm font-semibold text-accent hover:underline"
              >
                In cart
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                addToCart(product, 1);
                openDrawer();
              }}
              className="inline-flex h-10 w-full items-center justify-center gap-2 whitespace-nowrap rounded-full bg-accent text-sm font-semibold text-white transition-colors hover:bg-accent/90 active:bg-accent/80"
            >
              <ShoppingBag className="h-4 w-4" /> Add to cart
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

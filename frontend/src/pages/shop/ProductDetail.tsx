import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ImageOff, RotateCcw, ShieldCheck, ShoppingBag, Store as StoreIcon, Truck, Zap } from "lucide-react";
import api, { assetUrl } from "@/api/axios";
import type { ProductDetail as ProductDetailType } from "@/types";
import { apiError } from "@/types";
import { getSportBySlug } from "@/data/sports";
import { useCart } from "@/context/CartContext";
import { Loading, ErrorState } from "@/components/ui/StateBlock";
import Button, { buttonClass } from "@/components/ui/Button";
import QuantityStepper from "@/components/shop/QuantityStepper";

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToCart, updateQuantity, removeFromCart, quantityOf, openDrawer } = useCart();
  const [product, setProduct] = useState<ProductDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [qty, setQty] = useState(1);
  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError("");
    setQty(1);
    setActiveImage(0);
    api
      .get(`/shop/products/${id}`)
      .then(({ data }) => setProduct(data.product))
      .catch((err) => setError(apiError(err, "Could not load this product.")))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Loading label="Loading product…" />;
  if (error || !product) return <ErrorState message={error || "Product not found."} />;

  const sport = product.sport ? getSportBySlug(product.sport) : undefined;
  const outOfStock = product.stock <= 0;
  const inCartQty = quantityOf(product.id);
  const images = product.images ?? [];

  function handleAdd() {
    if (!product) return;
    addToCart(product, qty);
    openDrawer();
  }

  function handleBuyNow() {
    if (!product) return;
    if (inCartQty === 0) addToCart(product, qty);
    navigate("/shop/checkout");
  }

  return (
    <main className="flex-1">
      <div className="container-x py-10 md:py-14">
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
          <Link to="/shop" className="inline-flex items-center gap-1.5 hover:text-ink">
            <ArrowLeft className="h-4 w-4" /> Shop
          </Link>
          <span className="text-ink-faint">/</span>
          <Link to={`/shop?category=${encodeURIComponent(product.category)}`} className="hover:text-ink">
            {product.category}
          </Link>
        </nav>

        <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-14">
          <div>
            <div className="aspect-square overflow-hidden rounded-3xl border border-border bg-surface-2 md:aspect-[5/4]">
              {images[activeImage] ? (
                <img src={assetUrl(images[activeImage])} alt={product.name} className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full flex-col items-center justify-center gap-2 text-ink-faint">
                  <ImageOff className="h-10 w-10" />
                  <span>No photo yet</span>
                </span>
              )}
            </div>
            {images.length > 1 && (
              <ul className="mt-3 flex gap-3 overflow-x-auto">
                {images.map((img, i) => (
                  <li key={img}>
                    <button
                      type="button"
                      onClick={() => setActiveImage(i)}
                      aria-label={`Show image ${i + 1}`}
                      aria-pressed={i === activeImage}
                      className={`block h-20 w-20 overflow-hidden rounded-xl border-2 transition-colors ${
                        i === activeImage ? "border-accent" : "border-transparent opacity-70 hover:opacity-100"
                      }`}
                    >
                      <img src={assetUrl(img)} alt="" className="h-full w-full object-cover" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="lg:sticky lg:top-24 lg:self-start">
            <p className="text-sm text-ink-faint">
              {product.category}
              {sport ? `, ${sport.name}` : ""}
            </p>
            <h1 className="mt-2 font-display text-4xl font-bold leading-[1] text-ink md:text-5xl">{product.name}</h1>
            <Link
              to={`/shop/stores/${product.store.id}`}
              className="mt-3 inline-flex items-center gap-1.5 text-ink-muted hover:text-accent"
            >
              <StoreIcon className="h-4 w-4" /> Sold by {product.store.name}
            </Link>

            <div className="mt-8 flex items-baseline justify-between gap-4 border-y border-border py-6">
              <p className="num font-display text-5xl font-bold text-ink">Rs {product.price}</p>
              <p
                className={`text-sm font-semibold ${
                  outOfStock ? "text-danger" : product.stock <= 5 ? "text-premium" : "text-success"
                }`}
              >
                {outOfStock ? "Out of stock" : product.stock <= 5 ? `Only ${product.stock} left` : "In stock"}
              </p>
            </div>

            {outOfStock ? (
              <p className="mt-6 rounded-xl border border-border bg-base-2 px-4 py-3 text-ink-muted">
                This item is sold out right now. Check back later or browse similar gear.
              </p>
            ) : inCartQty > 0 ? (
              <div className="mt-6 flex flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent/30 bg-accent-soft px-4 py-3">
                  <span className="text-sm font-semibold text-accent">In your cart</span>
                  <QuantityStepper
                    value={inCartQty}
                    max={product.stock}
                    label={product.name}
                    onChange={(q) => updateQuantity(product.id, q)}
                    onRemove={() => removeFromCart(product.id)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={openDrawer} className={buttonClass({ variant: "secondary", size: "lg" })}>
                    View cart
                  </button>
                  <Link to="/shop/checkout" className={buttonClass({ size: "lg" })}>
                    Checkout
                  </Link>
                </div>
              </div>
            ) : (
              <div className="mt-6 flex flex-col gap-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-ink-muted">Quantity</span>
                  <QuantityStepper
                    size="lg"
                    value={qty}
                    max={product.stock}
                    label={product.name}
                    onChange={setQty}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Button variant="secondary" size="lg" onClick={handleAdd} icon={<ShoppingBag className="h-4 w-4" />}>
                    Add to cart
                  </Button>
                  <Button size="lg" onClick={handleBuyNow} icon={<Zap className="h-4 w-4" />}>
                    Buy now
                  </Button>
                </div>
              </div>
            )}

            <ul className="mt-8 flex flex-col gap-3 text-sm text-ink-muted">
              <li className="flex items-center gap-3">
                <Truck className="h-4 w-4 shrink-0 text-ink-faint" /> No delivery fee added at checkout
              </li>
              <li className="flex items-center gap-3">
                <ShieldCheck className="h-4 w-4 shrink-0 text-ink-faint" /> Price and stock checked again at checkout
              </li>
              <li className="flex items-center gap-3">
                <RotateCcw className="h-4 w-4 shrink-0 text-ink-faint" /> Unpaid orders release their stock automatically
              </li>
            </ul>

            {product.description && (
              <section className="mt-8 border-t border-border pt-6">
                <h2 className="font-display text-2xl font-bold text-ink">Details</h2>
                <p className="mt-3 max-w-[60ch] leading-relaxed text-ink-muted">{product.description}</p>
              </section>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

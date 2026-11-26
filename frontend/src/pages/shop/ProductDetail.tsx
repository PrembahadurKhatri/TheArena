import { useEffect, useState } from "react";
import ReportButton from "@/components/ReportButton";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Banknote, Heart, ImageOff, RotateCcw, ShieldCheck, ShoppingBag, Star, Store as StoreIcon, Truck, Zap } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Textarea } from "@/components/ui/Field";
import api, { assetUrl } from "@/api/axios";
import type { ProductDetail as ProductDetailType } from "@/types";
import { apiError } from "@/types";
import { getSportBySlug } from "@/data/sports";
import { useCart } from "@/context/CartContext";
import { Loading, ErrorState } from "@/components/ui/StateBlock";
import Button, { buttonClass } from "@/components/ui/Button";
import QuantityStepper from "@/components/shop/QuantityStepper";

interface Review {
  id: string;
  rating: number;
  text: string | null;
  user: { name: string } | null;
  merchantReply: string | null;
  createdAt: string;
}

function Reviews({ productId, reviews, onAdded, canReview }: { productId: string; reviews: Review[]; onAdded: (r: Review) => void; canReview: boolean }) {
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  return (
    <section className="mt-16 border-t border-border pt-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-3xl font-bold text-ink">Reviews</h2>
        {canReview && !open && (
          <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
            Write a review
          </Button>
        )}
      </div>
      {open && (
        <form
          className="panel mt-6 flex flex-col gap-4 p-5"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              const { data } = await api.post(`/shop/products/${productId}/reviews`, { rating, text });
              onAdded(data.review);
              setOpen(false);
              setText("");
            } catch (err) {
              setError(apiError(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="flex gap-1" role="radiogroup" aria-label="Rating">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} stars`} onClick={() => setRating(n)}>
                <Star className={`h-7 w-7 ${n <= rating ? "fill-premium text-premium" : "text-ink-faint"}`} />
              </button>
            ))}
          </div>
          <Textarea label="Your review (optional)" value={text} maxLength={2000} onChange={(e) => setText(e.target.value)} />
          <p className="text-xs text-ink-faint">You can review products that have been delivered to you.</p>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" size="sm" loading={busy}>
              Post review
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
      {reviews.length === 0 ? (
        <p className="mt-6 text-sm text-ink-faint">No reviews yet.</p>
      ) : (
        <ul className="mt-6 grid gap-4 md:grid-cols-2">
          {reviews.map((r) => (
            <li key={r.id} className="panel p-5">
              <p className="flex items-center gap-1">
                {Array.from({ length: 5 }, (_, i) => (
                  <Star key={i} className={`h-4 w-4 ${i < r.rating ? "fill-premium text-premium" : "text-ink-faint"}`} />
                ))}
                <span className="ml-2 text-sm font-semibold text-ink">{r.user?.name}</span>
              </p>
              {r.text && <p className="mt-2 text-ink-muted">{r.text}</p>}
              {r.merchantReply && <p className="mt-3 rounded-lg bg-base-2 px-3 py-2 text-sm text-ink-muted">Shop’s reply: {r.merchantReply}</p>}
              <p className="mt-2 text-xs text-ink-faint">{new Date(r.createdAt).toLocaleDateString()}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToCart, updateQuantity, removeFromCart, quantityOf, openDrawer } = useCart();
  const [product, setProduct] = useState<ProductDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [qty, setQty] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  const [variantId, setVariantId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const { user } = useAuth();

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError("");
    setQty(1);
    setActiveImage(0);
    api
      .get(`/shop/products/${id}`)
      .then(({ data }) => {
        setProduct(data.product);
        setVariantId(null);
      })
      .catch((err) => setError(apiError(err, "Could not load this product.")))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!product) return;
    api.get(`/shop/products/${product.id}/reviews`).then(({ data }) => setReviews(data.reviews)).catch(() => undefined);
    if (user) api.get("/shop/wishlist").then(({ data }) => setSaved(data.products.some((p: { id: string }) => p.id === product.id))).catch(() => undefined);
  }, [product, user]);

  if (loading) return <Loading label="Loading product…" />;
  if (error || !product) return <ErrorState message={error || "Product not found."} />;

  const sport = product.sport ? getSportBySlug(product.sport) : undefined;
  const variants = product.variants ?? [];
  const variant = variants.find((v) => v.id === variantId) ?? null;
  const needsChoice = variants.length > 0 && !variant;
  const stock = variant ? variant.stock : product.stock;
  const outOfStock = stock <= 0 && !needsChoice;
  const lineKey = variant ? `${product.id}:${variant.id}` : product.id;
  const inCartQty = needsChoice ? 0 : quantityOf(lineKey);
  const images = product.images ?? [];
  const price = product.unitPrice ?? product.price;
  const labelOf = (v: { size: string | null; color: string | null }) => [v.size, v.color].filter(Boolean).join(" / ");
  const cartVariant = variant ? { id: variant.id, label: labelOf(variant), stock: variant.stock } : undefined;

  function handleAdd() {
    if (!product || needsChoice) return;
    addToCart(product, qty, cartVariant);
    openDrawer();
  }

  function handleBuyNow() {
    if (!product || needsChoice) return;
    if (inCartQty === 0) addToCart(product, qty, cartVariant);
    navigate("/shop/checkout");
  }

  async function toggleSave() {
    if (!product) return;
    if (!user) return navigate("/login", { state: { from: `/shop/products/${product.id}` } });
    await (saved ? api.delete(`/shop/wishlist/${product.id}`) : api.post(`/shop/wishlist/${product.id}`)).catch(() => undefined);
    setSaved(!saved);
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
            <div className="mt-2 flex items-start justify-between gap-4">
              <h1 className="font-display text-4xl font-bold leading-[1] text-ink md:text-5xl">{product.name}</h1>
              <button onClick={toggleSave} aria-pressed={saved} aria-label={saved ? "Remove from wishlist" : "Save to wishlist"} className={`mt-1 rounded-full border p-2.5 ${saved ? "border-danger/30 bg-danger/10 text-danger" : "border-border text-ink-faint hover:text-ink"}`}>
                <Heart className={`h-5 w-5 ${saved ? "fill-current" : ""}`} />
              </button>
            </div>
            {product.brand && <p className="mt-2 text-ink-muted">{product.brand}</p>}
            {!!product.rating?.count && (
              <p className="mt-2 flex items-center gap-1.5 text-sm text-ink-muted">
                <Star className="h-4 w-4 fill-premium text-premium" /> <span className="num font-semibold text-ink">{product.rating.avg}</span> ({product.rating.count} review{product.rating.count === 1 ? "" : "s"})
              </p>
            )}
            <Link
              to={`/shop/stores/${product.store.slug || product.store.id}`}
              className="mt-3 inline-flex items-center gap-1.5 text-ink-muted hover:text-accent"
            >
              <StoreIcon className="h-4 w-4" /> Sold by {product.store.name}
            </Link>

            <div className="mt-8 flex items-baseline justify-between gap-4 border-y border-border py-6">
              <p className="num font-display text-5xl font-bold text-ink">
                Rs {price}
                {product.discountPrice != null && <span className="ml-3 text-2xl font-normal text-ink-faint line-through">Rs {product.price}</span>}
              </p>
              {!needsChoice && (
                <p className={`text-sm font-semibold ${outOfStock ? "text-danger" : stock <= 5 ? "text-premium" : "text-success"}`}>
                  {outOfStock ? "Out of stock" : stock <= 5 ? `Only ${stock} left` : "In stock"}
                </p>
              )}
            </div>
            {variants.length > 0 && (
              <fieldset className="mt-6">
                <legend className="mb-2 text-sm font-medium text-ink-muted">Choose an option</legend>
                <div className="flex flex-wrap gap-2">
                  {variants.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      disabled={v.stock <= 0}
                      aria-pressed={variantId === v.id}
                      onClick={() => {
                        setVariantId(v.id);
                        setQty(1);
                      }}
                      className={`rounded-xl border px-4 py-2 text-sm font-semibold transition-colors ${
                        variantId === v.id ? "border-accent bg-accent text-white" : v.stock <= 0 ? "border-border text-ink-faint line-through" : "border-border text-ink hover:border-accent"
                      }`}
                    >
                      {labelOf(v)}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}

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
                    max={stock}
                    label={product.name}
                    onChange={(q) => updateQuantity(lineKey, q)}
                    onRemove={() => removeFromCart(lineKey)}
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
                    max={Math.max(stock, 1)}
                    label={product.name}
                    onChange={setQty}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Button variant="secondary" size="lg" disabled={needsChoice} onClick={handleAdd} icon={<ShoppingBag className="h-4 w-4" />}>
                    {needsChoice ? "Choose an option" : "Add to cart"}
                  </Button>
                  <Button size="lg" disabled={needsChoice} onClick={handleBuyNow} icon={<Zap className="h-4 w-4" />}>
                    Buy now
                  </Button>
                </div>
              </div>
            )}

            <ul className="mt-8 flex flex-col gap-3 text-sm text-ink-muted">
              <li className="flex items-center gap-3">
                <Banknote className="h-4 w-4 shrink-0 text-ink-faint" /> Cash on delivery
              </li>
              <li className="flex items-center gap-3">
                <Truck className="h-4 w-4 shrink-0 text-ink-faint" /> No delivery fee added at checkout
              </li>
              <li className="flex items-center gap-3">
                <ShieldCheck className="h-4 w-4 shrink-0 text-ink-faint" /> Price and stock checked again at checkout
              </li>
              <li className="flex items-center gap-3">
                <RotateCcw className="h-4 w-4 shrink-0 text-ink-faint" /> Cancel any time before it ships
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
        <div className="mt-6">
          <ReportButton targetType="product" targetId={product.id} />
        </div>
        <Reviews productId={product.id} reviews={reviews} onAdded={(r) => setReviews((list) => [r, ...list])} canReview={!!user} />
      </div>
    </main>
  );
}

import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search, ShoppingBag, Store as StoreIcon } from "lucide-react";
import api from "@/api/axios";
import { SPORTS, SPORT_FILTER_OPTIONS } from "@/data/sports";
import { SHOP_CATEGORY_OPTIONS } from "@/data/shopCategories";
import type { ProductSummary } from "@/types";
import { apiError } from "@/types";
import Reveal from "@/components/Reveal";
import { Loading, ErrorState, EmptyState } from "@/components/ui/StateBlock";
import { Input } from "@/components/ui/Field";
import CustomSelect from "@/components/ui/CustomSelect";
import ProductCard from "@/components/shop/ProductCard";

const CATEGORY_FILTER_OPTIONS = [{ value: "", label: "All Categories" }, ...SHOP_CATEGORY_OPTIONS];

export default function ShopHome() {
  const [params, setParams] = useSearchParams();
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const sport = params.get("sport") ?? "";
  const category = params.get("category") ?? "";
  const search = params.get("search") ?? "";
  const [searchInput, setSearchInput] = useState(search);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    api
      .get("/shop/products", {
        params: {
          sport: sport || undefined,
          category: category || undefined,
          search: search || undefined,
        },
      })
      .then(({ data }) => alive && setProducts(data.products ?? []))
      .catch((err) => alive && setError(apiError(err, "Could not load products.")))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [sport, category, search]);

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  }

  return (
    <main className="flex-1">
      {/* HERO */}
      <section className="grain relative overflow-hidden border-b border-border py-16 md:py-20">
        <div className="pointer-events-none absolute left-1/2 top-0 h-80 w-80 -translate-x-1/2 rounded-full bg-accent/20 blur-[140px]" />
        <div className="container-x relative">
          <Reveal>
            <span className="eyebrow">
              <ShoppingBag className="h-3.5 w-3.5" /> The Arena Shop
            </span>
          </Reveal>
          <Reveal delay={0.06}>
            <h1 className="mt-4 max-w-2xl font-display text-4xl font-bold text-ink md:text-5xl">
              Gear up for <span className="text-gradient-accent">every sport</span>
            </h1>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-muted md:text-base">
              Bats, balls, jerseys, boots and more — from stores run by players just like you. Browse, add to cart,
              and check out in seconds.
            </p>
          </Reveal>
          <Reveal delay={0.14}>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/shop/stores"
                className="glass inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-ink hover:border-accent/40"
              >
                <StoreIcon className="h-4 w-4" /> Browse stores
              </Link>
              <Link
                to="/shop/my-store"
                className="shine inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent/90"
              >
                Sell on The Arena
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* CATEGORY QUICK FILTER */}
      <section className="border-b border-border py-7">
        <div className="container-x">
          <div className="flex flex-wrap gap-2">
            {CATEGORY_FILTER_OPTIONS.map((c) => (
              <button
                key={c.value || "all"}
                onClick={() => updateParam("category", c.value)}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                  category === c.value
                    ? "border-accent/50 bg-accent-soft text-accent"
                    : "border-border text-ink-muted hover:border-accent/30 hover:text-ink"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* BROWSE BY SPORT */}
      <section className="border-b border-border py-7">
        <div className="container-x">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-ink-faint">Browse by sport</h2>
          <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
            <button
              onClick={() => updateParam("sport", "")}
              className={`flex shrink-0 flex-col items-center gap-2 rounded-2xl border px-5 py-3 transition-colors ${
                sport === "" ? "border-accent/50 bg-accent-soft" : "border-border hover:border-accent/30"
              }`}
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-lg">🛍️</span>
              <span className="text-xs font-medium text-ink">All</span>
            </button>
            {SPORTS.map((s) => (
              <button
                key={s.slug}
                onClick={() => updateParam("sport", s.slug)}
                className={`flex shrink-0 flex-col items-center gap-2 rounded-2xl border px-5 py-3 transition-colors ${
                  sport === s.slug ? "border-accent/50 bg-accent-soft" : "border-border hover:border-accent/30"
                }`}
              >
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-full text-lg"
                  style={{ background: `${s.color}22` }}
                >
                  {s.emoji}
                </span>
                <span className="text-xs font-medium text-ink">{s.name}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* PRODUCT GRID */}
      <section className="py-12">
        <div className="container-x">
          <div className="flex flex-col gap-3 sm:flex-row">
            <form
              className="relative flex-1"
              onSubmit={(e) => {
                e.preventDefault();
                updateParam("search", searchInput);
              }}
            >
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search products by name..."
                className="pl-11"
              />
            </form>
            <CustomSelect
              value={sport}
              onChange={(v) => updateParam("sport", v)}
              options={SPORT_FILTER_OPTIONS}
              className="sm:w-56"
            />
          </div>

          <div className="mt-10">
            {loading && <Loading label="Loading products..." />}
            {!loading && error && <ErrorState message={error} />}
            {!loading && !error && products.length === 0 && (
              <EmptyState title="No products found" message="Try a different search, sport, or category." />
            )}
            {!loading && !error && products.length > 0 && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {products.map((p, i) => (
                  <ProductCard key={p.id} product={p} index={i} />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

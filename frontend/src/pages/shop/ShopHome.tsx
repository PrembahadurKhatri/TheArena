import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { LayoutGrid, Search, SlidersHorizontal, Store as StoreIcon, X } from "lucide-react";
import api from "@/api/axios";
import { SPORTS, getSportBySlug } from "@/data/sports";
import type { ProductSummary } from "@/types";
import { apiError } from "@/types";
import { Loading, ErrorState, EmptyState } from "@/components/ui/StateBlock";
import { Input } from "@/components/ui/Field";
import CustomSelect from "@/components/ui/CustomSelect";
import ProductCard from "@/components/shop/ProductCard";
import ShopFilters from "@/components/shop/ShopFilters";
import type { ShopFacets } from "@/components/shop/ShopFilters";
import PageHero from "@/components/page/PageHero";
import { buttonClass } from "@/components/ui/Button";

const SORT_OPTIONS = [
  { value: "", label: "Newest first" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "name_asc", label: "Name: A to Z" },
];

const chip = (active: boolean) =>
  `inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-4 text-sm font-medium transition-colors ${
    active
      ? "border-accent bg-accent-soft text-accent"
      : "border-border text-ink-muted hover:border-ink-faint/50 hover:text-ink active:bg-surface"
  }`;

const fmt = (n: string) => Number(n).toLocaleString("en-IN");
const priceLabel = (min: string, max: string) =>
  min && max ? `Rs ${fmt(min)} to ${fmt(max)}` : min ? `Over Rs ${fmt(min)}` : max ? `Under Rs ${fmt(max)}` : "";

export default function ShopHome() {
  const [params, setParams] = useSearchParams();
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [facets, setFacets] = useState<ShopFacets | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const sport = params.get("sport") ?? "";
  const category = params.get("category") ?? "";
  const search = params.get("search") ?? "";
  const sort = params.get("sort") ?? "";
  const minPrice = params.get("minPrice") ?? "";
  const maxPrice = params.get("maxPrice") ?? "";
  const inStock = params.get("inStock") === "1";
  const [searchInput, setSearchInput] = useState(search);

  // The product grid: every filter applied.
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
          sort: sort || undefined,
          minPrice: minPrice || undefined,
          maxPrice: maxPrice || undefined,
          inStock: inStock ? "1" : undefined,
        },
      })
      .then(({ data }) => alive && setProducts(data.products ?? []))
      .catch((err) => alive && setError(apiError(err, "Could not load products.")))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [sport, category, search, sort, minPrice, maxPrice, inStock]);

  // The filter box's counts: only sport and search applied, so each option
  // shows how many products it would leave.
  useEffect(() => {
    let alive = true;
    api
      .get("/shop/products", { params: { sport: sport || undefined, search: search || undefined } })
      .then(({ data }) => {
        if (!alive) return;
        const all: ProductSummary[] = data.products ?? [];
        const categoryCounts: Record<string, number> = {};
        for (const p of all) categoryCounts[p.category] = (categoryCounts[p.category] ?? 0) + 1;
        setFacets({
          categoryCounts,
          total: all.length,
          inStock: all.filter((p) => p.stock > 0).length,
          maxPrice: all.reduce((m, p) => Math.max(m, p.price), 0),
        });
      })
      .catch(() => alive && setFacets(null));
    return () => {
      alive = false;
    };
  }, [sport, search]);

  function updateParams(changes: Record<string, string>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setParams(next);
  }
  const updateParam = (key: string, value: string) => updateParams({ [key]: value });

  function clearFilters() {
    setSearchInput("");
    updateParams({ category: "", minPrice: "", maxPrice: "", inStock: "", search: "" });
  }

  const activeSport = getSportBySlug(sport);
  const activeFilters: { label: string; clear: () => void }[] = [];
  if (category) activeFilters.push({ label: category, clear: () => updateParam("category", "") });
  if (minPrice || maxPrice)
    activeFilters.push({ label: priceLabel(minPrice, maxPrice), clear: () => updateParams({ minPrice: "", maxPrice: "" }) });
  if (inStock) activeFilters.push({ label: "In stock only", clear: () => updateParam("inStock", "") });
  if (search)
    activeFilters.push({
      label: `“${search}”`,
      clear: () => {
        setSearchInput("");
        updateParam("search", "");
      },
    });

  return (
    <main className="flex-1">
      <PageHero
        size="lg"
        title={activeSport ? `${activeSport.name} gear` : "Gear up for every sport"}
        lead="Bats, balls, jerseys and boots from stores run by players."
        image={activeSport?.image ?? "/sports/badminton.jpg"}
        actions={
          <>
            <Link to="/shop/stores" className={buttonClass({ variant: "secondary", size: "lg" })}>
              <StoreIcon className="h-4 w-4" /> Browse stores
            </Link>
            <Link to="/shop/my-store" className={buttonClass({ size: "lg" })}>
              Sell on The Arena
            </Link>
          </>
        }
      >
        <form
          role="search"
          className="relative max-w-2xl"
          onSubmit={(e) => {
            e.preventDefault();
            updateParam("search", searchInput.trim());
          }}
        >
          <Search className="pointer-events-none absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search products by name"
            aria-label="Search products"
            className="pl-11"
          />
        </form>
      </PageHero>

      <div className="sticky top-16 z-30 border-b border-border bg-base/95 backdrop-blur">
        <div className="container-x py-3">
          <nav aria-label="Sport" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <ul className="flex w-max gap-2">
              <li>
                <button type="button" onClick={() => updateParam("sport", "")} className={chip(sport === "")}>
                  <LayoutGrid className="h-4 w-4" /> All sports
                </button>
              </li>
              {SPORTS.map((s) => (
                <li key={s.slug}>
                  <button
                    type="button"
                    onClick={() => updateParam("sport", s.slug)}
                    className={`${chip(sport === s.slug)} pl-1`}
                  >
                    {s.image && <img src={s.image} alt="" className="h-8 w-8 rounded-full object-cover" />}
                    {s.name}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>

      <div className="container-x grid gap-8 py-10 md:py-12 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <aside
          aria-label="Filters"
          className={`${filtersOpen ? "block" : "hidden"} lg:sticky lg:top-36 lg:block lg:max-h-[calc(100vh-10rem)] lg:self-start lg:overflow-y-auto lg:rounded-2xl`}
        >
          <ShopFilters
            category={category}
            minPrice={minPrice}
            maxPrice={maxPrice}
            inStock={inStock}
            facets={facets}
            activeCount={activeFilters.length}
            onChange={updateParams}
            onClear={clearFilters}
          />
        </aside>

        <section aria-label="Products" className="min-w-0">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setFiltersOpen((v) => !v)}
                aria-expanded={filtersOpen}
                className={buttonClass({ variant: "secondary", size: "sm", className: "lg:hidden" })}
              >
                <SlidersHorizontal className="h-4 w-4" /> Filters
                {activeFilters.length > 0 && <span className="num text-accent">({activeFilters.length})</span>}
              </button>
              {!loading && !error && (
                <p className="text-sm text-ink-muted">
                  <span className="num font-semibold text-ink">{products.length}</span>{" "}
                  {products.length === 1 ? "product" : "products"}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden text-sm text-ink-faint sm:inline">Sort by</span>
              <CustomSelect value={sort} onChange={(v) => updateParam("sort", v)} options={SORT_OPTIONS} className="w-52" />
            </div>
          </div>

          {activeFilters.length > 0 && (
            <ul className="mb-6 flex flex-wrap gap-2">
              {activeFilters.map((f) => (
                <li key={f.label}>
                  <button
                    type="button"
                    onClick={f.clear}
                    aria-label={`Remove filter ${f.label}`}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full border border-accent/30 bg-accent-soft pl-3 pr-2 text-sm font-medium text-accent transition-colors hover:bg-accent/20"
                  >
                    {f.label} <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {loading && <Loading label="Loading products…" />}
          {!loading && error && <ErrorState message={error} />}
          {!loading && !error && products.length === 0 && (
            <EmptyState
              title="No products found"
              message="Try another category, a wider price range, or a different sport."
              action={
                activeFilters.length > 0 ? (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className={buttonClass({ variant: "secondary", size: "sm", className: "mt-2" })}
                  >
                    Clear filters
                  </button>
                ) : undefined
              }
            />
          )}
          {!loading && !error && products.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-[repeat(auto-fill,minmax(min(100%,14rem),1fr))]">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

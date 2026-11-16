import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  Backpack,
  ChevronDown,
  CircleDot,
  Footprints,
  LayoutGrid,
  Package,
  PackageCheck,
  ShieldHalf,
  Shirt,
  SlidersHorizontal,
  Volleyball,
  Wand,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SHOP_CATEGORIES } from "@/data/shopCategories";

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  "": LayoutGrid,
  Bats: Wand,
  Balls: Volleyball,
  Jerseys: Shirt,
  Footwear: Footprints,
  "Protective Gear": ShieldHalf,
  Rackets: CircleDot,
  Accessories: Backpack,
  Other: Package,
};

const PRICE_PRESETS = [
  { label: "Under 1k", min: "", max: "1000" },
  { label: "1k to 5k", min: "1000", max: "5000" },
  { label: "5k to 10k", min: "5000", max: "10000" },
  { label: "Over 10k", min: "10000", max: "" },
];

export interface ShopFacets {
  /** Product count per category for the current sport and search. */
  categoryCounts: Record<string, number>;
  total: number;
  inStock: number;
  maxPrice: number;
}

const fmt = (n: number) => n.toLocaleString("en-IN");

function Group({ title, summary, children }: { title: string; summary?: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <section className="border-t border-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-surface-2/60"
      >
        <span className="font-semibold text-ink">{title}</span>
        <span className="flex min-w-0 items-center gap-2">
          {summary && <span className="truncate text-xs font-medium text-accent">{summary}</span>}
          <ChevronDown className={`h-4 w-4 shrink-0 text-ink-faint transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        </span>
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </section>
  );
}

export default function ShopFilters({
  category,
  minPrice,
  maxPrice,
  inStock,
  facets,
  activeCount,
  onChange,
  onClear,
}: {
  category: string;
  minPrice: string;
  maxPrice: string;
  inStock: boolean;
  facets: ShopFacets | null;
  activeCount: number;
  onChange: (changes: Record<string, string>) => void;
  onClear: () => void;
}) {
  // Slider scale: round the dearest product up to a friendly step.
  const ceiling = Math.max(1000, Math.ceil((facets?.maxPrice ?? 10000) / 1000) * 1000);
  const step = ceiling > 20000 ? 500 : 100;

  const [lo, setLo] = useState(minPrice ? Number(minPrice) : 0);
  const [hi, setHi] = useState(maxPrice ? Number(maxPrice) : ceiling);
  const [priceError, setPriceError] = useState("");

  useEffect(() => {
    setLo(minPrice ? Number(minPrice) : 0);
    setHi(maxPrice ? Number(maxPrice) : ceiling);
  }, [minPrice, maxPrice, ceiling]);

  function commit(nextLo = lo, nextHi = hi) {
    if (nextLo > nextHi) {
      setPriceError("Minimum is higher than maximum.");
      return;
    }
    setPriceError("");
    onChange({
      minPrice: nextLo > 0 ? String(nextLo) : "",
      maxPrice: nextHi < ceiling ? String(nextHi) : "",
    });
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    commit();
  }

  const loPct = (Math.min(lo, ceiling) / ceiling) * 100;
  const hiPct = (Math.min(hi, ceiling) / ceiling) * 100;
  const priceSummary =
    minPrice || maxPrice
      ? `Rs ${minPrice ? fmt(Number(minPrice)) : "0"} to ${maxPrice ? fmt(Number(maxPrice)) : "any"}`
      : undefined;

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface">
      <header className="relative flex items-center justify-between gap-3 bg-base-2 px-5 py-4">
        <span className="absolute inset-x-0 top-0 h-0.5 bg-accent" />
        <h2 className="flex items-center gap-2.5 font-display text-2xl font-bold text-ink">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-soft text-accent">
            <SlidersHorizontal className="h-4 w-4" />
          </span>
          Filters
          {activeCount > 0 && (
            <span className="num flex h-6 min-w-6 items-center justify-center rounded-full bg-accent px-1.5 font-body text-xs font-bold text-white">
              {activeCount}
            </span>
          )}
        </h2>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="rounded-full px-3 py-1.5 text-sm font-semibold text-accent transition-colors hover:bg-accent-soft active:bg-accent-soft/70"
          >
            Clear all
          </button>
        )}
      </header>

      <Group title="Category" summary={category || undefined}>
        <ul className="flex flex-col gap-1" role="radiogroup" aria-label="Category">
          {["", ...SHOP_CATEGORIES].map((c) => {
            const Icon = CATEGORY_ICONS[c] ?? Package;
            const active = category === c;
            const count = c ? facets?.categoryCounts[c] ?? 0 : facets?.total;
            const empty = c !== "" && facets !== null && count === 0;
            return (
              <li key={c || "all"}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => onChange({ category: c })}
                  className={`group relative flex w-full items-center gap-3 rounded-xl py-1.5 pl-1.5 pr-2.5 text-left text-sm transition-colors ${
                    active
                      ? "bg-accent-soft text-ink"
                      : "text-ink-muted hover:bg-surface-2 hover:text-ink active:bg-base-2"
                  } ${empty && !active ? "opacity-50" : ""}`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
                      active ? "bg-accent text-white" : "bg-base-2 text-ink-faint group-hover:text-accent"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className={`flex-1 truncate ${active ? "font-semibold" : ""}`}>{c || "All categories"}</span>
                  {count !== undefined && (
                    <span
                      className={`num rounded-full px-2 py-0.5 text-xs font-semibold ${
                        active ? "bg-accent/20 text-accent" : "bg-base-2 text-ink-faint"
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </Group>

      <Group title="Price" summary={priceSummary}>
        <div className="rounded-xl border border-border bg-base-2 px-4 pb-4 pt-3">
          <div className="flex items-baseline justify-between">
            <span className="num font-display text-xl font-bold text-ink">Rs {fmt(lo)}</span>
            <span className="text-xs text-ink-faint">to</span>
            <span className="num font-display text-xl font-bold text-ink">
              {hi >= ceiling ? `Rs ${fmt(ceiling)}+` : `Rs ${fmt(hi)}`}
            </span>
          </div>

          <div className="relative mt-4 h-5">
            <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-surface-2" />
            <div
              className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-accent"
              style={{ left: `${loPct}%`, right: `${100 - hiPct}%` }}
            />
            <input
              type="range"
              min={0}
              max={ceiling}
              step={step}
              value={Math.min(lo, ceiling)}
              onChange={(e) => setLo(Math.min(Number(e.target.value), hi - step))}
              onPointerUp={() => commit()}
              onKeyUp={() => commit()}
              aria-label="Minimum price"
              className="dual-range"
            />
            <input
              type="range"
              min={0}
              max={ceiling}
              step={step}
              value={Math.min(hi, ceiling)}
              onChange={(e) => setHi(Math.max(Number(e.target.value), lo + step))}
              onPointerUp={() => commit()}
              onKeyUp={() => commit()}
              aria-label="Maximum price"
              className="dual-range"
            />
          </div>

          <form onSubmit={onSubmit} className="mt-4 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
            {[
              { label: "Min", value: lo, set: setLo },
              { label: "Max", value: hi, set: setHi },
            ].map((f, i) => (
              <label
                key={f.label}
                className={`flex h-10 min-w-0 items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 transition-[border-color,box-shadow] focus-within:border-accent focus-within:ring-4 focus-within:ring-accent/15 ${
                  i === 1 ? "col-start-3" : ""
                }`}
              >
                <span className="text-xs text-ink-faint">Rs</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={f.value}
                  onChange={(e) => f.set(Math.max(0, Number(e.target.value) || 0))}
                  aria-label={`${f.label}imum price`}
                  className="num w-full min-w-0 bg-transparent text-sm text-ink outline-none"
                />
              </label>
            ))}
            <span className="col-start-2 row-start-1 text-ink-faint">to</span>
            <button
              type="submit"
              className="col-span-3 mt-1 h-9 rounded-full bg-surface-2 text-sm font-semibold text-ink transition-colors hover:bg-accent hover:text-white active:bg-accent/80"
            >
              Apply
            </button>
          </form>
          {priceError && <p className="mt-2 text-xs text-danger">{priceError}</p>}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          {PRICE_PRESETS.map((p) => {
            const active = minPrice === p.min && maxPrice === p.max;
            return (
              <button
                key={p.label}
                type="button"
                aria-pressed={active}
                onClick={() => onChange(active ? { minPrice: "", maxPrice: "" } : { minPrice: p.min, maxPrice: p.max })}
                className={`h-9 rounded-full border text-sm font-medium transition-colors ${
                  active
                    ? "border-accent bg-accent text-white"
                    : "border-border text-ink-muted hover:border-accent/50 hover:text-ink active:bg-surface-2"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </Group>

      <Group title="Availability">
        <label
          className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent ${
            inStock ? "border-accent/40 bg-accent-soft" : "border-border bg-base-2 hover:border-ink-faint/50"
          }`}
        >
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
              inStock ? "bg-accent text-white" : "bg-surface text-ink-faint"
            }`}
          >
            <PackageCheck className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-ink">In stock only</span>
            {facets && (
              <span className="block text-xs text-ink-faint">
                <span className="num">{facets.inStock}</span> of <span className="num">{facets.total}</span> available
              </span>
            )}
          </span>
          <input
            type="checkbox"
            checked={inStock}
            onChange={(e) => onChange({ inStock: e.target.checked ? "1" : "" })}
            className="peer sr-only"
          />
          <span
            aria-hidden="true"
            className="relative h-6 w-11 shrink-0 rounded-full bg-surface-2 ring-1 ring-border transition-colors peer-checked:bg-accent after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-ink after:transition-transform peer-checked:after:translate-x-5"
          />
        </label>
      </Group>
    </div>
  );
}

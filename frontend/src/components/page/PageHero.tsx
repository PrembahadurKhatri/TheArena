import type { ReactNode } from "react";

interface PageHeroProps {
  title: ReactNode;
  lead?: ReactNode;
  /** A photograph from /public/sports (or any real image). Omit for a plain band. */
  image?: string | null;
  /** CSS object-position for the photo, e.g. "center 30%". */
  imagePosition?: string;
  /** Small context line above the title (e.g. a back link). Plain text, sentence case. */
  above?: ReactNode;
  actions?: ReactNode;
  /** Toolbar that sits on the bottom edge of the masthead (filters, tabs). */
  children?: ReactNode;
  size?: "md" | "lg";
}

// The masthead every inner page opens on: a real sport photograph bleeding
// in from the right under a veil of the page colour, the title set large at
// the bottom left, and the page's tools docked under it.
export default function PageHero({
  title,
  lead,
  image,
  imagePosition = "center",
  above,
  actions,
  children,
  size = "md",
}: PageHeroProps) {
  return (
    // No overflow-hidden here: the filter dropdowns docked in the toolbar must be
    // able to open past the masthead's bottom edge. z-20 keeps them above the
    // page content (cards create their own stacking contexts on hover).
    <section className="relative isolate z-20 border-b border-border bg-base-2">
      {image && (
        <div className="absolute inset-y-0 right-0 -z-10 w-full overflow-hidden md:w-[68%]">
          <img
            src={image}
            alt=""
            aria-hidden="true"
            fetchPriority="high"
            className="h-full w-full object-cover opacity-80 saturate-[0.85]"
            style={{ objectPosition: imagePosition }}
          />
        </div>
      )}
      <div className="masthead-veil absolute inset-0 -z-10" />

      <div
        className={`container-x flex flex-col justify-end gap-8 ${
          size === "lg" ? "min-h-[440px] pb-12 pt-24 md:min-h-[520px]" : "min-h-[300px] pb-10 pt-20 md:min-h-[360px]"
        }`}
      >
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0 max-w-2xl">
            {above && <div className="mb-4 text-sm text-ink-muted">{above}</div>}
            <h1 className="font-display text-5xl font-bold leading-[0.95] text-ink md:text-7xl">{title}</h1>
            {lead && <p className="mt-4 max-w-lg text-lg leading-relaxed text-ink-muted">{lead}</p>}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>}
        </div>
        {children}
      </div>
    </section>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  tone = "accent",
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  tone?: "accent" | "premium";
}) {
  return (
    <div role="tablist" className="inline-flex h-12 items-center gap-1 rounded-full border border-border bg-base-2 p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value || "__all__"}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={`h-full whitespace-nowrap rounded-full px-4 text-sm font-semibold transition-colors duration-150 ${
              active
                ? tone === "premium"
                  ? "bg-premium text-black"
                  : "bg-accent text-white"
                : "text-ink-muted hover:bg-surface hover:text-ink active:bg-surface-2"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

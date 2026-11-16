import { SPORTS } from "@/data/sports";

// Photo tiles as a radio group: the sport you pick is the photograph you see.
export default function SportPicker({
  value,
  onChange,
  label = "Sport",
  name = "sport",
}: {
  value: string;
  onChange: (slug: string) => void;
  label?: string;
  name?: string;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium text-ink-muted">
        {label} <span className="text-accent">*</span>
      </legend>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,7.5rem),1fr))] gap-2">
        {SPORTS.map((s) => {
          const checked = value === s.slug;
          return (
            <label
              key={s.slug}
              className={`group relative flex aspect-[4/3] min-w-0 cursor-pointer items-end overflow-hidden rounded-xl border-2 transition-[border-color] duration-150 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent ${
                checked ? "border-accent" : "border-transparent hover:border-ink-faint/50"
              }`}
            >
              <input
                type="radio"
                name={name}
                value={s.slug}
                checked={checked}
                onChange={() => onChange(s.slug)}
                className="sr-only"
              />
              {s.image && (
                <img
                  src={s.image}
                  alt=""
                  loading="lazy"
                  className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-150 ${
                    checked ? "opacity-100" : "opacity-55 group-hover:opacity-80"
                  }`}
                />
              )}
              <span className="photo-veil-bottom absolute inset-0" />
              <span className="relative px-2.5 pb-2 text-sm font-semibold text-ink">{s.name}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

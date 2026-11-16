import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
  /** Optional photo shown as a small thumbnail beside the label. */
  image?: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
}

// A custom dropdown that replaces the native <select> for filter controls,
// since native <option>s are drawn by the OS and can't carry a thumbnail.
export default function CustomSelect({ value, onChange, options, placeholder = "Select…", className = "" }: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, []);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`flex h-12 w-full items-center justify-between gap-2 rounded-xl border bg-base-2 px-4 text-[15px] text-ink outline-none transition-[border-color,box-shadow] duration-150 hover:border-ink-faint/50 focus-visible:border-accent focus-visible:ring-4 focus-visible:ring-accent/15 active:bg-base ${
          open ? "border-accent/60" : "border-border"
        }`}
      >
        <span className="flex min-w-0 items-center gap-2.5">
          {selected?.image && (
            <img src={selected.image} alt="" className="h-6 w-6 shrink-0 rounded-md object-cover" />
          )}
          <span className={`truncate ${selected ? "" : "text-ink-faint"}`}>{selected?.label ?? placeholder}</span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-ink-faint transition-transform duration-200 ${open ? "rotate-180 text-accent" : ""}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="listbox"
            initial={reduce ? false : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -4 }}
            transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
            className="absolute left-0 right-0 z-30 mt-2 max-h-80 overflow-y-auto rounded-xl border border-border bg-surface-2 p-1.5 shadow-[0_18px_40px_-12px_rgb(var(--c-shadow)/0.6)]"
          >
            {options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={opt.value || "__all__"}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                    isSelected ? "bg-accent-soft text-accent" : "text-ink-muted hover:bg-surface hover:text-ink active:bg-base-2"
                  }`}
                >
                  {opt.image && <img src={opt.image} alt="" className="h-7 w-7 shrink-0 rounded-md object-cover" />}
                  <span className="flex-1 truncate">{opt.label}</span>
                  {isSelected && <Check className="h-4 w-4 shrink-0" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

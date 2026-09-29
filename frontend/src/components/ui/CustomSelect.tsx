import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
  icon?: string;
  color?: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
}

// A fully custom, attractively-styled dropdown that replaces the native
// <select> for filter controls — native <option> elements are rendered by
// the OS and can't be restyled, which is why filter dropdowns used to look
// plain/inconsistent with the rest of the UI (and gave no visual hint they
// were even clickable). This one shows a chevron on the trigger and a
// glass/blur styled menu with per-option icon + color swatches.
export default function CustomSelect({ value, onChange, options, placeholder = "Select...", className = "" }: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
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
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center justify-between gap-2 rounded-xl border bg-surface px-4 py-2.5 text-sm text-ink outline-none transition-colors hover:border-accent/40 focus:border-accent focus:ring-2 focus:ring-accent/20 ${
          open ? "border-accent/50" : "border-border"
        }`}
      >
        <span className="flex min-w-0 items-center gap-2">
          {selected?.icon && (
            <span
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs"
              style={{ background: selected.color ? `${selected.color}26` : undefined }}
            >
              {selected.icon}
            </span>
          )}
          <span className="truncate">{selected?.label ?? placeholder}</span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-ink-faint transition-transform duration-300 ${open ? "rotate-180 text-accent" : ""}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="glass absolute left-0 right-0 z-30 mt-2 max-h-80 overflow-y-auto rounded-xl p-1.5 shadow-2xl"
          >
            {options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={opt.value || "__all__"}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                    isSelected ? "bg-accent-soft text-accent" : "text-ink-muted hover:bg-surface-2 hover:text-ink"
                  }`}
                >
                  {opt.icon && (
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs"
                      style={{ background: opt.color ? `${opt.color}26` : undefined }}
                    >
                      {opt.icon}
                    </span>
                  )}
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

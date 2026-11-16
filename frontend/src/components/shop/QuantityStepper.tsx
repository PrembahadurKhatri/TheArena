import { Minus, Plus, Trash2 } from "lucide-react";

// − n + control. At 1, the minus becomes a bin when `onRemove` is given.
export default function QuantityStepper({
  value,
  max,
  onChange,
  onRemove,
  size = "md",
  label = "item",
}: {
  value: number;
  max?: number;
  onChange: (next: number) => void;
  onRemove?: () => void;
  size?: "sm" | "md" | "lg";
  label?: string;
}) {
  const h = size === "sm" ? "h-9" : size === "lg" ? "h-12" : "h-10";
  const w = size === "sm" ? "w-9" : size === "lg" ? "w-12" : "w-10";
  const atMax = max !== undefined && value >= max;
  const showBin = value <= 1 && onRemove;

  return (
    <div className={`inline-flex ${h} items-center rounded-full border border-border bg-base-2`}>
      <button
        type="button"
        onClick={() => (showBin ? onRemove!() : onChange(Math.max(1, value - 1)))}
        disabled={!showBin && value <= 1}
        aria-label={showBin ? `Remove ${label}` : `Decrease quantity of ${label}`}
        className={`flex ${h} ${w} items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface hover:text-ink active:bg-surface-2 disabled:opacity-35 ${
          showBin ? "hover:text-danger" : ""
        }`}
      >
        {showBin ? <Trash2 className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
      </button>
      <output aria-live="polite" className="num min-w-8 px-1 text-center text-sm font-semibold text-ink">
        {value}
      </output>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        disabled={atMax}
        aria-label={`Increase quantity of ${label}`}
        className={`flex ${h} ${w} items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface hover:text-ink active:bg-surface-2 disabled:opacity-35`}
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

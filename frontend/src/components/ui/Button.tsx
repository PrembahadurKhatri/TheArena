import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "premium" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

type ConflictingHandlers =
  | "children"
  | "onDrag"
  | "onDragStart"
  | "onDragEnd"
  | "onAnimationStart"
  | "onAnimationEnd"
  | "onAnimationIteration";

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, ConflictingHandlers> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  children?: ReactNode;
  fullWidth?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-accent text-white hover:bg-accent/90 active:bg-accent/80",
  secondary: "border border-border bg-surface text-ink hover:border-ink-faint/60 hover:bg-surface-2 active:bg-surface",
  ghost: "text-ink-muted hover:bg-surface hover:text-ink active:bg-surface-2",
  premium: "bg-premium text-black hover:bg-premium/90 active:bg-premium/80",
  danger: "border border-danger/30 bg-danger/10 text-danger hover:bg-danger/20 active:bg-danger/25",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-9 px-4 text-sm gap-1.5",
  md: "h-11 px-5 text-sm gap-2",
  lg: "h-12 px-7 text-base gap-2.5",
};

// Shared class builder so <Link>s can look exactly like buttons without
// nesting a <button> inside an <a>.
export function buttonClass({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className = "",
}: { variant?: ButtonVariant; size?: ButtonSize; fullWidth?: boolean; className?: string } = {}) {
  return `inline-flex select-none items-center justify-center whitespace-nowrap rounded-full font-semibold transition-[background-color,border-color,color,transform] duration-150 active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-45 disabled:active:translate-y-0 ${variantClasses[variant]} ${sizeClasses[size]} ${fullWidth ? "w-full" : ""} ${className}`;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, icon, children, className = "", fullWidth, disabled, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClass({ variant, size, fullWidth, className })}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  );
});

export default Button;

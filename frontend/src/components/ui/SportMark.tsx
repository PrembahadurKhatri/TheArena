import type { ReactNode } from "react";
import { Shield } from "lucide-react";
import { getSportBySlug } from "@/data/sports";

const SIZES = {
  xs: "h-6 w-6 rounded-md",
  sm: "h-8 w-8 rounded-lg",
  md: "h-12 w-12 rounded-xl",
  lg: "h-16 w-16 rounded-2xl",
  xl: "h-24 w-24 rounded-2xl",
} as const;

// A sport's own photograph, cropped small, in place of the emoji the data
// file carries. Falls back to a plain icon tile when a sport has no photo.
export default function SportMark({
  slug,
  size = "md",
  className = "",
  fallback,
}: {
  slug?: string;
  size?: keyof typeof SIZES;
  className?: string;
  fallback?: ReactNode;
}) {
  const sport = slug ? getSportBySlug(slug) : undefined;
  if (sport?.image) {
    return (
      <img
        src={sport.image}
        alt=""
        aria-hidden="true"
        loading="lazy"
        className={`${SIZES[size]} shrink-0 object-cover ring-1 ring-border ${className}`}
      />
    );
  }
  return (
    <span className={`${SIZES[size]} flex shrink-0 items-center justify-center bg-surface-2 text-accent ${className}`}>
      {fallback ?? <Shield className="h-1/2 w-1/2" />}
    </span>
  );
}

export function Initials({ name, className = "" }: { name: string; className?: string }) {
  const letters = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("");
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center bg-accent-soft font-display font-bold text-accent ${className}`}
    >
      {letters || "?"}
    </span>
  );
}

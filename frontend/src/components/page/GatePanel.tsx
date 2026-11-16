import type { ReactNode } from "react";

// A single centred panel for pages that need something first: a login,
// or a Premium membership.
export default function GatePanel({
  icon,
  title,
  children,
  tone = "accent",
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  tone?: "accent" | "premium";
}) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-24">
      <div className="panel w-full max-w-lg p-8 text-center md:p-10">
        <span
          className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${
            tone === "premium" ? "bg-premium-soft text-premium" : "bg-accent-soft text-accent"
          }`}
        >
          {icon}
        </span>
        <h1 className="mt-6 font-display text-4xl font-bold leading-none text-ink">{title}</h1>
        {children}
      </div>
    </main>
  );
}

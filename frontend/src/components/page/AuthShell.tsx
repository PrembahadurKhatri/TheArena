import type { ReactNode } from "react";
import { Link } from "react-router-dom";

// Split screen for the account pages: a sport photograph on the left at
// desktop widths, the form on the right. On phones the photo steps aside.
export default function AuthShell({
  title,
  lead,
  image,
  imagePosition = "center",
  children,
  footer,
}: {
  title: string;
  lead?: ReactNode;
  image: string;
  imagePosition?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="grid flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="relative hidden overflow-hidden border-r border-border lg:block">
        <img
          src={image}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover saturate-[0.85]"
          style={{ objectPosition: imagePosition }}
        />
        <div className="photo-veil-bottom absolute inset-0" />
        <div className="relative flex h-full flex-col justify-end p-12">
          <Link to="/" className="flex w-fit items-center gap-3">
            <img src="/logo.png" alt="" className="h-11 w-11 object-contain" />
            <span className="font-display text-2xl font-bold text-ink">The Arena</span>
          </Link>
          <p className="mt-4 max-w-sm text-lg leading-relaxed text-ink-muted">
            Teams, tournaments, grounds and rankings across 10 sports.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center px-4 py-16 sm:px-8 lg:py-24">
        <div className="w-full max-w-[26rem]">
          <h1 className="font-display text-4xl font-bold leading-none text-ink md:text-5xl">{title}</h1>
          {lead && <p className="mt-3 text-base leading-relaxed text-ink-muted">{lead}</p>}
          <div className="mt-9">{children}</div>
          {footer && <div className="mt-8 border-t border-border pt-6 text-sm text-ink-muted">{footer}</div>}
        </div>
      </div>
    </main>
  );
}

export function FormError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-xl border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-danger">
      {children}
    </p>
  );
}

export function FormNotice({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="rounded-xl border border-success/25 bg-success/10 px-4 py-3 text-sm text-success">
      {children}
    </p>
  );
}

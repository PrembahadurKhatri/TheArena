import { Link } from "react-router-dom";
import { Facebook, Instagram, Twitter } from "lucide-react";

const EXPLORE = [
  { to: "/teams", label: "Teams" },
  { to: "/players", label: "Players" },
  { to: "/tournaments", label: "Tournaments" },
  { to: "/grounds", label: "Grounds" },
  { to: "/rankings", label: "Rankings" },
];

const COMPANY = [
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
  { to: "/membership", label: "Membership" },
];

const LEGAL = [
  { to: "/privacy", label: "Privacy Policy" },
  { to: "/terms", label: "Terms of Service" },
];

export default function Footer() {
  return (
    <footer className="grain relative overflow-hidden border-t border-border bg-base-2">
      <div className="pointer-events-none absolute -left-40 bottom-0 h-72 w-72 rounded-full bg-accent/10 blur-[120px]" />
      <div className="container-x relative py-16">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-5">
          <div className="col-span-2">
            <Link to="/" className="flex items-center gap-2.5">
              <img src="/logo.png" alt="The Arena" className="h-9 w-9 object-contain" />
              <span className="font-display text-lg font-bold tracking-wide text-ink">
                THE <span className="text-gradient-accent">ARENA</span>
              </span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-ink-muted">
              Find teams, join tournaments, book grounds, and climb the rankings across 10 sports — one platform
              for every player.
            </p>
            <div className="mt-5 flex gap-3">
              {[Facebook, Instagram, Twitter].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-ink-muted transition-colors hover:border-accent/40 hover:text-accent"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h4 className="mb-4 text-xs font-semibold uppercase tracking-widest text-ink-faint">Explore</h4>
            <ul className="flex flex-col gap-2.5">
              {EXPLORE.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className="text-sm text-ink-muted hover:text-ink">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-4 text-xs font-semibold uppercase tracking-widest text-ink-faint">Company</h4>
            <ul className="flex flex-col gap-2.5">
              {COMPANY.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className="text-sm text-ink-muted hover:text-ink">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-4 text-xs font-semibold uppercase tracking-widest text-ink-faint">Legal</h4>
            <ul className="flex flex-col gap-2.5">
              {LEGAL.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className="text-sm text-ink-muted hover:text-ink">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-3 border-t border-border pt-6 text-xs text-ink-faint md:flex-row">
          <p>© {new Date().getFullYear()} The Arena. All rights reserved.</p>
          <p>Built for players, by players.</p>
        </div>
      </div>
    </footer>
  );
}

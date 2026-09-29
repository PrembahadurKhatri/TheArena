import { useEffect, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Crown, LogOut, Menu, User, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const NAV_LINKS = [
  { to: "/teams", label: "Teams" },
  { to: "/players", label: "Players" },
  { to: "/tournaments", label: "Tournaments" },
  { to: "/grounds", label: "Grounds" },
  { to: "/rankings", label: "Rankings" },
  { to: "/membership", label: "Membership" },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function handleLogout() {
    logout();
    setMenuOpen(false);
    navigate("/");
  }

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `relative rounded-full px-3.5 py-2 text-sm font-medium tracking-wide transition-all duration-300 ${
      isActive ? "bg-accent-soft text-accent" : "text-ink-muted hover:bg-surface hover:text-ink"
    }`;

  return (
    <header
      className={`sticky top-0 z-50 border-b backdrop-blur-xl transition-all duration-300 ${
        scrolled ? "border-border bg-base/90 shadow-lg shadow-black/20" : "border-border/50 bg-base/50"
      }`}
    >
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent" />

      <div className="container-x flex h-16 items-center justify-between">
        <Link to="/" className="group flex items-center gap-2.5" onClick={() => setOpen(false)}>
          <span className="relative flex h-9 w-9 items-center justify-center">
            <span className="absolute inset-0 rounded-full bg-accent/40 opacity-0 blur-md transition-opacity duration-300 group-hover:opacity-100" />
            <img
              src="/logo.png"
              alt="The Arena"
              className="relative h-9 w-9 object-contain transition-transform duration-300 group-hover:scale-110"
            />
          </span>
          <span className="font-display text-lg font-bold tracking-wide text-ink">
            THE <span className="text-gradient-accent">ARENA</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map((link) => (
            <NavLink key={link.to} to={link.to} className={linkClass}>
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          {user ? (
            <div className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-2 rounded-full border border-border bg-surface py-1.5 pl-1.5 pr-3 transition-colors hover:border-accent/40 hover:bg-surface-2"
              >
                {user.photo ? (
                  <img src={user.photo} alt={user.name} className="h-7 w-7 rounded-full object-cover" />
                ) : (
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-soft text-accent">
                    <User className="h-3.5 w-3.5" />
                  </div>
                )}
                <span className="text-sm font-medium text-ink">{user.name.split(" ")[0]}</span>
                {user.isPremium && <Crown className="h-3.5 w-3.5 text-premium drop-shadow-[0_0_6px_rgb(var(--c-premium)/0.7)]" />}
                <ChevronDown
                  className={`h-3.5 w-3.5 text-ink-faint transition-transform duration-300 ${menuOpen ? "rotate-180" : ""}`}
                />
              </button>

              <AnimatePresence>
                {menuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.15 }}
                    className="glass absolute right-0 mt-2 w-48 overflow-hidden rounded-xl py-1.5 shadow-xl"
                  >
                    <Link
                      to="/dashboard"
                      onClick={() => setMenuOpen(false)}
                      className="block px-4 py-2 text-sm text-ink-muted hover:bg-surface-2 hover:text-ink"
                    >
                      Dashboard
                    </Link>
                    <Link
                      to="/team-dashboard"
                      onClick={() => setMenuOpen(false)}
                      className="block px-4 py-2 text-sm text-ink-muted hover:bg-surface-2 hover:text-ink"
                    >
                      Team Dashboard
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-400 hover:bg-surface-2"
                    >
                      <LogOut className="h-3.5 w-3.5" /> Logout
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <>
              <span className="h-5 w-px bg-border" />
              <Link
                to="/login"
                className="rounded-full px-4 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-surface hover:text-ink"
              >
                Login
              </Link>
              <Link
                to="/register"
                className="shine rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-[0_0_20px_-6px_rgb(var(--c-accent)/0.7)] transition-all hover:bg-accent/90 hover:shadow-[0_0_24px_-4px_rgb(var(--c-accent)/0.9)]"
              >
                Register
              </Link>
            </>
          )}
        </div>

        <button
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-ink transition-colors hover:border-accent/40 hover:bg-surface lg:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-border bg-base lg:hidden"
          >
            <div className="container-x flex flex-col gap-1 py-4">
              {NAV_LINKS.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-sm font-medium text-ink-muted hover:bg-surface hover:text-ink"
                >
                  {link.label}
                </NavLink>
              ))}
              <div className="mt-2 flex flex-col gap-2 border-t border-border pt-3">
                {user ? (
                  <>
                    <Link
                      to="/dashboard"
                      onClick={() => setOpen(false)}
                      className="rounded-lg px-3 py-2.5 text-sm font-medium text-ink hover:bg-surface"
                    >
                      Dashboard {user.isPremium && "👑"}
                    </Link>
                    <button
                      onClick={() => {
                        setOpen(false);
                        handleLogout();
                      }}
                      className="rounded-lg px-3 py-2.5 text-left text-sm font-medium text-red-400 hover:bg-surface"
                    >
                      Logout
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      to="/login"
                      onClick={() => setOpen(false)}
                      className="rounded-lg px-3 py-2.5 text-sm font-medium text-ink hover:bg-surface"
                    >
                      Login
                    </Link>
                    <Link
                      to="/register"
                      onClick={() => setOpen(false)}
                      className="rounded-full bg-accent px-3 py-2.5 text-center text-sm font-semibold text-white"
                    >
                      Register
                    </Link>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Users } from "lucide-react";
import type { SportDef } from "@/data/sports";
import { useSpotlight } from "@/hooks/useSpotlight";

export default function SportCard({ sport, index }: { sport: SportDef; index: number }) {
  const spot = useSpotlight<HTMLAnchorElement>();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, delay: (index % 6) * 0.06, ease: [0.22, 1, 0.36, 1] }}
      className="h-full"
    >
      <Link
        ref={spot.ref}
        onMouseMove={spot.onMouseMove}
        to={`/teams?sport=${sport.slug}`}
        className="spotlight group relative block h-56 overflow-hidden rounded-2xl border border-border bg-surface transition-transform duration-300 hover:-translate-y-1 hover:border-accent/40"
      >
        {sport.image ? (
          <>
            <img
              src={sport.image}
              alt={sport.name}
              loading="lazy"
              className="spotlight-bg absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
            />
            <div className="spotlight-bg absolute inset-0 bg-gradient-to-t from-black/95 via-black/50 to-black/10" />
          </>
        ) : (
          <div
            className="spotlight-bg absolute inset-0 opacity-90 transition-opacity group-hover:opacity-100"
            style={{
              background: `radial-gradient(120% 120% at 20% 20%, ${sport.color}33, transparent 60%), linear-gradient(160deg, rgb(var(--c-surface)), rgb(var(--c-surface-2)))`,
            }}
          />
        )}

        <div className="relative flex h-full flex-col justify-end p-4">
          <div className="flex items-end justify-between gap-2">
            <div className="min-w-0">
              <h3 className={`font-display text-xl font-bold ${sport.image ? "text-white" : "text-ink"}`}>
                {sport.name}
              </h3>
              <p
                className={`mt-0.5 truncate text-xs font-medium ${
                  sport.image ? "text-white/70" : "text-ink-faint"
                }`}
              >
                {sport.tagline}
              </p>
            </div>
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white backdrop-blur-sm transition-all duration-300 group-hover:translate-x-0.5 group-hover:bg-accent group-hover:text-white"
            >
              <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export function FeaturedSportCard({ sport }: { sport: SportDef }) {
  const spot = useSpotlight<HTMLAnchorElement>();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="h-full"
    >
      <Link
        ref={spot.ref}
        onMouseMove={spot.onMouseMove}
        to={`/teams?sport=${sport.slug}`}
        className="spotlight group relative block h-full min-h-[22rem] overflow-hidden rounded-3xl border border-border bg-surface transition-colors duration-300 hover:border-accent/40 lg:min-h-full"
      >
        {sport.image && (
          <img
            src={sport.image}
            alt={sport.name}
            loading="lazy"
            className="spotlight-bg absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        )}
        <div className="spotlight-bg absolute inset-0 bg-gradient-to-t from-black/95 via-black/70 to-black/20 md:bg-gradient-to-r md:from-black/95 md:via-black/70 md:to-black/10" />

        <div className="relative flex h-full flex-col justify-end p-7 md:max-w-sm">
          <div>
            <h3 className="font-display text-4xl font-bold leading-[1.05] text-white">{sport.name}</h3>
            {sport.nickname && (
              <p className="mt-1 font-display text-lg font-semibold text-accent">{sport.nickname}</p>
            )}
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-white/70">
              Find teams, follow live tournaments, and climb the leaderboard — all in one place.
            </p>

            <motion.span
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.97 }}
              className="shine mt-6 inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white hover:bg-accent/90"
            >
              Explore {sport.name} <ArrowRight className="h-4 w-4" />
            </motion.span>
          </div>
        </div>

        <div className="glass absolute bottom-6 right-6 hidden items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold text-ink sm:flex">
          <Users className="h-3.5 w-3.5 text-accent" /> 500+ Players
        </div>
      </Link>
    </motion.div>
  );
}

import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Calendar, CheckCircle2, Globe, Play, Shield, Trophy, UserPlus, Users, Zap } from "lucide-react";
import { SPORTS } from "@/data/sports";
import SportCard, { FeaturedSportCard } from "@/components/SportCard";
import Reveal from "@/components/Reveal";
import VideoModal from "@/components/VideoModal";

const STATS = [
  { label: "Sports covered", value: "10", icon: Trophy },
  { label: "Teams & counting", value: "500+", icon: Users },
  { label: "Grounds bookable", value: "50+", icon: Globe },
  { label: "Tournaments hosted", value: "120+", icon: Calendar },
];

export default function Home() {
  const [videoOpen, setVideoOpen] = useState(false);
  const featuredSport = SPORTS.find((s) => s.slug === "football") ?? SPORTS[0];
  const otherSports = SPORTS.filter((s) => s.slug !== featuredSport.slug);

  return (
    <main className="flex-1">
      {/* HERO */}
      <section className="grain relative overflow-hidden border-b border-border">
        <div className="pointer-events-none absolute left-1/2 top-0 h-96 w-96 -translate-x-1/2 rounded-full bg-accent/20 blur-[140px]" />
        <div className="pointer-events-none absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-premium/10 blur-[130px]" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgb(var(--c-border)/0.35)_1px,transparent_1px),linear-gradient(90deg,rgb(var(--c-border)/0.35)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_80%_60%_at_50%_0%,black,transparent)]" />

        <div className="container-x relative grid items-center gap-8 py-16 md:min-h-[80vh] md:grid-cols-2 md:gap-8 md:py-28">
          <div>
            <Reveal>
              <span className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-surface/80 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-accent shadow-[0_0_24px_-6px_rgb(var(--c-accent)/0.6)]">
                <Zap className="h-3.5 w-3.5 fill-accent text-accent" />
                The Ultimate Sports Community
              </span>
            </Reveal>
            <Reveal delay={0.08}>
              <h1 className="mt-6 max-w-xl font-display text-5xl font-bold leading-[1.05] text-ink md:text-6xl lg:text-7xl">
                Play harder. <span className="text-gradient-accent">Compete smarter.</span>
              </h1>
            </Reveal>
            <Reveal delay={0.16}>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-muted">
                The Arena brings teams, tournaments, grounds and rankings together across 10 sports — cricket to
                kabaddi — in one premium platform built for players who take the game seriously.
              </p>
            </Reveal>

            <Reveal delay={0.24}>
              <div className="mt-10 flex flex-wrap items-center gap-4">
                <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}>
                  <Link
                    to="/teams"
                    className="shine inline-flex items-center gap-2 rounded-full bg-accent px-7 py-3.5 text-sm font-semibold text-white hover:bg-accent/90"
                  >
                    Explore Teams <ArrowRight className="h-4 w-4" />
                  </Link>
                </motion.div>
                <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}>
                  <Link
                    to="/tournaments"
                    className="glass inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-sm font-semibold text-ink hover:border-accent/40"
                  >
                    Join a Tournament
                  </Link>
                </motion.div>
                <button
                  onClick={() => setVideoOpen(true)}
                  className="group inline-flex items-center gap-3 text-sm font-semibold text-ink-muted hover:text-ink"
                >
                  <span className="glass flex h-12 w-12 items-center justify-center rounded-full transition-transform group-hover:scale-105">
                    <Play className="h-4 w-4 translate-x-0.5 fill-accent text-accent" />
                  </span>
                  Watch the arena
                </button>
              </div>
            </Reveal>
          </div>

          <Reveal delay={0.2} className="relative mx-auto w-full max-w-md md:max-w-none">
            <motion.div
              animate={{ y: [0, -14, 0] }}
              transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
              className="relative"
            >
              <div className="pointer-events-none absolute inset-x-6 top-1/4 -z-10 h-72 rounded-full bg-accent/25 blur-[100px]" />
              <picture>
                <source media="(max-width: 767px)" srcSet="/mobile.png" />
                <img
                  src="/hero.png"
                  alt="The Arena app — find teams, book grounds, and follow tournaments from your phone"
                  className="mx-auto w-full max-w-lg drop-shadow-2xl"
                />
              </picture>
            </motion.div>
          </Reveal>
        </div>
      </section>

      {/* STATS STRIP */}
      <section className="relative -mt-10 pb-4 md:-mt-12">
        <div className="container-x">
          <Reveal delay={0.1}>
            <div className="glass relative overflow-hidden rounded-3xl shadow-2xl">
              <div className="pointer-events-none absolute -left-10 -top-16 h-48 w-48 rounded-full bg-accent/20 blur-[90px]" />
              <div className="relative grid grid-cols-2 divide-y divide-border md:grid-cols-4 md:divide-x md:divide-y-0">
                {STATS.map((s, i) => (
                  <Reveal
                    key={s.label}
                    delay={0.14 + i * 0.06}
                    className="flex items-center gap-4 p-6 md:p-8"
                  >
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                      <s.icon className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="font-display text-2xl font-bold text-ink md:text-3xl">{s.value}</p>
                      <p className="mt-0.5 text-xs font-medium uppercase tracking-widest text-ink-faint">{s.label}</p>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* SPORTS GRID */}
      <section className="relative py-14 md:py-24">
        <div className="container-x">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-surface px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-accent">
              <Zap className="h-3.5 w-3.5 fill-accent text-accent" />
              Sports Zone
            </span>
          </Reveal>
          <Reveal delay={0.06}>
            <h2 className="mt-4 max-w-xl font-display text-3xl font-bold text-ink md:text-4xl">
              Every Sport <span className="text-gradient-accent">We Cover</span>
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-muted md:text-base">
              From weekend futsal to full-scale tournaments, explore every sport The Arena supports and never miss a
              moment. Pick your game and dive in.
            </p>
          </Reveal>
          <div className="mt-10 grid gap-4 lg:grid-cols-4 lg:grid-rows-3">
            <div className="lg:col-start-1 lg:row-start-1 lg:row-span-3">
              <FeaturedSportCard sport={featuredSport} />
            </div>
            {otherSports.map((sport, i) => (
              <SportCard key={sport.slug} sport={sport} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="relative border-t border-border bg-surface/30 py-14 md:py-24">
        <div className="container-x">
          <Reveal>
            <span className="eyebrow">How it works</span>
          </Reveal>
          <Reveal delay={0.06}>
            <h2 className="mt-4 max-w-xl font-display text-3xl font-bold text-ink md:text-4xl">
              From sign-up to silverware
            </h2>
          </Reveal>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {/* STEP 01 — Build your squad */}
            <Reveal delay={0}>
              <div className="spotlight glass group relative h-full min-h-0 md:min-h-[21rem] overflow-hidden rounded-2xl p-7 transition-colors duration-300 hover:border-blue-500/40">
                <div className="spotlight-bg pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-blue-500/20 blur-[80px]" />

                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-sky-600 text-white shadow-lg shadow-blue-500/30">
                  <UserPlus className="h-5 w-5" />
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-widest text-blue-400">Step 01</span>
                  <span className="h-px flex-1 max-w-8 bg-blue-500/30" />
                </div>
                <h3 className="mt-3 font-display text-xl font-bold text-ink">
                  Build your <span className="text-blue-400">squad</span>
                </h3>
                <p className="mt-2 max-w-[16rem] text-sm leading-relaxed text-ink-muted">
                  Create or join a team in seconds. Manage your roster and accept join requests as owner.
                </p>

                <div className="glass relative mt-4 inline-flex w-fit items-center gap-2.5 rounded-xl px-3.5 py-2.5">
                  <div className="flex -space-x-2.5">
                    {[0, 1, 2].map((n) => (
                      <span
                        key={n}
                        className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-surface bg-gradient-to-br from-blue-400 to-sky-600 text-white shadow-sm"
                      >
                        <Users className="h-3 w-3" />
                      </span>
                    ))}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-ink">Team Phoenix</p>
                    <p className="text-[11px] text-ink-faint">12 Members</p>
                  </div>
                </div>

                <Link
                  to="/teams/create"
                  className="shine relative mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-500 to-sky-500 px-5 py-2.5 text-sm font-semibold text-white hover:from-blue-400 hover:to-sky-400"
                >
                  <ArrowRight className="h-4 w-4" /> Create Team
                </Link>
              </div>
            </Reveal>

            {/* STEP 02 — Compete in tournaments */}
            <Reveal delay={0.08}>
              <div className="spotlight glass group relative h-full min-h-0 md:min-h-[21rem] overflow-hidden rounded-2xl p-7 transition-colors duration-300 hover:border-violet-500/40">
                <div className="spotlight-bg pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-violet-500/20 blur-[80px]" />
                <Trophy className="spotlight-bg pointer-events-none absolute -bottom-6 -right-6 h-40 w-40 text-violet-500/10" />

                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/30">
                  <Trophy className="h-5 w-5" />
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-widest text-violet-400">Step 02</span>
                  <span className="h-px flex-1 max-w-8 bg-violet-500/30" />
                </div>
                <h3 className="mt-3 font-display text-xl font-bold text-ink">
                  Compete in <span className="text-violet-400">tournaments</span>
                </h3>
                <p className="mt-2 max-w-[16rem] text-sm leading-relaxed text-ink-muted">
                  Register your team, follow the live bracket, and climb the leaderboard as matches complete.
                </p>

                <Link
                  to="/tournaments"
                  className="shine relative mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-500 to-purple-500 px-5 py-2.5 text-sm font-semibold text-white hover:from-violet-400 hover:to-purple-400"
                >
                  <ArrowRight className="h-4 w-4" /> View Tournaments
                </Link>
              </div>
            </Reveal>

            {/* STEP 03 — Book verified grounds */}
            <Reveal delay={0.16}>
              <div className="spotlight glass group relative h-full min-h-0 md:min-h-[21rem] overflow-hidden rounded-2xl p-7 transition-colors duration-300 hover:border-emerald-500/40">
                <div className="spotlight-bg pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-emerald-500/20 blur-[80px]" />

                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30">
                  <Shield className="h-5 w-5" />
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">Step 03</span>
                  <span className="h-px flex-1 max-w-8 bg-emerald-500/30" />
                </div>
                <h3 className="mt-3 font-display text-xl font-bold text-ink">
                  Book verified <span className="text-emerald-400">grounds</span>
                </h3>
                <p className="mt-2 max-w-[16rem] text-sm leading-relaxed text-ink-muted">
                  Reserve a ground by the hour with instant, secure test-mode checkout — premium members save 10%.
                </p>

                <div className="mt-4 inline-flex w-fit items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 text-xs font-semibold text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Verified Ground
                </div>

                <Link
                  to="/grounds"
                  className="shine relative mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-2.5 text-sm font-semibold text-white hover:from-emerald-400 hover:to-teal-400"
                >
                  <ArrowRight className="h-4 w-4" /> Find Grounds
                </Link>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* PREMIUM TEASER */}
      <section className="relative overflow-hidden py-14 md:py-24">
        <div className="pointer-events-none absolute right-0 top-1/2 h-80 w-80 -translate-y-1/2 rounded-full bg-premium/10 blur-[140px]" />
        <div className="container-x">
          <Reveal>
            <div className="spotlight glass relative overflow-hidden rounded-3xl p-7 md:p-16">
              <div className="spotlight-bg grain absolute inset-0 opacity-60" />
              <div className="relative flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
                <div className="max-w-xl">
                  <span className="eyebrow-premium">Go Premium</span>
                  <h2 className="mt-4 font-display text-3xl font-bold text-ink md:text-4xl">
                    Unlimited teams. Host tournaments. Save on every booking.
                  </h2>
                  <p className="mt-3 text-sm leading-relaxed text-ink-muted">
                    Premium members skip the 1-team cap, unlock tournament hosting, and get 10% off every ground
                    booking — automatically applied at checkout.
                  </p>
                </div>
                <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }} className="shrink-0">
                  <Link
                    to="/membership"
                    className="shine inline-flex items-center gap-2 rounded-full bg-premium px-7 py-3.5 text-sm font-semibold text-black hover:bg-premium/90"
                  >
                    View Membership <ArrowRight className="h-4 w-4" />
                  </Link>
                </motion.div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <VideoModal open={videoOpen} onClose={() => setVideoOpen(false)} src="/arena-hero.mp4" />
    </main>
  );
}

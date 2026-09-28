import { Trophy, Users, MapPin, TrendingUp } from "lucide-react";
import Reveal from "@/components/Reveal";

const PILLARS = [
  { icon: Users, title: "Teams", text: "Build a squad, manage your roster, and welcome new players with a simple join-request flow." },
  { icon: Trophy, title: "Tournaments", text: "Organize brackets, track live scores, and watch standings update automatically." },
  { icon: MapPin, title: "Grounds", text: "Book verified grounds by the hour with transparent, instant pricing." },
  { icon: TrendingUp, title: "Rankings", text: "Every completed match feeds real player and team leaderboards across 10 sports." },
];

export default function About() {
  return (
    <main className="grain relative flex-1 overflow-hidden py-24">
      <div className="pointer-events-none absolute left-1/2 top-0 h-96 w-96 -translate-x-1/2 rounded-full bg-accent/10 blur-[140px]" />
      <div className="container-x relative max-w-3xl">
        <Reveal>
          <span className="eyebrow">About The Arena</span>
        </Reveal>
        <Reveal delay={0.06}>
          <h1 className="mt-4 font-display text-4xl font-bold text-ink md:text-5xl">
            One platform for every player, every sport.
          </h1>
        </Reveal>
        <Reveal delay={0.12}>
          <p className="mt-6 text-lg leading-relaxed text-ink-muted">
            The Arena was built for the players who organize their own matches, chase their own tournaments, and
            still can't find one place to run it all. We bring teams, tournaments, grounds and rankings together
            across cricket, football, tennis, table tennis, volleyball, hockey, badminton, basketball, kabaddi and
            futsal — one account, ten sports.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-6 sm:grid-cols-2">
          {PILLARS.map((p, i) => (
            <Reveal key={p.title} delay={0.16 + i * 0.06}>
              <div className="spotlight glass h-full rounded-2xl p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
                  <p.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-display text-lg font-semibold text-ink">{p.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{p.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </main>
  );
}

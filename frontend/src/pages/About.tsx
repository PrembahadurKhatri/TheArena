import { Link } from "react-router-dom";
import { Trophy, Users, MapPin, TrendingUp } from "lucide-react";
import { SPORTS } from "@/data/sports";
import PageHero from "@/components/page/PageHero";

const PILLARS = [
  { icon: Users, title: "Teams", to: "/teams", text: "Build a squad, manage your roster, and welcome new players with a simple join-request flow." },
  { icon: Trophy, title: "Tournaments", to: "/tournaments", text: "Organize brackets, track live scores, and watch standings update automatically." },
  { icon: MapPin, title: "Grounds", to: "/grounds", text: "Book verified grounds by the hour with transparent, instant pricing." },
  { icon: TrendingUp, title: "Rankings", to: "/rankings", text: "Every completed match feeds real player and team leaderboards across 10 sports." },
];

export default function About() {
  return (
    <main className="flex-1">
      <PageHero
        size="lg"
        title="One platform for every player, every sport."
        image="/sports/volleyball.jpg"
      />

      <section className="container-x grid gap-10 py-16 md:py-24 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
        <h2 className="font-display text-4xl font-bold leading-tight text-ink md:text-5xl">One account, ten sports.</h2>
        <p className="text-xl leading-relaxed text-ink-muted">
          The Arena was built for the players who organize their own matches, chase their own tournaments, and still
          can’t find one place to run it all. We bring teams, tournaments, grounds and rankings together across cricket,
          football, tennis, table tennis, volleyball, hockey, badminton, basketball, kabaddi and futsal.
        </p>
      </section>

      <section aria-label="The sports" className="border-y border-border bg-base-2">
        <ul className="grid grid-cols-2 gap-px bg-border sm:grid-cols-5">
          {SPORTS.map((s) => (
            <li key={s.slug} className="relative aspect-[4/3] overflow-hidden bg-base-2">
              {s.image && <img src={s.image} alt="" loading="lazy" className="h-full w-full object-cover opacity-70" />}
              <span className="photo-veil-bottom absolute inset-0" />
              <span className="absolute bottom-3 left-4 font-display text-xl font-bold text-ink">{s.name}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="container-x py-16 md:py-24">
        <ul className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2">
          {PILLARS.map((p) => (
            <li key={p.title} className="bg-base">
              <Link to={p.to} className="group flex h-full flex-col p-8 transition-colors hover:bg-surface active:bg-base-2 md:p-10">
                <p.icon className="h-7 w-7 text-accent" />
                <h3 className="mt-8 font-display text-3xl font-bold text-ink group-hover:text-accent">{p.title}</h3>
                <p className="mt-3 max-w-sm text-ink-muted">{p.text}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

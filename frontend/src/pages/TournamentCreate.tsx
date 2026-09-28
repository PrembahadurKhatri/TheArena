import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Crown, LogIn, Trophy } from "lucide-react";
import api from "@/api/axios";
import { useAuth } from "@/context/AuthContext";
import { SPORTS } from "@/data/sports";
import { apiError } from "@/types";
import Reveal from "@/components/Reveal";
import { Input, Select, Textarea } from "@/components/ui/Field";
import Button from "@/components/ui/Button";

export default function TournamentCreate() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    sport: SPORTS[0].slug,
    maxTeams: "8",
    startDate: "",
    description: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await api.post("/tournaments", {
        name: form.name,
        sport: form.sport,
        maxTeams: Number(form.maxTeams),
        startDate: form.startDate,
        description: form.description || undefined,
      });
      navigate(`/tournaments/${data.tournament.id}`);
    } catch (err) {
      setError(apiError(err, "Could not create tournament."));
    } finally {
      setLoading(false);
    }
  }

  if (!user) {
    return (
      <main className="flex flex-1 items-center justify-center py-24">
        <Reveal className="glass mx-6 max-w-md rounded-3xl p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-accent-soft text-accent">
            <LogIn className="h-5 w-5" />
          </div>
          <h1 className="mt-5 font-display text-2xl font-bold text-ink">Log in to host a tournament</h1>
          <p className="mt-2 text-sm text-ink-muted">You'll need an account to organize a tournament.</p>
          <Link to="/login" state={{ from: "/tournaments/create" }}>
            <Button className="mt-6">Log in</Button>
          </Link>
        </Reveal>
      </main>
    );
  }

  if (!user.isPremium) {
    return (
      <main className="flex flex-1 items-center justify-center py-24">
        <Reveal className="glass mx-6 max-w-lg overflow-hidden rounded-3xl p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-premium-soft text-premium">
            <Crown className="h-5 w-5" />
          </div>
          <span className="eyebrow-premium mt-5 inline-flex">Premium feature</span>
          <h1 className="mt-4 font-display text-2xl font-bold text-ink">
            Hosting tournaments is a Premium feature
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            Upgrade to Premium to create and organize tournaments, manage brackets, and enter match results — plus
            unlimited teams and 10% off ground bookings.
          </p>
          <Link to="/membership">
            <Button variant="premium" className="mt-6">
              View Membership plans
            </Button>
          </Link>
        </Reveal>
      </main>
    );
  }

  return (
    <main className="flex-1 py-16">
      <div className="container-x max-w-xl">
        <Reveal>
          <span className="eyebrow-premium">
            <Crown className="h-3 w-3" /> Premium
          </span>
        </Reveal>
        <Reveal delay={0.06}>
          <h1 className="mt-4 font-display text-4xl font-bold text-ink">Host a tournament</h1>
        </Reveal>

        <Reveal delay={0.12}>
          <form onSubmit={onSubmit} className="glass mt-8 flex flex-col gap-5 rounded-3xl p-8">
            <Input
              label="Tournament name"
              required
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Arena Premier Cup"
            />
            <div className="grid gap-5 sm:grid-cols-2">
              <Select label="Sport" required value={form.sport} onChange={(e) => set("sport", e.target.value)}>
                {SPORTS.map((s) => (
                  <option key={s.slug} value={s.slug}>
                    {s.emoji} {s.name}
                  </option>
                ))}
              </Select>
              <Select label="Max teams" required value={form.maxTeams} onChange={(e) => set("maxTeams", e.target.value)}>
                {[4, 8, 16, 32].map((n) => (
                  <option key={n} value={n}>
                    {n} teams
                  </option>
                ))}
              </Select>
            </div>
            <Input
              label="Start date"
              type="date"
              required
              value={form.startDate}
              onChange={(e) => set("startDate", e.target.value)}
            />
            <Textarea
              label="Description"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Rules, venue, prize pool, etc. (optional)"
            />
            {error && <p className="text-sm text-red-400">{error}</p>}
            <Button type="submit" loading={loading} size="lg" icon={<Trophy className="h-4 w-4" />}>
              Create tournament
            </Button>
          </form>
        </Reveal>
      </div>
    </main>
  );
}

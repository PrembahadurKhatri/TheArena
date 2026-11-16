import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check, Crown, LogIn, Trophy } from "lucide-react";
import api from "@/api/axios";
import { useAuth } from "@/context/AuthContext";
import { SPORTS, getSportBySlug } from "@/data/sports";
import { PROVINCE_OPTIONS } from "@/data/provinces";
import { apiError } from "@/types";
import { Input, Textarea } from "@/components/ui/Field";
import CustomSelect from "@/components/ui/CustomSelect";
import Button, { buttonClass } from "@/components/ui/Button";
import SportPicker from "@/components/page/SportPicker";
import GatePanel from "@/components/page/GatePanel";
import { Segmented } from "@/components/page/PageHero";
import { FormError } from "@/components/page/AuthShell";

const TEAM_SIZES = ["4", "8", "16", "32"] as const;

export default function TournamentCreate() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    sport: SPORTS[0].slug,
    maxTeams: "8",
    startDate: "",
    description: "",
    province: user?.province ?? "",
    location: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.province) {
      setError("Please select a province.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const { data } = await api.post("/tournaments", {
        name: form.name,
        sport: form.sport,
        maxTeams: Number(form.maxTeams),
        startDate: form.startDate,
        description: form.description || undefined,
        province: form.province,
        location: form.location || undefined,
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
      <GatePanel icon={<LogIn className="h-6 w-6" />} title="Log in to host a tournament">
        <p className="mt-3 text-ink-muted">You’ll need an account to organize a tournament.</p>
        <Link to="/login" state={{ from: "/tournaments/create" }} className={buttonClass({ size: "lg", className: "mt-8" })}>
          Log in
        </Link>
      </GatePanel>
    );
  }

  if (!user.isPremium) {
    return (
      <GatePanel tone="premium" icon={<Crown className="h-6 w-6" />} title="Hosting tournaments is a Premium feature">
        <p className="mt-3 text-ink-muted">
          Upgrade to Premium to create and organize tournaments, manage brackets, and enter match results.
        </p>
        <ul className="mx-auto mt-6 flex w-fit flex-col gap-2 text-left text-sm text-ink">
          {["Unlimited teams", "10% off ground bookings"].map((f) => (
            <li key={f} className="flex items-center gap-2">
              <Check className="h-4 w-4 text-premium" /> {f}
            </li>
          ))}
        </ul>
        <Link to="/membership" className={buttonClass({ variant: "premium", size: "lg", className: "mt-8" })}>
          View Membership plans
        </Link>
      </GatePanel>
    );
  }

  const sportDef = getSportBySlug(form.sport);

  return (
    <main className="flex-1">
      <section className="relative isolate overflow-hidden border-b border-border bg-base-2">
        {sportDef?.image && (
          <img
            src={sportDef.image}
            alt=""
            className="absolute inset-y-0 right-0 -z-10 h-full w-full object-cover opacity-70 md:w-[60%]"
          />
        )}
        <div className="masthead-veil absolute inset-0 -z-10" />
        <div className="container-x flex min-h-[260px] flex-col justify-end pb-10 pt-20">
          <p className="inline-flex w-fit items-center gap-1.5 rounded-full border border-premium/30 bg-premium-soft px-3 py-1 text-sm font-semibold text-premium">
            <Crown className="h-3.5 w-3.5" /> Premium
          </p>
          <h1 className="mt-5 font-display text-5xl font-bold leading-[0.95] text-ink md:text-7xl">Host a tournament</h1>
        </div>
      </section>

      <form onSubmit={onSubmit} className="container-x grid max-w-[64rem] gap-10 py-12 md:py-16">
        <Input
          label="Tournament name"
          required
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="e.g. Arena Premier Cup"
        />

        <SportPicker value={form.sport} onChange={(v) => set("sport", v)} />

        <div className="grid gap-8 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-ink-muted">
              Max teams <span className="text-accent">*</span>
            </span>
            <Segmented
              value={form.maxTeams}
              options={TEAM_SIZES.map((n) => ({ value: n, label: `${n} teams` }))}
              onChange={(v) => set("maxTeams", v)}
            />
          </div>
          <Input
            label="Start date"
            type="date"
            required
            value={form.startDate}
            onChange={(e) => set("startDate", e.target.value)}
          />
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-ink-muted">
              Province <span className="text-accent">*</span>
            </label>
            <CustomSelect
              value={form.province}
              onChange={(v) => set("province", v)}
              options={PROVINCE_OPTIONS}
              placeholder="Select province"
            />
            <span className="text-xs text-ink-faint">Used to show this tournament in players' Near me results.</span>
          </div>
          <Input
            label="Venue"
            value={form.location}
            onChange={(e) => set("location", e.target.value)}
            placeholder="e.g. Dasharath Stadium (optional)"
          />
        </div>

        <Textarea
          label="Description"
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="Rules, venue, prize pool, etc. (optional)"
        />

        {error && <FormError>{error}</FormError>}
        <div className="flex flex-wrap items-center gap-4 border-t border-border pt-8">
          <Button type="submit" loading={loading} size="lg" icon={<Trophy className="h-4 w-4" />}>
            Create tournament
          </Button>
          <Link to="/tournaments" className={buttonClass({ variant: "ghost", size: "lg" })}>
            Cancel
          </Link>
        </div>
      </form>
    </main>
  );
}

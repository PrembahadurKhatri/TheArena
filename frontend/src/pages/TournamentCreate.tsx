import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check, Crown, LogIn, Trophy } from "lucide-react";
import api from "@/api/axios";
import { useAuth } from "@/context/AuthContext";
import { SPORTS, getSportBySlug } from "@/data/sports";
import { PROVINCE_OPTIONS } from "@/data/provinces";
import { apiError } from "@/types";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { compressImage } from "@/api/images";
import { districtOptions } from "@/data/locations";
import CustomSelect from "@/components/ui/CustomSelect";
import Button, { buttonClass } from "@/components/ui/Button";
import SportPicker from "@/components/page/SportPicker";
import GatePanel from "@/components/page/GatePanel";
import { Segmented } from "@/components/page/PageHero";
import { FormError } from "@/components/page/AuthShell";

const TEAM_SIZES = ["4", "6", "8", "12", "16", "32"] as const;

const FORMATS = [
  { value: "knockout", label: "Knockout", hint: "Lose once and you're out. Byes go to the top seeds." },
  { value: "round_robin", label: "Round robin", hint: "Everyone plays everyone once; best record wins." },
  { value: "league", label: "League", hint: "Everyone plays everyone home and away." },
  { value: "group_stage", label: "Group stage", hint: "Round robin inside groups." },
  { value: "group_knockout", label: "Groups + knockout", hint: "Groups first, then the top teams play a knockout." },
];

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
    district: user?.district ?? "",
    location: "",
    format: "knockout",
    minTeams: "4",
    groups: "2",
    advancePerGroup: "2",
    registrationClosesAt: "",
    endDate: "",
    entryFee: "0",
    prizes: "",
    rules: "",
  });
  const [poster, setPoster] = useState<File | null>(null);
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
      const body = new FormData();
      for (const [k, v] of Object.entries(form)) {
        if (v === "") continue;
        if ((k === "groups" || k === "advancePerGroup") && !form.format.startsWith("group")) continue;
        body.append(k, v);
      }
      if (poster) body.append("poster", await compressImage(poster));
      const { data } = await api.post("/tournaments", body);
      navigate(`/tournaments/${data.tournament.slug || data.tournament.id}`);
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

        <div className="flex flex-col gap-3">
          <span className="text-sm font-medium text-ink-muted">
            Format <span className="text-accent">*</span>
          </span>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FORMATS.map((f) => (
              <label
                key={f.value}
                className={`cursor-pointer rounded-2xl border p-4 transition-colors ${form.format === f.value ? "border-accent bg-accent-soft" : "border-border bg-base-2 hover:border-ink-faint/50"}`}
              >
                <input type="radio" name="format" className="sr-only" checked={form.format === f.value} onChange={() => set("format", f.value)} />
                <span className="block font-semibold text-ink">{f.label}</span>
                <span className="mt-1 block text-sm text-ink-muted">{f.hint}</span>
              </label>
            ))}
          </div>
          {form.format.startsWith("group") && (
            <div className="grid gap-5 sm:grid-cols-2">
              <Input label="Number of groups" type="number" min={1} max={16} value={form.groups} onChange={(e) => set("groups", e.target.value)} />
              {form.format === "group_knockout" && (
                <Input label="Teams through from each group" type="number" min={1} max={8} value={form.advancePerGroup} onChange={(e) => set("advancePerGroup", e.target.value)} />
              )}
            </div>
          )}
        </div>

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
            label="Minimum teams"
            type="number"
            min={4}
            max={Number(form.maxTeams)}
            required
            value={form.minTeams}
            onChange={(e) => set("minTeams", e.target.value)}
            hint="At least 4. With 4 eligible teams you can submit the tournament to The Arena for approval."
          />
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          <Input label="Registration closes" type="date" value={form.registrationClosesAt} onChange={(e) => set("registrationClosesAt", e.target.value)} hint="Optional" />
          <Input label="Start date" type="date" required value={form.startDate} onChange={(e) => set("startDate", e.target.value)} />
          <Input label="End date" type="date" value={form.endDate} onChange={(e) => set("endDate", e.target.value)} hint="Optional" />
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
          <Select label="District" value={form.district} onChange={(e) => set("district", e.target.value)}>
            <option value="">Not set</option>
            {districtOptions(form.province || undefined).map((d) => (
              <option key={d.value}>{d.value}</option>
            ))}
          </Select>
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
          placeholder="What it's about and who should enter (optional)"
        />

        <div className="grid gap-8 md:grid-cols-2">
          <Input label="Entry fee (NPR)" type="number" min={0} value={form.entryFee} onChange={(e) => set("entryFee", e.target.value)} hint="Shown to teams. Online payment of fees isn't available yet; collect it yourself." />
          <Input label="Prizes" value={form.prizes} maxLength={1000} onChange={(e) => set("prizes", e.target.value)} placeholder="e.g. Rs 50,000 and a trophy" />
        </div>

        <Textarea label="Rules" value={form.rules} maxLength={5000} onChange={(e) => set("rules", e.target.value)} placeholder="Match length, squad size, tie-breaks, conduct… (optional)" />

        <label className="flex flex-col gap-2 text-sm font-medium text-ink-muted">
          Poster (optional)
          <input type="file" accept="image/*" onChange={(e) => setPoster(e.target.files?.[0] ?? null)} />
        </label>

        <p className="rounded-2xl border border-border bg-base-2 p-4 text-sm text-ink-muted">
          How it works: teams ask to join and you approve them. Once at least {form.minTeams || 4} eligible teams (run by at least two
          different people) are in, submit the tournament for review. The Arena approves it, then you generate the fixtures.
        </p>

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

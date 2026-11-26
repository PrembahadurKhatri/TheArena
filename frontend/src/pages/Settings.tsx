import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Check, KeyRound, LocateFixed, Lock, Plus, Trash2, UserRound, Volleyball } from "lucide-react";
import api, { assetUrl } from "@/api/axios";
import { useAuth, type Privacy, type SportProfile } from "@/context/AuthContext";
import { apiError } from "@/types";
import { Input, Textarea, Select } from "@/components/ui/Field";
import Button from "@/components/ui/Button";
import { Initials } from "@/components/ui/SportMark";
import { PROVINCES } from "@/data/provinces";
import { districtOptions, EXPERIENCE_OPTIONS } from "@/data/locations";
import { useApi } from "@/hooks/useApi";

type Tab = "profile" | "sports" | "privacy" | "security";

const TABS: { key: Tab; label: string; icon: typeof UserRound }[] = [
  { key: "profile", label: "Profile", icon: UserRound },
  { key: "sports", label: "Sports & positions", icon: Volleyball },
  { key: "privacy", label: "Privacy", icon: Lock },
  { key: "security", label: "Account & security", icon: KeyRound },
];

function Notice({ kind, children }: { kind: "ok" | "error"; children: string }) {
  return (
    <p
      role={kind === "error" ? "alert" : "status"}
      className={`rounded-xl border px-4 py-3 text-sm ${
        kind === "ok" ? "border-success/25 bg-success/10 text-success" : "border-danger/25 bg-danger/10 text-danger"
      }`}
    >
      {children}
    </p>
  );
}

function useSaver() {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  async function run(fn: () => Promise<unknown>, ok: string) {
    setSaving(true);
    setMessage(null);
    try {
      await fn();
      setMessage({ kind: "ok", text: ok });
    } catch (err) {
      setMessage({ kind: "error", text: apiError(err) });
    } finally {
      setSaving(false);
    }
  }
  return { saving, message, run };
}

function ProfileTab() {
  const { user, refreshUser } = useAuth();
  const { saving, message, run } = useSaver();
  const [form, setForm] = useState({
    name: user?.name ?? "",
    phone: user?.phone ?? "",
    bio: user?.bio ?? "",
    dateOfBirth: user?.dateOfBirth ?? "",
    gender: user?.gender ?? "",
    province: user?.province ?? "",
    district: user?.district ?? "",
    municipality: user?.municipality ?? "",
    location: user?.location ?? "",
  });
  const [photo, setPhoto] = useState<File | null>(null);
  const [locating, setLocating] = useState(false);
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function save(e: FormEvent) {
    e.preventDefault();
    await run(async () => {
      const body = new FormData();
      for (const [k, v] of Object.entries(form)) body.append(k, v);
      if (photo) body.append("photo", photo);
      await api.patch("/auth/me", body);
      await refreshUser();
      setPhoto(null);
    }, "Profile saved.");
  }

  function useMyLocation() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        run(async () => {
          await api.patch("/auth/me", { lat: pos.coords.latitude, lng: pos.coords.longitude });
          await refreshUser();
        }, "Location saved. Nearby players and teams can now find you.").finally(() => setLocating(false)),
      () => setLocating(false),
      { enableHighAccuracy: false, timeout: 10000 }
    );
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-6">
      <div className="flex items-center gap-5">
        {photo ? (
          <img src={URL.createObjectURL(photo)} alt="" className="h-20 w-20 rounded-full object-cover" />
        ) : user?.photo ? (
          <img src={assetUrl(user.photo)} alt="" className="h-20 w-20 rounded-full object-cover" />
        ) : (
          <Initials name={user?.name ?? "?"} className="h-20 w-20 rounded-full text-2xl" />
        )}
        <label className="cursor-pointer rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold text-ink hover:bg-surface-2">
          Change photo
          <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
        </label>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Input id="name" label="Full name" required value={form.name} onChange={(e) => set("name")(e.target.value)} maxLength={80} />
        <Input id="phone" label="Phone" value={form.phone} onChange={(e) => set("phone")(e.target.value)} maxLength={20} hint="Hidden from others unless you allow it under Privacy." />
        <Input id="dob" label="Date of birth" type="date" value={form.dateOfBirth ?? ""} onChange={(e) => set("dateOfBirth")(e.target.value)} />
        <Select id="gender" label="Gender (optional)" value={form.gender ?? ""} onChange={(e) => set("gender")(e.target.value)}>
          <option value="">Not set</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="other">Other</option>
          <option value="prefer_not_to_say">Prefer not to say</option>
        </Select>
      </div>

      <Textarea id="bio" label="Bio" value={form.bio} onChange={(e) => set("bio")(e.target.value)} maxLength={500} hint={`${form.bio.length}/500`} />

      <fieldset className="flex flex-col gap-5">
        <legend className="mb-3 font-display text-xl font-semibold text-ink">Location</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <Select
            id="province"
            label="Province"
            value={form.province}
            onChange={(e) => setForm((f) => ({ ...f, province: e.target.value, district: "" }))}
          >
            <option value="">Not set</option>
            {PROVINCES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
          <Select id="district" label="District" value={form.district} onChange={(e) => set("district")(e.target.value)}>
            <option value="">Not set</option>
            {districtOptions(form.province || undefined).map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </Select>
          <Input id="municipality" label="Municipality" value={form.municipality} onChange={(e) => set("municipality")(e.target.value)} maxLength={80} placeholder="e.g. Pokhara Metropolitan City" />
          <Input id="location" label="Area / landmark" value={form.location} onChange={(e) => set("location")(e.target.value)} maxLength={120} placeholder="e.g. Lakeside" />
        </div>
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-base-2 p-4">
          <LocateFixed className="h-5 w-5 text-accent" />
          <p className="min-w-0 flex-1 text-sm text-ink-muted">
            {user?.hasGeo ? "Your map position is saved for near-me search." : "Save your position so nearby players and teams can find you."}
          </p>
          <Button type="button" variant="secondary" size="sm" loading={locating} onClick={useMyLocation}>
            Use my current location
          </Button>
        </div>
      </fieldset>

      {message && <Notice kind={message.kind}>{message.text}</Notice>}
      <div>
        <Button type="submit" loading={saving}>
          Save profile
        </Button>
      </div>
    </form>
  );
}

interface SportRow {
  slug: string;
  name: string;
  positions: string[];
}

function SportsTab() {
  const { user, refreshUser } = useAuth();
  const { saving, message, run } = useSaver();
  const { data } = useApi<{ sports: SportRow[] }>("/sports");
  const sports = data?.sports ?? [];
  const [rows, setRows] = useState<SportProfile[]>(user?.sportProfiles ?? []);

  const used = new Set(rows.map((r) => r.sport));
  const nextSport = sports.find((s) => !used.has(s.slug));

  function update(i: number, patch: Partial<SportProfile>) {
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }

  async function save() {
    await run(async () => {
      await api.patch("/auth/me", {
        sportProfiles: rows.map((r) => ({ sport: r.sport, position: r.position || undefined, experienceLevel: r.experienceLevel || undefined })),
        sportPreferences: rows.map((r) => r.sport),
      });
      await refreshUser();
    }, "Sports saved.");
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-ink-muted">Add the sports you play. Your position and level help captains and opponents find you.</p>
      {rows.length === 0 && <p className="rounded-2xl border border-dashed border-border bg-base-2 p-6 text-sm text-ink-muted">No sports yet.</p>}
      {rows.map((row, i) => {
        const def = sports.find((s) => s.slug === row.sport);
        return (
          <div key={row.sport} className="panel grid gap-4 p-4 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
            <Select id={`sport-${i}`} label="Sport" value={row.sport} onChange={(e) => update(i, { sport: e.target.value, position: null })}>
              {sports
                .filter((s) => s.slug === row.sport || !used.has(s.slug))
                .map((s) => (
                  <option key={s.slug} value={s.slug}>
                    {s.name}
                  </option>
                ))}
            </Select>
            <Select id={`pos-${i}`} label="Position" value={row.position ?? ""} onChange={(e) => update(i, { position: e.target.value || null })}>
              <option value="">Any</option>
              {(def?.positions ?? []).map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
            <Select
              id={`exp-${i}`}
              label="Experience"
              value={row.experienceLevel ?? ""}
              onChange={(e) => update(i, { experienceLevel: (e.target.value || null) as SportProfile["experienceLevel"] })}
            >
              <option value="">Not set</option>
              {EXPERIENCE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
            <Button type="button" variant="ghost" size="sm" aria-label="Remove sport" onClick={() => setRows((r) => r.filter((_, idx) => idx !== i))}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        );
      })}
      {nextSport && rows.length < 10 && (
        <div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => setRows((r) => [...r, { sport: nextSport.slug, position: null, experienceLevel: null }])}
          >
            Add a sport
          </Button>
        </div>
      )}
      {message && <Notice kind={message.kind}>{message.text}</Notice>}
      <div>
        <Button onClick={save} loading={saving}>
          Save sports
        </Button>
      </div>
    </div>
  );
}

const PRIVACY_ROWS: { key: keyof Privacy; label: string; hint: string }[] = [
  { key: "discoverable", label: "Show me in the player directory", hint: "Off: you won't appear in player search or near-me results." },
  { key: "showLocation", label: "Show my province, district and municipality", hint: "Needed for location and near-me search to include you." },
  { key: "showPhone", label: "Show my phone number on my profile", hint: "Useful for arranging matches." },
  { key: "showEmail", label: "Show my email on my profile", hint: "" },
  { key: "showAge", label: "Show my age on my profile", hint: "Your date of birth itself is never shown." },
  { key: "emailNotifications", label: "Email me important notifications", hint: "Invitations, challenges, results and order updates. Always also shown in the app." },
];

function PrivacyTab() {
  const { user, refreshUser } = useAuth();
  const { saving, message, run } = useSaver();
  const [privacy, setPrivacy] = useState<Privacy>(
    user?.privacy ?? { showEmail: false, showPhone: false, showLocation: true, showAge: false, discoverable: true, emailNotifications: true }
  );

  return (
    <div className="flex flex-col gap-5">
      <ul className="panel divide-y divide-border">
        {PRIVACY_ROWS.map((row) => (
          <li key={row.key} className="flex items-start gap-4 p-4">
            <span className="min-w-0 flex-1">
              <span className="block font-medium text-ink">{row.label}</span>
              {row.hint && <span className="mt-0.5 block text-sm text-ink-faint">{row.hint}</span>}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={privacy[row.key]}
              aria-label={row.label}
              onClick={() => setPrivacy((p) => ({ ...p, [row.key]: !p[row.key] }))}
              className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${privacy[row.key] ? "bg-accent" : "bg-surface-2"}`}
            >
              <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-[left] ${privacy[row.key] ? "left-6" : "left-1"}`} />
            </button>
          </li>
        ))}
      </ul>
      {message && <Notice kind={message.kind}>{message.text}</Notice>}
      <div>
        <Button
          loading={saving}
          onClick={() =>
            run(async () => {
              await api.patch("/auth/me", { privacy });
              await refreshUser();
            }, "Privacy settings saved.")
          }
        >
          Save privacy settings
        </Button>
      </div>
    </div>
  );
}

function SecurityTab() {
  const { user, refreshUser, setToken, logoutAll } = useAuth();
  const username = useSaver();
  const password = useSaver();
  const [name, setName] = useState(user?.username ?? "");
  const [availability, setAvailability] = useState<{ available: boolean; reason?: string } | null>(null);
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "", confirm: "" });

  useEffect(() => {
    if (!name || name === user?.username) {
      setAvailability(null);
      return;
    }
    const t = setTimeout(() => {
      api
        .get("/auth/username-available", { params: { u: name } })
        .then(({ data }) => setAvailability(data))
        .catch(() => setAvailability(null));
    }, 350);
    return () => clearTimeout(t);
  }, [name, user?.username]);

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-4">
        <h3 className="font-display text-xl font-semibold text-ink">Username</h3>
        <form
          className="flex flex-col gap-4 sm:flex-row sm:items-start"
          onSubmit={(e) => {
            e.preventDefault();
            username.run(async () => {
              await api.patch("/auth/me/username", { username: name });
              await refreshUser();
            }, "Username changed.");
          }}
        >
          <div className="flex-1">
            <Input
              id="username"
              value={name}
              onChange={(e) => setName(e.target.value.trim())}
              maxLength={20}
              hint="3 to 20 letters, numbers, _ or ."
              error={availability && !availability.available ? availability.reason ?? "That username is taken" : undefined}
            />
            {availability?.available && (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-success">
                <Check className="h-3.5 w-3.5" /> Available
              </p>
            )}
          </div>
          <Button type="submit" loading={username.saving} disabled={!name || name === user?.username || availability?.available === false}>
            Change username
          </Button>
        </form>
        {user?.username && (
          <p className="text-sm text-ink-faint">
            Your public profile:{" "}
            <Link to={`/players/${user.username}`} className="text-accent hover:underline">
              /players/{user.username}
            </Link>
          </p>
        )}
        {username.message && <Notice kind={username.message.kind}>{username.message.text}</Notice>}
      </section>

      <section className="flex flex-col gap-4">
        <h3 className="font-display text-xl font-semibold text-ink">Change password</h3>
        <form
          className="grid gap-4 sm:max-w-md"
          onSubmit={(e) => {
            e.preventDefault();
            if (pw.newPassword !== pw.confirm) return;
            password.run(async () => {
              const { data } = await api.patch("/auth/me/password", { currentPassword: pw.currentPassword, newPassword: pw.newPassword });
              await setToken(data.token);
              setPw({ currentPassword: "", newPassword: "", confirm: "" });
            }, "Password changed. Your other devices have been signed out.");
          }}
        >
          <Input id="cur" type="password" label="Current password" autoComplete="current-password" required value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} />
          <Input id="new" type="password" label="New password" autoComplete="new-password" required minLength={8} value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} hint="At least 8 characters." />
          <Input
            id="confirm"
            type="password"
            label="Confirm new password"
            autoComplete="new-password"
            required
            value={pw.confirm}
            onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
            error={pw.confirm && pw.confirm !== pw.newPassword ? "Passwords don't match" : undefined}
          />
          <div>
            <Button type="submit" loading={password.saving}>
              Change password
            </Button>
          </div>
        </form>
        {password.message && <Notice kind={password.message.kind}>{password.message.text}</Notice>}
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="font-display text-xl font-semibold text-ink">Sessions</h3>
        <p className="text-sm text-ink-muted">Signed in on a shared or lost device? Sign out everywhere, including here.</p>
        <div>
          <Button variant="danger" onClick={() => logoutAll()}>
            Log out of all devices
          </Button>
        </div>
      </section>
    </div>
  );
}

export default function Settings() {
  const [params, setParams] = useSearchParams();
  const tab = (TABS.find((t) => t.key === params.get("tab"))?.key ?? "profile") as Tab;

  return (
    <main className="flex-1">
      <section className="border-b border-border bg-base-2">
        <div className="container-x py-10 md:py-14">
          <h1 className="font-display text-4xl font-bold text-ink md:text-5xl">Settings</h1>
          <p className="mt-2 text-ink-muted">Your profile, sports, privacy and account security.</p>
        </div>
      </section>
      <div className="container-x grid gap-8 py-10 md:grid-cols-[14rem_minmax(0,1fr)] md:py-14">
        <nav aria-label="Settings sections" className="flex gap-1 overflow-x-auto md:flex-col">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setParams({ tab: t.key })}
              aria-current={tab === t.key ? "page" : undefined}
              className={`flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                tab === t.key ? "bg-accent-soft text-accent" : "text-ink-muted hover:bg-surface hover:text-ink"
              }`}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </nav>
        <section className="min-w-0 max-w-3xl">
          {tab === "profile" && <ProfileTab />}
          {tab === "sports" && <SportsTab />}
          {tab === "privacy" && <PrivacyTab />}
          {tab === "security" && <SecurityTab />}
        </section>
      </div>
    </main>
  );
}

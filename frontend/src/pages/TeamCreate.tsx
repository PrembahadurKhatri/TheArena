import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ImagePlus, LogIn, Users } from "lucide-react";
import api from "@/api/axios";
import { useAuth } from "@/context/AuthContext";
import { SPORTS, getSportBySlug } from "@/data/sports";
import { apiError } from "@/types";
import { Input } from "@/components/ui/Field";
import Button, { buttonClass } from "@/components/ui/Button";
import SportPicker from "@/components/page/SportPicker";
import SportMark from "@/components/ui/SportMark";
import { FormError } from "@/components/page/AuthShell";
import GatePanel from "@/components/page/GatePanel";

export default function TeamCreate() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [sport, setSport] = useState(SPORTS[0].slug);
  const [logo, setLogo] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function onLogoChange(file: File | null) {
    setLogo(file);
    setPreview(file ? URL.createObjectURL(file) : null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const form = new FormData();
      form.append("name", name);
      form.append("sport", sport);
      if (logo) form.append("logo", logo);
      const { data } = await api.post("/teams", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      navigate(`/teams/${data.team.id}`);
    } catch (err) {
      setError(apiError(err, "Could not create team."));
    } finally {
      setLoading(false);
    }
  }

  if (!user) {
    return (
      <GatePanel icon={<LogIn className="h-6 w-6" />} title="Log in to create a team">
        <p className="mt-3 text-ink-muted">You’ll need an account to create and manage a team on The Arena.</p>
        <Link to="/login" state={{ from: "/teams/create" }} className={buttonClass({ size: "lg", className: "mt-8" })}>
          Log in
        </Link>
      </GatePanel>
    );
  }

  const sportDef = getSportBySlug(sport);

  return (
    <main className="flex-1">
      <div className="container-x grid gap-12 py-14 md:py-20 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-16">
        <div>
          <h1 className="font-display text-5xl font-bold leading-[0.95] text-ink md:text-6xl">Create your team</h1>
          <p className="mt-4 text-ink-muted">
            Free accounts can own 1 team. Upgrade to{" "}
            <Link to="/membership" className="font-semibold text-premium hover:underline">
              Premium
            </Link>{" "}
            for unlimited teams.
          </p>

          <form onSubmit={onSubmit} className="mt-10 flex flex-col gap-8">
            <Input
              label="Team name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Kathmandu Kings"
            />

            <SportPicker value={sport} onChange={setSport} />

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-ink-muted">Team logo</span>
              <label
                htmlFor="logo"
                className="flex cursor-pointer items-center gap-4 rounded-xl border border-dashed border-border bg-base-2 p-4 transition-colors hover:border-accent/50 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent"
              >
                <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface text-ink-faint">
                  {preview ? (
                    <img src={preview} alt="Logo preview" className="h-full w-full object-cover" />
                  ) : (
                    <ImagePlus className="h-6 w-6" />
                  )}
                </span>
                <span>
                  <span className="block text-sm font-semibold text-ink">{logo ? logo.name : "Upload a logo"}</span>
                  <span className="block text-sm text-ink-faint">Optional. PNG or JPG.</span>
                </span>
                <input
                  id="logo"
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => onLogoChange(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>

            {error && <FormError>{error}</FormError>}
            <Button type="submit" loading={loading} size="lg" className="self-start">
              Create team
            </Button>
          </form>
        </div>

        <aside aria-label="Preview" className="lg:sticky lg:top-24 lg:self-start">
          <p className="mb-3 text-sm text-ink-faint">Preview</p>
          <div className="panel overflow-hidden">
            <div className="relative h-40 overflow-hidden bg-surface-2">
              {sportDef?.image && <img src={sportDef.image} alt="" className="h-full w-full object-cover opacity-60" />}
              <div className="photo-veil-bottom absolute inset-0" />
              <span className="absolute right-4 top-4 rounded-full bg-base/80 px-2.5 py-1 text-xs font-medium text-ink-muted">
                {sportDef?.name}
              </span>
            </div>
            <div className="-mt-10 px-6 pb-6">
              {preview ? (
                <img src={preview} alt="" className="relative h-20 w-20 rounded-2xl border-4 border-surface object-cover" />
              ) : (
                <SportMark slug={sport} className="relative !h-20 !w-20 border-4 border-surface" />
              )}
              <p className="mt-4 truncate font-display text-3xl font-bold text-ink">{name || "Your team name"}</p>
              <p className="mt-2 flex items-center gap-1.5 text-sm text-ink-muted">
                <Users className="h-4 w-4 text-ink-faint" /> 1 member, by {user.name}
              </p>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}

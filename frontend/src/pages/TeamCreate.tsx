import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LogIn, Shield, Upload } from "lucide-react";
import api from "@/api/axios";
import { useAuth } from "@/context/AuthContext";
import { SPORTS } from "@/data/sports";
import { apiError } from "@/types";
import Reveal from "@/components/Reveal";
import { Input, Select } from "@/components/ui/Field";
import Button from "@/components/ui/Button";

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
      <main className="flex flex-1 items-center justify-center py-24">
        <Reveal className="glass mx-6 max-w-md rounded-3xl p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-accent-soft text-accent">
            <LogIn className="h-5 w-5" />
          </div>
          <h1 className="mt-5 font-display text-2xl font-bold text-ink">Log in to create a team</h1>
          <p className="mt-2 text-sm text-ink-muted">
            You'll need an account to create and manage a team on The Arena.
          </p>
          <Link to="/login" state={{ from: "/teams/create" }}>
            <Button className="mt-6">Log in</Button>
          </Link>
        </Reveal>
      </main>
    );
  }

  return (
    <main className="flex-1 py-16">
      <div className="container-x max-w-xl">
        <Reveal>
          <span className="eyebrow">New team</span>
        </Reveal>
        <Reveal delay={0.06}>
          <h1 className="mt-4 font-display text-4xl font-bold text-ink">Create your team</h1>
          <p className="mt-2 text-sm text-ink-muted">
            Free accounts can own 1 team. Upgrade to{" "}
            <Link to="/membership" className="text-premium hover:underline">
              Premium
            </Link>{" "}
            for unlimited teams.
          </p>
        </Reveal>

        <Reveal delay={0.12}>
          <form onSubmit={onSubmit} className="glass mt-8 flex flex-col gap-5 rounded-3xl p-8">
            <div className="flex items-center gap-4">
              <label
                htmlFor="logo"
                className="flex h-20 w-20 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border border-dashed border-border bg-surface-2 text-ink-faint hover:border-accent/50"
              >
                {preview ? (
                  <img src={preview} alt="Logo preview" className="h-full w-full object-cover" />
                ) : (
                  <Upload className="h-6 w-6" />
                )}
              </label>
              <div>
                <p className="text-sm font-medium text-ink">Team logo</p>
                <p className="text-xs text-ink-faint">Optional. PNG or JPG.</p>
                <input
                  id="logo"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onLogoChange(e.target.files?.[0] ?? null)}
                />
              </div>
            </div>

            <Input
              label="Team name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Kathmandu Kings"
            />

            <Select label="Sport" required value={sport} onChange={(e) => setSport(e.target.value)}>
              {SPORTS.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.emoji} {s.name}
                </option>
              ))}
            </Select>

            {error && <p className="text-sm text-red-400">{error}</p>}
            <Button type="submit" loading={loading} size="lg">
              Create team
            </Button>
          </form>
        </Reveal>
      </div>
    </main>
  );
}

import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { UserPlus } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Input } from "@/components/ui/Field";
import CustomSelect from "@/components/ui/CustomSelect";
import Button from "@/components/ui/Button";
import Reveal from "@/components/Reveal";
import { apiError } from "@/types";
import { PROVINCE_OPTIONS } from "@/data/provinces";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "", location: "", province: "" });
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
      await register({
        name: form.name,
        email: form.email,
        password: form.password,
        phone: form.phone || undefined,
        location: form.location || undefined,
        province: form.province || undefined,
      });
      navigate("/dashboard");
    } catch (err) {
      setError(apiError(err, "Could not create your account."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grain relative flex flex-1 items-center justify-center overflow-hidden py-20">
      <div className="pointer-events-none absolute left-1/2 top-0 h-96 w-96 -translate-x-1/2 rounded-full bg-accent/10 blur-[140px]" />
      <Reveal className="relative w-full max-w-md px-6">
        <div className="glass rounded-3xl p-8">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft text-accent">
            <UserPlus className="h-5 w-5" />
          </div>
          <h1 className="mt-5 font-display text-3xl font-bold text-ink">Create your account</h1>
          <p className="mt-1.5 text-sm text-ink-muted">Join The Arena and start building your squad today.</p>

          <form onSubmit={onSubmit} className="mt-7 flex flex-col gap-4">
            <Input
              label="Full name"
              required
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Jordan Rai"
            />
            <Input
              label="Email"
              type="email"
              required
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="you@example.com"
            />
            <Input
              label="Phone"
              type="tel"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="Optional"
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Location"
                value={form.location}
                onChange={(e) => set("location", e.target.value)}
                placeholder="e.g. Pokhara"
              />
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-ink-muted">Province</label>
                <CustomSelect
                  value={form.province}
                  onChange={(v) => set("province", v)}
                  options={PROVINCE_OPTIONS}
                  placeholder="Select province"
                />
              </div>
            </div>
            <Input
              label="Password"
              type="password"
              required
              minLength={6}
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
              placeholder="At least 6 characters"
            />
            {error && <p className="text-sm text-red-400">{error}</p>}
            <Button type="submit" loading={loading} fullWidth size="lg">
              Create account
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-ink-muted">
            Already have an account?{" "}
            <Link to="/login" className="font-semibold text-accent hover:underline">
              Log in
            </Link>
          </p>
        </div>
      </Reveal>
    </main>
  );
}

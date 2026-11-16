import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Input } from "@/components/ui/Field";
import CustomSelect from "@/components/ui/CustomSelect";
import Button from "@/components/ui/Button";
import AuthShell, { FormError } from "@/components/page/AuthShell";
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
    <AuthShell
      title="Create your account"
      lead="Join The Arena and start building your squad today."
      image="/sports/cricket.jpg"
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-accent hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        <Input
          id="reg-name"
          label="Full name"
          autoComplete="name"
          required
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="Jordan Rai"
        />
        <Input
          id="reg-email"
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={form.email}
          onChange={(e) => set("email", e.target.value)}
          placeholder="you@example.com"
        />
        <Input
          id="reg-phone"
          label="Phone"
          type="tel"
          autoComplete="tel"
          value={form.phone}
          onChange={(e) => set("phone", e.target.value)}
          placeholder="Optional"
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <Input
            id="reg-location"
            label="Location"
            value={form.location}
            onChange={(e) => set("location", e.target.value)}
            placeholder="e.g. Pokhara"
          />
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-ink-muted">Province</span>
            <CustomSelect
              value={form.province}
              onChange={(v) => set("province", v)}
              options={PROVINCE_OPTIONS}
              placeholder="Select province"
            />
          </div>
        </div>
        <Input
          id="reg-password"
          label="Password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={form.password}
          onChange={(e) => set("password", e.target.value)}
          placeholder="At least 8 characters"
        />
        {error && <FormError>{error}</FormError>}
        <Button type="submit" loading={loading} fullWidth size="lg">
          Create account
        </Button>
      </form>
    </AuthShell>
  );
}

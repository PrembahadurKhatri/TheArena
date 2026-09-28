import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import api from "@/api/axios";
import { Input } from "@/components/ui/Field";
import Button from "@/components/ui/Button";
import Reveal from "@/components/Reveal";
import { apiError } from "@/types";

export default function ResetPassword() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      await api.post(`/auth/reset-password/${token}`, { password });
      setDone(true);
      setTimeout(() => navigate("/login"), 1800);
    } catch (err) {
      setError(apiError(err, "This reset link is invalid or has expired."));
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
            <ShieldCheck className="h-5 w-5" />
          </div>
          <h1 className="mt-5 font-display text-3xl font-bold text-ink">Set a new password</h1>
          <p className="mt-1.5 text-sm text-ink-muted">Choose a strong new password for your account.</p>

          {done ? (
            <p className="mt-6 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm text-emerald-400">
              Password updated. Redirecting to login...
            </p>
          ) : (
            <form onSubmit={onSubmit} className="mt-7 flex flex-col gap-4">
              <Input
                label="New password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Input
                label="Confirm password"
                type="password"
                required
                minLength={6}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
              {error && <p className="text-sm text-red-400">{error}</p>}
              <Button type="submit" loading={loading} fullWidth size="lg">
                Reset password
              </Button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-ink-muted">
            <Link to="/login" className="font-semibold text-accent hover:underline">
              Back to login
            </Link>
          </p>
        </div>
      </Reveal>
    </main>
  );
}

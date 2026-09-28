import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { KeyRound } from "lucide-react";
import api from "@/api/axios";
import { Input } from "@/components/ui/Field";
import Button from "@/components/ui/Button";
import Reveal from "@/components/Reveal";
import { apiError } from "@/types";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const { data } = await api.post("/auth/forgot-password", { email });
      setMessage(data.message || "If that email exists, a reset link has been sent.");
    } catch (err) {
      setError(apiError(err, "Could not send reset link."));
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
            <KeyRound className="h-5 w-5" />
          </div>
          <h1 className="mt-5 font-display text-3xl font-bold text-ink">Reset your password</h1>
          <p className="mt-1.5 text-sm text-ink-muted">
            Enter your account email and we'll send you a link to reset your password.
          </p>

          {message ? (
            <p className="mt-6 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm text-emerald-400">
              {message}
            </p>
          ) : (
            <form onSubmit={onSubmit} className="mt-7 flex flex-col gap-4">
              <Input
                label="Email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
              {error && <p className="text-sm text-red-400">{error}</p>}
              <Button type="submit" loading={loading} fullWidth size="lg">
                Send reset link
              </Button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-ink-muted">
            Remembered it?{" "}
            <Link to="/login" className="font-semibold text-accent hover:underline">
              Back to login
            </Link>
          </p>
        </div>
      </Reveal>
    </main>
  );
}

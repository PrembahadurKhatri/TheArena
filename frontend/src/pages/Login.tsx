import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LogIn } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Input } from "@/components/ui/Field";
import Button from "@/components/ui/Button";
import Reveal from "@/components/Reveal";
import { apiError } from "@/types";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from ?? "/dashboard");
    } catch (err) {
      setError(apiError(err, "Invalid email or password."));
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
            <LogIn className="h-5 w-5" />
          </div>
          <h1 className="mt-5 font-display text-3xl font-bold text-ink">Welcome back</h1>
          <p className="mt-1.5 text-sm text-ink-muted">Log in to manage your teams, tournaments and bookings.</p>

          <form onSubmit={onSubmit} className="mt-7 flex flex-col gap-4">
            <Input
              label="Email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
            <Input
              label="Password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
            <div className="-mt-1 flex justify-end">
              <Link to="/forgot-password" className="text-xs font-medium text-accent hover:underline">
                Forgot password?
              </Link>
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <Button type="submit" loading={loading} fullWidth size="lg">
              Log in
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-ink-muted">
            Don't have an account?{" "}
            <Link to="/register" className="font-semibold text-accent hover:underline">
              Register
            </Link>
          </p>
        </div>
      </Reveal>
    </main>
  );
}

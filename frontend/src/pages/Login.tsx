import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Input } from "@/components/ui/Field";
import Button from "@/components/ui/Button";
import AuthShell, { FormError } from "@/components/page/AuthShell";
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
    <AuthShell
      title="Welcome back"
      lead="Log in to manage your teams, tournaments and bookings."
      image="/sports/football.jpg"
      footer={
        <>
          Don’t have an account?{" "}
          <Link to="/register" className="font-semibold text-accent hover:underline">
            Register
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        <Input
          id="login-email"
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
        <div className="flex flex-col gap-2">
          <Input
            id="login-password"
            label="Password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
          <Link to="/forgot-password" className="self-end text-sm font-medium text-accent hover:underline">
            Forgot password?
          </Link>
        </div>
        {error && <FormError>{error}</FormError>}
        <Button type="submit" loading={loading} fullWidth size="lg">
          Log in
        </Button>
      </form>
    </AuthShell>
  );
}

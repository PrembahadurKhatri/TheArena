import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api from "@/api/axios";
import { Input } from "@/components/ui/Field";
import Button from "@/components/ui/Button";
import AuthShell, { FormError, FormNotice } from "@/components/page/AuthShell";
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
    <AuthShell
      title="Set a new password"
      lead="Choose a strong new password for your account."
      image="/sports/badminton.jpg"
      footer={
        <Link to="/login" className="font-semibold text-accent hover:underline">
          Back to login
        </Link>
      }
    >
      {done ? (
        <FormNotice>Password updated. Redirecting to login…</FormNotice>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-5">
          <Input
            id="reset-password"
            label="New password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Input
            id="reset-confirm"
            label="Confirm password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          {error && <FormError>{error}</FormError>}
          <Button type="submit" loading={loading} fullWidth size="lg">
            Reset password
          </Button>
        </form>
      )}
    </AuthShell>
  );
}

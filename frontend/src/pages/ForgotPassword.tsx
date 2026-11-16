import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import api from "@/api/axios";
import { Input } from "@/components/ui/Field";
import Button from "@/components/ui/Button";
import AuthShell, { FormError, FormNotice } from "@/components/page/AuthShell";
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
    <AuthShell
      title="Reset your password"
      lead="Enter your account email and we’ll send you a link to reset your password."
      image="/sports/badminton.jpg"
      footer={
        <>
          Remembered it?{" "}
          <Link to="/login" className="font-semibold text-accent hover:underline">
            Back to login
          </Link>
        </>
      }
    >
      {message ? (
        <FormNotice>{message}</FormNotice>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-5">
          <Input
            id="forgot-email"
            label="Email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
          {error && <FormError>{error}</FormError>}
          <Button type="submit" loading={loading} fullWidth size="lg">
            Send reset link
          </Button>
        </form>
      )}
    </AuthShell>
  );
}

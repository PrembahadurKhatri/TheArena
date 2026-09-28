import { useState } from "react";
import type { FormEvent } from "react";
import { CheckCircle2, Mail, MapPin, Phone } from "lucide-react";
import Reveal from "@/components/Reveal";
import { Input, Textarea } from "@/components/ui/Field";
import Button from "@/components/ui/Button";

export default function Contact() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [sent, setSent] = useState(false);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSent(true);
  }

  return (
    <main className="grain relative flex-1 overflow-hidden py-24">
      <div className="pointer-events-none absolute right-0 top-0 h-96 w-96 rounded-full bg-accent/10 blur-[140px]" />
      <div className="container-x relative grid gap-12 md:grid-cols-2">
        <Reveal>
          <span className="eyebrow">Contact</span>
          <h1 className="mt-4 font-display text-4xl font-bold text-ink">Let's talk</h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-ink-muted">
            Questions about teams, tournaments, or your membership? Reach out — we usually reply within a day.
          </p>
          <div className="mt-8 flex flex-col gap-4 text-sm text-ink-muted">
            <span className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-accent" /> hello@thearena.app
            </span>
            <span className="flex items-center gap-3">
              <Phone className="h-4 w-4 text-accent" /> +977 1-4000000
            </span>
            <span className="flex items-center gap-3">
              <MapPin className="h-4 w-4 text-accent" /> Kathmandu, Nepal
            </span>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="glass rounded-3xl p-8">
            {sent ? (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <CheckCircle2 className="h-10 w-10 text-emerald-400" />
                <h2 className="font-display text-xl font-semibold text-ink">Thanks for reaching out</h2>
                <p className="text-sm text-ink-muted">We've received your message and will get back to you soon.</p>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="flex flex-col gap-4">
                <Input
                  label="Name"
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
                <Input
                  label="Email"
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
                <Textarea
                  label="Message"
                  required
                  value={form.message}
                  onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                  placeholder="How can we help?"
                />
                <Button type="submit" size="lg">
                  Send message
                </Button>
              </form>
            )}
          </div>
        </Reveal>
      </div>
    </main>
  );
}

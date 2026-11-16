import { useState } from "react";
import type { FormEvent } from "react";
import { CheckCircle2, Mail, MapPin, Phone } from "lucide-react";
import { Input, Textarea } from "@/components/ui/Field";
import Button from "@/components/ui/Button";

const CHANNELS = [
  { icon: Mail, label: "Email", value: "hello@thearena.app", href: "mailto:hello@thearena.app" },
  { icon: Phone, label: "Phone", value: "+977 1-4000000", href: "tel:+97714000000" },
  { icon: MapPin, label: "Office", value: "Kathmandu, Nepal" },
];

export default function Contact() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [sent, setSent] = useState(false);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSent(true);
  }

  return (
    <main className="flex-1">
      <div className="container-x grid gap-14 py-16 md:py-24 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-20">
        <div>
          <h1 className="font-display text-6xl font-bold leading-[0.92] text-ink md:text-8xl">Let’s talk</h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-ink-muted">
            Questions about teams, tournaments, or your membership? We usually reply within a day.
          </p>

          <dl className="mt-12 flex flex-col divide-y divide-border border-y border-border">
            {CHANNELS.map((c) => (
              <div key={c.label} className="flex items-center gap-5 py-5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                  <c.icon className="h-5 w-5" />
                </span>
                <div>
                  <dt className="text-sm text-ink-faint">{c.label}</dt>
                  <dd className="mt-0.5 text-lg font-semibold text-ink">
                    {c.href ? (
                      <a href={c.href} className="hover:text-accent">
                        {c.value}
                      </a>
                    ) : (
                      c.value
                    )}
                  </dd>
                </div>
              </div>
            ))}
          </dl>
        </div>

        <div className="panel self-start p-7 md:p-10">
          {sent ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <CheckCircle2 className="h-12 w-12 text-success" />
              <h2 className="font-display text-3xl font-bold text-ink">Thanks for reaching out</h2>
              <p className="text-ink-muted">We’ve received your message and will get back to you soon.</p>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="flex flex-col gap-5">
              <h2 className="font-display text-3xl font-bold text-ink">Send a message</h2>
              <Input
                id="contact-name"
                label="Name"
                autoComplete="name"
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
              <Input
                id="contact-email"
                label="Email"
                type="email"
                autoComplete="email"
                required
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
              <Textarea
                id="contact-message"
                label="Message"
                required
                value={form.message}
                onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                placeholder="How can we help?"
              />
              <Button type="submit" size="lg" className="self-start">
                Send message
              </Button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}

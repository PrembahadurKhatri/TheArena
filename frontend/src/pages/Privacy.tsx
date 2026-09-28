import Reveal from "@/components/Reveal";

const SECTIONS = [
  {
    title: "Information we collect",
    text: "When you register, we collect your name, email, phone number and optional profile photo. When you book a ground or subscribe to Premium, we record booking and payment metadata (never raw card details — all test-mode payments are simulated).",
  },
  {
    title: "How we use it",
    text: "Your information powers your profile, team memberships, tournament registrations, bookings and rankings. We never sell your data to third parties.",
  },
  {
    title: "Cookies & storage",
    text: "We store your session token locally in your browser to keep you signed in. Clearing your browser storage will sign you out.",
  },
  {
    title: "Your rights",
    text: "You can update your profile at any time from your dashboard, and may request account deletion by contacting us.",
  },
];

export default function Privacy() {
  return (
    <main className="flex-1 py-24">
      <div className="container-x max-w-2xl">
        <Reveal>
          <span className="eyebrow">Legal</span>
          <h1 className="mt-4 font-display text-4xl font-bold text-ink">Privacy Policy</h1>
          <p className="mt-3 text-sm text-ink-faint">Last updated September 2026</p>
        </Reveal>
        <div className="mt-10 flex flex-col gap-8">
          {SECTIONS.map((s, i) => (
            <Reveal key={s.title} delay={0.06 + i * 0.05}>
              <h2 className="font-display text-xl font-semibold text-ink">{s.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">{s.text}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </main>
  );
}

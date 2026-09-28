import Reveal from "@/components/Reveal";

const SECTIONS = [
  {
    title: "Accounts",
    text: "You're responsible for the accuracy of your profile and for keeping your login credentials secure. Free accounts are limited to owning 1 team; Premium removes this cap.",
  },
  {
    title: "Premium membership & payments",
    text: "The Arena's payment flow currently runs in TEST MODE — no real charges occur. Premium membership grants unlimited teams, tournament hosting, and a 10% discount on ground bookings for the duration of your active membership.",
  },
  {
    title: "Tournaments & bookings",
    text: "Tournament organizers are responsible for entering accurate match results. Ground bookings are confirmed only after a successful payment; cancellations are handled directly with the ground operator.",
  },
  {
    title: "Conduct",
    text: "Be a good teammate. Harassment, impersonation, or fraudulent team/tournament activity may result in account suspension.",
  },
];

export default function Terms() {
  return (
    <main className="flex-1 py-24">
      <div className="container-x max-w-2xl">
        <Reveal>
          <span className="eyebrow">Legal</span>
          <h1 className="mt-4 font-display text-4xl font-bold text-ink">Terms of Service</h1>
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

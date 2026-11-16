import LegalDoc from "@/components/page/LegalDoc";

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
  return <LegalDoc title="Terms of Service" updated="Last updated September 2026" sections={SECTIONS} />;
}

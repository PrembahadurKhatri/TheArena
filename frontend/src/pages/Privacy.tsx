import LegalDoc from "@/components/page/LegalDoc";

const SECTIONS = [
  {
    title: "Information we collect",
    text: "When you register, we collect your name, email, phone number and optional profile photo. When you book a ground or subscribe to Premium, we record booking and payment metadata (never raw card details — all test-mode payments are simulated).",
  },
  {
    title: "How we use it",
    text: "Your information powers your profile, team memberships, tournament registrations and bookings. We never sell your data to third parties.",
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
  return <LegalDoc title="Privacy Policy" updated="Last updated September 2026" sections={SECTIONS} />;
}

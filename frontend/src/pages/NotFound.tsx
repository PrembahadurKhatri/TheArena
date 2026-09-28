import { Link } from "react-router-dom";
import Button from "@/components/ui/Button";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 py-32 text-center">
      <span className="eyebrow">404</span>
      <h1 className="font-display text-4xl font-bold text-ink">Out of bounds</h1>
      <p className="max-w-sm text-sm text-ink-muted">This page doesn't exist, or the play has already moved on.</p>
      <Link to="/">
        <Button>Back to home</Button>
      </Link>
    </main>
  );
}

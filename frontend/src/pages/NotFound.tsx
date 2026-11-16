import { Link } from "react-router-dom";
import { buttonClass } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <main className="relative isolate flex flex-1 items-center overflow-hidden">
      <img
        src="/sports/football.jpg"
        alt=""
        aria-hidden="true"
        className="absolute inset-0 -z-10 h-full w-full object-cover opacity-25"
      />
      <div className="photo-veil-bottom absolute inset-0 -z-10" />
      <div className="container-x py-28">
        <p className="num font-display text-[clamp(6rem,18vw,14rem)] font-bold leading-none text-accent">404</p>
        <h1 className="mt-2 font-display text-5xl font-bold text-ink md:text-6xl">Out of bounds</h1>
        <p className="mt-4 max-w-sm text-lg text-ink-muted">This page doesn’t exist, or the play has already moved on.</p>
        <Link to="/" className={buttonClass({ size: "lg", className: "mt-8" })}>
          Back to home
        </Link>
      </div>
    </main>
  );
}

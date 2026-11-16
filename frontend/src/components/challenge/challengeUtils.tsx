import { Shield, User } from "lucide-react";
import { assetUrl } from "@/api/axios";
import type { ArenaUser } from "@/context/AuthContext";
import type { Challenge, ChallengeSide } from "@/types";
import { Initials } from "@/components/ui/SportMark";

/** The side that answered: the named opponent, or whoever took an open challenge. */
export function otherSide(c: Challenge): ChallengeSide | null {
  return c.acceptedBy ?? c.opponent;
}

export function isChallenger(c: Challenge, user: ArenaUser | null) {
  return !!user && c.challengerUserId === user.id;
}

/** True when a pending challenge is waiting on this user to answer. */
export function isTarget(c: Challenge, user: ArenaUser | null) {
  return !!user && c.status === "pending" && !!c.opponent && c.opponent.ownerId === user.id;
}

export function isParticipant(c: Challenge, user: ArenaUser | null) {
  return isChallenger(c, user) || (!!user && c.acceptedByUserId === user.id) || isTarget(c, user);
}

export function isPast(c: Challenge) {
  return new Date(`${c.date}T${c.startTime}:00+05:45`).getTime() < Date.now();
}

export function dateParts(date: string) {
  const d = new Date(`${date}T00:00:00`);
  return {
    day: d.getDate(),
    month: d.toLocaleDateString(undefined, { month: "short" }),
    weekday: d.toLocaleDateString(undefined, { weekday: "short" }),
    long: d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
  };
}

export function venueOf(c: Challenge) {
  if (c.ground) return c.ground.name;
  if (c.venueNote) return c.province ? `${c.venueNote}, ${c.province}` : c.venueNote;
  if (c.province) return `Somewhere in ${c.province}`;
  return "Venue to be agreed";
}

const STATUS_STYLES: Record<string, string> = {
  open: "border-accent/30 bg-accent-soft text-accent",
  pending: "border-premium/30 bg-premium-soft text-premium",
  accepted: "border-success/25 bg-success/10 text-success",
  declined: "border-danger/25 bg-danger/10 text-danger",
  cancelled: "border-border bg-surface-2 text-ink-muted",
};

const STATUS_LABELS: Record<string, string> = {
  open: "Open to all",
  pending: "Awaiting reply",
  accepted: "Match on",
  declined: "Declined",
  cancelled: "Called off",
};

export function ChallengeStatus({ c }: { c: Challenge }) {
  const past = isPast(c) && (c.status === "open" || c.status === "pending");
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-3 py-1 text-xs font-semibold ${
        past ? STATUS_STYLES.cancelled : STATUS_STYLES[c.status]
      }`}
    >
      {past ? "Expired" : STATUS_LABELS[c.status]}
    </span>
  );
}

export function SideAvatar({ side, className = "h-12 w-12" }: { side: ChallengeSide | null; className?: string }) {
  if (!side) {
    return (
      <span className={`${className} flex shrink-0 items-center justify-center rounded-full border-2 border-dashed border-accent/50 text-accent`}>
        <User className="h-1/2 w-1/2" />
      </span>
    );
  }
  const round = side.kind === "player" ? "rounded-full" : "rounded-xl";
  if (side.image) return <img src={assetUrl(side.image)} alt="" className={`${className} ${round} shrink-0 object-cover`} />;
  if (side.kind === "team") {
    return (
      <span className={`${className} ${round} flex shrink-0 items-center justify-center bg-accent-soft text-accent`}>
        <Shield className="h-1/2 w-1/2" />
      </span>
    );
  }
  return <Initials name={side.name} className={`${className} ${round} text-lg`} />;
}

import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Clock, MapPin } from "lucide-react";
import type { Challenge } from "@/types";
import { getSportBySlug } from "@/data/sports";
import { ChallengeStatus, SideAvatar, dateParts, otherSide, venueOf } from "./challengeUtils";

// A match-day fixture: date block, the two sides facing off, when and where.
export default function ChallengeRow({ c, action }: { c: Challenge; action?: ReactNode }) {
  const sport = getSportBySlug(c.sport);
  const d = dateParts(c.date);
  const right = otherSide(c);

  return (
    <li className="group relative grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-4 px-4 py-5 transition-colors hover:bg-surface-2 sm:gap-6 sm:px-6 lg:grid-cols-[5rem_minmax(0,1.3fr)_minmax(0,1fr)_auto]">
      <span className="flex flex-col items-center justify-center rounded-xl border border-border bg-base-2 py-2">
        <span className="text-xs text-ink-faint">{d.weekday}</span>
        <span className="num font-display text-3xl font-bold leading-none text-ink">{d.day}</span>
        <span className="mt-0.5 text-xs text-ink-muted">{d.month}</span>
      </span>

      <div className="flex min-w-0 items-center gap-3">
        <SideAvatar side={c.challenger} className="h-11 w-11" />
        <span className="min-w-0">
          <Link
            to={`/challenges/${c.id}`}
            className="block truncate font-display text-xl font-bold text-ink after:absolute after:inset-0 group-hover:text-accent"
          >
            {c.challenger?.name ?? "Unknown"}
          </Link>
          <span className="block truncate text-sm text-ink-muted">
            vs <span className={right ? "text-ink" : "text-accent"}>{right ? right.name : "anyone"}</span>
          </span>
        </span>
      </div>

      <div className="col-start-2 flex min-w-0 flex-col gap-1 text-sm text-ink-muted lg:col-start-auto">
        <span className="flex items-center gap-2">
          {sport?.image && <img src={sport.image} alt="" className="h-5 w-5 rounded-full object-cover" />}
          {sport?.name ?? c.sport}, {c.mode === "team" ? "team match" : "1 on 1"}
        </span>
        <span className="flex items-center gap-2">
          <Clock className="h-4 w-4 shrink-0 text-ink-faint" />
          <span className="num">
            {c.startTime} to {c.endTime}
          </span>
        </span>
        <span className="flex min-w-0 items-center gap-2">
          <MapPin className="h-4 w-4 shrink-0 text-ink-faint" />
          <span className="truncate">{venueOf(c)}</span>
        </span>
      </div>

      <div className="relative z-10 col-start-2 flex flex-wrap items-center gap-3 lg:col-start-auto lg:justify-end">
        <ChallengeStatus c={c} />
        {action}
      </div>
    </li>
  );
}

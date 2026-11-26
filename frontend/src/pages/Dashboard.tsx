import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, CalendarDays, Crown, MapPin, Plus } from "lucide-react";
import api, { assetUrl } from "@/api/axios";
import { useAuth } from "@/context/AuthContext";
import type { BookingSummary, MembershipMe, TeamSummary } from "@/types";
import { apiError } from "@/types";
import { getSportBySlug } from "@/data/sports";
import { Loading } from "@/components/ui/StateBlock";
import { StatusBadge } from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/Button";
import SportMark, { Initials } from "@/components/ui/SportMark";

export default function Dashboard() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<BookingSummary[]>([]);
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [membership, setMembership] = useState<MembershipMe | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    Promise.all([
      api.get("/my/bookings").catch(() => ({ data: { bookings: [] } })),
      api.get("/my/teams").catch(() => ({ data: { teams: [] } })),
      api.get("/membership/me").catch(() => ({ data: null })),
    ])
      .then(([bookingsRes, teamsRes, membershipRes]) => {
        setBookings(bookingsRes.data.bookings ?? []);
        setTeams(teamsRes.data.teams ?? []);
        setMembership(membershipRes.data);
      })
      .finally(() => setLoading(false));
  }, [user]);

  if (!user) return null;
  if (loading) return <Loading label="Loading your dashboard…" />;

  return (
    <main className="flex-1">
      <section className="border-b border-border bg-base-2">
        <div className="container-x flex flex-col gap-8 py-12 md:flex-row md:items-end md:justify-between md:py-16">
          <div className="flex min-w-0 items-center gap-5">
            {user.photo ? (
              <img src={assetUrl(user.photo)} alt="" className="h-20 w-20 shrink-0 rounded-full object-cover md:h-24 md:w-24" />
            ) : (
              <Initials name={user.name} className="h-20 w-20 rounded-full text-3xl md:h-24 md:w-24" />
            )}
            <div className="min-w-0">
              <h1 className="font-display text-4xl font-bold leading-none text-ink md:text-6xl">
                Welcome back, {user.name.split(" ")[0]}
              </h1>
              <p className="mt-2 truncate text-ink-muted">
                {user.email}
                {user.phone && <span className="text-ink-faint">, {user.phone}</span>}
              </p>
            </div>
          </div>

          <div
            className={`flex shrink-0 items-center gap-5 rounded-2xl border p-5 md:max-w-sm ${
              user.isPremium ? "border-premium/35 bg-premium-soft" : "border-border bg-surface"
            }`}
          >
            <span
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${
                user.isPremium ? "bg-premium text-black" : "bg-surface-2 text-ink-faint"
              }`}
            >
              <Crown className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className={`font-semibold ${user.isPremium ? "text-premium" : "text-ink"}`}>
                {user.isPremium ? "Premium member" : "Starter plan"}
              </p>
              <p className="mt-0.5 text-sm text-ink-muted">
                {user.isPremium
                  ? membership?.membershipExpiresAt
                    ? `Renews or expires on ${new Date(membership.membershipExpiresAt).toLocaleDateString()}`
                    : "Your premium membership is active."
                  : "Unlimited teams, tournament hosting and booking discounts."}
              </p>
            </div>
            {!user.isPremium && (
              <Link to="/membership" className={buttonClass({ variant: "premium", size: "sm" })}>
                Upgrade
              </Link>
            )}
          </div>
        </div>
      </section>

      <div className="container-x grid gap-12 py-12 md:py-16 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <section>
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-display text-3xl font-bold text-ink">My teams</h2>
            <Link
              to="/team-dashboard"
              className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-semibold text-accent transition-colors hover:bg-accent-soft active:bg-accent-soft/70"
            >
              Manage teams <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <ul className="mt-6 flex flex-col gap-3">
            {teams.length ? (
              teams.map((t) => {
                const sport = getSportBySlug(t.sport);
                return (
                  <li key={t.id}>
                    <Link to={`/teams/${t.id}`} className="panel card-lift flex items-center gap-4 p-4">
                      {t.logo ? (
                        <img src={assetUrl(t.logo)} alt="" className="h-12 w-12 rounded-xl object-cover" />
                      ) : (
                        <SportMark slug={t.sport} size="md" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-ink">{t.name}</span>
                        <span className="block text-sm text-ink-faint">
                          {sport?.name ?? t.sport}, <span className="num">{t.memberCount}</span> members
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })
            ) : (
              <li className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-border bg-base-2 p-6">
                <p className="text-ink-muted">You don’t own a team yet.</p>
                <Link to="/teams/create" className={buttonClass({ variant: "secondary", size: "sm" })}>
                  <Plus className="h-3.5 w-3.5" /> Create a team
                </Link>
              </li>
            )}
          </ul>
        </section>

        <section>
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-display text-3xl font-bold text-ink">My bookings</h2>
            <Link
              to="/grounds"
              className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-semibold text-accent transition-colors hover:bg-accent-soft active:bg-accent-soft/70"
            >
              Browse grounds <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {bookings.length ? (
            <ul className="panel mt-6 divide-y divide-border overflow-hidden">
              {bookings.map((b) => {
                const d = new Date(b.date);
                return (
                  <li key={b.id} className="grid grid-cols-[3.75rem_minmax(0,1fr)_auto] items-center gap-4 p-4">
                    <span className="flex flex-col items-center rounded-xl border border-border bg-base-2 py-1.5">
                      <span className="num font-display text-2xl font-bold leading-none text-ink">{d.getDate()}</span>
                      <span className="mt-1 text-xs text-ink-muted">{d.toLocaleDateString(undefined, { month: "short" })}</span>
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-ink">{b.ground?.name}</span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-ink-faint">
                        <span className="flex items-center gap-1">
                          <CalendarDays className="h-3.5 w-3.5" />
                          <span className="num">
                            {b.startTime} to {b.endTime}
                          </span>
                        </span>
                        <span className="flex min-w-0 items-center gap-1">
                          <MapPin className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{b.ground?.location}</span>
                        </span>
                      </span>
                    </span>
                    <span className="flex flex-col items-end gap-1.5">
                      <span className="num font-display text-lg font-bold text-ink">Rs {b.totalAmount}</span>
                      <StatusBadge status={b.status} />
                      {["pending_payment", "confirmed", "confirmed_unpaid"].includes(b.status) && (
                        <button
                          className="text-xs font-semibold text-danger hover:underline"
                          onClick={async () => {
                            if (!window.confirm("Cancel this booking?")) return;
                            try {
                              await api.post(`/ground-bookings/${b.id}/cancel`);
                              setBookings((list) => list.map((x) => (x.id === b.id ? { ...x, status: "cancelled" } : x)));
                            } catch (err) {
                              window.alert(apiError(err));
                            }
                          }}
                        >
                          Cancel
                        </button>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="mt-6 flex flex-col items-start gap-3 rounded-2xl border border-dashed border-border bg-base-2 p-6">
              <p className="text-ink-muted">No bookings yet.</p>
              <Link to="/grounds" className={buttonClass({ variant: "secondary", size: "sm" })}>
                Browse grounds
              </Link>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

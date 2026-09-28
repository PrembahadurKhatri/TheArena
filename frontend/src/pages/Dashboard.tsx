import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, Crown, MapPin, Shield, User } from "lucide-react";
import api from "@/api/axios";
import { useAuth } from "@/context/AuthContext";
import type { BookingSummary, MembershipMe, TeamSummary } from "@/types";
import { getSportBySlug } from "@/data/sports";
import Reveal from "@/components/Reveal";
import { Loading } from "@/components/ui/StateBlock";
import { StatusBadge } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";

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
  if (loading) return <Loading label="Loading your dashboard..." />;

  return (
    <main className="flex-1 py-16">
      <div className="container-x">
        <Reveal>
          <span className="eyebrow">Dashboard</span>
        </Reveal>
        <Reveal delay={0.06}>
          <h1 className="mt-4 font-display text-4xl font-bold text-ink">Welcome back, {user.name.split(" ")[0]}</h1>
        </Reveal>

        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          <Reveal delay={0.1} className="lg:col-span-1">
            <div className="glass flex flex-col items-center gap-3 rounded-3xl p-7 text-center">
              {user.photo ? (
                <img src={user.photo} alt={user.name} className="h-20 w-20 rounded-full object-cover" />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-accent-soft text-accent">
                  <User className="h-8 w-8" />
                </div>
              )}
              <div className="flex items-center gap-2">
                <h2 className="font-display text-xl font-semibold text-ink">{user.name}</h2>
                {user.isPremium && <Crown className="h-4 w-4 text-premium" />}
              </div>
              <p className="text-sm text-ink-muted">{user.email}</p>
              {user.phone && <p className="text-sm text-ink-faint">{user.phone}</p>}
            </div>
          </Reveal>

          <Reveal delay={0.16} className="lg:col-span-2">
            <div
              className={`glass flex h-full flex-col justify-between rounded-3xl p-7 ${
                user.isPremium ? "border-premium/30 shadow-[0_0_0_1px_rgb(var(--c-premium)/0.3)]" : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className={user.isPremium ? "eyebrow-premium" : "eyebrow"}>
                    {user.isPremium ? "Premium Member" : "Starter Plan"}
                  </span>
                  <p className="mt-3 text-sm text-ink-muted">
                    {user.isPremium
                      ? membership?.membershipExpiresAt
                        ? `Renews / expires on ${new Date(membership.membershipExpiresAt).toLocaleDateString()}`
                        : "Your premium membership is active."
                      : "Upgrade to unlock unlimited teams, tournament hosting, and booking discounts."}
                  </p>
                </div>
                {user.isPremium ? (
                  <Crown className="h-10 w-10 text-premium" />
                ) : (
                  <Link to="/membership">
                    <Button variant="premium">Upgrade</Button>
                  </Link>
                )}
              </div>
            </div>
          </Reveal>
        </div>

        <Reveal delay={0.2} className="mt-10">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold text-ink">My teams</h2>
            <Link to="/team-dashboard" className="text-sm font-medium text-accent hover:underline">
              Manage teams
            </Link>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {teams.length ? (
              teams.map((t) => {
                const sport = getSportBySlug(t.sport);
                return (
                  <Link key={t.id} to={`/teams/${t.id}`} className="glass flex items-center gap-3 rounded-xl p-4 hover:border-accent/40">
                    {t.logo ? (
                      <img src={t.logo} alt={t.name} className="h-11 w-11 rounded-lg object-cover" />
                    ) : (
                      <div
                        className="flex h-11 w-11 items-center justify-center rounded-lg text-xl"
                        style={{ background: `${sport?.color ?? "#3a82ff"}22` }}
                      >
                        {sport?.emoji ?? <Shield className="h-5 w-5 text-accent" />}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-semibold text-ink">{t.name}</p>
                      <p className="text-xs text-ink-faint">{t.memberCount} members</p>
                    </div>
                  </Link>
                );
              })
            ) : (
              <div className="col-span-full rounded-2xl border border-dashed border-border p-8 text-center">
                <p className="text-sm text-ink-muted">You don't own a team yet.</p>
                <Link to="/teams/create" className="mt-2 inline-block text-sm font-semibold text-accent hover:underline">
                  Create a team
                </Link>
              </div>
            )}
          </div>
        </Reveal>

        <Reveal delay={0.26} className="mt-10">
          <h2 className="font-display text-xl font-semibold text-ink">My bookings</h2>
          <div className="mt-4 flex flex-col gap-3">
            {bookings.length ? (
              bookings.map((b) => (
                <div key={b.id} className="glass flex flex-wrap items-center justify-between gap-3 rounded-xl p-4">
                  <div>
                    <p className="text-sm font-semibold text-ink">{b.ground?.name}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-3 text-xs text-ink-faint">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {b.ground?.location}
                      </span>
                      <span className="flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" /> {new Date(b.date).toLocaleDateString()} · {b.startTime}–
                        {b.endTime}
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-display font-semibold text-ink">Rs {b.totalAmount}</span>
                    <StatusBadge status={b.status} />
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-border p-8 text-center">
                <p className="text-sm text-ink-muted">No bookings yet.</p>
                <Link to="/grounds" className="mt-2 inline-block text-sm font-semibold text-accent hover:underline">
                  Browse grounds
                </Link>
              </div>
            )}
          </div>
        </Reveal>
      </div>
    </main>
  );
}

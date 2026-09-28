import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Plus, Shield, UserMinus, Users, X } from "lucide-react";
import api from "@/api/axios";
import { useAuth } from "@/context/AuthContext";
import type { TeamDetail } from "@/types";
import { apiError } from "@/types";
import { getSportBySlug } from "@/data/sports";
import Reveal from "@/components/Reveal";
import { Loading, ErrorState, EmptyState } from "@/components/ui/StateBlock";

export default function TeamDashboard() {
  const { user } = useAuth();
  const [teams, setTeams] = useState<TeamDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/my/teams");
      const owned = (data.teams ?? []).filter((t: { owner: { id: string } }) => t.owner?.id === user.id);
      const details = await Promise.all(
        owned.map((t: { id: string }) => api.get(`/teams/${t.id}`).then((r) => r.data.team as TeamDetail))
      );
      setTeams(details);
    } catch (err) {
      setError(apiError(err, "Could not load your teams."));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  async function respond(teamId: string, userId: string, action: "accept" | "reject") {
    setBusy(`${teamId}-${userId}`);
    try {
      await api.patch(`/teams/${teamId}/join-requests/${userId}`, { action });
      load();
    } catch (err) {
      setError(apiError(err, "Could not update this request."));
    } finally {
      setBusy(null);
    }
  }

  async function removeMember(teamId: string, userId: string) {
    setBusy(`${teamId}-${userId}`);
    try {
      await api.delete(`/teams/${teamId}/members/${userId}`);
      load();
    } catch (err) {
      setError(apiError(err, "Could not remove this member."));
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="flex-1 py-16">
      <div className="container-x">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <Reveal>
              <span className="eyebrow">Team dashboard</span>
            </Reveal>
            <Reveal delay={0.06}>
              <h1 className="mt-4 font-display text-4xl font-bold text-ink">Manage your teams</h1>
            </Reveal>
          </div>
          <Reveal delay={0.1}>
            <Link
              to="/teams/create"
              className="shine inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent/90"
            >
              <Plus className="h-4 w-4" /> New team
            </Link>
          </Reveal>
        </div>

        <div className="mt-10">
          {loading && <Loading label="Loading your teams..." />}
          {!loading && error && <ErrorState message={error} onRetry={load} />}
          {!loading && !error && teams.length === 0 && (
            <EmptyState
              title="You don't own a team yet"
              message="Create a team to start managing your roster and join requests."
              action={
                <Link to="/teams/create" className="mt-2 text-sm font-semibold text-accent hover:underline">
                  Create a team
                </Link>
              }
            />
          )}

          <div className="flex flex-col gap-8">
            {teams.map((team, i) => {
              const sport = getSportBySlug(team.sport);
              return (
                <Reveal key={team.id} delay={i * 0.08}>
                  <div className="glass rounded-3xl p-7">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        {team.logo ? (
                          <img src={team.logo} alt={team.name} className="h-14 w-14 rounded-xl object-cover" />
                        ) : (
                          <div
                            className="flex h-14 w-14 items-center justify-center rounded-xl text-2xl"
                            style={{ background: `${sport?.color ?? "#3a82ff"}22` }}
                          >
                            {sport?.emoji ?? <Shield className="h-6 w-6 text-accent" />}
                          </div>
                        )}
                        <div>
                          <Link to={`/teams/${team.id}`} className="font-display text-xl font-semibold text-ink hover:text-accent">
                            {team.name}
                          </Link>
                          <p className="flex items-center gap-1.5 text-xs text-ink-faint">
                            <Users className="h-3 w-3" /> {team.memberCount} members · {sport?.name ?? team.sport}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 grid gap-6 md:grid-cols-2">
                      <div>
                        <h3 className="text-xs font-semibold uppercase tracking-widest text-ink-faint">Roster</h3>
                        <div className="mt-3 flex flex-col gap-2">
                          {team.members?.length ? (
                            team.members.map((m) => (
                              <div key={m.id} className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2">
                                <span className="text-sm text-ink">{m.name}</span>
                                {m.id !== user?.id && (
                                  <button
                                    onClick={() => removeMember(team.id, m.id)}
                                    disabled={busy === `${team.id}-${m.id}`}
                                    className="rounded-full p-1 text-ink-faint hover:bg-red-500/10 hover:text-red-400"
                                    aria-label={`Remove ${m.name}`}
                                  >
                                    <UserMinus className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-ink-faint">No members yet.</p>
                          )}
                        </div>
                      </div>

                      <div>
                        <h3 className="text-xs font-semibold uppercase tracking-widest text-ink-faint">
                          Pending requests
                        </h3>
                        <div className="mt-3 flex flex-col gap-2">
                          {team.pendingRequests?.length ? (
                            team.pendingRequests.map((r) => (
                              <div key={r.id} className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2">
                                <span className="text-sm text-ink">{r.name}</span>
                                <div className="flex gap-1.5">
                                  <button
                                    onClick={() => respond(team.id, r.id, "accept")}
                                    disabled={busy === `${team.id}-${r.id}`}
                                    className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                                    aria-label="Accept"
                                  >
                                    <Check className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => respond(team.id, r.id, "reject")}
                                    disabled={busy === `${team.id}-${r.id}`}
                                    className="flex h-7 w-7 items-center justify-center rounded-full bg-red-500/10 text-red-400 hover:bg-red-500/20"
                                    aria-label="Reject"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-ink-faint">No pending requests.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}

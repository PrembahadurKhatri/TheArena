import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Check, Plus, UserMinus, X } from "lucide-react";
import api, { assetUrl } from "@/api/axios";
import { useAuth } from "@/context/AuthContext";
import type { TeamDetail } from "@/types";
import { apiError } from "@/types";
import { getSportBySlug } from "@/data/sports";
import { Loading, ErrorState, EmptyState } from "@/components/ui/StateBlock";
import { buttonClass } from "@/components/ui/Button";
import SportMark, { Initials } from "@/components/ui/SportMark";

const iconBtn =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-40";

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

  const pendingTotal = teams.reduce((n, t) => n + (t.pendingRequests?.length ?? 0), 0);

  return (
    <main className="flex-1">
      <div className="container-x py-14 md:py-20">
        <div className="flex flex-wrap items-end justify-between gap-6 border-b border-border pb-8">
          <div>
            <h1 className="font-display text-5xl font-bold leading-[0.95] text-ink md:text-6xl">Manage your teams</h1>
            {!loading && teams.length > 0 && (
              <p className="mt-3 text-ink-muted">
                <span className="num">{teams.length}</span> {teams.length === 1 ? "team" : "teams"},{" "}
                <span className="num">{pendingTotal}</span> pending {pendingTotal === 1 ? "request" : "requests"}
              </p>
            )}
          </div>
          <Link to="/teams/create" className={buttonClass({ size: "lg" })}>
            <Plus className="h-4 w-4" /> New team
          </Link>
        </div>

        <div className="mt-10">
          {loading && <Loading label="Loading your teams…" />}
          {!loading && error && <ErrorState message={error} onRetry={load} />}
          {!loading && !error && teams.length === 0 && (
            <EmptyState
              title="You don’t own a team yet"
              message="Create a team to start managing your roster and join requests."
              action={
                <Link to="/teams/create" className={buttonClass({ variant: "secondary", size: "sm", className: "mt-2" })}>
                  Create a team
                </Link>
              }
            />
          )}

          <div className="flex flex-col gap-8">
            {teams.map((team) => {
              const sport = getSportBySlug(team.sport);
              return (
                <section key={team.id} className="panel overflow-hidden">
                  <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-base-2 px-6 py-5">
                    <div className="flex min-w-0 items-center gap-4">
                      {team.logo ? (
                        <img src={assetUrl(team.logo)} alt="" className="h-14 w-14 rounded-xl object-cover" />
                      ) : (
                        <SportMark slug={team.sport} size="lg" className="!h-14 !w-14" />
                      )}
                      <div className="min-w-0">
                        <h2 className="truncate font-display text-3xl font-bold text-ink">{team.name}</h2>
                        <p className="text-sm text-ink-muted">
                          {sport?.name ?? team.sport}, <span className="num">{team.memberCount}</span> members
                        </p>
                      </div>
                    </div>
                    <Link to={`/teams/${team.id}`} className={buttonClass({ variant: "secondary", size: "sm" })}>
                      Team page <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                  </header>

                  <div className="grid md:grid-cols-2 md:divide-x md:divide-border">
                    <div className="p-6">
                      <h3 className="flex items-baseline justify-between text-sm font-semibold text-ink-muted">
                        Roster <span className="num font-normal text-ink-faint">{team.members?.length ?? 0}</span>
                      </h3>
                      <ul className="mt-4 flex flex-col divide-y divide-border">
                        {team.members?.length ? (
                          team.members.map((m) => (
                            <li key={m.id} className="flex items-center justify-between gap-3 py-2.5">
                              <span className="flex min-w-0 items-center gap-3">
                                <Initials name={m.name} className="h-8 w-8 rounded-full text-xs" />
                                <span className="truncate text-sm text-ink">{m.name}</span>
                              </span>
                              {m.id !== user?.id && (
                                <button
                                  onClick={() => removeMember(team.id, m.id)}
                                  disabled={busy === `${team.id}-${m.id}`}
                                  className={`${iconBtn} text-ink-faint hover:bg-danger/10 hover:text-danger active:bg-danger/20`}
                                  aria-label={`Remove ${m.name}`}
                                >
                                  <UserMinus className="h-4 w-4" />
                                </button>
                              )}
                            </li>
                          ))
                        ) : (
                          <li className="py-2 text-sm text-ink-faint">No members yet.</li>
                        )}
                      </ul>
                    </div>

                    <div className="border-t border-border p-6 md:border-t-0">
                      <h3 className="flex items-baseline justify-between text-sm font-semibold text-ink-muted">
                        Pending requests{" "}
                        <span className="num font-normal text-ink-faint">{team.pendingRequests?.length ?? 0}</span>
                      </h3>
                      <ul className="mt-4 flex flex-col divide-y divide-border">
                        {team.pendingRequests?.length ? (
                          team.pendingRequests.map((r) => (
                            <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                              <span className="flex min-w-0 items-center gap-3">
                                <Initials name={r.name} className="h-8 w-8 rounded-full text-xs" />
                                <span className="truncate text-sm text-ink">{r.name}</span>
                              </span>
                              <span className="flex gap-1.5">
                                <button
                                  onClick={() => respond(team.id, r.id, "accept")}
                                  disabled={busy === `${team.id}-${r.id}`}
                                  className={`${iconBtn} bg-success/10 text-success hover:bg-success/20 active:bg-success/25`}
                                  aria-label="Accept"
                                >
                                  <Check className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => respond(team.id, r.id, "reject")}
                                  disabled={busy === `${team.id}-${r.id}`}
                                  className={`${iconBtn} bg-danger/10 text-danger hover:bg-danger/20 active:bg-danger/25`}
                                  aria-label="Reject"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </span>
                            </li>
                          ))
                        ) : (
                          <li className="py-2 text-sm text-ink-faint">No pending requests.</li>
                        )}
                      </ul>
                    </div>
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}

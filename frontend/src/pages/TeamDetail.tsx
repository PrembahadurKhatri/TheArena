import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Check, Shield, UserMinus, UserPlus, Users, X } from "lucide-react";
import api from "@/api/axios";
import { useAuth } from "@/context/AuthContext";
import type { TeamDetail as TeamDetailType } from "@/types";
import { apiError } from "@/types";
import { getSportBySlug } from "@/data/sports";
import Reveal from "@/components/Reveal";
import { Loading, ErrorState } from "@/components/ui/StateBlock";
import Button from "@/components/ui/Button";

export default function TeamDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [team, setTeam] = useState<TeamDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [joinSent, setJoinSent] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    setError("");
    api
      .get(`/teams/${id}`)
      .then(({ data }) => setTeam(data.team))
      .catch((err) => setError(apiError(err, "Could not load this team.")))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function requestJoin() {
    if (!user) return navigate("/login", { state: { from: `/teams/${id}` } });
    setActionError("");
    setBusy("join");
    try {
      await api.post(`/teams/${id}/join-requests`);
      setJoinSent(true);
    } catch (err) {
      setActionError(apiError(err, "Could not send join request."));
    } finally {
      setBusy(null);
    }
  }

  async function respondToRequest(userId: string, action: "accept" | "reject") {
    setActionError("");
    setBusy(userId);
    try {
      await api.patch(`/teams/${id}/join-requests/${userId}`, { action });
      load();
    } catch (err) {
      setActionError(apiError(err, "Could not update this request."));
    } finally {
      setBusy(null);
    }
  }

  async function removeMember(userId: string) {
    setActionError("");
    setBusy(userId);
    try {
      await api.delete(`/teams/${id}/members/${userId}`);
      load();
    } catch (err) {
      setActionError(apiError(err, "Could not remove this member."));
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <Loading label="Loading team..." />;
  if (error || !team) return <ErrorState message={error || "Team not found."} onRetry={load} />;

  const sport = getSportBySlug(team.sport);
  const isOwner = user && team.owner?.id === user.id;
  const isMember = user && team.members?.some((m) => m.id === user.id);

  return (
    <main className="flex-1 py-16">
      <div className="container-x">
        <Reveal>
          <div className="glass flex flex-col gap-6 rounded-3xl p-8 sm:flex-row sm:items-center">
            {team.logo ? (
              <img src={team.logo} alt={team.name} className="h-24 w-24 rounded-2xl object-cover" />
            ) : (
              <div
                className="flex h-24 w-24 items-center justify-center rounded-2xl text-4xl"
                style={{ background: `${sport?.color ?? "#3a82ff"}22` }}
              >
                {sport?.emoji ?? <Shield className="h-10 w-10 text-accent" />}
              </div>
            )}
            <div className="flex-1">
              <span className="eyebrow">{sport?.name ?? team.sport}</span>
              <h1 className="mt-3 font-display text-3xl font-bold text-ink md:text-4xl">{team.name}</h1>
              <p className="mt-1.5 flex items-center gap-1.5 text-sm text-ink-muted">
                <Users className="h-3.5 w-3.5" /> {team.memberCount} members · owned by {team.owner?.name}
              </p>
            </div>

            {!isOwner && !isMember && (
              <Button onClick={requestJoin} loading={busy === "join"} disabled={joinSent} icon={<UserPlus className="h-4 w-4" />}>
                {joinSent ? "Request sent" : "Request to join"}
              </Button>
            )}
            {isMember && !isOwner && (
              <span className="rounded-full bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-400">
                You're a member
              </span>
            )}
          </div>
        </Reveal>

        {actionError && <p className="mt-4 text-sm text-red-400">{actionError}</p>}

        <div className="mt-10 grid gap-8 lg:grid-cols-3">
          <Reveal delay={0.08} className="lg:col-span-2">
            <h2 className="font-display text-xl font-semibold text-ink">Roster</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {team.members?.length ? (
                team.members.map((m) => (
                  <div key={m.id} className="glass flex items-center justify-between rounded-xl p-4">
                    <Link to={`/players/${m.id}`} className="flex items-center gap-3">
                      {m.photo ? (
                        <img src={m.photo} alt={m.name} className="h-10 w-10 rounded-full object-cover" />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-accent">
                          {m.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="text-sm font-medium text-ink hover:text-accent">{m.name}</span>
                    </Link>
                    {isOwner && m.id !== user?.id && (
                      <button
                        onClick={() => removeMember(m.id)}
                        disabled={busy === m.id}
                        className="rounded-full p-1.5 text-ink-faint hover:bg-red-500/10 hover:text-red-400"
                        aria-label={`Remove ${m.name}`}
                      >
                        <UserMinus className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-sm text-ink-muted">No members yet.</p>
              )}
            </div>
          </Reveal>

          {isOwner && (
            <Reveal delay={0.14}>
              <h2 className="font-display text-xl font-semibold text-ink">Pending requests</h2>
              <div className="mt-4 flex flex-col gap-3">
                {team.pendingRequests?.length ? (
                  team.pendingRequests.map((r) => (
                    <div key={r.id} className="glass flex items-center justify-between rounded-xl p-4">
                      <span className="text-sm font-medium text-ink">{r.name}</span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => respondToRequest(r.id, "accept")}
                          disabled={busy === r.id}
                          className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                          aria-label="Accept"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => respondToRequest(r.id, "reject")}
                          disabled={busy === r.id}
                          className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/10 text-red-400 hover:bg-red-500/20"
                          aria-label="Reject"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-ink-muted">No pending requests.</p>
                )}
              </div>
            </Reveal>
          )}
        </div>
      </div>
    </main>
  );
}

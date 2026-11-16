import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, CheckCircle2, UserMinus, UserPlus, X } from "lucide-react";
import api, { assetUrl } from "@/api/axios";
import { useAuth } from "@/context/AuthContext";
import type { TeamDetail as TeamDetailType } from "@/types";
import { apiError } from "@/types";
import { getSportBySlug } from "@/data/sports";
import { Loading, ErrorState } from "@/components/ui/StateBlock";
import Button from "@/components/ui/Button";
import SportMark, { Initials } from "@/components/ui/SportMark";
import PageHero from "@/components/page/PageHero";
import { FormError } from "@/components/page/AuthShell";

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

  if (loading) return <Loading label="Loading team…" />;
  if (error || !team) return <ErrorState message={error || "Team not found."} onRetry={load} />;

  const sport = getSportBySlug(team.sport);
  const isOwner = user && team.owner?.id === user.id;
  const isMember = user && team.members?.some((m) => m.id === user.id);

  return (
    <main className="flex-1">
      <PageHero
        image={sport?.image}
        above={
          <Link to="/teams" className="inline-flex items-center gap-1.5 hover:text-ink">
            <ArrowLeft className="h-4 w-4" /> All teams
          </Link>
        }
        title={
          <span className="flex flex-col gap-5 sm:flex-row sm:items-end">
            {team.logo ? (
              <img
                src={assetUrl(team.logo)}
                alt={team.name}
                className="h-24 w-24 shrink-0 rounded-2xl border-4 border-base object-cover md:h-28 md:w-28"
              />
            ) : (
              <SportMark slug={team.sport} size="xl" className="border-4 border-base" />
            )}
            <span className="min-w-0">{team.name}</span>
          </span>
        }
        actions={
          <>
            {!isOwner && !isMember && (
              <Button
                size="lg"
                onClick={requestJoin}
                loading={busy === "join"}
                disabled={joinSent}
                icon={joinSent ? <CheckCircle2 className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
              >
                {joinSent ? "Request sent" : "Request to join"}
              </Button>
            )}
            {isMember && !isOwner && (
              <span className="inline-flex h-12 items-center gap-2 rounded-full border border-success/25 bg-success/10 px-5 text-sm font-semibold text-success">
                <CheckCircle2 className="h-4 w-4" /> You’re a member
              </span>
            )}
          </>
        }
      >
        <dl className="flex flex-wrap gap-x-10 gap-y-3">
          <div>
            <dt className="text-sm text-ink-faint">Sport</dt>
            <dd className="mt-0.5 font-semibold text-ink">{sport?.name ?? team.sport}</dd>
          </div>
          <div>
            <dt className="text-sm text-ink-faint">Members</dt>
            <dd className="num mt-0.5 font-semibold text-ink">{team.memberCount}</dd>
          </div>
          <div>
            <dt className="text-sm text-ink-faint">Owner</dt>
            <dd className="mt-0.5 font-semibold text-ink">{team.owner?.name}</dd>
          </div>
        </dl>
      </PageHero>

      <div className="container-x py-12 md:py-16">
        {actionError && (
          <div className="mb-8">
            <FormError>{actionError}</FormError>
          </div>
        )}

        <div className={`grid gap-10 ${isOwner ? "lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]" : ""}`}>
          <section>
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-3xl font-bold text-ink">Roster</h2>
              <span className="num text-sm text-ink-faint">{team.members?.length ?? 0} players</span>
            </div>
            <ul className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(min(100%,16rem),1fr))] gap-3">
              {team.members?.length ? (
                team.members.map((m) => (
                  <li key={m.id} className="panel flex items-center justify-between gap-3 p-3 pr-4">
                    <Link to={`/players/${m.id}`} className="group flex min-w-0 items-center gap-3">
                      {m.photo ? (
                        <img src={assetUrl(m.photo)} alt="" className="h-12 w-12 rounded-full object-cover" />
                      ) : (
                        <Initials name={m.name} className="h-12 w-12 rounded-full text-lg" />
                      )}
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-ink group-hover:text-accent">{m.name}</span>
                        {m.id === team.owner?.id && <span className="block text-xs text-premium">Owner</span>}
                      </span>
                    </Link>
                    {isOwner && m.id !== user?.id && (
                      <button
                        onClick={() => removeMember(m.id)}
                        disabled={busy === m.id}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-faint transition-colors hover:bg-danger/10 hover:text-danger active:bg-danger/20 disabled:opacity-40"
                        aria-label={`Remove ${m.name}`}
                      >
                        <UserMinus className="h-4 w-4" />
                      </button>
                    )}
                  </li>
                ))
              ) : (
                <li className="text-sm text-ink-muted">No members yet.</li>
              )}
            </ul>
          </section>

          {isOwner && (
            <aside className="panel self-start p-6">
              <div className="flex items-baseline justify-between">
                <h2 className="font-display text-2xl font-bold text-ink">Pending requests</h2>
                <span className="num text-sm text-ink-faint">{team.pendingRequests?.length ?? 0}</span>
              </div>
              <ul className="mt-5 flex flex-col divide-y divide-border">
                {team.pendingRequests?.length ? (
                  team.pendingRequests.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                      <span className="flex min-w-0 items-center gap-3">
                        <Initials name={r.name} className="h-9 w-9 rounded-full text-sm" />
                        <span className="truncate text-sm font-medium text-ink">{r.name}</span>
                      </span>
                      <span className="flex shrink-0 gap-2">
                        <button
                          onClick={() => respondToRequest(r.id, "accept")}
                          disabled={busy === r.id}
                          className="flex h-9 w-9 items-center justify-center rounded-full bg-success/10 text-success transition-colors hover:bg-success/20 active:bg-success/25 disabled:opacity-40"
                          aria-label="Accept"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => respondToRequest(r.id, "reject")}
                          disabled={busy === r.id}
                          className="flex h-9 w-9 items-center justify-center rounded-full bg-danger/10 text-danger transition-colors hover:bg-danger/20 active:bg-danger/25 disabled:opacity-40"
                          aria-label="Reject"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </span>
                    </li>
                  ))
                ) : (
                  <li className="text-sm text-ink-muted">No pending requests.</li>
                )}
              </ul>
            </aside>
          )}
        </div>
      </div>
    </main>
  );
}

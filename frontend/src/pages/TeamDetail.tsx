import { useCallback, useEffect, useState } from "react";
import ReportButton from "@/components/ReportButton";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, LogOut, MapPin, Settings2, Swords, UserPlus, X } from "lucide-react";
import api, { assetUrl } from "@/api/axios";
import { useAuth } from "@/context/AuthContext";
import type { TeamDetail as TeamDetailType } from "@/types";
import { apiError, TEAM_ROLE_LABEL } from "@/types";
import { getSportBySlug } from "@/data/sports";
import { Loading, ErrorState } from "@/components/ui/StateBlock";
import Button, { buttonClass } from "@/components/ui/Button";
import SportMark, { Initials } from "@/components/ui/SportMark";
import PageHero from "@/components/page/PageHero";
import { FormError } from "@/components/page/AuthShell";
import StatsPanel from "@/components/StatsPanel";

const ROLE_TONE: Record<string, string> = {
  owner: "text-premium",
  captain: "text-accent",
  vice_captain: "text-accent",
  player: "text-ink-faint",
};

export default function TeamDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [team, setTeam] = useState<TeamDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
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

  async function act(key: string, fn: () => Promise<{ data: { team?: TeamDetailType } }>, after?: () => void) {
    if (!user) return navigate("/login", { state: { from: `/teams/${id}` } });
    setActionError("");
    setBusy(key);
    try {
      const { data } = await fn();
      if (data.team) setTeam(data.team);
      after?.();
    } catch (err) {
      setActionError(apiError(err));
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <Loading label="Loading team…" />;
  if (error || !team) return <ErrorState message={error || "Team not found."} onRetry={load} />;

  const sport = getSportBySlug(team.sport);
  const role = team.viewerRole ?? null;
  const manages = role === "owner" || role === "captain";
  const place = [team.municipality, team.district, team.province].filter(Boolean).join(", ");

  return (
    <main className="flex-1">
      <PageHero
        image={team.coverImage ? assetUrl(team.coverImage) : sport?.image}
        above={
          <Link to="/teams" className="inline-flex items-center gap-1.5 hover:text-ink">
            <ArrowLeft className="h-4 w-4" /> All teams
          </Link>
        }
        title={
          <span className="flex flex-col gap-5 sm:flex-row sm:items-end">
            {team.logo ? (
              <img src={assetUrl(team.logo)} alt={team.name} className="h-24 w-24 shrink-0 rounded-2xl border-4 border-base object-cover md:h-28 md:w-28" />
            ) : (
              <SportMark slug={team.sport} size="xl" className="border-4 border-base" />
            )}
            <span className="min-w-0">{team.name}</span>
          </span>
        }
        actions={
          <>
            {!role && team.viewerIsInvited && (
              <>
                <Button size="lg" loading={busy === "accept"} icon={<CheckCircle2 className="h-4 w-4" />} onClick={() => act("accept", () => api.post(`/teams/${team.id}/invitations/respond`, { action: "accept" }))}>
                  Accept invitation
                </Button>
                <Button size="lg" variant="secondary" loading={busy === "decline"} onClick={() => act("decline", () => api.post(`/teams/${team.id}/invitations/respond`, { action: "decline" }))}>
                  Decline
                </Button>
              </>
            )}
            {!role && !team.viewerIsInvited && team.status !== "suspended" && (
              team.viewerHasRequested ? (
                <Button size="lg" variant="secondary" loading={busy === "withdraw"} icon={<X className="h-4 w-4" />} onClick={() => act("withdraw", () => api.delete(`/teams/${team.id}/join-requests`))}>
                  Withdraw request
                </Button>
              ) : (
                <Button size="lg" loading={busy === "join"} icon={<UserPlus className="h-4 w-4" />} onClick={() => act("join", () => api.post(`/teams/${team.id}/join-requests`))}>
                  Request to join
                </Button>
              )
            )}
            {manages && (
              <Link to={`/team-dashboard?team=${team.id}`} className={buttonClass({ size: "lg" })}>
                <Settings2 className="h-4 w-4" /> Manage team
              </Link>
            )}
            {manages && (
              <Link to={`/challenges/new?mode=team&team=${team.id}`} className={buttonClass({ size: "lg", variant: "secondary" })}>
                <Swords className="h-4 w-4" /> Challenge a team
              </Link>
            )}
            {role && role !== "owner" && (
              <Button
                size="lg"
                variant="ghost"
                loading={busy === "leave"}
                icon={<LogOut className="h-4 w-4" />}
                onClick={() => {
                  if (window.confirm(`Leave ${team.name}?`)) act("leave", () => api.post(`/teams/${team.id}/leave`), load);
                }}
              >
                Leave team
              </Button>
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
          {place && (
            <div>
              <dt className="text-sm text-ink-faint">Home</dt>
              <dd className="mt-0.5 flex items-center gap-1 font-semibold text-ink">
                <MapPin className="h-3.5 w-3.5 text-ink-faint" /> {place}
              </dd>
            </div>
          )}
          {role && (
            <div>
              <dt className="text-sm text-ink-faint">Your role</dt>
              <dd className="mt-0.5 font-semibold text-success">{TEAM_ROLE_LABEL[role]}</dd>
            </div>
          )}
        </dl>
      </PageHero>

      <div className="container-x py-12 md:py-16">
        {actionError && (
          <div className="mb-8">
            <FormError>{actionError}</FormError>
          </div>
        )}
        {team.status === "suspended" && (
          <p className="mb-8 rounded-2xl border border-danger/25 bg-danger/10 px-5 py-4 text-sm text-danger">
            This team has been suspended by The Arena and can’t take new members or matches.
          </p>
        )}
        {team.viewerHasRequested && (
          <p className="mb-8 rounded-2xl border border-accent/25 bg-accent-soft px-5 py-4 text-sm text-accent">
            Your request to join is waiting for the owner or captain.
          </p>
        )}

        {team.description && <p className="mb-12 max-w-3xl whitespace-pre-line text-lg text-ink-muted">{team.description}</p>}
        {!role && (
          <div className="mb-8">
            <ReportButton targetType="team" targetId={team.id} />
          </div>
        )}

        <section>
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-3xl font-bold text-ink">Roster</h2>
            <span className="num text-sm text-ink-faint">{team.members?.length ?? 0} players</span>
          </div>
          <ul className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(min(100%,16rem),1fr))] gap-3">
            {team.members.map((m) => (
              <li key={m.id} className="panel p-3 pr-4">
                <Link to={`/players/${m.username || m.id}`} className="group flex min-w-0 items-center gap-3">
                  {m.photo ? (
                    <img src={assetUrl(m.photo)} alt="" className="h-12 w-12 rounded-full object-cover" />
                  ) : (
                    <Initials name={m.name} className="h-12 w-12 rounded-full text-lg" />
                  )}
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-ink group-hover:text-accent">{m.name}</span>
                    <span className={`block text-xs font-medium ${ROLE_TONE[m.role ?? "player"]}`}>
                      {m.role === "owner" && m.isCaptain ? "Owner · Captain" : TEAM_ROLE_LABEL[m.role ?? "player"]}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <StatsPanel kind="teams" id={team.id} />
    </main>
  );
}

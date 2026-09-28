import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CalendarDays, Play, Shield, Trophy, Users } from "lucide-react";
import api from "@/api/axios";
import { useAuth } from "@/context/AuthContext";
import type { TeamSummary, TournamentDetail as TournamentDetailType, TournamentMatch } from "@/types";
import { apiError } from "@/types";
import { getSportBySlug } from "@/data/sports";
import Reveal from "@/components/Reveal";
import { Loading, ErrorState } from "@/components/ui/StateBlock";
import Button from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import { StatusBadge } from "@/components/ui/Badge";

interface Standing {
  team: TeamSummary;
  wins: number;
  losses: number;
}

function MatchCard({
  match,
  isOrganizer,
  onSubmitScore,
}: {
  match: TournamentMatch;
  isOrganizer: boolean;
  onSubmitScore: (matchId: string, scoreA: number, scoreB: number, winnerTeamId: string) => Promise<void>;
}) {
  const [scoreA, setScoreA] = useState(match.scoreA?.toString() ?? "");
  const [scoreB, setScoreB] = useState(match.scoreB?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const canEnter = isOrganizer && match.status !== "completed" && match.teamA && match.teamB;

  async function submit() {
    if (!match.teamA || !match.teamB) return;
    const a = Number(scoreA);
    const b = Number(scoreB);
    if (Number.isNaN(a) || Number.isNaN(b) || a === b) {
      setErr("Enter two different, valid scores to determine a winner.");
      return;
    }
    const winnerTeamId = a > b ? match.teamA.id : match.teamB.id;
    setErr("");
    setSaving(true);
    try {
      await onSubmitScore(match.id, a, b, winnerTeamId);
    } catch (e) {
      setErr(apiError(e, "Could not save result."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="glass w-64 shrink-0 rounded-xl p-4">
      <div className="flex items-center justify-between text-xs text-ink-faint">
        <span>Round {match.round}</span>
        <StatusBadge status={match.status} />
      </div>
      <div className="mt-3 flex flex-col gap-2">
        {[
          { team: match.teamA, score: match.scoreA },
          { team: match.teamB, score: match.scoreB },
        ].map((slot, i) => {
          const isWinner = match.winner && slot.team && match.winner.id === slot.team.id;
          return (
            <div
              key={i}
              className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
                isWinner ? "bg-accent-soft text-accent" : "bg-surface-2 text-ink"
              }`}
            >
              <span className="truncate">{slot.team?.name ?? "TBD"}</span>
              {slot.score !== null && slot.score !== undefined && (
                <span className="font-display font-semibold">{slot.score}</span>
              )}
            </div>
          );
        })}
      </div>

      {canEnter && (
        <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
          <div className="flex gap-2">
            <input
              type="number"
              value={scoreA}
              onChange={(e) => setScoreA(e.target.value)}
              placeholder="A"
              className="w-1/2 rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-ink outline-none focus:border-accent"
            />
            <input
              type="number"
              value={scoreB}
              onChange={(e) => setScoreB(e.target.value)}
              placeholder="B"
              className="w-1/2 rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-ink outline-none focus:border-accent"
            />
          </div>
          {err && <p className="text-xs text-red-400">{err}</p>}
          <Button size="sm" onClick={submit} loading={saving} fullWidth>
            Submit result
          </Button>
        </div>
      )}
    </div>
  );
}

export default function TournamentDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [tournament, setTournament] = useState<TournamentDetailType | null>(null);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [myTeams, setMyTeams] = useState<TeamSummary[]>([]);
  const [selectedTeam, setSelectedTeam] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const [{ data: tData }, standingsRes] = await Promise.all([
        api.get(`/tournaments/${id}`),
        api.get(`/tournaments/${id}/standings`).catch(() => ({ data: { standings: [] } })),
      ]);
      setTournament(tData.tournament);
      setStandings(standingsRes.data.standings ?? []);
    } catch (err) {
      setError(apiError(err, "Could not load this tournament."));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!user || !tournament) return;
    api
      .get("/my/teams")
      .then(({ data }) => {
        const owned = (data.teams ?? []).filter(
          (t: TeamSummary) => t.owner?.id === user.id && t.sport === tournament.sport
        );
        setMyTeams(owned);
      })
      .catch(() => {});
  }, [user, tournament]);

  const matchesByRound = useMemo(() => {
    if (!tournament) return [] as [number, TournamentMatch[]][];
    const map = new Map<number, TournamentMatch[]>();
    for (const m of tournament.matches ?? []) {
      if (!map.has(m.round)) map.set(m.round, []);
      map.get(m.round)!.push(m);
    }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [tournament]);

  async function registerTeam() {
    if (!selectedTeam || !id) return;
    setActionError("");
    setBusy(true);
    try {
      await api.post(`/tournaments/${id}/register-team`, { teamId: selectedTeam });
      await load();
      setSelectedTeam("");
    } catch (err) {
      setActionError(apiError(err, "Could not register your team."));
    } finally {
      setBusy(false);
    }
  }

  async function startTournament() {
    if (!id) return;
    setActionError("");
    setBusy(true);
    try {
      await api.post(`/tournaments/${id}/start`);
      await load();
    } catch (err) {
      setActionError(apiError(err, "Could not start the tournament."));
    } finally {
      setBusy(false);
    }
  }

  async function submitScore(matchId: string, scoreA: number, scoreB: number, winnerTeamId: string) {
    await api.patch(`/tournaments/${id}/matches/${matchId}`, { scoreA, scoreB, winnerTeamId });
    await load();
  }

  if (loading) return <Loading label="Loading tournament..." />;
  if (error || !tournament) return <ErrorState message={error || "Tournament not found."} onRetry={load} />;

  const sport = getSportBySlug(tournament.sport);
  const isOrganizer = user && tournament.organizer?.id === user.id;
  const alreadyRegisteredTeamIds = new Set(tournament.teams?.map((t) => t.id));
  const registrableTeams = myTeams.filter((t) => !alreadyRegisteredTeamIds.has(t.id));
  const isFull = tournament.teamsCount >= tournament.maxTeams;

  return (
    <main className="flex-1 py-16">
      <div className="container-x">
        <Reveal>
          <div className="glass rounded-3xl p-8">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div className="flex items-center gap-4">
                <div
                  className="flex h-16 w-16 items-center justify-center rounded-2xl text-3xl"
                  style={{ background: `${sport?.color ?? "#3a82ff"}22` }}
                >
                  {sport?.emoji ?? <Trophy className="h-7 w-7 text-accent" />}
                </div>
                <div>
                  <span className="eyebrow">{sport?.name ?? tournament.sport}</span>
                  <h1 className="mt-2 font-display text-3xl font-bold text-ink md:text-4xl">{tournament.name}</h1>
                  <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-ink-muted">
                    <StatusBadge status={tournament.status} />
                    <span className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" /> {tournament.teamsCount}/{tournament.maxTeams} teams
                    </span>
                    <span className="flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5" /> {new Date(tournament.startDate).toLocaleDateString()}
                    </span>
                    <span>by {tournament.organizer?.name}</span>
                  </div>
                </div>
              </div>

              {isOrganizer && tournament.status === "upcoming" && (
                <Button
                  onClick={startTournament}
                  loading={busy}
                  disabled={tournament.teamsCount < 2}
                  icon={<Play className="h-4 w-4" />}
                >
                  Start tournament
                </Button>
              )}
            </div>

            {tournament.description && (
              <p className="mt-6 max-w-2xl text-sm leading-relaxed text-ink-muted">{tournament.description}</p>
            )}

            {!isOrganizer && tournament.status === "upcoming" && !isFull && (
              <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-border pt-6">
                {!user ? (
                  <Link to="/login" state={{ from: `/tournaments/${id}` }} className="text-sm font-semibold text-accent hover:underline">
                    Log in to register your team
                  </Link>
                ) : registrableTeams.length > 0 ? (
                  <>
                    <Select value={selectedTeam} onChange={(e) => setSelectedTeam(e.target.value)} className="sm:w-64">
                      <option value="">Select your team</option>
                      {registrableTeams.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </Select>
                    <Button onClick={registerTeam} disabled={!selectedTeam} loading={busy}>
                      Register team
                    </Button>
                  </>
                ) : (
                  <p className="text-sm text-ink-faint">
                    You don't have a {sport?.name ?? tournament.sport} team to register.{" "}
                    <Link to="/teams/create" className="text-accent hover:underline">
                      Create one
                    </Link>
                  </p>
                )}
              </div>
            )}
            {actionError && <p className="mt-3 text-sm text-red-400">{actionError}</p>}
          </div>
        </Reveal>

        <Reveal delay={0.08} className="mt-10">
          <h2 className="font-display text-xl font-semibold text-ink">Registered teams</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {tournament.teams?.length ? (
              tournament.teams.map((t) => (
                <Link
                  key={t.id}
                  to={`/teams/${t.id}`}
                  className="glass flex items-center gap-2.5 rounded-xl p-3 hover:border-accent/40"
                >
                  {t.logo ? (
                    <img src={t.logo} alt={t.name} className="h-8 w-8 rounded-lg object-cover" />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-2 text-ink-faint">
                      <Shield className="h-4 w-4" />
                    </div>
                  )}
                  <span className="truncate text-sm text-ink">{t.name}</span>
                </Link>
              ))
            ) : (
              <p className="text-sm text-ink-muted">No teams registered yet.</p>
            )}
          </div>
        </Reveal>

        {matchesByRound.length > 0 && (
          <Reveal delay={0.14} className="mt-10">
            <h2 className="font-display text-xl font-semibold text-ink">Bracket</h2>
            <div className="mt-4 flex gap-5 overflow-x-auto pb-4">
              {matchesByRound.map(([round, matches]) => (
                <div key={round} className="flex shrink-0 flex-col gap-4">
                  <span className="text-xs font-semibold uppercase tracking-widest text-ink-faint">
                    {matches.length === 1 ? "Final" : `Round ${round}`}
                  </span>
                  <div className="flex flex-col justify-around gap-4">
                    {matches.map((m) => (
                      <MatchCard key={m.id} match={m} isOrganizer={!!isOrganizer} onSubmitScore={submitScore} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Reveal>
        )}

        {standings.length > 0 && (
          <Reveal delay={0.2} className="mt-10">
            <h2 className="font-display text-xl font-semibold text-ink">Standings</h2>
            <div className="glass mt-4 overflow-hidden rounded-2xl">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-widest text-ink-faint">
                    <th className="px-5 py-3">Team</th>
                    <th className="px-5 py-3">Wins</th>
                    <th className="px-5 py-3">Losses</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((s) => (
                    <tr key={s.team.id} className="border-b border-border last:border-0">
                      <td className="px-5 py-3 font-medium text-ink">{s.team.name}</td>
                      <td className="px-5 py-3 text-emerald-400">{s.wins}</td>
                      <td className="px-5 py-3 text-red-400">{s.losses}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Reveal>
        )}
      </div>
    </main>
  );
}

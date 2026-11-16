import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Play, Shield, Trophy } from "lucide-react";
import api, { assetUrl } from "@/api/axios";
import { useAuth } from "@/context/AuthContext";
import type { TeamSummary, TournamentDetail as TournamentDetailType, TournamentMatch } from "@/types";
import { apiError } from "@/types";
import { getSportBySlug } from "@/data/sports";
import { Loading, ErrorState } from "@/components/ui/StateBlock";
import Button, { buttonClass } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import { StatusBadge } from "@/components/ui/Badge";
import PageHero from "@/components/page/PageHero";
import { FormError } from "@/components/page/AuthShell";

interface Standing {
  team: TeamSummary;
  wins: number;
  losses: number;
}

const scoreInput =
  "num h-10 w-full rounded-lg border border-border bg-base-2 px-3 text-center text-sm text-ink outline-none transition-[border-color,box-shadow] focus:border-accent focus:ring-4 focus:ring-accent/15";

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
    <div className="panel w-72 shrink-0 overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5 text-xs text-ink-faint">
        <span>Round {match.round}</span>
        <StatusBadge status={match.status} />
      </div>
      <div className="divide-y divide-border">
        {[
          { team: match.teamA, score: match.scoreA },
          { team: match.teamB, score: match.scoreB },
        ].map((slot, i) => {
          const isWinner = match.winner && slot.team && match.winner.id === slot.team.id;
          return (
            <div
              key={i}
              className={`flex items-center justify-between gap-3 px-4 py-3 text-sm ${
                isWinner ? "bg-accent-soft font-semibold text-ink" : "text-ink-muted"
              }`}
            >
              <span className="flex min-w-0 items-center gap-2">
                {isWinner && <Trophy className="h-3.5 w-3.5 shrink-0 text-premium" />}
                <span className={`truncate ${slot.team ? "" : "italic text-ink-faint"}`}>{slot.team?.name ?? "TBD"}</span>
              </span>
              {slot.score !== null && slot.score !== undefined && (
                <span className={`num font-display text-xl font-bold ${isWinner ? "text-accent" : "text-ink"}`}>
                  {slot.score}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {canEnter && (
        <div className="flex flex-col gap-2 border-t border-border bg-base-2 p-3">
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              value={scoreA}
              onChange={(e) => setScoreA(e.target.value)}
              placeholder="A"
              aria-label={`Score for ${match.teamA?.name ?? "team A"}`}
              className={scoreInput}
            />
            <input
              type="number"
              value={scoreB}
              onChange={(e) => setScoreB(e.target.value)}
              placeholder="B"
              aria-label={`Score for ${match.teamB?.name ?? "team B"}`}
              className={scoreInput}
            />
          </div>
          {err && <p className="text-xs text-danger">{err}</p>}
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

  if (loading) return <Loading label="Loading tournament…" />;
  if (error || !tournament) return <ErrorState message={error || "Tournament not found."} onRetry={load} />;

  const sport = getSportBySlug(tournament.sport);
  const isOrganizer = user && tournament.organizer?.id === user.id;
  const alreadyRegisteredTeamIds = new Set(tournament.teams?.map((t) => t.id));
  const registrableTeams = myTeams.filter((t) => !alreadyRegisteredTeamIds.has(t.id));
  const isFull = tournament.teamsCount >= tournament.maxTeams;
  const start = new Date(tournament.startDate);
  const showRegister = !isOrganizer && tournament.status === "upcoming" && !isFull;

  return (
    <main className="flex-1">
      <PageHero
        size="lg"
        image={sport?.image}
        above={
          <Link to="/tournaments" className="inline-flex items-center gap-1.5 hover:text-ink">
            <ArrowLeft className="h-4 w-4" /> All tournaments
          </Link>
        }
        title={tournament.name}
        lead={tournament.description || undefined}
        actions={
          isOrganizer && tournament.status === "upcoming" ? (
            <Button
              size="lg"
              onClick={startTournament}
              loading={busy}
              disabled={tournament.teamsCount < 2}
              icon={<Play className="h-4 w-4" />}
            >
              Start tournament
            </Button>
          ) : undefined
        }
      >
        <dl className="grid grid-cols-2 gap-x-8 gap-y-4 border-t border-border pt-6 sm:flex sm:flex-wrap sm:gap-x-12">
          <div>
            <dt className="text-sm text-ink-faint">Status</dt>
            <dd className="mt-1.5">
              <StatusBadge status={tournament.status} />
            </dd>
          </div>
          <div>
            <dt className="text-sm text-ink-faint">Sport</dt>
            <dd className="mt-1 font-semibold text-ink">{sport?.name ?? tournament.sport}</dd>
          </div>
          <div>
            <dt className="text-sm text-ink-faint">Starts</dt>
            <dd className="num mt-1 font-semibold text-ink">
              {start.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-ink-faint">Teams</dt>
            <dd className="num mt-1 font-semibold text-ink">
              {tournament.teamsCount} <span className="text-ink-faint">of {tournament.maxTeams}</span>
            </dd>
          </div>
          <div>
            <dt className="text-sm text-ink-faint">Organizer</dt>
            <dd className="mt-1 font-semibold text-ink">{tournament.organizer?.name}</dd>
          </div>
        </dl>
      </PageHero>

      <div className="container-x flex flex-col gap-14 py-12 md:py-16">
        {(showRegister || actionError) && (
          <section className="panel flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
            {showRegister && (
              <>
                <div>
                  <h2 className="font-display text-2xl font-bold text-ink">Enter your team</h2>
                  <p className="mt-1 text-sm text-ink-muted">
                    <span className="num">{tournament.maxTeams - tournament.teamsCount}</span> places left.
                  </p>
                </div>
                {!user ? (
                  <Link
                    to="/login"
                    state={{ from: `/tournaments/${id}` }}
                    className={buttonClass({ variant: "secondary" })}
                  >
                    Log in to register your team
                  </Link>
                ) : registrableTeams.length > 0 ? (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <Select
                      value={selectedTeam}
                      onChange={(e) => setSelectedTeam(e.target.value)}
                      aria-label="Your team"
                      className="sm:w-64"
                    >
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
                  </div>
                ) : (
                  <p className="text-sm text-ink-muted">
                    You don’t have a {sport?.name ?? tournament.sport} team to register.{" "}
                    <Link to="/teams/create" className="font-semibold text-accent hover:underline">
                      Create one
                    </Link>
                  </p>
                )}
              </>
            )}
            {actionError && (
              <div className="md:basis-full">
                <FormError>{actionError}</FormError>
              </div>
            )}
          </section>
        )}

        {matchesByRound.length > 0 && (
          <section>
            <h2 className="font-display text-3xl font-bold text-ink">Bracket</h2>
            <div className="-mx-4 mt-6 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0">
              <div className="flex w-max gap-8">
                {matchesByRound.map(([round, matches]) => (
                  <div key={round} className="flex flex-col gap-4">
                    <span className="flex items-center gap-2 text-sm font-semibold text-ink-muted">
                      {matches.length === 1 && <Trophy className="h-4 w-4 text-premium" />}
                      {matches.length === 1 ? "Final" : `Round ${round}`}
                    </span>
                    <div className="flex flex-1 flex-col justify-around gap-5">
                      {matches.map((m) => (
                        <MatchCard key={m.id} match={m} isOrganizer={!!isOrganizer} onSubmitScore={submitScore} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        <div className={`grid gap-10 ${standings.length > 0 ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" : ""}`}>
          <section>
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-3xl font-bold text-ink">Registered teams</h2>
              <span className="num text-sm text-ink-faint">
                {tournament.teams?.length ?? 0}/{tournament.maxTeams}
              </span>
            </div>
            <ul className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(min(100%,13rem),1fr))] gap-3">
              {tournament.teams?.length ? (
                tournament.teams.map((t) => (
                  <li key={t.id}>
                    <Link
                      to={`/teams/${t.id}`}
                      className="panel card-lift flex items-center gap-3 p-3"
                    >
                      {t.logo ? (
                        <img src={assetUrl(t.logo)} alt="" className="h-10 w-10 rounded-lg object-cover" />
                      ) : (
                        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-2 text-ink-faint">
                          <Shield className="h-4 w-4" />
                        </span>
                      )}
                      <span className="truncate text-sm font-semibold text-ink">{t.name}</span>
                    </Link>
                  </li>
                ))
              ) : (
                <li className="text-sm text-ink-muted">No teams registered yet.</li>
              )}
            </ul>
          </section>

          {standings.length > 0 && (
            <section>
              <h2 className="font-display text-3xl font-bold text-ink">Standings</h2>
              <div className="panel mt-6 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs font-medium text-ink-faint">
                      <th scope="col" className="w-12 px-5 py-3.5">#</th>
                      <th scope="col" className="px-5 py-3.5">Team</th>
                      <th scope="col" className="px-5 py-3.5 text-right">Wins</th>
                      <th scope="col" className="px-5 py-3.5 text-right">Losses</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standings.map((s, i) => (
                      <tr key={s.team.id} className="border-b border-border last:border-0">
                        <td className="num px-5 py-3.5 font-display text-lg font-bold text-ink-faint">{i + 1}</td>
                        <td className="px-5 py-3.5 font-semibold text-ink">{s.team.name}</td>
                        <td className="num px-5 py-3.5 text-right text-success">{s.wins}</td>
                        <td className="num px-5 py-3.5 text-right text-danger">{s.losses}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}

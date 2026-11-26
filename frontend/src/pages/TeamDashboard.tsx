import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowUpRight, Check, Crown, Mail, Plus, Trash2, UserMinus, X } from "lucide-react";
import api, { assetUrl } from "@/api/axios";
import { compressImage } from "@/api/images";
import { useAuth } from "@/context/AuthContext";
import type { TeamDetail, TeamSummary, TeamRole } from "@/types";
import { apiError, TEAM_ROLE_LABEL, teamPath } from "@/types";
import { getSportBySlug } from "@/data/sports";
import { PROVINCES } from "@/data/provinces";
import { districtOptions } from "@/data/locations";
import { Loading, ErrorState, EmptyState } from "@/components/ui/StateBlock";
import Button, { buttonClass } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Field";
import SportMark, { Initials } from "@/components/ui/SportMark";
import { FormError } from "@/components/page/AuthShell";

type Tab = "roster" | "requests" | "invite" | "edit" | "invitations";

const iconBtn = "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-40";

interface MyInvitation {
  team: TeamSummary;
  invitedBy: { id: string; name: string } | null;
  invitedAt: string | null;
}

function Avatar({ name, photo }: { name: string; photo?: string | null }) {
  return photo ? <img src={assetUrl(photo)} alt="" className="h-10 w-10 rounded-full object-cover" /> : <Initials name={name} className="h-10 w-10 rounded-full text-sm" />;
}

function MyInvitations({ onChange }: { onChange: () => void }) {
  const [rows, setRows] = useState<MyInvitation[] | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(() => {
    api
      .get("/my/invitations")
      .then(({ data }) => setRows(data.invitations))
      .catch((err) => setError(apiError(err)));
  }, []);
  useEffect(load, [load]);

  async function respond(teamId: string, action: "accept" | "decline") {
    setError("");
    try {
      await api.post(`/teams/${teamId}/invitations/respond`, { action });
      load();
      onChange();
    } catch (err) {
      setError(apiError(err));
    }
  }

  if (!rows) return <Loading />;
  return (
    <div className="flex flex-col gap-4">
      {error && <FormError>{error}</FormError>}
      {rows.length === 0 ? (
        <EmptyState title="No invitations" message="When a captain invites you to their team, it shows up here." />
      ) : (
        <ul className="panel divide-y divide-border">
          {rows.map((r) => (
            <li key={r.team.id} className="flex flex-wrap items-center gap-4 p-4">
              {r.team.logo ? <img src={assetUrl(r.team.logo)} alt="" className="h-12 w-12 rounded-xl object-cover" /> : <SportMark slug={r.team.sport} size="md" />}
              <span className="min-w-0 flex-1">
                <Link to={teamPath(r.team)} className="block truncate font-semibold text-ink hover:text-accent">
                  {r.team.name}
                </Link>
                <span className="block text-sm text-ink-faint">
                  {getSportBySlug(r.team.sport)?.name ?? r.team.sport}
                  {r.invitedBy ? `, invited by ${r.invitedBy.name}` : ""}
                </span>
              </span>
              <span className="flex gap-2">
                <Button size="sm" onClick={() => respond(r.team.id, "accept")} icon={<Check className="h-4 w-4" />}>
                  Join
                </Button>
                <Button size="sm" variant="secondary" onClick={() => respond(r.team.id, "decline")}>
                  Decline
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EditTeam({ team, onSaved }: { team: TeamDetail; onSaved: (t: TeamDetail) => void }) {
  const [form, setForm] = useState({
    name: team.name,
    description: team.description ?? "",
    province: team.province ?? "",
    district: team.district ?? "",
    municipality: team.municipality ?? "",
  });
  const [logo, setLogo] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const body = new FormData();
      for (const [k, v] of Object.entries(form)) body.append(k, v);
      if (logo) body.append("logo", await compressImage(logo));
      if (cover) body.append("cover", await compressImage(cover));
      const { data } = await api.patch(`/teams/${team.id}`, body);
      onSaved(data.team);
      setMsg({ kind: "ok", text: "Team saved." });
    } catch (err) {
      setMsg({ kind: "error", text: apiError(err) });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Delete ${team.name}? This can’t be undone.`)) return;
    try {
      await api.delete(`/teams/${team.id}`);
      window.location.href = "/team-dashboard";
    } catch (err) {
      setMsg({ kind: "error", text: apiError(err) });
    }
  }

  return (
    <form onSubmit={save} className="flex max-w-2xl flex-col gap-5">
      <Input id="tname" label="Team name" required minLength={2} maxLength={60} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} hint="Team names are unique across The Arena." />
      <Textarea id="tdesc" label="About the team" maxLength={1000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      <div className="grid gap-5 sm:grid-cols-3">
        <Select id="tprov" label="Province" value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value, district: "" })}>
          <option value="">Not set</option>
          {PROVINCES.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </Select>
        <Select id="tdist" label="District" value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })}>
          <option value="">Not set</option>
          {districtOptions(form.province || undefined).map((d) => (
            <option key={d.value}>{d.value}</option>
          ))}
        </Select>
        <Input id="tmun" label="Municipality" maxLength={80} value={form.municipality} onChange={(e) => setForm({ ...form, municipality: e.target.value })} />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm text-ink-muted">
          New logo
          <input type="file" accept="image/*" onChange={(e) => setLogo(e.target.files?.[0] ?? null)} />
        </label>
        <label className="flex flex-col gap-2 text-sm text-ink-muted">
          New cover photo
          <input type="file" accept="image/*" onChange={(e) => setCover(e.target.files?.[0] ?? null)} />
        </label>
      </div>
      {msg && (msg.kind === "error" ? <FormError>{msg.text}</FormError> : <p className="text-sm text-success">{msg.text}</p>)}
      <div className="flex flex-wrap justify-between gap-3">
        <Button type="submit" loading={busy}>
          Save changes
        </Button>
        <Button type="button" variant="danger" icon={<Trash2 className="h-4 w-4" />} onClick={remove}>
          Delete team
        </Button>
      </div>
    </form>
  );
}

export default function TeamDashboard() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [team, setTeam] = useState<TeamDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [inviteName, setInviteName] = useState("");

  const managed = teams.filter((t) => t.role === "owner" || t.role === "captain");
  const selectedId = params.get("team") ?? managed[0]?.id ?? "";
  const tab = (params.get("tab") as Tab) || (managed.length ? "roster" : "invitations");

  const loadTeams = useCallback(async () => {
    try {
      const { data } = await api.get("/my/teams");
      setTeams(data.teams ?? []);
    } catch (err) {
      setError(apiError(err, "Could not load your teams."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) loadTeams();
  }, [user, loadTeams]);

  useEffect(() => {
    if (!selectedId || tab === "invitations") return;
    api
      .get(`/teams/${selectedId}`)
      .then(({ data }) => setTeam(data.team))
      .catch((err) => setActionError(apiError(err)));
  }, [selectedId, tab]);

  function go(next: Partial<{ team: string; tab: Tab }>) {
    const p = new URLSearchParams(params);
    if (next.team) p.set("team", next.team);
    if (next.tab) p.set("tab", next.tab);
    setParams(p);
  }

  async function act(key: string, fn: () => Promise<{ data: { team?: TeamDetail } }>) {
    setActionError("");
    setBusy(key);
    try {
      const { data } = await fn();
      if (data.team) setTeam(data.team);
      loadTeams();
    } catch (err) {
      setActionError(apiError(err));
    } finally {
      setBusy(null);
    }
  }

  if (!user) return null;
  if (loading) return <Loading label="Loading your teams…" />;
  if (error) return <ErrorState message={error} onRetry={loadTeams} />;

  const isOwner = team?.viewerRole === "owner";
  const tabs: { key: Tab; label: string; count?: number; ownerOnly?: boolean }[] = [
    { key: "roster", label: "Roster & roles" },
    { key: "requests", label: "Join requests", count: team?.pendingRequests?.length },
    { key: "invite", label: "Invite players", count: team?.invitations?.length },
    { key: "edit", label: "Team settings", ownerOnly: true },
  ];

  return (
    <main className="flex-1">
      <section className="border-b border-border bg-base-2">
        <div className="container-x flex flex-col gap-6 py-10 md:flex-row md:items-end md:justify-between md:py-14">
          <div>
            <h1 className="font-display text-4xl font-bold text-ink md:text-5xl">Team dashboard</h1>
            <p className="mt-2 text-ink-muted">Run your roster, answer requests and invite players.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {managed.length > 0 && (
              <select
                aria-label="Team"
                className="h-11 rounded-full border border-border bg-surface px-4 text-sm text-ink"
                value={selectedId}
                onChange={(e) => go({ team: e.target.value, tab: "roster" })}
              >
                {managed.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({TEAM_ROLE_LABEL[t.role as TeamRole]})
                  </option>
                ))}
              </select>
            )}
            <Link to="/teams/create" className={buttonClass({ variant: "secondary" })}>
              <Plus className="h-4 w-4" /> New team
            </Link>
          </div>
        </div>
      </section>

      <div className="container-x py-10">
        <nav className="mb-8 flex gap-1 overflow-x-auto border-b border-border" aria-label="Sections">
          {[...(managed.length ? tabs.filter((t) => !t.ownerOnly || isOwner) : []), { key: "invitations" as Tab, label: "My invitations" }].map((t) => (
            <button
              key={t.key}
              onClick={() => go({ tab: t.key })}
              aria-current={tab === t.key ? "page" : undefined}
              className={`-mb-px shrink-0 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
                tab === t.key ? "border-accent text-ink" : "border-transparent text-ink-muted hover:text-ink"
              }`}
            >
              {t.label}
              {"count" in t && !!t.count && <span className="num ml-2 rounded-full bg-accent px-1.5 py-0.5 text-[11px] text-white">{t.count}</span>}
            </button>
          ))}
        </nav>

        {actionError && (
          <div className="mb-6">
            <FormError>{actionError}</FormError>
          </div>
        )}

        {tab === "invitations" && <MyInvitations onChange={loadTeams} />}

        {tab !== "invitations" && managed.length === 0 && (
          <EmptyState
            title="You don’t run a team yet"
            message="Create a team, or ask your team’s owner to make you captain."
            action={
              <Link to="/teams/create" className={buttonClass({ size: "sm", className: "mt-2" })}>
                Create a team
              </Link>
            }
          />
        )}

        {tab !== "invitations" && managed.length > 0 && !team && <Loading />}

        {tab !== "invitations" && team && (
          <>
            <div className="mb-8 flex items-center gap-4">
              {team.logo ? <img src={assetUrl(team.logo)} alt="" className="h-14 w-14 rounded-xl object-cover" /> : <SportMark slug={team.sport} size="md" />}
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-2xl font-bold text-ink">{team.name}</p>
                <p className="text-sm text-ink-faint">
                  {getSportBySlug(team.sport)?.name ?? team.sport}, <span className="num">{team.memberCount}</span> members
                </p>
              </div>
              <Link to={teamPath(team)} className="inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline">
                Public page <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {tab === "roster" && (
              <ul className="panel divide-y divide-border">
                {team.members.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center gap-4 p-4">
                    <Avatar name={m.name} photo={m.photo} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-ink">{m.name}</span>
                      <span className="block text-xs text-ink-faint">{m.role === "owner" && m.isCaptain ? "Owner · Captain" : TEAM_ROLE_LABEL[m.role ?? "player"]}</span>
                    </span>
                    {isOwner && (
                      <span className="flex flex-wrap items-center gap-2">
                        <select
                          aria-label={`Role for ${m.name}`}
                          className="h-9 rounded-full border border-border bg-surface px-3 text-sm"
                          value={m.isCaptain ? "captain" : m.isViceCaptain ? "vice_captain" : "player"}
                          disabled={busy === m.id}
                          onChange={(e) => act(m.id, () => api.patch(`/teams/${team.id}/members/${m.id}/role`, { role: e.target.value }))}
                        >
                          <option value="player">Player</option>
                          <option value="captain">Captain</option>
                          <option value="vice_captain">Vice-captain</option>
                        </select>
                        {m.role !== "owner" && (
                          <>
                            <button
                              title="Make owner"
                              aria-label={`Make ${m.name} the owner`}
                              className={`${iconBtn} text-premium hover:bg-premium-soft`}
                              onClick={() => {
                                if (window.confirm(`Make ${m.name} the owner of ${team.name}? You’ll stay on the team as a player.`)) {
                                  act(`own-${m.id}`, () => api.post(`/teams/${team.id}/transfer-ownership`, { userId: m.id }));
                                }
                              }}
                            >
                              <Crown className="h-4 w-4" />
                            </button>
                            <button
                              aria-label={`Remove ${m.name}`}
                              className={`${iconBtn} text-ink-faint hover:bg-danger/10 hover:text-danger`}
                              disabled={busy === `rm-${m.id}`}
                              onClick={() => {
                                if (window.confirm(`Remove ${m.name} from the team?`)) act(`rm-${m.id}`, () => api.delete(`/teams/${team.id}/members/${m.id}`));
                              }}
                            >
                              <UserMinus className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {tab === "requests" &&
              (team.pendingRequests?.length ? (
                <ul className="panel divide-y divide-border">
                  {team.pendingRequests.map((r) => (
                    <li key={r.id} className="flex items-center gap-4 p-4">
                      <Avatar name={r.name} photo={r.photo} />
                      <Link to={`/players/${r.username || r.id}`} className="min-w-0 flex-1 truncate font-semibold text-ink hover:text-accent">
                        {r.name}
                      </Link>
                      <button aria-label="Accept" disabled={busy === r.id} className={`${iconBtn} bg-success/10 text-success hover:bg-success/20`} onClick={() => act(r.id, () => api.patch(`/teams/${team.id}/join-requests/${r.id}`, { action: "accept" }))}>
                        <Check className="h-4 w-4" />
                      </button>
                      <button aria-label="Reject" disabled={busy === r.id} className={`${iconBtn} bg-danger/10 text-danger hover:bg-danger/20`} onClick={() => act(r.id, () => api.patch(`/teams/${team.id}/join-requests/${r.id}`, { action: "reject" }))}>
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title="No join requests" message="Players who ask to join appear here." />
              ))}

            {tab === "invite" && (
              <div className="grid gap-8 lg:grid-cols-2">
                <form
                  className="panel flex flex-col gap-4 p-5"
                  onSubmit={(e) => {
                    e.preventDefault();
                    act("invite", () => api.post(`/teams/${team.id}/invitations`, { username: inviteName })).then(() => setInviteName(""));
                  }}
                >
                  <h2 className="font-display text-xl font-semibold text-ink">Invite by username</h2>
                  <Input id="invite" placeholder="@username" required value={inviteName} onChange={(e) => setInviteName(e.target.value)} hint="They get a notification and can accept from their team dashboard." />
                  <Button type="submit" loading={busy === "invite"} icon={<Mail className="h-4 w-4" />} className="self-start">
                    Send invitation
                  </Button>
                  <p className="text-sm text-ink-faint">
                    Looking for players?{" "}
                    <Link to={`/players?sport=${team.sport}${team.district ? `&district=${encodeURIComponent(team.district)}` : ""}`} className="text-accent hover:underline">
                      Browse {getSportBySlug(team.sport)?.name ?? team.sport} players near you
                    </Link>
                  </p>
                </form>
                <section>
                  <h2 className="font-display text-xl font-semibold text-ink">Pending invitations</h2>
                  {team.invitations?.length ? (
                    <ul className="panel mt-4 divide-y divide-border">
                      {team.invitations.map((i) => (
                        <li key={i.id} className="flex items-center gap-4 p-4">
                          <Avatar name={i.name ?? "?"} photo={i.photo} />
                          <span className="min-w-0 flex-1 truncate font-medium text-ink">{i.name}</span>
                          <Button size="sm" variant="ghost" onClick={() => act(`inv-${i.id}`, () => api.delete(`/teams/${team.id}/invitations/${i.id}`))}>
                            Cancel
                          </Button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-4 text-sm text-ink-faint">No invitations waiting.</p>
                  )}
                </section>
              </div>
            )}

            {tab === "edit" && isOwner && <EditTeam team={team} onSaved={(t) => { setTeam(t); loadTeams(); }} />}
          </>
        )}
      </div>
    </main>
  );
}

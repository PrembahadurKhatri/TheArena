import { useState } from "react";
import api from "@/api/axios";
import { apiError, teamPath } from "@/types";
import type { TeamSummary } from "@/types";
import { useApi } from "@/hooks/useApi";
import Button from "@/components/ui/Button";
import { Loading, ErrorState } from "@/components/ui/StateBlock";
import { getSportBySlug } from "@/data/sports";
import { AdminHeader, Banner, Pager, Pill, Table, smallInput, statusTone } from "./adminUi";

export default function AdminTeams() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState({ search: "", status: "", page: 1 });
  const list = useApi<{ teams: TeamSummary[]; total: number; pages: number }>("/admin/teams", query);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  async function act(team: TeamSummary, kind: "suspend" | "reactivate" | "delete") {
    const reason = kind === "reactivate" ? "" : window.prompt(`Reason to ${kind} ${team.name} (shown to the owner):`) ?? "";
    if (kind !== "reactivate" && !reason.trim()) return;
    setMsg(null);
    try {
      if (kind === "delete") await api.delete(`/admin/teams/${team.id}`, { data: { reason } });
      else await api.patch(`/admin/teams/${team.id}/status`, { status: kind === "suspend" ? "suspended" : "active", reason });
      setMsg({ kind: "ok", text: `${team.name}: ${kind === "delete" ? "deleted" : kind === "suspend" ? "suspended" : "reactivated"}.` });
      list.reload();
    } catch (err) {
      setMsg({ kind: "error", text: apiError(err) });
    }
  }

  return (
    <div className="max-w-6xl">
      <AdminHeader title="Teams" lead={list.data ? `${list.data.total} teams` : undefined} />
      <form
        className="mt-5 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery((q) => ({ ...q, search, page: 1 }));
        }}
      >
        <input className={`${smallInput} w-64`} placeholder="Team name" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className={smallInput} value={query.status} onChange={(e) => setQuery((q) => ({ ...q, status: e.target.value, page: 1 }))} aria-label="Status">
          <option value="">Any status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
        <Button size="sm" type="submit">
          Search
        </Button>
      </form>
      {msg && <Banner kind={msg.kind}>{msg.text}</Banner>}
      {list.loading ? (
        <Loading />
      ) : list.error ? (
        <ErrorState message={list.error} />
      ) : (
        <>
          <Table head={["Team", "Sport", "Owner", "Members", "Status", ""]} empty={!list.data?.teams.length}>
            {(list.data?.teams ?? []).map((t) => (
              <tr key={t.id}>
                <td className="px-4 py-3">
                  <a href={teamPath(t)} target="_blank" rel="noreferrer" className="font-semibold text-ink hover:underline">
                    {t.name}
                  </a>
                  {t.district && <span className="block text-xs text-ink-faint">{t.district}</span>}
                </td>
                <td className="px-4 py-3 text-ink-muted">{getSportBySlug(t.sport)?.name ?? t.sport}</td>
                <td className="px-4 py-3 text-ink-muted">{t.owner?.name}</td>
                <td className="num px-4 py-3 text-ink-muted">{t.memberCount}</td>
                <td className="px-4 py-3">
                  <Pill tone={statusTone(t.status ?? "active")}>{t.status ?? "active"}</Pill>
                </td>
                <td className="space-x-1 whitespace-nowrap px-4 py-3 text-right">
                  {t.status === "suspended" ? (
                    <Button size="sm" variant="secondary" onClick={() => act(t, "reactivate")}>
                      Reactivate
                    </Button>
                  ) : (
                    <Button size="sm" variant="secondary" onClick={() => act(t, "suspend")}>
                      Suspend
                    </Button>
                  )}
                  <Button size="sm" variant="danger" onClick={() => act(t, "delete")}>
                    Delete
                  </Button>
                </td>
              </tr>
            ))}
          </Table>
          <Pager page={query.page} pages={list.data?.pages ?? 1} onPage={(page) => setQuery((q) => ({ ...q, page }))} />
        </>
      )}
    </div>
  );
}

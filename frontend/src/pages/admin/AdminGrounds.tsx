import { useState } from "react";
import api from "@/api/axios";
import { apiError } from "@/types";
import { useApi } from "@/hooks/useApi";
import Button from "@/components/ui/Button";
import { Loading } from "@/components/ui/StateBlock";
import { getSportBySlug } from "@/data/sports";
import { AdminHeader, Banner, Pager, Pill, Table, smallInput, statusTone } from "./adminUi";

interface AdminGround {
  id: string;
  name: string;
  slug: string | null;
  sports: string[];
  location: string;
  district: string | null;
  pricePerHour: number;
  status: string;
  images: string[];
  description: string | null;
  owner?: { name: string; email?: string; phone?: string };
  createdAt?: string;
}

export default function AdminGrounds() {
  const [query, setQuery] = useState({ status: "pending", search: "", page: 1 });
  const [search, setSearch] = useState("");
  const list = useApi<{ grounds: AdminGround[]; total: number; pages: number }>("/admin/grounds", query);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  async function review(g: AdminGround, decision: "approve" | "reject" | "suspend" | "reinstate") {
    const note = decision === "reject" || decision === "suspend" ? window.prompt(`Reason to ${decision} ${g.name} (sent to the owner):`) : "";
    if ((decision === "reject" || decision === "suspend") && !note) return;
    setMsg(null);
    try {
      await api.post(`/admin/grounds/${g.id}/review`, { decision, note });
      setMsg({ kind: "ok", text: `${g.name}: ${decision}d.` });
      list.reload();
    } catch (err) {
      setMsg({ kind: "error", text: apiError(err) });
    }
  }

  return (
    <div className="max-w-6xl">
      <AdminHeader
        title="Grounds"
        lead="New listings from owners wait here before they appear in search."
        actions={
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setQuery((q) => ({ ...q, search, page: 1 }));
            }}
          >
            <input className={`${smallInput} w-48`} placeholder="Ground name" value={search} onChange={(e) => setSearch(e.target.value)} />
            <select className={smallInput} value={query.status} onChange={(e) => setQuery((q) => ({ ...q, status: e.target.value, page: 1 }))} aria-label="Status">
              <option value="pending">Waiting for review</option>
              <option value="approved">Live</option>
              <option value="rejected">Rejected</option>
              <option value="suspended">Suspended</option>
              <option value="all">All</option>
            </select>
          </form>
        }
      />
      {msg && <Banner kind={msg.kind}>{msg.text}</Banner>}
      {list.loading ? (
        <Loading />
      ) : (
        <>
          <Table head={["Ground", "Owner", "Sports", "Price", "Status", ""]} empty={!list.data?.grounds.length}>
            {(list.data?.grounds ?? []).map((g) => (
              <tr key={g.id} className="align-top">
                <td className="px-4 py-3">
                  <a href={`/grounds/${g.slug || g.id}`} target="_blank" rel="noreferrer" className="font-semibold text-ink hover:underline">
                    {g.name}
                  </a>
                  <span className="block text-xs text-ink-faint">
                    {g.location}
                    {g.district ? `, ${g.district}` : ""} · {g.images.length} photo(s)
                  </span>
                  {g.description && <span className="mt-1 line-clamp-2 block max-w-sm text-xs text-ink-muted">{g.description}</span>}
                </td>
                <td className="px-4 py-3 text-ink-muted">
                  {g.owner ? (
                    <>
                      {g.owner.name}
                      <span className="block text-xs text-ink-faint">{g.owner.phone ?? g.owner.email}</span>
                    </>
                  ) : (
                    "The Arena"
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-ink-muted">{g.sports.map((s) => getSportBySlug(s)?.name ?? s).join(", ")}</td>
                <td className="num px-4 py-3 text-ink-muted">Rs {g.pricePerHour}</td>
                <td className="px-4 py-3">
                  <Pill tone={statusTone(g.status)}>{g.status}</Pill>
                </td>
                <td className="space-x-1 whitespace-nowrap px-4 py-3 text-right">
                  {g.status === "pending" && (
                    <>
                      <Button size="sm" onClick={() => review(g, "approve")}>
                        Approve
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => review(g, "reject")}>
                        Reject
                      </Button>
                    </>
                  )}
                  {g.status === "approved" && (
                    <Button size="sm" variant="danger" onClick={() => review(g, "suspend")}>
                      Suspend
                    </Button>
                  )}
                  {(g.status === "suspended" || g.status === "rejected") && (
                    <Button size="sm" variant="secondary" onClick={() => review(g, "reinstate")}>
                      Reinstate
                    </Button>
                  )}
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

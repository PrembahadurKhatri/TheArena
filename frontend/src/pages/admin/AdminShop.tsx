import { useState } from "react";
import api, { assetUrl } from "@/api/axios";
import { apiError } from "@/types";
import { useApi } from "@/hooks/useApi";
import Button from "@/components/ui/Button";
import { Loading } from "@/components/ui/StateBlock";
import { AdminHeader, Banner, Pager, Pill, Table, smallInput, statusTone } from "./adminUi";

function useAct(reload: () => void) {
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  async function run(fn: () => Promise<unknown>, ok: string) {
    setMsg(null);
    try {
      await fn();
      setMsg({ kind: "ok", text: ok });
      reload();
    } catch (err) {
      setMsg({ kind: "error", text: apiError(err) });
    }
  }
  return { msg, run };
}

const askReason = (what: string) => window.prompt(`Reason to ${what} (sent to the merchant):`) ?? "";

// ---------------------------------------------------------------- merchants

interface AdminStore {
  id: string;
  name: string;
  slug: string | null;
  status: string;
  district: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  description?: string;
  documents: string[];
  productCount: number;
  owner: { name: string; email: string; phone: string | null } | null;
}

export function AdminMerchants() {
  const [query, setQuery] = useState({ status: "pending", page: 1 });
  const list = useApi<{ stores: AdminStore[]; pages: number }>("/admin/merchants", query);
  const { msg, run } = useAct(list.reload);

  function review(s: AdminStore, decision: string) {
    const note = decision === "reject" || decision === "suspend" ? askReason(decision) : "";
    if ((decision === "reject" || decision === "suspend") && !note) return;
    run(() => api.post(`/admin/merchants/${s.id}/review`, { decision, note }), `${s.name}: done.`);
  }

  return (
    <div className="max-w-6xl">
      <AdminHeader
        title="Merchants"
        lead="New shops wait here. A shop and each of its products are approved separately."
        actions={
          <select className={smallInput} value={query.status} onChange={(e) => setQuery({ status: e.target.value, page: 1 })} aria-label="Status">
            <option value="pending">Applications</option>
            <option value="approved">Open</option>
            <option value="rejected">Rejected</option>
            <option value="suspended">Suspended</option>
            <option value="all">All</option>
          </select>
        }
      />
      {msg && <Banner kind={msg.kind}>{msg.text}</Banner>}
      {list.loading ? (
        <Loading />
      ) : (
        <>
          <Table head={["Shop", "Owner", "Documents", "Status", ""]} empty={!list.data?.stores.length}>
            {(list.data?.stores ?? []).map((s) => (
              <tr key={s.id} className="align-top">
                <td className="px-4 py-3">
                  <span className="font-semibold text-ink">{s.name}</span>
                  <span className="block text-xs text-ink-faint">
                    {[s.address, s.district].filter(Boolean).join(", ")} · {s.productCount} products
                  </span>
                  {s.description && <span className="mt-1 line-clamp-2 block max-w-sm text-xs text-ink-muted">{s.description}</span>}
                </td>
                <td className="px-4 py-3 text-ink-muted">
                  {s.owner?.name}
                  <span className="block text-xs text-ink-faint">{s.phone ?? s.owner?.phone ?? s.email ?? s.owner?.email}</span>
                </td>
                <td className="px-4 py-3">
                  {s.documents.length ? (
                    s.documents.map((d, i) => (
                      <a key={d} href={assetUrl(d)} target="_blank" rel="noreferrer" className="mr-2 text-xs font-semibold text-accent hover:underline">
                        Doc {i + 1}
                      </a>
                    ))
                  ) : (
                    <span className="text-xs text-ink-faint">None</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Pill tone={statusTone(s.status)}>{s.status}</Pill>
                </td>
                <td className="space-x-1 whitespace-nowrap px-4 py-3 text-right">
                  {s.status === "pending" && (
                    <>
                      <Button size="sm" onClick={() => review(s, "approve")}>
                        Approve
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => review(s, "reject")}>
                        Reject
                      </Button>
                    </>
                  )}
                  {s.status === "approved" && (
                    <Button size="sm" variant="danger" onClick={() => review(s, "suspend")}>
                      Suspend
                    </Button>
                  )}
                  {(s.status === "suspended" || s.status === "rejected") && (
                    <Button size="sm" variant="secondary" onClick={() => review(s, "reinstate")}>
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

// ---------------------------------------------------------------- products

interface AdminProduct {
  id: string;
  name: string;
  slug: string | null;
  brand: string | null;
  category: string;
  sport?: string;
  price: number;
  unitPrice: number;
  stock: number;
  images: string[];
  status: string;
  featured: boolean;
  description?: string;
  store: { id: string; name: string };
}

export function AdminProducts() {
  const [query, setQuery] = useState({ status: "pending_review", search: "", page: 1 });
  const [search, setSearch] = useState("");
  const list = useApi<{ products: AdminProduct[]; pages: number }>("/admin/products", query);
  const { msg, run } = useAct(list.reload);

  return (
    <div className="max-w-6xl">
      <AdminHeader
        title="Products"
        lead="Only sports gear is allowed. Approve, reject with a reason, or feature products on the shop home."
        actions={
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setQuery((q) => ({ ...q, search, page: 1 }));
            }}
          >
            <input className={`${smallInput} w-44`} placeholder="Name" value={search} onChange={(e) => setSearch(e.target.value)} />
            <select className={smallInput} value={query.status} onChange={(e) => setQuery((q) => ({ ...q, status: e.target.value, page: 1 }))} aria-label="Status">
              <option value="pending_review">Waiting for review</option>
              <option value="active">On sale</option>
              <option value="rejected">Rejected</option>
              <option value="archived">Archived</option>
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
          <Table head={["Product", "Shop", "Price", "Status", ""]} empty={!list.data?.products.length}>
            {(list.data?.products ?? []).map((p) => (
              <tr key={p.id} className="align-top">
                <td className="px-4 py-3">
                  <span className="flex items-start gap-3">
                    <span className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-surface-2">{p.images[0] && <img src={assetUrl(p.images[0])} alt="" className="h-full w-full object-cover" />}</span>
                    <span>
                      <span className="font-semibold text-ink">{p.name}</span>
                      <span className="block text-xs text-ink-faint">
                        {[p.brand, p.category, p.sport].filter(Boolean).join(" · ")} · stock {p.stock}
                      </span>
                      {p.description && <span className="mt-1 line-clamp-2 block max-w-sm text-xs text-ink-muted">{p.description}</span>}
                    </span>
                  </span>
                </td>
                <td className="px-4 py-3 text-ink-muted">{p.store.name}</td>
                <td className="num px-4 py-3 text-ink-muted">Rs {p.unitPrice}</td>
                <td className="px-4 py-3">
                  <Pill tone={p.status === "active" ? "good" : p.status === "rejected" ? "bad" : p.status === "pending_review" ? "warn" : "neutral"}>{p.status.replace("_", " ")}</Pill>
                  {p.featured && (
                    <span className="ml-1">
                      <Pill tone="accent">featured</Pill>
                    </span>
                  )}
                </td>
                <td className="space-x-1 whitespace-nowrap px-4 py-3 text-right">
                  {p.status === "pending_review" && (
                    <>
                      <Button size="sm" onClick={() => run(() => api.post(`/admin/products/${p.id}/review`, { decision: "approve" }), "Approved.")}>
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          const note = askReason("reject this product");
                          if (note) run(() => api.post(`/admin/products/${p.id}/review`, { decision: "reject", note }), "Rejected.");
                        }}
                      >
                        Reject
                      </Button>
                    </>
                  )}
                  {p.status === "active" && (
                    <Button size="sm" variant="ghost" onClick={() => run(() => api.post(`/admin/products/${p.id}/review`, { featured: !p.featured }), p.featured ? "Unfeatured." : "Featured.")}>
                      {p.featured ? "Unfeature" : "Feature"}
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

// ---------------------------------------------------------------- orders and categories

interface AdminOrder {
  id: string;
  store: { name: string | null } | null;
  buyer?: { name: string };
  subtotal: number;
  paymentMethod: string;
  status: string;
  createdAt: string;
  items: { name: string; quantity: number }[];
}

export function AdminOrders() {
  const [query, setQuery] = useState({ status: "", page: 1 });
  const list = useApi<{ orders: AdminOrder[]; pages: number; total: number }>("/admin/orders", query);
  return (
    <div className="max-w-6xl">
      <AdminHeader
        title="Orders"
        lead={list.data ? `${list.data.total} shop orders (one per shop per checkout)` : undefined}
        actions={
          <select className={smallInput} value={query.status} onChange={(e) => setQuery({ status: e.target.value, page: 1 })} aria-label="Status">
            <option value="">Any status</option>
            {["placed", "confirmed", "processing", "shipped", "delivered", "cancelled", "returned", "pending_payment"].map((s) => (
              <option key={s} value={s}>
                {s.replace("_", " ")}
              </option>
            ))}
          </select>
        }
      />
      {list.loading ? (
        <Loading />
      ) : (
        <>
          <Table head={["Order", "Shop", "Buyer", "Amount", "Status"]} empty={!list.data?.orders.length}>
            {(list.data?.orders ?? []).map((o) => (
              <tr key={o.id}>
                <td className="px-4 py-3">
                  <span className="num font-semibold text-ink">#{o.id.slice(-6).toUpperCase()}</span>
                  <span className="block text-xs text-ink-faint">{o.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")}</span>
                </td>
                <td className="px-4 py-3 text-ink-muted">{o.store?.name}</td>
                <td className="px-4 py-3 text-ink-muted">{o.buyer?.name}</td>
                <td className="num px-4 py-3 text-ink-muted">
                  Rs {o.subtotal} <span className="text-xs">{o.paymentMethod === "cod" ? "COD" : "online"}</span>
                </td>
                <td className="px-4 py-3">
                  <Pill tone={o.status === "delivered" ? "good" : o.status === "cancelled" || o.status === "returned" ? "bad" : "neutral"}>{o.status.replace("_", " ")}</Pill>
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

export function AdminShopCategories() {
  const list = useApi<{ builtIn: string[]; categories: { id: string; name: string; active: boolean }[] }>("/admin/shop-categories");
  const { msg, run } = useAct(list.reload);
  const [name, setName] = useState("");
  return (
    <div className="max-w-3xl">
      <AdminHeader title="Shop categories" lead="Built-in categories always exist. Add sports-related ones as needed; hide a category to stop new products using it." />
      <form
        className="mt-6 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => api.post("/admin/shop-categories", { name }), "Added.").then(() => setName(""));
        }}
      >
        <input className={`${smallInput} w-64`} placeholder="e.g. Swimming Gear" value={name} onChange={(e) => setName(e.target.value)} required />
        <Button size="sm" type="submit">
          Add category
        </Button>
      </form>
      {msg && <Banner kind={msg.kind}>{msg.text}</Banner>}
      <p className="mt-6 text-sm text-ink-faint">Built in: {list.data?.builtIn.join(", ")}</p>
      <Table head={["Category", "Status", ""]} empty={!list.data?.categories.length}>
        {(list.data?.categories ?? []).map((c) => (
          <tr key={c.id}>
            <td className="px-4 py-3 text-ink">{c.name}</td>
            <td className="px-4 py-3">
              <Pill tone={c.active ? "good" : "neutral"}>{c.active ? "Active" : "Hidden"}</Pill>
            </td>
            <td className="px-4 py-3 text-right">
              <Button size="sm" variant="ghost" onClick={() => run(() => api.patch(`/admin/shop-categories/${c.id}`, { active: !c.active }), "Updated.")}>
                {c.active ? "Hide" : "Activate"}
              </Button>
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

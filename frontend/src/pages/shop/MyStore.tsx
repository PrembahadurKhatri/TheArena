import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Package, Plus, Star, Store as StoreIcon, Trash2 } from "lucide-react";
import api, { assetUrl } from "@/api/axios";
import { compressImage } from "@/api/images";
import { apiError } from "@/types";
import type { ProductDetail, ProductVariant } from "@/types";
import { useApi } from "@/hooks/useApi";
import { SPORTS } from "@/data/sports";
import { PROVINCES } from "@/data/provinces";
import { districtOptions } from "@/data/locations";
import { Loading, EmptyState } from "@/components/ui/StateBlock";
import Button from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { StatusBadge } from "@/components/ui/Badge";
import { FormError } from "@/components/page/AuthShell";
import type { SellerOrderRow } from "./MyOrders";

interface MyStoreData {
  id: string;
  name: string;
  slug: string | null;
  description?: string;
  logo: string | null;
  banner: string | null;
  status: string;
  province: string | null;
  district: string | null;
  address: string | null;
  ownerName: string | null;
  email: string | null;
  phone: string | null;
  documents: string[];
  review: { note: string | null } | null;
  rating: { avg: number; count: number };
  products: ProductDetail[];
}

type Tab = "overview" | "products" | "orders" | "reviews" | "profile";

function StoreForm({ store, onSaved }: { store?: MyStoreData; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: store?.name ?? "",
    description: store?.description ?? "",
    ownerName: store?.ownerName ?? "",
    email: store?.email ?? "",
    phone: store?.phone ?? "",
    address: store?.address ?? "",
    province: store?.province ?? "",
    district: store?.district ?? "",
  });
  const [logo, setLogo] = useState<File | null>(null);
  const [banner, setBanner] = useState<File | null>(null);
  const [docs, setDocs] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const body = new FormData();
      for (const [k, v] of Object.entries(form)) body.append(k, v);
      if (logo) body.append("logo", await compressImage(logo));
      if (banner) body.append("banner", await compressImage(banner));
      for (const d of docs) body.append("documents", d.type.startsWith("image/") ? await compressImage(d) : d);
      if (store) await api.patch(`/shop/stores/${store.id}`, body);
      else await api.post("/shop/stores", body);
      setMsg({ kind: "ok", text: store ? "Shop saved." : "Application sent. We’ll review it shortly." });
      onSaved();
    } catch (err) {
      setMsg({ kind: "error", text: apiError(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="panel flex max-w-3xl flex-col gap-5 p-6">
      <h2 className="font-display text-2xl font-bold text-ink">{store ? "Shop profile" : "Apply to sell on The Arena"}</h2>
      {!store && <p className="text-sm text-ink-muted">The Shop sells sports gear only. Our team checks every new shop before it opens.</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Input id="sname" label="Shop name" required maxLength={80} value={form.name} onChange={(e) => set("name")(e.target.value)} />
        <Input id="sowner" label="Owner name" maxLength={100} value={form.ownerName} onChange={(e) => set("ownerName")(e.target.value)} />
        <Input id="semail" label="Business email" type="email" value={form.email} onChange={(e) => set("email")(e.target.value)} />
        <Input id="sphone" label="Phone" value={form.phone} onChange={(e) => set("phone")(e.target.value)} />
        <Select id="sprov" label="Province" value={form.province} onChange={(e) => setForm((f) => ({ ...f, province: e.target.value, district: "" }))}>
          <option value="">Not set</option>
          {PROVINCES.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </Select>
        <Select id="sdist" label="District" value={form.district} onChange={(e) => set("district")(e.target.value)}>
          <option value="">Not set</option>
          {districtOptions(form.province || undefined).map((d) => (
            <option key={d.value}>{d.value}</option>
          ))}
        </Select>
      </div>
      <Input id="saddr" label="Address" maxLength={300} value={form.address} onChange={(e) => set("address")(e.target.value)} />
      <Textarea id="sdesc" label="About the business" maxLength={2000} value={form.description} onChange={(e) => set("description")(e.target.value)} />
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-2 text-sm text-ink-muted">
          Logo
          <input type="file" accept="image/*" onChange={(e) => setLogo(e.target.files?.[0] ?? null)} />
        </label>
        <label className="flex flex-col gap-2 text-sm text-ink-muted">
          Banner
          <input type="file" accept="image/*" onChange={(e) => setBanner(e.target.files?.[0] ?? null)} />
        </label>
        <label className="flex flex-col gap-2 text-sm text-ink-muted">
          Verification documents (PAN, registration)
          <input type="file" accept="image/*" multiple onChange={(e) => setDocs([...(e.target.files ?? [])].slice(0, 3))} />
        </label>
      </div>
      {store?.documents?.length ? <p className="text-xs text-ink-faint">{store.documents.length} document(s) on file. Only you and The Arena’s staff can see them.</p> : null}
      {msg && (msg.kind === "error" ? <FormError>{msg.text}</FormError> : <p className="text-sm text-success">{msg.text}</p>)}
      <Button type="submit" loading={busy} className="self-start">
        {store ? "Save" : "Submit application"}
      </Button>
    </form>
  );
}

function ProductForm({ product, categories, onDone }: { product?: ProductDetail; categories: string[]; onDone: () => void }) {
  const [form, setForm] = useState({
    name: product?.name ?? "",
    description: product?.description ?? "",
    category: product?.category ?? categories[0] ?? "Other",
    sport: product?.sport ?? "",
    brand: product?.brand ?? "",
    sku: product?.sku ?? "",
    price: String(product?.price ?? ""),
    discountPrice: product?.discountPrice != null ? String(product.discountPrice) : "",
    stock: String(product?.stock ?? 0),
  });
  const [variants, setVariants] = useState<Partial<ProductVariant>[]>(product?.variants ?? []);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(asDraft: boolean) {
    setBusy(true);
    setError("");
    try {
      const body = new FormData();
      for (const [k, v] of Object.entries(form)) body.append(k, v);
      body.append("variants", JSON.stringify(variants.map((v) => ({ id: v.id, size: v.size || undefined, color: v.color || undefined, sku: v.sku || undefined, stock: Number(v.stock ?? 0) }))));
      for (const f of files) body.append("images", await compressImage(f));
      if (product) {
        if (product.status === "draft" && !asDraft) body.append("status", "submit");
        await api.patch(`/shop/products/${product.id}`, body);
      } else {
        if (asDraft) body.append("status", "draft");
        await api.post("/shop/products", body);
      }
      onDone();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="panel flex flex-col gap-5 p-6"
      onSubmit={(e) => {
        e.preventDefault();
        submit(false);
      }}
    >
      <h2 className="font-display text-2xl font-bold text-ink">{product ? `Edit ${product.name}` : "Add a product"}</h2>
      {product?.status === "rejected" && product.review?.note && <p className="text-sm text-danger">Not approved: {product.review.note}. Saving sends it for review again.</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Input id="pname" label="Name" required maxLength={120} value={form.name} onChange={(e) => set("name")(e.target.value)} />
        <Input id="pbrand" label="Brand" maxLength={60} value={form.brand} onChange={(e) => set("brand")(e.target.value)} />
        <Select id="pcat" label="Category" value={form.category} onChange={(e) => set("category")(e.target.value)}>
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>
        <Select id="psport" label="Sport" value={form.sport} onChange={(e) => set("sport")(e.target.value)}>
          <option value="">Any sport</option>
          {SPORTS.map((s) => (
            <option key={s.slug} value={s.slug}>
              {s.name}
            </option>
          ))}
        </Select>
        <Input id="pprice" label="Price (NPR)" type="number" min={1} required value={form.price} onChange={(e) => set("price")(e.target.value)} />
        <Input id="pdisc" label="Sale price (optional)" type="number" min={1} value={form.discountPrice} onChange={(e) => set("discountPrice")(e.target.value)} hint="Lower than the price." />
        <Input id="psku" label="SKU" maxLength={60} value={form.sku} onChange={(e) => set("sku")(e.target.value)} />
        {variants.length === 0 && <Input id="pstock" label="Stock" type="number" min={0} required value={form.stock} onChange={(e) => set("stock")(e.target.value)} />}
      </div>
      <Textarea id="pdesc" label="Description" maxLength={2000} value={form.description} onChange={(e) => set("description")(e.target.value)} />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-ink-muted">Sizes / colours (each with its own stock)</legend>
        {variants.map((v, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_1fr_6rem_auto] gap-2">
            {(["size", "color", "sku"] as const).map((k) => (
              <input
                key={k}
                className="h-10 rounded-lg border border-border bg-base-2 px-3 text-sm"
                placeholder={k === "color" ? "Colour" : k.toUpperCase() === "SKU" ? "SKU" : "Size"}
                value={(v[k] as string) ?? ""}
                onChange={(e) => setVariants((list) => list.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)))}
                aria-label={k}
              />
            ))}
            <input
              type="number"
              min={0}
              className="h-10 rounded-lg border border-border bg-base-2 px-3 text-sm"
              value={v.stock ?? 0}
              onChange={(e) => setVariants((list) => list.map((x, j) => (j === i ? { ...x, stock: Number(e.target.value) } : x)))}
              aria-label="Stock"
            />
            <button type="button" aria-label="Remove option" className="text-ink-faint hover:text-danger" onClick={() => setVariants((list) => list.filter((_, j) => j !== i))}>
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        <div>
          <Button type="button" variant="ghost" size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setVariants((list) => [...list, { size: "", color: "", stock: 0 }])}>
            Add a size or colour
          </Button>
        </div>
      </fieldset>
      <label className="flex flex-col gap-2 text-sm text-ink-muted">
        Photos (up to 5{product?.images.length ? "; replaces the current ones" : ""})
        <input type="file" accept="image/*" multiple onChange={(e) => setFiles([...(e.target.files ?? [])].slice(0, 5))} />
      </label>
      {error && <FormError>{error}</FormError>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={busy}>
          {product && product.status !== "draft" ? "Save" : "Submit for review"}
        </Button>
        {(!product || product.status === "draft") && (
          <Button type="button" variant="secondary" loading={busy} onClick={() => submit(true)}>
            Save as draft
          </Button>
        )}
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

interface Sales {
  last30Days: { revenue: number; deliveredOrders: number; byStatus: Record<string, number>; topProducts: { name: string; quantity: number; revenue: number }[] };
  allTime: { revenue: number; deliveredOrders: number };
}

function Overview({ store }: { store: MyStoreData }) {
  const { data } = useApi<Sales>(`/shop/stores/${store.id}/sales`);
  if (!data) return <Loading />;
  const tiles = [
    ["Delivered revenue, 30 days", `Rs ${data.last30Days.revenue}`],
    ["Delivered orders, 30 days", data.last30Days.deliveredOrders],
    ["Waiting to confirm", data.last30Days.byStatus.placed ?? 0],
    ["All-time delivered revenue", `Rs ${data.allTime.revenue}`],
  ];
  return (
    <div className="flex flex-col gap-8">
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map(([k, v]) => (
          <div key={k as string} className="panel p-5">
            <dt className="text-sm text-ink-faint">{k}</dt>
            <dd className="num mt-1 font-display text-3xl font-bold text-ink">{v}</dd>
          </div>
        ))}
      </dl>
      <section>
        <h3 className="font-display text-xl font-semibold text-ink">Best sellers (30 days)</h3>
        {data.last30Days.topProducts.length ? (
          <ul className="panel mt-3 divide-y divide-border">
            {data.last30Days.topProducts.map((t) => (
              <li key={t.name} className="flex justify-between gap-3 px-5 py-3 text-sm">
                <span className="text-ink">{t.name}</span>
                <span className="num text-ink-muted">
                  {t.quantity} sold · Rs {t.revenue}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-ink-faint">No sales yet.</p>
        )}
      </section>
      <p className="text-xs text-ink-faint">Figures are records of delivered orders. Cash on delivery is collected by you; The Arena doesn’t hold or pay out money.</p>
    </div>
  );
}

const NEXT: Record<string, { status: string; label: string }[]> = {
  placed: [{ status: "confirmed", label: "Confirm" }],
  confirmed: [{ status: "processing", label: "Packing" }, { status: "shipped", label: "Shipped" }],
  processing: [{ status: "shipped", label: "Shipped" }],
  shipped: [{ status: "delivered", label: "Delivered" }],
};

function Orders({ store }: { store: MyStoreData }) {
  const [status, setStatus] = useState("");
  const list = useApi<{ orders: SellerOrderRow[] }>(`/shop/stores/${store.id}/orders`, { status });
  const [error, setError] = useState("");

  async function move(o: SellerOrderRow, next: string) {
    const extra: Record<string, string> = {};
    if (next === "shipped") {
      extra.carrier = window.prompt("Courier (optional)") ?? "";
      extra.trackingCode = window.prompt("Tracking code (optional)") ?? "";
    }
    if (next === "cancelled") {
      const note = window.prompt("Why are you cancelling? The buyer will see this.");
      if (!note) return;
      extra.note = note;
    }
    setError("");
    try {
      await api.patch(`/shop/seller-orders/${o.id}/status`, { status: next, ...extra });
      list.reload();
    } catch (err) {
      setError(apiError(err));
    }
  }

  return (
    <div>
      <select className="h-10 rounded-full border border-border bg-surface px-3 text-sm" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
        <option value="">All orders</option>
        {["placed", "confirmed", "processing", "shipped", "delivered", "cancelled", "returned", "pending_payment"].map((s) => (
          <option key={s} value={s}>
            {s.replace("_", " ")}
          </option>
        ))}
      </select>
      {error && (
        <div className="mt-4">
          <FormError>{error}</FormError>
        </div>
      )}
      {list.loading ? (
        <Loading />
      ) : !list.data?.orders.length ? (
        <EmptyState icon={<Package className="h-5 w-5" />} title="No orders here" />
      ) : (
        <ul className="mt-6 flex flex-col gap-4">
          {list.data.orders.map((o) => (
            <li key={o.id} className="panel p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="num font-semibold text-ink">
                    #{o.id.slice(-6).toUpperCase()} · Rs {o.subtotal} · {o.paymentMethod === "cod" ? "collect cash" : "paid online"}
                  </p>
                  <p className="text-sm text-ink-faint">
                    {o.buyer?.name} · {o.shipping?.contactPhone} · {new Date(o.createdAt).toLocaleString()}
                  </p>
                  <p className="text-sm text-ink-faint">{o.shipping?.address}</p>
                </div>
                <StatusBadge status={o.status} />
              </div>
              <ul className="mt-3 text-sm text-ink-muted">
                {o.items.map((i, k) => (
                  <li key={k}>
                    {i.quantity} × {i.name}
                    {i.size || i.color ? ` (${[i.size, i.color].filter(Boolean).join(" / ")})` : ""}
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex flex-wrap gap-2">
                {(NEXT[o.status] ?? []).map((n) => (
                  <Button key={n.status} size="sm" onClick={() => move(o, n.status)}>
                    {n.label}
                  </Button>
                ))}
                {["placed", "confirmed", "processing"].includes(o.status) && (
                  <Button size="sm" variant="ghost" onClick={() => move(o, "cancelled")}>
                    Cancel
                  </Button>
                )}
                {["shipped", "delivered"].includes(o.status) && (
                  <Button size="sm" variant="ghost" onClick={() => move(o, "returned")}>
                    Mark returned
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface StoreReview {
  id: string;
  rating: number;
  text: string | null;
  user: { name: string } | null;
  product?: { name: string };
  merchantReply: string | null;
  createdAt: string;
}

function Reviews({ store }: { store: MyStoreData }) {
  const list = useApi<{ reviews: StoreReview[] }>(`/shop/stores/${store.id}/reviews`);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  if (list.loading) return <Loading />;
  if (!list.data?.reviews.length) return <EmptyState icon={<Star className="h-5 w-5" />} title="No reviews yet" message="Buyers can review products once they’re delivered." />;
  return (
    <ul className="flex flex-col gap-4">
      {list.data.reviews.map((r) => (
        <li key={r.id} className="panel p-5">
          <p className="text-sm text-ink-faint">
            {r.product?.name} · {"★".repeat(r.rating)} · {r.user?.name}
          </p>
          {r.text && <p className="mt-2 text-ink">{r.text}</p>}
          {r.merchantReply ? (
            <p className="mt-3 text-sm text-ink-muted">Your reply: {r.merchantReply}</p>
          ) : (
            <form
              className="mt-3 flex gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                await api.post(`/shop/reviews/${r.id}/reply`, { reply: drafts[r.id] }).catch(() => undefined);
                list.reload();
              }}
            >
              <input className="h-10 flex-1 rounded-lg border border-border bg-base-2 px-3 text-sm" placeholder="Reply publicly" value={drafts[r.id] ?? ""} onChange={(e) => setDrafts({ ...drafts, [r.id]: e.target.value })} required />
              <Button size="sm" type="submit">
                Reply
              </Button>
            </form>
          )}
        </li>
      ))}
    </ul>
  );
}

export default function MyStore() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as Tab) || "overview";
  const mine = useApi<{ store: MyStoreData | null }>("/shop/stores/mine");
  const cats = useApi<{ categories: string[] }>("/shop/categories");
  const [editing, setEditing] = useState<ProductDetail | "new" | null>(null);
  const [error, setError] = useState("");
  const store = mine.data?.store;

  if (mine.loading) return <Loading label="Loading your shop…" />;
  if (!store) {
    return (
      <main className="flex-1">
        <div className="container-x py-14">
          <StoreForm onSaved={mine.reload} />
        </div>
      </main>
    );
  }

  async function productAction(p: ProductDetail, status: "archive" | "unarchive" | "delete") {
    setError("");
    try {
      if (status === "delete") {
        if (!window.confirm(`Delete ${p.name}?`)) return;
        await api.delete(`/shop/products/${p.id}`);
      } else await api.patch(`/shop/products/${p.id}`, { status });
      mine.reload();
    } catch (err) {
      setError(apiError(err));
    }
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "products", label: `Products (${store.products.length})` },
    { key: "orders", label: "Orders" },
    { key: "reviews", label: "Reviews" },
    { key: "profile", label: "Shop profile" },
  ];

  return (
    <main className="flex-1">
      <section className="border-b border-border bg-base-2">
        <div className="container-x flex flex-wrap items-center gap-5 py-10">
          {store.logo ? <img src={assetUrl(store.logo)} alt="" className="h-16 w-16 rounded-2xl object-cover" /> : <StoreIcon className="h-12 w-12 text-ink-faint" />}
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-4xl font-bold text-ink">{store.name}</h1>
            <p className="mt-1 flex items-center gap-3 text-sm text-ink-muted">
              <StatusBadge status={store.status} />
              {store.rating.count > 0 && <span>★ {store.rating.avg} ({store.rating.count})</span>}
              {store.status === "approved" && (
                <Link to={`/shop/stores/${store.slug || store.id}`} className="text-accent hover:underline">
                  View public page
                </Link>
              )}
            </p>
          </div>
        </div>
      </section>
      <div className="container-x py-10">
        {store.status === "pending" && <p className="mb-6 rounded-2xl border border-premium/30 bg-premium-soft p-4 text-sm text-premium">Your shop is waiting for approval. You can add products now; they go live once the shop and each product are approved.</p>}
        {(store.status === "rejected" || store.status === "suspended") && (
          <p className="mb-6 rounded-2xl border border-danger/25 bg-danger/10 p-4 text-sm text-danger">
            Your shop is {store.status}
            {store.review?.note ? `: ${store.review.note}` : ""}. {store.status === "rejected" ? "Update your profile to apply again." : "Contact support."}
          </p>
        )}
        <nav className="mb-8 flex gap-1 overflow-x-auto border-b border-border">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setParams({ tab: t.key })} className={`-mb-px shrink-0 border-b-2 px-4 py-3 text-sm font-semibold ${tab === t.key ? "border-accent text-ink" : "border-transparent text-ink-muted"}`}>
              {t.label}
            </button>
          ))}
        </nav>
        {error && (
          <div className="mb-6">
            <FormError>{error}</FormError>
          </div>
        )}

        {tab === "overview" && <Overview store={store} />}
        {tab === "orders" && <Orders store={store} />}
        {tab === "reviews" && <Reviews store={store} />}
        {tab === "profile" && <StoreForm store={store} onSaved={mine.reload} />}
        {tab === "products" && (
          <div className="flex flex-col gap-6">
            {editing ? (
              <ProductForm
                product={editing === "new" ? undefined : editing}
                categories={cats.data?.categories ?? []}
                onDone={() => {
                  setEditing(null);
                  mine.reload();
                }}
              />
            ) : (
              <div>
                <Button icon={<Plus className="h-4 w-4" />} onClick={() => setEditing("new")}>
                  Add a product
                </Button>
              </div>
            )}
            {store.products.length === 0 ? (
              <EmptyState icon={<Package className="h-5 w-5" />} title="No products yet" />
            ) : (
              <ul className="panel divide-y divide-border">
                {store.products.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center gap-4 p-4">
                    <span className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-surface-2">{p.images[0] && <img src={assetUrl(p.images[0])} alt="" className="h-full w-full object-cover" />}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-ink">{p.name}</span>
                      <span className="num block text-sm text-ink-faint">
                        Rs {p.unitPrice ?? p.price} · {p.stock} in stock{p.hasVariants ? " (by option)" : ""}
                      </span>
                    </span>
                    <StatusBadge status={p.status ?? "active"} />
                    <span className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(p)}>
                        Edit
                      </Button>
                      {p.status === "archived" ? (
                        <Button size="sm" variant="ghost" onClick={() => productAction(p, "unarchive")}>
                          Unarchive
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => productAction(p, "archive")}>
                          Archive
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => productAction(p, "delete")}>
                        Delete
                      </Button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  CalendarDays,
  Package,
  Pencil,
  Plus,
  Store as StoreIcon,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import api from "@/api/axios";
import type { OrderSummary, ProductDetail, ProductSummary, StoreDetail } from "@/types";
import { apiError } from "@/types";
import { SHOP_CATEGORY_OPTIONS } from "@/data/shopCategories";
import { SPORTS, getSportBySlug } from "@/data/sports";
import Reveal from "@/components/Reveal";
import { Loading, ErrorState, EmptyState } from "@/components/ui/StateBlock";
import { Input, Textarea } from "@/components/ui/Field";
import CustomSelect from "@/components/ui/CustomSelect";
import Button from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/Badge";

const PRODUCT_SPORT_OPTIONS = [
  { value: "", label: "No specific sport" },
  ...SPORTS.map((s) => ({ value: s.slug, label: s.name, icon: s.emoji, color: s.color })),
];

interface ProductFormState {
  name: string;
  description: string;
  category: string;
  sport: string;
  price: string;
  stock: string;
}

const EMPTY_PRODUCT_FORM: ProductFormState = {
  name: "",
  description: "",
  category: SHOP_CATEGORY_OPTIONS[0].value,
  sport: "",
  price: "",
  stock: "",
};

export default function MyStore() {
  const [store, setStore] = useState<StoreDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/shop/stores/mine");
      setStore(data.store);
    } catch (err) {
      setError(apiError(err, "Could not load your store."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <main className="flex-1 py-16">
      <div className="container-x">
        <Reveal>
          <span className="eyebrow">Seller dashboard</span>
        </Reveal>
        <Reveal delay={0.06}>
          <h1 className="mt-4 font-display text-4xl font-bold text-ink">My store</h1>
        </Reveal>

        <div className="mt-10">
          {loading && <Loading label="Loading your store..." />}
          {!loading && error && <ErrorState message={error} onRetry={load} />}
          {!loading && !error && store && (
            <StoreManager store={store} onStoreUpdated={setStore} />
          )}
          {!loading && !error && !store && <CreateStoreForm onCreated={setStore} />}
        </div>
      </div>
    </main>
  );
}

function CreateStoreForm({ onCreated }: { onCreated: (store: StoreDetail) => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [logo, setLogo] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function onLogoChange(file: File | null) {
    setLogo(file);
    setPreview(file ? URL.createObjectURL(file) : null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const form = new FormData();
      form.append("name", name);
      if (description) form.append("description", description);
      if (logo) form.append("logo", logo);
      const { data } = await api.post("/shop/stores", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      onCreated({ ...data.store, products: data.store.products ?? [] });
    } catch (err) {
      setError(apiError(err, "Could not create your store."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Reveal className="max-w-xl">
      <p className="mb-6 text-sm text-ink-muted">
        Open your own store on The Arena and start listing gear — free, no approval needed. One store per account.
      </p>
      <form onSubmit={onSubmit} className="glass flex flex-col gap-5 rounded-3xl p-8">
        <div className="flex items-center gap-4">
          <label
            htmlFor="storeLogo"
            className="flex h-20 w-20 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border border-dashed border-border bg-surface-2 text-ink-faint hover:border-accent/50"
          >
            {preview ? (
              <img src={preview} alt="Logo preview" className="h-full w-full object-cover" />
            ) : (
              <Upload className="h-6 w-6" />
            )}
          </label>
          <div>
            <p className="text-sm font-medium text-ink">Store logo</p>
            <p className="text-xs text-ink-faint">Optional. PNG or JPG.</p>
            <input
              id="storeLogo"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onLogoChange(e.target.files?.[0] ?? null)}
            />
          </div>
        </div>

        <Input
          label="Store name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Kathmandu Sports Hub"
        />
        <Textarea
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What does your store sell?"
        />

        {error && <p className="text-sm text-red-400">{error}</p>}
        <Button type="submit" loading={loading} size="lg" icon={<StoreIcon className="h-4 w-4" />}>
          Open my store
        </Button>
      </form>
    </Reveal>
  );
}

function StoreManager({
  store,
  onStoreUpdated,
}: {
  store: StoreDetail;
  onStoreUpdated: (store: StoreDetail) => void;
}) {
  const [editingStore, setEditingStore] = useState(false);
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductDetail | null>(null);
  const [editLoadingId, setEditLoadingId] = useState<string | null>(null);
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState("");

  const loadOrders = useCallback(() => {
    setOrdersLoading(true);
    setOrdersError("");
    api
      .get(`/shop/stores/${store.id}/orders`)
      .then(({ data }) => setOrders(data.orders ?? []))
      .catch((err) => setOrdersError(apiError(err, "Could not load your store's orders.")))
      .finally(() => setOrdersLoading(false));
  }, [store.id]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  function openCreateForm() {
    setEditingProduct(null);
    setShowProductForm(true);
  }

  async function openEditForm(product: ProductSummary) {
    setShowProductForm(true);
    setEditLoadingId(product.id);
    try {
      const { data } = await api.get(`/shop/products/${product.id}`);
      setEditingProduct(data.product);
    } catch {
      // Fall back to the summary we already have (no description field) —
      // still lets the seller edit price/stock/category/sport.
      setEditingProduct({ ...product, description: undefined });
    } finally {
      setEditLoadingId(null);
    }
  }

  async function deleteProduct(product: ProductSummary) {
    if (!confirm(`Delete "${product.name}"? This can't be undone.`)) return;
    try {
      await api.delete(`/shop/products/${product.id}`);
      const products = store.products.filter((p) => p.id !== product.id);
      onStoreUpdated({ ...store, products, productCount: products.length });
    } catch (err) {
      alert(apiError(err, "Could not delete this product."));
    }
  }

  return (
    <div className="flex flex-col gap-10">
      {/* STORE HEADER */}
      <Reveal>
        {editingStore ? (
          <EditStoreForm
            store={store}
            onSaved={(updated) => {
              onStoreUpdated({ ...store, ...updated });
              setEditingStore(false);
            }}
            onCancel={() => setEditingStore(false)}
          />
        ) : (
          <div className="glass flex flex-col gap-6 rounded-3xl p-8 sm:flex-row sm:items-center">
            {store.logo ? (
              <img src={store.logo} alt={store.name} className="h-20 w-20 rounded-2xl object-cover" />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-accent-soft text-accent">
                <StoreIcon className="h-9 w-9" />
              </div>
            )}
            <div className="flex-1">
              <h2 className="font-display text-2xl font-bold text-ink">{store.name}</h2>
              {store.description && <p className="mt-1 text-sm text-ink-muted">{store.description}</p>}
              <p className="mt-1 text-xs text-ink-faint">{store.productCount} products listed</p>
            </div>
            <Button variant="secondary" onClick={() => setEditingStore(true)} icon={<Pencil className="h-3.5 w-3.5" />}>
              Edit store
            </Button>
          </div>
        )}
      </Reveal>

      {/* PRODUCTS */}
      <Reveal delay={0.08}>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold text-ink">Products</h2>
          <Button size="sm" onClick={openCreateForm} icon={<Plus className="h-4 w-4" />}>
            Add product
          </Button>
        </div>

        {showProductForm && (
          <div className="mt-4">
            <ProductForm
              product={editingProduct}
              onSaved={(product) => {
                const exists = store.products.some((p) => p.id === product.id);
                const products = exists
                  ? store.products.map((p) => (p.id === product.id ? product : p))
                  : [product, ...store.products];
                onStoreUpdated({ ...store, products, productCount: products.length });
                setShowProductForm(false);
                setEditingProduct(null);
              }}
              onCancel={() => {
                setShowProductForm(false);
                setEditingProduct(null);
              }}
            />
          </div>
        )}

        <div className="mt-6">
          {store.products.length === 0 ? (
            <EmptyState title="No products yet" message="Add your first product to start selling." />
          ) : (
            <div className="flex flex-col gap-3">
              {store.products.map((p) => {
                const sport = p.sport ? getSportBySlug(p.sport) : undefined;
                return (
                  <div key={p.id} className="glass flex flex-wrap items-center gap-4 rounded-2xl p-4">
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-surface-2">
                      {p.images?.[0] ? (
                        <img src={p.images[0]} alt={p.name} className="h-full w-full object-cover" />
                      ) : (
                        <div
                          className="flex h-full w-full items-center justify-center text-xl"
                          style={{ background: `${sport?.color ?? "#3a82ff"}22` }}
                        >
                          {sport?.emoji ?? "🛍️"}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">{p.name}</p>
                      <p className="text-xs text-ink-faint">
                        {p.category}
                        {sport ? ` · ${sport.name}` : ""} · Rs {p.price}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-semibold ${
                        p.stock === 0 ? "text-red-400" : p.stock <= 5 ? "text-premium" : "text-ink-muted"
                      }`}
                    >
                      {p.stock === 0 ? "Out of stock" : `${p.stock} in stock`}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => openEditForm(p)}
                        disabled={editLoadingId === p.id}
                        className="rounded-full p-2 text-ink-faint hover:bg-surface-2 hover:text-ink disabled:opacity-40"
                        aria-label={`Edit ${p.name}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => deleteProduct(p)}
                        className="rounded-full p-2 text-ink-faint hover:bg-red-500/10 hover:text-red-400"
                        aria-label={`Delete ${p.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Reveal>

      {/* ORDERS */}
      <Reveal delay={0.14}>
        <h2 className="font-display text-xl font-semibold text-ink">My store's orders</h2>
        <div className="mt-4">
          {ordersLoading && <Loading label="Loading orders..." />}
          {!ordersLoading && ordersError && <ErrorState message={ordersError} onRetry={loadOrders} />}
          {!ordersLoading && !ordersError && orders.length === 0 && (
            <EmptyState
              title="No orders yet"
              message="Orders containing your products will show up here."
              icon={<Package className="h-7 w-7 text-ink-faint" />}
            />
          )}
          {!ordersLoading && !ordersError && orders.length > 0 && (
            <div className="flex flex-col gap-3">
              {orders.map((order) => (
                <div key={order.id} className="glass rounded-2xl p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="flex items-center gap-1.5 text-xs text-ink-faint">
                      <CalendarDays className="h-3.5 w-3.5" /> {new Date(order.createdAt).toLocaleDateString()}
                    </p>
                    <StatusBadge status={order.status} />
                  </div>
                  <div className="mt-3 flex flex-col gap-1.5">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm">
                        <span className="text-ink-muted">
                          {item.name} × {item.quantity}
                        </span>
                        <span className="text-ink">Rs {item.price * item.quantity}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Reveal>
    </div>
  );
}

function EditStoreForm({
  store,
  onSaved,
  onCancel,
}: {
  store: StoreDetail;
  onSaved: (store: StoreDetail) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(store.name);
  const [description, setDescription] = useState(store.description ?? "");
  const [logo, setLogo] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(store.logo);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function onLogoChange(file: File | null) {
    setLogo(file);
    setPreview(file ? URL.createObjectURL(file) : store.logo);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const form = new FormData();
      form.append("name", name);
      form.append("description", description);
      if (logo) form.append("logo", logo);
      const { data } = await api.patch(`/shop/stores/${store.id}`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      onSaved({ ...store, ...data.store });
    } catch (err) {
      setError(apiError(err, "Could not update your store."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="glass flex flex-col gap-5 rounded-3xl p-8">
      <div className="flex items-center gap-4">
        <label
          htmlFor="editStoreLogo"
          className="flex h-20 w-20 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border border-dashed border-border bg-surface-2 text-ink-faint hover:border-accent/50"
        >
          {preview ? (
            <img src={preview} alt="Logo preview" className="h-full w-full object-cover" />
          ) : (
            <Upload className="h-6 w-6" />
          )}
        </label>
        <input
          id="editStoreLogo"
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => onLogoChange(e.target.files?.[0] ?? null)}
        />
      </div>
      <Input label="Store name" required value={name} onChange={(e) => setName(e.target.value)} />
      <Textarea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex gap-3">
        <Button type="submit" loading={loading}>
          Save changes
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function ProductForm({
  product,
  onSaved,
  onCancel,
}: {
  product: ProductDetail | null;
  onSaved: (product: ProductDetail) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<ProductFormState>(
    product
      ? {
          name: product.name,
          description: product.description ?? "",
          category: product.category,
          sport: product.sport ?? "",
          price: String(product.price),
          stock: String(product.stock),
        }
      : EMPTY_PRODUCT_FORM
  );
  const [images, setImages] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function update<K extends keyof ProductFormState>(key: K, value: ProductFormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = new FormData();
      data.append("name", form.name);
      if (form.description) data.append("description", form.description);
      data.append("category", form.category);
      if (form.sport) data.append("sport", form.sport);
      data.append("price", form.price);
      data.append("stock", form.stock);
      images.forEach((file) => data.append("images", file));

      const res = product
        ? await api.patch(`/shop/products/${product.id}`, data, {
            headers: { "Content-Type": "multipart/form-data" },
          })
        : await api.post("/shop/products", data, { headers: { "Content-Type": "multipart/form-data" } });
      onSaved(res.data.product);
    } catch (err) {
      setError(apiError(err, "Could not save this product."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="glass flex flex-col gap-5 rounded-3xl p-8">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold text-ink">{product ? "Edit product" : "New product"}</h3>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full p-1.5 text-ink-faint hover:bg-surface-2 hover:text-ink"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <Input
        label="Product name"
        required
        value={form.name}
        onChange={(e) => update("name", e.target.value)}
        placeholder="e.g. SG Cricket Bat"
      />
      <Textarea
        label="Description"
        value={form.description}
        onChange={(e) => update("description", e.target.value)}
        placeholder="Details buyers should know"
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium text-ink-muted">
            Category <span className="text-accent">*</span>
          </label>
          <div className="mt-1.5">
            <CustomSelect value={form.category} onChange={(v) => update("category", v)} options={SHOP_CATEGORY_OPTIONS} />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-ink-muted">Sport</label>
          <div className="mt-1.5">
            <CustomSelect
              value={form.sport}
              onChange={(v) => update("sport", v)}
              options={PRODUCT_SPORT_OPTIONS}
              placeholder="No specific sport"
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Price (Rs)"
          type="number"
          min="0"
          step="0.01"
          required
          value={form.price}
          onChange={(e) => update("price", e.target.value)}
        />
        <Input
          label="Stock"
          type="number"
          min="0"
          step="1"
          required
          value={form.stock}
          onChange={(e) => update("stock", e.target.value)}
        />
      </div>

      <div>
        <label className="text-sm font-medium text-ink-muted">Images</label>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => setImages(Array.from(e.target.files ?? []))}
          className="mt-1.5 block w-full text-sm text-ink-muted file:mr-3 file:rounded-full file:border-0 file:bg-accent-soft file:px-4 file:py-2 file:text-xs file:font-semibold file:text-accent hover:file:bg-accent/20"
        />
        {product?.images?.length ? (
          <p className="mt-1.5 text-xs text-ink-faint">
            Leave empty to keep the existing {product.images.length} image(s).
          </p>
        ) : null}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex gap-3">
        <Button type="submit" loading={loading}>
          {product ? "Save changes" : "Add product"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

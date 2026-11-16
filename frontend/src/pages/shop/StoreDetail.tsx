import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Store as StoreIcon } from "lucide-react";
import api, { assetUrl } from "@/api/axios";
import type { StoreDetail as StoreDetailType } from "@/types";
import { apiError } from "@/types";
import { Loading, ErrorState, EmptyState } from "@/components/ui/StateBlock";
import ProductCard from "@/components/shop/ProductCard";

export default function StoreDetail() {
  const { id } = useParams<{ id: string }>();
  const [store, setStore] = useState<StoreDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError("");
    api
      .get(`/shop/stores/${id}`)
      .then(({ data }) => setStore(data.store))
      .catch((err) => setError(apiError(err, "Could not load this store.")))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Loading label="Loading store…" />;
  if (error || !store) return <ErrorState message={error || "Store not found."} />;

  return (
    <main className="flex-1">
      <section className="border-b border-border bg-base-2">
        <div className="container-x py-12 md:py-16">
          <Link to="/shop/stores" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
            <ArrowLeft className="h-4 w-4" /> All stores
          </Link>
          <div className="mt-8 flex flex-col gap-6 sm:flex-row sm:items-end">
            {store.logo ? (
              <img src={assetUrl(store.logo)} alt={store.name} className="h-28 w-28 rounded-3xl object-cover" />
            ) : (
              <span className="flex h-28 w-28 items-center justify-center rounded-3xl bg-accent-soft text-accent">
                <StoreIcon className="h-12 w-12" />
              </span>
            )}
            <div className="min-w-0">
              <h1 className="font-display text-5xl font-bold leading-[0.95] text-ink md:text-7xl">{store.name}</h1>
              {store.description && <p className="mt-3 max-w-xl text-lg text-ink-muted">{store.description}</p>}
            </div>
          </div>
          <dl className="mt-8 flex flex-wrap gap-x-12 gap-y-3 border-t border-border pt-6">
            <div>
              <dt className="text-sm text-ink-faint">Products</dt>
              <dd className="num mt-0.5 font-semibold text-ink">{store.productCount}</dd>
            </div>
            <div>
              <dt className="text-sm text-ink-faint">Run by</dt>
              <dd className="mt-0.5 font-semibold text-ink">{store.owner.name}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="container-x py-12 md:py-16">
        <h2 className="font-display text-3xl font-bold text-ink">Products</h2>
        <div className="mt-6">
          {store.products.length === 0 ? (
            <EmptyState title="No products yet" message="This store hasn’t listed any products yet." />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-[repeat(auto-fill,minmax(min(100%,15rem),1fr))]">
              {store.products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Store as StoreIcon } from "lucide-react";
import api from "@/api/axios";
import type { StoreDetail as StoreDetailType } from "@/types";
import { apiError } from "@/types";
import Reveal from "@/components/Reveal";
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

  if (loading) return <Loading label="Loading store..." />;
  if (error || !store) return <ErrorState message={error || "Store not found."} />;

  return (
    <main className="flex-1 py-16">
      <div className="container-x">
        <Reveal>
          <div className="glass flex flex-col gap-6 rounded-3xl p-8 sm:flex-row sm:items-center">
            {store.logo ? (
              <img src={store.logo} alt={store.name} className="h-24 w-24 rounded-2xl object-cover" />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-accent-soft text-accent">
                <StoreIcon className="h-10 w-10" />
              </div>
            )}
            <div className="flex-1">
              <span className="eyebrow">Store</span>
              <h1 className="mt-3 font-display text-3xl font-bold text-ink md:text-4xl">{store.name}</h1>
              {store.description && <p className="mt-2 max-w-xl text-sm text-ink-muted">{store.description}</p>}
              <p className="mt-2 text-xs text-ink-faint">
                {store.productCount} products · run by {store.owner.name}
              </p>
            </div>
          </div>
        </Reveal>

        <div className="mt-10">
          <h2 className="font-display text-xl font-semibold text-ink">Products</h2>
          <div className="mt-4">
            {store.products.length === 0 ? (
              <EmptyState title="No products yet" message="This store hasn't listed any products yet." />
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {store.products.map((p, i) => (
                  <ProductCard key={p.id} product={p} index={i} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

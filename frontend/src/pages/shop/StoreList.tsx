import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Store as StoreIcon } from "lucide-react";
import api from "@/api/axios";
import type { StoreSummary } from "@/types";
import { apiError } from "@/types";
import Reveal from "@/components/Reveal";
import { Loading, ErrorState, EmptyState } from "@/components/ui/StateBlock";
import { useSpotlight } from "@/hooks/useSpotlight";

function StoreCard({ store, index }: { store: StoreSummary; index: number }) {
  const spot = useSpotlight<HTMLAnchorElement>();

  return (
    <Reveal delay={(index % 8) * 0.05}>
      <Link
        ref={spot.ref}
        onMouseMove={spot.onMouseMove}
        to={`/shop/stores/${store.id}`}
        className="spotlight glass group flex h-full flex-col items-center gap-3 rounded-2xl p-7 text-center transition-transform hover:-translate-y-1 hover:border-accent/40"
      >
        {store.logo ? (
          <img src={store.logo} alt={store.name} className="h-16 w-16 rounded-2xl object-cover" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-soft text-accent">
            <StoreIcon className="h-7 w-7" />
          </div>
        )}
        <h3 className="font-display text-lg font-semibold text-ink">{store.name}</h3>
        {store.description && <p className="line-clamp-2 text-xs text-ink-muted">{store.description}</p>}
        <span className="mt-auto pt-1 text-xs font-medium text-ink-faint">{store.productCount} products</span>
      </Link>
    </Reveal>
  );
}

export default function StoreList() {
  const [stores, setStores] = useState<StoreSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    api
      .get("/shop/stores")
      .then(({ data }) => alive && setStores(data.stores ?? []))
      .catch((err) => alive && setError(apiError(err, "Could not load stores.")))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <main className="flex-1 py-16">
      <div className="container-x">
        <Reveal>
          <span className="eyebrow">Shop</span>
        </Reveal>
        <Reveal delay={0.06}>
          <h1 className="mt-4 font-display text-4xl font-bold text-ink">All stores</h1>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="mt-2 max-w-xl text-sm text-ink-muted">
            Browse every vendor selling gear on The Arena marketplace.
          </p>
        </Reveal>

        <div className="mt-10">
          {loading && <Loading label="Loading stores..." />}
          {!loading && error && <ErrorState message={error} />}
          {!loading && !error && stores.length === 0 && (
            <EmptyState title="No stores yet" message="Be the first to open a store on The Arena." />
          )}
          {!loading && !error && stores.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {stores.map((s, i) => (
                <StoreCard key={s.id} store={s} index={i} />
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

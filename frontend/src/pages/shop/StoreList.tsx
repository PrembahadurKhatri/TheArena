import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowUpRight, Store as StoreIcon } from "lucide-react";
import api, { assetUrl } from "@/api/axios";
import type { StoreSummary } from "@/types";
import { apiError } from "@/types";
import { Loading, ErrorState, EmptyState } from "@/components/ui/StateBlock";
import PageHero from "@/components/page/PageHero";
import { buttonClass } from "@/components/ui/Button";

function StoreCard({ store }: { store: StoreSummary }) {
  return (
    <Link to={`/shop/stores/${store.id}`} className="panel card-lift group flex h-full flex-col p-6">
      <div className="flex items-start justify-between gap-4">
        {store.logo ? (
          <img src={assetUrl(store.logo)} alt="" className="h-16 w-16 rounded-2xl object-cover" />
        ) : (
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-soft text-accent">
            <StoreIcon className="h-7 w-7" />
          </span>
        )}
        <ArrowUpRight className="h-5 w-5 text-ink-faint transition-colors group-hover:text-accent" />
      </div>
      <h3 className="mt-6 font-display text-2xl font-bold text-ink">{store.name}</h3>
      {store.description && <p className="mt-2 line-clamp-2 text-sm text-ink-muted">{store.description}</p>}
      <p className="mt-auto pt-6 text-sm text-ink-faint">
        <span className="num font-semibold text-ink">{store.productCount}</span> products
      </p>
    </Link>
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
    <main className="flex-1">
      <PageHero
        above={
          <Link to="/shop" className="inline-flex items-center gap-1.5 hover:text-ink">
            <ArrowLeft className="h-4 w-4" /> Shop
          </Link>
        }
        title="All stores"
        lead="Browse every vendor selling gear on The Arena marketplace."
        image="/sports/tt.jpg"
        actions={
          <Link to="/shop/my-store" className={buttonClass({ size: "lg" })}>
            Open your store
          </Link>
        }
      />

      <div className="container-x py-12 md:py-16">
        {loading && <Loading label="Loading stores…" />}
        {!loading && error && <ErrorState message={error} />}
        {!loading && !error && stores.length === 0 && (
          <EmptyState title="No stores yet" message="Be the first to open a store on The Arena." />
        )}
        {!loading && !error && stores.length > 0 && (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,17rem),1fr))] gap-5">
            {stores.map((s) => (
              <StoreCard key={s.id} store={s} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

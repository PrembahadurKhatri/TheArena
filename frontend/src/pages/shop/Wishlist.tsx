import { Heart } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import type { ProductSummary } from "@/types";
import { Loading, EmptyState } from "@/components/ui/StateBlock";
import ProductCard from "@/components/shop/ProductCard";

export default function Wishlist() {
  const { data, loading } = useApi<{ products: ProductSummary[] }>("/shop/wishlist");
  return (
    <main className="flex-1">
      <div className="container-x py-14">
        <h1 className="font-display text-5xl font-bold text-ink">Wishlist</h1>
        <div className="mt-10">
          {loading && <Loading />}
          {!loading && !data?.products.length && <EmptyState icon={<Heart className="h-5 w-5" />} title="Nothing saved yet" message="Tap the heart on a product to save it here." />}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-[repeat(auto-fill,minmax(min(100%,14rem),1fr))]">
            {data?.products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import type { Product } from "@/lib/mock/types";
import { formatCurrency } from "@/lib/utils/format";
import { firstImage } from "@/lib/utils/images";
import { useCart } from "@/lib/cart-context";
import { useApp } from "@/lib/context";

const categoryEmoji: Record<string, string> = {
  "Contact Lenses": "👁", Sunglasses: "🕶", "Lens Stock": "🔍", Frames: "👓",
};

export function StorefrontClient({ products }: { products: Product[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("All");
  const { addItem } = useCart();
  const { showToast } = useApp();

  const categories = useMemo(() => ["All", ...Array.from(new Set(products.map((p) => p.category)))], [products]);

  const filtered = products.filter((p) => {
    const matchesQuery =
      !query || p.name.toLowerCase().includes(query.toLowerCase()) || p.brand.toLowerCase().includes(query.toLowerCase());
    const matchesCategory = category === "All" || p.category === category;
    return matchesQuery && matchesCategory;
  });

  const handleAdd = (p: Product) => {
    addItem({ productId: p.id, name: p.name, salePrice: p.salePrice, image: p.image, stock: p.stock });
    showToast(`Added ${p.name} to cart`, "success");
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Shop Our Collection</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Browse frames, sunglasses, and lenses — order online for pickup or delivery.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products..."
            className="w-full pl-10 pr-4 py-2.5 glass-input text-sm"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition-all ${category === c ? "bg-primary text-white" : "bg-surface hover:bg-surface-hover"}`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="glass-card p-10 text-center text-sm text-muted-foreground">No products match your search.</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 stagger-rise">
          {filtered.map((p) => (
            <div key={p.id} className="glass-card p-3">
              <Link href={`/shop/product/${p.id}`} className="block">
                <div className="w-full aspect-square rounded-xl bg-gradient-to-br from-surface to-muted flex items-center justify-center mb-2 overflow-hidden">
                  {firstImage(p.image) ? (
                    <img src={firstImage(p.image)} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <span className="text-2xl opacity-40">{categoryEmoji[p.category] ?? "👓"}</span>
                  )}
                </div>
                <p className="text-xs font-medium truncate">{p.name}</p>
                <p className="text-[10px] text-muted-foreground">{p.brand}</p>
              </Link>
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-sm font-bold text-primary">{formatCurrency(p.salePrice)}</span>
                <span className="text-[10px] text-muted-foreground">{p.stock} left</span>
              </div>
              <button
                onClick={() => handleAdd(p)}
                className="mt-2 w-full py-1.5 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary-hover transition-colors"
              >
                Add to Cart
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

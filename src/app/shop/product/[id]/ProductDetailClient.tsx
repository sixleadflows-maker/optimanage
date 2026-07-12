"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { Product } from "@/lib/mock/types";
import { formatCurrency } from "@/lib/utils/format";
import { firstImage } from "@/lib/utils/images";
import { useCart } from "@/lib/cart-context";
import { useApp } from "@/lib/context";

const categoryEmoji: Record<string, string> = {
  "Contact Lenses": "👁", Sunglasses: "🕶", "Lens Stock": "🔍", Frames: "👓",
};

export function ProductDetailClient({ product }: { product: Product }) {
  const [quantity, setQuantity] = useState(1);
  const { addItem } = useCart();
  const { showToast } = useApp();

  const handleAdd = () => {
    addItem(
      { productId: product.id, name: product.name, salePrice: product.salePrice, image: product.image, stock: product.stock },
      quantity
    );
    showToast(`Added ${quantity} × ${product.name} to cart`, "success");
  };

  return (
    <div className="space-y-4 animate-fade-in max-w-2xl mx-auto">
      <Link href="/shop" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to shop
      </Link>
      <div className="glass-card p-5 grid sm:grid-cols-2 gap-5">
        <div className="w-full aspect-square rounded-xl bg-gradient-to-br from-surface to-muted flex items-center justify-center overflow-hidden">
          {firstImage(product.image) ? (
            <img src={firstImage(product.image)} alt={product.name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-6xl opacity-40">{categoryEmoji[product.category] ?? "👓"}</span>
          )}
        </div>
        <div className="flex flex-col">
          <p className="text-xs text-muted-foreground">
            {product.brand} · {product.model}
          </p>
          <h1 className="text-xl font-bold mt-0.5">{product.name}</h1>
          <div className="flex gap-1.5 mt-2 flex-wrap">
            <span className="text-[10px] px-2 py-0.5 rounded-md bg-surface text-muted-foreground">{product.category}</span>
            {product.colour && <span className="text-[10px] px-2 py-0.5 rounded-md bg-surface text-muted-foreground">{product.colour}</span>}
            {product.size && <span className="text-[10px] px-2 py-0.5 rounded-md bg-surface text-muted-foreground">Size {product.size}</span>}
          </div>
          <p className="text-2xl font-bold text-primary mt-4">{formatCurrency(product.salePrice)}</p>
          <p className="text-xs text-muted-foreground mt-1">{product.stock} in stock</p>

          <div className="flex items-center gap-3 mt-4">
            <div className="flex items-center border border-border rounded-xl overflow-hidden">
              <button onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="px-3 py-2 hover:bg-surface-hover transition-colors">
                −
              </button>
              <span className="px-4 text-sm font-medium">{quantity}</span>
              <button onClick={() => setQuantity((q) => Math.min(product.stock, q + 1))} className="px-3 py-2 hover:bg-surface-hover transition-colors">
                +
              </button>
            </div>
            <button
              onClick={handleAdd}
              className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-colors"
            >
              Add to Cart
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { Trash2, ArrowLeft } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { formatCurrency } from "@/lib/utils/format";
import { firstImage } from "@/lib/utils/images";

export function CartClient() {
  const { lines, removeItem, setQuantity, subtotal } = useCart();

  if (lines.length === 0) {
    return (
      <div className="glass-card p-10 text-center space-y-3 animate-fade-in">
        <p className="text-sm text-muted-foreground">Your cart is empty.</p>
        <Link href="/shop" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
          <ArrowLeft className="w-4 h-4" /> Continue shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold">Your Cart</h1>
      <div className="glass-card divide-y divide-border">
        {lines.map((l) => (
          <div key={l.productId} className="p-4 flex items-center gap-3">
            <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-surface to-muted flex-shrink-0 overflow-hidden flex items-center justify-center">
              {firstImage(l.image) ? (
                <img src={firstImage(l.image)} alt={l.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-xl opacity-40">👓</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{l.name}</p>
              <p className="text-xs text-muted-foreground">{formatCurrency(l.salePrice)} each</p>
            </div>
            <div className="flex items-center border border-border rounded-lg overflow-hidden">
              <button onClick={() => setQuantity(l.productId, l.quantity - 1)} className="px-2.5 py-1.5 hover:bg-surface-hover transition-colors text-sm">
                −
              </button>
              <span className="px-3 text-sm font-medium">{l.quantity}</span>
              <button onClick={() => setQuantity(l.productId, l.quantity + 1)} className="px-2.5 py-1.5 hover:bg-surface-hover transition-colors text-sm">
                +
              </button>
            </div>
            <p className="text-sm font-semibold w-20 text-right">{formatCurrency(l.salePrice * l.quantity)}</p>
            <button onClick={() => removeItem(l.productId)} className="text-muted-foreground hover:text-destructive transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
      <div className="glass-card p-4 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Subtotal</span>
        <span className="text-lg font-bold">{formatCurrency(subtotal)}</span>
      </div>
      <Link
        href="/shop/checkout"
        className="block w-full text-center py-3 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-colors"
      >
        Proceed to Checkout
      </Link>
    </div>
  );
}

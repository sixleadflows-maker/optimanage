"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { useCart } from "@/lib/cart-context";

export function ShopHeader({ shopName }: { shopName: string }) {
  const { itemCount } = useCart();
  return (
    <header className="glass-topbar sticky top-0 z-30 px-4 py-3 flex items-center justify-between">
      <Link href="/shop" className="font-display font-bold text-lg text-gradient">
        {shopName}
      </Link>
      <Link
        href="/shop/cart"
        className="relative flex items-center gap-2 px-3 py-2 rounded-xl bg-surface hover:bg-surface-hover transition-colors text-sm font-medium"
      >
        <ShoppingCart className="w-4 h-4" />
        Cart
        {itemCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center">
            {itemCount}
          </span>
        )}
      </Link>
    </header>
  );
}

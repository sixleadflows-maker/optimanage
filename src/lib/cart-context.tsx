"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

export interface CartLine {
  productId: string;
  name: string;
  salePrice: number;
  image?: string;
  quantity: number;
  stock: number;
}

interface CartContextValue {
  lines: CartLine[];
  addItem: (item: Omit<CartLine, "quantity">, quantity?: number) => void;
  removeItem: (productId: string) => void;
  setQuantity: (productId: string, quantity: number) => void;
  clear: () => void;
  subtotal: number;
  itemCount: number;
}

const STORAGE_KEY = "optimanage_shop_cart";
const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setLines(JSON.parse(raw));
    } catch {
      // ignore corrupt cart state
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  }, [lines, hydrated]);

  const addItem = useCallback((item: Omit<CartLine, "quantity">, quantity = 1) => {
    setLines((prev) => {
      const existing = prev.find((l) => l.productId === item.productId);
      if (existing) {
        const nextQty = Math.min(existing.quantity + quantity, existing.stock);
        return prev.map((l) => (l.productId === item.productId ? { ...l, quantity: nextQty } : l));
      }
      return [...prev, { ...item, quantity: Math.min(quantity, item.stock) }];
    });
  }, []);

  const removeItem = useCallback((productId: string) => {
    setLines((prev) => prev.filter((l) => l.productId !== productId));
  }, []);

  const setQuantity = useCallback((productId: string, quantity: number) => {
    setLines((prev) =>
      prev.map((l) => (l.productId === productId ? { ...l, quantity: Math.max(1, Math.min(quantity, l.stock)) } : l))
    );
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const subtotal = lines.reduce((sum, l) => sum + l.salePrice * l.quantity, 0);
  const itemCount = lines.reduce((sum, l) => sum + l.quantity, 0);

  return (
    <CartContext.Provider value={{ lines, addItem, removeItem, setQuantity, clear, subtotal, itemCount }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}

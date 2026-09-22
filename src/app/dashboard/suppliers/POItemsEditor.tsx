"use client";

import { useEffect, useRef, useState } from "react";
import type { PurchaseOrder } from "@/lib/mock/types";
import { formatCurrency } from "@/lib/utils/format";
import { useApp } from "@/lib/context";
import { updatePurchaseOrderItems } from "@/lib/actions/suppliers";
import { searchProductsForSale, type ProductSearchHit } from "@/lib/actions/products";
import { Loader2, Plus, Search, Trash2, X, Pencil } from "lucide-react";

interface DraftItem {
  key: string;
  // The order line this already is (left out for one added here).
  itemId?: string;
  // Already received: the line stays, with at least this many.
  received: number;
  productId: string;
  name: string;
  description: string;
  quantity: number;
  unitCost: number;
}

/** Corrects the lines on a purchase order, before or after stock has come in. */
export function POItemsEditor({
  order,
  onClose,
  onDone,
}: {
  order: PurchaseOrder;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const { showToast } = useApp();
  const [items, setItems] = useState<DraftItem[]>(
    order.items.map((i) => ({
      key: i.id,
      itemId: i.id,
      received: i.received,
      productId: i.productId,
      name: i.productName,
      description: i.description,
      quantity: i.quantity,
      unitCost: i.unitCost,
    }))
  );
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [hits, setHits] = useState<ProductSearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const manualCounter = useRef(0);

  useEffect(() => {
    const q = search.trim();
    if (q.length < 2) {
      setHits([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(() => {
      searchProductsForSale(q)
        .then((res) => !cancelled && setHits(res))
        .catch(() => {})
        .finally(() => !cancelled && setSearching(false));
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search]);

  const setItem = (key: string, patch: Partial<DraftItem>) =>
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));

  const total = items.reduce((sum, i) => sum + i.quantity * i.unitCost, 0);

  const submit = async () => {
    if (items.some((i) => !i.productId && !i.name.trim())) {
      showToast("Give every typed-in item a name", "error");
      return;
    }
    setSaving(true);
    const res = await updatePurchaseOrderItems(
      order.id,
      items.map((i) =>
        i.productId
          ? { id: i.itemId, productId: i.productId, description: i.description, quantity: i.quantity, unitCost: i.unitCost }
          : { id: i.itemId, name: i.name.trim(), description: i.description, quantity: i.quantity, unitCost: i.unitCost }
      )
    );
    setSaving(false);
    if (!res.ok) {
      showToast(res.error, "error");
      return;
    }
    onDone(`${order.poNumber} updated — ${formatCurrency(total)}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="glass-modal p-6 w-full max-w-2xl animate-rise max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Pencil className="w-4 h-4 text-primary" /> Edit items — {order.poNumber}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {order.items.some((i) => i.received > 0)
                ? `${order.supplierName} · lines with stock received stay on the order, with at least what's come in.`
                : `${order.supplierName} · nothing received yet.`}
            </p>
          </div>
          <button onClick={onClose} className="cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.key} className="p-3 rounded-xl bg-surface">
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  {item.productId ? (
                    <p className="text-xs font-medium truncate">{item.name}</p>
                  ) : (
                    <input type="text" value={item.name} onChange={(e) => setItem(item.key, { name: e.target.value })}
                      placeholder="Item name" className="w-full px-2.5 py-1.5 glass-input text-xs" />
                  )}
                  <input type="text" value={item.description} onChange={(e) => setItem(item.key, { description: e.target.value })}
                    placeholder="Details (optional)" className="w-full mt-1.5 px-2.5 py-1.5 glass-input text-[11px]" />
                </div>
                <button onClick={() => setItems((prev) => prev.filter((i) => i.key !== item.key))}
                  disabled={item.received > 0}
                  title={item.received > 0 ? "Stock has been received against this line, so it stays" : "Remove this line"}
                  className="p-1.5 rounded-lg hover:bg-surface-hover cursor-pointer flex-shrink-0 disabled:opacity-30 disabled:cursor-not-allowed">
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </button>
              </div>
              {item.received > 0 && (
                <p className="text-[10px] text-warning mt-1.5">{`${item.received} received — this line stays, with at least ${item.received}.`}</p>
              )}
              <div className="grid grid-cols-3 gap-2 mt-2">
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-1">Quantity</label>
                  <input type="number" min={Math.max(1, item.received)} value={item.quantity}
                    onChange={(e) => setItem(item.key, { quantity: Math.max(1, item.received, Math.floor(Number(e.target.value) || 1)) })}
                    className="w-full px-2 py-1.5 glass-input text-xs" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-1">Unit cost</label>
                  <input type="number" min={0} value={item.unitCost}
                    onChange={(e) => setItem(item.key, { unitCost: Math.max(0, Number(e.target.value) || 0) })}
                    className="w-full px-2 py-1.5 glass-input text-xs" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-1">Line total</label>
                  <p className="px-2 py-1.5 text-xs font-semibold">{formatCurrency(item.quantity * item.unitCost)}</p>
                </div>
              </div>
            </div>
          ))}
          {items.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">
              No items left — add one below, or close without saving.
            </p>
          )}
        </div>

        <div className="mt-3">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-muted-foreground">Add an item</label>
            <button
              onClick={() => {
                manualCounter.current += 1;
                setItems((prev) => [...prev, {
                  key: `manual-${manualCounter.current}-${Date.now()}`, received: 0,
                  productId: "", name: "", description: "", quantity: 1, unitCost: 0,
                }]);
              }}
              className="text-[11px] text-primary font-medium flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3 h-3" /> Item not in inventory
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products by name, brand or model..." className="w-full pl-9 pr-4 py-2 glass-input text-xs" />
            {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-muted-foreground" />}
            {hits.length > 0 && (
              <div className="mt-1 glass rounded-lg p-1 max-h-40 overflow-y-auto">
                {hits.map((hit) => (
                  <button key={hit.id}
                    onClick={() => {
                      setItems((prev) => [...prev, {
                        key: `new-${hit.id}-${Date.now()}`, received: 0, productId: hit.id, name: hit.label,
                        description: "", quantity: 1, unitCost: 0,
                      }]);
                      setSearch("");
                      setHits([]);
                    }}
                    className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-surface-hover text-xs flex items-center justify-between gap-2 cursor-pointer">
                    <span className="truncate">{hit.label} {hit.model && <span className="text-muted-foreground">· {hit.model}</span>}</span>
                    <span className="text-muted-foreground flex-shrink-0">{hit.stock} in stock</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 p-3 rounded-xl bg-surface flex justify-between text-sm font-semibold">
          <span>Order total</span>
          <span>{formatCurrency(total)}</span>
        </div>

        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 glass-card text-sm font-medium cursor-pointer">Cancel</button>
          <button onClick={submit} disabled={saving || items.length === 0}
            className="flex-1 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-hover transition-colors disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} Save items
          </button>
        </div>
      </div>
    </div>
  );
}

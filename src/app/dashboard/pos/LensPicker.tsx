"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, X, PenLine, Plus } from "lucide-react";
import type { Product } from "@/lib/mock/types";
import { formatCurrency } from "@/lib/utils/format";
import { matchesSearch } from "@/lib/utils/search";

/** A lens chosen for a frame: from the lens stock, or typed in (no productId). */
export interface PickedLens {
  productId: string | null;
  name: string;
  brand: string;
  price: number;
  quantity: number;
}

/**
 * "Which lens for this frame?" -- comes up when a frame is scanned or added.
 * Search the lens stock or scroll through it, or type a lens in with its price.
 * A lens barcode scanned here is picked straight away.
 */
export function LensPicker({
  frameName, lenses, offerEveryTime, onOfferChange, onPick, onClose,
}: {
  frameName: string;
  lenses: Product[];
  offerEveryTime: boolean;
  onOfferChange: (offer: boolean) => void;
  onPick: (lens: PickedLens) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [typing, setTyping] = useState(false);
  const [manual, setManual] = useState({ name: "", price: "", quantity: "1" });
  const [problem, setProblem] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of lenses) counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
    return [...counts.entries()];
  }, [lenses]);

  const shown = useMemo(
    () => lenses
      .filter((p) => category === "all" || p.category === category)
      .filter((p) => matchesSearch(query, [p.brand, p.name, p.model, p.colour, p.type, p.size, p.barcode])),
    [lenses, category, query],
  );

  const pick = (p: Product) => {
    onPick({ productId: p.id, name: p.name, brand: p.brand, price: p.salePrice, quantity: 1 });
  };

  // A scanner types the barcode and presses Enter.
  const onSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    const q = query.trim();
    if (!q) return;
    const hit = lenses.find((p) => p.barcode && p.barcode === q) ?? (shown.length === 1 ? shown[0] : undefined);
    if (hit && hit.stock > 0) pick(hit);
  };

  const addTyped = () => {
    const name = manual.name.trim();
    const price = Number(manual.price);
    const quantity = Math.max(1, Math.floor(Number(manual.quantity) || 1));
    if (!name) { setProblem("Enter the lens name"); return; }
    if (!(price > 0)) { setProblem("Enter the lens price"); return; }
    onPick({ productId: null, name, brand: "", price, quantity });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={`Lens for ${frameName}`}
        className="glass-modal solid-sheet p-5 w-full max-w-lg animate-rise max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <h3 className="text-base font-semibold">Lens for this frame?</h3>
            <p className="text-xs text-muted-foreground truncate">{frameName}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="cursor-pointer flex-shrink-0"><X className="w-5 h-5" /></button>
        </div>

        <div className="relative mb-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" autoFocus value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={onSearchKey}
            placeholder="Search lenses by name, brand or type, or scan one..."
            className="w-full pl-10 pr-4 py-2.5 glass-input text-sm" />
        </div>

        {categories.length > 1 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {[["all", lenses.length] as const, ...categories].map(([c, n]) => (
              <button key={c} onClick={() => setCategory(c)}
                className={`px-3 py-1 rounded-full text-[11px] font-medium cursor-pointer transition-colors ${
                  category === c ? "bg-primary text-white" : "bg-surface hover:bg-surface-hover"
                }`}>
                {`${c === "all" ? "All lenses" : c} (${n})`}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 min-h-[8rem] overflow-y-auto rounded-xl border border-border divide-y divide-border">
          {shown.length === 0 && (
            <p className="px-4 py-6 text-xs text-center text-muted-foreground">
              {query.trim() ? `No lens matches "${query.trim()}". Type it in below.` : "No lenses in the stock yet. Type one in below."}
            </p>
          )}
          {shown.map((p) => {
            const out = p.stock <= 0;
            const detail = [p.model, p.colour, p.type, p.size].filter(Boolean).join(" · ");
            return (
              <button key={p.id} onClick={() => pick(p)} disabled={out}
                className="w-full text-left px-3 py-2.5 flex items-center justify-between gap-3 hover:bg-surface-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
                <span className="min-w-0">
                  <span className="block text-sm font-medium truncate">{`${p.brand} ${p.name}`.trim()}</span>
                  <span className="block text-[11px] text-muted-foreground truncate">{[p.category, detail].filter(Boolean).join(" · ")}</span>
                </span>
                <span className="flex-shrink-0 text-right">
                  <span className="block text-sm font-bold text-primary">{formatCurrency(p.salePrice)}</span>
                  <span className={`block text-[10px] ${out || p.stock <= p.lowStockThreshold ? "text-destructive" : "text-muted-foreground"}`}>
                    {out ? "Out of stock" : `${p.stock} left`}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {typing ? (
          <div className="mt-3 p-3 rounded-xl border border-primary/30 bg-primary/5 space-y-2">
            <p className="text-xs font-semibold flex items-center gap-1.5"><PenLine className="w-3.5 h-3.5 text-primary" /> Type a lens in</p>
            <div className="grid grid-cols-[1fr_5.5rem_3.5rem] gap-2">
              <input type="text" value={manual.name} onChange={(e) => { setManual({ ...manual, name: e.target.value }); setProblem(""); }}
                onKeyDown={(e) => { if (e.key === "Enter") addTyped(); }}
                placeholder="Lens name *" className="px-3 py-2 glass-input text-xs" />
              <input type="number" min={0} value={manual.price} onChange={(e) => { setManual({ ...manual, price: e.target.value }); setProblem(""); }}
                onKeyDown={(e) => { if (e.key === "Enter") addTyped(); }}
                placeholder="Price *" className="px-3 py-2 glass-input text-xs" />
              <input type="number" min={1} value={manual.quantity} onChange={(e) => setManual({ ...manual, quantity: e.target.value })}
                onKeyDown={(e) => { if (e.key === "Enter") addTyped(); }}
                placeholder="Qty" title="Number of lenses: a pair is 2" className="px-2 py-2 glass-input text-xs text-center" />
            </div>
            {problem && <p className="text-[11px] text-destructive">{problem}</p>}
            <div className="flex gap-2">
              <button onClick={addTyped}
                className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary-hover transition-colors cursor-pointer">
                <Plus className="w-3.5 h-3.5" /> Add this lens
              </button>
              <button onClick={() => { setTyping(false); setProblem(""); }} className="px-3 py-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer">
                Back to the list
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setTyping(true)}
            className="mt-3 flex items-center gap-1.5 text-xs text-primary font-semibold cursor-pointer self-start">
            <PenLine className="w-3.5 h-3.5" /> Lens not in the list? Type it in with its price
          </button>
        )}

        <div className="mt-4 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
          <label className="flex items-center gap-2 text-[11px] text-muted-foreground cursor-pointer">
            <input type="checkbox" className="rounded" checked={offerEveryTime} onChange={(e) => onOfferChange(e.target.checked)} />
            Offer lenses every time I add a frame
          </label>
          <button onClick={onClose}
            className="px-4 py-2.5 glass-card text-sm font-medium cursor-pointer whitespace-nowrap">
            No lens for this frame
          </button>
        </div>
      </div>
    </div>
  );
}

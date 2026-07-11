"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { Product } from "@/lib/mock/types";
import type { StockAdjustmentView } from "@/lib/data";
import { formatDate } from "@/lib/utils/format";
import { useApp } from "@/lib/context";
import { createStockAdjustment } from "@/lib/actions/stock-adjustments";
import { ClipboardList, Plus, X, Search, Loader2 } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";

const ADJUSTMENT_REASONS = ["Damage", "Theft/Shrinkage", "Recount", "Expired/Obsolete", "Other"] as const;

export function AdjustmentsClient({ products, adjustments }: { products: Product[]; adjustments: StockAdjustmentView[] }) {
  const { showToast } = useApp();
  const router = useRouter();

  const [showAdjust, setShowAdjust] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [newStock, setNewStock] = useState<number | "">("");
  const [reason, setReason] = useState<string>(ADJUSTMENT_REASONS[0]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const filteredProducts = useMemo(() => {
    if (!productSearch) return [];
    const q = productSearch.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q)).slice(0, 6);
  }, [products, productSearch]);

  const openAdjust = () => {
    setSelectedProduct(null);
    setProductSearch("");
    setNewStock("");
    setReason(ADJUSTMENT_REASONS[0]);
    setNotes("");
    setShowAdjust(true);
  };

  const pickProduct = (p: Product) => {
    setSelectedProduct(p);
    setNewStock(p.stock);
    setProductSearch("");
  };

  const delta = selectedProduct && newStock !== "" ? Number(newStock) - selectedProduct.stock : 0;

  const save = async () => {
    if (!selectedProduct) { showToast("Select a product", "error"); return; }
    if (newStock === "" || Number(newStock) < 0) { showToast("Enter a valid new stock count", "error"); return; }
    setSaving(true);
    try {
      await createStockAdjustment({ productId: selectedProduct.id, newStock: Number(newStock), reason, notes });
      showToast(`Stock adjusted (${delta > 0 ? "+" : ""}${delta})`, "success");
      setShowAdjust(false);
      router.refresh();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Could not adjust stock", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Stock Adjustments</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Correct stock counts for damage, shrinkage, or recounts — with a full audit trail</p>
        </div>
        <button onClick={openAdjust}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-2xl text-sm font-medium hover:bg-primary-hover transition-colors">
          <Plus className="w-4 h-4" /> Adjust Stock
        </button>
      </div>

      {adjustments.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No adjustments yet" hint="Corrections you make to stock counts will show up here with who made them and why." />
      ) : (
        <div className="glass-card p-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Date</th>
                  <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Product</th>
                  <th className="text-center py-3 px-3 text-xs font-medium text-muted-foreground">Before</th>
                  <th className="text-center py-3 px-3 text-xs font-medium text-muted-foreground">After</th>
                  <th className="text-center py-3 px-3 text-xs font-medium text-muted-foreground">Change</th>
                  <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Reason</th>
                  <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Adjusted By</th>
                </tr>
              </thead>
              <tbody>
                {adjustments.map((a) => (
                  <tr key={a.id} className="border-b border-border hover:bg-surface-hover/50 transition-colors">
                    <td className="py-3 px-3 text-muted-foreground">{formatDate(a.date)}</td>
                    <td className="py-3 px-3 font-medium">{a.productName}</td>
                    <td className="py-3 px-3 text-center text-muted-foreground">{a.previousStock}</td>
                    <td className="py-3 px-3 text-center font-medium">{a.newStock}</td>
                    <td className="py-3 px-3 text-center">
                      <span className={a.delta > 0 ? "text-success" : "text-destructive"}>{a.delta > 0 ? "+" : ""}{a.delta}</span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="chip bg-surface text-muted-foreground">{a.reason}</span>
                      {a.notes && <p className="text-[10px] text-muted-foreground mt-1">{a.notes}</p>}
                    </td>
                    <td className="py-3 px-3 text-xs text-muted-foreground">{a.adjustedByName || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showAdjust && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowAdjust(false)}>
          <div className="glass-modal p-6 w-full max-w-md animate-rise" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Adjust Stock</h3>
              <button onClick={() => setShowAdjust(false)} className="cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              {!selectedProduct ? (
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Product *</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <input type="text" placeholder="Search products..." value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)} className="w-full pl-9 pr-4 py-2 glass-input text-sm" />
                  </div>
                  {filteredProducts.length > 0 && (
                    <div className="mt-1 glass rounded-xl p-1.5 max-h-36 overflow-y-auto">
                      {filteredProducts.map((p) => (
                        <button key={p.id} onClick={() => pickProduct(p)}
                          className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-surface-hover text-xs cursor-pointer">
                          {p.brand} {p.name} · Current stock {p.stock}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-3 bg-surface rounded-xl flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{selectedProduct.brand} {selectedProduct.name}</p>
                    <p className="text-xs text-muted-foreground">Current stock: {selectedProduct.stock}</p>
                  </div>
                  <button onClick={() => setSelectedProduct(null)} className="text-xs text-primary cursor-pointer">Change</button>
                </div>
              )}

              {selectedProduct && (
                <>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">New Stock Count *</label>
                    <input type="number" min={0} value={newStock} onChange={(e) => setNewStock(e.target.value === "" ? "" : Number(e.target.value))}
                      className="w-full px-4 py-2.5 glass-input text-sm" />
                    {newStock !== "" && delta !== 0 && (
                      <p className={`text-xs mt-1 ${delta > 0 ? "text-success" : "text-destructive"}`}>
                        {delta > 0 ? "+" : ""}{delta} from current stock
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Reason *</label>
                    <select value={reason} onChange={(e) => setReason(e.target.value)} className="w-full px-4 py-2.5 glass-input text-sm">
                      {ADJUSTMENT_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Notes (optional)</label>
                    <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full px-4 py-2.5 glass-input text-sm" placeholder="Any additional detail..." />
                  </div>
                  <button onClick={save} disabled={saving || newStock === "" || delta === 0}
                    className="w-full py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-hover transition-colors disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer">
                    {saving && <Loader2 className="w-4 h-4 animate-spin" />} Save Adjustment
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

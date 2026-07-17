"use client";

import { useState, useMemo } from "react";
import type { Product } from "@/lib/mock/types";
import { useApp } from "@/lib/context";
import { useRouter } from "next/navigation";
import { backfillBarcodes } from "@/lib/actions/products";
import { BarcodeSVG } from "@/components/ui/BarcodeSVG";
import { EmptyState } from "@/components/ui/EmptyState";
import { printWithPageSize } from "@/lib/utils/print";
import { Search, Barcode, Printer, Wand2, Loader2 } from "lucide-react";

export function LabelsClient({ products, barcodeWidth, barcodeHeight }: { products: Product[]; barcodeWidth: number; barcodeHeight: number }) {
  const { showToast } = useApp();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [generating, setGenerating] = useState(false);

  const missingCount = products.filter((p) => !p.barcode).length;

  const filtered = useMemo(() => {
    if (!search) return products;
    const q = search.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q) || p.barcode.includes(q));
  }, [products, search]);

  const generateMissing = async () => {
    setGenerating(true);
    try {
      const res = await backfillBarcodes();
      showToast(res.updated > 0 ? `Generated ${res.updated} barcode${res.updated === 1 ? "" : "s"}` : "Every product already has a barcode", "success");
      router.refresh();
    } catch {
      showToast("Could not generate barcodes", "error");
    } finally {
      setGenerating(false);
    }
  };

  const printAll = () => {
    printWithPageSize("printing-all-labels", "2in 1in");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="no-print flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Barcode Labels</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Generate and print 2&quot; x 1&quot; barcode labels for your products</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={generateMissing} disabled={generating || missingCount === 0}
            className="flex items-center gap-2 px-4 py-2.5 glass-card text-sm font-medium cursor-pointer disabled:opacity-60">
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            {missingCount > 0 ? `Generate Missing (${missingCount})` : "All Products Have Barcodes"}
          </button>
          <button onClick={printAll} disabled={filtered.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-2xl text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-60">
            <Printer className="w-4 h-4" /> Print All ({filtered.length})
          </button>
        </div>
      </div>

      <div className="no-print relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search products, brands, or barcodes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 glass-input text-sm"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Barcode} title="No products match" hint="Try another name, brand, or barcode." />
      ) : (
        <div className="label-grid glass-card p-5 flex flex-wrap gap-4 justify-center print:bg-white">
          {filtered.map((p) => (
            <div key={p.id} className="product-label bg-white text-black rounded-lg border border-gray-200 p-2 flex flex-col items-center justify-center" style={{ width: "2in", minHeight: "1in" }}>
              <p className="text-[9px] font-semibold text-center leading-tight">{p.brand} {p.name}</p>
              {p.barcode ? (
                <BarcodeSVG value={p.barcode} width={barcodeWidth} height={barcodeHeight * 0.6} fontSize={9} />
              ) : (
                <p className="text-[9px] text-gray-400 mt-2">No barcode yet</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

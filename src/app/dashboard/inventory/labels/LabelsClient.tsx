"use client";

import { useState, useMemo, useEffect } from "react";
import type { Product } from "@/lib/mock/types";
import { useApp } from "@/lib/context";
import { useRouter } from "next/navigation";
import { backfillBarcodes } from "@/lib/actions/products";
import { formatCurrency } from "@/lib/utils/format";
import { BarcodeSVG } from "@/components/ui/BarcodeSVG";
import { EmptyState } from "@/components/ui/EmptyState";
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

  // Keeping the print-isolation class on <body> until the dialog closes (rather
  // than removing it on the next line) is what stops the browser printing a
  // blank or full page -- the same fix used for the receipt and single label.
  const runPrint = (cls: string, onDone?: () => void) => {
    const cleanup = () => {
      document.body.classList.remove(cls);
      window.removeEventListener("afterprint", cleanup);
      onDone?.();
    };
    document.body.classList.add(cls);
    window.addEventListener("afterprint", cleanup);
    window.print();
    setTimeout(cleanup, 1500);
  };

  const printAll = () => runPrint("printing-all-labels");

  // Printing one sticker at a time: mark the chosen label, let React commit
  // that class, then print -- otherwise the print fires before the DOM updates.
  const [printingId, setPrintingId] = useState<string | null>(null);
  useEffect(() => {
    if (!printingId) return;
    runPrint("printing-one-label", () => setPrintingId(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [printingId]);

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
            <div key={p.id} className="label-cell flex flex-col items-center gap-1.5">
              <div className={`product-label bg-white text-black rounded-lg border border-gray-200 flex flex-col items-center justify-center ${printingId === p.id ? "print-target" : ""}`}
                style={{ width: "2in", minHeight: "1in" }}>
                <p className="text-[10px] font-semibold text-center leading-tight">{p.brand} {p.name}</p>
                <p className="text-[10px] font-bold leading-tight">{formatCurrency(p.salePrice)}</p>
                {p.barcode ? (
                  <BarcodeSVG value={p.barcode} width={barcodeWidth} height={barcodeHeight * 0.6} fontSize={13} />
                ) : (
                  <p className="text-[9px] text-gray-400 mt-2">No barcode yet</p>
                )}
              </div>
              <button onClick={() => setPrintingId(p.id)} disabled={!p.barcode || printingId !== null}
                title={p.barcode ? "Print just this label" : "Generate a barcode first"}
                className="no-print flex items-center gap-1.5 px-3 py-1.5 glass-card text-[11px] font-medium cursor-pointer disabled:opacity-50">
                <Printer className="w-3 h-3" /> Print this
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

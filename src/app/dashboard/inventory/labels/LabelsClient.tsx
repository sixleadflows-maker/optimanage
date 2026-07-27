"use client";

import { useState, useMemo, useEffect } from "react";
import type { Product } from "@/lib/mock/types";
import { useApp } from "@/lib/context";
import { useRouter } from "next/navigation";
import { backfillBarcodes } from "@/lib/actions/products";
import { LabelSticker } from "@/components/ui/LabelSticker";
import { PrintPortal } from "@/components/ui/PrintPortal";
import { applyLabelPageSize } from "@/lib/utils/printLabel";
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

  // What to print: one product's sticker, or every filtered one. Setting this
  // renders the stickers into the body-level print container; the effect below
  // then prints once React has committed them.
  const [printJob, setPrintJob] = useState<Product[] | null>(null);
  useEffect(() => {
    if (!printJob) return;
    const cls = "printing-all-labels";
    let timer: ReturnType<typeof setTimeout>;
    const removePageSize = applyLabelPageSize();
    const cleanup = () => {
      document.body.classList.remove(cls);
      removePageSize();
      window.removeEventListener("afterprint", cleanup);
      setPrintJob(null);
    };
    document.body.classList.add(cls);
    window.addEventListener("afterprint", cleanup);
    // Wait for the stickers to be painted into the print container before
    // printing — otherwise the print can beat the portal's render.
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.print();
        timer = setTimeout(cleanup, 1500);
      });
    });
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [printJob]);

  const printAll = () => setPrintJob(filtered.filter((p) => p.barcode));

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
              <LabelSticker title={`${p.brand} ${p.name}`.trim()} price={p.salePrice} barcode={p.barcode}
                barcodeWidth={barcodeWidth} barcodeHeight={barcodeHeight * 0.45} bordered />
              <button onClick={() => setPrintJob([p])} disabled={!p.barcode || printJob !== null}
                title={p.barcode ? "Print just this label" : "Generate a barcode first"}
                className="no-print flex items-center gap-1.5 px-3 py-1.5 glass-card text-[11px] font-medium cursor-pointer disabled:opacity-50">
                <Printer className="w-3 h-3" /> Print this
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Always mounted so the print container exists before any print call;
          only its contents are conditional (see ProductForm for the why). */}
      <PrintPortal>
        {printJob?.map((p) => (
          <LabelSticker key={p.id} title={`${p.brand} ${p.name}`.trim()} price={p.salePrice} barcode={p.barcode}
            barcodeWidth={barcodeWidth} barcodeHeight={barcodeHeight * 0.45} />
        ))}
      </PrintPortal>
    </div>
  );
}

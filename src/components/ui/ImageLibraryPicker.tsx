"use client";

import { useEffect, useMemo, useState } from "react";
import { listImageLibrary, type LibraryImage } from "@/lib/actions/upload";
import { EmptyState } from "@/components/ui/EmptyState";
import { Check, Images, Loader2, Search, X } from "lucide-react";

/**
 * Pick photos that are already in the system instead of uploading them again —
 * handy when several colours of the same frame share a picture. Photos used by
 * products matching `matchText` (the brand/model being edited) are listed first.
 */
export function ImageLibraryPicker({
  current, matchText, onAdd, onClose,
}: {
  current: string[];
  matchText: string;
  onAdd: (urls: string[]) => void;
  onClose: () => void;
}) {
  const [images, setImages] = useState<LibraryImage[] | null>(null);
  const [storeUnavailable, setStoreUnavailable] = useState(false);
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    listImageLibrary()
      .then((res) => {
        if (cancelled) return;
        setImages(res.images);
        setStoreUnavailable(res.storeUnavailable);
      })
      .catch(() => {
        if (!cancelled) {
          setImages([]);
          setStoreUnavailable(true);
        }
      });
    return () => { cancelled = true; };
  }, []);

  const shown = useMemo(() => {
    if (!images) return [];
    const q = search.trim().toLowerCase();
    const words = matchText.toLowerCase().split(/\s+/).filter((w) => w.length > 1);
    const relevance = (img: LibraryImage) =>
      words.length === 0 ? 0 : img.usedBy.some((label) => words.every((w) => label.toLowerCase().includes(w))) ? 1 : 0;
    return images
      .filter((img) => !q || img.usedBy.some((label) => label.toLowerCase().includes(q)) || decodeURIComponent(img.url).toLowerCase().includes(q))
      .map((img, index) => ({ img, index, score: relevance(img) }))
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .map((x) => x.img);
  }, [images, search, matchText]);

  const toggle = (url: string) =>
    setPicked((prev) => (prev.includes(url) ? prev.filter((u) => u !== url) : [...prev, url]));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="glass-modal p-5 w-full max-w-2xl animate-rise max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold flex items-center gap-2"><Images className="w-5 h-5" /> Photo Library</h3>
          <button onClick={onClose} className="cursor-pointer"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Photos already in the system. Pick one or more to use them on this product — nothing is uploaded again.
        </p>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} autoFocus
            placeholder="Search by brand, model or product name..." className="w-full pl-9 pr-4 py-2 glass-input text-sm" />
        </div>

        {storeUnavailable && (
          <p className="text-[11px] text-warning mb-2">
            Couldn&apos;t reach the photo store just now — showing photos already on products only.
          </p>
        )}

        <div className="flex-1 overflow-y-auto min-h-[200px]">
          {images === null ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground text-sm gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading photos…
            </div>
          ) : shown.length === 0 ? (
            <EmptyState icon={Images}
              title={images.length === 0 ? "No photos in the system yet" : "No photos match"}
              hint={images.length === 0
                ? "Upload a photo on any product and it will be available here for the next one."
                : "Try a different brand or model."} />
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
              {shown.map((img) => {
                const already = current.includes(img.url);
                const selected = picked.includes(img.url);
                return (
                  <button key={img.url} type="button" disabled={already} onClick={() => toggle(img.url)}
                    title={img.usedBy.length ? `Used on: ${img.usedBy.join(", ")}` : "Not on any product yet"}
                    className={`relative text-left rounded-xl overflow-hidden border-2 transition-all cursor-pointer disabled:cursor-not-allowed ${
                      selected ? "border-primary" : "border-transparent hover:border-primary/30"
                    }`}>
                    <div className="aspect-square bg-surface">
                      <img src={img.url} alt="" loading="lazy" className={`w-full h-full object-cover ${already ? "opacity-40" : ""}`} />
                    </div>
                    <p className="text-[10px] px-1.5 py-1 truncate text-muted-foreground bg-surface">
                      {already ? "Already on this product" : img.usedBy[0] ?? "Not used yet"}
                    </p>
                    {selected && (
                      <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center">
                        <Check className="w-3 h-3" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-4">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 glass-card text-sm font-medium cursor-pointer">Cancel</button>
          <button type="button" disabled={picked.length === 0} onClick={() => onAdd(picked)}
            className="flex-1 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-hover transition-colors disabled:opacity-50 cursor-pointer">
            {picked.length === 0 ? "Select photos" : `Use ${picked.length} photo${picked.length === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
    </div>
  );
}

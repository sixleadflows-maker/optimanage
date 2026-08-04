"use client";

import { useState, useMemo } from "react";
import type { Product } from "@/lib/mock/types";
import { formatCurrency } from "@/lib/utils/format";
import { PRODUCT_CATEGORIES, BRAND_TAGS } from "@/lib/constants";
import { Search, Grid3X3, List, Plus, AlertTriangle, PackageX, X } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { firstImage } from "@/lib/utils/images";

// Matches on substring so the kids/sports variants pick up the right icon
// without needing a new case each time a category is added.
function categoryIcon(category: string) {
  if (category.includes("Contact")) return "👁";
  if (category.includes("Sunglass")) return "🕶";
  if (category.includes("Lens")) return "🔍";
  return "👓";
}

export function InventoryClient({ products, isOwner }: { products: Product[]; isOwner: boolean }) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [tagFilter, setTagFilter] = useState<string>("All");
  const [stockFilter, setStockFilter] = useState<"all" | "out">("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.brand.toLowerCase().includes(search.toLowerCase()) ||
        p.model.toLowerCase().includes(search.toLowerCase()) ||
        p.barcode.includes(search);
      const matchesCategory = categoryFilter === "All" || p.category === categoryFilter;
      const matchesTag = tagFilter === "All" || p.brandTag === tagFilter;
      const matchesStock = stockFilter === "all" || p.stock <= 0;
      return matchesSearch && matchesCategory && matchesTag && matchesStock;
    });
  }, [products, search, categoryFilter, tagFilter, stockFilter]);

  // Counts sit on the buttons so staff can see at a glance how many copies are
  // in stock without switching filters.
  const tagCounts = useMemo(() => {
    const counts: Record<string, number> = { All: products.length };
    for (const p of products) counts[p.brandTag] = (counts[p.brandTag] ?? 0) + 1;
    return counts;
  }, [products]);

  const totalStock = products.reduce((sum, p) => sum + p.stock, 0);
  const lowStockCount = products.filter((p) => p.stock <= p.lowStockThreshold).length;
  const outOfStockCount = products.filter((p) => p.stock <= 0).length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Inventory</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{products.length} products · {totalStock} units in stock</p>
        </div>
        <Link href="/dashboard/inventory/new" className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-hover transition-colors">
          <Plus className="w-4 h-4" /> Add Product
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card p-4">
          <p className="text-xs text-muted-foreground">Total Products</p>
          <p className="text-xl font-bold mt-1">{products.length}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-destructive" /> Low Stock
          </p>
          <p className="text-xl font-bold mt-1 text-destructive">{lowStockCount} items</p>
        </div>
        {/* Called out separately so a frame saved without a quantity, or one
            that has sold out, is obvious rather than sitting unnoticed. */}
        <button onClick={() => { setStockFilter(outOfStockCount > 0 ? "out" : "all"); }}
          className="glass-card p-4 text-left cursor-pointer hover:border-primary/30 transition-all">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <PackageX className="w-3 h-3" /> Out of Stock
          </p>
          <p className={`text-xl font-bold mt-1 ${outOfStockCount > 0 ? "text-warning" : ""}`}>{outOfStockCount} items</p>
        </button>
      </div>

      {stockFilter === "out" && (
        <div className="glass-card p-3 flex items-center justify-between gap-3 border-l-4 border-warning">
          <p className="text-sm">Showing only items with nothing left in stock.</p>
          <button onClick={() => setStockFilter("all")}
            className="flex items-center gap-1.5 px-3 py-1.5 glass-card text-xs font-medium cursor-pointer">
            <X className="w-3 h-3" /> Show all
          </button>
        </div>
      )}

      <div className="glass-card p-4">
        {/* Original vs Copy is the split staff need most when hunting for a
            frame on the shelf, so it gets its own prominent row rather than
            being buried as a per-product badge. */}
        <div className="flex items-center gap-2 flex-wrap mb-4 pb-4 border-b border-border">
          <span className="text-xs font-medium text-muted-foreground mr-1">Show:</span>
          {["All", ...BRAND_TAGS].map((tag) => {
            const active = tagFilter === tag;
            const tone =
              tag === "Original" ? "bg-success text-white"
              : tag === "Copy" ? "bg-warning text-white"
              : tag === "Branded" ? "bg-primary text-white"
              : tag === "Unbranded" ? "bg-muted-foreground text-white"
              : "bg-primary text-white";
            return (
              <button key={tag} onClick={() => setTagFilter(tag)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${active ? tone : "bg-surface hover:bg-surface-hover"}`}>
                {tag === "All" ? "All items" : tag} ({tagCounts[tag] ?? 0})
              </button>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input type="text" placeholder="Search products, brands, barcodes..." value={search}
              onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2 glass-input text-sm" />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {["All", ...PRODUCT_CATEGORIES].map((cat) => (
              <button key={cat} onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-2 rounded-xl text-xs font-medium transition-all whitespace-nowrap ${categoryFilter === cat ? "bg-primary text-white" : "bg-surface hover:bg-surface-hover"}`}>
                {cat}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            <button onClick={() => setViewMode("grid")} className={`p-2 rounded-lg ${viewMode === "grid" ? "bg-primary text-white" : "bg-surface"}`}>
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button onClick={() => setViewMode("list")} className={`p-2 rounded-lg ${viewMode === "list" ? "bg-primary text-white" : "bg-surface"}`}>
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState title="No frames match" hint="Try another name, brand, or barcode — or add it as a new product." />
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 stagger-rise">
            {filtered.map((product) => (
              <Link href={`/dashboard/inventory/${product.id}`} key={product.id}
                className={`glass-card p-3 block hover:border-primary/30 transition-all ${product.stock <= product.lowStockThreshold ? "ring-1 ring-destructive/20" : ""}`}>
                <div className="w-full aspect-square rounded-xl bg-gradient-to-br from-surface to-muted flex items-center justify-center mb-2 overflow-hidden">
                  {firstImage(product.image) ? (
                    <img src={firstImage(product.image)} alt={product.name} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <span className="text-2xl opacity-40">{categoryIcon(product.category)}</span>
                  )}
                </div>
                <p className="text-xs font-medium truncate">{product.brand} {product.name}</p>
                <p className="text-[10px] text-muted-foreground truncate">{product.model}</p>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-sm font-bold text-primary">{formatCurrency(product.salePrice)}</span>
                  <span className={`text-[10px] font-medium ${product.stock <= product.lowStockThreshold ? "text-destructive" : "text-muted-foreground"}`}>
                    {product.stock <= product.lowStockThreshold && "⚠ "}{product.stock} in stock
                  </span>
                </div>
                <div className="flex gap-1 mt-2 flex-wrap">
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-medium ${product.brandTag === "Original" ? "bg-success/10 text-success" : product.brandTag === "Copy" ? "bg-warning/10 text-warning" : product.brandTag === "Branded" ? "bg-primary/10 text-primary" : "bg-surface text-muted-foreground"}`}>{product.brandTag}</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-surface text-muted-foreground">{product.type}</span>
                  {product.isDamaged && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-destructive/10 text-destructive font-medium">⚠ Damaged</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Product</th>
                  <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Type</th>
                  <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Colour</th>
                  <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Size</th>
                  {isOwner && <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">Cost</th>}
                  <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">Price</th>
                  <th className="text-center py-3 px-3 text-xs font-medium text-muted-foreground">Stock</th>
                  <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Barcode</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className={`border-b border-border hover:bg-surface-hover/50 transition-colors ${p.stock <= p.lowStockThreshold ? "bg-destructive/5" : ""}`}>
                    <td className="py-3 px-3">
                      <Link href={`/dashboard/inventory/${p.id}`} className="hover:text-primary">
                        <p className="font-medium flex items-center gap-1.5">
                          {p.brand} {p.name}
                          {p.isDamaged && <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-destructive/10 text-destructive font-medium">⚠ Damaged</span>}
                        </p>
                        <p className="text-xs text-muted-foreground">{p.model}</p>
                      </Link>
                    </td>
                    <td className="py-3 px-3 text-xs">{p.type}</td>
                    <td className="py-3 px-3 text-xs">{p.colour}</td>
                    <td className="py-3 px-3 text-xs text-muted-foreground">{p.size}</td>
                    {isOwner && <td className="py-3 px-3 text-right text-xs text-muted-foreground">{formatCurrency(p.costPrice)}</td>}
                    <td className="py-3 px-3 text-right font-medium">{formatCurrency(p.salePrice)}</td>
                    <td className="py-3 px-3 text-center">
                      <span className={`text-xs font-medium ${p.stock <= p.lowStockThreshold ? "text-destructive" : ""}`}>
                        {p.stock <= p.lowStockThreshold && "⚠ "}{p.stock}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-xs font-mono text-muted-foreground">{p.barcode}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { use, useState } from "react";
import { products } from "@/lib/mock";
import { formatCurrency } from "@/lib/utils/format";
import { useApp } from "@/lib/context";
import { PRODUCT_CATEGORIES, PRODUCT_TYPES, BRAND_TAGS } from "@/lib/constants";
import { ArrowLeft, Save, Barcode, Shield, ShieldAlert, ShieldOff, ImagePlus } from "lucide-react";
import Link from "next/link";

const brandTagConfig = {
  Original: { icon: Shield, color: "bg-success/10 text-success border-success/20", label: "Original" },
  Copy: { icon: ShieldAlert, color: "bg-warning/10 text-warning border-warning/20", label: "Copy" },
  Unbranded: { icon: ShieldOff, color: "bg-muted text-muted-foreground border-border", label: "Unbranded" },
} as const;

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { showToast } = useApp();
  const product = products.find((p) => p.id === id);
  const isNew = id === "new";

  const [form, setForm] = useState({
    name: product?.name || "",
    brand: product?.brand || "",
    model: product?.model || "",
    category: product?.category || "Frames",
    type: product?.type || "Acetate",
    colour: product?.colour || "",
    size: product?.size || "",
    costPrice: product?.costPrice || 0,
    salePrice: product?.salePrice || 0,
    stock: product?.stock || 0,
    barcode: product?.barcode || "",
    lowStockThreshold: product?.lowStockThreshold || 5,
    brandTag: (product?.brandTag || "Unbranded") as "Original" | "Copy" | "Unbranded",
    priceThreshold: product?.priceThreshold || 0,
    image: product?.image || "",
  });

  const update = (field: string, value: string | number) => setForm((p) => ({ ...p, [field]: value }));

  const handleSave = () => {
    showToast(isNew ? "Product added successfully (demo)" : "Product updated successfully (demo)", "success");
  };

  const barcodeDisplay = form.barcode || "0000000000000";
  const belowThreshold = form.priceThreshold > 0 && form.salePrice < form.priceThreshold;
  const tagConf = brandTagConfig[form.brandTag];
  const TagIcon = tagConf.icon;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/inventory" className="p-2 rounded-xl hover:bg-surface-hover transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{isNew ? "Add New Product" : "Edit Product"}</h1>
          {!isNew && (
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-sm text-muted-foreground">{product?.brand} {product?.model}</p>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${tagConf.color}`}>
                <TagIcon className="w-3 h-3" /> {tagConf.label}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold mb-4">Basic Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Product Name</label>
                <input type="text" value={form.name} onChange={(e) => update("name", e.target.value)} className="w-full px-4 py-2.5 glass-input text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Brand</label>
                <input type="text" value={form.brand} onChange={(e) => update("brand", e.target.value)} className="w-full px-4 py-2.5 glass-input text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Model #</label>
                <input type="text" value={form.model} onChange={(e) => update("model", e.target.value)} className="w-full px-4 py-2.5 glass-input text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Category (Sunglass / Frame)</label>
                <select value={form.category} onChange={(e) => update("category", e.target.value)} className="w-full px-4 py-2.5 glass-input text-sm">
                  {PRODUCT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Type</label>
                <select value={form.type} onChange={(e) => update("type", e.target.value)} className="w-full px-4 py-2.5 glass-input text-sm">
                  {PRODUCT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Colour</label>
                <input type="text" value={form.colour} onChange={(e) => update("colour", e.target.value)} className="w-full px-4 py-2.5 glass-input text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Size</label>
                <input type="text" value={form.size} onChange={(e) => update("size", e.target.value)} className="w-full px-4 py-2.5 glass-input text-sm" placeholder="e.g. 54-18-140" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Barcode</label>
                <input type="text" value={form.barcode} onChange={(e) => update("barcode", e.target.value)} className="w-full px-4 py-2.5 glass-input text-sm font-mono" />
              </div>
            </div>
          </div>

          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold mb-4">Brand Tag</h3>
            <div className="grid grid-cols-3 gap-3">
              {BRAND_TAGS.map((tag) => {
                const conf = brandTagConfig[tag];
                const Icon = conf.icon;
                const active = form.brandTag === tag;
                return (
                  <button key={tag} onClick={() => update("brandTag", tag)}
                    className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                      active ? `${conf.color} border-current` : "bg-surface hover:bg-surface-hover border-transparent"
                    }`}>
                    <Icon className={`w-6 h-6 ${active ? "" : "opacity-40"}`} />
                    <span className="text-sm font-medium">{tag}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold mb-4">Pricing & Stock</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Cost Price</label>
                <input type="number" value={form.costPrice || ""} onChange={(e) => update("costPrice", Number(e.target.value))} className="w-full px-4 py-2.5 glass-input text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Sale Price</label>
                <input type="number" value={form.salePrice || ""} onChange={(e) => update("salePrice", Number(e.target.value))}
                  className={`w-full px-4 py-2.5 glass-input text-sm ${belowThreshold ? "ring-2 ring-destructive/40" : ""}`} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Price Threshold</label>
                <input type="number" value={form.priceThreshold || ""} onChange={(e) => update("priceThreshold", Number(e.target.value))}
                  className="w-full px-4 py-2.5 glass-input text-sm" placeholder="Min sell price" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Current Stock</label>
                <input type="number" value={form.stock || ""} onChange={(e) => update("stock", Number(e.target.value))} className="w-full px-4 py-2.5 glass-input text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Low Stock Alert</label>
                <input type="number" value={form.lowStockThreshold || ""} onChange={(e) => update("lowStockThreshold", Number(e.target.value))} className="w-full px-4 py-2.5 glass-input text-sm" />
              </div>
            </div>
            <div className="flex flex-col gap-2 mt-4">
              {form.costPrice > 0 && form.salePrice > 0 && (
                <div className="p-3 bg-success/5 rounded-xl">
                  <p className="text-xs text-success font-medium">
                    Margin: {formatCurrency(form.salePrice - form.costPrice)} ({((form.salePrice - form.costPrice) / form.salePrice * 100).toFixed(1)}%)
                  </p>
                </div>
              )}
              {belowThreshold && (
                <div className="p-3 bg-destructive/5 rounded-xl">
                  <p className="text-xs text-destructive font-medium">
                    Sale price ({formatCurrency(form.salePrice)}) is below the threshold ({formatCurrency(form.priceThreshold)})
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold mb-4">Product Image</h3>
            <div className="aspect-square rounded-xl bg-gradient-to-br from-surface to-muted flex items-center justify-center overflow-hidden">
              {form.image ? (
                <img src={form.image} alt={form.name} className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <ImagePlus className="w-10 h-10 opacity-30" />
                  <span className="text-xs opacity-50">No image</span>
                </div>
              )}
            </div>
            <div className="mt-3">
              <input type="text" value={form.image} onChange={(e) => update("image", e.target.value)}
                className="w-full px-3 py-2 glass-input text-xs" placeholder="Image URL..." />
            </div>
          </div>

          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold mb-3">Quick Info</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Category</span>
                <span className="font-medium">{form.category}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Type</span>
                <span className="font-medium">{form.type}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Brand Tag</span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${tagConf.color}`}>
                  <TagIcon className="w-3 h-3" /> {form.brandTag}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Sale Price</span>
                <span className="font-medium">{formatCurrency(form.salePrice)}</span>
              </div>
              {form.priceThreshold > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Threshold</span>
                  <span className={`font-medium ${belowThreshold ? "text-destructive" : ""}`}>{formatCurrency(form.priceThreshold)}</span>
                </div>
              )}
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Stock</span>
                <span className={`font-medium ${form.stock <= form.lowStockThreshold ? "text-destructive" : ""}`}>{form.stock} units</span>
              </div>
            </div>
          </div>

          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <Barcode className="w-4 h-4" /> Barcode Preview
            </h3>
            <div className="bg-white p-4 rounded-xl">
              <div className="flex justify-center gap-[1px]">
                {barcodeDisplay.split("").map((digit, i) => (
                  <div key={i} className="flex flex-col items-center">
                    <div className="w-[2px] bg-black" style={{ height: `${40 + (parseInt(digit) % 3) * 8}px` }} />
                    <span className="text-[8px] text-black mt-1 font-mono">{digit}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <button onClick={handleSave}
            className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-white rounded-2xl text-sm font-semibold hover:bg-primary-hover transition-colors">
            <Save className="w-4 h-4" /> {isNew ? "Add Product" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

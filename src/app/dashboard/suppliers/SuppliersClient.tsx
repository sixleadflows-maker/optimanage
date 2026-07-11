"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { Supplier, PurchaseOrder } from "@/lib/mock/types";
import type { Product } from "@/lib/mock/types";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { useApp } from "@/lib/context";
import { createSupplier, updateSupplier, createPurchaseOrder, receiveStock } from "@/lib/actions/suppliers";
import { Truck, CheckCircle, FileText, Plus, X, Loader2, Search, Trash2, Pencil } from "lucide-react";

const EMPTY_SUPPLIER = { name: "", contact: "", phone: "", email: "", address: "", ntn: "" };

interface DraftPOItem { productId: string; productName: string; quantity: number; unitCost: number; }

export function SuppliersClient({ suppliers, purchaseOrders, products }: { suppliers: Supplier[]; purchaseOrders: PurchaseOrder[]; products: Product[] }) {
  const { showToast } = useApp();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"suppliers" | "orders">("suppliers");

  // Add / edit supplier
  const [supplierModal, setSupplierModal] = useState<{ mode: "add" | "edit"; id?: string } | null>(null);
  const [supplierForm, setSupplierForm] = useState({ ...EMPTY_SUPPLIER });
  const [savingSupplier, setSavingSupplier] = useState(false);

  const openAddSupplier = () => { setSupplierForm({ ...EMPTY_SUPPLIER }); setSupplierModal({ mode: "add" }); };
  const openEditSupplier = (s: Supplier) => {
    setSupplierForm({ name: s.name, contact: s.contact, phone: s.phone, email: s.email, address: s.address, ntn: s.gst });
    setSupplierModal({ mode: "edit", id: s.id });
  };

  const saveSupplier = async () => {
    if (!supplierForm.name.trim()) { showToast("Supplier name is required", "error"); return; }
    setSavingSupplier(true);
    try {
      if (supplierModal?.mode === "edit" && supplierModal.id) {
        await updateSupplier(supplierModal.id, supplierForm);
        showToast("Supplier updated", "success");
      } else {
        await createSupplier(supplierForm);
        showToast("Supplier added", "success");
      }
      setSupplierModal(null);
      router.refresh();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Could not save supplier", "error");
    } finally {
      setSavingSupplier(false);
    }
  };

  // Create purchase order
  const [showCreatePO, setShowCreatePO] = useState(false);
  const [poSupplierId, setPoSupplierId] = useState("");
  const [poItems, setPoItems] = useState<DraftPOItem[]>([]);
  const [poProductSearch, setPoProductSearch] = useState("");
  const [savingPO, setSavingPO] = useState(false);

  const filteredPOProducts = useMemo(() => {
    if (!poProductSearch) return [];
    const q = poProductSearch.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q)).slice(0, 6);
  }, [products, poProductSearch]);

  const openCreatePO = () => {
    setPoSupplierId("");
    setPoItems([]);
    setPoProductSearch("");
    setShowCreatePO(true);
  };

  const addPOItem = (p: Product) => {
    if (poItems.some((i) => i.productId === p.id)) { showToast("Already added", "info"); return; }
    setPoItems((prev) => [...prev, { productId: p.id, productName: `${p.brand} ${p.name}`, quantity: 1, unitCost: p.costPrice }]);
    setPoProductSearch("");
  };

  const updatePOItem = (productId: string, field: "quantity" | "unitCost", value: number) => {
    setPoItems((prev) => prev.map((i) => (i.productId === productId ? { ...i, [field]: value } : i)));
  };

  const removePOItem = (productId: string) => {
    setPoItems((prev) => prev.filter((i) => i.productId !== productId));
  };

  const poTotal = poItems.reduce((sum, i) => sum + i.quantity * i.unitCost, 0);

  const savePO = async () => {
    if (!poSupplierId) { showToast("Select a supplier", "error"); return; }
    if (poItems.length === 0) { showToast("Add at least one item", "error"); return; }
    setSavingPO(true);
    try {
      const res = await createPurchaseOrder({
        supplierId: poSupplierId,
        items: poItems.map((i) => ({ productId: i.productId, quantity: i.quantity, unitCost: i.unitCost })),
      });
      showToast(`Purchase order ${res.poNumber} created`, "success");
      setShowCreatePO(false);
      setActiveTab("orders");
      router.refresh();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Could not create purchase order", "error");
    } finally {
      setSavingPO(false);
    }
  };

  // Receive stock
  const [receivingPO, setReceivingPO] = useState<PurchaseOrder | null>(null);
  const [receiveQtys, setReceiveQtys] = useState<Record<string, number>>({});
  const [savingReceive, setSavingReceive] = useState(false);

  const openReceive = (po: PurchaseOrder) => {
    const defaults: Record<string, number> = {};
    po.items.forEach((i) => { defaults[i.id] = Math.max(0, i.quantity - i.received); });
    setReceiveQtys(defaults);
    setReceivingPO(po);
  };

  const saveReceive = async () => {
    if (!receivingPO) return;
    setSavingReceive(true);
    try {
      const receipts = Object.entries(receiveQtys)
        .filter(([, qty]) => qty > 0)
        .map(([itemId, quantityReceived]) => ({ itemId, quantityReceived }));
      if (receipts.length === 0) { showToast("Enter a quantity to receive", "error"); setSavingReceive(false); return; }
      const res = await receiveStock(receivingPO.id, receipts);
      showToast(`Stock received — PO now ${res.status.toLowerCase()}`, "success");
      setReceivingPO(null);
      router.refresh();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Could not receive stock", "error");
    } finally {
      setSavingReceive(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Suppliers & Purchase Orders</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage your vendors and incoming stock</p>
        </div>
        <div className="flex gap-2">
          <button onClick={openAddSupplier}
            className="flex items-center gap-2 px-4 py-2 glass-card text-sm font-medium cursor-pointer">
            <Plus className="w-4 h-4" /> Add Supplier
          </button>
          <button onClick={openCreatePO}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-hover transition-colors">
            <Plus className="w-4 h-4" /> Create Purchase Order
          </button>
        </div>
      </div>

      <div className="flex gap-1.5">
        <button onClick={() => setActiveTab("suppliers")}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${activeTab === "suppliers" ? "bg-primary text-white" : "bg-surface hover:bg-surface-hover"}`}>
          <span className="flex items-center gap-2"><Truck className="w-4 h-4" /> Suppliers ({suppliers.length})</span>
        </button>
        <button onClick={() => setActiveTab("orders")}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${activeTab === "orders" ? "bg-primary text-white" : "bg-surface hover:bg-surface-hover"}`}>
          <span className="flex items-center gap-2"><FileText className="w-4 h-4" /> Purchase Orders ({purchaseOrders.length})</span>
        </button>
      </div>

      {activeTab === "suppliers" ? (
        suppliers.length === 0 ? (
          <div className="glass-card p-12 text-center text-muted-foreground text-sm">No suppliers yet</div>
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 stagger-rise">
          {suppliers.map((s) => (
            <div key={s.id} className="glass-card p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-sm">{s.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Contact: {s.contact}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => openEditSupplier(s)} className="p-1.5 rounded-lg hover:bg-surface-hover cursor-pointer">
                    <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Truck className="w-4 h-4 text-primary" />
                  </div>
                </div>
              </div>
              <div className="space-y-1.5 text-xs text-muted-foreground">
                {s.phone && <p>📞 {s.phone}</p>}
                {s.email && <p>✉️ {s.email}</p>}
                {s.address && <p>📍 {s.address}</p>}
                {s.gst && <p className="font-mono text-[10px]">NTN: {s.gst}</p>}
              </div>
            </div>
          ))}
        </div>
        )
      ) : (
        purchaseOrders.length === 0 ? (
          <div className="glass-card p-12 text-center text-muted-foreground text-sm">No purchase orders yet</div>
        ) : (
        <div className="space-y-4">
          {purchaseOrders.map((po) => (
            <div key={po.id} className="glass-card p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    {po.poNumber}
                    <span className={`chip ${
                      po.status === "Received" ? "chip-paid" :
                      po.status === "Ordered" ? "chip-advance" :
                      po.status === "Partial" ? "chip-balance" : "bg-surface text-muted-foreground"
                    }`}>{po.status}</span>
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{po.supplierName} · {formatDate(po.date)}</p>
                </div>
                <p className="text-lg font-bold text-primary">{formatCurrency(po.total)}</p>
              </div>

              <table className="w-full text-xs mb-4">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 text-muted-foreground font-medium">Item</th>
                    <th className="text-center py-2 text-muted-foreground font-medium">Ordered</th>
                    <th className="text-center py-2 text-muted-foreground font-medium">Received</th>
                    <th className="text-right py-2 text-muted-foreground font-medium">Unit Cost</th>
                    <th className="text-right py-2 text-muted-foreground font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {po.items.map((item, i) => (
                    <tr key={i} className="border-b border-border">
                      <td className="py-2">{item.productName}</td>
                      <td className="py-2 text-center">{item.quantity}</td>
                      <td className="py-2 text-center">
                        <span className={item.received >= item.quantity ? "text-success" : item.received > 0 ? "text-warning" : "text-muted-foreground"}>
                          {item.received}
                        </span>
                      </td>
                      <td className="py-2 text-right">{formatCurrency(item.unitCost)}</td>
                      <td className="py-2 text-right font-medium">{formatCurrency(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {po.status !== "Received" && (
                <button onClick={() => openReceive(po)}
                  className="flex items-center gap-2 px-4 py-2 bg-success/10 text-success rounded-xl text-xs font-medium hover:bg-success/20 transition-colors cursor-pointer">
                  <CheckCircle className="w-3.5 h-3.5" /> Receive Stock
                </button>
              )}
            </div>
          ))}
        </div>
        )
      )}

      {supplierModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setSupplierModal(null)}>
          <div className="glass-modal p-6 w-full max-w-md animate-rise" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">{supplierModal.mode === "edit" ? "Edit Supplier" : "Add Supplier"}</h3>
              <button onClick={() => setSupplierModal(null)} className="cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Name *</label>
                <input type="text" value={supplierForm.name} onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })} className="w-full px-4 py-2.5 glass-input text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Contact Person</label>
                <input type="text" value={supplierForm.contact} onChange={(e) => setSupplierForm({ ...supplierForm, contact: e.target.value })} className="w-full px-4 py-2.5 glass-input text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Phone</label>
                  <input type="text" value={supplierForm.phone} onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })} className="w-full px-3 py-2.5 glass-input text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Email</label>
                  <input type="email" value={supplierForm.email} onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })} className="w-full px-3 py-2.5 glass-input text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Address</label>
                <input type="text" value={supplierForm.address} onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })} className="w-full px-4 py-2.5 glass-input text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">NTN</label>
                <input type="text" value={supplierForm.ntn} onChange={(e) => setSupplierForm({ ...supplierForm, ntn: e.target.value })} className="w-full px-4 py-2.5 glass-input text-sm" />
              </div>
              <button onClick={saveSupplier} disabled={savingSupplier}
                className="w-full py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-hover transition-colors disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer">
                {savingSupplier && <Loader2 className="w-4 h-4 animate-spin" />} {supplierModal.mode === "edit" ? "Save Changes" : "Add Supplier"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreatePO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowCreatePO(false)}>
          <div className="glass-modal p-6 w-full max-w-lg animate-rise max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Create Purchase Order</h3>
              <button onClick={() => setShowCreatePO(false)} className="cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Supplier *</label>
                <select value={poSupplierId} onChange={(e) => setPoSupplierId(e.target.value)} className="w-full px-4 py-2.5 glass-input text-sm">
                  <option value="">Select a supplier...</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Add Items</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <input type="text" placeholder="Search products..." value={poProductSearch}
                    onChange={(e) => setPoProductSearch(e.target.value)} className="w-full pl-9 pr-4 py-2 glass-input text-sm" />
                </div>
                {filteredPOProducts.length > 0 && (
                  <div className="mt-1 glass rounded-xl p-1.5 max-h-36 overflow-y-auto">
                    {filteredPOProducts.map((p) => (
                      <button key={p.id} onClick={() => addPOItem(p)}
                        className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-surface-hover text-xs cursor-pointer">
                        {p.brand} {p.name} · Cost {formatCurrency(p.costPrice)}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {poItems.length > 0 && (
                <div className="space-y-2">
                  {poItems.map((item) => (
                    <div key={item.productId} className="flex items-center gap-2 p-2.5 bg-surface rounded-xl">
                      <span className="flex-1 text-xs font-medium truncate">{item.productName}</span>
                      <input type="number" min={1} value={item.quantity}
                        onChange={(e) => updatePOItem(item.productId, "quantity", Math.max(1, Number(e.target.value)))}
                        className="w-16 px-2 py-1.5 glass-input text-xs text-center" placeholder="Qty" />
                      <input type="number" min={0} value={item.unitCost}
                        onChange={(e) => updatePOItem(item.productId, "unitCost", Number(e.target.value))}
                        className="w-20 px-2 py-1.5 glass-input text-xs text-center" placeholder="Cost" />
                      <span className="text-xs font-medium w-20 text-right">{formatCurrency(item.quantity * item.unitCost)}</span>
                      <button onClick={() => removePOItem(item.productId)} className="cursor-pointer">
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </button>
                    </div>
                  ))}
                  <div className="flex justify-between items-center pt-2 border-t border-border">
                    <span className="text-sm font-semibold">Total</span>
                    <span className="text-lg font-bold text-primary">{formatCurrency(poTotal)}</span>
                  </div>
                </div>
              )}

              <button onClick={savePO} disabled={savingPO}
                className="w-full py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-hover transition-colors disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer">
                {savingPO && <Loader2 className="w-4 h-4 animate-spin" />} Create Purchase Order
              </button>
            </div>
          </div>
        </div>
      )}

      {receivingPO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setReceivingPO(null)}>
          <div className="glass-modal p-6 w-full max-w-lg animate-rise max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Receive Stock — {receivingPO.poNumber}</h3>
              <button onClick={() => setReceivingPO(null)} className="cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-2">
              {receivingPO.items.map((item) => {
                const remaining = item.quantity - item.received;
                return (
                  <div key={item.id} className="flex items-center gap-3 p-2.5 bg-surface rounded-xl">
                    <div className="flex-1">
                      <p className="text-xs font-medium">{item.productName}</p>
                      <p className="text-[10px] text-muted-foreground">Ordered {item.quantity} · Received {item.received} · Remaining {remaining}</p>
                    </div>
                    <input type="number" min={0} max={remaining} value={receiveQtys[item.id] ?? 0}
                      disabled={remaining === 0}
                      onChange={(e) => setReceiveQtys((prev) => ({ ...prev, [item.id]: Math.max(0, Math.min(remaining, Number(e.target.value))) }))}
                      className="w-20 px-2 py-1.5 glass-input text-xs text-center disabled:opacity-40" />
                  </div>
                );
              })}
              <button onClick={saveReceive} disabled={savingReceive}
                className="w-full mt-2 py-2.5 bg-success text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer">
                {savingReceive && <Loader2 className="w-4 h-4 animate-spin" />} Confirm Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

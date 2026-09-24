"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { Supplier, PurchaseOrder } from "@/lib/mock/types";
import type { Product } from "@/lib/mock/types";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { useApp } from "@/lib/context";
import { PURCHASE_TYPES, PURCHASE_PAYMENT_METHODS, poBalanceDue } from "@/lib/constants";
import {
  createSupplier, updateSupplier, createPurchaseOrder, updatePurchaseOrderDetails, receiveStock,
  deleteSupplier, deletePurchaseOrder, setChequeCleared,
  type PODetailsInput,
} from "@/lib/actions/suppliers";
import { Truck, CheckCircle, FileText, Plus, X, Loader2, Search, Trash2, Pencil, PenLine, Wallet, ClipboardList, Building2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { POItemsEditor } from "./POItemsEditor";

const EMPTY_SUPPLIER = { name: "", contact: "", phone: "", email: "", address: "", ntn: "" };

const todayStr = () => new Date().toISOString().slice(0, 10);

const emptyDetails = (): PODetailsInput => ({
  supplierInvoiceNo: "", date: todayStr(), expectedDate: "", notes: "",
  purchaseType: "Cash", purchaseTypeNote: "",
  paymentMethod: "Cash", paymentReference: "", bankName: "", paymentDate: "", amountPaid: 0,
  chequeCleared: false, chequeClearedDate: "",
});

const detailsFromPO = (po: PurchaseOrder): PODetailsInput => ({
  supplierInvoiceNo: po.supplierInvoiceNo, date: po.date, expectedDate: po.expectedDate, notes: po.notes,
  purchaseType: po.purchaseType || "Cash", purchaseTypeNote: po.purchaseTypeNote,
  paymentMethod: po.paymentMethod, paymentReference: po.paymentReference, bankName: po.bankName,
  paymentDate: po.paymentDate, amountPaid: po.amountPaid,
  chequeCleared: po.chequeCleared, chequeClearedDate: po.chequeClearedDate,
});

interface DraftPOItem {
  key: string;
  productId: string | null;
  productName: string;
  description: string;
  quantity: number;
  unitCost: number;
}

const EMPTY_MANUAL_PO_ITEM = { name: "", description: "", quantity: "1", unitCost: "" };

function referenceLabel(method: string) {
  if (method === "Cheque") return "Cheque No.";
  if (method === "Bank Transfer" || method === "JazzCash" || method === "EasyPaisa") return "Transaction ID";
  return "Reference No.";
}

const needsBank = (d: PODetailsInput) => d.paymentMethod === "Cheque" || d.paymentMethod === "Bank Transfer" || d.purchaseType === "Cheque";

// The methods behind "Other" on the Paid by row.
const OTHER_PAYMENT_METHODS = PURCHASE_PAYMENT_METHODS.filter((m) => m !== "Cash" && m !== "Cheque");

/** Order details and payment details — shared by "Create" and "Edit details". */
function PODetailsFields({ details, onChange, total }: {
  details: PODetailsInput;
  onChange: React.Dispatch<React.SetStateAction<PODetailsInput>>;
  total: number;
}) {
  // Functional updates, so two quick changes in a row can't overwrite each other.
  const set = <K extends keyof PODetailsInput>(key: K, value: PODetailsInput[K]) =>
    onChange((prev) => ({ ...prev, [key]: value }));
  const balance = poBalanceDue({
    total, amountPaid: details.amountPaid, paymentMethod: details.paymentMethod, chequeCleared: details.chequeCleared,
  });
  const byCheque = details.paymentMethod === "Cheque";
  const otherMethod = !!details.paymentMethod && details.paymentMethod !== "Cash" && !byCheque;

  return (
    <>
      <div className="p-3.5 rounded-xl border border-border space-y-3">
        <p className="text-xs font-semibold flex items-center gap-1.5"><ClipboardList className="w-3.5 h-3.5 text-primary" /> Order Details</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Order Date</label>
            <input type="date" value={details.date} onChange={(e) => set("date", e.target.value)} className="w-full px-3 py-2 glass-input text-sm" />
          </div>
          <div>
            <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Expected Delivery</label>
            <input type="date" value={details.expectedDate} onChange={(e) => set("expectedDate", e.target.value)} className="w-full px-3 py-2 glass-input text-sm" />
          </div>
          <div>
            <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Supplier Bill / Invoice No.</label>
            <input type="text" value={details.supplierInvoiceNo} onChange={(e) => set("supplierInvoiceNo", e.target.value)} className="w-full px-3 py-2 glass-input text-sm" placeholder="e.g. 4471" />
          </div>
        </div>
        <div>
          <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Notes</label>
          <textarea value={details.notes} onChange={(e) => set("notes", e.target.value)} rows={2}
            className="w-full px-3 py-2 glass-input text-sm resize-y" placeholder="Delivery terms, what was agreed, anything to remember..." />
        </div>
      </div>

      <div className="p-3.5 rounded-xl border border-border space-y-3">
        <p className="text-xs font-semibold flex items-center gap-1.5"><Wallet className="w-3.5 h-3.5 text-primary" /> Payment</p>
        <div>
          <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Purchase Type</label>
          <div className="grid grid-cols-3 gap-1.5">
            {PURCHASE_TYPES.map((t) => (
              <button key={t} type="button"
                onClick={() => onChange((prev) => ({
                  ...prev,
                  purchaseType: t,
                  // Cash and cheque purchases are paid that way; keep the method in step.
                  paymentMethod: t === "Cash" ? "Cash" : t === "Cheque" ? "Cheque" : prev.paymentMethod,
                }))}
                className={`py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${details.purchaseType === t ? "bg-primary text-white" : "bg-surface hover:bg-surface-hover"}`}>
                {t}
              </button>
            ))}
          </div>
          {details.purchaseType === "Other" && (
            <input type="text" value={details.purchaseTypeNote} onChange={(e) => set("purchaseTypeNote", e.target.value)}
              className="w-full mt-2 px-3 py-2 glass-input text-sm" placeholder="Specify, e.g. credit, exchange, consignment" />
          )}
        </div>
        <div>
          <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Paid by</label>
          <div className="grid grid-cols-4 gap-1.5">
            {([["", "Not paid yet"], ["Cash", "Cash"], ["Cheque", "Cheque"], ["other", "Other"]] as const).map(([value, label]) => {
              const active = value === "other" ? otherMethod : details.paymentMethod === value;
              return (
                <button key={value} type="button"
                  onClick={() => set("paymentMethod", value === "other" ? (otherMethod ? details.paymentMethod : "Bank Transfer") : value)}
                  className={`py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${active ? "bg-primary text-white" : "bg-surface hover:bg-surface-hover"}`}>
                  {label}
                </button>
              );
            })}
          </div>
          {otherMethod && (
            <select value={details.paymentMethod} onChange={(e) => set("paymentMethod", e.target.value)} className="w-full mt-2 px-3 py-2 glass-input text-sm">
              {OTHER_PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          )}
          {byCheque && (
            <div className="mt-2 p-2.5 rounded-xl border border-border space-y-2">
              <label className="flex items-start gap-2 text-[11px] cursor-pointer">
                <input type="checkbox" checked={details.chequeCleared}
                  onChange={(e) => onChange((prev) => ({
                    ...prev,
                    chequeCleared: e.target.checked,
                    chequeClearedDate: e.target.checked ? prev.chequeClearedDate || todayStr() : "",
                  }))}
                  className="mt-0.5 rounded" />
                <span>
                  <span className="font-medium">Cheque has cleared</span>
                  <span className="block text-muted-foreground">
                    {details.chequeCleared
                      ? "The money has left the bank, so it comes off the balance due."
                      : "Until this is ticked the cheque is recorded but not taken off the balance due."}
                  </span>
                </span>
              </label>
              {details.chequeCleared && (
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Cleared On</label>
                  <input type="date" value={details.chequeClearedDate} onChange={(e) => set("chequeClearedDate", e.target.value)}
                    className="w-full px-3 py-2 glass-input text-sm" />
                </div>
              )}
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-medium text-muted-foreground mb-1 block">{referenceLabel(details.paymentMethod)}</label>
            <input type="text" value={details.paymentReference} onChange={(e) => set("paymentReference", e.target.value)} className="w-full px-3 py-2 glass-input text-sm" />
          </div>
          {needsBank(details) && (
            <div>
              <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Bank Name</label>
              <input type="text" value={details.bankName} onChange={(e) => set("bankName", e.target.value)} className="w-full px-3 py-2 glass-input text-sm" placeholder="e.g. Meezan Bank" />
            </div>
          )}
          <div>
            <label className="text-[11px] font-medium text-muted-foreground mb-1 block">
              {details.paymentMethod === "Cheque" ? "Cheque Date" : "Payment Date"}
            </label>
            <input type="date" value={details.paymentDate} onChange={(e) => set("paymentDate", e.target.value)} className="w-full px-3 py-2 glass-input text-sm" />
          </div>
          <div>
            <label className="text-[11px] font-medium text-muted-foreground mb-1 flex items-center justify-between">
              {byCheque ? "Cheque Amount" : "Amount Paid"}
              {total > 0 && (
                <button type="button" onClick={() => set("amountPaid", total)} className="text-primary font-semibold cursor-pointer">Paid in full</button>
              )}
            </label>
            <input type="number" min={0} value={details.amountPaid || ""} onChange={(e) => set("amountPaid", Number(e.target.value))}
              className="w-full px-3 py-2 glass-input text-sm" placeholder="0" />
          </div>
        </div>
        {total > 0 && (
          <div className="flex justify-between text-xs pt-2 border-t border-border">
            <span className="text-muted-foreground">
              {byCheque
                ? `Order total ${formatCurrency(total)} · Cheque ${formatCurrency(details.amountPaid || 0)}${details.chequeCleared ? " (cleared)" : " (not deducted)"}`
                : `Order total ${formatCurrency(total)} · Paid ${formatCurrency(details.amountPaid || 0)}`}
            </span>
            <span className={`font-semibold ${balance > 0 ? "text-destructive" : "text-success"}`}>
              {balance > 0 ? `Balance due ${formatCurrency(balance)}` : "Fully paid"}
            </span>
          </div>
        )}
      </div>
    </>
  );
}

export function SuppliersClient({
  suppliers, purchaseOrders, products, canDelete,
}: { suppliers: Supplier[]; purchaseOrders: PurchaseOrder[]; products: Product[]; canDelete: boolean }) {
  const [deletingSupplier, setDeletingSupplier] = useState<Supplier | null>(null);
  const [deletingPO, setDeletingPO] = useState<PurchaseOrder | null>(null);
  const [editingPOItems, setEditingPOItems] = useState<PurchaseOrder | null>(null);
  const [removing, setRemoving] = useState(false);
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
  const [poDetails, setPoDetails] = useState<PODetailsInput>(emptyDetails);
  const [showManualPOItem, setShowManualPOItem] = useState(false);
  const [manualPOItem, setManualPOItem] = useState({ ...EMPTY_MANUAL_PO_ITEM });
  const [savingPO, setSavingPO] = useState(false);

  const supplierById = useMemo(() => new Map(suppliers.map((s) => [s.id, s])), [suppliers]);
  const poSupplier = supplierById.get(poSupplierId);

  const filteredPOProducts = useMemo(() => {
    if (!poProductSearch) return [];
    const q = poProductSearch.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q) || p.model.toLowerCase().includes(q)).slice(0, 6);
  }, [products, poProductSearch]);

  const openCreatePO = () => {
    setPoSupplierId("");
    setPoItems([]);
    setPoProductSearch("");
    setPoDetails(emptyDetails());
    setShowManualPOItem(false);
    setManualPOItem({ ...EMPTY_MANUAL_PO_ITEM });
    setShowCreatePO(true);
  };

  const addPOItem = (p: Product) => {
    if (poItems.some((i) => i.productId === p.id)) { showToast("Already added", "info"); return; }
    setPoItems((prev) => [...prev, {
      key: p.id, productId: p.id, productName: `${p.brand} ${p.name}`.trim(),
      description: [p.model, p.colour].filter(Boolean).join(" · "), quantity: 1, unitCost: p.costPrice,
    }]);
    setPoProductSearch("");
  };

  const addManualPOItem = () => {
    const name = manualPOItem.name.trim();
    if (!name) { showToast("Enter the item's name", "error"); return; }
    setPoItems((prev) => [...prev, {
      key: `manual-${Date.now()}`, productId: null, productName: name, description: manualPOItem.description.trim(),
      quantity: Math.max(1, Math.floor(Number(manualPOItem.quantity) || 1)), unitCost: Math.max(0, Number(manualPOItem.unitCost) || 0),
    }]);
    setManualPOItem({ ...EMPTY_MANUAL_PO_ITEM });
    setShowManualPOItem(false);
  };

  const updatePOItem = <K extends "quantity" | "unitCost" | "description">(key: string, field: K, value: DraftPOItem[K]) => {
    setPoItems((prev) => prev.map((i) => (i.key === key ? { ...i, [field]: value } : i)));
  };

  const removePOItem = (key: string) => {
    setPoItems((prev) => prev.filter((i) => i.key !== key));
  };

  const poTotal = poItems.reduce((sum, i) => sum + i.quantity * i.unitCost, 0);

  const savePO = async () => {
    if (!poSupplierId) { showToast("Select a supplier", "error"); return; }
    if (poItems.length === 0) { showToast("Add at least one item", "error"); return; }
    setSavingPO(true);
    try {
      const res = await createPurchaseOrder({
        ...poDetails,
        supplierId: poSupplierId,
        items: poItems.map((i) => (i.productId
          ? { productId: i.productId, description: i.description, quantity: i.quantity, unitCost: i.unitCost }
          : { name: i.productName, description: i.description, quantity: i.quantity, unitCost: i.unitCost })),
      });
      if (!res.ok) { showToast(res.error, "error"); return; }
      showToast(`Purchase order ${res.poNumber} created`, "success");
      setShowCreatePO(false);
      setActiveTab("orders");
      router.refresh();
    } catch {
      showToast("Could not create the purchase order — check the connection and try again", "error");
    } finally {
      setSavingPO(false);
    }
  };

  // Edit order / payment details after the order was placed
  const [editingPO, setEditingPO] = useState<PurchaseOrder | null>(null);
  const [editDetails, setEditDetails] = useState<PODetailsInput>(emptyDetails);
  const [savingDetails, setSavingDetails] = useState(false);

  const openEditDetails = (po: PurchaseOrder) => {
    setEditDetails(detailsFromPO(po));
    setEditingPO(po);
  };

  const saveDetails = async () => {
    if (!editingPO) return;
    setSavingDetails(true);
    try {
      const res = await updatePurchaseOrderDetails(editingPO.id, editDetails);
      if (!res.ok) { showToast(res.error, "error"); return; }
      showToast(`${editingPO.poNumber} updated`, "success");
      setEditingPO(null);
      router.refresh();
    } catch {
      showToast("Could not save — check the connection and try again", "error");
    } finally {
      setSavingDetails(false);
    }
  };

  // Receive stock
  // Ticking a cheque off from the order card itself.
  const [clearingCheque, setClearingCheque] = useState<string | null>(null);

  const markCheque = async (po: PurchaseOrder, cleared: boolean) => {
    setClearingCheque(po.id);
    try {
      const res = await setChequeCleared(po.id, cleared);
      if (!res.ok) {
        showToast(res.error, "error");
        return;
      }
      showToast(cleared ? `${po.poNumber} — cheque cleared, taken off the balance` : `${po.poNumber} — cheque back to waiting to clear`, "success");
      router.refresh();
    } catch {
      showToast("Could not update the cheque — check the connection and try again", "error");
    } finally {
      setClearingCheque(null);
    }
  };

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
                  <button onClick={() => openEditSupplier(s)} title="Edit supplier" className="p-1.5 rounded-lg hover:bg-surface-hover cursor-pointer">
                    <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                  {canDelete && (
                    <button onClick={() => setDeletingSupplier(s)} title="Delete supplier" className="p-1.5 rounded-lg hover:bg-surface-hover cursor-pointer">
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </button>
                  )}
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
          {purchaseOrders.map((po) => {
            const supplier = supplierById.get(po.supplierId);
            const balance = poBalanceDue(po);
            const purchaseType = po.purchaseType === "Other" && po.purchaseTypeNote ? `Other — ${po.purchaseTypeNote}` : po.purchaseType;
            return (
            <div key={po.id} className="glass-card p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <h3 className="font-semibold text-sm flex items-center gap-2 flex-wrap">
                    {po.poNumber}
                    <span className={`chip ${
                      po.status === "Received" ? "chip-paid" :
                      po.status === "Ordered" ? "chip-advance" :
                      po.status === "Partial" ? "chip-balance" : "bg-surface text-muted-foreground"
                    }`}>{po.status}</span>
                    {purchaseType && <span className="chip bg-primary/10 text-primary">{purchaseType}</span>}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{po.supplierName} · {formatDate(po.date)}</p>
                  {supplier && (supplier.contact || supplier.phone) && (
                    <p className="text-[11px] text-muted-foreground">{[supplier.contact, supplier.phone].filter(Boolean).join(" · ")}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-primary">{formatCurrency(po.total)}</p>
                  <p className={`text-[11px] font-medium ${balance > 0 ? "text-destructive" : "text-success"}`}>
                    {balance > 0 ? `Balance due ${formatCurrency(balance)}` : "Fully paid"}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 text-[11px] mb-4 p-3 rounded-xl bg-surface">
                <div><p className="text-muted-foreground">Supplier bill no.</p><p className="font-medium">{po.supplierInvoiceNo || "—"}</p></div>
                <div><p className="text-muted-foreground">Expected delivery</p><p className="font-medium">{po.expectedDate ? formatDate(po.expectedDate) : "—"}</p></div>
                <div><p className="text-muted-foreground">Payment</p><p className="font-medium">{po.paymentMethod || "Not paid yet"}</p></div>
                <div>
                  <p className="text-muted-foreground">{po.paymentMethod === "Cheque" ? "Cheque" : "Paid"}</p>
                  <p className="font-medium">{formatCurrency(po.amountPaid)}{po.paymentDate ? ` · ${formatDate(po.paymentDate)}` : ""}</p>
                  {po.paymentMethod === "Cheque" && po.amountPaid > 0 && (
                    po.chequeCleared
                      ? <p className="text-success">{`Cleared${po.chequeClearedDate ? ` ${formatDate(po.chequeClearedDate)}` : ""}`}</p>
                      : <p className="text-warning">Not taken off the balance</p>
                  )}
                </div>
                {(po.paymentReference || po.bankName) && (
                  <div className="col-span-2 sm:col-span-4">
                    <p className="text-muted-foreground">{referenceLabel(po.paymentMethod)}</p>
                    <p className="font-medium">{[po.paymentReference, po.bankName].filter(Boolean).join(" · ")}</p>
                  </div>
                )}
                {po.notes && (
                  <div className="col-span-2 sm:col-span-4">
                    <p className="text-muted-foreground">Notes</p>
                    <p className="font-medium whitespace-pre-wrap">{po.notes}</p>
                  </div>
                )}
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
                  {po.items.map((item) => (
                    <tr key={item.id} className="border-b border-border align-top">
                      <td className="py-2">
                        <p>
                          {item.productName}
                          {!item.productId && <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded-md bg-warning/10 text-warning font-medium">Not in inventory</span>}
                        </p>
                        {item.description && <p className="text-[10px] text-muted-foreground">{item.description}</p>}
                      </td>
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

              <div className="flex gap-2 flex-wrap">
                {po.status !== "Received" && (
                  <button onClick={() => openReceive(po)}
                    className="flex items-center gap-2 px-4 py-2 bg-success/10 text-success rounded-xl text-xs font-medium hover:bg-success/20 transition-colors cursor-pointer">
                    <CheckCircle className="w-3.5 h-3.5" /> Receive Stock
                  </button>
                )}
                <button onClick={() => openEditDetails(po)}
                  className="flex items-center gap-2 px-4 py-2 glass-card text-xs font-medium cursor-pointer">
                  <Pencil className="w-3.5 h-3.5" /> Edit Details &amp; Payment
                </button>
                {canDelete && po.paymentMethod === "Cheque" && po.amountPaid > 0 && (
                  <button onClick={() => markCheque(po, !po.chequeCleared)} disabled={clearingCheque === po.id}
                    title={po.chequeCleared ? "Put it back to waiting to clear" : "The cheque has cleared the bank"}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer disabled:opacity-60 ${
                      po.chequeCleared ? "glass-card" : "bg-success/10 text-success hover:bg-success/20"
                    }`}>
                    {clearingCheque === po.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                    {po.chequeCleared ? "Cheque not cleared" : "Cheque cleared"}
                  </button>
                )}
                {canDelete && (
                  <button onClick={() => setEditingPOItems(po)}
                    className="flex items-center gap-2 px-4 py-2 glass-card text-xs font-medium cursor-pointer">
                    <Pencil className="w-3.5 h-3.5" /> Edit Items
                  </button>
                )}
                {canDelete && po.items.every((i) => i.received === 0) && (
                  <button onClick={() => setDeletingPO(po)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium text-destructive bg-destructive/10 hover:bg-destructive/15 transition-colors cursor-pointer">
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                )}
              </div>
            </div>
            );
          })}
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
          <div className="glass-modal p-6 w-full max-w-2xl animate-rise max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Create Purchase Order</h3>
              <button onClick={() => setShowCreatePO(false)} className="cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl border border-border space-y-2">
                <p className="text-xs font-semibold flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5 text-primary" /> Supplier Information</p>
                <select value={poSupplierId} onChange={(e) => setPoSupplierId(e.target.value)} className="w-full px-4 py-2.5 glass-input text-sm">
                  <option value="">Select a supplier...</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                {poSupplier && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-muted-foreground px-1">
                    <p>Contact: <span className="text-foreground font-medium">{poSupplier.contact || "—"}</span></p>
                    <p>Phone: <span className="text-foreground font-medium">{poSupplier.phone || "—"}</span></p>
                    <p>Email: <span className="text-foreground font-medium">{poSupplier.email || "—"}</span></p>
                    <p>NTN: <span className="text-foreground font-medium">{poSupplier.gst || "—"}</span></p>
                    <p className="sm:col-span-2">Address: <span className="text-foreground font-medium">{poSupplier.address || "—"}</span></p>
                  </div>
                )}
                {suppliers.length === 0 && (
                  <p className="text-[11px] text-warning">No suppliers yet — add one first with &ldquo;Add Supplier&rdquo;.</p>
                )}
              </div>

              <div className="p-3.5 rounded-xl border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold">Items</p>
                  <button type="button" onClick={() => setShowManualPOItem((v) => !v)}
                    className="flex items-center gap-1 text-[11px] text-primary font-semibold cursor-pointer">
                    <PenLine className="w-3 h-3" /> Item not in inventory
                  </button>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <input type="text" placeholder="Search products by name, brand or model..." value={poProductSearch}
                    onChange={(e) => setPoProductSearch(e.target.value)} className="w-full pl-9 pr-4 py-2 glass-input text-sm" />
                </div>
                {filteredPOProducts.length > 0 && (
                  <div className="glass rounded-xl p-1.5 max-h-36 overflow-y-auto">
                    {filteredPOProducts.map((p) => (
                      <button key={p.id} onClick={() => addPOItem(p)}
                        className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-surface-hover text-xs cursor-pointer">
                        {p.brand} {p.name} {p.model && <span className="text-muted-foreground">· {p.model}</span>} · Cost {formatCurrency(p.costPrice)}
                      </button>
                    ))}
                  </div>
                )}

                {showManualPOItem && (
                  <div className="p-2.5 rounded-xl bg-primary/5 border border-primary/30 space-y-2">
                    <div className="grid grid-cols-2 sm:grid-cols-12 gap-2">
                      <input type="text" value={manualPOItem.name} autoFocus onChange={(e) => setManualPOItem({ ...manualPOItem, name: e.target.value })}
                        placeholder="Item name *" className="col-span-2 sm:col-span-4 px-3 py-2 glass-input text-xs" />
                      <input type="text" value={manualPOItem.description} onChange={(e) => setManualPOItem({ ...manualPOItem, description: e.target.value })}
                        placeholder="Details (model, colour...)" className="col-span-2 sm:col-span-4 px-3 py-2 glass-input text-xs" />
                      <input type="number" min={1} value={manualPOItem.quantity} onChange={(e) => setManualPOItem({ ...manualPOItem, quantity: e.target.value })}
                        placeholder="Qty" title="Quantity" className="sm:col-span-2 px-3 py-2 glass-input text-xs" />
                      <input type="number" min={0} value={manualPOItem.unitCost} onChange={(e) => setManualPOItem({ ...manualPOItem, unitCost: e.target.value })}
                        placeholder="Unit cost" className="sm:col-span-2 px-3 py-2 glass-input text-xs" />
                    </div>
                    <button type="button" onClick={addManualPOItem}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-semibold cursor-pointer">
                      <Plus className="w-3.5 h-3.5" /> Add item
                    </button>
                  </div>
                )}

                {poItems.length > 0 && (
                  <div className="space-y-2">
                    {poItems.map((item) => (
                      <div key={item.key} className="p-2.5 bg-surface rounded-xl">
                        <div className="flex items-center gap-2">
                          <span className="flex-1 text-xs font-medium truncate">
                            {item.productName}
                            {!item.productId && <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded-md bg-warning/10 text-warning">Not in inventory</span>}
                          </span>
                          <input type="number" min={1} value={item.quantity}
                            onChange={(e) => updatePOItem(item.key, "quantity", Math.max(1, Number(e.target.value)))}
                            className="w-16 px-2 py-1.5 glass-input text-xs text-center" placeholder="Qty" title="Quantity" />
                          <input type="number" min={0} value={item.unitCost}
                            onChange={(e) => updatePOItem(item.key, "unitCost", Number(e.target.value))}
                            className="w-20 px-2 py-1.5 glass-input text-xs text-center" placeholder="Cost" title="Unit cost" />
                          <span className="text-xs font-medium w-20 text-right">{formatCurrency(item.quantity * item.unitCost)}</span>
                          <button onClick={() => removePOItem(item.key)} className="cursor-pointer">
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </button>
                        </div>
                        <input type="text" value={item.description}
                          onChange={(e) => updatePOItem(item.key, "description", e.target.value)}
                          placeholder="Details for this line (model, colour, size...)"
                          className="mt-1.5 w-full px-2 py-1 glass-input text-[11px]" />
                      </div>
                    ))}
                    <div className="flex justify-between items-center pt-2 border-t border-border">
                      <span className="text-sm font-semibold">Total</span>
                      <span className="text-lg font-bold text-primary">{formatCurrency(poTotal)}</span>
                    </div>
                  </div>
                )}
              </div>

              <PODetailsFields details={poDetails} onChange={setPoDetails} total={poTotal} />

              <button onClick={savePO} disabled={savingPO}
                className="w-full py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-hover transition-colors disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer">
                {savingPO && <Loader2 className="w-4 h-4 animate-spin" />} Create Purchase Order
              </button>
            </div>
          </div>
        </div>
      )}

      {editingPO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditingPO(null)}>
          <div className="glass-modal p-6 w-full max-w-2xl animate-rise max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold">{editingPO.poNumber} — Details &amp; Payment</h3>
                <p className="text-xs text-muted-foreground">{editingPO.supplierName} · {formatCurrency(editingPO.total)}</p>
              </div>
              <button onClick={() => setEditingPO(null)} className="cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <PODetailsFields details={editDetails} onChange={setEditDetails} total={editingPO.total} />
              <button onClick={saveDetails} disabled={savingDetails}
                className="w-full py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-hover transition-colors disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer">
                {savingDetails && <Loader2 className="w-4 h-4 animate-spin" />} Save Details
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
                      {!item.productId && (
                        <p className="text-[10px] text-warning">Not in inventory — marked received only; add it as a product to track its stock.</p>
                      )}
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
      {deletingSupplier && (
        <ConfirmDialog
          title={`Delete ${deletingSupplier.name}?`}
          message="Their past purchase orders keep showing the name. It moves to the Trash and can be restored for 30 days."
          busy={removing}
          onCancel={() => setDeletingSupplier(null)}
          onConfirm={async () => {
            setRemoving(true);
            try {
              const res = await deleteSupplier(deletingSupplier.id);
              if (!res.ok) { showToast(res.error, "error"); return; }
              showToast(`${deletingSupplier.name} moved to Trash`, "success");
              setDeletingSupplier(null);
              router.refresh();
            } catch {
              showToast("Could not delete the supplier — check the connection and try again", "error");
            } finally {
              setRemoving(false);
            }
          }}
        />
      )}

      {deletingPO && (
        <ConfirmDialog
          title={`Delete ${deletingPO.poNumber}?`}
          message={`${deletingPO.supplierName} · ${formatCurrency(deletingPO.total)}. Nothing has been received against it. It moves to the Trash and can be restored for 30 days.`}
          busy={removing}
          onCancel={() => setDeletingPO(null)}
          onConfirm={async () => {
            setRemoving(true);
            try {
              const res = await deletePurchaseOrder(deletingPO.id);
              if (!res.ok) { showToast(res.error, "error"); return; }
              showToast(`${deletingPO.poNumber} moved to Trash`, "success");
              setDeletingPO(null);
              router.refresh();
            } catch {
              showToast("Could not delete the purchase order — check the connection and try again", "error");
            } finally {
              setRemoving(false);
            }
          }}
        />
      )}
      {editingPOItems && (
        <POItemsEditor
          order={editingPOItems}
          onClose={() => setEditingPOItems(null)}
          onDone={(message) => {
            setEditingPOItems(null);
            showToast(message, "success");
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

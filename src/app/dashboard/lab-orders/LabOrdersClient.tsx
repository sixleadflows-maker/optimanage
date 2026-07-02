"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { LabOrder } from "@/lib/mock/types";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { useApp } from "@/lib/context";
import { LAB_ORDER_STATUSES } from "@/lib/constants";
import { createLabOrder, advanceLabStatus } from "@/lib/actions/lab-orders";
import { FlaskConical, ArrowRight, Plus, X, Loader2 } from "lucide-react";

const statusColors: Record<string, string> = {
  "Ordered": "bg-blue-500/10 text-blue-600 border-blue-200",
  "In Progress": "bg-warning/10 text-warning border-warning/20",
  "Received": "bg-success/10 text-success border-success/20",
  "Fitted": "bg-primary/10 text-primary border-primary/20",
};

interface LabCustomer { id: string; name: string; }

export function LabOrdersClient({ labOrders, customers }: { labOrders: LabOrder[]; customers: LabCustomer[] }) {
  const { showToast } = useApp();
  const router = useRouter();
  const [viewMode, setViewMode] = useState<"kanban" | "table">("kanban");
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState({
    customerId: "", lab: "", lensType: "", prescription: "", price: 0,
    expectedDate: "", notes: "",
  });

  const advance = async (orderId: string) => {
    setBusy(orderId);
    try {
      await advanceLabStatus(orderId);
      showToast("Status updated", "success");
      router.refresh();
    } catch {
      showToast("Could not update status", "error");
    } finally {
      setBusy(null);
    }
  };

  const handleAdd = async () => {
    if (!form.customerId || !form.lab.trim()) {
      showToast("Select a customer and enter the lab", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await createLabOrder(form);
      showToast(`Lab order created — ${res.orderNo}`, "success");
      setShowAdd(false);
      setForm({ customerId: "", lab: "", lensType: "", prescription: "", price: 0, expectedDate: "", notes: "" });
      router.refresh();
    } catch {
      showToast("Could not create lab order", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Lab Orders</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Track outsourced lens jobs</p>
        </div>
        <div className="flex gap-1.5">
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-hover transition-colors">
            <Plus className="w-4 h-4" /> New Order
          </button>
          <button onClick={() => setViewMode("kanban")}
            className={`px-3 py-2 rounded-xl text-xs font-medium ${viewMode === "kanban" ? "bg-primary text-white" : "bg-surface hover:bg-surface-hover"}`}>
            Kanban
          </button>
          <button onClick={() => setViewMode("table")}
            className={`px-3 py-2 rounded-xl text-xs font-medium ${viewMode === "table" ? "bg-primary text-white" : "bg-surface hover:bg-surface-hover"}`}>
            Table
          </button>
        </div>
      </div>

      {viewMode === "kanban" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {LAB_ORDER_STATUSES.map((status) => {
            const orders = labOrders.filter((o) => o.status === status);
            return (
              <div key={status}>
                <div className="flex items-center gap-2 mb-3">
                  <span className={`w-2 h-2 rounded-full ${
                    status === "Ordered" ? "bg-blue-500" :
                    status === "In Progress" ? "bg-warning" :
                    status === "Received" ? "bg-success" : "bg-primary"
                  }`} />
                  <h3 className="text-sm font-semibold">{status}</h3>
                  <span className="text-xs text-muted-foreground">({orders.length})</span>
                </div>
                <div className="space-y-3">
                  {orders.map((order) => (
                    <div key={order.id} className={`glass-card p-4 border ${statusColors[order.status]}`}>
                      <div className="flex items-start justify-between mb-2">
                        <p className="text-xs font-bold">{order.orderNo}</p>
                        <FlaskConical className="w-3.5 h-3.5 opacity-40" />
                      </div>
                      <p className="text-sm font-medium">{order.customerName}</p>
                      <p className="text-xs text-muted-foreground mt-1">{order.lensType}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{order.lab}</p>
                      <div className="flex items-center justify-between mt-3 pt-2 border-t border-border">
                        <p className="text-xs font-semibold text-primary">{formatCurrency(order.price)}</p>
                        <p className="text-[10px] text-muted-foreground">Due: {order.expectedDate ? formatDate(order.expectedDate) : "—"}</p>
                      </div>
                      {order.status !== "Fitted" && (
                        <button onClick={() => advance(order.id)} disabled={busy === order.id}
                          className="w-full mt-2 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-surface hover:bg-surface-hover text-[10px] font-medium transition-colors disabled:opacity-60">
                          {busy === order.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <>Advance <ArrowRight className="w-3 h-3" /></>}
                        </button>
                      )}
                    </div>
                  ))}
                  {orders.length === 0 && (
                    <div className="p-6 text-center text-xs text-muted-foreground glass-card">No orders</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="glass-card p-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Order</th>
                <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Customer</th>
                <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Lab</th>
                <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Lens Type</th>
                <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">Price</th>
                <th className="text-center py-3 px-3 text-xs font-medium text-muted-foreground">Status</th>
                <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Expected</th>
              </tr>
            </thead>
            <tbody>
              {labOrders.length === 0 && (
                <tr><td colSpan={7} className="text-center py-12 text-muted-foreground text-sm">No lab orders yet</td></tr>
              )}
              {labOrders.map((order) => (
                <tr key={order.id} className="border-b border-border hover:bg-surface-hover/50">
                  <td className="py-3 px-3 font-medium">{order.orderNo}</td>
                  <td className="py-3 px-3">{order.customerName}</td>
                  <td className="py-3 px-3 text-xs text-muted-foreground">{order.lab}</td>
                  <td className="py-3 px-3 text-xs">{order.lensType}</td>
                  <td className="py-3 px-3 text-right font-medium">{formatCurrency(order.price)}</td>
                  <td className="py-3 px-3 text-center">
                    <span className={`chip ${statusColors[order.status]}`}>{order.status}</span>
                  </td>
                  <td className="py-3 px-3 text-xs text-muted-foreground">{order.expectedDate ? formatDate(order.expectedDate) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowAdd(false)}>
          <div className="glass-card p-6 w-full max-w-lg animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">New Lab Order</h3>
              <button onClick={() => setShowAdd(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Customer *</label>
                  <select value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })} className="w-full px-3 py-2.5 glass-input text-sm">
                    <option value="">Select…</option>
                    {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Lab *</label>
                  <input type="text" value={form.lab} onChange={(e) => setForm({ ...form, lab: e.target.value })} className="w-full px-4 py-2.5 glass-input text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Lens Type</label>
                  <input type="text" value={form.lensType} onChange={(e) => setForm({ ...form, lensType: e.target.value })} className="w-full px-4 py-2.5 glass-input text-sm" placeholder="e.g. Progressive" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Price</label>
                  <input type="number" value={form.price || ""} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} className="w-full px-4 py-2.5 glass-input text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Expected Date</label>
                  <input type="date" value={form.expectedDate} onChange={(e) => setForm({ ...form, expectedDate: e.target.value })} className="w-full px-3 py-2.5 glass-input text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Prescription</label>
                  <input type="text" value={form.prescription} onChange={(e) => setForm({ ...form, prescription: e.target.value })} className="w-full px-4 py-2.5 glass-input text-sm" placeholder="e.g. -2.00 / -1.75" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Notes</label>
                <input type="text" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full px-4 py-2.5 glass-input text-sm" />
              </div>
              <button onClick={handleAdd} disabled={saving}
                className="w-full py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-hover transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />} Create Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

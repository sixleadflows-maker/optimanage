"use client";

import { useState } from "react";
import type { Supplier, PurchaseOrder } from "@/lib/mock/types";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { useApp } from "@/lib/context";
import { Truck, CheckCircle, FileText } from "lucide-react";

export function SuppliersClient({ suppliers, purchaseOrders }: { suppliers: Supplier[]; purchaseOrders: PurchaseOrder[] }) {
  const { showToast } = useApp();
  const [activeTab, setActiveTab] = useState<"suppliers" | "orders">("suppliers");

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Suppliers & Purchase Orders</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage your vendors and incoming stock</p>
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {suppliers.map((s) => (
            <div key={s.id} className="glass-card p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-sm">{s.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Contact: {s.contact}</p>
                </div>
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Truck className="w-4 h-4 text-primary" />
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
                <button onClick={() => showToast(`Stock receiving flow coming soon for ${po.poNumber}`, "info")}
                  className="flex items-center gap-2 px-4 py-2 bg-success/10 text-success rounded-xl text-xs font-medium hover:bg-success/20 transition-colors">
                  <CheckCircle className="w-3.5 h-3.5" /> Receive Stock
                </button>
              )}
            </div>
          ))}
        </div>
        )
      )}
    </div>
  );
}

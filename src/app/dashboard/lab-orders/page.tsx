"use client";

import { useState } from "react";
import { labOrders } from "@/lib/mock";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { useApp } from "@/lib/context";
import { LAB_ORDER_STATUSES } from "@/lib/constants";
import { FlaskConical, ArrowRight } from "lucide-react";

const statusColors: Record<string, string> = {
  "Ordered": "bg-blue-500/10 text-blue-600 border-blue-200",
  "In Progress": "bg-warning/10 text-warning border-warning/20",
  "Received": "bg-success/10 text-success border-success/20",
  "Fitted": "bg-primary/10 text-primary border-primary/20",
};

export default function LabOrdersPage() {
  const { showToast } = useApp();
  const [viewMode, setViewMode] = useState<"kanban" | "table">("kanban");

  const advanceStatus = (orderId: string) => {
    showToast(`Lab order status updated (demo)`, "success");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Lab Orders</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Track outsourced lens jobs</p>
        </div>
        <div className="flex gap-1.5">
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
                        <p className="text-[10px] text-muted-foreground">Due: {formatDate(order.expectedDate)}</p>
                      </div>
                      {order.status !== "Fitted" && (
                        <button onClick={() => advanceStatus(order.id)}
                          className="w-full mt-2 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-surface hover:bg-surface-hover text-[10px] font-medium transition-colors">
                          Advance <ArrowRight className="w-3 h-3" />
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
                  <td className="py-3 px-3 text-xs text-muted-foreground">{formatDate(order.expectedDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

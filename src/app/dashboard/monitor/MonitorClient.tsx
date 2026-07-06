"use client";

import { useState } from "react";
import type { DashboardData, SaleView } from "@/lib/data";
import type { Product } from "@/lib/mock/types";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils/format";
import {
  DollarSign, FileText, TrendingUp, AlertTriangle,
  ChevronDown, ChevronUp, PackageX, Receipt,
} from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";

export function MonitorClient({
  dashboard, stockAlerts, sales, canSeeCosts,
}: {
  dashboard: DashboardData;
  stockAlerts: Product[];
  sales: SaleView[];
  canSeeCosts: boolean;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const totalRevenue = sales.reduce((sum, s) => sum + s.total, 0);
  const marginPct = totalRevenue > 0 ? (dashboard.totalProfit / totalRevenue) * 100 : 0;

  const kpis = [
    { label: "Today's Sales", value: formatCurrency(dashboard.todayRevenue), icon: DollarSign, color: "text-success" },
    { label: "Total Invoices", value: dashboard.totalInvoices.toString(), icon: FileText, color: "text-primary" },
    { label: "Outstanding Balance", value: formatCurrency(dashboard.outstanding), icon: TrendingUp, color: "text-warning" },
    ...(canSeeCosts
      ? [{ label: "Total Profit", value: `${formatCurrency(dashboard.totalProfit)} · ${marginPct.toFixed(0)}%`, icon: TrendingUp, color: "text-success" }]
      : []),
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gradient">Monitor</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Read-only overview — sales, profit, stock alerts, and invoices</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 stagger-rise">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="glass-card p-5">
            <div className={`w-9 h-9 rounded-xl bg-surface flex items-center justify-center mb-3 ${kpi.color}`}>
              <kpi.icon className="w-4 h-4" />
            </div>
            <p className="text-xl font-bold tracking-tight font-display">{kpi.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{kpi.label}</p>
          </div>
        ))}
      </div>

      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-destructive" /> Stock Alerts
          {stockAlerts.length > 0 && <span className="chip bg-destructive/10 text-destructive">{stockAlerts.length}</span>}
        </h3>
        {stockAlerts.length === 0 ? (
          <EmptyState icon={PackageX} title="All stocked up" hint="Nothing at or below its low-stock threshold right now." />
        ) : (
          <div className="space-y-2">
            {stockAlerts.map((p) => (
              <div key={p.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-surface">
                <div>
                  <p className="text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.brand} · {p.category}</p>
                </div>
                <span className={`chip ${p.stock === 0 ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning"}`}>
                  {p.stock === 0 ? "Out of stock" : `Low stock — ${p.stock} left`}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <Receipt className="w-4 h-4 text-primary" /> Invoices
        </h3>
        {sales.length === 0 ? (
          <EmptyState icon={Receipt} title="No invoices yet" hint="Sales completed from the POS will appear here." />
        ) : (
          <div className="space-y-2">
            {sales.map((sale) => {
              const isOpen = expandedId === sale.id;
              return (
                <div key={sale.id} className="rounded-lg bg-surface overflow-hidden">
                  <button
                    onClick={() => setExpandedId(isOpen ? null : sale.id)}
                    className="w-full flex items-center justify-between py-2.5 px-3 text-left hover:bg-surface-hover transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium">{sale.invoiceNo} · {sale.customerName}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(sale.date)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`chip chip-${sale.paymentStatus.toLowerCase()}`}>{sale.paymentStatus}</span>
                      <span className="text-sm font-semibold">{formatCurrency(sale.total)}</span>
                      {isOpen ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                    </div>
                  </button>
                  {isOpen && (
                    <div className="px-3 pb-3 pt-1 border-t border-border">
                      <table className="w-full text-xs mb-3">
                        <thead>
                          <tr className="text-muted-foreground">
                            <th className="text-left py-1.5 font-medium">Item</th>
                            <th className="text-center py-1.5 font-medium">Qty</th>
                            <th className="text-right py-1.5 font-medium">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sale.items.map((it, i) => (
                            <tr key={i} className="border-t border-border/50">
                              <td className="py-1.5">{it.productName}</td>
                              <td className="py-1.5 text-center">{it.quantity}</td>
                              <td className="py-1.5 text-right">{formatCurrency(it.total)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <p>Subtotal: <span className="text-foreground font-medium">{formatCurrency(sale.subtotal)}</span></p>
                        <p>Paid: <span className="text-foreground font-medium">{formatCurrency(sale.paid)}</span></p>
                        <p>Payment: <span className="text-foreground font-medium">{sale.paymentMethod}</span></p>
                        <p>Balance: <span className="text-foreground font-medium">{formatCurrency(sale.balance)}</span></p>
                        <p>Order taken by: <span className="text-foreground font-medium">{sale.createdByName || "—"}</span></p>
                        <p>Bill by: <span className="text-foreground font-medium">{sale.receivedByName || "—"}</span></p>
                        <p className="col-span-2">Date: <span className="text-foreground font-medium">{formatDateTime(sale.date)}</span></p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import type { DashboardData } from "@/lib/data";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { orderStatusChipClass, paymentStatusChipClass } from "@/lib/constants";
import { AlertTriangle, Clock, FlaskConical, PackageCheck, Timer, ArrowRight } from "lucide-react";
import { AnimatedCounter } from "@/components/ui/AnimatedCounter";

export function DashboardClient({ data }: { data: DashboardData }) {
  const ready = data.readyToPickUp + data.readyToDeliver;
  // The day's work at a glance. The money figures -- sales, invoiced and
  // outstanding -- are on Analytics, which only the owner sees.
  const tiles = [
    {
      label: "Orders in process", value: data.ordersInProcess, icon: Timer, color: "text-warning",
      note: "Glasses being made up", href: "/dashboard/sales?order=process",
    },
    {
      label: "Ready to pick up / deliver", value: ready, icon: PackageCheck, color: "text-success",
      note: ready ? `${data.readyToPickUp} to pick up · ${data.readyToDeliver} to deliver` : "Nothing waiting", href: "/dashboard/sales?order=ready",
    },
    {
      label: "Jobs at the lab", value: data.labJobsOut, icon: FlaskConical, color: "text-primary",
      note: "Sent out, not back yet", href: "/dashboard/lab-orders",
    },
    {
      label: "Low Stock Items", value: data.lowStockCount, icon: AlertTriangle, color: "text-destructive",
      note: "At or below their alert level", href: "/dashboard/monitor",
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gradient">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Orders, lab jobs and stock at a glance</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 stagger-rise">
        {tiles.map((t) => (
          <Link key={t.label} href={t.href} className="glass-card p-5 group hover:ring-1 hover:ring-primary/30 transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className={`w-9 h-9 rounded-xl bg-surface flex items-center justify-center ${t.color}`}>
                <t.icon className="w-4 h-4" />
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="text-2xl font-bold tracking-tight font-display"><AnimatedCounter value={t.value} format={(n: number) => n.toString()} /></p>
            <p className="text-xs text-muted-foreground mt-1">{t.label}</p>
            <p className="text-[11px] text-muted-foreground mt-1.5">{t.note}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold mb-4">Recent Sales</h3>
          <div className="space-y-3">
            {data.recentSales.length === 0 && (
              <p className="text-sm text-muted-foreground py-6 text-center">No sales yet — create one from the POS.</p>
            )}
            {data.recentSales.map((sale) => (
              <div key={sale.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div>
                  <p className="text-sm font-medium">{sale.customerName}</p>
                  <p className="text-xs text-muted-foreground">{sale.invoiceNo} · {formatDate(sale.date)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{formatCurrency(sale.total)}</p>
                  <div className="flex items-center justify-end gap-1 mt-0.5">
                    {sale.orderStatus && <span className={`chip ${orderStatusChipClass(sale.orderStatus)}`}>{sale.orderStatus}</span>}
                    <span className={`chip ${paymentStatusChipClass(sale.paymentStatus)}`}>{sale.paymentStatus}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" /> Reminders & Alerts
          </h3>
          <div className="space-y-3">
            {data.reminders.length === 0 && (
              <p className="text-sm text-muted-foreground py-6 text-center">All clear — no alerts.</p>
            )}
            {data.reminders.map((r, i) => (
              <div key={i} className="flex items-start gap-3 py-2 border-b border-border last:border-0">
                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                  r.type === "balance" ? "bg-warning" :
                  r.type === "pickup" ? "bg-success" :
                  r.type === "lab" ? "bg-primary" : "bg-destructive"
                }`} />
                <div className="flex-1">
                  <p className="text-sm">{r.text}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{r.date === "Now" ? r.date : formatDate(r.date)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

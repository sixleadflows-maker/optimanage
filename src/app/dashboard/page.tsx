"use client";

import { useMemo } from "react";
import { sales, products } from "@/lib/mock";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { useApp } from "@/lib/context";
import {
  DollarSign, FileText, AlertTriangle, TrendingUp,
  Clock, ArrowUpRight, ArrowDownRight,
} from "lucide-react";

function MiniAreaChart({ data, height = 200 }: { data: { label: string; value: number }[]; height?: number }) {
  if (data.length === 0) return null;
  const max = Math.max(...data.map((d) => d.value));
  const w = 600;
  const h = height;
  const pad = 30;
  const points = data.map((d, i) => ({
    x: pad + (i / (data.length - 1)) * (w - pad * 2),
    y: h - pad - (d.value / max) * (h - pad * 2),
  }));
  const line = points.map((p) => `${p.x},${p.y}`).join(" ");
  const area = `${pad},${h - pad} ${line} ${w - pad},${h - pad}`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }}>
      <defs>
        <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1f5d8c" stopOpacity={0.2} />
          <stop offset="100%" stopColor="#1f5d8c" stopOpacity={0.02} />
        </linearGradient>
      </defs>
      {[0, 0.25, 0.5, 0.75, 1].map((t) => (
        <line key={t} x1={pad} x2={w - pad} y1={h - pad - t * (h - pad * 2)} y2={h - pad - t * (h - pad * 2)}
          stroke="rgba(0,0,0,0.06)" strokeDasharray="4 4" />
      ))}
      <polygon points={area} fill="url(#areaFill)" />
      <polyline points={line} fill="none" stroke="#1f5d8c" strokeWidth={2.5} strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3} fill="#1f5d8c" />
      ))}
      {data.map((d, i) => (
        <text key={i} x={points[i].x} y={h - 8} textAnchor="middle" fontSize={9} fill="rgba(0,0,0,0.4)">
          {d.label}
        </text>
      ))}
    </svg>
  );
}

function HBarChart({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(...data.map((d) => d.value));
  return (
    <div className="space-y-2.5">
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-3">
          <span className="text-[11px] text-muted-foreground w-20 text-right truncate">{d.label}</span>
          <div className="flex-1 h-5 bg-surface rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${(d.value / max) * 100}%` }} />
          </div>
          <span className="text-[11px] font-medium w-16 text-right">{formatCurrency(d.value)}</span>
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const { activeBranch } = useApp();

  const branchSales = useMemo(
    () => sales.filter((s) => s.branchId === activeBranch),
    [activeBranch]
  );

  const todaySales = branchSales.filter(
    (s) => s.date.startsWith("2026-06-18")
  );
  const todayRevenue = todaySales.reduce((sum, s) => sum + s.total, 0);
  const totalInvoices = branchSales.length;
  const outstanding = branchSales
    .filter((s) => s.paymentStatus !== "Paid")
    .reduce((sum, s) => sum + s.balance, 0);
  const lowStock = products.filter((p) => p.stock <= p.lowStockThreshold).length;

  const dailySales = useMemo(() => {
    const days: Record<string, number> = {};
    branchSales.forEach((s) => {
      const day = s.date.split("T")[0];
      days[day] = (days[day] || 0) + s.total;
    });
    return Object.entries(days)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, total]) => ({
        label: new Date(date).toLocaleDateString("en-PK", { day: "2-digit", month: "short" }),
        value: total,
      }));
  }, [branchSales]);

  const brandSales = useMemo(() => {
    const brands: Record<string, number> = {};
    branchSales.forEach((s) =>
      s.items.forEach((item) => {
        const product = products.find((p) => p.id === item.productId);
        if (product) brands[product.brand] = (brands[product.brand] || 0) + item.total;
      })
    );
    return Object.entries(brands)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6)
      .map(([brand, revenue]) => ({ label: brand, value: revenue }));
  }, [branchSales]);

  const recentSales = branchSales.slice(0, 5);

  const reminders = [
    { text: "Ayesha Malik — balance Rs.17,800 due", type: "balance" as const, date: "Jun 17" },
    { text: "Bilal Hussain — order ready for pickup", type: "pickup" as const, date: "Jun 16" },
    { text: "Lab order LAB-004 expected today", type: "lab" as const, date: "Jun 20" },
    { text: "Low stock: Gucci Butterfly Large (1 left)", type: "stock" as const, date: "Now" },
  ];

  const kpis = [
    { label: "Today's Sales", value: formatCurrency(todayRevenue), change: "+12%", up: true, icon: DollarSign, color: "text-success" },
    { label: "Total Invoices", value: totalInvoices.toString(), change: "+3", up: true, icon: FileText, color: "text-primary" },
    { label: "Outstanding", value: formatCurrency(outstanding), change: "-8%", up: false, icon: TrendingUp, color: "text-warning" },
    { label: "Low Stock Items", value: lowStock.toString(), change: `${lowStock} items`, up: false, icon: AlertTriangle, color: "text-destructive" },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Overview of your optical store performance</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="glass-card p-5">
            <div className="flex items-start justify-between mb-3">
              <div className={`w-9 h-9 rounded-xl bg-surface flex items-center justify-center ${kpi.color}`}>
                <kpi.icon className="w-4 h-4" />
              </div>
              <span className={`flex items-center gap-0.5 text-xs font-medium ${kpi.up ? "text-success" : "text-destructive"}`}>
                {kpi.up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {kpi.change}
              </span>
            </div>
            <p className="text-2xl font-bold tracking-tight">{kpi.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{kpi.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 glass-card p-5">
          <h3 className="text-sm font-semibold mb-4">Sales Trend</h3>
          <MiniAreaChart data={dailySales} height={260} />
        </div>

        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold mb-4">Top Brands by Revenue</h3>
          <HBarChart data={brandSales} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold mb-4">Recent Sales</h3>
          <div className="space-y-3">
            {recentSales.map((sale) => (
              <div key={sale.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div>
                  <p className="text-sm font-medium">{sale.customerName}</p>
                  <p className="text-xs text-muted-foreground">{sale.invoiceNo} · {formatDate(sale.date)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{formatCurrency(sale.total)}</p>
                  <span className={`chip chip-${sale.paymentStatus.toLowerCase()}`}>
                    {sale.paymentStatus}
                  </span>
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
            {reminders.map((r, i) => (
              <div key={i} className="flex items-start gap-3 py-2 border-b border-border last:border-0">
                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                  r.type === "balance" ? "bg-warning" :
                  r.type === "pickup" ? "bg-success" :
                  r.type === "lab" ? "bg-primary" : "bg-destructive"
                }`} />
                <div className="flex-1">
                  <p className="text-sm">{r.text}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{r.date}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

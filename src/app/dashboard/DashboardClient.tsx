"use client";

import { useEffect, useRef, useState } from "react";
import type { DashboardData } from "@/lib/data";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import {
  DollarSign, FileText, AlertTriangle, TrendingUp,
  Clock, ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import { AnimatedCounter } from "@/components/ui/AnimatedCounter";

function MiniAreaChart({ data, height = 200 }: { data: { label: string; value: number }[]; height?: number }) {
  const lineRef = useRef<SVGPolylineElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = lineRef.current;
    if (!el) return;
    const len = el.getTotalLength();
    el.style.strokeDasharray = `${len}`;
    el.style.strokeDashoffset = `${len}`;
    requestAnimationFrame(() => {
      el.style.transition = "stroke-dashoffset 1.5s ease-out";
      el.style.strokeDashoffset = "0";
    });
    const t = setTimeout(() => setReady(true), 200);
    return () => clearTimeout(t);
  }, [data]);

  if (data.length === 0) {
    return <div className="flex items-center justify-center text-sm text-muted-foreground" style={{ height }}>No sales recorded yet</div>;
  }
  const max = Math.max(...data.map((d) => d.value), 1);
  const w = 600;
  const h = height;
  const pad = 30;
  const points = data.map((d, i) => ({
    x: pad + (data.length === 1 ? 0.5 : i / (data.length - 1)) * (w - pad * 2),
    y: h - pad - (d.value / max) * (h - pad * 2),
  }));
  const line = points.map((p) => `${p.x},${p.y}`).join(" ");
  const area = `${points[0].x},${h - pad} ${line} ${points[points.length - 1].x},${h - pad}`;

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
      <polygon points={area} fill="url(#areaFill)"
        style={{ opacity: ready ? 1 : 0, transition: "opacity 0.8s ease-out 0.6s" }} />
      <polyline ref={lineRef} points={line} fill="none" stroke="#1f5d8c" strokeWidth={2.5} strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3} fill="#1f5d8c"
          style={{ opacity: ready ? 1 : 0, transform: ready ? "scale(1)" : "scale(0)", transformOrigin: `${p.x}px ${p.y}px`, transition: `all 0.3s ease-out ${0.8 + i * 0.04}s` }} />
      ))}
      {data.map((d, i) => (
        <text key={i} x={points[i].x} y={h - 8} textAnchor="middle" fontSize={9} fill="rgba(0,0,0,0.4)"
          style={{ opacity: ready ? 1 : 0, transition: `opacity 0.3s ease-out ${0.5 + i * 0.03}s` }}>
          {d.label}
        </text>
      ))}
    </svg>
  );
}

function HBarChart({ data }: { data: { label: string; value: number }[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 100); return () => clearTimeout(t); }, []);
  if (data.length === 0) {
    return <div className="flex items-center justify-center text-sm text-muted-foreground py-12">No brand sales yet</div>;
  }
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="space-y-2.5">
      {data.map((d, i) => (
        <div key={d.label} className="flex items-center gap-3"
          style={{ opacity: mounted ? 1 : 0, transform: mounted ? "translateX(0)" : "translateX(-12px)", transition: `all 0.4s ease-out ${i * 0.1}s` }}>
          <span className="text-[11px] text-muted-foreground w-20 text-right truncate">{d.label}</span>
          <div className="flex-1 h-5 bg-surface rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full"
              style={{ width: mounted ? `${(d.value / max) * 100}%` : "0%", transition: `width 0.8s ease-out ${0.3 + i * 0.1}s` }} />
          </div>
          <span className="text-[11px] font-medium w-16 text-right">{formatCurrency(d.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function DashboardClient({ data }: { data: DashboardData }) {
  const kpis = [
    { label: "Today's Sales", raw: data.todayRevenue, format: formatCurrency, change: "today", up: true, icon: DollarSign, color: "text-success" },
    { label: "Total Invoices", raw: data.totalInvoices, format: (n: number) => n.toString(), change: "all-time", up: true, icon: FileText, color: "text-primary" },
    { label: "Outstanding", raw: data.outstanding, format: formatCurrency, change: "due", up: false, icon: TrendingUp, color: "text-warning" },
    { label: "Low Stock Items", raw: data.lowStockCount, format: (n: number) => n.toString(), change: `${data.lowStockCount} items`, up: false, icon: AlertTriangle, color: "text-destructive" },
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
            <p className="text-2xl font-bold tracking-tight"><AnimatedCounter value={kpi.raw} format={kpi.format} /></p>
            <p className="text-xs text-muted-foreground mt-1">{kpi.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 glass-card p-5">
          <h3 className="text-sm font-semibold mb-4">Sales Trend</h3>
          <MiniAreaChart data={data.dailyTrend} height={260} />
        </div>

        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold mb-4">Top Brands by Revenue</h3>
          <HBarChart data={data.topBrands} />
        </div>
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

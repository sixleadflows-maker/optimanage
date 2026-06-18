"use client";

import { useMemo } from "react";
import { sales, products, expenses } from "@/lib/mock";
import { formatCurrency } from "@/lib/utils/format";

const COLORS = ["#1f5d8c", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4"];

function AreaChart({ data, height = 220 }: { data: { label: string; value: number }[]; height?: number }) {
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
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1f5d8c" stopOpacity={0.2} />
          <stop offset="100%" stopColor="#1f5d8c" stopOpacity={0.02} />
        </linearGradient>
      </defs>
      {[0, 0.25, 0.5, 0.75, 1].map((t) => (
        <line key={t} x1={pad} x2={w - pad} y1={h - pad - t * (h - pad * 2)} y2={h - pad - t * (h - pad * 2)}
          stroke="rgba(0,0,0,0.06)" strokeDasharray="4 4" />
      ))}
      <polygon points={area} fill="url(#areaGrad)" />
      <polyline points={line} fill="none" stroke="#1f5d8c" strokeWidth={2.5} strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3} fill="#1f5d8c" />
      ))}
      {data.filter((_, i) => i % Math.ceil(data.length / 8) === 0 || i === data.length - 1).map((d, _j, arr) => {
        const idx = data.indexOf(d);
        return (
          <text key={idx} x={points[idx].x} y={h - 8} textAnchor="middle" fontSize={9} fill="rgba(0,0,0,0.4)">
            {d.label}
          </text>
        );
      })}
    </svg>
  );
}

function VBarChart({ data, height = 220 }: { data: { label: string; value: number; color?: string }[]; height?: number }) {
  const max = Math.max(...data.map((d) => d.value));
  const barW = Math.min(40, 500 / data.length - 8);
  return (
    <div className="flex items-end justify-center gap-2" style={{ height }}>
      {data.map((d, i) => (
        <div key={d.label} className="flex flex-col items-center gap-1" style={{ width: barW + 16 }}>
          <span className="text-[9px] font-medium text-muted-foreground">{formatCurrency(d.value)}</span>
          <div className="w-full bg-surface rounded-t-md overflow-hidden" style={{ height: height - 50 }}>
            <div className="w-full rounded-t-md transition-all duration-500"
              style={{ height: `${(d.value / max) * 100}%`, backgroundColor: d.color || "#1f5d8c", marginTop: "auto", position: "relative", top: `${100 - (d.value / max) * 100}%` }} />
          </div>
          <span className="text-[9px] text-muted-foreground text-center truncate w-full">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

function HBarChart({ data, suffix = "" }: { data: { label: string; value: number; color?: string }[]; suffix?: string }) {
  const max = Math.max(...data.map((d) => d.value));
  return (
    <div className="space-y-2">
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground w-28 text-right truncate">{d.label}</span>
          <div className="flex-1 h-4 bg-surface rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500"
              style={{ width: `${(d.value / max) * 100}%`, backgroundColor: d.color || "#10b981" }} />
          </div>
          <span className="text-[10px] font-medium w-12 text-right">{d.value.toFixed(suffix === "%" ? 1 : 0)}{suffix}</span>
        </div>
      ))}
    </div>
  );
}

function DonutChart({ data, size = 180 }: { data: { name: string; value: number; color: string }[]; size?: number }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  let cumulative = 0;
  const segments = data.map((d) => {
    const start = cumulative / total;
    cumulative += d.value;
    const end = cumulative / total;
    return { ...d, start, end, pct: ((d.value / total) * 100).toFixed(0) };
  });

  const gradientStops = segments.map((s) => `${s.color} ${s.start * 360}deg ${s.end * 360}deg`).join(", ");

  return (
    <div className="flex items-center gap-6">
      <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
        <div className="w-full h-full rounded-full" style={{ background: `conic-gradient(${gradientStops})` }} />
        <div className="absolute inset-[25%] rounded-full bg-background" />
      </div>
      <div className="space-y-1.5 flex-1">
        {segments.map((s) => (
          <div key={s.name} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: s.color }} />
            <span className="text-[11px] flex-1 truncate">{s.name}</span>
            <span className="text-[11px] font-medium">{s.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const brandRevenue = useMemo(() => {
    const brands: Record<string, number> = {};
    sales.forEach((s) =>
      s.items.forEach((item) => {
        const product = products.find((p) => p.id === item.productId);
        if (product) brands[product.brand] = (brands[product.brand] || 0) + item.total;
      })
    );
    return Object.entries(brands)
      .sort(([, a], [, b]) => b - a)
      .map(([brand, revenue], i) => ({ label: brand, value: revenue, color: COLORS[i % COLORS.length] }));
  }, []);

  const categoryRevenue = useMemo(() => {
    const cats: Record<string, number> = {};
    sales.forEach((s) =>
      s.items.forEach((item) => {
        const product = products.find((p) => p.id === item.productId);
        if (product) cats[product.category] = (cats[product.category] || 0) + item.total;
      })
    );
    return Object.entries(cats).map(([name, value], i) => ({ name, value, color: COLORS[i % COLORS.length] }));
  }, []);

  const dailySales = useMemo(() => {
    const days: Record<string, number> = {};
    sales.forEach((s) => {
      const day = s.date.split("T")[0];
      days[day] = (days[day] || 0) + s.total;
    });
    return Object.entries(days)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, total]) => ({
        label: new Date(date).toLocaleDateString("en-PK", { day: "2-digit", month: "short" }),
        value: total,
      }));
  }, []);

  const stockAnalysis = useMemo(() => {
    const itemSales: Record<string, number> = {};
    sales.forEach((s) =>
      s.items.forEach((item) => {
        itemSales[item.productId] = (itemSales[item.productId] || 0) + item.quantity;
      })
    );
    const fast = products
      .map((p) => ({ ...p, sold: itemSales[p.id] || 0 }))
      .sort((a, b) => b.sold - a.sold)
      .slice(0, 8);
    const dead = products
      .filter((p) => !itemSales[p.id] || itemSales[p.id] === 0)
      .slice(0, 5);
    return { fast, dead };
  }, []);

  const profitMargins = useMemo(() => {
    return products
      .map((p) => ({
        label: `${p.brand} ${p.name}`.slice(0, 25),
        value: ((p.salePrice - p.costPrice) / p.salePrice * 100),
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, []);

  const totalRevenue = sales.reduce((sum, s) => sum + s.total, 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalCost = sales.reduce((sum, s) => sum + s.items.reduce((isum, item) => {
    const p = products.find((pr) => pr.id === item.productId);
    return isum + (p ? p.costPrice * item.quantity : 0);
  }, 0), 0);
  const grossProfit = totalRevenue - totalCost;

  const incomeExpense = [
    { name: "Revenue", amount: totalRevenue },
    { name: "COGS", amount: totalCost },
    { name: "Gross Profit", amount: grossProfit },
    { name: "Expenses", amount: totalExpenses },
    { name: "Net Profit", amount: grossProfit - totalExpenses },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Business intelligence and insights</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {incomeExpense.map((item) => (
          <div key={item.name} className="glass-card p-4">
            <p className="text-xs text-muted-foreground">{item.name}</p>
            <p className={`text-lg font-bold mt-1 ${item.name === "Net Profit" ? (item.amount > 0 ? "text-success" : "text-destructive") : ""}`}>
              {formatCurrency(item.amount)}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold mb-4">Daily Sales Trend</h3>
          <AreaChart data={dailySales} />
        </div>

        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold mb-4">Revenue by Brand</h3>
          <VBarChart data={brandRevenue} />
        </div>

        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold mb-4">Revenue by Category</h3>
          <DonutChart data={categoryRevenue} />
        </div>

        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold mb-4">Top Profit Margins</h3>
          <HBarChart data={profitMargins} suffix="%" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold mb-4">Fast-Moving Products</h3>
          <div className="space-y-2">
            {stockAnalysis.fast.map((p, i) => (
              <div key={p.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{p.brand} {p.name}</p>
                  <p className="text-[10px] text-muted-foreground">{p.model}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold">{p.sold} sold</p>
                  <p className="text-[10px] text-muted-foreground">{p.stock} left</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold mb-4 text-destructive">Dead Stock (No Sales)</h3>
          {stockAnalysis.dead.length > 0 ? (
            <div className="space-y-2">
              {stockAnalysis.dead.map((p) => (
                <div key={p.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{p.brand} {p.name}</p>
                    <p className="text-[10px] text-muted-foreground">{p.category} · {p.model}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium">{p.stock} in stock</p>
                    <p className="text-[10px] text-muted-foreground">{formatCurrency(p.salePrice * p.stock)} value</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No dead stock - all products have been sold!</p>
          )}
        </div>
      </div>
    </div>
  );
}

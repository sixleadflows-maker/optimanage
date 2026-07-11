"use client";

import { useState, useEffect, useCallback } from "react";
import type { AnalyticsData } from "@/lib/data";
import { formatCurrency } from "@/lib/utils/format";
import { verifyAnalyticsPin, getMonthlyAnalytics, type MonthlyAnalyticsData } from "@/lib/actions/analytics";
import { Lock, Loader2, ChevronLeft, ChevronRight, ArrowUpRight, ArrowDownRight } from "lucide-react";

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const COLORS = ["#6d5ef0", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4"];

function AreaChart({ data, height = 220 }: { data: { label: string; value: number }[]; height?: number }) {
  if (data.length === 0) return <div className="flex items-center justify-center text-sm text-muted-foreground" style={{ height }}>No sales yet</div>;
  const max = Math.max(...data.map((d) => d.value), 1);
  const w = 600, h = height, pad = 30;
  const points = data.map((d, i) => ({
    x: pad + (data.length === 1 ? 0.5 : i / (data.length - 1)) * (w - pad * 2),
    y: h - pad - (d.value / max) * (h - pad * 2),
  }));
  const line = points.map((p) => `${p.x},${p.y}`).join(" ");
  const area = `${points[0].x},${h - pad} ${line} ${points[points.length - 1].x},${h - pad}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }}>
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6d5ef0" stopOpacity={0.2} />
          <stop offset="100%" stopColor="#6d5ef0" stopOpacity={0.02} />
        </linearGradient>
      </defs>
      {[0, 0.25, 0.5, 0.75, 1].map((t) => (
        <line key={t} x1={pad} x2={w - pad} y1={h - pad - t * (h - pad * 2)} y2={h - pad - t * (h - pad * 2)} stroke="rgba(0,0,0,0.06)" strokeDasharray="4 4" />
      ))}
      <polygon points={area} fill="url(#areaGrad)" />
      <polyline points={line} fill="none" stroke="#6d5ef0" strokeWidth={2.5} strokeLinejoin="round" />
      {points.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={3} fill="#6d5ef0" />)}
    </svg>
  );
}

function VBarChart({ data, height = 220 }: { data: { label: string; value: number }[]; height?: number }) {
  if (data.length === 0) return <div className="flex items-center justify-center text-sm text-muted-foreground" style={{ height }}>No data</div>;
  const max = Math.max(...data.map((d) => d.value), 1);
  const barW = Math.min(40, 500 / data.length - 8);
  return (
    <div className="flex items-end justify-center gap-2" style={{ height }}>
      {data.map((d, i) => (
        <div key={d.label} className="flex flex-col items-center gap-1" style={{ width: barW + 16 }}>
          <span className="text-[9px] font-medium text-muted-foreground">{formatCurrency(d.value)}</span>
          <div className="w-full bg-surface rounded-t-md overflow-hidden flex items-end" style={{ height: height - 50 }}>
            <div className="w-full rounded-t-md transition-all duration-500" style={{ height: `${(d.value / max) * 100}%`, backgroundColor: COLORS[i % COLORS.length] }} />
          </div>
          <span className="text-[9px] text-muted-foreground text-center truncate w-full">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

function HBarChart({ data, suffix = "" }: { data: { label: string; value: number }[]; suffix?: string }) {
  if (data.length === 0) return <div className="text-sm text-muted-foreground py-8 text-center">No data</div>;
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="space-y-2">
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground w-28 text-right truncate">{d.label}</span>
          <div className="flex-1 h-4 bg-surface rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(d.value / max) * 100}%`, backgroundColor: "#10b981" }} />
          </div>
          <span className="text-[10px] font-medium w-12 text-right">{d.value.toFixed(suffix === "%" ? 1 : 0)}{suffix}</span>
        </div>
      ))}
    </div>
  );
}

function DonutChart({ data, size = 180 }: { data: { name: string; value: number }[]; size?: number }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) return <div className="text-sm text-muted-foreground py-8 text-center">No data</div>;
  let cumulative = 0;
  const segments = data.map((d, i) => {
    const start = cumulative / total;
    cumulative += d.value;
    const end = cumulative / total;
    return { ...d, color: COLORS[i % COLORS.length], start, end, pct: ((d.value / total) * 100).toFixed(0) };
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

function MonthlyPerformance() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<MonthlyAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (y: number, m: number) => {
    setLoading(true);
    try {
      const res = await getMonthlyAnalytics(y, m);
      setData(res);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(year, month);
  }, [year, month, load]);

  const goPrev = () => {
    if (month === 1) { setYear((y) => y - 1); setMonth(12); }
    else setMonth((m) => m - 1);
  };
  const goNext = () => {
    if (month === 12) { setYear((y) => y + 1); setMonth(1); }
    else setMonth((m) => m + 1);
  };
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;

  const delta = (curr: number, prev: number) => {
    if (prev === 0) return curr > 0 ? 100 : 0;
    return ((curr - prev) / Math.abs(prev)) * 100;
  };

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold">Monthly Performance</h3>
        <div className="flex items-center gap-1">
          <button onClick={goPrev} className="p-1.5 rounded-lg hover:bg-surface-hover cursor-pointer"><ChevronLeft className="w-4 h-4" /></button>
          <span className="text-sm font-medium w-32 text-center">{MONTH_NAMES[month - 1]} {year}</span>
          <button onClick={goNext} disabled={isCurrentMonth} className="p-1.5 rounded-lg hover:bg-surface-hover disabled:opacity-30 cursor-pointer"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>

      {loading || !data ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
            {[
              { label: "Total Sales", value: formatCurrency(data.totalSales), delta: delta(data.totalSales, data.prevMonthSales) },
              { label: "Net Profit", value: formatCurrency(data.netProfit), delta: delta(data.netProfit, data.prevMonthNetProfit) },
              { label: "Number of Orders", value: data.totalOrders.toString(), delta: delta(data.totalOrders, data.prevMonthOrders) },
              { label: "Avg Order Value", value: formatCurrency(data.avgOrderValue), delta: null as number | null },
            ].map((k) => (
              <div key={k.label} className="p-3 bg-surface rounded-xl">
                <p className="text-xs text-muted-foreground">{k.label}</p>
                <p className="text-lg font-bold mt-1">{k.value}</p>
                {k.delta !== null && (
                  <span className={`flex items-center gap-0.5 text-[10px] font-medium mt-1 ${k.delta >= 0 ? "text-success" : "text-destructive"}`}>
                    {k.delta >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {Math.abs(k.delta).toFixed(0)}% vs last month
                  </span>
                )}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Daily Sales This Month</p>
              <AreaChart data={data.dailyTrend} height={180} />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Top Brands This Month</p>
              <VBarChart data={data.topBrands} height={180} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function AnalyticsClient({ data }: { data: AnalyticsData }) {
  const [unlocked, setUnlocked] = useState(!data.requiresPin);
  const [pin, setPin] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");

  const tryUnlock = async () => {
    setChecking(true);
    setError("");
    const res = await verifyAnalyticsPin(pin);
    setChecking(false);
    if (res.ok) setUnlocked(true);
    else setError("Incorrect PIN");
  };

  if (!unlocked) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] animate-fade-in">
        <div className="glass-card p-8 w-full max-w-sm text-center">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold">Analytics is protected</h2>
          <p className="text-sm text-muted-foreground mt-1 mb-5">Enter the PIN to view profit and business figures.</p>
          <input type="password" inputMode="numeric" value={pin}
            onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && tryUnlock()}
            maxLength={6} autoFocus
            className="w-full px-4 py-2.5 glass-input text-center tracking-[0.5em] text-lg" placeholder="••••" />
          {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
          <button onClick={tryUnlock} disabled={checking || pin.length < 4}
            className="w-full mt-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-hover transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
            {checking && <Loader2 className="w-4 h-4 animate-spin" />} Unlock
          </button>
        </div>
      </div>
    );
  }

  const incomeExpense = [
    { name: "Revenue", amount: data.totalRevenue },
    { name: "COGS", amount: data.totalCost },
    { name: "Gross Profit", amount: data.grossProfit },
    { name: "Expenses", amount: data.totalExpenses },
    { name: "Net Profit", amount: data.netProfit },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Business intelligence and insights</p>
      </div>

      <MonthlyPerformance />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {incomeExpense.map((item) => (
          <div key={item.name} className="glass-card p-4">
            <p className="text-xs text-muted-foreground">{item.name}</p>
            <p className={`text-lg font-bold mt-1 ${item.name === "Net Profit" ? (item.amount >= 0 ? "text-success" : "text-destructive") : ""}`}>
              {formatCurrency(item.amount)}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold mb-4">Daily Sales Trend</h3>
          <AreaChart data={data.dailySales} />
        </div>
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold mb-4">Revenue by Brand</h3>
          <VBarChart data={data.brandRevenue.slice(0, 8)} />
        </div>
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold mb-4">Revenue by Category</h3>
          <DonutChart data={data.categoryRevenue} />
        </div>
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold mb-4">Top Profit Margins</h3>
          <HBarChart data={data.profitMargins} suffix="%" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold mb-4">Fast-Moving Products</h3>
          <div className="space-y-2">
            {data.fastMoving.every((p) => p.sold === 0) ? (
              <p className="text-sm text-muted-foreground text-center py-6">No sales data yet</p>
            ) : data.fastMoving.map((p, i) => (
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
          {data.deadStock.length > 0 ? (
            <div className="space-y-2">
              {data.deadStock.map((p) => (
                <div key={p.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{p.brand} {p.name}</p>
                    <p className="text-[10px] text-muted-foreground">{p.category} · {p.model}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium">{p.stock} in stock</p>
                    <p className="text-[10px] text-muted-foreground">{formatCurrency(p.value)} value</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No dead stock — all products have sold!</p>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { Fragment, useState, useEffect, useCallback } from "react";
import type { AnalyticsData, LedgerBill } from "@/lib/data";
import { formatCurrency } from "@/lib/utils/format";
import { verifyAnalyticsPin, getMonthlyAnalytics, type MonthlyAnalyticsData, type MonthDay } from "@/lib/actions/analytics";
import { changeAnalyticsPin, resetAnalyticsPinWithPassword } from "@/lib/actions/settings";
import { Lock, Loader2, ChevronLeft, ChevronRight, ArrowUpRight, ArrowDownRight, Package, ChevronDown, ChevronUp } from "lucide-react";

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

/**
 * The month day by day: each day's sales (the payments made that day), the
 * profit on them and the invoices made. A day opens to show every payment.
 */
function DayByDay({ days }: { days: MonthDay[] }) {
  const [open, setOpen] = useState<string | null>(null);
  if (days.length === 0) return <p className="text-sm text-muted-foreground text-center py-6">Nothing sold or paid this month yet</p>;
  const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" });
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs tabular-nums">
        <thead>
          <tr className="text-muted-foreground text-left">
            <th className="font-medium py-2">Day</th>
            <th className="font-medium py-2 text-right">Sales</th>
            <th className="font-medium py-2 text-right">Profit</th>
            <th className="font-medium py-2 text-right">Margin</th>
            <th className="font-medium py-2 text-right">Invoices made</th>
            <th className="w-6" aria-hidden="true"></th>
          </tr>
        </thead>
        <tbody>
          {days.map((d) => {
            const isOpen = open === d.date;
            const margin = d.sales > 0 ? (d.profit / d.sales) * 100 : 0;
            return (
              <Fragment key={d.date}>
                <tr onClick={() => setOpen(isOpen ? null : d.date)}
                  className="border-t border-border cursor-pointer hover:bg-surface-hover">
                  <td className="py-2 font-medium whitespace-nowrap">{day(d.date)}</td>
                  <td className="py-2 text-right font-semibold">{formatCurrency(d.sales)}</td>
                  <td className={`py-2 text-right font-semibold ${d.profit < 0 ? "text-destructive" : "text-success"}`}>{formatCurrency(d.profit)}</td>
                  <td className="py-2 text-right text-muted-foreground">{d.sales > 0 ? `${margin.toFixed(0)}%` : "—"}</td>
                  <td className="py-2 text-right">{d.invoices}</td>
                  <td className="py-2 text-right">
                    {d.payments.length > 0 && (isOpen ? <ChevronUp className="w-3.5 h-3.5 inline" /> : <ChevronDown className="w-3.5 h-3.5 inline" />)}
                  </td>
                </tr>
                {isOpen && d.payments.length > 0 && (
                  <tr>
                    <td colSpan={6} className="pb-3">
                      <div className="rounded-xl bg-surface p-2.5 space-y-1.5">
                        {d.payments.map((p, i) => (
                          <div key={i} className="flex items-center justify-between gap-3">
                            <span className="min-w-0 truncate">
                              <span className="font-semibold">{p.invoiceNo}</span>
                              <span className="text-muted-foreground">{` · ${p.customer}${p.method ? ` · ${p.method}` : ""}`}</span>
                              {p.earlier && <span className="chip bg-primary/10 text-primary ml-1.5">earlier invoice</span>}
                            </span>
                            <span className="flex-shrink-0 text-right">
                              <span className="font-semibold">{formatCurrency(p.amount)}</span>
                              <span className={`ml-2 ${p.profit < 0 ? "text-destructive" : "text-success"}`}>{`profit ${formatCurrency(p.profit)}`}</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// The shop's day, as everywhere else in the app (days turn over at UTC midnight).
const utcDay = (d: Date) => d.toISOString().slice(0, 10);
const RANGES = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "month", label: "This month" },
  { key: "lastMonth", label: "Last month" },
  { key: "all", label: "All time" },
] as const;
type RangeKey = (typeof RANGES)[number]["key"] | "custom";

function rangeFor(key: RangeKey): { from: string; to: string } {
  const now = new Date();
  const today = utcDay(now);
  switch (key) {
    case "today": return { from: today, to: today };
    case "yesterday": { const y = utcDay(new Date(now.getTime() - 86_400_000)); return { from: y, to: y }; }
    case "month": return { from: `${today.slice(0, 8)}01`, to: today };
    case "lastMonth": {
      const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
      const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
      return { from: utcDay(first), to: utcDay(last) };
    }
    default: return { from: "", to: "" };
  }
}

/**
 * Sales, invoiced and outstanding over any dates -- moved here from the
 * dashboard and the invoices list so only the owner sees them. Sales are the
 * payments made in the dates (a balance paid today counts today); invoiced is
 * the bills made in them at full value; outstanding is what's still owed on
 * those bills (on every bill, for all time).
 */
function SalesSummary({ ledger }: { ledger: LedgerBill[] }) {
  const [range, setRange] = useState<RangeKey>("today");
  const [custom, setCustom] = useState(() => rangeFor("month"));
  const { from, to } = range === "custom" ? custom : rangeFor(range);
  const inRange = (day: string) => (!from || day >= from) && (!to || day <= to);

  let sales = 0;
  let fromEarlier = 0;
  let invoiced = 0;
  let bills = 0;
  let owed = 0;
  let owing = 0;
  for (const b of ledger) {
    for (const p of b.paid) {
      if (!inRange(p.day)) continue;
      sales += p.amount;
      if (from && b.day < from) fromEarlier += p.amount;
    }
    if (inRange(b.day)) {
      invoiced += b.total;
      bills++;
      if (b.balance > 0.009) { owed += b.balance; owing++; }
    }
  }
  const label = range === "all" ? "all time" : from === to ? new Date(`${from}T12:00:00Z`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "these dates";

  return (
    <div className="glass-card p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
        <div>
          <h3 className="text-sm font-semibold">Sales, invoices &amp; outstanding</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">Only you see these — they used to be on the Dashboard and the invoices list.</p>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {RANGES.map((r) => (
            <button key={r.key} onClick={() => setRange(r.key)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer ${range === r.key ? "bg-primary text-white" : "bg-surface hover:bg-surface-hover"}`}>
              {r.label}
            </button>
          ))}
          <button onClick={() => setRange("custom")}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer ${range === "custom" ? "bg-primary text-white" : "bg-surface hover:bg-surface-hover"}`}>
            Pick dates
          </button>
        </div>
      </div>
      {range === "custom" && (
        <div className="flex items-center gap-2 mb-4 text-xs flex-wrap">
          <input type="date" value={custom.from} max={custom.to || undefined} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} className="px-3 py-1.5 glass-input text-xs" />
          <span className="text-muted-foreground">to</span>
          <input type="date" value={custom.to} min={custom.from || undefined} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} className="px-3 py-1.5 glass-input text-xs" />
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl bg-surface p-4">
          <p className="text-xs text-muted-foreground">{`Sales — money paid in, ${label}`}</p>
          <p className="text-xl font-bold mt-1 text-success">{formatCurrency(sales)}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {fromEarlier > 0 ? `${formatCurrency(fromEarlier)} of it paid on bills from before · ` : ""}each payment counts on the day it was made
          </p>
        </div>
        <div className="rounded-xl bg-surface p-4">
          <p className="text-xs text-muted-foreground">{`Invoiced — bills made, ${label}`}</p>
          <p className="text-xl font-bold mt-1">{formatCurrency(invoiced)}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{`${bills} invoice${bills === 1 ? "" : "s"}, at full value, paid or not`}</p>
        </div>
        <div className="rounded-xl bg-surface p-4">
          <p className="text-xs text-muted-foreground">{range === "all" ? "Outstanding — owed on all bills" : `Outstanding — still owed on those bills`}</p>
          <p className="text-xl font-bold mt-1 text-destructive">{formatCurrency(owed)}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{`${owing} invoice${owing === 1 ? "" : "s"} with a balance`}</p>
        </div>
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
          <p className="text-[11px] text-muted-foreground -mt-2 mb-4">
            Every payment counts on the day it&apos;s paid: an Rs.8,000 bill paid Rs.4,000 on one day and Rs.4,000 two days later is
            Rs.4,000 of sales on each day. Profit follows the money in the same proportion.
          </p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
            {[
              { label: "Sales (money paid in)", value: formatCurrency(data.totalSales), delta: delta(data.totalSales, data.prevMonthSales) },
              { label: "Profit on those sales", value: formatCurrency(data.grossProfit), delta: null as number | null },
              { label: "Net profit (after expenses)", value: formatCurrency(data.netProfit), delta: delta(data.netProfit, data.prevMonthNetProfit) },
              { label: "Invoices made", value: data.totalOrders.toString(), delta: delta(data.totalOrders, data.prevMonthOrders) },
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
          <div className="mt-5">
            <p className="text-xs font-medium text-muted-foreground mb-1">Day by day — tap a day to see each payment</p>
            <DayByDay days={data.days} />
          </div>
        </>
      )}
    </div>
  );
}

function InventoryValue({ inventory }: { inventory: AnalyticsData["inventory"] }) {
  const [showCategories, setShowCategories] = useState(false);
  const markup = inventory.retailValue - inventory.costValue;

  return (
    <div className="glass-card p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Package className="w-4 h-4 text-primary" /> Stock on hand
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Everything on the shelves right now — {inventory.units.toLocaleString()} units across{" "}
            {inventory.products.toLocaleString()} products
          </p>
        </div>
        {inventory.byCategory.length > 0 && (
          <button
            onClick={() => setShowCategories((v) => !v)}
            className="text-xs text-primary font-medium flex items-center gap-1 flex-shrink-0"
          >
            {showCategories ? "Hide" : "By category"}
            {showCategories ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <p className="text-xs text-muted-foreground">Cost value</p>
          <p className="text-lg font-bold mt-1">{formatCurrency(inventory.costValue)}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">What the stock cost to buy</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Retail value</p>
          <p className="text-lg font-bold mt-1">{formatCurrency(inventory.retailValue)}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">If it all sold at marked price</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Margin in stock</p>
          <p className="text-lg font-bold mt-1 text-success">{formatCurrency(markup)}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Retail less cost</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Out of stock</p>
          <p className="text-lg font-bold mt-1">{inventory.outOfStock.toLocaleString()}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Products showing zero</p>
        </div>
      </div>

      {showCategories && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground text-left">
                <th className="font-medium py-2">Category</th>
                <th className="font-medium py-2 text-right">Units</th>
                <th className="font-medium py-2 text-right">Cost value</th>
                <th className="font-medium py-2 text-right">Retail value</th>
              </tr>
            </thead>
            <tbody>
              {inventory.byCategory.map((c) => (
                <tr key={c.name} className="border-t border-border">
                  <td className="py-2 font-medium">{c.name}</td>
                  <td className="py-2 text-right">{c.units.toLocaleString()}</td>
                  <td className="py-2 text-right">{formatCurrency(c.costValue)}</td>
                  <td className="py-2 text-right">{formatCurrency(c.retailValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function AnalyticsClient({ data }: { data: AnalyticsData }) {
  const [unlocked, setUnlocked] = useState(!data.requiresPin);
  const [pin, setPin] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  // "unlock" asks for the PIN; the other two set a new one — with the current
  // PIN, or with the owner's sign-in password when the PIN has been forgotten.
  const [mode, setMode] = useState<"unlock" | "change" | "forgot">("unlock");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [password, setPassword] = useState("");
  const [done, setDone] = useState("");

  const tryUnlock = async () => {
    setChecking(true);
    setError("");
    const res = await verifyAnalyticsPin(pin);
    setChecking(false);
    if (res.ok) setUnlocked(true);
    else setError("Incorrect PIN");
  };

  const toMode = (next: "unlock" | "change" | "forgot") => {
    setMode(next);
    setError("");
    setDone("");
    setNewPin("");
    setConfirmPin("");
    setPassword("");
  };

  // Setting a new PIN proves who they are, so it opens Analytics as well.
  const saveNewPin = async () => {
    setError("");
    if (newPin.length < 4) { setError("The new PIN must be 4–6 digits"); return; }
    if (newPin !== confirmPin) { setError("The two new PINs don't match"); return; }
    setChecking(true);
    try {
      const res = mode === "change"
        ? await changeAnalyticsPin({ currentPin: pin, newPin })
        : await resetAnalyticsPinWithPassword({ password, newPin });
      if (!res.ok) { setError(res.error); return; }
      setDone("PIN changed");
      setUnlocked(true);
    } catch {
      setError("Couldn't save the PIN — check the connection and try again");
    } finally {
      setChecking(false);
    }
  };

  if (!unlocked) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] animate-fade-in">
        <div className="glass-card p-8 w-full max-w-sm text-center">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold">
            {mode === "unlock" ? "Analytics is protected" : mode === "change" ? "Change the PIN" : "Forgotten the PIN"}
          </h2>
          <p className="text-sm text-muted-foreground mt-1 mb-5">
            {mode === "unlock"
              ? "Enter the PIN to view profit and business figures."
              : mode === "change"
                ? "Enter the PIN you use now, then the new one."
                : "Enter your own sign-in password and pick a new PIN."}
          </p>

          {mode === "forgot" ? (
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus
              className="w-full px-4 py-2.5 glass-input text-sm" placeholder="Your sign-in password" />
          ) : (
            <input type="password" inputMode="numeric" value={pin}
              onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && mode === "unlock" && tryUnlock()}
              maxLength={6} autoFocus
              className="w-full px-4 py-2.5 glass-input text-center tracking-[0.5em] text-lg"
              placeholder="••••" aria-label={mode === "change" ? "Current PIN" : "PIN"} />
          )}

          {mode !== "unlock" && (
            <div className="space-y-2 mt-2">
              <input type="password" inputMode="numeric" value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/[^0-9]/g, ""))}
                maxLength={6} className="w-full px-4 py-2.5 glass-input text-center tracking-[0.5em] text-lg"
                placeholder="New PIN" aria-label="New PIN" />
              <input type="password" inputMode="numeric" value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/[^0-9]/g, ""))}
                onKeyDown={(e) => e.key === "Enter" && saveNewPin()}
                maxLength={6} className="w-full px-4 py-2.5 glass-input text-center tracking-[0.5em] text-lg"
                placeholder="New PIN again" aria-label="New PIN again" />
            </div>
          )}

          {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
          {done && <p className="text-xs text-success mt-2">{done}</p>}

          {mode === "unlock" ? (
            <button onClick={tryUnlock} disabled={checking || pin.length < 4}
              className="w-full mt-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-hover transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
              {checking && <Loader2 className="w-4 h-4 animate-spin" />} Unlock
            </button>
          ) : (
            <button onClick={saveNewPin}
              disabled={checking || newPin.length < 4 || (mode === "change" ? pin.length < 4 : !password)}
              className="w-full mt-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-hover transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
              {checking && <Loader2 className="w-4 h-4 animate-spin" />} Save new PIN
            </button>
          )}

          <div className="flex items-center justify-center gap-3 mt-3 text-xs">
            {mode === "unlock" ? (
              <>
                <button onClick={() => toMode("change")} className="text-primary font-medium cursor-pointer">Change PIN</button>
                <span className="text-muted-foreground">·</span>
                <button onClick={() => toMode("forgot")} className="text-primary font-medium cursor-pointer">Forgotten it?</button>
              </>
            ) : (
              <button onClick={() => toMode("unlock")} className="text-muted-foreground hover:text-foreground cursor-pointer">
                Back to unlocking
              </button>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground mt-3">Only the owner can change this PIN.</p>
        </div>
      </div>
    );
  }

  const incomeExpense = [
    { name: "Sales (all payments)", amount: data.totalRevenue },
    { name: "Cost of goods sold", amount: data.totalCost },
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

      <SalesSummary ledger={data.ledger} />

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

      <InventoryValue inventory={data.inventory} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold mb-4">Daily Sales (by the day each payment was made)</h3>
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

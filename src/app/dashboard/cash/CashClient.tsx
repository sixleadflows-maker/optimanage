"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CashCollectionData } from "@/lib/data";
import { formatCurrency } from "@/lib/utils/format";
import { useApp } from "@/lib/context";
import { saveCashCollection } from "@/lib/actions/cash";
import { Banknote, CreditCard, Building2, Smartphone, Save, Loader2, CheckCircle } from "lucide-react";

export function CashClient({ data, date }: { data: CashCollectionData; date: string }) {
  const { showToast } = useApp();
  const router = useRouter();
  const [openingCash, setOpeningCash] = useState(data.saved?.openingCash ?? 0);
  const [closingCash, setClosingCash] = useState(data.saved?.closingCash ?? 0);
  const [notes, setNotes] = useState(data.saved?.notes ?? "");
  const [saving, setSaving] = useState(false);

  const expectedDrawer = openingCash + data.cashSales - data.expenses;
  const variance = closingCash - expectedDrawer;

  const methods = [
    { label: "Cash", value: data.cashSales, icon: Banknote },
    { label: "Card", value: data.cardSales, icon: CreditCard },
    { label: "Bank Transfer", value: data.bankTransfer, icon: Building2 },
    { label: "JazzCash", value: data.jazzCash, icon: Smartphone },
  ];

  const changeDate = (d: string) => router.push(`/dashboard/cash?date=${d}`);

  const save = async () => {
    setSaving(true);
    try {
      await saveCashCollection({ date, openingCash, closingCash, notes });
      showToast("Day closed & saved", "success");
      router.refresh();
    } catch {
      showToast("Could not save", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Daily Cash Collection</h1>
          <p className="text-sm text-muted-foreground mt-0.5">End-of-day reconciliation & drawer count</p>
        </div>
        <div className="flex items-center gap-2">
          {data.saved && (
            <span className="chip chip-paid flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Closed by {data.saved.closedBy}</span>
          )}
          <input type="date" value={date} onChange={(e) => changeDate(e.target.value)}
            className="px-3 py-2 glass-input text-sm" />
        </div>
      </div>

      {/* Collection breakdown (auto from sales) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {methods.map((m) => (
          <div key={m.label} className="glass-card p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5"><m.icon className="w-3.5 h-3.5" /> {m.label}</p>
            <p className="text-xl font-bold mt-1">{formatCurrency(m.value)}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass-card p-5 space-y-4">
          <h3 className="text-sm font-semibold">Drawer Reconciliation</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Opening Cash (float)</label>
              <input type="number" value={openingCash || ""} onChange={(e) => setOpeningCash(Number(e.target.value))}
                className="w-full px-4 py-2.5 glass-input text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Closing Cash (counted)</label>
              <input type="number" value={closingCash || ""} onChange={(e) => setClosingCash(Number(e.target.value))}
                className="w-full px-4 py-2.5 glass-input text-sm" />
            </div>
          </div>

          <div className="space-y-1.5 text-sm border-t border-border pt-4">
            <div className="flex justify-between"><span className="text-muted-foreground">Opening cash</span><span>{formatCurrency(openingCash)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">+ Cash sales</span><span className="text-success">{formatCurrency(data.cashSales)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">− Cash expenses</span><span className="text-destructive">{formatCurrency(data.expenses)}</span></div>
            <div className="flex justify-between font-semibold border-t border-border pt-1.5"><span>Expected in drawer</span><span>{formatCurrency(expectedDrawer)}</span></div>
            <div className="flex justify-between font-semibold"><span>Counted (closing)</span><span>{formatCurrency(closingCash)}</span></div>
            <div className={`flex justify-between font-bold rounded-lg px-2 py-1.5 mt-1 ${variance === 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
              <span>{variance === 0 ? "Balanced" : variance > 0 ? "Over" : "Short"}</span>
              <span>{formatCurrency(variance)}</span>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Notes</label>
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
              className="w-full px-4 py-2.5 glass-input text-sm" placeholder="Any discrepancies or remarks..." />
          </div>

          <button onClick={save} disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-60">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {data.saved ? "Update Day Close" : "Close Day"}
          </button>
        </div>

        <div className="glass-card p-5 h-fit">
          <h3 className="text-sm font-semibold mb-4">Day Summary</h3>
          <div className="space-y-2.5 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Invoices</span><span className="font-medium">{data.invoiceCount}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Total collected</span><span className="font-medium">{formatCurrency(data.totalCollection)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Expenses</span><span className="font-medium text-destructive">{formatCurrency(data.expenses)}</span></div>
            <div className="flex justify-between border-t border-border pt-2.5 font-semibold">
              <span>Net cash flow</span><span>{formatCurrency(data.totalCollection - data.expenses)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

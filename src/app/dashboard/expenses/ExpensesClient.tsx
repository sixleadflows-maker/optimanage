"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { Expense } from "@/lib/mock/types";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { useApp } from "@/lib/context";
import { createExpense } from "@/lib/actions/expenses";
import { Plus, Search, X, Loader2 } from "lucide-react";

const EXPENSE_CATEGORIES = ["Rent", "Utilities", "Salaries", "Supplies", "Marketing", "Maintenance", "Transport", "Other"];

export function ExpensesClient({ expenses }: { expenses: Expense[] }) {
  const { showToast } = useApp();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    category: "Supplies",
    description: "",
    amount: 0,
    paidBy: "",
  });

  const categories = useMemo(() => {
    const cats = new Set(expenses.map((e) => e.category));
    return ["All", ...Array.from(cats)];
  }, [expenses]);

  const filtered = useMemo(() => {
    return expenses.filter((e) => {
      const matchesSearch = e.description.toLowerCase().includes(search.toLowerCase());
      const matchesCat = categoryFilter === "All" || e.category === categoryFilter;
      return matchesSearch && matchesCat;
    });
  }, [expenses, search, categoryFilter]);

  const totalExpenses = filtered.reduce((sum, e) => sum + e.amount, 0);
  const byCategory = useMemo(() => {
    const cats: Record<string, number> = {};
    expenses.forEach((e) => { cats[e.category] = (cats[e.category] || 0) + e.amount; });
    return Object.entries(cats).sort(([, a], [, b]) => b - a);
  }, [expenses]);

  const handleAdd = async () => {
    if (!form.description.trim() || form.amount <= 0) {
      showToast("Enter a description and amount", "error");
      return;
    }
    setSaving(true);
    try {
      await createExpense(form);
      showToast("Expense recorded", "success");
      setShowAdd(false);
      setForm({ date: new Date().toISOString().slice(0, 10), category: "Supplies", description: "", amount: 0, paidBy: "" });
      router.refresh();
    } catch {
      showToast("Could not save expense", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Expenses</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Track daily shop expenses</p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-hover transition-colors">
          <Plus className="w-4 h-4" /> Add Expense
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-4 sm:col-span-2 lg:col-span-1">
          <p className="text-xs text-muted-foreground">Total Expenses</p>
          <p className="text-xl font-bold mt-1 text-destructive">{formatCurrency(totalExpenses)}</p>
        </div>
        {byCategory.slice(0, 3).map(([cat, total]) => (
          <div key={cat} className="glass-card p-4">
            <p className="text-xs text-muted-foreground">{cat}</p>
            <p className="text-lg font-bold mt-1">{formatCurrency(total)}</p>
          </div>
        ))}
      </div>

      <div className="glass-card p-4">
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input type="text" placeholder="Search expenses..." value={search}
              onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2 glass-input text-sm" />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {categories.map((cat) => (
              <button key={cat} onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-2 rounded-xl text-xs font-medium transition-all whitespace-nowrap ${categoryFilter === cat ? "bg-primary text-white" : "bg-surface hover:bg-surface-hover"}`}>
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Date</th>
                <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Category</th>
                <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Description</th>
                <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">Amount</th>
                <th className="text-center py-3 px-3 text-xs font-medium text-muted-foreground">Paid By</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="text-center py-12 text-muted-foreground text-sm">No expenses recorded</td></tr>
              )}
              {filtered.map((e) => (
                <tr key={e.id} className="border-b border-border hover:bg-surface-hover/50 transition-colors">
                  <td className="py-3 px-3 text-muted-foreground">{formatDate(e.date)}</td>
                  <td className="py-3 px-3"><span className="chip bg-surface text-muted-foreground">{e.category}</span></td>
                  <td className="py-3 px-3">{e.description}</td>
                  <td className="py-3 px-3 text-right font-medium text-destructive">{formatCurrency(e.amount)}</td>
                  <td className="py-3 px-3 text-center text-xs text-muted-foreground">{e.paidBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowAdd(false)}>
          <div className="glass-card p-6 w-full max-w-md animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Add Expense</h3>
              <button onClick={() => setShowAdd(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Date</label>
                  <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full px-3 py-2.5 glass-input text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Category</label>
                  <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full px-3 py-2.5 glass-input text-sm">
                    {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Description *</label>
                <input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full px-4 py-2.5 glass-input text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Amount *</label>
                  <input type="number" value={form.amount || ""} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} className="w-full px-4 py-2.5 glass-input text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Paid By</label>
                  <input type="text" value={form.paidBy} onChange={(e) => setForm({ ...form, paidBy: e.target.value })} className="w-full px-4 py-2.5 glass-input text-sm" placeholder="Optional" />
                </div>
              </div>
              <button onClick={handleAdd} disabled={saving}
                className="w-full py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-hover transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />} Save Expense
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

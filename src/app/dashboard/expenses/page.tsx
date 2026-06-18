"use client";

import { useState, useMemo } from "react";
import { expenses } from "@/lib/mock";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { useApp } from "@/lib/context";
import { Wallet, Plus, Search } from "lucide-react";

export default function ExpensesPage() {
  const { showToast } = useApp();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");

  const categories = useMemo(() => {
    const cats = new Set(expenses.map((e) => e.category));
    return ["All", ...Array.from(cats)];
  }, []);

  const filtered = useMemo(() => {
    return expenses.filter((e) => {
      const matchesSearch = e.description.toLowerCase().includes(search.toLowerCase());
      const matchesCat = categoryFilter === "All" || e.category === categoryFilter;
      return matchesSearch && matchesCat;
    });
  }, [search, categoryFilter]);

  const totalExpenses = filtered.reduce((sum, e) => sum + e.amount, 0);
  const byCategory = useMemo(() => {
    const cats: Record<string, number> = {};
    expenses.forEach((e) => { cats[e.category] = (cats[e.category] || 0) + e.amount; });
    return Object.entries(cats).sort(([, a], [, b]) => b - a);
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Expenses</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Track daily shop expenses</p>
        </div>
        <button onClick={() => showToast("New expense form opened (demo)", "info")}
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
    </div>
  );
}

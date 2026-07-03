"use client";

import { useState, useMemo } from "react";
import type { SaleView } from "@/lib/data";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { Search, Download, Receipt } from "lucide-react";
import { useApp } from "@/lib/context";
import { EmptyState } from "@/components/ui/EmptyState";

export function SalesClient({ sales }: { sales: SaleView[] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const { showToast } = useApp();

  const filtered = useMemo(() => {
    return sales.filter((s) => {
      const matchesSearch =
        s.customerName.toLowerCase().includes(search.toLowerCase()) ||
        s.invoiceNo.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "All" || s.paymentStatus === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [sales, search, statusFilter]);

  const totalRevenue = filtered.reduce((sum, s) => sum + s.total, 0);
  const totalPaid = filtered.reduce((sum, s) => sum + s.paid, 0);
  const totalBalance = filtered.reduce((sum, s) => sum + s.balance, 0);

  const exportCsv = () => {
    if (filtered.length === 0) { showToast("Nothing to export", "info"); return; }
    const header = ["Invoice", "Date", "Customer", "Items", "Total", "Paid", "Balance", "Status", "Payment", "Profit"];
    const rows = filtered.map((s) => [
      s.invoiceNo, s.date, s.customerName, s.items.length, s.total, s.paid, s.balance, s.paymentStatus, s.paymentMethod, s.profit,
    ]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sales-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Exported to CSV", "success");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sales & Invoices</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{filtered.length} invoices found</p>
        </div>
        <button onClick={exportCsv}
          className="flex items-center gap-2 px-4 py-2 glass-card text-sm font-medium cursor-pointer">
          <Download className="w-4 h-4" /> Export
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card p-4">
          <p className="text-xs text-muted-foreground">Total Revenue</p>
          <p className="text-xl font-bold mt-1">{formatCurrency(totalRevenue)}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-xs text-muted-foreground">Total Collected</p>
          <p className="text-xl font-bold mt-1 text-success">{formatCurrency(totalPaid)}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-xs text-muted-foreground">Outstanding</p>
          <p className="text-xl font-bold mt-1 text-destructive">{formatCurrency(totalBalance)}</p>
        </div>
      </div>

      <div className="glass-card p-4">
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search invoices or customers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 glass-input text-sm"
            />
          </div>
          <div className="flex gap-1.5">
            {["All", "Paid", "Advance", "Balance"].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                  statusFilter === status ? "bg-primary text-white" : "bg-surface hover:bg-surface-hover"
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Invoice</th>
                <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Date</th>
                <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Customer</th>
                <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Items</th>
                <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">Total</th>
                <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">Paid</th>
                <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">Balance</th>
                <th className="text-center py-3 px-3 text-xs font-medium text-muted-foreground">Status</th>
                <th className="text-center py-3 px-3 text-xs font-medium text-muted-foreground">Payment</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={9}>
                  <EmptyState icon={Receipt} title="No invoices yet" hint="Sales you ring up in the POS will appear here with payment status and profit." />
                </td></tr>
              )}
              {filtered.map((sale) => (
                <tr key={sale.id} className="border-b border-border hover:bg-surface-hover/50 transition-colors">
                  <td className="py-3 px-3 font-medium text-primary">{sale.invoiceNo}</td>
                  <td className="py-3 px-3 text-muted-foreground">{formatDate(sale.date)}</td>
                  <td className="py-3 px-3">{sale.customerName}</td>
                  <td className="py-3 px-3 text-muted-foreground">{sale.items.length} item{sale.items.length > 1 ? "s" : ""}</td>
                  <td className="py-3 px-3 text-right font-medium">{formatCurrency(sale.total)}</td>
                  <td className="py-3 px-3 text-right text-success">{formatCurrency(sale.paid)}</td>
                  <td className="py-3 px-3 text-right">{sale.balance > 0 ? <span className="text-destructive">{formatCurrency(sale.balance)}</span> : "—"}</td>
                  <td className="py-3 px-3 text-center">
                    <span className={`chip chip-${sale.paymentStatus.toLowerCase()}`}>{sale.paymentStatus}</span>
                  </td>
                  <td className="py-3 px-3 text-center text-xs text-muted-foreground">{sale.paymentMethod}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

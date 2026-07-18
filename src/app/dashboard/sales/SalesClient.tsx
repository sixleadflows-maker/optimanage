"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { SaleView } from "@/lib/data";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { Search, Download, Receipt, RotateCcw, X, Loader2, Trash2 } from "lucide-react";
import { useApp } from "@/lib/context";
import { EmptyState } from "@/components/ui/EmptyState";
import { createReturn } from "@/lib/actions/returns";
import { updateOnlineOrderStatus, deleteSale, type OnlineOrderStatusValue } from "@/lib/actions/sales";

const REFUND_METHODS = ["Cash", "Card", "Bank Transfer", "JazzCash"];
const ONLINE_ORDER_STATUSES: { value: OnlineOrderStatusValue; label: string }[] = [
  { value: "PROCESSING", label: "Processing" },
  { value: "READY_FOR_PICKUP", label: "Ready for Pickup" },
  { value: "OUT_FOR_DELIVERY", label: "Out for Delivery" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

export function SalesClient({ sales, isOwner }: { sales: SaleView[]; isOwner: boolean }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [sourceFilter, setSourceFilter] = useState<string>("All");
  const { showToast } = useApp();
  const router = useRouter();

  const [returningSale, setReturningSale] = useState<SaleView | null>(null);
  const [returnQtys, setReturnQtys] = useState<Record<string, number>>({});
  const [returnReason, setReturnReason] = useState("");
  const [refundMethod, setRefundMethod] = useState("Cash");
  const [savingReturn, setSavingReturn] = useState(false);

  const [deletingSale, setDeletingSale] = useState<SaleView | null>(null);
  const [deleting, setDeleting] = useState(false);

  const confirmDeleteSale = async () => {
    if (!deletingSale) return;
    setDeleting(true);
    try {
      await deleteSale(deletingSale.id);
      showToast(`${deletingSale.invoiceNo} deleted`, "success");
      setDeletingSale(null);
      router.refresh();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Could not delete invoice", "error");
    } finally {
      setDeleting(false);
    }
  };

  const openReturn = (sale: SaleView) => {
    setReturnQtys({});
    setReturnReason("");
    setRefundMethod(sale.paymentMethod || "Cash");
    setReturningSale(sale);
  };

  const returnableItems = (sale: SaleView) => sale.items.filter((i) => i.quantity - i.returnedQuantity > 0);

  const returnTotal = returningSale
    ? returningSale.items.reduce((sum, i) => sum + (returnQtys[i.id] || 0) * i.unitPrice, 0)
    : 0;

  const saveReturn = async () => {
    if (!returningSale) return;
    const items = Object.entries(returnQtys)
      .filter(([, qty]) => qty > 0)
      .map(([saleItemId, quantity]) => ({ saleItemId, quantity }));
    if (items.length === 0) { showToast("Select at least one item to return", "error"); return; }
    setSavingReturn(true);
    try {
      const res = await createReturn({ saleId: returningSale.id, items, reason: returnReason, refundMethod });
      showToast(`${res.returnNo} — refund ${formatCurrency(res.totalRefund)}`, "success");
      setReturningSale(null);
      router.refresh();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Could not process return", "error");
    } finally {
      setSavingReturn(false);
    }
  };

  const filtered = useMemo(() => {
    return sales.filter((s) => {
      const matchesSearch =
        s.customerName.toLowerCase().includes(search.toLowerCase()) ||
        s.invoiceNo.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "All" || s.paymentStatus === statusFilter;
      const matchesSource = sourceFilter === "All" || s.source === sourceFilter;
      return matchesSearch && matchesStatus && matchesSource;
    });
  }, [sales, search, statusFilter, sourceFilter]);

  const handleStatusChange = async (saleId: string, status: OnlineOrderStatusValue) => {
    try {
      await updateOnlineOrderStatus(saleId, status);
      router.refresh();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Could not update order status", "error");
    }
  };

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
          <div className="flex gap-1.5">
            {["All", "POS", "Online"].map((source) => (
              <button
                key={source}
                onClick={() => setSourceFilter(source)}
                className={`px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                  sourceFilter === source ? "bg-secondary text-white" : "bg-surface hover:bg-surface-hover"
                }`}
              >
                {source}
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
                <th className="text-center py-3 px-3 text-xs font-medium text-muted-foreground">Source</th>
                <th className="text-center py-3 px-3 text-xs font-medium text-muted-foreground">Fulfillment</th>
                <th className="text-center py-3 px-3 text-xs font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={12}>
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
                  <td className="py-3 px-3 text-center">
                    <span className={`text-[10px] px-2 py-0.5 rounded-md font-medium ${sale.source === "Online" ? "bg-secondary/10 text-secondary" : "bg-surface text-muted-foreground"}`}>
                      {sale.source}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center">
                    {sale.source === "Online" ? (
                      <select
                        value={sale.onlineOrderStatus ?? "Processing"}
                        onChange={(e) => handleStatusChange(sale.id, ONLINE_ORDER_STATUSES.find((s) => s.label === e.target.value)!.value)}
                        className="px-2 py-1 glass-input text-[11px]"
                      >
                        {ONLINE_ORDER_STATUSES.map((s) => (
                          <option key={s.value} value={s.label}>{s.label}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex items-center justify-center gap-1.5">
                      {returnableItems(sale).length > 0 && (
                        <button onClick={() => openReturn(sale)} title="Return / Refund"
                          className="p-1.5 rounded-lg hover:bg-surface-hover cursor-pointer">
                          <RotateCcw className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                      )}
                      {isOwner && (
                        <button onClick={() => setDeletingSale(sale)} title="Delete Invoice"
                          className="p-1.5 rounded-lg hover:bg-surface-hover cursor-pointer">
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {returningSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setReturningSale(null)}>
          <div className="glass-modal p-6 w-full max-w-lg animate-rise max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Return / Refund — {returningSale.invoiceNo}</h3>
              <button onClick={() => setReturningSale(null)} className="cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-2">
              {returnableItems(returningSale).map((item) => {
                const remaining = item.quantity - item.returnedQuantity;
                return (
                  <div key={item.id} className="flex items-center gap-3 p-2.5 bg-surface rounded-xl">
                    <div className="flex-1">
                      <p className="text-xs font-medium">{item.productName}</p>
                      <p className="text-[10px] text-muted-foreground">Sold {item.quantity} · Already returned {item.returnedQuantity} · Eligible {remaining} · {formatCurrency(item.unitPrice)} each</p>
                    </div>
                    <input type="number" min={0} max={remaining} value={returnQtys[item.id] ?? 0}
                      onChange={(e) => setReturnQtys((prev) => ({ ...prev, [item.id]: Math.max(0, Math.min(remaining, Number(e.target.value))) }))}
                      className="w-20 px-2 py-1.5 glass-input text-xs text-center" />
                  </div>
                );
              })}

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Reason (optional)</label>
                <input type="text" value={returnReason} onChange={(e) => setReturnReason(e.target.value)}
                  className="w-full px-4 py-2.5 glass-input text-sm" placeholder="e.g. wrong prescription, changed mind..." />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Refund Method</label>
                <select value={refundMethod} onChange={(e) => setRefundMethod(e.target.value)} className="w-full px-4 py-2.5 glass-input text-sm">
                  {REFUND_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-border">
                <span className="text-sm font-semibold">Refund Total</span>
                <span className="text-lg font-bold text-destructive">{formatCurrency(returnTotal)}</span>
              </div>

              <button onClick={saveReturn} disabled={savingReturn || returnTotal <= 0}
                className="w-full py-2.5 bg-destructive text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer">
                {savingReturn && <Loader2 className="w-4 h-4 animate-spin" />} Confirm Return
              </button>
            </div>
          </div>
        </div>
      )}

      {deletingSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDeletingSale(null)}>
          <div className="glass-modal p-6 w-full max-w-sm animate-rise" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Delete Invoice</h3>
              <button onClick={() => setDeletingSale(null)} className="cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-muted-foreground">
              Delete <span className="font-semibold text-foreground">{deletingSale.invoiceNo}</span> ({formatCurrency(deletingSale.total)})?
              This restores stock and can&apos;t be undone.
            </p>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setDeletingSale(null)}
                className="flex-1 py-2.5 glass-card text-sm font-medium cursor-pointer">
                Cancel
              </button>
              <button onClick={confirmDeleteSale} disabled={deleting}
                className="flex-1 py-2.5 bg-destructive text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer">
                {deleting && <Loader2 className="w-4 h-4 animate-spin" />} Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { SaleView } from "@/lib/data";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { Search, Download, Receipt, RotateCcw, X, Loader2, Trash2, Eye, Printer, MessageCircle, CalendarRange, Wallet, Pencil, Undo2, WifiOff, History } from "lucide-react";
import { useApp } from "@/lib/context";
import { EmptyState } from "@/components/ui/EmptyState";
import { PrintPortal } from "@/components/ui/PrintPortal";
import { createReturn, deleteReturn, updateReturn } from "@/lib/actions/returns";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { updateOnlineOrderStatus, deleteSale, type OnlineOrderStatusValue } from "@/lib/actions/sales";
import { PAYMENT_STATUS, paymentStatusChipClass } from "@/lib/constants";
import { ThermalReceipt, A4Invoice, invoiceFromSale, type ShopDetails } from "@/components/invoice/InvoiceDocuments";
import { CollectPaymentModal, EditInvoiceModal, EditPaymentModal, type EditorCustomer, type EditorStaff } from "./InvoiceEditor";

const REFUND_METHODS = ["Cash", "Card", "Bank Transfer", "JazzCash"];
const ONLINE_ORDER_STATUSES: { value: OnlineOrderStatusValue; label: string }[] = [
  { value: "PROCESSING", label: "Processing" },
  { value: "READY_FOR_PICKUP", label: "Ready for Pickup" },
  { value: "OUT_FOR_DELIVERY", label: "Out for Delivery" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

// The shop's own calendar day for a sale (not the UTC one), so a late-evening
// sale falls on the day it was actually made.
function localDay(isoDateTime: string) {
  const d = new Date(isoDateTime);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-PK", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** Everything that happened to an invoice after it was rung up, with times. */
function InvoiceHistory({
  sale, canUndoReturn, onUndoReturn, canEditPayments, onEditPayment, onEditReturn,
}: {
  sale: SaleView;
  canUndoReturn: boolean;
  onUndoReturn: (ret: SaleView["returns"][number]) => void;
  canEditPayments: boolean;
  onEditPayment: (payment: SaleView["payments"][number]) => void;
  onEditReturn: (ret: SaleView["returns"][number]) => void;
}) {
  const laterTotal = sale.payments.reduce((sum, p) => sum + p.amount, 0);
  const takenAtTill = sale.paid - laterTotal;
  // An invoice keyed in well after its own date is an old record from paper.
  const enteredLater = new Date(sale.enteredAt).getTime() - new Date(sale.dateTime).getTime() > 60 * 60_000 && !sale.offlineRef;
  const hasHistory = sale.payments.length > 0 || sale.returns.length > 0 || enteredLater || !!sale.offlineRef;
  if (!hasHistory) return null;

  return (
    <div className="mt-4 rounded-xl border border-border p-3 text-xs space-y-3">
      <p className="font-semibold flex items-center gap-1.5"><History className="w-3.5 h-3.5 text-primary" /> History</p>

      {sale.offlineRef && (
        <p className="flex items-start gap-1.5 text-muted-foreground">
          <WifiOff className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          Made while the till was offline — the customer&apos;s bill shows {sale.offlineRef}. Synced {when(sale.enteredAt)}.
        </p>
      )}
      {enteredLater && (
        <p className="text-muted-foreground">
          Old invoice dated {when(sale.dateTime)}, entered {when(sale.enteredAt)}
          {sale.stockDeducted ? "." : " without taking items out of stock."}
        </p>
      )}

      {sale.payments.length > 0 && (
        <div>
          <p className="text-muted-foreground mb-1">Payments</p>
          <div className="space-y-1">
            <div className="flex justify-between gap-3">
              <span>{when(sale.dateTime)} · {sale.paymentMethod} · at the till</span>
              <span className="font-medium">{formatCurrency(takenAtTill)}</span>
            </div>
            {sale.payments.map((p) => (
              <div key={p.id} className="flex justify-between gap-3 items-start">
                <span className="min-w-0">
                  {when(p.date)} · {p.method}
                  {p.receivedByName && ` · ${p.receivedByName}`}
                  {p.note && <span className="text-muted-foreground"> · {p.note}</span>}
                </span>
                <span className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="font-medium">{formatCurrency(p.amount)}</span>
                  {canEditPayments && (
                    <button onClick={() => onEditPayment(p)} title="Correct this payment"
                      className="p-0.5 rounded hover:bg-surface-hover cursor-pointer">
                      <Pencil className="w-3 h-3 text-muted-foreground" />
                    </button>
                  )}
                </span>
              </div>
            ))}
            <div className="flex justify-between gap-3 border-t border-border pt-1 font-semibold">
              <span>{sale.balance > 0 ? "Still owed" : "Paid in full"}</span>
              <span>{formatCurrency(sale.balance > 0 ? sale.balance : sale.paid)}</span>
            </div>
          </div>
        </div>
      )}

      {sale.returns.length > 0 && (
        <div>
          <p className="text-muted-foreground mb-1">Returns</p>
          <div className="space-y-1.5">
            {sale.returns.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3">
                <span>
                  <span className="font-medium">{r.returnNo}</span> · {when(r.date)} · refund {formatCurrency(r.totalRefund)}
                  {r.reason && <span className="text-muted-foreground"> · {r.reason}</span>}
                </span>
                {canUndoReturn && (
                  <span className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => onEditReturn(r)}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-surface hover:bg-surface-hover font-medium cursor-pointer">
                      <Pencil className="w-3 h-3" /> Edit
                    </button>
                    <button onClick={() => onUndoReturn(r)}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-surface hover:bg-surface-hover font-medium cursor-pointer">
                      <Undo2 className="w-3 h-3" /> Undo
                    </button>
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function SalesClient({
  sales, isOwner, canEdit, customers, staff, shop,
}: {
  sales: SaleView[];
  isOwner: boolean;
  canEdit: boolean;
  customers: EditorCustomer[];
  staff: EditorStaff[];
  shop: ShopDetails;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [sourceFilter, setSourceFilter] = useState<string>("All");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const { showToast } = useApp();
  const router = useRouter();

  const [returningSale, setReturningSale] = useState<SaleView | null>(null);
  const [returnQtys, setReturnQtys] = useState<Record<string, number>>({});
  const [returnReason, setReturnReason] = useState("");
  const [refundMethod, setRefundMethod] = useState("Cash");
  const [savingReturn, setSavingReturn] = useState(false);

  const [deletingSale, setDeletingSale] = useState<SaleView | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Reopening a past invoice to look at or reprint it.
  const [payingSale, setPayingSale] = useState<SaleView | null>(null);
  const [undoingReturn, setUndoingReturn] = useState<{ sale: SaleView; ret: SaleView["returns"][number] } | null>(null);
  const [editingPayment, setEditingPayment] = useState<{ sale: SaleView; payment: SaleView["payments"][number] } | null>(null);
  const [editingReturn, setEditingReturn] = useState<SaleView["returns"][number] | null>(null);
  const [returnForm, setReturnForm] = useState({ reason: "", refundMethod: "Cash", totalRefund: 0 });
  const [savingReturnEdit, setSavingReturnEdit] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [editingSale, setEditingSale] = useState<SaleView | null>(null);
  const [viewingSale, setViewingSale] = useState<SaleView | null>(null);
  const [viewFormat, setViewFormat] = useState<"thermal" | "a4">("thermal");
  const [printJob, setPrintJob] = useState<"thermal" | "a4" | null>(null);
  const viewingInvoice = viewingSale ? invoiceFromSale(viewingSale) : null;

  // Same two-step print as labels: render the bill into the body-level print
  // container first, then print once it's painted. Printing it where it sits
  // inside this long page would push blank pages out with it.
  useEffect(() => {
    if (!printJob) return;
    const classes = ["printing-from-portal", `printing-${printJob}`];
    let timer: ReturnType<typeof setTimeout>;
    const cleanup = () => {
      document.body.classList.remove(...classes);
      window.removeEventListener("afterprint", cleanup);
      setPrintJob(null);
    };
    document.body.classList.add(...classes);
    window.addEventListener("afterprint", cleanup);
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.print();
        timer = setTimeout(cleanup, 1500);
      });
    });
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [printJob]);

  const confirmDeleteSale = async () => {
    if (!deletingSale) return;
    setDeleting(true);
    try {
      const res = await deleteSale(deletingSale.id);
      if (!res.ok) {
        showToast(res.error, "error");
        return;
      }
      showToast(
        `${deletingSale.invoiceNo}${res.hadReturns ? " and its return" : ""} moved to Trash${deletingSale.stockDeducted ? " — stock put back" : ""}`,
        "success"
      );
      setDeletingSale(null);
      router.refresh();
    } catch {
      showToast("Could not delete the invoice — check the connection and try again", "error");
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
    const q = search.trim().toLowerCase();
    return sales.filter((s) => {
      const matchesSearch =
        !q ||
        s.customerName.toLowerCase().includes(q) ||
        s.invoiceNo.toLowerCase().includes(q) ||
        (s.offlineRef && s.offlineRef.toLowerCase().includes(q)) ||
        s.customerPhone.includes(q) ||
        s.items.some((i) => i.productName.toLowerCase().includes(q) || i.description.toLowerCase().includes(q));
      const matchesStatus = statusFilter === "All" || s.paymentStatus === statusFilter;
      const matchesSource = sourceFilter === "All" || s.source === sourceFilter;
      const day = localDay(s.dateTime);
      const matchesDates = (!fromDate || day >= fromDate) && (!toDate || day <= toDate);
      return matchesSearch && matchesStatus && matchesSource && matchesDates;
    });
  }, [sales, search, statusFilter, sourceFilter, fromDate, toDate]);

  const setRange = (range: "today" | "month" | "all") => {
    const today = localDay(new Date().toISOString());
    if (range === "all") { setFromDate(""); setToDate(""); }
    else if (range === "today") { setFromDate(today); setToDate(today); }
    else { setFromDate(`${today.slice(0, 8)}01`); setToDate(today); }
  };

  const oldestSale = sales.length > 0 ? sales[sales.length - 1] : null;

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
      s.invoiceNo, localDay(s.dateTime), s.customerName, s.items.map((i) => i.productName).join("; "), s.total, s.paid, s.balance, s.paymentStatus, s.paymentMethod, s.profit,
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
          <p className="text-sm text-muted-foreground mt-0.5">
            {filtered.length} of {sales.length} invoices
            {oldestSale && ` · complete history since ${formatDate(oldestSale.dateTime)}`}
          </p>
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
        <div className="flex flex-col sm:flex-row gap-3 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search invoice no., customer, phone or item..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 glass-input text-sm"
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {["All", ...PAYMENT_STATUS].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-2 rounded-xl text-xs font-medium transition-all whitespace-nowrap ${
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

        <div className="flex items-center gap-2 flex-wrap mb-4">
          <CalendarRange className="w-4 h-4 text-muted-foreground" />
          <label className="text-xs text-muted-foreground">From</label>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="px-2.5 py-1.5 glass-input text-xs" />
          <label className="text-xs text-muted-foreground">To</label>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="px-2.5 py-1.5 glass-input text-xs" />
          <div className="flex gap-1">
            {([["today", "Today"], ["month", "This month"], ["all", "All time"]] as const).map(([key, label]) => (
              <button key={key} onClick={() => setRange(key)}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-surface hover:bg-surface-hover transition-colors ${
                  key === "all" && !fromDate && !toDate ? "ring-1 ring-primary/40 text-primary" : ""
                }`}>
                {label}
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
                  <EmptyState icon={Receipt}
                    title={sales.length === 0 ? "No invoices yet" : "No invoices match"}
                    hint={sales.length === 0
                      ? "Sales you ring up in the POS will appear here with payment status and profit."
                      : "Try a different search, status or date range — or pick “All time”."} />
                </td></tr>
              )}
              {filtered.map((sale) => (
                <tr key={sale.id} className="border-b border-border hover:bg-surface-hover/50 transition-colors">
                  <td className="py-3 px-3">
                    <button onClick={() => { setViewFormat("thermal"); setViewingSale(sale); }}
                      className="font-medium text-primary hover:underline cursor-pointer">
                      {sale.invoiceNo}
                    </button>
                    {sale.offlineRef && <p className="text-[10px] text-muted-foreground">{sale.offlineRef}</p>}
                  </td>
                  <td className="py-3 px-3 text-muted-foreground whitespace-nowrap">{formatDate(sale.dateTime)}</td>
                  <td className="py-3 px-3">{sale.customerName}</td>
                  <td className="py-3 px-3 text-muted-foreground">{sale.items.length} item{sale.items.length === 1 ? "" : "s"}</td>
                  <td className="py-3 px-3 text-right font-medium">{formatCurrency(sale.total)}</td>
                  <td className="py-3 px-3 text-right text-success">{formatCurrency(sale.paid)}</td>
                  <td className="py-3 px-3 text-right">{sale.balance > 0 ? <span className="text-destructive">{formatCurrency(sale.balance)}</span> : "—"}</td>
                  <td className="py-3 px-3 text-center">
                    <span className={`chip whitespace-nowrap ${paymentStatusChipClass(sale.paymentStatus)}`}>{sale.paymentStatus}</span>
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
                      <button onClick={() => { setViewFormat("thermal"); setViewingSale(sale); }} title="View / reprint invoice"
                        className="p-1.5 rounded-lg hover:bg-surface-hover cursor-pointer">
                        <Eye className="w-3.5 h-3.5 text-primary" />
                      </button>
                      {sale.balance > 0 && (
                        <button onClick={() => setPayingSale(sale)} title="Receive payment"
                          className="p-1.5 rounded-lg hover:bg-surface-hover cursor-pointer">
                          <Wallet className="w-3.5 h-3.5 text-success" />
                        </button>
                      )}
                      {canEdit && sale.source === "POS" && !sale.hasReturn && (
                        <button onClick={() => setEditingSale(sale)} title="Edit invoice"
                          className="p-1.5 rounded-lg hover:bg-surface-hover cursor-pointer">
                          <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                      )}
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

      {viewingSale && viewingInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setViewingSale(null)}>
          <div className="glass-modal p-6 w-full max-w-3xl animate-rise max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-semibold">{viewingSale.invoiceNo}</h3>
                <p className="text-xs text-muted-foreground">
                  {viewingInvoice.date} · {viewingSale.customerName} · {formatCurrency(viewingSale.total)}
                </p>
              </div>
              <button onClick={() => setViewingSale(null)} className="cursor-pointer"><X className="w-5 h-5" /></button>
            </div>

            <div className="flex gap-1.5 mb-4">
              {([["thermal", "Receipt (80mm)"], ["a4", "A4 Invoice"]] as const).map(([key, label]) => (
                <button key={key} onClick={() => setViewFormat(key)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${viewFormat === key ? "bg-primary text-white" : "bg-surface hover:bg-surface-hover"}`}>
                  {label}
                </button>
              ))}
            </div>

            <div className="bg-surface/50 rounded-xl p-4 overflow-x-auto">
              {viewFormat === "thermal"
                ? <ThermalReceipt invoice={viewingInvoice} shop={shop} />
                : <A4Invoice invoice={viewingInvoice} shop={shop} />}
            </div>

            <InvoiceHistory
              sale={viewingSale}
              canUndoReturn={canEdit}
              onUndoReturn={(ret) => setUndoingReturn({ sale: viewingSale, ret })}
              canEditPayments={canEdit}
              onEditPayment={(payment) => setEditingPayment({ sale: viewingSale, payment })}
              onEditReturn={(ret) => {
                setEditingReturn(ret);
                setReturnForm({ reason: ret.reason, refundMethod: "Cash", totalRefund: ret.totalRefund });
              }}
            />

            <div className="flex gap-2 mt-4 flex-wrap">
              <button onClick={() => setPrintJob("thermal")} disabled={printJob !== null}
                className="flex-1 min-w-[140px] flex items-center justify-center gap-2 py-2.5 glass-card text-sm font-medium cursor-pointer disabled:opacity-60">
                <Printer className="w-4 h-4" /> Print Receipt
              </button>
              <button onClick={() => setPrintJob("a4")} disabled={printJob !== null}
                className="flex-1 min-w-[140px] flex items-center justify-center gap-2 py-2.5 glass-card text-sm font-medium cursor-pointer disabled:opacity-60">
                <Printer className="w-4 h-4" /> Print A4
              </button>
              {viewingSale.balance > 0 && (
                <button onClick={() => { const sale = viewingSale; setViewingSale(null); setPayingSale(sale); }}
                  className="flex-1 min-w-[140px] flex items-center justify-center gap-2 py-2.5 bg-primary text-white rounded-2xl text-sm font-medium hover:bg-primary-hover transition-colors cursor-pointer">
                  <Wallet className="w-4 h-4" /> Receive {formatCurrency(viewingSale.balance)}
                </button>
              )}
              {viewingSale.customerPhone && (
                <button onClick={() => {
                    const phone = viewingSale.customerPhone.replace(/[^0-9]/g, "");
                    const msg = encodeURIComponent(`Thank you for shopping at ${shop.name}! Your invoice ${viewingSale.invoiceNo} total is ${formatCurrency(viewingSale.total)}.`);
                    window.open(`https://wa.me/${phone}?text=${msg}`, "_blank");
                  }}
                  className="flex-1 min-w-[140px] flex items-center justify-center gap-2 py-2.5 bg-[#25D366] text-white rounded-2xl text-sm font-medium hover:bg-[#20bd5a] transition-colors">
                  <MessageCircle className="w-4 h-4" /> WhatsApp
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {payingSale && (
        <CollectPaymentModal
          sale={payingSale}
          onClose={() => setPayingSale(null)}
          onDone={(message) => {
            setPayingSale(null);
            showToast(message, "success");
            router.refresh();
          }}
        />
      )}

      {editingPayment && (
        <EditPaymentModal
          sale={editingPayment.sale}
          payment={editingPayment.payment}
          onClose={() => setEditingPayment(null)}
          onDone={(message) => {
            setEditingPayment(null);
            setViewingSale(null);
            showToast(message, "success");
            router.refresh();
          }}
        />
      )}

      {editingSale && (
        <EditInvoiceModal
          sale={editingSale}
          customers={customers}
          staff={staff}
          canBackdate={canEdit}
          onClose={() => setEditingSale(null)}
          onDone={(message) => {
            setEditingSale(null);
            showToast(message, "success");
            router.refresh();
          }}
        />
      )}

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
              {deletingSale.stockDeducted ? " Items still out with the customer go back into stock." : " It was entered without taking stock, so stock doesn't change."}
              {" "}It moves to the Trash, and you can restore it for 30 days.
            </p>
            {deletingSale.items.some((i) => i.returnedQuantity > 0) && (
              <p className="text-xs text-warning mt-2">
                This invoice has a return on it — the return goes to the Trash with it. Items already returned were put back in stock at the time, so they aren&apos;t added again.
              </p>
            )}
            <div className="flex gap-2 mt-5">
              <button onClick={() => setDeletingSale(null)}
                className="flex-1 py-2.5 glass-card text-sm font-medium cursor-pointer">
                Cancel
              </button>
              <button onClick={confirmDeleteSale} disabled={deleting}
                className="flex-1 py-2.5 bg-destructive text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer">
                {deleting && <Loader2 className="w-4 h-4 animate-spin" />} Move to Trash
              </button>
            </div>
          </div>
        </div>
      )}

      {editingReturn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditingReturn(null)}>
          <div className="glass-modal p-6 w-full max-w-sm animate-rise" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Edit {editingReturn.returnNo}</h3>
              <button onClick={() => setEditingReturn(null)} className="cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              To change which items came back, undo the return and enter it again — the stock has to move with it.
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Refund amount</label>
                <input type="number" min={0} value={returnForm.totalRefund}
                  onChange={(e) => setReturnForm((f) => ({ ...f, totalRefund: Math.max(0, Number(e.target.value) || 0) }))}
                  className="w-full px-3 py-2.5 glass-input text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Refunded by</label>
                <select value={returnForm.refundMethod} onChange={(e) => setReturnForm((f) => ({ ...f, refundMethod: e.target.value }))}
                  className="w-full px-3 py-2.5 glass-input text-sm">
                  {REFUND_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Reason</label>
                <input type="text" value={returnForm.reason} onChange={(e) => setReturnForm((f) => ({ ...f, reason: e.target.value }))}
                  className="w-full px-3 py-2.5 glass-input text-sm" placeholder="Optional" />
              </div>
              <button
                onClick={async () => {
                  setSavingReturnEdit(true);
                  try {
                    const res = await updateReturn(editingReturn.id, returnForm);
                    if (!res.ok) { showToast(res.error, "error"); return; }
                    showToast(`${editingReturn.returnNo} updated`, "success");
                    setEditingReturn(null);
                    setViewingSale(null);
                    router.refresh();
                  } catch {
                    showToast("Could not update the return — check the connection and try again", "error");
                  } finally {
                    setSavingReturnEdit(false);
                  }
                }}
                disabled={savingReturnEdit}
                className="w-full py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-hover transition-colors disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer">
                {savingReturnEdit && <Loader2 className="w-4 h-4 animate-spin" />} Save changes
              </button>
            </div>
          </div>
        </div>
      )}

      {undoingReturn && (
        <ConfirmDialog
          title={`Undo ${undoingReturn.ret.returnNo}?`}
          message={`The ${formatCurrency(undoingReturn.ret.totalRefund)} refund on ${undoingReturn.sale.invoiceNo} is cancelled: the items count as sold again and come off the shelf. It moves to the Trash and can be put back for 30 days.`}
          confirmLabel="Undo return"
          busy={undoing}
          onCancel={() => setUndoingReturn(null)}
          onConfirm={async () => {
            setUndoing(true);
            try {
              const res = await deleteReturn(undoingReturn.ret.id);
              if (!res.ok) { showToast(res.error, "error"); return; }
              showToast(`${undoingReturn.ret.returnNo} undone — ${undoingReturn.sale.invoiceNo} can be edited again`, "success");
              setUndoingReturn(null);
              setViewingSale(null);
              router.refresh();
            } catch {
              showToast("Could not undo the return — check the connection and try again", "error");
            } finally {
              setUndoing(false);
            }
          }}
        />
      )}

      {/* Always mounted so the container exists before a print is requested. */}
      <PrintPortal>
        {printJob && viewingInvoice && (
          printJob === "thermal"
            ? <ThermalReceipt invoice={viewingInvoice} shop={shop} />
            : <A4Invoice invoice={viewingInvoice} shop={shop} />
        )}
      </PrintPortal>
    </div>
  );
}

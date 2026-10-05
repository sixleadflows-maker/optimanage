"use client";

import { useEffect, useRef, useState } from "react";
import type { SaleView } from "@/lib/data";
import { formatCurrency, toLocalInput } from "@/lib/utils/format";
import { useApp } from "@/lib/context";
import { cancelBalance, collectSalePayment, updateSale, updateSalePayment } from "@/lib/actions/sales";
import { searchProductsForSale, type ProductSearchHit } from "@/lib/actions/products";
import { CREDIT_METHOD, DISCOUNT_PERCENTAGES, LENS_COLORS, PAYMENT_METHODS } from "@/lib/constants";
import { customerCreditHeld } from "@/lib/actions/credit";
import { Loader2, Plus, Search, Trash2, Wallet, X, Pencil, AlertTriangle, CalendarClock, User } from "lucide-react";
import { SPLIT_METHOD, paymentFromParts, primaryMethod } from "@/lib/sales/paymentSplit";
import { SplitPaymentFields, splitAmountsTotal, type SplitAmounts } from "@/components/invoice/SplitPaymentFields";
import { CustomerFormModal, type CustomerFormData, type SavedCustomer } from "@/app/dashboard/customers/CustomerFormModal";
import { matchesSearch } from "@/lib/utils/search";
import { allNumbers } from "@/lib/utils/phone";
import { unstable_isUnrecognizedActionError } from "next/navigation";
import { reportOutdatedPage } from "@/components/layout/UpdateNotice";

/**
 * A save that got no answer at all: this page is from before an update (the
 * server no longer recognises what it sends) or the connection dropped. Without
 * this the Save button just kept spinning and nothing said why.
 */
function saveFailed(e: unknown, showToast: (message: string, type?: "success" | "error" | "info") => void) {
  if (unstable_isUnrecognizedActionError(e)) {
    reportOutdatedPage();
    showToast("The system was updated while this page was open, so this didn't save. Refresh the page, then do it again.", "error");
    return;
  }
  showToast("Couldn't save: check the connection and try again. Nothing was changed.", "error");
}

// Everything about a customer that the form can correct, so an edit from here
// never blanks a detail the invoice screen didn't happen to show.
export type EditorCustomer = CustomerFormData;
export interface EditorStaff { id: string; name: string }



export function CollectPaymentModal({
  sale,
  canCancel = false,
  onClose,
  onDone,
}: {
  sale: SaleView;
  // Owners and managers can let the customer off the rest.
  canCancel?: boolean;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const { showToast } = useApp();
  // "Won't pay the rest": asked once more before anything is written off.
  const [cancelling, setCancelling] = useState<"ask" | "saving" | null>(null);
  const cancelRest = async () => {
    setCancelling("saving");
    try {
      const res = await cancelBalance(sale.id);
      if (!res.ok) { showToast(res.error, "error"); setCancelling("ask"); return; }
      onDone(`${formatCurrency(res.amount)} balance cancelled — ${sale.invoiceNo} is settled`);
    } catch (e) {
      saveFailed(e, showToast);
      setCancelling("ask");
    }
  };
  const [amount, setAmount] = useState(sale.balance);
  const [method, setMethod] = useState(primaryMethod(sale) || "Cash");
  const [note, setNote] = useState("");
  // When the money was actually taken — now, unless it's being written up later.
  const [takenAt, setTakenAt] = useState(() => toLocalInput(new Date()));
  const [saving, setSaving] = useState(false);
  // Staff can type either figure: what the customer is paying, or what they'll
  // still owe after it (paying Rs.1,500 of Rs.1,800 leaves Rs.300).
  const [remainingEditable, setRemainingEditable] = useState(false);

  // Advance this customer has already paid in: the balance can come out of it.
  const [creditHeld, setCreditHeld] = useState(0);
  useEffect(() => {
    if (!sale.customerId) return;
    let stale = false;
    customerCreditHeld(sale.customerId).then((held) => { if (!stale) setCreditHeld(held); }).catch(() => {});
    return () => { stale = true; };
  }, [sale.customerId]);
  const fromCredit = method === CREDIT_METHOD;
  // From the advance, it can't be more than what's held.
  const most = fromCredit ? Math.min(sale.balance, creditHeld) : sale.balance;

  const remaining = Math.max(0, sale.balance - (amount || 0));
  const setRemaining = (left: number) => setAmount(Math.max(0, Math.min(most, sale.balance - Math.max(0, left))));
  const takenAtDate = new Date(takenAt);
  const dateProblem =
    !takenAt || Number.isNaN(takenAtDate.getTime()) ? "Enter the date and time"
    : takenAtDate.getTime() > Date.now() + 60_000 ? "That's in the future"
    : takenAtDate.getTime() < new Date(sale.dateTime).getTime() - 60_000 ? "That's before the invoice was made"
    : "";

  const submit = async () => {
    setSaving(true);
    try {
      const res = await collectSalePayment({ saleId: sale.id, amount, method, note, date: takenAtDate.toISOString() });
      if (!res.ok) {
        showToast(res.error, "error");
        return;
      }
      onDone(
        res.balance > 0
          ? `${formatCurrency(amount)} received — ${formatCurrency(res.balance)} still owed`
          : `${sale.invoiceNo} is now paid in full`
      );
    } catch (e) {
      saveFailed(e, showToast);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="glass-modal solid-sheet p-6 w-full max-w-md animate-rise max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Wallet className="w-4 h-4 text-primary" /> Receive payment
          </h3>
          <button onClick={onClose} className="cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        <div className="rounded-xl bg-surface p-3 mb-4 text-xs space-y-1">
          <div className="flex justify-between"><span className="text-muted-foreground">Invoice</span><span className="font-medium">{sale.invoiceNo}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Customer</span><span className="font-medium">{sale.customerName}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Total</span><span>{formatCurrency(sale.total)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Already paid</span><span>{formatCurrency(sale.paid)}</span></div>
          <div className="flex justify-between font-semibold"><span>Balance</span><span className="text-destructive">{formatCurrency(sale.balance)}</span></div>
        </div>

        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Amount received</label>
        <div className="flex gap-2">
          <input
            type="number" value={amount || ""} autoFocus
            onChange={(e) => setAmount(Math.max(0, Math.min(most, Number(e.target.value))))}
            className="flex-1 px-3 py-2.5 glass-input text-sm"
          />
          <button
            onClick={() => setAmount(sale.balance)}
            className="px-3 py-2.5 rounded-xl bg-surface hover:bg-surface-hover text-xs font-medium whitespace-nowrap"
          >
            Full balance
          </button>
        </div>
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-muted-foreground">Remaining balance</label>
            <button
              onClick={() => setRemainingEditable(!remainingEditable)}
              className="text-[11px] text-primary font-medium hover:underline cursor-pointer"
            >
              {remainingEditable ? "Done" : "Edit"}
            </button>
          </div>
          {remainingEditable ? (
            <input
              type="number" min={0} max={sale.balance} placeholder="0"
              value={remaining || ""}
              onChange={(e) => setRemaining(Number(e.target.value) || 0)}
              className="w-full px-3 py-2 glass-input text-sm"
            />
          ) : (
            <div className="p-3 bg-surface rounded-xl flex justify-between items-center">
              <span className={`text-sm font-medium ${remaining > 0 ? "text-destructive" : "text-success"}`}>{formatCurrency(remaining)}</span>
              <span className="text-[11px] text-muted-foreground">
                {remaining > 0 ? "still owed after this payment" : "paid in full after this"}
              </span>
            </div>
          )}
        </div>

        <label className="text-xs font-medium text-muted-foreground mb-1.5 block mt-3">Paid by</label>
        <div className="grid grid-cols-4 gap-1.5">
          {PAYMENT_METHODS.map((m) => (
            <button
              key={m} onClick={() => setMethod(m)}
              className={`py-2 rounded-xl text-[11px] font-medium transition-all ${method === m ? "bg-primary text-white" : "bg-surface hover:bg-surface-hover"}`}
            >
              {m}
            </button>
          ))}
        </div>
        {creditHeld > 0 && (
          <button
            onClick={() => { setMethod(CREDIT_METHOD); setAmount((a) => Math.min(a || sale.balance, sale.balance, creditHeld)); }}
            className={`w-full mt-1.5 py-2 rounded-xl text-[11px] font-medium transition-all cursor-pointer ${fromCredit ? "bg-success text-white" : "bg-success/10 text-success hover:bg-success/15"}`}
          >
            {`From their advance — ${formatCurrency(creditHeld)} held`}
          </button>
        )}
        {fromCredit && (
          <p className="text-[10px] text-muted-foreground mt-1">
            {`No money changes hands today: it comes out of what they already paid in. ${formatCurrency(Math.max(0, creditHeld - (amount || 0)))} of advance will be left.`}
          </p>
        )}

        <label className="text-xs font-medium text-muted-foreground mb-1.5 block mt-3">Received on</label>
        <div className="flex gap-2">
          <input
            type="datetime-local" value={takenAt} onChange={(e) => setTakenAt(e.target.value)}
            min={toLocalInput(new Date(sale.dateTime))} max={toLocalInput(new Date())}
            className="flex-1 px-3 py-2.5 glass-input text-sm"
          />
          <button onClick={() => setTakenAt(toLocalInput(new Date()))}
            className="px-3 py-2.5 rounded-xl bg-surface hover:bg-surface-hover text-xs font-medium whitespace-nowrap">
            Now
          </button>
        </div>
        {dateProblem && <p className="text-[11px] text-destructive mt-1.5">{dateProblem}</p>}

        <label className="text-xs font-medium text-muted-foreground mb-1.5 block mt-3">Note (optional)</label>
        <input
          type="text" value={note} onChange={(e) => setNote(e.target.value)}
          placeholder="Cheque no., who collected it..." className="w-full px-3 py-2.5 glass-input text-sm"
        />

        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 glass-card text-sm font-medium cursor-pointer">Cancel</button>
          <button
            onClick={submit} disabled={saving || !(amount > 0) || !!dateProblem}
            className="flex-1 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-hover transition-colors disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Receive {amount > 0 ? formatCurrency(amount) : ""}
          </button>
        </div>

        {canCancel && (
          cancelling ? (
            <div className="mt-4 p-3 rounded-xl border border-destructive/30 bg-destructive/5 text-xs space-y-2">
              <p>
                {`Cancel the ${formatCurrency(sale.balance)} still owed? The customer won't be asked for it again. It comes off ${sale.invoiceNo} as a discount, so the invoice total drops to ${formatCurrency(sale.total - sale.balance)}. You can put it back from the invoice later.`}
              </p>
              <div className="flex gap-2">
                <button onClick={() => setCancelling(null)} disabled={cancelling === "saving"}
                  className="flex-1 py-2 rounded-lg bg-surface hover:bg-surface-hover font-medium cursor-pointer">
                  Keep it owed
                </button>
                <button onClick={cancelRest} disabled={cancelling === "saving"}
                  className="flex-1 py-2 rounded-lg bg-destructive text-white font-semibold hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-1.5 cursor-pointer">
                  {cancelling === "saving" && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {`Cancel ${formatCurrency(sale.balance)}`}
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setCancelling("ask")}
              className="w-full mt-3 text-[11px] text-destructive font-medium hover:underline cursor-pointer">
              {`Customer won't pay the rest? Cancel the ${formatCurrency(sale.balance)} balance`}
            </button>
          )
        )}
      </div>
    </div>
  );
}

interface EditLine {
  key: string;
  // The invoice line this already is (left out for one added here).
  saleItemId?: string;
  // Units returned against it: the line stays, with at least this many.
  returned: number;
  productId: string;
  name: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
}

export function EditInvoiceModal({
  sale,
  customers,
  staff,
  canBackdate,
  onClose,
  onDone,
}: {
  sale: SaleView;
  customers: EditorCustomer[];
  staff: EditorStaff[];
  canBackdate: boolean;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const { showToast } = useApp();
  const [lines, setLines] = useState<EditLine[]>(
    sale.items.map((it) => ({
      key: it.id,
      saleItemId: it.id,
      returned: it.returnedQuantity,
      productId: it.productId,
      name: it.productName,
      description: it.description,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      discount: it.discount,
    }))
  );
  const [invoiceDiscount, setInvoiceDiscount] = useState(sale.discount);
  const [customLensName, setCustomLensName] = useState(sale.customLensName);
  const [customLensPrice, setCustomLensPrice] = useState(sale.customLensPrice);
  const [customLensQty, setCustomLensQty] = useState(sale.customLensQty || 1);
  const [lensColorChoice, setLensColorChoice] = useState(
    !sale.lensColor ? "" : (LENS_COLORS as readonly string[]).includes(sale.lensColor) ? sale.lensColor : "Other"
  );
  const [lensColorOther, setLensColorOther] = useState(
    sale.lensColor && !(LENS_COLORS as readonly string[]).includes(sale.lensColor) ? sale.lensColor : ""
  );
  const [lensDescription, setLensDescription] = useState(sale.lensDescription);
  const [labCharges, setLabCharges] = useState(sale.labCharges);
  const [fittingCharges, setFittingCharges] = useState(sale.fittingCharges);
  const [saving, setSaving] = useState(false);

  // The invoice's own details, all correctable.
  const [billDate, setBillDate] = useState(() => toLocalInput(new Date(sale.dateTime)));
  const [customerId, setCustomerId] = useState(sale.customerId);
  const [customerSearch, setCustomerSearch] = useState("");
  const [paymentMethod, setPaymentMethod] = useState(sale.paymentSplit.length ? SPLIT_METHOD : sale.paymentMethod);
  const [splitAmounts, setSplitAmounts] = useState<SplitAmounts>(
    () => Object.fromEntries(sale.paymentSplit.map((p) => [p.method, p.amount]))
  );
  const isSplit = paymentMethod === SPLIT_METHOD;
  const [orderTakenBy, setOrderTakenBy] = useState(staff.find((m) => m.name === sale.createdByName)?.id ?? "");
  const [billedBy, setBilledBy] = useState(staff.find((m) => m.name === sale.receivedByName)?.id ?? "");

  // A customer added or corrected from this invoice, before the page's own list catches up.
  const [changedCustomers, setChangedCustomers] = useState<Record<string, EditorCustomer>>({});
  const [customerForm, setCustomerForm] = useState<"new" | "edit" | null>(null);
  const allCustomers = (() => {
    const byId = new Map(customers.map((c) => [c.id, c]));
    for (const c of Object.values(changedCustomers)) byId.set(c.id, c);
    return [...byId.values()];
  })();
  const customerSaved = (c: SavedCustomer) => {
    // Someone already on file under that phone: just use the record we have.
    if (!c.existing) setChangedCustomers((prev) => ({ ...prev, [c.id]: c }));
    setCustomerId(c.id);
    setCustomerSearch("");
  };

  const customerFormStart = (() => {
    const typed = customerSearch.trim();
    const looksLikePhone = /^[+\d][\d\s-]{5,}$/.test(typed);
    return { name: looksLikePhone ? "" : typed, phone: looksLikePhone ? typed : "" };
  })();

  const customer = allCustomers.find((c) => c.id === customerId);
  const customerMatches = customerSearch.trim()
    ? allCustomers.filter((c) => matchesSearch(customerSearch, [c.name, c.phone, c.phone2, c.serialNumber])).slice(0, 5)
    : [];

  const [search, setSearch] = useState("");
  const [hits, setHits] = useState<ProductSearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const manualCounter = useRef(0);

  useEffect(() => {
    const q = search.trim();
    if (q.length < 2) {
      setHits([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(() => {
      searchProductsForSale(q)
        .then((res) => !cancelled && setHits(res))
        .catch(() => {})
        .finally(() => !cancelled && setSearching(false));
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search]);

  const setLine = (key: string, patch: Partial<EditLine>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const addProduct = (hit: ProductSearchHit) => {
    setLines((prev) => [
      ...prev,
      { key: `new-${hit.id}-${Date.now()}`, returned: 0, productId: hit.id, name: hit.label, description: "", quantity: 1, unitPrice: hit.salePrice, discount: 0 },
    ]);
    setSearch("");
    setHits([]);
  };

  const addManualLine = () => {
    manualCounter.current += 1;
    setLines((prev) => [
      ...prev,
      { key: `manual-${manualCounter.current}-${Date.now()}`, returned: 0, productId: "", name: "", description: "", quantity: 1, unitPrice: 0, discount: 0 },
    ]);
  };

  // Money taken later (an advance settled) isn't touched here; what was taken
  // at the counter can be corrected along with the rest of the invoice.
  const laterPaid = sale.payments.reduce((sum, p) => sum + p.amount, 0);
  const [paidAtTill, setPaidAtTill] = useState(Math.max(0, sale.paid - laterPaid));
  // An invoice paid in full stays paid in full while it's edited: the till
  // amount follows the new total, so a discount simply lowers what was paid.
  // Typing an amount of your own (a customer paying less) takes over from that.
  const [tillFollowsTotal, setTillFollowsTotal] = useState(sale.balance <= 0 && sale.paymentSplit.length === 0);
  // Whatever's left owed after the edit, let off instead of chased.
  const [cancelRest, setCancelRest] = useState(false);

  const lensColor = lensColorChoice === "Other" ? lensColorOther.trim() : lensColorChoice;
  const itemsTotal = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity - l.discount, 0);
  const subtotal = itemsTotal + Math.max(0, customLensPrice) * customLensQty;
  const total = Math.max(0, subtotal - invoiceDiscount);
  const fullAtTill = Math.max(0, total - laterPaid);
  // Split across methods: what the till took is the parts added up.
  const tillAmount = isSplit ? splitAmountsTotal(splitAmounts) : tillFollowsTotal ? fullAtTill : paidAtTill;
  const paid = tillAmount + laterPaid;
  const newBalance = total - paid;
  const overPaid = paid > total + 0.01;

  const submit = async () => {
    if (lines.some((l) => !l.productId && !l.name.trim())) {
      showToast("Give every typed-in item a name", "error");
      return;
    }
    const payment = isSplit
      ? paymentFromParts(Object.entries(splitAmounts).map(([method, amount]) => ({ method, amount })), "Cash")
      : { paymentMethod, paymentSplit: [] };
    // A cleared or half-typed date used to throw here, leaving Save spinning for ever.
    if (canBackdate && Number.isNaN(new Date(billDate).getTime())) {
      showToast("Check the bill date and time", "error");
      return;
    }
    if (![invoiceDiscount, customLensPrice, customLensQty, labCharges, fittingCharges, tillAmount].every((n) => Number.isFinite(n))) {
      showToast("One of the amounts isn't a number — check the prices, discount and amount taken at the till", "error");
      return;
    }
    setSaving(true);
    let res: Awaited<ReturnType<typeof updateSale>>;
    try {
      res = await updateSale({
      saleId: sale.id,
      date: canBackdate ? new Date(billDate).toISOString() : undefined,
      customerId: customerId || null,
      paymentMethod: payment.paymentMethod,
      paymentSplit: payment.paymentSplit,
      createdById: orderTakenBy || undefined,
      receivedById: billedBy || undefined,
      items: lines.map((l) =>
        l.productId
          ? { id: l.saleItemId, productId: l.productId, description: l.description, quantity: l.quantity, unitPrice: l.unitPrice, discount: l.discount }
          : { id: l.saleItemId, name: l.name.trim(), description: l.description, quantity: l.quantity, unitPrice: l.unitPrice, discount: l.discount }
      ),
      invoiceDiscount,
      paidAtTill: tillAmount,
      // Keep the catalogue lens tied to the invoice only while its line is still on it.
      lensProductId: lines.some((l) => l.productId === sale.lensProductId) ? sale.lensProductId : undefined,
      customLensName,
      customLensPrice,
      customLensQty,
      lensColor,
      lensDescription,
      labCharges,
      fittingCharges,
      });
    } catch (e) {
      saveFailed(e, showToast);
      return;
    } finally {
      setSaving(false);
    }
    if (!res.ok) {
      showToast(res.error, "error");
      return;
    }
    if (cancelRest && res.balance > 0) {
      try {
        const cancelled = await cancelBalance(sale.id);
        if (!cancelled.ok) {
          showToast(`Invoice saved, but the balance wasn't cancelled: ${cancelled.error}`, "error");
          onDone(`${sale.invoiceNo} updated — ${formatCurrency(res.balance)} now owed`);
          return;
        }
        onDone(`${sale.invoiceNo} updated — ${formatCurrency(cancelled.amount)} balance cancelled, settled`);
      } catch {
        showToast("Invoice saved, but the balance wasn't cancelled. Open the invoice's wallet to cancel it.", "error");
        onDone(`${sale.invoiceNo} updated — ${formatCurrency(res.balance)} now owed`);
      }
      return;
    }
    onDone(
      res.balance > 0
        ? `${sale.invoiceNo} updated — ${formatCurrency(res.balance)} now owed`
        : `${sale.invoiceNo} updated — paid in full`
    );
  };

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="glass-modal solid-sheet p-6 w-full max-w-2xl animate-rise max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Pencil className="w-4 h-4 text-primary" /> Edit {sale.invoiceNo}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Stock moves by the difference only. Payments received after the sale stay as they are; what was taken at the till can be changed below.
            </p>
          </div>
          <button onClick={onClose} className="cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-3 rounded-xl border border-border space-y-2 mb-3">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Invoice details</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-muted-foreground block mb-1 flex items-center gap-1">
                <CalendarClock className="w-3 h-3" /> Bill date &amp; time
              </label>
              <input type="datetime-local" value={billDate} max={toLocalInput(new Date())} disabled={!canBackdate}
                onChange={(e) => setBillDate(e.target.value)}
                className="w-full px-2.5 py-1.5 glass-input text-xs disabled:opacity-60" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground block mb-1">Payment method</label>
              <select value={paymentMethod}
                onChange={(e) => {
                  // Splitting what was one payment starts from that payment,
                  // so only the other method's share needs typing.
                  if (e.target.value === SPLIT_METHOD && !isSplit && !splitAmountsTotal(splitAmounts) && paidAtTill > 0) {
                    setSplitAmounts({ [paymentMethod]: paidAtTill });
                  }
                  setPaymentMethod(e.target.value);
                }}
                className="w-full px-2.5 py-1.5 glass-input text-xs">
                {paymentMethod === CREDIT_METHOD && <option value={CREDIT_METHOD}>From advance (nothing at the till)</option>}
                {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                <option value={SPLIT_METHOD}>Split (more than one)</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-[10px] text-muted-foreground block mb-1 flex items-center gap-1">
                <User className="w-3 h-3" /> Customer
              </label>
              {customerId ? (
                <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 bg-surface rounded-lg">
                  <span className="text-xs truncate">{customer?.name ?? sale.customerName}{customer?.phone ? ` · ${allNumbers(customer, " · ")}` : ""}</span>
                  <span className="flex items-center gap-1.5 flex-shrink-0">
                    {customer && (
                      <button onClick={() => setCustomerForm("edit")} title="Correct this customer's name, phone or other details"
                        className="cursor-pointer"><Pencil className="w-3.5 h-3.5 text-muted-foreground" /></button>
                    )}
                    <button onClick={() => { setCustomerId(""); setCustomerSearch(""); }} title="Make this a walk-in sale"
                      className="cursor-pointer"><X className="w-3.5 h-3.5" /></button>
                  </span>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <input type="text" value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)}
                    placeholder="Walk-in — search to attach a customer" className="w-full pl-9 pr-3 py-1.5 glass-input text-xs" />
                  {customerMatches.length > 0 && (
                    <div className="mt-1 glass rounded-lg p-1 max-h-32 overflow-y-auto">
                      {customerMatches.map((c) => (
                        <button key={c.id} onClick={() => { setCustomerId(c.id); setCustomerSearch(""); }}
                          className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-surface-hover text-xs cursor-pointer">
                          {c.name}{c.phone ? ` · ${allNumbers(c, " · ")}` : ""}
                        </button>
                      ))}
                    </div>
                  )}
                  <button type="button" onClick={() => setCustomerForm("new")}
                    className="mt-1.5 flex items-center gap-1 text-[11px] text-primary font-semibold cursor-pointer">
                    <Plus className="w-3 h-3" /> {customerSearch.trim() && customerMatches.length === 0 ? `Not on file — add ${customerSearch.trim()}` : "Add a new customer"}
                  </button>
                </div>
              )}
            </div>
            {staff.length > 0 && (
              <>
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-1">Order taken by</label>
                  <select value={orderTakenBy} onChange={(e) => setOrderTakenBy(e.target.value)}
                    className="w-full px-2.5 py-1.5 glass-input text-xs">
                    <option value="">—</option>
                    {staff.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-1">Bill generated by</label>
                  <select value={billedBy} onChange={(e) => setBilledBy(e.target.value)}
                    className="w-full px-2.5 py-1.5 glass-input text-xs">
                    <option value="">—</option>
                    {staff.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="space-y-2">
          {lines.map((line) => (
            <div key={line.key} className="p-3 rounded-xl bg-surface">
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  {line.productId ? (
                    <p className="text-xs font-medium truncate">{line.name}</p>
                  ) : (
                    <input
                      type="text" value={line.name} onChange={(e) => setLine(line.key, { name: e.target.value })}
                      placeholder="Item name" className="w-full px-2.5 py-1.5 glass-input text-xs"
                    />
                  )}
                  <input
                    type="text" value={line.description} onChange={(e) => setLine(line.key, { description: e.target.value })}
                    placeholder="Details printed under the item (optional)"
                    className="w-full mt-1.5 px-2.5 py-1.5 glass-input text-[11px]"
                  />
                </div>
                <button
                  onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                  disabled={line.returned > 0}
                  title={line.returned > 0 ? "Returned items stay on the invoice — undo the return to take this off" : "Remove this line"}
                  className="p-1.5 rounded-lg hover:bg-surface-hover cursor-pointer flex-shrink-0 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </button>
              </div>
              {line.returned > 0 && (
                <p className="text-[10px] text-warning mt-1.5">
                  {`${line.returned} returned — this line stays, with at least ${line.returned}.`}
                </p>
              )}
              <div className="grid grid-cols-4 gap-2 mt-2">
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-1">Qty</label>
                  <input type="number" min={Math.max(1, line.returned)} value={line.quantity}
                    onChange={(e) => setLine(line.key, { quantity: Math.max(1, line.returned, Number(e.target.value)) })}
                    className="w-full px-2 py-1.5 glass-input text-xs" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-1">Price</label>
                  <input type="number" min={0} value={line.unitPrice}
                    onChange={(e) => setLine(line.key, { unitPrice: Math.max(0, Number(e.target.value)) })}
                    className="w-full px-2 py-1.5 glass-input text-xs" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-1">Discount</label>
                  <input type="number" min={0} value={line.discount}
                    onChange={(e) => setLine(line.key, { discount: Math.max(0, Number(e.target.value)) })}
                    className="w-full px-2 py-1.5 glass-input text-xs" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-1">Line total</label>
                  <p className="px-2 py-1.5 text-xs font-semibold">{formatCurrency(line.unitPrice * line.quantity - line.discount)}</p>
                </div>
              </div>
            </div>
          ))}
          {lines.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">
              No items left — add one below, or close without saving.
            </p>
          )}
        </div>

        <div className="mt-3">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-muted-foreground">Add an item</label>
            <button onClick={addManualLine} className="text-[11px] text-primary font-medium flex items-center gap-1 cursor-pointer">
              <Plus className="w-3 h-3" /> Item not in list
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products by name, brand or model..."
              className="w-full pl-9 pr-4 py-2 glass-input text-xs"
            />
            {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-muted-foreground" />}
            {hits.length > 0 && (
              <div className="mt-1 glass rounded-lg p-1 max-h-40 overflow-y-auto">
                {hits.map((hit) => (
                  <button
                    key={hit.id} onClick={() => addProduct(hit)}
                    className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-surface-hover text-xs flex items-center justify-between gap-2 cursor-pointer"
                  >
                    <span className="truncate">{hit.label} {hit.model && <span className="text-muted-foreground">· {hit.model}</span>}</span>
                    <span className="text-muted-foreground flex-shrink-0">{formatCurrency(hit.salePrice)} · {hit.stock} left</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 p-3 rounded-xl border border-border space-y-2">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Lens / job</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-muted-foreground block mb-1">Lens typed in (name)</label>
              <input type="text" value={customLensName} onChange={(e) => setCustomLensName(e.target.value)}
                placeholder="Only if the lens isn't a line above" className="w-full px-2.5 py-1.5 glass-input text-xs" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-muted-foreground block mb-1">Price per lens</label>
                <input type="number" min={0} value={customLensPrice || ""} onChange={(e) => setCustomLensPrice(Math.max(0, Number(e.target.value)))}
                  className="w-full px-2.5 py-1.5 glass-input text-xs" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground block mb-1">Qty</label>
                <input type="number" min={1} value={customLensQty} onChange={(e) => setCustomLensQty(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
                  className="w-full px-2.5 py-1.5 glass-input text-xs" />
              </div>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground block mb-1">Lens colour</label>
              <select value={lensColorChoice} onChange={(e) => setLensColorChoice(e.target.value)}
                className="w-full px-2.5 py-1.5 glass-input text-xs">
                <option value="">Not specified</option>
                {LENS_COLORS.map((c) => <option key={c} value={c}>{c}</option>)}
                <option value="Other">Other — type it</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground block mb-1">
                {lensColorChoice === "Other" ? "Colour" : "Lens description"}
              </label>
              {lensColorChoice === "Other" ? (
                <input type="text" value={lensColorOther} onChange={(e) => setLensColorOther(e.target.value)}
                  placeholder="Type the colour" className="w-full px-2.5 py-1.5 glass-input text-xs" />
              ) : (
                <input type="text" value={lensDescription} onChange={(e) => setLensDescription(e.target.value)}
                  placeholder="Coating, index, brand..." className="w-full px-2.5 py-1.5 glass-input text-xs" />
              )}
            </div>
          </div>
          {lensColorChoice === "Other" && (
            <input type="text" value={lensDescription} onChange={(e) => setLensDescription(e.target.value)}
              placeholder="Lens description — coating, index, brand..." className="w-full px-2.5 py-1.5 glass-input text-xs" />
          )}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div>
              <label className="text-[10px] text-muted-foreground block mb-1">Lab charges (internal)</label>
              <input type="number" min={0} value={labCharges || ""} onChange={(e) => setLabCharges(Math.max(0, Number(e.target.value)))}
                className="w-full px-2.5 py-1.5 glass-input text-xs" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground block mb-1">Fitting charges (internal)</label>
              <input type="number" min={0} value={fittingCharges || ""} onChange={(e) => setFittingCharges(Math.max(0, Number(e.target.value)))}
                className="w-full px-2.5 py-1.5 glass-input text-xs" />
            </div>
          </div>
        </div>

        <div className="mt-4 p-3 rounded-xl bg-surface text-xs space-y-1">
          <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Invoice discount</span>
            <span className="flex items-center gap-1.5">
              <select value="" title="Pick a percentage and the amount is worked out for you"
                onChange={(e) => { const pct = Number(e.target.value); if (pct) setInvoiceDiscount(Math.round((subtotal * pct) / 100)); }}
                className="px-1.5 py-1 glass-input text-xs cursor-pointer">
                <option value="">%</option>
                {DISCOUNT_PERCENTAGES.map((pct) => <option key={pct} value={pct}>{pct}%</option>)}
              </select>
              <input type="number" min={0} value={invoiceDiscount || ""} placeholder="Rs." onChange={(e) => setInvoiceDiscount(Math.max(0, Number(e.target.value)))}
                className="w-28 px-2 py-1 glass-input text-xs text-right" />
            </span>
          </div>
          <div className="flex justify-between font-semibold text-sm border-t border-border pt-1.5 mt-1.5">
            <span>New total</span><span>{formatCurrency(total)}</span>
          </div>
          {isSplit ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Taken at the till (split)</span>
                <span>{formatCurrency(tillAmount)}</span>
              </div>
              <SplitPaymentFields
                amounts={splitAmounts}
                onChange={setSplitAmounts}
                target={null}
                total={Math.max(0, total - laterPaid)}
                label="Taken at the till"
              />
            </>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-1.5">
                Taken at the till
                {total > 0 && (
                  <button type="button" onClick={() => setTillFollowsTotal(true)}
                    className={`font-semibold cursor-pointer ${tillFollowsTotal ? "text-success" : "text-primary"}`}>
                    {tillFollowsTotal ? "Paid in full ✓" : "Paid in full"}
                  </button>
                )}
                <button type="button" onClick={() => { setTillFollowsTotal(false); setPaidAtTill(0); }} className="text-primary font-semibold cursor-pointer">Nothing</button>
              </span>
              <input type="number" min={0} value={(tillFollowsTotal ? fullAtTill : paidAtTill) || ""}
                onChange={(e) => { setTillFollowsTotal(false); setPaidAtTill(Math.max(0, Number(e.target.value))); }}
                className="w-28 px-2 py-1 glass-input text-xs text-right" />
            </div>
          )}
          {laterPaid > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">+ Paid later ({sale.payments.length})</span><span>{formatCurrency(laterPaid)}</span>
            </div>
          )}
          <div className="flex justify-between font-semibold">
            <span>{newBalance > 0 ? "Balance owed" : "Balance"}</span>
            <span className={newBalance > 0 ? "text-destructive" : "text-success"}>
              {formatCurrency(Math.max(0, newBalance))}
            </span>
          </div>
        </div>

        {tillAmount < sale.paid - laterPaid && (
          <div className="mt-3 p-3 rounded-xl bg-warning/10 text-warning text-xs flex gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p>
              {`The till took ${formatCurrency(sale.paid - laterPaid)} on this invoice — saving records ${formatCurrency(tillAmount)} instead, so the day's takings change. Hand back ${formatCurrency(sale.paid - laterPaid - tillAmount)} if the customer has already paid it.`}
            </p>
          </div>
        )}
        {/* The customer paying less than the bill: what they won't pay can be let off here. */}
        {newBalance > 0.009 && !overPaid && (
          <label className="mt-3 flex items-start gap-2 p-3 rounded-xl border border-border text-xs cursor-pointer">
            <input type="checkbox" checked={cancelRest} onChange={(e) => setCancelRest(e.target.checked)} className="rounded mt-0.5" />
            <span>
              <span className="font-semibold">{`Customer won't pay the ${formatCurrency(newBalance)} — cancel it`}</span>
              <span className="block text-muted-foreground">
                Leave unticked to keep it owed. Ticked, it comes off as a discount and the invoice is settled; it shows as
                &quot;Balance cancelled&quot; and can be undone from the invoice.
              </span>
            </span>
          </label>
        )}
        {overPaid && (
          <div className="mt-3 p-3 rounded-xl bg-destructive/10 text-destructive text-xs flex gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p>
              {`${formatCurrency(paid)} paid is more than the ${formatCurrency(total)} total — lower the amount taken at the till.`}
            </p>
          </div>
        )}

        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 glass-card text-sm font-medium cursor-pointer">Cancel</button>
          <button
            onClick={submit} disabled={saving || overPaid || lines.length === 0}
            className="flex-1 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-hover transition-colors disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} Save invoice
          </button>
        </div>
      </div>
    </div>

    {/* Beside the editor, not inside it: the editor's backdrop closes it on any click. */}
    {customerForm && (
      <CustomerFormModal
        customer={customerForm === "edit" ? customer ?? null : null}
        initial={customerForm === "new" ? customerFormStart : undefined}
        others={allCustomers}
        onClose={() => setCustomerForm(null)}
        onSaved={customerSaved}
      />
    )}
    </>
  );
}

/** Correct or remove one payment already taken against an invoice. */
export function EditPaymentModal({
  sale,
  payment,
  onClose,
  onDone,
}: {
  sale: SaleView;
  payment: SaleView["payments"][number];
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const { showToast } = useApp();
  const [amount, setAmount] = useState(payment.amount);
  const [method, setMethod] = useState(payment.method);
  const [note, setNote] = useState(payment.note);
  const [takenAt, setTakenAt] = useState(() => toLocalInput(new Date(payment.date)));
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  // The customer's advance: a payment can be moved onto it, or off it (back to
  // cash, card...). What this payment already took from it counts as available.
  const [creditHeld, setCreditHeld] = useState(0);
  const [creditKnown, setCreditKnown] = useState(!sale.customerId);
  useEffect(() => {
    if (!sale.customerId) return;
    let stale = false;
    customerCreditHeld(sale.customerId)
      .then((held) => { if (!stale) { setCreditHeld(held); setCreditKnown(true); } })
      .catch(() => {});
    return () => { stale = true; };
  }, [sale.customerId]);
  const wasCredit = payment.method === CREDIT_METHOD;
  const creditAvailable = creditHeld + (wasCredit ? payment.amount : 0);
  const fromCredit = method === CREDIT_METHOD;

  const takenAtDate = new Date(takenAt);
  const otherPayments = sale.paid - payment.amount;
  const problem =
    !(amount > 0) ? "Enter the amount received"
    : Number.isNaN(takenAtDate.getTime()) ? "Enter the date and time"
    : takenAtDate.getTime() > Date.now() + 60_000 ? "That's in the future"
    : takenAtDate.getTime() < new Date(sale.dateTime).getTime() - 60_000 ? "That's before the invoice was made"
    : otherPayments + amount > sale.total + 0.01 ? `That takes the payments past the ${formatCurrency(sale.total)} total`
    : fromCredit && creditKnown && amount > creditAvailable + 0.01 ? `Only ${formatCurrency(creditAvailable)} of advance is held for this customer`
    : "";

  const submit = async (remove = false) => {
    remove ? setRemoving(true) : setSaving(true);
    try {
      const res = await updateSalePayment({
        paymentId: payment.id,
        ...(remove ? { remove: true } : { amount, method, note, date: takenAtDate.toISOString() }),
      });
      if (!res.ok) {
        showToast(res.error, "error");
        return;
      }
      onDone(
        remove
          ? `Payment moved to the Trash — ${res.balance > 0 ? `${formatCurrency(res.balance)} now owed` : "paid in full"}. Restore it from there if that was a mistake.`
          : `Payment updated — ${res.balance > 0 ? `${formatCurrency(res.balance)} still owed` : "paid in full"}`
      );
    } catch (e) {
      saveFailed(e, showToast);
    } finally {
      setSaving(false);
      setRemoving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="glass-modal solid-sheet p-6 w-full max-w-md animate-rise" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Pencil className="w-4 h-4 text-primary" /> Correct payment
          </h3>
          <button onClick={onClose} className="cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        <p className="text-xs text-muted-foreground mb-3">
          {`On ${sale.invoiceNo} · invoice total ${formatCurrency(sale.total)}`}
        </p>

        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Amount received</label>
        <input type="number" value={amount || ""} autoFocus onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))}
          className="w-full px-3 py-2.5 glass-input text-sm" />

        <label className="text-xs font-medium text-muted-foreground mb-1.5 block mt-3">Paid by</label>
        <div className="grid grid-cols-4 gap-1.5">
          {PAYMENT_METHODS.map((m) => (
            <button key={m} onClick={() => setMethod(m)}
              className={`py-2 rounded-xl text-[11px] font-medium transition-all cursor-pointer ${method === m ? "bg-primary text-white" : "bg-surface hover:bg-surface-hover"}`}>
              {m}
            </button>
          ))}
        </div>
        {(creditAvailable > 0 || wasCredit) && (
          <button onClick={() => setMethod(CREDIT_METHOD)}
            className={`w-full mt-1.5 py-2 rounded-xl text-[11px] font-medium transition-all cursor-pointer ${fromCredit ? "bg-success text-white" : "bg-success/10 text-success hover:bg-success/15"}`}>
            {`From their advance — ${formatCurrency(creditAvailable)} available`}
          </button>
        )}
        {fromCredit ? (
          <p className="text-[10px] text-muted-foreground mt-1">
            Comes out of the advance they paid in, so no money changes hands. If they actually paid cash or card, pick that instead and the advance gets it back.
          </p>
        ) : wasCredit ? (
          <p className="text-[10px] text-muted-foreground mt-1">
            {`This was paid from their advance. Saving it as ${method} puts ${formatCurrency(payment.amount)} back onto the advance and counts the money as ${method} on the day above.`}
          </p>
        ) : null}

        <label className="text-xs font-medium text-muted-foreground mb-1.5 block mt-3">Received on</label>
        <input type="datetime-local" value={takenAt} onChange={(e) => setTakenAt(e.target.value)}
          min={toLocalInput(new Date(sale.dateTime))} max={toLocalInput(new Date())}
          className="w-full px-3 py-2.5 glass-input text-sm" />

        <label className="text-xs font-medium text-muted-foreground mb-1.5 block mt-3">Note (optional)</label>
        <input type="text" value={note} onChange={(e) => setNote(e.target.value)}
          placeholder="Cheque no., who collected it..." className="w-full px-3 py-2.5 glass-input text-sm" />

        {problem && <p className="text-[11px] text-destructive mt-2">{problem}</p>}

        <div className="flex gap-2 mt-5">
          <button onClick={() => submit(true)} disabled={saving || removing}
            className="py-2.5 px-4 rounded-xl text-sm font-medium text-destructive bg-destructive/10 hover:bg-destructive/15 transition-colors disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer">
            {removing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Remove
          </button>
          <button onClick={() => submit()} disabled={saving || removing || !!problem}
            className="flex-1 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-hover transition-colors disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} Save changes
          </button>
        </div>
      </div>
    </div>
  );
}

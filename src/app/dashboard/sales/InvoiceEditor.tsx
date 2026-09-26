"use client";

import { useEffect, useRef, useState } from "react";
import type { SaleView } from "@/lib/data";
import { formatCurrency, toLocalInput } from "@/lib/utils/format";
import { useApp } from "@/lib/context";
import { collectSalePayment, updateSale, updateSalePayment } from "@/lib/actions/sales";
import { searchProductsForSale, type ProductSearchHit } from "@/lib/actions/products";
import { LENS_COLORS, PAYMENT_METHODS } from "@/lib/constants";
import { Loader2, Plus, Search, Trash2, Wallet, X, Pencil, AlertTriangle, CalendarClock, User } from "lucide-react";
import { SPLIT_METHOD, paymentFromParts, primaryMethod } from "@/lib/sales/paymentSplit";
import { SplitPaymentFields, splitAmountsTotal, type SplitAmounts } from "@/components/invoice/SplitPaymentFields";

export interface EditorCustomer { id: string; name: string; phone: string }
export interface EditorStaff { id: string; name: string }



export function CollectPaymentModal({
  sale,
  onClose,
  onDone,
}: {
  sale: SaleView;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const { showToast } = useApp();
  const [amount, setAmount] = useState(sale.balance);
  const [method, setMethod] = useState(primaryMethod(sale) || "Cash");
  const [note, setNote] = useState("");
  // When the money was actually taken — now, unless it's being written up later.
  const [takenAt, setTakenAt] = useState(() => toLocalInput(new Date()));
  const [saving, setSaving] = useState(false);

  const remaining = Math.max(0, sale.balance - (amount || 0));
  const takenAtDate = new Date(takenAt);
  const dateProblem =
    !takenAt || Number.isNaN(takenAtDate.getTime()) ? "Enter the date and time"
    : takenAtDate.getTime() > Date.now() + 60_000 ? "That's in the future"
    : takenAtDate.getTime() < new Date(sale.dateTime).getTime() - 60_000 ? "That's before the invoice was made"
    : "";

  const submit = async () => {
    setSaving(true);
    const res = await collectSalePayment({ saleId: sale.id, amount, method, note, date: takenAtDate.toISOString() });
    setSaving(false);
    if (!res.ok) {
      showToast(res.error, "error");
      return;
    }
    onDone(
      res.balance > 0
        ? `${formatCurrency(amount)} received — ${formatCurrency(res.balance)} still owed`
        : `${sale.invoiceNo} is now paid in full`
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="glass-modal p-6 w-full max-w-md animate-rise" onClick={(e) => e.stopPropagation()}>
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
            onChange={(e) => setAmount(Math.max(0, Math.min(sale.balance, Number(e.target.value))))}
            className="flex-1 px-3 py-2.5 glass-input text-sm"
          />
          <button
            onClick={() => setAmount(sale.balance)}
            className="px-3 py-2.5 rounded-xl bg-surface hover:bg-surface-hover text-xs font-medium whitespace-nowrap"
          >
            Full balance
          </button>
        </div>
        {amount > 0 && remaining > 0 && (
          <p className="text-[11px] text-muted-foreground mt-1.5">{formatCurrency(remaining)} will still be owed after this.</p>
        )}

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

  const customer = customers.find((c) => c.id === customerId);
  const customerMatches = customerSearch.trim()
    ? customers.filter((c) => {
        const q = customerSearch.trim().toLowerCase();
        return c.name.toLowerCase().includes(q) || c.phone.replace(/[^0-9]/g, "").includes(q.replace(/[^0-9]/g, ""));
      }).slice(0, 5)
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

  const lensColor = lensColorChoice === "Other" ? lensColorOther.trim() : lensColorChoice;
  const itemsTotal = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity - l.discount, 0);
  const subtotal = itemsTotal + Math.max(0, customLensPrice) * customLensQty;
  const total = Math.max(0, subtotal - invoiceDiscount);
  // Split across methods: what the till took is the parts added up.
  const tillAmount = isSplit ? splitAmountsTotal(splitAmounts) : paidAtTill;
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
    setSaving(true);
    const res = await updateSale({
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
    setSaving(false);
    if (!res.ok) {
      showToast(res.error, "error");
      return;
    }
    onDone(
      res.balance > 0
        ? `${sale.invoiceNo} updated — ${formatCurrency(res.balance)} now owed`
        : `${sale.invoiceNo} updated — paid in full`
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="glass-modal p-6 w-full max-w-2xl animate-rise max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Pencil className="w-4 h-4 text-primary" /> Edit {sale.invoiceNo}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Stock moves by the difference only. {formatCurrency(sale.paid)} already paid stays on the invoice.
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
                  <span className="text-xs truncate">{customer?.name ?? sale.customerName}{customer?.phone ? ` · ${customer.phone}` : ""}</span>
                  <button onClick={() => { setCustomerId(""); setCustomerSearch(""); }} title="Make this a walk-in sale"
                    className="cursor-pointer flex-shrink-0"><X className="w-3.5 h-3.5" /></button>
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
                          {c.name}{c.phone ? ` · ${c.phone}` : ""}
                        </button>
                      ))}
                    </div>
                  )}
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
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Invoice discount</span>
            <input type="number" min={0} value={invoiceDiscount || ""} onChange={(e) => setInvoiceDiscount(Math.max(0, Number(e.target.value)))}
              className="w-28 px-2 py-1 glass-input text-xs text-right" />
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
                  <button type="button" onClick={() => setPaidAtTill(Math.max(0, total - laterPaid))}
                    className="text-primary font-semibold cursor-pointer">Paid in full</button>
                )}
                <button type="button" onClick={() => setPaidAtTill(0)} className="text-primary font-semibold cursor-pointer">Nothing</button>
              </span>
              <input type="number" min={0} value={paidAtTill || ""} onChange={(e) => setPaidAtTill(Math.max(0, Number(e.target.value)))}
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

  const takenAtDate = new Date(takenAt);
  const otherPayments = sale.paid - payment.amount;
  const problem =
    !(amount > 0) ? "Enter the amount received"
    : Number.isNaN(takenAtDate.getTime()) ? "Enter the date and time"
    : takenAtDate.getTime() > Date.now() + 60_000 ? "That's in the future"
    : takenAtDate.getTime() < new Date(sale.dateTime).getTime() - 60_000 ? "That's before the invoice was made"
    : otherPayments + amount > sale.total + 0.01 ? `That takes the payments past the ${formatCurrency(sale.total)} total`
    : "";

  const submit = async (remove = false) => {
    remove ? setRemoving(true) : setSaving(true);
    const res = await updateSalePayment({
      paymentId: payment.id,
      ...(remove ? { remove: true } : { amount, method, note, date: takenAtDate.toISOString() }),
    });
    setSaving(false);
    setRemoving(false);
    if (!res.ok) {
      showToast(res.error, "error");
      return;
    }
    onDone(
      remove
        ? `Payment removed — ${res.balance > 0 ? `${formatCurrency(res.balance)} now owed` : "paid in full"}`
        : `Payment updated — ${res.balance > 0 ? `${formatCurrency(res.balance)} still owed` : "paid in full"}`
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="glass-modal p-6 w-full max-w-md animate-rise" onClick={(e) => e.stopPropagation()}>
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
              className={`py-2 rounded-xl text-[11px] font-medium transition-all ${method === m ? "bg-primary text-white" : "bg-surface hover:bg-surface-hover"}`}>
              {m}
            </button>
          ))}
        </div>

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

"use client";

import { useEffect, useRef, useState } from "react";
import type { SaleView } from "@/lib/data";
import { formatCurrency } from "@/lib/utils/format";
import { useApp } from "@/lib/context";
import { collectSalePayment, updateSale } from "@/lib/actions/sales";
import { searchProductsForSale, type ProductSearchHit } from "@/lib/actions/products";
import { LENS_COLORS, PAYMENT_METHODS } from "@/lib/constants";
import { Loader2, Plus, Search, Trash2, Wallet, X, Pencil, AlertTriangle } from "lucide-react";

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
  const [method, setMethod] = useState(sale.paymentMethod || "Cash");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const remaining = Math.max(0, sale.balance - (amount || 0));

  const submit = async () => {
    setSaving(true);
    const res = await collectSalePayment({ saleId: sale.id, amount, method, note });
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

        <label className="text-xs font-medium text-muted-foreground mb-1.5 block mt-3">Note (optional)</label>
        <input
          type="text" value={note} onChange={(e) => setNote(e.target.value)}
          placeholder="Cheque no., who collected it..." className="w-full px-3 py-2.5 glass-input text-sm"
        />

        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 glass-card text-sm font-medium cursor-pointer">Cancel</button>
          <button
            onClick={submit} disabled={saving || !(amount > 0)}
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
  productId: string;
  name: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
}

export function EditInvoiceModal({
  sale,
  onClose,
  onDone,
}: {
  sale: SaleView;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const { showToast } = useApp();
  const [lines, setLines] = useState<EditLine[]>(
    sale.items.map((it) => ({
      key: it.id,
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
      { key: `new-${hit.id}-${Date.now()}`, productId: hit.id, name: hit.label, description: "", quantity: 1, unitPrice: hit.salePrice, discount: 0 },
    ]);
    setSearch("");
    setHits([]);
  };

  const addManualLine = () => {
    manualCounter.current += 1;
    setLines((prev) => [
      ...prev,
      { key: `manual-${manualCounter.current}-${Date.now()}`, productId: "", name: "", description: "", quantity: 1, unitPrice: 0, discount: 0 },
    ]);
  };

  const lensColor = lensColorChoice === "Other" ? lensColorOther.trim() : lensColorChoice;
  const itemsTotal = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity - l.discount, 0);
  const subtotal = itemsTotal + Math.max(0, customLensPrice);
  const total = Math.max(0, subtotal - invoiceDiscount);
  const newBalance = total - sale.paid;
  const belowPaid = total < sale.paid;

  const submit = async () => {
    if (lines.some((l) => !l.productId && !l.name.trim())) {
      showToast("Give every typed-in item a name", "error");
      return;
    }
    setSaving(true);
    const res = await updateSale({
      saleId: sale.id,
      items: lines.map((l) =>
        l.productId
          ? { productId: l.productId, description: l.description, quantity: l.quantity, unitPrice: l.unitPrice, discount: l.discount }
          : { name: l.name.trim(), description: l.description, quantity: l.quantity, unitPrice: l.unitPrice, discount: l.discount }
      ),
      invoiceDiscount,
      // Keep the catalogue lens tied to the invoice only while its line is still on it.
      lensProductId: lines.some((l) => l.productId === sale.lensProductId) ? sale.lensProductId : undefined,
      customLensName,
      customLensPrice,
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
                  title="Remove this line" className="p-1.5 rounded-lg hover:bg-surface-hover cursor-pointer flex-shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </button>
              </div>
              <div className="grid grid-cols-4 gap-2 mt-2">
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-1">Qty</label>
                  <input type="number" min={1} value={line.quantity}
                    onChange={(e) => setLine(line.key, { quantity: Math.max(1, Number(e.target.value)) })}
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
            <div>
              <label className="text-[10px] text-muted-foreground block mb-1">Lens price</label>
              <input type="number" min={0} value={customLensPrice || ""} onChange={(e) => setCustomLensPrice(Math.max(0, Number(e.target.value)))}
                className="w-full px-2.5 py-1.5 glass-input text-xs" />
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
          <div className="flex justify-between"><span className="text-muted-foreground">Already paid</span><span>{formatCurrency(sale.paid)}</span></div>
          <div className="flex justify-between font-semibold">
            <span>{newBalance > 0 ? "Balance owed" : "Balance"}</span>
            <span className={newBalance > 0 ? "text-destructive" : "text-success"}>
              {formatCurrency(Math.max(0, newBalance))}
            </span>
          </div>
        </div>

        {belowPaid && (
          <div className="mt-3 p-3 rounded-xl bg-destructive/10 text-destructive text-xs flex gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p>
              {`The new total is less than the ${formatCurrency(sale.paid)} already paid. Money owed back to a customer goes through Return & Refund, so this can't be saved.`}
            </p>
          </div>
        )}

        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 glass-card text-sm font-medium cursor-pointer">Cancel</button>
          <button
            onClick={submit} disabled={saving || belowPaid || lines.length === 0}
            className="flex-1 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-hover transition-colors disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} Save invoice
          </button>
        </div>
      </div>
    </div>
  );
}

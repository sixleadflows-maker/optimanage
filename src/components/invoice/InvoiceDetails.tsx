"use client";

import Link from "next/link";
import type { SaleView } from "@/lib/data";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { formatEyeValue, rxLensLabel } from "@/lib/utils/rx";
import { paymentStatusChipClass } from "@/lib/constants";
import { Glasses, History, Pencil, Plus, Undo2, WifiOff } from "lucide-react";

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-PK", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

const RX_FIELDS = ["Sph", "Cyl", "Axis", "Add", "Pd"] as const;

type Rx = SaleView["prescriptions"][number];

/** One prescription as the optician wrote it: both eyes, every figure. */
function RxCard({ rx }: { rx: Rx }) {
  return (
    <div className="rounded-lg bg-surface p-2.5">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="min-w-0">
          <p className="font-medium">
            {formatDate(rx.date)}
            {rx.label && <span className="text-primary">{` · For ${rx.label}`}</span>}
          </p>
          {rx.isOwnPrescription && <span className="chip bg-warning/10 text-warning mt-0.5">Customer&apos;s own Rx</span>}
        </div>
        <Link href={`/dashboard/prescriptions?edit=${rx.id}`} title="Edit prescription"
          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-background/60 hover:bg-surface-hover font-medium flex-shrink-0">
          <Pencil className="w-3 h-3" /> Edit
        </Link>
      </div>
      <table className="w-full text-center tabular-nums">
        <thead>
          <tr className="text-[9px] text-muted-foreground">
            <th className="text-left font-medium py-0.5">Eye</th>
            {RX_FIELDS.map((f) => <th key={f} className="font-medium py-0.5">{f.toUpperCase()}</th>)}
          </tr>
        </thead>
        <tbody>
          {([["Right (OD)", rx.rightEye], ["Left (OS)", rx.leftEye]] as const).map(([eye, values]) => (
            <tr key={eye} className="border-t border-border/60">
              <td className="text-left py-1 text-muted-foreground whitespace-nowrap">{eye}</td>
              {RX_FIELDS.map((f) => <td key={f} className="py-1 font-medium">{formatEyeValue(f, values)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      {rxLensLabel(rx) && (
        <p className="mt-1.5 pt-1.5 border-t border-border/60">
          <span className="text-muted-foreground">Lens: </span>{rxLensLabel(rx)}
        </p>
      )}
      {rx.notes && (
        <p className={`mt-1.5 pt-1.5 border-t border-border/60 ${rx.notesHidden ? "italic text-muted-foreground/70" : "text-muted-foreground"}`}>
          {rx.notesHidden ? "Notes hidden" : `Notes: ${rx.notes}`}
        </p>
      )}
    </div>
  );
}

/**
 * Everything recorded about an invoice: what was bought (with the lens, its
 * colour and notes), what it came to, every payment and what's still owed, the
 * prescriptions taken with it, returns, and who dealt with it. Shown when an
 * invoice is opened on Sales & Invoices and under each visit in a customer's
 * history, so both read the same.
 */
export function InvoiceDetails({
  sale, canUndoReturn = false, onUndoReturn, canEditPayments = false, onEditPayment, onEditTill, onEditReturn, title = "Details",
}: {
  sale: SaleView;
  canUndoReturn?: boolean;
  onUndoReturn?: (ret: SaleView["returns"][number]) => void;
  canEditPayments?: boolean;
  onEditPayment?: (payment: SaleView["payments"][number]) => void;
  // What was taken at the till is part of the invoice itself: this opens its editor.
  onEditTill?: () => void;
  onEditReturn?: (ret: SaleView["returns"][number]) => void;
  title?: string;
}) {
  const laterTotal = sale.payments.reduce((sum, p) => sum + p.amount, 0);
  const takenAtTill = Math.max(0, Math.round((sale.paid - laterTotal) * 100) / 100);
  const tillParts = sale.paymentSplit.length ? sale.paymentSplit : takenAtTill > 0 ? [{ method: sale.paymentMethod, amount: takenAtTill }] : [];
  // An invoice keyed in well after its own date is an old record from paper.
  const enteredLater = new Date(sale.enteredAt).getTime() - new Date(sale.dateTime).getTime() > 60 * 60_000 && !sale.offlineRef;
  const lensNote = [sale.lensColor && `Colour: ${sale.lensColor}`, sale.lensDescription].filter(Boolean).join(" · ");
  const lensOnItems = !!sale.lensProductId && sale.items.some((i) => i.productId === sale.lensProductId);
  const customLensTotal = sale.customLensPrice * (sale.customLensQty || 1);
  const itemsSubtotal = sale.items.reduce((sum, i) => sum + i.quantity * i.unitPrice - i.discount, 0) + customLensTotal;

  return (
    <div className="rounded-xl border border-border p-3 text-xs space-y-3">
      <p className="font-semibold flex items-center gap-1.5"><History className="w-3.5 h-3.5 text-primary" /> {title}</p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5">
        <div><p className="text-[10px] text-muted-foreground">Date &amp; time</p><p className="font-medium">{when(sale.dateTime)}</p></div>
        <div><p className="text-[10px] text-muted-foreground">Order taken by</p><p className="font-medium">{sale.createdByName || "—"}</p></div>
        <div><p className="text-[10px] text-muted-foreground">Bill made by</p><p className="font-medium">{sale.receivedByName || "—"}</p></div>
        <div><p className="text-[10px] text-muted-foreground">Customer</p><p className="font-medium">{sale.customerName}{sale.customerPhone && <span className="text-muted-foreground font-normal">{` · ${sale.customerPhone}`}</span>}</p></div>
        <div><p className="text-[10px] text-muted-foreground">Paid by</p><p className="font-medium">{sale.paymentMethod || "—"}</p></div>
        <div>
          <p className="text-[10px] text-muted-foreground">Status</p>
          <span className={`chip ${paymentStatusChipClass(sale.paymentStatus)}`}>{sale.paymentStatus}</span>
        </div>
      </div>

      <div>
        <p className="text-muted-foreground mb-1">What they got</p>
        <div className="space-y-1.5">
          {sale.items.map((item) => {
            const isLens = !!sale.lensProductId && item.productId === sale.lensProductId;
            return (
              <div key={item.id} className="flex justify-between gap-3">
                <span className="min-w-0">
                  <span className="font-medium">{item.productName}</span>
                  {isLens && <span className="chip bg-primary/10 text-primary ml-1.5">Lens</span>}
                  {item.returnedQuantity > 0 && <span className="text-destructive text-[10px]">{` (returned ${item.returnedQuantity})`}</span>}
                  <span className="block text-muted-foreground">
                    {`${item.quantity} × ${formatCurrency(item.unitPrice)}${item.discount > 0 ? ` − ${formatCurrency(item.discount)} off` : ""}`}
                  </span>
                  {item.description && <span className="block text-muted-foreground">{item.description}</span>}
                  {isLens && lensNote && <span className="block text-muted-foreground">{lensNote}</span>}
                </span>
                <span className="font-medium flex-shrink-0">{formatCurrency(item.quantity * item.unitPrice - item.discount)}</span>
              </div>
            );
          })}
          {customLensTotal > 0 && (
            <div className="flex justify-between gap-3">
              <span className="min-w-0">
                <span className="font-medium">{sale.customLensName}</span>
                <span className="chip bg-primary/10 text-primary ml-1.5">Lens</span>
                <span className="block text-muted-foreground">{`${sale.customLensQty || 1} × ${formatCurrency(sale.customLensPrice)}`}</span>
                {lensNote && <span className="block text-muted-foreground">{lensNote}</span>}
              </span>
              <span className="font-medium flex-shrink-0">{formatCurrency(customLensTotal)}</span>
            </div>
          )}
          {!!sale.lensName && !lensOnItems && (
            <p className="text-muted-foreground">{`Lens used: ${sale.lensName}${lensNote ? ` · ${lensNote}` : ""}`}</p>
          )}

          <div className="border-t border-border pt-1.5 space-y-0.5">
            {(sale.discount > 0 || sale.deliveryFee > 0) && (
              <div className="flex justify-between gap-3 text-muted-foreground">
                <span>Subtotal</span><span>{formatCurrency(itemsSubtotal)}</span>
              </div>
            )}
            {sale.discount > 0 && (
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Invoice discount</span>
                <span className="text-destructive">-{formatCurrency(sale.discount)}</span>
              </div>
            )}
            {sale.deliveryFee > 0 && (
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Delivery</span><span>{formatCurrency(sale.deliveryFee)}</span>
              </div>
            )}
            <div className="flex justify-between gap-3 font-semibold">
              <span>Total</span><span>{formatCurrency(sale.total)}</span>
            </div>
          </div>
          {(sale.labCharges > 0 || sale.fittingCharges > 0) && (
            <div className="flex justify-between gap-3 text-muted-foreground">
              {sale.labCharges > 0 && <span>Lab charges: {formatCurrency(sale.labCharges)}</span>}
              {sale.fittingCharges > 0 && <span>Fitting charges: {formatCurrency(sale.fittingCharges)}</span>}
            </div>
          )}
        </div>
      </div>

      <div>
        <p className="text-muted-foreground mb-1">Payments</p>
        <div className="space-y-1">
          {tillParts.map((p) => (
            <div key={p.method} className="flex justify-between gap-3 items-start">
              <span>{when(sale.dateTime)} · {p.method} · at the till</span>
              <span className="flex items-center gap-1.5 flex-shrink-0">
                <span className="font-medium">{formatCurrency(p.amount)}</span>
                {canEditPayments && onEditTill && (
                  <button onClick={onEditTill} title="Change what was taken at the till, or how it was paid"
                    className="p-0.5 rounded hover:bg-surface-hover cursor-pointer">
                    <Pencil className="w-3 h-3 text-muted-foreground" />
                  </button>
                )}
              </span>
            </div>
          ))}
          {tillParts.length === 0 && (
            <div className="flex justify-between gap-3 items-start">
              <p className="text-muted-foreground">Nothing paid at the till.</p>
              {canEditPayments && onEditTill && (
                <button onClick={onEditTill} title="Change what was taken at the till"
                  className="p-0.5 rounded hover:bg-surface-hover cursor-pointer flex-shrink-0">
                  <Pencil className="w-3 h-3 text-muted-foreground" />
                </button>
              )}
            </div>
          )}
          {sale.payments.map((p) => (
            <div key={p.id} className="flex justify-between gap-3 items-start">
              <span className="min-w-0">
                {when(p.date)} · {p.method}
                {p.receivedByName && ` · ${p.receivedByName}`}
                {p.note && <span className="text-muted-foreground">{` · ${p.note}`}</span>}
              </span>
              <span className="flex items-center gap-1.5 flex-shrink-0">
                <span className="font-medium">{formatCurrency(p.amount)}</span>
                {canEditPayments && onEditPayment && (
                  <button onClick={() => onEditPayment(p)} title="Correct this payment"
                    className="p-0.5 rounded hover:bg-surface-hover cursor-pointer">
                    <Pencil className="w-3 h-3 text-muted-foreground" />
                  </button>
                )}
              </span>
            </div>
          ))}
          <div className="flex justify-between gap-3 border-t border-border pt-1">
            <span className="text-muted-foreground">Paid so far</span>
            <span className="font-medium text-success">{formatCurrency(sale.paid)}</span>
          </div>
          <div className="flex justify-between gap-3 font-semibold">
            <span>{sale.balance > 0 ? "Balance still owed" : "Paid in full"}</span>
            <span className={sale.balance > 0 ? "text-destructive" : "text-success"}>{sale.balance > 0 ? formatCurrency(sale.balance) : "Nothing owed"}</span>
          </div>
        </div>
      </div>

      <div>
        <p className="text-muted-foreground mb-1 flex items-center gap-1.5"><Glasses className="w-3.5 h-3.5" /> Prescriptions (eye test readings)</p>
        <div className="space-y-1.5">
          {sale.prescriptions.map((rx) => <RxCard key={rx.id} rx={rx} />)}
          {sale.prescriptions.length === 0 && (
            <p className="text-muted-foreground">None on this invoice yet — the eye test can be added later.</p>
          )}
          <Link href={`/dashboard/prescriptions?addTo=${sale.id}`}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/10 text-primary font-medium">
            <Plus className="w-3 h-3" /> Add prescription
          </Link>
          {!sale.customerId && (
            <p className="text-muted-foreground">Walk-in invoice — you&apos;ll pick or add the customer as you add it, and the invoice goes onto them.</p>
          )}
        </div>
      </div>

      {sale.returns.length > 0 && (
        <div>
          <p className="text-muted-foreground mb-1">Returns</p>
          <div className="space-y-1.5">
            {sale.returns.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3">
                <span>
                  <span className="font-medium">{r.returnNo}</span> · {when(r.date)} · refund {formatCurrency(r.totalRefund)}
                  {r.reason && <span className="text-muted-foreground">{` · ${r.reason}`}</span>}
                </span>
                {canUndoReturn && (onEditReturn || onUndoReturn) && (
                  <span className="flex items-center gap-1 flex-shrink-0">
                    {onEditReturn && (
                      <button onClick={() => onEditReturn(r)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-surface hover:bg-surface-hover font-medium cursor-pointer">
                        <Pencil className="w-3 h-3" /> Edit
                      </button>
                    )}
                    {onUndoReturn && (
                      <button onClick={() => onUndoReturn(r)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-surface hover:bg-surface-hover font-medium cursor-pointer">
                        <Undo2 className="w-3 h-3" /> Undo
                      </button>
                    )}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {sale.source === "Online" && (
        <p className="text-muted-foreground">
          {`Online order · ${sale.fulfillmentType ?? "Pickup"}${sale.deliveryAddress ? ` to ${sale.deliveryAddress}` : ""}${sale.onlineOrderStatus ? ` · ${sale.onlineOrderStatus}` : ""}`}
        </p>
      )}
      {sale.offlineRef && (
        <p className="flex items-start gap-1.5 text-muted-foreground">
          <WifiOff className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          Made while the till was offline — the customer&apos;s bill shows {sale.offlineRef}. Synced {when(sale.enteredAt)}.
        </p>
      )}
      {enteredLater && (
        <p className="text-muted-foreground">
          {`Old invoice dated ${when(sale.dateTime)}, entered ${when(sale.enteredAt)}${sale.stockDeducted ? "." : " without taking items out of stock."}`}
        </p>
      )}
    </div>
  );
}

import { formatCurrency } from "@/lib/utils/format";

// One description of a bill, shared by the till (straight after a sale) and
// Sales history (reopening an old one), so a reprint matches the original.

export interface InvoiceLine {
  key: string;
  name: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
}

// Comes from Settings → Shop, so changing the address there changes every
// bill. It used to be typed into the receipt itself, which is why the old
// Tariq Road address kept printing after the shop's address was updated.
export interface ShopDetails {
  name: string;
  address: string;
  phone: string;
  ntn: string;
  footer: string;
}

export interface InvoiceData {
  invoiceNo: string;
  date: string;
  orderTakenBy: string;
  billGeneratedBy: string;
  customerName: string | null;
  customerPhone: string;
  lines: InvoiceLine[];
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: string;
  paymentStatus: string;
  paid: number;
  balance: number;
  // Money taken after the sale (an advance settled later), printed on the
  // reissued bill so the customer can see how the total was made up.
  payments?: { date: string; amount: number; method: string }[];
  // Printed offline: invoiceNo is a temporary number until the till reconnects.
  provisional?: boolean;
  // On a reprint of a bill that was made offline: the number the customer holds.
  offlineRef?: string;
}

// Plain amounts in the item columns; "Rs." only where it helps (totals).
const amt = (n: number) => Math.round(n).toLocaleString("en-PK");
const when = (iso: string) =>
  new Date(iso).toLocaleString("en-PK", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 ${strong ? "font-bold" : ""}`}>
      <span className="text-gray-700 shrink-0">{label}</span>
      <span className="text-right break-words min-w-0">{value}</span>
    </div>
  );
}

const Rule = ({ double = false }: { double?: boolean }) => (
  <div className={`my-2 ${double ? "border-t-2 border-black" : "border-t border-dashed border-gray-500"}`} />
);

/**
 * 80mm till receipt. Laid out like a supermarket bill: centred shop details,
 * a title band, bill details in two columns, then an item table where the
 * name gets its own line and Qty / Rate / Amount line up underneath, so long
 * frame names never squeeze the numbers.
 */
export function ThermalReceipt({ invoice, shop }: { invoice: InvoiceData; shop: ShopDetails }) {
  const laterPayments = invoice.payments ?? [];
  const takenAtTill = invoice.paid - laterPayments.reduce((sum, p) => sum + p.amount, 0);
  const units = invoice.lines.reduce((sum, l) => sum + l.quantity, 0);

  return (
    <div className="receipt-paper mx-auto rounded-lg shadow-lg text-[11px] leading-snug tabular-nums">
      <div className="text-center">
        <img src="/eyespy-logo-black.png" alt={shop.name} className="h-10 w-auto mx-auto mb-1.5" />
        {shop.address && <p>{shop.address}</p>}
        {shop.phone && <p>Ph: {shop.phone}</p>}
        {shop.ntn && <p>NTN: {shop.ntn}</p>}
      </div>

      <div className="my-2 py-1 border-y-2 border-black text-center text-[12px] font-bold tracking-[0.2em]">
        {invoice.provisional ? "PROVISIONAL BILL" : "SALES INVOICE"}
      </div>

      <div className="space-y-0.5">
        <Row label="Invoice #" value={invoice.invoiceNo} strong />
        {invoice.offlineRef && <Row label="Offline ref" value={invoice.offlineRef} />}
        <Row label="Date" value={invoice.date} />
        {invoice.customerName && <Row label="Customer" value={invoice.customerName} />}
        {invoice.customerName && invoice.customerPhone && <Row label="Phone" value={invoice.customerPhone} />}
        {invoice.orderTakenBy && <Row label="Served by" value={invoice.orderTakenBy} />}
        {invoice.billGeneratedBy && invoice.billGeneratedBy !== invoice.orderTakenBy && (
          <Row label="Billed by" value={invoice.billGeneratedBy} />
        )}
      </div>

      <Rule />
      <div className="grid grid-cols-[1fr_28px_58px_62px] gap-x-1 font-bold text-[10px] uppercase tracking-wide">
        <span>Item</span><span className="text-center">Qty</span><span className="text-right">Rate</span><span className="text-right">Amount</span>
      </div>
      <Rule />

      <div className="space-y-1.5">
        {invoice.lines.map((line) => (
          <div key={line.key}>
            <p className="font-semibold break-words">{line.name}</p>
            {line.description && <p className="text-[10px] text-gray-700 break-words">{line.description}</p>}
            <div className="grid grid-cols-[1fr_28px_58px_62px] gap-x-1">
              <span />
              <span className="text-center">{line.quantity}</span>
              <span className="text-right">{amt(line.unitPrice)}</span>
              <span className="text-right">{amt(line.unitPrice * line.quantity)}</span>
            </div>
            {line.discount > 0 && (
              <div className="flex justify-between text-[10px]">
                <span className="pl-2">Discount</span><span>-{amt(line.discount)}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      <Rule />
      <div className="space-y-0.5">
        <Row label={`Items ${invoice.lines.length} · Qty ${units}`} value="" />
        <Row label="Subtotal" value={amt(invoice.subtotal)} />
        {invoice.discount > 0 && <Row label="Discount" value={`-${amt(invoice.discount)}`} />}
      </div>

      <div className="my-2 py-1.5 border-y-2 border-black flex justify-between items-baseline">
        <span className="text-[13px] font-bold">TOTAL</span>
        <span className="text-[16px] font-extrabold">{formatCurrency(invoice.total)}</span>
      </div>

      <div className="space-y-0.5">
        <Row label="Payment" value={`${invoice.paymentMethod} · ${invoice.paymentStatus}`} />
        {laterPayments.length > 0 && (
          <>
            <Row label={`Paid at till (${invoice.paymentMethod})`} value={amt(takenAtTill)} />
            {laterPayments.map((p, i) => (
              <Row key={i} label={`${when(p.date)} · ${p.method}`} value={amt(p.amount)} />
            ))}
          </>
        )}
        <Row label="Amount paid" value={formatCurrency(invoice.paid)} />
        {invoice.balance > 0
          ? <Row label="BALANCE DUE" value={formatCurrency(invoice.balance)} strong />
          : <p className="text-center font-bold tracking-wider pt-0.5">*** PAID IN FULL ***</p>}
      </div>

      {invoice.provisional && (
        <div className="mt-2 p-1.5 border border-black text-center text-[10px]">
          Made while offline. This bill&apos;s final invoice number is given when the till reconnects —
          quote {invoice.invoiceNo} and we&apos;ll find it.
        </div>
      )}

      <Rule double />
      <p className="text-center font-semibold">{shop.footer}</p>
      <p className="text-center text-[9px] text-gray-600 mt-1">Printed {when(new Date().toISOString())}</p>
    </div>
  );
}

export function A4Invoice({ invoice, shop }: { invoice: InvoiceData; shop: ShopDetails }) {
  return (
    <div className="a4-invoice bg-white text-black rounded-lg p-6 shadow-lg text-base">
      <div className="flex justify-between items-center pb-4 border-b-2 border-[#6d5ef0]">
        <img src="/eyespy-logo-black.png" alt={shop.name} className="h-12 w-auto" />
        <div className="text-right">
          <p className="text-2xl font-extrabold tracking-wide text-[#6d5ef0]">{invoice.provisional ? "PROVISIONAL BILL" : "INVOICE"}</p>
          <p className="text-sm text-gray-600">{invoice.invoiceNo}</p>
          {invoice.offlineRef && <p className="text-xs text-gray-500">Offline ref {invoice.offlineRef}</p>}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 py-4 border-b border-gray-200 text-sm">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">From</p>
          <p className="font-semibold">{shop.name}</p>
          {shop.address && <p className="text-gray-600">{shop.address}</p>}
          {shop.phone && <p className="text-gray-600">Ph: {shop.phone}</p>}
          {shop.ntn && <p className="text-gray-600">NTN: {shop.ntn}</p>}
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">Billed To</p>
          <p className="font-semibold">{invoice.customerName ?? "Walk-in Customer"}</p>
          {invoice.customerPhone && <p className="text-gray-600">{invoice.customerPhone}</p>}
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">Invoice Details</p>
          <p className="text-gray-600">Date: {invoice.date}</p>
          <p className="text-gray-600">Payment: {invoice.paymentMethod}</p>
          <p className="text-gray-600">Status: {invoice.paymentStatus}</p>
        </div>
      </div>

      <table className="w-full text-sm my-4">
        <thead>
          <tr className="bg-gray-100 border-b-2 border-gray-300">
            <th className="text-left py-2 pl-2 w-8">#</th>
            <th className="text-left py-2">Item</th>
            <th className="text-center py-2">Qty</th>
            <th className="text-right py-2">Unit Price</th>
            <th className="text-right py-2">Discount</th>
            <th className="text-right py-2 pr-2">Amount</th>
          </tr>
        </thead>
        <tbody>
          {invoice.lines.map((line, i) => (
            <tr key={line.key} className="border-b border-gray-100 align-top">
              <td className="py-2 pl-2 text-gray-500">{i + 1}</td>
              <td className="py-2">
                {line.name}
                {line.description && <p className="text-xs text-gray-500 mt-0.5">{line.description}</p>}
              </td>
              <td className="text-center py-2">{line.quantity}</td>
              <td className="text-right py-2">{formatCurrency(line.unitPrice)}</td>
              <td className="text-right py-2">{line.discount > 0 ? `-${formatCurrency(line.discount)}` : "—"}</td>
              <td className="text-right py-2 pr-2">{formatCurrency(line.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex justify-end">
        <div className="w-64 text-sm space-y-1">
          <div className="flex justify-between"><span className="text-gray-600">Subtotal</span><span>{formatCurrency(invoice.subtotal)}</span></div>
          {invoice.discount > 0 && (
            <div className="flex justify-between"><span className="text-gray-600">Invoice Discount</span><span>-{formatCurrency(invoice.discount)}</span></div>
          )}
          <div className="flex justify-between text-lg font-bold border-t-2 border-gray-800 pt-2 mt-2">
            <span>Total</span><span className="text-[#6d5ef0]">{formatCurrency(invoice.total)}</span>
          </div>
          {(invoice.payments?.length ?? 0) > 0 && (
            <div className="border-t border-gray-200 pt-1 mt-1 text-xs text-gray-600">
              <div className="flex justify-between">
                <span>Advance ({invoice.paymentMethod})</span>
                <span>{formatCurrency(invoice.paid - invoice.payments!.reduce((s, p) => s + p.amount, 0))}</span>
              </div>
              {invoice.payments!.map((p, i) => (
                <div key={i} className="flex justify-between">
                  <span>{when(p.date)} ({p.method})</span>
                  <span>{formatCurrency(p.amount)}</span>
                </div>
              ))}
            </div>
          )}
          {invoice.balance > 0 ? (
            <>
              <div className="flex justify-between"><span className="text-gray-600">Paid</span><span>{formatCurrency(invoice.paid)}</span></div>
              <div className="flex justify-between font-semibold"><span>Balance Due</span><span>{formatCurrency(invoice.balance)}</span></div>
            </>
          ) : (
            <>
              <div className="flex justify-between"><span className="text-gray-600">Paid</span><span>{formatCurrency(invoice.paid)}</span></div>
              <div className="flex justify-between font-semibold text-[#16a34a]"><span>Paid in full</span><span>Rs.0 due</span></div>
            </>
          )}
        </div>
      </div>

      <div className="mt-8 pt-3 border-t border-gray-200 flex justify-between items-end text-xs text-gray-500">
        <div>
          {(invoice.orderTakenBy || invoice.billGeneratedBy) && (
            <p>Order taken by {invoice.orderTakenBy || "—"} · Bill generated by {invoice.billGeneratedBy || "—"}</p>
          )}
          <p className="mt-1">{shop.footer} Your vision is our mission.</p>
        </div>
        <p>Computer-generated invoice</p>
      </div>
    </div>
  );
}

/** The bill for a sale reopened from history. */
/** "Blue Cut · 1.56 index", the way the lens should read under its line. */
export function lensNote(lensColor: string, lensDescription: string) {
  return [lensColor, lensDescription].map((s) => s.trim()).filter(Boolean).join(" · ");
}

function withNote(description: string, note: string) {
  return [description, note].map((s) => s.trim()).filter(Boolean).join(" · ");
}

export function invoiceFromSale(sale: {
  invoiceNo: string; dateTime: string; customerId: string; customerName: string; customerPhone: string;
  createdByName: string; receivedByName: string;
  items: { id: string; productId: string; productName: string; description: string; quantity: number; unitPrice: number; discount: number; total: number }[];
  customLensName: string; customLensPrice: number; customLensQty: number;
  lensProductId: string; lensColor: string; lensDescription: string;
  offlineRef: string;
  subtotal: number; discount: number; total: number; paid: number; balance: number;
  paymentMethod: string; paymentStatus: string;
  payments: { date: string; amount: number; method: string }[];
}): InvoiceData {
  // Colour and description belong to whichever lens was sold, so they print
  // under that line rather than as a stray note at the bottom.
  const note = lensNote(sale.lensColor, sale.lensDescription);
  const lines: InvoiceLine[] = sale.items.map((it) => ({
    key: it.id, name: it.productName,
    description: it.productId && it.productId === sale.lensProductId ? withNote(it.description, note) : it.description,
    quantity: it.quantity, unitPrice: it.unitPrice, discount: it.discount, total: it.total,
  }));
  if (sale.customLensPrice > 0) {
    const qty = sale.customLensQty || 1;
    lines.push({
      key: "custom-lens", name: sale.customLensName, description: note, quantity: qty,
      unitPrice: sale.customLensPrice, discount: 0, total: sale.customLensPrice * qty,
    });
  } else if (note && !sale.lensProductId) {
    // A lens noted without a line of its own (colour recorded against the job).
    lines.push({ key: "lens-note", name: "Lens", description: note, quantity: 1, unitPrice: 0, discount: 0, total: 0 });
  }
  return {
    invoiceNo: sale.invoiceNo,
    date: new Date(sale.dateTime).toLocaleString("en-PK", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }),
    orderTakenBy: sale.createdByName,
    billGeneratedBy: sale.receivedByName,
    customerName: sale.customerId ? sale.customerName : null,
    customerPhone: sale.customerPhone,
    lines,
    subtotal: sale.subtotal,
    discount: sale.discount,
    total: sale.total,
    paymentMethod: sale.paymentMethod,
    paymentStatus: sale.paymentStatus,
    paid: sale.paid,
    balance: sale.balance,
    payments: sale.payments,
    offlineRef: sale.offlineRef || undefined,
  };
}

export function shopDetailsFromSettings(settings: { name: string; address: string; phone: string; ntn: string; receiptFooter: string }): ShopDetails {
  return {
    name: settings.name,
    address: settings.address,
    phone: settings.phone,
    ntn: settings.ntn,
    footer: settings.receiptFooter || `Thank you for choosing ${settings.name}!`,
  };
}

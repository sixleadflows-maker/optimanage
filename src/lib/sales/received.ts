// A day's sales are the payments made that day. An Rs.8,000 bill paid Rs.4,000
// on Monday and Rs.4,000 on Wednesday is Rs.4,000 of sales on each day -- not
// Rs.8,000 on Monday and nothing on Wednesday. What was taken at the till counts
// on the invoice's own date; every later payment (a balance paid off, or an
// advance put towards it) counts on the day it was made.
//
// Profit follows the money: each payment carries the invoice's profit in the
// same proportion (half the bill paid is half its profit).
//
// No database here, so the server and the screens work it out the same way.

export interface SaleMoney {
  dateTime: string | Date;
  total: number;
  profit: number;
  paid: number;
  // How the till part was paid ("Cash", "Cash + Card"...), for listing.
  paymentMethod?: string;
  // Everything received after the sale itself, each with its own date.
  payments: { date: string | Date; amount: number; method?: string }[];
}

export interface PaymentOnDay {
  date: Date;
  amount: number;
  profit: number;
  method: string;
  // Taken at the till when the invoice was made (rather than paid later).
  atTill: boolean;
}

/** Each payment towards one invoice, on the day it was made. */
export function paymentsOnDays(sale: SaleMoney): PaymentOnDay[] {
  const profitPerRupee = sale.total > 0 ? sale.profit / sale.total : 0;
  const later = sale.payments.reduce((sum, p) => sum + p.amount, 0);
  const atTill = Math.round((sale.paid - later) * 100) / 100;
  const out: PaymentOnDay[] = [];
  if (atTill > 0.009) {
    out.push({ date: new Date(sale.dateTime), amount: atTill, profit: atTill * profitPerRupee, method: sale.paymentMethod ?? "", atTill: true });
  }
  for (const p of sale.payments) {
    if (Math.abs(p.amount) < 0.009) continue;
    out.push({ date: new Date(p.date), amount: p.amount, profit: p.amount * profitPerRupee, method: p.method ?? "", atTill: false });
  }
  return out;
}

// A refund on a return is the other way round: money going back out, on the
// day it was handed back, as a minus on that day's sales.

export interface RefundMoney {
  date: string | Date;
  totalRefund: number;
  // What the returned goods cost the shop. They're back in the shop, so that
  // cost isn't lost: what the refund takes away is the profit made on them.
  items: { quantity: number; unitCost: number }[];
}

export interface RefundOnDay {
  date: Date;
  // Below zero: money handed back.
  amount: number;
  profit: number;
}

/** The money handed back on a return, on the day it was, and the profit it takes back. */
export function refundOnDay(r: RefundMoney): RefundOnDay {
  const cost = r.items.reduce((sum, i) => sum + i.quantity * i.unitCost, 0);
  return { date: new Date(r.date), amount: -r.totalRefund, profit: -(r.totalRefund - cost) };
}

import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { CREDIT_METHOD } from "@/lib/constants";

// The advance a customer has paid in and not yet used. There's one way to work
// it out, used everywhere: what they paid in, less what was handed back (both
// in CustomerCredit), less what their invoices took from it (the "From
// advance" payments). Nothing keeps a running total, so nothing can drift.

type Client = Pick<Prisma.TransactionClient, "customerCredit" | "salePayment">;

const round = (n: number) => Math.round(n * 100) / 100;

/** What the shop is holding for this customer right now. */
export async function creditHeld(customerId: string, client: Client = db): Promise<number> {
  const [paidIn, used] = await Promise.all([
    client.customerCredit.aggregate({ where: { customerId }, _sum: { amount: true } }),
    client.salePayment.aggregate({ where: { method: CREDIT_METHOD, sale: { customerId } }, _sum: { amount: true } }),
  ]);
  return round((paidIn._sum.amount ?? 0) - (used._sum.amount ?? 0));
}

/** The same figure for every customer holding one, for lists and the till. */
export async function creditHeldByCustomer(): Promise<Map<string, number>> {
  const [paidIn, used] = await Promise.all([
    db.customerCredit.groupBy({ by: ["customerId"], _sum: { amount: true } }),
    db.salePayment.findMany({ where: { method: CREDIT_METHOD }, select: { amount: true, sale: { select: { customerId: true } } } }),
  ]);
  const held = new Map<string, number>();
  for (const row of paidIn) held.set(row.customerId, row._sum.amount ?? 0);
  for (const p of used) {
    const id = p.sale.customerId;
    if (id) held.set(id, (held.get(id) ?? 0) - p.amount);
  }
  for (const [id, amount] of held) held.set(id, round(amount));
  return held;
}

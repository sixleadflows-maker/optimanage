"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export interface CashCollectionInput {
  date: string;        // YYYY-MM-DD
  openingCash: number;
  closingCash: number; // physically counted
  notes: string;
  branchId?: string;
}

export async function saveCashCollection(input: CashCollectionInput) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const start = new Date(`${input.date}T00:00:00.000Z`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const branchId = input.branchId || session.user.branchId || null;

  // Recompute money figures server-side (source of truth) rather than trusting the client
  const saleWhere = { date: { gte: start, lt: end }, ...(branchId ? { branchId } : {}) };
  const [sales, expenses] = await Promise.all([
    db.sale.findMany({ where: saleWhere }),
    db.expense.findMany({ where: { date: { gte: start, lt: end } } }),
  ]);
  const byMethod = (m: string) => sales.filter((s) => s.paymentMethod === m).reduce((sum, s) => sum + s.paid, 0);
  const cashSales = byMethod("Cash");
  const cardSales = byMethod("Card");
  const bankTransfer = byMethod("Bank Transfer");
  const jazzCash = byMethod("JazzCash");
  const totalCollection = sales.reduce((sum, s) => sum + s.paid, 0);
  const expensesTotal = expenses.reduce((sum, e) => sum + e.amount, 0);

  const data = {
    date: start,
    branchId,
    openingCash: input.openingCash,
    cashSales, cardSales, bankTransfer, jazzCash,
    totalCollection,
    expenses: expensesTotal,
    closingCash: input.closingCash,
    notes: input.notes,
    closedBy: session.user.name,
  };

  const existing = await db.cashCollection.findFirst({
    where: { date: { gte: start, lt: end }, ...(branchId ? { branchId } : {}) },
  });
  if (existing) {
    await db.cashCollection.update({ where: { id: existing.id }, data });
  } else {
    await db.cashCollection.create({ data });
  }

  revalidatePath("/dashboard/cash");
  return { ok: true };
}

"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getCashCollection } from "@/lib/data";

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

  // Recompute money figures server-side (source of truth) rather than trusting
  // the client -- the same figures the Cash Collection screen shows, so split
  // payments and balances collected later land on the right method and day.
  const day = await getCashCollection(input.date, branchId ?? undefined);

  const data = {
    date: start,
    branchId,
    openingCash: input.openingCash,
    cashSales: day.cashSales,
    cardSales: day.cardSales,
    bankTransfer: day.bankTransfer,
    jazzCash: day.jazzCash,
    totalCollection: day.totalCollection,
    expenses: day.expenses,
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

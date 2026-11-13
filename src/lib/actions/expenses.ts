"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { trashExpense, TrashError } from "@/lib/trash/snapshots";
import { cashRs, syncCashCloses } from "@/lib/cash/closes";
import { EXPENSE_PAYMENT_METHODS } from "@/lib/constants";

export interface ExpenseInput {
  date: string;
  category: string;
  description: string;
  amount: number;
  paidBy: string;
  // Cash / Card / Cheque.
  paymentMethod: string;
}

/** An expense as it reads beside a closed day's figures: "Supplies, Rs.50 Cash, SADQA". */
const describe = (e: { category: string; amount: number; paymentMethod: string; description: string }) =>
  [e.category, `${cashRs(e.amount)} ${e.paymentMethod || "Cash"}`, e.description.trim()].filter(Boolean).join(", ");

/** The date, amount and method checked the one way for adding and changing. */
function checked(input: ExpenseInput) {
  const date = input.date ? new Date(input.date) : new Date();
  if (Number.isNaN(date.getTime())) return { ok: false as const, error: "Check the expense date" };
  if (date.getTime() > Date.now() + 24 * 60 * 60 * 1000) return { ok: false as const, error: "The expense date can't be in the future" };
  const amount = Math.round(Number(input.amount) * 100) / 100;
  if (!(amount > 0)) return { ok: false as const, error: "Amount must be greater than zero" };
  const paymentMethod = input.paymentMethod || "Cash";
  if (!(EXPENSE_PAYMENT_METHODS as readonly string[]).includes(paymentMethod)) return { ok: false as const, error: "Pick how the expense was paid" };
  return { ok: true as const, date, amount, paymentMethod };
}

export async function createExpense(input: ExpenseInput) {
  const session = await auth();
  if (!session?.user) return { ok: false as const, error: "You've been signed out — sign in again" };
  const c = checked(input);
  if (!c.ok) return c;

  const expense = await db.expense.create({
    data: {
      date: c.date,
      category: input.category,
      description: input.description,
      amount: c.amount,
      paidBy: input.paidBy || session.user.name,
      paymentMethod: c.paymentMethod,
    },
  });
  // An expense entered for a day already closed (the next morning, say) comes off that day's drawer.
  const closesCorrected = await syncCashCloses({
    dates: [expense.date],
    reason: `Expense added: ${describe(expense)}`,
    by: { name: session.user.name },
  });
  revalidatePath("/dashboard/expenses");
  revalidatePath("/dashboard/cash");
  return { ok: true as const, closesCorrected };
}

export async function updateExpense(id: string, input: ExpenseInput) {
  const session = await auth();
  if (!session?.user) return { ok: false as const, error: "You've been signed out — sign in again" };
  if (session.user.role === "CASHIER") return { ok: false as const, error: "Only managers and owners can change an expense" };
  const c = checked(input);
  if (!c.ok) return c;

  // Read first: the day it was on may be closed too, if the date is changed.
  const before = await db.expense.findUnique({ where: { id } });
  if (!before) return { ok: false as const, error: "This expense has been deleted" };
  const data = {
    date: input.date ? c.date : before.date,
    category: input.category,
    description: input.description,
    amount: c.amount,
    paidBy: input.paidBy,
    paymentMethod: c.paymentMethod,
  };
  const updated = await db.expense.updateMany({ where: { id }, data });
  if (updated.count === 0) return { ok: false as const, error: "This expense has been deleted" };
  const closesCorrected = await syncCashCloses({
    dates: [before.date, data.date],
    reason: `Expense changed: ${describe(before)} → ${describe(data)}`,
    by: { name: session.user.name },
  });
  revalidatePath("/dashboard/expenses");
  revalidatePath("/dashboard/cash");
  return { ok: true as const, closesCorrected };
}

// To the trash (restorable for 30 days), not gone for good.
export async function deleteExpense(id: string) {
  const session = await auth();
  if (!session?.user) return { ok: false as const, error: "You've been signed out — sign in again" };
  if (session.user.role === "CASHIER") return { ok: false as const, error: "Only managers and owners can delete an expense" };
  let closesCorrected: number;
  try {
    ({ closesCorrected } = await trashExpense(id, session.user.id));
  } catch (e) {
    if (e instanceof TrashError) return { ok: false as const, error: e.message };
    throw e;
  }
  revalidatePath("/dashboard/expenses");
  revalidatePath("/dashboard/cash");
  revalidatePath("/dashboard/trash");
  return { ok: true as const, closesCorrected };
}

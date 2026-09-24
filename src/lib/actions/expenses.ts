"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { trashExpense, TrashError } from "@/lib/trash/snapshots";

export interface ExpenseInput {
  date: string;
  category: string;
  description: string;
  amount: number;
  paidBy: string;
  // Cash / Card / Cheque.
  paymentMethod: string;
}

export async function createExpense(input: ExpenseInput) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (input.amount <= 0) throw new Error("Amount must be greater than zero");

  await db.expense.create({
    data: {
      date: input.date ? new Date(input.date) : new Date(),
      category: input.category,
      description: input.description,
      amount: input.amount,
      paidBy: input.paidBy || session.user.name,
      paymentMethod: input.paymentMethod || "Cash",
    },
  });
  revalidatePath("/dashboard/expenses");
  revalidatePath("/dashboard/cash");
  return { ok: true };
}

export async function updateExpense(id: string, input: ExpenseInput) {
  const session = await auth();
  if (!session?.user) return { ok: false as const, error: "You've been signed out — sign in again" };
  if (session.user.role === "CASHIER") return { ok: false as const, error: "Only managers and owners can change an expense" };
  if (!(input.amount > 0)) return { ok: false as const, error: "Amount must be greater than zero" };

  const updated = await db.expense.updateMany({
    where: { id },
    data: {
      date: input.date ? new Date(input.date) : undefined,
      category: input.category,
      description: input.description,
      amount: input.amount,
      paidBy: input.paidBy,
      paymentMethod: input.paymentMethod || "Cash",
    },
  });
  if (updated.count === 0) return { ok: false as const, error: "This expense has been deleted" };
  revalidatePath("/dashboard/expenses");
  revalidatePath("/dashboard/cash");
  return { ok: true as const };
}

// To the trash (restorable for 30 days), not gone for good.
export async function deleteExpense(id: string) {
  const session = await auth();
  if (!session?.user) return { ok: false as const, error: "You've been signed out — sign in again" };
  if (session.user.role === "CASHIER") return { ok: false as const, error: "Only managers and owners can delete an expense" };
  try {
    await trashExpense(id, session.user.id);
  } catch (e) {
    if (e instanceof TrashError) return { ok: false as const, error: e.message };
    throw e;
  }
  revalidatePath("/dashboard/expenses");
  revalidatePath("/dashboard/cash");
  revalidatePath("/dashboard/trash");
  return { ok: true as const };
}

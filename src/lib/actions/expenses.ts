"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export interface ExpenseInput {
  date: string;
  category: string;
  description: string;
  amount: number;
  paidBy: string;
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
    },
  });
  revalidatePath("/dashboard/expenses");
  return { ok: true };
}

export async function deleteExpense(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  await db.expense.delete({ where: { id } });
  revalidatePath("/dashboard/expenses");
  return { ok: true };
}

"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { trashBankDeposit, TrashError } from "@/lib/trash/snapshots";

export interface BankDepositInput {
  date: string; // YYYY-MM-DD
  amount: number;
  bankName: string;
  // The deposit slip number.
  reference: string;
  notes: string;
}

function checked(input: BankDepositInput) {
  const amount = Math.round(Number(input.amount) * 100) / 100;
  if (!(amount > 0)) return { ok: false as const, error: "Enter the amount deposited" };
  if (!input.date || Number.isNaN(new Date(input.date).getTime())) return { ok: false as const, error: "Check the deposit date" };
  return {
    ok: true as const,
    data: {
      date: new Date(input.date),
      amount,
      bankName: input.bankName.trim(),
      reference: input.reference.trim(),
      notes: input.notes.trim(),
    },
  };
}

/**
 * Cash taken out of the drawer and put in the bank. It comes off the day's
 * cash on the Cash page but it isn't an expense, so it never reaches profit.
 */
export async function createBankDeposit(input: BankDepositInput): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false as const, error: "You've been signed out — sign in again" };
  const c = checked(input);
  if (!c.ok) return c;

  const created = await db.bankDeposit.create({ data: { ...c.data, depositedBy: session.user.name ?? "" } });
  revalidatePath("/dashboard/cash");
  return { ok: true as const, id: created.id };
}

// Changing what went into the bank moves a day's cash, so it sits with the
// other money corrections: owner or manager.
export async function updateBankDeposit(id: string, input: BankDepositInput): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false as const, error: "You've been signed out — sign in again" };
  if (session.user.role === "CASHIER") return { ok: false as const, error: "Only managers and owners can change a bank deposit" };
  const c = checked(input);
  if (!c.ok) return c;

  const updated = await db.bankDeposit.updateMany({ where: { id }, data: c.data });
  if (updated.count === 0) return { ok: false as const, error: "This bank deposit has been deleted" };
  revalidatePath("/dashboard/cash");
  return { ok: true as const };
}

// To the trash (restorable for 30 days), not gone for good.
export async function deleteBankDeposit(id: string) {
  const session = await auth();
  if (!session?.user) return { ok: false as const, error: "You've been signed out — sign in again" };
  if (session.user.role === "CASHIER") return { ok: false as const, error: "Only managers and owners can delete a bank deposit" };
  try {
    await trashBankDeposit(id, session.user.id);
  } catch (e) {
    if (e instanceof TrashError) return { ok: false as const, error: e.message };
    throw e;
  }
  revalidatePath("/dashboard/cash");
  revalidatePath("/dashboard/trash");
  return { ok: true as const };
}

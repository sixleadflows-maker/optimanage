"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { creditHeld } from "@/lib/sales/credit";
import { trashCustomerCredit, TrashError } from "@/lib/trash/snapshots";
import { CREDIT_METHOD, PAYMENT_METHODS } from "@/lib/constants";

export interface CreditInput {
  customerId: string;
  amount: number;
  // How it was paid in, or handed back.
  method: string;
  // When (ISO); now if left out.
  date?: string;
  note?: string;
}

type Result = { ok: true; held: number } | { ok: false; error: string };

const rs = (n: number) => `Rs.${Math.round(n).toLocaleString("en-PK")}`;

function refresh(customerId: string) {
  revalidatePath("/dashboard/customers");
  revalidatePath(`/dashboard/customers/${customerId}`);
  revalidatePath("/dashboard/pos");
  revalidatePath("/dashboard/cash");
}

async function checked(input: CreditInput) {
  const amount = Math.round(Number(input.amount) * 100) / 100;
  if (!(amount > 0)) return { ok: false as const, error: "Enter the amount" };
  if (!(PAYMENT_METHODS as readonly string[]).includes(input.method) || input.method === CREDIT_METHOD) {
    return { ok: false as const, error: "Choose how it was paid" };
  }
  const date = input.date ? new Date(input.date) : new Date();
  if (Number.isNaN(date.getTime())) return { ok: false as const, error: "Check the date and time" };
  if (date.getTime() > Date.now() + 5 * 60_000) return { ok: false as const, error: "The date can't be in the future" };
  const customer = await db.customer.findUnique({ where: { id: input.customerId }, select: { id: true, active: true } });
  if (!customer?.active) return { ok: false as const, error: "This customer is no longer on the system" };
  return { ok: true as const, amount, date, note: (input.note ?? "").trim() };
}

/**
 * A customer pays money ahead, for the shop to hold. It goes in the drawer (or
 * the bank) on the day it's taken and can pay any of their later bills; it
 * isn't a sale, so it doesn't touch revenue until a bill uses it.
 */
export async function addCustomerCredit(input: CreditInput): Promise<Result> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "You've been signed out — sign in again" };
  const c = await checked(input);
  if (!c.ok) return c;

  await db.customerCredit.create({
    data: { customerId: input.customerId, amount: c.amount, method: input.method, date: c.date, note: c.note, recordedBy: session.user.name ?? "" },
  });
  refresh(input.customerId);
  return { ok: true, held: await creditHeld(input.customerId) };
}

/** Hands some (or all) of the advance back. It leaves the drawer on the day it's handed over. */
export async function refundCustomerCredit(input: CreditInput): Promise<Result> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "You've been signed out — sign in again" };
  const c = await checked(input);
  if (!c.ok) return c;

  const held = await creditHeld(input.customerId);
  if (c.amount > held + 0.01) {
    return { ok: false, error: held > 0 ? `Only ${rs(held)} of advance is held for this customer` : "This customer has no advance held" };
  }
  await db.customerCredit.create({
    data: { customerId: input.customerId, amount: -c.amount, method: input.method, date: c.date, note: c.note, recordedBy: session.user.name ?? "" },
  });
  refresh(input.customerId);
  return { ok: true, held: await creditHeld(input.customerId) };
}

/**
 * Corrects an advance paid in, or a refund of one: amount, how, when, note.
 * Owner or manager, like the other money corrections. What's been used or
 * handed back already can't be taken away again: a received advance can't go
 * below that, and a refund can't be more than there is.
 */
export async function updateCustomerCredit(id: string, input: Omit<CreditInput, "customerId">): Promise<Result> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "You've been signed out — sign in again" };
  if (session.user.role === "CASHIER") return { ok: false, error: "Only managers and owners can correct an advance entry" };

  const entry = await db.customerCredit.findUnique({ where: { id } });
  if (!entry) return { ok: false, error: "This entry has been deleted" };
  const c = await checked({ ...input, customerId: entry.customerId });
  if (!c.ok) return c;

  const paidIn = entry.amount >= 0;
  const amount = paidIn ? c.amount : -c.amount;
  const held = await creditHeld(entry.customerId);
  if (held - entry.amount + amount < -0.01) {
    return {
      ok: false,
      error: paidIn
        ? `${rs(entry.amount - held)} of this advance has already been used or refunded, so it can't go below that`
        : `Only ${rs(held - entry.amount)} is held, so the refund can't be more than that`,
    };
  }
  await db.customerCredit.update({ where: { id }, data: { amount, method: input.method, date: c.date, note: c.note } });
  refresh(entry.customerId);
  return { ok: true, held: await creditHeld(entry.customerId) };
}

// Removing an entry rewrites a day's cash, so it sits with the other money
// corrections: owner or manager. It goes to the Trash, not gone for good.
export async function deleteCustomerCredit(id: string): Promise<Result> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "You've been signed out — sign in again" };
  if (session.user.role === "CASHIER") return { ok: false, error: "Only managers and owners can remove an advance entry" };

  const entry = await db.customerCredit.findUnique({ where: { id }, select: { customerId: true } });
  if (!entry) return { ok: false, error: "This entry has already been deleted" };
  try {
    await trashCustomerCredit(id, session.user.id);
  } catch (e) {
    if (e instanceof TrashError) return { ok: false, error: e.message };
    throw e;
  }
  refresh(entry.customerId);
  revalidatePath("/dashboard/trash");
  return { ok: true, held: await creditHeld(entry.customerId) };
}

/** What's held for a customer right now — asked for when money is being received on their invoice. */
export async function customerCreditHeld(customerId: string): Promise<number> {
  const session = await auth();
  if (!session?.user || !customerId) return 0;
  return creditHeld(customerId);
}

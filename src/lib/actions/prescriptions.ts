"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { trashPrescription, TrashError } from "@/lib/trash/snapshots";
import { rxTextColumns, type RxTextColumns } from "@/lib/utils/rx";
import { attachCustomerToSale } from "@/lib/sales/core";

export interface PrescriptionInput extends Partial<RxTextColumns> {
  customerId: string;
  // Put it on an invoice that already exists -- the eye test often happens
  // after the order has been rung up.
  saleId?: string;
  label?: string;
  rightSph: number; rightCyl: number; rightAxis: number; rightPd: number; rightAdd: number;
  leftSph: number; leftCyl: number; leftAxis: number; leftPd: number; leftAdd: number;
  notes: string;
  isOwnPrescription?: boolean;
}

export type CreatePrescriptionResult =
  | { ok: true; id: string; date: string; attachedCustomer: boolean }
  | { ok: false; error: string };

/**
 * Saves a prescription for a customer. With `saleId` it goes onto an invoice
 * that's already been rung up; if that invoice was a walk-in, the customer is
 * put on it too (the eye test is often when the name turns up).
 */
export async function createPrescription(input: PrescriptionInput): Promise<CreatePrescriptionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "You've been signed out — sign in again" };
  if (!input.customerId) return { ok: false, error: "Select or add the customer first" };

  const sale = input.saleId
    ? await db.sale.findUnique({ where: { id: input.saleId }, select: { id: true, total: true, date: true, customerId: true } })
    : null;
  if (input.saleId && !sale) return { ok: false, error: "That invoice no longer exists" };
  // An invoice already on someone else stays theirs -- moving it is done from
  // the invoice's own Edit, where the money side is handled too.
  if (sale?.customerId && sale.customerId !== input.customerId) {
    return { ok: false, error: "That invoice belongs to a different customer — change the customer from the invoice's Edit first" };
  }
  const attachCustomer = !!sale && !sale.customerId;

  const created = await db.$transaction(async (tx) => {
    const rx = await tx.prescription.create({
      data: {
        customerId: input.customerId,
        saleId: input.saleId || null,
        rightSph: input.rightSph, rightCyl: input.rightCyl, rightAxis: input.rightAxis, rightPd: input.rightPd, rightAdd: input.rightAdd,
        leftSph: input.leftSph, leftCyl: input.leftCyl, leftAxis: input.leftAxis, leftPd: input.leftPd, leftAdd: input.leftAdd,
        ...rxTextColumns(input),
        label: (input.label ?? "").trim(),
        notes: input.notes,
        isOwnPrescription: input.isOwnPrescription ?? false,
      },
    });
    if (attachCustomer) await attachCustomerToSale(tx, sale!, input.customerId);
    return rx;
  });

  revalidatePath("/dashboard/prescriptions");
  revalidatePath(`/dashboard/customers/${input.customerId}`);
  if (input.saleId) {
    revalidatePath("/dashboard/sales");
    if (attachCustomer) revalidatePath("/dashboard/customers");
  }
  return { ok: true, id: created.id, date: created.date.toISOString(), attachedCustomer: attachCustomer };
}

export async function updatePrescription(id: string, input: Omit<PrescriptionInput, "customerId">) {
  const session = await auth();
  if (!session?.user) return { ok: false as const, error: "You've been signed out — sign in again" };
  const updated = await db.prescription.updateMany({
    where: { id },
    data: {
      rightSph: input.rightSph, rightCyl: input.rightCyl, rightAxis: input.rightAxis, rightPd: input.rightPd, rightAdd: input.rightAdd,
      leftSph: input.leftSph, leftCyl: input.leftCyl, leftAxis: input.leftAxis, leftPd: input.leftPd, leftAdd: input.leftAdd,
      ...rxTextColumns(input),
      label: (input.label ?? "").trim(),
      notes: input.notes,
      isOwnPrescription: input.isOwnPrescription ?? false,
    },
  });
  if (updated.count === 0) return { ok: false as const, error: "This prescription has been deleted" };
  revalidatePath("/dashboard/prescriptions");
  revalidatePath("/dashboard/customers");
  return { ok: true as const };
}

// To the trash (restorable for 30 days), not gone for good.
export async function deletePrescription(id: string) {
  const session = await auth();
  if (!session?.user) return { ok: false as const, error: "You've been signed out — sign in again" };
  if (session.user.role === "CASHIER") return { ok: false as const, error: "Only managers and owners can delete a prescription" };
  try {
    await trashPrescription(id, session.user.id);
  } catch (e) {
    if (e instanceof TrashError) return { ok: false as const, error: e.message };
    throw e;
  }
  revalidatePath("/dashboard/prescriptions");
  revalidatePath("/dashboard/customers");
  revalidatePath("/dashboard/trash");
  return { ok: true as const };
}

/**
 * Hides or shows one prescription's notes in the history. It applies to
 * everyone on every computer -- the point is that a note isn't on screen with
 * the customer there -- and the note itself is untouched either way.
 */
export async function setPrescriptionNotesHidden(id: string, hidden: boolean) {
  const session = await auth();
  if (!session?.user) return { ok: false as const, error: "You've been signed out — sign in again" };
  const updated = await db.prescription.updateMany({ where: { id }, data: { notesHidden: hidden } });
  if (updated.count === 0) return { ok: false as const, error: "This prescription has been deleted" };
  revalidatePath("/dashboard/prescriptions");
  revalidatePath("/dashboard/customers");
  return { ok: true as const };
}

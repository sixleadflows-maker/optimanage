"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { trashPrescription, TrashError } from "@/lib/trash/snapshots";
import { rxHistoryOrder, rxLensColumns, rxTextColumns, type RxLensFields, type RxTextColumns } from "@/lib/utils/rx";
import { attachCustomerToSale } from "@/lib/sales/core";

export interface PrescriptionInput extends Partial<RxTextColumns>, RxLensFields {
  customerId: string;
  // Put it on an invoice that already exists -- the eye test often happens
  // after the order has been rung up.
  saleId?: string;
  label?: string;
  rightSph: number; rightCyl: number; rightAxis: number; rightPd: number; rightAdd: number;
  leftSph: number; leftCyl: number; leftAxis: number; leftPd: number; leftAdd: number;
  notes: string;
  isOwnPrescription?: boolean;
  // The day of the eye test ("2026-09-14") when it wasn't today -- an older
  // slip typed in later. Left out, it's now.
  date?: string;
}

/** One prescription among several saved together; they share the customer, invoice and date. */
export type PrescriptionFields = Omit<PrescriptionInput, "customerId" | "saleId" | "date">;

export type CreatePrescriptionResult =
  | { ok: true; id: string; date: string; attachedCustomer: boolean }
  | { ok: false; error: string };

export type CreatePrescriptionsResult =
  | { ok: true; ids: string[]; attachedCustomer: boolean }
  | { ok: false; error: string };

// Karachi is UTC+5 all year, so its calendar day is this simple.
const karachiDay = (d: Date) => new Date(d.getTime() + 5 * 3600_000).toISOString().slice(0, 10);

/**
 * When the prescription is dated: now for today's eye test; for an earlier
 * one, midday Karachi time on that day, well inside that day's records.
 * Null for a date that isn't one, or is still to come.
 */
function testDate(day: string | undefined): Date | null {
  const now = new Date();
  if (!day || day === karachiDay(now)) return now;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day > karachiDay(now)) return null;
  const at = new Date(`${day}T07:00:00.000Z`);
  return Number.isNaN(at.getTime()) ? null : at;
}

/**
 * Saves prescriptions for one customer, in the order given -- distance and
 * reading, or each person in a family. With `saleId` they go onto an invoice
 * that's already been rung up; if that invoice was a walk-in, the customer is
 * put on it too (the eye test is often when the name turns up).
 */
async function savePrescriptions(
  customerId: string, saleId: string | undefined, day: string | undefined, list: PrescriptionFields[],
): Promise<CreatePrescriptionsResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "You've been signed out — sign in again" };
  if (!customerId) return { ok: false, error: "Select or add the customer first" };
  if (list.length === 0) return { ok: false, error: "Type in the prescription first" };
  const date = testDate(day);
  if (!date) return { ok: false, error: "Check the date of the eye test — it can't be a day still to come" };

  const sale = saleId
    ? await db.sale.findUnique({ where: { id: saleId }, select: { id: true, total: true, date: true, customerId: true } })
    : null;
  if (saleId && !sale) return { ok: false, error: "That invoice no longer exists" };
  // An invoice already on someone else stays theirs -- moving it is done from
  // the invoice's own Edit, where the money side is handled too.
  if (sale?.customerId && sale.customerId !== customerId) {
    return { ok: false, error: "That invoice belongs to a different customer — change the customer from the invoice's Edit first" };
  }
  const attachCustomer = !!sale && !sale.customerId;

  const ids = await db.$transaction(async (tx) => {
    const made: string[] = [];
    // One at a time, so they keep the order they were typed in.
    for (const input of list) {
      const rx = await tx.prescription.create({
        data: {
          customerId,
          saleId: saleId || null,
          date,
          rightSph: input.rightSph, rightCyl: input.rightCyl, rightAxis: input.rightAxis, rightPd: input.rightPd, rightAdd: input.rightAdd,
          leftSph: input.leftSph, leftCyl: input.leftCyl, leftAxis: input.leftAxis, leftPd: input.leftPd, leftAdd: input.leftAdd,
          ...rxTextColumns(input),
          ...rxLensColumns(input),
          label: (input.label ?? "").trim(),
          notes: input.notes,
          isOwnPrescription: input.isOwnPrescription ?? false,
        },
      });
      made.push(rx.id);
    }
    if (attachCustomer) await attachCustomerToSale(tx, sale!, customerId);
    return made;
  });

  revalidatePath("/dashboard/prescriptions");
  revalidatePath(`/dashboard/customers/${customerId}`);
  revalidatePath("/dashboard/lab-orders");
  if (saleId) {
    revalidatePath("/dashboard/sales");
    if (attachCustomer) revalidatePath("/dashboard/customers");
  }
  return { ok: true, ids, attachedCustomer: attachCustomer };
}

/** Saves one prescription for a customer (see savePrescriptions). */
export async function createPrescription(input: PrescriptionInput): Promise<CreatePrescriptionResult> {
  const { customerId, saleId, date, ...fields } = input;
  const res = await savePrescriptions(customerId, saleId, date, [fields]);
  if (!res.ok) return res;
  const rx = await db.prescription.findUnique({ where: { id: res.ids[0] }, select: { date: true } });
  return { ok: true, id: res.ids[0], date: (rx?.date ?? new Date()).toISOString(), attachedCustomer: res.attachedCustomer };
}

/** Saves several prescriptions for one customer at once, in the order given. */
export async function createPrescriptions(input: {
  customerId: string;
  saleId?: string;
  date?: string;
  prescriptions: PrescriptionFields[];
}): Promise<CreatePrescriptionsResult> {
  return savePrescriptions(input.customerId, input.saleId, input.date, input.prescriptions);
}

/** One reading already on a customer's record, ready to load into a bill. */
export interface SavedReading {
  id: string;
  date: string;
  label: string;
  rightSph: number; rightCyl: number; rightAxis: number; rightPd: number; rightAdd: number;
  leftSph: number; leftCyl: number; leftAxis: number; leftPd: number; leftAdd: number;
  rightSphText: string; rightCylText: string; rightAddText: string;
  leftSphText: string; leftCylText: string; leftAddText: string;
  // A note hidden in the history stays hidden here too.
  notes: string;
  isOwn: boolean;
  // The invoice it's on, "" when it hasn't been put on one.
  invoiceNo: string;
}

/**
 * The readings on a customer's record, newest first, to pick one for a new bill
 * ("use an earlier reading"). Fetched when asked for rather than sent with the
 * whole customer list, which every till loads.
 */
export async function getCustomerReadings(customerId: string): Promise<SavedReading[]> {
  const session = await auth();
  if (!session?.user || !customerId) return [];
  const rows = await db.prescription.findMany({
    where: { customerId },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 15,
    include: { sale: { select: { invoiceNo: true } } },
  });
  return rxHistoryOrder(rows).map((r) => ({
    id: r.id,
    date: r.date.toISOString(),
    label: r.label,
    rightSph: r.rightSph, rightCyl: r.rightCyl, rightAxis: r.rightAxis, rightPd: r.rightPd, rightAdd: r.rightAdd,
    leftSph: r.leftSph, leftCyl: r.leftCyl, leftAxis: r.leftAxis, leftPd: r.leftPd, leftAdd: r.leftAdd,
    rightSphText: r.rightSphText, rightCylText: r.rightCylText, rightAddText: r.rightAddText,
    leftSphText: r.leftSphText, leftCylText: r.leftCylText, leftAddText: r.leftAddText,
    notes: r.notesHidden ? "" : r.notes,
    isOwn: r.isOwnPrescription,
    invoiceNo: r.sale?.invoiceNo ?? "",
  }));
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
      ...rxLensColumns(input),
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

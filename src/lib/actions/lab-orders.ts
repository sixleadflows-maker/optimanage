"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { nextDocumentNumber } from "@/lib/sales/core";
import { trashLabOrder, TrashError } from "@/lib/trash/snapshots";
import type { Prisma } from "@/generated/prisma/client";
import { rxLensColumns, rxSummary, rxTextColumns } from "@/lib/utils/rx";
import type { PrescriptionFields } from "@/lib/actions/prescriptions";

const STATUS_ORDER = ["ORDERED", "IN_PROGRESS", "RECEIVED", "FITTED"] as const;
type LabStatus = (typeof STATUS_ORDER)[number];

async function requireAuth() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
}

export interface LabOrderInput {
  customerId: string;
  labId: string;
  lensType: string;
  // The prescription in words -- used as it is when no saved prescription is
  // picked or typed in (an old order, or a slip the lab only needs a line of).
  prescription: string;
  // One of the customer's saved prescriptions, for the lab to make up.
  rxId?: string | null;
  // Or a new one typed in with the order; it goes onto the customer's record too.
  newRx?: PrescriptionFields | null;
  price: number;
  expectedDate: string;
  notes: string;
}

class LabOrderError extends Error {}

/**
 * The prescription an order carries: a new one typed in with it (saved to the
 * customer's record), one already on file, or just words. The words are kept
 * either way, so the order still reads right if the prescription is deleted.
 */
async function orderRx(tx: Prisma.TransactionClient, input: LabOrderInput) {
  let rxId = input.rxId || null;
  if (input.newRx) {
    const r = input.newRx;
    const made = await tx.prescription.create({
      data: {
        customerId: input.customerId,
        rightSph: r.rightSph, rightCyl: r.rightCyl, rightAxis: r.rightAxis, rightPd: r.rightPd, rightAdd: r.rightAdd,
        leftSph: r.leftSph, leftCyl: r.leftCyl, leftAxis: r.leftAxis, leftPd: r.leftPd, leftAdd: r.leftAdd,
        ...rxTextColumns(r),
        ...rxLensColumns(r),
        label: (r.label ?? "").trim(),
        notes: r.notes,
        isOwnPrescription: r.isOwnPrescription ?? false,
      },
    });
    rxId = made.id;
  }
  if (!rxId) return { rxId: null, prescription: input.prescription.trim() };
  const rx = await tx.prescription.findUnique({ where: { id: rxId } });
  if (!rx || rx.customerId !== input.customerId) {
    throw new LabOrderError("That prescription isn't on this customer's record any more — pick another or type it in");
  }
  return { rxId, prescription: `${rx.label.trim() ? `${rx.label.trim()}: ` : ""}${rxSummary(rx)}` };
}

export async function createLabOrder(input: LabOrderInput) {
  const session = await auth();
  if (!session?.user) return { ok: false as const, error: "You've been signed out — sign in again" };
  if (!input.customerId) return { ok: false as const, error: "Select a customer" };
  if (!input.labId) return { ok: false as const, error: "Select a lab" };

  // From the stored counter: lab orders can now be deleted and restored, so a
  // count would hand out a number that's still in use (or in the trash).
  const orderNo = await nextDocumentNumber(db, "LAB", async (startsWith) =>
    (await db.labOrder.findMany({ where: { orderNo: { startsWith } }, select: { orderNo: true } })).map((o) => o.orderNo)
  );

  try {
    await db.$transaction(async (tx) => {
      const rx = await orderRx(tx, input);
      await tx.labOrder.create({
        data: {
          orderNo,
          customerId: input.customerId,
          labId: input.labId,
          lensType: input.lensType,
          prescription: rx.prescription,
          rxId: rx.rxId,
          price: input.price,
          expectedDate: input.expectedDate ? new Date(input.expectedDate) : null,
          notes: input.notes,
        },
      });
    });
  } catch (e) {
    if (e instanceof LabOrderError) return { ok: false as const, error: e.message };
    throw e;
  }
  revalidatePath("/dashboard/lab-orders");
  if (input.newRx) {
    revalidatePath("/dashboard/prescriptions");
    revalidatePath(`/dashboard/customers/${input.customerId}`);
  }
  return { ok: true as const, orderNo };
}

export async function advanceLabStatus(id: string) {
  await requireAuth();
  const order = await db.labOrder.findUnique({ where: { id } });
  if (!order) throw new Error("Lab order not found");
  const idx = STATUS_ORDER.indexOf(order.status as LabStatus);
  if (idx < 0 || idx >= STATUS_ORDER.length - 1) return { ok: true };
  const next = STATUS_ORDER[idx + 1];
  await db.labOrder.update({ where: { id }, data: { status: next } });
  revalidatePath("/dashboard/lab-orders");
  return { ok: true, status: next };
}

export async function updateLabOrder(id: string, input: LabOrderInput) {
  await requireAuth();
  if (!input.customerId) return { ok: false as const, error: "Select a customer" };
  if (!input.labId) return { ok: false as const, error: "Select a lab" };
  try {
    const updated = await db.$transaction(async (tx) => {
      if (!(await tx.labOrder.findUnique({ where: { id }, select: { id: true } }))) return 0;
      const rx = await orderRx(tx, input);
      await tx.labOrder.update({
        where: { id },
        data: {
          customerId: input.customerId,
          labId: input.labId,
          lensType: input.lensType,
          prescription: rx.prescription,
          rxId: rx.rxId,
          price: input.price,
          expectedDate: input.expectedDate ? new Date(input.expectedDate) : null,
          notes: input.notes,
        },
      });
      return 1;
    });
    if (updated === 0) return { ok: false as const, error: "This lab order has been deleted" };
  } catch (e) {
    if (e instanceof LabOrderError) return { ok: false as const, error: e.message };
    throw e;
  }
  revalidatePath("/dashboard/lab-orders");
  if (input.newRx) {
    revalidatePath("/dashboard/prescriptions");
    revalidatePath(`/dashboard/customers/${input.customerId}`);
  }
  return { ok: true as const };
}

// To the trash (restorable for 30 days), not gone for good.
export async function deleteLabOrder(id: string) {
  const session = await auth();
  if (!session?.user) return { ok: false as const, error: "You've been signed out — sign in again" };
  if (session.user.role === "CASHIER") return { ok: false as const, error: "Only managers and owners can delete a lab order" };
  try {
    await trashLabOrder(id, session.user.id);
  } catch (e) {
    if (e instanceof TrashError) return { ok: false as const, error: e.message };
    throw e;
  }
  revalidatePath("/dashboard/lab-orders");
  revalidatePath("/dashboard/trash");
  return { ok: true as const };
}

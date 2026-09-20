"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { nextDocumentNumber } from "@/lib/sales/core";
import { trashLabOrder, TrashError } from "@/lib/trash/snapshots";

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
  prescription: string;
  price: number;
  expectedDate: string;
  notes: string;
}

export async function createLabOrder(input: LabOrderInput) {
  await requireAuth();
  if (!input.customerId) throw new Error("Select a customer");
  if (!input.labId) throw new Error("Select a lab");

  // From the stored counter: lab orders can now be deleted and restored, so a
  // count would hand out a number that's still in use (or in the trash).
  const orderNo = await nextDocumentNumber(db, "LAB", async (startsWith) =>
    (await db.labOrder.findMany({ where: { orderNo: { startsWith } }, select: { orderNo: true } })).map((o) => o.orderNo)
  );

  await db.labOrder.create({
    data: {
      orderNo,
      customerId: input.customerId,
      labId: input.labId,
      lensType: input.lensType,
      prescription: input.prescription,
      price: input.price,
      expectedDate: input.expectedDate ? new Date(input.expectedDate) : null,
      notes: input.notes,
    },
  });
  revalidatePath("/dashboard/lab-orders");
  return { ok: true, orderNo };
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
  const updated = await db.labOrder.updateMany({
    where: { id },
    data: {
      customerId: input.customerId,
      labId: input.labId,
      lensType: input.lensType,
      prescription: input.prescription,
      price: input.price,
      expectedDate: input.expectedDate ? new Date(input.expectedDate) : null,
      notes: input.notes,
    },
  });
  if (updated.count === 0) return { ok: false as const, error: "This lab order has been deleted" };
  revalidatePath("/dashboard/lab-orders");
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

"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

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

  const year = new Date().getFullYear();
  const count = await db.labOrder.count({ where: { orderNo: { startsWith: `LAB-${year}-` } } });
  const orderNo = `LAB-${year}-${String(count + 1).padStart(3, "0")}`;

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

"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { trashPrescription, TrashError } from "@/lib/trash/snapshots";

export interface PrescriptionInput {
  customerId: string;
  rightSph: number; rightCyl: number; rightAxis: number; rightPd: number; rightAdd: number;
  leftSph: number; leftCyl: number; leftAxis: number; leftPd: number; leftAdd: number;
  notes: string;
  isOwnPrescription?: boolean;
}

export async function createPrescription(input: PrescriptionInput) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!input.customerId) throw new Error("Select a customer");

  const created = await db.prescription.create({
    data: {
      customerId: input.customerId,
      rightSph: input.rightSph, rightCyl: input.rightCyl, rightAxis: input.rightAxis, rightPd: input.rightPd, rightAdd: input.rightAdd,
      leftSph: input.leftSph, leftCyl: input.leftCyl, leftAxis: input.leftAxis, leftPd: input.leftPd, leftAdd: input.leftAdd,
      notes: input.notes,
      isOwnPrescription: input.isOwnPrescription ?? false,
    },
  });
  revalidatePath("/dashboard/prescriptions");
  revalidatePath(`/dashboard/customers/${input.customerId}`);
  return { ok: true, id: created.id, date: created.date.toISOString() };
}

export async function updatePrescription(id: string, input: Omit<PrescriptionInput, "customerId">) {
  const session = await auth();
  if (!session?.user) return { ok: false as const, error: "You've been signed out — sign in again" };
  const updated = await db.prescription.updateMany({
    where: { id },
    data: {
      rightSph: input.rightSph, rightCyl: input.rightCyl, rightAxis: input.rightAxis, rightPd: input.rightPd, rightAdd: input.rightAdd,
      leftSph: input.leftSph, leftCyl: input.leftCyl, leftAxis: input.leftAxis, leftPd: input.leftPd, leftAdd: input.leftAdd,
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

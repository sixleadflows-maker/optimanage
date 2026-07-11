"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

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

  await db.prescription.create({
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
  return { ok: true };
}

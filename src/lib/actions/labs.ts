"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

async function requireAuth() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
}

export interface LabInput {
  name: string;
  contact: string;
  phone: string;
  email: string;
  address: string;
}

export async function createLab(input: LabInput) {
  await requireAuth();
  if (!input.name.trim()) throw new Error("Lab name is required");
  const lab = await db.lab.create({ data: input });
  revalidatePath("/dashboard/lab-orders");
  return { ok: true, id: lab.id };
}

export async function updateLab(id: string, input: LabInput) {
  await requireAuth();
  if (!input.name.trim()) throw new Error("Lab name is required");
  await db.lab.update({ where: { id }, data: input });
  revalidatePath("/dashboard/lab-orders");
  return { ok: true };
}

export async function deleteLab(id: string) {
  await requireAuth();
  await db.lab.update({ where: { id }, data: { active: false } });
  revalidatePath("/dashboard/lab-orders");
  return { ok: true };
}

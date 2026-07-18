"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

// Location management affects branch-based reporting and staff assignment,
// so it sits at the same "canManage" tier as general shop settings -- open
// to Owner + Manager, not Cashiers.
async function requireManager() {
  const session = await auth();
  if (!session?.user || session.user.role === "CASHIER") throw new Error("Only managers and owners can manage locations");
}

export interface BranchInput {
  name: string;
  address: string;
  phone: string;
}

export async function createBranch(input: BranchInput) {
  await requireManager();
  if (!input.name.trim()) throw new Error("Location name is required");
  await db.branch.create({ data: input });
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updateBranch(id: string, input: BranchInput) {
  await requireManager();
  if (!input.name.trim()) throw new Error("Location name is required");
  await db.branch.update({ where: { id }, data: input });
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function setBranchActive(id: string, active: boolean) {
  await requireManager();
  await db.branch.update({ where: { id }, data: { active } });
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
  return { ok: true };
}

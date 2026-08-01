"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { TRASH_RETENTION_DAYS, type TrashKind } from "@/lib/constants";

async function requireManager() {
  const session = await auth();
  if (!session?.user || session.user.role === "CASHIER") {
    throw new Error("Only managers and owners can use the trash");
  }
  return session;
}

/**
 * Puts an item back. Deliberately refuses once the retention window has passed,
 * so "restorable for 30 days" means exactly that rather than being advisory.
 */
export async function restoreItem(kind: TrashKind, id: string) {
  const session = await requireManager();

  const cutoff = new Date(Date.now() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const stillRestorable = (deletedAt: Date | null) => !deletedAt || deletedAt > cutoff;

  if (kind === "product") {
    const row = await db.product.findUnique({ where: { id } });
    if (!row) throw new Error("That item is no longer in the trash");
    if (!stillRestorable(row.deletedAt)) throw new Error("This was deleted over 30 days ago and can no longer be restored");
    await db.product.update({ where: { id }, data: { active: true, deletedAt: null } });
    revalidatePath("/dashboard/inventory");
  } else if (kind === "location") {
    const row = await db.branch.findUnique({ where: { id } });
    if (!row) throw new Error("That location is no longer in the trash");
    if (!stillRestorable(row.deletedAt)) throw new Error("This was deleted over 30 days ago and can no longer be restored");
    await db.branch.update({ where: { id }, data: { active: true, deletedAt: null } });
    revalidatePath("/dashboard/settings");
  } else {
    // Only an owner can bring a staff account back, since restoring one hands
    // back access to the system.
    if (session.user.role !== "OWNER") throw new Error("Only the owner can restore a staff account");
    const row = await db.user.findUnique({ where: { id } });
    if (!row) throw new Error("That account is no longer in the trash");
    if (!stillRestorable(row.deletedAt)) throw new Error("This was deleted over 30 days ago and can no longer be restored");
    await db.user.update({ where: { id }, data: { active: true, deletedAt: null } });
    revalidatePath("/dashboard/settings");
  }

  revalidatePath("/dashboard/trash");
  return { ok: true };
}

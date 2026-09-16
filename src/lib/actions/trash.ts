"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { TRASH_RETENTION_DAYS, type TrashKind } from "@/lib/constants";

const TOO_OLD = "This was deleted over 30 days ago and can no longer be restored";

/**
 * Puts an item back. Deliberately refuses once the retention window has passed,
 * so "restorable for 30 days" means exactly that rather than being advisory.
 *
 * Refusals come back as { ok: false, error } rather than being thrown, because
 * production replaces a thrown error's message with a generic one.
 */
export async function restoreItem(kind: TrashKind, id: string) {
  const session = await auth();
  if (!session?.user || session.user.role === "CASHIER") {
    return { ok: false as const, error: "Only managers and owners can use the trash" };
  }

  const cutoff = new Date(Date.now() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const stillRestorable = (deletedAt: Date | null) => !deletedAt || deletedAt > cutoff;

  if (kind === "product") {
    const row = await db.product.findUnique({ where: { id } });
    if (!row) return { ok: false as const, error: "That item is no longer in the trash" };
    if (!stillRestorable(row.deletedAt)) return { ok: false as const, error: TOO_OLD };
    await db.product.update({ where: { id }, data: { active: true, deletedAt: null } });
    revalidatePath("/dashboard/inventory");
  } else if (kind === "customer") {
    const row = await db.customer.findUnique({ where: { id } });
    if (!row) return { ok: false as const, error: "That customer is no longer in the trash" };
    if (!stillRestorable(row.deletedAt)) return { ok: false as const, error: TOO_OLD };
    await db.customer.update({ where: { id }, data: { active: true, deletedAt: null } });
    revalidatePath("/dashboard/customers");
    revalidatePath("/dashboard/pos");
  } else if (kind === "location") {
    const row = await db.branch.findUnique({ where: { id } });
    if (!row) return { ok: false as const, error: "That location is no longer in the trash" };
    if (!stillRestorable(row.deletedAt)) return { ok: false as const, error: TOO_OLD };
    await db.branch.update({ where: { id }, data: { active: true, deletedAt: null } });
    revalidatePath("/dashboard/settings");
  } else {
    // Only an owner can bring a staff account back, since restoring one hands
    // back access to the system.
    if (session.user.role !== "OWNER") return { ok: false as const, error: "Only the owner can restore a staff account" };
    const row = await db.user.findUnique({ where: { id } });
    if (!row) return { ok: false as const, error: "That account is no longer in the trash" };
    if (!stillRestorable(row.deletedAt)) return { ok: false as const, error: TOO_OLD };
    await db.user.update({ where: { id }, data: { active: true, deletedAt: null } });
    revalidatePath("/dashboard/settings");
  }

  revalidatePath("/dashboard/trash");
  return { ok: true as const };
}

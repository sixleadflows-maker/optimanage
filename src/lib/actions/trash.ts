"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { SNAPSHOT_TRASH_KINDS, TRASH_PURGED_AT, TRASH_RETENTION_DAYS, type SnapshotTrashKind, type TrashKind } from "@/lib/constants";
import { restoreSnapshot, TrashError } from "@/lib/trash/snapshots";

const TOO_OLD = "This was deleted over 30 days ago and can no longer be restored";

const PURGED = TRASH_PURGED_AT;

const isSnapshot = (kind: TrashKind): kind is SnapshotTrashKind =>
  (SNAPSHOT_TRASH_KINDS as readonly string[]).includes(kind);

// Pages that list each kind of record, so a restore shows up straight away.
const PAGES: Record<TrashKind, string[]> = {
  product: ["/dashboard/inventory", "/dashboard/pos"],
  customer: ["/dashboard/customers", "/dashboard/pos"],
  location: ["/dashboard/settings"],
  staff: ["/dashboard/settings"],
  supplier: ["/dashboard/suppliers"],
  lab: ["/dashboard/lab-orders"],
  invoice: ["/dashboard", "/dashboard/sales", "/dashboard/inventory", "/dashboard/customers", "/dashboard/cash"],
  return: ["/dashboard/sales", "/dashboard/inventory"],
  expense: ["/dashboard/expenses", "/dashboard/cash"],
  prescription: ["/dashboard/prescriptions", "/dashboard/customers"],
  labOrder: ["/dashboard/lab-orders"],
  purchaseOrder: ["/dashboard/suppliers"],
  stockAdjustment: ["/dashboard/stock-adjustments", "/dashboard/inventory"],
  payment: ["/dashboard", "/dashboard/sales", "/dashboard/customers", "/dashboard/cash"],
};

function refresh(kind: TrashKind) {
  for (const path of PAGES[kind]) revalidatePath(path);
  revalidatePath("/dashboard/trash");
}

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
  const back = { active: true, deletedAt: null };

  if (isSnapshot(kind)) {
    const entry = await db.trashEntry.findUnique({ where: { id } });
    if (!entry) return { ok: false as const, error: "That item is no longer in the trash" };
    if (!stillRestorable(entry.deletedAt)) return { ok: false as const, error: TOO_OLD };
    // Bringing back an invoice puts money back into the day's takings -- the
    // same tier as deleting one.
    if (kind === "invoice" && session.user.role !== "OWNER") {
      return { ok: false as const, error: "Only the owner can restore an invoice" };
    }
    try {
      await restoreSnapshot(id);
    } catch (e) {
      if (e instanceof TrashError) return { ok: false as const, error: e.message };
      throw e;
    }
  } else if (kind === "product") {
    const row = await db.product.findUnique({ where: { id } });
    if (!row) return { ok: false as const, error: "That item is no longer in the trash" };
    if (!stillRestorable(row.deletedAt)) return { ok: false as const, error: TOO_OLD };
    await db.product.update({ where: { id }, data: back });
  } else if (kind === "customer") {
    const row = await db.customer.findUnique({ where: { id } });
    if (!row) return { ok: false as const, error: "That customer is no longer in the trash" };
    if (!stillRestorable(row.deletedAt)) return { ok: false as const, error: TOO_OLD };
    await db.customer.update({ where: { id }, data: back });
  } else if (kind === "location") {
    const row = await db.branch.findUnique({ where: { id } });
    if (!row) return { ok: false as const, error: "That location is no longer in the trash" };
    if (!stillRestorable(row.deletedAt)) return { ok: false as const, error: TOO_OLD };
    await db.branch.update({ where: { id }, data: back });
  } else if (kind === "supplier") {
    const row = await db.supplier.findUnique({ where: { id } });
    if (!row) return { ok: false as const, error: "That supplier is no longer in the trash" };
    if (!stillRestorable(row.deletedAt)) return { ok: false as const, error: TOO_OLD };
    await db.supplier.update({ where: { id }, data: back });
  } else if (kind === "lab") {
    const row = await db.lab.findUnique({ where: { id } });
    if (!row) return { ok: false as const, error: "That lab is no longer in the trash" };
    if (!stillRestorable(row.deletedAt)) return { ok: false as const, error: TOO_OLD };
    await db.lab.update({ where: { id }, data: back });
  } else {
    // Only an owner can bring a staff account back, since restoring one hands
    // back access to the system.
    if (session.user.role !== "OWNER") return { ok: false as const, error: "Only the owner can restore a staff account" };
    const row = await db.user.findUnique({ where: { id } });
    if (!row) return { ok: false as const, error: "That account is no longer in the trash" };
    if (!stillRestorable(row.deletedAt)) return { ok: false as const, error: TOO_OLD };
    await db.user.update({ where: { id }, data: back });
  }

  refresh(kind);
  return { ok: true as const };
}

async function purge(kind: TrashKind, id: string) {
  if (isSnapshot(kind)) {
    await db.trashEntry.deleteMany({ where: { id } });
    return;
  }
  const hidden = { active: false, deletedAt: PURGED };
  const where = { id, active: false };
  if (kind === "product") await db.product.updateMany({ where, data: hidden });
  else if (kind === "customer") await db.customer.updateMany({ where, data: hidden });
  else if (kind === "location") await db.branch.updateMany({ where, data: hidden });
  else if (kind === "supplier") await db.supplier.updateMany({ where, data: hidden });
  else if (kind === "lab") await db.lab.updateMany({ where, data: hidden });
  else await db.user.updateMany({ where, data: hidden });
}

/** Deletes one item for good. Owner only; the page confirms first. */
export async function purgeItem(kind: TrashKind, id: string) {
  const session = await auth();
  if (session?.user?.role !== "OWNER") {
    return { ok: false as const, error: "Only the owner can delete something permanently" };
  }
  await purge(kind, id);
  revalidatePath("/dashboard/trash");
  return { ok: true as const };
}

/** Deletes everything in the trash for good. Owner only, typed confirmation on the page. */
export async function emptyTrash() {
  const session = await auth();
  if (session?.user?.role !== "OWNER") {
    return { ok: false as const, error: "Only the owner can empty the trash" };
  }
  const hidden = { deletedAt: PURGED };
  const inTrash = { active: false, OR: [{ deletedAt: null }, { deletedAt: { gt: PURGED } }] };
  const results = await db.$transaction([
    db.trashEntry.deleteMany({}),
    db.product.updateMany({ where: inTrash, data: hidden }),
    db.customer.updateMany({ where: inTrash, data: hidden }),
    db.branch.updateMany({ where: inTrash, data: hidden }),
    db.supplier.updateMany({ where: inTrash, data: hidden }),
    db.lab.updateMany({ where: inTrash, data: hidden }),
    db.user.updateMany({ where: inTrash, data: hidden }),
  ]);
  revalidatePath("/dashboard/trash");
  return { ok: true as const, removed: results.reduce((sum, r) => sum + r.count, 0) };
}

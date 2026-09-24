"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { nextDocumentNumber } from "@/lib/sales/core";
import { trashPurchaseOrder, TrashError } from "@/lib/trash/snapshots";

async function requireAuth() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  return session;
}

export interface SupplierInput {
  name: string;
  contact: string;
  phone: string;
  email: string;
  address: string;
  ntn: string;
}

export async function createSupplier(input: SupplierInput) {
  await requireAuth();
  if (!input.name.trim()) throw new Error("Supplier name is required");
  const supplier = await db.supplier.create({ data: input });
  revalidatePath("/dashboard/suppliers");
  return { ok: true, id: supplier.id };
}

export async function updateSupplier(id: string, input: SupplierInput) {
  await requireAuth();
  if (!input.name.trim()) throw new Error("Supplier name is required");
  await db.supplier.update({ where: { id }, data: input });
  revalidatePath("/dashboard/suppliers");
  return { ok: true };
}

// Hidden, not erased: past purchase orders keep the supplier's name, and the
// trash can bring it back for 30 days.
export async function deleteSupplier(id: string) {
  const session = await requireAuth();
  if (session.user.role === "CASHIER") return { ok: false as const, error: "Only managers and owners can delete a supplier" };
  await db.supplier.update({ where: { id }, data: { active: false, deletedAt: new Date() } });
  revalidatePath("/dashboard/suppliers");
  revalidatePath("/dashboard/trash");
  return { ok: true as const };
}

// Only an order nothing has been received against; see trashPurchaseOrder.
export async function deletePurchaseOrder(id: string) {
  const session = await requireAuth();
  if (session.user.role === "CASHIER") return { ok: false as const, error: "Only managers and owners can delete a purchase order" };
  try {
    await trashPurchaseOrder(id, session.user.id);
  } catch (e) {
    if (e instanceof TrashError) return { ok: false as const, error: e.message };
    throw e;
  }
  revalidatePath("/dashboard/suppliers");
  revalidatePath("/dashboard/trash");
  return { ok: true as const };
}

export interface POItemInput {
  // Correcting an order: the line this already is, so it's changed in place.
  id?: string;
  // Left out for an item that isn't in the inventory yet.
  productId?: string;
  name?: string;
  description?: string;
  quantity: number;
  unitCost: number;
}

// Everything about an order other than its items -- editable after the order
// is placed too, since payment often happens on or after delivery.
export interface PODetailsInput {
  supplierInvoiceNo: string;
  date: string;
  expectedDate: string;
  notes: string;
  purchaseType: string;
  purchaseTypeNote: string;
  paymentMethod: string;
  paymentReference: string;
  bankName: string;
  paymentDate: string;
  amountPaid: number;
  // A cheque handed to the supplier only comes off the balance once it clears.
  chequeCleared: boolean;
  chequeClearedDate: string;
}

export interface CreatePOInput extends PODetailsInput {
  supplierId: string;
  items: POItemInput[];
}

// A date input gives "YYYY-MM-DD"; blank means "not set".
const toDate = (value: string) => (value ? new Date(value) : null);

function detailsData(input: PODetailsInput) {
  return {
    supplierInvoiceNo: input.supplierInvoiceNo.trim(),
    expectedDate: toDate(input.expectedDate),
    notes: input.notes.trim(),
    purchaseType: input.purchaseType || "Cash",
    purchaseTypeNote: input.purchaseType === "Other" ? input.purchaseTypeNote.trim() : "",
    paymentMethod: input.paymentMethod,
    paymentReference: input.paymentReference.trim(),
    bankName: input.bankName.trim(),
    paymentDate: toDate(input.paymentDate),
    amountPaid: Math.max(0, Number(input.amountPaid) || 0),
    // Only a cheque can be waiting to clear; anything else is money gone already.
    chequeCleared: input.paymentMethod === "Cheque" ? !!input.chequeCleared : false,
    chequeClearedDate: input.paymentMethod === "Cheque" && input.chequeCleared ? toDate(input.chequeClearedDate) : null,
  };
}

/**
 * Ticks a cheque off as cleared (or back to waiting) from the order itself,
 * which is the whole job most days — the money has left the bank, so it now
 * comes off what's owed to the supplier.
 */
export async function setChequeCleared(poId: string, cleared: boolean, clearedDate?: string) {
  const session = await requireAuth();
  if (session.user.role === "CASHIER") return { ok: false as const, error: "Only managers and owners can change a purchase order" };

  const po = await db.purchaseOrder.findUnique({ where: { id: poId }, select: { paymentMethod: true } });
  if (!po) return { ok: false as const, error: "This purchase order no longer exists" };
  if (po.paymentMethod !== "Cheque") return { ok: false as const, error: "This order wasn't paid by cheque" };

  await db.purchaseOrder.update({
    where: { id: poId },
    data: { chequeCleared: cleared, chequeClearedDate: cleared ? toDate(clearedDate || "") ?? new Date() : null },
  });
  revalidatePath("/dashboard/suppliers");
  return { ok: true as const };
}

export async function createPurchaseOrder(input: CreatePOInput) {
  await requireAuth();
  if (!input.supplierId) return { ok: false as const, error: "Select a supplier" };
  if (input.items.length === 0) return { ok: false as const, error: "Add at least one item" };

  const productIds = input.items.flatMap((i) => (i.productId ? [i.productId] : []));
  const products = await db.product.findMany({ where: { id: { in: productIds } } });
  const productById = new Map(products.map((p) => [p.id, p]));

  const items = [];
  for (const i of input.items) {
    const quantity = Math.max(1, Math.floor(i.quantity));
    const unitCost = Math.max(0, i.unitCost);
    if (i.productId) {
      const p = productById.get(i.productId);
      if (!p) return { ok: false as const, error: "One of the products was deleted — remove it and add it again" };
      items.push({
        productId: i.productId,
        productName: `${p.brand} ${p.name}`.trim(),
        description: (i.description ?? "").trim(),
        quantity, unitCost, total: quantity * unitCost,
      });
    } else {
      const name = (i.name ?? "").trim();
      if (!name) return { ok: false as const, error: "Give each item that isn't in the inventory a name" };
      items.push({
        productId: null,
        productName: name,
        description: (i.description ?? "").trim(),
        quantity, unitCost, total: quantity * unitCost,
      });
    }
  }
  const total = items.reduce((sum, i) => sum + i.total, 0);

  // From the stored counter, which only moves forward: an order in the trash
  // keeps its number, so a new one can't take it and block the restore.
  const poNumber = await nextDocumentNumber(db, "PO", async (startsWith) =>
    (await db.purchaseOrder.findMany({ where: { poNumber: { startsWith } }, select: { poNumber: true } })).map((po) => po.poNumber)
  );

  const po = await db.purchaseOrder.create({
    data: {
      poNumber,
      supplierId: input.supplierId,
      total,
      status: "ORDERED",
      ...(input.date ? { date: new Date(input.date) } : {}),
      ...detailsData(input),
      items: { create: items },
    },
  });

  revalidatePath("/dashboard/suppliers");
  return { ok: true as const, id: po.id, poNumber };
}

export async function updatePurchaseOrderDetails(poId: string, input: PODetailsInput) {
  await requireAuth();
  const po = await db.purchaseOrder.findUnique({ where: { id: poId } });
  if (!po) return { ok: false as const, error: "This purchase order no longer exists" };
  await db.purchaseOrder.update({
    where: { id: poId },
    data: {
      ...(input.date ? { date: new Date(input.date) } : {}),
      ...detailsData(input),
    },
  });
  revalidatePath("/dashboard/suppliers");
  return { ok: true as const };
}

export interface ReceiveInput {
  itemId: string;
  quantityReceived: number;
}

export async function receiveStock(poId: string, receipts: ReceiveInput[]) {
  await requireAuth();
  const po = await db.purchaseOrder.findUnique({ where: { id: poId }, include: { items: true } });
  if (!po) throw new Error("Purchase order not found");

  const receiptByItem = new Map(receipts.map((r) => [r.itemId, r.quantityReceived]));

  for (const item of po.items) {
    const qty = receiptByItem.get(item.id) || 0;
    if (qty <= 0) continue;
    const capped = Math.min(qty, item.quantity - item.received);
    if (capped <= 0) continue;

    await db.purchaseOrderItem.update({
      where: { id: item.id },
      data: { received: { increment: capped } },
    });
    // An item that isn't in the inventory has no stock count to add to; it's
    // marked received here and added to the inventory as a product separately.
    if (item.productId) {
      await db.product.update({
        where: { id: item.productId },
        data: { stock: { increment: capped } },
      });
    }
  }

  const updatedItems = await db.purchaseOrderItem.findMany({ where: { orderId: poId } });
  const allReceived = updatedItems.every((i) => i.received >= i.quantity);
  const anyReceived = updatedItems.some((i) => i.received > 0);
  const status = allReceived ? "RECEIVED" : anyReceived ? "PARTIAL" : "ORDERED";

  await db.purchaseOrder.update({ where: { id: poId }, data: { status } });

  revalidatePath("/dashboard/suppliers");
  revalidatePath("/dashboard/inventory");
  return { ok: true, status };
}

/**
 * Corrects the lines on a purchase order, before or after stock has come in.
 * Lines are changed in place. One with stock already received against it
 * stays on the order, as the same item, with at least that many ordered --
 * those units are already on the shelf and in the stock count.
 */
export async function updatePurchaseOrderItems(poId: string, items: POItemInput[]) {
  const session = await requireAuth();
  if (session.user.role === "CASHIER") return { ok: false as const, error: "Only managers and owners can change a purchase order" };

  const po = await db.purchaseOrder.findUnique({ where: { id: poId }, include: { items: true } });
  if (!po) return { ok: false as const, error: "This purchase order has been deleted" };
  if (items.length === 0) return { ok: false as const, error: "A purchase order needs at least one item" };

  const existingById = new Map(po.items.map((i) => [i.id, i]));
  const keptIds = new Set<string>();
  const lineIdFor = items.map((i) => {
    if (!i.id || !existingById.has(i.id) || keptIds.has(i.id)) return null;
    keptIds.add(i.id);
    return i.id;
  });
  for (const line of po.items) {
    if (line.received <= 0) continue;
    const next = items[lineIdFor.indexOf(line.id)];
    if (!next) return { ok: false as const, error: `${line.productName} has ${line.received} received already, so it stays on the order` };
    if ((next.productId || null) !== (line.productId || null)) {
      return { ok: false as const, error: `${line.productName} has stock received already, so it can't be swapped for another item` };
    }
    if (Math.floor(next.quantity) < line.received) {
      return { ok: false as const, error: `${line.productName} can't go below the ${line.received} already received` };
    }
  }

  const productIds = items.flatMap((i) => (i.productId ? [i.productId] : []));
  const products = await db.product.findMany({ where: { id: { in: productIds } }, select: { id: true, brand: true, name: true } });
  const nameById = new Map(products.map((p) => [p.id, [p.brand, p.name].map((t) => t.trim()).filter(Boolean).join(" ")]));

  const lines = items.map((i) => {
    const quantity = Math.max(1, Math.floor(i.quantity));
    const unitCost = Math.max(0, i.unitCost);
    return {
      productId: i.productId || null,
      productName: i.productId ? nameById.get(i.productId) ?? i.name ?? "" : (i.name ?? "").trim(),
      description: i.description ?? "",
      quantity,
      unitCost,
      total: quantity * unitCost,
    };
  });
  if (lines.some((l) => !l.productName)) return { ok: false as const, error: "Give every typed-in item a name" };

  // Where the order stands once quantities change: ordering fewer can finish it.
  const receivedFor = (idx: number) => existingById.get(lineIdFor[idx] ?? "")?.received ?? 0;
  const allReceived = lines.every((l, idx) => receivedFor(idx) >= l.quantity);
  const anyReceived = lines.some((_, idx) => receivedFor(idx) > 0);

  await db.$transaction(async (tx) => {
    await tx.purchaseOrderItem.deleteMany({ where: { orderId: poId, id: { notIn: [...keptIds] } } });
    for (const [idx, line] of lines.entries()) {
      const id = lineIdFor[idx];
      if (id) await tx.purchaseOrderItem.update({ where: { id }, data: line });
      else await tx.purchaseOrderItem.create({ data: { ...line, orderId: poId, received: 0 } });
    }
    await tx.purchaseOrder.update({
      where: { id: poId },
      data: {
        total: lines.reduce((sum, l) => sum + l.total, 0),
        ...(anyReceived ? { status: allReceived ? ("RECEIVED" as const) : ("PARTIAL" as const) } : {}),
      },
    });
  });

  revalidatePath("/dashboard/suppliers");
  return { ok: true as const };
}

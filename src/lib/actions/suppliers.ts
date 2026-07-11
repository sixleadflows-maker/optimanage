"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

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

export async function deleteSupplier(id: string) {
  await requireAuth();
  await db.supplier.update({ where: { id }, data: { active: false } });
  revalidatePath("/dashboard/suppliers");
  return { ok: true };
}

export interface POItemInput {
  productId: string;
  quantity: number;
  unitCost: number;
}

export interface CreatePOInput {
  supplierId: string;
  items: POItemInput[];
}

export async function createPurchaseOrder(input: CreatePOInput) {
  await requireAuth();
  if (!input.supplierId) throw new Error("Select a supplier");
  if (input.items.length === 0) throw new Error("Add at least one item");

  const products = await db.product.findMany({ where: { id: { in: input.items.map((i) => i.productId) } } });
  const productById = new Map(products.map((p) => [p.id, p]));

  const year = new Date().getFullYear();
  const countThisYear = await db.purchaseOrder.count({ where: { poNumber: { startsWith: `PO-${year}-` } } });
  const poNumber = `PO-${year}-${String(countThisYear + 1).padStart(3, "0")}`;

  const items = input.items.map((i) => {
    const p = productById.get(i.productId);
    if (!p) throw new Error(`Product not found: ${i.productId}`);
    return {
      productId: i.productId,
      productName: p.name,
      quantity: i.quantity,
      unitCost: i.unitCost,
      total: i.quantity * i.unitCost,
    };
  });
  const total = items.reduce((sum, i) => sum + i.total, 0);

  const po = await db.purchaseOrder.create({
    data: {
      poNumber,
      supplierId: input.supplierId,
      total,
      status: "ORDERED",
      items: { create: items },
    },
  });

  revalidatePath("/dashboard/suppliers");
  return { ok: true, id: po.id, poNumber };
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
    await db.product.update({
      where: { id: item.productId },
      data: { stock: { increment: capped } },
    });
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

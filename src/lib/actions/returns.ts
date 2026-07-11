"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export interface ReturnItemInput {
  saleItemId: string;
  quantity: number;
}

export interface CreateReturnInput {
  saleId: string;
  items: ReturnItemInput[];
  reason: string;
  refundMethod: string;
}

export async function createReturn(input: CreateReturnInput) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (input.items.length === 0) throw new Error("Select at least one item to return");

  const sale = await db.sale.findUnique({ where: { id: input.saleId }, include: { items: true } });
  if (!sale) throw new Error("Sale not found");

  const saleItemById = new Map(sale.items.map((i) => [i.id, i]));

  const lines = input.items.map((r) => {
    const saleItem = saleItemById.get(r.saleItemId);
    if (!saleItem) throw new Error("Sale item not found");
    const remaining = saleItem.quantity - saleItem.returnedQuantity;
    if (r.quantity <= 0 || r.quantity > remaining) {
      throw new Error(`Cannot return ${r.quantity} of "${saleItem.productName}" — only ${remaining} eligible`);
    }
    return {
      saleItem,
      quantity: r.quantity,
      total: r.quantity * saleItem.unitPrice,
    };
  });

  const totalRefund = lines.reduce((sum, l) => sum + l.total, 0);

  const year = new Date().getFullYear();
  const countThisYear = await db.return.count({ where: { returnNo: { startsWith: `RET-${year}-` } } });
  const returnNo = `RET-${year}-${String(countThisYear + 1).padStart(3, "0")}`;

  const created = await db.return.create({
    data: {
      returnNo,
      saleId: input.saleId,
      reason: input.reason,
      refundMethod: input.refundMethod,
      totalRefund,
      processedById: session.user.id,
      items: {
        create: lines.map((l) => ({
          saleItemId: l.saleItem.id,
          productId: l.saleItem.productId,
          productName: l.saleItem.productName,
          quantity: l.quantity,
          unitPrice: l.saleItem.unitPrice,
          total: l.total,
        })),
      },
    },
  });

  for (const l of lines) {
    await db.saleItem.update({
      where: { id: l.saleItem.id },
      data: { returnedQuantity: { increment: l.quantity } },
    });
    await db.product.update({
      where: { id: l.saleItem.productId },
      data: { stock: { increment: l.quantity } },
    });
  }

  revalidatePath("/dashboard/sales");
  revalidatePath("/dashboard/inventory");
  return { ok: true, returnNo, totalRefund };
}

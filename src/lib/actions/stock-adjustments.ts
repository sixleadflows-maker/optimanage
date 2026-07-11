"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export interface CreateAdjustmentInput {
  productId: string;
  newStock: number;
  reason: string;
  notes: string;
}

export async function createStockAdjustment(input: CreateAdjustmentInput) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (input.newStock < 0) throw new Error("Stock cannot be negative");
  if (!input.reason) throw new Error("Select a reason");

  const product = await db.product.findUnique({ where: { id: input.productId } });
  if (!product) throw new Error("Product not found");

  const delta = input.newStock - product.stock;
  if (delta === 0) throw new Error("New count matches current stock — nothing to adjust");

  await db.$transaction([
    db.product.update({ where: { id: input.productId }, data: { stock: input.newStock } }),
    db.stockAdjustment.create({
      data: {
        productId: input.productId,
        productName: product.name,
        previousStock: product.stock,
        newStock: input.newStock,
        delta,
        reason: input.reason,
        notes: input.notes,
        adjustedById: session.user.id,
      },
    }),
  ]);

  revalidatePath("/dashboard/inventory/adjustments");
  revalidatePath("/dashboard/inventory");
  return { ok: true, delta };
}

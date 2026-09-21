"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { trashStockAdjustment, TrashError } from "@/lib/trash/snapshots";

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

/**
 * Corrects a stock change that was recorded wrongly. Changing the new count
 * moves the product's stock by the difference, so the shelf ends where this
 * adjustment now says it should.
 */
export async function updateStockAdjustment(id: string, input: { newStock?: number; reason?: string; notes?: string }) {
  const session = await auth();
  if (!session?.user) return { ok: false as const, error: "You've been signed out — sign in again" };
  if (session.user.role === "CASHIER") return { ok: false as const, error: "Only managers and owners can change a stock record" };

  const adjustment = await db.stockAdjustment.findUnique({ where: { id } });
  if (!adjustment) return { ok: false as const, error: "This stock change has been removed" };

  const newStock = input.newStock === undefined ? adjustment.newStock : Math.max(0, Math.floor(input.newStock));
  const delta = newStock - adjustment.previousStock;
  const move = delta - adjustment.delta;

  const product = await db.product.findUnique({ where: { id: adjustment.productId }, select: { stock: true } });
  if (product && product.stock + move < 0) {
    return { ok: false as const, error: `That would put ${adjustment.productName} below zero in stock` };
  }

  await db.$transaction(async (tx) => {
    if (move !== 0) await tx.product.update({ where: { id: adjustment.productId }, data: { stock: { increment: move } } });
    await tx.stockAdjustment.update({
      where: { id },
      data: { newStock, delta, reason: input.reason ?? adjustment.reason, notes: input.notes ?? adjustment.notes },
    });
  });

  revalidatePath("/dashboard/stock-adjustments");
  revalidatePath("/dashboard/inventory");
  return { ok: true as const };
}

// To the trash (restorable for 30 days); the count goes back to what it was.
export async function deleteStockAdjustment(id: string) {
  const session = await auth();
  if (!session?.user) return { ok: false as const, error: "You've been signed out — sign in again" };
  if (session.user.role === "CASHIER") return { ok: false as const, error: "Only managers and owners can remove a stock record" };
  try {
    await trashStockAdjustment(id, session.user.id);
  } catch (e) {
    if (e instanceof TrashError) return { ok: false as const, error: e.message };
    throw e;
  }
  revalidatePath("/dashboard/stock-adjustments");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/trash");
  return { ok: true as const };
}

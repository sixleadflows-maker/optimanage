"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { trashReturn, TrashError } from "@/lib/trash/snapshots";
import { nextDocumentNumber } from "@/lib/sales/core";
import { cashDayLabel, cashRs, syncCashCloses } from "@/lib/cash/closes";
import { PAYMENT_METHODS } from "@/lib/constants";

// A return that couldn't be saved for a reason staff can act on.
class ReturnRefused extends Error {}

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
  if (!session?.user) return { ok: false as const, error: "You've been signed out — sign in again" };
  if (input.items.length === 0) return { ok: false as const, error: "Select at least one item to return" };
  if (!(PAYMENT_METHODS as readonly string[]).includes(input.refundMethod)) {
    return { ok: false as const, error: "Pick how the refund was handed back" };
  }

  const sale = await db.sale.findUnique({ where: { id: input.saleId }, include: { items: true } });
  if (!sale) return { ok: false as const, error: "This invoice has been deleted" };

  const saleItemById = new Map(sale.items.map((i) => [i.id, i]));

  const lines: { saleItem: (typeof sale.items)[number]; quantity: number; total: number }[] = [];
  for (const r of input.items) {
    const saleItem = saleItemById.get(r.saleItemId);
    if (!saleItem) return { ok: false as const, error: "An item being returned is no longer on the invoice — refresh and try again" };
    const remaining = saleItem.quantity - saleItem.returnedQuantity;
    if (!(r.quantity > 0) || r.quantity > remaining) {
      return { ok: false as const, error: `Cannot return ${r.quantity} of "${saleItem.productName}" — only ${remaining} eligible` };
    }
    lines.push({ saleItem, quantity: r.quantity, total: r.quantity * saleItem.unitPrice });
  }

  const totalRefund = lines.reduce((sum, l) => sum + l.total, 0);

  // From the stored counter, not a count of returns -- deleting an invoice
  // deletes its returns too, and a count would then reuse a number.
  const returnNo = await nextDocumentNumber(db, "RET", async (startsWith) =>
    (await db.return.findMany({ where: { returnNo: { startsWith } }, select: { returnNo: true } })).map((r) => r.returnNo)
  );

  // The return, its items coming off the invoice and going back on the shelf:
  // all of it or none.
  let created;
  try {
    created = await db.$transaction(async (tx) => {
      const ret = await tx.return.create({
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
              productId: l.saleItem.productId ?? "",
              productName: l.saleItem.productName,
              quantity: l.quantity,
              unitPrice: l.saleItem.unitPrice,
              total: l.total,
            })),
          },
        },
      });

      for (const l of lines) {
        // Only while that many are still unreturned -- two returns saved at once can't both take the last one.
        const marked = await tx.saleItem.updateMany({
          where: { id: l.saleItem.id, returnedQuantity: { lte: l.saleItem.quantity - l.quantity } },
          data: { returnedQuantity: { increment: l.quantity } },
        });
        if (marked.count === 0) throw new ReturnRefused(`"${l.saleItem.productName}" has just been returned on another screen — refresh and check`);
        // An item typed in at the till was never in stock, so nothing goes back on the shelf.
        if (l.saleItem.productId) {
          await tx.product.update({
            where: { id: l.saleItem.productId },
            data: { stock: { increment: l.quantity } },
          });
        }
      }
      return ret;
    }, { timeout: 20_000 });
  } catch (e) {
    if (e instanceof ReturnRefused) return { ok: false as const, error: e.message };
    throw e;
  }

  // A refund handed back on a day already closed comes off that day's drawer.
  const closesCorrected = await syncCashCloses({
    dates: [created.date],
    reason: `${returnNo} (${cashDayLabel(created.date)}): ${cashRs(totalRefund)} ${input.refundMethod} refund on ${sale.invoiceNo}`,
    by: { name: session.user.name },
  });
  revalidatePath("/dashboard/sales");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/cash");
  return { ok: true as const, returnNo, totalRefund, closesCorrected };
}

// Undoing a return (it moves to the trash and can be put back for 30 days):
// the items count as sold again and come off the shelf.
export async function deleteReturn(returnId: string) {
  const session = await auth();
  if (!session?.user) return { ok: false as const, error: "You've been signed out — sign in again" };
  if (session.user.role === "CASHIER") return { ok: false as const, error: "Only managers and owners can undo a return" };
  try {
    await trashReturn(returnId, session.user.id);
  } catch (e) {
    if (e instanceof TrashError) return { ok: false as const, error: e.message };
    throw e;
  }
  revalidatePath("/dashboard/sales");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/cash");
  revalidatePath("/dashboard/trash");
  return { ok: true as const };
}

/**
 * Corrects a return's details. Changing which items came back means undoing
 * the return and entering it again — the stock has to move with it.
 */
export async function updateReturn(returnId: string, input: { reason?: string; refundMethod?: string; totalRefund?: number }) {
  const session = await auth();
  if (!session?.user) return { ok: false as const, error: "You've been signed out — sign in again" };
  if (session.user.role === "CASHIER") return { ok: false as const, error: "Only managers and owners can change a return" };
  if (input.refundMethod !== undefined && !(PAYMENT_METHODS as readonly string[]).includes(input.refundMethod)) {
    return { ok: false as const, error: "Pick how the refund was handed back" };
  }

  const before = await db.return.findUnique({
    where: { id: returnId },
    include: { items: { select: { total: true } }, sale: { select: { invoiceNo: true } } },
  });
  if (!before) return { ok: false as const, error: "This return has been undone" };
  let totalRefund: number | undefined;
  if (input.totalRefund !== undefined) {
    totalRefund = Math.round(Number(input.totalRefund) * 100) / 100;
    const worth = before.items.reduce((sum, i) => sum + i.total, 0);
    if (!(totalRefund >= 0)) return { ok: false as const, error: "Check the refund amount" };
    if (totalRefund > worth + 0.01) return { ok: false as const, error: `The refund can't be more than the ${cashRs(worth)} the returned items came to` };
  }

  const updated = await db.return.updateMany({
    where: { id: returnId },
    data: {
      reason: input.reason,
      refundMethod: input.refundMethod,
      ...(totalRefund === undefined ? {} : { totalRefund }),
    },
  });
  if (updated.count === 0) return { ok: false as const, error: "This return has been undone" };
  // The refund was handed back on the return's day, which may be closed.
  const said = (r: { totalRefund: number; refundMethod: string }) => `${cashRs(r.totalRefund)} ${r.refundMethod}`;
  const closesCorrected = await syncCashCloses({
    dates: [before.date],
    reason: `${before.returnNo} (${cashDayLabel(before.date)}): refund on ${before.sale.invoiceNo} changed from ${said(before)} to ${said({
      totalRefund: totalRefund ?? before.totalRefund, refundMethod: input.refundMethod ?? before.refundMethod,
    })}`,
    by: { name: session.user.name },
  });
  revalidatePath("/dashboard/sales");
  revalidatePath("/dashboard/cash");
  return { ok: true as const, closesCorrected };
}

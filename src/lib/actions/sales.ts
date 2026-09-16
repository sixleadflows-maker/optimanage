"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { persistSale, SaleError, type SalePrescriptionInput } from "@/lib/sales/core";

export interface CartItemInput {
  // Left out for an item typed in at the till that isn't in the inventory.
  productId?: string;
  name?: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  discount: number;
}

export interface CreateSaleInput {
  items: CartItemInput[];
  customerId?: string;
  paymentMethod: string;
  paymentType: "Full" | "Advance" | "Balance";
  advanceAmount: number;
  invoiceDiscount: number;
  branchId?: string;
  // Prescription-job costs (reduce profit, not charged separately to customer)
  lensProductId?: string;
  labCharges?: number;
  fittingCharges?: number;
  // Manually-entered lens (no catalog product) — name/price only, no stock impact
  customLensName?: string;
  customLensPrice?: number;
  // Staff tracking: who took the order vs. who generated the bill
  createdById?: string;
  receivedById?: string;
  // Optional prescription captured during the sale (needs customerId)
  prescription?: SalePrescriptionInput;
}

// Problems staff can act on (out of stock, missing name...) come back as
// { ok: false, error } rather than being thrown. A thrown error's message is
// replaced with a generic one in production, so the till couldn't tell "this
// frame is out of stock" apart from "no connection" -- and saved the sale as
// an offline draft that could never go through.
export async function createSale(input: CreateSaleInput) {
  const session = await auth();
  if (!session?.user) return { ok: false as const, error: "You've been signed out — sign in again to finish this sale" };

  const branchId = input.branchId || session.user.branchId || undefined;

  // Staff tracking: resolve who took the order vs. who generated the bill,
  // defaulting to the signed-in user, and validate any explicit IDs are real.
  const createdById = input.createdById || session.user.id;
  const receivedById = input.receivedById || session.user.id;
  const staffUsers = await db.user.findMany({ where: { id: { in: [...new Set([createdById, receivedById])] } } });
  const staffMap = new Map(staffUsers.map((u) => [u.id, u]));
  if (!staffMap.has(createdById) || !staffMap.has(receivedById)) {
    return { ok: false as const, error: "Selected staff member not found" };
  }

  try {
    const result = await persistSale(
      { ...input, branchId },
      { source: "POS", createdById, receivedById }
    );
    return {
      ...result,
      orderTakenByName: staffMap.get(createdById)!.name,
      billGeneratedByName: staffMap.get(receivedById)!.name,
    };
  } catch (e) {
    if (e instanceof SaleError) return { ok: false as const, error: e.message };
    throw e;
  }
}

export type OnlineOrderStatusValue =
  | "PROCESSING"
  | "READY_FOR_PICKUP"
  | "OUT_FOR_DELIVERY"
  | "COMPLETED"
  | "CANCELLED";

export async function updateOnlineOrderStatus(saleId: string, status: OnlineOrderStatusValue) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  await db.sale.update({ where: { id: saleId }, data: { onlineOrderStatus: status } });
  revalidatePath("/dashboard/sales");
  return { ok: true };
}

// Deleting an invoice is Owner-only -- it reverses stock and customer
// history, so it's a stricter tier than the Return/Refund flow.
//
// Invoices that had a return against them used to be refused outright. That
// was every invoice on the system at the time, and because the refusal was a
// thrown error (whose message production hides) staff only ever saw a generic
// failure. Now the return is undone along with the sale: units that were
// already returned went back on the shelf at the time, so only the rest are
// put back now -- nothing gets counted twice.
export async function deleteSale(saleId: string) {
  const session = await auth();
  if (!session?.user || session.user.role !== "OWNER") {
    return { ok: false as const, error: "Only the owner can delete an invoice" };
  }

  const sale = await db.sale.findUnique({
    where: { id: saleId },
    include: { items: true, returns: true },
  });
  if (!sale) return { ok: false as const, error: "This invoice has already been deleted" };

  await db.$transaction(async (tx) => {
    for (const item of sale.items) {
      // Typed-in items were never in stock, so there's nothing to put back.
      if (!item.productId) continue;
      const stillOut = item.quantity - item.returnedQuantity;
      if (stillOut <= 0) continue;
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { increment: stillOut } },
      });
    }

    if (sale.customerId) {
      const customer = await tx.customer.findUnique({ where: { id: sale.customerId } });
      if (customer) {
        await tx.customer.update({
          where: { id: customer.id },
          data: {
            totalSpend: Math.max(0, customer.totalSpend - sale.total),
            visitCount: Math.max(0, customer.visitCount - 1),
          },
        });
      }
    }

    // Return items cascade with their return. The prescription recorded with
    // the sale is kept -- it's the customer's eye history -- just unlinked.
    await tx.return.deleteMany({ where: { saleId } });
    await tx.checkoutSession.updateMany({ where: { saleId }, data: { saleId: null } });
    await tx.sale.delete({ where: { id: saleId } });
  }, { timeout: 20_000 });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/sales");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/customers");
  return { ok: true as const, hadReturns: sale.returns.length > 0 };
}

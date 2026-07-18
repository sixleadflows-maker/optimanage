"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { persistSale, type SalePrescriptionInput } from "@/lib/sales/core";

export interface CartItemInput {
  productId: string;
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

export async function createSale(input: CreateSaleInput) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const branchId = input.branchId || session.user.branchId || undefined;

  // Staff tracking: resolve who took the order vs. who generated the bill,
  // defaulting to the signed-in user, and validate any explicit IDs are real.
  const createdById = input.createdById || session.user.id;
  const receivedById = input.receivedById || session.user.id;
  const staffUsers = await db.user.findMany({ where: { id: { in: [...new Set([createdById, receivedById])] } } });
  const staffMap = new Map(staffUsers.map((u) => [u.id, u]));
  if (!staffMap.has(createdById) || !staffMap.has(receivedById)) {
    throw new Error("Selected staff member not found");
  }

  const result = await persistSale(
    { ...input, branchId },
    { source: "POS", createdById, receivedById }
  );

  return {
    ...result,
    orderTakenByName: staffMap.get(createdById)!.name,
    billGeneratedByName: staffMap.get(receivedById)!.name,
  };
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
export async function deleteSale(saleId: string) {
  const session = await auth();
  if (!session?.user || session.user.role !== "OWNER") throw new Error("Only the owner can delete an invoice");

  const sale = await db.sale.findUnique({
    where: { id: saleId },
    include: { items: true, returns: true },
  });
  if (!sale) throw new Error("Invoice not found");
  if (sale.returns.length > 0) {
    throw new Error("This invoice has a return/refund on it and can't be deleted");
  }

  await db.$transaction(async (tx) => {
    for (const item of sale.items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { increment: item.quantity } },
      });
    }
    if (sale.customerId) {
      await tx.customer.update({
        where: { id: sale.customerId },
        data: {
          totalSpend: { decrement: sale.total },
          visitCount: { decrement: 1 },
        },
      });
    }
    await tx.sale.delete({ where: { id: saleId } });
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/sales");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/customers");
  return { ok: true };
}

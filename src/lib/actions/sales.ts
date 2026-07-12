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

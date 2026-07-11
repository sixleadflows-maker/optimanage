"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export interface CartItemInput {
  productId: string;
  quantity: number;
  unitPrice: number;
  discount: number;
}

export interface SalePrescriptionInput {
  rightSph: number; rightCyl: number; rightAxis: number; rightPd: number; rightAdd: number;
  leftSph: number; leftCyl: number; leftAxis: number; leftPd: number; leftAdd: number;
  notes: string;
  isOwnPrescription?: boolean;
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

function paymentStatusFor(type: "Full" | "Advance" | "Balance") {
  if (type === "Full") return "PAID" as const;
  if (type === "Advance") return "ADVANCE" as const;
  return "BALANCE" as const;
}

export async function createSale(input: CreateSaleInput) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const customLensPrice = Math.max(0, input.customLensPrice ?? 0);
  const customLensName = customLensPrice > 0 ? (input.customLensName ?? "").trim() : "";
  if (!input.items.length && customLensPrice <= 0) throw new Error("Cart is empty");
  if (customLensPrice > 0 && !customLensName) throw new Error("Custom lens name is required");

  // Fetch real products for cost + stock validation
  const productIds = input.items.map((i) => i.productId);
  const products = await db.product.findMany({ where: { id: { in: productIds } } });
  const productMap = new Map(products.map((p) => [p.id, p]));

  let subtotal = 0;
  let itemCost = 0;
  const saleItems = input.items.map((i) => {
    const product = productMap.get(i.productId);
    if (!product) throw new Error(`Product not found: ${i.productId}`);
    const lineTotal = i.unitPrice * i.quantity - i.discount;
    subtotal += lineTotal;
    itemCost += product.costPrice * i.quantity;
    return {
      productId: i.productId,
      productName: product.name,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      discount: i.discount,
      total: lineTotal,
    };
  });
  subtotal += customLensPrice;

  const total = Math.max(0, subtotal - input.invoiceDiscount);
  const labCharges = Math.max(0, input.labCharges ?? 0);
  const fittingCharges = Math.max(0, input.fittingCharges ?? 0);
  // Lens cost: if the chosen lens is also a cart line item its cost is already in
  // itemCost; if it isn't in the cart, add its cost so profit stays accurate.
  let lensCost = 0;
  if (input.lensProductId && !productMap.has(input.lensProductId)) {
    const lens = await db.product.findUnique({ where: { id: input.lensProductId } });
    if (lens) lensCost = lens.costPrice;
  }
  // Custom (manually-entered) lens has no known cost basis — treated as a
  // zero-margin pass-through so it doesn't fabricate false profit.
  const totalCost = itemCost + lensCost + customLensPrice + labCharges + fittingCharges;
  const profit = total - totalCost;

  const paymentStatus = paymentStatusFor(input.paymentType);
  const paid = input.paymentType === "Full" ? total : input.paymentType === "Advance" ? input.advanceAmount : 0;
  const balance = Math.max(0, total - paid);

  // Generate invoice number: INV-YYYY-NNN
  const year = new Date().getFullYear();
  const countThisYear = await db.sale.count({
    where: { invoiceNo: { startsWith: `INV-${year}-` } },
  });
  const invoiceNo = `INV-${year}-${String(countThisYear + 1).padStart(3, "0")}`;

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
  const orderTakenByName = staffMap.get(createdById)!.name;
  const billGeneratedByName = staffMap.get(receivedById)!.name;

  const sale = await db.sale.create({
    data: {
      invoiceNo,
      customerId: input.customerId || null,
      branchId: branchId || null,
      subtotal,
      discount: input.invoiceDiscount,
      tax: 0,
      total,
      paid,
      balance,
      paymentMethod: input.paymentMethod,
      paymentStatus,
      lensProductId: input.lensProductId || null,
      lensCost,
      customLensName,
      customLensPrice,
      labCharges,
      fittingCharges,
      totalCost,
      profit,
      createdById,
      receivedById,
      items: { create: saleItems },
    },
  });

  // Decrement stock
  await Promise.all(
    input.items.map((i) =>
      db.product.update({
        where: { id: i.productId },
        data: { stock: { decrement: i.quantity } },
      })
    )
  );

  // Update customer aggregates
  if (input.customerId) {
    await db.customer.update({
      where: { id: input.customerId },
      data: {
        totalSpend: { increment: total },
        visitCount: { increment: 1 },
        lastVisit: new Date(),
      },
    });
  }

  // Optional prescription captured during the sale (linked to customer + sale)
  if (input.prescription && input.customerId) {
    const p = input.prescription;
    await db.prescription.create({
      data: {
        customerId: input.customerId,
        saleId: sale.id,
        rightSph: p.rightSph, rightCyl: p.rightCyl, rightAxis: p.rightAxis, rightPd: p.rightPd, rightAdd: p.rightAdd,
        leftSph: p.leftSph, leftCyl: p.leftCyl, leftAxis: p.leftAxis, leftPd: p.leftPd, leftAdd: p.leftAdd,
        notes: p.notes,
        isOwnPrescription: p.isOwnPrescription ?? false,
      },
    });
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/sales");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/customers");
  revalidatePath("/dashboard/prescriptions");

  return {
    ok: true,
    saleId: sale.id,
    invoiceNo,
    orderTakenByName,
    billGeneratedByName,
    total,
    paid,
    balance,
  };
}

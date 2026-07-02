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

export interface CreateSaleInput {
  items: CartItemInput[];
  customerId?: string;
  paymentMethod: string;
  paymentType: "Full" | "Advance" | "Balance";
  advanceAmount: number;
  invoiceDiscount: number;
  branchId?: string;
}

function paymentStatusFor(type: "Full" | "Advance" | "Balance") {
  if (type === "Full") return "PAID" as const;
  if (type === "Advance") return "ADVANCE" as const;
  return "BALANCE" as const;
}

export async function createSale(input: CreateSaleInput) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  if (!input.items.length) throw new Error("Cart is empty");

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

  const total = Math.max(0, subtotal - input.invoiceDiscount);
  const totalCost = itemCost; // lens/lab/fitting charges reserved for later
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
      totalCost,
      profit,
      createdById: session.user.id,
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

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/sales");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/customers");

  return {
    ok: true,
    saleId: sale.id,
    invoiceNo,
    servedBy: session.user.name,
    total,
    paid,
    balance,
  };
}

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";

export interface SaleCoreItem {
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

export interface PersistSaleInput {
  items: SaleCoreItem[];
  customerId?: string | null;
  paymentMethod: string;
  paymentType: "Full" | "Advance" | "Balance";
  advanceAmount: number;
  invoiceDiscount: number;
  branchId?: string | null;
  // Prescription-job costs (reduce profit, not charged separately to customer)
  lensProductId?: string | null;
  labCharges?: number;
  fittingCharges?: number;
  // Manually-entered lens (no catalog product) — name/price only, no stock impact
  customLensName?: string;
  customLensPrice?: number;
  prescription?: SalePrescriptionInput;
}

export interface PersistSaleMeta {
  source: "POS" | "ONLINE";
  createdById?: string | null;
  receivedById?: string | null;
  fulfillmentType?: "PICKUP" | "DELIVERY";
  deliveryAddress?: string;
  deliveryFee?: number;
  // Online fulfillment can run from contexts where Next.js rejects revalidatePath
  // (e.g. a client-triggered action right after a route transition). All the pages
  // it would revalidate are force-dynamic anyway, so skipping it there is harmless.
  skipRevalidate?: boolean;
}

function paymentStatusFor(type: "Full" | "Advance" | "Balance") {
  if (type === "Full") return "PAID" as const;
  if (type === "Advance") return "ADVANCE" as const;
  return "BALANCE" as const;
}

export async function persistSale(input: PersistSaleInput, meta: PersistSaleMeta) {
  const customLensPrice = Math.max(0, input.customLensPrice ?? 0);
  const customLensName = customLensPrice > 0 ? (input.customLensName ?? "").trim() : "";
  if (!input.items.length && customLensPrice <= 0) throw new Error("Cart is empty");
  if (customLensPrice > 0 && !customLensName) throw new Error("Custom lens name is required");

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

  const deliveryFee = Math.max(0, meta.deliveryFee ?? 0);
  const total = Math.max(0, subtotal - input.invoiceDiscount) + deliveryFee;
  const labCharges = Math.max(0, input.labCharges ?? 0);
  const fittingCharges = Math.max(0, input.fittingCharges ?? 0);

  // Lens cost: if the chosen lens is also a cart line item its cost is already in
  // itemCost; if it isn't in the cart, add its cost so profit stays accurate.
  let lensCost = 0;
  if (input.lensProductId && !productMap.has(input.lensProductId)) {
    const lens = await db.product.findUnique({ where: { id: input.lensProductId } });
    if (lens) lensCost = lens.costPrice;
  }
  const totalCost = itemCost + lensCost + customLensPrice + labCharges + fittingCharges;
  const profit = total - totalCost;

  const paymentStatus = paymentStatusFor(input.paymentType);
  const paid = input.paymentType === "Full" ? total : input.paymentType === "Advance" ? input.advanceAmount : 0;
  const balance = Math.max(0, total - paid);

  const year = new Date().getFullYear();

  const sale = await db.$transaction(async (tx) => {
    // Atomic conditional decrement per item — a single UPDATE ... WHERE stock >= qty
    // statement, so two concurrent sales on the same low-stock item can't both pass.
    for (const i of input.items) {
      const result = await tx.product.updateMany({
        where: { id: i.productId, stock: { gte: i.quantity } },
        data: { stock: { decrement: i.quantity } },
      });
      if (result.count === 0) {
        const name = productMap.get(i.productId)?.name ?? i.productId;
        throw new Error(`Insufficient stock for ${name}`);
      }
    }

    const countThisYear = await tx.sale.count({
      where: { invoiceNo: { startsWith: `INV-${year}-` } },
    });
    const invoiceNo = `INV-${year}-${String(countThisYear + 1).padStart(3, "0")}`;

    const created = await tx.sale.create({
      data: {
        invoiceNo,
        customerId: input.customerId || null,
        branchId: input.branchId || null,
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
        createdById: meta.createdById || null,
        receivedById: meta.receivedById || null,
        source: meta.source,
        fulfillmentType: meta.fulfillmentType ?? null,
        deliveryAddress: meta.deliveryAddress ?? "",
        deliveryFee,
        onlineOrderStatus: meta.source === "ONLINE" ? "PROCESSING" : null,
        items: { create: saleItems },
      },
    });

    if (input.customerId) {
      await tx.customer.update({
        where: { id: input.customerId },
        data: {
          totalSpend: { increment: total },
          visitCount: { increment: 1 },
          lastVisit: new Date(),
        },
      });
    }

    if (input.prescription && input.customerId) {
      const p = input.prescription;
      await tx.prescription.create({
        data: {
          customerId: input.customerId,
          saleId: created.id,
          rightSph: p.rightSph, rightCyl: p.rightCyl, rightAxis: p.rightAxis, rightPd: p.rightPd, rightAdd: p.rightAdd,
          leftSph: p.leftSph, leftCyl: p.leftCyl, leftAxis: p.leftAxis, leftPd: p.leftPd, leftAdd: p.leftAdd,
          notes: p.notes,
          isOwnPrescription: p.isOwnPrescription ?? false,
        },
      });
    }

    return created;
  });

  if (!meta.skipRevalidate) {
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/sales");
    revalidatePath("/dashboard/inventory");
    revalidatePath("/dashboard/customers");
    revalidatePath("/dashboard/prescriptions");
  }

  return {
    ok: true as const,
    saleId: sale.id,
    invoiceNo: sale.invoiceNo,
    total,
    paid,
    balance,
  };
}

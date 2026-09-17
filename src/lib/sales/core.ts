import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

export interface SaleCoreItem {
  // Left out for an item typed in at the till that isn't in the inventory --
  // it's sold by name and price only and has no stock to deduct.
  productId?: string | null;
  name?: string;
  // Printed under the item on the bill (e.g. lens colour). Falls back to the
  // product's own description when not given.
  description?: string;
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
  // Printed under the lens on the bill, whichever lens was chosen.
  lensColor?: string;
  lensDescription?: string;
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

/**
 * A problem with the sale itself (out of stock, empty cart, missing name...)
 * as opposed to a crash or lost connection. The till shows these to staff
 * as-is; anything else is treated as "couldn't reach the server".
 */
export class SaleError extends Error {}

function paymentStatusFor(type: "Full" | "Advance" | "Balance") {
  if (type === "Full") return "PAID" as const;
  if (type === "Advance") return "ADVANCE" as const;
  return "BALANCE" as const;
}

/**
 * Next number in a yearly series such as INV-2026-005.
 *
 * It used to be "how many invoices exist this year, plus one". Once invoices
 * can be deleted that breaks two ways: the next number can collide with one
 * that still exists (so the sale fails), or it quietly reuses the number of a
 * deleted invoice a customer may still be holding. A stored counter only ever
 * moves forward; the highest existing number is just a floor for the first use
 * of a series (and a safety net if the counter were ever behind).
 */
export async function nextDocumentNumber(
  client: Pick<Prisma.TransactionClient, "documentCounter">,
  prefix: string,
  existing: (startsWith: string) => Promise<string[]>,
) {
  const series = `${prefix}-${new Date().getFullYear()}`;
  const start = `${series}-`;
  const numbers = await existing(start);
  const highestExisting = numbers.reduce((m, no) => {
    const n = parseInt(no.slice(start.length), 10);
    return Number.isNaN(n) ? m : Math.max(m, n);
  }, 0);

  const counter = await client.documentCounter.upsert({
    where: { key: series },
    create: { key: series, value: highestExisting + 1 },
    update: { value: { increment: 1 } },
  });
  let next = counter.value;
  if (next <= highestExisting) {
    next = highestExisting + 1;
    await client.documentCounter.update({ where: { key: series }, data: { value: next } });
  }
  return `${start}${String(next).padStart(3, "0")}`;
}

function isUniqueViolation(e: unknown) {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";
}

/**
 * Prices a cart the one way the shop's numbers are allowed to be worked out —
 * used when a sale is first rung up and again whenever an invoice is edited,
 * so a corrected bill can never be calculated differently from a fresh one.
 */
async function priceSale(input: {
  items: SaleCoreItem[];
  invoiceDiscount: number;
  lensProductId?: string | null;
  labCharges?: number;
  fittingCharges?: number;
  customLensName?: string;
  customLensPrice?: number;
  deliveryFee?: number;
}) {
  const customLensPrice = Math.max(0, input.customLensPrice ?? 0);
  const customLensName = customLensPrice > 0 ? (input.customLensName ?? "").trim() : "";
  if (!input.items.length && customLensPrice <= 0) throw new SaleError("Cart is empty");
  if (customLensPrice > 0 && !customLensName) throw new SaleError("Custom lens name is required");

  const productIds = input.items.flatMap((i) => (i.productId ? [i.productId] : []));
  const products = await db.product.findMany({ where: { id: { in: productIds } } });
  const productMap = new Map(products.map((p) => [p.id, p]));

  let subtotal = 0;
  let itemCost = 0;
  const saleItems = input.items.map((i) => {
    const lineTotal = i.unitPrice * i.quantity - i.discount;

    if (!i.productId) {
      const name = (i.name ?? "").trim();
      if (!name) throw new SaleError("Enter a name for the item that isn't in the inventory");
      if (i.quantity <= 0 || i.unitPrice < 0) throw new SaleError(`Check the price and quantity for "${name}"`);
      subtotal += lineTotal;
      // No cost is known for a typed-in item, so it adds nothing to the cost side.
      return {
        productId: null,
        productName: name,
        description: (i.description ?? "").trim(),
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        discount: i.discount,
        total: lineTotal,
      };
    }

    const product = productMap.get(i.productId);
    if (!product) throw new SaleError(`Product not found: ${i.productId}`);
    if (i.quantity <= 0 || i.unitPrice < 0) {
      const label = [product.brand, product.name].map((s) => s.trim()).filter(Boolean).join(" ");
      throw new SaleError(`Check the price and quantity for "${label}"`);
    }
    subtotal += lineTotal;
    itemCost += product.costPrice * i.quantity;
    return {
      productId: i.productId,
      // Brand and name together, so the bill (and any reprint of it) reads
      // "Tom Ford Frame" rather than just "Frame".
      productName: [product.brand, product.name].map((s) => s.trim()).filter(Boolean).join(" "),
      description: (i.description ?? product.description).trim(),
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      discount: i.discount,
      total: lineTotal,
    };
  });
  subtotal += customLensPrice;

  const deliveryFee = Math.max(0, input.deliveryFee ?? 0);
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

  return {
    saleItems, productMap, subtotal, total, deliveryFee,
    labCharges, fittingCharges, customLensName, customLensPrice,
    lensCost, totalCost, profit: total - totalCost,
  };
}

/** Where an invoice stands once its total or its payments change. */
function settle(total: number, paid: number) {
  const balance = Math.max(0, total - paid);
  const status = balance <= 0 ? ("PAID" as const) : paid > 0 ? ("ADVANCE" as const) : ("BALANCE" as const);
  return { balance, status };
}

export async function persistSale(input: PersistSaleInput, meta: PersistSaleMeta) {
  const priced = await priceSale({ ...input, deliveryFee: meta.deliveryFee });
  const {
    saleItems, productMap, subtotal, total, deliveryFee,
    labCharges, fittingCharges, customLensName, customLensPrice, lensCost, totalCost, profit,
  } = priced;

  const paymentStatus = paymentStatusFor(input.paymentType);
  const paid = input.paymentType === "Full" ? total : input.paymentType === "Advance" ? input.advanceAmount : 0;
  const balance = Math.max(0, total - paid);

  const createSale = () => db.$transaction(async (tx) => {
    // Atomic conditional decrement per item — a single UPDATE ... WHERE stock >= qty
    // statement, so two concurrent sales on the same low-stock item can't both pass.
    for (const i of input.items) {
      if (!i.productId) continue;
      const result = await tx.product.updateMany({
        where: { id: i.productId, stock: { gte: i.quantity } },
        data: { stock: { decrement: i.quantity } },
      });
      if (result.count === 0) {
        const p = productMap.get(i.productId);
        const name = p ? [p.brand, p.name].map((s) => s.trim()).filter(Boolean).join(" ") : i.productId;
        throw new SaleError(`Not enough stock for ${name} — refresh the page to see the current count`);
      }
    }

    const invoiceNo = await nextDocumentNumber(tx, "INV", async (startsWith) =>
      (await tx.sale.findMany({ where: { invoiceNo: { startsWith } }, select: { invoiceNo: true } })).map((s) => s.invoiceNo)
    );

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
        lensColor: (input.lensColor ?? "").trim(),
        lensDescription: (input.lensDescription ?? "").trim(),
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

  // Two tills finishing a sale at the same moment can both pick the same next
  // invoice number; the database rejects the second, so just try again. The
  // whole transaction rolled back, so no stock was taken the first time.
  let sale: Awaited<ReturnType<typeof createSale>> | undefined;
  for (let attempt = 1; !sale; attempt++) {
    try {
      sale = await createSale();
    } catch (e) {
      if (!isUniqueViolation(e) || attempt >= 3) throw e;
    }
  }

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

export interface ReviseSaleInput {
  items: SaleCoreItem[];
  invoiceDiscount: number;
  lensProductId?: string | null;
  labCharges?: number;
  fittingCharges?: number;
  customLensName?: string;
  customLensPrice?: number;
  lensColor?: string;
  lensDescription?: string;
}

/**
 * Corrects an invoice that has already been rung up — the job changed after the
 * customer ordered, or something was entered wrong. Stock moves by the
 * difference only (a frame swapped for another puts the first one back), and
 * money already taken stays taken: the balance is simply worked out again
 * against the new total.
 */
export async function reviseSale(saleId: string, input: ReviseSaleInput) {
  const sale = await db.sale.findUnique({
    where: { id: saleId },
    include: { items: true, returns: { select: { returnNo: true } } },
  });
  if (!sale) throw new SaleError("Invoice not found");
  if (sale.returns.length > 0) {
    throw new SaleError(
      `This invoice has a return against it (${sale.returns[0].returnNo}). Undo that return before changing the invoice.`
    );
  }

  const priced = await priceSale({ ...input, deliveryFee: sale.deliveryFee });
  if (priced.total < sale.paid) {
    throw new SaleError(
      `The new total (Rs.${priced.total.toLocaleString()}) is less than the Rs.${sale.paid.toLocaleString()} already paid. Refund the difference through Return & Refund instead.`
    );
  }
  const { balance, status } = settle(priced.total, sale.paid);

  // Stock only moves by what actually changed — quantities that stayed the same
  // are never put back and taken again.
  const quantities = new Map<string, number>();
  for (const i of sale.items) if (i.productId) quantities.set(i.productId, (quantities.get(i.productId) ?? 0) - i.quantity);
  for (const i of input.items) if (i.productId) quantities.set(i.productId, (quantities.get(i.productId) ?? 0) + i.quantity);

  await db.$transaction(async (tx) => {
    for (const [productId, delta] of quantities) {
      if (delta === 0) continue;
      if (delta < 0) {
        await tx.product.update({ where: { id: productId }, data: { stock: { increment: -delta } } });
        continue;
      }
      const result = await tx.product.updateMany({
        where: { id: productId, stock: { gte: delta } },
        data: { stock: { decrement: delta } },
      });
      if (result.count === 0) {
        const p = priced.productMap.get(productId);
        const name = p ? [p.brand, p.name].map((s) => s.trim()).filter(Boolean).join(" ") : productId;
        throw new SaleError(`Not enough stock for ${name} — refresh the page to see the current count`);
      }
    }

    await tx.saleItem.deleteMany({ where: { saleId } });
    await tx.sale.update({
      where: { id: saleId },
      data: {
        subtotal: priced.subtotal,
        discount: input.invoiceDiscount,
        total: priced.total,
        balance,
        paymentStatus: status,
        lensProductId: input.lensProductId || null,
        lensCost: priced.lensCost,
        customLensName: priced.customLensName,
        customLensPrice: priced.customLensPrice,
        lensColor: (input.lensColor ?? "").trim(),
        lensDescription: (input.lensDescription ?? "").trim(),
        labCharges: priced.labCharges,
        fittingCharges: priced.fittingCharges,
        totalCost: priced.totalCost,
        profit: priced.profit,
        items: { create: priced.saleItems },
      },
    });

    // The customer's lifetime spend counted the old total; move it by the change.
    if (sale.customerId && priced.total !== sale.total) {
      await tx.customer.update({
        where: { id: sale.customerId },
        data: { totalSpend: { increment: priced.total - sale.total } },
      });
    }
  }, { timeout: 20_000 });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/sales");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/customers");
  revalidatePath("/dashboard/cash");

  return { ok: true as const, invoiceNo: sale.invoiceNo, total: priced.total, paid: sale.paid, balance };
}

/**
 * Takes money against an invoice after the sale — a customer settling an
 * advance. Recorded as its own dated row so the day's cash collection credits
 * the day the money came in, not the day the glasses were ordered.
 */
export async function recordSalePayment(
  saleId: string,
  payment: { amount: number; method: string; note?: string; receivedById?: string | null },
) {
  const sale = await db.sale.findUnique({ where: { id: saleId } });
  if (!sale) throw new SaleError("Invoice not found");

  const amount = Math.round(payment.amount * 100) / 100;
  if (!(amount > 0)) throw new SaleError("Enter the amount received");
  if (sale.balance <= 0) throw new SaleError("This invoice is already paid in full");
  if (amount > sale.balance) {
    throw new SaleError(`That's more than the Rs.${sale.balance.toLocaleString()} still owed on this invoice`);
  }

  const paid = sale.paid + amount;
  const { balance, status } = settle(sale.total, paid);

  await db.$transaction(async (tx) => {
    await tx.salePayment.create({
      data: {
        saleId,
        amount,
        method: payment.method,
        note: (payment.note ?? "").trim(),
        receivedById: payment.receivedById || null,
      },
    });
    await tx.sale.update({ where: { id: saleId }, data: { paid, balance, paymentStatus: status } });
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/sales");
  revalidatePath("/dashboard/customers");
  revalidatePath("/dashboard/cash");

  return { ok: true as const, invoiceNo: sale.invoiceNo, total: sale.total, paid, balance };
}

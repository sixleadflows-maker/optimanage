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
  // Whose eyes, when one slip carries several: a family member's name, or
  // "distance" / "reading".
  label?: string;
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
  // Manually-entered lens (no catalog product) — name/price only, no stock impact.
  // The price is per lens; a pair is customLensQty 2.
  customLensName?: string;
  customLensPrice?: number;
  customLensQty?: number;
  // Printed under the lens on the bill, whichever lens was chosen.
  lensColor?: string;
  lensDescription?: string;
  // One order can carry several prescriptions under the same customer — a
  // family sharing a serial number, or distance and reading on one slip.
  prescriptions?: SalePrescriptionInput[];
  // A prescription already saved from the till before the sale was finished.
  // It's attached to this sale instead of saving the same numbers twice.
  existingPrescriptionId?: string;
}

export interface PersistSaleMeta {
  source: "POS" | "ONLINE";
  createdById?: string | null;
  receivedById?: string | null;
  fulfillmentType?: "PICKUP" | "DELIVERY";
  deliveryAddress?: string;
  deliveryFee?: number;
  // When the sale happened, if not now: an old paper invoice being entered, or
  // a bill rung up while the till was offline and synced later.
  date?: Date;
  // False for an old invoice being entered from the records — those frames left
  // the shop long ago and today's stock count already reflects it.
  deductStock?: boolean;
  // A bill made offline has already been handed over with the goods, so it must
  // be recorded even if the system's count says the stock isn't there (it may
  // go below zero, which shows the count needs checking).
  allowOversell?: boolean;
  // Offline sync: clientRef makes a retry return the sale it already created;
  // offlineRef is the temporary number printed on the customer's bill.
  clientRef?: string;
  offlineRef?: string;
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
  // An invoice entered for a past date is numbered in that year's series.
  year: number = new Date().getFullYear(),
) {
  const series = `${prefix}-${year}`;
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
  customLensQty?: number;
  deliveryFee?: number;
}) {
  const customLensPrice = Math.max(0, input.customLensPrice ?? 0);
  const customLensQty = customLensPrice > 0 ? Math.max(1, Math.floor(input.customLensQty ?? 1)) : 1;
  const customLensTotal = customLensPrice * customLensQty;
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
  subtotal += customLensTotal;

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
  const totalCost = itemCost + lensCost + customLensTotal + labCharges + fittingCharges;

  return {
    saleItems, productMap, subtotal, total, deliveryFee,
    labCharges, fittingCharges, customLensName, customLensPrice, customLensQty,
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
  // A retried offline bill: the first attempt got through (maybe the reply was
  // lost), so hand back that sale rather than recording it twice.
  if (meta.clientRef) {
    const already = await db.sale.findUnique({ where: { clientRef: meta.clientRef } });
    if (already) return alreadySynced(already);
  }

  const priced = await priceSale({ ...input, deliveryFee: meta.deliveryFee });
  const {
    saleItems, productMap, subtotal, total, deliveryFee,
    labCharges, fittingCharges, customLensName, customLensPrice, customLensQty, lensCost, totalCost, profit,
  } = priced;

  const paymentStatus = paymentStatusFor(input.paymentType);
  const paid = input.paymentType === "Full" ? total : input.paymentType === "Advance" ? input.advanceAmount : 0;
  const balance = Math.max(0, total - paid);
  const saleDate = meta.date ?? new Date();
  const deductStock = meta.deductStock ?? true;
  // Items an offline bill took below zero — reported back so someone can
  // recount them.
  const oversold: string[] = [];

  const createSale = () => db.$transaction(async (tx) => {
    oversold.length = 0;
    for (const i of input.items) {
      if (!i.productId || !deductStock) continue;
      const p = productMap.get(i.productId);
      const name = p ? [p.brand, p.name].map((s) => s.trim()).filter(Boolean).join(" ") : i.productId;
      if (meta.allowOversell) {
        const updated = await tx.product.update({ where: { id: i.productId }, data: { stock: { decrement: i.quantity } } });
        if (updated.stock < 0) oversold.push(name);
        continue;
      }
      // Atomic conditional decrement per item — a single UPDATE ... WHERE stock >= qty
      // statement, so two concurrent sales on the same low-stock item can't both pass.
      const result = await tx.product.updateMany({
        where: { id: i.productId, stock: { gte: i.quantity } },
        data: { stock: { decrement: i.quantity } },
      });
      if (result.count === 0) {
        throw new SaleError(`Not enough stock for ${name} — refresh the page to see the current count`);
      }
    }

    const invoiceNo = await nextDocumentNumber(
      tx, "INV",
      async (startsWith) =>
        (await tx.sale.findMany({ where: { invoiceNo: { startsWith } }, select: { invoiceNo: true } })).map((s) => s.invoiceNo),
      saleDate.getFullYear(),
    );

    const created = await tx.sale.create({
      data: {
        invoiceNo,
        date: saleDate,
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
        customLensQty,
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
        clientRef: meta.clientRef || null,
        offlineRef: meta.offlineRef ?? "",
        stockDeducted: deductStock,
        items: { create: saleItems },
      },
    });

    if (input.customerId) {
      // An old invoice mustn't make a regular look like they were last in years ago.
      const customer = await tx.customer.findUnique({ where: { id: input.customerId }, select: { lastVisit: true } });
      const lastVisit = !customer?.lastVisit || customer.lastVisit < saleDate ? saleDate : customer.lastVisit;
      await tx.customer.update({
        where: { id: input.customerId },
        data: {
          totalSpend: { increment: total },
          visitCount: { increment: 1 },
          lastVisit,
        },
      });
    }

    // Already saved from the till before the sale was finished: attach it.
    const linked = input.existingPrescriptionId && input.customerId
      ? await tx.prescription.updateMany({
          where: { id: input.existingPrescriptionId, customerId: input.customerId, saleId: null },
          data: { saleId: created.id },
        })
      : { count: 0 };

    // The attached one (linked above) covers the first prescription when it was
    // saved from the till already; the rest are recorded here.
    const toCreate = (input.prescriptions ?? []).slice(linked.count > 0 ? 1 : 0);
    if (input.customerId && toCreate.length) {
      await tx.prescription.createMany({
        data: toCreate.map((p) => ({
          customerId: input.customerId!,
          saleId: created.id,
          date: saleDate,
          label: (p.label ?? "").trim(),
          rightSph: p.rightSph, rightCyl: p.rightCyl, rightAxis: p.rightAxis, rightPd: p.rightPd, rightAdd: p.rightAdd,
          leftSph: p.leftSph, leftCyl: p.leftCyl, leftAxis: p.leftAxis, leftPd: p.leftPd, leftAdd: p.leftAdd,
          notes: p.notes,
          isOwnPrescription: p.isOwnPrescription ?? false,
        })),
      });
    }

    return created;
  }, { timeout: 20_000 });

  // Two tills finishing a sale at the same moment can both pick the same next
  // invoice number; the database rejects the second, so just try again. The
  // whole transaction rolled back, so no stock was taken the first time.
  let sale: Awaited<ReturnType<typeof createSale>> | undefined;
  for (let attempt = 1; !sale; attempt++) {
    try {
      sale = await createSale();
    } catch (e) {
      // Two syncs of the same offline bill racing: the other one won.
      if (isUniqueViolation(e) && meta.clientRef) {
        const already = await db.sale.findUnique({ where: { clientRef: meta.clientRef } });
        if (already) return alreadySynced(already);
      }
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
    oversold: [...oversold],
    duplicate: false,
  };
}

function alreadySynced(sale: { id: string; invoiceNo: string; total: number; paid: number; balance: number }) {
  return {
    ok: true as const,
    saleId: sale.id,
    invoiceNo: sale.invoiceNo,
    total: sale.total,
    paid: sale.paid,
    balance: sale.balance,
    oversold: [] as string[],
    duplicate: true,
  };
}

export interface ReviseSaleInput {
  items: SaleCoreItem[];
  invoiceDiscount: number;
  // The invoice's own details, all correctable after the fact.
  date?: Date;
  customerId?: string | null;
  paymentMethod?: string;
  createdById?: string | null;
  receivedById?: string | null;
  lensProductId?: string | null;
  labCharges?: number;
  fittingCharges?: number;
  customLensName?: string;
  customLensPrice?: number;
  customLensQty?: number;
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

  const date = input.date ?? sale.date;
  if (Number.isNaN(date.getTime())) throw new SaleError("Check the bill date and time");
  if (date.getTime() > Date.now() + 5 * 60_000) throw new SaleError("The bill date can't be in the future");
  const earliestPayment = await db.salePayment.findFirst({ where: { saleId }, orderBy: { date: "asc" }, select: { date: true } });
  if (earliestPayment && date.getTime() > earliestPayment.date.getTime() + 60_000) {
    throw new SaleError(
      `A payment was taken on ${earliestPayment.date.toLocaleDateString("en-GB")}, so the invoice can't be dated after that`
    );
  }

  const priced = await priceSale({ ...input, deliveryFee: sale.deliveryFee });
  if (priced.total < sale.paid) {
    throw new SaleError(
      `The new total (Rs.${priced.total.toLocaleString()}) is less than the Rs.${sale.paid.toLocaleString()} already paid. Refund the difference through Return & Refund instead.`
    );
  }
  const { balance, status } = settle(priced.total, sale.paid);
  const customerId = input.customerId === undefined ? sale.customerId : input.customerId || null;

  // Stock only moves by what actually changed — quantities that stayed the same
  // are never put back and taken again.
  // An old invoice entered without touching stock stays that way when edited.
  const quantities = new Map<string, number>();
  if (sale.stockDeducted) {
    for (const i of sale.items) if (i.productId) quantities.set(i.productId, (quantities.get(i.productId) ?? 0) - i.quantity);
    for (const i of input.items) if (i.productId) quantities.set(i.productId, (quantities.get(i.productId) ?? 0) + i.quantity);
  }

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
        date,
        customerId: customerId ?? null,
        paymentMethod: input.paymentMethod ?? sale.paymentMethod,
        createdById: input.createdById === undefined ? sale.createdById : input.createdById || null,
        receivedById: input.receivedById === undefined ? sale.receivedById : input.receivedById || null,
        subtotal: priced.subtotal,
        discount: input.invoiceDiscount,
        total: priced.total,
        balance,
        paymentStatus: status,
        lensProductId: input.lensProductId || null,
        lensCost: priced.lensCost,
        customLensName: priced.customLensName,
        customLensPrice: priced.customLensPrice,
        customLensQty: priced.customLensQty,
        lensColor: (input.lensColor ?? "").trim(),
        lensDescription: (input.lensDescription ?? "").trim(),
        labCharges: priced.labCharges,
        fittingCharges: priced.fittingCharges,
        totalCost: priced.totalCost,
        profit: priced.profit,
        items: { create: priced.saleItems },
      },
    });

    // Lifetime spend and visits follow the invoice: moved between customers if
    // the bill was put on the wrong one, otherwise adjusted by the difference.
    if (customerId === sale.customerId) {
      if (sale.customerId && priced.total !== sale.total) {
        await tx.customer.update({
          where: { id: sale.customerId },
          data: { totalSpend: { increment: priced.total - sale.total } },
        });
      }
    } else {
      if (sale.customerId) {
        const previous = await tx.customer.findUnique({ where: { id: sale.customerId } });
        if (previous) {
          await tx.customer.update({
            where: { id: previous.id },
            data: { totalSpend: Math.max(0, previous.totalSpend - sale.total), visitCount: Math.max(0, previous.visitCount - 1) },
          });
        }
      }
      if (customerId) {
        const next = await tx.customer.findUnique({ where: { id: customerId }, select: { lastVisit: true } });
        await tx.customer.update({
          where: { id: customerId },
          data: {
            totalSpend: { increment: priced.total },
            visitCount: { increment: 1 },
            lastVisit: !next?.lastVisit || next.lastVisit < date ? date : next.lastVisit,
          },
        });
      }
    }
  }, { timeout: 20_000 });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/sales");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/customers");
  revalidatePath("/dashboard/cash");
  revalidatePath("/dashboard/prescriptions");

  return { ok: true as const, invoiceNo: sale.invoiceNo, total: priced.total, paid: sale.paid, balance };
}

/**
 * Takes money against an invoice after the sale — a customer settling an
 * advance. Recorded as its own dated row so the day's cash collection credits
 * the day the money came in, not the day the glasses were ordered.
 */
export async function recordSalePayment(
  saleId: string,
  payment: { amount: number; method: string; note?: string; receivedById?: string | null; date?: Date },
) {
  const sale = await db.sale.findUnique({ where: { id: saleId } });
  if (!sale) throw new SaleError("Invoice not found");

  // Staff can record a payment at the time it was actually taken — but not
  // one from the future, or from before the invoice existed.
  const date = payment.date ?? new Date();
  if (Number.isNaN(date.getTime())) throw new SaleError("Check the payment date and time");
  if (date.getTime() > Date.now() + 5 * 60_000) throw new SaleError("The payment date can't be in the future");
  if (date.getTime() < sale.date.getTime() - 60_000) {
    throw new SaleError(`The payment can't be dated before the invoice (${sale.date.toLocaleDateString("en-GB")})`);
  }

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
        date,
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

/**
 * Corrects a payment already taken against an invoice — a mistyped amount, the
 * wrong method, the wrong day. The invoice's paid total and balance are worked
 * out again from what's left, so the day's cash follows the correction.
 * Passing `remove` deletes the payment instead.
 */
export async function reviseSalePayment(
  paymentId: string,
  change: { amount?: number; method?: string; note?: string; date?: Date; remove?: boolean },
) {
  const payment = await db.salePayment.findUnique({ where: { id: paymentId }, include: { sale: true } });
  if (!payment) throw new SaleError("That payment has already been removed");
  const sale = payment.sale;

  const amount = change.remove ? 0 : Math.round((change.amount ?? payment.amount) * 100) / 100;
  const date = change.date ?? payment.date;
  if (!change.remove) {
    if (!(amount > 0)) throw new SaleError("Enter the amount received");
    if (Number.isNaN(date.getTime())) throw new SaleError("Check the payment date and time");
    if (date.getTime() > Date.now() + 5 * 60_000) throw new SaleError("The payment date can't be in the future");
    if (date.getTime() < sale.date.getTime() - 60_000) {
      throw new SaleError(`The payment can't be dated before the invoice (${sale.date.toLocaleDateString("en-GB")})`);
    }
  }

  const paid = sale.paid - payment.amount + amount;
  if (paid > sale.total + 0.01) {
    throw new SaleError(`That would take the payments past the ${formatRs(sale.total)} invoice total`);
  }
  if (paid < 0) throw new SaleError("That would make the amount paid less than nothing");
  const { balance, status } = settle(sale.total, paid);

  await db.$transaction(async (tx) => {
    if (change.remove) {
      await tx.salePayment.delete({ where: { id: paymentId } });
    } else {
      await tx.salePayment.update({
        where: { id: paymentId },
        data: { amount, date, method: change.method ?? payment.method, note: (change.note ?? payment.note).trim() },
      });
    }
    await tx.sale.update({ where: { id: sale.id }, data: { paid, balance, paymentStatus: status } });
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/sales");
  revalidatePath("/dashboard/customers");
  revalidatePath("/dashboard/cash");
  return { ok: true as const, invoiceNo: sale.invoiceNo, paid, balance };
}

function formatRs(n: number) {
  return `Rs.${Math.round(n).toLocaleString("en-PK")}`;
}

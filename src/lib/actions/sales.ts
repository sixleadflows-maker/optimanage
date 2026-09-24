"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import {
  persistSale,
  reviseSale,
  recordSalePayment,
  reviseSalePayment,
  SaleError,
  type SalePrescriptionInput,
} from "@/lib/sales/core";
import { trashInvoice, TrashError } from "@/lib/trash/snapshots";

export interface CartItemInput {
  // Correcting an invoice: the line this already is, so it's changed in place.
  id?: string;
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
  customLensQty?: number;
  lensColor?: string;
  lensDescription?: string;
  // Staff tracking: who took the order vs. who generated the bill
  createdById?: string;
  receivedById?: string;
  // Prescriptions captured during the sale (needs customerId). One order can
  // carry several under the same customer.
  prescriptions?: SalePrescriptionInput[];
  // Already saved to the customer's record from the till; attached, not duplicated.
  existingPrescriptionId?: string;
  // When the sale happened (ISO), if not now -- an old invoice being entered,
  // or an offline bill being synced.
  date?: string;
  // Old invoices only: take the items out of stock too. Off by default.
  deductStock?: boolean;
  // Every bill from the till carries clientRef, so a retry can never record it
  // twice; offlineRef is set when it was made without a connection.
  clientRef?: string;
  offlineRef?: string;
  // A customer added at the till while offline, created (or matched on phone)
  // when the bill syncs.
  newCustomer?: { name: string; phone: string };
}

// An old invoice is one dated this far before now; anything closer is just the
// till's clock or a slow connection.
const BACKDATE_AFTER_MS = 10 * 60_000;

/** Finds the offline customer by phone, or adds them. */
async function customerForOfflineBill(c: { name: string; phone: string }) {
  const phone = c.phone.trim();
  if (phone) {
    const existing = await db.customer.findUnique({ where: { phone } });
    if (existing) return existing.id;
  }
  const created = await db.customer.create({ data: { name: c.name.trim() || "Customer", phone: phone || null } });
  return created.id;
}

/**
 * Who took the order vs. who generated the bill, defaulting to the signed-in
 * user. Null when an explicit pick isn't a real account.
 */
async function billStaff(input: { createdById?: string; receivedById?: string }, signedInId: string) {
  const createdById = input.createdById || signedInId;
  const receivedById = input.receivedById || signedInId;
  const staffUsers = await db.user.findMany({ where: { id: { in: [...new Set([createdById, receivedById])] } } });
  const staffMap = new Map(staffUsers.map((u) => [u.id, u]));
  if (!staffMap.has(createdById) || !staffMap.has(receivedById)) return null;
  return { createdById, receivedById, staffMap };
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

  let date: Date | undefined;
  if (input.date) {
    date = new Date(input.date);
    if (Number.isNaN(date.getTime())) return { ok: false as const, error: "Check the bill date and time" };
    if (date.getTime() > Date.now() + 5 * 60_000) return { ok: false as const, error: "The bill date can't be in the future" };
  }
  const offline = !!input.offlineRef;
  // Entering an old invoice changes past days' takings, so it sits above the
  // till. An offline bill synced later is just late, not back-dated.
  const backdated = !!date && !offline && Date.now() - date.getTime() > BACKDATE_AFTER_MS;
  if (backdated && session.user.role === "CASHIER") {
    return { ok: false as const, error: "Ask a manager or the owner to enter an old invoice" };
  }

  const staff = await billStaff(input, session.user.id);
  if (!staff) return { ok: false as const, error: "Selected staff member not found" };
  const { createdById, receivedById, staffMap } = staff;

  try {
    // Checked here as well as in persistSale: a retry must be recognised before
    // a customer is added for it, or a name-only customer would be added twice.
    if (input.clientRef) {
      const already = await db.sale.findUnique({ where: { clientRef: input.clientRef }, select: { id: true } });
      if (already) {
        const result = await persistSale({ ...input, branchId }, { source: "POS", clientRef: input.clientRef });
        return { ...result, orderTakenByName: staffMap.get(createdById)!.name, billGeneratedByName: staffMap.get(receivedById)!.name };
      }
    }

    let customerId = input.customerId;
    if (!customerId && input.newCustomer?.name.trim()) customerId = await customerForOfflineBill(input.newCustomer);

    const result = await persistSale(
      { ...input, customerId, branchId },
      {
        source: "POS",
        createdById,
        receivedById,
        date,
        deductStock: backdated ? input.deductStock === true : true,
        allowOversell: offline,
        clientRef: input.clientRef,
        offlineRef: input.offlineRef,
      }
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

export interface CollectPaymentInput {
  saleId: string;
  amount: number;
  method: string;
  note?: string;
  // When the money was taken (ISO); defaults to now.
  date?: string;
}

/** Anyone on the till can take money owed on an invoice. */
export async function collectSalePayment(input: CollectPaymentInput) {
  const session = await auth();
  if (!session?.user) return { ok: false as const, error: "You've been signed out — sign in again" };

  try {
    return await recordSalePayment(input.saleId, {
      amount: input.amount,
      method: input.method,
      note: input.note,
      receivedById: session.user.id,
      date: input.date ? new Date(input.date) : undefined,
    });
  } catch (e) {
    if (e instanceof SaleError) return { ok: false as const, error: e.message };
    throw e;
  }
}

export interface UpdateSaleInput {
  saleId: string;
  items: CartItemInput[];
  invoiceDiscount: number;
  // What was taken at the counter on the day of the sale. Left out, the
  // invoice keeps what it has; money collected later is never touched here.
  paidAtTill?: number;
  // The invoice's own details (ISO date), all correctable.
  date?: string;
  customerId?: string | null;
  paymentMethod?: string;
  createdById?: string;
  receivedById?: string;
  lensProductId?: string;
  labCharges?: number;
  fittingCharges?: number;
  customLensName?: string;
  customLensPrice?: number;
  customLensQty?: number;
  lensColor?: string;
  lensDescription?: string;
}

// Changing what's on a finished invoice moves stock and rewrites the shop's
// takings, so it sits above the till: owner or manager, not cashiers.
export async function updateSale(input: UpdateSaleInput) {
  const session = await auth();
  if (!session?.user) return { ok: false as const, error: "You've been signed out — sign in again" };
  if (session.user.role === "CASHIER") {
    return { ok: false as const, error: "Ask a manager or the owner to change a finished invoice" };
  }

  try {
    return await reviseSale(input.saleId, {
      ...input,
      date: input.date ? new Date(input.date) : undefined,
      payment: input.paidAtTill === undefined ? undefined : { atTill: input.paidAtTill },
    });
  } catch (e) {
    if (e instanceof SaleError) return { ok: false as const, error: e.message };
    throw e;
  }
}

/**
 * The till's "Edit bill": the bill just rung up, corrected and saved again.
 * It's found by the till's clientRef, so however many times it's changed it
 * stays one invoice with one number. Everything on the till screen is saved
 * over it — items, customer, staff, the payment taken at the counter and the
 * prescriptions.
 */
export async function updateTillSale(input: CreateSaleInput) {
  const session = await auth();
  if (!session?.user) return { ok: false as const, error: "You've been signed out — sign in again" };
  if (session.user.role === "CASHIER") {
    return { ok: false as const, error: "Ask a manager or the owner to change a finished invoice" };
  }
  if (!input.clientRef) return { ok: false as const, error: "This bill can't be found — change it from Sales & Invoices" };

  const sale = await db.sale.findUnique({ where: { clientRef: input.clientRef }, select: { id: true } });
  if (!sale) return { ok: false as const, error: "This bill hasn't been recorded yet — try again in a moment" };

  const staff = await billStaff(input, session.user.id);
  if (!staff) return { ok: false as const, error: "Selected staff member not found" };

  let date: Date | undefined;
  if (input.date) {
    date = new Date(input.date);
    if (Number.isNaN(date.getTime())) return { ok: false as const, error: "Check the bill date and time" };
  }

  try {
    let customerId = input.customerId ?? null;
    if (!customerId && input.newCustomer?.name.trim()) customerId = await customerForOfflineBill(input.newCustomer);

    const result = await reviseSale(sale.id, {
      items: input.items,
      invoiceDiscount: input.invoiceDiscount,
      date,
      customerId,
      paymentMethod: input.paymentMethod,
      createdById: staff.createdById,
      receivedById: staff.receivedById,
      lensProductId: input.lensProductId ?? null,
      labCharges: input.labCharges,
      fittingCharges: input.fittingCharges,
      customLensName: input.customLensName,
      customLensPrice: input.customLensPrice,
      customLensQty: input.customLensQty,
      lensColor: input.lensColor,
      lensDescription: input.lensDescription,
      payment: { atTill: input.paymentType === "Full" ? "full" : input.paymentType === "Advance" ? input.advanceAmount : 0 },
      prescriptions: input.prescriptions ?? [],
      revisedById: session.user.id,
    });
    return {
      ...result,
      orderTakenByName: staff.staffMap.get(staff.createdById)!.name,
      billGeneratedByName: staff.staffMap.get(staff.receivedById)!.name,
    };
  } catch (e) {
    if (e instanceof SaleError) return { ok: false as const, error: e.message };
    throw e;
  }
}

export interface UpdatePaymentInput {
  paymentId: string;
  amount?: number;
  method?: string;
  note?: string;
  date?: string;
  remove?: boolean;
}

// Correcting money already taken rewrites a day's cash, so it sits with the
// other invoice edits: owner or manager, not cashiers.
export async function updateSalePayment(input: UpdatePaymentInput) {
  const session = await auth();
  if (!session?.user) return { ok: false as const, error: "You've been signed out — sign in again" };
  if (session.user.role === "CASHIER") {
    return { ok: false as const, error: "Ask a manager or the owner to change a payment" };
  }

  try {
    return await reviseSalePayment(input.paymentId, {
      amount: input.amount,
      method: input.method,
      note: input.note,
      date: input.date ? new Date(input.date) : undefined,
      remove: input.remove,
    });
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
// history, so it's a stricter tier than the Return/Refund flow. It goes to the
// trash, from which the owner can put it back (stock permitting) for 30 days.
export async function deleteSale(saleId: string) {
  const session = await auth();
  if (!session?.user || session.user.role !== "OWNER") {
    return { ok: false as const, error: "Only the owner can delete an invoice" };
  }
  try {
    const { hadReturns } = await trashInvoice(saleId, session.user.id);
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/sales");
    revalidatePath("/dashboard/inventory");
    revalidatePath("/dashboard/customers");
    revalidatePath("/dashboard/cash");
    revalidatePath("/dashboard/trash");
    return { ok: true as const, hadReturns };
  } catch (e) {
    if (e instanceof TrashError) return { ok: false as const, error: e.message };
    throw e;
  }
}

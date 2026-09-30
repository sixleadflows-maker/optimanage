"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { customerHoldingPhone } from "@/lib/trash/heldValues";

export interface CustomerInput {
  name: string;
  phone: string;
  serialNumber: string;
  email: string;
  address: string;
  lastVisit: string;
}

async function requireAuth() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
}

export interface CustomerSearchHit {
  id: string;
  name: string;
  phone: string;
  serialNumber: string;
  lastVisit: string;
  visitCount: number;
  totalSpend: number;
  prescriptionCount: number;
}

/**
 * Finds a customer from the search box at the top of every screen -- by serial
 * number, name or phone, so a serial written on a case or an old bill is
 * enough to pull the customer up.
 */
export async function searchCustomers(query: string): Promise<CustomerSearchHit[]> {
  const session = await auth();
  if (!session?.user) return [];
  const q = query.trim();
  if (q.length < 2) return [];

  const rows = await db.customer.findMany({
    where: {
      active: true,
      OR: [
        { serialNumber: { contains: q, mode: "insensitive" } },
        { name: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
      ],
    },
    orderBy: { lastVisit: "desc" },
    take: 6,
    include: { _count: { select: { prescriptions: true } } },
  });

  return rows.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone ?? "",
    serialNumber: c.serialNumber,
    lastVisit: c.lastVisit ? c.lastVisit.toISOString().slice(0, 10) : "",
    visitCount: c.visitCount,
    totalSpend: c.totalSpend,
    prescriptionCount: c._count.prescriptions,
  }));
}

export type CreateCustomerResult =
  // `restored` is set when the number belonged to a deleted customer, who has
  // been brought back instead of adding a second record.
  | { ok: true; id: string; restored?: boolean; name?: string }
  // `existing` is set when the phone number already belongs to a customer, so
  // the till can simply select them instead.
  | { ok: false; error: string; existing?: { id: string; name: string; phone: string } };

export async function createCustomer(input: CustomerInput): Promise<CreateCustomerResult> {
  await requireAuth();

  // Phone is optional now; only dedupe on it when one was actually entered.
  const phone = input.phone.trim();
  if (phone) {
    // A customer deleted for good no longer holds the number.
    const existing = await customerHoldingPhone(phone);
    if (existing && !existing.active) {
      // Deleted, but it's their number, so it's them back again. Bring them back
      // with what was just typed rather than stopping staff mid-order: their
      // past invoices and prescriptions come back with them.
      const back = await db.customer.update({
        where: { id: existing.id },
        data: {
          active: true,
          deletedAt: null,
          name: input.name.trim() || existing.name,
          ...(input.serialNumber.trim() ? { serialNumber: input.serialNumber.trim() } : {}),
          ...(input.email.trim() ? { email: input.email.trim() } : {}),
          ...(input.address.trim() ? { address: input.address.trim() } : {}),
          ...(input.lastVisit ? { lastVisit: new Date(input.lastVisit) } : {}),
        },
      });
      revalidatePath("/dashboard/customers");
      revalidatePath("/dashboard/trash");
      return { ok: true, id: back.id, restored: true, name: back.name };
    }
    if (existing) {
      return {
        ok: false,
        error: "A customer with this phone already exists",
        existing: { id: existing.id, name: existing.name, phone: existing.phone ?? "" },
      };
    }
  }

  const customer = await db.customer.create({
    data: {
      name: input.name.trim(),
      phone: phone || null,
      serialNumber: input.serialNumber.trim(),
      email: input.email.trim(),
      address: input.address.trim(),
      ...(input.lastVisit ? { lastVisit: new Date(input.lastVisit) } : {}),
    },
  });
  revalidatePath("/dashboard/customers");
  return { ok: true, id: customer.id };
}

export async function updateCustomer(id: string, input: CustomerInput) {
  await requireAuth();

  const phone = input.phone.trim();
  if (phone) {
    const existing = await customerHoldingPhone(phone);
    if (existing && existing.id !== id) {
      if (existing.active) return { ok: false as const, error: `${existing.name} already has this phone number` };
      // A deleted customer doesn't get to keep the number from someone on file:
      // it moves across, and the deleted record simply has no phone.
      await db.customer.update({ where: { id: existing.id }, data: { phone: null } });
    }
  }

  await db.customer.update({
    where: { id },
    data: {
      name: input.name.trim(),
      phone: phone || null,
      serialNumber: input.serialNumber.trim(),
      email: input.email.trim(),
      address: input.address.trim(),
      // Only overwrite last visit when a date was supplied; otherwise leave the
      // auto-tracked value from the customer's sales untouched.
      ...(input.lastVisit ? { lastVisit: new Date(input.lastVisit) } : {}),
    },
  });
  // The name and phone show on invoices, prescriptions and lab orders too.
  revalidatePath("/dashboard/customers");
  revalidatePath(`/dashboard/customers/${id}`);
  revalidatePath("/dashboard/pos");
  revalidatePath("/dashboard/sales");
  revalidatePath("/dashboard/prescriptions");
  revalidatePath("/dashboard/lab-orders");
  return { ok: true as const };
}

// Moves the customer to the Trash rather than erasing them: their invoices,
// prescriptions and lab orders stay intact (and keep showing their name), and
// they can be restored from the Trash for 30 days.
export async function deleteCustomer(id: string) {
  const session = await auth();
  if (!session?.user) return { ok: false as const, error: "Unauthorized" };
  if (session.user.role === "CASHIER") return { ok: false as const, error: "Only managers and owners can delete customers" };

  const customer = await db.customer.findUnique({ where: { id } });
  if (!customer || !customer.active) return { ok: false as const, error: "This customer has already been deleted" };

  await db.customer.update({ where: { id }, data: { active: false, deletedAt: new Date() } });
  revalidatePath("/dashboard/customers");
  revalidatePath(`/dashboard/customers/${id}`);
  revalidatePath("/dashboard/pos");
  revalidatePath("/dashboard/trash");
  return { ok: true as const, name: customer.name };
}

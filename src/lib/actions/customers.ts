"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

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

  // Every word has to match somewhere, in any order ("khan ali", "ali 0142").
  // A number typed with spaces or dashes is also tried as one run of digits.
  const words = q.split(/\s+/).filter(Boolean);
  const digits = q.replace(/[^0-9]/g, "");
  const phoneLike = /^[+\d][\d\s-]*$/.test(q) && digits.length >= 3;
  const rows = await db.customer.findMany({
    where: {
      active: true,
      OR: [
        {
          AND: words.map((w) => ({
            OR: [
              { serialNumber: { contains: w, mode: "insensitive" as const } },
              { name: { contains: w, mode: "insensitive" as const } },
              { phone: { contains: w } },
            ],
          })),
        },
        ...(phoneLike ? [{ phone: { contains: digits } }] : []),
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

export type CreateCustomerResult = { ok: true; id: string } | { ok: false; error: string };

/**
 * Adds a customer. A phone number already on file is no obstacle: several
 * customers can share one number (a family on one phone, or a record per
 * order), so this always adds a new record. The forms show who's already on
 * the number and let staff pick one of them instead.
 */
export async function createCustomer(input: CustomerInput): Promise<CreateCustomerResult> {
  await requireAuth();

  const name = input.name.trim();
  const phone = input.phone.trim();
  const serialNumber = input.serialNumber.trim();

  // Save pressed twice in a row mustn't leave two identical records, now that
  // the phone number no longer stops the second one.
  const justAdded = await db.customer.findFirst({
    where: { name, phone: phone || null, serialNumber, active: true, createdAt: { gt: new Date(Date.now() - 15_000) } },
    select: { id: true },
  });
  if (justAdded) return { ok: true, id: justAdded.id };

  const customer = await db.customer.create({
    data: {
      name,
      phone: phone || null,
      serialNumber,
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

  const current = await db.customer.findUnique({ where: { id }, select: { id: true } });
  if (!current) return { ok: false as const, error: "This customer is no longer on the system" };
  // Sharing a number with another customer is fine, so there's nothing to check.
  const phone = input.phone.trim();

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

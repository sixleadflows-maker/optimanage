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

export async function createCustomer(input: CustomerInput) {
  await requireAuth();
  if (!input.name.trim()) throw new Error("Name is required");

  // Phone is optional now; only dedupe on it when one was actually entered.
  const phone = input.phone.trim();
  if (phone) {
    const existing = await db.customer.findUnique({ where: { phone } });
    if (existing) return { ok: false, error: "A customer with this phone already exists", id: existing.id };
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
  if (!input.name.trim()) throw new Error("Name is required");

  const phone = input.phone.trim();
  if (phone) {
    const existing = await db.customer.findUnique({ where: { phone } });
    if (existing && existing.id !== id) return { ok: false, error: "Another customer already uses this phone" };
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
  revalidatePath("/dashboard/customers");
  revalidatePath(`/dashboard/customers/${id}`);
  return { ok: true };
}

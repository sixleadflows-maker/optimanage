"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export interface CustomerInput {
  name: string;
  phone: string;
  email: string;
  address: string;
}

async function requireAuth() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
}

export async function createCustomer(input: CustomerInput) {
  await requireAuth();
  if (!input.name.trim() || !input.phone.trim()) throw new Error("Name and phone are required");

  const existing = await db.customer.findUnique({ where: { phone: input.phone.trim() } });
  if (existing) return { ok: false, error: "A customer with this phone already exists", id: existing.id };

  const customer = await db.customer.create({
    data: {
      name: input.name.trim(),
      phone: input.phone.trim(),
      email: input.email.trim(),
      address: input.address.trim(),
    },
  });
  revalidatePath("/dashboard/customers");
  return { ok: true, id: customer.id };
}

export async function updateCustomer(id: string, input: CustomerInput) {
  await requireAuth();
  await db.customer.update({
    where: { id },
    data: {
      name: input.name.trim(),
      phone: input.phone.trim(),
      email: input.email.trim(),
      address: input.address.trim(),
    },
  });
  revalidatePath("/dashboard/customers");
  revalidatePath(`/dashboard/customers/${id}`);
  return { ok: true };
}

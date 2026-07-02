"use server";

import { revalidatePath } from "next/cache";
import { hash } from "bcryptjs";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

async function requireManager() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (session.user.role === "CASHIER") throw new Error("Insufficient permissions");
  return session;
}

export interface ShopProfileInput {
  name: string;
  phone: string;
  email: string;
  ntn: string;
  address: string;
  receiptFooter: string;
  taxRate: number;
  barcodeWidth: number;
  barcodeHeight: number;
}

export async function updateShopSettings(input: ShopProfileInput) {
  await requireManager();
  await db.shopSettings.upsert({
    where: { id: "default" },
    update: { ...input },
    create: { id: "default", ...input },
  });
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/pos");
  return { ok: true };
}

export async function setAnalyticsPin(pin: string) {
  await requireManager();
  if (!/^\d{4,6}$/.test(pin)) throw new Error("PIN must be 4–6 digits");
  const hashed = await hash(pin, 12);
  await db.shopSettings.upsert({
    where: { id: "default" },
    update: { analyticsPin: hashed },
    create: { id: "default", analyticsPin: hashed },
  });
  revalidatePath("/dashboard/settings");
  return { ok: true };
}

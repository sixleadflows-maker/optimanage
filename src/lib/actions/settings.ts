"use server";

import { revalidatePath } from "next/cache";
import { compare, hash } from "bcryptjs";
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
  deliveryFee: number;
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
  revalidatePath("/shop");
  revalidatePath("/shop/checkout");
  return { ok: true };
}

/** Stores a new Analytics PIN, whoever has already been allowed to set it. */
async function storeAnalyticsPin(pin: string) {
  const hashed = await hash(pin, 12);
  await db.shopSettings.upsert({
    where: { id: "default" },
    update: { analyticsPin: hashed },
    create: { id: "default", analyticsPin: hashed },
  });
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/analytics");
}

/**
 * Sets the Analytics PIN, or changes it once one exists — which needs the
 * current PIN. Analytics is the owner's alone, so the PIN on it is too.
 */
export async function changeAnalyticsPin(input: { currentPin?: string; newPin: string }) {
  const session = await auth();
  if (!session?.user) return { ok: false as const, error: "You've been signed out — sign in again" };
  if (session.user.role !== "OWNER") return { ok: false as const, error: "Only the owner can change the Analytics PIN" };
  if (!/^\d{4,6}$/.test(input.newPin)) return { ok: false as const, error: "The new PIN must be 4–6 digits" };

  const settings = await db.shopSettings.findUnique({ where: { id: "default" } });
  if (settings?.analyticsPin) {
    const matches = input.currentPin ? await compare(input.currentPin, settings.analyticsPin) : false;
    if (!matches) return { ok: false as const, error: "That isn't the current PIN" };
  }

  await storeAnalyticsPin(input.newPin);
  return { ok: true as const };
}

/**
 * For a forgotten PIN: the owner's own sign-in password sets a new one, so
 * nobody is locked out of their own figures without a support call.
 */
export async function resetAnalyticsPinWithPassword(input: { password: string; newPin: string }) {
  const session = await auth();
  if (!session?.user) return { ok: false as const, error: "You've been signed out — sign in again" };
  if (session.user.role !== "OWNER") return { ok: false as const, error: "Only the owner can change the Analytics PIN" };
  if (!/^\d{4,6}$/.test(input.newPin)) return { ok: false as const, error: "The new PIN must be 4–6 digits" };

  const user = await db.user.findUnique({ where: { id: session.user.id }, select: { hashedPassword: true } });
  const valid = user ? await compare(input.password, user.hashedPassword) : false;
  if (!valid) return { ok: false as const, error: "That isn't your sign-in password" };

  await storeAnalyticsPin(input.newPin);
  return { ok: true as const };
}

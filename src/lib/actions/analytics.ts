"use server";

import { compare } from "bcryptjs";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function verifyAnalyticsPin(pin: string): Promise<{ ok: boolean }> {
  const session = await auth();
  if (!session?.user) return { ok: false };
  const settings = await db.shopSettings.findUnique({ where: { id: "default" } });
  if (!settings?.analyticsPin) return { ok: true }; // no PIN configured → open
  const valid = await compare(pin, settings.analyticsPin);
  return { ok: valid };
}

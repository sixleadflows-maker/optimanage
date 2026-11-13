"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { saveDayClose, type DayCloseInput } from "@/lib/cash/saveClose";

export async function saveCashCollection(input: DayCloseInput) {
  const session = await auth();
  if (!session?.user) return { ok: false as const, error: "You've been signed out — sign in again" };

  try {
    const result = await saveDayClose(input, { name: session.user.name ?? "", branchId: session.user.branchId || null });
    if (result.ok) revalidatePath("/dashboard/cash");
    return result;
  } catch (e) {
    console.error("[saveCashCollection]", e);
    return { ok: false as const, error: "The day close wasn't saved — check the connection and try again." };
  }
}

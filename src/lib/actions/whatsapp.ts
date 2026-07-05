"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export interface LogReminderInput {
  customerId: string;
  template: string;
  message: string;
}

export async function logReminderSent(input: LogReminderInput) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const customer = await db.customer.findUnique({ where: { id: input.customerId } });
  if (!customer) throw new Error("Customer not found");

  await db.whatsAppMessage.create({
    data: {
      to: customer.phone,
      customerName: customer.name,
      template: input.template,
      message: input.message,
      status: "SENT",
    },
  });

  revalidatePath("/dashboard/whatsapp");
  return { ok: true };
}

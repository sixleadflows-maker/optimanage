"use server";

import { hash } from "bcryptjs";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

// User management (creating accounts, deactivating, resetting passwords) is
// deliberately Owner-only -- stricter than the Owner+Manager "canManage"
// check used for general shop settings, since it can grant/revoke access
// and touches every other user's credentials.
async function requireOwner() {
  const session = await auth();
  if (!session?.user || session.user.role !== "OWNER") throw new Error("Only the owner can manage users");
  return session;
}

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  role: "OWNER" | "MANAGER" | "CASHIER";
}

export async function createUser(input: CreateUserInput) {
  const session = await requireOwner();
  if (!input.name.trim()) throw new Error("Name is required");
  if (!input.email.trim()) throw new Error("Email is required");
  if (input.password.length < 6) throw new Error("Password must be at least 6 characters");

  const existing = await db.user.findUnique({ where: { email: input.email } });
  if (existing) throw new Error("A user with this email already exists");

  const hashedPassword = await hash(input.password, 12);
  await db.user.create({
    data: {
      name: input.name,
      email: input.email,
      hashedPassword,
      role: input.role,
      branchId: session.user.branchId || undefined,
    },
  });
  revalidatePath("/dashboard/settings");
  return { ok: true };
}

export async function setUserActive(id: string, active: boolean) {
  const session = await requireOwner();
  if (id === session.user.id) throw new Error("You cannot deactivate your own account");
  await db.user.update({ where: { id }, data: { active } });
  revalidatePath("/dashboard/settings");
  return { ok: true };
}

export async function resetUserPassword(id: string, newPassword: string) {
  await requireOwner();
  if (newPassword.length < 6) throw new Error("Password must be at least 6 characters");
  const hashedPassword = await hash(newPassword, 12);
  await db.user.update({ where: { id }, data: { hashedPassword } });
  revalidatePath("/dashboard/settings");
  return { ok: true };
}

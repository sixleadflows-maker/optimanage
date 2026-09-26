"use server";

import { hash } from "bcryptjs";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { auth, forgetAccount } from "@/lib/auth";
import { userHoldingEmail } from "@/lib/trash/heldValues";

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

// Refusals come back as { ok: false, error } -- production replaces a thrown
// error's message with a generic one, so staff would never see the reason.
export async function createUser(input: CreateUserInput) {
  const session = await auth();
  if (!session?.user || session.user.role !== "OWNER") return { ok: false as const, error: "Only the owner can manage users" };
  const email = input.email.trim();
  if (!input.name.trim()) return { ok: false as const, error: "Name is required" };
  if (!email) return { ok: false as const, error: "Email is required" };
  if (input.password.length < 6) return { ok: false as const, error: "Password must be at least 6 characters" };

  // An account deleted for good no longer holds its email.
  const existing = await userHoldingEmail(email);
  if (existing) {
    return {
      ok: false as const,
      error: existing.active
        ? `${existing.name} already signs in with this email`
        : `${existing.name} used this email and is in the Trash — restore them from there, or delete them there for good first`,
    };
  }

  const hashedPassword = await hash(input.password, 12);
  await db.user.create({
    data: {
      name: input.name,
      email,
      hashedPassword,
      role: input.role,
      branchId: session.user.branchId || undefined,
    },
  });
  revalidatePath("/dashboard/settings");
  return { ok: true as const };
}

export async function setUserActive(id: string, active: boolean) {
  const session = await requireOwner();
  if (id === session.user.id) throw new Error("You cannot deactivate your own account");

  // Removing the last active owner would lock everyone out of the system.
  if (!active) {
    const target = await db.user.findUnique({ where: { id } });
    if (target?.role === "OWNER") {
      const otherOwners = await db.user.count({ where: { role: "OWNER", active: true, id: { not: id } } });
      if (otherOwners === 0) throw new Error("This is the last owner account — removing it would lock you out");
    }
  }

  await db.user.update({
    where: { id },
    data: { active, deletedAt: active ? null : new Date() },
  });
  forgetAccount(id);
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/trash");
  return { ok: true };
}

export interface UpdateUserInput {
  name: string;
  email: string;
  role: "OWNER" | "MANAGER" | "CASHIER";
  branchId: string | null;
}

/**
 * Corrects a staff account: name, the email they sign in with, role and
 * location. Applies to them straight away, even while signed in.
 */
export async function updateUser(id: string, input: UpdateUserInput) {
  const session = await auth();
  if (!session?.user || session.user.role !== "OWNER") return { ok: false as const, error: "Only the owner can change staff accounts" };

  const name = input.name.trim();
  const email = input.email.trim();
  if (!name) return { ok: false as const, error: "Enter a name" };
  if (!email) return { ok: false as const, error: "Enter an email — it's what they sign in with" };

  const target = await db.user.findUnique({ where: { id } });
  if (!target) return { ok: false as const, error: "That account no longer exists" };
  const clash = await userHoldingEmail(email);
  if (clash && clash.id !== id) {
    return {
      ok: false as const,
      error: clash.active
        ? `${clash.name} already signs in with that email`
        : `${clash.name} used that email and is in the Trash — restore them from there, or delete them there for good first`,
    };
  }

  // Never leave the shop without an owner who can sign in.
  if (target.role === "OWNER" && input.role !== "OWNER" && target.active) {
    const otherOwners = await db.user.count({ where: { role: "OWNER", active: true, id: { not: id } } });
    if (otherOwners === 0) return { ok: false as const, error: "This is the only owner account — make someone else an owner first" };
  }
  if (input.branchId && !(await db.branch.findUnique({ where: { id: input.branchId }, select: { id: true } }))) {
    return { ok: false as const, error: "That location no longer exists" };
  }

  await db.user.update({
    where: { id },
    data: {
      name,
      email,
      role: input.role,
      branchId: input.branchId || null,
      // Initials follow the new name.
      ...(name !== target.name ? { avatar: "" } : {}),
    },
  });
  forgetAccount(id);
  revalidatePath("/dashboard/settings");
  return { ok: true as const };
}

export async function resetUserPassword(id: string, newPassword: string) {
  await requireOwner();
  if (newPassword.length < 6) throw new Error("Password must be at least 6 characters");
  const hashedPassword = await hash(newPassword, 12);
  await db.user.update({ where: { id }, data: { hashedPassword } });
  revalidatePath("/dashboard/settings");
  return { ok: true };
}

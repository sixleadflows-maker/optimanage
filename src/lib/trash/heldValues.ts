import { db } from "@/lib/db";
import { TRASH_RETENTION_DAYS } from "@/lib/constants";

// A customer or staff account deleted for good stays in the database (hidden),
// so old invoices keep showing the name. It must not keep holding a phone
// number or sign-in email that someone new needs -- the number or email is
// taken off it the first time another record asks for it.

/** Hidden but still in the trash, i.e. it can be restored. */
function restorableFromTrash(row: { deletedAt: Date | null }) {
  if (!row.deletedAt) return true;
  return row.deletedAt.getTime() > Date.now() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;
}

/** The customer this number belongs to: a live one, or one still in the trash. */
export async function customerHoldingPhone(phone: string) {
  const holder = await db.customer.findUnique({ where: { phone } });
  if (!holder || holder.active || restorableFromTrash(holder)) return holder;
  await db.customer.update({ where: { id: holder.id }, data: { phone: null } });
  return null;
}

/**
 * For a bill that has to be recorded without asking anyone (synced from an
 * offline till, or paid online): the customer with this number, brought back
 * from the trash if they were in it -- they're a customer again.
 */
export async function liveCustomerWithPhone(phone: string) {
  const holder = await customerHoldingPhone(phone);
  if (holder && !holder.active) {
    return db.customer.update({ where: { id: holder.id }, data: { active: true, deletedAt: null } });
  }
  return holder;
}

/** The staff account that signs in with this email: a live one, or one still in the trash. */
export async function userHoldingEmail(email: string) {
  const holder = await db.user.findUnique({ where: { email } });
  if (!holder || holder.active || restorableFromTrash(holder)) return holder;
  // Email can't be empty, so park a value no one can type in its place.
  await db.user.update({ where: { id: holder.id }, data: { email: `deleted-${holder.id}@removed.invalid` } });
  return null;
}

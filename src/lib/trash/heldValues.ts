import { db } from "@/lib/db";
import { TRASH_RETENTION_DAYS } from "@/lib/constants";

// A staff account deleted for good stays in the database (hidden), so old
// invoices keep showing the name. It must not keep holding a sign-in email that
// someone new needs -- the email is taken off it the first time another account
// asks for it.
//
// Customers don't need this any more: a phone number isn't unique, so a deleted
// customer's number never stands in anyone's way.

/** Hidden but still in the trash, i.e. it can be restored. */
function restorableFromTrash(row: { deletedAt: Date | null }) {
  if (!row.deletedAt) return true;
  return row.deletedAt.getTime() > Date.now() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * Customers on file with exactly this number, most recently seen first. Several
 * can share one: a family on one phone, or a separate record for each order.
 * Deleted customers aren't included.
 */
export async function customersWithPhone(phone: string) {
  return db.customer.findMany({
    where: { phone, active: true },
    orderBy: [{ lastVisit: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
  });
}

/** The staff account that signs in with this email: a live one, or one still in the trash. */
export async function userHoldingEmail(email: string) {
  const holder = await db.user.findUnique({ where: { email } });
  if (!holder || holder.active || restorableFromTrash(holder)) return holder;
  // Email can't be empty, so park a value no one can type in its place.
  await db.user.update({ where: { id: holder.id }, data: { email: `deleted-${holder.id}@removed.invalid` } });
  return null;
}

import { getExpenses } from "@/lib/data";
import { auth } from "@/lib/auth";
import { ExpensesClient } from "./ExpensesClient";

export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  const [expenses, session] = await Promise.all([getExpenses(), auth()]);
  // Changing or removing a recorded expense rewrites the cash day-close.
  const canManage = !!session?.user && session.user.role !== "CASHIER";
  return <ExpensesClient expenses={expenses} canManage={canManage} />;
}

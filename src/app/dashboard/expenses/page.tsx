import { getExpenses } from "@/lib/data";
import { ExpensesClient } from "./ExpensesClient";

export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  const expenses = await getExpenses();
  return <ExpensesClient expenses={expenses} />;
}

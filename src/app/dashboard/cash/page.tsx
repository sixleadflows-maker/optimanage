import { getCashCollection } from "@/lib/data";
import { auth } from "@/lib/auth";
import { CashClient } from "./CashClient";

export const dynamic = "force-dynamic";

export default async function CashPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { date } = await searchParams;
  const day = date || new Date().toISOString().slice(0, 10);
  const [data, session] = await Promise.all([getCashCollection(day), auth()]);
  // Correcting or removing a deposit changes a day's cash, so it's a manager's job.
  const canManage = !!session?.user && session.user.role !== "CASHIER";
  return <CashClient key={day} data={data} date={day} canManage={canManage} />;
}

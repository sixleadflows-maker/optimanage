import { getCashCollection } from "@/lib/data";
import { CashClient } from "./CashClient";

export const dynamic = "force-dynamic";

export default async function CashPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { date } = await searchParams;
  const day = date || new Date().toISOString().slice(0, 10);
  const data = await getCashCollection(day);
  return <CashClient key={day} data={data} date={day} />;
}

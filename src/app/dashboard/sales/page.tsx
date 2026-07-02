import { getSales } from "@/lib/data";
import { SalesClient } from "./SalesClient";

export const dynamic = "force-dynamic";

export default async function SalesPage() {
  const sales = await getSales();
  return <SalesClient sales={sales} />;
}

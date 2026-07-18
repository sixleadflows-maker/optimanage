import { getSales } from "@/lib/data";
import { auth } from "@/lib/auth";
import { SalesClient } from "./SalesClient";

export const dynamic = "force-dynamic";

export default async function SalesPage() {
  const [sales, session] = await Promise.all([getSales(), auth()]);
  const isOwner = session?.user?.role === "OWNER";
  return <SalesClient sales={sales} isOwner={isOwner} />;
}

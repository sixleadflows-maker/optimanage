import { getSales, getSettings } from "@/lib/data";
import { auth } from "@/lib/auth";
import { SalesClient } from "./SalesClient";
import { shopDetailsFromSettings } from "@/components/invoice/InvoiceDocuments";

export const dynamic = "force-dynamic";

export default async function SalesPage() {
  const [sales, settings, session] = await Promise.all([getSales(), getSettings(), auth()]);
  const isOwner = session?.user?.role === "OWNER";
  return <SalesClient sales={sales} isOwner={isOwner} shop={shopDetailsFromSettings(settings)} />;
}

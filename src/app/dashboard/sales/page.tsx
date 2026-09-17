import { getSales, getSettings } from "@/lib/data";
import { auth } from "@/lib/auth";
import { SalesClient } from "./SalesClient";
import { shopDetailsFromSettings } from "@/components/invoice/InvoiceDocuments";

export const dynamic = "force-dynamic";

export default async function SalesPage() {
  const [sales, settings, session] = await Promise.all([getSales(), getSettings(), auth()]);
  const isOwner = session?.user?.role === "OWNER";
  // Taking money owed is till work; changing what's on a finished invoice isn't.
  const canEdit = !!session?.user && session.user.role !== "CASHIER";
  return <SalesClient sales={sales} isOwner={isOwner} canEdit={canEdit} shop={shopDetailsFromSettings(settings)} />;
}

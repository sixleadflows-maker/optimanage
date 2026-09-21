import { getSales, getSettings, getCustomers, getUsers } from "@/lib/data";
import { auth } from "@/lib/auth";
import { SalesClient } from "./SalesClient";
import { shopDetailsFromSettings } from "@/components/invoice/InvoiceDocuments";

export const dynamic = "force-dynamic";

export default async function SalesPage() {
  const [sales, settings, customers, users, session] = await Promise.all([
    getSales(), getSettings(), getCustomers(), getUsers(), auth(),
  ]);
  const isOwner = session?.user?.role === "OWNER";
  // Taking money owed is till work; changing what's on a finished invoice isn't.
  const canEdit = !!session?.user && session.user.role !== "CASHIER";
  return (
    <SalesClient
      sales={sales}
      isOwner={isOwner}
      canEdit={canEdit}
      customers={customers.map((c) => ({ id: c.id, name: c.name, phone: c.phone }))}
      staff={users.filter((u) => u.active).map((u) => ({ id: u.id, name: u.name }))}
      shop={shopDetailsFromSettings(settings)}
    />
  );
}

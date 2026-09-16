import { getCustomers } from "@/lib/data";
import { auth } from "@/lib/auth";
import { CustomersClient } from "./CustomersClient";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const [customers, session] = await Promise.all([getCustomers(), auth()]);
  // Cashiers can add customers but not delete them.
  const canDelete = !!session?.user && session.user.role !== "CASHIER";
  return <CustomersClient customers={customers} canDelete={canDelete} />;
}

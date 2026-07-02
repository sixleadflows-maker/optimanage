import { getCustomers } from "@/lib/data";
import { CustomersClient } from "./CustomersClient";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const customers = await getCustomers();
  return <CustomersClient customers={customers} />;
}

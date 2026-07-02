import { getLabOrders, getCustomers } from "@/lib/data";
import { LabOrdersClient } from "./LabOrdersClient";

export const dynamic = "force-dynamic";

export default async function LabOrdersPage() {
  const [labOrders, customers] = await Promise.all([getLabOrders(), getCustomers()]);
  const labCustomers = customers.map((c) => ({ id: c.id, name: c.name }));
  return <LabOrdersClient labOrders={labOrders} customers={labCustomers} />;
}

import { getLabOrders, getCustomers, getLabs } from "@/lib/data";
import { LabOrdersClient } from "./LabOrdersClient";

export const dynamic = "force-dynamic";

export default async function LabOrdersPage() {
  const [labOrders, customers, labs] = await Promise.all([getLabOrders(), getCustomers(), getLabs()]);
  const labCustomers = customers.map((c) => ({ id: c.id, name: c.name }));
  return <LabOrdersClient labOrders={labOrders} customers={labCustomers} labs={labs} />;
}

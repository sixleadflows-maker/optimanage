import { getLabOrders, getCustomers, getLabs } from "@/lib/data";
import { auth } from "@/lib/auth";
import { LabOrdersClient } from "./LabOrdersClient";

export const dynamic = "force-dynamic";

export default async function LabOrdersPage() {
  const [labOrders, customers, labs, session] = await Promise.all([getLabOrders(), getCustomers(), getLabs(), auth()]);
  // With their prescriptions, newest visit first, to pick the one going to the lab.
  const labCustomers = customers.map((c) => ({
    id: c.id, name: c.name, phone: c.phone, phone2: c.phone2, serialNumber: c.serialNumber, prescriptions: c.prescriptions,
  }));
  const canDelete = !!session?.user && session.user.role !== "CASHIER";
  return <LabOrdersClient labOrders={labOrders} customers={labCustomers} labs={labs} canDelete={canDelete} />;
}

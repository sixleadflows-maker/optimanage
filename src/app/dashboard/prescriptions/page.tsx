import { getPrescriptions, getCustomers } from "@/lib/data";
import { PrescriptionsClient } from "./PrescriptionsClient";

export const dynamic = "force-dynamic";

export default async function PrescriptionsPage() {
  const [prescriptions, customers] = await Promise.all([getPrescriptions(), getCustomers()]);
  const rxCustomers = customers.map((c) => ({ id: c.id, name: c.name, phone: c.phone }));
  return <PrescriptionsClient prescriptions={prescriptions} customers={rxCustomers} />;
}

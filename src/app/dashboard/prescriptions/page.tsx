import { getPrescriptions, getCustomers } from "@/lib/data";
import { auth } from "@/lib/auth";
import { PrescriptionsClient } from "./PrescriptionsClient";

export const dynamic = "force-dynamic";

export default async function PrescriptionsPage() {
  const [prescriptions, customers, session] = await Promise.all([getPrescriptions(), getCustomers(), auth()]);
  const rxCustomers = customers.map((c) => ({ id: c.id, name: c.name, phone: c.phone }));
  const canDelete = !!session?.user && session.user.role !== "CASHIER";
  return <PrescriptionsClient prescriptions={prescriptions} customers={rxCustomers} canDelete={canDelete} />;
}

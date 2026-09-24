import { getPrescriptions, getCustomers, getSaleBrief } from "@/lib/data";
import { auth } from "@/lib/auth";
import { PrescriptionsClient } from "./PrescriptionsClient";

export const dynamic = "force-dynamic";

export default async function PrescriptionsPage({ searchParams }: { searchParams: Promise<{ edit?: string; addTo?: string }> }) {
  // ?edit=<id> opens that prescription ready to correct (linked from a customer's
  // history); ?addTo=<invoice id> adds one to an invoice that already exists.
  const { edit, addTo } = await searchParams;
  const [prescriptions, customers, addToSale, session] = await Promise.all([
    getPrescriptions(), getCustomers(), addTo ? getSaleBrief(addTo) : null, auth(),
  ]);
  const rxCustomers = customers.map((c) => ({ id: c.id, name: c.name, phone: c.phone, serialNumber: c.serialNumber }));
  const canDelete = !!session?.user && session.user.role !== "CASHIER";
  return (
    <PrescriptionsClient
      prescriptions={prescriptions}
      customers={rxCustomers}
      canDelete={canDelete}
      initialEditId={edit}
      addToSale={addToSale}
    />
  );
}

import { notFound } from "next/navigation";
import { getCustomer, getCustomerSales, getCustomers, getUsers } from "@/lib/data";
import { auth } from "@/lib/auth";
import { CustomerProfileClient } from "./CustomerProfileClient";

export const dynamic = "force-dynamic";

export default async function CustomerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [customer, sales, customers, users, session] = await Promise.all([
    getCustomer(id), getCustomerSales(id), getCustomers(), getUsers(), auth(),
  ]);
  if (!customer) notFound();
  const canDelete = !!session?.user && session.user.role !== "CASHIER";
  // Changing a finished invoice sits with the same people as on Sales & Invoices.
  const canEdit = canDelete;
  return (
    <CustomerProfileClient
      customer={customer}
      sales={sales}
      canDelete={canDelete}
      canEdit={canEdit}
      customers={customers.map((c) => ({ id: c.id, name: c.name, phone: c.phone }))}
      staff={users.filter((u) => u.active).map((u) => ({ id: u.id, name: u.name }))}
    />
  );
}

import { notFound } from "next/navigation";
import { getCustomer, getCustomerSales } from "@/lib/data";
import { auth } from "@/lib/auth";
import { CustomerProfileClient } from "./CustomerProfileClient";

export const dynamic = "force-dynamic";

export default async function CustomerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [customer, sales, session] = await Promise.all([getCustomer(id), getCustomerSales(id), auth()]);
  if (!customer) notFound();
  const canDelete = !!session?.user && session.user.role !== "CASHIER";
  return <CustomerProfileClient customer={customer} sales={sales} canDelete={canDelete} />;
}

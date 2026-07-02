import { notFound } from "next/navigation";
import { getCustomer, getCustomerSales } from "@/lib/data";
import { CustomerProfileClient } from "./CustomerProfileClient";

export const dynamic = "force-dynamic";

export default async function CustomerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [customer, sales] = await Promise.all([getCustomer(id), getCustomerSales(id)]);
  if (!customer) notFound();
  return <CustomerProfileClient customer={customer} sales={sales} />;
}

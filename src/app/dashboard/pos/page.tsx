import { getProducts, getCustomers } from "@/lib/data";
import { POSClient } from "./POSClient";

export const dynamic = "force-dynamic";

export default async function POSPage() {
  const [products, customers] = await Promise.all([getProducts(), getCustomers()]);
  const posCustomers = customers.map((c) => ({ id: c.id, name: c.name, phone: c.phone }));
  return <POSClient products={products} customers={posCustomers} />;
}

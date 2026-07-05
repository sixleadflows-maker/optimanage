import { getProducts, getCustomers, getUsers } from "@/lib/data";
import { auth } from "@/lib/auth";
import { POSClient } from "./POSClient";

export const dynamic = "force-dynamic";

export default async function POSPage() {
  const [products, customers, users, session] = await Promise.all([
    getProducts(), getCustomers(), getUsers(), auth(),
  ]);
  const posCustomers = customers.map((c) => ({ id: c.id, name: c.name, phone: c.phone }));
  const staff = users.filter((u) => u.active).map((u) => ({ id: u.id, name: u.name }));
  const canSeeCosts = session?.user?.role !== "CASHIER";
  return (
    <POSClient
      products={products}
      customers={posCustomers}
      staff={staff}
      currentUserId={session?.user?.id ?? ""}
      canSeeCosts={canSeeCosts}
    />
  );
}

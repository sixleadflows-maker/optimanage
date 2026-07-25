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
  // No cost/profit is passed to the till at all — the screen faces customers,
  // and those figures live in Analytics instead.
  return (
    <POSClient
      products={products}
      customers={posCustomers}
      staff={staff}
      currentUserId={session?.user?.id ?? ""}
    />
  );
}

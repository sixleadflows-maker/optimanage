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
  // Cost & profit are owner-only across the app — hidden from cashiers and
  // managers (and never shown to customers looking at the screen).
  const canSeeCosts = session?.user?.role === "OWNER";
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

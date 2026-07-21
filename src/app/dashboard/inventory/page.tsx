import { getProducts } from "@/lib/data";
import { auth } from "@/lib/auth";
import { InventoryClient } from "./InventoryClient";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const [products, session] = await Promise.all([getProducts(), auth()]);
  const isOwner = session?.user?.role === "OWNER";
  return <InventoryClient products={products} isOwner={isOwner} />;
}

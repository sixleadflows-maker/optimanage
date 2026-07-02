import { getProducts } from "@/lib/data";
import { InventoryClient } from "./InventoryClient";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const products = await getProducts();
  return <InventoryClient products={products} />;
}

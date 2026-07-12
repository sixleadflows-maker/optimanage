import { getStorefrontProducts } from "@/lib/data";
import { StorefrontClient } from "./StorefrontClient";

export const dynamic = "force-dynamic";

export default async function ShopPage() {
  const products = await getStorefrontProducts();
  return <StorefrontClient products={products} />;
}

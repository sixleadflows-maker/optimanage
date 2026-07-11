import { getSuppliers, getPurchaseOrders, getProducts } from "@/lib/data";
import { SuppliersClient } from "./SuppliersClient";

export const dynamic = "force-dynamic";

export default async function SuppliersPage() {
  const [suppliers, purchaseOrders, products] = await Promise.all([getSuppliers(), getPurchaseOrders(), getProducts()]);
  return <SuppliersClient suppliers={suppliers} purchaseOrders={purchaseOrders} products={products} />;
}

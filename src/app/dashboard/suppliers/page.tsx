import { getSuppliers, getPurchaseOrders } from "@/lib/data";
import { SuppliersClient } from "./SuppliersClient";

export const dynamic = "force-dynamic";

export default async function SuppliersPage() {
  const [suppliers, purchaseOrders] = await Promise.all([getSuppliers(), getPurchaseOrders()]);
  return <SuppliersClient suppliers={suppliers} purchaseOrders={purchaseOrders} />;
}

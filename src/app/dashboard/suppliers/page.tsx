import { getSuppliers, getPurchaseOrders, getProducts } from "@/lib/data";
import { auth } from "@/lib/auth";
import { SuppliersClient } from "./SuppliersClient";

export const dynamic = "force-dynamic";

export default async function SuppliersPage() {
  const [suppliers, purchaseOrders, products, session] = await Promise.all([
    getSuppliers(), getPurchaseOrders(), getProducts(), auth(),
  ]);
  const canDelete = !!session?.user && session.user.role !== "CASHIER";
  return <SuppliersClient suppliers={suppliers} purchaseOrders={purchaseOrders} products={products} canDelete={canDelete} />;
}

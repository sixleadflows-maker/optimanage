import { getProducts, getStockAdjustments } from "@/lib/data";
import { auth } from "@/lib/auth";
import { AdjustmentsClient } from "./AdjustmentsClient";

export const dynamic = "force-dynamic";

export default async function AdjustmentsPage() {
  const [products, adjustments, session] = await Promise.all([getProducts(), getStockAdjustments(), auth()]);
  // Correcting a recorded count moves the shelf figure, so cashiers can record
  // an adjustment but not rewrite one.
  const canManage = !!session?.user && session.user.role !== "CASHIER";
  return <AdjustmentsClient products={products} adjustments={adjustments} canManage={canManage} />;
}

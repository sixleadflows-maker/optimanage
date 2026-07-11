import { getProducts, getStockAdjustments } from "@/lib/data";
import { AdjustmentsClient } from "./AdjustmentsClient";

export const dynamic = "force-dynamic";

export default async function AdjustmentsPage() {
  const [products, adjustments] = await Promise.all([getProducts(), getStockAdjustments()]);
  return <AdjustmentsClient products={products} adjustments={adjustments} />;
}

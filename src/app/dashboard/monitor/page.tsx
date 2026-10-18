import { getDashboardData, getProducts, getSales } from "@/lib/data";
import { MonitorClient } from "./MonitorClient";

export const dynamic = "force-dynamic";

export default async function MonitorPage() {
  const [dashboard, products, sales] = await Promise.all([
    getDashboardData(),
    getProducts(),
    getSales(),
  ]);

  const stockAlerts = products
    .filter((p) => p.stock <= p.lowStockThreshold)
    .sort((a, b) => a.stock - b.stock);

  return (
    <MonitorClient
      dashboard={dashboard}
      stockAlerts={stockAlerts}
      sales={sales}
    />
  );
}

import { getDashboardData, getProducts, getSales } from "@/lib/data";
import { auth } from "@/lib/auth";
import { MonitorClient } from "./MonitorClient";

export const dynamic = "force-dynamic";

export default async function MonitorPage() {
  const [dashboard, products, sales, session] = await Promise.all([
    getDashboardData(),
    getProducts(),
    getSales(),
    auth(),
  ]);

  const canSeeCosts = session?.user?.role !== "CASHIER";
  const stockAlerts = products
    .filter((p) => p.stock <= p.lowStockThreshold)
    .sort((a, b) => a.stock - b.stock);

  return (
    <MonitorClient
      dashboard={dashboard}
      stockAlerts={stockAlerts}
      sales={sales}
      canSeeCosts={canSeeCosts}
    />
  );
}

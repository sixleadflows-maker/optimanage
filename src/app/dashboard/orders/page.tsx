import { getSales, getSettings } from "@/lib/data";
import { shopDetailsFromSettings } from "@/components/invoice/InvoiceDocuments";
import { OrdersClient, type OrderRow } from "./OrdersClient";

export const dynamic = "force-dynamic";

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  // ?order=process|ready|delivered|cancelled opens that tab (from the dashboard).
  const { order } = await searchParams;
  const [sales, settings] = await Promise.all([getSales(), getSettings()]);
  // Only bills that are orders: one handed over at the counter has no status.
  const orders: OrderRow[] = sales.filter((s) => s.orderStatus).map((s) => ({
    id: s.id, invoiceNo: s.invoiceNo, offlineRef: s.offlineRef, dateTime: s.dateTime,
    customerId: s.customerId, customerName: s.customerName,
    customerPhone: s.customerPhone, customerPhone2: s.customerPhone2, customerSerial: s.customerSerial,
    orderStatus: s.orderStatus, balance: s.balance, source: s.source, fulfillmentType: s.fulfillmentType,
    items: [...s.items.map((i) => i.productName), ...(s.customLensName ? [s.customLensName] : [])],
  }));
  return <OrdersClient orders={orders} shopName={shopDetailsFromSettings(settings).name} initialTab={order} />;
}

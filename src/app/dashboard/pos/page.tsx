import { getProducts, getCustomers, getUsers, getSettings } from "@/lib/data";
import { auth } from "@/lib/auth";
import { POSClient, type POSRx } from "./POSClient";
import { shopDetailsFromSettings } from "@/components/invoice/InvoiceDocuments";

export const dynamic = "force-dynamic";

export default async function POSPage() {
  const [products, customers, users, settings, session] = await Promise.all([
    getProducts(), getCustomers(), getUsers(), getSettings(), auth(),
  ]);
  const posCustomers = customers.map((c) => {
    // Newest first (getCustomers orders them): the till starts a new Rx from it.
    const last = c.prescriptions[0];
    const latestRx: POSRx | null = last
      ? {
          id: last.id,
          date: last.date,
          rightSph: last.rightEye.sph, rightCyl: last.rightEye.cyl, rightAxis: last.rightEye.axis,
          rightPd: last.rightEye.pd, rightAdd: last.rightEye.add,
          leftSph: last.leftEye.sph, leftCyl: last.leftEye.cyl, leftAxis: last.leftEye.axis,
          leftPd: last.leftEye.pd, leftAdd: last.leftEye.add,
          notes: last.notes,
          isOwn: last.isOwnPrescription,
        }
      : null;
    return { id: c.id, name: c.name, phone: c.phone, serialNumber: c.serialNumber, latestRx };
  });
  const staff = users.filter((u) => u.active).map((u) => ({ id: u.id, name: u.name }));
  // No cost/profit is passed to the till at all — the screen faces customers,
  // and those figures live in Analytics instead.
  return (
    <POSClient
      products={products}
      customers={posCustomers}
      staff={staff}
      currentUserId={session?.user?.id ?? ""}
      shop={shopDetailsFromSettings(settings)}
      canBackdate={!!session?.user && session.user.role !== "CASHIER"}
    />
  );
}

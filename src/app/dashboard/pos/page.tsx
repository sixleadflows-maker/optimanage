import { getProducts, getCustomers, getUsers, getSettings, getLastInvoiceStaff } from "@/lib/data";
import { auth } from "@/lib/auth";
import { POSClient, type POSRx } from "./POSClient";
import { shopDetailsFromSettings } from "@/components/invoice/InvoiceDocuments";

export const dynamic = "force-dynamic";

export default async function POSPage() {
  const [products, customers, users, settings, lastStaff, session] = await Promise.all([
    getProducts(), getCustomers(), getUsers(), getSettings(), getLastInvoiceStaff(), auth(),
  ]);
  const posCustomers = customers.map((c) => {
    // Newest first (getCustomers orders them): the till starts a new Rx from it.
    const last = c.prescriptions[0];
    const latestRx: POSRx | null = last
      ? {
          id: last.id,
          date: last.date,
          label: last.label,
          rightSph: last.rightEye.sph, rightCyl: last.rightEye.cyl, rightAxis: last.rightEye.axis,
          rightPd: last.rightEye.pd, rightAdd: last.rightEye.add,
          leftSph: last.leftEye.sph, leftCyl: last.leftEye.cyl, leftAxis: last.leftEye.axis,
          leftPd: last.leftEye.pd, leftAdd: last.leftEye.add,
          // A note hidden in the history stays off the till screen too.
          notes: last.notesHidden ? "" : last.notes,
          isOwn: last.isOwnPrescription,
        }
      : null;
    return { id: c.id, name: c.name, phone: c.phone, serialNumber: c.serialNumber, latestRx };
  });
  const staff = users.filter((u) => u.active).map((u) => ({ id: u.id, name: u.name }));
  const currentUserId = session?.user?.id ?? "";
  // Start with whoever was on the last bill (if they're still on the staff).
  const stillHere = (id: string | null) => (id && staff.some((m) => m.id === id) ? id : currentUserId);
  // No cost/profit is passed to the till at all — the screen faces customers,
  // and those figures live in Analytics instead.
  return (
    <POSClient
      products={products}
      customers={posCustomers}
      staff={staff}
      currentUserId={currentUserId}
      defaultOrderTakenBy={stillHere(lastStaff.orderTakenById)}
      defaultBillGeneratedBy={stillHere(lastStaff.billGeneratedById)}
      shop={shopDetailsFromSettings(settings)}
      canBackdate={!!session?.user && session.user.role !== "CASHIER"}
      canEditBill={!!session?.user && session.user.role !== "CASHIER"}
    />
  );
}

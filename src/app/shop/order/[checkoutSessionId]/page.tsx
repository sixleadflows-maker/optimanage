import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { OrderStatusClient } from "./OrderStatusClient";

export const dynamic = "force-dynamic";

export default async function OrderConfirmationPage({ params }: { params: Promise<{ checkoutSessionId: string }> }) {
  const { checkoutSessionId } = await params;

  const session = await db.checkoutSession.findUnique({ where: { id: checkoutSessionId } });
  if (!session) notFound();

  const sale = session.saleId ? await db.sale.findUnique({ where: { id: session.saleId } }) : null;

  return (
    <OrderStatusClient
      checkoutSessionId={checkoutSessionId}
      initialStatus={session.status}
      initialInvoiceNo={sale?.invoiceNo}
      initialTotal={sale?.total}
      fulfillmentType={session.fulfillmentType}
      failureReason={session.failureReason}
    />
  );
}

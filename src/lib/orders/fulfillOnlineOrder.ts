import { db } from "@/lib/db";
import { persistSale, type SaleCoreItem } from "@/lib/sales/core";

interface CartItemSnapshot {
  productId: string;
  quantity: number;
  unitPrice: number;
}

export async function fulfillOnlineOrder(checkoutSessionId: string) {
  const session = await db.checkoutSession.findUnique({ where: { id: checkoutSessionId } });
  if (!session) throw new Error("Checkout session not found");

  // Idempotent — the webhook and the confirmation-page fallback can both race to fulfill.
  if (session.saleId) {
    return { ok: true as const, saleId: session.saleId };
  }
  if (session.status === "FAILED" || session.status === "EXPIRED") {
    return { ok: false as const, error: session.failureReason || "Payment was not completed" };
  }

  const items = session.cartItems as unknown as CartItemSnapshot[];
  const saleItems: SaleCoreItem[] = items.map((i) => ({
    productId: i.productId,
    quantity: i.quantity,
    unitPrice: i.unitPrice,
    discount: 0,
  }));

  let customer = await db.customer.findUnique({ where: { phone: session.customerPhone } });
  if (!customer) {
    customer = await db.customer.create({
      data: { name: session.customerName, phone: session.customerPhone, email: session.customerEmail },
    });
  }

  try {
    const result = await persistSale(
      {
        items: saleItems,
        customerId: customer.id,
        paymentMethod: "Swich",
        paymentType: "Full",
        advanceAmount: 0,
        invoiceDiscount: 0,
      },
      {
        source: "ONLINE",
        fulfillmentType: session.fulfillmentType,
        deliveryAddress: session.deliveryAddress,
        deliveryFee: session.deliveryFee,
        skipRevalidate: true,
      }
    );

    await db.checkoutSession.update({
      where: { id: checkoutSessionId },
      data: { status: "PAID", saleId: result.saleId },
    });

    return { ok: true as const, saleId: result.saleId, invoiceNo: result.invoiceNo };
  } catch (e) {
    // Payment was already captured by the gateway at this point — this is now a
    // manual-refund situation (e.g. stock ran out between checkout and payment),
    // not something to fail silently on.
    const failureReason = e instanceof Error ? e.message : "Could not create the order";
    await db.checkoutSession.update({
      where: { id: checkoutSessionId },
      data: { status: "FAILED", failureReason },
    });
    return { ok: false as const, error: failureReason };
  }
}

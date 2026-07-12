"use server";

import { db } from "@/lib/db";
import { getSettings } from "@/lib/data";
import { createSwichCheckoutSession } from "@/lib/payments/swich";
import { fulfillOnlineOrder } from "@/lib/orders/fulfillOnlineOrder";

export interface StorefrontCartItem {
  productId: string;
  quantity: number;
}

export interface InitiateCheckoutInput {
  items: StorefrontCartItem[];
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  fulfillmentType: "PICKUP" | "DELIVERY";
  deliveryAddress: string;
  returnUrlBase: string;
}

export async function initiateCheckout(input: InitiateCheckoutInput) {
  if (!input.items.length) throw new Error("Your cart is empty");
  if (!input.customerName.trim() || !input.customerPhone.trim()) {
    throw new Error("Name and phone are required");
  }
  if (input.fulfillmentType === "DELIVERY" && !input.deliveryAddress.trim()) {
    throw new Error("Delivery address is required");
  }

  // Re-validate real prices/stock server-side — the client cart is never trusted.
  const productIds = input.items.map((i) => i.productId);
  const products = await db.product.findMany({ where: { id: { in: productIds }, active: true } });
  const productMap = new Map(products.map((p) => [p.id, p]));

  let subtotal = 0;
  const cartSnapshot = input.items.map((i) => {
    const product = productMap.get(i.productId);
    if (!product) throw new Error("One of the items in your cart is no longer available");
    if (!Number.isInteger(i.quantity) || i.quantity < 1) throw new Error("Invalid quantity");
    if (product.stock < i.quantity) throw new Error(`Only ${product.stock} left in stock for ${product.name}`);
    subtotal += product.salePrice * i.quantity;
    return { productId: product.id, quantity: i.quantity, unitPrice: product.salePrice };
  });

  const settings = await getSettings();
  const deliveryFee = input.fulfillmentType === "DELIVERY" ? settings.deliveryFee : 0;
  const total = subtotal + deliveryFee;

  const session = await db.checkoutSession.create({
    data: {
      status: "PENDING",
      cartItems: cartSnapshot,
      subtotal,
      deliveryFee,
      total,
      fulfillmentType: input.fulfillmentType,
      deliveryAddress: input.fulfillmentType === "DELIVERY" ? input.deliveryAddress.trim() : "",
      customerName: input.customerName.trim(),
      customerPhone: input.customerPhone.trim(),
      customerEmail: input.customerEmail.trim(),
    },
  });

  const returnUrl = `${input.returnUrlBase}/shop/order/${session.id}`;

  try {
    const { redirectUrl, gatewayRef } = await createSwichCheckoutSession({
      reference: session.id,
      amount: total,
      description: `OptiManage order ${session.id}`,
      customerName: session.customerName,
      customerEmail: session.customerEmail,
      customerPhone: session.customerPhone,
      returnUrl,
    });
    await db.checkoutSession.update({ where: { id: session.id }, data: { gatewayRef } });
    return { redirectUrl, checkoutSessionId: session.id };
  } catch (e) {
    await db.checkoutSession.update({
      where: { id: session.id },
      data: { status: "FAILED", failureReason: e instanceof Error ? e.message : "Payment setup failed" },
    });
    throw e;
  }
}

// The order-confirmation page can't call fulfillOnlineOrder() directly during its own
// render — revalidatePath() is only valid from a Server Action or Route Handler. This
// wraps it so the confirmation page's client-side fallback goes through a real action.
export async function confirmCheckoutSession(checkoutSessionId: string) {
  await fulfillOnlineOrder(checkoutSessionId);
  const session = await db.checkoutSession.findUnique({ where: { id: checkoutSessionId } });
  if (!session) throw new Error("Checkout session not found");
  const sale = session.saleId ? await db.sale.findUnique({ where: { id: session.saleId } }) : null;
  return {
    status: session.status,
    invoiceNo: sale?.invoiceNo,
    total: sale?.total,
    failureReason: session.failureReason,
  };
}

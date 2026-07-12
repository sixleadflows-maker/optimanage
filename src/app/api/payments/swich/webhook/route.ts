import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifySwichWebhookSignature } from "@/lib/payments/swich";
import { fulfillOnlineOrder } from "@/lib/orders/fulfillOnlineOrder";

// Payload field names below are placeholders until Swich's real webhook format
// is confirmed against their docs/dashboard — adjust once that's available.
interface SwichWebhookPayload {
  reference?: string;
  status?: string;
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-swich-signature");

  if (!verifySwichWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: SwichWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const reference = payload.reference;
  if (!reference) return NextResponse.json({ error: "Missing reference" }, { status: 400 });

  const session = await db.checkoutSession.findUnique({ where: { id: reference } });
  if (!session) return NextResponse.json({ error: "Unknown checkout session" }, { status: 404 });

  if (payload.status === "PAID") {
    const result = await fulfillOnlineOrder(reference);
    return NextResponse.json(result);
  }

  await db.checkoutSession.update({
    where: { id: reference },
    data: { status: "FAILED", failureReason: `Gateway reported status: ${payload.status}` },
  });
  return NextResponse.json({ ok: true });
}

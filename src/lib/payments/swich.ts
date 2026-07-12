import crypto from "crypto";

export interface CreateCheckoutSessionInput {
  reference: string;
  amount: number;
  description: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  returnUrl: string;
}

export interface CreateCheckoutSessionResult {
  redirectUrl: string;
  gatewayRef: string;
}

export type SwichPaymentStatus = "PAID" | "PENDING" | "FAILED";

// Mock mode is used until a real Swich merchant account + API docs are available
// (SWICH_API_KEY unset). It simulates an instantly-successful payment so the full
// storefront -> checkout -> real sale pipeline is buildable and demoable today.
export function isSwichLiveMode() {
  return !!process.env.SWICH_API_KEY;
}

export async function createSwichCheckoutSession(
  input: CreateCheckoutSessionInput
): Promise<CreateCheckoutSessionResult> {
  if (!isSwichLiveMode()) {
    const gatewayRef = `mock_${crypto.randomUUID()}`;
    return { redirectUrl: `${input.returnUrl}?mock=1`, gatewayRef };
  }

  throw new Error(
    "Swich live mode is not implemented yet — SWICH_API_KEY is set but the real API call " +
      "in createSwichCheckoutSession() still needs to be written against Swich's actual docs."
  );
}

export async function checkSwichPaymentStatus(gatewayRef: string): Promise<SwichPaymentStatus> {
  if (!isSwichLiveMode()) {
    return gatewayRef.startsWith("mock_") ? "PAID" : "FAILED";
  }

  throw new Error(
    "Swich live mode is not implemented yet — checkSwichPaymentStatus() still needs to call " +
      "Swich's real payment-status endpoint before this can safely confirm a payment."
  );
}

// Fails closed: in live mode, an unverifiable webhook is rejected rather than trusted,
// so this can never silently become an unauthenticated "mark anything as paid" endpoint.
export function verifySwichWebhookSignature(_rawBody: string, _signatureHeader: string | null): boolean {
  if (!isSwichLiveMode()) return true;
  return false;
}

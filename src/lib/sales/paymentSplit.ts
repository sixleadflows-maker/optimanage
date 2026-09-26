import { PAYMENT_METHODS } from "@/lib/constants";

// A customer paying part by one method and part by another (some cash, the
// rest on card). Shared by the till, the invoice editor and the cash reports,
// so the split is worked out the same way everywhere.

// A type alias (not an interface) so it can be stored as Prisma JSON as-is.
export type PaymentPart = {
  method: string;
  amount: number;
};

// The till's own choice for "more than one method" -- never stored as a
// sale's paymentMethod, which gets the methods' names instead.
export const SPLIT_METHOD = "Split";

const methodOrder = (m: string) => {
  const i = (PAYMENT_METHODS as readonly string[]).indexOf(m);
  return i < 0 ? PAYMENT_METHODS.length : i;
};

/** Parts with an amount only, one per method, in the till's usual method order. */
export function normalizeSplit(parts: PaymentPart[]): PaymentPart[] {
  const byMethod = new Map<string, number>();
  for (const p of parts) {
    const amount = Math.round((Number(p.amount) || 0) * 100) / 100;
    if (amount <= 0) continue;
    byMethod.set(p.method, Math.round(((byMethod.get(p.method) ?? 0) + amount) * 100) / 100);
  }
  return [...byMethod]
    .map(([method, amount]) => ({ method, amount }))
    .sort((a, b) => methodOrder(a.method) - methodOrder(b.method));
}

export const splitTotal = (parts: PaymentPart[]) => Math.round(parts.reduce((sum, p) => sum + p.amount, 0) * 100) / 100;

/** "Cash + Card" -- how a split payment reads on the bill and in lists. */
export const splitLabel = (parts: PaymentPart[]) => parts.map((p) => p.method).join(" + ");

/** A sale's stored split, or none. */
export function readSplit(value: unknown): PaymentPart[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((p) =>
    p && typeof p.method === "string" && typeof p.amount === "number" ? [{ method: p.method, amount: p.amount }] : []
  );
}

/** How the money taken at the till divides between methods. */
export function tillParts(sale: { paymentMethod: string; paymentSplit: unknown }, takenAtTill: number): PaymentPart[] {
  const split = readSplit(sale.paymentSplit);
  return split.length ? split : [{ method: sale.paymentMethod, amount: takenAtTill }];
}

/**
 * The method and split to store for what staff entered: two or more methods
 * are a split, one is just that method.
 */
export function paymentFromParts(parts: PaymentPart[], fallbackMethod: string) {
  const split = normalizeSplit(parts);
  if (split.length > 1) return { paymentMethod: splitLabel(split), paymentSplit: split };
  return { paymentMethod: split[0]?.method ?? fallbackMethod, paymentSplit: [] as PaymentPart[] };
}

/** A single method to start a follow-up payment or refund with. */
export const primaryMethod = (sale: { paymentMethod: string; paymentSplit: PaymentPart[] }) =>
  sale.paymentSplit[0]?.method ?? sale.paymentMethod;

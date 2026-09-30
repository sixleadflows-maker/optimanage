export type InvoiceStatus = "PAID" | "ADVANCE" | "BALANCE";

/**
 * Where an invoice stands once its total or its payments change. Paid in full
 * is "Full Payment" and nothing paid is "Balance". Part paid keeps the label it
 * was given -- a customer on "Balance" who pays Rs.1,500 of Rs.1,800 is still on
 * Balance with Rs.300 to go -- and is "Advance" otherwise.
 */
export function settleInvoice(total: number, paid: number, partLabel?: InvoiceStatus) {
  const balance = Math.max(0, Math.round((total - paid) * 100) / 100);
  const status: InvoiceStatus =
    balance <= 0 ? "PAID" : paid <= 0 ? "BALANCE" : partLabel === "BALANCE" ? "BALANCE" : "ADVANCE";
  return { balance, status };
}

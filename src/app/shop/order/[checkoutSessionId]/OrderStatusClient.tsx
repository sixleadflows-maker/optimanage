"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { CheckCircle2, XCircle, Clock } from "lucide-react";
import { formatCurrency } from "@/lib/utils/format";
import { confirmCheckoutSession } from "@/lib/actions/storefront";

interface Props {
  checkoutSessionId: string;
  initialStatus: string;
  initialInvoiceNo?: string;
  initialTotal?: number;
  fulfillmentType: string | null;
  failureReason: string;
}

export function OrderStatusClient({
  checkoutSessionId,
  initialStatus,
  initialInvoiceNo,
  initialTotal,
  fulfillmentType,
  failureReason,
}: Props) {
  const [status, setStatus] = useState(initialStatus);
  const [invoiceNo, setInvoiceNo] = useState(initialInvoiceNo);
  const [total, setTotal] = useState(initialTotal);
  const [reason, setReason] = useState(failureReason);
  const [checking, setChecking] = useState(initialStatus === "PENDING");

  useEffect(() => {
    if (initialStatus !== "PENDING") return;
    confirmCheckoutSession(checkoutSessionId)
      .then((result) => {
        setStatus(result.status);
        setInvoiceNo(result.invoiceNo);
        setTotal(result.total);
        setReason(result.failureReason);
      })
      .finally(() => setChecking(false));
    // Only run once on mount — this is a one-shot confirmation check, not a live subscription.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (checking) {
    return (
      <div className="max-w-lg mx-auto animate-fade-in">
        <div className="glass-card p-8 text-center space-y-3">
          <Clock className="w-12 h-12 text-warning mx-auto animate-pulse" />
          <h1 className="text-xl font-bold">Confirming your payment...</h1>
          <p className="text-sm text-muted-foreground">This will only take a moment.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto animate-fade-in">
      <div className="glass-card p-8 text-center space-y-3">
        {status === "PAID" && invoiceNo ? (
          <>
            <CheckCircle2 className="w-12 h-12 text-success mx-auto" />
            <h1 className="text-xl font-bold">Order Confirmed!</h1>
            <p className="text-sm text-muted-foreground">Your order number is</p>
            <p className="text-lg font-bold text-primary">{invoiceNo}</p>
            <p className="text-sm text-muted-foreground pt-2">
              Total: {formatCurrency(total ?? 0)} ·{" "}
              {fulfillmentType === "DELIVERY" ? "We'll deliver to your address" : "Ready for pickup in store"}
            </p>
          </>
        ) : status === "FAILED" ? (
          <>
            <XCircle className="w-12 h-12 text-destructive mx-auto" />
            <h1 className="text-xl font-bold">Something went wrong</h1>
            <p className="text-sm text-muted-foreground">{reason || "Your payment could not be completed."}</p>
            <p className="text-xs text-muted-foreground">If you were charged, our staff will contact you shortly to sort it out.</p>
          </>
        ) : (
          <>
            <Clock className="w-12 h-12 text-warning mx-auto" />
            <h1 className="text-xl font-bold">Payment Pending</h1>
            <p className="text-sm text-muted-foreground">We haven&apos;t received confirmation yet — refresh this page in a moment.</p>
          </>
        )}
        <Link href="/shop" className="inline-block mt-4 text-sm font-medium text-primary hover:underline">
          Back to shop
        </Link>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCart } from "@/lib/cart-context";
import { useApp } from "@/lib/context";
import { formatCurrency } from "@/lib/utils/format";
import { initiateCheckout } from "@/lib/actions/storefront";

export function CheckoutClient() {
  const { lines, subtotal, clear } = useCart();
  const { showToast } = useApp();
  const router = useRouter();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [fulfillmentType, setFulfillmentType] = useState<"PICKUP" | "DELIVERY">("PICKUP");
  const [address, setAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (lines.length === 0) {
    return (
      <div className="glass-card p-10 text-center space-y-3 animate-fade-in">
        <p className="text-sm text-muted-foreground">Your cart is empty.</p>
        <Link href="/shop" className="text-sm font-medium text-primary hover:underline">
          Continue shopping
        </Link>
      </div>
    );
  }

  const handleSubmit = async () => {
    if (!name.trim() || !phone.trim()) {
      showToast("Name and phone are required", "error");
      return;
    }
    if (fulfillmentType === "DELIVERY" && !address.trim()) {
      showToast("Delivery address is required", "error");
      return;
    }
    setSubmitting(true);
    try {
      const { redirectUrl } = await initiateCheckout({
        items: lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
        customerName: name,
        customerPhone: phone,
        customerEmail: email,
        fulfillmentType,
        deliveryAddress: address,
        returnUrlBase: window.location.origin,
      });
      clear();
      router.push(redirectUrl);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Could not start checkout", "error");
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 animate-fade-in max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold">Checkout</h1>

      <div className="glass-card p-5 space-y-4">
        <h3 className="text-sm font-semibold">Your Details</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Full Name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-4 py-2.5 glass-input text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Phone *</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full px-4 py-2.5 glass-input text-sm" />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-2.5 glass-input text-sm" />
          </div>
        </div>
      </div>

      <div className="glass-card p-5 space-y-4">
        <h3 className="text-sm font-semibold">Fulfillment</h3>
        <div className="flex gap-2">
          <button
            onClick={() => setFulfillmentType("PICKUP")}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${fulfillmentType === "PICKUP" ? "bg-primary text-white" : "bg-surface hover:bg-surface-hover"}`}
          >
            Pickup in Store
          </button>
          <button
            onClick={() => setFulfillmentType("DELIVERY")}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${fulfillmentType === "DELIVERY" ? "bg-primary text-white" : "bg-surface hover:bg-surface-hover"}`}
          >
            Delivery
          </button>
        </div>
        {fulfillmentType === "DELIVERY" && (
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Delivery Address *</label>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={2}
              className="w-full px-4 py-2.5 glass-input text-sm resize-none"
            />
          </div>
        )}
      </div>

      <div className="glass-card p-5 space-y-2">
        <h3 className="text-sm font-semibold mb-2">Order Summary</h3>
        {lines.map((l) => (
          <div key={l.productId} className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              {l.name} × {l.quantity}
            </span>
            <span>{formatCurrency(l.salePrice * l.quantity)}</span>
          </div>
        ))}
        <div className="flex justify-between text-sm pt-2 border-t border-border">
          <span className="text-muted-foreground">Subtotal</span>
          <span>{formatCurrency(subtotal)}</span>
        </div>
        {fulfillmentType === "DELIVERY" && <p className="text-xs text-muted-foreground">Delivery fee calculated at payment</p>}
      </div>

      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full py-3 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-60"
      >
        {submitting ? "Redirecting to payment..." : "Pay Now"}
      </button>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SaleView } from "@/lib/data";
import { useApp } from "@/lib/context";
import { updateOrderStatus } from "@/lib/actions/sales";
import { ORDER_STATUSES, SHOP_NAME, isReadyStatus, orderStatusChipClass } from "@/lib/constants";
import { waNumber } from "@/lib/utils/phone";
import { MessageCircle } from "lucide-react";

/**
 * Where an order is -- in process, ready to pick up or deliver, delivered --
 * changed from wherever the order is on screen. Once it's ready, a WhatsApp
 * button tells the customer.
 */
export function OrderStatusControl({
  sale, shopName = SHOP_NAME,
}: {
  sale: Pick<SaleView, "id" | "invoiceNo" | "orderStatus" | "customerName" | "customerPhone">;
  shopName?: string;
}) {
  const { showToast } = useApp();
  const router = useRouter();
  // The pick shows straight away, until the page catches up (or the save fails).
  const [pending, setPending] = useState<{ label: string; from: string } | null>(null);
  const current = sale.orderStatus ?? "";
  const value = pending && pending.from === current ? pending.label : current;

  const change = async (label: string) => {
    setPending({ label, from: current });
    try {
      const res = await updateOrderStatus(sale.id, ORDER_STATUSES.find((o) => o.label === label)?.value ?? null);
      if (!res.ok) {
        showToast(res.error, "error");
        setPending(null);
        return;
      }
      showToast(label ? `${sale.invoiceNo}: ${label}` : `${sale.invoiceNo}: no status — handed over`, "success");
      router.refresh();
    } catch {
      showToast("Couldn't change the status — check the connection and try again", "error");
      setPending(null);
    }
  };

  const phone = waNumber(sale.customerPhone);
  const name = sale.customerName && sale.customerName !== "Walk-in" ? ` ${sale.customerName}` : "";
  const message = value === "Ready to deliver"
    ? `Assalam-o-Alaikum${name}! Your order ${sale.invoiceNo} is ready and will be delivered to you soon. — ${shopName}`
    : `Assalam-o-Alaikum${name}! Your order ${sale.invoiceNo} is ready. You can pick it up from ${shopName}.`;

  return (
    <div className="inline-flex items-center gap-1">
      <select
        value={value}
        onChange={(e) => void change(e.target.value)}
        aria-label={`Order status for ${sale.invoiceNo}`}
        className={`px-2 py-1 rounded-lg text-[11px] font-semibold border-0 cursor-pointer ${orderStatusChipClass(value)}`}
      >
        <option value="">No status (handed over)</option>
        {ORDER_STATUSES.map((o) => <option key={o.value} value={o.label}>{o.label}</option>)}
      </select>
      {isReadyStatus(value) && phone && (
        <a href={`https://wa.me/${phone}?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer"
          title="Tell the customer on WhatsApp" className="p-1 rounded-md hover:bg-surface-hover">
          <MessageCircle className="w-3.5 h-3.5 text-[#25D366]" />
        </a>
      )}
    </div>
  );
}

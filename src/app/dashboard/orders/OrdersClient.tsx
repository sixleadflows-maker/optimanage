"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { SaleView } from "@/lib/data";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { isReadyStatus } from "@/lib/constants";
import { OrderStatusControl } from "@/components/invoice/OrderStatusControl";
import { EmptyState } from "@/components/ui/EmptyState";
import { matchesSearch } from "@/lib/utils/search";
import { PackageCheck, Search } from "lucide-react";

export type OrderRow = Pick<SaleView,
  "id" | "invoiceNo" | "offlineRef" | "dateTime" | "customerId" | "customerName" | "customerPhone" |
  "customerPhone2" | "customerSerial" | "orderStatus" | "balance" | "source" | "fulfillmentType"
> & { items: string[] };

const TABS = [
  { key: "process", label: "In process" },
  { key: "ready", label: "Ready" },
  { key: "delivered", label: "Delivered" },
  { key: "cancelled", label: "Cancelled" },
  { key: "all", label: "All" },
] as const;
type Tab = (typeof TABS)[number]["key"];

const inTab = (o: OrderRow, t: Tab) =>
  t === "all" ||
  (t === "process" && o.orderStatus === "In process") ||
  (t === "ready" && isReadyStatus(o.orderStatus)) ||
  (t === "delivered" && o.orderStatus === "Delivered") ||
  (t === "cancelled" && o.orderStatus === "Cancelled");

// Orders still to finish read oldest first, so whoever has waited longest is on top.
const isWaitingTab = (t: Tab) => t === "process" || t === "ready";

function waitingFor(dateTime: string) {
  const days = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(dateTime).setHours(0, 0, 0, 0)) / 86_400_000);
  return days <= 0 ? "since today" : days === 1 ? "1 day" : `${days} days`;
}

/**
 * Every order and where it is: in process, ready to pick up or deliver,
 * delivered, cancelled. The status is changed right here, and once an order is
 * ready the WhatsApp button tells the customer.
 */
export function OrdersClient({ orders, shopName, initialTab }: { orders: OrderRow[]; shopName: string; initialTab?: string }) {
  const [tab, setTab] = useState<Tab>(TABS.find((t) => t.key === initialTab)?.key ?? "process");
  const [search, setSearch] = useState("");

  const count = (t: Tab) => orders.filter((o) => inTab(o, t)).length;
  const shown = useMemo(() => {
    const list = orders.filter((o) => inTab(o, tab) && matchesSearch(search, [
      o.invoiceNo, o.offlineRef, o.customerName, o.customerPhone, o.customerPhone2, o.customerSerial, ...o.items,
    ]));
    const oldestFirst = isWaitingTab(tab);
    return list.sort((a, b) => (new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime()) * (oldestFirst ? 1 : -1));
  }, [orders, tab, search]);

  return (
    <div className="space-y-6 animate-fade-in solid-sheet rounded-3xl p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold">Order Status</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {`${count("process")} in process · ${count("ready")} ready to pick up or deliver`}
        </p>
      </div>

      <div className="glass-card p-4">
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search invoice no., customer, serial, phone or item..."
              className="w-full pl-10 pr-4 py-2 glass-input text-sm" />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {TABS.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`px-3 py-2 rounded-xl text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
                  tab === t.key ? "bg-primary text-white" : "bg-surface hover:bg-surface-hover"
                }`}>
                {`${t.label} (${count(t.key)})`}
              </button>
            ))}
          </div>
        </div>

        {isWaitingTab(tab) && shown.length > 1 && (
          <p className="text-[11px] text-muted-foreground mb-2">Longest waiting first.</p>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Invoice</th>
                <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Date</th>
                <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Customer</th>
                <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Items</th>
                <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">Balance</th>
                <th className="text-center py-3 px-3 text-xs font-medium text-muted-foreground">Order status</th>
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 && (
                <tr><td colSpan={6}>
                  <EmptyState icon={PackageCheck}
                    title={search ? "No orders match" : tab === "all" ? "No orders yet" : `Nothing ${TABS.find((t) => t.key === tab)!.label.toLowerCase()}`}
                    hint={search
                      ? "Try a different search, or another tab."
                      : "A bill with a lens or prescription on it starts as “In process” at the till. Change its status here as it moves along."} />
                </td></tr>
              )}
              {shown.map((o) => (
                <tr key={o.id} className="border-b border-border hover:bg-surface-hover/50 transition-colors">
                  <td className="py-3 px-3 font-medium whitespace-nowrap">
                    {o.invoiceNo}
                    {o.offlineRef && <p className="text-[10px] text-muted-foreground font-normal">{o.offlineRef}</p>}
                  </td>
                  <td className="py-3 px-3 text-muted-foreground whitespace-nowrap">
                    {formatDate(o.dateTime)}
                    {isWaitingTab(tab) && <p className="text-[10px] font-medium text-warning">{`Waiting ${waitingFor(o.dateTime)}`}</p>}
                  </td>
                  <td className="py-3 px-3">
                    {o.customerId && o.customerName !== "Walk-in"
                      ? <Link href={`/dashboard/customers/${o.customerId}`} className="hover:underline hover:text-primary">{o.customerName}</Link>
                      : o.customerName}
                    {o.customerPhone && <p className="text-[10px] text-muted-foreground">{o.customerPhone}</p>}
                  </td>
                  <td className="py-3 px-3 text-muted-foreground text-xs max-w-[260px]">
                    <span className="line-clamp-2">{o.items.join(", ") || "—"}</span>
                  </td>
                  <td className="py-3 px-3 text-right whitespace-nowrap">
                    {o.balance > 0 ? <span className="text-destructive font-medium">{formatCurrency(o.balance)}</span> : "—"}
                  </td>
                  <td className="py-3 px-3 text-center whitespace-nowrap">
                    <OrderStatusControl sale={o} shopName={shopName} />
                    {o.source === "Online" && o.fulfillmentType && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">{`Online · ${o.fulfillmentType}`}</p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

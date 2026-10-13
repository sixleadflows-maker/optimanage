"use client";

import { useState } from "react";
import Link from "next/link";
import type { CashEntry } from "@/lib/data";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { CREDIT_METHOD } from "@/lib/constants";
import { ListChecks } from "lucide-react";

const TABS = ["Cash", "Card", "Bank Transfer", "JazzCash", "All"] as const;
type Tab = (typeof TABS)[number];
// How each method reads inside a sentence ("No card payments taken…").
const IN_TEXT: Record<Tab, string> = { Cash: "cash", Card: "card payments", "Bank Transfer": "bank transfers", JazzCash: "JazzCash payments", All: "money" };

/**
 * Where the day's money came from: one line per payment -- a new sale, a
 * balance paid on an older bill, or an advance -- with the bill, the customer,
 * how it was paid and who took it. Each tab adds up to the total shown above,
 * so a drawer that doesn't match can be checked line by line.
 */
export function CashEntries({ entries, date }: { entries: CashEntry[]; date: string }) {
  const [tab, setTab] = useState<Tab>("Cash");
  const counts = (e: CashEntry) => e.method !== CREDIT_METHOD;
  const totalFor = (t: Tab) => entries.filter((e) => counts(e) && (t === "All" || e.method === t)).reduce((sum, e) => sum + e.amount, 0);
  const shown = entries.filter((e) => tab === "All" || e.method === tab);
  const time = (iso: string) => new Date(iso).toLocaleTimeString("en-PK", { hour: "numeric", minute: "2-digit" });

  const what = (e: CashEntry) => {
    if (e.kind === "advance") return e.amount >= 0 ? "Advance paid in" : "Advance handed back";
    if (e.method === CREDIT_METHOD) return "Paid from their advance — no money came in";
    if (e.kind === "sale") return "New sale";
    // The bill's shop day (days start at UTC midnight), not the clock date, so a
    // bill rung up after midnight is labelled with the day it was counted on.
    const billDay = e.invoiceDate.slice(0, 10);
    return billDay < date ? `Balance on the bill of ${formatDate(billDay)}` : "Paid later the same day";
  };

  return (
    <div className="glass-card p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2"><ListChecks className="w-4 h-4 text-primary" /> Where the money came from</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Every payment taken on this day. Each tab adds up to the total above — use it to check the drawer line by line.
          </p>
        </div>
        <div className="flex gap-1.5 flex-wrap" role="tablist">
          {TABS.map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                tab === t ? "bg-primary text-white" : "bg-surface hover:bg-surface-hover"
              }`}>
              {`${t === "Bank Transfer" ? "Bank" : t} · ${formatCurrency(totalFor(t))}`}
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          {`No ${IN_TEXT[tab]} taken on this day.`}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground text-left">
                <th className="font-medium py-2 pr-3">Time</th>
                <th className="font-medium py-2 pr-3">Bill · customer</th>
                <th className="font-medium py-2 pr-3">What</th>
                {tab === "All" && <th className="font-medium py-2 pr-3">Paid by</th>}
                <th className="font-medium py-2 pr-3">Taken by</th>
                <th className="font-medium py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((e) => {
                const older = e.kind === "payment" && e.invoiceDate.slice(0, 10) < date;
                return (
                  <tr key={e.id} className={`border-t border-border ${e.method === CREDIT_METHOD ? "text-muted-foreground" : ""}`}>
                    <td className="py-2 pr-3 whitespace-nowrap tabular-nums">{time(e.time)}</td>
                    <td className="py-2 pr-3">
                      {e.invoiceNo && <span className="font-semibold">{e.invoiceNo}</span>}
                      {e.invoiceNo && " · "}
                      {e.customerId ? (
                        <Link href={`/dashboard/customers/${e.customerId}`} className="hover:text-primary hover:underline">{e.customer}</Link>
                      ) : e.customer}
                    </td>
                    <td className="py-2 pr-3">
                      <span className={older ? "chip bg-primary/10 text-primary" : ""}>{what(e)}</span>
                      {e.note && <span className="block text-[10px] text-muted-foreground mt-0.5">{e.note}</span>}
                    </td>
                    {tab === "All" && <td className="py-2 pr-3 whitespace-nowrap">{e.method}</td>}
                    <td className="py-2 pr-3 whitespace-nowrap">{e.by || "—"}</td>
                    <td className={`py-2 text-right font-semibold tabular-nums whitespace-nowrap ${e.amount < 0 ? "text-destructive" : ""}`}>
                      {e.amount < 0 ? `−${formatCurrency(-e.amount)}` : formatCurrency(e.amount)}
                    </td>
                  </tr>
                );
              })}
              <tr className="border-t-2 border-border font-bold">
                <td className="py-2 pr-3" colSpan={tab === "All" ? 5 : 4}>
                  {tab === "All" ? "Total taken" : `Total ${IN_TEXT[tab]}`}
                </td>
                <td className="py-2 text-right tabular-nums">{formatCurrency(totalFor(tab))}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

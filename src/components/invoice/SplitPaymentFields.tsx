"use client";

import { Banknote, CreditCard, Building2, Smartphone } from "lucide-react";
import { PAYMENT_METHODS } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils/format";

const ICONS: Record<string, typeof Banknote> = {
  Cash: Banknote,
  Card: CreditCard,
  "Bank Transfer": Building2,
  JazzCash: Smartphone,
};

export type SplitAmounts = Record<string, number>;

export const splitAmountsTotal = (amounts: SplitAmounts) =>
  Math.round(Object.values(amounts).reduce((sum, a) => sum + (a || 0), 0) * 100) / 100;

/**
 * One amount per payment method, for a customer paying part cash, part card.
 * With a `target` (paying the whole bill) the parts must reach it exactly, and
 * "Rest" fills a method with whatever is still left. Without one (an advance)
 * any amount up to the total is fine.
 */
export function SplitPaymentFields({
  amounts,
  onChange,
  target,
  total,
  label = "Advance now",
}: {
  amounts: SplitAmounts;
  onChange: (amounts: SplitAmounts) => void;
  target: number | null;
  // What can be paid at most; with no target, the rest of it is still owed.
  total: number;
  label?: string;
}) {
  const received = splitAmountsTotal(amounts);
  const left = Math.round(((target ?? total) - received) * 100) / 100;

  return (
    <div className="p-2.5 rounded-lg border border-border space-y-1.5">
      {PAYMENT_METHODS.map((m) => {
        const Icon = ICONS[m] ?? Banknote;
        const others = received - (amounts[m] || 0);
        return (
          <div key={m} className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-[11px] w-24 flex-shrink-0">
              <Icon className="w-3.5 h-3.5 text-muted-foreground" /> {m === "Bank Transfer" ? "Bank" : m}
            </span>
            <input
              type="number" min={0} value={amounts[m] || ""} placeholder="0"
              onChange={(e) => onChange({ ...amounts, [m]: Math.max(0, Number(e.target.value)) })}
              className="flex-1 min-w-0 px-2 py-1 glass-input text-xs text-right"
            />
            {target !== null && (
              <button
                type="button"
                onClick={() => onChange({ ...amounts, [m]: Math.max(0, Math.round((target - others) * 100) / 100) })}
                disabled={target - others <= 0}
                title={`Put whatever is left on ${m}`}
                className="text-[10px] text-primary font-semibold w-8 disabled:opacity-40 cursor-pointer"
              >
                Rest
              </button>
            )}
          </div>
        );
      })}
      <div className="border-t border-border pt-1.5 text-[10px] flex justify-between gap-2">
        <span className="text-muted-foreground">
          {target !== null ? `Received ${formatCurrency(received)} of ${formatCurrency(target)}` : `${label} ${formatCurrency(received)}`}
        </span>
        {left < -0.01 ? (
          <span className="font-semibold text-destructive">{formatCurrency(-left)} more than the {target !== null ? "bill" : "total"}</span>
        ) : target !== null ? (
          left > 0.01
            ? <span className="font-semibold text-warning">{formatCurrency(left)} left to split</span>
            : <span className="font-semibold text-success">Adds up</span>
        ) : (
          received > 0 && <span className="font-semibold text-foreground">Balance due {formatCurrency(left)}</span>
        )}
      </div>
    </div>
  );
}

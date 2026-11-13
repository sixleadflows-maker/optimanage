import type { CashAdjustmentView } from "@/lib/data";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { History } from "lucide-react";

const moved = (a: number, b: number) => Math.abs(a - b) > 0.5;
const money = (n: number) => (n < 0 ? `−${formatCurrency(-n)}` : formatCurrency(n));

/**
 * Changes carried into a day close after it was saved: a bill corrected from
 * cash to card, a sale rung up after closing, an expense added the next
 * morning. Each says what happened, who did it and which figures moved, so a
 * closing that reads differently from what was typed can be explained.
 *
 * On a day not closed yet it shows the last close's, since that's what the
 * day's opening is carried over from.
 */
export function CashAdjustments({ adjustments, closed }: { adjustments: CashAdjustmentView[]; closed: boolean }) {
  if (!adjustments.length) return null;
  const closeDay = adjustments[0].day;
  const when = (iso: string) =>
    `${formatDate(iso.slice(0, 10))}, ${new Date(iso).toLocaleTimeString("en-PK", { hour: "numeric", minute: "2-digit" })}`;

  return (
    <div className="glass-card p-5">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <History className="w-4 h-4 text-primary" />
        {closed ? "Corrected after closing" : `Corrections carried into the ${formatDate(closeDay)} close`}
      </h3>
      <p className="text-[11px] text-muted-foreground mt-0.5 mb-3">
        {closed
          ? "Money on this day was changed after the day was closed, so the saved figures were brought in line. A closing that was counted stays as counted — only its difference changes."
          : "This day's opening is carried over from that close, so it moved with these changes."}
      </p>
      <ul className="space-y-2.5">
        {adjustments.map((a) => {
          const lines: string[] = [];
          if (moved(a.netBefore, a.netAfter)) lines.push(`Cash for the day ${money(a.netBefore)} → ${money(a.netAfter)}`);
          if (moved(a.openingBefore, a.openingAfter)) lines.push(`Opening ${money(a.openingBefore)} → ${money(a.openingAfter)}`);
          if (moved(a.closingBefore, a.closingAfter)) lines.push(`Closing ${money(a.closingBefore)} → ${money(a.closingAfter)}`);
          else if (moved(a.netBefore, a.netAfter) || moved(a.openingBefore, a.openingAfter)) {
            lines.push(`Closing stays as counted (${money(a.closingAfter)})`);
          }
          return (
            <li key={a.id} className="border-t border-border pt-2.5 first:border-t-0 first:pt-0 text-xs">
              <p className="font-medium">{a.reason}</p>
              {lines.length > 0 && <p className="text-muted-foreground mt-0.5">{lines.join(" · ")}</p>}
              <p className="text-[10px] text-muted-foreground mt-0.5">{`${when(a.at)}${a.by ? ` · ${a.by}` : ""}`}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

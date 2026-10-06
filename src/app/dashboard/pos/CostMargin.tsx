import { formatCurrency } from "@/lib/utils/format";

/**
 * What an item costs the shop and what it earns: "Cost Rs.700 · Profit Rs.1,100 · 61%".
 * The margin is profit as a share of the selling price, coloured by how healthy
 * it is (red when it loses money, amber when it's thin). `cost` is per unit;
 * with a quantity (a cart line) it's worked out for all of them.
 */
export function CostMargin({
  cost, price, quantity = 1, discount = 0,
}: {
  cost: number;
  price: number;
  quantity?: number;
  discount?: number;
}) {
  if (!(cost > 0)) return <span className="text-muted-foreground">Cost not set</span>;
  const revenue = price * quantity - discount;
  const profit = revenue - cost * quantity;
  const pct = revenue > 0 ? (profit / revenue) * 100 : 0;
  const tone = profit <= 0 ? "text-destructive" : pct < 20 ? "text-warning" : "text-success";
  return (
    <span className="tabular-nums">
      <span className="text-muted-foreground">{`Cost ${formatCurrency(cost * quantity)} · `}</span>
      <span className={`font-semibold ${tone}`}>{`Profit ${formatCurrency(profit)} · ${pct.toFixed(0)}%`}</span>
    </span>
  );
}

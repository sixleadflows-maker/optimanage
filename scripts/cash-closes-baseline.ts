/**
 * One-off, run when day closes started following corrections (Nov 2026).
 *
 * Each close now keeps what the app itself worked out for the day -- the
 * opening it carried over, the closing it expected, the day's cash -- so that
 * a correction made later can be carried into the saved figures (see
 * src/lib/cash/closes.ts). Closes saved before that have none of the three.
 *
 * This fills them in from the books as they stand, WITHOUT touching any
 * opening or closing. That draws a line under the past: where an old close
 * doesn't add up today (a sale rung up minutes after the day was closed, an
 * invoice deleted the next morning) it is recorded as a difference on that day
 * and left for the owner to settle, instead of being pushed through every
 * close since by the next unrelated correction.
 *
 * Usage:  npx tsx --tsconfig tsconfig.json scripts/cash-closes-baseline.ts          -> shows what it would record
 *         npx tsx --tsconfig tsconfig.json scripts/cash-closes-baseline.ts --apply  -> records it
 *
 * Safe to run again: a close that already has its figures recorded is left
 * alone, so a second run only fills in closes saved since by the old version.
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ path: ".env", quiet: true });

async function main() {
  const apply = process.argv.includes("--apply");
  const { db } = await import("@/lib/db");
  const { drawerNetByDay, netBetween, carriedFrom, cashDay, nextCashDay, CLOSE_COLUMNS } = await import("@/lib/cash/closes");
  const round2 = (n: number) => Math.round(n * 100) / 100;

  const all = await db.cashCollection.findMany({ orderBy: [{ date: "asc" }, { createdAt: "asc" }], select: CLOSE_COLUMNS });
  const seen = new Set<string>();
  const closes = all.filter((c) => !seen.has(cashDay(c.date)) && seen.add(cashDay(c.date)));
  if (!closes.length) return console.log("No day closes yet -- nothing to do.");
  const cash = await drawerNetByDay(closes[0].date, nextCashDay(closes[closes.length - 1].date));

  let typed = 0, counted = 0, writes = 0;
  for (let i = 0; i < closes.length; i++) {
    const close = closes[i];
    const before = i ? closes[i - 1] : null;
    const day = cashDay(close.date);
    const sinceThen = before ? netBetween(cash, cashDay(before.date), day) : 0;
    const carried = before ? carriedFrom(before.closingCash, sinceThen) : null;
    const net = round2(cash.net.get(day) ?? 0);
    const expected = round2(close.openingCash + net);

    const openingGap = carried === null ? 0 : round2(close.openingCash - carried);
    const closingGap = round2(close.closingCash - expected);
    if (openingGap) typed++;
    if (closingGap) counted++;
    console.log([
      day,
      `opening ${close.openingCash}`,
      carried === null ? "(first close)" : openingGap ? `TYPED, ${openingGap > 0 ? "+" : ""}${openingGap} against ${carried} carried` : `carried${sinceThen ? ` (${sinceThen} on days not closed)` : ""}`,
      `| cash ${net} | closing ${close.closingCash}`,
      closingGap ? `DIFFERENT, ${closingGap > 0 ? "over" : "short"} ${Math.abs(closingGap)} against ${expected} expected` : "as expected",
    ].join(" "));

    // Already recorded: left alone, or a second run would forget which figures
    // were typed by hand.
    if (close.drawerNet !== null && close.expectedClosing !== null) continue;
    writes++;
    if (apply) {
      await db.cashCollection.update({ where: { id: close.id }, data: { carriedOpening: carried, expectedClosing: expected, drawerNet: net } });
    }
  }
  console.log(`\n${closes.length} closes: ${typed} with an opening typed by hand, ${counted} with a closing different from expected.`);
  console.log(apply ? `${writes} recorded.` : `${writes} would be recorded (run again with --apply).`);
}
main().catch((e) => { console.error(e); process.exit(1); }).then(() => process.exit(0));

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { tillParts } from "@/lib/sales/paymentSplit";

// A day close stores two figures someone typed: the cash the drawer opened
// with and the cash counted at the end. Everything else on the Cash page is
// worked out fresh from the invoices, expenses and deposits each time.
//
// That left a gap. A bill rung up as cash and later corrected to card changed
// that day's cash figure straight away, but the day's saved closing -- and the
// opening of every day after it, each carried from the close before -- stayed
// as typed, so the drawer went on expecting money that was never in it.
//
// So every change to money ends by calling syncCashCloses with the dates it
// touched. If any of those days is already closed, the difference is carried
// into that close and on through the ones after it, and what was changed, why
// and by whom is written down for the Cash page to show.

const DAY_MS = 24 * 60 * 60 * 1000;
const round2 = (n: number) => Math.round(n * 100) / 100;
const same = (a: number, b: number) => Math.abs(a - b) < 0.005;

/** The Cash page's day a moment falls on (its days run midnight to midnight UTC). */
export const cashDay = (d: Date) => d.toISOString().slice(0, 10);
export const cashDayStart = (day: string) => new Date(`${day}T00:00:00.000Z`);
export const nextCashDay = (d: Date) => new Date(cashDayStart(cashDay(d)).getTime() + DAY_MS);

/** "27 Oct" -- how a day reads in the reason for a correction. */
export const cashDayLabel = (d: Date) =>
  d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

type Reader = typeof db | Prisma.TransactionClient;

/** What each day did to the drawer, and how much of that was cash taken to the bank. */
export interface DayCash {
  net: Map<string, number>;
  banked: Map<string, number>;
}

/**
 * What each day between two moments did to the drawer: cash taken (at the
 * till, on older bills, as advances) less cash spent, handed back and banked.
 * The same rules as the Cash page's own figures -- a day's "expected in
 * drawer" is its opening plus this.
 */
export async function drawerNetByDay(from: Date, to: Date, client: Reader = db, branchId?: string): Promise<DayCash> {
  const range = { gte: from, lt: to };
  const [sales, payments, credits, refunds, expenses, salaries, deposits] = await Promise.all([
    client.sale.findMany({
      where: { date: range, ...(branchId ? { branchId } : {}) },
      select: { date: true, paid: true, paymentMethod: true, paymentSplit: true, payments: { select: { amount: true } } },
    }),
    client.salePayment.findMany({
      where: { date: range, method: "Cash", ...(branchId ? { sale: { branchId } } : {}) },
      select: { date: true, amount: true },
    }),
    // Advances paid in cash add to it; ones handed back in cash come off (they're stored below zero).
    client.customerCredit.findMany({ where: { date: range, method: "Cash" }, select: { date: true, amount: true } }),
    client.return.findMany({
      where: { date: range, refundMethod: "Cash", ...(branchId ? { sale: { branchId } } : {}) },
      select: { date: true, totalRefund: true },
    }),
    client.expense.findMany({ where: { date: range }, select: { date: true, amount: true, paymentMethod: true } }),
    client.salaryEntry.findMany({
      where: { date: range, kind: { not: "DEDUCTION" }, method: "Cash" },
      select: { date: true, amount: true },
    }),
    client.bankDeposit.findMany({ where: { date: range }, select: { date: true, amount: true } }),
  ]);

  const net = new Map<string, number>();
  const banked = new Map<string, number>();
  const add = (map: Map<string, number>, date: Date, amount: number) => {
    const day = cashDay(date);
    map.set(day, (map.get(day) ?? 0) + amount);
  };

  for (const s of sales) {
    // A sale's own `paid` includes anything collected later; that counts on the day it was taken.
    const atTill = s.paid - s.payments.reduce((sum, p) => sum + p.amount, 0);
    for (const part of tillParts(s, atTill)) if (part.method === "Cash") add(net, s.date, part.amount);
  }
  for (const p of payments) add(net, p.date, p.amount);
  for (const c of credits) add(net, c.date, c.amount);
  for (const r of refunds) add(net, r.date, -r.totalRefund);
  for (const e of expenses) if ((e.paymentMethod || "Cash") === "Cash") add(net, e.date, -e.amount);
  for (const s of salaries) add(net, s.date, -s.amount);
  for (const d of deposits) {
    add(net, d.date, -d.amount);
    add(banked, d.date, d.amount);
  }
  for (const [day, amount] of net) net.set(day, round2(amount));
  return { net, banked };
}

/** What the drawer gained or lost over the days strictly between two days. */
export function netBetween(cash: DayCash, afterDay: string, beforeDay: string) {
  let sum = 0;
  for (const [day, amount] of cash.net) if (day > afterDay && day < beforeDay) sum += amount;
  return round2(sum);
}

/** What a day opens with: the close before it, and whatever the drawer did on days never closed since. */
export const carriedFrom = (closingCash: number, sinceThen: number) => Math.max(0, round2(closingCash + sinceThen));

export interface CloseRow {
  id: string;
  date: Date;
  openingCash: number;
  closingCash: number;
  // As saved by whoever closed the day. Only read for a close from before
  // the three figures below were kept, to tell what it was worked out from.
  cashSales: number;
  expenses: number;
  carriedOpening: number | null;
  expectedClosing: number | null;
  drawerNet: number | null;
}

export interface CloseChange {
  id: string;
  day: string;
  openingBefore: number;
  openingAfter: number;
  netBefore: number;
  netAfter: number;
  closingBefore: number;
  closingAfter: number;
  carriedOpening: number | null;
  expectedClosing: number;
  // Something on the Cash page reads differently now (rather than only the
  // kept figures catching up), so it belongs in the day's list of corrections.
  shown: boolean;
}

/**
 * Works out what each close should read now, oldest first, given the close
 * before the first of them and what every day's cash comes to today.
 *
 * Only figures the app worked out are moved. Anything typed by hand stays:
 *  - An opening that was the carried-over figure follows the close before it.
 *    One typed differently was a count of the drawer: it's a fresh start, and
 *    nothing corrected on an earlier day carries past it.
 *  - A closing that was the expected figure follows the day's cash. One typed
 *    differently was a count that found a difference: the count stands and the
 *    difference is what changes.
 */
export function planCloseChanges(before: CloseRow | null, closes: CloseRow[], cash: DayCash): CloseChange[] {
  const changes: CloseChange[] = [];
  let previous = before;
  // The previous close's closing as it stands now (it may just have moved).
  let previousClosing = before?.closingCash ?? 0;

  for (const close of closes) {
    const day = cashDay(close.date);
    const sinceThen = previous ? netBetween(cash, cashDay(previous.date), day) : 0;
    const carried = previous ? carriedFrom(previousClosing, sinceThen) : null;
    const carriedThen = close.carriedOpening ?? (previous ? carriedFrom(previous.closingCash, sinceThen) : null);
    const follows = carried !== null && carriedThen !== null && same(close.openingCash, carriedThen);
    const opening = follows ? carried : close.openingCash;

    const net = round2(cash.net.get(day) ?? 0);
    const netThen = close.drawerNet ?? round2(close.cashSales - close.expenses - (cash.banked.get(day) ?? 0));
    const expectedThen = close.expectedClosing ?? round2(close.openingCash + netThen);
    const balanced = same(close.closingCash, expectedThen);
    const closing = balanced ? round2(opening + net) : close.closingCash;

    // What the saved figures are compared with next time: moved along with a
    // figure that follows, left where it was beside one that was typed.
    const keepCarried = follows ? carried : carriedThen;
    const keepExpected = balanced ? closing : expectedThen;

    const shown = !same(opening, close.openingCash) || !same(closing, close.closingCash) || !same(net, netThen);
    const kept =
      close.drawerNet !== null && same(close.drawerNet, net) &&
      close.expectedClosing !== null && same(close.expectedClosing, keepExpected) &&
      (keepCarried === null ? close.carriedOpening === null : close.carriedOpening !== null && same(close.carriedOpening, keepCarried));
    if (shown || !kept) {
      changes.push({
        id: close.id, day,
        openingBefore: close.openingCash, openingAfter: opening,
        netBefore: netThen, netAfter: net,
        closingBefore: close.closingCash, closingAfter: closing,
        carriedOpening: keepCarried, expectedClosing: keepExpected,
        shown,
      });
    }
    previous = close;
    previousClosing = closing;
  }
  return changes;
}

// Closes are read, worked out and written by one request at a time. Two
// corrections landing together would otherwise each work from the figures as
// they were, and the second to finish would undo the first.
export async function lockCashCloses(tx: Prisma.TransactionClient) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(7301946)`;
}

export const CLOSE_COLUMNS = {
  id: true, date: true, openingCash: true, closingCash: true, cashSales: true, expenses: true,
  carriedOpening: true, expectedClosing: true, drawerNet: true,
} as const;

/** One close per day, the first saved -- the one the Cash page shows. */
function onePerDay(rows: CloseRow[]) {
  const seen = new Set<string>();
  return rows.filter((r) => !seen.has(cashDay(r.date)) && seen.add(cashDay(r.date)));
}

/** Money as it reads in the reason for a correction: "Rs.5,500". */
export const cashRs = (n: number) => `Rs.${Math.round(n).toLocaleString("en-PK")}`;

export interface CashSyncInput {
  // When the money that changed was (or now is) counted: the bill's date, a
  // payment's, an expense's. Both the old date and the new when one was moved.
  dates: (Date | null | undefined)[];
  // What happened, in words staff would use: "INV-2026-348 (27 Oct): payment changed from Cash to Card".
  reason: string;
  // Who did it -- their name, or their id to look the name up.
  by?: { id?: string | null; name?: string | null };
}

async function carryIntoCloses(from: Date, input: CashSyncInput) {
  return db.$transaction(async (tx) => {
    await lockCashCloses(tx);
    const closes = onePerDay(await tx.cashCollection.findMany({
      where: { date: { gte: from } },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      select: CLOSE_COLUMNS,
    }));
    if (!closes.length) return 0;
    const before = await tx.cashCollection.findFirst({
      where: { date: { lt: from } },
      orderBy: [{ date: "desc" }, { createdAt: "asc" }],
      select: CLOSE_COLUMNS,
    });

    // Read after the lock is held, so this sees everything an earlier
    // correction saved and can't put back a figure worked out before it.
    const cash = await drawerNetByDay(before ? nextCashDay(before.date) : from, nextCashDay(closes[closes.length - 1].date), tx);
    const changes = planCloseChanges(before, closes, cash);
    for (const c of changes) {
      await tx.cashCollection.update({
        where: { id: c.id },
        data: {
          openingCash: c.openingAfter, closingCash: c.closingAfter,
          carriedOpening: c.carriedOpening, expectedClosing: c.expectedClosing, drawerNet: c.netAfter,
        },
      });
    }

    const shown = changes.filter((c) => c.shown);
    if (shown.length) {
      const by = input.by?.name?.trim()
        || (input.by?.id ? (await tx.user.findUnique({ where: { id: input.by.id }, select: { name: true } }))?.name : "")
        || "";
      await tx.cashAdjustment.createMany({
        data: shown.map((c) => ({
          collectionId: c.id, reason: input.reason.slice(0, 300), by,
          openingBefore: c.openingBefore, openingAfter: c.openingAfter,
          netBefore: c.netBefore, netAfter: c.netAfter,
          closingBefore: c.closingBefore, closingAfter: c.closingAfter,
        })),
      });
    }
    return shown.length;
  }, { timeout: 20_000, maxWait: 10_000 });
}

/**
 * Brings the saved day closes back in line after money was added, changed or
 * removed on the given dates, and returns how many closes now read differently.
 *
 * Call it once the change itself is saved. It never throws: that change is
 * already in the books, and a close that couldn't be brought in line must not
 * make it look as if the change failed. Anything missed is picked up the next
 * time a day is closed.
 */
export async function syncCashCloses(input: CashSyncInput): Promise<number> {
  try {
    const days = input.dates.filter((d): d is Date => d instanceof Date && !Number.isNaN(d.getTime())).map(cashDay);
    if (!days.length) return 0;
    const from = cashDayStart(days.reduce((a, b) => (a < b ? a : b)));
    // Nearly every sale is on a day still open, with no close on or after it.
    const closed = await db.cashCollection.findFirst({ where: { date: { gte: from } }, select: { id: true } });
    if (!closed) return 0;
    let corrected: number;
    try {
      corrected = await carryIntoCloses(from, input);
    } catch (e) {
      console.error("[cash] day closes not brought in line, trying once more", e);
      corrected = await carryIntoCloses(from, input);
    }
    if (corrected) {
      // Outside a Server Action (a script) there is nothing to refresh.
      try { revalidatePath("/dashboard/cash"); } catch { /* not in a request */ }
    }
    return corrected;
  } catch (e) {
    console.error("[cash] day closes not brought in line", e);
    return 0;
  }
}

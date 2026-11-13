import { db } from "@/lib/db";
import { getCashCollection } from "@/lib/data";
import {
  CLOSE_COLUMNS, carriedFrom, cashDay, cashDayLabel, cashDayStart, drawerNetByDay, lockCashCloses, netBetween,
  nextCashDay, syncCashCloses,
} from "@/lib/cash/closes";

const DAY_MS = 24 * 60 * 60 * 1000;
const round2 = (n: number) => Math.round(n * 100) / 100;
// Moved by at least half a rupee -- anything less is only rounding.
const moved = (a: number, b: number) => Math.abs(a - b) > 0.5;

export interface DayCloseInput {
  date: string;        // YYYY-MM-DD
  openingCash: number;
  closingCash: number; // physically counted
  notes: string;
  // What the page showed when Save was pressed: the day's cash in less cash
  // out, and the opening it carried over. If either has moved since (a bill
  // corrected on another screen), the close isn't saved against figures nobody
  // saw. A page from before this was sent leaves it out.
  seen?: { net: number; carried: number | null };
}

export type DayCloseResult =
  | { ok: true; openingCash: number; closingCash: number; closesCorrected: number }
  | { ok: false; error: string; changed?: boolean };

/**
 * Saves the day close: the opening and the counted closing as typed, with the
 * figures the app worked out beside them, so that a correction made after
 * closing can tell a figure that follows the books from one that was counted
 * (see src/lib/cash/closes.ts). Saving a close again carries the new closing
 * into the openings of the days after it.
 *
 * One close per day for the whole shop -- the Cash page shows the shop's
 * takings, so the close is saved against the same figures.
 */
export async function saveDayClose(
  input: DayCloseInput,
  by: { name: string; branchId: string | null },
): Promise<DayCloseResult> {
  const day = input.date;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(cashDayStart(day).getTime()) || cashDay(cashDayStart(day)) !== day) {
    return { ok: false, error: "Pick the day to close" };
  }
  if (day > cashDay(new Date(Date.now() + 5 * 60_000))) return { ok: false, error: "A day can't be closed before it has started" };
  if (!Number.isFinite(input.openingCash) || !Number.isFinite(input.closingCash)) {
    return { ok: false, error: "Enter the opening and closing cash as numbers" };
  }
  if (input.openingCash < 0 || input.closingCash < 0) {
    return { ok: false, error: "Cash in the drawer can't be below zero — check the figures" };
  }
  const openingCash = round2(input.openingCash);
  const closingCash = round2(input.closingCash);
  const notes = (input.notes ?? "").trim().slice(0, 500);
  const start = cashDayStart(day);
  const end = new Date(start.getTime() + DAY_MS);
  const label = cashDayLabel(start);

  // Anything an earlier correction couldn't carry into the closes before this
  // one is caught up first, so this day opens from figures that are right.
  const healed = await syncCashCloses({
    dates: [new Date(start.getTime() - 45 * DAY_MS)],
    reason: `Brought in line with the books when the day close for ${label} was saved`,
    by: { name: by.name },
  });
  // The takings by method, as the Cash page shows them, kept with the close.
  const totals = await getCashCollection(day);

  const saved = await db.$transaction(async (tx) => {
    await lockCashCloses(tx);
    // Worked out again while no correction can land, so the close is saved
    // against figures that are still true when it's written.
    const before = await tx.cashCollection.findFirst({
      where: { date: { lt: start } },
      orderBy: [{ date: "desc" }, { createdAt: "asc" }],
      select: CLOSE_COLUMNS,
    });
    const cash = await drawerNetByDay(before ? nextCashDay(before.date) : start, end, tx);
    const net = round2(cash.net.get(day) ?? 0);
    const carried = before ? carriedFrom(before.closingCash, netBetween(cash, cashDay(before.date), day)) : null;
    if (input.seen) {
      const seenCarried = input.seen.carried ?? null;
      const carriedMoved = (seenCarried === null) !== (carried === null) || (seenCarried !== null && carried !== null && moved(seenCarried, carried));
      if (moved(round2(input.seen.net), net) || carriedMoved) return null;
    }

    const existing = await tx.cashCollection.findFirst({
      where: { date: { gte: start, lt: end } },
      orderBy: { createdAt: "asc" },
      select: { id: true, openingCash: true, closingCash: true, drawerNet: true },
    });
    const data = {
      openingCash,
      closingCash,
      cashSales: totals.cashSales,
      cardSales: totals.cardSales,
      bankTransfer: totals.bankTransfer,
      jazzCash: totals.jazzCash,
      totalCollection: totals.totalCollection,
      expenses: totals.expenses,
      notes,
      closedBy: by.name,
      carriedOpening: carried,
      expectedClosing: round2(openingCash + net),
      drawerNet: net,
    };
    if (!existing) {
      await tx.cashCollection.create({ data: { ...data, date: start, branchId: by.branchId } });
      return { resaved: false };
    }
    await tx.cashCollection.update({ where: { id: existing.id }, data });
    // A close saved again with different figures is a change to a closed day
    // like any other, so it goes in the day's list of corrections too.
    if (moved(existing.openingCash, openingCash) || moved(existing.closingCash, closingCash)) {
      await tx.cashAdjustment.create({
        data: {
          collectionId: existing.id,
          reason: "Day close saved again with different figures",
          by: by.name,
          openingBefore: existing.openingCash, openingAfter: openingCash,
          netBefore: existing.drawerNet ?? net, netAfter: net,
          closingBefore: existing.closingCash, closingAfter: closingCash,
        },
      });
    }
    return { resaved: true };
  }, { timeout: 20_000, maxWait: 10_000 });

  if (!saved) {
    return {
      ok: false,
      changed: true,
      error: "Money on this day was added or corrected while the page was open. The figures have been refreshed — check the closing and save again.",
    };
  }

  // The days after it open with what this one closed with.
  const carriedOn = await syncCashCloses({
    dates: [end],
    reason: saved.resaved ? `Day close for ${label} saved again` : `Day close for ${label} saved`,
    by: { name: by.name },
  });
  return { ok: true, openingCash, closingCash, closesCorrected: healed + carriedOn };
}

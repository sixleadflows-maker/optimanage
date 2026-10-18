// Salaries: what each person on the payroll is owed for a month, and what
// they've had. Plain functions, used by the Salaries page and the server alike.

export const SALARY_KINDS = ["SALARY", "ADVANCE", "BONUS", "DEDUCTION"] as const;
export type SalaryKindValue = (typeof SALARY_KINDS)[number];

export const SALARY_KIND_LABEL: Record<SalaryKindValue, string> = {
  SALARY: "Salary paid",
  ADVANCE: "Advance",
  BONUS: "Bonus",
  DEDUCTION: "Cut from pay",
};

// How pay is handed over. Only cash comes out of the drawer.
export const SALARY_METHODS = ["Cash", "Bank Transfer", "JazzCash"] as const;

/** Money changes hands for these; a cut only lowers what's owed. */
export const isPaidOut = (kind: SalaryKindValue | string) => kind !== "DEDUCTION";

/** One step of someone's pay: this amount a month from `from` ("2026-10") on. */
export interface SalaryStep {
  from: string;
  amount: number;
}

export const monthKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
export const isMonthKey = (m: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(m);

export function shiftMonth(month: string, by: number) {
  const [y, m] = month.split("-").map(Number);
  return monthKey(new Date(Date.UTC(y, m - 1 + by, 1)));
}

export function monthName(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}

/** The steps as stored, tidied: valid months only, oldest first. */
export function readSalaryHistory(raw: unknown): SalaryStep[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s): s is SalaryStep => !!s && typeof s.from === "string" && isMonthKey(s.from) && typeof s.amount === "number" && s.amount >= 0)
    .sort((a, b) => a.from.localeCompare(b.from));
}

/** The monthly salary for a month: the step in force then (the first one, for months before it). */
export function salaryFor(history: SalaryStep[], current: number, month: string): number {
  if (history.length === 0) return current;
  let amount = history[0].amount;
  for (const step of history) if (step.from <= month) amount = step.amount;
  return amount;
}

/** The history with a new salary from `from` on; a step already starting that month is replaced. */
export function withSalaryFrom(history: SalaryStep[], from: string, amount: number): SalaryStep[] {
  return [...history.filter((s) => s.from !== from), { from, amount }].sort((a, b) => a.from.localeCompare(b.from));
}

export interface PayEntryLike {
  kind: SalaryKindValue | string;
  amount: number;
}

/** A month's pay for one person, from what's owed and what's been recorded against it. */
export function payFor(salary: number, entries: PayEntryLike[]) {
  const sum = (kind: string) => entries.filter((e) => e.kind === kind).reduce((t, e) => t + e.amount, 0);
  const advances = sum("ADVANCE");
  const paid = sum("SALARY");
  const bonus = sum("BONUS");
  const cuts = sum("DEDUCTION");
  // The bonus is on top: it doesn't count towards the salary itself.
  const remaining = Math.round((salary - cuts - advances - paid) * 100) / 100;
  return { salary, advances, paid, bonus, cuts, remaining, handedOver: advances + paid + bonus };
}

// Karachi is UTC+5 all year, so its calendar day is this simple.
const karachiDay = (d: Date) => new Date(d.getTime() + 5 * 3600_000).toISOString().slice(0, 10);

/**
 * When a payment typed in for a day ("2026-10-03") is recorded: now if it's
 * today, otherwise midday Karachi time on that day -- inside that day's cash.
 * Null for a date that isn't one, or is still to come.
 */
export function payDate(day: string): Date | null {
  const now = new Date();
  if (!day || day === karachiDay(now)) return now;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day > karachiDay(now)) return null;
  const at = new Date(`${day}T07:00:00.000Z`);
  return Number.isNaN(at.getTime()) ? null : at;
}

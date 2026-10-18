"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import {
  SALARY_KINDS, SALARY_METHODS, isMonthKey, isPaidOut, monthKey, payDate, readSalaryHistory, withSalaryFrom,
  type SalaryKindValue,
} from "@/lib/salaries";
import { trashSalaryEntry, TrashError } from "@/lib/trash/snapshots";

// Salaries are the owner's alone, like Analytics: what each person earns isn't
// for everyone at the counter to see.
async function ownerOnly(): Promise<{ ok: false; error: string } | { ok: true; userId: string; userName: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "You've been signed out — sign in again" };
  if (session.user.role !== "OWNER") return { ok: false, error: "Only the owner can see and change salaries" };
  return { ok: true, userId: session.user.id, userName: session.user.name ?? "" };
}

// Pay handed over in cash comes out of the drawer, and all of it is a cost.
function refresh() {
  revalidatePath("/dashboard/salaries");
  revalidatePath("/dashboard/cash");
  revalidatePath("/dashboard/analytics");
}

export interface EmployeeInput {
  name: string;
  jobTitle: string;
  phone: string;
  monthlySalary: number;
  joinedOn: string;
  notes: string;
  // Changing the salary: the month the new amount starts ("2026-11").
  // Months before it keep what they were owed.
  salaryFrom?: string;
}

function checkEmployee(input: EmployeeInput) {
  if (!input.name.trim()) return "Enter their name";
  if (!Number.isFinite(input.monthlySalary) || input.monthlySalary < 0) return "Check the monthly salary";
  if (input.joinedOn && !payDate(input.joinedOn)) return "Check the joining date — it can't be a day still to come";
  return null;
}

const tidy = (input: EmployeeInput) => ({
  name: input.name.trim().slice(0, 80),
  jobTitle: input.jobTitle.trim().slice(0, 60),
  phone: input.phone.trim().slice(0, 30),
  notes: input.notes.trim().slice(0, 300),
  joinedOn: input.joinedOn ? new Date(`${input.joinedOn}T07:00:00.000Z`) : null,
});

export async function createEmployee(input: EmployeeInput) {
  const who = await ownerOnly();
  if (!who.ok) return { ok: false as const, error: who.error };
  const problem = checkEmployee(input);
  if (problem) return { ok: false as const, error: problem };
  const data = tidy(input);
  const from = monthKey(data.joinedOn ?? new Date());
  const created = await db.employee.create({
    data: { ...data, monthlySalary: input.monthlySalary, salaryHistory: [{ from, amount: input.monthlySalary }] },
  });
  refresh();
  return { ok: true as const, id: created.id };
}

export async function updateEmployee(id: string, input: EmployeeInput) {
  const who = await ownerOnly();
  if (!who.ok) return { ok: false as const, error: who.error };
  const problem = checkEmployee(input);
  if (problem) return { ok: false as const, error: problem };
  if (input.salaryFrom && !isMonthKey(input.salaryFrom)) return { ok: false as const, error: "Pick the month the new salary starts" };
  const row = await db.employee.findUnique({ where: { id } });
  if (!row) return { ok: false as const, error: "They're no longer on the payroll" };

  let history = readSalaryHistory(row.salaryHistory);
  if (history.length === 0) history = [{ from: monthKey(row.joinedOn ?? row.createdAt), amount: row.monthlySalary }];
  if (input.monthlySalary !== row.monthlySalary) {
    history = withSalaryFrom(history, input.salaryFrom || monthKey(new Date()), input.monthlySalary);
  }
  await db.employee.update({
    where: { id },
    // The salary "now" is the latest step: a raise from next month shows as the new figure.
    data: { ...tidy(input), monthlySalary: history[history.length - 1].amount, salaryHistory: history.map((h) => ({ from: h.from, amount: h.amount })) },
  });
  refresh();
  return { ok: true as const };
}

/** Left the shop (off the month's pay sheet, history kept), or back again. */
export async function setEmployeeLeft(id: string, left: boolean) {
  const who = await ownerOnly();
  if (!who.ok) return { ok: false as const, error: who.error };
  const updated = await db.employee.updateMany({ where: { id }, data: { active: !left, leftOn: left ? new Date() : null } });
  if (updated.count === 0) return { ok: false as const, error: "They're no longer on the payroll" };
  refresh();
  return { ok: true as const };
}

/** Only someone added by mistake, with no pay recorded: anyone else is marked as left. */
export async function deleteEmployee(id: string) {
  const who = await ownerOnly();
  if (!who.ok) return { ok: false as const, error: who.error };
  const entries = await db.salaryEntry.count({ where: { employeeId: id } });
  if (entries > 0) return { ok: false as const, error: "They have pay recorded — mark them as left instead, so the history stays" };
  await db.employee.deleteMany({ where: { id } });
  refresh();
  return { ok: true as const };
}

export interface SalaryEntryInput {
  employeeId: string;
  // The month the pay is for ("2026-10").
  month: string;
  kind: SalaryKindValue;
  amount: number;
  method: string;
  // The day it was handed over ("2026-10-31"); today when left out.
  date: string;
  note: string;
}

function checkEntry(input: Omit<SalaryEntryInput, "employeeId">) {
  if (!SALARY_KINDS.includes(input.kind)) return "Pick what this is — salary, advance, bonus or a cut";
  if (!isMonthKey(input.month)) return "Pick the month it's for";
  if (!Number.isFinite(input.amount) || input.amount <= 0) return "Enter the amount";
  if (isPaidOut(input.kind) && !(SALARY_METHODS as readonly string[]).includes(input.method)) return "Pick how it was paid";
  if (!payDate(input.date)) return "Check the date — it can't be a day still to come";
  return null;
}

const entryData = (input: Omit<SalaryEntryInput, "employeeId">) => ({
  month: input.month,
  kind: input.kind,
  amount: Math.round(input.amount * 100) / 100,
  // A cut moves no money, so it has no method.
  method: isPaidOut(input.kind) ? input.method : "",
  date: payDate(input.date)!,
  note: input.note.trim().slice(0, 200),
});

export async function addSalaryEntry(input: SalaryEntryInput) {
  const who = await ownerOnly();
  if (!who.ok) return { ok: false as const, error: who.error };
  const problem = checkEntry(input);
  if (problem) return { ok: false as const, error: problem };
  const employee = await db.employee.findUnique({ where: { id: input.employeeId }, select: { id: true } });
  if (!employee) return { ok: false as const, error: "They're no longer on the payroll" };
  await db.salaryEntry.create({ data: { employeeId: input.employeeId, ...entryData(input), recordedBy: who.userName } });
  refresh();
  return { ok: true as const };
}

export async function updateSalaryEntry(id: string, input: Omit<SalaryEntryInput, "employeeId">) {
  const who = await ownerOnly();
  if (!who.ok) return { ok: false as const, error: who.error };
  const problem = checkEntry(input);
  if (problem) return { ok: false as const, error: problem };
  const updated = await db.salaryEntry.updateMany({ where: { id }, data: entryData(input) });
  if (updated.count === 0) return { ok: false as const, error: "This has been deleted" };
  refresh();
  return { ok: true as const };
}

// To the trash (restorable for 30 days by the owner), not gone for good.
export async function deleteSalaryEntry(id: string) {
  const who = await ownerOnly();
  if (!who.ok) return { ok: false as const, error: who.error };
  try {
    await trashSalaryEntry(id, who.userId);
  } catch (e) {
    if (e instanceof TrashError) return { ok: false as const, error: e.message };
    throw e;
  }
  refresh();
  revalidatePath("/dashboard/trash");
  return { ok: true as const };
}

"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import type { EmployeeView, SalaryEntryView } from "@/lib/data";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { useApp } from "@/lib/context";
import {
  addSalaryEntry, createEmployee, deleteEmployee, deleteSalaryEntry, setEmployeeLeft, updateEmployee, updateSalaryEntry,
} from "@/lib/actions/salaries";
import {
  SALARY_KIND_LABEL, SALARY_KINDS, SALARY_METHODS, isPaidOut, monthKey, monthName, payFor, salaryFor, shiftMonth,
  type SalaryKindValue,
} from "@/lib/salaries";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp, HandCoins, Loader2, Pencil, Plus, Trash2, UserMinus, UserPlus, X,
} from "lucide-react";

// The shop's calendar day, for date boxes.
const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const monthOf = (day: string) => day.slice(0, 7);
const amountText = (n: number) => (n ? String(n) : "");

const EMPTY_STAFF = { name: "", jobTitle: "", phone: "", monthlySalary: "", joinedOn: "", notes: "", salaryFrom: "" };
type StaffForm = typeof EMPTY_STAFF;
type EntryForm = { kind: SalaryKindValue; amount: string; month: string; date: string; method: string; note: string };

const KIND_ACTIONS: { kind: SalaryKindValue; label: string; tone: string }[] = [
  { kind: "SALARY", label: "Pay", tone: "bg-primary text-white hover:bg-primary-hover" },
  { kind: "ADVANCE", label: "Advance", tone: "bg-surface hover:bg-surface-hover" },
  { kind: "BONUS", label: "Bonus", tone: "bg-surface hover:bg-surface-hover" },
  { kind: "DEDUCTION", label: "Cut", tone: "bg-surface hover:bg-surface-hover" },
];

/**
 * The month's pay sheet: what each person is owed, what they've had as
 * advances and salary, bonuses and cuts, and what's left to pay. Pay handed
 * over in cash comes out of that day's drawer on the Cash page.
 */
export function SalariesClient({ month, employees }: { month: string; employees: EmployeeView[] }) {
  const { showToast } = useApp();
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);
  const [showFormer, setShowFormer] = useState(false);
  const [busy, setBusy] = useState(false);

  const [staffDialog, setStaffDialog] = useState<{ editing: EmployeeView | null } | null>(null);
  const [staffForm, setStaffForm] = useState<StaffForm>({ ...EMPTY_STAFF });
  const [entryDialog, setEntryDialog] = useState<{ employee: EmployeeView; entry: SalaryEntryView | null } | null>(null);
  const [entryForm, setEntryForm] = useState<EntryForm>({ kind: "SALARY", amount: "", month, date: todayLocal(), method: "Cash", note: "" });
  const [confirm, setConfirm] = useState<
    | { kind: "entry"; employee: EmployeeView; entry: SalaryEntryView }
    | { kind: "left"; employee: EmployeeView }
    | { kind: "remove"; employee: EmployeeView }
    | null
  >(null);

  const thisMonth = monthKey(new Date());
  // On the month's sheet: everyone who worked here then, and anyone with pay recorded for it.
  const onSheet = employees.filter((e) =>
    e.entries.length > 0 ||
    ((!e.joinedOn || monthOf(e.joinedOn) <= month) && (e.active || (!!e.leftOn && monthOf(e.leftOn) >= month))));
  const former = employees.filter((e) => !e.active);
  const rows = onSheet.map((e) => ({ e, pay: payFor(salaryFor(e.salaryHistory, e.monthlySalary, month), e.entries) }));
  const owed = rows.reduce((t, r) => t + r.pay.salary - r.pay.cuts, 0);
  const handedOver = rows.reduce((t, r) => t + r.pay.handedOver, 0);
  const toPay = rows.reduce((t, r) => t + Math.max(0, r.pay.remaining), 0);

  const goMonth = (m: string) => router.push(`/dashboard/salaries?month=${m}`);

  const run = async (work: () => Promise<{ ok: true } | { ok: false; error: string }>, done: string) => {
    setBusy(true);
    try {
      const res = await work();
      if (!res.ok) { showToast(res.error, "error"); return false; }
      showToast(done, "success");
      router.refresh();
      return true;
    } catch {
      showToast("Couldn't save — check the connection and try again", "error");
      return false;
    } finally {
      setBusy(false);
    }
  };

  // ─── Staff ────────────────────────────────────────────────
  const openStaff = (editing: EmployeeView | null) => {
    setStaffForm(editing
      ? { name: editing.name, jobTitle: editing.jobTitle, phone: editing.phone, monthlySalary: amountText(editing.monthlySalary), joinedOn: editing.joinedOn, notes: editing.notes, salaryFrom: thisMonth }
      : { ...EMPTY_STAFF, salaryFrom: thisMonth });
    setStaffDialog({ editing });
  };
  const salaryChanged = !!staffDialog?.editing && Number(staffForm.monthlySalary || 0) !== staffDialog.editing.monthlySalary;
  const saveStaff = async () => {
    if (!staffDialog) return;
    const input = {
      name: staffForm.name, jobTitle: staffForm.jobTitle, phone: staffForm.phone, monthlySalary: Number(staffForm.monthlySalary || 0),
      joinedOn: staffForm.joinedOn, notes: staffForm.notes, salaryFrom: salaryChanged ? staffForm.salaryFrom : undefined,
    };
    const editing = staffDialog.editing;
    const ok = await run(
      () => (editing ? updateEmployee(editing.id, input) : createEmployee(input)),
      editing ? `${input.name.trim()} updated` : `${input.name.trim()} added to the payroll`,
    );
    if (ok) setStaffDialog(null);
  };

  // ─── Pay ──────────────────────────────────────────────────
  const openEntry = (employee: EmployeeView, kind: SalaryKindValue, remaining: number, entry: SalaryEntryView | null = null) => {
    setEntryForm(entry
      ? { kind: entry.kind, amount: amountText(entry.amount), month: entry.month, date: entry.date.slice(0, 10), method: entry.method || "Cash", note: entry.note }
      : { kind, amount: kind === "SALARY" && remaining > 0 ? String(remaining) : "", month, date: todayLocal(), method: "Cash", note: "" });
    setEntryDialog({ employee, entry });
  };
  const saveEntry = async () => {
    if (!entryDialog) return;
    const { employee, entry } = entryDialog;
    const input = { ...entryForm, amount: Number(entryForm.amount || 0) };
    const what = SALARY_KIND_LABEL[input.kind].toLowerCase();
    const ok = await run(
      () => (entry ? updateSalaryEntry(entry.id, input) : addSalaryEntry({ ...input, employeeId: employee.id })),
      entry ? "Saved" : `${employee.name}: ${what} of ${formatCurrency(input.amount)} recorded`,
    );
    if (ok) setEntryDialog(null);
  };

  const confirmAction = async () => {
    if (!confirm) return;
    const { employee } = confirm;
    const ok = confirm.kind === "entry"
      ? await run(() => deleteSalaryEntry(confirm.entry.id), "Moved to the Trash — the owner can restore it for 30 days")
      : confirm.kind === "left"
        ? await run(() => setEmployeeLeft(employee.id, true), `${employee.name} marked as left — their pay history stays`)
        : await run(() => deleteEmployee(employee.id), `${employee.name} removed`);
    if (ok) { setConfirm(null); setStaffDialog(null); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Salaries</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Staff pay for the month — advances, salary, bonuses and cuts. Only you see this.</p>
        </div>
        <button onClick={() => openStaff(null)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-hover transition-colors cursor-pointer">
          <UserPlus className="w-4 h-4" /> Add staff
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button onClick={() => goMonth(shiftMonth(month, -1))} className="p-2 rounded-lg bg-surface hover:bg-surface-hover cursor-pointer" aria-label="Previous month">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <p className="text-sm font-semibold min-w-[140px] text-center">{monthName(month)}</p>
        <button onClick={() => goMonth(shiftMonth(month, 1))} disabled={month >= thisMonth}
          className="p-2 rounded-lg bg-surface hover:bg-surface-hover cursor-pointer disabled:opacity-40" aria-label="Next month">
          <ChevronRight className="w-4 h-4" />
        </button>
        {month !== thisMonth && (
          <button onClick={() => goMonth(thisMonth)} className="text-xs text-primary font-medium ml-1 cursor-pointer">This month</button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card p-4">
          <p className="text-xs text-muted-foreground">{`Salaries for ${monthName(month)}`}</p>
          <p className="text-xl font-bold mt-1">{formatCurrency(owed)}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{`${rows.length} on the sheet, after any cuts`}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-xs text-muted-foreground">Handed over</p>
          <p className="text-xl font-bold mt-1 text-success">{formatCurrency(handedOver)}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Advances, salary and bonuses</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-xs text-muted-foreground">Still to pay</p>
          <p className="text-xl font-bold mt-1 text-destructive">{formatCurrency(toPay)}</p>
        </div>
      </div>

      <div className="glass-card p-4">
        {rows.length === 0 ? (
          <EmptyState icon={HandCoins}
            title={employees.length === 0 ? "No one on the payroll yet" : `No one on the payroll in ${monthName(month)}`}
            hint={employees.length === 0 ? "Add your staff with their monthly salary, then record advances and pay here." : "Pick another month, or add staff."} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="text-left font-medium py-3 px-3">Staff</th>
                  <th className="text-right font-medium py-3 px-3">Salary</th>
                  <th className="text-right font-medium py-3 px-3">Advances</th>
                  <th className="text-right font-medium py-3 px-3">Paid</th>
                  <th className="text-right font-medium py-3 px-3">Bonus</th>
                  <th className="text-right font-medium py-3 px-3">Cuts</th>
                  <th className="text-right font-medium py-3 px-3">Still to pay</th>
                  <th className="text-center font-medium py-3 px-3">Record</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ e, pay }) => {
                  const isOpen = open === e.id;
                  return (
                    <Fragment key={e.id}>
                      <tr className="border-b border-border hover:bg-surface-hover/50">
                        <td className="py-3 px-3">
                          <button onClick={() => setOpen(isOpen ? null : e.id)} className="flex items-center gap-1.5 text-left cursor-pointer">
                            {isOpen ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                            <span>
                              <span className="font-medium block">{e.name}</span>
                              <span className="text-[11px] text-muted-foreground">
                                {[e.jobTitle, !e.active && e.leftOn && `left ${formatDate(e.leftOn)}`, `${e.entries.length} entr${e.entries.length === 1 ? "y" : "ies"}`].filter(Boolean).join(" · ")}
                              </span>
                            </span>
                          </button>
                        </td>
                        <td className="py-3 px-3 text-right tabular-nums">{formatCurrency(pay.salary)}</td>
                        <td className="py-3 px-3 text-right tabular-nums">{pay.advances ? formatCurrency(pay.advances) : "—"}</td>
                        <td className="py-3 px-3 text-right tabular-nums">{pay.paid ? formatCurrency(pay.paid) : "—"}</td>
                        <td className="py-3 px-3 text-right tabular-nums">{pay.bonus ? formatCurrency(pay.bonus) : "—"}</td>
                        <td className="py-3 px-3 text-right tabular-nums">{pay.cuts ? formatCurrency(pay.cuts) : "—"}</td>
                        <td className={`py-3 px-3 text-right font-semibold tabular-nums ${pay.remaining > 0 ? "text-destructive" : "text-success"}`}>
                          {pay.remaining > 0 ? formatCurrency(pay.remaining) : pay.remaining < 0 ? `${formatCurrency(-pay.remaining)} over` : "Paid ✓"}
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center justify-center gap-1">
                            {KIND_ACTIONS.map((a) => (
                              <button key={a.kind} onClick={() => openEntry(e, a.kind, pay.remaining)}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer transition-colors ${a.tone}`}>
                                {a.label}
                              </button>
                            ))}
                            <button onClick={() => openStaff(e)} title="Edit their details or salary" className="p-1.5 rounded-lg hover:bg-surface-hover cursor-pointer">
                              <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="border-b border-border">
                          <td colSpan={8} className="px-3 pb-3">
                            {e.entries.length === 0 ? (
                              <p className="text-xs text-muted-foreground py-2">{`Nothing recorded for ${monthName(month)} yet.`}</p>
                            ) : (
                              <div className="rounded-xl bg-surface p-2.5 space-y-1.5 text-xs">
                                {e.entries.map((x) => (
                                  <div key={x.id} className="flex items-center justify-between gap-3">
                                    <span className="min-w-0">
                                      <span className="font-semibold">{SALARY_KIND_LABEL[x.kind]}</span>
                                      <span className="text-muted-foreground">
                                        {` · ${formatDate(x.date)}${x.method ? ` · ${x.method}` : ""}${x.note ? ` · ${x.note}` : ""}${x.recordedBy ? ` · by ${x.recordedBy}` : ""}`}
                                      </span>
                                    </span>
                                    <span className="flex items-center gap-1 flex-shrink-0">
                                      <span className={`font-semibold tabular-nums ${x.kind === "DEDUCTION" ? "text-destructive" : ""}`}>
                                        {x.kind === "DEDUCTION" ? `−${formatCurrency(x.amount)}` : formatCurrency(x.amount)}
                                      </span>
                                      <button onClick={() => openEntry(e, x.kind, pay.remaining, x)} title="Correct this" className="p-1 rounded-md hover:bg-surface-hover cursor-pointer">
                                        <Pencil className="w-3 h-3 text-muted-foreground" />
                                      </button>
                                      <button onClick={() => setConfirm({ kind: "entry", employee: e, entry: x })} title="Delete this" className="p-1 rounded-md hover:bg-surface-hover cursor-pointer">
                                        <Trash2 className="w-3 h-3 text-destructive" />
                                      </button>
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                            {[e.phone, e.joinedOn && `joined ${formatDate(e.joinedOn)}`, e.notes].filter(Boolean).length > 0 && (
                              <p className="text-[11px] text-muted-foreground mt-2">{[e.phone, e.joinedOn && `joined ${formatDate(e.joinedOn)}`, e.notes].filter(Boolean).join(" · ")}</p>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-[11px] text-muted-foreground mt-3">
          Pay handed over in cash comes out of that day&apos;s drawer on the Cash page, and all of it counts as a cost in Analytics. A cut only lowers what&apos;s owed.
        </p>
      </div>

      {former.length > 0 && (
        <div className="glass-card p-4">
          <button onClick={() => setShowFormer((v) => !v)} className="flex items-center gap-1.5 text-sm font-semibold cursor-pointer">
            {showFormer ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {`Former staff (${former.length})`}
          </button>
          {showFormer && (
            <div className="mt-3 space-y-2">
              {former.map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-surface text-sm">
                  <span>
                    <span className="font-medium">{e.name}</span>
                    <span className="text-xs text-muted-foreground">{[e.jobTitle && ` · ${e.jobTitle}`, e.leftOn && ` · left ${formatDate(e.leftOn)}`].filter(Boolean).join("")}</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <button onClick={() => run(() => setEmployeeLeft(e.id, false), `${e.name} is back on the payroll`)} disabled={busy}
                      className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-[11px] font-semibold cursor-pointer disabled:opacity-60">
                      Back on the payroll
                    </button>
                    {!e.hasEntries && (
                      <button onClick={() => setConfirm({ kind: "remove", employee: e })} title="Remove — added by mistake"
                        className="p-1.5 rounded-lg hover:bg-surface-hover cursor-pointer">
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </button>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {staffDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setStaffDialog(null)}>
          <div className="glass-modal solid-sheet p-6 w-full max-w-md animate-rise max-h-[92vh] overflow-y-auto" onClick={(ev) => ev.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">{staffDialog.editing ? `Edit ${staffDialog.editing.name}` : "Add staff"}</h3>
              <button onClick={() => setStaffDialog(null)} className="cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Name *</label>
                <input type="text" value={staffForm.name} onChange={(ev) => setStaffForm({ ...staffForm, name: ev.target.value })} className="w-full px-4 py-2.5 glass-input text-sm" autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Job</label>
                  <input type="text" value={staffForm.jobTitle} onChange={(ev) => setStaffForm({ ...staffForm, jobTitle: ev.target.value })}
                    className="w-full px-3 py-2.5 glass-input text-sm" placeholder="e.g. Optometrist, fitter" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Phone</label>
                  <input type="text" value={staffForm.phone} onChange={(ev) => setStaffForm({ ...staffForm, phone: ev.target.value })} className="w-full px-3 py-2.5 glass-input text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Monthly salary *</label>
                  <input type="number" min={0} inputMode="numeric" value={staffForm.monthlySalary}
                    onChange={(ev) => setStaffForm({ ...staffForm, monthlySalary: ev.target.value })} className="w-full px-3 py-2.5 glass-input text-sm" placeholder="Rs." />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Joined on</label>
                  <input type="date" value={staffForm.joinedOn} max={todayLocal()} onChange={(ev) => setStaffForm({ ...staffForm, joinedOn: ev.target.value })} className="w-full px-3 py-2.5 glass-input text-sm" />
                </div>
              </div>
              {salaryChanged && (
                <div className="p-3 rounded-xl border border-primary/30 bg-primary/5">
                  <label className="text-xs font-medium mb-1.5 block">The new salary starts from</label>
                  <input type="month" value={staffForm.salaryFrom} onChange={(ev) => setStaffForm({ ...staffForm, salaryFrom: ev.target.value || thisMonth })}
                    className="px-3 py-2 glass-input text-sm" />
                  <p className="text-[10px] text-muted-foreground mt-1">Months before it keep the old salary, so what was owed then doesn&apos;t change.</p>
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Notes</label>
                <input type="text" value={staffForm.notes} onChange={(ev) => setStaffForm({ ...staffForm, notes: ev.target.value })} className="w-full px-4 py-2.5 glass-input text-sm" />
              </div>
              <button onClick={saveStaff} disabled={busy}
                className="w-full py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-hover transition-colors disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer">
                {busy && <Loader2 className="w-4 h-4 animate-spin" />} {staffDialog.editing ? "Save changes" : "Add to the payroll"}
              </button>
              {staffDialog.editing?.active && (
                <button onClick={() => setConfirm({ kind: "left", employee: staffDialog.editing! })}
                  className="w-full py-2 rounded-xl text-xs font-medium bg-surface hover:bg-surface-hover flex items-center justify-center gap-1.5 cursor-pointer">
                  <UserMinus className="w-3.5 h-3.5" /> They&apos;ve left the shop
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {entryDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEntryDialog(null)}>
          <div className="glass-modal solid-sheet p-6 w-full max-w-md animate-rise max-h-[92vh] overflow-y-auto" onClick={(ev) => ev.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">
                {entryDialog.entry ? `Correct — ${entryDialog.employee.name}` : `${SALARY_KIND_LABEL[entryForm.kind]} — ${entryDialog.employee.name}`}
              </h3>
              <button onClick={() => setEntryDialog(null)} className="cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              {entryDialog.entry && (
                <div className="flex gap-1.5 flex-wrap">
                  {SALARY_KINDS.map((k) => (
                    <button key={k} onClick={() => setEntryForm({ ...entryForm, kind: k })}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer ${entryForm.kind === k ? "bg-primary text-white" : "bg-surface hover:bg-surface-hover"}`}>
                      {SALARY_KIND_LABEL[k]}
                    </button>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Amount *</label>
                  <input type="number" min={0} inputMode="numeric" value={entryForm.amount} autoFocus
                    onChange={(ev) => setEntryForm({ ...entryForm, amount: ev.target.value })} className="w-full px-3 py-2.5 glass-input text-sm" placeholder="Rs." />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">For the month of</label>
                  <input type="month" value={entryForm.month} max={thisMonth}
                    onChange={(ev) => setEntryForm({ ...entryForm, month: ev.target.value || month })} className="w-full px-3 py-2.5 glass-input text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{isPaidOut(entryForm.kind) ? "Paid on" : "Date"}</label>
                  <input type="date" value={entryForm.date} max={todayLocal()}
                    onChange={(ev) => setEntryForm({ ...entryForm, date: ev.target.value || todayLocal() })} className="w-full px-3 py-2.5 glass-input text-sm" />
                </div>
                {isPaidOut(entryForm.kind) && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Paid by</label>
                    <select value={entryForm.method} onChange={(ev) => setEntryForm({ ...entryForm, method: ev.target.value })} className="w-full px-3 py-2.5 glass-input text-sm">
                      {SALARY_METHODS.map((m) => <option key={m} value={m}>{m === "Cash" ? "Cash (from the drawer)" : m}</option>)}
                    </select>
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Note</label>
                <input type="text" value={entryForm.note} onChange={(ev) => setEntryForm({ ...entryForm, note: ev.target.value })}
                  className="w-full px-4 py-2.5 glass-input text-sm"
                  placeholder={entryForm.kind === "DEDUCTION" ? "Why — e.g. 2 days absent" : entryForm.kind === "BONUS" ? "e.g. Eid bonus" : "Optional"} />
              </div>
              <p className="text-[11px] text-muted-foreground">
                {entryForm.kind === "DEDUCTION"
                  ? "A cut lowers what they're owed for the month. No money moves."
                  : entryForm.method === "Cash"
                    ? "Paid in cash: it comes out of that day's drawer on the Cash page."
                    : "Not cash, so the drawer isn't touched. It still counts as a cost in Analytics."}
              </p>
              <button onClick={saveEntry} disabled={busy}
                className="w-full py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-hover transition-colors disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} {entryDialog.entry ? "Save" : "Record"}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirm && (
        <ConfirmDialog
          title={
            confirm.kind === "entry"
              ? `Delete this ${SALARY_KIND_LABEL[confirm.entry.kind].toLowerCase()}?`
              : confirm.kind === "left"
                ? `Has ${confirm.employee.name} left the shop?`
                : `Remove ${confirm.employee.name}?`
          }
          message={
            confirm.kind === "entry"
              ? `${confirm.employee.name} · ${formatCurrency(confirm.entry.amount)} · ${formatDate(confirm.entry.date)}. It moves to the Trash and can be restored for 30 days.`
              : confirm.kind === "left"
                ? "They come off the month's pay sheet from next month. Everything they were paid stays, and you can put them back on the payroll any time."
                : "No pay is recorded for them, so they're removed completely."
          }
          confirmLabel={confirm.kind === "entry" ? "Move to Trash" : confirm.kind === "left" ? "Yes, they've left" : "Remove"}
          busy={busy}
          onConfirm={confirmAction}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}

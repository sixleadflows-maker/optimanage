"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { BankDepositView } from "@/lib/data";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { useApp } from "@/lib/context";
import { createBankDeposit, updateBankDeposit, deleteBankDeposit } from "@/lib/actions/deposits";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Landmark, Plus, Pencil, Trash2, X, Loader2 } from "lucide-react";

const blank = (date: string) => ({ date, amount: 0, bankName: "", reference: "", notes: "" });

/**
 * Cash the owner takes to the bank. It's listed here, apart from Expenses,
 * because it leaves the drawer without being a cost. Each one can be changed or
 * removed afterwards (removed ones go to the Trash).
 */
export function BankDeposits({
  deposits,
  date,
  canManage,
}: {
  deposits: BankDepositView[];
  // The day being looked at -- where a new deposit is dated by default.
  date: string;
  canManage: boolean;
}) {
  const { showToast } = useApp();
  const router = useRouter();
  // null = closed; an id = correcting that deposit; "new" = adding one.
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(blank(date));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<BankDepositView | null>(null);
  const [removing, setRemoving] = useState(false);

  const total = deposits.reduce((sum, d) => sum + d.amount, 0);

  const openNew = () => {
    setForm(blank(date));
    setEditing("new");
  };
  const openEdit = (d: BankDepositView) => {
    setForm({ date: d.date, amount: d.amount, bankName: d.bankName, reference: d.reference, notes: d.notes });
    setEditing(d.id);
  };

  const save = async () => {
    if (!(form.amount > 0)) { showToast("Enter the amount deposited", "error"); return; }
    setSaving(true);
    try {
      const res = editing === "new" ? await createBankDeposit(form) : await updateBankDeposit(editing!, form);
      if (!res.ok) { showToast(res.error, "error"); return; }
      showToast(editing === "new" ? `${formatCurrency(form.amount)} deposit recorded` : "Deposit updated", "success");
      setEditing(null);
      // A deposit dated another day moves off this page, so follow it there.
      if (form.date !== date) router.push(`/dashboard/cash?date=${form.date}`);
      else router.refresh();
    } catch {
      showToast("Couldn't save — check the connection and try again", "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setRemoving(true);
    try {
      const res = await deleteBankDeposit(deleting.id);
      if (!res.ok) { showToast(res.error, "error"); return; }
      showToast("Deposit moved to Trash", "success");
      setDeleting(null);
      router.refresh();
    } catch {
      showToast("Couldn't delete — check the connection and try again", "error");
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="glass-card p-5 h-fit">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold flex items-center gap-2"><Landmark className="w-4 h-4 text-primary" /> Bank Deposits</h3>
        <button onClick={openNew}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/15 transition-colors cursor-pointer">
          <Plus className="w-3.5 h-3.5" /> Deposit cash
        </button>
      </div>
      <p className="text-[11px] text-muted-foreground mb-3">
        Cash taken to the bank comes off the drawer but isn&apos;t an expense, so it stays out of profit.
      </p>

      {deposits.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">Nothing deposited on {formatDate(date)}</p>
      ) : (
        <div className="space-y-2">
          {deposits.map((d) => (
            <div key={d.id} className="p-3 rounded-xl bg-surface flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold">{formatCurrency(d.amount)}</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {[d.bankName, d.reference && `Slip ${d.reference}`, d.depositedBy && `by ${d.depositedBy}`].filter(Boolean).join(" · ") || "No bank noted"}
                </p>
                {d.notes && <p className="text-[11px] text-muted-foreground mt-0.5">{d.notes}</p>}
              </div>
              {canManage && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => openEdit(d)} title="Edit deposit" className="p-1.5 rounded-lg hover:bg-surface-hover cursor-pointer">
                    <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                  <button onClick={() => setDeleting(d)} title="Delete deposit" className="p-1.5 rounded-lg hover:bg-surface-hover cursor-pointer">
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </button>
                </div>
              )}
            </div>
          ))}
          <div className="flex justify-between text-sm font-semibold border-t border-border pt-2">
            <span>Deposited</span><span>{formatCurrency(total)}</span>
          </div>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !saving && setEditing(null)}>
          <div className="glass-modal p-6 w-full max-w-md animate-rise" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">{editing === "new" ? "Deposit Cash in the Bank" : "Edit Bank Deposit"}</h3>
              <button onClick={() => setEditing(null)} className="cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Date *</label>
                  <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="w-full px-3 py-2.5 glass-input text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Amount *</label>
                  <input type="number" min={0} autoFocus value={form.amount || ""} placeholder="0"
                    onChange={(e) => setForm({ ...form, amount: Math.max(0, Number(e.target.value)) })}
                    className="w-full px-3 py-2.5 glass-input text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Bank</label>
                  <input type="text" value={form.bankName} placeholder="e.g. Meezan Bank"
                    onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                    className="w-full px-3 py-2.5 glass-input text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Deposit slip no.</label>
                  <input type="text" value={form.reference}
                    onChange={(e) => setForm({ ...form, reference: e.target.value })}
                    className="w-full px-3 py-2.5 glass-input text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Notes</label>
                <input type="text" value={form.notes} placeholder="Optional"
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full px-3 py-2.5 glass-input text-sm" />
              </div>
              <button onClick={save} disabled={saving}
                className="w-full py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-hover transition-colors disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />} {editing === "new" ? "Record Deposit" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete this bank deposit?"
          message={`${formatCurrency(deleting.amount)} on ${formatDate(deleting.date)}. It moves to the Trash and can be restored for 30 days — the cash goes back into that day's drawer until then.`}
          busy={removing}
          onConfirm={remove}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}

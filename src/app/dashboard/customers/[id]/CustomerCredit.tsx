"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import type { CreditEntryView } from "@/lib/data";
import { addCustomerCredit, deleteCustomerCredit, refundCustomerCredit } from "@/lib/actions/credit";
import { PAYMENT_METHODS } from "@/lib/constants";
import { formatCurrency, toLocalInput } from "@/lib/utils/format";
import { useApp } from "@/lib/context";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Loader2, PiggyBank, Plus, Trash2, Undo2, X } from "lucide-react";

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-PK", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

const KIND_LABEL = { in: "Received", used: "Used", refund: "Refunded" } as const;

/**
 * The advance a customer has paid in for the shop to hold: what's there now,
 * taking more in, handing some back, and everything that's happened to it.
 * Bills are paid from it at the till or from Receive payment.
 */
export function CustomerCredit({
  customerId, customerLabel, held, history, canManage,
}: {
  customerId: string;
  customerLabel: string;
  held: number;
  history: CreditEntryView[];
  // Owners and managers can remove an entry made by mistake.
  canManage: boolean;
}) {
  const { showToast } = useApp();
  const router = useRouter();
  const [form, setForm] = useState<"add" | "refund" | null>(null);
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState<string>("Cash");
  const [at, setAt] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<CreditEntryView | null>(null);
  const [busy, setBusy] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const open = (kind: "add" | "refund") => {
    setAmount(kind === "refund" ? held : 0);
    setMethod("Cash");
    setAt(toLocalInput(new Date()));
    setNote("");
    setForm(kind);
  };

  const atDate = new Date(at);
  const problem =
    !(amount > 0) ? "Enter the amount"
    : form === "refund" && amount > held + 0.01 ? `Only ${formatCurrency(held)} is held`
    : !at || Number.isNaN(atDate.getTime()) ? "Enter the date and time"
    : "";

  const save = async () => {
    if (saving || problem || !form) return;
    setSaving(true);
    try {
      const input = { customerId, amount, method, date: atDate.toISOString(), note };
      const res = form === "add" ? await addCustomerCredit(input) : await refundCustomerCredit(input);
      if (!res.ok) { showToast(res.error, "error"); return; }
      showToast(
        form === "add"
          ? `${formatCurrency(amount)} advance received — ${formatCurrency(res.held)} now held for ${customerLabel}`
          : `${formatCurrency(amount)} handed back — ${res.held > 0 ? `${formatCurrency(res.held)} still held` : "nothing held now"}`,
        "success",
      );
      setForm(null);
      router.refresh();
    } catch {
      showToast("Couldn't save — check the connection and try again", "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!removing) return;
    setBusy(true);
    try {
      const res = await deleteCustomerCredit(removing.id);
      if (!res.ok) { showToast(res.error, "error"); return; }
      showToast("Entry moved to the Trash", "success");
      setRemoving(null);
      router.refresh();
    } catch {
      showToast("Couldn't remove it — check the connection and try again", "error");
    } finally {
      setBusy(false);
    }
  };

  const shown = showAll ? history : history.slice(0, 5);

  return (
    <div className="glass-card p-5">
      <h3 className="text-sm font-semibold flex items-center gap-1.5"><PiggyBank className="w-4 h-4 text-success" /> Advance held</h3>
      <p className={`text-2xl font-bold mt-2 ${held > 0 ? "text-success" : ""}`}>{formatCurrency(held)}</p>
      <p className="text-[11px] text-muted-foreground mt-1">
        Money paid ahead. Use it on a bill at the till or from Receive payment — whatever&apos;s left stays here, or can be handed back.
      </p>
      <div className="grid grid-cols-2 gap-2 mt-3">
        <button onClick={() => open("add")}
          className="flex items-center justify-center gap-1.5 py-2 bg-primary text-white rounded-xl text-xs font-semibold hover:bg-primary-hover transition-colors cursor-pointer">
          <Plus className="w-3.5 h-3.5" /> Add advance
        </button>
        <button onClick={() => open("refund")} disabled={held <= 0}
          className="flex items-center justify-center gap-1.5 py-2 bg-surface hover:bg-surface-hover rounded-xl text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer">
          <Undo2 className="w-3.5 h-3.5" /> Refund
        </button>
      </div>

      {history.length > 0 && (
        <div className="mt-4 pt-3 border-t border-border space-y-2 text-xs">
          {shown.map((e) => (
            <div key={`${e.kind}-${e.id}`} className="flex items-start justify-between gap-2">
              <span className="min-w-0">
                <span className="font-medium">
                  {e.kind === "used" ? `Used on ${e.invoiceNo}` : `${KIND_LABEL[e.kind]} · ${e.method}`}
                </span>
                <span className="block text-[10px] text-muted-foreground">
                  {[when(e.date), e.by, e.note].filter(Boolean).join(" · ")}
                </span>
              </span>
              <span className="flex items-center gap-1 flex-shrink-0">
                <span className={`font-semibold ${e.amount > 0 ? "text-success" : "text-muted-foreground"}`}>
                  {`${e.amount > 0 ? "+" : "−"}${formatCurrency(Math.abs(e.amount))}`}
                </span>
                {canManage && e.kind !== "used" && (
                  <button onClick={() => setRemoving(e)} title="Entered by mistake — remove"
                    className="p-1 rounded-md hover:bg-surface-hover cursor-pointer">
                    <Trash2 className="w-3 h-3 text-destructive" />
                  </button>
                )}
              </span>
            </div>
          ))}
          {history.length > 5 && (
            <button onClick={() => setShowAll((v) => !v)} className="text-[11px] text-primary font-medium hover:underline cursor-pointer">
              {showAll ? "Show less" : `Show all ${history.length}`}
            </button>
          )}
        </div>
      )}

      {/* Opened on the page itself: inside this card its glass effect would
          trap a full-screen window within the card. */}
      {form && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setForm(null)}>
          <div className="glass-modal p-6 w-full max-w-md animate-rise text-left" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-lg font-semibold">{form === "add" ? "Add advance" : "Refund advance"}</h3>
              <button onClick={() => setForm(null)} className="cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              {form === "add"
                ? `${customerLabel} is paying money ahead. It counts in today's takings and waits here until a bill uses it.`
                : `Handing money back to ${customerLabel}. ${formatCurrency(held)} is held now.`}
            </p>

            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Amount</label>
            <div className="flex gap-2">
              <input type="number" min={0} value={amount || ""} autoFocus
                onChange={(e) => setAmount(Math.max(0, Number(e.target.value) || 0))}
                className="flex-1 px-3 py-2.5 glass-input text-sm" />
              {form === "refund" && (
                <button onClick={() => setAmount(held)}
                  className="px-3 py-2.5 rounded-xl bg-surface hover:bg-surface-hover text-xs font-medium whitespace-nowrap cursor-pointer">
                  All of it
                </button>
              )}
            </div>

            <label className="text-xs font-medium text-muted-foreground mb-1.5 block mt-3">{form === "add" ? "Paid by" : "Handed back by"}</label>
            <div className="grid grid-cols-4 gap-1.5">
              {PAYMENT_METHODS.map((m) => (
                <button key={m} onClick={() => setMethod(m)}
                  className={`py-2 rounded-xl text-[11px] font-medium transition-all cursor-pointer ${method === m ? "bg-primary text-white" : "bg-surface hover:bg-surface-hover"}`}>
                  {m}
                </button>
              ))}
            </div>

            <label className="text-xs font-medium text-muted-foreground mb-1.5 block mt-3">When</label>
            <input type="datetime-local" value={at} max={toLocalInput(new Date())} onChange={(e) => setAt(e.target.value)}
              className="w-full px-3 py-2.5 glass-input text-sm" />

            <label className="text-xs font-medium text-muted-foreground mb-1.5 block mt-3">Note (optional)</label>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)}
              placeholder="What it's for, who brought it..." className="w-full px-3 py-2.5 glass-input text-sm" />

            {problem && amount > 0 && <p className="text-[11px] text-destructive mt-2">{problem}</p>}

            <div className="flex gap-2 mt-5">
              <button onClick={() => setForm(null)} className="flex-1 py-2.5 glass-card text-sm font-medium cursor-pointer">Cancel</button>
              <button onClick={save} disabled={saving || !!problem}
                className="flex-1 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-hover transition-colors disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {form === "add" ? `Receive ${amount > 0 ? formatCurrency(amount) : ""}` : `Hand back ${amount > 0 ? formatCurrency(amount) : ""}`}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {removing && createPortal(
        <ConfirmDialog
          title={removing.kind === "in" ? "Remove this advance?" : "Remove this refund?"}
          message={`${formatCurrency(Math.abs(removing.amount))} on ${when(removing.date)}. It moves to the Trash and can be restored for 30 days — that day's cash changes with it.`}
          busy={busy}
          onConfirm={remove}
          onCancel={() => setRemoving(null)}
        />,
        document.body,
      )}
    </div>
  );
}

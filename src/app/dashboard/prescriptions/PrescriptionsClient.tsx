"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { PrescriptionView } from "@/lib/data";
import { formatDate } from "@/lib/utils/format";
import { useApp } from "@/lib/context";
import { createPrescription, deletePrescription, updatePrescription, setPrescriptionNotesHidden } from "@/lib/actions/prescriptions";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Eye, Save, Search, Loader2, Pencil, Trash2, X, EyeOff } from "lucide-react";

interface RxCustomer { id: string; name: string; phone: string; }

const empty = {
  rightSph: "", rightCyl: "", rightAxis: "", rightPd: "", rightAdd: "",
  leftSph: "", leftCyl: "", leftAxis: "", leftPd: "", leftAdd: "",
  notes: "",
};

const show = (n: number) => (n === 0 ? "" : String(n));

export function PrescriptionsClient({
  prescriptions,
  customers,
  canDelete,
}: {
  prescriptions: PrescriptionView[];
  customers: RxCustomer[];
  canDelete: boolean;
}) {
  const { showToast } = useApp();
  const router = useRouter();
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [isOwn, setIsOwn] = useState(false);
  const [form, setForm] = useState({ ...empty });
  // Set while the form is correcting an existing prescription.
  const [editing, setEditing] = useState<PrescriptionView | null>(null);
  const [deleting, setDeleting] = useState<PrescriptionView | null>(null);
  const [removing, setRemoving] = useState(false);
  const [listSearch, setListSearch] = useState("");
  const [togglingNotes, setTogglingNotes] = useState<string | null>(null);

  const toggleNotes = async (rx: PrescriptionView) => {
    setTogglingNotes(rx.id);
    try {
      const res = await setPrescriptionNotesHidden(rx.id, !rx.notesHidden);
      if (!res.ok) {
        showToast(res.error, "error");
        return;
      }
      showToast(rx.notesHidden ? "Notes shown again" : "Notes hidden from the history", "success");
      router.refresh();
    } catch {
      showToast("Could not change the notes — check the connection and try again", "error");
    } finally {
      setTogglingNotes(null);
    }
  };

  const phoneById = useMemo(() => new Map(customers.map((c) => [c.id, c.phone])), [customers]);

  const filteredCustomers = customerSearch
    ? customers.filter((c) => c.name.toLowerCase().includes(customerSearch.toLowerCase()) || c.phone.includes(customerSearch)).slice(0, 5)
    : [];

  // Find a customer's prescription by name (or phone), newest first.
  const shown = useMemo(() => {
    const q = listSearch.trim().toLowerCase();
    if (!q) return prescriptions;
    const digits = q.replace(/[^0-9]/g, "");
    return prescriptions.filter((rx) =>
      rx.customerName.toLowerCase().includes(q) ||
      (digits.length >= 3 && (phoneById.get(rx.customerId) ?? "").replace(/[^0-9]/g, "").includes(digits))
    );
  }, [prescriptions, listSearch, phoneById]);

  const num = (v: string) => (v === "" ? 0 : Number(v));
  const values = () => ({
    rightSph: num(form.rightSph), rightCyl: num(form.rightCyl), rightAxis: num(form.rightAxis), rightPd: num(form.rightPd), rightAdd: num(form.rightAdd),
    leftSph: num(form.leftSph), leftCyl: num(form.leftCyl), leftAxis: num(form.leftAxis), leftPd: num(form.leftPd), leftAdd: num(form.leftAdd),
    notes: form.notes,
    isOwnPrescription: isOwn,
  });

  const resetForm = () => {
    setForm({ ...empty });
    setIsOwn(false);
    setSelectedCustomer("");
    setCustomerSearch("");
    setEditing(null);
  };

  const startEdit = (rx: PrescriptionView) => {
    setEditing(rx);
    setSelectedCustomer(rx.customerId);
    setCustomerSearch(rx.customerName);
    setIsOwn(rx.isOwnPrescription);
    setForm({
      rightSph: show(rx.rightEye.sph), rightCyl: show(rx.rightEye.cyl), rightAxis: show(rx.rightEye.axis),
      rightPd: show(rx.rightEye.pd), rightAdd: show(rx.rightEye.add),
      leftSph: show(rx.leftEye.sph), leftCyl: show(rx.leftEye.cyl), leftAxis: show(rx.leftEye.axis),
      leftPd: show(rx.leftEye.pd), leftAdd: show(rx.leftEye.add),
      notes: rx.notes,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSave = async () => {
    if (!selectedCustomer) {
      showToast("Select a customer first", "error");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        const res = await updatePrescription(editing.id, values());
        if (!res.ok) {
          showToast(res.error, "error");
          return;
        }
        showToast(`${editing.customerName}'s prescription updated`, "success");
      } else {
        await createPrescription({ customerId: selectedCustomer, ...values() });
        showToast("Prescription saved", "success");
      }
      resetForm();
      router.refresh();
    } catch {
      showToast("Could not save prescription", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setRemoving(true);
    try {
      const res = await deletePrescription(deleting.id);
      if (!res.ok) {
        showToast(res.error, "error");
        return;
      }
      if (editing?.id === deleting.id) resetForm();
      showToast("Prescription moved to Trash", "success");
      setDeleting(null);
      router.refresh();
    } catch {
      showToast("Could not delete the prescription — check the connection and try again", "error");
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Prescriptions</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage eye prescriptions for customers</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={`glass-card p-5 ${editing ? "ring-2 ring-primary/40" : ""}`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              {editing ? <Pencil className="w-4 h-4 text-primary" /> : <Eye className="w-4 h-4 text-primary" />}
              {editing ? `Editing ${editing.customerName}'s prescription (${formatDate(editing.date)})` : "New Prescription"}
            </h3>
            {editing && (
              <button onClick={resetForm} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer">
                <X className="w-3.5 h-3.5" /> Cancel
              </button>
            )}
          </div>

          <div className="mb-4">
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Customer</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input type="text" placeholder="Search customer..." value={customerSearch} disabled={!!editing}
                onChange={(e) => { setCustomerSearch(e.target.value); setSelectedCustomer(""); }}
                className="w-full pl-9 pr-4 py-2 glass-input text-sm disabled:opacity-70" />
            </div>
            {filteredCustomers.length > 0 && !selectedCustomer && (
              <div className="mt-1 glass rounded-xl p-1.5 max-h-32 overflow-y-auto">
                {filteredCustomers.map((c) => (
                  <button key={c.id} onClick={() => { setSelectedCustomer(c.id); setCustomerSearch(c.name); }}
                    className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-surface-hover text-xs">{c.name} · {c.phone}</button>
                ))}
              </div>
            )}
          </div>

          {(["Right Eye (OD)", "Left Eye (OS)"] as const).map((eye) => {
            const prefix = eye.includes("Right") ? "right" : "left";
            return (
              <div key={eye} className="mb-4">
                <p className="text-xs font-medium text-muted-foreground mb-2">{eye}</p>
                <div className="grid grid-cols-5 gap-2">
                  {(["Sph", "Cyl", "Axis", "Pd", "Add"] as const).map((field) => (
                    <div key={field}>
                      <label className="text-[10px] text-muted-foreground block text-center mb-1">{field.toUpperCase()}</label>
                      <input type="number" step="0.25" placeholder="0.00"
                        value={form[`${prefix}${field}` as keyof typeof form]}
                        onChange={(e) => setForm((p) => ({ ...p, [`${prefix}${field}`]: e.target.value }))}
                        className="w-full px-2 py-2 glass-input text-xs text-center" />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          <div className="mb-4">
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              rows={2} className="w-full px-4 py-2 glass-input text-sm resize-none" placeholder="Any additional notes..." />
          </div>

          <label className="flex items-center gap-2 text-xs font-medium mb-4 cursor-pointer">
            <input type="checkbox" checked={isOwn} onChange={(e) => setIsOwn(e.target.checked)} className="rounded" />
            Own Prescription — customer brought this from outside
          </label>

          <button onClick={handleSave} disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-60">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {editing ? "Save Changes" : "Save Prescription"}
          </button>
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h3 className="text-sm font-semibold">Prescriptions</h3>
            <span className="text-[11px] text-muted-foreground">
              {listSearch ? `${shown.length} of ${prescriptions.length}` : prescriptions.length}
            </span>
          </div>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input type="text" value={listSearch} onChange={(e) => setListSearch(e.target.value)}
              placeholder="Find by customer name or phone..." className="w-full pl-9 pr-9 py-2 glass-input text-sm" />
            {listSearch && (
              <button onClick={() => setListSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer">
                <X className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            )}
          </div>
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {shown.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                {prescriptions.length === 0 ? "No prescriptions recorded yet" : `No prescription found for “${listSearch}”`}
              </p>
            )}
            {shown.map((rx) => (
              <div key={rx.id} className={`p-3 bg-surface rounded-xl ${editing?.id === rx.id ? "ring-2 ring-primary/40" : ""}`}>
                <div className="flex items-center justify-between mb-2 gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{rx.customerName}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatDate(rx.date)}{phoneById.get(rx.customerId) ? ` · ${phoneById.get(rx.customerId)}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {rx.isOwnPrescription && <span className="chip bg-warning/10 text-warning">Own Rx</span>}
                    <button onClick={() => startEdit(rx)} title="Edit prescription" className="p-1.5 rounded-lg hover:bg-surface-hover cursor-pointer">
                      <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                    {canDelete && (
                      <button onClick={() => setDeleting(rx)} title="Delete prescription" className="p-1.5 rounded-lg hover:bg-surface-hover cursor-pointer">
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </button>
                    )}
                  </div>
                </div>
                <table className="w-full text-[10px] text-center">
                  <thead>
                    <tr className="text-muted-foreground">
                      <th className="text-left font-medium py-0.5"></th>
                      <th className="font-medium">SPH</th><th className="font-medium">CYL</th><th className="font-medium">AXIS</th>
                      <th className="font-medium">PD</th><th className="font-medium">ADD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {([["OD (R)", rx.rightEye], ["OS (L)", rx.leftEye]] as const).map(([label, eye]) => (
                      <tr key={label}>
                        <td className="text-left font-medium text-muted-foreground py-0.5">{label}</td>
                        <td>{eye.sph}</td><td>{eye.cyl}</td><td>{eye.axis}</td><td>{eye.pd}</td><td>{eye.add}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rx.notes && (
                  <div className="flex items-start gap-2 mt-2 pt-1 border-t border-border">
                    <p className={`text-[10px] flex-1 min-w-0 ${rx.notesHidden ? "italic text-muted-foreground/70" : "text-muted-foreground"}`}>
                      {rx.notesHidden ? "Notes hidden" : rx.notes}
                    </p>
                    <button
                      onClick={() => toggleNotes(rx)}
                      disabled={togglingNotes !== null}
                      title={rx.notesHidden ? "Show these notes" : "Hide these notes"}
                      className="p-1 rounded-md hover:bg-surface-hover cursor-pointer flex-shrink-0 disabled:opacity-50"
                    >
                      {togglingNotes === rx.id
                        ? <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                        : rx.notesHidden
                          ? <EyeOff className="w-3 h-3 text-muted-foreground" />
                          : <Eye className="w-3 h-3 text-muted-foreground" />}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {deleting && (
        <ConfirmDialog
          title={`Delete ${deleting.customerName}'s prescription?`}
          message={`From ${formatDate(deleting.date)}. It moves to the Trash and can be restored for 30 days.`}
          busy={removing}
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}

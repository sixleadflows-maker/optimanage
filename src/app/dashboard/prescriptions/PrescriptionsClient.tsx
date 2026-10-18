"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { PrescriptionView } from "@/lib/data";
import { formatDate } from "@/lib/utils/format";
import { useApp } from "@/lib/context";
import { createPrescription, createPrescriptions, deletePrescription, updatePrescription, setPrescriptionNotesHidden } from "@/lib/actions/prescriptions";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { RxTable } from "@/components/ui/RxTable";
import { RxEntryTable } from "@/components/ui/RxEntryTable";
import { formatEyeValue, parseRxText, rxFieldText, rxFormTexts } from "@/lib/utils/rx";
import { Eye, Save, Search, Loader2, Pencil, Trash2, X, EyeOff, UserPlus, Plus } from "lucide-react";
import { CustomerFormModal, type SavedCustomer } from "@/app/dashboard/customers/CustomerFormModal";
import { matchesSearch } from "@/lib/utils/search";

interface RxCustomer { id: string; name: string; phone: string; phone2?: string; serialNumber: string; }

const empty = {
  rightSph: "", rightCyl: "", rightAxis: "", rightPd: "", rightAdd: "",
  leftSph: "", leftCyl: "", leftAxis: "", leftPd: "", leftAdd: "",
  label: "",
  notes: "",
};

// One prescription being typed in. Several can be saved for a customer at
// once: distance and reading, or each person in a family.
type Draft = typeof empty & { key: string; isOwn: boolean };
let draftSeq = 0;
const newDraft = (from: Partial<Draft> = {}): Draft => ({ ...empty, isOwn: false, ...from, key: `rx-${++draftSeq}` });
const isBlank = (d: Draft) =>
  !d.label.trim() && !d.notes.trim() && (Object.keys(empty) as (keyof typeof empty)[]).every((k) => !d[k].trim());
// The shop's calendar day, for the date box.
const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** The form filled from a saved prescription, ready to correct. */
const formFromRx = (rx: PrescriptionView) => ({
  rightSph: rxFieldText("Sph", rx.rightEye.sph, rx.rightEye.sphText), rightCyl: rxFieldText("Cyl", rx.rightEye.cyl, rx.rightEye.cylText),
  rightAxis: rxFieldText("Axis", rx.rightEye.axis), rightPd: rxFieldText("Pd", rx.rightEye.pd),
  rightAdd: rxFieldText("Add", rx.rightEye.add, rx.rightEye.addText),
  leftSph: rxFieldText("Sph", rx.leftEye.sph, rx.leftEye.sphText), leftCyl: rxFieldText("Cyl", rx.leftEye.cyl, rx.leftEye.cylText),
  leftAxis: rxFieldText("Axis", rx.leftEye.axis), leftPd: rxFieldText("Pd", rx.leftEye.pd),
  leftAdd: rxFieldText("Add", rx.leftEye.add, rx.leftEye.addText),
  label: rx.label,
  notes: rx.notes,
});

export function PrescriptionsClient({
  prescriptions,
  customers,
  canDelete,
  initialEditId,
  initialCustomerId,
  addToSale,
}: {
  prescriptions: PrescriptionView[];
  customers: RxCustomer[];
  canDelete: boolean;
  // Opened from a customer's history to correct this one.
  initialEditId?: string;
  // Opened from a customer's page to add prescriptions for them.
  initialCustomerId?: string;
  // Opened from an invoice to put a prescription on it after the event.
  addToSale?: { id: string; invoiceNo: string; customerId: string; customerName: string } | null;
}) {
  const { showToast } = useApp();
  const router = useRouter();
  const initialEdit = initialEditId ? prescriptions.find((p) => p.id === initialEditId) ?? null : null;
  const initialCustomer = !initialEdit && !addToSale && initialCustomerId ? customers.find((c) => c.id === initialCustomerId) ?? null : null;
  const [selectedCustomer, setSelectedCustomer] = useState(initialEdit?.customerId ?? addToSale?.customerId ?? initialCustomer?.id ?? "");
  const [customerSearch, setCustomerSearch] = useState(initialEdit?.customerName ?? addToSale?.customerName ?? initialCustomer?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>(() => [
    initialEdit ? newDraft({ ...formFromRx(initialEdit), isOwn: initialEdit.isOwnPrescription }) : newDraft(),
  ]);
  const [testDay, setTestDay] = useState(todayLocal);
  const editDraft = (key: string, patch: Partial<Draft>) => setDrafts((list) => list.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  // Set while the form is correcting an existing prescription.
  const [editing, setEditing] = useState<PrescriptionView | null>(initialEdit);
  const [deleting, setDeleting] = useState<PrescriptionView | null>(null);
  const [removing, setRemoving] = useState(false);
  const [listSearch, setListSearch] = useState("");
  const [togglingNotes, setTogglingNotes] = useState<string | null>(null);
  // A customer added from this form, before the page's own list has caught up.
  const [newCustomerOpen, setNewCustomerOpen] = useState(false);
  const [addedCustomers, setAddedCustomers] = useState<RxCustomer[]>([]);

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

  const allCustomers = useMemo(
    () => [...customers, ...addedCustomers.filter((a) => !customers.some((c) => c.id === a.id))],
    [customers, addedCustomers],
  );
  const customerById = useMemo(() => new Map(allCustomers.map((c) => [c.id, c])), [allCustomers]);

  const filteredCustomers = customerSearch.trim()
    ? allCustomers.filter((c) => matchesSearch(customerSearch, [c.name, c.phone, c.phone2, c.serialNumber])).slice(0, 5)
    : [];

  // Find a customer's prescription by name, serial number or phone, newest first.
  const shown = useMemo(() => {
    if (!listSearch.trim()) return prescriptions;
    return prescriptions.filter((rx) => {
      const c = customerById.get(rx.customerId);
      return matchesSearch(listSearch, [rx.customerName, c?.serialNumber, c?.phone, c?.phone2, rx.label]);
    });
  }, [prescriptions, listSearch, customerById]);

  const num = parseRxText;
  const values = (d: Draft) => ({
    rightSph: num(d.rightSph), rightCyl: num(d.rightCyl), rightAxis: num(d.rightAxis), rightPd: num(d.rightPd), rightAdd: num(d.rightAdd),
    leftSph: num(d.leftSph), leftCyl: num(d.leftCyl), leftAxis: num(d.leftAxis), leftPd: num(d.leftPd), leftAdd: num(d.leftAdd),
    ...rxFormTexts(d),
    label: d.label.trim(),
    notes: d.notes,
    isOwnPrescription: d.isOwn,
  });

  const resetForm = () => {
    setDrafts([newDraft()]);
    setTestDay(todayLocal());
    setSelectedCustomer("");
    setCustomerSearch("");
    setEditing(null);
    // Opened from elsewhere: drop the link's ?edit= / ?addTo= / ?customer= so a reload is a clean form.
    if (initialEditId || addToSale || initialCustomerId) router.replace("/dashboard/prescriptions", { scroll: false });
  };

  // A customer who isn't on file yet is added right here and picked for this prescription.
  const customerAdded = (c: SavedCustomer) => {
    if (!c.existing) {
      setAddedCustomers((prev) => [...prev, { id: c.id, name: c.name, phone: c.phone, serialNumber: c.serialNumber }]);
    }
    setSelectedCustomer(c.id);
    setCustomerSearch(c.name);
  };

  // What was typed into the search box is usually the new customer's name or number.
  const newCustomerStart = (() => {
    const typed = customerSearch.trim();
    const looksLikePhone = /^[+\d][\d\s-]{5,}$/.test(typed);
    return { name: looksLikePhone ? "" : typed, phone: looksLikePhone ? typed : "" };
  })();

  // Their earlier readings, to start a new one from ("same as last time, but...").
  const customerReadings = !editing && selectedCustomer ? prescriptions.filter((p) => p.customerId === selectedCustomer) : [];
  const readingSummary = (rx: PrescriptionView) => {
    const eye = (e: PrescriptionView["rightEye"]) =>
      [formatEyeValue("Sph", e), e.cyl || e.cylText ? `/ ${formatEyeValue("Cyl", e)}` : "", e.axis ? `× ${e.axis}` : ""].filter(Boolean).join(" ");
    return `R ${eye(rx.rightEye)}  ·  L ${eye(rx.leftEye)}`;
  };
  // Fills the last prescription being typed if it's still empty, otherwise
  // starts another one from it.
  const copyReading = (rx: PrescriptionView) => {
    const filled = { ...formFromRx(rx), notes: rx.notesHidden ? "" : rx.notes, isOwn: rx.isOwnPrescription };
    setDrafts((list) => {
      const last = list[list.length - 1];
      return isBlank(last) ? [...list.slice(0, -1), { ...last, ...filled }] : [...list, newDraft(filled)];
    });
    showToast(`Filled in from the reading of ${formatDate(rx.date)} — change what's different, then save`, "info");
  };

  const startEdit = (rx: PrescriptionView) => {
    setEditing(rx);
    setSelectedCustomer(rx.customerId);
    setCustomerSearch(rx.customerName);
    setDrafts([newDraft({ ...formFromRx(rx), isOwn: rx.isOwnPrescription })]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // A prescription from an earlier day is history. Opening it to type in a new
  // eye test saves a new prescription by default, so the old one stays on file
  // with its own date; "Correct this one" is for fixing a typing mistake.
  const editingOlder = !!editing && editing.date < new Date().toISOString().slice(0, 10);

  const handleSave = async (asNew = false) => {
    if (!selectedCustomer) {
      showToast("Select a customer first", "error");
      return;
    }
    // An extra prescription box left empty is dropped rather than saved blank.
    const toSave = drafts.length > 1 ? drafts.filter((d) => !isBlank(d)) : drafts;
    if (toSave.length === 0) {
      showToast("Type in the prescription first", "error");
      return;
    }
    setSaving(true);
    try {
      if (editing && asNew) {
        const res = await createPrescription({ customerId: editing.customerId, ...values(drafts[0]) });
        if (!res.ok) {
          showToast(res.error, "error");
          return;
        }
        showToast(`New prescription saved for ${editing.customerName} — the one from ${formatDate(editing.date)} is kept`, "success");
      } else if (editing) {
        const res = await updatePrescription(editing.id, values(drafts[0]));
        if (!res.ok) {
          showToast(res.error, "error");
          return;
        }
        showToast(`${editing.customerName}'s prescription updated`, "success");
      } else {
        // Added to an invoice that already exists, when that's where this started.
        const res = await createPrescriptions({
          customerId: selectedCustomer, saleId: addToSale?.id, date: testDay, prescriptions: toSave.map(values),
        });
        if (!res.ok) {
          showToast(res.error, "error");
          return;
        }
        const who = customerById.get(selectedCustomer)?.name ?? customerSearch;
        const what = toSave.length > 1 ? `${toSave.length} prescriptions` : "Prescription";
        showToast(
          addToSale
            ? res.attachedCustomer
              ? `${what} added to ${addToSale.invoiceNo} — the invoice is now on ${who}`
              : `${what} added to ${addToSale.invoiceNo}`
            : `${what} saved for ${who}`,
          "success",
        );
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
              {editing
                ? `Editing ${editing.customerName}'s prescription (${formatDate(editing.date)})`
                : addToSale
                  ? `New prescription for ${addToSale.invoiceNo}`
                  : "New Prescription"}
            </h3>
            {(editing || addToSale) && (
              <button onClick={resetForm} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer">
                <X className="w-3.5 h-3.5" /> Cancel
              </button>
            )}
          </div>

          {!editing && addToSale && (
            <div className="mb-4 p-3 rounded-xl border border-primary/30 bg-primary/5 text-xs">
              <p className="font-medium">{`Adding to ${addToSale.invoiceNo}${addToSale.customerName ? ` — ${addToSale.customerName}` : " — walk-in, no customer yet"}`}</p>
              <p className="text-muted-foreground mt-0.5">
                {addToSale.customerName
                  ? "The invoice keeps its own number and totals; this goes onto it and onto the customer's record."
                  : "Pick the customer below, or add them if they aren't on file — the invoice goes onto them and keeps its own number and totals."}
              </p>
            </div>
          )}

          <div className="mb-4">
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Customer</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input type="text" placeholder="Search by name, serial or phone..." value={customerSearch} disabled={!!editing}
                onChange={(e) => { setCustomerSearch(e.target.value); setSelectedCustomer(""); }}
                className="w-full pl-9 pr-4 py-2 glass-input text-sm disabled:opacity-70" />
            </div>
            {filteredCustomers.length > 0 && !selectedCustomer && (
              <div className="mt-1 glass rounded-xl p-1.5 max-h-32 overflow-y-auto">
                {filteredCustomers.map((c) => (
                  <button key={c.id} onClick={() => { setSelectedCustomer(c.id); setCustomerSearch(c.name); }}
                    className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-surface-hover text-xs">
                    {[c.name, c.serialNumber && `Serial ${c.serialNumber}`, c.phone, c.phone2].filter(Boolean).join(" · ")}
                  </button>
                ))}
              </div>
            )}
            {!editing && !selectedCustomer && (
              <button type="button" onClick={() => setNewCustomerOpen(true)}
                className="mt-2 flex items-center gap-1.5 text-xs text-primary font-semibold cursor-pointer">
                <UserPlus className="w-3.5 h-3.5" />
                {customerSearch.trim() && filteredCustomers.length === 0
                  ? `Not on file — add ${customerSearch.trim()} as a new customer`
                  : "Add a new customer"}
              </button>
            )}
          </div>

          {customerReadings.length > 0 && (
            <div className="mb-4">
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Start from an earlier reading</label>
              <div className="rounded-xl border border-border max-h-40 overflow-y-auto divide-y divide-border">
                {customerReadings.map((rx) => (
                  <button key={rx.id} type="button" onClick={() => copyReading(rx)}
                    className="w-full text-left px-3 py-2 hover:bg-surface-hover transition-colors cursor-pointer">
                    <span className="block text-xs font-medium">
                      {formatDate(rx.date)}
                      {rx.label && <span className="font-normal text-muted-foreground">{` · ${rx.label}`}</span>}
                      {rx.isOwnPrescription && <span className="font-normal text-muted-foreground">{" · own prescription"}</span>}
                    </span>
                    <span className="block text-[10px] text-muted-foreground tabular-nums">{readingSummary(rx)}</span>
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">It fills in the boxes below. The earlier reading stays as it was.</p>
            </div>
          )}

          {!editing && (
            <div className="mb-4">
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Date of the eye test</label>
              <input type="date" value={testDay} max={todayLocal()} onChange={(e) => setTestDay(e.target.value || todayLocal())}
                className="w-full sm:w-48 px-3 py-2 glass-input text-sm" />
              {testDay !== todayLocal() && (
                <p className="text-[10px] text-muted-foreground mt-1">{`An older slip: it goes into their history on ${formatDate(testDay)}.`}</p>
              )}
            </div>
          )}

          <div className="space-y-4 mb-4">
            {drafts.map((d, i) => (
              <div key={d.key} className={drafts.length > 1 ? "p-3 rounded-xl border border-border space-y-3" : "space-y-4"}>
                {drafts.length > 1 && (
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold">{`Prescription ${i + 1}${d.label.trim() ? ` — ${d.label.trim()}` : ""}`}</p>
                    <button type="button" onClick={() => setDrafts((list) => list.filter((x) => x.key !== d.key))}
                      title="Remove this prescription" className="p-1 rounded-md hover:bg-surface-hover cursor-pointer">
                      <X className="w-3.5 h-3.5 text-destructive" />
                    </button>
                  </div>
                )}

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Whose eyes / what for</label>
                  <input type="text" value={d.label} onChange={(e) => editDraft(d.key, { label: e.target.value })}
                    className="w-full px-4 py-2 glass-input text-sm"
                    placeholder={drafts.length > 1 ? `e.g. ${i === 0 ? "Distance" : i === 1 ? "Reading" : "a family member's name"}` : "Optional — “distance”, “reading”, or a family member's name"} />
                </div>

                <div className="-mx-1.5">
                  <RxEntryTable values={d} onChange={(key, value) => editDraft(d.key, { [key]: value })} />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Notes</label>
                  <textarea value={d.notes} onChange={(e) => editDraft(d.key, { notes: e.target.value })}
                    rows={2} className="w-full px-4 py-2 glass-input text-sm resize-none" placeholder="Any additional notes..." />
                </div>

                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <input type="checkbox" checked={d.isOwn} onChange={(e) => editDraft(d.key, { isOwn: e.target.checked })} className="rounded" />
                  Own Prescription — customer brought this from outside
                </label>
              </div>
            ))}
          </div>

          <p className="text-[11px] text-muted-foreground -mt-2 mb-4">
            SPH, CYL and ADD take letters as well as digits: type them after the number (2.50 DS), or tap the ± button
            in the box and pick ABC for words like Plano.
          </p>

          {!editing && (
            <button type="button" onClick={() => setDrafts((list) => [...list, newDraft()])}
              className="w-full mb-4 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/15 transition-colors cursor-pointer">
              <Plus className="w-3.5 h-3.5" />
              {`Add another prescription${selectedCustomer ? ` for ${customerById.get(selectedCustomer)?.name || customerSearch}` : ""}`}
            </button>
          )}

          {editingOlder ? (
            <div className="space-y-2">
              <button onClick={() => handleSave(true)} disabled={saving}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-60">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save as a new prescription
              </button>
              <p className="text-[11px] text-muted-foreground text-center">
                {`The one from ${formatDate(editing!.date)} stays on their record with its date.`}
              </p>
              <button onClick={() => handleSave(false)} disabled={saving}
                className="w-full py-2 rounded-xl text-xs font-medium bg-surface hover:bg-surface-hover transition-colors disabled:opacity-60 cursor-pointer">
                {`Correct the one from ${formatDate(editing!.date)} instead (a typing mistake)`}
              </button>
            </div>
          ) : (
            <button onClick={() => handleSave()} disabled={saving}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-60">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {editing ? "Save Changes" : drafts.length > 1 ? `Save ${drafts.length} prescriptions` : "Save Prescription"}
            </button>
          )}
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
              placeholder="Find by customer name, serial or phone..." className="w-full pl-9 pr-9 py-2 glass-input text-sm" />
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
                    <p className="text-sm font-medium truncate">
                      {rx.customerName}
                      {rx.label && <span className="text-primary font-normal text-xs ml-1">({rx.label})</span>}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {[
                        formatDate(rx.date),
                        customerById.get(rx.customerId)?.serialNumber && `Serial ${customerById.get(rx.customerId)!.serialNumber}`,
                        customerById.get(rx.customerId)?.phone,
                      ].filter(Boolean).join(" · ")}
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
                <RxTable right={rx.rightEye} left={rx.leftEye} />
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

      {newCustomerOpen && (
        <CustomerFormModal initial={newCustomerStart} others={allCustomers} onClose={() => setNewCustomerOpen(false)} onSaved={customerAdded} />
      )}

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

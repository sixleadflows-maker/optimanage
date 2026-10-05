"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { X, Loader2, Users } from "lucide-react";
import { useApp } from "@/lib/context";
import { createCustomer, updateCustomer } from "@/lib/actions/customers";
import { shareNumber } from "@/lib/utils/phone";

/** Everything the form shows about a customer already on file. */
export interface CustomerFormData {
  id: string;
  name: string;
  phone: string;
  // A second number; left out or "" when there isn't one.
  phone2?: string;
  serialNumber: string;
  email: string;
  address: string;
  lastVisit: string;
}

/**
 * What the form hands back once a customer is saved. `existing` is set when
 * staff picked someone already on the phone number instead of adding a new
 * record: only their id, name, phone and serial are known then, so the caller
 * should use the record it already has.
 */
export type SavedCustomer = CustomerFormData & { existing?: boolean };

/** Enough about a customer on file to show who else is on a phone number. */
export interface CustomerOnFile { id: string; name: string; phone: string; phone2?: string; serialNumber: string }

/** Adding a customer, or correcting the details of one already on file. */
export function CustomerFormModal({
  customer,
  initial,
  others = [],
  onClose,
  onSaved,
}: {
  customer?: CustomerFormData | null;
  // Where a new customer's form starts from -- what was typed into a search box.
  initial?: { name?: string; phone?: string; phone2?: string };
  // The customers on file, to show who already uses the number being typed.
  others?: CustomerOnFile[];
  onClose: () => void;
  // Lets a screen pick the customer up straight away instead of searching again.
  onSaved?: (saved: SavedCustomer) => void;
}) {
  const { showToast } = useApp();
  const router = useRouter();
  const [form, setForm] = useState({
    name: customer?.name ?? initial?.name ?? "",
    phone: customer?.phone ?? initial?.phone ?? "",
    phone2: customer?.phone2 ?? initial?.phone2 ?? "",
    serialNumber: customer?.serialNumber ?? "",
    email: customer?.email ?? "",
    address: customer?.address ?? "",
    lastVisit: customer?.lastVisit ?? "",
  });
  const [saving, setSaving] = useState(false);

  // One number can carry several customers (a family, or a record per order),
  // so this never blocks saving -- it only shows who's already there.
  const onNumber = others.filter((o) => o.id !== customer?.id && shareNumber(o, form));

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      // Only one number typed, and it went in the second box: it's their number.
      const typed = [form.phone.trim(), form.phone2.trim()].filter(Boolean);
      const trimmed = {
        name: form.name.trim(),
        phone: typed[0] ?? "",
        phone2: typed[1] ?? "",
        serialNumber: form.serialNumber.trim(),
        email: form.email.trim(),
        address: form.address.trim(),
        lastVisit: form.lastVisit,
      };
      if (customer) {
        const res = await updateCustomer(customer.id, { ...form, phone: trimmed.phone, phone2: trimmed.phone2 });
        if (!res.ok) { showToast(res.error, "error"); return; }
        showToast(`${trimmed.name || "Customer"}'s details saved`, "success");
        onSaved?.({ id: customer.id, ...trimmed });
      } else {
        const res = await createCustomer({ ...form, phone: trimmed.phone, phone2: trimmed.phone2 });
        if (!res.ok) { showToast(res.error, "error"); return; }
        showToast(
          onNumber.length ? `Customer added — ${onNumber.length + 1} customers now share this number` : "Customer added",
          "success",
        );
        onSaved?.({ id: res.id, ...trimmed });
      }
      onClose();
      router.refresh();
    } catch {
      showToast("Couldn't save — check the connection and try again", "error");
    } finally {
      setSaving(false);
    }
  };

  const pickExisting = (o: CustomerOnFile) => {
    showToast(`${o.name || "Customer"} selected`, "info");
    onSaved?.({ id: o.id, name: o.name, phone: o.phone, phone2: o.phone2 ?? "", serialNumber: o.serialNumber, email: "", address: "", lastVisit: "", existing: true });
    onClose();
  };

  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value }),
    className: "w-full px-4 py-2.5 glass-input text-sm",
  });

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="glass-modal p-6 w-full max-w-md animate-rise max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{customer ? `Edit ${customer.name || "customer"}` : "Add Customer"}</h3>
          <button onClick={onClose} className="cursor-pointer"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Name</label>
            <input type="text" autoFocus placeholder="Can add later" {...field("name")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Main number</label>
              <input type="text" placeholder="+92 3XX XXXXXXX" {...field("phone")} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Second number (optional)</label>
              <input type="text" placeholder="Leave empty if none" {...field("phone2")} />
            </div>
          </div>
          {onNumber.length > 0 && (
            <div className="rounded-xl border border-primary/30 bg-surface p-3 text-xs space-y-2">
              <p className="font-semibold flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-primary" />
                {`Already on this number: ${onNumber.length} customer${onNumber.length === 1 ? "" : "s"}`}
              </p>
              <div className="space-y-1">
                {onNumber.slice(0, 5).map((o) => (
                  <div key={o.id} className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate">
                      <span className="font-medium">{o.name || "No name yet"}</span>
                      {o.serialNumber && <span className="text-muted-foreground">{` · Serial ${o.serialNumber}`}</span>}
                    </span>
                    {onSaved && !customer ? (
                      <button onClick={() => pickExisting(o)}
                        className="px-2 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/15 font-medium flex-shrink-0 cursor-pointer">
                        Use this one
                      </button>
                    ) : (
                      <Link href={`/dashboard/customers/${o.id}`} onClick={onClose}
                        className="px-2 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/15 font-medium flex-shrink-0">
                        Open
                      </Link>
                    )}
                  </div>
                ))}
                {onNumber.length > 5 && <p className="text-muted-foreground">{`…and ${onNumber.length - 5} more`}</p>}
              </div>
              <p className="text-muted-foreground">
                {customer
                  ? "That's fine — several customers can share one number."
                  : "Saving adds a separate customer on the same number, with their own orders. Searching the number shows all of them."}
              </p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Serial Number</label>
              <input type="text" placeholder="e.g. SN-0142" {...field("serialNumber")} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Last Visit Date</label>
              <input type="date" {...field("lastVisit")} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Email</label>
              <input type="email" {...field("email")} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Address</label>
              <input type="text" {...field("address")} />
            </div>
          </div>
          {customer && (
            <p className="text-[11px] text-muted-foreground">
              Their invoices, prescriptions and lab orders show the new details straight away. Spend and visits keep
              following their invoices.
            </p>
          )}
          <button onClick={save} disabled={saving}
            className="w-full py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-hover transition-colors disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {customer ? "Save Changes" : onNumber.length ? "Save as a new customer on this number" : "Save Customer"}
          </button>
        </div>
      </div>
    </div>
  );
}

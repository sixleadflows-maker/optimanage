"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Loader2 } from "lucide-react";
import { useApp } from "@/lib/context";
import { createCustomer, updateCustomer } from "@/lib/actions/customers";

/** Everything the form shows about a customer already on file. */
export interface CustomerFormData {
  id: string;
  name: string;
  phone: string;
  serialNumber: string;
  email: string;
  address: string;
  lastVisit: string;
}

/**
 * What the form hands back once a customer is saved. `existing` is set when the
 * phone number already belonged to someone: only their id, name and phone are
 * known then, so the caller should use the record it already has.
 */
export type SavedCustomer = CustomerFormData & { existing?: boolean };

/** Adding a customer, or correcting the details of one already on file. */
export function CustomerFormModal({
  customer,
  initial,
  onClose,
  onSaved,
}: {
  customer?: CustomerFormData | null;
  // Where a new customer's form starts from -- what was typed into a search box.
  initial?: { name?: string; phone?: string };
  onClose: () => void;
  // Lets a screen pick the customer up straight away instead of searching again.
  onSaved?: (saved: SavedCustomer) => void;
}) {
  const { showToast } = useApp();
  const router = useRouter();
  const [form, setForm] = useState({
    name: customer?.name ?? initial?.name ?? "",
    phone: customer?.phone ?? initial?.phone ?? "",
    serialNumber: customer?.serialNumber ?? "",
    email: customer?.email ?? "",
    address: customer?.address ?? "",
    lastVisit: customer?.lastVisit ?? "",
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const trimmed = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        serialNumber: form.serialNumber.trim(),
        email: form.email.trim(),
        address: form.address.trim(),
        lastVisit: form.lastVisit,
      };
      if (customer) {
        const res = await updateCustomer(customer.id, form);
        if (!res.ok) { showToast(res.error, "error"); return; }
        showToast(`${trimmed.name}'s details saved`, "success");
        onSaved?.({ id: customer.id, ...trimmed });
      } else {
        const res = await createCustomer(form);
        if (!res.ok) {
          // Already on file under that number: with somewhere to put them, just use them.
          if (res.existing && onSaved) {
            showToast(`${res.existing.name} is already registered with that number — using them`, "info");
            onSaved({ id: res.existing.id, name: res.existing.name, phone: res.existing.phone, serialNumber: "", email: "", address: "", lastVisit: "", existing: true });
            onClose();
            router.refresh();
            return;
          }
          showToast(res.error, "error");
          return;
        }
        showToast("Customer added", "success");
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

  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value }),
    className: "w-full px-4 py-2.5 glass-input text-sm",
  });

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="glass-modal p-6 w-full max-w-md animate-rise" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{customer ? `Edit ${customer.name}` : "Add Customer"}</h3>
          <button onClick={onClose} className="cursor-pointer"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Name</label>
            <input type="text" autoFocus placeholder="Can add later" {...field("name")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Phone</label>
              <input type="text" placeholder="+92 3XX XXXXXXX" {...field("phone")} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Serial Number</label>
              <input type="text" placeholder="e.g. SN-0142" {...field("serialNumber")} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Email</label>
              <input type="email" {...field("email")} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Last Visit Date</label>
              <input type="date" {...field("lastVisit")} />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Address</label>
            <input type="text" {...field("address")} />
          </div>
          {customer && (
            <p className="text-[11px] text-muted-foreground">
              Their invoices, prescriptions and lab orders show the new details straight away. Spend and visits keep
              following their invoices.
            </p>
          )}
          <button onClick={save} disabled={saving}
            className="w-full py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-hover transition-colors disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} {customer ? "Save Changes" : "Save Customer"}
          </button>
        </div>
      </div>
    </div>
  );
}

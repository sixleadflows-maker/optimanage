"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { CustomerView } from "@/lib/data";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { useApp } from "@/lib/context";
import { createCustomer, deleteCustomer } from "@/lib/actions/customers";
import { Search, Users, Plus, X, Loader2, Trash2 } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";

export function CustomersClient({ customers, canDelete }: { customers: CustomerView[]; canDelete: boolean }) {
  const router = useRouter();
  const { showToast } = useApp();
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", serialNumber: "", email: "", address: "", lastVisit: "" });

  const [deletingCustomer, setDeletingCustomer] = useState<CustomerView | null>(null);
  const [deleting, setDeleting] = useState(false);

  const confirmDelete = async () => {
    if (!deletingCustomer) return;
    setDeleting(true);
    try {
      const res = await deleteCustomer(deletingCustomer.id);
      if (!res.ok) {
        showToast(res.error, "error");
        return;
      }
      showToast(`${deletingCustomer.name} moved to Trash — restore within 30 days`, "success");
      setDeletingCustomer(null);
      router.refresh();
    } catch {
      showToast("Could not delete the customer — check the connection and try again", "error");
    } finally {
      setDeleting(false);
    }
  };

  const filtered = useMemo(() => {
    if (!search) return customers;
    const q = search.toLowerCase();
    return customers.filter(
      (c) => c.name.toLowerCase().includes(q) || c.phone.includes(q) || c.email.toLowerCase().includes(q) || c.serialNumber.toLowerCase().includes(q)
    );
  }, [customers, search]);

  const handleAdd = async () => {
    if (!form.name.trim()) {
      showToast("Customer name is required", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await createCustomer(form);
      if (!res.ok) {
        showToast(res.error || "Could not add customer", "error");
        return;
      }
      showToast("Customer added", "success");
      setShowAdd(false);
      setForm({ name: "", phone: "", serialNumber: "", email: "", address: "", lastVisit: "" });
      router.refresh();
    } catch {
      showToast("Something went wrong", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Customers</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{customers.length} customers registered</p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-hover transition-colors">
          <Plus className="w-4 h-4" /> Add Customer
        </button>
      </div>

      <div className="glass-card p-4">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" placeholder="Search by serial, name, phone or email..." value={search}
            onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2 glass-input text-sm" />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Customer</th>
                <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Serial #</th>
                <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Phone</th>
                <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Email</th>
                <th className="text-center py-3 px-3 text-xs font-medium text-muted-foreground">Visits</th>
                <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Last Visit</th>
                <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">Total Spend</th>
                <th className="text-center py-3 px-3 text-xs font-medium text-muted-foreground">Rx</th>
                {canDelete && <th className="py-3 px-3" />}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={canDelete ? 9 : 8}>
                  <EmptyState icon={Users} title="No customers found" hint="Try a different name or phone number, or add the customer to start their history." />
                </td></tr>
              )}
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-border hover:bg-surface-hover/50 transition-colors">
                  <td className="py-3 px-3">
                    <Link href={`/dashboard/customers/${c.id}`} className="flex items-center gap-3 hover:text-primary">
                      <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold flex-shrink-0">
                        {c.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                      </div>
                      <span className="font-medium">{c.name}</span>
                    </Link>
                  </td>
                  <td className="py-3 px-3 text-muted-foreground text-xs font-mono">{c.serialNumber || "—"}</td>
                  <td className="py-3 px-3 text-muted-foreground">{c.phone || "—"}</td>
                  <td className="py-3 px-3 text-muted-foreground text-xs">{c.email}</td>
                  <td className="py-3 px-3 text-center">
                    <span className="chip bg-primary/10 text-primary">{c.visitCount}</span>
                  </td>
                  <td className="py-3 px-3 text-muted-foreground">{c.lastVisit ? formatDate(c.lastVisit) : "—"}</td>
                  <td className="py-3 px-3 text-right font-medium">{formatCurrency(c.totalSpend)}</td>
                  <td className="py-3 px-3 text-center">
                    <span className="chip bg-surface text-muted-foreground">{c.prescriptions.length}</span>
                  </td>
                  {canDelete && (
                    <td className="py-3 px-3 text-right">
                      <button onClick={() => setDeletingCustomer(c)} title="Delete customer"
                        className="p-1.5 rounded-lg hover:bg-destructive/10 cursor-pointer">
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowAdd(false)}>
          <div className="glass-modal p-6 w-full max-w-md animate-rise" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Add Customer</h3>
              <button onClick={() => setShowAdd(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Name *</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-4 py-2.5 glass-input text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Phone</label>
                  <input type="text" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-4 py-2.5 glass-input text-sm" placeholder="+92 3XX XXXXXXX" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Serial Number</label>
                  <input type="text" value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} className="w-full px-4 py-2.5 glass-input text-sm" placeholder="e.g. SN-0142" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Email</label>
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-4 py-2.5 glass-input text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Last Visit Date</label>
                  <input type="date" value={form.lastVisit} onChange={(e) => setForm({ ...form, lastVisit: e.target.value })} className="w-full px-4 py-2.5 glass-input text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Address</label>
                <input type="text" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="w-full px-4 py-2.5 glass-input text-sm" />
              </div>
              <button onClick={handleAdd} disabled={saving}
                className="w-full py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-hover transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />} Save Customer
              </button>
            </div>
          </div>
        </div>
      )}

      {deletingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDeletingCustomer(null)}>
          <div className="glass-modal p-6 w-full max-w-sm animate-rise" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Delete Customer</h3>
              <button onClick={() => setDeletingCustomer(null)} className="cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-muted-foreground">
              Delete <span className="font-semibold text-foreground">{deletingCustomer.name}</span>
              {deletingCustomer.phone ? ` (${deletingCustomer.phone})` : ""}?
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              They move to the Trash and can be restored for 30 days. Their past invoices and prescriptions are kept.
            </p>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setDeletingCustomer(null)} className="flex-1 py-2.5 glass-card text-sm font-medium cursor-pointer">
                Cancel
              </button>
              <button onClick={confirmDelete} disabled={deleting}
                className="flex-1 py-2.5 bg-destructive text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer">
                {deleting && <Loader2 className="w-4 h-4 animate-spin" />} Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { customers } from "@/lib/mock";
import { formatDate } from "@/lib/utils/format";
import { useApp } from "@/lib/context";
import { Eye, Save, Search } from "lucide-react";

export default function PrescriptionsPage() {
  const { showToast } = useApp();
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [form, setForm] = useState({
    rightSph: "", rightCyl: "", rightAxis: "", rightPd: "", rightAdd: "",
    leftSph: "", leftCyl: "", leftAxis: "", leftPd: "", leftAdd: "",
    notes: "",
  });

  const allPrescriptions = customers
    .flatMap((c) => c.prescriptions.map((rx) => ({ ...rx, customerName: c.name, customerId: c.id })))
    .sort((a, b) => b.date.localeCompare(a.date));

  const filteredCustomers = customerSearch
    ? customers.filter((c) => c.name.toLowerCase().includes(customerSearch.toLowerCase()) || c.phone.includes(customerSearch)).slice(0, 5)
    : [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Prescriptions</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage eye prescriptions for customers</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Eye className="w-4 h-4 text-primary" /> New Prescription
          </h3>

          <div className="mb-4">
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Customer</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input type="text" placeholder="Search customer..." value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)} className="w-full pl-9 pr-4 py-2 glass-input text-sm" />
            </div>
            {filteredCustomers.length > 0 && (
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

          <button onClick={() => showToast("Prescription saved successfully (demo)", "success")}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-hover transition-colors">
            <Save className="w-4 h-4" /> Save Prescription
          </button>
        </div>

        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold mb-4">Recent Prescriptions</h3>
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {allPrescriptions.map((rx) => (
              <div key={rx.id} className="p-3 bg-surface rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm font-medium">{rx.customerName}</p>
                    <p className="text-[10px] text-muted-foreground">{formatDate(rx.date)}</p>
                  </div>
                  <span className="chip bg-primary/10 text-primary">Rx</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-[10px]">
                  <div>
                    <p className="font-medium text-muted-foreground mb-1">OD (Right)</p>
                    <p>SPH: {rx.rightEye.sph} | CYL: {rx.rightEye.cyl} | AXIS: {rx.rightEye.axis}</p>
                  </div>
                  <div>
                    <p className="font-medium text-muted-foreground mb-1">OS (Left)</p>
                    <p>SPH: {rx.leftEye.sph} | CYL: {rx.leftEye.cyl} | AXIS: {rx.leftEye.axis}</p>
                  </div>
                </div>
                {rx.notes && <p className="text-[10px] text-muted-foreground mt-2 pt-1 border-t border-border">{rx.notes}</p>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

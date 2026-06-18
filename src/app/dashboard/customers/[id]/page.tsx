"use client";

import { use } from "react";
import { customers, sales } from "@/lib/mock";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { useApp } from "@/lib/context";
import { ArrowLeft, MessageCircle, Bell, Eye, RefreshCw, Phone, Mail, MapPin } from "lucide-react";
import Link from "next/link";

export default function CustomerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { showToast } = useApp();
  const customer = customers.find((c) => c.id === id);

  if (!customer) {
    return <div className="p-8 text-center text-muted-foreground">Customer not found</div>;
  }

  const customerSales = sales.filter((s) => s.customerId === id);
  const initials = customer.name.split(" ").map((n) => n[0]).join("").slice(0, 2);

  const reminders = [
    { label: "Order Ready", icon: Bell, message: `Order ready notification sent to ${customer.name} (demo)` },
    { label: "Eye Test", icon: Eye, message: `Eye test reminder sent to ${customer.name} (demo)` },
    { label: "Change Lens", icon: RefreshCw, message: `Lens change reminder sent to ${customer.name} (demo)` },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/customers" className="p-2 rounded-xl hover:bg-surface-hover transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold">Customer Profile</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-4">
          <div className="glass-card p-5 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xl font-bold mx-auto mb-3">
              {initials}
            </div>
            <h2 className="font-bold text-lg">{customer.name}</h2>
            <div className="space-y-2 mt-4 text-sm text-muted-foreground">
              <p className="flex items-center gap-2 justify-center"><Phone className="w-3.5 h-3.5" /> {customer.phone}</p>
              <p className="flex items-center gap-2 justify-center"><Mail className="w-3.5 h-3.5" /> {customer.email}</p>
              <p className="flex items-center gap-2 justify-center"><MapPin className="w-3.5 h-3.5" /> {customer.address}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-5">
              <div className="p-3 bg-surface rounded-xl">
                <p className="text-lg font-bold">{formatCurrency(customer.totalSpend)}</p>
                <p className="text-[10px] text-muted-foreground">Total Spend</p>
              </div>
              <div className="p-3 bg-surface rounded-xl">
                <p className="text-lg font-bold">{customerSales.length}</p>
                <p className="text-[10px] text-muted-foreground">Purchases</p>
              </div>
            </div>
          </div>

          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold mb-3">Quick Actions</h3>
            <div className="space-y-2">
              {reminders.map((r) => (
                <button key={r.label}
                  onClick={() => showToast(r.message, "success")}
                  className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl bg-surface hover:bg-surface-hover transition-colors text-sm text-left">
                  <r.icon className="w-4 h-4 text-primary flex-shrink-0" />
                  Send {r.label} Reminder
                </button>
              ))}
              <button
                onClick={() => showToast(`WhatsApp message sent to ${customer.name} (demo)`, "success")}
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] transition-colors text-sm">
                <MessageCircle className="w-4 h-4 flex-shrink-0" />
                Send WhatsApp
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold mb-4">Prescription History</h3>
            <div className="space-y-4">
              {customer.prescriptions.map((rx) => (
                <div key={rx.id} className="p-4 bg-surface rounded-xl">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-medium">{formatDate(rx.date)}</p>
                    <span className="chip bg-primary/10 text-primary">Rx</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] font-medium text-muted-foreground mb-2">RIGHT EYE (OD)</p>
                      <div className="grid grid-cols-5 gap-1 text-xs">
                        {(["SPH", "CYL", "AXIS", "PD", "ADD"] as const).map((f) => (
                          <div key={f} className="text-center">
                            <p className="text-[9px] text-muted-foreground">{f}</p>
                            <p className="font-medium">{rx.rightEye[f.toLowerCase() as keyof typeof rx.rightEye]}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-medium text-muted-foreground mb-2">LEFT EYE (OS)</p>
                      <div className="grid grid-cols-5 gap-1 text-xs">
                        {(["SPH", "CYL", "AXIS", "PD", "ADD"] as const).map((f) => (
                          <div key={f} className="text-center">
                            <p className="text-[9px] text-muted-foreground">{f}</p>
                            <p className="font-medium">{rx.leftEye[f.toLowerCase() as keyof typeof rx.leftEye]}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  {rx.notes && <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border">{rx.notes}</p>}
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold mb-4">Purchase History</h3>
            {customerSales.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No purchases yet</p>
            ) : (
              <div className="space-y-3">
                {customerSales.map((sale) => (
                  <div key={sale.id} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                    <div>
                      <p className="text-sm font-medium">{sale.invoiceNo}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(sale.date)} · {sale.items.length} item{sale.items.length > 1 ? "s" : ""}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {sale.items.map((i) => i.productName).join(", ")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{formatCurrency(sale.total)}</p>
                      <span className={`chip chip-${sale.paymentStatus.toLowerCase()}`}>{sale.paymentStatus}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

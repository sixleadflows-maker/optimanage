"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CreditEntryView, CustomerView, SaleView } from "@/lib/data";
import { CustomerCredit } from "./CustomerCredit";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { useApp } from "@/lib/context";
import { deleteCustomer } from "@/lib/actions/customers";
import { setPrescriptionNotesHidden } from "@/lib/actions/prescriptions";
import { paymentStatusChipClass } from "@/lib/constants";
import { formatEyeValue, rxLensLabel } from "@/lib/utils/rx";
import { samePhone } from "@/lib/utils/phone";
import { CollectPaymentModal, EditInvoiceModal, EditPaymentModal, type EditorCustomer, type EditorStaff } from "@/app/dashboard/sales/InvoiceEditor";
import { InvoiceDetails } from "@/components/invoice/InvoiceDetails";
import { CustomerFormModal } from "../CustomerFormModal";
import { ArrowLeft, MessageCircle, Bell, Eye, EyeOff, RefreshCw, Phone, Mail, MapPin, Trash2, Loader2, Pencil, FilePlus, Glasses, ChevronDown, Wallet, Users } from "lucide-react";
import Link from "next/link";

export function CustomerProfileClient({
  customer, sales, creditHistory, canDelete, canEdit, customers, staff,
}: {
  customer: CustomerView;
  sales: SaleView[];
  creditHistory: CreditEntryView[];
  canDelete: boolean;
  canEdit: boolean;
  customers: EditorCustomer[];
  staff: EditorStaff[];
}) {
  const { showToast } = useApp();
  const router = useRouter();
  const initials = customer.name.split(" ").map((n) => n[0]).join("").slice(0, 2);
  const [deleting, setDeleting] = useState(false);
  const [togglingNotes, setTogglingNotes] = useState<string | null>(null);
  const [editingSale, setEditingSale] = useState<SaleView | null>(null);
  const [editingDetails, setEditingDetails] = useState(false);
  const [payingSale, setPayingSale] = useState<SaleView | null>(null);
  const [editingPayment, setEditingPayment] = useState<{ sale: SaleView; payment: SaleView["payments"][number] } | null>(null);
  // Every visit opens with all its details showing; staff can fold any away.
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const allOpen = collapsed.size === 0;
  const toggleSale = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const owed = sales.reduce((sum, s) => sum + s.balance, 0);
  // Other customers on the same contact number (a family, or a record per order).
  const sharingNumber = customers.filter((c) => c.id !== customer.id && samePhone(c.phone, customer.phone));

  // Hiding a note applies everywhere, so the customer's own screen at the
  // counter never shows it until someone chooses to.
  const toggleRxNotes = async (rx: { id: string; notesHidden: boolean }) => {
    setTogglingNotes(rx.id);
    try {
      const res = await setPrescriptionNotesHidden(rx.id, !rx.notesHidden);
      if (!res.ok) { showToast(res.error, "error"); return; }
      showToast(rx.notesHidden ? "Notes shown again" : "Notes hidden from the history", "success");
      router.refresh();
    } catch {
      showToast("Could not change the notes — check the connection and try again", "error");
    } finally {
      setTogglingNotes(null);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete ${customer.name}? They move to the Trash and can be restored for 30 days. Their invoices and prescriptions are kept.`)) return;
    setDeleting(true);
    try {
      const res = await deleteCustomer(customer.id);
      if (!res.ok) {
        showToast(res.error, "error");
        setDeleting(false);
        return;
      }
      showToast(`${customer.name} moved to Trash`, "success");
      router.push("/dashboard/customers");
      router.refresh();
    } catch {
      showToast("Could not delete the customer — check the connection and try again", "error");
      setDeleting(false);
    }
  };

  const openWhatsApp = (text: string) => {
    const phone = customer.phone.replace(/[^0-9]/g, "");
    if (!phone) { showToast("No phone number on file", "error"); return; }
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, "_blank");
  };

  const reminders = [
    { label: "Order Ready", icon: Bell, message: `Hello ${customer.name}, your order is ready for pickup at EyeSpy.` },
    { label: "Eye Test", icon: Eye, message: `Hello ${customer.name}, it's time for your annual eye test. Book an appointment with EyeSpy.` },
    { label: "Change Lens", icon: RefreshCw, message: `Hello ${customer.name}, a reminder to replace your lenses. Visit EyeSpy for a check-up.` },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/customers" className="p-2 rounded-xl hover:bg-surface-hover transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold flex-1">Customer Profile</h1>
        <Link href={`/dashboard/pos?customer=${customer.id}`}
          title={`Open the till with ${customer.name} already on the bill`}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-hover transition-colors">
          <FilePlus className="w-4 h-4" /> New Invoice
        </Link>
        <button onClick={() => setEditingDetails(true)} title="Edit name, phone, serial number, email or address"
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium hover:bg-surface-hover transition-colors cursor-pointer">
          <Pencil className="w-4 h-4" /> Edit
        </button>
        {canDelete && (
          <button onClick={handleDelete} disabled={deleting}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-60 cursor-pointer">
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Delete
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-4">
          <div className="glass-card p-5 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xl font-bold mx-auto mb-3">
              {initials}
            </div>
            <h2 className="font-bold text-lg">{customer.name}</h2>
            <div className="space-y-2 mt-4 text-sm text-muted-foreground">
              <p className="flex items-center gap-2 justify-center"><Phone className="w-3.5 h-3.5" /> {customer.phone || "No phone on file"}</p>
              {customer.email && <p className="flex items-center gap-2 justify-center"><Mail className="w-3.5 h-3.5" /> {customer.email}</p>}
              {customer.address && <p className="flex items-center gap-2 justify-center"><MapPin className="w-3.5 h-3.5" /> {customer.address}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3 mt-5">
              <div className="p-3 bg-surface rounded-xl">
                <p className="text-lg font-bold">{formatCurrency(customer.totalSpend)}</p>
                <p className="text-[10px] text-muted-foreground">Total Spend</p>
              </div>
              <div className="p-3 bg-surface rounded-xl">
                <p className="text-lg font-bold">{customer.visitCount}</p>
                <p className="text-[10px] text-muted-foreground">Visits</p>
              </div>
              {owed > 0 && (
                <div className="col-span-2 p-3 bg-destructive/10 rounded-xl">
                  <p className="text-lg font-bold text-destructive">{formatCurrency(owed)}</p>
                  <p className="text-[10px] text-muted-foreground">Balance still owed — use the wallet button on the invoice to receive it</p>
                </div>
              )}
            </div>
          </div>

          <CustomerCredit
            customerId={customer.id}
            customerLabel={customer.name || customer.phone || "this customer"}
            held={customer.credit}
            history={creditHistory}
            canManage={canEdit}
          />

          {sharingNumber.length > 0 && (
            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold flex items-center gap-1.5"><Users className="w-4 h-4 text-primary" /> Also on this number</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5 mb-3">
                {`${sharingNumber.length} other customer${sharingNumber.length === 1 ? "" : "s"} on ${customer.phone} — each keeps their own orders.`}
              </p>
              <div className="space-y-1.5">
                {sharingNumber.map((o) => (
                  <Link key={o.id} href={`/dashboard/customers/${o.id}`}
                    className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-surface hover:bg-surface-hover transition-colors text-sm">
                    <span className="min-w-0 truncate font-medium">{o.name || "No name yet"}</span>
                    <span className="text-[11px] text-muted-foreground flex-shrink-0">
                      {[o.serialNumber && `Serial ${o.serialNumber}`, o.lastVisit && formatDate(o.lastVisit)].filter(Boolean).join(" · ")}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold mb-3">Quick Actions</h3>
            <div className="space-y-2">
              {reminders.map((r) => (
                <button key={r.label}
                  onClick={() => openWhatsApp(r.message)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl bg-surface hover:bg-surface-hover transition-colors text-sm text-left">
                  <r.icon className="w-4 h-4 text-primary flex-shrink-0" />
                  Send {r.label} Reminder
                </button>
              ))}
              <button
                onClick={() => openWhatsApp(`Hello ${customer.name}, thank you for choosing EyeSpy!`)}
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
            {customer.prescriptions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No prescriptions on file</p>
            ) : (
              <div className="space-y-4">
                {customer.prescriptions.map((rx) => (
                  <div key={rx.id} className="p-4 bg-surface rounded-xl">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-medium">{formatDate(rx.date)}</p>
                      <div className="flex items-center gap-1.5">
                        {rx.isOwnPrescription && <span className="chip bg-warning/10 text-warning">Own Rx</span>}
                        <span className="chip bg-primary/10 text-primary">Rx</span>
                        <Link href={`/dashboard/prescriptions?edit=${rx.id}`} title="Edit prescription"
                          className="p-1 rounded-md hover:bg-surface-hover">
                          <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                        </Link>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[10px] font-medium text-muted-foreground mb-2">RIGHT EYE (OD)</p>
                        <div className="grid grid-cols-5 gap-1 text-xs">
                          {(["Sph", "Cyl", "Axis", "Pd", "Add"] as const).map((f) => (
                            <div key={f} className="text-center">
                              <p className="text-[9px] text-muted-foreground">{f.toUpperCase()}</p>
                              <p className="font-medium">{formatEyeValue(f, rx.rightEye)}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] font-medium text-muted-foreground mb-2">LEFT EYE (OS)</p>
                        <div className="grid grid-cols-5 gap-1 text-xs">
                          {(["Sph", "Cyl", "Axis", "Pd", "Add"] as const).map((f) => (
                            <div key={f} className="text-center">
                              <p className="text-[9px] text-muted-foreground">{f.toUpperCase()}</p>
                              <p className="font-medium">{formatEyeValue(f, rx.leftEye)}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    {rx.label && (
                      <p className="text-[11px] font-medium text-primary mb-1">For {rx.label}</p>
                    )}
                    {rxLensLabel(rx) && (
                      <p className="text-xs mt-2"><span className="text-muted-foreground">Lens: </span>{rxLensLabel(rx)}</p>
                    )}
                    {rx.notes && (
                      <div className="flex items-start gap-2 mt-2 pt-2 border-t border-border">
                        <p className={`text-xs flex-1 min-w-0 ${rx.notesHidden ? "italic text-muted-foreground/70" : "text-muted-foreground"}`}>
                          {rx.notesHidden ? "Notes hidden" : rx.notes}
                        </p>
                        <button
                          onClick={() => toggleRxNotes(rx)}
                          disabled={togglingNotes !== null}
                          title={rx.notesHidden ? "Show these notes" : "Hide these notes"}
                          className="p-1 rounded-md hover:bg-surface-hover cursor-pointer flex-shrink-0 disabled:opacity-50"
                        >
                          {togglingNotes === rx.id
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                            : rx.notesHidden
                              ? <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />
                              : <Eye className="w-3.5 h-3.5 text-muted-foreground" />}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="glass-card p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h3 className="text-sm font-semibold">Purchase History</h3>
              {sales.length > 0 && (
                <button
                  onClick={() => setCollapsed(allOpen ? new Set(sales.map((s) => s.id)) : new Set())}
                  className="text-[11px] text-primary font-medium hover:underline cursor-pointer">
                  {allOpen ? "Collapse all" : "Show every detail"}
                </button>
              )}
            </div>
            {sales.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No purchases yet</p>
            ) : (
              <div className="space-y-3">
                {sales.map((sale) => {
                  const open = !collapsed.has(sale.id);
                  return (
                    <div key={sale.id} className="rounded-xl border border-border">
                      <div className="flex items-center justify-between gap-3 p-3">
                        <button onClick={() => toggleSale(sale.id)} title={open ? "Hide details" : "Show every detail"}
                          className="flex items-start gap-2 text-left min-w-0 flex-1 cursor-pointer">
                          <ChevronDown className={`w-4 h-4 mt-0.5 flex-shrink-0 text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`} />
                          <span className="min-w-0">
                            <span className="block text-sm font-medium">{sale.invoiceNo}</span>
                            <span className="block text-xs text-muted-foreground">
                              {`${formatDate(sale.date)} · ${sale.items.length} item${sale.items.length === 1 ? "" : "s"}${sale.prescriptions.length ? ` · ${sale.prescriptions.length} prescription${sale.prescriptions.length === 1 ? "" : "s"}` : ""}`}
                            </span>
                            {!open && (
                              <span className="block text-xs text-muted-foreground mt-0.5 truncate">
                                {sale.items.map((i) => i.productName).join(", ")}
                              </span>
                            )}
                          </span>
                        </button>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <div className="text-right mr-1">
                            <p className="text-sm font-semibold">{formatCurrency(sale.total)}</p>
                            {sale.balance > 0
                              ? <p className="text-[11px] font-medium text-destructive">{`Owes ${formatCurrency(sale.balance)}`}</p>
                              : <span className={`chip ${paymentStatusChipClass(sale.paymentStatus)}`}>{sale.paymentStatus}</span>}
                          </div>
                          {sale.balance > 0 && (
                            <button onClick={() => setPayingSale(sale)} title={`Receive payment — ${formatCurrency(sale.balance)} still owed`}
                              className="p-1.5 rounded-lg hover:bg-surface-hover cursor-pointer">
                              <Wallet className="w-3.5 h-3.5 text-success" />
                            </button>
                          )}
                          <Link href={`/dashboard/prescriptions?addTo=${sale.id}`}
                            title={sale.prescriptions.length ? "Add another prescription" : "No prescription yet — add one"}
                            className="p-1.5 rounded-lg hover:bg-surface-hover cursor-pointer">
                            <Glasses className={`w-3.5 h-3.5 ${sale.prescriptions.length ? "text-muted-foreground" : "text-warning"}`} />
                          </Link>
                          {canEdit && sale.source === "POS" && (
                            <button onClick={() => setEditingSale(sale)} title="Edit invoice"
                              className="p-1.5 rounded-lg hover:bg-surface-hover cursor-pointer">
                              <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                            </button>
                          )}
                        </div>
                      </div>
                      {open && (
                        <div className="px-3 pb-3">
                          <InvoiceDetails
                            sale={sale}
                            title="Everything on this invoice"
                            canEditPayments={canEdit}
                            onEditPayment={(payment) => setEditingPayment({ sale, payment })}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {editingSale && (
        <EditInvoiceModal
          sale={editingSale}
          customers={customers}
          staff={staff}
          canBackdate={canEdit}
          onClose={() => setEditingSale(null)}
          onDone={(message) => {
            setEditingSale(null);
            showToast(message, "success");
            router.refresh();
          }}
        />
      )}

      {payingSale && (
        <CollectPaymentModal
          sale={payingSale}
          onClose={() => setPayingSale(null)}
          onDone={(message) => {
            setPayingSale(null);
            showToast(message, "success");
            router.refresh();
          }}
        />
      )}

      {editingPayment && (
        <EditPaymentModal
          sale={editingPayment.sale}
          payment={editingPayment.payment}
          onClose={() => setEditingPayment(null)}
          onDone={(message) => {
            setEditingPayment(null);
            showToast(message, "success");
            router.refresh();
          }}
        />
      )}

      {editingDetails && <CustomerFormModal customer={customer} others={customers} onClose={() => setEditingDetails(false)} />}
    </div>
  );
}

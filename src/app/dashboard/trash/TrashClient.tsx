"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { TrashItemView } from "@/lib/data";
import { useApp } from "@/lib/context";
import { emptyTrash, purgeItem, restoreItem } from "@/lib/actions/trash";
import type { TrashKind } from "@/lib/constants";
import { formatDate } from "@/lib/utils/format";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  Trash2, RotateCcw, Package, MapPin, UserRound, Users, Loader2, Truck, FlaskConical,
  Receipt, Undo2, Wallet, Eye, ClipboardList, XCircle, Boxes, Banknote,
} from "lucide-react";

const kindMeta: Record<TrashKind, { icon: typeof Package; label: string; plural: string; color: string }> = {
  invoice: { icon: Receipt, label: "Invoice", plural: "Invoices", color: "bg-primary/10 text-primary" },
  payment: { icon: Banknote, label: "Payment", plural: "Payments", color: "bg-success/10 text-success" },
  return: { icon: Undo2, label: "Return", plural: "Returns", color: "bg-warning/10 text-warning" },
  product: { icon: Package, label: "Product", plural: "Products", color: "bg-primary/10 text-primary" },
  customer: { icon: Users, label: "Customer", plural: "Customers", color: "bg-success/10 text-success" },
  prescription: { icon: Eye, label: "Prescription", plural: "Prescriptions", color: "bg-secondary/10 text-secondary" },
  expense: { icon: Wallet, label: "Expense", plural: "Expenses", color: "bg-destructive/10 text-destructive" },
  supplier: { icon: Truck, label: "Supplier", plural: "Suppliers", color: "bg-secondary/10 text-secondary" },
  purchaseOrder: { icon: ClipboardList, label: "Purchase order", plural: "Purchase orders", color: "bg-secondary/10 text-secondary" },
  lab: { icon: FlaskConical, label: "Lab", plural: "Labs", color: "bg-warning/10 text-warning" },
  labOrder: { icon: FlaskConical, label: "Lab order", plural: "Lab orders", color: "bg-warning/10 text-warning" },
  stockAdjustment: { icon: Boxes, label: "Stock change", plural: "Stock changes", color: "bg-warning/10 text-warning" },
  location: { icon: MapPin, label: "Location", plural: "Locations", color: "bg-secondary/10 text-secondary" },
  staff: { icon: UserRound, label: "Staff", plural: "Staff", color: "bg-warning/10 text-warning" },
};

// Restoring these hands back access or money, so only the owner can.
const OWNER_ONLY_RESTORE: TrashKind[] = ["staff", "invoice"];

export function TrashClient({ items, isOwner }: { items: TrashItemView[]; isOwner: boolean }) {
  const router = useRouter();
  const { showToast } = useApp();
  const [filter, setFilter] = useState<TrashKind | "all">("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [purging, setPurging] = useState<TrashItemView | null>(null);
  const [emptying, setEmptying] = useState(false);
  const [working, setWorking] = useState(false);

  const filtered = useMemo(
    () => (filter === "all" ? items : items.filter((i) => i.kind === filter)),
    [items, filter]
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: items.length };
    for (const i of items) c[i.kind] = (c[i.kind] ?? 0) + 1;
    return c;
  }, [items]);

  // Only offer a filter for kinds that actually have something in them.
  const kinds = (Object.keys(kindMeta) as TrashKind[]).filter((k) => counts[k]);
  const expiringSoon = items.filter((i) => !i.expired && i.daysLeft <= 7).length;

  const handleRestore = async (item: TrashItemView) => {
    setBusyId(item.id);
    try {
      const res = await restoreItem(item.kind, item.id);
      if (!res.ok) {
        showToast(res.error, "error");
        return;
      }
      showToast(`${item.title} restored`, "success");
      router.refresh();
    } catch {
      showToast("Could not restore this item — check the connection and try again", "error");
    } finally {
      setBusyId(null);
    }
  };

  const handlePurge = async () => {
    if (!purging) return;
    setWorking(true);
    try {
      const res = await purgeItem(purging.kind, purging.id);
      if (!res.ok) {
        showToast(res.error, "error");
        return;
      }
      showToast(`${purging.title} deleted permanently`, "success");
      setPurging(null);
      router.refresh();
    } catch {
      showToast("Could not delete this item — check the connection and try again", "error");
    } finally {
      setWorking(false);
    }
  };

  const handleEmpty = async () => {
    setWorking(true);
    try {
      const res = await emptyTrash();
      if (!res.ok) {
        showToast(res.error, "error");
        return;
      }
      showToast(`Trash emptied — ${res.removed} item${res.removed === 1 ? "" : "s"} deleted permanently`, "success");
      setEmptying(false);
      router.refresh();
    } catch {
      showToast("Could not empty the trash — check the connection and try again", "error");
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Trash2 className="w-6 h-6" /> Trash
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Anything deleted stays here for 30 days — restore it within that time.
          </p>
        </div>
        {isOwner && items.length > 0 && (
          <button onClick={() => setEmptying(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-destructive bg-destructive/10 hover:bg-destructive/15 transition-colors cursor-pointer">
            <XCircle className="w-4 h-4" /> Empty trash
          </button>
        )}
      </div>

      {expiringSoon > 0 && (
        <div className="glass-card p-4 border-l-4 border-warning">
          <p className="text-sm">
            <span className="font-semibold">{expiringSoon} item{expiringSoon === 1 ? "" : "s"}</span>{" "}
            {expiringSoon === 1 ? "is" : "are"} in the last week of the restore window.
          </p>
        </div>
      )}

      <div className="flex gap-1.5 flex-wrap">
        {(["all", ...kinds] as const).map((k) => (
          <button key={k} onClick={() => setFilter(k)}
            className={`px-3 py-2 rounded-xl text-xs font-medium transition-all ${
              filter === k ? "bg-primary text-white" : "bg-surface hover:bg-surface-hover"
            }`}>
            {k === "all" ? "Everything" : kindMeta[k].plural} ({counts[k] ?? 0})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Trash2} title="Trash is empty"
          hint="Anything you delete shows up here, and can be put back for 30 days." />
      ) : (
        <div className="glass-card p-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Item</th>
                  <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Type</th>
                  <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Deleted</th>
                  <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Time left</th>
                  <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => {
                  const meta = kindMeta[item.kind];
                  const Icon = meta.icon;
                  const ownerOnly = OWNER_ONLY_RESTORE.includes(item.kind) && !isOwner;
                  return (
                    <tr key={`${item.kind}-${item.id}`} className={`border-b border-border ${item.expired ? "opacity-60" : "hover:bg-surface-hover/50"} transition-colors`}>
                      <td className="py-3 px-3">
                        <p className="font-medium">{item.title}</p>
                        {item.detail && <p className="text-xs text-muted-foreground">{item.detail}</p>}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap ${meta.color}`}>
                          <Icon className="w-3 h-3" /> {meta.label}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-xs text-muted-foreground whitespace-nowrap">{formatDate(item.deletedAt)}</td>
                      <td className="py-3 px-3 text-xs whitespace-nowrap">
                        {item.expired ? (
                          <span className="text-destructive font-medium">Expired</span>
                        ) : (
                          <span className={item.daysLeft <= 7 ? "text-warning font-medium" : "text-muted-foreground"}>
                            {item.daysLeft} day{item.daysLeft === 1 ? "" : "s"}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <button onClick={() => handleRestore(item)}
                            disabled={item.expired || busyId !== null || ownerOnly}
                            title={item.expired ? "Past the 30-day window" : ownerOnly ? "Only the owner can restore this" : "Put this back"}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 glass-card text-xs font-medium cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
                            {busyId === item.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                            Restore
                          </button>
                          {isOwner && (
                            <button onClick={() => setPurging(item)} disabled={busyId !== null} title="Delete permanently"
                              className="p-1.5 rounded-lg hover:bg-destructive/10 cursor-pointer disabled:opacity-40">
                              <Trash2 className="w-3.5 h-3.5 text-destructive" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {purging && (
        <ConfirmDialog
          title={`Delete ${purging.title} permanently?`}
          message={
            <>
              It can&apos;t be restored after this.
              {["product", "customer", "supplier", "lab", "staff", "location"].includes(purging.kind) &&
                " Past invoices and orders that mention it will still show its name."}
            </>
          }
          confirmLabel="Delete permanently"
          busy={working}
          onConfirm={handlePurge}
          onCancel={() => setPurging(null)}
        />
      )}

      {emptying && (
        <ConfirmDialog
          title="Empty the trash?"
          message={`All ${items.length} item${items.length === 1 ? "" : "s"} will be deleted permanently and can't be restored.`}
          confirmLabel="Empty trash"
          requireText="DELETE"
          busy={working}
          onConfirm={handleEmpty}
          onCancel={() => setEmptying(false)}
        />
      )}
    </div>
  );
}

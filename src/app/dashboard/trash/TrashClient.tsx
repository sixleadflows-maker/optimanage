"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { TrashItemView } from "@/lib/data";
import { useApp } from "@/lib/context";
import { restoreItem } from "@/lib/actions/trash";
import type { TrashKind } from "@/lib/constants";
import { formatDate } from "@/lib/utils/format";
import { EmptyState } from "@/components/ui/EmptyState";
import { Trash2, RotateCcw, Package, MapPin, UserRound, Loader2 } from "lucide-react";

const KINDS: { key: TrashKind | "all"; label: string }[] = [
  { key: "all", label: "Everything" },
  { key: "product", label: "Products" },
  { key: "location", label: "Locations" },
  { key: "staff", label: "Staff" },
];

const kindMeta = {
  product: { icon: Package, label: "Product", color: "bg-primary/10 text-primary" },
  location: { icon: MapPin, label: "Location", color: "bg-secondary/10 text-secondary" },
  staff: { icon: UserRound, label: "Staff", color: "bg-warning/10 text-warning" },
} as const;

export function TrashClient({ items, isOwner }: { items: TrashItemView[]; isOwner: boolean }) {
  const router = useRouter();
  const { showToast } = useApp();
  const [filter, setFilter] = useState<TrashKind | "all">("all");
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const filtered = useMemo(
    () => (filter === "all" ? items : items.filter((i) => i.kind === filter)),
    [items, filter]
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: items.length };
    for (const i of items) c[i.kind] = (c[i.kind] ?? 0) + 1;
    return c;
  }, [items]);

  const expiringSoon = items.filter((i) => !i.expired && i.daysLeft <= 7).length;

  const handleRestore = async (item: TrashItemView) => {
    if (item.kind === "staff" && !isOwner) {
      showToast("Only the owner can restore a staff account", "error");
      return;
    }
    setRestoringId(item.id);
    try {
      await restoreItem(item.kind, item.id);
      showToast(`${item.title} restored`, "success");
      router.refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not restore this item", "error");
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Trash2 className="w-6 h-6" /> Trash
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Deleted products, locations and staff stay here for 30 days — restore anything within that time.
        </p>
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
        {KINDS.map((k) => (
          <button key={k.key} onClick={() => setFilter(k.key)}
            className={`px-3 py-2 rounded-xl text-xs font-medium transition-all ${
              filter === k.key ? "bg-primary text-white" : "bg-surface hover:bg-surface-hover"
            }`}>
            {k.label} ({counts[k.key] ?? 0})
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
                  return (
                    <tr key={`${item.kind}-${item.id}`} className={`border-b border-border ${item.expired ? "opacity-50" : "hover:bg-surface-hover/50"} transition-colors`}>
                      <td className="py-3 px-3">
                        <p className="font-medium">{item.title}</p>
                        {item.detail && <p className="text-xs text-muted-foreground">{item.detail}</p>}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${meta.color}`}>
                          <Icon className="w-3 h-3" /> {meta.label}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-xs text-muted-foreground">{formatDate(item.deletedAt)}</td>
                      <td className="py-3 px-3 text-xs">
                        {item.expired ? (
                          <span className="text-destructive font-medium">Expired</span>
                        ) : (
                          <span className={item.daysLeft <= 7 ? "text-warning font-medium" : "text-muted-foreground"}>
                            {item.daysLeft} day{item.daysLeft === 1 ? "" : "s"}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button onClick={() => handleRestore(item)}
                          disabled={item.expired || restoringId !== null || (item.kind === "staff" && !isOwner)}
                          title={item.expired ? "Past the 30-day window" : "Put this back"}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 glass-card text-xs font-medium cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
                          {restoringId === item.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                          Restore
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

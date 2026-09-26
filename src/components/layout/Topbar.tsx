"use client";

import { useApp } from "@/lib/context";
import { SHOP_NAME } from "@/lib/constants";
import { logout } from "@/lib/actions/auth";
import { clearOfflinePages } from "@/components/layout/ServiceWorker";
import { globalSearch, type ProductSearchResult } from "@/lib/actions/search";
import type { CustomerSearchHit } from "@/lib/actions/customers";
import Link from "next/link";
import type { BranchView } from "@/lib/data";
import { formatCurrency } from "@/lib/utils/format";
import { Menu, Search, Moon, Sun, Wifi, WifiOff, ChevronDown, LogOut, Loader2, User, Package } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface TopbarUser {
  name: string;
  email: string;
  role: string;
  image?: string;
}

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

/**
 * Closes a menu on a click anywhere outside it, or on Escape. A full-screen
 * click-catcher can't do this here: inside the blurred top bar, "fixed inset-0"
 * only covers the bar itself, so clicks on the page never reached it.
 */
function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(close);
  useEffect(() => {
    closeRef.current = close;
  });
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) closeRef.current();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return ref;
}

type SearchState = {
  query: string;
  status: "searching" | "done" | "failed";
  error?: string;
  products: ProductSearchResult[];
  customers: CustomerSearchHit[];
};

function stockChip(p: { stock: number; lowStockThreshold: number }) {
  if (p.stock <= 0) return { label: "Out of stock", tone: "bg-destructive/10 text-destructive" };
  if (p.stock <= p.lowStockThreshold) return { label: `${p.stock} left`, tone: "bg-warning/10 text-warning" };
  return { label: `${p.stock} in stock`, tone: "bg-success/10 text-success" };
}

export function Topbar({ user, branches }: { user: TopbarUser; branches: BranchView[] }) {
  const { activeBranch, setActiveBranch, darkMode, toggleDarkMode, isOnline, setSidebarOpen } = useApp();
  const [branchOpen, setBranchOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const currentBranch = branches.find((b) => b.id === activeBranch) ?? branches[0];
  const branchRef = useDismiss(branchOpen, () => setBranchOpen(false));
  const userRef = useDismiss(userOpen, () => setUserOpen(false));

  // One box finds a product (scanned barcode, or name / brand / model) and a
  // customer (serial number, name or phone). Results come up as you type.
  const [scanValue, setScanValue] = useState("");
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState<SearchState | null>(null);
  const latestRequest = useRef(0);
  const searchRef = useDismiss(open, () => setOpen(false));

  const runSearch = useCallback(async (query: string) => {
    const id = ++latestRequest.current;
    // Keep what's showing while the next results load, so the list doesn't flash.
    setSearch((prev) => ({ products: [], customers: [], ...prev, query, status: "searching", error: undefined }));
    try {
      const res = await globalSearch(query);
      if (id !== latestRequest.current) return;
      setSearch(res.ok
        ? { query, status: "done", products: res.products, customers: res.customers }
        : { query, status: "failed", error: res.error, products: [], customers: [] });
    } catch {
      if (id !== latestRequest.current) return;
      setSearch({ query, status: "failed", products: [], customers: [] });
    }
  }, []);

  useEffect(() => {
    const query = scanValue.trim();
    if (query.length < 2) return;
    const timer = setTimeout(() => { void runSearch(query); }, 250);
    return () => clearTimeout(timer);
  }, [scanValue, runSearch]);

  const closeSearch = () => {
    setOpen(false);
    setScanValue("");
    setSearch(null);
  };

  const query = scanValue.trim();
  // A single character only shows results when it was searched with Enter (a scanned code).
  const shown = open && search && (query.length >= 2 || (query.length > 0 && search.query === query)) ? search : null;
  const found = !!shown && (shown.products.length > 0 || shown.customers.length > 0);

  return (
    <header className="glass-topbar sticky top-0 z-30 px-4 lg:px-6 h-14 flex items-center gap-3">
      <button
        onClick={() => setSidebarOpen(true)}
        className="lg:hidden p-2 rounded-xl hover:bg-surface-hover transition-colors"
      >
        <Menu className="w-5 h-5" />
      </button>

      {branches.length > 0 && (
        <div className="hidden md:flex items-center gap-2 text-sm">
          <span className="font-semibold">{SHOP_NAME}</span>
          <span className="text-muted-foreground">·</span>
          <div className="relative" ref={branchRef}>
            <button
              onClick={() => setBranchOpen(!branchOpen)}
              className="flex items-center gap-1 text-muted-foreground hover:text-foreground text-sm transition-colors"
            >
              {currentBranch?.name}
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            {branchOpen && (
              <div className="absolute top-full left-0 mt-2 w-56 topbar-popover rounded-xl p-1.5 z-20 animate-fade-in">
                {branches.map((branch) => (
                  <button
                    key={branch.id}
                    onClick={() => { setActiveBranch(branch.id); setBranchOpen(false); }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      (activeBranch || branches[0]?.id) === branch.id ? "bg-primary text-white" : "hover:bg-surface-hover"
                    }`}
                  >
                    {branch.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Not positioned on phones, so the results panel spans the whole bar
          instead of the narrow box; lined up under the box from sm up. */}
      <div className="flex-1 min-w-0 max-w-md mx-auto sm:relative" ref={searchRef}>
        <div className="relative">
          {search?.status === "searching" ? (
            <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
          ) : (
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          )}
          <input
            type="text"
            placeholder="Search products, barcodes or customers..."
            value={scanValue}
            onChange={(e) => { setScanValue(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              // A barcode scanner types the code and presses Enter: search at once.
              if (e.key === "Enter" && query) { setOpen(true); void runSearch(query); }
            }}
            className="w-full pl-9 pr-4 py-2 glass-input text-sm"
          />
        </div>
        {shown && (
          <div className="absolute top-full left-2 right-2 sm:left-0 sm:right-0 mt-2 topbar-popover rounded-xl p-2 z-20 animate-fade-in max-h-[70vh] overflow-y-auto">
            {shown.status === "failed" ? (
              <p className="text-sm text-muted-foreground p-1.5">
                {shown.error ?? "Couldn't search just now — check the connection and try again."}
              </p>
            ) : !found ? (
              <p className="text-sm text-muted-foreground p-1.5">
                {shown.status === "searching" ? "Searching…" : `Nothing found for "${shown.query}" — no product or customer matches.`}
              </p>
            ) : (
              <div className="space-y-2">
                {shown.products.length > 0 && (
                  <div>
                    <p className="px-2 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Products</p>
                    {shown.products.map((p) => {
                      const chip = stockChip(p);
                      return (
                        <Link key={p.id} href={`/dashboard/inventory/${p.id}`} onClick={closeSearch}
                          className="flex items-center justify-between gap-3 px-2 py-1.5 rounded-lg hover:bg-surface-hover">
                          <span className="min-w-0">
                            <span className="text-sm font-medium flex items-center gap-1.5">
                              <Package className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                              <span className="truncate">{p.label}</span>
                            </span>
                            <span className="block text-[11px] text-muted-foreground truncate">
                              {[p.model, p.barcode && `Barcode ${p.barcode}`, formatCurrency(p.salePrice)].filter(Boolean).join(" · ")}
                            </span>
                          </span>
                          <span className={`shrink-0 px-2 py-0.5 rounded-full text-[11px] font-semibold ${chip.tone}`}>{chip.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
                {shown.customers.length > 0 && (
                  <div>
                    <p className="px-2 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Customers</p>
                    {shown.customers.map((c) => (
                      <Link key={c.id} href={`/dashboard/customers/${c.id}`} onClick={closeSearch}
                        className="flex items-center justify-between gap-3 px-2 py-1.5 rounded-lg hover:bg-surface-hover">
                        <span className="min-w-0">
                          <span className="text-sm font-medium flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                            <span className="truncate">{c.name}</span>
                          </span>
                          <span className="block text-[11px] text-muted-foreground truncate">
                            {[c.serialNumber && `Serial ${c.serialNumber}`, c.phone, c.prescriptionCount > 0 && `${c.prescriptionCount} prescription${c.prescriptionCount === 1 ? "" : "s"}`]
                              .filter(Boolean).join(" · ")}
                          </span>
                        </span>
                        <span className="text-[11px] text-muted-foreground flex-shrink-0">
                          {c.visitCount} visit{c.visitCount === 1 ? "" : "s"}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span
          title={isOnline
            ? "Connected"
            : "No internet — the till still works, and bills are recorded once the connection is back"}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
            isOnline ? "bg-success/10 text-success" : "bg-warning/15 text-warning"
          }`}
        >
          {isOnline && <span className="live-dot w-1.5 h-1.5 rounded-full bg-success" />}
          {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
          <span className="hidden sm:inline">{isOnline ? "Online" : "Offline"}</span>
        </span>

        <span className="hidden sm:inline-flex px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-semibold tracking-wide capitalize">
          {user.role.toLowerCase()}
        </span>

        <button
          onClick={toggleDarkMode}
          className="p-2 rounded-xl hover:bg-surface-hover transition-colors"
        >
          <span className={`theme-icon inline-flex ${darkMode ? "spin" : ""}`}>
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </span>
        </button>

        <div className="relative" ref={userRef}>
          <button
            onClick={() => setUserOpen(!userOpen)}
            className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-xs font-semibold cursor-pointer"
          >
            {initials(user.name)}
          </button>
          {userOpen && (
            <div className="absolute top-full right-0 mt-2 w-56 topbar-popover rounded-xl p-1.5 z-20 animate-fade-in">
              <div className="px-3 py-2 border-b border-border mb-1">
                <p className="text-sm font-semibold truncate">{user.name}</p>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              </div>
              <button
                onClick={async () => { await clearOfflinePages(); await logout(); }}
                className="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors hover:bg-surface-hover flex items-center gap-2 text-red-500"
              >
                <LogOut className="w-4 h-4" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

"use client";

import { useApp } from "@/lib/context";
import { SHOP_NAME } from "@/lib/constants";
import { logout } from "@/lib/actions/auth";
import { clearOfflinePages } from "@/components/layout/ServiceWorker";
import { lookupProductByBarcode, type BarcodeLookupResult } from "@/lib/actions/products";
import { searchCustomers, type CustomerSearchHit } from "@/lib/actions/customers";
import Link from "next/link";
import type { BranchView } from "@/lib/data";
import { formatCurrency } from "@/lib/utils/format";
import { Menu, Search, Moon, Sun, Wifi, WifiOff, ChevronDown, LogOut, Loader2, User } from "lucide-react";
import { useState } from "react";

interface TopbarUser {
  name: string;
  email: string;
  role: string;
  image?: string;
}

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

export function Topbar({ user, branches }: { user: TopbarUser; branches: BranchView[] }) {
  const { activeBranch, setActiveBranch, darkMode, toggleDarkMode, isOnline, setSidebarOpen } = useApp();
  const [branchOpen, setBranchOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const currentBranch = branches.find((b) => b.id === activeBranch) ?? branches[0];

  const [scanValue, setScanValue] = useState("");
  const [checking, setChecking] = useState(false);
  const [lookupResult, setLookupResult] = useState<BarcodeLookupResult | "not-found" | "failed" | null>(null);
  // The same box finds a customer by serial number, name or phone -- a serial
  // written on a case or an old bill is enough to pull them up.
  const [customerHits, setCustomerHits] = useState<CustomerSearchHit[]>([]);

  const checkStock = async () => {
    const query = scanValue.trim();
    if (!query) return;
    setChecking(true);
    try {
      const [product, customers] = await Promise.all([lookupProductByBarcode(query), searchCustomers(query)]);
      setCustomerHits(customers);
      setLookupResult(product ?? (customers.length ? null : "not-found"));
    } catch {
      // Signed out, or no connection -- say so rather than looking broken.
      setCustomerHits([]);
      setLookupResult("failed");
    } finally {
      setChecking(false);
    }
  };

  const closeLookup = () => {
    setLookupResult(null);
    setCustomerHits([]);
    setScanValue("");
  };

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
          <div className="relative">
            <button
              onClick={() => setBranchOpen(!branchOpen)}
              className="flex items-center gap-1 text-muted-foreground hover:text-foreground text-sm transition-colors"
            >
              {currentBranch?.name}
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            {branchOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setBranchOpen(false)} />
                <div className="absolute top-full left-0 mt-2 w-56 glass rounded-xl p-1.5 z-20 animate-fade-in">
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
              </>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 max-w-md mx-auto">
        <div className="relative">
          {checking ? (
            <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
          ) : (
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          )}
          <input
            type="text"
            placeholder="Scan a barcode, or search a customer by serial, name or phone..."
            value={scanValue}
            onChange={(e) => setScanValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") checkStock(); }}
            className="w-full pl-9 pr-4 py-2 glass-input text-sm"
          />
          {(lookupResult || customerHits.length > 0) && (
            <>
              <div className="fixed inset-0 z-10" onClick={closeLookup} />
              <div className="absolute top-full left-0 right-0 mt-2 glass rounded-xl p-3 z-20 animate-fade-in space-y-2">
                {customerHits.length > 0 && (
                  <div className="space-y-1">
                    {customerHits.map((c) => (
                      <Link key={c.id} href={`/dashboard/customers/${c.id}`} onClick={closeLookup}
                        className="flex items-center justify-between gap-3 px-2 py-1.5 rounded-lg hover:bg-surface-hover">
                        <span className="min-w-0">
                          <span className="text-sm font-medium flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-primary flex-shrink-0" /> {c.name}
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
                {lookupResult === "failed" ? (
                  <p className="text-sm text-muted-foreground">Couldn&apos;t search just now — check the connection, or sign in again, and try once more.</p>
                ) : lookupResult === "not-found" ? (
                  <p className="text-sm text-muted-foreground">Nothing found for &quot;{scanValue}&quot; — no product with that barcode and no customer by that serial, name or phone.</p>
                ) : lookupResult && (
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{lookupResult.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{lookupResult.brand} {lookupResult.model}</p>
                      <p className="text-sm font-bold text-primary mt-0.5">{formatCurrency(lookupResult.salePrice)}</p>
                    </div>
                    <span
                      className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold ${
                        lookupResult.stock === 0
                          ? "bg-destructive/10 text-destructive"
                          : lookupResult.stock <= lookupResult.lowStockThreshold
                          ? "bg-warning/10 text-warning"
                          : "bg-success/10 text-success"
                      }`}
                    >
                      {lookupResult.stock === 0
                        ? "Out of Stock"
                        : lookupResult.stock <= lookupResult.lowStockThreshold
                        ? `Low Stock — ${lookupResult.stock} left`
                        : `In Stock — ${lookupResult.stock} available`}
                    </span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
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

        <div className="relative">
          <button
            onClick={() => setUserOpen(!userOpen)}
            className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-xs font-semibold cursor-pointer"
          >
            {initials(user.name)}
          </button>
          {userOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setUserOpen(false)} />
              <div className="absolute top-full right-0 mt-2 w-56 glass rounded-xl p-1.5 z-20 animate-fade-in">
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
            </>
          )}
        </div>
      </div>
    </header>
  );
}

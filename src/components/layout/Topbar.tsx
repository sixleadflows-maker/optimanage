"use client";

import { useApp } from "@/lib/context";
import { BRANCHES, SHOP_NAME } from "@/lib/constants";
import { Menu, Search, Moon, Sun, Wifi, WifiOff, ChevronDown } from "lucide-react";
import { useState } from "react";

export function Topbar() {
  const { activeBranch, setActiveBranch, darkMode, toggleDarkMode, isOnline, toggleOnline, setSidebarOpen } = useApp();
  const [branchOpen, setBranchOpen] = useState(false);
  const currentBranch = BRANCHES.find((b) => b.id === activeBranch);

  return (
    <header className="glass-topbar sticky top-0 z-30 px-4 lg:px-6 h-14 flex items-center gap-3">
      <button
        onClick={() => setSidebarOpen(true)}
        className="lg:hidden p-2 rounded-xl hover:bg-surface-hover transition-colors"
      >
        <Menu className="w-5 h-5" />
      </button>

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
                {BRANCHES.map((branch) => (
                  <button
                    key={branch.id}
                    onClick={() => { setActiveBranch(branch.id); setBranchOpen(false); }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      activeBranch === branch.id ? "bg-primary text-white" : "hover:bg-surface-hover"
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

      <div className="flex-1 max-w-md mx-auto">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search products, customers, invoices..."
            className="w-full pl-9 pr-4 py-2 glass-input text-sm"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={toggleOnline}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
            isOnline
              ? "bg-success/10 text-success"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
          <span className="hidden sm:inline">{isOnline ? "Online" : "Offline"}</span>
        </button>

        <span className="hidden sm:inline-flex px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-semibold tracking-wide">
          DEMO
        </span>

        <button
          onClick={toggleDarkMode}
          className="p-2 rounded-xl hover:bg-surface-hover transition-colors"
        >
          {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-xs font-semibold cursor-pointer">
          AK
        </div>
      </div>
    </header>
  );
}

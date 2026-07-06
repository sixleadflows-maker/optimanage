"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApp } from "@/lib/context";
import { cn } from "@/lib/utils/cn";
import {
  LayoutDashboard, ShoppingCart, Receipt, Package, Users, UserCircle,
  Eye, FlaskConical, MessageCircle, BarChart3, Settings, X, Wallet,
  Truck, Store, Banknote, Activity,
} from "lucide-react";

const navGroups = [
  {
    label: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/dashboard/monitor", label: "Monitor", icon: Activity },
    ],
  },
  {
    label: "Sales",
    items: [
      { href: "/dashboard/pos", label: "New Sale (POS)", icon: ShoppingCart },
      { href: "/dashboard/sales", label: "Sales & Invoices", icon: Receipt },
      { href: "/dashboard/cash", label: "Cash Collection", icon: Banknote },
    ],
  },
  {
    label: "Inventory",
    items: [
      { href: "/dashboard/inventory", label: "Products", icon: Package },
      { href: "/dashboard/suppliers", label: "Suppliers & POs", icon: Truck },
    ],
  },
  {
    label: "Customers",
    items: [
      { href: "/dashboard/customers", label: "Customers", icon: Users },
      { href: "/dashboard/prescriptions", label: "Prescriptions", icon: Eye },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/dashboard/lab-orders", label: "Lab Orders", icon: FlaskConical },
      { href: "/dashboard/whatsapp", label: "WhatsApp Center", icon: MessageCircle },
      { href: "/dashboard/expenses", label: "Expenses", icon: Wallet },
    ],
  },
  {
    label: "Reports",
    items: [
      { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
    ],
  },
  {
    label: "Admin",
    items: [
      { href: "/dashboard/settings", label: "Settings", icon: Settings },
    ],
  },
];

interface SidebarUser {
  name: string;
  role: string;
}

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

export function Sidebar({ user }: { user: SidebarUser }) {
  const pathname = usePathname();
  const { sidebarOpen, setSidebarOpen } = useApp();

  return (
    <>
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside
        className={cn(
          "fixed top-0 left-0 z-50 h-full w-[260px] glass-sidebar flex flex-col transition-transform duration-300 lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center gap-3 px-5 py-5 border-b border-border">
          <div className="brand-mark w-9 h-9 rounded-xl bg-gradient-to-br from-[#6d5ef0] to-[#14b8a6] flex items-center justify-center">
            <Store className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-[15px] tracking-tight font-display">OptiManage</span>
          <button
            onClick={() => setSidebarOpen(false)}
            className="ml-auto lg:hidden p-1 rounded-lg hover:bg-surface-hover"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-3">
          {navGroups.map((group) => (
            <div key={group.label} className="mb-4">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground px-3 mb-1.5 font-medium">
                {group.label}
              </p>
              {group.items.map((item) => {
                const isActive =
                  item.href === "/dashboard"
                    ? pathname === "/dashboard"
                    : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium transition-all duration-150",
                      isActive
                        ? "bg-gradient-to-r from-[#6d5ef0] to-[#7c6bfa] text-white shadow-md shadow-[#6d5ef0]/25"
                        : "text-muted-foreground hover:text-foreground hover:bg-surface-hover"
                    )}
                  >
                    <item.icon className="nav-icon w-4 h-4 flex-shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl bg-surface/60">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#6d5ef0] to-[#14b8a6] text-white flex items-center justify-center text-xs font-semibold shadow-sm">
              {initials(user.name)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{user.name}</p>
              <p className="text-[10px] text-muted-foreground capitalize">{user.role.toLowerCase()}</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApp } from "@/lib/context";
import { cn } from "@/lib/utils/cn";
import {
  LayoutDashboard, ShoppingCart, Receipt, Package, Users, UserCircle,
  Eye, FlaskConical, MessageCircle, BarChart3, Settings, X, Wallet,
  Truck, Store,
} from "lucide-react";

const navGroups = [
  {
    label: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Sales",
    items: [
      { href: "/dashboard/pos", label: "New Sale (POS)", icon: ShoppingCart },
      { href: "/dashboard/sales", label: "Sales & Invoices", icon: Receipt },
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

export function Sidebar() {
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
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Store className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-[15px] tracking-tight">OptiManage</span>
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
                        ? "bg-primary text-white shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-surface-hover"
                    )}
                  >
                    <item.icon className="w-4 h-4 flex-shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-2.5 px-2">
            <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
              AM
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">Dr. Asif Mahmood</p>
              <p className="text-[10px] text-muted-foreground">Owner</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

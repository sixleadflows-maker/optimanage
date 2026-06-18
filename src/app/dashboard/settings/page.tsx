"use client";

import { useState } from "react";
import { shopSettings, users } from "@/lib/mock";
import { useApp } from "@/lib/context";
import { PAYMENT_METHODS } from "@/lib/constants";
import { Store, CreditCard, Printer, Users, Save, Shield } from "lucide-react";

export default function SettingsPage() {
  const { showToast } = useApp();
  const [activeTab, setActiveTab] = useState<"shop" | "payment" | "printing" | "users">("shop");
  const [shop, setShop] = useState(shopSettings);

  const tabs = [
    { id: "shop" as const, label: "Shop Profile", icon: Store },
    { id: "payment" as const, label: "Payment & Tax", icon: CreditCard },
    { id: "printing" as const, label: "Printing", icon: Printer },
    { id: "users" as const, label: "Users & Roles", icon: Users },
  ];

  const roleColors: Record<string, string> = {
    Owner: "bg-primary/10 text-primary",
    Manager: "bg-warning/10 text-warning",
    Cashier: "bg-success/10 text-success",
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage your store configuration</p>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {tabs.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${activeTab === tab.id ? "bg-primary text-white" : "bg-surface hover:bg-surface-hover"}`}>
            <tab.icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "shop" && (
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold mb-4">Shop Profile</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Shop Name</label>
              <input type="text" value={shop.name} onChange={(e) => setShop({ ...shop, name: e.target.value })}
                className="w-full px-4 py-2.5 glass-input text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Phone</label>
              <input type="text" value={shop.phone} onChange={(e) => setShop({ ...shop, phone: e.target.value })}
                className="w-full px-4 py-2.5 glass-input text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Email</label>
              <input type="text" value={shop.email} onChange={(e) => setShop({ ...shop, email: e.target.value })}
                className="w-full px-4 py-2.5 glass-input text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">GST Number</label>
              <input type="text" value={shop.gst} onChange={(e) => setShop({ ...shop, gst: e.target.value })}
                className="w-full px-4 py-2.5 glass-input text-sm font-mono" />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Address</label>
              <textarea value={shop.address} onChange={(e) => setShop({ ...shop, address: e.target.value })}
                rows={2} className="w-full px-4 py-2.5 glass-input text-sm resize-none" />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Receipt Footer</label>
              <input type="text" value={shop.receiptFooter} onChange={(e) => setShop({ ...shop, receiptFooter: e.target.value })}
                className="w-full px-4 py-2.5 glass-input text-sm" />
            </div>
          </div>
          <button onClick={() => showToast("Shop settings saved (demo)", "success")}
            className="mt-4 flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-hover transition-colors">
            <Save className="w-4 h-4" /> Save Settings
          </button>
        </div>
      )}

      {activeTab === "payment" && (
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold mb-4">Payment Methods & Tax</h3>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-2 block">Enabled Payment Methods</label>
              <div className="flex flex-wrap gap-2">
                {PAYMENT_METHODS.map((method) => (
                  <label key={method} className="flex items-center gap-2 px-4 py-2.5 glass-card cursor-pointer">
                    <input type="checkbox" defaultChecked className="rounded" />
                    <span className="text-sm">{method}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Tax Rate (%)</label>
                <input type="number" defaultValue={0} className="w-full px-4 py-2.5 glass-input text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Tax Label</label>
                <input type="text" defaultValue="GST" className="w-full px-4 py-2.5 glass-input text-sm" />
              </div>
            </div>
            <button onClick={() => showToast("Payment settings saved (demo)", "success")}
              className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-hover transition-colors">
              <Save className="w-4 h-4" /> Save
            </button>
          </div>
        </div>
      )}

      {activeTab === "printing" && (
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold mb-4">Printing Configuration</h3>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Default Receipt Size</label>
                <select className="w-full px-4 py-2.5 glass-input text-sm">
                  <option>80mm Thermal</option>
                  <option>58mm Thermal</option>
                  <option>A4</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Printer</label>
                <select className="w-full px-4 py-2.5 glass-input text-sm">
                  <option>Default Printer</option>
                  <option>Epson TM-T88V</option>
                  <option>Star TSP143</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" defaultChecked className="rounded" /> Auto-print on sale completion
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" defaultChecked className="rounded" /> Print shop logo on receipt
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="rounded" /> Print barcode on receipt
              </label>
            </div>
            <button onClick={() => showToast("Print settings saved (demo)", "success")}
              className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-hover transition-colors">
              <Save className="w-4 h-4" /> Save
            </button>
          </div>
        </div>
      )}

      {activeTab === "users" && (
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">Users & Roles</h3>
            <button onClick={() => showToast("Invite user form opened (demo)", "info")}
              className="flex items-center gap-2 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-medium hover:bg-primary-hover transition-colors">
              Add User
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">User</th>
                  <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Email</th>
                  <th className="text-center py-3 px-3 text-xs font-medium text-muted-foreground">Role</th>
                  <th className="text-center py-3 px-3 text-xs font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-border hover:bg-surface-hover/50">
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
                          {u.avatar}
                        </div>
                        <span className="font-medium">{u.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-muted-foreground">{u.email}</td>
                    <td className="py-3 px-3 text-center">
                      <span className={`chip ${roleColors[u.role]}`}>
                        <Shield className="w-3 h-3 mr-1" />{u.role}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={`chip ${u.active ? "chip-paid" : "bg-surface text-muted-foreground"}`}>
                        {u.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

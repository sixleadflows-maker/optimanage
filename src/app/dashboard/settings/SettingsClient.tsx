"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SettingsView, UserView } from "@/lib/data";
import { useApp } from "@/lib/context";
import { updateShopSettings, setAnalyticsPin } from "@/lib/actions/settings";
import { Store, Shield, Users, Save, Lock, Loader2, CheckCircle } from "lucide-react";

const roleColors: Record<string, string> = {
  Owner: "bg-primary/10 text-primary",
  Manager: "bg-warning/10 text-warning",
  Cashier: "bg-success/10 text-success",
};

export function SettingsClient({ settings, users, canManage }: { settings: SettingsView; users: UserView[]; canManage: boolean }) {
  const { showToast } = useApp();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"shop" | "security" | "users">("shop");
  const [shop, setShop] = useState({
    name: settings.name, phone: settings.phone, email: settings.email,
    ntn: settings.ntn, address: settings.address, receiptFooter: settings.receiptFooter,
    taxRate: settings.taxRate,
  });
  const [saving, setSaving] = useState(false);
  const [pin, setPin] = useState("");
  const [pinSaving, setPinSaving] = useState(false);
  const [hasPin, setHasPin] = useState(settings.hasAnalyticsPin);

  const tabs = [
    { id: "shop" as const, label: "Shop Profile", icon: Store },
    { id: "security" as const, label: "Security", icon: Shield },
    { id: "users" as const, label: "Users & Roles", icon: Users },
  ];

  const saveShop = async () => {
    if (!canManage) { showToast("Only managers and owners can change settings", "error"); return; }
    setSaving(true);
    try {
      await updateShopSettings(shop);
      showToast("Settings saved", "success");
      router.refresh();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Could not save", "error");
    } finally {
      setSaving(false);
    }
  };

  const savePin = async () => {
    setPinSaving(true);
    try {
      await setAnalyticsPin(pin);
      showToast("Analytics PIN updated", "success");
      setPin("");
      setHasPin(true);
      router.refresh();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Could not set PIN", "error");
    } finally {
      setPinSaving(false);
    }
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
              <input type="text" value={shop.name} onChange={(e) => setShop({ ...shop, name: e.target.value })} className="w-full px-4 py-2.5 glass-input text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Phone</label>
              <input type="text" value={shop.phone} onChange={(e) => setShop({ ...shop, phone: e.target.value })} className="w-full px-4 py-2.5 glass-input text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Email</label>
              <input type="text" value={shop.email} onChange={(e) => setShop({ ...shop, email: e.target.value })} className="w-full px-4 py-2.5 glass-input text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">NTN Number</label>
              <input type="text" value={shop.ntn} onChange={(e) => setShop({ ...shop, ntn: e.target.value })} className="w-full px-4 py-2.5 glass-input text-sm font-mono" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Tax Rate (%)</label>
              <input type="number" value={shop.taxRate || ""} onChange={(e) => setShop({ ...shop, taxRate: Number(e.target.value) })} className="w-full px-4 py-2.5 glass-input text-sm" />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Address</label>
              <textarea value={shop.address} onChange={(e) => setShop({ ...shop, address: e.target.value })} rows={2} className="w-full px-4 py-2.5 glass-input text-sm resize-none" />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Receipt Footer</label>
              <input type="text" value={shop.receiptFooter} onChange={(e) => setShop({ ...shop, receiptFooter: e.target.value })} className="w-full px-4 py-2.5 glass-input text-sm" />
            </div>
          </div>
          <button onClick={saveShop} disabled={saving || !canManage}
            className="mt-4 flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-60">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Settings
          </button>
          {!canManage && <p className="text-xs text-muted-foreground mt-2">Only managers and owners can edit settings.</p>}
        </div>
      )}

      {activeTab === "security" && (
        <div className="glass-card p-5 max-w-md">
          <h3 className="text-sm font-semibold mb-1 flex items-center gap-2"><Lock className="w-4 h-4" /> Analytics PIN</h3>
          <p className="text-xs text-muted-foreground mb-4">
            Protect the Analytics page with a PIN so only authorised staff can view profit figures.
            {hasPin && <span className="inline-flex items-center gap-1 text-success ml-1"><CheckCircle className="w-3 h-3" /> A PIN is currently set.</span>}
          </p>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">New PIN (4–6 digits)</label>
          <input type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ""))}
            maxLength={6} className="w-full px-4 py-2.5 glass-input text-sm tracking-widest" placeholder="••••" />
          <button onClick={savePin} disabled={pinSaving || pin.length < 4 || !canManage}
            className="mt-3 flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-60">
            {pinSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {hasPin ? "Update PIN" : "Set PIN"}
          </button>
          {!canManage && <p className="text-xs text-muted-foreground mt-2">Only managers and owners can change the PIN.</p>}
        </div>
      )}

      {activeTab === "users" && (
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold mb-4">Users & Roles</h3>
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

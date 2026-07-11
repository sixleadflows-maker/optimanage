"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SettingsView, UserView } from "@/lib/data";
import { useApp } from "@/lib/context";
import { updateShopSettings, setAnalyticsPin } from "@/lib/actions/settings";
import { createUser, setUserActive, resetUserPassword } from "@/lib/actions/users";
import { Store, Shield, Users, Save, Lock, Loader2, CheckCircle, Plus, X, KeyRound, UserX, UserCheck } from "lucide-react";

const roleColors: Record<string, string> = {
  Owner: "bg-primary/10 text-primary",
  Manager: "bg-warning/10 text-warning",
  Cashier: "bg-success/10 text-success",
};

const EMPTY_NEW_USER = { name: "", email: "", password: "", role: "CASHIER" as "OWNER" | "MANAGER" | "CASHIER" };

export function SettingsClient({ settings, users, canManage, isOwner, currentUserId }: { settings: SettingsView; users: UserView[]; canManage: boolean; isOwner: boolean; currentUserId: string }) {
  const { showToast } = useApp();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"shop" | "security" | "users">("shop");

  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState({ ...EMPTY_NEW_USER });
  const [savingUser, setSavingUser] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [savingReset, setSavingReset] = useState(false);

  const saveNewUser = async () => {
    if (!newUser.name.trim() || !newUser.email.trim() || newUser.password.length < 6) {
      showToast("Fill in name, email, and a password of at least 6 characters", "error");
      return;
    }
    setSavingUser(true);
    try {
      await createUser(newUser);
      showToast("User created", "success");
      setShowAddUser(false);
      setNewUser({ ...EMPTY_NEW_USER });
      router.refresh();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Could not create user", "error");
    } finally {
      setSavingUser(false);
    }
  };

  const toggleActive = async (id: string, active: boolean) => {
    setTogglingId(id);
    try {
      await setUserActive(id, active);
      showToast(active ? "User reactivated" : "User deactivated", "success");
      router.refresh();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Could not update user", "error");
    } finally {
      setTogglingId(null);
    }
  };

  const saveResetPassword = async () => {
    if (!resettingId) return;
    if (newPassword.length < 6) { showToast("Password must be at least 6 characters", "error"); return; }
    setSavingReset(true);
    try {
      await resetUserPassword(resettingId, newPassword);
      showToast("Password reset", "success");
      setResettingId(null);
      setNewPassword("");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Could not reset password", "error");
    } finally {
      setSavingReset(false);
    }
  };
  const [shop, setShop] = useState({
    name: settings.name, phone: settings.phone, email: settings.email,
    ntn: settings.ntn, address: settings.address, receiptFooter: settings.receiptFooter,
    taxRate: settings.taxRate,
    barcodeWidth: settings.barcodeWidth, barcodeHeight: settings.barcodeHeight,
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
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Barcode bar width (px)</label>
              <input type="number" min={1} max={6} value={shop.barcodeWidth || ""} onChange={(e) => setShop({ ...shop, barcodeWidth: Number(e.target.value) })} className="w-full px-4 py-2.5 glass-input text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Barcode height (px)</label>
              <input type="number" min={20} max={120} value={shop.barcodeHeight || ""} onChange={(e) => setShop({ ...shop, barcodeHeight: Number(e.target.value) })} className="w-full px-4 py-2.5 glass-input text-sm" />
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
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">Users & Roles</h3>
            {isOwner && (
              <button onClick={() => setShowAddUser(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-primary text-white rounded-xl text-xs font-medium hover:bg-primary-hover transition-colors cursor-pointer">
                <Plus className="w-3.5 h-3.5" /> Add User
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">User</th>
                  <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Email</th>
                  <th className="text-center py-3 px-3 text-xs font-medium text-muted-foreground">Role</th>
                  <th className="text-center py-3 px-3 text-xs font-medium text-muted-foreground">Status</th>
                  {isOwner && <th className="text-center py-3 px-3 text-xs font-medium text-muted-foreground">Actions</th>}
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
                    {isOwner && (
                      <td className="py-3 px-3">
                        <div className="flex items-center justify-center gap-1.5">
                          <button onClick={() => { setResettingId(u.id); setNewPassword(""); }} title="Reset password"
                            className="p-1.5 rounded-lg hover:bg-surface-hover cursor-pointer">
                            <KeyRound className="w-3.5 h-3.5 text-muted-foreground" />
                          </button>
                          {u.id !== currentUserId && (
                            <button onClick={() => toggleActive(u.id, !u.active)} disabled={togglingId === u.id}
                              title={u.active ? "Deactivate" : "Reactivate"}
                              className="p-1.5 rounded-lg hover:bg-surface-hover cursor-pointer disabled:opacity-50">
                              {togglingId === u.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : u.active ? <UserX className="w-3.5 h-3.5 text-destructive" /> : <UserCheck className="w-3.5 h-3.5 text-success" />}
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showAddUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowAddUser(false)}>
          <div className="glass-modal p-6 w-full max-w-md animate-rise" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Add User</h3>
              <button onClick={() => setShowAddUser(false)} className="cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Name *</label>
                <input type="text" value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} className="w-full px-4 py-2.5 glass-input text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Email *</label>
                <input type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} className="w-full px-4 py-2.5 glass-input text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Password *</label>
                <input type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} className="w-full px-4 py-2.5 glass-input text-sm" placeholder="At least 6 characters" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Role</label>
                <select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value as typeof newUser.role })} className="w-full px-4 py-2.5 glass-input text-sm">
                  <option value="CASHIER">Cashier</option>
                  <option value="MANAGER">Manager</option>
                  <option value="OWNER">Owner</option>
                </select>
              </div>
              <button onClick={saveNewUser} disabled={savingUser}
                className="w-full py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-hover transition-colors disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer">
                {savingUser && <Loader2 className="w-4 h-4 animate-spin" />} Add User
              </button>
            </div>
          </div>
        </div>
      )}

      {resettingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setResettingId(null)}>
          <div className="glass-modal p-6 w-full max-w-sm animate-rise" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Reset Password</h3>
              <button onClick={() => setResettingId(null)} className="cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">New Password</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full px-4 py-2.5 glass-input text-sm" placeholder="At least 6 characters" />
            <button onClick={saveResetPassword} disabled={savingReset}
              className="w-full mt-3 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-hover transition-colors disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer">
              {savingReset && <Loader2 className="w-4 h-4 animate-spin" />} Reset Password
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

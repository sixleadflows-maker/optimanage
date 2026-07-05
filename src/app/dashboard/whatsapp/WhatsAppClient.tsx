"use client";

import { useState } from "react";
import type { WhatsAppMessageView, ReminderItem } from "@/lib/data";
import { logReminderSent } from "@/lib/actions/whatsapp";
import { formatDate, formatDateTime } from "@/lib/utils/format";
import { useApp } from "@/lib/context";
import { MessageCircle, Send, CheckCheck, Check, AlertCircle, Bell, Eye, RefreshCw } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";

const TEMPLATES = [
  { id: "t1", name: "Order Ready", message: "Hello {name}, your order at Noor Optics is ready for pickup. See you soon!" },
  { id: "t2", name: "Eye Test Reminder", message: "Hi {name}, it's been a while since your last eye test. Book an appointment with Noor Optics today." },
  { id: "t3", name: "Balance Due", message: "Dear {name}, this is a friendly reminder about the outstanding balance on your Noor Optics order. Thank you!" },
  { id: "t4", name: "Lens Replacement", message: "Hi {name}, your contact lenses may be due for replacement. Visit Noor Optics for a fresh supply." },
  { id: "t5", name: "New Arrivals", message: "Hello {name}! New designer frames just arrived at Noor Optics. Come check out the latest collection." },
  { id: "t6", name: "Thank You", message: "Thank you for shopping at Noor Optics, {name}! We appreciate your trust in us." },
];

const statusIcons: Record<string, React.ReactNode> = {
  Sent: <Check className="w-3 h-3 text-muted-foreground" />,
  Delivered: <CheckCheck className="w-3 h-3 text-muted-foreground" />,
  Read: <CheckCheck className="w-3 h-3 text-blue-500" />,
  Failed: <AlertCircle className="w-3 h-3 text-destructive" />,
};

export function WhatsAppClient({ messages, reminders: initialReminders }: { messages: WhatsAppMessageView[]; reminders: ReminderItem[] }) {
  const { showToast } = useApp();
  const [activeTab, setActiveTab] = useState<"reminders" | "templates" | "log" | "campaign">("reminders");
  const [campaignMessage, setCampaignMessage] = useState("");
  const [campaignCategory, setCampaignCategory] = useState("All Customers");
  const [reminders, setReminders] = useState(initialReminders);
  const [sendingKey, setSendingKey] = useState<string | null>(null);

  const sendReminder = async (r: ReminderItem) => {
    const phone = r.phone.replace(/[^0-9]/g, "");
    if (!phone) { showToast("No phone number on file", "error"); return; }
    const key = `${r.customerId}-${r.type}`;
    setSendingKey(key);
    try {
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(r.message)}`, "_blank");
      await logReminderSent({ customerId: r.customerId, template: r.template, message: r.message });
      setReminders((prev) => prev.filter((x) => !(x.customerId === r.customerId && x.type === r.type)));
      showToast(`Reminder logged for ${r.customerName}`, "success");
    } catch {
      showToast("Failed to log reminder", "error");
    } finally {
      setSendingKey(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <MessageCircle className="w-6 h-6 text-[#25D366]" /> WhatsApp Center
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage customer communications</p>
      </div>

      <div className="flex gap-1.5">
        {(["reminders", "templates", "log", "campaign"] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-xl text-sm font-medium capitalize transition-all flex items-center gap-1.5 ${activeTab === tab ? "bg-[#25D366] text-white" : "bg-surface hover:bg-surface-hover"}`}>
            {tab === "log" ? "Sent Log" : tab === "reminders" ? "Reminders Due" : tab}
            {tab === "reminders" && reminders.length > 0 && (
              <span className={`text-[10px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center ${activeTab === tab ? "bg-white/25" : "bg-destructive text-white"}`}>
                {reminders.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {activeTab === "reminders" && (
        <div className="glass-card p-4">
          {reminders.length === 0 ? (
            <EmptyState icon={Bell} title="No reminders due" hint="Customers due for a 1-year eye test or 6-month lens change follow-up will show up here automatically." />
          ) : (
            <div className="space-y-2">
              {reminders.map((r) => {
                const key = `${r.customerId}-${r.type}`;
                return (
                  <div key={key} className="flex items-center gap-3 p-3 rounded-xl bg-surface">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${r.type === "EYE_TEST" ? "bg-blue-500/10 text-blue-500" : "bg-amber-500/10 text-amber-500"}`}>
                      {r.type === "EYE_TEST" ? <Eye className="w-4 h-4" /> : <RefreshCw className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{r.customerName}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.type === "EYE_TEST" ? "Eye test" : "Lens change"} due · {r.daysSince} days since {formatDate(r.lastDate)}
                      </p>
                    </div>
                    <button
                      onClick={() => sendReminder(r)}
                      disabled={sendingKey === key}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#25D366] text-white rounded-lg text-xs font-medium hover:bg-[#20bd5a] transition-colors disabled:opacity-60 flex-shrink-0">
                      <Send className="w-3 h-3" /> Send
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === "templates" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {TEMPLATES.map((t) => (
            <div key={t.id} className="glass-card p-5">
              <h3 className="font-semibold text-sm mb-2">{t.name}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed mb-4">{t.message}</p>
              <button onClick={() => { navigator.clipboard?.writeText(t.message); showToast(`Template "${t.name}" copied`, "success"); }}
                className="flex items-center gap-2 px-3 py-1.5 bg-[#25D366]/10 text-[#25D366] rounded-lg text-xs font-medium hover:bg-[#25D366]/20 transition-colors">
                <Send className="w-3 h-3" /> Copy Template
              </button>
            </div>
          ))}
        </div>
      )}

      {activeTab === "log" && (
        <div className="glass-card p-4">
          {messages.length === 0 ? (
            <EmptyState icon={MessageCircle} title="No messages sent yet" hint="Message customers from their profile or the POS receipt — the log will build up here." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Customer</th>
                    <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Phone</th>
                    <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Template</th>
                    <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Message</th>
                    <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Sent At</th>
                    <th className="text-center py-3 px-3 text-xs font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {messages.map((msg) => (
                    <tr key={msg.id} className="border-b border-border hover:bg-surface-hover/50">
                      <td className="py-3 px-3 font-medium">{msg.customerName}</td>
                      <td className="py-3 px-3 text-xs text-muted-foreground">{msg.to}</td>
                      <td className="py-3 px-3"><span className="chip bg-[#25D366]/10 text-[#25D366]">{msg.template}</span></td>
                      <td className="py-3 px-3 text-xs text-muted-foreground max-w-xs truncate">{msg.message}</td>
                      <td className="py-3 px-3 text-xs text-muted-foreground">{formatDateTime(msg.sentAt)}</td>
                      <td className="py-3 px-3 text-center">
                        <span className="flex items-center justify-center gap-1 text-xs">
                          {statusIcons[msg.status]} {msg.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === "campaign" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold mb-4">Compose Message</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Target Audience</label>
                <select value={campaignCategory} onChange={(e) => setCampaignCategory(e.target.value)}
                  className="w-full px-4 py-2.5 glass-input text-sm">
                  <option>All Customers</option>
                  <option>Customers with Balance</option>
                  <option>Last Visit &gt; 3 months</option>
                  <option>Contact Lens Users</option>
                  <option>Premium Customers (Rs.20K+)</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Use Template</label>
                <select className="w-full px-4 py-2.5 glass-input text-sm"
                  onChange={(e) => {
                    const t = TEMPLATES.find((t) => t.id === e.target.value);
                    if (t) setCampaignMessage(t.message);
                  }}>
                  <option value="">Custom message</option>
                  {TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Message</label>
                <textarea value={campaignMessage} onChange={(e) => setCampaignMessage(e.target.value)}
                  rows={4} className="w-full px-4 py-2.5 glass-input text-sm resize-none"
                  placeholder="Type your campaign message..." />
              </div>
              <button onClick={() => { navigator.clipboard?.writeText(campaignMessage); showToast("Message copied — paste it into WhatsApp Broadcast", "success"); }}
                disabled={!campaignMessage.trim()}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#25D366] text-white rounded-xl text-sm font-medium hover:bg-[#20bd5a] transition-colors disabled:opacity-60">
                <Send className="w-4 h-4" /> Copy for Broadcast
              </button>
              <p className="text-[11px] text-muted-foreground">
                Bulk sending requires a WhatsApp Business API connection. For now, copy the message and send it via a WhatsApp Broadcast list.
              </p>
            </div>
          </div>
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold mb-4">Preview</h3>
            <div className="bg-[#E5DDD5] rounded-2xl p-4 min-h-[300px]">
              <div className="bg-[#DCF8C6] rounded-xl rounded-tr-sm p-3 max-w-[80%] ml-auto shadow-sm">
                <p className="text-sm text-gray-800 whitespace-pre-wrap">
                  {campaignMessage || "Your message will appear here..."}
                </p>
                <p className="text-[10px] text-gray-500 text-right mt-1">✓✓</p>
              </div>
              <p className="text-center text-xs text-gray-500 mt-4">
                Audience: <span className="font-medium">{campaignCategory}</span>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

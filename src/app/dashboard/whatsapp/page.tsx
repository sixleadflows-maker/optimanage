import { getWhatsAppMessages, getReminders } from "@/lib/data";
import { WhatsAppClient } from "./WhatsAppClient";

export const dynamic = "force-dynamic";

export default async function WhatsAppPage() {
  const [messages, reminders] = await Promise.all([getWhatsAppMessages(), getReminders()]);
  return <WhatsAppClient messages={messages} reminders={reminders} />;
}
